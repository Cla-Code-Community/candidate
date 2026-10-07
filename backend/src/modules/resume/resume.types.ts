/**
 * HTTP contract shared with the ats-forge resume microservice. Kept as a local
 * type (not a cross-repo import) because ats-forge is an independent backend
 * reachable only over HTTP — we depend on its API shape, not its code.
 */

export type ResumeFormat = "docx" | "pdf" | "md";

export type DataSource = "github" | "linkedin" | "candidate" | "manual";

export interface NormalizedProfile {
  name: string;
  headline?: string;
  summary?: string;
  contact: {
    email?: string;
    phone?: string;
    location?: string;
    website?: string;
  };
  experience: Array<{
    company: string;
    role: string;
    period?: string;
    startDate?: string;
    endDate?: string;
    current?: boolean;
    stack?: string[];
    highlights?: string[];
    results?: string[];
    source?: DataSource;
  }>;
  education: Array<{
    institution: string;
    degree?: string;
    field?: string;
    period?: string;
    source?: DataSource;
  }>;
  skills: Array<{
    name: string;
    years?: number;
    category?: string;
    source?: DataSource;
  }>;
  projects: Array<{
    name: string;
    description?: string;
    url?: string;
    stack?: string[];
    highlights?: string[];
    source?: DataSource;
  }>;
  links: Array<{ type: string; url: string; label?: string }>;
  languages: Array<{ name: string; level?: string }>;
}

export interface JobTarget {
  title?: string;
  description?: string;
  url?: string;
  language?: string;
  seniority?: string;
}

export interface ResumeSources {
  github?: string;
  linkedin?: string;
}

export type AtsStatus = "PASSED" | "NEEDS_IMPROVEMENT" | "INSUFFICIENT_DATA";

export interface AtsReport {
  score: number;
  status?: AtsStatus;
  breakdown: {
    keywords: number;
    experience: number;
    technicalSkills: number;
    structure: number;
    achievements: number;
    readability: number;
  };
  matchedKeywords: string[];
  missingKeywords: string[];
  weakSections?: string[];
  recommendations?: string[];
  warnings?: string[];
}

export interface GeneratedResume {
  content: Buffer;
  contentType: string;
  filename: string;
  atsReport: AtsReport | null;
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
