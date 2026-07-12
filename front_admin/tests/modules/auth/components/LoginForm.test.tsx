import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { LoginForm } from "../../../../src/modules/auth/components/LoginForm";

describe("LoginForm", () => {
  it("submits credentials and toggles password visibility", async () => {
    const onSubmit = vi.fn().mockResolvedValue(true);
    render(<LoginForm onSubmit={onSubmit} isLoading={false} />);

    fireEvent.change(screen.getByLabelText("E-mail Institucional"), {
      target: { value: "admin@example.com" },
    });
    fireEvent.change(screen.getByLabelText("Senha de Acesso"), {
      target: { value: "12345678" },
    });
    fireEvent.click(screen.getByLabelText("Lembre de mim"));

    const password = screen.getByLabelText("Senha de Acesso");
    expect(password).toHaveAttribute("type", "password");
    fireEvent.click(screen.getByTitle("Mostrar Senha"));
    expect(password).toHaveAttribute("type", "text");

    fireEvent.submit(screen.getByRole("button", { name: "Entrar no Painel" }));

    expect(onSubmit).toHaveBeenCalledWith({
      email: "admin@example.com",
      password: "12345678",
      rememberMe: true,
    });
  });

  it("shows loading and error states", () => {
    render(
      <LoginForm
        onSubmit={vi.fn()}
        isLoading
        errorMessage="E-mail ou senha inválidos"
      />,
    );

    expect(screen.getByText("Verificando credenciais...")).toBeInTheDocument();
    expect(screen.getByText("E-mail ou senha inválidos")).toBeInTheDocument();
    expect(screen.getByLabelText("E-mail Institucional")).toBeDisabled();
  });
});
