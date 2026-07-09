import { fireEvent, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ScrapersPage } from "../../../src/modules/scrapers/ScrapersPage";
import { useScrapers } from "../../../src/modules/scrapers/hooks/useScrapers";
import { renderWithProviders } from "../../test-utils";

vi.mock("../../../src/modules/scrapers/hooks/useScrapers", () => ({
  useScrapers: vi.fn(),
}));

const scraperState = {
  scrapers: [
    {
      id: "lever",
      name: "Lever",
      status: "Ocioso",
      lastRun: "Hoje",
      indexedJobs: 1500,
      active: false,
      sla: "Operacional",
    },
  ],
  adapterStats: [
    {
      name: "Lever",
      jobs: 4,
      sources: 2,
      configuredSources: 34,
      keywords: 3,
      sampleTitle: "Frontend Engineer",
    },
  ],
  jobPreviews: [
    {
      id: "job1",
      title: "Frontend Engineer",
      company: "Cand",
      location: "Remoto",
      source: "Lever",
      keyword: "react",
      postedAt: "2026-01-01",
      url: "https://example.com",
    },
  ],
  overview: {
    indexedJobs: 12345,
    loadedJobs: 8,
    adaptersCount: 1,
    sourcesCount: 2,
    configuredSourcesCount: 70,
    keywordsCount: 3,
    runningCount: 0,
    totalScrapers: 1,
    lastUpdatedAt: "2026-01-01T10:10:00.000Z",
  },
  logs: [{ time: "10:00:00", text: "Scheduler ocioso." }],
  isLoading: false,
  isRefreshing: false,
  isStarting: false,
  error: null,
  refresh: vi.fn(),
  toggleScraper: vi.fn(),
  startAll: vi.fn(),
  pauseAll: vi.fn(),
  clearLogs: vi.fn(),
  refreshIntervalMs: 15_000,
};

describe("ScrapersPage", () => {
  beforeEach(() => {
    vi.mocked(useScrapers).mockReturnValue({ ...scraperState });
  });

  it("renders scraper overview and delegates actions", () => {
    renderWithProviders(<ScrapersPage />);

    expect(screen.getByText("Operação dos scrapers")).toBeInTheDocument();
    expect(screen.getByText("Adapters Funcionais")).toBeInTheDocument();
    expect(screen.getAllByText("Frontend Engineer")).toHaveLength(2);

    fireEvent.click(screen.getByRole("button", { name: "Recarregar dados" }));
    fireEvent.click(screen.getByRole("button", { name: /iniciar todos/i }));
    fireEvent.click(screen.getByRole("button", { name: /pausar todos/i }));
    fireEvent.click(screen.getByRole("button", { name: /limpar logs/i }));

    expect(scraperState.refresh).toHaveBeenCalledTimes(1);
    expect(scraperState.startAll).toHaveBeenCalledTimes(1);
    expect(scraperState.pauseAll).toHaveBeenCalledTimes(1);
    expect(scraperState.clearLogs).toHaveBeenCalledTimes(1);
  });

  it("renders loading and error states", () => {
    vi.mocked(useScrapers).mockReturnValue({
      ...scraperState,
      isLoading: true,
      error: "falha",
    });

    renderWithProviders(<ScrapersPage />);

    expect(screen.getByText("Carregando scrapers...")).toBeInTheDocument();
    expect(screen.getByText("falha")).toBeInTheDocument();
  });
});
