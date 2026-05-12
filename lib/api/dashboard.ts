import { apiFetch } from "../api-client";
import type { TaskStatus } from "./tasks";

export interface DashboardRecentReport {
  reportId?: number;
  taskId?: number;
  status?: TaskStatus;
  summary?: string;
  detail?: string;
  recommendedAction?: string;
  createdAt?: string;
}

export interface DashboardRecentLog {
  logId?: number;
  executionId?: number;
  level?: "INFO" | "WARN" | "ERROR" | "DEBUG";
  message?: string;
  createdAt?: string;
}

export interface WorkspaceDashboardSummary {
  agentCount: number;
  runningAgentCount: number;
  idleAgentCount: number;
  errorAgentCount: number;
  taskCount: number;
  runningTaskCount: number;
  completedTaskCount: number;
  failedTaskCount: number;
  recentReports: DashboardRecentReport[];
  recentLogs: DashboardRecentLog[];
}

export function getWorkspaceDashboardSummary(workspaceId: number) {
  return apiFetch<WorkspaceDashboardSummary>(
    `/api/v1/workspaces/${workspaceId}/dashboard/summary`,
  );
}
