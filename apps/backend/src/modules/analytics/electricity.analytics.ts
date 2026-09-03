import { getMongoDb } from "../../database/mongo";
import { getPostgresPool } from "../../database/postgres";
import { ELECTRICITY_RAW_COLLECTION, ELECTRICITY_1M_COLLECTION, ELECTRICITY_1H_COLLECTION, GLOBAL_CONFIG_COLLECTION } from "../../database/collections";
import { env } from "../../config/env.config";

export interface ElectricityTariff {
  validFrom: string; // "YYYY-MM"
  wbpRate: number;
  lwbpRate: number;
}

export function getTariffForDate(dateStr: string, tariffs: ElectricityTariff[]): { wbpRate: number, lwbpRate: number } {
  const sorted = [...tariffs].sort((a, b) => b.validFrom.localeCompare(a.validFrom));
  const recordMonth = dateStr.substring(0, 7); // "YYYY-MM"
  const match = sorted.find(t => t.validFrom <= recordMonth);
  if (match) {
    return { wbpRate: match.wbpRate, lwbpRate: match.lwbpRate };
  }
  if (sorted.length > 0) {
    return { wbpRate: sorted[sorted.length - 1].wbpRate, lwbpRate: sorted[sorted.length - 1].lwbpRate };
  }
  return { wbpRate: 1600, lwbpRate: 1112 };
}

function parsePowerFactor(data: any): number | null {
  if (typeof data === "number") {
    return Math.abs(data);
  }
  if (typeof data === "string") {
    const parsed = parseFloat(data);
    if (!isNaN(parsed)) return Math.abs(parsed);
  }
  if (Array.isArray(data)) {
    for (const item of data) {
      const val = parsePowerFactor(item);
      if (val !== null) return val;
    }
  }
  if (data && typeof data === "object") {
    const keys = ["power_factor", "powerFactor", "pf", "value", "val"];
    for (const k of keys) {
      if (data[k] !== undefined) {
        const val = parseFloat(data[k]);
        if (!isNaN(val)) return Math.abs(val);
      }
    }
    for (const k of Object.keys(data)) {
      if (k.toLowerCase().includes("power") || k.toLowerCase().includes("pf")) {
        const val = parseFloat(data[k]);
        if (!isNaN(val)) return Math.abs(val);
      }
    }
  }
  return null;
}

export let latestPowerFactorValue: number | null = null;
export let latestPowerFactorStatus: "connected" | "offline" = "offline";

export const setLatestPowerFactor = (val: number | null, status: "connected" | "offline") => {
  latestPowerFactorValue = val;
  latestPowerFactorStatus = status;
};

export async function fetchPowerFactor(): Promise<number | null> {
  if (!env.powerFactorApiUrl) return null;
  try {
    const headers: Record<string, string> = {
      "Cache-Control": "no-cache",
      "Pragma": "no-cache"
    };
    if (env.powerFactorApiUser && env.powerFactorApiPass) {
      headers["Authorization"] = "Basic " + Buffer.from(env.powerFactorApiUser + ":" + env.powerFactorApiPass).toString("base64");
    }
    
    let fetchUrl = env.powerFactorApiUrl;
    if (fetchUrl.includes("?")) {
      fetchUrl += `&_t=${Date.now()}`;
    } else {
      fetchUrl += `?_t=${Date.now()}`;
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 3000);
    
    const res = await fetch(fetchUrl, {
      headers,
      signal: controller.signal
    });
    clearTimeout(timeoutId);

    if (res.ok) {
      const text = await res.text();
      try {
        const data = JSON.parse(text);
        return parsePowerFactor(data);
      } catch {
        const parsed = parseFloat(text);
        if (!isNaN(parsed)) return Math.abs(parsed);
      }
    } else {
      console.warn(`Power Factor API request failed with status: ${res.status}`);
    }
  } catch (err: any) {
    console.warn(`Power Factor API request failed: ${err.message}`);
  }
  return null;
}

export interface ElectricityAnalyticsResult {
  summary: {
    todayKwh: number;
    todayCost: number;
    monthlyMwh: number;
    monthlyCost: number;
    yearlyMwh: number;
    co2Emitted: number; // tons
    totalKwh: number;
    wbpKwh: number;
    lwbpKwh: number;
    wbpCost: number;
    lwbpCost: number;
    totalCost: number;
    todayWbpKwh: number;
    todayLwbpKwh: number;
    monthlyWbpKwh: number;
    monthlyLwbpKwh: number;
    peakDemand: number;
    peakDemandTs: string | null;
    // Per-month summaries for period selector
    perMonthSummary: {
      month: string;
      totalKwh: number;
      wbpKwh: number;
      lwbpKwh: number;
      totalCost: number;
      wbpCost: number;
      lwbpCost: number;
      peakDemand: number;
      loadFactor: number;
    }[];
  };
  charts: {
    hourly: number[];
    hourlyWbp: number[];
    hourlyLwbp: number[];
    prevHourly: number[];
    daily: { day: string; value: number; wbp: number; lwbp: number }[];
    monthly: { month: string; value: number; wbp: number; lwbp: number }[];
    breakdown: { label: string; value: number; color: string }[];
    voltage24h?: { hour: string; value: number }[];
    activePower24h?: { hour: string; value: number }[];
  };
  pqData: {
    activePower: number;
    activePowerTs: string | null;
    reactivePower: number;
    apparentPower: number;
    pf: number | null;
    pfStatus: "connected" | "offline";
    freq: number;
    vUnb: number;
    iUnb: number;
    thdV: number;
    thdI: number;
    vll1: number;
    vll2: number;
    vll3: number;
    vln1: number;
    vln2: number;
    vln3: number;
    current1: number;
    current2: number;
    current3: number;
    vR: number;
    vS: number;
    vT: number;
    iR: number;
    iS: number;
    iT: number;
    thdV_R: number;
    thdV_S: number;
    thdV_T: number;
    thdI_R: number;
    thdI_S: number;
    thdI_T: number;
    voltage: number;
  };
}

// WIB Timezone helper (GMT+7)
function getWibHour(date: Date): number {
  const utcHour = date.getUTCHours();
  return (utcHour + 7) % 24;
}

function getWibDateString(date: Date): string {
  const wibTime = new Date(date.getTime() + 7 * 60 * 60 * 1000);
  const y = wibTime.getUTCFullYear();
  const m = String(wibTime.getUTCMonth() + 1).padStart(2, "0");
  const d = String(wibTime.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/** Get number of days in a given month (1-indexed) of a given year */
function daysInMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate();
}

export const getElectricityAnalytics = async (
  deviceId: string,
  fromStr?: string,
  toStr?: string,
  lwbpRate: number = 1112,
  wbpRate: number = 1600,
  year?: number
): Promise<ElectricityAnalyticsResult> => {
  const db = getMongoDb();
  const hourlyCollection = db.collection(ELECTRICITY_1H_COLLECTION);
  const telemetryCollection = db.collection(ELECTRICITY_RAW_COLLECTION);

  // If year is provided, use full year range; otherwise use from/to or default to current year
  const selectedYear = year || (fromStr ? parseInt(fromStr.split("-")[0]) : new Date().getFullYear());
  const from = fromStr
    ? new Date(fromStr.includes("T") ? fromStr : `${fromStr}T00:00:00.000+07:00`)
    : new Date(`${selectedYear}-01-01T00:00:00.000+07:00`);
  const to = toStr
    ? new Date(toStr.includes("T") ? toStr : `${toStr}T23:59:59.999+07:00`)
    : new Date(`${selectedYear}-12-31T23:59:59.999+07:00`);

  // Helper to format date string as YYYY-MM-DD HH:mm:ss for PostgreSQL timestamp without time zone
  const fromBase = fromStr ? `${fromStr} 00:00:00` : `${selectedYear}-01-01 00:00:00`;
  const toBase = toStr ? `${toStr} 23:59:59` : `${selectedYear}-12-31 23:59:59`;

  // Fetch baseline starting 2 hours before range and 2 hours after range for accurate hourly difference calculation
  const fromDate = new Date(`${fromStr || `${selectedYear}-01-01`}T00:00:00`);
  const baselineDate = new Date(fromDate.getTime() - 2 * 60 * 60 * 1000);
  const pad = (n: number) => String(n).padStart(2, "0");
  const fromQueryVal = `${baselineDate.getFullYear()}-${pad(baselineDate.getMonth() + 1)}-${pad(baselineDate.getDate())} ${pad(baselineDate.getHours())}:${pad(baselineDate.getMinutes())}:${pad(baselineDate.getSeconds())}`;
  
  const toDate = new Date(`${toStr || `${selectedYear}-12-31`}T23:59:59`);
  const toPlusDate = new Date(toDate.getTime() + 2 * 60 * 60 * 1000);
  const toQueryVal = `${toPlusDate.getFullYear()}-${pad(toPlusDate.getMonth() + 1)}-${pad(toPlusDate.getDate())} ${pad(toPlusDate.getHours())}:${pad(toPlusDate.getMinutes())}:${pad(toPlusDate.getSeconds())}`;

  // Select appropriate PostgreSQL table based on device
  let tableName = "electric_pln_telemetry";
  let energyCol = "active_energy";
  let poiFilter: string | null = null;

  const normDev = (deviceId || "").toLowerCase();
  if (normDev.includes("wf1")) {
    tableName = "electric_wf1_telemetry";
    energyCol = "active_energy";
  } else if (normDev.includes("wf2")) {
    tableName = "electric_wf2_telemetry";
    energyCol = "active_energy";
  } else if (normDev.includes("poi1") || normDev.includes("poi_1") || normDev.includes("solar_poi1")) {
    tableName = "electric_plts_telemetry";
    energyCol = "total_kwh";
    poiFilter = "POI_1";
  } else if (normDev.includes("poi2") || normDev.includes("poi_2") || normDev.includes("solar_poi2")) {
    tableName = "electric_plts_telemetry";
    energyCol = "total_kwh";
    poiFilter = "POI_2";
  } else if (normDev.includes("pln") || normDev.includes("pm8000")) {
    tableName = "electric_pln_telemetry";
    energyCol = "active_energy";
  } else {
    tableName = "electricity_telemetry";
    energyCol = "electricity_kwh";
  }

  // Always calculate using Active Energy Delivered of PLN (PM8000)
  const activeEnergyTag = "electricity/Cubicle_PLN_PM8000/active_energy";

  // 1. Fetch hourly values of active energy for the range
  let hourlyRecords: { ts_text: string; value: number }[] = [];
  const pool = getPostgresPool();
  try {
    if (poiFilter) {
      const res = await pool.query(`
        SELECT DISTINCT ON (date_trunc('hour', t_stamp)) 
          t_stamp::text AS ts_text, 
          ${energyCol}::float AS value
        FROM ${tableName}
        WHERE t_stamp >= $1 AND t_stamp <= $2 AND poi_id = $3
          AND ${energyCol} IS NOT NULL
        ORDER BY date_trunc('hour', t_stamp), t_stamp DESC
      `, [fromQueryVal, toQueryVal, poiFilter]);
      hourlyRecords = res.rows;

      // Append latest from minute table if available and querying today/future
      if (to >= new Date()) {
        try {
          const minRes = await pool.query(`
            SELECT t_stamp::text AS ts_text, ${energyCol}::float AS value
            FROM electric_plts_telemetry_minute
            WHERE poi_id = $1 AND ${energyCol} IS NOT NULL
            ORDER BY t_stamp DESC LIMIT 1
          `, [poiFilter]);
          if (minRes.rows.length > 0) {
            const latest = minRes.rows[0];
            const latestTs = latest.ts_text ? new Date(latest.ts_text) : new Date(0);
            const lastTsStr = hourlyRecords.length > 0 ? (hourlyRecords[hourlyRecords.length - 1].ts_text || "") : "";
            const lastTs = lastTsStr ? new Date(lastTsStr) : new Date(0);
            if (latestTs.getTime() > lastTs.getTime() + 60000 && latest.value > 0) {
              hourlyRecords.push(latest);
            }
          }
        } catch {}
      }
    } else if (tableName === "electric_pln_telemetry" || normDev.includes("pln") || normDev.includes("pm8000")) {
      const res = await pool.query(`
        SELECT DISTINCT ON (date_trunc('hour', t_stamp)) 
          t_stamp::text AS ts_text, 
          COALESCE(active_energy, 0)::float AS value
        FROM electric_pln_telemetry
        WHERE t_stamp >= $1 AND t_stamp <= $2
          AND active_energy IS NOT NULL
        ORDER BY date_trunc('hour', t_stamp), t_stamp DESC
      `, [fromQueryVal, toQueryVal]);
      hourlyRecords = res.rows;

      // If electric_pln_telemetry is empty, fall back to electricity_telemetry
      if (hourlyRecords.length === 0) {
        const fbRes = await pool.query(`
          SELECT DISTINCT ON (date_trunc('hour', t_stamp))
            t_stamp::text AS ts_text, 
            electricity_kwh::float AS value
          FROM electricity_telemetry
          WHERE t_stamp >= $1 AND t_stamp <= $2 
            AND (id_device = $3 OR id_device IS NULL)
            AND electricity_kwh IS NOT NULL
          ORDER BY date_trunc('hour', t_stamp), t_stamp DESC
        `, [fromQueryVal, toQueryVal, deviceId]);
        hourlyRecords = fbRes.rows;
      }
    } else if (tableName === "electricity_telemetry" || !deviceId) {
      const res = await pool.query(`
        SELECT DISTINCT ON (date_trunc('hour', t_stamp))
          t_stamp::text AS ts_text, 
          electricity_kwh::float AS value
        FROM electricity_telemetry
        WHERE t_stamp >= $1 AND t_stamp <= $2 
          AND (id_device = $3 OR id_device IS NULL)
          AND electricity_kwh IS NOT NULL
        ORDER BY date_trunc('hour', t_stamp), t_stamp DESC
      `, [fromQueryVal, toQueryVal, deviceId]);
      hourlyRecords = res.rows;
    } else {
      const res = await pool.query(`
        SELECT DISTINCT ON (date_trunc('hour', t_stamp)) 
          t_stamp::text AS ts_text, 
          ${energyCol}::float AS value
        FROM ${tableName}
        WHERE t_stamp >= $1 AND t_stamp <= $2
          AND ${energyCol} IS NOT NULL
        ORDER BY date_trunc('hour', t_stamp), t_stamp DESC
      `, [fromQueryVal, toQueryVal]);
      hourlyRecords = res.rows;

      // Append latest from minute table if available and querying today/future
      if (to >= new Date()) {
        try {
          const minuteTable = tableName === "electric_pln_telemetry" ? "electric_pln_telemetry_minute"
            : tableName === "electric_wf1_telemetry" ? "electric_wf1_telemetry_minute"
            : "electric_wf2_telemetry_minute";
          const minRes = await pool.query(`
            SELECT t_stamp::text AS ts_text, ${energyCol}::float AS value
            FROM ${minuteTable}
            WHERE ${energyCol} IS NOT NULL
            ORDER BY t_stamp DESC LIMIT 1
          `);
          if (minRes.rows.length > 0) {
            const latest = minRes.rows[0];
            const latestTs = latest.ts_text ? new Date(latest.ts_text) : new Date(0);
            const lastTsStr = hourlyRecords.length > 0 ? (hourlyRecords[hourlyRecords.length - 1].ts_text || "") : "";
            const lastTs = lastTsStr ? new Date(lastTsStr) : new Date(0);
            if (latestTs.getTime() > lastTs.getTime() + 60000 && latest.value > 0) {
              hourlyRecords.push(latest);
            }
          }
        } catch {}
      }
    }
  } catch (err) {
    console.warn("PostgreSQL query failed for electricity analytics, falling back:", err);
  }

  // If still no records found in Postgres, fall back to MongoDB
  if (hourlyRecords.length === 0) {
    const mongoRecords = await hourlyCollection
      .find({
        "meta.tagId": activeEnergyTag,
        ts: { $gte: baselineDate, $lte: to }
      })
      .sort({ ts: 1 })
      .toArray();
    
    hourlyRecords = mongoRecords.map((r: any) => ({
      ts: r.ts,
      ts_text: getWibDateString(r.ts) + " " + String(getWibHour(r.ts)).padStart(2, "0") + ":00:00",
      value: r.value
    }));
  }

  const todayStr = getWibDateString(new Date());
  const currentMonthStr = todayStr.substring(0, 7);

  // Fetch electricity tariffs from config
  const configDoc = await db.collection(GLOBAL_CONFIG_COLLECTION).findOne({ key: "utility" });
  const tariffs: ElectricityTariff[] = configDoc?.electricityTariffs || [
    { validFrom: "2024-01", wbpRate: wbpRate, lwbpRate: lwbpRate }
  ];

  let wbpKwh = 0;
  let lwbpKwh = 0;
  let maxDiff = 0;
  let peakDemandTs: Date | null = null;

  let totalWbpCost = 0;
  let totalLwbpCost = 0;
  let todayWbpCost = 0;
  let todayLwbpCost = 0;
  let monthlyWbpCost = 0;
  let monthlyLwbpCost = 0;

  let todayWbpKwh = 0;
  let todayLwbpKwh = 0;
  let monthlyWbpKwh = 0;
  let monthlyLwbpKwh = 0;

  const dailyMap = new Map<string, number>();
  const dailyWbpMap = new Map<string, number>();
  const dailyLwbpMap = new Map<string, number>();
  const monthlyMap = new Map<string, number>();
  const monthlyWbpMap = new Map<string, number>();
  const monthlyLwbpMap = new Map<string, number>();
  const monthlyPeakMap = new Map<string, number>();
  const monthlyPeakTsMap = new Map<string, Date>();

  const monthlyWbpCostMap = new Map<string, number>();
  const monthlyLwbpCostMap = new Map<string, number>();

  const dailyHourlyMap = new Map<string, number[]>();
  const dailyHourlyWbpMap = new Map<string, number[]>();
  const dailyHourlyLwbpMap = new Map<string, number[]>();

  for (let i = 1; i < hourlyRecords.length; i++) {
    const prevRecord = hourlyRecords[i - 1];
    const currRecord = hourlyRecords[i];
    const prevVal = prevRecord.value;
    const currVal = currRecord.value;
    
    const prevDateObj = new Date(prevRecord.ts_text);
    const currDateObj = new Date(currRecord.ts_text);
    const timeDiffMs = currDateObj.getTime() - prevDateObj.getTime();

    let diff = 0;
    // Only calculate diff if consecutive records are consecutive hours (<= 90 minutes)
    // If there is a gap (power meter was offline / null in between), do not assume consumption -> diff = 0
    if (currVal !== null && prevVal !== null && !isNaN(currVal) && !isNaN(prevVal)) {
      if (timeDiffMs <= 90 * 60 * 1000) {
        diff = currVal - prevVal;
        if (diff < 0) diff = 0; // Guard against resets or anomalies
      }
    }

    const prevTsStr = (prevRecord.ts_text || "").split(".")[0];
    const currTsStr = (currRecord.ts_text || "").split(".")[0];

    const [prevDateStr, prevTimeStr = "00:00:00"] = prevTsStr.split(" ");
    const [currDateStr, currTimeStr = "00:00:00"] = currTsStr.split(" ");

    const prevHour = parseInt(prevTimeStr.split(":")[0], 10);
    const currHour = parseInt(currTimeStr.split(":")[0], 10);

    // The consumption interval [prevHour, currHour] belongs to prevDateStr
    const dateStr = prevDateStr;
    const monthStr = dateStr.substring(0, 7);
    const isToday = dateStr === todayStr;
    const isCurrentMonth = monthStr === currentMonthStr;

    // Check if current interval falls within the requested date range [fromStr, toStr]
    const inRange = (!fromStr || dateStr >= fromStr) && (!toStr || dateStr <= toStr);

    // Get matching tariff for this date
    const recordTariff = getTariffForDate(dateStr, tariffs);

    // If the hourly interval ends at 18:00 to 22:00 WIB, it started at WBP hours (17:00-21:00)
    const isWbp = currHour >= 18 && currHour <= 22;

    if (inRange) {
      if (isWbp) {
        const cost = diff * recordTariff.wbpRate;
        wbpKwh += diff;
        totalWbpCost += cost;
        if (isToday) {
          todayWbpKwh += diff;
          todayWbpCost += cost;
        }
        if (isCurrentMonth) {
          monthlyWbpKwh += diff;
          monthlyWbpCost += cost;
        }
        monthlyWbpCostMap.set(monthStr, (monthlyWbpCostMap.get(monthStr) || 0) + cost);
        dailyWbpMap.set(dateStr, (dailyWbpMap.get(dateStr) || 0) + diff);
      } else {
        const cost = diff * recordTariff.lwbpRate;
        lwbpKwh += diff;
        totalLwbpCost += cost;
        if (isToday) {
          todayLwbpKwh += diff;
          todayLwbpCost += cost;
        }
        if (isCurrentMonth) {
          monthlyLwbpKwh += diff;
          monthlyLwbpCost += cost;
        }
        monthlyLwbpCostMap.set(monthStr, (monthlyLwbpCostMap.get(monthStr) || 0) + cost);
        dailyLwbpMap.set(dateStr, (dailyLwbpMap.get(dateStr) || 0) + diff);
      }

      dailyMap.set(dateStr, (dailyMap.get(dateStr) || 0) + diff);

      // Group by Month (total + WBP/LWBP split)
      monthlyMap.set(monthStr, (monthlyMap.get(monthStr) || 0) + diff);
      if (isWbp) {
        monthlyWbpMap.set(monthStr, (monthlyWbpMap.get(monthStr) || 0) + diff);
      } else {
        monthlyLwbpMap.set(monthStr, (monthlyLwbpMap.get(monthStr) || 0) + diff);
      }

      // Track peak demand
      if (diff > maxDiff) {
        maxDiff = diff;
        peakDemandTs = currRecord.ts_text ? new Date(currRecord.ts_text) : null;
      }
      const currentMonthPeak = monthlyPeakMap.get(monthStr) || 0;
      if (diff > currentMonthPeak) {
        monthlyPeakMap.set(monthStr, diff);
        monthlyPeakTsMap.set(monthStr, currRecord.ts_text ? new Date(currRecord.ts_text) : new Date());
      }
    }

    // Accumulate for daily hourly map (total + WBP/LWBP split)
    if (!dailyHourlyMap.has(dateStr)) {
      dailyHourlyMap.set(dateStr, Array.from({ length: 24 }, () => 0));
      dailyHourlyWbpMap.set(dateStr, Array.from({ length: 24 }, () => 0));
      dailyHourlyLwbpMap.set(dateStr, Array.from({ length: 24 }, () => 0));
    }
    const dayHours = dailyHourlyMap.get(dateStr)!;
    const dayWbpHours = dailyHourlyWbpMap.get(dateStr)!;
    const dayLwbpHours = dailyHourlyLwbpMap.get(dateStr)!;
    if (prevHour >= 0 && prevHour < 24) {
      dayHours[prevHour] += diff;
      if (isWbp) {
        dayWbpHours[prevHour] += diff;
      } else {
        dayLwbpHours[prevHour] += diff;
      }
    }
  }

  let latestWibDate = toStr || fromStr;
  if (!latestWibDate) {
    const dates = Array.from(dailyHourlyMap.keys())
      .filter(d => (!fromStr || d >= fromStr) && (!toStr || d <= toStr) && d <= todayStr)
      .sort();
    latestWibDate = dates.length > 0 ? dates[dates.length - 1] : todayStr;
  }

  const hourlyValues = dailyHourlyMap.get(latestWibDate) || Array.from({ length: 24 }, () => 0);
  const hourlyWbpValues = dailyHourlyWbpMap.get(latestWibDate) || Array.from({ length: 24 }, () => 0);
  const hourlyLwbpValues = dailyHourlyLwbpMap.get(latestWibDate) || Array.from({ length: 24 }, () => 0);

  // Ensure hours after current time today are 0 (never show future or incomplete hours)
  if (latestWibDate === todayStr) {
    const nowWib = new Date(new Date().getTime() + 7 * 60 * 60 * 1000);
    const currentWibHour = nowWib.getUTCHours();
    for (let h = currentWibHour; h < 24; h++) {
      hourlyValues[h] = 0;
      hourlyWbpValues[h] = 0;
      hourlyLwbpValues[h] = 0;
    }
  }

  const yesterdayDate = new Date(new Date().getTime() - 24 * 60 * 60 * 1000);
  const yesterdayDateStr = getWibDateString(yesterdayDate);
  const dbPrevHourly = dailyHourlyMap.get(yesterdayDateStr);
  const prevHourlyValues = dbPrevHourly || Array.from({ length: 24 }, () => 0);

  const totalKwh = wbpKwh + lwbpKwh;
  const wbpCost = totalWbpCost;
  const lwbpCost = totalLwbpCost;
  const totalCost = totalWbpCost + totalLwbpCost;

  const todayCost = todayWbpCost + todayLwbpCost;
  const monthlyCost = monthlyWbpCost + monthlyLwbpCost;

  // Carbon coefficient: ~0.82 kg CO2 per kWh
  const co2Emitted = (totalKwh * 0.82) / 1000; // in tons

  // ===== ALWAYS populate all months in the queried range with 0 for missing =====
  const monthly: { month: string; value: number; wbp: number; lwbp: number }[] = [];
  const startDay = new Date(from);
  const endDay = new Date(to);

  // Timezone-safe year/month/day extraction using WIB date strings
  const startWibStr = getWibDateString(startDay);
  const endWibStr = getWibDateString(endDay);
  const [startY, startM, startD] = startWibStr.split("-").map(Number);
  const [endY, endM, endD] = endWibStr.split("-").map(Number);

  const currentMonthCursor = new Date(startY, startM - 1, 1);
  const wibEndMonthCursor = new Date(endY, endM - 1, 1);
  
  while (currentMonthCursor <= wibEndMonthCursor) {
    const y = currentMonthCursor.getFullYear();
    const m = String(currentMonthCursor.getMonth() + 1).padStart(2, "0");
    const monthKey = `${y}-${m}`;
    const val = monthlyMap.get(monthKey) || 0;
    const mWbp = monthlyWbpMap.get(monthKey) || 0;
    const mLwbp = monthlyLwbpMap.get(monthKey) || 0;
    
    monthly.push({ 
      month: monthKey, 
      value: val / 1000, 
      wbp: mWbp / 1000, 
      lwbp: mLwbp / 1000 
    });
    
    currentMonthCursor.setMonth(currentMonthCursor.getMonth() + 1);
  }

  // ===== ALWAYS populate all days in the queried range with 0 for missing =====
  const daily: { day: string; value: number; wbp: number; lwbp: number }[] = [];
  const wibStartCursor = new Date(startY, startM - 1, startD);
  const wibEndCursor = new Date(endY, endM - 1, endD);
  const currentCursor = new Date(wibStartCursor);

  while (currentCursor <= wibEndCursor) {
    const yr = currentCursor.getFullYear();
    const mo = String(currentCursor.getMonth() + 1).padStart(2, "0");
    const dy = String(currentCursor.getDate()).padStart(2, "0");
    const dayKey = `${yr}-${mo}-${dy}`;

    const val = dailyMap.get(dayKey) || 0;
    const dWbp = dailyWbpMap.get(dayKey) || 0;
    const dLwbp = dailyLwbpMap.get(dayKey) || 0;
    daily.push({ day: dayKey, value: val, wbp: dWbp, lwbp: dLwbp });
    
    currentCursor.setDate(currentCursor.getDate() + 1);
  }

  // ===== Per-Month Summary for period selector =====
  const perMonthSummary = monthly.map((m) => {
    const monthKey = m.month;
    const mTotalKwh = (monthlyMap.get(monthKey) || 0);
    const mWbpKwh = (monthlyWbpMap.get(monthKey) || 0);
    const mLwbpKwh = (monthlyLwbpMap.get(monthKey) || 0);
    const mWbpCost = monthlyWbpCostMap.get(monthKey) || 0;
    const mLwbpCost = monthlyLwbpCostMap.get(monthKey) || 0;
    const mTotalCost = mWbpCost + mLwbpCost;
    const mPeak = monthlyPeakMap.get(monthKey) || 0;
    const mPeakTs = monthlyPeakTsMap.get(monthKey);
    const [mYear, mMonth] = monthKey.split("-").map(Number);
    const mLoadFactor = mPeak > 0 ? (mTotalKwh / (mPeak * 24 * daysInMonth(mYear, mMonth))) : 0;
    return {
      month: monthKey,
      totalKwh: Number(mTotalKwh.toFixed(0)),
      wbpKwh: Number(mWbpKwh.toFixed(0)),
      lwbpKwh: Number(mLwbpKwh.toFixed(0)),
      totalCost: Number(mTotalCost.toFixed(0)),
      wbpCost: Number(mWbpCost.toFixed(0)),
      lwbpCost: Number(mLwbpCost.toFixed(0)),
      peakDemand: Number(mPeak.toFixed(1)),
      peakDemandTs: mPeakTs ? mPeakTs.toISOString() : null,
      loadFactor: Number(mLoadFactor.toFixed(4))
    };
  });

  // Electricity breakdown
  const breakdown: { label: string; value: number; color: string }[] = [];
  if (deviceId === "Cubicle_PLN_PM8000") {
    breakdown.push(
      { label: "Feeder WF1 (PM5560)", value: 42, color: "#3b82f6" },
      { label: "Feeder WF2 (PM5500)", value: 38, color: "#f59e0b" },
      { label: "Utilities & Others", value: 20, color: "#10b981" }
    );
  } else if (deviceId === "Cubicle_WF1_PM5560") {
    breakdown.push(
      { label: "Chiller Plant", value: 45, color: "#3b82f6" },
      { label: "Water Treatment", value: 30, color: "#f59e0b" },
      { label: "Production Line 1", value: 25, color: "#10b981" }
    );
  } else {
    breakdown.push(
      { label: "Air Compressors", value: 50, color: "#3b82f6" },
      { label: "HVAC System", value: 35, color: "#f59e0b" },
      { label: "Production Line 2", value: 15, color: "#10b981" }
    );
  }

  // Latest Power Quality and Grid Telemetry (pqData)
  // Fetch latest active values from PostgreSQL raw tables if available
  let pgPq: any = null;
  const pgPool = getPostgresPool();
  try {
    if (deviceId === "Cubicle_PLN_PM8000") {
      const res = await pgPool.query(`SELECT * FROM electric_pln_telemetry ORDER BY t_stamp DESC LIMIT 1`);
      if (res.rows.length > 0) pgPq = res.rows[0];
    } else if (deviceId === "Feeder_WF1_PM5560") {
      const res = await pgPool.query(`SELECT * FROM electric_wf1_telemetry ORDER BY t_stamp DESC LIMIT 1`);
      if (res.rows.length > 0) pgPq = res.rows[0];
    } else if (deviceId === "Feeder_WF2_PM5500") {
      const res = await pgPool.query(`SELECT * FROM electric_wf2_telemetry ORDER BY t_stamp DESC LIMIT 1`);
      if (res.rows.length > 0) pgPq = res.rows[0];
    }
  } catch (err) {
    console.error("Failed to query latest telemetry from Postgres:", err);
  }

  // Fallback default values
  const isPln = deviceId === "Cubicle_PLN_PM8000";
  const isWf1 = deviceId === "Feeder_WF1_PM5560";
  
  let activePowerVal = isPln ? 4278 : (isWf1 ? 2800 : 1420);
  let reactivePowerVal = isPln ? 1898 : (isWf1 ? 1200 : 710);
  let apparentPowerVal = isPln ? 4595 : (isWf1 ? 2990 : 1580);
  let pfVal: number | null = isPln ? 0.943 : (isWf1 ? 0.952 : 0.928);
  let freqVal = 49.96;
  let voltLAvg = isPln ? 20.07 : (isWf1 ? 20.04 : 19.98);
  let voltABVal = isPln ? 20.07 : (isWf1 ? 20.04 : 19.98);
  let voltBCVal = isPln ? 20.08 : (isWf1 ? 20.05 : 19.99);
  let voltCAVal = isPln ? 20.06 : (isWf1 ? 20.03 : 19.97);
  let currentAVal = isPln ? 120.6 : (isWf1 ? 80.5 : 40.2);
  let currentBVal = isPln ? 121.2 : (isWf1 ? 81.1 : 40.5);
  let currentCVal = isPln ? 125.9 : (isWf1 ? 84.2 : 42.1);
  let vUnbVal = isPln ? 0.95 : (isWf1 ? 0.88 : 1.05);
  let iUnbVal = isPln ? 1.56 : (isWf1 ? 1.42 : 1.82);
  let thdVVVal = 2.28;
  let thdIIVal = 5.84;
  let thdVR = 2.51, thdVS = 2.34, thdVT = 1.92;
  let thdIR = 6.20, thdIS = 5.78, thdIT = 5.55;
  let isConnected = true;

  if (pgPq) {
    const rawActive = pgPq.active_power !== undefined ? pgPq.active_power : pgPq.active_power_total;
    activePowerVal = rawActive !== null ? Number(rawActive) / 1000.0 : activePowerVal;
    reactivePowerVal = pgPq.reactive_power_total !== null ? Number(pgPq.reactive_power_total) / 1000.0 : reactivePowerVal;
    apparentPowerVal = pgPq.apparent_power_total !== null ? Number(pgPq.apparent_power_total) / 1000.0 : apparentPowerVal;
    pfVal = pgPq.power_factor !== null ? Math.abs(Number(pgPq.power_factor)) : pfVal;
    freqVal = pgPq.frequency !== null ? Number(pgPq.frequency) : freqVal;
    voltLAvg = pgPq.volt_ll !== null ? Number(pgPq.volt_ll) / 1000.0 : voltLAvg;
    voltABVal = pgPq.volt_ab !== null ? Number(pgPq.volt_ab) / 1000.0 : voltABVal;
    voltBCVal = pgPq.volt_bc !== null ? Number(pgPq.volt_bc) / 1000.0 : voltBCVal;
    voltCAVal = pgPq.volt_ca !== null ? Number(pgPq.volt_ca) / 1000.0 : voltCAVal;
    currentAVal = pgPq.current_a !== null ? Number(pgPq.current_a) : currentAVal;
    currentBVal = pgPq.current_b !== null ? Number(pgPq.current_b) : currentBVal;
    currentCVal = pgPq.current_c !== null ? Number(pgPq.current_c) : currentCVal;
    
    // Normalize unbalances if they are in decimal form (e.g. 0.0054 -> 0.54%)
    const rawVUnb = pgPq.voltage_unbalance !== null ? Number(pgPq.voltage_unbalance) : null;
    if (rawVUnb !== null) {
      vUnbVal = rawVUnb < 1.0 ? rawVUnb * 100.0 : rawVUnb;
    }
    const rawIUnb = pgPq.current_unbalance !== null ? Number(pgPq.current_unbalance) : null;
    if (rawIUnb !== null) {
      iUnbVal = rawIUnb < 1.0 ? rawIUnb * 100.0 : rawIUnb;
    }

    // Normalize THDs (e.g. 0.0187 -> 1.87%)
    const rawThdVA = pgPq.thd_volt_a !== null ? Number(pgPq.thd_volt_a) : null;
    const rawThdVB = pgPq.thd_volt_b !== null ? Number(pgPq.thd_volt_b) : null;
    const rawThdVC = pgPq.thd_volt_c !== null ? Number(pgPq.thd_volt_c) : null;
    if (rawThdVA !== null) thdVR = rawThdVA < 1.0 ? rawThdVA * 100.0 : rawThdVA;
    if (rawThdVB !== null) thdVS = rawThdVB < 1.0 ? rawThdVB * 100.0 : rawThdVB;
    if (rawThdVC !== null) thdVT = rawThdVC < 1.0 ? rawThdVC * 100.0 : rawThdVC;
    thdVVVal = (thdVR + thdVS + thdVT) / 3.0;

    const rawThdIA = pgPq.thd_current_a !== null ? Number(pgPq.thd_current_a) : null;
    const rawThdIB = pgPq.thd_current_b !== null ? Number(pgPq.thd_current_b) : null;
    const rawThdIC = pgPq.thd_current_c !== null ? Number(pgPq.thd_current_c) : null;
    if (rawThdIA !== null) thdIR = rawThdIA < 1.0 ? rawThdIA * 100.0 : rawThdIA;
    if (rawThdIB !== null) thdIS = rawThdIB < 1.0 ? rawThdIB * 100.0 : rawThdIB;
    if (rawThdIC !== null) thdIT = rawThdIC < 1.0 ? rawThdIC * 100.0 : rawThdIC;
    thdIIVal = (thdIR + thdIS + thdIT) / 3.0;

    const statusVal = deviceId === "Cubicle_PLN_PM8000" ? pgPq.status_pm8000 : pgPq.status_pm5500;
    const recordTime = new Date(pgPq.t_stamp).getTime();
    const isStale = (Date.now() - recordTime) > 10000; // 10 seconds stale threshold
    isConnected = (statusVal !== null ? !!statusVal : true) && !isStale;
  }

  const vln1 = voltABVal / Math.sqrt(3);
  const vln2 = voltBCVal / Math.sqrt(3);
  const vln3 = voltCAVal / Math.sqrt(3);

  const today = dailyMap.get(todayStr) || 0;
  const monthlyMwh = (monthlyMap.get(currentMonthStr) || 0) / 1000;
  const yearlyMwh = totalKwh / 1000;

  // Fetch today's 24 hours of hourly average voltage and active power progressively from postgres
  let voltageTrend: { hour: string; value: number }[] = [];
  let powerTrend: { hour: string; value: number }[] = [];
  try {
    const tableMap: Record<string, { main: string; minute: string }> = {
      "Cubicle_PLN_PM8000": { main: "electric_pln_telemetry", minute: "electric_pln_telemetry_minute" },
      "Feeder_WF1_PM5560": { main: "electric_wf1_telemetry", minute: "electric_wf1_telemetry_minute" },
      "Feeder_WF2_PM5500": { main: "electric_wf2_telemetry", minute: "electric_wf2_telemetry_minute" }
    };
    const tblConfig = tableMap[deviceId];
    if (tblConfig) {
      const activePowerCol = deviceId === "Cubicle_PLN_PM8000" ? "active_power" : "active_power_total";
      
      const voltRes = await pool.query(`
        WITH today_hours AS (
          SELECT 
            to_char(t_stamp, 'HH24:00') AS hour_str,
            AVG(CASE WHEN volt_ll > 1000 THEN volt_ll / 1000.0 ELSE volt_ll END)::float AS avg_val
          FROM ${tblConfig.main}
          WHERE t_stamp >= (NOW() AT TIME ZONE 'Asia/Jakarta')::date
            AND t_stamp < date_trunc('hour', NOW() AT TIME ZONE 'Asia/Jakarta')
          GROUP BY to_char(t_stamp, 'HH24:00')

          UNION ALL

          SELECT 
            to_char(date_trunc('hour', t_stamp), 'HH24:00') AS hour_str,
            AVG(CASE WHEN volt_ll > 1000 THEN volt_ll / 1000.0 ELSE volt_ll END)::float AS avg_val
          FROM ${tblConfig.minute}
          WHERE t_stamp >= date_trunc('hour', NOW() AT TIME ZONE 'Asia/Jakarta')
          GROUP BY to_char(date_trunc('hour', t_stamp), 'HH24:00')
        )
        SELECT hour_str, avg_val
        FROM today_hours
        WHERE avg_val IS NOT NULL
        ORDER BY hour_str ASC
      `);
      
      const powerRes = await pool.query(`
        WITH today_hours AS (
          SELECT 
            to_char(t_stamp, 'HH24:00') AS hour_str,
            AVG(CASE WHEN ${activePowerCol} > 1000 THEN ${activePowerCol} / 1000.0 ELSE ${activePowerCol} END)::float AS avg_val
          FROM ${tblConfig.main}
          WHERE t_stamp >= (NOW() AT TIME ZONE 'Asia/Jakarta')::date
            AND t_stamp < date_trunc('hour', NOW() AT TIME ZONE 'Asia/Jakarta')
          GROUP BY to_char(t_stamp, 'HH24:00')

          UNION ALL

          SELECT 
            to_char(date_trunc('hour', t_stamp), 'HH24:00') AS hour_str,
            AVG(CASE WHEN ${activePowerCol} > 1000 THEN ${activePowerCol} / 1000.0 ELSE ${activePowerCol} END)::float AS avg_val
          FROM ${tblConfig.minute}
          WHERE t_stamp >= date_trunc('hour', NOW() AT TIME ZONE 'Asia/Jakarta')
          GROUP BY to_char(date_trunc('hour', t_stamp), 'HH24:00')
        )
        SELECT hour_str, avg_val
        FROM today_hours
        WHERE avg_val IS NOT NULL
        ORDER BY hour_str ASC
      `);
      
      voltageTrend = voltRes.rows.map(r => ({ hour: r.hour_str, value: Number(r.avg_val.toFixed(2)) }));
      powerTrend = powerRes.rows.map(r => ({ hour: r.hour_str, value: Number(r.avg_val.toFixed(1)) }));
    }
  } catch (err) {
    console.warn("Failed to query voltage/power 24h trend:", err);
  }

  return {
    summary: {
      todayKwh: Number(today.toFixed(0)),
      todayCost: Number(todayCost.toFixed(0)),
      monthlyMwh: Number(monthlyMwh.toFixed(4)),
      monthlyCost: Number(monthlyCost.toFixed(0)),
      yearlyMwh: Number(yearlyMwh.toFixed(4)),
      co2Emitted: Number(co2Emitted.toFixed(1)),
      totalKwh: Number(totalKwh.toFixed(0)),
      wbpKwh: Number(wbpKwh.toFixed(0)),
      lwbpKwh: Number(lwbpKwh.toFixed(0)),
      wbpCost: Number(wbpCost.toFixed(0)),
      lwbpCost: Number(lwbpCost.toFixed(0)),
      totalCost: Number(totalCost.toFixed(0)),
      todayWbpKwh: Number(todayWbpKwh.toFixed(0)),
      todayLwbpKwh: Number(todayLwbpKwh.toFixed(0)),
      monthlyWbpKwh: Number(monthlyWbpKwh.toFixed(0)),
      monthlyLwbpKwh: Number(monthlyLwbpKwh.toFixed(0)),
      peakDemand: Number(maxDiff.toFixed(1)),
      peakDemandTs: maxDiff > 0 && peakDemandTs ? peakDemandTs.toISOString() : null,
      perMonthSummary
    },
    charts: {
      hourly: hourlyValues,
      hourlyWbp: hourlyWbpValues,
      hourlyLwbp: hourlyLwbpValues,
      prevHourly: prevHourlyValues,
      daily,
      monthly,
      breakdown,
      voltage24h: voltageTrend,
      activePower24h: powerTrend
    },
    pqData: {
      activePower: Number(activePowerVal.toFixed(1)),
      activePowerTs: maxDiff > 0 && peakDemandTs ? peakDemandTs.toISOString() : null,
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
  };
};
