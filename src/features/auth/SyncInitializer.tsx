/**
 * SyncInitializer — invisible orchestrator that owns the cloud-sync lifecycle.
 *
 * Role in the broader feature:
 *   This component renders nothing. It exists purely to host the three useEffects that
 *   connect the Zustand store to the cloud (Cloudflare Worker via `services/sync`).
 *   Mount it once near the root of the tree (after the store is ready and
 *   StorageChoiceModal has resolved). It self-gates on storageChoice/syncEnabled/user,
 *   so it's safe to mount unconditionally.
 *
 * User flow / lifecycle (sync-status state machine):
 *   mount → fetch user (already in store from auth) → check storageChoice="cloud" + token
 *         → effect 1: initial pull-merge-push
 *         → effect 2: subscribe to local mutations and debounce-push
 *         → effect 3: re-push when network returns from offline
 *
 *   Sync status transitions (drives <SyncStatus/> badge):
 *     idle    → no sync attempted yet (or user logged out / disabled)
 *     syncing → pull or push in flight
 *     synced  → last operation succeeded
 *     error   → last operation failed; user can click badge to retry
 *     offline → set by services/sync when fetch fails due to network
 *
 * Error handling:
 *   - pullFromCloud returning null → setSyncStatus("error"); we KEEP local data untouched
 *     so the user can keep working. They can retry later.
 *   - 401/expired token → handled by `setOnAuthExpired` (effect 0): we drop user, disable
 *     sync, and reset status. The user will see the auth-prompt UI again.
 *   - schedulePush is fire-and-forget; it reports success/failure back via the status
 *     setter we hand it.
 *
 * Key invariants:
 *   - `initialized.current` guards effect 1 from running twice (StrictMode double-mount,
 *     or user toggling sync off/on). It also gates effect 2's subscription so we don't
 *     push during the initial merge.
 *   - We `cancelPendingPush()` on unmount and on disable to prevent zombie network calls
 *     after the user logs out.
 *   - The initial-sync flow is pull-then-merge-then-push (NOT push). Pushing first would
 *     destroy any data the user has on another device.
 *
 * Why a separate component instead of hooks at the root?
 *   Keeping these effects co-located makes the lifecycle obvious and lets us drop the
 *   whole sync layer by simply not rendering this component. Also avoids polluting the
 *   App component with sync-specific state subscriptions.
 */
import { useEffect, useRef } from "react";
import { useStore } from "../../store";
import { isAuthenticated, setOnAuthExpired } from "../../services/api";
import { pullFromCloud, pushToCloud, mergeData, schedulePush, cancelPendingPush } from "../../services/sync";
import type { SyncData } from "../../services/sync";

export function SyncInitializer() {
  // Store subscriptions — selecting individually so we don't re-render on unrelated state.
  const syncEnabled = useStore((s) => s.syncEnabled);
  const storageChoice = useStore((s) => s.storageChoice);
  const user = useStore((s) => s.user);
  const setSyncStatus = useStore((s) => s.setSyncStatus);
  const setUser = useStore((s) => s.setUser);
  const setSyncEnabled = useStore((s) => s.setSyncEnabled);
  const importPulls = useStore((s) => s.importPulls);
  const importModuleProgress = useStore((s) => s.importModuleProgress);
  // Guards the one-time initial sync effect AND gates effect 2's subscription so we don't
  // push during the merge phase. Using ref (not state) avoids re-renders.
  const initialized = useRef(false);

  // ---------------------------------------------------------------------------------
  // Effect 0: Auth-expiry handler
  // ---------------------------------------------------------------------------------
  // services/api invokes the registered callback whenever a request comes back 401.
  // We tear down the signed-in state so the UI re-prompts for login. Keeping the
  // callback registration here (rather than in services/api) lets us hit React state
  // setters without dragging React into the api module.
  useEffect(() => {
    setOnAuthExpired(() => {
      setUser(null);
      setSyncEnabled(false);
      setSyncStatus("idle");
    });
  }, [setUser, setSyncEnabled, setSyncStatus]);

  // ---------------------------------------------------------------------------------
  // Effect 1: Initial sync on startup (pull → merge → push)
  // ---------------------------------------------------------------------------------
  // This is the most important effect. It runs exactly once per session and resolves the
  // canonical state by merging whatever's locally-persisted with whatever's on the server.
  //
  // Order of operations is critical:
  //   1. PULL first. Pushing first would clobber data made on another device.
  //   2. If the cloud is empty BUT we have local data, push local up. This handles the
  //      "user just enabled cloud sync after using local" case.
  //   3. If the cloud has data, MERGE (services/sync defines the merge rule), apply the
  //      result locally, then push the merged result back so both sides are aligned.
  //   4. If neither side has data, just go to "synced" without any push.
  useEffect(() => {
    // Strict re-entry guard. Without this, StrictMode double-mount in dev would run the
    // initial sync twice and could race the import calls.
    if (initialized.current) return;
    // Gate: only run when the user has opted into cloud sync, has a user, AND has a
    // valid token. `isAuthenticated()` checks the JWT exists & isn't expired client-side.
    if (storageChoice !== "cloud" || !syncEnabled || !user || !isAuthenticated()) return;
    initialized.current = true;

    const doSync = async () => {
      setSyncStatus("syncing");
      const cloudData = await pullFromCloud();

      // null means the pull failed (network, 5xx, etc.). DON'T touch local data.
      // The user keeps working with what they have; the badge tells them to retry.
      if (!cloudData) {
        setSyncStatus("error");
        return;
      }

      // Snapshot local state at this exact moment (before any imports kick in).
      // We use `useStore.getState()` rather than the closure values because the closure
      // could be stale if the user mutated state between mount and the awaited pull.
      const state = useStore.getState();
      const localData: SyncData = {
        pulls: state.pulls,
        moduleProgress: state.moduleProgress,
        bannerDefault: state.bannerDefault,
      };

      // Defensive defaults — older accounts may not have moduleProgress/bannerDefault
      // fields stored. Treat missing as empty.
      const cloudPulls = cloudData.pulls ?? [];
      const cloudProgress = cloudData.moduleProgress ?? {};
      const hasCloudData = cloudPulls.length > 0 || Object.keys(cloudProgress).length > 0;

      if (hasCloudData) {
        // Build a fully-defaulted SyncData before merging so mergeData doesn't have to
        // worry about undefined fields. Falling back to localData.bannerDefault means a
        // user who set their banner preference locally but never on the cloud keeps it.
        const safeCloudData: SyncData = {
          pulls: cloudPulls,
          moduleProgress: cloudProgress,
          bannerDefault: cloudData.bannerDefault ?? localData.bannerDefault,
        };
        const merged = mergeData(localData, safeCloudData);
        // Apply merged state locally first so the UI updates immediately.
        importPulls(merged.pulls);
        importModuleProgress(merged.moduleProgress);
        // Then push the same merged state back. This ensures the cloud reflects any
        // local-only data that participated in the merge.
        await pushToCloud(merged);
      } else if (localData.pulls.length > 0) {
        // Cloud is empty but we have local data — first sync after enabling cloud.
        // Push local up as the initial cloud copy.
        await pushToCloud(localData);
      }
      // (else: both sides empty, nothing to do.)

      setSyncStatus("synced");
    };

    // Top-level catch in case anything inside doSync throws unexpectedly. Without this
    // an unhandled rejection would be swallowed and the badge would stay on "syncing".
    doSync().catch(() => setSyncStatus("error"));
  }, [storageChoice, syncEnabled, user, setSyncStatus, importPulls, importModuleProgress]);

  // ---------------------------------------------------------------------------------
  // Effect 2: Auto-push on local mutation
  // ---------------------------------------------------------------------------------
  // Subscribes to the entire store and pushes whenever pulls/moduleProgress/bannerDefault
  // change. Three concerns to address:
  //   1. Avoid pushing on every keystroke / non-syncable change → use JSON.stringify
  //      diff against prevSnapshot. Yes, stringify is slow, but pulls are small; this is
  //      simpler than per-field equality and more robust to schema additions.
  //   2. Avoid pushing during the initial merge → gate on initialized.current.
  //   3. Avoid hammering the server → schedulePush in services/sync debounces calls.
  //
  // Why we don't use Zustand's `subscribeWithSelector` middleware: this hook needs to
  // see multiple slices in a single tick to compute the snapshot, and the diffing logic
  // here works fine without selector middleware.
  useEffect(() => {
    // If sync is off / signed out, ensure no debounced push is still queued.
    if (storageChoice !== "cloud" || !syncEnabled || !user || !isAuthenticated()) {
      cancelPendingPush();
      return;
    }

    // Initial baseline: stringify NOW so the very first state-change after mount is
    // compared against the current truth, not against an empty/initial state.
    let prevSnapshot = JSON.stringify({
      pulls: useStore.getState().pulls,
      moduleProgress: useStore.getState().moduleProgress,
      bannerDefault: useStore.getState().bannerDefault,
    });

    const unsub = useStore.subscribe((state) => {
      // Don't push until the initial pull-merge has completed. Otherwise the merged
      // import we just performed would itself trigger a push of pre-merge data.
      if (!initialized.current) return;
      const snapshot = JSON.stringify({
        pulls: state.pulls,
        moduleProgress: state.moduleProgress,
        bannerDefault: state.bannerDefault,
      });
      // Skip pushes triggered by changes to other slices (UI state, settings, etc.).
      if (snapshot === prevSnapshot) return;
      prevSnapshot = snapshot;
      // schedulePush debounces internally. We pass a getter (not a value) so it always
      // sends the freshest state at flush time, not the state when this fired.
      schedulePush(
        () => {
          const s = useStore.getState();
          return { pulls: s.pulls, moduleProgress: s.moduleProgress, bannerDefault: s.bannerDefault };
        },
        (status) => useStore.getState().setSyncStatus(status),
      );
    });

    // Cleanup: detach subscriber and cancel any in-flight debounced push so we don't
    // push after sign-out / sync-disable.
    return () => {
      unsub();
      cancelPendingPush();
    };
  }, [storageChoice, syncEnabled, user]);

  // ---------------------------------------------------------------------------------
  // Effect 3: Reconnect handler
  // ---------------------------------------------------------------------------------
  // Listens for the browser's `online` event. While offline, schedulePush will have
  // failed and set status="offline". When we come back online we want to flush any
  // pending changes immediately (NOT wait for the next mutation). We push directly
  // here rather than calling schedulePush so the user sees an instant retry.
  //
  // Note we don't gate on isAuthenticated() like the other effects — if the token has
  // expired during offline-time, pushToCloud will return false and effect 0's
  // onAuthExpired hook will handle the cleanup.
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

  // Renders nothing — this is a side-effect-only component.
  return null;
}
