"use client";

import type { ReactNode } from "react";

export interface BadgeProps {
  variant?: "default" | "agent" | "danger" | "success" | "info" | "warning";
  size?: "sm" | "md";
  children: ReactNode;
  className?: string;
}

const VARIANT_CLASSES: Record<string, string> = {
  default: "bg-surface-raised text-text-secondary",
  agent: "bg-agent/15 text-agent-dark",
  danger: "bg-danger/15 text-danger",
  success: "bg-success/15 text-success",
  info: "bg-info/15 text-info",
  warning: "bg-warning/15 text-warning",
};

const SIZE_CLASSES: Record<string, string> = {
  sm: "text-micro px-1.5 py-0.5",
  md: "text-caption px-2 py-0.5",
};

export default function Badge({ variant = "default", size = "sm", children, className = "" }: BadgeProps) {
  return (
    <span
      className={`
        inline-flex items-center gap-1 rounded-full font-semibold
        ${VARIANT_CLASSES[variant]}
        ${SIZE_CLASSES[size]}
        ${className}
      `.trim().replace(/\s+/g, " ")}
    >
      {children}
    </span>
  );
}
