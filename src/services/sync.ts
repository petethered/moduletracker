import { apiFetch } from "./api";
import type { PullRecord, ModuleProgress, BannerType } from "../types";
import { MODULE_RARITY_ORDER } from "../config/rarityColors";

export type SyncStatus = "idle" | "syncing" | "synced" | "error" | "offline";

export interface SyncData {
  pulls: PullRecord[];
  moduleProgress: Record<string, ModuleProgress>;
  bannerDefault: BannerType;
}

let syncTimer: ReturnType<typeof setTimeout> | null = null;
const DEBOUNCE_MS = 2000;

export function schedulePush(
  getData: () => SyncData,
  onStatusChange: (status: SyncStatus) => void,
) {
  if (syncTimer) clearTimeout(syncTimer);
  syncTimer = setTimeout(async () => {
    try {
      onStatusChange("syncing");
      await apiFetch("/data", {
        method: "PUT",
        body: JSON.stringify({ data: getData() }),
      });
      onStatusChange("synced");
    } catch {
      onStatusChange(navigator.onLine ? "error" : "offline");
    }
  }, DEBOUNCE_MS);
}

export function cancelPendingPush() {
  if (syncTimer) {
    clearTimeout(syncTimer);
    syncTimer = null;
  }
}

export async function pullFromCloud(): Promise<SyncData | null> {
  try {
    const result = await apiFetch<{ data: SyncData; updatedAt: string }>("/data");
    return result.data;
  } catch {
    return null;
  }
}

export async function pushToCloud(data: SyncData): Promise<boolean> {
  try {
    await apiFetch("/data", {
      method: "PUT",
      body: JSON.stringify({ data }),
    });
    return true;
  } catch {
    return false;
  }
}

function mergePulls(local: PullRecord[], cloud: PullRecord[]): PullRecord[] {
  const merged = new Map<string, PullRecord>();
  for (const pull of cloud) merged.set(pull.id, pull);
  for (const pull of local) merged.set(pull.id, pull);
  return Array.from(merged.values());
}

function mergeModuleProgress(
  local: Record<string, ModuleProgress>,
  cloud: Record<string, ModuleProgress>,
): Record<string, ModuleProgress> {
  const merged: Record<string, ModuleProgress> = { ...cloud };

  for (const [moduleId, localProgress] of Object.entries(local)) {
    const cloudProgress = cloud[moduleId];
    if (!cloudProgress) {
      merged[moduleId] = localProgress;
    } else {
      const localIdx = MODULE_RARITY_ORDER.indexOf(localProgress.currentRarity);
      const cloudIdx = MODULE_RARITY_ORDER.indexOf(cloudProgress.currentRarity);
      merged[moduleId] = localIdx >= cloudIdx ? localProgress : cloudProgress;
    }
  }

  return merged;
}

export function mergeData(local: SyncData, cloud: SyncData): SyncData {
  return {
    pulls: mergePulls(local.pulls, cloud.pulls),
    moduleProgress: mergeModuleProgress(local.moduleProgress, cloud.moduleProgress),
    bannerDefault: local.bannerDefault,
  };
}
