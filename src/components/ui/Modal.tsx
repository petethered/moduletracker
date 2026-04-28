import { useEffect } from "react";
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
 * Accessibility:
 *   - Esc closes the modal (keydown listener attached only while open).
 *   - The close button has `aria-label="Close"`.
 *   - NOTE: this primitive does NOT trap focus or set `aria-modal` / `role`.
 *     If you add a focus trap, do it here — see Radix or @react-aria/dialog
 *     for prior art.
 *
 * Controlled component: parent owns `isOpen` and `onClose`.
 */

/**
 * Props for {@link Modal}.
 */
interface ModalProps {
  /** Controlled open state. When `false`, the modal renders nothing. */
  isOpen: boolean;
  /**
   * Called when the user requests dismissal — Esc key, close button, or
   * (currently NOT) backdrop click. If you add backdrop-click-to-close, wire
   * it through this same callback.
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

  // Esc-to-close. Only attached while open so we don't leak listeners or fire
  // on closed modals when there are several mounted at once. Re-attaches if
  // `onClose` identity changes (parents should memoize if that matters).
  useEffect(() => {
    if (!isOpen) return;
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handleEsc);
    return () => document.removeEventListener("keydown", handleEsc);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return createPortal(
    // Backdrop: full-viewport dim. Currently NOT clickable-to-close —
    // intentional, because the add-pull form has heavy in-progress state we
    // don't want to lose to an accidental misclick. Revisit if UX changes.
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 animate-fade-in">
      <div
        // `max-h-[90vh]` + `overflow-y-auto` so tall modal contents (e.g. the
        // module-rarity grid) scroll inside the dialog rather than blowing out
        // the viewport.
        className="bg-[var(--color-navy-700)] rounded-2xl border border-[var(--color-navy-500)]/50 w-full max-w-lg max-h-[90vh] overflow-y-auto animate-slide-up"
        style={{
          // Outer drop-shadow + inner highlight line gives the panel a subtle
          // bevelled feel without a separate border element.
          boxShadow:
            "0 0 40px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.04)",
        }}
      >
        <div className="flex items-center justify-between p-5 border-b border-[var(--color-navy-500)]/30">
          <h2
            className="text-base font-semibold text-[var(--color-accent-gold)]"
            style={{ fontFamily: "var(--font-display)", letterSpacing: "0.04em" }}
          >
            {title}
          </h2>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-200 text-lg leading-none transition-colors w-8 h-8 flex items-center justify-center rounded-lg hover:bg-[var(--color-navy-600)]"
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
