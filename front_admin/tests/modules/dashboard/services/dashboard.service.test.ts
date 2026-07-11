import { beforeEach, describe, expect, it, vi } from "vitest";
import { dashboardApi } from "../../../../src/lib/api/dashboard.api";
import { dashboardService } from "../../../../src/modules/dashboard/services/dashboard.service";

vi.mock("../../../../src/lib/api/dashboard.api", () => ({
  dashboardApi: {
    getOverview: vi.fn(),
  },
}));

const backendOverview = {
  stats: {
    totalUsers: 10,
    activeUsers: 8,
    totalCollectedJobs: 1234,
    jobsCollectedToday: 12,
  },
  scrapers: [
    {
      name: "Adzuna",
      status: "running" as const,
      running: true,
      lastRunAt: "2026-01-01T10:00:00.000Z",
      jobsCollected: 100,
    },
    {
      name: "Lever",
      status: "down" as const,
      running: false,
      lastRunAt: "not-a-date",
      jobsCollected: null,
    },
  ],
  services: {
    status: "degraded" as const,
    timestamp: "2026-01-01T10:00:00.000Z",
    services: {
      postgres: { status: "ok" as const, latencyMs: 10 },
      valkey: { status: "degraded" as const, error: "slow" },
      scraper: { status: "down" as const },
    },
  },
  generatedAt: "2026-01-01T10:00:00.000Z",
};

describe("dashboardService", () => {
  beforeEach(() => {
    vi.mocked(dashboardApi.getOverview).mockResolvedValue(backendOverview);
  });

  it("maps backend overview to dashboard view model", async () => {
    const overview = await dashboardService.getOverview();

    expect(overview.stats.totalJobs.value).toBe(1234);
    expect(overview.resources).toEqual({
      scraper: 0,
      postgres: 99,
      valkey: 65,
    });
    expect(overview.services).toEqual([
      { name: "Postgres", status: "Online", sla: "10ms", health: 99, tone: "success" },
      { name: "Valkey", status: "Instavel", sla: "slow", health: 65, tone: "warning" },
      { name: "Scraper", status: "Indisponivel", sla: "Sem resposta", health: 0, tone: "danger" },
    ]);
    expect(overview.scrapers[1]).toMatchObject({
      name: "Lever",
      status: "Indisponivel",
      lastRun: "not-a-date",
      collected24h: 0,
      active: false,
    });
  });

  it("exposes segmented getters and noop toggle", async () => {
    await expect(dashboardService.getStats()).resolves.toMatchObject({
      activeUsers: { value: 8 },
    });
    await expect(dashboardService.getResources()).resolves.toMatchObject({
      postgres: 99,
    });
    await expect(dashboardService.getServices()).resolves.toHaveLength(3);
    await expect(dashboardService.getScrapersSummary()).resolves.toHaveLength(2);
    await expect(dashboardService.toggleScraper("x", true)).resolves.toBeUndefined();
  });
});
