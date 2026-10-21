import express from "express";
import { paymentController } from "./payment.controller.js";

const paymentRouter = express.Router();

paymentRouter.post(
  "/create-checkout-session",
  paymentController.createCheckoutSession,
);
paymentRouter.post("/verify-session", paymentController.verifyPaymentSession);
paymentRouter.get(
  "/verify/:sessionId",
  paymentController.verifyPaymentSession,
);

export default paymentRouter;

