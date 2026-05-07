"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { isAuthenticated } from "@/lib/auth";
import { GlyphText, T4Screen, PixelAvatar, type PixelAvatarKind } from "@/components/arcade";
import { t4 } from "@/components/arcade/tokens";

const WORKSPACE_CREW: Array<[PixelAvatarKind, string, string]> = [
  ["mira", "HERO", t4.pink],
  ["alex", "MAGE", t4.mp],
  ["agent", "GUIDE", t4.agent],
  ["kenji", "RANGER", t4.ok],
];

const MENU = [
  { label: "LOGIN", href: "/auth", action: "login" as const },
  { label: "CONTINUE", href: "/workspaces", action: "continue" as const },
];

export default function LandingPage() {
  const router = useRouter();
  const [selected, setSelected] = useState(0);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowDown" || e.key === "ArrowRight") {
        e.preventDefault();
        setSelected((s) => (s + 1) % MENU.length);
      } else if (e.key === "ArrowUp" || e.key === "ArrowLeft") {
        e.preventDefault();
        setSelected((s) => (s - 1 + MENU.length) % MENU.length);
      } else if (e.key === "Enter") {
        e.preventDefault();
        const item = MENU[selected];
        if (item.action === "continue" && !isAuthenticated()) {
          router.push("/");
        } else {
          router.push(item.href);
        }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [router, selected]);

  const handleClick = (idx: number) => {
    setSelected(idx);
    const item = MENU[idx];
    if (item.action === "continue" && !isAuthenticated()) {
      router.push("/");
    } else {
      router.push(item.href);
    }
  };

  return (
    <T4Screen title="TITLE SCREEN">
      <div
        style={{
          height: "100%",
          position: "relative",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        {/* grid background */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            backgroundImage:
              "linear-gradient(rgba(154,122,255,0.08) 1px, transparent 1px),linear-gradient(90deg, rgba(154,122,255,0.08) 1px, transparent 1px)",
            backgroundSize: "32px 32px",
            maskImage:
              "radial-gradient(ellipse at 50% 60%, black 30%, transparent 80%)",
            WebkitMaskImage:
              "radial-gradient(ellipse at 50% 60%, black 30%, transparent 80%)",
          }}
        />
        {/* skyline */}
        <div
          style={{
            position: "absolute",
            bottom: 80,
            left: 0,
            right: 0,
            height: 80,
            backgroundImage: `linear-gradient(180deg, transparent, rgba(255,122,220,0.1)),repeating-linear-gradient(90deg, ${t4.panel} 0, ${t4.panel} 30px, ${t4.panelHi} 30px, ${t4.panelHi} 60px)`,
            maskImage: "linear-gradient(180deg, black 60%, transparent)",
            WebkitMaskImage: "linear-gradient(180deg, black 60%, transparent)",
            opacity: 0.5,
          }}
        />

        <div style={{ textAlign: "center", position: "relative", zIndex: 2 }}>
          <div
            style={{
              fontFamily: "var(--font-pixel)",
              fontSize: 11,
              letterSpacing: 4,
              color: t4.pink,
              marginBottom: 18,
              textShadow: `0 0 12px ${t4.pink}`,
              animation: "t4-pulse 1.4s ease-in-out infinite",
            }}
          >
            <GlyphText glyph="▶">PRESS START</GlyphText>
          </div>
          <h1
            style={{
              fontFamily: "var(--font-pixel)",
              fontSize: "clamp(36px, 8vw, 60px)",
              fontWeight: 400,
              lineHeight: 1.05,
              margin: 0,
              marginBottom: 10,
              color: t4.ink,
              letterSpacing: 4,
              textShadow: `4px 4px 0 ${t4.agent}, 8px 8px 0 ${t4.pink}, 0 0 30px rgba(154,122,255,0.6)`,
            }}
          >
            AI OFFICE
          </h1>
          <div
            style={{
              fontFamily: "var(--font-mono-arcade)",
              fontSize: 12,
              color: t4.dim,
              letterSpacing: 6,
              marginBottom: 38,
            }}
          >
            ─ A COOPERATIVE WORK RPG ─
          </div>

          {/* workspace preview */}
          <div
            style={{
              display: "flex",
              justifyContent: "center",
              gap: 26,
              marginBottom: 40,
              flexWrap: "wrap",
            }}
          >
            {WORKSPACE_CREW.map(([k, role, c]) => (
              <div key={k} style={{ textAlign: "center" }}>
                <div
                  style={{
                    width: 72,
                    height: 80,
                    border: `1px solid ${c}`,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    flexDirection: "column",
                    background: "var(--t4-tile-bg)",
                    boxShadow: `0 0 12px ${c}40`,
                    paddingBottom: 8,
                  }}
                >
                  <PixelAvatar kind={k} size={3} />
                </div>
                <div
                  style={{
                    fontFamily: "var(--font-pixel)",
                    fontSize: 7,
                    color: c,
                    marginTop: 6,
                    letterSpacing: 1.5,
                  }}
                >
                  {role}
                </div>
              </div>
            ))}
          </div>

          {/* menu */}
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: 6,
              alignItems: "center",
            }}
          >
            {MENU.map((item, idx) => {
              const sel = idx === selected;
              return (
                <button
                  key={item.label}
                  type="button"
                  onMouseEnter={() => setSelected(idx)}
                  onClick={() => handleClick(idx)}
                  style={{
                    fontFamily: "var(--font-pixel)",
                    fontSize: 11,
                    letterSpacing: 2,
                    color: sel ? t4.pink : t4.dim,
                    padding: "8px 28px",
                    background: sel
                      ? "color-mix(in srgb, var(--t4-pink) 10%, transparent)"
                      : "transparent",
                    border: sel
                      ? `1px solid ${t4.pink}`
                      : "1px solid transparent",
                    textShadow: sel ? `0 0 10px ${t4.pink}` : "none",
                    minWidth: 240,
                    textAlign: "left",
                    cursor: "pointer",
                    transition: "all 80ms ease-out",
                  }}
                >
                  {sel ? (
                    <GlyphText glyph="▶">{item.label}</GlyphText>
                  ) : (
                    <span className="pl-[calc(1.1em+6px)]">{item.label}</span>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* bottom hint */}
        <div
          style={{
            position: "absolute",
            bottom: 14,
            left: 0,
            right: 0,
            textAlign: "center",
            fontFamily: "var(--font-mono-arcade)",
            fontSize: 9,
            color: t4.dim,
            letterSpacing: 3,
          }}
        >
          [ ↑↓ SELECT ] [ ↵ CONFIRM ] © CLAW STUDIO 2026
        </div>
      </div>

      <style jsx global>{`
        @keyframes t4-pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.4; }
        }
      `}</style>
    </T4Screen>
  );
}
