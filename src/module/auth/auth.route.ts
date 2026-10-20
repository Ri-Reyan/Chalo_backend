import express from "express";
import { authController } from "./auth.controller.js";
import rateLimiter from "../../middleware/rateLimiter.js";

const authRouter = express.Router();

authRouter.post(
  "/register",
  rateLimiter({
    windowsMs: 1000 * 60 * 15,
    max: 10,
    keyPrefix: "auth-register",
  }),
  authController.register,
);

export default authRouter;
