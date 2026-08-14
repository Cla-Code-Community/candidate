import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ScraperGrid } from "../../../../src/modules/scrapers/components/ScraperGrid/ScraperGrid";

describe("ScraperGrid", () => {
  it("renders empty and active/inactive scraper cards", () => {
    const onToggle = vi.fn();
    const { rerender } = render(
      <ScraperGrid
        scrapers={[]}
        startingScraperId="a"
        onToggle={onToggle}
      />,
    );
    expect(screen.getByText("Nenhum scraper retornado pelo backend.")).toBeInTheDocument();
    expect(screen.getByText("Rode cada scraper pelo card")).toBeInTheDocument();

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
        startingScraperId={null}
        onToggle={onToggle}
      />,
    );

    expect(screen.getByRole("button", { name: "Rodando" })).toBeDisabled();

    fireEvent.click(screen.getByRole("button", { name: "Run" }));

    expect(onToggle).toHaveBeenCalledWith("b");
  });
});
