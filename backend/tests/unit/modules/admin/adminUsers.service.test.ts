import { beforeEach, describe, expect, it, vi } from "vitest";
import { AdminUsersService } from "../../../../src/modules/admin/users/adminUsers.service";

const baseUser = {
  id: "user-1",
  email: "user@example.com",
  username: "user",
  role: "user",
  isBlocked: false,
};

describe("AdminUsersService", () => {
  const repository = {
    findMany: vi.fn(),
    findById: vi.fn(),
    setBlocked: vi.fn(),
    changeRole: vi.fn(),
    resetPassword: vi.fn(),
    delete: vi.fn(),
  };

  const service = new AdminUsersService(repository as any);

  beforeEach(() => {
    vi.clearAllMocks();
    repository.findMany.mockResolvedValue({ data: [], total: 0, limit: 50, offset: 0 });
    repository.findById.mockResolvedValue(baseUser);
    repository.setBlocked.mockResolvedValue(baseUser);
    repository.changeRole.mockResolvedValue({ ...baseUser, role: "admin" });
    repository.resetPassword.mockResolvedValue(undefined);
    repository.delete.mockResolvedValue(baseUser);
  });

  it("delegates listUsers to repository", async () => {
    const filters = { search: "Hudson", limit: 10, offset: 0 };

    const result = await service.listUsers(filters);

    expect(repository.findMany).toHaveBeenCalledWith(filters);
    expect(result.total).toBe(0);
  });

  it("returns user by id", async () => {
    await expect(service.getUserById("user-1")).resolves.toEqual(baseUser);
  });

  it("throws when user is not found", async () => {
    repository.findById.mockResolvedValueOnce(null);

    await expect(service.getUserById("missing")).rejects.toThrow(
      "Usuário não encontrado",
    );
  });

  it("blocks and unblocks users", async () => {
    await service.blockUser("user-1");
    expect(repository.setBlocked).toHaveBeenCalledWith("user-1", true);

    repository.findById.mockResolvedValueOnce({ ...baseUser, isBlocked: true });
    await service.unblockUser("user-1");
    expect(repository.setBlocked).toHaveBeenCalledWith("user-1", false);
  });

  it("rejects duplicated block state changes", async () => {
    repository.findById.mockResolvedValueOnce({ ...baseUser, isBlocked: true });
    await expect(service.blockUser("user-1")).rejects.toThrow(
      "Usuário já está bloqueado",
    );

    repository.findById.mockResolvedValueOnce({ ...baseUser, isBlocked: false });
    await expect(service.unblockUser("user-1")).rejects.toThrow(
      "Usuário não está bloqueado",
    );
  });

  it("rejects block and unblock when user lookup or update fails", async () => {
    repository.findById.mockResolvedValueOnce(null);
    await expect(service.blockUser("missing")).rejects.toThrow(
      "Usuário não encontrado",
    );

    repository.setBlocked.mockResolvedValueOnce(null);
    await expect(service.blockUser("user-1")).rejects.toThrow(
      "Falha ao bloquear usuário",
    );

    repository.findById.mockResolvedValueOnce(null);
    await expect(service.unblockUser("missing")).rejects.toThrow(
      "Usuário não encontrado",
    );

    repository.findById.mockResolvedValueOnce({ ...baseUser, isBlocked: true });
    repository.setBlocked.mockResolvedValueOnce(null);
    await expect(service.unblockUser("user-1")).rejects.toThrow(
      "Falha ao desbloquear usuário",
    );
  });

  it("changes role and rejects same role", async () => {
    await service.changeRole({ userId: "user-1", newRole: "admin" });
    expect(repository.changeRole).toHaveBeenCalledWith({
      userId: "user-1",
      newRole: "admin",
    });

    repository.findById.mockResolvedValueOnce({ ...baseUser, role: "admin" });
    await expect(
      service.changeRole({ userId: "user-1", newRole: "admin" }),
    ).rejects.toThrow("Usuário já possui esta role");
  });

  it("rejects change role when user lookup or update fails", async () => {
    repository.findById.mockResolvedValueOnce(null);
    await expect(
      service.changeRole({ userId: "missing", newRole: "admin" }),
    ).rejects.toThrow("Usuário não encontrado");

    repository.changeRole.mockResolvedValueOnce(null);
    await expect(
      service.changeRole({ userId: "user-1", newRole: "admin" }),
    ).rejects.toThrow("Falha ao alterar role");
  });

  it("resets password after user lookup", async () => {
    await service.resetPassword({
      userId: "user-1",
      newPassword: "Senha@123",
    });

    expect(repository.resetPassword).toHaveBeenCalledWith({
      userId: "user-1",
      newPassword: "Senha@123",
    });
  });

  it("rejects password reset when user is missing", async () => {
    repository.findById.mockResolvedValueOnce(null);

    await expect(
      service.resetPassword({
        userId: "missing",
        newPassword: "Senha@123",
      }),
    ).rejects.toThrow("Usuário não encontrado");
  });

  it("deletes user and handles delete failures", async () => {
    await expect(service.deleteUser("user-1")).resolves.toEqual(baseUser);

    repository.findById.mockResolvedValueOnce(null);
    await expect(service.deleteUser("missing")).rejects.toThrow(
      "Usuário não encontrado",
    );

    repository.delete.mockResolvedValueOnce(null);
    await expect(service.deleteUser("user-1")).rejects.toThrow(
      "Falha ao deletar usuário",
    );
  });
});
