import { apiFetch } from "../api-client";

export type ArtifactNodeType = "DIRECTORY" | "FILE";

export interface ArtifactNode {
  name: string;
  path: string;
  type: ArtifactNodeType;
  contentType?: string | null;
  sizeBytes?: number | null;
  children?: ArtifactNode[];
}

export interface ArtifactTree {
  workspaceId: number;
  rootPath: string;
  children: ArtifactNode[];
}

export interface ArtifactFileContent {
  workspaceId: number;
  path: string;
  name: string;
  contentType?: string;
  sizeBytes?: number;
  content: string;
}

export interface OrchestrationPlanFile {
  path: string;
  name: string;
  contentType?: string;
  sizeBytes?: number;
  exists?: boolean;
}

export interface OrchestrationPlanStep {
  stepId: number;
  stepKey?: string;
  sequenceNo: number;
  title: string;
  files: OrchestrationPlanFile[];
}

export interface OrchestrationPlanArtifact {
  workspaceId: number;
  planId: number;
  steps: OrchestrationPlanStep[];
}

export async function getArtifactTree(workspaceId: number): Promise<ArtifactTree> {
  const payload = await apiFetch<unknown>(
    `/api/v1/workspaces/${workspaceId}/artifacts/tree`,
  );
  return unwrap<ArtifactTree>(payload);
}

export async function getArtifactFile(
  workspaceId: number,
  path: string,
): Promise<ArtifactFileContent> {
  const payload = await apiFetch<unknown>(
    `/api/v1/workspaces/${workspaceId}/artifacts/files?path=${encodeURIComponent(path)}`,
  );
  return unwrap<ArtifactFileContent>(payload);
}

export async function getOrchestrationPlanArtifact(
  workspaceId: number,
  planId: number,
): Promise<OrchestrationPlanArtifact> {
  const payload = await apiFetch<unknown>(
    `/api/v1/workspaces/${workspaceId}/artifacts/orchestration-plans/${planId}`,
  );
  return unwrap<OrchestrationPlanArtifact>(payload);
}

function unwrap<T>(payload: unknown): T {
  if (payload && typeof payload === "object") {
    const record = payload as Record<string, unknown>;
    if (record.data && typeof record.data === "object") {
      return record.data as T;
    }
  }
  return payload as T;
}
