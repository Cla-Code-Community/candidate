import { fireEvent, screen } from "@testing-library/react";
import { Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { MainLayout } from "../../../src/app/layouts/MainLayout";
import { dashboardApi } from "../../../src/lib/api/dashboard.api";
import { useAuth } from "../../../src/modules/auth/hooks/useAuth";
import { renderWithProviders } from "../../test-utils";

vi.mock("../../../src/modules/auth/hooks/useAuth", () => ({
  useAuth: vi.fn(),
}));

vi.mock("../../../src/lib/api/dashboard.api", () => ({
  dashboardApi: {
    getOverview: vi.fn(),
  },
}));

describe("MainLayout", () => {
  const logout = vi.fn();

  beforeEach(() => {
    vi.mocked(useAuth).mockReturnValue({
      isLoggedIn: {
        id: "u1",
        name: "Ada Lovelace",
        email: "ada@example.com",
        role: "admin",
        avatar: "",
        permissions: {},
      },
      loading: false,
      isLoading: false,
      errorMessage: "",
      login: vi.fn(),
      logout,
      hasPermission: vi.fn(),
    });
    vi.mocked(dashboardApi.getOverview).mockResolvedValue({
      stats: {
        totalUsers: 10,
        activeUsers: 10,
        totalCollectedJobs: 2543,
        jobsCollectedToday: 12,
      },
      scrapers: [
        {
          name: "go-scraper",
          status: "running",
          running: true,
          lastRunAt: null,
          jobsCollected: 2543,
        },
      ],
      services: {
        status: "ok",
        timestamp: "2026-01-01T10:00:00.000Z",
        services: {
          postgres: { status: "ok", latencyMs: 8 },
          valkey: { status: "ok", latencyMs: 6 },
          scraper: { status: "ok", latencyMs: 12 },
        },
      },
      generatedAt: "2026-01-01T10:00:00.000Z",
    });
  });

  it("renders sidebar, header controls and outlet", async () => {
    renderWithProviders(
      <Routes>
        <Route element={<MainLayout />}>
          <Route path="/dashboard" element={<div>Conteúdo dashboard</div>} />
          <Route path="/users" element={<div>Conteúdo usuários</div>} />
        </Route>
        <Route path="/login" element={<div>Login route</div>} />
      </Routes>,
      { route: "/dashboard", withTheme: true },
    );

    expect(screen.getAllByText("Dashboard")).toHaveLength(2);
    expect(screen.getByText("Conteúdo dashboard")).toBeInTheDocument();

    fireEvent.change(screen.getByPlaceholderText("Buscar vagas, scrapers, logs..."), {
      target: { value: "logs" },
    });
    expect(screen.getByDisplayValue("logs")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /últimas 24 horas/i }));
    expect(screen.getByRole("button", { name: /últimos 7 dias/i })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Abrir notificações" }));
    expect(screen.getByText("Notificações")).toBeInTheDocument();
    expect(await screen.findByText("go-scraper em execução")).toBeInTheDocument();
    fireEvent.click(screen.getByText("go-scraper em execução"));
    expect(
      await screen.findAllByText("O scraper está rodando neste momento."),
    ).toHaveLength(2);

    fireEvent.click(screen.getByText("Ada Lovelace"));
    expect(screen.getByText("Meu Perfil")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Sair da Conta" }));
    expect(logout).toHaveBeenCalledTimes(1);
  });
});
