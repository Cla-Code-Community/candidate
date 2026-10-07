import { api } from "@/shared/lib/apiClient";

export type ResumeFormat = "docx" | "pdf" | "md";

export interface ExperienceInput {
  company: string;
  role: string;
  period?: string;
  description?: string;
}

export interface GenerateResumeParams {
  format: ResumeFormat;
  jobTitle?: string;
  jobDescription?: string;
  jobUrl?: string;
  language?: string;
  githubUrl?: string;
  linkedinUrl?: string;
  experiences?: ExperienceInput[];
}

export interface GenerateResumeResult {
  /** ATS compatibility score (0-100), when the engine returned one. */
  atsScore: number | null;
  filename: string;
}

const EXTENSION_FALLBACK: Record<ResumeFormat, string> = {
  docx: "docx",
  pdf: "pdf",
  md: "md",
};

function parseFilename(
  disposition: string | undefined,
  format: ResumeFormat,
): string {
  if (disposition) {
    const match = /filename="?([^"]+)"?/i.exec(disposition);
    if (match?.[1]) return match[1];
  }
  return `curriculo.${EXTENSION_FALLBACK[format]}`;
}

function triggerDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

/**
 * Requests a resume from the candidate backend (which builds the normalized
 * profile from the logged-in user, enriches it from the public GitHub/LinkedIn
 * links via the ats-forge service, and streams back the file). Uses the same
 * cookie-authenticated `api` instance as the rest of the app.
 */
export async function generateResume(
  params: GenerateResumeParams,
): Promise<GenerateResumeResult> {
  const response = await api.post("/resume/generate", params, {
    responseType: "blob",
  });

  const filename = parseFilename(
    response.headers["content-disposition"],
    params.format,
  );

  triggerDownload(response.data as Blob, filename);

  const rawScore = response.headers["x-ats-score"];
  const atsScore = rawScore !== undefined ? Number(rawScore) : null;

  return {
    atsScore: atsScore !== null && Number.isFinite(atsScore) ? atsScore : null,
    filename,
  };
}
