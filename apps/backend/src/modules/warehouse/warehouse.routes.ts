import { Router } from "express";
import { authenticate, authorize } from "../auth/auth.middleware";
import { WH7_ALLOWED_EDIT_ROLES } from "../../services/warehouse7.service";
import {
  getWh7ConfigHandler,
  getWh7OverviewHandler,
  getWh7TrendHandler,
  testWh7ConnectionHandler,
  updateWh7ConfigHandler
} from "./warehouse.controller";

export const warehouseRouter = Router();

warehouseRouter.get("/warehouse/wh7/overview", authenticate, getWh7OverviewHandler);
warehouseRouter.get("/warehouse/wh7/trend", authenticate, getWh7TrendHandler);
warehouseRouter.get("/warehouse/wh7/config", authenticate, getWh7ConfigHandler);
warehouseRouter.put(
  "/warehouse/wh7/config",
  authenticate,
  authorize(WH7_ALLOWED_EDIT_ROLES),
  updateWh7ConfigHandler
);
warehouseRouter.post(
  "/warehouse/wh7/test-connection",
  authenticate,
  authorize(WH7_ALLOWED_EDIT_ROLES),
  testWh7ConnectionHandler
);
