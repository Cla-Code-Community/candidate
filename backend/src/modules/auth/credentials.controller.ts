import { Request, Response } from "express";
import { AppError } from "../../lib/errors";
import { CredentialsService } from "./credentials.service";

export class CredentialsController {
  constructor(private readonly service: CredentialsService) {}

  async register(req: Request, res: Response) {
    const { user, session: userSession } = await this.service.register(
      req.body,
    );

    req.session.userId = userSession.userId;
    req.session.role = userSession.role;
    await req.session.save();

    return res.status(201).json({ user, session: userSession });
  }

  async login(req: Request, res: Response) {
    const { user, session: userSession } = await this.service.login(req.body);

    req.session.userId = userSession.userId;
    req.session.role = userSession.role;
    await req.session.save();

    return res.json({ user, session: userSession });
  }

  async logout(req: Request, res: Response) {
    await req.session.destroy();
    return res.json({ ok: true });
  }

  async me(req: Request, res: Response) {
    if (!req.session.userId) {
      throw AppError.unauthorized();
    }

    const user = await this.service.findById(req.session.userId);
    if (!user) {
      await req.session.destroy();
      throw AppError.unauthorized();
    }

    return res.json({ user });
  }
}
