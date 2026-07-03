import { beforeEach, describe, expect, it, vi } from "vitest";
import { DashboardService } from "../../../../src/modules/admin/dashboard/dashboard.service";

const mocks = vi.hoisted(() => ({
  cacheAbsoluteSCard: vi.fn(),
  cacheAbsoluteSMembers: vi.fn(),
  cacheGetJobsByIds: vi.fn(),
}));

vi.mock("../../../../src/lib/cache", () => ({
  cacheAbsoluteSCard: mocks.cacheAbsoluteSCard,
  cacheAbsoluteSMembers: mocks.cacheAbsoluteSMembers,
  cacheGetJobsByIds: mocks.cacheGetJobsByIds,
}));

describe("DashboardService", () => {
  const repository = {
    countUsers: vi.fn(),
    countActiveUsers: vi.fn(),
  };
  const scrapersService = {
    getStatus: vi.fn(),
    getJobsCount: vi.fn(),
  };
  const healthService = {
    getHealthcheck: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    repository.countUsers.mockResolvedValue(10);
    repository.countActiveUsers.mockResolvedValue(7);
    scrapersService.getStatus.mockResolvedValue({
      name: "go-scraper",
      running: true,
      lastRunAt: "2026-07-02T10:00:00.000Z",
    });
    scrapersService.getJobsCount.mockResolvedValue({ total: 42 });
    healthService.getHealthcheck.mockResolvedValue({
      status: "ok",
      timestamp: "2026-07-02T10:00:00.000Z",
      services: {
        postgres: { status: "ok" },
        valkey: { status: "ok" },
        scraper: { status: "ok" },
      },
    });
    mocks.cacheAbsoluteSCard.mockResolvedValue(42);
    mocks.cacheAbsoluteSMembers.mockResolvedValue(["job-1", "job-2", "job-3"]);
    mocks.cacheGetJobsByIds.mockResolvedValue([
      { id: "job-1", collectedAt: new Date().toISOString() },
      { id: "job-2", scrapedAt: "2020-01-01T00:00:00.000Z" },
      { id: "job-3" },
    ]);
  });

  it("retorna indicadores operacionais básicos", async () => {
    const service = new DashboardService(
      repository as any,
      scrapersService as any,
      healthService as any,
    );

    const result = await service.getOverview();

    expect(result.stats).toEqual({
      totalUsers: 10,
      activeUsers: 7,
      totalCollectedJobs: 42,
      jobsCollectedToday: 1,
    });
    expect(result.scrapers).toEqual([
      {
        name: "go-scraper",
        status: "running",
        running: true,
        lastRunAt: "2026-07-02T10:00:00.000Z",
        jobsCollected: 42,
      },
    ]);
    expect(result.services.status).toBe("ok");
  });

  it("marca scraper como down quando a consulta falha", async () => {
    scrapersService.getStatus.mockRejectedValueOnce(new Error("down"));

    const service = new DashboardService(
      repository as any,
      scrapersService as any,
      healthService as any,
    );

    const result = await service.getOverview();

    expect(result.scrapers[0]).toEqual({
      name: "go-scraper",
      status: "down",
      running: false,
      lastRunAt: null,
      jobsCollected: null,
    });
  });

  it("uses scraper status fallbacks without requiring the count endpoint", async () => {
    scrapersService.getStatus.mockResolvedValueOnce({
      running: false,
      jobsCollected: 5,
    });

    const service = new DashboardService(
      repository as any,
      scrapersService as any,
      healthService as any,
    );

    const result = await service.getOverview();

    expect(result.scrapers[0]).toEqual({
      name: "go-scraper",
      status: "idle",
      running: false,
      lastRunAt: null,
      jobsCollected: 5,
    });
  });
});
