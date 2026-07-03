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
  const pool = getPostgresPool();
  const client = await pool.connect();
  try {
    const params: any[] = [query.tagId];
    let queryText = `SELECT ts, tag_value::float AS value FROM test_telemetry WHERE tag_name = $1`;
    let paramIndex = 2;

    if (query.from) {
      queryText += ` AND ts >= $${paramIndex}`;
      params.push(query.from);
      paramIndex++;
    }
    if (query.to) {
      queryText += ` AND ts <= $${paramIndex}`;
      params.push(query.to);
      paramIndex++;
    }

    queryText += ` ORDER BY ts ASC LIMIT $${paramIndex}`;
    params.push(query.limit);

    const res = await client.query(queryText, params);
    return res.rows.map(row => ({
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
    "cooling/humidity"
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
