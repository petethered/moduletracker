import { Modal } from "../../components/ui/Modal";
import { PullForm } from "./PullForm";
import { useStore } from "../../store";
import { useRenderLog } from "../../utils/renderLog";

export function PullModal() {
  const isOpen = useStore((s) => s.isAddPullModalOpen);
  const editingPullId = useStore((s) => s.editingPullId);
  const closePullModal = useStore((s) => s.closePullModal);
  const addPull = useStore((s) => s.addPull);
  const updatePull = useStore((s) => s.updatePull);
  const deletePull = useStore((s) => s.deletePull);
  const pulls = useStore((s) => s.pulls);
  useRenderLog("PullModal", { isOpen, editingPullId });

  const editingPull = editingPullId
    ? pulls.find((p) => p.id === editingPullId)
    : undefined;

  const title = editingPull ? "Edit Pull" : "Add 10x Pull";

  return (
    <Modal isOpen={isOpen} onClose={closePullModal} title={title}>
      <PullForm
        key={editingPullId || "new"}
        initialData={editingPull}
        onSubmit={(data) => {
          if (editingPull) {
            updatePull(editingPull.id, data);
          } else {
            addPull(data);
          }
          closePullModal();
        }}
        onCancel={closePullModal}
        onDelete={editingPull ? () => { deletePull(editingPull.id); closePullModal(); } : undefined}
      />
    </Modal>
  );
}
