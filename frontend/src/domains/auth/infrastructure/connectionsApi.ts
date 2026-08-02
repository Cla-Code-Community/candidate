export type SupportedProvider = "google" | "linkedin" | "github";

export type ConnectionStatus = {
  provider: SupportedProvider;
  connected: boolean;
  connectedAt: string | null;
};

export type UserConnections = {
  hasPassword: boolean;
  connections: ConnectionStatus[];
};

function getBaseUrl(): string {
  const base = import.meta.env.VITE_API_BASE_URL;
  if (base && base.trim().length > 0) return base.replace(/\/+$/, "");
  return "";
}

function buildUrl(path: string): string {
  const normalized = path.startsWith("/") ? path : `/${path}`;
  const base = getBaseUrl();
  return base ? `${base}${normalized}` : normalized;
}

export async function getConnections(): Promise<UserConnections> {
  const response = await fetch(buildUrl("/auth/connections"), {
    credentials: "include",
  });
  if (!response.ok) throw new Error("Falha ao carregar conexões.");
  return (await response.json()) as UserConnections;
}

export async function disconnectProvider(
  provider: SupportedProvider,
): Promise<void> {
  const response = await fetch(buildUrl(`/auth/connections/${provider}`), {
    method: "DELETE",
    credentials: "include",
  });
  if (!response.ok) {
    const payload = (await response.json().catch(() => ({}))) as {
      message?: string;
    };
    throw new Error(payload.message ?? "Falha ao desconectar.");
  }
}

export async function connectProvider(
  provider: SupportedProvider,
): Promise<void> {
  const response = await fetch(
    buildUrl(`/auth/${provider}/url?intent=link`),
    { credentials: "include" },
  );
  if (!response.ok) throw new Error("Falha ao iniciar conexão.");
  const { url } = (await response.json()) as { url: string };
  window.location.href = url;
}
