import type { Request, Response } from "express";
import catchAsync from "../../../global/catchAsync.js";
import AppError from "../../../global/AppError.js";
import sendResponse from "../../../global/sendResponse.js";
import prisma from "../../../lib/prisma.js";
import {
  estimateRideSchema,
  createRideSchema,
  confirmPaymentSchema,
} from "./ride.schema.js";
import { rideService } from "./ride.service.js";

const estimateRide = catchAsync(async (req: Request, res: Response) => {
  const result = estimateRideSchema.safeParse(req.body);

  if (!result.success) {
    throw new AppError(result.error.issues[0].message, 400);
  }

  const data = await rideService.estimateRideService(result.data);

  sendResponse(res, {
    success: true,
    statusCode: 200,
    message: "Ride distance and fare estimated successfully",
    data,
  });
});

const createRide = catchAsync(async (req: Request, res: Response) => {
  const result = createRideSchema.safeParse(req.body);

  if (!result.success) {
    throw new AppError(result.error.issues[0].message, 400);
  }

  const authenticatedUserId = (req as any).user?.id;
  const data = await rideService.createRideService(
    result.data,
    authenticatedUserId,
  );

  sendResponse(res, {
    success: true,
    statusCode: 201,
    message: "Ride request created and payment session initialized",
    data,
  });
});

const confirmPayment = catchAsync(async (req: Request, res: Response) => {
  const rawId = req.params.id || req.body.rideId;
  const rideId = Array.isArray(rawId) ? rawId[0] : (rawId as string);
  const result = confirmPaymentSchema.safeParse({
    rideId,
    paymentMethod: req.body.paymentMethod,
  });

  if (!result.success) {
    throw new AppError(result.error.issues[0].message, 400);
  }

  const data = await rideService.confirmPaymentService(result.data);

  sendResponse(res, {
    success: true,
    statusCode: 200,
    message: "Payment authorized successfully. Driver dispatching initiated.",
    data,
  });
});

const acceptRide = catchAsync(async (req: Request, res: Response) => {
  const rideId = Array.isArray(req.params.id) ? req.params.id[0] : (req.params.id as string);
  const user = (req as any).user;
  const body = req.body || {};

  let driverId: string | undefined =
    user?.id ||
    user?.driverId ||
    body.driverId ||
    (typeof req.query.driverId === "string" ? req.query.driverId : undefined);

  // Fallback to first registered driver in DB if testing without JWT header
  if (!driverId) {
    const defaultDriver = await prisma.user.findFirst({
      where: { role: "DRIVER" },
    });
    driverId = defaultDriver?.id;
  }

  if (!driverId) {
    throw new AppError("No driver identity found to accept ride.", 401);
  }

  const data = await rideService.acceptRideService(rideId, driverId);

  sendResponse(res, {
    success: true,
    statusCode: 200,
    message: "Ride accepted successfully",
    data,
  });
});

const driverArrived = catchAsync(async (req: Request, res: Response) => {
  const rideId = Array.isArray(req.params.id) ? req.params.id[0] : (req.params.id as string);
  const user = (req as any).user;
  const driverId = user?.id || user?.driverId || req.body?.driverId;

  const data = await rideService.driverArrivedService(rideId, driverId);

  sendResponse(res, {
    success: true,
    statusCode: 200,
    message: "Driver marked as arrived at pickup point",
    data,
  });
});

const startRide = catchAsync(async (req: Request, res: Response) => {
  const rideId = Array.isArray(req.params.id) ? req.params.id[0] : (req.params.id as string);
  const user = (req as any).user;
  const driverId = user?.id || user?.driverId || req.body?.driverId;

  const data = await rideService.startRideService(rideId, driverId);

  sendResponse(res, {
    success: true,
    statusCode: 200,
    message: "Trip started successfully",
    data,
  });
});

const completeRide = catchAsync(async (req: Request, res: Response) => {
  const rideId = Array.isArray(req.params.id) ? req.params.id[0] : (req.params.id as string);
  const user = (req as any).user;
  const customerId = user?.id || req.body?.customerId;

  const data = await rideService.completeRideService(rideId, customerId);

  sendResponse(res, {
    success: true,
    statusCode: 200,
    message: "Ride completed successfully. Driver balance credited with 90% fare.",
    data,
  });
});

const cancelRide = catchAsync(async (req: Request, res: Response) => {
  const rideId = Array.isArray(req.params.id) ? req.params.id[0] : (req.params.id as string);
  const user = (req as any).user;
  const userId = user?.id || req.body?.userId;

  const data = await rideService.cancelRideService(rideId, userId);

  sendResponse(res, {
    success: true,
    statusCode: 200,
    message: "Ride cancelled and funds refunded successfully",
    data,
  });
});

const getActiveRide = catchAsync(async (req: Request, res: Response) => {
  const user = (req as any).user;
  const userId = user?.id || (req.query.userId as string);
  const role = user?.role || (req.query.role as string);

  if (!userId) {
    sendResponse(res, {
      success: true,
      statusCode: 200,
      message: "No user authenticated",
      data: null,
    });
    return;
  }

  const data = await rideService.getActiveRideService(userId, role);

  sendResponse(res, {
    success: true,
    statusCode: 200,
    message: "Active ride retrieved",
    data,
  });
});

const getAvailableRides = catchAsync(async (req: Request, res: Response) => {
  const user = (req as any).user;
  const driverId = user?.id || user?.driverId || (req.query.driverId as string);
  const data = await rideService.getAvailableRidesService(driverId);

  sendResponse(res, {
    success: true,
    statusCode: 200,
    message: "Available rides retrieved",
    data,
  });
});

const getRideHistory = catchAsync(async (req: Request, res: Response) => {
  const user = (req as any).user;
  const userId = user?.id || user?.driverId || (req.query.userId as string);
  const role = (req.query.role as string) || user?.role || "CUSTOMER";

  if (!userId) {
    sendResponse(res, {
      success: true,
      statusCode: 200,
      message: "No user authenticated",
      data: [],
    });
    return;
  }

  const data = await rideService.getRideHistoryService(userId, role);

  sendResponse(res, {
    success: true,
    statusCode: 200,
    message: "Ride history retrieved successfully",
    data,
  });
});

export const rideController = {
  estimateRide,
  createRide,
  confirmPayment,
  acceptRide,
  driverArrived,
  startRide,
  completeRide,
  cancelRide,
  getActiveRide,
  getAvailableRides,
  getRideHistory,
};

export default rideController;
