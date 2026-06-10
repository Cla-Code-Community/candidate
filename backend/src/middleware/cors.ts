import cors from "cors";

const DEFAULT_ALLOWED_ORIGINS = [
  "https://painel-vagas-lake.vercel.app",
  "https://jobsglobalscraper.ddns.net",
  "http://jobsglobalscraper.ddns.net",
  "http://localhost:5173",
  "http://localhost:5174",
];

function parseAllowedOrigins(value: string | undefined): Set<string> {
  const configured = String(value ?? "")
    .split(",")
    .map((o) => o.trim())
    .filter(Boolean);
  return new Set(configured.length > 0 ? configured : DEFAULT_ALLOWED_ORIGINS);
}

export const corsOptions: cors.CorsOptions = {
  origin(origin, callback) {
    const allowedOrigins = parseAllowedOrigins(
      process.env.CORS_ALLOWED_ORIGINS,
    );

    if (!origin) return callback(null, true);

    if (/^https:\/\/painel-vagas-[a-z0-9-]+\.vercel\.app$/.test(origin)) {
      return callback(null, true);
    }

    if (allowedOrigins.has(origin)) return callback(null, true);

    callback(new Error(`Origin not allowed by CORS: ${origin}`));
  },
  methods: ["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With"],
  credentials: true,
  maxAge: 86400,
};
