import { Router } from "express";
import { authenticate } from "../auth/auth.middleware";
import { listReportsHandler, requestReportHandler } from "./reports.controller";

export const reportsRouter = Router();

reportsRouter.get("/reports", authenticate, listReportsHandler);
reportsRouter.post("/reports/export", authenticate, requestReportHandler);
