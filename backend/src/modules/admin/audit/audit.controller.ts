import type { Request, Response } from "express";
import { z } from "zod";
import type { Resource } from "../permissions/permissionMatrix";
import type { AuditService } from "./audit.service";
import type { AuditAction, AuditFilters } from "./audit.types";

const AuditQuerySchema = z.object({
  actorId: z.string().uuid().optional(),
  action: z.string().optional(),
  targetType: z.string().optional(),
  targetId: z.string().optional(),
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  offset: z.coerce.number().int().min(0).default(0),
});

export class AuditController {
  constructor(private readonly service: AuditService) {}

  async getLogs(req: Request, res: Response) {
    try {
      const query = AuditQuerySchema.parse(req.query);

      const filters: AuditFilters = {
        ...query,
        action: query.action as AuditAction | undefined,
        targetType: query.targetType as Resource | undefined,
      };

      const result = await this.service.getLogs(filters);

      this.service.fromRequest(req, "audit.read");

      return res.json(result);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: error.format() });
      }
      return res.status(500).json({ error: "Erro interno" });
    }
  }
}
