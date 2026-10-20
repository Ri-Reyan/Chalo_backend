const credentials = {
  port: process.env.PORT || 5000,
  database_url: process.env.DATABASE_URL,
  direct_url: process.env.DIRECT_URL,
  redis_url: process.env.UPSTASH_REDIS_REST_URL,
  redis_token: process.env.UPSTASH_REDIS_REST_TOKEN,
  jwt_access_token: process.env.JWT_ACCESS_TOKEN,
  jwt_refresh_token: process.env.JWT_REFRESH_TOKEN,
  jwt_access_token_time: process.env.JWT_ACCESS_TOKEN_TIME,
  jwt_refresh_token_time: process.env.JWT_REFRESH_TOKEN_TIME,
};

export default credentials;
