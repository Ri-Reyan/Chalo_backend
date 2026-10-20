import express from "express";
import type { Request, Response } from "express";
import helmet from "helmet";
import cors from "cors";

const app = express();

app.use(
  cors({
    origin: "*",
    credentials: true,
  }),
);
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(helmet());

app.get("/", (req: Request, res: Response) => {
  res.send({ message: "Hello, World!", status: 200 });
});

export default app;
