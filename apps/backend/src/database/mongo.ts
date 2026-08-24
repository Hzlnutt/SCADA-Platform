import { Db, MongoClient } from "mongodb";
import { env } from "../config/env.config";
import { logger } from "../config/logger.config";

let client: MongoClient | null = null;
let db: Db | null = null;

export const connectMongo = async () => {
  if (client && db) {
    return db;
  }

  try {
    client = new MongoClient(env.mongoUri, {
      maxPoolSize: 20,
      serverSelectionTimeoutMS: 2000
    });

    await client.connect();
    db = client.db(env.mongoDb);

    logger.info({ db: env.mongoDb }, "mongo connected");

    return db;
  } catch (err: any) {
    logger.warn(`Mongo connection failed (operating in PostgreSQL-only mode): ${err.message}`);
    return null;
  }
};

export const getMongoDb = (): Db => {
  if (!db) {
    logger.debug("Mongo not connected, requested getMongoDb");
    return {} as unknown as Db;
  }

  return db;
};

export const closeMongo = async () => {
  if (!client) {
    return;
  }

  await client.close();
  client = null;
  db = null;
};
