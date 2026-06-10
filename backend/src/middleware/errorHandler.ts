import { NextFunction, Request, Response } from "express";

export function errorHandler(
  error: Error,
  _req: Request,
  res: Response,
  _next: NextFunction,
): void {
  if (error.message.startsWith("Origin not allowed by CORS")) {
    res.status(403).json({ message: "Origem não permitida." });
    return;
  }
  res.status(500).json({ message: "Erro interno.", error: error.message });
}
