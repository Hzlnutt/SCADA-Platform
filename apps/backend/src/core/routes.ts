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

export const registerRoutes = (app: Express) => {
  const router = Router();

  router.get("/health", (_req, res) => {
    res.json({ status: "ok", ts: Date.now() });
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

  app.use("/api/v1", router);
};
