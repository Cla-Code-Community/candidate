import cors from "cors";

// Regex cobre qualquer preview do Vercel: painel-vagas-*.vercel.app
// (hash-based e branch-based, ex: git-master-bene-teslas-projects)
const VERCEL_PREVIEW_RE = /^https:\/\/painel-vagas-[a-z0-9-]+\.vercel\.app$/;

const DEFAULT_ALLOWED_ORIGINS = [
  "https://candidate.app.br",
  "https://admin.candidate.app.br",
  "https://support.candidate.app.br",
  "https://api.candidate.app.br",
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
    if (!origin) return callback(null, true);

    if (VERCEL_PREVIEW_RE.test(origin)) return callback(null, true);

    const allowedOrigins = parseAllowedOrigins(
      process.env.CORS_ALLOWED_ORIGINS,
    );
    if (allowedOrigins.has(origin)) return callback(null, true);

    callback(new Error("Origin not allowed by CORS"));
  },
  methods: ["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With"],
  credentials: true,
  maxAge: 86400,
};
