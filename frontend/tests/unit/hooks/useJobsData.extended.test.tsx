import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  fetchJobFilesMock: vi.fn(),
  fetchJobsByFileMock: vi.fn(),
  runScraperRequestMock: vi.fn(),
}));

vi.mock("@/domains/jobs/infrastructure/jobsApi", () => ({
  fetchJobFiles: mocks.fetchJobFilesMock,
  fetchJobsByFile: mocks.fetchJobsByFileMock,
  runScraperRequest: mocks.runScraperRequestMock,
}));

import { useJobsData } from "@/domains/jobs/application/useJobsData";

describe("useJobsData extended", () => {
  beforeEach(() => {
    mocks.fetchJobFilesMock.mockReset();
    mocks.fetchJobsByFileMock.mockReset();
    mocks.runScraperRequestMock.mockReset();

    mocks.fetchJobFilesMock.mockResolvedValue([{ file: "vagas.xlsx" }]);
    mocks.fetchJobsByFileMock.mockResolvedValue({
      jobs: [{ titulo: "Dev" }],
      file: "vagas.xlsx",
      modifiedAt: 1,
      total: 1,
    });
    mocks.runScraperRequestMock.mockResolvedValue(undefined);
  });

  it("exibe erro quando listagem inicial de arquivos falha", async () => {
    mocks.fetchJobFilesMock.mockRejectedValueOnce(new Error("offline"));

    const { result } = renderHook(() => useJobsData());

    await waitFor(() => {
      expect(result.current.error).toMatch(/nao foi possivel listar arquivos/i);
    });
  });

  it("reseta estado quando loadJobs falha", async () => {
    mocks.fetchJobsByFileMock.mockRejectedValueOnce(new Error("falha jobs"));

    const { result } = renderHook(() => useJobsData());

    await act(async () => {
      await result.current.loadJobs("vagas.xlsx");
    });

    expect(result.current.jobs).toEqual([]);
    expect(result.current.meta.total).toBe(0);
    expect(result.current.error).toBe("falha jobs");
  });

  it("triggerScraper limpa dados quando não encontra novo arquivo", async () => {
    mocks.fetchJobFilesMock
      .mockResolvedValueOnce([{ file: "vagas.xlsx" }])
      .mockResolvedValueOnce([]);

    const { result } = renderHook(() => useJobsData());

    await waitFor(() => {
      expect(result.current.selectedFile).toBe("vagas.xlsx");
    });

    await act(async () => {
      await result.current.triggerScraper();
    });

    expect(result.current.selectedFile).toBe("");
    expect(result.current.jobs).toEqual([]);
    expect(result.current.meta.total).toBe(0);
  });

  it("triggerScraper carrega jobs quando arquivo permanece o mesmo", async () => {
    mocks.fetchJobFilesMock
      .mockResolvedValueOnce([{ file: "vagas.xlsx" }])
      .mockResolvedValueOnce([{ file: "vagas.xlsx" }]);

    const { result } = renderHook(() => useJobsData());

    await waitFor(() => {
      expect(result.current.selectedFile).toBe("vagas.xlsx");
    });

    await act(async () => {
      await result.current.triggerScraper();
    });

    expect(mocks.fetchJobsByFileMock).toHaveBeenCalledWith("vagas.xlsx");
    expect(result.current.scraping).toBe(false);
  });

  it("triggerScraper atualiza selectedFile quando novo arquivo é diferente do atual", async () => {
    mocks.fetchJobFilesMock
      .mockResolvedValueOnce([{ file: "vagas.xlsx" }])
      .mockResolvedValueOnce([{ file: "novo-arquivo.xlsx" }]);

    const { result } = renderHook(() => useJobsData());

    await waitFor(() => {
      expect(result.current.selectedFile).toBe("vagas.xlsx");
    });

    await act(async () => {
      await result.current.triggerScraper();
    });

    expect(result.current.selectedFile).toBe("novo-arquivo.xlsx");
  });
});
