import type { Request, Response } from "express";
import catchAsync from "../../global/catchAsync.js";
import AppError from "../../global/AppError.js";
import sendResponse from "../../global/sendResponse.js";
import {
  updateStatusSchema,
  updateLocationSchema,
  createWithdrawalSchema,
} from "./driver.schema.js";
import { driverService } from "./driver.service.js";

const updateStatus = catchAsync(async (req: Request, res: Response) => {
  const result = updateStatusSchema.safeParse(req.body);

  if (!result.success) {
    throw new AppError(result.error.issues[0].message, 400);
  }

  const authenticatedUserId = (req as any).user?.id;
  const data = await driverService.updateStatusService(
    result.data,
    authenticatedUserId,
  );

  sendResponse(res, {
    success: true,
    statusCode: 200,
    message: `Driver status updated to ${data.isOnline ? "Online" : "Offline"}`,
    data,
  });
});

const updateLocation = catchAsync(async (req: Request, res: Response) => {
  const result = updateLocationSchema.safeParse(req.body);

  if (!result.success) {
    throw new AppError(result.error.issues[0].message, 400);
  }

  const authenticatedUserId = (req as any).user?.id;
  const data = await driverService.updateLocationService(
    result.data,
    authenticatedUserId,
  );

  sendResponse(res, {
    success: true,
    statusCode: 200,
    message: "Driver location coordinates updated successfully",
    data,
  });
});

const getBalance = catchAsync(async (req: Request, res: Response) => {
  const authenticatedUserId = (req as any).user?.id || (req.query.driverId as string);
  const data = await driverService.getBalanceService(authenticatedUserId);

  sendResponse(res, {
    success: true,
    statusCode: 200,
    message: "Driver wallet balance and earnings retrieved",
    data,
  });
});

const createWithdrawal = catchAsync(async (req: Request, res: Response) => {
  const result = createWithdrawalSchema.safeParse(req.body);

  if (!result.success) {
    throw new AppError(result.error.issues[0].message, 400);
  }

  const authenticatedUserId = (req as any).user?.id;
  const data = await driverService.createWithdrawalService(
    result.data,
    authenticatedUserId,
  );

  sendResponse(res, {
    success: true,
    statusCode: 201,
    message: "Withdrawal request submitted successfully",
    data,
  });
});

export const driverController = {
  updateStatus,
  updateLocation,
  getBalance,
  createWithdrawal,
};

export default driverController;

