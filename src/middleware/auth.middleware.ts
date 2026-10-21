import type { NextFunction, Request, Response } from "express";
import catchAsync from "../global/catchAsync.js";
import AppError from "../global/AppError.js";
import { genToken, verifyToken } from "../utils/token.js";
import credentials from "../config/credentials.js";
import { sendCookie } from "../global/cookie.js";
import prisma from "../lib/prisma.js";

const verifyUser = catchAsync(
  async (req: Request, res: Response, next: NextFunction) => {
    // 1. Extract cookies from req.cookies or raw Cookie header
    let cookies = (req as any).cookies;
    if (!cookies && req.headers.cookie) {
      cookies = {};
      const items = req.headers.cookie.split(";");
      for (const item of items) {
        const [rawKey, ...rawVal] = item.trim().split("=");
        if (rawKey) {
          try {
            cookies[rawKey] = decodeURIComponent(rawVal.join("="));
          } catch {
            cookies[rawKey] = rawVal.join("=");
          }
        }
      }
    }

    const accessToken =
      cookies?.accessToken ||
      req.headers.authorization?.replace(/^Bearer\s+/i, "");
    const refreshToken = cookies?.refreshToken;

    const accessSecret = (credentials.jwt_access_token ||
      process.env.JWT_ACCESS_TOKEN ||
      process.env.JWT_ACCESS_SECRET) as string;
    const refreshSecret = (credentials.jwt_refresh_token ||
      process.env.JWT_REFRESH_TOKEN ||
      process.env.JWT_REFRESH_SECRET) as string;

    let decoded: any;

    try {
      if (!accessToken) {
        throw new Error("No access token provided");
      }

      decoded = verifyToken(accessToken, accessSecret);
    } catch {
      // Access token invalid or expired. Attempt refresh token flow.
      if (!refreshToken) {
        throw new AppError("Unauthorized. Please log in.", 401);
      }

      let refreshDecoded: any;
      try {
        refreshDecoded = verifyToken(refreshToken, refreshSecret);
      } catch {
        throw new AppError(
          "Session expired. Please log in again to continue.",
          401,
        );
      }

      const user = await prisma.user.findUnique({
        where: {
          id: refreshDecoded.id,
        },
      });

      if (!user) {
        throw new AppError("User session is no longer valid.", 401);
      }

      const newAccessToken = genToken(
        {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
        },
        accessSecret,
        "15m",
      );

      sendCookie(res, "accessToken", newAccessToken);

      decoded = {
        id: user.id,
        email: user.email,
        role: user.role,
      };
    }

    const user = await prisma.user.findUnique({
      where: {
        id: decoded.id,
      },
    });

    if (!user) {
      throw new AppError("User account no longer exists.", 401);
    }

    req.user = {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
    };

    next();
  },
);

const verifyRole = (...roles: string[]) =>
  catchAsync(async (req: Request, res: Response, next: NextFunction) => {
    if (!roles.includes(req.user?.role as string)) {
      throw new AppError(
        "You are not authorized to access this resource.",
        403,
      );
    }
    next();
  });

export const authMidleware = {
  verifyUser,
  verifyRole,
};

export default authMidleware;
