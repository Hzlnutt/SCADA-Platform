import { Router } from "express";
import { getAnalyticsSummaryHandler, getElectricityAnalyticsHandler, getWaterAnalyticsHandler, getRunningHoursHandler, getBillingAnalyticsHandler } from "./analytics.controller";

export const analyticsRouter = Router();

analyticsRouter.get("/analytics/summary", getAnalyticsSummaryHandler);
analyticsRouter.get("/analytics/electricity", getElectricityAnalyticsHandler);
analyticsRouter.get("/analytics/water", getWaterAnalyticsHandler);
analyticsRouter.get("/analytics/running-hours", getRunningHoursHandler);
analyticsRouter.get("/analytics/billing", getBillingAnalyticsHandler);


