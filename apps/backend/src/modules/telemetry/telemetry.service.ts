import { getMongoDb } from "../../database/mongo";
import { getPostgresPool } from "../../database/postgres";
import { TELEMETRY_COLLECTION } from "../../database/collections";
import type { TelemetryPointInput } from "./telemetry.validation";
import { updateRunningHours } from "./running-hours.service";

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

let lastPostgresTelemetrySyncTime = 0;

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
      
      // Look for electricity_kwh in the incoming points
      const kwhPoint = plnPoints.find(p => p.tagId.endsWith("/active_energy") || p.tagId.endsWith("/electricity_kwh"));
      if (kwhPoint) {
        const electricity_kwh = Number(kwhPoint.value);
        if (!isNaN(electricity_kwh)) {
          const ts = kwhPoint.ts ? new Date(kwhPoint.ts) : new Date();
          
          await pool.query(`
            INSERT INTO electricity_telemetry (t_stamp, electricity_kwh, id_device)
            VALUES ($1, $2, $3)
          `, [ts, electricity_kwh, "Cubicle_PLN_PM8000"]);
          console.log("Successfully synced electricity_kwh to PostgreSQL");
        }
      }
    } catch (err: any) {
      console.error("Failed to sync telemetry to PostgreSQL:", err.message);
    }
  }

  // PostgreSQL Sync for water telemetry
  const waterPoints = points.filter(
    (p) =>
      p.tagId === "utility/water" ||
      p.tagId.includes("/water_m3") ||
      p.tagId.endsWith("/total_flow")
  );
  if (waterPoints.length > 0) {
    try {
      const pool = getPostgresPool();
      for (const p of waterPoints) {
        const water_m3 = Number(p.value);
        if (!isNaN(water_m3)) {
          const ts = p.ts ? new Date(p.ts) : new Date();
          const deviceId = p.deviceId || "unknown";
          const water_kwh = water_m3 * 0.4;
          await pool.query(
            `INSERT INTO water_telemetry (t_stamp, water_m3, water_kwh, id_device) VALUES ($1, $2, $3, $4)`,
            [ts, water_m3, water_kwh, deviceId]
          );
          console.log(`Successfully synced water_m3 (${water_m3}) and water_kwh (${water_kwh}) to PostgreSQL`);
        }
      }
    } catch (err: any) {
      console.error("Failed to sync water telemetry to PostgreSQL:", err.message);
    }
  }

  // PostgreSQL Sync for gas telemetry
  const gasPoints = points.filter(
    (p) =>
      p.tagId === "utility/gas" ||
      p.tagId.includes("/gas_sm3") ||
      p.tagId.endsWith("/gas_flow")
  );
  if (gasPoints.length > 0) {
    try {
      const pool = getPostgresPool();
      for (const p of gasPoints) {
        const gas_sm3 = Number(p.value);
        if (!isNaN(gas_sm3)) {
          const ts = p.ts ? new Date(p.ts) : new Date();
          const deviceId = p.deviceId || "unknown";
          await pool.query(
            `INSERT INTO gas_telemetry (t_stamp, gas_sm3, id_device) VALUES ($1, $2, $3)`,
            [ts, gas_sm3, deviceId]
          );
          console.log(`Successfully synced gas_sm3 (${gas_sm3}) to PostgreSQL`);
        }
      }
    } catch (err: any) {
      console.error("Failed to sync gas telemetry to PostgreSQL:", err.message);
    }
  }


  // PostgreSQL Sync for cooling tower telemetry (throttled to 1 minute)
  const now = Date.now();
  if (now - lastPostgresTelemetrySyncTime >= 60000) {
    const coolingPoints = points.filter(p => 
      p.tagId === "cooling-water/return_temp" || 
      p.tagId === "cooling-water/supply_temp" || 
      p.tagId === "cooling-water/st3_return_temp"
    );
    if (coolingPoints.length > 0) {
      try {
        const pool = getPostgresPool();
        const ts = coolingPoints[0].ts ? new Date(coolingPoints[0].ts) : new Date();
        const deviceId = coolingPoints[0].deviceId || "cooling-water-1";

        const retPt = coolingPoints.find(p => p.tagId === "cooling-water/return_temp");
        const suppPt = coolingPoints.find(p => p.tagId === "cooling-water/supply_temp");
        const st3Pt = coolingPoints.find(p => p.tagId === "cooling-water/st3_return_temp");

        const return_temp = retPt ? Number(retPt.value) : null;
        const supply_temp = suppPt ? Number(suppPt.value) : null;
        const st3_return_temp = st3Pt ? Number(st3Pt.value) : null;

        if ((return_temp !== null && !isNaN(return_temp)) || 
            (supply_temp !== null && !isNaN(supply_temp)) || 
            (st3_return_temp !== null && !isNaN(st3_return_temp))) {
          await pool.query(`
            INSERT INTO cooling_tower_telemetry (t_stamp, id_device, return_temp, supply_temp, st3_return_temp)
            VALUES ($1, $2, $3, $4, $5)
          `, [
            ts, 
            deviceId, 
            return_temp !== null && !isNaN(return_temp) ? return_temp : null,
            supply_temp !== null && !isNaN(supply_temp) ? supply_temp : null,
            st3_return_temp !== null && !isNaN(st3_return_temp) ? st3_return_temp : null
          ]);
          lastPostgresTelemetrySyncTime = now;
          console.log(`Successfully synced throttled cooling tower temperatures to PostgreSQL`);
        }
      } catch (err: any) {
        console.error("Failed to sync cooling tower telemetry to PostgreSQL:", err.message);
      }
    }
  }


  // Update running hours for status points
  const statusPoints = points.filter(p => p.tagId && p.tagId.includes("status"));
  for (const p of statusPoints) {
    const isRunning = p.value === 1 || p.value === true || String(p.value).toLowerCase() === "on";
    const ts = p.ts ? new Date(p.ts) : new Date();
    // Use background promise, don't block request response cycle
    updateRunningHours(p.tagId, isRunning, ts).catch((err) => {
      console.error(`Failed to update running hours during ingest for ${p.tagId}:`, err);
    });
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
