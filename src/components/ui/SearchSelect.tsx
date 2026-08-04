import { useState, useRef, useEffect, useId } from "react";
import { useRenderLog } from "../../utils/renderLog";

/**
 * SearchSelect — combobox-style dropdown with a built-in substring text
 * filter. Replaces a native `<select>` when the option list is long enough to
 * benefit from search-as-you-type.
 *
 * Where it's used: module pickers in the add-pull / edit-pull modals, epic
 * selectors in the analytics filter, anywhere we need to pick one of many
 * named records.
 *
 * Composition pattern:
 *   - Trigger button shows the selected label (or placeholder).
 *   - Click trigger → opens a panel containing a sticky search input plus a
 *     scroll list of filtered options. Search input is autofocused for fast
 *     keyboard-first selection.
 *   - Click-outside (mousedown anywhere outside the wrapper ref) closes the
 *     panel and clears the search.
 *
 * Controlled component: `value` and `onChange` are owned by the parent.
 * Internal state (`isOpen`, `search`, `activeIndex`) is local because it's
 * purely UI.
 *
 * --- ARIA pattern: combobox + listbox popup ---
 * This follows the WAI-ARIA "combobox with listbox popup" pattern. It used to
 * be mouse-first only (no roles, no keyboard nav, no Escape), which made the
 * epic-module picker in the add-pull modal unusable without a pointer.
 *
 *   - The SEARCH INPUT is the combobox (role="combobox"), not the trigger
 *     button. That is what carries aria-expanded / aria-controls /
 *     aria-activedescendant, because it is what holds DOM focus while the
 *     popup is open.
 *   - Options are NOT focused directly. Focus stays in the input and
 *     `aria-activedescendant` points at the visually-highlighted option. This
 *     is the standard approach for a searchable listbox: moving real DOM focus
 *     onto options would break type-to-filter.
 *   - The trigger button keeps only `aria-haspopup` + `aria-expanded`. It
 *     deliberately does NOT get `aria-controls`: while the popup is open the
 *     input is the combobox that owns the listbox, and having two elements
 *     both claim ownership confuses AT. The trigger is just an open/close
 *     affordance at that point.
 *
 * Keyboard contract:
 *   ArrowDown / ArrowUp  move the active option (wraps at both ends)
 *   Home / End           jump to first / last option
 *   Enter                select the active option
 *   Escape               close, clear search, return focus to the trigger
 *   Tab                  close and let focus move on naturally
 */

/**
 * A single selectable option.
 */
interface Option {
  /** Stable identifier passed back via `onChange`. Must be unique across `options`. */
  value: string;
  /** Human-readable label shown in the trigger and list, and matched by search. */
  label: string;
  /**
   * Optional grouping tag. Rendered as a small `[group]` prefix in the list.
   * Note: this does NOT visually section the list — it only annotates rows.
   */
  group?: string;
}

/**
 * Props for {@link SearchSelect}.
 */
interface SearchSelectProps {
  /** Full option set. Filtering happens client-side over `label`. */
  options: Option[];
  /**
   * Currently selected option's `value`. Empty string means "nothing selected"
   * and falls through to rendering `placeholder` in the trigger.
   */
  value: string;
  /** Fires with the chosen option's `value` when the user picks a row. */
  onChange: (value: string) => void;
  /** Trigger label when nothing is selected, and the search input placeholder. */
  placeholder?: string;
  /**
   * If `true`, the panel mounts already open. Used by the add-pull modal which
   * wants the search box focused immediately on open. Defaults to `false`.
   */
  defaultOpen?: boolean;
}

export function SearchSelect({
  options,
  value,
  onChange,
  placeholder = "Search...",
  defaultOpen = false,
}: SearchSelectProps) {
  // `isOpen` controls the panel; `search` is the live filter text. Both are
  // local because no parent has ever needed to read or override them.
  const [isOpen, setIsOpen] = useState(defaultOpen);
  const [search, setSearch] = useState("");
  // Index into `filtered` of the keyboard-highlighted option. -1 means "no
  // active option" (fresh open, or the filter matched nothing).
  const [activeIndex, setActiveIndex] = useState(-1);

  // Wrapper ref used by the click-outside effect to detect outside-of-component
  // clicks. Must wrap BOTH the trigger and the panel.
  const ref = useRef<HTMLDivElement>(null);
  // Trigger ref so Escape can hand focus back to it.
  const triggerRef = useRef<HTMLButtonElement>(null);
  // Listbox ref so we can scroll the active option into view.
  const listRef = useRef<HTMLDivElement>(null);

  // Stable id prefix for the listbox + option ids that aria-activedescendant
  // and aria-controls point at. `useId` because several SearchSelects are
  // mounted at once (one per epic row in PullForm) and hardcoded ids collide.
  const baseId = useId();
  const listboxId = `${baseId}-listbox`;
  const optionId = (index: number) => `${baseId}-option-${index}`;

  useRenderLog("SearchSelect", { value, isOpen });

  // Click-outside handler. Listens on `mousedown` (not `click`) so the panel
  // closes before any inner button's click fires — prevents the panel from
  // briefly flashing closed-then-open when the user clicks the trigger again.
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setIsOpen(false);
        // Reset search so re-opening starts fresh — matches the user's mental
        // model of "the dropdown forgets what I typed when I leave it".
        setSearch("");
        setActiveIndex(-1);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  // Case-insensitive substring match on `label`. Deliberately simple — no
  // fuzzy ranking — because option lists are small (hundreds at most) and
  // users typically know the exact module name. Upgrade to fuse.js only if a
  // real need appears.
  const filtered = options.filter((o) =>
    o.label.toLowerCase().includes(search.toLowerCase())
  );

  const selectedLabel = options.find((o) => o.value === value)?.label;

  // Reset the highlight whenever the panel opens or the result set changes.
  // Without this, typing a narrower query can leave activeIndex pointing past
  // the end of `filtered` and Enter would select nothing (or the wrong row).
  //
  // The `isOpen` guard AND dep are both load-bearing. Previously this ran on
  // mount and keyed only on [search, filtered.length], which produced two
  // different behaviours for the same visible state: a panel opened via
  // `defaultOpen` had option 0 highlighted, but one closed with an empty
  // search and reopened had nothing highlighted (closing sets search to "",
  // which was already "", so the deps never changed and this never re-fired).
  // Now every open starts from the same place.
  useEffect(() => {
    if (!isOpen) return;
    setActiveIndex(filtered.length > 0 ? 0 : -1);
  }, [isOpen, search, filtered.length]);

  // Keep the highlighted option visible while arrowing through a long list.
  // `block: "nearest"` scrolls the minimum amount rather than centring, which
  // avoids the list jumping on every keypress.
  useEffect(() => {
    if (!isOpen || activeIndex < 0 || !listRef.current) return;
    const el = listRef.current.querySelector<HTMLElement>(
      `#${CSS.escape(optionId(activeIndex))}`
    );
    // Optional-call the method, not just the element: jsdom does not implement
    // scrollIntoView, and an unguarded call throws inside this passive effect,
    // which made every test that renders an OPEN SearchSelect crash. Guarding
    // here rather than polyfilling in test-setup keeps the component honest
    // about depending on a non-universal DOM API.
    el?.scrollIntoView?.({ block: "nearest" });
    // optionId is derived from the stable baseId, so it is not a real dep.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeIndex, isOpen]);

  /** Commit an option and close the panel. Shared by click and Enter. */
  function selectOption(optionValue: string) {
    onChange(optionValue);
    setIsOpen(false);
    setSearch("");
    setActiveIndex(-1);
  }

  /** Close without committing, returning focus to the trigger. */
  function closeAndRestoreFocus() {
    setIsOpen(false);
    setSearch("");
    setActiveIndex(-1);
    triggerRef.current?.focus();
  }

  function handleInputKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    switch (e.key) {
      case "ArrowDown":
        // preventDefault stops the caret jumping to the end of the input and
        // stops the page scrolling.
        e.preventDefault();
        if (filtered.length === 0) return;
        setActiveIndex((i) => (i + 1) % filtered.length);
        break;
      case "ArrowUp":
        e.preventDefault();
        if (filtered.length === 0) return;
        // + length before % so -1 wraps to the last item rather than going
        // negative.
        setActiveIndex((i) => (i - 1 + filtered.length) % filtered.length);
        break;
      case "Home":
        e.preventDefault();
        if (filtered.length > 0) setActiveIndex(0);
        break;
      case "End":
        e.preventDefault();
        if (filtered.length > 0) setActiveIndex(filtered.length - 1);
        break;
      case "Enter":
        // Guard the index: Enter on a zero-result search must do nothing
        // rather than throw on filtered[-1].
        e.preventDefault();
        if (activeIndex >= 0 && activeIndex < filtered.length) {
          selectOption(filtered[activeIndex].value);
          triggerRef.current?.focus();
        }
        break;
      case "Escape":
        // stopPropagation so Escape dismisses only the dropdown, not the
        // enclosing Modal. Without this, cancelling a module picker would
        // throw away the whole half-filled pull form.
        e.preventDefault();
        e.stopPropagation();
        closeAndRestoreFocus();
        break;
      case "Tab":
        // Let focus leave naturally, but don't leave an orphaned open panel.
        setIsOpen(false);
        setSearch("");
        setActiveIndex(-1);
        break;
    }
  }

  return (
    <div ref={ref} className="relative">
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        // aria-haspopup tells AT a listbox will appear. aria-expanded mirrors
        // isOpen. The combobox role itself lives on the search input below,
        // because that is what holds focus while the popup is open.
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        className="w-full text-left px-3 py-2 rounded-lg bg-[var(--color-navy-800)] border border-[var(--color-navy-500)] text-gray-200 hover:border-[var(--color-accent-gold)] transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-accent-gold)]"
      >
        {selectedLabel || placeholder}
      </button>
      {isOpen && (
        <div className="absolute z-10 mt-1 w-full bg-[var(--color-navy-700)] border border-[var(--color-navy-500)] rounded-lg shadow-xl max-h-60 overflow-y-auto">
          {/* Sticky search bar so it stays visible while the option list scrolls. */}
          <div className="p-2 sticky top-0 bg-[var(--color-navy-700)]">
            <input
              type="text"
              role="combobox"
              aria-expanded="true"
              aria-controls={listboxId}
              aria-autocomplete="list"
              // Points at the highlighted option WITHOUT moving DOM focus, so
              // typing keeps working. Undefined (not "") when nothing is
              // active — an empty string is an invalid idref.
              aria-activedescendant={
                activeIndex >= 0 ? optionId(activeIndex) : undefined
              }
              aria-label={placeholder}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={handleInputKeyDown}
              placeholder={placeholder}
              className="w-full px-3 py-2 rounded-lg bg-[var(--color-navy-800)] border border-[var(--color-navy-500)] text-gray-200 text-sm focus:outline-none focus:border-[var(--color-accent-gold)]"
              autoFocus
            />
          </div>
          <div ref={listRef} role="listbox" id={listboxId}>
            {filtered.map((option, index) => (
              <button
                key={option.value}
                id={optionId(index)}
                type="button"
                role="option"
                aria-selected={option.value === value}
                // tabIndex={-1} keeps options out of the tab order: they are
                // driven by aria-activedescendant from the input, and making
                // them real tab stops would mean tabbing through hundreds of
                // modules to escape the dropdown.
                tabIndex={-1}
                // Pointer hover moves the highlight too, so mouse and keyboard
                // agree on what Enter would select.
                onMouseEnter={() => setActiveIndex(index)}
                onClick={() => {
                  selectOption(option.value);
                  triggerRef.current?.focus();
                }}
                className={`w-full text-left px-3 py-2 text-sm ${
                  index === activeIndex ? "bg-[var(--color-navy-600)]" : ""
                } ${
                  option.value === value
                    ? "text-[var(--color-accent-gold)]"
                    : "text-gray-300"
                }`}
              >
                {option.group && (
                  <span className="text-xs text-gray-400 mr-2">
                    [{option.group}]
                  </span>
                )}
                {option.label}
              </button>
            ))}
          </div>
          {filtered.length === 0 && (
            // Sits OUTSIDE the listbox on purpose: owned children of a
            // role="listbox" must be option/group, so a role="status" node
            // nested inside it is invalid and AT may not expose it.
            // role="status" itself is what announces the empty result without
            // the user having to arrow into an empty list.
            <div role="status" className="px-3 py-2 text-sm text-gray-400">
              No results
            </div>
          )}
        </div>
      )}
    </div>
  );
}
