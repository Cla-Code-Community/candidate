import { JobsFiltersCard } from "@/domains/jobs/presentation/components/JobsFiltersCard";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/domains/jobs/presentation/components/KeywordsModal", () => ({
  KeywordsModal: () => <div>Gerenciar filtros</div>,
}));

function renderFiltersCard(overrides = {}) {
  const props = {
    search: "",
    setSearch: vi.fn(),
    keywordFilter: [] as string[],
    setKeywordFilter: vi.fn(),
    onRemoveFilter: vi.fn(),
    onClearFilters: vi.fn(),
    keywords: ["React"],
    meta: {
      total: 1,
      hasNext: false,
      hasPrev: false,
      page: 1,
      limit: 5,
      totalPages: 1,
    },
    ...overrides,
  };

  render(<JobsFiltersCard {...props} />);

  return props;
}

describe("JobsFiltersCard", () => {
  it("adiciona termo de busca como filtro", () => {
    const props = renderFiltersCard();

    fireEvent.change(screen.getByPlaceholderText(/buscar/i), {
      target: { value: "node" },
    });
    fireEvent.click(
      screen.getByRole("button", { name: /adicionar filtro de busca/i }),
    );

    expect(props.setSearch).toHaveBeenCalledTimes(1);
    expect(props.setSearch.mock.calls[0][0]("React")).toBe("React, node");
    expect(screen.getByPlaceholderText(/buscar/i)).toHaveValue("");
  });

  it("renderiza total e area de filtros", () => {
    renderFiltersCard();

    expect(screen.getByText(/1 vagas/i)).toBeInTheDocument();
    expect(screen.getByText(/filtros selecionados/i)).toBeInTheDocument();
    expect(screen.getByText(/use o botão filtrar/i)).toBeInTheDocument();
  });

  it("dispara mudancas nos filtros de keyword", () => {
    const props = renderFiltersCard();

    const selects = screen.getAllByRole("combobox");

    fireEvent.change(selects[0], {
      target: { value: "React" },
    });

    expect(props.setKeywordFilter).toHaveBeenCalled();
  });

  it("abre o gerenciador e aciona limpar/remover filtros selecionados", () => {
    const props = renderFiltersCard({
      search: "UX/UI Designer",
      keywordFilter: ["React"],
      meta: {
        total: 2,
        hasNext: false,
        hasPrev: false,
        page: 1,
        limit: 5,
        totalPages: 1,
      },
    });

    fireEvent.click(screen.getByRole("button", { name: /^filtrar$/i }));
    fireEvent.click(screen.getByRole("button", { name: /limpar filtros/i }));
    fireEvent.click(
      screen.getByRole("button", { name: /remover filtro react/i }),
    );

    expect(screen.getByText(/gerenciar filtros/i)).toBeInTheDocument();
    expect(props.onClearFilters).toHaveBeenCalledTimes(1);
    expect(props.onRemoveFilter).toHaveBeenCalledWith("React");
  });
});
