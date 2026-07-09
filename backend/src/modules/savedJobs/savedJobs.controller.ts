import { Request, Response } from "express";
import { getIronSession } from "iron-session";
import { AppError } from "../../lib/errors";
import { sessionOptions } from "../../lib/session";
import { Session } from "../types/auth.types";
import { SavedJobsService } from "./savedJobs.service";

export class SavedJobsController {
  constructor(private readonly service: SavedJobsService) {}

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

  // GET /api/saved-jobs
  async getAll(req: Request, res: Response) {
    const userId = await this.requireUserId(req, res);
    const jobs = await this.service.getAll(userId);
    return res.json(jobs);
  }

  // GET /api/saved-jobs/:id
  async getById(req: Request, res: Response) {
    const userId = await this.requireUserId(req, res);
    const job = await this.service.getById(userId, req.params.id as string);
    if (!job) {
      throw AppError.notFound("Vaga não encontrada");
    }
    return res.json(job);
  }

  // POST /api/saved-jobs
  async create(req: Request, res: Response) {
    const userId = await this.requireUserId(req, res);
    const job = await this.service.create(userId, req.body);
    return res.status(201).json(job);
  }

  // PATCH /api/saved-jobs/:id
  async update(req: Request, res: Response) {
    const userId = await this.requireUserId(req, res);
    const job = await this.service.update(
      userId,
      req.params.id as string,
      req.body,
    );
    return res.json(job);
  }

  // DELETE /api/saved-jobs/:id
  async delete(req: Request, res: Response) {
    const userId = await this.requireUserId(req, res);
    await this.service.delete(userId, req.params.id as string);
    return res.status(204).send();
  }
}
