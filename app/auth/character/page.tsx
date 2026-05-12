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

interface AvatarOption {
  kind: PixelAvatarKind;
  role: string;
  sub: string;
}

const AVATARS: AvatarOption[] = [
  { kind: "alex", role: "developer", sub: "ships features" },
  { kind: "mira", role: "designer", sub: "persuades pixels" },
  { kind: "kenji", role: "backend", sub: "casts spells in code" },
  { kind: "yuna", role: "product", sub: "mends what users break" },
  { kind: "diego", role: "devops", sub: "guards the deploys" },
  { kind: "iris", role: "AI engineer", sub: "whispers to agents" },
];

interface SaveSlot {
  name: string;
  kind: PixelAvatarKind;
  cls: string;
  lvl: number;
  daysActive: number;
  tasks: number;
  lastSeen: string;
  health: { value: number; max: number };
  flow: { value: number; max: number };
  impact: { value: number; max: number };
}

const DEMO_SLOTS: SaveSlot[] = [
  {
    name: "mira",
    kind: "mira",
    cls: "DESIGN LEAD",
    lvl: 27,
    daysActive: 142,
    tasks: 318,
    lastSeen: "12 MIN AGO",
    health: { value: 6, max: 8 },
    flow: { value: 84, max: 120 },
    impact: { value: 6, max: 10 },
  },
  {
    name: "kenji",
    kind: "kenji",
    cls: "BACKEND MAGE",
    lvl: 19,
    daysActive: 88,
    tasks: 201,
    lastSeen: "2 HRS AGO",
    health: { value: 4, max: 7 },
    flow: { value: 62, max: 100 },
    impact: { value: 3, max: 10 },
  },
];

const CHARACTER_STORAGE_KEY = "ai-office.character";
const AVATAR_KINDS = AVATARS.map((a) => a.kind);
const formatDay = (n: number) => `DAY ${n.toString().padStart(3, "0")}`;

function loadSavedCharacter(): { kind: PixelAvatarKind; name: string } {
  if (typeof window === "undefined") return { kind: "mira", name: "" };
  try {
    const raw = window.localStorage.getItem(CHARACTER_STORAGE_KEY);
    if (!raw) return { kind: "mira", name: "" };
    const saved = JSON.parse(raw) as { kind?: string; name?: string };
    const kind =
      saved.kind && AVATAR_KINDS.includes(saved.kind as PixelAvatarKind)
        ? (saved.kind as PixelAvatarKind)
        : "mira";
    const name = typeof saved.name === "string" ? saved.name : "";
    return { kind, name };
  } catch {
    return { kind: "mira", name: "" };
  }
}

export default function CharacterPage() {
  return (
    <Suspense fallback={null}>
      <CharacterInner />
    </Suspense>
  );
}

function CharacterInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const returnTo = safeReturnTo(searchParams.get("returnTo"));
  const [kind, setKind] = useState<PixelAvatarKind>("mira");
  const [name, setName] = useState("");

  useEffect(() => {
    if (!isAuthenticated()) {
      router.replace("/auth");
      return;
    }
    const saved = loadSavedCharacter();
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setKind(saved.kind);
    setName(saved.name);
  }, [router]);

  const trimmed = name.trim();
  const canSubmit = trimmed.length > 0;
  const selected = AVATARS.find((a) => a.kind === kind) ?? AVATARS[1];

  const enterWorld = () => {
    if (!canSubmit) return;
    if (typeof window !== "undefined") {
      window.localStorage.setItem(
        CHARACTER_STORAGE_KEY,
        JSON.stringify({ kind, name: trimmed }),
      );
    }
    router.replace(returnTo);
  };

  const enterFromSlot = (slot: SaveSlot) => {
    if (typeof window !== "undefined") {
      window.localStorage.setItem(
        CHARACTER_STORAGE_KEY,
        JSON.stringify({ kind: slot.kind, name: slot.name }),
      );
    }
    router.replace(returnTo);
  };

  return (
    <T4Screen title="CHARACTER · NEW HERO">
      <div
        style={{
          padding: 20,
          height: "100%",
          boxSizing: "border-box",
          display: "flex",
          flexDirection: "column",
          gap: 14,
        }}
      >
        <div style={{ flex: "0 0 auto" }}>
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
            <GlyphText glyph="◆">PICK YOUR HERO</GlyphText>
          </div>
          <h2
            style={{
              fontFamily: "var(--font-pixel)",
              fontSize: 20,
              letterSpacing: 2,
              margin: 0,
              color: t4.ink,
              textShadow: `0 0 12px ${t4.pink}80`,
            }}
          >
            WHO ARE YOU IN THE OFFICE?
          </h2>
          <div
            style={{
              fontFamily: "var(--font-mono-arcade)",
              fontSize: 11,
              color: t4.dim,
              marginTop: 4,
            }}
          >
            this is the sprite the rest of your team will see walking around.
          </div>
        </div>

        <div
          style={{
            flex: "0 0 auto",
            display: "grid",
            gridTemplateColumns: "repeat(6, 1fr)",
            gap: 10,
          }}
        >
          {AVATARS.map((a) => {
            const sel = a.kind === kind;
            return (
              <button
                key={a.kind}
                type="button"
                onClick={() => setKind(a.kind)}
                style={{
                  position: "relative",
                  background: sel
                    ? "rgba(255,122,220,0.06)"
                    : "rgba(20,28,55,0.5)",
                  border: `1px solid ${sel ? t4.pink : t4.line}`,
                  boxShadow: sel ? `0 0 16px ${t4.pink}60` : "none",
                  padding: "10px 6px",
                  cursor: "pointer",
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  gap: 6,
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
                    padding: 8,
                    border: `1px solid ${sel ? t4.pink : t4.line}`,
                    boxShadow: sel ? `0 0 10px ${t4.pink}40` : "none",
                  }}
                >
                  <PixelAvatar kind={a.kind} size={3} />
                </div>
                <div
                  style={{
                    fontFamily: "var(--font-pixel)",
                    fontSize: 9,
                    letterSpacing: 1.5,
                    color: sel ? t4.pink : t4.ink,
                    textAlign: "center",
                  }}
                >
                  {a.kind.toUpperCase()}
                </div>
                <div
                  style={{
                    fontFamily: "var(--font-mono-arcade)",
                    fontSize: 9,
                    fontStyle: "italic",
                    color: t4.dim,
                    textAlign: "center",
                    lineHeight: 1.3,
                  }}
                >
                  {a.role}
                </div>
              </button>
            );
          })}
        </div>

        <T4Panel
          label="HERO SHEET"
          accent={t4.pink}
          style={{
            position: "relative",
            padding: 14,
            flex: "0 0 auto",
            display: "grid",
            gridTemplateColumns: "150px 1fr",
            gap: 20,
            alignItems: "stretch",
          }}
        >
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 8,
              width: 150,
              flexShrink: 0,
            }}
          >
            <div
              style={{
                width: 96,
                height: 96,
                background: "rgba(0,0,0,0.4)",
                border: `1px solid ${t4.pink}`,
                boxShadow: `0 0 18px ${t4.pink}40`,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
              }}
            >
              <PixelAvatar kind={kind} size={5} />
            </div>
            <div
              style={{
                fontFamily: "var(--font-pixel)",
                fontSize: 11,
                color: t4.ink,
                letterSpacing: 1,
                textAlign: "center",
                height: 14,
                lineHeight: "14px",
              }}
            >
              {kind.toUpperCase()}
            </div>
            <div
              style={{
                fontFamily: "var(--font-mono-arcade)",
                fontSize: 10,
                fontStyle: "italic",
                color: t4.dim,
                textAlign: "center",
                lineHeight: 1.4,
                width: 130,
                minHeight: 28,
              }}
            >
              {selected.sub}
            </div>
          </div>

          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: 10,
              minWidth: 0,
            }}
          >
            <div
              style={{
                fontFamily: "var(--font-pixel)",
                fontSize: 7,
                color: t4.dim,
                letterSpacing: 2,
              }}
            >
              DISPLAY NAME
            </div>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="type your name…"
              maxLength={24}
              autoFocus
              onKeyDown={(e) => {
                if (e.key === "Enter") enterWorld();
              }}
              style={{
                width: "100%",
                boxSizing: "border-box",
                background: "rgba(0,0,0,0.4)",
                border: `1px solid ${t4.line}`,
                color: t4.ink,
                fontFamily: "var(--font-mono-arcade)",
                fontSize: 13,
                letterSpacing: 1,
                padding: "10px 12px",
                outline: "none",
              }}
              onFocus={(e) => {
                e.currentTarget.style.borderColor = t4.pink;
                e.currentTarget.style.boxShadow = `0 0 10px ${t4.pink}40`;
              }}
              onBlur={(e) => {
                e.currentTarget.style.borderColor = t4.line;
                e.currentTarget.style.boxShadow = "none";
              }}
            />

            <div
              style={{
                fontFamily: "var(--font-mono-arcade)",
                fontSize: 9,
                color: t4.dim,
                letterSpacing: 1,
                lineHeight: 1.6,
              }}
            >
              <GlyphText glyph="›">
                팀원들에게 표시되는 이름이에요.
              </GlyphText>
              <br />
              <GlyphText glyph="›">
                아바타와 이름은 나중에 설정에서 바꿀 수 있어요.
              </GlyphText>
            </div>

            <button
              type="button"
              onClick={enterWorld}
              disabled={!canSubmit}
              style={{
                marginTop: "auto",
                fontFamily: "var(--font-pixel)",
                fontSize: 11,
                letterSpacing: 3,
                color: canSubmit ? "#000" : t4.dim,
                background: canSubmit ? t4.pink : "transparent",
                border: `1px solid ${canSubmit ? t4.pink : t4.line}`,
                padding: "12px 0",
                boxShadow: canSubmit ? `0 0 18px ${t4.pink}80` : "none",
                cursor: canSubmit ? "pointer" : "not-allowed",
                width: "100%",
              }}
            >
              <GlyphText glyph="▶">ENTER WORLD</GlyphText>
            </button>
          </div>
        </T4Panel>

        <div style={{ flex: "0 0 auto" }}>
          <div
            style={{
              fontFamily: "var(--font-pixel)",
              fontSize: 8,
              color: t4.dim,
              letterSpacing: 3,
              marginBottom: 8,
            }}
          >
            <GlyphText glyph="◆">SAVE FILES</GlyphText>
          </div>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(3, 1fr)",
              gap: 12,
            }}
          >
            {DEMO_SLOTS.map((s, i) => (
              <button
                key={s.name}
                type="button"
                onClick={() => enterFromSlot(s)}
                title="이 슬롯으로 바로 입장"
                style={{
                  position: "relative",
                  background: "rgba(20,28,55,0.6)",
                  border: `1px solid ${t4.line}`,
                  padding: 12,
                  display: "flex",
                  flexDirection: "column",
                  textAlign: "left",
                  cursor: "pointer",
                  fontFamily: "var(--font-sans)",
                  color: t4.ink,
                  gap: 8,
                }}
              >
                <div
                  style={{
                    fontFamily: "var(--font-pixel)",
                    fontSize: 7,
                    letterSpacing: 2,
                    color: t4.dim,
                  }}
                >
                  SLOT 0{i + 1}
                </div>
                <div
                  style={{
                    display: "flex",
                    gap: 10,
                    alignItems: "flex-start",
                  }}
                >
                  <div
                    style={{
                      background: "rgba(0,0,0,0.4)",
                      padding: 6,
                      border: `1px solid ${t4.line}`,
                      flexShrink: 0,
                    }}
                  >
                    <PixelAvatar kind={s.kind} size={2} />
                  </div>
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div
                      style={{
                        fontFamily: "var(--font-pixel)",
                        fontSize: 11,
                        color: t4.ink,
                        letterSpacing: 1,
                      }}
                    >
                      {s.name}
                    </div>
                    <div
                      style={{
                        fontFamily: "var(--font-mono-arcade)",
                        fontSize: 8,
                        color: t4.dim,
                        letterSpacing: 1,
                        marginTop: 2,
                      }}
                    >
                      {s.cls}
                    </div>
                    <div
                      style={{
                        fontFamily: "var(--font-pixel)",
                        fontSize: 8,
                        color: t4.xp,
                        letterSpacing: 1,
                        marginTop: 4,
                      }}
                    >
                      RANK {s.lvl} · {formatDay(s.daysActive)}
                    </div>
                  </div>
                </div>
                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: 3,
                  }}
                >
                  <T4Bar
                    label="HEALTH"
                    value={s.health.value}
                    max={s.health.max}
                    color={t4.hp}
                    width="100%"
                  />
                  <T4Bar
                    label="FLOW"
                    value={s.flow.value}
                    max={s.flow.max}
                    color={t4.mp}
                    width="100%"
                  />
                  <T4Bar
                    label="IMPACT"
                    value={s.impact.value}
                    max={s.impact.max}
                    color={t4.xp}
                    width="100%"
                  />
                </div>
                <div
                  style={{
                    fontFamily: "var(--font-mono-arcade)",
                    fontSize: 8,
                    color: t4.dim,
                    letterSpacing: 1,
                    display: "flex",
                    justifyContent: "space-between",
                  }}
                >
                  <span>LAST SAVE</span>
                  <span style={{ color: t4.ink }}>{s.lastSeen}</span>
                </div>
              </button>
            ))}
          </div>
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
