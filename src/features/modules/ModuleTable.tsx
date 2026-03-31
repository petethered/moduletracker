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
  getRarityForCopies,
} from "../../config/rarityColors";
import { Modal } from "../../components/ui/Modal";
import { Button } from "../../components/ui/Button";
import type { ModuleType, ModuleRarity } from "../../types";

const COPIES_FOR_5_STAR = 18;

const TYPE_ORDER: ModuleType[] = ["cannon", "armor", "generator", "core"];
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
  const [editingModule, setEditingModule] = useState<string | null>(null);

  const pullCounts = selectModulePullCounts(pulls);

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
              <table className="w-full text-sm" style={{ tableLayout: "fixed" }}>
                <colgroup>
                  <col style={{ width: "35%" }} />
                  <col style={{ width: "12%" }} />
                  <col style={{ width: "15%" }} />
                  <col style={{ width: "20%" }} />
                  {/* Progress column hidden - kept for future use */}
                  <col style={{ width: "18%" }} />
                </colgroup>
                <thead>
                  <tr className="border-b border-[var(--color-navy-500)]">
                    <th className="px-3 py-2 text-left text-xs text-gray-400 uppercase">Module</th>
                    <th className="px-3 py-2 text-left text-xs text-gray-400 uppercase">Count</th>
                    <th className="px-3 py-2 text-left text-xs text-gray-400 uppercase">% of Epics</th>
                    <th className="px-3 py-2 text-left text-xs text-gray-400 uppercase">Last Pulled</th>
                    {/* Progress header hidden - kept for future use */}
                    <th className="px-3 py-2 text-left text-xs text-gray-400 uppercase">Rarity</th>
                  </tr>
                </thead>
                <tbody>
                  {MODULES_BY_TYPE[type].map((mod) => {
                    const count = pullCounts[mod.id] || 0;
                    const pct = selectModuleEpicPercentage(pulls, mod.id);
                    const lastPulled = selectLastPullDateForModule(pulls, mod.id);
                    const progress = moduleProgress[mod.id];
                    const rarity = progress?.currentRarity;

                    return (
                      <tr key={mod.id} className="border-b border-[var(--color-navy-600)]">
                        <td className="px-3 py-2 font-medium">{mod.name}</td>
                        <td className="px-3 py-2">{count}</td>
                        <td className="px-3 py-2">{count > 0 ? `${pct.toFixed(1)}%` : "-"}</td>
                        <td className="px-3 py-2 text-gray-400">{lastPulled || "-"}</td>
                        {/* Progress cell hidden - kept for future use
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
