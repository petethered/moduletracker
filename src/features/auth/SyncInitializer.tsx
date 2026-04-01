import { useEffect, useRef } from "react";
import { useStore } from "../../store";
import { isAuthenticated, setOnAuthExpired } from "../../services/api";
import { pullFromCloud, pushToCloud, mergeData, schedulePush, cancelPendingPush } from "../../services/sync";
import type { SyncData } from "../../services/sync";

export function SyncInitializer() {
  const syncEnabled = useStore((s) => s.syncEnabled);
  const storageChoice = useStore((s) => s.storageChoice);
  const user = useStore((s) => s.user);
  const setSyncStatus = useStore((s) => s.setSyncStatus);
  const setUser = useStore((s) => s.setUser);
  const setSyncEnabled = useStore((s) => s.setSyncEnabled);
  const importPulls = useStore((s) => s.importPulls);
  const importModuleProgress = useStore((s) => s.importModuleProgress);
  const initialized = useRef(false);

  // Set up auth expiry handler
  useEffect(() => {
    setOnAuthExpired(() => {
      setUser(null);
      setSyncEnabled(false);
      setSyncStatus("idle");
    });
  }, [setUser, setSyncEnabled, setSyncStatus]);

  // Initial sync on startup
  useEffect(() => {
    if (initialized.current) return;
    if (storageChoice !== "cloud" || !syncEnabled || !user || !isAuthenticated()) return;
    initialized.current = true;

    const doSync = async () => {
      setSyncStatus("syncing");
      const cloudData = await pullFromCloud();

      if (!cloudData) {
        setSyncStatus("error");
        return;
      }

      const state = useStore.getState();
      const localData: SyncData = {
        pulls: state.pulls,
        moduleProgress: state.moduleProgress,
        bannerDefault: state.bannerDefault,
      };

      const cloudPulls = cloudData.pulls ?? [];
      const cloudProgress = cloudData.moduleProgress ?? {};
      const hasCloudData = cloudPulls.length > 0 || Object.keys(cloudProgress).length > 0;

      if (hasCloudData) {
        const safeCloudData: SyncData = {
          pulls: cloudPulls,
          moduleProgress: cloudProgress,
          bannerDefault: cloudData.bannerDefault ?? localData.bannerDefault,
        };
        const merged = mergeData(localData, safeCloudData);
        importPulls(merged.pulls);
        importModuleProgress(merged.moduleProgress);
        await pushToCloud(merged);
      } else if (localData.pulls.length > 0) {
        await pushToCloud(localData);
      }

      setSyncStatus("synced");
    };

    doSync().catch(() => setSyncStatus("error"));
  }, [storageChoice, syncEnabled, user, setSyncStatus, importPulls, importModuleProgress]);

  // Subscribe to state changes for auto-push
  useEffect(() => {
    if (storageChoice !== "cloud" || !syncEnabled || !user || !isAuthenticated()) {
      cancelPendingPush();
      return;
    }

    let prevSnapshot = JSON.stringify({
      pulls: useStore.getState().pulls,
      moduleProgress: useStore.getState().moduleProgress,
      bannerDefault: useStore.getState().bannerDefault,
    });

    const unsub = useStore.subscribe((state) => {
      if (!initialized.current) return;
      const snapshot = JSON.stringify({
        pulls: state.pulls,
        moduleProgress: state.moduleProgress,
        bannerDefault: state.bannerDefault,
      });
      if (snapshot === prevSnapshot) return;
      prevSnapshot = snapshot;
      schedulePush(
        () => {
          const s = useStore.getState();
          return { pulls: s.pulls, moduleProgress: s.moduleProgress, bannerDefault: s.bannerDefault };
        },
        (status) => useStore.getState().setSyncStatus(status),
      );
    });

    return () => {
      unsub();
      cancelPendingPush();
    };
  }, [storageChoice, syncEnabled, user]);

  // Reconnect handler
  useEffect(() => {
    if (storageChoice !== "cloud" || !syncEnabled || !user) return;

    const handleOnline = () => {
      const state = useStore.getState();
      const data: SyncData = {
        pulls: state.pulls,
        moduleProgress: state.moduleProgress,
        bannerDefault: state.bannerDefault,
      };
      pushToCloud(data).then((ok) => {
        setSyncStatus(ok ? "synced" : "error");
      });
    };

    window.addEventListener("online", handleOnline);
    return () => window.removeEventListener("online", handleOnline);
  }, [storageChoice, syncEnabled, user, setSyncStatus]);

  return null;
}
