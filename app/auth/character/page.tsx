"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { isAuthenticated } from "@/lib/auth";
import {
  getMyMemberProfile,
  updateMyMemberProfile,
  type MemberProfile,
} from "@/lib/api/members";
import {
  GlyphText,
  T4Screen,
  T4Panel,
  PixelAvatar,
  PA_PALETTES,
  type PixelAvatarPaletteOverride,
  type PixelAvatarKind,
} from "@/components/arcade";
import { t4 } from "@/components/arcade/tokens";

interface AvatarOption {
  kind: PixelAvatarKind;
  role: string;
  sub: string;
}

const AVATARS: AvatarOption[] = [
  { kind: "alex", role: "Frontend", sub: "UI와 사용 흐름을 빠르게 다듬습니다." },
  { kind: "mira", role: "Design", sub: "팀이 볼 화면과 인터랙션을 정리합니다." },
  { kind: "kenji", role: "Backend", sub: "API와 데이터 흐름을 안정적으로 연결합니다." },
  { kind: "yuna", role: "Product", sub: "작업 우선순위와 사용자 맥락을 챙깁니다." },
  { kind: "diego", role: "DevOps", sub: "실행 환경과 배포 흐름을 관리합니다." },
  { kind: "iris", role: "AI", sub: "에이전트와 협업해 작업을 진행합니다." },
];

type ColorTarget = "skin" | "hair" | "shirt";
type ColorMode = "original" | "custom";

interface ColorOption {
  label: string;
  value: string;
  shade: string;
}

type AvatarColors = Record<ColorTarget, ColorOption>;

const COLOR_OPTIONS: Record<ColorTarget, ColorOption[]> = {
  skin: [
    { label: "01", value: "#f8d4b0", shade: "#c8a47a" },
    { label: "02", value: "#f0c098", shade: "#c08868" },
    { label: "03", value: "#d8a878", shade: "#a87848" },
    { label: "04", value: "#9a6a48", shade: "#6f472f" },
  ],
  hair: [
    { label: "01", value: "#1a1a1a", shade: "#0a0a0a" },
    { label: "02", value: "#3a2a1a", shade: "#1f1410" },
    { label: "03", value: "#a83a3a", shade: "#6a1f1f" },
    { label: "04", value: "#5a3a8a", shade: "#2a1a4a" },
    { label: "05", value: "#d8a838", shade: "#a87808" },
  ],
  shirt: [
    { label: "01", value: "#2a3a4a", shade: "#15202c" },
    { label: "02", value: "#3a5a3a", shade: "#1a3a1a" },
    { label: "03", value: "#5a3a8a", shade: "#2a1a4a" },
    { label: "04", value: "#a83a6a", shade: "#681a3a" },
    { label: "05", value: "#d8c89a", shade: "#a89868" },
  ],
};

const DEFAULT_COLORS: AvatarColors = {
  skin: COLOR_OPTIONS.skin[0],
  hair: COLOR_OPTIONS.hair[0],
  shirt: COLOR_OPTIONS.shirt[0],
};

const CHARACTER_STORAGE_KEY = "ai-office.character";
const AVATAR_KINDS = AVATARS.map((a) => a.kind);

function originalColorsFor(kind: PixelAvatarKind): AvatarColors {
  const palette = PA_PALETTES[kind] ?? PA_PALETTES.mira;
  return {
    skin: { label: "ORIGINAL", value: palette.skin, shade: palette.skin2 },
    hair: { label: "ORIGINAL", value: palette.hair, shade: palette.hair2 },
    shirt: { label: "ORIGINAL", value: palette.shirt, shade: palette.shirt2 },
  };
}

function isOriginalColorSet(
  kind: PixelAvatarKind,
  colors?: Partial<Record<ColorTarget, string>>,
) {
  const original = originalColorsFor(kind);
  return (
    colors?.skin === original.skin.value &&
    colors?.hair === original.hair.value &&
    colors?.shirt === original.shirt.value
  );
}

function avatarColorsToPalette(colors: AvatarColors): PixelAvatarPaletteOverride {
  return {
    skin: colors.skin.value,
    skin2: colors.skin.shade,
    hair: colors.hair.value,
    hair2: colors.hair.shade,
    shirt: colors.shirt.value,
    shirt2: colors.shirt.shade,
  };
}

function loadSavedCharacter(): {
  kind: PixelAvatarKind;
  name: string;
  colors: AvatarColors;
  colorMode: ColorMode;
} {
  if (typeof window === "undefined") {
    return { kind: "mira", name: "", colors: DEFAULT_COLORS, colorMode: "original" };
  }
  try {
    const raw = window.localStorage.getItem(CHARACTER_STORAGE_KEY);
    if (!raw) return { kind: "mira", name: "", colors: DEFAULT_COLORS, colorMode: "original" };
    const saved = JSON.parse(raw) as {
      kind?: string;
      name?: string;
      colors?: Partial<Record<ColorTarget, string>>;
      colorMode?: ColorMode;
    };
    const kind =
      saved.kind && AVATAR_KINDS.includes(saved.kind as PixelAvatarKind)
        ? (saved.kind as PixelAvatarKind)
        : "mira";
    const name = typeof saved.name === "string" ? saved.name : "";
    const colorMode =
      saved.colorMode === "original" || isOriginalColorSet(kind, saved.colors)
        ? "original"
        : "custom";
    return {
      kind,
      name,
      colorMode,
      colors: {
        skin: findColorOption("skin", saved.colors?.skin),
        hair: findColorOption("hair", saved.colors?.hair),
        shirt: findColorOption("shirt", saved.colors?.shirt),
      },
    };
  } catch {
    return { kind: "mira", name: "", colors: DEFAULT_COLORS, colorMode: "original" };
  }
}

function characterFromProfile(profile: MemberProfile): {
  kind: PixelAvatarKind;
  name: string;
  colors: AvatarColors;
  colorMode: ColorMode;
} {
  const kind = AVATAR_KINDS.includes(profile.avatarKind as PixelAvatarKind)
    ? (profile.avatarKind as PixelAvatarKind)
    : "mira";
  return {
    kind,
    name: profile.displayName,
    colorMode: isOriginalColorSet(kind, profile.avatarColors) ? "original" : "custom",
    colors: {
      skin: findColorOption("skin", profile.avatarColors?.skin),
      hair: findColorOption("hair", profile.avatarColors?.hair),
      shirt: findColorOption("shirt", profile.avatarColors?.shirt),
    },
  };
}

function writeSavedCharacter(
  kind: PixelAvatarKind,
  name: string,
  colors: AvatarColors,
  colorMode: ColorMode,
  paletteOverride?: PixelAvatarPaletteOverride,
) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(
    CHARACTER_STORAGE_KEY,
    JSON.stringify({
      kind,
      name,
      colors: {
        skin: colors.skin.value,
        hair: colors.hair.value,
        shirt: colors.shirt.value,
      },
      colorMode,
      paletteOverride: colorMode === "custom" ? paletteOverride : undefined,
    }),
  );
}

function findColorOption(target: ColorTarget, value?: string): ColorOption {
  return COLOR_OPTIONS[target].find((option) => option.value === value) ?? DEFAULT_COLORS[target];
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
  const [colors, setColors] = useState<AvatarColors>(DEFAULT_COLORS);
  const [colorMode, setColorMode] = useState<ColorMode>("original");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    if (!isAuthenticated()) {
      router.replace("/auth");
      return;
    }
    const saved = loadSavedCharacter();
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setKind(saved.kind);
    setName(saved.name);
    setColors(saved.colors);
    setColorMode(saved.colorMode);
    getMyMemberProfile()
      .then((profile) => {
        if (cancelled) return;
        const next = characterFromProfile(profile);
        setKind(next.kind);
        setName(next.name);
        setColors(next.colors);
        setColorMode(next.colorMode);
      })
      .catch(() => {
        // Keep local profile fallback when the backend profile is unavailable.
      });
    return () => {
      cancelled = true;
    };
  }, [router]);

  const trimmed = name.trim();
  const canSubmit = trimmed.length > 0;
  const selected = AVATARS.find((a) => a.kind === kind) ?? AVATARS[1];
  const activeColors = colorMode === "original" ? originalColorsFor(kind) : colors;
  const paletteOverride =
    colorMode === "custom" ? avatarColorsToPalette(colors) : undefined;

  const enterOffice = async () => {
    if (!canSubmit || saving) return;
    writeSavedCharacter(kind, trimmed, activeColors, colorMode, paletteOverride);
    setSaving(true);
    try {
      const profile = await updateMyMemberProfile({
        displayName: trimmed,
        avatarKind: kind,
        avatarColors: {
          skin: activeColors.skin.value,
          hair: activeColors.hair.value,
          shirt: activeColors.shirt.value,
        },
      });
      const next = characterFromProfile(profile);
      const nextColors =
        next.colorMode === "original" ? originalColorsFor(next.kind) : next.colors;
      writeSavedCharacter(
        next.kind,
        next.name,
        nextColors,
        next.colorMode,
        next.colorMode === "custom" ? avatarColorsToPalette(next.colors) : undefined,
      );
    } catch {
      // Local storage still keeps the selected profile for this browser.
    } finally {
      setSaving(false);
      router.replace(returnTo);
    }
  };

  return (
    <T4Screen title="PROFILE · OFFICE AVATAR">
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
            <GlyphText glyph="◆">CHOOSE YOUR AVATAR</GlyphText>
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
            SET UP YOUR OFFICE PROFILE
          </h2>
          <div
            style={{
              fontFamily: "var(--font-mono-arcade)",
              fontSize: 11,
              color: t4.dim,
              marginTop: 4,
            }}
          >
            워크스페이스에서 팀원들에게 보일 아바타와 이름을 설정하세요.
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
                  <PixelAvatar
                    kind={a.kind}
                    size={3}
                    paletteOverride={a.kind === kind ? paletteOverride : undefined}
                  />
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
          label="PROFILE"
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
              <PixelAvatar kind={kind} size={5} paletteOverride={paletteOverride} />
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
              <span style={{ color: t4.ink }}>{selected.role}</span>
              <br />
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
                if (e.key === "Enter") enterOffice();
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
                워크스페이스와 채팅에서 표시되는 이름입니다.
              </GlyphText>
              <br />
              <GlyphText glyph="›">
                실제 작업 성과와 순위는 워크스페이스 입장 후 프로필 HUD에 표시됩니다.
              </GlyphText>
            </div>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
                gap: 6,
              }}
            >
              <ModeButton active={colorMode === "original"} onClick={() => setColorMode("original")}>
                ORIGINAL
              </ModeButton>
              <ModeButton active={colorMode === "custom"} onClick={() => setColorMode("custom")}>
                CUSTOM
              </ModeButton>
            </div>

            {colorMode === "custom" ? (
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
                  gap: 8,
                }}
              >
                <ColorPicker
                  label="SKIN"
                  target="skin"
                  value={colors.skin.value}
                  onChange={(next) => setColors((prev) => ({ ...prev, skin: next }))}
                />
                <ColorPicker
                  label="HAIR"
                  target="hair"
                  value={colors.hair.value}
                  onChange={(next) => setColors((prev) => ({ ...prev, hair: next }))}
                />
                <ColorPicker
                  label="OUTFIT"
                  target="shirt"
                  value={colors.shirt.value}
                  onChange={(next) => setColors((prev) => ({ ...prev, shirt: next }))}
                />
              </div>
            ) : (
              <div
                style={{
                  border: `1px solid ${t4.line}`,
                  background: "rgba(0,0,0,0.25)",
                  padding: "10px 12px",
                  fontFamily: "var(--font-mono-arcade)",
                  fontSize: 10,
                  color: t4.dim,
                  lineHeight: 1.5,
                }}
              >
                기존 캐릭터의 기본 색상을 그대로 사용합니다.
              </div>
            )}

            <button
              type="button"
              onClick={enterOffice}
              disabled={!canSubmit || saving}
              style={{
                marginTop: "auto",
                fontFamily: "var(--font-pixel)",
                fontSize: 11,
                letterSpacing: 3,
                color: canSubmit && !saving ? "#000" : t4.dim,
                background: canSubmit && !saving ? t4.pink : "transparent",
                border: `1px solid ${canSubmit && !saving ? t4.pink : t4.line}`,
                padding: "12px 0",
                boxShadow: canSubmit && !saving ? `0 0 18px ${t4.pink}80` : "none",
                cursor: canSubmit && !saving ? "pointer" : "not-allowed",
                width: "100%",
              }}
            >
              <GlyphText glyph="▶">{saving ? "SAVING" : "ENTER OFFICE"}</GlyphText>
            </button>
          </div>
        </T4Panel>
      </div>
    </T4Screen>
  );
}

function ModeButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        fontFamily: "var(--font-pixel)",
        fontSize: 9,
        letterSpacing: 2,
        color: active ? "#000" : t4.dim,
        background: active ? t4.pink : "rgba(0,0,0,0.25)",
        border: `1px solid ${active ? t4.pink : t4.line}`,
        padding: "9px 0",
        boxShadow: active ? `0 0 12px ${t4.pink}70` : "none",
        cursor: "pointer",
      }}
    >
      {children}
    </button>
  );
}

function ColorPicker({
  label,
  target,
  value,
  onChange,
}: {
  label: string;
  target: ColorTarget;
  value: string;
  onChange: (option: ColorOption) => void;
}) {
  return (
    <div>
      <div
        style={{
          fontFamily: "var(--font-pixel)",
          fontSize: 7,
          color: t4.dim,
          letterSpacing: 1.5,
          marginBottom: 6,
        }}
      >
        {label}
      </div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
        {COLOR_OPTIONS[target].map((option) => {
          const selected = option.value === value;
          return (
            <button
              key={option.value}
              type="button"
              aria-label={`${label} ${option.label}`}
              onClick={() => onChange(option)}
              style={{
                width: 22,
                height: 22,
                border: `1px solid ${selected ? t4.pink : t4.line}`,
                background: option.value,
                boxShadow: selected ? `0 0 10px ${t4.pink}80` : "none",
                cursor: "pointer",
              }}
            />
          );
        })}
      </div>
    </div>
  );
}

function safeReturnTo(raw: string | null): string {
  if (!raw) return "/workspaces";
  if (!raw.startsWith("/") || raw.startsWith("//")) return "/workspaces";
  return raw;
}
