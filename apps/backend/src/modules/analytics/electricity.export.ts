import { getPostgresPool } from "../../database/postgres";
import * as XLSX from "xlsx";
import { addCharts, ChartSpec } from "chartsheet";

export interface ElectricityExportParams {
  from: string; // YYYY-MM-DD
  to: string;   // YYYY-MM-DD
  resolution: "hour" | "day" | "week" | "month" | "year";
  sheets?: string; // comma-separated or "all"
}

export interface ElectricityExportResult {
  metadata: {
    from: string;
    to: string;
    resolution: string;
    exportedAt: string;
    company: string;
    totalRecords: number;
  };
  summary: {
    totalPlantKwh: number;
    totalPlnKwh: number;
    totalSolarKwh: number;
    totalWf1Kwh: number;
    totalWf2Kwh: number;
    solarSharePct: number;
    totalPlnCost: number;
    totalSolarSavings: number;
    avgPowerFactor: number;
    maxPeakDemandKw: number;
  };
  sheets: {
    overview?: any[];
    pln?: any[];
    wf1?: any[];
    wf2?: any[];
    solar?: any[];
    subdistribution?: any[];
  };
}

const pad = (n: number) => String(n).padStart(2, "0");

export async function getElectricityExportData(params: ElectricityExportParams): Promise<ElectricityExportResult> {
  const pool = getPostgresPool();
  const { from, to, resolution = "hour", sheets = "all" } = params;

  const fromStr = `${from} 00:00:00`;
  const toStr = `${to} 23:59:59`;

  const reqSheets = new Set(
    sheets === "all" || !sheets
      ? ["overview", "pln", "wf1", "wf2", "solar", "subdistribution"]
      : sheets.split(",").map((s) => s.trim().toLowerCase())
  );

  const truncSql = {
    hour: "hour",
    day: "day",
    week: "week",
    month: "month",
    year: "year"
  }[resolution] || "hour";

  const resultSheets: ElectricityExportResult["sheets"] = {};
  let totalRecordsCount = 0;

  // 1. Fetch PLN Telemetry
  let plnRows: any[] = [];
  try {
    if (resolution === "hour") {
      const plnRes = await pool.query(`
        SELECT 
          t_stamp,
          status_pm8000,
          volt_ll,
          volt_ab,
          volt_bc,
          volt_ca,
          current_a,
          current_b,
          current_c,
          ROUND(((COALESCE(current_a,0) + COALESCE(current_b,0) + COALESCE(current_c,0)) / 3.0), 2) as current_avg,
          frequency,
          active_power,
          reactive_power_total,
          apparent_power_total,
          power_factor,
          voltage_unbalance,
          current_unbalance,
          thd_volt_a,
          thd_volt_b,
          thd_volt_c,
          thd_current_a,
          thd_current_b,
          thd_current_c,
          active_energy
        FROM electric_pln_telemetry
        WHERE t_stamp >= $1 AND t_stamp <= $2
        ORDER BY t_stamp ASC
      `, [fromStr, toStr]);
      plnRows = plnRes.rows;
    } else {
      const plnRes = await pool.query(`
        SELECT 
          date_trunc('${truncSql}', t_stamp) as t_stamp,
          BOOL_OR(status_pm8000) as status_pm8000,
          ROUND(AVG(volt_ll)::numeric, 2) as volt_ll,
          ROUND(AVG(volt_ab)::numeric, 2) as volt_ab,
          ROUND(AVG(volt_bc)::numeric, 2) as volt_bc,
          ROUND(AVG(volt_ca)::numeric, 2) as volt_ca,
          ROUND(AVG(current_a)::numeric, 2) as current_a,
          ROUND(AVG(current_b)::numeric, 2) as current_b,
          ROUND(AVG(current_c)::numeric, 2) as current_c,
          ROUND(((AVG(COALESCE(current_a,0)) + AVG(COALESCE(current_b,0)) + AVG(COALESCE(current_c,0))) / 3.0)::numeric, 2) as current_avg,
          ROUND(AVG(frequency)::numeric, 2) as frequency,
          ROUND(AVG(active_power)::numeric, 2) as active_power,
          ROUND(AVG(reactive_power_total)::numeric, 2) as reactive_power_total,
          ROUND(AVG(apparent_power_total)::numeric, 2) as apparent_power_total,
          ROUND(AVG(power_factor)::numeric, 3) as power_factor,
          ROUND(AVG(voltage_unbalance)::numeric, 2) as voltage_unbalance,
          ROUND(AVG(current_unbalance)::numeric, 2) as current_unbalance,
          ROUND(AVG(thd_volt_a)::numeric, 2) as thd_volt_a,
          ROUND(AVG(thd_volt_b)::numeric, 2) as thd_volt_b,
          ROUND(AVG(thd_volt_c)::numeric, 2) as thd_volt_c,
          ROUND(AVG(thd_current_a)::numeric, 2) as thd_current_a,
          ROUND(AVG(thd_current_b)::numeric, 2) as thd_current_b,
          ROUND(AVG(thd_current_c)::numeric, 2) as thd_current_c,
          MAX(active_energy) as active_energy
        FROM electric_pln_telemetry
        WHERE t_stamp >= $1 AND t_stamp <= $2
        GROUP BY date_trunc('${truncSql}', t_stamp)
        ORDER BY t_stamp ASC
      `, [fromStr, toStr]);
      plnRows = plnRes.rows;
    }
    if (reqSheets.has("pln")) {
      resultSheets.pln = plnRows;
      totalRecordsCount += plnRows.length;
    }
  } catch (err: any) {
    console.error("Error querying PLN export telemetry:", err.message);
  }

  // 2. Fetch WF1 Feeder Telemetry
  let wf1Rows: any[] = [];
  try {
    if (resolution === "hour") {
      const wf1Res = await pool.query(`
        SELECT 
          t_stamp,
          status_pm5500,
          volt_ll,
          volt_ab,
          volt_bc,
          volt_ca,
          current_a,
          current_b,
          current_c,
          ROUND(((COALESCE(current_a,0) + COALESCE(current_b,0) + COALESCE(current_c,0)) / 3.0), 2) as current_avg,
          frequency,
          active_power_total,
          reactive_power_total,
          apparent_power_total,
          power_factor,
          voltage_unbalance,
          current_unbalance,
          thd_volt_a,
          thd_volt_b,
          thd_volt_c,
          thd_current_a,
          thd_current_b,
          thd_current_c,
          active_energy
        FROM electric_wf1_telemetry
        WHERE t_stamp >= $1 AND t_stamp <= $2
        ORDER BY t_stamp ASC
      `, [fromStr, toStr]);
      wf1Rows = wf1Res.rows;
    } else {
      const wf1Res = await pool.query(`
        SELECT 
          date_trunc('${truncSql}', t_stamp) as t_stamp,
          BOOL_OR(status_pm5500) as status_pm5500,
          ROUND(AVG(volt_ll)::numeric, 2) as volt_ll,
          ROUND(AVG(volt_ab)::numeric, 2) as volt_ab,
          ROUND(AVG(volt_bc)::numeric, 2) as volt_bc,
          ROUND(AVG(volt_ca)::numeric, 2) as volt_ca,
          ROUND(AVG(current_a)::numeric, 2) as current_a,
          ROUND(AVG(current_b)::numeric, 2) as current_b,
          ROUND(AVG(current_c)::numeric, 2) as current_c,
          ROUND(((AVG(COALESCE(current_a,0)) + AVG(COALESCE(current_b,0)) + AVG(COALESCE(current_c,0))) / 3.0)::numeric, 2) as current_avg,
          ROUND(AVG(frequency)::numeric, 2) as frequency,
          ROUND(AVG(active_power_total)::numeric, 2) as active_power_total,
          ROUND(AVG(reactive_power_total)::numeric, 2) as reactive_power_total,
          ROUND(AVG(apparent_power_total)::numeric, 2) as apparent_power_total,
          ROUND(AVG(power_factor)::numeric, 3) as power_factor,
          ROUND(AVG(voltage_unbalance)::numeric, 2) as voltage_unbalance,
          ROUND(AVG(current_unbalance)::numeric, 2) as current_unbalance,
          ROUND(AVG(thd_volt_a)::numeric, 2) as thd_volt_a,
          ROUND(AVG(thd_volt_b)::numeric, 2) as thd_volt_b,
          ROUND(AVG(thd_volt_c)::numeric, 2) as thd_volt_c,
          ROUND(AVG(thd_current_a)::numeric, 2) as thd_current_a,
          ROUND(AVG(thd_current_b)::numeric, 2) as thd_current_b,
          ROUND(AVG(thd_current_c)::numeric, 2) as thd_current_c,
          MAX(active_energy) as active_energy
        FROM electric_wf1_telemetry
        WHERE t_stamp >= $1 AND t_stamp <= $2
        GROUP BY date_trunc('${truncSql}', t_stamp)
        ORDER BY t_stamp ASC
      `, [fromStr, toStr]);
      wf1Rows = wf1Res.rows;
    }
    if (reqSheets.has("wf1")) {
      resultSheets.wf1 = wf1Rows;
      totalRecordsCount += wf1Rows.length;
    }
  } catch (err: any) {
    console.error("Error querying WF1 export telemetry:", err.message);
  }

  // 3. Fetch WF2 Feeder Telemetry
  let wf2Rows: any[] = [];
  try {
    if (resolution === "hour") {
      const wf2Res = await pool.query(`
        SELECT 
          t_stamp,
          status_pm5500,
          volt_ll,
          volt_ab,
          volt_bc,
          volt_ca,
          current_a,
          current_b,
          current_c,
          ROUND(((COALESCE(current_a,0) + COALESCE(current_b,0) + COALESCE(current_c,0)) / 3.0), 2) as current_avg,
          frequency,
          active_power_total,
          reactive_power_total,
          apparent_power_total,
          power_factor,
          voltage_unbalance,
          current_unbalance,
          thd_volt_a,
          thd_volt_b,
          thd_volt_c,
          thd_current_a,
          thd_current_b,
          thd_current_c,
          active_energy
        FROM electric_wf2_telemetry
        WHERE t_stamp >= $1 AND t_stamp <= $2
        ORDER BY t_stamp ASC
      `, [fromStr, toStr]);
      wf2Rows = wf2Res.rows;
    } else {
      const wf2Res = await pool.query(`
        SELECT 
          date_trunc('${truncSql}', t_stamp) as t_stamp,
          BOOL_OR(status_pm5500) as status_pm5500,
          ROUND(AVG(volt_ll)::numeric, 2) as volt_ll,
          ROUND(AVG(volt_ab)::numeric, 2) as volt_ab,
          ROUND(AVG(volt_bc)::numeric, 2) as volt_bc,
          ROUND(AVG(volt_ca)::numeric, 2) as volt_ca,
          ROUND(AVG(current_a)::numeric, 2) as current_a,
          ROUND(AVG(current_b)::numeric, 2) as current_b,
          ROUND(AVG(current_c)::numeric, 2) as current_c,
          ROUND(((AVG(COALESCE(current_a,0)) + AVG(COALESCE(current_b,0)) + AVG(COALESCE(current_c,0))) / 3.0)::numeric, 2) as current_avg,
          ROUND(AVG(frequency)::numeric, 2) as frequency,
          ROUND(AVG(active_power_total)::numeric, 2) as active_power_total,
          ROUND(AVG(reactive_power_total)::numeric, 2) as reactive_power_total,
          ROUND(AVG(apparent_power_total)::numeric, 2) as apparent_power_total,
          ROUND(AVG(power_factor)::numeric, 3) as power_factor,
          ROUND(AVG(voltage_unbalance)::numeric, 2) as voltage_unbalance,
          ROUND(AVG(current_unbalance)::numeric, 2) as current_unbalance,
          ROUND(AVG(thd_volt_a)::numeric, 2) as thd_volt_a,
          ROUND(AVG(thd_volt_b)::numeric, 2) as thd_volt_b,
          ROUND(AVG(thd_volt_c)::numeric, 2) as thd_volt_c,
          ROUND(AVG(thd_current_a)::numeric, 2) as thd_current_a,
          ROUND(AVG(thd_current_b)::numeric, 2) as thd_current_b,
          ROUND(AVG(thd_current_c)::numeric, 2) as thd_current_c,
          MAX(active_energy) as active_energy
        FROM electric_wf2_telemetry
        WHERE t_stamp >= $1 AND t_stamp <= $2
        GROUP BY date_trunc('${truncSql}', t_stamp)
        ORDER BY t_stamp ASC
      `, [fromStr, toStr]);
      wf2Rows = wf2Res.rows;
    }
    if (reqSheets.has("wf2")) {
      resultSheets.wf2 = wf2Rows;
      totalRecordsCount += wf2Rows.length;
    }
  } catch (err: any) {
    console.error("Error querying WF2 export telemetry:", err.message);
  }

  // 4. Fetch Solar PLTS Telemetry (Combine POI-1 and POI-2)
  let solarRows: any[] = [];
  try {
    const rawPlts = await pool.query(`
      SELECT 
        date_trunc('${truncSql}', t_stamp) as t_stamp,
        poi_id,
        BOOL_OR(status) as status,
        ROUND(AVG(volt_ab)::numeric, 1) as volt_ab,
        ROUND(AVG(frequency)::numeric, 2) as frequency,
        ROUND(AVG(active_power)::numeric, 2) as active_power,
        ROUND(MAX(active_power)::numeric, 2) as peak_demand,
        MAX(total_kwh) as total_kwh,
        MAX(total_kvarh) as total_kvarh
      FROM electric_plts_telemetry
      WHERE t_stamp >= $1 AND t_stamp <= $2
      GROUP BY date_trunc('${truncSql}', t_stamp), poi_id
      ORDER BY t_stamp ASC, poi_id ASC
    `, [fromStr, toStr]);

    const solarByTs = new Map<string, any>();
    rawPlts.rows.forEach((r: any) => {
      const tsStr = new Date(r.t_stamp).toISOString();
      if (!solarByTs.has(tsStr)) {
        solarByTs.set(tsStr, {
          t_stamp: r.t_stamp,
          poi1_status: null,
          poi1_volt_ab: null,
          poi1_freq: null,
          poi1_kw: 0,
          poi1_peak_demand: 0,
          poi1_total_kwh: null,
          poi2_status: null,
          poi2_volt_ab: null,
          poi2_freq: null,
          poi2_kw: 0,
          poi2_peak_demand: 0,
          poi2_total_kwh: null,
          total_solar_kw: 0,
          total_solar_kwh: 0
        });
      }
      const item = solarByTs.get(tsStr);
      if (r.poi_id === "POI_1") {
        item.poi1_status = r.status;
        item.poi1_volt_ab = r.volt_ab ? Number(r.volt_ab) : null;
        item.poi1_freq = r.frequency ? Number(r.frequency) : null;
        item.poi1_kw = r.active_power ? Number(r.active_power) : 0;
        item.poi1_peak_demand = r.peak_demand ? Number(r.peak_demand) : 0;
        item.poi1_total_kwh = r.total_kwh ? Number(r.total_kwh) : 0;
      } else if (r.poi_id === "POI_2") {
        item.poi2_status = r.status;
        item.poi2_volt_ab = r.volt_ab ? Number(r.volt_ab) : null;
        item.poi2_freq = r.frequency ? Number(r.frequency) : null;
        item.poi2_kw = r.active_power ? Number(r.active_power) : 0;
        item.poi2_peak_demand = r.peak_demand ? Number(r.peak_demand) : 0;
        item.poi2_total_kwh = r.total_kwh ? Number(r.total_kwh) : 0;
      }
      item.total_solar_kw = Number((item.poi1_kw + item.poi2_kw).toFixed(2));
      item.total_solar_kwh = Number(((item.poi1_total_kwh || 0) + (item.poi2_total_kwh || 0)).toFixed(2));
    });

    solarRows = Array.from(solarByTs.values());
    if (reqSheets.has("solar")) {
      resultSheets.solar = solarRows;
      totalRecordsCount += solarRows.length;
    }
  } catch (err: any) {
    console.error("Error querying Solar PLTS export telemetry:", err.message);
  }

  // 5. Fetch Sub-Distribution Power Meters
  if (reqSheets.has("subdistribution")) {
    try {
      const pmRes = await pool.query(`
        SELECT 
          date_trunc('${truncSql}', t_stamp) as t_stamp,
          group_id,
          pm_id,
          BOOL_OR(status) as status,
          ROUND(AVG(volt_ll)::numeric, 1) as volt_ll,
          ROUND(AVG(current_a)::numeric, 2) as current_a,
          ROUND(AVG(current_b)::numeric, 2) as current_b,
          ROUND(AVG(current_c)::numeric, 2) as current_c,
          ROUND(AVG(frequency)::numeric, 2) as frequency,
          ROUND(AVG(active_power_total)::numeric, 2) as active_power_total,
          ROUND(AVG(reactive_power_total)::numeric, 2) as reactive_power_total,
          ROUND(AVG(power_factor)::numeric, 3) as power_factor,
          MAX(active_energy) as active_energy
        FROM electric_pm_telemetry
        WHERE t_stamp >= $1 AND t_stamp <= $2
        GROUP BY date_trunc('${truncSql}', t_stamp), group_id, pm_id
        ORDER BY t_stamp ASC, group_id ASC, pm_id ASC
      `, [fromStr, toStr]);
      resultSheets.subdistribution = pmRes.rows;
      totalRecordsCount += pmRes.rows.length;
    } catch (err: any) {
      console.error("Error querying Sub-distribution export telemetry:", err.message);
    }
  }

  // 6. Build Sheet 1 ("Dashboard Utama" - Executive Summary & Unified Trends)
  const timestampSet = new Set<string>();
  const plnMap = new Map<string, any>();
  const solarMap = new Map<string, any>();
  const wf1Map = new Map<string, any>();
  const wf2Map = new Map<string, any>();

  const getIsoKey = (ts: any) => new Date(ts).toISOString();

  plnRows.forEach((r) => {
    const k = getIsoKey(r.t_stamp);
    timestampSet.add(k);
    plnMap.set(k, r);
  });
  solarRows.forEach((r) => {
    const k = getIsoKey(r.t_stamp);
    timestampSet.add(k);
    solarMap.set(k, r);
  });
  wf1Rows.forEach((r) => {
    const k = getIsoKey(r.t_stamp);
    timestampSet.add(k);
    wf1Map.set(k, r);
  });
  wf2Rows.forEach((r) => {
    const k = getIsoKey(r.t_stamp);
    timestampSet.add(k);
    wf2Map.set(k, r);
  });

  const sortedTimestamps = Array.from(timestampSet).sort();

  const overviewRows: any[] = [];
  let prevPlnEnergy: number | null = null;
  let prevSolarEnergy: number | null = null;
  let prevWf1Energy: number | null = null;
  let prevWf2Energy: number | null = null;

  let totalPlantKwhSum = 0;
  let totalPlnKwhSum = 0;
  let totalSolarKwhSum = 0;
  let totalWf1KwhSum = 0;
  let totalWf2KwhSum = 0;
  let pfSum = 0;
  let pfCount = 0;
  let maxPeakDemand = 0;

  sortedTimestamps.forEach((tsKey, idx) => {
    const pln = plnMap.get(tsKey) || {};
    const solar = solarMap.get(tsKey) || {};
    const wf1 = wf1Map.get(tsKey) || {};
    const wf2 = wf2Map.get(tsKey) || {};

    const dateObj = new Date(tsKey);
    const wibDate = new Date(dateObj.getTime() + 7 * 60 * 60 * 1000);
    const yyyy = wibDate.getUTCFullYear();
    const mm = pad(wibDate.getUTCMonth() + 1);
    const dd = pad(wibDate.getUTCDate());
    const hh = pad(wibDate.getUTCHours());
    const dateFormatted = `${yyyy}-${mm}-${dd}`;
    const timeFormatted = resolution === "hour" ? `${hh}:00` : dateFormatted;

    const gridKw = Number(pln.active_power) || 0;
    const solarKw = Number(solar.total_solar_kw) || 0;
    const wf1Kw = Number(wf1.active_power_total) || 0;
    const wf2Kw = Number(wf2.active_power_total) || 0;
    const totalLoadKw = Number((gridKw + solarKw).toFixed(2));

    const solarSharePct = totalLoadKw > 0 ? Number(((solarKw / totalLoadKw) * 100).toFixed(1)) : 0;
    const pfVal = pln.power_factor ? Math.abs(Number(pln.power_factor)) : (wf1.power_factor ? Math.abs(Number(wf1.power_factor)) : 0.98);
    const avgVolt = pln.volt_ll ? Number(pln.volt_ll) : (wf1.volt_ll ? Number(wf1.volt_ll) : 380);

    // Energy deltas (kWh)
    let plnKwh = 0;
    const currPlnE = pln.active_energy !== null && pln.active_energy !== undefined ? Number(pln.active_energy) : null;
    if (currPlnE !== null && prevPlnEnergy !== null && currPlnE >= prevPlnEnergy) {
      plnKwh = Number((currPlnE - prevPlnEnergy).toFixed(2));
    } else {
      plnKwh = Number((gridKw * (resolution === "hour" ? 1 : 24)).toFixed(2));
    }
    if (currPlnE !== null) prevPlnEnergy = currPlnE;

    let solarKwh = 0;
    const currSolarE = solar.total_solar_kwh !== null && solar.total_solar_kwh !== undefined ? Number(solar.total_solar_kwh) : null;
    if (currSolarE !== null && prevSolarEnergy !== null && currSolarE >= prevSolarEnergy) {
      solarKwh = Number((currSolarE - prevSolarEnergy).toFixed(2));
    } else {
      solarKwh = Number((solarKw * (resolution === "hour" ? 1 : 24)).toFixed(2));
    }
    if (currSolarE !== null) prevSolarEnergy = currSolarE;

    let wf1Kwh = 0;
    const currWf1E = wf1.active_energy !== null && wf1.active_energy !== undefined ? Number(wf1.active_energy) : null;
    if (currWf1E !== null && prevWf1Energy !== null && currWf1E >= prevWf1Energy) {
      wf1Kwh = Number((currWf1E - prevWf1Energy).toFixed(2));
    } else {
      wf1Kwh = Number((wf1Kw * (resolution === "hour" ? 1 : 24)).toFixed(2));
    }
    if (currWf1E !== null) prevWf1Energy = currWf1E;

    let wf2Kwh = 0;
    const currWf2E = wf2.active_energy !== null && wf2.active_energy !== undefined ? Number(wf2.active_energy) : null;
    if (currWf2E !== null && prevWf2Energy !== null && currWf2E >= prevWf2Energy) {
      wf2Kwh = Number((currWf2E - prevWf2Energy).toFixed(2));
    } else {
      wf2Kwh = Number((wf2Kw * (resolution === "hour" ? 1 : 24)).toFixed(2));
    }
    if (currWf2E !== null) prevWf2Energy = currWf2E;

    const totalKwh = Number((plnKwh + solarKwh).toFixed(2));
    const plnCost = Math.round(plnKwh * 1467);
    const solarSavings = Math.round(solarKwh * 1467);

    // Visual bar representation
    const barBlocks = Math.min(10, Math.max(0, Math.round(solarSharePct / 10)));
    const visualBar = `${"█".repeat(barBlocks)}${"░".repeat(10 - barBlocks)} ${solarSharePct.toFixed(1)}%`;

    totalPlantKwhSum += totalKwh;
    totalPlnKwhSum += plnKwh;
    totalSolarKwhSum += solarKwh;
    totalWf1KwhSum += wf1Kwh;
    totalWf2KwhSum += wf2Kwh;
    if (pfVal > 0) {
      pfSum += pfVal;
      pfCount++;
    }
    if (totalLoadKw > maxPeakDemand) {
      maxPeakDemand = totalLoadKw;
    }

    overviewRows.push({
      no: idx + 1,
      t_stamp: dateFormatted,
      tahun: yyyy,
      bulan: mm,
      hari: dd,
      periode: timeFormatted,
      grid_import_kw: gridKw,
      solar_gen_kw: solarKw,
      total_load_kw: totalLoadKw,
      solar_share_pct: solarSharePct,
      visual_beban: visualBar,
      feeder_wf1_kw: wf1Kw,
      feeder_wf2_kw: wf2Kw,
      power_factor: pfVal,
      tegangan_avg: avgVolt,
      pln_kwh: plnKwh,
      solar_kwh: solarKwh,
      total_kwh: totalKwh,
      pln_cost: plnCost,
      solar_savings: solarSavings
    });
  });

  if (reqSheets.has("overview")) {
    resultSheets.overview = overviewRows;
    totalRecordsCount += overviewRows.length;
  }

  const avgPowerFactor = pfCount > 0 ? Number((pfSum / pfCount).toFixed(3)) : 0.98;
  const solarShareOverall = totalPlantKwhSum > 0 ? Number(((totalSolarKwhSum / totalPlantKwhSum) * 100).toFixed(1)) : 0;
  const totalPlnCost = Math.round(totalPlnKwhSum * 1467);
  const totalSolarSavings = Math.round(totalSolarKwhSum * 1467);

  return {
    metadata: {
      from,
      to,
      resolution,
      exportedAt: new Date().toISOString(),
      company: "PT Widatra Bhakti",
      totalRecords: totalRecordsCount
    },
    summary: {
      totalPlantKwh: Number(totalPlantKwhSum.toFixed(2)),
      totalPlnKwh: Number(totalPlnKwhSum.toFixed(2)),
      totalSolarKwh: Number(totalSolarKwhSum.toFixed(2)),
      totalWf1Kwh: Number(totalWf1KwhSum.toFixed(2)),
      totalWf2Kwh: Number(totalWf2KwhSum.toFixed(2)),
      solarSharePct: solarShareOverall,
      totalPlnCost,
      totalSolarSavings,
      avgPowerFactor,
      maxPeakDemandKw: Number(maxPeakDemand.toFixed(2))
    },
    sheets: resultSheets
  };
}

export async function generateElectricityExcelWorkbook(
  exportData: ElectricityExportResult,
  selectedSheets: Set<string>
): Promise<Buffer> {
  const wb = XLSX.utils.book_new();
  const { metadata, summary, sheets } = exportData;
  const overviewRows = sheets.overview || [];
  const chartSpecs: ChartSpec[] = [];

  const resMap: Record<string, string> = {
    hour: "Per Jam (Hourly)",
    day: "Per Hari (Daily)",
    week: "Per Minggu (Weekly)",
    month: "Per Bulan (Monthly)",
    year: "Per Tahun (Yearly)",
  };
  const resolutionLabel = resMap[metadata.resolution] || metadata.resolution;

  // Format WIB export time
  const expDate = new Date(metadata.exportedAt);
  const expTimeStr = expDate.toLocaleString("id-ID", { timeZone: "Asia/Jakarta" }) + " WIB";

  // 1. SHEET DASHBOARD UTAMA (NO RAW DATA ROWS - ONLY KPI & CHARTS)
  const dashboardAoa: any[][] = [
    ["PT WIDATRA BHAKTI - SCADA UTILITY SYSTEM"],
    ["LAPORAN KELISTRIKAN OVERVIEW (EXECUTIVE DASHBOARD)"],
    [
      `Periode: ${metadata.from} s/d ${metadata.to}`,
      "",
      `Resolusi Data: ${resolutionLabel}`,
      "",
      `Waktu Ekspor: ${expTimeStr}`
    ],
    [],
    ["RINGKASAN EKSEKUTIF KELISTRIKAN (KPI METRICS)"],
    ["Parameter", "Nilai", "Satuan", "Keterangan"],
    ["Total Plant Load", summary.totalPlantKwh, "kWh", "Total konsumsi energi listrik seluruh pabrik"],
    ["Grid Import (PLN)", summary.totalPlnKwh, "kWh", `Pasokan listrik utama dari PLN (${(100 - summary.solarSharePct).toFixed(1)}%)`],
    ["Solar Generation (PLTS)", summary.totalSolarKwh, "kWh", `Kontribusi energi hijau PLTS Rooftop (${summary.solarSharePct.toFixed(1)}%)`],
    ["Porsi Energi Terbarukan (Solar)", summary.solarSharePct, "%", "Rasio penghematan bauran energi hijau"],
    ["Feeder WF1 (PM5560)", summary.totalWf1Kwh, "kWh", "Total beban feeder area produksi WF1"],
    ["Feeder WF2 (PM5500)", summary.totalWf2Kwh, "kWh", "Total beban feeder area produksi WF2"],
    ["Power Factor Rata-rata", summary.avgPowerFactor, "Cos φ", "Kualitas faktor daya operasional pabrik"],
    ["Beban Puncak Tertinggi (Peak Demand)", summary.maxPeakDemandKw, "kW", "Beban puncak daya tertinggi tercatat"],
    ["Estimasi Biaya Tagihan PLN", summary.totalPlnCost, "IDR", "Estimasi biaya pemakaian PLN (Rp 1.467/kWh)"],
    ["Estimasi Penghematan Solar PLTS", summary.totalSolarSavings, "IDR", "Estimasi penghematan biaya dari PLTS (Rp 1.467/kWh)"],
    [],
    ["GRAFIK TREN KELISTRIKAN (EXECUTIVE DASHBOARD CHARTS)"],
    ["Petunjuk: Seluruh rekaman angka detail tersedia dan dapat difilter pada sheet 'Data Tren & Beban' dan sheet teknis lainnya."],
  ];

  const wsDashboard = XLSX.utils.aoa_to_sheet(dashboardAoa);
  wsDashboard["!cols"] = [{ wch: 38 }, { wch: 22 }, { wch: 12 }, { wch: 55 }];
  XLSX.utils.book_append_sheet(wb, wsDashboard, "Dashboard Utama");

  // 2. SHEET DATA TREN & BEBAN (DEDICATED TIME-SERIES NUMBERS SHEET WITH AUTOFILTER)
  const trendHeaders = [
    "No",
    "Tanggal",
    "Tahun",
    "Bulan",
    "Hari",
    "Jam / Periode",
    "Grid Import PLN (kW)",
    "Solar PLTS (kW)",
    "Total Plant Load (kW)",
    "Porsi Solar (%)",
    "Feeder WF1 (kW)",
    "Feeder WF2 (kW)",
    "Power Factor",
    "Tegangan Avg (V)",
    "Energi PLN (kWh)",
    "Energi Solar (kWh)",
    "Total Energi (kWh)",
    "Biaya PLN (Rp)",
    "Penghematan (Rp)"
  ];

  const trendRows = overviewRows.map((r, i) => [
    i + 1,
    r.t_stamp,
    r.tahun,
    r.bulan,
    r.hari,
    r.periode,
    r.grid_import_kw,
    r.solar_gen_kw,
    r.total_load_kw,
    r.solar_share_pct,
    r.feeder_wf1_kw,
    r.feeder_wf2_kw,
    r.power_factor,
    r.tegangan_avg,
    r.pln_kwh,
    r.solar_kwh,
    r.total_kwh,
    r.pln_cost,
    r.solar_savings
  ]);

  const wsTrend = XLSX.utils.aoa_to_sheet([trendHeaders, ...trendRows]);
  wsTrend["!autofilter"] = { ref: `A1:S${Math.max(2, trendRows.length + 1)}` };
  wsTrend["!cols"] = [
    { wch: 6 },
    { wch: 13 },
    { wch: 8 },
    { wch: 8 },
    { wch: 10 },
    { wch: 14 },
    { wch: 20 },
    { wch: 18 },
    { wch: 20 },
    { wch: 14 },
    { wch: 18 },
    { wch: 18 },
    { wch: 14 },
    { wch: 16 },
    { wch: 18 },
    { wch: 18 },
    { wch: 18 },
    { wch: 18 },
    { wch: 18 }
  ];
  XLSX.utils.book_append_sheet(wb, wsTrend, "Data Tren & Beban");

  const numTrendRows = trendRows.length;

  if (numTrendRows > 0) {
    // Chart 1 on Dashboard Utama: Total Load vs Grid vs Solar
    chartSpecs.push({
      sheet: "Dashboard Utama",
      type: "line",
      title: "Tren Daya Utama: Total Plant Load vs Grid PLN vs Solar PLTS",
      categories: `'Data Tren & Beban'!$B$2:$B$${numTrendRows + 1}`,
      series: [
        { name: "Total Plant Load (kW)", ref: `'Data Tren & Beban'!$I$2:$I$${numTrendRows + 1}`, color: "10B981" },
        { name: "Grid Import PLN (kW)", ref: `'Data Tren & Beban'!$G$2:$G$${numTrendRows + 1}`, color: "3B82F6" },
        { name: "Solar PLTS (kW)", ref: `'Data Tren & Beban'!$H$2:$H$${numTrendRows + 1}`, color: "F59E0B" }
      ],
      anchor: { col: 0, row: 20 },
      width: 950,
      height: 400,
      yTitle: "Daya (kW)",
      xTitle: "Waktu"
    });

    // Chart 2 on Dashboard Utama: Feeder WF1 vs WF2
    chartSpecs.push({
      sheet: "Dashboard Utama",
      type: "line",
      title: "Tren Beban Feeder Pabrik: Feeder WF1 (PM5560) vs Feeder WF2 (PM5500)",
      categories: `'Data Tren & Beban'!$B$2:$B$${numTrendRows + 1}`,
      series: [
        { name: "Feeder WF1 (kW)", ref: `'Data Tren & Beban'!$K$2:$K$${numTrendRows + 1}`, color: "8B5CF6" },
        { name: "Feeder WF2 (kW)", ref: `'Data Tren & Beban'!$L$2:$L$${numTrendRows + 1}`, color: "EC4899" }
      ],
      anchor: { col: 0, row: 42 },
      width: 950,
      height: 380,
      yTitle: "Beban Feeder (kW)",
      xTitle: "Waktu"
    });

    // Chart 3 on Dashboard Utama: Power Factor (Cos phi)
    chartSpecs.push({
      sheet: "Dashboard Utama",
      type: "line",
      title: "Tren Kualitas Daya: Power Factor Operasional (Cos φ)",
      categories: `'Data Tren & Beban'!$B$2:$B$${numTrendRows + 1}`,
      series: [
        { name: "Power Factor", ref: `'Data Tren & Beban'!$M$2:$M$${numTrendRows + 1}`, color: "059669" }
      ],
      anchor: { col: 0, row: 63 },
      width: 950,
      height: 340,
      yTitle: "Cos φ",
      xTitle: "Waktu"
    });

    // Chart 4 on Dashboard Utama: Biaya PLN vs Penghematan Solar
    chartSpecs.push({
      sheet: "Dashboard Utama",
      type: "line",
      title: "Tren Finansial Energi: Estimasi Biaya PLN vs Penghematan Solar PLTS (IDR)",
      categories: `'Data Tren & Beban'!$B$2:$B$${numTrendRows + 1}`,
      series: [
        { name: "Biaya PLN (IDR)", ref: `'Data Tren & Beban'!$R$2:$R$${numTrendRows + 1}`, color: "EF4444" },
        { name: "Penghematan Solar (IDR)", ref: `'Data Tren & Beban'!$S$2:$S$${numTrendRows + 1}`, color: "10B981" }
      ],
      anchor: { col: 0, row: 82 },
      width: 950,
      height: 380,
      yTitle: "Rupiah (IDR)",
      xTitle: "Waktu"
    });
  }

  // 3. SHEET PLN - PM8000
  if (selectedSheets.has("pln") && sheets.pln) {
    const plnHeaders = [
      "No", "Tanggal", "Waktu", "Status",
      "Tegangan LL (V)", "Volt AB (V)", "Volt BC (V)", "Volt CA (V)",
      "Arus Ia (A)", "Arus Ib (A)", "Arus Ic (A)", "Arus Avg (A)",
      "Frekuensi (Hz)", "Daya Aktif P (kW)", "Daya Reaktif Q (kVAR)", "Daya Semu S (kVA)",
      "Power Factor", "Voltage Unbalance (%)", "Current Unbalance (%)",
      "THD Volt A (%)", "THD Volt B (%)", "THD Volt C (%)",
      "THD Arus A (%)", "THD Arus B (%)", "THD Arus C (%)",
      "Energi Aktif (kWh)"
    ];
    const plnRows = sheets.pln.map((r, i) => {
      const dt = r.t_stamp ? new Date(r.t_stamp) : null;
      const tgl = dt ? dt.toISOString().split("T")[0] : "-";
      const wkt = dt ? dt.toTimeString().split(" ")[0] : "-";
      return [
        i + 1, tgl, wkt, r.status || "Normal",
        r.voltage_ll, r.voltage_ab, r.voltage_bc, r.voltage_ca,
        r.current_a, r.current_b, r.current_c, r.current_avg,
        r.frequency, r.active_power, r.reactive_power, r.apparent_power,
        r.power_factor, r.voltage_unbalance, r.current_unbalance,
        r.thd_v_a, r.thd_v_b, r.thd_v_c,
        r.thd_i_a, r.thd_i_b, r.thd_i_c,
        r.active_energy
      ];
    });
    const wsPln = XLSX.utils.aoa_to_sheet([plnHeaders, ...plnRows]);
    wsPln["!autofilter"] = { ref: `A1:Z${Math.max(2, plnRows.length + 1)}` };
    wsPln["!cols"] = plnHeaders.map(() => ({ wch: 18 }));
    XLSX.utils.book_append_sheet(wb, wsPln, "PLN - PM8000");

    if (plnRows.length > 0) {
      chartSpecs.push({
        sheet: "PLN - PM8000",
        type: "line",
        title: "Tren Parameter Daya Aktif (kW) PLN PM8000",
        categories: `'PLN - PM8000'!$B$2:$B$${plnRows.length + 1}`,
        series: [
          { name: "Daya Aktif P (kW)", ref: `'PLN - PM8000'!$N$2:$N$${plnRows.length + 1}`, color: "3B82F6" }
        ],
        anchor: { col: 0, row: plnRows.length + 3 },
        width: 950,
        height: 400,
        yTitle: "Daya (kW)",
        xTitle: "Waktu"
      });
    }
  }

  // 4. SHEET FEEDER WF1 - PM5560
  if (selectedSheets.has("wf1") && sheets.wf1) {
    const wf1Headers = [
      "No", "Tanggal", "Waktu", "Status",
      "Tegangan LL (V)", "Volt AB (V)", "Volt BC (V)", "Volt CA (V)",
      "Arus Ia (A)", "Arus Ib (A)", "Arus Ic (A)", "Arus Avg (A)",
      "Frekuensi (Hz)", "Daya Aktif P (kW)", "Daya Reaktif Q (kVAR)", "Daya Semu S (kVA)",
      "Power Factor", "Voltage Unbalance (%)", "Current Unbalance (%)",
      "THD Volt A (%)", "THD Volt B (%)", "THD Volt C (%)",
      "THD Arus A (%)", "THD Arus B (%)", "THD Arus C (%)",
      "Energi Aktif (kWh)"
    ];
    const wf1Rows = sheets.wf1.map((r, i) => {
      const dt = r.t_stamp ? new Date(r.t_stamp) : null;
      const tgl = dt ? dt.toISOString().split("T")[0] : "-";
      const wkt = dt ? dt.toTimeString().split(" ")[0] : "-";
      return [
        i + 1, tgl, wkt, r.status || "Normal",
        r.voltage_ll, r.voltage_ab, r.voltage_bc, r.voltage_ca,
        r.current_a, r.current_b, r.current_c, r.current_avg,
        r.frequency, r.active_power, r.reactive_power, r.apparent_power,
        r.power_factor, r.voltage_unbalance, r.current_unbalance,
        r.thd_v_a, r.thd_v_b, r.thd_v_c,
        r.thd_i_a, r.thd_i_b, r.thd_i_c,
        r.active_energy
      ];
    });
    const wsWf1 = XLSX.utils.aoa_to_sheet([wf1Headers, ...wf1Rows]);
    wsWf1["!autofilter"] = { ref: `A1:Z${Math.max(2, wf1Rows.length + 1)}` };
    wsWf1["!cols"] = wf1Headers.map(() => ({ wch: 18 }));
    XLSX.utils.book_append_sheet(wb, wsWf1, "Feeder WF1 - PM5560");

    if (wf1Rows.length > 0) {
      chartSpecs.push({
        sheet: "Feeder WF1 - PM5560",
        type: "line",
        title: "Tren Daya Aktif & Arus Feeder WF1 (PM5560)",
        categories: `'Feeder WF1 - PM5560'!$B$2:$B$${wf1Rows.length + 1}`,
        series: [
          { name: "Daya Aktif P (kW)", ref: `'Feeder WF1 - PM5560'!$N$2:$N$${wf1Rows.length + 1}`, color: "8B5CF6" },
          { name: "Arus Avg (A)", ref: `'Feeder WF1 - PM5560'!$L$2:$L$${wf1Rows.length + 1}`, color: "06B6D4" }
        ],
        anchor: { col: 0, row: wf1Rows.length + 3 },
        width: 950,
        height: 400,
        yTitle: "Nilai",
        xTitle: "Waktu"
      });
    }
  }

  // 5. SHEET FEEDER WF2 - PM5500
  if (selectedSheets.has("wf2") && sheets.wf2) {
    const wf2Headers = [
      "No", "Tanggal", "Waktu", "Status",
      "Tegangan LL (V)", "Volt AB (V)", "Volt BC (V)", "Volt CA (V)",
      "Arus Ia (A)", "Arus Ib (A)", "Arus Ic (A)", "Arus Avg (A)",
      "Frekuensi (Hz)", "Daya Aktif P (kW)", "Daya Reaktif Q (kVAR)", "Daya Semu S (kVA)",
      "Power Factor", "Voltage Unbalance (%)", "Current Unbalance (%)",
      "THD Volt A (%)", "THD Volt B (%)", "THD Volt C (%)",
      "THD Arus A (%)", "THD Arus B (%)", "THD Arus C (%)",
      "Energi Aktif (kWh)"
    ];
    const wf2Rows = sheets.wf2.map((r, i) => {
      const dt = r.t_stamp ? new Date(r.t_stamp) : null;
      const tgl = dt ? dt.toISOString().split("T")[0] : "-";
      const wkt = dt ? dt.toTimeString().split(" ")[0] : "-";
      return [
        i + 1, tgl, wkt, r.status || "Normal",
        r.voltage_ll, r.voltage_ab, r.voltage_bc, r.voltage_ca,
        r.current_a, r.current_b, r.current_c, r.current_avg,
        r.frequency, r.active_power, r.reactive_power, r.apparent_power,
        r.power_factor, r.voltage_unbalance, r.current_unbalance,
        r.thd_v_a, r.thd_v_b, r.thd_v_c,
        r.thd_i_a, r.thd_i_b, r.thd_i_c,
        r.active_energy
      ];
    });
    const wsWf2 = XLSX.utils.aoa_to_sheet([wf2Headers, ...wf2Rows]);
    wsWf2["!autofilter"] = { ref: `A1:Z${Math.max(2, wf2Rows.length + 1)}` };
    wsWf2["!cols"] = wf2Headers.map(() => ({ wch: 18 }));
    XLSX.utils.book_append_sheet(wb, wsWf2, "Feeder WF2 - PM5500");

    if (wf2Rows.length > 0) {
      chartSpecs.push({
        sheet: "Feeder WF2 - PM5500",
        type: "line",
        title: "Tren Daya Aktif & Arus Feeder WF2 (PM5500)",
        categories: `'Feeder WF2 - PM5500'!$B$2:$B$${wf2Rows.length + 1}`,
        series: [
          { name: "Daya Aktif P (kW)", ref: `'Feeder WF2 - PM5500'!$N$2:$N$${wf2Rows.length + 1}`, color: "EC4899" },
          { name: "Arus Avg (A)", ref: `'Feeder WF2 - PM5500'!$L$2:$L$${wf2Rows.length + 1}`, color: "F97316" }
        ],
        anchor: { col: 0, row: wf2Rows.length + 3 },
        width: 950,
        height: 400,
        yTitle: "Nilai",
        xTitle: "Waktu"
      });
    }
  }

  // 6. SHEET SOLAR PLTS - POI 1 & 2
  if (selectedSheets.has("solar") && sheets.solar) {
    const solarHeaders = [
      "No", "Tanggal", "Waktu",
      "Status POI-1", "POI-1 Tegangan (V)", "POI-1 Freq (Hz)", "POI-1 Daya (kW)", "POI-1 Peak Demand (kW)", "POI-1 Total kWh",
      "Status POI-2", "POI-2 Tegangan (V)", "POI-2 Freq (Hz)", "POI-2 Daya (kW)", "POI-2 Peak Demand (kW)", "POI-2 Total kWh",
      "Total Daya Solar (kW)", "Total Energi Solar (kWh)"
    ];
    const solarRows = sheets.solar.map((r, i) => {
      const dt = r.t_stamp ? new Date(r.t_stamp) : null;
      const tgl = dt ? dt.toISOString().split("T")[0] : "-";
      const wkt = dt ? dt.toTimeString().split(" ")[0] : "-";
      const p1Kw = r.poi1_power || 0;
      const p2Kw = r.poi2_power || 0;
      const totKw = Number((p1Kw + p2Kw).toFixed(2));
      const p1Kwh = r.poi1_total_yield || 0;
      const p2Kwh = r.poi2_total_yield || 0;
      const totKwh = Number((p1Kwh + p2Kwh).toFixed(2));
      return [
        i + 1, tgl, wkt,
        r.poi1_status || "Normal", r.poi1_voltage, r.poi1_frequency, p1Kw, r.poi1_peak_demand, p1Kwh,
        r.poi2_status || "Normal", r.poi2_voltage, r.poi2_frequency, p2Kw, r.poi2_peak_demand, p2Kwh,
        totKw, totKwh
      ];
    });
    const wsSolar = XLSX.utils.aoa_to_sheet([solarHeaders, ...solarRows]);
    wsSolar["!autofilter"] = { ref: `A1:Q${Math.max(2, solarRows.length + 1)}` };
    wsSolar["!cols"] = solarHeaders.map(() => ({ wch: 18 }));
    XLSX.utils.book_append_sheet(wb, wsSolar, "Solar PLTS - POI 1 & 2");

    if (solarRows.length > 0) {
      chartSpecs.push({
        sheet: "Solar PLTS - POI 1 & 2",
        type: "line",
        title: "Tren Daya Generasi Solar PLTS (POI-1 vs POI-2 vs Total)",
        categories: `'Solar PLTS - POI 1 & 2'!$B$2:$B$${solarRows.length + 1}`,
        series: [
          { name: "POI-1 Daya (kW)", ref: `'Solar PLTS - POI 1 & 2'!$G$2:$G$${solarRows.length + 1}`, color: "F59E0B" },
          { name: "POI-2 Daya (kW)", ref: `'Solar PLTS - POI 1 & 2'!$M$2:$M$${solarRows.length + 1}`, color: "EAB308" },
          { name: "Total Daya Solar (kW)", ref: `'Solar PLTS - POI 1 & 2'!$P$2:$P$${solarRows.length + 1}`, color: "10B981" }
        ],
        anchor: { col: 0, row: solarRows.length + 3 },
        width: 950,
        height: 400,
        yTitle: "Daya Solar (kW)",
        xTitle: "Waktu"
      });
    }
  }

  // 7. SHEET SUB-DISTRIBUSI - EW
  if (selectedSheets.has("subdistribution") && sheets.subdistribution) {
    const pmHeaders = [
      "No", "Tanggal", "Waktu", "Group Panel", "Meter ID", "Status",
      "Tegangan LL (V)", "Arus Ia (A)", "Arus Ib (A)", "Arus Ic (A)",
      "Frekuensi (Hz)", "Daya Aktif P (kW)", "Daya Reaktif Q (kVAR)", "Power Factor",
      "Energi Aktif (kWh)"
    ];
    const pmRows = sheets.subdistribution.map((r, i) => {
      const dt = r.t_stamp ? new Date(r.t_stamp) : null;
      const tgl = dt ? dt.toISOString().split("T")[0] : "-";
      const wkt = dt ? dt.toTimeString().split(" ")[0] : "-";
      return [
        i + 1, tgl, wkt, r.group_panel, r.meter_id, r.status || "Normal",
        r.voltage_ll, r.current_a, r.current_b, r.current_c,
        r.frequency, r.active_power, r.reactive_power, r.power_factor,
        r.active_energy
      ];
    });
    const wsPm = XLSX.utils.aoa_to_sheet([pmHeaders, ...pmRows]);
    wsPm["!autofilter"] = { ref: `A1:O${Math.max(2, pmRows.length + 1)}` };
    wsPm["!cols"] = pmHeaders.map(() => ({ wch: 18 }));
    XLSX.utils.book_append_sheet(wb, wsPm, "Sub-Distribusi - EW");
  }

  // Write base workbook buffer
  let buffer = XLSX.write(wb, { type: "buffer", bookType: "xlsx" }) as Buffer;

  // Add native charts if any specs exist
  if (chartSpecs.length > 0) {
    try {
      buffer = await addCharts(buffer, chartSpecs);
    } catch (chartErr) {
      console.error("Warning: Failed to inject native charts into Excel, falling back to base workbook:", chartErr);
    }
  }

  return buffer;
}

