import { db } from "../../db/client";
import { DB } from "../../db/types/types";
import { AppError } from "../../lib/errors";
import { UsersRepository } from "../users/users.repository";
import { resumeClient } from "./resume.client";
import { toNormalizedProfile } from "./resume.mapper";
import type {
  GeneratedResume,
  JobTarget,
  NormalizedProfile,
  ResumeAnalysis,
  ResumeFormat,
  ResumeSources,
} from "./resume.types";

interface DatedEntry {
  period?: string;
  startDate?: string;
  endDate?: string;
  current?: boolean;
}

export interface ExperienceEntry extends DatedEntry {
  company: string;
  role: string;
  description?: string;
  stack?: string[];
}

export interface EducationEntry extends DatedEntry {
  institution: string;
  degree?: string;
  field?: string;
}

function formatDateLabel(value?: string): string {
  if (!value) return "";
  const match = /^(\d{4})(?:-(\d{2}))?(?:-(\d{2}))?$/.exec(value.trim());
  if (!match) return value.trim();
  const [, year, month] = match;
  return month ? `${month}/${year}` : year;
}

function composePeriod(entry: DatedEntry): string | undefined {
  if (entry.period?.trim()) return entry.period.trim();
  const start = formatDateLabel(entry.startDate);
  if (!start) return undefined;
  const end = entry.current ? "Atual" : formatDateLabel(entry.endDate) || "Atual";
  return `${start} – ${end}`;
}

function toHighlights(description?: string): string[] {
  if (!description) return [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of description.split(/\r?\n/)) {
    const line = raw.replace(/^\s*[-–—•*]+\s*/, "").trim();
    const key = line.toLowerCase().replace(/\s+/g, " ").trim();
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(line);
  }
  return out;
}

export interface PersonalData {
  name?: string | null;
  email?: string | null;
  phone?: string | null;
  portfolio?: string | null;
}

export interface GenerateResumeParams {
  format: ResumeFormat;
  personal?: PersonalData | null;
  job?: JobTarget | null;
  sources?: ResumeSources | null;
  about?: string | null;
  experiences?: ExperienceEntry[] | null;
  education?: EducationEntry[] | null;
}

const PLACEHOLDER_PATTERNS: RegExp[] = [
  /^local developer$/i,
  /^candidato$/i,
  /^dev$/i,
  /@localhost/i,
  /localhost\.test/i,
  /@example\.(com|org|net)/i,
];

function isPlaceholder(value?: string | null): boolean {
  const v = value?.trim();
  if (!v) return true;
  return PLACEHOLDER_PATTERNS.some((re) => re.test(v));
}

/** Override wins; otherwise keep the profile value unless it's a known placeholder. */
function preferConfirmed(override?: string | null, current?: string): string | undefined {
  const o = override?.trim();
  if (o) return o;
  return isPlaceholder(current) ? undefined : current?.trim() || undefined;
}

export class ResumeService {
  constructor(private readonly tx: DB = db) {}

  /**
   * Builds a resume for the authenticated candidate. The candidate is always
   * resolved from the session-derived `userId` — never from client input — so a
   * candidate can only ever generate their own resume (spec §19, anti-IDOR).
   */
  private async buildProfile(
    userId: string,
    params: GenerateResumeParams,
  ): Promise<NormalizedProfile> {
    const user = await new UsersRepository(this.tx).findById(userId);
    if (!user) {
      throw AppError.notFound("Usuário não encontrado");
    }

    const profile = toNormalizedProfile(user);

    // Personal data confirmed by the candidate takes precedence over the stored
    // profile; known dev placeholders (e.g. "Local Developer", "dev@localhost.test")
    // are dropped instead of being presented as confirmed data (spec §3).
    const personal = params.personal ?? {};
    profile.name = preferConfirmed(personal.name, profile.name) ?? profile.name;
    profile.contact = {
      ...profile.contact,
      email: preferConfirmed(personal.email, profile.contact.email),
      phone: preferConfirmed(personal.phone, profile.contact.phone),
      website: preferConfirmed(personal.portfolio, profile.contact.website),
    };

    // Real professional experience provided by the candidate (e.g. the jobs they
    // hold on LinkedIn). Mapped as `source: "manual"` — never fabricated.
    const experiences = params.experiences ?? [];
    if (experiences.length > 0) {
      profile.experience = experiences.map((exp) => ({
        company: exp.company,
        role: exp.role,
        period: composePeriod(exp),
        startDate: exp.startDate?.trim() || undefined,
        endDate: exp.current ? undefined : exp.endDate?.trim() || undefined,
        current: exp.current,
        stack: exp.stack,
        highlights: toHighlights(exp.description),
        source: "manual" as const,
      }));
    }

    const education = params.education ?? [];
    if (education.length > 0) {
      profile.education = education.map((edu) => ({
        institution: edu.institution,
        degree: edu.degree,
        field: edu.field,
        period: composePeriod(edu),
        source: "manual" as const,
      }));
    }

    return profile;
  }

  async generateForUser(
    userId: string,
    params: GenerateResumeParams,
  ): Promise<GeneratedResume> {
    const profile = await this.buildProfile(userId, params);
    return resumeClient.generate({
      profile,
      job: params.job ?? null,
      sources: params.sources ?? null,
      about: params.about ?? null,
      format: params.format,
    });
  }

  /** Same inputs as generate, but returns a JSON preview + ATS analysis. */
  async analyzeForUser(
    userId: string,
    params: GenerateResumeParams,
  ): Promise<ResumeAnalysis> {
    const profile = await this.buildProfile(userId, params);
    return resumeClient.analyze({
      profile,
      job: params.job ?? null,
      sources: params.sources ?? null,
      about: params.about ?? null,
      format: params.format,
    });
  }
}
