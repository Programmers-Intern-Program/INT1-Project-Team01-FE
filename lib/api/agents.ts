import { apiFetch } from "../api-client";

export type OpenClawAgentStatus =
  | "CREATING"
  | "READY"
  | "SYNC_FAILED"
  | "ERROR"
  | "DISABLED";

export type SkillFileSyncStatus = "PENDING" | "SYNCED" | "FAILED";

export interface AgentSkillFile {
  fileName: string;
  content: string;
}

export interface AgentSkillFileSync {
  id: number;
  fileName: string;
  syncStatus: SkillFileSyncStatus;
  syncError?: string;
}

export interface OpenClawAgent {
  agentId: number;
  workspaceId: number;
  name: string;
  category?: "ORCHESTRATOR" | "BACKEND" | "FRONTEND" | "QA" | "CUSTOM";
  openClawAgentId: string;
  workspacePath: string;
  status: OpenClawAgentStatus;
  syncError?: string;
  skillFiles: AgentSkillFileSync[];
}

export interface CreateAgentReq {
  name: string;
  category?: "ORCHESTRATOR" | "BACKEND" | "FRONTEND" | "QA" | "CUSTOM";
  workspacePath?: string;
  emoji?: string;
  skillFiles?: AgentSkillFile[];
}

export function createAgent(workspaceId: number, body: CreateAgentReq) {
  return apiFetch<OpenClawAgent>(
    `/api/v1/workspaces/${workspaceId}/agents`,
    {
      method: "POST",
      body: JSON.stringify(body),
    },
  );
}

export async function listAgents(workspaceId: number) {
  const payload = await apiFetch<unknown>(`/api/v1/workspaces/${workspaceId}/agents`);
  return normalizeAgents(payload);
}

export function deleteAgent(workspaceId: number, agentId: number) {
  return apiFetch<void>(
    `/api/v1/workspaces/${workspaceId}/agents/${agentId}`,
    { method: "DELETE" },
  );
}

function normalizeAgents(payload: unknown): OpenClawAgent[] {
  if (Array.isArray(payload)) return payload as OpenClawAgent[];
  if (!payload || typeof payload !== "object") return [];

  const record = payload as Record<string, unknown>;
  if (Array.isArray(record.content)) return record.content as OpenClawAgent[];
  if (Array.isArray(record.agents)) return record.agents as OpenClawAgent[];
  if (Array.isArray(record.data)) return record.data as OpenClawAgent[];

  return [];
}
