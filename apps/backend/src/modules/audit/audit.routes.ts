import { Router } from "express";
import { authenticate, authorize } from "../auth/auth.middleware";
import { getAuditLogsHandler, getNetworkInfoHandler } from "./audit.controller";

export const auditRouter = Router();

const auditRoles = [
  "admin",
  "senior_unit_head",
  "unit_head_utility",
  "unit_head_hvac",
  "unit_head"
];

auditRouter.get(
  "/audit-trail",
  authenticate,
  authorize(auditRoles),
  getAuditLogsHandler
);

auditRouter.get(
  "/audit-trail/network-info",
  authenticate,
  getNetworkInfoHandler
);
