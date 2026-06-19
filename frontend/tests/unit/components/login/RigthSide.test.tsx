/* eslint-disable @typescript-eslint/no-explicit-any */
import "@testing-library/jest-dom/vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mockLogin = vi.fn();
const mockGetLinkedinAuthUrl = vi.fn();

vi.mock("@/services/authService", () => ({
  login: (...args: any[]) => mockLogin(...args),
  getLinkedinAuthUrl: (...args: any[]) => mockGetLinkedinAuthUrl(...args),
}));

vi.mock("@unpic/react", () => ({
  Image: (props: any) => <img {...props} alt={props.alt} />,
}));

vi.mock("framer-motion", () => ({
  motion: {
    div: ({ children, ...props }: any) => <div {...props}>{children}</div>,
    button: ({ children, ...props }: any) => <button {...props}>{children}</button>,
  },
}));

vi.mock("react-router-dom", () => ({
  useNavigate: () => vi.fn(),
}));

import RigthSide from "@/components/login/RigthSide";

describe("RigthSide", () => {
  const originalLocation = window.location;

  beforeEach(() => {
    mockLogin.mockReset();
    mockGetLinkedinAuthUrl.mockReset();
    Object.defineProperty(window, "location", {
      configurable: true,
      value: { href: "" },
    });
    localStorage.clear();
  });

  afterEach(() => {
    Object.defineProperty(window, "location", {
      configurable: true,
      value: originalLocation,
    });
  });

  it("renderiza formulário corretamente", () => {
    render(<RigthSide />);
    expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/senha/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /entrar/i })).toBeInTheDocument();
    expect(screen.getByText(/cadastre-se/i)).toBeInTheDocument();
    expect(screen.getByText(/ou faça login com/i)).toBeInTheDocument();
  });

  it("alterna visibilidade da senha ao clicar no botão", () => {
    render(<RigthSide />);
    const passwordInput = screen.getByLabelText(/senha/i) as HTMLInputElement;
    expect(passwordInput.type).toBe("password");

    const toggleButtons = screen.getAllByRole("button", { name: "" });
    const eyeButton = toggleButtons.find(btn => btn.querySelector('svg'));
    if (eyeButton) fireEvent.click(eyeButton);

    expect(screen.getByLabelText(/senha/i)).toHaveAttribute("type", "text");
  });

  it("mostra erro de email obrigatório ao submeter vazio", async () => {
    render(<RigthSide />);
    fireEvent.click(screen.getByRole("button", { name: /entrar/i }));
    expect(await screen.findByText(/campo de e-mail.*obrigatório/i)).toBeInTheDocument();
    expect(screen.getByText(/campo de senha.*obrigatório/i)).toBeInTheDocument();
  });

  it("valida tamanho mínimo da senha", async () => {
    render(<RigthSide />);
    fireEvent.change(screen.getByLabelText(/email/i), { target: { value: "teste@email.com" } });
    fireEvent.change(screen.getByLabelText(/senha/i), { target: { value: "123" } });
    fireEvent.click(screen.getByRole("button", { name: /entrar/i }));
    expect(await screen.findByText(/pelo menos 6 caracteres/i)).toBeInTheDocument();
  });

  it("envia formulário válido e redireciona após login", async () => {
    mockLogin.mockResolvedValueOnce({ token: "fake-token-123", user: { id: 1, email: "teste@email.com" } });
    render(<RigthSide />);
    fireEvent.change(screen.getByLabelText(/email/i), { target: { value: "teste@email.com" } });
    fireEvent.change(screen.getByLabelText(/senha/i), { target: { value: "123456" } });
    fireEvent.click(screen.getByRole("button", { name: /entrar/i }));
    await waitFor(() => {
      expect(mockLogin).toHaveBeenCalledWith({
        email: "teste@email.com",
        password: "123456",
      });
    });
    expect(localStorage.getItem("token")).toBe("fake-token-123");
    expect(window.location.href).toBe("/dashboard");
  });

  it("exibe erro quando API retorna erro", async () => {
    mockLogin.mockRejectedValueOnce(new Error("Credenciais inválidas"));
    render(<RigthSide />);
    fireEvent.change(screen.getByLabelText(/email/i), { target: { value: "teste@email.com" } });
    fireEvent.change(screen.getByLabelText(/senha/i), { target: { value: "senhaerrada" } });
    fireEvent.click(screen.getByRole("button", { name: /entrar/i }));
    expect(await screen.findByText(/Credenciais inválidas/i)).toBeInTheDocument();
  });

  it("exibe erro genérico quando API retorna erro sem mensagem", async () => {
    mockLogin.mockRejectedValueOnce(new Error(""));
    render(<RigthSide />);
    fireEvent.change(screen.getByLabelText(/email/i), { target: { value: "teste@email.com" } });
    fireEvent.change(screen.getByLabelText(/senha/i), { target: { value: "senhaerrada" } });
    fireEvent.click(screen.getByRole("button", { name: /entrar/i }));
    expect(await screen.findByText(/Erro ao fazer login. Verifique suas credenciais./i)).toBeInTheDocument();
  });

  it("mostra loading durante requisição", async () => {
    mockLogin.mockImplementation(() => new Promise(resolve => setTimeout(resolve, 200)));
    render(<RigthSide />);
    fireEvent.change(screen.getByLabelText(/email/i), { target: { value: "teste@email.com" } });
    fireEvent.change(screen.getByLabelText(/senha/i), { target: { value: "123456" } });
    fireEvent.click(screen.getByRole("button", { name: /entrar/i }));
    expect(await screen.findByRole("button", { name: /entrando\.\.\./i })).toBeDisabled();
  });

  it("desabilita inputs durante loading", async () => {
    mockLogin.mockImplementation(() => new Promise(resolve => setTimeout(resolve, 200)));
    render(<RigthSide />);
    const emailInput = screen.getByLabelText(/email/i);
    const passwordInput = screen.getByLabelText(/senha/i);
    fireEvent.change(emailInput, { target: { value: "teste@email.com" } });
    fireEvent.change(passwordInput, { target: { value: "123456" } });
    fireEvent.click(screen.getByRole("button", { name: /entrar/i }));
    await waitFor(() => {
      expect(emailInput).toBeDisabled();
      expect(passwordInput).toBeDisabled();
    });
  });

  it("não envia formulário quando validação falha", async () => {
    render(<RigthSide />);
    fireEvent.click(screen.getByRole("button", { name: /entrar/i }));
    await waitFor(() => {
      expect(mockLogin).not.toHaveBeenCalled();
    });
  });

  it("checkbox de lembrete está presente", () => {
    render(<RigthSide />);
    const checkbox = screen.getByRole("checkbox");
    expect(checkbox).toBeInTheDocument();
    expect(checkbox).toBeChecked();
  });

  it("botão de esqueceu a senha está presente", () => {
    render(<RigthSide />);
    expect(screen.getByText(/esqueceu a senha/i)).toBeInTheDocument();
  });

  it("redireciona para LinkedIn OAuth ao clicar no botao LinkedIn", async () => {
    mockGetLinkedinAuthUrl.mockResolvedValueOnce(
      "https://www.linkedin.com/oauth/v2/authorization?state=abc"
    );

    render(<RigthSide />);

    const linkedinButton = screen.getByRole("button", { name: /linkedin/i });
    fireEvent.click(linkedinButton);

    await waitFor(() => {
      expect(mockGetLinkedinAuthUrl).toHaveBeenCalled();
      expect(window.location.href).toBe(
        "https://www.linkedin.com/oauth/v2/authorization?state=abc"
      );
    });
  });
});