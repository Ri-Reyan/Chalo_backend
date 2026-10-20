import "dotenv/config";
import http from "http";
import app from "./app.js";
import credentials from "./config/credentials.js";

const server = http.createServer(app);
const port = credentials.port;

const main = async () => {
  try {
    server.listen(port, () => {
      console.log(`Server booted successfully on: http://localhost:${port}`);
    });
  } catch (error) {
    console.log("Something went wrong:", error);
    process.exit(1);
  }
};

main();
