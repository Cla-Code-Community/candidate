import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "../../../src/lib/api/client";
import { createPollingResource } from "../../../src/lib/polling/pollingResource";
import { usePollingResource } from "../../../src/lib/polling/usePollingResource";

const flush = () => act(async () => { await Promise.resolve(); });
beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe("resource lifecycle", () => {
  it("shares one timer and request, aborting only when the final consumer leaves", async () => {
    let resolve!: (value: number) => void;
    const load = vi.fn(() => new Promise<number>((r) => { resolve = r; }));
    const resource = createPollingResource({ load, intervalMs: 10_000, errorMessage: "failed" });
    const first = renderHook(() => usePollingResource(resource));
    const second = renderHook(() => usePollingResource(resource));
    await flush();
    act(() => { void first.result.current.refresh(); void second.result.current.refresh(); });
    expect(load).toHaveBeenCalledTimes(1);
    const signal = load.mock.calls[0][0] as AbortSignal;
    first.unmount();
    expect(signal.aborted).toBe(false);
    second.unmount();
    expect(signal.aborted).toBe(true);
    await act(async () => { resolve(7); });
    expect(resource.getSnapshot().data).toBeNull();
    expect(vi.getTimerCount()).toBe(0);
  });
  it("stops all future requests after 403, even manual refresh", async () => {
    const load = vi.fn().mockRejectedValue(new ApiError(403, {}));
    const resource = createPollingResource({ load, intervalMs: 10_000, errorMessage: "failed" });
    const { result } = renderHook(() => usePollingResource(resource));
    await flush();
    await act(async () => { await vi.advanceTimersByTimeAsync(60_000); await result.current.refresh(); });
    expect(load).toHaveBeenCalledTimes(1);
    expect(result.current.forbidden).toBe(true);
    expect(result.current.data).toBeNull();
  });
  it("keeps real zero distinct from missing and stale values", async () => {
    const load = vi.fn().mockResolvedValueOnce(0).mockRejectedValueOnce(new Error("down")).mockResolvedValueOnce(2);
    const resource = createPollingResource<number>({ load, intervalMs: 10_000, errorMessage: "failed" });
    const { result } = renderHook(() => usePollingResource(resource));
    expect(result.current.data).toBeNull();
    await flush();
    expect(result.current.data).toBe(0);
    await act(async () => { await result.current.refresh(); });
    expect(result.current.data).toBe(0);
    expect(result.current.stale).toBe(true);
    await act(async () => { await result.current.refresh(); });
    expect(result.current.data).toBe(2);
    expect(result.current.stale).toBe(false);
  });
  it("aborts timed out requests and ignores an old result after recovery", async () => {
    let resolve!: (value: number) => void;
    const load = vi.fn().mockReturnValueOnce(new Promise<number>((r) => { resolve = r; })).mockResolvedValueOnce(2);
    const resource = createPollingResource<number>({ load, intervalMs: 10_000, errorMessage: "failed" });
    const { result } = renderHook(() => usePollingResource(resource));
    await flush();
    await act(async () => { await vi.advanceTimersByTimeAsync(8_000); });
    expect(load.mock.calls[0][0].aborted).toBe(true);
    expect(result.current.stale).toBe(true);
    await act(async () => { await result.current.refresh(); });
    await act(async () => { resolve(1); });
    expect(result.current.data).toBe(2);
  });
});
