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
    <div
      className="relative bg-[var(--color-navy-700)]/60 backdrop-blur-sm border border-[var(--color-navy-500)]/40 rounded-xl p-4 overflow-hidden transition-all duration-300 hover:border-opacity-60"
      style={{
        boxShadow: `inset 0 1px 0 rgba(255,255,255,0.03), 0 0 20px rgba(0,0,0,0.2)`,
      }}
    >
      {/* Subtle corner accent */}
      <div
        className="absolute top-0 left-0 w-8 h-[1px]"
        style={{ backgroundColor: color, opacity: 0.4 }}
      />
      <div
        className="absolute top-0 left-0 w-[1px] h-8"
        style={{ backgroundColor: color, opacity: 0.4 }}
      />
      <div
        className="text-[10px] uppercase tracking-[0.15em] mb-2 font-medium"
        style={{ color, fontFamily: "var(--font-body)" }}
      >
        {label}
      </div>
      <div
        className="text-2xl font-semibold text-white"
        style={{ fontFamily: "var(--font-mono)" }}
      >
        {value}
      </div>
      {subtitle && (
        <div
          className="text-[10px] text-gray-500 mt-1.5"
          style={{ fontFamily: "var(--font-body)" }}
        >
          {subtitle}
        </div>
      )}
    </div>
  );
}
