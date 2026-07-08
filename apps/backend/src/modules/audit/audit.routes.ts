import { Router } from "express";
import { authenticate, authorize } from "../auth/auth.middleware";
import { getAuditLogsHandler } from "./audit.controller";

export const auditRouter = Router();

auditRouter.get(
  "/audit-trail",
  authenticate,
  authorize(["admin"]),
  getAuditLogsHandler
);
