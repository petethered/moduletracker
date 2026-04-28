/**
 * RecentPullsList.tsx
 *
 * Role: Dashboard list of the user's five most recent 10x pulls, with date,
 * rarity tally badges, the names of any epic modules pulled, and pity
 * tracking annotations. Each row is a click target that opens the edit
 * modal for that pull.
 *
 * Game-domain concept ("pity" + "highlights"):
 *   Each 10x pull resolves into 10 modules. We compress that into:
 *     - commonCount (e.g. "7C")
 *     - rareCount   (e.g. "2R")
 *     - epicModules (the actual list of epic ids — there are usually 0)
 *   "Pity" in The Tower's gacha system: if the user goes 150 pulls without
 *   an epic, the next pull is guaranteed to contain one. We display the dry
 *   streak counter on each pull row and a flashy "PITY :(" tag on the pull
 *   that triggered the pity bailout — that pull *technically* gave an epic,
 *   but the user knows it was a "free" pity hit, not real luck.
 *
 * Selectors consumed:
 *   - `sortPullsNewest(pulls)`         — descending by date, stable
 *   - `selectPityPullIds(pulls)`       — ids of pulls that resolved a pity
 *   - `selectDryStreakByPullId(pulls)` — for each non-epic pull, how many
 *                                         pulls deep the dry streak is
 *   - `PITY_PULL_THRESHOLD`            — the 150-pull guarantee constant
 *
 * Store actions:
 *   - `openEditPullModal(id)`          — clicked row -> open edit modal
 *
 * Why slice(5) without pagination: this is the dashboard summary. The full
 * paginated history lives in the History tab.
 */

import { useStore } from "../../store";
import { sortPullsNewest, selectPityPullIds, selectDryStreakByPullId, PITY_PULL_THRESHOLD } from "../../store/selectors";
import { MODULE_BY_ID } from "../../config/modules";
import { Badge } from "../../components/ui/Badge";
import { RARITY_COLORS } from "../../config/rarityColors";

export function RecentPullsList() {
  const pulls = useStore((s) => s.pulls);
  const openEditPullModal = useStore((s) => s.openEditPullModal);
  // Pity sets/maps are computed over the *full* pull history because the
  // dry-streak length depends on history beyond just the most-recent five.
  const pityIds = selectPityPullIds(pulls);
  const pityCounters = selectDryStreakByPullId(pulls);
  // Slice after sort — newest 5 only.
  const sorted = sortPullsNewest(pulls).slice(0, 5);

  // Empty state — same copy uses the exact CTA label from the AddPullButton
  // so the user has a clear next step.
  if (sorted.length === 0) {
    return (
      <p className="text-gray-500 text-sm">
        No pulls recorded yet. Click "Add 10x Pull" to get started.
      </p>
    );
  }

  return (
    <div className="space-y-2">
      {sorted.map((pull) => (
        <div
          key={pull.id}
          // Whole row clickable -> opens edit modal pre-filled with this pull.
          // Prefer this over a separate edit button because the dashboard row
          // is small; full-row hover affordance is more discoverable.
          onClick={() => openEditPullModal(pull.id)}
          className="flex items-center gap-3 bg-[var(--color-navy-600)] rounded-lg px-3 py-2 text-sm cursor-pointer hover:bg-[var(--color-navy-500)] transition-colors"
        >
          {/* Date column — fixed width (w-24) so badges align across rows. */}
          <span className="text-gray-400 w-24 shrink-0">{pull.date}</span>
          {/* Rarity tally badges. Common/Rare are always rendered (even if 0)
              so the row layout stays consistent. Epic is only shown when
              there are epics — adds emphasis when present. */}
          <Badge color={RARITY_COLORS.common}>{pull.commonCount}C</Badge>
          <Badge color={RARITY_COLORS.rare}>{pull.rareCount}R</Badge>
          {pull.epicModules.length > 0 && (
            <Badge color={RARITY_COLORS.epic}>
              {pull.epicModules.length}E
            </Badge>
          )}
          {/* Right-side detail column has three branches:
                1. Pull contains epics  -> show comma-joined module names
                                            (mapped via MODULE_BY_ID for nice
                                            names; falls back to id if missing).
                                            If this pull is the one that *triggered*
                                            pity, append the "PITY :(" tag.
                2. Pull has a dry-streak entry -> show "(pity N/150)" so the
                                            user can feel the tension building.
                3. Otherwise (pull has rares/commons but no streak tracked)
                                            -> render nothing, keeps row clean. */}
          {pull.epicModules.length > 0 ? (
            <span className="text-[var(--color-rarity-epic)] text-xs truncate">
              {pull.epicModules
                .map((id) => MODULE_BY_ID[id]?.name || id)
                .join(", ")}
              {pityIds.has(pull.id) && <span className="text-red-400 ml-1">PITY :(</span>}
            </span>
          ) : pityCounters.has(pull.id) ? (
            <span className="text-gray-500 text-xs">
              (pity {pityCounters.get(pull.id)}/{PITY_PULL_THRESHOLD})
            </span>
          ) : null}
        </div>
      ))}
    </div>
  );
}
