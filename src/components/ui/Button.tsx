import type { ButtonHTMLAttributes } from "react";

type ButtonVariant = "primary" | "secondary" | "danger" | "ghost";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
}

const variantClasses: Record<ButtonVariant, string> = {
  primary:
    "bg-gradient-to-r from-[var(--color-accent-crimson)] to-[#c23152] text-white hover:brightness-110",
  secondary:
    "bg-[var(--color-navy-500)] text-gray-200 hover:bg-[var(--color-navy-600)] border border-[var(--color-navy-500)]",
  danger: "bg-red-700 text-white hover:bg-red-600",
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
      className={`px-4 py-2 rounded-lg font-medium text-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed ${variantClasses[variant]} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}
