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
    const currentHour = isToday ? nowWib.getHours() : 23;

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
          COALESCE(
            CASE WHEN s.hour = $2 THEN m.active_power_total ELSE COALESCE(h.active_power_total, m.active_power_total) END,
            0
          ) as active_power_total,
          COALESCE(
            CASE WHEN s.hour = $2 THEN m.current_a ELSE COALESCE(h.current_a, m.current_a) END,
            0
          ) as current_a,
          COALESCE(
            CASE WHEN s.hour = $2 THEN m.current_b ELSE COALESCE(h.current_b, m.current_b) END,
            0
          ) as current_b,
          COALESCE(
            CASE WHEN s.hour = $2 THEN m.current_c ELSE COALESCE(h.current_c, m.current_c) END,
            0
          ) as current_c,
          COALESCE(
            CASE WHEN s.hour = $2 THEN m.volt_ab ELSE COALESCE(h.volt_ab, m.volt_ab) END,
            0
          ) as volt_ab,
          COALESCE(
            CASE WHEN s.hour = $2 THEN m.power_factor ELSE COALESCE(h.power_factor, m.power_factor) END,
            0
          ) as power_factor,
          COALESCE(
            CASE WHEN s.hour = $2 THEN m.active_energy ELSE COALESCE(h.active_energy, m.active_energy) END,
            0
          ) as active_energy,
          COALESCE(m.t_stamp, h.t_stamp) as t_stamp
        FROM generate_series(0, $2) as s(hour)
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
          COALESCE(
            CASE WHEN s.hour = $2 THEN m.active_power_total ELSE COALESCE(h.active_power_total, m.active_power_total) END,
            0
          ) as active_power_total,
          COALESCE(
            CASE WHEN s.hour = $2 THEN m.current_a ELSE COALESCE(h.current_a, m.current_a) END,
            0
          ) as current_a,
          COALESCE(
            CASE WHEN s.hour = $2 THEN m.current_b ELSE COALESCE(h.current_b, m.current_b) END,
            0
          ) as current_b,
          COALESCE(
            CASE WHEN s.hour = $2 THEN m.current_c ELSE COALESCE(h.current_c, m.current_c) END,
            0
          ) as current_c,
          COALESCE(
            CASE WHEN s.hour = $2 THEN m.volt_ab ELSE COALESCE(h.volt_ab, m.volt_ab) END,
            0
          ) as volt_ab,
          COALESCE(
            CASE WHEN s.hour = $2 THEN m.power_factor ELSE COALESCE(h.power_factor, m.power_factor) END,
            0
          ) as power_factor,
          COALESCE(
            CASE WHEN s.hour = $2 THEN m.active_energy ELSE COALESCE(h.active_energy, m.active_energy) END,
            0
          ) as active_energy,
          COALESCE(m.t_stamp, h.t_stamp) as t_stamp
        FROM generate_series(0, $2) as s(hour)
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
          COALESCE(
            CASE WHEN s.hour = $2 THEN m.active_power_total ELSE COALESCE(h.active_power_total, m.active_power_total) END,
            0
          ) as active_power_total,
          COALESCE(
            CASE WHEN s.hour = $2 THEN m.current_a ELSE COALESCE(h.current_a, m.current_a) END,
            0
          ) as current_a,
          COALESCE(
            CASE WHEN s.hour = $2 THEN m.current_b ELSE COALESCE(h.current_b, m.current_b) END,
            0
          ) as current_b,
          COALESCE(
            CASE WHEN s.hour = $2 THEN m.current_c ELSE COALESCE(h.current_c, m.current_c) END,
            0
          ) as current_c,
          COALESCE(
            CASE WHEN s.hour = $2 THEN m.volt_ab ELSE COALESCE(h.volt_ab, m.volt_ab) END,
            0
          ) as volt_ab,
          COALESCE(
            CASE WHEN s.hour = $2 THEN m.power_factor ELSE COALESCE(h.power_factor, m.power_factor) END,
            0
          ) as power_factor,
          COALESCE(
            CASE WHEN s.hour = $2 THEN m.active_energy ELSE COALESCE(h.active_energy, m.active_energy) END,
            0
          ) as active_energy,
          COALESCE(m.t_stamp, h.t_stamp) as t_stamp
        FROM generate_series(0, $2) as s(hour)
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
          COALESCE(
            CASE WHEN s.hour = $3 THEN m.active_power_total ELSE COALESCE(h.active_power_total, m.active_power_total) END,
            0
          ) as active_power_total,
          COALESCE(
            CASE WHEN s.hour = $3 THEN m.current_a ELSE COALESCE(h.current_a, m.current_a) END,
            0
          ) as current_a,
          COALESCE(
            CASE WHEN s.hour = $3 THEN m.current_b ELSE COALESCE(h.current_b, m.current_b) END,
            0
          ) as current_b,
          COALESCE(
            CASE WHEN s.hour = $3 THEN m.current_c ELSE COALESCE(h.current_c, m.current_c) END,
            0
          ) as current_c,
          COALESCE(
            CASE WHEN s.hour = $3 THEN m.volt_ab ELSE COALESCE(h.volt_ab, m.volt_ab) END,
            0
          ) as volt_ab,
          COALESCE(
            CASE WHEN s.hour = $3 THEN m.power_factor ELSE COALESCE(h.power_factor, m.power_factor) END,
            0
          ) as power_factor,
          COALESCE(
            CASE WHEN s.hour = $3 THEN m.active_energy ELSE COALESCE(h.active_energy, m.active_energy) END,
            0
          ) as active_energy,
          COALESCE(m.t_stamp, h.t_stamp) as t_stamp
        FROM generate_series(0, $3) as s(hour)
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
    const tagMap: Record<string, { pmId?: string; group?: string; table?: string }> = {
      "f1-mdp-1.1": { group: "ew21", pmId: "PM318", table: "electric_wf1_telemetry" },
      "f1-mdp-1.2": { group: "ew21", pmId: "PM319", table: "electric_wf1_telemetry" },
      "f1-mdp-2": { group: "ew21", pmId: "PM320", table: "electric_wf1_telemetry" },
      "f1-mdp-3": { group: "ew21", pmId: "PM321", table: "electric_wf1_telemetry" },
      "f2-putr-1": { group: "ew22", pmId: "PM201", table: "electric_wf2_telemetry" },
      "f2-putr-2": { group: "ew22", pmId: "PM202", table: "electric_wf2_telemetry" },
      "f2-putr-new": { group: "ew23", pmId: "PM325", table: "electric_wf2_telemetry" },
    };

    const mapping = tagMap[tag.toLowerCase()] || {};
    const targetPmId = mapping.pmId || (tag.toUpperCase().startsWith("PM") ? tag.toUpperCase() : null);
    const targetGroup = mapping.group || null;
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
          WHERE (pm_id ILIKE $1 OR group_id ILIKE $2)
            AND t_stamp >= $3::timestamp AND t_stamp <= ($4 || ' 23:59:59')::timestamp
          UNION ALL
          SELECT t_stamp, volt_ab, volt_bc, volt_ca, volt_ll,
                 current_a, current_b, current_c, current_unbalance,
                 active_power_total, reactive_power_total, apparent_power_total,
                 power_factor, frequency,
                 thd_volt_a, thd_volt_b, thd_volt_c,
                 thd_current_a, thd_current_b, thd_current_c,
                 active_energy
          FROM electric_pm_telemetry_minute
          WHERE (pm_id ILIKE $1 OR group_id ILIKE $2)
            AND t_stamp >= $3::timestamp AND t_stamp <= ($4 || ' 23:59:59')::timestamp
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

    // 2. If no PM rows found, query main feeder table
    if (queryRows.length === 0) {
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
    const tagLabel = machine && machine !== "all" ? `${tag.toUpperCase()} - ${machine}` : tag.toUpperCase();

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
