"use client";

import { useRouter } from "next/navigation";
import { ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui";
import { GlyphText } from "@/components/arcade";
import { t4 } from "@/components/arcade/tokens";

const RETURN_TO_KEY = "aio.slack.returnTo";

export default function SlackIntegrationFailPage() {
  const router = useRouter();

  function retry() {
    const returnTo =
      typeof window === "undefined"
        ? "/workspaces"
        : window.localStorage.getItem(RETURN_TO_KEY) ?? "/workspaces";
    router.push(returnTo);
  }

  return (
    <main
      className="theme-web flex min-h-screen items-center justify-center p-6"
      style={{ background: t4.bg, color: t4.ink }}
    >
      <section
        className="w-full max-w-xl p-6"
        style={{
          border: `1px solid ${t4.hp}`,
          background: "rgba(20,28,55,0.94)",
          boxShadow: `0 0 22px ${t4.hp}35`,
        }}
      >
        <ShieldAlert className="h-10 w-10" style={{ color: t4.hp }} />
        <h1
          className="mt-5"
          style={{
            fontFamily: "var(--font-pixel)",
            fontSize: 14,
            letterSpacing: 2,
            color: t4.hp,
            textShadow: `0 0 8px ${t4.hp}`,
          }}
        >
          <GlyphText glyph="◆">SLACK CONNECT FAILED</GlyphText>
        </h1>
        <p className="mt-4 text-body text-text-muted">
          Slack 연동을 완료하지 못했습니다. 워크스페이스 연동 화면으로 돌아가 다시 시도하세요.
        </p>
        <div className="mt-6 flex justify-end">
          <Button
            type="button"
            variant="secondary"
            onClick={retry}
            style={{
              fontFamily: "var(--font-mixed-ko)",
              textTransform: "none",
              letterSpacing: "normal",
              fontSize: 12,
              fontWeight: 600,
              borderColor: t4.hp,
              color: t4.hp,
              boxShadow: "none",
            }}
          >
            재시도
          </Button>
        </div>
      </section>
    </main>
  );
}
