"use client";

import { GoogleLogin } from "@react-oauth/google";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { isAuthenticated, loginWithGoogle } from "@/lib/auth";
import type { ApiError } from "@/lib/api-client";
import { GlyphText, T4Screen, T4Panel } from "@/components/arcade";
import { t4 } from "@/components/arcade/tokens";

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

  useEffect(() => {
    if (isAuthenticated()) router.replace(nextStep(returnTo));
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
      router.replace(nextStep(returnTo));
    } catch (err) {
      const apiErr = err as ApiError;
      setError(apiErr?.message ?? "로그인에 실패했습니다.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <T4Screen title="SIGN IN">
      <div
        style={{
          padding: "24px 28px",
          height: "100%",
          boxSizing: "border-box",
          display: "flex",
          flexDirection: "column",
          gap: 18,
          justifyContent: "center",
        }}
      >
        <div style={{ textAlign: "center", marginBottom: 12 }}>
          <div
            style={{
              fontFamily: "var(--font-pixel)",
              fontSize: 11,
              color: t4.pink,
              letterSpacing: 4,
              marginBottom: 10,
              textShadow: `0 0 12px ${t4.pink}`,
              animation: "t4-pulse 1.4s ease-in-out infinite",
            }}
          >
            <GlyphText glyph="▶">SIGN IN TO CONTINUE</GlyphText>
          </div>
          <div
            style={{
              fontFamily: "var(--font-mono-arcade)",
              fontSize: 12,
              color: t4.dim,
              letterSpacing: 4,
            }}
          >
            ─ AUTHENTICATE WITH GOOGLE ─
          </div>
        </div>

        <div style={{ maxWidth: 560, width: "100%", margin: "0 auto" }}>
          <T4Panel
            label="SIGN IN"
            style={{ padding: "20px 22px", position: "relative" }}
          >
            <div
              style={{
                fontFamily: "var(--font-pixel)",
                fontSize: 8,
                color: t4.pink,
                letterSpacing: 2,
                marginBottom: 8,
                textShadow: `0 0 6px ${t4.pink}`,
              }}
            >
              <GlyphText glyph="◆">WORKSPACE MEMBER VERIFICATION</GlyphText>
            </div>
            <div
              style={{
                fontFamily: "var(--font-mono-arcade)",
                fontSize: 11,
                color: t4.dim,
                lineHeight: 1.6,
                marginBottom: 18,
              }}
            >
              Sign in with your work Google account.
              <br />
              Only invited heroes may enter.
            </div>

            <div
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: 10,
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
                <GlyphText glyph="▶">PRESS TO CONTINUE</GlyphText>
              </div>
            </div>

            {error && (
              <div
                style={{
                  marginTop: 14,
                  fontFamily: "var(--font-mono-arcade)",
                  fontSize: 10,
                  color: t4.hp,
                  textAlign: "center",
                }}
              >
                <GlyphText glyph="⚠">{error}</GlyphText>
              </div>
            )}
            {submitting && (
              <div
                style={{
                  marginTop: 14,
                  fontFamily: "var(--font-mono-arcade)",
                  fontSize: 10,
                  color: t4.mp,
                  textAlign: "center",
                }}
              >
                LOADING SAVE FILE...
              </div>
            )}
          </T4Panel>
        </div>

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
          [ ESC BACK ] © CLAW STUDIO 2026
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

function safeReturnTo(raw: string | null): string {
  if (!raw) return "/workspaces";
  if (!raw.startsWith("/") || raw.startsWith("//")) return "/workspaces";
  return raw;
}

function nextStep(returnTo: string): string {
  const params = new URLSearchParams({ returnTo });
  return `/auth/character?${params.toString()}`;
}
