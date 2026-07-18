import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "@/shared/lib/apiError";

const userApiMock = vi.hoisted(() => ({
  getUserProfile: vi.fn(),
  getUserPreferences: vi.fn(),
  updateUserProfile: vi.fn(),
  updateUserPreferences: vi.fn(),
  createUserPreferences: vi.fn(),
}));

vi.mock("@/domains/new_dashboard/infrastructure/userDashboardApi", () => ({
  getUserProfile: userApiMock.getUserProfile,
  getUserPreferences: userApiMock.getUserPreferences,
  updateUserProfile: userApiMock.updateUserProfile,
  updateUserPreferences: userApiMock.updateUserPreferences,
  createUserPreferences: userApiMock.createUserPreferences,
}));

import { initialPreferences, initialUser } from "@/domains/new_dashboard/constants";
import { useUserDashboardData } from "@/domains/new_dashboard/hooks/useUserDashboardData";
import type { User } from "@/domains/auth/domain/auth.types";

const user: User = {
  id: "user-1",
  email: "maria@exemplo.com",
  displayName: "Maria Clara",
  avatarUrl: "https://cdn.example.com/auth.png",
};

describe("useUserDashboardData", () => {
  beforeEach(() => {
    userApiMock.getUserProfile.mockReset();
    userApiMock.getUserPreferences.mockReset();
    userApiMock.updateUserProfile.mockReset();
    userApiMock.updateUserPreferences.mockReset();
    userApiMock.createUserPreferences.mockReset();
  });

  it("carrega perfil e preferências do backend", async () => {
    userApiMock.getUserProfile.mockResolvedValue({
      ...initialUser,
      displayName: "Maria Clara",
      avatarUrl: "https://cdn.example.com/profile.png",
    });
    userApiMock.getUserPreferences.mockResolvedValue({
      ...initialPreferences,
      searchLocation: "Portugal",
    });

    const { result } = renderHook(() => useUserDashboardData(user));

    await waitFor(() => {
      expect(result.current.isLoadingUserData).toBe(false);
    });

    expect(result.current.userProfile.avatarUrl).toBe(
      "https://cdn.example.com/profile.png",
    );
    expect(result.current.searchPreferences.searchLocation).toBe("Portugal");
  });

  it("usa fallback quando preferências não existem", async () => {
    userApiMock.getUserProfile.mockResolvedValue(initialUser);
    userApiMock.getUserPreferences.mockRejectedValue(
      new ApiError("NOT_FOUND", "missing", 404),
    );

    const { result } = renderHook(() => useUserDashboardData(user));

    await waitFor(() => {
      expect(result.current.isLoadingUserData).toBe(false);
    });

    expect(result.current.searchPreferences).toEqual(initialPreferences);
    expect(result.current.userDataError).toBe("");
  });

  it("salva perfil e cria ou atualiza preferências conforme existência", async () => {
    userApiMock.getUserProfile.mockResolvedValue(initialUser);
    userApiMock.getUserPreferences.mockRejectedValue(
      new ApiError("NOT_FOUND", "missing", 404),
    );
    userApiMock.updateUserProfile.mockResolvedValue({
      ...initialUser,
      displayName: "Maria Clara",
    });
    userApiMock.createUserPreferences.mockResolvedValue(initialPreferences);

    const { result } = renderHook(() => useUserDashboardData(user));

    await waitFor(() => {
      expect(result.current.isLoadingUserData).toBe(false);
    });

    await act(async () => {
      await result.current.saveUserProfile({
        ...result.current.userProfile,
        displayName: "Maria Clara",
      });
    });

    await act(async () => {
      await result.current.saveSearchPreferences({
        ...result.current.searchPreferences,
        searchLocation: "Brasil",
      });
    });

    expect(userApiMock.updateUserProfile).toHaveBeenCalledWith(
      expect.objectContaining({ displayName: "Maria Clara" }),
    );
    expect(userApiMock.createUserPreferences).toHaveBeenCalledWith(
      expect.objectContaining({ searchLocation: "Brasil" }),
    );
  });

  it("atualiza preferências existentes e reporta erro ao salvar perfil", async () => {
    const onError = vi.fn();

    userApiMock.getUserProfile.mockResolvedValue(initialUser);
    userApiMock.getUserPreferences.mockResolvedValue(initialPreferences);
    userApiMock.updateUserProfile.mockRejectedValue(new Error("sem conexão"));
    userApiMock.updateUserPreferences.mockResolvedValue(initialPreferences);

    const { result } = renderHook(() =>
      useUserDashboardData(user, { onError }),
    );

    await waitFor(() => {
      expect(result.current.isLoadingUserData).toBe(false);
    });

    await act(async () => {
      await expect(
        result.current.saveUserProfile({
          ...result.current.userProfile,
          displayName: "Maria Clara",
        }),
      ).rejects.toThrow("sem conexão");
    });

    await act(async () => {
      await result.current.saveSearchPreferences({
        ...result.current.searchPreferences,
        searchLocation: "Portugal",
      });
    });

    expect(userApiMock.updateUserPreferences).toHaveBeenCalledWith(
      expect.objectContaining({ searchLocation: "Portugal" }),
    );
    expect(onError).toHaveBeenCalledWith("sem conexão");
  });

  it("preserva perfil mínimo quando o backend falha", async () => {
    userApiMock.getUserProfile.mockRejectedValue(new Error("offline"));
    userApiMock.getUserPreferences.mockResolvedValue(initialPreferences);

    const { result } = renderHook(() => useUserDashboardData(user));

    await waitFor(() => {
      expect(result.current.isLoadingUserData).toBe(false);
    });

    expect(result.current.userProfile.displayName).toBe("Maria Clara");
    expect(result.current.userDataError).toMatch(/perfil completo/i);
  });

  it("reporta erro quando preferências falham sem ser 404", async () => {
    const onError = vi.fn();

    userApiMock.getUserProfile.mockResolvedValue(initialUser);
    userApiMock.getUserPreferences.mockRejectedValue(new Error("timeout"));

    const { result } = renderHook(() =>
      useUserDashboardData(user, { onError }),
    );

    await waitFor(() => {
      expect(result.current.isLoadingUserData).toBe(false);
    });

    expect(result.current.searchPreferences).toEqual(initialPreferences);
    expect(result.current.userDataError).toMatch(/preferências temporárias/i);
    expect(onError).toHaveBeenCalledWith(
      expect.stringContaining("Preferências temporárias foram aplicadas"),
    );
  });

  it("usa nome e e-mail como fallback quando displayName não vem preenchido", async () => {
    userApiMock.getUserProfile.mockRejectedValue(new Error("offline"));
    userApiMock.getUserPreferences.mockResolvedValue(initialPreferences);

    const { result } = renderHook(() =>
      useUserDashboardData({
        id: "user-2",
        email: "ana.silva@exemplo.com",
        name: "Ana Silva",
      }),
    );

    await waitFor(() => {
      expect(result.current.isLoadingUserData).toBe(false);
    });

    expect(result.current.userProfile.displayName).toBe("Ana Silva");
    expect(result.current.userProfile.username).toBe("anasilva");
  });
});
