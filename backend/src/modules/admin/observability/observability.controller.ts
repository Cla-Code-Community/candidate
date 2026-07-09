import type { Request, Response } from "express";
import { z } from "zod";
import type { AuditService } from "../audit/audit.service";
import type { ObservabilityService } from "./observability.service";

const DashboardQuerySchema = z.object({
  range: z.enum(["5m", "15m", "1h", "6h", "24h"]).optional(),
});

export class ObservabilityController {
  constructor(
    private readonly service: ObservabilityService,
    private readonly auditService: AuditService,
  ) {}

  async getHealth(req: Request, res: Response) {
    try {
      const result = await this.service.getHealth();
      this.auditService.fromRequest(req, "observability.health");

      // status HTTP reflete o estado agregado
      const httpStatus =
        result.status === "ok" ? 200 : result.status === "degraded" ? 207 : 503;

      return res.status(httpStatus).json(result);
    } catch {
      return res.status(500).json({ error: "Erro interno" });
    }
  }

  async getMetrics(req: Request, res: Response) {
    try {
      const result = await this.service.getMetrics();
      this.auditService.fromRequest(req, "observability.metrics");
      return res.json(result);
    } catch {
      return res.status(500).json({ error: "Erro interno" });
    }
  }

  async getDashboards(req: Request, res: Response) {
    try {
      const query = DashboardQuerySchema.parse(req.query);
      const result = await this.service.getDashboards(query.range);
      this.auditService.fromRequest(req, "observability.dashboards");
      return res.json(result);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: error.format() });
      }
      return res.status(500).json({ error: "Erro interno" });
    }
  }

  async getOverview(req: Request, res: Response) {
    try {
      const result = await this.service.getOverview();
      this.auditService.fromRequest(req, "observability.overview");

      const httpStatus =
        result.health.status === "ok"
          ? 200
          : result.health.status === "degraded"
            ? 207
            : 503;

      return res.status(httpStatus).json(result);
    } catch {
      return res.status(500).json({ error: "Erro interno" });
    }
  }
}
