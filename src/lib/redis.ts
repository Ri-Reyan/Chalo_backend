import { Redis } from "@upstash/redis";
import credentials from "../config/credentials.js";

const redis = new Redis({
  url: credentials.redis_url,
  token: credentials.redis_token,
});

export default redis;
