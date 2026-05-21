# Dashboard Banner Stats Breakdown

## Problem

The dashboard's headline KPI strip aggregates pulls across **all** banner
types (`standard`, `featured`, `lucky`). Players who pull on more than one
banner can't see how each banner performed individually — total pulls, gems
spent, epics, and observed epic rate are all mixed together. The user wants a
per-banner breakdown visible only when there's actually something to compare.

## Goals

- Show per-banner stats (pulls, gems, epics, epic rate) on the dashboard.
- Only render the breakdown when ≥2 distinct banner types appear in the pull
  history — single-banner users see no change.
- Stay derived: no new state, no localStorage changes.

## Non-Goals

- No filtering of the rest of the dashboard by banner.
- No banner-segmented predictions (gems-to-complete, pity, merge progress).
  Those keep their existing whole-history semantics.
- No new banner types. The roster stays `standard | featured | lucky`.

## Architecture

Three additions, all in the existing dashboard feature:

1. **Selector** — `selectStatsByBanner` in `src/store/selectors.ts`.
2. **Component** — `src/features/dashboard/BannerStatsBreakdown.tsx`.
3. **Wiring** — `<BannerStatsBreakdown />` inserted into `Dashboard.tsx`
   directly above `<ModuleCollectionGrid />`.

### Selector: `selectStatsByBanner`

```ts
export type BannerStats = {
  totalPulls: number;
  gemsSpent: number;
  epicsFound: number;
  epicRate: number; // percentage, 0..100
};

export function selectStatsByBanner(
  pulls: PullRecord[]
): Partial<Record<BannerType, BannerStats>>;
```

- Single pass over `pulls`; bucket by `bannerType`.
- Banner keys with **zero** pulls are absent from the result (so callers can
  check `Object.keys(result).length` for "how many banners were used").
- Per-bucket math mirrors the existing whole-history selectors:
  - `epicsFound = Σ epicModules.length`
  - `epicRate   = epicsFound / (totalPulls * 10) * 100`, with 0-pull
    short-circuit (avoid NaN — same guard pattern as `selectEpicPullRate`).

### Component: `BannerStatsBreakdown`

- Subscribes once: `useStore(s => s.pulls)`.
- Runs `selectStatsByBanner(pulls)`.
- **Self-gates**: if `Object.keys(stats).length < 2`, returns `null`. This
  keeps `Dashboard.tsx` free of conditional rendering logic.
- Renders a card matching the `ModuleCollectionGrid` shell
  (`bg-[var(--color-navy-800)] rounded-xl p-4 border border-[var(--color-navy-500)]`)
  with the header "Banner Breakdown".
- Inside the card: a responsive sub-grid (`grid-cols-1 sm:grid-cols-2
  lg:grid-cols-3 gap-3`).
- Each per-banner panel:
  - Outer styling: `rounded-lg border p-3` with a `var(--color-navy-700)/60`
    background and a banner-tinted border (the banner accent color at ~40%
    alpha via `color-mix`).
  - Top: uppercase banner name (tracking-wider, ~10px) in its accent color.
  - Below: four stat rows (`Pulls`, `Gems`, `Epics`, `Rate`). Label on left
    (gray, body font), value on right (white, mono font for digit alignment).
    Rows separated by `space-y-1`.
- Banner accent colors (reusing existing CSS tokens, no new vars):
  - `standard` → `var(--color-accent-gold)`
  - `featured` → `var(--color-rarity-epic)` (purple)
  - `lucky`    → `var(--color-rarity-ancestral)` (green)
- Iteration order is fixed `[standard, featured, lucky]` so the layout
  doesn't shuffle as data changes. Banners with zero pulls are skipped.

### Wiring

In `Dashboard.tsx`, insert between the activity two-column row and the
existing `<ModuleCollectionGrid />`:

```tsx
<BannerStatsBreakdown />
<ModuleCollectionGrid />
```

No conditional in the parent — the child returns `null` when the gate fails.

## Data Flow

```
zustand store
  └── pulls: PullRecord[]
        │
        ├── selectStatsByBanner(pulls) ──► BannerStatsBreakdown
        │
        └── (unchanged) ────────────────► StatCardGrid, etc.
```

The new selector is pure and stateless like every other selector in
`selectors.ts`. No memoization needed — Zustand re-renders only when `pulls`
changes, and the selector is cheap (single pass).

## Edge Cases

- **Empty pulls** → selector returns `{}`, component returns `null`.
- **One banner type only** → selector returns 1 key, component returns
  `null` (gate fails).
- **Banner with zero epics** → `epicRate = 0` (not NaN), stat renders as
  `0.00%`.
- **Unknown future banner type in stored data** → because we iterate over a
  fixed banner-type list and skip unknown buckets, this is benign; legacy
  data would simply not show under any panel. (Not currently possible —
  `BannerType` is a closed union.)

## Testing

Unit tests in `src/__tests__/selectors.test.ts`:

- Empty pulls → returns `{}`.
- All pulls on one banner → returns one key with correct stats; epic rate
  matches `selectEpicPullRate`.
- Mixed banners → each bucket has correct counts/gems/epics/rate; sum of
  per-banner totals equals whole-history totals (cross-check invariant).
- Zero-epic banner → `epicRate === 0`, no NaN.

No new E2E test — the visual change is data-driven and covered indirectly by
existing dashboard E2E (it must continue to render with single-banner test
data).

## Localization

Numbers go through existing formatting conventions:
- `gemsSpent` → `.toLocaleString()` (matches `StatCardGrid`'s Gems Spent).
- `epicRate` → `.toFixed(2) + '%'` (matches `StatCardGrid`'s Epic Rate).
- `totalPulls`, `epicsFound` → plain integer rendering (matches existing
  KPI cards).

No new locale-aware utilities introduced; the change is consistent with how
the existing dashboard formats the same kinds of values.

## Persistence

None. No new keys, no schema changes, no migration. The feature is purely
derived from existing `pulls` state.
