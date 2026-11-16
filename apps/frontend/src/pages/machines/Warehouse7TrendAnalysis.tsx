import { useCallback, useEffect, useMemo, useState } from "react";
import { utils, writeFile } from "xlsx";
import { getJson } from "../../services/api.client";
import { useSystemStore } from "../../store/system.store";
import { useTranslation } from "../../i18n/useTranslation";
import Warehouse7LineChart, { type Warehouse7TrendPayload } from "../../components/warehouse/Warehouse7LineChart";
import {
  Warehouse7DeviceFilterSelect,
  Warehouse7PeriodControls,
  type Wh7DeviceOption,
  type Wh7PeriodFilter
} from "../../components/warehouse/Warehouse7FilterBar";

const INITIAL_LOG_LIMIT = 10;

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
  const { t, language } = useTranslation();

  const [period, setPeriod] = useState<Wh7PeriodFilter>("7d");
  const [startDate, setStartDate] = useState<string>(() => getPastDateStr(6));
  const [endDate, setEndDate] = useState<string>(getTodayDateStr);
  const [deviceMode, setDeviceMode] = useState<string>("all");
  const [trend, setTrend] = useState<Warehouse7TrendPayload | null>(null);
  const [loading, setLoading] = useState(false);
  const [showAllLogs, setShowAllLogs] = useState(false);

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
    setShowAllLogs(false);
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

  const displayedRows = useMemo(() => {
    if (showAllLogs) return filteredTableRows;
    return filteredTableRows.slice(0, INITIAL_LOG_LIMIT);
  }, [filteredTableRows, showAllLogs]);

  const handleExportExcel = () => {
    const rows = filteredTableRows.map((r) => ({
      [t("warehouse7.colTime", "Waktu (WIB)")]: r.label,
      [t("warehouse7.colDevice", "Perangkat")]: r.deviceId,
      [t("warehouse7.colLocation", "Lokasi")]: r.locationLabel,
      [t("warehouse7.colTemp", "Suhu (°C)")]: r.suhu,
      [t("warehouse7.colHumi", "Kelembapan")]: r.humi ?? "-",
      [t("warehouse7.colBattery", "Baterai")]: r.baterai ?? "-",
      [t("warehouse7.colStatus", "Status")]:
        r.suhu > maxTemp
          ? t("warehouse7.statusHigh", "Melebihi Maks")
          : r.suhu < minTemp
          ? t("warehouse7.statusLow", "Di Bawah Min")
          : t("warehouse7.statusNormal", "Normal")
    }));
    const emptyLabel = language === "en" ? "No telemetry data" : "Belum ada data telemetry";
    const ws = utils.json_to_sheet(rows.length > 0 ? rows : [{ Info: emptyLabel }]);
    const wb = utils.book_new();
    utils.book_append_sheet(wb, ws, "Warehouse_7_Trend");
    writeFile(wb, `Warehouse_7_Trend_${period}_${getTodayDateStr()}.xlsx`);
  };

  return (
    <div className="space-y-6">
      {/* Header & Filter Controls matching SCADA UI */}
      <div className="rounded-xl border border-[#acd3ff] dark:border-slate-800 bg-white dark:bg-slate-950 p-5 shadow-sm transition-colors duration-300">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-extrabold text-[#002b5c] dark:text-slate-100">
            {t("warehouse7.trendPageTitle", "Analisis Tren — Gudang 7")}
          </h2>

          <div className="flex flex-wrap items-center gap-2.5">
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
              className="px-4 py-2 rounded-lg bg-[#1f6fb5] hover:bg-[#195a94] text-white text-sm font-bold transition shadow-sm cursor-pointer"
            >
              {t("warehouse7.exportExcel", "Ekspor Excel")}
            </button>
          </div>
        </div>
      </div>

      {/* Statistical KPI Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="rounded-xl border border-[#acd3ff] dark:border-slate-800 bg-white dark:bg-slate-950 p-5 shadow-sm">
          <div className="text-xs font-bold uppercase tracking-wider text-[#47729f] dark:text-slate-400">
            {t("warehouse7.minTempCard", "SUHU MINIMUM")}
          </div>
          <div className="mt-1.5 text-3xl font-extrabold font-mono text-[#1f6fb5] dark:text-sky-400">
            {trend?.stats?.minTemp !== null && trend?.stats?.minTemp !== undefined ? `${trend.stats.minTemp.toFixed(1)} °C` : "— °C"}
          </div>
        </div>

        <div className="rounded-xl border border-[#acd3ff] dark:border-slate-800 bg-white dark:bg-slate-950 p-5 shadow-sm">
          <div className="text-xs font-bold uppercase tracking-wider text-[#47729f] dark:text-slate-400">
            {t("warehouse7.avgTempCard", "SUHU RATA-RATA")}
          </div>
          <div className="mt-1.5 text-3xl font-extrabold font-mono text-[#002b5c] dark:text-slate-100">
            {trend?.stats?.avgTemp !== null && trend?.stats?.avgTemp !== undefined ? `${trend.stats.avgTemp.toFixed(1)} °C` : "— °C"}
          </div>
        </div>

        <div className="rounded-xl border border-[#acd3ff] dark:border-slate-800 bg-white dark:bg-slate-950 p-5 shadow-sm">
          <div className="text-xs font-bold uppercase tracking-wider text-[#47729f] dark:text-slate-400">
            {t("warehouse7.maxTempCard", "SUHU MAKSIMUM")}
          </div>
          <div className="mt-1.5 text-3xl font-extrabold font-mono text-rose-600 dark:text-rose-400">
            {trend?.stats?.maxTemp !== null && trend?.stats?.maxTemp !== undefined ? `${trend.stats.maxTemp.toFixed(1)} °C` : "— °C"}
          </div>
        </div>

        <div className="rounded-xl border border-[#acd3ff] dark:border-slate-800 bg-white dark:bg-slate-950 p-5 shadow-sm">
          <div className="text-xs font-bold uppercase tracking-wider text-[#47729f] dark:text-slate-400">
            {t("warehouse7.exceedCard", "DI LUAR BATAS")}
          </div>
          <div className="mt-1.5 text-3xl font-extrabold font-mono text-amber-600 dark:text-amber-400">
            {trend?.stats?.exceedCount ?? 0}
          </div>
          <div className="text-xs font-semibold text-[#47729f] dark:text-slate-400 mt-1">
            {trend?.stats?.totalPoints ?? 0} {t("warehouse7.recordsOf", "rekaman")} ({minTemp}–{maxTemp}°C)
          </div>
        </div>
      </div>

      {/* Line Chart Card */}
      <div className="rounded-xl border border-[#acd3ff] dark:border-slate-800 bg-white dark:bg-slate-950 p-5 shadow-sm transition-colors duration-300">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#acd3ff]/40 dark:border-slate-800 pb-3 mb-4">
          <h3 className="text-base font-extrabold text-[#002b5c] dark:text-slate-100 uppercase tracking-wide">
            {t("warehouse7.chartTitle", "Grafik Tren Suhu")}
          </h3>
          {loading && (
            <span className="text-xs text-[#1f6fb5] dark:text-sky-400 font-bold animate-pulse">
              {t("warehouse7.loadingData", "Memuat data...")}
            </span>
          )}
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

      {/* Hourly Historian Table with Initial Limit & View All Toggle */}
      <div className="rounded-xl border border-[#acd3ff] dark:border-slate-800 bg-white dark:bg-slate-950 p-5 shadow-sm space-y-4 transition-colors duration-300">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#acd3ff]/40 dark:border-slate-800 pb-3">
          <div>
            <h3 className="text-base font-extrabold text-[#002b5c] dark:text-slate-100 uppercase tracking-wide">
              {t("warehouse7.logTableTitle", "Log Telemetry Per Jam")}
            </h3>
            <p className="text-xs font-semibold text-[#47729f] dark:text-slate-400 mt-0.5">
              {t("warehouse7.showingRows", "Menampilkan")} {displayedRows.length} {t("warehouse7.ofRows", "dari")} {filteredTableRows.length} {t("warehouse7.rowsUnit", "baris")}
            </p>
          </div>

          {filteredTableRows.length > INITIAL_LOG_LIMIT && (
            <button
              type="button"
              onClick={() => setShowAllLogs((prev) => !prev)}
              className="px-4 py-2 rounded-lg border border-[#acd3ff] dark:border-sky-800 bg-[#e8f3ff] dark:bg-sky-950/40 text-[#1f6fb5] dark:text-sky-300 text-sm font-bold hover:bg-[#d8ebff] transition cursor-pointer"
            >
              {showAllLogs
                ? t("warehouse7.showLess", "Tampilkan Sebagian")
                : `${t("warehouse7.viewAll", "View All")} (${filteredTableRows.length})`}
            </button>
          )}
        </div>

        <div className="overflow-x-auto scrollbar-thin">
          <table className="w-full min-w-[700px] text-left text-sm border-collapse">
            <thead>
              <tr className="border-b border-[#acd3ff]/50 dark:border-slate-800 text-xs uppercase tracking-wider text-[#47729f] dark:text-slate-400 font-bold">
                <th className="py-3 px-3">{t("warehouse7.colTime", "Waktu (WIB)")}</th>
                <th className="py-3 px-3">{t("warehouse7.colDevice", "Perangkat")}</th>
                <th className="py-3 px-3">{t("warehouse7.colLocation", "Lokasi")}</th>
                <th className="py-3 px-3">{t("warehouse7.colTemp", "Suhu (°C)")}</th>
                <th className="py-3 px-3">{t("warehouse7.colHumi", "Kelembapan")}</th>
                <th className="py-3 px-3">{t("warehouse7.colBattery", "Baterai")}</th>
                <th className="py-3 px-3">{t("warehouse7.colStatus", "Status")}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/70">
              {displayedRows.length > 0 ? (
                displayedRows.map((row, idx) => {
                  const overMax = row.suhu > maxTemp;
                  const underMin = row.suhu < minTemp;
                  return (
                    <tr key={`${row.deviceId}_${row.t_stamp}_${idx}`} className="hover:bg-slate-50 dark:hover:bg-slate-900/50">
                      <td className="py-3 px-3 font-mono font-medium text-[#002b5c] dark:text-slate-300">{row.label}</td>
                      <td className="py-3 px-3 font-mono font-bold text-[#1f6fb5] dark:text-sky-400">#{row.deviceId}</td>
                      <td className="py-3 px-3 font-medium text-[#002b5c] dark:text-slate-200">{row.locationLabel}</td>
                      <td className={`py-3 px-3 font-mono font-bold ${overMax || underMin ? "text-rose-600 dark:text-rose-400" : "text-[#002b5c] dark:text-slate-100"}`}>
                        {row.suhu.toFixed(1)} °C
                      </td>
                      <td className="py-3 px-3 font-mono text-[#47729f] dark:text-slate-400">
                        {row.humi !== null ? `${row.humi.toFixed(1)}%` : "—"}
                      </td>
                      <td
                        className={`py-3 px-3 font-mono ${
                          row.baterai !== null && row.baterai < 20
                            ? "text-rose-600 dark:text-rose-400 font-extrabold"
                            : "text-[#47729f] dark:text-slate-400"
                        }`}
                      >
                        {row.baterai !== null ? `${row.baterai}%` : "—"}
                      </td>
                      <td className="py-3 px-3">
                        {overMax ? (
                          <span className="px-2.5 py-0.5 rounded bg-rose-500/15 text-rose-700 dark:text-rose-300 font-bold text-xs">
                            {t("warehouse7.critical", "Kritis")} (&gt;{maxTemp}°C)
                          </span>
                        ) : underMin ? (
                          <span className="px-2.5 py-0.5 rounded bg-[#e8f3ff] dark:bg-sky-950/60 text-[#1f6fb5] dark:text-sky-300 font-bold text-xs">
                            {t("warehouse7.critical", "Kritis")} (&lt;{minTemp}°C)
                          </span>
                        ) : (
                          <span className="px-2.5 py-0.5 rounded bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 font-bold text-xs">
                            {t("warehouse7.statusNormal", "Normal")}
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-sm text-[#47729f] dark:text-slate-400">
                    {t("warehouse7.noTableRows", "Belum ada data pada rentang ini.")}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {filteredTableRows.length > INITIAL_LOG_LIMIT && !showAllLogs && (
          <div className="pt-2 flex justify-center">
            <button
              type="button"
              onClick={() => setShowAllLogs(true)}
              className="px-5 py-2 rounded-lg border border-[#acd3ff] dark:border-sky-800 bg-[#f7fbff] dark:bg-slate-900 text-[#1f6fb5] dark:text-sky-300 text-sm font-bold hover:bg-[#e8f3ff] transition cursor-pointer"
            >
              {t("warehouse7.viewAll", "View All")} ({filteredTableRows.length})
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
