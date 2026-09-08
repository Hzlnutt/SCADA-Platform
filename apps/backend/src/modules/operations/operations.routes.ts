import { Router } from "express";
import { authenticate, authorize, checkMachineScope } from "../auth/auth.middleware";
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
  updateShiftReportHandler,
  getHvacStatesHandler,
  updateHvacStateHandler,
  getHvacLogsHandler,
  getHvacRetainLiveHandler
} from "./operations.controller";

export const operationsRouter = Router();

const writeRoles = [
  "admin",
  "senior_unit_head",
  "unit_head_utility",
  "unit_head_hvac",
  "unit_head",
  "kashift_utility_hvac",
  "kashift_utility",
  "kashift_hvac",
  "leader",
  "team_head",
  "operator_utility",
  "operator_hvac",
  "operator"
];

const approvalRoles = [
  "admin",
  "senior_unit_head",
  "unit_head_utility",
  "unit_head_hvac",
  "unit_head",
  "kashift_utility_hvac",
  "kashift_utility",
  "kashift_hvac",
  "leader",
  "team_head"
];

const hvacControlRoles = [
  "admin",
  "senior_unit_head",
  "unit_head_utility",
  "unit_head_hvac",
  "unit_head"
];

operationsRouter.get(
  "/machines/:machineId/maintenance",
  authenticate,
  checkMachineScope,
  listMaintenanceHandler
);

operationsRouter.post(
  "/machines/:machineId/maintenance",
  authenticate,
  authorize(writeRoles),
  checkMachineScope,
  createMaintenanceHandler
);

operationsRouter.patch(
  "/machines/:machineId/maintenance/:id",
  authenticate,
  authorize(writeRoles),
  checkMachineScope,
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
  authorize(approvalRoles),
  listAllMaintenanceHandler
);

operationsRouter.patch(
  "/approvals/maintenance/:id",
  authenticate,
  authorize(approvalRoles),
  reviewMaintenanceHandler
);

operationsRouter.get(
  "/machines/:machineId/shift-reports",
  authenticate,
  checkMachineScope,
  listShiftReportsHandler
);

operationsRouter.post(
  "/machines/:machineId/shift-reports",
  authenticate,
  authorize(writeRoles),
  checkMachineScope,
  createShiftReportHandler
);

operationsRouter.patch(
  "/machines/:machineId/shift-reports/:id",
  authenticate,
  authorize(writeRoles),
  checkMachineScope,
  updateShiftReportHandler
);

operationsRouter.get(
  "/shift-reports",
  authenticate,
  authorize(writeRoles),
  listAllShiftReportsHandler
);

operationsRouter.get(
  "/approvals/shift-reports",
  authenticate,
  authorize(approvalRoles),
  listAllShiftReportsHandler
);

operationsRouter.patch(
  "/approvals/shift-reports/:id",
  authenticate,
  authorize(approvalRoles),
  reviewShiftReportHandler
);

operationsRouter.get(
  "/operations/hvac/states",
  authenticate,
  getHvacStatesHandler
);

operationsRouter.get(
  "/operations/hvac/retained-sample/live",
  getHvacRetainLiveHandler
);

operationsRouter.post(
  "/operations/hvac/control",
  authenticate,
  authorize(hvacControlRoles),
  updateHvacStateHandler
);

operationsRouter.get(
  "/operations/hvac/logs",
  authenticate,
  getHvacLogsHandler
);
