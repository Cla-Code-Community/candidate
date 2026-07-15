import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { UserList } from "../../../../src/modules/users/components/UserList";
import type { AdminUser } from "../../../../src/modules/users/types/user.types";

export const userFixture: AdminUser = {
  id: "u1",
  name: "Ada Lovelace",
  email: "ada@example.com",
  initials: "AL",
  avatarUrl: null,
  role: "Admin",
  rawRole: "admin",
  isBlocked: false,
  createdAt: "2026-01-01T00:00:00.000Z",
  lastLoginAt: "2026-01-02T00:00:00.000Z",
  username: "ada",
};

describe("UserList", () => {
  it("renders empty state", () => {
    render(<UserList users={[]} onEditUser={vi.fn()} />);

    expect(screen.getByText("Nenhum usuário encontrado")).toBeInTheDocument();
  });

  it("renders users and emits edit events", () => {
    const onEditUser = vi.fn();
    render(
      <UserList
        users={[{ ...userFixture, isBlocked: true, role: "Super Admin" }]}
        onEditUser={onEditUser}
      />,
    );

    expect(screen.getByText("Ada Lovelace")).toBeInTheDocument();
    expect(screen.getByText("Bloqueado")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /editar/i }));

    expect(onEditUser).toHaveBeenCalledWith(
      expect.objectContaining({ id: "u1" }),
    );
  });

  it("renders user avatar image when available", () => {
    render(
      <UserList
        users={[{ ...userFixture, avatarUrl: "https://example.com/ada.png" }]}
        onEditUser={vi.fn()}
      />,
    );

    expect(screen.getByAltText("Foto de Ada Lovelace")).toHaveAttribute(
      "src",
      "https://example.com/ada.png",
    );
  });
});
