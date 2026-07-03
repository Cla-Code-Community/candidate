import type { NextFunction, Request, Response } from "express";
import { getIronSession } from "iron-session";
import { UserRole } from "../db/schema/users";
import { sessionOptions } from "../lib/session";

export interface SessionData {
  userId?: string;
  role?: UserRole;
}

declare module "express-serve-static-core" {
  interface Request {
    session: Awaited<ReturnType<typeof getIronSession<SessionData>>>;
  }
}

export async function withSession(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  req.session = await getIronSession<SessionData>(req, res, sessionOptions);
  next();
}
