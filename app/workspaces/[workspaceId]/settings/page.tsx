"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { use, useEffect, useState, type FormEvent, type ReactNode } from "react";
import { Clipboard, Info, Mail, RefreshCw, Trash2, UserPlus, Users } from "lucide-react";
import { Button, Input, Modal } from "@/components/ui";
import { T4Screen, T4Panel } from "@/components/arcade";
import { t4 } from "@/components/arcade/tokens";
import {
  WorkspaceErrorState,
  WorkspaceLoadingState,
} from "@/components/workspace/WorkspaceShell";
import { getStoredUser, type ApiError } from "@/lib/api-client";
import {
  createInviteLink,
  deleteInvite,
  extendInvite,
  listSentInvites,
  type InviteManagement,
  type InviteStatus,
} from "@/lib/api/invites";
import {
  changeMemberRole,
  deleteWorkspace,
  getWorkspace,
  listWorkspaceMembers,
  removeMember,
  updateWorkspace,
  type WorkspaceDetail,
  type WorkspaceMember,
  type WorkspaceRole,
} from "@/lib/api/workspaces";

type LoadState =
  | { kind: "loading" }
  | { kind: "ready"; workspace: WorkspaceDetail; members: WorkspaceMember[] }
  | { kind: "error"; message: string };

type SettingsSection = "workspace" | "members" | "invite" | "invites";
type InviteCreateMode = "email" | "link";

const INVITE_STATUS_META: Record<InviteStatus, { label: string; color: string }> = {
  PENDING: { label: "PENDING", color: t4.mp },
  ACCEPTED: { label: "ACCEPTED", color: t4.ok },
  EXPIRED: { label: "EXPIRED", color: t4.xp },
  REVOKED: { label: "REVOKED", color: t4.dim },
};

const EMAIL_STATUS_LABEL: Record<string, string> = {
  NOT_REQUESTED: "NONE",
  PENDING: "PENDING",
  SENT: "SENT",
  FAILED: "FAILED",
};

export default function WorkspaceSettingsPage({
  params,
}: {
  params: Promise<{ workspaceId: string }>;
}) {
  const { workspaceId } = use(params);
  const workspaceIdNumber = Number(workspaceId);
  const router = useRouter();
  const [state, setState] = useState<LoadState>({ kind: "loading" });
  const [activeSection, setActiveSection] = useState<SettingsSection>("workspace");

  const [nameInput, setNameInput] = useState("");
  const [descriptionInput, setDescriptionInput] = useState("");
  const [updateBusy, setUpdateBusy] = useState(false);
  const [updateError, setUpdateError] = useState("");

  const [removingMemberId, setRemovingMemberId] = useState<number | null>(null);
  const [changingRoleMemberId, setChangingRoleMemberId] = useState<number | null>(null);
  const [memberError, setMemberError] = useState("");

  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<WorkspaceRole>("MEMBER");
  const [inviteExpiresInDays, setInviteExpiresInDays] = useState(7);
  const [inviteCreateMode, setInviteCreateMode] = useState<InviteCreateMode>("email");
  const [inviteBusy, setInviteBusy] = useState(false);
  const [inviteError, setInviteError] = useState("");
  const [createdInviteUrl, setCreatedInviteUrl] = useState("");
  const [createdInviteCopied, setCreatedInviteCopied] = useState(false);

  const [inviteStatus, setInviteStatus] = useState<InviteStatus | "ALL">("PENDING");
  const [invites, setInvites] = useState<InviteManagement[]>([]);
  const [invitesLoading, setInvitesLoading] = useState(false);
  const [invitesError, setInvitesError] = useState("");
  const [inviteActionId, setInviteActionId] = useState<number | null>(null);
  const [copiedInviteId, setCopiedInviteId] = useState<number | null>(null);

  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [deleteError, setDeleteError] = useState("");

  useEffect(() => {
    let cancelled = false;
    queueMicrotask(() => {
      if (!getStoredUser() && !cancelled) {
        router.replace("/");
      }
    });

    (async () => {
      if (!getStoredUser()) return;
      try {
        const [workspace, members, inviteList] = await Promise.all([
          getWorkspace(workspaceIdNumber),
          listWorkspaceMembers(workspaceIdNumber),
          listSentInvites(workspaceIdNumber, "PENDING").catch(() => []),
        ]);
        if (cancelled) return;
        setNameInput(workspace.name);
        setDescriptionInput(workspace.description ?? "");
        setInvites(inviteList);
        setState({ kind: "ready", workspace, members });
      } catch (err) {
        const apiErr = err as ApiError;
        if (!cancelled) {
          setState({
            kind: "error",
            message: apiErr?.message ?? "워크스페이스 설정을 불러오지 못했습니다.",
          });
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [router, workspaceIdNumber]);

  if (state.kind === "loading") return <WorkspaceLoadingState />;
  if (state.kind === "error") return <WorkspaceErrorState message={state.message} />;

  const isAdmin = state.workspace.myRole === "ADMIN";
  const adminCount = state.members.filter((member) => member.role === "ADMIN").length;

  async function refreshInvites(status = inviteStatus) {
    setInvitesLoading(true);
    setInvitesError("");
    setCopiedInviteId(null);
    try {
      const nextInvites = await listSentInvites(
        workspaceIdNumber,
        status === "ALL" ? undefined : status,
      );
      setInvites(nextInvites);
    } catch (err) {
      const apiErr = err as ApiError;
      setInvitesError(apiErr?.message ?? "초대 링크 목록을 불러오지 못했습니다.");
    } finally {
      setInvitesLoading(false);
    }
  }

  async function handleUpdateWorkspace(e: FormEvent) {
    e.preventDefault();
    if (!isAdmin) return;
    const name = nameInput.trim();
    if (!name) {
      setUpdateError("워크스페이스 이름을 입력하세요.");
      return;
    }

    setUpdateBusy(true);
    setUpdateError("");
    try {
      const updated = await updateWorkspace(workspaceIdNumber, {
        name,
        description: descriptionInput.trim(),
      });
      setState((prev) => prev.kind === "ready" ? { ...prev, workspace: updated } : prev);
      setNameInput(updated.name);
      setDescriptionInput(updated.description ?? "");
    } catch (err) {
      const apiErr = err as ApiError;
      setUpdateError(apiErr?.message ?? "워크스페이스 정보 변경에 실패했습니다.");
    } finally {
      setUpdateBusy(false);
    }
  }

  async function handleChangeRole(memberId: number, nextRole: WorkspaceRole) {
    if (!isAdmin) return;
    setChangingRoleMemberId(memberId);
    setMemberError("");
    try {
      await changeMemberRole(workspaceIdNumber, memberId, nextRole);
      setState((prev) => prev.kind === "ready"
        ? {
            ...prev,
            members: prev.members.map((member) =>
              member.memberId === memberId ? { ...member, role: nextRole } : member,
            ),
          }
        : prev);
    } catch (err) {
      const apiErr = err as ApiError;
      setMemberError(apiErr?.message ?? "멤버 역할 변경에 실패했습니다.");
    } finally {
      setChangingRoleMemberId(null);
    }
  }

  async function handleRemoveMember(memberId: number) {
    if (!isAdmin) return;
    setRemovingMemberId(memberId);
    setMemberError("");
    try {
      await removeMember(workspaceIdNumber, memberId);
      setState((prev) => prev.kind === "ready"
        ? { ...prev, members: prev.members.filter((member) => member.memberId !== memberId) }
        : prev);
    } catch (err) {
      const apiErr = err as ApiError;
      setMemberError(apiErr?.message ?? "멤버 삭제에 실패했습니다.");
    } finally {
      setRemovingMemberId(null);
    }
  }

  async function handleCreateInvite(e: FormEvent) {
    e.preventDefault();
    if (!isAdmin) return;
    setInviteBusy(true);
    setInviteError("");
    setCreatedInviteUrl("");
    setCreatedInviteCopied(false);
    try {
      const targetEmail = inviteEmail.trim();
      if (inviteCreateMode === "email" && !targetEmail) {
        setInviteError("초대할 이메일을 입력하세요.");
        return;
      }
      const invite = await createInviteLink(workspaceIdNumber, {
        expiresInDays: inviteExpiresInDays,
        role: inviteRole,
        ...(inviteCreateMode === "email" ? { targetEmail } : {}),
      });
      const url = `${window.location.origin}/invites/${invite.token}`;
      setCreatedInviteUrl(url);
      setCreatedInviteCopied(await copyToClipboard(url));
      await refreshInvites();
    } catch (err) {
      const apiErr = err as ApiError;
      setInviteError(apiErr?.message ?? "초대 링크 생성에 실패했습니다.");
    } finally {
      setInviteBusy(false);
    }
  }

  async function handleExtendInvite(inviteId: number) {
    setInviteActionId(inviteId);
    setInvitesError("");
    try {
      const updated = await extendInvite(workspaceIdNumber, inviteId, 7);
      setInvites((prev) => prev.map((invite) => invite.inviteId === inviteId ? updated : invite));
    } catch (err) {
      const apiErr = err as ApiError;
      setInvitesError(apiErr?.message ?? "초대 링크 변경에 실패했습니다.");
    } finally {
      setInviteActionId(null);
    }
  }

  async function handleDeleteInvite(inviteId: number) {
    setInviteActionId(inviteId);
    setInvitesError("");
    try {
      await deleteInvite(workspaceIdNumber, inviteId);
      setInvites((prev) => prev.filter((invite) => invite.inviteId !== inviteId));
    } catch (err) {
      const apiErr = err as ApiError;
      setInvitesError(apiErr?.message ?? "초대 링크 삭제에 실패했습니다.");
    } finally {
      setInviteActionId(null);
    }
  }

  async function handleCopyInvite(invite: InviteManagement) {
    const url = invite.inviteUrl || `${window.location.origin}/invites/${invite.token}`;
    setCopiedInviteId(await copyToClipboard(url) ? invite.inviteId : null);
  }

  async function handleDeleteWorkspace() {
    if (!isAdmin) return;
    setDeleteBusy(true);
    setDeleteError("");
    try {
      await deleteWorkspace(workspaceIdNumber);
      router.replace("/workspaces");
    } catch (err) {
      const apiErr = err as ApiError;
      setDeleteError(apiErr?.message ?? "워크스페이스 삭제에 실패했습니다.");
    } finally {
      setDeleteBusy(false);
    }
  }

  return (
    <T4Screen title="WORKSPACE ADMIN · COMMAND DECK">
      <div
        style={{
          padding: "26px 28px",
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
          href={`/workspaces/${workspaceIdNumber}`}
          style={{
            fontFamily: "var(--font-pixel)",
            fontSize: 8,
            letterSpacing: 2,
            color: t4.dim,
            textDecoration: "none",
          }}
        >
          ◀ BACK TO WORKSPACE
        </Link>

        <div>
          <div
            style={{
              fontFamily: "var(--font-pixel)",
              fontSize: 8,
              color: isAdmin ? t4.pink : t4.mp,
              letterSpacing: 3,
              marginBottom: 4,
            }}
          >
            ◆ ROLE · {state.workspace.myRole}
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
            {state.workspace.name.toUpperCase()}
          </h1>
          <p
            style={{
              fontFamily: "var(--font-mono-arcade)",
              fontSize: 11,
              color: t4.dim,
              marginTop: 8,
            }}
          >
            Manage workspace info, roster, and invite codes from this deck.
          </p>
        </div>

        <div className="grid gap-5 lg:grid-cols-[280px_minmax(0,1fr)]">
          <aside className="flex flex-col gap-4">
            <T4Panel label="MENU" accent={t4.mp} style={{ position: "relative", padding: 10 }}>
              <div className="grid gap-2">
                <ArcadeNavButton
                  active={activeSection === "workspace"}
                  icon={<Info />}
                  label="WORKSPACE INFO"
                  onClick={() => setActiveSection("workspace")}
                />
                <ArcadeNavButton
                  active={activeSection === "members"}
                  icon={<Users />}
                  label="ROSTER"
                  onClick={() => setActiveSection("members")}
                />
                <ArcadeNavButton
                  active={activeSection === "invite"}
                  icon={<UserPlus />}
                  label="INVITE"
                  onClick={() => setActiveSection("invite")}
                />
                <ArcadeNavButton
                  active={activeSection === "invites"}
                  icon={<Clipboard />}
                  label="INVITE LOG"
                  onClick={() => setActiveSection("invites")}
                />
              </div>
            </T4Panel>

            <T4Panel label="STATUS" accent={t4.agent} style={{ position: "relative", padding: 14 }}>
              <p
                style={{
                  fontFamily: "var(--font-pixel)",
                  fontSize: 8,
                  color: t4.dim,
                  letterSpacing: 2,
                }}
              >
                CURRENT WORKSPACE
              </p>
              <p
                className="mt-2 truncate"
                style={{
                  fontFamily: "var(--font-pixel)",
                  fontSize: 11,
                  color: t4.ink,
                  letterSpacing: 1.5,
                }}
              >
                ♦ {state.workspace.name.toUpperCase()}
              </p>
              <p
                className="mt-3"
                style={{
                  fontFamily: "var(--font-mono-arcade)",
                  fontSize: 11,
                  color: t4.dim,
                  letterSpacing: 1,
                }}
              >
                ◇ MEMBERS {String(state.members.length).padStart(2, "0")} · ADMIN {String(adminCount).padStart(2, "0")}
              </p>
            </T4Panel>
          </aside>

          <section className="min-w-0 flex flex-col gap-5">
            {activeSection === "workspace" && (
              <div className="grid gap-4">
                <T4Panel label="WORKSPACE INFO" accent={t4.pink} style={{ position: "relative", padding: 22 }}>
                  <SectionTitle title="WORKSPACE INFO" description="Only ADMIN can edit workspace name and briefing." />
                  <form onSubmit={handleUpdateWorkspace} className="mt-5 grid gap-4">
                    <Field label="WORKSPACE NAME">
                      <Input value={nameInput} onChange={(e) => setNameInput(e.target.value)} disabled={!isAdmin || updateBusy} />
                    </Field>
                    <Field label="BRIEFING">
                      <textarea
                        value={descriptionInput}
                        onChange={(e) => setDescriptionInput(e.target.value)}
                        disabled={!isAdmin || updateBusy}
                        className="min-h-32 px-3 py-2"
                        style={{
                          background: "rgba(10,13,26,0.8)",
                          border: `1px solid ${t4.line}`,
                          color: t4.ink,
                          fontFamily: "var(--font-mono-arcade)",
                          fontSize: 12,
                          outline: "none",
                          resize: "vertical",
                        }}
                      />
                    </Field>
                    {updateError && (
                      <p style={errorStyle}>⚠ {updateError}</p>
                    )}
                    <div className="flex justify-end">
                      <Button type="submit" loading={updateBusy} disabled={!isAdmin}>SAVE</Button>
                    </div>
                  </form>
                </T4Panel>

                <T4Panel
                  label="DANGER ZONE"
                  accent={t4.hp}
                  style={{
                    position: "relative",
                    padding: 22,
                    background: "rgba(255,85,119,0.05)",
                  }}
                >
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <h2
                        style={{
                          fontFamily: "var(--font-pixel)",
                          fontSize: 12,
                          color: t4.hp,
                          letterSpacing: 2,
                          textShadow: `0 0 6px ${t4.hp}`,
                          margin: 0,
                        }}
                      >
                        ⚠ DELETE WORKSPACE
                      </h2>
                      <p
                        className="mt-2"
                        style={{
                          fontFamily: "var(--font-mono-arcade)",
                          fontSize: 11,
                          color: t4.dim,
                        }}
                      >
                        ADMIN only. After deletion you return to the workspaces list.
                      </p>
                    </div>
                    <Button type="button" variant="danger" disabled={!isAdmin} onClick={() => setDeleteOpen(true)}>DELETE</Button>
                  </div>
                </T4Panel>
              </div>
            )}

            {activeSection === "members" && (
              <T4Panel label="ROSTER" accent={t4.mp} style={{ position: "relative", padding: 22 }}>
                <SectionTitle title="ROSTER" description="Inspect every workspace member and remove with ADMIN privilege." />
                {memberError && <p className="mt-3" style={errorStyle}>⚠ {memberError}</p>}
                <div className="mt-5 grid gap-2">
                  {state.members.map((member) => (
                    <div
                      key={member.memberId}
                      className="flex flex-wrap items-center justify-between gap-3 px-3 py-2"
                      style={{
                        border: `1px solid ${t4.line}`,
                        background: "rgba(0,0,0,0.3)",
                      }}
                    >
                      <div className="min-w-0">
                        <p
                          className="truncate"
                          style={{
                            fontFamily: "var(--font-pixel)",
                            fontSize: 9,
                            letterSpacing: 1.5,
                            color: t4.ink,
                          }}
                        >
                          ● {member.name.toUpperCase()}
                        </p>
                        <p
                          className="truncate"
                          style={{
                            fontFamily: "var(--font-mono-arcade)",
                            fontSize: 10,
                            color: t4.dim,
                            marginTop: 3,
                          }}
                        >
                          {member.email}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        {isAdmin ? (
                          <RoleToggle
                            role={member.role}
                            busy={changingRoleMemberId === member.memberId}
                            disabled={changingRoleMemberId !== null || removingMemberId !== null}
                            onChange={(next) => handleChangeRole(member.memberId, next)}
                          />
                        ) : (
                          <RoleTag role={member.role} />
                        )}
                        <Button
                          type="button"
                          variant="danger"
                          size="sm"
                          icon={<Trash2 />}
                          loading={removingMemberId === member.memberId}
                          disabled={!isAdmin || removingMemberId !== null || changingRoleMemberId !== null}
                          onClick={() => handleRemoveMember(member.memberId)}
                        >
                          KICK
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </T4Panel>
            )}

            {activeSection === "invite" && (
              <T4Panel label="INVITE" accent={t4.xp} style={{ position: "relative", padding: 22 }}>
                <SectionTitle title="INVITE" description="Send by email or just generate a copy-link summon." />
                <form onSubmit={handleCreateInvite} className="mt-5 grid gap-5 xl:grid-cols-[minmax(0,420px)_minmax(280px,1fr)]">
                  <div className="grid gap-4">
                    <div>
                      <p
                        className="mb-1.5"
                        style={{
                          fontFamily: "var(--font-pixel)",
                          fontSize: 8,
                          letterSpacing: 2,
                          color: t4.dim,
                        }}
                      >
                        ◇ MODE
                      </p>
                      <div
                        className="grid grid-cols-2 p-1"
                        style={{
                          border: `1px solid ${t4.line}`,
                          background: "rgba(0,0,0,0.4)",
                        }}
                      >
                        <InviteModeButton
                          active={inviteCreateMode === "email"}
                          icon={<Mail />}
                          label="EMAIL"
                          onClick={() => {
                            setInviteCreateMode("email");
                            setInviteError("");
                            setCreatedInviteUrl("");
                            setCreatedInviteCopied(false);
                          }}
                        />
                        <InviteModeButton
                          active={inviteCreateMode === "link"}
                          icon={<Clipboard />}
                          label="LINK"
                          onClick={() => {
                            setInviteCreateMode("link");
                            setInviteError("");
                            setCreatedInviteUrl("");
                            setCreatedInviteCopied(false);
                          }}
                        />
                      </div>
                    </div>

                    <div className="min-h-[74px]">
                      {inviteCreateMode === "email" ? (
                        <Field label="TARGET EMAIL">
                          <Input
                            type="email"
                            value={inviteEmail}
                            onChange={(e) => setInviteEmail(e.target.value)}
                            placeholder="member@example.com"
                            disabled={!isAdmin || inviteBusy}
                          />
                        </Field>
                      ) : (
                        <div
                          className="px-3 py-3"
                          style={{
                            border: `1px solid ${t4.line}`,
                            background: "rgba(0,0,0,0.3)",
                          }}
                        >
                          <p
                            style={{
                              fontFamily: "var(--font-pixel)",
                              fontSize: 9,
                              letterSpacing: 1.5,
                              color: t4.ink,
                            }}
                          >
                            ◆ SHARE LINK MODE
                          </p>
                          <p
                            className="mt-2"
                            style={{
                              fontFamily: "var(--font-mono-arcade)",
                              fontSize: 11,
                              color: t4.dim,
                            }}
                          >
                            Generates a copy-and-share link without sending email.
                          </p>
                        </div>
                      )}
                    </div>

                    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
                      <SelectField label="ROLE" value={inviteRole} onChange={(value) => setInviteRole(value as WorkspaceRole)} disabled={!isAdmin || inviteBusy}>
                        <option value="MEMBER">MEMBER</option>
                        <option value="ADMIN">ADMIN</option>
                      </SelectField>
                      <SelectField label="EXPIRES" value={String(inviteExpiresInDays)} onChange={(value) => setInviteExpiresInDays(Number(value))} disabled={!isAdmin || inviteBusy}>
                        <option value={1}>1 DAY</option>
                        <option value={3}>3 DAYS</option>
                        <option value={7}>7 DAYS</option>
                        <option value={14}>14 DAYS</option>
                        <option value={30}>30 DAYS</option>
                      </SelectField>
                    </div>

                    {inviteError && <p style={errorStyle}>⚠ {inviteError}</p>}
                    <div className="flex justify-end">
                      <Button type="submit" icon={inviteCreateMode === "email" ? <UserPlus /> : <Clipboard />} loading={inviteBusy} disabled={!isAdmin}>
                        {inviteCreateMode === "email" ? "▶ SEND" : "▶ COPY LINK"}
                      </Button>
                    </div>
                  </div>

                  <div
                    className="flex min-h-[260px] flex-col p-4"
                    style={{
                      border: `1px solid ${t4.line}`,
                      background: "rgba(0,0,0,0.3)",
                    }}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <h3
                          style={{
                            fontFamily: "var(--font-pixel)",
                            fontSize: 10,
                            letterSpacing: 2,
                            color: t4.xp,
                            textShadow: `0 0 6px ${t4.xp}`,
                          }}
                        >
                          ★ SUMMON LINK
                        </h3>
                        <p
                          className="mt-2"
                          style={{
                            fontFamily: "var(--font-mono-arcade)",
                            fontSize: 11,
                            color: t4.dim,
                          }}
                        >
                          Generated invite shows up here.
                        </p>
                      </div>
                      {createdInviteUrl && (
                        <Button
                          type="button"
                          variant="secondary"
                          size="sm"
                          icon={<Clipboard />}
                          onClick={async () => setCreatedInviteCopied(await copyToClipboard(createdInviteUrl))}
                        >
                          {createdInviteCopied ? "COPIED" : "COPY"}
                        </Button>
                      )}
                    </div>

                    {createdInviteUrl ? (
                      <div
                        className="mt-4 px-3 py-3"
                        style={{
                          border: `1px solid ${t4.ok}`,
                          background: "rgba(95,227,154,0.06)",
                        }}
                      >
                        <p
                          style={{
                            fontFamily: "var(--font-pixel)",
                            fontSize: 8,
                            letterSpacing: 2,
                            color: t4.ok,
                            textShadow: `0 0 4px ${t4.ok}`,
                          }}
                        >
                          ★ {createdInviteCopied ? "LINK COPIED" : "LINK READY"}
                        </p>
                        <p
                          className="mt-2 break-all"
                          style={{
                            fontFamily: "var(--font-mono-arcade)",
                            fontSize: 11,
                            color: t4.ink,
                            lineHeight: 1.5,
                          }}
                        >
                          {createdInviteUrl}
                        </p>
                      </div>
                    ) : (
                      <div
                        className="flex flex-1 items-center justify-center px-4 py-8 text-center"
                        style={{
                          border: `1px dashed ${t4.line}`,
                          marginTop: 16,
                        }}
                      >
                        <p
                          style={{
                            fontFamily: "var(--font-mono-arcade)",
                            fontSize: 11,
                            color: t4.dim,
                          }}
                        >
                          {inviteCreateMode === "email"
                            ? "◇ create an invite to summon a teammate"
                            : "◇ generate a copy-link to share"}
                        </p>
                      </div>
                    )}
                  </div>
                </form>
              </T4Panel>
            )}

            {activeSection === "invites" && (
              <T4Panel label="INVITE LOG" accent={t4.agent} style={{ position: "relative", padding: 22 }}>
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <SectionTitle title="INVITE LOG" description="Browse, extend, or revoke previously created invites." />
                  <Button type="button" variant="secondary" icon={<RefreshCw />} loading={invitesLoading} onClick={() => refreshInvites()}>REFRESH</Button>
                </div>
                <div className="mt-5 flex flex-col gap-3">
                  <SelectField label="STATUS" value={inviteStatus} onChange={(value) => { setInviteStatus(value as InviteStatus | "ALL"); void refreshInvites(value as InviteStatus | "ALL"); }} disabled={invitesLoading}>
                    <option value="ALL">ALL</option>
                    <option value="PENDING">PENDING</option>
                    <option value="ACCEPTED">ACCEPTED</option>
                    <option value="EXPIRED">EXPIRED</option>
                    <option value="REVOKED">REVOKED</option>
                  </SelectField>
                  {invitesError && <p style={errorStyle}>⚠ {invitesError}</p>}
                  <div className="grid gap-3">
                    {invites.length > 0 ? invites.map((invite) => (
                      <InviteRow
                        key={invite.inviteId}
                        invite={invite}
                        isAdmin={isAdmin}
                        busy={inviteActionId === invite.inviteId}
                        copied={copiedInviteId === invite.inviteId}
                        onCopy={() => handleCopyInvite(invite)}
                        onExtend={() => handleExtendInvite(invite.inviteId)}
                        onDelete={() => handleDeleteInvite(invite.inviteId)}
                      />
                    )) : (
                      <p
                        className="px-3 py-6 text-center"
                        style={{
                          fontFamily: "var(--font-mono-arcade)",
                          fontSize: 11,
                          color: t4.dim,
                          border: `1px dashed ${t4.line}`,
                        }}
                      >
                        ◇ no invites match this filter.
                      </p>
                    )}
                  </div>
                </div>
              </T4Panel>
            )}
          </section>
        </div>
      </div>

      <Modal open={deleteOpen} onClose={() => setDeleteOpen(false)} title="DELETE WORKSPACE" size="sm" disableEscapeClose={deleteBusy}>
        <Modal.Body>
          <p
            style={{
              fontFamily: "var(--font-mono-arcade)",
              fontSize: 12,
              color: t4.ink,
              lineHeight: 1.5,
            }}
          >
            <span style={{ color: t4.hp, fontWeight: 700 }}>{state.workspace.name}</span> 워크스페이스를 영구 삭제합니다.
          </p>
          {deleteError && <p className="mt-3" style={errorStyle}>⚠ {deleteError}</p>}
        </Modal.Body>
        <Modal.Footer>
          <Button type="button" variant="ghost" disabled={deleteBusy} onClick={() => setDeleteOpen(false)}>CANCEL</Button>
          <Button type="button" variant="danger" loading={deleteBusy} onClick={handleDeleteWorkspace}>DELETE</Button>
        </Modal.Footer>
      </Modal>
    </T4Screen>
  );
}

const errorStyle = {
  fontFamily: "var(--font-mono-arcade)",
  fontSize: 11,
  color: t4.hp,
} as const;

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="flex flex-col gap-2">
      <span
        style={{
          fontFamily: "var(--font-pixel)",
          fontSize: 8,
          letterSpacing: 2,
          color: t4.dim,
        }}
      >
        ◇ {label}
      </span>
      {children}
    </label>
  );
}

function SelectField({
  label,
  value,
  onChange,
  disabled,
  children,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  children: ReactNode;
}) {
  return (
    <label className="flex flex-col gap-2">
      <span
        style={{
          fontFamily: "var(--font-pixel)",
          fontSize: 8,
          letterSpacing: 2,
          color: t4.dim,
        }}
      >
        ◇ {label}
      </span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        className="h-9 px-3"
        style={{
          background: "rgba(10,13,26,0.8)",
          border: `1px solid ${t4.line}`,
          color: t4.ink,
          fontFamily: "var(--font-mono-arcade)",
          fontSize: 12,
          letterSpacing: 1,
          outline: "none",
        }}
      >
        {children}
      </select>
    </label>
  );
}

function ArcadeNavButton({
  active,
  icon,
  label,
  onClick,
}: {
  active: boolean;
  icon: ReactNode;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-center gap-3 px-3 py-3 text-left"
      style={{
        background: active ? "rgba(255,122,220,0.1)" : "rgba(0,0,0,0.3)",
        border: `1px solid ${active ? t4.pink : t4.line}`,
        boxShadow: active ? `0 0 10px ${t4.pink}40` : "none",
        cursor: "pointer",
        fontFamily: "var(--font-pixel)",
        fontSize: 9,
        letterSpacing: 1.5,
        color: active ? t4.pink : t4.dim,
        textTransform: "uppercase",
      }}
    >
      <span className="flex h-4 w-4 shrink-0 items-center justify-center [&>svg]:h-4 [&>svg]:w-4">
        {icon}
      </span>
      <span className="min-w-0 truncate">{active ? "▶ " : "  "}{label}</span>
    </button>
  );
}

function InviteModeButton({
  active,
  icon,
  label,
  onClick,
}: {
  active: boolean;
  icon: ReactNode;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex items-center justify-center gap-2 px-3 py-2"
      style={{
        background: active ? "rgba(255,216,74,0.1)" : "transparent",
        border: `1px solid ${active ? t4.xp : "transparent"}`,
        cursor: "pointer",
        fontFamily: "var(--font-pixel)",
        fontSize: 9,
        letterSpacing: 1.5,
        color: active ? t4.xp : t4.dim,
      }}
    >
      <span className="flex h-3.5 w-3.5 shrink-0 items-center justify-center [&>svg]:h-3.5 [&>svg]:w-3.5">
        {icon}
      </span>
      {label}
    </button>
  );
}

function SectionTitle({ title, description }: { title: string; description: string }) {
  return (
    <div>
      <h2
        style={{
          fontFamily: "var(--font-pixel)",
          fontSize: 12,
          letterSpacing: 2,
          color: t4.ink,
          margin: 0,
        }}
      >
        ◆ {title}
      </h2>
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
    </div>
  );
}

function RoleTag({ role }: { role: WorkspaceRole }) {
  const color = role === "ADMIN" ? t4.pink : t4.mp;
  return (
    <span
      style={{
        fontFamily: "var(--font-pixel)",
        fontSize: 7,
        letterSpacing: 1,
        color,
        padding: "3px 6px",
        border: `1px solid ${color}`,
      }}
    >
      {role}
    </span>
  );
}

function RoleToggle({
  role,
  busy,
  disabled,
  onChange,
}: {
  role: WorkspaceRole;
  busy: boolean;
  disabled: boolean;
  onChange: (next: WorkspaceRole) => void;
}) {
  const ROLES: WorkspaceRole[] = ["ADMIN", "MEMBER"];
  return (
    <div
      role="group"
      aria-label="역할 변경"
      style={{
        display: "inline-flex",
        border: `1px solid ${t4.line}`,
        background: "rgba(0,0,0,0.3)",
      }}
    >
      {ROLES.map((r) => {
        const active = r === role;
        const color = r === "ADMIN" ? t4.pink : t4.mp;
        return (
          <button
            key={r}
            type="button"
            onClick={() => {
              if (active || disabled) return;
              onChange(r);
            }}
            disabled={disabled || active}
            aria-pressed={active}
            style={{
              fontFamily: "var(--font-pixel)",
              fontSize: 7,
              letterSpacing: 1,
              padding: "4px 8px",
              color: active ? "#000" : color,
              background: active ? color : "transparent",
              border: "none",
              cursor: active || disabled ? "default" : "pointer",
              opacity: disabled && !active ? 0.5 : 1,
            }}
          >
            {busy && active ? "..." : r}
          </button>
        );
      })}
    </div>
  );
}

function InviteRow({
  invite,
  isAdmin,
  busy,
  copied,
  onCopy,
  onExtend,
  onDelete,
}: {
  invite: InviteManagement;
  isAdmin: boolean;
  busy: boolean;
  copied: boolean;
  onCopy: () => void;
  onExtend: () => void;
  onDelete: () => void;
}) {
  const meta = INVITE_STATUS_META[invite.status];
  const inviteUrl = invite.inviteUrl || `/invites/${invite.token}`;
  return (
    <article
      className="p-3"
      style={{
        border: `1px solid ${t4.line}`,
        background: "rgba(0,0,0,0.3)",
      }}
    >
      <div className="flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span
              style={{
                fontFamily: "var(--font-pixel)",
                fontSize: 7,
                letterSpacing: 1,
                color: meta.color,
                padding: "3px 6px",
                border: `1px solid ${meta.color}`,
              }}
            >
              {meta.label}
            </span>
            <RoleTag role={invite.role} />
            <span
              style={{
                fontFamily: "var(--font-mono-arcade)",
                fontSize: 10,
                color: t4.dim,
                letterSpacing: 1,
              }}
            >
              ✉ {EMAIL_STATUS_LABEL[invite.emailStatus] ?? invite.emailStatus}
            </span>
          </div>
          <p
            className="mt-2 break-all"
            style={{
              fontFamily: "var(--font-mono-arcade)",
              fontSize: 11,
              color: t4.ink,
              lineHeight: 1.4,
            }}
          >
            {inviteUrl}
          </p>
          <p
            className="mt-1"
            style={{
              fontFamily: "var(--font-mono-arcade)",
              fontSize: 10,
              color: t4.dim,
            }}
          >
            ◆ {invite.targetEmail ?? "SHARE LINK"} · expires {formatDate(invite.expiresAt)}
          </p>
        </div>
        <div className="flex shrink-0 flex-wrap gap-2">
          <Button type="button" variant="ghost" size="sm" icon={<Clipboard />} onClick={onCopy}>{copied ? "COPIED" : "COPY"}</Button>
          <Button type="button" variant="secondary" size="sm" loading={busy} disabled={!isAdmin || invite.status !== "PENDING"} onClick={onExtend}>+7D</Button>
          <Button type="button" variant="danger" size="sm" icon={<Trash2 />} loading={busy} disabled={!isAdmin || invite.status === "ACCEPTED"} onClick={onDelete}>DEL</Button>
        </div>
      </div>
    </article>
  );
}

function formatDate(iso: string) {
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

async function copyToClipboard(text: string) {
  try {
    await window.navigator.clipboard?.writeText(text);
    return true;
  } catch {
    return false;
  }
}
