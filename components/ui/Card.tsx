"use client";

import type { ReactNode } from "react";

export interface CardProps {
  selectable?: boolean;
  selected?: boolean;
  onClick?: () => void;
  children: ReactNode;
  className?: string;
}

export default function Card({ selectable, selected, onClick, children, className = "" }: CardProps) {
  return (
    <div
      onClick={selectable || onClick ? onClick : undefined}
      className={`
        bg-surface border rounded-lg transition-all
        ${selected ? "border-primary-light ring-2 ring-primary-light bg-primary-muted" : "border-[var(--neon-border-muted)]"}
        ${selectable && !selected ? "hover:-translate-y-0.5 hover:border-primary-light hover:ring-2 hover:ring-primary-light/40 cursor-pointer" : ""}
        ${onClick && !selectable ? "cursor-pointer hover:border-primary-light" : ""}
        ${className}
      `.trim().replace(/\s+/g, " ")}
    >
      {children}
    </div>
  );
}
