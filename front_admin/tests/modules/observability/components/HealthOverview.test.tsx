import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { HealthOverview } from "../../../../src/modules/observability/components/HealthOverview";
import type { MetricSnapshot } from "../../../../src/lib/api/types";

const metrics: MetricSnapshot = { requestRatePerMinute: 0, errorRatePct: 0, p95LatencyMs: 200, cacheHitRatePct: null, activeSessionsCount: 0 };
const props = { health: null, metrics, healthStale: false, metricsStale: false, canReadMetrics: true };
describe("compact health context", () => {
  it("preserves numeric zero and exposes the existing p95 threshold", () => {
    render(<HealthOverview {...props} />);
    expect(within(screen.getByRole("article", { name: "Taxa de erro" })).getByText("0%")).toBeInTheDocument();
    expect(within(screen.getByRole("article", { name: "Latência p95" })).getByText(/Atenção > 150 ms/)).toBeInTheDocument();
  });
  it("keeps an unknown rate unknown without guessing the cause", () => {
    render(<HealthOverview {...props} metrics={{ ...metrics, errorRatePct: null }} />);
    const card = within(screen.getByRole("article", { name: "Taxa de erro" }));
    expect(card.getByText("N/D")).toBeInTheDocument();
    expect(card.getByText(/motivo não informado/)).toBeInTheDocument();
    expect(card.queryByText("0%")).not.toBeInTheDocument();
  });
  it("uses a request failure as evidence of source unavailability", () => {
    render(<HealthOverview {...props} metrics={{ ...metrics, errorRatePct: null }} metricsError="Falha na consulta" />);
    expect(within(screen.getByRole("article", { name: "Taxa de erro" })).getByText("Fonte indisponível")).toBeInTheDocument();
  });
});
