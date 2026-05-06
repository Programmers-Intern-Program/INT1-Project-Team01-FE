"use client";

import { GoogleLogin } from "@react-oauth/google";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { isAuthenticated, loginWithGoogle } from "@/lib/auth";
import type { ApiError } from "@/lib/api-client";

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
    <main className="theme-web flex min-h-screen items-center justify-center px-4 py-8">
      <section className="flex w-full max-w-[380px] flex-col items-stretch gap-5">
        <header className="flex flex-col gap-2 text-center">
          <h1 className="text-[28px] font-bold leading-tight text-text">AI Office</h1>
          <p className="text-body text-text-muted">
            Workspace, Agent, Task를 운영하는 업무 공간
          </p>
        </header>

        <div
          className="flex flex-col gap-5 rounded-lg border border-[var(--neon-border-muted)] bg-surface/95 px-6 py-7"
          aria-busy={submitting}
        >
          <div className="text-center">
            <p className="text-title text-text">로그인</p>
            <p className="mt-1 text-caption text-text-muted">
              Google 계정으로 계속합니다.
            </p>
          </div>

          <div className="flex justify-center">
            <GoogleLogin
              onSuccess={(credResp) => handleSuccess(credResp.credential)}
              onError={() => setError("Google 로그인이 취소되었거나 실패했습니다.")}
              theme="filled_blue"
              size="large"
              shape="pill"
              text="continue_with"
              logo_alignment="left"
              width="320"
              useOneTap={false}
            />
          </div>

          {submitting && (
            <p className="text-center text-caption text-text-muted">로그인 처리 중...</p>
          )}
          {error && (
            <p className="text-center text-caption text-danger">{error}</p>
          )}
        </div>

        <p className="text-center text-micro text-text-dim">
          로그인 시 서비스 이용약관에 동의한 것으로 간주됩니다.
        </p>
      </section>
    </main>
  );
}

function safeReturnTo(raw: string | null): string {
  if (!raw) return "/workspaces";
  if (!raw.startsWith("/") || raw.startsWith("//")) return "/workspaces";
  return raw;
}
