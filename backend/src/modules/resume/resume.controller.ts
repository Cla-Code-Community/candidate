import { Request, Response } from "express";
import { getIronSession } from "iron-session";
import { AppError } from "../../lib/errors";
import { sessionOptions } from "../../lib/session";
import { Session } from "../types/auth.types";
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

  // POST /resume/generate
  async generate(req: Request, res: Response) {
    const userId = await this.requireUserId(req, res);

    const {
      format,
      jobTitle,
      jobDescription,
      jobUrl,
      language,
      githubUrl,
      linkedinUrl,
      experiences,
    } = req.body as {
      format: "docx" | "pdf" | "md";
      jobTitle?: string;
      jobDescription?: string;
      jobUrl?: string;
      language?: string;
      githubUrl?: string;
      linkedinUrl?: string;
      experiences?: Array<{
        company: string;
        role: string;
        period?: string;
        description?: string;
        stack?: string[];
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

    const resume = await this.service.generateForUser(userId, {
      format,
      job,
      sources,
      experiences: experiences ?? null,
    });

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
}
