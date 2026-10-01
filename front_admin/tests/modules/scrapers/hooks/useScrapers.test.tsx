import { act, renderHook, screen, waitFor } from "@testing-library/react";
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
    triggerOne: vi.fn(),
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
    vi.clearAllMocks();
    vi.mocked(scrapersApi.list).mockResolvedValue(scraperList);
    vi.mocked(scrapersApi.jobsCount).mockResolvedValue({ total: 2 });
    vi.mocked(scrapersApi.jobs).mockResolvedValue(jobsPayload);
    vi.mocked(scrapersApi.trigger).mockResolvedValue({
      ok: true,
      message: "Execução iniciada",
    });
    vi.mocked(scrapersApi.triggerOne).mockResolvedValue({
      ok: true,
      message: "Execução individual iniciada",
      scraper: "Adzuna",
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

    await act(async () => {
      await result.current.toggleScraper("Adzuna");
    });
    expect(scrapersApi.triggerOne).toHaveBeenCalledWith("Adzuna");
    expect(result.current.logs[0].text).toBe("Execução individual iniciada");

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

  it("handles individual scraper trigger failures", async () => {
    const { result } = renderHook(() => useScrapers(), { wrapper });
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    vi.mocked(scrapersApi.triggerOne).mockRejectedValueOnce(new Error("fail"));
    await act(async () => {
      await result.current.toggleScraper("Adzuna");
    });

    expect(result.current.error).toBe("Nao foi possivel iniciar Adzuna.");
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

  it("does not trigger an active scraper and reports its running state", async () => {
    vi.mocked(scrapersApi.list).mockResolvedValueOnce({
      scrapers: [{ ...scraperList.scrapers[0], running: true, status: "running" }],
    });
    const { result } = renderHook(() => useScrapers(), { wrapper });
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    await act(async () => {
      await result.current.toggleScraper("Adzuna");
    });

    expect(scrapersApi.triggerOne).not.toHaveBeenCalled();
    expect(result.current.logs[0].text).toBe("Adzuna ja esta em execucao.");
    expect(await screen.findByText("Scraper já em execução")).toBeInTheDocument();
  });

  it("treats an individual 409 as recoverable and clears the starting state", async () => {
    const { result } = renderHook(() => useScrapers(), { wrapper });
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    vi.mocked(scrapersApi.triggerOne).mockRejectedValueOnce(
      new ApiError(409, { message: "already running" }),
    );

    await act(async () => {
      await result.current.toggleScraper("Adzuna");
    });

    expect(result.current.error).toBeNull();
    expect(result.current.isStarting).toBe(false);
    expect(result.current.logs[0].text).toBe("Adzuna ja esta em execucao.");
    expect(scrapersApi.list).toHaveBeenCalledTimes(2);
  });

  it("uses fallback labels for invalid run dates, empty sources and keywords", async () => {
    vi.mocked(scrapersApi.list).mockResolvedValueOnce({
      scrapers: [
        {
          name: "Custom",
          status: "idle",
          running: false,
          lastRunAt: "invalid date",
          jobsCollected: null,
        },
      ],
    });
    vi.mocked(scrapersApi.jobs).mockResolvedValueOnce({
      total: 2,
      jobs: [
        {
          ...jobsPayload.jobs[0],
          id: "job-unknown",
          source: "",
          sources: [",", "  "],
          keyword: "",
          keywords: [],
          postedAt: "invalid date",
        },
        {
          ...jobsPayload.jobs[1],
          id: "job-custom",
          source: "Custom adapter",
          sources: [],
          keyword: "",
          keywords: ["python"],
          postedAt: "",
        },
      ],
    });

    const { result } = renderHook(() => useScrapers(), { wrapper });
    await waitFor(() => expect(result.current.overview.loadedJobs).toBe(2));

    expect(result.current.scrapers[0].lastRun).toBe("invalid date");
    expect(result.current.adapterStats.map((adapter) => adapter.name)).toContain(
      "desconhecido",
    );
    expect(result.current.adapterStats.map((adapter) => adapter.name)).toContain(
      "Custom adapter",
    );
    expect(result.current.jobPreviews.map((job) => job.keyword)).toContain(
      "sem keyword",
    );
    expect(result.current.jobPreviews.map((job) => job.keyword)).toContain(
      "python",
    );
  });

  it("maps remaining adapter families and supplies fallback action messages", async () => {
    vi.mocked(scrapersApi.jobs).mockResolvedValueOnce({
      total: 4,
      jobs: ["The Muse", "Jooble", "linkedin", "Unknown"].map(
        (source, index) => ({
          ...jobsPayload.jobs[0],
          id: `family-${index}`,
          source,
          sources: [],
          keyword: "keyword",
          keywords: [],
        }),
      ),
    });
    vi.mocked(scrapersApi.trigger).mockResolvedValueOnce({
      ok: true,
      message: "",
    });
    vi.mocked(scrapersApi.triggerOne).mockResolvedValueOnce({
      ok: true,
      message: "",
      scraper: "Adzuna",
    });

    const { result } = renderHook(() => useScrapers(), { wrapper });
    await waitFor(() => expect(result.current.overview.loadedJobs).toBe(4));

    expect(result.current.adapterStats.map((adapter) => adapter.name)).toEqual(
      ["The Muse", "Jooble", "linkedin", "Unknown"],
    );
    await act(async () => {
      await result.current.startAll();
      await result.current.toggleScraper("Adzuna");
    });

    expect(result.current.logs.map((entry) => entry.text)).toContain(
      "Execucao dos scrapers iniciada.",
    );
    expect(result.current.logs.map((entry) => entry.text)).toContain(
      "Adzuna iniciado.",
    );
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

  it("logs when the scheduler reports that the last running scraper became idle", async () => {
    vi.mocked(scrapersApi.list)
      .mockResolvedValueOnce({
        scrapers: [{ ...scraperList.scrapers[0], running: true, status: "running" }],
      })
      .mockResolvedValueOnce({
        scrapers: [{ ...scraperList.scrapers[0], running: false, status: "idle" }],
      });
    const { result } = renderHook(() => useScrapers(), { wrapper });
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    await act(async () => {
      await result.current.refresh();
    });

    expect(result.current.logs.map((entry) => entry.text)).toContain(
      "Scheduler reportou scraper ocioso.",
    );
  });
});
