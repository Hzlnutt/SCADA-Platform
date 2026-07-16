import { MongoClient } from "mongodb";
import { Client } from "pg";
import * as dotenv from "dotenv";
import * as path from "path";

// Load .env
dotenv.config({ path: path.join(__dirname, "../.env") });

async function run() {
  const mongoUri = process.env.MONGODB_URI || "mongodb://localhost:27017/scada";
  const pgHost = process.env.POSTGRES_HOST || "10.3.141.21";
  const pgPort = parseInt(process.env.POSTGRES_PORT || "5432", 10);
  const pgUser = process.env.POSTGRES_USER || "test_user";
  const pgPassword = process.env.POSTGRES_PASSWORD || "Pandaan1";
  const pgDb = process.env.POSTGRES_DB || "scada_test";

  console.log("Starting clean-rules script...");

  // 1. Clean MongoDB
  try {
    const mongoClient = new MongoClient(mongoUri);
    await mongoClient.connect();
    console.log("Connected to MongoDB");
    
    const db = mongoClient.db(process.env.MONGODB_DB || "scada");
    const result = await db.collection("global_configs").deleteOne({ key: "rh_task_rules" });
    console.log(`MongoDB: Deleted key "rh_task_rules" (${result.deletedCount} documents deleted)`);
    
    await mongoClient.close();
  } catch (err) {
    console.error("Failed to clean MongoDB:", err);
  }

  // 2. Clean PostgreSQL
  try {
    const pgClient = new Client({
      host: pgHost,
      port: pgPort,
      user: pgUser,
      password: pgPassword,
      database: pgDb
    });
    await pgClient.connect();
    console.log("Connected to PostgreSQL");

    const result = await pgClient.query("DELETE FROM global_configs WHERE key = $1", ["rh_task_rules"]);
    console.log(`PostgreSQL: Deleted key "rh_task_rules" (${result.rowCount} rows affected)`);

    await pgClient.end();
  } catch (err) {
    console.error("Failed to clean PostgreSQL:", err);
  }

  console.log("Database cleanup finished successfully.");
}

run();
