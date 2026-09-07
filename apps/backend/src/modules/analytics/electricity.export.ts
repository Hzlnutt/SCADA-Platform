import { getPostgresPool } from "../../database/postgres";

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
