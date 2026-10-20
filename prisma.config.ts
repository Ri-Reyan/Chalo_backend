/// <reference types="node" />
import "dotenv/config";
import process from "node:process";
import { defineConfig } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    url: (process.env["DIRECT_URL"] || process.env["DATABASE_URL"]) as string,
  },
});
