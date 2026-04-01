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
  // Wait for fonts to load
  if (typeof document !== "undefined" && document.fonts) {
    await document.fonts.ready;
  }

  const dpr = typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1;
  const logicalWidth = PADDING + TABLE_WIDTH + GAP + STATS_WIDTH + PADDING;
  const logicalHeight = computeCanvasHeight(data);

  const canvas = document.createElement("canvas");
  canvas.width = logicalWidth * dpr;
  canvas.height = logicalHeight * dpr;

  const ctx = canvas.getContext("2d")!;
  ctx.scale(dpr, dpr);

  // Background
  ctx.fillStyle = NAVY_900;
  ctx.fillRect(0, 0, logicalWidth, logicalHeight);

  let y = PADDING;

  // Title
  ctx.font = "bold 20px Cinzel, serif";
  ctx.fillStyle = GOLD;
  ctx.fillText("ModuleTracker.com", PADDING, y + 24);

  ctx.font = "12px Outfit, sans-serif";
  ctx.fillStyle = DARK_GRAY;
  ctx.textAlign = "right";
  ctx.fillText(data.generatedAt, PADDING + TABLE_WIDTH, y + 24);
  ctx.textAlign = "left";

  y += HEADER_HEIGHT;

  // Column headers
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

  // Divider under headers
  ctx.strokeStyle = NAVY_600;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(PADDING, y);
  ctx.lineTo(PADDING + TABLE_WIDTH, y);
  ctx.stroke();

  // Sections and module rows
  for (const section of data.sections) {
    // Section header
    ctx.fillStyle = NAVY_800;
    ctx.fillRect(PADDING, y, TABLE_WIDTH, SECTION_HEADER_HEIGHT);

    ctx.font = "bold 12px Outfit, sans-serif";
    ctx.fillStyle = GOLD;
    ctx.fillText(section.label, PADDING + 8, y + 21);

    // Section copies total
    ctx.textAlign = "center";
    ctx.fillText(String(section.totalCopies), PADDING + COL_COPIES + 20, y + 21);
    ctx.textAlign = "left";

    // Section % of pulls
    ctx.textAlign = "center";
    ctx.fillText(
      section.pctOfPulls > 0 ? `${section.pctOfPulls.toFixed(1)}%` : "-",
      PADDING + COL_PCT + 30,
      y + 21,
    );
    ctx.textAlign = "left";

    // Section last pulled
    ctx.fillText(section.lastPulled ?? "-", PADDING + COL_LAST_PULLED, y + 21);

    y += SECTION_HEADER_HEIGHT;

    // Module rows
    for (let i = 0; i < section.modules.length; i++) {
      const mod = section.modules[i];

      // Alternating row background
      if (i % 2 === 1) {
        ctx.fillStyle = NAVY_800 + "40"; // semi-transparent
        ctx.fillRect(PADDING, y, TABLE_WIDTH, ROW_HEIGHT);
      }

      const rowY = y + 19;

      // Module name
      ctx.font = "13px Outfit, sans-serif";
      ctx.fillStyle = WHITE;
      ctx.textAlign = "left";
      ctx.fillText(mod.name, PADDING + COL_NAME + 16, rowY);

      // Copies
      ctx.textAlign = "center";
      ctx.fillStyle = mod.copies > 0 ? WHITE : DARK_GRAY;
      ctx.fillText(String(mod.copies), PADDING + COL_COPIES + 20, rowY);
      ctx.textAlign = "left";

      // Rarity
      if (mod.currentRarity) {
        ctx.fillStyle = getModuleRarityColor(mod.currentRarity);
        ctx.font = "12px Outfit, sans-serif";
        ctx.fillText(mod.currentRarity, PADDING + COL_RARITY, rowY);
      } else {
        ctx.fillStyle = DARK_GRAY;
        ctx.font = "12px Outfit, sans-serif";
        ctx.fillText("-", PADDING + COL_RARITY, rowY);
      }

      // % of pulls
      ctx.font = "12px Outfit, sans-serif";
      ctx.fillStyle = mod.pctOfPulls > 0 ? WHITE : DARK_GRAY;
      ctx.textAlign = "center";
      ctx.fillText(
        mod.pctOfPulls > 0 ? `${mod.pctOfPulls.toFixed(1)}%` : "-",
        PADDING + COL_PCT + 30,
        rowY,
      );
      ctx.textAlign = "left";

      // Last pulled
      ctx.fillStyle = mod.lastPulled ? GRAY : DARK_GRAY;
      ctx.font = "12px Outfit, sans-serif";
      ctx.fillText(mod.lastPulled ?? "-", PADDING + COL_LAST_PULLED, rowY);

      y += ROW_HEIGHT;
    }
  }

  // Stats panel
  drawStatsPanel(ctx, data, PADDING + TABLE_WIDTH + GAP, PADDING + HEADER_HEIGHT);

  // Border
  ctx.strokeStyle = NAVY_600;
  ctx.lineWidth = 2;
  ctx.strokeRect(1, 1, logicalWidth - 2, logicalHeight - 2);

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
