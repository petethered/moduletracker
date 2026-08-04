/**
 * BannerStatsBreakdown.tsx
 *
 * Role: Dashboard card that segments the headline stats (total pulls, gems
 * spent, epics found, observed epic rate) by banner type. Sits directly above
 * the Collection grid in Dashboard.tsx.
 *
 * Game-domain concept:
 *   The Tower has three banners — standard, featured, lucky — each with
 *   different odds / featured pools. The whole-history KPI strip averages all
 *   three together, which hides per-banner luck and spend. This card surfaces
 *   that breakdown WHEN it's meaningful (i.e. when the user has actually
 *   used more than one banner).
 *
 * Selectors / store reads:
 *   - useStore.pulls -> selectStatsByBanner -> Partial<Record<BannerType, BannerStats>>
 *
 * Self-gating: returns null when fewer than 2 banners appear in the history,
 * so the dashboard layout stays uncluttered for single-banner users. The
 * gate is co-located here (NOT in Dashboard.tsx) so the parent layout file
 * stays purely declarative.
 *
 * Visual structure:
 *   Outer card     — matches ModuleCollectionGrid's shell (navy-800, navy-500
 *                    border, rounded-xl, p-4) so the two cards visually pair.
 *   Inner sub-grid — 1 / 2 / 3 cols at sm/md/lg. Each panel is one banner
 *                    with a tinted border in that banner's accent color.
 *
 * Banner color mapping (intentionally distinct, reusing existing CSS tokens):
 *   standard -> --color-accent-gold       (default theme accent)
 *   featured -> --color-rarity-epic       (purple, signals "promoted")
 *   lucky    -> --color-rarity-ancestral  (green, signals fortune)
 */

import { useStore } from "../../store";
import { selectStatsByBanner, type BannerStats } from "../../store/selectors";
import type { BannerType } from "../../types";

/**
 * Iteration order for banner panels. Fixed so the layout doesn't shuffle as
 * data changes (e.g. when the user logs their first "lucky" pull, the
 * existing standard/featured panels stay put). Order matches the in-game
 * tab order players are used to.
 */
const BANNER_ORDER: BannerType[] = ["standard", "featured", "lucky"];

/**
 * Per-banner accent color. Reuses existing rarity / accent CSS variables so
 * the palette stays consistent with the rest of the dashboard. Do not
 * introduce new variables for this — if a future banner type ships, pick an
 * existing rarity color rather than minting a new one.
 */
const BANNER_COLORS: Record<BannerType, string> = {
  standard: "var(--color-accent-gold)",
  featured: "var(--color-rarity-epic)",
  lucky: "var(--color-rarity-ancestral)",
};

export function BannerStatsBreakdown() {
  const pulls = useStore((s) => s.pulls);
  const stats = selectStatsByBanner(pulls);
  // Banners actually used (selector only includes keys with >=1 pull).
  const bannersUsed = Object.keys(stats) as BannerType[];

  // Self-gate: only render when there's something to compare. Single-banner
  // users see no card at all — matches the "more than one banner in history"
  // product requirement.
  if (bannersUsed.length < 2) return null;

  return (
    <div className="bg-[var(--color-navy-800)] rounded-xl p-4 border border-[var(--color-navy-500)]">
      {/* Card header — short eyebrow text + a count, mirroring Collection's
          "found / total" pattern so the two cards read as a pair. */}
      <div className="flex justify-between items-center mb-3">
        <span className="font-semibold text-sm">Banner Breakdown</span>
        <span className="text-sm text-gray-400">
          {bannersUsed.length} banners
        </span>
      </div>

      {/* Sub-grid: 1 col on phones, 2 on tablets, 3 on desktop. With only 3
          banner types, lg:grid-cols-3 means each banner gets its own column
          at desktop widths — the visual layout the user chose in design. */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {BANNER_ORDER.map((banner) => {
          const bucket = stats[banner];
          // Banners with zero pulls are skipped — they were never in the
          // selector's result and there's nothing meaningful to show.
          if (!bucket) return null;
          return (
            <BannerPanel
              key={banner}
              banner={banner}
              stats={bucket}
              accent={BANNER_COLORS[banner]}
            />
          );
        })}
      </div>
    </div>
  );
}

/**
 * Inner panel — one per active banner. Kept local because the styling is
 * highly specific to this card (tinted border tied to the banner accent,
 * stat-row layout matched to the BannerStats shape). If a second consumer
 * ever needs the same panel, promote to components/ui/.
 */
function BannerPanel({
  banner,
  stats,
  accent,
}: {
  banner: BannerType;
  stats: BannerStats;
  accent: string;
}) {
  return (
    <div
      className="rounded-lg p-3 bg-[var(--color-navy-700)]/60"
      style={{
        // Border at ~40% alpha so the tint reads without overwhelming the
        // panel content. `color-mix` lets us derive the alpha variant from
        // the CSS variable without needing per-banner hex constants.
        border: `1px solid color-mix(in srgb, ${accent} 40%, transparent)`,
      }}
    >
      {/* Banner label — uppercase with wide tracking matches the
          SectionLabel pattern used elsewhere in the dashboard. */}
      <div
        className="text-[10px] font-semibold uppercase tracking-[0.15em] mb-2"
        style={{ color: accent, fontFamily: "var(--font-body)" }}
      >
        {banner}
      </div>
      <div className="space-y-1">
        <StatRow label="Pulls" value={stats.totalPulls.toLocaleString()} />
        {/* gemsSpent uses toLocaleString to match StatCardGrid's "Gems Spent". */}
        <StatRow label="Gems" value={stats.gemsSpent.toLocaleString()} />
        <StatRow label="Epics" value={stats.epicsFound.toLocaleString()} />
        {/* epicRate uses .toFixed(2) + '%' to match StatCardGrid's "Epic Rate"
            — both surface "observed epic %" so they should format identically. */}
        <StatRow label="Rate" value={`${stats.epicRate.toFixed(2)}%`} />
      </div>
    </div>
  );
}

/**
 * Single labeled stat row inside a banner panel. Label is gray body text on
 * the left; value is white mono on the right so digits align across the four
 * rows. Kept local — only used here.
 */
function StatRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between items-baseline">
      <span
        className="text-[10px] uppercase tracking-wider text-gray-400"
        style={{ fontFamily: "var(--font-body)" }}
      >
        {label}
      </span>
      <span
        className="text-sm text-white"
        style={{ fontFamily: "var(--font-mono)" }}
      >
        {value}
      </span>
    </div>
  );
}
