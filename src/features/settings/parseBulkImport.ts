import { v4 as uuidv4 } from "uuid";
import { MODULES } from "../../config/modules";
import type { PullRecord } from "../../types";

/**
 * Build a lookup map from lowercase module name to module id.
 * Includes common misspellings/variations.
 */
function buildNameMap(): Map<string, string> {
  const map = new Map<string, string>();
  for (const m of MODULES) {
    map.set(m.name.toLowerCase(), m.id);
  }
  // Common variations
  map.set("black hole digester", "black-hole-digestor");
  return map;
}

const NAME_MAP = buildNameMap();

function findModuleId(name: string): string | null {
  const cleaned = name.trim().toLowerCase();
  if (!cleaned) return null;

  // Exact match
  const exact = NAME_MAP.get(cleaned);
  if (exact) return exact;

  // Fuzzy: find best match by checking if the input is a substring or vice versa
  for (const [key, id] of NAME_MAP) {
    if (key.includes(cleaned) || cleaned.includes(key)) return id;
  }

  return null;
}

function parseDate(dateStr: string): string {
  // Handle M/D/YYYY format → YYYY-MM-DD
  const parts = dateStr.trim().split("/");
  if (parts.length === 3) {
    const month = parts[0].padStart(2, "0");
    const day = parts[1].padStart(2, "0");
    const year = parts[2];
    return `${year}-${month}-${day}`;
  }
  // Already ISO format
  return dateStr.trim();
}

export interface BulkImportResult {
  pulls: PullRecord[];
  errors: string[];
  correctedNames: { line: number; from: string; to: string }[];
}

export function parseBulkImport(text: string): BulkImportResult {
  const lines = text.trim().split("\n").filter((l) => l.trim());
  const pulls: PullRecord[] = [];
  const errors: string[] = [];
  const correctedNames: { line: number; from: string; to: string }[] = [];

  for (let i = 0; i < lines.length; i++) {
    const lineNum = i + 1;
    const parts = lines[i].split("\t").map((s) => s.trim());

    if (parts.length < 3) {
      errors.push(`Line ${lineNum}: not enough columns (need at least date, common, rare)`);
      continue;
    }

    const date = parseDate(parts[0]);
    const commonCount = parseInt(parts[1], 10);
    const rareCount = parseInt(parts[2], 10);

    if (isNaN(commonCount) || isNaN(rareCount)) {
      errors.push(`Line ${lineNum}: invalid common/rare count`);
      continue;
    }

    const epicModuleNames = parts.slice(4).filter((s) => s.length > 0);

    // Resolve module names to IDs
    const epicModules: string[] = [];
    let lineHasError = false;

    for (const name of epicModuleNames) {
      const moduleId = findModuleId(name);
      if (moduleId) {
        epicModules.push(moduleId);
        // Check if name was corrected
        const moduleDef = MODULES.find((m) => m.id === moduleId);
        if (moduleDef && moduleDef.name.toLowerCase() !== name.toLowerCase()) {
          correctedNames.push({ line: lineNum, from: name, to: moduleDef.name });
        }
      } else {
        errors.push(`Line ${lineNum}: unknown module "${name}"`);
        lineHasError = true;
      }
    }

    if (lineHasError) continue;

    if (commonCount + rareCount + epicModules.length > 10) {
      errors.push(`Line ${lineNum}: common (${commonCount}) + rare (${rareCount}) + epic (${epicModules.length}) > 10`);
      continue;
    }

    pulls.push({
      id: uuidv4(),
      date,
      commonCount,
      rareCount,
      epicModules,
      gemsSpent: 200,
      bannerType: "standard",
    });
  }

  return { pulls, errors, correctedNames };
}
