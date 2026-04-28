/**
 * SettingsPanel — top-level Settings modal containing every "manage your data" surface.
 *
 * Role in the broader feature:
 *   The catch-all settings screen. Hosts:
 *     1. AccountSettings (cloud sync sub-panel)
 *     2. Data Management — JSON export, JSON file import, Screenshot export
 *     3. Bulk Import — paste tab-separated text OR exported JSON
 *     4. Danger Zone — Reset all data
 *
 *   Lives behind the gear icon in the app header. Open/close state is in the store
 *   (settingsOpen / closeSettings) so other features can imperatively open/close it.
 *
 * User flows supported:
 *   - Export JSON: serialize pulls + moduleProgress to a downloadable .json file with
 *     a date-stamped filename.
 *   - Import JSON file: read selected file, validate every pull record matches the
 *     expected shape, replace local pulls + (if present) moduleProgress.
 *   - Bulk Import: takes the contents of the textarea. Auto-detects whether the input
 *     is JSON (starts with { or [) or tab-separated text and routes accordingly.
 *   - Reset: clears pulls + moduleProgress after a ConfirmDialog. Destructive.
 *
 * Bulk import policy (important):
 *   ALL-OR-NOTHING. If parseBulkImport returns ANY errors we import zero pulls and show
 *   the full error list. Rationale: silently importing partial data is confusing and
 *   leaves the user with no good way to tell what was/wasn't applied. Showing all
 *   errors at once also matches how the parser is designed (it accumulates instead of
 *   short-circuiting).
 *
 * JSON validation rules (file import + JSON path of bulk import):
 *   - Top-level must have a `pulls` array. Anything else → "Invalid file: missing pulls array".
 *   - Each pull record must have: id (string), date (string), commonCount (number),
 *     rareCount (number), epicModules (array), gemsSpent (number), bannerType (string).
 *     Mismatch on ANY record → "pull records have missing or invalid fields" and
 *     nothing imports. Strict-shape checking is intentional — partially-valid imports
 *     would corrupt selectors and persistence.
 *   - moduleProgress is OPTIONAL — older exports didn't include it.
 *
 * Why two import paths:
 *   File picker is the canonical way to round-trip exports. Bulk import textarea exists
 *   so users can paste community spreadsheets directly without intermediate save-as-file.
 *   The auto-detection (JSON vs TSV) keeps the textarea ergonomic for both audiences.
 *
 * Gotchas:
 *   - We reset `e.target.value = ""` after file load so the SAME file can be re-selected
 *     immediately (browsers suppress change events for repeat-same-file otherwise).
 *   - JSON path of bulk import uses `importPulls` (replace), but TSV path uses `addPull`
 *     (append, one at a time). This is intentional: JSON is an exported snapshot meant
 *     to replace, while TSV represents a chunk of new pulls to append to history.
 *   - All errors/success states reset on textarea change to avoid stale messages.
 */
import { useRef, useState } from "react";
import { Modal } from "../../components/ui/Modal";
import { Button } from "../../components/ui/Button";
import { ConfirmDialog } from "../../components/ui/ConfirmDialog";
import { useStore } from "../../store";
import { parseBulkImport } from "./parseBulkImport";
import { getLocalDateString } from "../../utils/formatDate";
import { ScreenshotButton } from "../screenshot/ScreenshotButton";
import { AccountSettings } from "./AccountSettings";

export function SettingsPanel() {
  // Store subscriptions — a wide cross-section because this component touches
  // virtually every persisted slice. Selecting individually keeps re-renders narrow.
  const settingsOpen = useStore((s) => s.settingsOpen);
  const closeSettings = useStore((s) => s.closeSettings);
  const pulls = useStore((s) => s.pulls);
  const moduleProgress = useStore((s) => s.moduleProgress);
  const importPulls = useStore((s) => s.importPulls);            // Replace mode
  const importModuleProgress = useStore((s) => s.importModuleProgress);
  const clearPulls = useStore((s) => s.clearPulls);
  const clearModuleProgress = useStore((s) => s.clearModuleProgress);
  const addPull = useStore((s) => s.addPull);                     // Append mode

  // Hidden <input type="file"> — we trigger it programmatically via the ref so we can
  // style our own Button instead of the browser-default file picker.
  const fileInputRef = useRef<HTMLInputElement>(null);
  // Confirmation dialog for the destructive Reset action.
  const [resetConfirmOpen, setResetConfirmOpen] = useState(false);
  // Error from JSON file import (the file-picker flow). Separate from bulk-import
  // errors because each surface has its own UI affordance.
  const [importError, setImportError] = useState<string | null>(null);
  // Textarea contents + the structured result of parsing it. `count` is the number
  // of imported pulls; nonzero count + nonempty errors is impossible because the
  // bulk-import policy is all-or-nothing.
  const [bulkText, setBulkText] = useState("");
  const [bulkResult, setBulkResult] = useState<{
    count: number;
    errors: string[];
    correctedNames: { line: number; from: string; to: string }[];
  } | null>(null);

  // Export: serialize current state to JSON and trigger a download. Same anchor-click
  // pattern used by ScreenshotButton — see that component for the rationale.
  const handleExport = () => {
    // exportedAt is metadata only; it's ignored on import. Useful for users browsing
    // multiple backup files.
    const data = { pulls, moduleProgress, exportedAt: new Date().toISOString() };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `module-tracker-${getLocalDateString()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Programmatically open the file picker. The actual import happens in handleFileChange.
  const handleImport = () => {
    fileInputRef.current?.click();
  };

  // File-picker import flow. Validates strict shape, replaces local state, closes the
  // modal on success. Errors stay visible inline so the user can re-pick a different file.
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const data = JSON.parse(event.target?.result as string);
        // Top-level shape check.
        if (!data.pulls || !Array.isArray(data.pulls)) {
          setImportError("Invalid file: missing pulls array");
          return;
        }
        // Per-record shape check. Strict — every field required. Adding a new field
        // to PullRecord requires either updating this validator OR migrating older
        // exports during load. Currently we don't migrate, so old exports without
        // newer fields would fail here intentionally.
        const isValidPull = (p: unknown): boolean => {
          if (!p || typeof p !== "object") return false;
          const record = p as Record<string, unknown>;
          return (
            typeof record.id === "string" &&
            typeof record.date === "string" &&
            typeof record.commonCount === "number" &&
            typeof record.rareCount === "number" &&
            Array.isArray(record.epicModules) &&
            typeof record.gemsSpent === "number" &&
            typeof record.bannerType === "string"
          );
        };
        if (!data.pulls.every(isValidPull)) {
          setImportError("Invalid file: pull records have missing or invalid fields");
          return;
        }
        // Replace local state. Module progress is optional in the export payload;
        // older exports won't have it and that's OK.
        importPulls(data.pulls);
        if (data.moduleProgress) {
          importModuleProgress(data.moduleProgress);
        }
        setImportError(null);
        closeSettings();
      } catch {
        // JSON.parse throw → malformed file. Don't try to be smart about partial recovery.
        setImportError("Invalid JSON file");
      }
    };
    reader.readAsText(file);
    // Reset value so re-selecting the SAME file fires onChange again. Otherwise, after
    // a failed import the user couldn't retry without picking something else first.
    e.target.value = "";
  };

  // Bulk import — auto-detects JSON vs TSV and routes accordingly.
  // Two distinct paths because:
  //   - JSON is treated as a snapshot to REPLACE local data (using importPulls).
  //   - TSV is treated as a chunk of NEW pulls to APPEND (using addPull per line).
  const handleBulkImport = () => {
    const trimmed = bulkText.trim();
    if (!trimmed) return;

    // JSON detection by leading char. We don't try to JSON.parse first because the
    // user's TSV often starts with a date like "3/17/2026" which JSON.parse would
    // accept as a number expression in some pathological cases.
    if (trimmed[0] === "{" || trimmed[0] === "[") {
      try {
        const data = JSON.parse(trimmed);
        if (!data.pulls || !Array.isArray(data.pulls)) {
          setBulkResult({ count: 0, errors: ["Invalid JSON: missing pulls array"], correctedNames: [] });
          return;
        }
        // Same per-record validator as the file import path. Kept inline (rather
        // than extracted) so any change to the strict-shape rule is reviewed in
        // both places — they MUST stay in lockstep.
        const isValidPull = (p: unknown): boolean => {
          if (!p || typeof p !== "object") return false;
          const record = p as Record<string, unknown>;
          return (
            typeof record.id === "string" &&
            typeof record.date === "string" &&
            typeof record.commonCount === "number" &&
            typeof record.rareCount === "number" &&
            Array.isArray(record.epicModules) &&
            typeof record.gemsSpent === "number" &&
            typeof record.bannerType === "string"
          );
        };
        if (!data.pulls.every(isValidPull)) {
          setBulkResult({ count: 0, errors: ["Invalid JSON: pull records have missing or invalid fields"], correctedNames: [] });
          return;
        }
        // Replace mode for JSON snapshots.
        importPulls(data.pulls);
        if (data.moduleProgress) {
          importModuleProgress(data.moduleProgress);
        }
        setBulkResult({ count: data.pulls.length, errors: [], correctedNames: [] });
        // Clear the textarea so a successful import doesn't leave the just-imported
        // text sitting there ready to be re-imported on a stray click.
        setBulkText("");
        return;
      } catch {
        setBulkResult({ count: 0, errors: ["Invalid JSON format"], correctedNames: [] });
        return;
      }
    }

    // Tab-separated text import — parser accumulates errors, we enforce all-or-nothing.
    const result = parseBulkImport(trimmed);
    if (result.errors.length > 0) {
      // Show all errors but import nothing. Surface correctedNames too so the user
      // can sanity check the parser's understanding of their input even on a failed run.
      setBulkResult({
        count: 0,
        errors: result.errors,
        correctedNames: result.correctedNames,
      });
      return;
    }
    // Append mode: TSV is incoming new pulls, not a snapshot. addPull is the same
    // store action used by the manual Add Pull modal so behavior stays consistent.
    for (const pull of result.pulls) {
      addPull({
        date: pull.date,
        commonCount: pull.commonCount,
        rareCount: pull.rareCount,
        epicModules: pull.epicModules,
        gemsSpent: pull.gemsSpent,
        bannerType: pull.bannerType,
      });
    }
    setBulkResult({
      count: result.pulls.length,
      errors: [],
      correctedNames: result.correctedNames,
    });
    setBulkText("");
  };

  // Destructive reset. Closes Settings after wiping so the user lands on the empty
  // dashboard instead of staring at a now-empty Settings modal.
  const handleReset = () => {
    clearPulls();
    clearModuleProgress();
    setResetConfirmOpen(false);
    closeSettings();
  };

  return (
    <>
      <Modal isOpen={settingsOpen} onClose={closeSettings} title="Settings">
        <div className="space-y-4">
          <AccountSettings />

          <div className="border-t border-[var(--color-navy-500)] pt-4">
            <h3 className="text-sm font-medium text-gray-300 mb-2">Data Management</h3>
            <div className="space-y-2">
              <Button variant="secondary" onClick={handleExport} className="w-full">Export Data</Button>
              <Button variant="secondary" onClick={handleImport} className="w-full">Import Data</Button>
              <ScreenshotButton />
              <input ref={fileInputRef} type="file" accept=".json" onChange={handleFileChange} className="hidden" />
              {importError && <p className="text-red-400 text-sm">{importError}</p>}
            </div>
          </div>

          <div className="border-t border-[var(--color-navy-500)] pt-4">
            <h3 className="text-sm font-medium text-gray-300 mb-2">Bulk Import</h3>
            <p className="text-xs text-gray-500 mb-2">
              Paste tab-separated data or exported JSON
            </p>
            <textarea
              value={bulkText}
              onChange={(e) => {
                setBulkText(e.target.value);
                setBulkResult(null);
              }}
              placeholder={"3/17/2026\t7\t2\t1\tDeath Penalty"}
              rows={6}
              className="w-full px-3 py-2 rounded-lg bg-[var(--color-navy-800)] border border-[var(--color-navy-500)] text-gray-200 text-base font-mono focus:outline-none focus:border-[var(--color-accent-gold)] resize-y"
            />
            <Button
              variant="secondary"
              onClick={handleBulkImport}
              disabled={!bulkText.trim()}
              className="w-full mt-2"
            >
              Import Pasted Data
            </Button>
            {bulkResult && bulkResult.errors.length > 0 && (
              <div className="mt-2 text-xs">
                <p className="text-red-400 font-medium">Errors found — nothing imported:</p>
                <ul className="text-red-400 mt-1 space-y-0.5 max-h-32 overflow-y-auto">
                  {bulkResult.errors.map((e, i) => (
                    <li key={i}>{e}</li>
                  ))}
                </ul>
              </div>
            )}
            {bulkResult && bulkResult.count > 0 && (
              <div className="mt-2 text-xs">
                <p className="text-green-400">Imported {bulkResult.count} pulls.</p>
                {bulkResult.correctedNames.length > 0 && (
                  <div className="mt-1">
                    <p className="text-yellow-400">Corrected names:</p>
                    <ul className="text-yellow-400 mt-0.5 space-y-0.5">
                      {bulkResult.correctedNames.map((c, i) => (
                        <li key={i}>Line {c.line}: "{c.from}" → "{c.to}"</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="border-t border-[var(--color-navy-500)] pt-4">
            <h3 className="text-sm font-medium text-red-400 mb-2">Danger Zone</h3>
            <Button variant="danger" onClick={() => setResetConfirmOpen(true)} className="w-full">Reset All Data</Button>
          </div>
        </div>
      </Modal>

      <ConfirmDialog
        isOpen={resetConfirmOpen}
        onClose={() => setResetConfirmOpen(false)}
        onConfirm={handleReset}
        title="Reset All Data"
        message="This will permanently delete all pull records and module progress. This cannot be undone."
        confirmLabel="Delete"
      />
    </>
  );
}
