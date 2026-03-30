interface DateInputProps {
  value: string;
  onChange: (value: string) => void;
  label?: string;
}

export function DateInput({ value, onChange, label }: DateInputProps) {
  return (
    <div>
      {label && (
        <label className="block text-xs uppercase tracking-wider text-gray-400 mb-1">
          {label}
        </label>
      )}
      <input
        type="date"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full px-3 py-2 rounded-lg bg-[var(--color-navy-800)] border border-[var(--color-navy-500)] text-gray-200 focus:outline-none focus:border-[var(--color-accent-gold)]"
      />
    </div>
  );
}
