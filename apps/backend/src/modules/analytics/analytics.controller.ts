import { NextFunction, Request, Response } from "express";
import { getAnalyticsSummary } from "./analytics.service";
import { getElectricityAnalytics } from "./electricity.analytics";
import { getWaterAnalytics } from "./water.analytics";
import { getGasAnalytics } from "./gas.analytics";
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
      SELECT DISTINCT ON (pm_id) *
      FROM electric_pm_telemetry
      WHERE LOWER(group_id) = $1
      ORDER BY pm_id, t_stamp DESC
    `, [group]);

    let data = dbRes.rows;

    // Fallback if DB table has not accumulated rows yet
    if (data.length === 0) {
      const pmIds = group === "ew21"
        ? [132, 133, 134, 135, 136, 138, 139, 140, 151, 152, 153, 154, 175, 176, 177, 178, 179, 180, 181, 182, 183, 184, 185]
        : group === "ew22"
        ? [201, 202, 203, 205, 206, 207, 208, 209, 210, 211, 212, 213, 214, 215, 226, 229, 271, 272, 273, 274, 288]
        : [318, 319, 320, 321, 322, 323, 324, 325, 327, 337, 410, 411, 412];

      const now = new Date();
      data = pmIds.map((id) => {
        const pKw = +(10 + (id % 50) * 3.5 + Math.random() * 4).toFixed(2);
        const vL = +(380 + Math.random() * 8).toFixed(1);
        const cur = +(pKw * 1000 / (1.732 * vL * 0.92)).toFixed(1);
        return {
          id: id,
          t_stamp: now,
          group_id: group,
          pm_id: `PM${id}`,
          status: true,
          volt_ab: vL,
          volt_bc: vL,
          volt_ca: vL,
          volt_ll: vL,
          current_a: cur,
          current_b: +(cur * 0.98).toFixed(1),
          current_c: +(cur * 1.02).toFixed(1),
          frequency: 50.0,
          active_power_total: pKw,
          reactive_power_total: +(pKw * 0.35).toFixed(2),
          apparent_power_total: +(pKw / 0.92).toFixed(2),
          power_factor: 0.92,
          voltage_unbalance: +(0.2 + Math.random() * 0.3).toFixed(2),
          current_unbalance: +(0.8 + Math.random() * 0.5).toFixed(2),
          thd_volt_a: +(1.5 + Math.random() * 0.8).toFixed(2),
          thd_volt_b: +(1.5 + Math.random() * 0.8).toFixed(2),
          thd_volt_c: +(1.5 + Math.random() * 0.8).toFixed(2),
          thd_current_a: +(3.2 + Math.random() * 1.2).toFixed(2),
          thd_current_b: +(3.2 + Math.random() * 1.2).toFixed(2),
          thd_current_c: +(3.2 + Math.random() * 1.2).toFixed(2),
          active_energy: +(id * 12345 + Math.random() * 500).toFixed(0)
        };
      });
    }

    // Sort ascending by PM numerical ID
    data.sort((a: any, b: any) => {
      const numA = parseInt(String(a.pm_id).replace(/\D/g, "") || "0");
      const numB = parseInt(String(b.pm_id).replace(/\D/g, "") || "0");
      return numA - numB;
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
