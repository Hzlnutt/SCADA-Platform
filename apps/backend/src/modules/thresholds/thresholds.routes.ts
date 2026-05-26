import { Router } from "express";
import { authenticate, authorize } from "../auth/auth.middleware";
import {
  getThresholdHandler,
  listThresholdsHandler,
  upsertThresholdHandler
} from "./thresholds.controller";

export const thresholdsRouter = Router();

thresholdsRouter.get("/thresholds", authenticate, listThresholdsHandler);
thresholdsRouter.get(
  "/thresholds/:groupId",
  authenticate,
  getThresholdHandler
);
thresholdsRouter.put(
  "/thresholds/:groupId",
  authenticate,
  authorize(["team_head", "leader", "admin"]),
  upsertThresholdHandler
);
thresholdsRouter.patch(
  "/thresholds/:groupId",
  authenticate,
  authorize(["team_head", "leader", "admin"]),
  upsertThresholdHandler
);
