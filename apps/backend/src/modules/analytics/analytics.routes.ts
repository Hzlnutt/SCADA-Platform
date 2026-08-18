import { Router } from "express";
import {
  getAnalyticsSummaryHandler,
  getElectricityAnalyticsHandler,
  getWaterAnalyticsHandler,
  getGasAnalyticsHandler,
  getRunningHoursHandler,
  getBillingAnalyticsHandler,
  getPowerMetersLatestHandler,
  getPowerMeterHistoryHandler
} from "./analytics.controller";

export const analyticsRouter = Router();

analyticsRouter.get("/analytics/summary", getAnalyticsSummaryHandler);
analyticsRouter.get("/analytics/electricity", getElectricityAnalyticsHandler);
analyticsRouter.get("/analytics/electricity/power-meters", getPowerMetersLatestHandler);
analyticsRouter.get("/analytics/electricity/power-meters/:pmId/history", getPowerMeterHistoryHandler);
analyticsRouter.get("/analytics/water", getWaterAnalyticsHandler);
analyticsRouter.get("/analytics/gas", getGasAnalyticsHandler);
analyticsRouter.get("/analytics/running-hours", getRunningHoursHandler);
analyticsRouter.get("/analytics/billing", getBillingAnalyticsHandler);



