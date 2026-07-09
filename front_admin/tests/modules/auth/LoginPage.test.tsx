import { fireEvent, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { LoginPage } from "../../../src/modules/auth/LoginPage";
import { useAuth } from "../../../src/modules/auth/hooks/useAuth";
import { renderWithProviders } from "../../test-utils";

vi.mock("../../../src/modules/auth/hooks/useAuth", () => ({
  useAuth: vi.fn(),
}));

describe("LoginPage", () => {
  beforeEach(() => {
    vi.mocked(useAuth).mockReturnValue({
      isLoggedIn: null,
      loading: false,
      isLoading: false,
      errorMessage: "",
      login: vi.fn().mockResolvedValue(true),
      logout: vi.fn(),
      hasPermission: vi.fn(),
    });
  });

  it("renders brand content and submits credentials", async () => {
    const login = vi.fn().mockResolvedValue(true);
    vi.mocked(useAuth).mockReturnValue({
      isLoggedIn: null,
      loading: false,
      isLoading: false,
      errorMessage: "",
      login,
      logout: vi.fn(),
      hasPermission: vi.fn(),
    });

    renderWithProviders(<LoginPage />, { withTheme: true });

    expect(screen.getByText(/Gerenciando talentos/)).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("E-mail Institucional"), {
      target: { value: "admin@example.com" },
    });
    fireEvent.change(screen.getByLabelText("Senha de Acesso"), {
      target: { value: "12345678" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Entrar no Painel" }));

    await waitFor(() =>
      expect(login).toHaveBeenCalledWith({
        email: "admin@example.com",
        password: "12345678",
        rememberMe: false,
      }),
    );
  });

  it("shows auth error message", () => {
    vi.mocked(useAuth).mockReturnValue({
      isLoggedIn: null,
      loading: false,
      isLoading: false,
      errorMessage: "E-mail ou senha inválidos",
      login: vi.fn(),
      logout: vi.fn(),
      hasPermission: vi.fn(),
    });

    renderWithProviders(<LoginPage />, { withTheme: true });

    expect(screen.getAllByText("E-mail ou senha inválidos")).toHaveLength(2);
  });
});
