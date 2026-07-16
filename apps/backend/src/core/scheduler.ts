import { env } from "../config/env.config";
import { logger } from "../config/logger.config";
import {
  rollupHistorianHour,
  rollupTelemetryMinute
} from "../modules/historian/historian.rollup";
import { getPostgresPool } from "../database/postgres";
import { getSocketServer, TELEMETRY_ALL_ROOM, telemetryTagRoom, updateTelemetryCache } from "../services/socket.manager";
import {
  fetchPowerFactor,
  setLatestPowerFactor
} from "../modules/analytics/electricity.analytics";


import { updateRunningHours } from "../modules/telemetry/running-hours.service";
import { ingestAlarmEvents } from "../modules/alarms/alarms.service";
import { publishAlarmEvents } from "../services/alarms.publisher";

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
          { tagId: "cooling-water/eq_press_washing", value: data.Scaled_Press_Washing, unit: "bar" },
          { tagId: "cooling-water/supply_temp", value: data.Scaled_Temp_Tank_Colling3_Supp, unit: "C" },
          { tagId: "cooling-water/return_temp", value: data.Scaled_Temp_Tank_Colling3_Return, unit: "C" },
          { tagId: "cooling-water/st3_return_temp", value: data.Scaled_Temp_ST3_Return, unit: "C" },
          { tagId: "cooling-water/eq_temp_du03", value: data.Scaled_Temp_DU, unit: "C" },
          { tagId: "cooling-water/eq_temp_prep03", value: data.Scaled_Tempt_Prep3_Return, unit: "C" },
          { tagId: "cooling-water/eq_temp_washing", value: data.Scaled_Temp_Washing, unit: "C" },
          { tagId: "cooling-water/eq_temp_st03_supply", value: data.Scaled_Temp_ST3_Supply, unit: "C" }
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

        // Update in-memory cache
        updateTelemetryCache(points);

        evaluateSensorRulesForPoints(points).catch((err) => {
          logger.error({ err }, "Failed to evaluate sensor rules for polled points");
        });

        // Update running hours
        const statusPoints = points.filter(p => p.meta.tagId.includes("status"));
        for (const p of statusPoints) {
          const isRunning = p.value === 1 || p.value === true;
          updateRunningHours(p.meta.tagId, isRunning, ts).catch((err) => {
            logger.error({ err, tagId: p.meta.tagId }, "Failed to update running hours from scheduler");
          });
        }

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

let waterPollingInterval: NodeJS.Timeout | null = null;
let lastWaterTs: Date | null = null;

export const startWaterPolling = () => {
  if (waterPollingInterval) return;

  const poll = async () => {
    try {
      const pool = getPostgresPool();
      const res = await pool.query("SELECT MAX(t_stamp) AS max_ts FROM water_telemetry;");
      const maxTs = res.rows[0]?.max_ts;

      if (maxTs) {
        const currentDateObj = new Date(maxTs);
        if (lastWaterTs === null) {
          lastWaterTs = currentDateObj;
        } else if (currentDateObj.getTime() !== lastWaterTs.getTime()) {
          lastWaterTs = currentDateObj;
          const io = getSocketServer();
          if (io) {
            io.emit("water:update");
            logger.info("Detected new water telemetry in Postgres, broadcasting water:update");
          }
        }
      } else if (lastWaterTs !== null) {
        lastWaterTs = null;
        const io = getSocketServer();
        if (io) {
          io.emit("water:update");
          logger.info("Detected water telemetry cleared in Postgres, broadcasting water:update");
        }
      }
    } catch (err) {
      logger.error({ err }, "Water Postgres polling failed");
    }
  };

  // Initial poll
  poll();
  // Poll every 5 seconds (water data comes in hourly, no need for faster)
  waterPollingInterval = setInterval(poll, 5000);
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
  startWaterPolling();

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
export const evaluateSensorRulesForPoints = async (points: any[]) => {
  const pool = getPostgresPool();
  try {
    const rulesRes = await pool.query(
      `SELECT unit_id, tag_key, tag_name, low_limit, baseline, high_limit, unit, enable_alert, suppress_alert, direction 
       FROM sensor_rules`
    );
    const rules = rulesRes.rows;

    const activeEvents: any[] = [];
    const clearEvents: any[] = [];

    for (const rule of rules) {
      if (!rule.enable_alert || rule.suppress_alert) continue;

      const point = points.find(p => p.meta.tagId === rule.tag_key);
      if (!point || typeof point.value !== "number") continue;

      const value = point.value;
      const warning = rule.baseline ? parseFloat(rule.baseline) : null;
      const alarm = rule.high_limit ? parseFloat(rule.high_limit) : null;
      const direction = rule.direction || "above";

      let status: "active" | "cleared" = "cleared";
      let severity: "medium" | "high" = "medium";
      let msg = "";

      if (direction === "above") {
        if (alarm !== null && value >= alarm) {
          status = "active";
          severity = "high";
          msg = `[${rule.tag_name}] exceeds Alarm Limit of ${alarm} ${rule.unit || ""} (Current: ${value.toFixed(1)} ${rule.unit || ""})`;
        } else if (warning !== null && value >= warning) {
          status = "active";
          severity = "medium";
          msg = `[${rule.tag_name}] exceeds Warning Limit of ${warning} ${rule.unit || ""} (Current: ${value.toFixed(1)} ${rule.unit || ""})`;
        }
      } else {
        if (alarm !== null && value <= alarm) {
          status = "active";
          severity = "high";
          msg = `[${rule.tag_name}] is below Alarm Limit of ${alarm} ${rule.unit || ""} (Current: ${value.toFixed(1)} ${rule.unit || ""})`;
        } else if (warning !== null && value <= warning) {
          status = "active";
          severity = "medium";
          msg = `[${rule.tag_name}] is below Warning Limit of ${warning} ${rule.unit || ""} (Current: ${value.toFixed(1)} ${rule.unit || ""})`;
        }
      }

      const alarmKey = `pid-threshold:${rule.tag_key}`;

      if (status === "active") {
        activeEvents.push({
          alarmKey,
          tagId: rule.tag_key,
          deviceId: point.meta.deviceId || "plc-sim",
          unit: rule.unit_id,
          area: point.meta.area || "Utilities",
          message: msg,
          severity,
          status: "active"
        });
      } else {
        clearEvents.push({
          alarmKey,
          tagId: rule.tag_key,
          deviceId: point.meta.deviceId || "plc-sim",
          unit: rule.unit_id,
          area: point.meta.area || "Utilities",
          message: `Cleared: Telemetry parameter for tag ${rule.tag_key} has returned to normal range.`,
          severity: "low",
          status: "cleared"
        });
      }
    }

    if (activeEvents.length > 0) {
      const res = await ingestAlarmEvents(activeEvents);
      publishAlarmEvents(res.events);
    }
    if (clearEvents.length > 0) {
      const res = await ingestAlarmEvents(clearEvents);
      publishAlarmEvents(res.events);
    }
  } catch (err) {
    logger.error({ err }, "Failed to evaluate sensor rules for points");
  }
};
