import { createServer } from "http";
import { env } from "../config/env.config";
import { logger } from "../config/logger.config";
import { ensureMongoCollections } from "../database/setup";
import { createApp } from "./app";
import { startScheduler } from "./scheduler";
import { createSocketServer } from "./socket";
import { startDummyGenerator } from "../services/dummy.generator";

const app = createApp();
const httpServer = createServer(app);

createSocketServer(httpServer);

const start = async () => {
  await ensureMongoCollections();
  startScheduler();
  if (env.dummyMode) {
    startDummyGenerator();
  }

  httpServer.listen(env.port, () => {
    logger.info({ port: env.port }, "backend listening");
  });
};

start().catch((err) => {
  logger.error({ err }, "backend startup failed");
  process.exit(1);
});
