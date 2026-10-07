import { db } from "../../db/client";
import { DB } from "../../db/types/types";
import { AppError } from "../../lib/errors";
import { UsersRepository } from "../users/users.repository";
import { resumeClient } from "./resume.client";
import { toNormalizedProfile } from "./resume.mapper";
import type {
  GeneratedResume,
  JobTarget,
  ResumeFormat,
  ResumeSources,
} from "./resume.types";

export interface ExperienceEntry {
  company: string;
  role: string;
  period?: string;
  description?: string;
  stack?: string[];
}

export interface GenerateResumeParams {
  format: ResumeFormat;
  job?: JobTarget | null;
  sources?: ResumeSources | null;
  experiences?: ExperienceEntry[] | null;
}

export class ResumeService {
  constructor(private readonly tx: DB = db) {}

  /**
   * Builds a resume for the authenticated candidate. The candidate is always
   * resolved from the session-derived `userId` — never from client input — so a
   * candidate can only ever generate their own resume (spec §19, anti-IDOR).
   */
  async generateForUser(
    userId: string,
    params: GenerateResumeParams,
  ): Promise<GeneratedResume> {
    const user = await new UsersRepository(this.tx).findById(userId);
    if (!user) {
      throw AppError.notFound("Usuário não encontrado");
    }

    const profile = toNormalizedProfile(user);

    // Real professional experience provided by the candidate (e.g. the jobs they
    // hold on LinkedIn). Mapped as `source: "manual"` — never fabricated.
    const experiences = params.experiences ?? [];
    if (experiences.length > 0) {
      profile.experience = experiences.map((exp) => ({
        company: exp.company,
        role: exp.role,
        period: exp.period,
        stack: exp.stack,
        highlights: exp.description
          ? exp.description
              .split(/\r?\n/)
              .map((line) => line.replace(/^[-•*]\s*/, "").trim())
              .filter(Boolean)
          : [],
        source: "manual" as const,
      }));
    }

    return resumeClient.generate({
      profile,
      job: params.job ?? null,
      sources: params.sources ?? null,
      format: params.format,
    });
  }
}
