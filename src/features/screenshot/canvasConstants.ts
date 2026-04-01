// Navy palette (from index.css vars)
export const NAVY_900 = "#06060f";
export const NAVY_800 = "#0c0c1d";
export const NAVY_700 = "#13132b";
export const NAVY_600 = "#1a1a3e";
export const GOLD = "#f0c040";
export const WHITE = "#e5e7eb";
export const GRAY = "#9ca3af";
export const DARK_GRAY = "#6b7280";

// Layout constants
export const ROW_HEIGHT = 28;
export const HEADER_HEIGHT = 44;
export const SECTION_HEADER_HEIGHT = 32;
export const COL_HEADER_HEIGHT = 28;
export const PADDING = 20;
export const TABLE_WIDTH = 620;
export const STATS_WIDTH = 220;
export const GAP = 20;
// Column positions (x offsets from left padding)
export const COL_NAME = 0;
export const COL_COPIES = 260;
export const COL_RARITY = 320;
export const COL_PCT = 420;
export const COL_LAST_PULLED = 490;

/**
 * Draw a rounded rectangle path on the canvas context.
 * Callers must call ctx.fill() or ctx.stroke() after.
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
