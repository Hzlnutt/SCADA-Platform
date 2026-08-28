import { getMongoDb } from "../../database/mongo";
import { getPostgresPool } from "../../database/postgres";
import {
  HISTORIAN_COLLECTION,
  HISTORIAN_HOURLY_COLLECTION
} from "../../database/collections";
import type { HistorianPointInput } from "./historian.validation";

type RangeQuery = {
  tagId: string;
  from?: Date;
  to?: Date;
  resolution: "1m" | "1h";
  limit: number;
};

const getHistorianCollectionName = (resolution: RangeQuery["resolution"]) => {
  return resolution === "1h" ? HISTORIAN_HOURLY_COLLECTION : HISTORIAN_COLLECTION;
};

export const ingestHistorian = async (points: HistorianPointInput[]) => {
  const db = getMongoDb();
  const collection = db.collection(HISTORIAN_COLLECTION);

  const docs = points.map((point) => {
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
  return result.insertedCount;
};

export const getHistorianRangeFromPostgres = async (query: RangeQuery) => {
  const tagMappings: Record<string, { table: string; column: string; minuteTable?: string }> = {
    // Cooling Tower WF1-U3 (Current Configuration Keys)
    "cooling-water/return_temp": { table: "cooling_tower_telemetry", column: "return_temp", minuteTable: "cooling_tower_telemetry_minute" },
    "cooling-water/supply_temp": { table: "cooling_tower_telemetry", column: "supply_temp", minuteTable: "cooling_tower_telemetry_minute" },
    "cooling-water/st3_return_temp": { table: "cooling_tower_telemetry", column: "st3_return_temp", minuteTable: "cooling_tower_telemetry_minute" },
    "cooling-water/flow": { table: "cooling_tower_telemetry", column: "flow", minuteTable: "cooling_tower_telemetry_minute" },
    "cooling-water/tds": { table: "cooling_tower_telemetry", column: "tds", minuteTable: "cooling_tower_telemetry_minute" },
    "cooling-water/ph": { table: "cooling_tower_telemetry", column: "ph", minuteTable: "cooling_tower_telemetry_minute" },
    "cooling-water/humidity": { table: "cooling_tower_telemetry", column: "humidity", minuteTable: "cooling_tower_telemetry_minute" },
    "cooling-water/ambient_temp": { table: "cooling_tower_telemetry", column: "ambient_temp", minuteTable: "cooling_tower_telemetry_minute" },
    "cooling-water/makeup_vol": { table: "cooling_tower_telemetry", column: "makeup_vol", minuteTable: "cooling_tower_telemetry_minute" },
    "cooling-water/makeup_tds": { table: "cooling_tower_telemetry", column: "makeup_tds", minuteTable: "cooling_tower_telemetry_minute" },
    "cooling-water/blowdown_vol": { table: "cooling_tower_telemetry", column: "blowdown_vol", minuteTable: "cooling_tower_telemetry_minute" },
    "cooling-water/makeup_ph": { table: "cooling_tower_telemetry", column: "makeup_ph", minuteTable: "cooling_tower_telemetry_minute" },

    // Cooling Tower WF1-U3 (Legacy)
    "cooling/return_temp": { table: "cooling_tower_telemetry", column: "return_temp", minuteTable: "cooling_tower_telemetry_minute" },
    "chiller/daikin_wf1u3_temp": { table: "cooling_tower_telemetry", column: "supply_temp", minuteTable: "cooling_tower_telemetry_minute" },
    "cooling/flow": { table: "cooling_tower_telemetry", column: "flow", minuteTable: "cooling_tower_telemetry_minute" },
    "cooling/tds": { table: "cooling_tower_telemetry", column: "tds", minuteTable: "cooling_tower_telemetry_minute" },
    "cooling/ph": { table: "cooling_tower_telemetry", column: "ph", minuteTable: "cooling_tower_telemetry_minute" },
    "cooling/humidity": { table: "cooling_tower_telemetry", column: "humidity", minuteTable: "cooling_tower_telemetry_minute" },

    // Dashboard Utama
    "utility/electricity": { table: "electricity_telemetry", column: "electricity_kwh", minuteTable: "electric_pln_telemetry_minute" },
    "utility/gas": { table: "gas_telemetry", column: "gas_sm3" },
    "utility/water": { table: "water_telemetry", column: "water_m3" },
    "utility/solar": { table: "solar_telemetry", column: "solar_kwh" }
  };

  const mapping = tagMappings[query.tagId];
  if (!mapping) {
    throw new Error(`Unsupported tag for Postgres: ${query.tagId}`);
  }

  const pool = getPostgresPool();
  const client = await pool.connect();
  try {
    const params: any[] = [];
    let queryText = `SELECT t_stamp AS ts, ${mapping.column}::float AS value FROM ${mapping.table} WHERE ${mapping.column} IS NOT NULL`;
    let paramIndex = 1;

    let fromStr: string | null = null;
    let toStr: string | null = null;

    if (query.from) {
      queryText += ` AND t_stamp >= $${paramIndex}`;
      const yr = query.from.getUTCFullYear();
      const mo = String(query.from.getUTCMonth() + 1).padStart(2, "0");
      const dy = String(query.from.getUTCDate()).padStart(2, "0");
      const hr = String(query.from.getUTCHours()).padStart(2, "0");
      const min = String(query.from.getUTCMinutes()).padStart(2, "0");
      const sec = String(query.from.getUTCSeconds()).padStart(2, "0");
      fromStr = `${yr}-${mo}-${dy} ${hr}:${min}:${sec}`;
      
      params.push(fromStr);
      paramIndex++;
    }
    if (query.to) {
      queryText += ` AND t_stamp <= $${paramIndex}`;
      const yr = query.to.getUTCFullYear();
      const mo = String(query.to.getUTCMonth() + 1).padStart(2, "0");
      const dy = String(query.to.getUTCDate()).padStart(2, "0");
      const hr = String(query.to.getUTCHours()).padStart(2, "0");
      const min = String(query.to.getUTCMinutes()).padStart(2, "0");
      const sec = String(query.to.getUTCSeconds()).padStart(2, "0");
      toStr = `${yr}-${mo}-${dy} ${hr}:${min}:${sec}`;

      params.push(toStr);
      paramIndex++;
    }

    queryText += ` ORDER BY t_stamp ASC LIMIT $${paramIndex}`;
    params.push(query.limit);

    const res = await client.query(queryText, params);
    const mainRows: { ts: Date; value: number }[] = res.rows.map(row => ({
      ts: row.ts instanceof Date ? row.ts : new Date(row.ts),
      value: Number(row.value)
    }));

    // Progressive real-time aggregation from minute table if available
    if (mapping.minuteTable) {
      try {
        const minParams: any[] = [];
        let minQuery = `
          SELECT 
            date_trunc('hour', t_stamp) AS ts,
            AVG(${mapping.column})::float AS value
          FROM ${mapping.minuteTable}
          WHERE ${mapping.column} IS NOT NULL
        `;
        let minParamIdx = 1;
        if (fromStr) {
          minQuery += ` AND t_stamp >= $${minParamIdx}`;
          minParams.push(fromStr);
          minParamIdx++;
        }
        if (toStr) {
          minQuery += ` AND t_stamp <= $${minParamIdx}`;
          minParams.push(toStr);
          minParamIdx++;
        }
        minQuery += ` GROUP BY date_trunc('hour', t_stamp) ORDER BY ts ASC`;

        const minRes = await client.query(minQuery, minParams);
        for (const r of minRes.rows) {
          const rDate = r.ts instanceof Date ? r.ts : new Date(r.ts);
          const existingIdx = mainRows.findIndex(
            (m) => m.ts.getTime() === rDate.getTime()
          );
          if (existingIdx === -1) {
            // Not in main table yet (e.g. current in-progress hour), append progressive average!
            mainRows.push({
              ts: rDate,
              value: Number(Number(r.value).toFixed(3))
            });
          }
        }
        // Sort merged rows chronologically
        mainRows.sort((a, b) => a.ts.getTime() - b.ts.getTime());
      } catch (minErr: any) {
        // If minute table query fails, fallback gracefully to main rows
      }
    }

    return mainRows.slice(0, query.limit).map(row => ({
      ts: row.ts,
      value: row.value,
      quality: "good",
      meta: {
        tagId: query.tagId
      }
    }));
  } finally {
    client.release();
  }
};

export const getHistorianRange = async (query: RangeQuery) => {
  const pgTags = [
    "cooling/return_temp",
    "utility/electricity",
    "utility/gas",
    "utility/water",
    "utility/solar",
    "chiller/daikin_wf1u3_temp",
    "cooling/flow",
    "cooling/tds",
    "cooling/ph",
    "cooling/humidity",
    "cooling-water/return_temp",
    "cooling-water/supply_temp",
    "cooling-water/st3_return_temp",
    "cooling-water/flow",
    "cooling-water/tds",
    "cooling-water/ph",
    "cooling-water/humidity",
    "cooling-water/ambient_temp",
    "cooling-water/makeup_vol",
    "cooling-water/makeup_tds",
    "cooling-water/blowdown_vol",
    "cooling-water/makeup_ph"
  ];

  if (pgTags.includes(query.tagId)) {
    try {
      return await getHistorianRangeFromPostgres(query);
    } catch (err) {
      console.warn("Postgres query failed, falling back to MongoDB:", err);
    }
  }

  const db = getMongoDb();
  const collection = db.collection(getHistorianCollectionName(query.resolution));

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
