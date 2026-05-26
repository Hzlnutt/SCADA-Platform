import { getMongoDb } from "../../database/mongo";
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
