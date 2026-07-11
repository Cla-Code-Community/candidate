import { api } from "./client";

export type Role = "user" | "support" | "admin" | "super_admin";
export type PermissionRule = {
  resource: string;
  action: string;
  defaultMinRole: Role;
  minRole: Role;
  customized: boolean;
  reason?: string | null;
};

export type PermissionRulesResponse = {
  rules: PermissionRule[];
};

export const permissionsApi = {
  list: () => api.get<PermissionRulesResponse>("/admin/permissions/rules"),
  update: (rules: Array<Pick<PermissionRule, "resource" | "action" | "minRole">>) =>
    api.patch<PermissionRulesResponse>("/admin/permissions/rules", { rules }),
};
