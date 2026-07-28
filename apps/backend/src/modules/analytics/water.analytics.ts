import { getPostgresPool } from "../../database/postgres";

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

export interface WaterAnalyticsResult {
  summary: {
    todayM3: number;
    monthlyM3: number;
    yearlyM3: number;
    totalM3: number;
    peakHourlyM3: number;
    
    todayKwh: number;
    monthlyKwh: number;
    yearlyKwh: number;
    totalKwh: number;
    peakHourlyKwh: number;

    /** Per-device breakdown for the selected year */
    perDeviceSummary: {
      deviceId: string;
      totalM3: number;
      monthlyM3: number;
      todayM3: number;
      totalKwh: number;
      monthlyKwh: number;
      todayKwh: number;
    }[];
  };
  charts: {
    /** Hourly consumption for latest day (24 slots) */
    hourly: number[];
    hourlyKwh: number[];
    /** Previous day hourly for comparison */
    prevHourly: number[];
    prevHourlyKwh: number[];
    /** Daily consumption */
    daily: { day: string; value: number; valueKwh: number }[];
    /** Monthly consumption (always 12 months Jan-Dec) */
    monthly: { month: string; value: number; valueKwh: number }[];
    /** Per-device monthly breakdown */
    perDeviceMonthly: {
      deviceId: string;
      monthly: { month: string; value: number; valueKwh: number }[];
    }[];
    /** Per-device daily breakdown */
    perDeviceDaily: {
      deviceId: string;
      daily: { day: string; value: number; valueKwh: number }[];
    }[];
    /** Per-device hourly breakdown for latest day */
    perDeviceHourly: {
      deviceId: string;
      hourly: number[];
      hourlyKwh: number[];
    }[];
  };
  devices: string[];
}

// ─── Main analytics function ────────────────────────────────────────────────

export const getWaterAnalytics = async (
  deviceId?: string,
  fromStr?: string,
  toStr?: string,
  year?: number
): Promise<WaterAnalyticsResult> => {
  const pool = getPostgresPool();

  const selectedYear =
    year || (fromStr ? parseInt(fromStr.split("-")[0]) : new Date().getFullYear());
  const from = fromStr
    ? new Date(fromStr.includes("T") ? fromStr : `${fromStr}T00:00:00.000+07:00`)
    : new Date(`${selectedYear}-01-01T00:00:00.000+07:00`);
  const to = toStr
    ? new Date(toStr.includes("T") ? toStr : `${toStr}T23:59:59.999+07:00`)
    : new Date(`${selectedYear}-12-31T23:59:59.999+07:00`);

  // ── Fetch hourly records from water_telemetry ──────────────────────────
  // Water_m3 is a cumulative counter; consumption = diff between consecutive records.
  // When a specific deviceId is provided, filter by it; otherwise fetch all.
  let query = `
    SELECT t_stamp AS ts, water_m3::float AS value, COALESCE(water_kwh::float, water_m3::float * 0.4) AS value_kwh, id_device
    FROM water_telemetry
    WHERE t_stamp >= $1 AND t_stamp <= $2
  `;
  const params: any[] = [from, to];

  if (deviceId) {
    query += ` AND id_device = $3`;
    params.push(deviceId);
  }

  query += ` ORDER BY id_device, t_stamp ASC`;

  let records: { ts: Date; value: number; valueKwh: number; id_device: string }[] = [];
  try {
    const res = await pool.query(query, params);
    records = res.rows.map((row) => ({
      ts: row.ts,
      value: row.value,
      valueKwh: row.value_kwh,
      id_device: row.id_device
    }));
  } catch (err) {
    console.warn("PostgreSQL query failed for water analytics:", err);
  }

  // ── Get unique devices ─────────────────────────────────────────────────
  const deviceSet = new Set<string>();
  for (const r of records) {
    deviceSet.add(r.id_device);
  }
  const devices = Array.from(deviceSet).sort();

  // ── Group records by device ────────────────────────────────────────────
  const recordsByDevice = new Map<string, { ts: Date; value: number; valueKwh: number }[]>();
  for (const r of records) {
    if (!recordsByDevice.has(r.id_device)) {
      recordsByDevice.set(r.id_device, []);
    }
    recordsByDevice.get(r.id_device)!.push({ ts: r.ts, value: r.value, valueKwh: r.valueKwh });
  }

  // ── Compute diffs (consumption) per device ─────────────────────────────
  const todayStr = getWibDateString(new Date());
  const currentMonthStr = todayStr.substring(0, 7);

  // Aggregated across all devices
  const dailyMap = new Map<string, number>();
  const monthlyMap = new Map<string, number>();
  const dailyHourlyMap = new Map<string, number[]>();

  const dailyKwhMap = new Map<string, number>();
  const monthlyKwhMap = new Map<string, number>();
  const dailyHourlyKwhMap = new Map<string, number[]>();

  // Per-device tracking
  const perDeviceTotal = new Map<string, number>();
  const perDeviceMonthly = new Map<string, Map<string, number>>();
  const perDeviceDaily = new Map<string, Map<string, number>>();
  const perDeviceHourly = new Map<string, Map<string, number[]>>();
  const perDeviceToday = new Map<string, number>();
  const perDeviceCurrentMonth = new Map<string, number>();

  const perDeviceTotalKwh = new Map<string, number>();
  const perDeviceMonthlyKwh = new Map<string, Map<string, number>>();
  const perDeviceDailyKwh = new Map<string, Map<string, number>>();
  const perDeviceHourlyKwh = new Map<string, Map<string, number[]>>();
  const perDeviceTodayKwh = new Map<string, number>();
  const perDeviceCurrentMonthKwh = new Map<string, number>();

  let totalM3 = 0, totalKwh = 0;
  let todayM3 = 0, todayKwh = 0;
  let monthlyM3 = 0, monthlyKwh = 0;
  let yearlyM3 = 0, yearlyKwh = 0;
  let peakHourlyM3 = 0, peakHourlyKwh = 0;

  for (const [devId, devRecords] of recordsByDevice) {
    perDeviceTotal.set(devId, 0);
    perDeviceMonthly.set(devId, new Map<string, number>());
    perDeviceDaily.set(devId, new Map<string, number>());
    perDeviceHourly.set(devId, new Map<string, number[]>());
    perDeviceToday.set(devId, 0);
    perDeviceCurrentMonth.set(devId, 0);

    perDeviceTotalKwh.set(devId, 0);
    perDeviceMonthlyKwh.set(devId, new Map<string, number>());
    perDeviceDailyKwh.set(devId, new Map<string, number>());
    perDeviceHourlyKwh.set(devId, new Map<string, number[]>());
    perDeviceTodayKwh.set(devId, 0);
    perDeviceCurrentMonthKwh.set(devId, 0);

    for (let i = 1; i < devRecords.length; i++) {
      const prev = devRecords[i - 1];
      const curr = devRecords[i];
      let diff = curr.value - prev.value;
      if (diff < 0) diff = 0; // Guard against counter resets
      let diffKwh = curr.valueKwh - prev.valueKwh;
      if (diffKwh < 0) diffKwh = 0;

      const dateStr = getWibDateString(prev.ts);
      const monthStr = dateStr.substring(0, 7);
      const hour = getWibHour(prev.ts);
      const isToday = dateStr === todayStr;
      const isCurrentMonth = monthStr === currentMonthStr;

      // Track peak hourly
      if (diff > peakHourlyM3) peakHourlyM3 = diff;
      if (diffKwh > peakHourlyKwh) peakHourlyKwh = diffKwh;

      // ── Aggregate totals ──
      totalM3 += diff;
      yearlyM3 += diff;
      totalKwh += diffKwh;
      yearlyKwh += diffKwh;

      if (isToday) {
        todayM3 += diff;
        todayKwh += diffKwh;
      }
      if (isCurrentMonth) {
        monthlyM3 += diff;
        monthlyKwh += diffKwh;
      }

      // ── Daily aggregation ──
      dailyMap.set(dateStr, (dailyMap.get(dateStr) || 0) + diff);
      dailyKwhMap.set(dateStr, (dailyKwhMap.get(dateStr) || 0) + diffKwh);

      // ── Monthly aggregation ──
      monthlyMap.set(monthStr, (monthlyMap.get(monthStr) || 0) + diff);
      monthlyKwhMap.set(monthStr, (monthlyKwhMap.get(monthStr) || 0) + diffKwh);

      // ── Hourly aggregation (per day) ──
      if (!dailyHourlyMap.has(dateStr)) {
        dailyHourlyMap.set(dateStr, Array.from({ length: 24 }, () => 0));
        dailyHourlyKwhMap.set(dateStr, Array.from({ length: 24 }, () => 0));
      }
      const dayHours = dailyHourlyMap.get(dateStr)!;
      const dayHoursKwh = dailyHourlyKwhMap.get(dateStr)!;
      if (hour >= 0 && hour < 24) {
        dayHours[hour] += diff;
        dayHoursKwh[hour] += diffKwh;
      }

      // ── Per-device aggregation ──
      perDeviceTotal.set(devId, (perDeviceTotal.get(devId) || 0) + diff);
      perDeviceTotalKwh.set(devId, (perDeviceTotalKwh.get(devId) || 0) + diffKwh);

      const devMonthMap = perDeviceMonthly.get(devId)!;
      devMonthMap.set(monthStr, (devMonthMap.get(monthStr) || 0) + diff);
      const devMonthMapKwh = perDeviceMonthlyKwh.get(devId)!;
      devMonthMapKwh.set(monthStr, (devMonthMapKwh.get(monthStr) || 0) + diffKwh);
      
      const devDayMap = perDeviceDaily.get(devId)!;
      devDayMap.set(dateStr, (devDayMap.get(dateStr) || 0) + diff);
      const devDayMapKwh = perDeviceDailyKwh.get(devId)!;
      devDayMapKwh.set(dateStr, (devDayMapKwh.get(dateStr) || 0) + diffKwh);

      const devHourMap = perDeviceHourly.get(devId)!;
      if (!devHourMap.has(dateStr)) {
        devHourMap.set(dateStr, Array.from({ length: 24 }, () => 0));
      }
      const devDayHours = devHourMap.get(dateStr)!;
      if (hour >= 0 && hour < 24) {
        devDayHours[hour] += diff;
      }

      const devHourMapKwh = perDeviceHourlyKwh.get(devId)!;
      if (!devHourMapKwh.has(dateStr)) {
        devHourMapKwh.set(dateStr, Array.from({ length: 24 }, () => 0));
      }
      const devDayHoursKwh = devHourMapKwh.get(dateStr)!;
      if (hour >= 0 && hour < 24) {
        devDayHoursKwh[hour] += diffKwh;
      }

      if (isToday) {
        perDeviceToday.set(devId, (perDeviceToday.get(devId) || 0) + diff);
        perDeviceTodayKwh.set(devId, (perDeviceTodayKwh.get(devId) || 0) + diffKwh);
      }
      if (isCurrentMonth) {
        perDeviceCurrentMonth.set(devId, (perDeviceCurrentMonth.get(devId) || 0) + diff);
        perDeviceCurrentMonthKwh.set(devId, (perDeviceCurrentMonthKwh.get(devId) || 0) + diffKwh);
      }
    }
  }

  // ── Build hourly chart for today (or latest day with data) ─────────────
  let latestWibDate =
    records.length > 0
      ? getWibDateString(records[records.length - 1].ts)
      : todayStr;
  const hourlyValues =
    dailyHourlyMap.get(latestWibDate) ||
    Array.from({ length: 24 }, () => 0);
  const hourlyKwhValues =
    dailyHourlyKwhMap.get(latestWibDate) ||
    Array.from({ length: 24 }, () => 0);

  // Previous day hourly for comparison
  const yesterdayDate = new Date(new Date().getTime() - 24 * 60 * 60 * 1000);
  const yesterdayStr = getWibDateString(yesterdayDate);
  const prevHourlyValues =
    dailyHourlyMap.get(yesterdayStr) ||
    Array.from({ length: 24 }, () => 0);
  const prevHourlyKwhValues =
    dailyHourlyKwhMap.get(yesterdayStr) ||
    Array.from({ length: 24 }, () => 0);

  // ── Build monthly chart (always Jan-Dec) ───────────────────────────────
  const monthly: { month: string; value: number; valueKwh: number }[] = [];
  for (let m = 1; m <= 12; m++) {
    const monthKey = `${selectedYear}-${String(m).padStart(2, "0")}`;
    monthly.push({
      month: monthKey,
      value: monthlyMap.get(monthKey) || 0,
      valueKwh: monthlyKwhMap.get(monthKey) || 0
    });
  }

  // ── Build daily chart (all days in year) ───────────────────────────────
  const daily: { day: string; value: number; valueKwh: number }[] = [];
  for (let m = 1; m <= 12; m++) {
    const numDays = daysInMonth(selectedYear, m);
    for (let d = 1; d <= numDays; d++) {
      const dayKey = `${selectedYear}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
      daily.push({
        day: dayKey,
        value: dailyMap.get(dayKey) || 0,
        valueKwh: dailyKwhMap.get(dayKey) || 0
      });
    }
  }

  // ── Build per-device monthly breakdown ─────────────────────────────────
  const perDeviceMonthlyChart = devices.map((devId) => {
    const devMonthMap = perDeviceMonthly.get(devId)!;
    const devMonthMapKwh = perDeviceMonthlyKwh.get(devId)!;
    const devMonthly: { month: string; value: number; valueKwh: number }[] = [];
    for (let m = 1; m <= 12; m++) {
      const monthKey = `${selectedYear}-${String(m).padStart(2, "0")}`;
      devMonthly.push({
        month: monthKey,
        value: devMonthMap.get(monthKey) || 0,
        valueKwh: devMonthMapKwh.get(monthKey) || 0
      });
    }
    return { deviceId: devId, monthly: devMonthly };
  });

  // ── Build per-device daily breakdown ───────────────────────────────────
  const perDeviceDailyChart = devices.map((devId) => {
    const devDayMap = perDeviceDaily.get(devId)!;
    const devDayMapKwh = perDeviceDailyKwh.get(devId)!;
    const devDaily: { day: string; value: number; valueKwh: number }[] = [];
    for (let m = 1; m <= 12; m++) {
      const numDays = daysInMonth(selectedYear, m);
      for (let d = 1; d <= numDays; d++) {
        const dayKey = `${selectedYear}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
        devDaily.push({
          day: dayKey,
          value: devDayMap.get(dayKey) || 0,
          valueKwh: devDayMapKwh.get(dayKey) || 0
        });
      }
    }
    return { deviceId: devId, daily: devDaily };
  });

  // ── Build per-device hourly breakdown ──────────────────────────────────
  const perDeviceHourlyChart = devices.map((devId) => {
    const devHourMap = perDeviceHourly.get(devId)!;
    const devHourly = devHourMap.get(latestWibDate) || Array.from({ length: 24 }, () => 0);
    const devHourMapKwh = perDeviceHourlyKwh.get(devId)!;
    const devHourlyKwh = devHourMapKwh.get(latestWibDate) || Array.from({ length: 24 }, () => 0);
    return { deviceId: devId, hourly: devHourly, hourlyKwh: devHourlyKwh };
  });

  // ── Build per-device summary ───────────────────────────────────────────
  const perDeviceSummary = devices.map((devId) => ({
    deviceId: devId,
    totalM3: Number((perDeviceTotal.get(devId) || 0).toFixed(3)),
    monthlyM3: Number((perDeviceCurrentMonth.get(devId) || 0).toFixed(3)),
    todayM3: Number((perDeviceToday.get(devId) || 0).toFixed(3)),
    totalKwh: Number((perDeviceTotalKwh.get(devId) || 0).toFixed(3)),
    monthlyKwh: Number((perDeviceCurrentMonthKwh.get(devId) || 0).toFixed(3)),
    todayKwh: Number((perDeviceTodayKwh.get(devId) || 0).toFixed(3))
  }));

  return {
    summary: {
      todayM3: Number(todayM3.toFixed(3)),
      monthlyM3: Number(monthlyM3.toFixed(3)),
      yearlyM3: Number(yearlyM3.toFixed(3)),
      totalM3: Number(totalM3.toFixed(3)),
      peakHourlyM3: Number(peakHourlyM3.toFixed(3)),

      todayKwh: Number(todayKwh.toFixed(3)),
      monthlyKwh: Number(monthlyKwh.toFixed(3)),
      yearlyKwh: Number(yearlyKwh.toFixed(3)),
      totalKwh: Number(totalKwh.toFixed(3)),
      peakHourlyKwh: Number(peakHourlyKwh.toFixed(3)),

      perDeviceSummary
    },
    charts: {
      hourly: hourlyValues,
      hourlyKwh: hourlyKwhValues,
      prevHourly: prevHourlyValues,
      prevHourlyKwh: prevHourlyKwhValues,
      daily,
      monthly,
      perDeviceMonthly: perDeviceMonthlyChart,
      perDeviceDaily: perDeviceDailyChart,
      perDeviceHourly: perDeviceHourlyChart
    },
    devices
  };
};
