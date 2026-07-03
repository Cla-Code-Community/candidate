import type { JobFile, JobsResponse } from "@/domains/jobs/domain/job.types";

function normalizeBaseUrl(value: string | undefined): string {
  return typeof value === "string" ? value.trim().replace(/\/+$/, "") : "";
}

function getApiBaseUrl(): string {
  const configuredBaseUrl = normalizeBaseUrl(import.meta.env.VITE_API_BASE_URL);
  if (configuredBaseUrl) {
    return configuredBaseUrl;
  }

  return "";
}

function buildApiUrl(path: string): string {
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  const baseUrl = getApiBaseUrl();
  return baseUrl ? `${baseUrl}${normalizedPath}` : normalizedPath;
}

async function readPayload(
  response: Response,
): Promise<Record<string, unknown>> {
  const contentType = response.headers?.get?.("content-type") ?? "";

  if (!contentType || contentType.includes("application/json")) {
    try {
      const payload = await response.json();
      return payload && typeof payload === "object"
        ? (payload as Record<string, unknown>)
        : {};
    } catch {
      // Fallback below for non-JSON bodies returned by proxies/platforms.
    }
  }

  if (typeof response.text === "function") {
    const text = await response.text();
    return text ? { message: text } : {};
  }

  return {};
}

function buildError(message: unknown, fallback: string): Error {
  return new Error(typeof message === "string" && message ? message : fallback);
}

function readMessage(payload: unknown): string | undefined {
  if (payload && typeof payload === "object" && "message" in payload) {
    const message = (payload as { message?: unknown }).message;
    if (typeof message === "string") {
      return message;
    }
  }
  return undefined;
}

export async function fetchJobFiles(): Promise<JobFile[]> {
  const response = await fetch(buildApiUrl("/jobs/files"), {
    credentials: "include",
  });
  const payload = (await readPayload(response)) as { files?: unknown } & Record<
    string,
    unknown
  >;

  if (!response.ok) {
    throw buildError(
      readMessage(payload),
      "Falha ao listar arquivos de vagas.",
    );
  }

  if (!Array.isArray(payload.files)) {
    return [];
  }

  return payload.files.filter(
    (entry): entry is JobFile =>
      !!entry &&
      typeof entry === "object" &&
      "file" in entry &&
      typeof (entry as { file: unknown }).file === "string",
  );
}

export async function fetchJobsByFile(fileName: string): Promise<JobsResponse> {
  const suffix = fileName ? `?file=${encodeURIComponent(fileName)}` : "";
  const response = await fetch(buildApiUrl(`/jobs${suffix}`), {
    credentials: "include",
  });
  const payload = (await readPayload(response)) as Record<string, unknown>;

  if (!response.ok) {
    throw buildError(readMessage(payload), "Falha ao carregar vagas.");
  }

  return {
    jobs: Array.isArray(payload.jobs) ? payload.jobs : [],
    file: typeof payload.file === "string" ? payload.file : "",
    modifiedAt:
      typeof payload.modifiedAt === "string" ||
      typeof payload.modifiedAt === "number"
        ? payload.modifiedAt
        : null,
    total: Number(payload.total || 0),
  };
}

export async function fetchKeywords(): Promise<string[]> {
  const response = await fetch(buildApiUrl("/keywords"), {
    credentials: "include",
  });
  const payload = (await readPayload(response)) as {
    keywords?: unknown;
  } & Record<string, unknown>;

  if (!response.ok) {
    throw buildError(readMessage(payload), "Falha ao carregar keywords.");
  }

  return Array.isArray(payload.keywords) ? payload.keywords : [];
}

export async function saveKeywords(keywords: string[]): Promise<void> {
  const response = await fetch(buildApiUrl("/keywords"), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ keywords }),
    credentials: "include",
  });
  const payload = (await readPayload(response)) as Record<string, unknown>;

  if (!response.ok) {
    throw buildError(readMessage(payload), "Falha ao salvar keywords.");
  }
}

export async function runScraperRequest(): Promise<void> {
  const response = await fetch(buildApiUrl("/jobs/search"), {
    method: "POST",
    credentials: "include",
  });
  const payload = (await readPayload(response)) as Record<string, unknown>;

  if (!response.ok) {
    throw buildError(readMessage(payload), "Falha ao executar o scraper.");
  }
}
