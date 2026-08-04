/**
 * Brand accent and signal colors, as JavaScript values.
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
 * !! SYNC CONTRACT !!
 * Mirrors the matching custom properties in src/index.css. Change one, change
 * the other.
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
