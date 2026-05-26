import { Db, MongoClient } from "mongodb";
import { env } from "../config/env.config";
import { logger } from "../config/logger.config";

let client: MongoClient | null = null;
let db: Db | null = null;

export const connectMongo = async () => {
  if (client && db) {
    return db;
  }

  client = new MongoClient(env.mongoUri, {
    maxPoolSize: 20
  });

  await client.connect();
  db = client.db(env.mongoDb);

  logger.info({ db: env.mongoDb }, "mongo connected");

  return db;
};

export const getMongoDb = () => {
  if (!db) {
    throw new Error("Mongo not connected");
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
