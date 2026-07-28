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
import { ingestTelemetry } from "../modules/telemetry/telemetry.service";
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
const DEFAULT_TAG_KEY_TO_API_JSON_KEY: Record<string, string> = {
  "cooling-water/supply_temp": "Scaled_Temp_Tank_Colling3_Supp",
  "cooling-water/return_temp": "Scaled_Temp_Tank_Colling3_Return",
  "cooling-water/st3_return_temp": "Scaled_Temp_ST3_Return",
  "cooling-water/eq_temp_st03_supply": "Scaled_Temp_ST3_Supply",
  "cooling-water/eq_press_du03": "Scaled_Press_DUU3",
  "cooling-water/eq_press_bp03": "Scaled_Press_BP",
  "cooling-water/eq_press_prep03": "Scaled_Press_PrepU3",
  "cooling-water/eq_press_st03": "Scaled_Press_ST3",
  "cooling-water/eq_press_washing": "Scaled_Press_Washing",
  "cooling-water/eq_temp_du03": "Scaled_Temp_DU",
  "cooling-water/eq_temp_prep03": "Scaled_Tempt_Prep3_Return",
  "cooling-water/eq_temp_washing": "Scaled_Temp_Washing",
  "cooling-water/basin_lvl": "Scaled_Level_tank_cooling3",
  "cooling-water/fan_status_1": "Status_Fan_C11",
  "cooling-water/fan_status_2": "Status_Fan_CT2",
  "cooling-water/fan_status_3": "Status_Fan_CT3",
  "cooling-water/motor_status_1": "Status_MTR_CT_P1",
  "cooling-water/motor_status_2": "Status_MTR_CT_P2",
  "cooling-water/motor_status_3": "Status_MTR_CT_P11",
  "cooling-water/eq_status_du03": "Status_MTR_DU45",
  "cooling-water/eq_status_bp03": "Status_MTR_BP",
  "cooling-water/eq_status_prep03": "Status_MTR_Prep3",
  "cooling-water/eq_status_st03": "Status_MTR_ST3_P3",
  "cooling-water/eq_status_washing": "Status_MTR_Washing",
  "cooling-water/st3_heating": "Status_Machine_Heating_ST3",
  "cooling-water/st3_cooling": "Status_Machine_Cooling_ST3",
  "cooling-water/st3_steril": "Status_Machine_Steril_ST3",
  "cooling-water/jumo_pieces": "Jumo Pieces",
  "cooling-water/pressure_1": "Scaled_Press_CT_P1",
  "cooling-water/pressure_2": "Scaled_Press_CT_P2",
  "cooling-water/pressure_3": "Scaled_Press_CT3_P11"
};

export const startCoolingTowerPolling = () => {
  if (coolingPollingInterval) return;

  const poll = async () => {
    try {
      const pool = getPostgresPool();
      
      // Load custom URL and jsonKey configs
      let targetUrl = "http://10.3.161.3:8088/system/webdev/Utility_Dashboard/cooling3";
      let jsonKeyMap: Record<string, string> = {};

      try {
        const mapRes = await pool.query("SELECT value FROM global_configs WHERE key = $1", ["api_sources_map_cooling-water-1"]);
        if (mapRes.rows.length > 0) {
          const map = mapRes.rows[0].value;
          const firstConfiguredUrl = Object.values(map).find((u: any) => typeof u === "string" && u.trim());
          if (firstConfiguredUrl) {
            let url = firstConfiguredUrl as string;
            url = url.replace("10.3.164.3", "10.3.161.3").replace(":9080", ":8088");
            targetUrl = url;
          }
        }
      } catch (e) {
        logger.warn("Failed to load custom API sources map from global_configs, using default URL");
      }

      try {
        const listRes = await pool.query("SELECT value FROM global_configs WHERE key = $1", ["api_sources_list_cooling-water-1"]);
        if (listRes.rows.length > 0) {
          const list = listRes.rows[0].value;
          if (Array.isArray(list)) {
            list.forEach((row: any) => {
              if (row.tagKey && row.jsonKey) {
                let jk = row.jsonKey;
                if (jk === "Scaled_Temp_Tank_Cooling3_Supp") jk = "Scaled_Temp_Tank_Colling3_Supp";
                if (jk === "Scaled_Temp_Tank_Cooling3_Return") jk = "Scaled_Temp_Tank_Colling3_Return";
                jsonKeyMap[row.tagKey] = jk;
              }
            });
          }
        }
      } catch (e) {
        logger.warn("Failed to load custom API sources list from global_configs");
      }

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);

      const res = await fetch(targetUrl, {
        headers: { "Cache-Control": "no-cache", "Pragma": "no-cache" },
        signal: controller.signal
      });
      clearTimeout(timeoutId);

      if (res.ok) {
        const data: any = await res.json();
        const ts = new Date();
        const io = getSocketServer();

        const getVal = (tagId: string): any => {
          const customKey = jsonKeyMap[tagId];
          const standardKey = DEFAULT_TAG_KEY_TO_API_JSON_KEY[tagId];
          let val = undefined;
          if (customKey) {
            val = data[customKey];
          }
          if (val === undefined && standardKey) {
            val = data[standardKey];
          }
          return val;
        };

        const retVal = getVal("cooling-water/return_temp");
        const suppVal = getVal("cooling-water/supply_temp");
        const deltaVal = (typeof retVal === "number" && typeof suppVal === "number")
          ? Number((retVal - suppVal).toFixed(2))
          : undefined;

        // Map API fields to telemetry tag points
        const pointsMapping = [
          { tagId: "cooling-water/fan_status_1", value: getVal("cooling-water/fan_status_1") ? 1 : 0, unit: "status" },
          { tagId: "cooling-water/fan_status_2", value: getVal("cooling-water/fan_status_2") ? 1 : 0, unit: "status" },
          { tagId: "cooling-water/fan_status_3", value: getVal("cooling-water/fan_status_3") ? 1 : 0, unit: "status" },
          { tagId: "cooling-water/motor_status_1", value: getVal("cooling-water/motor_status_1") ? 1 : 0, unit: "status" },
          { tagId: "cooling-water/motor_status_2", value: getVal("cooling-water/motor_status_2") ? 1 : 0, unit: "status" },
          { tagId: "cooling-water/motor_status_3", value: getVal("cooling-water/motor_status_3") ? 1 : 0, unit: "status" },
          { tagId: "cooling-water/pressure_1", value: getVal("cooling-water/pressure_1"), unit: "bar" },
          { tagId: "cooling-water/pressure_2", value: getVal("cooling-water/pressure_2"), unit: "bar" },
          { tagId: "cooling-water/pressure_3", value: getVal("cooling-water/pressure_3"), unit: "bar" },
          { tagId: "cooling-water/basin_lvl", value: getVal("cooling-water/basin_lvl"), unit: "%" },
          { tagId: "cooling-water/eq_status_du03", value: getVal("cooling-water/eq_status_du03") ? 1 : 0, unit: "status" },
          { tagId: "cooling-water/eq_press_du03", value: getVal("cooling-water/eq_press_du03"), unit: "bar" },
          { tagId: "cooling-water/eq_status_bp03", value: getVal("cooling-water/eq_status_bp03") ? 1 : 0, unit: "status" },
          { tagId: "cooling-water/eq_press_bp03", value: getVal("cooling-water/eq_press_bp03"), unit: "bar" },
          { tagId: "cooling-water/eq_status_prep03", value: getVal("cooling-water/eq_status_prep03") ? 1 : 0, unit: "status" },
          { tagId: "cooling-water/eq_press_prep03", value: getVal("cooling-water/eq_press_prep03"), unit: "bar" },
          { tagId: "cooling-water/eq_status_st03", value: getVal("cooling-water/eq_status_st03") ? 1 : 0, unit: "status" },
          { tagId: "cooling-water/eq_press_st03", value: getVal("cooling-water/eq_press_st03"), unit: "bar" },
          { tagId: "cooling-water/eq_status_washing", value: getVal("cooling-water/eq_status_washing") ? 1 : 0, unit: "status" },
          { tagId: "cooling-water/eq_press_washing", value: getVal("cooling-water/eq_press_washing"), unit: "bar" },
          { tagId: "cooling-water/supply_temp", value: suppVal, unit: "C" },
          { tagId: "cooling-water/return_temp", value: retVal, unit: "C" },
          { tagId: "cooling-water/st3_return_temp", value: getVal("cooling-water/st3_return_temp"), unit: "C" },
          { tagId: "cooling-water/eq_temp_du03", value: getVal("cooling-water/eq_temp_du03"), unit: "C" },
          { tagId: "cooling-water/eq_temp_prep03", value: getVal("cooling-water/eq_temp_prep03"), unit: "C" },
          { tagId: "cooling-water/eq_temp_washing", value: getVal("cooling-water/eq_temp_washing"), unit: "C" },
          { tagId: "cooling-water/eq_temp_st03_supply", value: getVal("cooling-water/eq_temp_st03_supply"), unit: "C" },
          { tagId: "cooling-water/st3_heating", value: getVal("cooling-water/st3_heating") ? 1 : 0, unit: "status" },
          { tagId: "cooling-water/st3_cooling", value: getVal("cooling-water/st3_cooling") ? 1 : 0, unit: "status" },
          { tagId: "cooling-water/st3_steril", value: getVal("cooling-water/st3_steril") ? 1 : 0, unit: "status" },
          { tagId: "cooling-water/jumo_pieces", value: getVal("cooling-water/jumo_pieces") || "", unit: "" },
          { tagId: "cooling-water/delta_temp", value: deltaVal, unit: "C" },
          
          // Makeup, Ambient & Chemical
          { tagId: "cooling-water/makeup_wtr_tds", value: getVal("cooling-water/makeup_wtr_tds"), unit: "uS/cm" },
          { tagId: "cooling-water/makeup_wtr_ph", value: getVal("cooling-water/makeup_wtr_ph"), unit: "pH" },
          { tagId: "cooling-water/makeup_wtr_flow", value: getVal("cooling-water/makeup_wtr_flow"), unit: "m3/h" },
          { tagId: "cooling-water/makeup_wtr_vol", value: getVal("cooling-water/makeup_wtr_vol"), unit: "L" },
          { tagId: "cooling-water/cooling_tank_tds", value: getVal("cooling-water/cooling_tank_tds"), unit: "uS/cm" },
          { tagId: "cooling-water/cooling_tank_ph", value: getVal("cooling-water/cooling_tank_ph"), unit: "pH" },
          { tagId: "cooling-water/ambient_temp", value: getVal("cooling-water/ambient_temp"), unit: "C" },
          { tagId: "cooling-water/ambient_humidity", value: getVal("cooling-water/ambient_humidity"), unit: "%" },
          { tagId: "cooling-water/ct_efficiency", value: getVal("cooling-water/ct_efficiency"), unit: "%" },
          { tagId: "cooling-water/total_energy", value: getVal("cooling-water/total_energy"), unit: "kWh" },
          { tagId: "cooling-water/chemical_357_pump", value: getVal("cooling-water/chemical_357_pump") ? 1 : 0, unit: "status" },
          { tagId: "cooling-water/chemical_357_lvl", value: getVal("cooling-water/chemical_357_lvl"), unit: "%" },
          { tagId: "cooling-water/chemical_357_vol", value: getVal("cooling-water/chemical_357_vol"), unit: "L" },
          { tagId: "cooling-water/chemical_327_pump", value: getVal("cooling-water/chemical_327_pump") ? 1 : 0, unit: "status" },
          { tagId: "cooling-water/chemical_327_lvl", value: getVal("cooling-water/chemical_327_lvl"), unit: "%" },
          { tagId: "cooling-water/chemical_327_vol", value: getVal("cooling-water/chemical_327_vol"), unit: "L" },
          { tagId: "cooling-water/blowdown_status", value: getVal("cooling-water/blowdown_status") ? 1 : 0, unit: "status" },
          { tagId: "cooling-water/blowdown_flow", value: getVal("cooling-water/blowdown_flow"), unit: "L/h" },
          { tagId: "cooling-water/blowdown_vol", value: getVal("cooling-water/blowdown_vol"), unit: "m3" }
        ];

        // Filter out undefined values before saving/emitting
        const activePoints = pointsMapping.filter(p => p.value !== undefined && p.value !== null);

        const points = activePoints.map((p) => ({
          ts: ts.toISOString(),
          value: p.value,
          quality: "good" as const,
          meta: {
            tagId: p.tagId,
            deviceId: "cooling-water-1",
            unit: "cooling-water-1",
            area: "Utilities",
            source: "ignition-api"
          }
        }));

        // Ingest telemetry into MongoDB raw collection for historical and latest queries
        const ingestPoints = activePoints.map((p) => ({
          tagId: p.tagId,
          value: p.value,
          quality: "good" as const,
          ts: ts,
          deviceId: "cooling-water-1",
          unit: "cooling-water-1",
          area: "Utilities"
        }));
        
        await ingestTelemetry(ingestPoints).catch((err) => {
          logger.error({ err }, "Failed to save polled cooling tower telemetry to MongoDB");
        });

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

        logger.info("Cooling tower WF1-U3 API polled, saved to DB, and emitted via WebSocket");
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
