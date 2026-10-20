import type { NextFunction, Request, Response } from "express";
import catchAsync from "../global/catchAsync.js";
import { genToken, verifyToken } from "../utils/token.js";
import prisma from "../lib/prisma.js";

const verifyUser = catchAsync(
  async (req: Request, res: Response, next: NextFunction) => {
    const accessToken = req.cookies?.accessToken;
    const refreshToken = req.cookies?.refreshToken;

    let decoded;

    try {
      if (!accessToken) {
        throw new Error("No access token");
      }

      decoded = verifyToken(accessToken, process.env.JWT_ACCESS_SECRET!);
    } catch (error) {
      if (!refreshToken) {
        throw new Error("Unauthorized");
      }

      const refreshDecoded = verifyToken(
        refreshToken,
        process.env.JWT_REFRESH_SECRET!,
      );

      const user = await prisma.user.findUniqueOrThrow({
        where: {
          id: refreshDecoded.id,
        },
      });

      const newAccessToken = genToken(
        {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
        },
        process.env.JWT_ACCESS_SECRET!,
        "15m",
      );

      res.cookie("accessToken", newAccessToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
      });

      decoded = {
        id: user.id,
        email: user.email,
        role: user.role,
      };
    }

    const user = await prisma.user.findUniqueOrThrow({
      where: {
        id: decoded.id,
      },
    });

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
      throw new Error("You are not allowed");
    }
    next();
  });

export const authMidleware = {
  verifyUser,
  verifyRole,
};
