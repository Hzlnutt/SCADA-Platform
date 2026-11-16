import { useCallback, useEffect, useMemo, useState } from "react";
import { utils, writeFile } from "xlsx";
import { getJson } from "../../services/api.client";
import { useSystemStore } from "../../store/system.store";
import Warehouse7LineChart, { type Warehouse7TrendPayload } from "../../components/warehouse/Warehouse7LineChart";
import {
  Warehouse7DeviceFilterSelect,
  Warehouse7PeriodControls,
  type Wh7DeviceOption,
  type Wh7PeriodFilter
} from "../../components/warehouse/Warehouse7FilterBar";

function getTodayDateStr(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function getPastDateStr(daysAgo: number): string {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export default function Warehouse7TrendAnalysis() {
  const theme = useSystemStore((state) => state.theme);
  const isDark = theme === "dark";

  const [period, setPeriod] = useState<Wh7PeriodFilter>("7d");
  const [startDate, setStartDate] = useState<string>(() => getPastDateStr(6));
  const [endDate, setEndDate] = useState<string>(getTodayDateStr);
  const [deviceMode, setDeviceMode] = useState<string>("all");
  const [trend, setTrend] = useState<Warehouse7TrendPayload | null>(null);
  const [loading, setLoading] = useState(false);

  const fetchTrend = useCallback(async () => {
    setLoading(true);
    try {
      const q = new URLSearchParams({
        filter: period,
        deviceMode
      });
      if (period === "custom") {
        q.set("start", startDate);
        q.set("end", endDate);
      }
      const res = await getJson<{ success: boolean; data: Warehouse7TrendPayload }>(`/warehouse/wh7/trend?${q.toString()}`);
      if (res?.data) setTrend(res.data);
    } catch {
      // zero dummy fallback
    } finally {
      setLoading(false);
    }
  }, [period, startDate, endDate, deviceMode]);

  useEffect(() => {
    fetchTrend();
  }, [fetchTrend]);

  const minTemp = trend?.limits?.minTemp ?? 24;
  const maxTemp = trend?.limits?.maxTemp ?? 30;

  const deviceOptions: Wh7DeviceOption[] = useMemo(() => {
    return (trend?.devices || []).map((d) => ({
      deviceId: d.deviceId,
      label: d.deviceLabel || d.deviceId
    }));
  }, [trend?.devices]);

  const filteredTableRows = useMemo(() => {
    const rows = trend?.hourlyRows || [];
    if (deviceMode === "all" || deviceMode === "highest") return rows;
    return rows.filter((r) => r.deviceId === deviceMode);
  }, [trend?.hourlyRows, deviceMode]);

  const handleExportExcel = () => {
    const rows = filteredTableRows.map((r) => ({
      Waktu_WIB: r.label,
      Device_ID: r.deviceId,
      Lokasi: r.locationLabel,
      Suhu_C: r.suhu,
      Kelembapan_RH: r.humi ?? "-",
      Baterai_Pct: r.baterai ?? "-",
      Status_Batas: r.suhu > maxTemp ? "Melebihi Max" : r.suhu < minTemp ? "Di Bawah Min" : "Normal"
    }));
    const ws = utils.json_to_sheet(rows.length > 0 ? rows : [{ Info: "Belum ada data telemetry" }]);
    const wb = utils.book_new();
    utils.book_append_sheet(wb, ws, "Warehouse_7_Trend");
    writeFile(wb, `Warehouse_7_Trend_${period}_${getTodayDateStr()}.xlsx`);
  };

  return (
    <div className="space-y-6">
      {/* Header & Filter Controls */}
      <div className="rounded-xl border border-[#acd3ff] dark:border-slate-800 bg-white dark:bg-slate-950 p-5 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-extrabold text-slate-800 dark:text-slate-100">
              Trend Analysis — Warehouse 7
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Analisis histori suhu per jam (<span className="font-mono">warehouse_telemetry</span>) dengan filter rentang waktu, kalender kustom, dan pemilihan perangkat
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Warehouse7PeriodControls
              period={period}
              onPeriodChange={setPeriod}
              startDate={startDate}
              onStartDateChange={setStartDate}
              endDate={endDate}
              onEndDateChange={setEndDate}
            />
            <Warehouse7DeviceFilterSelect
              deviceMode={deviceMode}
              onDeviceModeChange={setDeviceMode}
              deviceOptions={deviceOptions}
            />
            <button
              type="button"
              onClick={handleExportExcel}
              className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition shadow-sm"
            >
              Export Excel
            </button>
          </div>
        </div>
      </div>

      {/* Statistical KPI Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="rounded-xl border border-[#acd3ff] dark:border-slate-800 bg-white dark:bg-slate-950 p-4 shadow-sm">
          <div className="text-[11px] font-bold uppercase text-slate-400">MINIMUM TEMP</div>
          <div className="mt-1 text-2xl font-extrabold font-mono text-blue-600 dark:text-blue-400">
            {trend?.stats?.minTemp !== null && trend?.stats?.minTemp !== undefined ? `${trend.stats.minTemp.toFixed(1)} °C` : "— °C"}
          </div>
        </div>
        <div className="rounded-xl border border-[#acd3ff] dark:border-slate-800 bg-white dark:bg-slate-950 p-4 shadow-sm">
          <div className="text-[11px] font-bold uppercase text-slate-400">AVERAGE TEMP</div>
          <div className="mt-1 text-2xl font-extrabold font-mono text-slate-900 dark:text-slate-100">
            {trend?.stats?.avgTemp !== null && trend?.stats?.avgTemp !== undefined ? `${trend.stats.avgTemp.toFixed(1)} °C` : "— °C"}
          </div>
        </div>
        <div className="rounded-xl border border-[#acd3ff] dark:border-slate-800 bg-white dark:bg-slate-950 p-4 shadow-sm">
          <div className="text-[11px] font-bold uppercase text-slate-400">MAXIMUM TEMP</div>
          <div className="mt-1 text-2xl font-extrabold font-mono text-rose-600 dark:text-rose-400">
            {trend?.stats?.maxTemp !== null && trend?.stats?.maxTemp !== undefined ? `${trend.stats.maxTemp.toFixed(1)} °C` : "— °C"}
          </div>
        </div>
        <div className="rounded-xl border border-[#acd3ff] dark:border-slate-800 bg-white dark:bg-slate-950 p-4 shadow-sm">
          <div className="text-[11px] font-bold uppercase text-slate-400">PELANGGARAN THRESHOLD</div>
          <div className="mt-1 text-2xl font-extrabold font-mono text-amber-600 dark:text-amber-400">
            {trend?.stats?.exceedCount ?? 0}
          </div>
          <div className="text-[10px] text-slate-400 mt-0.5">
            Dari {trend?.stats?.totalPoints ?? 0} rekaman (Batas {minTemp}–{maxTemp}°C)
          </div>
        </div>
      </div>

      {/* Line Chart Card */}
      <div className="rounded-xl border border-[#acd3ff] dark:border-slate-800 bg-white dark:bg-slate-950 p-5 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
          <h3 className="text-sm font-extrabold text-slate-800 dark:text-slate-100">
            Temperature Trend Line Chart
          </h3>
          {loading && <span className="text-xs text-teal-600 font-semibold">Memuat data...</span>}
        </div>
        <Warehouse7LineChart
          trend={trend}
          deviceMode={deviceMode}
          isDark={isDark}
          minTemp={minTemp}
          maxTemp={maxTemp}
          heightClass="h-[380px]"
        />
      </div>

      {/* Hourly Historian Table */}
      <div className="rounded-xl border border-[#acd3ff] dark:border-slate-800 bg-white dark:bg-slate-950 p-5 shadow-sm space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h3 className="text-sm font-extrabold text-slate-800 dark:text-slate-100">
              Log Telemetry Per Jam (warehouse_telemetry)
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Rekaman data utama per jam tersimpan di database PostgreSQL
            </p>
          </div>
          <span className="text-xs font-semibold text-slate-500">
            Total: {filteredTableRows.length} baris
          </span>
        </div>

        <div className="overflow-x-auto scrollbar-thin">
          <table className="w-full min-w-[680px] text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-800 text-[11px] uppercase text-slate-500 dark:text-slate-400">
                <th className="py-2.5 px-3 font-bold">Waktu (WIB)</th>
                <th className="py-2.5 px-3 font-bold">Device ID</th>
                <th className="py-2.5 px-3 font-bold">Lokasi Rak</th>
                <th className="py-2.5 px-3 font-bold">Suhu (°C)</th>
                <th className="py-2.5 px-3 font-bold">Kelembapan (%RH)</th>
                <th className="py-2.5 px-3 font-bold">Baterai</th>
                <th className="py-2.5 px-3 font-bold">Status Batas</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/70">
              {filteredTableRows.length > 0 ? (
                filteredTableRows.slice(0, 200).map((row, idx) => {
                  const overMax = row.suhu > maxTemp;
                  const underMin = row.suhu < minTemp;
                  return (
                    <tr key={`${row.deviceId}_${row.t_stamp}_${idx}`} className="hover:bg-slate-50 dark:hover:bg-slate-900/50">
                      <td className="py-2.5 px-3 font-mono text-slate-700 dark:text-slate-300">{row.label}</td>
                      <td className="py-2.5 px-3 font-mono font-bold text-teal-600 dark:text-teal-400">#{row.deviceId}</td>
                      <td className="py-2.5 px-3 text-slate-700 dark:text-slate-200">{row.locationLabel}</td>
                      <td className={`py-2.5 px-3 font-mono font-bold ${overMax || underMin ? "text-rose-600 dark:text-rose-400" : "text-slate-800 dark:text-slate-100"}`}>
                        {row.suhu.toFixed(2)} °C
                      </td>
                      <td className="py-2.5 px-3 font-mono text-slate-600 dark:text-slate-400">
                        {row.humi !== null ? `${row.humi.toFixed(1)}%` : "—"}
                      </td>
                      <td className="py-2.5 px-3 font-mono text-slate-600 dark:text-slate-400">
                        {row.baterai !== null ? `${row.baterai}%` : "—"}
                      </td>
                      <td className="py-2.5 px-3">
                        {overMax ? (
                          <span className="px-2 py-0.5 rounded bg-rose-100 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 font-bold text-[10px]">
                            CRITICAL (&gt;{maxTemp}°C)
                          </span>
                        ) : underMin ? (
                          <span className="px-2 py-0.5 rounded bg-blue-100 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 font-bold text-[10px]">
                            CRITICAL (&lt;{minTemp}°C)
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 font-bold text-[10px]">
                            NORMAL
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-slate-400">
                    Belum ada data per jam tersimpan di tabel <span className="font-mono">warehouse_telemetry</span> untuk rentang waktu ini.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
