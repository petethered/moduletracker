import { Modal } from "./Modal";
import { Button } from "./Button";

/**
 * ConfirmDialog — modal wrapper for destructive / irreversible confirmations.
 *
 * Where it's used: delete pull, reset module progress, clear data — anywhere
 * the user needs a "are you sure?" gate before something destructive runs.
 *
 * Composition pattern: thin wrapper over {@link Modal} that hard-codes the
 * Cancel + Confirm two-button footer. If you need a non-destructive confirm
 * (e.g. "Save draft?"), reach for Modal directly — this primitive intentionally
 * uses the `danger` Button variant so it should not be repurposed.
 *
 * Controlled component: parent owns `isOpen` and the open/close lifecycle.
 * `onConfirm` is invoked first, then `onClose` is auto-called so callers don't
 * have to remember to dismiss the dialog themselves.
 */

/**
 * Props for {@link ConfirmDialog}.
 */
interface ConfirmDialogProps {
  /** Controlled open state. Parent must toggle to `false` to dismiss. */
  isOpen: boolean;
  /**
   * Called when the user dismisses (Cancel button, Esc key via Modal, or
   * after a successful confirm). Parent should clear its open-state here.
   */
  onClose: () => void;
  /**
   * Called when the user clicks the danger button. The dialog auto-closes
   * after this fires — do NOT call `onClose` yourself from inside `onConfirm`.
   */
  onConfirm: () => void;
  /** Heading shown in the modal title bar. Keep it short and action-oriented. */
  title: string;
  /** Body copy explaining what will happen. Plain text; no JSX. */
  message: string;
  /**
   * Override label for the danger button. Defaults to `"Confirm"`. Prefer
   * verbs that match the action (e.g. "Delete", "Reset", "Discard").
   */
  confirmLabel?: string;
}

export function ConfirmDialog({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  confirmLabel = "Confirm",
}: ConfirmDialogProps) {
  return (
    <Modal isOpen={isOpen} onClose={onClose} title={title}>
      <p className="text-gray-300 mb-6">{message}</p>
      <div className="flex justify-end gap-3">
        {/* Cancel is `secondary` so the destructive `danger` button reads as
            the heavier visual choice — but Cancel is positioned first (left)
            so the eye lands on the safe option by default. */}
        <Button variant="secondary" onClick={onClose}>
          Cancel
        </Button>
        <Button
          variant="danger"
          onClick={() => {
            // Run the side-effect first, then dismiss. This ordering means a
            // throw inside `onConfirm` will leave the dialog open so the user
            // can see any error toast the parent surfaces.
            onConfirm();
            onClose();
          }}
        >
          {confirmLabel}
        </Button>
      </div>
    </Modal>
  );
}
