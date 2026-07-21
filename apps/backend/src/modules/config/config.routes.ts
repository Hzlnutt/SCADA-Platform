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
  testApiSourceHandler
} from "./config.controller";

export const configRouter = Router();

configRouter.get("/config/categories", authenticate, getCategoriesHandler);
configRouter.get("/config/machines", authenticate, getMachinesHandler);
configRouter.post("/config/machines", authenticate, authorize(["admin"]), createMachineHandler);
configRouter.patch("/config/machines/:id", authenticate, authorize(["admin"]), updateMachineHandler);
configRouter.delete("/config/machines/:id", authenticate, authorize(["admin"]), deleteMachineHandler);
configRouter.get("/config/thresholds/:machineId", authenticate, getThresholdsHandler);
configRouter.post("/config/thresholds", authenticate, authorize(["admin"]), upsertThresholdsHandler);
configRouter.post("/config/machines/:id/bind", authenticate, authorize(["admin"]), testBindingHandler);
configRouter.get("/config/utility", authenticate, getUtilityConfigHandler);
configRouter.post("/config/utility", authenticate, updateUtilityConfigHandler);
configRouter.get("/config/pid-thresholds", authenticate, getPidThresholdsHandler);
configRouter.post("/config/pid-thresholds", authenticate, authorize(["admin"]), updatePidThresholdsHandler);
configRouter.get("/config/rh-task-rules", authenticate, getRhTaskRulesHandler);
configRouter.post("/config/rh-task-rules", authenticate, authorize(["admin"]), updateRhTaskRulesHandler);
configRouter.get("/config/rh-tasks", authenticate, getRhTasksHandler);
configRouter.post("/config/rh-tasks/:id/complete", authenticate, completeRhTaskHandler);
configRouter.get("/config/sensor-rules", authenticate, getSensorRulesHandler);
configRouter.post("/config/sensor-rules", authenticate, authorize(["admin"]), updateSensorRulesHandler);
configRouter.get("/config/rh-baselines", authenticate, getRhBaselinesHandler);

// API Sources management
configRouter.get("/config/api-sources", authenticate, getApiSourcesHandler);
configRouter.post("/config/api-sources", authenticate, createApiSourceHandler);
configRouter.patch("/config/api-sources/:id", authenticate, updateApiSourceHandler);
configRouter.delete("/config/api-sources/:id", authenticate, deleteApiSourceHandler);
configRouter.post("/config/api-sources/test", authenticate, testApiSourceHandler);

