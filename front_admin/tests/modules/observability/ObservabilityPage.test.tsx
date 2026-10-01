import { fireEvent, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { observabilityApi } from "../../../src/lib/api/observability.api";
import { ObservabilityPage } from "../../../src/modules/observability/ObservabilityPage";
import { renderWithProviders } from "../../test-utils";

vi.mock("../../../src/lib/api/observability.api", () => ({
  observabilityApi: {
    health: vi.fn(),
    metrics: vi.fn(),
    dashboards: vi.fn(),
  },
}));

const dashboardsPayload = {
  range: "15m",
  step: "1m",
  generatedAt: "2026-01-01T10:00:00.000Z",
  dashboards: [
    {
      id: "api",
      title: "API Overview",
      description: "Tráfego",
      panels: [
        {
          id: "requests",
          title: "Requests/sec",
          description: "Taxa",
          unit: "count" as const,
          visualization: "line" as const,
          series: [
            {
              label: "GET",
              points: [
                { timestamp: "2026-01-01T10:00:00.000Z", value: 1 },
                { timestamp: "2026-01-01T10:01:00.000Z", value: 3 },
              ],
            },
          ],
        },
        {
          id: "cache",
          title: "Cache hit rate",
          unit: "percent" as const,
          visualization: "stat" as const,
          series: [
            {
              label: "hit",
              points: [{ timestamp: "2026-01-01T10:01:00.000Z", value: 92 }],
            },
          ],
        },
      ],
    },
    {
      id: "infra",
      title: "Infraestrutura",
      description: "Host",
      panels: [],
    },
  ],
};

describe("ObservabilityPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(observabilityApi.health).mockResolvedValue({
      status: "ok",
      timestamp: "2026-01-01T10:00:00.000Z",
      services: {
        postgres: { status: "ok", latencyMs: 10 },
        valkey: { status: "degraded", error: "slow" },
        scraper: { status: "down" },
      },
    });
    vi.mocked(observabilityApi.metrics).mockResolvedValue({
      requestRatePerMinute: 12,
      errorRatePct: 0.2,
      p95LatencyMs: 99,
      cacheHitRatePct: 95,
      activeSessionsCount: 2,
    });
    vi.mocked(observabilityApi.dashboards).mockResolvedValue(dashboardsPayload);
  });

  it("loads summaries, infra usage and dashboards", async () => {
    renderWithProviders(<ObservabilityPage />);

    expect(screen.getByText("Carregando metricas...")).toBeInTheDocument();
    await screen.findByText("Requisicoes por minuto");
    await screen.findByText("Requests/sec");

    expect(screen.getByText("Latencia p95")).toBeInTheDocument();
    expect(screen.getByText("postgres")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Infraestrutura" }));
    expect(screen.getByText("Host")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "1 h" }));
    await waitFor(() =>
      expect(observabilityApi.dashboards).toHaveBeenCalledWith("1h"),
    );
  });

  it("shows errors and dashboard shells when APIs fail", async () => {
    vi.mocked(observabilityApi.health).mockRejectedValueOnce(new Error("fail"));
    vi.mocked(observabilityApi.metrics).mockRejectedValueOnce(new Error("fail"));
    vi.mocked(observabilityApi.dashboards).mockRejectedValueOnce(new Error("fail"));

    renderWithProviders(<ObservabilityPage />);

    expect(
      await screen.findByText("Nao foi possivel carregar a observabilidade."),
    ).toBeInTheDocument();
    expect(
      await screen.findByText(/Sem resposta das series detalhadas/),
    ).toBeInTheDocument();
  });

  it("shows unavailable metrics, degraded infrastructure, and empty dashboards", async () => {
    vi.mocked(observabilityApi.health).mockResolvedValueOnce({
      status: "down",
      timestamp: "2026-01-01T10:00:00.000Z",
      services: {
        postgres: { status: "down", error: "connection refused" },
        valkey: { status: "degraded" },
        scraper: { status: "ok", latencyMs: 4 },
      },
    });
    vi.mocked(observabilityApi.metrics).mockResolvedValueOnce({
      requestRatePerMinute: null,
      errorRatePct: null,
      p95LatencyMs: null,
      cacheHitRatePct: null,
      activeSessionsCount: null,
    });
    vi.mocked(observabilityApi.dashboards).mockResolvedValueOnce({
      ...dashboardsPayload,
      dashboards: [],
    });

    renderWithProviders(<ObservabilityPage />);

    expect(await screen.findAllByText("N/D")).toHaveLength(3);
    expect(screen.getByText("connection refused")).toBeInTheDocument();
    expect(screen.getByText("degraded")).toBeInTheDocument();
    expect(screen.queryByText("Requests/sec")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Atualizar" }));
    await waitFor(() => {
      expect(observabilityApi.health).toHaveBeenCalledTimes(2);
      expect(observabilityApi.metrics).toHaveBeenCalledTimes(2);
      expect(observabilityApi.dashboards).toHaveBeenCalledTimes(2);
    });
  });

  it("marks latency and error metrics above their attention limits", async () => {
    vi.mocked(observabilityApi.metrics).mockResolvedValueOnce({
      requestRatePerMinute: 0,
      errorRatePct: 5,
      p95LatencyMs: 200,
      cacheHitRatePct: 0,
      activeSessionsCount: 0,
    });

    renderWithProviders(<ObservabilityPage />);

    await screen.findByText("Requisicoes por minuto");
    const latencyCard = screen.getByText("Latencia p95").parentElement;
    const errorCard = screen.getByText("Taxa de erro").parentElement;
    expect(latencyCard).toHaveTextContent("200ms");
    expect(latencyCard?.querySelector("span.text-rose-600")).not.toBeNull();
    expect(errorCard).toHaveTextContent("5%");
    expect(errorCard?.querySelector("span.text-rose-600")).not.toBeNull();
  });

  it("selects the first available dashboard when the prior selection is absent", async () => {
    vi.mocked(observabilityApi.dashboards).mockResolvedValueOnce({
      ...dashboardsPayload,
      dashboards: [dashboardsPayload.dashboards[1]],
    });

    renderWithProviders(<ObservabilityPage />);

    expect(await screen.findByText("Infraestrutura")).toBeInTheDocument();
    expect(screen.getByText("Host")).toBeInTheDocument();
    expect(screen.queryByText("API Overview")).not.toBeInTheDocument();

    for (const [label, range] of [
      ["5 min", "5m"],
      ["15 min", "15m"],
      ["6 h", "6h"],
      ["24 h", "24h"],
    ]) {
      fireEvent.click(screen.getByRole("button", { name: label }));
      await waitFor(() => {
        expect(observabilityApi.dashboards).toHaveBeenCalledWith(range);
      });
    }
  });
});
