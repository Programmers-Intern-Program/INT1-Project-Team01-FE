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
