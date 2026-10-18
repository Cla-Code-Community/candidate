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
const TIMEOUT_MS = config.atsForgeTimeoutMs || 120000;

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


function buildHeaders(): Record<string, string> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (config.atsForgeApiKey) headers["x-api-key"] = config.atsForgeApiKey;
  return headers;
}

export interface RenderResumeRequest {
  resume: unknown;
  format: ResumeFormat;
  filename?: string;
  atsScore?: number | null;
}

async function postToAtsForge(
  path: string,
  payload: GenerateResumeRequest | RenderResumeRequest,
): Promise<Response> {
  let response: Response;
  const startedAt = Date.now();
  try {
    response = await fetch(`${config.atsForgeUrl}${path}`, {
      method: "POST",
      headers: buildHeaders(),
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
  } catch (err) {
    console.error(
      `[resume] falha ao chamar ${config.atsForgeUrl}${path} após ${Date.now() - startedAt}ms: ${(err as Error).message}`,
    );
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

  async render(payload: RenderResumeRequest): Promise<GeneratedResume> {
    const response = await postToAtsForge("/resumes/render", payload);
    const arrayBuffer = await response.arrayBuffer();
    const rawScore = response.headers.get("x-ats-score");
    const score = rawScore !== null ? Number(rawScore) : NaN;
    return {
      content: Buffer.from(arrayBuffer),
      contentType:
        response.headers.get("content-type") ?? "application/octet-stream",
      filename: filenameFromDisposition(
        response.headers.get("content-disposition"),
        `${payload.filename ?? "curriculo"}.${payload.format}`,
      ),
      atsReport: Number.isFinite(score)
        ? ({ score } as unknown as GeneratedResume["atsReport"])
        : null,
    };
  },
};
