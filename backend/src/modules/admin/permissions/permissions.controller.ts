import type { Request, Response } from "express";
import { z } from "zod";
import type { AuditService } from "../audit/audit.service";
import { permissionsService } from "./permissions.service";

const RoleSchema = z.enum(["user", "support", "admin", "super_admin"]);
const ResourceSchema = z.enum([
  "users",
  "scrapers",
  "dashboard",
  "observability",
  "audit",
  "permissions",
]);
const ActionSchema = z.enum([
  "read",
  "block",
  "unblock",
  "delete",
  "reset_password",
  "change_role",
  "trigger",
  "health",
  "metrics",
  "manage",
]);

const UpdateRulesSchema = z.object({
  rules: z.array(
    z.object({
      resource: ResourceSchema,
      action: ActionSchema,
      minRole: RoleSchema,
      reason: z.string().max(500).nullable().optional(),
    }),
  ),
});

export class PermissionsController {
  constructor(private readonly auditService: AuditService) {}

  async listRules(req: Request, res: Response) {
    try {
      const rules = await permissionsService.getRules();
      this.auditService.fromRequest(req, "permissions.read");
      return res.json({ rules });
    } catch {
      return res.status(500).json({ error: "Erro ao listar permissoes" });
    }
  }

  async updateRules(req: Request, res: Response) {
    try {
      const body = UpdateRulesSchema.parse(req.body);
      const rules = await permissionsService.updateRules(body.rules);
      this.auditService.fromRequest(req, "permissions.update", undefined, {
        rules: body.rules,
      });
      return res.json({ rules });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: error.format() });
      }
      return res.status(400).json({
        error: error instanceof Error ? error.message : "Erro ao salvar permissoes",
      });
    }
  }
}
