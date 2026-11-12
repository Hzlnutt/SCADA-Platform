import { getPostgresPool } from "../../database/postgres";
import { getTariffForDate, ElectricityTariff } from "./electricity.analytics";

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
  activePower?: number | null;
  peakDemand?: number | null;
  totalKwh?: number | null;
  totalKvarh?: number | null;
  frequency?: number | null;
  voltAb?: number | null;
  voltBc?: number | null;
  voltCa?: number | null;
  voltAn?: number | null;
  voltBn?: number | null;
  voltCn?: number | null;
  powerFactor?: number | null;
}

export interface SolarLiveState {
  t_stamp: Date | string;
  poi1: SolarLiveItem;
  poi2: SolarLiveItem;
  totalKwh?: number | null;
  online?: boolean;
  status?: boolean;
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
    totalWbpKwh?: number;
    totalLwbpKwh?: number;
    todayKwh: number;
    todayWbpKwh?: number;
    todayLwbpKwh?: number;
    monthlyKwh: number;
    monthlyWbpKwh?: number;
    monthlyLwbpKwh?: number;
    poi1MonthlyKwh?: number;
    poi2MonthlyKwh?: number;
    yearlyKwh: number;
    estimasiBiaya: number;
    estimasiBiayaTerhindarPln?: number;
    todayCost: number;
    todayBiayaTerhindarPln?: number;
    todayBiayaPv?: number;
    todayPenghematan?: number;
    monthlyBiayaTerhindarPln?: number;
    monthlyBiayaPv?: number;
    monthlyPenghematan?: number;
    monthlySavingsRate?: number;
    savingsRate?: number;
    poi1TodayKwh: number;
    poi2TodayKwh: number;
    poi1TotalKwh: number;
    poi2TotalKwh: number;
    poi1PeakDemand: number;
    poi1PeakDemandTs?: string | null;
    poi2PeakDemand: number;
    poi2PeakDemandTs?: string | null;
    peakDemand: number;
    peakDemandTs?: string | null;
    rangePoi1PeakDemand?: number;
    rangePoi1PeakDemandTs?: string | null;
    rangePoi2PeakDemand?: number;
    rangePoi2PeakDemandTs?: string | null;
    rangePeakDemand?: number;
    rangePeakDemandTs?: string | null;
    rangePoi1Kwh?: number;
    rangePoi2Kwh?: number;
    solarRate?: number;
    lwbpRate?: number;
    wbpRate?: number;
    pvRate?: number;
    estimasiBiayaPv?: number;
    estimasiPenghematan?: number;
  };
  charts: {
    hourly: number[];
    hourlyPoi1: number[];
    hourlyPoi2: number[];
    daily: { day: string; poi1: number; poi2: number; total: number; wbp?: number; lwbp?: number; avoidedCost?: number; savings?: number }[];
    monthly: { month: string; poi1: number; poi2: number; total: number; wbp?: number; lwbp?: number; avoidedCost?: number; savings?: number }[];
    currentHour?: number;
    progressiveMinute?: number | null;
  };
  live: SolarLiveState | null;
}

export const getSolarAnalytics = async (
  fromStr?: string,
  toStr?: string,
  year?: number
): Promise<SolarAnalyticsResult> => {
  const pool = getPostgresPool();

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

  // Strict query boundaries for peak demand and metrics to prevent leaking into adjacent days
  const fromBase = fromStr ? `${fromStr} 00:00:00` : `${selectedYear}-01-01 00:00:00`;
  const toBase = toStr ? `${toStr} 23:59:59` : `${selectedYear}-12-31 23:59:59`;

  // Fetch electricity tariff for cost savings estimation (PostgreSQL global_configs)
  let configDoc: any = null;
  try {
    const pgRes = await pool.query("SELECT value FROM global_configs WHERE key = 'utility' LIMIT 1");
    configDoc = pgRes.rows[0]?.value;
  } catch {}

  const tariffs: ElectricityTariff[] = configDoc?.electricityTariffs && configDoc.electricityTariffs.length > 0
    ? configDoc.electricityTariffs
    : [{ validFrom: "2026-01", wbpRate: configDoc?.wbpRate || 1553.67, lwbpRate: configDoc?.lwbpRate || 1035.78 }];

  const currentTariff = getTariffForDate(todayStr, tariffs);
  const solarRate = currentTariff.lwbpRate;
  const pvRate = (typeof configDoc?.pvRate === "number" && configDoc.pvRate > 0) ? configDoc.pvRate : 549;

  let records: { ts_text: string; poi_1: number | null; poi_2: number | null; total: number | null }[] = [];
  try {
    const res = await pool.query(`
      SELECT 
        to_char(t_stamp, 'YYYY-MM-DD HH24:00:00') as ts_text,
        NULLIF(MAX(CASE WHEN poi_id = 'POI_1' THEN total_kwh END)::float, 0) as poi_1,
        NULLIF(MAX(CASE WHEN poi_id = 'POI_2' THEN total_kwh END)::float, 0) as poi_2,
        (COALESCE(NULLIF(MAX(CASE WHEN poi_id = 'POI_1' THEN total_kwh END), 0), 0) + 
         COALESCE(NULLIF(MAX(CASE WHEN poi_id = 'POI_2' THEN total_kwh END), 0), 0))::float as total
      FROM electric_plts_telemetry
      WHERE t_stamp >= $1 AND t_stamp <= $2
      GROUP BY ts_text
      ORDER BY ts_text ASC
    `, [fromQueryVal, toQueryVal]);
    records = res.rows;
  } catch (err) {
    console.warn("Failed to query electric_plts_telemetry:", err);
  }

  // Live state is retrieved for real-time summary indicators and latest delta
  const live = getLatestSolarLiveState();

  // Hourly maps: DateStr -> Array(24)
  const hourlyMapPoi1 = new Map<string, number[]>();
  const hourlyMapPoi2 = new Map<string, number[]>();
  const hourlyMapTotal = new Map<string, number[]>();

  // Daily maps: DateStr -> number
  const dailyMapPoi1 = new Map<string, number>();
  const dailyMapPoi2 = new Map<string, number>();
  const dailyMapTotal = new Map<string, number>();
  const dailyMapWbp = new Map<string, number>();
  const dailyMapLwbp = new Map<string, number>();

  // Monthly maps: MonthStr -> number
  const monthlyMapPoi1 = new Map<string, number>();
  const monthlyMapPoi2 = new Map<string, number>();
  const monthlyMapTotal = new Map<string, number>();
  const monthlyMapWbp = new Map<string, number>();
  const monthlyMapLwbp = new Map<string, number>();

  let totalKwh = 0;
  let totalWbpKwh = 0;
  let totalLwbpKwh = 0;

  let todayKwh = 0;
  let todayWbpKwh = 0;
  let todayLwbpKwh = 0;

  let monthlyKwh = 0;
  let monthlyWbpKwh = 0;
  let monthlyLwbpKwh = 0;

  let yearlyKwh = 0;

  let totalAvoidedCost = 0;
  let todayAvoidedCost = 0;
  let monthlyAvoidedCost = 0;

  let poi1TodayKwh = 0;
  let poi2TodayKwh = 0;
  let poi1PeakDemand = 0;
  let poi1PeakDemandTs: Date | null = null;
  let poi2PeakDemand = 0;
  let poi2PeakDemandTs: Date | null = null;

  for (let i = 1; i < records.length; i++) {
    const prev = records[i - 1];
    const curr = records[i];

    const prevDateObj = new Date(prev.ts_text);
    const currDateObj = new Date(curr.ts_text);
    const timeDiffMs = currDateObj.getTime() - prevDateObj.getTime();
    const timeDiffHours = Math.max(1, Math.round(timeDiffMs / (3600 * 1000)));

    let diffPoi1 = 0;
    if (curr.poi_1 !== null && prev.poi_1 !== null && curr.poi_1 > 0 && prev.poi_1 > 0 && timeDiffMs <= 24 * 60 * 60 * 1000) {
      diffPoi1 = Math.max(0, curr.poi_1 - prev.poi_1);
    }

    let diffPoi2 = 0;
    if (curr.poi_2 !== null && prev.poi_2 !== null && curr.poi_2 > 0 && prev.poi_2 > 0 && timeDiffMs <= 24 * 60 * 60 * 1000) {
      diffPoi2 = Math.max(0, curr.poi_2 - prev.poi_2);
    }

    const diffTot = diffPoi1 + diffPoi2;

    // Sesuai kaidah metering SCADA: energi selisih (curr - prev) terjadi selama interval [prev, curr]
    // dan dicatat pada jam awal interval (prevHour & prevDateStr), misal: kWh jam 10:00 - kWh jam 09:00 = konsumsi jam 09:00
    const prevTs = prev.ts_text.split(".")[0];
    const currTs = curr.ts_text.split(".")[0];
    const [prevDateStr, prevTimeStr = "00:00:00"] = prevTs.split(" ");
    const [currDateStr, currTimeStr = "00:00:00"] = currTs.split(" ");
    const prevHour = parseInt(prevTimeStr.split(":")[0], 10);

    const dateStr = prevDateStr;
    const targetHour = prevHour;
    const monthStr = dateStr.substring(0, 7);
    const isToday = dateStr === todayStr;
    const isCurrentMonth = monthStr === currentMonthStr;

    const inRange = (!fromStr || dateStr >= fromStr) && (!toStr || dateStr <= toStr);
    const recordTariff = getTariffForDate(dateStr, tariffs);
    const isWbp = targetHour >= 17 && targetHour <= 21; // 17:00 - 22:00 WIB
    const hourAvoidedRate = isWbp ? recordTariff.wbpRate : recordTariff.lwbpRate;
    const hourAvoidedCost = diffTot * hourAvoidedRate;

    if (inRange) {
      dailyMapPoi1.set(dateStr, (dailyMapPoi1.get(dateStr) || 0) + diffPoi1);
      dailyMapPoi2.set(dateStr, (dailyMapPoi2.get(dateStr) || 0) + diffPoi2);
      dailyMapTotal.set(dateStr, (dailyMapTotal.get(dateStr) || 0) + diffTot);

      monthlyMapPoi1.set(monthStr, (monthlyMapPoi1.get(monthStr) || 0) + diffPoi1);
      monthlyMapPoi2.set(monthStr, (monthlyMapPoi2.get(monthStr) || 0) + diffPoi2);
      monthlyMapTotal.set(monthStr, (monthlyMapTotal.get(monthStr) || 0) + diffTot);

      if (isWbp) {
        totalWbpKwh += diffTot;
        dailyMapWbp.set(dateStr, (dailyMapWbp.get(dateStr) || 0) + diffTot);
        monthlyMapWbp.set(monthStr, (monthlyMapWbp.get(monthStr) || 0) + diffTot);
        if (isToday) todayWbpKwh += diffTot;
        if (isCurrentMonth) monthlyWbpKwh += diffTot;
      } else {
        totalLwbpKwh += diffTot;
        dailyMapLwbp.set(dateStr, (dailyMapLwbp.get(dateStr) || 0) + diffTot);
        monthlyMapLwbp.set(monthStr, (monthlyMapLwbp.get(monthStr) || 0) + diffTot);
        if (isToday) todayLwbpKwh += diffTot;
        if (isCurrentMonth) monthlyLwbpKwh += diffTot;
      }

      totalAvoidedCost += hourAvoidedCost;
      if (isToday) todayAvoidedCost += hourAvoidedCost;
      if (isCurrentMonth) monthlyAvoidedCost += hourAvoidedCost;

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

    if (targetHour >= 0 && targetHour < 24) {
      hourlyMapPoi1.get(dateStr)![targetHour] += diffPoi1;
      hourlyMapPoi2.get(dateStr)![targetHour] += diffPoi2;
      hourlyMapTotal.get(dateStr)![targetHour] += diffTot;
    }
  }

  // Add current ongoing hour's live generation to summary totals (without affecting completed hourly chart bars)
  let appliedDeltaPoi1 = 0;
  let appliedDeltaPoi2 = 0;
  let appliedDeltaTot = 0;

  if (live && records.length > 0) {
    const lastRec = records[records.length - 1];
    const lastTs = (lastRec.ts_text || "").split(".")[0];
    const [lastDateStr] = lastTs.split(" ");
    if (lastDateStr === todayStr) {
      const livePoi1 = (live.poi1?.status && typeof live.poi1.totalKwh === "number") ? live.poi1.totalKwh : null;
      const livePoi2 = (live.poi2?.status && typeof live.poi2.totalKwh === "number") ? live.poi2.totalKwh : null;

      let deltaPoi1 = 0;
      if (livePoi1 !== null && lastRec.poi_1 !== null && livePoi1 >= lastRec.poi_1) {
        deltaPoi1 = livePoi1 - lastRec.poi_1;
      }
      let deltaPoi2 = 0;
      if (livePoi2 !== null && lastRec.poi_2 !== null && livePoi2 >= lastRec.poi_2) {
        deltaPoi2 = livePoi2 - lastRec.poi_2;
      }
      const deltaTot = deltaPoi1 + deltaPoi2;
      if (deltaTot > 0) {
        appliedDeltaPoi1 = deltaPoi1;
        appliedDeltaPoi2 = deltaPoi2;
        appliedDeltaTot = deltaTot;
        totalKwh += deltaTot;
        todayKwh += deltaTot;
        yearlyKwh += deltaTot;
        monthlyKwh += deltaTot;
        poi1TodayKwh += deltaPoi1;
        poi2TodayKwh += deltaPoi2;

        const nowWib = new Date(new Date().getTime() + 7 * 60 * 60 * 1000);
        const currentWibHour = nowWib.getUTCHours();
        const isCurrentWbp = currentWibHour >= 17 && currentWibHour <= 21;
        const curTariff = getTariffForDate(todayStr, tariffs);
        const curAvoidedRate = isCurrentWbp ? curTariff.wbpRate : curTariff.lwbpRate;
        const deltaAvoided = deltaTot * curAvoidedRate;

        if (isCurrentWbp) {
          totalWbpKwh += deltaTot;
          todayWbpKwh += deltaTot;
          monthlyWbpKwh += deltaTot;
        } else {
          totalLwbpKwh += deltaTot;
          todayLwbpKwh += deltaTot;
          monthlyLwbpKwh += deltaTot;
        }
        totalAvoidedCost += deltaAvoided;
        todayAvoidedCost += deltaAvoided;
        monthlyAvoidedCost += deltaAvoided;
      }
    }
  }

  // Live API register
  if (live?.poi1?.peakDemand) {
    poi1PeakDemand = live.poi1.peakDemand;
    poi1PeakDemandTs = live.t_stamp ? new Date(live.t_stamp) : new Date();
  }
  if (live?.poi2?.peakDemand) {
    poi2PeakDemand = live.poi2.peakDemand;
    poi2PeakDemandTs = live.t_stamp ? new Date(live.t_stamp) : new Date();
  }

  const rangePoi1PeakDemand = poi1PeakDemand > 0 ? poi1PeakDemand : (live?.poi1?.peakDemand || 0);
  const rangePoi2PeakDemand = poi2PeakDemand > 0 ? poi2PeakDemand : (live?.poi2?.peakDemand || 0);
  const rangePeakDemand = rangePoi1PeakDemand + rangePoi2PeakDemand;
  const peakDemandTs: Date | null = poi2PeakDemand >= poi1PeakDemand ? (poi2PeakDemandTs || poi1PeakDemandTs) : (poi1PeakDemandTs || poi2PeakDemandTs);

  const isSingleDay = Boolean(fromStr && toStr && fromStr === toStr);
  const isTodayInRange = (!fromStr || todayStr >= fromStr) && (!toStr || todayStr <= toStr);

  let targetDate = isSingleDay ? fromStr! : (isTodayInRange ? todayStr : (toStr || todayStr));
  if (!hourlyMapTotal.has(targetDate)) {
    const dates = Array.from(hourlyMapTotal.keys())
      .filter(d => (!fromStr || d >= fromStr) && (!toStr || d <= toStr) && d <= todayStr)
      .sort();
    if (dates.length > 0) {
      targetDate = dates[dates.length - 1];
    }
  }

  const hourlyPoi1 = hourlyMapPoi1.get(targetDate) || Array.from({ length: 24 }, () => 0);
  const hourlyPoi2 = hourlyMapPoi2.get(targetDate) || Array.from({ length: 24 }, () => 0);
  const hourly = hourlyMapTotal.get(targetDate) || hourlyPoi1.map((v, i) => v + (hourlyPoi2[i] || 0));

  // Progressive real-time calculation for today's active current hour (sequential per-minute delta)
  const nowWib = new Date(new Date().getTime() + 7 * 60 * 60 * 1000);
  const currentWibHour = nowWib.getUTCHours();
  let lastProgressiveMinute: number | null = null;
  if (isTodayInRange) {
    const padHour = (n: number) => String(n).padStart(2, "0");
    const currentHourStart = `${todayStr} ${padHour(currentWibHour)}:00:00`;
    const nextHourStart = `${todayStr} ${padHour(currentWibHour + 1)}:00:00`;

    try {
      const minRowsRes = await pool.query(`
        SELECT t_stamp::text as ts_text, poi_id, total_kwh::float as val
        FROM electric_plts_telemetry_minute
        WHERE t_stamp >= $1 AND t_stamp < $2
          AND total_kwh IS NOT NULL
        ORDER BY t_stamp ASC
      `, [currentHourStart, nextHourStart]);

      let poi1Prog = 0;
      let poi2Prog = 0;
      const rows = minRowsRes.rows;

      const poi1Rows = rows.filter((r: any) => r.poi_id === "POI_1");
      if (poi1Rows.length >= 2) {
        for (let i = 1; i < poi1Rows.length; i++) {
          const pVal = poi1Rows[i - 1].val;
          const cVal = poi1Rows[i].val;
          if (pVal !== null && cVal !== null && pVal > 0 && cVal >= pVal) {
            poi1Prog += (cVal - pVal);
          }
        }
      }

      const poi2Rows = rows.filter((r: any) => r.poi_id === "POI_2");
      if (poi2Rows.length >= 2) {
        for (let i = 1; i < poi2Rows.length; i++) {
          const pVal = poi2Rows[i - 1].val;
          const cVal = poi2Rows[i].val;
          if (pVal !== null && cVal !== null && pVal > 0 && cVal >= pVal) {
            poi2Prog += (cVal - pVal);
          }
        }
      }

      if (rows.length >= 2) {
        const lastRow = rows[rows.length - 1];
        const lastTime = (lastRow.ts_text || "").split(" ")[1] || "";
        const lastMin = parseInt(lastTime.split(":")[1] || "0", 10);
        // Data timestamp 10:17:00 adalah batas akhir menit 16. Menit 17 baru selesai saat 10:18:00 masuk.
        // Maka menit progresif yang telah terkalkulasi adalah lastMin - 1 (contoh: 10:00 - 10:16).
        lastProgressiveMinute = Math.max(0, lastMin - 1);
      }

      const totalProg = poi1Prog + poi2Prog;

      hourlyPoi1[currentWibHour] = poi1Prog;
      hourlyPoi2[currentWibHour] = poi2Prog;
      hourly[currentWibHour] = totalProg;
    } catch {}

    // Ensure all future hours (> currentWibHour) are 0
    for (let h = currentWibHour + 1; h < 24; h++) {
      hourlyPoi1[h] = 0;
      hourlyPoi2[h] = 0;
      hourly[h] = 0;
    }
  }

  // Daily records
  const daily: { day: string; poi1: number; poi2: number; total: number; wbp: number; lwbp: number; avoidedCost: number; savings: number }[] = [];
  if (fromStr && toStr) {
    const cur = new Date(fromDate);
    while (cur <= toDate) {
      const dStr = `${cur.getFullYear()}-${pad(cur.getMonth() + 1)}-${pad(cur.getDate())}`;
      let p1 = dailyMapPoi1.get(dStr) || 0;
      let p2 = dailyMapPoi2.get(dStr) || 0;
      let tot = dailyMapTotal.get(dStr) || (p1 + p2);
      if (dStr === todayStr && appliedDeltaTot > 0) {
        p1 += appliedDeltaPoi1;
        p2 += appliedDeltaPoi2;
        tot += appliedDeltaTot;
      }
      let dWbp = dailyMapWbp.get(dStr) || 0;
      let dLwbp = dailyMapLwbp.get(dStr) || 0;
      if (dStr === todayStr && appliedDeltaTot > 0) {
        const nowWib = new Date(new Date().getTime() + 7 * 60 * 60 * 1000);
        const currentWibHour = nowWib.getUTCHours();
        const isCurrentWbp = currentWibHour >= 17 && currentWibHour <= 21;
        if (isCurrentWbp) {
          dWbp += appliedDeltaTot;
        } else {
          dLwbp += appliedDeltaTot;
        }
      }
      if (dLwbp + dWbp < tot) {
        dLwbp = Math.max(0, tot - dWbp);
      }
      const dTariff = getTariffForDate(dStr, tariffs);
      const dAvoided = (dWbp * dTariff.wbpRate) + (dLwbp * dTariff.lwbpRate);
      const dPvCost = tot * pvRate;
      const dPoi1 = Number(p1.toFixed(2));
      const dPoi2 = Number(p2.toFixed(2));
      const dTot = Number((dPoi1 + dPoi2).toFixed(2));
      daily.push({ 
        day: dStr, 
        poi1: dPoi1, 
        poi2: dPoi2, 
        total: dTot,
        wbp: Number(dWbp.toFixed(2)),
        lwbp: Number(dLwbp.toFixed(2)),
        avoidedCost: Number(dAvoided.toFixed(2)),
        savings: Number(Math.max(0, dAvoided - dPvCost).toFixed(2))
      });
      cur.setDate(cur.getDate() + 1);
    }
  } else {
    const allDates = Array.from(new Set([...dailyMapPoi1.keys(), ...dailyMapPoi2.keys(), ...dailyMapTotal.keys()])).sort();
    allDates.forEach(day => {
      let p1 = dailyMapPoi1.get(day) || 0;
      let p2 = dailyMapPoi2.get(day) || 0;
      let tot = dailyMapTotal.get(day) || (p1 + p2);
      if (day === todayStr && appliedDeltaTot > 0) {
        p1 += appliedDeltaPoi1;
        p2 += appliedDeltaPoi2;
        tot += appliedDeltaTot;
      }
      let dWbp = dailyMapWbp.get(day) || 0;
      let dLwbp = dailyMapLwbp.get(day) || 0;
      if (day === todayStr && appliedDeltaTot > 0) {
        const nowWib = new Date(new Date().getTime() + 7 * 60 * 60 * 1000);
        const currentWibHour = nowWib.getUTCHours();
        const isCurrentWbp = currentWibHour >= 17 && currentWibHour <= 21;
        if (isCurrentWbp) {
          dWbp += appliedDeltaTot;
        } else {
          dLwbp += appliedDeltaTot;
        }
      }
      if (dLwbp + dWbp < tot) {
        dLwbp = Math.max(0, tot - dWbp);
      }
      const dTariff = getTariffForDate(day, tariffs);
      const dAvoided = (dWbp * dTariff.wbpRate) + (dLwbp * dTariff.lwbpRate);
      const dPvCost = tot * pvRate;
      const dPoi1 = Number(p1.toFixed(2));
      const dPoi2 = Number(p2.toFixed(2));
      const dTot = Number((dPoi1 + dPoi2).toFixed(2));
      daily.push({ 
        day, 
        poi1: dPoi1, 
        poi2: dPoi2, 
        total: dTot,
        wbp: Number(dWbp.toFixed(2)),
        lwbp: Number(dLwbp.toFixed(2)),
        avoidedCost: Number(dAvoided.toFixed(2)),
        savings: Number(Math.max(0, dAvoided - dPvCost).toFixed(2))
      });
    });
  }

  // Monthly records
  const monthly: { month: string; poi1: number; poi2: number; total: number; wbp: number; lwbp: number; avoidedCost: number; savings: number }[] = [];
  for (let m = 1; m <= 12; m++) {
    const mStr = `${selectedYear}-${String(m).padStart(2, "0")}`;
    let p1 = monthlyMapPoi1.get(mStr) || 0;
    let p2 = monthlyMapPoi2.get(mStr) || 0;
    let tot = monthlyMapTotal.get(mStr) || (p1 + p2);
    if (mStr === currentMonthStr && appliedDeltaTot > 0) {
      p1 += appliedDeltaPoi1;
      p2 += appliedDeltaPoi2;
      tot += appliedDeltaTot;
    }
    let mWbp = monthlyMapWbp.get(mStr) || 0;
    let mLwbp = monthlyMapLwbp.get(mStr) || 0;
    if (mStr === currentMonthStr && appliedDeltaTot > 0) {
      const nowWib = new Date(new Date().getTime() + 7 * 60 * 60 * 1000);
      const currentWibHour = nowWib.getUTCHours();
      const isCurrentWbp = currentWibHour >= 17 && currentWibHour <= 21;
      if (isCurrentWbp) {
        mWbp += appliedDeltaTot;
      } else {
        mLwbp += appliedDeltaTot;
      }
    }
    if (mLwbp + mWbp < tot) {
      mLwbp = Math.max(0, tot - mWbp);
    }
    const mTariff = getTariffForDate(`${mStr}-01`, tariffs);
    const mAvoided = (mWbp * mTariff.wbpRate) + (mLwbp * mTariff.lwbpRate);
    const mPvCost = tot * pvRate;
    const mPoi1 = Number(p1.toFixed(2));
    const mPoi2 = Number(p2.toFixed(2));
    const mTot = Number((mPoi1 + mPoi2).toFixed(2));
    monthly.push({ 
      month: mStr, 
      poi1: mPoi1, 
      poi2: mPoi2, 
      total: mTot,
      wbp: Number(mWbp.toFixed(2)),
      lwbp: Number(mLwbp.toFixed(2)),
      avoidedCost: Number(mAvoided.toFixed(2)),
      savings: Number(Math.max(0, mAvoided - mPvCost).toFixed(2))
    });
  }

  // Residual rounding reconciliation: Ensure sum of daily chart bars for any month matches monthly totals 100%
  const monthsInDaily = Array.from(new Set(daily.map(d => d.day.substring(0, 7))));
  monthsInDaily.forEach(mStr => {
    const mRecord = monthly.find(m => m.month === mStr);
    if (!mRecord) return;
    const dailyItemsInMonth = daily.filter(d => d.day.startsWith(mStr) && (d.poi1 > 0 || d.poi2 > 0 || d.total > 0));
    if (dailyItemsInMonth.length === 0) return;

    const sumDailyPoi1 = Number(dailyItemsInMonth.reduce((acc, d) => acc + d.poi1, 0).toFixed(2));
    const sumDailyPoi2 = Number(dailyItemsInMonth.reduce((acc, d) => acc + d.poi2, 0).toFixed(2));
    const sumDailyWbp = Number(dailyItemsInMonth.reduce((acc, d) => acc + d.wbp, 0).toFixed(2));
    const sumDailyLwbp = Number(dailyItemsInMonth.reduce((acc, d) => acc + d.lwbp, 0).toFixed(2));
    const sumDailyAvoided = Number(dailyItemsInMonth.reduce((acc, d) => acc + d.avoidedCost, 0).toFixed(2));
    const sumDailySavings = Number(dailyItemsInMonth.reduce((acc, d) => acc + d.savings, 0).toFixed(2));

    const diffPoi1 = Number((mRecord.poi1 - sumDailyPoi1).toFixed(2));
    const diffPoi2 = Number((mRecord.poi2 - sumDailyPoi2).toFixed(2));

    // Reconcile residual fractions on the last active day of that month
    if (Math.abs(diffPoi1) > 0 || Math.abs(diffPoi2) > 0) {
      const lastDay = dailyItemsInMonth[dailyItemsInMonth.length - 1];
      if (Math.abs(diffPoi1) <= 0.05) {
        lastDay.poi1 = Number((lastDay.poi1 + diffPoi1).toFixed(2));
      }
      if (Math.abs(diffPoi2) <= 0.05) {
        lastDay.poi2 = Number((lastDay.poi2 + diffPoi2).toFixed(2));
      }
      lastDay.total = Number((lastDay.poi1 + lastDay.poi2).toFixed(2));
    }

    // Synchronize monthly WBP, LWBP, avoidedCost, and savings with the daily sum to ensure 100% exact match
    mRecord.wbp = sumDailyWbp;
    mRecord.lwbp = sumDailyLwbp;
    mRecord.avoidedCost = sumDailyAvoided;
    mRecord.savings = sumDailySavings;
  });

  let curMonthPoi1 = monthlyMapPoi1.get(currentMonthStr) || 0;
  let curMonthPoi2 = monthlyMapPoi2.get(currentMonthStr) || 0;
  if (appliedDeltaTot > 0) {
    curMonthPoi1 += appliedDeltaPoi1;
    curMonthPoi2 += appliedDeltaPoi2;
  }
  const curMonthPoi1Fixed = Number(curMonthPoi1.toFixed(2));
  const curMonthPoi2Fixed = Number(curMonthPoi2.toFixed(2));
  const curMonthTotalFixed = Number((curMonthPoi1Fixed + curMonthPoi2Fixed).toFixed(2));

  const poi1TotalKwh = live?.poi1?.totalKwh ?? 0;
  const poi2TotalKwh = live?.poi2?.totalKwh ?? 0;

  const estimasiBiayaTerhindarPln = Number(totalAvoidedCost.toFixed(2));
  const estimasiBiaya = estimasiBiayaTerhindarPln;
  const estimasiBiayaPv = Number((totalKwh * pvRate).toFixed(2));
  const estimasiPenghematan = Number(Math.max(0, estimasiBiayaTerhindarPln - estimasiBiayaPv).toFixed(2));
  const savingsRate = Number((totalKwh > 0 ? (estimasiPenghematan / totalKwh) : Math.max(0, currentTariff.lwbpRate - pvRate)).toFixed(2));

  const curMonthRec = monthly.find(m => m.month === currentMonthStr);
  const monthlyBiayaTerhindarPln = curMonthRec ? curMonthRec.avoidedCost : Number(monthlyAvoidedCost.toFixed(2));
  const monthlyBiayaPv = curMonthRec ? Number((curMonthRec.total * pvRate).toFixed(2)) : Number((monthlyKwh * pvRate).toFixed(2));
  const monthlyPenghematan = curMonthRec ? curMonthRec.savings : Number(Math.max(0, monthlyBiayaTerhindarPln - monthlyBiayaPv).toFixed(2));
  const monthlySavingsRate = Number((monthlyKwh > 0 ? (monthlyPenghematan / monthlyKwh) : Math.max(0, currentTariff.lwbpRate - pvRate)).toFixed(2));

  const todayBiayaTerhindarPln = Number(todayAvoidedCost.toFixed(2));
  const todayBiayaPv = Number((todayKwh * pvRate).toFixed(2));
  const todayCost = todayBiayaTerhindarPln;
  const todayPenghematan = Number(Math.max(0, todayBiayaTerhindarPln - todayBiayaPv).toFixed(2));

  return {
    summary: {
      totalKwh: Number(totalKwh.toFixed(2)),
      totalWbpKwh: Number(totalWbpKwh.toFixed(2)),
      totalLwbpKwh: Number(totalLwbpKwh.toFixed(2)),
      todayKwh: Number(todayKwh.toFixed(2)),
      todayWbpKwh: Number(todayWbpKwh.toFixed(2)),
      todayLwbpKwh: Number(todayLwbpKwh.toFixed(2)),
      monthlyKwh: curMonthTotalFixed,
      monthlyWbpKwh: Number(monthlyWbpKwh.toFixed(2)),
      monthlyLwbpKwh: Number(monthlyLwbpKwh.toFixed(2)),
      poi1MonthlyKwh: curMonthPoi1Fixed,
      poi2MonthlyKwh: curMonthPoi2Fixed,
      yearlyKwh: Number(yearlyKwh.toFixed(2)),
      estimasiBiaya,
      estimasiBiayaTerhindarPln,
      estimasiBiayaPv,
      estimasiPenghematan,
      monthlyBiayaTerhindarPln,
      monthlyBiayaPv: Number((curMonthTotalFixed * pvRate).toFixed(2)),
      monthlyPenghematan,
      monthlySavingsRate,
      todayCost,
      todayBiayaTerhindarPln,
      todayBiayaPv,
      todayPenghematan,
      savingsRate,
      poi1TodayKwh: Number(poi1TodayKwh.toFixed(2)),
      poi2TodayKwh: Number(poi2TodayKwh.toFixed(2)),
      poi1TotalKwh: Number(poi1TotalKwh.toFixed(2)),
      poi2TotalKwh: Number(poi2TotalKwh.toFixed(2)),
      poi1PeakDemand: Number(rangePoi1PeakDemand.toFixed(2)),
      poi1PeakDemandTs: poi1PeakDemandTs ? poi1PeakDemandTs.toISOString() : null,
      poi2PeakDemand: Number(rangePoi2PeakDemand.toFixed(2)),
      poi2PeakDemandTs: poi2PeakDemandTs ? poi2PeakDemandTs.toISOString() : null,
      peakDemand: Number(rangePeakDemand.toFixed(2)),
      peakDemandTs: peakDemandTs ? peakDemandTs.toISOString() : null,
      rangePoi1PeakDemand: Number(rangePoi1PeakDemand.toFixed(2)),
      rangePoi1PeakDemandTs: poi1PeakDemandTs ? poi1PeakDemandTs.toISOString() : null,
      rangePoi2PeakDemand: Number(rangePoi2PeakDemand.toFixed(2)),
      rangePoi2PeakDemandTs: poi2PeakDemandTs ? poi2PeakDemandTs.toISOString() : null,
      rangePeakDemand: Number(rangePeakDemand.toFixed(2)),
      rangePeakDemandTs: peakDemandTs ? peakDemandTs.toISOString() : null,
      rangePoi1Kwh: Number(Array.from(dailyMapPoi1.values()).reduce((a, b) => a + b, 0).toFixed(2)),
      rangePoi2Kwh: Number(Array.from(dailyMapPoi2.values()).reduce((a, b) => a + b, 0).toFixed(2)),
      solarRate: currentTariff.lwbpRate,
      lwbpRate: currentTariff.lwbpRate,
      wbpRate: currentTariff.wbpRate,
      pvRate
    },
    charts: {
      hourly,
      hourlyPoi1,
      hourlyPoi2,
      daily,
      monthly,
      currentHour: currentWibHour,
      progressiveMinute: lastProgressiveMinute
    },
    live
  };
};
