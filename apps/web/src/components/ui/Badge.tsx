import { type ReactNode } from "react";

interface BadgeProps {
  children: ReactNode;
  variant?: "default" | "accent" | "success" | "muted";
  className?: string;
}

const variants = {
  default: "bg-slate-100 text-slate-700",
  accent: "bg-indigo-50 text-indigo-700",
  success: "bg-emerald-50 text-emerald-700",
  muted: "bg-slate-50 text-slate-500",
};

export function Badge({ children, variant = "default", className = "" }: BadgeProps) {
  return (
    <span
      className={`inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium tabular-nums ${variants[variant]} ${className}`}
    >
      {children}
    </span>
  );
}
