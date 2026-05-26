import { getMongoDb } from "../../database/mongo";
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

export const getHistorianRange = async (query: RangeQuery) => {
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
