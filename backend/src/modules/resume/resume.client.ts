import { config } from "../../config";
import { AppError } from "../../lib/errors";
import type {
  AtsReport,
  GeneratedResume,
  JobTarget,
  NormalizedProfile,
  ResumeAnalysis,
  ResumeFormat,
  ResumeSources,
} from "./resume.types";

// GitHub enrichment happens inside ats-forge, so allow a longer budget.
const TIMEOUT_MS = 20000;

export interface GenerateResumeRequest {
  profile: NormalizedProfile;
  job?: JobTarget | null;
  sources?: ResumeSources | null;
  about?: string | null;
  format: ResumeFormat;
  filename?: string;
}

function decodeReport(headerValue: string | null): AtsReport | null {
  if (!headerValue) return null;
  try {
    const json = Buffer.from(headerValue, "base64").toString("utf-8");
    return JSON.parse(json) as AtsReport;
  } catch {
    return null;
  }
}

function filenameFromDisposition(
  disposition: string | null,
  fallback: string,
): string {
  if (!disposition) return fallback;
  const match = /filename="?([^"]+)"?/i.exec(disposition);
  return match?.[1] ?? fallback;
}

/**
 * Thin HTTP client for the ats-forge resume microservice. Mirrors the
 * `scraperClient` pattern: a single `request` helper with a timeout that maps
 * transport/HTTP failures onto `AppError`.
 */
function buildHeaders(): Record<string, string> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (config.atsForgeApiKey) headers["x-api-key"] = config.atsForgeApiKey;
  return headers;
}

async function postToAtsForge(
  path: string,
  payload: GenerateResumeRequest,
): Promise<Response> {
  let response: Response;
  try {
    response = await fetch(`${config.atsForgeUrl}${path}`, {
      method: "POST",
      headers: buildHeaders(),
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
  } catch (err) {
    throw AppError.internal(
      "Não foi possível contatar o serviço de geração de currículos.",
      { cause: (err as Error).message },
    );
  }

  if (response.status === 400) {
    const body = await response.json().catch(() => null);
    throw AppError.validation(
      body?.message ?? "Dados insuficientes para gerar o currículo.",
      body?.details,
    );
  }

  if (!response.ok) {
    throw AppError.internal(
      `Falha ao gerar currículo (ats-forge respondeu HTTP ${response.status}).`,
    );
  }

  return response;
}

export const resumeClient = {
  async generate(payload: GenerateResumeRequest): Promise<GeneratedResume> {
    const response = await postToAtsForge("/resumes/generate", payload);

    const arrayBuffer = await response.arrayBuffer();
    return {
      content: Buffer.from(arrayBuffer),
      contentType:
        response.headers.get("content-type") ?? "application/octet-stream",
      filename: filenameFromDisposition(
        response.headers.get("content-disposition"),
        `${payload.filename ?? "curriculo"}.${payload.format}`,
      ),
      atsReport: decodeReport(response.headers.get("x-ats-report")),
    };
  },

  async analyze(payload: GenerateResumeRequest): Promise<ResumeAnalysis> {
    const response = await postToAtsForge("/resumes/analyze", payload);
    return (await response.json()) as ResumeAnalysis;
  },
};
