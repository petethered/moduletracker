import { useState } from "react";
import { DateInput } from "../../components/ui/DateInput";
import { SearchSelect } from "../../components/ui/SearchSelect";
import { Button } from "../../components/ui/Button";
import { MODULES } from "../../config/modules";
import { validatePullForm, clampPullCount } from "./validation";
import { useStore } from "../../store";
import type { BannerType, PullRecord } from "../../types";
import { getLocalDateString } from "../../utils/formatDate";
import { useRenderLog, logEvent } from "../../utils/renderLog";

interface PullFormProps {
  initialData?: PullRecord;
  onSubmit: (data: Omit<PullRecord, "id">) => void;
  onCancel: () => void;
  onDelete?: () => void;
}

interface EpicRow {
  rowId: string;
  moduleId: string;
}

const moduleOptions = MODULES.map((m) => ({
  value: m.id,
  label: m.name,
  group: m.type.charAt(0).toUpperCase() + m.type.slice(1),
}));

const inputClass =
  "w-full px-3 py-2 rounded-lg bg-[var(--color-navy-800)] border border-[var(--color-navy-500)] text-gray-200 focus:outline-none focus:border-[var(--color-accent-gold)]";

function createRowId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `r-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export function PullForm({ initialData, onSubmit, onCancel, onDelete }: PullFormProps) {
  const bannerDefault = useStore((s) => s.bannerDefault);
  const lastUsedBannerType = useStore((s) => s.lastUsedBannerType);
  const setLastUsedBannerType = useStore((s) => s.setLastUsedBannerType);
  const lastUsedDate = useStore((s) => s.lastUsedDate);
  const setLastUsedDate = useStore((s) => s.setLastUsedDate);

  const [date, setDate] = useState(
    initialData?.date || lastUsedDate || getLocalDateString()
  );
  const [bannerType, setBannerType] = useState<BannerType>(
    initialData?.bannerType || lastUsedBannerType || bannerDefault
  );
  const [commonCount, setCommonCount] = useState(
    initialData?.commonCount ?? 7
  );
  const [rareCount, setRareCount] = useState(initialData?.rareCount ?? 3);
  const [rareManuallySet, setRareManuallySet] = useState(!!initialData);
  const [epics, setEpics] = useState<EpicRow[]>(() =>
    (initialData?.epicModules || []).map((moduleId) => ({
      rowId: createRowId(),
      moduleId,
    }))
  );

  const epicCount = epics.length;
  const errors = validatePullForm(commonCount, rareCount, epicCount);
  const allEpicsSelected = epics.every((r) => r.moduleId !== "");
  const canAddEpic =
    epicCount < 10 && (rareCount > 0 || commonCount > 0) && errors.length === 0;

  useRenderLog("PullForm", {
    commonCount,
    rareCount,
    epicCount,
    rareManuallySet,
    errorsLen: errors.length,
  });

  function handleCommonChange(val: number) {
    logEvent("PullForm.handleCommonChange", { from: commonCount, to: val });
    setCommonCount(val);
    if (!rareManuallySet) {
      setRareCount(Math.max(0, 10 - val - epicCount));
    }
  }

  function handleRareChange(val: number) {
    logEvent("PullForm.handleRareChange", { from: rareCount, to: val });
    setRareCount(val);
    setRareManuallySet(true);
    if (val + commonCount + epicCount > 10) {
      setCommonCount(Math.max(0, 10 - val - epicCount));
    }
  }

  function handleAddEpic() {
    if (epicCount >= 10) return;
    if (rareCount === 0 && commonCount === 0) return;
    logEvent("PullForm.handleAddEpic", { epicCount, rareCount, commonCount });
    setEpics([...epics, { rowId: createRowId(), moduleId: "" }]);
    if (rareCount > 0) {
      setRareCount(rareCount - 1);
    } else {
      setCommonCount(commonCount - 1);
    }
  }

  function handleRemoveEpic(rowId: string) {
    logEvent("PullForm.handleRemoveEpic", { rowId, epicCount });
    setEpics(epics.filter((r) => r.rowId !== rowId));
    setRareCount(rareCount + 1);
  }

  function handleEpicChange(rowId: string, moduleId: string) {
    logEvent("PullForm.handleEpicChange", { rowId, moduleId });
    setEpics(epics.map((r) => (r.rowId === rowId ? { ...r, moduleId } : r)));
  }

  function handleSubmit() {
    if (errors.length > 0 || !allEpicsSelected) return;
    setLastUsedDate(date);
    setLastUsedBannerType(bannerType);
    onSubmit({
      date,
      commonCount,
      rareCount,
      epicModules: epics.map((r) => r.moduleId),
      gemsSpent: 200,
      bannerType,
    });
  }

  return (
    <div className="space-y-4">
      <DateInput label="Date" value={date} onChange={setDate} />

      <div>
        <label className="block text-xs uppercase tracking-wider text-gray-400 mb-1">
          Banner
        </label>
        <select
          value={bannerType}
          onChange={(e) => setBannerType(e.target.value as BannerType)}
          className={inputClass}
        >
          <option value="standard">Standard</option>
          <option value="featured">Featured</option>
          <option value="lucky">Lucky</option>
        </select>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-xs uppercase tracking-wider text-gray-400 mb-1">
            Common
          </label>
          <input
            type="number"
            min={0}
            max={10}
            step={1}
            inputMode="numeric"
            value={commonCount}
            onChange={(e) => handleCommonChange(clampPullCount(e.target.value))}
            onFocus={(e) => e.target.select()}
            data-testid="common-count"
            className={inputClass}
          />
        </div>
        <div>
          <label className="block text-xs uppercase tracking-wider text-gray-400 mb-1">
            Rare
          </label>
          <input
            type="number"
            min={0}
            max={10}
            step={1}
            inputMode="numeric"
            value={rareCount}
            onChange={(e) => handleRareChange(clampPullCount(e.target.value))}
            onFocus={(e) => e.target.select()}
            data-testid="rare-count"
            className={inputClass}
          />
        </div>
      </div>

      {errors.length > 0 && (
        <div className="text-red-400 text-sm">
          {errors.map((e) => (
            <p key={e}>{e}</p>
          ))}
        </div>
      )}

      <div>
        <label className="block text-xs uppercase tracking-wider text-[var(--color-rarity-epic)] mb-2">
          Epic Modules ({epicCount})
        </label>
        {epics.length > 0 && (
          <div className="space-y-2 mb-2">
            {epics.map((row, i) => (
              <div
                key={row.rowId}
                data-testid={`epic-select-${i}`}
                className="flex gap-2 items-start"
              >
                <div className="flex-1">
                  <SearchSelect
                    options={moduleOptions}
                    value={row.moduleId}
                    onChange={(val) => handleEpicChange(row.rowId, val)}
                    placeholder={`Select epic module ${i + 1}...`}
                  />
                </div>
                <button
                  type="button"
                  onClick={() => handleRemoveEpic(row.rowId)}
                  aria-label="Remove epic"
                  data-testid={`epic-remove-${i}`}
                  className="px-3 py-2 rounded-lg text-gray-400 hover:text-red-400 hover:bg-[var(--color-navy-700)] border border-transparent hover:border-[var(--color-navy-500)] transition-colors"
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        )}
        <button
          type="button"
          onClick={handleAddEpic}
          disabled={!canAddEpic}
          data-testid="add-epic"
          className="text-sm px-3 py-2 rounded-lg border border-dashed border-[var(--color-navy-500)] text-[var(--color-rarity-epic)] hover:border-[var(--color-rarity-epic)] hover:bg-[var(--color-navy-800)] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          + Add Epic
        </button>
      </div>

      <div className="bg-[var(--color-navy-800)] rounded-lg p-3 text-sm">
        <p className="text-gray-400">
          Summary: {commonCount} common, {rareCount} rare, {epicCount} epic — 200 gems
        </p>
      </div>

      <div className="flex items-center pt-2">
        {onDelete && (
          <Button variant="danger" onClick={onDelete}>
            Delete
          </Button>
        )}
        <div className="flex gap-3 ml-auto">
          <Button variant="secondary" onClick={onCancel}>
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={errors.length > 0 || !allEpicsSelected}
          >
            Save Pull
          </Button>
        </div>
      </div>
    </div>
  );
}
