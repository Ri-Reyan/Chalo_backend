const credentials = {
  port: process.env.PORT || 5000,
  database_url: process.env.DATABASE_URL,
  direct_url: process.env.DIRECT_URL,
  redis_url: process.env.UPSTASH_REDIS_REST_URL,
  redis_token: process.env.UPSTASH_REDIS_REST_TOKEN,
};

export default credentials;
