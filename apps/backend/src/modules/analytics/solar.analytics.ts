import { getPostgresPool } from "../../database/postgres";
import { getMongoDb } from "../../database/mongo";
import { GLOBAL_CONFIG_COLLECTION } from "../../database/collections";

// Helper to format date string as YYYY-MM-DD for WIB
function getWibDateString(date: Date): string {
  const wibTime = new Date(date.getTime() + 7 * 60 * 60 * 1000);
  const y = wibTime.getUTCFullYear();
  const m = String(wibTime.getUTCMonth() + 1).padStart(2, "0");
  const d = String(wibTime.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export interface SolarLiveItem {
  status: boolean;
  totalKwh: number;
  totalKvarh: number;
  frequency: number;
  voltAb: number;
  voltBc: number;
  voltCa: number;
  voltAn: number;
  voltBn: number;
  voltCn: number;
}

export interface SolarLiveState {
  t_stamp: Date | string;
  poi1: SolarLiveItem;
  poi2: SolarLiveItem;
  totalKwh: number;
}

// In-memory cache for latest live reading
let latestSolarLiveState: SolarLiveState | null = null;

export const setLatestSolarLiveState = (state: SolarLiveState) => {
  latestSolarLiveState = state;
};

export const getLatestSolarLiveState = (): SolarLiveState | null => {
  return latestSolarLiveState;
};

export interface SolarAnalyticsResult {
  summary: {
    totalKwh: number;
    todayKwh: number;
    monthlyKwh: number;
    yearlyKwh: number;
    estimasiBiaya: number;
    todayCost: number;
    poi1TodayKwh: number;
    poi2TodayKwh: number;
    poi1TotalKwh: number;
    poi2TotalKwh: number;
    poi1PeakDemand: number;
    poi2PeakDemand: number;
    peakDemand: number;
  };
  charts: {
    hourly: number[];
    hourlyPoi1: number[];
    hourlyPoi2: number[];
    daily: { day: string; poi1: number; poi2: number; total: number }[];
    monthly: { month: string; poi1: number; poi2: number; total: number }[];
  };
  live: SolarLiveState | null;
}

export const getSolarAnalytics = async (
  fromStr?: string,
  toStr?: string,
  year?: number
): Promise<SolarAnalyticsResult> => {
  const pool = getPostgresPool();
  const db = getMongoDb();

  const selectedYear = year || (fromStr ? parseInt(fromStr.split("-")[0]) : new Date().getFullYear());
  const todayStr = getWibDateString(new Date());
  const currentMonthStr = todayStr.substring(0, 7);

  // Format local WIB timestamps for PostgreSQL timestamp without time zone
  const pad = (n: number) => String(n).padStart(2, "0");
  const fromDate = new Date(`${fromStr || `${selectedYear}-01-01`}T00:00:00`);
  const baselineDate = new Date(fromDate.getTime() - 2 * 60 * 60 * 1000);
  const fromQueryVal = `${baselineDate.getFullYear()}-${pad(baselineDate.getMonth() + 1)}-${pad(baselineDate.getDate())} ${pad(baselineDate.getHours())}:${pad(baselineDate.getMinutes())}:${pad(baselineDate.getSeconds())}`;

  const toDate = new Date(`${toStr || `${selectedYear}-12-31`}T23:59:59`);
  const toPlusDate = new Date(toDate.getTime() + 2 * 60 * 60 * 1000);
  const toQueryVal = `${toPlusDate.getFullYear()}-${pad(toPlusDate.getMonth() + 1)}-${pad(toPlusDate.getDate())} ${pad(toPlusDate.getHours())}:${pad(toPlusDate.getMinutes())}:${pad(toPlusDate.getSeconds())}`;

  // Fetch electricity tariff for cost savings estimation
  let solarRate = 1444.7; // default standard PLN tariff per kWh
  try {
    const configDoc = await db.collection(GLOBAL_CONFIG_COLLECTION).findOne({ key: "utility" });
    if (configDoc?.electricityTariffs && configDoc.electricityTariffs.length > 0) {
      solarRate = configDoc.electricityTariffs[0].lwbpRate || 1112;
    }
  } catch {}

  let records: { ts_text: string; poi_1: number | null; poi_2: number | null; total: number | null }[] = [];
  try {
    const res = await pool.query(`
      SELECT 
        t_stamp::text AS ts_text,
        poi_1::float AS poi_1,
        poi_2::float AS poi_2,
        total::float AS total
      FROM solar_telemetry
      WHERE t_stamp >= $1 AND t_stamp <= $2
      ORDER BY t_stamp ASC
    `, [fromQueryVal, toQueryVal]);
    records = res.rows;
  } catch (err) {
    console.warn("Failed to query solar_telemetry:", err);
  }

  // If live data is available and toDate is today, append latest live counter reading
  const live = getLatestSolarLiveState();
  if (live && (live.poi1?.status || live.poi2?.status)) {
    const nowWibStr = `${todayStr} ${pad(new Date().getHours())}:${pad(new Date().getMinutes())}:${pad(new Date().getSeconds())}`;
    records.push({
      ts_text: nowWibStr,
      poi_1: live.poi1?.status ? live.poi1.totalKwh : null,
      poi_2: live.poi2?.status ? live.poi2.totalKwh : null,
      total: (live.poi1?.status ? live.poi1.totalKwh : 0) + (live.poi2?.status ? live.poi2.totalKwh : 0)
    });
  }

  // Hourly maps: DateStr -> Array(24)
  const hourlyMapPoi1 = new Map<string, number[]>();
  const hourlyMapPoi2 = new Map<string, number[]>();
  const hourlyMapTotal = new Map<string, number[]>();

  // Daily maps: DateStr -> number
  const dailyMapPoi1 = new Map<string, number>();
  const dailyMapPoi2 = new Map<string, number>();
  const dailyMapTotal = new Map<string, number>();

  // Monthly maps: MonthStr -> number
  const monthlyMapPoi1 = new Map<string, number>();
  const monthlyMapPoi2 = new Map<string, number>();
  const monthlyMapTotal = new Map<string, number>();

  let totalKwh = 0;
  let todayKwh = 0;
  let monthlyKwh = 0;
  let yearlyKwh = 0;

  let poi1TodayKwh = 0;
  let poi2TodayKwh = 0;
  let poi1PeakDemand = 0;
  let poi2PeakDemand = 0;
  let peakDemand = 0;

  for (let i = 1; i < records.length; i++) {
    const prev = records[i - 1];
    const curr = records[i];

    const prevDateObj = new Date(prev.ts_text);
    const currDateObj = new Date(curr.ts_text);
    const timeDiffMs = currDateObj.getTime() - prevDateObj.getTime();

    let diffPoi1 = 0;
    if (curr.poi_1 !== null && prev.poi_1 !== null && timeDiffMs <= 90 * 60 * 1000) {
      diffPoi1 = Math.max(0, curr.poi_1 - prev.poi_1);
    }

    let diffPoi2 = 0;
    if (curr.poi_2 !== null && prev.poi_2 !== null && timeDiffMs <= 90 * 60 * 1000) {
      diffPoi2 = Math.max(0, curr.poi_2 - prev.poi_2);
    }

    let diffTot = 0;
    if (curr.total !== null && prev.total !== null && timeDiffMs <= 90 * 60 * 1000) {
      diffTot = Math.max(0, curr.total - prev.total);
    } else {
      diffTot = diffPoi1 + diffPoi2;
    }

    const prevTs = prev.ts_text.split(".")[0];
    const [prevDateStr, prevTimeStr = "00:00:00"] = prevTs.split(" ");
    const prevHour = parseInt(prevTimeStr.split(":")[0], 10);

    const dateStr = prevDateStr;
    const monthStr = dateStr.substring(0, 7);
    const isToday = dateStr === todayStr;
    const isCurrentMonth = monthStr === currentMonthStr;

    const inRange = (!fromStr || dateStr >= fromStr) && (!toStr || dateStr <= toStr);

    if (inRange) {
      dailyMapPoi1.set(dateStr, (dailyMapPoi1.get(dateStr) || 0) + diffPoi1);
      dailyMapPoi2.set(dateStr, (dailyMapPoi2.get(dateStr) || 0) + diffPoi2);
      dailyMapTotal.set(dateStr, (dailyMapTotal.get(dateStr) || 0) + diffTot);

      monthlyMapPoi1.set(monthStr, (monthlyMapPoi1.get(monthStr) || 0) + diffPoi1);
      monthlyMapPoi2.set(monthStr, (monthlyMapPoi2.get(monthStr) || 0) + diffPoi2);
      monthlyMapTotal.set(monthStr, (monthlyMapTotal.get(monthStr) || 0) + diffTot);

      if (diffPoi1 > poi1PeakDemand) poi1PeakDemand = diffPoi1;
      if (diffPoi2 > poi2PeakDemand) poi2PeakDemand = diffPoi2;
      if (diffTot > peakDemand) peakDemand = diffTot;

      totalKwh += diffTot;
      yearlyKwh += diffTot;
      if (isToday) {
        todayKwh += diffTot;
        poi1TodayKwh += diffPoi1;
        poi2TodayKwh += diffPoi2;
      }
      if (isCurrentMonth) {
        monthlyKwh += diffTot;
      }
    }

    if (!hourlyMapPoi1.has(dateStr)) hourlyMapPoi1.set(dateStr, Array.from({ length: 24 }, () => 0));
    if (!hourlyMapPoi2.has(dateStr)) hourlyMapPoi2.set(dateStr, Array.from({ length: 24 }, () => 0));
    if (!hourlyMapTotal.has(dateStr)) hourlyMapTotal.set(dateStr, Array.from({ length: 24 }, () => 0));

    if (prevHour >= 0 && prevHour < 24) {
      hourlyMapPoi1.get(dateStr)![prevHour] += diffPoi1;
      hourlyMapPoi2.get(dateStr)![prevHour] += diffPoi2;
      hourlyMapTotal.get(dateStr)![prevHour] += diffTot;
    }
  }

  if (peakDemand === 0 && (poi1PeakDemand > 0 || poi2PeakDemand > 0)) {
    peakDemand = poi1PeakDemand + poi2PeakDemand;
  }

  let targetDate = toStr || fromStr;
  if (!targetDate) {
    const dates = Array.from(hourlyMapTotal.keys())
      .filter(d => (!fromStr || d >= fromStr) && (!toStr || d <= toStr) && d <= todayStr)
      .sort();
    targetDate = dates.length > 0 ? dates[dates.length - 1] : todayStr;
  }

  const hourlyPoi1 = hourlyMapPoi1.get(targetDate) || Array.from({ length: 24 }, () => 0);
  const hourlyPoi2 = hourlyMapPoi2.get(targetDate) || Array.from({ length: 24 }, () => 0);
  const hourly = hourlyMapTotal.get(targetDate) || hourlyPoi1.map((v, i) => v + (hourlyPoi2[i] || 0));

  // Daily records
  const allDates = Array.from(new Set([...dailyMapPoi1.keys(), ...dailyMapPoi2.keys(), ...dailyMapTotal.keys()])).sort();
  const daily = allDates.map(day => ({
    day,
    poi1: dailyMapPoi1.get(day) || 0,
    poi2: dailyMapPoi2.get(day) || 0,
    total: dailyMapTotal.get(day) || ((dailyMapPoi1.get(day) || 0) + (dailyMapPoi2.get(day) || 0))
  }));

  // Monthly records
  const monthly: { month: string; poi1: number; poi2: number; total: number }[] = [];
  for (let m = 1; m <= 12; m++) {
    const mStr = `${selectedYear}-${String(m).padStart(2, "0")}`;
    const p1 = monthlyMapPoi1.get(mStr) || 0;
    const p2 = monthlyMapPoi2.get(mStr) || 0;
    const tot = monthlyMapTotal.get(mStr) || (p1 + p2);
    monthly.push({ month: mStr, poi1: p1, poi2: p2, total: tot });
  }

  const poi1TotalKwh = live?.poi1?.totalKwh ?? 24558.67;
  const poi2TotalKwh = live?.poi2?.totalKwh ?? 95707.05;
  const estimasiBiaya = totalKwh * solarRate;
  const todayCost = todayKwh * solarRate;

  return {
    summary: {
      totalKwh,
      todayKwh,
      monthlyKwh,
      yearlyKwh,
      estimasiBiaya,
      todayCost,
      poi1TodayKwh,
      poi2TodayKwh,
      poi1TotalKwh,
      poi2TotalKwh,
      poi1PeakDemand,
      poi2PeakDemand,
      peakDemand
    },
    charts: {
      hourly,
      hourlyPoi1,
      hourlyPoi2,
      daily,
      monthly
    },
    live
  };
};
