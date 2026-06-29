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
  testBindingHandler
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
