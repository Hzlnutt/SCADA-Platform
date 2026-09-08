import { getPostgresPool } from "../../database/postgres";
import { getMongoDb } from "../../database/mongo";
import { GLOBAL_CONFIG_COLLECTION } from "../../database/collections";
import * as XLSX from "xlsx";
import { addCharts, ChartSpec } from "chartsheet";

export interface ElectricityExportParams {
  from: string; // YYYY-MM-DD
  to: string;   // YYYY-MM-DD
  resolution: "hour" | "day" | "week" | "month" | "year";
  sheets?: string; // comma-separated or "all"
}

export interface ElectricityExportItemSummary {
  no: number;
  name: string;
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
  nama_item: string;
  lwbp: number;
  wbp: number;
  power_factor: number;
  est_cost: number;
  est_penghematan: number;
  est_net_cost: number;
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
      SELECT t_stamp, active_power, power_factor, active_energy
      FROM electric_pln_telemetry
      WHERE t_stamp >= $1::timestamp - INTERVAL '1 hour' AND t_stamp <= $2
      ORDER BY t_stamp ASC
    `, [fromStr, toStr]),
    pool.query(`
      SELECT t_stamp, active_power_total as active_power, power_factor, active_energy
      FROM electric_wf1_telemetry
      WHERE t_stamp >= $1::timestamp - INTERVAL '1 hour' AND t_stamp <= $2
      ORDER BY t_stamp ASC
    `, [fromStr, toStr]),
    pool.query(`
      SELECT t_stamp, active_power_total as active_power, power_factor, active_energy
      FROM electric_wf2_telemetry
      WHERE t_stamp >= $1::timestamp - INTERVAL '1 hour' AND t_stamp <= $2
      ORDER BY t_stamp ASC
    `, [fromStr, toStr]),
    pool.query(`
      SELECT t_stamp, poi_id, active_power, power_factor, total_kwh as active_energy
      FROM electric_plts_telemetry
      WHERE t_stamp >= $1::timestamp - INTERVAL '1 hour' AND t_stamp <= $2
      ORDER BY t_stamp ASC, poi_id ASC
    `, [fromStr, toStr])
  ]);

  // Check if minute buffer has newer data for today
  const now = new Date();
  if (new Date(toStr) >= now) {
    try {
      const [plnMin, wf1Min, wf2Min, pltsMin] = await Promise.all([
        pool.query(`
          SELECT t_stamp, active_power, power_factor, active_energy
          FROM electric_pln_telemetry_minute
          WHERE t_stamp > (SELECT COALESCE(MAX(t_stamp), '1970-01-01') FROM electric_pln_telemetry WHERE t_stamp <= $1)
            AND t_stamp <= $1
          ORDER BY t_stamp DESC LIMIT 1
        `, [toStr]),
        pool.query(`
          SELECT t_stamp, active_power_total as active_power, power_factor, active_energy
          FROM electric_wf1_telemetry_minute
          WHERE t_stamp > (SELECT COALESCE(MAX(t_stamp), '1970-01-01') FROM electric_wf1_telemetry WHERE t_stamp <= $1)
            AND t_stamp <= $1
          ORDER BY t_stamp DESC LIMIT 1
        `, [toStr]),
        pool.query(`
          SELECT t_stamp, active_power_total as active_power, power_factor, active_energy
          FROM electric_wf2_telemetry_minute
          WHERE t_stamp > (SELECT COALESCE(MAX(t_stamp), '1970-01-01') FROM electric_wf2_telemetry WHERE t_stamp <= $1)
            AND t_stamp <= $1
          ORDER BY t_stamp DESC LIMIT 1
        `, [toStr]),
        pool.query(`
          SELECT t_stamp, poi_id, active_power, power_factor, total_kwh as active_energy
          FROM electric_plts_telemetry_minute
          WHERE t_stamp > (SELECT COALESCE(MAX(t_stamp), '1970-01-01') FROM electric_plts_telemetry WHERE t_stamp <= $1)
            AND t_stamp <= $1
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
    t_stamp: Date;
    lwbp: number;
    wbp: number;
    pf: number;
  }

  const computeHourlyPoints = (
    rows: any[],
    defaultPf: number,
    isSolar: boolean = false
  ): HourlyPoint[] => {
    const sorted = [...rows].sort((a, b) => new Date(a.t_stamp).getTime() - new Date(b.t_stamp).getTime());
    const points: HourlyPoint[] = [];

    for (let i = 1; i < sorted.length; i++) {
      const curr = sorted[i];
      const prev = sorted[i - 1];
      const currTs = new Date(curr.t_stamp);
      const currTsStr = currTs.toISOString();

      const currDateStr = currTsStr.substring(0, 10);
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

      const wibHour = new Date(currTs.getTime() + 7 * 3600 * 1000).getUTCHours();
      const isWbp = wibHour >= 17 && wibHour <= 21;

      let pf = curr.power_factor !== null && curr.power_factor !== undefined ? Number(curr.power_factor) : defaultPf;
      if (isNaN(pf) || pf <= 0) {
        pf = isSolar ? (deltaKwh > 0 ? defaultPf : 1.0) : defaultPf;
      }
      pf = Math.min(1.0, Math.max(0.70, Number(pf.toFixed(3))));

      points.push({
        t_stamp: currTs,
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

  const formatBucketKey = (d: Date, res: ElectricityExportParams["resolution"]): string => {
    const wib = new Date(d.getTime() + 7 * 3600 * 1000);
    const y = wib.getUTCFullYear();
    const m = String(wib.getUTCMonth() + 1).padStart(2, "0");
    const day = String(wib.getUTCDate()).padStart(2, "0");
    const h = String(wib.getUTCHours()).padStart(2, "0");

    if (res === "hour") {
      return `${y}-${m}-${day} ${h}:00:00`;
    }
    if (res === "day") {
      return `${y}-${m}-${day}`;
    }
    if (res === "week") {
      const dayOfWeek = wib.getUTCDay() || 7;
      const mon = new Date(wib);
      mon.setUTCDate(wib.getUTCDate() - dayOfWeek + 1);
      const my = mon.getUTCFullYear();
      const mm = String(mon.getUTCMonth() + 1).padStart(2, "0");
      const md = String(mon.getUTCDate()).padStart(2, "0");
      return `${my}-${mm}-${md} (Minggu)`;
    }
    if (res === "month") {
      return `${y}-${m}`;
    }
    if (res === "year") {
      return `${y}`;
    }
    return `${y}-${m}-${day} ${h}:00:00`;
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
      const key = formatBucketKey(p.t_stamp, resolution);
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
      acc.pfWeightedSum += p.pf * kwh;
      acc.pfTotalKwh += kwh;
      acc.pfList.push(p.pf);
    }
  };

  addPointsToBuckets(plnPoints, "Incoming PLN");
  addPointsToBuckets(wf1Points, "Fact-1");
  addPointsToBuckets(wf2Points, "Fact-2");
  addPointsToBuckets(poi1Points, "POI-1");
  addPointsToBuckets(poi2Points, "POI-2");

  const sortedBucketKeys = Array.from(allBucketsMap.keys()).sort();

  const ITEM_NAMES = [
    "Incoming PLN",
    "Fact-1",
    "Fact-2",
    "POI-1",
    "POI-2"
  ] as const;

  const defaultPfMap: Record<string, number> = {
    "Incoming PLN": 0.95,
    "Fact-1": 0.93,
    "Fact-2": 0.94,
    "POI-1": 0.98,
    "POI-2": 0.99
  };

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

  for (const bKey of sortedBucketKeys) {
    const itemMap = allBucketsMap.get(bKey)!;

    for (const itemName of ITEM_NAMES) {
      const acc = itemMap.get(itemName) || { lwbp: 0, wbp: 0, pfWeightedSum: 0, pfTotalKwh: 0, pfList: [] };
      const lwbp = acc.lwbp;
      const wbp = acc.wbp;
      const totKwh = lwbp + wbp;

      let pf = defaultPfMap[itemName];
      if (acc.pfTotalKwh > 0) {
        pf = acc.pfWeightedSum / acc.pfTotalKwh;
      } else if (acc.pfList.length > 0) {
        pf = acc.pfList.reduce((a, b) => a + b, 0) / acc.pfList.length;
      }
      pf = Math.min(1.0, Math.max(0.70, Number(pf.toFixed(3))));

      let estCost = 0;
      let estPenghematan = 0;
      let estNetCost = 0;

      if (itemName === "POI-1" || itemName === "POI-2") {
        estCost = Math.round(lwbp * lwbpRate + wbp * wbpRate);
        estPenghematan = Math.round(lwbp * (lwbpRate - pvRate) + wbp * (wbpRate - pvRate));
        estNetCost = Math.round(totKwh * pvRate);
      } else {
        estCost = Math.round(lwbp * lwbpRate + wbp * wbpRate);
        estPenghematan = 0;
        estNetCost = estCost;
      }

      const s = summaryMap[itemName];
      s.lwbp += lwbp;
      s.wbp += wbp;
      s.pfWeightedSum += pf * totKwh;
      s.pfTotalKwh += totKwh;
      s.pfList.push(pf);
      s.estCost += estCost;
      s.estPenghematan += estPenghematan;
      s.estNetCost += estNetCost;

      exportRows.push({
        tgl_waktu: bKey,
        nama_item: itemName,
        lwbp: Number(lwbp.toFixed(2)),
        wbp: Number(wbp.toFixed(2)),
        power_factor: pf,
        est_cost: estCost,
        est_penghematan: estPenghematan,
        est_net_cost: estNetCost
      });
    }
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
  const wb = XLSX.utils.book_new();
  const { metadata, summary, rows } = exportData;
  const chartSpecs: ChartSpec[] = [];

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
  // SHEET 1: DASHBOARD UTAMA (EXECUTIVE SUMMARY & BAR CHARTS)
  // ==========================================
  const dashboardAoa: any[][] = [
    ["PT WIDATRA BHAKTI - SCADA UTILITY SYSTEM"],
    ["LAPORAN KELISTRIKAN & EFISIENSI ENERGI (EXECUTIVE DASHBOARD)"],
    [
      `Periode: ${metadata.from} s/d ${metadata.to}`,
      "",
      `Resolusi: ${resolutionLabel}`,
      "",
      `Waktu Ekspor: ${expTimeStr}`
    ],
    [
      `Tarif Acuan: LWBP = Rp ${metadata.lwbpRate.toLocaleString("id-ID")}/kWh`,
      "",
      `WBP = Rp ${metadata.wbpRate.toLocaleString("id-ID")}/kWh`,
      "",
      `Biaya PV = Rp ${metadata.pvRate.toLocaleString("id-ID")}/kWh`
    ],
    [],
    [
      "No",
      "Nama Item",
      "LWBP (kWh)",
      "WBP (kWh)",
      "Total Konsumsi (kWh)",
      "Power Factor Rata-rata",
      "Est Cost (Rp)",
      "Est Penghematan (Rp)",
      "Est Net Cost (Rp)"
    ]
  ];

  // Add summary items (Rows 7 to 11 in Excel, 1-based indexing)
  summary.items.forEach((item) => {
    dashboardAoa.push([
      item.no,
      item.name,
      item.lwbp,
      item.wbp,
      item.totalKwh,
      item.avgPowerFactor,
      item.estCost,
      item.estPenghematan,
      item.estNetCost
    ]);
  });

  // Add Summary Total row (Row 12)
  const sumLwbp = Number(summary.items.reduce((a, b) => a + b.lwbp, 0).toFixed(2));
  const sumWbp = Number(summary.items.reduce((a, b) => a + b.wbp, 0).toFixed(2));
  const sumKwh = Number(summary.items.reduce((a, b) => a + b.totalKwh, 0).toFixed(2));
  const sumEstCost = summary.items.reduce((a, b) => a + b.estCost, 0);
  const sumEstPenghematan = summary.items.reduce((a, b) => a + b.estPenghematan, 0);
  const sumEstNetCost = summary.items.reduce((a, b) => a + b.estNetCost, 0);

  dashboardAoa.push([
    "Total",
    "Total Sistem & Solar",
    sumLwbp,
    sumWbp,
    sumKwh,
    summary.avgPowerFactor,
    sumEstCost,
    sumEstPenghematan,
    sumEstNetCost
  ]);

  dashboardAoa.push([]);
  dashboardAoa.push(["GRAFIK PERBANDINGAN KELISTRIKAN & FINANSIAL ENERGI"]);
  dashboardAoa.push(["Catatan: Seluruh data time-series terperinci dapat dilihat pada sheet 'Data Kelistrikan'."]);

  const wsDashboard = XLSX.utils.aoa_to_sheet(dashboardAoa);
  wsDashboard["!cols"] = [
    { wch: 6 },
    { wch: 18 },
    { wch: 16 },
    { wch: 16 },
    { wch: 22 },
    { wch: 22 },
    { wch: 20 },
    { wch: 22 },
    { wch: 20 }
  ];
  XLSX.utils.book_append_sheet(wb, wsDashboard, "Dashboard Utama");

  // ==========================================
  // SHEET 2: DATA KELISTRIKAN (EXACT 8 COLUMNS REQUESTED)
  // ==========================================
  const dataHeaders = [
    "Tgl/Waktu",
    "Nama Item",
    "LWBP (kWh)",
    "WBP (kWh)",
    "Power Factor",
    "Est Cost (Rp)",
    "Est Penghematan (Rp)",
    "Est Net Cost (Rp)"
  ];

  const dataAoaRows = rows.map((r) => [
    r.tgl_waktu,
    r.nama_item,
    r.lwbp,
    r.wbp,
    r.power_factor,
    r.est_cost,
    r.est_penghematan,
    r.est_net_cost
  ]);

  const wsData = XLSX.utils.aoa_to_sheet([dataHeaders, ...dataAoaRows]);
  wsData["!autofilter"] = { ref: `A1:H${Math.max(2, dataAoaRows.length + 1)}` };
  wsData["!cols"] = [
    { wch: 22 },
    { wch: 18 },
    { wch: 15 },
    { wch: 15 },
    { wch: 14 },
    { wch: 18 },
    { wch: 20 },
    { wch: 18 }
  ];
  XLSX.utils.book_append_sheet(wb, wsData, "Data Kelistrikan");

  // ==========================================
  // NATIVE BAR CHARTS (COLUMN CHARTS) ON DASHBOARD UTAMA
  // ==========================================
  // Item category cells: 'Dashboard Utama'!$B$7:$B$11
  // Series data cells:
  // LWBP: $C$7:$C$11, WBP: $D$7:$D$11
  // Est Cost: $G$7:$G$11, Est Penghematan: $H$7:$H$11, Est Net Cost: $I$7:$I$11

  // Chart 1: Bar Chart of Energy Comparison (LWBP vs WBP)
  chartSpecs.push({
    sheet: "Dashboard Utama",
    type: "column",
    title: "Perbandingan Konsumsi & Generasi Energi (LWBP vs WBP)",
    categories: `'Dashboard Utama'!$B$7:$B$11`,
    series: [
      { name: "LWBP (kWh)", ref: `'Dashboard Utama'!$C$7:$C$11`, color: "3B82F6" },
      { name: "WBP (kWh)", ref: `'Dashboard Utama'!$D$7:$D$11`, color: "F59E0B" }
    ],
    anchor: { col: 0, row: 15 },
    width: 650,
    height: 390,
    yTitle: "Energi (kWh)"
  });

  // Chart 2: Bar Chart of Financial Comparison (Est Cost vs Est Penghematan vs Est Net Cost)
  chartSpecs.push({
    sheet: "Dashboard Utama",
    type: "column",
    title: "Estimasi Finansial Energi per Item (Cost vs Penghematan vs Net Cost)",
    categories: `'Dashboard Utama'!$B$7:$B$11`,
    series: [
      { name: "Est Cost (Rp)", ref: `'Dashboard Utama'!$G$7:$G$11`, color: "EF4444" },
      { name: "Est Penghematan (Rp)", ref: `'Dashboard Utama'!$H$7:$H$11`, color: "10B981" },
      { name: "Est Net Cost (Rp)", ref: `'Dashboard Utama'!$I$7:$I$11`, color: "06B6D4" }
    ],
    anchor: { col: 8, row: 15 },
    width: 760,
    height: 390,
    yTitle: "Rupiah (IDR)"
  });

  let buffer = XLSX.write(wb, { type: "buffer", bookType: "xlsx" }) as Buffer;

  if (chartSpecs.length > 0) {
    try {
      buffer = await addCharts(buffer, chartSpecs);
    } catch (chartErr) {
      console.error("Warning: Failed to inject charts into Excel workbook, fallback to standard workbook:", chartErr);
    }
  }

  return buffer;
}

