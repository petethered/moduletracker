import { useState, useRef, useEffect } from "react";
import { useRenderLog } from "../../utils/renderLog";

/**
 * SearchSelect — combobox-style dropdown with a built-in fuzzy(ish) text
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
 * Internal state (`isOpen`, `search`) is local because it's purely UI.
 *
 * Accessibility caveats: this is NOT a fully ARIA-compliant combobox. If
 * keyboard nav (arrow keys, Enter to select) is needed, plan to add
 * roving-tabindex + aria-activedescendant. Today it works mouse-first plus
 * type-and-click.
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
  // Wrapper ref used by the click-outside effect to detect outside-of-component
  // clicks. Must wrap BOTH the trigger and the panel.
  const ref = useRef<HTMLDivElement>(null);
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

  // Resolve the currently-selected label for the trigger. Falls back to
  // `undefined` if `value` doesn't match any option (e.g. stale data) so the
  // trigger then renders `placeholder` instead of an empty button.
  const selectedLabel = options.find((o) => o.value === value)?.label;

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full text-left px-3 py-2 rounded-lg bg-[var(--color-navy-800)] border border-[var(--color-navy-500)] text-gray-200 hover:border-[var(--color-accent-gold)] transition-colors"
      >
        {selectedLabel || placeholder}
      </button>
      {isOpen && (
        // Absolute positioning + `z-10` keeps the panel above sibling fields
        // without escaping a parent stacking context (e.g. when this lives
        // inside a Modal, which has its own z-50 portal layer).
        <div className="absolute z-10 mt-1 w-full bg-[var(--color-navy-700)] border border-[var(--color-navy-500)] rounded-lg shadow-xl max-h-60 overflow-y-auto">
          {/* Sticky search bar so it stays visible while the option list scrolls. */}
          <div className="p-2 sticky top-0 bg-[var(--color-navy-700)]">
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={placeholder}
              className="w-full px-3 py-2 rounded bg-[var(--color-navy-800)] border border-[var(--color-navy-500)] text-gray-200 text-sm focus:outline-none focus:border-[var(--color-accent-gold)]"
              // Autofocus on open so users can start typing immediately.
              autoFocus
            />
          </div>
          {filtered.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => {
                onChange(option.value);
                // Close + reset search on pick — same rationale as the
                // click-outside reset above.
                setIsOpen(false);
                setSearch("");
              }}
              className={`w-full text-left px-3 py-2 text-sm hover:bg-[var(--color-navy-600)] ${
                // Highlight the currently-selected row in gold so the user can
                // see what they had previously chosen even after typing.
                option.value === value
                  ? "text-[var(--color-accent-gold)]"
                  : "text-gray-300"
              }`}
            >
              {option.group && (
                <span className="text-xs text-gray-500 mr-2">
                  [{option.group}]
                </span>
              )}
              {option.label}
            </button>
          ))}
          {filtered.length === 0 && (
            // Empty-state row (not a button) — no action available.
            <div className="px-3 py-2 text-sm text-gray-500">No results</div>
          )}
        </div>
      )}
    </div>
  );
}
