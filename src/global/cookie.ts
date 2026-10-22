import type { Response } from "express";

const isProduction =
  process.env.NODE_ENV === "production" ||
  Boolean(process.env.RENDER) ||
  Boolean(process.env.VERCEL) ||
  Boolean(process.env.CLIENT_URL?.startsWith("https"));

export const cookieOptions = {
  httpOnly: true,
  secure: isProduction,
  sameSite: (isProduction ? "none" : "lax") as "none" | "lax",
  path: "/",
};

export const sendCookie = (res: Response, name: string, value: string) => {
  res.cookie(name, value, {
    ...cookieOptions,
    maxAge:
      name === "refreshToken" ? 1000 * 60 * 60 * 24 * 7 : 1000 * 60 * 60 * 24,
  });
};

export const clearCookie = (res: Response, name: string) => {
  res.clearCookie(name, {
    ...cookieOptions,
  });
};
