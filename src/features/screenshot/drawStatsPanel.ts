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

  // Layout constants — keep in sync with the helpers and draw sequence below
  const TOP_PADDING = 24;
  const BOTTOM_PADDING = 16;
  const TITLE_HEIGHT = 28;
  const ROW_HEIGHT = 24;
  const DIVIDER_HEIGHT = 20; // 4 above the line + 16 below
  const PIE_SECTION_HEIGHT = 8 + PIE_RADIUS * 2 + 8;

  // Draw sequence: title, 6 stat/rarity rows, 4 dividers, pie section
  const STAT_ROWS = 6; // Gems Spent, Total Pulls, Common, Rare, Epic, Gems/Epic
  const DIVIDERS = 4;
  const panelHeight =
    TOP_PADDING +
    TITLE_HEIGHT +
    STAT_ROWS * ROW_HEIGHT +
    DIVIDERS * DIVIDER_HEIGHT +
    PIE_SECTION_HEIGHT +
    BOTTOM_PADDING;

  // Panel background
  ctx.fillStyle = NAVY_800;
  drawRoundRect(ctx, x, y, panelWidth, panelHeight, 6);
  ctx.fill();

  ctx.strokeStyle = NAVY_600;
  ctx.lineWidth = 1;
  drawRoundRect(ctx, x, y, panelWidth, panelHeight, 6);
  ctx.stroke();

  let py = y + TOP_PADDING;

  const drawDivider = () => {
    py += 4;
    ctx.strokeStyle = NAVY_600;
    ctx.beginPath();
    ctx.moveTo(x + 16, py);
    ctx.lineTo(x + panelWidth - 16, py);
    ctx.stroke();
    py += 16;
  };

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

  // Title
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

  // Pie chart
  py += 8;
  const pieCx = x + panelWidth / 2;
  const pieCy = py + PIE_RADIUS;
  const total =
    data.stats.commonCount + data.stats.rareCount + data.stats.epicCount;

  if (total > 0) {
    const slices = [
      { pct: data.stats.commonCount / total, color: RARITY_COLORS.common },
      { pct: data.stats.rareCount / total, color: RARITY_COLORS.rare },
      { pct: data.stats.epicCount / total, color: RARITY_COLORS.epic },
    ];
    let angle = -Math.PI / 2;
    for (const slice of slices) {
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
    ctx.beginPath();
    ctx.arc(pieCx, pieCy, PIE_RADIUS, 0, Math.PI * 2);
    ctx.fillStyle = NAVY_600;
    ctx.fill();
  }

  py += PIE_RADIUS * 2 + 8;

  drawDivider();

  // Gems/Epic
  drawStatRow(
    "Gems/Epic",
    data.stats.gemsPerEpic > 0
      ? Math.round(data.stats.gemsPerEpic).toLocaleString()
      : "-",
    GOLD,
  );
}
