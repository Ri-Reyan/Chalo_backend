import catchAsync from "../../global/catchAsync.js";
import type { Request, Response } from "express";
import { registerSchema } from "./auth.schema.js";
import AppError from "../../global/AppError.js";
import { authService } from "./auth.service.js";
import jwt from "jsonwebtoken";
import { genToken } from "../../utils/token.js";
import credentials from "../../config/credentials.js";
import { sendCookie } from "../../global/cookie.js";
import sendResponse from "../../global/sendResponse.js";

const register = catchAsync(async (req: Request, res: Response) => {
  const result = registerSchema.safeParse(req.body);

  if (!result.success) {
    throw new AppError(result.error.issues[0].message, 400);
  }

  const data = await authService.registerService(result.data);

  const paylaod = {
    id: data.id,
    name: data.name,
    email: data.email,
    role: data.role,
  };

  const accessToken = genToken(
    paylaod,
    credentials.jwt_access_token as string,
    credentials.jwt_access_token_time as jwt.SignOptions["expiresIn"],
  );

  const refreshToken = genToken(
    paylaod,
    credentials.jwt_refresh_token as string,
    credentials.jwt_refresh_token_time as jwt.SignOptions["expiresIn"],
  );

  sendCookie(res, "accessToekn", accessToken);

  sendCookie(res, "refreshToken", refreshToken);

  sendResponse(res, {
    success: true,
    statusCode: 201,
    message: "User registration successfull",
    data,
  });
});

export const authController = {
  register,
};
