import "dotenv/config";
import { Pool } from "pg";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";

const connectionString = process.env.DATABASE_URL;

const pool = new Pool({
  connectionString,
  connectionTimeoutMillis: 20000, // 20s allows Neon compute to wake up from cold start without timing out
  idleTimeoutMillis: 30000,
  max: 10,
});

const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

export default prisma;
