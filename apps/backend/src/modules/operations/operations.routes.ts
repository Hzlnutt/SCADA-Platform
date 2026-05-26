import { Router } from "express";
import { authenticate, authorize } from "../auth/auth.middleware";
import {
  createMaintenanceHandler,
  createShiftReportHandler,
  listAllMaintenanceHandler,
  listAllShiftReportsHandler,
  listMaintenanceHandler,
  listShiftReportsHandler,
  reviewMaintenanceHandler,
  reviewShiftReportHandler,
  updateMaintenanceHandler,
  updateShiftReportHandler
} from "./operations.controller";

export const operationsRouter = Router();

operationsRouter.get(
  "/machines/:machineId/maintenance",
  authenticate,
  listMaintenanceHandler
);
operationsRouter.post(
  "/machines/:machineId/maintenance",
  authenticate,
  authorize(["operator", "team_head", "leader", "admin"]),
  createMaintenanceHandler
);
operationsRouter.patch(
  "/machines/:machineId/maintenance/:id",
  authenticate,
  authorize(["admin"]),
  updateMaintenanceHandler
);
operationsRouter.get(
  "/maintenance",
  authenticate,
  listAllMaintenanceHandler
);
operationsRouter.get(
  "/approvals/maintenance",
  authenticate,
  authorize(["team_head", "leader", "admin"]),
  listAllMaintenanceHandler
);
operationsRouter.patch(
  "/approvals/maintenance/:id",
  authenticate,
  authorize(["team_head", "leader", "admin"]),
  reviewMaintenanceHandler
);
operationsRouter.get(
  "/machines/:machineId/shift-reports",
  authenticate,
  listShiftReportsHandler
);
operationsRouter.post(
  "/machines/:machineId/shift-reports",
  authenticate,
  authorize(["operator", "team_head", "leader", "admin"]),
  createShiftReportHandler
);
operationsRouter.patch(
  "/machines/:machineId/shift-reports/:id",
  authenticate,
  authorize(["admin"]),
  updateShiftReportHandler
);
operationsRouter.get(
  "/shift-reports",
  authenticate,
  authorize(["admin"]),
  listAllShiftReportsHandler
);
operationsRouter.get(
  "/approvals/shift-reports",
  authenticate,
  authorize(["team_head", "leader", "admin"]),
  listAllShiftReportsHandler
);
operationsRouter.patch(
  "/approvals/shift-reports/:id",
  authenticate,
  authorize(["team_head", "leader", "admin"]),
  reviewShiftReportHandler
);
