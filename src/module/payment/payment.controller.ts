import type { Request, Response } from "express";
import catchAsync from "../../global/catchAsync.js";
import AppError from "../../global/AppError.js";
import sendResponse from "../../global/sendResponse.js";
import {
  createCheckoutSessionSchema,
  verifyPaymentSchema,
} from "./payment.schema.js";
import { paymentService } from "./payment.service.js";

const createCheckoutSession = catchAsync(
  async (req: Request, res: Response) => {
    const result = createCheckoutSessionSchema.safeParse(req.body);

    if (!result.success) {
      throw new AppError(result.error.issues[0].message, 400);
    }

    const data = await paymentService.createCheckoutSessionService(result.data);

    sendResponse(res, {
      success: true,
      statusCode: 201,
      message: "Stripe checkout session created successfully",
      data,
    });
  },
);

const verifyPaymentSession = catchAsync(async (req: Request, res: Response) => {
  const sessionId =
    (req.params.sessionId as string) || (req.body.sessionId as string);
  const rideId = req.query.rideId as string | undefined;

  const result = verifyPaymentSchema.safeParse({
    sessionId,
    rideId,
  });

  if (!result.success) {
    throw new AppError(result.error.issues[0].message, 400);
  }

  const data = await paymentService.verifyPaymentSessionService(result.data);

  sendResponse(res, {
    success: true,
    statusCode: 200,
    message: "Stripe payment verified successfully. Escrow hold active.",
    data,
  });
});

export const paymentController = {
  createCheckoutSession,
  verifyPaymentSession,
};

export default paymentController;

