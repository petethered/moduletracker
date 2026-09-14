/**
 * PullModal.tsx — modal host for adding/editing a 10x pull record.
 *
 * Role:
 *   - Bridges Zustand UI state (isAddPullModalOpen, editingPullId) to the
 *     dumb-ish PullForm component, and routes its onSubmit to either
 *     addPull (new) or updatePull (edit), and its onSaveAndContinue (add
 *     mode only) to addPull + the saved-pull toast.
 *   - Lazy-loaded from App.tsx so the form code (with all module options)
 *     does not ship in the initial bundle.
 *
 * User flows it supports:
 *   1. "+ Add 10x Pull" header button -> openAddPullModal() -> this modal
 *      opens with a blank PullForm.
 *   2. Edit pencil on a row in PullHistoryTable -> openEditPullModal(id) ->
 *      this modal opens pre-filled with that pull's data.
 *   3. "Save & Continue" (add mode only) -> addPull, modal STAYS open, the
 *      form resets itself in place, and a Toast confirms what was saved so
 *      the user can log a backlog of pulls without reopening the modal.
 *      Toast state comes from useSavedPullToast (called here, not in
 *      PullForm) so a toast shown just before the user closes the modal still
 *      finishes its countdown. See that hook for why.
 *
 * Validation contract (delegated):
 *   - All form-level validation lives in PullForm + validation.ts. This
 *     wrapper trusts that PullForm only fires onSubmit / onSaveAndContinue
 *     when the data is valid (10-drop invariant, all epics selected, etc.).
 *
 * Gotchas / invariants:
 *   - The `key={editingPullId || "new"}` prop on PullForm is LOAD-BEARING.
 *     React will reuse the same PullForm instance across open/close cycles
 *     unless the key changes. Without this, switching from "edit pull A" to
 *     "edit pull B" (or "edit -> add new") would keep stale useState values
 *     for date/banner/counts/epics. Do not remove it.
 *     Save & Continue deliberately does NOT bump this key: PullForm resets
 *     itself in place to keep keyboard focus on the button. Don't "simplify"
 *     that reset into a key change (see PullForm's Save & Continue notes).
 *   - editingPull is recomputed from `pulls` every render rather than
 *     stored — this is intentional so deletes/updates from elsewhere stay
 *     in sync if the modal happens to be open.
 *   - onDelete is only wired in edit mode; the add-mode form must not show
 *     a Delete button (PullForm renders it conditionally on this prop).
 */
import { Modal } from "../../components/ui/Modal";
import { Toast } from "../../components/ui/Toast";
import { PullForm } from "./PullForm";
import { useSavedPullToast } from "./useSavedPullToast";
import { useStore } from "../../store";
import { useRenderLog } from "../../utils/renderLog";

export function PullModal() {
  // Pull individual selectors (one per slice of state) so this component
  // re-renders only when something it actually uses changes.
  const isOpen = useStore((s) => s.isAddPullModalOpen);
  const editingPullId = useStore((s) => s.editingPullId);
  const closePullModal = useStore((s) => s.closePullModal);
  const addPull = useStore((s) => s.addPull);
  const updatePull = useStore((s) => s.updatePull);
  const deletePull = useStore((s) => s.deletePull);
  const pulls = useStore((s) => s.pulls);
  useRenderLog("PullModal", { isOpen, editingPullId });

  const { toastKey, summary, showSavedToast, dismiss } = useSavedPullToast();

  // Resolve the editing target lazily from the live pulls array. If the user
  // deletes the pull from elsewhere while the modal is open, this becomes
  // undefined and we fall back to "Add 10x Pull" mode — safer than caching.
  const editingPull = editingPullId
    ? pulls.find((p) => p.id === editingPullId)
    : undefined;

  const title = editingPull ? "Edit Pull" : "Add 10x Pull";

  return (
    <>
      <Modal isOpen={isOpen} onClose={closePullModal} title={title}>
        <PullForm
          // Force a fresh PullForm instance when switching between add/edit or
          // between two different edit targets — see top-of-file gotcha note.
          key={editingPullId || "new"}
          initialData={editingPull}
          onSubmit={(data) => {
            // PullForm has already validated the payload (both save paths
            // share its `canSave` guard).
            if (editingPull) {
              updatePull(editingPull.id, data);
            } else {
              addPull(data);
            }
            closePullModal();
          }}
          // Add mode only. In edit mode "continue" has no meaning, and PullForm
          // hides the button when this prop is undefined.
          onSaveAndContinue={
            editingPull
              ? undefined
              : (data) => {
                  addPull(data);
                  showSavedToast(data);
                }
          }
          onCancel={closePullModal}
          // Delete affordance only exists in edit mode. Closing the modal after
          // delete avoids a flash of "Add 10x Pull" once editingPull becomes
          // undefined.
          onDelete={editingPull ? () => { deletePull(editingPull.id); closePullModal(); } : undefined}
        />
      </Modal>
      {/* Sibling of Modal, not a child: Toast portals to <body> itself. It stays
          mounted even while the modal is closed so a pending toast can finish. */}
      <Toast toastKey={toastKey} title="Pull saved" onDismiss={dismiss}>
        {summary && (
          <>
            {/* Epic line in epic purple: it's the line the user cares about. */}
            <p className="text-[var(--color-rarity-epic)]">{summary.epics}</p>
            <p>{summary.counts}</p>
            <p className="text-gray-400">{summary.context}</p>
          </>
        )}
      </Toast>
    </>
  );
}
