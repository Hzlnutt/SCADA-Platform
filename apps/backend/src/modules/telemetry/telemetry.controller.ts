import { NextFunction, Request, Response } from "express";
import {
  telemetryIngestSchema,
  telemetryRangeQuerySchema
} from "./telemetry.validation";
import {
  getLatestTelemetry,
  ingestTelemetry,
  queryTelemetryRange
} from "./telemetry.service";
import { publishTelemetry } from "../../services/telemetry.publisher";
import { processThresholdAlerts } from "../../services/thresholds.monitor";

export const ingestTelemetryHandler = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const payload = Array.isArray(req.body)
      ? { points: req.body }
      : req.body;
    const parsed = telemetryIngestSchema.parse(payload);
    const { inserted, docs } = await ingestTelemetry(parsed.points);

    publishTelemetry(docs);
    await processThresholdAlerts(docs);

    res.status(202).json({ inserted });
  } catch (err) {
    next(err);
  }
};

export const getLatestTelemetryHandler = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const parsed = telemetryRangeQuerySchema
      .pick({ tagId: true })
      .parse(req.query);
    const doc = await getLatestTelemetry(parsed.tagId);

    res.json({ data: doc ?? null });
  } catch (err) {
    next(err);
  }
};

export const getTelemetryRangeHandler = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const parsed = telemetryRangeQuerySchema.parse(req.query);
    const data = await queryTelemetryRange(parsed);

    res.json({ data });
  } catch (err) {
    next(err);
  }
};
