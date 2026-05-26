import { env } from "../../config/env.config";
import { logger } from "../../config/logger.config";
import {
  HISTORIAN_COLLECTION,
  HISTORIAN_HOURLY_COLLECTION,
  STATE_COLLECTION,
  TELEMETRY_COLLECTION
} from "../../database/collections";
import { getMongoDb } from "../../database/mongo";

const ROLLUP_MINUTE_KEY = "telemetry_rollup_1m";
const ROLLUP_HOUR_KEY = "historian_rollup_1h";
let minuteRunning = false;
let hourRunning = false;

type RollupState = {
  key: string;
  lastTs?: Date;
  updatedAt?: Date;
};

const loadRollupState = async (key: string) => {
  const db = getMongoDb();
  const stateCollection = db.collection<RollupState>(STATE_COLLECTION);

  return stateCollection.findOne({ key });
};

const saveRollupState = async (key: string, lastTs: Date) => {
  const db = getMongoDb();
  const stateCollection = db.collection<RollupState>(STATE_COLLECTION);

  await stateCollection.updateOne(
    { key },
    { $set: { lastTs, updatedAt: new Date() } },
    { upsert: true }
  );
};

export const rollupTelemetryMinute = async () => {
  if (minuteRunning) {
    logger.warn("minute rollup skipped (already running)");
    return;
  }

  minuteRunning = true;
  try {
    const db = getMongoDb();
    const telemetryCollection = db.collection(TELEMETRY_COLLECTION);
    const historianCollection = db.collection(HISTORIAN_COLLECTION);

    const now = new Date();
    const lagMs = env.rollupLagSeconds * 1000;
    const until = new Date(now.getTime() - lagMs);

    const state = await loadRollupState(ROLLUP_MINUTE_KEY);
    const defaultFrom = new Date(
      until.getTime() - env.rollupIntervalMs * 5
    );
    const from = state?.lastTs ? new Date(state.lastTs) : defaultFrom;

    if (from >= until) {
      return;
    }

    const pipeline = [
      {
        $match: {
          ts: { $gte: from, $lt: until },
          value: { $type: "number" }
        }
      },
      { $sort: { ts: 1 } },
      {
        $group: {
          _id: {
            tagId: "$meta.tagId",
            deviceId: "$meta.deviceId",
            unit: "$meta.unit",
            area: "$meta.area",
            bucket: {
              $dateTrunc: {
                date: "$ts",
                unit: "minute",
                timezone: "UTC"
              }
            }
          },
          avgValue: { $avg: "$value" },
          minValue: { $min: "$value" },
          maxValue: { $max: "$value" },
          lastValue: { $last: "$value" },
          count: { $sum: 1 }
        }
      },
      {
        $project: {
          _id: 0,
          ts: "$_id.bucket",
          value: "$avgValue",
          meta: {
            tagId: "$_id.tagId",
            deviceId: "$_id.deviceId",
            unit: "$_id.unit",
            area: "$_id.area",
            source: "rollup",
            resolution: "1m",
            aggregate: "avg",
            count: "$count",
            min: "$minValue",
            max: "$maxValue",
            last: "$lastValue"
          }
        }
      }
    ];

    const docs = await telemetryCollection
      .aggregate(pipeline, { allowDiskUse: true })
      .toArray();

    if (docs.length > 0) {
      await historianCollection.insertMany(docs, { ordered: false });
    }

    await saveRollupState(ROLLUP_MINUTE_KEY, until);
    logger.info({ inserted: docs.length, from, to: until }, "minute rollup complete");
  } finally {
    minuteRunning = false;
  }
};

export const rollupHistorianHour = async () => {
  if (hourRunning) {
    logger.warn("hourly rollup skipped (already running)");
    return;
  }

  hourRunning = true;
  try {
    const db = getMongoDb();
    const minuteCollection = db.collection(HISTORIAN_COLLECTION);
    const hourlyCollection = db.collection(HISTORIAN_HOURLY_COLLECTION);

    const now = new Date();
    const lagMs = env.rollupHourlyLagMinutes * 60 * 1000;
    const until = new Date(now.getTime() - lagMs);

    const state = await loadRollupState(ROLLUP_HOUR_KEY);
    const defaultFrom = new Date(until.getTime() - 6 * 60 * 60 * 1000);
    const from = state?.lastTs ? new Date(state.lastTs) : defaultFrom;

    if (from >= until) {
      return;
    }

    const pipeline = [
      {
        $match: {
          ts: { $gte: from, $lt: until },
          value: { $type: "number" }
        }
      },
      { $sort: { ts: 1 } },
      {
        $group: {
          _id: {
            tagId: "$meta.tagId",
            deviceId: "$meta.deviceId",
            unit: "$meta.unit",
            area: "$meta.area",
            bucket: {
              $dateTrunc: {
                date: "$ts",
                unit: "hour",
                timezone: "UTC"
              }
            }
          },
          avgValue: { $avg: "$value" },
          minValue: { $min: { $ifNull: ["$meta.min", "$value"] } },
          maxValue: { $max: { $ifNull: ["$meta.max", "$value"] } },
          lastValue: { $last: { $ifNull: ["$meta.last", "$value"] } },
          count: { $sum: { $ifNull: ["$meta.count", 1] } }
        }
      },
      {
        $project: {
          _id: 0,
          ts: "$_id.bucket",
          value: "$avgValue",
          meta: {
            tagId: "$_id.tagId",
            deviceId: "$_id.deviceId",
            unit: "$_id.unit",
            area: "$_id.area",
            source: "rollup",
            resolution: "1h",
            aggregate: "avg",
            count: "$count",
            min: "$minValue",
            max: "$maxValue",
            last: "$lastValue"
          }
        }
      }
    ];

    const docs = await minuteCollection
      .aggregate(pipeline, { allowDiskUse: true })
      .toArray();

    if (docs.length > 0) {
      await hourlyCollection.insertMany(docs, { ordered: false });
    }

    await saveRollupState(ROLLUP_HOUR_KEY, until);
    logger.info({ inserted: docs.length, from, to: until }, "hourly rollup complete");
  } finally {
    hourRunning = false;
  }
};
