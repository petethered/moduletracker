interface NumberSelectProps {
  value: number;
  onChange: (value: number) => void;
  min: number;
  max: number;
  label?: string;
  "data-testid"?: string;
}

export function NumberSelect({
  value,
  onChange,
  min,
  max,
  label,
  "data-testid": testId,
}: NumberSelectProps) {
  return (
    <div>
      {label && (
        <label className="block text-xs uppercase tracking-wider text-gray-400 mb-1">
          {label}
        </label>
      )}
      <select
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        data-testid={testId}
        className="w-full px-3 py-2 rounded-lg bg-[var(--color-navy-800)] border border-[var(--color-navy-500)] text-gray-200 focus:outline-none focus:border-[var(--color-accent-gold)]"
      >
        {Array.from({ length: max - min + 1 }, (_, i) => min + i).map((n) => (
          <option key={n} value={n}>
            {n}
          </option>
        ))}
      </select>
    </div>
  );
}
