"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { use, useCallback, useEffect, useMemo, useRef, useState, type FormEvent, type PointerEvent, type ReactNode } from "react";
import {
  ArrowLeft,
  Bell,
  Bot,
  CheckCircle2,
  GitBranch,
  KeyRound,
  ListChecks,
  MessageCircle,
  Plug,
  Plus,
  Send,
  Settings,
  ShieldAlert,
  UserPlus,
} from "lucide-react";
import { Button, Input, Modal } from "@/components/ui";
import { GlyphText, T4Panel, PixelAvatar, type PixelAvatarKind } from "@/components/arcade";
import { t4 } from "@/components/arcade/tokens";
import {
  WorkspaceErrorState,
  WorkspaceLoadingState,
} from "@/components/workspace/WorkspaceShell";
import type { OfficeAgentState } from "@/game/office/EventBus";
import { getStoredUser, type ApiError } from "@/lib/api-client";
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
  getWorkspace,
  listWorkspaceMembers,
  type WorkspaceDetail,
  type WorkspaceMember,
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

interface StagePan {
  x: number;
  y: number;
}

interface StageSize {
  width: number;
  height: number;
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
  REQUESTED: { label: "요청됨", className: "bg-surface-raised text-text-muted" },
  ASSIGNED: { label: "배정됨", className: "bg-info/15 text-info" },
  IN_PROGRESS: { label: "진행 중", className: "bg-working/15 text-working" },
  WAITING_USER: { label: "대기", className: "bg-warning/15 text-warning" },
  COMPLETED: { label: "완료", className: "bg-success/15 text-success" },
  FAILED: { label: "실패", className: "bg-danger/15 text-danger" },
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
    statuses: ["REQUESTED", "WAITING_USER"],
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
  const [discordOpen, setDiscordOpen] = useState(false);
  const [githubOpen, setGithubOpen] = useState(false);
  const [slackOpen, setSlackOpen] = useState(false);
  const [openClawOpen, setOpenClawOpen] = useState(false);

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
  const [selectedActorId, setSelectedActorId] = useState<string | null>(null);
  const [stageZoom, setStageZoom] = useState(1);
  const [stagePan, setStagePan] = useState<StagePan>({ x: 0, y: 0 });
  const [stageSize, setStageSize] = useState<StageSize>({ width: 1, height: 1 });
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
      if (!getStoredUser() && !cancelled) {
        router.replace("/");
      }
    });

    (async () => {
      if (!getStoredUser()) return;
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
  }, [id, router]);

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

  const selectedActor = useMemo(
    () => actors.find((actor) => String(actor.id) === selectedActorId) ?? null,
    [actors, selectedActorId],
  );
  const agentCount = actors.filter((actor) => actor.kind === "agent").length;
  const stageRooms = useMemo(() => getStageRooms(actors.length), [actors.length]);

  if (state.kind === "loading") return <WorkspaceLoadingState />;
  if (state.kind === "error") return <WorkspaceErrorState message={state.message} />;

  const workingCount = actors.filter((actor) => actor.status === "working").length;
  const adminCount = state.members.filter((member) => member.role === "ADMIN").length;
  const isAdmin = state.workspace.myRole === "ADMIN";

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
    <main
      className="theme-web flex h-screen min-h-[620px] flex-col overflow-hidden"
      style={{ background: t4.bg, color: t4.ink }}
    >
      <GameTopNav
        workspace={state.workspace}
        onConnections={() => setSettingsOpen(true)}
        onTasks={() => setTasksOpen(true)}
        onHireAgent={() => setAgentHireOpen(true)}
      />

      <section className="relative flex-1 overflow-hidden">
        <Skyline />

        <ArcadeOfficeStage
          actors={actors}
          rooms={stageRooms}
          selectedActorId={selectedActorId}
          zoom={stageZoom}
          pan={stagePan}
          onPanChange={setStagePan}
          onSizeChange={setStageSize}
          onActorSelect={(actor) => {
            setSelectedActorId(String(actor.id));
            setActorMenu(null);
          }}
          onActorContextMenu={({ actor, x, y }) => setActorMenu({ actor, x, y })}
        />

        <HeroHud
          name={getStoredUser()?.name ?? "HERO"}
          memberCount={state.members.length}
          workingCount={workingCount}
        />
        <MapHud
          rooms={getStageMiniMapRooms(stageRooms, agentCount)}
          totalActors={actors.length}
          zoom={stageZoom}
          pan={stagePan}
          stageSize={stageSize}
        />
        <MapZoomControls
          zoom={stageZoom}
          onZoomOut={() => setStageZoom((value) => clampStageZoom(value - STAGE_ZOOM_STEP))}
          onReset={() => setStageZoom(1)}
          onZoomIn={() => setStageZoom((value) => clampStageZoom(value + STAGE_ZOOM_STEP))}
        />

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

        <DialogueBox
          actors={actors}
          selectedActor={selectedActor}
          adminCount={adminCount}
          onTalk={openActorChat}
          onTasks={() => setTasksOpen(true)}
          onHire={() => setAgentHireOpen(true)}
        />
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
  onConnections,
  onTasks,
  onHireAgent,
}: {
  workspace: WorkspaceDetail;
  onConnections: () => void;
  onTasks: () => void;
  onHireAgent: () => void;
}) {
  return (
    <header
      className="z-40 flex h-14 shrink-0 items-center justify-between gap-3 px-4"
      style={{
        background: "linear-gradient(180deg, rgba(90,168,255,0.08), rgba(20,24,40,0.95))",
        borderBottom: `1px solid ${t4.line}`,
      }}
    >
      <div className="flex min-w-0 items-center gap-3">
        <Link
          href="/workspaces"
          className="hidden sm:inline"
          style={{
            fontFamily: "var(--font-pixel)",
            fontSize: 8,
            letterSpacing: 2,
            color: t4.dim,
            textDecoration: "none",
          }}
        >
          <GlyphText glyph="◀">WORKSPACES</GlyphText>
        </Link>
        <span style={{ color: t4.line }}>·</span>
        <div className="min-w-0">
          <p
            className="truncate"
            style={{
              fontFamily: "var(--font-pixel)",
              fontSize: 11,
              letterSpacing: 1.5,
              color: t4.ink,
              textShadow: `0 0 8px ${t4.pink}80`,
            }}
          >
            <GlyphText glyph="♦" truncate>{workspace.name.toUpperCase()}</GlyphText>
          </p>
          <p
            className="truncate"
            style={{
              fontFamily: "var(--font-mono-arcade)",
              fontSize: 9,
              color: t4.dim,
              letterSpacing: 1,
              marginTop: 2,
            }}
          >
            WORLD · FLOOR 01 · {workspace.workspaceId}
          </p>
        </div>
      </div>

      <nav className="flex shrink-0 items-center gap-2 overflow-x-auto scrollbar-hide">
        <ArcadeNavButton color={t4.pink} primary onClick={onHireAgent} icon={<Bot className="h-3.5 w-3.5" />}>
          AGENT
        </ArcadeNavButton>
        <ArcadeNavButton color={t4.mp} onClick={onConnections} icon={<Plug className="h-3.5 w-3.5" />}>
          LINK
        </ArcadeNavButton>
        <Link href={`/workspaces/${workspace.workspaceId}/settings`}>
          <ArcadeNavButton color={t4.agent} icon={<Settings className="h-3.5 w-3.5" />}>
            WORKSPACE
          </ArcadeNavButton>
        </Link>
        <ArcadeNavButton color={t4.xp} onClick={onTasks} icon={<ListChecks className="h-3.5 w-3.5" />}>
          QUESTS
        </ArcadeNavButton>
      </nav>
    </header>
  );
}

function ArcadeNavButton({
  children,
  color,
  primary,
  icon,
  onClick,
}: {
  children: React.ReactNode;
  color: string;
  primary?: boolean;
  icon?: React.ReactNode;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        fontFamily: "var(--font-pixel)",
        fontSize: 8,
        letterSpacing: 1.5,
        padding: "7px 11px",
        background: primary ? color : "transparent",
        color: primary ? "#000" : color,
        border: `1px solid ${color}`,
        boxShadow: primary ? `0 0 12px ${color}` : `0 0 4px ${color}30`,
        cursor: "pointer",
        textTransform: "uppercase",
      }}
    >
      {icon}
      {children}
    </button>
  );
}

interface StageRoomSpec {
  label: string;
  left: string;
  top: string;
  width: string;
  height: string;
  color: string;
  variant: "engineering" | "huddle" | "lounge" | "library";
}

interface MiniMapRoom {
  color: string;
  label: string;
  x: string;
  y: string;
  w: string;
  h: string;
  count: number;
}

interface StageActorPosition {
  left: string;
  top: string;
}

function ArcadeOfficeStage({
  actors,
  rooms,
  selectedActorId,
  zoom,
  pan,
  onPanChange,
  onSizeChange,
  onActorContextMenu,
  onActorSelect,
}: {
  actors: OfficeActor[];
  rooms: StageRoomSpec[];
  selectedActorId: string | null;
  zoom: number;
  pan: StagePan;
  onPanChange: (pan: StagePan) => void;
  onSizeChange: (size: StageSize) => void;
  onActorContextMenu: (payload: { actor: OfficeActor; x: number; y: number }) => void;
  onActorSelect: (actor: OfficeActor) => void;
}) {
  const stageRef = useRef<HTMLDivElement | null>(null);
  const [drag, setDrag] = useState<{
    pointerId: number;
    startX: number;
    startY: number;
    originX: number;
    originY: number;
  } | null>(null);

  useEffect(() => {
    const node = stageRef.current;
    if (!node) return;
    const updateSize = () => {
      onSizeChange({
        width: Math.max(1, node.clientWidth),
        height: Math.max(1, node.clientHeight),
      });
    };
    updateSize();
    const observer = new ResizeObserver(updateSize);
    observer.observe(node);
    return () => observer.disconnect();
  }, [onSizeChange]);

  function handlePointerDown(event: PointerEvent<HTMLDivElement>) {
    if (event.button !== 0) return;
    const target = event.target as HTMLElement;
    if (target.closest("button")) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    setDrag({
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      originX: pan.x,
      originY: pan.y,
    });
  }

  function handlePointerMove(event: PointerEvent<HTMLDivElement>) {
    if (!drag || drag.pointerId !== event.pointerId) return;
    onPanChange({
      x: drag.originX + event.clientX - drag.startX,
      y: drag.originY + event.clientY - drag.startY,
    });
  }

  function handlePointerEnd(event: PointerEvent<HTMLDivElement>) {
    if (!drag || drag.pointerId !== event.pointerId) return;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    setDrag(null);
  }

  return (
    <div
      ref={stageRef}
      className="absolute inset-0 z-10 overflow-hidden"
      style={{
        background: "#090b16",
        cursor: drag ? "grabbing" : "grab",
        touchAction: "none",
      }}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerEnd}
      onPointerCancel={handlePointerEnd}
    >
      <div
        className="absolute inset-0"
        style={{
          transform: `translate3d(${pan.x}px, ${pan.y}px, 0)`,
          transition: drag ? "none" : "transform 160ms ease-out",
        }}
      >
        <div
          className="absolute inset-0"
          style={{
          transform: `scale(${zoom})`,
          transformOrigin: "50% 50%",
          transition: drag ? "none" : "transform 160ms ease-out",
        }}
      >
        <div
          className="absolute inset-0"
          style={{
            backgroundImage:
              "linear-gradient(rgba(154,122,255,0.08) 1px, transparent 1px), linear-gradient(90deg, rgba(154,122,255,0.08) 1px, transparent 1px)",
            backgroundSize: "22px 22px",
          }}
        />

        {rooms.map((room) => (
          <StageRoom key={room.label} room={room} />
        ))}

        <QuestMarker />

        {actors.map((actor, index) => {
          const position = STAGE_ACTOR_POSITIONS[index % STAGE_ACTOR_POSITIONS.length];
          return (
            <StageActor
              key={actor.id}
              actor={actor}
              position={position}
              selected={String(actor.id) === selectedActorId}
              onSelect={onActorSelect}
              onContextMenu={onActorContextMenu}
            />
          );
        })}

        {actors.length === 0 && (
          <div
            className="absolute left-1/2 top-1/2 w-[min(360px,calc(100%-48px))] -translate-x-1/2 -translate-y-1/2 px-5 py-4 text-center"
            style={{
              border: `1px solid ${t4.agent}`,
              background: "rgba(20,28,55,0.94)",
              boxShadow: `0 0 18px ${t4.agent}35`,
            }}
          >
            <p
              style={{
                fontFamily: "var(--font-pixel)",
                fontSize: 10,
                letterSpacing: 1.5,
                color: t4.agent,
                textShadow: `0 0 8px ${t4.agent}`,
              }}
            >
              NO WORKSPACE MEMBERS ON FLOOR
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
              AGENT 버튼에서 Agent를 고용하거나 WORKSPACE에서 멤버를 초대하세요.
            </p>
          </div>
        )}
        </div>
      </div>
    </div>
  );
}

function StageRoom({
  room,
}: {
  room: StageRoomSpec;
}) {
  return (
    <section
      className="absolute overflow-hidden"
      style={{
        left: room.left,
        top: room.top,
        width: room.width,
        height: room.height,
        border: `1px solid ${room.color}`,
        background: `${room.color}08`,
        boxShadow: `inset 0 0 42px ${room.color}08`,
      }}
    >
      <div
        className="absolute left-3 top-3"
        style={{
          fontFamily: "var(--font-pixel)",
          fontSize: 8,
          letterSpacing: 2,
          color: room.color,
          textShadow: `0 0 8px ${room.color}`,
        }}
      >
        {room.label.startsWith("♦ ") ? (
          <GlyphText glyph="♦">{room.label.slice(2)}</GlyphText>
        ) : (
          room.label
        )}
      </div>
      {room.variant === "engineering" && <EngineeringPlatforms />}
      {room.variant === "huddle" && <HuddleTable />}
      {room.variant === "lounge" && <LoungeBench />}
      {room.variant === "library" && <LibraryShelves />}
    </section>
  );
}

function EngineeringPlatforms() {
  const platforms = [
    { left: "9%", top: "31%" },
    { left: "26%", top: "31%" },
    { left: "43%", top: "31%" },
    { left: "60%", top: "31%" },
    { left: "9%", top: "60%" },
    { left: "26%", top: "60%" },
    { left: "43%", top: "60%" },
    { left: "60%", top: "60%" },
  ];
  return (
    <>
      {platforms.map((item, index) => (
        <div
          key={index}
          className="absolute h-[15%] w-[14%]"
          style={{
            left: item.left,
            top: item.top,
            border: `1px solid ${t4.agent}`,
            background: `${t4.agent}24`,
            boxShadow: `0 0 12px ${t4.agent}18`,
          }}
        />
      ))}
    </>
  );
}

function HuddleTable() {
  return (
    <div
      className="absolute left-[31%] top-[39%] h-[31%] w-[37%] rounded-[50%]"
      style={{
        border: `1px solid ${t4.mp}`,
        background: "rgba(90,168,255,0.05)",
        boxShadow: `0 0 16px ${t4.mp}20`,
      }}
    />
  );
}

function LoungeBench() {
  return (
    <div
      className="absolute left-[13%] top-[65%] h-[13%] w-[59%]"
      style={{
        border: `1px solid ${t4.ok}`,
        background: `${t4.ok}18`,
      }}
    />
  );
}

function LibraryShelves() {
  return (
    <div className="absolute left-[7%] top-[23%] grid w-[78%] gap-4">
      {[0, 1, 2].map((item) => (
        <div
          key={item}
          className="h-3"
          style={{
            background: "rgba(255,216,74,0.42)",
            boxShadow: `0 0 10px ${t4.xp}12`,
          }}
        />
      ))}
    </div>
  );
}

function QuestMarker() {
  return (
    <button
      type="button"
      className="absolute left-[61.5%] top-[13.5%] flex h-[52px] w-[52px] items-center justify-center"
      style={{
        border: `2px solid ${t4.xp}`,
        background: "#fff6c7",
        color: "#050713",
        boxShadow: `0 0 24px ${t4.xp}`,
        fontFamily: "var(--font-pixel)",
        fontSize: 12,
      }}
      aria-label="Quest"
    >
      ★
      <span
        className="absolute left-1/2 top-[58px] -translate-x-1/2"
        style={{
          color: t4.xp,
          fontFamily: "var(--font-pixel)",
          fontSize: 8,
          letterSpacing: 2,
          textShadow: `0 0 8px ${t4.xp}`,
        }}
      >
        QUEST
      </span>
    </button>
  );
}

function StageActor({
  actor,
  position,
  selected,
  onContextMenu,
  onSelect,
}: {
  actor: OfficeActor;
  position: StageActorPosition;
  selected: boolean;
  onContextMenu: (payload: { actor: OfficeActor; x: number; y: number }) => void;
  onSelect: (actor: OfficeActor) => void;
}) {
  const isAgent = actor.kind === "agent";
  const accent = isAgent ? t4.agent : t4.pink;
  const status = STATUS_META[actor.status];
  return (
    <button
      type="button"
      className="absolute z-20 -translate-x-1/2 -translate-y-1/2 cursor-pointer border-0 bg-transparent p-0"
      style={{ left: position.left, top: position.top }}
      onClick={() => onSelect(actor)}
      onContextMenu={(event) => {
        event.preventDefault();
        onContextMenu({ actor, x: event.clientX, y: event.clientY });
      }}
      aria-label={`${actor.name} 채팅`}
    >
      <div
        className="absolute left-1/2 top-[-34px] min-w-[112px] -translate-x-1/2 px-2 py-1"
        style={{
          border: `1px solid ${accent}`,
          background: "rgba(9,11,22,0.92)",
          boxShadow: selected ? `0 0 14px ${accent}` : `0 0 10px ${accent}30`,
        }}
      >
        <div className="flex items-center justify-center gap-1.5">
          <span
            className="h-1.5 w-1.5 shrink-0"
            style={{
              background: status.dotClassName === "bg-working" ? t4.ok : accent,
              boxShadow: `0 0 6px ${accent}`,
            }}
          />
          <span
            className="truncate"
            style={{
              maxWidth: 92,
              fontFamily: "var(--font-pixel)",
              fontSize: 7,
              letterSpacing: 1,
              color: t4.ink,
            }}
          >
            {actor.name.toUpperCase()}
          </span>
        </div>
      </div>
      <div
        style={{
          padding: 4,
          filter: selected ? `drop-shadow(0 0 14px ${accent})` : `drop-shadow(0 0 8px ${accent}80)`,
        }}
      >
        <PixelAvatar kind={pickAvatarKind(actor.name, isAgent)} size={3} walking={actor.status === "working"} />
      </div>
    </button>
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

  const accent = menu.actor.kind === "agent" ? t4.agent : t4.pink;
  return (
    <div
      className="fixed z-40 w-48 p-1"
      style={{
        left,
        top,
        background: "rgba(20,28,55,0.95)",
        border: `1px solid ${accent}`,
        boxShadow: `0 0 14px ${accent}40, inset 0 0 12px rgba(154,122,255,0.06)`,
      }}
      onClick={(e) => e.stopPropagation()}
    >
      <button
        type="button"
        onClick={() => onChat(menu.actor)}
        className="flex w-full items-center gap-2 px-3 py-2 text-left"
        style={{
          fontFamily: "var(--font-pixel)",
          fontSize: 8,
          letterSpacing: 1.5,
          color: accent,
          background: "transparent",
          border: "none",
          cursor: "pointer",
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.background = `${accent}15`;
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.background = "transparent";
        }}
      >
        <MessageCircle className="h-3.5 w-3.5" />
        <GlyphText glyph="▶">
          {menu.actor.kind === "agent" ? "TALK TO AGENT" : "TALK"}
        </GlyphText>
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
  const accent = isAgent ? t4.agent : t4.pink;
  const avatarKind: PixelAvatarKind = isAgent ? "agent" : "mira";

  return (
    <aside
      className="absolute bottom-20 left-3 top-3 z-30 flex w-[calc(100%-1.5rem)] flex-col overflow-hidden sm:left-4 sm:top-4 sm:w-[400px]"
      style={{
        background: "rgba(20,28,55,0.96)",
        border: `1px solid ${accent}`,
        boxShadow: `0 0 0 1px rgba(0,0,0,0.6), inset 0 0 24px rgba(154,122,255,0.08), 0 0 18px ${accent}40`,
      }}
    >
      <header
        className="flex shrink-0 items-center justify-between gap-3 px-4 py-3"
        style={{
          borderBottom: `1px solid ${t4.line}`,
          background: "rgba(0,0,0,0.4)",
        }}
      >
        <div className="flex min-w-0 items-center gap-3">
          <div
            style={{
              padding: 4,
              border: `1px solid ${accent}`,
              background: "rgba(0,0,0,0.4)",
              boxShadow: `0 0 8px ${accent}40`,
              flexShrink: 0,
            }}
          >
            <PixelAvatar kind={avatarKind} size={2} />
          </div>
          <div className="min-w-0">
            <p
              className="truncate"
              style={{
                fontFamily: "var(--font-pixel)",
                fontSize: 9,
                letterSpacing: 1.5,
                color: accent,
                textShadow: `0 0 6px ${accent}`,
              }}
            >
              <GlyphText glyph={isAgent ? "◇" : "●"} truncate>
                {target.name.toUpperCase()}
              </GlyphText>
            </p>
            <p
              className="truncate"
              style={{
                fontFamily: "var(--font-mono-arcade)",
                fontSize: 9,
                color: t4.dim,
                marginTop: 3,
                letterSpacing: 1,
              }}
            >
              {isAgent ? `AGENT · ${target.role}` : target.role}
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={onClose}
          style={{
            fontFamily: "var(--font-pixel)",
            fontSize: 8,
            letterSpacing: 1.5,
            padding: "5px 10px",
            color: t4.dim,
            background: "transparent",
            border: `1px solid ${t4.line}`,
            cursor: "pointer",
          }}
        >
          ✕ ESC
        </button>
      </header>

      <div className="flex min-h-0 flex-1 flex-col">
        <div
          className="min-h-0 flex-1 space-y-3 overflow-y-auto p-4"
          style={{ background: "rgba(0,0,0,0.25)" }}
        >
          {messages.length === 0 && (
            <div
              style={{
                fontFamily: "var(--font-mono-arcade)",
                fontSize: 11,
                color: t4.dim,
                textAlign: "center",
                padding: "20px 10px",
              }}
            >
              <GlyphText glyph="◆">no chatter yet - say hi!</GlyphText>
            </div>
          )}
          {messages.map((message) => {
            if (message.from === "system") {
              return (
                <div
                  key={message.id}
                  style={{
                    fontFamily: "var(--font-pixel)",
                    fontSize: 8,
                    letterSpacing: 2,
                    color: t4.xp,
                    textAlign: "center",
                    padding: "6px 10px",
                    border: `1px solid ${t4.xp}`,
                    background: "rgba(255,216,74,0.06)",
                    boxShadow: `0 0 10px ${t4.xp}30`,
                    textShadow: `0 0 6px ${t4.xp}`,
                  }}
                >
                  <GlyphText glyph="★">{message.text}</GlyphText>
                </div>
              );
            }
            const fromMe = message.from === "me";
            return (
              <div
                key={message.id}
                style={{
                  maxWidth: "86%",
                  marginLeft: fromMe ? "auto" : 0,
                  padding: "8px 11px",
                  fontFamily: "var(--font-mono-arcade)",
                  fontSize: 11,
                  color: t4.ink,
                  border: `1px solid ${fromMe ? t4.pink : accent}40`,
                  background: fromMe
                    ? "rgba(255,122,220,0.08)"
                    : "rgba(20,28,55,0.6)",
                  lineHeight: 1.5,
                }}
              >
                {message.text}
              </div>
            );
          })}
        </div>

        {isAgent ? (
          <form
            onSubmit={onSubmitTask}
            className="grid gap-2 p-3"
            style={{
              borderTop: `1px solid ${t4.line}`,
              background: "rgba(0,0,0,0.5)",
            }}
          >
            <p
              style={{
                fontFamily: "var(--font-pixel)",
                fontSize: 8,
                color: t4.xp,
                letterSpacing: 2,
                textShadow: `0 0 4px ${t4.xp}`,
              }}
            >
              <GlyphText glyph="◆">ASSIGN QUEST</GlyphText>
            </p>
            <Input
              value={taskTitle}
              onChange={(e) => onTaskTitleChange(e.target.value)}
              placeholder="quest title"
              disabled={taskSubmitting}
            />
            <textarea
              value={taskDescription}
              onChange={(e) => onTaskDescriptionChange(e.target.value)}
              placeholder="description"
              disabled={taskSubmitting}
              className="min-h-20 px-3 py-2"
              style={{
                background: "rgba(10,13,26,0.8)",
                border: `1px solid ${t4.line}`,
                color: t4.ink,
                fontFamily: "var(--font-mono-arcade)",
                fontSize: 11,
                outline: "none",
              }}
            />
            {taskError && (
              <p
                style={{
                  fontFamily: "var(--font-mono-arcade)",
                  fontSize: 10,
                  color: t4.hp,
                }}
              >
                <GlyphText glyph="⚠">{taskError}</GlyphText>
              </p>
            )}
            <Button type="submit" size="sm" icon={<Plus />} loading={taskSubmitting}>
              QUEST 등록
            </Button>
          </form>
        ) : (
          <p
            className="p-3"
            style={{
              fontFamily: "var(--font-mono-arcade)",
              fontSize: 10,
              color: t4.dim,
              borderTop: `1px solid ${t4.line}`,
              background: "rgba(0,0,0,0.4)",
            }}
          >
            <GlyphText glyph="◇">Real-time API not wired yet - messages stay local for now.</GlyphText>
          </p>
        )}

        <form
          onSubmit={onSubmitMessage}
          className="flex shrink-0 gap-2 p-3"
          style={{
            borderTop: `1px solid ${t4.line}`,
            background: "rgba(0,0,0,0.5)",
          }}
        >
          <span
            style={{
              fontFamily: "var(--font-pixel)",
              fontSize: 11,
              color: t4.pink,
              letterSpacing: 1,
              padding: "8px 4px",
            }}
          >
            ▶
          </span>
          <Input
            value={input}
            onChange={(e) => onInputChange(e.target.value)}
            placeholder={
              isAgent ? "/quest 로그인 버그 등록해줘" : "type a message…"
            }
            autoFocus
          />
          <Button type="submit" icon={<Send />}>
            ↵
          </Button>
        </form>
      </div>
    </aside>
  );
}

function HeroHud({
  name,
  memberCount,
  workingCount,
}: {
  name: string;
  memberCount: number;
  workingCount: number;
}) {
  const kind = pickAvatarKind(name);
  const display = name.toUpperCase().slice(0, 10);
  const lv = Math.max(1, Math.min(99, memberCount * 7 + workingCount * 3));
  const hpPct = workingCount === 0 ? 100 : Math.max(20, 100 - workingCount * 12);
  const mpPct = Math.min(95, 25 + workingCount * 15);
  const xpPct = Math.min(100, 12 + memberCount * 9);
  return (
    <T4Panel
      label="HERO"
      accent={t4.pink}
      style={{ position: "absolute", top: 14, left: 14, padding: 10, width: 220, zIndex: 30 }}
    >
      <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
        <div style={{ background: "rgba(0,0,0,0.4)", padding: 4, border: `1px solid ${t4.pink}` }}>
          <PixelAvatar kind={kind} size={2} />
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <span style={{ fontFamily: "var(--font-pixel)", fontSize: 8, letterSpacing: 1, color: t4.ink }}>
              {display}
            </span>
            <span style={{ fontFamily: "var(--font-pixel)", fontSize: 8, color: t4.xp, letterSpacing: 1 }}>
              LV.{String(lv).padStart(2, "0")}
            </span>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 2, marginTop: 6 }}>
            <MiniBar pct={hpPct} color={t4.hp} />
            <MiniBar pct={mpPct} color={t4.mp} />
            <MiniBar pct={xpPct} color={t4.xp} thin />
          </div>
        </div>
      </div>
    </T4Panel>
  );
}

function MiniBar({ pct, color, thin }: { pct: number; color: string; thin?: boolean }) {
  return (
    <div style={{ height: thin ? 3 : 4, background: "#0a0d1a" }}>
      <div style={{ width: `${pct}%`, height: "100%", background: color }} />
    </div>
  );
}

function MapHud({
  rooms,
  totalActors,
  zoom,
  pan,
  stageSize,
}: {
  rooms: MiniMapRoom[];
  totalActors: number;
  zoom: number;
  pan: StagePan;
  stageSize: StageSize;
}) {
  const stageWidth = Math.max(1, stageSize.width);
  const stageHeight = Math.max(1, stageSize.height);
  const viewportW = clampMiniMapValue(100 / zoom, 24, 100);
  const viewportH = clampMiniMapValue(100 / zoom, 24, 100);
  const viewportLeft = clampMiniMapValue(
    50 - viewportW / 2 - (pan.x / (stageWidth * zoom)) * 100,
    0,
    100 - viewportW,
  );
  const viewportTop = clampMiniMapValue(
    50 - viewportH / 2 - (pan.y / (stageHeight * zoom)) * 100,
    0,
    100 - viewportH,
  );

  return (
    <T4Panel
      label="MAP · FLOOR 01"
      accent={t4.mp}
      style={{ position: "absolute", top: 14, right: 14, padding: 8, width: 200, zIndex: 30 }}
    >
      <div
        style={{
          position: "relative",
          height: 110,
          border: `1px solid ${t4.line}`,
          background: "#0a0d1a",
        }}
      >
        {rooms.map((r) => (
          <div
            key={r.label}
            style={{
              position: "absolute",
              left: r.x,
              top: r.y,
              width: r.w,
              height: r.h,
              border: `1px solid ${r.color}`,
              background: `${r.color}1A`,
            }}
          >
            {r.count > 0 && (
              <div
                style={{
                  position: "absolute",
                  left: 4,
                  top: 4,
                  width: 4,
                  height: 4,
                  background: r.color,
                  boxShadow: `0 0 6px ${r.color}`,
                }}
              />
            )}
          </div>
        ))}
        <div
          style={{
            position: "absolute",
            left: `${viewportLeft}%`,
            top: `${viewportTop}%`,
            width: `${viewportW}%`,
            height: `${viewportH}%`,
            border: `1px solid ${t4.ink}`,
            boxShadow: `0 0 8px ${t4.ink}80, inset 0 0 10px rgba(245,247,255,0.08)`,
            background: "rgba(245,247,255,0.04)",
            pointerEvents: "none",
          }}
        />
      </div>
      <div
        style={{
          marginTop: 6,
          display: "flex",
          justifyContent: "space-between",
          fontFamily: "var(--font-pixel)",
          fontSize: 7,
          letterSpacing: 2,
          color: t4.dim,
        }}
      >
        <span>
          <GlyphText glyph="◆">{String(totalActors).padStart(2, "0")} ALLIES</GlyphText>
        </span>
        <span style={{ color: t4.mp }}>
          <GlyphText glyph="●">YOU</GlyphText>
        </span>
      </div>
    </T4Panel>
  );
}

function MapZoomControls({
  zoom,
  onZoomOut,
  onReset,
  onZoomIn,
}: {
  zoom: number;
  onZoomOut: () => void;
  onReset: () => void;
  onZoomIn: () => void;
}) {
  return (
    <div
      className="absolute right-3 top-[154px] z-30 flex items-center gap-1 sm:right-4"
      style={{
        border: `1px solid ${t4.line}`,
        background: "rgba(10,13,26,0.88)",
        boxShadow: `0 0 10px ${t4.mp}22`,
        padding: 4,
      }}
    >
      <ZoomButton onClick={onZoomOut} disabled={zoom <= STAGE_ZOOM_MIN}>
        -
      </ZoomButton>
      <button
        type="button"
        onClick={onReset}
        style={{
          minWidth: 54,
          height: 25,
          border: `1px solid ${t4.line}`,
          background: "transparent",
          color: t4.dim,
          cursor: "pointer",
          fontFamily: "var(--font-pixel)",
          fontSize: 7,
          letterSpacing: 1,
        }}
      >
        {Math.round(zoom * 100)}%
      </button>
      <ZoomButton onClick={onZoomIn} disabled={zoom >= STAGE_ZOOM_MAX}>
        +
      </ZoomButton>
    </div>
  );
}

function ZoomButton({
  children,
  disabled,
  onClick,
}: {
  children: ReactNode;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      style={{
        width: 25,
        height: 25,
        border: `1px solid ${disabled ? t4.line : t4.mp}`,
        background: disabled ? "rgba(255,255,255,0.03)" : "rgba(90,168,255,0.08)",
        color: disabled ? t4.dim : t4.mp,
        cursor: disabled ? "not-allowed" : "pointer",
        fontFamily: "var(--font-pixel)",
        fontSize: 10,
        lineHeight: 1,
      }}
    >
      {children}
    </button>
  );
}

function DialogueBox({
  actors,
  selectedActor,
  adminCount,
  onTalk,
  onTasks,
  onHire,
}: {
  actors: OfficeActor[];
  selectedActor: OfficeActor | null;
  adminCount: number;
  onTalk: (actor: OfficeActor) => void;
  onTasks: () => void;
  onHire: () => void;
}) {
  const featured =
    selectedActor ??
    actors.find((a) => a.kind === "agent" && a.status === "working") ??
    actors.find((a) => a.kind === "agent") ??
    actors[0] ??
    null;
  const isAgent = featured?.kind === "agent";
  const speaker = featured?.name ?? "GUIDE";
  const accent = featured ? (isAgent ? t4.agent : t4.pink) : t4.dim;
  const avatarKind: PixelAvatarKind = featured ? pickAvatarKind(featured.name, isAgent) : "agent";
  const line = featured
    ? isAgent
      ? `"I cloned the latest branch — ${actors.length} workspace members on deck, ${adminCount} admin online. Want me to triage the next quest?"`
      : `"${speaker} is ${STATUS_META[featured.status].label}. Wave hi or hand off a quest."`
    : `"No allies on the floor yet. Hire an agent or invite teammates from WORKSPACE."`;

  return (
    <div
      className="absolute inset-x-3 bottom-3 z-20 sm:inset-x-6 sm:bottom-4"
      style={{ pointerEvents: "none" }}
    >
      <T4Panel
        accent={accent}
        style={{
          position: "relative",
          padding: "14px 18px 14px 14px",
          display: "flex",
          gap: 14,
          alignItems: "flex-start",
          pointerEvents: "auto",
        }}
      >
        <div
          style={{
            flexShrink: 0,
            padding: 8,
            border: `1px solid ${accent}`,
            background: "rgba(0,0,0,0.4)",
            boxShadow: `0 0 10px ${accent}50`,
          }}
        >
          <PixelAvatar kind={avatarKind} size={3} />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{
              fontFamily: "var(--font-pixel)",
              fontSize: 9,
              color: accent,
              letterSpacing: 2,
              marginBottom: 6,
              textShadow: `0 0 8px ${accent}`,
            }}
          >
            <GlyphText glyph={isAgent ? "◇" : featured ? "●" : "★"} truncate>
              {speaker.toUpperCase()}
            </GlyphText>
          </div>
          <div
            style={{
              fontFamily: "var(--font-mono-arcade)",
              fontSize: 12,
              color: t4.ink,
              lineHeight: 1.55,
            }}
          >
            {line}
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            {featured ? (
              <DialogueChoice primary onClick={() => onTalk(featured)}>
                <GlyphText glyph="▶">TALK</GlyphText>
              </DialogueChoice>
            ) : null}
            <DialogueChoice onClick={onTasks}>QUESTS</DialogueChoice>
            <DialogueChoice onClick={onHire}>HIRE</DialogueChoice>
          </div>
        </div>
        <div
          style={{
            position: "absolute",
            right: 14,
            bottom: 8,
            fontFamily: "var(--font-pixel)",
            fontSize: 7,
            color: t4.dim,
            letterSpacing: 2,
          }}
        >
          <GlyphText glyph="▼">NEXT</GlyphText>
        </div>
      </T4Panel>
    </div>
  );
}

function DialogueChoice({
  children,
  primary,
  onClick,
}: {
  children: React.ReactNode;
  primary?: boolean;
  onClick?: () => void;
}) {
  const color = primary ? t4.pink : t4.dim;
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        fontFamily: "var(--font-pixel)",
        fontSize: 9,
        letterSpacing: 1,
        padding: "8px 12px",
        border: `1px solid ${primary ? t4.pink : t4.line}`,
        color,
        background: primary ? "rgba(255,122,220,0.08)" : "transparent",
        boxShadow: primary ? `0 0 10px ${t4.pink}40` : "none",
        cursor: "pointer",
      }}
    >
      {children}
    </button>
  );
}

function pickAvatarKind(name: string, agent = false): PixelAvatarKind {
  if (agent) return "agent";
  const kinds: PixelAvatarKind[] = ["mira", "alex", "kenji", "yuna", "diego", "iris"];
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0;
  return kinds[h % kinds.length];
}

function Skyline() {
  return (
    <div
      className="absolute inset-0"
      style={{
        backgroundImage:
          "linear-gradient(rgba(154,122,255,0.07) 1px, transparent 1px), linear-gradient(90deg, rgba(154,122,255,0.07) 1px, transparent 1px), radial-gradient(circle at 18% 14%, rgba(255,122,220,0.12), transparent 28%), radial-gradient(circle at 86% 18%, rgba(90,168,255,0.12), transparent 28%)",
        backgroundSize: "24px 24px, 24px 24px, 100% 100%, 100% 100%",
        pointerEvents: "none",
      }}
    />
  );
}

const OFFICE_DESK_CAPACITY = 9;
const STAGE_ZOOM_MIN = 0.75;
const STAGE_ZOOM_MAX = 1.5;
const STAGE_ZOOM_STEP = 0.125;
function clampStageZoom(value: number) {
  return Math.min(STAGE_ZOOM_MAX, Math.max(STAGE_ZOOM_MIN, Number(value.toFixed(3))));
}

function clampMiniMapValue(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function pct(value: number) {
  return `${Number(value.toFixed(2))}%`;
}

function getStageRooms(actorCount: number): StageRoomSpec[] {
  const growth = Math.max(0, actorCount - 5);
  const largeGrowth = Math.max(0, actorCount - 8);
  const engineeringWidth = Math.min(42, 30.5 + growth * 1.8);
  const engineeringHeight = Math.min(43, 37 + growth * 0.7);
  const huddleWidth = Math.min(27, 21.6 + largeGrowth * 1.2);
  const huddleLeft = Math.min(94 - huddleWidth, 5.5 + engineeringWidth + 2.2);
  const libraryWidth = Math.min(40, 32.8 + largeGrowth * 1.1);
  const loungeWidth = Math.min(24, 19.3 + largeGrowth * 0.8);

  return [
    {
      label: "♦ ENGINEERING",
      left: pct(5.5),
      top: pct(8.5),
      width: pct(engineeringWidth),
      height: pct(engineeringHeight),
      color: t4.pink,
      variant: "engineering",
    },
    {
      label: "♦ HUDDLE",
      left: pct(huddleLeft),
      top: pct(8.5),
      width: pct(huddleWidth),
      height: pct(Math.min(29, 24.5 + largeGrowth * 0.8)),
      color: t4.mp,
      variant: "huddle",
    },
    {
      label: "♦ LOUNGE",
      left: pct(5.5),
      top: pct(Math.min(52, 48 + growth * 0.35)),
      width: pct(loungeWidth),
      height: pct(Math.min(25, 21.5 + largeGrowth * 0.6)),
      color: t4.ok,
      variant: "lounge",
    },
    {
      label: "♦ LIBRARY · QUIET ZONE",
      left: pct(Math.min(30, 27 + growth * 0.35)),
      top: pct(Math.min(40, 36.5 + growth * 0.4)),
      width: pct(libraryWidth),
      height: pct(Math.min(38, 33.6 + largeGrowth * 0.8)),
      color: t4.xp,
      variant: "library",
    },
  ];
}

function getStageMiniMapRooms(rooms: StageRoomSpec[], agentCount: number): MiniMapRoom[] {
  return rooms.map((room) => ({
    color: room.color,
    label: room.label,
    x: room.left,
    y: room.top,
    w: room.width,
    h: room.height,
    count: room.variant === "engineering" ? agentCount : 0,
  }));
}

const STAGE_ACTOR_POSITIONS: StageActorPosition[] = [
  { left: "10.5%", top: "21%" },
  { left: "15.8%", top: "21%" },
  { left: "21.1%", top: "21%" },
  { left: "26.4%", top: "21%" },
  { left: "10.5%", top: "33.5%" },
  { left: "15.8%", top: "33.5%" },
  { left: "21.1%", top: "33.5%" },
  { left: "26.4%", top: "33.5%" },
  { left: "49.2%", top: "27%" },
  { left: "55.6%", top: "33%" },
  { left: "12.3%", top: "62.5%" },
  { left: "33.4%", top: "66.5%" },
  { left: "51.8%", top: "66.5%" },
];

function SettingsSelectModal({
  open,
  onClose,
  onSlack,
  onDiscord,
  onGithub,
  onOpenClaw,
}: {
  open: boolean;
  onClose: () => void;
  onSlack: () => void;
  onDiscord: () => void;
  onGithub: () => void;
  onOpenClaw: () => void;
}) {
  return (
    <Modal open={open} onClose={onClose} title="LINK 연결" size="md">
      <Modal.Body className="grid gap-3 sm:grid-cols-2">
        <SettingChoice
          icon={<Bell />}
          title="Slack"
          description="업무 결과와 알림을 Slack 채널로 보냅니다."
          accent={t4.pink}
          onClick={onSlack}
        />
        <SettingChoice
          icon={<MessageCircle />}
          title="Discord"
          description="Discord 채널 연동을 준비합니다."
          accent={t4.mp}
          onClick={onDiscord}
        />
        <SettingChoice
          icon={<GitBranch />}
          title="GitHub"
          description="Repository 작업을 위한 credential을 관리합니다."
          accent={t4.ok}
          onClick={onGithub}
        />
        <SettingChoice
          icon={<Bot />}
          title="AI / OpenClaw"
          description="OpenClaw Gateway와 Agent 실행 환경을 연결합니다."
          accent={t4.agent}
          onClick={onOpenClaw}
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
  accent,
  onClick,
  className = "",
}: {
  icon: ReactNode;
  title: string;
  description: string;
  accent: string;
  onClick: () => void;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex items-start gap-3 p-4 text-left transition-colors ${className}`}
      style={{
        border: `1px solid ${accent}`,
        background: "rgba(10,13,26,0.74)",
        boxShadow: `0 0 0 1px rgba(0,0,0,0.55), inset 0 0 18px ${accent}10, 0 0 10px ${accent}22`,
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.background = `${accent}12`;
        e.currentTarget.style.boxShadow = `0 0 0 1px rgba(0,0,0,0.55), inset 0 0 24px ${accent}18, 0 0 15px ${accent}38`;
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.background = "rgba(10,13,26,0.74)";
        e.currentTarget.style.boxShadow = `0 0 0 1px rgba(0,0,0,0.55), inset 0 0 18px ${accent}10, 0 0 10px ${accent}22`;
      }}
    >
      <span
        className="flex h-10 w-10 shrink-0 items-center justify-center"
        style={{
          border: `1px solid ${accent}`,
          color: accent,
          background: "rgba(0,0,0,0.35)",
          boxShadow: `0 0 8px ${accent}35`,
        }}
      >
        {icon}
      </span>
      <span className="min-w-0">
        <span
          className="block"
          style={{
            fontFamily: "var(--font-pixel)",
            fontSize: 9,
            letterSpacing: 1.5,
            color: accent,
            textShadow: `0 0 6px ${accent}70`,
          }}
        >
          {title.toUpperCase()}
        </span>
        <span
          className="mt-2 block"
          style={{
            fontFamily: "var(--font-mono-arcade)",
            fontSize: 11,
            lineHeight: 1.5,
            color: t4.dim,
          }}
        >
          {description}
        </span>
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
    <Modal open={open} onClose={onClose} title="QUESTS 태스크 진행 상황" size="full">
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
  const accent = taskGroupAccent(group.key);
  return (
    <div
      className="min-h-[420px] p-4"
      style={{
        border: `1px solid ${accent}`,
        background: "rgba(10,13,26,0.72)",
        boxShadow: `inset 0 0 22px ${accent}10, 0 0 12px ${accent}18`,
      }}
    >
      <div className="flex items-center justify-between gap-3">
        <h3
          style={{
            fontFamily: "var(--font-pixel)",
            fontSize: 10,
            letterSpacing: 2,
            color: accent,
            textShadow: `0 0 7px ${accent}70`,
            margin: 0,
          }}
        >
          {group.label}
        </h3>
        <span
          className="px-2 py-0.5"
          style={{
            border: `1px solid ${accent}`,
            color: accent,
            background: `${accent}12`,
            fontFamily: "var(--font-pixel)",
            fontSize: 8,
            letterSpacing: 1,
          }}
        >
          {tasks.length}
        </span>
      </div>
      <div className="mt-3 grid gap-2">
        {tasks.length > 0 ? (
          tasks.map((task) => (
            <div
              key={task.taskId}
              className="px-3 py-2"
              style={{
                border: `1px solid ${t4.line}`,
                background: "rgba(20,28,55,0.7)",
                boxShadow: "inset 0 0 12px rgba(154,122,255,0.05)",
              }}
            >
              <div className="flex items-start justify-between gap-2">
                <p
                  className="min-w-0"
                  style={{
                    fontFamily: "var(--font-mono-arcade)",
                    fontSize: 11,
                    color: t4.ink,
                    lineHeight: 1.45,
                    margin: 0,
                  }}
                >
                  {task.title}
                </p>
                <span
                  className="shrink-0 px-2 py-0.5"
                  style={{
                    border: `1px solid ${accent}`,
                    color: accent,
                    background: `${accent}12`,
                    fontFamily: "var(--font-pixel)",
                    fontSize: 7,
                    letterSpacing: 1,
                  }}
                >
                  {TASK_STATUS_META[task.status].label}
                </span>
              </div>
              {task.description && (
                <p
                  className="mt-2 line-clamp-2"
                  style={{
                    fontFamily: "var(--font-mono-arcade)",
                    fontSize: 10,
                    color: t4.dim,
                    lineHeight: 1.45,
                  }}
                >
                  {task.description}
                </p>
              )}
              <p
                className="mt-2"
                style={{
                  fontFamily: "var(--font-pixel)",
                  fontSize: 7,
                  letterSpacing: 1,
                  color: t4.dim,
                }}
              >
                {taskAssigneeName(task, actors)}
              </p>
            </div>
          ))
        ) : (
          <p
            className="px-3 py-2"
            style={{
              border: `1px solid ${t4.line}`,
              background: "rgba(20,28,55,0.48)",
              color: t4.dim,
              fontFamily: "var(--font-mono-arcade)",
              fontSize: 11,
            }}
          >
            태스크가 없습니다.
          </p>
        )}
      </div>
    </div>
  );
}

function taskGroupAccent(key: string) {
  if (key === "requested") return t4.dim;
  if (key === "assigned") return t4.mp;
  if (key === "progress") return t4.pink;
  return t4.ok;
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
