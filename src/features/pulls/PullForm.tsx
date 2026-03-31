import { useState, useEffect } from "react";
import { DateInput } from "../../components/ui/DateInput";
import { NumberSelect } from "../../components/ui/NumberSelect";
import { SearchSelect } from "../../components/ui/SearchSelect";
import { Button } from "../../components/ui/Button";
import { MODULES } from "../../config/modules";
import { validatePullForm } from "./validation";
import { useStore } from "../../store";
import type { BannerType, PullRecord } from "../../types";

interface PullFormProps {
  initialData?: PullRecord;
  onSubmit: (data: Omit<PullRecord, "id">) => void;
  onCancel: () => void;
}

const moduleOptions = MODULES.map((m) => ({
  value: m.id,
  label: m.name,
  group: m.type.charAt(0).toUpperCase() + m.type.slice(1),
}));

export function PullForm({ initialData, onSubmit, onCancel }: PullFormProps) {
  const bannerDefault = useStore((s) => s.bannerDefault);
  const lastUsedDate = useStore((s) => s.lastUsedDate);
  const setLastUsedDate = useStore((s) => s.setLastUsedDate);
  const [date, setDate] = useState(
    initialData?.date || lastUsedDate || new Date().toISOString().split("T")[0]
  );
  const [bannerType, setBannerType] = useState<BannerType>(
    initialData?.bannerType || bannerDefault
  );
  const [commonCount, setCommonCount] = useState(
    initialData?.commonCount ?? 7
  );
  const [rareCount, setRareCount] = useState(initialData?.rareCount ?? 3);
  const [rareManuallySet, setRareManuallySet] = useState(!!initialData);
  const [epicModules, setEpicModules] = useState<string[]>(
    initialData?.epicModules || []
  );

  const epicCount = 10 - commonCount - rareCount;
  const errors = validatePullForm(commonCount, rareCount);

  // Keep epicModules array in sync with epicCount
  useEffect(() => {
    if (epicCount < 0) return;
    setEpicModules((prev) => {
      if (epicCount === 0) return [];
      if (prev.length > epicCount) return prev.slice(0, epicCount);
      if (prev.length < epicCount) {
        return [...prev, ...Array(epicCount - prev.length).fill("")];
      }
      return prev;
    });
  }, [epicCount]);

  const allEpicsSelected =
    epicCount <= 0 || epicModules.every((m) => m !== "");

  const handleSubmit = () => {
    if (errors.length > 0 || !allEpicsSelected) return;
    setLastUsedDate(date);
    onSubmit({
      date,
      commonCount,
      rareCount,
      epicModules: epicModules.filter((m) => m !== ""),
      gemsSpent: 200,
      bannerType,
    });
  };

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
          className="w-full px-3 py-2 rounded-lg bg-[var(--color-navy-800)] border border-[var(--color-navy-500)] text-gray-200"
        >
          <option value="standard">Standard</option>
          <option value="featured">Featured</option>
        </select>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <NumberSelect
          label="Common"
          value={commonCount}
          onChange={(val) => {
            setCommonCount(val);
            if (!rareManuallySet) {
              setRareCount(Math.max(0, 10 - val));
            }
          }}
          min={0}
          max={10}
          data-testid="common-count"
        />
        <NumberSelect
          label="Rare"
          value={rareCount}
          onChange={(val) => {
            setRareCount(val);
            setRareManuallySet(true);
          }}
          min={0}
          max={10}
          data-testid="rare-count"
        />
      </div>

      {errors.length > 0 && (
        <div className="text-red-400 text-sm">
          {errors.map((e) => (
            <p key={e}>{e}</p>
          ))}
        </div>
      )}

      {epicCount > 0 && errors.length === 0 && (
        <div>
          <label className="block text-xs uppercase tracking-wider text-[var(--color-rarity-epic)] mb-2">
            Epic Modules ({epicCount})
          </label>
          <div className="space-y-2">
            {epicModules.map((moduleId, i) => (
              <div key={i} data-testid={`epic-select-${i}`}>
                <SearchSelect
                  options={moduleOptions}
                  value={moduleId}
                  onChange={(val) => {
                    const updated = [...epicModules];
                    updated[i] = val;
                    setEpicModules(updated);
                  }}
                  placeholder={`Select epic module ${i + 1}...`}
                />
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="bg-[var(--color-navy-800)] rounded-lg p-3 text-sm">
        <p className="text-gray-400">
          Summary: {commonCount} common, {rareCount} rare, {Math.max(epicCount, 0)} epic — 200 gems
        </p>
      </div>

      <div className="flex justify-end gap-3 pt-2">
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
  );
}
