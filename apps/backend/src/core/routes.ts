import { Express, Router } from "express";
import { alarmRouter } from "../modules/alarms";
import { analyticsRouter } from "../modules/analytics";
import { authRouter } from "../modules/auth";
import { devicesRouter } from "../modules/devices";
import { telemetryRouter } from "../modules/telemetry";
import { historianRouter } from "../modules/historian";
import { operationsRouter } from "../modules/operations";
import { reportsRouter } from "../modules/reports";
import { thresholdsRouter } from "../modules/thresholds";
import { usersRouter } from "../modules/users";
import { configRouter } from "../modules/config";
import { auditRouter } from "../modules/audit";
import { getMongoDb } from "../database/mongo";
import { getPostgresPool } from "../database/postgres";

export const registerRoutes = (app: Express) => {
  const router = Router();

  router.get("/health", async (_req, res) => {
    const mongoStatus: Record<string, any> = { connected: false };
    const pgStatus: Record<string, any> = { connected: false };
    
    try {
      const db = getMongoDb();
      await db.command({ ping: 1 });
      mongoStatus.connected = true;
    } catch (err: any) {
      mongoStatus.error = err.message;
    }
    
    try {
      const pool = getPostgresPool();
      const client = await pool.connect();
      pgStatus.connected = true;
      
      const pgRes = await client.query("SELECT COUNT(*)::int AS count FROM electricity_telemetry");
      pgStatus.recordCount = pgRes.rows[0]?.count ?? 0;
      
      const latestPg = await client.query("SELECT t_stamp, power_factor FROM electricity_telemetry ORDER BY t_stamp DESC LIMIT 1");
      pgStatus.latestRow = latestPg.rows[0] ?? null;
      
      client.release();
    } catch (err: any) {
      pgStatus.error = err.message;
    }
    
    res.json({
      status: mongoStatus.connected && pgStatus.connected ? "healthy" : "degraded",
      timestamp: new Date().toISOString(),
      postgresConfig: {
        host: process.env.POSTGRES_HOST || "localhost",
        port: process.env.POSTGRES_PORT || "5432",
        user: process.env.POSTGRES_USER || "test_user",
        database: process.env.POSTGRES_DB || "scada_test"
      },
      mongo: mongoStatus,
      postgres: pgStatus
    });
  });

  router.use(telemetryRouter);
  router.use(historianRouter);
  router.use(alarmRouter);
  router.use(devicesRouter);
  router.use(analyticsRouter);
  router.use(reportsRouter);
  router.use(operationsRouter);
  router.use(thresholdsRouter);
  router.use(authRouter);
  router.use(usersRouter);
  router.use(configRouter);
  router.use(auditRouter);

  app.use("/api/v1", router);
};
