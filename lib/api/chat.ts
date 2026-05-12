import { apiFetch } from "../api-client";
import type { TaskStatus } from "./tasks";

export type ChatTaskType =
  | "CODE_REVIEW"
  | "PR_REVIEW"
  | "BUG_FIX"
  | "FEATURE_IMPLEMENTATION"
  | "REFACTORING"
  | "TEST_CREATION"
  | "DOCUMENTATION"
  | "PR_CREATION"
  | "OTHER";

export type ChatPriority = "LOW" | "MEDIUM" | "HIGH" | "URGENT";

export type ChatExecutionStatus =
  | "QUEUED"
  | "RUNNING"
  | "SUCCEEDED"
  | "FAILED"
  | "CANCELED";

export type TaskMessageRole = "USER" | "ASSISTANT" | "SYSTEM";

export interface TaskArtifactResponse {
  artifactId: number;
  artifactType:
    | "PR_URL"
    | "COMMIT_HASH"
    | "FILE_PATH"
    | "DIFF"
    | "LOG_FILE"
    | "RESULT_FILE"
    | "OTHER";
  name?: string;
  url?: string;
}

export interface TaskMessageResponse {
  messageId: number;
  taskId: number;
  taskExecutionId?: number;
  role: TaskMessageRole;
  status?: TaskStatus;
  content?: string;
  summary?: string;
  detail?: string;
  recommendedAction?: string;
  artifacts?: TaskArtifactResponse[];
  createdAt?: string;
}

export interface ChatMessageResponse {
  messageId: number;
  chatSessionId: number;
  taskId?: number;
  taskExecutionId?: number;
  orchestrationPlanId?: number;
  role: TaskMessageRole;
  content?: string;
  createdAt?: string;
}

export interface ChatMessageSendRequest {
  message: string;
  agentId: number;
  repositoryId?: number;
  taskType?: ChatTaskType;
  priority?: ChatPriority;
  title?: string;
  createPr?: boolean;
  chatSessionId?: number;
}

export interface ChatMessageSendResponse {
  chatSessionId: number;
  taskId?: number;
  workspaceId: number;
  assignedAgentId: number;
  taskStatus?: TaskStatus;
  taskExecutionId?: number;
  executionStatus?: ChatExecutionStatus;
  orchestrationPlanId?: number;
  finalText?: string;
  failureReason?: string;
  createdAt?: string;
  messages?: ChatMessageResponse[];
}

export interface ChatSessionMessagesPage {
  chatSessionId: number;
  messages: ChatMessageResponse[];
  nextCursor?: number;
  hasMore: boolean;
}

export function sendChatMessage(
  workspaceId: number,
  body: ChatMessageSendRequest,
) {
  return apiFetch<ChatMessageSendResponse>(
    `/api/v1/workspaces/${workspaceId}/chat/messages`,
    {
      method: "POST",
      body: JSON.stringify(body),
    },
  );
}

export function listChatTaskMessages(workspaceId: number, taskId: number) {
  return apiFetch<TaskMessageResponse[]>(
    `/api/v1/workspaces/${workspaceId}/chat/tasks/${taskId}/messages`,
  );
}

export async function listChatSessionMessages(workspaceId: number, chatSessionId: number) {
  const payload = await apiFetch<unknown>(
    `/api/v1/workspaces/${workspaceId}/chat/sessions/${chatSessionId}/messages`,
  );
  return normalizeChatMessages(payload);
}

export async function pollChatSessionMessages(
  workspaceId: number,
  chatSessionId: number,
  options: { afterMessageId?: number; limit?: number } = {},
): Promise<ChatSessionMessagesPage> {
  const params = new URLSearchParams();
  if (options.afterMessageId != null) {
    params.set("afterMessageId", String(options.afterMessageId));
  }
  if (options.limit != null) {
    params.set("limit", String(options.limit));
  }
  const query = params.toString();
  const payload = await apiFetch<unknown>(
    `/api/v1/workspaces/${workspaceId}/chat/sessions/${chatSessionId}/messages${query ? `?${query}` : ""}`,
  );
  return normalizeChatMessagesPage(payload, chatSessionId);
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

function normalizeChatMessagesPage(
  payload: unknown,
  fallbackSessionId: number,
): ChatSessionMessagesPage {
  const messages = normalizeChatMessages(payload);
  const record =
    payload && typeof payload === "object" ? (payload as Record<string, unknown>) : null;
  const inner =
    record && record.data && typeof record.data === "object"
      ? (record.data as Record<string, unknown>)
      : record;

  const nextCursorRaw = inner ? inner.nextCursor : undefined;
  const hasMoreRaw = inner ? inner.hasMore : undefined;
  const sessionIdRaw = inner ? inner.chatSessionId : undefined;

  return {
    chatSessionId:
      typeof sessionIdRaw === "number" ? sessionIdRaw : fallbackSessionId,
    messages,
    nextCursor: typeof nextCursorRaw === "number" ? nextCursorRaw : undefined,
    hasMore: hasMoreRaw === true,
  };
}
