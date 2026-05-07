"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { isAuthenticated } from "@/lib/auth";
import {
  GlyphText,
  T4Screen,
  T4Bar,
  PixelAvatar,
  type PixelAvatarKind,
} from "@/components/arcade";
import { t4 } from "@/components/arcade/tokens";

interface SaveSlot {
  name: string;
  kind: PixelAvatarKind;
  cls: string;
  lvl: number;
  time: string;
  tasks: number;
  hp: { value: number; max: number };
  mp: { value: number; max: number };
  xp: { value: number; max: number };
}

const DEMO_SLOTS: SaveSlot[] = [
  {
    name: "mira",
    kind: "mira",
    cls: "DESIGN LEAD",
    lvl: 27,
    time: "142h",
    tasks: 318,
    hp: { value: 87, max: 100 },
    mp: { value: 42, max: 70 },
    xp: { value: 64, max: 100 },
  },
  {
    name: "kenji",
    kind: "kenji",
    cls: "BACKEND MAGE",
    lvl: 19,
    time: "88h",
    tasks: 201,
    hp: { value: 72, max: 100 },
    mp: { value: 58, max: 70 },
    xp: { value: 40, max: 100 },
  },
];

export default function CharacterSelectPage() {
  return (
    <Suspense fallback={null}>
      <CharacterSelectInner />
    </Suspense>
  );
}

function CharacterSelectInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const returnTo = safeReturnTo(searchParams.get("returnTo"));
  const [selected, setSelected] = useState(0);

  useEffect(() => {
    if (!isAuthenticated()) router.replace("/auth");
  }, [router]);

  const enterWorld = () => router.replace(returnTo);
  const newHero = () => {
    const params = new URLSearchParams({ returnTo });
    router.push(`/auth/character/new?${params.toString()}`);
  };

  return (
    <T4Screen title="SAVE FILE · LOAD">
      <div
        style={{
          padding: "24px 28px",
          height: "100%",
          boxSizing: "border-box",
          display: "flex",
          flexDirection: "column",
          gap: 18,
        }}
      >
        <div>
          <div
            style={{
              fontFamily: "var(--font-pixel)",
              fontSize: 9,
              color: t4.pink,
              letterSpacing: 3,
              marginBottom: 6,
              textShadow: `0 0 8px ${t4.pink}`,
            }}
          >
            <GlyphText glyph="◆">CHOOSE YOUR FILE</GlyphText>
          </div>
          <div
            style={{
              fontFamily: "var(--font-mono-arcade)",
              fontSize: 11,
              color: t4.dim,
            }}
          >
            {DEMO_SLOTS.length} saves found on this device
          </div>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(3, 1fr)",
            gap: 14,
            flex: 1,
            minHeight: 0,
          }}
        >
          {DEMO_SLOTS.map((s, i) => {
            const sel = i === selected;
            return (
              <button
                key={s.name}
                type="button"
                onMouseEnter={() => setSelected(i)}
                onClick={() => setSelected(i)}
                style={{
                  position: "relative",
                  background: "rgba(20,28,55,0.6)",
                  border: `1px solid ${sel ? t4.pink : t4.line}`,
                  boxShadow: sel
                    ? `0 0 20px ${t4.pink}50, inset 0 0 30px rgba(255,122,220,0.05)`
                    : "none",
                  padding: 16,
                  display: "flex",
                  flexDirection: "column",
                  textAlign: "left",
                  cursor: "pointer",
                  fontFamily: "var(--font-sans)",
                  color: t4.ink,
                }}
              >
                <div
                  style={{
                    fontFamily: "var(--font-pixel)",
                    fontSize: 8,
                    letterSpacing: 2,
                    color: t4.dim,
                    marginBottom: 10,
                  }}
                >
                  SLOT 0{i + 1}
                </div>
                <div
                  style={{
                    display: "flex",
                    gap: 14,
                    alignItems: "flex-start",
                    marginBottom: 14,
                  }}
                >
                  <div
                    style={{
                      background: "rgba(0,0,0,0.4)",
                      padding: 8,
                      border: `1px solid ${t4.line}`,
                    }}
                  >
                    <PixelAvatar kind={s.kind} size={3} />
                  </div>
                  <div>
                    <div
                      style={{
                        fontFamily: "var(--font-pixel)",
                        fontSize: 13,
                        color: sel ? t4.pink : t4.ink,
                        letterSpacing: 1,
                        marginBottom: 4,
                      }}
                    >
                      {s.name}
                    </div>
                    <div
                      style={{
                        fontFamily: "var(--font-mono-arcade)",
                        fontSize: 9,
                        color: t4.dim,
                        letterSpacing: 1,
                      }}
                    >
                      {s.cls}
                    </div>
                    <div
                      style={{
                        fontFamily: "var(--font-pixel)",
                        fontSize: 9,
                        color: t4.xp,
                        marginTop: 6,
                        letterSpacing: 1,
                      }}
                    >
                      LV.{s.lvl}
                    </div>
                  </div>
                </div>
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "1fr 1fr",
                    gap: 4,
                    fontFamily: "var(--font-mono-arcade)",
                    fontSize: 9,
                    color: t4.dim,
                    marginBottom: 14,
                  }}
                >
                  <span>PLAYTIME</span>
                  <span style={{ color: t4.ink, textAlign: "right" }}>
                    {s.time}
                  </span>
                  <span>TASKS DONE</span>
                  <span style={{ color: t4.ink, textAlign: "right" }}>
                    {s.tasks}
                  </span>
                  <span>LAST SAVE</span>
                  <span style={{ color: t4.ink, textAlign: "right" }}>
                    YESTERDAY
                  </span>
                </div>
                <div
                  style={{
                    marginTop: "auto",
                    display: "flex",
                    flexDirection: "column",
                    gap: 6,
                  }}
                >
                  <T4Bar
                    label="HP"
                    value={s.hp.value}
                    max={s.hp.max}
                    color={t4.hp}
                    width="100%"
                  />
                  <T4Bar
                    label="MP"
                    value={s.mp.value}
                    max={s.mp.max}
                    color={t4.mp}
                    width="100%"
                  />
                  <T4Bar
                    label="XP"
                    value={s.xp.value}
                    max={s.xp.max}
                    color={t4.xp}
                    width="100%"
                  />
                </div>
                {sel && (
                  <div
                    style={{
                      position: "absolute",
                      top: -1,
                      right: -1,
                      background: t4.pink,
                      color: "#000",
                      fontFamily: "var(--font-pixel)",
                      fontSize: 7,
                      letterSpacing: 1,
                      padding: "3px 6px",
                    }}
                  >
                    <GlyphText glyph="▶">READY</GlyphText>
                  </div>
                )}
              </button>
            );
          })}

          <button
            type="button"
            onClick={newHero}
            style={{
              position: "relative",
              background: "rgba(20,28,55,0.6)",
              border: `1px dashed ${t4.line}`,
              padding: 16,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              gap: 10,
              color: t4.dim,
              cursor: "pointer",
              fontFamily: "var(--font-sans)",
            }}
          >
            <div
              style={{
                fontFamily: "var(--font-pixel)",
                fontSize: 22,
                letterSpacing: 2,
              }}
            >
              +
            </div>
            <div
              style={{
                fontFamily: "var(--font-pixel)",
                fontSize: 8,
                letterSpacing: 2,
              }}
            >
              NEW HERO
            </div>
            <div
              style={{
                fontFamily: "var(--font-mono-arcade)",
                fontSize: 9,
              }}
            >
              start a new save
            </div>
          </button>
        </div>

        <div
          style={{
            display: "flex",
            justifyContent: "center",
            paddingTop: 6,
          }}
        >
          <button
            type="button"
            onClick={enterWorld}
            style={{
              fontFamily: "var(--font-pixel)",
              fontSize: 11,
              letterSpacing: 3,
              color: "#000",
              background: t4.pink,
              border: `1px solid ${t4.pink}`,
              padding: "10px 32px",
              boxShadow: `0 0 18px ${t4.pink}80`,
              cursor: "pointer",
            }}
          >
            <GlyphText glyph="▶">ENTER WORLD</GlyphText>
          </button>
        </div>
      </div>
    </T4Screen>
  );
}

function safeReturnTo(raw: string | null): string {
  if (!raw) return "/workspaces";
  if (!raw.startsWith("/") || raw.startsWith("//")) return "/workspaces";
  return raw;
}
