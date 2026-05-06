"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Network, Plus, Users, ListChecks } from "lucide-react";
import { Badge, Button, Card } from "@/components/ui";
import { getStoredUser, type AuthUser, type ApiError } from "@/lib/api-client";
import { logout } from "@/lib/auth";
import { listWorkspaces, type WorkspaceSummary } from "@/lib/api/workspaces";

export default function WorkspacesPage() {
  const router = useRouter();
  const [user, setUser] = useState<AuthUser | null>(null);
  const [hydrated, setHydrated] = useState(false);
  const [workspaces, setWorkspaces] = useState<WorkspaceSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>("");

  useEffect(() => {
    let cancelled = false;
    queueMicrotask(() => {
      if (cancelled) return;
      const stored = getStoredUser();
      if (!stored) {
        router.replace("/auth");
        return;
      }
      setUser(stored);
      setHydrated(true);
    });
    return () => {
      cancelled = true;
    };
  }, [router]);

  useEffect(() => {
    if (!hydrated) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError("");
      try {
        const data = await listWorkspaces();
        if (!cancelled) setWorkspaces(data ?? []);
      } catch (err) {
        const apiErr = err as ApiError;
        if (!cancelled) setError(apiErr?.message ?? "워크스페이스를 불러오지 못했습니다.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [hydrated]);

  async function handleLogout() {
    await logout();
    router.replace("/auth");
  }

  if (!hydrated) return null;

  return (
    <main className="theme-web flex-1 px-8 py-10 max-w-6xl mx-auto w-full flex flex-col gap-8">
      <header className="flex items-center justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h1 className="text-heading">Workspaces</h1>
          <p className="text-body text-text-muted">
            {user?.name} · {user?.email}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link href="/workspaces/gateway">
            <Button variant="secondary" icon={<Network />}>게이트웨이</Button>
          </Link>
          <Link href="/workspaces/new">
            <Button icon={<Plus />}>새 워크스페이스</Button>
          </Link>
          <Button variant="secondary" onClick={handleLogout}>
            로그아웃
          </Button>
        </div>
      </header>

      {loading ? (
        <ListSkeleton />
      ) : error ? (
        <ErrorState message={error} />
      ) : workspaces.length === 0 ? (
        <EmptyState />
      ) : (
        <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {workspaces.map((ws) => (
            <WorkspaceCard key={ws.workspaceId} workspace={ws} />
          ))}
        </section>
      )}
    </main>
  );
}

function WorkspaceCard({ workspace }: { workspace: WorkspaceSummary }) {
  return (
    <Link href={`/workspaces/${workspace.workspaceId}`} className="block">
      <Card selectable className="p-5 h-full flex flex-col gap-4">
        <div className="flex items-start justify-between gap-3">
          <h2 className="text-title text-text leading-tight line-clamp-2">
            {workspace.name}
          </h2>
          <Badge variant={workspace.myRole === "ADMIN" ? "info" : "default"}>
            {workspace.myRole}
          </Badge>
        </div>

        <p className="text-body text-text-muted line-clamp-2 min-h-[2.5em]">
          {workspace.description || "설명이 없습니다."}
        </p>

        <div className="flex items-center gap-4 text-caption text-text-muted">
          <span className="inline-flex items-center gap-1">
            <Users className="w-3.5 h-3.5" />
            Agent {workspace.agentCount}
          </span>
          <span className="inline-flex items-center gap-1">
            <ListChecks className="w-3.5 h-3.5" />
            진행 {workspace.runningTaskCount}
          </span>
        </div>

        <p className="text-micro text-text-dim mt-auto">
          {formatDate(workspace.createdAt)} 생성
        </p>
      </Card>
    </Link>
  );
}

function EmptyState() {
  return (
    <section className="rounded-lg border border-border bg-surface px-6 py-16 text-center flex flex-col items-center gap-4">
      <p className="text-body text-text-muted">
        아직 참여한 워크스페이스가 없습니다.
      </p>
      <Link href="/workspaces/new">
        <Button icon={<Plus />}>첫 워크스페이스 만들기</Button>
      </Link>
    </section>
  );
}

function ErrorState({ message }: { message: string }) {
  return (
    <section className="rounded-lg border border-danger/40 bg-danger/10 px-6 py-10 text-center">
      <p className="text-body text-danger">{message}</p>
    </section>
  );
}

function ListSkeleton() {
  return (
    <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: 3 }).map((_, i) => (
        <div
          key={i}
          className="h-40 rounded-lg border border-border bg-surface animate-pulse"
        />
      ))}
    </section>
  );
}

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString("ko-KR", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  } catch {
    return iso;
  }
}
