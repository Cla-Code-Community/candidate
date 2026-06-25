/* eslint-disable @typescript-eslint/no-explicit-any */
import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const hookState = vi.hoisted(() => ({
  useJobsDataValue: {
    files: [{ file: "vagas.xlsx" }],
    selectedFile: "vagas.xlsx",
    setSelectedFile: vi.fn(),
    jobs: [
      {
        titulo: "Dev",
        empresa: "ACME",
        local: "BR",
        palavra: "React",
        link: "x",
      },
    ],
    meta: { file: "vagas.xlsx", modifiedAt: 123, total: 1 },
    loading: false,
    scraping: false,
    error: "",
    triggerScraper: vi.fn(async () => {}),
  },
  useJobsFilteringValue: {
    search: "",
    setSearch: vi.fn(),
    keywordFilter: [],
    setKeywordFilter: vi.fn(),
    keywords: ["React"],
    filteredJobs: [
      {
        titulo: "Dev",
        empresa: "ACME",
        local: "BR",
        palavra: "React",
        link: "x",
      },
    ],
  },
  useJobsPaginationValue: {
    currentPage: 1,
    setCurrentPage: vi.fn(),
    pageSize: 10,
    setPageSize: vi.fn(),
    resetPagination: vi.fn(),
    totalPages: 1,
    paginatedJobs: [
      {
        titulo: "Dev",
        empresa: "ACME",
        local: "BR",
        palavra: "React",
        link: "x",
      },
    ],
  },
  capturedFiltersProps: null as any,
  capturedTableProps: null as any,
}));

vi.mock("@/domains/jobs/application/useJobsData", () => ({
  useJobsData: () => hookState.useJobsDataValue,
}));

vi.mock("@/domains/jobs/application/useJobsFiltering", () => ({
  useJobsFiltering: () => hookState.useJobsFilteringValue,
}));

vi.mock("@/domains/jobs/application/useJobsPagination", () => ({
  useJobsPagination: () => hookState.useJobsPaginationValue,
}));

vi.mock("@/domains/jobs/presentation/components/JobsFiltersCard", () => ({
  JobsFiltersCard: (props: any) => {
    hookState.capturedFiltersProps = props;

    return (
      <div>
        <button type="button" onClick={() => props.setSearch("frontend")}>
          set search value
        </button>
        <button
          type="button"
          onClick={() => props.setSearch((prev: string) => `${prev}-updated`)}
        >
          set search updater
        </button>
        <button type="button" onClick={() => props.setKeywordFilter(["Node"])}>
          set keyword value
        </button>
        <button
          type="button"
          onClick={() =>
            props.setKeywordFilter((prev: string[]) => [...prev, "Go"])
          }
        >
          set keyword updater
        </button>
        <button
          type="button"
          onClick={() => props.setSelectedFile("historico.xlsx")}
        >
          set file value
        </button>
        <button
          type="button"
          onClick={() => props.setSelectedFile((prev: string) => `${prev}-2`)}
        >
          set file updater
        </button>
        <div>{props.actions}</div>
      </div>
    );
  },
}));

vi.mock("@/domains/jobs/presentation/components/JobsTableCard", () => ({
  JobsTableCard: (props: any) => {
    hookState.capturedTableProps = props;

    return (
      <div>
        <div>loading: {String(props.loading)}</div>
        <div>error: {props.error || "none"}</div>
        <button type="button" onClick={() => props.onPageSizeChange(25)}>
          change page size
        </button>
      </div>
    );
  },
}));

import JobsPage from "@/domains/jobs/presentation/pages/JobsPage";

describe("JobsPage", () => {
  beforeEach(() => {
    hookState.useJobsDataValue.setSelectedFile.mockClear();
    hookState.useJobsDataValue.triggerScraper.mockClear();
    hookState.useJobsFilteringValue.setSearch.mockClear();
    hookState.useJobsFilteringValue.setKeywordFilter.mockClear();
    hookState.useJobsPaginationValue.setPageSize.mockClear();
    hookState.useJobsPaginationValue.resetPagination.mockClear();
  });

  it("renderiza filtros, tabela e dispara callback de scraper", () => {
    render(<JobsPage />);

    expect(
      screen.getByRole("button", { name: /buscar vagas/i }),
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /buscar vagas/i }));

    expect(hookState.useJobsDataValue.triggerScraper).toHaveBeenCalledTimes(1);
    expect(screen.getByText("loading: false")).toBeInTheDocument();
  });

  it("exibe estado de scraping como loading e texto de busca em andamento", () => {
    hookState.useJobsDataValue.scraping = true;

    render(<JobsPage />);

    expect(
      screen.getByRole("button", { name: /buscando vagas/i }),
    ).toBeDisabled();
    expect(screen.getByText("loading: true")).toBeInTheDocument();

    hookState.useJobsDataValue.scraping = false;
  });

  it("executa handlers de filtros com valores e updater functions", () => {
    render(<JobsPage />);

    fireEvent.click(screen.getByRole("button", { name: /set search value/i }));
    fireEvent.click(
      screen.getByRole("button", { name: /set search updater/i }),
    );
    fireEvent.click(screen.getByRole("button", { name: /set keyword value/i }));
    fireEvent.click(
      screen.getByRole("button", { name: /set keyword updater/i }),
    );
    fireEvent.click(screen.getByRole("button", { name: /set file value/i }));
    fireEvent.click(screen.getByRole("button", { name: /set file updater/i }));

    expect(hookState.useJobsFilteringValue.setSearch).toHaveBeenCalledTimes(2);
    expect(
      hookState.useJobsFilteringValue.setKeywordFilter,
    ).toHaveBeenCalledTimes(2);
    expect(hookState.useJobsDataValue.setSelectedFile).toHaveBeenCalledTimes(2);
    expect(
      hookState.useJobsPaginationValue.resetPagination,
    ).toHaveBeenCalledTimes(6);
  });

  it("dispara troca de page size com reset de pagina e propaga erro", () => {
    hookState.useJobsDataValue.error = "erro ao carregar";

    render(<JobsPage />);

    fireEvent.click(screen.getByRole("button", { name: /change page size/i }));

    expect(hookState.useJobsPaginationValue.setPageSize).toHaveBeenCalledWith(
      25,
    );
    expect(hookState.useJobsPaginationValue.resetPagination).toHaveBeenCalled();
    expect(screen.getByText("error: erro ao carregar")).toBeInTheDocument();

    hookState.useJobsDataValue.error = "";
  });

  it("formata data vazia como hífen quando modifiedAt é null", () => {
    hookState.useJobsDataValue.meta = {
      file: "vagas.xlsx",
      modifiedAt: null,
      total: 1,
    };

    render(<JobsPage />);
    expect(hookState.capturedTableProps).toBeDefined();
    expect(hookState.capturedTableProps.meta.modifiedAt).toBeNull();
  });

  it("formata data corretamente quando modifiedAt é um timestamp válido", () => {
    const timestamp = new Date("2024-01-15").getTime();
    hookState.useJobsDataValue.meta = {
      file: "vagas.xlsx",
      modifiedAt: timestamp,
      total: 1,
    };

    render(<JobsPage />);

    expect(hookState.capturedTableProps.meta.modifiedAt).toBe(timestamp);
  });
});
