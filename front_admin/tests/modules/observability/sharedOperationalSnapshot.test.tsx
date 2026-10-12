import { act, renderHook } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NotificationProvider } from "../../../src/components/notifications/NotificationProvider";
import { ApiError } from "../../../src/lib/api/client";
import { scrapersApi } from "../../../src/lib/api/scrapers.api";
import { useDashboard } from "../../../src/modules/dashboard/hooks/useDashboard";
import { dashboardService } from "../../../src/modules/dashboard/services/dashboard.service";
import { useScrapers } from "../../../src/modules/scrapers/hooks/useScrapers";
import { useOperationalSnapshot } from "../../../src/modules/observability/hooks/useOperationalSnapshot";
import { operationalSnapshotService } from "../../../src/modules/observability/services/operationalSnapshot.service";
import { operationalFixture } from "../../fixtures/operationalSnapshot";

const session = vi.hoisted(() => ({ id: "", role: "admin" }));
vi.mock("../../../src/modules/auth/hooks/useAuth", () => ({ useAuth: () => ({ isLoggedIn: session }) }));
vi.mock("../../../src/modules/dashboard/services/dashboard.service", () => ({ dashboardService: { getOverview: vi.fn(), toggleScraper: vi.fn() } }));
vi.mock("../../../src/lib/api/scrapers.api", () => ({ scrapersApi: { list: vi.fn(), jobsCount: vi.fn(), jobs: vi.fn(), triggerOne: vi.fn(), trigger: vi.fn(), clearJobsCache: vi.fn() } }));
vi.mock("../../../src/modules/observability/services/operationalSnapshot.service", () => ({ operationalSnapshotService: { getSnapshot: vi.fn() } }));

let testSession = 0;
const overview = {
  stats: { totalUsers: { value: 2, trend: "Postgres", positive: true }, activeUsers: { value: 1, trend: "Contas", positive: true }, totalJobs: { value: 100, trend: "índice Valkey", positive: true }, jobsToday: { value: 0, trend: "índice", positive: true } },
  resources: { scraper: "ok", postgres: "ok", valkey: "ok" }, services: [],
  scrapers: [{ id: "go-scraper", name: "go-scraper", status: "Ocioso", lastRun: "Sem execução", catalogJobs: 2, active: false }],
  generatedAt: "2026-10-10T20:00:00.000Z",
};
function wrapper({ children }: { children: ReactNode }) { return <NotificationProvider>{children}</NotificationProvider>; }
function useAll() {
  const dashboard = useDashboard();
  const scrapers = useScrapers();
  const observability = useOperationalSnapshot(session.role !== "support", 10_000, `${session.id}:${session.role}`);
  return { dashboard, scrapers, observability };
}
const flush = () => act(async () => { await Promise.resolve(); });
beforeEach(() => {
  vi.useFakeTimers(); vi.resetAllMocks();
  session.id = `integration-${++testSession}`; session.role = "admin";
  vi.mocked(dashboardService.getOverview).mockResolvedValue(overview as Awaited<ReturnType<typeof dashboardService.getOverview>>);
  vi.mocked(scrapersApi.list).mockResolvedValue({ scrapers: [{ name: "go-scraper", status: "idle", running: false, lastRunAt: null, jobsCollected: 2 }] });
  vi.mocked(scrapersApi.jobsCount).mockResolvedValue({ total: 2 });
  vi.mocked(scrapersApi.jobs).mockResolvedValue({ total: 0, jobs: [] });
  vi.mocked(operationalSnapshotService.getSnapshot).mockResolvedValue(operationalFixture);
});
afterEach(() => vi.useRealTimers());

describe("shared Processor state in all three consumers", () => {
  it("uses one snapshot request and timer with partial execution, preserving catalog versus index", async () => {
    const p = operationalFixture.processor!;
    vi.mocked(operationalSnapshotService.getSnapshot).mockResolvedValue({ ...operationalFixture, status: "partial", processor: { ...p, status: "partial", execution: { ...p.execution, status: "canceling", stage: "indexing" } } });
    const { result } = renderHook(useAll, { wrapper });
    await flush();
    expect(operationalSnapshotService.getSnapshot).toHaveBeenCalledTimes(1);
    expect(result.current.dashboard.scrapers[0].status).toBe("Cancelando");
    expect(result.current.scrapers.scrapers[0].status).toBe("Cancelando");
    expect(result.current.dashboard.scrapers[0].runDisabled).toBe(true);
    expect(result.current.scrapers.scrapers[0].executionDetail).toContain("Indexação");
    expect(result.current.dashboard.operationalMessage).toContain("parcial");
    expect(result.current.dashboard.stats?.totalJobs.value).toBe(100);
    expect(result.current.scrapers.overview.catalogJobs).toBe(2);
    expect(result.current.scrapers.overview.loadedJobs).toBe(0);
    expect(result.current.observability.snapshot).toBe(result.current.dashboard.operational.snapshot);
    await act(async () => { await vi.advanceTimersByTimeAsync(10_000); });
    expect(operationalSnapshotService.getSnapshot).toHaveBeenCalledTimes(2);
  });
  it("preserves independent data when the Processor becomes unavailable and recovers", async () => {
    const { result } = renderHook(useAll, { wrapper }); await flush();
    vi.mocked(operationalSnapshotService.getSnapshot).mockResolvedValueOnce({ ...operationalFixture, status: "partial", processor: null, availability: { scraper: "down" } });
    await act(async () => { await result.current.dashboard.refresh(); });
    expect(result.current.dashboard.operational.stale).toBe(true);
    expect(result.current.scrapers.operationalMessage).toContain("desatualizado");
    expect(result.current.scrapers.scrapers[0].runDisabled).toBe(true);
    expect(result.current.dashboard.stats?.totalJobs.value).toBe(100);
    expect(result.current.scrapers.overview.catalogJobs).toBe(2);
    await act(async () => { await result.current.scrapers.refresh(); });
    expect(result.current.dashboard.operational.stale).toBe(false);
  });
  it("shares 403 and stops snapshot polling, keeping allowed data", async () => {
    vi.mocked(operationalSnapshotService.getSnapshot).mockRejectedValueOnce(new ApiError(403, {}));
    const { result } = renderHook(useAll, { wrapper }); await flush();
    expect(result.current.scrapers.scrapers[0].status).toBe("N/D");
    expect(result.current.dashboard.scrapers[0].lastRun).toBe("N/D");
    expect(result.current.dashboard.stats?.totalUsers.value).toBe(2);
    expect(result.current.scrapers.overview.catalogJobs).toBe(2);
    await act(async () => { await vi.advanceTimersByTimeAsync(30_000); await result.current.scrapers.refresh(); });
    expect(operationalSnapshotService.getSnapshot).toHaveBeenCalledTimes(1);
  });
  it("uses the permitted scheduler fallback for support without requesting the snapshot", async () => {
    session.role = "support";
    const { result } = renderHook(useAll, { wrapper }); await flush();
    expect(operationalSnapshotService.getSnapshot).not.toHaveBeenCalled();
    expect(result.current.scrapers.scrapers[0].status).toBe("Ocioso");
    expect(result.current.dashboard.scrapers[0].runDisabled).toBe(true);
    expect(result.current.scrapers.operationalMessage).toContain("Scheduler");
  });
  it("separates zero, missing count and unavailable sample, with independent errors", async () => {
    vi.mocked(scrapersApi.jobsCount).mockRejectedValueOnce(new Error("count down"));
    vi.mocked(scrapersApi.jobs).mockRejectedValueOnce(new Error("jobs down"));
    const { result } = renderHook(useAll, { wrapper }); await flush();
    expect(result.current.scrapers.overview.catalogJobs).toBeNull();
    expect(result.current.scrapers.overview.loadedJobs).toBeNull();
    expect(result.current.scrapers.scrapers).toHaveLength(1);
    expect(result.current.dashboard.stats?.jobsToday.value).toBe(0);
    vi.mocked(scrapersApi.jobsCount).mockResolvedValueOnce({ total: 0 });
    await act(async () => { await result.current.scrapers.refresh(); });
    expect(result.current.scrapers.overview.catalogJobs).toBe(0);
    expect(result.current.scrapers.overview.loadedJobs).toBe(0);
  });
  it("does not share state between sessions", async () => {
    const { result, rerender } = renderHook(useAll, { wrapper }); await flush();
    const previous = result.current.observability.snapshot;
    session.id = "other-session";
    vi.mocked(operationalSnapshotService.getSnapshot).mockRejectedValueOnce(new ApiError(403, {}));
    rerender(); await flush();
    expect(result.current.observability.snapshot).toBeNull();
    expect(previous).not.toBeNull();
    expect(result.current.dashboard.scrapers[0].status).toBe("N/D");
  });
});
