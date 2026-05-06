"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { use, useCallback, useEffect, useMemo, useState, type FormEvent, type ReactNode } from "react";
import {
  ArrowLeft,
  Bell,
  Bot,
  CheckCircle2,
  Clipboard,
  GitBranch,
  KeyRound,
  ListChecks,
  MessageCircle,
  Plus,
  Send,
  Settings,
  ShieldAlert,
  UserPlus,
  Users,
} from "lucide-react";
import { Badge, Button, Input, Modal } from "@/components/ui";
import OfficePhaserGame from "@/components/workspace/OfficePhaserGame";
import {
  WorkspaceErrorState,
  WorkspaceLoadingState,
} from "@/components/workspace/WorkspaceShell";
import type { OfficeAgentState } from "@/game/office/EventBus";
import { getStoredUser, type ApiError } from "@/lib/api-client";
import { createInviteLink } from "@/lib/api/invites";
import {
  createSlackIntegration,
  type SlackIntegration,
} from "@/lib/api/integrations";
import {
  createWorkspaceTask,
  listWorkspaceTasks,
  type TaskStatus,
  type WorkspaceTask,
} from "@/lib/api/tasks";
import {
  deleteWorkspace,
  getWorkspace,
  listWorkspaceMembers,
  type WorkspaceDetail,
  type WorkspaceMember,
  type WorkspaceRole,
} from "@/lib/api/workspaces";

type LoadState =
  | { kind: "loading" }
  | { kind: "ready"; workspace: WorkspaceDetail; members: WorkspaceMember[] }
  | { kind: "error"; message: string };

type OfficeActor = OfficeAgentState;

type AgentRole = "BACKEND" | "FRONTEND" | "QA" | "DOCS" | "PM" | "ORCHESTRATOR";

interface HiredAgent {
  id: string;
  name: string;
  role: AgentRole;
  openClawAgentId: string;
  skillProfile: string;
  status: OfficeActor["status"];
  hiredAt: string;
}

interface ChatMessage {
  id: string;
  from: "me" | "target" | "system";
  text: string;
  createdAt: string;
}

interface ActorContextMenu {
  actor: OfficeActor;
  x: number;
  y: number;
}

const STATUS_META: Record<
  OfficeActor["status"],
  { label: string; className: string; dotClassName: string }
> = {
  working: {
    label: "작업 중",
    className: "bg-working/15 text-working",
    dotClassName: "bg-working",
  },
  idle: {
    label: "대기",
    className: "bg-surface-raised text-text-muted",
    dotClassName: "bg-text-dim",
  },
  review: {
    label: "리뷰",
    className: "bg-info/15 text-info",
    dotClassName: "bg-info",
  },
  blocked: {
    label: "확인 필요",
    className: "bg-warning/15 text-warning",
    dotClassName: "bg-warning",
  },
};

const TASK_STATUS_META: Record<TaskStatus, { label: string; className: string }> = {
  PENDING: { label: "대기", className: "bg-surface-raised text-text-muted" },
  ASSIGNED: { label: "배정됨", className: "bg-info/15 text-info" },
  IN_PROGRESS: { label: "진행 중", className: "bg-working/15 text-working" },
  COMPLETED: { label: "완료", className: "bg-success/15 text-success" },
  FAILED: { label: "실패", className: "bg-danger/15 text-danger" },
  ON_HOLD: { label: "보류", className: "bg-warning/15 text-warning" },
  CANCELED: { label: "취소", className: "bg-surface-raised text-text-dim" },
};

const TASK_BOARD_GROUPS: Array<{
  key: string;
  label: string;
  statuses: TaskStatus[];
  className: string;
}> = [
  {
    key: "requested",
    label: "요청",
    statuses: ["PENDING", "ON_HOLD"],
    className: "bg-surface-raised text-text-muted",
  },
  {
    key: "assigned",
    label: "배정",
    statuses: ["ASSIGNED"],
    className: "bg-info/15 text-info",
  },
  {
    key: "progress",
    label: "진행",
    statuses: ["IN_PROGRESS"],
    className: "bg-working/15 text-working",
  },
  {
    key: "closed",
    label: "종료",
    statuses: ["COMPLETED", "FAILED", "CANCELED"],
    className: "bg-success/15 text-success",
  },
];

const AGENT_ROLE_OPTIONS: Array<{ value: AgentRole; label: string; description: string }> = [
  { value: "BACKEND", label: "Backend", description: "API, DB, server workdir 작업" },
  { value: "FRONTEND", label: "Frontend", description: "UI, 상태, 클라이언트 코드 작업" },
  { value: "QA", label: "QA", description: "테스트, 재현, 회귀 확인" },
  { value: "DOCS", label: "Docs", description: "문서, 릴리즈 노트, 정리" },
  { value: "PM", label: "PM", description: "요구사항 분해, 우선순위 관리" },
  { value: "ORCHESTRATOR", label: "Orchestrator", description: "태스크 분해와 Agent 배정" },
];

export default function WorkspaceOfficePage({
  params,
}: {
  params: Promise<{ workspaceId: string }>;
}) {
  const { workspaceId } = use(params);
  const router = useRouter();
  const id = Number(workspaceId);
  const [state, setState] = useState<LoadState>({ kind: "loading" });
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [tasksOpen, setTasksOpen] = useState(false);
  const [agentHireOpen, setAgentHireOpen] = useState(false);
  const [workspaceOpen, setWorkspaceOpen] = useState(false);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [discordOpen, setDiscordOpen] = useState(false);
  const [githubOpen, setGithubOpen] = useState(false);
  const [slackOpen, setSlackOpen] = useState(false);
  const [openClawOpen, setOpenClawOpen] = useState(false);

  const [emailInviteUrl, setEmailInviteUrl] = useState("");
  const [linkInviteUrl, setLinkInviteUrl] = useState("");
  const [inviteError, setInviteError] = useState("");
  const [inviteBusy, setInviteBusy] = useState(false);
  const [copiedInviteKind, setCopiedInviteKind] = useState<"email" | "link" | null>(null);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<WorkspaceRole>("MEMBER");
  const [inviteExpiresInDays, setInviteExpiresInDays] = useState(7);

  const [slackTeamId, setSlackTeamId] = useState("");
  const [slackChannelId, setSlackChannelId] = useState("");
  const [botToken, setBotToken] = useState("");
  const [signingSecret, setSigningSecret] = useState("");
  const [slackBusy, setSlackBusy] = useState(false);
  const [slackError, setSlackError] = useState("");
  const [savedSlack, setSavedSlack] = useState<SlackIntegration | null>(null);
  const [hiredAgents, setHiredAgents] = useState<HiredAgent[]>([]);
  const [agentName, setAgentName] = useState("");
  const [agentRole, setAgentRole] = useState<AgentRole>("BACKEND");
  const [openClawAgentId, setOpenClawAgentId] = useState("");
  const [skillProfile, setSkillProfile] = useState("default");
  const [agentHireError, setAgentHireError] = useState("");
  const [actorMenu, setActorMenu] = useState<ActorContextMenu | null>(null);
  const [chatTarget, setChatTarget] = useState<OfficeActor | null>(null);
  const [chatInput, setChatInput] = useState("");
  const [chatMessages, setChatMessages] = useState<Record<string, ChatMessage[]>>({});
  const [tasks, setTasks] = useState<WorkspaceTask[]>([]);
  const [tasksBusy, setTasksBusy] = useState(false);
  const [tasksError, setTasksError] = useState("");
  const [taskTitle, setTaskTitle] = useState("");
  const [taskDescription, setTaskDescription] = useState("");
  const [taskSubmitting, setTaskSubmitting] = useState(false);
  const [taskCreateError, setTaskCreateError] = useState("");
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [deleteWorkspaceBusy, setDeleteWorkspaceBusy] = useState(false);
  const [deleteWorkspaceError, setDeleteWorkspaceError] = useState("");

  const refreshTasks = useCallback(async () => {
    setTasksBusy(true);
    setTasksError("");
    try {
      const nextTasks = await listWorkspaceTasks(id);
      setTasks(nextTasks);
    } catch (err) {
      const apiErr = err as ApiError;
      setTasksError(apiErr?.message ?? "태스크 목록을 불러오지 못했습니다.");
    } finally {
      setTasksBusy(false);
    }
  }, [id]);

  useEffect(() => {
    let cancelled = false;
    queueMicrotask(() => {
      if (!getStoredUser()) {
        setState({ kind: "error", message: "로그인이 필요합니다." });
      }
    });

    (async () => {
      try {
        const [workspace, members, initialTasks] = await Promise.all([
          getWorkspace(id),
          listWorkspaceMembers(id),
          listWorkspaceTasks(id).catch(() => []),
        ]);
        if (!cancelled) {
          setHiredAgents(readHiredAgents(id));
          setTasks(initialTasks);
          setState({ kind: "ready", workspace, members });
        }
      } catch (err) {
        const apiErr = err as ApiError;
        if (!cancelled) {
          setState({
            kind: "error",
            message: apiErr?.message ?? "워크스페이스를 불러오지 못했습니다.",
          });
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [id]);

  useEffect(() => {
    if (!actorMenu) return;
    const close = () => setActorMenu(null);
    window.addEventListener("click", close);
    window.addEventListener("resize", close);
    return () => {
      window.removeEventListener("click", close);
      window.removeEventListener("resize", close);
    };
  }, [actorMenu]);

  const actors = useMemo(() => {
    if (state.kind !== "ready") return [];
    const agentActors = hiredAgents.map<OfficeActor>((agent, index) => ({
      id: agent.id,
      name: agent.name,
      role: agent.role,
      status: agent.status,
      desk: index,
      kind: "agent",
    }));
    const memberActors = state.members.map<OfficeActor>((member, index) => ({
      id: member.memberId,
      name: member.name,
      role: member.role,
      status: pickStatus(index, member.role),
      desk: agentActors.length + index,
      kind: "member",
    }));
    return [...agentActors, ...memberActors].slice(0, OFFICE_DESK_CAPACITY);
  }, [hiredAgents, state]);

  if (state.kind === "loading") return <WorkspaceLoadingState />;
  if (state.kind === "error") return <WorkspaceErrorState message={state.message} />;

  const workingCount = actors.filter((actor) => actor.status === "working").length;
  const adminCount = state.members.filter((member) => member.role === "ADMIN").length;
  const isAdmin = state.workspace.myRole === "ADMIN";

  async function handleCreateInvite(e: FormEvent) {
    e.preventDefault();
    const targetEmail = inviteEmail.trim();
    if (!targetEmail) {
      setInviteError("초대할 이메일을 입력하세요.");
      return;
    }
    await createInvite({ targetEmail, kind: "email" });
  }

  async function handleCreateInviteLinkOnly() {
    await createInvite({ kind: "link" });
  }

  async function createInvite({
    targetEmail,
    kind,
  }: {
    targetEmail?: string;
    kind: "email" | "link";
  }) {
    setInviteError("");
    setCopiedInviteKind(null);
    setInviteBusy(true);
    try {
      const invite = await createInviteLink(id, {
        expiresInDays: inviteExpiresInDays,
        role: inviteRole,
        ...(targetEmail ? { targetEmail } : {}),
      });
      const frontendUrl = `${window.location.origin}/invites/${invite.token}`;
      if (kind === "email") setEmailInviteUrl(frontendUrl);
      else setLinkInviteUrl(frontendUrl);
      try {
        await window.navigator.clipboard?.writeText(frontendUrl);
        setCopiedInviteKind(kind);
      } catch {
        setCopiedInviteKind(null);
      }
    } catch (err) {
      const apiErr = err as ApiError;
      setInviteError(apiErr?.message ?? "초대 링크 생성에 실패했습니다.");
    } finally {
      setInviteBusy(false);
    }
  }

  async function handleSlackSubmit(e: FormEvent) {
    e.preventDefault();
    if (!slackTeamId.trim() || !slackChannelId.trim() || !botToken.trim() || !signingSecret.trim()) {
      setSlackError("Slack Team ID, Channel ID, Bot Token, Signing Secret은 필수입니다.");
      return;
    }

    setSlackBusy(true);
    setSlackError("");
    try {
      const res = await createSlackIntegration(id, {
        slackTeamId: slackTeamId.trim(),
        slackChannelId: slackChannelId.trim(),
        botToken: botToken.trim(),
        signingSecret: signingSecret.trim(),
      });
      setSavedSlack(res);
      setBotToken("");
      setSigningSecret("");
    } catch (err) {
      const apiErr = err as ApiError;
      setSlackError(apiErr?.message ?? "Slack 연동 저장에 실패했습니다.");
    } finally {
      setSlackBusy(false);
    }
  }

  function handleHireAgent(e: FormEvent) {
    e.preventDefault();
    const trimmedName = agentName.trim();
    const trimmedOpenClawId = openClawAgentId.trim();
    if (!trimmedName) {
      setAgentHireError("Agent 이름을 입력하세요.");
      return;
    }
    if (!trimmedOpenClawId) {
      setAgentHireError("OpenClaw Agent ID를 입력하세요.");
      return;
    }
    if (!/^[a-zA-Z0-9-_]+$/.test(trimmedOpenClawId)) {
      setAgentHireError("OpenClaw Agent ID는 영문, 숫자, -, _만 사용할 수 있습니다.");
      return;
    }

    const nextAgent: HiredAgent = {
      id: createLocalId(),
      name: trimmedName,
      role: agentRole,
      openClawAgentId: trimmedOpenClawId,
      skillProfile,
      status: "working",
      hiredAt: new Date().toISOString(),
    };
    const nextAgents = [nextAgent, ...hiredAgents].slice(0, 10);
    setHiredAgents(nextAgents);
    writeHiredAgents(id, nextAgents);
    setAgentName("");
    setOpenClawAgentId("");
    setSkillProfile("default");
    setAgentRole("BACKEND");
    setAgentHireError("");
    setAgentHireOpen(false);
  }

  function openActorChat(actor: OfficeActor) {
    setActorMenu(null);
    setChatTarget(actor);
    setChatMessages((prev) => {
      const key = chatKey(actor);
      if (prev[key]) return prev;
      return {
        ...prev,
        [key]: [
          {
            id: createLocalId(),
            from: "system",
            text:
              actor.kind === "agent"
                ? `${actor.name} Agent를 호출했습니다. "태스크 등록해줘"라고 입력하면 태스크 등록 API로 연결합니다.`
                : `${actor.name}님과의 채팅을 시작했습니다.`,
            createdAt: new Date().toISOString(),
          },
        ],
      };
    });
  }

  async function handleSendChatMessage(e: FormEvent) {
    e.preventDefault();
    if (!chatTarget) return;
    const message = chatInput.trim();
    if (!message) return;

    appendChat(chatTarget, {
      id: createLocalId(),
      from: "me",
      text: message,
      createdAt: new Date().toISOString(),
    });
    setChatInput("");

    if (chatTarget.kind === "agent" && isTaskCreateCommand(message)) {
      const title = extractTaskTitle(message);
      const created = await submitTask({
        title,
        description: `${chatTarget.name} Agent 채팅에서 등록됨\n\n원문: ${message}`,
        assignedAgentId: chatTarget.id,
      });
      appendChat(chatTarget, {
        id: createLocalId(),
        from: "target",
        text: created
          ? `태스크 "${created.title}" 등록이 완료되었습니다. 상태는 ${TASK_STATUS_META[created.status]?.label ?? created.status}입니다.`
          : "태스크 등록에 실패했습니다. 태스크 모달에서 다시 확인하세요.",
        createdAt: new Date().toISOString(),
      });
      return;
    }

    appendChat(chatTarget, {
      id: createLocalId(),
      from: chatTarget.kind === "agent" ? "target" : "system",
      text:
        chatTarget.kind === "agent"
          ? "Agent 응답 API 연결 전입니다. 태스크 등록 요청은 처리할 수 있습니다."
          : "현재 유저 채팅은 화면 내 대화로 표시됩니다.",
      createdAt: new Date().toISOString(),
    });
  }

  async function handleCreateTaskFromForm(e: FormEvent) {
    e.preventDefault();
    const title = taskTitle.trim();
    if (!title) {
      setTaskCreateError("태스크 제목을 입력하세요.");
      return;
    }
    const created = await submitTask({
      title,
      description: taskDescription.trim() || undefined,
      assignedAgentId: chatTarget?.kind === "agent" ? chatTarget.id : undefined,
    });
    if (created) {
      setTaskTitle("");
      setTaskDescription("");
    }
  }

  async function handleDeleteWorkspace() {
    if (!isAdmin) return;
    setDeleteWorkspaceBusy(true);
    setDeleteWorkspaceError("");
    try {
      await deleteWorkspace(id);
      router.replace("/workspaces");
    } catch (err) {
      const apiErr = err as ApiError;
      setDeleteWorkspaceError(apiErr?.message ?? "워크스페이스 삭제에 실패했습니다.");
    } finally {
      setDeleteWorkspaceBusy(false);
    }
  }

  async function submitTask(body: {
    title: string;
    description?: string;
    assignedAgentId?: string | number;
  }) {
    setTaskSubmitting(true);
    setTaskCreateError("");
    try {
      const created = await createWorkspaceTask(id, body);
      setTasks((prev) => [created, ...prev]);
      return created;
    } catch (err) {
      const apiErr = err as ApiError;
      setTaskCreateError(apiErr?.message ?? "태스크 등록에 실패했습니다.");
      return null;
    } finally {
      setTaskSubmitting(false);
    }
  }

  function appendChat(actor: OfficeActor, message: ChatMessage) {
    const key = chatKey(actor);
    setChatMessages((prev) => ({
      ...prev,
      [key]: [...(prev[key] ?? []), message],
    }));
  }

  return (
    <main className="theme-web flex h-screen min-h-[620px] flex-col overflow-hidden bg-[#dff1f6] text-text">
      <GameTopNav
        workspace={state.workspace}
        onSettings={() => setSettingsOpen(true)}
        onTasks={() => setTasksOpen(true)}
        onHireAgent={() => setAgentHireOpen(true)}
      />

      <section className="relative flex-1 overflow-hidden bg-[#dff1f6]">
        <Skyline />
        <div className="absolute right-4 top-4 z-30 grid w-[180px] gap-2 sm:w-[210px]">
          <HudMetric label="Members" value={state.members.length} detail={`ADMIN ${adminCount}`} />
          <HudMetric label="Working" value={workingCount} detail={`${actors.length} seats`} />
        </div>

        <div className="absolute inset-x-4 bottom-16 top-8 z-10 overflow-hidden rounded-lg border-4 border-[#9fc3bd] bg-[#f7e8c7] shadow-[0_22px_50px_rgba(73,102,108,0.22)] sm:inset-x-8 sm:bottom-20 lg:inset-x-16 xl:inset-x-24">
          <OfficePhaserGame
            agents={actors}
            onAgentContextMenu={({ agent, x, y }) => setActorMenu({ actor: agent, x, y })}
          />
        </div>

        <ActorContextMenu
          menu={actorMenu}
          onChat={openActorChat}
        />
        <ActorChatSidePanel
          open={Boolean(chatTarget)}
          target={chatTarget}
          messages={chatTarget ? chatMessages[chatKey(chatTarget)] ?? [] : []}
          input={chatInput}
          onInputChange={setChatInput}
          taskTitle={taskTitle}
          onTaskTitleChange={setTaskTitle}
          taskDescription={taskDescription}
          onTaskDescriptionChange={setTaskDescription}
          taskSubmitting={taskSubmitting}
          taskError={taskCreateError}
          onSubmitMessage={handleSendChatMessage}
          onSubmitTask={handleCreateTaskFromForm}
          onClose={() => {
            setChatTarget(null);
            setChatInput("");
            setTaskCreateError("");
          }}
        />

        <div className="absolute inset-x-0 bottom-0 z-20 flex items-center justify-center bg-gradient-to-t from-[#8cb7b5]/45 to-transparent px-4 pb-4 pt-14">
          <div className="flex max-w-full items-center gap-2 overflow-x-auto rounded-lg border border-[var(--neon-border-muted)] bg-surface/90 px-3 py-2 scrollbar-hide">
            {actors.map((actor) => {
              const meta = STATUS_META[actor.status];
              return (
                <span
                  key={actor.id}
                  className="inline-flex shrink-0 items-center gap-2 rounded-md bg-surface-raised px-3 py-1.5"
                >
                  <span className={`h-2 w-2 rounded-full ${meta.dotClassName}`} />
                  <span className="text-caption font-semibold text-text">{actor.name}</span>
                  <span className={`rounded-full px-2 py-0.5 text-micro font-semibold ${meta.className}`}>
                    {meta.label}
                  </span>
                </span>
              );
            })}
            {actors.length === 0 && (
              <span className="text-caption text-text-muted">채널 설정에서 회원을 초대하세요.</span>
            )}
          </div>
        </div>
      </section>

      <SettingsSelectModal
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        onSlack={() => {
          setSettingsOpen(false);
          setSlackOpen(true);
        }}
        onDiscord={() => {
          setSettingsOpen(false);
          setDiscordOpen(true);
        }}
        onGithub={() => {
          setSettingsOpen(false);
          setGithubOpen(true);
        }}
        onOpenClaw={() => {
          setSettingsOpen(false);
          setOpenClawOpen(true);
        }}
        onChannelSettings={() => {
          setSettingsOpen(false);
          setWorkspaceOpen(true);
        }}
      />
      <TaskDashboardModal
        open={tasksOpen}
        onClose={() => setTasksOpen(false)}
        actors={actors}
        tasks={tasks}
        loading={tasksBusy}
        error={tasksError}
        onRefresh={refreshTasks}
      />
      <AgentHireModal
        open={agentHireOpen}
        onClose={() => setAgentHireOpen(false)}
        name={agentName}
        onNameChange={setAgentName}
        role={agentRole}
        onRoleChange={setAgentRole}
        openClawAgentId={openClawAgentId}
        onOpenClawAgentIdChange={setOpenClawAgentId}
        skillProfile={skillProfile}
        onSkillProfileChange={setSkillProfile}
        error={agentHireError}
        onSubmit={handleHireAgent}
      />
      <WorkspaceInfoModal
        open={workspaceOpen}
        onClose={() => setWorkspaceOpen(false)}
        workspace={state.workspace}
        members={state.members}
        actors={actors}
        adminCount={adminCount}
        workingCount={workingCount}
        isAdmin={isAdmin}
        deleteBusy={deleteWorkspaceBusy}
        onDelete={() => {
          setDeleteWorkspaceError("");
          setDeleteConfirmOpen(true);
        }}
        onInvite={() => {
          setWorkspaceOpen(false);
          setInviteOpen(true);
        }}
      />
      <DeleteWorkspaceConfirmModal
        open={deleteConfirmOpen}
        workspaceName={state.workspace.name}
        error={deleteWorkspaceError}
        deleting={deleteWorkspaceBusy}
        onClose={() => {
          if (deleteWorkspaceBusy) return;
          setDeleteConfirmOpen(false);
          setDeleteWorkspaceError("");
        }}
        onConfirm={handleDeleteWorkspace}
      />
      <InviteMemberModal
        open={inviteOpen}
        onClose={() => setInviteOpen(false)}
        email={inviteEmail}
        onEmailChange={setInviteEmail}
        role={inviteRole}
        onRoleChange={setInviteRole}
        expiresInDays={inviteExpiresInDays}
        onExpiresInDaysChange={setInviteExpiresInDays}
        emailInviteUrl={emailInviteUrl}
        linkInviteUrl={linkInviteUrl}
        error={inviteError}
        copiedInviteKind={copiedInviteKind}
        submitting={inviteBusy}
        isAdmin={isAdmin}
        onSubmit={handleCreateInvite}
        onCreateLinkOnly={handleCreateInviteLinkOnly}
        onCopy={(inviteUrl, kind) => copyInviteUrl(inviteUrl, kind, setCopiedInviteKind)}
      />
      <SlackIntegrationModal
        open={slackOpen}
        onClose={() => setSlackOpen(false)}
        onBack={() => {
          setSlackOpen(false);
          setSettingsOpen(true);
        }}
        isAdmin={isAdmin}
        slackTeamId={slackTeamId}
        onSlackTeamIdChange={setSlackTeamId}
        slackChannelId={slackChannelId}
        onSlackChannelIdChange={setSlackChannelId}
        botToken={botToken}
        onBotTokenChange={setBotToken}
        signingSecret={signingSecret}
        onSigningSecretChange={setSigningSecret}
        saved={savedSlack}
        error={slackError}
        submitting={slackBusy}
        onSubmit={handleSlackSubmit}
      />
      <DiscordIntegrationModal
        open={discordOpen}
        onClose={() => setDiscordOpen(false)}
        onBack={() => {
          setDiscordOpen(false);
          setSettingsOpen(true);
        }}
      />
      <GithubIntegrationModal
        open={githubOpen}
        onClose={() => setGithubOpen(false)}
        onBack={() => {
          setGithubOpen(false);
          setSettingsOpen(true);
        }}
      />
      <OpenClawIntegrationModal
        open={openClawOpen}
        onClose={() => setOpenClawOpen(false)}
        onBack={() => {
          setOpenClawOpen(false);
          setSettingsOpen(true);
        }}
      />
    </main>
  );
}

function GameTopNav({
  workspace,
  onSettings,
  onTasks,
  onHireAgent,
}: {
  workspace: WorkspaceDetail;
  onSettings: () => void;
  onTasks: () => void;
  onHireAgent: () => void;
}) {
  return (
    <header className="z-40 flex h-14 shrink-0 items-center justify-between gap-3 border-b border-[var(--neon-border-muted)] bg-surface/95 px-4">
      <div className="flex min-w-0 items-center gap-3">
        <Link
          href="/workspaces"
          className="hidden text-caption font-semibold text-text-muted hover:text-text sm:inline"
        >
          Workspaces
        </Link>
        <span className="hidden h-4 w-px bg-border sm:block" />
        <div className="min-w-0">
          <p className="truncate text-title text-text">{workspace.name}</p>
          <p className="truncate text-micro text-text-dim">2D Workspace</p>
        </div>
      </div>

      <nav className="flex shrink-0 items-center gap-1 overflow-x-auto scrollbar-hide sm:gap-2">
        <Button size="sm" variant="primary" icon={<Bot />} onClick={onHireAgent}>
          Agent 출근
        </Button>
        <Button size="sm" variant="secondary" icon={<Settings />} onClick={onSettings}>
          채널 설정
        </Button>
        <Button size="sm" variant="ghost" icon={<ListChecks />} onClick={onTasks}>
          태스크
        </Button>
      </nav>
    </header>
  );
}

function ActorContextMenu({
  menu,
  onChat,
}: {
  menu: ActorContextMenu | null;
  onChat: (actor: OfficeActor) => void;
}) {
  if (!menu) return null;
  const left = Math.min(menu.x, window.innerWidth - 190);
  const top = Math.min(menu.y, window.innerHeight - 88);

  return (
    <div
      className="fixed z-40 w-44 rounded-lg border border-[var(--neon-border)] bg-surface p-1"
      style={{ left, top }}
      onClick={(e) => e.stopPropagation()}
    >
      <button
        type="button"
        onClick={() => onChat(menu.actor)}
        className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-caption font-semibold text-text hover:bg-primary-muted"
      >
        <MessageCircle className="h-3.5 w-3.5 text-primary" />
        {menu.actor.kind === "agent" ? "Agent 채팅" : "채팅하기"}
      </button>
    </div>
  );
}

function ActorChatSidePanel({
  open,
  target,
  messages,
  input,
  onInputChange,
  taskTitle,
  onTaskTitleChange,
  taskDescription,
  onTaskDescriptionChange,
  taskSubmitting,
  taskError,
  onSubmitMessage,
  onSubmitTask,
  onClose,
}: {
  open: boolean;
  target: OfficeActor | null;
  messages: ChatMessage[];
  input: string;
  onInputChange: (value: string) => void;
  taskTitle: string;
  onTaskTitleChange: (value: string) => void;
  taskDescription: string;
  onTaskDescriptionChange: (value: string) => void;
  taskSubmitting: boolean;
  taskError: string;
  onSubmitMessage: (e: FormEvent) => void;
  onSubmitTask: (e: FormEvent) => void;
  onClose: () => void;
}) {
  if (!open || !target) return null;
  const isAgent = target?.kind === "agent";

  return (
    <aside
      className="absolute bottom-20 left-3 top-3 z-30 flex w-[calc(100%-1.5rem)] flex-col overflow-hidden rounded-lg border border-[var(--neon-border)] bg-bg/96 sm:left-4 sm:top-4 sm:w-[380px]"
    >
      <header className="flex shrink-0 items-center justify-between gap-3 border-b border-[var(--neon-border-muted)] px-4 py-3">
        <div className="flex min-w-0 items-center gap-2">
          {isAgent ? <Bot className="h-5 w-5 shrink-0 text-primary" /> : <Users className="h-5 w-5 shrink-0 text-primary" />}
          <div className="min-w-0">
            <p className="truncate text-body font-semibold text-text">{target.name}</p>
            <p className="truncate text-micro text-text-dim">
              {isAgent ? `AGENT · ${target.role}` : target.role}
            </p>
          </div>
        </div>
        <Button type="button" variant="ghost" size="sm" onClick={onClose}>
          닫기
        </Button>
      </header>

      <div className="flex min-h-0 flex-1 flex-col">
        <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-4">
          {messages.map((message) => (
            <div
              key={message.id}
              className={[
                "max-w-[86%] rounded-lg border px-3 py-2 text-caption",
                message.from === "me"
                  ? "ml-auto border-primary-light/40 bg-primary-muted text-text"
                  : message.from === "target"
                    ? "border-[var(--neon-border-muted)] bg-surface text-text"
                    : "mx-auto border-border bg-surface text-text-muted",
              ].join(" ")}
            >
              {message.text}
            </div>
          ))}
        </div>

        {isAgent ? (
          <form onSubmit={onSubmitTask} className="grid gap-2 border-t border-border bg-surface/70 p-3">
            <p className="text-caption font-semibold text-text">태스크 등록</p>
            <Input
              value={taskTitle}
              onChange={(e) => onTaskTitleChange(e.target.value)}
              placeholder="태스크 제목"
              disabled={taskSubmitting}
            />
            <textarea
              value={taskDescription}
              onChange={(e) => onTaskDescriptionChange(e.target.value)}
              placeholder="설명"
              disabled={taskSubmitting}
              className="min-h-20 rounded-md border border-border bg-surface px-3 py-2 text-body text-text focus:border-primary-light focus:outline-none focus:ring-2 focus:ring-primary-light/40 disabled:opacity-50"
            />
            {taskError && <p className="text-caption text-danger">{taskError}</p>}
            <Button type="submit" size="sm" icon={<Plus />} loading={taskSubmitting}>
              태스크 등록
            </Button>
          </form>
        ) : (
          <p className="border-t border-border bg-surface/70 p-3 text-caption text-text-muted">
            실시간 메시지 API가 붙으면 이 사이드 창에서 그대로 연결하면 됩니다.
          </p>
        )}

        <form onSubmit={onSubmitMessage} className="flex shrink-0 gap-2 border-t border-border p-3">
          <Input
            value={input}
            onChange={(e) => onInputChange(e.target.value)}
            placeholder={isAgent ? "예) 로그인 버그 태스크 등록해줘" : "메시지를 입력하세요"}
            autoFocus
          />
          <Button type="submit" icon={<Send />}>
            전송
          </Button>
        </form>
      </div>
    </aside>
  );
}

function HudMetric({
  label,
  value,
  detail,
}: {
  label: string;
  value: number;
  detail: string;
}) {
  return (
    <div className="rounded-lg border border-[var(--neon-border-muted)] bg-surface/92 px-3 py-2">
      <div className="flex items-center justify-between gap-3">
        <span className="text-micro font-bold uppercase text-text-muted">{label}</span>
        <Users className="h-3.5 w-3.5 text-primary" />
      </div>
      <p className="mt-1 text-xl font-bold leading-none text-text">{value}</p>
      <p className="mt-1 text-micro text-text-dim">{detail}</p>
    </div>
  );
}

function Skyline() {
  return (
    <div className="absolute inset-x-0 top-0 h-36 bg-gradient-to-b from-[#bfe7ff] to-transparent">
      <div className="absolute left-[8%] top-6 h-16 w-24 rounded-md border border-white/80 bg-white/55" />
      <div className="absolute left-[28%] top-9 h-12 w-20 rounded-md border border-white/80 bg-white/45" />
      <div className="absolute right-[24%] top-5 h-14 w-24 rounded-md border border-white/80 bg-white/50" />
      <div className="absolute right-[8%] top-8 h-12 w-20 rounded-md border border-white/80 bg-white/45" />
    </div>
  );
}

const OFFICE_DESK_CAPACITY = 6;

async function copyInviteUrl(
  inviteUrl: string,
  kind: "email" | "link",
  setCopiedInviteKind: (value: "email" | "link" | null) => void,
) {
  try {
    await window.navigator.clipboard?.writeText(inviteUrl);
    setCopiedInviteKind(kind);
  } catch {
    setCopiedInviteKind(null);
  }
}

function SettingsSelectModal({
  open,
  onClose,
  onSlack,
  onDiscord,
  onGithub,
  onOpenClaw,
  onChannelSettings,
}: {
  open: boolean;
  onClose: () => void;
  onSlack: () => void;
  onDiscord: () => void;
  onGithub: () => void;
  onOpenClaw: () => void;
  onChannelSettings: () => void;
}) {
  return (
    <Modal open={open} onClose={onClose} title="채널 설정" size="md">
      <Modal.Body className="grid gap-3 sm:grid-cols-2">
        <SettingChoice
          icon={<Bell />}
          title="Slack"
          description="업무 결과와 알림을 Slack 채널로 보냅니다."
          onClick={onSlack}
        />
        <SettingChoice
          icon={<MessageCircle />}
          title="Discord"
          description="Discord 채널 연동을 준비합니다."
          onClick={onDiscord}
        />
        <SettingChoice
          icon={<GitBranch />}
          title="GitHub"
          description="Repository 작업을 위한 credential을 관리합니다."
          onClick={onGithub}
        />
        <SettingChoice
          icon={<Bot />}
          title="AI / OpenClaw"
          description="OpenClaw Gateway와 Agent 실행 환경을 연결합니다."
          onClick={onOpenClaw}
        />
        <SettingChoice
          icon={<Settings />}
          title="채널 설정"
          description="워크스페이스 정보, 멤버, 초대 링크를 관리합니다."
          onClick={onChannelSettings}
          className="sm:col-span-2"
        />
      </Modal.Body>
      <Modal.Footer>
        <Button type="button" onClick={onClose}>닫기</Button>
      </Modal.Footer>
    </Modal>
  );
}

function SettingChoice({
  icon,
  title,
  description,
  onClick,
  className = "",
}: {
  icon: ReactNode;
  title: string;
  description: string;
  onClick: () => void;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex items-start gap-3 rounded-lg border border-border bg-surface p-4 text-left transition-colors hover:border-primary-light hover:bg-primary-muted ${className}`}
    >
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-surface-raised text-primary">
        {icon}
      </span>
      <span className="min-w-0">
        <span className="block text-body font-semibold text-text">{title}</span>
        <span className="mt-1 block text-caption text-text-muted">{description}</span>
      </span>
    </button>
  );
}

function TaskDashboardModal({
  open,
  onClose,
  actors,
  tasks,
  loading,
  error,
  onRefresh,
}: {
  open: boolean;
  onClose: () => void;
  actors: OfficeActor[];
  tasks: WorkspaceTask[];
  loading: boolean;
  error: string;
  onRefresh: () => void;
}) {
  return (
    <Modal open={open} onClose={onClose} title="태스크 진행 상황" size="full">
      <Modal.Body className="flex min-h-[62vh] flex-col gap-5">
        {error && (
          <p className="rounded-md border border-danger/30 bg-danger/10 px-3 py-2 text-caption text-danger">
            {error}
          </p>
        )}

        <section className="grid flex-1 gap-4 lg:grid-cols-4">
          {TASK_BOARD_GROUPS.map((group) => (
            <TaskColumn
              key={group.key}
              group={group}
              tasks={tasks.filter((task) => group.statuses.includes(task.status))}
              actors={actors}
            />
          ))}
        </section>
      </Modal.Body>
      <Modal.Footer>
        <Button type="button" variant="ghost" onClick={onClose}>닫기</Button>
        <Button type="button" icon={<ListChecks />} loading={loading} onClick={onRefresh}>
          새로고침
        </Button>
      </Modal.Footer>
    </Modal>
  );
}

function TaskColumn({
  group,
  tasks,
  actors,
}: {
  group: (typeof TASK_BOARD_GROUPS)[number];
  tasks: WorkspaceTask[];
  actors: OfficeActor[];
}) {
  return (
    <div className="min-h-[420px] rounded-lg border border-border bg-surface-raised/70 p-4">
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-title text-text">{group.label}</h3>
        <span className={`rounded-full px-2 py-0.5 text-micro font-semibold ${group.className}`}>
          {tasks.length}
        </span>
      </div>
      <div className="mt-3 grid gap-2">
        {tasks.length > 0 ? (
          tasks.map((task) => (
            <div key={task.taskId} className="rounded-md border border-border bg-surface px-3 py-2">
              <div className="flex items-start justify-between gap-2">
                <p className="min-w-0 text-caption font-semibold text-text">{task.title}</p>
                <span className={`shrink-0 rounded-full px-2 py-0.5 text-micro font-semibold ${TASK_STATUS_META[task.status].className}`}>
                  {TASK_STATUS_META[task.status].label}
                </span>
              </div>
              {task.description && (
                <p className="mt-1 line-clamp-2 text-micro text-text-muted">{task.description}</p>
              )}
              <p className="mt-2 text-micro text-text-dim">
                {taskAssigneeName(task, actors)}
              </p>
            </div>
          ))
        ) : (
          <p className="rounded-md border border-border bg-surface px-3 py-2 text-caption text-text-muted">
            태스크가 없습니다.
          </p>
        )}
      </div>
    </div>
  );
}

function AgentHireModal({
  open,
  onClose,
  name,
  onNameChange,
  role,
  onRoleChange,
  openClawAgentId,
  onOpenClawAgentIdChange,
  skillProfile,
  onSkillProfileChange,
  error,
  onSubmit,
}: {
  open: boolean;
  onClose: () => void;
  name: string;
  onNameChange: (value: string) => void;
  role: AgentRole;
  onRoleChange: (value: AgentRole) => void;
  openClawAgentId: string;
  onOpenClawAgentIdChange: (value: string) => void;
  skillProfile: string;
  onSkillProfileChange: (value: string) => void;
  error: string;
  onSubmit: (e: FormEvent) => void;
}) {
  const selectedRole = AGENT_ROLE_OPTIONS.find((option) => option.value === role);

  return (
    <Modal open={open} onClose={onClose} title="Agent 고용" size="md">
      <form onSubmit={onSubmit}>
        <Modal.Body className="grid gap-5 md:grid-cols-[minmax(0,1fr)_260px]">
          <div className="flex flex-col gap-4">
            <div className="rounded-lg border border-[var(--neon-border-muted)] bg-surface-raised/70 p-4">
              <p className="text-body font-semibold text-text">Agent 출근 설정</p>
              <p className="mt-1 text-caption text-text-muted">
                DeskRPG의 NPC 고용 흐름처럼 역할과 OpenClaw Agent ID를 정해 오피스 좌석에 배치합니다.
              </p>
            </div>

            <Field label="Agent 이름">
              <Input
                value={name}
                onChange={(e) => onNameChange(e.target.value)}
                placeholder="예) 백엔드 에이전트"
                autoFocus
              />
            </Field>

            <label className="flex flex-col gap-1.5">
              <span className="text-caption text-text-secondary">역할</span>
              <select
                value={role}
                onChange={(e) => onRoleChange(e.target.value as AgentRole)}
                className="h-9 w-full rounded-md border border-[var(--neon-border-muted)] bg-surface px-3 text-body text-text focus:border-primary-light focus:outline-none focus:ring-2 focus:ring-primary-light/50"
              >
                {AGENT_ROLE_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>

            <Field label="OpenClaw Agent ID">
              <Input
                value={openClawAgentId}
                onChange={(e) => onOpenClawAgentIdChange(e.target.value)}
                placeholder="backend-agent-01"
              />
            </Field>

            <label className="flex flex-col gap-1.5">
              <span className="text-caption text-text-secondary">Skill Profile</span>
              <select
                value={skillProfile}
                onChange={(e) => onSkillProfileChange(e.target.value)}
                className="h-9 w-full rounded-md border border-[var(--neon-border-muted)] bg-surface px-3 text-body text-text focus:border-primary-light focus:outline-none focus:ring-2 focus:ring-primary-light/50"
              >
                <option value="default">Default</option>
                <option value="code-review">Code Review</option>
                <option value="implementation">Implementation</option>
                <option value="qa-regression">QA Regression</option>
                <option value="docs-report">Docs / Report</option>
              </select>
            </label>

            {error && <p className="text-caption text-danger">{error}</p>}
          </div>

          <div className="rounded-lg border border-[var(--neon-border-muted)] bg-surface p-4">
            <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full border-2 border-white bg-primary text-title font-bold text-white">
              AI
            </div>
            <h3 className="mt-4 text-title text-text">{selectedRole?.label}</h3>
            <p className="mt-1 text-caption text-text-muted">
              {selectedRole?.description}
            </p>
            <div className="mt-4 grid gap-2 text-caption">
              <Info label="Status" value="출근 대기" />
              <Info label="Sync" value="API 연결 전" />
              <Info label="Seat" value="자동 배치" />
            </div>
          </div>
        </Modal.Body>

        <Modal.Footer>
          <Button type="button" variant="ghost" onClick={onClose}>
            닫기
          </Button>
          <Button type="submit" icon={<UserPlus />}>
            고용
          </Button>
        </Modal.Footer>
      </form>
    </Modal>
  );
}

function WorkspaceInfoModal({
  open,
  onClose,
  workspace,
  members,
  actors,
  adminCount,
  workingCount,
  isAdmin,
  deleteBusy,
  onDelete,
  onInvite,
}: {
  open: boolean;
  onClose: () => void;
  workspace: WorkspaceDetail;
  members: WorkspaceMember[];
  actors: OfficeActor[];
  adminCount: number;
  workingCount: number;
  isAdmin: boolean;
  deleteBusy: boolean;
  onDelete: () => void;
  onInvite: () => void;
}) {
  return (
    <Modal open={open} onClose={onClose} title="채널 설정" size="md">
      <Modal.Body className="flex flex-col gap-5">
        <section className="rounded-lg border border-border bg-surface-raised/70 p-4">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-title text-text">{workspace.name}</h2>
            <Badge variant={workspace.myRole === "ADMIN" ? "info" : "default"}>
              {workspace.myRole}
            </Badge>
          </div>
          {workspace.description && (
            <p className="mt-2 text-body text-text-muted">{workspace.description}</p>
          )}
          <p className="mt-3 text-caption text-text-muted">
            생성일 {formatDateTime(workspace.createdAt)}
          </p>
        </section>

        <section className="grid gap-3 sm:grid-cols-3">
          <ModalMetric label="Members" value={members.length} detail={`ADMIN ${adminCount}`} />
          <ModalMetric label="Seats" value={actors.length} detail={`${workingCount} working`} />
          <ModalMetric label="Tasks" value="0" detail="MVP 연결 전" />
        </section>

        <section className="grid gap-3">
          <h3 className="text-title text-text">Members</h3>
          <div className="grid gap-2">
            {members.map((member) => (
              <div
                key={member.memberId}
                className="flex items-center justify-between gap-3 rounded-md border border-border bg-surface px-3 py-2"
              >
                <div className="min-w-0">
                  <p className="truncate text-caption font-semibold text-text">{member.name}</p>
                  <p className="truncate text-micro text-text-dim">{member.email}</p>
                </div>
                <Badge variant={member.role === "ADMIN" ? "info" : "default"}>
                  {member.role}
                </Badge>
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-lg border border-danger/30 bg-danger/10 p-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h3 className="text-title text-danger">워크스페이스 삭제</h3>
              <p className="mt-1 text-caption text-text-muted">
                삭제는 ADMIN만 가능하며, 워크스페이스 데이터가 제거됩니다.
              </p>
            </div>
            <Button
              type="button"
              variant="danger"
              loading={deleteBusy}
              disabled={!isAdmin}
              onClick={onDelete}
            >
              삭제
            </Button>
          </div>
          {!isAdmin && (
            <p className="mt-3 text-caption text-danger">
              워크스페이스 삭제는 ADMIN만 실행할 수 있습니다.
            </p>
          )}
        </section>
      </Modal.Body>
      <Modal.Footer>
        <Button type="button" variant="ghost" onClick={onClose}>닫기</Button>
        <Button type="button" icon={<UserPlus />} onClick={onInvite}>
          회원 초대
        </Button>
      </Modal.Footer>
    </Modal>
  );
}

function ModalMetric({
  label,
  value,
  detail,
}: {
  label: string;
  value: number | string;
  detail: string;
}) {
  return (
    <div className="rounded-lg border border-border bg-surface px-3 py-3">
      <p className="text-micro font-bold uppercase text-text-muted">{label}</p>
      <p className="mt-1 text-xl font-bold text-text">{value}</p>
      <p className="text-micro text-text-dim">{detail}</p>
    </div>
  );
}

function DeleteWorkspaceConfirmModal({
  open,
  workspaceName,
  error,
  deleting,
  onClose,
  onConfirm,
}: {
  open: boolean;
  workspaceName: string;
  error: string;
  deleting: boolean;
  onClose: () => void;
  onConfirm: () => void;
}) {
  return (
    <Modal open={open} onClose={onClose} title="워크스페이스 삭제" size="sm" disableEscapeClose={deleting}>
      <Modal.Body className="flex flex-col gap-4">
        <div className="rounded-lg border border-danger/30 bg-danger/10 p-4">
          <p className="text-body font-semibold text-danger">{workspaceName}</p>
          <p className="mt-2 text-caption text-text-muted">
            이 워크스페이스를 삭제합니다. 삭제 후에는 워크스페이스 목록으로 이동합니다.
          </p>
        </div>
        {error && <p className="text-caption text-danger">{error}</p>}
      </Modal.Body>
      <Modal.Footer>
        <Button type="button" variant="ghost" onClick={onClose} disabled={deleting}>
          취소
        </Button>
        <Button type="button" variant="danger" loading={deleting} onClick={onConfirm}>
          삭제
        </Button>
      </Modal.Footer>
    </Modal>
  );
}

function InviteMemberModal({
  open,
  onClose,
  email,
  onEmailChange,
  role,
  onRoleChange,
  expiresInDays,
  onExpiresInDaysChange,
  emailInviteUrl,
  linkInviteUrl,
  error,
  copiedInviteKind,
  submitting,
  isAdmin,
  onSubmit,
  onCreateLinkOnly,
  onCopy,
}: {
  open: boolean;
  onClose: () => void;
  email: string;
  onEmailChange: (value: string) => void;
  role: WorkspaceRole;
  onRoleChange: (value: WorkspaceRole) => void;
  expiresInDays: number;
  onExpiresInDaysChange: (value: number) => void;
  emailInviteUrl: string;
  linkInviteUrl: string;
  error: string;
  copiedInviteKind: "email" | "link" | null;
  submitting: boolean;
  isAdmin: boolean;
  onSubmit: (e: FormEvent) => void;
  onCreateLinkOnly: () => void;
  onCopy: (inviteUrl: string, kind: "email" | "link") => void;
}) {
  const [mode, setMode] = useState<"email" | "link">("email");
  const visibleInviteUrl = mode === "email" ? emailInviteUrl : linkInviteUrl;
  const copied = copiedInviteKind === mode;

  return (
    <Modal open={open} onClose={onClose} title="회원 초대" size="sm">
      <form onSubmit={onSubmit}>
        <Modal.Body className="flex flex-col gap-5">
          <div className="rounded-lg border border-border bg-surface-raised/70 p-4">
            <p className="text-body font-semibold text-text">
              {mode === "email" ? "이메일 초대" : "초대 링크 만들기"}
            </p>
            <p className="mt-1 text-caption text-text-muted">
              {mode === "email"
                ? "이메일 대상자를 지정해서 워크스페이스 초대 링크를 생성합니다."
                : "이메일 없이 공유용 초대 링크만 생성하고 복사합니다."}
            </p>
          </div>

          <div className="grid grid-cols-2 rounded-lg border border-border bg-surface p-1">
            <button
              type="button"
              onClick={() => setMode("email")}
              className={[
                "rounded-md px-3 py-2 text-caption font-semibold transition-colors",
                mode === "email"
                  ? "bg-primary-muted text-primary"
                  : "text-text-muted hover:bg-surface-raised hover:text-text",
              ].join(" ")}
            >
              이메일 초대
            </button>
            <button
              type="button"
              onClick={() => setMode("link")}
              className={[
                "rounded-md px-3 py-2 text-caption font-semibold transition-colors",
                mode === "link"
                  ? "bg-primary-muted text-primary"
                  : "text-text-muted hover:bg-surface-raised hover:text-text",
              ].join(" ")}
            >
              링크 만들기
            </button>
          </div>

          {mode === "email" && (
            <label className="flex flex-col gap-1.5">
              <span className="text-caption text-text-secondary">이메일</span>
              <Input
                type="email"
                value={email}
                onChange={(e) => onEmailChange(e.target.value)}
                placeholder="member@example.com"
                disabled={submitting || !isAdmin}
                autoFocus
              />
            </label>
          )}

          <div className="grid gap-4 sm:grid-cols-2">
            <label className="flex flex-col gap-1.5">
              <span className="text-caption text-text-secondary">역할</span>
              <select
                value={role}
                onChange={(e) => onRoleChange(e.target.value as WorkspaceRole)}
                disabled={submitting || !isAdmin}
                className="w-full rounded-md border border-border bg-surface px-3 py-2 text-body text-text focus:outline-none focus:ring-2 focus:ring-primary-light disabled:opacity-50"
              >
                <option value="MEMBER">MEMBER</option>
                <option value="ADMIN">ADMIN</option>
              </select>
            </label>

            <label className="flex flex-col gap-1.5">
              <span className="text-caption text-text-secondary">만료일</span>
              <select
                value={expiresInDays}
                onChange={(e) => onExpiresInDaysChange(Number(e.target.value))}
                disabled={submitting || !isAdmin}
                className="w-full rounded-md border border-border bg-surface px-3 py-2 text-body text-text focus:outline-none focus:ring-2 focus:ring-primary-light disabled:opacity-50"
              >
                <option value={1}>1일</option>
                <option value={3}>3일</option>
                <option value={7}>7일</option>
                <option value={14}>14일</option>
                <option value={30}>30일</option>
              </select>
            </label>
          </div>

          {!isAdmin && (
            <p className="text-caption text-danger">
              회원 초대는 워크스페이스 ADMIN만 생성할 수 있습니다.
            </p>
          )}
          {error && <p className="text-caption text-danger">{error}</p>}

          {visibleInviteUrl && (
            <div className="rounded-lg border border-border bg-surface px-3 py-3">
              <div className="flex items-center justify-between gap-3">
                <p className="text-caption font-semibold text-text">
                  {copied
                    ? "초대 링크가 복사되었습니다."
                    : mode === "email"
                      ? "이메일 초대용 링크"
                      : "공유용 초대 링크"}
                </p>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  icon={<Clipboard />}
                  onClick={() => onCopy(visibleInviteUrl, mode)}
                >
                  복사
                </Button>
              </div>
              <p className="mt-2 break-all text-micro text-text-muted">{visibleInviteUrl}</p>
            </div>
          )}
        </Modal.Body>

        <Modal.Footer>
          <Button type="button" variant="ghost" onClick={onClose} disabled={submitting}>
            닫기
          </Button>
          {mode === "link" ? (
            <Button
              type="button"
              icon={<Clipboard />}
              loading={submitting}
              disabled={!isAdmin}
              onClick={onCreateLinkOnly}
            >
              링크 만들기
            </Button>
          ) : (
            <Button type="submit" icon={<UserPlus />} loading={submitting} disabled={!isAdmin}>
              초대 보내기
            </Button>
          )}
        </Modal.Footer>
      </form>
    </Modal>
  );
}

function SlackIntegrationModal({
  open,
  onClose,
  onBack,
  isAdmin,
  slackTeamId,
  onSlackTeamIdChange,
  slackChannelId,
  onSlackChannelIdChange,
  botToken,
  onBotTokenChange,
  signingSecret,
  onSigningSecretChange,
  saved,
  error,
  submitting,
  onSubmit,
}: {
  open: boolean;
  onClose: () => void;
  onBack: () => void;
  isAdmin: boolean;
  slackTeamId: string;
  onSlackTeamIdChange: (value: string) => void;
  slackChannelId: string;
  onSlackChannelIdChange: (value: string) => void;
  botToken: string;
  onBotTokenChange: (value: string) => void;
  signingSecret: string;
  onSigningSecretChange: (value: string) => void;
  saved: SlackIntegration | null;
  error: string;
  submitting: boolean;
  onSubmit: (e: FormEvent) => void;
}) {
  return (
    <Modal open={open} onClose={onClose} title="Slack 연동" size="md">
      <form onSubmit={onSubmit}>
        <Modal.Body className="grid gap-5 md:grid-cols-[minmax(0,1fr)_260px]">
          <div className="flex flex-col gap-4">
            <Field label="Slack Team ID">
              <Input
                value={slackTeamId}
                onChange={(e) => onSlackTeamIdChange(e.target.value)}
                placeholder="T0123456789"
                disabled={!isAdmin || submitting}
              />
            </Field>
            <Field label="Slack Channel ID">
              <Input
                value={slackChannelId}
                onChange={(e) => onSlackChannelIdChange(e.target.value)}
                placeholder="C0123456789"
                disabled={!isAdmin || submitting}
              />
            </Field>
            <Field label="Bot Token">
              <Input
                type="password"
                value={botToken}
                onChange={(e) => onBotTokenChange(e.target.value)}
                placeholder="xoxb-..."
                disabled={!isAdmin || submitting}
              />
            </Field>
            <Field label="Signing Secret">
              <Input
                type="password"
                value={signingSecret}
                onChange={(e) => onSigningSecretChange(e.target.value)}
                placeholder="Slack signing secret"
                disabled={!isAdmin || submitting}
              />
            </Field>
            {!isAdmin && (
              <p className="text-caption text-danger">
                Slack 연동은 워크스페이스 ADMIN만 설정할 수 있습니다.
              </p>
            )}
            {error && <p className="text-caption text-danger">{error}</p>}
          </div>

          <div className="rounded-lg border border-border bg-surface-raised/70 p-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-md bg-primary-muted text-primary">
              {saved ? <CheckCircle2 /> : <KeyRound />}
            </div>
            <h3 className="mt-4 text-title text-text">저장 상태</h3>
            <p className="mt-1 text-caption text-text-muted">
              Swagger 기준 현재 조회 API는 없어서 저장 직후 응답만 표시합니다.
            </p>
            {saved && (
              <div className="mt-4 grid gap-2 text-caption">
                <Info label="ID" value={String(saved.id)} />
                <Info label="Team" value={saved.slackTeamId} />
                <Info label="Channel" value={saved.slackChannelId} />
                <Info label="Token" value={saved.maskedBotToken} />
              </div>
            )}
          </div>
        </Modal.Body>
        <Modal.Footer>
          <Button type="button" variant="ghost" icon={<ArrowLeft />} onClick={onBack} disabled={submitting}>
            채널 설정
          </Button>
          <Button type="button" variant="ghost" onClick={onClose} disabled={submitting}>
            닫기
          </Button>
          <Button type="submit" icon={<Bell />} loading={submitting} disabled={!isAdmin}>
            연결 저장
          </Button>
        </Modal.Footer>
      </form>
    </Modal>
  );
}

function DiscordIntegrationModal({
  open,
  onClose,
  onBack,
}: {
  open: boolean;
  onClose: () => void;
  onBack: () => void;
}) {
  return (
    <Modal open={open} onClose={onClose} title="Discord 연동" size="sm">
      <Modal.Body className="flex flex-col gap-5">
        <div className="rounded-lg border border-border bg-surface-raised/70 p-4">
          <div className="flex h-10 w-10 items-center justify-center rounded-md bg-warning/15 text-warning">
            <ShieldAlert />
          </div>
          <h3 className="mt-4 text-title text-text">API 준비 전</h3>
          <p className="mt-1 text-body text-text-muted">
            현재 Swagger에는 Discord integration endpoint가 없습니다.
          </p>
        </div>
        <Field label="Discord Guild ID">
          <Input placeholder="123456789012345678" disabled />
        </Field>
        <Field label="Discord Channel ID">
          <Input placeholder="123456789012345678" disabled />
        </Field>
        <Field label="Bot Token">
          <Input type="password" placeholder="Discord bot token" disabled />
        </Field>
      </Modal.Body>
      <Modal.Footer>
        <Button type="button" variant="ghost" icon={<ArrowLeft />} onClick={onBack}>
          채널 설정
        </Button>
        <Button type="button" onClick={onClose}>닫기</Button>
      </Modal.Footer>
    </Modal>
  );
}

function GithubIntegrationModal({
  open,
  onClose,
  onBack,
}: {
  open: boolean;
  onClose: () => void;
  onBack: () => void;
}) {
  return (
    <Modal open={open} onClose={onClose} title="GitHub 연결" size="sm">
      <Modal.Body className="flex flex-col gap-5">
        <div className="rounded-lg border border-border bg-surface-raised/70 p-4">
          <GitBranch className="h-8 w-8 text-primary" />
          <h3 className="mt-4 text-title text-text">Credentials API 확인됨</h3>
          <p className="mt-1 text-body text-text-muted">
            Swagger에는 GitHub credential 생성 API가 있습니다. 저장/조회 흐름은 다음 단계에서 연결하면 됩니다.
          </p>
        </div>
        <Field label="Display Name">
          <Input placeholder="main github token" disabled />
        </Field>
        <Field label="Personal Access Token">
          <Input type="password" placeholder="ghp_..." disabled />
        </Field>
      </Modal.Body>
      <Modal.Footer>
        <Button type="button" variant="ghost" icon={<ArrowLeft />} onClick={onBack}>
          채널 설정
        </Button>
        <Button type="button" onClick={onClose}>닫기</Button>
      </Modal.Footer>
    </Modal>
  );
}

function OpenClawIntegrationModal({
  open,
  onClose,
  onBack,
}: {
  open: boolean;
  onClose: () => void;
  onBack: () => void;
}) {
  return (
    <Modal open={open} onClose={onClose} title="AI / OpenClaw 연동" size="sm">
      <Modal.Body className="flex flex-col gap-5">
        <div className="rounded-lg border border-border bg-surface-raised/70 p-4">
          <Bot className="h-8 w-8 text-primary" />
          <h3 className="mt-4 text-title text-text">OpenClaw Gateway</h3>
          <p className="mt-1 text-body text-text-muted">
            Swagger에는 아직 OpenClaw Gateway 연결 API가 없습니다. API가 추가되면 이 모달에서 연결 저장과 테스트를 처리하면 됩니다.
          </p>
        </div>
        <Field label="Gateway URL">
          <Input placeholder="http://localhost:..." disabled />
        </Field>
        <Field label="API Key">
          <Input type="password" placeholder="OpenClaw API key" disabled />
        </Field>
        <Field label="Default Agent Pool">
          <Input placeholder="office-agents" disabled />
        </Field>
      </Modal.Body>
      <Modal.Footer>
        <Button type="button" variant="ghost" icon={<ArrowLeft />} onClick={onBack}>
          채널 설정
        </Button>
        <Button type="button" onClick={onClose}>닫기</Button>
      </Modal.Footer>
    </Modal>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-caption text-text-secondary">{label}</span>
      {children}
    </label>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-text-muted">{label}</span>
      <span className="truncate font-semibold text-text">{value}</span>
    </div>
  );
}

function readHiredAgents(workspaceId: number): HiredAgent[] {
  if (typeof window === "undefined") return [];
  const raw = window.localStorage.getItem(hiredAgentsStorageKey(workspaceId));
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as HiredAgent[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeHiredAgents(workspaceId: number, agents: HiredAgent[]) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(hiredAgentsStorageKey(workspaceId), JSON.stringify(agents));
}

function hiredAgentsStorageKey(workspaceId: number) {
  return `aio.workspace.${workspaceId}.hiredAgents`;
}

function createLocalId() {
  if (typeof window !== "undefined" && window.crypto?.randomUUID) {
    return window.crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function pickStatus(index: number, role: string): OfficeActor["status"] {
  if (role === "ADMIN") return index % 2 === 0 ? "review" : "working";
  const statuses: OfficeActor["status"][] = ["working", "idle", "blocked"];
  return statuses[index % statuses.length];
}

function chatKey(actor: OfficeActor) {
  return `${actor.kind}:${actor.id}`;
}

function isTaskCreateCommand(message: string) {
  const normalized = message.replace(/\s/g, "");
  return normalized.includes("태스크") && normalized.includes("등록");
}

function extractTaskTitle(message: string) {
  const cleaned = message
    .replace(/태스크/g, "")
    .replace(/등록해줘/g, "")
    .replace(/등록/g, "")
    .replace(/해줘/g, "")
    .trim();
  return cleaned || message.trim();
}

function taskAssigneeName(task: WorkspaceTask, actors: OfficeActor[]) {
  const assigneeId = task.assignedAgentId ?? task.assigneeId;
  if (!assigneeId) return "담당자 미배정";
  const actor = actors.find((item) => String(item.id) === String(assigneeId));
  return actor ? `담당 ${actor.name}` : `담당 ID ${assigneeId}`;
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
