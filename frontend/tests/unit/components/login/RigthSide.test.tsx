/* eslint-disable @typescript-eslint/no-explicit-any */
import "@testing-library/jest-dom/vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mockLogin = vi.fn();
const mockGetGoogleAuthUrl = vi.fn();
const mockGetGithubAuthUrl = vi.fn();
const mockGetLinkedinAuthUrl = vi.fn();
const mockNavigate = vi.fn();

vi.mock("@/domains/auth/infrastructure/authApi", () => ({
  getGoogleAuthUrl: (...args: any[]) => mockGetGoogleAuthUrl(...args),
  getGithubAuthUrl: (...args: any[]) => mockGetGithubAuthUrl(...args),
  getLinkedinAuthUrl: (...args: any[]) => mockGetLinkedinAuthUrl(...args),
}));

vi.mock("@/domains/auth/application/AuthContext", () => ({
  useAuth: () => ({
    login: (...args: any[]) => mockLogin(...args),
  }),
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
  useNavigate: () => mockNavigate,
}));

import RigthSide from "@/domains/auth/presentation/components/LoginFormPanel";

describe("RigthSide", () => {
  const originalLocation = window.location;

  beforeEach(() => {
    mockLogin.mockReset();
    mockGetGoogleAuthUrl.mockReset();
    mockGetGithubAuthUrl.mockReset();
    mockGetLinkedinAuthUrl.mockReset();
    mockNavigate.mockReset();
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
    mockLogin.mockResolvedValueOnce(undefined);
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
    expect(mockNavigate).toHaveBeenCalledWith("/home", { replace: true });
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

  it("redireciona para GitHub OAuth ao clicar no botao GitHub", async () => {
    mockGetGithubAuthUrl.mockResolvedValueOnce(
      "https://github.com/login/oauth/authorize?state=abc"
    );

    render(<RigthSide />);

    const buttons = screen.getAllByRole("button");
    const githubButton = buttons.find(btn => btn.querySelector('svg.fill-gray-900'));
    fireEvent.click(githubButton!);

    await waitFor(() => {
      expect(mockGetGithubAuthUrl).toHaveBeenCalled();
      expect(window.location.href).toBe(
        "https://github.com/login/oauth/authorize?state=abc"
      );
    });
  });

  it("exibe erro quando GitHub OAuth falha", async () => {
    mockGetGithubAuthUrl.mockRejectedValueOnce(new Error("Github indisponível"));

    render(<RigthSide />);

    const buttons = screen.getAllByRole("button");
    const githubButton = buttons.find(btn => btn.querySelector('svg.fill-gray-900'));
    fireEvent.click(githubButton!);

    expect(await screen.findByText(/Github indisponível/i)).toBeInTheDocument();
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
