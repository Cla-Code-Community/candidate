/* eslint-disable @typescript-eslint/no-explicit-any */
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

const themeState = vi.hoisted(() => ({
  resolvedTheme: "light",
  toggleTheme: vi.fn(),
}));

vi.mock("@/hooks/useTheme", () => ({
  useTheme: () => ({
    resolvedTheme: themeState.resolvedTheme,
    toggleTheme: themeState.toggleTheme,
  }),
}));

import { Navbar } from "@/components/landing/Navbar";

describe("Navbar", () => {
  beforeEach(() => {
    themeState.resolvedTheme = "light";
    themeState.toggleTheme.mockClear();
    document.body.innerHTML = "";

    ["features", "time", "how-it-works", "status"].forEach((id) => {
      const section = document.createElement("section");
      section.id = id;
      section.scrollIntoView = vi.fn();
      document.body.appendChild(section);
    });
  });

  it("renderiza links principais e aciona troca de tema", () => {
    render(
      <MemoryRouter>
        <Navbar />
      </MemoryRouter>,
    );

    expect(screen.getAllByText(/funcionalidades/i).length).toBeGreaterThan(0);
    expect(screen.getByRole("link", { name: /realizar o login/i })).toHaveAttribute("href", "/login");

    fireEvent.click(screen.getAllByLabelText(/ativar tema escuro/i)[0]);
    expect(themeState.toggleTheme).toHaveBeenCalledTimes(1);
  });

  it("abre menu mobile e navega para seção ao clicar no link", () => {
    render(
      <MemoryRouter>
        <Navbar />
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByRole("button", { name: /abrir menu/i }));

    const mobileFeatureLink = screen.getAllByRole("link", { name: /funcionalidades/i })[1];
    fireEvent.click(mobileFeatureLink);

    const featuresSection = document.getElementById("features") as any;
    expect(featuresSection.scrollIntoView).toHaveBeenCalled();
    expect(document.querySelector(".dynamic-mobile-menu")).not.toBeInTheDocument();
  });

  it("aplica classe dark e estilo de navbar após scroll", () => {
    themeState.resolvedTheme = "dark";

    render(
      <MemoryRouter>
        <Navbar />
      </MemoryRouter>,
    );

    Object.defineProperty(window, "scrollY", { configurable: true, value: 50 });
    fireEvent.scroll(window);

    expect(document.documentElement.classList.contains("dark")).toBe(true);
    expect(document.querySelector("nav")?.className).toContain("bg-white/80");
  });

  it("remove active section quando scrollY < 100", async () => {
    render(
      <MemoryRouter>
        <Navbar />
      </MemoryRouter>,
    );

    await waitFor(() => {
      Object.defineProperty(window, "scrollY", { configurable: true, value: 50 });
      fireEvent.scroll(window);
    });

    // Quando scrollY < 100, activeSection deve ser vazio
    const featuresLink = screen.getAllByRole("link", { name: /funcionalidades/i })[0];
    expect(featuresLink.className).not.toContain("ring-");
  });

  it("atualiza active section quando seção fica visível com scrollY > 100", async () => {
    render(
      <MemoryRouter>
        <Navbar />
      </MemoryRouter>,
    );

    await waitFor(() => {
      Object.defineProperty(window, "scrollY", { configurable: true, value: 150 });
      fireEvent.scroll(window);
    });
  });

  it("retorna quando elemento nao existe ao clicar em link", () => {
    render(
          <MemoryRouter>
              <Navbar />
          </MemoryRouter>
      );

    const featureSection = document.getElementById("features");
    if (featureSection) {
      featureSection.remove();
    }

    const featureLink = screen.getAllByRole("link", { name: /funcionalidades/i })[0];
    fireEvent.click(featureLink);

    expect(document.querySelector(".dynamic-mobile-menu")).not.toBeInTheDocument();
  });
});
