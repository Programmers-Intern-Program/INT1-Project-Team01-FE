"use client";

import { useEffect, useState, type CSSProperties, type ReactNode } from "react";
import GlyphText from "./GlyphText";

interface T4ScreenProps {
  children: ReactNode;
  title?: string;
  className?: string;
  style?: CSSProperties;
}

export default function T4Screen({
  children,
  title = "AI OFFICE · CHAPTER IV",
  className,
  style,
}: T4ScreenProps) {
  const [clock, setClock] = useState<string>("--:--:--");

  useEffect(() => {
    const tick = () => {
      const d = new Date();
      const hh = d.getHours().toString().padStart(2, "0");
      const mm = d.getMinutes().toString().padStart(2, "0");
      const ss = d.getSeconds().toString().padStart(2, "0");
      setClock(`${hh}:${mm}:${ss}`);
    };
    tick();
    const id = window.setInterval(tick, 1000);
    return () => window.clearInterval(id);
  }, []);

  return (
    <div
      className={className}
      style={{
        position: "relative",
        width: "100%",
        minHeight: "100dvh",
        background: "#000",
        padding: 14,
        boxSizing: "border-box",
        fontFamily: "var(--font-sans)",
        color: "var(--t4-ink)",
        overflow: "hidden",
        ...style,
      }}
    >
      <div
        style={{
          position: "absolute",
          inset: 14,
          background: "var(--t4-bg)",
          boxShadow:
            "inset 0 0 80px rgba(90,168,255,0.15), inset 0 0 0 1px var(--t4-line)",
          backgroundImage:
            "repeating-linear-gradient(0deg, rgba(0,0,0,0.18) 0, rgba(0,0,0,0.18) 1px, transparent 1px, transparent 3px),radial-gradient(ellipse at center, rgba(20,30,80,0) 30%, rgba(0,0,0,0.55) 100%)",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            height: 28,
            display: "flex",
            alignItems: "center",
            gap: 14,
            padding: "0 14px",
            fontFamily: "var(--font-mono-arcade)",
            fontSize: 10,
            letterSpacing: 1,
            color: "var(--t4-dim)",
            background: "linear-gradient(180deg, rgba(90,168,255,0.10), transparent)",
            borderBottom: "1px solid var(--t4-line)",
            zIndex: 5,
          }}
        >
          <span
            style={{
              color: "var(--t4-pink)",
              fontFamily: "var(--font-pixel)",
              fontSize: 8,
              letterSpacing: 1,
            }}
          >
            <GlyphText glyph="◆">AI OFFICE</GlyphText>
          </span>
          <span style={{ textTransform: "uppercase" }}>{title}</span>
          <span style={{ marginLeft: "auto" }}>{clock}</span>
        </div>
        <div
          style={{
            position: "absolute",
            top: 28,
            bottom: 0,
            left: 0,
            right: 0,
          }}
        >
          {children}
        </div>
      </div>
    </div>
  );
}
