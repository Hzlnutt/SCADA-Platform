import { getPostgresPool } from "../../database/postgres";
import { getMongoDb } from "../../database/mongo";
import { GLOBAL_CONFIG_COLLECTION } from "../../database/collections";
import { defaultGasConfig } from "../config/config.controller";

// ─── WIB Timezone helpers (GMT+7) ───────────────────────────────────────────

function getWibDateString(date: Date): string {
  const wibTime = new Date(date.getTime() + 7 * 60 * 60 * 1000);
  const y = wibTime.getUTCFullYear();
  const m = String(wibTime.getUTCMonth() + 1).padStart(2, "0");
  const d = String(wibTime.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function getWibHour(date: Date): number {
  const utcHour = date.getUTCHours();
  return (utcHour + 7) % 24;
}

function daysInMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate();
}

// ─── Result types ───────────────────────────────────────────────────────────

export interface GasAnalyticsResult {
  summary: {
    todaySm3: number;
    monthlySm3: number;
    yearlySm3: number;
    totalSm3: number;
    peakHourlySm3: number;

    todayCostIdr: number;
    monthlyCostIdr: number;
    yearlyCostIdr: number;
    totalCostIdr: number;

    todayCostUsd: number;
    monthlyCostUsd: number;
    yearlyCostUsd: number;
    totalCostUsd: number;

    perDeviceSummary: {
      deviceId: string;
      totalSm3: number;
      monthlySm3: number;
      todaySm3: number;
      totalCostIdr: number;
      totalCostUsd: number;
    }[];
  };
  charts: {
    hourly: number[];
    prevHourly: number[];
    daily: { day: string; value: number }[];
    monthly: { month: string; value: number }[];
    perDeviceMonthly: {
      deviceId: string;
      monthly: { month: string; value: number }[];
    }[];
    perDeviceDaily: {
      deviceId: string;
      daily: { day: string; value: number }[];
    }[];
    perDeviceHourly: {
      deviceId: string;
      hourly: number[];
    }[];
  };
  devices: string[];
}

// ─── Main analytics function ────────────────────────────────────────────────

export const getGasAnalytics = async (
  deviceId?: string,
  fromStr?: string,
  toStr?: string,
  year?: number
): Promise<GasAnalyticsResult> => {
  const pool = getPostgresPool();

  // Load configuration from Mongo
  let gasTariff = defaultGasConfig.pricePerSm3;
  let gasUsdMmbtu = defaultGasConfig.usdPerMmbtu;
  try {
    const db = getMongoDb();
    const config = await db.collection(GLOBAL_CONFIG_COLLECTION).findOne({ key: "utility" });
    if (config?.gasConfig) {
      gasTariff = config.gasConfig.pricePerSm3 ?? defaultGasConfig.pricePerSm3;
      gasUsdMmbtu = config.gasConfig.usdPerMmbtu ?? defaultGasConfig.usdPerMmbtu;
    }
  } catch (e) {
    console.warn("Failed to load gas config from Mongo, using defaults:", e);
  }

  const selectedYear =
    year || (fromStr ? parseInt(fromStr.split("-")[0]) : new Date().getFullYear());
  const from = fromStr
    ? new Date(fromStr.includes("T") ? fromStr : `${fromStr}T00:00:00.000+07:00`)
    : new Date(`${selectedYear}-01-01T00:00:00.000+07:00`);
  const to = toStr
    ? new Date(toStr.includes("T") ? toStr : `${toStr}T23:59:59.999+07:00`)
    : new Date(`${selectedYear}-12-31T23:59:59.999+07:00`);

  // Query gas_telemetry
  let query = `
    SELECT t_stamp AS ts, gas_sm3::float AS value, id_device
    FROM gas_telemetry
    WHERE t_stamp >= $1 AND t_stamp <= $2
  `;
  const params: any[] = [from, to];

  if (deviceId) {
    query += ` AND id_device = $3`;
    params.push(deviceId);
  }

  query += ` ORDER BY id_device, t_stamp ASC`;

  let records: { ts: Date; value: number; id_device: string }[] = [];
  try {
    const res = await pool.query(query, params);
    records = res.rows.map((row) => ({
      ts: row.ts,
      value: row.value,
      id_device: row.id_device
    }));
  } catch (err) {
    console.warn("PostgreSQL query failed for gas analytics:", err);
  }

  // Get unique devices
  const deviceSet = new Set<string>();
  for (const r of records) {
    deviceSet.add(r.id_device);
  }
  const devices = Array.from(deviceSet).sort();

  // Group records by device
  const recordsByDevice = new Map<string, { ts: Date; value: number }[]>();
  for (const r of records) {
    if (!recordsByDevice.has(r.id_device)) {
      recordsByDevice.set(r.id_device, []);
    }
    recordsByDevice.get(r.id_device)!.push({ ts: r.ts, value: r.value });
  }

  const todayStr = getWibDateString(new Date());
  const currentMonthStr = todayStr.substring(0, 7);

  // Totals across all devices
  const dailyMap = new Map<string, number>();
  const monthlyMap = new Map<string, number>();
  const dailyHourlyMap = new Map<string, number[]>();

  // Totals per device
  const perDeviceTotal = new Map<string, number>();
  const perDeviceToday = new Map<string, number>();
  const perDeviceCurrentMonth = new Map<string, number>();

  const perDeviceMonthly = new Map<string, Map<string, number>>();
  const perDeviceDaily = new Map<string, Map<string, number>>();
  const perDeviceHourly = new Map<string, Map<string, number[]>>();

  // Initialize maps per device
  for (const devId of devices) {
    perDeviceTotal.set(devId, 0);
    perDeviceToday.set(devId, 0);
    perDeviceCurrentMonth.set(devId, 0);
    perDeviceMonthly.set(devId, new Map<string, number>());
    perDeviceDaily.set(devId, new Map<string, number>());
    perDeviceHourly.set(devId, new Map<string, number[]>());
  }

  let totalSm3 = 0;
  let todaySm3 = 0;
  let monthlySm3 = 0;
  let yearlySm3 = 0;
  let peakHourlySm3 = 0;

  // Process consumption diffs
  for (const [devId, devRecords] of recordsByDevice) {
    const devMonthlyMap = perDeviceMonthly.get(devId)!;
    const devDailyMap = perDeviceDaily.get(devId)!;
    const devHourlyMap = perDeviceHourly.get(devId)!;

    for (let i = 1; i < devRecords.length; i++) {
      const prev = devRecords[i - 1];
      const curr = devRecords[i];

      let diff = curr.value - prev.value;
      if (diff < 0) {
        // Handle roll-over or reset
        diff = 0;
      }

      const dateStr = getWibDateString(prev.ts);
      const monthStr = dateStr.substring(0, 7);
      const hour = getWibHour(prev.ts);
      const isToday = dateStr === todayStr;
      const isCurrentMonth = monthStr === currentMonthStr;

      if (diff > peakHourlySm3) peakHourlySm3 = diff;

      totalSm3 += diff;
      yearlySm3 += diff;

      if (isToday) todaySm3 += diff;
      if (isCurrentMonth) monthlySm3 += diff;

      // Aggregations
      dailyMap.set(dateStr, (dailyMap.get(dateStr) || 0) + diff);
      monthlyMap.set(monthStr, (monthlyMap.get(monthStr) || 0) + diff);

      if (!dailyHourlyMap.has(dateStr)) {
        dailyHourlyMap.set(dateStr, Array.from({ length: 24 }, () => 0));
      }
      const dayHours = dailyHourlyMap.get(dateStr)!;
      if (hour >= 0 && hour < 24) {
        dayHours[hour] += diff;
      }

      // Device calculations
      perDeviceTotal.set(devId, (perDeviceTotal.get(devId) || 0) + diff);
      devMonthlyMap.set(monthStr, (devMonthlyMap.get(monthStr) || 0) + diff);
      devDailyMap.set(dateStr, (devDailyMap.get(dateStr) || 0) + diff);

      if (!devHourlyMap.has(dateStr)) {
        devHourlyMap.set(dateStr, Array.from({ length: 24 }, () => 0));
      }
      const devDayHours = devHourlyMap.get(dateStr)!;
      if (hour >= 0 && hour < 24) {
        devDayHours[hour] += diff;
      }

      if (isToday) {
        perDeviceToday.set(devId, (perDeviceToday.get(devId) || 0) + diff);
      }
      if (isCurrentMonth) {
        perDeviceCurrentMonth.set(devId, (perDeviceCurrentMonth.get(devId) || 0) + diff);
      }
    }
  }

  // ── Build charts ──────────────────────────────────────────────────────────

  let latestWibDate =
    records.length > 0 ? getWibDateString(records[records.length - 1].ts) : todayStr;

  const hourlyValues = dailyHourlyMap.get(latestWibDate) || Array.from({ length: 24 }, () => 0);

  const yesterdayDate = new Date(new Date().getTime() - 24 * 60 * 60 * 1000);
  const yesterdayStr = getWibDateString(yesterdayDate);
  const prevHourlyValues = dailyHourlyMap.get(yesterdayStr) || Array.from({ length: 24 }, () => 0);

  const monthly: { month: string; value: number }[] = [];
  for (let m = 1; m <= 12; m++) {
    const monthKey = `${selectedYear}-${String(m).padStart(2, "0")}`;
    monthly.push({
      month: monthKey,
      value: monthlyMap.get(monthKey) || 0
    });
  }

  const daily: { day: string; value: number }[] = [];
  for (let m = 1; m <= 12; m++) {
    const numDays = daysInMonth(selectedYear, m);
    for (let d = 1; d <= numDays; d++) {
      const dayKey = `${selectedYear}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
      daily.push({
        day: dayKey,
        value: dailyMap.get(dayKey) || 0
      });
    }
  }

  const perDeviceMonthlyChart = devices.map((devId) => {
    const devMonthMap = perDeviceMonthly.get(devId)!;
    const devMonthly: { month: string; value: number }[] = [];
    for (let m = 1; m <= 12; m++) {
      const monthKey = `${selectedYear}-${String(m).padStart(2, "0")}`;
      devMonthly.push({
        month: monthKey,
        value: devMonthMap.get(monthKey) || 0
      });
    }
    return { deviceId: devId, monthly: devMonthly };
  });

  const perDeviceDailyChart = devices.map((devId) => {
    const devDayMap = perDeviceDaily.get(devId)!;
    const devDaily: { day: string; value: number }[] = [];
    for (let m = 1; m <= 12; m++) {
      const numDays = daysInMonth(selectedYear, m);
      for (let d = 1; d <= numDays; d++) {
        const dayKey = `${selectedYear}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
        devDaily.push({
          day: dayKey,
          value: devDayMap.get(dayKey) || 0
        });
      }
    }
    return { deviceId: devId, daily: devDaily };
  });

  const perDeviceHourlyChart = devices.map((devId) => {
    const devHourMap = perDeviceHourly.get(devId)!;
    const devHourly = devHourMap.get(latestWibDate) || Array.from({ length: 24 }, () => 0);
    return { deviceId: devId, hourly: devHourly };
  });

  // Calculate costs using MMBTU and IDR conversions
  const sm3ToMmbtu = (sm3: number) => sm3 * 0.03531;

  const calculateCostIdr = (sm3: number) => sm3 * gasTariff;
  const calculateCostUsd = (sm3: number) => sm3ToMmbtu(sm3) * gasUsdMmbtu;

  const perDeviceSummary = devices.map((devId) => {
    const devTotal = perDeviceTotal.get(devId) || 0;
    const devMonth = perDeviceCurrentMonth.get(devId) || 0;
    const devToday = perDeviceToday.get(devId) || 0;
    return {
      deviceId: devId,
      totalSm3: Number(devTotal.toFixed(3)),
      monthlySm3: Number(devMonth.toFixed(3)),
      todaySm3: Number(devToday.toFixed(3)),
      totalCostIdr: Number(calculateCostIdr(devTotal).toFixed(0)),
      totalCostUsd: Number(calculateCostUsd(devTotal).toFixed(2))
    };
  });

  return {
    summary: {
      todaySm3: Number(todaySm3.toFixed(3)),
      monthlySm3: Number(monthlySm3.toFixed(3)),
      yearlySm3: Number(yearlySm3.toFixed(3)),
      totalSm3: Number(totalSm3.toFixed(3)),
      peakHourlySm3: Number(peakHourlySm3.toFixed(3)),

      todayCostIdr: Number(calculateCostIdr(todaySm3).toFixed(0)),
      monthlyCostIdr: Number(calculateCostIdr(monthlySm3).toFixed(0)),
      yearlyCostIdr: Number(calculateCostIdr(yearlySm3).toFixed(0)),
      totalCostIdr: Number(calculateCostIdr(totalSm3).toFixed(0)),

      todayCostUsd: Number(calculateCostUsd(todaySm3).toFixed(2)),
      monthlyCostUsd: Number(calculateCostUsd(monthlySm3).toFixed(2)),
      yearlyCostUsd: Number(calculateCostUsd(yearlySm3).toFixed(2)),
      totalCostUsd: Number(calculateCostUsd(totalSm3).toFixed(2)),

      perDeviceSummary
    },
    charts: {
      hourly: hourlyValues,
      prevHourly: prevHourlyValues,
      daily,
      monthly,
      perDeviceMonthly: perDeviceMonthlyChart,
      perDeviceDaily: perDeviceDailyChart,
      perDeviceHourly: perDeviceHourlyChart
    },
    devices
  };
};
