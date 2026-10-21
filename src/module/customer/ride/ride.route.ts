import express from "express";
import { rideController } from "./ride.controller.js";

const rideRouter = express.Router();

// Fare Estimation & Booking
rideRouter.post("/estimate", rideController.estimateRide);
rideRouter.post("/", rideController.createRide);
rideRouter.post("/pay", rideController.confirmPayment);
rideRouter.post("/:id/pay", rideController.confirmPayment);

// Active & Available Queries
rideRouter.get("/active", rideController.getActiveRide);
rideRouter.get("/available", rideController.getAvailableRides);

// Driver Lifecycle Steps
rideRouter.post("/:id/accept", rideController.acceptRide);
rideRouter.post("/:id/arrived", rideController.driverArrived);
rideRouter.post("/:id/start", rideController.startRide);

// Customer Arrival Confirmation & Payout
rideRouter.post("/:id/complete", rideController.completeRide);
rideRouter.post("/:id/cancel", rideController.cancelRide);

export default rideRouter;
