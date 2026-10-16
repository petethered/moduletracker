/**
 * playerInfoPulls — reads the 10x pulls out of The Tower's save
 * (playerInfo.dat) and decides which ones the tracker doesn't have yet.
 * Used by usePlayerInfoImport; the module-rarity half lives in parsePlayerInfo.ts.
 *
 * WHERE PULLS LIVE IN A SAVE (root SaveLoad+PlayerData):
 *   moduleRecords  List<ModuleRegistry>: one entry per module DROP, oldest
 *                  first. Read only the first `_size` of `_items` (spare
 *                  capacity holds nulls or stale entries, like inventory).
 *   ModuleRegistry { infoIndex, rarity: ModuleRarity{value__}, dateObtained, origin }
 *     - rarity: drops are 1 Common, 2 Rare or 4 Epic. infoIndex only matters
 *       for epics (= ModuleDefinition.gameIndex).
 *     - dateObtained: .NET DateTime ticks, UTC. Verified on a real save:
 *       lastCloudSaveTime matched the file's mtime to 0.1 s read as UTC.
 *     - origin: banner name ("Infinity Threshold Banner"). null in saves from
 *       before ~Sept 2026, and the member is GONE again from game 29.1.1
 *       (verified on a real 29.1.1 save, 2026-10-16), so those pulls can't be
 *       told apart by banner: they all import as "standard" (BANNER below).
 *   Game 29.1+ saves arrive inside an encrypted TDS1 container; that is
 *   unwrapped before this code sees anything (tds1SaveContainer.ts).
 *   It is a ROLLING WINDOW of the last 150 drops (= 15 ten-pulls): three real
 *   saves all had _size 150 while _version kept climbing. Older pulls are gone,
 *   so the import keeps the tracker current; it can't backfill history.
 *
 * GROUPING DROPS INTO TEN-PULLS: consecutive drops less than 1 s apart, capped
 * at 10. A ten-pull's drops are ~1 ms apart in current saves; separate pulls
 * are seconds apart. Older saves stamped a whole session with ONE timestamp,
 * which the cap of 10 still splits correctly. A group that isn't 10 drops
 * (the oldest pull cut off by the window) can't be a tracker pull: skipped
 * and counted.
 *
 * BANNER: "lucky" if the banner name contains "lucky" (any case), else
 * "standard" — the user's rule; they log named/featured banners as standard.
 * No banner name (old saves, and 29.1.1+) => "standard". Banner is NOT part of
 * the match signature, so a lucky pull logged by hand still matches its
 * import and is never duplicated; only NEW lucky pulls import as standard.
 * GEMS: GEMS_PER_10X_PULL (200), the same cost PullForm records.
 *
 * RECONCILING (planPullImport) — the user may already have typed some of
 * these pulls in by hand. A tracker pull stores only a DAY, not a time, so a
 * pull is identified by date + commonCount + rareCount + sorted epics.
 * Identical pulls (8 commons / 2 rares is very common) are interchangeable,
 * so matching is one-for-one and ORDER-AWARE (an LCS alignment). See planPullImport for
 * the alignment and how unmatched pulls are split into "add" and "unsure".
 */
import { GEMS_PER_10X_PULL } from "../../config/banners";
import { MODULE_BY_GAME_INDEX } from "../../config/modules";
import { GAME_RARITY } from "./parsePlayerInfo";
import type { BannerType, PullRecord } from "../../types";
import { isNrbfObject, type NrbfObject } from "../../utils/nrbfReader";
import { toDateString } from "../../utils/formatDate";

/** A ten-pull read from the save, shaped like a tracker pull (minus id). */
export interface SavePull extends Omit<PullRecord, "id"> {
  /** First drop's time, epoch ms. Orders pulls; shown for unsure ones. */
  obtainedAt: number;
  /** Banner name from the save, or null in older saves. */
  origin: string | null;
}

export interface SavePullsResult {
  /** Complete ten-pulls, oldest first. */
  pulls: SavePull[];
  /**
   * Groups that couldn't become a pull: partial (the oldest, cut off by the
   * 150-drop window) or holding an unknown epic/rarity (the epic's game number
   * is ALSO reported in unsupportedGameIndexes).
   */
  skippedPulls: number;
  /** Epic game indexes the tracker doesn't know, ascending. */
  unsupportedGameIndexes: number[];
}

export interface PullImportPlan {
  /** New pulls to append, oldest first. */
  toAdd: SavePull[];
  /** Save pulls already in the tracker. */
  alreadyLogged: number;
  /** New-looking pulls held back because a logged pull that day matched nothing. */
  unsure: SavePull[];
}

const PULL_SIZE = 10;
const SAME_PULL_MAX_GAP_MS = 1000;
/** .NET ticks at 1970-01-01; ticks are 100 ns, so ms = (ticks - this) / 10_000. */
const TICKS_AT_UNIX_EPOCH = 621355968000000000n;
/** BinaryFormatter packs DateTime.Kind into the top 2 bits of the tick count. */
const TICKS_MASK = 0x3fffffffffffffffn;

interface Drop {
  infoIndex: number;
  rarity: number;
  /** Epoch ms; same meaning as SavePull.obtainedAt. */
  obtainedAt: number;
  origin: string | null;
}

function readDrops(root: NrbfObject): Drop[] {
  const records = root.members.moduleRecords;
  if (!isNrbfObject(records) || !Array.isArray(records.members._items)) return [];
  const size = typeof records.members._size === "number" ? records.members._size : 0;
  const drops: Drop[] = [];
  for (const item of records.members._items.slice(0, size)) {
    if (!isNrbfObject(item)) continue;
    const { infoIndex, rarity, dateObtained, origin } = item.members;
    const value = isNrbfObject(rarity) ? rarity.members.value__ : undefined;
    // int64 comes back as bigint; accept a number too in case the reader changes.
    const ticks = typeof dateObtained === "bigint" ? dateObtained : typeof dateObtained === "number" ? BigInt(dateObtained) : null;
    if (typeof infoIndex !== "number" || typeof value !== "number" || ticks === null) continue;
    drops.push({
      infoIndex,
      rarity: value,
      obtainedAt: Number(((ticks & TICKS_MASK) - TICKS_AT_UNIX_EPOCH) / 10_000n),
      origin: typeof origin === "string" ? origin : null,
    });
  }
  // The game appends in time order; sort anyway (stable) so grouping can rely on it.
  return drops.sort((a, b) => a.obtainedAt - b.obtainedAt);
}

const bannerTypeForOrigin = (origin: string | null): BannerType =>
  origin && /lucky/i.test(origin) ? "lucky" : "standard";

/** Read the save's ten-pulls (see the file header for every rule). */
export function extractSavePulls(root: NrbfObject): SavePullsResult {
  const groups: Drop[][] = [];
  for (const d of readDrops(root)) {
    const g = groups[groups.length - 1];
    if (g && g.length < PULL_SIZE && d.obtainedAt - g[g.length - 1].obtainedAt < SAME_PULL_MAX_GAP_MS) g.push(d);
    else groups.push([d]);
  }

  const pulls: SavePull[] = [];
  const unsupported = new Set<number>();
  let skippedPulls = 0;
  for (const g of groups) {
    let commonCount = 0;
    let rareCount = 0;
    const epicModules: string[] = [];
    let ok = g.length === PULL_SIZE;
    for (const d of g) {
      if (d.rarity === GAME_RARITY.common) commonCount++;
      else if (d.rarity === GAME_RARITY.rare) rareCount++;
      else if (d.rarity === GAME_RARITY.epic && MODULE_BY_GAME_INDEX.has(d.infoIndex)) {
        epicModules.push(MODULE_BY_GAME_INDEX.get(d.infoIndex)!.id);
      } else {
        // An epic the roster lacks (report it so a dev can add it) or a rarity
        // drops never have. Either way the pull can't be recorded faithfully.
        if (d.rarity === GAME_RARITY.epic) unsupported.add(d.infoIndex);
        ok = false;
      }
    }
    if (!ok) {
      skippedPulls++;
      continue;
    }
    pulls.push({
      date: toDateString(new Date(g[0].obtainedAt)), // local day, like PullForm's dates
      commonCount,
      rareCount,
      epicModules,
      gemsSpent: GEMS_PER_10X_PULL,
      bannerType: bannerTypeForOrigin(g[0].origin),
      obtainedAt: g[0].obtainedAt,
      origin: g[0].origin,
    });
  }
  return { pulls, skippedPulls, unsupportedGameIndexes: [...unsupported].sort((a, b) => a - b) };
}

const pullSignature = (p: Pick<PullRecord, "date" | "commonCount" | "rareCount" | "epicModules">) =>
  `${p.date}|${p.commonCount}|${p.rareCount}|${[...p.epicModules].sort().join(",")}`;

/**
 * Decide which save pulls to add.
 *
 * 1. ALIGN the save's pulls (oldest first) with the logged pulls on the save's
 *    days (by date, then insertion order = the order the user pulled) as a
 *    longest common subsequence of signatures (see file header). Aligned
 *    pairs = already logged. Order matters because look-alike pulls (8/2 is
 *    everywhere) are common: plain first-match paired the save's 8/2s with
 *    the day's OLDER, pre-window 8/2s and missed new pulls (real-save bug).
 *    Ties go to the user's likely story: they logged pulls in order and
 *    stopped, so unlogged save pulls are the NEWEST ones and matched logged
 *    pulls are the LATEST ones (see the backtrack).
 * 2. A logged pull that aligned with nothing is either:
 *    - pre-window: before the first aligned logged pull (or, if nothing
 *      aligned, on the window's first day). The save only keeps the last 15
 *      pulls, so earlier same-day entries legitimately match nothing; or
 *    - a LEFTOVER: likely a mistyped copy of a save pull that day.
 * 3. An unaligned save pull is ADDED, unless its day has a leftover: then
 *    adding could double count, so it goes to UNSURE and the user decides.
 *    Accepted risk: a typo before the first aligned pull reads as
 *    pre-window and can yield a duplicate, which the user can delete in History.
 */
export function planPullImport(existing: PullRecord[], save: SavePull[]): PullImportPlan {
  if (save.length === 0) return { toAdd: [], alreadyLogged: 0, unsure: [] };
  const firstDay = save[0].date;
  const windowDays = new Set(save.map((p) => p.date));

  // Stable sort keeps insertion order within a day.
  const logged = existing.filter((p) => windowDays.has(p.date)).sort((a, b) => a.date.localeCompare(b.date));
  const a = save.map(pullSignature);
  const b = logged.map(pullSignature);

  // lcs[i][j] = LCS length of a[0..i) and b[0..j). At most 15 x (a few dozen).
  const lcs = Array.from({ length: a.length + 1 }, () => new Array<number>(b.length + 1).fill(0));
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      lcs[i][j] = a[i - 1] === b[j - 1] ? lcs[i - 1][j - 1] + 1 : Math.max(lcs[i - 1][j], lcs[i][j - 1]);
    }
  }

  // Backtrack from the end. Preference order keeps the alignment optimal and
  // breaks ties toward "newest save pulls are the unlogged ones":
  //   skip the save pull if that loses nothing; else match it to the latest
  //   equal logged pull; else skip the logged pull.
  const saveMatched = new Array<boolean>(a.length).fill(false);
  const loggedMatched = new Array<boolean>(b.length).fill(false);
  for (let i = a.length, j = b.length; i > 0 && j > 0; ) {
    if (lcs[i - 1][j] === lcs[i][j]) i--;
    else if (a[i - 1] === b[j - 1]) {
      saveMatched[--i] = true;
      loggedMatched[--j] = true;
    } else j--;
  }

  const firstAligned = loggedMatched.indexOf(true);
  const daysWithLeftovers = new Set<string>();
  logged.forEach((p, j) => {
    if (loggedMatched[j]) return;
    const preWindow = firstAligned === -1 ? p.date === firstDay : j < firstAligned;
    if (!preWindow) daysWithLeftovers.add(p.date);
  });

  const plan: PullImportPlan = { toAdd: [], alreadyLogged: lcs[a.length][b.length], unsure: [] };
  save.forEach((s, i) => {
    if (!saveMatched[i]) (daysWithLeftovers.has(s.date) ? plan.unsure : plan.toAdd).push(s);
  });
  return plan;
}

/**
 * The persistable part of a SavePull. Strips the save-only fields (obtainedAt,
 * origin): `pulls` is in partialize and cloud-synced, so extra keys would ride
 * along into localStorage and the cloud forever. Rest-destructuring (not a
 * field-by-field copy) so a field later added to PullRecord isn't silently
 * dropped on import.
 */
export function savePullToPullRecord(pull: SavePull): Omit<PullRecord, "id"> {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { obtainedAt, origin, ...record } = pull;
  return record;
}
