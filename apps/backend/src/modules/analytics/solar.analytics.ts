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
  const fromBase = fromStr ? `${fromStr} 00:00:00` : `${selectedYear}-01-01 00:00:00`;
  const toBase = toStr ? `${toStr} 23:59:59` : `${selectedYear}-12-31 23:59:59`;

  const fromDate = new Date(`${fromStr || `${selectedYear}-01-01`}T00:00:00`);
  const baselineDate = new Date(fromDate.getTime() - 2 * 60 * 60 * 1000);
  const pad = (n: number) => String(n).padStart(2, "0");
  const fromQueryVal = `${baselineDate.getFullYear()}-${pad(baselineDate.getMonth() + 1)}-${pad(baselineDate.getDate())} ${pad(baselineDate.getHours())}:${pad(baselineDate.getMinutes())}:${pad(baselineDate.getSeconds())}`;
  const toQueryVal = toBase;

  // Fetch electricity tariff for cost savings estimation
  let solarRate = 1444.7; // default standard PLN tariff per kWh
  try {
    const configDoc = await db.collection(GLOBAL_CONFIG_COLLECTION).findOne({ key: "utility" });
    if (configDoc?.electricityTariffs && configDoc.electricityTariffs.length > 0) {
      solarRate = configDoc.electricityTariffs[0].lwbpRate || 1112;
    }
  } catch {}

  let records: { ts_text: string; solar_kwh: number; id_device: string }[] = [];
  try {
    const res = await pool.query(`
      SELECT t_stamp::text AS ts_text, solar_kwh::float AS solar_kwh, id_device
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
  if (live && live.poi1 && live.poi2) {
    const nowWibStr = `${todayStr} ${pad(new Date().getHours())}:${pad(new Date().getMinutes())}:${pad(new Date().getSeconds())}`;
    records.push({ ts_text: nowWibStr, solar_kwh: live.poi1.totalKwh, id_device: "POI_1" });
    records.push({ ts_text: nowWibStr, solar_kwh: live.poi2.totalKwh, id_device: "POI_2" });
    records.push({ ts_text: nowWibStr, solar_kwh: live.totalKwh, id_device: "Solar_Panel_Total" });
  }

  // Separate records by device
  const recordsByDevice = new Map<string, { ts_text: string; solar_kwh: number }[]>();
  for (const r of records) {
    const dev = r.id_device || "Solar_Panel_Total";
    if (!recordsByDevice.has(dev)) {
      recordsByDevice.set(dev, []);
    }
    recordsByDevice.get(dev)!.push({ ts_text: r.ts_text, solar_kwh: r.solar_kwh });
  }

  // Hourly map per device: DateStr -> Array(24)
  const hourlyMapPoi1 = new Map<string, number[]>();
  const hourlyMapPoi2 = new Map<string, number[]>();
  const hourlyMapTotal = new Map<string, number[]>();

  // Daily map per device
  const dailyMapPoi1 = new Map<string, number>();
  const dailyMapPoi2 = new Map<string, number>();
  const dailyMapTotal = new Map<string, number>();

  // Monthly map per device
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

  const processDevice = (devId: string, hMap: Map<string, number[]>, dMap: Map<string, number>, mMap: Map<string, number>) => {
    const devRecs = recordsByDevice.get(devId) || [];
    let maxDiff = 0;

    for (let i = 1; i < devRecs.length; i++) {
      const prev = devRecs[i - 1];
      const curr = devRecs[i];
      let diff = curr.solar_kwh - prev.solar_kwh;
      if (diff < 0) diff = 0;

      const prevTs = prev.ts_text.split(".")[0];
      const [prevDateStr, prevTimeStr = "00:00:00"] = prevTs.split(" ");
      const prevHour = parseInt(prevTimeStr.split(":")[0], 10);

      const dateStr = prevDateStr;
      const monthStr = dateStr.substring(0, 7);
      const isToday = dateStr === todayStr;
      const isCurrentMonth = monthStr === currentMonthStr;

      const inRange = (!fromStr || dateStr >= fromStr) && (!toStr || dateStr <= toStr);

      if (inRange) {
        dMap.set(dateStr, (dMap.get(dateStr) || 0) + diff);
        mMap.set(monthStr, (mMap.get(monthStr) || 0) + diff);

        if (diff > maxDiff) maxDiff = diff;

        if (devId === "Solar_Panel_Total" || devId === "TOTAL") {
          totalKwh += diff;
          yearlyKwh += diff;
          if (isToday) todayKwh += diff;
          if (isCurrentMonth) monthlyKwh += diff;
        } else if (devId === "POI_1") {
          if (isToday) poi1TodayKwh += diff;
        } else if (devId === "POI_2") {
          if (isToday) poi2TodayKwh += diff;
        }
      }

      if (!hMap.has(dateStr)) {
        hMap.set(dateStr, Array.from({ length: 24 }, () => 0));
      }
      if (prevHour >= 0 && prevHour < 24) {
        hMap.get(dateStr)![prevHour] += diff;
      }
    }

    return maxDiff;
  };

  poi1PeakDemand = processDevice("POI_1", hourlyMapPoi1, dailyMapPoi1, monthlyMapPoi1);
  poi2PeakDemand = processDevice("POI_2", hourlyMapPoi2, dailyMapPoi2, monthlyMapPoi2);
  peakDemand = processDevice("Solar_Panel_Total", hourlyMapTotal, dailyMapTotal, monthlyMapTotal);

  if (peakDemand === 0 && (poi1PeakDemand > 0 || poi2PeakDemand > 0)) {
    peakDemand = poi1PeakDemand + poi2PeakDemand;
  }
  if (totalKwh === 0 && (poi1TodayKwh > 0 || poi2TodayKwh > 0)) {
    todayKwh = poi1TodayKwh + poi2TodayKwh;
    totalKwh = todayKwh;
  }

  // Selected date for hourly charts
  let targetDate = fromStr || toStr;
  if (!targetDate) {
    const dates = Array.from(hourlyMapTotal.keys()).sort();
    targetDate = dates.length > 0 ? dates[dates.length - 1] : todayStr;
  }

  const hourlyPoi1 = hourlyMapPoi1.get(targetDate) || Array.from({ length: 24 }, () => 0);
  const hourlyPoi2 = hourlyMapPoi2.get(targetDate) || Array.from({ length: 24 }, () => 0);
  const hourly = hourlyMapTotal.get(targetDate) || hourlyPoi1.map((v, i) => v + (hourlyPoi2[i] || 0));

  // Build daily records for range
  const allDates = Array.from(new Set([...dailyMapPoi1.keys(), ...dailyMapPoi2.keys(), ...dailyMapTotal.keys()])).sort();
  const daily = allDates.map(day => ({
    day,
    poi1: dailyMapPoi1.get(day) || 0,
    poi2: dailyMapPoi2.get(day) || 0,
    total: dailyMapTotal.get(day) || ((dailyMapPoi1.get(day) || 0) + (dailyMapPoi2.get(day) || 0))
  }));

  // Build monthly records for selected year (12 months)
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
