import { fireEvent, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { adminUsersApi } from "../../../src/lib/api/users.api";
import { UsersPage } from "../../../src/modules/users/UsersPage";
import { renderWithProviders } from "../../test-utils";

vi.mock("../../../src/lib/api/users.api", () => ({
  adminUsersApi: {
    list: vi.fn(),
    block: vi.fn(),
    unblock: vi.fn(),
    changeRole: vi.fn(),
    delete: vi.fn(),
  },
}));

const backendUsers = [
  {
    id: "00000000-0000-4000-8000-000000000001",
    firstName: null,
    lastName: null,
    displayName: "Ada Lovelace",
    username: "ada",
    email: "ada@example.com",
    avatarUrl: null,
    role: "admin" as const,
    isBlocked: false,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    lastLoginAt: "2026-01-02T00:00:00.000Z",
  },
  {
    id: "00000000-0000-4000-8000-000000000002",
    firstName: null,
    lastName: null,
    displayName: null,
    username: "root.user",
    email: "root@example.com",
    avatarUrl: null,
    role: "super_admin" as const,
    isBlocked: true,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    lastLoginAt: null,
  },
];

const manyUsers = Array.from({ length: 12 }, (_, index) => ({
  ...backendUsers[index % 2],
  id: `00000000-0000-4000-8000-${String(index + 10).padStart(12, "0")}`,
  displayName: `User ${index + 1}`,
  username: `user${index + 1}`,
  email: `user${index + 1}@example.com`,
  role: index % 2 === 0 ? ("admin" as const) : ("support" as const),
  isBlocked: index % 3 === 0,
}));

describe("UsersPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(adminUsersApi.list).mockResolvedValue({
      data: backendUsers,
      total: 2,
      limit: 50,
      offset: 0,
    });
    vi.mocked(adminUsersApi.changeRole).mockResolvedValue({
      user: { ...backendUsers[0], role: "support" },
    });
    vi.mocked(adminUsersApi.block).mockResolvedValue({
      user: { ...backendUsers[0], isBlocked: true },
    });
    vi.mocked(adminUsersApi.unblock).mockResolvedValue({
      user: { ...backendUsers[1], isBlocked: false },
    });
    vi.mocked(adminUsersApi.delete).mockResolvedValue({
      ok: true,
      user: backendUsers[0],
    });
  });

  it("loads users and filters without effect-driven pagination", async () => {
    renderWithProviders(<UsersPage />);

    expect(screen.getByText("Carregando usuários...")).toBeInTheDocument();
    await screen.findByText("Ada Lovelace");
    expect(screen.getByText("root@example.com")).toBeInTheDocument();

    fireEvent.change(screen.getByPlaceholderText("Buscar por nome, email ou username"), {
      target: { value: "ada" },
    });
    expect(screen.queryByText("root@example.com")).not.toBeInTheDocument();

    fireEvent.change(screen.getByDisplayValue("Todas as roles"), {
      target: { value: "support" },
    });
    expect(screen.getByText("Nenhum usuário encontrado")).toBeInTheDocument();
  });

  it("edits role/status and deletes users", async () => {
    renderWithProviders(<UsersPage />);

    await screen.findByText("Ada Lovelace");
    fireEvent.click(screen.getAllByRole("button", { name: /editar/i })[0]);
    fireEvent.change(screen.getByLabelText("Perfil de acesso"), {
      target: { value: "support" },
    });
    fireEvent.click(screen.getByLabelText(/bloquear acesso/i));
    fireEvent.click(screen.getByRole("button", { name: /salvar alterações/i }));

    await waitFor(() =>
      expect(adminUsersApi.changeRole).toHaveBeenCalledWith(
        "00000000-0000-4000-8000-000000000001",
        "support",
      ),
    );
    expect(adminUsersApi.block).toHaveBeenCalledWith(
      "00000000-0000-4000-8000-000000000001",
    );

    await screen.findByText("Usuário atualizado");

    fireEvent.click(screen.getAllByRole("button", { name: /editar/i })[0]);
    fireEvent.click(screen.getByRole("button", { name: "Excluir usuário" }));
    fireEvent.click(screen.getByRole("button", { name: "Confirmar exclusão" }));

    await waitFor(() =>
      expect(adminUsersApi.delete).toHaveBeenCalledWith(
        "00000000-0000-4000-8000-000000000001",
      ),
    );
  });

  it("shows a load error", async () => {
    vi.mocked(adminUsersApi.list).mockRejectedValueOnce(new Error("fail"));

    renderWithProviders(<UsersPage />);

    expect(
      await screen.findByText("Nao foi possivel carregar os usuarios."),
    ).toBeInTheDocument();
  });

  it("paginates users and filters blocked accounts", async () => {
    vi.mocked(adminUsersApi.list).mockResolvedValueOnce({
      data: manyUsers,
      total: manyUsers.length,
      limit: 50,
      offset: 0,
    });

    renderWithProviders(<UsersPage />);

    await screen.findByText("User 1");
    expect(screen.queryByText("User 11")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Próxima página" }));
    expect(screen.getByText("User 11")).toBeInTheDocument();

    fireEvent.change(screen.getByDisplayValue("Todos os status"), {
      target: { value: "blocked" },
    });
    expect(screen.getAllByText("Bloqueado").length).toBeGreaterThan(0);
    expect(screen.getByText(/Exibindo 1-/)).toBeInTheDocument();
  });

  it("unblocks a selected blocked user without changing role", async () => {
    renderWithProviders(<UsersPage />);

    await screen.findByText("root@example.com");
    fireEvent.click(screen.getAllByRole("button", { name: /editar/i })[1]);
    fireEvent.click(screen.getByLabelText(/bloquear acesso/i));
    fireEvent.click(screen.getByRole("button", { name: /salvar alterações/i }));

    await waitFor(() =>
      expect(adminUsersApi.unblock).toHaveBeenCalledWith(
        "00000000-0000-4000-8000-000000000002",
      ),
    );
    expect(adminUsersApi.changeRole).not.toHaveBeenCalled();
  });
});
