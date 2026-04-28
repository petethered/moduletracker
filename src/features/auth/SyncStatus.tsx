/**
 * SyncStatus — tiny status badge that surfaces the current cloud-sync state to the user.
 *
 * Role in the broader feature:
 *   The visual counterpart to SyncInitializer. SyncInitializer drives the `syncStatus`
 *   field; this component reads it and renders an icon + tooltip. Lives in the header
 *   chrome (next to the user menu). Only meaningful when storageChoice === "cloud".
 *
 * Sync-status → UI mapping:
 *   "idle"    → render nothing (no operation has been attempted yet)
 *   "syncing" → spinning gold loader; tooltip "Syncing..."
 *   "synced"  → green check-cloud; auto-hides after 3 seconds (success is fleeting; we
 *               don't want a permanent green badge cluttering the header)
 *   "error"   → red error-cloud; CLICKABLE — clicking sets status back to "idle" which
 *               causes the next mutation to re-trigger schedulePush (see SyncInitializer
 *               effect 2). NOTE: this only retries the next change, not the failed push.
 *   "offline" → gray slashed-cloud; non-interactive. Reconnect handler in
 *               SyncInitializer effect 3 will flush automatically when network returns.
 *
 * Lifecycle:
 *   On mount and on every syncStatus change:
 *     - "synced" → start a 3s timer to fade the badge out (sets visible=false).
 *     - any other status → mark visible immediately so the user always sees errors etc.
 *   Cleanup clears the pending timer to avoid setting state on an unmounted component.
 *
 * Gotchas:
 *   - Returns null when storageChoice !== "cloud" OR no user, so we don't show a sync
 *     badge to local-only users (it would always be idle/meaningless).
 *   - The "synced+!visible" branch is also null — that's how the auto-hide works.
 *   - The retry handler is intentionally minimal: setting status="idle" is enough
 *     because the next save will re-engage the auto-push pipeline. We deliberately do
 *     NOT call pushToCloud directly here (would duplicate the SyncInitializer logic).
 */
import { useEffect, useState } from "react";
import { useStore } from "../../store";

export function SyncStatus() {
  const syncStatus = useStore((s) => s.syncStatus);
  const storageChoice = useStore((s) => s.storageChoice);
  const user = useStore((s) => s.user);
  const setSyncStatus = useStore((s) => s.setSyncStatus);
  // `visible` controls only the "synced" auto-hide. All other statuses are always shown
  // when applicable. Default to true so transitioning into a non-synced status from
  // an auto-hidden synced state doesn't briefly hide the new status.
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    if (syncStatus === "synced") {
      // Make sure we're visible the moment we hit synced (could've been hidden from a
      // previous sync), then schedule the fade.
      setVisible(true);
      // 3s feels long enough to register success without being noisy. Don't shorten
      // below ~2s — testers reported missing the badge entirely.
      const timer = setTimeout(() => setVisible(false), 3000);
      return () => clearTimeout(timer);
    }
    // For any non-synced status, ensure visible. No timer to clean up here.
    setVisible(true);
  }, [syncStatus]);

  // Hide entirely for non-cloud users (no relevant status to show).
  if (storageChoice !== "cloud" || !user) return null;
  // "idle" = nothing has happened yet, no badge needed.
  // "synced + !visible" = post-success fade-out completed.
  if (syncStatus === "idle" || (syncStatus === "synced" && !visible)) return null;

  // Retry only does something for "error" — for "syncing"/"offline" the click is a no-op
  // (the wrapping button uses cursor-default in those cases). Setting status to "idle"
  // causes effect 2 in SyncInitializer to re-engage on the next mutation. We don't push
  // directly here to avoid duplicating that orchestration logic.
  const handleRetry = () => {
    if (syncStatus === "error") {
      setSyncStatus("idle");
      // The next state change will trigger a push
    }
  };

  // Button (not div) so it's keyboard-focusable and gets native click semantics for the
  // error-state retry. For non-error states onClick is undefined and cursor is default.
  return (
    <button
      onClick={syncStatus === "error" ? handleRetry : undefined}
      className={`flex items-center gap-1 text-xs transition-all duration-300 ${
        syncStatus === "error" ? "cursor-pointer" : "cursor-default"
      }`}
      title={
        syncStatus === "syncing" ? "Syncing..." :
        syncStatus === "synced" ? "Synced" :
        syncStatus === "error" ? "Sync failed. Click to retry." :
        syncStatus === "offline" ? "Offline — changes will sync when you reconnect" :
        ""
      }
    >
      {syncStatus === "syncing" && (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-[var(--color-accent-gold)] animate-spin">
          <path d="M21 12a9 9 0 1 1-6.219-8.56" />
        </svg>
      )}
      {syncStatus === "synced" && (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-green-400">
          <path d="M18 10h-1.26A8 8 0 1 0 9 20h9a5 5 0 0 0 0-10z" />
          <polyline points="9 15 12 18 17 13" />
        </svg>
      )}
      {syncStatus === "error" && (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-red-400">
          <path d="M18 10h-1.26A8 8 0 1 0 9 20h9a5 5 0 0 0 0-10z" />
          <line x1="12" y1="8" x2="12" y2="12" />
          <line x1="12" y1="16" x2="12.01" y2="16" />
        </svg>
      )}
      {syncStatus === "offline" && (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-gray-500">
          <path d="M18 10h-1.26A8 8 0 1 0 9 20h9a5 5 0 0 0 0-10z" />
          <line x1="4" y1="4" x2="20" y2="20" />
        </svg>
      )}
    </button>
  );
}
