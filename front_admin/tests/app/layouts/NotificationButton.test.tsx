import "@testing-library/jest-dom/vitest";
import { fireEvent, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { NotificationButton } from "../../../src/app/layouts/MainLayout/Header/components/NotificationButton";
import type { DashboardOverview } from "../../../src/lib/api/types";
import { renderWithProviders } from "../../test-utils";

const dashboardApiMocks = vi.hoisted(() => ({
  getOverview: vi.fn(),
}));

vi.mock("../../../src/lib/api/dashboard.api", () => ({
  dashboardApi: dashboardApiMocks,
}));

function overview(
  overrides: Partial<DashboardOverview> = {},
): DashboardOverview {
  return {
    stats: {
      totalUsers: 12,
      activeUsers: 8,
      totalCollectedJobs: 1234,
      jobsCollectedToday: 20,
    },
    services: {
      status: "ok",
      timestamp: "2026-09-30T10:20:30.000Z",
      services: {
        postgres: { status: "ok", latencyMs: 12 },
        valkey: { status: "ok", latencyMs: 4 },
        scraper: { status: "ok", latencyMs: 2 },
      },
    },
    scrapers: [],
    generatedAt: "2026-09-30T10:20:30.000Z",
    ...overrides,
  };
}

function openNotifications() {
  fireEvent.click(screen.getByRole("button", { name: "Abrir notificações" }));
}

describe("NotificationButton", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    dashboardApiMocks.getOverview.mockReset();
    dashboardApiMocks.getOverview.mockResolvedValue(overview());
  });

  it("shows a healthy summary when services and scrapers are healthy", async () => {
    renderWithProviders(<NotificationButton />);
    openNotifications();

    expect(await screen.findByText("Operação saudável")).toBeInTheDocument();
    expect(screen.getByText("1 reais")).toBeInTheDocument();
    expect(screen.getByText(/1\.234 vagas no índice/)).toBeInTheDocument();
    expect(screen.getByText(/Snapshot/)).toBeInTheDocument();
  });

  it("maps service and scraper statuses to useful notifications", async () => {
    dashboardApiMocks.getOverview.mockResolvedValueOnce(
      overview({
        generatedAt: "bad timestamp",
        services: {
          status: "degraded",
          timestamp: "2026-09-30T10:20:30.000Z",
          services: {
            postgres: { status: "down", error: "database offline" },
            valkey: { status: "degraded", latencyMs: 88 },
            scraper: { status: "ok" },
          },
        },
        scrapers: [
          {
            name: "Lever",
            status: "running",
            running: true,
            lastRunAt: null,
            jobsCollected: null,
          },
          {
            name: "Adzuna",
            status: "down",
            running: false,
            lastRunAt: null,
            jobsCollected: null,
          },
        ],
      }),
    );

    renderWithProviders(<NotificationButton />);
    openNotifications();

    expect(await screen.findByText("Postgres indisponível")).not.toBeNull();
    expect(
      screen.getAllByText("Snapshot Snapshot recente").length,
    ).toBeGreaterThan(0);
    expect(screen.getByText("database offline")).not.toBeNull();
    expect(screen.getByText("Valkey degradado")).not.toBeNull();
    expect(screen.getByText("Latência atual: 88ms.")).not.toBeNull();
    expect(screen.getByText("Lever em execução")).not.toBeNull();
    expect(screen.getByText("Adzuna indisponível")).not.toBeNull();
    expect(screen.queryByText("Scraper indisponível")).toBeNull();
  });

  it("limits notifications to five and routes a selected item to the provider", async () => {
    dashboardApiMocks.getOverview.mockResolvedValueOnce(
      overview({
        generatedAt: "bad timestamp",
        services: {
          status: "down",
          timestamp: "bad timestamp",
          services: {
            postgres: { status: "down" },
            valkey: { status: "down" },
            scraper: { status: "down" },
          },
        },
        scrapers: [
          {
            name: "One",
            status: "down",
            running: false,
            lastRunAt: null,
            jobsCollected: null,
          },
          {
            name: "Two",
            status: "down",
            running: false,
            lastRunAt: null,
            jobsCollected: null,
          },
          {
            name: "Three",
            status: "down",
            running: false,
            lastRunAt: null,
            jobsCollected: null,
          },
        ],
      }),
    );

    renderWithProviders(<NotificationButton />);
    openNotifications();

    const firstNotification = await screen.findByRole("button", {
      name: /Postgres indisponível/,
    });
    expect(screen.getAllByText("Snapshot Snapshot recente")).toHaveLength(5);
    expect(screen.getAllByRole("button").filter((button) =>
      button.textContent?.includes("indisponível"),
    )).toHaveLength(5);

    fireEvent.click(firstNotification);
    expect(screen.getByRole("status")).toHaveTextContent("Postgres indisponível");

    fireEvent.pointerDown(screen.getByRole("button", { name: "Abrir notificações" }));
    expect(screen.getByText("Notificações")).toBeInTheDocument();

    fireEvent.pointerDown(document.body);
    await waitFor(() => {
      expect(screen.queryByText("Notificações")).not.toBeInTheDocument();
    });
  });

  it("shows loading while the request is pending and a fallback after failure", async () => {
    let resolveOverview!: (result: DashboardOverview) => void;
    dashboardApiMocks.getOverview.mockReturnValueOnce(
      new Promise<DashboardOverview>((resolve) => {
        resolveOverview = resolve;
      }),
    );

    const view = renderWithProviders(<NotificationButton />);
    openNotifications();
    expect(await screen.findByText("Carregando")).toBeInTheDocument();
    resolveOverview(overview());
    expect(await screen.findByText("Operação saudável")).toBeInTheDocument();

    dashboardApiMocks.getOverview.mockRejectedValueOnce(new Error("offline"));
    fireEvent.click(screen.getByRole("button", { name: "Abrir notificações" }));
    fireEvent.click(screen.getByRole("button", { name: "Abrir notificações" }));
    expect(await screen.findByText("Dashboard indisponível")).toBeInTheDocument();
    expect(
      screen.getByText("Não foi possível carregar notificações reais agora."),
    ).toBeInTheDocument();
    view.unmount();
  });
});
