import express from "express";
import cors from "cors";
import multer from "multer";

import { registerApiRoutes } from "./routes.js";

const app = express();
app.use(cors());
app.use(express.json({ limit: "1mb" }));

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
});

const apiRouter = express.Router();
registerApiRoutes(apiRouter, { upload });

app.use("/api", apiRouter);

// Local Docker Compose / dev without /api prefix on the gateway.
if (!process.env.AWS_LAMBDA_FUNCTION_NAME) {
  app.use("/", apiRouter);
}

app.use((err, _req, res, _next) => {
  console.error("[error]", err);
  res.status(500).json({ error: "internal_error", detail: err.message });
});

export { app };
