import AppError from "../../global/AppError.js";
import prisma from "../../lib/prisma.js";
import { hashPassword, verifyPassword } from "../../utils/argon.js";
import {
  LoginServicePayload,
  RegisterServicePayload,
} from "./auth.interface.js";
import jwt from "jsonwebtoken";
import { genToken, verifyToken, JWTPayloadType } from "../../utils/token.js";
import credentials from "../../config/credentials.js";

const registerService = async (payload: RegisterServicePayload) => {
  const isUserExists = await prisma.user.findUnique({
    where: {
      email: payload.email,
    },
  });

  if (isUserExists) {
    throw new AppError("User already exists", 400);
  }

  const password = await hashPassword(payload.password);

  const user = await prisma.user.create({
    data: {
      name: payload.name,
      email: payload.email,
      passwordHash: password,
      role: payload.role,
      vehicleType: payload.vehicleType,
    },
    omit: {
      passwordHash: true,
    },
  });

  if (!user) {
    throw new AppError("User creation failed", 500);
  }

  if (user.role === "DRIVER" && !user.vehicleType) {
    throw new AppError("Vehicle type is required for drivers", 400);
  }

  return user;
};

const loginService = async (payload: LoginServicePayload) => {
  const user = await prisma.user.findUnique({
    where: {
      email: payload.email,
    },
  });

  if (!user) {
    throw new AppError("Invalid credentials", 401);
  }

  const isPasswordMatched = await verifyPassword(
    user.passwordHash,
    payload.password,
  );

  if (!isPasswordMatched) {
    throw new AppError("Invalid credentials", 401);
  }

  const { passwordHash, ...safeUser } = user;

  return safeUser;
};

const getMeService = async (userId: string) => {
  const user = await prisma.user.findUnique({
    where: {
      id: userId,
    },
    select: {
      name: true,
      email: true,
      role: true,
    },
  });

  if (!user) {
    throw new AppError("User no longer exists", 401);
  }

  return user;
};

const refreshTokenService = async (refreshToken: string) => {
  let decoded: JWTPayloadType;
  try {
    decoded = verifyToken<JWTPayloadType>(
      refreshToken,
      credentials.jwt_refresh_token as string,
    );
  } catch (err: any) {
    if (err.name === "TokenExpiredError") {
      throw new AppError("Refresh token has expired. Please log in again.", 401);
    }
    throw new AppError("Invalid refresh token. Please log in again.", 401);
  }

  const user = await prisma.user.findUnique({
    where: {
      id: decoded.id,
    },
  });

  if (!user) {
    throw new AppError("User no longer exists", 401);
  }

  const payload: JWTPayloadType = {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
  };

  const newAccessToken = genToken(
    payload,
    credentials.jwt_access_token as string,
    credentials.jwt_access_token_time as jwt.SignOptions["expiresIn"],
  );

  const newRefreshToken = genToken(
    payload,
    credentials.jwt_refresh_token as string,
    credentials.jwt_refresh_token_time as jwt.SignOptions["expiresIn"],
  );

  return {
    accessToken: newAccessToken,
    refreshToken: newRefreshToken,
  };
};

export const authService = {
  registerService,
  loginService,
  getMeService,
  refreshTokenService,
};
