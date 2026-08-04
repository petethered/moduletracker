/**
 * canvasConstants — colors, layout dimensions, and the rounded-rect helper used by the
 * screenshot generator.
 *
 * Role in the broader feature:
 *   The screenshot feature renders a shareable PNG of the user's pull stats via raw
 *   <canvas>. Canvas has no CSS/Tailwind, so every color and pixel offset has to be
 *   declared explicitly. This module is the single source of truth so generateScreenshot
 *   and drawStatsPanel stay in lockstep on the visual language.
 *
 * Why these specific colors:
 *   The hex values mirror the navy/gold palette defined in index.css custom properties
 *   so the exported PNG looks like a screenshot of the live app. We can't use
 *   `var(--color-*)` because canvas requires resolved color strings.
 *
 * Why these specific layout numbers:
 *   - TABLE_WIDTH 620 + STATS_WIDTH 220 + GAP 20 + 2*PADDING 40 = 920 logical px. That
 *     fits comfortably into a Discord/Twitter image preview and isn't so wide it
 *     wraps awkwardly.
 *   - ROW_HEIGHT 28 was tuned for 13px Outfit body text (rowY = y + 19 in
 *     generateScreenshot.ts gives proper baseline alignment).
 *   - Column x-offsets are absolute (relative to PADDING). They were hand-tuned so the
 *     "COPIES" header centers over numeric values that range up to 4 digits.
 *   - SECTION_HEADER_HEIGHT 32 vs ROW_HEIGHT 28 gives section headers visual heft.
 *
 * Gotchas / image-export quirks:
 *   - The canvas is scaled by devicePixelRatio in generateScreenshot to get crisp output
 *     on retina displays. All constants here are LOGICAL px, not device px.
 *   - These values are intentionally NOT read from CSS vars — a canvas 2D context
 *     cannot resolve them, and the exported PNG must render identically regardless
 *     of the viewer's theme. This file is a PINNED SNAPSHOT of the palette, not a
 *     live mirror of it: if the app's colors change, updating these is a judgement
 *     call about how the exported image should look, NOT an automatic obligation.
 *     Do not "consolidate" this file into src/config/brandColors.ts — that file
 *     exists for live-UI values and says so.
 */

// Navy palette, snapshotted from index.css so the screenshot LOOKS like the app.
// Intentionally a copy, not a live reference — see the header. These have drifted
// from the live palette before (WHITE here is #e5e7eb while RARITY_COLORS.common is
// #e4e4e7); that is tolerable for an exported image and is not a bug to chase.
export const NAVY_900 = "#06060f"; // Page background
export const NAVY_800 = "#0c0c1d"; // Section headers / panel fill / alternating rows
export const NAVY_700 = "#13132b"; // Reserved (currently unused but kept for parity)
export const NAVY_600 = "#1a1a3e"; // Borders, dividers
export const GOLD = "#f0c040";     // Brand accent — title, summary header, gems/epic
export const WHITE = "#e5e7eb";    // Primary text (gray-200 in the app's tailwind)
export const GRAY = "#9ca3af";     // Secondary text (column headers, dates)
export const DARK_GRAY = "#6b7280";// Tertiary / disabled / "-" placeholders

// Layout constants — all in LOGICAL pixels (canvas is later scaled by DPR).
export const ROW_HEIGHT = 28;             // Per-module row
export const HEADER_HEIGHT = 44;          // Title + generated-at line at the top
export const SECTION_HEADER_HEIGHT = 32;  // CANNON / ARMOR / etc. section bands
export const COL_HEADER_HEIGHT = 28;      // "MODULE / COPIES / RARITY / ..." column header band
export const PADDING = 20;                // Outer padding on all sides
export const TABLE_WIDTH = 620;           // Width of the modules table (left side)
export const STATS_WIDTH = 220;           // Width of the summary panel (right side)
export const GAP = 20;                    // Space between table and stats panel

// Column positions: x offsets measured from `PADDING` (i.e. from the inside of the
// canvas's left margin). Hand-tuned to fit the longest expected content per column.
// If you change column content widths, retest with worst-case data (long module names,
// 4-digit copy counts) before adjusting.
export const COL_NAME = 0;          // "MODULE" — leftmost
export const COL_COPIES = 260;      // "COPIES" — center-aligned, header drawn at +20
export const COL_RARITY = 320;      // "RARITY" — left-aligned label like "Epic"
export const COL_PCT = 420;         // "% OF PULLS" — center-aligned, header drawn at +30
export const COL_LAST_PULLED = 490; // "LAST PULLED" — right-most column, formatted date

/**
 * Draw a rounded rectangle path on the canvas context.
 * Callers must call ctx.fill() or ctx.stroke() after.
 *
 * Why hand-rolled instead of `ctx.roundRect`:
 *   `roundRect` is widely supported now but wasn't when this was written, and we still
 *   support older Safari/Edge users hitting the page. Quadratic curves are sufficient
 *   for visual quality at typical radii (4-8px); we don't need cubic Bezier here.
 */
export function drawRoundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}
