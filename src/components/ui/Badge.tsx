interface BadgeProps {
  color: string;
  children: React.ReactNode;
  className?: string;
}

export function Badge({ color, children, className = "" }: BadgeProps) {
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold tracking-wide ${className}`}
      style={{
        color,
        backgroundColor: color + "15",
        border: `1px solid ${color}40`,
        fontFamily: "var(--font-mono)",
      }}
    >
      {children}
    </span>
  );
}
