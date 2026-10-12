import { ApiError } from "../../../src/lib/api/client";
import { operationalFixture } from "../../fixtures/operationalSnapshot";
import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { observabilityApi } from "../../../src/lib/api/observability.api";
import { ObservabilityPage } from "../../../src/modules/observability/ObservabilityPage";
import { renderWithProviders } from "../../test-utils";

vi.mock("../../../src/lib/api/observability.api", () => ({
  observabilityApi: {
    getOperationalSnapshot: vi.fn(),
    health: vi.fn(),
    metrics: vi.fn(),
    dashboards: vi.fn(),
  },
}));

vi.mock("../../../src/modules/auth/hooks/useAuth", () => ({
  useAuth: () => ({ isLoggedIn: { role: "admin" } }),
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
    vi.mocked(observabilityApi.getOperationalSnapshot).mockResolvedValue(operationalFixture);
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
    await screen.findByRole("heading", { name: "Saúde geral" });
    await screen.findByText("Requests/sec");

    expect(screen.getByText("Latência p95")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Postgres" })).toBeInTheDocument();

    expect(screen.getByText("Host")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "1 h" }));
    await waitFor(() =>
      expect(observabilityApi.dashboards).toHaveBeenCalledWith("1h", expect.any(AbortSignal)),
    );
  });

  it("keeps health, execution and pipeline before infrastructure, business and history", async () => {
    renderWithProviders(<ObservabilityPage />);
    await screen.findByText("Requests/sec");
    const headings = screen.getAllByRole("heading", { level: 2 }).map(h => h.textContent);
    expect(headings).toEqual(["Saúde geral", "Execução atual do Processor", "Pipeline", "Infraestrutura", "Business", "Histórico"]);
    const health = screen.getByRole("region", { name: "Saúde geral" });
    expect(within(health).getAllByRole("article")).toHaveLength(6);
    expect(health.querySelector("svg")).toBeNull();
  });

  it("does not retry forbidden series when the range or refresh changes", async () => {
    vi.mocked(observabilityApi.dashboards).mockRejectedValueOnce(new ApiError(403, {}));
    renderWithProviders(<ObservabilityPage />);
    await screen.findByText("Sem autorização para consultar este recurso.");
    fireEvent.click(screen.getByRole("button", { name: "1 h" }));
    await screen.findByText("Sem autorização para consultar este recurso.");
    fireEvent.click(screen.getByRole("button", { name: "Atualizar" }));
    await waitFor(() => expect(observabilityApi.health).toHaveBeenCalledTimes(2));
    expect(observabilityApi.dashboards).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("heading", { name: "Postgres" })).toBeInTheDocument();
  });

  it("shows errors and dashboard shells when APIs fail", async () => {
    vi.mocked(observabilityApi.health).mockRejectedValueOnce(new Error("fail"));
    vi.mocked(observabilityApi.metrics).mockRejectedValueOnce(new Error("fail"));
    vi.mocked(observabilityApi.dashboards).mockRejectedValueOnce(new Error("fail"));

    renderWithProviders(<ObservabilityPage />);

    expect(
      await screen.findByText(/Nao foi possivel carregar a observabilidade\./),
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

    await screen.findByRole("heading", { name: "Saúde geral" });
    expect(screen.getAllByText("N/D").length).toBeGreaterThan(3);
    expect(await screen.findByText("connection refused")).toBeInTheDocument();
    expect(screen.getByText("Degradado")).toBeInTheDocument();
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

    await screen.findByRole("heading", { name: "Saúde geral" });
    const latencyCard = await screen.findByRole("article", { name: "Latência p95" });
    await waitFor(() => expect(latencyCard).toHaveTextContent("200 ms"));
    const errorCard = screen.getByRole("article", { name: "Taxa de erro" });
    expect(latencyCard.querySelector("p.text-rose-600")).not.toBeNull();
    expect(errorCard).toHaveTextContent("5%");
    expect(errorCard.querySelector("p.text-rose-600")).not.toBeNull();
  });

  it("renders operational data despite Prometheus failure, preserving partial execution", async () => {
    const processor = operationalFixture.processor!;
    vi.mocked(observabilityApi.getOperationalSnapshot).mockResolvedValueOnce({
      ...operationalFixture, status: "partial", processor: {
        ...processor, status: "partial", execution: { ...processor.execution, status: "canceling", stage: "persistence" },
        resources: { ...processor.resources, cpuPercent: 230 },
      },
    });
    vi.mocked(observabilityApi.dashboards).mockRejectedValueOnce(new Error("Prometheus down"));
    vi.mocked(observabilityApi.metrics).mockRejectedValueOnce(new Error("Prometheus down"));
    renderWithProviders(<ObservabilityPage />);
    await screen.findByText(/Sem resposta das series detalhadas/);
    expect(await screen.findByText("Cancelando")).toBeInTheDocument();
    expect(screen.getByText(/Etapa: Persistência/)).toBeInTheDocument();
    expect(screen.getByText("230.0%")).toBeInTheDocument();
    expect(screen.getByText(/Snapshot parcial/)).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Postgres" })).toBeInTheDocument();
    expect(screen.queryByText("Vagas por rodada (apos dedup)")).not.toBeInTheDocument();
  });

  it("keeps sections and range controls when API history is absent", async () => {
    vi.mocked(observabilityApi.dashboards).mockResolvedValueOnce({
      ...dashboardsPayload,
      dashboards: [dashboardsPayload.dashboards[1]],
    });

    renderWithProviders(<ObservabilityPage />);

    expect(await screen.findByRole("heading", { name: "Infraestrutura" })).toBeInTheDocument();
    expect(screen.getByText("Host")).toBeInTheDocument();
    expect(screen.queryByText("Requests/sec")).not.toBeInTheDocument();

    for (const [label, range] of [
      ["5 min", "5m"],
      ["15 min", "15m"],
      ["6 h", "6h"],
      ["24 h", "24h"],
    ]) {
      fireEvent.click(screen.getByRole("button", { name: label }));
      await waitFor(() => {
        expect(observabilityApi.dashboards).toHaveBeenCalledWith(range, expect.any(AbortSignal));
      });
    }
  });
});
