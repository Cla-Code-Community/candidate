import { Request, Response } from "express";
import { z } from "zod";
import { LoginSchema, RegisterSchema } from "../types/credentials.types";
import { CredentialsService } from "./credentials.service";

export class CredentialsController {
  constructor(private readonly service: CredentialsService) {}

  async register(req: Request, res: Response) {
    try {
      const input = RegisterSchema.parse(req.body);
      const { user, session: userSession } = await this.service.register(input);

      req.session.userId = user.id;
      await req.session.save();

      return res.status(201).json({ user, session: userSession });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: error.format() });
      }
      const message = error instanceof Error ? error.message : "Erro interno";
      const status = message === "Email já cadastrado" ? 409 : 500;
      return res.status(status).json({ error: message });
    }
  }

  async login(req: Request, res: Response) {
    try {
      const input = LoginSchema.parse(req.body);
      const { user, session: userSession } = await this.service.login(input);

      req.session.userId = user.id;
      await req.session.save();

      return res.json({ user, session: userSession });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: error.format() });
      }
      const message = error instanceof Error ? error.message : "Erro interno";
      const status = message === "Credenciais inválidas" ? 401 : 500;
      return res.status(status).json({ error: message });
    }
  }

  async logout(req: Request, res: Response) {
    await req.session.destroy();
    return res.json({ ok: true });
  }

  async me(req: Request, res: Response) {
    if (!req.session.userId) {
      return res.status(401).json({ error: "Não autenticado" });
    }

    const user = await this.service.findById(req.session.userId);
    if (!user) {
      await req.session.destroy();
      return res.status(401).json({ error: "Não autenticado" });
    }

    return res.json({ user });
  }
}
