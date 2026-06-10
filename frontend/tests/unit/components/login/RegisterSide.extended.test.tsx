/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unused-vars */
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import "@testing-library/jest-dom/vitest";

vi.mock("@unpic/react", () => ({
  Image: (props: any) => <img {...props} alt={props.alt} />,
}));

vi.mock("framer-motion", () => ({
  motion: {
    div: ({ children, whileHover, whileTap, animate, transition, ...props }: any) =>
      <div {...props}>{children}</div>,
    button: ({ children, whileHover, whileTap, animate, transition, ...props }: any) =>
      <button {...props}>{children}</button>,
  },
}));

vi.mock("react-phone-number-input", () => ({
  default: ({ value, onChange, placeholder }: any) => (
    <input
      aria-label="Telefone"
      value={value || ""}
      placeholder={placeholder}
      onChange={(event) => onChange(event.target.value)}
    />
  ),
}));

// Mock estável do react-router-dom protegendo contra hoisting
const mockNavigate = vi.fn();
vi.mock("react-router-dom", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react-router-dom")>();
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

const mockLogin = vi.fn().mockResolvedValue(undefined);
vi.mock("@/context/AuthContext", () => ({
  useAuth: () => ({
    login: mockLogin,
    user: null,
    isLoading: false,
  }),
}));

const mockApiPost = vi.fn();
const mockApiGet = vi.fn();
vi.mock("@/services/api", () => ({
  api: {
    post: (...args: any[]) => mockApiPost(...args),
    get: (...args: any[]) => mockApiGet(...args),
  },
}));

import RegisterSide from "@/components/login/RegisterSide";

// ─── helpers ────────────────────────────────────────────────────────────────
function fillValidForm() {
  fireEvent.change(screen.getByLabelText(/nome/i), { target: { value: "Bene" } });
  fireEvent.change(screen.getByLabelText(/email/i), { target: { value: "bene@teste.com" } });
  fireEvent.change(screen.getByLabelText(/^telefone$/i), { target: { value: "+5534999999999" } });
  fireEvent.change(screen.getByLabelText(/senha/i), { target: { value: "123456" } });
  fireEvent.change(screen.getByLabelText(/cpf/i), { target: { value: "12345678901" } });
}

describe("RegisterSide — branches extras", () => {
  beforeEach(() => {
    mockApiPost.mockReset();
    mockApiGet.mockReset();
    mockNavigate.mockReset();
    mockLogin.mockReset();
  });

  // ── Branch: submit com sucesso → navega para /app ────────────────────────
  it("navega para /app após cadastro bem-sucedido", async () => {
    mockApiPost.mockResolvedValueOnce({ data: { user: {}, token: "fake-token" } });
    mockLogin.mockResolvedValueOnce(undefined);

    render(<RegisterSide />);
    fillValidForm();

    // Dispara o clique no botão de cadastrar
    fireEvent.click(screen.getByRole("button", { name: /cadastrar/i }));

    // Aguarda as promessas resolverem e valida a navegação esperada
    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith("/app");
    });
  });

  // ── Branch: API retorna erro de validação por campo (data.error é objeto) ─
  it("exibe erros de campo quando API retorna objeto de validação", async () => {
    mockApiPost.mockRejectedValueOnce({
      response: {
        data: {
          error: {
            name:     { _errors: ["Nome já existe"] },
            email:    { _errors: ["E-mail já cadastrado"] },
            phone:    { _errors: ["Telefone inválido"] },
            password: { _errors: ["Senha fraca"] },
            cpf:      { _errors: ["CPF já cadastrado"] },
          },
        },
      },
    });

    render(<RegisterSide />);
    fillValidForm();
    fireEvent.click(screen.getByRole("button", { name: /cadastrar/i }));

    await waitFor(() => expect(screen.getByText("Nome já existe")).toBeInTheDocument());
    expect(screen.getByText("E-mail já cadastrado")).toBeInTheDocument();
    expect(screen.getByText("Telefone inválido")).toBeInTheDocument();
    expect(screen.getByText("Senha fraca")).toBeInTheDocument();
    expect(screen.getByText("CPF já cadastrado")).toBeInTheDocument();
  });

  // ── Branch: API retorna mensagem de e-mail duplicado (fallback string) ────
  it("exibe erro de e-mail duplicado quando mensagem contém 'email'", async () => {
    mockApiPost.mockRejectedValueOnce({
      response: { data: { message: "email already in use" } },
    });

    render(<RegisterSide />);
    fillValidForm();
    fireEvent.click(screen.getByRole("button", { name: /cadastrar/i }));

    await waitFor(() =>
      expect(screen.getByText(/endereço de e-mail já está em uso/i)).toBeInTheDocument()
    );
  });

  // ── Branch: API retorna mensagem genérica (fallback string, sem 'email') ──
  it("exibe globalError quando API retorna mensagem genérica", async () => {
    mockApiPost.mockRejectedValueOnce({
      response: { data: { message: "Servidor indisponível" } },
    });

    render(<RegisterSide />);
    fillValidForm();
    fireEvent.click(screen.getByRole("button", { name: /cadastrar/i }));

    await waitFor(() =>
      expect(screen.getByText("Servidor indisponível")).toBeInTheDocument()
    );
  });

  // ── Branch: API retorna data.error como string (sem 'email') ─────────────
  it("exibe globalError quando data.error é uma string genérica", async () => {
    mockApiPost.mockRejectedValueOnce({
      response: { data: { error: "Erro interno" } },
    });

    render(<RegisterSide />);
    fillValidForm();
    fireEvent.click(screen.getByRole("button", { name: /cadastrar/i }));

    await waitFor(() =>
      expect(screen.getByText("Erro interno")).toBeInTheDocument()
    );
  });

  // ── Branch: erro sem response (ex: rede) → globalError genérico ──────────
  it("exibe erro de conexão quando não há response (erro de rede)", async () => {
    mockApiPost.mockRejectedValueOnce(new Error("Network Error"));

    render(<RegisterSide />);
    fillValidForm();
    fireEvent.click(screen.getByRole("button", { name: /cadastrar/i }));

    await waitFor(() =>
      expect(screen.getByText(/erro inesperado de conexão/i)).toBeInTheDocument()
    );
  });

  // ── Branch: OAuth Google — sucesso com URL ────────────────────────────────
  it("redireciona para URL do Google OAuth quando API retorna url", async () => {
    const locationSpy = vi.spyOn(window, "location", "get").mockReturnValue({
      ...window.location,
      href: "",
    } as Location);
    const hrefSetter = vi.fn();
    Object.defineProperty(window.location, "href", { set: hrefSetter, configurable: true });

    mockApiGet.mockResolvedValueOnce({ data: { url: "https://google.com/oauth" } });
    render(<RegisterSide />);
    fireEvent.click(screen.getByAltText(/google/i).closest("button")!);

    await waitFor(() =>
      expect(hrefSetter).toHaveBeenCalledWith("https://google.com/oauth")
    );

    locationSpy.mockRestore();
  });

  // ── Branch: OAuth GitHub — API não retorna URL → throw + globalError ──────
  it("exibe globalError quando OAuth não retorna URL", async () => {
    mockApiGet.mockResolvedValueOnce({ data: {} }); // sem url

    render(<RegisterSide />);
    // Botões OAuth são os que contêm apenas SVG (sem texto)
    const oauthButtons = screen.getAllByRole("button").filter(
      (btn) => btn.querySelector("svg") && !btn.textContent?.trim()
    );
    fireEvent.click(oauthButtons[oauthButtons.length - 1]); // GitHub é o último

    await waitFor(() =>
      expect(screen.getByText(/não foi possível conectar/i)).toBeInTheDocument()
    );
  });

  // ── Branch: OAuth — erro Axios com response.data.error string ─────────────
  it("exibe mensagem de erro do Axios no OAuth", async () => {
    mockApiGet.mockRejectedValueOnce({
      response: { data: { error: "Provedor desativado" } },
    });

    render(<RegisterSide />);
    // Clica no Google pelo alt text da imagem
    fireEvent.click(screen.getByAltText(/google/i).closest("button")!);

    await waitFor(() =>
      expect(screen.getByText("Provedor desativado")).toBeInTheDocument()
    );
  });

  // ── Branch: alterna visibilidade da senha ────────────────────────────────
  it("alterna tipo do input de senha ao clicar no botão de revelar", () => {
    render(<RegisterSide />);
    const senhaInput = screen.getByLabelText(/senha/i) as HTMLInputElement;
    expect(senhaInput.type).toBe("password");

    const toggleBtn = screen.getAllByRole("button").find(
      (btn) => btn.querySelector("svg") && !btn.textContent?.match(/cadastrar/i)
    )!;
    fireEvent.click(toggleBtn);
    expect(senhaInput.type).toBe("text");

    fireEvent.click(toggleBtn);
    expect(senhaInput.type).toBe("password");
  });

  // ── Branch: formatCpf — cobre os 4 ramos de formatação ───────────────────
  it("formata CPF progressivamente nos 4 estágios", () => {
    render(<RegisterSide />);
    const cpfInput = screen.getByLabelText(/cpf/i);

    fireEvent.change(cpfInput, { target: { value: "12" } });
    expect(cpfInput).toHaveValue("12");

    fireEvent.change(cpfInput, { target: { value: "12345" } });
    expect(cpfInput).toHaveValue("123.45");

    fireEvent.change(cpfInput, { target: { value: "12345678" } });
    expect(cpfInput).toHaveValue("123.456.78");

    fireEvent.change(cpfInput, { target: { value: "12345678901" } });
    expect(cpfInput).toHaveValue("123.456.789-01");
  });
});
