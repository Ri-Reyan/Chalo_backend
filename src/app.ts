import express from "express";
import type { Request, Response } from "express";
import helmet from "helmet";
import cors from "cors";
import errorHandler from "./global/errorHandler.js";
import authRouter from "./module/auth/auth.route.js";
import rideRouter from "./module/customer/ride/ride.route.js";
import driverRouter from "./module/driver/driver.route.js";
import paymentRouter from "./module/customer/payment/payment.route.js";
import credentials from "./config/credentials.js";

const app = express();

// Trust reverse proxies (Render, Cloudflare, etc.) for secure cookies & HTTPS detection
app.set("trust proxy", 1);

const allowedOrigins = [
  "http://localhost:3000",
  "http://127.0.0.1:3000",
  credentials.client_url,
].filter(Boolean);

app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(null, true);
      }
    },
    credentials: true,
    methods: ["GET", "POST", "PATCH", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "Accept", "X-Requested-With"],
  }),
);

// Cookie parsing middleware
app.use((req, res, next) => {
  if (req.headers.cookie) {
    const cookies: Record<string, string> = {};
    const items = req.headers.cookie.split(";");
    for (const item of items) {
      const [rawKey, ...rawVal] = item.trim().split("=");
      if (rawKey) {
        try {
          cookies[rawKey] = decodeURIComponent(rawVal.join("="));
        } catch {
          cookies[rawKey] = rawVal.join("=");
        }
      }
    }
    (req as any).cookies = cookies;
  } else {
    (req as any).cookies = {};
  }
  next();
});

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(helmet());

app.get("/", (req: Request, res: Response) => {
  res.send({ message: "Hello, World!", status: 200 });
});

app.use("/api/auth", authRouter);
app.use("/api/rides", rideRouter);
app.use("/api/drivers", driverRouter);
app.use("/api/payments", paymentRouter);

app.use(errorHandler);

export default app;
