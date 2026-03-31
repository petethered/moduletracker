import { useState } from "react";
import { useStore } from "../../store";
import {
  selectModulePullCounts,
  selectModuleEpicPercentage,
  selectLastPullDateForModule,
} from "../../store/selectors";
import { MODULES_BY_TYPE } from "../../config/modules";
import {
  MODULE_RARITY_ORDER,
  getModuleRarityColor,
} from "../../config/rarityColors";
import type { ModuleType, ModuleRarity } from "../../types";

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

  return (
    <div className="space-y-6">
      {TYPE_ORDER.map((type) => (
        <div key={type}>
          <h3 className="text-sm font-medium text-[var(--color-accent-gold)] uppercase tracking-wider mb-2">
            {TYPE_LABELS[type]}
          </h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[var(--color-navy-500)]">
                  <th className="px-3 py-2 text-left text-xs text-gray-400 uppercase">Module</th>
                  <th className="px-3 py-2 text-left text-xs text-gray-400 uppercase">Count</th>
                  <th className="px-3 py-2 text-left text-xs text-gray-400 uppercase">% of Epics</th>
                  <th className="px-3 py-2 text-left text-xs text-gray-400 uppercase">Last Pulled</th>
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
                      <td
                        className="px-3 py-2 cursor-pointer"
                        data-testid={`rarity-${mod.id}`}
                        onClick={() => setEditingModule(editingModule === mod.id ? null : mod.id)}
                      >
                        {editingModule === mod.id ? (
                          <select
                            data-testid={`rarity-select-${mod.id}`}
                            value={rarity || ""}
                            onChange={(e) => {
                              if (e.target.value) {
                                updateModuleRarity(mod.id, e.target.value as ModuleRarity);
                              }
                              setEditingModule(null);
                            }}
                            onBlur={() => setEditingModule(null)}
                            autoFocus
                            className="bg-[var(--color-navy-800)] border border-[var(--color-navy-500)] rounded px-2 py-1 text-xs"
                          >
                            <option value="">Not set</option>
                            {MODULE_RARITY_ORDER.map((r) => (
                              <option key={r} value={r}>{r}</option>
                            ))}
                          </select>
                        ) : rarity ? (
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
  );
}
