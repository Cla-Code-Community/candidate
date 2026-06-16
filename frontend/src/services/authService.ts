/* eslint-disable @typescript-eslint/no-explicit-any */

function getBaseUrl(): string {
  const base = import.meta.env.VITE_API_BASE_URL;

  if (base && base.trim().length > 0) {
    return base.replace(/\/+$/, "");
  }

  return "";
}

function buildUrl(path: string): string {
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  const base = getBaseUrl();

  return base ? `${base}${normalizedPath}` : normalizedPath;
}

async function parseResponse(response: Response) {
  const contentType = response.headers.get("content-type") ?? "";

  try {
    if (contentType.includes("application/json")) {
      return await response.json();
    }

    const text = await response.text();
    return text ? { message: text } : {};
  } catch {
    return {};
  }
}

function extractMessage(payload: any): string | undefined {
  return payload?.message && typeof payload.message === "string"
    ? payload.message
    : undefined;
}

function createError(payload: any, fallback: string) {
  return new Error(extractMessage(payload) || fallback);
}

export interface LoginCredentials {
  email: string;
  password: string;
}

export interface RegisterData {
  email: string;
  password: string;
  name: string;
  phone?: string;
  cpf?: string;
}

export async function login(credentials: LoginCredentials) {
  const response = await fetch(buildUrl("/api/auth/login"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(credentials),
    credentials: "include",
  });

  const payload = await parseResponse(response);

  if (!response.ok) {
    throw createError(payload, "Falha ao fazer login.");
  }

  return payload;
}

export async function register(userData: RegisterData) {
  const response = await fetch(buildUrl("/api/auth/register"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      email: userData.email,
      password: userData.password,
      name: userData.name,
      phone: userData.phone,
      cpf: userData.cpf,
    }),
    credentials: "include",
  });

  const payload = await parseResponse(response);

  if (!response.ok) {
    throw createError(payload, "Falha ao cadastrar.");
  }

  return payload;
}

export async function logout() {
  const response = await fetch(buildUrl("/api/auth/logout"), {
    method: "POST",
    credentials: "include",
  });

  const payload = await parseResponse(response);

  if (!response.ok) {
    throw createError(payload, "Falha ao fazer logout.");
  }

  return payload;
}

export async function getCurrentUser() {
  const response = await fetch(buildUrl("/api/auth/me"), {
    credentials: "include",
  });

  const payload = await parseResponse(response);

  if (!response.ok) {
    throw createError(payload, "Falha ao carregar usuário.");
  }

  return payload;
}

export async function getGoogleAuthUrl(): Promise<string> {
  const response = await fetch(buildUrl("/api/auth/google/url"), {
    credentials: "include",
  });

  const payload = await parseResponse(response);

  if (!response.ok) {
    throw createError(payload, "Falha ao obter URL de autenticacao Google.");
  }

  return payload.url;
}