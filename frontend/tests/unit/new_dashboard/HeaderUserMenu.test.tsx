import "@testing-library/jest-dom/vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { Header } from "@/domains/new_dashboard/components/layout/Header";

const mockNavigate = vi.fn();

vi.mock("react-router-dom", () => ({
  useLocation: () => ({ pathname: "/home" }),
  useNavigate: () => mockNavigate,
}));

vi.mock("@/domains/auth/application/AuthContext", () => ({
  useAuth: () => ({
    user: { id: "1", name: "Joao Silva", email: "joao@teste.com" },
    logout: vi.fn(),
  }),
}));

vi.mock("@/domains/new_dashboard/infrastructure/notificationsApi", () => ({
  getDashboardNotificationFeed: vi.fn().mockResolvedValue({
    messages: [],
    notifications: [],
    unreadCount: 0,
  }),
  markDashboardNotificationsRead: vi.fn().mockResolvedValue(undefined),
  clearDashboardNotifications: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/domains/new_dashboard/components/layout/ThemeToggle", () => ({
  ThemeToggle: () => <button type="button">tema</button>,
}));

vi.mock("@/domains/new_dashboard/components/layout/MessageDetailModal", () => ({
  MessageDetailModal: () => null,
}));

function openUserMenu() {
  render(<Header />);
  fireEvent.click(screen.getByLabelText("Menu do usuário"));
}

describe("Header - dropdown do usuário (PAV-108)", () => {
  beforeEach(() => {
    mockNavigate.mockReset();
  });

  it("AC1/AC4: não exibe a opção 'Segurança' no dropdown superior", () => {
    openUserMenu();

    expect(
      screen.queryByRole("button", { name: "Segurança" }),
    ).not.toBeInTheDocument();
  });

  it("AC2: exibe a opção 'Ajuda' no dropdown superior", () => {
    openUserMenu();

    expect(
      screen.getByRole("button", { name: "Ajuda" }),
    ).toBeInTheDocument();
  });

  it("AC3: 'Ajuda' navega para /ajuda (mesmo destino da Ajuda inferior)", () => {
    openUserMenu();

    fireEvent.click(screen.getByRole("button", { name: "Ajuda" }));

    expect(mockNavigate).toHaveBeenCalledWith("/ajuda");
  });
});
