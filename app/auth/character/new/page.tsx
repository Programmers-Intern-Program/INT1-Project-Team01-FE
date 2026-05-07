"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { isAuthenticated } from "@/lib/auth";
import {
  GlyphText,
  T4Screen,
  T4Panel,
  T4Bar,
  PixelAvatar,
  type PixelAvatarKind,
} from "@/components/arcade";
import { t4 } from "@/components/arcade/tokens";

interface HeroClass {
  name: string;
  sub: string;
  accent: string;
  pic: PixelAvatarKind;
  displayName: string;
  hp: number;
  mp: number;
  stats: Array<[string, number]>;
  skills: Array<{ name: string; detail: string; locked?: boolean }>;
}

const CLASSES: HeroClass[] = [
  {
    name: "BACKEND MAGE",
    sub: "casts spells in code",
    accent: t4.mp,
    pic: "kenji",
    displayName: "KENJI",
    hp: 36,
    mp: 38,
    stats: [["CRAFT", 16], ["WIT", 14], ["FOCUS", 13], ["CHARM", 8], ["STAMINA", 10], ["LUCK", 7]],
    skills: [
      { name: "Cast Patch", detail: "2 MP" },
      { name: "Refactor Aura", detail: "+3 focus" },
      { name: "Summon Worker", detail: "🔒 LV.5", locked: true },
    ],
  },
  {
    name: "DESIGN BARD",
    sub: "persuades pixels",
    accent: t4.pink,
    pic: "mira",
    displayName: "MIRA",
    hp: 42,
    mp: 28,
    stats: [["CRAFT", 14], ["WIT", 12], ["FOCUS", 9], ["CHARM", 16], ["STAMINA", 11], ["LUCK", 8]],
    skills: [
      { name: "Inspire Team", detail: "+5 morale" },
      { name: "Sketch Idea", detail: "1 MP" },
      { name: "Critique", detail: "🔒 LV.5", locked: true },
    ],
  },
  {
    name: "DATA RANGER",
    sub: "tracks distant data",
    accent: t4.ok,
    pic: "alex",
    displayName: "ALEX",
    hp: 40,
    mp: 30,
    stats: [["CRAFT", 12], ["WIT", 15], ["FOCUS", 14], ["CHARM", 9], ["STAMINA", 12], ["LUCK", 10]],
    skills: [
      { name: "Quick Query", detail: "1 MP" },
      { name: "Pattern Sense", detail: "+2 wit" },
      { name: "Forecast", detail: "🔒 LV.5", locked: true },
    ],
  },
  {
    name: "OPS PALADIN",
    sub: "guards the deploys",
    accent: t4.xp,
    pic: "diego",
    displayName: "DIEGO",
    hp: 50,
    mp: 22,
    stats: [["CRAFT", 11], ["WIT", 10], ["FOCUS", 12], ["CHARM", 9], ["STAMINA", 16], ["LUCK", 8]],
    skills: [
      { name: "Shield Wall", detail: "+10 hp" },
      { name: "Hot Patch", detail: "2 MP" },
      { name: "Rollback", detail: "🔒 LV.5", locked: true },
    ],
  },
  {
    name: "PROMPT WITCH",
    sub: "whispers to agents",
    accent: t4.agent,
    pic: "iris",
    displayName: "IRIS",
    hp: 32,
    mp: 44,
    stats: [["CRAFT", 13], ["WIT", 16], ["FOCUS", 14], ["CHARM", 12], ["STAMINA", 8], ["LUCK", 9]],
    skills: [
      { name: "Whisper", detail: "1 MP" },
      { name: "Bind Agent", detail: "+1 ally" },
      { name: "Hex Loop", detail: "🔒 LV.5", locked: true },
    ],
  },
  {
    name: "PRODUCT HEALER",
    sub: "mends what users break",
    accent: t4.hp,
    pic: "yuna",
    displayName: "YUNA",
    hp: 46,
    mp: 26,
    stats: [["CRAFT", 10], ["WIT", 12], ["FOCUS", 11], ["CHARM", 14], ["STAMINA", 14], ["LUCK", 10]],
    skills: [
      { name: "Mend Bug", detail: "2 MP" },
      { name: "Listen", detail: "+3 charm" },
      { name: "Triage Aura", detail: "🔒 LV.5", locked: true },
    ],
  },
];

export default function NewHeroPage() {
  return (
    <Suspense fallback={null}>
      <NewHeroInner />
    </Suspense>
  );
}

function NewHeroInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const returnTo = safeReturnTo(searchParams.get("returnTo"));
  const [selected, setSelected] = useState(1);

  useEffect(() => {
    if (!isAuthenticated()) router.replace("/auth");
  }, [router]);

  const hero = CLASSES[selected];

  const back = () => router.back();
  const next = () => router.replace(returnTo);

  return (
    <T4Screen title="CHARACTER · CLASS SELECT">
      <div
        style={{
          padding: 20,
          height: "100%",
          boxSizing: "border-box",
          display: "grid",
          gridTemplateColumns: "1fr 320px",
          gap: 16,
        }}
      >
        <div style={{ display: "flex", flexDirection: "column", minWidth: 0 }}>
          <div style={{ marginBottom: 14 }}>
            <div
              style={{
                fontFamily: "var(--font-pixel)",
                fontSize: 8,
                color: t4.pink,
                letterSpacing: 3,
                marginBottom: 4,
              }}
            >
              <GlyphText glyph="◆">STEP 02 / 04</GlyphText>
            </div>
            <h2
              style={{
                fontFamily: "var(--font-pixel)",
                fontSize: 22,
                letterSpacing: 2,
                margin: 0,
                color: t4.ink,
                textShadow: `0 0 12px ${t4.pink}80`,
              }}
            >
              PICK YOUR CLASS
            </h2>
            <div
              style={{
                fontFamily: "var(--font-mono-arcade)",
                fontSize: 11,
                color: t4.dim,
                marginTop: 6,
              }}
            >
              cosmetic only — you can multiclass later. probably.
            </div>
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(3, 1fr)",
              gap: 10,
              flex: 1,
              minHeight: 0,
            }}
          >
            {CLASSES.map((c, i) => {
              const sel = i === selected;
              return (
                <button
                  key={c.name}
                  type="button"
                  onMouseEnter={() => setSelected(i)}
                  onClick={() => setSelected(i)}
                  style={{
                    position: "relative",
                    background: sel ? "rgba(255,122,220,0.06)" : "rgba(20,28,55,0.5)",
                    border: `1px solid ${sel ? t4.pink : t4.line}`,
                    boxShadow: sel ? `0 0 16px ${t4.pink}60` : "none",
                    padding: 14,
                    cursor: "pointer",
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    gap: 8,
                    fontFamily: "var(--font-sans)",
                    color: t4.ink,
                  }}
                >
                  {sel && (
                    <div
                      style={{
                        position: "absolute",
                        top: -1,
                        left: -1,
                        background: t4.pink,
                        color: "#000",
                        fontFamily: "var(--font-pixel)",
                        fontSize: 7,
                        letterSpacing: 1,
                        padding: "2px 6px",
                      }}
                    >
                      ◆
                    </div>
                  )}
                  <div
                    style={{
                      background: "rgba(0,0,0,0.4)",
                      padding: 10,
                      border: `1px solid ${c.accent}`,
                      boxShadow: `0 0 10px ${c.accent}40`,
                    }}
                  >
                    <PixelAvatar kind={c.pic} size={4} />
                  </div>
                  <div
                    style={{
                      fontFamily: "var(--font-pixel)",
                      fontSize: 8,
                      letterSpacing: 1.5,
                      color: sel ? t4.pink : t4.ink,
                      textAlign: "center",
                    }}
                  >
                    {c.name}
                  </div>
                  <div
                    style={{
                      fontFamily: "var(--font-mono-arcade)",
                      fontStyle: "italic",
                      fontSize: 9,
                      color: t4.dim,
                      textAlign: "center",
                    }}
                  >
                    {c.sub}
                  </div>
                </button>
              );
            })}
          </div>

          <div
            style={{
              marginTop: 14,
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <div
              style={{
                fontFamily: "var(--font-pixel)",
                fontSize: 8,
                color: t4.dim,
                letterSpacing: 2,
              }}
            >
              <span className="inline-flex items-center gap-2">
                <span style={{ fontFamily: "var(--font-sans)", letterSpacing: 0 }}>●</span>
                <span style={{ fontFamily: "var(--font-sans)", letterSpacing: 0 }}>◆</span>
                <span style={{ fontFamily: "var(--font-sans)", letterSpacing: 0 }}>○</span>
                <span style={{ fontFamily: "var(--font-sans)", letterSpacing: 0 }}>○</span>
                <span>STEP 02 / 04</span>
              </span>
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <button
                type="button"
                onClick={back}
                style={{
                  fontFamily: "var(--font-pixel)",
                  fontSize: 9,
                  padding: "10px 16px",
                  border: `1px solid ${t4.line}`,
                  color: t4.dim,
                  letterSpacing: 1,
                  background: "transparent",
                  cursor: "pointer",
                }}
              >
                <GlyphText glyph="←">BACK</GlyphText>
              </button>
              <button
                type="button"
                onClick={next}
                style={{
                  fontFamily: "var(--font-pixel)",
                  fontSize: 9,
                  padding: "10px 16px",
                  background: t4.pink,
                  color: "#000",
                  letterSpacing: 1,
                  boxShadow: `0 0 12px ${t4.pink}`,
                  border: `1px solid ${t4.pink}`,
                  cursor: "pointer",
                }}
              >
                <GlyphText glyph="▶" glyphPosition="end">NEXT</GlyphText>
              </button>
            </div>
          </div>
        </div>

        <T4Panel
          label="HERO SHEET"
          accent={t4.pink}
          style={{
            position: "relative",
            padding: 18,
            display: "flex",
            flexDirection: "column",
          }}
        >
          <div
            style={{
              display: "flex",
              gap: 12,
              alignItems: "flex-start",
              marginBottom: 14,
            }}
          >
            <div
              style={{
                background: "rgba(0,0,0,0.4)",
                padding: 12,
                border: `1px solid ${t4.pink}`,
              }}
            >
              <PixelAvatar kind={hero.pic} size={5} />
            </div>
            <div>
              <div
                style={{
                  fontFamily: "var(--font-pixel)",
                  fontSize: 12,
                  color: t4.ink,
                  letterSpacing: 1,
                }}
              >
                {hero.displayName}
              </div>
              <div
                style={{
                  fontFamily: "var(--font-pixel)",
                  fontSize: 7,
                  color: t4.pink,
                  letterSpacing: 2,
                  marginTop: 4,
                }}
              >
                {hero.name}
              </div>
              <div
                style={{
                  fontFamily: "var(--font-pixel)",
                  fontSize: 16,
                  color: t4.xp,
                  marginTop: 8,
                  textShadow: `0 0 8px ${t4.xp}`,
                }}
              >
                LV.01
              </div>
            </div>
          </div>

          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: 8,
              marginBottom: 14,
            }}
          >
            <T4Bar label="HP" value={hero.hp} max={hero.hp} color={t4.hp} width="100%" />
            <T4Bar label="MP" value={hero.mp} max={hero.mp} color={t4.mp} width="100%" />
            <T4Bar label="XP" value={0} max={100} color={t4.xp} width="100%" />
          </div>

          <div
            style={{
              fontFamily: "var(--font-pixel)",
              fontSize: 7,
              color: t4.dim,
              letterSpacing: 2,
              marginBottom: 6,
            }}
          >
            STATS
          </div>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: 4,
              fontFamily: "var(--font-mono-arcade)",
              fontSize: 11,
            }}
          >
            {hero.stats.map(([s, v]) => (
              <div key={s} style={{ display: "contents" }}>
                <span style={{ color: t4.dim, fontSize: 9, letterSpacing: 1 }}>{s}</span>
                <span style={{ color: t4.ink, textAlign: "right" }}>{v}</span>
              </div>
            ))}
          </div>

          <div
            style={{
              fontFamily: "var(--font-pixel)",
              fontSize: 7,
              color: t4.dim,
              letterSpacing: 2,
              marginTop: 14,
              marginBottom: 6,
            }}
          >
            STARTING SKILLS
          </div>
          <div
            style={{
              fontFamily: "var(--font-mono-arcade)",
              fontSize: 10,
              color: t4.ink,
              lineHeight: 1.7,
            }}
          >
            {hero.skills.map((sk) => (
              <div key={sk.name}>
                <GlyphText glyph="◇">
                  <span style={{ color: sk.locked ? t4.dim : t4.pink }}>{sk.name}</span>{" "}
                  · {sk.detail}
                </GlyphText>
              </div>
            ))}
          </div>
        </T4Panel>
      </div>
    </T4Screen>
  );
}

function safeReturnTo(raw: string | null): string {
  if (!raw) return "/workspaces";
  if (!raw.startsWith("/") || raw.startsWith("//")) return "/workspaces";
  return raw;
}
