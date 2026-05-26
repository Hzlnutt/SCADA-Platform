import pino from "pino";
import { env } from "./env.config";

export const logger = pino({
  level: env.nodeEnv === "production" ? "info" : "debug",
  base: { service: "scada-backend" }
});
