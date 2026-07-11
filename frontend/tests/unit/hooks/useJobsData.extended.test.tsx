import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  fetchJobsByAPIMock: vi.fn(),
  runScraperRequestMock: vi.fn(),
}));

vi.mock("@/domains/jobs/infrastructure/jobsApi", () => ({
  fetchJobsByAPI: mocks.fetchJobsByAPIMock,
  runScraperRequest: mocks.runScraperRequestMock,
}));

import { useJobsData } from "@/domains/jobs/application/useJobsData";

describe("useJobsData extended", () => {
  beforeEach(() => {
    mocks.fetchJobsByAPIMock.mockReset();
    mocks.runScraperRequestMock.mockReset();

    mocks.fetchJobsByAPIMock.mockResolvedValue({
      jobs: [{ title: "Dev" }],
      total: 1,
      hasNext: false,
      hasPrev: false,
      page: 1,
      limit: 5,
      totalPages: 1,
    });
    mocks.runScraperRequestMock.mockResolvedValue(undefined);
  });

  it("exibe erro quando a API de jobs falha", async () => {
    mocks.fetchJobsByAPIMock.mockRejectedValueOnce(new Error("offline"));

    const { result } = renderHook(() => useJobsData());

    await waitFor(() => {
      expect(result.current.error).toMatch(/offline/i);
    });
  });

  it("reseta estado quando loadJobs falha", async () => {
    mocks.fetchJobsByAPIMock.mockResolvedValueOnce({
      jobs: [{ title: "Dev" }],
      total: 1,
      hasNext: false,
      hasPrev: false,
      page: 1,
      limit: 5,
      totalPages: 1,
    });

    const { result } = renderHook(() => useJobsData());

    await waitFor(() => {
      expect(result.current.jobs).toHaveLength(1);
    });

    mocks.fetchJobsByAPIMock.mockRejectedValueOnce(new Error("falha jobs"));
    await act(async () => {
      await result.current.loadJobs();
    });

    expect(result.current.jobs).toEqual([]);
    expect(result.current.meta.total).toBe(0);
    expect(result.current.error).toBe("falha jobs");
  });

  it("triggerScraper carrega jobs após executar request", async () => {
    const { result } = renderHook(() => useJobsData());

    await act(async () => {
      await result.current.triggerScraper();
    });

    expect(mocks.runScraperRequestMock).toHaveBeenCalled();
    expect(mocks.fetchJobsByAPIMock).toHaveBeenCalled();
    expect(result.current.scraping).toBe(false);
  });
});
