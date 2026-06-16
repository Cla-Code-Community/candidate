import { render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import "@testing-library/jest-dom/vitest";

const mockNavigate = vi.fn();
vi.mock("react-router-dom", () => ({
  useNavigate: () => mockNavigate,
}));

const mockUseAuth = vi.fn();
vi.mock("@/context/AuthContext", () => ({
  useAuth: () => mockUseAuth(),
}));

vi.mock("@/Loading", () => ({
  default: () => <div data-testid="loading">Loading...</div>,
}));

import AuthCallback from "@/pages/auth/AuthCallback";

describe("AuthCallback", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("mostra loading enquanto isLoading é true", () => {
    mockUseAuth.mockReturnValue({
      user: null,
      isLoading: true,
      refreshUser: vi.fn(),
    });

    render(<AuthCallback />);

    expect(screen.getByTestId("loading")).toBeInTheDocument();
  });

  it("navega para /app quando user existe", async () => {
    const refreshUser = vi.fn();
    mockUseAuth
      .mockReturnValueOnce({ user: null, isLoading: true, refreshUser })
      .mockReturnValue({
        user: { id: "1", email: "test@test.com" },
        isLoading: false,
        refreshUser,
      });

    const { rerender } = render(<AuthCallback />);

    expect(refreshUser).toHaveBeenCalled();

    rerender(<AuthCallback />);

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith("/app", { replace: true });
    });
  });

  it("navega para /login com erro quando user é null", async () => {
    const refreshUser = vi.fn();
    mockUseAuth
      .mockReturnValueOnce({ user: null, isLoading: true, refreshUser })
      .mockReturnValue({ user: null, isLoading: false, refreshUser });

    const { rerender } = render(<AuthCallback />);

    expect(refreshUser).toHaveBeenCalled();

    rerender(<AuthCallback />);

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith("/login?error=oauth_failed", {
        replace: true,
      });
    });
  });

  it("chama refreshUser ao montar", () => {
    const refreshUser = vi.fn();
    mockUseAuth.mockReturnValue({
      user: null,
      isLoading: true,
      refreshUser,
    });

    render(<AuthCallback />);

    expect(refreshUser).toHaveBeenCalledTimes(1);
  });
});
