import { fireEvent, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { DashboardPage } from "../../../src/modules/dashboard/DashboardPage";
import { useDashboard } from "../../../src/modules/dashboard/hooks/useDashboard";
import { renderWithProviders } from "../../test-utils";

vi.mock("../../../src/modules/dashboard/hooks/useDashboard", () => ({
  useDashboard: vi.fn(),
}));

const dashboardState = {
  stats: {
    totalUsers: { value: 1200, trend: "Postgres", positive: true },
    activeUsers: { value: 900, trend: "contas ativas", positive: true },
    totalJobs: { value: 12345, trend: "índice Valkey", positive: true },
    jobsToday: { value: 99, trend: "coletadas hoje", positive: false },
  },
  resources: { scraper: 99, postgres: 65, valkey: 0 },
  services: [
    { name: "Postgres", status: "Online", sla: "10ms", health: 99, tone: "success" as const },
    { name: "Valkey", status: "Instavel", sla: "slow", health: 65, tone: "warning" as const },
  ],
  scrapers: [
    {
      id: "adzuna",
      name: "Adzuna",
      status: "Online",
      lastRun: "Hoje",
      collected24h: 1540,
      active: true,
    },
  ],
  chartPoints: [
    {
      timestamp: "2026-01-01T10:00:00.000Z",
      label: "10:00",
      totalJobs: 100,
      activeUsers: 50,
    },
    {
      timestamp: "2026-01-01T10:10:00.000Z",
      label: "10:10",
      totalJobs: 150,
      activeUsers: 55,
    },
  ],
  lastUpdatedAt: "2026-01-01T10:10:00.000Z",
  isLoading: false,
  isRefreshing: false,
  error: null,
  refresh: vi.fn(),
  refreshIntervalMs: 10_000,
  toggleScraper: vi.fn(),
};

describe("DashboardPage", () => {
  beforeEach(() => {
    vi.mocked(useDashboard).mockReturnValue({ ...dashboardState });
  });

  it("renders dashboard data and interactions", () => {
    renderWithProviders(<DashboardPage />);

    expect(screen.getByText("Monitoramento em tempo real")).toBeInTheDocument();
    expect(screen.getByText("Total de Usuários")).toBeInTheDocument();
    expect(screen.getByText("Visão Geral da Plataforma")).toBeInTheDocument();
    expect(screen.getByText("Status dos Serviços")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Atualizar" }));
    expect(dashboardState.refresh).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByTitle("Pausar Scraper"));
    expect(dashboardState.toggleScraper).toHaveBeenCalledWith("adzuna");
  });

  it("renders loading and fallback states", () => {
    vi.mocked(useDashboard).mockReturnValueOnce({
      ...dashboardState,
      isLoading: true,
    });
    const { rerender } = renderWithProviders(<DashboardPage />);

    expect(screen.getByText("Carregando dashboard...")).toBeInTheDocument();

    vi.mocked(useDashboard).mockReturnValueOnce({
      ...dashboardState,
      isLoading: false,
      stats: null,
      resources: null,
      error: "backend offline",
    });
    rerender(<DashboardPage />);

    expect(
      screen.getByText("Nao foi possivel carregar o dashboard."),
    ).toBeInTheDocument();
    expect(screen.getByText("backend offline")).toBeInTheDocument();
  });
});
