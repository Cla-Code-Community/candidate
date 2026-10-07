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
  about?: string;
  experiences?: ExperienceInput[];
}

export interface GenerateResumeResult {
  /** ATS compatibility score (0-100), when the engine returned one. */
  atsScore: number | null;
  filename: string;
}

export interface AtsBreakdown {
  keywords: number;
  experience: number;
  technicalSkills: number;
  structure: number;
  achievements: number;
  readability: number;
}

export interface AtsReport {
  score: number;
  status: "PASSED" | "NEEDS_IMPROVEMENT" | "INSUFFICIENT_DATA";
  breakdown: AtsBreakdown;
  matchedKeywords: string[];
  missingKeywords: string[];
  weakSections: string[];
  recommendations: string[];
}

export interface ResumePreview {
  name: string;
  title: string;
  summary: string;
  contact: { email: string; phone: string; portfolio: string };
  links: { linkedin: string; github: string };
  skills: Record<string, string[]>;
  experience: Array<{
    empresa: string;
    cargo: string;
    periodo: string;
    stack: string;
    atividades: string[];
    resultados: string[];
  }>;
  projects: Array<{
    name: string;
    stack: string;
    description: string;
    highlights: string[];
    url?: string;
  }>;
  education: string[];
  languages: string[];
}

export interface ResumeAnalysis {
  resume: ResumePreview;
  atsReport: AtsReport;
  warnings: string[];
  sourcesUsed: string[];
  job: { title: string | null; hasDescription: boolean };
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

/**
 * Analyzes the candidate's profile against the job and returns a structured,
 * ATS-tailored resume preview + the ATS report + the sources used — without
 * downloading a file.
 */
export async function analyzeResume(
  params: Omit<GenerateResumeParams, "format"> & { format?: ResumeFormat },
): Promise<ResumeAnalysis> {
  const { data } = await api.post<ResumeAnalysis>("/resume/analyze", {
    ...params,
    format: params.format ?? "pdf",
  });
  return data;
}
