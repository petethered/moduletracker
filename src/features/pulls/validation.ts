/**
 * validation.ts — pure validation rules for the 10x pull form.
 *
 * Role:
 *   - Single source of truth for "is this PullForm state submittable?".
 *   - Returns a list of human-readable error strings; empty array = valid.
 *
 * User flow it supports:
 *   - PullForm calls this on every render to drive the disabled state of
 *     "Save Pull" and (eventually) inline error messaging.
 *
 * Why pure / framework-free:
 *   - Kept as a plain function (no React, no store) so unit tests in
 *     src/__tests__/ can exercise every branch cheaply, and so the same
 *     rules can be reused later in import flows or server-side validation.
 *
 * Domain context:
 *   - "10x pull" = a single gacha pull in The Tower yields exactly 10 module
 *     drops, partitioned across rarities. Total MUST equal 10. The whole
 *     premise of the form (and these rules) breaks if that invariant is
 *     loosened — keep it.
 */
export function validatePullForm(
  commonCount: number,
  rareCount: number,
  epicCount: number
) {
  const errors: string[] = [];

  // Per-rarity bounds: each bucket can hold 0..10 of the 10 drops.
  // WHY: prevents negative counts (which would corrupt selectors that sum
  // counts across pulls) and prevents >10 in a single bucket (impossible
  // in a 10x pull, would skew analytics and pity tracking).
  if (commonCount < 0 || commonCount > 10)
    errors.push("Common count must be 0-10");
  if (rareCount < 0 || rareCount > 10) errors.push("Rare count must be 0-10");
  if (epicCount < 0 || epicCount > 10) errors.push("Epic count must be 0-10");

  // Total invariant: a 10x pull always produces exactly 10 drops.
  // WHY: any other sum means the user mis-entered something; saving such a
  // record would silently break gem-per-pull math, dry-streak / pity
  // counters (PITY_PULL_THRESHOLD logic in selectors), and rarity rate
  // analytics. Better to block submission than poison the dataset.
  if (commonCount + rareCount + epicCount !== 10)
    errors.push("Common + Rare + Epics must equal 10");

  return errors;
}
