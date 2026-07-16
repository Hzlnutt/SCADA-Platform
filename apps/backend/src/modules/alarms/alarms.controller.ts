import { NextFunction, Request, Response } from "express";
import {
  alarmAckSchema,
  alarmActiveQuerySchema,
  alarmHistoryQuerySchema,
  alarmIngestSchema
} from "./alarms.validation";
import {
  getActiveAlarms,
  getAlarmHistory,
  ingestAlarmEvents,
  fixAlarmPostgres,
  approveAlarmPostgres
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
    const data = await getActiveAlarms({ ...parsed, unit: req.query.unit as string });

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
    const data = await getAlarmHistory({ ...parsed, unit: req.query.unit as string });

    res.json({ data });
  } catch (err) {
    next(err);
  }
};

export const fixAlarmHandler = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const id = parseInt(req.params.id);
    const { operatorName, operatorAction } = req.body;
    if (isNaN(id) || !operatorName || !operatorAction) {
      return res.status(400).json({ error: "Missing required parameters" });
    }

    const updated = await fixAlarmPostgres(id, operatorName, operatorAction);
    
    publishAlarmEvents([{
      alarmKey: updated.alarm_key,
      tagId: updated.tag_id,
      deviceId: updated.device_id,
      unit: updated.unit_id,
      area: updated.area,
      message: updated.message,
      severity: updated.severity,
      eventType: "ack",
      ts: new Date(updated.t_stamp),
      source: "operator"
    }]);

    res.json({ success: true, data: updated });
  } catch (err) {
    next(err);
  }
};

export const approveAlarmHandler = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const id = parseInt(req.params.id);
    const user = (req as unknown as { user?: { name: string } }).user;
    const approverName = user?.name || "Ka. Shift";
    
    if (isNaN(id)) {
      return res.status(400).json({ error: "Invalid alarm ID" });
    }

    const updated = await approveAlarmPostgres(id, approverName);

    publishAlarmEvents([{
      alarmKey: updated.alarm_key,
      tagId: updated.tag_id,
      deviceId: updated.device_id,
      unit: updated.unit_id,
      area: updated.area,
      message: updated.message,
      severity: updated.severity,
      eventType: "clear",
      ts: new Date(updated.t_stamp),
      source: "supervisor"
    }]);

    res.json({ success: true, data: updated });
  } catch (err) {
    next(err);
  }
};
