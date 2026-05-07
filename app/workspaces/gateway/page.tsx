"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState, type FormEvent } from "react";
import { Button, Input } from "@/components/ui";
import { T4Screen, T4Panel } from "@/components/arcade";
import { t4 } from "@/components/arcade/tokens";
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
        router.replace("/");
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
    setCreatedMessage("WARP GATE LINKED.");
    setSubmitting(false);
  }

  if (!hydrated) return null;

  return (
    <T4Screen title="GATEWAY · WARP STATIONS">
      <div
        style={{
          padding: "30px 28px",
          height: "100%",
          boxSizing: "border-box",
          display: "flex",
          flexDirection: "column",
          gap: 18,
          maxWidth: 1100,
          margin: "0 auto",
          width: "100%",
        }}
      >
        <Link
          href="/workspaces"
          style={{
            fontFamily: "var(--font-pixel)",
            fontSize: 8,
            letterSpacing: 2,
            color: t4.dim,
            textDecoration: "none",
          }}
        >
          ◀ BACK TO WORKPLACES
        </Link>

        <div>
          <div
            style={{
              fontFamily: "var(--font-pixel)",
              fontSize: 8,
              color: t4.mp,
              letterSpacing: 3,
              marginBottom: 4,
            }}
          >
            ◆ OPENCLAW · WARP NET
          </div>
          <h1
            style={{
              fontFamily: "var(--font-pixel)",
              fontSize: 22,
              letterSpacing: 2,
              margin: 0,
              color: t4.ink,
              textShadow: `0 0 12px ${t4.mp}80`,
            }}
          >
            REGISTER A GATEWAY
          </h1>
          <p
            style={{
              fontFamily: "var(--font-mono-arcade)",
              fontSize: 11,
              color: t4.dim,
              marginTop: 8,
            }}
          >
            Link an OpenClaw gateway so workplaces can summon agents through it.
          </p>
        </div>

        <div className="grid gap-5 lg:grid-cols-[300px_minmax(0,1fr)]">
          <aside className="flex flex-col gap-4">
            <T4Panel label={`LINKED · ${String(gateways.length).padStart(2, "0")}`} accent={t4.mp} style={{ position: "relative", padding: 12 }}>
              {gateways.length === 0 ? (
                <p
                  style={{
                    fontFamily: "var(--font-mono-arcade)",
                    fontSize: 11,
                    color: t4.dim,
                    padding: "14px 6px",
                    textAlign: "center",
                  }}
                >
                  ◇ no gateway linked yet
                </p>
              ) : (
                <div className="grid gap-2">
                  {gateways.map((gateway) => {
                    const active = selectedGateway?.id === gateway.id;
                    return (
                      <button
                        key={gateway.id}
                        type="button"
                        onClick={() => setSelectedId(gateway.id)}
                        style={{
                          padding: "10px 12px",
                          textAlign: "left",
                          background: active ? "rgba(90,168,255,0.08)" : "rgba(0,0,0,0.3)",
                          border: `1px solid ${active ? t4.mp : t4.line}`,
                          boxShadow: active ? `0 0 10px ${t4.mp}40` : "none",
                          cursor: "pointer",
                          color: t4.ink,
                        }}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span
                            className="truncate"
                            style={{
                              fontFamily: "var(--font-pixel)",
                              fontSize: 9,
                              letterSpacing: 1.5,
                              color: active ? t4.mp : t4.ink,
                            }}
                          >
                            ♦ {gateway.displayName.toUpperCase()}
                          </span>
                          <span
                            style={{
                              fontFamily: "var(--font-pixel)",
                              fontSize: 7,
                              letterSpacing: 1,
                              color: t4.ok,
                              border: `1px solid ${t4.ok}`,
                              padding: "2px 5px",
                            }}
                          >
                            ON
                          </span>
                        </div>
                        <p
                          className="mt-2 truncate"
                          style={{
                            fontFamily: "var(--font-mono-arcade)",
                            fontSize: 10,
                            color: t4.dim,
                          }}
                        >
                          {gateway.gatewayUrl}
                        </p>
                        <p
                          className="mt-1"
                          style={{
                            fontFamily: "var(--font-mono-arcade)",
                            fontSize: 9,
                            color: t4.dim,
                          }}
                        >
                          ◆ {formatDateTime(gateway.createdAt)}
                        </p>
                      </button>
                    );
                  })}
                </div>
              )}
            </T4Panel>

            {selectedGateway && (
              <T4Panel label="ACTIVE LINK" accent={t4.ok} style={{ position: "relative", padding: 14 }}>
                <p
                  style={{
                    fontFamily: "var(--font-pixel)",
                    fontSize: 8,
                    color: t4.dim,
                    letterSpacing: 2,
                  }}
                >
                  TARGET
                </p>
                <p
                  className="mt-2 truncate"
                  style={{
                    fontFamily: "var(--font-pixel)",
                    fontSize: 11,
                    color: t4.ok,
                    letterSpacing: 1.5,
                    textShadow: `0 0 6px ${t4.ok}`,
                  }}
                >
                  {selectedGateway.displayName.toUpperCase()}
                </p>
                <p
                  className="mt-3"
                  style={{
                    fontFamily: "var(--font-mono-arcade)",
                    fontSize: 10,
                    color: t4.dim,
                  }}
                >
                  TOKEN · {selectedGateway.maskedToken}
                </p>
              </T4Panel>
            )}
          </aside>

          <T4Panel label="GATE FORM" accent={t4.mp} style={{ position: "relative", padding: 22 }}>
            <form onSubmit={handleSubmit} className="flex flex-col gap-5">
              <Field
                label="DISPLAY NAME"
                required
                counter={`${displayName.length}/${DISPLAY_NAME_MAX}`}
              >
                <Input
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  maxLength={DISPLAY_NAME_MAX}
                  placeholder="e.g. local openclaw gateway"
                  disabled={submitting}
                  autoFocus
                />
              </Field>

              <Field
                label="GATEWAY URL"
                required
                counter={`${gatewayUrl.length}/${URL_MAX}`}
              >
                <Input
                  value={gatewayUrl}
                  onChange={(e) => setGatewayUrl(e.target.value)}
                  maxLength={URL_MAX}
                  placeholder="http://localhost:4317"
                  disabled={submitting}
                />
              </Field>

              <Field label="TOKEN" required>
                <Input
                  type="password"
                  value={token}
                  onChange={(e) => setToken(e.target.value)}
                  placeholder="openclaw gateway token"
                  disabled={submitting}
                />
              </Field>

              {error && (
                <p
                  style={{
                    fontFamily: "var(--font-mono-arcade)",
                    fontSize: 11,
                    color: t4.hp,
                  }}
                >
                  ⚠ {error}
                </p>
              )}
              {createdMessage && !error && (
                <p
                  style={{
                    fontFamily: "var(--font-pixel)",
                    fontSize: 8,
                    letterSpacing: 2,
                    color: t4.ok,
                    textShadow: `0 0 6px ${t4.ok}`,
                  }}
                >
                  ★ {createdMessage}
                </p>
              )}

              <div className="flex items-center justify-end gap-2">
                <Link href="/workspaces">
                  <Button type="button" variant="ghost" disabled={submitting}>
                    CANCEL
                  </Button>
                </Link>
                <Button type="submit" loading={submitting}>
                  ▶ LINK GATE
                </Button>
              </div>
            </form>
          </T4Panel>
        </div>

        <div className="grid gap-3 md:grid-cols-3">
          <InfoCard step="01" title="REGISTER" description="Type a label, gateway URL, and token to add a station." />
          <InfoCard step="02" title="VERIFY" description="The sidebar lists every linked gateway with its status." />
          <InfoCard step="03" title="BIND" description="Workspace-level binding ships when the API lands." />
        </div>
      </div>
    </T4Screen>
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
    <label className="flex flex-col gap-2">
      <span className="flex items-center justify-between">
        <span
          style={{
            fontFamily: "var(--font-pixel)",
            fontSize: 8,
            letterSpacing: 2,
            color: t4.dim,
          }}
        >
          ◇ {label}
          {required && <span style={{ color: t4.hp, marginLeft: 4 }}>*</span>}
        </span>
        {counter && (
          <span
            style={{
              fontFamily: "var(--font-mono-arcade)",
              fontSize: 9,
              color: t4.dim,
            }}
          >
            {counter}
          </span>
        )}
      </span>
      {children}
    </label>
  );
}

function InfoCard({
  step,
  title,
  description,
}: {
  step: string;
  title: string;
  description: string;
}) {
  return (
    <T4Panel accent={t4.agent} style={{ position: "relative", padding: 14 }}>
      <p
        style={{
          fontFamily: "var(--font-pixel)",
          fontSize: 7,
          letterSpacing: 2,
          color: t4.agent,
        }}
      >
        STEP {step}
      </p>
      <p
        className="mt-2"
        style={{
          fontFamily: "var(--font-pixel)",
          fontSize: 10,
          letterSpacing: 1.5,
          color: t4.ink,
        }}
      >
        ▸ {title}
      </p>
      <p
        className="mt-2"
        style={{
          fontFamily: "var(--font-mono-arcade)",
          fontSize: 11,
          color: t4.dim,
          lineHeight: 1.5,
        }}
      >
        {description}
      </p>
    </T4Panel>
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
