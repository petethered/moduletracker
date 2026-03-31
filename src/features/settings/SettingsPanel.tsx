import { useRef, useState } from "react";
import { Modal } from "../../components/ui/Modal";
import { Button } from "../../components/ui/Button";
import { ConfirmDialog } from "../../components/ui/ConfirmDialog";
import { useStore } from "../../store";

export function SettingsPanel() {
  const settingsOpen = useStore((s) => s.settingsOpen);
  const closeSettings = useStore((s) => s.closeSettings);
  const pulls = useStore((s) => s.pulls);
  const moduleProgress = useStore((s) => s.moduleProgress);
  const importPulls = useStore((s) => s.importPulls);
  const importModuleProgress = useStore((s) => s.importModuleProgress);
  const clearPulls = useStore((s) => s.clearPulls);
  const clearModuleProgress = useStore((s) => s.clearModuleProgress);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [resetConfirmOpen, setResetConfirmOpen] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);

  const handleExport = () => {
    const data = { pulls, moduleProgress, exportedAt: new Date().toISOString() };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `module-tracker-${new Date().toISOString().split("T")[0]}.json`;
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
