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
import type { BannerType } from "../../types";
import type { ScreenshotData } from "./screenshotData";
import {
  NAVY_800,
  NAVY_700,
  NAVY_600,
  GOLD,
  WHITE,
  GRAY,
  STATS_WIDTH,
  drawRoundRect,
} from "./canvasConstants";

/**
 * Per-banner accent colors. Mirror the dashboard's BannerStatsBreakdown:
 *   standard -> gold       (--color-accent-gold)
 *   featured -> epic purple (--color-rarity-epic)
 *   lucky    -> ancestral green (--color-rarity-ancestral)
 *
 * Hex literals are required because canvas can't read CSS variables.
 * Keep these in sync with the BANNER_COLORS map in BannerStatsBreakdown.tsx —
 * if a design tweak lands there, mirror it here too or the live dashboard
 * and the exported screenshot will drift.
 */
const BANNER_ACCENT: Record<BannerType, string> = {
  standard: GOLD,
  featured: RARITY_COLORS.epic,
  lucky: RARITY_COLORS.ancestral,
};

/**
 * Display order for the per-banner blocks. Matches BANNER_ORDER in
 * BannerStatsBreakdown.tsx so live UI and exported screenshot share the same
 * visual sequence; do not reorder.
 */
const BANNER_DISPLAY_ORDER: BannerType[] = ["standard", "featured", "lucky"];

/**
 * Layout constants for the "By Banner" subsection. Pulled out so
 * {@link computeStatsPanelHeight} can size the canvas WITHOUT actually
 * drawing — it has to know these numbers ahead of time.
 *
 * Sizing intent (per banner block):
 *   header band (24) + post-header gap (14) + 4 stat rows × 20 (80) + spacer (12) = 130px
 *
 * Post-header gap rationale:
 *   The first stat row is positioned by its text BASELINE. For 12px Outfit
 *   the cap-height/ascender extends ~9–10px ABOVE the baseline, so a small
 *   gap (e.g. 6px) leaves the row's text glyphs visually overlapping the
 *   header band. 14px gives 4–5px of clear space between the band's bottom
 *   edge and the top of the row's ascenders. Don't reduce below ~12px or
 *   the visual collision returns.
 */
const BANNER_HEADER_HEIGHT = 24;
const BANNER_POST_HEADER_GAP = 14;
const BANNER_ROW_HEIGHT = 20;
const BANNER_BLOCK_SPACER = 12;
const BANNER_BLOCK_HEIGHT =
  BANNER_HEADER_HEIGHT +
  BANNER_POST_HEADER_GAP +
  4 * BANNER_ROW_HEIGHT +
  BANNER_BLOCK_SPACER;
/** Height of the "By Banner" title above the blocks. */
const BANNER_SECTION_TITLE_HEIGHT = 28;
/** Divider between Gems/Epic row and the "By Banner" title. Matches the
    rest of the panel's 4-above + 16-below divider rhythm. */
const BANNER_SECTION_DIVIDER_HEIGHT = 20;

/**
 * Single source of truth for the gating decision: do we render the
 * "By Banner" subsection? Used by BOTH the height calculation and the
 * draw routine so they can't disagree (which would cause clipping or
 * dead space at the bottom of the panel).
 *
 * Returns the list of banner keys to render (canonical order applied at
 * draw time). An empty array means: skip the subsection entirely.
 */
function getRenderableBanners(
  byBanner: ScreenshotData["byBanner"],
): BannerType[] {
  const keys = Object.keys(byBanner) as BannerType[];
  // Match the dashboard's BannerStatsBreakdown gate exactly: ≥2 banners.
  return keys.length >= 2 ? keys : [];
}

/**
 * Returns the height (logical px) of the per-banner subsection, including
 * its divider, title, and any banner blocks. Returns 0 when the gate is not
 * met (fewer than 2 banners present) — single-banner users get no extra
 * height and the screenshot looks identical to before.
 */
function bannerSectionHeight(byBanner: ScreenshotData["byBanner"]): number {
  const banners = getRenderableBanners(byBanner);
  if (banners.length === 0) return 0;
  return (
    BANNER_SECTION_DIVIDER_HEIGHT +
    BANNER_SECTION_TITLE_HEIGHT +
    banners.length * BANNER_BLOCK_HEIGHT
  );
}

/**
 * Compute the total logical height of the stats panel for a given data set.
 *
 * Why a separate function (instead of just returning it from drawStatsPanel):
 *   generateScreenshot needs the panel's height BEFORE draw time so it can
 *   size the overall canvas to `max(table-height, panel-bottom)`. Without
 *   this, a tall panel (e.g. multi-banner users) clips off the bottom edge
 *   of the canvas.
 *
 * Keep this in lockstep with the draw sequence in drawStatsPanel — any new
 * row, divider, or section MUST update both this function and the renderer
 * or you'll see clipping or trailing whitespace.
 */
export function computeStatsPanelHeight(data: ScreenshotData): number {
  const TOP_PADDING = 24;
  const BOTTOM_PADDING = 16;
  const TITLE_HEIGHT = 28;
  const ROW_HEIGHT = 24;
  const DIVIDER_HEIGHT = 20;
  const PIE_RADIUS = 50;
  const PIE_SECTION_HEIGHT = 8 + PIE_RADIUS * 2 + 8;
  const STAT_ROWS = 6;
  const DIVIDERS = 4;
  return (
    TOP_PADDING +
    TITLE_HEIGHT +
    STAT_ROWS * ROW_HEIGHT +
    DIVIDERS * DIVIDER_HEIGHT +
    PIE_SECTION_HEIGHT +
    bannerSectionHeight(data.byBanner) +
    BOTTOM_PADDING
  );
}

export function drawStatsPanel(
  ctx: CanvasRenderingContext2D,
  data: ScreenshotData,
  x: number,
  y: number,
) {
  const panelWidth = STATS_WIDTH;
  const PIE_RADIUS = 50;

  // Layout constants — keep in sync with computeStatsPanelHeight() above. If
  // you change any of these here, mirror the change there or the background
  // rect will be the wrong size (clipping content or leaving dead space).
  const TOP_PADDING = 24;
  // Single source of truth for the panel height. computeStatsPanelHeight()
  // also knows about the optional "By Banner" subsection, so this naturally
  // grows when the screenshot includes per-banner data.
  const panelHeight = computeStatsPanelHeight(data);

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

  // ----- By Banner subsection ------------------------------------------------
  // Self-gates via the shared getRenderableBanners helper — same predicate
  // used by bannerSectionHeight above, so layout math and draw code can't
  // disagree about whether to render.
  if (getRenderableBanners(data.byBanner).length === 0) return;

  drawDivider();

  // "By Banner" title — gold to match the panel's "Summary" title styling.
  ctx.font = "bold 14px Outfit, sans-serif";
  ctx.fillStyle = GOLD;
  ctx.fillText("By Banner", x + 16, py);
  py += BANNER_SECTION_TITLE_HEIGHT;

  // Iterate in canonical order (not key order) so a user who logs lucky
  // before featured still sees [standard, featured, lucky] visually.
  for (const banner of BANNER_DISPLAY_ORDER) {
    const stats = data.byBanner[banner];
    if (!stats) continue;
    const accent = BANNER_ACCENT[banner];

    // Banner header: tinted background band spanning the inner panel
    // width. Mirrors the live dashboard's tinted-border panel — we use a
    // filled band here instead because color-mix isn't available in canvas
    // and stroking a rectangle inside the panel would look noisier than a
    // simple solid bar.
    const blockX = x + 16;
    const blockW = panelWidth - 32;
    ctx.fillStyle = NAVY_700;
    drawRoundRect(ctx, blockX, py, blockW, BANNER_HEADER_HEIGHT, 4);
    ctx.fill();
    // Banner name — uppercase to match the live dashboard's
    // tracking-[0.15em] uppercase label. Accent-colored so the banner is
    // identifiable at a glance.
    ctx.font = "bold 11px Outfit, sans-serif";
    ctx.fillStyle = accent;
    // y offset within the 24px header band: +16 gets the baseline visually
    // centered for 11px text (band top is now at py, not py-4).
    ctx.fillText(banner.toUpperCase(), blockX + 8, py + 16);
    py += BANNER_HEADER_HEIGHT + BANNER_POST_HEADER_GAP;

    // Stat rows — slightly tighter than the main panel rows so a 3-banner
    // block fits within the canvas height budget without dwarfing the
    // existing summary content.
    const drawBannerRow = (label: string, value: string) => {
      ctx.font = "12px Outfit, sans-serif";
      ctx.fillStyle = GRAY;
      ctx.fillText(label, x + 16, py);
      ctx.fillStyle = WHITE;
      ctx.textAlign = "right";
      ctx.fillText(value, x + panelWidth - 16, py);
      ctx.textAlign = "left";
      py += BANNER_ROW_HEIGHT;
    };

    // Match the live dashboard's value formatting exactly so screenshots and
    // on-screen view stay in sync.
    drawBannerRow("Pulls", stats.totalPulls.toLocaleString());
    drawBannerRow("Gems", stats.gemsSpent.toLocaleString());
    drawBannerRow("Epics", stats.epicsFound.toLocaleString());
    drawBannerRow("Rate", `${stats.epicRate.toFixed(2)}%`);

    // Spacer between banner blocks — keeps them visually distinct without
    // needing a divider line.
    py += BANNER_BLOCK_SPACER;
  }
}
