/* eslint-disable @typescript-eslint/no-explicit-any */
import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter, useLocation } from "react-router-dom";
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
  capturedFiltersProps: null as any,
  capturedTableProps: null as any,
}));

vi.mock("@/domains/jobs/application/useJobsData", () => ({
  useJobsData: () => hookState.useJobsDataValue,
}));

vi.mock("@/domains/jobs/application/useJobsFiltering", () => ({
  useJobsFiltering: () => hookState.useJobsFilteringValue,
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
        <button type="button" onClick={() => props.onRemoveFilter("React")}>
          remove filter
        </button>
        <button type="button" onClick={() => props.onClearFilters()}>
          clear filters
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
        <button type="button" onClick={() => props.onPageChange(2)}>
          change page
        </button>
        <button type="button" onClick={() => props.onPageSizeChange(25)}>
          change page size
        </button>
      </div>
    );
  },
}));

function LocationDisplay() {
  const location = useLocation();
  return <div data-testid="location">{location.search}</div>;
}

function renderPage(initialEntry = "/vagas") {
  return render(
    <MemoryRouter initialEntries={[initialEntry]}>
      <JobsPage />
      <LocationDisplay />
    </MemoryRouter>,
  );
}

import JobsPage from "@/domains/jobs/presentation/pages/JobsPage";

describe("JobsPage", () => {
  beforeEach(() => {
    hookState.useJobsDataValue.setSelectedFile.mockClear();
    hookState.useJobsDataValue.triggerScraper.mockClear();
    hookState.useJobsDataValue.scraping = false;
    hookState.useJobsDataValue.error = "";
    hookState.useJobsDataValue.meta = {
      file: "vagas.xlsx",
      modifiedAt: 123,
      total: 1,
    };
    hookState.useJobsFilteringValue.filteredJobs = [
      {
        titulo: "Dev",
        empresa: "ACME",
        local: "BR",
        palavra: "React",
        link: "x",
      },
    ];
    hookState.capturedFiltersProps = null;
    hookState.capturedTableProps = null;
  });

  it("renderiza filtros, tabela e dispara callback de scraper", () => {
    renderPage();

    expect(
      screen.getByRole("button", { name: /buscar vagas/i }),
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /buscar vagas/i }));

    expect(hookState.useJobsDataValue.triggerScraper).toHaveBeenCalledTimes(1);
    expect(screen.getByText("loading: false")).toBeInTheDocument();
  });

  it("exibe estado de scraping como loading e texto de busca em andamento", () => {
    hookState.useJobsDataValue.scraping = true;

    renderPage();

    expect(
      screen.getByRole("button", { name: /buscando vagas/i }),
    ).toBeDisabled();
    expect(screen.getByText("loading: true")).toBeInTheDocument();
  });

  it("inicializa filtros e paginacao a partir da URL", () => {
    renderPage(
      "/vagas?q=frontend&keyword=React&file=vagas.xlsx&page=2&pageSize=25",
    );

    expect(hookState.capturedFiltersProps.search).toBe("frontend");
    expect(hookState.capturedFiltersProps.keywordFilter).toEqual(["React"]);
    expect(hookState.capturedTableProps.currentPage).toBe(1);
    expect(hookState.capturedTableProps.pageSize).toBe(25);
  });

  it("executa handlers atualizando searchParams", () => {
    renderPage("/vagas?q=React&keyword=React&page=3");

    fireEvent.click(screen.getByRole("button", { name: /set search value/i }));
    expect(screen.getByTestId("location")).toHaveTextContent("q=frontend");
    expect(screen.getByTestId("location")).not.toHaveTextContent("page=3");

    fireEvent.click(screen.getByRole("button", { name: /set keyword value/i }));
    expect(screen.getByTestId("location")).toHaveTextContent("keyword=Node");

    fireEvent.click(screen.getByRole("button", { name: /set file value/i }));
    expect(hookState.useJobsDataValue.setSelectedFile).toHaveBeenCalledWith(
      "historico.xlsx",
    );
  });

  it("remove, limpa filtros e atualiza paginacao na URL", () => {
    hookState.useJobsFilteringValue.filteredJobs = Array.from(
      { length: 30 },
      (_, index) => ({
        titulo: `Dev ${index}`,
        empresa: "ACME",
        local: "BR",
        palavra: "React",
        link: String(index),
      }),
    );

    renderPage("/vagas?q=React%2C%20Node&keyword=React&page=3&pageSize=10");

    fireEvent.click(screen.getByRole("button", { name: /remove filter/i }));
    expect(screen.getByTestId("location")).toHaveTextContent("q=Node");
    expect(screen.getByTestId("location")).not.toHaveTextContent("keyword=");

    fireEvent.click(screen.getByRole("button", { name: /^change page$/i }));
    expect(screen.getByTestId("location")).toHaveTextContent("page=2");

    fireEvent.click(screen.getByRole("button", { name: /change page size/i }));
    expect(screen.getByTestId("location")).toHaveTextContent("pageSize=25");
    expect(screen.getByTestId("location")).not.toHaveTextContent("page=2");

    fireEvent.click(screen.getByRole("button", { name: /clear filters/i }));
    expect(screen.getByTestId("location")).not.toHaveTextContent("q=");
    expect(screen.getByTestId("location")).not.toHaveTextContent("keyword=");

    hookState.useJobsFilteringValue.filteredJobs = [
      {
        titulo: "Dev",
        empresa: "ACME",
        local: "BR",
        palavra: "React",
        link: "x",
      },
    ];
  });

  it("propaga erro", () => {
    hookState.useJobsDataValue.error = "erro ao carregar";

    renderPage();

    expect(screen.getByText("error: erro ao carregar")).toBeInTheDocument();
  });

  it("formata data vazia como hifen quando modifiedAt e null", () => {
    hookState.useJobsDataValue.meta = {
      file: "vagas.xlsx",
      modifiedAt: null,
      total: 1,
    };

    renderPage();
    expect(hookState.capturedTableProps.meta.modifiedAt).toBeNull();
    expect(hookState.capturedTableProps.formatDate(null)).toBe("-");
  });

  it("formata data corretamente quando modifiedAt e um timestamp valido", () => {
    const timestamp = new Date("2024-01-15").getTime();
    hookState.useJobsDataValue.meta = {
      file: "vagas.xlsx",
      modifiedAt: timestamp,
      total: 1,
    };

    renderPage();

    expect(hookState.capturedTableProps.meta.modifiedAt).toBe(timestamp);
    expect(hookState.capturedTableProps.formatDate(timestamp)).toBe(
      new Date(timestamp).toLocaleString("pt-BR"),
    );
  });
});
