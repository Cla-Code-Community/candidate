import type { Request, Response } from "express";
import type { AuditService } from "../audit/audit.service";
import type { DashboardService } from "./dashboard.service";

export class DashboardController {
  constructor(
    private readonly service: DashboardService,
    private readonly auditService: AuditService,
  ) {}

  async getOverview(req: Request, res: Response) {
    try {
      const result = await this.service.getOverview();

      this.auditService.fromRequest(req, "dashboard.read");

      return res.json(result);
    } catch {
      return res.status(500).json({ error: "Erro interno" });
    }
  }
}
