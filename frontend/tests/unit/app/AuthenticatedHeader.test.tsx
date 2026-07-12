
import "@testing-library/jest-dom/vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AuthenticatedHeader } from "../../../src/app/AuthenticatedHeader";

const mockUseAuth = vi.fn();
const mockUseTheme = vi.fn();
const mockUseLocation = vi.fn();
const mockToggleTheme = vi.fn();

vi.mock("react-router-dom", () => ({
  useLocation: () => mockUseLocation(),
}));

vi.mock("@/domains/auth/application/AuthContext", () => ({
  useAuth: () => mockUseAuth(),
}));

vi.mock("@/shared/hooks/useTheme", () => ({
  useTheme: () => mockUseTheme(),
}));

vi.mock("@/shared/ui/theme-toggle", () => ({
  ThemeToggle: ({ theme, onToggle }: { theme: string; onToggle: () => void }) => (
    <button type="button" onClick={onToggle} aria-label={`Tema atual: ${theme}`}>
      alternar tema
    </button>
  ),
}));

vi.mock("lucide-react", () => ({
  Mail: () => <svg data-testid="mail-icon" />,
  Bell: () => <svg data-testid="bell-icon" />,
}));

describe("AuthenticatedHeader", () => {
  beforeEach(() => {
    mockToggleTheme.mockReset();

    mockUseTheme.mockReturnValue({
      resolvedTheme: "dark",
      toggleTheme: mockToggleTheme,
    });

    mockUseAuth.mockReturnValue({
      user: { id: "1", name: "Joao Silva", email: "joao@teste.com" },
    });

    mockUseLocation.mockReturnValue({ pathname: "/home" });
  });

  it("renderiza título exato para /home e aciona toggle de tema", () => {
    render(<AuthenticatedHeader />);

    expect(screen.getByRole("heading", { name: "Início" })).toBeInTheDocument();
    expect(screen.getByLabelText("Mensagens")).toBeInTheDocument();
    expect(screen.getByLabelText("Notificações")).toBeInTheDocument();
    expect(screen.getByTestId("mail-icon")).toBeInTheDocument();
    expect(screen.getByTestId("bell-icon")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Tema atual: dark" }));
    expect(mockToggleTheme).toHaveBeenCalledTimes(1);
  });

  it("resolve título por prefixo para subrota de /vagas", () => {
    mockUseLocation.mockReturnValue({ pathname: "/vagas/minhas" });

    render(<AuthenticatedHeader />);

    expect(screen.getByRole("heading", { name: "Vagas" })).toBeInTheDocument();
  });

  it("resolve título por prefixo para subrota de /mentoria", () => {
    mockUseLocation.mockReturnValue({ pathname: "/mentoria/sessao-1" });

    render(<AuthenticatedHeader />);

    expect(screen.getByRole("heading", { name: "Mentoria" })).toBeInTheDocument();
  });

  it("usa fallback de título para rota não mapeada", () => {
    mockUseLocation.mockReturnValue({ pathname: "/qualquer-outra-rota" });

    render(<AuthenticatedHeader />);

    expect(screen.getByRole("heading", { name: "Início" })).toBeInTheDocument();
  });

  it("prioriza user.name para display e gera iniciais com duas palavras", () => {
    mockUseAuth.mockReturnValue({
      user: { id: "2", name: "Maria Clara", displayName: "MC", email: "x@y.com" },
    });

    render(<AuthenticatedHeader />);

    expect(screen.getByLabelText("Maria Clara")).toBeInTheDocument();
    expect(screen.getByTitle("Maria Clara")).toHaveTextContent("MC");
  });

  it("usa user.displayName quando name não existe", () => {
    mockUseAuth.mockReturnValue({
      user: { id: "3", displayName: "Pedro", email: "pedro@teste.com" },
    });

    render(<AuthenticatedHeader />);

    expect(screen.getByLabelText("Pedro")).toBeInTheDocument();
    expect(screen.getByTitle("Pedro")).toHaveTextContent("PE");
  });

  it("usa user.email quando não há name/displayName e remove domínio para iniciais", () => {
    mockUseAuth.mockReturnValue({
      user: { id: "4", email: "ana.maria@teste.com" },
    });

    render(<AuthenticatedHeader />);

    expect(screen.getByLabelText("ana.maria@teste.com")).toBeInTheDocument();
    expect(screen.getByTitle("ana.maria@teste.com")).toHaveTextContent("AM");
  });

  it("usa fallback Usuário quando não existe user e retorna inicial U", () => {
    mockUseAuth.mockReturnValue({ user: null });

    render(<AuthenticatedHeader />);

    expect(screen.getByLabelText("Usuário")).toBeInTheDocument();
    expect(screen.getByTitle("Usuário")).toHaveTextContent("U");
  });

  it("retorna inicial U quando displayName contém apenas espaços", () => {
    mockUseAuth.mockReturnValue({
      user: { id: "5", displayName: "   " },
    });

    render(<AuthenticatedHeader />);

    const avatar = screen.getByText("U");
    expect(avatar).toBeInTheDocument();
    expect(avatar).toHaveAttribute("title", "   ");
    expect(avatar).toHaveAttribute("aria-label", "   ");
  });
});
