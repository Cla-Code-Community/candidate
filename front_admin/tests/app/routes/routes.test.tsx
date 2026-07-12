import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ProtectedRoute } from "../../../src/app/routes/ProtectedRoute";
import { PublicRoute } from "../../../src/app/routes/PublicRoute";
import { useAuth } from "../../../src/modules/auth/hooks/useAuth";

vi.mock("../../../src/modules/auth/hooks/useAuth", () => ({
  useAuth: vi.fn(),
}));

function renderRoute(ui: React.ReactElement, route = "/private") {
  return render(
    <MemoryRouter initialEntries={[route]}>
      <Routes>
        <Route element={ui}>
          <Route path="/private" element={<div>Privado</div>} />
          <Route path="/login" element={<div>Login</div>} />
        </Route>
        <Route path="/dashboard" element={<div>Dashboard</div>} />
        <Route path="/403" element={<div>Negado</div>} />
      </Routes>
    </MemoryRouter>,
  );
}

describe("route guards", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders protected route states", () => {
    vi.mocked(useAuth).mockReturnValueOnce({
      isLoggedIn: null,
      loading: true,
      isLoading: false,
      errorMessage: "",
      login: vi.fn(),
      logout: vi.fn(),
      hasPermission: vi.fn(),
    });
    const { rerender } = renderRoute(<ProtectedRoute minRole="support" />);
    expect(screen.getByText("Carregando...")).toBeInTheDocument();

    vi.mocked(useAuth).mockReturnValueOnce({
      isLoggedIn: null,
      loading: false,
      isLoading: false,
      errorMessage: "",
      login: vi.fn(),
      logout: vi.fn(),
      hasPermission: vi.fn(),
    });
    rerender(
      <MemoryRouter initialEntries={["/private"]}>
        <Routes>
          <Route element={<ProtectedRoute minRole="support" />}>
            <Route path="/private" element={<div>Privado</div>} />
          </Route>
          <Route path="/login" element={<div>Login</div>} />
        </Routes>
      </MemoryRouter>,
    );
    expect(screen.getByText("Login")).toBeInTheDocument();
  });

  it("allows and denies users by role", () => {
    vi.mocked(useAuth).mockReturnValueOnce({
      isLoggedIn: {
        id: "u1",
        name: "Support",
        role: "support",
        avatar: "",
        permissions: {},
      },
      loading: false,
      isLoading: false,
      errorMessage: "",
      login: vi.fn(),
      logout: vi.fn(),
      hasPermission: vi.fn(),
    });
    renderRoute(<ProtectedRoute minRole="support" />);
    expect(screen.getByText("Privado")).toBeInTheDocument();
  });

  it("redirects insufficient protected roles to forbidden", () => {
    vi.mocked(useAuth).mockReturnValueOnce({
      isLoggedIn: {
        id: "u1",
        name: "User",
        role: "user",
        avatar: "",
        permissions: {},
      },
      loading: false,
      isLoading: false,
      errorMessage: "",
      login: vi.fn(),
      logout: vi.fn(),
      hasPermission: vi.fn(),
    });

    renderRoute(<ProtectedRoute minRole="support" />);
    expect(screen.getByText("Negado")).toBeInTheDocument();
  });

  it("redirects public route when already logged in", () => {
    vi.mocked(useAuth).mockReturnValue({
      isLoggedIn: {
        id: "u1",
        name: "Admin",
        role: "admin",
        avatar: "",
        permissions: {},
      },
      loading: false,
      isLoading: false,
      errorMessage: "",
      login: vi.fn(),
      logout: vi.fn(),
      hasPermission: vi.fn(),
    });

    renderRoute(<PublicRoute />);
    expect(screen.getByText("Dashboard")).toBeInTheDocument();
  });

  it("renders public loading and anonymous outlet states", () => {
    vi.mocked(useAuth).mockReturnValueOnce({
      isLoggedIn: null,
      loading: true,
      isLoading: false,
      errorMessage: "",
      login: vi.fn(),
      logout: vi.fn(),
      hasPermission: vi.fn(),
    });
    const { rerender } = renderRoute(<PublicRoute />);
    expect(screen.getByText("Carregando...")).toBeInTheDocument();

    vi.mocked(useAuth).mockReturnValueOnce({
      isLoggedIn: null,
      loading: false,
      isLoading: false,
      errorMessage: "",
      login: vi.fn(),
      logout: vi.fn(),
      hasPermission: vi.fn(),
    });
    rerender(
      <MemoryRouter initialEntries={["/private"]}>
        <Routes>
          <Route element={<PublicRoute />}>
            <Route path="/private" element={<div>Publico</div>} />
          </Route>
          <Route path="/dashboard" element={<div>Dashboard</div>} />
        </Routes>
      </MemoryRouter>,
    );
    expect(screen.getByText("Publico")).toBeInTheDocument();
  });
});
