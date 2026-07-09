import type { LoginCredentials } from "../../modules/auth/schemas/auth.schema";
import { api } from "./client";
import {
  BackendUserSchema,
  MeResponseSchema,
  type BackendUser,
  type MeResponse,
} from "./types";

const ROLE_PERMISSIONS: Record<BackendUser["role"], Record<string, string[]>> = {
  user: {},
  support: {
    dashboard: ["read"],
    scrapers: ["read"],
    observability: ["health"],
  },
  admin: {
    dashboard: ["read"],
    scrapers: ["read", "trigger"],
    observability: ["health", "metrics"],
    audit: ["read"],
    permissions: ["read"],
    users: ["block", "unblock", "reset_password"],
  },
  super_admin: {
    dashboard: ["read"],
    scrapers: ["read", "trigger"],
    observability: ["health", "metrics"],
    audit: ["read"],
    permissions: ["read", "manage"],
    users: ["read", "block", "unblock", "reset_password", "change_role", "delete"],
  },
};

function normalizeMeResponse(raw: unknown): MeResponse {
  const parsed = BackendUserSchema.safeParse(
    typeof raw === "object" && raw !== null && "user" in raw
      ? (raw as { user: unknown }).user
      : raw,
  );

  if (!parsed.success) {
    throw new Error("Resposta inválida de /auth/me: " + parsed.error.message);
  }

  const user = parsed.data;
  const fullName = [user.firstName, user.lastName].filter(Boolean).join(" ");
  const normalized = {
    user: {
      id: user.id,
      name:
        user.displayName ||
        fullName ||
        user.username ||
        user.email ||
        "Usuário",
      email: user.email ?? null,
      username: user.username ?? null,
      displayName: user.displayName ?? null,
      role: user.role,
      avatar: user.avatarUrl || "",
      permissions: ROLE_PERMISSIONS[user.role],
    },
  };

  const response = MeResponseSchema.safeParse(normalized);
  if (!response.success) {
    throw new Error("Resposta inválida de /auth/me: " + response.error.message);
  }

  return response.data;
}

export const authApi = {
  me: async (): Promise<MeResponse> => {
    const raw = await api.get<unknown>("/auth/me");
    return normalizeMeResponse(raw);
  },
  login: (data: LoginCredentials) => api.post<void>("/auth/login", data),
  logout: async () => {
    await api.post<void>("/auth/logout").catch(() => undefined);
  },
  oauthUrl: (provider: string) =>
    `${import.meta.env.VITE_API_URL}/auth/${provider}/url`,
};
