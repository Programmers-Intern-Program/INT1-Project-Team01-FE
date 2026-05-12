import { apiFetch } from "../api-client";

export interface SlackIntegration {
  id: number;
  slackTeamId: string;
  slackChannelId: string;
  maskedBotToken: string;
}

export interface SlackInstallUrlResponse {
  url: string;
}

export interface CreateSlackIntegrationReq {
  slackTeamId: string;
  slackChannelId: string;
  botToken: string;
}

export interface UpdateSlackIntegrationReq {
  slackTeamId?: string;
  slackChannelId?: string;
  botToken?: string;
}

export async function getSlackInstallUrl(workspaceId: number) {
  const payload = await apiFetch<SlackInstallUrlResponse | string>(
    `/api/v1/workspaces/${workspaceId}/slack/install`,
  );
  if (typeof payload === "string") return payload;
  if (payload?.url) return payload.url;
  throw new Error("Slack 설치 URL을 확인할 수 없습니다.");
}

export function listSlackIntegrations(workspaceId: number) {
  return apiFetch<SlackIntegration[]>(
    `/api/v1/workspaces/${workspaceId}/slack/integrations`,
  );
}

export function createSlackIntegration(
  workspaceId: number,
  body: CreateSlackIntegrationReq,
) {
  return apiFetch<SlackIntegration>(
    `/api/v1/workspaces/${workspaceId}/slack/integrations`,
    {
      method: "POST",
      body: JSON.stringify(body),
    },
  );
}

export function updateSlackIntegration(
  workspaceId: number,
  integrationId: number,
  body: UpdateSlackIntegrationReq,
) {
  return apiFetch<SlackIntegration>(
    `/api/v1/workspaces/${workspaceId}/slack/integrations/${integrationId}`,
    {
      method: "PATCH",
      body: JSON.stringify(body),
    },
  );
}

export function deleteSlackIntegration(
  workspaceId: number,
  integrationId: number,
) {
  return apiFetch<void>(
    `/api/v1/workspaces/${workspaceId}/slack/integrations/${integrationId}`,
    { method: "DELETE" },
  );
}
