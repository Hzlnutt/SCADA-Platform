import {
  ALARM_EVENTS_COLLECTION,
  ALARMS_COLLECTION
} from "../../database/collections";
import { getMongoDb } from "../../database/mongo";
import type { AlarmAckInput, AlarmEventInput } from "./alarms.validation";

export type AlarmStatus = "active" | "ack" | "cleared";
export type AlarmSeverity = "low" | "medium" | "high" | "critical";

export type AlarmDoc = {
  alarmKey: string;
  tagId: string;
  deviceId?: string;
  unit?: string;
  area?: string;
  message: string;
  severity: AlarmSeverity;
  status: AlarmStatus;
  firstTs: Date;
  lastTs: Date;
  ack?: { userId?: string; note?: string; ts: Date };
  clearedTs?: Date;
  source: string;
};

export type AlarmEventDoc = {
  alarmKey: string;
  tagId: string;
  deviceId?: string;
  unit?: string;
  area?: string;
  message: string;
  severity: AlarmSeverity;
  eventType: "active" | "ack" | "clear";
  ts: Date;
  ack?: { userId?: string; note?: string; ts: Date };
  source: string;
};

type ActiveQuery = {
  severity?: AlarmSeverity;
  limit: number;
};

type HistoryQuery = {
  alarmKey?: string;
  tagId?: string;
  from?: Date;
  to?: Date;
  limit: number;
};

const buildEventDoc = (event: AlarmEventInput, ts: Date): AlarmEventDoc => {
  return {
    alarmKey: event.alarmKey,
    tagId: event.tagId,
    deviceId: event.deviceId,
    unit: event.unit,
    area: event.area,
    message: event.message,
    severity: event.severity,
    eventType: event.status === "cleared" ? "clear" : event.status,
    ts,
    ack: event.ack
      ? { userId: event.ack.userId, note: event.ack.note, ts }
      : undefined,
    source: "ignition"
  };
};

const buildAlarmUpdate = (event: AlarmEventInput, ts: Date) => {
  const baseSet = {
    alarmKey: event.alarmKey,
    tagId: event.tagId,
    deviceId: event.deviceId,
    unit: event.unit,
    area: event.area,
    message: event.message,
    severity: event.severity,
    status: event.status,
    lastTs: ts,
    source: "ignition"
  };

  if (event.status === "active") {
    return {
      $set: baseSet,
      $setOnInsert: { firstTs: ts },
      $unset: { ack: "" as const, clearedTs: "" as const }
    };
  }

  if (event.status === "ack") {
    return {
      $set: {
        ...baseSet,
        ack: {
          userId: event.ack?.userId,
          note: event.ack?.note,
          ts
        }
      }
    };
  }

  return {
    $set: {
      ...baseSet,
      clearedTs: ts
    }
  };
};

const createError = (message: string, statusCode: number) => {
  const error = new Error(message) as Error & { statusCode?: number };
  error.statusCode = statusCode;
  return error;
};

export const ingestAlarmEvents = async (events: AlarmEventInput[]) => {
  const db = getMongoDb();
  const alarms = db.collection<AlarmDoc>(ALARMS_COLLECTION);
  const alarmEvents = db.collection<AlarmEventDoc>(ALARM_EVENTS_COLLECTION);

  const alarmOps = events.map((event) => {
    const ts = event.ts ?? new Date();
    return {
      updateOne: {
        filter: { alarmKey: event.alarmKey },
        update: buildAlarmUpdate(event, ts),
        upsert: true
      }
    };
  });

  if (alarmOps.length > 0) {
    await alarms.bulkWrite(alarmOps, { ordered: false });
  }

  const eventDocs = events.map((event) =>
    buildEventDoc(event, event.ts ?? new Date())
  );

  const result = await alarmEvents.insertMany(eventDocs, { ordered: false });

  return { inserted: result.insertedCount, events: eventDocs };
};

export const getActiveAlarms = async (query: ActiveQuery) => {
  const db = getMongoDb();
  const alarms = db.collection<AlarmDoc>(ALARMS_COLLECTION);

  const filter: Record<string, unknown> = {
    status: { $in: ["active", "ack"] }
  };

  if (query.severity) {
    filter.severity = query.severity;
  }

  return alarms
    .find(filter)
    .sort({ lastTs: -1 })
    .limit(query.limit)
    .toArray();
};

export const getAlarmHistory = async (query: HistoryQuery) => {
  const db = getMongoDb();
  const alarmEvents = db.collection<AlarmEventDoc>(ALARM_EVENTS_COLLECTION);

  const filter: Record<string, unknown> = {};

  if (query.alarmKey) {
    filter.alarmKey = query.alarmKey;
  }

  if (query.tagId) {
    filter.tagId = query.tagId;
  }

  if (query.from || query.to) {
    filter.ts = {
      ...(query.from ? { $gte: query.from } : {}),
      ...(query.to ? { $lte: query.to } : {})
    };
  }

  return alarmEvents
    .find(filter)
    .sort({ ts: -1 })
    .limit(query.limit)
    .toArray();
};

export const ackAlarm = async (input: AlarmAckInput) => {
  const db = getMongoDb();
  const alarms = db.collection<AlarmDoc>(ALARMS_COLLECTION);
  const alarmEvents = db.collection<AlarmEventDoc>(ALARM_EVENTS_COLLECTION);

  const alarm = await alarms.findOne({ alarmKey: input.alarmKey });
  if (!alarm) {
    throw createError("Alarm not found", 404);
  }

  if (alarm.status === "cleared") {
    throw createError("Alarm already cleared", 409);
  }

  const ts = new Date();
  const ack = { userId: input.userId, note: input.note, ts };

  await alarms.updateOne(
    { alarmKey: input.alarmKey },
    {
      $set: {
        status: "ack",
        lastTs: ts,
        ack
      }
    }
  );

  const eventDoc: AlarmEventDoc = {
    alarmKey: alarm.alarmKey,
    tagId: alarm.tagId,
    deviceId: alarm.deviceId,
    unit: alarm.unit,
    area: alarm.area,
    message: alarm.message,
    severity: alarm.severity,
    eventType: "ack",
    ts,
    ack,
    source: "operator"
  };

  await alarmEvents.insertOne(eventDoc);

  return eventDoc;
};
