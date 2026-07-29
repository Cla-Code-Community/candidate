import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Footer } from "../../../src/domains/marketing/presentation/components/Footer";

describe("Footer", () => {
  it("não exibe o link inativo de Contato", () => {
    render(<Footer />);

    expect(screen.queryByRole("link", { name: "Contato" })).toBeNull();
  });

  it("mantém os demais links da seção Legal", () => {
    render(<Footer />);

    expect(
      screen.getByRole("link", { name: "Termos de Uso" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Privacidade" }),
    ).toBeInTheDocument();
  });

  it("direciona o ícone do GitHub para o repositório do projeto", () => {
    render(<Footer />);

    expect(
      screen.getByRole("link", { name: /repositório do projeto no github/i }),
    ).toMatchObject({
      href: "https://github.com/Cla-Code-Community/candidate",
      target: "_blank",
      rel: "noopener noreferrer",
    });
  });
});
