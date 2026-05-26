import { Router } from "express";
import {
  ackAlarmHandler,
  getActiveAlarmsHandler,
  getAlarmHistoryHandler,
  ingestAlarmHandler
} from "./alarms.controller";

export const alarmRouter = Router();

alarmRouter.post("/alarms/ingest", ingestAlarmHandler);
alarmRouter.get("/alarms/active", getActiveAlarmsHandler);
alarmRouter.get("/alarms/history", getAlarmHistoryHandler);
alarmRouter.post("/alarms/ack", ackAlarmHandler);
