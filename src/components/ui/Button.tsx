import type { ButtonHTMLAttributes } from "react";

type ButtonVariant = "primary" | "secondary" | "danger" | "ghost";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
}

const variantClasses: Record<ButtonVariant, string> = {
  primary:
    "bg-gradient-to-r from-[var(--color-accent-crimson)] to-[#c23152] text-white hover:brightness-110 shadow-[0_0_16px_rgba(233,69,96,0.2)] hover:shadow-[0_0_24px_rgba(233,69,96,0.35)]",
  secondary:
    "bg-[var(--color-navy-600)] text-gray-200 hover:bg-[var(--color-navy-500)] border border-[var(--color-navy-500)] hover:border-[var(--color-accent-gold)]/30",
  danger: "bg-red-800/80 text-white hover:bg-red-700 border border-red-700/50",
  ghost: "text-gray-400 hover:text-gray-200 hover:bg-[var(--color-navy-600)]",
};

export function Button({
  variant = "primary",
  className = "",
  children,
  ...props
}: ButtonProps) {
  return (
    <button
      className={`px-4 py-2 rounded-lg font-medium text-sm transition-all duration-200 disabled:opacity-40 disabled:cursor-not-allowed disabled:shadow-none ${variantClasses[variant]} ${className}`}
      style={{ fontFamily: "var(--font-body)" }}
      {...props}
    >
      {children}
    </button>
  );
}
