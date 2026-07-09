import { fireEvent, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { permissionsApi } from "../../../src/lib/api/permissions.api";
import { PermissionsPage } from "../../../src/modules/permissions/PermissionsPage";
import { useAuth } from "../../../src/modules/auth/hooks/useAuth";
import { renderWithProviders } from "../../test-utils";

vi.mock("../../../src/lib/api/permissions.api", () => ({
  permissionsApi: {
    list: vi.fn(),
    update: vi.fn(),
  },
}));

vi.mock("../../../src/modules/auth/hooks/useAuth", () => ({
  useAuth: vi.fn(),
}));

const rules = [
  {
    resource: "dashboard",
    action: "read",
    defaultMinRole: "support" as const,
    minRole: "support" as const,
    customized: false,
  },
  {
    resource: "users",
    action: "change_role",
    defaultMinRole: "super_admin" as const,
    minRole: "super_admin" as const,
    customized: false,
  },
];

describe("PermissionsPage", () => {
  beforeEach(() => {
    vi.mocked(useAuth).mockReturnValue({
      isLoggedIn: {
        id: "u1",
        name: "Admin",
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
    vi.mocked(permissionsApi.list).mockResolvedValue({ rules });
    vi.mocked(permissionsApi.update).mockResolvedValue({
      rules: [{ ...rules[0], minRole: "admin" as const, customized: true }, rules[1]],
    });
  });

  it("loads rules, edits mutable roles and saves changes", async () => {
    renderWithProviders(<PermissionsPage />);

    expect(screen.getByText("Carregando regras...")).toBeInTheDocument();
    await screen.findByText("Matriz de Permissões");

    const roleSelect = screen.getByDisplayValue("Suporte");
    fireEvent.change(roleSelect, { target: { value: "admin" } });
    fireEvent.click(screen.getByRole("button", { name: /Salvar 1/ }));

    await waitFor(() =>
      expect(permissionsApi.update).toHaveBeenCalledWith([
        { resource: "dashboard", action: "read", minRole: "admin" },
      ]),
    );
    expect(await screen.findByText("Permissões atualizadas")).toBeInTheDocument();
  });

  it("renders fallback read-only mode when API fails", async () => {
    vi.mocked(permissionsApi.list).mockRejectedValueOnce(new Error("fail"));

    renderWithProviders(<PermissionsPage />);

    expect(
      await screen.findByText(/Não foi possível carregar regras dinâmicas/),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "API indisponível" })).toBeDisabled();
  });

  it("disables save for non super admins", async () => {
    vi.mocked(useAuth).mockReturnValue({
      isLoggedIn: {
        id: "u2",
        name: "Support",
        email: "support@example.com",
        role: "support",
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

    renderWithProviders(<PermissionsPage />);

    await screen.findByText("Modo leitura. Apenas super admins podem alterar regras.");
    expect(screen.getByRole("button", { name: "Salvar" })).toBeDisabled();
  });
});
