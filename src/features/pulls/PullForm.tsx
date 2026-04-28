/**
 * PullForm.tsx — the 10x-pull entry/edit form.
 *
 * Role:
 *   - Captures the user's input for a single 10x gacha pull: date, banner
 *     type, the list of epic modules received (0..10), and the
 *     common/rare split for the remaining drops.
 *   - Calls onSubmit with a fully-validated Omit<PullRecord, "id"> payload.
 *
 * User flow it supports:
 *   - Opened by PullModal in either "add" or "edit" mode. The user expects
 *     the form to be optimised for the most common case: a 10x pull with
 *     0–2 epics, the rest split between common/rare.
 *
 * --- Validation contract ---
 *   The form is only submittable when:
 *     1. validatePullForm(commonCount, rareCount, epicCount) returns [].
 *        That enforces 0..10 per bucket AND the hard invariant
 *        common + rare + epic === 10 (a 10x pull yields exactly 10 drops).
 *     2. Every epic row has a moduleId chosen (no blank SearchSelects).
 *   Both checks gate the "Save Pull" disabled state and the early-return
 *   in handleSubmit. Don't loosen one without the other.
 *
 * --- Why "epic-first" entry (recent UX decision, do not undo) ---
 *   Real users open the form right after a pull and want to log epics
 *   FIRST — that's the rare/exciting data point. So:
 *     * The Epic Modules section is rendered ABOVE Rare/Common counts.
 *     * Clicking "+ Add Epic" appends a row AND auto-decrements rareCount
 *       (or commonCount if no rares left), so the "remaining 10 drops"
 *       math stays correct without the user touching the count buttons.
 *     * The new SearchSelect auto-opens (see autoOpenRowId below) so the
 *       user can immediately type/scroll to pick the module — one tap
 *       fewer per epic logged. This was an explicit ask; preserve it.
 *
 * --- Why 0-10 button rows for Common/Rare (recent UX decision) ---
 *   The Common and Rare inputs used to be number/stepper controls, which
 *   were finicky on mobile and required multiple taps for the most common
 *   value (e.g. 7 commons). They were replaced with CountButtonRow: a
 *   radiogroup of 11 buttons (0..10) where buttons exceeding the available
 *   "remaining" budget (10 - epicCount) are disabled. Tap-to-set, single
 *   action, mobile-friendly. Selecting one bucket auto-balances the other
 *   (handleCommonSelect / handleRareSelect), again preserving the 10-drop
 *   invariant without the user doing arithmetic. Do not revert to a
 *   number/stepper input.
 *
 * --- Why epicCount is derived from epics.length ---
 *   Epics are a list of {rowId, moduleId} pairs (so React can key them
 *   stably across reorders/removals). The count is whatever epics.length
 *   says — there's no separate state for it. Touching epics[] is the
 *   single source of truth for epicCount.
 *
 * --- Defaults ---
 *   - date: initialData.date  ||  lastUsedDate (sticky across pulls in the
 *     same session)  ||  today's local date.
 *   - bannerType: initialData  ||  lastUsedBannerType  ||  user's
 *     bannerDefault setting. Sticky-then-default chain mirrors how players
 *     log multiple pulls on the same banner in a row.
 *   - commonCount: 7, rareCount: 3 — the empirically most common 10x
 *     outcome with zero epics. Saves taps when the user pulled nothing
 *     interesting.
 */
import { useState } from "react";
import { DateInput } from "../../components/ui/DateInput";
import { SearchSelect } from "../../components/ui/SearchSelect";
import { Button } from "../../components/ui/Button";
import { MODULES } from "../../config/modules";
import { validatePullForm } from "./validation";
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

// Each epic slot tracks its own stable rowId so React keys survive
// add/remove/reorder. Two rows can have the same moduleId (rare but legal —
// duplicate copies of the same epic in one 10x pull), so we cannot key by
// moduleId alone; that's why rowId exists.
interface EpicRow {
  rowId: string;
  moduleId: string;
}

// Pre-build SearchSelect options from the canonical MODULES list. Computed
// once at module-evaluation time — MODULES is a static config import, so
// this is safe to memoise outside the component. The `group` field drives
// the option grouping in SearchSelect ("Cannon", "Armor", etc.).
const moduleOptions = MODULES.map((m) => ({
  value: m.id,
  label: m.name,
  group: m.type.charAt(0).toUpperCase() + m.type.slice(1),
}));

// Reused Tailwind class for the banner <select>. Kept as a const because
// inlining bloats the JSX; it's intentionally not promoted to a shared UI
// component since this is the only native <select> left in the form.
const selectClass =
  "w-full px-3 py-2 rounded-lg bg-[var(--color-navy-800)] border border-[var(--color-navy-500)] text-gray-200 focus:outline-none focus:border-[var(--color-accent-gold)]";

/**
 * Generate a stable id for a new EpicRow. Prefers crypto.randomUUID (modern
 * browsers, jsdom in tests) and falls back to a timestamp+random combo for
 * older runtimes. Uniqueness only needs to hold within the lifetime of a
 * single PullForm instance, so collision risk is effectively zero.
 */
function createRowId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `r-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

interface CountButtonRowProps {
  label: string;
  value: number;
  // `max` = the highest selectable count given current state (10 - epicCount).
  // Buttons above this are rendered DISABLED rather than hidden, so the row
  // width never reflows as the user adds/removes epics — a deliberate
  // stability-of-layout choice on mobile.
  max: number;
  onSelect: (n: number) => void;
  // Drives data-testid="${prefix}-${n}" on each button so Playwright can
  // address them precisely (e.g. common-count-7).
  testIdPrefix: string;
  labelColor?: string;
}

/**
 * CountButtonRow — the 0..10 button row used for Common and Rare counts.
 *
 * UX rationale (do not revert to a number/stepper input):
 *   - Single-tap selection on mobile.
 *   - The full range is always visible, so the user sees affordance at a
 *     glance and never has to long-press a stepper.
 *   - aria-checked + role="radio" inside role="radiogroup" makes this an
 *     a11y-correct radio group; aria-pressed is also set so the buttons
 *     read sensibly to assistive tech that prefers toggle-button semantics.
 *
 * Behaviour:
 *   - 11 buttons (n = 0..10). Buttons where n > max are disabled.
 *   - The selected button gets the gold accent fill; others are outline.
 */
function CountButtonRow({ label, value, max, onSelect, testIdPrefix, labelColor }: CountButtonRowProps) {
  return (
    <div>
      <label
        className="block text-sm uppercase tracking-wider mb-1"
        style={{ color: labelColor ?? "#9ca3af" }}
      >
        {label}
      </label>
      <div
        role="radiogroup"
        aria-label={label}
        className="grid grid-cols-3 md:grid-cols-11 gap-1"
      >
        {Array.from({ length: 11 }, (_, n) => {
          const disabled = n > max;
          const selected = n === value;
          return (
            <button
              key={n}
              type="button"
              role="radio"
              aria-checked={selected}
              aria-pressed={selected}
              onClick={() => onSelect(n)}
              disabled={disabled}
              data-testid={`${testIdPrefix}-${n}`}
              className={
                "py-2 text-sm rounded-lg border transition-colors " +
                (selected
                  ? "bg-[var(--color-accent-gold)] text-[var(--color-navy-900)] border-[var(--color-accent-gold)] font-semibold"
                  : disabled
                  ? "bg-[var(--color-navy-800)] text-gray-600 border-[var(--color-navy-700)] cursor-not-allowed"
                  : "bg-[var(--color-navy-800)] text-gray-300 border-[var(--color-navy-500)] hover:border-[var(--color-accent-gold)]")
              }
            >
              {n}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function PullForm({ initialData, onSubmit, onCancel, onDelete }: PullFormProps) {
  // --- Sticky-default plumbing ---
  // Settings slice exposes the user's chosen `bannerDefault`. The UI slice
  // remembers the LAST date/banner the user actually submitted so a player
  // logging multiple pulls in a row doesn't have to reselect each time.
  // Resolution order (date and banner): initialData > lastUsed* > default.
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
  // Default 7/3 split: the empirically most common 10x outcome with zero
  // epics. Use ?? not || so an explicit 0 in initialData survives.
  const [commonCount, setCommonCount] = useState(
    initialData?.commonCount ?? 7
  );
  const [rareCount, setRareCount] = useState(initialData?.rareCount ?? 3);
  // Map each existing epic moduleId to a fresh rowId — initialData stores
  // only moduleIds (PullRecord.epicModules: string[]), so we synthesize
  // rowIds for the form's working state.
  const [epics, setEpics] = useState<EpicRow[]>(() =>
    (initialData?.epicModules || []).map((moduleId) => ({
      rowId: createRowId(),
      moduleId,
    }))
  );
  // autoOpenRowId triggers SearchSelect.defaultOpen on the row matching
  // this id. Set when the user clicks "+ Add Epic" so the picker pops open
  // immediately — the explicit-UX decision called out in the file header.
  // Only one row at a time gets this token; we don't bother clearing it
  // because SearchSelect only reads defaultOpen on mount.
  const [autoOpenRowId, setAutoOpenRowId] = useState<string | null>(null);

  // Derived state — never store these.
  const epicCount = epics.length;
  // Max selectable for Common/Rare buttons: whatever's left after epics.
  // Math.max(...,0) guards against the (validation-rejected) >10 epics case.
  const maxCount = Math.max(0, 10 - epicCount);
  const errors = validatePullForm(commonCount, rareCount, epicCount);
  // Every epic row must have a real moduleId before save. A blank row is
  // possible momentarily after "+ Add Epic" + auto-open + user dismiss.
  const allEpicsSelected = epics.every((r) => r.moduleId !== "");
  // "+ Add Epic" only makes sense if there's a non-epic drop to convert
  // (rare or common > 0) and we haven't hit the 10-epic ceiling.
  const canAddEpic = epicCount < 10 && (rareCount > 0 || commonCount > 0);

  useRenderLog("PullForm", {
    commonCount,
    rareCount,
    epicCount,
    errorsLen: errors.length,
  });

  // When the user picks a Common count, auto-balance Rare so the total
  // (commons + rares + epics) stays at 10. This is the magic that lets
  // users ignore the math entirely — they only need to be honest about
  // ONE of the two non-epic counts, and the other follows.
  function handleCommonSelect(val: number) {
    logEvent("PullForm.handleCommonSelect", { from: commonCount, to: val });
    setCommonCount(val);
    setRareCount(Math.max(0, 10 - val - epicCount));
  }

  // Symmetric to handleCommonSelect — set Rare, derive Common.
  function handleRareSelect(val: number) {
    logEvent("PullForm.handleRareSelect", { from: rareCount, to: val });
    setRareCount(val);
    setCommonCount(Math.max(0, 10 - val - epicCount));
  }

  // Add a new epic slot. Auto-open the SearchSelect so the user can
  // immediately type the module name (epic-first UX, see file header).
  // Decrements rare first, then common, to convert one of the existing
  // non-epic drops into an epic — preserves the 10-drop invariant.
  function handleAddEpic() {
    if (epicCount >= 10) return; // Hard ceiling — also covered by canAddEpic.
    if (rareCount === 0 && commonCount === 0) return; // Nothing to convert.
    logEvent("PullForm.handleAddEpic", { epicCount, rareCount, commonCount });
    const newRowId = createRowId();
    setEpics([...epics, { rowId: newRowId, moduleId: "" }]);
    // Tag this row for auto-open. SearchSelect.defaultOpen reads it on mount.
    setAutoOpenRowId(newRowId);
    if (rareCount > 0) {
      setRareCount(rareCount - 1);
    } else {
      setCommonCount(commonCount - 1);
    }
  }

  // Remove an epic and add the freed slot back to Rare. WHY rare and not
  // common: when a user mis-tapped "Add Epic" they almost always meant to
  // log a rare, not a common (epics get added by converting from rare
  // first in handleAddEpic, so this is the inverse). If we returned the
  // slot to common instead, the rare count would silently drop to 0 over
  // multiple add/remove cycles.
  function handleRemoveEpic(rowId: string) {
    logEvent("PullForm.handleRemoveEpic", { rowId, epicCount });
    setEpics(epics.filter((r) => r.rowId !== rowId));
    setRareCount(rareCount + 1);
  }

  // Update the chosen module on a specific epic row. Identity is by rowId,
  // not moduleId, because two rows may legally point at the same module.
  function handleEpicChange(rowId: string, moduleId: string) {
    logEvent("PullForm.handleEpicChange", { rowId, moduleId });
    setEpics(epics.map((r) => (r.rowId === rowId ? { ...r, moduleId } : r)));
  }

  // Final guard before calling onSubmit. Mirrors the disabled state of the
  // Save button — if either check fails we silently bail. The disabled
  // button should already prevent reaching here, but defence in depth.
  // Persists the date/banner as "last used" so the next pull is faster.
  // gemsSpent is hardcoded to 200 — that's the canonical 10x cost in The
  // Tower; if the game ever changes this, surface it as a settings option
  // rather than re-hardcoding.
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
          className={selectClass}
        >
          <option value="standard">Standard</option>
          <option value="featured">Featured</option>
          <option value="lucky">Lucky</option>
        </select>
      </div>

      {/*
        Epic Modules section — rendered ABOVE Common/Rare deliberately
        (epic-first UX). Adding an epic auto-decrements Rare/Common, and
        the freshly-added row's SearchSelect auto-opens. See file header.
      */}
      <div>
        <label className="block text-xs uppercase tracking-wider text-[var(--color-rarity-epic)] mb-2">
          Epic Modules ({epicCount})
        </label>
        <button
          type="button"
          onClick={handleAddEpic}
          disabled={!canAddEpic}
          data-testid="add-epic"
          className="text-sm px-3 py-2 rounded-lg border border-dashed border-[var(--color-navy-500)] text-[var(--color-rarity-epic)] hover:border-[var(--color-rarity-epic)] hover:bg-[var(--color-navy-800)] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          + Add Epic
        </button>
        {epics.length > 0 && (
          <div className="space-y-2 mt-2">
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
                    // defaultOpen is true ONLY for the row that was just
                    // appended via handleAddEpic — drives the auto-open
                    // SearchSelect UX (saves a tap per epic logged).
                    defaultOpen={row.rowId === autoOpenRowId}
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
      </div>

      {/*
        Rare BEFORE Common in the layout: the "rare" line is the more
        interesting / variable count for most players. Both rows share the
        same maxCount (10 - epicCount); selecting one auto-balances the
        other via handleRareSelect / handleCommonSelect.
      */}
      <CountButtonRow
        label="Rare"
        value={rareCount}
        max={maxCount}
        onSelect={handleRareSelect}
        testIdPrefix="rare-count"
        // Rarity-blue label colour; matches the rare badge elsewhere.
        labelColor="#70d6ef"
      />
      <CountButtonRow
        label="Common"
        value={commonCount}
        max={maxCount}
        onSelect={handleCommonSelect}
        testIdPrefix="common-count"
      />

      {/* Live summary — also a sanity check for the user that totals to 10. */}
      <div className="bg-[var(--color-navy-800)] rounded-lg p-3 text-sm">
        <p className="text-gray-400">
          Summary: {commonCount} common, {rareCount} rare, {epicCount} epic — 200 gems
        </p>
      </div>

      <div className="flex items-center pt-2">
        {/* Delete only renders in edit mode — onDelete is undefined for new pulls. */}
        {onDelete && (
          <Button variant="danger" onClick={onDelete}>
            Delete
          </Button>
        )}
        <div className="flex gap-3 ml-auto">
          <Button variant="secondary" onClick={onCancel}>
            Cancel
          </Button>
          {/*
            Save is gated by BOTH validation rules (10-drop invariant) AND
            the all-epics-selected check. Keep both — see file header
            "Validation contract" section.
          */}
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
