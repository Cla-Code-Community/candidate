import { fireEvent, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useAuth } from "../../../src/modules/auth/hooks/useAuth";
import { useScrapers } from "../../../src/modules/scrapers/hooks/useScrapers";
import { ScrapersPage } from "../../../src/modules/scrapers/ScrapersPage";
import { OperationalSnapshotSchema } from "../../../src/modules/observability/schemas/operationalSnapshot.schema";
import { operationalFixture } from "../../fixtures/operationalSnapshot";
import { renderWithProviders } from "../../test-utils";
import { buildCatalogInventory } from "../../../src/modules/scrapers/services/catalogInventory";
import { ScraperJobsCountResponseSchema } from "../../../src/lib/api/types";

vi.mock("../../../src/modules/scrapers/hooks/useScrapers", () => ({
  useScrapers: vi.fn(),
}));

vi.mock("../../../src/modules/auth/hooks/useAuth", () => ({
  useAuth: vi.fn(),
}));

const scraperState = {
  scrapers: [
    {
      id: "lever",
      name: "Lever",
      status: "Ocioso",
      lastRun: "Hoje",
      catalogJobs: 1500,
      active: false,
      availability: "Operacional",
    },
  ],
  adapterStats: [
    {
      name: "Lever",
      jobs: 4,
      sources: 2,
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
    catalogJobs: 12345,
    loadedJobs: 8,
    adaptersCount: 1,
    sourcesCount: 2,
    configuredSourcesCount: null,
    keywordsCount: 3,
    runningCount: 0,
    totalScrapers: 1,
    lastUpdatedAt: "2026-01-01T10:10:00.000Z",
  },
  logs: [{ time: "10:00:00", text: "Scheduler ocioso." }],
  isLoading: false,
  isRefreshing: false,
  isStarting: false,
  startingScraperId: null,
  isClearingJobsCache: false,
  error: null,
  refresh: vi.fn(),
  toggleScraper: vi.fn(),
  clearJobsCache: vi.fn(),
  clearLogs: vi.fn(),
  refreshIntervalMs: 15_000,
};

describe("ScrapersPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useScrapers).mockReturnValue({ ...scraperState });
    vi.mocked(useAuth).mockReturnValue({
      isLoggedIn: {
        id: "admin-1",
        name: "Super Admin",
        email: "admin@example.com",
        username: "admin",
        displayName: "Super Admin",
        role: "super_admin",
        avatar: "",
        permissions: {},
      },
      loading: false,
      isLoading: false,
      errorMessage: "",
      login: vi.fn(),
      logout: vi.fn(),
      hasPermission: vi.fn(),
    });
  });

  it("uses global inventory even when the preview is unavailable", () => {
    vi.mocked(useScrapers).mockReturnValue({ ...scraperState, sampleUnavailable:true, adapterStats:[], jobPreviews:[], catalogInventory:[{id:"themuse",name:"The Muse",provider:"themuse",configured:true,catalogJobs:0,observed:false},{id:"linkedin",name:"LinkedIn",provider:"linkedin",configured:false,catalogJobs:9000,observed:true}], inventoryAvailable:true, configurationAvailable:true });
    renderWithProviders(<ScrapersPage />);
    expect(screen.getByText("The Muse")).toBeInTheDocument();
    expect(screen.getByText("9.000")).toBeInTheDocument();
    expect(screen.getAllByText("Configurado: Sim").length).toBeGreaterThan(0);
    expect(screen.getByText("Amostra indisponível; quantidade de vagas N/D.")).toBeInTheDocument();
  });
  it.each([true, false])("renders every configured provider from the global contract, with preview available: %s", (previewAvailable) => {
    const count = ScraperJobsCountResponseSchema.parse({
      total: 501,
      configuredProviders: ["adzuna", "greenhouse", "gupy", "inhire", "jooble", "lever", "linkedin", "themuse"],
      sources: [
        { source: "Green House", provider: "greenhouse", total: 300 },
        { source: "LinkedIn", provider: "linkedin", total: 200 },
        { source: null, provider: "unknown", total: 1 },
      ],
    });
    const inventory = buildCatalogInventory(count);
    vi.mocked(useScrapers).mockReturnValue({
      ...scraperState,
      overview: { ...scraperState.overview, catalogJobs: count.total, loadedJobs: previewAvailable ? 200 : 0 },
      catalogInventory: inventory,
      inventoryAvailable: true,
      configurationAvailable: true,
      jobPreviews: previewAvailable ? scraperState.jobPreviews : [],
      sampleUnavailable: !previewAvailable,
    });
    renderWithProviders(<ScrapersPage />);

    expect(screen.getAllByRole("article")).toHaveLength(9);
    for (const row of inventory) {
      const card = within(screen.getByRole("article", { name: `Fonte: ${row.name}` }));
      expect(card.getByText(String(row.catalogJobs))).toBeInTheDocument();
      expect(card.getByText("Vagas no catálogo")).toBeInTheDocument();
      expect(card.getByText(`Configurado: ${row.configured === null ? "N/D" : "Sim"}`)).toBeInTheDocument();
    }
    const renderedTotal = screen.getAllByRole("article").reduce((total, card) => {
      const label = within(card).getByText("Vagas no catálogo");
      return total + Number(label.previousElementSibling?.textContent);
    }, 0);
    expect(renderedTotal).toBe(count.total);
    expect(within(screen.getByRole("article", { name: "Fonte: The Muse" })).getByText("0")).toBeInTheDocument();
    expect(within(screen.getByRole("article", { name: "Fonte: Sem fonte principal" })).getByText("1")).toBeInTheDocument();
  });

  it("renders an unavailable count as N/D even for a configured provider", () => {
    vi.mocked(useScrapers).mockReturnValue({
      ...scraperState,
      catalogInventory: buildCatalogInventory({ total: 501, sources: null, configuredProviders: ["themuse"] }),
      inventoryAvailable: false,
      configurationAvailable: true,
    });
    renderWithProviders(<ScrapersPage />);
    const card = within(screen.getByRole("article", { name: "Fonte: The Muse" }));
    expect(card.getByText("N/D")).toBeInTheDocument();
    expect(card.queryByText("0")).not.toBeInTheDocument();
    expect(card.getByText("Configurado: Sim")).toBeInTheDocument();
  });

  it("renders one readable catalog card for equivalent provenance combinations", () => {
    const catalogInventory = buildCatalogInventory({ total: 42, configuredProviders: ["adzuna", "gupy"], sources: [
      { source: "Adzuna, Gupy", provider: "unknown", total: 17 },
      { source: "Gupy, Adzuna, Gupy", provider: "unknown", total: 23 },
      { source: "Adzuna", provider: "adzuna", total: 2 },
    ] });
    vi.mocked(useScrapers).mockReturnValue({ ...scraperState, catalogInventory, inventoryAvailable: true, configurationAvailable: true });
    renderWithProviders(<ScrapersPage />);
    const card = screen.getByRole("article", { name: "Fonte: Adzuna + Gupy" });
    expect(within(card).getByText("40")).toBeInTheDocument();
    expect(within(card).getByTitle("Adzuna + Gupy")).toBeInTheDocument();
    expect(within(card).getByText("Observado no catálogo: Sim")).toBeInTheDocument();
    expect(screen.getAllByRole("article")).toHaveLength(3);
    expect(within(screen.getByRole("article", { name: "Fonte: Gupy" })).getByText("0")).toBeInTheDocument();
  });
  it("shows unknown counts instead of replacing them with sample counts",()=>{
    vi.mocked(useScrapers).mockReturnValue({...scraperState,catalogInventory:[{id:"lever",name:"Lever",provider:"lever",configured:true,catalogJobs:null,observed:null}],inventoryAvailable:false,configurationAvailable:true});
    renderWithProviders(<ScrapersPage/>);
    expect(screen.getByText("Observado no catálogo: N/D")).toBeInTheDocument();
    expect(screen.getByText("Distribuição global N/D; não inferida da prévia.")).toBeInTheDocument();
  });

  it("keeps catalog counts prominent while operational details start collapsed", () => {
    const p = operationalFixture.processor!;
    const snapshot = OperationalSnapshotSchema.parse({ ...operationalFixture, processor: { ...p, providers: [{ id: "gupy", configuredConcurrency: 1, active: 0, waiting: 0, tasksTotal: 9, tasksCompleted: 8, tasksFailed: 1, tasksCanceled: 0, jobsCollected: 321, lastTaskStatus: "failed", lastTaskFinishedAt: null, lastTaskDurationSeconds: 0, lastErrorType: "network" }] } });
    vi.mocked(useScrapers).mockReturnValue({ ...scraperState, catalogInventory: buildCatalogInventory({ total: 72, configuredProviders: ["gupy"], sources: [{ source: "Gupy", provider: "gupy", total: 72 }] }), inventoryAvailable: true, configurationAvailable: true, canReadOperational: true, operational: { snapshot, stale: false, loading: false, forbidden: false, error: null, refresh: vi.fn() } });
    renderWithProviders(<ScrapersPage />);
    const card = within(screen.getByRole("article", { name: "Fonte: Gupy" }));
    expect(card.getByText("Gupy")).toBeVisible();
    expect(card.getByText("72")).toBeVisible();
    expect(card.getByText("Vagas no catálogo")).toBeVisible();
    const configured = card.getByText("Configurado: Sim");
    const observed = card.getByText("Observado no catálogo: Sim");
    const status = card.getByText("Última tarefa: failed");
    const run = card.getByText("Run: 8/9 tarefas encerradas • 321 vagas coletadas");
    for (const detail of [configured, observed, status, run]) expect(detail).not.toBeVisible();
    fireEvent.click(card.getByText("Detalhes"));
    for (const detail of [configured, observed, status, run]) expect(detail).toBeVisible();
    expect(card.getByText("72")).toBeVisible();
    fireEvent.click(card.getByText("Detalhes"));
    expect(run).not.toBeVisible();
  });

  it("shows real providers separately from observed sample sources", () => {
    const p = operationalFixture.processor!;
    const snapshot = OperationalSnapshotSchema.parse({ ...operationalFixture, processor: { ...p, execution: { ...p.execution, runId: "provider-run" }, providers: [{ id: "gupy", configuredConcurrency: 2, active: 0, waiting: 1, tasksTotal: 3, tasksCompleted: 2, tasksFailed: 1, tasksCanceled: 0, jobsCollected: 0, lastTaskStatus: "failed", lastTaskFinishedAt: null, lastTaskDurationSeconds: 0, lastErrorType: "network" }] } });
    vi.mocked(useScrapers).mockReturnValue({ ...scraperState, canReadOperational: true, operational: { snapshot, stale: false, loading: false, forbidden: false, error: null, refresh: vi.fn() } });
    renderWithProviders(<ScrapersPage />);
    expect(screen.getByText("Providers desta execução")).toBeInTheDocument();
    expect(screen.getByText(/Run ID: provider-run/)).toBeInTheDocument();
    const table = screen.getByRole("table", { name: "Providers desta execução" });
    const row = within(table).getByRole("row", { name: /gupy/ });
    const cells = within(row).getAllByRole("cell");
    expect(cells[0]).toHaveTextContent("2 / 3");
    expect(within(cells[1]).getByText("0")).toBeInTheDocument();
    expect(within(cells[2]).getByText("1")).toBeInTheDocument();
    expect(cells[3]).toHaveTextContent("0 / 1");
    expect(cells[4]).toHaveTextContent("failed");
    fireEvent.click(within(row).getByText("Detalhes"));
    expect(within(row).getByText("network")).toBeVisible();
    expect(within(row).getByText("0s")).toBeVisible();
    expect(within(row).getAllByText("N/D")).toHaveLength(1);
    expect(table.compareDocumentPosition(screen.getByText("Fontes e providers do catálogo")) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it("keeps every run provider and distinguishes zero from unavailable task details", () => {
    const provider = { configuredConcurrency: 1, active: 0, waiting: 0, tasksTotal: 0, tasksCompleted: 0, tasksFailed: 0, tasksCanceled: 0, jobsCollected: 0, lastTaskStatus: null, lastTaskFinishedAt: null, lastTaskDurationSeconds: null, lastErrorType: null };
    const snapshot = OperationalSnapshotSchema.parse({ ...operationalFixture, processor: { ...operationalFixture.processor!, providers: [{ ...provider, id: "gupy" }, { ...provider, id: "lever", jobsCollected: 1200, tasksTotal: 2, tasksCompleted: 2, lastTaskStatus: "success" }] } });
    vi.mocked(useScrapers).mockReturnValue({ ...scraperState, canReadOperational: true, operational: { snapshot, stale: false, loading: false, forbidden: false, error: null, refresh: vi.fn() } });
    renderWithProviders(<ScrapersPage />);
    const table = within(screen.getByRole("table", { name: "Providers desta execução" }));
    expect(table.getAllByRole("row")).toHaveLength(3);
    const gupy = within(table.getByRole("row", { name: /gupy/ }));
    expect(within(gupy.getAllByRole("cell")[1]).getByText("0")).toBeInTheDocument();
    expect(gupy.getAllByText("N/D")).toHaveLength(4);
    expect(within(table.getByRole("row", { name: /lever/ })).getByText("1.200")).toBeInTheDocument();
  });

  it.each([null, []])("distinguishes unavailable and empty provider plan: %j", (providers) => {
    const snapshot = OperationalSnapshotSchema.parse({ ...operationalFixture, processor: { ...operationalFixture.processor!, providers } });
    vi.mocked(useScrapers).mockReturnValue({ ...scraperState, canReadOperational: true, operational: { snapshot, stale: false, loading: false, forbidden: false, error: null, refresh: vi.fn() } });
    renderWithProviders(<ScrapersPage />);
    expect(screen.getByText(providers === null ? "Providers da execução: N/D." : "Plano conhecido sem providers.")).toBeInTheDocument();
  });

  it("renders scraper overview and delegates actions", () => {
    renderWithProviders(<ScrapersPage />);

    expect(screen.getByText("Operação do processamento de vagas")).toBeInTheDocument();
    expect(screen.getByText("Fontes e providers do catálogo")).toBeInTheDocument();
    expect(screen.getAllByText("Frontend Engineer")).toHaveLength(1);

    fireEvent.click(screen.getByRole("button", { name: "Recarregar dados" }));
    fireEvent.click(screen.getByRole("button", { name: /limpar cache de buscas/i }));
    fireEvent.click(screen.getByRole("button", { name: "Run" }));
    fireEvent.click(screen.getByRole("button", { name: /limpar logs/i }));

    expect(scraperState.refresh).toHaveBeenCalledTimes(1);
    expect(scraperState.clearJobsCache).toHaveBeenCalledTimes(1);
    expect(scraperState.toggleScraper).toHaveBeenCalledWith("lever");
    expect(scraperState.clearLogs).toHaveBeenCalledTimes(1);
  });

  it("shows cache reset action disabled for non super admins", () => {
    vi.mocked(useAuth).mockReturnValue({
      isLoggedIn: {
        id: "admin-1",
        name: "Admin",
        email: "admin@example.com",
        username: "admin",
        displayName: "Admin",
        role: "admin",
        avatar: "",
        permissions: {},
      },
      loading: false,
      isLoading: false,
      errorMessage: "",
      login: vi.fn(),
      logout: vi.fn(),
      hasPermission: vi.fn(),
    });

    renderWithProviders(<ScrapersPage />);

    const clearCacheButton = screen.getByRole("button", {
      name: /limpar cache de buscas/i,
    });

    expect(clearCacheButton).toBeDisabled();
    expect(clearCacheButton).toHaveAttribute(
      "title",
      "Disponível apenas para super admin",
    );
    fireEvent.click(clearCacheButton);
    expect(scraperState.clearJobsCache).not.toHaveBeenCalled();
  });

  it("renders loading and error states", () => {
    vi.mocked(useScrapers).mockReturnValue({
      ...scraperState,
      isLoading: true,
      error: "falha",
    });

    renderWithProviders(<ScrapersPage />);

    expect(screen.getByText("Carregando processamento de vagas...")).toBeInTheDocument();
    expect(screen.getByText("falha")).toBeInTheDocument();
  });

  it("renders empty adapters and jobs with no snapshot timestamp", () => {
    vi.mocked(useScrapers).mockReturnValue({
      ...scraperState,
      adapterStats: [],
      jobPreviews: [],
      overview: {
        ...scraperState.overview,
        lastUpdatedAt: null,
        adaptersCount: 0,
        sourcesCount: 0,
        loadedJobs: 0,
      },
    });

    renderWithProviders(<ScrapersPage />);

    expect(screen.getByText(/última leitura do scheduler Sem atualização/)).toBeInTheDocument();
    expect(
      screen.getByText("Inventário global N/D."),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Nenhuma vaga carregada do backend ainda."),
    ).toBeInTheDocument();
  });

  it("disables cache and refresh actions while each request is pending", () => {
    vi.mocked(useScrapers).mockReturnValue({
      ...scraperState,
      isRefreshing: true,
      isClearingJobsCache: true,
    });

    renderWithProviders(<ScrapersPage />);

    expect(
      screen.getByRole("button", { name: /limpando cache/i }),
    ).toBeDisabled();
    expect(
      screen.getByRole("button", { name: "Recarregar dados" }),
    ).toBeDisabled();
  });
});
