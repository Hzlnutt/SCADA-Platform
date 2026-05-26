import cors from "cors";
import express from "express";
import helmet from "helmet";
import { env } from "../config/env.config";
import { errorHandler } from "../middleware/error.middleware";
import { loggerHttp } from "../middleware/logger.middleware";
import { registerRoutes } from "./routes";

export const createApp = () => {
  const app = express();

  app.use(helmet());
  app.use(cors({ origin: env.corsOrigin, credentials: true }));
  app.use(express.json({ limit: "1mb" }));
  app.use(express.urlencoded({ extended: true }));
  app.use(loggerHttp);

  registerRoutes(app);

  app.use(errorHandler);

  return app;
};
