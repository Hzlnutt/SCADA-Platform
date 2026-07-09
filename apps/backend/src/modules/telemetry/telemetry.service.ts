import { getMongoDb } from "../../database/mongo";
import { getPostgresPool } from "../../database/postgres";
import { TELEMETRY_COLLECTION } from "../../database/collections";
import type { TelemetryPointInput } from "./telemetry.validation";

type RangeQuery = {
  tagId: string;
  from?: Date;
  to?: Date;
  limit: number;
};

export type TelemetryDoc = {
  ts: Date;
  value: number | string | boolean;
  quality: "good" | "bad" | "uncertain";
  meta: {
    tagId: string;
    deviceId?: string;
    unit?: string;
    area?: string;
    source: string;
  };
};

export const ingestTelemetry = async (points: TelemetryPointInput[]) => {
  const db = getMongoDb();
  const collection = db.collection(TELEMETRY_COLLECTION);

  const docs: TelemetryDoc[] = points.map((point) => {
    const meta = {
      tagId: point.tagId,
      ...(point.deviceId ? { deviceId: point.deviceId } : {}),
      ...(point.unit ? { unit: point.unit } : {}),
      ...(point.area ? { area: point.area } : {}),
      source: "ignition"
    };

    return {
      ts: point.ts ?? new Date(),
      value: point.value,
      quality: point.quality ?? "good",
      meta
    };
  });

  const result = await collection.insertMany(docs, { ordered: false });

  // PostgreSQL Sync for electricity PM8000
  const plnPoints = points.filter(p => p.deviceId === "Cubicle_PLN_PM8000");
  if (plnPoints.length > 0) {
    try {
      const pool = getPostgresPool();
      
      // Get the latest row from PostgreSQL to merge values (so we don't nullify other fields)
      const latestPg = await pool.query("SELECT * FROM electricity_telemetry ORDER BY t_stamp DESC LIMIT 1");
      const latestRow = latestPg.rows[0] || {};
      
      // Map new values
      let power_factor = latestRow.power_factor;
      let active_power = latestRow.active_power;
      let reactive_power = latestRow.reactive_power;
      let apparent_power = latestRow.apparent_power;
      let frequency = latestRow.frequency;
      let volt_ll_avg = latestRow.volt_ll_avg;
      let current_a = latestRow.current_a;
      let current_b = latestRow.current_b;
      let current_c = latestRow.current_c;
      let voltage_ab = latestRow.voltage_ab;
      let voltage_bc = latestRow.voltage_bc;
      let voltage_ca = latestRow.voltage_ca;
      let electricity_kwh = latestRow.electricity_kwh;
      
      plnPoints.forEach(p => {
        const val = Number(p.value);
        if (!isNaN(val)) {
          if (p.tagId.endsWith("/power_factor")) power_factor = val;
          else if (p.tagId.endsWith("/active_power")) active_power = val;
          else if (p.tagId.endsWith("/reactive_power")) reactive_power = val;
          else if (p.tagId.endsWith("/apparent_power")) apparent_power = val;
          else if (p.tagId.endsWith("/frequency")) frequency = val;
          else if (p.tagId.endsWith("/voltage_avg") || p.tagId.endsWith("/volt_ll_avg")) volt_ll_avg = val;
          else if (p.tagId.endsWith("/current_a")) current_a = val;
          else if (p.tagId.endsWith("/current_b")) current_b = val;
          else if (p.tagId.endsWith("/current_c")) current_c = val;
          else if (p.tagId.endsWith("/voltage_ab")) voltage_ab = val;
          else if (p.tagId.endsWith("/voltage_bc")) voltage_bc = val;
          else if (p.tagId.endsWith("/voltage_ca")) voltage_ca = val;
          else if (p.tagId.endsWith("/active_energy") || p.tagId.endsWith("/electricity_kwh")) electricity_kwh = val;
        }
      });
      
      // Ingest timestamp (use point timestamp if available, otherwise NOW)
      const ts = plnPoints[0].ts ? new Date(plnPoints[0].ts) : new Date();

      await pool.query(`
        INSERT INTO electricity_telemetry (
          t_stamp, electricity_kwh, power_factor, active_power, reactive_power, apparent_power,
          frequency, volt_ll_avg, current_a, current_b, current_c, voltage_ab, voltage_bc, voltage_ca
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
      `, [
        ts, electricity_kwh, power_factor, active_power, reactive_power, apparent_power,
        frequency, volt_ll_avg, current_a, current_b, current_c, voltage_ab, voltage_bc, voltage_ca
      ]);
    } catch (err: any) {
      console.error("Failed to sync telemetry to PostgreSQL:", err.message);
    }
  }

  return { inserted: result.insertedCount, docs };
};

export const getLatestTelemetry = async (tagId: string) => {
  const db = getMongoDb();
  const collection = db.collection(TELEMETRY_COLLECTION);

  return collection
    .find({ "meta.tagId": tagId })
    .sort({ ts: -1 })
    .limit(1)
    .next();
};

export const getLatestTelemetryByTags = async (tagIds: string[]) => {
  if (tagIds.length === 0) {
    return [];
  }

  const db = getMongoDb();
  const collection = db.collection<TelemetryDoc>(TELEMETRY_COLLECTION);

  return collection
    .aggregate<TelemetryDoc>([
      { $match: { "meta.tagId": { $in: tagIds } } },
      { $sort: { ts: -1 } },
      {
        $group: {
          _id: "$meta.tagId",
          doc: { $first: "$$ROOT" }
        }
      },
      { $replaceRoot: { newRoot: "$doc" } }
    ])
    .toArray();
};

export const queryTelemetryRange = async (query: RangeQuery) => {
  const db = getMongoDb();
  const collection = db.collection(TELEMETRY_COLLECTION);

  const filter: Record<string, unknown> = {
    "meta.tagId": query.tagId
  };

  if (query.from || query.to) {
    filter.ts = {
      ...(query.from ? { $gte: query.from } : {}),
      ...(query.to ? { $lte: query.to } : {})
    };
  }

  return collection
    .find(filter)
    .sort({ ts: 1 })
    .limit(query.limit)
    .toArray();
};
