/**
 * useSavedPullToast — state for the "Pull saved" toast shown by Save & Continue.
 *
 * Lives in PullModal (via this hook) rather than PullForm or the global store:
 *   - Not PullForm: the form is inside Modal, which unmounts on close. A toast
 *     shown just before the user closes the modal must still finish its
 *     countdown, and PullModal itself stays mounted (App.tsx).
 *   - Not uiSlice: this is the only toast consumer. If a second one appears,
 *     each would portal its own Toast into the same fixed top-4 spot and they
 *     would overlap. THAT is the moment to move to one global toast host.
 *
 * KEY COUNTER (gotcha):
 *   `toastKey` comes from a monotonically increasing counter so two identical
 *   saves in a row still re-show the toast and restart its timer (see Toast's
 *   "Re-showing" note). The counter is a ref, not part of the toast state, so
 *   dismissing (state -> null) can't reset it and reuse an old key. Date.now()
 *   is not used because two fast saves can share a millisecond.
 */
import { useCallback, useRef, useState } from "react";
import type { PullRecord } from "../../types";
import { summarizeSavedPull, type SavedPullSummary } from "./savedPullSummary";

export function useSavedPullToast() {
  const [toast, setToast] = useState<{ key: number; summary: SavedPullSummary } | null>(null);
  const counterRef = useRef(0);

  const showSavedToast = useCallback((data: Omit<PullRecord, "id">) => {
    counterRef.current += 1;
    setToast({ key: counterRef.current, summary: summarizeSavedPull(data) });
  }, []);

  const dismiss = useCallback(() => setToast(null), []);

  return {
    toastKey: toast?.key ?? null,
    summary: toast?.summary ?? null,
    showSavedToast,
    dismiss,
  };
}
