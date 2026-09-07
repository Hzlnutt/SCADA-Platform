import { Router } from "express";
import { authenticate, authorize } from "../auth/auth.middleware";
import {
  getCategoriesHandler,
  getMachinesHandler,
  createMachineHandler,
  updateMachineHandler,
  deleteMachineHandler,
  getThresholdsHandler,
  upsertThresholdsHandler,
  testBindingHandler,
  getUtilityConfigHandler,
  updateUtilityConfigHandler,
  getPidThresholdsHandler,
  updatePidThresholdsHandler,
  getRhTaskRulesHandler,
  updateRhTaskRulesHandler,
  getRhTasksHandler,
  completeRhTaskHandler,
  getSensorRulesHandler,
  updateSensorRulesHandler,
  getRhBaselinesHandler,
  getApiSourcesHandler,
  createApiSourceHandler,
  updateApiSourceHandler,
  deleteApiSourceHandler,
  testApiSourceHandler,
  getElectricityConfigHandler,
  upsertElectricityConfigHandler,
  deleteElectricityConfigHandler,
  upsertApiSourcesMapHandler,
  getApiSourcesMapHandler
} from "./config.controller";

export const configRouter = Router();

const configAdminRoles = [
  "admin",
  "senior_unit_head",
  "unit_head_utility",
  "unit_head_hvac",
  "unit_head"
];

configRouter.get("/config/categories", authenticate, getCategoriesHandler);
configRouter.get("/config/machines", authenticate, getMachinesHandler);
configRouter.post("/config/machines", authenticate, authorize(configAdminRoles), createMachineHandler);
configRouter.patch("/config/machines/:id", authenticate, authorize(configAdminRoles), updateMachineHandler);
configRouter.delete("/config/machines/:id", authenticate, authorize(configAdminRoles), deleteMachineHandler);
configRouter.get("/config/thresholds/:machineId", authenticate, getThresholdsHandler);
configRouter.post("/config/thresholds", authenticate, authorize(configAdminRoles), upsertThresholdsHandler);
configRouter.post("/config/machines/:id/bind", authenticate, authorize(configAdminRoles), testBindingHandler);
configRouter.get("/config/utility", authenticate, getUtilityConfigHandler);
configRouter.post("/config/utility", authenticate, authorize(configAdminRoles), updateUtilityConfigHandler);
configRouter.get("/config/pid-thresholds", authenticate, getPidThresholdsHandler);
configRouter.post("/config/pid-thresholds", authenticate, authorize(configAdminRoles), updatePidThresholdsHandler);
configRouter.get("/config/rh-task-rules", authenticate, getRhTaskRulesHandler);
configRouter.post("/config/rh-task-rules", authenticate, authorize(configAdminRoles), updateRhTaskRulesHandler);
configRouter.get("/config/rh-tasks", authenticate, getRhTasksHandler);
configRouter.post("/config/rh-tasks/:id/complete", authenticate, completeRhTaskHandler);
configRouter.get("/config/sensor-rules", authenticate, getSensorRulesHandler);
configRouter.post("/config/sensor-rules", authenticate, authorize(configAdminRoles), updateSensorRulesHandler);
configRouter.get("/config/rh-baselines", authenticate, getRhBaselinesHandler);

// API Sources management
configRouter.get("/config/api-sources", authenticate, getApiSourcesHandler);
configRouter.post("/config/api-sources", authenticate, authorize(configAdminRoles), createApiSourceHandler);
configRouter.patch("/config/api-sources/:id", authenticate, authorize(configAdminRoles), updateApiSourceHandler);
configRouter.delete("/config/api-sources/:id", authenticate, authorize(configAdminRoles), deleteApiSourceHandler);
configRouter.post("/config/api-sources/test", authenticate, authorize(configAdminRoles), testApiSourceHandler);
configRouter.get("/config/api-sources-map", authenticate, getApiSourcesMapHandler);
configRouter.post("/config/api-sources-map", authenticate, authorize(configAdminRoles), upsertApiSourcesMapHandler);

// Electricity config management
configRouter.get("/config/electricity", authenticate, getElectricityConfigHandler);
configRouter.post("/config/electricity", authenticate, authorize(configAdminRoles), upsertElectricityConfigHandler);
configRouter.delete("/config/electricity/:id", authenticate, authorize(configAdminRoles), deleteElectricityConfigHandler);

