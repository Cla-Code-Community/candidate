/* eslint-disable @typescript-eslint/no-explicit-any */
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mockRegister = vi.fn();
const mockGetGoogleAuthUrl = vi.fn();
const mockGetGithubAuthUrl = vi.fn();
const mockGetLinkedinAuthUrl = vi.fn();
const mockNavigate = vi.fn();

vi.mock("@/domains/auth/infrastructure/authApi", () => ({
  register: (...args: any[]) => mockRegister(...args),
  getGoogleAuthUrl: (...args: any[]) => mockGetGoogleAuthUrl(...args),
  getGithubAuthUrl: (...args: any[]) => mockGetGithubAuthUrl(...args),
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

vi.mock("react-phone-number-input", () => ({
  default: ({ value, onChange, placeholder, disabled }: any) => (
    <input
      type="tel"
      value={value || ""}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      disabled={disabled}
    />
  ),
}));

vi.mock("react-router-dom", () => ({
  useNavigate: () => mockNavigate,
}));

import RegisterSide from "@/domains/auth/presentation/components/RegisterFormPanel";

describe("RegisterSide", () => {
  const originalLocation = window.location;

  beforeEach(() => {
    mockRegister.mockReset();
    mockGetGoogleAuthUrl.mockReset();
    mockGetGithubAuthUrl.mockReset();
    mockGetLinkedinAuthUrl.mockReset();
    mockNavigate.mockReset();
    Object.defineProperty(window, "location", {
      configurable: true,
      value: { href: "" },
    });
  });

  afterEach(() => {
    Object.defineProperty(window, "location", {
      configurable: true,
      value: originalLocation,
    });
  });

  it("renderiza formulário e alterna visibilidade da senha", () => {
    render(<RegisterSide />);
    const passwordInput = screen.getByLabelText(/senha/i) as HTMLInputElement;
    expect(passwordInput.type).toBe("password");

    const revealButton = screen.getAllByRole("button", { name: "" })[0];
    fireEvent.click(revealButton);
    expect(screen.getByLabelText(/senha/i)).toHaveAttribute("type", "text");
  });

  it("mostra erros obrigatórios ao submeter vazio", async () => {
    render(<RegisterSide />);
    fireEvent.click(screen.getByRole("button", { name: /cadastrar/i }));
    expect(await screen.findByText(/campo de nome é obrigatório/i)).toBeInTheDocument();
    expect(await screen.findByText(/campo de e-mail é obrigatório/i)).toBeInTheDocument();
    expect(await screen.findByText(/campo de telefone é obrigatório/i)).toBeInTheDocument();
    expect(await screen.findByText(/campo de senha é obrigatório/i)).toBeInTheDocument();
  });

  it("valida CPF inválido quando preenchido", async () => {
    render(<RegisterSide />);
    fireEvent.change(screen.getByLabelText(/nome/i), { target: { value: "Usuário" } });
    fireEvent.change(screen.getByLabelText(/email/i), { target: { value: "teste@email.com" } });
    fireEvent.change(screen.getByPlaceholderText(/\(34\)/i), { target: { value: "+5534999999999" } });
    fireEvent.change(screen.getByLabelText(/senha/i), { target: { value: "123456" } });
    fireEvent.change(screen.getByLabelText(/cpf/i), { target: { value: "123" } });
    fireEvent.click(screen.getByRole("button", { name: /cadastrar/i }));
    expect(await screen.findByText(/cpf inválido/i)).toBeInTheDocument();
  });

  it("envia formulário válido sem CPF", async () => {
    mockRegister.mockResolvedValueOnce({ message: "Usuário criado" });
    render(<RegisterSide />);
    fireEvent.change(screen.getByLabelText(/nome/i), { target: { value: "Bene" } });
    fireEvent.change(screen.getByLabelText(/email/i), { target: { value: "bene@teste.com" } });
    fireEvent.change(screen.getByPlaceholderText(/\(34\)/i), { target: { value: "+5534999999999" } });
    fireEvent.change(screen.getByLabelText(/senha/i), { target: { value: "123456" } });
    fireEvent.click(screen.getByRole("button", { name: /cadastrar/i }));
    await waitFor(() => {
      expect(mockRegister).toHaveBeenCalledWith({
        email: "bene@teste.com",
        password: "123456",
        name: "Bene",
      });
    });
    expect(window.location.href).toBe("/login?registered=true");
  });

  it("envia formulário válido como usuário (sem tecnologias/nível)", async () => {
    mockRegister.mockResolvedValueOnce({ message: "Usuário criado" });
    render(<RegisterSide />);
    fireEvent.change(screen.getByLabelText(/nome/i), { target: { value: "Bene" } });
    fireEvent.change(screen.getByLabelText(/email/i), { target: { value: "bene@teste.com" } });
    fireEvent.change(screen.getByPlaceholderText(/\(34\)/i), { target: { value: "+5534999999999" } });
    fireEvent.change(screen.getByLabelText(/senha/i), { target: { value: "123456" } });
    fireEvent.click(screen.getByRole("button", { name: /cadastrar/i }));
    await waitFor(() => {
      expect(mockRegister).toHaveBeenCalledWith({
        email: "bene@teste.com",
        password: "123456",
        name: "Bene",
      });
    });
  });

  it("exibe erro da API", async () => {
    mockRegister.mockRejectedValueOnce(new Error("Email já cadastrado"));
    render(<RegisterSide />);
    fireEvent.change(screen.getByLabelText(/nome/i), { target: { value: "Bene" } });
    fireEvent.change(screen.getByLabelText(/email/i), { target: { value: "bene@teste.com" } });
    fireEvent.change(screen.getByPlaceholderText(/\(34\)/i), { target: { value: "+5534999999999" } });
    fireEvent.change(screen.getByLabelText(/senha/i), { target: { value: "123456" } });
    fireEvent.click(screen.getByRole("button", { name: /cadastrar/i }));
    expect(await screen.findByText(/Email já cadastrado/i)).toBeInTheDocument();
  });

  it("mostra loading durante requisição", async () => {
    mockRegister.mockImplementation(() => new Promise(() => {}));
    render(<RegisterSide />);
    fireEvent.change(screen.getByLabelText(/nome/i), { target: { value: "Bene" } });
    fireEvent.change(screen.getByLabelText(/email/i), { target: { value: "bene@teste.com" } });
    fireEvent.change(screen.getByPlaceholderText(/\(34\)/i), { target: { value: "+5534999999999" } });
    fireEvent.change(screen.getByLabelText(/senha/i), { target: { value: "123456" } });
    fireEvent.click(screen.getByRole("button", { name: /cadastrar/i }));
    expect(await screen.findByRole("button", { name: /cadastrando\.\.\./i })).toBeDisabled();
  });

  it("formata CPF corretamente", () => {
    render(<RegisterSide />);
    const cpfInput = screen.getByLabelText(/cpf/i) as HTMLInputElement;
    fireEvent.change(cpfInput, { target: { value: "12345678901" } });
    expect(cpfInput.value).toBe("123.456.789-01");
    fireEvent.change(cpfInput, { target: { value: "123456789" } });
    expect(cpfInput.value).toBe("123.456.789");
  });

  it("desabilita inputs durante loading", async () => {
    mockRegister.mockImplementation(() => new Promise(() => {}));
    render(<RegisterSide />);
    const nomeInput = screen.getByLabelText(/nome/i);
    const emailInput = screen.getByLabelText(/email/i);
    const telefoneInput = screen.getByPlaceholderText(/\(34\)/i);
    const passwordInput = screen.getByLabelText(/senha/i);
    fireEvent.change(nomeInput, { target: { value: "Bene" } });
    fireEvent.change(emailInput, { target: { value: "bene@teste.com" } });
    fireEvent.change(telefoneInput, { target: { value: "+5534999999999" } });
    fireEvent.change(passwordInput, { target: { value: "123456" } });
    fireEvent.click(screen.getByRole("button", { name: /cadastrar/i }));
    await waitFor(() => {
      expect(nomeInput).toBeDisabled();
      expect(emailInput).toBeDisabled();
      expect(telefoneInput).toBeDisabled();
      expect(passwordInput).toBeDisabled();
    });
  });

  it("redireciona para GitHub OAuth ao clicar no botao GitHub", async () => {
    mockGetGithubAuthUrl.mockResolvedValueOnce(
      "https://github.com/login/oauth/authorize?state=abc"
    );

    render(<RegisterSide />);

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

    render(<RegisterSide />);

    const buttons = screen.getAllByRole("button");
    const githubButton = buttons.find(btn => btn.querySelector('svg.fill-gray-900'));
    fireEvent.click(githubButton!);

    expect(await screen.findByText(/Github indisponível/i)).toBeInTheDocument();
  });

  it("redireciona para LinkedIn OAuth ao clicar no botao LinkedIn", async () => {
    mockGetLinkedinAuthUrl.mockResolvedValueOnce(
      "https://www.linkedin.com/oauth/v2/authorization?state=abc"
    );

    render(<RegisterSide />);

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
