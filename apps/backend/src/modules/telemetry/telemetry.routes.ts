import { Router } from "express";
import {
  getLatestTelemetryHandler,
  getTelemetryRangeHandler,
  ingestTelemetryHandler
} from "./telemetry.controller";

export const telemetryRouter = Router();

telemetryRouter.post("/telemetry/ingest", ingestTelemetryHandler);
telemetryRouter.get("/telemetry/latest", getLatestTelemetryHandler);
telemetryRouter.get("/telemetry/range", getTelemetryRangeHandler);
