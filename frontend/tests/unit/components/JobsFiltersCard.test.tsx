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
    selectedFile: "vagas.xlsx",
    setSelectedFile: vi.fn(),
    files: [{ file: "vagas.xlsx" }],
    meta: { file: "vagas.xlsx", modifiedAt: Date.now(), total: 1 },
    ...overrides,
  };

  render(<JobsFiltersCard {...props} />);

  return props;
}

describe("JobsFiltersCard", () => {
  it("adiciona termo de busca como filtro e permite refresh", () => {
    const onRefresh = vi.fn();
    const props = renderFiltersCard({
      actions: (
        <button type="button" onClick={onRefresh}>
          Atualizar
        </button>
      ),
    });

    fireEvent.change(screen.getByPlaceholderText(/buscar/i), {
      target: { value: "node" },
    });
    fireEvent.click(
      screen.getByRole("button", { name: /adicionar filtro de busca/i }),
    );
    fireEvent.click(screen.getByRole("button", { name: /atualizar/i }));

    expect(props.setSearch).toHaveBeenCalledTimes(1);
    expect(props.setSearch.mock.calls[0][0]("React")).toBe("React, node");
    expect(screen.getByPlaceholderText(/buscar/i)).toHaveValue("");
    expect(onRefresh).toHaveBeenCalledTimes(1);
  });

  it("renderiza badge de arquivo, total e area de filtros", () => {
    renderFiltersCard();

    expect(screen.getAllByText(/vagas\.xlsx/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/1 vagas/i)).toBeInTheDocument();
    expect(screen.getByText(/filtros selecionados/i)).toBeInTheDocument();
    expect(screen.getByText(/use o botão filtrar/i)).toBeInTheDocument();
  });

  it("dispara mudancas nos filtros de keyword e arquivo", () => {
    const props = renderFiltersCard({
      files: [{ file: "vagas.xlsx" }, { file: "historico.xlsx" }],
      meta: { file: "vagas.xlsx", modifiedAt: Date.now(), total: 2 },
    });

    const selects = screen.getAllByRole("combobox");

    fireEvent.change(selects[0], {
      target: { value: "React" },
    });
    fireEvent.change(selects[1], {
      target: { value: "historico.xlsx" },
    });

    expect(props.setKeywordFilter).toHaveBeenCalled();
    expect(props.setSelectedFile).toHaveBeenCalled();
  });

  it("abre o gerenciador e aciona limpar/remover filtros selecionados", () => {
    const props = renderFiltersCard({
      search: "UX/UI Designer",
      keywordFilter: ["React"],
      meta: { file: "vagas.xlsx", modifiedAt: Date.now(), total: 2 },
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
