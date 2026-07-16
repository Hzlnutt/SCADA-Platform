import { NextFunction, Request, Response } from "express";
import { getAnalyticsSummary } from "./analytics.service";
import { getElectricityAnalytics } from "./electricity.analytics";
import { getWaterAnalytics } from "./water.analytics";
import { getMongoDb } from "../../database/mongo";
import { GLOBAL_CONFIG_COLLECTION } from "../../database/collections";

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

export const getElectricityAnalyticsHandler = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const deviceId = (req.query.deviceId as string) || "Cubicle_PLN_PM8000";
    const from = req.query.from as string | undefined;
    const to = req.query.to as string | undefined;
    const year = req.query.year ? Number(req.query.year) : undefined;

    const db = getMongoDb();
    const config = await db.collection(GLOBAL_CONFIG_COLLECTION).findOne({ key: "utility" });
    const wbpRate = config ? config.wbpRate : 1600;
    const lwbpRate = config ? config.lwbpRate : 1112;

    const data = await getElectricityAnalytics(deviceId, from, to, lwbpRate, wbpRate, year);
    res.json({ data });
  } catch (err) {
    next(err);
  }
};

export const getWaterAnalyticsHandler = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const deviceId = req.query.deviceId as string | undefined;
    const from = req.query.from as string | undefined;
    const to = req.query.to as string | undefined;
    const year = req.query.year ? Number(req.query.year) : undefined;

    const data = await getWaterAnalytics(deviceId, from, to, year);
    res.json({ data });
  } catch (err) {
    next(err);
  }
};

