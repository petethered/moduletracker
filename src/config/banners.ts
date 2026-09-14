/**
 * Banner display labels — single source for player-facing banner names.
 *
 * ROLE:
 *   The persisted BannerType values ("standard" | "featured" | "lucky") are
 *   lowercase ids. This maps them to the names players see. Consumers:
 *     - PullForm's banner <select> (options are rendered FROM this map, so
 *       adding a banner here is enough for it to appear in the form)
 *     - savedPullSummary (the Save & Continue toast)
 *
 * ORDERING:
 *   Object key order is the <select> option order. It matches the canonical
 *   order also hardcoded as BANNER_ORDER (BannerStatsBreakdown.tsx) and
 *   BANNER_DISPLAY_ORDER (drawStatsPanel.ts). Those two predate this file and
 *   were left alone; if you touch them, consolidate them here.
 *
 * NOT USED BY: PullHistoryTable (CSS `capitalize`), BannerStatsBreakdown (raw
 *   id), the screenshot panel (toUpperCase). Those derive display text from
 *   the id directly, which happens to agree with these labels today.
 *
 * Typed as Record<BannerType, string> so a new BannerType fails to compile
 * until it gets a label here.
 */
import type { BannerType } from "../types";

export const BANNER_LABELS: Record<BannerType, string> = {
  standard: "Standard",
  featured: "Featured",
  lucky: "Lucky",
};
