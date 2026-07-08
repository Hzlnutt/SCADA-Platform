import { Request } from "express";
import { AUDIT_COLLECTION } from "../database/collections";
import { getMongoDb } from "../database/mongo";

export type AuditEntry = {
  actorId: string;
  action: string;
  resourceType?: string;
  resourceId?: string;
  meta?: Record<string, unknown>;
  ip?: string;
};

export const getClientIp = (req: Request): string => {
  const forwarded = req.headers["x-forwarded-for"];
  if (forwarded) {
    const ips = String(forwarded).split(",").map(ip => ip.trim());
    return ips[0];
  }
  return req.ip || req.socket.remoteAddress || "127.0.0.1";
};

export const recordAudit = async (entry: AuditEntry) => {
  const db = getMongoDb();
  const collection = db.collection(AUDIT_COLLECTION);

  await collection.insertOne({
    ...entry,
    ip: entry.ip || "127.0.0.1",
    ts: new Date()
  });
};
