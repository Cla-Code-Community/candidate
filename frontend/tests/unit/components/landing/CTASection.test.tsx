/* eslint-disable @typescript-eslint/no-explicit-any */
import { CTASection } from "@/domains/marketing/presentation/components/CTASection";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
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

describe("CTASection", () => {
  it("deve renderizar o título principal", () => {
    render(
      <MemoryRouter>
        <CTASection />
      </MemoryRouter>
    );

    expect(
      screen.getByText(/Pronto para transformar sua/i)
    ).toBeInTheDocument();

    expect(
      screen.getByText(/busca por vagas/i)
    ).toBeInTheDocument();
  });

  it("deve renderizar a descrição", () => {
    render(
      <MemoryRouter>
        <CTASection />
      </MemoryRouter>
    );

    expect(
      screen.getByText(/Junte-se a centenas de desenvolvedores/i)
    ).toBeInTheDocument();

    expect(
      screen.getByText(/Cand/i)
    ).toBeInTheDocument();
  });

  it("deve possuir um link para login", () => {
    render(
      <MemoryRouter>
        <CTASection />
      </MemoryRouter>
    );

    const loginLink = screen.getByRole("link", {
      name: /Acessar vagas/i,
    });

    expect(loginLink).toHaveAttribute("href", "/login");
  });

  it("deve possuir um link para a seção de funcionalidades", () => {
    render(
      <MemoryRouter>
        <CTASection />
      </MemoryRouter>
    );

    const featuresLink = screen.getByRole("link", {
      name: /Explorar funcionalidades/i,
    });

    expect(featuresLink).toHaveAttribute("href", "#features");
  });

  it("deve renderizar a section com o id correto", () => {
    const { container } = render(
      <MemoryRouter>
        <CTASection />
      </MemoryRouter>
    );

    const section = container.querySelector("section");

    expect(section).toHaveAttribute("id", "status");
  });
});