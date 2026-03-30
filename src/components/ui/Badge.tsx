interface BadgeProps {
  color: string;
  children: React.ReactNode;
  className?: string;
}

export function Badge({ color, children, className = "" }: BadgeProps) {
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${className}`}
      style={{ color, borderColor: color, border: "1px solid" }}
    >
      {children}
    </span>
  );
}
