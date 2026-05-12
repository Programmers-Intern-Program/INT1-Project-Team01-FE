import { apiFetch } from "../api-client";

export type TaskStatus =
  | "REQUESTED"
  | "ASSIGNED"
  | "IN_PROGRESS"
  | "WAITING_USER"
  | "COMPLETED"
  | "FAILED"
  | "CANCELED";

export interface WorkspaceTask {
  taskId: number;
  workspaceId?: number;
  title: string;
  description?: string | null;
  taskType?: TaskType;
  priority?: TaskPriority;
  status: TaskStatus;
  assignedAgentId?: string | number | null;
  assigneeId?: string | number | null;
  repositoryId?: string | number | null;
  sourceType?: TaskSourceType;
  sourceId?: string | null;
  originalRequest?: string | null;
  createdAt?: string;
  updatedAt?: string;
}

export type TaskType =
  | "CODE_REVIEW"
  | "PR_REVIEW"
  | "BUG_FIX"
  | "FEATURE_IMPLEMENTATION"
  | "REFACTORING"
  | "TEST_CREATION"
  | "DOCUMENTATION"
  | "PR_CREATION"
  | "OTHER";

export type TaskPriority = "LOW" | "MEDIUM" | "HIGH" | "URGENT";
export type TaskSourceType =
  | "DASHBOARD"
  | "SLACK"
  | "GITHUB"
  | "CHAT"
  | "ORCHESTRATOR"
  | "OTHER";

export type TaskArtifactType =
  | "PR_URL"
  | "COMMIT_HASH"
  | "FILE_PATH"
  | "DIFF"
  | "LOG_FILE"
  | "RESULT_FILE"
  | "OTHER";

export interface TaskArtifact {
  artifactId: number;
  artifactType: TaskArtifactType;
  name: string;
  url?: string | null;
}

export interface AgentReport {
  reportId: number;
  taskId: number;
  status: TaskStatus;
  summary?: string | null;
  detail?: string | null;
  recommendedAction?: string | null;
  artifacts?: TaskArtifact[];
  createdAt?: string;
}

export interface CreateTaskReq {
  title: string;
  description?: string;
  assignedAgentId?: string | number;
}

interface Page<T> {
  content: T[];
  totalPages?: number;
  totalElements?: number;
  first?: boolean;
  last?: boolean;
  numberOfElements?: number;
}

export async function listWorkspaceTasks(workspaceId: number): Promise<WorkspaceTask[]> {
  const res = await apiFetch<Page<WorkspaceTask> | WorkspaceTask[]>(
    `/api/v1/workspaces/${workspaceId}/tasks`,
  );
  if (Array.isArray(res)) return res;
  return res?.content ?? [];
}

export function createWorkspaceTask(workspaceId: number, body: CreateTaskReq) {
  return apiFetch<WorkspaceTask>(`/api/v1/workspaces/${workspaceId}/tasks`, {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export function getWorkspaceTask(workspaceId: number, taskId: number) {
  return apiFetch<WorkspaceTask>(`/api/v1/workspaces/${workspaceId}/tasks/${taskId}`);
}

export async function listTaskReports(workspaceId: number, taskId: number): Promise<AgentReport[]> {
  const payload = await apiFetch<AgentReport[] | Page<AgentReport>>(
    `/api/v1/workspaces/${workspaceId}/tasks/${taskId}/reports`,
  );
  if (Array.isArray(payload)) return payload;
  return payload?.content ?? [];
}
