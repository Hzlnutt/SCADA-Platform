import { STATE_COLLECTION, USERS_COLLECTION, ALARMS_COLLECTION } from "../database/collections";
import { getMongoDb } from "../database/mongo";
import { ingestAlarmEvents } from "../modules/alarms/alarms.service";
import { publishAlarmEvents } from "./alarms.publisher";
import { queueEmail } from "./notifications.service";
import { findThresholdByTag } from "../modules/thresholds/thresholds.service";
import type { AlarmEventInput } from "../modules/alarms/alarms.validation";
import type { TelemetryDoc } from "../modules/telemetry/telemetry.service";

const THROTTLE_MS = 10 * 60 * 1000;

type ThresholdAlert = {
  level: "warning" | "breach";
  direction: "upper" | "lower";
  tagId: string;
  groupName: string;
  metric: string;
  unit: string;
  value: number;
  threshold: number;
  actionText?: string;
};

type AlertState = {
  key: string;
  lastNotifiedAt: Date;
};

const shouldNotify = async (key: string) => {
  const db = getMongoDb();
  const state = db.collection<AlertState>(STATE_COLLECTION);
  const existing = await state.findOne({ key });
  const now = new Date();

  if (existing && now.getTime() - existing.lastNotifiedAt.getTime() < THROTTLE_MS) {
    return false;
  }

  await state.updateOne(
    { key },
    { $set: { key, lastNotifiedAt: now } },
    { upsert: true }
  );
  return true;
};

const metricLabelMap: Record<string, string> = {
  kwh: "energi",
  kw: "daya",
  pressure: "tekanan",
  temperature: "suhu",
  flow: "debit",
  vibration: "getaran"
};

const formatMetric = (metric: string) =>
  metricLabelMap[metric] ?? metric.toLowerCase();

const formatDirection = (direction: "upper" | "lower") =>
  direction === "upper" ? "atas" : "bawah";

const buildAlarmMessage = (alert: ThresholdAlert) => {
  const metric = formatMetric(alert.metric);
  const direction = formatDirection(alert.direction);
  const value = `${alert.value.toFixed(2)} ${alert.unit}`;
  const threshold = `${alert.threshold.toFixed(2)} ${alert.unit}`;
  const comparator = alert.direction === "upper" ? ">" : "<";

  if (alert.level === "breach") {
    return `Machine ${alert.groupName} melewati ambang batas ${metric} ${direction}. (${value} ${comparator} ${threshold})`;
  }

  return `Segera cek machine ${alert.groupName} karena sudah mendekati batas ${metric} ${direction}. (${value} ~ ${threshold})`;
};

const buildAlarmEvent = (alert: ThresholdAlert): AlarmEventInput => {
  const severity = alert.level === "breach" ? "high" : "medium";
  return {
    alarmKey: `threshold:${alert.tagId}:${alert.direction}`,
    tagId: alert.tagId,
    message: buildAlarmMessage(alert),
    severity,
    status: "active"
  };
};

const buildEmailBody = (alert: ThresholdAlert) => {
  const base = buildAlarmMessage(alert);
  const action = alert.actionText
    ? `Langkah operator: ${alert.actionText}`
    : "Langkah operator: ikuti SOP pemeriksaan machine.";
  return [base, action].filter(Boolean).join("\n");
};

const getRecipients = async () => {
  const db = getMongoDb();
  const users = db.collection<{ email: string; role: string }>(USERS_COLLECTION);
  const rows = await users
    .find({ role: { $in: ["operator", "team_head", "leader"] } })
    .project({ email: 1 })
    .toArray();
  return rows.map((row) => row.email).filter(Boolean);
};

const evaluatePoint = async (doc: TelemetryDoc) => {
  if (typeof doc.value !== "number") {
    return null;
  }

  const threshold = await findThresholdByTag(doc.meta.tagId);
  if (!threshold) {
    return null;
  }

  const value = doc.value;
  const upper = threshold.upper ?? null;
  const lower = threshold.lower ?? null;
  const warningPct = threshold.warningPct ?? 0.9;

  if (upper !== null) {
    if (value >= upper) {
      return {
        level: "breach",
        direction: "upper",
        tagId: doc.meta.tagId,
        groupName: threshold.groupName,
        metric: threshold.metric,
        unit: threshold.unit,
        value,
        threshold: upper,
        actionText: threshold.actionText
      } satisfies ThresholdAlert;
    }

    const warnUpper = upper * warningPct;
    if (value >= warnUpper) {
      return {
        level: "warning",
        direction: "upper",
        tagId: doc.meta.tagId,
        groupName: threshold.groupName,
        metric: threshold.metric,
        unit: threshold.unit,
        value,
        threshold: upper,
        actionText: threshold.actionText
      } satisfies ThresholdAlert;
    }
  }

  if (lower !== null) {
    if (value <= lower) {
      return {
        level: "breach",
        direction: "lower",
        tagId: doc.meta.tagId,
        groupName: threshold.groupName,
        metric: threshold.metric,
        unit: threshold.unit,
        value,
        threshold: lower,
        actionText: threshold.actionText
      } satisfies ThresholdAlert;
    }

    const warnLower = lower / warningPct;
    if (value <= warnLower) {
      return {
        level: "warning",
        direction: "lower",
        tagId: doc.meta.tagId,
        groupName: threshold.groupName,
        metric: threshold.metric,
        unit: threshold.unit,
        value,
        threshold: lower,
        actionText: threshold.actionText
      } satisfies ThresholdAlert;
    }
  }

  return null;
};

export const processThresholdAlerts = async (docs: TelemetryDoc[]) => {
  const alerts: ThresholdAlert[] = [];
  const clearEvents: AlarmEventInput[] = [];

  const db = getMongoDb();
  const alarmsCollection = db.collection(ALARMS_COLLECTION);

  for (const doc of docs) {
    const alert = await evaluatePoint(doc);
    if (alert) {
      alerts.push(alert);
    } else {
      // Telemetry point is within normal bounds. Check if there are active/ack alarms for this tagId.
      const activeAlarms = await alarmsCollection.find({
        tagId: doc.meta.tagId,
        status: { $in: ["active", "ack"] }
      }).toArray();

      if (activeAlarms.length > 0) {
        for (const alarm of activeAlarms) {
          clearEvents.push({
            alarmKey: alarm.alarmKey,
            tagId: alarm.tagId,
            deviceId: alarm.deviceId,
            unit: alarm.unit,
            area: alarm.area,
            message: `Cleared: Telemetry parameter for tag ${alarm.tagId} has returned to normal range.`,
            severity: alarm.severity,
            status: "cleared"
          });
        }
      }
    }
  }

  const events: AlarmEventInput[] = [];
  const recipients = await getRecipients();

  for (const alert of alerts) {
    const stateKey = `threshold:${alert.tagId}:${alert.direction}:${alert.level}`;
    const ok = await shouldNotify(stateKey);
    if (!ok) {
      continue;
    }

    events.push(buildAlarmEvent(alert));

    if (recipients.length > 0) {
      const subject = alert.level === "breach"
        ? `Alarm Threshold - ${alert.groupName}`
        : `Peringatan Threshold - ${alert.groupName}`;
      await queueEmail({
        to: recipients,
        subject,
        body: buildEmailBody(alert),
        severity: alert.level
      });
    }
  }

  if (events.length > 0) {
    const result = await ingestAlarmEvents(events);
    publishAlarmEvents(result.events);
  }

  if (clearEvents.length > 0) {
    const result = await ingestAlarmEvents(clearEvents);
    publishAlarmEvents(result.events);
  }
};
