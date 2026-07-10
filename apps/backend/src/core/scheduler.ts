import { env } from "../config/env.config";
import { logger } from "../config/logger.config";
import {
  rollupHistorianHour,
  rollupTelemetryMinute
} from "../modules/historian/historian.rollup";
import { getPostgresPool } from "../database/postgres";
import { getSocketServer, TELEMETRY_ALL_ROOM, telemetryTagRoom } from "../services/socket.manager";
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

let coolingPollingInterval: NodeJS.Timeout | null = null;

export const startCoolingTowerPolling = () => {
  if (coolingPollingInterval) return;

  const poll = async () => {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);

      const res = await fetch("http://10.3.164.3:8088/system/webdev/Utility_Dashboard/cooling3", {
        headers: { "Cache-Control": "no-cache", "Pragma": "no-cache" },
        signal: controller.signal
      });
      clearTimeout(timeoutId);

      if (res.ok) {
        const data: any = await res.json();
        const ts = new Date();
        const io = getSocketServer();

        // Map API fields to telemetry tag points (no database insertion)
        const points = [
          { tagId: "cooling-water/fan_status_1", value: data.Status_Fan_CT1 ? 1 : 0, unit: "status" },
          { tagId: "cooling-water/fan_status_2", value: data.Status_Fan_CT2 ? 1 : 0, unit: "status" },
          { tagId: "cooling-water/fan_status_3", value: data.Status_Fan_CT3 ? 1 : 0, unit: "status" },
          { tagId: "cooling-water/motor_status_1", value: data.Status_MTR_CT_P1 ? 1 : 0, unit: "status" },
          { tagId: "cooling-water/motor_status_2", value: data.Status_MTR_CT_P2 ? 1 : 0, unit: "status" },
          { tagId: "cooling-water/motor_status_3", value: data.Status_MTR_CT_P11 ? 1 : 0, unit: "status" },
          { tagId: "cooling-water/pressure_1", value: data.Scaled_Press_CT_P1, unit: "bar" },
          { tagId: "cooling-water/pressure_2", value: data.Scaled_Press_CT_P2, unit: "bar" },
          { tagId: "cooling-water/pressure_3", value: data.Scaled_Press_CT3_P11, unit: "bar" },
          { tagId: "cooling-water/basin_lvl", value: data.Scaled_Level_tank_cooling3, unit: "%" },
          { tagId: "cooling-water/eq_status_du03", value: data.Status_MTR_DU45 ? 1 : 0, unit: "status" },
          { tagId: "cooling-water/eq_press_du03", value: data.Scaled_Press_DUU3, unit: "bar" },
          { tagId: "cooling-water/eq_status_bp03", value: data.Status_MTR_BP ? 1 : 0, unit: "status" },
          { tagId: "cooling-water/eq_press_bp03", value: data.Scaled_Press_BP, unit: "bar" },
          { tagId: "cooling-water/eq_status_prep03", value: data.Status_MTR_Prep3 ? 1 : 0, unit: "status" },
          { tagId: "cooling-water/eq_press_prep03", value: data.Scaled_Press_PrepU3, unit: "bar" },
          { tagId: "cooling-water/eq_status_st03", value: data.Status_MTR_ST3_P3 ? 1 : 0, unit: "status" },
          { tagId: "cooling-water/eq_press_st03", value: data.Scaled_Press_ST3, unit: "bar" },
          { tagId: "cooling-water/eq_status_washing", value: data.Status_MTR_Washing ? 1 : 0, unit: "status" },
          { tagId: "cooling-water/eq_press_washing", value: data.Scaled_Press_Washing, unit: "bar" }
        ].map((p) => ({
          ts: ts.toISOString(),
          value: p.value,
          quality: "good" as const,
          meta: {
            tagId: p.tagId,
            deviceId: "cooling-water-1",
            unit: p.unit,
            area: "Utilities",
            source: "ignition-api"
          }
        }));

        // Emit directly via WebSocket (no database, instant real-time)
        if (io) {
          io.to(TELEMETRY_ALL_ROOM).emit("telemetry:update", { points });
          points.forEach((point) => {
            io.to(telemetryTagRoom(point.meta.tagId)).emit("telemetry:update", { points: [point] });
          });

          // Also emit raw API data for any component that wants the full payload
          io.emit("cooling_tower:update", {
            deviceId: "cooling-water-1",
            ts: ts.toISOString(),
            status: "connected",
            raw: data
          });
        }

        logger.info("Cooling tower WF1-U3 API polled and emitted via WebSocket (no DB)");
      } else {
        const io = getSocketServer();
        if (io) {
          io.emit("cooling_tower:update", {
            deviceId: "cooling-water-1",
            ts: new Date().toISOString(),
            status: "offline",
            raw: null
          });
        }
        logger.warn(`Cooling tower API returned status: ${res.status}`);
      }
    } catch (err: any) {
      const io = getSocketServer();
      if (io) {
        io.emit("cooling_tower:update", {
          deviceId: "cooling-water-1",
          ts: new Date().toISOString(),
          status: "offline",
          raw: null
        });
      }
      logger.error({ err }, "Cooling tower API polling failed");
    }
  };

  // Initial poll
  poll();
  // Poll every 3 seconds for real-time SCADA updates
  coolingPollingInterval = setInterval(poll, 3000);
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
  startCoolingTowerPolling();

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
