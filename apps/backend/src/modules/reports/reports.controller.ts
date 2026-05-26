import { NextFunction, Request, Response } from "express";
import { listReports, requestReport } from "./reports.service";
import { reportRequestSchema } from "./reports.validation";

export const listReportsHandler = async (
  _req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const data = await listReports();
    res.json({ data });
  } catch (err) {
    next(err);
  }
};

export const requestReportHandler = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const parsed = reportRequestSchema.parse(req.body);
    const data = await requestReport(parsed);
    res.status(202).json({ data });
  } catch (err) {
    next(err);
  }
};
