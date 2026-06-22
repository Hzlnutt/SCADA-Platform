import { ObjectId } from "mongodb";
import { getMongoDb } from "../../database/mongo";
import { THRESHOLDS_COLLECTION } from "../../database/collections";
import type { ThresholdPatchInput, ThresholdUpsertInput } from "./thresholds.validation";

export type ThresholdDoc = {
  _id: ObjectId;
  groupId: string;
  groupName: string;
  metric: string;
  unit: string;
  tagIds: string[];
  lower?: number | null;
  upper?: number | null;
  warningPct: number;
  actionText?: string;
  createdAt: Date;
  updatedAt: Date;
};

const createError = (message: string, statusCode: number) => {
  const error = new Error(message) as Error & { statusCode?: number };
  error.statusCode = statusCode;
  return error;
};

const toThresholdResponse = (doc: ThresholdDoc) => ({
  id: doc._id.toString(),
  groupId: doc.groupId,
  groupName: doc.groupName,
  metric: doc.metric,
  unit: doc.unit,
  tagIds: doc.tagIds,
  lower: doc.lower ?? null,
  upper: doc.upper ?? null,
  warningPct: doc.warningPct,
  actionText: doc.actionText ?? null,
  updatedAt: doc.updatedAt.toISOString()
});

export const listThresholds = async () => {
  const db = getMongoDb();
  const collection = db.collection<ThresholdDoc>(THRESHOLDS_COLLECTION);
  const docs = await collection.find({}).sort({ groupName: 1 }).toArray();
  return docs.map(toThresholdResponse);
};

export const getThresholdByGroup = async (groupId: string) => {
  const db = getMongoDb();
  const collection = db.collection<ThresholdDoc>(THRESHOLDS_COLLECTION);
  const doc = await collection.findOne({ groupId });
  return doc ? toThresholdResponse(doc) : null;
};

export const findThresholdByTag = async (tagId: string) => {
  const db = getMongoDb();
  const collection = db.collection<ThresholdDoc>(THRESHOLDS_COLLECTION);
  return collection.findOne({ tagIds: tagId });
};

export const upsertThreshold = async (
  groupId: string,
  input: ThresholdUpsertInput | ThresholdPatchInput
) => {
  const db = getMongoDb();
  const collection = db.collection<ThresholdDoc>(THRESHOLDS_COLLECTION);
  const now = new Date();

  const update = {
    groupId,
    groupName: input.groupName ?? groupId,
    metric: input.metric ?? "kwh",
    unit: input.unit ?? "kWh",
    tagIds: input.tagIds ?? [],
    lower: input.lower ?? null,
    upper: input.upper ?? null,
    warningPct: input.warningPct ?? 0.9,
    actionText: input.actionText,
    updatedAt: now
  };

  if (!update.tagIds || update.tagIds.length === 0) {
    throw createError("tagIds required", 400);
  }

  const result = await collection.findOneAndUpdate(
    { groupId },
    {
      $set: update,
      $setOnInsert: { _id: new ObjectId(), createdAt: now }
    },
    { upsert: true, returnDocument: "after" }
  );

  if (!result) {
    throw createError("Threshold not saved", 500);
  }

  return toThresholdResponse(result);
};
