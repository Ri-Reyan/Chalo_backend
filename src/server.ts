import "dotenv/config";
import http from "http";
import app from "./app.js";
import credentials from "./config/credentials.js";
import prisma from "./lib/prisma.js";
import redis from "./lib/redis.js";
import { initSocket } from "./lib/socket.js";

const server = http.createServer(app);
const port = credentials.port;

// Initialize real-time Socket.IO communication
initSocket(server);

const main = async () => {
  try {
    await prisma.$connect();
    console.log("Database connected successfully");

    await redis.set("foo", "bar", { ex: 60 });
    console.log("Redis connected successfuly");

    server.listen(port, () => {
      console.log(`Server booted successfully on: http://localhost:${port}`);
    });
  } catch (error) {
    console.log("Something went wrong:", error);
    await prisma.$disconnect();
    process.exit(1);
  }
};

main();
