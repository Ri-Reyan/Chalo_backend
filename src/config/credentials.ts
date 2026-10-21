import "dotenv/config";

const credentials = {
  port: process.env.PORT || 5000,
  database_url: process.env.DATABASE_URL,
  direct_url: process.env.DIRECT_URL,
  redis_url: process.env.UPSTASH_REDIS_REST_URL,
  redis_token: process.env.UPSTASH_REDIS_REST_TOKEN,
  jwt_access_token:
    process.env.JWT_ACCESS_TOKEN || process.env.JWT_ACCESS_SECRET,
  jwt_refresh_token:
    process.env.JWT_REFRESH_TOKEN || process.env.JWT_REFRESH_SECRET,
  jwt_access_token_time: process.env.JWT_ACCESS_TOKEN_TIME || "15m",
  jwt_refresh_token_time: process.env.JWT_REFRESH_TOKEN_TIME || "7d",
  stripe_secret_key: process.env.STRIPE_SECRET_KEY,
  stripe_publishable_key: process.env.STRIPE_PUBLISHABLE_KEY,
  client_url: process.env.CLIENT_URL,
};

export default credentials;
