"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { getStoredUser, type AuthUser, type ApiError } from "@/lib/api-client";
import { logout } from "@/lib/auth";
import { listWorkspaces, type WorkspaceSummary } from "@/lib/api/workspaces";
import { T4Screen, T4Panel, PixelAvatar } from "@/components/arcade";
import { t4 } from "@/components/arcade/tokens";

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
        router.replace("/");
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
        if (!cancelled)
          setError(apiErr?.message ?? "워크스페이스를 불러오지 못했습니다.");
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
    router.replace("/");
  }

  if (!hydrated) return null;

  const activeCount = workspaces.reduce(
    (acc, w) => acc + (w.runningTaskCount ?? 0),
    0,
  );
  const agentCount = workspaces.reduce(
    (acc, w) => acc + (w.agentCount ?? 0),
    0,
  );

  return (
    <T4Screen title="WORKSPACES · SELECT YOUR QUEST">
      <div
        style={{
          padding: 20,
          height: "100%",
          boxSizing: "border-box",
          display: "grid",
          gridTemplateRows: "auto auto 1fr",
          gap: 14,
          overflow: "auto",
        }}
      >
        {/* Header */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: 16,
            flexWrap: "wrap",
          }}
        >
          <div>
            <div
              style={{
                fontFamily: "var(--font-pixel)",
                fontSize: 9,
                color: t4.pink,
                letterSpacing: 3,
                marginBottom: 4,
              }}
            >
              ◆ HERO {user?.name ?? "PLAYER"}
            </div>
            <h2
              style={{
                fontFamily: "var(--font-pixel)",
                fontSize: 22,
                letterSpacing: 2,
                margin: 0,
                color: t4.ink,
                textShadow: `0 0 12px ${t4.pink}80`,
              }}
            >
              WORKSPACES
            </h2>
            <div
              style={{
                fontFamily: "var(--font-mono-arcade)",
                fontSize: 10,
                color: t4.dim,
                marginTop: 4,
              }}
            >
              {user?.email}
            </div>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <Link href="/workspaces/gateway">
              <ArcadeButton color={t4.mp}>◇ GATEWAY</ArcadeButton>
            </Link>
            <Link href="/workspaces/new">
              <ArcadeButton color={t4.pink} primary>
                ▶ NEW WORKSPACE
              </ArcadeButton>
            </Link>
            <ArcadeButton color={t4.dim} onClick={handleLogout}>
              LOG OUT
            </ArcadeButton>
          </div>
        </div>

        {/* KPI tiles */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(4, 1fr)",
            gap: 10,
          }}
        >
          {[
            {
              label: "WORKPLACES JOINED",
              value: String(workspaces.length).padStart(2, "0"),
              color: t4.pink,
              sub: "active workspaces",
            },
            {
              label: "TASKS · ACTIVE",
              value: String(activeCount).padStart(2, "0"),
              color: t4.mp,
              sub: "running tasks",
            },
            {
              label: "AGENT ALLIES",
              value: String(agentCount).padStart(2, "0"),
              color: t4.agent,
              sub: "summoned",
            },
            {
              label: "TEAM XP / WK",
              value: "+38k",
              color: t4.xp,
              sub: "↑ 12%",
            },
          ].map((tile) => (
            <T4Panel
              key={tile.label}
              accent={tile.color}
              style={{ padding: "10px 12px", position: "relative" }}
            >
              <div
                style={{
                  fontFamily: "var(--font-pixel)",
                  fontSize: 7,
                  color: t4.dim,
                  letterSpacing: 2,
                }}
              >
                {tile.label}
              </div>
              <div
                style={{
                  fontFamily: "var(--font-pixel)",
                  fontSize: 22,
                  color: tile.color,
                  marginTop: 4,
                  textShadow: `0 0 10px ${tile.color}`,
                }}
              >
                {tile.value}
              </div>
              <div
                style={{
                  fontFamily: "var(--font-mono-arcade)",
                  fontSize: 9,
                  color: t4.dim,
                  marginTop: 4,
                }}
              >
                {tile.sub}
              </div>
            </T4Panel>
          ))}
        </div>

        {/* Workspace quest list */}
        <T4Panel
          label="ACTIVE WORKPLACES"
          accent={t4.pink}
          style={{ position: "relative", padding: 14, minHeight: 220 }}
        >
          {loading ? (
            <ListSkeleton />
          ) : error ? (
            <div
              style={{
                fontFamily: "var(--font-mono-arcade)",
                fontSize: 11,
                color: t4.hp,
                padding: 20,
                textAlign: "center",
              }}
            >
              ⚠ {error}
            </div>
          ) : workspaces.length === 0 ? (
            <EmptyState />
          ) : (
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: 8,
              }}
            >
              {workspaces.map((ws, idx) => (
                <WorkspaceRow key={ws.workspaceId} workspace={ws} index={idx} />
              ))}
            </div>
          )}
        </T4Panel>
      </div>
    </T4Screen>
  );
}

function WorkspaceRow({
  workspace,
  index,
}: {
  workspace: WorkspaceSummary;
  index: number;
}) {
  const isAdmin = workspace.myRole === "ADMIN";
  const accent = isAdmin ? t4.pink : t4.mp;
  return (
    <Link
      href={`/workspaces/${workspace.workspaceId}`}
      style={{
        display: "grid",
        gridTemplateColumns: "60px 1fr 140px 140px 80px",
        gap: 12,
        alignItems: "center",
        padding: "10px 12px",
        border: `1px solid ${accent}40`,
        background: "rgba(0,0,0,0.25)",
        textDecoration: "none",
        color: "inherit",
        transition: "background 80ms ease",
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.background = `${accent}15`;
        e.currentTarget.style.borderColor = accent;
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.background = "rgba(0,0,0,0.25)";
        e.currentTarget.style.borderColor = `${accent}40`;
      }}
    >
      <div
        style={{
          fontFamily: "var(--font-pixel)",
          fontSize: 8,
          color: t4.dim,
          letterSpacing: 1,
        }}
      >
        W{String(index + 1).padStart(3, "0")}
      </div>
      <div>
        <div
          style={{
            fontFamily: "var(--font-pixel)",
            fontSize: 10,
            letterSpacing: 1,
            color: t4.ink,
            marginBottom: 4,
          }}
        >
          {workspace.name}
        </div>
        <div
          style={{
            fontFamily: "var(--font-mono-arcade)",
            fontSize: 9,
            color: t4.dim,
            marginTop: 2,
          }}
        >
          {workspace.description || "no description"}
        </div>
        <div
          style={{
            fontFamily: "var(--font-mono-arcade)",
            fontSize: 9,
            color: accent,
            marginTop: 4,
            letterSpacing: 1,
            textTransform: "uppercase",
          }}
        >
          [{workspace.myRole}]
        </div>
      </div>
      <div
        style={{
          fontFamily: "var(--font-mono-arcade)",
          fontSize: 10,
          color: t4.agent,
        }}
      >
        ◇ {workspace.agentCount} agents
      </div>
      <div
        style={{
          fontFamily: "var(--font-mono-arcade)",
          fontSize: 10,
          color: t4.ok,
        }}
      >
        ▷ {workspace.runningTaskCount} active
      </div>
      <div
        style={{
          fontFamily: "var(--font-pixel)",
          fontSize: 8,
          letterSpacing: 1,
          color: accent,
          textAlign: "center",
          padding: "6px 8px",
          border: `1px solid ${accent}`,
        }}
      >
        ▶ ENTER
      </div>
    </Link>
  );
}

function ArcadeButton({
  children,
  color = t4.pink,
  onClick,
  primary = false,
}: {
  children: React.ReactNode;
  color?: string;
  onClick?: () => void;
  primary?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        fontFamily: "var(--font-pixel)",
        fontSize: 9,
        letterSpacing: 1.5,
        padding: "9px 14px",
        background: primary ? color : "transparent",
        color: primary ? "#000" : color,
        border: `1px solid ${color}`,
        boxShadow: primary
          ? `0 0 14px ${color}`
          : `0 0 6px ${color}30`,
        cursor: "pointer",
        textTransform: "uppercase",
      }}
    >
      {children}
    </button>
  );
}

function EmptyState() {
  return (
    <div
      style={{
        padding: "40px 20px",
        textAlign: "center",
        fontFamily: "var(--font-mono-arcade)",
        color: t4.dim,
        fontSize: 11,
      }}
    >
      <div style={{ marginBottom: 14 }}>
        <PixelAvatar kind="agent" size={3} style={{ margin: "0 auto" }} />
      </div>
      <div style={{ marginBottom: 14 }}>
        no workspaces yet — start a new save to begin your work RPG
      </div>
      <Link
        href="/workspaces/new"
        style={{
          fontFamily: "var(--font-pixel)",
          fontSize: 9,
          color: "#000",
          background: t4.pink,
          padding: "10px 16px",
          letterSpacing: 1.5,
          textDecoration: "none",
          boxShadow: `0 0 14px ${t4.pink}`,
        }}
      >
        ▶ CREATE WORKSPACE
      </Link>
    </div>
  );
}

function ListSkeleton() {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      {Array.from({ length: 3 }).map((_, i) => (
        <div
          key={i}
          style={{
            height: 60,
            border: `1px solid ${t4.line}`,
            background: "rgba(0,0,0,0.25)",
            opacity: 0.5,
          }}
        />
      ))}
    </div>
  );
}
