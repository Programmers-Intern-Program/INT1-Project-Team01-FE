import { apiFetch } from "../api-client";

export type GatewayMode = "MANAGED" | "EXTERNAL";
export type GatewayBindingStatus = "UNBOUND" | "BOUND";
export type GatewayConnectionStatus =
  | "CONNECTED"
  | "UNREACHABLE"
  | "TOKEN_INVALID"
  | "TIMEOUT"
  | "PAIRING_REQUIRED"
  | "FORBIDDEN"
  | "FAILED";

export interface WorkspaceGatewayBinding {
  id: number;
  workspaceId: number;
  mode: GatewayMode;
  gatewayUrl: string;
  maskedToken: string;
}

export interface WorkspaceGatewayStatus {
  status: GatewayBindingStatus;
  bound: boolean;
  bindingId?: number | null;
  mode?: GatewayMode | null;
  gatewayUrl?: string | null;
  maskedToken?: string | null;
  lastStatus?: GatewayConnectionStatus | null;
  lastCheckedAt?: string | null;
  lastError?: string | null;
  updatedAt?: string | null;
}

export interface WorkspaceGatewayConnectionTest {
  status: GatewayConnectionStatus;
  connected: boolean;
  gatewayUrl: string;
  message: string;
  agentCount: number;
}

export interface CreateGatewayBindingReq {
  gatewayUrl: string;
  token: string;
  validateConnection?: boolean;
}

export function getWorkspaceGatewayStatus(workspaceId: number) {
  return apiFetch<WorkspaceGatewayStatus>(
    `/api/v1/workspaces/${workspaceId}/gateway`,
  );
}

export function testGatewayConnection(
  workspaceId: number,
  body: Pick<CreateGatewayBindingReq, "gatewayUrl" | "token">,
) {
  return apiFetch<WorkspaceGatewayConnectionTest>(
    `/api/v1/workspaces/${workspaceId}/gateway/connection-test`,
    {
      method: "POST",
      body: JSON.stringify(body),
    },
  );
}

export function createGatewayBinding(
  workspaceId: number,
  body: CreateGatewayBindingReq,
) {
  return apiFetch<WorkspaceGatewayBinding>(
    `/api/v1/workspaces/${workspaceId}/gateway/binding`,
    {
      method: "POST",
      body: JSON.stringify(body),
    },
  );
}
