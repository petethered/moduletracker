/**
 * generateScreenshot — produces a PNG Blob of the user's stats for sharing.
 *
 * Role in the broader feature:
 *   The renderer half of the screenshot feature. Takes pre-aggregated `ScreenshotData`
 *   (from screenshotData.ts) and paints a complete shareable image: header, modules
 *   table grouped by type, and the summary panel (delegated to drawStatsPanel).
 *   The result is returned as a Blob so the caller (ScreenshotButton) can download it.
 *
 * Canvas dimensions / draw order:
 *   logical width  = PADDING + TABLE_WIDTH + GAP + STATS_WIDTH + PADDING (= 920)
 *   logical height = computed dynamically based on number of sections + total rows
 *   actual pixel canvas = logical * devicePixelRatio (HiDPI-aware)
 *
 *   Draw order (top to bottom, left to right):
 *     1. Solid NAVY_900 background fill
 *     2. Title "ModuleTracker.com" (gold, Cinzel) + generated-at date (right-aligned)
 *     3. Column header row ("MODULE / COPIES / RARITY / % OF PULLS / LAST PULLED")
 *     4. Horizontal divider under headers
 *     5. For each section:
 *        a. Section header band (NAVY_800 fill, gold label, totals on the right)
 *        b. Module rows (alternating tinted background, name/copies/rarity/%/last)
 *     6. Stats panel on the right (delegated to drawStatsPanel)
 *     7. Outer 2px border around the whole canvas
 *
 * Font / color choices:
 *   - "Cinzel, serif" for the title — matches the brand display font (--font-display).
 *     We can't use CSS vars in canvas; the font name itself must be passed and the
 *     font has to be loaded. We `await document.fonts.ready` before drawing — without
 *     this, the title falls back to Times and the screenshot looks unbranded.
 *   - "Outfit, sans-serif" for body — matches the app's body font.
 *   - All colors come from canvasConstants.ts; see that file for palette rationale.
 *
 * Image-export quirks:
 *   - DPR scaling: we set canvas.width = logical * dpr and ctx.scale(dpr, dpr) so all
 *     subsequent draw calls work in logical coordinates while output is high-res.
 *   - `canvas.toBlob` is async and can fail (e.g. tainted canvas, OOM). We reject with
 *     a clear error message rather than returning null/undefined.
 *   - Section headers reuse `t-align: center` for COPIES/% columns; we always reset to
 *     "left" after each centered draw because canvas state is global.
 *   - Alternating row tint uses NAVY_800 + "40" (25% alpha hex). It's deliberately
 *     subtle so the rarity colors in module names still pop.
 *   - The `!` after `getContext("2d")` is intentional — we constructed the canvas
 *     ourselves so 2d context is guaranteed available; null only occurs in headless
 *     environments we don't support for screenshot generation.
 */
import { getModuleRarityColor } from "../../config/rarityColors";
import type { ScreenshotData } from "./screenshotData";
import { drawStatsPanel } from "./drawStatsPanel";
import {
  NAVY_900,
  NAVY_800,
  NAVY_600,
  GOLD,
  WHITE,
  GRAY,
  DARK_GRAY,
  ROW_HEIGHT,
  HEADER_HEIGHT,
  SECTION_HEADER_HEIGHT,
  COL_HEADER_HEIGHT,
  PADDING,
  TABLE_WIDTH,
  STATS_WIDTH,
  GAP,
  COL_NAME,
  COL_COPIES,
  COL_RARITY,
  COL_PCT,
  COL_LAST_PULLED,
} from "./canvasConstants";

/**
 * Compute the total logical canvas height needed to fit:
 *   top padding + title block + column header + (one band per section) +
 *   (one row per module across all sections) + bottom padding
 *
 * IMPORTANT: this only sizes the LEFT (table) side. The stats panel on the right is
 * shorter than the table in typical use, so the table's height drives total canvas
 * height. If the panel ever grows beyond the table, swap to Math.max(panelHeight, this).
 */
function computeCanvasHeight(data: ScreenshotData): number {
  const moduleRows = data.sections.reduce(
    (sum, s) => sum + s.modules.length,
    0,
  );
  const sectionHeaders = data.sections.length;
  return (
    PADDING +
    HEADER_HEIGHT +
    COL_HEADER_HEIGHT +
    sectionHeaders * SECTION_HEADER_HEIGHT +
    moduleRows * ROW_HEIGHT +
    PADDING
  );
}

export async function generateScreenshotImage(
  data: ScreenshotData,
): Promise<Blob> {
  // Wait for web fonts to load before drawing — otherwise canvas falls back to system
  // fonts and the brand title (Cinzel) and body text (Outfit) won't render correctly.
  // The `typeof` guard keeps this safe for SSR / test environments without document.fonts.
  if (typeof document !== "undefined" && document.fonts) {
    await document.fonts.ready;
  }

  // Device pixel ratio handling: we draw in logical units, but the canvas's pixel
  // buffer is logical * dpr so retina screens get a sharp 2x/3x image. Default to 1
  // for headless/Node-like environments.
  const dpr = typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1;
  const logicalWidth = PADDING + TABLE_WIDTH + GAP + STATS_WIDTH + PADDING;
  const logicalHeight = computeCanvasHeight(data);

  const canvas = document.createElement("canvas");
  // Pixel buffer dims (the canvas's internal raster).
  canvas.width = logicalWidth * dpr;
  canvas.height = logicalHeight * dpr;

  // The `!` is safe because we just created the canvas; getContext('2d') only returns
  // null on canvases created in environments without 2D support, which we don't target.
  const ctx = canvas.getContext("2d")!;
  // From here on every draw call uses LOGICAL coordinates; canvas multiplies by dpr.
  ctx.scale(dpr, dpr);

  // Background — solid navy fill matching the app's page background.
  ctx.fillStyle = NAVY_900;
  ctx.fillRect(0, 0, logicalWidth, logicalHeight);

  // `y` is the running vertical cursor. Starts at PADDING (top inset).
  let y = PADDING;

  // Title — gold Cinzel matches the in-app brand. y + 24 puts the baseline at a
  // visually balanced position within the HEADER_HEIGHT band.
  ctx.font = "bold 20px Cinzel, serif";
  ctx.fillStyle = GOLD;
  ctx.fillText("ModuleTracker.com", PADDING, y + 24);

  // Generated-at date — right-aligned to the table's right edge so it acts as a
  // header counterpart to the title. Using DARK_GRAY downplays it as metadata.
  ctx.font = "12px Outfit, sans-serif";
  ctx.fillStyle = DARK_GRAY;
  ctx.textAlign = "right";
  ctx.fillText(data.generatedAt, PADDING + TABLE_WIDTH, y + 24);
  // Always reset textAlign — canvas state is global and downstream code expects "left".
  ctx.textAlign = "left";

  y += HEADER_HEIGHT;

  // Column headers — uppercase + small + gray to read as headers, not data.
  // The +20 / +30 offsets center the COPIES / % headers over the centered values
  // drawn in the row body. Hand-tuned; revisit if you change column widths.
  ctx.font = "bold 11px Outfit, sans-serif";
  ctx.fillStyle = GRAY;
  const headerY = y + 18;
  ctx.fillText("MODULE", PADDING + COL_NAME, headerY);
  ctx.textAlign = "center";
  ctx.fillText("COPIES", PADDING + COL_COPIES + 20, headerY);
  ctx.textAlign = "left";
  ctx.fillText("RARITY", PADDING + COL_RARITY, headerY);
  ctx.textAlign = "center";
  ctx.fillText("% OF PULLS", PADDING + COL_PCT + 30, headerY);
  ctx.textAlign = "left";
  ctx.fillText("LAST PULLED", PADDING + COL_LAST_PULLED, headerY);

  y += COL_HEADER_HEIGHT;

  // Divider under headers — separates header band from data rows.
  ctx.strokeStyle = NAVY_600;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(PADDING, y);
  ctx.lineTo(PADDING + TABLE_WIDTH, y);
  ctx.stroke();

  // Sections (CANNON / ARMOR / GENERATOR / CORE) and their child module rows.
  // Order is determined by screenshotData.ts.
  for (const section of data.sections) {
    // Section header band — solid NAVY_800 fill spanning the full table width.
    // This visually breaks up the table and groups modules of the same type.
    ctx.fillStyle = NAVY_800;
    ctx.fillRect(PADDING, y, TABLE_WIDTH, SECTION_HEADER_HEIGHT);

    // Section label (e.g. "CANNON") in gold to match the in-app section headers.
    // y + 21 is the baseline for 12px text within a 32px band — visually centered.
    ctx.font = "bold 12px Outfit, sans-serif";
    ctx.fillStyle = GOLD;
    ctx.fillText(section.label, PADDING + 8, y + 21);

    // Section totals: total copies across all modules in this section.
    ctx.textAlign = "center";
    ctx.fillText(String(section.totalCopies), PADDING + COL_COPIES + 20, y + 21);
    ctx.textAlign = "left";

    // Section % of pulls. Show "-" instead of "0.0%" when there's no data so empty
    // sections don't look broken.
    ctx.textAlign = "center";
    ctx.fillText(
      section.pctOfPulls > 0 ? `${section.pctOfPulls.toFixed(1)}%` : "-",
      PADDING + COL_PCT + 30,
      y + 21,
    );
    ctx.textAlign = "left";

    // Section "last pulled" — most recent date among any module in this section.
    ctx.fillText(section.lastPulled ?? "-", PADDING + COL_LAST_PULLED, y + 21);

    y += SECTION_HEADER_HEIGHT;

    // Per-module rows within this section.
    for (let i = 0; i < section.modules.length; i++) {
      const mod = section.modules[i];

      // Alternating row tint for readability. NAVY_800 + "40" appends 25% alpha (hex).
      // Keep the tint subtle so rarity colors and white text still stand out.
      if (i % 2 === 1) {
        ctx.fillStyle = NAVY_800 + "40"; // semi-transparent
        ctx.fillRect(PADDING, y, TABLE_WIDTH, ROW_HEIGHT);
      }

      // Baseline for 13px body text within a 28px row — visually centered.
      const rowY = y + 19;

      // Module name — 16px indent so names sit visually inside the section band.
      ctx.font = "13px Outfit, sans-serif";
      ctx.fillStyle = WHITE;
      ctx.textAlign = "left";
      ctx.fillText(mod.name, PADDING + COL_NAME + 16, rowY);

      // Copies — DARK_GRAY when zero so unowned modules read as muted.
      ctx.textAlign = "center";
      ctx.fillStyle = mod.copies > 0 ? WHITE : DARK_GRAY;
      ctx.fillText(String(mod.copies), PADDING + COL_COPIES + 20, rowY);
      ctx.textAlign = "left";

      // Rarity label — colored per rarity (epic=purple, legendary=gold, etc.) for
      // quick scan-ability. "-" for modules the user has never pulled.
      if (mod.currentRarity) {
        ctx.fillStyle = getModuleRarityColor(mod.currentRarity);
        ctx.font = "12px Outfit, sans-serif";
        ctx.fillText(mod.currentRarity, PADDING + COL_RARITY, rowY);
      } else {
        ctx.fillStyle = DARK_GRAY;
        ctx.font = "12px Outfit, sans-serif";
        ctx.fillText("-", PADDING + COL_RARITY, rowY);
      }

      // % of pulls — same "-" treatment as section row when zero.
      ctx.font = "12px Outfit, sans-serif";
      ctx.fillStyle = mod.pctOfPulls > 0 ? WHITE : DARK_GRAY;
      ctx.textAlign = "center";
      ctx.fillText(
        mod.pctOfPulls > 0 ? `${mod.pctOfPulls.toFixed(1)}%` : "-",
        PADDING + COL_PCT + 30,
        rowY,
      );
      ctx.textAlign = "left";

      // Last pulled — GRAY when present, DARK_GRAY when absent. The two-tone
      // approach lets you spot stale modules quickly without color coding by date.
      ctx.fillStyle = mod.lastPulled ? GRAY : DARK_GRAY;
      ctx.font = "12px Outfit, sans-serif";
      ctx.fillText(mod.lastPulled ?? "-", PADDING + COL_LAST_PULLED, rowY);

      y += ROW_HEIGHT;
    }
  }

  // Stats panel sits to the right of the table, vertically aligned with the column
  // header band (PADDING + HEADER_HEIGHT) so its title lines up with "MODULE".
  drawStatsPanel(ctx, data, PADDING + TABLE_WIDTH + GAP, PADDING + HEADER_HEIGHT);

  // Outer 2px border around the whole canvas. Inset by 1px on each side because
  // strokeRect strokes ON the path, half inside / half outside — at 1,1 the inner
  // edge of the stroke lands at 0,0 and we don't lose pixels off the canvas.
  ctx.strokeStyle = NAVY_600;
  ctx.lineWidth = 2;
  ctx.strokeRect(1, 1, logicalWidth - 2, logicalHeight - 2);

  // Convert the canvas to a PNG Blob. toBlob is async (via callback) so we wrap in a
  // Promise. If the browser fails (rare; usually OOM or tainted canvas) reject with
  // a clear error so ScreenshotButton can show a user-facing message.
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) {
        resolve(blob);
      } else {
        reject(new Error("Failed to generate screenshot image"));
      }
    }, "image/png");
  });
}
