import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { UserEditModal } from "../../../../src/modules/users/components/UserEditModal";
import { userFixture } from "./UserList.test";

describe("UserEditModal", () => {
  it("renders nothing without selected user", () => {
    const { container } = render(
      <UserEditModal
        user={null}
        isSaving={false}
        onClose={vi.fn()}
        onDelete={vi.fn()}
        onSave={vi.fn()}
      />,
    );

    expect(container).toBeEmptyDOMElement();
  });

  it("saves role and block state changes", () => {
    const onSave = vi.fn();
    render(
      <UserEditModal
        user={userFixture}
        isSaving={false}
        onClose={vi.fn()}
        onDelete={vi.fn()}
        onSave={onSave}
      />,
    );

    fireEvent.change(screen.getByLabelText("Perfil de acesso"), {
      target: { value: "support" },
    });
    fireEvent.click(screen.getByLabelText(/bloquear acesso/i));
    fireEvent.click(screen.getByRole("button", { name: /salvar alterações/i }));

    expect(onSave).toHaveBeenCalledWith({
      role: "support",
      isBlocked: true,
    });
  });

  it("requires delete confirmation and handles close", () => {
    const onClose = vi.fn();
    const onDelete = vi.fn();
    render(
      <UserEditModal
        user={userFixture}
        isSaving={false}
        onClose={onClose}
        onDelete={onDelete}
        onSave={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Excluir usuário" }));
    expect(onDelete).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Confirmar exclusão" }));
    expect(onDelete).toHaveBeenCalledWith(userFixture);

    fireEvent.click(screen.getByRole("button", { name: "Cancelar" }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
