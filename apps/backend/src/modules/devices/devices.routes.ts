import { Router } from "express";
import { getDeviceStatusHandler } from "./devices.controller";

export const devicesRouter = Router();

devicesRouter.get("/devices/status", getDeviceStatusHandler);
