import { Modal } from "../../components/ui/Modal";
import { PullForm } from "./PullForm";
import { useStore } from "../../store";

export function PullModal() {
  const isOpen = useStore((s) => s.isAddPullModalOpen);
  const editingPullId = useStore((s) => s.editingPullId);
  const closePullModal = useStore((s) => s.closePullModal);
  const addPull = useStore((s) => s.addPull);
  const updatePull = useStore((s) => s.updatePull);
  const pulls = useStore((s) => s.pulls);

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
      />
    </Modal>
  );
}
