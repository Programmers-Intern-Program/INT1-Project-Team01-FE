import { apiFetch } from "../api-client";

export interface SlackIntegration {
  id: number;
  slackTeamId: string;
  slackChannelId: string;
  maskedBotToken: string;
}

export interface CreateSlackIntegrationReq {
  slackTeamId: string;
  slackChannelId: string;
  botToken: string;
  signingSecret: string;
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
