import { api } from "./client";
import type { AdminUser, AdminUsersListResponse } from "./types";

type AdminUserResponse = {
  user: AdminUser;
};

type AdminUsersListParams = {
  limit?: number;
  offset?: number;
  search?: string;
  role?: AdminUser["role"];
  isBlocked?: boolean;
};

function buildUsersQuery(params?: AdminUsersListParams) {
  if (!params) return "";

  const query = new URLSearchParams();

  Object.entries(params).forEach(([key, value]) => {
    if (value === undefined || value === "") return;
    query.set(key, String(value));
  });

  const queryString = query.toString();
  return queryString ? `?${queryString}` : "";
}

export const adminUsersApi = {
  list: (params?: AdminUsersListParams) =>
    api.get<AdminUsersListResponse>(`/admin/users${buildUsersQuery(params)}`),
  block: (id: string) => api.patch<AdminUserResponse>(`/admin/users/${id}/block`),
  unblock: (id: string) =>
    api.patch<AdminUserResponse>(`/admin/users/${id}/unblock`),
  changeRole: (id: string, role: string) =>
    api.patch<AdminUserResponse>(`/admin/users/${id}/role`, { role }),
  delete: (id: string) =>
    api.delete<{ ok: boolean; user: AdminUser }>(`/admin/users/${id}`),
};
