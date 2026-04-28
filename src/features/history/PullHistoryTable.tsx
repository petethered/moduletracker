/**
 * PullHistoryTable.tsx — chronological list of every recorded 10x pull.
 *
 * Role:
 *   - Renders all pulls via the shared <Table> component, with per-row
 *     Edit and Delete actions.
 *   - Surfaces "pity" context inline (see column ordering notes below).
 *
 * User flow it supports:
 *   - From the History tab: scan recent pulls, edit a mistake, delete a
 *     bad entry, see at a glance which pulls were "pity epics" (the
 *     forced epic at PITY_PULL_THRESHOLD dry pulls).
 *
 * --- Column ordering decisions (intentional, do not reshuffle casually) ---
 *   1. Date           — primary sort key; what users scan for first.
 *   2. Common         — leftmost rarity column matches rarity ascending order.
 *   3. Rare           — middle rarity column.
 *   4. Epic (count)   — numeric epic count. Kept SEPARATE from "Epics
 *                       Received" so users can sort by count without
 *                       being distracted by the module-name list.
 *   5. Epics Received — the actual module names; ALSO renders the pity
 *                       hint "(pity N/10)" for non-epic pulls and the red
 *                       "PITY :(" badge for the pull that broke a streak.
 *                       This column is wide and unsorted by design.
 *   6. Banner         — banner type (standard/featured/lucky), capitalised.
 *   7. Gems           — gems spent (currently always 200, but rendered as a
 *                       column so a future variable-cost banner stays
 *                       backward-compatible).
 *   8. Actions        — Edit + Delete, ghost variant to stay quiet.
 *
 * --- Sort / filter behaviour ---
 *   - Default sort: newest first via sortPullsNewest(pulls). The Table
 *     component honours per-column `sortable` + `sortValue` to allow
 *     re-sorting. Rarity columns sort by their numeric count; the Epic
 *     column sorts by epicModules.length (NOT by names, because names
 *     concatenated would sort poorly).
 *   - "Epics Received", "Banner", "Gems", and "Actions" are intentionally
 *     not sortable — they're either descriptive (Epics Received) or
 *     low-information (Banner, Gems).
 *   - There's no user-facing filter UI here yet; if you add one, build it
 *     in History.tsx (the page wrapper) and pass filtered data in.
 *
 * --- Edit/Delete affordances ---
 *   - Edit: opens PullModal in edit mode via openEditPullModal(id).
 *     stopPropagation() on the click is precautionary in case the row
 *     itself ever becomes clickable (currently it isn't).
 *   - Delete: shows a ConfirmDialog before actually calling deletePull
 *     (this is a destructive op against persisted data; always confirm).
 *     deleteId is local state — set on click, cleared on confirm/cancel.
 *
 * Pity helpers:
 *   - selectPityPullIds returns the set of pull IDs whose epic was the
 *     "pity break" — i.e. the user went PITY_PULL_THRESHOLD pulls without
 *     an epic and the next pull guaranteed one.
 *   - selectDryStreakByPullId maps each non-epic pull to its current
 *     dry-streak counter, used to render the "(pity N/10)" hint.
 */
import { useState } from "react";
import { Table } from "../../components/ui/Table";
import type { Column } from "../../components/ui/Table";
import { Badge } from "../../components/ui/Badge";
import { Button } from "../../components/ui/Button";
import { ConfirmDialog } from "../../components/ui/ConfirmDialog";
import { useStore } from "../../store";
import { sortPullsNewest, selectPityPullIds, selectDryStreakByPullId, PITY_PULL_THRESHOLD } from "../../store/selectors";
import { MODULE_BY_ID } from "../../config/modules";
import { RARITY_COLORS } from "../../config/rarityColors";
import type { PullRecord } from "../../types";
import { formatDisplayDate } from "../../utils/formatDate";

export function PullHistoryTable() {
  const pulls = useStore((s) => s.pulls);
  const deletePull = useStore((s) => s.deletePull);
  const openEditPullModal = useStore((s) => s.openEditPullModal);
  // Two-stage delete: first click sets deleteId -> ConfirmDialog opens.
  // The dialog calls deletePull only on explicit confirm. Null = no dialog.
  const [deleteId, setDeleteId] = useState<string | null>(null);

  // All three derivations are pure selectors over `pulls` and recompute on
  // every store change. They are cheap (O(n) over pull count) so we don't
  // bother memoising at this layer.
  const sorted = sortPullsNewest(pulls);
  const pityIds = selectPityPullIds(pulls);
  const pityCounters = selectDryStreakByPullId(pulls);

  // Column definitions — order here is the rendered left-to-right order.
  // See file header for rationale on each column's position and sort settings.
  const columns: Column<PullRecord>[] = [
    {
      // Date column — primary scanning axis. sortValue uses the raw ISO
      // string because it sorts lexicographically the same as
      // chronologically (YYYY-MM-DD ordering).
      key: "date",
      header: "Date",
      render: (p) => formatDisplayDate(p.date),
      sortable: true,
      sortValue: (p) => p.date,
    },
    {
      // Common count — leftmost rarity column (matches rarity ascending).
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
      // Numeric epic count column. Deliberately separate from "Epics
      // Received" so users can sort by count without dealing with a long
      // names cell. Falls back to a muted "0" when no epics — keeps the
      // column visually quiet on common rows.
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
      // "Epics Received" — the descriptive column. Three render branches:
      //   1. Pull has epics:    list module names; if this pull was a
      //                         "pity break" (in pityIds), tag it with a
      //                         red "PITY :(" so users can spot streaks.
      //   2. Pull has no epics but is part of an in-progress dry streak:
      //                         show "(pity N/PITY_PULL_THRESHOLD)" hint.
      //   3. Otherwise:         em-dash placeholder.
      // Not sortable — concatenated names sort poorly and the column is
      // really for reading, not ranking.
      key: "epics",
      header: "Epics Received",
      render: (p) =>
        p.epicModules.length > 0 ? (
          <span className="text-[var(--color-rarity-epic)] text-xs">
            {/* MODULE_BY_ID is the canonical id->module lookup; fall back
                to the raw id if a config entry was removed (data outlives
                config edits in localStorage). */}
            {p.epicModules.map((id) => MODULE_BY_ID[id]?.name || id).join(", ")}
            {pityIds.has(p.id) && <span className="text-red-400 ml-1">PITY :(</span>}
          </span>
        ) : pityCounters.has(p.id) ? (
          <span className="text-gray-500 text-xs">
            (pity {pityCounters.get(p.id)}/{PITY_PULL_THRESHOLD})
          </span>
        ) : (
          <span className="text-gray-600 text-xs">-</span>
        ),
    },
    {
      // Banner type. Lowercase in the data model; capitalize via CSS so
      // the source of truth stays the literal string union.
      key: "banner",
      header: "Banner",
      render: (p) => (
        <span className="text-xs text-gray-400 capitalize">{p.bannerType}</span>
      ),
    },
    {
      // Gems spent. Currently always 200 (10x cost), but rendered as a
      // real column so future variable-cost banners can populate it
      // without a schema change.
      key: "gems",
      header: "Gems",
      render: (p) => p.gemsSpent.toLocaleString(),
    },
    {
      // Action column — empty header to keep visual weight low. Both
      // buttons are ghost-variant for the same reason.
      key: "actions",
      header: "",
      render: (p) => (
        <div className="flex gap-2">
          <Button
            variant="ghost"
            className="text-xs px-2 py-1"
            onClick={(e) => {
              // stopPropagation: pre-emptive guard. If row-level click
              // handlers ever land on the table, this prevents Edit from
              // both opening the modal AND triggering the row action.
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
              // Stage the delete; ConfirmDialog below handles the actual call.
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
      {/*
        Destructive-action confirm. The dialog is open whenever deleteId
        is non-null. onConfirm runs deletePull AND clears deleteId; onClose
        only clears deleteId (used for cancel + backdrop click).
      */}
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
