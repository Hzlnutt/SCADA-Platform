import { Router } from "express";
import { getAnalyticsSummaryHandler, getElectricityAnalyticsHandler, getWaterAnalyticsHandler } from "./analytics.controller";

export const analyticsRouter = Router();

analyticsRouter.get("/analytics/summary", getAnalyticsSummaryHandler);
analyticsRouter.get("/analytics/electricity", getElectricityAnalyticsHandler);
analyticsRouter.get("/analytics/water", getWaterAnalyticsHandler);
