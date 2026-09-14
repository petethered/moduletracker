import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";

/**
 * Toast — transient, non-blocking confirmation that auto-dismisses.
 *
 * Where it's used: PullModal's "Save & Continue" (confirms what was just saved
 * while the modal stays open for the next entry). Built as a shared primitive
 * so the next "it worked" message reuses it instead of inventing another.
 *
 * ONE CONSUMER TODAY: each caller mounts its own Toast at the same fixed
 * top-4 position. A second simultaneous consumer would overlap the first; at
 * that point replace per-caller instances with a single global host (e.g. a
 * uiSlice queue rendered once in App.tsx).
 *
 * Composition pattern:
 *   - Controlled: the parent owns `toastKey` (null = nothing showing) and
 *     clears it in `onDismiss`.
 *   - Portalled to document.body at z-[60], one above Modal's z-50. It CANNOT
 *     render inside Modal: the panel animates with a transform, and a transform
 *     makes `position: fixed` children position against the panel instead of
 *     the viewport (and the panel's overflow-y-auto would clip it).
 *
 * --- Re-showing and the timer (gotcha) ---
 *   `toastKey` must change on EVERY show, even when the text is identical
 *   (two identical 7/3 pulls in a row). The key restarts the auto-dismiss
 *   timer and replays the entrance animation, so the user gets visible proof
 *   that the second save also happened. PullModal uses an incrementing counter.
 *
 * --- Non-interactive by design ---
 *   `pointer-events-none` and no close button. It floats over the modal's title
 *   bar (and its × button), so it must never swallow a click. It also sits
 *   outside Modal's focus trap, so a close button there couldn't be reached by
 *   keyboard anyway. It removes itself after `durationMs`.
 *
 * --- Accessibility ---
 *   The role="status" (aria-live="polite") wrapper is ALWAYS mounted, and only
 *   its contents change. Screen readers reliably announce changes to a live
 *   region that already exists, but often skip one that is inserted already
 *   filled. Caveat: some screen readers treat content outside an aria-modal
 *   dialog as inert, so this announcement is best-effort while a modal is open.
 *   The on-screen form reset is the main signal.
 *
 * Reduced motion: the entrance uses `animate-fade-in`, which the global
 * prefers-reduced-motion rule in index.css already neutralises.
 */

interface ToastProps {
  /** Identity of the toast being shown; null renders nothing. Change it per show. */
  toastKey: string | number | null;
  /** Short heading line, e.g. "Pull saved". */
  title: string;
  /** Detail lines under the title. */
  children?: React.ReactNode;
  /** Called when the auto-dismiss timer fires. Parent should clear `toastKey`. */
  onDismiss: () => void;
  /** How long the toast stays visible. Long enough to read three short lines. */
  durationMs?: number;
}

export function Toast({ toastKey, title, children, onDismiss, durationMs = 4000 }: ToastProps) {
  // Keep the latest onDismiss in a ref so the timer effect depends only on
  // toastKey. Parents usually pass an inline arrow that changes identity every
  // render, and using it as a dependency would restart the countdown each time.
  const onDismissRef = useRef(onDismiss);
  useEffect(() => {
    onDismissRef.current = onDismiss;
  });

  useEffect(() => {
    if (toastKey === null) return;
    const timer = window.setTimeout(() => onDismissRef.current(), durationMs);
    return () => window.clearTimeout(timer);
  }, [toastKey, durationMs]);

  return createPortal(
    <div
      role="status"
      aria-live="polite"
      className="fixed top-4 inset-x-4 z-[60] flex justify-center pointer-events-none"
    >
      {toastKey !== null && (
        <div
          // key replays animate-fade-in on every show; see "Re-showing" above.
          key={toastKey}
          data-testid="toast"
          className="w-full max-w-sm rounded-xl border border-[var(--color-accent-gold)]/40 bg-[var(--color-navy-700)] px-4 py-3 text-sm animate-fade-in"
          style={{ boxShadow: "0 0 24px rgba(0,0,0,0.5)" }}
        >
          <p className="font-semibold text-[var(--color-accent-gold)]">{title}</p>
          {children && <div className="mt-1 space-y-0.5 text-gray-300">{children}</div>}
        </div>
      )}
    </div>,
    document.body,
  );
}
