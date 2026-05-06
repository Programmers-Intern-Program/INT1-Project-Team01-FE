"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState, type FormEvent } from "react";
import { ArrowLeft, CheckCircle2, Network, Plus, ServerCog } from "lucide-react";
import { Badge, Button, Card, Input } from "@/components/ui";
import { getStoredUser } from "@/lib/api-client";

interface GatewayEntry {
  id: string;
  displayName: string;
  gatewayUrl: string;
  maskedToken: string;
  createdAt: string;
}

const STORAGE_KEY = "aio.openclaw.gateways";
const DISPLAY_NAME_MAX = 80;
const URL_MAX = 300;

export default function GatewayPage() {
  const router = useRouter();
  const [hydrated, setHydrated] = useState(false);
  const [gateways, setGateways] = useState<GatewayEntry[]>([]);
  const [displayName, setDisplayName] = useState("");
  const [gatewayUrl, setGatewayUrl] = useState("");
  const [token, setToken] = useState("");
  const [selectedId, setSelectedId] = useState<string>("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [createdMessage, setCreatedMessage] = useState("");

  useEffect(() => {
    let cancelled = false;
    queueMicrotask(() => {
      if (cancelled) return;
      if (!getStoredUser()) {
        router.replace("/auth");
        return;
      }
      const stored = readGateways();
      setGateways(stored);
      setSelectedId(stored[0]?.id ?? "");
      setHydrated(true);
    });
    return () => {
      cancelled = true;
    };
  }, [router]);

  const selectedGateway = useMemo(
    () => gateways.find((gateway) => gateway.id === selectedId) ?? gateways[0],
    [gateways, selectedId],
  );

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const name = displayName.trim();
    const url = gatewayUrl.trim();
    const rawToken = token.trim();

    if (!name) {
      setError("표시 이름은 필수입니다.");
      return;
    }
    if (!url) {
      setError("OpenClaw 게이트웨이 URL은 필수입니다.");
      return;
    }
    if (!isHttpUrl(url)) {
      setError("게이트웨이 URL은 http:// 또는 https:// 로 시작해야 합니다.");
      return;
    }
    if (!rawToken) {
      setError("토큰은 필수입니다.");
      return;
    }

    setSubmitting(true);
    setError("");
    const nextGateway: GatewayEntry = {
      id: createId(),
      displayName: name,
      gatewayUrl: url,
      maskedToken: maskToken(rawToken),
      createdAt: new Date().toISOString(),
    };
    const nextGateways = [nextGateway, ...gateways];
    writeGateways(nextGateways);
    setGateways(nextGateways);
    setSelectedId(nextGateway.id);
    setDisplayName("");
    setGatewayUrl("");
    setToken("");
    setCreatedMessage("OpenClaw 게이트웨이가 등록되었습니다.");
    setSubmitting(false);
  }

  if (!hydrated) return null;

  return (
    <main className="theme-web min-h-screen px-6 py-10">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-6">
        <Link
          href="/workspaces"
          className="inline-flex w-fit items-center gap-1 text-caption text-text-muted hover:text-text"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          워크스페이스 목록
        </Link>

        <header className="flex flex-col gap-1">
          <h1 className="text-heading">게이트웨이</h1>
          <p className="text-body text-text-muted">
            OpenClaw 게이트웨이를 등록하고 워크스페이스에서 사용할 연결 대상을 확인합니다.
          </p>
        </header>

        <div className="grid gap-6 lg:grid-cols-[280px_minmax(0,1fr)]">
          <aside className="flex flex-col gap-3">
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-title text-text">등록된 게이트웨이</h2>
              <Badge variant="info">{gateways.length}</Badge>
            </div>

            {gateways.length === 0 ? (
              <section className="rounded-lg border border-border bg-surface px-4 py-8 text-center">
                <Network className="mx-auto h-8 w-8 text-text-dim" />
                <p className="mt-3 text-caption text-text-muted">
                  아직 등록된 게이트웨이가 없습니다.
                </p>
              </section>
            ) : (
              <section className="grid gap-2">
                {gateways.map((gateway) => (
                  <button
                    key={gateway.id}
                    type="button"
                    onClick={() => setSelectedId(gateway.id)}
                    className={[
                      "rounded-lg border bg-surface p-4 text-left transition-colors",
                      selectedGateway?.id === gateway.id
                        ? "border-primary-light ring-2 ring-primary"
                        : "border-border hover:border-primary-light",
                    ].join(" ")}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <p className="truncate text-body font-semibold text-text">
                        {gateway.displayName}
                      </p>
                      <Badge variant="success">등록됨</Badge>
                    </div>
                    <p className="mt-2 truncate text-caption text-text-muted">
                      {gateway.gatewayUrl}
                    </p>
                    <p className="mt-2 text-micro text-text-dim">
                      {formatDateTime(gateway.createdAt)}
                    </p>
                  </button>
                ))}
              </section>
            )}

            {selectedGateway && (
              <Card className="p-4">
                <div className="flex items-start gap-3">
                  <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-success" />
                  <div className="min-w-0">
                    <p className="text-caption font-semibold text-text">선택된 게이트웨이</p>
                    <p className="mt-1 truncate text-body text-text">{selectedGateway.displayName}</p>
                    <p className="mt-1 truncate text-micro text-text-muted">
                      Token {selectedGateway.maskedToken}
                    </p>
                  </div>
                </div>
              </Card>
            )}
          </aside>

          <section className="flex flex-col gap-5">
            <Card className="p-6">
              <div className="flex flex-col gap-1">
                <h2 className="text-heading">게이트 웨이 등록</h2>
                <p className="text-body text-text-muted">
                  OpenClaw 게이트웨이 등록
                </p>
              </div>

              <form onSubmit={handleSubmit} className="mt-6 flex flex-col gap-5">
                <Field
                  label="표시 이름"
                  required
                  counter={`${displayName.length}/${DISPLAY_NAME_MAX}`}
                >
                  <Input
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    maxLength={DISPLAY_NAME_MAX}
                    placeholder="예) 로컬 OpenClaw Gateway"
                    disabled={submitting}
                    autoFocus
                  />
                </Field>

                <Field
                  label="OpenClaw 게이트웨이 URL"
                  required
                  counter={`${gatewayUrl.length}/${URL_MAX}`}
                >
                  <Input
                    value={gatewayUrl}
                    onChange={(e) => setGatewayUrl(e.target.value)}
                    maxLength={URL_MAX}
                    placeholder="예) http://localhost:4317"
                    disabled={submitting}
                  />
                </Field>

                <Field label="토큰" required>
                  <Input
                    type="password"
                    value={token}
                    onChange={(e) => setToken(e.target.value)}
                    placeholder="OpenClaw gateway token"
                    disabled={submitting}
                  />
                </Field>

                {error && <p className="text-caption text-danger">{error}</p>}
                {createdMessage && !error && (
                  <p className="text-caption text-success">{createdMessage}</p>
                )}

                <div className="flex items-center justify-end gap-2">
                  <Link href="/workspaces">
                    <Button type="button" variant="ghost" disabled={submitting}>
                      취소
                    </Button>
                  </Link>
                  <Button type="submit" icon={<Plus />} loading={submitting}>
                    생성
                  </Button>
                </div>
              </form>
            </Card>

            <section className="grid gap-3 md:grid-cols-3">
              <InfoCard title="등록" description="표시 이름, URL, 토큰을 입력해 게이트웨이를 추가합니다." />
              <InfoCard title="확인" description="왼쪽 사이드바에서 등록된 게이트웨이를 확인합니다." />
              <InfoCard title="연결" description="Workspace 단위 연결 API가 준비되면 여기서 바인딩합니다." />
            </section>
          </section>
        </div>
      </div>
    </main>
  );
}

function Field({
  label,
  required,
  counter,
  children,
}: {
  label: string;
  required?: boolean;
  counter?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="flex items-center justify-between text-caption text-text-secondary">
        <span>
          {label}
          {required && <span className="ml-0.5 text-danger">*</span>}
        </span>
        {counter && <span className="text-micro text-text-dim">{counter}</span>}
      </span>
      {children}
    </label>
  );
}

function InfoCard({ title, description }: { title: string; description: string }) {
  return (
    <Card className="p-4">
      <ServerCog className="h-5 w-5 text-primary" />
      <p className="mt-3 text-caption font-semibold text-text">{title}</p>
      <p className="mt-1 text-caption text-text-muted">{description}</p>
    </Card>
  );
}

function readGateways(): GatewayEntry[] {
  if (typeof window === "undefined") return [];
  const raw = window.localStorage.getItem(STORAGE_KEY);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as GatewayEntry[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeGateways(gateways: GatewayEntry[]) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(gateways));
}

function createId() {
  if (typeof window !== "undefined" && window.crypto?.randomUUID) {
    return window.crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function maskToken(token: string) {
  if (token.length <= 8) return "****";
  return `${token.slice(0, 4)}...${token.slice(-4)}`;
}

function isHttpUrl(value: string) {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
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
