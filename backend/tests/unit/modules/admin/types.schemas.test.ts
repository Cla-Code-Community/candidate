import { describe, expect, it } from "vitest";
import {
  AuditActionSchema,
  AuditFiltersSchema,
  PaginatedAuditLogsSchema,
  WriteAuditLogInputSchema,
} from "../../../../src/modules/admin/audit/audit.types";
import {
  DashboardOverviewSchema,
  DashboardScraperStatusSchema,
  DashboardStatsSchema,
} from "../../../../src/modules/admin/dashboard/dashboard.types";
import {
  HealthcheckResultSchema,
  MetricSnapshotSchema,
  ObservabilityOverviewSchema,
  ServiceHealthSchema,
} from "../../../../src/modules/admin/observability/observability.types";
import {
  AdminScraperSchema,
  GetJobsResultSchema,
  JobsCountResultSchema,
  ScraperJobSchema,
  ScraperStatusSchema,
  TriggerScrapeResultSchema,
} from "../../../../src/modules/admin/scrapers/scrapers.types";
import {
  AdminUserFiltersSchema,
  ChangeRoleInputSchema,
  PaginatedUsersSchema,
  ResetPasswordInputSchema,
} from "../../../../src/modules/admin/users/adminUsers.types";

describe("admin zod schemas", () => {
  it("validates audit schemas", () => {
    expect(AuditActionSchema.parse("users.block")).toBe("users.block");
    expect(
      WriteAuditLogInputSchema.parse({
        actorId: "00000000-0000-4000-8000-000000000001",
        actorRole: "admin",
        action: "audit.read",
        ip: "127.0.0.1",
      }),
    ).toEqual(expect.objectContaining({ action: "audit.read" }));
    expect(AuditFiltersSchema.parse({ limit: 10 })).toEqual({ limit: 10 });
    expect(PaginatedAuditLogsSchema.parse({ data: [], total: 0, limit: 10, offset: 0 })).toEqual(
      { data: [], total: 0, limit: 10, offset: 0 },
    );
  });

  it("validates dashboard schemas", () => {
    const stats = DashboardStatsSchema.parse({
      totalUsers: 1,
      activeUsers: 1,
      totalCollectedJobs: 10,
      jobsCollectedToday: 2,
    });
    const scraper = DashboardScraperStatusSchema.parse({
      name: "go-scraper",
      status: "idle",
      running: false,
      lastRunAt: null,
      jobsCollected: null,
    });

    expect(
      DashboardOverviewSchema.parse({
        stats,
        scrapers: [scraper],
        services: {
          status: "ok",
          timestamp: "2026-07-02T10:00:00.000Z",
          services: {
            postgres: { status: "ok" },
            valkey: { status: "ok" },
            scraper: { status: "ok" },
          },
        },
        generatedAt: "2026-07-02T10:00:00.000Z",
      }).stats.totalUsers,
    ).toBe(1);
  });

  it("validates observability schemas", () => {
    expect(ServiceHealthSchema.parse({ status: "ok" })).toEqual({ status: "ok" });
    const health = HealthcheckResultSchema.parse({
      status: "ok",
      timestamp: "2026-07-02T10:00:00.000Z",
      services: {
        postgres: { status: "ok" },
        valkey: { status: "ok" },
        scraper: { status: "ok" },
      },
    });
    const metrics = MetricSnapshotSchema.parse({
      requestRatePerMinute: 1,
      errorRatePct: 0,
      p95LatencyMs: 10,
      cacheHitRatePct: 90,
      activeSessionsCount: 2,
    });
    expect(ObservabilityOverviewSchema.parse({ health, metrics }).health.status).toBe("ok");
  });

  it("validates scraper schemas", () => {
    const job = ScraperJobSchema.parse({
      id: "job-1",
      title: "Dev",
      company: "ACME",
      location: "Remote",
      url: "https://example.com/job",
      source: "linkedin",
      sources: ["linkedin"],
      keyword: "node",
      keywords: ["node"],
    });

    expect(TriggerScrapeResultSchema.parse({ ok: true, message: "started" }).ok).toBe(true);
    expect(ScraperStatusSchema.parse({ running: false }).running).toBe(false);
    expect(AdminScraperSchema.parse({
      name: "go-scraper",
      status: "idle",
      running: false,
      lastRunAt: null,
      jobsCollected: null,
    }).status).toBe("idle");
    expect(GetJobsResultSchema.parse({ jobs: [job], total: 1 }).total).toBe(1);
    expect(JobsCountResultSchema.parse({ total: 1 }).total).toBe(1);
  });

  it("validates admin user schemas", () => {
    expect(AdminUserFiltersSchema.parse({ search: "hudson", isBlocked: false })).toEqual({
      search: "hudson",
      isBlocked: false,
    });
    expect(ChangeRoleInputSchema.parse({
      userId: "00000000-0000-4000-8000-000000000001",
      newRole: "admin",
    }).newRole).toBe("admin");
    expect(ResetPasswordInputSchema.parse({
      userId: "00000000-0000-4000-8000-000000000001",
      newPassword: "Senha@123",
    }).newPassword).toBe("Senha@123");
    expect(PaginatedUsersSchema.parse({ data: [], total: 0, limit: 10, offset: 0 }).total).toBe(0);
  });
});
