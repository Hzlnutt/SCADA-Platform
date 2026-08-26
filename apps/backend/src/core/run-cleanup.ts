import dotenv from "dotenv";
import path from "path";

// Load dotenv from apps/backend/.env
dotenv.config({ path: path.join(__dirname, "../../.env") });

import { runCoolingTowerRollupAndCleanup, runElectricityRollupAndCleanup } from "./scheduler";
import { closePostgres, ensurePostgresTables } from "../database/postgres";

async function main() {
  console.log("Starting manual rollup and cleanup...");
  try {
    await ensurePostgresTables();
    await runElectricityRollupAndCleanup();
    await runCoolingTowerRollupAndCleanup();
    console.log("Cleanup and Rollup executed successfully!");
  } catch (err: any) {
    console.error("Cleanup failed:", err);
  } finally {
    await closePostgres();
    process.exit(0);
  }
}

main();
