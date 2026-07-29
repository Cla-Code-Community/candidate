import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ScraperGrid } from "../../../../src/modules/scrapers/components/ScraperGrid/ScraperGrid";

describe("ScraperGrid", () => {
  it("renders empty and active/inactive scraper cards", () => {
    const onToggle = vi.fn();
    const { rerender } = render(
      <ScraperGrid
        scrapers={[]}
        isStarting
        onToggle={onToggle}
        onStartAll={vi.fn()}
        onPauseAll={vi.fn()}
      />,
    );
    expect(screen.getByText("Nenhum scraper retornado pelo backend.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Iniciando..." })).toBeDisabled();

    rerender(
      <ScraperGrid
        scrapers={[
          {
            id: "a",
            name: "Ativo",
            status: "Executando",
            lastRun: "Agora",
            indexedJobs: 1000,
            active: true,
            sla: "Operacional",
          },
          {
            id: "b",
            name: "Inativo",
            status: "Ocioso",
            lastRun: "Nunca",
            indexedJobs: 0,
            active: false,
            sla: "Indisponivel",
          },
        ]}
        isStarting={false}
        onToggle={onToggle}
        onStartAll={vi.fn()}
        onPauseAll={vi.fn()}
      />,
    );

    expect(screen.getByRole("button", { name: "Em execução" })).toBeDisabled();

    fireEvent.click(screen.getByRole("button", { name: "Desativar" }));
    fireEvent.click(screen.getByRole("button", { name: "Ativar" }));

    expect(onToggle).toHaveBeenNthCalledWith(1, "a");
    expect(onToggle).toHaveBeenNthCalledWith(2, "b");
  });
});
