import { getPostgresPool } from "../../database/postgres";
import { getMongoDb } from "../../database/mongo";
import { GLOBAL_CONFIG_COLLECTION } from "../../database/collections";
import ExcelJS from "exceljs";

export interface ElectricityExportParams {
  from: string; // YYYY-MM-DD
  to: string;   // YYYY-MM-DD
  resolution: "hour" | "day" | "week" | "month" | "year";
  sheets?: string; // comma-separated or "all"
}

export interface ElectricityExportItemSummary {
  no: number;
  name: string;
  itemName?: string;
  lwbp: number;
  wbp: number;
  totalKwh: number;
  avgPowerFactor: number;
  estCost: number;
  estPenghematan: number;
  estNetCost: number;
}

export interface ElectricityExportDataRow {
  tgl_waktu: string;
  // PLN (Incoming)
  lwbp_pln: number;
  wbp_pln: number;
  total_pln: number;
  pf_pln: number | null;
  est_cost_pln: number;
  // Fact-1
  lwbp_wf1: number;
  wbp_wf1: number;
  total_wf1: number;
  pf_wf1: number | null;
  est_cost_wf1: number;
  // Fact-2
  lwbp_wf2: number;
  wbp_wf2: number;
  total_wf2: number;
  pf_wf2: number | null;
  est_cost_wf2: number;
  // PV Solar
  poi1_kwh: number;
  pf_poi1: number | null;
  poi2_kwh: number;
  pf_poi2: number | null;
  total_pv: number;
  est_cost_pv: number;
  // Financial
  est_saving: number;
  est_net_cost: number;
  // Power Factor (overall average)
  pf: number;
}

export interface ElectricityExportResult {
  metadata: {
    from: string;
    to: string;
    resolution: string;
    exportedAt: string;
    company: string;
    totalRecords: number;
    lwbpRate: number;
    wbpRate: number;
    pvRate: number;
  };
  summary: {
    items: ElectricityExportItemSummary[];
    totalPlantKwh: number;
    totalPlnKwh: number;
    totalSolarKwh: number;
    totalWf1Kwh: number;
    totalWf2Kwh: number;
    totalCost: number;
    totalPenghematan: number;
    totalNetCost: number;
    avgPowerFactor: number;
    solarSharePct?: number;
    totalPlnCost?: number;
    totalSolarSavings?: number;
    maxPeakDemandKw?: number;
  };
  rows: ElectricityExportDataRow[];
  sheets: {
    overview?: any[];
    [key: string]: any[] | undefined;
  };
}

export async function getElectricityExportData(params: ElectricityExportParams): Promise<ElectricityExportResult> {
  const pool = getPostgresPool();
  const db = getMongoDb();
  const { from, to, resolution = "hour" } = params;

  const fromStr = `${from} 00:00:00`;
  const toStr = `${to} 23:59:59`;

  // 1. Load active utility tariffs from MongoDB
  let lwbpRate = 1112;
  let wbpRate = 1600;
  let pvRate = 0;
  if (db) {
    try {
      const configDoc = await db.collection(GLOBAL_CONFIG_COLLECTION).findOne({ key: "utility" });
      if (configDoc) {
        if (configDoc.lwbpRate) lwbpRate = Number(configDoc.lwbpRate);
        if (configDoc.wbpRate) wbpRate = Number(configDoc.wbpRate);
        if (configDoc.pvRate !== undefined) pvRate = Number(configDoc.pvRate) || 0;
      }
    } catch (err: any) {
      console.warn("Notice: Using fallback tariffs for export:", err.message);
    }
  }

  // 2. Query historical telemetry (querying 1 hour before fromStr to accurately calculate energy delta)
  const [plnRes, wf1Res, wf2Res, pltsRes] = await Promise.all([
    pool.query(`
      SELECT to_char(t_stamp, 'YYYY-MM-DD HH24:MI:SS') as t_stamp_str,
             t_stamp, active_power, power_factor, active_energy
      FROM electric_pln_telemetry
      WHERE t_stamp >= $1::timestamp - INTERVAL '1 hour' AND t_stamp <= $2::timestamp
      ORDER BY t_stamp ASC
    `, [fromStr, toStr]),
    pool.query(`
      SELECT to_char(t_stamp, 'YYYY-MM-DD HH24:MI:SS') as t_stamp_str,
             t_stamp, active_power_total as active_power, power_factor, active_energy
      FROM electric_wf1_telemetry
      WHERE t_stamp >= $1::timestamp - INTERVAL '1 hour' AND t_stamp <= $2::timestamp
      ORDER BY t_stamp ASC
    `, [fromStr, toStr]),
    pool.query(`
      SELECT to_char(t_stamp, 'YYYY-MM-DD HH24:MI:SS') as t_stamp_str,
             t_stamp, active_power_total as active_power, power_factor, active_energy
      FROM electric_wf2_telemetry
      WHERE t_stamp >= $1::timestamp - INTERVAL '1 hour' AND t_stamp <= $2::timestamp
      ORDER BY t_stamp ASC
    `, [fromStr, toStr]),
    pool.query(`
      SELECT to_char(t_stamp, 'YYYY-MM-DD HH24:MI:SS') as t_stamp_str,
             t_stamp, poi_id, active_power, power_factor, total_kwh as active_energy
      FROM electric_plts_telemetry
      WHERE t_stamp >= $1::timestamp - INTERVAL '1 hour' AND t_stamp <= $2::timestamp
      ORDER BY t_stamp ASC, poi_id ASC
    `, [fromStr, toStr])
  ]);

  // Check if minute buffer has newer data for today
  const now = new Date();
  if (new Date(toStr) >= now) {
    try {
      const [plnMin, wf1Min, wf2Min, pltsMin] = await Promise.all([
        pool.query(`
          SELECT to_char(t_stamp, 'YYYY-MM-DD HH24:MI:SS') as t_stamp_str,
                 t_stamp, active_power, power_factor, active_energy
          FROM electric_pln_telemetry_minute
          WHERE t_stamp > (SELECT COALESCE(MAX(t_stamp), '1970-01-01') FROM electric_pln_telemetry WHERE t_stamp <= $1::timestamp)
            AND t_stamp <= $1::timestamp
          ORDER BY t_stamp DESC LIMIT 1
        `, [toStr]),
        pool.query(`
          SELECT to_char(t_stamp, 'YYYY-MM-DD HH24:MI:SS') as t_stamp_str,
                 t_stamp, active_power_total as active_power, power_factor, active_energy
          FROM electric_wf1_telemetry_minute
          WHERE t_stamp > (SELECT COALESCE(MAX(t_stamp), '1970-01-01') FROM electric_wf1_telemetry WHERE t_stamp <= $1::timestamp)
            AND t_stamp <= $1::timestamp
          ORDER BY t_stamp DESC LIMIT 1
        `, [toStr]),
        pool.query(`
          SELECT to_char(t_stamp, 'YYYY-MM-DD HH24:MI:SS') as t_stamp_str,
                 t_stamp, active_power_total as active_power, power_factor, active_energy
          FROM electric_wf2_telemetry_minute
          WHERE t_stamp > (SELECT COALESCE(MAX(t_stamp), '1970-01-01') FROM electric_wf2_telemetry WHERE t_stamp <= $1::timestamp)
            AND t_stamp <= $1::timestamp
          ORDER BY t_stamp DESC LIMIT 1
        `, [toStr]),
        pool.query(`
          SELECT to_char(t_stamp, 'YYYY-MM-DD HH24:MI:SS') as t_stamp_str,
                 t_stamp, poi_id, active_power, power_factor, total_kwh as active_energy
          FROM electric_plts_telemetry_minute
          WHERE t_stamp > (SELECT COALESCE(MAX(t_stamp), '1970-01-01') FROM electric_plts_telemetry WHERE t_stamp <= $1::timestamp)
            AND t_stamp <= $1::timestamp
          ORDER BY t_stamp DESC LIMIT 2
        `, [toStr]),
      ]);

      if (plnMin.rows.length > 0) plnRes.rows.push(...plnMin.rows);
      if (wf1Min.rows.length > 0) wf1Res.rows.push(...wf1Min.rows);
      if (wf2Min.rows.length > 0) wf2Res.rows.push(...wf2Min.rows);
      if (pltsMin.rows.length > 0) pltsRes.rows.push(...pltsMin.rows);
    } catch {
      // Ignored
    }
  }

  const poi1Rows = pltsRes.rows.filter((r: any) => r.poi_id === "POI_1");
  const poi2Rows = pltsRes.rows.filter((r: any) => r.poi_id === "POI_2");

  interface HourlyPoint {
    timeStr: string;
    t_stamp: Date;
    lwbp: number;
    wbp: number;
    pf: number | null;
  }

  const computeHourlyPoints = (
    rows: any[],
    defaultPf: number,
    isSolar: boolean = false
  ): HourlyPoint[] => {
    const sorted = [...rows].sort((a, b) => (a.t_stamp_str || "").localeCompare(b.t_stamp_str || ""));
    const points: HourlyPoint[] = [];

    for (let i = 1; i < sorted.length; i++) {
      const curr = sorted[i];
      const prev = sorted[i - 1];
      const timeStr = curr.t_stamp_str || "";
      if (!timeStr) continue;

      const currDateStr = timeStr.substring(0, 10);
      if (currDateStr < from || currDateStr > to) continue;

      const currE = curr.active_energy !== null && curr.active_energy !== undefined ? Number(curr.active_energy) : null;
      const prevE = prev.active_energy !== null && prev.active_energy !== undefined ? Number(prev.active_energy) : null;

      let deltaKwh = 0;
      if (currE !== null && prevE !== null && currE >= prevE) {
        deltaKwh = currE - prevE;
      } else {
        deltaKwh = Number(curr.active_power) || 0;
      }
      deltaKwh = Math.max(0, deltaKwh);

      const hour = parseInt(timeStr.substring(11, 13), 10) || 0;
      const isWbp = hour >= 17 && hour <= 21;

      let pf: number | null = null;
      const rawPfNum = curr.power_factor !== null && curr.power_factor !== undefined ? Math.abs(Number(curr.power_factor)) : null;
      if (rawPfNum !== null && !isNaN(rawPfNum) && rawPfNum > 0) {
        pf = Math.min(1.0, Math.max(0.70, Number(rawPfNum.toFixed(3))));
      } else if (!isSolar) {
        pf = defaultPf;
      } else {
        pf = null;
      }

      points.push({
        timeStr,
        t_stamp: new Date(curr.t_stamp),
        lwbp: isWbp ? 0 : deltaKwh,
        wbp: isWbp ? deltaKwh : 0,
        pf
      });
    }

    return points;
  };

  const plnPoints = computeHourlyPoints(plnRes.rows, 0.95);
  const wf1Points = computeHourlyPoints(wf1Res.rows, 0.93);
  const wf2Points = computeHourlyPoints(wf2Res.rows, 0.94);
  const poi1Points = computeHourlyPoints(poi1Rows, 0.98, true);
  const poi2Points = computeHourlyPoints(poi2Rows, 0.99, true);

  const formatBucketKey = (timeStr: string, res: ElectricityExportParams["resolution"]): string => {
    const dateStr = timeStr.substring(0, 10);
    const hourStr = timeStr.substring(11, 13);
    const y = dateStr.substring(0, 4);
    const m = dateStr.substring(5, 7);

    if (res === "hour") {
      return `${dateStr} ${hourStr}:00:00`;
    }
    if (res === "day") {
      return dateStr;
    }
    if (res === "week") {
      const [yearNum, monthNum, dayNum] = dateStr.split("-").map(Number);
      const dt = new Date(Date.UTC(yearNum, monthNum - 1, dayNum));
      const dayOfWeek = dt.getUTCDay() || 7;
      dt.setUTCDate(dt.getUTCDate() - dayOfWeek + 1);
      const my = dt.getUTCFullYear();
      const mm = String(dt.getUTCMonth() + 1).padStart(2, "0");
      const md = String(dt.getUTCDate()).padStart(2, "0");
      return `${my}-${mm}-${md} (Minggu)`;
    }
    if (res === "month") {
      return `${y}-${m}`;
    }
    if (res === "year") {
      return `${y}`;
    }
    return `${dateStr} ${hourStr}:00:00`;
  };

  interface BucketAcc {
    lwbp: number;
    wbp: number;
    pfWeightedSum: number;
    pfTotalKwh: number;
    pfList: number[];
  }

  const allBucketsMap = new Map<string, Map<string, BucketAcc>>();

  const addPointsToBuckets = (points: HourlyPoint[], itemName: string) => {
    for (const p of points) {
      const key = formatBucketKey(p.timeStr, resolution);
      if (!allBucketsMap.has(key)) {
        allBucketsMap.set(key, new Map());
      }
      const itemMap = allBucketsMap.get(key)!;
      if (!itemMap.has(itemName)) {
        itemMap.set(itemName, { lwbp: 0, wbp: 0, pfWeightedSum: 0, pfTotalKwh: 0, pfList: [] });
      }
      const acc = itemMap.get(itemName)!;
      const kwh = p.lwbp + p.wbp;
      acc.lwbp += p.lwbp;
      acc.wbp += p.wbp;
      if (p.pf !== null && p.pf !== undefined) {
        acc.pfWeightedSum += p.pf * kwh;
        acc.pfTotalKwh += kwh;
        acc.pfList.push(p.pf);
      }
    }
  };

  addPointsToBuckets(plnPoints, "Incoming PLN");
  addPointsToBuckets(wf1Points, "Fact-1");
  addPointsToBuckets(wf2Points, "Fact-2");
  addPointsToBuckets(poi1Points, "POI-1");
  addPointsToBuckets(poi2Points, "POI-2");

  const sortedBucketKeys = Array.from(allBucketsMap.keys()).sort();

  const exportRows: ElectricityExportDataRow[] = [];

  const summaryMap: Record<string, {
    lwbp: number;
    wbp: number;
    pfWeightedSum: number;
    pfTotalKwh: number;
    pfList: number[];
    estCost: number;
    estPenghematan: number;
    estNetCost: number;
  }> = {
    "Incoming PLN": { lwbp: 0, wbp: 0, pfWeightedSum: 0, pfTotalKwh: 0, pfList: [], estCost: 0, estPenghematan: 0, estNetCost: 0 },
    "Fact-1": { lwbp: 0, wbp: 0, pfWeightedSum: 0, pfTotalKwh: 0, pfList: [], estCost: 0, estPenghematan: 0, estNetCost: 0 },
    "Fact-2": { lwbp: 0, wbp: 0, pfWeightedSum: 0, pfTotalKwh: 0, pfList: [], estCost: 0, estPenghematan: 0, estNetCost: 0 },
    "POI-1": { lwbp: 0, wbp: 0, pfWeightedSum: 0, pfTotalKwh: 0, pfList: [], estCost: 0, estPenghematan: 0, estNetCost: 0 },
    "POI-2": { lwbp: 0, wbp: 0, pfWeightedSum: 0, pfTotalKwh: 0, pfList: [], estCost: 0, estPenghematan: 0, estNetCost: 0 }
  };

  const ITEM_NAMES = ["Incoming PLN", "Fact-1", "Fact-2", "POI-1", "POI-2"] as const;

  const defaultPfMap: Record<string, number> = {
    "Incoming PLN": 0.95,
    "Fact-1": 0.93,
    "Fact-2": 0.94,
    "POI-1": 0.98,
    "POI-2": 0.99
  };

  for (const bKey of sortedBucketKeys) {
    const itemMap = allBucketsMap.get(bKey)!;

    const computeItem = (itemName: string, isSolar: boolean) => {
      const acc = itemMap.get(itemName) || { lwbp: 0, wbp: 0, pfWeightedSum: 0, pfTotalKwh: 0, pfList: [] };
      const lwbp = acc.lwbp;
      const wbp = acc.wbp;
      const totKwh = lwbp + wbp;

      let pf: number | null = null;
      if (acc.pfTotalKwh > 0) {
        pf = acc.pfWeightedSum / acc.pfTotalKwh;
      } else if (acc.pfList.length > 0) {
        pf = acc.pfList.reduce((a: number, b: number) => a + b, 0) / acc.pfList.length;
      } else if (!isSolar) {
        pf = defaultPfMap[itemName];
      }
      if (pf !== null) {
        pf = Math.min(1.0, Math.max(0.70, Number(pf.toFixed(3))));
      }

      let estCost = 0;
      let estPenghematan = 0;
      let estNetCost = 0;

      if (isSolar) {
        estCost = Math.round(lwbp * lwbpRate + wbp * wbpRate);
        estPenghematan = Math.round(totKwh * (lwbpRate - pvRate));
        estNetCost = Math.round(totKwh * pvRate);
      } else {
        estCost = Math.round(lwbp * lwbpRate + wbp * wbpRate);
        estNetCost = estCost;
      }

      // Accumulate summary
      const s = summaryMap[itemName];
      s.lwbp += lwbp;
      s.wbp += wbp;
      if (pf !== null) {
        s.pfWeightedSum += pf * totKwh;
        s.pfTotalKwh += totKwh;
        s.pfList.push(pf);
      }
      s.estCost += estCost;
      s.estPenghematan += estPenghematan;
      s.estNetCost += estNetCost;

      return {
        lwbp: Number(lwbp.toFixed(2)),
        wbp: Number(wbp.toFixed(2)),
        totKwh: Number(totKwh.toFixed(2)),
        pf,
        estCost,
        estPenghematan,
        estNetCost
      };
    };

    const pln = computeItem("Incoming PLN", false);
    const wf1 = computeItem("Fact-1", false);
    const wf2 = computeItem("Fact-2", false);
    const poi1 = computeItem("POI-1", true);
    const poi2 = computeItem("POI-2", true);

    const totalPv = Number((poi1.totKwh + poi2.totKwh).toFixed(2));
    const estCostPv = poi1.estCost + poi2.estCost;
    const estSaving = poi1.estPenghematan + poi2.estPenghematan;
    const estNetCostRow = pln.estNetCost + wf1.estNetCost + wf2.estNetCost + poi1.estNetCost + poi2.estNetCost;

    // Weighted average PF across items that have valid power factor
    const allItemsArr = [pln, wf1, wf2, poi1, poi2];
    const validPfItems = allItemsArr.filter((x) => x.pf !== null && x.pf !== undefined);
    const validPfKwhTotal = validPfItems.reduce((s, x) => s + x.totKwh, 0);
    const weightedPfSum = validPfItems.reduce((s, x) => s + (x.pf as number) * x.totKwh, 0);
    const avgPf = validPfKwhTotal > 0
      ? Math.min(1.0, Math.max(0.70, Number((weightedPfSum / validPfKwhTotal).toFixed(3))))
      : validPfItems.length > 0
        ? Number((validPfItems.reduce((s, x) => s + (x.pf as number), 0) / validPfItems.length).toFixed(3))
        : 0.95;

    exportRows.push({
      tgl_waktu: bKey,
      // PLN
      lwbp_pln: pln.lwbp,
      wbp_pln: pln.wbp,
      total_pln: pln.totKwh,
      pf_pln: pln.pf,
      est_cost_pln: pln.estCost,
      // Fact-1
      lwbp_wf1: wf1.lwbp,
      wbp_wf1: wf1.wbp,
      total_wf1: wf1.totKwh,
      pf_wf1: wf1.pf,
      est_cost_wf1: wf1.estCost,
      // Fact-2
      lwbp_wf2: wf2.lwbp,
      wbp_wf2: wf2.wbp,
      total_wf2: wf2.totKwh,
      pf_wf2: wf2.pf,
      est_cost_wf2: wf2.estCost,
      // Solar
      poi1_kwh: poi1.totKwh,
      pf_poi1: poi1.pf,
      poi2_kwh: poi2.totKwh,
      pf_poi2: poi2.pf,
      total_pv: totalPv,
      est_cost_pv: estCostPv,
      // Financial
      est_saving: estSaving,
      est_net_cost: estNetCostRow,
      pf: avgPf
    });
  }

  const summaryItems: ElectricityExportItemSummary[] = ITEM_NAMES.map((itemName, i) => {
    const s = summaryMap[itemName];
    const totalKwh = Number((s.lwbp + s.wbp).toFixed(2));
    let avgPf = defaultPfMap[itemName];
    if (s.pfTotalKwh > 0) {
      avgPf = s.pfWeightedSum / s.pfTotalKwh;
    } else if (s.pfList.length > 0) {
      avgPf = s.pfList.reduce((a, b) => a + b, 0) / s.pfList.length;
    }
    avgPf = Math.min(1.0, Math.max(0.70, Number(avgPf.toFixed(3))));

    return {
      no: i + 1,
      name: itemName,
      itemName: itemName,
      lwbp: Number(s.lwbp.toFixed(2)),
      wbp: Number(s.wbp.toFixed(2)),
      totalKwh,
      avgPowerFactor: avgPf,
      estCost: s.estCost,
      estPenghematan: s.estPenghematan,
      estNetCost: s.estNetCost
    };
  });

  const totalPlnKwh = summaryMap["Incoming PLN"].lwbp + summaryMap["Incoming PLN"].wbp;
  const totalWf1Kwh = summaryMap["Fact-1"].lwbp + summaryMap["Fact-1"].wbp;
  const totalWf2Kwh = summaryMap["Fact-2"].lwbp + summaryMap["Fact-2"].wbp;
  const totalSolarKwh = (summaryMap["POI-1"].lwbp + summaryMap["POI-1"].wbp) + (summaryMap["POI-2"].lwbp + summaryMap["POI-2"].wbp);
  const totalPlantKwh = totalPlnKwh + totalSolarKwh;

  const totalCost = summaryItems.reduce((a, b) => a + b.estCost, 0);
  const totalPenghematan = summaryItems.reduce((a, b) => a + b.estPenghematan, 0);
  const totalNetCost = summaryItems.reduce((a, b) => a + b.estNetCost, 0);
  const avgOverallPf = Number(
    (summaryItems.reduce((a, b) => a + b.avgPowerFactor, 0) / summaryItems.length).toFixed(3)
  );

  return {
    metadata: {
      from,
      to,
      resolution,
      exportedAt: new Date().toISOString(),
      company: "PT Widatra Bhakti",
      totalRecords: exportRows.length,
      lwbpRate,
      wbpRate,
      pvRate
    },
    summary: {
      items: summaryItems,
      totalPlantKwh: Number(totalPlantKwh.toFixed(2)),
      totalPlnKwh: Number(totalPlnKwh.toFixed(2)),
      totalSolarKwh: Number(totalSolarKwh.toFixed(2)),
      totalWf1Kwh: Number(totalWf1Kwh.toFixed(2)),
      totalWf2Kwh: Number(totalWf2Kwh.toFixed(2)),
      totalCost,
      totalPenghematan,
      totalNetCost,
      avgPowerFactor: avgOverallPf
    },
    rows: exportRows,
    sheets: {
      overview: exportRows
    }
  };
}

export async function generateElectricityExcelWorkbook(
  exportData: ElectricityExportResult,
  _selectedSheets?: Set<string>
): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "PT Widatra Bhakti - SCADA Utility System";
  workbook.created = new Date();

  const { metadata, summary, rows } = exportData;

  const resMap: Record<string, string> = {
    hour: "Per Jam (Hourly)",
    day: "Per Hari (Daily)",
    week: "Per Minggu (Weekly)",
    month: "Per Bulan (Monthly)",
    year: "Per Tahun (Yearly)",
  };
  const resolutionLabel = resMap[metadata.resolution] || metadata.resolution;

  const expDate = new Date(metadata.exportedAt);
  const expTimeStr = expDate.toLocaleString("id-ID", { timeZone: "Asia/Jakarta" }) + " WIB";

  // ==========================================
  // SHEET 1: DASHBOARD UTAMA (EXECUTIVE SUMMARY)
  // ==========================================
  const wsDashboard = workbook.addWorksheet("Dashboard Utama", {
    views: [{ showGridLines: true }]
  });

  // Title Block
  wsDashboard.mergeCells("A1:I1");
  wsDashboard.getCell("A1").value = "PT WIDATRA BHAKTI - SCADA UTILITY SYSTEM";
  wsDashboard.getCell("A1").font = { name: "Arial", size: 14, bold: true, color: { argb: "FF1E3A8A" } };
  wsDashboard.getCell("A1").alignment = { vertical: "middle" };

  wsDashboard.mergeCells("A2:I2");
  wsDashboard.getCell("A2").value = "LAPORAN KELISTRIKAN & EFISIENSI ENERGI (EXECUTIVE DASHBOARD)";
  wsDashboard.getCell("A2").font = { name: "Arial", size: 10, bold: true, color: { argb: "FF475569" } };
  wsDashboard.getCell("A2").alignment = { vertical: "middle" };

  // Metadata Block
  wsDashboard.getCell("A4").value = "Periode:";
  wsDashboard.getCell("B4").value = `${metadata.from} s/d ${metadata.to}`;
  wsDashboard.getCell("D4").value = "Resolusi:";
  wsDashboard.getCell("E4").value = resolutionLabel;
  wsDashboard.getCell("G4").value = "Waktu Ekspor:";
  wsDashboard.getCell("H4").value = expTimeStr;

  wsDashboard.getCell("A5").value = "Tarif LWBP:";
  wsDashboard.getCell("B5").value = metadata.lwbpRate;
  wsDashboard.getCell("B5").numFmt = '"Rp "#,##0"/kWh"';
  wsDashboard.getCell("D5").value = "Tarif WBP:";
  wsDashboard.getCell("E5").value = metadata.wbpRate;
  wsDashboard.getCell("E5").numFmt = '"Rp "#,##0"/kWh"';
  wsDashboard.getCell("G5").value = "Tarif PV:";
  wsDashboard.getCell("H5").value = metadata.pvRate;
  wsDashboard.getCell("H5").numFmt = '"Rp "#,##0"/kWh"';

  for (const r of [4, 5]) {
    for (const c of ["A", "D", "G"]) {
      const cell = wsDashboard.getCell(`${c}${r}`);
      cell.font = { bold: true, color: { argb: "FF334155" } };
    }
  }

  // Section Header
  wsDashboard.getCell("A7").value = "RINGKASAN KONSUMSI & FINANSIAL PER ITEM";
  wsDashboard.getCell("A7").font = { name: "Arial", size: 11, bold: true, color: { argb: "FF0F172A" } };

  // Summary Table Headers
  const summaryHeaders = [
    "No", "Nama Item", "LWBP (kWh)", "WBP (kWh)", "Total (kWh)",
    "Power Factor Rata-rata", "Est Cost (Rp)", "Est Penghematan (Rp)", "Est Net Cost (Rp)"
  ];
  const sHeaderRow = wsDashboard.getRow(8);
  sHeaderRow.height = 24;
  summaryHeaders.forEach((h, i) => {
    const cell = sHeaderRow.getCell(i + 1);
    cell.value = h;
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1E293B" } };
    cell.font = { bold: true, color: { argb: "FFFFFFFF" }, size: 10 };
    cell.alignment = { vertical: "middle", horizontal: i >= 2 ? "right" : i === 0 ? "center" : "left" };
    cell.border = {
      top: { style: "thin", color: { argb: "FF0F172A" } },
      bottom: { style: "thin", color: { argb: "FF0F172A" } },
      left: { style: "thin", color: { argb: "FF334155" } },
      right: { style: "thin", color: { argb: "FF334155" } }
    };
  });

  // Summary Rows
  summary.items.forEach((item, idx) => {
    const rowNum = 9 + idx;
    const row = wsDashboard.getRow(rowNum);
    row.height = 20;

    row.getCell(1).value = item.no;
    row.getCell(2).value = item.name;
    row.getCell(3).value = item.lwbp;
    row.getCell(4).value = item.wbp;
    row.getCell(5).value = item.totalKwh;
    row.getCell(6).value = item.avgPowerFactor;
    row.getCell(7).value = item.estCost;
    row.getCell(8).value = item.estPenghematan;
    row.getCell(9).value = item.estNetCost;

    row.getCell(1).alignment = { horizontal: "center", vertical: "middle" };
    row.getCell(2).alignment = { horizontal: "left", vertical: "middle" };
    for (let c = 3; c <= 5; c++) {
      row.getCell(c).numFmt = "#,##0.00";
      row.getCell(c).alignment = { horizontal: "right", vertical: "middle" };
    }
    row.getCell(6).numFmt = "0.000";
    row.getCell(6).alignment = { horizontal: "right", vertical: "middle" };
    for (let c = 7; c <= 9; c++) {
      row.getCell(c).numFmt = '"Rp "#,##0';
      row.getCell(c).alignment = { horizontal: "right", vertical: "middle" };
    }

    const rowBg = idx % 2 === 1 ? "FFF8FAFC" : "FFFFFFFF";
    for (let c = 1; c <= 9; c++) {
      const cell = row.getCell(c);
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: rowBg } };
      cell.border = {
        top: { style: "thin", color: { argb: "FFE2E8F0" } },
        bottom: { style: "thin", color: { argb: "FFE2E8F0" } },
        left: { style: "thin", color: { argb: "FFE2E8F0" } },
        right: { style: "thin", color: { argb: "FFE2E8F0" } }
      };
    }
  });

  // Summary Total Row
  const totalRowNum = 9 + summary.items.length;
  const totRow = wsDashboard.getRow(totalRowNum);
  totRow.height = 22;

  const sumLwbp = Number(summary.items.reduce((a, b) => a + b.lwbp, 0).toFixed(2));
  const sumWbp = Number(summary.items.reduce((a, b) => a + b.wbp, 0).toFixed(2));
  const sumKwh = Number(summary.items.reduce((a, b) => a + b.totalKwh, 0).toFixed(2));
  const sumEstCost = summary.items.reduce((a, b) => a + b.estCost, 0);
  const sumEstPenghematan = summary.items.reduce((a, b) => a + b.estPenghematan, 0);
  const sumEstNetCost = summary.items.reduce((a, b) => a + b.estNetCost, 0);

  totRow.getCell(1).value = "TOTAL";
  totRow.getCell(2).value = "Total Seluruh Feeder & PLTS";
  totRow.getCell(3).value = sumLwbp;
  totRow.getCell(4).value = sumWbp;
  totRow.getCell(5).value = sumKwh;
  totRow.getCell(6).value = summary.avgPowerFactor;
  totRow.getCell(7).value = sumEstCost;
  totRow.getCell(8).value = sumEstPenghematan;
  totRow.getCell(9).value = sumEstNetCost;

  totRow.getCell(1).alignment = { horizontal: "center", vertical: "middle" };
  totRow.getCell(2).alignment = { horizontal: "left", vertical: "middle" };
  for (let c = 3; c <= 5; c++) {
    totRow.getCell(c).numFmt = "#,##0.00";
    totRow.getCell(c).alignment = { horizontal: "right", vertical: "middle" };
  }
  totRow.getCell(6).numFmt = "0.000";
  totRow.getCell(6).alignment = { horizontal: "right", vertical: "middle" };
  for (let c = 7; c <= 9; c++) {
    totRow.getCell(c).numFmt = '"Rp "#,##0';
    totRow.getCell(c).alignment = { horizontal: "right", vertical: "middle" };
  }

  for (let c = 1; c <= 9; c++) {
    const cell = totRow.getCell(c);
    cell.font = { bold: true, size: 10, color: { argb: "FF0F172A" } };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF1F5F9" } };
    cell.border = {
      top: { style: "thin", color: { argb: "FF94A3B8" } },
      bottom: { style: "double", color: { argb: "FF475569" } },
      left: { style: "thin", color: { argb: "FFCBD5E1" } },
      right: { style: "thin", color: { argb: "FFCBD5E1" } }
    };
  }

  // Dashboard Notes
  wsDashboard.getCell(`A${totalRowNum + 2}`).value = "Catatan:";
  wsDashboard.getCell(`A${totalRowNum + 2}`).font = { bold: true, color: { argb: "FF475569" } };
  wsDashboard.getCell(`A${totalRowNum + 3}`).value = "1. Seluruh data time-series terperinci per jam / hari / bulan dapat dilihat pada sheet 'Data Kelistrikan'.";
  wsDashboard.getCell(`A${totalRowNum + 4}`).value = "2. Estimasi Penghematan Solar PV dihitung berdasarkan selisih tarif acuan LWBP PLN terhadap biaya kontrak PV.";

  wsDashboard.columns = [
    { width: 8 },  // No
    { width: 26 }, // Nama Item
    { width: 18 }, // LWBP
    { width: 18 }, // WBP
    { width: 22 }, // Total
    { width: 24 }, // PF
    { width: 22 }, // Cost
    { width: 24 }, // Penghematan
    { width: 22 }  // Net Cost
  ];

  // ==========================================
  // SHEET 2: DATA KELISTRIKAN (24 COLUMNS - GROUPED HEADERS WITH COLOR THEMES)
  // ==========================================
  const wsData = workbook.addWorksheet("Data Kelistrikan", {
    views: [{ showGridLines: true, state: "frozen", ySplit: 2 }]
  });

  // Merge Header Groups (Row 1)
  wsData.mergeCells("A1:A2");
  wsData.getCell("A1").value = "Tgl / Waktu";

  wsData.mergeCells("B1:F1");
  wsData.getCell("B1").value = "PLN (INCOMING)";

  wsData.mergeCells("G1:K1");
  wsData.getCell("G1").value = "FEEDER FACT-1";

  wsData.mergeCells("L1:P1");
  wsData.getCell("L1").value = "FEEDER FACT-2";

  wsData.mergeCells("Q1:V1");
  wsData.getCell("Q1").value = "SOLAR PV GENERATION";

  wsData.mergeCells("W1:X1");
  wsData.getCell("W1").value = "RINGKASAN FINANSIAL";

  const groupConfigs = [
    { cell: "A1", fill: "1E293B" }, // Slate
    { cell: "B1", fill: "1E40AF" }, // Blue
    { cell: "G1", fill: "0E7490" }, // Cyan
    { cell: "L1", fill: "0F766E" }, // Teal
    { cell: "Q1", fill: "047857" }, // Emerald
    { cell: "W1", fill: "6D28D9" }  // Violet
  ];

  for (const gc of groupConfigs) {
    const cell = wsData.getCell(gc.cell);
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF" + gc.fill } };
    cell.font = { bold: true, color: { argb: "FFFFFFFF" }, size: 10 };
    cell.alignment = { vertical: "middle", horizontal: "center" };
    cell.border = {
      top: { style: "medium", color: { argb: "FF0F172A" } },
      bottom: { style: "thin", color: { argb: "FFFFFFFF" } },
      left: { style: "thin", color: { argb: "FFFFFFFF" } },
      right: { style: "thin", color: { argb: "FFFFFFFF" } }
    };
  }

  // Row 2: Sub-headers
  const subHeaders = [
    "", // A (merged with A1)
    "LWBP (kWh)", "WBP (kWh)", "Total (kWh)", "PF PLN", "Cost PLN (Rp)",
    "LWBP (kWh)", "WBP (kWh)", "Total (kWh)", "PF Fact-1", "Cost Fact-1 (Rp)",
    "LWBP (kWh)", "WBP (kWh)", "Total (kWh)", "PF Fact-2", "Cost Fact-2 (Rp)",
    "POI-1 (kWh)", "PF POI-1", "POI-2 (kWh)", "PF POI-2", "Total PV (kWh)", "Cost PV (Rp)",
    "Penghematan (Rp)", "Net Cost (Rp)"
  ];

  const row2 = wsData.getRow(2);
  row2.height = 24;
  for (let c = 2; c <= 24; c++) {
    const cell = row2.getCell(c);
    cell.value = subHeaders[c - 1];

    let fill = "3B82F6"; // Blue
    if (c >= 7 && c <= 11) fill = "0891B2"; // Cyan
    else if (c >= 12 && c <= 16) fill = "0D9488"; // Teal
    else if (c >= 17 && c <= 22) fill = "059669"; // Emerald
    else if (c >= 23 && c <= 24) fill = "7C3AED"; // Violet

    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF" + fill } };
    cell.font = { bold: true, color: { argb: "FFFFFFFF" }, size: 9 };
    cell.alignment = { vertical: "middle", horizontal: "center", wrapText: true };
    cell.border = {
      top: { style: "thin", color: { argb: "FFFFFFFF" } },
      bottom: { style: "medium", color: { argb: "FF0F172A" } },
      left: { style: "thin", color: { argb: "FFFFFFFF" } },
      right: { style: "thin", color: { argb: "FFFFFFFF" } }
    };
  }

  // Populate data rows
  rows.forEach((r, idx) => {
    const rowNum = 3 + idx;
    const row = wsData.getRow(rowNum);
    row.height = 19;

    const values = [
      r.tgl_waktu,
      // PLN
      r.lwbp_pln,
      r.wbp_pln,
      r.total_pln,
      r.pf_pln,
      r.est_cost_pln,
      // Fact-1
      r.lwbp_wf1,
      r.wbp_wf1,
      r.total_wf1,
      r.pf_wf1,
      r.est_cost_wf1,
      // Fact-2
      r.lwbp_wf2,
      r.wbp_wf2,
      r.total_wf2,
      r.pf_wf2,
      r.est_cost_wf2,
      // Solar
      r.poi1_kwh,
      r.pf_poi1,
      r.poi2_kwh,
      r.pf_poi2,
      r.total_pv,
      r.est_cost_pv,
      // Financial
      r.est_saving,
      r.est_net_cost
    ];

    const isEven = idx % 2 === 1;
    const rowBg = isEven ? "FFF8FAFC" : "FFFFFFFF";

    values.forEach((val, colIdx) => {
      const cell = row.getCell(colIdx + 1);
      cell.value = val;
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: rowBg } };
      cell.border = {
        top: { style: "thin", color: { argb: "FFE2E8F0" } },
        bottom: { style: "thin", color: { argb: "FFE2E8F0" } },
        left: { style: "thin", color: { argb: "FFE2E8F0" } },
        right: { style: "thin", color: { argb: "FFE2E8F0" } }
      };

      if (colIdx === 0) {
        cell.alignment = { horizontal: "center", vertical: "middle" };
      } else {
        const colNum = colIdx + 1;
        // PF columns: col 5, 10, 15, 18, 20
        const isPfCol = [5, 10, 15, 18, 20].includes(colNum);
        // Cost columns: col 6, 11, 16, 22, 23, 24
        const isCostCol = [6, 11, 16, 22, 23, 24].includes(colNum);

        if (isPfCol) {
          if (val !== null && val !== undefined && typeof val === "number") {
            cell.numFmt = "0.000";
          } else {
            cell.value = "-";
          }
          cell.alignment = { horizontal: "right", vertical: "middle" };
        } else if (isCostCol) {
          cell.numFmt = '"Rp "#,##0';
          cell.alignment = { horizontal: "right", vertical: "middle" };
        } else {
          // kWh energy columns
          cell.numFmt = "#,##0.00";
          cell.alignment = { horizontal: "right", vertical: "middle" };
        }
      }
    });
  });

  // Set column widths
  const colWidths = [
    21, // Tgl / Waktu
    14, 14, 15, 12, 17, // PLN
    14, 14, 15, 12, 17, // Fact-1
    14, 14, 15, 12, 17, // Fact-2
    14, 12, 14, 12, 15, 17, // Solar
    18, 18 // Finansial
  ];
  colWidths.forEach((w, i) => {
    wsData.getColumn(i + 1).width = w;
  });

  // Enable autofilter across data columns
  if (rows.length > 0) {
    wsData.autoFilter = {
      from: { row: 2, column: 1 },
      to: { row: rows.length + 2, column: 24 }
    };
  }

  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer);
}

