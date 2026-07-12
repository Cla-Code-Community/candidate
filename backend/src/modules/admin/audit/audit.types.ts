import { z } from "zod";
import type { AuditLog } from "../../../db/schema/auditLogs";
import type { Resource } from "../permissions/permissionMatrix";
import type { Role } from "../permissions/roles";

// --- Enums ---
export const AuditActionSchema = z.enum([
  "users.read",
  "users.block",
  "users.unblock",
  "users.delete",
  "users.reset_password",
  "users.change_role",
  "dashboard.read",
  "scrapers.read",
  "scrapers.trigger",
  "scrapers.reprocess",
  "observability.health",
  "observability.metrics",
  "observability.dashboards",
  "observability.overview",
  "audit.read",
  "permissions.read",
  "permissions.update",
  "auth.login",
  "auth.logout",
]);

export type AuditAction = z.infer<typeof AuditActionSchema>;

// --- WriteAuditLogInput ---
export const WriteAuditLogInputSchema = z.object({
  actorId: z.string().uuid("ID do ator inválido"),
  actorRole: z.custom<Role>(),
  action: AuditActionSchema,
  targetType: z.custom<Resource>().optional(),
  targetId: z.string().optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
  ip: z
    .string()
    .optional()
    .refine((val) => !val || val.length <= 45, {
      message: "IP inválido",
    }),
});

export type WriteAuditLogInput = z.infer<typeof WriteAuditLogInputSchema>;

// --- AuditFilters ---
export const AuditFiltersSchema = z.object({
  actorId: z.string().uuid("ID do ator inválido").optional(),
  action: AuditActionSchema.optional(),
  targetType: z.custom<Resource>().optional(),
  targetId: z.string().optional(),
  from: z.date().optional(),
  to: z.date().optional(),
  limit: z.number().int().positive().optional(),
  offset: z.number().int().min(0).optional(),
});

export type AuditFilters = z.infer<typeof AuditFiltersSchema>;

// --- PaginatedAuditLogs ---
export const PaginatedAuditLogsSchema = z.object({
  data: z.array(z.custom<AuditLog>()),
  total: z.number().int().min(0),
  limit: z.number().int().positive(),
  offset: z.number().int().min(0),
});

export type PaginatedAuditLogs = z.infer<typeof PaginatedAuditLogsSchema>;

export type { AuditLog };
