import { fireEvent, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ObservabilityPage } from "../../../src/modules/observability/ObservabilityPage";
import { observabilityApi } from "../../../src/lib/api/observability.api";
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
});
