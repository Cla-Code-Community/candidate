import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "../../../../src/lib/api/client";
import { useOperationalSnapshot } from "../../../../src/modules/observability/hooks/useOperationalSnapshot";
import { operationalSnapshotService } from "../../../../src/modules/observability/services/operationalSnapshot.service";
import { operationalFixture } from "../../../fixtures/operationalSnapshot";

vi.mock("../../../../src/modules/observability/services/operationalSnapshot.service", () => ({ operationalSnapshotService: { getSnapshot: vi.fn() } }));
const flush = async () => { await act(async () => { await Promise.resolve(); }); };

let sessionNumber = 0;
let sessionKey = "";
describe("operational polling", () => {
  beforeEach(() => {
    sessionKey = `test-session-${++sessionNumber}`;
    vi.useFakeTimers();
    vi.resetAllMocks();
    vi.mocked(operationalSnapshotService.getSnapshot).mockResolvedValue(operationalFixture);
  });
  afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks(); });
  it("does not request known unauthorized snapshots", async () => {
    const { result } = renderHook(() => useOperationalSnapshot(false, 10_000, sessionKey));
    await act(async () => { await result.current.refresh(); vi.advanceTimersByTime(30_000); });
    expect(operationalSnapshotService.getSnapshot).not.toHaveBeenCalled();
  });
  it("preserves a last valid reading as stale on Processor down and recovers", async () => {
    const { result } = renderHook(() => useOperationalSnapshot(true, 10_000, sessionKey));
    await flush();
    vi.mocked(operationalSnapshotService.getSnapshot).mockResolvedValueOnce({ ...operationalFixture, status: "partial", processor: null, availability: { scraper: "down" } });
    await act(async () => { await result.current.refresh(); });
    expect(result.current.snapshot?.processor?.execution.status).toBe("idle");
    expect(result.current.stale).toBe(true);
    await act(async () => { await result.current.refresh(); });
    expect(result.current.stale).toBe(false);
  });
  it("stops polling and manual requests after 403", async () => {
    vi.mocked(operationalSnapshotService.getSnapshot).mockRejectedValueOnce(new ApiError(403, {}));
    const { result } = renderHook(() => useOperationalSnapshot(true, 10_000, sessionKey));
    await flush();
    await act(async () => { vi.advanceTimersByTime(30_000); await result.current.refresh(); });
    expect(operationalSnapshotService.getSnapshot).toHaveBeenCalledTimes(1);
    expect(result.current.snapshot).toBeNull();
    expect(result.current.error).toContain("autorização");
  });
  it("coordinates manual requests, aborts on unmount and ignores late results", async () => {
    let resolve!: (value: typeof operationalFixture) => void;
    vi.mocked(operationalSnapshotService.getSnapshot).mockReturnValueOnce(new Promise((r) => { resolve = r; }));
    const { result, unmount } = renderHook(() => useOperationalSnapshot(true, 10_000, sessionKey));
    act(() => { void result.current.refresh(); void result.current.refresh(); vi.advanceTimersByTime(1000); });
    expect(operationalSnapshotService.getSnapshot).toHaveBeenCalledTimes(1);
    const signal = vi.mocked(operationalSnapshotService.getSnapshot).mock.calls[0][0];
    unmount();
    expect(signal.aborted).toBe(true);
    await act(async () => { resolve(operationalFixture); });
  });
  it("pauses while hidden and refreshes when visible", async () => {
    const hidden = vi.spyOn(document, "hidden", "get").mockReturnValue(true);
    renderHook(() => useOperationalSnapshot(true, 10_000, sessionKey));
    act(() => { vi.advanceTimersByTime(10_000); });
    expect(operationalSnapshotService.getSnapshot).not.toHaveBeenCalled();
    hidden.mockReturnValue(false);
    act(() => { document.dispatchEvent(new Event("visibilitychange")); });
    await flush();
    expect(operationalSnapshotService.getSnapshot).toHaveBeenCalledTimes(1);
  });
});
