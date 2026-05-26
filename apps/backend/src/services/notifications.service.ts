import nodemailer from "nodemailer";
import { ObjectId } from "mongodb";
import { env } from "../config/env.config";
import { logger } from "../config/logger.config";
import { NOTIFICATIONS_COLLECTION } from "../database/collections";
import { getMongoDb } from "../database/mongo";

export type NotificationDoc = {
  _id: ObjectId;
  to: string[];
  subject: string;
  body: string;
  severity: "warning" | "breach";
  status: "queued" | "sent" | "error";
  error?: string;
  createdAt: Date;
  updatedAt: Date;
};

type QueueInput = {
  to: string[];
  subject: string;
  body: string;
  severity: "warning" | "breach";
};

const buildTransport = () => {
  if (!env.smtpHost || !env.smtpFrom) {
    return null;
  }

  return nodemailer.createTransport({
    host: env.smtpHost,
    port: env.smtpPort,
    secure: env.smtpPort === 465,
    auth: env.smtpUser && env.smtpPass
      ? { user: env.smtpUser, pass: env.smtpPass }
      : undefined
  });
};

export const queueEmail = async (input: QueueInput) => {
  const db = getMongoDb();
  const collection = db.collection<NotificationDoc>(NOTIFICATIONS_COLLECTION);
  const now = new Date();
  const doc: NotificationDoc = {
    _id: new ObjectId(),
    to: input.to,
    subject: input.subject,
    body: input.body,
    severity: input.severity,
    status: "queued",
    createdAt: now,
    updatedAt: now
  };

  await collection.insertOne(doc);

  const transport = buildTransport();
  if (!transport) {
    logger.warn("SMTP not configured, email queued only");
    return doc;
  }

  try {
    await transport.sendMail({
      from: env.smtpFrom,
      to: input.to.join(","),
      subject: input.subject,
      text: input.body
    });

    await collection.updateOne(
      { _id: doc._id },
      { $set: { status: "sent", updatedAt: new Date() } }
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await collection.updateOne(
      { _id: doc._id },
      { $set: { status: "error", error: message, updatedAt: new Date() } }
    );
    logger.error({ err: error }, "Failed to send email notification");
  }

  return doc;
};
