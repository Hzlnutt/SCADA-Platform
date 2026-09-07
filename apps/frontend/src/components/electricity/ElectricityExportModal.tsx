import React, { useState, useEffect, useMemo } from "react";
import { createPortal } from "react-dom";

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

  const [exporting, setExporting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Close modal on Escape key press
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

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

  const toggleSheet = (key: keyof SheetOptions) => {
    setSheets((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const toggleAllSheets = () => {
    const allSelected = Object.values(sheets).every(Boolean);
    setSheets({
      overview: !allSelected,
      pln: !allSelected,
      wf1: !allSelected,
      wf2: !allSelected,
      solar: !allSelected,
      subdistribution: !allSelected
    });
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

    const selectedKeys = Object.entries(sheets)
      .filter(([_, v]) => v)
      .map(([k]) => k);

    if (selectedKeys.length === 0) {
      setErrorMessage("Pilih minimal satu sheet untuk diekspor.");
      return;
    }

    setExporting(true);
    setErrorMessage(null);

    try {
      const query = new URLSearchParams({
        from: startDate,
        to: endDate,
        resolution,
        sheets: selectedKeys.join(",")
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
      onClose(); // Automatically return to web view
    } catch (err: any) {
      console.error("Export error:", err);
      setErrorMessage(err.message || "Gagal membuat file Excel. Silakan coba kembali.");
      setExporting(false);
    }
  };

  if (!isOpen || typeof document === "undefined") return null;

  const isAllSheets = Object.values(sheets).every(Boolean);

  return createPortal(
    <div
      className="fixed inset-0 z-[99999] w-screen h-screen flex items-center justify-center bg-black/70 dark:bg-black/80 backdrop-blur-md p-3 sm:p-4 overflow-y-auto animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="w-full max-w-2xl flex flex-col rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden my-auto animate-in zoom-in-95 duration-200"
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
                Dashboard eksekutif dengan grafik native per parameter & data multi-sheet berfilter
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
        <div className="p-6 space-y-6 max-h-[75vh] overflow-y-auto">
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

          {/* Sheet Selection */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                Pilihan Lembar Kerja (Sheets)
              </label>
              <button
                type="button"
                onClick={toggleAllSheets}
                className="text-xs font-medium text-emerald-600 dark:text-emerald-400 hover:underline"
              >
                {isAllSheets ? "Batal Pilih Semua" : "Pilih Semua Sheet"}
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {[
                {
                  key: "overview",
                  label: "Dashboard & Data Tren Beban",
                  desc: "KPI eksekutif, grafik per parameter & data time-series"
                },
                {
                  key: "pln",
                  label: "PLN - PM8000",
                  desc: "Parameter lengkap PLN, tegangan, arus & grafik daya"
                },
                {
                  key: "wf1",
                  label: "Feeder WF1 - PM5560",
                  desc: "Beban feeder produksi WF1 & grafik daya arus"
                },
                {
                  key: "wf2",
                  label: "Feeder WF2 - PM5500",
                  desc: "Beban feeder produksi WF2 & grafik daya arus"
                },
                {
                  key: "solar",
                  label: "Solar PLTS - POI 1 & 2",
                  desc: "Generasi solar POI-1, POI-2 & grafik perbandingan"
                },
                {
                  key: "subdistribution",
                  label: "Sub-Distribusi - EW",
                  desc: "Panel sub-distribusi EW21, EW22, EW23 & Power Meters"
                }
              ].map((s) => (
                <label
                  key={s.key}
                  className={`flex items-start gap-3 p-3 rounded-xl border transition-all cursor-pointer select-none ${
                    sheets[s.key as keyof SheetOptions]
                      ? "bg-emerald-50/50 dark:bg-emerald-950/20 border-emerald-500/30 text-slate-900 dark:text-white shadow-xs"
                      : "bg-white dark:bg-slate-800/60 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:border-slate-300 dark:hover:border-slate-700"
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={sheets[s.key as keyof SheetOptions]}
                    onChange={() => toggleSheet(s.key as keyof SheetOptions)}
                    className="mt-0.5 rounded text-emerald-600 focus:ring-emerald-500 w-4 h-4"
                  />
                  <div>
                    <div className="text-xs sm:text-sm font-semibold">{s.label}</div>
                    <div className="text-[11px] text-slate-500 dark:text-slate-400 leading-tight mt-0.5">{s.desc}</div>
                  </div>
                </label>
              ))}
            </div>
          </div>

          {/* Information Banner */}
          <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/80 dark:border-slate-700/60 text-xs text-slate-600 dark:text-slate-300 space-y-1.5">
            <div className="flex items-center gap-2 font-semibold text-slate-800 dark:text-slate-200">
              <svg className="w-4 h-4 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span>Fitur Laporan Excel SCADA:</span>
            </div>
            <ul className="list-disc list-inside space-y-1 pl-1 text-[11px] text-slate-500 dark:text-slate-400">
              <li>
                <strong className="text-slate-700 dark:text-slate-300">Sheet Dashboard Utama:</strong> Berisi ringkasan eksekutif KPI dan grafik native interaktif untuk masing-masing parameter (Total Load, PLN, Solar, Feeders WF1/WF2, Power Factor, dan Finansial). Tidak ada tabel angka yang menumpuk di bawahnya.
              </li>
              <li>
                <strong className="text-slate-700 dark:text-slate-300">Sheet Data Detail & AutoFilter:</strong> Seluruh baris rekaman angka dipisahkan secara rapi ke sheet masing-masing dan dilengkapi <em>AutoFilter</em> kalender/tanggal di Microsoft Excel.
              </li>
            </ul>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30">
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
    </div>,
    document.body
  );
}
