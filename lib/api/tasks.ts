import { apiFetch } from "../api-client";

export type TaskStatus =
  | "PENDING"
  | "ASSIGNED"
  | "IN_PROGRESS"
  | "COMPLETED"
  | "FAILED"
  | "ON_HOLD"
  | "CANCELED";

export interface WorkspaceTask {
  taskId: number;
  title: string;
  description?: string | null;
  status: TaskStatus;
  assignedAgentId?: string | number | null;
  assigneeId?: string | number | null;
  createdAt?: string;
  updatedAt?: string;
}

export interface CreateTaskReq {
  title: string;
  description?: string;
  assignedAgentId?: string | number;
}

export function listWorkspaceTasks(workspaceId: number) {
  return apiFetch<WorkspaceTask[]>(`/api/v1/workspaces/${workspaceId}/tasks`);
}

export function createWorkspaceTask(workspaceId: number, body: CreateTaskReq) {
  return apiFetch<WorkspaceTask>(`/api/v1/workspaces/${workspaceId}/tasks`, {
    method: "POST",
    body: JSON.stringify(body),
  });
}
