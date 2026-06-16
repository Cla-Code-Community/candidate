/* eslint-disable @typescript-eslint/no-explicit-any */
import { render, screen, waitFor, act } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import "@testing-library/jest-dom/vitest";

const mockApiGet = vi.fn();
const mockApiPost = vi.fn();

vi.mock("@/services/api", () => ({
  api: {
    get: (...args: any[]) => mockApiGet(...args),
    post: (...args: any[]) => mockApiPost(...args),
  },
}));

import { AuthProvider, useAuth } from "@/context/AuthContext";

function TestConsumer() {
  const { user, isLoading, login, logout, refreshUser } = useAuth();
  return (
    <div>
      <span data-testid="loading">{String(isLoading)}</span>
      <span data-testid="user">{user ? JSON.stringify(user) : "null"}</span>
      <button onClick={() => login({ email: "a@b.com", password: "123456" })}>
        login
      </button>
      <button onClick={() => logout()}>logout</button>
      <button onClick={() => refreshUser()}>refresh</button>
    </div>
  );
}

function renderWithProvider() {
  return render(
    <AuthProvider>
      <TestConsumer />
    </AuthProvider>
  );
}

describe("AuthContext", () => {
  beforeEach(() => {
    mockApiGet.mockReset();
    mockApiPost.mockReset();
  });

  it("inicia com isLoading=true e, ao resolver /auth/me com data.user, seta o usuário", async () => {
    mockApiGet.mockResolvedValueOnce({
      data: { user: { id: "1", email: "joao@teste.com", name: "João" } },
    });

    renderWithProvider();

    await waitFor(() => {
      expect(screen.getByTestId("loading").textContent).toBe("false");
    });

    expect(screen.getByTestId("user").textContent).toBe(
      JSON.stringify({ id: "1", email: "joao@teste.com", name: "João" })
    );
  });

  it("usa res.data.userId quando data.user é nulo/undefined", async () => {
    mockApiGet.mockResolvedValueOnce({
      data: { userId: "42", user: null },
    });

    renderWithProvider();

    await waitFor(() => {
      expect(screen.getByTestId("loading").textContent).toBe("false");
    });

    const user = JSON.parse(screen.getByTestId("user").textContent!);
    expect(user.id).toBe("42");
    expect(user.email).toBe("");
  });

  it("define user como null quando /auth/me falha", async () => {
    mockApiGet.mockRejectedValueOnce(new Error("Unauthorized"));

    renderWithProvider();

    await waitFor(() => {
      expect(screen.getByTestId("loading").textContent).toBe("false");
    });

    expect(screen.getByTestId("user").textContent).toBe("null");
  });

  it("atualiza user após login bem-sucedido", async () => {
    mockApiGet.mockRejectedValueOnce(new Error("Unauthorized"));
    mockApiPost.mockResolvedValueOnce({
      data: { user: { id: "99", email: "a@b.com", name: "Ana" } },
    });

    renderWithProvider();

    await waitFor(() => {
      expect(screen.getByTestId("loading").textContent).toBe("false");
    });

    await act(async () => {
      screen.getByRole("button", { name: /login/i }).click();
    });

    await waitFor(() => {
      const user = JSON.parse(screen.getByTestId("user").textContent!);
      expect(user.email).toBe("a@b.com");
    });

    expect(mockApiPost).toHaveBeenCalledWith("/auth/login", {
      email: "a@b.com",
      password: "123456",
    });
  });

  it("define user como null após logout", async () => {
    mockApiGet.mockResolvedValueOnce({
      data: { user: { id: "1", email: "joao@teste.com" } },
    });
    mockApiPost.mockResolvedValueOnce({});

    renderWithProvider();

    await waitFor(() => {
      expect(screen.getByTestId("loading").textContent).toBe("false");
    });
    expect(screen.getByTestId("user").textContent).not.toBe("null");

    await act(async () => {
      screen.getByRole("button", { name: /logout/i }).click();
    });

    await waitFor(() => {
      expect(screen.getByTestId("user").textContent).toBe("null");
    });

    expect(mockApiPost).toHaveBeenCalledWith("/auth/logout");
  });

  it("useAuth retorna contexto padrão quando usado fora do AuthProvider", () => {
    function Naked() {
      const ctx = useAuth();
      return <span data-testid="ctx">{JSON.stringify(Object.keys(ctx))}</span>;
    }
    render(<Naked />);
    expect(screen.getByTestId("ctx")).toBeInTheDocument();
  });

  it("refreshUser atualiza o usuário ao chamar /auth/me novamente", async () => {
    mockApiGet.mockRejectedValueOnce(new Error("Unauthorized"));

    renderWithProvider();

    await waitFor(() => {
      expect(screen.getByTestId("loading").textContent).toBe("false");
    });

    expect(screen.getByTestId("user").textContent).toBe("null");

    mockApiGet.mockResolvedValueOnce({
      data: { user: { id: "2", email: "novo@teste.com", name: "Novo" } },
    });

    await act(async () => {
      screen.getByRole("button", { name: /refresh/i }).click();
    });

    await waitFor(() => {
      expect(screen.getByTestId("loading").textContent).toBe("false");
    });

    const user = JSON.parse(screen.getByTestId("user").textContent!);
    expect(user.id).toBe("2");
    expect(user.email).toBe("novo@teste.com");
  });

  it("refreshUser define user como null quando /auth/me falha", async () => {
    mockApiGet.mockResolvedValueOnce({
      data: { user: { id: "1", email: "joao@teste.com" } },
    });

    renderWithProvider();

    await waitFor(() => {
      expect(screen.getByTestId("loading").textContent).toBe("false");
    });

    expect(screen.getByTestId("user").textContent).not.toBe("null");

    mockApiGet.mockRejectedValueOnce(new Error("Unauthorized"));

    await act(async () => {
      screen.getByRole("button", { name: /refresh/i }).click();
    });

    await waitFor(() => {
      expect(screen.getByTestId("loading").textContent).toBe("false");
    });

    expect(screen.getByTestId("user").textContent).toBe("null");
  });
});
