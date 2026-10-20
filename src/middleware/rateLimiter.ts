import { NextFunction, Request, Response } from "express";
import redis from "../lib/redis.js";
import sendResponse from "../global/sendResponse.js";

type rateLimiterType = {
  windowsMs: number;
  max: number;
  keyPrefix?: string;
};

const getClientIp = (req: Request) =>
  req.ip || req.socket.remoteAddress || "unknown";

const rateLimiter = ({
  windowsMs,
  max,
  keyPrefix = "api",
}: rateLimiterType) => {
  if (windowsMs <= 0 || max <= 0) {
    throw new Error("Rate limiter windowMs and max must be greater than zero");
  }

  const windowSeconds = Math.ceil(windowsMs / 1000);
  return async (req: Request, res: Response, next: NextFunction) => {
    const key = `rate-limit:${keyPrefix}:${getClientIp(req)}`;

    try {
      if (!redis) {
        return next();
      }

      const pipline = redis.pipeline();

      pipline.incr(key);
      pipline.ttl(key);

      const [count, rawTtl] = (await pipline.exec()) as [number, number];

      let ttl = rawTtl;

      if (ttl < 0) {
        await redis.expire(key, windowSeconds);
        ttl = windowSeconds;
      }

      const remaining = Math.max(max - count, 0);

      res.setHeader("Rate-limit", String(max));
      res.setHeader("Ratelimit-remaining", String(remaining));
      res.setHeader(
        "Ratelimit-Reset",
        String(Math.ceil(Date.now() / 1000) + Math.max(ttl, 1)),
      );

      if (count > max) {
        res.setHeader("Retry-After", String(Math.max(ttl, 1)));

        return sendResponse(res, {
          success: false,
          statusCode: 429,
          message: "Too many requests. Please try again later.",
          error: {
            code: "RATE_LIMITED",
            message: "Too many requests. Please try again later.",
          },
        });
      }

      return next();
    } catch (error) {
      console.error("Rate limiter error:", error);
      return next();
    }
  };
};

export default rateLimiter;
