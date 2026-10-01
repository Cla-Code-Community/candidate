import { act, renderHook, screen, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { NotificationProvider } from "../../../../src/components/notifications/NotificationProvider";
import { ApiError } from "../../../../src/lib/api/client";
import { useDashboard } from "../../../../src/modules/dashboard/hooks/useDashboard";
import { useDashboardMetrics } from "../../../../src/modules/dashboard/hooks/useDashboardMetrics";
import { useDashboardScrapers } from "../../../../src/modules/dashboard/hooks/useDashboardScrapers";
import { useDashboardServices } from "../../../../src/modules/dashboard/hooks/useDashboardServices";
import { dashboardService } from "../../../../src/modules/dashboard/services/dashboard.service";

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

function wrapper({ children }: { children: ReactNode }) {
  return <NotificationProvider>{children}</NotificationProvider>;
}

describe("dashboard hooks", () => {
  beforeEach(() => {
    vi.clearAllMocks();
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
    vi.mocked(dashboardService.toggleScraper).mockResolvedValue(undefined);
  });

  it("loads dashboard overview and toggles scrapers", async () => {
    const { result } = renderHook(() => useDashboard(), { wrapper });

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.chartPoints).toHaveLength(1);
    expect(result.current.stats?.totalJobs.value).toBe(100);

    result.current.toggleScraper("adzuna");
    expect(dashboardService.toggleScraper).toHaveBeenCalledWith("adzuna", false);
    await waitFor(() =>
      expect(dashboardService.getOverview).toHaveBeenCalledTimes(2),
    );

    result.current.toggleScraper("missing");
    expect(dashboardService.toggleScraper).toHaveBeenCalledTimes(1);

    vi.mocked(dashboardService.getOverview).mockResolvedValue({
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

    const { result } = renderHook(() => useDashboard(), { wrapper });

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.error).toBe(
      "Nao foi possivel atualizar as metricas do dashboard.",
    );
  });

  it("labels invalid snapshots and caps history to the latest 24 points", async () => {
    let snapshot = 0;
    vi.mocked(dashboardService.getOverview).mockImplementation(async () => ({
      stats: {
        ...stats,
        totalJobs: { value: snapshot, trend: "ok", positive: true },
      },
      resources,
      services,
      scrapers,
      generatedAt:
        snapshot === 0
          ? "invalid timestamp"
          : new Date(Date.UTC(2026, 0, 1, 0, snapshot)).toISOString(),
    }));

    const { result } = renderHook(() => useDashboard(), { wrapper });
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.chartPoints[0].label).toBe("--:--");

    for (let index = 1; index <= 25; index += 1) {
      snapshot = index;
      await act(async () => {
        await result.current.refresh();
      });
    }

    expect(result.current.chartPoints).toHaveLength(24);
    expect(result.current.chartPoints[0].totalJobs).toBe(2);
    expect(result.current.chartPoints.at(-1)?.totalJobs).toBe(25);
  });

  it("notifies differently for an already-running scraper and other failures", async () => {
    const { result } = renderHook(() => useDashboard(), { wrapper });
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    vi.mocked(dashboardService.toggleScraper).mockRejectedValueOnce(
      new ApiError(409, { message: "already running" }),
    );
    act(() => result.current.toggleScraper("adzuna"));
    expect(await screen.findByText("Scraper já em execução")).toBeInTheDocument();
    await waitFor(() =>
      expect(dashboardService.getOverview).toHaveBeenCalledTimes(2),
    );

    vi.mocked(dashboardService.toggleScraper).mockRejectedValueOnce(
      new Error("backend unavailable"),
    );
    act(() => result.current.toggleScraper("adzuna"));
    expect(await screen.findByText("Pausa indisponível")).toBeInTheDocument();
  });

  it("reports a failed start distinctly for an idle scraper", async () => {
    vi.mocked(dashboardService.getOverview).mockResolvedValueOnce({
      stats,
      resources,
      services,
      scrapers: [{ ...scrapers[0], active: false }],
      generatedAt: "2026-01-01T10:00:00.000Z",
    });
    const { result } = renderHook(() => useDashboard(), { wrapper });
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    vi.mocked(dashboardService.toggleScraper).mockRejectedValueOnce(
      new Error("cannot start"),
    );

    act(() => result.current.toggleScraper("adzuna"));

    expect(await screen.findByText("Erro ao iniciar scraper")).toBeInTheDocument();
    expect(screen.getByText("Não foi possível iniciar Adzuna.")).toBeInTheDocument();
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
