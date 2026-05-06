"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { use, useEffect, useState } from "react";
import { Building2 } from "lucide-react";
import { Badge, Button } from "@/components/ui";
import { getStoredUser, type ApiError } from "@/lib/api-client";
import {
  acceptInvite,
  getInviteInfo,
  type InviteInfo,
} from "@/lib/api/invites";

type LoadState =
  | { kind: "loading" }
  | { kind: "ready"; invite: InviteInfo }
  | { kind: "error"; message: string };

export default function InviteAcceptPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = use(params);
  const router = useRouter();
  const [state, setState] = useState<LoadState>({ kind: "loading" });
  const [accepting, setAccepting] = useState(false);
  const [acceptError, setAcceptError] = useState("");

  useEffect(() => {
    let cancelled = false;
    queueMicrotask(() => {
      if (cancelled) return;
      if (!getStoredUser()) {
        router.replace(`/auth?returnTo=${encodeURIComponent(`/invites/${token}`)}`);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [router, token]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const invite = await getInviteInfo(token);
        if (!cancelled) setState({ kind: "ready", invite });
      } catch (err) {
        const apiErr = err as ApiError;
        if (!cancelled) {
          setState({
            kind: "error",
            message: apiErr?.message ?? "초대 정보를 불러오지 못했습니다.",
          });
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [token]);

  async function handleAccept() {
    setAcceptError("");
    setAccepting(true);
    try {
      await acceptInvite(token);
      router.replace("/workspaces");
    } catch (err) {
      const apiErr = err as ApiError;
      setAcceptError(apiErr?.message ?? "초대 수락에 실패했습니다.");
      setAccepting(false);
    }
  }

  return (
    <main className="theme-web flex-1 min-h-screen flex items-center justify-center px-4 py-10">
      <div className="w-full max-w-md flex flex-col gap-5">
        <header className="text-center flex flex-col gap-1">
          <h1 className="text-heading text-text">워크스페이스 초대</h1>
          <p className="text-caption text-text-muted">
            초대를 확인하고 참여하세요.
          </p>
        </header>

        <section className="rounded-xl border border-border bg-surface px-6 py-6 flex flex-col gap-5">
          {state.kind === "loading" && <Skeleton />}
          {state.kind === "error" && (
            <p className="text-body text-danger text-center">{state.message}</p>
          )}
          {state.kind === "ready" && (
            <InviteBody
              invite={state.invite}
              accepting={accepting}
              acceptError={acceptError}
              onAccept={handleAccept}
            />
          )}
        </section>

        <Link
          href="/workspaces"
          className="text-caption text-text-muted text-center hover:text-text"
        >
          내 워크스페이스로 이동
        </Link>
      </div>
    </main>
  );
}

function InviteBody({
  invite,
  accepting,
  acceptError,
  onAccept,
}: {
  invite: InviteInfo;
  accepting: boolean;
  acceptError: string;
  onAccept: () => void;
}) {
  const blocked = invite.expired || invite.status !== "PENDING";
  const blockedReason =
    invite.status === "ACCEPTED"
      ? "이미 수락된 초대입니다."
      : invite.status === "REVOKED"
        ? "폐기된 초대입니다."
        : invite.expired || invite.status === "EXPIRED"
          ? "만료된 초대입니다."
          : null;

  return (
    <>
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 rounded-md bg-surface-raised flex items-center justify-center text-text-secondary shrink-0">
          <Building2 className="w-5 h-5" />
        </div>
        <div className="flex flex-col gap-1 min-w-0">
          <p className="text-title text-text break-words">
            {invite.workspaceName}
          </p>
          <div className="flex items-center gap-2">
            <Badge variant={invite.role === "ADMIN" ? "info" : "default"}>
              {invite.role}
            </Badge>
            <span className="text-micro text-text-dim">
              만료 {formatDateTime(invite.expiresAt)}
            </span>
          </div>
        </div>
      </div>

      {blockedReason && (
        <p className="text-caption text-danger text-center">{blockedReason}</p>
      )}

      {acceptError && (
        <p className="text-caption text-danger text-center">{acceptError}</p>
      )}

      <Button
        onClick={onAccept}
        loading={accepting}
        disabled={blocked}
        className="w-full"
      >
        {blocked ? "수락할 수 없음" : "초대 수락"}
      </Button>
    </>
  );
}

function Skeleton() {
  return (
    <div className="flex flex-col gap-3 animate-pulse">
      <div className="flex gap-3">
        <div className="w-10 h-10 rounded-md bg-surface-raised" />
        <div className="flex-1 flex flex-col gap-2">
          <div className="h-4 bg-surface-raised rounded w-2/3" />
          <div className="h-3 bg-surface-raised rounded w-1/3" />
        </div>
      </div>
      <div className="h-9 bg-surface-raised rounded" />
    </div>
  );
}

function formatDateTime(iso: string): string {
  try {
    return new Date(iso).toLocaleString("ko-KR", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}
