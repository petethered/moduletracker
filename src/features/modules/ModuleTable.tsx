/**
 * ModuleTable.tsx — per-module progress grid grouped by module type.
 *
 * Role:
 *   - For each module type (cannon / armor / generator / core), renders a
 *     section heading and a table of every module of that type.
 *   - Per row: name, total pull count, share of total epics, last-pulled
 *     date, and a click-to-edit "current rarity" cell that the user
 *     manually advances as they fuse copies in-game.
 *
 * User flow it supports:
 *   - User opens the Modules tab to answer "which modules am I close to
 *     levelling up?" and "what rarity is this module at right now?".
 *   - Tapping a Rarity cell opens a modal of rarity buttons; tapping one
 *     persists the new rarity into moduleProgress (localStorage-backed).
 *
 * --- Column ordering decisions (intentional) ---
 *   1. Module       — name. 35% width, the widest; this is what users scan.
 *   2. Count        — total copies pulled. 12%, narrow numeric.
 *   3. % of Epics   — share of all epic drops that landed on this module.
 *                     15%; helps surface "lucky" or "cursed" modules.
 *   4. Last Pulled  — friendly date. 20%; useful for dry-streak intuition.
 *  (Hidden) Progress— a graphical progress bar toward 5-star (18 copies).
 *                     Currently commented out but the colgroup col and
 *                     header slot are LEFT IN PLACE so re-enabling it is
 *                     a one-block uncomment, not a re-layout. Do NOT
 *                     delete the placeholder col/header — it preserves
 *                     the planned restoration.
 *   5. Rarity       — manually-asserted current rarity tier. 18%;
 *                     rightmost because it's the only editable cell and
 *                     thumbs land there naturally on mobile.
 *
 * --- Sort / filter behaviour ---
 *   - No sorting controls. Within each type section, modules render in
 *     the order MODULES_BY_TYPE[type] returns them, which is the order
 *     declared in src/config/modules.ts. If you want to expose sorting,
 *     either swap to the shared <Table> component or add per-section
 *     sort state — but think hard before doing that, because the
 *     config-declared order is a deliberate canonical listing.
 *   - No filter UI. The four type sections double as a permanent filter
 *     by type, which has been sufficient so far.
 *
 * --- Edit affordance: rarity cell ---
 *   - The entire <td> is clickable (cursor-pointer, onClick). Hit target
 *     is a full cell, not a button, because the cell-as-target reads
 *     better in a dense table.
 *   - Click sets editingModule to the module's id, opening the rarity
 *     picker Modal. Selecting a rarity calls updateModuleRarity and
 *     closes; "Clear Rarity" resets to "epic" (the implicit baseline —
 *     every module starts as epic when first pulled).
 *   - data-testid="rarity-${id}" on the cell and rarity-option-${rarity}
 *     on each option button is what Playwright drives.
 */
import { useState } from "react";
import { useStore } from "../../store";
import {
  selectModulePullCounts,
  selectModuleEpicPercentage,
  selectLastPullDateForModule,
} from "../../store/selectors";
import { MODULES_BY_TYPE, MODULE_BY_ID } from "../../config/modules";
import {
  MODULE_RARITY_ORDER,
  getModuleRarityColor,
} from "../../config/rarityColors";
import { Modal } from "../../components/ui/Modal";
import { Button } from "../../components/ui/Button";
import type { ModuleType } from "../../types";
import { formatDisplayDate } from "../../utils/formatDate";

// Section render order — Cannon -> Armor -> Generator -> Core mirrors the
// in-game ordering and the player's mental model (offense before defense
// before utility before ultimate). Reorder only if the game does.
const TYPE_ORDER: ModuleType[] = ["cannon", "armor", "generator", "core"];

// Display labels with parenthetical role, since not every player remembers
// that "Generator" = utility. Keep concise — these are section headings.
const TYPE_LABELS: Record<ModuleType, string> = {
  cannon: "Cannon (Attack)",
  armor: "Armor (Defense)",
  generator: "Generator (Utility)",
  core: "Core (Ultimate)",
};

export function ModuleTable() {
  const pulls = useStore((s) => s.pulls);
  const moduleProgress = useStore((s) => s.moduleProgress);
  const updateModuleRarity = useStore((s) => s.updateModuleRarity);
  // editingModule holds the moduleId whose rarity picker is currently open
  // (or null when the modal is closed). Local state because no other view
  // needs to know which rarity picker is open.
  const [editingModule, setEditingModule] = useState<string | null>(null);

  // Pull counts are derived per render — selectModulePullCounts walks
  // every pull and tallies epicModules ids into a {[moduleId]: count}
  // dict. O(n) where n = total pulls; cheap enough not to memoise here.
  const pullCounts = selectModulePullCounts(pulls);

  // Resolve picker context lazily: the canonical module definition (for
  // the modal title) and the user's current rarity (for highlighting the
  // selected button + showing the "Clear Rarity" affordance).
  const editingModuleDef = editingModule ? MODULE_BY_ID[editingModule] : null;
  const editingRarity = editingModule ? moduleProgress[editingModule]?.currentRarity : undefined;

  return (
    <>
      <div className="space-y-6">
        {TYPE_ORDER.map((type) => (
          <div key={type}>
            <h3 className="text-sm font-medium text-[var(--color-accent-gold)] uppercase tracking-wider mb-2">
              {TYPE_LABELS[type]}
            </h3>
            <div className="overflow-x-auto">
              {/*
                tableLayout: "fixed" + explicit colgroup widths = stable
                column widths regardless of content length. Without this,
                long module names would push the Rarity column around
                section-to-section.
              */}
              <table className="w-full text-sm" style={{ tableLayout: "fixed" }}>
                <colgroup>
                  <col style={{ width: "35%" }} /> {/* Module name */}
                  <col style={{ width: "12%" }} /> {/* Count */}
                  <col style={{ width: "15%" }} /> {/* % of Epics */}
                  <col style={{ width: "20%" }} /> {/* Last Pulled */}
                  {/* Progress column hidden - kept for future use.
                      Do NOT remove this <col>: keeping it preserves the
                      planned column slot so the eventual restoration is
                      a one-block edit, not a re-layout. */}
                  <col style={{ width: "18%" }} /> {/* Rarity */}
                </colgroup>
                <thead>
                  <tr className="border-b border-[var(--color-navy-500)]">
                    <th className="px-3 py-2 text-left text-xs text-gray-400 uppercase">Module</th>
                    <th className="px-3 py-2 text-left text-xs text-gray-400 uppercase">Count</th>
                    <th className="px-3 py-2 text-left text-xs text-gray-400 uppercase">% of Epics</th>
                    <th className="px-3 py-2 text-left text-xs text-gray-400 uppercase">Last Pulled</th>
                    {/* Progress header hidden - kept for future use (see colgroup note). */}
                    <th className="px-3 py-2 text-left text-xs text-gray-400 uppercase">Rarity</th>
                  </tr>
                </thead>
                <tbody>
                  {/*
                    Render in MODULES_BY_TYPE order — that's the canonical
                    listing from src/config/modules.ts. No per-row sorting
                    by design (see file header).
                  */}
                  {MODULES_BY_TYPE[type].map((mod) => {
                    const count = pullCounts[mod.id] || 0;
                    // pct is "% of all epic drops that landed on this module".
                    // Selector handles divide-by-zero internally, but we
                    // still gate display on count > 0 below to avoid
                    // showing "0.0%" for never-pulled modules (clutter).
                    const pct = selectModuleEpicPercentage(pulls, mod.id);
                    const lastPulled = selectLastPullDateForModule(pulls, mod.id);
                    const progress = moduleProgress[mod.id];
                    const rarity = progress?.currentRarity;

                    return (
                      <tr key={mod.id} className="border-b border-[var(--color-navy-600)]">
                        <td className="px-3 py-2 font-medium">{mod.name}</td>
                        <td className="px-3 py-2">{count}</td>
                        {/* "-" instead of "0.0%" when never pulled — keeps the column visually quiet. */}
                        <td className="px-3 py-2">{count > 0 ? `${pct.toFixed(1)}%` : "-"}</td>
                        <td className="px-3 py-2 text-gray-400">{lastPulled ? formatDisplayDate(lastPulled) : "-"}</td>
                        {/* Progress cell hidden - kept for future use.
                            Reactivation plan: uncomment this block, also
                            uncomment the matching <col> + <th> above, and
                            re-import COPIES_FOR_5_STAR / getRarityForCopies.
                            The bar visualises copies-toward-5-star (18 max).
                        <td className="px-3 py-2">
                          {count > 0 ? (() => {
                            const achievable = getRarityForCopies(count);
                            const color = achievable ? getModuleRarityColor(achievable) : "var(--color-rarity-epic)";
                            return (
                              <div>
                                <div className="flex items-center gap-1.5">
                                  <div className="flex-1 bg-[var(--color-navy-800)] rounded-full h-2 overflow-hidden">
                                    <div
                                      className="h-full rounded-full"
                                      style={{
                                        width: `${Math.min((count / COPIES_FOR_5_STAR) * 100, 100)}%`,
                                        backgroundColor: color,
                                      }}
                                    />
                                  </div>
                                  <span className="text-xs text-gray-400 w-10 text-right">{count}/18</span>
                                </div>
                                <span className="text-xs mt-0.5 block" style={{ color }}>
                                  {achievable}
                                </span>
                              </div>
                            );
                          })() : (
                            <span className="text-gray-600">-</span>
                          )}
                        </td>
                        */}
                        {/*
                          Rarity cell — the only editable cell in the
                          table. Whole-cell click target (not a button)
                          for a bigger thumb-friendly hit area on mobile.
                          When unset, shows a muted "Click to set" prompt;
                          when set, shows the rarity name in its rarity
                          colour (getModuleRarityColor mirrors the in-game
                          tier colours).
                        */}
                        <td
                          className="px-3 py-2 cursor-pointer"
                          data-testid={`rarity-${mod.id}`}
                          onClick={() => setEditingModule(mod.id)}
                        >
                          {rarity ? (
                            <span className="text-xs font-medium" style={{ color: getModuleRarityColor(rarity) }}>
                              {rarity}
                            </span>
                          ) : (
                            <span className="text-xs text-gray-600">Click to set</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        ))}
      </div>

      {/*
        Rarity picker modal. 2-column grid of rarity buttons in
        MODULE_RARITY_ORDER (epic -> legendary -> mythic -> ancestral).
        Each button is coloured by its rarity. The currently-selected
        rarity gets a gold border + lifted background. Selecting one
        immediately persists via updateModuleRarity and closes the modal.
      */}
      <Modal
        isOpen={editingModule !== null}
        onClose={() => setEditingModule(null)}
        title={editingModuleDef ? `Set Rarity — ${editingModuleDef.name}` : "Set Rarity"}
      >
        <div className="grid grid-cols-2 gap-2">
          {MODULE_RARITY_ORDER.map((r) => (
            <button
              key={r}
              data-testid={`rarity-option-${r}`}
              onClick={() => {
                if (editingModule) {
                  updateModuleRarity(editingModule, r);
                }
                setEditingModule(null);
              }}
              className={`px-4 py-3 rounded-lg text-sm font-medium border transition-all text-left ${
                editingRarity === r
                  ? "border-[var(--color-accent-gold)] bg-[var(--color-navy-600)]"
                  : "border-[var(--color-navy-500)] bg-[var(--color-navy-800)] hover:bg-[var(--color-navy-600)]"
              }`}
              style={{ color: getModuleRarityColor(r) }}
            >
              {r}
            </button>
          ))}
        </div>
        {/*
          "Clear Rarity" only renders when a rarity is currently set —
          otherwise there's nothing to clear. WHY clear-to-"epic":
          every module starts at epic by definition (epic is the implicit
          baseline drop rarity). There's no concept of "no rarity at all"
          in the data model, so clearing means resetting to the floor.
        */}
        {editingRarity && (
          <div className="mt-4">
            <Button
              variant="ghost"
              className="w-full text-gray-500"
              onClick={() => {
                if (editingModule) {
                  updateModuleRarity(editingModule, "epic");
                }
                setEditingModule(null);
              }}
            >
              Clear Rarity
            </Button>
          </div>
        )}
      </Modal>
    </>
  );
}
