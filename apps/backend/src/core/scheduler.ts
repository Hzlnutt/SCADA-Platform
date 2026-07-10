import { env } from "../config/env.config";
import { logger } from "../config/logger.config";
import {
  rollupHistorianHour,
  rollupTelemetryMinute
} from "../modules/historian/historian.rollup";
import { getPostgresPool } from "../database/postgres";
import { getSocketServer } from "../services/socket.manager";
import {
  fetchPowerFactor,
  setLatestPowerFactor
} from "../modules/analytics/electricity.analytics";

let lastElectricityTs: Date | null = null;
let pollingInterval: NodeJS.Timeout | null = null;
let pfPollingInterval: NodeJS.Timeout | null = null;

export const startPostgresPolling = () => {
  if (pollingInterval) return;

  const poll = async () => {
    try {
      const pool = getPostgresPool();
      const res = await pool.query("SELECT MAX(t_stamp) AS max_ts FROM electricity_telemetry;");
      const maxTs = res.rows[0]?.max_ts;
      
      if (maxTs) {
        const currentDateObj = new Date(maxTs);
        if (lastElectricityTs === null) {
          lastElectricityTs = currentDateObj;
        } else if (currentDateObj.getTime() !== lastElectricityTs.getTime()) {
          lastElectricityTs = currentDateObj;
          const io = getSocketServer();
          if (io) {
            io.emit("electricity:update");
            logger.info("Detected new electricity telemetry in Postgres, broadcasting electricity:update");
          }
        }
      } else if (lastElectricityTs !== null) {
        // Handle database cleared
        lastElectricityTs = null;
        const io = getSocketServer();
        if (io) {
          io.emit("electricity:update");
          logger.info("Detected electricity telemetry cleared in Postgres, broadcasting electricity:update");
        }
      }
    } catch (err) {
      logger.error({ err }, "Postgres polling failed");
    }
  };

  // Initial poll
  poll();
  // Poll every 1 second
  pollingInterval = setInterval(poll, 1000);
};

export const startPowerFactorPolling = () => {
  if (pfPollingInterval) return;

  const poll = async () => {
    try {
      const val = await fetchPowerFactor();
      const io = getSocketServer();
      
      if (val !== null) {
        setLatestPowerFactor(val, "connected");
        if (io) {
          io.emit("power_factor:status", { value: val, status: "connected" });
        }
        logger.info({ value: val }, "Power factor API online");
      } else {
        setLatestPowerFactor(null, "offline");
        if (io) {
          io.emit("power_factor:status", { value: null, status: "offline" });
        }
        logger.warn("Power factor API offline");
      }
    } catch (err: any) {
      setLatestPowerFactor(null, "offline");
      const io = getSocketServer();
      if (io) {
        io.emit("power_factor:status", { value: null, status: "offline" });
      }
      logger.error({ err }, "Power factor polling failed");
    }
  };

  // Initial poll
  poll();
  // Poll every 2 seconds for real-time responsiveness
  pfPollingInterval = setInterval(poll, 2000);
};

export const startScheduler = () => {
  const minuteIntervalMs = env.rollupIntervalMs;
  const hourlyIntervalMs = env.rollupHourlyIntervalMs;

  rollupTelemetryMinute().catch((err) => {
    logger.error({ err }, "minute rollup failed");
  });

  rollupHistorianHour().catch((err) => {
    logger.error({ err }, "hourly rollup failed");
  });

  startPostgresPolling();
  startPowerFactorPolling();

  setInterval(() => {
    rollupTelemetryMinute().catch((err) => {
      logger.error({ err }, "minute rollup failed");
    });
  }, minuteIntervalMs);

  setInterval(() => {
    rollupHistorianHour().catch((err) => {
      logger.error({ err }, "hourly rollup failed");
    });
  }, hourlyIntervalMs);

  logger.info({ minuteIntervalMs, hourlyIntervalMs }, "scheduler started");
};
