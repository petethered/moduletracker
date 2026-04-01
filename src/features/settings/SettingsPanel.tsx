import { useRef, useState } from "react";
import { Modal } from "../../components/ui/Modal";
import { Button } from "../../components/ui/Button";
import { ConfirmDialog } from "../../components/ui/ConfirmDialog";
import { useStore } from "../../store";
import { parseBulkImport } from "./parseBulkImport";
import { getLocalDateString } from "../../utils/formatDate";

export function SettingsPanel() {
  const settingsOpen = useStore((s) => s.settingsOpen);
  const closeSettings = useStore((s) => s.closeSettings);
  const pulls = useStore((s) => s.pulls);
  const moduleProgress = useStore((s) => s.moduleProgress);
  const importPulls = useStore((s) => s.importPulls);
  const importModuleProgress = useStore((s) => s.importModuleProgress);
  const clearPulls = useStore((s) => s.clearPulls);
  const clearModuleProgress = useStore((s) => s.clearModuleProgress);
  const addPull = useStore((s) => s.addPull);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [resetConfirmOpen, setResetConfirmOpen] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);
  const [bulkText, setBulkText] = useState("");
  const [bulkResult, setBulkResult] = useState<{
    count: number;
    errors: string[];
    correctedNames: { line: number; from: string; to: string }[];
  } | null>(null);

  const handleExport = () => {
    const data = { pulls, moduleProgress, exportedAt: new Date().toISOString() };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `module-tracker-${getLocalDateString()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImport = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const data = JSON.parse(event.target?.result as string);
        if (!data.pulls || !Array.isArray(data.pulls)) {
          setImportError("Invalid file: missing pulls array");
          return;
        }
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
        importPulls(data.pulls);
        if (data.moduleProgress) {
          importModuleProgress(data.moduleProgress);
        }
        setImportError(null);
        closeSettings();
      } catch {
        setImportError("Invalid JSON file");
      }
    };
    reader.readAsText(file);
    e.target.value = "";
  };

  const handleBulkImport = () => {
    const trimmed = bulkText.trim();
    if (!trimmed) return;

    // Detect JSON (starts with { or [)
    if (trimmed[0] === "{" || trimmed[0] === "[") {
      try {
        const data = JSON.parse(trimmed);
        if (!data.pulls || !Array.isArray(data.pulls)) {
          setBulkResult({ count: 0, errors: ["Invalid JSON: missing pulls array"], correctedNames: [] });
          return;
        }
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
        importPulls(data.pulls);
        if (data.moduleProgress) {
          importModuleProgress(data.moduleProgress);
        }
        setBulkResult({ count: data.pulls.length, errors: [], correctedNames: [] });
        setBulkText("");
        return;
      } catch {
        setBulkResult({ count: 0, errors: ["Invalid JSON format"], correctedNames: [] });
        return;
      }
    }

    // Tab-separated text import
    const result = parseBulkImport(trimmed);
    if (result.errors.length > 0) {
      setBulkResult({
        count: 0,
        errors: result.errors,
        correctedNames: result.correctedNames,
      });
      return;
    }
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
          <div>
            <h3 className="text-sm font-medium text-gray-300 mb-2">Data Management</h3>
            <div className="space-y-2">
              <Button variant="secondary" onClick={handleExport} className="w-full">Export Data</Button>
              <Button variant="secondary" onClick={handleImport} className="w-full">Import Data</Button>
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
              className="w-full px-3 py-2 rounded-lg bg-[var(--color-navy-800)] border border-[var(--color-navy-500)] text-gray-200 text-xs font-mono focus:outline-none focus:border-[var(--color-accent-gold)] resize-y"
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
