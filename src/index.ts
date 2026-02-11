import "dotenv/config";
import express from "express";
import authRouter from "./routers/auth.route.js";
import bookRouter from "./routers/book.route.js";
import BaseError from "./errors/auth.errors.js";
import { prisma } from "./services/prisma.js";
import globalRouter from "./routers/global.route.js";
import cors from "cors";

const app = express();

const allowedOrigins = process.env.CORS_ORIGINS?.split(",") || [
  "http://localhost:3001",
  "http://localhost:3000",
];

app.use(
  cors({
    origin: "*",
  }),
);

app.use(express.json());

app.use("/", globalRouter);
app.use("/auth", authRouter);
app.use("/book", bookRouter);

app.use(
  (
    err: unknown,
    req: express.Request,
    res: express.Response,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    next: express.NextFunction,
  ) => {
    if (err instanceof BaseError) {
      return res
        .status(err.status)
        .json({ message: err.message, errors: err.errors });
    }
    console.error("Unhandled error:", err);
    return res.status(500).json({ message: "Internal server error" });
  },
);

const starter = async () => {
  try {
    await prisma.$connect();
    console.log("Connected to DB");
    app.listen(5050, () => {
      console.log("Server is running on port 3000");
    });
  } catch (error) {
    console.log(`Connecting DB error: ${error}`);
  }
};
async function shutdown(signal: string) {
  console.log(`\n${signal} received. Shutting down...`);
  await prisma.$disconnect();
  process.exit(0);
}

process.on("SIGINT", () => void shutdown("SIGINT"));
process.on("SIGTERM", () => void shutdown("SIGTERM"));

starter();
