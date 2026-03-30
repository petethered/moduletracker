interface StatCardProps {
  label: string;
  value: string | number;
  subtitle?: string;
  color?: string;
}

export function StatCard({
  label,
  value,
  subtitle,
  color = "var(--color-accent-gold)",
}: StatCardProps) {
  return (
    <div className="bg-[var(--color-navy-600)] border border-[var(--color-navy-500)] rounded-xl p-4">
      <div
        className="text-xs uppercase tracking-wider mb-1 font-medium"
        style={{ color }}
      >
        {label}
      </div>
      <div className="text-2xl font-bold text-white">{value}</div>
      {subtitle && <div className="text-xs text-gray-400 mt-1">{subtitle}</div>}
    </div>
  );
}
