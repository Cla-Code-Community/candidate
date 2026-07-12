/* eslint-disable @typescript-eslint/no-explicit-any */
import { FeaturesSection } from "@/domains/marketing/presentation/components/FeaturesSection";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
vi.mock("framer-motion", () => ({
  motion: new Proxy(
    {},
    {
      get: (_, tag: string) => {
        return ({ children, ...props }: any) => {
          const Component = tag;
          return <Component {...props}>{children}</Component>;
        };
      },
    }
  ),
}));

describe("FeaturesSection", () => {
  it("deve renderizar o título e a descrição", () => {
    render(<FeaturesSection />);

    expect(
      screen.getByRole("heading", {
        name: /Tudo que você precisa para encontrar o emprego ideal/i,
      })
    ).toBeInTheDocument();

    expect(
      screen.getByText(
        /Nossa plataforma foi construída especificamente para simplificar o mercado de tecnologia global/i
      )
    ).toBeInTheDocument();
  });

  it("deve renderizar todas as funcionalidades", () => {
    render(<FeaturesSection />);

    const features = [
      "Busca Global Automatizada",
      "Filtros por Tecnologia",
      "Atualizações em Tempo Real",
      "Análise com IA",
      "Exportação de Dados",
      "Vagas organizadas",
    ];

    features.forEach((feature) => {
      expect(
        screen.getByRole("heading", { name: feature })
      ).toBeInTheDocument();
    });
  });

  it("deve renderizar todas as descrições das funcionalidades", () => {
    render(<FeaturesSection />);

    expect(
      screen.getByText(/Varremos LinkedIn, Indeed, Glassdoor/i)
    ).toBeInTheDocument();

    expect(
      screen.getByText(/React, Python, Go, AWS/i)
    ).toBeInTheDocument();

    expect(
      screen.getByText(/Nosso scraper roda continuamente/i)
    ).toBeInTheDocument();

    expect(
      screen.getByText(/Inteligência artificial categoriza/i)
    ).toBeInTheDocument();

    expect(
      screen.getByText(/Exporte suas vagas favoritas/i)
    ).toBeInTheDocument();

    expect(
      screen.getByText(/Visualize tendências de mercado/i)
    ).toBeInTheDocument();
  });

  it("deve renderizar exatamente seis cards de funcionalidades", () => {
    const { container } = render(<FeaturesSection />);

    const cards = container.querySelectorAll(".group");

    expect(cards).toHaveLength(6);
  });

  it("deve renderizar a section com id features", () => {
    const { container } = render(<FeaturesSection />);

    expect(container.querySelector("section")).toHaveAttribute(
      "id",
      "features"
    );
  });
});