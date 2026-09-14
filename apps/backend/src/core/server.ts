import { createServer } from "http";
import { env } from "../config/env.config";
import { logger } from "../config/logger.config";
import { ensureMongoCollections } from "../database/setup";
import { ensurePostgresTables } from "../database/postgres";
import { createApp } from "./app";
import { startScheduler } from "./scheduler";
import { createSocketServer } from "./socket";
import { startDummyGenerator } from "../services/dummy.generator";

const app = createApp();
const httpServer = createServer(app);

createSocketServer(httpServer);

const start = async () => {
  await ensureMongoCollections();
  await ensurePostgresTables();
  startScheduler();
  if (env.dummyMode) {
    startDummyGenerator();
  }

  httpServer.listen(env.port, "0.0.0.0", () => {
    logger.info({ port: env.port, host: "0.0.0.0" }, "backend listening");
  });
};

start().catch((err) => {
  logger.error({ err }, "backend startup failed");
  process.exit(1);
});
