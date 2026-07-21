import { Request, Response } from "express";
import { AppError } from "../../lib/errors";
import { NotificationsService } from "./notifications.service";

export class NotificationsController {
  constructor(private readonly service: NotificationsService) {}

  private requireUserId(req: Request): string {
    const userId = req.session?.userId;
    if (!userId) {
      throw AppError.unauthorized();
    }
    return userId;
  }

  async list(req: Request, res: Response) {
    const userId = this.requireUserId(req);
    const result = await this.service.list(userId, req.query as any);
    return res.json(result);
  }

  async markRead(req: Request, res: Response) {
    const userId = this.requireUserId(req);
    const notification = await this.service.markRead(
      userId,
      req.params.id as string,
    );
    return res.json(notification);
  }

  async markAllRead(req: Request, res: Response) {
    const userId = this.requireUserId(req);
    const result = await this.service.markAllRead(
      userId,
      (req.query as { channel?: "notification" | "message" }).channel,
    );
    return res.json(result);
  }

  async clear(req: Request, res: Response) {
    const userId = this.requireUserId(req);
    const result = await this.service.clear(
      userId,
      (req.query as { channel?: "notification" | "message" }).channel,
    );
    return res.json(result);
  }
}
