import pino from "pino";

export const logger = pino({
  level: process.env.LOG_LEVEL ?? "info",
  timestamp: pino.stdTimeFunctions.isoTime,
  base: {
    service: "backend",
    environment: process.env.NODE_ENV ?? "development",
  },
  formatters: {
    level(label) {
      return { level: label };
    },
  },
});

export const logInfo = (msg: string, ctx?: object) =>
  logger.info(ctx ?? {}, msg);
export const logWarn = (msg: string, ctx?: object) =>
  logger.warn(ctx ?? {}, msg);
export const logError = (msg: string, ctx?: object) =>
  logger.error(ctx ?? {}, msg);

/**
 * Cria um child logger com requestId/userId já anexados,
 * para usar dentro de rotas/controllers.
 */
export function getRequestLogger(ctx: { requestId?: string; userId?: string }) {
  return logger.child(ctx);
}
