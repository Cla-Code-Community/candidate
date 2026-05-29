import { act, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/hooks/useTheme", () => ({
  useTheme: () => ({ resolvedTheme: "light", toggleTheme: vi.fn() }),
}));

vi.mock("@/hooks/useJobsData", () => ({
  useJobsData: () => ({
    files: [{ file: "vagas.xlsx" }],
    selectedFile: "vagas.xlsx",
    setSelectedFile: vi.fn(),
    jobs: [{ titulo: "Dev", empresa: "ACME", local: "BR", palavra: "React", link: "x" }],
    meta: { file: "vagas.xlsx", modifiedAt: 1, total: 1 },
    loading: false,
    scraping: false,
    error: "",
    loadJobs: vi.fn(),
    triggerScraper: vi.fn(),
  }),
}));

vi.mock("@/hooks/useJobsFiltering", () => ({
  useJobsFiltering: () => ({
    search: "",
    setSearch: vi.fn(),
    keywordFilter: [],
    setKeywordFilter: vi.fn(),
    keywords: ["React"],
    filteredJobs: [{ titulo: "Dev", empresa: "ACME", local: "BR", palavra: "React", link: "x" }],
  }),
}));

vi.mock("@/hooks/useJobsPagination", () => ({
  useJobsPagination: () => ({
    currentPage: 1,
    setCurrentPage: vi.fn(),
    pageSize: 25,
    setPageSize: vi.fn(),
    resetPagination: vi.fn(),
    totalPages: 1,
    paginatedJobs: [{ titulo: "Dev", empresa: "ACME", local: "BR", palavra: "React", link: "x" }],
  }),
}));

import App from "@/App";

describe("App", () => {
  it("renderiza painel principal", () => {
    vi.useFakeTimers();

    try {
      render(
        <MemoryRouter initialEntries={["/"]}>
          <App />
        </MemoryRouter>
      );

      act(() => {
        vi.advanceTimersByTime(2000);
      });

      expect(screen.getAllByAltText("Painel de Vagas").length).toBeGreaterThan(0);
    } finally {
      vi.useRealTimers();
    }
  });
});
