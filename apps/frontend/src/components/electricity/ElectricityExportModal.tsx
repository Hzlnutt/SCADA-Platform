import React, { useState, useEffect, useMemo } from "react";
import { Line } from "react-chartjs-2";
import "../../components/charts/chartjs";
import { getJson } from "../../services/api.client";

interface Props {
  isOpen: boolean;
  onClose: () => void;
  isDark: boolean;
}

type ResolutionType = "hour" | "day" | "week" | "month" | "year";

interface SheetOptions {
  overview: boolean;
  pln: boolean;
  wf1: boolean;
  wf2: boolean;
  solar: boolean;
  subdistribution: boolean;
}

const pad = (n: number) => String(n).padStart(2, "0");
const formatDateStr = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

export function ElectricityExportModal({ isOpen, onClose, isDark }: Props) {
  const todayStr = useMemo(() => formatDateStr(new Date()), []);
  const [startDate, setStartDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 7);
    return formatDateStr(d);
  });
  const [endDate, setEndDate] = useState(todayStr);
  const [resolution, setResolution] = useState<ResolutionType>("hour");

  const [sheets, setSheets] = useState<SheetOptions>({
    overview: true,
    pln: true,
    wf1: true,
    wf2: true,
    solar: true,
    subdistribution: true
  });

  const [previewData, setPreviewData] = useState<any>(null);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [exportSuccess, setExportSuccess] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Set quick date preset
  const applyPreset = (preset: "today" | "yesterday" | "7days" | "30days" | "thisMonth" | "thisYear") => {
    const now = new Date();
    if (preset === "today") {
      setStartDate(formatDateStr(now));
      setEndDate(formatDateStr(now));
      setResolution("hour");
    } else if (preset === "yesterday") {
      const y = new Date();
      y.setDate(y.getDate() - 1);
      setStartDate(formatDateStr(y));
      setEndDate(formatDateStr(y));
      setResolution("hour");
    } else if (preset === "7days") {
      const d = new Date();
      d.setDate(d.getDate() - 7);
      setStartDate(formatDateStr(d));
      setEndDate(formatDateStr(now));
      setResolution("hour");
    } else if (preset === "30days") {
      const d = new Date();
      d.setDate(d.getDate() - 30);
      setStartDate(formatDateStr(d));
      setEndDate(formatDateStr(now));
      setResolution("day");
    } else if (preset === "thisMonth") {
      const d = new Date(now.getFullYear(), now.getMonth(), 1);
      setStartDate(formatDateStr(d));
      setEndDate(formatDateStr(now));
      setResolution("day");
    } else if (preset === "thisYear") {
      const d = new Date(now.getFullYear(), 0, 1);
      setStartDate(formatDateStr(d));
      setEndDate(formatDateStr(now));
      setResolution("month");
    }
  };

  // Fetch preview data on filter change
  useEffect(() => {
    if (!isOpen) return;
    let active = true;
    setLoadingPreview(true);
    setErrorMessage(null);

    getJson<{ success: boolean; data: any }>(
      `/analytics/electricity/export-data?from=${startDate}&to=${endDate}&resolution=${resolution}&sheets=overview`
    )
      .then((res) => {
        if (!active) return;
        if (res && res.success && res.data) {
          setPreviewData(res.data);
        } else {
          setPreviewData(null);
        }
      })
      .catch((err) => {
        if (!active) return;
        console.error("Failed to load export preview data:", err);
        setErrorMessage("Gagal memuat pratinjau data. Pastikan rentang tanggal valid.");
      })
      .finally(() => {
        if (active) setLoadingPreview(false);
      });

    return () => {
      active = false;
    };
  }, [isOpen, startDate, endDate, resolution]);

  // Chart data for preview
  const chartData = useMemo(() => {
    const rows = previewData?.sheets?.overview || [];
    const labels = rows.map((r: any) => r.periode || r.t_stamp);
    const gridData = rows.map((r: any) => r.grid_import_kw || 0);
    const solarData = rows.map((r: any) => r.solar_gen_kw || 0);
    const totalData = rows.map((r: any) => r.total_load_kw || 0);

    return {
      labels,
      datasets: [
        {
          label: "Total Load (kW)",
          data: totalData,
          borderColor: "#3b82f6",
          backgroundColor: "rgba(59, 130, 246, 0.1)",
          borderWidth: 2,
          tension: 0.2,
          pointRadius: labels.length > 50 ? 0 : 2
        },
        {
          label: "Grid Import PLN (kW)",
          data: gridData,
          borderColor: "#f59e0b",
          backgroundColor: "transparent",
          borderWidth: 1.5,
          borderDash: [4, 4],
          tension: 0.2,
          pointRadius: 0
        },
        {
          label: "Solar PLTS (kW)",
          data: solarData,
          borderColor: "#10b981",
          backgroundColor: "rgba(16, 185, 129, 0.15)",
          fill: true,
          borderWidth: 1.5,
          tension: 0.2,
          pointRadius: 0
        }
      ]
    };
  }, [previewData]);

  const chartOptions: any = useMemo(() => {
    return {
      responsive: true,
      maintainAspectRatio: false,
      interaction: {
        mode: "index",
        intersect: false
      },
      plugins: {
        legend: {
          display: true,
          position: "top",
          labels: {
            boxWidth: 12,
            font: { size: 10, weight: "bold" },
            color: isDark ? "#94a3b8" : "#475569"
          }
        },
        tooltip: {
          callbacks: {
            label: (ctx: any) => `${ctx.dataset.label}: ${Number(ctx.raw).toLocaleString("id-ID", { maximumFractionDigits: 1 })} kW`
          }
        }
      },
      scales: {
        x: {
          ticks: {
            maxTicksLimit: 12,
            font: { size: 9 },
            color: isDark ? "#64748b" : "#94a3b8"
          },
          grid: { display: false }
        },
        y: {
          ticks: {
            font: { size: 9 },
            color: isDark ? "#64748b" : "#94a3b8",
            callback: (v: any) => `${v} kW`
          },
          grid: {
            color: isDark ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.05)"
          }
        }
      }
    };
  }, [isDark]);

  // Handle Export to Excel
  const handleExport = async () => {
    try {
      setExporting(true);
      setErrorMessage(null);

      // Selected sheets to comma-separated
      const selectedSheetsList: string[] = [];
      if (sheets.overview) selectedSheetsList.push("overview");
      if (sheets.pln) selectedSheetsList.push("pln");
      if (sheets.wf1) selectedSheetsList.push("wf1");
      if (sheets.wf2) selectedSheetsList.push("wf2");
      if (sheets.solar) selectedSheetsList.push("solar");
      if (sheets.subdistribution) selectedSheetsList.push("subdistribution");

      if (selectedSheetsList.length === 0) {
        setErrorMessage("Pilih minimal satu sheet untuk diekspor.");
        setExporting(false);
        return;
      }

      // Fetch complete dataset
      const res = await getJson<{ success: boolean; data: any }>(
        `/analytics/electricity/export-data?from=${startDate}&to=${endDate}&resolution=${resolution}&sheets=${selectedSheetsList.join(",")}`
      );

      if (!res || !res.success || !res.data) {
        throw new Error("Gagal mengambil data dari server.");
      }

      const exportData = res.data;
      const { utils, writeFile } = await import("xlsx");
      const wb = utils.book_new();

      const formatCurrencyId = (v: number) => `Rp ${Math.round(v).toLocaleString("id-ID")}`;
      const formatNumId = (v: any) => (v !== null && v !== undefined && !isNaN(Number(v)) ? Number(v) : "-");

      const nowWib = new Date(new Date().getTime() + 7 * 60 * 60 * 1000);
      const nowWibStr = `${nowWib.getUTCFullYear()}-${pad(nowWib.getUTCMonth() + 1)}-${pad(nowWib.getUTCDate())} ${pad(nowWib.getUTCHours())}:${pad(nowWib.getUTCMinutes())}`;

      const resLabel = {
        hour: "Per Jam (Hourly)",
        day: "Per Hari (Daily)",
        week: "Per Minggu (Weekly)",
        month: "Per Bulan (Monthly)",
        year: "Per Tahun (Yearly)"
      }[resolution] || resolution;

      // ─────────────────────────────────────────────────────────────
      // SHEET 1: DASHBOARD UTAMA (EXECUTIVE DASHBOARD & TRENDS)
      // ─────────────────────────────────────────────────────────────
      if (sheets.overview && exportData.sheets.overview) {
        const ovRows = exportData.sheets.overview;
        const summary = exportData.summary || {};

        const aoa: any[][] = [];

        // Header Company & Title
        aoa.push(["PT WIDATRA BHAKTI - SCADA UTILITY SYSTEM"]);
        aoa.push(["LAPORAN KELISTRIKAN OVERVIEW (ELECTRICITY EXECUTIVE DASHBOARD)"]);
        aoa.push([
          `Periode: ${startDate} s/d ${endDate}`,
          "",
          `Resolusi Data: ${resLabel}`,
          "",
          `Waktu Ekspor: ${nowWibStr} WIB`
        ]);
        aoa.push([]);

        // KPI Summary Block
        aoa.push(["RINGKASAN EKSEKUTIF KELISTRIKAN (KPI METRICS)", "", "", ""]);
        aoa.push(["Parameter", "Nilai", "Satuan", "Keterangan"]);
        aoa.push(["Total Plant Load", summary.totalPlantKwh || 0, "kWh", "Total konsumsi listrik seluruh pabrik"]);
        aoa.push(["Grid Import (PLN)", summary.totalPlnKwh || 0, "kWh", `Porsi: ${summary.totalPlantKwh > 0 ? ((summary.totalPlnKwh / summary.totalPlantKwh) * 100).toFixed(1) : 0}% beban`]);
        aoa.push(["Solar Generation (PLTS)", summary.totalSolarKwh || 0, "kWh", `Porsi: ${summary.solarSharePct || 0}% beban pabrik`]);
        aoa.push(["Feeder WF1 (PM5560)", summary.totalWf1Kwh || 0, "kWh", "Konsumsi Gedung Produksi WF1"]);
        aoa.push(["Feeder WF2 (PM5500)", summary.totalWf2Kwh || 0, "kWh", "Konsumsi Gedung Produksi WF2"]);
        aoa.push(["Power Factor Rata-rata", summary.avgPowerFactor || 0.98, "Cos φ", "Kualitas faktor daya"]);
        aoa.push(["Beban Puncak Tertinggi (Peak Demand)", summary.maxPeakDemandKw || 0, "kW", "Beban puncak tertinggi pada periode"]);
        aoa.push(["Estimasi Biaya Tagihan PLN", formatCurrencyId(summary.totalPlnCost || 0), "IDR", "Tarif industri Rp 1.467/kWh"]);
        aoa.push(["Estimasi Penghematan Solar PLTS", formatCurrencyId(summary.totalSolarSavings || 0), "IDR", "Efisiensi biaya dari tenaga surya"]);
        aoa.push([]);

        // Guide Box for Chart
        aoa.push([
          "TIPS MEMBUAT GRAFIK EXCEL: Blok kolom Tanggal s/d Total Load pada tabel di bawah, lalu tekan tombol keyboard [Alt + F1] untuk membuat grafik interaktif seketika."
        ]);
        aoa.push([]);

        // Table Header
        const tableHeaderRowIndex = aoa.length; // 0-indexed
        aoa.push([
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
          "Visual Beban Solar",
          "Feeder WF1 (kW)",
          "Feeder WF2 (kW)",
          "Power Factor",
          "Tegangan Avg (V)",
          "PLN (kWh)",
          "Solar (kWh)",
          "Total (kWh)",
          "Estimasi Biaya PLN (Rp)",
          "Estimasi Hemat Solar (Rp)"
        ]);

        const startDataRow = aoa.length + 1; // 1-indexed for formula

        ovRows.forEach((r: any) => {
          aoa.push([
            r.no,
            r.t_stamp,
            r.tahun,
            r.bulan,
            r.hari,
            r.periode,
            r.grid_import_kw,
            r.solar_gen_kw,
            r.total_load_kw,
            r.solar_share_pct,
            r.visual_beban,
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
        });

        const endDataRow = aoa.length; // 1-indexed

        // Add summary formula rows
        if (endDataRow >= startDataRow) {
          aoa.push([
            "",
            "TOTAL",
            "",
            "",
            "",
            "",
            "",
            "",
            "",
            "",
            "",
            "",
            "",
            "",
            "",
            { t: "n", f: `SUM(P${startDataRow}:P${endDataRow})` },
            { t: "n", f: `SUM(Q${startDataRow}:Q${endDataRow})` },
            { t: "n", f: `SUM(R${startDataRow}:R${endDataRow})` },
            { t: "n", f: `SUM(S${startDataRow}:S${endDataRow})` },
            { t: "n", f: `SUM(T${startDataRow}:T${endDataRow})` }
          ]);
          aoa.push([
            "",
            "RATA-RATA",
            "",
            "",
            "",
            "",
            { t: "n", f: `AVERAGE(G${startDataRow}:G${endDataRow})` },
            { t: "n", f: `AVERAGE(H${startDataRow}:H${endDataRow})` },
            { t: "n", f: `AVERAGE(I${startDataRow}:I${endDataRow})` },
            { t: "n", f: `AVERAGE(J${startDataRow}:J${endDataRow})` },
            "",
            { t: "n", f: `AVERAGE(L${startDataRow}:L${endDataRow})` },
            { t: "n", f: `AVERAGE(M${startDataRow}:M${endDataRow})` },
            { t: "n", f: `AVERAGE(N${startDataRow}:N${endDataRow})` },
            { t: "n", f: `AVERAGE(O${startDataRow}:O${endDataRow})` },
            "",
            "",
            "",
            "",
            ""
          ]);
          aoa.push([
            "",
            "MAKSIMUM",
            "",
            "",
            "",
            "",
            { t: "n", f: `MAX(G${startDataRow}:G${endDataRow})` },
            { t: "n", f: `MAX(H${startDataRow}:H${endDataRow})` },
            { t: "n", f: `MAX(I${startDataRow}:I${endDataRow})` },
            { t: "n", f: `MAX(J${startDataRow}:J${endDataRow})` },
            "",
            { t: "n", f: `MAX(L${startDataRow}:L${endDataRow})` },
            { t: "n", f: `MAX(M${startDataRow}:M${endDataRow})` },
            { t: "n", f: `MAX(N${startDataRow}:N${endDataRow})` },
            { t: "n", f: `MAX(O${startDataRow}:O${endDataRow})` },
            "",
            "",
            "",
            "",
            ""
          ]);
        }

        const wsOverview = utils.aoa_to_sheet(aoa);

        // Column widths
        wsOverview["!cols"] = [
          { wch: 6 },  // No
          { wch: 14 }, // Tanggal
          { wch: 8 },  // Tahun
          { wch: 8 },  // Bulan
          { wch: 8 },  // Hari
          { wch: 15 }, // Jam/Periode
          { wch: 20 }, // Grid Import PLN
          { wch: 18 }, // Solar PLTS
          { wch: 22 }, // Total Plant Load
          { wch: 15 }, // Porsi Solar
          { wch: 18 }, // Visual Beban
          { wch: 18 }, // Feeder WF1
          { wch: 18 }, // Feeder WF2
          { wch: 14 }, // Power Factor
          { wch: 16 }, // Tegangan Avg
          { wch: 15 }, // PLN kWh
          { wch: 15 }, // Solar kWh
          { wch: 15 }, // Total kWh
          { wch: 22 }, // Biaya PLN
          { wch: 22 }  // Hemat Solar
        ];

        // Enable AutoFilter on table headers
        if (endDataRow >= startDataRow) {
          wsOverview["!autofilter"] = { ref: `A${tableHeaderRowIndex + 1}:T${endDataRow}` };
        }

        utils.book_append_sheet(wb, wsOverview, "Dashboard Utama");
      }

      // ─────────────────────────────────────────────────────────────
      // HELPER: BUILD TECHNICAL PM / FEEDER SHEET
      // ─────────────────────────────────────────────────────────────
      const buildTechnicalSheet = (sheetName: string, titleName: string, rows: any[]) => {
        const aoa: any[][] = [];
        aoa.push([`PT WIDATRA BHAKTI - SCADA UTILITY SYSTEM`]);
        aoa.push([`RECORD TELEMETRI: ${titleName}`]);
        aoa.push([`Periode: ${startDate} s/d ${endDate} | Resolusi: ${resLabel} | Total Data: ${rows.length} records`]);
        aoa.push([]);

        const headerRowIdx = aoa.length;
        aoa.push([
          "Waktu (WIB)",
          "Status",
          "Tegangan LL (V)",
          "Volt AB (V)",
          "Volt BC (V)",
          "Volt CA (V)",
          "Arus Ia (A)",
          "Arus Ib (A)",
          "Arus Ic (A)",
          "Arus Rata-rata (A)",
          "Frekuensi (Hz)",
          "Daya Aktif P (kW)",
          "Daya Reaktif Q (kVAR)",
          "Daya Semu S (kVA)",
          "Power Factor (PF)",
          "Voltage Unbalance (%)",
          "Current Unbalance (%)",
          "THD Volt A (%)",
          "THD Volt B (%)",
          "THD Volt C (%)",
          "THD Arus A (%)",
          "THD Arus B (%)",
          "THD Arus C (%)",
          "Energi Aktif (kWh)"
        ]);

        rows.forEach((r: any) => {
          const wibD = new Date(new Date(r.t_stamp).getTime() + 7 * 60 * 60 * 1000);
          const timeStr = `${wibD.getUTCFullYear()}-${pad(wibD.getUTCMonth() + 1)}-${pad(wibD.getUTCDate())} ${pad(wibD.getUTCHours())}:${pad(wibD.getUTCMinutes())}`;
          const isConnected = r.status_pm8000 !== undefined ? r.status_pm8000 : r.status_pm5500;

          aoa.push([
            timeStr,
            isConnected ? "NORMAL / AKTIF" : "OFFLINE",
            formatNumId(r.volt_ll),
            formatNumId(r.volt_ab),
            formatNumId(r.volt_bc),
            formatNumId(r.volt_ca),
            formatNumId(r.current_a),
            formatNumId(r.current_b),
            formatNumId(r.current_c),
            formatNumId(r.current_avg),
            formatNumId(r.frequency),
            formatNumId(r.active_power ?? r.active_power_total),
            formatNumId(r.reactive_power_total),
            formatNumId(r.apparent_power_total),
            formatNumId(r.power_factor),
            formatNumId(r.voltage_unbalance),
            formatNumId(r.current_unbalance),
            formatNumId(r.thd_volt_a),
            formatNumId(r.thd_volt_b),
            formatNumId(r.thd_volt_c),
            formatNumId(r.thd_current_a),
            formatNumId(r.thd_current_b),
            formatNumId(r.thd_current_c),
            formatNumId(r.active_energy)
          ]);
        });

        const ws = utils.aoa_to_sheet(aoa);
        ws["!cols"] = [
          { wch: 18 }, // Waktu
          { wch: 16 }, // Status
          { wch: 16 }, // Tegangan LL
          { wch: 14 }, // Volt AB
          { wch: 14 }, // Volt BC
          { wch: 14 }, // Volt CA
          { wch: 12 }, // Ia
          { wch: 12 }, // Ib
          { wch: 12 }, // Ic
          { wch: 18 }, // I avg
          { wch: 14 }, // Freq
          { wch: 18 }, // P kW
          { wch: 22 }, // Q kVAR
          { wch: 18 }, // S kVA
          { wch: 16 }, // PF
          { wch: 22 }, // V Unb
          { wch: 22 }, // I Unb
          { wch: 15 }, // THD Va
          { wch: 15 }, // THD Vb
          { wch: 15 }, // THD Vc
          { wch: 15 }, // THD Ia
          { wch: 15 }, // THD Ib
          { wch: 15 }, // THD Ic
          { wch: 20 }  // Active Energy
        ];

        if (rows.length > 0) {
          ws["!autofilter"] = { ref: `A${headerRowIdx + 1}:X${aoa.length}` };
        }

        utils.book_append_sheet(wb, ws, sheetName);
      };

      // SHEET 2: PLN (PM8000)
      if (sheets.pln && exportData.sheets.pln) {
        buildTechnicalSheet("PLN - PM8000", "MAIN INCOMING PLN (PM8000)", exportData.sheets.pln);
      }

      // SHEET 3: FEEDER WF1 (PM5560)
      if (sheets.wf1 && exportData.sheets.wf1) {
        buildTechnicalSheet("Feeder WF1 - PM5560", "FEEDER GEDUNG WF1 (PM5560)", exportData.sheets.wf1);
      }

      // SHEET 4: FEEDER WF2 (PM5500)
      if (sheets.wf2 && exportData.sheets.wf2) {
        buildTechnicalSheet("Feeder WF2 - PM5500", "FEEDER GEDUNG WF2 (PM5500)", exportData.sheets.wf2);
      }

      // ─────────────────────────────────────────────────────────────
      // SHEET 5: SOLAR PLTS (POI 1 & 2)
      // ─────────────────────────────────────────────────────────────
      if (sheets.solar && exportData.sheets.solar) {
        const sRows = exportData.sheets.solar;
        const aoa: any[][] = [];
        aoa.push([`PT WIDATRA BHAKTI - SCADA UTILITY SYSTEM`]);
        aoa.push([`RECORD TELEMETRI SOLAR PANEL (PLTS POI-1 & POI-2)`]);
        aoa.push([`Periode: ${startDate} s/d ${endDate} | Resolusi: ${resLabel} | Total Data: ${sRows.length} records`]);
        aoa.push([]);

        const headerRowIdx = aoa.length;
        aoa.push([
          "Waktu (WIB)",
          "Status POI-1",
          "POI-1 Tegangan (V)",
          "POI-1 Freq (Hz)",
          "POI-1 Daya (kW)",
          "POI-1 Peak Demand (kW)",
          "POI-1 Total kWh",
          "Status POI-2",
          "POI-2 Tegangan (V)",
          "POI-2 Freq (Hz)",
          "POI-2 Daya (kW)",
          "POI-2 Peak Demand (kW)",
          "POI-2 Total kWh",
          "Total Daya Solar (kW)",
          "Total Energi Solar (kWh)"
        ]);

        sRows.forEach((r: any) => {
          const wibD = new Date(new Date(r.t_stamp).getTime() + 7 * 60 * 60 * 1000);
          const timeStr = `${wibD.getUTCFullYear()}-${pad(wibD.getUTCMonth() + 1)}-${pad(wibD.getUTCDate())} ${pad(wibD.getUTCHours())}:${pad(wibD.getUTCMinutes())}`;

          aoa.push([
            timeStr,
            r.poi1_status !== false ? "AKTIF" : "TIDAK AKTIF",
            formatNumId(r.poi1_volt_ab),
            formatNumId(r.poi1_freq),
            formatNumId(r.poi1_kw),
            formatNumId(r.poi1_peak_demand),
            formatNumId(r.poi1_total_kwh),
            r.poi2_status !== false ? "AKTIF" : "TIDAK AKTIF",
            formatNumId(r.poi2_volt_ab),
            formatNumId(r.poi2_freq),
            formatNumId(r.poi2_kw),
            formatNumId(r.poi2_peak_demand),
            formatNumId(r.poi2_total_kwh),
            formatNumId(r.total_solar_kw),
            formatNumId(r.total_solar_kwh)
          ]);
        });

        const ws = utils.aoa_to_sheet(aoa);
        ws["!cols"] = [
          { wch: 18 }, // Waktu
          { wch: 16 }, // Status POI-1
          { wch: 18 }, // POI-1 Volt
          { wch: 16 }, // POI-1 Freq
          { wch: 18 }, // POI-1 Daya kW
          { wch: 22 }, // POI-1 Peak Demand
          { wch: 20 }, // POI-1 Total kWh
          { wch: 16 }, // Status POI-2
          { wch: 18 }, // POI-2 Volt
          { wch: 16 }, // POI-2 Freq
          { wch: 18 }, // POI-2 Daya kW
          { wch: 22 }, // POI-2 Peak Demand
          { wch: 20 }, // POI-2 Total kWh
          { wch: 22 }, // Total Daya
          { wch: 24 }  // Total Energi
        ];

        if (sRows.length > 0) {
          ws["!autofilter"] = { ref: `A${headerRowIdx + 1}:O${aoa.length}` };
        }

        utils.book_append_sheet(wb, ws, "Solar PLTS - POI 1 & 2");
      }

      // ─────────────────────────────────────────────────────────────
      // SHEET 6: SUB-DISTRIBUSI (EW)
      // ─────────────────────────────────────────────────────────────
      if (sheets.subdistribution && exportData.sheets.subdistribution) {
        const pmRows = exportData.sheets.subdistribution;
        const aoa: any[][] = [];
        aoa.push([`PT WIDATRA BHAKTI - SCADA UTILITY SYSTEM`]);
        aoa.push([`RECORD TELEMETRI SUB-DISTRIBUSI PANEL (EW21, EW22, EW23)`]);
        aoa.push([`Periode: ${startDate} s/d ${endDate} | Resolusi: ${resLabel} | Total Data: ${pmRows.length} records`]);
        aoa.push([]);

        const headerRowIdx = aoa.length;
        aoa.push([
          "Waktu (WIB)",
          "Group Panel",
          "ID Power Meter",
          "Status",
          "Tegangan LL (V)",
          "Arus Ia (A)",
          "Arus Ib (A)",
          "Arus Ic (A)",
          "Frekuensi (Hz)",
          "Daya Aktif P (kW)",
          "Daya Reaktif Q (kVAR)",
          "Power Factor",
          "Energi Aktif (kWh)"
        ]);

        pmRows.forEach((r: any) => {
          const wibD = new Date(new Date(r.t_stamp).getTime() + 7 * 60 * 60 * 1000);
          const timeStr = `${wibD.getUTCFullYear()}-${pad(wibD.getUTCMonth() + 1)}-${pad(wibD.getUTCDate())} ${pad(wibD.getUTCHours())}:${pad(wibD.getUTCMinutes())}`;

          aoa.push([
            timeStr,
            String(r.group_id || "-").toUpperCase(),
            r.pm_id,
            r.status !== false ? "NORMAL" : "OFFLINE",
            formatNumId(r.volt_ll),
            formatNumId(r.current_a),
            formatNumId(r.current_b),
            formatNumId(r.current_c),
            formatNumId(r.frequency),
            formatNumId(r.active_power_total),
            formatNumId(r.reactive_power_total),
            formatNumId(r.power_factor),
            formatNumId(r.active_energy)
          ]);
        });

        const ws = utils.aoa_to_sheet(aoa);
        ws["!cols"] = [
          { wch: 18 }, // Waktu
          { wch: 14 }, // Group
          { wch: 18 }, // PM ID
          { wch: 14 }, // Status
          { wch: 16 }, // Volt LL
          { wch: 12 }, // Ia
          { wch: 12 }, // Ib
          { wch: 12 }, // Ic
          { wch: 14 }, // Freq
          { wch: 18 }, // P kW
          { wch: 22 }, // Q kVAR
          { wch: 14 }, // PF
          { wch: 20 }  // Active Energy
        ];

        if (pmRows.length > 0) {
          ws["!autofilter"] = { ref: `A${headerRowIdx + 1}:M${aoa.length}` };
        }

        utils.book_append_sheet(wb, ws, "Sub-Distribusi - EW");
      }

      // Download file
      const fileName = `Laporan_Kelistrikan_Widatra_${resolution}_${startDate}_ke_${endDate}.xlsx`;
      writeFile(wb, fileName);
      setExportSuccess(true);
      setTimeout(() => setExportSuccess(false), 4000);
    } catch (err: any) {
      console.error("Export error:", err);
      setErrorMessage(err.message || "Gagal membuat file Excel. Silakan coba kembali.");
    } finally {
      setExporting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-md p-3 sm:p-4 animate-in fade-in duration-200">
      <div
        className="w-full max-w-4xl max-h-[92vh] flex flex-col rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-800/40">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-emerald-500/10 dark:bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6zM6 4h7v5h5v11H6V4zm8 8.5 1.5 2.5-1.5 2.5h-1.5l1.5-2.5-1.5-2.5h1.5zm-5 0 1.5 2.5-1.5 2.5H7.5L9 14.5 7.5 12H9z"/>
              </svg>
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-800 dark:text-white flex items-center gap-2">
                Export Data Kelistrikan ke Excel (.xlsx)
                <span className="text-[10px] uppercase font-bold tracking-widest px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                  Multi-Sheet
                </span>
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Ekspor seluruh parameter yang tersimpan di database dengan dashboard visual dan format modern.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-2 text-slate-400 hover:text-slate-600 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Quick Presets */}
          <div>
            <div className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-2">
              Preset Rentang Waktu Cepat
            </div>
            <div className="flex flex-wrap gap-2">
              {[
                { id: "today", label: "Hari Ini" },
                { id: "yesterday", label: "Kemarin" },
                { id: "7days", label: "7 Hari Terakhir" },
                { id: "30days", label: "30 Hari Terakhir" },
                { id: "thisMonth", label: "Bulan Ini" },
                { id: "thisYear", label: "Tahun Ini" }
              ].map((p) => (
                <button
                  key={p.id}
                  onClick={() => applyPreset(p.id as any)}
                  className="text-xs px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 font-medium text-slate-700 dark:text-slate-300 transition"
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>

          {/* Calendar Filter + Resolution */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1.5">
                Tanggal Mulai (Kalender)
              </label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                max={endDate || todayStr}
                className="w-full text-xs font-semibold px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 focus:ring-2 focus:ring-emerald-500 outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1.5">
                Tanggal Selesai (Kalender)
              </label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                min={startDate}
                max={todayStr}
                className="w-full text-xs font-semibold px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 focus:ring-2 focus:ring-emerald-500 outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1.5">
                Resolusi / Agregasi Data
              </label>
              <select
                value={resolution}
                onChange={(e) => setResolution(e.target.value as ResolutionType)}
                className="w-full text-xs font-semibold px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 focus:ring-2 focus:ring-emerald-500 outline-none cursor-pointer"
              >
                <option value="hour">Per Jam (Hourly - minimal resolusi DB)</option>
                <option value="day">Per Hari (Daily)</option>
                <option value="week">Per Minggu (Weekly)</option>
                <option value="month">Per Bulan (Monthly)</option>
                <option value="year">Per Tahun (Yearly)</option>
              </select>
            </div>
          </div>

          {/* Sheets Selection Checkboxes */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                Pilih Sheet yang Akan Diekspor (Masing-masing Beda Parameter)
              </span>
              <button
                type="button"
                onClick={() => {
                  const allChecked = Object.values(sheets).every(Boolean);
                  setSheets({
                    overview: !allChecked,
                    pln: !allChecked,
                    wf1: !allChecked,
                    wf2: !allChecked,
                    solar: !allChecked,
                    subdistribution: !allChecked
                  });
                }}
                className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400 hover:underline"
              >
                {Object.values(sheets).every(Boolean) ? "Hapus Semua" : "Pilih Semua"}
              </button>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {[
                { key: "overview", label: "Dashboard Utama", desc: "Ringkasan KPI, tren beban & sparkline bar" },
                { key: "pln", label: "PLN - PM8000", desc: "Semua parameter cubicle PLN" },
                { key: "wf1", label: "Feeder WF1 - PM5560", desc: "Semua parameter feeder WF1" },
                { key: "wf2", label: "Feeder WF2 - PM5500", desc: "Semua parameter feeder WF2" },
                { key: "solar", label: "Solar PLTS (POI 1 & 2)", desc: "Detail POI-1, POI-2 & Total Solar" },
                { key: "subdistribution", label: "Sub-Distribusi (EW)", desc: "Panel EW21, EW22, EW23" }
              ].map((item) => (
                <label
                  key={item.key}
                  className={`flex items-start gap-2.5 p-3 rounded-xl border transition cursor-pointer ${
                    (sheets as any)[item.key]
                      ? "border-emerald-500/30 bg-emerald-500/5 dark:bg-emerald-950/20"
                      : "border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-800/40 opacity-70"
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={(sheets as any)[item.key]}
                    onChange={(e) => setSheets((prev) => ({ ...prev, [item.key]: e.target.checked }))}
                    className="mt-0.5 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 h-4 w-4 accent-emerald-600 cursor-pointer"
                  />
                  <div>
                    <div className="text-xs font-bold text-slate-800 dark:text-white">{item.label}</div>
                    <div className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5 leading-snug">{item.desc}</div>
                  </div>
                </label>
              ))}
            </div>
          </div>

          {/* Interactive Preview Section */}
          <div className="rounded-xl border border-slate-200 dark:border-slate-800 p-4 bg-slate-50/50 dark:bg-slate-950/30 space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 flex items-center gap-2">
                <span>📊</span> Pratinjau Data Terfilter (Interactive Chart Preview)
              </span>
              {loadingPreview && (
                <span className="text-xs text-slate-400 flex items-center gap-1.5 animate-pulse">
                  <span className="h-2 w-2 rounded-full bg-emerald-500 animate-ping" />
                  Memuat data...
                </span>
              )}
            </div>

            {/* KPI Summary Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="p-3 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-sm">
                <span className="text-[10px] font-bold text-slate-400 uppercase">Total Plant Load</span>
                <div className="text-sm font-extrabold text-slate-800 dark:text-white font-mono mt-1">
                  {(previewData?.summary?.totalPlantKwh || 0).toLocaleString("id-ID", { maximumFractionDigits: 1 })} kWh
                </div>
              </div>
              <div className="p-3 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-sm">
                <span className="text-[10px] font-bold text-slate-400 uppercase">Grid Import (PLN)</span>
                <div className="text-sm font-extrabold text-amber-600 dark:text-amber-400 font-mono mt-1">
                  {(previewData?.summary?.totalPlnKwh || 0).toLocaleString("id-ID", { maximumFractionDigits: 1 })} kWh
                </div>
              </div>
              <div className="p-3 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-sm">
                <span className="text-[10px] font-bold text-slate-400 uppercase">Solar Generation</span>
                <div className="text-sm font-extrabold text-emerald-600 dark:text-emerald-400 font-mono mt-1">
                  {(previewData?.summary?.totalSolarKwh || 0).toLocaleString("id-ID", { maximumFractionDigits: 1 })} kWh
                </div>
              </div>
              <div className="p-3 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-sm">
                <span className="text-[10px] font-bold text-slate-400 uppercase">Porsi Solar PLTS</span>
                <div className="text-sm font-extrabold text-cyan-600 dark:text-cyan-400 font-mono mt-1">
                  {previewData?.summary?.solarSharePct || 0}%
                </div>
              </div>
            </div>

            {/* Chart */}
            <div className="h-48 w-full bg-white dark:bg-slate-900 rounded-xl p-3 border border-slate-200 dark:border-slate-800">
              {chartData.labels.length > 0 ? (
                <Line data={chartData} options={chartOptions} />
              ) : (
                <div className="h-full flex items-center justify-center text-xs text-slate-400">
                  {loadingPreview ? "Mengambil data..." : "Tidak ada data pada rentang waktu ini."}
                </div>
              )}
            </div>
          </div>

          {/* Feedback Alerts */}
          {errorMessage && (
            <div className="p-3 rounded-xl border border-rose-500/30 bg-rose-500/10 text-rose-600 dark:text-rose-400 text-xs font-semibold flex items-center gap-2">
              <span>⚠️</span>
              <span>{errorMessage}</span>
            </div>
          )}
          {exportSuccess && (
            <div className="p-3 rounded-xl border border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-xs font-semibold flex items-center gap-2">
              <span>✓</span>
              <span>File Excel berhasil dibuat dan diunduh ke komputer Anda!</span>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-4 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-800/40">
          <div className="text-xs text-slate-500 dark:text-slate-400">
            Format: <strong className="text-slate-700 dark:text-slate-200">.XLSX</strong> | Tabel terformat dengan AutoFilter Excel & Formula SUM/AVG.
          </div>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onClose}
              disabled={exporting}
              className="px-4 py-2 rounded-xl text-xs font-bold border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
            >
              Tutup
            </button>
            <button
              type="button"
              onClick={handleExport}
              disabled={exporting || loadingPreview}
              className="px-5 py-2 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white shadow-md shadow-emerald-600/20 hover:shadow-emerald-600/30 transition flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {exporting ? (
                <>
                  <span className="h-3.5 w-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Mengekspor Excel...
                </>
              ) : (
                <>
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6zM6 4h7v5h5v11H6V4zm8 8.5 1.5 2.5-1.5 2.5h-1.5l1.5-2.5-1.5-2.5h1.5zm-5 0 1.5 2.5-1.5 2.5H7.5L9 14.5 7.5 12H9z"/>
                  </svg>
                  Download Excel (.xlsx)
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
