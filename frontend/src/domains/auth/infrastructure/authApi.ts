import type {
  LoginCredentials,
  RegisterData,
} from "@/domains/auth/domain/auth.types";
import { parseApiError } from "@/shared/lib/apiError";

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

async function parseResponse(response: Response): Promise<unknown> {
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

function throwIfNotOk(
  response: Response,
  payload: unknown,
  fallback: string,
): void {
  if (!response.ok) {
    throw parseApiError(payload, response.status, fallback);
  }
}

export async function login(credentials: LoginCredentials) {
  const response = await fetch(buildUrl("/auth/login"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(credentials),
    credentials: "include",
  });

  const payload = await parseResponse(response);
  throwIfNotOk(response, payload, "Falha ao fazer login.");
  return payload;
}

export async function register(userData: RegisterData) {
  const response = await fetch(buildUrl("/auth/register"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      email: userData.email,
      password: userData.password,
      name: userData.name,
      phone: userData.phone,
      cpf: userData.cpf,
      technologies: userData.technologies,
      level: userData.level,
      role: userData.role,
    }),
    credentials: "include",
  });

  const payload = await parseResponse(response);
  throwIfNotOk(response, payload, "Falha ao cadastrar.");
  return payload;
}

export async function logout() {
  const response = await fetch(buildUrl("/auth/logout"), {
    method: "POST",
    credentials: "include",
  });

  const payload = await parseResponse(response);
  throwIfNotOk(response, payload, "Falha ao fazer logout.");
  return payload;
}

export async function getCurrentUser() {
  const response = await fetch(buildUrl("/auth/me"), {
    credentials: "include",
  });

  const payload = await parseResponse(response);
  throwIfNotOk(response, payload, "Falha ao carregar usuário.");
  return payload;
}

export async function getGoogleAuthUrl(): Promise<string> {
  const response = await fetch(buildUrl("/auth/google/url"), {
    credentials: "include",
  });

  const payload = await parseResponse(response);
  throwIfNotOk(response, payload, "Falha ao obter URL de autenticacao Google.");
  return (payload as { url: string }).url;
}

export async function getGithubAuthUrl(): Promise<string> {
  const response = await fetch(buildUrl("/auth/github/url"), {
    credentials: "include",
  });

  const payload = await parseResponse(response);
  throwIfNotOk(response, payload, "Falha ao obter URL de autenticacao Github.");
  return (payload as { url: string }).url;
}

export async function getLinkedinAuthUrl(): Promise<string> {
  const response = await fetch(buildUrl("/auth/linkedin/url"), {
    credentials: "include",
  });

  const payload = await parseResponse(response);
  throwIfNotOk(
    response,
    payload,
    "Falha ao obter URL de autenticacao LinkedIn.",
  );
  return (payload as { url: string }).url;
}
