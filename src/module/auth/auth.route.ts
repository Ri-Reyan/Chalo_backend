import express from "express";
import { authController } from "./auth.controller.js";
import rateLimiter from "../../middleware/rateLimiter.js";
import { authMidleware } from "../../middleware/auth.middleware.js";

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

authRouter.post(
  "/login",
  rateLimiter({
    windowsMs: 1000 * 60 * 15,
    max: 10,
    keyPrefix: "auth-login",
  }),
  authController.login,
);

authRouter.get("/me", authMidleware.verifyUser, authController.getMe);

authRouter.post("/logout", authController.logout);

export default authRouter;
