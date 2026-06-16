import { randomBytes } from "crypto";
import { Request, Response } from "express";
import { z } from "zod";
import {
  AuthCallbackParamsSchema,
  OAuthProviderSchema,
} from "../types/auth.types.js";

import { AuthService } from "./auth.service.js";

export class AuthController {
  constructor(private readonly authService: AuthService) {}

  async getUrl(req: Request, res: Response) {
    try {
      const provider = OAuthProviderSchema.parse(req.params.provider);

      const state = randomBytes(16).toString("hex");

      (req.session as any).oauth_state = state;
      await req.session.save();

      const url = await this.authService.getAuthUrl(provider, state);

      return res.json({ url });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({
          error: "Provider inválido",
          details: error.message,
        });
      }

      return res.status(400).json({
        error: (error as Error).message,
      });
    }
  }

  async callback(req: Request, res: Response) {
    const frontendUrl = process.env.FRONTEND_URL || "http://localhost:5173";

    try {
      const callbackUrl = `${req.protocol}://${req.get("host")}${req.originalUrl}`;

      const params = AuthCallbackParamsSchema.parse({
        provider: req.params.provider,
        code: req.query.code,
        state: req.query.state,
        callbackUrl,
      });

      const oauthState = (req.session as any).oauth_state;

      if (!oauthState) {
        return res.redirect(`${frontendUrl}/login?error=oauth_state_missing`);
      }

      if (oauthState !== params.state) {
        return res.redirect(`${frontendUrl}/login?error=oauth_state_invalid`);
      }

      delete (req.session as any).oauth_state;

      const result = await this.authService.handleCallback({
        ...params,
        callbackUrl,
      });

      req.session.userId = result.session.userId;
      await req.session.save();

      return res.redirect(`${frontendUrl}/auth/callback`);
    } catch (error) {
      console.error("OAuth callback error:", error);
      return res.redirect(`${frontendUrl}/login?error=oauth_failed`);
    }
  }
}
