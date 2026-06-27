import { AppRoutes } from "@/app/AppRoutes";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

const authState = vi.hoisted(() => ({
  value: {
    user: null as { id: string; email: string } | null,
    isLoading: false,
  },
}));

vi.mock("@/domains/auth/application/AuthContext", () => ({
  useAuth: () => authState.value,
}));

vi.mock("@/shared/ui/Loading", () => ({
  default: () => <div role="status">Carregando...</div>,
}));

vi.mock("@/app/AuthenticatedLayout", async () => {
  const { Outlet } =
    await vi.importActual<typeof import("react-router-dom")>(
      "react-router-dom",
    );

  return {
    AuthenticatedLayout: () => (
      <div>
        <span>Authenticated shell</span>
        <Outlet />
      </div>
    ),
  };
});

vi.mock("@/domains/marketing/presentation/pages/LandingPage", () => ({
  default: () => <main>Landing route</main>,
}));

vi.mock("@/domains/auth/presentation/pages/LoginPage", () => ({
  default: () => <main>Login route</main>,
}));

vi.mock("@/domains/auth/presentation/pages/RegisterPage", () => ({
  default: () => <main>Register route</main>,
}));

vi.mock("@/domains/auth/presentation/pages/AuthCallbackPage", () => ({
  default: () => <main>Callback route</main>,
}));

vi.mock("@/domains/jobs/presentation/pages/JobsPage", () => ({
  default: () => <main>Jobs route</main>,
}));

vi.mock("@/app/NotFound", () => ({
  default: () => <main>Not found route</main>,
}));

function renderRoute(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <AppRoutes />
    </MemoryRouter>,
  );
}

describe("AppRoutes", () => {
  beforeEach(() => {
    authState.value = {
      user: null,
      isLoading: false,
    };
  });

  it("renderiza a landing page na rota pública inicial", () => {
    renderRoute("/");

    expect(screen.getByText("Landing route")).toBeInTheDocument();
  });

  it("mostra loading em rota protegida enquanto a sessão está carregando", () => {
    authState.value = {
      user: null,
      isLoading: true,
    };

    renderRoute("/home");

    expect(screen.getByRole("status")).toHaveTextContent("Carregando...");
  });

  it("redireciona rota protegida para login quando não há usuário", () => {
    renderRoute("/home");

    expect(screen.getByText("Login route")).toBeInTheDocument();
    expect(screen.queryByText("Jobs route")).not.toBeInTheDocument();
  });

  it("renderiza layout autenticado e conteúdo protegido quando há usuário", () => {
    authState.value = {
      user: { id: "1", email: "otavio@example.com" },
      isLoading: false,
    };

    renderRoute("/vagas");

    expect(screen.getByText("Authenticated shell")).toBeInTheDocument();
    expect(screen.getByText("Jobs route")).toBeInTheDocument();
  });

  it("mostra loading em rota pública enquanto a sessão está carregando", () => {
    authState.value = {
      user: null,
      isLoading: true,
    };

    renderRoute("/register");

    expect(screen.getByRole("status")).toHaveTextContent("Carregando...");
  });

  it("redireciona usuário autenticado para home ao acessar login", () => {
    authState.value = {
      user: { id: "1", email: "otavio@example.com" },
      isLoading: false,
    };

    renderRoute("/login");

    expect(screen.getByText("Authenticated shell")).toBeInTheDocument();
    expect(screen.getByText("Jobs route")).toBeInTheDocument();
  });

  it("mantém callback OAuth fora dos guards de autenticação", () => {
    renderRoute("/auth/callback");

    expect(screen.getByText("Callback route")).toBeInTheDocument();
  });
});
