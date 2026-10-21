import catchAsync from "../../global/catchAsync.js";
import type { Request, Response } from "express";
import { loginSchema, registerSchema } from "./auth.schema.js";
import AppError from "../../global/AppError.js";
import { authService } from "./auth.service.js";
import jwt from "jsonwebtoken";
import { genToken } from "../../utils/token.js";
import credentials from "../../config/credentials.js";
import { clearCookie, sendCookie } from "../../global/cookie.js";
import sendResponse from "../../global/sendResponse.js";

const register = catchAsync(async (req: Request, res: Response) => {
  const result = registerSchema.safeParse(req.body);

  if (!result.success) {
    throw new AppError(result.error.issues[0].message, 400);
  }

  const data = await authService.registerService(result.data);

  const payload = {
    id: data.id,
    name: data.name,
    email: data.email,
    role: data.role,
  };

  const accessToken = genToken(
    payload,
    credentials.jwt_access_token as string,
    credentials.jwt_access_token_time as jwt.SignOptions["expiresIn"],
  );

  const refreshToken = genToken(
    payload,
    credentials.jwt_refresh_token as string,
    credentials.jwt_refresh_token_time as jwt.SignOptions["expiresIn"],
  );

  sendCookie(res, "accessToken", accessToken);

  sendCookie(res, "refreshToken", refreshToken);

  sendResponse(res, {
    success: true,
    statusCode: 201,
    message: "User registration successfull",
    data,
  });
});

const login = catchAsync(async (req: Request, res: Response) => {
  const result = loginSchema.safeParse(req.body);

  if (!result.success) {
    throw new AppError(result.error.issues[0].message, 400);
  }

  const data = await authService.loginService(result.data);

  const payload = {
    id: data.id,
    name: data.name,
    email: data.email,
    role: data.role,
  };

  const accessToken = genToken(
    payload,
    credentials.jwt_access_token as string,
    credentials.jwt_access_token_time as jwt.SignOptions["expiresIn"],
  );

  const refreshToken = genToken(
    payload,
    credentials.jwt_refresh_token as string,
    credentials.jwt_refresh_token_time as jwt.SignOptions["expiresIn"],
  );

  sendCookie(res, "accessToken", accessToken);
  sendCookie(res, "refreshToken", refreshToken);

  sendResponse(res, {
    success: true,
    statusCode: 200,
    message: "User logged in successfully",
    data: {
      user: data,
    },
  });
});

const getMe = catchAsync(async (req: Request, res: Response) => {
  if (!req.user?.id) {
    throw new AppError(
      "You are not logged in. Please log in to get access.",
      401,
    );
  }

  // Fetch current user by authenticated user ID directly from database
  const user = await authService.getMeService(req.user.id);

  // Return authenticated user profile
  sendResponse(res, {
    success: true,
    statusCode: 200,
    message: "User fetched successfully",
    data: user,
  });
});

const logout = catchAsync(async (req: Request, res: Response) => {
  clearCookie(res, "accessToken");
  clearCookie(res, "refreshToken");

  sendResponse(res, {
    success: true,
    statusCode: 200,
    message: "Logged out successfully",
  });
});

export const authController = {
  register,
  login,
  getMe,
  logout,
};
