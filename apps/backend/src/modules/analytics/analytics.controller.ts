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
    const pmId = (req.params.pmId || "").toUpperCase();
    const hours = Number(req.query.hours) || 24;
    const pool = getPostgresPool();

    const dbRes = await pool.query(`
      SELECT t_stamp, volt_ab, volt_bc, volt_ca, current_a, current_b, current_c, 
             active_power_total, reactive_power_total, apparent_power_total, power_factor, 
             frequency, active_energy, status
      FROM electric_pm_telemetry
      WHERE pm_id = $1
        AND t_stamp >= NOW() - ($2 || ' hours')::INTERVAL
      ORDER BY t_stamp ASC
      LIMIT 500
    `, [pmId, hours]);

    res.json({ data: dbRes.rows });
  } catch (err) {
    next(err);
  }
};
