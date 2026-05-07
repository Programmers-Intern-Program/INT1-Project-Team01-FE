"use client";

import { GoogleLogin } from "@react-oauth/google";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { isAuthenticated, loginWithGoogle } from "@/lib/auth";
import type { ApiError } from "@/lib/api-client";
import {
  T4Screen,
  T4Panel,
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

export default function AuthPage() {
  return (
    <Suspense fallback={null}>
      <AuthPageInner />
    </Suspense>
  );
}

function AuthPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const returnTo = safeReturnTo(searchParams.get("returnTo"));
  const [error, setError] = useState<string>("");
  const [submitting, setSubmitting] = useState(false);
  const [selected, setSelected] = useState(0);

  useEffect(() => {
    if (isAuthenticated()) router.replace(returnTo);
  }, [router, returnTo]);

  async function handleSuccess(idToken?: string) {
    if (!idToken) {
      setError("Google 토큰을 받지 못했습니다.");
      return;
    }
    setError("");
    setSubmitting(true);
    try {
      await loginWithGoogle(idToken);
      router.replace(returnTo);
    } catch (err) {
      const apiErr = err as ApiError;
      setError(apiErr?.message ?? "로그인에 실패했습니다.");
    } finally {
      setSubmitting(false);
    }
  }

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
            ◆ CHOOSE YOUR FILE
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
                    ▶ READY
                  </div>
                )}
              </button>
            );
          })}

          {/* New hero slot */}
          <div
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
          </div>
        </div>

        {/* Sign in panel */}
        <div style={{ position: "relative", paddingTop: 8 }}>
          <T4Panel
            label="SIGN IN"
            style={{ padding: "14px 18px", position: "relative" }}
          >
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr auto",
                gap: 18,
                alignItems: "center",
              }}
            >
              <div>
                <div
                  style={{
                    fontFamily: "var(--font-pixel)",
                    fontSize: 8,
                    color: t4.pink,
                    letterSpacing: 2,
                    marginBottom: 6,
                    textShadow: `0 0 6px ${t4.pink}`,
                  }}
                >
                  ◆ WORKSPACE MEMBER VERIFICATION
                </div>
                <div
                  style={{
                    fontFamily: "var(--font-mono-arcade)",
                    fontSize: 11,
                    color: t4.dim,
                    lineHeight: 1.6,
                  }}
                >
                  Sign in with your work Google account.
                  <br />
                  Only invited heroes may enter.
                </div>
                {error && (
                  <div
                    style={{
                      marginTop: 10,
                      fontFamily: "var(--font-mono-arcade)",
                      fontSize: 10,
                      color: t4.hp,
                    }}
                  >
                    ⚠ {error}
                  </div>
                )}
                {submitting && (
                  <div
                    style={{
                      marginTop: 10,
                      fontFamily: "var(--font-mono-arcade)",
                      fontSize: 10,
                      color: t4.mp,
                    }}
                  >
                    LOADING SAVE FILE...
                  </div>
                )}
              </div>
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  gap: 8,
                }}
              >
                <GoogleLogin
                  onSuccess={(credResp) => handleSuccess(credResp.credential)}
                  onError={() =>
                    setError("Google 로그인이 취소되었거나 실패했습니다.")
                  }
                  theme="filled_black"
                  size="large"
                  shape="rectangular"
                  text="continue_with"
                  logo_alignment="left"
                  width="280"
                  useOneTap={false}
                />
                <div
                  style={{
                    fontFamily: "var(--font-pixel)",
                    fontSize: 7,
                    color: t4.pink,
                    letterSpacing: 2,
                    textShadow: `0 0 6px ${t4.pink}`,
                  }}
                >
                  ▶ PRESS TO CONTINUE
                </div>
              </div>
            </div>
          </T4Panel>
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
