import { act, renderHook, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  fetchJobsByAPIMock: vi.fn(),
  runScraperRequestMock: vi.fn(),
}));

vi.mock("@/domains/jobs/infrastructure/jobsApi", () => ({
  fetchJobsByAPI: mocks.fetchJobsByAPIMock,
  runScraperRequest: mocks.runScraperRequestMock,
}));

import { useJobsData } from "@/domains/jobs/application/useJobsData";

describe("useJobsData", () => {
  it("carrega jobs iniciais", async () => {
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
      expect(result.current.meta.total).toBe(1);
    });
  });

  it("carrega jobs manualmente através do loadJobs", async () => {
    mocks.fetchJobsByAPIMock.mockResolvedValue({
      jobs: [{ title: "Dev" }],
      total: 1,
      hasNext: false,
      hasPrev: false,
      page: 1,
      limit: 5,
      totalPages: 1,
    });

    const { result } = renderHook(() => useJobsData());

    await act(async () => {
      await result.current.loadJobs();
    });

    expect(result.current.jobs).toHaveLength(1);
  });
});
