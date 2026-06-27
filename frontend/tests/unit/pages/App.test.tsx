import "@testing-library/jest-dom";
import { act, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";

vi.stubGlobal("IntersectionObserver", class {
  observe = vi.fn();
  unobserve = vi.fn();
  disconnect = vi.fn();
  constructor(public callback: IntersectionObserverCallback) {}
});

vi.mock("@/shared/hooks/useTheme", () => ({
  useTheme: () => ({ resolvedTheme: "light", toggleTheme: vi.fn() }),
}));

vi.mock("@/domains/marketing/presentation/pages/LandingPage", () => ({
  default: () => <main>Funcionalidades</main>,
}));

vi.mock("@/domains/jobs/application/useJobsData", () => ({
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

vi.mock("@/domains/jobs/application/useJobsFiltering", () => ({
  useJobsFiltering: () => ({
    search: "",
    setSearch: vi.fn(),
    keywordFilter: [],
    setKeywordFilter: vi.fn(),
    keywords: ["React"],
    filteredJobs: [{ titulo: "Dev", empresa: "ACME", local: "BR", palavra: "React", link: "x" }],
  }),
}));

vi.mock("@/domains/jobs/application/useJobsPagination", () => ({
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

import App from "@/app/App";

describe("App", () => {
  it("renderiza a landing page após o loading", () => {
    vi.useFakeTimers()
    try {
      render(
        <MemoryRouter initialEntries={["/"]}>
          <App />
        </MemoryRouter>
      )
      act(() => {
        vi.runAllTimers();
      });
      expect(screen.getAllByText(/funcionalidades/i).length).toBeGreaterThan(0);
    } finally {
      vi.useRealTimers();
    }
  });
});
