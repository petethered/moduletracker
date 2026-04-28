/**
 * drawStatsPanel — renders the right-hand "Summary" panel inside the screenshot canvas.
 *
 * Role in the broader feature:
 *   Called by generateScreenshot.ts after the modules table is painted. Owns its own
 *   internal layout (title + 6 stat rows + 4 dividers + pie chart) so the parent doesn't
 *   need to know what's inside.
 *
 * Canvas dimensions / draw order:
 *   The panel width is fixed at STATS_WIDTH (220px) from canvasConstants. Height is
 *   computed from the layout constants below — keep `panelHeight` aligned with the
 *   ACTUAL draw sequence below or you'll get clipping or trailing whitespace.
 *
 *   Draw sequence (top to bottom):
 *     1. Background fill + border (rounded rect)
 *     2. "Summary" title (gold, bold)
 *     3. Gems Spent row
 *     4. Divider
 *     5. Total Pulls row
 *     6. Divider
 *     7. Common / Rare / Epic rarity rows
 *     8. Divider
 *     9. Pie chart (centered horizontally)
 *    10. Divider
 *    11. Gems/Epic row (gold, emphasized)
 *
 * Layout-constant sourcing:
 *   - PIE_RADIUS 50 chosen to fit STATS_WIDTH 220 with comfortable side margins (~60px).
 *   - DIVIDER_HEIGHT 20 = 4px gap above the stroke + 16px gap below. The asymmetry
 *     is deliberate so divided sections feel grouped with the content above them.
 *   - ROW_HEIGHT 24 (different from the table's 28) gives a tighter feel that suits
 *     a sidebar of label/value pairs.
 *
 * Font / color choices:
 *   - "Outfit" matches the app's body font (loaded in index.html / index.css).
 *     `document.fonts.ready` is awaited in the parent before drawing — without that wait
 *     canvas falls back to system sans-serif and the screenshot looks wrong.
 *   - Rarity row LABELS use rarity color (Common=white, Rare=blue, Epic=purple) so the
 *     visual palette mirrors the in-app history view. Values stay WHITE for legibility.
 *   - Gems/Epic value uses GOLD because it's the "headline" stat for gacha efficiency.
 *
 * Image-export quirks:
 *   - Pie chart with 0 total pulls draws a flat NAVY_600 disc (rather than an empty
 *     circle outline) so the panel doesn't look broken on a fresh account.
 *   - Slice angles start at -π/2 (12 o'clock) for the conventional "first slice on top".
 */
import { RARITY_COLORS } from "../../config/rarityColors";
import type { ScreenshotData } from "./screenshotData";
import {
  NAVY_800,
  NAVY_600,
  GOLD,
  WHITE,
  GRAY,
  STATS_WIDTH,
  drawRoundRect,
} from "./canvasConstants";

export function drawStatsPanel(
  ctx: CanvasRenderingContext2D,
  data: ScreenshotData,
  x: number,
  y: number,
) {
  const panelWidth = STATS_WIDTH;
  const PIE_RADIUS = 50;

  // Layout constants — keep in sync with the helpers and draw sequence below.
  // If you change any of these numbers, recompute `panelHeight` accordingly or the
  // background rect will be the wrong size (clipping content or leaving dead space).
  const TOP_PADDING = 24;
  const BOTTOM_PADDING = 16;
  const TITLE_HEIGHT = 28;
  const ROW_HEIGHT = 24;
  const DIVIDER_HEIGHT = 20; // 4 above the line + 16 below
  const PIE_SECTION_HEIGHT = 8 + PIE_RADIUS * 2 + 8;

  // Draw sequence: title, 6 stat/rarity rows, 4 dividers, pie section
  // STAT_ROWS counts: Gems Spent, Total Pulls, Common, Rare, Epic, Gems/Epic.
  // DIVIDERS counts: after-Gems-Spent, after-Total-Pulls, after-rarities, after-pie.
  const STAT_ROWS = 6;
  const DIVIDERS = 4;
  const panelHeight =
    TOP_PADDING +
    TITLE_HEIGHT +
    STAT_ROWS * ROW_HEIGHT +
    DIVIDERS * DIVIDER_HEIGHT +
    PIE_SECTION_HEIGHT +
    BOTTOM_PADDING;

  // Panel background — fill first, then stroke. Doing them in two passes (rather than
  // one path) is required because canvas can't fill+stroke the same path with different
  // styles atomically without saving/restoring state.
  ctx.fillStyle = NAVY_800;
  drawRoundRect(ctx, x, y, panelWidth, panelHeight, 6);
  ctx.fill();

  ctx.strokeStyle = NAVY_600;
  ctx.lineWidth = 1;
  drawRoundRect(ctx, x, y, panelWidth, panelHeight, 6);
  ctx.stroke();

  // `py` (panel-y) is the running cursor; helpers advance it as they draw. Starting at
  // y + TOP_PADDING means the title's baseline lands with proper top breathing room.
  let py = y + TOP_PADDING;

  // Draws a thin horizontal rule and advances py by DIVIDER_HEIGHT.
  // Padding split: 4px above the stroke, 16px below. The bottom-heavy split groups the
  // divider visually with the section ABOVE it.
  const drawDivider = () => {
    py += 4;
    ctx.strokeStyle = NAVY_600;
    ctx.beginPath();
    ctx.moveTo(x + 16, py);
    ctx.lineTo(x + panelWidth - 16, py);
    ctx.stroke();
    py += 16;
  };

  // Generic label/value row. Label aligns left in GRAY; value aligns right in `valueColor`
  // (default WHITE; gold for the headlining Gems/Epic). Always restore textAlign back to
  // "left" because canvas state is global and other code expects left-align.
  const drawStatRow = (label: string, value: string, valueColor = WHITE) => {
    ctx.font = "13px Outfit, sans-serif";
    ctx.fillStyle = GRAY;
    ctx.fillText(label, x + 16, py);
    ctx.fillStyle = valueColor;
    ctx.textAlign = "right";
    ctx.fillText(value, x + panelWidth - 16, py);
    ctx.textAlign = "left";
    py += 24;
  };

  // Specialized row for Common/Rare/Epic. Differs from drawStatRow in two ways:
  //   1. Label color reflects rarity (visual mirror of the in-app history view).
  //   2. Value formats both count and percentage on one line, e.g. "1,234  (25.5%)".
  // toLocaleString() ensures locale-appropriate thousands separators.
  const drawRarityRow = (
    label: string,
    count: number,
    pct: number,
    color: string,
  ) => {
    ctx.font = "13px Outfit, sans-serif";
    ctx.fillStyle = color;
    ctx.fillText(label, x + 16, py);
    ctx.fillStyle = WHITE;
    ctx.textAlign = "right";
    ctx.fillText(
      `${count.toLocaleString()}  (${pct.toFixed(1)}%)`,
      x + panelWidth - 16,
      py,
    );
    ctx.textAlign = "left";
    py += 24;
  };

  // Title — gold to match the in-app section headers.
  ctx.font = "bold 14px Outfit, sans-serif";
  ctx.fillStyle = GOLD;
  ctx.fillText("Summary", x + 16, py);
  py += 28;

  // Gems Spent
  drawStatRow("Gems Spent", data.stats.gemsSpent.toLocaleString());

  drawDivider();

  // Total Pulls
  drawStatRow("Total Pulls", data.stats.totalPulls.toLocaleString());

  drawDivider();

  // Rarity rows
  drawRarityRow(
    "Common",
    data.stats.commonCount,
    data.stats.commonPct,
    RARITY_COLORS.common,
  );
  drawRarityRow(
    "Rare",
    data.stats.rareCount,
    data.stats.rarePct,
    RARITY_COLORS.rare,
  );
  drawRarityRow(
    "Epic",
    data.stats.epicCount,
    data.stats.epicPct,
    RARITY_COLORS.epic,
  );

  drawDivider();

  // ----- Pie chart ---------------------------------------------------------------
  // Visualizes the rarity distribution. Top-padded by 8px (matched on the bottom).
  py += 8;
  const pieCx = x + panelWidth / 2;     // Horizontally centered in the panel
  const pieCy = py + PIE_RADIUS;        // Vertical center is one radius below py
  const total =
    data.stats.commonCount + data.stats.rareCount + data.stats.epicCount;

  if (total > 0) {
    // Build slice list in display order (common→rare→epic) so the visual ordering
    // matches the rarity rows above.
    const slices = [
      { pct: data.stats.commonCount / total, color: RARITY_COLORS.common },
      { pct: data.stats.rareCount / total, color: RARITY_COLORS.rare },
      { pct: data.stats.epicCount / total, color: RARITY_COLORS.epic },
    ];
    // Start at -π/2 = 12 o'clock so the first slice begins at the top, mirroring the
    // typical pie chart convention.
    let angle = -Math.PI / 2;
    for (const slice of slices) {
      // Skip 0% slices entirely — drawing a 0-radian arc still leaves a hairline artifact.
      if (slice.pct === 0) continue;
      const sliceAngle = slice.pct * Math.PI * 2;
      ctx.beginPath();
      ctx.moveTo(pieCx, pieCy);
      ctx.arc(pieCx, pieCy, PIE_RADIUS, angle, angle + sliceAngle);
      ctx.closePath();
      ctx.fillStyle = slice.color;
      ctx.fill();
      angle += sliceAngle;
    }
  } else {
    // Empty-state: solid navy disc rather than an outline. Looks intentional rather
    // than broken when the user hasn't recorded any pulls yet.
    ctx.beginPath();
    ctx.arc(pieCx, pieCy, PIE_RADIUS, 0, Math.PI * 2);
    ctx.fillStyle = NAVY_600;
    ctx.fill();
  }

  // Advance past the pie + bottom 8px padding to position next divider.
  py += PIE_RADIUS * 2 + 8;

  drawDivider();

  // Gems/Epic — the gacha-efficiency metric. Gold value emphasizes it as the headline
  // takeaway. Show "-" when no epics yet so we don't display Infinity/NaN.
  drawStatRow(
    "Gems/Epic",
    data.stats.gemsPerEpic > 0
      ? Math.round(data.stats.gemsPerEpic).toLocaleString()
      : "-",
    GOLD,
  );
}
