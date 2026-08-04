/**
 * Colors that must exist as JavaScript string values at runtime.
 *
 * The filename names the REASON this file exists, not a category of its
 * contents — that is why it is `runtimeColors` and not `brandColors`. It holds
 * brand accents, a signal color, chart chrome and a muted text value, and the
 * only thing they have in common is that a CSS variable cannot reach them.
 *
 * WHY THIS FILE EXISTS:
 * Most of the app styles via the `--color-*` custom properties in
 * src/index.css, which is the right default. But some consumers need a real
 * string at runtime and cannot resolve a CSS variable:
 *
 *   - Recharts sets `stroke` / `fill` as SVG *attributes*. `var(--x)` resolves
 *     in a CSS property but NOT in a presentation attribute, so passing
 *     "var(--color-accent-gold)" to a <Line stroke=...> silently renders black.
 *     This is the specific trap that led to hex literals being scattered
 *     through the analytics charts in the first place.
 *   - Anything else handing a color to a non-CSS API.
 *
 * !! SYNC CONTRACT (applies only where a CSS counterpart exists) !!
 * ACCENT_GOLD, SIGNAL_WARNING and TEXT_MUTED mirror custom properties in
 * src/index.css and are asserted equal by src/__tests__/colorTokens.test.ts.
 * The CHART_* values below have NO CSS counterpart on purpose: nothing but
 * Recharts consumes them, so a parallel CSS declaration would be a second
 * source of truth that nothing reads. Same reasoning as MODULE_TYPE_COLORS.
 *
 * NOT IN SCOPE — src/features/screenshot/canvasConstants.ts:
 * That file also duplicates navy + gold, and that duplication is DELIBERATE
 * and documented there: the exported PNG must render identically regardless of
 * the viewer's theme, so it deliberately pins its own literals rather than
 * tracking the live palette. Do not "helpfully" collapse it into this file.
 */

/** Primary brand accent. Titles, active tab, focus rings, gem/economy series. */
export const ACCENT_GOLD = "#f0c040";

/*
 * NOTE: there are deliberately no crimson exports here. The brand crimson and
 * its darkened button variant are consumed only through Tailwind classes
 * (`var(--color-accent-crimson)` / `var(--color-accent-crimson-deep)`, see
 * Button.tsx), never from JS. Adding them here would create dead exports that
 * duplicate the CSS vars. Only add a constant to this file when something
 * genuinely cannot resolve a CSS variable.
 */

/**
 * Warning / benchmark red for chart reference lines.
 *
 * Deliberately NOT a rarity color. It previously happened to equal the old
 * mythic hex (#ef4444), which made the "expected value" reference lines look
 * like a rarity encoding. The rarity palette has since moved to the -400 band,
 * so this now reads as its own signal color and should stay that way.
 */
export const SIGNAL_WARNING = "#ef4444";

/**
 * Muted secondary text, for the handful of places that set `color` via an
 * inline `style` object instead of a Tailwind class.
 *
 * This literal was previously repeated at 8 call sites across the dashboard
 * (TypeBalance, MergeProgressSummary, PullHighlights, PullCalendar,
 * ModuleCollectionGrid) with no name attached, making it the single
 * most-scattered color in the codebase.
 *
 * RELATIONSHIP TO `text-gray-400`: visually equivalent, NOT byte-identical.
 * Tailwind v4 moved its palette to oklch, so `text-gray-400` actually computes
 * to #99a1af while this is the v3-era #9ca3af. The difference is imperceptible
 * (both clear WCAG AA on every navy surface: 6.98-7.43:1 for the Tailwind
 * value, 7.16-7.62:1 for this one). Prefer the `text-gray-400` CLASS wherever
 * a class works; reach for this constant only when the value must be a JS
 * string. Do not assume the two are interchangeable in a snapshot test.
 */
export const TEXT_MUTED = "#9ca3af";

/* --------------------------------------------------------------------------
   CHART CHROME
   --------------------------------------------------------------------------
   Recharts tooltip and grid styling. These four values were duplicated across
   RarityBreakdownBar, GemsPerEpicChart, PullRateChart and ModuleDistribution-
   Chart, which is past the rule of three and exactly the drift this file
   exists to prevent.

   They sit slightly off the `--color-navy-*` scale (the closest neighbours are
   navy-700 #13132b and navy-600 #1a1a3e) because they were tuned against
   Recharts' own default surface treatment rather than against the app's panel
   backgrounds. That is a real difference, not an accident, so they are their
   own named values rather than being forced onto the navy scale.
-------------------------------------------------------------------------- */

/** Recharts tooltip panel fill. */
export const CHART_TOOLTIP_BG = "#16213e";

/** Recharts tooltip 1px border. */
export const CHART_TOOLTIP_BORDER = "#0f3460";

/**
 * CartesianGrid stroke. Deliberately near-invisible against the navy theme:
 * it should suggest gridlines without competing with the data series.
 */
export const CHART_GRID = "#1a1a2e";

/** Shared tooltip `contentStyle` so all four charts render identical chrome. */
export const CHART_TOOLTIP_STYLE = {
  backgroundColor: CHART_TOOLTIP_BG,
  border: `1px solid ${CHART_TOOLTIP_BORDER}`,
  borderRadius: 8,
} as const;
