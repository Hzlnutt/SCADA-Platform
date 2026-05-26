import {
  ALARM_EVENTS_COLLECTION,
  ALARMS_COLLECTION,
  TELEMETRY_COLLECTION
} from "../../database/collections";
import { getMongoDb } from "../../database/mongo";
import { listDeviceStatus } from "../devices/devices.service";

export const getAnalyticsSummary = async () => {
  const db = getMongoDb();
  const telemetry = db.collection(TELEMETRY_COLLECTION);
  const alarms = db.collection(ALARMS_COLLECTION);
  const alarmEvents = db.collection(ALARM_EVENTS_COLLECTION);

  const now = new Date();
  const lastHour = new Date(now.getTime() - 60 * 60 * 1000);
  const lastDay = new Date(now.getTime() - 24 * 60 * 60 * 1000);

  const telemetryPointsLastHour = await telemetry.countDocuments({
    ts: { $gte: lastHour }
  });

  const alarmEventsLastDay = await alarmEvents.countDocuments({
    ts: { $gte: lastDay }
  });

  const activeAlarmCount = await alarms.countDocuments({
    status: { $in: ["active", "ack"] }
  });

  const devices = await listDeviceStatus();
  const deviceStatus = devices.reduce(
    (acc, device) => {
      acc[device.status] += 1;
      return acc;
    },
    { online: 0, stale: 0, unknown: 0 }
  );

  const alarmsBySeverity = await alarmEvents
    .aggregate<{ _id: string; count: number }>([
      { $match: { ts: { $gte: lastDay } } },
      { $group: { _id: "$severity", count: { $sum: 1 } } },
      { $sort: { count: -1 } }
    ])
    .toArray();

  const telemetryByArea = await telemetry
    .aggregate<{ _id: string; count: number }>([
      { $match: { ts: { $gte: lastHour } } },
      { $group: { _id: "$meta.area", count: { $sum: 1 } } },
      { $sort: { count: -1 } }
    ])
    .toArray();

  return {
    kpi: {
      oee: 0.92,
      availability: 0.95,
      performance: 0.9,
      quality: 0.98
    },
    telemetryPointsLastHour,
    alarmEventsLastDay,
    activeAlarmCount,
    deviceStatus,
    alarmsBySeverity: alarmsBySeverity.map((item) => ({
      severity: item._id ?? "unknown",
      count: item.count
    })),
    telemetryByArea: telemetryByArea.map((item) => ({
      area: item._id ?? "Unknown",
      count: item.count
    }))
  };
};
