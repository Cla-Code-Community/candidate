import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";
import { Footer } from "../../../src/domains/marketing/presentation/components/Footer";

describe("Footer", () => {
  function renderFooter() {
    return render(
      <MemoryRouter>
        <Footer />
      </MemoryRouter>,
    );
  }

  it("não exibe o link inativo de Contato", () => {
    renderFooter();

    expect(screen.queryByRole("link", { name: "Contato" })).toBeNull();
  });

  it("mantém os demais links da seção Legal", () => {
    renderFooter();

    expect(screen.getByRole("link", { name: "Termos de Uso" })).toHaveAttribute(
      "href",
      "/termos-de-uso",
    );
    expect(screen.getByRole("link", { name: "Privacidade" })).toHaveAttribute(
      "href",
      "/politica-de-privacidade",
    );
  });

  it("direciona o ícone do GitHub para o repositório do projeto", () => {
    renderFooter();

    expect(
      screen.getByRole("link", { name: /repositório do projeto no github/i }),
    ).toMatchObject({
      href: "https://github.com/Cla-Code-Community/candidate",
      target: "_blank",
      rel: "noopener noreferrer",
    });
  });
});
