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
import { setLatestSolarLiveState, SolarLiveState } from "../modules/analytics/solar.analytics";


import { updateRunningHours } from "../modules/telemetry/running-hours.service";
import { ingestTelemetry } from "../modules/telemetry/telemetry.service";
import { ingestAlarmEvents } from "../modules/alarms/alarms.service";
import { publishAlarmEvents } from "../services/alarms.publisher";

let lastElectricityTs: Date | null = null;
let pollingInterval: NodeJS.Timeout | null = null;
let pfPollingInterval: NodeJS.Timeout | null = null;

let incomingElectricityPollingInterval: NodeJS.Timeout | null = null;
let incomingElectricityRollupInterval: NodeJS.Timeout | null = null;

export interface HvacRetainLiveState {
  PLC1_AHU1_Utl: {
    ACT_RTx_1A?: number;
    ACT_RHx_1A?: number;
    ACT_RTx_1B?: number;
    ACT_RHx_1B?: number;
    ACT_RATx_1?: number;
    ACT_RAHx_1?: number;
    ACT_SF01_CAP?: number;
    ACT_SF01_SPD?: number;
    ACT_SF01_CUR?: number;
    ACT_EH01_CAP?: number;
    xIND_RUN_SF01?: boolean;
    xIND_RUN_EH01?: boolean;
    xIND_RUN_HF01?: boolean;
    xIND_RUN_HP?: boolean;
  };
  PLC2_AHU2: {
    ACT_RTx_2A?: number;
    ACT_RHx_2A?: number;
    ACT_RTx_2B?: number;
    ACT_RHx_2B?: number;
    ACT_RATx_2?: number;
    ACT_RAHx_2?: number;
    ACT_SF02_CAP?: number;
    ACT_SF02A_SPD?: number;
    ACT_SF02B_SPD?: number;
    ACT_SF02B_CUR?: number;
    ACT_EH02_CAP?: number;
    xIND_RUN_SF02A?: boolean;
    xIND_RUN_SF02B?: boolean;
    xIND_RUN_EH02?: boolean;
    xIND_RUN_CU02A?: boolean;
    xIND_RUN_CU02B?: boolean;
  };
  PLC2_AHU3: {
    ACT_RTx_3A?: number;
    ACT_RTx_3B?: number;
  };
  t_stamp?: Date | string;
}

let latestHvacRetainLiveState: HvacRetainLiveState = {
  PLC1_AHU1_Utl: {
    ACT_RTx_1A: 40.46875,
    xIND_RUN_EH01: true,
    ACT_RTx_1B: 40.40625,
    ACT_SF01_CAP: 90,
    ACT_RHx_1B: 74.875,
    ACT_RHx_1A: 76.8125,
    ACT_EH01_CAP: 30,
    xIND_RUN_HP: true,
    ACT_SF01_CUR: 1.87649989128113,
    xIND_RUN_SF01: true,
    ACT_SF01_SPD: 1839.82495117188,
    ACT_RATx_1: 40.0625,
    xIND_RUN_HF01: true,
    ACT_RAHx_1: 75.75
  },
  PLC2_AHU2: {
    ACT_RTx_2B: 29.84375,
    xIND_RUN_EH02: false,
    ACT_RTx_2A: 28.71875,
    ACT_RHx_2A: 76.1875,
    ACT_RHx_2B: 70.125,
    ACT_SF02A_SPD: 1828.7099609375,
    ACT_SF02_CAP: 90,
    ACT_SF02B_SPD: 1846.26000976563,
    xIND_RUN_SF02A: true,
    ACT_RATx_2: 30.1625003814697,
    xIND_RUN_SF02B: true,
    ACT_RAHx_2: 68.1374969482422,
    xIND_RUN_CU02A: true,
    ACT_SF02B_CUR: 1.5387499332428,
    ACT_EH02_CAP: 0,
    xIND_RUN_CU02B: true
  },
  PLC2_AHU3: {
    ACT_RTx_3A: 26.25,
    ACT_RTx_3B: 27.5625
  },
  t_stamp: new Date()
};

export const getHvacRetainLiveState = (): HvacRetainLiveState => latestHvacRetainLiveState;

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

const getNullPlnRecord = (ts: Date) => ({
  t_stamp: ts,
  status_pm8000: false,
  volt_ab: null, volt_bc: null, volt_ca: null, volt_ll: null,
  current_a: null, current_b: null, current_c: null,
  frequency: null, active_power: null, reactive_power_total: null,
  apparent_power_total: null, power_factor: null, voltage_unbalance: null,
  current_unbalance: null, thd_volt_a: null, thd_volt_b: null,
  thd_volt_c: null, thd_current_a: null, thd_current_b: null,
  thd_current_c: null, active_energy: null
});

const getNullWfRecord = (ts: Date) => ({
  t_stamp: ts,
  status_pm5500: false,
  volt_ab: null, volt_bc: null, volt_ca: null, volt_ll: null,
  current_a: null, current_b: null, current_c: null,
  frequency: null, active_power_total: null, reactive_power_total: null,
  apparent_power_total: null, power_factor: null, voltage_unbalance: null,
  current_unbalance: null, thd_volt_a: null, thd_volt_b: null,
  thd_volt_c: null, thd_current_a: null, thd_current_b: null,
  thd_current_c: null, active_energy: null
});

const EW_GROUP_PMS: Record<string, string[]> = {
  ew23: ["PM318", "PM319", "PM320", "PM321", "PM322", "PM323", "PM324", "PM325", "PM327", "PM337", "PM410", "PM411", "PM412"],
  ew21: ["PM201", "PM202", "PM203", "PM205", "PM206", "PM207", "PM208", "PM209", "PM210", "PM211", "PM212", "PM213", "PM214", "PM215"],
  ew22: ["PM226", "PM229", "PM271", "PM272", "PM273", "PM274", "PM288"]
};

const getNullEwRecords = (ts: Date, groupId: string): ElectricPmRecord[] => {
  const pms = EW_GROUP_PMS[groupId] || [];
  return pms.map(pm_id => ({
    t_stamp: ts,
    group_id: groupId,
    pm_id,
    status: false,
    volt_ab: null, volt_bc: null, volt_ca: null, volt_ll: null,
    current_a: null, current_b: null, current_c: null,
    frequency: null, active_power_total: null, reactive_power_total: null,
    apparent_power_total: null, power_factor: null, voltage_unbalance: null,
    current_unbalance: null, thd_volt_a: null, thd_volt_b: null,
    thd_volt_c: null, thd_current_a: null, thd_current_b: null,
    thd_current_c: null, active_energy: null
  }));
};

export const formatMinuteString = (d: Date = new Date()): string => {
  // Correct 1-minute server clock skew by subtracting 60 seconds to match local time
  const adjustedDate = new Date(d.getTime() - 60000);
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Jakarta",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false
  });
  const parts = formatter.formatToParts(adjustedDate);
  const getPart = (type: string) => parts.find(p => p.type === type)?.value || "00";
  const yr = getPart("year");
  const mo = getPart("month");
  const dy = getPart("day");
  const hr = getPart("hour");
  const mi = getPart("minute");
  return `${yr}-${mo}-${dy} ${hr}:${mi}:00`;
};

const insertPlnMinuteTelemetry = async (payload: ReturnType<typeof parsePlnApi>, minuteTs: Date) => {
  const pool = getPostgresPool();
  await pool.query(`
    INSERT INTO electric_pln_telemetry_minute (
      t_stamp, status_pm8000, volt_ab, volt_bc, volt_ca, volt_ll,
      current_a, current_b, current_c, frequency, active_power,
      reactive_power_total, apparent_power_total, power_factor,
      voltage_unbalance, current_unbalance, thd_volt_a, thd_volt_b, thd_volt_c,
      thd_current_a, thd_current_b, thd_current_c, active_energy
    ) VALUES (
      $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23
    )
  `, [
    minuteTs, payload.status_pm8000, payload.volt_ab, payload.volt_bc, payload.volt_ca, payload.volt_ll,
    payload.current_a, payload.current_b, payload.current_c, payload.frequency, payload.active_power,
    payload.reactive_power_total, payload.apparent_power_total, payload.power_factor,
    payload.voltage_unbalance, payload.current_unbalance, payload.thd_volt_a, payload.thd_volt_b, payload.thd_volt_c,
    payload.thd_current_a, payload.thd_current_b, payload.thd_current_c, payload.active_energy
  ]).catch((err) => {
    logger.warn(`Failed to insert PLN minute telemetry: ${err.message}`);
  });
};

const insertWfMinuteTelemetry = async (table: "electric_wf1_telemetry_minute" | "electric_wf2_telemetry_minute", payload: ReturnType<typeof parseWfApi>, minuteTs: Date) => {
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
    minuteTs, payload.status_pm5500, payload.volt_ab, payload.volt_bc, payload.volt_ca, payload.volt_ll,
    payload.current_a, payload.current_b, payload.current_c, payload.frequency, payload.active_power_total,
    payload.reactive_power_total, payload.apparent_power_total, payload.power_factor,
    payload.voltage_unbalance, payload.current_unbalance, payload.thd_volt_a, payload.thd_volt_b, payload.thd_volt_c,
    payload.thd_current_a, payload.thd_current_b, payload.thd_current_c, payload.active_energy
  ]).catch((err) => {
    logger.warn(`Failed to insert WF minute telemetry to ${table}: ${err.message}`);
  });
};

export interface ElectricPltsRecord {
  t_stamp: Date;
  poi_id: string;
  status: boolean | null;
  volt_ab: number | null;
  volt_bc: number | null;
  volt_ca: number | null;
  volt_an: number | null;
  volt_bn: number | null;
  volt_cn: number | null;
  frequency: number | null;
  active_power: number;
  total_kwh: number;
  total_kvarh: number;
}

export const parsePltsApiRecords = (data: any, ts: Date): ElectricPltsRecord[] => {
  const result: ElectricPltsRecord[] = [];
  if (!data || typeof data !== "object") return result;

  const parsePoi = (poiObj: any, poiId: "POI_1" | "POI_2") => {
    if (!poiObj) return;
    const num = poiId === "POI_1" ? "1" : "2";
    const status = poiObj[`Status_POI_${num}`] !== undefined ? Boolean(poiObj[`Status_POI_${num}`]) : true;
    const volt_ab = Number(poiObj[`Volt_AB_POI_${num}`]) || null;
    const volt_bc = Number(poiObj[`Volt_BC_POI_${num}`]) || null;
    const volt_ca = Number(poiObj[`Volt_CA_POI_${num}`]) || null;
    const volt_an = Number(poiObj[`Volt_AN_POI_${num}`]) || null;
    const volt_bn = Number(poiObj[`Volt_BN_POI_${num}`]) || null;
    const volt_cn = Number(poiObj[`Volt_CN_POI_${num}`]) || null;
    const frequency = Number(poiObj[`Frequency_POI_${num}`]) || null;
    let active_power = Number(poiObj[`Scale_Total_KW_POI_${num}`]) || 0;
    if (active_power < 0.001 && active_power > 0) active_power = 0;
    const total_kwh = Number(poiObj[`Total_KWH_POI_${num}`]) || 0;
    const total_kvarh = Number(poiObj[`Total_KVARH_POI_${num}`]) || 0;

    result.push({
      t_stamp: ts,
      poi_id: poiId,
      status,
      volt_ab,
      volt_bc,
      volt_ca,
      volt_an,
      volt_bn,
      volt_cn,
      frequency,
      active_power,
      total_kwh,
      total_kvarh
    });
  };

  if (data.POI_1) parsePoi(data.POI_1, "POI_1");
  if (data.POI_2) parsePoi(data.POI_2, "POI_2");

  return result;
};

const insertPltsMinuteTelemetry = async (records: ElectricPltsRecord[], minuteTs: Date) => {
  const pool = getPostgresPool();
  for (const r of records) {
    try {
      await pool.query(`
        INSERT INTO electric_plts_telemetry_minute (
          t_stamp, poi_id, status, volt_ab, volt_bc, volt_ca, volt_an, volt_bn, volt_cn, frequency, active_power, total_kwh, total_kvarh
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
      `, [
        minuteTs, r.poi_id, r.status, r.volt_ab, r.volt_bc, r.volt_ca, r.volt_an, r.volt_bn, r.volt_cn, r.frequency, r.active_power, r.total_kwh, r.total_kvarh
      ]);
    } catch (err: any) {
      logger.warn(`Failed to insert PLTS minute telemetry for ${r.poi_id}: ${err.message}`);
    }
  }
};

export interface ElectricPmRecord {
  t_stamp: Date;
  group_id: string;
  pm_id: string;
  status: boolean | null;
  volt_ab: number | null;
  volt_bc: number | null;
  volt_ca: number | null;
  volt_ll: number | null;
  current_a: number | null;
  current_b: number | null;
  current_c: number | null;
  frequency: number | null;
  active_power_total: number | null;
  reactive_power_total: number | null;
  apparent_power_total: number | null;
  power_factor: number | null;
  voltage_unbalance: number | null;
  current_unbalance: number | null;
  thd_volt_a: number | null;
  thd_volt_b: number | null;
  thd_volt_c: number | null;
  thd_current_a: number | null;
  thd_current_b: number | null;
  thd_current_c: number | null;
  active_energy: number | null;
}

export const parseEwApi = (data: any, ts: Date, groupId: string): ElectricPmRecord[] => {
  if (!data) return [];
  const records: ElectricPmRecord[] = [];

  const extractPm = (rawKey: string, obj: any): ElectricPmRecord => {
    // Determine standardized PM ID e.g. "PM327"
    let pmId = rawKey.toUpperCase();
    if (!pmId.startsWith("PM")) {
      const match = rawKey.match(/(\d+)/);
      pmId = match ? `PM${match[1]}` : rawKey;
    }
    const cleanNum = pmId.replace(/\D/g, "");

    const getVal = (prefixList: string[]): number | null => {
      for (const p of prefixList) {
        // Direct key
        if (obj[p] !== undefined && obj[p] !== null) {
          const num = Number(obj[p]);
          return isNaN(num) ? null : num;
        }
        // With PM suffix e.g. Active_Power_Total_PM327, Active_Power_Total_pm327, Active_Power_Total_327
        const candidateKeys = [
          `${p}_${pmId}`,
          `${p}_${pmId.toLowerCase()}`,
          `${p}_pm${cleanNum}`,
          `${p}_PM${cleanNum}`,
          `${p}_${cleanNum}`,
          `${p}__${pmId}`,
          `${p}__pm${cleanNum}`
        ];
        for (const ck of candidateKeys) {
          if (obj[ck] !== undefined && obj[ck] !== null) {
            const num = Number(obj[ck]);
            return isNaN(num) ? null : num;
          }
        }
      }
      return null;
    };

    const getStatus = (): boolean | null => {
      const statusCandidates = [
        `Status_${pmId}`,
        `Status_${pmId.toLowerCase()}`,
        `Status_PM5500_WF1_${pmId}`,
        `Status_PM5500_WF1_${pmId.toLowerCase()}`,
        `Status__${pmId}`,
        `Status_pm${cleanNum}`,
        `Status_PM${cleanNum}`,
        "Status"
      ];
      for (const sk of statusCandidates) {
        if (obj[sk] !== undefined && obj[sk] !== null) {
          return Boolean(obj[sk]);
        }
      }
      return true;
    };

    return {
      t_stamp: ts,
      group_id: groupId,
      pm_id: pmId,
      status: getStatus(),
      volt_ab: getVal(["VoltAB"]),
      volt_bc: getVal(["VoltBC"]),
      volt_ca: getVal(["VoltCA"]),
      volt_ll: getVal(["Volt_LL", "VoltLL"]),
      current_a: getVal(["Current_A"]),
      current_b: getVal(["Current_B"]),
      current_c: getVal(["Current_C"]),
      frequency: getVal(["Frequency"]),
      active_power_total: getVal(["Active_Power_Total", "Active_Power"]),
      reactive_power_total: getVal(["Reactive_Power_Total", "Reactive_Power"]),
      apparent_power_total: getVal(["Apparent_Power_Total", "Apparent_Power"]),
      power_factor: getVal(["Power_Factor", "PF"]),
      voltage_unbalance: getVal(["Volatage_Unbalance", "Voltage_Unbalance"]),
      current_unbalance: getVal(["Current_Umbalance", "Current_Unbalance"]),
      thd_volt_a: getVal(["THD_Volt_A"]),
      thd_volt_b: getVal(["THD_Volt_B"]),
      thd_volt_c: getVal(["THD_Volt_C"]),
      thd_current_a: getVal(["THD_Current_A"]),
      thd_current_b: getVal(["THD_Current_B"]),
      thd_current_c: getVal(["THD_Current_C"]),
      active_energy: getVal(["ActiveEnergy", "Active_Energy"])
    };
  };

  if (Array.isArray(data)) {
    for (const item of data) {
      if (!item || typeof item !== "object") continue;
      // Find PM ID from keys
      const keys = Object.keys(item);
      let detectedPm = "PM_UNKNOWN";
      for (const k of keys) {
        const m = k.match(/(?:PM|pm)(\d+)/i);
        if (m) {
          detectedPm = `PM${m[1]}`;
          break;
        }
      }
      records.push(extractPm(detectedPm, item));
    }
  } else if (typeof data === "object") {
    for (const [key, val] of Object.entries(data)) {
      if (val && typeof val === "object" && !Array.isArray(val)) {
        records.push(extractPm(key, val));
      } else {
        // Flat object (legacy)
        const m = key.match(/(?:PM|pm)(\d+)/i);
        if (m) {
          const pmKey = `PM${m[1]}`;
          let existing = records.find(r => r.pm_id === pmKey);
          if (!existing) {
            existing = extractPm(pmKey, data);
            records.push(existing);
          }
        }
      }
    }
  }

  const pmOrder: Record<string, number> = {
    PM318: 10, PM319: 20, PM320: 30, PM321: 40, PM322: 50,
    PM323: 60, PM324: 70, PM325: 80, PM327: 90, PM337: 100,
    PM201: 201, PM202: 202, PM203: 203, PM205: 205, PM206: 206,
    PM207: 207, PM208: 208, PM209: 209, PM210: 210, PM211: 211,
    PM212: 212, PM213: 213, PM214: 214, PM215: 215, PM226: 226,
    PM229: 229, PM271: 271, PM272: 272, PM273: 273, PM274: 274,
    PM288: 288,
    PM410: 410, PM8000: 410, CUBICLE_PLN_PM8000: 410,
    PM411: 411, PM5560: 411, PM5560_WF1: 411, FEEDER_WF1_PM5560: 411,
    PM412: 412, PM5560_WF2: 412, PM5500: 412, FEEDER_WF2_PM5500: 412
  };
  records.sort((a, b) => {
    const normA = String(a.pm_id).toUpperCase().trim();
    const normB = String(b.pm_id).toUpperCase().trim();
    const idxA = pmOrder[normA] ?? (parseInt(normA.replace(/\D/g, "") || "9999", 10) + 1000);
    const idxB = pmOrder[normB] ?? (parseInt(normB.replace(/\D/g, "") || "9999", 10) + 1000);
    return idxA - idxB;
  });

  return records;
};

const insertPmMinuteTelemetryBatch = async (records: ElectricPmRecord[], minuteTs: Date) => {
  if (!records.length) return;
  const pool = getPostgresPool();
  try {
    const valueClauses: string[] = [];
    const params: any[] = [];
    let paramIdx = 1;

    for (const r of records) {
      valueClauses.push(
        `($${paramIdx++}, $${paramIdx++}, $${paramIdx++}, $${paramIdx++}, $${paramIdx++}, $${paramIdx++}, $${paramIdx++}, $${paramIdx++}, $${paramIdx++}, $${paramIdx++}, $${paramIdx++}, $${paramIdx++}, $${paramIdx++}, $${paramIdx++}, $${paramIdx++}, $${paramIdx++}, $${paramIdx++}, $${paramIdx++}, $${paramIdx++}, $${paramIdx++}, $${paramIdx++}, $${paramIdx++}, $${paramIdx++}, $${paramIdx++}, $${paramIdx++})`
      );
      params.push(
        minuteTs, r.group_id, r.pm_id, r.status, r.volt_ab, r.volt_bc, r.volt_ca, r.volt_ll,
        r.current_a, r.current_b, r.current_c, r.frequency, r.active_power_total,
        r.reactive_power_total, r.apparent_power_total, r.power_factor,
        r.voltage_unbalance, r.current_unbalance, r.thd_volt_a, r.thd_volt_b, r.thd_volt_c,
        r.thd_current_a, r.thd_current_b, r.thd_current_c, r.active_energy
      );
    }

    await pool.query(`
      INSERT INTO electric_pm_telemetry_minute (
        t_stamp, group_id, pm_id, status, volt_ab, volt_bc, volt_ca, volt_ll,
        current_a, current_b, current_c, frequency, active_power_total,
        reactive_power_total, apparent_power_total, power_factor,
        voltage_unbalance, current_unbalance, thd_volt_a, thd_volt_b, thd_volt_c,
        thd_current_a, thd_current_b, thd_current_c, active_energy
      ) VALUES ${valueClauses.join(", ")}
    `, params);
  } catch (err: any) {
    logger.warn(`Failed to insert PM minute telemetry batch: ${err.message}`);
  }
};

const broadcastEwLiveTelemetry = (groupId: string, records: ElectricPmRecord[]) => {
  const io = getSocketServer();
  if (!io) return;

  io.emit(`electricity:${groupId}_live`, {
    groupId,
    t_stamp: new Date(),
    data: records
  });
  io.emit("electricity:pm_live_update", {
    groupId,
    t_stamp: new Date(),
    data: records
  });
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

let lastElectricityMinuteStr = "";
let lastSolarHourStr = "";

const parseSolarApi = (data: any, ts: Date): SolarLiveState => {
  const p1 = data?.POI_1 || {};
  const p2 = data?.POI_2 || {};
  const poi1Status = Boolean(p1.Status_POI_1);
  const poi2Status = Boolean(p2.Status_POI_2);
  const poi1 = {
    status: poi1Status,
    totalKwh: typeof p1.Total_KWH_POI_1 === "number" ? p1.Total_KWH_POI_1 : 0,
    totalKvarh: typeof p1.Total_KVARH_POI_1 === "number" ? p1.Total_KVARH_POI_1 : 0,
    frequency: typeof p1.Frequency_POI_1 === "number" ? p1.Frequency_POI_1 : 50,
    voltAb: typeof p1.Volt_AB_POI_1 === "number" ? p1.Volt_AB_POI_1 : 0,
    voltBc: typeof p1.Volt_BC_POI_1 === "number" ? p1.Volt_BC_POI_1 : 0,
    voltCa: typeof p1.Volt_CA_POI_1 === "number" ? p1.Volt_CA_POI_1 : 0,
    voltAn: typeof p1.Volt_AN_POI_1 === "number" ? p1.Volt_AN_POI_1 : 0,
    voltBn: typeof p1.Volt_BN_POI_1 === "number" ? p1.Volt_BN_POI_1 : 0,
    voltCn: typeof p1.Volt_CN_POI_1 === "number" ? p1.Volt_CN_POI_1 : 0,
  };
  const poi2 = {
    status: poi2Status,
    totalKwh: typeof p2.Total_KWH_POI_2 === "number" ? p2.Total_KWH_POI_2 : 0,
    totalKvarh: typeof p2.Total_KVARH_POI_2 === "number" ? p2.Total_KVARH_POI_2 : 0,
    frequency: typeof p2.Frequency_POI_2 === "number" ? p2.Frequency_POI_2 : 50,
    voltAb: typeof p2.Volt_AB_POI_2 === "number" ? p2.Volt_AB_POI_2 : 0,
    voltBc: typeof p2.Volt_BC_POI_2 === "number" ? p2.Volt_BC_POI_2 : 0,
    voltCa: typeof p2.Volt_CA_POI_2 === "number" ? p2.Volt_CA_POI_2 : 0,
    voltAn: typeof p2.Volt_AN_POI_2 === "number" ? p2.Volt_AN_POI_2 : 0,
    voltBn: typeof p2.Volt_BN_POI_2 === "number" ? p2.Volt_BN_POI_2 : 0,
    voltCn: typeof p2.Volt_CN_POI_2 === "number" ? p2.Volt_CN_POI_2 : 0,
  };
  return {
    t_stamp: ts,
    poi1,
    poi2,
    totalKwh: poi1.totalKwh + poi2.totalKwh
  };
};

const insertSolarHourlyTelemetry = async (
  pool: any,
  hourStr: string,
  poi1Kwh: number | null,
  poi2Kwh: number | null
) => {
  let totKwh: number | null = null;
  if (poi1Kwh !== null || poi2Kwh !== null) {
    totKwh = (poi1Kwh ?? 0) + (poi2Kwh ?? 0);
  }
  try {
    await pool.query(
      `INSERT INTO solar_telemetry (t_stamp, poi_1, poi_2, total)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (t_stamp) DO UPDATE SET
         poi_1 = EXCLUDED.poi_1,
         poi_2 = EXCLUDED.poi_2,
         total = EXCLUDED.total;`,
      [hourStr, poi1Kwh, poi2Kwh, totKwh]
    );
    logger.info({ hour: hourStr, poi1Kwh, poi2Kwh, totKwh }, "Saved hourly solar telemetry to Postgres");
  } catch (err: any) {
    logger.error(`Failed to insert hourly solar telemetry: ${err.message}`);
  }
};

export const startIncomingElectricityPolling = () => {
  if (incomingElectricityPollingInterval) return;

  const poll = async () => {
    const ts = new Date();
    const currentMinuteStr = formatMinuteString(ts);
    const isNewMinute = currentMinuteStr !== lastElectricityMinuteStr;
    if (isNewMinute) {
      lastElectricityMinuteStr = currentMinuteStr;
    }
    const minuteTs = new Date(currentMinuteStr);

    let lastPlnRec: ElectricPmRecord | null = null;
    let lastWf1Rec: ElectricPmRecord | null = null;
    let lastWf2Rec: ElectricPmRecord | null = null;
    
    // Helper for resilient fetching
    const fetchApiData = async (endpoint: string) => {
      try {
        return await fetchJsonWithTimeout(`https://utility.widatra.com/system/webdev/Utility_Dashboard/${endpoint}`);
      } catch {
        try {
          return await fetchJsonWithTimeout(`http://10.3.164.3:8088/system/webdev/Utility_Dashboard/${endpoint}`);
        } catch {
          return await fetchJsonWithTimeout(`http://127.0.0.1:3001/system/webdev/Utility_Dashboard/${endpoint}`).catch(() => null);
        }
      }
    };
    
    // Fetch and store PLN
    let plnParsed: ReturnType<typeof parsePlnApi> | null = null;
    try {
      const data = await fetchApiData("electric_pln");
      if (data) {
        plnParsed = parsePlnApi(data, ts);
      }
    } catch (err: any) {
      logger.warn(`Incoming PLN polling failed: ${err.message}`);
    }

    if (!plnParsed) {
      plnParsed = getNullPlnRecord(ts);
      broadcastLiveTelemetryOffline("Cubicle_PLN_PM8000");
    } else {
      broadcastLiveTelemetry("Cubicle_PLN_PM8000", plnParsed);
    }

    if (isNewMinute) {
      await insertPlnMinuteTelemetry(plnParsed, minuteTs);
    }

    lastPlnRec = {
      t_stamp: ts,
      group_id: "ew23",
      pm_id: "PM410",
      status: plnParsed.status_pm8000 !== null ? !!plnParsed.status_pm8000 : false,
      volt_ab: plnParsed.volt_ab,
      volt_bc: plnParsed.volt_bc,
      volt_ca: plnParsed.volt_ca,
      volt_ll: plnParsed.volt_ll,
      current_a: plnParsed.current_a,
      current_b: plnParsed.current_b,
      current_c: plnParsed.current_c,
      frequency: plnParsed.frequency,
      active_power_total: plnParsed.active_power,
      reactive_power_total: plnParsed.reactive_power_total,
      apparent_power_total: plnParsed.apparent_power_total,
      power_factor: plnParsed.power_factor,
      voltage_unbalance: plnParsed.voltage_unbalance,
      current_unbalance: plnParsed.current_unbalance,
      thd_volt_a: plnParsed.thd_volt_a,
      thd_volt_b: plnParsed.thd_volt_b,
      thd_volt_c: plnParsed.thd_volt_c,
      thd_current_a: plnParsed.thd_current_a,
      thd_current_b: plnParsed.thd_current_b,
      thd_current_c: plnParsed.thd_current_c,
      active_energy: plnParsed.active_energy
    };

    // Fetch and store WF1
    let wf1Parsed: ReturnType<typeof parseWfApi> | null = null;
    try {
      const data = await fetchApiData("electric_wf1");
      if (data) {
        wf1Parsed = parseWfApi(data, ts);
      }
    } catch (err: any) {
      logger.warn(`Incoming WF1 polling failed: ${err.message}`);
    }

    if (!wf1Parsed) {
      wf1Parsed = getNullWfRecord(ts);
      broadcastLiveTelemetryOffline("Feeder_WF1_PM5560");
    } else {
      broadcastLiveTelemetry("Feeder_WF1_PM5560", wf1Parsed);
    }

    if (isNewMinute) {
      await insertWfMinuteTelemetry("electric_wf1_telemetry_minute", wf1Parsed, minuteTs);
    }

    lastWf1Rec = {
      t_stamp: ts,
      group_id: "ew23",
      pm_id: "PM411",
      status: wf1Parsed.status_pm5500 !== null ? !!wf1Parsed.status_pm5500 : false,
      volt_ab: wf1Parsed.volt_ab,
      volt_bc: wf1Parsed.volt_bc,
      volt_ca: wf1Parsed.volt_ca,
      volt_ll: wf1Parsed.volt_ll,
      current_a: wf1Parsed.current_a,
      current_b: wf1Parsed.current_b,
      current_c: wf1Parsed.current_c,
      frequency: wf1Parsed.frequency,
      active_power_total: wf1Parsed.active_power_total,
      reactive_power_total: wf1Parsed.reactive_power_total,
      apparent_power_total: wf1Parsed.apparent_power_total,
      power_factor: wf1Parsed.power_factor,
      voltage_unbalance: wf1Parsed.voltage_unbalance,
      current_unbalance: wf1Parsed.current_unbalance,
      thd_volt_a: wf1Parsed.thd_volt_a,
      thd_volt_b: wf1Parsed.thd_volt_b,
      thd_volt_c: wf1Parsed.thd_volt_c,
      thd_current_a: wf1Parsed.thd_current_a,
      thd_current_b: wf1Parsed.thd_current_b,
      thd_current_c: wf1Parsed.thd_current_c,
      active_energy: wf1Parsed.active_energy
    };

    // Fetch and store WF2
    let wf2Parsed: ReturnType<typeof parseWfApi> | null = null;
    try {
      const data = await fetchApiData("electric_wf2");
      if (data) {
        wf2Parsed = parseWfApi(data, ts);
      }
    } catch (err: any) {
      logger.warn(`Incoming WF2 polling failed: ${err.message}`);
    }

    if (!wf2Parsed) {
      wf2Parsed = getNullWfRecord(ts);
      broadcastLiveTelemetryOffline("Feeder_WF2_PM5500");
    } else {
      broadcastLiveTelemetry("Feeder_WF2_PM5500", wf2Parsed);
    }

    if (isNewMinute) {
      await insertWfMinuteTelemetry("electric_wf2_telemetry_minute", wf2Parsed, minuteTs);
    }

    lastWf2Rec = {
      t_stamp: ts,
      group_id: "ew23",
      pm_id: "PM412",
      status: wf2Parsed.status_pm5500 !== null ? !!wf2Parsed.status_pm5500 : false,
      volt_ab: wf2Parsed.volt_ab,
      volt_bc: wf2Parsed.volt_bc,
      volt_ca: wf2Parsed.volt_ca,
      volt_ll: wf2Parsed.volt_ll,
      current_a: wf2Parsed.current_a,
      current_b: wf2Parsed.current_b,
      current_c: wf2Parsed.current_c,
      frequency: wf2Parsed.frequency,
      active_power_total: wf2Parsed.active_power_total,
      reactive_power_total: wf2Parsed.reactive_power_total,
      apparent_power_total: wf2Parsed.apparent_power_total,
      power_factor: wf2Parsed.power_factor,
      voltage_unbalance: wf2Parsed.voltage_unbalance,
      current_unbalance: wf2Parsed.current_unbalance,
      thd_volt_a: wf2Parsed.thd_volt_a,
      thd_volt_b: wf2Parsed.thd_volt_b,
      thd_volt_c: wf2Parsed.thd_volt_c,
      thd_current_a: wf2Parsed.thd_current_a,
      thd_current_b: wf2Parsed.thd_current_b,
      thd_current_c: wf2Parsed.thd_current_c,
      active_energy: wf2Parsed.active_energy
    };

    // Fetch and store Solar Panel (PLTS)
    let pltsParsed: SolarLiveState;
    try {
      const data = await fetchApiData("electric_plts");
      if (data) {
        pltsParsed = parseSolarApi(data, ts);
      } else {
        throw new Error("No data");
      }
    } catch (err: any) {
      logger.warn(`Incoming PLTS polling failed: ${err.message}`);
      pltsParsed = {
        t_stamp: ts,
        poi1: { status: false, totalKwh: 0, totalKvarh: 0, frequency: 0, voltAb: 0, voltBc: 0, voltCa: 0, voltAn: 0, voltBn: 0, voltCn: 0 },
        poi2: { status: false, totalKwh: 0, totalKvarh: 0, frequency: 0, voltAb: 0, voltBc: 0, voltCa: 0, voltAn: 0, voltBn: 0, voltCn: 0 },
        totalKwh: 0
      };
    }

    setLatestSolarLiveState(pltsParsed);
    const io = getSocketServer();
    if (io) {
      io.emit("electricity:solar_live", pltsParsed);
      io.emit("solar:live_update", pltsParsed);
    }

    // Check for top-of-hour recording to solar_telemetry (e.g. 10:00:00, 11:00:00)
    const wibTime = new Date(ts.getTime() + 7 * 60 * 60 * 1000);
    const padZero = (n: number) => String(n).padStart(2, "0");
    const currentHourStr = `${wibTime.getUTCFullYear()}-${padZero(wibTime.getUTCMonth() + 1)}-${padZero(wibTime.getUTCDate())} ${padZero(wibTime.getUTCHours())}:00:00`;
    if (currentHourStr !== lastSolarHourStr) {
      lastSolarHourStr = currentHourStr;
      const pool = getPostgresPool();
      const p1Kwh = pltsParsed.poi1.status ? pltsParsed.poi1.totalKwh : null;
      const p2Kwh = pltsParsed.poi2.status ? pltsParsed.poi2.totalKwh : null;
      await insertSolarHourlyTelemetry(pool, currentHourStr, p1Kwh, p2Kwh);
      if (io) {
        io.emit("electricity:update");
        io.emit("solar:update");
      }
    }

    // Fetch and store EW23 (Sub-distribution Power Meters)
    let ew23Parsed: ElectricPmRecord[] = [];
    try {
      const data = await fetchApiData("electric_ew23");
      if (data) {
        ew23Parsed = parseEwApi(data, ts, "ew23");
      }
    } catch (err: any) {
      logger.warn(`Incoming EW23 polling failed: ${err.message}`);
    }

    if (ew23Parsed.length === 0) {
      ew23Parsed = getNullEwRecords(ts, "ew23");
    }

    // Ensure the 3 incoming cubicles are merged into the list if not already present in the EW23 JSON payload
    const existing = new Set(ew23Parsed.map(p => p.pm_id.toUpperCase()));
    if (!existing.has("PM410") && !existing.has("PM8000") && lastPlnRec) {
      ew23Parsed.push(lastPlnRec);
    }
    if (!existing.has("PM411") && !existing.has("PM5560") && !existing.has("PM5560_WF1") && lastWf1Rec) {
      ew23Parsed.push(lastWf1Rec);
    }
    if (!existing.has("PM412") && !existing.has("PM5560_WF2") && !existing.has("PM5500") && lastWf2Rec) {
      ew23Parsed.push(lastWf2Rec);
    }

    if (isNewMinute) {
      await insertPmMinuteTelemetryBatch(ew23Parsed, minuteTs);
    }
    broadcastEwLiveTelemetry("ew23", ew23Parsed);

    // Fetch and store EW21
    let ew21Parsed: ElectricPmRecord[] = [];
    try {
      const data = await fetchApiData("electric_ew21");
      if (data) {
        ew21Parsed = parseEwApi(data, ts, "ew21");
      }
    } catch (err: any) {
      logger.warn(`Incoming EW21 polling failed: ${err.message}`);
    }

    if (ew21Parsed.length === 0) {
      ew21Parsed = getNullEwRecords(ts, "ew21");
    }

    if (isNewMinute) {
      await insertPmMinuteTelemetryBatch(ew21Parsed, minuteTs);
    }
    broadcastEwLiveTelemetry("ew21", ew21Parsed);

    // Fetch and store EW22
    let ew22Parsed: ElectricPmRecord[] = [];
    try {
      const data = await fetchApiData("electric_ew22");
      if (data) {
        ew22Parsed = parseEwApi(data, ts, "ew22");
      }
    } catch (err: any) {
      logger.warn(`Incoming EW22 polling failed: ${err.message}`);
    }

    if (ew22Parsed.length === 0) {
      ew22Parsed = getNullEwRecords(ts, "ew22");
    }

    if (isNewMinute) {
      await insertPmMinuteTelemetryBatch(ew22Parsed, minuteTs);
    }
    broadcastEwLiveTelemetry("ew22", ew22Parsed);

    // Fetch and store PLTS (Solar POI 1 & POI 2)
    try {
      const data = await fetchApiData("electric_plts");
      if (data) {
        const parsed = parsePltsApiRecords(data, ts);
        if (isNewMinute) {
          await insertPltsMinuteTelemetry(parsed, minuteTs);
        }
        const poi1 = parsed.find(p => p.poi_id === "POI_1");
        const poi2 = parsed.find(p => p.poi_id === "POI_2");
        if (poi1) broadcastLiveTelemetry("Solar_POI1", poi1);
        if (poi2) broadcastLiveTelemetry("Solar_POI2", poi2);

        const io = getSocketServer();
        if (io) {
          io.emit("electricity:plts_live", { data: parsed, t_stamp: ts });
        }
      }
    } catch (err: any) {
      logger.warn(`Incoming PLTS polling failed: ${err.message}`);
    }

    // Fetch and store HVAC Retained Sample PLCs (PLC1_AHU1_Utl, PLC2_AHU2, PLC2_AHU3)
    try {
      const [plc1Data, plc2_2Data, plc2_3Data] = await Promise.all([
        fetchApiData("hvac_retain_plc1").catch(() => null),
        fetchApiData("hvac_retain_plc2_2").catch(() => null),
        fetchApiData("hvac_retain_plc2_3").catch(() => null),
      ]);

      if (plc1Data || plc2_2Data || plc2_3Data) {
        const retainLive: HvacRetainLiveState = {
          PLC1_AHU1_Utl: {
            ...latestHvacRetainLiveState.PLC1_AHU1_Utl,
            ...(plc1Data?.PLC1_AHU1_Utl || (plc1Data as any) || {})
          },
          PLC2_AHU2: {
            ...latestHvacRetainLiveState.PLC2_AHU2,
            ...(plc2_2Data?.PLC2_AHU2 || (plc2_2Data as any) || {})
          },
          PLC2_AHU3: {
            ...latestHvacRetainLiveState.PLC2_AHU3,
            ...(plc2_3Data?.PLC2_AHU3 || (plc2_3Data as any) || {})
          },
          t_stamp: ts
        };
        latestHvacRetainLiveState = retainLive;

        const io = getSocketServer();
        if (io) {
          io.emit("hvac:retain_live", retainLive);
          io.emit("hvac:live_update", retainLive);
        }
      }
    } catch (err: any) {
      logger.warn(`HVAC Retained Sample polling failed: ${err.message}`);
    }

    if (isNewMinute) {
      const io = getSocketServer();
      if (io) {
        io.emit("historian:minute_update", {
          unitId: "electricity",
          t_stamp: currentMinuteStr
        });
      }
    }

    // Poll every 1000ms (1 second) for real-time WebSocket updates
    if (incomingElectricityPollingInterval) {
      incomingElectricityPollingInterval = setTimeout(poll, 1000) as any;
    }
  };

  incomingElectricityPollingInterval = setTimeout(poll, 100) as any;
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
  const pool = getPostgresPool();
  try {
    // 1. Rollup completed hours from electric_pln_telemetry_minute -> electric_pln_telemetry & electricity_telemetry
    const plnBuckets = await pool.query(`
      SELECT 
        to_char(date_trunc('hour', t_stamp), 'YYYY-MM-DD HH24:00:00') as hour_bucket_str
      FROM electric_pln_telemetry_minute
      WHERE t_stamp < date_trunc('hour', NOW() AT TIME ZONE 'Asia/Jakarta')
      GROUP BY hour_bucket_str
      ORDER BY hour_bucket_str ASC;
    `);

    for (const b of plnBuckets.rows) {
      const hourStartStr = b.hour_bucket_str;
      if (!hourStartStr) continue;

      const client = await pool.connect();
      try {
        await client.query("BEGIN");
        const aggRes = await client.query(`
          SELECT 
            AVG(volt_ab) as volt_ab,
            AVG(volt_bc) as volt_bc,
            AVG(volt_ca) as volt_ca,
            AVG(volt_ll) as volt_ll,
            AVG(current_a) as current_a,
            AVG(current_b) as current_b,
            AVG(current_c) as current_c,
            AVG(frequency) as frequency,
            AVG(active_power) as active_power,
            AVG(reactive_power_total) as reactive_power_total,
            AVG(apparent_power_total) as apparent_power_total,
            AVG(power_factor) as power_factor,
            AVG(voltage_unbalance) as voltage_unbalance,
            AVG(current_unbalance) as current_unbalance,
            AVG(thd_volt_a) as thd_volt_a,
            AVG(thd_volt_b) as thd_volt_b,
            AVG(thd_volt_c) as thd_volt_c,
            AVG(thd_current_a) as thd_current_a,
            AVG(thd_current_b) as thd_current_b,
            AVG(thd_current_c) as thd_current_c,
            MAX(active_energy) as active_energy,
            bool_or(status_pm8000) as status_pm8000
          FROM electric_pln_telemetry_minute
          WHERE t_stamp >= $1 AND t_stamp < $1::timestamp + INTERVAL '1 hour'
        `, [hourStartStr]);

        const r = aggRes.rows[0];
        if (r) {
          await client.query(`DELETE FROM electric_pln_telemetry WHERE t_stamp = $1`, [hourStartStr]);
          await client.query(`
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
            hourStartStr, r.status_pm8000 ?? false, r.volt_ab, r.volt_bc, r.volt_ca, r.volt_ll,
            r.current_a, r.current_b, r.current_c, r.frequency, r.active_power,
            r.reactive_power_total, r.apparent_power_total, r.power_factor,
            r.voltage_unbalance, r.current_unbalance, r.thd_volt_a, r.thd_volt_b, r.thd_volt_c,
            r.thd_current_a, r.thd_current_b, r.thd_current_c, r.active_energy
          ]);

          // Sync to electricity_telemetry for dashboard overview (consistently insert even if active_energy is null)
          await client.query(`DELETE FROM electricity_telemetry WHERE t_stamp = $1 AND id_device = $2`, [hourStartStr, "Cubicle_PLN_PM8000"]);
          await client.query(`
            INSERT INTO electricity_telemetry (t_stamp, electricity_kwh, id_device)
            VALUES ($1, $2, $3)
          `, [hourStartStr, r.active_energy ?? null, "Cubicle_PLN_PM8000"]);
        }

        // Delete minute records from buffer
        await client.query(`
          DELETE FROM electric_pln_telemetry_minute
          WHERE t_stamp >= $1 AND t_stamp < $1::timestamp + INTERVAL '1 hour'
        `, [hourStartStr]);

        await client.query("COMMIT");
      } catch (err: any) {
        await client.query("ROLLBACK");
        logger.error({ err: err.message, hour: hourStartStr }, "Failed to roll up PLN hourly telemetry");
      } finally {
        client.release();
      }
    }

    // 2. Rollup completed hours from electric_wf1_telemetry_minute -> electric_wf1_telemetry
    const wf1Buckets = await pool.query(`
      SELECT 
        to_char(date_trunc('hour', t_stamp), 'YYYY-MM-DD HH24:00:00') as hour_bucket_str
      FROM electric_wf1_telemetry_minute
      WHERE t_stamp < date_trunc('hour', NOW() AT TIME ZONE 'Asia/Jakarta')
      GROUP BY hour_bucket_str
      ORDER BY hour_bucket_str ASC;
    `);

    for (const b of wf1Buckets.rows) {
      const hourStartStr = b.hour_bucket_str;
      if (!hourStartStr) continue;

      const client = await pool.connect();
      try {
        await client.query("BEGIN");
        const aggRes = await client.query(`
          SELECT 
            AVG(volt_ab) as volt_ab,
            AVG(volt_bc) as volt_bc,
            AVG(volt_ca) as volt_ca,
            AVG(volt_ll) as volt_ll,
            AVG(current_a) as current_a,
            AVG(current_b) as current_b,
            AVG(current_c) as current_c,
            AVG(frequency) as frequency,
            AVG(active_power_total) as active_power_total,
            AVG(reactive_power_total) as reactive_power_total,
            AVG(apparent_power_total) as apparent_power_total,
            AVG(power_factor) as power_factor,
            AVG(voltage_unbalance) as voltage_unbalance,
            AVG(current_unbalance) as current_unbalance,
            AVG(thd_volt_a) as thd_volt_a,
            AVG(thd_volt_b) as thd_volt_b,
            AVG(thd_volt_c) as thd_volt_c,
            AVG(thd_current_a) as thd_current_a,
            AVG(thd_current_b) as thd_current_b,
            AVG(thd_current_c) as thd_current_c,
            MAX(active_energy) as active_energy,
            bool_or(status_pm5500) as status_pm5500
          FROM electric_wf1_telemetry_minute
          WHERE t_stamp >= $1 AND t_stamp < $1::timestamp + INTERVAL '1 hour'
        `, [hourStartStr]);

        const r = aggRes.rows[0];
        if (r) {
          await client.query(`DELETE FROM electric_wf1_telemetry WHERE t_stamp = $1`, [hourStartStr]);
          await client.query(`
            INSERT INTO electric_wf1_telemetry (
              t_stamp, status_pm5500, volt_ab, volt_bc, volt_ca, volt_ll,
              current_a, current_b, current_c, frequency, active_power_total,
              reactive_power_total, apparent_power_total, power_factor,
              voltage_unbalance, current_unbalance, thd_volt_a, thd_volt_b, thd_volt_c,
              thd_current_a, thd_current_b, thd_current_c, active_energy
            ) VALUES (
              $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23
            )
          `, [
            hourStartStr, r.status_pm5500 ?? false, r.volt_ab, r.volt_bc, r.volt_ca, r.volt_ll,
            r.current_a, r.current_b, r.current_c, r.frequency, r.active_power_total,
            r.reactive_power_total, r.apparent_power_total, r.power_factor,
            r.voltage_unbalance, r.current_unbalance, r.thd_volt_a, r.thd_volt_b, r.thd_volt_c,
            r.thd_current_a, r.thd_current_b, r.thd_current_c, r.active_energy
          ]);
        }

        await client.query(`
          DELETE FROM electric_wf1_telemetry_minute
          WHERE t_stamp >= $1 AND t_stamp < $1::timestamp + INTERVAL '1 hour'
        `, [hourStartStr]);

        await client.query("COMMIT");
      } catch (err: any) {
        await client.query("ROLLBACK");
        logger.error({ err: err.message, hour: hourStartStr }, "Failed to roll up WF1 hourly telemetry");
      } finally {
        client.release();
      }
    }

    // 3. Rollup completed hours from electric_wf2_telemetry_minute -> electric_wf2_telemetry
    const wf2Buckets = await pool.query(`
      SELECT 
        to_char(date_trunc('hour', t_stamp), 'YYYY-MM-DD HH24:00:00') as hour_bucket_str
      FROM electric_wf2_telemetry_minute
      WHERE t_stamp < date_trunc('hour', NOW() AT TIME ZONE 'Asia/Jakarta')
      GROUP BY hour_bucket_str
      ORDER BY hour_bucket_str ASC;
    `);

    for (const b of wf2Buckets.rows) {
      const hourStartStr = b.hour_bucket_str;
      if (!hourStartStr) continue;

      const client = await pool.connect();
      try {
        await client.query("BEGIN");
        const aggRes = await client.query(`
          SELECT 
            AVG(volt_ab) as volt_ab,
            AVG(volt_bc) as volt_bc,
            AVG(volt_ca) as volt_ca,
            AVG(volt_ll) as volt_ll,
            AVG(current_a) as current_a,
            AVG(current_b) as current_b,
            AVG(current_c) as current_c,
            AVG(frequency) as frequency,
            AVG(active_power_total) as active_power_total,
            AVG(reactive_power_total) as reactive_power_total,
            AVG(apparent_power_total) as apparent_power_total,
            AVG(power_factor) as power_factor,
            AVG(voltage_unbalance) as voltage_unbalance,
            AVG(current_unbalance) as current_unbalance,
            AVG(thd_volt_a) as thd_volt_a,
            AVG(thd_volt_b) as thd_volt_b,
            AVG(thd_volt_c) as thd_volt_c,
            AVG(thd_current_a) as thd_current_a,
            AVG(thd_current_b) as thd_current_b,
            AVG(thd_current_c) as thd_current_c,
            MAX(active_energy) as active_energy,
            bool_or(status_pm5500) as status_pm5500
          FROM electric_wf2_telemetry_minute
          WHERE t_stamp >= $1 AND t_stamp < $1::timestamp + INTERVAL '1 hour'
        `, [hourStartStr]);

        const r = aggRes.rows[0];
        if (r) {
          await client.query(`DELETE FROM electric_wf2_telemetry WHERE t_stamp = $1`, [hourStartStr]);
          await client.query(`
            INSERT INTO electric_wf2_telemetry (
              t_stamp, status_pm5500, volt_ab, volt_bc, volt_ca, volt_ll,
              current_a, current_b, current_c, frequency, active_power_total,
              reactive_power_total, apparent_power_total, power_factor,
              voltage_unbalance, current_unbalance, thd_volt_a, thd_volt_b, thd_volt_c,
              thd_current_a, thd_current_b, thd_current_c, active_energy
            ) VALUES (
              $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23
            )
          `, [
            hourStartStr, r.status_pm5500 ?? false, r.volt_ab, r.volt_bc, r.volt_ca, r.volt_ll,
            r.current_a, r.current_b, r.current_c, r.frequency, r.active_power_total,
            r.reactive_power_total, r.apparent_power_total, r.power_factor,
            r.voltage_unbalance, r.current_unbalance, r.thd_volt_a, r.thd_volt_b, r.thd_volt_c,
            r.thd_current_a, r.thd_current_b, r.thd_current_c, r.active_energy
          ]);
        }

        await client.query(`
          DELETE FROM electric_wf2_telemetry_minute
          WHERE t_stamp >= $1 AND t_stamp < $1::timestamp + INTERVAL '1 hour'
        `, [hourStartStr]);

        await client.query("COMMIT");
      } catch (err: any) {
        await client.query("ROLLBACK");
        logger.error({ err: err.message, hour: hourStartStr }, "Failed to roll up WF2 hourly telemetry");
      } finally {
        client.release();
      }
    }

    // 4. Rollup completed hours from electric_pm_telemetry_minute -> electric_pm_telemetry
    const pmBuckets = await pool.query(`
      SELECT 
        to_char(date_trunc('hour', t_stamp), 'YYYY-MM-DD HH24:00:00') as hour_bucket_str
      FROM electric_pm_telemetry_minute
      WHERE t_stamp < date_trunc('hour', NOW() AT TIME ZONE 'Asia/Jakarta')
      GROUP BY hour_bucket_str
      ORDER BY hour_bucket_str ASC;
    `);

    for (const b of pmBuckets.rows) {
      const hourStartStr = b.hour_bucket_str;
      if (!hourStartStr) continue;

      const client = await pool.connect();
      try {
        await client.query("BEGIN");
        const aggRes = await client.query(`
          SELECT 
            group_id,
            pm_id,
            bool_or(status) as status,
            AVG(volt_ab) as volt_ab,
            AVG(volt_bc) as volt_bc,
            AVG(volt_ca) as volt_ca,
            AVG(volt_ll) as volt_ll,
            AVG(current_a) as current_a,
            AVG(current_b) as current_b,
            AVG(current_c) as current_c,
            AVG(frequency) as frequency,
            AVG(active_power_total) as active_power_total,
            AVG(reactive_power_total) as reactive_power_total,
            AVG(apparent_power_total) as apparent_power_total,
            AVG(power_factor) as power_factor,
            AVG(voltage_unbalance) as voltage_unbalance,
            AVG(current_unbalance) as current_unbalance,
            AVG(thd_volt_a) as thd_volt_a,
            AVG(thd_volt_b) as thd_volt_b,
            AVG(thd_volt_c) as thd_volt_c,
            AVG(thd_current_a) as thd_current_a,
            AVG(thd_current_b) as thd_current_b,
            AVG(thd_current_c) as thd_current_c,
            MAX(active_energy) as active_energy
          FROM electric_pm_telemetry_minute
          WHERE t_stamp >= $1 AND t_stamp < $1::timestamp + INTERVAL '1 hour'
          GROUP BY group_id, pm_id
        `, [hourStartStr]);

        for (const r of aggRes.rows) {
          await client.query(`DELETE FROM electric_pm_telemetry WHERE t_stamp = $1 AND group_id = $2 AND pm_id = $3`, [hourStartStr, r.group_id, r.pm_id]);
          await client.query(`
            INSERT INTO electric_pm_telemetry (
              t_stamp, group_id, pm_id, status, volt_ab, volt_bc, volt_ca, volt_ll,
              current_a, current_b, current_c, frequency, active_power_total,
              reactive_power_total, apparent_power_total, power_factor,
              voltage_unbalance, current_unbalance, thd_volt_a, thd_volt_b, thd_volt_c,
              thd_current_a, thd_current_b, thd_current_c, active_energy
            ) VALUES (
              $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25
            )
          `, [
            hourStartStr, r.group_id, r.pm_id, r.status, r.volt_ab, r.volt_bc, r.volt_ca, r.volt_ll,
            r.current_a, r.current_b, r.current_c, r.frequency, r.active_power_total,
            r.reactive_power_total, r.apparent_power_total, r.power_factor,
            r.voltage_unbalance, r.current_unbalance, r.thd_volt_a, r.thd_volt_b, r.thd_volt_c,
            r.thd_current_a, r.thd_current_b, r.thd_current_c, r.active_energy
          ]);
        }

        await client.query(`
          DELETE FROM electric_pm_telemetry_minute
          WHERE t_stamp >= $1 AND t_stamp < $1::timestamp + INTERVAL '1 hour'
        `, [hourStartStr]);

        await client.query("COMMIT");
      } catch (err: any) {
        await client.query("ROLLBACK");
        logger.error({ err: err.message, hour: hourStartStr }, "Failed to roll up PM hourly telemetry");
      } finally {
        client.release();
      }
    }

    // 5. Rollup completed hours from electric_plts_telemetry_minute -> electric_plts_telemetry
    const pltsBuckets = await pool.query(`
      SELECT 
        to_char(date_trunc('hour', t_stamp), 'YYYY-MM-DD HH24:00:00') as hour_bucket_str
      FROM electric_plts_telemetry_minute
      WHERE t_stamp < date_trunc('hour', NOW() AT TIME ZONE 'Asia/Jakarta')
      GROUP BY hour_bucket_str
      ORDER BY hour_bucket_str ASC;
    `);

    for (const b of pltsBuckets.rows) {
      const hourStartStr = b.hour_bucket_str;
      if (!hourStartStr) continue;

      const client = await pool.connect();
      try {
        await client.query("BEGIN");
        const aggRes = await client.query(`
          SELECT 
            poi_id,
            bool_or(status) as status,
            AVG(volt_ab) as volt_ab,
            AVG(volt_bc) as volt_bc,
            AVG(volt_ca) as volt_ca,
            AVG(volt_an) as volt_an,
            AVG(volt_bn) as volt_bn,
            AVG(volt_cn) as volt_cn,
            AVG(frequency) as frequency,
            AVG(active_power) as active_power,
            MAX(total_kwh) as total_kwh,
            MAX(total_kvarh) as total_kvarh
          FROM electric_plts_telemetry_minute
          WHERE t_stamp >= $1 AND t_stamp < $1::timestamp + INTERVAL '1 hour'
          GROUP BY poi_id
        `, [hourStartStr]);

        for (const r of aggRes.rows) {
          await client.query(`DELETE FROM electric_plts_telemetry WHERE t_stamp = $1 AND poi_id = $2`, [hourStartStr, r.poi_id]);
          await client.query(`
            INSERT INTO electric_plts_telemetry (
              t_stamp, poi_id, status, volt_ab, volt_bc, volt_ca, volt_an, volt_bn, volt_cn, frequency, active_power, total_kwh, total_kvarh
            ) VALUES (
              $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13
            )
          `, [
            hourStartStr, r.poi_id, r.status, r.volt_ab, r.volt_bc, r.volt_ca, r.volt_an, r.volt_bn, r.volt_cn, r.frequency, r.active_power, r.total_kwh, r.total_kvarh
          ]);
        }

        await client.query(`
          DELETE FROM electric_plts_telemetry_minute
          WHERE t_stamp >= $1 AND t_stamp < $1::timestamp + INTERVAL '1 hour'
        `, [hourStartStr]);

        await client.query("COMMIT");
      } catch (err: any) {
        await client.query("ROLLBACK");
        logger.error({ err: err.message, hour: hourStartStr }, "Failed to roll up PLTS hourly telemetry");
      } finally {
        client.release();
      }
    }

    // 6. Monthly Rollup
    const now = new Date();
    const yearMonth = `${now.getFullYear()}-${(now.getMonth() + 1).toString().padStart(2, "0")}`;
    await rollupMonthlyForMonth(yearMonth);

    const prevMonthDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const prevYearMonth = `${prevMonthDate.getFullYear()}-${(prevMonthDate.getMonth() + 1).toString().padStart(2, "0")}`;
    await rollupMonthlyForMonth(prevYearMonth);

    logger.info("Electricity hourly rollup and monthly rollup completed successfully");
  } catch (err: any) {
    logger.error({ err: err.message }, "Electricity hourly rollup job failed");
  }
};

export const runCoolingTowerRollupAndCleanup = async () => {
  const pool = getPostgresPool();
  try {
    // 1. Find all completed hours in the past from the temporary table (cooling_tower_telemetry_minute)
    const findRes = await pool.query(`
      SELECT 
        to_char(date_trunc('hour', t_stamp), 'YYYY-MM-DD HH24:00:00') as hour_bucket_str
      FROM cooling_tower_telemetry_minute
      WHERE t_stamp < date_trunc('hour', NOW() AT TIME ZONE 'Asia/Jakarta')
      GROUP BY hour_bucket_str
      ORDER BY hour_bucket_str ASC;
    `);

    const buckets = findRes.rows;
    if (buckets.length > 0) {
      logger.info(`[CoolingTowerRollup] Found ${buckets.length} completed hour buckets in temporary table to roll up to main table`);

      for (const b of buckets) {
        const hourStartStr = b.hour_bucket_str;
        if (!hourStartStr) {
          continue;
        }

        const client = await pool.connect();
        try {
          await client.query("BEGIN");

          // 1. Calculate averages for this hour from the temporary table
          const avgRes = await client.query(`
            SELECT 
              AVG(return_temp) as avg_return,
              AVG(supply_temp) as avg_supply,
              AVG(st3_return_temp) as avg_st3,
              AVG(flow) as avg_flow,
              AVG(tds) as avg_tds,
              AVG(ph) as avg_ph,
              AVG(humidity) as avg_humidity,
              AVG(ambient_temp) as avg_ambient_temp,
              AVG(makeup_vol) as avg_makeup_vol,
              AVG(makeup_tds) as avg_makeup_tds,
              AVG(blowdown_vol) as avg_blowdown_vol,
              AVG(makeup_ph) as avg_makeup_ph
            FROM cooling_tower_telemetry_minute
            WHERE t_stamp >= $1 AND t_stamp < $1::timestamp + INTERVAL '1 hour'
          `, [hourStartStr]);

          const avgs = avgRes.rows[0];
          const avgReturn = avgs && avgs.avg_return !== null ? Number(Number(avgs.avg_return).toFixed(3)) : null;
          const avgSupply = avgs && avgs.avg_supply !== null ? Number(Number(avgs.avg_supply).toFixed(3)) : null;
          const avgSt3 = avgs && avgs.avg_st3 !== null ? Number(Number(avgs.avg_st3).toFixed(3)) : null;
          const avgFlow = avgs && avgs.avg_flow !== null ? Number(Number(avgs.avg_flow).toFixed(3)) : null;
          const avgTds = avgs && avgs.avg_tds !== null ? Number(Number(avgs.avg_tds).toFixed(3)) : null;
          const avgPh = avgs && avgs.avg_ph !== null ? Number(Number(avgs.avg_ph).toFixed(3)) : null;
          const avgHumidity = avgs && avgs.avg_humidity !== null ? Number(Number(avgs.avg_humidity).toFixed(3)) : null;
          const avgAmbientTemp = avgs && avgs.avg_ambient_temp !== null ? Number(Number(avgs.avg_ambient_temp).toFixed(3)) : null;
          const avgMakeupVol = avgs && avgs.avg_makeup_vol !== null ? Number(Number(avgs.avg_makeup_vol).toFixed(3)) : null;
          const avgMakeupTds = avgs && avgs.avg_makeup_tds !== null ? Number(Number(avgs.avg_makeup_tds).toFixed(3)) : null;
          const avgBlowdownVol = avgs && avgs.avg_blowdown_vol !== null ? Number(Number(avgs.avg_blowdown_vol).toFixed(3)) : null;
          const avgMakeupPh = avgs && avgs.avg_makeup_ph !== null ? Number(Number(avgs.avg_makeup_ph).toFixed(3)) : null;

          // 2. Always update or insert hourly row
          if (avgs) {
            const existingRow = await client.query(`
              SELECT id FROM cooling_tower_telemetry
              WHERE t_stamp = $1 AND id_device = $2
            `, [hourStartStr, "cooling-water-1"]);

            if (existingRow.rows.length > 0) {
              await client.query(`
                UPDATE cooling_tower_telemetry
                SET return_temp = COALESCE($1, return_temp), 
                    supply_temp = COALESCE($2, supply_temp), 
                    st3_return_temp = COALESCE($3, st3_return_temp),
                    flow = COALESCE($4, flow),
                    tds = COALESCE($5, tds),
                    ph = COALESCE($6, ph),
                    humidity = COALESCE($7, humidity),
                    ambient_temp = COALESCE($8, ambient_temp),
                    makeup_vol = COALESCE($9, makeup_vol),
                    makeup_tds = COALESCE($10, makeup_tds),
                    blowdown_vol = COALESCE($11, blowdown_vol),
                    makeup_ph = COALESCE($12, makeup_ph)
                WHERE id = $13
              `, [
                avgReturn, avgSupply, avgSt3, avgFlow, avgTds, avgPh, avgHumidity,
                avgAmbientTemp, avgMakeupVol, avgMakeupTds, avgBlowdownVol, avgMakeupPh,
                existingRow.rows[0].id
              ]);
            } else {
              await client.query(`
                INSERT INTO cooling_tower_telemetry (
                  t_stamp, return_temp, supply_temp, st3_return_temp,
                  flow, tds, ph, humidity, ambient_temp, makeup_vol,
                  makeup_tds, blowdown_vol, makeup_ph, id_device
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
              `, [
                hourStartStr, avgReturn, avgSupply, avgSt3,
                avgFlow, avgTds, avgPh, avgHumidity, avgAmbientTemp, avgMakeupVol,
                avgMakeupTds, avgBlowdownVol, avgMakeupPh, "cooling-water-1"
              ]);
            }
          }

          // 3. Delete all raw minute rows in this hour range from temporary table
          await client.query(`
            DELETE FROM cooling_tower_telemetry_minute
            WHERE t_stamp >= $1 AND t_stamp < $1::timestamp + INTERVAL '1 hour'
          `, [hourStartStr]);

          await client.query("COMMIT");
          logger.info(`[CoolingTowerRollup] Successfully processed hour ${hourStartStr}: return=${avgReturn}, supply=${avgSupply}, st3=${avgSt3}`);
        } catch (err: any) {
          await client.query("ROLLBACK");
          logger.error({ err: err.message, hour: hourStartStr }, "Failed to roll up cooling tower hour");
        } finally {
          client.release();
        }
      }
    }

    // Also clean up any legacy duplicate rows in main table if present
    const legacyRes = await pool.query(`
      SELECT 
        to_char(date_trunc('hour', t_stamp), 'YYYY-MM-DD HH24:00:00') as hour_bucket_str
      FROM cooling_tower_telemetry
      WHERE t_stamp < date_trunc('hour', NOW() AT TIME ZONE 'Asia/Jakarta')
      GROUP BY hour_bucket_str
      HAVING COUNT(*) > 1;
    `);

    for (const b of legacyRes.rows) {
      const hourStartStr = b.hour_bucket_str;
      if (!hourStartStr) continue;

      const client = await pool.connect();
      try {
        await client.query("BEGIN");
        const avgRes = await client.query(`
          SELECT 
            AVG(return_temp) as avg_return,
            AVG(supply_temp) as avg_supply,
            AVG(st3_return_temp) as avg_st3
          FROM cooling_tower_telemetry
          WHERE t_stamp >= $1 AND t_stamp < $1::timestamp + INTERVAL '1 hour'
        `, [hourStartStr]);
        const avgs = avgRes.rows[0];
        const avgReturn = avgs && avgs.avg_return !== null ? Number(Number(avgs.avg_return).toFixed(3)) : null;
        const avgSupply = avgs && avgs.avg_supply !== null ? Number(Number(avgs.avg_supply).toFixed(3)) : null;
        const avgSt3 = avgs && avgs.avg_st3 !== null ? Number(Number(avgs.avg_st3).toFixed(3)) : null;

        await client.query(`
          DELETE FROM cooling_tower_telemetry
          WHERE t_stamp >= $1 AND t_stamp < $1::timestamp + INTERVAL '1 hour'
        `, [hourStartStr]);

        if (avgReturn !== null || avgSupply !== null || avgSt3 !== null) {
          await client.query(`
            INSERT INTO cooling_tower_telemetry (t_stamp, return_temp, supply_temp, st3_return_temp, id_device)
            VALUES ($1, $2, $3, $4, $5)
          `, [hourStartStr, avgReturn, avgSupply, avgSt3, "cooling-water-1"]);
        }
        await client.query("COMMIT");
      } catch (e: any) {
        await client.query("ROLLBACK");
      } finally {
        client.release();
      }
    }
  } catch (err: any) {
    logger.error({ err: err.message }, "Error during cooling tower rollup check");
  }
};


export const startPostgresPolling = () => {
  if (pollingInterval) return;

  const poll = async () => {
    try {
      const pool = getPostgresPool();
      const res = await pool.query(`
        SELECT GREATEST(
          (SELECT MAX(t_stamp) FROM electricity_telemetry),
          (SELECT MAX(t_stamp) FROM electric_pln_telemetry)
        ) AS max_ts;
      `);
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
  // Poll every 5 seconds to check for new records promptly
  pollingInterval = setInterval(poll, 5000);
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
  // Poll every 1 second for live power factor status
  pfPollingInterval = setInterval(poll, 1000);
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

let cachedCoolingConfigs: {
  tagToUrlMap: Record<string, string>;
  tagToJsonKeyMap: Record<string, string>;
  ts: number;
} | null = null;

let lastCoolingMinuteStr = "";

export const startCoolingTowerPolling = () => {
  if (coolingPollingInterval) return;

  const poll = async () => {
    try {
      const pool = getPostgresPool();
      const now = Date.now();
      
      let tagToUrlMap: Record<string, string> = {};
      let tagToJsonKeyMap: Record<string, string> = {};
      const defaultUrl = "http://10.3.164.3:8088/system/webdev/Utility_Dashboard/cooling3";

      // Cache configs for 60s to avoid querying PostgreSQL every poll tick
      if (cachedCoolingConfigs && now - cachedCoolingConfigs.ts < 60000) {
        tagToUrlMap = { ...cachedCoolingConfigs.tagToUrlMap };
        tagToJsonKeyMap = { ...cachedCoolingConfigs.tagToJsonKeyMap };
      } else {
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

          // Add default fallbacks for any keys not configured
          Object.keys(DEFAULT_TAG_KEY_TO_API_JSON_KEY).forEach((tagKey) => {
            if (tagToUrlMap[tagKey] === undefined) {
              tagToUrlMap[tagKey] = defaultUrl;
              tagToJsonKeyMap[tagKey] = DEFAULT_TAG_KEY_TO_API_JSON_KEY[tagKey];
            }
          });

          cachedCoolingConfigs = { tagToUrlMap, tagToJsonKeyMap, ts: now };
        } catch (e) {
          logger.warn("Failed to load custom API sources list from global_configs");
        }
      }

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

      // On the minute mark, record 1 snapshot into cooling_tower_telemetry_minute
      const currentMinuteStr = formatMinuteString(ts);
      const isNewMinute = currentMinuteStr !== lastCoolingMinuteStr;
      if (isNewMinute) {
        lastCoolingMinuteStr = currentMinuteStr;
        const minuteTs = new Date(currentMinuteStr);
        await pool.query(`
          INSERT INTO cooling_tower_telemetry_minute (
            t_stamp, id_device, return_temp, supply_temp, st3_return_temp,
            flow, tds, ph, humidity, ambient_temp, makeup_vol, makeup_tds, blowdown_vol,
            press_ct_p1, press_ct_p2, press_ct3_p11, scaled_level_tank_cooling3
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)
          ON CONFLICT (t_stamp, id_device) DO UPDATE SET
            return_temp = EXCLUDED.return_temp,
            supply_temp = EXCLUDED.supply_temp,
            st3_return_temp = EXCLUDED.st3_return_temp,
            flow = COALESCE(EXCLUDED.flow, cooling_tower_telemetry_minute.flow),
            tds = COALESCE(EXCLUDED.tds, cooling_tower_telemetry_minute.tds),
            ph = COALESCE(EXCLUDED.ph, cooling_tower_telemetry_minute.ph),
            humidity = COALESCE(EXCLUDED.humidity, cooling_tower_telemetry_minute.humidity),
            ambient_temp = COALESCE(EXCLUDED.ambient_temp, cooling_tower_telemetry_minute.ambient_temp),
            makeup_vol = COALESCE(EXCLUDED.makeup_vol, cooling_tower_telemetry_minute.makeup_vol),
            makeup_tds = COALESCE(EXCLUDED.makeup_tds, cooling_tower_telemetry_minute.makeup_tds),
            blowdown_vol = COALESCE(EXCLUDED.blowdown_vol, cooling_tower_telemetry_minute.blowdown_vol),
            press_ct_p1 = COALESCE(EXCLUDED.press_ct_p1, cooling_tower_telemetry_minute.press_ct_p1),
            press_ct_p2 = COALESCE(EXCLUDED.press_ct_p2, cooling_tower_telemetry_minute.press_ct_p2),
            press_ct3_p11 = COALESCE(EXCLUDED.press_ct3_p11, cooling_tower_telemetry_minute.press_ct3_p11),
            scaled_level_tank_cooling3 = COALESCE(EXCLUDED.scaled_level_tank_cooling3, cooling_tower_telemetry_minute.scaled_level_tank_cooling3)
        `, [
          minuteTs,
          "cooling-water-1",
          retVal ?? null,
          suppVal ?? null,
          getVal("cooling-water/st3_return_temp") ?? null,
          getVal("cooling-water/makeup_wtr_flow") ?? null,
          getVal("cooling-water/cooling_tank_tds") ?? null,
          getVal("cooling-water/cooling_tank_ph") ?? null,
          getVal("cooling-water/ambient_humidity") ?? null,
          getVal("cooling-water/ambient_temp") ?? null,
          getVal("cooling-water/makeup_wtr_vol") ?? null,
          getVal("cooling-water/makeup_wtr_tds") ?? null,
          getVal("cooling-water/blowdown_vol") ?? null,
          getVal("cooling-water/pressure_1") ?? null,
          getVal("cooling-water/pressure_2") ?? null,
          getVal("cooling-water/pressure_3") ?? null,
          getVal("cooling-water/basin_lvl") ?? null
        ]).catch((err) => {
          logger.warn({ err: err.message }, "Failed to insert minute cooling tower telemetry to postgres");
        });

        // Broadcast to WebSocket clients immediately when new minute data is recorded in DB
        if (io) {
          io.emit("historian:minute_update", {
            unitId: "cooling-water-1",
            t_stamp: currentMinuteStr,
            deviceId: "cooling-water-1"
          });
        }
      }

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
  // Poll every 2 seconds for real-time SCADA updates without overwhelming CPU
  coolingPollingInterval = setInterval(poll, 2000);
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
  // Poll every 10 seconds (water data comes in hourly, no need for faster)
  waterPollingInterval = setInterval(poll, 10000);
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
  // Poll every 10 seconds
  gasPollingInterval = setInterval(poll, 10000);
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
  runCoolingTowerRollupAndCleanup().catch((err) => {
    logger.error({ err }, "Initial cooling tower rollup/cleanup failed");
  });

  // Periodic cooling tower rollup (runs every 5 minutes to roll up completed hours)
  setInterval(() => {
    runCoolingTowerRollupAndCleanup().catch((err) => {
      logger.error({ err }, "Periodic cooling tower rollup/cleanup failed");
    });
  }, 5 * 60 * 1000);

  // Periodic electricity rollup (runs every 5 minutes to roll up completed hours)
  setInterval(() => {
    runElectricityRollupAndCleanup().catch((err) => {
      logger.error({ err }, "Periodic electricity rollup/cleanup failed");
    });
  }, 5 * 60 * 1000);

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
let cachedSensorRules: { rules: any[]; ts: number } | null = null;

export const evaluateSensorRulesForPoints = async (points: any[]) => {
  const pool = getPostgresPool();
  try {
    const now = Date.now();
    let rules: any[] = [];

    if (cachedSensorRules && now - cachedSensorRules.ts < 60000) {
      rules = cachedSensorRules.rules;
    } else {
      const rulesRes = await pool.query(
        `SELECT unit_id, tag_key, tag_name, low_limit, baseline, high_limit, unit, enable_alert, suppress_alert, direction 
         FROM sensor_rules
         WHERE unit_id LIKE 'cooling-water%'`
      );
      rules = rulesRes.rows;
      cachedSensorRules = { rules, ts: now };
    }

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
