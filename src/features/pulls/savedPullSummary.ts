/**
 * savedPullSummary.ts — turns a just-saved pull payload into short, human-readable
 * lines for the "Save & Continue" confirmation toast.
 *
 * WHY a pure function in its own file (not inline in PullModal):
 *   - It's the only logic in the Save & Continue flow that has real branches
 *     (duplicate epics, retired module ids, banner labels), so it gets unit
 *     tests in src/__tests__/savedPullSummary.test.ts. The component just renders it.
 *
 * WHY three separate lines rather than one sentence:
 *   - The toast is read at a glance while the user is already moving on to the
 *     next entry. "What epics / what split / which date+banner" as stacked
 *     lines scans faster than a comma-soup sentence and wraps predictably on
 *     phone widths.
 *
 * LOCALIZATION:
 *   - The date goes through formatDisplayDate (locale-aware). Counts are
 *     bounded 0..10, so they render raw, like the form's own "Summary:" line
 *     (PullForm) and the History badges. formatInteger would be a no-op here.
 */
import { BANNER_LABELS } from "../../config/banners";
import { MODULE_BY_ID } from "../../config/modules";
import type { PullRecord } from "../../types";
import { formatDisplayDate } from "../../utils/formatDate";

export interface SavedPullSummary {
  /** Epic module names, duplicates collapsed ("Gilded Sniper ×2"), or "No epics". */
  epics: string;
  /**
   * Non-epic split, COMMON first. Matches the form's "Summary: N common, N rare"
   * line, which is on screen at the same moment as the toast; two different
   * orders side by side read as two different numbers.
   */
  counts: string;
  /** Date + banner, so the user can confirm sticky defaults carried over correctly. */
  context: string;
}

export function summarizeSavedPull(data: Omit<PullRecord, "id">): SavedPullSummary {
  // Count copies per module while preserving first-seen order — Map iteration
  // order is insertion order, which matches the order the user entered epics.
  const copies = new Map<string, number>();
  for (const id of data.epicModules) {
    copies.set(id, (copies.get(id) ?? 0) + 1);
  }

  const epics =
    copies.size === 0
      ? "No epics"
      : [...copies]
          .map(([id, n]) => {
            // MODULE_BY_ID can miss for ids no longer in the roster (see its
            // EDGE CASE note in modules.ts). Show the raw id rather than drop
            // the entry — the toast must reflect exactly what was saved.
            const name = MODULE_BY_ID[id]?.name ?? id;
            return n > 1 ? `${name} ×${n}` : name;
          })
          .join(", ");

  return {
    epics,
    counts: `${data.commonCount} common · ${data.rareCount} rare`,
    context: `${formatDisplayDate(data.date)} · ${BANNER_LABELS[data.bannerType]}`,
  };
}
