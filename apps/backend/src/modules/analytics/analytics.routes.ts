import { Router } from "express";
import { getAnalyticsSummaryHandler, getElectricityAnalyticsHandler, getRunningHoursHandler } from "./analytics.controller";

export const analyticsRouter = Router();

analyticsRouter.get("/analytics/summary", getAnalyticsSummaryHandler);
analyticsRouter.get("/analytics/electricity", getElectricityAnalyticsHandler);
analyticsRouter.get("/analytics/running-hours", getRunningHoursHandler);
