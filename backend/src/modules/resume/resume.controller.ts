import { Request, Response } from "express";
import { getIronSession } from "iron-session";
import { AppError } from "../../lib/errors";
import { sessionOptions } from "../../lib/session";
import { Session } from "../types/auth.types";
import { resumeClient } from "./resume.client";
import { ResumeService } from "./resume.service";
import type { JobTarget } from "./resume.types";

export class ResumeController {
  constructor(private readonly service: ResumeService) {}

  private async getSession(req: Request, res: Response) {
    return getIronSession<Session>(req, res, sessionOptions);
  }

  private async requireUserId(req: Request, res: Response): Promise<string> {
    const session = await this.getSession(req, res);
    if (!session.userId) {
      throw AppError.unauthorized();
    }
    return session.userId;
  }

  private parseParams(req: Request) {
    const {
      format,
      name,
      email,
      phone,
      portfolio,
      jobTitle,
      jobDescription,
      jobUrl,
      language,
      githubUrl,
      linkedinUrl,
      about,
      experiences,
      education,
    } = req.body as {
      format: "docx" | "pdf" | "md";
      name?: string;
      email?: string;
      phone?: string;
      portfolio?: string;
      jobTitle?: string;
      jobDescription?: string;
      jobUrl?: string;
      language?: string;
      githubUrl?: string;
      linkedinUrl?: string;
      about?: string;
      experiences?: Array<{
        company: string;
        role: string;
        period?: string;
        startDate?: string;
        endDate?: string;
        current?: boolean;
        description?: string;
        stack?: string[];
      }>;
      education?: Array<{
        institution: string;
        degree?: string;
        field?: string;
        period?: string;
        startDate?: string;
        endDate?: string;
        current?: boolean;
      }>;
    };

    const job: JobTarget | null =
      jobTitle || jobDescription || jobUrl
        ? { title: jobTitle, description: jobDescription, url: jobUrl, language }
        : null;

    const sources =
      githubUrl || linkedinUrl
        ? { github: githubUrl, linkedin: linkedinUrl }
        : null;

    return {
      format,
      personal: {
        name: name ?? null,
        email: email ?? null,
        phone: phone ?? null,
        portfolio: portfolio ?? null,
      },
      job,
      sources,
      about: about ?? null,
      experiences: experiences ?? null,
      education: education ?? null,
    };
  }

  // POST /resume/analyze
  async analyze(req: Request, res: Response) {
    const userId = await this.requireUserId(req, res);
    const analysis = await this.service.analyzeForUser(userId, this.parseParams(req));
    return res.status(200).json(analysis);
  }

  // POST /resume/generate
  async generate(req: Request, res: Response) {
    const userId = await this.requireUserId(req, res);
    const resume = await this.service.generateForUser(userId, this.parseParams(req));

    res.setHeader("Content-Type", resume.contentType);
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="${resume.filename}"`,
    );
    if (resume.atsReport) {
      res.setHeader("X-Ats-Score", String(resume.atsReport.score));
      res.setHeader(
        "X-Ats-Report",
        Buffer.from(JSON.stringify(resume.atsReport), "utf-8").toString("base64"),
      );
      res.setHeader(
        "Access-Control-Expose-Headers",
        "X-Ats-Score, X-Ats-Report, Content-Disposition",
      );
    }

    return res.status(200).send(resume.content);
  }

  // POST /resume/render — renderiza o conteúdo já produzido no preview (sem IA).
  async render(req: Request, res: Response) {
    await this.requireUserId(req, res);
    const { resume, format, filename, atsScore } = req.body as {
      resume: unknown;
      format?: "docx" | "pdf" | "md";
      filename?: string;
      atsScore?: number | null;
    };

    const rendered = await resumeClient.render({
      resume,
      format: format ?? "pdf",
      filename,
      atsScore: atsScore ?? null,
    });

    res.setHeader("Content-Type", rendered.contentType);
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="${rendered.filename}"`,
    );
    if (rendered.atsReport) {
      res.setHeader("X-Ats-Score", String(rendered.atsReport.score));
      res.setHeader("Access-Control-Expose-Headers", "X-Ats-Score, Content-Disposition");
    }

    return res.status(200).send(rendered.content);
  }
}
