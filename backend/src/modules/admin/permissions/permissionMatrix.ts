import type { Role } from "./roles";

export type Resource =
  | "users"
  | "scrapers"
  | "dashboard"
  | "observability"
  | "audit"
  | "permissions";

export type Action =
  | "read"
  | "block"
  | "unblock"
  | "delete"
  | "reset_password"
  | "change_role"
  | "trigger"
  | "health"
  | "metrics"
  | "manage";

export type PermissionMatrix = Record<Resource, Partial<Record<Action, Role>>>;

// Valor de cada entrada = role mínima para executar a ação
export const permissionMatrix: PermissionMatrix = {
  users: {
    read: "admin",
    block: "admin",
    unblock: "admin",
    delete: "super_admin",
    reset_password: "admin",
    change_role: "super_admin",
  },
  scrapers: {
    read: "support",
    trigger: "admin",
  },
  dashboard: {
    read: "support",
  },
  observability: {
    health: "support",
    metrics: "admin",
  },
  audit: {
    read: "admin",
  },
  permissions: {
    read: "admin",
    manage: "super_admin",
  },
};
