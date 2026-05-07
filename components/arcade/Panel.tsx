"use client";

import type { CSSProperties, ReactNode } from "react";

interface T4PanelProps {
  children: ReactNode;
  label?: string;
  accent?: string;
  style?: CSSProperties;
  className?: string;
}

export default function T4Panel({
  children,
  label,
  accent = "var(--t4-pink)",
  style,
  className,
}: T4PanelProps) {
  return (
    <div
      className={className}
      style={{
        position: "relative",
        background: "rgba(20,28,55,0.85)",
        border: `1px solid ${accent}`,
        boxShadow: `0 0 0 1px rgba(0,0,0,0.6), inset 0 0 24px rgba(154,122,255,0.08), 0 0 16px ${accent}40`,
        ...style,
      }}
    >
      {label && (
        <div
          style={{
            position: "absolute",
            top: -8,
            left: 10,
            padding: "0 6px",
            background: "var(--t4-bg)",
            fontFamily: "var(--font-pixel)",
            fontSize: 7,
            letterSpacing: 2,
            color: accent,
            zIndex: 1,
          }}
        >
          {label}
        </div>
      )}
      {children}
    </div>
  );
}
