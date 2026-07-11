import { api } from "./client";
import type { AdminUser, AdminUsersListResponse } from "./types";

type AdminUserResponse = {
  user: AdminUser;
};

export const adminUsersApi = {
  list: () => api.get<AdminUsersListResponse>("/admin/users"),
  block: (id: string) => api.patch<AdminUserResponse>(`/admin/users/${id}/block`),
  unblock: (id: string) =>
    api.patch<AdminUserResponse>(`/admin/users/${id}/unblock`),
  changeRole: (id: string, role: string) =>
    api.patch<AdminUserResponse>(`/admin/users/${id}/role`, { role }),
  delete: (id: string) =>
    api.delete<{ ok: boolean; user: AdminUser }>(`/admin/users/${id}`),
};
