import { Db } from "mongodb";
import { env } from "../config/env.config";
import { logger } from "../config/logger.config";
import {
  ALARM_EVENTS_COLLECTION,
  ALARMS_COLLECTION,
  AUDIT_COLLECTION,
  AUTH_TOKENS_COLLECTION,
  HISTORIAN_COLLECTION,
  HISTORIAN_HOURLY_COLLECTION,
  MAINTENANCE_COLLECTION,
  NOTIFICATIONS_COLLECTION,
  STATE_COLLECTION,
  SHIFT_REPORTS_COLLECTION,
  TELEMETRY_COLLECTION,
  THRESHOLDS_COLLECTION,
  USERS_COLLECTION,
  MACHINE_CATEGORIES_COLLECTION,
  MACHINE_CONFIGS_COLLECTION,
  MACHINE_THRESHOLDS_COLLECTION,
  ELECTRICITY_RAW_COLLECTION,
  ELECTRICITY_1M_COLLECTION,
  ELECTRICITY_1H_COLLECTION
} from "./collections";
import { connectMongo } from "./mongo";

type TimeSeriesOptions = {
  timeField: string;
  metaField: string;
  granularity: "seconds" | "minutes" | "hours";
};

const ensureTimeSeries = async (
  db: Db,
  name: string,
  options: TimeSeriesOptions,
  expireAfterSeconds: number
) => {
  const existing = await db.listCollections({ name }).toArray();
  if (existing.length === 0) {
    await db.createCollection(name, {
      timeseries: options,
      expireAfterSeconds
    });
    logger.info({ collection: name }, "mongo collection created");
  } else {
    try {
      await db.command({ collMod: name, expireAfterSeconds });
    } catch (error) {
      logger.warn({ err: error }, "unable to update collection TTL");
    }
  }

  const collection = db.collection(name);
  await collection.createIndex({ "meta.tagId": 1, ts: -1 });
  await collection.createIndex({ "meta.deviceId": 1, ts: -1 });
};

const ensureCollection = async (db: Db, name: string) => {
  const existing = await db.listCollections({ name }).toArray();
  if (existing.length === 0) {
    await db.createCollection(name);
  }

  return db.collection(name);
};

const ensureAlarmCollections = async (db: Db) => {
  const alarms = await ensureCollection(db, ALARMS_COLLECTION);
  await alarms.createIndex({ alarmKey: 1 }, { unique: true });
  await alarms.createIndex({ status: 1, severity: 1, lastTs: -1 });
  await alarms.createIndex({ tagId: 1, lastTs: -1 });

  const alarmEvents = await ensureCollection(db, ALARM_EVENTS_COLLECTION);
  await alarmEvents.createIndex({ alarmKey: 1, ts: -1 });
  await alarmEvents.createIndex({ tagId: 1, ts: -1 });
  await alarmEvents.createIndex({ severity: 1, ts: -1 });
};

const ensureStateCollection = async (db: Db) => {
  const existing = await db.listCollections({ name: STATE_COLLECTION }).toArray();
  if (existing.length === 0) {
    await db.createCollection(STATE_COLLECTION);
  }

  const collection = db.collection(STATE_COLLECTION);
  await collection.createIndex({ key: 1 }, { unique: true });
};

const ensureUserCollections = async (db: Db) => {
  const users = await ensureCollection(db, USERS_COLLECTION);
  await users.createIndex({ email: 1 }, { unique: true });
  await users.createIndex({ role: 1 });
  await users.createIndex({ provider: 1, providerId: 1 });
};

const ensureAuthCollections = async (db: Db) => {
  const tokens = await ensureCollection(db, AUTH_TOKENS_COLLECTION);
  await tokens.createIndex({ tokenHash: 1 }, { unique: true });
  await tokens.createIndex({ userId: 1 });
  await tokens.createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 });

  const audit = await ensureCollection(db, AUDIT_COLLECTION);
  await audit.createIndex({ actorId: 1, ts: -1 });
  await audit.createIndex({ action: 1, ts: -1 });
};

const ensureOperationsCollections = async (db: Db) => {
  const maintenance = await ensureCollection(db, MAINTENANCE_COLLECTION);
  await maintenance.createIndex({ machineId: 1, date: -1 });
  await maintenance.createIndex({ status: 1, date: -1 });
  await maintenance.createIndex({ "approval.status": 1, date: -1 });

  const shiftReports = await ensureCollection(db, SHIFT_REPORTS_COLLECTION);
  await shiftReports.createIndex({ machineId: 1, reportDate: -1 });
  await shiftReports.createIndex({ shift: 1, reportDate: -1 });
  await shiftReports.createIndex({ "approval.status": 1, reportDate: -1 });
};

const ensureThresholdCollections = async (db: Db) => {
  const thresholds = await ensureCollection(db, THRESHOLDS_COLLECTION);
  await thresholds.createIndex({ groupId: 1 }, { unique: true });
  await thresholds.createIndex({ groupName: 1 });
  await thresholds.createIndex({ tagIds: 1 });
  await thresholds.createIndex({ updatedAt: -1 });

  const notifications = await ensureCollection(db, NOTIFICATIONS_COLLECTION);
  await notifications.createIndex({ status: 1, createdAt: -1 });
  await notifications.createIndex({ severity: 1, createdAt: -1 });
};

export const ensureMongoCollections = async () => {
  const db = await connectMongo();

  const telemetryExpire = env.telemetryRetentionDays * 24 * 60 * 60;
  const historianExpire = env.historianRetentionDays * 24 * 60 * 60;
  const historianHourlyExpire =
    env.historianHourlyRetentionDays * 24 * 60 * 60;

  await ensureTimeSeries(db, TELEMETRY_COLLECTION, {
    timeField: "ts",
    metaField: "meta",
    granularity: "seconds"
  }, telemetryExpire);

  await ensureTimeSeries(db, HISTORIAN_COLLECTION, {
    timeField: "ts",
    metaField: "meta",
    granularity: "minutes"
  }, historianExpire);

  await ensureTimeSeries(db, HISTORIAN_HOURLY_COLLECTION, {
    timeField: "ts",
    metaField: "meta",
    granularity: "hours"
  }, historianHourlyExpire);

  // Dedicated time-series collections for PLN electricity
  await ensureTimeSeries(db, ELECTRICITY_RAW_COLLECTION, {
    timeField: "ts",
    metaField: "meta",
    granularity: "seconds"
  }, telemetryExpire);

  await ensureTimeSeries(db, ELECTRICITY_1M_COLLECTION, {
    timeField: "ts",
    metaField: "meta",
    granularity: "minutes"
  }, historianExpire);

  await ensureTimeSeries(db, ELECTRICITY_1H_COLLECTION, {
    timeField: "ts",
    metaField: "meta",
    granularity: "hours"
  }, historianHourlyExpire);

  await ensureAlarmCollections(db);
  await ensureUserCollections(db);
  await ensureAuthCollections(db);
  await ensureOperationsCollections(db);
  await ensureThresholdCollections(db);

  await ensureStateCollection(db);
  await ensureDynamicConfigCollections(db);
};

const ensureDynamicConfigCollections = async (db: Db) => {
  const categories = await ensureCollection(db, MACHINE_CATEGORIES_COLLECTION);
  await categories.createIndex({ id: 1 }, { unique: true });

  const configs = await ensureCollection(db, MACHINE_CONFIGS_COLLECTION);
  await configs.createIndex({ id: 1 }, { unique: true });

  const thresholds = await ensureCollection(db, MACHINE_THRESHOLDS_COLLECTION);
  await thresholds.createIndex({ machineId: 1, parameter: 1 }, { unique: true });
};
