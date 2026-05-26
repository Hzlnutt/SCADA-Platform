import { AUDIT_COLLECTION } from "../database/collections";
import { getMongoDb } from "../database/mongo";

type AuditEntry = {
  actorId: string;
  action: string;
  resourceType?: string;
  resourceId?: string;
  meta?: Record<string, unknown>;
};

export const recordAudit = async (entry: AuditEntry) => {
  const db = getMongoDb();
  const collection = db.collection(AUDIT_COLLECTION);

  await collection.insertOne({
    ...entry,
    ts: new Date()
  });
};
