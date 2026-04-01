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
  const PIE_SECTION_HEIGHT = PIE_RADIUS * 2 + 24;
  const panelHeight = 260 + PIE_SECTION_HEIGHT;

  // Panel background
  ctx.fillStyle = NAVY_800;
  drawRoundRect(ctx, x, y, panelWidth, panelHeight, 6);
  ctx.fill();

  ctx.strokeStyle = NAVY_600;
  ctx.lineWidth = 1;
  drawRoundRect(ctx, x, y, panelWidth, panelHeight, 6);
  ctx.stroke();

  let py = y + 24;

  // Title
  ctx.font = "bold 14px Outfit, sans-serif";
  ctx.fillStyle = GOLD;
  ctx.fillText("Summary", x + 16, py);
  py += 28;

  // Rarity rows
  const rarityRows = [
    {
      label: "Common",
      count: data.stats.commonCount,
      pct: data.stats.commonPct,
      color: RARITY_COLORS.common,
    },
    {
      label: "Rare",
      count: data.stats.rareCount,
      pct: data.stats.rarePct,
      color: RARITY_COLORS.rare,
    },
    {
      label: "Epic",
      count: data.stats.epicCount,
      pct: data.stats.epicPct,
      color: RARITY_COLORS.epic,
    },
  ];

  for (const row of rarityRows) {
    ctx.font = "13px Outfit, sans-serif";
    ctx.fillStyle = row.color;
    ctx.fillText(row.label, x + 16, py);

    ctx.fillStyle = WHITE;
    ctx.textAlign = "right";
    ctx.fillText(
      `${row.count.toLocaleString()}  (${row.pct.toFixed(1)}%)`,
      x + panelWidth - 16,
      py,
    );
    ctx.textAlign = "left";
    py += 24;
  }

  // Pie chart
  py += 8;
  const pieCx = x + panelWidth / 2;
  const pieCy = py + PIE_RADIUS;
  const total = data.stats.commonCount + data.stats.rareCount + data.stats.epicCount;

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

  py += PIE_RADIUS * 2 + 16;

  // Separator
  py += 4;
  ctx.strokeStyle = NAVY_600;
  ctx.beginPath();
  ctx.moveTo(x + 16, py);
  ctx.lineTo(x + panelWidth - 16, py);
  ctx.stroke();
  py += 16;

  // Total Pulls
  ctx.font = "13px Outfit, sans-serif";
  ctx.fillStyle = GRAY;
  ctx.fillText("Total Pulls", x + 16, py);
  ctx.fillStyle = WHITE;
  ctx.textAlign = "right";
  ctx.fillText(data.stats.totalPulls.toLocaleString(), x + panelWidth - 16, py);
  ctx.textAlign = "left";
  py += 24;

  // Gems Spent
  ctx.fillStyle = GRAY;
  ctx.fillText("Gems Spent", x + 16, py);
  ctx.fillStyle = WHITE;
  ctx.textAlign = "right";
  ctx.fillText(
    data.stats.gemsSpent.toLocaleString(),
    x + panelWidth - 16,
    py,
  );
  ctx.textAlign = "left";
  py += 24;

  // Gems/Epic
  ctx.fillStyle = GRAY;
  ctx.fillText("Gems/Epic", x + 16, py);
  ctx.fillStyle = GOLD;
  ctx.textAlign = "right";
  ctx.fillText(
    data.stats.gemsPerEpic > 0
      ? Math.round(data.stats.gemsPerEpic).toLocaleString()
      : "-",
    x + panelWidth - 16,
    py,
  );
  ctx.textAlign = "left";
}
