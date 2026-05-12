import { apiFetch } from "../api-client";

export type WorkspaceRole = "ADMIN" | "MEMBER";

export interface WorkspaceSummary {
  workspaceId: number;
  name: string;
  description: string | null;
  myRole: WorkspaceRole;
  agentCount: number;
  runningTaskCount: number;
  createdAt: string;
}

export interface WorkspaceDetail {
  workspaceId: number;
  name: string;
  description: string | null;
  createdByMemberId: number;
  myRole: WorkspaceRole;
  createdAt: string;
  updatedAt: string;
}

export interface WorkspaceMember {
  memberId: number;
  name: string;
  email: string;
  role: WorkspaceRole;
  joinedAt: string;
}

export interface CreateWorkspaceReq {
  name: string;
  description?: string;
}

export interface UpdateWorkspaceReq {
  name: string;
  description?: string;
}

export function listWorkspaces() {
  return apiFetch<WorkspaceSummary[]>("/api/v1/workspaces");
}

export function getWorkspace(workspaceId: number) {
  return apiFetch<WorkspaceDetail>(`/api/v1/workspaces/${workspaceId}`);
}

export function createWorkspace(body: CreateWorkspaceReq) {
  return apiFetch<WorkspaceDetail>("/api/v1/workspaces", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export function updateWorkspace(workspaceId: number, body: UpdateWorkspaceReq) {
  return apiFetch<WorkspaceDetail>(`/api/v1/workspaces/${workspaceId}`, {
    method: "PATCH",
    body: JSON.stringify(body),
  });
}

export function deleteWorkspace(workspaceId: number) {
  return apiFetch<void>(`/api/v1/workspaces/${workspaceId}`, {
    method: "DELETE",
  });
}

export function leaveWorkspace(workspaceId: number) {
  return apiFetch<void>(`/api/v1/workspaces/${workspaceId}/members/me`, {
    method: "DELETE",
  });
}

export function listWorkspaceMembers(workspaceId: number) {
  return apiFetch<WorkspaceMember[]>(`/api/v1/workspaces/${workspaceId}/members`);
}

export function changeMemberRole(
  workspaceId: number,
  memberId: number,
  role: WorkspaceRole,
) {
  return apiFetch<void>(
    `/api/v1/workspaces/${workspaceId}/members/${memberId}`,
    {
      method: "PATCH",
      body: JSON.stringify({ role }),
    },
  );
}

export function removeMember(workspaceId: number, memberId: number) {
  return apiFetch<void>(
    `/api/v1/workspaces/${workspaceId}/members/${memberId}`,
    { method: "DELETE" },
  );
}
