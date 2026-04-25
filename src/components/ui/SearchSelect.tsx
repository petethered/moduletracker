import { useState, useRef, useEffect } from "react";
import { useRenderLog } from "../../utils/renderLog";

interface Option {
  value: string;
  label: string;
  group?: string;
}

interface SearchSelectProps {
  options: Option[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  defaultOpen?: boolean;
}

export function SearchSelect({
  options,
  value,
  onChange,
  placeholder = "Search...",
  defaultOpen = false,
}: SearchSelectProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  const [search, setSearch] = useState("");
  const ref = useRef<HTMLDivElement>(null);
  useRenderLog("SearchSelect", { value, isOpen });

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setIsOpen(false);
        setSearch("");
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const filtered = options.filter((o) =>
    o.label.toLowerCase().includes(search.toLowerCase())
  );

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
        <div className="absolute z-10 mt-1 w-full bg-[var(--color-navy-700)] border border-[var(--color-navy-500)] rounded-lg shadow-xl max-h-60 overflow-y-auto">
          <div className="p-2 sticky top-0 bg-[var(--color-navy-700)]">
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={placeholder}
              className="w-full px-3 py-2 rounded bg-[var(--color-navy-800)] border border-[var(--color-navy-500)] text-gray-200 text-sm focus:outline-none focus:border-[var(--color-accent-gold)]"
              autoFocus
            />
          </div>
          {filtered.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => {
                onChange(option.value);
                setIsOpen(false);
                setSearch("");
              }}
              className={`w-full text-left px-3 py-2 text-sm hover:bg-[var(--color-navy-600)] ${
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
            <div className="px-3 py-2 text-sm text-gray-500">No results</div>
          )}
        </div>
      )}
    </div>
  );
}
