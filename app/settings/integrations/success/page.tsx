"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui";
import { GlyphText } from "@/components/arcade";
import { t4 } from "@/components/arcade/tokens";
import {
  listSlackIntegrations,
  type SlackIntegration,
} from "@/lib/api/integrations";

const PENDING_WORKSPACE_KEY = "aio.slack.pendingWorkspaceId";
const RETURN_TO_KEY = "aio.slack.returnTo";

export default function SlackIntegrationSuccessPage() {
  const router = useRouter();
  const [message, setMessage] = useState("Slack 연동 정보를 갱신하는 중입니다.");
  const [returnTo, setReturnTo] = useState("/workspaces");

  useEffect(() => {
    let cancelled = false;
    let redirectTimer: ReturnType<typeof setTimeout> | null = null;

    async function refreshIntegration() {
      const params = new URLSearchParams(window.location.search);
      const workspaceIdRaw =
        params.get("workspaceId") ?? window.localStorage.getItem(PENDING_WORKSPACE_KEY);
      const nextReturnTo = window.localStorage.getItem(RETURN_TO_KEY) ?? "/workspaces";
      setReturnTo(nextReturnTo);

      const workspaceId = Number(workspaceIdRaw);
      if (!Number.isFinite(workspaceId)) {
        setMessage("Slack 연동이 완료되었습니다.");
        return;
      }

      try {
        const integrations = await listSlackIntegrations(workspaceId);
        if (cancelled) return;
        const latest = integrations[0] ?? null;
        if (latest) {
          writeSlackIntegration(workspaceId, latest);
        }
        window.localStorage.removeItem(PENDING_WORKSPACE_KEY);
        window.localStorage.removeItem(RETURN_TO_KEY);
        setMessage("Slack 연동이 완료되었습니다.");
        redirectTimer = setTimeout(() => router.push(nextReturnTo), 2500);
      } catch {
        if (cancelled) return;
        setMessage("Slack 연동은 완료되었지만 목록 갱신에 실패했습니다.");
      }
    }

    void refreshIntegration();
    return () => {
      cancelled = true;
      if (redirectTimer) clearTimeout(redirectTimer);
    };
  }, [router]);

  return (
    <main
      className="theme-web flex min-h-screen items-center justify-center p-6"
      style={{ background: t4.bg, color: t4.ink }}
    >
      <section
        className="w-full max-w-xl p-6"
        style={{
          border: `1px solid ${t4.ok}`,
          background: "rgba(20,28,55,0.94)",
          boxShadow: `0 0 22px ${t4.ok}35`,
        }}
      >
        <CheckCircle2 className="h-10 w-10" style={{ color: t4.ok }} />
        <h1
          className="mt-5"
          style={{
            fontFamily: "var(--font-pixel)",
            fontSize: 14,
            letterSpacing: 2,
            color: t4.ok,
            textShadow: `0 0 8px ${t4.ok}`,
          }}
        >
          <GlyphText glyph="◆">SLACK CONNECTED</GlyphText>
        </h1>
        <p className="mt-4 text-body text-text-muted">{message}</p>
        <div className="mt-6 flex justify-end">
          <Button type="button" onClick={() => router.push(returnTo)}>
            연동 목록으로 이동
          </Button>
        </div>
      </section>
    </main>
  );
}

function writeSlackIntegration(workspaceId: number, integration: SlackIntegration) {
  window.localStorage.setItem(
    `aio.workspace.${workspaceId}.integrations.slack`,
    JSON.stringify(integration),
  );
}
