import { fireEvent, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AdminPlaceholder } from "../../src/app/AdminPlaceholder";
import { Forbidden } from "../../src/app/Forbidden";
import { NotFound } from "../../src/app/NotFound";
import { AppProviders } from "../../src/components/Providers/AppProviders";
import { useAuth } from "../../src/modules/auth/hooks/useAuth";
import { renderWithProviders } from "../test-utils";

vi.mock("../../src/modules/auth/hooks/useAuth", () => ({
  useAuth: vi.fn(),
}));

describe("standalone app components", () => {
  beforeEach(() => {
    vi.mocked(useAuth).mockReturnValue({
      isLoggedIn: null,
      loading: false,
      isLoading: false,
      errorMessage: "",
      login: vi.fn(),
      logout: vi.fn().mockResolvedValue(undefined),
      hasPermission: vi.fn(),
    });
  });

  it("renders placeholder and not found", () => {
    renderWithProviders(
      <>
        <AdminPlaceholder section="Relatórios" />
        <NotFound />
      </>,
    );

    expect(screen.getByText("Relatórios")).toBeInTheDocument();
    expect(screen.getByText("Página não encontrada")).toBeInTheDocument();
  });

  it("logs out from forbidden page", () => {
    const logout = vi.fn().mockResolvedValue(undefined);
    vi.mocked(useAuth).mockReturnValue({
      isLoggedIn: null,
      loading: false,
      isLoading: false,
      errorMessage: "",
      login: vi.fn(),
      logout,
      hasPermission: vi.fn(),
    });

    renderWithProviders(<Forbidden />);
    fireEvent.click(
      screen.getByRole("button", { name: "Sair e voltar a página principal" }),
    );

    expect(logout).toHaveBeenCalledTimes(1);
  });

  it("wraps children in app providers", () => {
    renderWithProviders(
      <AppProviders>
        <span>filho</span>
      </AppProviders>,
      { withNotifications: false, withTheme: false },
    );

    expect(screen.getByText("filho")).toBeInTheDocument();
  });
});
