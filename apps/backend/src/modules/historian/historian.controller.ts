import { NextFunction, Request, Response } from "express";
import {
  historianIngestSchema,
  historianRangeQuerySchema
} from "./historian.validation";
import { getHistorianRange, ingestHistorian } from "./historian.service";

export const ingestHistorianHandler = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const payload = Array.isArray(req.body)
      ? { points: req.body }
      : req.body;
    const parsed = historianIngestSchema.parse(payload);
    const inserted = await ingestHistorian(parsed.points);

    res.status(202).json({ inserted });
  } catch (err) {
    next(err);
  }
};

export const getHistorianRangeHandler = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const parsed = historianRangeQuerySchema.parse(req.query);
    const data = await getHistorianRange(parsed);

    res.json({ data });
  } catch (err) {
    next(err);
  }
};
