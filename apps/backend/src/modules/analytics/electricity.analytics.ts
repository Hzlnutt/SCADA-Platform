import { getMongoDb } from "../../database/mongo";
import { getPostgresPool } from "../../database/postgres";
import { ELECTRICITY_RAW_COLLECTION, ELECTRICITY_1M_COLLECTION, ELECTRICITY_1H_COLLECTION } from "../../database/collections";
import { env } from "../../config/env.config";

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
  };
  pqData: {
    activePower: number;
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

  // If year is provided, use full year range; otherwise use from/to or default to 2025
  const selectedYear = year || (fromStr ? parseInt(fromStr.split("-")[0]) : 2025);
  const from = fromStr
    ? new Date(fromStr.includes("T") ? fromStr : `${fromStr}T00:00:00.000Z`)
    : new Date(`${selectedYear}-01-01T00:00:00Z`);
  const to = toStr
    ? new Date(toStr.includes("T") ? toStr : `${toStr}T23:59:59.999Z`)
    : new Date(`${selectedYear}-12-31T23:59:59Z`);

  // Always calculate using Active Energy Delivered of PLN (PM8000)
  const activeEnergyTag = "electricity/Cubicle_PLN_PM8000/active_energy";

  // 1. Fetch hourly values of active energy for the range
  let hourlyRecords: { ts: Date; value: number }[] = [];
  const pool = getPostgresPool();
  try {
    const res = await pool.query(`
      SELECT DISTINCT ON (date_trunc('hour', t_stamp)) 
        t_stamp AS ts, 
        electricity_kwh::float AS value
      FROM electricity_telemetry
      WHERE id_device = $1 AND t_stamp >= $2 AND t_stamp <= $3
      ORDER BY date_trunc('hour', t_stamp), t_stamp DESC
    `, [deviceId, from, to]);
    hourlyRecords = res.rows;
  } catch (err) {
    console.warn("PostgreSQL query failed for electricity analytics, falling back to MongoDB:", err);
  }

  // If no records found in Postgres, fall back to MongoDB
  if (hourlyRecords.length === 0) {
    const mongoRecords = await hourlyCollection
      .find({
        "meta.tagId": activeEnergyTag,
        ts: { $gte: from, $lte: to }
      })
      .sort({ ts: 1 })
      .toArray();
    
    hourlyRecords = mongoRecords.map(r => ({
      ts: r.ts,
      value: r.value
    }));
  }

  const todayStr = getWibDateString(new Date());
  const currentMonthStr = todayStr.substring(0, 7);

  let wbpKwh = 0;
  let lwbpKwh = 0;
  let maxDiff = 0;

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

  const dailyHourlyMap = new Map<string, number[]>();
  const dailyHourlyWbpMap = new Map<string, number[]>();
  const dailyHourlyLwbpMap = new Map<string, number[]>();
  let latestWibDate = hourlyRecords.length > 0
    ? getWibDateString(hourlyRecords[hourlyRecords.length - 1].ts)
    : getWibDateString(new Date());

  for (let i = 1; i < hourlyRecords.length; i++) {
    const prevRecord = hourlyRecords[i - 1];
    const currRecord = hourlyRecords[i];
    const prevVal = prevRecord.value;
    const currVal = currRecord.value;
    
    let diff = currVal - prevVal;
    if (diff < 0) diff = 0; // Guard against resets or anomalies

    if (diff > maxDiff) {
      maxDiff = diff;
    }

    const hour = getWibHour(prevRecord.ts);
    const dateStr = getWibDateString(prevRecord.ts);
    const monthStr = dateStr.substring(0, 7);

    const isToday = dateStr === todayStr;
    const isCurrentMonth = monthStr === currentMonthStr;

    // If the hourly interval ends at 18:00 to 22:00 WIB, it started at WBP hours (17:00-21:00)
    const endHour = getWibHour(currRecord.ts);
    const isWbp = endHour >= 18 && endHour <= 22;
    if (isWbp) {
      wbpKwh += diff;
      if (isToday) todayWbpKwh += diff;
      if (isCurrentMonth) monthlyWbpKwh += diff;
    } else {
      lwbpKwh += diff;
      if (isToday) todayLwbpKwh += diff;
      if (isCurrentMonth) monthlyLwbpKwh += diff;
    }

    // Group by Day (total + WBP/LWBP split)
    dailyMap.set(dateStr, (dailyMap.get(dateStr) || 0) + diff);
    if (isWbp) {
      dailyWbpMap.set(dateStr, (dailyWbpMap.get(dateStr) || 0) + diff);
    } else {
      dailyLwbpMap.set(dateStr, (dailyLwbpMap.get(dateStr) || 0) + diff);
    }

    // Group by Month (total + WBP/LWBP split)
    monthlyMap.set(monthStr, (monthlyMap.get(monthStr) || 0) + diff);
    if (isWbp) {
      monthlyWbpMap.set(monthStr, (monthlyWbpMap.get(monthStr) || 0) + diff);
    } else {
      monthlyLwbpMap.set(monthStr, (monthlyLwbpMap.get(monthStr) || 0) + diff);
    }

    // Track peak demand per month
    const currentMonthPeak = monthlyPeakMap.get(monthStr) || 0;
    if (diff > currentMonthPeak) {
      monthlyPeakMap.set(monthStr, diff);
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
    if (hour >= 0 && hour < 24) {
      dayHours[hour] += diff;
      if (isWbp) {
        dayWbpHours[hour] += diff;
      } else {
        dayLwbpHours[hour] += diff;
      }
    }
  }

  const hourlyValues = dailyHourlyMap.get(latestWibDate) || Array.from({ length: 24 }, () => 0);
  const hourlyWbpValues = dailyHourlyWbpMap.get(latestWibDate) || Array.from({ length: 24 }, () => 0);
  const hourlyLwbpValues = dailyHourlyLwbpMap.get(latestWibDate) || Array.from({ length: 24 }, () => 0);
  const yesterdayDate = new Date(new Date().getTime() - 24 * 60 * 60 * 1000);
  const yesterdayDateStr = getWibDateString(yesterdayDate);
  const dbPrevHourly = dailyHourlyMap.get(yesterdayDateStr);
  const prevHourlyValues = dbPrevHourly || Array.from({ length: 24 }, () => 0);

  const totalKwh = wbpKwh + lwbpKwh;
  const wbpCost = wbpKwh * wbpRate;
  const lwbpCost = lwbpKwh * lwbpRate;
  const totalCost = wbpCost + lwbpCost;

  const todayCost = todayWbpKwh * wbpRate + todayLwbpKwh * lwbpRate;
  const monthlyCost = monthlyWbpKwh * wbpRate + monthlyLwbpKwh * lwbpRate;

  // Carbon coefficient: ~0.82 kg CO2 per kWh
  const co2Emitted = (totalKwh * 0.82) / 1000; // in tons

  // ===== ALWAYS populate full 12 months (Jan-Dec) with 0 for missing =====
  const monthly: { month: string; value: number; wbp: number; lwbp: number }[] = [];
  for (let m = 1; m <= 12; m++) {
    const monthKey = `${selectedYear}-${String(m).padStart(2, "0")}`;
    const val = monthlyMap.get(monthKey) || 0;
    const mWbp = monthlyWbpMap.get(monthKey) || 0;
    const mLwbp = monthlyLwbpMap.get(monthKey) || 0;
    monthly.push({ month: monthKey, value: val / 1000, wbp: mWbp / 1000, lwbp: mLwbp / 1000 }); // convert to MWh
  }

  // ===== ALWAYS populate all days in the year with 0 for missing =====
  const daily: { day: string; value: number; wbp: number; lwbp: number }[] = [];
  for (let m = 1; m <= 12; m++) {
    const numDays = daysInMonth(selectedYear, m);
    for (let d = 1; d <= numDays; d++) {
      const dayKey = `${selectedYear}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
      const val = dailyMap.get(dayKey) || 0;
      const dWbp = dailyWbpMap.get(dayKey) || 0;
      const dLwbp = dailyLwbpMap.get(dayKey) || 0;
      daily.push({ day: dayKey, value: val, wbp: dWbp, lwbp: dLwbp });
    }
  }

  // ===== Per-Month Summary for period selector =====
  const perMonthSummary = monthly.map((m) => {
    const monthKey = m.month;
    const mTotalKwh = (monthlyMap.get(monthKey) || 0);
    const mWbpKwh = (monthlyWbpMap.get(monthKey) || 0);
    const mLwbpKwh = (monthlyLwbpMap.get(monthKey) || 0);
    const mWbpCost = mWbpKwh * wbpRate;
    const mLwbpCost = mLwbpKwh * lwbpRate;
    const mTotalCost = mWbpCost + mLwbpCost;
    const mPeak = monthlyPeakMap.get(monthKey) || 0;
    const mLoadFactor = mPeak > 0 ? (mTotalKwh / (mPeak * 24 * daysInMonth(selectedYear, parseInt(monthKey.split("-")[1])))) : 0;
    return {
      month: monthKey,
      totalKwh: Number(mTotalKwh.toFixed(0)),
      wbpKwh: Number(mWbpKwh.toFixed(0)),
      lwbpKwh: Number(mLwbpKwh.toFixed(0)),
      totalCost: Number(mTotalCost.toFixed(0)),
      wbpCost: Number(mWbpCost.toFixed(0)),
      lwbpCost: Number(mLwbpCost.toFixed(0)),
      peakDemand: Number(mPeak.toFixed(1)),
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
  // Fetch latest active values from MongoDB telemetry_raw for Incoming PLN PM8000 only
  let latestTelemetry = await db.collection("telemetry_raw")
    .find({
      "meta.deviceId": "Cubicle_PLN_PM8000",
      ts: { $lte: to }
    })
    .sort({ ts: -1 })
    .limit(100)
    .toArray();

  if (latestTelemetry.length === 0) {
    latestTelemetry = await db.collection("electricity_raw")
      .find({
        "meta.deviceId": "Cubicle_PLN_PM8000",
        ts: { $lte: to }
      })
      .sort({ ts: -1 })
      .limit(100)
      .toArray();
  }

  const getLatestVal = (key: string, defaultVal: number): number => {
    const match = latestTelemetry.find((t) => t.meta.tagId.endsWith(`/${key}`));
    return match ? Number(match.value) : defaultVal;
  };

  const activePower = maxDiff > 0 ? maxDiff : getLatestVal("active_power", 101.4);
  const reactivePower = getLatestVal("reactive_power", activePower * 0.45);
  const apparentPower = getLatestVal("apparent_power", Math.sqrt(activePower**2 + reactivePower**2));
  const pf = latestPowerFactorStatus === "connected" ? latestPowerFactorValue : null;
  const freq = getLatestVal("frequency", 49.92);
  const volt_avg = getLatestVal("voltage_avg", 21000);
  
  const current1 = getLatestVal("current_a", 165.3);
  const current2 = getLatestVal("current_b", 163.7);
  const current3 = getLatestVal("current_c", 165.2);

  const vll1 = getLatestVal("voltage_ab", volt_avg);
  const vll2 = getLatestVal("voltage_bc", volt_avg + 5);
  const vll3 = getLatestVal("voltage_ca", volt_avg - 5);

  const vln1 = vll1 / Math.sqrt(3);
  const vln2 = vll2 / Math.sqrt(3);
  const vln3 = vll3 / Math.sqrt(3);

  // Simulated metrics for power quality
  const thdV = 2.0 + Math.random() * 0.5;
  const thdI = 7.0 + Math.random() * 2.0;
  const vUnb = 0.5 + Math.random() * 0.2;
  const iUnb = 2.0 + Math.random() * 0.5;

  const today = dailyMap.get(todayStr) || 0;
  const monthlyMwh = (monthlyMap.get(currentMonthStr) || 0) / 1000;
  const yearlyMwh = totalKwh / 1000;

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
      perMonthSummary
    },
    charts: {
      hourly: hourlyValues,
      hourlyWbp: hourlyWbpValues,
      hourlyLwbp: hourlyLwbpValues,
      prevHourly: prevHourlyValues,
      daily,
      monthly,
      breakdown
    },
    pqData: {
      activePower: Number(activePower.toFixed(1)),
      reactivePower: Number(reactivePower.toFixed(1)),
      apparentPower: Number(apparentPower.toFixed(1)),
      pf: pf !== null ? Number(pf.toFixed(2)) : null,
      pfStatus: latestPowerFactorStatus,
      freq: Number(freq.toFixed(2)),
      vUnb: Number(vUnb.toFixed(2)),
      iUnb: Number(iUnb.toFixed(2)),
      thdV: Number(thdV.toFixed(2)),
      thdI: Number(thdI.toFixed(2)),
      vll1: Number(vll1.toFixed(1)),
      vll2: Number(vll2.toFixed(1)),
      vll3: Number(vll3.toFixed(1)),
      vln1: Number(vln1.toFixed(1)),
      vln2: Number(vln2.toFixed(1)),
      vln3: Number(vln3.toFixed(1)),
      current1: Number(current1.toFixed(1)),
      current2: Number(current2.toFixed(1)),
      current3: Number(current3.toFixed(1))
    }
  };
};
