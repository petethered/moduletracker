/**
 * Cloud sync layer for Module Tracker.
 *
 * Role in the auth/sync stack:
 * - Pushes the local Zustand store's persisted state (`pulls` + `moduleProgress`
 *   + `bannerDefault`) to the Cloudflare Worker, and pulls it back on demand.
 * - Sits ABOVE api.ts (uses apiFetch) and BELOW the Zustand subscription
 *   that listens for store changes. The store subscription calls
 *   `schedulePush` on every meaningful change.
 * - Handles offline/online distinction via `navigator.onLine`.
 *
 * Worker contract (D1-backed):
 * - GET  /data           -> { data: SyncData, updatedAt: ISOString }
 * - PUT  /data           -> { ok: true }
 *   Body: { data: SyncData }
 * Both endpoints require a valid JWT (apiFetch attaches it).
 *
 * Sync triggers:
 * - schedulePush: fired by the Zustand subscription on any change to the
 *   persisted slices. Debounced 2s — bursts of updates (e.g. recording many
 *   pulls in a row) collapse into a single PUT.
 * - pullFromCloud: fired manually after login or on app boot when
 *   storageChoice is "cloud" and we have a valid token.
 * - pushToCloud: fired manually for an immediate, non-debounced push (e.g.
 *   right after a successful merge during initial cloud hydration).
 *
 * Offline behavior:
 * - On a failed push, we set status to "offline" if `navigator.onLine` is
 *   false, otherwise "error". The pending change stays in the local store
 *   (Zustand persists to localStorage independently of this layer), so the
 *   next successful push will carry it.
 * - There is intentionally NO offline queue — because the local store IS
 *   the queue. We always PUT the full SyncData, so retrying just sends the
 *   latest snapshot.
 *
 * Conflict resolution philosophy (see mergeData / mergePulls / mergeModuleProgress):
 * - Pulls: union by id, with local writes winning ties. Pulls are immutable
 *   records of past events — there's no "edit conflict" in practice; if the
 *   same id exists on both sides, prefer local because the user just typed it.
 * - Module progress: pick the side with the higher rarity (rarities have a
 *   strict order in MODULE_RARITY_ORDER). This embeds a "progress only goes
 *   up" invariant — user can't downgrade a module's rarity, so the higher
 *   value is always the truthful one.
 * - bannerDefault: local always wins. It's a UI preference, not user data.
 *
 * Non-obvious gotchas:
 * - The debounce timer is a MODULE-LEVEL singleton. Multiple stores or
 *   multiple subscribers would clobber each other. There is exactly one
 *   pending push at a time by design.
 * - schedulePush takes a `getData` thunk rather than a SyncData snapshot
 *   so the eventual PUT captures the LATEST state at flush time, not the
 *   state when the change was observed. This is critical for correctness
 *   under bursts — we want to send one final snapshot, not the first one.
 * - mergeData is asymmetric in `local` vs `cloud` arguments. Order matters.
 * - Race: if a push is in flight and a new change arrives, the change is
 *   NOT lost — schedulePush starts a fresh debounce, but the in-flight
 *   PUT carries an older snapshot. Worker will receive the newer snapshot
 *   on the next fire (~2s later). Last-write-wins on the server.
 * - We catch errors silently in pullFromCloud and pushToCloud (return
 *   null/false). Callers must check the return value — there is no
 *   thrown error to ignore.
 */

import { apiFetch } from "./api";
import type { PullRecord, ModuleProgress, BannerType } from "../types";
import { MODULE_RARITY_ORDER } from "../config/rarityColors";

/**
 * UI-facing sync status.
 * - idle: no sync in progress, no recent activity.
 * - syncing: a PUT is in flight.
 * - synced: last PUT succeeded.
 * - error: last PUT failed while online (server error, auth issue, etc).
 * - offline: last PUT failed AND navigator.onLine is false.
 */
export type SyncStatus = "idle" | "syncing" | "synced" | "error" | "offline";

/**
 * The exact payload shape sent to and received from the Worker.
 * Mirrors the persisted slice of the Zustand store. Adding a new persisted
 * field requires a Worker-side schema bump AND a merge strategy below.
 */
export interface SyncData {
  pulls: PullRecord[];
  moduleProgress: Record<string, ModuleProgress>;
  bannerDefault: BannerType;
}

// Module-level singleton for the debounce timer. Only one pending push
// can exist at a time — see file header for rationale.
let syncTimer: ReturnType<typeof setTimeout> | null = null;

// Debounce window for schedulePush. Tuned to coalesce typical user bursts
// (e.g. logging several pulls in quick succession) without making the user
// wait too long to see "synced" feedback. Do not change without considering
// Worker rate limits and the test suite's timing assumptions.
const DEBOUNCE_MS = 2000;

/**
 * Queue a debounced PUT of the latest local state to the Worker.
 *
 * @param getData - Thunk returning the CURRENT SyncData. Called at flush
 *   time (not now) so the PUT carries the latest snapshot. Always pass a
 *   function that reads from the live store; do not capture a stale value.
 * @param onStatusChange - Receives status transitions for UI display.
 *   Called with "syncing" before the PUT and either "synced", "error", or
 *   "offline" after. Not called if the timer is replaced before firing.
 *
 * @remarks
 * Side effects:
 * - Cancels any previously scheduled push (intentional debounce).
 * - Starts a new 2s timer; on fire, executes a PUT to /data.
 *
 * Ordering / race notes:
 * - If called while a previous PUT is mid-flight, the in-flight PUT is
 *   NOT cancelled — JS can't abort a fetch we already awaited. The new
 *   debounce will start a second PUT after the first resolves. Worker is
 *   last-write-wins so this is safe.
 * - onStatusChange may be called out of order if two PUTs overlap (rare).
 *   UI should treat status as "latest known" rather than a strict timeline.
 *
 * Error handling:
 * - Any thrown error (ApiError or network TypeError) is caught and
 *   downgraded to a status update. We deliberately do NOT re-throw — sync
 *   is a background concern; failures must not crash UI handlers.
 */
export function schedulePush(
  getData: () => SyncData,
  onStatusChange: (status: SyncStatus) => void,
) {
  // Replace any pending timer so the most recent change wins. This is the
  // entire debounce mechanism — every call resets the 2s clock.
  if (syncTimer) clearTimeout(syncTimer);
  syncTimer = setTimeout(async () => {
    try {
      onStatusChange("syncing");
      // getData() is invoked HERE, at flush time, to capture the latest
      // store state. Calling it earlier would defeat the debounce.
      await apiFetch("/data", {
        method: "PUT",
        body: JSON.stringify({ data: getData() }),
      });
      onStatusChange("synced");
    } catch {
      // Distinguish offline from server error using navigator.onLine.
      // Note: navigator.onLine is heuristic (it can be true on a captive
      // portal etc) — the Worker will eventually 4xx/5xx in that case and
      // we'll show "error" on a later attempt. Good enough for UI.
      onStatusChange(navigator.onLine ? "error" : "offline");
    }
  }, DEBOUNCE_MS);
}

/**
 * Cancel a pending debounced push if one is scheduled.
 *
 * @remarks
 * Use cases:
 * - On logout, before clearing local state, to avoid a stale PUT firing
 *   with the to-be-cleared data.
 * - On switching storageChoice from "cloud" to "local", to silence sync.
 * No-op if no timer is pending. Does NOT abort an in-flight PUT (see
 * schedulePush race notes).
 */
export function cancelPendingPush() {
  if (syncTimer) {
    clearTimeout(syncTimer);
    syncTimer = null;
  }
}

/**
 * Fetch the user's cloud-stored data.
 *
 * @returns The cloud SyncData, or null on any failure (network, auth, 404).
 *
 * @remarks
 * - Returns null instead of throwing so callers can branch with a simple
 *   nullish check. Errors are intentionally swallowed; if the caller needs
 *   to distinguish "no data" from "fetch failed", use apiFetch directly.
 * - Worker returns `{ data, updatedAt }`; we discard updatedAt because the
 *   merge strategy doesn't use timestamps (rarity ordering and id union are
 *   self-resolving). If we ever add LWW for individual fields we'll need
 *   updatedAt back.
 * - Typical call sites: post-login hydration, manual "pull from cloud"
 *   button in settings, app boot when storageChoice is "cloud".
 */
export async function pullFromCloud(): Promise<SyncData | null> {
  try {
    const result = await apiFetch<{ data: SyncData; updatedAt: string }>("/data");
    return result.data;
  } catch {
    // All failure modes (network, 401, 404 first-time user, 500) collapse
    // to null. Caller must handle "no cloud data yet" by falling back to
    // local state and pushing it up to seed the cloud copy.
    return null;
  }
}

/**
 * Push a SyncData snapshot immediately, without debouncing.
 *
 * @param data - The snapshot to PUT. Caller is responsible for assembling
 *   it from the live store; no thunk because no debounce.
 * @returns true on success, false on any failure.
 *
 * @remarks
 * Use cases:
 * - Right after merging local + cloud during initial hydration, to seed
 *   the cloud copy with the merged result.
 * - Explicit "save to cloud now" UX action.
 * Most state changes should go through schedulePush instead — this is the
 * escape hatch for cases where you must not wait for the debounce.
 */
export async function pushToCloud(data: SyncData): Promise<boolean> {
  try {
    await apiFetch("/data", {
      method: "PUT",
      body: JSON.stringify({ data }),
    });
    return true;
  } catch {
    // Same swallow-and-return pattern as pullFromCloud. Caller decides
    // whether to retry, surface a toast, or schedule a deferred push.
    return false;
  }
}

/**
 * Merge two pull arrays, preferring local on id collisions.
 *
 * Strategy: union by id, last-write-wins where local is "last".
 * - Insert all cloud pulls first.
 * - Insert all local pulls second; same id overwrites.
 *
 * Why local-wins: a pull is an immutable record (banner, modules pulled,
 * timestamp). The only way the same id exists on both sides is if the
 * local copy is a superset (e.g. user edited a note offline). Local being
 * the most recently-touched copy makes it the right choice.
 *
 * Map preserves insertion order, but the resulting array order is not
 * meaningful here — selectors sort by timestamp downstream.
 */
function mergePulls(local: PullRecord[], cloud: PullRecord[]): PullRecord[] {
  const merged = new Map<string, PullRecord>();
  // Cloud first so local values overwrite on id collision.
  for (const pull of cloud) merged.set(pull.id, pull);
  for (const pull of local) merged.set(pull.id, pull);
  return Array.from(merged.values());
}

/**
 * Merge two moduleProgress maps using rarity-ordering as the conflict key.
 *
 * Strategy:
 * - Start from a copy of cloud (covers cloud-only modules).
 * - For each local entry: if cloud has no entry, take local; if both
 *   exist, take whichever has the higher rarity (per MODULE_RARITY_ORDER:
 *   common < rare < epic < legendary < mythic < ancestral).
 *
 * Why rarity-ordering: module progress is monotonic in this app — users
 * can only level UP a module's rarity, never down. So if local says
 * "legendary" and cloud says "epic", local is newer; if local says "epic"
 * and cloud says "legendary", another device upgraded it — cloud wins.
 * No timestamps needed.
 *
 * Tie behavior (`localIdx >= cloudIdx`): on equal rarity, prefer local.
 * Other ProgressFields (kept count, etc) are bundled inside ModuleProgress
 * and ride along with whichever side wins. We are NOT field-merging — it's
 * a whole-record swap. Acceptable because all fields are correlated with
 * rarity in practice.
 */
function mergeModuleProgress(
  local: Record<string, ModuleProgress>,
  cloud: Record<string, ModuleProgress>,
): Record<string, ModuleProgress> {
  // Seed from cloud so any module that exists only in the cloud is preserved.
  const merged: Record<string, ModuleProgress> = { ...cloud };

  for (const [moduleId, localProgress] of Object.entries(local)) {
    const cloudProgress = cloud[moduleId];
    if (!cloudProgress) {
      // Local-only module — take it as-is.
      merged[moduleId] = localProgress;
    } else {
      // Both sides have an entry. Compare rarity ordinals; higher wins.
      // indexOf returns -1 for unknown rarities — that's intentionally the
      // lowest possible value, so a corrupt rarity loses to any valid one.
      const localIdx = MODULE_RARITY_ORDER.indexOf(localProgress.currentRarity);
      const cloudIdx = MODULE_RARITY_ORDER.indexOf(cloudProgress.currentRarity);
      // >= means local wins ties (matches the philosophy used in mergePulls).
      merged[moduleId] = localIdx >= cloudIdx ? localProgress : cloudProgress;
    }
  }

  return merged;
}

/**
 * Combine local and cloud snapshots into a single SyncData ready to write
 * back to both the Zustand store and the Worker.
 *
 * @param local - The current local snapshot (Zustand).
 * @param cloud - The snapshot fetched via pullFromCloud.
 * @returns A merged snapshot. Pure function, no side effects.
 *
 * @remarks
 * Field-by-field strategy:
 * - pulls: union by id, local wins ties (mergePulls).
 * - moduleProgress: per-module rarity-max, local wins ties (mergeModuleProgress).
 * - bannerDefault: local wins outright. It's a UI preference; the device
 *   the user is currently on is the right source.
 *
 * Argument order is significant — swapping local/cloud changes tie-breaking
 * for both pulls and moduleProgress. Always pass (local, cloud).
 *
 * Typical caller flow:
 *   const cloud = await pullFromCloud();
 *   if (cloud) {
 *     const merged = mergeData(getLocal(), cloud);
 *     applyToStore(merged);
 *     await pushToCloud(merged); // seed cloud with the merged result
 *   }
 */
export function mergeData(local: SyncData, cloud: SyncData): SyncData {
  return {
    pulls: mergePulls(local.pulls, cloud.pulls),
    moduleProgress: mergeModuleProgress(local.moduleProgress, cloud.moduleProgress),
    // bannerDefault is a per-device preference; local always wins. If we
    // ever want cross-device default-banner sync we'd need a timestamp here.
    bannerDefault: local.bannerDefault,
  };
}
