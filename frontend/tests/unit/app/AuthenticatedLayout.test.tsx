import { AuthenticatedLayout } from "@/app/AuthenticatedLayout";
import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";

const authMocks = vi.hoisted(() => ({
  logout: vi.fn(async () => {}),
}));

vi.mock("@/domains/auth/application/AuthContext", () => ({
  useAuth: () => ({
    user: { id: "1", name: "Otávio", email: "otavio@example.com" },
    logout: authMocks.logout,
  }),
}));

vi.mock("@/shared/hooks/useTheme", () => ({
  useTheme: () => ({ resolvedTheme: "light", toggleTheme: vi.fn() }),
}));

vi.mock("@/shared/ui/theme-toggle", () => ({
  ThemeToggle: () => <button type="button">Tema</button>,
}));

function renderLayout(initialPath: string) {
  render(
    <MemoryRouter initialEntries={[initialPath]}>
      <Routes>
        <Route element={<AuthenticatedLayout />}>
          <Route path="/home" element={<div>Inicio</div>} />
          <Route path="/vagas" element={<div>Vagas</div>} />
          <Route path="/mentoria" element={<div>Mentoria</div>} />
        </Route>
      </Routes>
    </MemoryRouter>,
  );
}

describe("AuthenticatedLayout", () => {
  it("usa tokens de tema na sidebar", () => {
    renderLayout("/home");

    expect(screen.getByRole("complementary", { name: /menu lateral/i })).toHaveClass(
      "bg-card",
      "text-card-foreground",
      "border-border",
    );
  });

  it.each([
    ["/home", "Início"],
    ["/vagas", "Vagas"],
    ["/mentoria", "Mentoria"],
  ])("marca somente o item da rota %s como ativo", (path, activeLabel) => {
    renderLayout(path);

    for (const label of ["Início", "Vagas", "Mentoria"]) {
      const link = screen.getByRole("link", { name: label });

      if (label === activeLabel) {
        expect(link).toHaveAttribute("aria-current", "page");
      } else {
        expect(link).not.toHaveAttribute("aria-current");
      }
    }

    expect(screen.getByRole("heading", { name: activeLabel })).toBeInTheDocument();
  });
});
