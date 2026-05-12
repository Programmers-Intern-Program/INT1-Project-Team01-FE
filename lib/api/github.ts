import { apiFetch } from "../api-client";

export interface GithubCredentialInfo {
  id: number;
  displayName: string;
  maskedToken: string;
}

export interface CreateGithubCredentialReq {
  displayName: string;
  token: string;
}

export interface UpdateGithubCredentialReq {
  displayName?: string;
  token?: string;
}

export function listGithubCredentials(workspaceId: number) {
  return apiFetch<GithubCredentialInfo[]>(
    `/api/v1/workspaces/${workspaceId}/github/credentials`,
  );
}

export function createGithubCredential(
  workspaceId: number,
  body: CreateGithubCredentialReq,
) {
  return apiFetch<GithubCredentialInfo>(
    `/api/v1/workspaces/${workspaceId}/github/credentials`,
    {
      method: "POST",
      body: JSON.stringify(body),
    },
  );
}

export function updateGithubCredential(
  workspaceId: number,
  credentialId: number,
  body: UpdateGithubCredentialReq,
) {
  return apiFetch<GithubCredentialInfo>(
    `/api/v1/workspaces/${workspaceId}/github/credentials/${credentialId}`,
    {
      method: "PATCH",
      body: JSON.stringify(body),
    },
  );
}

export function deleteGithubCredential(
  workspaceId: number,
  credentialId: number,
) {
  return apiFetch<void>(
    `/api/v1/workspaces/${workspaceId}/github/credentials/${credentialId}`,
    { method: "DELETE" },
  );
}
