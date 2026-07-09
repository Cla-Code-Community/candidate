import { api } from "./client";

export type AuditLog = {
  id: number;
  actorId: string | null;
  actorRole: "user" | "support" | "admin" | "super_admin";
  action: string;
  targetType: string | null;
  targetId: string | null;
  metadata: Record<string, unknown> | null;
  ip: string | null;
  createdAt: string;
};

export type AuditQuery = {
  action?: string;
  targetType?: string;
  actorId?: string;
  from?: string;
  to?: string;
  limit?: number;
  offset?: number;
};

export type AuditResponse = {
  data: AuditLog[];
  total: number;
  limit: number;
  offset: number;
};

function toSearchParams(query: AuditQuery): string {
  const params = new URLSearchParams();

  Object.entries(query).forEach(([key, value]) => {
    if (value !== undefined && value !== "") params.set(key, String(value));
  });

  const queryString = params.toString();
  return queryString ? `?${queryString}` : "";
}

export const auditApi = {
  list: (query: AuditQuery = {}) =>
    api.get<AuditResponse>(`/admin/audit${toSearchParams(query)}`),
};
