import { AuditController } from "../modules/admin/audit/audit.controller";
import { AuditRepository } from "../modules/admin/audit/audit.repository";
import { AuditService } from "../modules/admin/audit/audit.service";
import { DashboardController } from "../modules/admin/dashboard/dashboard.controller";
import { DashboardRepository } from "../modules/admin/dashboard/dashboard.repository";
import { DashboardService } from "../modules/admin/dashboard/dashboard.service";
import { HealthService } from "../modules/admin/observability/health.service";
import { MetricsService } from "../modules/admin/observability/metrics.service";
import { ObservabilityController } from "../modules/admin/observability/observability.controller";
import { ObservabilityService } from "../modules/admin/observability/observability.service";
import { ScrapersController } from "../modules/admin/scrapers/scrapers.controller";
import { ScrapersService } from "../modules/admin/scrapers/scrapers.service";
import { AdminUsersController } from "../modules/admin/users/adminUsers.controller";
import { AdminUsersRepository } from "../modules/admin/users/adminUsers.repository";
import { AdminUsersService } from "../modules/admin/users/adminUsers.service";

const auditRepository = new AuditRepository();
const auditService = new AuditService(auditRepository);
const healthService = new HealthService();
const metricsService = new MetricsService();
const scrapersService = new ScrapersService();

export const usersCtrl = new AdminUsersController(
  new AdminUsersService(new AdminUsersRepository()),
  auditService,
);

export const auditCtrl = new AuditController(auditService);
export const scrapersCtrl = new ScrapersController(scrapersService, auditService);

export const dashboardCtrl = new DashboardController(
  new DashboardService(new DashboardRepository(), scrapersService, healthService),
  auditService,
);

export const observabilityCtrl = new ObservabilityController(
  new ObservabilityService(healthService, metricsService),
  auditService,
);
