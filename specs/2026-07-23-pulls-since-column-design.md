# "Pulls Since" Column — Module Collection Page

**Date:** 2026-07-23
**Status:** Approved

## Problem

The Module Collection tables (`src/features/modules/ModuleTable.tsx`) show *when* a
module was last drawn ("Last Pulled") but not *how long* the drought has been in
gacha terms. The user wants a "Pulls Since" column, directly after "Last Pulled",
showing the number of individual draws since the module last appeared.

## Semantics

- Each `PullRecord` is one 10x batch (invariant: `commonCount + rareCount +
  epicModules.length === 10`). Draw order *within* a batch is not tracked.
- **Pulls Since = (number of batches strictly newer than the batch where the
  module last appeared) × 10.**
  - Ordering is the same newest-first ordering `selectLastPullDateForModule`
    uses: date descending, same-date ties broken by insertion index (later
    insertion = newer). Reuse `sortPullsNewest`.
  - A module drawn in the most recent batch shows `0`.
  - Duplicates inside `epicModules` don't matter — only the newest batch
    containing the module id is relevant.
- **Never drawn → total lifetime draws** (`pulls.length × 10`). This makes the
  column a drought counter from day one for unowned modules, per user choice.
  (Deliberately *not* "-", unlike the Last Pulled column.)
- Counts **all pulls across all banners**, consistent with how Last Pulled
  behaves today. No banner filtering.

## Approach

New standalone selector in `src/store/selectors.ts`:

```ts
selectPullsSinceLastDrawnForModule(pulls: PullRecord[], moduleId: string): number
```

Mirrors `selectLastPullDateForModule`'s shape (sort newest-first, walk until the
module id is found), counting batches walked × 10; returns `pulls.length * 10`
when the module never appears.

Rejected alternative: a combined `{ lastDate, pullsSince }` selector computed in
one pass. Marginally faster but refactors the existing Last Pulled call path for
no user-visible gain at realistic data sizes (hundreds of batches).

No store/persistence changes — purely derived data, per the "all stats via
selectors" convention. No localStorage impact.

## UI

In `ModuleTable.tsx` (applies to each per-type table — cannon/armor/generator/core):

- New `<col>`, `<th>Pulls Since</th>`, and `<td>` between "Last Pulled" and
  "Rarity".
- Value formatted locale-aware (not raw interpolation). No number formatter
  exists yet in `src/utils/` (only `formatDate.ts`, `renderLog.ts`), so add a
  shared `src/utils/formatNumber.ts` wrapping `toLocaleString()` for integer
  counts — reusable by future stats displays.
- Column widths rebalanced: Module 30% / Count 10% / % of Epics 14% /
  Last Pulled 18% / Pulls Since 12% / Rarity 16%.
- The hidden "Progress" column comments remain untouched.

## Testing (TDD)

Unit tests in `src/__tests__/selectors.test.ts` for `selectPullsSinceLastDrawnForModule`:

1. Empty pulls array → `0`.
2. Never drawn with N batches logged → `N × 10`.
3. Drawn in the newest batch → `0`.
4. Drawn K batches ago → `K × 10`.
5. Same-date tiebreak: two batches on one date — insertion order decides which
   is newer.

E2E: light assertion in the existing module-table spec that the "Pulls Since"
header renders.
