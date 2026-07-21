import { Router } from "express";
import { authenticate } from "../auth/auth.middleware";
import { getAuditLogsHandler, getNetworkInfoHandler } from "./audit.controller";

export const auditRouter = Router();

auditRouter.get(
  "/audit-trail",
  authenticate,
  getAuditLogsHandler
);

auditRouter.get(
  "/audit-trail/network-info",
  authenticate,
  getNetworkInfoHandler
);
