import { act, renderHook, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  fetchJobFilesMock: vi.fn(async () => [{ file: "vagas.xlsx" }]),
  fetchJobsByFileMock: vi.fn(async () => ({ jobs: [{ titulo: "Dev" }], file: "vagas.xlsx", modifiedAt: 1, total: 1 })),
}));

vi.mock("@/domains/jobs/infrastructure/jobsApi", () => ({
  fetchJobFiles: mocks.fetchJobFilesMock,
  fetchJobsByFile: mocks.fetchJobsByFileMock,
}));

import { useJobsData } from "@/domains/jobs/application/useJobsData";

describe("useJobsData", () => {
  it("carrega arquivos e jobs iniciais", async () => {
    const { result } = renderHook(() => useJobsData());

    await waitFor(() => {
      expect(result.current.files).toHaveLength(1);
      expect(result.current.meta.file).toBe("vagas.xlsx");
    });
  });

  it("carrega jobs por arquivo manualmente", async () => {
    const { result } = renderHook(() => useJobsData());

    await act(async () => {
      await result.current.loadJobs("vagas.xlsx");
    });

    expect(result.current.jobs).toHaveLength(1);
  });
});
