import type { SessionOptions } from "iron-session";

const isProd = process.env.NODE_ENV === "production";

export const sessionOptions: SessionOptions = {
  password: process.env.SESSION_SECRET!,
  cookieName: "vagas_session",

  cookieOptions: {
    secure: isProd,
    httpOnly: true,
    sameSite: isProd ? "none" : "lax",
  },
};
