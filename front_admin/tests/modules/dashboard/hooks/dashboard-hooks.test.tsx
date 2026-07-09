import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { dashboardService } from "../../../../src/modules/dashboard/services/dashboard.service";
import { useDashboard } from "../../../../src/modules/dashboard/hooks/useDashboard";
import { useDashboardMetrics } from "../../../../src/modules/dashboard/hooks/useDashboardMetrics";
import { useDashboardScrapers } from "../../../../src/modules/dashboard/hooks/useDashboardScrapers";
import { useDashboardServices } from "../../../../src/modules/dashboard/hooks/useDashboardServices";

vi.mock("../../../../src/modules/dashboard/services/dashboard.service", () => ({
  dashboardService: {
    getOverview: vi.fn(),
    getStats: vi.fn(),
    getResources: vi.fn(),
    getServices: vi.fn(),
    getScrapersSummary: vi.fn(),
    toggleScraper: vi.fn(),
  },
}));

const stats = {
  totalUsers: { value: 10, trend: "ok", positive: true },
  activeUsers: { value: 8, trend: "ok", positive: true },
  totalJobs: { value: 100, trend: "ok", positive: true },
  jobsToday: { value: 5, trend: "ok", positive: true },
};
const resources = { scraper: 99, postgres: 99, valkey: 65 };
const services = [
  { name: "Postgres", status: "Online", sla: "10ms", health: 99, tone: "success" as const },
];
const scrapers = [
  {
    id: "adzuna",
    name: "Adzuna",
    status: "Online",
    lastRun: "Hoje",
    collected24h: 2,
    active: true,
  },
];

describe("dashboard hooks", () => {
  beforeEach(() => {
    vi.mocked(dashboardService.getOverview).mockResolvedValue({
      stats,
      resources,
      services,
      scrapers,
      generatedAt: "2026-01-01T10:00:00.000Z",
    });
    vi.mocked(dashboardService.getStats).mockResolvedValue(stats);
    vi.mocked(dashboardService.getResources).mockResolvedValue(resources);
    vi.mocked(dashboardService.getServices).mockResolvedValue(services);
    vi.mocked(dashboardService.getScrapersSummary).mockResolvedValue(scrapers);
  });

  it("loads dashboard overview and toggles scrapers", async () => {
    const { result } = renderHook(() => useDashboard());

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.chartPoints).toHaveLength(1);
    expect(result.current.stats?.totalJobs.value).toBe(100);

    result.current.toggleScraper("adzuna");
    expect(dashboardService.toggleScraper).toHaveBeenCalledWith("adzuna", false);

    result.current.toggleScraper("missing");
    expect(dashboardService.toggleScraper).toHaveBeenCalledTimes(1);

    vi.mocked(dashboardService.getOverview).mockResolvedValueOnce({
      stats: { ...stats, totalJobs: { value: 101, trend: "ok", positive: true } },
      resources,
      services,
      scrapers,
      generatedAt: "2026-01-01T10:00:00.000Z",
    });
    await act(async () => {
      await result.current.refresh();
    });
    expect(result.current.chartPoints).toHaveLength(1);
    expect(result.current.chartPoints[0].totalJobs).toBe(101);
  });

  it("handles dashboard refresh failures", async () => {
    vi.mocked(dashboardService.getOverview).mockRejectedValueOnce(new Error("fail"));

    const { result } = renderHook(() => useDashboard());

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.error).toBe(
      "Nao foi possivel atualizar as metricas do dashboard.",
    );
  });

  it("loads segmented metric, service and scraper hooks", async () => {
    const metrics = renderHook(() => useDashboardMetrics());
    await waitFor(() => expect(metrics.result.current.stats).toEqual(stats));
    expect(metrics.result.current.resources).toEqual(resources);

    const serviceHook = renderHook(() => useDashboardServices());
    await waitFor(() => expect(serviceHook.result.current.services).toEqual(services));

    const scraperHook = renderHook(() => useDashboardScrapers());
    await waitFor(() => expect(scraperHook.result.current.scrapers).toEqual(scrapers));
    scraperHook.result.current.toggleScraper("adzuna");
    expect(dashboardService.toggleScraper).toHaveBeenCalledWith("adzuna", false);
  });

  it("falls back to empty segmented hook states on errors", async () => {
    vi.mocked(dashboardService.getStats).mockRejectedValueOnce(new Error("fail"));
    vi.mocked(dashboardService.getResources).mockRejectedValueOnce(new Error("fail"));
    vi.mocked(dashboardService.getServices).mockRejectedValueOnce(new Error("fail"));
    vi.mocked(dashboardService.getScrapersSummary).mockRejectedValueOnce(new Error("fail"));

    const metrics = renderHook(() => useDashboardMetrics());
    await waitFor(() => expect(metrics.result.current.stats).toBeNull());

    const serviceHook = renderHook(() => useDashboardServices());
    await waitFor(() => expect(serviceHook.result.current.services).toEqual([]));

    const scraperHook = renderHook(() => useDashboardScrapers());
    await waitFor(() => expect(scraperHook.result.current.scrapers).toEqual([]));
  });
});
