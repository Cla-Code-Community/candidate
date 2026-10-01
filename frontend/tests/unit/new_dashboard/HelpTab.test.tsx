import { HelpTab } from "@/domains/new_dashboard/components/help/HelpTab";
import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

describe("HelpTab", () => {
  it("renders each FAQ question with its corresponding answer", () => {
    render(<HelpTab />);

    expect(
      screen.getByRole("heading", {
        name: "Perguntas Frequentes & Central de Ajuda",
      }),
    ).toBeInTheDocument();

    const questions = [
      {
        title: "Como o Match Score das vagas é calculado?",
        answer: /compara as tecnologias do seu perfil/i,
      },
      {
        title: "O que é a agenda disponível dos mentores?",
        answer: /sincronizados com a agenda interna/i,
      },
      {
        title: "Como posso mudar o meu status de candidatura?",
        answer: /mover as vagas para acompanhar em tempo real/i,
      },
    ];

    expect(screen.getAllByRole("article")).toHaveLength(questions.length);

    for (const question of questions) {
      const article = screen
        .getByRole("heading", { name: question.title })
        .closest("article");

      expect(article).not.toBeNull();
      expect(within(article as HTMLElement).getByText(question.answer)).toBeInTheDocument();
    }
  });
});
