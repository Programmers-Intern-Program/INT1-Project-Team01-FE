"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import {
  Bell,
  Bot,
  ChevronLeft,
  Building2,
  MessageCircle,
  Radio,
  Settings,
} from "lucide-react";
import { Badge, Button } from "@/components/ui";
import { GlyphText } from "@/components/arcade";
import type { WorkspaceDetail } from "@/lib/api/workspaces";

interface WorkspaceShellProps {
  workspace: WorkspaceDetail;
  children: ReactNode;
  sidebar?: ReactNode;
}

const NAV_ITEMS = [
  { label: "Office", href: "", icon: Building2 },
  { label: "Settings", href: "/settings", icon: Settings },
  { label: "Slack", href: "/settings/slack", icon: Bell },
  { label: "Discord", href: "/settings/discord", icon: MessageCircle },
];

export default function WorkspaceShell({
  workspace,
  children,
  sidebar,
}: WorkspaceShellProps) {
  const pathname = usePathname();
  const baseHref = `/workspaces/${workspace.workspaceId}`;

  return (
    <main className="theme-web min-h-screen w-full">
      <div className="mx-auto flex min-h-screen w-full max-w-7xl flex-col px-5 py-6 lg:px-8">
        <header className="flex flex-col gap-4 border-b border-border/80 pb-5 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex min-w-0 flex-col gap-3">
            <Link
              href="/workspaces"
              className="inline-flex w-fit items-center gap-1 text-caption text-text-muted hover:text-text"
            >
              <ChevronLeft className="h-3.5 w-3.5" />
              워크스페이스 목록
            </Link>
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="text-heading text-text">{workspace.name}</h1>
              <Badge variant={workspace.myRole === "ADMIN" ? "info" : "default"}>
                {workspace.myRole}
              </Badge>
            </div>
            {workspace.description && (
              <p className="max-w-2xl text-body text-text-muted">
                {workspace.description}
              </p>
            )}
          </div>

          <div className="grid grid-cols-3 gap-2 text-caption text-text-muted sm:flex">
            <StatusPill icon={<Radio />} label="Gateway" state="준비" />
            <StatusPill icon={<Bot />} label="Agents" state="대기" />
            <StatusPill icon={<Settings />} label="Settings" state="연동" />
          </div>
        </header>

        <div className="grid flex-1 gap-6 py-6 lg:grid-cols-[220px_minmax(0,1fr)]">
          <aside className="flex flex-col gap-4">
            <nav className="grid gap-1 rounded-lg border border-[var(--neon-border-muted)] bg-surface/92 p-2">
              {NAV_ITEMS.map((item) => {
                const href = `${baseHref}${item.href}`;
                const active =
                  item.href === ""
                    ? pathname === baseHref
                    : item.href === "/settings"
                      ? pathname === href
                      : pathname.startsWith(href);
                const Icon = item.icon;
                return (
                  <Link
                    key={item.label}
                    href={href}
                    className={[
                      "flex items-center gap-2 rounded-md px-3 py-2 text-body font-semibold transition-colors",
                      active
                        ? "bg-primary-muted text-primary"
                        : "text-text-muted hover:bg-surface-raised hover:text-text",
                    ].join(" ")}
                  >
                    <Icon className="h-4 w-4" />
                    {item.label}
                  </Link>
                );
              })}
            </nav>
            {sidebar}
          </aside>

          <section className="min-w-0">{children}</section>
        </div>
      </div>
    </main>
  );
}

function StatusPill({
  icon,
  label,
  state,
}: {
  icon: ReactNode;
  label: string;
  state: string;
}) {
  return (
    <div className="inline-flex items-center justify-center gap-2 rounded-md border border-[var(--neon-border-muted)] bg-surface/88 px-3 py-2">
      <span className="h-4 w-4 text-primary">{icon}</span>
      <span>{label}</span>
      <span className="font-semibold text-text-secondary">{state}</span>
    </div>
  );
}

export function WorkspaceErrorState({ message }: { message: string }) {
  return (
    <main
      className="theme-web flex min-h-screen items-center justify-center px-4"
      style={{ background: "var(--t4-bg)" }}
    >
      <section
        className="w-full max-w-md px-6 py-8 text-center"
        style={{
          border: "1px solid var(--t4-hp)",
          background: "rgba(20,28,55,0.92)",
          boxShadow: "0 0 24px rgba(255,85,119,0.3)",
        }}
      >
        <p
          style={{
            fontFamily: "var(--font-pixel)",
            fontSize: 10,
            letterSpacing: 2,
            color: "var(--t4-hp)",
            textShadow: "0 0 6px var(--t4-hp)",
            marginBottom: 16,
          }}
        >
          <GlyphText glyph="⚠">ERROR</GlyphText>
        </p>
        <p
          style={{
            fontFamily: "var(--font-mono-arcade)",
            fontSize: 12,
            color: "var(--t4-ink)",
          }}
        >
          {message}
        </p>
        <Link href="/workspaces" className="mt-5 inline-flex">
          <Button variant="secondary">
            <GlyphText glyph="◀">WORKSPACES</GlyphText>
          </Button>
        </Link>
      </section>
    </main>
  );
}

export function WorkspaceLoadingState() {
  return (
    <main
      className="theme-web flex min-h-screen items-center justify-center px-4"
      style={{ background: "var(--t4-bg)" }}
    >
      <div
        style={{
          fontFamily: "var(--font-pixel)",
          fontSize: 12,
          letterSpacing: 3,
          color: "var(--t4-pink)",
          textShadow: "0 0 8px var(--t4-pink)",
          animation: "t4-pulse 1.4s ease-in-out infinite",
        }}
      >
        <GlyphText glyph="◆">LOADING WORLD...</GlyphText>
      </div>
    </main>
  );
}
