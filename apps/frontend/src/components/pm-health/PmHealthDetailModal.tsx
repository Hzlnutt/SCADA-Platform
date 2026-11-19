import { useEffect, useMemo, useState } from "react";
import { Line } from "react-chartjs-2";
import type { ChartOptions } from "chart.js";
import "../charts/chartjs";
import { getJson } from "../../services/api.client";
import type { AnnotatedReading, PmSeriesResponse, SourceTable } from "./pmHealth.types";
import {
  anomalyTypeMeta,
  fmtDelta,
  fmtNumber,
  getLocalTodayIso,
  sourceTableShort
} from "./pmHealth.utils";

interface PmHealthDetailModalProps {
  pmId: string | null;
  initialHours: number;
  initialSinceReset?: boolean;
  resetAt?: string | null;
  isDark: boolean;
  onClose: () => void;
}

export function PmHealthDetailModal({
  pmId,
  initialHours,
  initialSinceReset = false,
  resetAt = null,
  isDark,
  onClose
}: PmHealthDetailModalProps) {
  const [rangeMode, setRangeMode] = useState<"since_reset" | "preset" | "custom">(
    initialSinceReset && resetAt ? "since_reset" : "preset"
  );
  const [hours, setHours] = useState<number>(initialHours || 24);
  const [startDate, setStartDate] = useState<string>(getLocalTodayIso());
  const [endDate, setEndDate] = useState<string>(getLocalTodayIso());
  const [activeTable, setActiveTable] = useState<SourceTable>("electric_pm_telemetry_minute");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [payload, setPayload] = useState<PmSeriesResponse | null>(null);

  useEffect(() => {
    setHours(initialHours || 24);
    setRangeMode(initialSinceReset && resetAt ? "since_reset" : "preset");
  }, [initialHours, initialSinceReset, resetAt, pmId]);

  useEffect(() => {
    if (!pmId) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [pmId, onClose]);

  const fetchSeries = async () => {
    if (!pmId) return;
    setLoading(true);
    setError(null);
    try {
      const qs = new URLSearchParams({ source: "both" });
      if (rangeMode === "since_reset" && resetAt) {
        qs.set("sinceReset", "true");
      } else if (rangeMode === "custom") {
        qs.set("startDate", startDate);
        qs.set("endDate", endDate);
      } else {
        qs.set("hours", String(hours));
      }
      const json = await getJson<PmSeriesResponse>(
        `/pm-health/pm/${encodeURIComponent(pmId)}/series?${qs.toString()}`
      );
      setPayload(json);
      if (json.minuteSeries.length === 0 && json.hourlySeries.length > 0) {
        setActiveTable("electric_pm_telemetry");
      } else if (json.minuteSeries.length > 0) {
        setActiveTable("electric_pm_telemetry_minute");
      }
    } catch (err: any) {
      setError(err?.message || "Gagal memuat detail PM");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (pmId) {
      void fetchSeries();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pmId, hours, rangeMode]);

  const activeSeries: AnnotatedReading[] = useMemo(() => {
    if (!payload) return [];
    return activeTable === "electric_pm_telemetry_minute"
      ? payload.minuteSeries
      : payload.hourlySeries;
  }, [payload, activeTable]);

  const chartPoints = useMemo(() => {
    const valid = activeSeries.filter((r) => r.active_energy !== null);
    if (valid.length <= 900) return valid;
    const step = valid.length / 800;
    const keep = new Set<number>();
    for (let i = 0; i < 800; i++) keep.add(Math.min(valid.length - 1, Math.floor(i * step)));
    keep.add(valid.length - 1);
    valid.forEach((r, i) => {
      if (r.anomaly_type) keep.add(i);
    });
    return Array.from(keep)
      .sort((a, b) => a - b)
      .map((i) => valid[i]);
  }, [activeSeries]);

  const chartData = useMemo(() => {
    const labels = chartPoints.map((p) => p.t_stamp.slice(5, 16));
    const values = chartPoints.map((p) => p.active_energy);
    const pointRadii = chartPoints.map((p) => (p.anomaly_type ? 6 : chartPoints.length <= 90 ? 2.5 : 0));
    const pointColors = chartPoints.map((p) =>
      p.anomaly_severity === "critical"
        ? "#e11d48"
        : p.anomaly_severity === "warning"
        ? "#f59e0b"
        : "#0ea5e9"
    );

    return {
      labels,
      datasets: [
        {
          label: "Active Energy (kWh)",
          data: values,
          borderColor: "#0ea5e9",
          backgroundColor: isDark ? "rgba(14, 165, 233, 0.12)" : "rgba(14, 165, 233, 0.08)",
          fill: true,
          tension: 0.12,
          borderWidth: 2,
          pointRadius: pointRadii,
          pointHoverRadius: 6,
          pointBackgroundColor: pointColors,
          pointBorderColor: isDark ? "#0f172a" : "#ffffff",
          pointBorderWidth: 1.5
        }
      ]
    };
  }, [chartPoints, isDark]);

  const chartOptions: ChartOptions<"line"> = useMemo(
    () => ({
      responsive: true,
      maintainAspectRatio: false,
      animation: false,
      transitions: {
        active: { animation: { duration: 0 } }
      },
      interaction: {
        mode: "index",
        axis: "x",
        intersect: false
      },
      plugins: {
        legend: { display: false },
        tooltip: {
          animation: false,
          backgroundColor: isDark ? "rgba(15, 23, 42, 0.96)" : "rgba(255, 255, 255, 0.98)",
          titleColor: isDark ? "#f8fafc" : "#0f172a",
          bodyColor: isDark ? "#e2e8f0" : "#334155",
          borderColor: isDark ? "#334155" : "#cbd5e1",
          borderWidth: 1,
          padding: 12,
          cornerRadius: 10,
          callbacks: {
            title: (items) => {
              const idx = items[0]?.dataIndex ?? 0;
              return `${chartPoints[idx]?.t_stamp ?? ""} WIB`;
            },
            label: (ctx) => {
              const idx = ctx.dataIndex;
              const row = chartPoints[idx];
              const lines = [
                `Active Energy: ${fmtNumber(row?.active_energy, 2)} kWh`,
                `Selisih (Δ): ${fmtDelta(row?.delta_energy)}`
              ];
              if (row?.active_power_total !== null && row?.active_power_total !== undefined) {
                lines.push(`Daya Aktif: ${fmtNumber(row.active_power_total, 2)} kW`);
              }
              if (row?.anomaly_message) {
                lines.push(`⚠ ${row.anomaly_message}`);
              }
              return lines;
            }
          }
        }
      },
      scales: {
        x: {
          grid: { color: isDark ? "rgba(148,163,184,0.08)" : "rgba(148,163,184,0.16)" },
          ticks: {
            color: isDark ? "#94a3b8" : "#64748b",
            maxTicksLimit: 10,
            maxRotation: 0,
            font: { size: 11 }
          }
        },
        y: {
          grid: { color: isDark ? "rgba(148,163,184,0.1)" : "rgba(148,163,184,0.2)" },
          ticks: {
            color: isDark ? "#94a3b8" : "#64748b",
            font: { size: 11 },
            callback: (v) => `${Number(v).toLocaleString("id-ID")} kWh`
          }
        }
      }
    }),
    [chartPoints, isDark]
  );

  if (!pmId) return null;

  const tableAnomalies = (payload?.anomalies || []).filter((a) => a.sourceTable === activeTable);
  const recentRows = [...activeSeries].reverse().slice(0, 120);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-sm p-3 sm:p-6"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-5xl max-h-[90vh] overflow-y-auto scrollbar-thin rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-2xl flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="sticky top-0 z-20 px-4 sm:px-5 py-4 border-b border-slate-200 dark:border-slate-800 bg-white/95 dark:bg-slate-900/95 backdrop-blur flex flex-wrap items-center justify-between gap-3">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="px-2 py-0.5 rounded-md bg-sky-500/15 text-sky-700 dark:text-sky-300 font-mono text-xs font-extrabold">
                {payload?.pm.pmId || pmId}
              </span>
              <h2 className="text-base sm:text-lg font-extrabold text-slate-900 dark:text-white truncate">
                {payload?.pm.name || pmId}
              </h2>
            </div>
            {payload && (
              <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                <span>{payload.pm.factory}</span>
                <span>•</span>
                <span>Area: {payload.pm.area}</span>
                <span>•</span>
                <span className="font-mono">
                  {payload.range.startTimestamp} s/d {payload.range.endTimestamp}
                </span>
              </div>
            )}
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-500 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
            aria-label="Tutup modal"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.4">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Controls */}
        <div className="px-4 sm:px-5 py-3 border-b border-slate-100 dark:border-slate-800/80 bg-slate-50/70 dark:bg-slate-950/40 flex flex-wrap items-center justify-between gap-3">
          <div className="inline-flex rounded-xl bg-slate-200/70 dark:bg-slate-800 p-1 gap-1">
            <button
              type="button"
              onClick={() => setActiveTable("electric_pm_telemetry_minute")}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                activeTable === "electric_pm_telemetry_minute"
                  ? "bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm"
                  : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
              }`}
            >
              Per Menit ({payload?.minuteSeries.length ?? 0})
            </button>
            <button
              type="button"
              onClick={() => setActiveTable("electric_pm_telemetry")}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                activeTable === "electric_pm_telemetry"
                  ? "bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm"
                  : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
              }`}
            >
              Per Jam ({payload?.hourlySeries.length ?? 0})
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {resetAt && (
              <button
                type="button"
                onClick={() => setRangeMode("since_reset")}
                className={`px-2.5 py-1.5 rounded-lg text-xs font-bold border transition cursor-pointer ${
                  rangeMode === "since_reset"
                    ? "bg-emerald-500 text-white border-emerald-500"
                    : "bg-white dark:bg-slate-900 text-emerald-700 dark:text-emerald-300 border-emerald-500/40 hover:border-emerald-500"
                }`}
              >
                Sejak Reset ({resetAt.slice(11, 16)})
              </button>
            )}
            {[6, 24, 72, 168].map((h) => (
              <button
                key={h}
                type="button"
                onClick={() => {
                  setRangeMode("preset");
                  setHours(h);
                }}
                className={`px-2.5 py-1.5 rounded-lg text-xs font-bold border transition cursor-pointer ${
                  rangeMode === "preset" && hours === h
                    ? "bg-sky-500 text-white border-sky-500"
                    : "bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:border-sky-400"
                }`}
              >
                {h < 24 ? `${h} Jam` : `${h / 24} Hari`}
              </button>
            ))}

            <div className="flex flex-wrap items-center gap-1.5">
              <input
                type="date"
                value={startDate}
                onChange={(e) => {
                  setStartDate(e.target.value);
                  setRangeMode("custom");
                }}
                className="px-2 py-1 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-semibold text-slate-700 dark:text-slate-200"
              />
              <span className="text-xs text-slate-400">–</span>
              <input
                type="date"
                value={endDate}
                onChange={(e) => {
                  setEndDate(e.target.value);
                  setRangeMode("custom");
                }}
                className="px-2 py-1 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-semibold text-slate-700 dark:text-slate-200"
              />
              <button
                type="button"
                onClick={() => void fetchSeries()}
                disabled={loading}
                className="px-3 py-1.5 rounded-lg bg-slate-900 dark:bg-sky-500 text-white text-xs font-bold hover:opacity-90 disabled:opacity-50 cursor-pointer"
              >
                {loading ? "Memuat..." : "Muat"}
              </button>
            </div>
          </div>
        </div>

        {/* Body */}
        <div className="p-4 sm:p-5 space-y-5">
          {error && (
            <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/25 text-rose-700 dark:text-rose-300 text-xs font-semibold">
              {error}
            </div>
          )}

          {/* Active Energy Chart */}
          <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950/40 p-4">
            <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
              <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100">
                Grafik Akumulasi Active Energy (kWh) — {sourceTableShort(activeTable)}
              </h3>
              <div className="flex flex-wrap items-center gap-3 text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                <span className="inline-flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-sky-500" />
                  Normal
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-rose-600" />
                  Titik Turun / Naik-Turun
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-amber-500" />
                  Lonjakan / Stuck
                </span>
              </div>
            </div>

            {loading ? (
              <div className="h-[260px] flex items-center justify-center text-xs font-semibold text-slate-400">
                Memuat data mentah dari database (read-only)...
              </div>
            ) : chartPoints.length === 0 ? (
              <div className="h-[200px] flex items-center justify-center text-xs font-semibold text-slate-400">
                Tidak ada data active_energy pada tabel {activeTable} di rentang ini.
              </div>
            ) : (
              <div className="h-[280px] w-full">
                <Line data={chartData} options={chartOptions} />
              </div>
            )}
          </div>

          {/* Detected Anomalies on this PM */}
          <div className="rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden">
            <div className="px-4 py-3 bg-slate-50 dark:bg-slate-950/60 border-b border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-2">
              <h3 className="text-xs font-extrabold uppercase tracking-wider text-slate-700 dark:text-slate-200">
                Kejadian Naik-Turun / Anomali ({tableAnomalies.length})
              </h3>
              <span className="text-[11px] font-mono text-slate-400">{activeTable}</span>
            </div>

            {tableAnomalies.length === 0 ? (
              <div className="px-4 py-6 text-center text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                Tidak ada penurunan atau fluktuasi active energy pada rentang ini — akumulasi sehat.
              </div>
            ) : (
              <div className="overflow-x-auto scrollbar-thin">
                <table className="w-full min-w-[660px] text-left text-xs border-collapse">
                  <thead className="bg-slate-50/80 dark:bg-slate-950/40 text-[10px] uppercase tracking-wider text-slate-500 dark:text-slate-400">
                    <tr>
                      <th className="px-3 py-2.5">Tanggal</th>
                      <th className="px-3 py-2.5">Waktu</th>
                      <th className="px-3 py-2.5">Jenis Masalah</th>
                      <th className="px-3 py-2.5 text-right">Sebelum (kWh)</th>
                      <th className="px-3 py-2.5 text-right">Sesudah (kWh)</th>
                      <th className="px-3 py-2.5 text-right">Selisih (Δ)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {tableAnomalies.map((ev) => {
                      const meta = anomalyTypeMeta(ev.type);
                      return (
                        <tr key={ev.id} className="hover:bg-rose-500/5">
                          <td className="px-3 py-2 font-mono font-semibold text-slate-700 dark:text-slate-200">
                            {ev.date}
                          </td>
                          <td className="px-3 py-2 font-mono font-bold text-rose-600 dark:text-rose-400">
                            {ev.time}
                          </td>
                          <td className="px-3 py-2">
                            <span className={`inline-flex px-2 py-0.5 rounded-md border text-[11px] font-bold ${meta.badgeClass}`}>
                              {meta.shortLabel}
                            </span>
                          </td>
                          <td className="px-3 py-2 text-right font-mono text-slate-600 dark:text-slate-300">
                            {fmtNumber(ev.prevEnergy, 2)}
                          </td>
                          <td className="px-3 py-2 text-right font-mono font-bold text-slate-900 dark:text-white">
                            {fmtNumber(ev.currEnergy, 2)}
                          </td>
                          <td
                            className={`px-3 py-2 text-right font-mono font-bold ${
                              ev.deltaEnergy < 0
                                ? "text-rose-600 dark:text-rose-400"
                                : "text-amber-600 dark:text-amber-400"
                            }`}
                          >
                            {fmtDelta(ev.deltaEnergy)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Latest Raw Readings Table */}
          <div className="rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden">
            <div className="px-4 py-3 bg-slate-50 dark:bg-slate-950/60 border-b border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-2">
              <h3 className="text-xs font-extrabold uppercase tracking-wider text-slate-700 dark:text-slate-200">
                Data Mentah Terbaru ({recentRows.length} dari {activeSeries.length} baris)
              </h3>
              <span className="text-[11px] text-slate-400">Read-only langsung dari DB</span>
            </div>

            <div className="max-h-64 overflow-auto scrollbar-thin">
              <table className="w-full min-w-[640px] text-left text-xs border-collapse">
                <thead className="sticky top-0 bg-slate-100 dark:bg-slate-950 text-[10px] uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  <tr>
                    <th className="px-3 py-2">Timestamp (WIB)</th>
                    <th className="px-3 py-2 text-right">Active Energy (kWh)</th>
                    <th className="px-3 py-2 text-right">Δ kWh</th>
                    <th className="px-3 py-2 text-right">Daya Aktif (kW)</th>
                    <th className="px-3 py-2 text-right">Tegangan L-L (V)</th>
                    <th className="px-3 py-2">Catatan</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {recentRows.map((row) => {
                    const isBad = row.anomaly_type !== null;
                    return (
                      <tr
                        key={`${row.source_table}-${row.id}`}
                        className={
                          isBad
                            ? "bg-rose-500/10 dark:bg-rose-500/15"
                            : "hover:bg-slate-50 dark:hover:bg-slate-800/40"
                        }
                      >
                        <td className="px-3 py-1.5 font-mono text-slate-700 dark:text-slate-200">
                          {row.t_stamp}
                        </td>
                        <td className="px-3 py-1.5 text-right font-mono font-bold text-slate-900 dark:text-white">
                          {fmtNumber(row.active_energy, 2)}
                        </td>
                        <td
                          className={`px-3 py-1.5 text-right font-mono font-semibold ${
                            (row.delta_energy ?? 0) < 0
                              ? "text-rose-600 dark:text-rose-400"
                              : "text-emerald-600 dark:text-emerald-400"
                          }`}
                        >
                          {fmtDelta(row.delta_energy)}
                        </td>
                        <td className="px-3 py-1.5 text-right font-mono text-slate-600 dark:text-slate-300">
                          {fmtNumber(row.active_power_total, 2)}
                        </td>
                        <td className="px-3 py-1.5 text-right font-mono text-slate-600 dark:text-slate-300">
                          {fmtNumber(row.volt_ll, 1)}
                        </td>
                        <td className="px-3 py-1.5 text-[11px] font-semibold">
                          {row.anomaly_type ? (
                            <span className="text-rose-600 dark:text-rose-400">
                              {anomalyTypeMeta(row.anomaly_type).shortLabel}
                            </span>
                          ) : (
                            <span className="text-slate-400">OK</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
