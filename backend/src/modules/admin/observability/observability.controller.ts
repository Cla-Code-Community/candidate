import type { Request, Response } from "express";
import type { AuditService } from "../audit/audit.service";
import type { ObservabilityService } from "./observability.service";

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
