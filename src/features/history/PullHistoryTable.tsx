import { useState } from "react";
import { Table, Column } from "../../components/ui/Table";
import { Badge } from "../../components/ui/Badge";
import { Button } from "../../components/ui/Button";
import { ConfirmDialog } from "../../components/ui/ConfirmDialog";
import { useStore } from "../../store";
import { MODULE_BY_ID } from "../../config/modules";
import { RARITY_COLORS } from "../../config/rarityColors";
import type { PullRecord } from "../../types";

export function PullHistoryTable() {
  const pulls = useStore((s) => s.pulls);
  const deletePull = useStore((s) => s.deletePull);
  const openEditPullModal = useStore((s) => s.openEditPullModal);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const sorted = [...pulls].sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
  );

  const columns: Column<PullRecord>[] = [
    {
      key: "date",
      header: "Date",
      render: (p) => p.date,
      sortable: true,
      sortValue: (p) => p.date,
    },
    {
      key: "common",
      header: "Common",
      render: (p) => <Badge color={RARITY_COLORS.common}>{p.commonCount}</Badge>,
      sortable: true,
      sortValue: (p) => p.commonCount,
    },
    {
      key: "rare",
      header: "Rare",
      render: (p) => <Badge color={RARITY_COLORS.rare}>{p.rareCount}</Badge>,
      sortable: true,
      sortValue: (p) => p.rareCount,
    },
    {
      key: "epic",
      header: "Epic",
      render: (p) =>
        p.epicModules.length > 0 ? (
          <Badge color={RARITY_COLORS.epic}>{p.epicModules.length}</Badge>
        ) : (
          <span className="text-gray-600">0</span>
        ),
      sortable: true,
      sortValue: (p) => p.epicModules.length,
    },
    {
      key: "epics",
      header: "Epics Received",
      render: (p) => (
        <span className="text-[var(--color-rarity-epic)] text-xs">
          {p.epicModules.map((id) => MODULE_BY_ID[id]?.name || id).join(", ") || "-"}
        </span>
      ),
    },
    {
      key: "banner",
      header: "Banner",
      render: (p) => (
        <span className="text-xs text-gray-400 capitalize">{p.bannerType}</span>
      ),
    },
    {
      key: "gems",
      header: "Gems",
      render: (p) => p.gemsSpent.toLocaleString(),
    },
    {
      key: "actions",
      header: "",
      render: (p) => (
        <div className="flex gap-2">
          <Button
            variant="ghost"
            className="text-xs px-2 py-1"
            onClick={(e) => {
              e.stopPropagation();
              openEditPullModal(p.id);
            }}
            data-testid="edit-pull"
          >
            Edit
          </Button>
          <Button
            variant="ghost"
            className="text-xs px-2 py-1 text-red-400"
            onClick={(e) => {
              e.stopPropagation();
              setDeleteId(p.id);
            }}
            data-testid="delete-pull"
          >
            Delete
          </Button>
        </div>
      ),
    },
  ];

  return (
    <>
      <Table
        columns={columns}
        data={sorted}
        keyExtractor={(p) => p.id}
        emptyMessage="No pulls recorded yet."
      />
      <ConfirmDialog
        isOpen={deleteId !== null}
        onClose={() => setDeleteId(null)}
        onConfirm={() => {
          if (deleteId) deletePull(deleteId);
          setDeleteId(null);
        }}
        title="Delete Pull"
        message="Are you sure you want to delete this pull record? This cannot be undone."
        confirmLabel="Delete"
      />
    </>
  );
}
