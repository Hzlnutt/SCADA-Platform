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

let incomingElectricityPollingInterval: NodeJS.Timeout | null = null;
let incomingElectricityRollupInterval: NodeJS.Timeout | null = null;

const parsePlnApi = (data: any, ts: Date) => {
  return {
    t_stamp: ts,
    status_pm8000: data.Status_PM8000 !== undefined ? !!data.Status_PM8000 : null,
    volt_ab: typeof data.VoltAB === "number" ? data.VoltAB : null,
    volt_bc: typeof data.VoltBC === "number" ? data.VoltBC : null,
    volt_ca: typeof data.VoltCA === "number" ? data.VoltCA : null,
    volt_ll: typeof data.Volt_LL === "number" ? data.Volt_LL : null,
    current_a: typeof data.Current_A === "number" ? data.Current_A : null,
    current_b: typeof data.Current_B === "number" ? data.Current_B : null,
    current_c: typeof data.Current_C === "number" ? data.Current_C : null,
    frequency: typeof data.Frequency === "number" ? data.Frequency : null,
    active_power: typeof data.Active_Power === "number" ? data.Active_Power : null,
    reactive_power_total: typeof data.Reactive_Power_Total === "number" ? data.Reactive_Power_Total : null,
    apparent_power_total: typeof data.Apparent_Power_Total === "number" ? data.Apparent_Power_Total : null,
    power_factor: typeof data.Power_Factor === "number" ? data.Power_Factor : null,
    voltage_unbalance: typeof data.Volatage_Unbalance === "number" ? data.Volatage_Unbalance : null,
    current_unbalance: typeof data.Current_Umbalance === "number" ? data.Current_Umbalance : null,
    thd_volt_a: typeof data.THD_Volt_A === "number" ? data.THD_Volt_A : null,
    thd_volt_b: typeof data.THD_Volt_B === "number" ? data.THD_Volt_B : null,
    thd_volt_c: typeof data.THD_Volt_C === "number" ? data.THD_Volt_C : null,
    thd_current_a: typeof data.THD_Current_A === "number" ? data.THD_Current_A : null,
    thd_current_b: typeof data.THD_Current_B === "number" ? data.THD_Current_B : null,
    thd_current_c: typeof data.THD_Current_C === "number" ? data.THD_Current_C : null,
    active_energy: typeof data.ActiveEnergy === "number" ? data.ActiveEnergy : null,
  };
};

const parseWfApi = (data: any, ts: Date) => {
  return {
    t_stamp: ts,
    status_pm5500: data.Status_PM5500_WF1 !== undefined ? !!data.Status_PM5500_WF1 : null,
    volt_ab: typeof data.VoltAB === "number" ? data.VoltAB : null,
    volt_bc: typeof data.VoltBC === "number" ? data.VoltBC : null,
    volt_ca: typeof data.VoltCA === "number" ? data.VoltCA : null,
    volt_ll: typeof data.Volt_LL === "number" ? data.Volt_LL : null,
    current_a: typeof data.Current_A === "number" ? data.Current_A : null,
    current_b: typeof data.Current_B === "number" ? data.Current_B : null,
    current_c: typeof data.Current_C === "number" ? data.Current_C : null,
    frequency: typeof data.Frequency === "number" ? data.Frequency : null,
    active_power_total: typeof data.Active_Power_Total === "number" ? data.Active_Power_Total : null,
    reactive_power_total: typeof data.Reactive_Power_Total === "number" ? data.Reactive_Power_Total : null,
    apparent_power_total: typeof data.Apparent_Power_Total === "number" ? data.Apparent_Power_Total : null,
    power_factor: typeof data.Power_Factor === "number" ? data.Power_Factor : null,
    voltage_unbalance: typeof data.Volatage_Unbalance === "number" ? data.Volatage_Unbalance : null,
    current_unbalance: typeof data.Current_Umbalance === "number" ? data.Current_Umbalance : null,
    thd_volt_a: typeof data.THD_Volt_A === "number" ? data.THD_Volt_A : null,
    thd_volt_b: typeof data.THD_Volt_B === "number" ? data.THD_Volt_B : null,
    thd_volt_c: typeof data.THD_Volt_C === "number" ? data.THD_Volt_C : null,
    thd_current_a: typeof data.THD_Current_A === "number" ? data.THD_Current_A : null,
    thd_current_b: typeof data.THD_Current_B === "number" ? data.THD_Current_B : null,
    thd_current_c: typeof data.THD_Current_C === "number" ? data.THD_Current_C : null,
    active_energy: typeof data.ActiveEnergy === "number" ? data.ActiveEnergy : null,
  };
};

const insertPlnTelemetry = async (payload: ReturnType<typeof parsePlnApi>) => {
  const pool = getPostgresPool();
  await pool.query(`
    INSERT INTO electric_pln_telemetry (
      t_stamp, status_pm8000, volt_ab, volt_bc, volt_ca, volt_ll,
      current_a, current_b, current_c, frequency, active_power,
      reactive_power_total, apparent_power_total, power_factor,
      voltage_unbalance, current_unbalance, thd_volt_a, thd_volt_b, thd_volt_c,
      thd_current_a, thd_current_b, thd_current_c, active_energy
    ) VALUES (
      $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23
    )
  `, [
    payload.t_stamp, payload.status_pm8000, payload.volt_ab, payload.volt_bc, payload.volt_ca, payload.volt_ll,
    payload.current_a, payload.current_b, payload.current_c, payload.frequency, payload.active_power,
    payload.reactive_power_total, payload.apparent_power_total, payload.power_factor,
    payload.voltage_unbalance, payload.current_unbalance, payload.thd_volt_a, payload.thd_volt_b, payload.thd_volt_c,
    payload.thd_current_a, payload.thd_current_b, payload.thd_current_c, payload.active_energy
  ]);
};

const insertWfTelemetry = async (table: "electric_wf1_telemetry" | "electric_wf2_telemetry", payload: ReturnType<typeof parseWfApi>) => {
  const pool = getPostgresPool();
  await pool.query(`
    INSERT INTO ${table} (
      t_stamp, status_pm5500, volt_ab, volt_bc, volt_ca, volt_ll,
      current_a, current_b, current_c, frequency, active_power_total,
      reactive_power_total, apparent_power_total, power_factor,
      voltage_unbalance, current_unbalance, thd_volt_a, thd_volt_b, thd_volt_c,
      thd_current_a, thd_current_b, thd_current_c, active_energy
    ) VALUES (
      $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23
    )
  `, [
    payload.t_stamp, payload.status_pm5500, payload.volt_ab, payload.volt_bc, payload.volt_ca, payload.volt_ll,
    payload.current_a, payload.current_b, payload.current_c, payload.frequency, payload.active_power_total,
    payload.reactive_power_total, payload.apparent_power_total, payload.power_factor,
    payload.voltage_unbalance, payload.current_unbalance, payload.thd_volt_a, payload.thd_volt_b, payload.thd_volt_c,
    payload.thd_current_a, payload.thd_current_b, payload.thd_current_c, payload.active_energy
  ]);
};

const fetchJsonWithTimeout = async (url: string, timeoutMs: number = 800): Promise<any> => {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(timeoutId);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } catch (err) {
    clearTimeout(timeoutId);
    throw err;
  }
};

const broadcastLiveTelemetry = (deviceId: string, pgPq: any) => {
  const io = getSocketServer();
  if (!io) return;

  const isPln = deviceId === "Cubicle_PLN_PM8000";
  const rawActive = pgPq.active_power !== undefined ? pgPq.active_power : pgPq.active_power_total;
  const activePowerVal = rawActive !== null ? Number(rawActive) / 1000.0 : 0;
  const reactivePowerVal = pgPq.reactive_power_total !== null ? Number(pgPq.reactive_power_total) / 1000.0 : 0;
  const apparentPowerVal = pgPq.apparent_power_total !== null ? Number(pgPq.apparent_power_total) / 1000.0 : 0;
  const pfVal = pgPq.power_factor !== null ? Math.abs(Number(pgPq.power_factor)) : 1.0;
  const freqVal = pgPq.frequency !== null ? Number(pgPq.frequency) : 50.0;
  const voltLAvg = pgPq.volt_ll !== null ? Number(pgPq.volt_ll) / 1000.0 : 20.0;
  const voltABVal = pgPq.volt_ab !== null ? Number(pgPq.volt_ab) / 1000.0 : 20.0;
  const voltBCVal = pgPq.volt_bc !== null ? Number(pgPq.volt_bc) / 1000.0 : 20.0;
  const voltCAVal = pgPq.volt_ca !== null ? Number(pgPq.volt_ca) / 1000.0 : 20.0;
  const currentAVal = pgPq.current_a !== null ? Number(pgPq.current_a) : 0;
  const currentBVal = pgPq.current_b !== null ? Number(pgPq.current_b) : 0;
  const currentCVal = pgPq.current_c !== null ? Number(pgPq.current_c) : 0;
  
  let vUnbVal = 0;
  const rawVUnb = pgPq.voltage_unbalance !== null ? Number(pgPq.voltage_unbalance) : null;
  if (rawVUnb !== null) {
    vUnbVal = rawVUnb < 1.0 ? rawVUnb * 100.0 : rawVUnb;
  }
  let iUnbVal = 0;
  const rawIUnb = pgPq.current_unbalance !== null ? Number(pgPq.current_unbalance) : null;
  if (rawIUnb !== null) {
    iUnbVal = rawIUnb < 1.0 ? rawIUnb * 100.0 : rawIUnb;
  }

  let thdVR = 0, thdVS = 0, thdVT = 0;
  const rawThdVA = pgPq.thd_volt_a !== null ? Number(pgPq.thd_volt_a) : null;
  const rawThdVB = pgPq.thd_volt_b !== null ? Number(pgPq.thd_volt_b) : null;
  const rawThdVC = pgPq.thd_volt_c !== null ? Number(pgPq.thd_volt_c) : null;
  if (rawThdVA !== null) thdVR = rawThdVA < 1.0 ? rawThdVA * 100.0 : rawThdVA;
  if (rawThdVB !== null) thdVS = rawThdVB < 1.0 ? rawThdVB * 100.0 : rawThdVB;
  if (rawThdVC !== null) thdVT = rawThdVC < 1.0 ? rawThdVC * 100.0 : rawThdVC;
  const thdVVVal = (thdVR + thdVS + thdVT) / 3.0;

  let thdIR = 0, thdIS = 0, thdIT = 0;
  const rawThdIA = pgPq.thd_current_a !== null ? Number(pgPq.thd_current_a) : null;
  const rawThdIB = pgPq.thd_current_b !== null ? Number(pgPq.thd_current_b) : null;
  const rawThdIC = pgPq.thd_current_c !== null ? Number(pgPq.thd_current_c) : null;
  if (rawThdIA !== null) thdIR = rawThdIA < 1.0 ? rawThdIA * 100.0 : rawThdIA;
  if (rawThdIB !== null) thdIS = rawThdIB < 1.0 ? rawThdIB * 100.0 : rawThdIB;
  if (rawThdIC !== null) thdIT = rawThdIC < 1.0 ? rawThdIC * 100.0 : rawThdIC;
  const thdIIVal = (thdIR + thdIS + thdIT) / 3.0;

  const statusVal = isPln ? pgPq.status_pm8000 : pgPq.status_pm5500;
  const isConnected = statusVal !== null ? !!statusVal : true;

  const vln1 = voltABVal / Math.sqrt(3);
  const vln2 = voltBCVal / Math.sqrt(3);
  const vln3 = voltCAVal / Math.sqrt(3);

  io.emit("electricity:live_update", {
    deviceId,
    pqData: {
      activePower: Number(activePowerVal.toFixed(1)),
      reactivePower: Number(reactivePowerVal.toFixed(1)),
      apparentPower: Number(apparentPowerVal.toFixed(1)),
      pf: pfVal !== null ? Number(pfVal.toFixed(3)) : null,
      pfStatus: isConnected ? "connected" : "offline",
      freq: Number(freqVal.toFixed(2)),
      vUnb: Number(vUnbVal.toFixed(2)),
      iUnb: Number(iUnbVal.toFixed(2)),
      thdV: Number(thdVVVal.toFixed(2)),
      thdI: Number(thdIIVal.toFixed(2)),
      vll1: Number(voltABVal.toFixed(2)),
      vll2: Number(voltBCVal.toFixed(2)),
      vll3: Number(voltCAVal.toFixed(2)),
      vln1: Number(vln1.toFixed(2)),
      vln2: Number(vln2.toFixed(2)),
      vln3: Number(vln3.toFixed(2)),
      current1: Number(currentAVal.toFixed(1)),
      current2: Number(currentBVal.toFixed(1)),
      current3: Number(currentCVal.toFixed(1)),
      vR: Number(vln1.toFixed(3)),
      vS: Number(vln2.toFixed(3)),
      vT: Number(vln3.toFixed(3)),
      iR: Number(currentAVal.toFixed(1)),
      iS: Number(currentBVal.toFixed(1)),
      iT: Number(currentCVal.toFixed(1)),
      thdV_R: Number(thdVR.toFixed(2)),
      thdV_S: Number(thdVS.toFixed(2)),
      thdV_T: Number(thdVT.toFixed(2)),
      thdI_R: Number(thdIR.toFixed(2)),
      thdI_S: Number(thdIS.toFixed(2)),
      thdI_T: Number(thdIT.toFixed(2)),
      voltage: Number(voltLAvg.toFixed(2))
    }
  });
};
const broadcastLiveTelemetryOffline = (deviceId: string) => {
  const io = getSocketServer();
  if (!io) return;
  io.emit("electricity:live_update", {
    deviceId,
    pqData: {
      pfStatus: "offline"
    }
  });
};

export const startIncomingElectricityPolling = () => {
  if (incomingElectricityPollingInterval) return;

  const poll = async () => {
    const ts = new Date();
    
    // Fetch and store PLN
    try {
      const data = await fetchJsonWithTimeout("http://10.3.164.3:8088/system/webdev/Utility_Dashboard/electric_pln");
      const parsed = parsePlnApi(data, ts);
      await insertPlnTelemetry(parsed);
      broadcastLiveTelemetry("Cubicle_PLN_PM8000", parsed);
    } catch (err: any) {
      logger.warn(`Incoming PLN polling failed: ${err.message}`);
      broadcastLiveTelemetryOffline("Cubicle_PLN_PM8000");
    }

    // Fetch and store WF1
    try {
      const data = await fetchJsonWithTimeout("http://10.3.164.3:8088/system/webdev/Utility_Dashboard/electric_wf1");
      const parsed = parseWfApi(data, ts);
      await insertWfTelemetry("electric_wf1_telemetry", parsed);
      broadcastLiveTelemetry("Feeder_WF1_PM5560", parsed);
    } catch (err: any) {
      logger.warn(`Incoming WF1 polling failed: ${err.message}`);
      broadcastLiveTelemetryOffline("Feeder_WF1_PM5560");
    }

    // Fetch and store WF2
    try {
      const data = await fetchJsonWithTimeout("http://10.3.164.3:8088/system/webdev/Utility_Dashboard/electric_wf2");
      const parsed = parseWfApi(data, ts);
      await insertWfTelemetry("electric_wf2_telemetry", parsed);
      broadcastLiveTelemetry("Feeder_WF2_PM5500", parsed);
    } catch (err: any) {
      logger.warn(`Incoming WF2 polling failed: ${err.message}`);
      broadcastLiveTelemetryOffline("Feeder_WF2_PM5500");
    }
  };

  poll();
  incomingElectricityPollingInterval = setInterval(poll, 1000);
};

const rollupMonthlyForMonth = async (yearMonth: string) => {
  const pool = getPostgresPool();
  const startStr = `${yearMonth}-01 00:00:00`;
  const [year, month] = yearMonth.split("-").map(Number);
  const nextMonth = month === 12 ? 1 : month + 1;
  const nextYear = month === 12 ? year + 1 : year;
  const endStr = `${nextYear}-${nextMonth.toString().padStart(2, "0")}-01 00:00:00`;

  // 1. PLN Rollup
  const plnAgg = await pool.query(`
    SELECT 
      MIN(active_energy) as energy_start,
      MAX(active_energy) as energy_end,
      MAX(active_power) as active_power_peak,
      AVG(volt_ll) as volt_ll_avg,
      AVG((current_a + current_b + current_c) / 3.0) as current_avg,
      AVG(power_factor) as power_factor_avg,
      MIN(power_factor) as power_factor_min,
      AVG(frequency) as frequency_avg
    FROM electric_pln_telemetry
    WHERE t_stamp >= $1 AND t_stamp < $2
  `, [startStr, endStr]);

  if (plnAgg.rows[0] && plnAgg.rows[0].energy_start !== null) {
    const r = plnAgg.rows[0];
    const kwh_consumed = Number(r.energy_end) - Number(r.energy_start);
    await pool.query(`
      INSERT INTO electric_pln_monthly (
        year_month, energy_start, energy_end, kwh_consumed, active_power_peak,
        volt_ll_avg, current_avg, power_factor_avg, power_factor_min, frequency_avg, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW())
      ON CONFLICT (year_month) DO UPDATE SET
        energy_start = EXCLUDED.energy_start,
        energy_end = EXCLUDED.energy_end,
        kwh_consumed = EXCLUDED.kwh_consumed,
        active_power_peak = EXCLUDED.active_power_peak,
        volt_ll_avg = EXCLUDED.volt_ll_avg,
        current_avg = EXCLUDED.current_avg,
        power_factor_avg = EXCLUDED.power_factor_avg,
        power_factor_min = EXCLUDED.power_factor_min,
        frequency_avg = EXCLUDED.frequency_avg,
        updated_at = NOW()
    `, [
      yearMonth, r.energy_start, r.energy_end, kwh_consumed, r.active_power_peak,
      r.volt_ll_avg, r.current_avg, r.power_factor_avg, r.power_factor_min, r.frequency_avg
    ]);
  }

  // 2. WF1 Rollup
  const wf1Agg = await pool.query(`
    SELECT 
      MIN(active_energy) as energy_start,
      MAX(active_energy) as energy_end,
      MAX(active_power_total) as active_power_peak,
      AVG(volt_ll) as volt_ll_avg,
      AVG((current_a + current_b + current_c) / 3.0) as current_avg,
      AVG(power_factor) as power_factor_avg,
      MIN(power_factor) as power_factor_min,
      AVG(frequency) as frequency_avg
    FROM electric_wf1_telemetry
    WHERE t_stamp >= $1 AND t_stamp < $2
  `, [startStr, endStr]);

  if (wf1Agg.rows[0] && wf1Agg.rows[0].energy_start !== null) {
    const r = wf1Agg.rows[0];
    const kwh_consumed = Number(r.energy_end) - Number(r.energy_start);
    await pool.query(`
      INSERT INTO electric_wf1_monthly (
        year_month, energy_start, energy_end, kwh_consumed, active_power_peak,
        volt_ll_avg, current_avg, power_factor_avg, power_factor_min, frequency_avg, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW())
      ON CONFLICT (year_month) DO UPDATE SET
        energy_start = EXCLUDED.energy_start,
        energy_end = EXCLUDED.energy_end,
        kwh_consumed = EXCLUDED.kwh_consumed,
        active_power_peak = EXCLUDED.active_power_peak,
        volt_ll_avg = EXCLUDED.volt_ll_avg,
        current_avg = EXCLUDED.current_avg,
        power_factor_avg = EXCLUDED.power_factor_avg,
        power_factor_min = EXCLUDED.power_factor_min,
        frequency_avg = EXCLUDED.frequency_avg,
        updated_at = NOW()
    `, [
      yearMonth, r.energy_start, r.energy_end, kwh_consumed, r.active_power_peak,
      r.volt_ll_avg, r.current_avg, r.power_factor_avg, r.power_factor_min, r.frequency_avg
    ]);
  }

  // 3. WF2 Rollup
  const wf2Agg = await pool.query(`
    SELECT 
      MIN(active_energy) as energy_start,
      MAX(active_energy) as energy_end,
      MAX(active_power_total) as active_power_peak,
      AVG(volt_ll) as volt_ll_avg,
      AVG((current_a + current_b + current_c) / 3.0) as current_avg,
      AVG(power_factor) as power_factor_avg,
      MIN(power_factor) as power_factor_min,
      AVG(frequency) as frequency_avg
    FROM electric_wf2_telemetry
    WHERE t_stamp >= $1 AND t_stamp < $2
  `, [startStr, endStr]);

  if (wf2Agg.rows[0] && wf2Agg.rows[0].energy_start !== null) {
    const r = wf2Agg.rows[0];
    const kwh_consumed = Number(r.energy_end) - Number(r.energy_start);
    await pool.query(`
      INSERT INTO electric_wf2_monthly (
        year_month, energy_start, energy_end, kwh_consumed, active_power_peak,
        volt_ll_avg, current_avg, power_factor_avg, power_factor_min, frequency_avg, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW())
      ON CONFLICT (year_month) DO UPDATE SET
        energy_start = EXCLUDED.energy_start,
        energy_end = EXCLUDED.energy_end,
        kwh_consumed = EXCLUDED.kwh_consumed,
        active_power_peak = EXCLUDED.active_power_peak,
        volt_ll_avg = EXCLUDED.volt_ll_avg,
        current_avg = EXCLUDED.current_avg,
        power_factor_avg = EXCLUDED.power_factor_avg,
        power_factor_min = EXCLUDED.power_factor_min,
        frequency_avg = EXCLUDED.frequency_avg,
        updated_at = NOW()
    `, [
      yearMonth, r.energy_start, r.energy_end, kwh_consumed, r.active_power_peak,
      r.volt_ll_avg, r.current_avg, r.power_factor_avg, r.power_factor_min, r.frequency_avg
    ]);
  }
};

export const runElectricityRollupAndCleanup = async () => {
  try {
    const now = new Date();
    // Rollup current month
    const yearMonth = `${now.getFullYear()}-${(now.getMonth() + 1).toString().padStart(2, "0")}`;
    await rollupMonthlyForMonth(yearMonth);

    // Rollup previous month
    const prevMonthDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const prevYearMonth = `${prevMonthDate.getFullYear()}-${(prevMonthDate.getMonth() + 1).toString().padStart(2, "0")}`;
    await rollupMonthlyForMonth(prevYearMonth);

    logger.info({ yearMonth, prevYearMonth }, "Electricity monthly rollup updated successfully");

    // Cleanup raw telemetry data older than 1 month
    const pool = getPostgresPool();
    await pool.query(`DELETE FROM electric_pln_telemetry WHERE t_stamp < NOW() - INTERVAL '1 month';`);
    await pool.query(`DELETE FROM electric_wf1_telemetry WHERE t_stamp < NOW() - INTERVAL '1 month';`);
    await pool.query(`DELETE FROM electric_wf2_telemetry WHERE t_stamp < NOW() - INTERVAL '1 month';`);

    logger.info("Cleared raw electricity telemetry older than 1 month from PostgreSQL");
  } catch (err: any) {
    logger.error({ err: err.message }, "Electricity rollup/cleanup job failed");
  }
};

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
      const tagToUrlMap: Record<string, string> = {};
      const tagToJsonKeyMap: Record<string, string> = {};
      const defaultUrl = "http://10.3.164.3:8088/system/webdev/Utility_Dashboard/cooling3";

      try {
        const listRes = await pool.query(
          "SELECT value FROM global_configs WHERE key IN ($1, $2)", 
          ["api_sources_list_cooling-water-1", "api_sources_list_cooling-water_1"]
        );
        listRes.rows.forEach((r) => {
          const list = r.value;
          if (Array.isArray(list)) {
            list.forEach((row: any) => {
              if (row.tagKey) {
                let ep = row.url || row.endpoint || "";
                tagToUrlMap[row.tagKey] = ep;
                tagToJsonKeyMap[row.tagKey] = row.jsonKey || "";
              }
            });
          }
        });
      } catch (e) {
        logger.warn("Failed to load custom API sources list from global_configs");
      }

      // Add default fallbacks for any keys not configured
      Object.keys(DEFAULT_TAG_KEY_TO_API_JSON_KEY).forEach((tagKey) => {
        if (tagToUrlMap[tagKey] === undefined) {
          tagToUrlMap[tagKey] = defaultUrl;
          tagToJsonKeyMap[tagKey] = DEFAULT_TAG_KEY_TO_API_JSON_KEY[tagKey];
        }
      });

      // Poll unique URLs
      const uniqueUrls = Array.from(
        new Set(
          Object.values(tagToUrlMap).filter(url => typeof url === "string" && url.trim().length > 0)
        )
      );

      const urlDataMap: Record<string, any> = {};
      await Promise.all(
        uniqueUrls.map(async (url) => {
          try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 4000);
            const fetchRes = await fetch(url, {
              headers: { "Cache-Control": "no-cache", "Pragma": "no-cache" },
              signal: controller.signal
            });
            clearTimeout(timeoutId);
            if (fetchRes.ok) {
              urlDataMap[url] = await fetchRes.json();
            }
          } catch (err) {
            logger.warn(`Scheduler failed to poll URL ${url}: ${err instanceof Error ? err.message : String(err)}`);
          }
        })
      );

      const ts = new Date();
      const io = getSocketServer();

      const getVal = (tagId: string): any => {
        const url = tagToUrlMap[tagId];
        if (!url) return undefined;
        const data = urlDataMap[url];
        if (!data) return undefined;
        
        const jsonKey = tagToJsonKeyMap[tagId];
        if (!jsonKey) return undefined; // strict check: empty jsonKey means undefined value
        
        let jk = jsonKey;
        if (jk === "Scaled_Temp_Tank_Cooling3_Supp") jk = "Scaled_Temp_Tank_Colling3_Supp";
        if (jk === "Scaled_Temp_Tank_Cooling3_Return") jk = "Scaled_Temp_Tank_Colling3_Return";
        
        return data[jk];
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

      // Emit directly via WebSocket
      const hasAnyData = Object.keys(urlDataMap).length > 0;
      if (hasAnyData) {
        if (io) {
          io.to(TELEMETRY_ALL_ROOM).emit("telemetry:update", { points });
          points.forEach((point) => {
            io.to(telemetryTagRoom(point.meta.tagId)).emit("telemetry:update", { points: [point] });
          });

          // Also emit raw API data for defaultUrl to keep backward compatibility
          io.emit("cooling_tower:update", {
            deviceId: "cooling-water-1",
            ts: ts.toISOString(),
            status: "connected",
            raw: urlDataMap[defaultUrl] || null
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
        logger.warn("Cooling tower API polling returned no data from any configured URLs");
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

let gasPollingInterval: NodeJS.Timeout | null = null;
let lastGasTs: Date | null = null;

export const startGasPolling = () => {
  if (gasPollingInterval) return;

  const poll = async () => {
    try {
      const pool = getPostgresPool();
      const res = await pool.query("SELECT MAX(t_stamp) AS max_ts FROM gas_telemetry;");
      const maxTs = res.rows[0]?.max_ts;

      if (maxTs) {
        const currentDateObj = new Date(maxTs);
        if (lastGasTs === null) {
          lastGasTs = currentDateObj;
        } else if (currentDateObj.getTime() !== lastGasTs.getTime()) {
          lastGasTs = currentDateObj;
          const io = getSocketServer();
          if (io) {
            io.emit("gas:update");
            logger.info("Detected new gas telemetry in Postgres, broadcasting gas:update");
          }
        }
      } else if (lastGasTs !== null) {
        lastGasTs = null;
        const io = getSocketServer();
        if (io) {
          io.emit("gas:update");
          logger.info("Detected gas telemetry cleared in Postgres, broadcasting gas:update");
        }
      }
    } catch (err) {
      logger.error({ err }, "Gas Postgres polling failed");
    }
  };

  // Initial poll
  poll();
  // Poll every 5 seconds
  gasPollingInterval = setInterval(poll, 5000);
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
  startGasPolling();
  startIncomingElectricityPolling();

  // Initial rollup and cleanup on start
  runElectricityRollupAndCleanup().catch((err) => {

    logger.error({ err }, "Initial electricity rollup/cleanup failed");
  });

  // Hourly rollup and cleanup
  setInterval(() => {
    runElectricityRollupAndCleanup().catch((err) => {
      logger.error({ err }, "Periodic electricity rollup/cleanup failed");
    });
  }, 60 * 60 * 1000);

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
       FROM sensor_rules
       WHERE unit_id LIKE 'cooling-water%'`
    );
    const rules = rulesRes.rows;

    const activeEvents: any[] = [];

    for (const rule of rules) {
      const isAlertEnabled = rule.enable_alert && !rule.suppress_alert;
      const point = points.find(p => p.meta.tagId === rule.tag_key);
      const hasValidValue = point && typeof point.value === "number";

      let status: "active" | "cleared" = "cleared";
      let severity: "medium" | "high" = "medium";
      let msg = "";

      if (isAlertEnabled && hasValidValue) {
        const value = point.value;
        const alarm = rule.high_limit ? parseFloat(rule.high_limit) : null;
        const direction = (rule.direction || "above").toLowerCase();

        if (direction === "above") {
          if (alarm !== null && value >= alarm) {
            status = "active";
            severity = "high";
            msg = `[${rule.tag_name}] exceeds Alarm Limit of ${alarm} ${rule.unit || ""} (Current: ${value.toFixed(1)} ${rule.unit || ""})`;
          }
        } else {
          if (alarm !== null && value <= alarm) {
            status = "active";
            severity = "high";
            msg = `[${rule.tag_name}] is below Alarm Limit of ${alarm} ${rule.unit || ""} (Current: ${value.toFixed(1)} ${rule.unit || ""})`;
          }
        }
      }

      const alarmKey = `pid-threshold:${rule.unit_id}:${rule.tag_key}`;

      if (status === "active") {
        activeEvents.push({
          alarmKey,
          tagId: rule.tag_key,
          deviceId: (point && point.meta && point.meta.deviceId) || "plc-sim",
          unit: rule.unit_id,
          area: (point && point.meta && point.meta.area) || "Utilities",
          message: msg,
          severity,
          status: "active"
        });
      }
    }

    if (activeEvents.length > 0) {
      const res = await ingestAlarmEvents(activeEvents);
      publishAlarmEvents(res.events);
    }
  } catch (err) {
    logger.error({ err }, "Failed to evaluate sensor rules for points");
  }
};
