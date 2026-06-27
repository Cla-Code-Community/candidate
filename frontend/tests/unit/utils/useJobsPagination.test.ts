import { useJobsPagination } from "@/domains/jobs/application/useJobsPagination";
import { act, renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";

const JOBS = Array.from({ length: 5 }).map((_, index) => ({ titulo: `Job ${index}` }));

describe("useJobsPagination", () => {
  it("calcula paginas e lista paginada", () => {
    const { result } = renderHook(() => useJobsPagination({ filteredJobs: JOBS, initialPageSize: 2 }));
    expect(result.current.totalPages).toBe(3);
    expect(result.current.paginatedJobs).toHaveLength(2);
  });

  it("nao permite pagina menor que 1", () => {
    const { result } = renderHook(() => useJobsPagination({ filteredJobs: JOBS, initialPageSize: 2 }));
    act(() => result.current.setCurrentPage(0));
    expect(result.current.currentPage).toBe(1);
  });

  it("limita itens por pagina entre 1 e 10", () => {
    const { result } = renderHook(() => useJobsPagination({ filteredJobs: JOBS, initialPageSize: 20 }));

    expect(result.current.pageSize).toBe(10);

    act(() => result.current.setPageSize(-3));
    expect(result.current.pageSize).toBe(1);
  });

  it("trata NaN como page size invalido e retorna 1", () => {
    const { result } = renderHook(() => useJobsPagination({ filteredJobs: JOBS, initialPageSize: NaN }));
    expect(result.current.pageSize).toBe(1);
  });

  it("trata Infinity como page size invalido e retorna 1", () => {
    const { result } = renderHook(() => useJobsPagination({ filteredJobs: JOBS, initialPageSize: Infinity }));
    expect(result.current.pageSize).toBe(1);
  });

  it("trata -Infinity como page size invalido e retorna 1", () => {
    const { result } = renderHook(() => useJobsPagination({ filteredJobs: JOBS, initialPageSize: -Infinity }));
    expect(result.current.pageSize).toBe(1);
  });

  it("reseta paginacao para pagina 1", () => {
    const { result } = renderHook(() => useJobsPagination({ filteredJobs: JOBS, initialPageSize: 2 }));

    act(() => result.current.setCurrentPage(3));
    expect(result.current.currentPage).toBe(3);

    act(() => result.current.resetPagination());
    expect(result.current.currentPage).toBe(1);
  });

  it("permite pageSize ser alterado com funcao updater", () => {
    const { result } = renderHook(() => useJobsPagination({ filteredJobs: JOBS, initialPageSize: 2 }));

    act(() => result.current.setPageSize((prev) => prev + 1));
    expect(result.current.pageSize).toBe(3);

    act(() => result.current.setPageSize((prev) => prev * 2));
    expect(result.current.pageSize).toBe(6);
  });

  it("permite currentPage ser alterado com funcao updater", () => {
    const { result } = renderHook(() => useJobsPagination({ filteredJobs: JOBS, initialPageSize: 2 }));

    act(() => result.current.setCurrentPage((prev) => prev + 1));
    expect(result.current.currentPage).toBe(2);

    act(() => result.current.setCurrentPage((prev) => prev + 1));
    expect(result.current.currentPage).toBe(3);
  });
});
