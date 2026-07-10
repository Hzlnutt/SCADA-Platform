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
import { ingestTelemetry } from "../modules/telemetry/telemetry.service";
import { publishTelemetry } from "../services/telemetry.publisher";

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
      const res = await fetch("http://10.3.164.3:8088/system/webdev/Utility_Dashboard/cooling3");
      if (res.ok) {
        const data: any = await res.json();
        const ts = new Date();
        const pool = getPostgresPool();

        // 1. Insert into PostgreSQL
        await pool.query(`
          INSERT INTO cooling_tower_telemetry (
            t_stamp, id_device, press_ct_p1, status_mtr_washing, status_fan_ct2, status_fan_ct3, status_mtr_st3_p3,
            press_ct_p2, scaled_press_prepu3, scaled_press_ct_p1, scaled_press_ct_p2, status_fan_ct1, status_mtr_du45,
            scaled_press_st3, press_ct3_p11, scaled_press_ct3_p11, status_mtr_ct_p1, status_mtr_ct_p2, scaled_press_bp,
            status_mtr_prep3, scaled_press_washing, status_mtr_ct_p11, scaled_press_duu3, scaled_level_tank_cooling3,
            status_mtr_bp
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25)
        `, [
          ts, "cooling-water-1",
          data.Press_CT_P1, data.Status_MTR_Washing, data.Status_Fan_CT2, data.Status_Fan_CT3, data.Status_MTR_ST3_P3,
          data.Press_CT_P2, data.Scaled_Press_PrepU3, data.Scaled_Press_CT_P1, data.Scaled_Press_CT_P2, data.Status_Fan_CT1, data.Status_MTR_DU45,
          data.Scaled_Press_ST3, data.Press_CT3_P11, data.Scaled_Press_CT3_P11, data.Status_MTR_CT_P1, data.Status_MTR_CT_P2, data.Scaled_Press_BP,
          data.Status_MTR_Prep3, data.Scaled_Press_Washing, data.Status_MTR_CT_P11, data.Scaled_Press_DUU3, data.Scaled_Level_tank_cooling3,
          data.Status_MTR_BP
        ]);

        // 2. Map and Ingest into MongoDB for WebSocket/Analytics
        const points = [
          { tagId: "cooling-water/fan_status_1", value: data.Status_Fan_CT1 ? 1 : 0 },
          { tagId: "cooling-water/fan_status_2", value: data.Status_Fan_CT2 ? 1 : 0 },
          { tagId: "cooling-water/fan_status_3", value: data.Status_Fan_CT3 ? 1 : 0 },
          { tagId: "cooling-water/motor_status_1", value: data.Status_MTR_CT_P1 ? 1 : 0 },
          { tagId: "cooling-water/motor_status_2", value: data.Status_MTR_CT_P2 ? 1 : 0 },
          { tagId: "cooling-water/motor_status_3", value: data.Status_MTR_CT_P11 ? 1 : 0 },
          { tagId: "cooling-water/pressure_1", value: data.Scaled_Press_CT_P1 },
          { tagId: "cooling-water/pressure_2", value: data.Scaled_Press_CT_P2 },
          { tagId: "cooling-water/pressure_3", value: data.Scaled_Press_CT3_P11 },
          { tagId: "cooling-water/basin_lvl", value: data.Scaled_Level_tank_cooling3 },
          { tagId: "cooling-water/eq_status_du03", value: data.Status_MTR_DU45 ? 1 : 0 },
          { tagId: "cooling-water/eq_press_du03", value: data.Scaled_Press_DUU3 },
          { tagId: "cooling-water/eq_status_bp03", value: data.Status_MTR_BP ? 1 : 0 },
          { tagId: "cooling-water/eq_press_bp03", value: data.Scaled_Press_BP },
          { tagId: "cooling-water/eq_status_prep03", value: data.Status_MTR_Prep3 ? 1 : 0 },
          { tagId: "cooling-water/eq_press_prep03", value: data.Scaled_Press_PrepU3 },
          { tagId: "cooling-water/eq_status_st03", value: data.Status_MTR_ST3_P3 ? 1 : 0 },
          { tagId: "cooling-water/eq_press_st03", value: data.Scaled_Press_ST3 },
          { tagId: "cooling-water/eq_status_washing", value: data.Status_MTR_Washing ? 1 : 0 },
          { tagId: "cooling-water/eq_press_washing", value: data.Scaled_Press_Washing }
        ].map((p) => ({
          tagId: p.tagId,
          deviceId: "plc-sim",
          unit: p.tagId.includes("status") ? "status" : p.tagId.includes("lvl") ? "%" : "bar",
          area: "Utilities",
          value: p.value,
          quality: "good" as const,
          ts
        }));

        const ingestResult = await ingestTelemetry(points);
        publishTelemetry(ingestResult.docs);
        logger.info("Successfully fetched cooling tower WF1-U3 API, inserted into PostgreSQL, and ingested to MongoDB");
      }
    } catch (err: any) {
      logger.error({ err }, "Cooling tower API polling failed");
    }
  };

  // Initial poll
  poll();
  // Poll every 5 seconds for real-time SCADA updates
  coolingPollingInterval = setInterval(poll, 5000);
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
