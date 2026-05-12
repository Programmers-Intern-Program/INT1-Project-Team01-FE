"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { use, useCallback, useEffect, useMemo, useRef, useState, type FormEvent, type PointerEvent, type ReactNode } from "react";
import {
  ArrowLeft,
  Bell,
  Bot,
  CheckCircle2,
  ChevronDown,
  FolderTree,
  GitBranch,
  KeyRound,
  ListChecks,
  LogOut,
  MessageCircle,
  Plug,
  Send,
  Settings,
  ShieldAlert,
  UserPlus,
  X,
} from "lucide-react";
import { Button, Input, Modal } from "@/components/ui";
import { GlyphText, T4Panel, PixelAvatar, type PixelAvatarKind } from "@/components/arcade";
import { t4 } from "@/components/arcade/tokens";
import {
  WorkspaceErrorState,
  WorkspaceLoadingState,
} from "@/components/workspace/WorkspaceShell";
import type { OfficeAgentState } from "@/game/office/EventBus";
import { API_BASE, getAccessToken, getStoredUser, type ApiError } from "@/lib/api-client";
import {
  deleteSlackIntegration,
  getSlackInstallUrl,
  listSlackIntegrations,
  type SlackIntegration,
} from "@/lib/api/integrations";
import {
  createGithubCredential,
  deleteGithubCredential,
  listGithubCredentials,
  type GithubCredentialInfo,
  updateGithubCredential,
} from "@/lib/api/github";
import {
  createGatewayBinding,
  type WorkspaceGatewayBinding,
  getWorkspaceGatewayStatus,
  testGatewayConnection,
  type WorkspaceGatewayStatus,
} from "@/lib/api/gateway";
import {
  getWorkspaceDashboardSummary,
  type DashboardRecentLog,
  type DashboardRecentReport,
  type WorkspaceDashboardSummary,
} from "@/lib/api/dashboard";
import {
  createAgent,
  deleteAgent,
  listAgents,
  type AgentSkillFile,
  type OpenClawAgent,
} from "@/lib/api/agents";
import {
  listChatSessionMessages,
  pollChatSessionMessages,
  sendChatMessage,
  type ChatMessageResponse,
} from "@/lib/api/chat";
import {
  getArtifactFile,
  getArtifactTree,
  getOrchestrationPlanArtifact,
  type ArtifactFileContent,
  type ArtifactNode,
  type ArtifactTree,
  type OrchestrationPlanArtifact,
} from "@/lib/api/artifacts";
import {
  getWorkspaceTask,
  listTaskReports,
  listWorkspaceTasks,
  type AgentReport,
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

type OfficeActor = OfficeAgentState & {
  activeTaskCount?: number;
  activeTaskTitle?: string;
  activeTaskStatus?: TaskStatus;
};

type AgentRole = "ORCHESTRATOR" | "BACKEND" | "FRONTEND" | "QA" | "CUSTOM";

interface HiredAgent {
  id: string;
  agentId?: number;
  name: string;
  role: AgentRole;
  openClawAgentId: string;
  workspacePath?: string;
  emoji?: string;
  status: OfficeActor["status"];
  apiStatus?: "CREATING" | "READY" | "SYNC_FAILED" | "ERROR" | "DISABLED";
  hiredAt: string;
}

interface AgentSkillFileDraft {
  id: string;
  fileName: string;
  content: string;
}

interface ChatMessage {
  id: string;
  from: "me" | "target" | "system";
  text: string;
  createdAt: string;
  messageApiId?: number;
  orchestrationPlanId?: number;
  taskId?: number;
}

interface OrchestrationRunState {
  chatSessionId?: number;
  planIds: number[];
  status?: TaskStatus;
}

interface ActiveTaskState {
  count: number;
  title: string;
  status: TaskStatus;
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

interface DashboardIssue {
  id: string;
  title: string;
  detail: string;
  color: string;
}

interface DashboardSummaryData {
  agents: {
    total: number;
    working: number;
    idle: number;
    blocked: number;
  };
  tasks: {
    total: number;
    requested: number;
    assigned: number;
    inProgress: number;
    waitingUser: number;
    completed: number;
    failed: number;
    canceled: number;
  };
  recentTasks: WorkspaceTask[];
  recentReports: DashboardReportItem[];
  recentLogs: DashboardLogItem[];
  issues: DashboardIssue[];
}

interface DashboardReportItem {
  id: string;
  taskId?: number;
  title: string;
  summary: string;
  detail?: string;
  status?: TaskStatus;
  createdAt?: string;
}

interface DashboardLogItem {
  id: string;
  level?: DashboardRecentLog["level"];
  message: string;
  createdAt?: string;
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
    key: "waiting",
    label: "대기",
    statuses: ["REQUESTED", "ASSIGNED"],
    className: "bg-surface-raised text-text-muted",
  },
  {
    key: "progress",
    label: "진행",
    statuses: ["IN_PROGRESS", "WAITING_USER"],
    className: "bg-working/15 text-working",
  },
  {
    key: "stopped",
    label: "중단",
    statuses: ["FAILED", "CANCELED"],
    className: "bg-danger/15 text-danger",
  },
  {
    key: "completed",
    label: "완료",
    statuses: ["COMPLETED"],
    className: "bg-success/15 text-success",
  },
];

const ACTIVE_AGENT_TASK_STATUSES: TaskStatus[] = [
  "REQUESTED",
  "ASSIGNED",
  "IN_PROGRESS",
  "WAITING_USER",
];
const TASK_POLL_INTERVAL_MS = 3000;

const AGENT_ROLE_OPTIONS: Array<{ value: AgentRole; label: string; description: string }> = [
  { value: "ORCHESTRATOR", label: "Orchestrator", description: "태스크 분해와 Agent 배정" },
  { value: "BACKEND", label: "Backend", description: "API, DB, server workdir 작업" },
  { value: "FRONTEND", label: "Frontend", description: "UI, 상태, 클라이언트 코드 작업" },
  { value: "QA", label: "QA", description: "테스트, 재현, 회귀 확인" },
  { value: "CUSTOM", label: "Custom", description: "사용자 정의 Agent 설정" },
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
  const [workspaceLeaveNotice, setWorkspaceLeaveNotice] = useState("");

  const [slackBusy, setSlackBusy] = useState(false);
  const [slackDeleting, setSlackDeleting] = useState(false);
  const [slackError, setSlackError] = useState("");
  const [slackNotice, setSlackNotice] = useState("");
  const [savedSlack, setSavedSlack] = useState<SlackIntegration | null>(() =>
    readStoredIntegration<SlackIntegration>(id, "slack"),
  );

  const [githubDisplayName, setGithubDisplayName] = useState("");
  const [githubToken, setGithubToken] = useState("");
  const [githubBusy, setGithubBusy] = useState(false);
  const [githubDeleting, setGithubDeleting] = useState(false);
  const [githubError, setGithubError] = useState("");
  const [githubNotice, setGithubNotice] = useState("");
  const [savedGithub, setSavedGithub] = useState<GithubCredentialInfo | null>(() =>
    readStoredIntegration<GithubCredentialInfo>(id, "github"),
  );

  const [gatewayUrl, setGatewayUrl] = useState("");
  const [gatewayToken, setGatewayToken] = useState("");
  const [gatewayBusy, setGatewayBusy] = useState(false);
  const [gatewayTesting, setGatewayTesting] = useState(false);
  const [gatewayError, setGatewayError] = useState("");
  const [gatewayNotice, setGatewayNotice] = useState("");
  const [savedGateway, setSavedGateway] = useState<WorkspaceGatewayStatus | null>(() =>
    readStoredGatewayStatus(id),
  );

  const [hiredAgents, setHiredAgents] = useState<HiredAgent[]>([]);
  const [agentName, setAgentName] = useState("");
  const [agentRole, setAgentRole] = useState<AgentRole>("BACKEND");
  const [agentWorkspacePath, setAgentWorkspacePath] = useState("");
  const [agentEmoji, setAgentEmoji] = useState("");
  const [agentSkillFiles, setAgentSkillFiles] = useState<AgentSkillFileDraft[]>([]);
  const [agentHireError, setAgentHireError] = useState("");
  const [agentHireBusy, setAgentHireBusy] = useState(false);
  const [agentDismissBusyId, setAgentDismissBusyId] = useState<number | null>(null);
  const [agentDismissError, setAgentDismissError] = useState("");
  const [actorMenu, setActorMenu] = useState<ActorContextMenu | null>(null);
  const [selectedActorId, setSelectedActorId] = useState<string | null>(null);
  const [stageZoom, setStageZoom] = useState(1);
  const [stagePan, setStagePan] = useState<StagePan>({ x: 0, y: 0 });
  const [stageSize, setStageSize] = useState<StageSize>({ width: 1, height: 1 });
  const [playerPositionOverride, setPlayerPositionOverride] = useState<{
    workspaceId: number;
    actorId: string;
    position: StageActorPosition;
  } | null>(null);
  const [chatTarget, setChatTarget] = useState<OfficeActor | null>(null);
  const [chatInitialTab, setChatInitialTab] = useState<"chat" | "tasks">("chat");
  const [chatInput, setChatInput] = useState("");
  const [chatMessages, setChatMessages] = useState<Record<string, ChatMessage[]>>({});
  const [chatSessionIds, setChatSessionIds] = useState<Record<string, number>>({});
  const [chatLastMessageIds, setChatLastMessageIds] = useState<Record<string, number>>({});
  const [orchestrationRuns, setOrchestrationRuns] = useState<Record<string, OrchestrationRunState>>({});
  const [chatSending, setChatSending] = useState(false);
  const [chatPollError, setChatPollError] = useState("");
  const [planView, setPlanView] = useState<{ planId: number } | null>(null);
  const [artifactView, setArtifactView] = useState<{ path: string; name?: string } | null>(null);
  const [filesOpen, setFilesOpen] = useState(false);
  const [tasks, setTasks] = useState<WorkspaceTask[]>([]);
  const [tasksError, setTasksError] = useState("");

  const refreshTasks = useCallback(async () => {
    try {
      const nextTasks = await listWorkspaceTasks(id);
      setTasks(nextTasks);
      setTasksError("");
    } catch (err) {
      const apiErr = err as ApiError;
      setTasksError(apiErr?.message ?? "태스크 목록을 불러오지 못했습니다.");
    }
  }, [id]);

  const refreshAgents = useCallback(async () => {
    try {
      const nextAgents = await listAgents(id);
      const mappedAgents = nextAgents.map(toHiredAgent);
      setHiredAgents(mappedAgents);
      writeHiredAgents(id, mappedAgents);
    } catch {
      // The current backend Swagger only documents agent creation. Keep local cache
      // until a shared list endpoint is available.
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
        const [workspace, members, initialTasks, initialAgents] = await Promise.all([
          getWorkspace(id),
          listWorkspaceMembers(id),
          listWorkspaceTasks(id).catch(() => []),
          listAgents(id).catch(() => readHiredAgents(id)),
        ]);
        if (!cancelled) {
          const nextAgents = initialAgents.map(toHiredAgent);
          setHiredAgents(nextAgents);
          writeHiredAgents(id, nextAgents);
          setChatSessionIds(readChatSessionIds(id));
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

  useEffect(() => {
    if (state.kind !== "ready") return;
    let cancelled = false;
    let inFlight = false;

    async function pollWorkspaceState() {
      if (inFlight) return;
      inFlight = true;
      try {
        const [nextTasks, nextAgents] = await Promise.all([
          listWorkspaceTasks(id),
          listAgents(id).catch(() => null),
        ]);
        if (!cancelled) {
          setTasks(nextTasks);
          if (nextAgents) {
            const mappedAgents = nextAgents.map(toHiredAgent);
            setHiredAgents(mappedAgents);
            writeHiredAgents(id, mappedAgents);
          }
          setTasksError("");
        }
      } catch (err) {
        if (!cancelled) {
          const apiErr = err as ApiError;
          setTasksError(apiErr?.message ?? "태스크 목록을 불러오지 못했습니다.");
        }
      } finally {
        inFlight = false;
      }
    }

    const timer = window.setInterval(pollWorkspaceState, TASK_POLL_INTERVAL_MS);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [id, state.kind]);

  useEffect(() => {
    if (!chatTarget || chatTarget.kind !== "agent") return;
    const actor = chatTarget;
    const key = chatKey(actor);
    const chatSessionId = chatSessionIds[key];
    if (!chatSessionId) return;

    let cancelled = false;
    let cursor = chatLastMessageIds[key];
    let bootstrapped = cursor != null;

    async function pollMessages() {
      try {
        if (!bootstrapped) {
          const initial = await listChatSessionMessages(id, chatSessionId);
          if (cancelled) return;
          const planIds = collectOrchestrationPlanIds(initial);
          if (planIds.length > 0) {
            setOrchestrationRuns((prev) =>
              mergeOrchestrationRun(prev, key, {
                chatSessionId,
                planIds,
                status: inferOrchestrationRunStatus(initial),
              }),
            );
          }
          setChatMessages((prev) => mergeServerChatMessages(prev, actor, initial, "replace"));
          const latest = pickLatestMessageId(initial);
          if (latest != null) {
            cursor = latest;
            setChatLastMessageIds((prev) => ({ ...prev, [key]: latest }));
          }
          bootstrapped = true;
          setChatPollError("");
          return;
        }

        let afterMessageId = cursor;
        for (let i = 0; i < 5; i += 1) {
          const page = await pollChatSessionMessages(id, chatSessionId, {
            afterMessageId,
            limit: 50,
          });
          if (cancelled) return;
          if (page.messages.length > 0) {
            const planIds = collectOrchestrationPlanIds(page.messages);
            if (planIds.length > 0) {
              setOrchestrationRuns((prev) =>
                mergeOrchestrationRun(prev, key, {
                  chatSessionId,
                  planIds,
                  status: inferOrchestrationRunStatus(page.messages),
                }),
              );
            }
            setChatMessages((prev) =>
              mergeServerChatMessages(prev, actor, page.messages, "append"),
            );
          }
          const latest = pickLatestMessageId(page.messages) ?? page.nextCursor ?? afterMessageId;
          if (latest != null && latest !== afterMessageId) {
            afterMessageId = latest;
            cursor = latest;
            setChatLastMessageIds((prev) =>
              prev[key] === latest ? prev : { ...prev, [key]: latest },
            );
          }
          if (!page.hasMore) break;
        }
        setChatPollError("");
      } catch (err) {
        if (cancelled) return;
        const apiErr = err as ApiError;
        setChatPollError(apiErr?.message ?? "Agent 메시지를 불러오지 못했습니다.");
      }
    }

    pollMessages();
    const timer = window.setInterval(pollMessages, 3000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [chatTarget, chatSessionIds, chatLastMessageIds, id]);

  useEffect(() => {
    if (!slackOpen) return;
    let cancelled = false;
    queueMicrotask(() => {
      if (cancelled) return;
      setSlackBusy(true);
      setSlackError("");
    });
    listSlackIntegrations(id)
      .then((integrations) => {
        if (cancelled) return;
        const next = integrations[0] ?? null;
        setSavedSlack(next);
        if (next) {
          writeStoredIntegration(id, "slack", next);
        }
      })
      .catch((err) => {
        if (cancelled) return;
        const apiErr = err as ApiError;
        setSlackError(apiErr?.message ?? "Slack 연동 정보 조회에 실패했습니다.");
      })
      .finally(() => {
        if (!cancelled) setSlackBusy(false);
      });
    return () => {
      cancelled = true;
    };
  }, [id, slackOpen]);

  useEffect(() => {
    if (!githubOpen) return;
    let cancelled = false;
    queueMicrotask(() => {
      if (cancelled) return;
      setGithubBusy(true);
      setGithubError("");
    });
    listGithubCredentials(id)
      .then((credentials) => {
        if (cancelled) return;
        const next = credentials[0] ?? null;
        setSavedGithub(next);
        if (next) {
          setGithubDisplayName(next.displayName);
          writeStoredIntegration(id, "github", next);
        }
      })
      .catch((err) => {
        if (cancelled) return;
        const apiErr = err as ApiError;
        setGithubError(apiErr?.message ?? "GitHub 연결 정보 조회에 실패했습니다.");
      })
      .finally(() => {
        if (!cancelled) setGithubBusy(false);
      });
    return () => {
      cancelled = true;
    };
  }, [githubOpen, id]);

  useEffect(() => {
    if (!openClawOpen) return;
    let cancelled = false;
    queueMicrotask(() => {
      if (cancelled) return;
      setGatewayBusy(true);
      setGatewayError("");
    });
    getWorkspaceGatewayStatus(id)
      .then((status) => {
        if (cancelled) return;
        const next = normalizeGatewayStatus(status);
        setSavedGateway(next);
        if (next.bound) {
          writeStoredIntegration(id, "openclaw", next);
          if (next.gatewayUrl) setGatewayUrl(next.gatewayUrl);
        } else {
          deleteStoredIntegration(id, "openclaw");
        }
      })
      .catch((err) => {
        if (cancelled) return;
        const apiErr = err as ApiError;
        const stored = readStoredGatewayStatus(id);
        setSavedGateway(stored);
        setGatewayError(apiErr?.message ?? "OpenClaw Gateway 조회에 실패했습니다.");
      })
      .finally(() => {
        if (!cancelled) setGatewayBusy(false);
      });
    return () => {
      cancelled = true;
    };
  }, [id, openClawOpen]);

  const storedUser = getStoredUser();
  const storedMemberId = storedUser?.memberId;
  const playerActorId = storedMemberId != null ? `member:${storedMemberId}` : null;
  const {
    onlineMemberIds,
    remoteMemberPositions,
    sendPosition: sendPresencePosition,
  } = useWorkspacePresence(id, storedMemberId);
  const defaultPlayerPosition = useMemo(() => {
    if (state.kind !== "ready" || storedMemberId == null) return null;
    const memberIndex = state.members.findIndex((member) => member.memberId === storedMemberId);
    return memberIndex >= 0 ? MEMBER_POSITIONS[memberIndex % MEMBER_POSITIONS.length] : null;
  }, [state, storedMemberId]);

  const playerPosition =
    playerPositionOverride?.workspaceId === id && playerPositionOverride.actorId === playerActorId
      ? playerPositionOverride.position
      : defaultPlayerPosition;
  const handlePlayerPositionChange = useCallback(
    (position: StageActorPosition) => {
      if (!playerActorId) return;
      setPlayerPositionOverride({ workspaceId: id, actorId: playerActorId, position });
      sendPresencePosition(position, "walking");
    },
    [id, playerActorId, sendPresencePosition],
  );

  const chatTargetAgentId =
    chatTarget && chatTarget.kind === "agent" ? agentIdFromActor(chatTarget) : null;
  const actors = useMemo(() => {
    if (state.kind !== "ready") return [];
    const agentActors = hiredAgents
      .filter((agent) => agent.apiStatus !== "ERROR" && agent.apiStatus !== "SYNC_FAILED")
      .map<OfficeActor>((agent, index) => {
        const agentId = agent.agentId ?? Number(agent.id);
        const agentActorKey = chatKey({ id: `agent:${agent.id}`, kind: "agent" } as OfficeActor);
        const ownTaskState = getAgentTaskState(tasks, agentId);
        const orchestratorSessionId =
          agent.role === "ORCHESTRATOR"
            ? chatSessionIds[agentActorKey]
            : undefined;
        const orchestrationRun =
          agent.role === "ORCHESTRATOR" ? orchestrationRuns[agentActorKey] : undefined;
        const orchestratorState =
          agent.role === "ORCHESTRATOR"
            ? getOrchestratorTaskState(tasks, agentId, {
              chatSessionId: orchestrationRun?.chatSessionId ?? orchestratorSessionId,
              planIds: orchestrationRun?.planIds ?? [],
              status: orchestrationRun?.status,
            })
            : null;
        const isProcessingChat =
          chatSending && chatTargetAgentId != null && chatTargetAgentId === agentId;
        const processingState = isProcessingChat
          ? {
              count: 1,
              title:
                agent.role === "ORCHESTRATOR" ? "PLAN 작성 중..." : "응답 생성 중...",
              status: "IN_PROGRESS" as TaskStatus,
            }
          : null;
        const taskState =
          agent.role === "ORCHESTRATOR"
            ? processingState ?? orchestratorState ?? ownTaskState
            : processingState ?? ownTaskState;
        return {
          id: `agent:${agent.id}`,
          name: agent.name,
          role: agent.role,
          status: taskState ? statusFromTaskStatus(taskState.status) : agent.status,
          desk: index,
          kind: "agent",
          activeTaskCount: taskState?.count,
          activeTaskTitle: taskState?.title,
          activeTaskStatus: taskState?.status,
        };
      });
    const visibleMembers = onlineMemberIds
      ? state.members.filter(
          (member) => onlineMemberIds.has(member.memberId) || member.memberId === storedMemberId,
        )
      : state.members;
    const memberActors = visibleMembers.map<OfficeActor>((member, index) => ({
      id: `member:${member.memberId}`,
      name: member.name,
      role: member.role,
      status: pickStatus(index, member.role),
      desk: agentActors.length + index,
      kind: "member",
    }));
    return [...agentActors, ...memberActors];
  }, [
    hiredAgents,
    state,
    tasks,
    chatSending,
    chatTargetAgentId,
    chatSessionIds,
    orchestrationRuns,
    onlineMemberIds,
    storedMemberId,
  ]);

  const selectedActor = useMemo(
    () => actors.find((actor) => String(actor.id) === selectedActorId) ?? null,
    [actors, selectedActorId],
  );
  const agentCount = actors.filter((actor) => actor.kind === "agent").length;
  const engineeringRows = getEngineeringRows(agentCount);
  const stageRooms = useMemo(
    () => getStageRooms(engineeringRows),
    [engineeringRows],
  );

  if (state.kind === "loading") return <WorkspaceLoadingState />;
  if (state.kind === "error") return <WorkspaceErrorState message={state.message} />;

  const workingCount = actors.filter((actor) => actor.status === "working").length;
  const adminCount = state.members.filter((member) => member.role === "ADMIN").length;
  const isAdmin = state.workspace.myRole === "ADMIN";
  const myMiniMapPosition = playerPosition ?? defaultPlayerPosition;

  function handleWorkspaceLeavePlaceholder() {
    setWorkspaceLeaveNotice("워크스페이스 나가기 API가 준비되면 연결됩니다.");
  }

  async function handleSlackInstall() {
    if (!isAdmin) {
      setSlackError("Slack 연동은 워크스페이스 ADMIN만 시작할 수 있습니다.");
      return;
    }

    setSlackBusy(true);
    setSlackError("");
    setSlackNotice("");
    try {
      const url = await getSlackInstallUrl(id);
      if (typeof window !== "undefined") {
        window.localStorage.setItem("aio.slack.pendingWorkspaceId", String(id));
        window.localStorage.setItem("aio.slack.returnTo", `/workspaces/${id}`);
        window.location.href = url;
      }
    } catch (err) {
      const apiErr = err as ApiError;
      setSlackError(apiErr?.message ?? "Slack 설치 URL을 가져오지 못했습니다.");
      setSlackBusy(false);
    }
  }

  async function handleSlackDelete() {
    if (!savedSlack) return;
    setSlackDeleting(true);
    setSlackError("");
    setSlackNotice("");
    try {
      await deleteSlackIntegration(id, savedSlack.id);
      deleteStoredIntegration(id, "slack");
      setSavedSlack(null);
      setSlackNotice("Slack 연동 정보를 삭제했습니다.");
    } catch (err) {
      const apiErr = err as ApiError;
      setSlackError(apiErr?.message ?? "Slack 연동 정보 삭제에 실패했습니다.");
    } finally {
      setSlackDeleting(false);
    }
  }

  async function handleHireAgent(e: FormEvent) {
    e.preventDefault();
    const trimmedName = agentName.trim();
    if (!trimmedName) {
      setAgentHireError("Agent 이름을 입력하세요.");
      return;
    }

    setAgentHireBusy(true);
    setAgentHireError("");
    try {
      const trimmedPath = agentWorkspacePath.trim();
      const trimmedEmoji = agentEmoji.trim();
      const skillFiles = normalizeAgentSkillFiles(agentSkillFiles);
      if (!skillFiles) {
        setAgentHireError("Skill 파일은 파일명과 내용을 모두 입력해야 합니다.");
        return;
      }
      const res = await createAgent(id, {
        name: trimmedName,
        category: agentRoleToCategory(agentRole),
        skillFiles,
        ...(trimmedPath ? { workspacePath: trimmedPath } : {}),
        ...(trimmedEmoji ? { emoji: trimmedEmoji } : {}),
      });
      if (res.status === "ERROR" || res.status === "SYNC_FAILED") {
        setAgentHireError(
          res.syncError
            ? `Agent 생성에 실패했습니다: ${res.syncError}`
            : "Agent 생성에 실패했습니다. (OpenClaw 연결 확인이 필요합니다)",
        );
        return;
      }
      const nextAgent: HiredAgent = {
        ...toHiredAgent(res),
        role: agentRole,
        emoji: trimmedEmoji || undefined,
        hiredAt: new Date().toISOString(),
      };
      const nextAgents = [nextAgent, ...hiredAgents].slice(0, 10);
      setHiredAgents(nextAgents);
      writeHiredAgents(id, nextAgents);
      void refreshAgents();
      setAgentName("");
      setAgentWorkspacePath("");
      setAgentEmoji("");
      setAgentSkillFiles([]);
      setAgentRole("BACKEND");
      setAgentHireOpen(false);
    } catch (err) {
      const apiErr = err as ApiError;
      setAgentHireError(apiErr?.message ?? "Agent 생성에 실패했습니다.");
    } finally {
      setAgentHireBusy(false);
    }
  }

  function addAgentSkillFile() {
    setAgentSkillFiles((prev) => [
      ...prev,
      { id: `skill:${Date.now()}:${prev.length}`, fileName: "", content: "" },
    ]);
  }

  function updateAgentSkillFile(
    skillFileId: string,
    field: "fileName" | "content",
    value: string,
  ) {
    setAgentSkillFiles((prev) =>
      prev.map((skillFile) =>
        skillFile.id === skillFileId ? { ...skillFile, [field]: value } : skillFile,
      ),
    );
  }

  function removeAgentSkillFile(skillFileId: string) {
    setAgentSkillFiles((prev) => prev.filter((skillFile) => skillFile.id !== skillFileId));
  }

  async function handleGithubSubmit(e: FormEvent) {
    e.preventDefault();
    const editing = Boolean(savedGithub);
    if (!githubDisplayName.trim() || (!editing && !githubToken.trim())) {
      setGithubError(
        editing
          ? "Display Name은 필수입니다."
          : "Display Name과 Personal Access Token은 필수입니다.",
      );
      return;
    }
    setGithubBusy(true);
    setGithubError("");
    setGithubNotice("");
    try {
      const res = editing && savedGithub
        ? await updateGithubCredential(id, savedGithub.id, {
            displayName: githubDisplayName.trim(),
            ...(githubToken.trim() ? { token: githubToken.trim() } : {}),
          })
        : await createGithubCredential(id, {
            displayName: githubDisplayName.trim(),
            token: githubToken.trim(),
          });
      setSavedGithub(res);
      writeStoredIntegration(id, "github", res);
      setGithubNotice(editing ? "GitHub 연결 정보를 수정했습니다." : "GitHub 연결 정보를 저장했습니다.");
      setGithubToken("");
    } catch (err) {
      const apiErr = err as ApiError;
      setGithubError(apiErr?.message ?? "GitHub 연결 저장에 실패했습니다.");
    } finally {
      setGithubBusy(false);
    }
  }

  async function handleGithubDelete() {
    if (!savedGithub) return;
    setGithubDeleting(true);
    setGithubError("");
    setGithubNotice("");
    try {
      await deleteGithubCredential(id, savedGithub.id);
      deleteStoredIntegration(id, "github");
      setSavedGithub(null);
      setGithubNotice("GitHub 연결 정보를 삭제했습니다.");
    } catch (err) {
      const apiErr = err as ApiError;
      setGithubError(apiErr?.message ?? "GitHub 연결 정보 삭제에 실패했습니다.");
    } finally {
      setGithubDeleting(false);
    }
  }

  async function handleGatewaySubmit(e: FormEvent) {
    e.preventDefault();
    if (!gatewayUrl.trim() || !gatewayToken.trim()) {
      setGatewayError("Gateway URL과 토큰은 필수입니다.");
      return;
    }
    setGatewayBusy(true);
    setGatewayError("");
    setGatewayNotice("");
    const payload = {
      gatewayUrl: gatewayUrl.trim(),
      token: gatewayToken.trim(),
      validateConnection: true,
    };
    try {
      const res = await createGatewayBinding(id, payload);
      let next = gatewayBindingToStatus(res);
      try {
        next = normalizeGatewayStatus(await getWorkspaceGatewayStatus(id));
      } catch {
        // Keep the binding response visible even if the follow-up status call fails.
      }
      setSavedGateway(next);
      writeStoredIntegration(id, "openclaw", next);
      setGatewayNotice("OpenClaw Gateway 정보를 저장했습니다.");
      setGatewayToken("");
    } catch (err) {
      const apiErr = err as ApiError;
      setGatewayError(apiErr?.message ?? "OpenClaw Gateway 저장에 실패했습니다.");
    } finally {
      setGatewayBusy(false);
    }
  }

  async function handleGatewayTest() {
    if (!gatewayUrl.trim() || !gatewayToken.trim()) {
      setGatewayError("Gateway URL과 토큰을 입력한 뒤 테스트하세요.");
      return;
    }

    setGatewayTesting(true);
    setGatewayError("");
    setGatewayNotice("");
    try {
      const result = await testGatewayConnection(id, {
        gatewayUrl: gatewayUrl.trim(),
        token: gatewayToken.trim(),
      });
      if (result.connected) {
        setGatewayNotice(`${result.message} Agent ${result.agentCount}개를 확인했습니다.`);
      } else {
        setGatewayError(result.message || gatewayConnectionStatusLabel(result.status));
      }
    } catch (err) {
      const apiErr = err as ApiError;
      setGatewayError(apiErr?.message ?? "OpenClaw Gateway 연결 테스트에 실패했습니다.");
    } finally {
      setGatewayTesting(false);
    }
  }

  function openActorChat(actor: OfficeActor, tab: "chat" | "tasks" = "chat") {
    setActorMenu(null);
    setChatTarget(actor);
    setChatInitialTab(actor.kind === "agent" ? tab : "chat");
    setChatPollError("");
    setChatMessages((prev) => {
      const key = chatKey(actor);
      if (prev[key]) return prev;
      return {
        ...prev,
        [key]: [createOpenChatMessage(actor)],
      };
    });
  }

  function openFeaturedAgentTasks() {
    const featuredAgent = getFeaturedAgent(actors, selectedActor);
    if (featuredAgent) {
      openActorChat(featuredAgent, "tasks");
    }
  }

  async function dismissFeaturedAgent(actor: OfficeActor | null) {
    if (!actor || actor.kind !== "agent") return;
    const dismissedAgentId = agentIdFromActor(actor);
    if (!dismissedAgentId) return;

    setAgentDismissBusyId(dismissedAgentId);
    setAgentDismissError("");
    try {
      await deleteAgent(id, dismissedAgentId);

      setHiredAgents((prev) => {
        const nextAgents = prev.filter(
          (agent) => Number(agent.agentId ?? agent.id) !== dismissedAgentId,
        );
        writeHiredAgents(id, nextAgents);
        return nextAgents;
      });

      if (selectedActorId === String(actor.id)) {
        setSelectedActorId(null);
      }
      if (chatTarget && chatKey(chatTarget) === chatKey(actor)) {
        setChatTarget(null);
        setChatInput("");
        setChatPollError("");
      }
      void refreshAgents();
    } catch (err) {
      const apiErr = err as ApiError;
      setAgentDismissError(apiErr?.message ?? "Agent 삭제에 실패했습니다.");
    } finally {
      setAgentDismissBusyId(null);
    }
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

    if (chatTarget.kind === "agent") {
      const agentId = agentIdFromActor(chatTarget);
      if (!agentId) {
        appendChat(chatTarget, {
          id: createLocalId(),
          from: "system",
          text: "Agent ID를 확인할 수 없습니다.",
          createdAt: new Date().toISOString(),
        });
        return;
      }

      setChatSending(true);
      setChatPollError("");
      try {
        const key = chatKey(chatTarget);
        const chatSessionId = chatSessionIds[key];
        const res = await sendChatMessage(id, {
          agentId,
          message,
          ...(chatSessionId ? { chatSessionId } : {}),
        });
        const planIds = collectOrchestrationPlanIds(res.messages, res.orchestrationPlanId);
        if (planIds.length > 0) {
          setOrchestrationRuns((prev) =>
            mergeOrchestrationRun(prev, key, {
              chatSessionId: res.chatSessionId,
              planIds,
              status: inferOrchestrationRunStatus(res.messages),
            }),
          );
        }
        if (res.chatSessionId) {
          setChatSessionIds((prev) => {
            const next = { ...prev, [key]: res.chatSessionId };
            writeChatSessionIds(id, next);
            return next;
          });
        }
        setChatMessages((prev) => {
          const current = prev[key] ?? [];
          const pruned = current.filter(
            (item) => !(item.from === "me" && item.messageApiId == null),
          );
          const prevWithoutPending =
            pruned.length === current.length ? prev : { ...prev, [key]: pruned };
          if (!res.messages?.length) return prevWithoutPending;
          return mergeServerChatMessages(
            prevWithoutPending,
            chatTarget,
            res.messages ?? [],
            "append",
          );
        });
        if (res.messages?.length) {
          const latest = pickLatestMessageId(res.messages);
          if (latest != null) {
            setChatLastMessageIds((prev) =>
              prev[key] === latest ? prev : { ...prev, [key]: latest },
            );
          }
        }
        await refreshTasks();
      } catch (err) {
        const apiErr = err as ApiError;
        appendChat(chatTarget, {
          id: createLocalId(),
          from: "system",
          text: apiErr?.message ?? "Agent 메시지 전송에 실패했습니다.",
          createdAt: new Date().toISOString(),
        });
      } finally {
        setChatSending(false);
      }
      return;
    }

    appendChat(chatTarget, {
      id: createLocalId(),
      from: "system",
      text: "현재 유저 채팅은 화면 내 대화로 표시됩니다.",
      createdAt: new Date().toISOString(),
    });
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
        isAdmin={isAdmin}
        leaveNotice={workspaceLeaveNotice}
        onConnections={() => setSettingsOpen(true)}
        onTasks={() => setTasksOpen(true)}
        onHireAgent={() => setAgentHireOpen(true)}
        onFiles={() => setFilesOpen(true)}
        onLeaveWorkspace={handleWorkspaceLeavePlaceholder}
      />

      <section className="relative flex-1 overflow-hidden">
        <Skyline />

        <ArcadeOfficeStage
          actors={actors}
          rooms={stageRooms}
          engineeringRows={engineeringRows}
          selectedActorId={selectedActorId}
          playerActorId={playerActorId}
          playerPosition={playerPosition}
          remoteMemberPositions={remoteMemberPositions}
          zoom={stageZoom}
          pan={stagePan}
          onPanChange={setStagePan}
          onPlayerPositionChange={handlePlayerPositionChange}
          onOpenTasks={() => setTasksOpen(true)}
          onOpenChatWithActor={(actor) => openActorChat(actor, "chat")}
          onSizeChange={setStageSize}
          onActorSelect={(actor) => {
            setSelectedActorId(String(actor.id));
            setActorMenu(null);
          }}
          onActorContextMenu={({ actor, x, y }) => setActorMenu({ actor, x, y })}
        />

        <HeroHud
          name={storedUser?.name ?? "HERO"}
          memberCount={state.members.length}
          workingCount={workingCount}
        />
        <MapHud
          rooms={getStageMiniMapRooms(stageRooms)}
          myPosition={myMiniMapPosition}
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
          key={chatTarget ? `${chatKey(chatTarget)}:${chatInitialTab}` : "chat-panel-empty"}
          open={Boolean(chatTarget)}
          target={chatTarget}
          workspaceId={id}
          initialTab={chatInitialTab}
          messages={chatTarget ? chatMessages[chatKey(chatTarget)] ?? [] : []}
          agentTasks={chatTarget ? tasksForActor(tasks, chatTarget) : []}
          input={chatInput}
          onInputChange={setChatInput}
          sending={chatSending}
          pollError={chatPollError}
          onSubmitMessage={handleSendChatMessage}
          onOpenPlan={(planId) => setPlanView({ planId })}
          onClose={() => {
            setChatTarget(null);
            setChatInput("");
            setChatPollError("");
          }}
        />

        <DialogueBox
          actors={actors}
          selectedActor={selectedActor}
          adminCount={adminCount}
          onTalk={openActorChat}
          onTasks={openFeaturedAgentTasks}
          onDismissAgent={dismissFeaturedAgent}
          dismissBusyId={agentDismissBusyId}
          dismissError={agentDismissError}
        />
      </section>

      <OrchestrationPlanModal
        open={planView != null}
        workspaceId={id}
        planId={planView?.planId ?? null}
        onClose={() => setPlanView(null)}
        onOpenFile={(file) => setArtifactView({ path: file.path, name: file.name })}
      />
      <WorkspaceFilesModal
        open={filesOpen}
        workspaceId={id}
        onClose={() => setFilesOpen(false)}
        onOpenFile={(file) => setArtifactView({ path: file.path, name: file.name })}
      />
      <ArtifactFileModal
        open={artifactView != null}
        workspaceId={id}
        path={artifactView?.path ?? null}
        nameHint={artifactView?.name}
        onClose={() => setArtifactView(null)}
      />

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
        workspaceId={id}
        actors={actors}
        tasks={tasks}
        error={tasksError}
      />
      <AgentHireModal
        open={agentHireOpen}
        onClose={() => setAgentHireOpen(false)}
        name={agentName}
        onNameChange={setAgentName}
        role={agentRole}
        onRoleChange={setAgentRole}
        workspacePath={agentWorkspacePath}
        onWorkspacePathChange={setAgentWorkspacePath}
        emoji={agentEmoji}
        onEmojiChange={setAgentEmoji}
        skillFiles={agentSkillFiles}
        onSkillFileAdd={addAgentSkillFile}
        onSkillFileChange={updateAgentSkillFile}
        onSkillFileRemove={removeAgentSkillFile}
        error={agentHireError}
        submitting={agentHireBusy}
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
        saved={savedSlack}
        error={slackError}
        notice={slackNotice}
        submitting={slackBusy}
        deleting={slackDeleting}
        onInstall={handleSlackInstall}
        onDelete={handleSlackDelete}
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
        isAdmin={isAdmin}
        displayName={githubDisplayName}
        onDisplayNameChange={setGithubDisplayName}
        token={githubToken}
        onTokenChange={setGithubToken}
        saved={savedGithub}
        error={githubError}
        notice={githubNotice}
        submitting={githubBusy}
        deleting={githubDeleting}
        onSubmit={handleGithubSubmit}
        onDelete={handleGithubDelete}
      />
      <OpenClawIntegrationModal
        open={openClawOpen}
        onClose={() => setOpenClawOpen(false)}
        onBack={() => {
          setOpenClawOpen(false);
          setSettingsOpen(true);
        }}
        gatewayUrl={gatewayUrl}
        onGatewayUrlChange={setGatewayUrl}
        token={gatewayToken}
        onTokenChange={setGatewayToken}
        saved={savedGateway}
        error={gatewayError}
        notice={gatewayNotice}
        submitting={gatewayBusy}
        testing={gatewayTesting}
        onSubmit={handleGatewaySubmit}
        onTest={handleGatewayTest}
      />
    </main>
  );
}

function GameTopNav({
  workspace,
  isAdmin,
  leaveNotice,
  onConnections,
  onTasks,
  onHireAgent,
  onFiles,
  onLeaveWorkspace,
}: {
  workspace: WorkspaceDetail;
  isAdmin: boolean;
  leaveNotice: string;
  onConnections: () => void;
  onTasks: () => void;
  onHireAgent: () => void;
  onFiles: () => void;
  onLeaveWorkspace: () => void;
}) {
  const [workspaceMenuOpen, setWorkspaceMenuOpen] = useState(false);

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

      <nav className="flex shrink-0 items-center gap-2 overflow-visible">
        <ArcadeNavButton color={t4.pink} primary onClick={onHireAgent} icon={<Bot className="h-3.5 w-3.5" />}>
          AGENT
        </ArcadeNavButton>
        <ArcadeNavButton color={t4.mp} onClick={onConnections} icon={<Plug className="h-3.5 w-3.5" />}>
          LINK
        </ArcadeNavButton>
        <div className="relative">
          <ArcadeNavButton
            color={t4.agent}
            onClick={() => setWorkspaceMenuOpen((open) => !open)}
            icon={<Settings className="h-3.5 w-3.5" />}
            trailingIcon={<ChevronDown className="h-3 w-3" />}
          >
            WORKSPACE
          </ArcadeNavButton>
          {workspaceMenuOpen && (
            <WorkspaceActionMenu
              workspaceId={workspace.workspaceId}
              isAdmin={isAdmin}
              leaveNotice={leaveNotice}
              onClose={() => setWorkspaceMenuOpen(false)}
              onLeaveWorkspace={onLeaveWorkspace}
            />
          )}
        </div>
        <ArcadeNavButton color={t4.xp} onClick={onTasks} icon={<ListChecks className="h-3.5 w-3.5" />}>
          QUESTS
        </ArcadeNavButton>
        <ArcadeNavButton color={t4.ok} onClick={onFiles} icon={<FolderTree className="h-3.5 w-3.5" />}>
          FILES
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
  trailingIcon,
  onClick,
}: {
  children: React.ReactNode;
  color: string;
  primary?: boolean;
  icon?: React.ReactNode;
  trailingIcon?: React.ReactNode;
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
      {trailingIcon}
    </button>
  );
}

function WorkspaceActionMenu({
  workspaceId,
  isAdmin,
  leaveNotice,
  onClose,
  onLeaveWorkspace,
}: {
  workspaceId: number;
  isAdmin: boolean;
  leaveNotice: string;
  onClose: () => void;
  onLeaveWorkspace: () => void;
}) {
  return (
    <div
      className="absolute right-0 top-[calc(100%+8px)] z-50 w-[220px] p-2"
      style={{
        border: `1px solid ${t4.agent}`,
        background: "rgba(10,13,26,0.98)",
        boxShadow: `0 0 16px ${t4.agent}30, inset 0 0 18px ${t4.agent}08`,
      }}
    >
      {isAdmin ? (
        <Link
          href={`/workspaces/${workspaceId}/settings`}
          onClick={onClose}
          className="flex items-center gap-2 px-3 py-2"
          style={{
            border: `1px solid ${t4.line}`,
            color: t4.ink,
            background: "rgba(20,28,55,0.62)",
            fontFamily: "var(--font-mixed-ko)",
            fontSize: 12,
            textDecoration: "none",
          }}
        >
          <Settings className="h-3.5 w-3.5" />
          워크스페이스 설정
        </Link>
      ) : (
        <button
          type="button"
          disabled
          className="flex w-full items-center gap-2 px-3 py-2 text-left"
          style={{
            border: `1px solid ${t4.line}`,
            color: t4.dim,
            background: "rgba(20,28,55,0.38)",
            cursor: "not-allowed",
            fontFamily: "var(--font-mixed-ko)",
            fontSize: 12,
          }}
        >
          <Settings className="h-3.5 w-3.5" />
          워크스페이스 설정
        </button>
      )}
      {!isAdmin && (
        <p
          className="mt-1 px-1"
          style={{
            color: t4.dim,
            fontFamily: "var(--font-mixed-ko)",
            fontSize: 10,
            lineHeight: 1.5,
          }}
        >
          ADMIN만 설정 화면에 접근할 수 있습니다.
        </p>
      )}

      <button
        type="button"
        onClick={onLeaveWorkspace}
        className="mt-2 flex w-full items-center gap-2 px-3 py-2 text-left"
        style={{
          border: `1px solid ${t4.hp}`,
          color: t4.hp,
          background: "rgba(255,85,119,0.08)",
          cursor: "pointer",
          fontFamily: "var(--font-mixed-ko)",
          fontSize: 12,
        }}
      >
        <LogOut className="h-3.5 w-3.5" />
        워크스페이스 나가기
      </button>
      {leaveNotice && (
        <p
          className="mt-2 px-1"
          style={{
            color: t4.xp,
            fontFamily: "var(--font-mixed-ko)",
            fontSize: 10,
            lineHeight: 1.5,
          }}
        >
          {leaveNotice}
        </p>
      )}
    </div>
  );
}

interface StageRoomSpec {
  label: string;
  left: string;
  top: string;
  width: string;
  height: string;
  color: string;
  variant: "engineering" | "huddle" | "rest";
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

type PresenceStatus = "idle" | "walking";

interface WorkspacePresenceState {
  onlineMemberIds: Set<number> | null;
  remoteMemberPositions: Record<number, StageActorPosition>;
  sendPosition: (position: StageActorPosition, status?: PresenceStatus) => void;
}

interface PresenceSnapshotMember {
  memberId: number;
  position?: StageActorPosition | null;
}

function ArcadeOfficeStage({
  actors,
  rooms,
  engineeringRows,
  selectedActorId,
  playerActorId,
  playerPosition,
  remoteMemberPositions,
  zoom,
  pan,
  onPanChange,
  onPlayerPositionChange,
  onOpenTasks,
  onOpenChatWithActor,
  onSizeChange,
  onActorContextMenu,
  onActorSelect,
}: {
  actors: OfficeActor[];
  rooms: StageRoomSpec[];
  engineeringRows: number;
  selectedActorId: string | null;
  playerActorId: string | null;
  playerPosition: StageActorPosition | null;
  remoteMemberPositions: Record<number, StageActorPosition>;
  zoom: number;
  pan: StagePan;
  onPanChange: (pan: StagePan) => void;
  onPlayerPositionChange: (position: StageActorPosition) => void;
  onOpenTasks: () => void;
  onOpenChatWithActor: (actor: OfficeActor) => void;
  onSizeChange: (size: StageSize) => void;
  onActorContextMenu: (payload: { actor: OfficeActor; x: number; y: number }) => void;
  onActorSelect: (actor: OfficeActor) => void;
}) {
  const engineeringRoom = rooms.find((r) => r.variant === "engineering") ?? rooms[0];
  const loungeRoom = rooms.find((r) => r.variant === "rest") ?? null;
  const stageRef = useRef<HTMLDivElement | null>(null);
  const playerWalkTimerRef = useRef<number | null>(null);
  const actorPositionRef = useRef<Map<string, StageActorPosition>>(new Map());
  const interactableActorsRef = useRef<Array<{ actor: OfficeActor; position: StageActorPosition }>>([]);
  const onOpenChatWithActorRef = useRef(onOpenChatWithActor);
  const actorTravelTimerRef = useRef<Map<string, number>>(new Map());
  const [fixedStageSize, setFixedStageSize] = useState<StageSize | null>(null);
  const [playerWalking, setPlayerWalking] = useState(false);
  const [travelingActorIds, setTravelingActorIds] = useState<Set<string>>(() => new Set());
  const playerNearQuest = playerPosition ? isNearQuestMarker(playerPosition) : false;
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
    const size = {
      width: Math.max(1, node.clientWidth),
      height: Math.max(1, node.clientHeight),
    };
    setFixedStageSize(size);
    onSizeChange(size);
  }, [onSizeChange]);

  useEffect(() => {
    onOpenChatWithActorRef.current = onOpenChatWithActor;
  }, [onOpenChatWithActor]);

  useEffect(() => {
    const travelTimers = actorTravelTimerRef.current;
    return () => {
      if (playerWalkTimerRef.current != null) {
        window.clearTimeout(playerWalkTimerRef.current);
      }
      travelTimers.forEach((timerId) => window.clearTimeout(timerId));
      travelTimers.clear();
    };
  }, []);

  let memberSlot = 0;
  let agentSlot = 0;
  let loungeAgentSlot = 0;
  const renderedActors = actors.map((actor) => {
    const completedAgent =
      actor.kind === "agent" &&
      actor.activeTaskStatus === "COMPLETED" &&
      !actor.activeTaskCount;
    const basePosition =
      actor.kind === "agent"
        ? getAgentPositionInStage(agentSlot++, engineeringRows, engineeringRoom)
        : MEMBER_POSITIONS[memberSlot++ % MEMBER_POSITIONS.length];
    const loungePosition =
      completedAgent && loungeRoom
        ? getAgentLoungePosition(loungeAgentSlot++, loungeRoom)
        : null;
    const isPlayer = playerActorId != null && String(actor.id) === playerActorId;
    const remotePosition =
      actor.kind === "member" && !isPlayer
        ? remoteMemberPositions[memberIdFromActor(actor) ?? -1]
        : null;
    const position =
      isPlayer && playerPosition ? playerPosition : remotePosition ?? loungePosition ?? basePosition;
    const actorId = String(actor.id);
    return {
      actor,
      isPlayer,
      position,
      traveling: travelingActorIds.has(actorId),
    };
  });

  useEffect(() => {
    interactableActorsRef.current = renderedActors
      .filter((item) => !item.isPlayer)
      .map((item) => ({ actor: item.actor, position: item.position }));
    const nextPositions = new Map<string, StageActorPosition>();
    for (const item of renderedActors) {
      const actorId = String(item.actor.id);
      const previousPosition = actorPositionRef.current.get(actorId);
      nextPositions.set(actorId, item.position);
      if (
        item.actor.kind !== "agent" ||
        !previousPosition ||
        sameStagePosition(previousPosition, item.position)
      ) {
        continue;
      }

      window.setTimeout(() => {
        setTravelingActorIds((prev) => {
          if (prev.has(actorId)) return prev;
          const next = new Set(prev);
          next.add(actorId);
          return next;
        });
      }, 0);

      const existingTimer = actorTravelTimerRef.current.get(actorId);
      if (existingTimer != null) {
        window.clearTimeout(existingTimer);
      }
      const timerId = window.setTimeout(() => {
        actorTravelTimerRef.current.delete(actorId);
        setTravelingActorIds((prev) => {
          if (!prev.has(actorId)) return prev;
          const next = new Set(prev);
          next.delete(actorId);
          return next;
        });
      }, AGENT_TRAVEL_DURATION_MS);
      actorTravelTimerRef.current.set(actorId, timerId);
    }
    actorPositionRef.current = nextPositions;
  });

  useEffect(() => {
    if (!playerPosition || !fixedStageSize) return;
    const playerLeftPct = parseStagePct(playerPosition.left);
    const playerTopPct = parseStagePct(playerPosition.top);
    const targetX = -((playerLeftPct - 50) / 100) * fixedStageSize.width * zoom;
    const targetY = -((playerTopPct - 50) / 100) * fixedStageSize.height * zoom;
    onPanChange({ x: targetX, y: targetY });
  }, [playerPosition, fixedStageSize, zoom, onPanChange]);

  useEffect(() => {
    const stageSizeForKeyboard = fixedStageSize;
    const currentPlayerPosition = playerPosition;
    if (!playerActorId || !currentPlayerPosition || !stageSizeForKeyboard) return;
    const keyboardPosition: StageActorPosition = currentPlayerPosition;
    const keyboardStageSize: StageSize = stageSizeForKeyboard;

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "/") {
        if (event.metaKey || event.ctrlKey || event.altKey) return;
        if (shouldIgnoreStageMovementKey(event.target)) return;
        if (isNearQuestMarker(keyboardPosition)) {
          event.preventDefault();
          onOpenTasks();
          return;
        }
        const nearestActor = findNearestInteractableActor(
          keyboardPosition,
          interactableActorsRef.current,
        );
        if (nearestActor) {
          event.preventDefault();
          onOpenChatWithActorRef.current(nearestActor);
          return;
        }
        return;
      }

      const direction = getPlayerMoveDirection(event.key);
      if (!direction || event.metaKey || event.ctrlKey || event.altKey) return;
      if (shouldIgnoreStageMovementKey(event.target)) return;

      event.preventDefault();
      const stepPx = event.shiftKey ? PLAYER_MOVE_FAST_STEP_PX : PLAYER_MOVE_STEP_PX;
      const nextPosition = moveStagePosition(
        keyboardPosition,
        (direction.x * stepPx * 100) / Math.max(1, keyboardStageSize.width * zoom),
        (direction.y * stepPx * 100) / Math.max(1, keyboardStageSize.height * zoom),
      );
      onPlayerPositionChange(nextPosition);
      setPlayerWalking(true);
      if (playerWalkTimerRef.current != null) {
        window.clearTimeout(playerWalkTimerRef.current);
      }
      playerWalkTimerRef.current = window.setTimeout(() => {
        setPlayerWalking(false);
        playerWalkTimerRef.current = null;
      }, 360);
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [fixedStageSize, onOpenTasks, onPlayerPositionChange, playerActorId, playerPosition, zoom]);

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
        className={fixedStageSize ? "absolute left-1/2 top-1/2" : "absolute inset-0"}
        style={{
          ...(fixedStageSize
            ? {
                width: fixedStageSize.width,
                height: fixedStageSize.height,
                marginLeft: -(fixedStageSize.width / 2),
                marginTop: -(fixedStageSize.height / 2),
              }
            : null),
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
            <StageRoom key={room.label} room={room} engineeringRows={engineeringRows} />
          ))}

          <QuestMarker active={playerNearQuest} />

          {renderedActors.map(({ actor, isPlayer, position, traveling }) => {
            return (
              <StageActor
                key={actor.id}
                actor={actor}
                position={position}
                isPlayer={isPlayer}
                travel={actor.kind === "agent"}
                walking={(isPlayer && playerWalking) || traveling}
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
  engineeringRows,
}: {
  room: StageRoomSpec;
  engineeringRows: number;
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
      {room.variant === "engineering" && <EngineeringPlatforms rows={engineeringRows} />}
      {room.variant === "huddle" && <HuddleTable />}
      {room.variant === "rest" && <RestLounge />}
    </section>
  );
}

function EngineeringPlatforms({ rows }: { rows: number }) {
  const rowCenters = getDeskRowCenters(rows);
  const deskH = getDeskHeightPct(rows);
  const deskW = AGENT_DESK_W_PCT;
  return (
    <>
      {rowCenters.flatMap((cy, rowIdx) =>
        AGENT_DESK_COL_CENTERS.map((cx, colIdx) => (
          <div
            key={`${rowIdx}-${colIdx}`}
            className="absolute"
            style={{
              left: pct(cx - deskW / 2),
              top: pct(cy - deskH / 2),
              width: pct(deskW),
              height: pct(deskH),
              border: `1px solid ${t4.agent}`,
              background: `${t4.agent}24`,
              boxShadow: `0 0 12px ${t4.agent}18`,
            }}
          />
        )),
      )}
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

function RestLounge() {
  return (
    <>
      <LoungeBench />
      <div
        className="absolute left-[58%] top-[27%] h-[28%] w-[22%]"
        style={{
          border: `1px solid ${t4.ok}`,
          background: `${t4.ok}10`,
          boxShadow: `0 0 12px ${t4.ok}18`,
        }}
      />
      <div
        className="absolute left-[14%] top-[24%] h-[22%] w-[16%] rounded-[50%]"
        style={{
          border: `1px solid ${t4.ok}`,
          background: `${t4.ok}12`,
          boxShadow: `0 0 10px ${t4.ok}18`,
        }}
      />
    </>
  );
}

function QuestMarker({ active }: { active: boolean }) {
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
        transform: active ? "translateY(-2px)" : undefined,
        transition: "transform 140ms ease-out, box-shadow 140ms ease-out",
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
      {active && (
        <span
          className="absolute left-1/2 top-[78px] min-w-[132px] -translate-x-1/2 px-2 py-1"
          style={{
            border: `1px solid ${t4.xp}`,
            background: "rgba(9,11,22,0.94)",
            color: t4.xp,
            boxShadow: `0 0 14px ${t4.xp}50`,
            fontFamily: "var(--font-mixed-ko)",
            fontSize: 10,
            fontWeight: 700,
            letterSpacing: 0,
            textShadow: `0 0 6px ${t4.xp}`,
            lineHeight: 1.35,
          }}
        >
          / 태스크 보드
        </span>
      )}
    </button>
  );
}

function StageActor({
  actor,
  position,
  isPlayer = false,
  travel,
  walking,
  selected,
  onContextMenu,
  onSelect,
}: {
  actor: OfficeActor;
  position: StageActorPosition;
  isPlayer?: boolean;
  travel?: boolean;
  walking?: boolean;
  selected: boolean;
  onContextMenu: (payload: { actor: OfficeActor; x: number; y: number }) => void;
  onSelect: (actor: OfficeActor) => void;
}) {
  const isAgent = actor.kind === "agent";
  const accent = isAgent ? t4.agent : t4.pink;
  const hasActiveTask = isAgent && Boolean(actor.activeTaskCount);
  const speech = getActorSpeechBubble(actor);
  const visibleSpeech = isPlayer ? null : speech;
  const playerIdle = isPlayer && !walking;
  const avatarWalking = playerIdle ? false : walking;
  const motion = walking ? "walking" : "idle";
  return (
    <button
      type="button"
      className={`stage-actor stage-actor--${motion} absolute z-20 -translate-x-1/2 -translate-y-1/2 cursor-pointer border-0 bg-transparent p-0`}
      style={{
        left: position.left,
        top: position.top,
        transition: travel
          ? `left ${AGENT_TRAVEL_DURATION_MS}ms linear, top ${AGENT_TRAVEL_DURATION_MS}ms linear`
          : "left 90ms linear, top 90ms linear",
      }}
      onClick={() => onSelect(actor)}
      onContextMenu={(event) => {
        event.preventDefault();
        onContextMenu({ actor, x: event.clientX, y: event.clientY });
      }}
      aria-label={isPlayer ? `${actor.name} 플레이어` : `${actor.name} 채팅`}
    >
      {isPlayer && (
        <span
          aria-hidden="true"
          className="stage-actor__player-marker absolute left-1/2 -translate-x-1/2"
          style={{
            top: -50,
            color: t4.pink,
            fontFamily: "var(--font-pixel)",
            fontSize: 11,
            textShadow: `0 0 8px ${t4.pink}`,
          }}
        >
          ▼
        </span>
      )}
      {visibleSpeech && (
        <div
          className="stage-actor__speech absolute left-1/2 max-w-[180px] -translate-x-1/2 px-4 py-1.5"
          title={actor.activeTaskTitle}
          style={{
            top: -68,
            border: `1px solid ${visibleSpeech.color}`,
            background: "rgba(9,11,22,0.94)",
            boxShadow: `0 0 14px ${visibleSpeech.color}55`,
          }}
        >
          <span
            aria-hidden="true"
            className="absolute left-1/2 h-2 w-2 -translate-x-1/2 rotate-45"
            style={{
              bottom: -5,
              borderRight: `1px solid ${visibleSpeech.color}`,
              borderBottom: `1px solid ${visibleSpeech.color}`,
              background: "rgba(9,11,22,0.94)",
            }}
          />
          <div
            className="flex min-w-0 items-center justify-center gap-1.5"
            style={{
              fontFamily: "var(--font-mixed-ko)",
              fontSize: 10,
              fontWeight: 700,
              color: visibleSpeech.color,
              lineHeight: 1.35,
              textShadow: `0 0 6px ${visibleSpeech.color}`,
            }}
          >
            {visibleSpeech.label && <span className="shrink-0">{visibleSpeech.label}</span>}
            {visibleSpeech.text && <span className="min-w-0 truncate">{visibleSpeech.text}</span>}
          </div>
        </div>
      )}
      <div
        className={`absolute left-1/2 -translate-x-1/2 whitespace-nowrap ${isPlayer ? "px-1.5 py-0.5" : "px-2 py-1"}`}
        style={{
          top: isPlayer ? -28 : -30,
          border: `1px solid ${accent}`,
          background: isPlayer ? "rgba(9,11,22,0.72)" : "rgba(9,11,22,0.92)",
          boxShadow: selected || hasActiveTask ? `0 0 14px ${accent}` : `0 0 10px ${accent}30`,
        }}
      >
        <div className="flex items-center justify-center gap-1.5">
          {!isPlayer && (
            <span
              className={`h-1.5 w-1.5 shrink-0 ${hasActiveTask ? "animate-pulse" : ""}`}
              style={{
                background: hasActiveTask ? t4.ok : accent,
                boxShadow: `0 0 6px ${accent}`,
              }}
            />
          )}
          <span
            style={{
              fontFamily: isPlayer ? "var(--font-pixel)" : "var(--font-mixed-ko)",
              fontSize: isPlayer ? 7 : 11,
              fontWeight: isPlayer ? 400 : 600,
              letterSpacing: isPlayer ? 1 : 0.2,
              color: isPlayer ? t4.pink : t4.ink,
              textShadow: isPlayer ? `0 0 6px ${t4.pink}` : undefined,
            }}
          >
            {isPlayer ? "YOU" : actor.name}
          </span>
        </div>
      </div>
      <div
        className="stage-actor__avatar relative"
        style={{
          padding: 4,
          filter:
            selected || hasActiveTask
              ? `drop-shadow(0 0 14px ${hasActiveTask ? t4.ok : accent})`
              : `drop-shadow(0 0 8px ${accent}80)`,
        }}
      >
        <PixelAvatar kind={pickAvatarKind(actor.name, isAgent)} size={3} walking={avatarWalking} />
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
        <span>{menu.actor.kind === "agent" ? "TALK TO AGENT" : "TALK"}</span>
      </button>
    </div>
  );
}

function ChatMessageBadges({
  message,
  align,
  onOpenPlan,
}: {
  message: ChatMessage;
  align: "start" | "end" | "center";
  onOpenPlan: (planId: number) => void;
}) {
  if (message.orchestrationPlanId == null) return null;

  const alignSelf =
    align === "end" ? "flex-end" : align === "center" ? "center" : "flex-start";

  return (
    <div
      style={{
        alignSelf,
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        flexWrap: "wrap",
      }}
    >
      <button
        type="button"
        onClick={() => onOpenPlan(message.orchestrationPlanId as number)}
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 6,
          padding: "4px 9px",
          fontFamily: "var(--font-pixel)",
          fontSize: 8,
          letterSpacing: 1.5,
          color: t4.xp,
          background: "rgba(255,216,74,0.08)",
          border: `1px solid ${t4.xp}`,
          boxShadow: `0 0 8px ${t4.xp}30`,
          cursor: "pointer",
          textShadow: `0 0 6px ${t4.xp}`,
        }}
      >
        <span aria-hidden style={{ fontSize: 10 }}>◆</span>
        <span>PLAN #{message.orchestrationPlanId}</span>
      </button>
    </div>
  );
}

function ActorChatSidePanel({
  open,
  target,
  workspaceId,
  initialTab,
  messages,
  agentTasks,
  input,
  onInputChange,
  sending,
  pollError,
  onSubmitMessage,
  onOpenPlan,
  onClose,
}: {
  open: boolean;
  target: OfficeActor | null;
  workspaceId: number;
  initialTab: "chat" | "tasks";
  messages: ChatMessage[];
  agentTasks: WorkspaceTask[];
  input: string;
  onInputChange: (value: string) => void;
  sending: boolean;
  pollError: string;
  onSubmitMessage: (e: FormEvent) => void;
  onOpenPlan: (planId: number) => void;
  onClose: () => void;
}) {
  const [activeTab, setActiveTab] = useState<"chat" | "tasks">(initialTab);
  const [selectedTask, setSelectedTask] = useState<WorkspaceTask | null>(null);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const sortedAgentTasks = useMemo(
    () => [...agentTasks].sort(compareTasksForDisplay),
    [agentTasks],
  );
  const lastMessageId = messages.at(-1)?.id;

  useEffect(() => {
    if (!open || activeTab !== "chat") return;
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [open, activeTab, messages.length, lastMessageId, sending]);

  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [open, onClose]);

  if (!open || !target) return null;
  const isAgent = target?.kind === "agent";
  const accent = isAgent ? t4.agent : t4.pink;
  const avatarKind: PixelAvatarKind = isAgent ? "agent" : "mira";
  const showingTasks = isAgent && activeTab === "tasks";

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
              className="flex min-w-0 items-center"
              style={{
                fontFamily: "var(--font-mixed-ko)",
                fontSize: 13,
                fontWeight: 700,
                letterSpacing: 0,
                lineHeight: 1,
                color: accent,
                textShadow: `0 0 6px ${accent}`,
              }}
            >
              <GlyphText
                glyph={isAgent ? "◇" : "●"}
                truncate
                style={{ alignItems: "center", transform: "translateY(1px)" }}
              >
                {target.name.toUpperCase()}
              </GlyphText>
            </p>
            <p
              className="truncate"
              style={{
                fontFamily: "var(--font-mixed-ko)",
                fontSize: 11,
                color: t4.dim,
                marginTop: 3,
                letterSpacing: 0,
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
          <GlyphText glyph="✕">ESC</GlyphText>
        </button>
      </header>

      {isAgent && (
        <nav
          className="grid shrink-0 grid-cols-2"
          style={{
            borderBottom: `1px solid ${t4.line}`,
            background: "rgba(0,0,0,0.32)",
          }}
        >
          <AgentPanelTab
            active={activeTab === "chat"}
            accent={accent}
            onClick={() => setActiveTab("chat")}
          >
            채팅
          </AgentPanelTab>
          <AgentPanelTab
            active={activeTab === "tasks"}
            accent={accent}
            onClick={() => setActiveTab("tasks")}
          >
            태스크
          </AgentPanelTab>
        </nav>
      )}

      <div className="flex min-h-0 flex-1 flex-col">
        {showingTasks ? (
          <div className="flex min-h-0 flex-1 flex-col overflow-hidden" style={{ background: "rgba(0,0,0,0.25)" }}>
            <AgentTaskProgressList
              tasks={sortedAgentTasks}
              accent={accent}
              selectedTaskId={selectedTask?.taskId}
              onTaskSelect={setSelectedTask}
            />
            <TaskDetailModal
              open={!!selectedTask}
              onClose={() => setSelectedTask(null)}
              workspaceId={workspaceId}
              task={selectedTask}
            />
          </div>
        ) : (
          <div
            className="min-h-0 flex-1 space-y-3 overflow-y-auto p-4"
            style={{ background: "rgba(0,0,0,0.25)" }}
          >
            {messages.length === 0 && (
              <div
                style={{
                  fontFamily: "var(--font-mixed-ko)",
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
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "center",
                      gap: 6,
                      minWidth: 0,
                    }}
                  >
                    <div
                      style={{
                        fontFamily: "var(--font-mixed-ko)",
                        fontSize: 12,
                        fontWeight: 700,
                        letterSpacing: 0,
                        color: t4.xp,
                        display: "flex",
                        justifyContent: "center",
                        padding: "8px 10px",
                        border: `1px solid ${t4.xp}`,
                        background: "rgba(255,216,74,0.06)",
                        boxShadow: `0 0 10px ${t4.xp}30`,
                        textShadow: `0 0 6px ${t4.xp}`,
                        maxWidth: "100%",
                        minWidth: 0,
                      }}
                    >
                      <span
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          justifyContent: "center",
                          gap: 6,
                          maxWidth: "100%",
                          minWidth: 0,
                          transform: "translateY(1px)",
                        }}
                      >
                        <span
                          aria-hidden="true"
                          style={{
                            display: "inline-flex",
                            alignItems: "center",
                            justifyContent: "center",
                            width: 16,
                            height: 16,
                            flexShrink: 0,
                            fontFamily: "var(--font-sans)",
                            fontSize: 13,
                            lineHeight: 1,
                            letterSpacing: 0,
                          }}
                        >
                          ★
                        </span>
                        <span
                          style={{
                            minWidth: 0,
                            lineHeight: 1.3,
                            wordBreak: "break-word",
                            overflowWrap: "anywhere",
                            whiteSpace: "pre-wrap",
                            textAlign: "center",
                          }}
                        >
                          {message.text}
                        </span>
                      </span>
                    </div>
                    <ChatMessageBadges
                      message={message}
                      align="center"
                      onOpenPlan={onOpenPlan}
                    />
                  </div>
                );
              }
              const fromMe = message.from === "me";
              return (
                <div
                  key={message.id}
                  style={{
                    maxWidth: "86%",
                    minWidth: 0,
                    marginLeft: fromMe ? "auto" : 0,
                    display: "flex",
                    flexDirection: "column",
                    gap: 6,
                  }}
                >
                  <div
                    style={{
                      padding: "8px 11px",
                      fontFamily: "var(--font-mixed-ko)",
                      fontSize: 12,
                      color: t4.ink,
                      border: `1px solid ${fromMe ? t4.pink : accent}40`,
                      background: fromMe
                        ? "rgba(255,122,220,0.08)"
                        : "rgba(20,28,55,0.6)",
                      lineHeight: 1.5,
                      whiteSpace: "pre-wrap",
                      wordBreak: "break-word",
                      overflowWrap: "anywhere",
                      minWidth: 0,
                    }}
                  >
                    {message.text}
                  </div>
                  <ChatMessageBadges
                    message={message}
                    align={fromMe ? "end" : "start"}
                    onOpenPlan={onOpenPlan}
                  />
                </div>
              );
            })}
            {isAgent && sending && (
              <div
                aria-label={`${target.name} 응답 대기 중`}
                style={{
                  maxWidth: "86%",
                  marginLeft: 0,
                  padding: "8px 11px",
                  fontFamily: "var(--font-mixed-ko)",
                  fontSize: 12,
                  color: t4.ink,
                  border: `1px solid ${accent}40`,
                  background: "rgba(20,28,55,0.6)",
                  lineHeight: 1.5,
                }}
              >
                <span className="inline-flex items-center gap-1">
                  <TypingDot delay="0ms" />
                  <TypingDot delay="120ms" />
                  <TypingDot delay="240ms" />
                </span>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>
        )}

        {!showingTasks && pollError && (
          <p
            className="px-3 py-2"
            style={{
              fontFamily: "var(--font-mixed-ko)",
              fontSize: 11,
              color: t4.hp,
              borderTop: `1px solid ${t4.line}`,
              background: "rgba(0,0,0,0.38)",
            }}
          >
            <GlyphText glyph="⚠">{pollError}</GlyphText>
          </p>
        )}

        {!showingTasks && !isAgent && (
          <p
            className="p-3"
            style={{
              fontFamily: "var(--font-mixed-ko)",
              fontSize: 10,
              color: t4.dim,
              borderTop: `1px solid ${t4.line}`,
              background: "rgba(0,0,0,0.4)",
            }}
          >
            <GlyphText glyph="◇">Real-time API not wired yet - messages stay local for now.</GlyphText>
          </p>
        )}

        {!showingTasks && (
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
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              width: 22,
              fontFamily: "var(--font-sans)",
              fontSize: 13,
              lineHeight: 1,
              color: t4.pink,
              letterSpacing: 0,
            }}
            aria-hidden="true"
          >
            ▶
          </span>
          <Input
            value={input}
            onChange={(e) => onInputChange(e.target.value)}
            disabled={sending}
            placeholder={isAgent ? "Agent에게 메시지 입력" : "type a message..."}
            autoFocus
          />
          <Button type="submit" icon={<Send />} disabled={sending}>
            SEND
          </Button>
        </form>
        )}
      </div>
    </aside>
  );
}

function TypingDot({ delay }: { delay: string }) {
  return (
    <span
      className="h-1.5 w-1.5 animate-bounce rounded-full"
      style={{
        animationDelay: delay,
        background: t4.agent,
        boxShadow: `0 0 6px ${t4.agent}`,
      }}
    />
  );
}

function AgentPanelTab({
  active,
  accent,
  onClick,
  children,
}: {
  active: boolean;
  accent: string;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="px-3 py-2"
      style={{
        border: "none",
        borderBottom: `2px solid ${active ? accent : "transparent"}`,
        background: active ? `${accent}14` : "transparent",
        color: active ? accent : t4.dim,
        cursor: "pointer",
        fontFamily: "var(--font-mixed-ko)",
        fontSize: 12,
        fontWeight: 700,
        letterSpacing: 0,
        lineHeight: 1.2,
        textShadow: active ? `0 0 6px ${accent}` : "none",
      }}
    >
      {children}
    </button>
  );
}

function AgentTaskProgressList({
  tasks,
  accent,
  selectedTaskId,
  onTaskSelect,
}: {
  tasks: WorkspaceTask[];
  accent: string;
  selectedTaskId?: number;
  onTaskSelect?: (task: WorkspaceTask) => void;
}) {
  return (
    <div
      className="min-h-0 flex-1 overflow-y-auto p-4"
      style={{ background: "transparent" }}
    >
      {tasks.length === 0 ? (
        <div
          style={{
            fontFamily: "var(--font-mixed-ko)",
            fontSize: 11,
            color: t4.dim,
            textAlign: "center",
            padding: "20px 10px",
          }}
        >
          <GlyphText glyph="◆">배정된 태스크가 없습니다.</GlyphText>
        </div>
      ) : (
        <div className="grid gap-2">
          {tasks.map((task) => {
            const taskGroup = taskDisplayGroup(task.status);
            const isActive = taskGroup.key === "progress";
            return (
              <button
                type="button"
                key={task.taskId}
                onClick={() => onTaskSelect?.(task)}
                className="min-w-0 overflow-hidden px-3 py-3 text-left"
                style={{
                  width: "100%",
                  border: `1px solid ${selectedTaskId === task.taskId || isActive ? accent : t4.line}`,
                  background: isActive ? `${accent}12` : "rgba(20,28,55,0.62)",
                  boxShadow: selectedTaskId === task.taskId || isActive
                    ? `0 0 10px ${accent}24`
                    : "inset 0 0 12px rgba(154,122,255,0.05)",
                  cursor: "pointer",
                }}
              >
                <div className="flex min-w-0 items-start justify-between gap-2">
                  <p
                    className="min-w-0 break-all"
                    style={{
                      fontFamily: "var(--font-mixed-ko)",
                      fontSize: 12,
                      fontWeight: 700,
                      color: t4.ink,
                      lineHeight: 1.35,
                      margin: 0,
                    }}
                  >
                    {task.title}
                  </p>
                  <span
                    className="shrink-0 px-2 py-0.5"
                    style={{
                      border: `1px solid ${isActive ? accent : t4.line}`,
                      color: isActive ? accent : t4.dim,
                      background: isActive ? `${accent}14` : "rgba(255,255,255,0.04)",
                      fontFamily: "var(--font-mixed-ko)",
                      fontSize: 10,
                      fontWeight: 700,
                      letterSpacing: 0,
                    }}
                  >
                    {taskGroup.label}
                  </span>
                </div>

                {task.description && (
                  <p
                    className="mt-2 line-clamp-2 min-w-0 break-all"
                    style={{
                      fontFamily: "var(--font-mixed-ko)",
                      fontSize: 11,
                      color: t4.dim,
                      lineHeight: 1.45,
                    }}
                  >
                    {task.description}
                  </p>
                )}

                <div
                  className="mt-3 h-1.5 overflow-hidden"
                  style={{
                    border: `1px solid ${t4.line}`,
                    background: "rgba(255,255,255,0.04)",
                  }}
                >
                  <div
                    style={{
                      width: `${taskProgressPercent(task.status)}%`,
                      height: "100%",
                      background: isActive ? accent : t4.dim,
                      boxShadow: isActive ? `0 0 8px ${accent}` : "none",
                    }}
                  />
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

function TaskDetailModal({
  open,
  onClose,
  workspaceId,
  task,
}: {
  open: boolean;
  onClose: () => void;
  workspaceId: number;
  task: WorkspaceTask | null;
}) {
  const [detail, setDetail] = useState<WorkspaceTask | null>(null);
  const [reports, setReports] = useState<AgentReport[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const taskId = task?.taskId;
  const currentTask = detail ?? task;

  useEffect(() => {
    if (!open || taskId == null) return;
    let cancelled = false;
    queueMicrotask(() => {
      if (cancelled) return;
      setLoading(true);
      setError("");
      setDetail(null);
      setReports([]);
    });
    Promise.all([
      getWorkspaceTask(workspaceId, taskId),
      listTaskReports(workspaceId, taskId),
    ])
      .then(([nextDetail, nextReports]) => {
        if (cancelled) return;
        setDetail(nextDetail);
        setReports(nextReports);
      })
      .catch((err) => {
        if (cancelled) return;
        const apiErr = err as ApiError;
        setDetail(null);
        setReports([]);
        setError(apiErr?.message ?? "Task 상세/보고서를 불러오지 못했습니다.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open, workspaceId, taskId]);

  if (!currentTask) return null;
  const priorityLabel = currentTask.priority ?? null;
  const taskTypeLabel = currentTask.taskType ?? null;
  const statusLabel = TASK_STATUS_META[currentTask.status]?.label ?? currentTask.status;
  const statusColor = getTaskStatusColor(currentTask.status);
  const assigneeLabel = String(currentTask.assignedAgentId ?? currentTask.assigneeId ?? "-");

  return (
    <Modal open={open} onClose={onClose} size="full">
      <Modal.Body className="h-[62vh] min-h-[520px] overflow-hidden p-0">
        <div className="relative grid h-full min-h-0 min-w-0 lg:grid-cols-[minmax(0,1.9fr)_minmax(360px,1fr)]">
          <button
            type="button"
            onClick={onClose}
            aria-label="태스크 상세 닫기"
            className="absolute right-5 top-4 z-10"
            style={{
              color: "var(--t4-dim)",
              background: "transparent",
              border: "none",
              cursor: "pointer",
              padding: 4,
            }}
          >
            <X className="w-5 h-5" />
          </button>

          <section className="min-h-0 min-w-0 overflow-y-auto px-7 py-9 sm:px-10 lg:px-12">
            <div className="min-w-0 pr-8">
              <div
                style={{
                  fontFamily: "var(--font-pixel)",
                  fontSize: 11,
                  letterSpacing: 3,
                  color: t4.pink,
                  textShadow: `0 0 10px ${t4.pink}`,
                }}
              >
                <GlyphText glyph="◆">TASK</GlyphText>
              </div>
              <p
                className="mt-2"
                style={{
                  fontFamily: "var(--font-mixed-ko)",
                  fontSize: 12,
                  color: t4.dim,
                  marginBottom: 0,
                }}
              >
                워크스페이스 / 태스크 / #{currentTask.taskId}
              </p>
              <h3
                className="mt-8 min-w-0 break-words"
                style={{
                  fontFamily: "var(--font-mixed-ko)",
                  fontSize: 30,
                  fontWeight: 800,
                  color: t4.ink,
                  lineHeight: 1.25,
                  marginBottom: 0,
                }}
              >
                {currentTask.title}
              </h3>
              <div className="mt-7 flex flex-wrap items-center gap-2">
                <TaskPill label={statusLabel} color={statusColor} />
                {priorityLabel && <TaskPill label={priorityLabel} color={t4.xp} />}
                {taskTypeLabel && <TaskPill label={taskTypeLabel} color={t4.agent} />}
              </div>
            </div>

            {loading && <TaskDetailNotice text="상세와 보고서를 불러오는 중입니다." />}
            {error && <TaskDetailNotice text={error} danger />}

            <div className="mt-8 grid min-w-0 gap-5 pr-0 lg:pr-8">
              {currentTask.description && (
                <TaskSectionCard label="DESCRIPTION">
                  <TaskBodyText text={currentTask.description} />
                </TaskSectionCard>
              )}
              {currentTask.originalRequest && (
                <TaskSectionCard label="ORIGINAL REQUEST">
                  <TaskBodyText text={`"${currentTask.originalRequest}"`} />
                </TaskSectionCard>
              )}
              {!currentTask.description && !currentTask.originalRequest && (
                <TaskSectionCard label="DESCRIPTION">
                  <TaskEmptyText text="설명이 등록되지 않았습니다." />
                </TaskSectionCard>
              )}
            </div>
          </section>

          <aside
            className="min-h-0 min-w-0 overflow-y-auto px-7 py-9 sm:px-10 lg:px-8"
            style={{ borderLeft: `1px solid ${t4.line}` }}
          >
            <div className="grid min-w-0 gap-7 pr-5">
              <section>
                <TaskSideHeading>META</TaskSideHeading>
                <div className="mt-4 grid gap-4">
                  <TaskMetaRow label="Status" value={statusLabel} valueColor={statusColor} />
                  <TaskMetaRow label="Agent" value={assigneeLabel} />
                  <TaskMetaRow label="Source" value={currentTask.sourceType ?? "-"} valueColor={t4.pink} />
                  <TaskMetaRow
                    label="Updated"
                    value={formatDashboardTime(currentTask.updatedAt ?? currentTask.createdAt)}
                  />
                </div>
              </section>

              <section>
                <TaskSideHeading>REPORTS</TaskSideHeading>
                <div className="mt-4 grid gap-4">
                  {reports.length > 0
                    ? reports.map((report, index) => (
                        <TaskSectionCard
                          key={report.reportId}
                          label={`REPORT #${index + 1}`}
                          accent={t4.agent}
                          statusBadge={TASK_STATUS_META[report.status]?.label ?? report.status}
                          statusColor={getTaskStatusColor(report.status)}
                        >
                          <TaskReportBody report={report} />
                        </TaskSectionCard>
                      ))
                    : (
                        <TaskSectionCard label="REPORT" accent={t4.agent}>
                          <TaskEmptyText text={loading ? "보고서를 확인 중입니다." : "아직 보고서가 없습니다."} />
                        </TaskSectionCard>
                      )}
                </div>
              </section>
            </div>
          </aside>
        </div>
      </Modal.Body>
    </Modal>
  );
}

function getTaskStatusColor(status: TaskStatus): string {
  switch (status) {
    case "COMPLETED":
      return t4.ok;
    case "FAILED":
      return t4.hp;
    case "IN_PROGRESS":
    case "ASSIGNED":
      return t4.mp;
    case "WAITING_USER":
      return t4.xp;
    case "CANCELED":
      return t4.dim;
    default:
      return t4.dim;
  }
}

function TaskPill({ label, color }: { label: string; color: string }) {
  return (
    <span
      style={{
        border: `1px solid ${color}`,
        background: "transparent",
        color,
        fontFamily: "var(--font-pixel)",
        fontSize: 8,
        letterSpacing: 1.5,
        padding: "4px 10px",
        boxShadow: `0 0 8px ${color}40`,
        textShadow: `0 0 6px ${color}80`,
      }}
    >
      {label}
    </span>
  );
}

function TaskSectionCard({
  label,
  accent = t4.line,
  statusBadge,
  statusColor,
  children,
}: {
  label: string;
  accent?: string;
  statusBadge?: string;
  statusColor?: string;
  children: ReactNode;
}) {
  const badgeColor = statusColor ?? t4.xp;
  return (
    <section
      className="relative min-w-0"
      style={{
        border: `1px solid ${accent}`,
        background: "rgba(9,11,22,0.36)",
        padding: "20px 22px 22px",
      }}
    >
      <div
        style={{
          fontFamily: "var(--font-pixel)",
          fontSize: 8,
          letterSpacing: 4,
          color: t4.dim,
          marginBottom: 14,
        }}
      >
        {label}
      </div>
      {statusBadge && (
        <div
          style={{
            position: "absolute",
            top: 20,
            right: 20,
            padding: "3px 8px",
            border: `1px solid ${badgeColor}`,
            background: "rgba(9,11,22,0.82)",
            fontFamily: "var(--font-pixel)",
            fontSize: 7,
            letterSpacing: 1.5,
            color: badgeColor,
            zIndex: 1,
            textShadow: `0 0 6px ${badgeColor}90`,
          }}
        >
          {statusBadge}
        </div>
      )}
      {children}
    </section>
  );
}

function TaskSideHeading({ children }: { children: ReactNode }) {
  return (
    <h3
      style={{
        fontFamily: "var(--font-pixel)",
        fontSize: 10,
        letterSpacing: 4,
        color: t4.xp,
        textShadow: `0 0 8px ${t4.xp}`,
        margin: 0,
      }}
    >
      {children}
    </h3>
  );
}

function TaskMetaRow({
  label,
  value,
  valueColor,
}: {
  label: string;
  value: string;
  valueColor?: string;
}) {
  return (
    <div className="grid min-w-0 grid-cols-[96px_minmax(0,1fr)] items-baseline gap-5">
      <span
        style={{
          fontFamily: "var(--font-mono-arcade)",
          fontSize: 13,
          letterSpacing: 0,
          color: t4.dim,
        }}
      >
        {label}
      </span>
      <span
        className="truncate"
        style={{
          fontFamily: "var(--font-mono)",
          fontSize: 13,
          color: valueColor ?? t4.ink,
          fontWeight: 500,
          textShadow: valueColor ? `0 0 6px ${valueColor}60` : undefined,
        }}
      >
        {value}
      </span>
    </div>
  );
}

function TaskBodyText({ text }: { text: string }) {
  return (
    <p
      className="whitespace-pre-wrap break-words"
      style={{
        fontFamily: "var(--font-mixed-ko)",
        fontSize: 14,
        color: t4.ink,
        lineHeight: 1.75,
        margin: 0,
      }}
    >
      {text}
    </p>
  );
}

function TaskEmptyText({ text }: { text: string }) {
  return (
    <p
      style={{
        fontFamily: "var(--font-mixed-ko)",
        fontSize: 13,
        color: t4.dim,
        margin: 0,
      }}
    >
      {text}
    </p>
  );
}

function TaskReportBody({ report }: { report: AgentReport }) {
  return (
    <div className="grid gap-3">
      {report.summary && <TaskSubBlock label="Summary" text={report.summary} />}
      {report.detail && <TaskSubBlock label="Detail" text={report.detail} />}
      {report.recommendedAction && (
        <TaskSubBlock label="Recommended" text={report.recommendedAction} />
      )}
      {report.artifacts && report.artifacts.length > 0 && (
        <div className="grid gap-2">
          {report.artifacts.map((artifact) => (
            <a
              key={artifact.artifactId}
              href={artifact.url ?? undefined}
              target={artifact.url ? "_blank" : undefined}
              rel={artifact.url ? "noreferrer" : undefined}
              className="block min-w-0 truncate px-2 py-1"
              style={{
                border: `1px solid ${t4.line}`,
                color: artifact.url ? t4.xp : t4.dim,
                background: "rgba(0,0,0,0.22)",
                fontFamily: "var(--font-mixed-ko)",
                fontSize: 11,
              }}
            >
              {artifact.artifactType} · {artifact.name || artifact.url || artifact.artifactId}
            </a>
          ))}
        </div>
      )}
    </div>
  );
}

function TaskSubBlock({ label, text }: { label: string; text: string }) {
  return (
    <div>
      <p
        style={{
          fontFamily: "var(--font-pixel)",
          fontSize: 8,
          letterSpacing: 1.5,
          color: t4.agent,
          margin: 0,
        }}
      >
        {label}
      </p>
      <p
        className="mt-1.5 whitespace-pre-wrap break-words"
        style={{
          fontFamily: "var(--font-mixed-ko)",
          fontSize: 11,
          color: t4.ink,
          lineHeight: 1.55,
          margin: 0,
        }}
      >
        {text}
      </p>
    </div>
  );
}

function TaskDetailNotice({ text, danger = false }: { text: string; danger?: boolean }) {
  return (
    <p
      className="mt-3 px-3 py-2"
      style={{
        border: `1px solid ${danger ? t4.hp : t4.line}`,
        background: danger ? "rgba(255,91,134,0.08)" : "rgba(20,28,55,0.52)",
        color: danger ? t4.hp : t4.dim,
        fontFamily: "var(--font-mixed-ko)",
        fontSize: 11,
        lineHeight: 1.45,
      }}
    >
      {text}
    </p>
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
  const rank = Math.max(1, Math.min(99, memberCount * 7 + workingCount * 3));
  const healthPct = workingCount === 0 ? 100 : Math.max(20, 100 - workingCount * 12);
  const flowPct = Math.min(95, 25 + workingCount * 15);
  const impactPct = Math.min(100, 12 + memberCount * 9);
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
              RANK {String(rank).padStart(2, "0")}
            </span>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 2, marginTop: 6 }}>
            <MiniBar label="HEALTH" pct={healthPct} color={t4.hp} />
            <MiniBar label="FLOW" pct={flowPct} color={t4.mp} />
            <MiniBar label="IMPACT" pct={impactPct} color={t4.xp} thin />
          </div>
        </div>
      </div>
    </T4Panel>
  );
}

function MiniBar({
  label,
  pct,
  color,
  thin,
}: {
  label: string;
  pct: number;
  color: string;
  thin?: boolean;
}) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "48px minmax(0,1fr)", alignItems: "center", gap: 5 }}>
      <span style={{ fontFamily: "var(--font-pixel)", fontSize: 6, letterSpacing: 0.8, color: t4.dim }}>
        {label}
      </span>
      <div style={{ height: thin ? 3 : 4, background: "#0a0d1a" }}>
        <div style={{ width: `${pct}%`, height: "100%", background: color }} />
      </div>
    </div>
  );
}

function MapHud({
  rooms,
  myPosition,
  totalActors,
  zoom,
  pan,
  stageSize,
}: {
  rooms: MiniMapRoom[];
  myPosition: StageActorPosition | null;
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
          />
        ))}
        {myPosition && (
          <div
            aria-label="내 위치"
            style={{
              position: "absolute",
              left: myPosition.left,
              top: myPosition.top,
              width: 8,
              height: 8,
              border: `1px solid ${t4.ink}`,
              background: t4.mp,
              boxShadow: `0 0 8px ${t4.mp}`,
              transform: "translate(-50%, -50%)",
              zIndex: 2,
            }}
          />
        )}
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

function getFeaturedActor(actors: OfficeActor[], selectedActor: OfficeActor | null) {
  return (
    selectedActor ??
    actors.find((actor) => actor.kind === "agent" && actor.status === "working") ??
    actors.find((actor) => actor.kind === "agent") ??
    actors[0] ??
    null
  );
}

function getFeaturedAgent(actors: OfficeActor[], selectedActor: OfficeActor | null) {
  return (
    (selectedActor?.kind === "agent" ? selectedActor : null) ??
    actors.find((actor) => actor.kind === "agent" && actor.status === "working") ??
    actors.find((actor) => actor.kind === "agent") ??
    null
  );
}

function DialogueBox({
  actors,
  selectedActor,
  adminCount,
  onTalk,
  onTasks,
  onDismissAgent,
  dismissBusyId,
  dismissError,
}: {
  actors: OfficeActor[];
  selectedActor: OfficeActor | null;
  adminCount: number;
  onTalk: (actor: OfficeActor) => void;
  onTasks: () => void;
  onDismissAgent: (actor: OfficeActor | null) => void;
  dismissBusyId: number | null;
  dismissError: string;
}) {
  const featured = getFeaturedActor(actors, selectedActor);
  const isAgent = featured?.kind === "agent";
  const featuredAgentId = featured && isAgent ? agentIdFromActor(featured) : null;
  const dismissing = Boolean(featuredAgentId && dismissBusyId === featuredAgentId);
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
          {dismissError && isAgent && (
            <div
              className="mt-2"
              style={{
                fontFamily: "var(--font-mono-arcade)",
                fontSize: 11,
                color: t4.hp,
              }}
            >
              {dismissError}
            </div>
          )}
          <div className="mt-3 flex flex-wrap gap-2">
            {featured ? (
              <DialogueChoice primary onClick={() => onTalk(featured)}>
                <GlyphText glyph="▶">TALK</GlyphText>
              </DialogueChoice>
            ) : null}
            <DialogueChoice onClick={onTasks}>QUESTS</DialogueChoice>
            {isAgent && (
              <DialogueChoice onClick={() => onDismissAgent(featured)} disabled={dismissing}>
                {dismissing ? "FIRING" : "FIRE"}
              </DialogueChoice>
            )}
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
  disabled,
  onClick,
}: {
  children: React.ReactNode;
  primary?: boolean;
  disabled?: boolean;
  onClick?: () => void;
}) {
  const color = primary ? t4.pink : t4.dim;
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      style={{
        fontFamily: "var(--font-pixel)",
        fontSize: 9,
        letterSpacing: 1,
        padding: "8px 12px",
        border: `1px solid ${primary ? t4.pink : t4.line}`,
        color,
        background: primary ? "rgba(255,122,220,0.08)" : "transparent",
        boxShadow: primary ? `0 0 10px ${t4.pink}40` : "none",
        cursor: disabled ? "not-allowed" : "pointer",
        opacity: disabled ? 0.55 : 1,
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

const STAGE_ZOOM_MIN = 0.75;
const STAGE_ZOOM_MAX = 1.5;
const STAGE_ZOOM_STEP = 0.125;
const PLAYER_MOVE_STEP_PX = 18;
const PLAYER_MOVE_FAST_STEP_PX = 30;
const PLAYER_STAGE_BOUNDS = {
  minX: 4,
  maxX: 96,
  minY: 10,
  maxY: 90,
};
const AGENT_TRAVEL_DURATION_MS = 1900;
const PRESENCE_POSITION_THROTTLE_MS = 100;
const QUEST_MARKER_POSITION: StageActorPosition = { left: "61.5%", top: "13.5%" };
const QUEST_INTERACTION_RADIUS_PCT = 6.5;
const ACTOR_INTERACTION_RADIUS_PCT = 7;

function clampStageZoom(value: number) {
  return Math.min(STAGE_ZOOM_MAX, Math.max(STAGE_ZOOM_MIN, Number(value.toFixed(3))));
}

function clampMiniMapValue(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function pct(value: number) {
  return `${Number(value.toFixed(2))}%`;
}

function parseStagePct(value: string) {
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : 50;
}

function moveStagePosition(
  position: StageActorPosition,
  deltaX: number,
  deltaY: number,
): StageActorPosition {
  return {
    left: pct(
      clampMiniMapValue(parseStagePct(position.left) + deltaX, PLAYER_STAGE_BOUNDS.minX, PLAYER_STAGE_BOUNDS.maxX),
    ),
    top: pct(
      clampMiniMapValue(parseStagePct(position.top) + deltaY, PLAYER_STAGE_BOUNDS.minY, PLAYER_STAGE_BOUNDS.maxY),
    ),
  };
}

function getStageDistancePct(a: StageActorPosition, b: StageActorPosition) {
  const dx = parseStagePct(a.left) - parseStagePct(b.left);
  const dy = parseStagePct(a.top) - parseStagePct(b.top);
  return Math.hypot(dx, dy);
}

function sameStagePosition(a: StageActorPosition, b: StageActorPosition) {
  return a.left === b.left && a.top === b.top;
}

function isNearQuestMarker(position: StageActorPosition) {
  return getStageDistancePct(position, QUEST_MARKER_POSITION) <= QUEST_INTERACTION_RADIUS_PCT;
}

function findNearestInteractableActor(
  playerPos: StageActorPosition,
  candidates: Array<{ actor: OfficeActor; position: StageActorPosition }>,
): OfficeActor | null {
  let best: { actor: OfficeActor; distance: number } | null = null;
  for (const candidate of candidates) {
    const distance = getStageDistancePct(playerPos, candidate.position);
    if (distance > ACTOR_INTERACTION_RADIUS_PCT) continue;
    if (!best || distance < best.distance) {
      best = { actor: candidate.actor, distance };
    }
  }
  return best?.actor ?? null;
}

function getPlayerMoveDirection(key: string): { x: number; y: number } | null {
  switch (key.toLowerCase()) {
    case "arrowup":
    case "w":
      return { x: 0, y: -1 };
    case "arrowdown":
    case "s":
      return { x: 0, y: 1 };
    case "arrowleft":
    case "a":
      return { x: -1, y: 0 };
    case "arrowright":
    case "d":
      return { x: 1, y: 0 };
    default:
      return null;
  }
}

function shouldIgnoreStageMovementKey(target: EventTarget | null) {
  if (document.querySelector('[role="dialog"]')) return true;
  if (!(target instanceof HTMLElement)) return false;
  const tagName = target.tagName.toLowerCase();
  return (
    target.isContentEditable ||
    tagName === "input" ||
    tagName === "textarea" ||
    tagName === "select"
  );
}

function buildWorkspacePresenceUrl(workspaceId: number, token: string) {
  if (typeof window === "undefined") return null;
  try {
    const baseUrl = API_BASE ? new URL(API_BASE, window.location.origin).origin : window.location.origin;
    const url = new URL(`/ws/workspaces/${workspaceId}/presence`, baseUrl);
    url.protocol = url.protocol === "https:" ? "wss:" : "ws:";
    url.searchParams.set("token", token);
    return url.toString();
  } catch {
    return null;
  }
}

function parsePresenceMessage(raw: string): Record<string, unknown> | null {
  try {
    const parsed = JSON.parse(raw);
    return isPresenceRecord(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function normalizePresenceSnapshotMember(value: unknown): PresenceSnapshotMember | null {
  if (!isPresenceRecord(value)) return null;
  const memberId = normalizePresenceMemberId(value.memberId);
  if (memberId == null) return null;
  return {
    memberId,
    position: isPresencePosition(value.position) ? value.position : null,
  };
}

function normalizePresenceMemberId(value: unknown) {
  const memberId = Number(value);
  return Number.isFinite(memberId) ? memberId : null;
}

function isPresencePosition(value: unknown): value is StageActorPosition {
  return (
    isPresenceRecord(value) &&
    typeof value.left === "string" &&
    typeof value.top === "string" &&
    Number.isFinite(Number.parseFloat(value.left)) &&
    Number.isFinite(Number.parseFloat(value.top))
  );
}

function isPresenceRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isPresent<T>(value: T | null | undefined): value is T {
  return value != null;
}

function useWorkspacePresence(
  workspaceId: number,
  memberId: number | undefined,
): WorkspacePresenceState {
  const socketRef = useRef<WebSocket | null>(null);
  const pendingPositionRef = useRef<{ position: StageActorPosition; status: PresenceStatus } | null>(null);
  const lastPositionSentAtRef = useRef(0);
  const positionTimerRef = useRef<number | null>(null);
  const [onlineMemberIds, setOnlineMemberIds] = useState<Set<number> | null>(null);
  const [remoteMemberPositions, setRemoteMemberPositions] = useState<Record<number, StageActorPosition>>({});

  const flushPosition = useCallback(() => {
    const pending = pendingPositionRef.current;
    const socket = socketRef.current;
    if (!pending || socket?.readyState !== WebSocket.OPEN) return;
    socket.send(
      JSON.stringify({
        type: "presence.position",
        position: pending.position,
        status: pending.status,
      }),
    );
    pendingPositionRef.current = null;
    lastPositionSentAtRef.current = Date.now();
  }, []);

  const sendPosition = useCallback(
    (position: StageActorPosition, status: PresenceStatus = "walking") => {
      pendingPositionRef.current = { position, status };
      const elapsed = Date.now() - lastPositionSentAtRef.current;
      if (elapsed >= PRESENCE_POSITION_THROTTLE_MS) {
        if (positionTimerRef.current != null) {
          window.clearTimeout(positionTimerRef.current);
          positionTimerRef.current = null;
        }
        flushPosition();
        return;
      }
      if (positionTimerRef.current != null) return;
      positionTimerRef.current = window.setTimeout(() => {
        positionTimerRef.current = null;
        flushPosition();
      }, PRESENCE_POSITION_THROTTLE_MS - elapsed);
    },
    [flushPosition],
  );

  useEffect(() => {
    const token = getAccessToken();
    const url = token ? buildWorkspacePresenceUrl(workspaceId, token) : null;
    if (!memberId || !url) {
      queueMicrotask(() => {
        setOnlineMemberIds(null);
        setRemoteMemberPositions({});
      });
      return;
    }

    let closedByEffect = false;
    const socket = new WebSocket(url);
    socketRef.current = socket;

    socket.onmessage = (event) => {
      const message = parsePresenceMessage(event.data);
      if (!message) return;

      if (message.type === "presence.snapshot") {
        const members = Array.isArray(message.members)
          ? message.members.map(normalizePresenceSnapshotMember).filter(isPresent)
          : [];
        const nextOnlineMemberIds = new Set(members.map((member) => member.memberId));
        nextOnlineMemberIds.add(memberId);
        setOnlineMemberIds(nextOnlineMemberIds);
        setRemoteMemberPositions(
          Object.fromEntries(
            members
              .filter((member) => member.position)
              .map((member) => [member.memberId, member.position as StageActorPosition]),
          ),
        );
        return;
      }

      const messageMemberId = normalizePresenceMemberId(message.memberId);
      if (message.type === "presence.join" && messageMemberId != null) {
        setOnlineMemberIds((prev) => {
          const next = new Set(prev ?? []);
          next.add(messageMemberId);
          next.add(memberId);
          return next;
        });
        return;
      }

      if (message.type === "presence.leave" && messageMemberId != null) {
        setOnlineMemberIds((prev) => {
          if (!prev) return prev;
          const next = new Set(prev);
          next.delete(messageMemberId);
          next.add(memberId);
          return next;
        });
        setRemoteMemberPositions((prev) => {
          if (!(messageMemberId in prev)) return prev;
          const next = { ...prev };
          delete next[messageMemberId];
          return next;
        });
        return;
      }

      if (
        message.type === "presence.position" &&
        messageMemberId != null &&
        isPresencePosition(message.position)
      ) {
        const nextPosition = message.position;
        setRemoteMemberPositions((prev) => ({
          ...prev,
          [messageMemberId]: nextPosition,
        }));
      }
    };

    socket.onclose = () => {
      if (socketRef.current === socket) socketRef.current = null;
      if (!closedByEffect) {
        setOnlineMemberIds(null);
        setRemoteMemberPositions({});
      }
    };

    return () => {
      closedByEffect = true;
      if (socketRef.current === socket) socketRef.current = null;
      socket.close();
    };
  }, [memberId, workspaceId]);

  useEffect(() => {
    return () => {
      if (positionTimerRef.current != null) {
        window.clearTimeout(positionTimerRef.current);
      }
    };
  }, []);

  return { onlineMemberIds, remoteMemberPositions, sendPosition };
}

const AGENT_DESK_COL_CENTERS = [16, 33, 50, 67];
const AGENT_DESK_W_PCT = 14;
const ENGINEERING_LEFT_PCT = 5.5;
const ENGINEERING_TOP_PCT = 8.5;
const ENGINEERING_WIDTH_PCT = 30.5;

function getEngineeringRows(agentCount: number): number {
  return Math.max(2, Math.ceil(Math.max(agentCount, 1) / AGENT_DESK_COL_CENTERS.length));
}

function getEngineeringHeightPct(rows: number): number {
  return Math.min(78, 37 + Math.max(0, rows - 2) * 12);
}

function getDeskRowCenters(rows: number): number[] {
  if (rows <= 1) return [55];
  if (rows === 2) return [38.5, 67.5];
  const start = 28;
  const end = 82;
  const step = (end - start) / (rows - 1);
  return Array.from({ length: rows }, (_, i) => start + i * step);
}

function getDeskHeightPct(rows: number): number {
  if (rows <= 2) return 15;
  return Math.max(8, Math.min(15, 60 / rows));
}

function getStageRooms(engineeringRows: number): StageRoomSpec[] {
  const engineeringHeight = getEngineeringHeightPct(engineeringRows);
  const huddleLeft = ENGINEERING_LEFT_PCT + ENGINEERING_WIDTH_PCT + 2.2;
  return [
    {
      label: "♦ ENGINEERING",
      left: pct(ENGINEERING_LEFT_PCT),
      top: pct(ENGINEERING_TOP_PCT),
      width: pct(ENGINEERING_WIDTH_PCT),
      height: pct(engineeringHeight),
      color: t4.pink,
      variant: "engineering",
    },
    {
      label: "♦ HUDDLE",
      left: pct(huddleLeft),
      top: pct(8.5),
      width: pct(21.6),
      height: pct(24.5),
      color: t4.mp,
      variant: "huddle",
    },
    {
      label: "♦ LOUNGE · REST ZONE",
      left: pct(27),
      top: pct(Math.max(38, ENGINEERING_TOP_PCT + engineeringHeight + 2)),
      width: pct(32.8),
      height: pct(33.6),
      color: t4.ok,
      variant: "rest",
    },
  ];
}

function getAgentPositionInStage(
  agentIdx: number,
  rows: number,
  room: StageRoomSpec,
): StageActorPosition {
  const cols = AGENT_DESK_COL_CENTERS.length;
  const col = agentIdx % cols;
  const row = Math.floor(agentIdx / cols);
  const cx = AGENT_DESK_COL_CENTERS[col];
  const deskCy = getDeskRowCenters(rows)[row] ?? getDeskRowCenters(rows)[rows - 1];
  const deskH = getDeskHeightPct(rows);
  // sit avatar so feet land on the top edge of the desk
  const cy = deskCy - deskH * 0.3;
  const roomLeft = parseFloat(room.left);
  const roomTop = parseFloat(room.top);
  const roomW = parseFloat(room.width);
  const roomH = parseFloat(room.height);
  return {
    left: pct(roomLeft + (cx / 100) * roomW),
    top: pct(roomTop + (cy / 100) * roomH),
  };
}

function getAgentLoungePosition(agentIdx: number, room: StageRoomSpec): StageActorPosition {
  const slot = AGENT_LOUNGE_POSITIONS[agentIdx % AGENT_LOUNGE_POSITIONS.length];
  const round = Math.floor(agentIdx / AGENT_LOUNGE_POSITIONS.length);
  const roomLeft = parseFloat(room.left);
  const roomTop = parseFloat(room.top);
  const roomW = parseFloat(room.width);
  const roomH = parseFloat(room.height);
  const offset = (round % 2) * 4;
  return {
    left: pct(roomLeft + ((slot.x + offset) / 100) * roomW),
    top: pct(roomTop + ((slot.y + offset) / 100) * roomH),
  };
}

function getStageMiniMapRooms(rooms: StageRoomSpec[]): MiniMapRoom[] {
  return rooms.map((room) => ({
    color: room.color,
    label: room.label,
    x: room.left,
    y: room.top,
    w: room.width,
    h: room.height,
    count: 0,
  }));
}

const MEMBER_POSITIONS: StageActorPosition[] = [
  { left: "49.2%", top: "27%" },
  { left: "55.6%", top: "33%" },
  { left: "12.3%", top: "62.5%" },
  { left: "33.4%", top: "66.5%" },
  { left: "51.8%", top: "66.5%" },
  { left: "44.0%", top: "62.5%" },
  { left: "60.5%", top: "27%" },
  { left: "16.8%", top: "70%" },
];

const AGENT_LOUNGE_POSITIONS = [
  { x: 20, y: 70 },
  { x: 42, y: 58 },
  { x: 64, y: 68 },
  { x: 76, y: 42 },
  { x: 30, y: 36 },
  { x: 52, y: 80 },
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
  workspaceId,
  actors,
  tasks,
  error,
}: {
  open: boolean;
  onClose: () => void;
  workspaceId: number;
  actors: OfficeActor[];
  tasks: WorkspaceTask[];
  error: string;
}) {
  const [activeTab, setActiveTab] = useState<"summary" | "board">("summary");
  const [apiSummary, setApiSummary] = useState<WorkspaceDashboardSummary | null>(null);
  const [selectedTask, setSelectedTask] = useState<WorkspaceTask | null>(null);
  const localSummary = useMemo(() => buildDashboardSummary(actors, tasks), [actors, tasks]);
  const summary = useMemo(
    () => (apiSummary ? mergeDashboardSummary(apiSummary, localSummary) : localSummary),
    [apiSummary, localSummary],
  );

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    getWorkspaceDashboardSummary(workspaceId)
      .then((nextSummary) => {
        if (cancelled) return;
        setApiSummary(nextSummary);
      })
      .catch(() => {
        if (cancelled) return;
        setApiSummary(null);
      });
    return () => {
      cancelled = true;
    };
  }, [open, workspaceId]);

  useEffect(() => {
    if (!open) setSelectedTask(null);
  }, [open]);

  return (
    <Modal open={open} onClose={onClose} title="DASHBOARD 워크스페이스 현황" size="full">
      <Modal.Body className="flex min-h-[62vh] flex-col gap-5">
        {error && (
          <p className="rounded-md border border-danger/30 bg-danger/10 px-3 py-2 text-caption text-danger">
            {error}
          </p>
        )}

        <div className="grid shrink-0 grid-cols-2" style={{ border: `1px solid ${t4.line}` }}>
          <DashboardTab active={activeTab === "summary"} onClick={() => setActiveTab("summary")}>
            Summary
          </DashboardTab>
          <DashboardTab active={activeTab === "board"} onClick={() => setActiveTab("board")}>
            Board
          </DashboardTab>
        </div>

        {activeTab === "summary" ? (
          <DashboardSummaryView summary={summary} actors={actors} />
        ) : (
          <section className="grid h-[62vh] min-h-[420px] min-w-0 overflow-hidden gap-4">
            <div className="grid min-h-0 min-w-0 gap-4 overflow-hidden lg:grid-cols-[repeat(4,minmax(0,1fr))]">
              {TASK_BOARD_GROUPS.map((group) => (
                <TaskColumn
                  key={group.key}
                  group={group}
                  tasks={tasks.filter((task) => group.statuses.includes(task.status))}
                  actors={actors}
                  selectedTaskId={selectedTask?.taskId}
                  onTaskSelect={setSelectedTask}
                />
              ))}
            </div>
            <TaskDetailModal
              open={!!selectedTask}
              onClose={() => setSelectedTask(null)}
              workspaceId={workspaceId}
              task={selectedTask}
            />
          </section>
        )}
      </Modal.Body>
      <Modal.Footer>
        <span
          className="mr-auto"
          style={{
            fontFamily: "var(--font-mixed-ko)",
            fontSize: 11,
            color: t4.dim,
          }}
        >
          <GlyphText glyph="◇">3초마다 자동 갱신</GlyphText>
        </span>
        <Button type="button" variant="ghost" onClick={onClose}>닫기</Button>
      </Modal.Footer>
    </Modal>
  );
}

function DashboardTab({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="px-3 py-2"
      style={{
        border: "none",
        borderBottom: `2px solid ${active ? t4.xp : "transparent"}`,
        background: active ? `${t4.xp}12` : "rgba(0,0,0,0.25)",
        color: active ? t4.xp : t4.dim,
        cursor: "pointer",
        fontFamily: "var(--font-pixel)",
        fontSize: 9,
        letterSpacing: 1.5,
        textTransform: "uppercase",
        textShadow: active ? `0 0 6px ${t4.xp}` : "none",
      }}
    >
      {children}
    </button>
  );
}

function DashboardSummaryView({
  summary,
  actors,
}: {
  summary: DashboardSummaryData;
  actors: OfficeActor[];
}) {
  return (
    <section className="grid h-[62vh] min-h-[420px] min-w-0 gap-4 overflow-hidden xl:grid-cols-[minmax(0,1.15fr)_minmax(360px,0.85fr)]">
      <div className="flex min-h-0 min-w-0 flex-col gap-4 overflow-y-auto pr-1">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <SummaryMetric label="Agents" value={summary.agents.total} color={t4.agent} sub="전체" />
          <SummaryMetric label="Working" value={summary.agents.working} color={t4.ok} sub="작업 중" />
          <SummaryMetric label="Idle" value={summary.agents.idle} color={t4.mp} sub="대기" />
          <SummaryMetric label="Need Check" value={summary.agents.blocked} color={t4.hp} sub="확인 필요" />
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <SummaryMetric label="Tasks" value={summary.tasks.total} color={t4.pink} sub="전체" />
          <SummaryMetric label="In Progress" value={summary.tasks.inProgress} color={t4.ok} sub="진행" />
          <SummaryMetric label="Completed" value={summary.tasks.completed} color={t4.xp} sub="완료" />
          <SummaryMetric label="Failed" value={summary.tasks.failed + summary.tasks.canceled} color={t4.hp} sub="실패/취소" />
        </div>

        <SummaryPanel title="최근 Task" accent={t4.mp}>
          <SummaryTaskList tasks={summary.recentTasks} actors={actors} emptyText="최근 태스크가 없습니다." />
        </SummaryPanel>
      </div>

      <div className="flex min-h-0 min-w-0 flex-col gap-4 overflow-y-auto pr-1">
        <SummaryPanel title="확인 필요" accent={t4.hp}>
          <SummaryIssueList issues={summary.issues} />
        </SummaryPanel>
        <SummaryPanel title="최근 완료 보고" accent={t4.xp}>
          <SummaryReportList reports={summary.recentReports} />
        </SummaryPanel>
      </div>
    </section>
  );
}

function SummaryMetric({
  label,
  value,
  color,
  sub,
}: {
  label: string;
  value: number;
  color: string;
  sub: string;
}) {
  return (
    <div
      className="min-w-0 p-4"
      style={{
        border: `1px solid ${color}`,
        background: "rgba(10,13,26,0.72)",
        boxShadow: `inset 0 0 18px ${color}0f, 0 0 10px ${color}1f`,
      }}
    >
      <p
        className="truncate"
        style={{
          color,
          fontFamily: "var(--font-pixel)",
          fontSize: 8,
          letterSpacing: 1.5,
          textTransform: "uppercase",
          textShadow: `0 0 6px ${color}`,
          margin: 0,
        }}
      >
        {label}
      </p>
      <p
        className="mt-2"
        style={{
          color: t4.ink,
          fontFamily: "var(--font-pixel)",
          fontSize: 20,
          letterSpacing: 1,
          margin: 0,
        }}
      >
        {String(value).padStart(2, "0")}
      </p>
      <p className="mt-1 truncate" style={{ color: t4.dim, fontFamily: "var(--font-mixed-ko)", fontSize: 11, margin: 0 }}>
        {sub}
      </p>
    </div>
  );
}

function SummaryPanel({
  title,
  accent,
  children,
}: {
  title: string;
  accent: string;
  children: ReactNode;
}) {
  return (
    <div
      className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden p-4"
      style={{
        border: `1px solid ${accent}`,
        background: "rgba(10,13,26,0.72)",
        boxShadow: `inset 0 0 22px ${accent}10, 0 0 12px ${accent}18`,
      }}
    >
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
        {title}
      </h3>
      <div className="mt-3 flex min-h-0 min-w-0 flex-1 flex-col overflow-y-auto">{children}</div>
    </div>
  );
}

function SummaryTaskList({
  tasks,
  actors,
  emptyText,
}: {
  tasks: WorkspaceTask[];
  actors: OfficeActor[];
  emptyText: string;
}) {
  if (tasks.length === 0) {
    return <SummaryEmptyText>{emptyText}</SummaryEmptyText>;
  }
  return (
    <div className="flex flex-col gap-2">
      {tasks.map((task) => {
        const meta = TASK_STATUS_META[task.status];
        return (
          <div
            key={task.taskId}
            className="min-w-0 p-3"
            style={{
              border: `1px solid ${t4.line}`,
              background: "rgba(20,28,55,0.62)",
            }}
          >
            <div className="flex min-w-0 items-start justify-between gap-2">
              <p
                className="min-w-0 break-words"
                style={{ color: t4.ink, fontFamily: "var(--font-mixed-ko)", fontSize: 12, fontWeight: 700, lineHeight: 1.45, margin: 0 }}
              >
                {task.title}
              </p>
              <span
                className="shrink-0 px-2 py-0.5"
                style={{ border: `1px solid ${t4.line}`, color: t4.xp, fontFamily: "var(--font-pixel)", fontSize: 7, letterSpacing: 1 }}
              >
                {meta.label}
              </span>
            </div>
            <p className="mt-2 truncate" style={{ color: t4.dim, fontFamily: "var(--font-mixed-ko)", fontSize: 11, marginBottom: 0 }}>
              {taskAssigneeName(task, actors)} · {formatDashboardTime(task.updatedAt ?? task.createdAt)}
            </p>
          </div>
        );
      })}
    </div>
  );
}

function SummaryIssueList({ issues }: { issues: DashboardIssue[] }) {
  if (issues.length === 0) {
    return <SummaryEmptyText>확인 필요한 항목이 없습니다.</SummaryEmptyText>;
  }
  return (
    <div className="flex flex-col gap-2">
      {issues.map((issue) => (
        <div
          key={issue.id}
          className="min-w-0 p-3"
          style={{ border: `1px solid ${issue.color}`, background: `${issue.color}0d` }}
        >
          <p className="min-w-0 break-words" style={{ color: issue.color, fontFamily: "var(--font-mixed-ko)", fontSize: 12, fontWeight: 700, margin: 0 }}>
            {issue.title}
          </p>
          <p className="mt-1 min-w-0 break-words" style={{ color: t4.dim, fontFamily: "var(--font-mixed-ko)", fontSize: 11, lineHeight: 1.45, marginBottom: 0 }}>
            {issue.detail}
          </p>
        </div>
      ))}
    </div>
  );
}

function SummaryReportList({ reports }: { reports: DashboardReportItem[] }) {
  if (reports.length === 0) {
    return <SummaryEmptyText>완료된 보고가 없습니다.</SummaryEmptyText>;
  }
  return (
    <div className="flex flex-col gap-2">
      {reports.map((report) => (
        <div
          key={report.id}
          className="min-w-0 p-3"
          style={{
            border: `1px solid ${t4.line}`,
            background: "rgba(20,28,55,0.62)",
          }}
        >
          <p
            className="min-w-0 break-words"
            style={{
              color: t4.ink,
              fontFamily: "var(--font-mixed-ko)",
              fontSize: 12,
              fontWeight: 700,
              lineHeight: 1.45,
              margin: 0,
            }}
          >
            {report.title}
          </p>
          <p
            className="mt-2 line-clamp-2 min-w-0 break-words"
            style={{
              color: t4.dim,
              fontFamily: "var(--font-mixed-ko)",
              fontSize: 11,
              lineHeight: 1.45,
              marginBottom: 0,
            }}
          >
            {report.summary}
          </p>
          <p className="mt-2 truncate" style={{ color: t4.dim, fontFamily: "var(--font-mixed-ko)", fontSize: 11, marginBottom: 0 }}>
            {formatDashboardTime(report.createdAt)}
          </p>
        </div>
      ))}
    </div>
  );
}

function SummaryEmptyText({ children }: { children: ReactNode }) {
  return (
    <div
      className="flex min-h-[120px] flex-1 flex-col items-center justify-center gap-2 px-4 py-6"
      style={{
        border: `1px dashed ${t4.line}`,
        background: "rgba(20,28,55,0.32)",
      }}
    >
      <span
        aria-hidden
        style={{
          color: t4.dim,
          fontFamily: "var(--font-pixel)",
          fontSize: 18,
          letterSpacing: 4,
          opacity: 0.7,
          textShadow: `0 0 6px ${t4.line}`,
        }}
      >
        - - -
      </span>
      <p
        style={{
          color: t4.dim,
          fontFamily: "var(--font-mixed-ko)",
          fontSize: 11,
          letterSpacing: 0.5,
          margin: 0,
          textAlign: "center",
        }}
      >
        {children}
      </p>
    </div>
  );
}

function TaskColumn({
  group,
  tasks,
  actors,
  selectedTaskId,
  onTaskSelect,
}: {
  group: (typeof TASK_BOARD_GROUPS)[number];
  tasks: WorkspaceTask[];
  actors: OfficeActor[];
  selectedTaskId?: number;
  onTaskSelect?: (task: WorkspaceTask) => void;
}) {
  const accent = taskGroupAccent(group.key);
  return (
    <div
      className="flex min-h-0 min-w-0 flex-col overflow-hidden p-4"
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
      <div className="mt-3 flex min-h-0 min-w-0 flex-1 flex-col gap-2 overflow-y-auto pr-1">
        {tasks.length > 0 ? (
          tasks.map((task) => (
            <button
              key={task.taskId}
              type="button"
              onClick={() => onTaskSelect?.(task)}
              className="min-w-0 shrink-0 overflow-hidden px-3 py-2 text-left"
              style={{
                width: "100%",
                border: `1px solid ${selectedTaskId === task.taskId ? accent : t4.line}`,
                background: "rgba(20,28,55,0.7)",
                boxShadow: selectedTaskId === task.taskId
                  ? `0 0 10px ${accent}24`
                  : "inset 0 0 12px rgba(154,122,255,0.05)",
                cursor: "pointer",
              }}
            >
              <div className="flex min-w-0 items-start justify-between gap-2">
                <p
                  className="min-w-0 break-all"
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
                  className="mt-2 line-clamp-2 min-w-0 break-all"
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
                className="mt-2 min-w-0 truncate"
                style={{
                  fontFamily: "var(--font-pixel)",
                  fontSize: 7,
                  letterSpacing: 1,
                  color: t4.dim,
                }}
              >
                {taskAssigneeName(task, actors)}
              </p>
            </button>
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
  if (key === "waiting") return t4.mp;
  if (key === "progress") return t4.pink;
  if (key === "stopped") return t4.hp;
  return t4.ok;
}

function taskDisplayGroup(status: TaskStatus) {
  if (status === "REQUESTED" || status === "ASSIGNED") {
    return { key: "waiting", label: "대기" };
  }
  if (status === "IN_PROGRESS" || status === "WAITING_USER") {
    return { key: "progress", label: "진행" };
  }
  if (status === "FAILED" || status === "CANCELED") {
    return { key: "stopped", label: "중단" };
  }
  return { key: "completed", label: "완료" };
}

function AgentHireModal({
  open,
  onClose,
  name,
  onNameChange,
  role,
  onRoleChange,
  workspacePath,
  onWorkspacePathChange,
  emoji,
  onEmojiChange,
  skillFiles,
  onSkillFileAdd,
  onSkillFileChange,
  onSkillFileRemove,
  error,
  submitting,
  onSubmit,
}: {
  open: boolean;
  onClose: () => void;
  name: string;
  onNameChange: (value: string) => void;
  role: AgentRole;
  onRoleChange: (value: AgentRole) => void;
  workspacePath: string;
  onWorkspacePathChange: (value: string) => void;
  emoji: string;
  onEmojiChange: (value: string) => void;
  skillFiles: AgentSkillFileDraft[];
  onSkillFileAdd: () => void;
  onSkillFileChange: (
    skillFileId: string,
    field: "fileName" | "content",
    value: string,
  ) => void;
  onSkillFileRemove: (skillFileId: string) => void;
  error: string;
  submitting: boolean;
  onSubmit: (e: FormEvent) => void;
}) {
  const selectedRole = AGENT_ROLE_OPTIONS.find((option) => option.value === role);

  return (
    <Modal open={open} onClose={onClose} title="Agent 고용" size="md">
      <form onSubmit={onSubmit} className="flex min-h-0 flex-1 flex-col">
        <Modal.Body className="grid min-h-0 gap-5 md:grid-cols-[minmax(0,1fr)_260px]">
          <div className="flex flex-col gap-4">
            <div className="rounded-lg border border-[var(--neon-border-muted)] bg-surface-raised/70 p-4">
              <p className="text-body font-semibold text-text">Agent 출근 설정</p>
              <p className="mt-1 text-caption text-text-muted">
                OpenClaw 게이트웨이에 새 에이전트를 생성합니다. workspace 경로와 이모지는 선택값입니다.
              </p>
            </div>

            <Field label="Agent 이름">
              <Input
                value={name}
                onChange={(e) => onNameChange(e.target.value)}
                placeholder="예) 백엔드 에이전트"
                autoFocus
                disabled={submitting}
              />
            </Field>

            <label className="flex flex-col gap-1.5">
              <span className="text-caption text-text-secondary">역할 (UI 분류용)</span>
              <select
                value={role}
                onChange={(e) => onRoleChange(e.target.value as AgentRole)}
                disabled={submitting}
                className="h-9 w-full rounded-md border border-[var(--neon-border-muted)] bg-surface px-3 text-body text-text focus:border-primary-light focus:outline-none focus:ring-2 focus:ring-primary-light/50 disabled:opacity-60"
              >
                {AGENT_ROLE_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>

            <Field label="Workspace Path (선택)">
              <Input
                value={workspacePath}
                onChange={(e) => onWorkspacePathChange(e.target.value)}
                placeholder="/workspace/backend"
                disabled={submitting}
              />
            </Field>

            <Field label="Emoji (선택)">
              <Input
                value={emoji}
                onChange={(e) => onEmojiChange(e.target.value)}
                placeholder="🤖"
                disabled={submitting}
              />
            </Field>

            <div className="rounded-lg border border-[var(--neon-border-muted)] bg-surface-raised/50 p-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-body font-semibold text-text">Skill 파일</p>
                  <p className="mt-1 text-caption text-text-muted">
                    추가하지 않으면 서버 기본 템플릿만 사용합니다.
                  </p>
                </div>
                <Button type="button" variant="secondary" onClick={onSkillFileAdd} disabled={submitting}>
                  추가
                </Button>
              </div>
              {skillFiles.length > 0 && (
                <div className="mt-4 grid gap-3">
                  {skillFiles.map((skillFile, index) => (
                    <div key={skillFile.id} className="rounded-md border border-border bg-surface p-3">
                      <div className="flex items-center justify-between gap-3">
                        <span className="text-caption text-text-muted">Skill {index + 1}</span>
                        <button
                          type="button"
                          onClick={() => onSkillFileRemove(skillFile.id)}
                          disabled={submitting}
                          className="text-caption text-text-muted hover:text-text disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          삭제
                        </button>
                      </div>
                      <div className="mt-3 grid gap-3">
                        <Input
                          value={skillFile.fileName}
                          onChange={(e) => onSkillFileChange(skillFile.id, "fileName", e.target.value)}
                          placeholder="backend-agent.md"
                          disabled={submitting}
                        />
                        <textarea
                          value={skillFile.content}
                          onChange={(e) => onSkillFileChange(skillFile.id, "content", e.target.value)}
                          placeholder="# Role&#10;- 이 Agent가 따라야 할 작업 규칙을 작성하세요."
                          disabled={submitting}
                          rows={5}
                          className="w-full resize-y rounded-md border border-[var(--neon-border-muted)] bg-surface px-3 py-2 text-body text-text focus:border-primary-light focus:outline-none focus:ring-2 focus:ring-primary-light/50 disabled:opacity-60"
                        />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {error && <p className="text-caption text-danger">{error}</p>}
          </div>

          <div className="rounded-lg border border-[var(--neon-border-muted)] bg-surface p-4">
            <div className="mx-auto flex h-24 w-24 items-center justify-center">
              <PixelAvatar kind="agent" size={3} walking={!submitting} />
            </div>
            {emoji.trim() && (
              <div className="mt-2 text-center text-title">{emoji.trim()}</div>
            )}
            <h3 className="mt-4 text-title text-text">{selectedRole?.label}</h3>
            <p className="mt-1 text-caption text-text-muted">
              {selectedRole?.description}
            </p>
            <div className="mt-4 grid gap-2 text-caption">
              <Info label="Status" value="출근 대기" />
              <Info label="Sync" value="OpenClaw 연동" />
              <Info label="Seat" value="자동 배치" />
            </div>
          </div>
        </Modal.Body>

        <Modal.Footer>
          <Button type="button" variant="ghost" onClick={onClose} disabled={submitting}>
            닫기
          </Button>
          <Button type="submit" icon={<UserPlus />} loading={submitting}>
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
  saved,
  error,
  notice,
  submitting,
  deleting,
  onInstall,
  onDelete,
}: {
  open: boolean;
  onClose: () => void;
  onBack: () => void;
  isAdmin: boolean;
  saved: SlackIntegration | null;
  error: string;
  notice: string;
  submitting: boolean;
  deleting: boolean;
  onInstall: () => void;
  onDelete: () => void;
}) {
  return (
    <Modal open={open} onClose={onClose} title="Slack 연동" size="md">
      <Modal.Body className="grid gap-5 md:grid-cols-[minmax(0,1fr)_260px]">
        <div className="flex flex-col gap-4">
          <div className="rounded-lg border border-[var(--neon-border-muted)] bg-surface p-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-md bg-primary-muted text-primary">
              <Bell />
            </div>
            <h3 className="mt-4 text-title text-text">Slack OAuth 연결</h3>
            <p className="mt-2 text-body text-text-muted">
              Slack 승인 화면으로 이동해 워크스페이스와 채널 권한을 승인합니다.
            </p>
            <Button
              type="button"
              className="mt-4"
              variant="secondary"
              icon={<Bell />}
              loading={submitting}
              disabled={!isAdmin || deleting}
              onClick={onInstall}
              style={{
                fontFamily: "var(--font-mixed-ko)",
                textTransform: "none",
                letterSpacing: "normal",
                fontSize: 12,
                fontWeight: 600,
                borderColor: t4.ok,
                color: t4.ok,
                boxShadow: "none",
              }}
            >
              {saved ? "Slack 다시 연동하기" : "Slack 연동하기"}
            </Button>
          </div>
          {!isAdmin && (
            <p className="text-caption text-danger">
              Slack 연동은 워크스페이스 ADMIN만 설정할 수 있습니다.
            </p>
          )}
          {error && <p className="text-caption text-danger">{error}</p>}
          {notice && <p className="text-caption text-success">{notice}</p>}
        </div>

        <div className="relative min-h-[260px] rounded-lg border border-border bg-surface-raised/70 p-4 pb-12">
          <div className="flex h-10 w-10 items-center justify-center rounded-md bg-primary-muted text-primary">
            {saved ? <CheckCircle2 /> : <KeyRound />}
          </div>
          <h3 className="mt-4 text-title text-text">저장 상태</h3>
          <p className="mt-1 text-caption text-text-muted">
            저장된 Slack 연동 정보가 자동으로 표시됩니다.
          </p>
          {saved ? (
            <div className="mt-4 grid gap-2 text-caption">
              <Info label="ID" value={String(saved.id)} />
              <Info label="Team" value={saved.slackTeamId} />
              <Info label="Channel" value={saved.slackChannelId} />
              <Info label="Token" value={saved.maskedBotToken} />
            </div>
          ) : (
            <p className="mt-4 text-caption text-text-muted">
              저장된 Slack 연동 정보가 없습니다.
            </p>
          )}
          {saved && (
            <div className="absolute bottom-3 right-3 flex items-center gap-2">
              <button
                type="button"
                onClick={onDelete}
                disabled={!isAdmin || submitting || deleting}
                className="text-caption text-text-muted hover:text-text disabled:cursor-not-allowed disabled:opacity-50"
              >
                {deleting ? "삭제 중" : "삭제"}
              </button>
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
      </Modal.Footer>
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
  isAdmin,
  displayName,
  onDisplayNameChange,
  token,
  onTokenChange,
  saved,
  error,
  notice,
  submitting,
  deleting,
  onSubmit,
  onDelete,
}: {
  open: boolean;
  onClose: () => void;
  onBack: () => void;
  isAdmin: boolean;
  displayName: string;
  onDisplayNameChange: (value: string) => void;
  token: string;
  onTokenChange: (value: string) => void;
  saved: GithubCredentialInfo | null;
  error: string;
  notice: string;
  submitting: boolean;
  deleting: boolean;
  onSubmit: (e: FormEvent) => void;
  onDelete: () => void;
}) {
  return (
    <Modal open={open} onClose={onClose} title="GitHub 연결" size="md">
      <form onSubmit={onSubmit}>
        <Modal.Body className="grid gap-5 md:grid-cols-[minmax(0,1fr)_260px]">
          <div className="flex flex-col gap-4">
            <Field label="Display Name">
              <Input
                value={displayName}
                onChange={(e) => onDisplayNameChange(e.target.value)}
                placeholder="main github token"
                disabled={!isAdmin || submitting}
              />
            </Field>
            <Field label="Personal Access Token">
              <Input
                type="password"
                value={token}
                onChange={(e) => onTokenChange(e.target.value)}
                placeholder={saved ? "변경할 때만 입력" : "ghp_..."}
                disabled={!isAdmin || submitting}
              />
            </Field>
            {!isAdmin && (
              <p className="text-caption text-danger">
                GitHub 연결은 워크스페이스 ADMIN만 설정할 수 있습니다.
              </p>
            )}
            {error && <p className="text-caption text-danger">{error}</p>}
            {notice && <p className="text-caption text-success">{notice}</p>}
          </div>

          <div className="relative min-h-[260px] rounded-lg border border-border bg-surface-raised/70 p-4 pb-12">
            <div className="flex h-10 w-10 items-center justify-center rounded-md bg-primary-muted text-primary">
              {saved ? <CheckCircle2 /> : <GitBranch />}
            </div>
            <h3 className="mt-4 text-title text-text">저장 상태</h3>
            <p className="mt-1 text-caption text-text-muted">
              저장된 GitHub 연결 정보가 자동으로 표시됩니다.
            </p>
            {saved ? (
              <div className="mt-4 grid gap-2 text-caption">
                <Info label="ID" value={String(saved.id)} />
                <Info label="Name" value={saved.displayName} />
                <Info label="Token" value={saved.maskedToken} />
              </div>
            ) : (
              <p className="mt-4 text-caption text-text-muted">
                저장된 GitHub 연결 정보가 없습니다.
              </p>
            )}
            {saved && (
              <div className="absolute bottom-3 right-3 flex items-center gap-2">
                <button
                  type="submit"
                  disabled={!isAdmin || deleting || submitting}
                  className="text-caption text-text-muted hover:text-text disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {submitting ? "저장 중" : "수정"}
                </button>
                <span className="text-caption text-text-dim">·</span>
                <button
                  type="button"
                  onClick={onDelete}
                  disabled={!isAdmin || submitting || deleting}
                  className="text-caption text-text-muted hover:text-text disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {deleting ? "삭제 중" : "삭제"}
                </button>
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
          {!saved && (
            <Button type="submit" icon={<KeyRound />} loading={submitting} disabled={!isAdmin}>
              연결 저장
            </Button>
          )}
        </Modal.Footer>
      </form>
    </Modal>
  );
}

function OpenClawIntegrationModal({
  open,
  onClose,
  onBack,
  gatewayUrl,
  onGatewayUrlChange,
  token,
  onTokenChange,
  saved,
  error,
  notice,
  submitting,
  onSubmit,
  testing,
  onTest,
}: {
  open: boolean;
  onClose: () => void;
  onBack: () => void;
  gatewayUrl: string;
  onGatewayUrlChange: (value: string) => void;
  token: string;
  onTokenChange: (value: string) => void;
  saved: WorkspaceGatewayStatus | null;
  error: string;
  notice: string;
  submitting: boolean;
  testing: boolean;
  onSubmit: (e: FormEvent) => void;
  onTest: () => void;
}) {
  const busy = submitting || testing;
  return (
    <Modal open={open} onClose={onClose} title="AI / OpenClaw 연동" size="md">
      <form onSubmit={onSubmit}>
        <Modal.Body className="grid gap-5 md:grid-cols-[minmax(0,1fr)_260px]">
          <div className="flex flex-col gap-4">
            <Field label="Gateway URL">
              <Input
                value={gatewayUrl}
                onChange={(e) => onGatewayUrlChange(e.target.value)}
                placeholder="ws://127.0.0.1:18789"
                disabled={busy}
              />
            </Field>
            <Field label="Token">
              <Input
                type="password"
                value={token}
                onChange={(e) => onTokenChange(e.target.value)}
                placeholder="OpenClaw gateway token"
                disabled={busy}
              />
            </Field>
            <div className="flex justify-end">
              <Button type="button" variant="secondary" onClick={onTest} loading={testing} disabled={submitting}>
                연결 테스트
              </Button>
            </div>
            {error && <p className="text-caption text-danger">{error}</p>}
            {notice && <p className="text-caption text-success">{notice}</p>}
          </div>

          <div className="relative min-h-[260px] rounded-lg border border-border bg-surface-raised/70 p-4 pb-12">
            <div className="flex h-10 w-10 items-center justify-center rounded-md bg-primary-muted text-primary">
              {saved?.bound ? <CheckCircle2 /> : <Bot />}
            </div>
            <h3 className="mt-4 text-title text-text">Gateway 상태</h3>
            <p className="mt-1 text-caption text-text-muted">
              저장된 Gateway 연결 상태를 API 기준으로 표시합니다.
            </p>
            {saved?.bound && (
              <div className="mt-4 grid gap-2 text-caption">
                <Info label="ID" value={String(saved.bindingId ?? "-")} />
                <Info label="Mode" value={saved.mode ?? "-"} />
                <Info label="URL" value={saved.gatewayUrl ?? "-"} />
                <Info label="Token" value={saved.maskedToken ?? "-"} />
                <Info label="Status" value={gatewayStatusLabel(saved)} />
                {saved.lastError && <Info label="Error" value={saved.lastError} />}
              </div>
            )}
            {saved && !saved.bound && (
              <p className="mt-4 text-caption text-text-muted">연결된 Gateway가 없습니다.</p>
            )}
            {saved?.bound && (
              <div className="absolute bottom-3 right-3 flex items-center gap-2">
                <button
                  type="submit"
                  disabled={busy}
                  className="text-caption text-text-muted hover:text-text disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {submitting ? "저장 중" : "수정"}
                </button>
              </div>
            )}
          </div>
        </Modal.Body>
        <Modal.Footer>
          <Button type="button" variant="ghost" icon={<ArrowLeft />} onClick={onBack} disabled={busy}>
            채널 설정
          </Button>
          <Button type="button" variant="ghost" onClick={onClose} disabled={busy}>
            닫기
          </Button>
          {!saved?.bound && (
            <Button type="submit" icon={<KeyRound />} loading={submitting} disabled={testing}>
              연결 저장
            </Button>
          )}
        </Modal.Footer>
      </form>
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

function toHiredAgent(agent: OpenClawAgent | HiredAgent): HiredAgent {
  if ("role" in agent) return agent;

  return {
    id: String(agent.agentId),
    agentId: agent.agentId,
    name: agent.name,
    role: categoryToAgentRole(agent.category),
    openClawAgentId: agent.openClawAgentId,
    workspacePath: agent.workspacePath,
    status: agent.status === "READY" ? "idle" : "blocked",
    apiStatus: agent.status,
    hiredAt: "",
  };
}

function agentRoleToCategory(role: AgentRole): OpenClawAgent["category"] {
  if (role === "ORCHESTRATOR") return "ORCHESTRATOR";
  if (role === "BACKEND") return "BACKEND";
  if (role === "FRONTEND") return "FRONTEND";
  if (role === "QA") return "QA";
  return "CUSTOM";
}

function categoryToAgentRole(category: OpenClawAgent["category"]): AgentRole {
  if (category === "ORCHESTRATOR") return "ORCHESTRATOR";
  if (category === "BACKEND") return "BACKEND";
  if (category === "FRONTEND") return "FRONTEND";
  if (category === "QA") return "QA";
  return "CUSTOM";
}

function normalizeAgentSkillFiles(skillFiles: AgentSkillFileDraft[]): AgentSkillFile[] | null {
  const normalized: AgentSkillFile[] = [];
  for (const skillFile of skillFiles) {
    const fileName = skillFile.fileName.trim();
    const content = skillFile.content.trim();
    if (!fileName && !content) continue;
    if (!fileName || !content) return null;
    normalized.push({ fileName, content });
  }
  return normalized;
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

type IntegrationStorageKind = "slack" | "github" | "openclaw";

function readStoredIntegration<T>(workspaceId: number, kind: IntegrationStorageKind): T | null {
  if (typeof window === "undefined") return null;
  const raw = window.localStorage.getItem(integrationStorageKey(workspaceId, kind));
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

function writeStoredIntegration<T>(workspaceId: number, kind: IntegrationStorageKind, value: T) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(integrationStorageKey(workspaceId, kind), JSON.stringify(value));
}

function deleteStoredIntegration(workspaceId: number, kind: IntegrationStorageKind) {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(integrationStorageKey(workspaceId, kind));
}

function integrationStorageKey(workspaceId: number, kind: IntegrationStorageKind) {
  return `aio.workspace.${workspaceId}.integrations.${kind}`;
}

function readStoredGatewayStatus(workspaceId: number) {
  const stored = readStoredIntegration<WorkspaceGatewayStatus | WorkspaceGatewayBinding>(workspaceId, "openclaw");
  if (!stored) return null;
  if ("bound" in stored) return normalizeGatewayStatus(stored);
  return gatewayBindingToStatus(stored);
}

function normalizeGatewayStatus(status: WorkspaceGatewayStatus): WorkspaceGatewayStatus {
  return {
    ...status,
    bound: Boolean(status.bound),
    status: status.status ?? (status.bound ? "BOUND" : "UNBOUND"),
  };
}

function gatewayBindingToStatus(binding: WorkspaceGatewayBinding): WorkspaceGatewayStatus {
  return {
    status: "BOUND",
    bound: true,
    bindingId: binding.id,
    mode: binding.mode,
    gatewayUrl: binding.gatewayUrl,
    maskedToken: binding.maskedToken,
  };
}

function gatewayStatusLabel(status: WorkspaceGatewayStatus) {
  if (status.status === "UNBOUND" || !status.bound) return "Gateway 등록 필요";
  if (status.lastStatus === "CONNECTED") return "Gateway 등록 완료 · 연결 정상";
  if (status.lastStatus) return `Gateway 등록 완료 · ${gatewayConnectionStatusLabel(status.lastStatus)}`;
  return "Gateway 등록 완료";
}

function gatewayConnectionStatusLabel(status: NonNullable<WorkspaceGatewayStatus["lastStatus"]>) {
  if (status === "TIMEOUT") return "연결 시간 초과";
  if (status === "TOKEN_INVALID") return "토큰 오류";
  if (status === "UNREACHABLE") return "연결 불가";
  if (status === "PAIRING_REQUIRED") return "페어링 필요";
  if (status === "FORBIDDEN") return "접근 거부";
  if (status === "FAILED") return "연결 실패";
  return "연결 정상";
}

function readChatSessionIds(workspaceId: number): Record<string, number> {
  if (typeof window === "undefined") return {};
  const raw = window.localStorage.getItem(chatSessionIdsStorageKey(workspaceId));
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    if (!parsed || typeof parsed !== "object") return {};
    return Object.fromEntries(
      Object.entries(parsed)
        .map(([key, value]) => [key, Number(value)] as const)
        .filter(([, value]) => Number.isFinite(value)),
    );
  } catch {
    return {};
  }
}

function writeChatSessionIds(workspaceId: number, sessionIds: Record<string, number>) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(chatSessionIdsStorageKey(workspaceId), JSON.stringify(sessionIds));
}

function chatSessionIdsStorageKey(workspaceId: number) {
  return `aio.workspace.${workspaceId}.chatSessions`;
}

function createLocalId() {
  if (typeof window !== "undefined" && window.crypto?.randomUUID) {
    return window.crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function collectOrchestrationPlanIds(
  messages: ReadonlyArray<{ orchestrationPlanId?: number }> | undefined,
  extraPlanId?: number,
) {
  const ids = new Set<number>();
  if (typeof extraPlanId === "number" && Number.isFinite(extraPlanId)) {
    ids.add(extraPlanId);
  }
  for (const message of messages ?? []) {
    if (
      typeof message.orchestrationPlanId === "number" &&
      Number.isFinite(message.orchestrationPlanId)
    ) {
      ids.add(message.orchestrationPlanId);
    }
  }
  return [...ids];
}

function inferOrchestrationRunStatus(
  messages: ReadonlyArray<{ orchestrationPlanId?: number; content?: string }> | undefined,
): TaskStatus | undefined {
  let completed = false;
  for (const message of messages ?? []) {
    if (message.orchestrationPlanId == null || !message.content) continue;
    const content = message.content.toLowerCase();
    if (
      content.includes("failed") ||
      content.includes("failure") ||
      content.includes("실패")
    ) {
      return "FAILED";
    }
    if (
      content.includes("canceled") ||
      content.includes("cancelled") ||
      content.includes("취소")
    ) {
      return "CANCELED";
    }
    if (
      content.includes("완료") ||
      content.includes("작업 결과") ||
      content.includes("결과가 생성")
    ) {
      completed = true;
    }
  }
  return completed ? "COMPLETED" : undefined;
}

function mergeOrchestrationRun(
  prev: Record<string, OrchestrationRunState>,
  key: string,
  next: Partial<OrchestrationRunState>,
) {
  const current = prev[key] ?? { planIds: [] };
  const planIds = [...new Set([...current.planIds, ...(next.planIds ?? [])])];
  const chatSessionId = next.chatSessionId ?? current.chatSessionId;
  const hasNewPlan = planIds.some((planId) => !current.planIds.includes(planId));
  const status = next.status ?? (hasNewPlan ? undefined : current.status);
  const unchanged =
    current.chatSessionId === chatSessionId &&
    current.status === status &&
    current.planIds.length === planIds.length &&
    current.planIds.every((id, index) => id === planIds[index]);

  if (unchanged) return prev;
  return {
    ...prev,
    [key]: {
      chatSessionId,
      planIds,
      status,
    },
  };
}

function pickStatus(index: number, role: string): OfficeActor["status"] {
  if (role === "ADMIN") return index % 2 === 0 ? "review" : "working";
  const statuses: OfficeActor["status"][] = ["working", "idle", "blocked"];
  return statuses[index % statuses.length];
}

function getAgentTaskState(tasks: WorkspaceTask[], agentId: number): ActiveTaskState | null {
  if (!Number.isFinite(agentId)) return null;
  const activeTasks = tasks
    .filter((task) => {
      const assigneeId = task.assignedAgentId ?? task.assigneeId;
      return Number(assigneeId) === agentId && ACTIVE_AGENT_TASK_STATUSES.includes(task.status);
    })
    .sort((a, b) => {
      const priorityDiff = activeTaskPriority(b.status) - activeTaskPriority(a.status);
      if (priorityDiff !== 0) return priorityDiff;
      const timeA = taskUpdatedTime(a);
      const timeB = taskUpdatedTime(b);
      if (timeA !== timeB) return timeB - timeA;
      return b.taskId - a.taskId;
    });
  const current = activeTasks[0];
  if (!current) {
    const completed = tasks
      .filter((task) => {
        const assigneeId = task.assignedAgentId ?? task.assigneeId;
        return Number(assigneeId) === agentId && task.status === "COMPLETED";
      })
      .sort((a, b) => {
        const timeA = taskUpdatedTime(a);
        const timeB = taskUpdatedTime(b);
        if (timeA !== timeB) return timeB - timeA;
        return b.taskId - a.taskId;
      })[0];
    if (!completed) return null;
    return {
      count: 0,
      title: completed.title,
      status: completed.status,
    };
  }
  return {
    count: activeTasks.length,
    title: current.title,
    status: current.status,
  };
}

function getOrchestratorTaskState(
  tasks: WorkspaceTask[],
  orchestratorAgentId: number,
  context: { chatSessionId?: number; planIds?: number[]; status?: TaskStatus } = {},
): ActiveTaskState | null {
  const planIds = context.planIds ?? [];
  const hasKnownPlan = planIds.length > 0;
  const terminalStatus = terminalTaskStatus(context.status);
  const orchestratorTasks = tasks.filter((task) => {
    const assigneeId = Number(task.assignedAgentId ?? task.assigneeId);
    if (assigneeId === orchestratorAgentId) return false;
    if (matchesOrchestrationSource(task, context.chatSessionId, planIds)) return true;
    if (!hasKnownPlan && task.sourceType === "ORCHESTRATOR") return true;
    if (task.sourceType === "ORCHESTRATOR" && !task.sourceId) return true;
    return false;
  });
  if (orchestratorTasks.length === 0) {
    if (terminalStatus) {
      return {
        count: 0,
        title: orchestrationFallbackTitle(planIds, terminalStatus),
        status: terminalStatus,
      };
    }
    if (!hasKnownPlan) return null;
    return {
      count: 1,
      title: orchestrationFallbackTitle(planIds, "IN_PROGRESS"),
      status: "IN_PROGRESS",
    };
  }
  const activeTasks = orchestratorTasks
    .filter((task) => ACTIVE_AGENT_TASK_STATUSES.includes(task.status))
    .sort(compareTasksForDisplay);
  const current = activeTasks[0];
  if (current) {
    return {
      count: activeTasks.length,
      title: current.title,
      status: "IN_PROGRESS" as TaskStatus,
    };
  }

  const failed = orchestratorTasks
    .filter((task) => task.status === "FAILED" || task.status === "CANCELED")
    .sort(compareTasksForDisplay)[0];
  if (failed || terminalStatus === "FAILED" || terminalStatus === "CANCELED") {
    return {
      count: 0,
      title: failed?.title ?? orchestrationFallbackTitle(planIds, terminalStatus ?? "FAILED"),
      status: failed?.status ?? terminalStatus ?? "FAILED",
    };
  }

  const completed = orchestratorTasks
    .filter((task) => task.status === "COMPLETED")
    .sort((a, b) => {
      const timeA = taskUpdatedTime(a);
      const timeB = taskUpdatedTime(b);
      if (timeA !== timeB) return timeB - timeA;
      return b.taskId - a.taskId;
    })[0];
  if (!completed) {
    if (terminalStatus === "COMPLETED") {
      return {
        count: 0,
        title: orchestrationFallbackTitle(planIds, "COMPLETED"),
        status: "COMPLETED",
      };
    }
    if (!hasKnownPlan) return null;
    return {
      count: 1,
      title: orchestrationFallbackTitle(planIds, "IN_PROGRESS"),
      status: "IN_PROGRESS",
    };
  }
  return {
    count: 0,
    title: completed.title,
    status: "COMPLETED" as TaskStatus,
  };
}

function terminalTaskStatus(status?: TaskStatus) {
  return status === "COMPLETED" || status === "FAILED" || status === "CANCELED"
    ? status
    : undefined;
}

function orchestrationFallbackTitle(planIds: number[], status: TaskStatus) {
  const planId = planIds.at(-1);
  const prefix = planId ? `PLAN #${planId}` : "오케스트레이션";
  if (status === "COMPLETED") return `${prefix} 하위 Agent 작업 완료`;
  if (status === "FAILED") return `${prefix} 하위 Agent 작업 실패`;
  if (status === "CANCELED") return `${prefix} 하위 Agent 작업 취소`;
  return `${prefix} 하위 Agent 작업 진행 중`;
}

function matchesOrchestrationSource(
  task: WorkspaceTask,
  chatSessionId?: number,
  planIds: number[] = [],
) {
  const sourceId = task.sourceId?.toLowerCase();
  if (!sourceId) return false;
  if (
    chatSessionId != null &&
    (sourceId.includes(`chat-session-${chatSessionId}`) ||
      sourceId.includes(`chat_session_${chatSessionId}`) ||
      (task.sourceType === "CHAT" && sourceIdHasNumericToken(sourceId, chatSessionId)))
  ) {
    return true;
  }
  return planIds.some(
    (planId) =>
      sourceId.includes(`orchestration-plan-${planId}`) ||
      sourceId.includes(`orchestration_plan_${planId}`) ||
      sourceId.includes(`plan-${planId}`) ||
      (task.sourceType === "ORCHESTRATOR" && sourceIdHasNumericToken(sourceId, planId)),
  );
}

function sourceIdHasNumericToken(sourceId: string, value: number) {
  return new RegExp(`(^|\\D)${value}(\\D|$)`).test(sourceId);
}

function activeTaskPriority(status: TaskStatus) {
  if (status === "IN_PROGRESS") return 3;
  if (status === "WAITING_USER") return 2;
  if (status === "ASSIGNED") return 1;
  return 0;
}

function taskUpdatedTime(task: WorkspaceTask) {
  const raw = task.updatedAt ?? task.createdAt;
  if (!raw) return 0;
  const time = new Date(raw).getTime();
  return Number.isFinite(time) ? time : 0;
}

function statusFromTaskStatus(status: TaskStatus): OfficeActor["status"] {
  if (status === "COMPLETED") return "idle";
  if (status === "WAITING_USER") return "review";
  if (status === "FAILED" || status === "CANCELED") return "blocked";
  return "working";
}

function buildDashboardSummary(
  actors: OfficeActor[],
  tasks: WorkspaceTask[],
): DashboardSummaryData {
  const agentActors = actors.filter((actor) => actor.kind === "agent");
  const countStatus = (status: TaskStatus) =>
    tasks.filter((task) => task.status === status).length;
  const recentTasks = [...tasks]
    .sort((a, b) => taskUpdatedTime(b) - taskUpdatedTime(a) || b.taskId - a.taskId)
    .slice(0, 6);
  const recentReports = recentTasks
    .filter((task) => task.status === "COMPLETED")
    .slice(0, 5)
    .map<DashboardReportItem>((task) => ({
      id: `task:${task.taskId}`,
      taskId: task.taskId,
      title: task.title,
      summary: task.description || "완료된 Task입니다.",
      status: task.status,
      createdAt: task.updatedAt ?? task.createdAt,
    }));

  const taskIssues = tasks
    .filter((task) => task.status === "WAITING_USER" || task.status === "FAILED")
    .sort((a, b) => taskUpdatedTime(b) - taskUpdatedTime(a) || b.taskId - a.taskId)
    .slice(0, 5)
    .map<DashboardIssue>((task) => ({
      id: `task:${task.taskId}`,
      title: `${TASK_STATUS_META[task.status].label} · ${task.title}`,
      detail: task.description || "Task 확인이 필요합니다.",
      color: task.status === "FAILED" ? t4.hp : t4.xp,
    }));
  const agentIssues = agentActors
    .filter((actor) => actor.status === "blocked" || actor.status === "review")
    .slice(0, 4)
    .map<DashboardIssue>((actor) => ({
      id: `agent:${actor.id}`,
      title: `${actor.name} · ${STATUS_META[actor.status].label}`,
      detail: actor.activeTaskTitle || "Agent 상태 확인이 필요합니다.",
      color: actor.status === "blocked" ? t4.hp : t4.xp,
    }));

  return {
    agents: {
      total: agentActors.length,
      working: agentActors.filter((actor) => actor.status === "working").length,
      idle: agentActors.filter((actor) => actor.status === "idle").length,
      blocked: agentActors.filter((actor) => actor.status === "blocked" || actor.status === "review").length,
    },
    tasks: {
      total: tasks.length,
      requested: countStatus("REQUESTED"),
      assigned: countStatus("ASSIGNED"),
      inProgress: countStatus("IN_PROGRESS") + countStatus("WAITING_USER"),
      waitingUser: countStatus("WAITING_USER"),
      completed: countStatus("COMPLETED"),
      failed: countStatus("FAILED"),
      canceled: countStatus("CANCELED"),
    },
    recentTasks,
    recentReports,
    recentLogs: [],
    issues: [...taskIssues, ...agentIssues].slice(0, 8),
  };
}

function mergeDashboardSummary(
  apiSummary: WorkspaceDashboardSummary,
  localSummary: DashboardSummaryData,
): DashboardSummaryData {
  return {
    ...localSummary,
    agents: {
      total: apiSummary.agentCount ?? localSummary.agents.total,
      working: apiSummary.runningAgentCount ?? localSummary.agents.working,
      idle: apiSummary.idleAgentCount ?? localSummary.agents.idle,
      blocked: apiSummary.errorAgentCount ?? localSummary.agents.blocked,
    },
    tasks: {
      ...localSummary.tasks,
      total: apiSummary.taskCount ?? localSummary.tasks.total,
      inProgress: apiSummary.runningTaskCount ?? localSummary.tasks.inProgress,
      completed: apiSummary.completedTaskCount ?? localSummary.tasks.completed,
      failed: apiSummary.failedTaskCount ?? localSummary.tasks.failed,
    },
    recentReports: normalizeDashboardReports(apiSummary.recentReports, localSummary.recentReports),
    recentLogs: normalizeDashboardLogs(apiSummary.recentLogs),
  };
}

function normalizeDashboardReports(
  reports: DashboardRecentReport[] | undefined,
  fallback: DashboardReportItem[],
) {
  if (!reports?.length) return fallback;
  return reports.map<DashboardReportItem>((report, index) => ({
    id: `report:${report.reportId ?? report.taskId ?? index}`,
    taskId: report.taskId,
    title: report.taskId ? `Task #${report.taskId}` : `Report #${report.reportId ?? index + 1}`,
    summary: report.summary || report.detail || report.recommendedAction || "보고 내용이 없습니다.",
    detail: report.detail,
    status: report.status,
    createdAt: report.createdAt,
  }));
}

function normalizeDashboardLogs(logs: DashboardRecentLog[] | undefined) {
  if (!logs?.length) return [];
  return logs.map<DashboardLogItem>((log, index) => ({
    id: `log:${log.logId ?? log.executionId ?? index}`,
    level: log.level,
    message: log.message || "로그 메시지가 없습니다.",
    createdAt: log.createdAt,
  }));
}

function getActorSpeechBubble(actor: OfficeActor) {
  if (actor.kind !== "agent") return null;
  const status = actor.activeTaskStatus;
  if (status === "COMPLETED") {
    return {
      label: "완료",
      text: "",
      color: t4.xp,
    };
  }
  if (status && ACTIVE_AGENT_TASK_STATUSES.includes(status)) {
    return {
      label: "진행중",
      text: "",
      color: t4.ok,
    };
  }
  return null;
}

function tasksForActor(tasks: WorkspaceTask[], actor: OfficeActor) {
  if (actor.kind !== "agent") return [];
  const agentId = agentIdFromActor(actor);
  if (!agentId) return [];
  return tasks.filter((task) => {
    const assigneeId = task.assignedAgentId ?? task.assigneeId;
    return Number(assigneeId) === agentId;
  });
}

function compareTasksForDisplay(a: WorkspaceTask, b: WorkspaceTask) {
  const activeDiff =
    Number(ACTIVE_AGENT_TASK_STATUSES.includes(b.status)) -
    Number(ACTIVE_AGENT_TASK_STATUSES.includes(a.status));
  if (activeDiff !== 0) return activeDiff;

  const priorityDiff = activeTaskPriority(b.status) - activeTaskPriority(a.status);
  if (priorityDiff !== 0) return priorityDiff;

  const timeA = taskUpdatedTime(a);
  const timeB = taskUpdatedTime(b);
  if (timeA !== timeB) return timeB - timeA;
  return b.taskId - a.taskId;
}

function taskProgressPercent(status: TaskStatus) {
  if (status === "REQUESTED") return 18;
  if (status === "ASSIGNED") return 28;
  if (status === "IN_PROGRESS") return 66;
  if (status === "WAITING_USER") return 78;
  if (status === "COMPLETED") return 100;
  if (status === "FAILED" || status === "CANCELED") return 100;
  return 0;
}

function chatKey(actor: OfficeActor) {
  return `${actor.kind}:${actor.id}`;
}

function createOpenChatMessage(actor: OfficeActor): ChatMessage {
  return {
    id: `local:open:${chatKey(actor)}`,
    from: "system",
    text:
      actor.kind === "agent"
        ? `${actor.name} Agent를 호출했습니다.`
        : `${actor.name}님과의 채팅을 시작했습니다.`,
    createdAt: new Date().toISOString(),
  };
}

function agentIdFromActor(actor: OfficeActor) {
  if (actor.kind !== "agent") return null;
  const raw = String(actor.id).replace(/^agent:/, "");
  const agentId = Number(raw);
  return Number.isFinite(agentId) ? agentId : null;
}

function memberIdFromActor(actor: OfficeActor) {
  if (actor.kind !== "member") return null;
  const raw = String(actor.id).replace(/^member:/, "");
  const memberId = Number(raw);
  return Number.isFinite(memberId) ? memberId : null;
}

function mergeServerChatMessages(
  prev: Record<string, ChatMessage[]>,
  actor: OfficeActor,
  serverMessages: unknown,
  mode: "replace" | "append" = "replace",
) {
  const key = chatKey(actor);
  const current = prev[key] ?? [];
  const openMessage =
    current.find((message) => message.id === `local:open:${key}`) ??
    createOpenChatMessage(actor);
  const incoming = normalizeChatMessages(serverMessages)
    .map(toChatMessage)
    .filter((message): message is ChatMessage => Boolean(message));

  if (mode === "append") {
    if (incoming.length === 0) return prev;
    const seen = new Set(current.map((message) => message.id));
    const merged = current.length === 0 ? [openMessage] : [...current];
    for (const message of incoming) {
      if (seen.has(message.id)) continue;
      if (message.from === "me") {
        const pendingIndex = merged.findIndex((candidate) =>
          isMatchingPendingUserMessage(candidate, message),
        );
        if (pendingIndex >= 0) {
          merged.splice(pendingIndex, 1);
        }
      }
      seen.add(message.id);
      merged.push(message);
    }
    return { ...prev, [key]: merged };
  }

  return {
    ...prev,
    [key]: incoming.length > 0 ? [openMessage, ...incoming] : current,
  };
}

function isMatchingPendingUserMessage(candidate: ChatMessage, incoming: ChatMessage) {
  return (
    candidate.from === "me" &&
    candidate.messageApiId == null &&
    incoming.messageApiId != null &&
    normalizeChatText(candidate.text) === normalizeChatText(incoming.text)
  );
}

function normalizeChatText(value: string) {
  return value.trim().replace(/\s+/g, " ");
}

function pickLatestMessageId(
  messages: ReadonlyArray<ChatMessage | ChatMessageResponse> | undefined,
) {
  if (!messages || messages.length === 0) return undefined;
  let latest: number | undefined;
  for (const item of messages) {
    if (!item || typeof item !== "object") continue;
    const candidate =
      "messageApiId" in item
        ? item.messageApiId
        : "messageId" in item
          ? item.messageId
          : undefined;
    if (typeof candidate === "number" && (latest == null || candidate > latest)) {
      latest = candidate;
    }
  }
  return latest;
}

function normalizeChatMessages(payload: unknown): ChatMessageResponse[] {
  if (Array.isArray(payload)) return payload as ChatMessageResponse[];
  if (!payload || typeof payload !== "object") return [];

  const record = payload as Record<string, unknown>;
  if (Array.isArray(record.messages)) return record.messages as ChatMessageResponse[];
  if (Array.isArray(record.content)) return record.content as ChatMessageResponse[];
  if (Array.isArray(record.data)) return record.data as ChatMessageResponse[];

  return [];
}

function toChatMessage(message: ChatMessageResponse): ChatMessage | null {
  const text = message.content;
  if (!text) return null;
  return {
    id: `api:${message.messageId}`,
    from:
      message.role === "USER"
        ? "me"
        : message.role === "ASSISTANT"
          ? "target"
          : "system",
    text,
    createdAt: message.createdAt ?? new Date().toISOString(),
    messageApiId: message.messageId,
    orchestrationPlanId: message.orchestrationPlanId,
    taskId: message.taskId,
  };
}

function taskAssigneeName(task: WorkspaceTask, actors: OfficeActor[]) {
  const assigneeId = task.assignedAgentId ?? task.assigneeId;
  if (!assigneeId) return "담당자 미배정";
  const actor = actors.find((item) => String(item.id).replace(/^agent:|^member:/, "") === String(assigneeId));
  return actor ? `담당 ${actor.name}` : `담당 ID ${assigneeId}`;
}

function formatDashboardTime(value?: string) {
  if (!value) return "시간 정보 없음";
  const time = new Date(value).getTime();
  if (!Number.isFinite(time)) return "시간 정보 없음";
  const diffMs = Date.now() - time;
  if (diffMs < 60_000) return "방금";
  const minutes = Math.floor(diffMs / 60_000);
  if (minutes < 60) return `${minutes}분 전`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}시간 전`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}일 전`;
  return new Date(value).toLocaleDateString("ko-KR", {
    month: "short",
    day: "numeric",
  });
}

function OrchestrationPlanModal({
  open,
  workspaceId,
  planId,
  onClose,
  onOpenFile,
}: {
  open: boolean;
  workspaceId: number;
  planId: number | null;
  onClose: () => void;
  onOpenFile: (file: { path: string; name: string }) => void;
}) {
  const [data, setData] = useState<OrchestrationPlanArtifact | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open || planId == null) {
      queueMicrotask(() => {
        setData(null);
        setError("");
      });
      return;
    }
    let cancelled = false;
    queueMicrotask(() => {
      if (cancelled) return;
      setLoading(true);
      setError("");
    });
    getOrchestrationPlanArtifact(workspaceId, planId)
      .then((next) => {
        if (cancelled) return;
        setData(next);
      })
      .catch((err) => {
        if (cancelled) return;
        const apiErr = err as ApiError;
        setError(apiErr?.message ?? "오케스트레이션 계획을 불러오지 못했습니다.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open, planId, workspaceId]);

  const steps = data?.steps ?? [];

  return (
    <Modal open={open} onClose={onClose} title={`ORCHESTRATION PLAN${planId != null ? ` #${planId}` : ""}`} size="lg">
      <Modal.Body className="flex min-h-[40vh] flex-col gap-3">
        {loading && (
          <p style={{ color: t4.dim, fontFamily: "var(--font-mixed-ko)", fontSize: 12, margin: 0 }}>
            계획을 불러오는 중입니다.
          </p>
        )}
        {error && (
          <p style={{ color: t4.hp, fontFamily: "var(--font-mixed-ko)", fontSize: 12, margin: 0 }}>
            {error}
          </p>
        )}
        {!loading && !error && steps.length === 0 && (
          <p style={{ color: t4.dim, fontFamily: "var(--font-mixed-ko)", fontSize: 12, margin: 0 }}>
            아직 등록된 step이 없습니다.
          </p>
        )}
        <div className="flex flex-col gap-3">
          {steps.map((step) => (
            <div
              key={step.stepId}
              className="p-3"
              style={{
                border: `1px solid ${t4.line}`,
                background: "rgba(20,28,55,0.62)",
              }}
            >
              <div className="flex items-center gap-2">
                <span
                  style={{
                    fontFamily: "var(--font-pixel)",
                    fontSize: 8,
                    letterSpacing: 1.5,
                    color: t4.mp,
                    padding: "2px 6px",
                    border: `1px solid ${t4.mp}`,
                    textShadow: `0 0 6px ${t4.mp}`,
                  }}
                >
                  STEP {step.sequenceNo}
                </span>
                <p style={{ color: t4.ink, fontFamily: "var(--font-mixed-ko)", fontSize: 13, fontWeight: 700, margin: 0 }}>
                  {step.title}
                </p>
              </div>
              {step.files.length === 0 ? (
                <p
                  className="mt-2"
                  style={{ color: t4.dim, fontFamily: "var(--font-mixed-ko)", fontSize: 11, margin: 0 }}
                >
                  생성된 파일이 없습니다.
                </p>
              ) : (
                <ul className="mt-2 flex flex-col gap-1" style={{ listStyle: "none", padding: 0, margin: 0 }}>
                  {step.files.map((file) => (
                    <li key={file.path}>
                      <button
                        type="button"
                        onClick={() => onOpenFile({ path: file.path, name: file.name })}
                        disabled={file.exists === false}
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          gap: 6,
                          padding: "4px 8px",
                          fontFamily: "var(--font-mixed-ko)",
                          fontSize: 11,
                          color: file.exists === false ? t4.dim : t4.ink,
                          background: "rgba(10,13,26,0.6)",
                          border: `1px solid ${t4.line}`,
                          cursor: file.exists === false ? "not-allowed" : "pointer",
                          opacity: file.exists === false ? 0.5 : 1,
                        }}
                      >
                        <span aria-hidden style={{ color: t4.xp }}>▸</span>
                        <span>{file.path}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ))}
        </div>
      </Modal.Body>
    </Modal>
  );
}

function ArtifactFileModal({
  open,
  workspaceId,
  path,
  nameHint,
  onClose,
}: {
  open: boolean;
  workspaceId: number;
  path: string | null;
  nameHint?: string;
  onClose: () => void;
}) {
  const [data, setData] = useState<ArtifactFileContent | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open || !path) {
      queueMicrotask(() => {
        setData(null);
        setError("");
      });
      return;
    }
    let cancelled = false;
    queueMicrotask(() => {
      if (cancelled) return;
      setLoading(true);
      setError("");
    });
    getArtifactFile(workspaceId, path)
      .then((next) => {
        if (cancelled) return;
        setData(next);
      })
      .catch((err) => {
        if (cancelled) return;
        const apiErr = err as ApiError;
        setError(apiErr?.message ?? "파일을 불러오지 못했습니다.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open, path, workspaceId]);

  const title = data?.name ?? nameHint ?? path ?? "ARTIFACT";

  return (
    <Modal open={open} onClose={onClose} title={title.toUpperCase()} size="lg">
      <Modal.Body className="flex min-h-[40vh] flex-col gap-2">
        {path && (
          <p
            className="truncate"
            style={{ color: t4.dim, fontFamily: "var(--font-mixed-ko)", fontSize: 11, margin: 0 }}
          >
            {path}
          </p>
        )}
        {loading && (
          <p style={{ color: t4.dim, fontFamily: "var(--font-mixed-ko)", fontSize: 12, margin: 0 }}>
            파일을 불러오는 중입니다.
          </p>
        )}
        {error && (
          <p style={{ color: t4.hp, fontFamily: "var(--font-mixed-ko)", fontSize: 12, margin: 0 }}>
            {error}
          </p>
        )}
        {data && (
          <pre
            className="flex-1 overflow-auto p-3"
            style={{
              border: `1px solid ${t4.line}`,
              background: "rgba(10,13,26,0.85)",
              color: t4.ink,
              fontFamily: "var(--font-mono, monospace)",
              fontSize: 12,
              lineHeight: 1.5,
              whiteSpace: "pre",
              margin: 0,
            }}
          >
            {data.content}
          </pre>
        )}
      </Modal.Body>
    </Modal>
  );
}

function WorkspaceFilesModal({
  open,
  workspaceId,
  onClose,
  onOpenFile,
}: {
  open: boolean;
  workspaceId: number;
  onClose: () => void;
  onOpenFile: (file: { path: string; name: string }) => void;
}) {
  const [tree, setTree] = useState<ArtifactTree | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    if (!open) {
      queueMicrotask(() => {
        setTree(null);
        setError("");
      });
      return;
    }
    let cancelled = false;
    queueMicrotask(() => {
      if (cancelled) return;
      setLoading(true);
      setError("");
    });
    getArtifactTree(workspaceId)
      .then((next) => {
        if (cancelled) return;
        setTree(next);
      })
      .catch((err) => {
        if (cancelled) return;
        const apiErr = err as ApiError;
        setError(apiErr?.message ?? "파일 트리를 불러오지 못했습니다.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open, workspaceId, reloadKey]);

  const children = tree?.children ?? [];

  return (
    <Modal open={open} onClose={onClose} title="WORKSPACE FILES" size="lg">
      <Modal.Body className="flex min-h-[50vh] flex-col gap-3">
        <div className="flex items-center justify-between gap-2">
          <p
            className="truncate"
            style={{ color: t4.dim, fontFamily: "var(--font-mixed-ko)", fontSize: 11, margin: 0 }}
          >
            {tree?.rootPath ?? ""}
          </p>
          <button
            type="button"
            onClick={() => setReloadKey((value) => value + 1)}
            disabled={loading}
            style={{
              fontFamily: "var(--font-pixel)",
              fontSize: 8,
              letterSpacing: 1.5,
              padding: "4px 10px",
              color: loading ? t4.dim : t4.ok,
              background: "transparent",
              border: `1px solid ${loading ? t4.line : t4.ok}`,
              cursor: loading ? "wait" : "pointer",
            }}
          >
            RELOAD
          </button>
        </div>
        {loading && (
          <p style={{ color: t4.dim, fontFamily: "var(--font-mixed-ko)", fontSize: 12, margin: 0 }}>
            파일 트리를 불러오는 중입니다.
          </p>
        )}
        {error && (
          <p style={{ color: t4.hp, fontFamily: "var(--font-mixed-ko)", fontSize: 12, margin: 0 }}>
            {error}
          </p>
        )}
        {!loading && !error && children.length === 0 && (
          <p style={{ color: t4.dim, fontFamily: "var(--font-mixed-ko)", fontSize: 12, margin: 0 }}>
            아직 생성된 파일이 없습니다.
          </p>
        )}
        <div
          className="flex-1 overflow-auto p-2"
          style={{
            border: `1px solid ${t4.line}`,
            background: "rgba(10,13,26,0.85)",
          }}
        >
          <ArtifactTreeNodes nodes={children} depth={0} onOpenFile={onOpenFile} />
        </div>
      </Modal.Body>
    </Modal>
  );
}

function ArtifactTreeNodes({
  nodes,
  depth,
  onOpenFile,
}: {
  nodes: ArtifactNode[];
  depth: number;
  onOpenFile: (file: { path: string; name: string }) => void;
}) {
  if (nodes.length === 0) return null;
  return (
    <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
      {nodes.map((node) => (
        <ArtifactTreeRow key={node.path} node={node} depth={depth} onOpenFile={onOpenFile} />
      ))}
    </ul>
  );
}

function ArtifactTreeRow({
  node,
  depth,
  onOpenFile,
}: {
  node: ArtifactNode;
  depth: number;
  onOpenFile: (file: { path: string; name: string }) => void;
}) {
  const [expanded, setExpanded] = useState(depth < 1);
  const isDir = node.type === "DIRECTORY";
  const children = node.children ?? [];

  return (
    <li>
      <button
        type="button"
        onClick={() => {
          if (isDir) setExpanded((value) => !value);
          else onOpenFile({ path: node.path, name: node.name });
        }}
        style={{
          width: "100%",
          display: "flex",
          alignItems: "center",
          gap: 6,
          padding: "3px 6px",
          paddingLeft: 6 + depth * 14,
          fontFamily: "var(--font-mixed-ko)",
          fontSize: 12,
          color: isDir ? t4.mp : t4.ink,
          background: "transparent",
          border: "1px solid transparent",
          cursor: "pointer",
          textAlign: "left",
        }}
      >
        <span aria-hidden style={{ color: isDir ? t4.mp : t4.xp, width: 12, display: "inline-block" }}>
          {isDir ? (expanded ? "▾" : "▸") : "·"}
        </span>
        <span className="truncate">{node.name}</span>
        {!isDir && typeof node.sizeBytes === "number" && (
          <span style={{ marginLeft: "auto", color: t4.dim, fontSize: 10 }}>
            {formatFileSize(node.sizeBytes)}
          </span>
        )}
      </button>
      {isDir && expanded && children.length > 0 && (
        <ArtifactTreeNodes nodes={children} depth={depth + 1} onOpenFile={onOpenFile} />
      )}
    </li>
  );
}

function formatFileSize(bytes: number) {
  if (!Number.isFinite(bytes) || bytes < 0) return "";
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
}
