import type { Response } from "express";
import jwt from "jsonwebtoken";

const isProduction = process.env.NODE_ENV === "production";

const options = {
  httpOnly: true,
  secure: isProduction,
  sameSite: (isProduction ? "none" : "lax") as "none" | "lax",
};

export const sendCookie = (res: Response, name: string, value: string) => {
  res.cookie(name, value, {
    ...options,
    maxAge:
      name === "refreshToken" ? 1000 * 60 * 60 * 24 * 7 : 1000 * 60 * 60 * 24,
  });
};
