import express from "express";
import { driverController } from "./driver.controller.js";
import authMidleware from "../../middleware/auth.middleware.js";

const driverRouter = express.Router();

driverRouter.patch(
  "/status",
  authMidleware.verifyUser,
  authMidleware.verifyRole("DRIVER"),
  driverController.updateStatus,
);
driverRouter.patch(
  "/location",
  authMidleware.verifyUser,
  authMidleware.verifyRole("DRIVER"),
  driverController.updateLocation,
);
driverRouter.get(
  "/balance",
  authMidleware.verifyUser,
  authMidleware.verifyRole("DRIVER"),
  driverController.getBalance,
);
driverRouter.post(
  "/withdrawals",
  authMidleware.verifyUser,
  authMidleware.verifyRole("DRIVER"),
  driverController.createWithdrawal,
);

export default driverRouter;

