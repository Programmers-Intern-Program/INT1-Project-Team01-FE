"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";
import { Button, Input, Textarea } from "@/components/ui";
import { getStoredUser, type ApiError } from "@/lib/api-client";
import { createWorkspace } from "@/lib/api/workspaces";
import { GlyphText, T4Screen, T4Panel } from "@/components/arcade";
import { t4 } from "@/components/arcade/tokens";

const NAME_MAX = 100;
const DESCRIPTION_MAX = 500;

export default function NewWorkspacePage() {
  const router = useRouter();
  const [hydrated, setHydrated] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    queueMicrotask(() => {
      if (cancelled) return;
      if (!getStoredUser()) {
        router.replace("/");
        return;
      }
      setHydrated(true);
    });
    return () => {
      cancelled = true;
    };
  }, [router]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const trimmedName = name.trim();
    if (!trimmedName) {
      setError("워크스페이스 이름은 필수입니다.");
      return;
    }
    setError("");
    setSubmitting(true);
    try {
      const created = await createWorkspace({
        name: trimmedName,
        description: description.trim() || undefined,
      });
      router.replace(`/workspaces/${created.workspaceId}`);
    } catch (err) {
      const apiErr = err as ApiError;
      setError(apiErr?.message ?? "워크스페이스 생성에 실패했습니다.");
      setSubmitting(false);
    }
  }

  if (!hydrated) return null;

  return (
    <T4Screen title="NEW WORKSPACE · CHARACTER CREATE">
      <div
        style={{
          padding: "30px 28px",
          height: "100%",
          boxSizing: "border-box",
          display: "flex",
          flexDirection: "column",
          gap: 18,
          maxWidth: 720,
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
          <GlyphText glyph="◀">BACK TO WORKSPACES</GlyphText>
        </Link>

        <div>
          <div
            style={{
              fontFamily: "var(--font-pixel)",
              fontSize: 8,
              color: t4.pink,
              letterSpacing: 3,
              marginBottom: 4,
            }}
          >
            <GlyphText glyph="◆">STEP 01 / 02</GlyphText>
          </div>
          <h1
            style={{
              fontFamily: "var(--font-pixel)",
              fontSize: 22,
              letterSpacing: 2,
              margin: 0,
              color: t4.ink,
              textShadow: `0 0 12px ${t4.pink}80`,
            }}
          >
            FORM A NEW WORKSPACE
          </h1>
          <p
            style={{
              fontFamily: "var(--font-mono-arcade)",
              fontSize: 11,
              color: t4.dim,
              marginTop: 8,
            }}
          >
            워크스페이스 이름과 간단한 소개를 적어주세요. 생성자에게는 ADMIN 권한이 부여됩니다.
          </p>
        </div>

        <T4Panel label="WORKSPACE DETAILS" accent={t4.pink} style={{ position: "relative", padding: 22 }}>
          <form onSubmit={handleSubmit} className="flex flex-col gap-5">
            <Field
              label="WORKSPACE NAME"
              required
              counter={`${name.length}/${NAME_MAX}`}
            >
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                maxLength={NAME_MAX}
                placeholder="예: 백엔드 엔지니어링 길드"
                autoFocus
                disabled={submitting}
              />
            </Field>

            <Field
              label="BRIEFING"
              counter={`${description.length}/${DESCRIPTION_MAX}`}
            >
              <Textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                maxLength={DESCRIPTION_MAX}
                rows={4}
                placeholder="워크스페이스의 미션, 진행 중인 작업 등을 설명해 주세요."
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
                <GlyphText glyph="⚠">{error}</GlyphText>
              </p>
            )}

            <div className="flex items-center justify-end gap-2">
              <Link href="/workspaces">
                <Button type="button" variant="ghost" disabled={submitting}>
                  CANCEL
                </Button>
              </Link>
              <Button type="submit" loading={submitting}>
                <GlyphText glyph="▶">FORM WORKSPACE</GlyphText>
              </Button>
            </div>
          </form>
        </T4Panel>
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
          <GlyphText glyph="◇">
            {label}
            {required && (
              <span style={{ color: t4.hp, marginLeft: 4 }}>*</span>
            )}
          </GlyphText>
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
