"use client";

import type { CSSProperties } from "react";

interface T4BarProps {
  label: string;
  value: number;
  max: number;
  color?: string;
  width?: number | string;
  style?: CSSProperties;
}

export default function T4Bar({
  label,
  value,
  max,
  color = "var(--t4-mp)",
  width = 160,
  style,
}: T4BarProps) {
  const pct = Math.max(0, Math.min(1, max > 0 ? value / max : 0));
  return (
    <div style={{ width, ...style }}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          fontFamily: "var(--font-mono-arcade)",
          fontSize: 8,
          letterSpacing: 1,
          color: "var(--t4-dim)",
          marginBottom: 2,
          textTransform: "uppercase",
        }}
      >
        <span>{label}</span>
        <span style={{ color: "var(--t4-ink)" }}>
          {value}/{max}
        </span>
      </div>
      <div
        style={{
          height: 8,
          background: "#0a0d1a",
          border: "1px solid var(--t4-line)",
          position: "relative",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            width: `${pct * 100}%`,
            height: "100%",
            background: color,
            boxShadow: `0 0 10px ${color}`,
          }}
        />
        <div
          style={{
            position: "absolute",
            inset: 0,
            backgroundImage:
              "repeating-linear-gradient(90deg, transparent 0, transparent 13px, rgba(0,0,0,0.5) 13px, rgba(0,0,0,0.5) 14px)",
          }}
        />
      </div>
    </div>
  );
}
