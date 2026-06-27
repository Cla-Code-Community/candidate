import { JobsFiltersCard } from "@/domains/jobs/presentation/components/JobsFiltersCard";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/domains/jobs/presentation/components/KeywordsModal", () => ({
  KeywordsModal: () => <div>Gerenciar filtros</div>,
}));

describe("JobsFiltersCard", () => {
  it("dispara callbacks de filtro e refresh", () => {
    const setSearch = vi.fn();
    const setKeywordFilter = vi.fn();
    const setSelectedFile = vi.fn();
    const onRefresh = vi.fn();

    render(
      <JobsFiltersCard
        search=""
        setSearch={setSearch}
        keywordFilter={[]}
        setKeywordFilter={setKeywordFilter}
        keywords={["React"]}
        selectedFile="vagas.xlsx"
        setSelectedFile={setSelectedFile}
        files={[{ file: "vagas.xlsx" }]}
        meta={{ file: "vagas.xlsx", modifiedAt: Date.now(), total: 1 }}
        actions={
          <button type="button" onClick={onRefresh}>
            Atualizar
          </button>
        }
      />,
    );

    fireEvent.change(screen.getByPlaceholderText(/buscar/i), {
      target: { value: "node" },
    });

    fireEvent.click(screen.getByRole("button", { name: /atualizar/i }));

    expect(setSearch).toHaveBeenCalledWith("node");
    expect(onRefresh).toHaveBeenCalledTimes(1);
  });

  it("renderiza badge de arquivo, total e area de filtros", () => {
    render(
      <JobsFiltersCard
        search=""
        setSearch={vi.fn()}
        keywordFilter={[]}
        setKeywordFilter={vi.fn()}
        keywords={["React"]}
        selectedFile="vagas.xlsx"
        setSelectedFile={vi.fn()}
        files={[{ file: "vagas.xlsx" }]}
        meta={{ file: "vagas.xlsx", modifiedAt: Date.now(), total: 1 }}
      />,
    );

    expect(screen.getAllByText(/vagas\.xlsx/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/1 vagas/i)).toBeInTheDocument();

    expect(
      screen.getByText(/filtros selecionados/i)
    ).toBeInTheDocument();

    expect(
      screen.getByText(/use o botão filtrar/i)
    ).toBeInTheDocument();
  });

  it("dispara mudancas nos filtros de keyword e arquivo", () => {
    const setKeywordFilter = vi.fn();
    const setSelectedFile = vi.fn();

    render(
      <JobsFiltersCard
        search=""
        setSearch={vi.fn()}
        keywordFilter={[]}
        setKeywordFilter={setKeywordFilter}
        keywords={["React"]}
        selectedFile="vagas.xlsx"
        setSelectedFile={setSelectedFile}
        files={[{ file: "vagas.xlsx" }, { file: "historico.xlsx" }]}
        meta={{ file: "vagas.xlsx", modifiedAt: Date.now(), total: 2 }}
      />,
    );

    const selects = screen.getAllByRole("combobox");

    fireEvent.change(selects[0], {
      target: { value: "React" },
    });

    fireEvent.change(selects[1], {
      target: { value: "historico.xlsx" },
    });

    expect(setKeywordFilter).toHaveBeenCalled();
    expect(setSelectedFile).toHaveBeenCalled();
  });

  it("abre o gerenciador ao clicar em filtrar e permite limpar os filtros selecionados", () => {
    const setSearch = vi.fn();
    const setKeywordFilter = vi.fn();

    render(
      <JobsFiltersCard
        search="UX/UI Designer"
        setSearch={setSearch}
        keywordFilter={["React"]}
        setKeywordFilter={setKeywordFilter}
        keywords={["React"]}
        selectedFile="vagas.xlsx"
        setSelectedFile={vi.fn()}
        files={[{ file: "vagas.xlsx" }]}
        meta={{ file: "vagas.xlsx", modifiedAt: Date.now(), total: 2 }}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /^filtrar$/i }));

    expect(
      screen.getByText(/gerenciar filtros/i)
    ).toBeInTheDocument();

    fireEvent.click(
      screen.getByRole("button", { name: /limpar filtros/i })
    );

    expect(screen.getAllByText(/react/i).length).toBeGreaterThan(0);
    expect(setSearch).toHaveBeenCalledWith("");
    expect(setKeywordFilter).toHaveBeenCalledWith([]);
  });
});