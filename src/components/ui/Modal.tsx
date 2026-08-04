import { useEffect, useId, useRef } from "react";
import { createPortal } from "react-dom";
import { useRenderLog } from "../../utils/renderLog";

/**
 * Modal — the canonical overlay primitive. Renders into a portal mounted on
 * `document.body` and traps the visual layer with a dimmed backdrop.
 *
 * Where it's used: add-pull form, settings sheet, confirmation dialogs (via
 * {@link ConfirmDialog}), import/export flows. Anywhere a transient sheet of
 * content needs to float above the main UI.
 *
 * Composition pattern:
 *   - Renders nothing when `isOpen` is `false` (early return). Mount/unmount
 *     is fine here because there's no entrance animation that needs persistent
 *     DOM — the `animate-fade-in` / `animate-slide-up` CSS animations replay
 *     on every open.
 *   - Uses `createPortal` so z-index, transforms, and `overflow:hidden` on
 *     ancestor cards never clip the modal.
 *
 * --- Accessibility contract (implemented here, do not re-solve per caller) ---
 *   - `role="dialog"` + `aria-modal="true"` so assistive tech announces the
 *     overlay and treats the background as inert.
 *   - `aria-labelledby` points at the visible <h2> title. This is why `title`
 *     is a required prop and why the id is generated with `useId` (multiple
 *     modals can be mounted simultaneously; a hardcoded id would collide).
 *   - Esc closes (keydown listener attached only while open).
 *   - FOCUS TRAP: Tab / Shift+Tab cycle within the dialog. Without this a
 *     keyboard user tabs straight out of the modal into the page behind it and
 *     has no way to know they've left.
 *   - FOCUS RESTORE: on close, focus returns to whatever element opened the
 *     modal. Without this, focus resets to <body> and keyboard users lose
 *     their place entirely.
 *   - INITIAL FOCUS: the first focusable element inside the dialog, falling
 *     back to the dialog container itself (which carries tabIndex={-1} so it
 *     is programmatically focusable but not in the tab order).
 *   - SCROLL LOCK: `document.body` scrolling is frozen while open so the page
 *     behind doesn't scroll under the overlay.
 *
 * Controlled component: parent owns `isOpen` and `onClose`.
 */

/**
 * Selector for elements that can receive keyboard focus.
 *
 * `:not([disabled])` matters because a disabled Save button is a very common
 * state in this app (PullForm gates Save on validation) and including it would
 * put a dead stop in the tab cycle.
 *
 * `[tabindex]:not([tabindex="-1"])` picks up custom widgets that opt in, while
 * excluding the dialog container's own tabIndex={-1}.
 */
const FOCUSABLE_SELECTOR = [
  "a[href]",
  "button:not([disabled])",
  "input:not([disabled])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  '[tabindex]:not([tabindex="-1"])',
].join(",");

/**
 * Props for {@link Modal}.
 */
interface ModalProps {
  /** Controlled open state. When `false`, the modal renders nothing. */
  isOpen: boolean;
  /**
   * Called when the user requests dismissal — Esc key or close button.
   * Backdrop click deliberately does NOT call this; see the backdrop comment
   * in the render body for why.
   */
  onClose: () => void;
  /** Heading shown in the gold title bar. Required for orientation/a11y. */
  title: string;
  /** Modal body content — caller controls layout and footer buttons. */
  children: React.ReactNode;
}

export function Modal({ isOpen, onClose, title, children }: ModalProps) {
  // Dev-only render tracer; no-op in production builds.
  useRenderLog("Modal", { isOpen, title });

  // The dialog panel. Used as the focus-trap boundary and the initial-focus
  // fallback target.
  const panelRef = useRef<HTMLDivElement>(null);

  // The element that had focus immediately before the modal opened, so we can
  // hand focus back on close. Captured in a ref rather than state because
  // changing it must never trigger a re-render.
  const previouslyFocusedRef = useRef<HTMLElement | null>(null);

  // Unique id linking the <h2> to aria-labelledby. `useId` is stable across
  // renders and unique per component instance.
  const titleId = useId();

  // ---------------------------------------------------------------------
  // Keyboard handling: Esc to close, Tab/Shift+Tab confined to the dialog.
  // ---------------------------------------------------------------------
  // Both live in ONE listener because they share the same lifecycle and the
  // same `isOpen` guard. Attached to `document` (not the panel) so Esc works
  // even if focus somehow escaped the dialog.
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
        return;
      }

      if (e.key !== "Tab") return;

      const panel = panelRef.current;
      if (!panel) return;

      // Re-query on every Tab rather than caching: modal contents are highly
      // dynamic here (PullForm adds/removes epic rows, buttons enable and
      // disable as validation changes), so a cached list goes stale instantly.
      const focusable = Array.from(
        panel.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)
        // offsetParent is null for display:none elements. This filters out
        // controls inside collapsed sections (e.g. a closed SearchSelect
        // dropdown) which would otherwise be invisible tab stops.
      ).filter((el) => el.offsetParent !== null || el === document.activeElement);

      // Nothing focusable (a purely informational modal): keep focus pinned to
      // the panel rather than letting Tab escape to the page behind.
      if (focusable.length === 0) {
        e.preventDefault();
        panel.focus();
        return;
      }

      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      const active = document.activeElement as HTMLElement | null;

      if (e.shiftKey) {
        // Wrap backwards off the first element. Also catches the case where
        // focus is on the panel container itself.
        if (active === first || !panel.contains(active)) {
          e.preventDefault();
          last.focus();
        }
      } else if (active === last || !panel.contains(active)) {
        // Wrap forwards off the last element.
        e.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  // ---------------------------------------------------------------------
  // Focus capture / restore + body scroll lock.
  // ---------------------------------------------------------------------
  // Deliberately a SEPARATE effect from the keyboard one: this must run
  // exactly once per open/close transition, whereas the keyboard effect
  // re-subscribes whenever `onClose` identity changes. Merging them would
  // steal focus again on every parent re-render that produced a new callback.
  useEffect(() => {
    if (!isOpen) return;

    previouslyFocusedRef.current = document.activeElement as HTMLElement | null;

    const panel = panelRef.current;
    if (panel) {
      const firstFocusable =
        panel.querySelector<HTMLElement>(FOCUSABLE_SELECTOR);
      // Prefer the first real control; fall back to the panel so the dialog is
      // still announced and Tab still starts from inside the trap.
      (firstFocusable ?? panel).focus();
    }

    // Freeze background scrolling. Saving and restoring the previous value
    // rather than hardcoding "" matters when modals stack (ConfirmDialog can
    // open over SettingsPanel): the inner one must not unlock the page when it
    // closes while the outer one is still open.
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = previousOverflow;
      // Guard with isConnected: if the trigger was itself unmounted while the
      // modal was open, focusing it throws away focus silently.
      const previous = previouslyFocusedRef.current;
      if (previous && previous.isConnected) {
        previous.focus();
      }
    };
  }, [isOpen]);

  if (!isOpen) return null;

  return createPortal(
    // Backdrop: full-viewport dim. Deliberately NOT clickable-to-close, because
    // the add-pull form carries heavy in-progress state (banner, counts, a list
    // of selected epic modules) that we don't want to lose to an accidental
    // misclick. Esc and the close button are the two dismissal paths, and both
    // are discoverable. Revisit only if UX changes.
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 animate-fade-in">
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        // tabIndex={-1} makes the panel programmatically focusable (for the
        // initial-focus fallback) without inserting it into the tab order.
        tabIndex={-1}
        // `max-h-[90vh]` + `overflow-y-auto` so tall modal contents (e.g. the
        // module-rarity grid) scroll inside the dialog rather than blowing out
        // the viewport.
        className="bg-[var(--color-navy-700)] rounded-2xl border border-[var(--color-navy-500)]/50 w-full max-w-lg max-h-[90vh] overflow-y-auto animate-slide-up focus:outline-none"
        style={{
          // Outer drop-shadow + inner highlight line gives the panel a subtle
          // bevelled feel without a separate border element.
          boxShadow:
            "0 0 40px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.04)",
        }}
      >
        <div className="flex items-center justify-between p-5 border-b border-[var(--color-navy-500)]/30">
          <h2
            id={titleId}
            className="text-base font-semibold text-[var(--color-accent-gold)]"
            style={{ fontFamily: "var(--font-display)", letterSpacing: "0.04em" }}
          >
            {title}
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-200 text-lg leading-none transition-colors w-8 h-8 flex items-center justify-center rounded-lg hover:bg-[var(--color-navy-600)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-accent-gold)]"
            aria-label="Close"
          >
            {/* `&times;` (×) chosen over a Lucide icon to keep this primitive
                dependency-free. */}
            &times;
          </button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>,
    document.body,
  );
}
