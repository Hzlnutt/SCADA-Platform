import { NextFunction, Request, Response } from "express";
import { getAnalyticsSummary } from "./analytics.service";

export const getAnalyticsSummaryHandler = async (
  _req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const data = await getAnalyticsSummary();
    res.json({ data });
  } catch (err) {
    next(err);
  }
};
