/**
 * PullForm.tsx — the 10x-pull entry/edit form.
 *
 * Role:
 *   - Captures the user's input for a single 10x gacha pull: date, banner
 *     type, the list of epic modules received (0..10), and the
 *     common/rare split for the remaining drops.
 *   - Calls onSubmit (or onSaveAndContinue, add mode) with a fully-validated
 *     Omit<PullRecord, "id"> payload.
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
 *   Both checks are combined ONCE into `canSave`, which gates the "Save Pull"
 *   and "Save & Continue" disabled states and the early-return in both save
 *   handlers. Change the rule in `canSave`, never at a call site.
 *
 * --- Save & Continue (add mode only) ---
 *   For logging a backlog of pulls in one sitting. Rendered only when the
 *   parent passes onSaveAndContinue (PullModal does so in add mode only;
 *   "continue" means nothing when editing one existing record). It hands the
 *   payload to the parent, then resets the form IN PLACE rather than
 *   remounting it:
 *     * epics/counts/autoOpen go back to their fresh-form defaults;
 *     * date and banner are KEPT, since a backlog is usually one day and one
 *       banner (these are also what the sticky lastUsed* values now hold);
 *     * keyboard focus stays on the Save & Continue button, so repeated
 *       entry doesn't lose the user's place. Remounting via PullModal's key
 *       would destroy the focused button and drop focus to <body>.
 *     * a short cooldown ignores repeat clicks right after a save. The reset
 *       form is itself VALID (7/3, no epics), so without it the second click
 *       of a double-click (or a held Enter key) saves a phantom blank pull.
 *       Not "disabled until edited": several identical 7/3 pulls in a row is
 *       a legitimate backlog, and the user must be able to save them.
 *
 * --- Why "epic-first" entry (recent UX decision, do not undo) ---
 *   Real users open the form right after a pull and want to log epics
 *   FIRST — that's the rare/exciting data point. So:
 *     * The Epic Modules section is rendered ABOVE Rare/Common counts.
 *     * Clicking "+ Add Epic" appends a row AND converts one non-epic drop
 *       (COMMON first, then rare), so the "remaining 10 drops" math stays
 *       correct without the user touching the count buttons. Removing an
 *       epic returns the slot to common. The rule and its rationale live in
 *       epicSlots.ts (unit-tested); the handlers here only apply it.
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
 *     interesting. Single-sourced in DEFAULT_COMMON_COUNT/DEFAULT_RARE_COUNT
 *     because both initial state and the Save & Continue reset use them.
 */
import { useId, useRef, useState } from "react";
import { DateInput } from "../../components/ui/DateInput";
import { SearchSelect } from "../../components/ui/SearchSelect";
import { Button } from "../../components/ui/Button";
import { MetaLabel } from "../../components/ui/MetaLabel";
import { BANNER_LABELS } from "../../config/banners";
import { MODULES } from "../../config/modules";
import { returnSlotFromEpic, takeSlotForEpic } from "./epicSlots";
import { validatePullForm } from "./validation";
import { useStore } from "../../store";
import type { BannerType, PullRecord } from "../../types";
import { getLocalDateString } from "../../utils/formatDate";
import { useRenderLog, logEvent } from "../../utils/renderLog";

interface PullFormProps {
  initialData?: PullRecord;
  onSubmit: (data: Omit<PullRecord, "id">) => void;
  /**
   * When provided, renders "Save & Continue": saves via this callback and then
   * resets the form for another entry instead of closing. Add mode only; see
   * the file header.
   */
  onSaveAndContinue?: (data: Omit<PullRecord, "id">) => void;
  onCancel: () => void;
  onDelete?: () => void;
}

// Fresh-form split for a 10x with no epics. See "Defaults" in the file header.
const DEFAULT_COMMON_COUNT = 7;
const DEFAULT_RARE_COUNT = 3;

// Save & Continue ignores repeat clicks for this long after a save. Covers
// the second click of a double-click (browsers space them well under 500ms)
// and key-repeat from a held Enter, while being far shorter than any real
// "read the toast, then log the next pull" gap. See the file header.
const SAVE_AND_CONTINUE_COOLDOWN_MS = 500;

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
      {/*
        MetaLabel WITHOUT htmlFor, so it renders a <span> rather than a
        <label>. That is deliberate and correct: this labels an 11-button
        radiogroup, not a single control, and a <label> pointing at nothing is
        invalid HTML. The accessible name for the group is carried by the
        `aria-label` on the radiogroup below.
      */}
      {/* No fallback color: an undefined `color` lets the label use its own
          text-gray-400 default. Passing a literal would force the inline-style
          branch and re-hardcode a value the component exists to centralise. */}
      <MetaLabel color={labelColor} className="mb-1">
        {label}
      </MetaLabel>
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

export function PullForm({ initialData, onSubmit, onSaveAndContinue, onCancel, onDelete }: PullFormProps) {
  // Stable id linking the Banner <label> to its <select>. useId rather than a
  // literal because PullModal and the edit flow can have a PullForm mounted
  // while another modal is open, and duplicate ids would cross-wire labels.
  const bannerSelectId = useId();
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
    initialData?.commonCount ?? DEFAULT_COMMON_COUNT
  );
  const [rareCount, setRareCount] = useState(initialData?.rareCount ?? DEFAULT_RARE_COUNT);
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
  // Only one row at a time gets this token. SearchSelect only reads
  // defaultOpen on mount, so a stale value is harmless; the Save & Continue
  // reset still clears it so the fresh form carries no leftover state.
  const [autoOpenRowId, setAutoOpenRowId] = useState<string | null>(null);
  // performance.now() of the last Save & Continue, for the repeat-click
  // cooldown. A ref, not state: it must never trigger a render, and it must be
  // readable synchronously by a click that lands before React re-renders.
  const lastSaveAndContinueAtRef = useRef(-Infinity);

  // Derived state — never store these.
  const epicCount = epics.length;
  // Max selectable for Common/Rare buttons: whatever's left after epics.
  // Math.max(...,0) guards against the (validation-rejected) >10 epics case.
  const maxCount = Math.max(0, 10 - epicCount);
  const errors = validatePullForm(commonCount, rareCount, epicCount);
  // Every epic row must have a real moduleId before save. A blank row is
  // possible momentarily after "+ Add Epic" + auto-open + user dismiss.
  const allEpicsSelected = epics.every((r) => r.moduleId !== "");
  // THE save gate. Used by both save buttons' disabled state and both save
  // handlers' early-return; see "Validation contract" in the file header.
  const canSave = errors.length === 0 && allEpicsSelected;
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
  // takeSlotForEpic converts one existing non-epic drop (common first) into
  // the epic, preserving the 10-drop invariant. Rule + rationale: epicSlots.ts.
  function handleAddEpic() {
    if (epicCount >= 10) return; // Hard ceiling — also covered by canAddEpic.
    const next = takeSlotForEpic({ common: commonCount, rare: rareCount });
    if (!next) return; // Nothing to convert.
    logEvent("PullForm.handleAddEpic", { epicCount, rareCount, commonCount });
    const newRowId = createRowId();
    setEpics([...epics, { rowId: newRowId, moduleId: "" }]);
    // Tag this row for auto-open. SearchSelect.defaultOpen reads it on mount.
    setAutoOpenRowId(newRowId);
    setCommonCount(next.common);
    setRareCount(next.rare);
  }

  // Remove an epic and return the freed slot via returnSlotFromEpic (to
  // common). It must stay the inverse of takeSlotForEpic — see the INVARIANT
  // in epicSlots.ts, enforced by its unit test.
  function handleRemoveEpic(rowId: string) {
    logEvent("PullForm.handleRemoveEpic", { rowId, epicCount });
    setEpics(epics.filter((r) => r.rowId !== rowId));
    const next = returnSlotFromEpic({ common: commonCount, rare: rareCount });
    setCommonCount(next.common);
    setRareCount(next.rare);
  }

  // Update the chosen module on a specific epic row. Identity is by rowId,
  // not moduleId, because two rows may legally point at the same module.
  function handleEpicChange(rowId: string, moduleId: string) {
    logEvent("PullForm.handleEpicChange", { rowId, moduleId });
    setEpics(epics.map((r) => (r.rowId === rowId ? { ...r, moduleId } : r)));
  }

  // Pure: the record to save, from current form state. Callers must check
  // `canSave` first. gemsSpent is hardcoded to 200 — that's the canonical
  // 10x cost in The Tower; if the game ever changes this, surface it as a
  // settings option rather than re-hardcoding.
  function buildPayload(): Omit<PullRecord, "id"> {
    return {
      date,
      commonCount,
      rareCount,
      epicModules: epics.map((r) => r.moduleId),
      gemsSpent: 200,
      bannerType,
    };
  }

  // Side effect, kept separate from buildPayload so that one stays pure:
  // remember this date/banner as the session's sticky defaults so the next
  // pull is faster. Both save paths call it.
  function rememberStickyDefaults() {
    setLastUsedDate(date);
    setLastUsedBannerType(bannerType);
  }

  // `canSave` guard mirrors the disabled button; defence in depth.
  function handleSubmit() {
    if (!canSave) return;
    rememberStickyDefaults();
    onSubmit(buildPayload());
  }

  // Save, then reset for the next entry. Date and banner deliberately
  // survive; see "Save & Continue" in the file header.
  function handleSaveAndContinue() {
    if (!canSave || !onSaveAndContinue) return;
    const now = performance.now();
    if (now - lastSaveAndContinueAtRef.current < SAVE_AND_CONTINUE_COOLDOWN_MS) {
      logEvent("PullForm.handleSaveAndContinue.ignoredRepeat", {});
      return;
    }
    lastSaveAndContinueAtRef.current = now;
    logEvent("PullForm.handleSaveAndContinue", { epicCount, rareCount, commonCount });
    rememberStickyDefaults();
    onSaveAndContinue(buildPayload());
    setEpics([]);
    setCommonCount(DEFAULT_COMMON_COUNT);
    setRareCount(DEFAULT_RARE_COUNT);
    setAutoOpenRowId(null);
  }

  return (
    <div className="space-y-4">
      <DateInput label="Date" value={date} onChange={setDate} />

      <div>
        {/* htmlFor/id pair added: the label and select were previously only
            visually adjacent, so the select had no accessible name. */}
        <MetaLabel htmlFor={bannerSelectId} className="mb-1">
          Banner
        </MetaLabel>
        <select
          id={bannerSelectId}
          value={bannerType}
          onChange={(e) => setBannerType(e.target.value as BannerType)}
          className={selectClass}
        >
          {/* Rendered from the shared label map (config/banners.ts) so the
              form and the Save & Continue toast can't drift apart. */}
          {Object.entries(BANNER_LABELS).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </div>

      {/*
        Epic Modules section — rendered ABOVE Common/Rare deliberately
        (epic-first UX). Adding an epic auto-decrements Common (then Rare), and
        the freshly-added row's SearchSelect auto-opens. See file header.
      */}
      <div>
        {/* Span, not <label>: this heads a variable-length list of epic rows
            rather than one control. Epic purple is load-bearing here (it ties
            the section to the rarity it represents) and clears AA at 7.32:1
            on this surface. */}
        <MetaLabel
          color="var(--color-rarity-epic)"
          className="mb-2"
        >
          Epic Modules ({epicCount})
        </MetaLabel>
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
        labelColor="var(--color-rarity-rare)"
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
          Summary: {commonCount} common, {rareCount} rare, {epicCount} epic. 200 gems
        </p>
      </div>

      <div className="flex items-center pt-2">
        {/* Delete only renders in edit mode — onDelete is undefined for new pulls. */}
        {onDelete && (
          <Button variant="danger" onClick={onDelete}>
            Delete
          </Button>
        )}
        {/* flex-wrap + justify-end: add mode has three buttons, which is tight
            at ~400px phone widths. Wrapping keeps them right-aligned instead
            of overflowing the modal. */}
        <div className="flex flex-wrap justify-end gap-3 ml-auto">
          <Button variant="secondary" onClick={onCancel}>
            Cancel
          </Button>
          {/* Both save buttons are gated by `canSave` (10-drop invariant AND
              all epics selected); see "Validation contract" in the header.
              Save & Continue is add-mode only (onSaveAndContinue prop) and
              uses secondary styling so "Save Pull" stays the one primary CTA. */}
          {onSaveAndContinue && (
            <Button
              variant="secondary"
              onClick={handleSaveAndContinue}
              disabled={!canSave}
            >
              Save &amp; Continue
            </Button>
          )}
          <Button
            onClick={handleSubmit}
            disabled={!canSave}
          >
            Save Pull
          </Button>
        </div>
      </div>
    </div>
  );
}
