import { apiFetch } from "../api-client";
import type { WorkspaceRole } from "./workspaces";

export type InviteStatus = "PENDING" | "ACCEPTED" | "EXPIRED" | "REVOKED";
export type EmailStatus = "NOT_REQUESTED" | "PENDING" | "SENT" | "FAILED";

export interface InviteInfo {
  inviteId: number;
  workspaceName: string;
  role: WorkspaceRole;
  expiresAt: string;
  status: InviteStatus;
  expired: boolean;
}

export interface InviteManagement {
  inviteId: number;
  token: string;
  inviteUrl: string;
  role: WorkspaceRole;
  targetEmail: string | null;
  emailStatus: EmailStatus;
  createdByMemberId: number;
  createdByMemberName: string;
  expiresAt: string;
  status: InviteStatus;
  emailSentAt: string | null;
  acceptedAt: string | null;
  revokedAt: string | null;
}

export interface CreateInviteReq {
  expiresInDays: number;
  role: WorkspaceRole;
  targetEmail?: string;
}

export function getInviteInfo(token: string) {
  return apiFetch<InviteInfo>(`/api/v1/invites/${token}`, {
    skipAuth: true,
    skipRefreshRetry: true,
  });
}

export function acceptInvite(token: string) {
  return apiFetch<void>(`/api/v1/invites/${token}/accept`, { method: "POST" });
}

export function listSentInvites(workspaceId: number, status?: string) {
  const qs = status ? `?status=${encodeURIComponent(status)}` : "";
  return apiFetch<InviteManagement[]>(
    `/api/v1/workspaces/${workspaceId}/invites${qs}`,
  );
}

export function createInviteLink(workspaceId: number, body: CreateInviteReq) {
  return apiFetch<{
    inviteId: number;
    token: string;
    inviteUrl: string;
    expiresAt: string;
  }>(`/api/v1/workspaces/${workspaceId}/invites`, {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export function extendInvite(
  workspaceId: number,
  inviteId: number,
  additionalDays: number,
) {
  return apiFetch<InviteManagement>(
    `/api/v1/workspaces/${workspaceId}/invites/${inviteId}/extend`,
    {
      method: "PATCH",
      body: JSON.stringify({ additionalDays }),
    },
  );
}

export function deleteInvite(workspaceId: number, inviteId: number) {
  return apiFetch<void>(
    `/api/v1/workspaces/${workspaceId}/invites/${inviteId}`,
    { method: "DELETE" },
  );
}
