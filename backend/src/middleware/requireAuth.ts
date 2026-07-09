import type { NextFunction, Request, Response } from "express";
import { AppError } from "../lib/errors";

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  if (!req.session?.userId) {
    const error = AppError.unauthorized();
    return res.status(error.statusCode).json(error.toJSON());
  }
  next();
}
