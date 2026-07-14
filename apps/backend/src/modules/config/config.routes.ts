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
  updatePidThresholdsHandler
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
