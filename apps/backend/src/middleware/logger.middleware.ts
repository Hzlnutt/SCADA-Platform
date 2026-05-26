import pinoHttp from "pino-http";
import { logger } from "../config/logger.config";

export const loggerHttp = pinoHttp({ logger });
