import { JobsHeaderCard } from "@/domains/jobs/presentation/components/JobsHeaderCard";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

describe("JobsHeaderCard", () => {
  it("renderiza logo acessível e descrição", () => {
    render(<JobsHeaderCard />);

    expect(screen.getByAltText("Painel de Vagas")).toBeInTheDocument();

    expect(
      screen.getByText(/leitura automática dos arquivos.*xlsx gerados em output/i)
    ).toBeInTheDocument();
  });

  it("renderiza o título do painel", () => {
    render(<JobsHeaderCard />);

    expect(screen.getByRole("heading", { name: /painel de vagas/i })).toBeInTheDocument();
  });
});
