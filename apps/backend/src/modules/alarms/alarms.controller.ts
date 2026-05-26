import { NextFunction, Request, Response } from "express";
import {
  alarmAckSchema,
  alarmActiveQuerySchema,
  alarmHistoryQuerySchema,
  alarmIngestSchema
} from "./alarms.validation";
import {
  ackAlarm,
  getActiveAlarms,
  getAlarmHistory,
  ingestAlarmEvents
} from "./alarms.service";
import { publishAlarmEvents } from "../../services/alarms.publisher";
import { recordAudit } from "../../services/audit.service";

export const ingestAlarmHandler = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const payload = Array.isArray(req.body)
      ? { events: req.body }
      : req.body;
    const parsed = alarmIngestSchema.parse(payload);

    const result = await ingestAlarmEvents(parsed.events);
    publishAlarmEvents(result.events);

    res.status(202).json({ inserted: result.inserted });
  } catch (err) {
    next(err);
  }
};

export const getActiveAlarmsHandler = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const parsed = alarmActiveQuerySchema.parse(req.query);
    const data = await getActiveAlarms(parsed);

    res.json({ data });
  } catch (err) {
    next(err);
  }
};

export const getAlarmHistoryHandler = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const parsed = alarmHistoryQuerySchema.parse(req.query);
    const data = await getAlarmHistory(parsed);

    res.json({ data });
  } catch (err) {
    next(err);
  }
};

export const ackAlarmHandler = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const parsed = alarmAckSchema.parse(req.body);
    const eventDoc = await ackAlarm(parsed);

    await recordAudit({
      actorId: parsed.userId,
      action: "alarm.ack",
      resourceType: "alarm",
      resourceId: parsed.alarmKey,
      meta: { note: parsed.note }
    });

    publishAlarmEvents([eventDoc]);
    res.json({ status: "ack", alarmKey: parsed.alarmKey, ts: eventDoc.ts });
  } catch (err) {
    next(err);
  }
};
