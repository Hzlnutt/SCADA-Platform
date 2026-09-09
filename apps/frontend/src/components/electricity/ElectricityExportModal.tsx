import React, { useState, useEffect, useMemo, useCallback } from "react";
import { createPortal } from "react-dom";

interface Props {
  isOpen: boolean;
  onClose: () => void;
  isDark: boolean;
}

type ResolutionType = "hour" | "day" | "week" | "month" | "year";

interface SummaryItem {
  itemName: string;
  lwbp: number;
  wbp: number;
  avgPowerFactor: number;
  estCost: number;
  estPenghematan: number;
  estNetCost: number;
}

interface ExportRow {
  tgl_waktu: string;
  nama_item: string;
  lwbp: number;
  wbp: number;
  power_factor: number;
  est_cost: number;
  est_penghematan: number;
  est_net_cost: number;
}

interface PreviewData {
  metadata: any;
  summary: {
    items: SummaryItem[];
    totalPlantKwh: number;
    totalPlnKwh: number;
    totalSolarKwh: number;
    totalCost: number;
    totalPenghematan: number;
    totalNetCost: number;
    avgPowerFactor: number;
  };
  rows: ExportRow[];
  totalRows: number;
}

const pad = (n: number) => String(n).padStart(2, "0");
const formatDateStr = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

const formatCurrency = (value: number) =>
  new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(value);

const formatNumber = (value: number | undefined | null) =>
  (value ?? 0).toLocaleString("id-ID", { maximumFractionDigits: 2 });

export function ElectricityExportModal({ isOpen, onClose, isDark }: Props) {
  const todayStr = useMemo(() => formatDateStr(new Date()), []);
  const [startDate, setStartDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 7);
    return formatDateStr(d);
  });
  const [endDate, setEndDate] = useState(todayStr);
  const [resolution, setResolution] = useState<ResolutionType>("hour");

  const [exporting, setExporting] = useState(false);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewData, setPreviewData] = useState<PreviewData | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [activePreviewTab, setActivePreviewTab] = useState<"summary" | "detail">("summary");

  // Close modal on Escape key press
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  // Fetch Preview Data whenever filters change
  const fetchPreview = useCallback(async () => {
    if (!startDate || !endDate) return;
    setPreviewLoading(true);
    try {
      const query = new URLSearchParams({
        from: startDate,
        to: endDate,
        resolution
      });
      const res = await fetch(`/api/v1/analytics/electricity/export-preview?${query.toString()}`);
      if (res.ok) {
        const json = await res.json();
        if (json.data) {
          setPreviewData(json.data);
        }
      }
    } catch (err) {
      console.warn("Failed to load export preview", err);
    } finally {
      setPreviewLoading(false);
    }
  }, [startDate, endDate, resolution]);

  useEffect(() => {
    if (isOpen) {
      fetchPreview();
    }
  }, [isOpen, fetchPreview]);

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

  // Perform Excel export
  const handleExport = async () => {
    if (!startDate || !endDate) {
      setErrorMessage("Silakan tentukan tanggal mulai dan tanggal selesai.");
      return;
    }
    if (new Date(startDate) > new Date(endDate)) {
      setErrorMessage("Tanggal mulai tidak boleh melebihi tanggal selesai.");
      return;
    }

    setExporting(true);
    setErrorMessage(null);

    try {
      const query = new URLSearchParams({
        from: startDate,
        to: endDate,
        resolution,
        sheets: "all"
      });

      const response = await fetch(`/api/v1/analytics/electricity/export-excel?${query.toString()}`);
      if (!response.ok) {
        throw new Error(`Server merespons dengan status ${response.status}: Gagal mengunduh file Excel.`);
      }

      const blob = await response.blob();
      const fileName = `Laporan_Kelistrikan_Widatra_${resolution}_${startDate}_ke_${endDate}.xlsx`;

      const downloadUrl = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = downloadUrl;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(downloadUrl);

      setExporting(false);
      onClose();
    } catch (err: any) {
      console.error("Export error:", err);
      setErrorMessage(err.message || "Gagal membuat file Excel. Silakan coba kembali.");
      setExporting(false);
    }
  };

  if (!isOpen || typeof document === "undefined") return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[99999] w-screen h-screen flex items-center justify-center bg-black/70 dark:bg-black/80 backdrop-blur-md p-3 sm:p-4 overflow-y-auto animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="w-full max-w-5xl flex flex-col rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden my-auto animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-600 dark:text-emerald-400 shadow-sm">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <div>
              <h3 className="text-base sm:text-lg font-bold text-slate-800 dark:text-white">
                Export Laporan Kelistrikan (.xlsx)
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Dashboard eksekutif dengan Bar Chart & tabel data terstandarisasi (8 kolom)
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 space-y-5 max-h-[75vh] overflow-y-auto">
          {errorMessage && (
            <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-xs sm:text-sm text-red-600 dark:text-red-400 flex items-center gap-2 animate-in fade-in">
              <svg className="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Preset Buttons */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-2">
              Preset Rentang Waktu Cepat
            </label>
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
                  className="px-3 py-1.5 text-xs font-medium rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 transition-colors shadow-xs"
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>

          {/* Custom Date Inputs & Resolution */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1.5">
                Tanggal Mulai (Kalender)
              </label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full px-3 py-2 text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-white focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all outline-hidden"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1.5">
                Tanggal Selesai (Kalender)
              </label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full px-3 py-2 text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-white focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all outline-hidden"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1.5">
                Resolusi Data
              </label>
              <select
                value={resolution}
                onChange={(e) => setResolution(e.target.value as ResolutionType)}
                className="w-full px-3 py-2 text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-white focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all outline-hidden"
              >
                <option value="hour">Per Jam (Hourly)</option>
                <option value="day">Per Hari (Daily)</option>
                <option value="week">Per Minggu (Weekly)</option>
                <option value="month">Per Bulan (Monthly)</option>
                <option value="year">Per Tahun (Yearly)</option>
              </select>
            </div>
          </div>

          {/* Preview Section */}
          <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 overflow-hidden">
            {/* Preview Navigation Tabs */}
            <div className="flex items-center justify-between px-4 py-2.5 border-b border-slate-200 dark:border-slate-800 bg-slate-100/70 dark:bg-slate-800/50">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                  Preview Laporan Excel
                </span>
                {previewLoading && (
                  <span className="inline-flex items-center gap-1 text-[10px] text-emerald-600 font-semibold animate-pulse">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                    Memuat preview...
                  </span>
                )}
              </div>
              <div className="flex items-center gap-1 bg-white dark:bg-slate-900 p-0.5 rounded-lg border border-slate-200 dark:border-slate-700 text-xs">
                <button
                  type="button"
                  onClick={() => setActivePreviewTab("summary")}
                  className={`px-3 py-1 rounded-md font-bold transition-all ${
                    activePreviewTab === "summary"
                      ? "bg-emerald-600 text-white shadow-xs"
                      : "text-slate-600 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200"
                  }`}
                >
                  Dashboard Utama (Ringkasan)
                </button>
                <button
                  type="button"
                  onClick={() => setActivePreviewTab("detail")}
                  className={`px-3 py-1 rounded-md font-bold transition-all ${
                    activePreviewTab === "detail"
                      ? "bg-emerald-600 text-white shadow-xs"
                      : "text-slate-600 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200"
                  }`}
                >
                  Data Kelistrikan ({previewData?.totalRows ?? 0} Baris)
                </button>
              </div>
            </div>

            {/* Preview Content */}
            <div className="p-3">
              {activePreviewTab === "summary" ? (
                /* Tab 1: Dashboard Utama Table */
                <div className="overflow-x-auto">
                  <table className="w-full text-xs text-left">
                    <thead className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 bg-slate-100/80 dark:bg-slate-800/80 border-b border-slate-200 dark:border-slate-700">
                      <tr>
                        <th className="py-2.5 px-3">Nama Item</th>
                        <th className="py-2.5 px-3 text-right">LWBP (kWh)</th>
                        <th className="py-2.5 px-3 text-right">WBP (kWh)</th>
                        <th className="py-2.5 px-3 text-right">Total (kWh)</th>
                        <th className="py-2.5 px-3 text-right">Power Factor</th>
                        <th className="py-2.5 px-3 text-right">Est Cost</th>
                        <th className="py-2.5 px-3 text-right">Est Penghematan</th>
                        <th className="py-2.5 px-3 text-right">Est Net Cost</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                      {previewData?.summary?.items && previewData.summary.items.length > 0 ? (
                        previewData.summary.items.map((item, idx) => {
                          const totKwh = item.lwbp + item.wbp;
                          return (
                            <tr key={idx} className="hover:bg-slate-100/40 dark:hover:bg-slate-800/40 transition">
                              <td className="py-2 px-3 font-semibold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                                <span className={`h-2 w-2 rounded-full ${
                                  item.itemName.startsWith("POI") ? "bg-emerald-500" :
                                  item.itemName === "Incoming PLN" ? "bg-blue-500" : "bg-cyan-500"
                                }`} />
                                {item.itemName}
                              </td>
                              <td className="py-2 px-3 text-right font-mono text-slate-600 dark:text-slate-300">
                                {formatNumber(item.lwbp)}
                              </td>
                              <td className="py-2 px-3 text-right font-mono text-slate-600 dark:text-slate-300">
                                {formatNumber(item.wbp)}
                              </td>
                              <td className="py-2 px-3 text-right font-mono font-bold text-slate-800 dark:text-slate-100">
                                {formatNumber(totKwh)}
                              </td>
                              <td className="py-2 px-3 text-right font-mono text-purple-600 dark:text-purple-400 font-semibold">
                                {item.avgPowerFactor.toFixed(3)}
                              </td>
                              <td className="py-2 px-3 text-right font-mono text-slate-700 dark:text-slate-200">
                                {formatCurrency(item.estCost)}
                              </td>
                              <td className="py-2 px-3 text-right font-mono text-emerald-600 dark:text-emerald-400 font-semibold">
                                {item.estPenghematan > 0 ? formatCurrency(item.estPenghematan) : "Rp 0"}
                              </td>
                              <td className="py-2 px-3 text-right font-mono text-blue-600 dark:text-cyan-400 font-bold">
                                {formatCurrency(item.estNetCost)}
                              </td>
                            </tr>
                          );
                        })
                      ) : (
                        <tr>
                          <td colSpan={8} className="py-8 text-center text-slate-400 dark:text-slate-500">
                            {previewLoading ? "Sedang menghitung ringkasan data..." : "Tidak ada data pada rentang waktu yang dipilih."}
                          </td>
                        </tr>
                      )}
                    </tbody>
                    {previewData?.summary?.items && previewData.summary.items.length > 0 && (
                      <tfoot className="bg-slate-100 dark:bg-slate-800 font-bold border-t-2 border-slate-300 dark:border-slate-700">
                        <tr>
                          <td className="py-2.5 px-3 text-slate-800 dark:text-white">TOTAL KESELURUHAN</td>
                          <td className="py-2.5 px-3 text-right font-mono text-slate-800 dark:text-slate-100">
                            {formatNumber(previewData.summary.items.reduce((a, b) => a + b.lwbp, 0))}
                          </td>
                          <td className="py-2.5 px-3 text-right font-mono text-slate-800 dark:text-slate-100">
                            {formatNumber(previewData.summary.items.reduce((a, b) => a + b.wbp, 0))}
                          </td>
                          <td className="py-2.5 px-3 text-right font-mono text-slate-900 dark:text-white font-extrabold">
                            {formatNumber(previewData.summary.items.reduce((a, b) => a + b.lwbp + b.wbp, 0))}
                          </td>
                          <td className="py-2.5 px-3 text-right font-mono text-purple-600 dark:text-purple-400">
                            {previewData.summary.avgPowerFactor.toFixed(3)}
                          </td>
                          <td className="py-2.5 px-3 text-right font-mono text-slate-900 dark:text-white">
                            {formatCurrency(previewData.summary.totalCost)}
                          </td>
                          <td className="py-2.5 px-3 text-right font-mono text-emerald-600 dark:text-emerald-400">
                            {formatCurrency(previewData.summary.totalPenghematan)}
                          </td>
                          <td className="py-2.5 px-3 text-right font-mono text-blue-600 dark:text-cyan-400 font-extrabold">
                            {formatCurrency(previewData.summary.totalNetCost)}
                          </td>
                        </tr>
                      </tfoot>
                    )}
                  </table>
                </div>
              ) : (
                /* Tab 2: Data Kelistrikan Table */
                <div className="overflow-x-auto max-h-64 overflow-y-auto">
                  <table className="w-full text-xs text-left">
                    <thead className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 bg-slate-100/90 dark:bg-slate-800/90 sticky top-0 z-10 border-b border-slate-200 dark:border-slate-700">
                      <tr>
                        <th className="py-2 px-3">Tgl/Waktu</th>
                        <th className="py-2 px-3">Nama Item</th>
                        <th className="py-2 px-3 text-right">LWBP (kWh)</th>
                        <th className="py-2 px-3 text-right">WBP (kWh)</th>
                        <th className="py-2 px-3 text-right">Power Factor</th>
                        <th className="py-2 px-3 text-right">Est Cost</th>
                        <th className="py-2 px-3 text-right">Est Penghematan</th>
                        <th className="py-2 px-3 text-right">Est Net Cost</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-mono">
                      {previewData?.rows && previewData.rows.length > 0 ? (
                        previewData.rows.map((r, idx) => (
                          <tr key={idx} className="hover:bg-slate-100/40 dark:hover:bg-slate-800/40 transition">
                            <td className="py-1.5 px-3 text-slate-600 dark:text-slate-400 whitespace-nowrap">
                              {r.tgl_waktu}
                            </td>
                            <td className="py-1.5 px-3 font-sans font-semibold text-slate-800 dark:text-slate-200">
                              {r.nama_item}
                            </td>
                            <td className="py-1.5 px-3 text-right text-slate-600 dark:text-slate-300">
                              {formatNumber(r.lwbp)}
                            </td>
                            <td className="py-1.5 px-3 text-right text-slate-600 dark:text-slate-300">
                              {formatNumber(r.wbp)}
                            </td>
                            <td className="py-1.5 px-3 text-right text-purple-600 dark:text-purple-400">
                              {r.power_factor.toFixed(2)}
                            </td>
                            <td className="py-1.5 px-3 text-right text-slate-700 dark:text-slate-200">
                              {formatCurrency(r.est_cost)}
                            </td>
                            <td className="py-1.5 px-3 text-right text-emerald-600 dark:text-emerald-400">
                              {r.est_penghematan > 0 ? formatCurrency(r.est_penghematan) : "Rp 0"}
                            </td>
                            <td className="py-1.5 px-3 text-right text-blue-600 dark:text-cyan-400 font-bold">
                              {formatCurrency(r.est_net_cost)}
                            </td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan={8} className="py-8 text-center text-slate-400 dark:text-slate-500 font-sans">
                            {previewLoading ? "Memuat baris data time-series..." : "Tidak ada baris data pada periode ini."}
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30">
          <div className="text-xs text-slate-500 dark:text-slate-400">
            {previewData?.totalRows ? (
              <span>Total data siap diexport: <strong className="text-slate-800 dark:text-slate-200">{previewData.totalRows} baris</strong> (2 sheets: Dashboard Utama & Data Kelistrikan)</span>
            ) : (
              <span>Pilih tanggal untuk melihat preview data</span>
            )}
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={onClose}
              disabled={exporting}
              className="px-4 py-2 text-sm font-medium rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 transition-colors disabled:opacity-50"
            >
              Batal
            </button>
            <button
              onClick={handleExport}
              disabled={exporting}
              className="flex items-center gap-2 px-5 py-2 text-sm font-semibold rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white shadow-md shadow-emerald-600/20 transition-all disabled:opacity-50 active:scale-98"
            >
              {exporting ? (
                <>
                  <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"></path>
                  </svg>
                  <span>Mengunduh File Excel...</span>
                </>
              ) : (
                <>
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                  </svg>
                  <span>Download Excel (.xlsx)</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}
