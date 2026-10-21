import express from "express";
import { rideController } from "./ride.controller.js";
import authMidleware from "../../../middleware/auth.middleware.js";

const rideRouter = express.Router();

// Public fare estimation
rideRouter.post("/estimate", rideController.estimateRide);

// Payment confirmation (called by customer after checkout)
rideRouter.post("/pay", rideController.confirmPayment);
rideRouter.post("/:id/pay", rideController.confirmPayment);

// Authenticated customer & driver operations
rideRouter.post("/", authMidleware.verifyUser, rideController.createRide);
rideRouter.get("/active", authMidleware.verifyUser, rideController.getActiveRide);
rideRouter.get("/available", authMidleware.verifyUser, rideController.getAvailableRides);

// Driver Lifecycle Steps
rideRouter.post(
  "/:id/accept",
  authMidleware.verifyUser,
  authMidleware.verifyRole("DRIVER"),
  rideController.acceptRide,
);
rideRouter.post(
  "/:id/arrived",
  authMidleware.verifyUser,
  authMidleware.verifyRole("DRIVER"),
  rideController.driverArrived,
);
rideRouter.post(
  "/:id/start",
  authMidleware.verifyUser,
  authMidleware.verifyRole("DRIVER"),
  rideController.startRide,
);

// Customer Arrival Confirmation & Cancellation
rideRouter.post(
  "/:id/complete",
  authMidleware.verifyUser,
  rideController.completeRide,
);
rideRouter.post(
  "/:id/cancel",
  authMidleware.verifyUser,
  rideController.cancelRide,
);

export default rideRouter;
