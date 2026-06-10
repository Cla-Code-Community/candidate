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

const mockNavigate = vi.fn();
vi.mock("react-router-dom", () => ({
  useNavigate: () => mockNavigate,
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

describe("RegisterSide", () => {

  beforeEach(() => {
    mockApiPost.mockClear();
    mockApiGet.mockClear();
    mockNavigate.mockClear();
  });

  it("renderiza formulário completo de cadastro", () => {
    render(<RegisterSide />);

    expect(screen.getByLabelText(/nome/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/^telefone$/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/senha/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/cpf/i)).toBeInTheDocument();
  });

  it("mostra erros obrigatórios quando submit vazio", () => {
    render(<RegisterSide />);

    fireEvent.click(screen.getByRole("button", { name: /cadastrar/i }));

    expect(screen.getByText(/campo de nome.*obrigatório/i)).toBeInTheDocument();
    expect(screen.getByText(/campo de e-mail.*obrigatório/i)).toBeInTheDocument();
    expect(screen.getByText(/campo de telefone.*obrigatório/i)).toBeInTheDocument();
    expect(screen.getByText(/campo de senha.*obrigatório/i)).toBeInTheDocument();
    expect(screen.getByText(/campo de cpf.*obrigatório/i)).toBeInTheDocument();
  });

  it("valida email, senha e cpf inválidos", () => {
    render(<RegisterSide />);

    fireEvent.change(screen.getByLabelText(/nome/i), { target: { value: "Bene" } });
    fireEvent.change(screen.getByLabelText(/email/i), { target: { value: "bene@teste" } });
    fireEvent.change(screen.getByLabelText(/^telefone$/i), { target: { value: "+5534999999999" } });
    fireEvent.change(screen.getByLabelText(/senha/i), { target: { value: "123" } });
    fireEvent.change(screen.getByLabelText(/cpf/i), { target: { value: "123" } });

    fireEvent.click(screen.getByRole("button", { name: /cadastrar/i }));

    expect(screen.getByText(/insira um e-mail válido/i)).toBeInTheDocument();
    expect(screen.getByText(/pelo menos 6 caracteres/i)).toBeInTheDocument();
    expect(screen.getByText(/insira um cpf válido/i)).toBeInTheDocument();
  });

  it("formata cpf e envia submit válido", async () => {
    mockApiPost.mockResolvedValueOnce({ data: {} });

    render(<RegisterSide />);
    fireEvent.change(screen.getByLabelText(/nome/i), { target: { value: "Bene" } });
    fireEvent.change(screen.getByLabelText(/email/i), { target: { value: "bene@teste.com" } });
    fireEvent.change(screen.getByLabelText(/^telefone$/i), { target: { value: "+5534999999999" } });
    fireEvent.change(screen.getByLabelText(/senha/i), { target: { value: "123456" } });
    fireEvent.change(screen.getByLabelText(/cpf/i), { target: { value: "12345678901" } });

    expect(screen.getByLabelText(/cpf/i)).toHaveValue("123.456.789-01");

    fireEvent.click(screen.getByRole("button", { name: /cadastrar/i }));

    await waitFor(() => {
      expect(mockApiPost).toHaveBeenCalledWith("/auth/register", {
        name: "Bene",
        email: "bene@teste.com",
        phone: "+5534999999999",
        password: "123456",
        cpf: "12345678901",
      });
    });
  });
});
