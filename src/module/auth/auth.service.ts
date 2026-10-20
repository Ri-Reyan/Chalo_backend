import AppError from "../../global/AppError.js";
import prisma from "../../lib/prisma.js";
import { hashPassword } from "../../utils/argon.js";
import { RegisterServicePayload } from "./auth.interface.js";

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

export const authService = {
  registerService,
};
