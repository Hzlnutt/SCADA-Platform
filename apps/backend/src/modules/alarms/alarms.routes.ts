import { Router } from "express";
import { authenticate } from "../auth/auth.middleware";
import {
  getActiveAlarmsHandler,
  getAlarmHistoryHandler,
  ingestAlarmHandler,
  fixAlarmHandler,
  approveAlarmHandler
} from "./alarms.controller";

export const alarmRouter = Router();

alarmRouter.post("/alarms/ingest", ingestAlarmHandler);
alarmRouter.get("/alarms/active", authenticate, getActiveAlarmsHandler);
alarmRouter.get("/alarms/history", authenticate, getAlarmHistoryHandler);
alarmRouter.post("/alarms/:id/fix", authenticate, fixAlarmHandler);
alarmRouter.post("/alarms/:id/approve", authenticate, approveAlarmHandler);
