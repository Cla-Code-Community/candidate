import type { Role } from "./roles";

export type Resource =
  | "users"
  | "scrapers"
  | "dashboard"
  | "observability"
  | "audit";

export type Action =
  | "read"
  | "block"
  | "unblock"
  | "reset_password"
  | "change_role"
  | "trigger"
  | "health"
  | "metrics";

export type PermissionMatrix = Record<Resource, Partial<Record<Action, Role>>>;

// Valor de cada entrada = role mínima para executar a ação
export const permissionMatrix: PermissionMatrix = {
  users: {
    read: "super_admin",
    block: "admin",
    unblock: "admin",
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
};
