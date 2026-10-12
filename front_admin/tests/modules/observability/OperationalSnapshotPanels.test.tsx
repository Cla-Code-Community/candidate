import { render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { OperationalSnapshotPanels, ProcessorResources } from "../../../src/modules/observability/components/OperationalSnapshotPanels";
import { OperationalSnapshotSchema } from "../../../src/modules/observability/schemas/operationalSnapshot.schema";
import { operationalFixture } from "../../fixtures/operationalSnapshot";

function reading(snapshot = OperationalSnapshotSchema.parse(operationalFixture), stale = false) {
  return { snapshot, stale, loading: false, forbidden: false, error: null, refresh: vi.fn() };
}
describe("run data in existing operational cards", () => {
  it("keeps aggregate execution progress without rendering provider details", () => {
    const p = operationalFixture.processor!;
    const snapshot = OperationalSnapshotSchema.parse({ ...operationalFixture, processor: { ...p, providers: [{ id: "gupy", configuredConcurrency: 1, active: 0, waiting: 0, tasksTotal: 1, tasksCompleted: 1, tasksFailed: 0, tasksCanceled: 0, jobsCollected: 3, lastTaskStatus: "success", lastTaskFinishedAt: null, lastTaskDurationSeconds: 0, lastErrorType: null }] } });
    render(<OperationalSnapshotPanels operational={reading(snapshot)} />);
    const progress = within(screen.getByRole("article", { name: "Progresso da execução" }));
    expect(progress.getByText("Providers encerrados").nextElementSibling).toHaveTextContent(`${p.progress.providersCompleted} / ${p.progress.providersTotal}`);
    expect(screen.getByText("Concorrência ativa / efetiva")).toBeInTheDocument();
    expect(screen.getByText("Em espera")).toBeInTheDocument();
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
    expect(screen.queryByText(/Providers desta execução/)).not.toBeInTheDocument();
    expect(screen.queryByText("gupy")).not.toBeInTheDocument();
  });
  it("describes invalid classifications and indexing buffer without inventing a remainder", () => {
    const p = operationalFixture.processor!;
    const snapshot = OperationalSnapshotSchema.parse({ ...operationalFixture, processor: { ...p, classification: { received: 3, classified: 2, approved: 1, rejected: 1, invalid: 1 } } });
    render(<OperationalSnapshotPanels operational={reading(snapshot)} />);
    const classification = within(screen.getByRole("article", { name: "Classificação" }));
    expect(classification.getByText("Inválidas")).toBeInTheDocument();
    expect(classification.getByText(/Recebidas incluem inválidas/)).toBeInTheDocument();
    expect(screen.queryByText("Pendentes")).not.toBeInTheDocument();
    expect(screen.getByText("Buffer ocupado / capacidade")).toBeInTheDocument();
  });
  it.each([[0, "0s"], [93900, "1d 2h"], [110.045362548, "1m 50s"]])("formats lock TTL %s with raw seconds retained", (ttl, display) => {
    const p = operationalFixture.processor!;
    const snapshot = OperationalSnapshotSchema.parse({ ...operationalFixture, processor: { ...p, lock: { ...p.lock, ttlSeconds: ttl } } });
    render(<OperationalSnapshotPanels operational={reading(snapshot)} />);
    expect(screen.getByTitle(`${ttl} segundos`)).toHaveTextContent(display);
  });
  it("identifies RSS and HeapAlloc while preserving multicore CPU", () => {
    const p = operationalFixture.processor!;
    const snapshot = OperationalSnapshotSchema.parse({ ...operationalFixture, processor: { ...p, resources: { ...p.resources, cpuPercent: 230 } } });
    render(<ProcessorResources operational={reading(snapshot)} />);
    expect(screen.getByText("230.0%")).toBeInTheDocument();
    expect(screen.getByText("Heap Go alocado")).toBeInTheDocument();
    expect(screen.getByText(/HeapAlloc/)).toBeInTheDocument();
  });
  it("renders an older backend with unavailable run totals", () => {
    render(<OperationalSnapshotPanels operational={reading()} />);
    expect(screen.getByText(/Run ID: N\/D/)).toBeInTheDocument();
    expect(within(screen.getByRole("article", { name: "Classificação" })).getAllByText("N/D").length).toBeGreaterThan(0);
    expect(within(screen.getByRole("article", { name: "Persistência" })).getAllByText("N/D").length).toBeGreaterThan(0);
  });
  it("keeps real zero visible and retains run identity in a stale partial snapshot", () => {
    const p = operationalFixture.processor!;
    const snapshot = OperationalSnapshotSchema.parse({ ...operationalFixture, status: "partial", processor: { ...p, execution: { ...p.execution, status: "running", runId: "real-run-id" }, classification: { received: 0, classified: 0, approved: 0, rejected: 0, invalid: 0 }, persistence: { received: 0, inserted: 0, updated: 0, skipped: 0, failed: 0, failedBatches: 0 } } });
    render(<OperationalSnapshotPanels operational={reading(snapshot, true)} />);
    expect(screen.getByText(/Run ID: real-run-id/)).toBeInTheDocument();
    expect(within(screen.getByRole("article", { name: "Classificação" })).getAllByText("0")).toHaveLength(5);
    expect(within(screen.getByRole("article", { name: "Persistência" })).getAllByText("0")).toHaveLength(6);
    expect(screen.getByRole("status")).toHaveTextContent("Leitura desatualizada");
    expect(screen.getByRole("status")).toHaveTextContent("Snapshot parcial");
  });
});
