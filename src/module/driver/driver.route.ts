import express from "express";
import { driverController } from "./driver.controller.js";

const driverRouter = express.Router();

driverRouter.patch("/status", driverController.updateStatus);
driverRouter.patch("/location", driverController.updateLocation);
driverRouter.get("/balance", driverController.getBalance);
driverRouter.post("/withdrawals", driverController.createWithdrawal);

export default driverRouter;

