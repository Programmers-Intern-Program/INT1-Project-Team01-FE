"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";
import { ArrowLeft } from "lucide-react";
import { Button, Input, Textarea } from "@/components/ui";
import { getStoredUser, type ApiError } from "@/lib/api-client";
import { createWorkspace } from "@/lib/api/workspaces";

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
        router.replace("/auth");
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
    <main className="theme-web flex-1 px-6 py-10 max-w-2xl mx-auto w-full flex flex-col gap-6">
      <Link
        href="/workspaces"
        className="inline-flex items-center gap-1 text-caption text-text-muted hover:text-text"
      >
        <ArrowLeft className="w-3.5 h-3.5" />
        워크스페이스 목록
      </Link>

      <header className="flex flex-col gap-1">
        <h1 className="text-heading">새 워크스페이스</h1>
        <p className="text-body text-text-muted">
          팀이 함께 사용할 워크스페이스를 만듭니다. 생성자는 자동으로 ADMIN 역할이 됩니다.
        </p>
      </header>

      <form
        onSubmit={handleSubmit}
        className="rounded-xl border border-border bg-surface px-6 py-6 flex flex-col gap-5"
      >
        <Field
          label="이름"
          required
          counter={`${name.length}/${NAME_MAX}`}
        >
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={NAME_MAX}
            placeholder="예) 백엔드 개발팀"
            autoFocus
            disabled={submitting}
          />
        </Field>

        <Field
          label="설명"
          counter={`${description.length}/${DESCRIPTION_MAX}`}
        >
          <Textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            maxLength={DESCRIPTION_MAX}
            rows={4}
            placeholder="이 워크스페이스에서 어떤 일을 하는지 간단히 설명하세요."
            disabled={submitting}
          />
        </Field>

        {error && <p className="text-caption text-danger">{error}</p>}

        <div className="flex items-center justify-end gap-2">
          <Link href="/workspaces">
            <Button type="button" variant="ghost" disabled={submitting}>
              취소
            </Button>
          </Link>
          <Button type="submit" loading={submitting}>
            워크스페이스 만들기
          </Button>
        </div>
      </form>
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
          {required && <span className="text-danger ml-0.5">*</span>}
        </span>
        {counter && <span className="text-text-dim text-micro">{counter}</span>}
      </span>
      {children}
    </label>
  );
}
