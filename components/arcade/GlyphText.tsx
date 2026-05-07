"use client";

import type { CSSProperties, ReactNode } from "react";

type GlyphTextProps = {
  glyph: string;
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
  truncate?: boolean;
  glyphPosition?: "start" | "end";
};

export default function GlyphText({
  glyph,
  children,
  className,
  style,
  truncate = false,
  glyphPosition = "start",
}: GlyphTextProps) {
  const glyphNode = (
    <span
      aria-hidden="true"
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        flex: "0 0 1.1em",
        width: "1.1em",
        fontFamily: "var(--font-sans)",
        fontSize: "1.1em",
        lineHeight: 1,
        letterSpacing: 0,
      }}
    >
      {glyph}
    </span>
  );

  return (
    <span
      className={className}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        minWidth: 0,
        maxWidth: "100%",
        verticalAlign: "middle",
        ...style,
      }}
    >
      {glyphPosition === "start" && glyphNode}
      <span className={truncate ? "min-w-0 truncate" : "min-w-0"}>
        {children}
      </span>
      {glyphPosition === "end" && glyphNode}
    </span>
  );
}
