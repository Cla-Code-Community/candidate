import { act, renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { NotificationProvider } from "../../../../src/components/notifications/NotificationProvider";
import { ApiError } from "../../../../src/lib/api/client";
import { scrapersApi } from "../../../../src/lib/api/scrapers.api";
import { useScrapers } from "../../../../src/modules/scrapers/hooks/useScrapers";

vi.mock("../../../../src/lib/api/scrapers.api", () => ({
  scrapersApi: {
    list: vi.fn(),
    jobsCount: vi.fn(),
    jobs: vi.fn(),
    trigger: vi.fn(),
    clearJobsCache: vi.fn(),
  },
}));

function wrapper({ children }: { children: ReactNode }) {
  return <NotificationProvider>{children}</NotificationProvider>;
}

const scraperList = {
  scrapers: [
    {
      name: "Adzuna",
      status: "idle" as const,
      running: false,
      lastRunAt: "2026-01-01T10:00:00.000Z",
      jobsCollected: null,
    },
    {
      name: "Lever",
      status: "down" as const,
      running: false,
      lastRunAt: null,
      jobsCollected: 2,
    },
  ],
};
const jobsPayload = {
  total: 2,
  jobs: [
    {
      id: "job1",
      title: "Frontend",
      company: "Cand",
      location: "Remoto",
      url: "https://example.com/1",
      source: "Lever",
      sources: ["Lever, Green House"],
      keyword: "",
      keywords: ["react"],
      postedAt: "2026-01-02T10:00:00.000Z",
    },
    {
      id: "job2",
      title: "Backend",
      company: "Cand",
      location: "BR",
      url: "https://example.com/2",
      source: "Adzuna",
      sources: [],
      keyword: "node",
      keywords: [],
      postedAt: "2026-01-01T10:00:00.000Z",
    },
  ],
};

describe("useScrapers", () => {
  beforeEach(() => {
    vi.mocked(scrapersApi.list).mockResolvedValue(scraperList);
    vi.mocked(scrapersApi.jobsCount).mockResolvedValue({ total: 2 });
    vi.mocked(scrapersApi.jobs).mockResolvedValue(jobsPayload);
    vi.mocked(scrapersApi.trigger).mockResolvedValue({
      ok: true,
      message: "Execução iniciada",
    });
    vi.mocked(scrapersApi.clearJobsCache).mockResolvedValue({
      ok: true,
      deleted: 4,
      patterns: ["scraper:job:*", "scraper:jobs:*"],
    });
  });

  it("loads scrapers, jobs and derived adapter overview", async () => {
    const { result } = renderHook(() => useScrapers(), { wrapper });

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    await waitFor(() => expect(result.current.overview.loadedJobs).toBe(2));

    expect(result.current.scrapers[0]).toMatchObject({
      id: "Adzuna",
      indexedJobs: 2,
      status: "Ocioso",
    });
    expect(result.current.adapterStats[0].jobs).toBeGreaterThan(0);
    expect(result.current.jobPreviews[0].title).toBe("Frontend");

    act(() => result.current.toggleScraper("Adzuna"));
    expect(result.current.logs[0].text).toContain("ainda nao esta disponivel");

    act(() => result.current.pauseAll());
    expect(result.current.logs[0].text).toContain("Pausar scrapers");

    act(() => result.current.clearLogs());
    expect(result.current.logs).toEqual([]);
  });

  it("starts all scrapers and refreshes data", async () => {
    const { result } = renderHook(() => useScrapers(), { wrapper });
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    await act(async () => {
      await result.current.startAll();
    });

    expect(scrapersApi.trigger).toHaveBeenCalledTimes(1);
    expect(result.current.logs[0].text).toBe("Execução iniciada");
  });

  it("clears jobs cache and refreshes data", async () => {
    const { result } = renderHook(() => useScrapers(), { wrapper });
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    await act(async () => {
      await result.current.clearJobsCache();
    });

    expect(scrapersApi.clearJobsCache).toHaveBeenCalledTimes(1);
    expect(result.current.logs[0].text).toContain("Cache de vagas limpo");
  });

  it("handles list and trigger failures", async () => {
    vi.mocked(scrapersApi.list).mockRejectedValueOnce(new Error("fail"));

    const { result } = renderHook(() => useScrapers(), { wrapper });
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.error).toBe("Nao foi possivel carregar os dados dos scrapers.");

    vi.mocked(scrapersApi.trigger).mockRejectedValueOnce(new Error("fail"));
    await act(async () => {
      await result.current.startAll();
    });

    expect(result.current.error).toBe("Nao foi possivel iniciar os scrapers.");
  });

  it("handles already running scraper trigger as warning", async () => {
    const { result } = renderHook(() => useScrapers(), { wrapper });
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    vi.mocked(scrapersApi.trigger).mockRejectedValueOnce(
      new ApiError(409, { ok: false, message: "scraper já está em execução" }),
    );

    await act(async () => {
      await result.current.startAll();
    });

    expect(result.current.error).toBeNull();
    expect(result.current.logs[0].text).toContain("Scraper ja esta em execucao");
  });

  it("handles cache clearing failures", async () => {
    const { result } = renderHook(() => useScrapers(), { wrapper });
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    vi.mocked(scrapersApi.clearJobsCache).mockRejectedValueOnce(new Error("fail"));

    await act(async () => {
      await result.current.clearJobsCache();
    });

    expect(result.current.error).toBe("Nao foi possivel limpar o cache de vagas.");
  });

  it("logs running state changes and job loading failures", async () => {
    vi.mocked(scrapersApi.jobs).mockRejectedValueOnce(new Error("jobs fail"));
    const { result } = renderHook(() => useScrapers(), { wrapper });
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    await waitFor(() =>
      expect(result.current.logs[0]?.text).toContain("lista detalhada"),
    );

    vi.mocked(scrapersApi.list).mockResolvedValueOnce({
      scrapers: [{ ...scraperList.scrapers[0], running: true, status: "running" }],
    });
    await act(async () => {
      await result.current.refresh();
    });

    expect(result.current.logs.map((log) => log.text)).toContain(
      "Scheduler reportou execução em andamento.",
    );
  });
});
