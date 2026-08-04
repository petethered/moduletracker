/**
 * Guards the CSS-variable <-> TS-constant sync contract for color tokens.
 *
 * WHY THIS EXISTS:
 * Some colors must be declared twice, because the app has two rendering paths
 * that cannot share one runtime source:
 *   1. DOM      -> Tailwind classes reading `var(--color-*)` from index.css.
 *   2. Non-CSS  -> <canvas> (src/features/screenshot/*) and Recharts, which
 *                  sets `stroke`/`fill` as SVG presentation ATTRIBUTES where
 *                  `var()` does not resolve. Both need literal strings.
 *
 * That duplication already drifted once and shipped: index.css held the
 * Tailwind -400 shades while moduleRarities.ts held the -500 shades, so "epic"
 * rendered as #c084fc on a StatCard and #a855f7 on a collection tile, on the
 * same dashboard. The only thing guarding it was a comment, and comments do
 * not fail builds.
 *
 * This parses index.css as text rather than importing it, because Vitest does
 * not evaluate CSS custom properties into a JS-readable object and jsdom does
 * not apply the stylesheet. Text-matching is crude but it is exactly what a
 * human would check, costs nothing, and catches the real failure mode.
 *
 * SCOPE — read before adding cases:
 * Only tokens that are genuinely declared in BOTH places belong here.
 *   - MODULE_TYPE_COLORS (config/moduleTypes.ts) and the CHART_* values in
 *     config/runtimeColors.ts have NO CSS counterpart on purpose: every
 *     consumer passes them into a JS API, so a parallel CSS declaration would
 *     be an unread second source of truth.
 *   - canvasConstants.ts also duplicates navy + gold, but that is a PINNED
 *     SNAPSHOT for the exported PNG and is deliberately allowed to drift.
 *     Do not add assertions for it.
 */

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { MODULE_RARITY_COLORS } from "../config/moduleRarities";
import {
  ACCENT_GOLD,
  SIGNAL_WARNING,
  TEXT_MUTED,
} from "../config/runtimeColors";

// Read from disk rather than importing the stylesheet.
//
// Two approaches were tried and rejected first, so you don't repeat them:
//   - `import css from "../index.css?raw"` — Vitest defaults to `css: false`,
//     which stubs CSS imports, so `?raw` resolved to an empty module and every
//     assertion silently compared against undefined. Enabling `css: true`
//     would push all of Tailwind v4 through the test pipeline for one test.
//   - `new URL("../index.css", import.meta.url)` — under the jsdom environment
//     Vitest rewrites import.meta.url to a non-`file:` scheme, so readFileSync
//     throws "The URL must be of scheme file".
//
// `node:fs` is why tsconfig.app.json includes the "node" type package; see the
// comment there. Resolving from cwd (the Vitest root) is safe because Vitest
// always runs from the project root. This must read the SOURCE stylesheet —
// `docs/` holds a built copy with the variables already inlined.
const css = readFileSync(resolve(process.cwd(), "src/index.css"), "utf8");

/**
 * Extract a custom property's declared value from index.css.
 *
 * Returns the lowercased hex, or `undefined` if the property is absent — the
 * `undefined` case is what catches a variable being renamed or deleted out
 * from under a TS constant, which is just as breaking as a value change.
 */
function cssVar(name: string): string | undefined {
  const match = css.match(new RegExp(`--${name}:\\s*(#[0-9a-fA-F]{3,8})`));
  return match?.[1]?.toLowerCase();
}

describe("color token sync contract (src/index.css <-> src/config)", () => {
  // Single %s on purpose: it.each spreads the whole tuple into the title, so a
  // second %s would render the hex where the reader expects the variable name.
  it.each(Object.entries(MODULE_RARITY_COLORS))(
    "rarity '%s' matches its --color-rarity-* variable",
    (tier, hex) => {
      expect(cssVar(`color-rarity-${tier}`)).toBe(hex.toLowerCase());
    }
  );

  it("ACCENT_GOLD matches --color-accent-gold", () => {
    expect(cssVar("color-accent-gold")).toBe(ACCENT_GOLD.toLowerCase());
  });

  it("SIGNAL_WARNING matches --color-signal-warning", () => {
    expect(cssVar("color-signal-warning")).toBe(SIGNAL_WARNING.toLowerCase());
  });

  it("TEXT_MUTED matches --color-text-muted", () => {
    expect(cssVar("color-text-muted")).toBe(TEXT_MUTED.toLowerCase());
  });

  it("finds no --color-type-* variables (type palette is TS-only by design)", () => {
    // Regression guard for the reverse mistake: re-adding CSS vars for the
    // module-type palette would recreate an unread second source of truth.
    // See src/config/moduleTypes.ts for why that palette lives in TS only.
    expect(css).not.toMatch(/--color-type-/);
  });
});
