import { fireEvent, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { SettingsPage } from "../../../src/modules/settings/SettingsPage";
import { useAuth } from "../../../src/modules/auth/hooks/useAuth";
import { renderWithProviders } from "../../test-utils";

vi.mock("../../../src/modules/auth/hooks/useAuth", () => ({
  useAuth: vi.fn(),
}));

describe("SettingsPage", () => {
  beforeEach(() => {
    vi.mocked(useAuth).mockReturnValue({
      isLoggedIn: {
        id: "u1",
        name: "Admin User",
        email: "admin@example.com",
        role: "super_admin",
        avatar: "",
        permissions: {},
      },
      loading: false,
      isLoading: false,
      errorMessage: "",
      login: vi.fn(),
      logout: vi.fn(),
      hasPermission: vi.fn(),
    });
  });

  it("renders and persists local settings", () => {
    renderWithProviders(<SettingsPage />, { withTheme: true });

    fireEvent.click(screen.getByRole("button", { name: "Compacta" }));
    fireEvent.change(screen.getByLabelText(/auto-refresh/i), {
      target: { value: "30" },
    });
    fireEvent.change(screen.getByLabelText("Janela padrão"), {
      target: { value: "1h" },
    });

    expect(screen.getByText("Admin User")).toBeInTheDocument();
    expect(window.localStorage.getItem("candidate_admin_settings")).toContain(
      "\"defaultRange\":\"1h\"",
    );

    fireEvent.click(screen.getByRole("button", { name: "Restaurar preferências" }));
    expect(window.localStorage.getItem("candidate_admin_settings")).toContain(
      "\"defaultRange\":\"24h\"",
    );
  });

  it("falls back from corrupt settings and empty session", () => {
    window.localStorage.setItem("candidate_admin_settings", "{bad json");
    vi.mocked(useAuth).mockReturnValue({
      isLoggedIn: null,
      loading: false,
      isLoading: false,
      errorMessage: "",
      login: vi.fn(),
      logout: vi.fn(),
      hasPermission: vi.fn(),
    });

    renderWithProviders(<SettingsPage />, { withTheme: true });

    expect(screen.getByText("Sessão não carregada")).toBeInTheDocument();
    expect(screen.getAllByText("-")).toHaveLength(2);
    expect(screen.getByText(/Auto-refresh: 15s/)).toBeInTheDocument();
  });
});
