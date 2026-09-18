import { NextFunction, Request, Response } from "express";
import { getAnalyticsSummary } from "./analytics.service";
import { getElectricityAnalytics } from "./electricity.analytics";
import { getWaterAnalytics } from "./water.analytics";
import { getGasAnalytics } from "./gas.analytics";
import { getSolarAnalytics } from "./solar.analytics";
import { getMongoDb } from "../../database/mongo";
import { GLOBAL_CONFIG_COLLECTION } from "../../database/collections";
import { getPostgresPool } from "../../database/postgres";
import { defaultWaterConfig } from "../config/config.controller";
import { calculateWaterCost } from "../../utils/water";
import { getElectricityExportData, generateElectricityExcelWorkbook } from "./electricity.export";

export const getAnalyticsSummaryHandler = async (
  _req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const data = await getAnalyticsSummary();
    res.json({ data });
  } catch (err) {
    next(err);
  }
};

export const getElectricityAnalyticsHandler = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const deviceId = (req.query.deviceId as string) || "Cubicle_PLN_PM8000";
    const from = req.query.from as string | undefined;
    const to = req.query.to as string | undefined;
    const year = req.query.year ? Number(req.query.year) : undefined;

    const db = getMongoDb();
    const config = await db.collection(GLOBAL_CONFIG_COLLECTION).findOne({ key: "utility" });
    const wbpRate = config ? config.wbpRate : 1600;
    const lwbpRate = config ? config.lwbpRate : 1112;

    const data = await getElectricityAnalytics(deviceId, from, to, lwbpRate, wbpRate, year);
    res.json({ data });
  } catch (err) {
    next(err);
  }
};

export const getWaterAnalyticsHandler = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const deviceId = req.query.deviceId as string | undefined;
    const from = req.query.from as string | undefined;
    const to = req.query.to as string | undefined;
    const year = req.query.year ? Number(req.query.year) : undefined;

    const data = await getWaterAnalytics(deviceId, from, to, year);
    res.json({ data });
  } catch (err) {
    next(err);
  }
};

export const getGasAnalyticsHandler = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const deviceId = req.query.deviceId as string | undefined;
    const from = req.query.from as string | undefined;
    const to = req.query.to as string | undefined;
    const year = req.query.year ? Number(req.query.year) : undefined;

    const data = await getGasAnalytics(deviceId, from, to, year);
    res.json({ data });
  } catch (err) {
    next(err);
  }
};

export const getSolarAnalyticsHandler = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const from = req.query.from as string | undefined;
    const to = req.query.to as string | undefined;
    const year = req.query.year ? Number(req.query.year) : undefined;

    const data = await getSolarAnalytics(from, to, year);
    res.json({ data });
  } catch (err) {
    next(err);
  }
};


export const getRunningHoursHandler = async (
  _req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const pool = getPostgresPool();
    const result = await pool.query("SELECT tag_id, total_running_hours FROM equipment_running_hours");
    const runningHoursMap = result.rows.reduce((acc, row) => {
      acc[row.tag_id] = parseFloat(row.total_running_hours);
      return acc;
    }, {} as Record<string, number>);
    res.json({ data: runningHoursMap });
  } catch (err) {
    next(err);
  }
};

export const getBillingAnalyticsHandler = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const fromMonth = req.query.from as string; // "YYYY-MM"
    const toMonth = req.query.to as string; // "YYYY-MM"

    if (!fromMonth || !toMonth) {
      return res.status(400).json({ error: "Parameters 'from' and 'to' in YYYY-MM format are required." });
    }

    const db = getMongoDb();
    const config = await db.collection(GLOBAL_CONFIG_COLLECTION).findOne({ key: "utility" });
    const waterConfig = config?.waterConfig || defaultWaterConfig;

    // Convert fromMonth and toMonth to full dates (in WIB context, represented as UTC/naive strings for query)
    const fromStr = `${fromMonth}-01 00:00:00.000`;
    const [toYear, toMonthNum] = toMonth.split("-").map(Number);
    const lastDay = new Date(toYear, toMonthNum, 0).getDate();
    const toStr = `${toMonth}-${String(lastDay).padStart(2, "0")} 23:59:59.999`;

    // 1. Fetch Electricity analytics
    const elecResult = await getElectricityAnalytics("Cubicle_PLN_PM8000", `${fromMonth}-01`, `${toMonth}-${String(lastDay).padStart(2, "0")}`);
    const elecMonths = elecResult.summary.perMonthSummary;

    // 2. Fetch Water telemetry and calculate monthly consumption
    const pool = getPostgresPool();
    const waterRes = await pool.query(`
      SELECT t_stamp AS ts, water_m3::float AS value, id_device
      FROM water_telemetry
      WHERE t_stamp >= $1 AND t_stamp <= $2
      ORDER BY id_device, t_stamp ASC
    `, [fromStr, toStr]);

    const waterMonthlyMap = new Map<string, number>();
    const recordsByDevice = new Map<string, { ts: Date; value: number }[]>();
    for (const r of waterRes.rows) {
      if (!recordsByDevice.has(r.id_device)) {
        recordsByDevice.set(r.id_device, []);
      }
      recordsByDevice.get(r.id_device)!.push({ ts: r.ts, value: r.value });
    }

    for (const [_, devRecords] of recordsByDevice) {
      for (let i = 1; i < devRecords.length; i++) {
        const prev = devRecords[i - 1];
        const curr = devRecords[i];
        let diff = curr.value - prev.value;
        if (diff < 0) diff = 0;

        // WIB timezone month string (GMT+7)
        const wibTime = new Date(prev.ts.getTime() + 7 * 60 * 60 * 1000);
        const y = wibTime.getUTCFullYear();
        const m = String(wibTime.getUTCMonth() + 1).padStart(2, "0");
        const monthStr = `${y}-${m}`;

        waterMonthlyMap.set(monthStr, (waterMonthlyMap.get(monthStr) || 0) + diff);
      }
    }

    // 3. Build monthly bills
    const startYear = parseInt(fromMonth.split("-")[0]);
    const startM = parseInt(fromMonth.split("-")[1]);
    const endYear = parseInt(toMonth.split("-")[0]);
    const endM = parseInt(toMonth.split("-")[1]);

    const bills = [];
    const currentCursor = new Date(startYear, startM - 1, 1);
    const endCursor = new Date(endYear, endM - 1, 1);

    while (currentCursor <= endCursor) {
      const y = currentCursor.getFullYear();
      const m = String(currentCursor.getMonth() + 1).padStart(2, "0");
      const monthKey = `${y}-${m}`;

      // Electricity
      const elecMatch = elecMonths.find(e => e.month === monthKey);
      const elecKwh = elecMatch ? elecMatch.totalKwh : 0;
      const elecCost = elecMatch ? elecMatch.totalCost : 0;

      // Water
      const waterM3 = waterMonthlyMap.get(monthKey) || 0;
      const waterCost = calculateWaterCost(waterM3, waterConfig);

      // Gas (simulated based on electricity: gasSm3 = electricityKwh / 7)
      const gasSm3 = elecKwh / 7;
      const gasCostUsd = gasSm3 * 0.38;
      const gasCostIdr = gasCostUsd * 16200;

      const totalCost = elecCost + waterCost + gasCostIdr;

      bills.push({
        month: monthKey,
        electricity: { kwh: Number(elecKwh.toFixed(0)), cost: Number(elecCost.toFixed(0)) },
        water: { m3: Number(waterM3.toFixed(1)), cost: Number(waterCost.toFixed(0)) },
        gas: { sm3: Number(gasSm3.toFixed(1)), cost: Number(gasCostIdr.toFixed(0)), costUsd: Number(gasCostUsd.toFixed(2)) },
        totalCost: Number(totalCost.toFixed(0))
      });

      currentCursor.setMonth(currentCursor.getMonth() + 1);
    }

    // 4. Calculate yearly accumulations
    const yearlyMap = new Map<number, { electricity: number; water: number; gas: number; total: number }>();
    for (const bill of bills) {
      const year = parseInt(bill.month.split("-")[0]);
      if (!yearlyMap.has(year)) {
        yearlyMap.set(year, { electricity: 0, water: 0, gas: 0, total: 0 });
      }
      const accum = yearlyMap.get(year)!;
      accum.electricity += bill.electricity.cost;
      accum.water += bill.water.cost;
      accum.gas += bill.gas.cost;
      accum.total += bill.totalCost;
    }

    const yearlyAccumulations = Array.from(yearlyMap.entries()).map(([year, values]) => ({
      year,
      electricityCost: values.electricity,
      waterCost: values.water,
      gasCost: values.gas,
      totalCost: values.total
    })).sort((a, b) => a.year - b.year);

    res.json({
      data: {
        bills: bills.reverse(), // latest first
        yearlyAccumulations
      }
    });

  } catch (err) {
    next(err);
  }
};

export const getPowerMetersLatestHandler = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const group = ((req.query.group as string) || "ew23").toLowerCase();
    const pool = getPostgresPool();

    const dbRes = await pool.query(`
      WITH combined AS (
        SELECT * FROM electric_pm_telemetry_minute WHERE LOWER(group_id) = $1
        UNION ALL
        SELECT * FROM electric_pm_telemetry WHERE LOWER(group_id) = $1
      )
      SELECT DISTINCT ON (pm_id) *
      FROM combined
      ORDER BY pm_id, t_stamp DESC
    `, [group]);

    let data = dbRes.rows;

    // For ew23, ensure the 3 incoming cubicles (PLN, WF1, WF2) are included if not present in the PM array
    if (group === "ew23") {
      const existingPmIds = new Set(data.map((r: any) => String(r.pm_id).toUpperCase()));

      // 1. Incoming Cubicle PLN
      if (!existingPmIds.has("PM410") && !existingPmIds.has("PM8000") && !existingPmIds.has("CUBICLE_PLN_PM8000")) {
        try {
          const plnRes = await pool.query(`
            SELECT * FROM (
              SELECT * FROM electric_pln_telemetry_minute
              UNION ALL
              SELECT * FROM electric_pln_telemetry
            ) combined
            ORDER BY t_stamp DESC LIMIT 1
          `);
          if (plnRes.rows.length > 0) {
            const pln = plnRes.rows[0];
            data.push({
              id: 410,
              t_stamp: pln.t_stamp,
              group_id: "ew23",
              pm_id: "PM410",
              status: pln.status_pm8000 !== null ? !!pln.status_pm8000 : true,
              volt_ab: pln.volt_ab ? Number(pln.volt_ab) : null,
              volt_bc: pln.volt_bc ? Number(pln.volt_bc) : null,
              volt_ca: pln.volt_ca ? Number(pln.volt_ca) : null,
              volt_ll: pln.volt_ll ? Number(pln.volt_ll) : null,
              current_a: pln.current_a ? Number(pln.current_a) : null,
              current_b: pln.current_b ? Number(pln.current_b) : null,
              current_c: pln.current_c ? Number(pln.current_c) : null,
              frequency: pln.frequency ? Number(pln.frequency) : 50.0,
              active_power_total: pln.active_power ? Number(pln.active_power) : null,
              reactive_power_total: pln.reactive_power_total ? Number(pln.reactive_power_total) : null,
              apparent_power_total: pln.apparent_power_total ? Number(pln.apparent_power_total) : null,
              power_factor: pln.power_factor ? Number(pln.power_factor) : null,
              voltage_unbalance: pln.voltage_unbalance ? Number(pln.voltage_unbalance) : null,
              current_unbalance: pln.current_unbalance ? Number(pln.current_unbalance) : null,
              thd_volt_a: pln.thd_volt_a ? Number(pln.thd_volt_a) : null,
              thd_volt_b: pln.thd_volt_b ? Number(pln.thd_volt_b) : null,
              thd_volt_c: pln.thd_volt_c ? Number(pln.thd_volt_c) : null,
              thd_current_a: pln.thd_current_a ? Number(pln.thd_current_a) : null,
              thd_current_b: pln.thd_current_b ? Number(pln.thd_current_b) : null,
              thd_current_c: pln.thd_current_c ? Number(pln.thd_current_c) : null,
              active_energy: pln.active_energy ? Number(pln.active_energy) : null
            });
          }
        } catch {}
      }

      // 2. Incoming Cubicle WF1
      if (!existingPmIds.has("PM411") && !existingPmIds.has("PM5560") && !existingPmIds.has("PM5560_WF1") && !existingPmIds.has("FEEDER_WF1_PM5560")) {
        try {
          const wf1Res = await pool.query(`
            SELECT * FROM (
              SELECT * FROM electric_wf1_telemetry_minute
              UNION ALL
              SELECT * FROM electric_wf1_telemetry
            ) combined
            ORDER BY t_stamp DESC LIMIT 1
          `);
          if (wf1Res.rows.length > 0) {
            const wf1 = wf1Res.rows[0];
            data.push({
              id: 411,
              t_stamp: wf1.t_stamp,
              group_id: "ew23",
              pm_id: "PM411",
              status: wf1.status_pm5500 !== null ? !!wf1.status_pm5500 : true,
              volt_ab: wf1.volt_ab ? Number(wf1.volt_ab) : null,
              volt_bc: wf1.volt_bc ? Number(wf1.volt_bc) : null,
              volt_ca: wf1.volt_ca ? Number(wf1.volt_ca) : null,
              volt_ll: wf1.volt_ll ? Number(wf1.volt_ll) : null,
              current_a: wf1.current_a ? Number(wf1.current_a) : null,
              current_b: wf1.current_b ? Number(wf1.current_b) : null,
              current_c: wf1.current_c ? Number(wf1.current_c) : null,
              frequency: wf1.frequency ? Number(wf1.frequency) : 50.0,
              active_power_total: wf1.active_power_total ? Number(wf1.active_power_total) : null,
              reactive_power_total: wf1.reactive_power_total ? Number(wf1.reactive_power_total) : null,
              apparent_power_total: wf1.apparent_power_total ? Number(wf1.apparent_power_total) : null,
              power_factor: wf1.power_factor ? Number(wf1.power_factor) : null,
              voltage_unbalance: wf1.voltage_unbalance ? Number(wf1.voltage_unbalance) : null,
              current_unbalance: wf1.current_unbalance ? Number(wf1.current_unbalance) : null,
              thd_volt_a: wf1.thd_volt_a ? Number(wf1.thd_volt_a) : null,
              thd_volt_b: wf1.thd_volt_b ? Number(wf1.thd_volt_b) : null,
              thd_volt_c: wf1.thd_volt_c ? Number(wf1.thd_volt_c) : null,
              thd_current_a: wf1.thd_current_a ? Number(wf1.thd_current_a) : null,
              thd_current_b: wf1.thd_current_b ? Number(wf1.thd_current_b) : null,
              thd_current_c: wf1.thd_current_c ? Number(wf1.thd_current_c) : null,
              active_energy: wf1.active_energy ? Number(wf1.active_energy) : null
            });
          }
        } catch {}
      }

      // 3. Incoming Cubicle WF2
      if (!existingPmIds.has("PM412") && !existingPmIds.has("PM5560_WF2") && !existingPmIds.has("PM5500") && !existingPmIds.has("FEEDER_WF2_PM5500")) {
        try {
          const wf2Res = await pool.query(`
            SELECT * FROM (
              SELECT * FROM electric_wf2_telemetry_minute
              UNION ALL
              SELECT * FROM electric_wf2_telemetry
            ) combined
            ORDER BY t_stamp DESC LIMIT 1
          `);
          if (wf2Res.rows.length > 0) {
            const wf2 = wf2Res.rows[0];
            data.push({
              id: 412,
              t_stamp: wf2.t_stamp,
              group_id: "ew23",
              pm_id: "PM412",
              status: wf2.status_pm5500 !== null ? !!wf2.status_pm5500 : true,
              volt_ab: wf2.volt_ab ? Number(wf2.volt_ab) : null,
              volt_bc: wf2.volt_bc ? Number(wf2.volt_bc) : null,
              volt_ca: wf2.volt_ca ? Number(wf2.volt_ca) : null,
              volt_ll: wf2.volt_ll ? Number(wf2.volt_ll) : null,
              current_a: wf2.current_a ? Number(wf2.current_a) : null,
              current_b: wf2.current_b ? Number(wf2.current_b) : null,
              current_c: wf2.current_c ? Number(wf2.current_c) : null,
              frequency: wf2.frequency ? Number(wf2.frequency) : 50.0,
              active_power_total: wf2.active_power_total ? Number(wf2.active_power_total) : null,
              reactive_power_total: wf2.reactive_power_total ? Number(wf2.reactive_power_total) : null,
              apparent_power_total: wf2.apparent_power_total ? Number(wf2.apparent_power_total) : null,
              power_factor: wf2.power_factor ? Number(wf2.power_factor) : null,
              voltage_unbalance: wf2.voltage_unbalance ? Number(wf2.voltage_unbalance) : null,
              current_unbalance: wf2.current_unbalance ? Number(wf2.current_unbalance) : null,
              thd_volt_a: wf2.thd_volt_a ? Number(wf2.thd_volt_a) : null,
              thd_volt_b: wf2.thd_volt_b ? Number(wf2.thd_volt_b) : null,
              thd_volt_c: wf2.thd_volt_c ? Number(wf2.thd_volt_c) : null,
              thd_current_a: wf2.thd_current_a ? Number(wf2.thd_current_a) : null,
              thd_current_b: wf2.thd_current_b ? Number(wf2.thd_current_b) : null,
              thd_current_c: wf2.thd_current_c ? Number(wf2.thd_current_c) : null,
              active_energy: wf2.active_energy ? Number(wf2.active_energy) : null
            });
          }
        } catch {}
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
    data.sort((a: any, b: any) => {
      const normA = String(a.pm_id).toUpperCase().trim();
      const normB = String(b.pm_id).toUpperCase().trim();
      const idxA = pmOrder[normA] ?? (parseInt(normA.replace(/\D/g, "") || "9999", 10) + 1000);
      const idxB = pmOrder[normB] ?? (parseInt(normB.replace(/\D/g, "") || "9999", 10) + 1000);
      return idxA - idxB;
    });

    res.json({ data });
  } catch (err) {
    next(err);
  }
};

export const getPowerMeterHistoryHandler = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const pmId = (req.params.pmId || "").toUpperCase().trim();
    const nowWib = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Jakarta" }));
    const todayWibStr = nowWib.toISOString().slice(0, 10);
    const targetDate = (req.query.date as string) || todayWibStr;
    const isToday = targetDate === todayWibStr;

    // Use client's local laptop hour if provided, else default to server's Jakarta hour
    const clientHour = req.query.hour !== undefined ? parseInt(req.query.hour as string, 10) : undefined;
    const currentHour = isToday
      ? (Number.isInteger(clientHour) && clientHour! >= 0 && clientHour! <= 23 ? clientHour! : nowWib.getHours())
      : 23;

    const pool = getPostgresPool();
    let dbRes;

    // Handle Incoming Cubicles (PLN, WF1, WF2)
    if (pmId === "PM410" || pmId === "PM8000" || pmId === "CUBICLE_PLN_PM8000") {
      dbRes = await pool.query(`
        WITH pln_hourly AS (
          SELECT 
            EXTRACT(HOUR FROM t_stamp)::int as hour,
            AVG(active_power)::numeric(12,2) as active_power_total,
            AVG(current_a)::numeric(12,2) as current_a,
            AVG(current_b)::numeric(12,2) as current_b,
            AVG(current_c)::numeric(12,2) as current_c,
            AVG(volt_ab)::numeric(12,2) as volt_ab,
            AVG(power_factor)::numeric(12,3) as power_factor,
            MAX(active_energy)::numeric(14,2) as active_energy,
            MAX(t_stamp) as t_stamp
          FROM electric_pln_telemetry
          WHERE DATE(t_stamp) = $1::date
          GROUP BY EXTRACT(HOUR FROM t_stamp)
        ),
        pln_minute AS (
          SELECT 
            EXTRACT(HOUR FROM t_stamp)::int as hour,
            AVG(active_power)::numeric(12,2) as active_power_total,
            AVG(current_a)::numeric(12,2) as current_a,
            AVG(current_b)::numeric(12,2) as current_b,
            AVG(current_c)::numeric(12,2) as current_c,
            AVG(volt_ab)::numeric(12,2) as volt_ab,
            AVG(power_factor)::numeric(12,3) as power_factor,
            MAX(active_energy)::numeric(14,2) as active_energy,
            MAX(t_stamp) as t_stamp
          FROM electric_pln_telemetry_minute
          WHERE DATE(t_stamp) = $1::date
          GROUP BY EXTRACT(HOUR FROM t_stamp)
        )
        SELECT 
          s.hour,
          to_char(s.hour, 'FM00') || ':00' as label,
          CASE 
            WHEN s.hour > $2 THEN NULL
            WHEN s.hour = $2 THEN COALESCE(m.active_power_total, h.active_power_total)
            ELSE COALESCE(h.active_power_total, m.active_power_total)
          END as active_power_total,
          CASE 
            WHEN s.hour > $2 THEN NULL
            WHEN s.hour = $2 THEN COALESCE(m.current_a, h.current_a)
            ELSE COALESCE(h.current_a, m.current_a)
          END as current_a,
          CASE 
            WHEN s.hour > $2 THEN NULL
            WHEN s.hour = $2 THEN COALESCE(m.current_b, h.current_b)
            ELSE COALESCE(h.current_b, m.current_b)
          END as current_b,
          CASE 
            WHEN s.hour > $2 THEN NULL
            WHEN s.hour = $2 THEN COALESCE(m.current_c, h.current_c)
            ELSE COALESCE(h.current_c, m.current_c)
          END as current_c,
          CASE 
            WHEN s.hour > $2 THEN NULL
            WHEN s.hour = $2 THEN COALESCE(m.volt_ab, h.volt_ab)
            ELSE COALESCE(h.volt_ab, m.volt_ab)
          END as volt_ab,
          CASE 
            WHEN s.hour > $2 THEN NULL
            WHEN s.hour = $2 THEN COALESCE(m.power_factor, h.power_factor)
            ELSE COALESCE(h.power_factor, m.power_factor)
          END as power_factor,
          CASE 
            WHEN s.hour > $2 THEN NULL
            WHEN s.hour = $2 THEN COALESCE(m.active_energy, h.active_energy)
            ELSE COALESCE(h.active_energy, m.active_energy)
          END as active_energy,
          CASE 
            WHEN s.hour > $2 THEN NULL
            ELSE COALESCE(m.t_stamp, h.t_stamp)
          END as t_stamp
        FROM generate_series(0, 23) as s(hour)
        LEFT JOIN pln_hourly h ON h.hour = s.hour
        LEFT JOIN pln_minute m ON m.hour = s.hour
        ORDER BY s.hour ASC;
      `, [targetDate, currentHour]);
    } else if (pmId === "PM411" || pmId === "PM5560" || pmId === "PM5560_WF1" || pmId === "FEEDER_WF1_PM5560") {
      dbRes = await pool.query(`
        WITH wf1_hourly AS (
          SELECT 
            EXTRACT(HOUR FROM t_stamp)::int as hour,
            AVG(active_power_total)::numeric(12,2) as active_power_total,
            AVG(current_a)::numeric(12,2) as current_a,
            AVG(current_b)::numeric(12,2) as current_b,
            AVG(current_c)::numeric(12,2) as current_c,
            AVG(volt_ab)::numeric(12,2) as volt_ab,
            AVG(power_factor)::numeric(12,3) as power_factor,
            MAX(active_energy)::numeric(14,2) as active_energy,
            MAX(t_stamp) as t_stamp
          FROM electric_wf1_telemetry
          WHERE DATE(t_stamp) = $1::date
          GROUP BY EXTRACT(HOUR FROM t_stamp)
        ),
        wf1_minute AS (
          SELECT 
            EXTRACT(HOUR FROM t_stamp)::int as hour,
            AVG(active_power_total)::numeric(12,2) as active_power_total,
            AVG(current_a)::numeric(12,2) as current_a,
            AVG(current_b)::numeric(12,2) as current_b,
            AVG(current_c)::numeric(12,2) as current_c,
            AVG(volt_ab)::numeric(12,2) as volt_ab,
            AVG(power_factor)::numeric(12,3) as power_factor,
            MAX(active_energy)::numeric(14,2) as active_energy,
            MAX(t_stamp) as t_stamp
          FROM electric_wf1_telemetry_minute
          WHERE DATE(t_stamp) = $1::date
          GROUP BY EXTRACT(HOUR FROM t_stamp)
        )
        SELECT 
          s.hour,
          to_char(s.hour, 'FM00') || ':00' as label,
          CASE 
            WHEN s.hour > $2 THEN NULL
            WHEN s.hour = $2 THEN COALESCE(m.active_power_total, h.active_power_total)
            ELSE COALESCE(h.active_power_total, m.active_power_total)
          END as active_power_total,
          CASE 
            WHEN s.hour > $2 THEN NULL
            WHEN s.hour = $2 THEN COALESCE(m.current_a, h.current_a)
            ELSE COALESCE(h.current_a, m.current_a)
          END as current_a,
          CASE 
            WHEN s.hour > $2 THEN NULL
            WHEN s.hour = $2 THEN COALESCE(m.current_b, h.current_b)
            ELSE COALESCE(h.current_b, m.current_b)
          END as current_b,
          CASE 
            WHEN s.hour > $2 THEN NULL
            WHEN s.hour = $2 THEN COALESCE(m.current_c, h.current_c)
            ELSE COALESCE(h.current_c, m.current_c)
          END as current_c,
          CASE 
            WHEN s.hour > $2 THEN NULL
            WHEN s.hour = $2 THEN COALESCE(m.volt_ab, h.volt_ab)
            ELSE COALESCE(h.volt_ab, m.volt_ab)
          END as volt_ab,
          CASE 
            WHEN s.hour > $2 THEN NULL
            WHEN s.hour = $2 THEN COALESCE(m.power_factor, h.power_factor)
            ELSE COALESCE(h.power_factor, m.power_factor)
          END as power_factor,
          CASE 
            WHEN s.hour > $2 THEN NULL
            WHEN s.hour = $2 THEN COALESCE(m.active_energy, h.active_energy)
            ELSE COALESCE(h.active_energy, m.active_energy)
          END as active_energy,
          CASE 
            WHEN s.hour > $2 THEN NULL
            ELSE COALESCE(m.t_stamp, h.t_stamp)
          END as t_stamp
        FROM generate_series(0, 23) as s(hour)
        LEFT JOIN wf1_hourly h ON h.hour = s.hour
        LEFT JOIN wf1_minute m ON m.hour = s.hour
        ORDER BY s.hour ASC;
      `, [targetDate, currentHour]);
    } else if (pmId === "PM412" || pmId === "PM5560_WF2" || pmId === "PM5500" || pmId === "FEEDER_WF2_PM5500") {
      dbRes = await pool.query(`
        WITH wf2_hourly AS (
          SELECT 
            EXTRACT(HOUR FROM t_stamp)::int as hour,
            AVG(active_power_total)::numeric(12,2) as active_power_total,
            AVG(current_a)::numeric(12,2) as current_a,
            AVG(current_b)::numeric(12,2) as current_b,
            AVG(current_c)::numeric(12,2) as current_c,
            AVG(volt_ab)::numeric(12,2) as volt_ab,
            AVG(power_factor)::numeric(12,3) as power_factor,
            MAX(active_energy)::numeric(14,2) as active_energy,
            MAX(t_stamp) as t_stamp
          FROM electric_wf2_telemetry
          WHERE DATE(t_stamp) = $1::date
          GROUP BY EXTRACT(HOUR FROM t_stamp)
        ),
        wf2_minute AS (
          SELECT 
            EXTRACT(HOUR FROM t_stamp)::int as hour,
            AVG(active_power_total)::numeric(12,2) as active_power_total,
            AVG(current_a)::numeric(12,2) as current_a,
            AVG(current_b)::numeric(12,2) as current_b,
            AVG(current_c)::numeric(12,2) as current_c,
            AVG(volt_ab)::numeric(12,2) as volt_ab,
            AVG(power_factor)::numeric(12,3) as power_factor,
            MAX(active_energy)::numeric(14,2) as active_energy,
            MAX(t_stamp) as t_stamp
          FROM electric_wf2_telemetry_minute
          WHERE DATE(t_stamp) = $1::date
          GROUP BY EXTRACT(HOUR FROM t_stamp)
        )
        SELECT 
          s.hour,
          to_char(s.hour, 'FM00') || ':00' as label,
          CASE 
            WHEN s.hour > $2 THEN NULL
            WHEN s.hour = $2 THEN COALESCE(m.active_power_total, h.active_power_total)
            ELSE COALESCE(h.active_power_total, m.active_power_total)
          END as active_power_total,
          CASE 
            WHEN s.hour > $2 THEN NULL
            WHEN s.hour = $2 THEN COALESCE(m.current_a, h.current_a)
            ELSE COALESCE(h.current_a, m.current_a)
          END as current_a,
          CASE 
            WHEN s.hour > $2 THEN NULL
            WHEN s.hour = $2 THEN COALESCE(m.current_b, h.current_b)
            ELSE COALESCE(h.current_b, m.current_b)
          END as current_b,
          CASE 
            WHEN s.hour > $2 THEN NULL
            WHEN s.hour = $2 THEN COALESCE(m.current_c, h.current_c)
            ELSE COALESCE(h.current_c, m.current_c)
          END as current_c,
          CASE 
            WHEN s.hour > $2 THEN NULL
            WHEN s.hour = $2 THEN COALESCE(m.volt_ab, h.volt_ab)
            ELSE COALESCE(h.volt_ab, m.volt_ab)
          END as volt_ab,
          CASE 
            WHEN s.hour > $2 THEN NULL
            WHEN s.hour = $2 THEN COALESCE(m.power_factor, h.power_factor)
            ELSE COALESCE(h.power_factor, m.power_factor)
          END as power_factor,
          CASE 
            WHEN s.hour > $2 THEN NULL
            WHEN s.hour = $2 THEN COALESCE(m.active_energy, h.active_energy)
            ELSE COALESCE(h.active_energy, m.active_energy)
          END as active_energy,
          CASE 
            WHEN s.hour > $2 THEN NULL
            ELSE COALESCE(m.t_stamp, h.t_stamp)
          END as t_stamp
        FROM generate_series(0, 23) as s(hour)
        LEFT JOIN wf2_hourly h ON h.hour = s.hour
        LEFT JOIN wf2_minute m ON m.hour = s.hour
        ORDER BY s.hour ASC;
      `, [targetDate, currentHour]);
    } else {
      // Standard Sub-Distribution PM meter (EW23, EW22, EW21)
      dbRes = await pool.query(`
        WITH pm_hourly AS (
          SELECT 
            EXTRACT(HOUR FROM t_stamp)::int as hour,
            AVG(active_power_total)::numeric(12,2) as active_power_total,
            AVG(current_a)::numeric(12,2) as current_a,
            AVG(current_b)::numeric(12,2) as current_b,
            AVG(current_c)::numeric(12,2) as current_c,
            AVG(volt_ab)::numeric(12,2) as volt_ab,
            AVG(power_factor)::numeric(12,3) as power_factor,
            MAX(active_energy)::numeric(14,2) as active_energy,
            MAX(t_stamp) as t_stamp
          FROM electric_pm_telemetry
          WHERE UPPER(pm_id) = $1
            AND DATE(t_stamp) = $2::date
          GROUP BY EXTRACT(HOUR FROM t_stamp)
        ),
        pm_minute AS (
          SELECT 
            EXTRACT(HOUR FROM t_stamp)::int as hour,
            AVG(active_power_total)::numeric(12,2) as active_power_total,
            AVG(current_a)::numeric(12,2) as current_a,
            AVG(current_b)::numeric(12,2) as current_b,
            AVG(current_c)::numeric(12,2) as current_c,
            AVG(volt_ab)::numeric(12,2) as volt_ab,
            AVG(power_factor)::numeric(12,3) as power_factor,
            MAX(active_energy)::numeric(14,2) as active_energy,
            MAX(t_stamp) as t_stamp
          FROM electric_pm_telemetry_minute
          WHERE UPPER(pm_id) = $1
            AND DATE(t_stamp) = $2::date
          GROUP BY EXTRACT(HOUR FROM t_stamp)
        )
        SELECT 
          s.hour,
          to_char(s.hour, 'FM00') || ':00' as label,
          CASE 
            WHEN s.hour > $3 THEN NULL
            WHEN s.hour = $3 THEN COALESCE(m.active_power_total, h.active_power_total)
            ELSE COALESCE(h.active_power_total, m.active_power_total)
          END as active_power_total,
          CASE 
            WHEN s.hour > $3 THEN NULL
            WHEN s.hour = $3 THEN COALESCE(m.current_a, h.current_a)
            ELSE COALESCE(h.current_a, m.current_a)
          END as current_a,
          CASE 
            WHEN s.hour > $3 THEN NULL
            WHEN s.hour = $3 THEN COALESCE(m.current_b, h.current_b)
            ELSE COALESCE(h.current_b, m.current_b)
          END as current_b,
          CASE 
            WHEN s.hour > $3 THEN NULL
            WHEN s.hour = $3 THEN COALESCE(m.current_c, h.current_c)
            ELSE COALESCE(h.current_c, m.current_c)
          END as current_c,
          CASE 
            WHEN s.hour > $3 THEN NULL
            WHEN s.hour = $3 THEN COALESCE(m.volt_ab, h.volt_ab)
            ELSE COALESCE(h.volt_ab, m.volt_ab)
          END as volt_ab,
          CASE 
            WHEN s.hour > $3 THEN NULL
            WHEN s.hour = $3 THEN COALESCE(m.power_factor, h.power_factor)
            ELSE COALESCE(h.power_factor, m.power_factor)
          END as power_factor,
          CASE 
            WHEN s.hour > $3 THEN NULL
            WHEN s.hour = $3 THEN COALESCE(m.active_energy, h.active_energy)
            ELSE COALESCE(h.active_energy, m.active_energy)
          END as active_energy,
          CASE 
            WHEN s.hour > $3 THEN NULL
            ELSE COALESCE(m.t_stamp, h.t_stamp)
          END as t_stamp
        FROM generate_series(0, 23) as s(hour)
        LEFT JOIN pm_hourly h ON h.hour = s.hour
        LEFT JOIN pm_minute m ON m.hour = s.hour
        ORDER BY s.hour ASC;
      `, [pmId, targetDate, currentHour]);
    }

    res.json({
      targetDate,
      currentHour,
      data: dbRes.rows
    });
  } catch (err) {
    next(err);
  }
};

export const getElectricityReportHandler = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const category = ((req.query.category as string) || "energy").toLowerCase();
    const factory = ((req.query.factory as string) || "all").toLowerCase();
    const tag = (req.query.tag as string) || "f1-mdp-3";
    const machine = (req.query.machine as string) || "all";
    const granularity = ((req.query.granularity as string) || "hour").toLowerCase();
    const startDate = (req.query.startDate as string) || new Date().toISOString().slice(0, 10);
    const endDate = (req.query.endDate as string) || startDate;

    const pool = getPostgresPool();

    // Map tag to candidate PM IDs or tables
    const tagMap: Record<string, { pmId?: string; group?: string; label?: string; table?: string }> = {
      // Legacy panel aliases
      "f1-mdp-1.1": { group: "ew21", pmId: "PM139", label: "F1 MDP-1.1", table: "electric_wf1_telemetry" },
      "f1-mdp-1.2": { group: "ew21", pmId: "PM136", label: "F1 MDP-1.2", table: "electric_wf1_telemetry" },
      "f1-mdp-2": { group: "ew21", pmId: "PM135", label: "F1 MDP-2", table: "electric_wf1_telemetry" },
      "f1-mdp-3": { group: "ew21", pmId: "PM133", label: "F1 MDP3", table: "electric_wf1_telemetry" },
      "f2-putr-1": { group: "ew22", pmId: "PM201", label: "F2 PUTR-1", table: "electric_wf2_telemetry" },
      "f2-putr-2": { group: "ew22", pmId: "PM202", label: "F2 PUTR-2", table: "electric_wf2_telemetry" },
      "f2-putr-new": { group: "ew23", pmId: "PM327", label: "F2 PUTR-NEW", table: "electric_wf2_telemetry" },

      // Factory 1 (ew21)
      "pm132": { pmId: "PM132", group: "ew21", label: "F1 MAIN SUPPLY QC OFFICE & LAB" },
      "pm133": { pmId: "PM133", group: "ew21", label: "F1 MDP3" },
      "pm134": { pmId: "PM134", group: "ew21", label: "F1 WH 4 PENERANGAN" },
      "pm135": { pmId: "PM135", group: "ew21", label: "F1 MDP-2" },
      "pm136": { pmId: "PM136", group: "ew21", label: "F1 MDP-1.2" },
      "pm138": { pmId: "PM138", group: "ew21", label: "F1 FULL COOLING WF1-U3" },
      "pm139": { pmId: "PM139", group: "ew21", label: "F1 MDP-1.1" },
      "pm140": { pmId: "PM140", group: "ew21", label: "F1 COMPRESSED AIR ZT-55" },
      "pm151": { pmId: "PM151", group: "ew21", label: "F1 HVAC OFFICE ATAS" },
      "pm152": { pmId: "PM152", group: "ew21", label: "F1 COOLING TOWER PUMP WF1-U3" },
      "pm153": { pmId: "PM153", group: "ew21", label: "F1 HVAC-QC" },
      "pm154": { pmId: "PM154", group: "ew21", label: "F1 LIGHTING WH 1" },
      "pm175": { pmId: "PM175", group: "ew21", label: "F1 ST3" },
      "pm176": { pmId: "PM176", group: "ew21", label: "F1 QC LAB" },
      "pm177": { pmId: "PM177", group: "ew21", label: "F1 CHILLER PREP DAIKIN BARAT" },
      "pm178": { pmId: "PM178", group: "ew21", label: "F1 CHILLER PREP DAIKIN TIMUR" },
      "pm179": { pmId: "PM179", group: "ew21", label: "F1 HVAC WH-3" },
      "pm180": { pmId: "PM180", group: "ew21", label: "F1 CHILLER BP WF1-U3" },
      "pm181": { pmId: "PM181", group: "ew21", label: "F1 COOLING TOWER FAN WF1-U3" },
      "pm182": { pmId: "PM182", group: "ew21", label: "F1 COMPRESSED AIR ZT-30.1&2" },
      "pm183": { pmId: "PM183", group: "ew21", label: "F1 COMPRESSED AIR ALE-30" },
      "pm184": { pmId: "PM184", group: "ew21", label: "F1 BOILER 4" },
      "pm185": { pmId: "PM185", group: "ew21", label: "F1 HVAC WF1U3" },

      // Factory 2 (ew22)
      "pm201": { pmId: "PM201", group: "ew22", label: "F2 PUTR-1" },
      "pm202": { pmId: "PM202", group: "ew22", label: "F2 PUTR-2" },
      "pm203": { pmId: "PM203", group: "ew22", label: "F2 HEATER WF2U2" },
      "pm205": { pmId: "PM205", group: "ew22", label: "F2 AHU WF2UI" },
      "pm206": { pmId: "PM206", group: "ew22", label: "F2 COOLING FASE-1" },
      "pm207": { pmId: "PM207", group: "ew22", label: "F2 WH 6" },
      "pm208": { pmId: "PM208", group: "ew22", label: "F2 WH 5" },
      "pm209": { pmId: "PM209", group: "ew22", label: "F2 CHILLER - WF2U2" },
      "pm210": { pmId: "PM210", group: "ew22", label: "F2 MAIN CRITICAL PANEL" },
      "pm211": { pmId: "PM211", group: "ew22", label: "F2 PANEL OTOKLAF WF2U1" },
      "pm212": { pmId: "PM212", group: "ew22", label: "F2 PANEL OTOKLAF WF2U2" },
      "pm213": { pmId: "PM213", group: "ew22", label: "F2 BOILER-5" },
      "pm214": { pmId: "PM214", group: "ew22", label: "F2 COMPRESSED AIR ATLAS" },
      "pm215": { pmId: "PM215", group: "ew22", label: "F2 COOLING CRITICAL" },
      "pm226": { pmId: "PM226", group: "ew22", label: "F2 WH-7" },
      "pm229": { pmId: "PM229", group: "ew22", label: "F2 KOBELCO ALE-250" },
      "pm271": { pmId: "PM271", group: "ew22", label: "F2 CHILLER RTAC 250 (RO&HVAC)" },
      "pm272": { pmId: "PM272", group: "ew22", label: "F2 CHILLER RTAC 170 (RO)" },
      "pm273": { pmId: "PM273", group: "ew22", label: "RETURN SAMPLE QC" },
      "pm274": { pmId: "PM274", group: "ew22", label: "F2 CHILLER RTAC 100 (BP)" },
      "pm288": { pmId: "PM288", group: "ew22", label: "F2 Penerangan PD" },

      // Factory 2 (ew23)
      "pm318": { pmId: "PM318", group: "ew23", label: "F2 COOLING FASE-2" },
      "pm319": { pmId: "PM319", group: "ew23", label: "F2 CHILLER RTAC-27S (PREP)" },
      "pm320": { pmId: "PM320", group: "ew23", label: "F2 WT-DU-PSG" },
      "pm321": { pmId: "PM321", group: "ew23", label: "F2 AHU-1 - WF2U2" },
      "pm322": { pmId: "PM322", group: "ew23", label: "F2 AHU-2 - WF2U2" },
      "pm323": { pmId: "PM323", group: "ew23", label: "F2 PW GENERATION - RO" },
      "pm324": { pmId: "PM324", group: "ew23", label: "F2 COOLING TOWER CT-PUMP" },
      "pm325": { pmId: "PM325", group: "ew23", label: "F2 COOLING TOWER CT-FAN" },
      "pm327": { pmId: "PM327", group: "ew23", label: "F2 PUTR-NEW" },
      "pm337": { pmId: "PM337", group: "ew23", label: "F2 MCC BP 7" },

      // Cubicles
      "pm410": { pmId: "PM410", group: "ew23", label: "incoming cubicle WF2", table: "electric_wf2_telemetry" },
      "pm411": { pmId: "PM411", group: "ew23", label: "incoming cubicle pln", table: "electric_pln_telemetry" },
      "pm412": { pmId: "PM412", group: "ew23", label: "incoming cubicle WF1", table: "electric_wf1_telemetry" }
    };

    const mapping = tagMap[tag.toLowerCase()] || {};
    // If machine param is a PM ID (e.g. "PM181"), target that PM specifically
    const machinePm = (machine && machine !== "all" && tagMap[machine.toLowerCase()]) ? tagMap[machine.toLowerCase()].pmId : null;
    const targetPmId = machinePm || mapping.pmId || (tag.toUpperCase().startsWith("PM") ? tag.toUpperCase() : null);
    const targetGroup = mapping.group || (targetPmId && tagMap[targetPmId.toLowerCase()] ? tagMap[targetPmId.toLowerCase()].group : null);
    const targetTable = mapping.table || (factory === "f2" ? "electric_wf2_telemetry" : "electric_wf1_telemetry");

    // Select date trunc granularity: 'hour', 'day', 'month'
    const truncUnit = granularity === "month" ? "month" : granularity === "day" ? "day" : "hour";

    // 1. Try querying electric_pm_telemetry / minute first
    let queryRows: any[] = [];
    try {
      const pmSql = `
        WITH raw_pm AS (
          SELECT t_stamp, volt_ab, volt_bc, volt_ca, volt_ll,
                 current_a, current_b, current_c, current_unbalance,
                 active_power_total, reactive_power_total, apparent_power_total,
                 power_factor, frequency,
                 thd_volt_a, thd_volt_b, thd_volt_c,
                 thd_current_a, thd_current_b, thd_current_c,
                 active_energy
          FROM electric_pm_telemetry
          WHERE (($1 != '%' AND pm_id ILIKE $1) OR ($1 = '%' AND group_id ILIKE $2))
            AND t_stamp >= $3::timestamp AND t_stamp <= ($4 || ' 23:59:59')::timestamp
            AND (volt_ab IS NOT NULL OR volt_ll IS NOT NULL OR current_a IS NOT NULL OR active_power_total IS NOT NULL OR active_energy IS NOT NULL)
          UNION ALL
          SELECT t_stamp, volt_ab, volt_bc, volt_ca, volt_ll,
                 current_a, current_b, current_c, current_unbalance,
                 active_power_total, reactive_power_total, apparent_power_total,
                 power_factor, frequency,
                 thd_volt_a, thd_volt_b, thd_volt_c,
                 thd_current_a, thd_current_b, thd_current_c,
                 active_energy
          FROM electric_pm_telemetry_minute
          WHERE (($1 != '%' AND pm_id ILIKE $1) OR ($1 = '%' AND group_id ILIKE $2))
            AND t_stamp >= $3::timestamp AND t_stamp <= ($4 || ' 23:59:59')::timestamp
            AND (volt_ab IS NOT NULL OR volt_ll IS NOT NULL OR current_a IS NOT NULL OR active_power_total IS NOT NULL OR active_energy IS NOT NULL)
        )
        SELECT 
          date_trunc('${truncUnit}', t_stamp) AS bucket,
          AVG(volt_ab) AS vr, AVG(volt_bc) AS vs, AVG(volt_ca) AS vt,
          AVG(volt_ab) AS vrs, AVG(volt_bc) AS vst, AVG(volt_ca) AS vtr,
          AVG(current_a) AS ir, AVG(current_b) AS is_val, AVG(current_c) AS it, AVG(current_unbalance) AS in_val,
          AVG(thd_volt_a) AS thdv_r, AVG(thd_volt_b) AS thdv_s, AVG(thd_volt_c) AS thdv_t,
          AVG(thd_current_a) AS thdi_r, AVG(thd_current_b) AS thdi_s, AVG(thd_current_c) AS thdi_t,
          AVG(active_power_total) AS kw,
          AVG(reactive_power_total) AS kvar,
          AVG(apparent_power_total) AS kva,
          AVG(power_factor) AS pf,
          AVG(frequency) AS freq,
          MAX(active_energy) AS max_energy,
          MIN(active_energy) AS min_energy,
          COUNT(*) as sample_count
        FROM raw_pm
        GROUP BY date_trunc('${truncUnit}', t_stamp)
        ORDER BY bucket DESC
      `;
      const pmRes = await pool.query(pmSql, [targetPmId || "%", targetGroup || "%", `${startDate} 00:00:00`, endDate]);
      if (pmRes.rows.length > 0) {
        queryRows = pmRes.rows;
      }
    } catch (e) {
      // Fallback
    }

    // 2. Query feeder table ONLY if the requested item is explicitly a cubicle / incoming feeder AND no sub-machine was specified.
    // Strictly NEVER substitute feeder transformer data for missing PM or machine data.
    const isExplicitCubicle = ["pm410", "pm411", "pm412", "incoming cubicle wf1", "incoming cubicle wf2", "incoming cubicle pln"].includes(tag.toLowerCase());
    if (queryRows.length === 0 && isExplicitCubicle && (!machine || machine === "all")) {
      try {
        const feederSql = `
          WITH raw_feeder AS (
            SELECT t_stamp, volt_ab, volt_bc, volt_ca, volt_ll,
                   current_a, current_b, current_c, current_unbalance,
                   COALESCE(active_power_total, active_power) AS active_power_total,
                   reactive_power_total, apparent_power_total,
                   power_factor, frequency,
                   thd_volt_a, thd_volt_b, thd_volt_c,
                   thd_current_a, thd_current_b, thd_current_c,
                   active_energy
            FROM ${targetTable}
            WHERE t_stamp >= $1::timestamp AND t_stamp <= ($2 || ' 23:59:59')::timestamp
            UNION ALL
            SELECT t_stamp, volt_ab, volt_bc, volt_ca, volt_ll,
                   current_a, current_b, current_c, current_unbalance,
                   COALESCE(active_power_total, active_power) AS active_power_total,
                   reactive_power_total, apparent_power_total,
                   power_factor, frequency,
                   thd_volt_a, thd_volt_b, thd_volt_c,
                   thd_current_a, thd_current_b, thd_current_c,
                   active_energy
            FROM ${targetTable}_minute
            WHERE t_stamp >= $1::timestamp AND t_stamp <= ($2 || ' 23:59:59')::timestamp
          )
          SELECT 
            date_trunc('${truncUnit}', t_stamp) AS bucket,
            AVG(volt_ab) AS vr, AVG(volt_bc) AS vs, AVG(volt_ca) AS vt,
            AVG(volt_ab) AS vrs, AVG(volt_bc) AS vst, AVG(volt_ca) AS vtr,
            AVG(current_a) AS ir, AVG(current_b) AS is_val, AVG(current_c) AS it, AVG(current_unbalance) AS in_val,
            AVG(thd_volt_a) AS thdv_r, AVG(thd_volt_b) AS thdv_s, AVG(thd_volt_c) AS thdv_t,
            AVG(thd_current_a) AS thdi_r, AVG(thd_current_b) AS thdi_s, AVG(thd_current_c) AS thdi_t,
            AVG(active_power_total) AS kw,
            AVG(reactive_power_total) AS kvar,
            AVG(apparent_power_total) AS kva,
            AVG(power_factor) AS pf,
            AVG(frequency) AS freq,
            MAX(active_energy) AS max_energy,
            MIN(active_energy) AS min_energy,
            COUNT(*) as sample_count
          FROM raw_feeder
          GROUP BY date_trunc('${truncUnit}', t_stamp)
          ORDER BY bucket DESC
        `;
        const feederRes = await pool.query(feederSql, [`${startDate} 00:00:00`, endDate]);
        queryRows = feederRes.rows;
      } catch (e) {
        // Fallback
      }
    }

    // Transform query rows into the report row format
    const pmInfo = targetPmId ? tagMap[targetPmId.toLowerCase()] : mapping;
    const tagLabel = pmInfo?.label 
      ? (machine && machine !== "all" && machine.toUpperCase() !== targetPmId && !pmInfo.label.includes(machine) ? `${pmInfo.label} - ${machine}` : pmInfo.label)
      : (machine && machine !== "all" ? `${tag.toUpperCase()} - ${machine}` : tag.toUpperCase());

    const result = queryRows.map((r: any) => {
      const bDate = new Date(r.bucket);
      let dateStr = "";
      if (granularity === "hour") {
        const pad = (n: number) => String(n).padStart(2, "0");
        dateStr = `${bDate.getFullYear()}-${pad(bDate.getMonth() + 1)}-${pad(bDate.getDate())} ${pad(bDate.getHours())}:00:00`;
      } else if (granularity === "day") {
        const pad = (n: number) => String(n).padStart(2, "0");
        dateStr = `${bDate.getFullYear()}-${pad(bDate.getMonth() + 1)}-${pad(bDate.getDate())}`;
      } else {
        const pad = (n: number) => String(n).padStart(2, "0");
        dateStr = `${bDate.getFullYear()}-${pad(bDate.getMonth() + 1)}`;
      }

      const kwVal = r.kw !== null ? Number(r.kw) : null;
      const kvarVal = r.kvar !== null ? Number(r.kvar) : null;
      const kvaVal = r.kva !== null ? Number(r.kva) : null;
      const energyDiff = (r.max_energy !== null && r.min_energy !== null && Number(r.max_energy) > Number(r.min_energy))
        ? Number(r.max_energy) - Number(r.min_energy)
        : null;

      // Real active energy (kWh)
      const kwhVal = energyDiff !== null && energyDiff > 0
        ? energyDiff
        : (kwVal !== null ? kwVal : (r.max_energy !== null ? Number(r.max_energy) : null));

      // Real reactive energy (kVARh) - calculated directly from real reactive_power_total
      const kvarhVal = kvarVal !== null ? Math.abs(kvarVal) : null;

      // Real apparent energy (kVAh) - calculated directly from real apparent_power_total
      const kvahVal = kvaVal !== null 
        ? Math.abs(kvaVal) 
        : (kwhVal !== null && kvarhVal !== null ? Math.sqrt(kwhVal * kwhVal + kvarhVal * kvarhVal) : null);

      return {
        date: dateStr,
        tag: tagLabel,
        // Energy tab
        kwh: kwhVal !== null ? +kwhVal.toFixed(2) : null,
        kvarh: kvarhVal !== null ? +kvarhVal.toFixed(2) : null,
        kvah: kvahVal !== null ? +kvahVal.toFixed(2) : null,
        // Tegangan tab
        vr: r.vr !== null ? +Number(r.vr).toFixed(1) : null,
        vs: r.vs !== null ? +Number(r.vs).toFixed(1) : null,
        vt: r.vt !== null ? +Number(r.vt).toFixed(1) : null,
        vrs: r.vrs !== null ? +Number(r.vrs).toFixed(1) : null,
        vst: r.vst !== null ? +Number(r.vst).toFixed(1) : null,
        vtr: r.vtr !== null ? +Number(r.vtr).toFixed(1) : null,
        // Ampere tab
        ir: r.ir !== null ? +Number(r.ir).toFixed(1) : null,
        is: r.is_val !== null ? +Number(r.is_val).toFixed(1) : null,
        it: r.it !== null ? +Number(r.it).toFixed(1) : null,
        in: r.in_val !== null ? +Number(r.in_val).toFixed(1) : null,
        // THD tab
        thdv_r: r.thdv_r !== null ? +Number(r.thdv_r).toFixed(2) : null,
        thdv_s: r.thdv_s !== null ? +Number(r.thdv_s).toFixed(2) : null,
        thdv_t: r.thdv_t !== null ? +Number(r.thdv_t).toFixed(2) : null,
        thdi_r: r.thdi_r !== null ? +Number(r.thdi_r).toFixed(2) : null,
        thdi_s: r.thdi_s !== null ? +Number(r.thdi_s).toFixed(2) : null,
        thdi_t: r.thdi_t !== null ? +Number(r.thdi_t).toFixed(2) : null,
        // Daya tab
        kw: kwVal !== null ? +kwVal.toFixed(1) : null,
        kvar: kvarVal !== null ? +kvarVal.toFixed(1) : null,
        kva: kvaVal !== null ? +kvaVal.toFixed(1) : null,
        pf: r.pf !== null ? +Number(r.pf).toFixed(3) : null,
        freq: r.freq !== null ? +Number(r.freq).toFixed(2) : null,
      };
    });

    res.json({ data: result });
  } catch (err) {
    next(err);
  }
};

export const getElectricityExportDataHandler = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const from = (req.query.from as string) || new Date().toISOString().slice(0, 10);
    const to = (req.query.to as string) || from;
    const resolution = (req.query.resolution as "hour" | "day" | "week" | "month" | "year") || "hour";
    const sheets = (req.query.sheets as string) || "all";

    const data = await getElectricityExportData({
      from,
      to,
      resolution,
      sheets
    });

    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
};

export const getElectricityExportExcelHandler = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const from = (req.query.from as string) || new Date().toISOString().slice(0, 10);
    const to = (req.query.to as string) || from;
    const resolution = (req.query.resolution as "hour" | "day" | "week" | "month" | "year") || "hour";
    const sheetsParam = (req.query.sheets as string) || "all";

    const data = await getElectricityExportData({
      from,
      to,
      resolution,
      sheets: sheetsParam
    });

    const selectedSheets = new Set(
      sheetsParam === "all" || !sheetsParam
        ? ["overview", "pln", "wf1", "wf2", "solar", "subdistribution"]
        : sheetsParam.split(",").map((s) => s.trim().toLowerCase())
    );

    const buffer = await generateElectricityExcelWorkbook(data, selectedSheets);

    const fileName = `Laporan_Kelistrikan_Widatra_${resolution}_${from}_ke_${to}.xlsx`;
    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );
    res.setHeader("Content-Disposition", `attachment; filename="${fileName}"`);
    res.setHeader("Content-Length", buffer.length);
    res.send(buffer);
  } catch (err) {
    next(err);
  }
};

export const getElectricityExportPreviewHandler = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const from = (req.query.from as string) || new Date().toISOString().slice(0, 10);
    const to = (req.query.to as string) || from;
    const resolution = (req.query.resolution as "hour" | "day" | "week" | "month" | "year") || "hour";

    const data = await getElectricityExportData({
      from,
      to,
      resolution,
      sheets: "all"
    });

    res.json({
      status: "success",
      data: {
        metadata: data.metadata,
        summary: data.summary,
        rows: data.rows.slice(0, 200),
        totalRows: data.rows.length
      }
    });
  } catch (err) {
    next(err);
  }
};

export const EQUIPMENT_NAME_TO_PM: Record<string, string> = {
  // Cooling Tower (7)
  "cooling tower pump wf1-u3": "PM152",
  "f1 cooling tower pump wf1-u3": "PM152",
  "cooling tower fan wf1-u3": "PM181",
  "f1 cooling tower fan wf1-u3": "PM181",
  "cooling fase-1 wf2": "PM206",
  "f2 cooling fase-1": "PM206",
  "cooling critical wf2": "PM215",
  "f2 cooling critical": "PM215",
  "cooling fase-2 wf2": "PM318",
  "f2 cooling fase-2": "PM318",
  "cooling tower ct-pump wf2": "PM324",
  "f2 cooling tower ct-pump": "PM324",
  "cooling tower ct-fan wf2": "PM325",
  "f2 cooling tower ct-fan": "PM325",

  // Boiler (2)
  "boiler 4 wf1": "PM184",
  "f1 boiler 4": "PM184",
  "boiler-5 wf2": "PM213",
  "f2 boiler-5": "PM213",

  // Compressed Air (5)
  "compressed air zt-55 wf1": "PM140",
  "f1 compressed air zt-55": "PM140",
  "compressed air zt-30.1&2 wf1": "PM182",
  "f1 compressed air zt-30.1&2": "PM182",
  "compressed air ale-30 wf1": "PM183",
  "f1 compressed air ale-30": "PM183",
  "compressed air atlas wf2": "PM214",
  "f2 compressed air atlas": "PM214",
  "kobelco ale-250 wf2": "PM229",
  "f2 kobelco ale-250": "PM229",

  // Chiller (8)
  "chiller prep daikin barat wf1": "PM177",
  "f1 chiller prep daikin barat": "PM177",
  "chiller prep daikin timur wf1": "PM178",
  "f1 chiller prep daikin timur": "PM178",
  "chiller bp wf1-u3": "PM180",
  "f1 chiller bp wf1-u3": "PM180",
  "chiller - wf2u2": "PM209",
  "f2 chiller - wf2u2": "PM209",
  "chiller rtac 250 (ro & hvac) wf2": "PM271",
  "f2 chiller rtac 250 (ro&hvac)": "PM271",
  "f2 chiller rtac 250 (ro & hvac)": "PM271",
  "chiller rtac 170 (ro) wf2": "PM272",
  "f2 chiller rtac 170 (ro)": "PM272",
  "chiller rtac 100 (bp) wf2": "PM274",
  "f2 chiller rtac 100 (bp)": "PM274",
  "chiller rtac-275 (prep) wf2": "PM319",
  "f2 chiller rtac-275 (prep)": "PM319",

  // HVAC Warehouse & Penerangan (8)
  "wh 4 penerangan wf1": "PM134",
  "f1 wh 4 penerangan": "PM134",
  "lighting wh 1 wf1": "PM154",
  "f1 lighting wh 1": "PM154",
  "hvac office atas wf1": "PM151",
  "f1 hvac office atas": "PM151",
  "hvac wh-3 wf1": "PM179",
  "f1 hvac wh-3": "PM179",
  "wh 6 wf2": "PM207",
  "f2 wh 6": "PM207",
  "wh 5 wf2": "PM208",
  "f2 wh 5": "PM208",
  "wh-7 wf2": "PM226",
  "f2 wh-7": "PM226",
  "penerangan pd wf2": "PM288",
  "f2 penerangan pd": "PM288",

  // HVAC QC & Produksi (9)
  "full cooling wf1-u3": "PM138",
  "f1 full cooling wf1-u3": "PM138",
  "hvac-qc wf1": "PM153",
  "f1 hvac-qc": "PM153",
  "hvac wf1u3": "PM185",
  "f1 hvac wf1u3": "PM185",
  "heater wf2u2": "PM203",
  "f2 heater wf2u2": "PM203",
  "ahu wf2ui": "PM205",
  "f2 ahu wf2ui": "PM205",
  "return sample qc wf2": "PM273",
  "return sample qc": "PM273",
  "ahu-1 - wf2u2": "PM321",
  "f2 ahu-1 - wf2u2": "PM321",
  "ahu-2 - wf2u2": "PM322",
  "f2 ahu-2 - wf2u2": "PM322",
  "main supply qc office & lab wf1": "PM132",
  "f1 main supply qc office & lab": "PM132",

  // Panel Distribusi & Water Treatment / Process (15)
  "mdp3 wf1": "PM133",
  "f1 mdp3": "PM133",
  "mdp-2 wf1": "PM135",
  "f1 mdp-2": "PM135",
  "mdp-1.2 wf1": "PM136",
  "f1 mdp-1.2": "PM136",
  "mdp-1.1 wf1": "PM139",
  "f1 mdp-1.1": "PM139",
  "st3 wf1": "PM175",
  "f1 st3": "PM175",
  "qc lab wf1": "PM176",
  "f1 qc lab": "PM176",
  "putr-1 wf2": "PM201",
  "f2 putr-1": "PM201",
  "putr-2 wf2": "PM202",
  "f2 putr-2": "PM202",
  "main critical panel wf2": "PM210",
  "f2 main critical panel": "PM210",
  "panel otoklaf wf2u1": "PM211",
  "f2 panel otoklaf wf2u1": "PM211",
  "panel otoklaf wf2u2": "PM212",
  "f2 panel otoklaf wf2u2": "PM212",
  "wt-du-psg wf2": "PM320",
  "f2 wt-du-psg": "PM320",
  "pw generation - ro wf2": "PM323",
  "f2 pw generation - ro": "PM323",
  "putr-new wf2": "PM327",
  "f2 putr-new": "PM327",
  "mcc bp 7 wf2": "PM337",
  "f2 mcc bp 7": "PM337",

  // Incoming Cubicles (3)
  "incoming cubicle pln (pm8000)": "PM410",
  "incoming cubicle pln": "PM410",
  "incoming cubicle wf1 (pm5560)": "PM411",
  "incoming cubicle wf1": "PM411",
  "incoming cubicle wf2 (pm5560)": "PM412",
  "incoming cubicle wf2": "PM412"
};

export const PM_DEFAULT_LABELS: Record<string, string> = {
  PM132: "Main Supply QC Office & Lab WF1",
  PM133: "MDP3 WF1",
  PM134: "WH 4 Penerangan WF1",
  PM135: "MDP-2 WF1",
  PM136: "MDP-1.2 WF1",
  PM138: "Full Cooling WF1-U3",
  PM139: "MDP-1.1 WF1",
  PM140: "Compressed Air ZT-55 WF1",
  PM151: "HVAC Office Atas WF1",
  PM152: "Cooling Tower Pump WF1-U3",
  PM153: "HVAC-QC WF1",
  PM154: "Lighting WH 1 WF1",
  PM175: "ST3 WF1",
  PM176: "QC Lab WF1",
  PM177: "Chiller Prep Daikin Barat WF1",
  PM178: "Chiller Prep Daikin Timur WF1",
  PM179: "HVAC WH-3 WF1",
  PM180: "Chiller BP WF1-U3",
  PM181: "Cooling Tower Fan WF1-U3",
  PM182: "Compressed Air ZT-30.1&2 WF1",
  PM183: "Compressed Air ALE-30 WF1",
  PM184: "Boiler 4 WF1",
  PM185: "HVAC WF1U3",
  PM201: "PUTR-1 WF2",
  PM202: "PUTR-2 WF2",
  PM203: "Heater WF2U2",
  PM205: "AHU WF2UI",
  PM206: "Cooling Fase-1 WF2",
  PM207: "WH 6 WF2",
  PM208: "WH 5 WF2",
  PM209: "Chiller - WF2U2",
  PM210: "Main Critical Panel WF2",
  PM211: "Panel Otoklaf WF2U1",
  PM212: "Panel Otoklaf WF2U2",
  PM213: "Boiler-5 WF2",
  PM214: "Compressed Air Atlas WF2",
  PM215: "Cooling Critical WF2",
  PM226: "WH-7 WF2",
  PM229: "Kobelco ALE-250 WF2",
  PM271: "Chiller RTAC 250 (RO & HVAC) WF2",
  PM272: "Chiller RTAC 170 (RO) WF2",
  PM273: "Return Sample QC WF2",
  PM274: "Chiller RTAC 100 (BP) WF2",
  PM288: "Penerangan PD WF2",
  PM318: "Cooling Fase-2 WF2",
  PM319: "Chiller RTAC-275 (Prep) WF2",
  PM320: "WT-DU-PSG WF2",
  PM321: "AHU-1 - WF2U2",
  PM322: "AHU-2 - WF2U2",
  PM323: "PW Generation - RO WF2",
  PM324: "Cooling Tower CT-Pump WF2",
  PM325: "Cooling Tower CT-Fan WF2",
  PM327: "PUTR-NEW WF2",
  PM337: "MCC BP 7 WF2",
  PM410: "Incoming Cubicle PLN (PM8000)",
  PM411: "Incoming Cubicle WF1 (PM5560)",
  PM412: "Incoming Cubicle WF2 (PM5560)"
};

/**
 * Core engine to compute factual monthly daily electricity consumption for all equipment units
 */
export async function computeEquipmentMonthlyBatch(
  currentMonth: string,
  comparisonMonth: string
): Promise<{
  currentMonth: string;
  comparisonMonth: string;
  daysInCurrent: number;
  daysInComparison: number;
  data: Record<string, {
    pmId: string;
    label: string;
    current: number[];
    previous: number[];
    currTotalKwh: number;
    prevTotalKwh: number;
    hasData: boolean;
  }>;
}> {
  const pool = getPostgresPool();
  const months = [currentMonth, comparisonMonth].sort();
  const earlierMonth = months[0];
  const laterMonth = months[1];

  const [eYear, eMonth] = earlierMonth.split("-").map(Number);
  const [lYear, lMonth] = laterMonth.split("-").map(Number);
  const lDays = new Date(lYear, lMonth, 0).getDate();

  const pad = (n: number) => String(n).padStart(2, "0");

  // Query window: 2 hours before 1st of earlier month to 2 hours after last day of later month
  const fromDate = new Date(`${earlierMonth}-01T00:00:00`);
  const baselineDate = new Date(fromDate.getTime() - 2 * 60 * 60 * 1000);
  const fromQueryVal = `${baselineDate.getFullYear()}-${pad(baselineDate.getMonth() + 1)}-${pad(baselineDate.getDate())} ${pad(baselineDate.getHours())}:${pad(baselineDate.getMinutes())}:${pad(baselineDate.getSeconds())}`;

  const toDate = new Date(`${laterMonth}-${pad(lDays)}T23:59:59`);
  const toPlusDate = new Date(toDate.getTime() + 2 * 60 * 60 * 1000);
  const toQueryVal = `${toPlusDate.getFullYear()}-${pad(toPlusDate.getMonth() + 1)}-${pad(toPlusDate.getDate())} ${pad(toPlusDate.getHours())}:${pad(toPlusDate.getMinutes())}:${pad(toPlusDate.getSeconds())}`;

  // 1. Fetch PM telemetry (excluding cubicles which are queried from their dedicated tables)
  const pmSql = `
    SELECT DISTINCT ON (UPPER(pm_id), date_trunc('hour', t_stamp))
      UPPER(pm_id) as pm_id,
      t_stamp,
      active_energy::float as value,
      status
    FROM electric_pm_telemetry
    WHERE t_stamp >= $1 AND t_stamp <= $2
      AND UPPER(pm_id) NOT IN ('PM410', 'PM411', 'PM412')
      AND (active_energy IS NULL OR active_energy < 50000000)
    ORDER BY UPPER(pm_id), date_trunc('hour', t_stamp) ASC, t_stamp DESC
  `;

  // 2. Fetch Cubicle telemetries
  const [pmRes, plnRes, wf1Res, wf2Res] = await Promise.all([
    pool.query(pmSql, [fromQueryVal, toQueryVal]),
    pool.query(`
      SELECT DISTINCT ON (date_trunc('hour', t_stamp))
        'PM410' as pm_id,
        t_stamp,
        active_energy::float as value,
        status_pm8000 as status
      FROM electric_pln_telemetry
      WHERE t_stamp >= $1 AND t_stamp <= $2
      ORDER BY date_trunc('hour', t_stamp) ASC, t_stamp DESC
    `, [fromQueryVal, toQueryVal]),
    pool.query(`
      SELECT DISTINCT ON (date_trunc('hour', t_stamp))
        'PM411' as pm_id,
        t_stamp,
        active_energy::float as value,
        status_pm5500 as status
      FROM electric_wf1_telemetry
      WHERE t_stamp >= $1 AND t_stamp <= $2
      ORDER BY date_trunc('hour', t_stamp) ASC, t_stamp DESC
    `, [fromQueryVal, toQueryVal]),
    pool.query(`
      SELECT DISTINCT ON (date_trunc('hour', t_stamp))
        'PM412' as pm_id,
        t_stamp,
        active_energy::float as value,
        status_pm5500 as status
      FROM electric_wf2_telemetry
      WHERE t_stamp >= $1 AND t_stamp <= $2
      ORDER BY date_trunc('hour', t_stamp) ASC, t_stamp DESC
    `, [fromQueryVal, toQueryVal])
  ]);

  // 3. Fetch latest minutes if currentMonth is active
  const now = new Date();
  const currentMonthStr = `${now.getFullYear()}-${pad(now.getMonth() + 1)}`;
  let minuteRows: any[] = [];
  if (currentMonth === currentMonthStr) {
    try {
      const pmMinRes = await pool.query(`
        SELECT DISTINCT ON (UPPER(pm_id))
          UPPER(pm_id) as pm_id,
          t_stamp,
          active_energy::float as value,
          status
        FROM electric_pm_telemetry_minute
        WHERE active_energy IS NOT NULL
          AND UPPER(pm_id) NOT IN ('PM410', 'PM411', 'PM412')
          AND active_energy < 50000000
        ORDER BY UPPER(pm_id), t_stamp DESC
      `);
      minuteRows = pmMinRes.rows;

      const [plnMin, wf1Min, wf2Min] = await Promise.all([
        pool.query(`SELECT 'PM410' as pm_id, t_stamp, active_energy::float as value, status_pm8000 as status FROM electric_pln_telemetry_minute ORDER BY t_stamp DESC LIMIT 1`),
        pool.query(`SELECT 'PM411' as pm_id, t_stamp, active_energy::float as value, status_pm5500 as status FROM electric_wf1_telemetry_minute ORDER BY t_stamp DESC LIMIT 1`),
        pool.query(`SELECT 'PM412' as pm_id, t_stamp, active_energy::float as value, status_pm5500 as status FROM electric_wf2_telemetry_minute ORDER BY t_stamp DESC LIMIT 1`)
      ]);
      minuteRows.push(...plnMin.rows, ...wf1Min.rows, ...wf2Min.rows);
    } catch (e: any) {
      console.warn("Minute table query fallback warning:", e.message);
    }
  }

  // Group records by pm_id
  const pmRecords = new Map<string, { ts: Date; value: number | null; status?: boolean }[]>();
  const addRow = (row: any) => {
    const id = row.pm_id;
    if (!pmRecords.has(id)) pmRecords.set(id, []);
    pmRecords.get(id)!.push({
      ts: new Date(row.t_stamp),
      value: row.value !== null ? Number(row.value) : null,
      status: row.status !== false
    });
  };

  pmRes.rows.forEach(addRow);
  plnRes.rows.forEach(addRow);
  wf1Res.rows.forEach(addRow);
  wf2Res.rows.forEach(addRow);

  // Append minute rows
  for (const mRow of minuteRows) {
    const list = pmRecords.get(mRow.pm_id);
    if (list && list.length > 0) {
      const mTs = new Date(mRow.t_stamp);
      const lastTs = list[list.length - 1].ts;
      if (mTs.getTime() > lastTs.getTime() + 60000 && Number(mRow.value) > 0) {
        list.push({
          ts: mTs,
          value: Number(mRow.value),
          status: mRow.status !== false
        });
      }
    }
  }

  // Calculate daily consumption
  const [currY, currM] = currentMonth.split("-").map(Number);
  const [compY, compM] = comparisonMonth.split("-").map(Number);
  const daysInCurr = new Date(currY, currM, 0).getDate();
  const daysInComp = new Date(compY, compM, 0).getDate();

  const results: Record<string, {
    pmId: string;
    label: string;
    current: number[];
    previous: number[];
    currTotalKwh: number;
    prevTotalKwh: number;
    hasData: boolean;
  }> = {};

  // Ensure all 57 standard PMs exist in output even if no rows in DB
  const allExpectedPms = Object.keys(PM_DEFAULT_LABELS);
  for (const pmId of allExpectedPms) {
    results[pmId] = {
      pmId,
      label: PM_DEFAULT_LABELS[pmId] || pmId,
      current: new Array(daysInCurr).fill(0),
      previous: new Array(daysInComp).fill(0),
      currTotalKwh: 0,
      prevTotalKwh: 0,
      hasData: false
    };
  }

  for (const [pmId, records] of pmRecords.entries()) {
    // Sort records by timestamp
    records.sort((a, b) => a.ts.getTime() - b.ts.getTime());

    const currDaily = new Array(daysInCurr).fill(0);
    const compDaily = new Array(daysInComp).fill(0);

    for (let i = 1; i < records.length; i++) {
      const prev = records[i - 1];
      const curr = records[i];
      const prevVal = prev.status === false ? null : prev.value;
      const currVal = curr.status === false ? null : curr.value;
      const timeDiffMs = curr.ts.getTime() - prev.ts.getTime();

      let diff = 0;
      if (currVal !== null && prevVal !== null && !isNaN(currVal) && !isNaN(prevVal)) {
        if (timeDiffMs <= 90 * 60 * 1000) {
          diff = currVal - prevVal;
          if (diff < 0 || diff > 20000) diff = 0;
        }
      }

      // Date string in WIB (GMT+7)
      const wibTime = new Date(curr.ts.getTime() + 7 * 60 * 60 * 1000);
      const y = wibTime.getUTCFullYear();
      const m = pad(wibTime.getUTCMonth() + 1);
      const d = wibTime.getUTCDate();
      const monthKey = `${y}-${m}`;

      if (monthKey === currentMonth && d >= 1 && d <= daysInCurr) {
        currDaily[d - 1] += diff;
      } else if (monthKey === comparisonMonth && d >= 1 && d <= daysInComp) {
        compDaily[d - 1] += diff;
      }
    }

    const currentRounded = currDaily.map(v => Math.round(v * 1000) / 1000);
    const compRounded = compDaily.map(v => Math.round(v * 1000) / 1000);
    const currTotal = Math.round(currentRounded.reduce((a, b) => a + b, 0) * 1000) / 1000;
    const compTotal = Math.round(compRounded.reduce((a, b) => a + b, 0) * 1000) / 1000;

    const label = PM_DEFAULT_LABELS[pmId] || pmId;

    results[pmId] = {
      pmId,
      label,
      current: currentRounded,
      previous: compRounded,
      currTotalKwh: currTotal,
      prevTotalKwh: compTotal,
      hasData: currTotal > 0 || compTotal > 0
    };
  }

  // Populate alias keys for convenient lookup by name or seriesKey
  for (const [alias, pmId] of Object.entries(EQUIPMENT_NAME_TO_PM)) {
    if (results[pmId]) {
      results[alias] = results[pmId];
    }
  }

  return {
    currentMonth,
    comparisonMonth,
    daysInCurrent: daysInCurr,
    daysInComparison: daysInComp,
    data: results
  };
}

/**
 * Batch endpoint for all 57 equipment units monthly daily analytics
 * GET /analytics/electricity/equipment-monthly-batch?currentMonth=YYYY-MM&comparisonMonth=YYYY-MM
 */
export const getEquipmentMonthlyBatchAnalyticsHandler = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const currentMonth = (req.query.currentMonth as string) || new Date().toISOString().slice(0, 7); // YYYY-MM
    let comparisonMonth = req.query.comparisonMonth as string | undefined;
    if (!comparisonMonth) {
      const [currY, currM] = currentMonth.split("-").map(Number);
      const prevDate = new Date(currY, currM - 2, 1);
      comparisonMonth = `${prevDate.getFullYear()}-${String(prevDate.getMonth() + 1).padStart(2, "0")}`;
    }

    const batchData = await computeEquipmentMonthlyBatch(currentMonth, comparisonMonth);
    res.json({
      success: true,
      ...batchData
    });
  } catch (err) {
    next(err);
  }
};

/**
 * Single equipment monthly daily analytics endpoint
 * GET /analytics/electricity/equipment-monthly?pmId=...&machine=...&currentMonth=YYYY-MM&comparisonMonth=YYYY-MM
 */
export const getEquipmentMonthlyAnalyticsHandler = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const rawPmId = req.query.pmId as string | undefined;
    const configKey = req.query.configKey as string | undefined;
    const machine = req.query.machine as string | undefined;
    const currentMonth = (req.query.currentMonth as string) || new Date().toISOString().slice(0, 7); // YYYY-MM
    
    // Comparison month defaults to previous month
    let comparisonMonth = req.query.comparisonMonth as string | undefined;
    if (!comparisonMonth) {
      const [currY, currM] = currentMonth.split("-").map(Number);
      const prevDate = new Date(currY, currM - 2, 1);
      comparisonMonth = `${prevDate.getFullYear()}-${String(prevDate.getMonth() + 1).padStart(2, "0")}`;
    }

    const pool = getPostgresPool();
    let targetPmId: string | null = null;
    let targetLabel: string = machine || rawPmId || configKey || "Equipment";

    // 1. If explicit pmId provided
    if (rawPmId && rawPmId.trim()) {
      targetPmId = rawPmId.trim().toUpperCase();
    }

    // 2. Machine lookup
    if (!targetPmId && machine) {
      const normMachine = machine.toLowerCase().trim();
      targetPmId = EQUIPMENT_NAME_TO_PM[normMachine] || null;
      if (!targetPmId) {
        try {
          const cfgRes = await pool.query(`SELECT config_key, label, value FROM electricity_config WHERE LOWER(label) = LOWER($1) LIMIT 1`, [machine.trim()]);
          if (cfgRes.rows.length > 0) {
            const val = cfgRes.rows[0].value || {};
            targetPmId = (val.pm_id || val.json_key || cfgRes.rows[0].config_key).toUpperCase();
            targetLabel = cfgRes.rows[0].label || targetLabel;
          }
        } catch {}
      }
    }

    // 3. Look up configKey if pmId not resolved
    if (!targetPmId && configKey) {
      try {
        const cfgRes = await pool.query(`SELECT config_key, label, value FROM electricity_config WHERE config_key = $1 LIMIT 1`, [configKey]);
        if (cfgRes.rows.length > 0) {
          const val = cfgRes.rows[0].value || {};
          targetPmId = (val.pm_id || val.json_key || cfgRes.rows[0].config_key).toUpperCase();
          targetLabel = cfgRes.rows[0].label || targetLabel;
        }
      } catch {}
    }

    if (!targetPmId) {
      targetPmId = (rawPmId || configKey || machine || "UNKNOWN").toUpperCase().replace(/[^A-Z0-9_]/g, "");
    }

    if (PM_DEFAULT_LABELS[targetPmId]) {
      targetLabel = PM_DEFAULT_LABELS[targetPmId];
    }

    const batchData = await computeEquipmentMonthlyBatch(currentMonth, comparisonMonth);
    const itemData = batchData.data[targetPmId] || {
      pmId: targetPmId,
      label: targetLabel,
      current: new Array(batchData.daysInCurrent).fill(0),
      previous: new Array(batchData.daysInComparison).fill(0),
      currTotalKwh: 0,
      prevTotalKwh: 0,
      hasData: false
    };

    res.json({
      pmId: targetPmId,
      label: itemData.label || targetLabel,
      currentMonth: {
        month: currentMonth,
        daysInMonth: batchData.daysInCurrent,
        totalKwh: itemData.currTotalKwh,
        daily: itemData.current,
        hasData: itemData.currTotalKwh > 0
      },
      comparisonMonth: {
        month: comparisonMonth,
        daysInMonth: batchData.daysInComparison,
        totalKwh: itemData.prevTotalKwh,
        daily: itemData.previous,
        hasData: itemData.prevTotalKwh > 0
      },
      hasData: itemData.hasData
    });
  } catch (err) {
    next(err);
  }
};


