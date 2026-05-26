import { NextFunction, Request, Response } from "express";
import { logger } from "../config/logger.config";

export const errorHandler = (
  err: Error & { statusCode?: number },
  _req: Request,
  res: Response,
  _next: NextFunction
) => {
  logger.error({ err }, "request error");
  const status = err.statusCode ?? 500;
  res.status(status).json({ error: err.message ?? "Internal Server Error" });
};
