import { Router } from "express";
import { getAnalyticsSummaryHandler } from "./analytics.controller";

export const analyticsRouter = Router();

analyticsRouter.get("/analytics/summary", getAnalyticsSummaryHandler);
