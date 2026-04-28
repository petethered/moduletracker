/**
 * parseBulkImport — converts a tab-separated text blob into a list of PullRecord.
 *
 * Role in the broader feature:
 *   Backs the Settings → Bulk Import textarea. Lets users paste many days of pull data
 *   at once (typically copied from a Google Sheets / Excel column) instead of entering
 *   pulls one-by-one through the Add Pull modal. Also produces a "corrected names"
 *   report so users can verify auto-corrections.
 *
 * Input format expected (per line, tab-separated):
 *   <date>\t<commonCount>\t<rareCount>\t<rerollCount>\t<epicModuleName1>\t<epicModuleName2>...
 *
 *   - <date>: M/D/YYYY (Sheets default for the U.S. locale) OR ISO YYYY-MM-DD.
 *   - <commonCount>, <rareCount>: integer counts of common/rare drops in the pull.
 *   - parts[3] is the reroll/spare column — currently IGNORED (sliced past). Kept in
 *     the format because users' source spreadsheets include it. Removing the column
 *     would break paste-compatibility with existing sheets.
 *   - epicModuleNames: zero or more module names; matched against MODULES_BY_TYPE
 *     (case-insensitive, with substring fuzzing as a fallback).
 *
 * Validation rules:
 *   - At least 3 columns required (date, common, rare). Fewer → line skipped with error.
 *   - Common and rare must parse as integers. NaN → line skipped.
 *   - Each epic module name must resolve to a known module id. Unknown → line skipped
 *     and the error includes the raw name so the user can fix it in their source.
 *   - common + rare + epics MUST be ≤ 10 (game-imposed pull limit per draw). Over →
 *     line skipped with error showing the actual numbers.
 *   - We do NOT short-circuit on first error: every line is processed so the user gets
 *     ALL errors at once. But if ANY line errors, the caller (SettingsPanel) imports
 *     NOTHING — see SettingsPanel.handleBulkImport for that "all-or-nothing" policy.
 *
 * Why this structure (line-by-line, accumulate errors):
 *   The earliest version aborted on first error, but that meant users had to fix-and-retry
 *   over and over. Returning all errors at once dramatically improved UX for users
 *   bulk-importing many months of historical data. The all-or-nothing import policy lives
 *   one layer up in SettingsPanel for the same reason — silent partial imports were
 *   confusing.
 *
 * Gotchas:
 *   - "Black Hole Digester" vs canonical "Black Hole Digestor" — historical typo in
 *     community sheets. We hard-code an alias in NAME_MAP so existing sheets just work.
 *   - Substring fuzzy matching is intentionally permissive ("either includes the other")
 *     to handle minor user typos like "Death Pen" → "Death Penalty". It can occasionally
 *     mis-resolve very short inputs; the corrected-names report exposes anything that
 *     was auto-corrected so users can spot bad matches.
 *   - gemsSpent defaults to 200 (cost of one pull on the standard banner). bannerType
 *     defaults to "standard". These are NOT in the input format because the bulk-import
 *     UX assumes historical standard-banner data.
 */
import { v4 as uuidv4 } from "uuid";
import { MODULES } from "../../config/modules";
import type { PullRecord } from "../../types";

/**
 * Build a lookup map from lowercase module name to module id.
 * Includes common misspellings/variations so existing community spreadsheets paste cleanly.
 */
function buildNameMap(): Map<string, string> {
  const map = new Map<string, string>();
  for (const m of MODULES) {
    map.set(m.name.toLowerCase(), m.id);
  }
  // Common variations — historical typo widely reproduced in shared spreadsheets.
  // Prefer adding to this list over changing module ids, since ids are persisted.
  map.set("black hole digester", "black-hole-digestor");
  return map;
}

// Built once at module load. The MODULES list is static config so we never need to rebuild.
const NAME_MAP = buildNameMap();

/**
 * Resolve a user-entered module name to a canonical module id.
 * Strategy (in order):
 *   1. Exact lowercase match against NAME_MAP (handles canonical names + the alias above).
 *   2. Substring fuzzy match — either direction (input contains key OR key contains input).
 *      This catches truncated or partially-typed names. Returns the FIRST match found
 *      while iterating Map insertion order; that's deterministic but not "best match" —
 *      see the gotcha note in the file docblock.
 *   3. Return null → caller emits an "unknown module" error.
 */
function findModuleId(name: string): string | null {
  const cleaned = name.trim().toLowerCase();
  if (!cleaned) return null;

  // Exact match
  const exact = NAME_MAP.get(cleaned);
  if (exact) return exact;

  // Fuzzy: find best match by checking if the input is a substring or vice versa.
  // Bidirectional check covers both "Death Pen" (input ⊂ key) and "Death Penalty Plus"
  // (key ⊂ input) variants seen in community sheets.
  for (const [key, id] of NAME_MAP) {
    if (key.includes(cleaned) || cleaned.includes(key)) return id;
  }

  return null;
}

/**
 * Normalize a date string to ISO (YYYY-MM-DD).
 *
 * Accepts:
 *   - "M/D/YYYY" or "MM/DD/YYYY" (US-style — Sheets default in en-US locale)
 *   - Already-ISO "YYYY-MM-DD" (passed through after trim)
 *
 * Does NOT validate — invalid dates pass through and become date strings the rest of
 * the app must tolerate. Validation happens implicitly when the date is later parsed.
 * This is by design: keeping the parser permissive lets us roundtrip exported data.
 */
function parseDate(dateStr: string): string {
  // Handle M/D/YYYY format → YYYY-MM-DD. padStart handles single-digit month/day.
  const parts = dateStr.trim().split("/");
  if (parts.length === 3) {
    const month = parts[0].padStart(2, "0");
    const day = parts[1].padStart(2, "0");
    const year = parts[2];
    return `${year}-${month}-${day}`;
  }
  // Already ISO format (or unrecognized — pass through).
  return dateStr.trim();
}

/** Result envelope returned by parseBulkImport. */
export interface BulkImportResult {
  // Successfully parsed pulls. NOTE: caller must still decide whether to import these
  // — the convention in SettingsPanel is "all-or-nothing" if errors.length > 0.
  pulls: PullRecord[];
  // One human-readable string per problem found. Reported as a list to the user.
  errors: string[];
  // Auto-corrections applied (e.g. "Death Pen" → "Death Penalty"). Surfaced so users
  // can sanity-check the parser didn't pick the wrong module.
  correctedNames: { line: number; from: string; to: string }[];
}

export function parseBulkImport(text: string): BulkImportResult {
  // Split on newline and drop blank lines so trailing newlines / paragraph spacing
  // in the textarea don't create false "missing columns" errors.
  const lines = text.trim().split("\n").filter((l) => l.trim());
  const pulls: PullRecord[] = [];
  const errors: string[] = [];
  const correctedNames: { line: number; from: string; to: string }[] = [];

  for (let i = 0; i < lines.length; i++) {
    // Line numbers in error messages are 1-indexed because that's what the user sees
    // in their source spreadsheet/text.
    const lineNum = i + 1;
    const parts = lines[i].split("\t").map((s) => s.trim());

    // Minimum schema: date, common, rare. Even pulls with no epics need these three.
    if (parts.length < 3) {
      errors.push(`Line ${lineNum}: not enough columns (need at least date, common, rare)`);
      continue;
    }

    const date = parseDate(parts[0]);
    const commonCount = parseInt(parts[1], 10);
    const rareCount = parseInt(parts[2], 10);

    // parseInt returns NaN for non-numeric input. Catch this explicitly because NaN
    // would otherwise propagate into the persisted PullRecord and break selectors.
    if (isNaN(commonCount) || isNaN(rareCount)) {
      errors.push(`Line ${lineNum}: invalid common/rare count`);
      continue;
    }

    // parts[3] is intentionally skipped — it's the reroll/spare column kept for
    // compatibility with community spreadsheets but not part of our pull schema.
    // Filter out empty trailing tabs so spreadsheets with sparse epic columns parse cleanly.
    const epicModuleNames = parts.slice(4).filter((s) => s.length > 0);

    // Resolve module names to IDs
    const epicModules: string[] = [];
    let lineHasError = false;

    for (const name of epicModuleNames) {
      const moduleId = findModuleId(name);
      if (moduleId) {
        epicModules.push(moduleId);
        // Check if name was corrected — i.e. the user's input differed from the
        // canonical module name. Report so they can verify the auto-correction is right.
        const moduleDef = MODULES.find((m) => m.id === moduleId);
        if (moduleDef && moduleDef.name.toLowerCase() !== name.toLowerCase()) {
          correctedNames.push({ line: lineNum, from: name, to: moduleDef.name });
        }
      } else {
        errors.push(`Line ${lineNum}: unknown module "${name}"`);
        lineHasError = true;
      }
    }

    // Skip emitting a pull for a line that had any unknown module name, but DON'T
    // break the loop — keep parsing so the user gets all errors at once.
    if (lineHasError) continue;

    // Game rule: a single pull is at most 10 items total. A line that violates this
    // is almost certainly a data-entry error in the user's source. Surface the actual
    // counts in the message so they can find the row quickly.
    if (commonCount + rareCount + epicModules.length > 10) {
      errors.push(`Line ${lineNum}: common (${commonCount}) + rare (${rareCount}) + epic (${epicModules.length}) > 10`);
      continue;
    }

    pulls.push({
      // Fresh UUID per pull — bulk import never reuses ids; each line becomes a new record.
      id: uuidv4(),
      date,
      commonCount,
      rareCount,
      epicModules,
      // Bulk import is meant for historical "standard banner" data. If we ever support
      // event banners here, these defaults need to come from another column.
      gemsSpent: 200,
      bannerType: "standard",
    });
  }

  return { pulls, errors, correctedNames };
}
