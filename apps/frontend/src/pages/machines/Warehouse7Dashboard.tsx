import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { getJson, putJson } from "../../services/api.client";
import { getSocket } from "../../services/socket.service";
import { useAuthStore } from "../../store/auth.store";
import { useSystemStore } from "../../store/system.store";
import { useTranslation } from "../../i18n/useTranslation";
import type { Warehouse7TrendPayload } from "../../components/warehouse/Warehouse7LineChart";
import Warehouse7AlarmToast, { type Warehouse7AlarmToastData } from "../../components/warehouse/Warehouse7AlarmToast";
import {
  Warehouse7PeriodControls,
  type Wh7PeriodFilter
} from "../../components/warehouse/Warehouse7FilterBar";
import {
  requestWarehouseNotificationPermission,
  setWarehouseAlarmMuted,
  triggerWarehouseAlarmAudio,
  unlockWarehouseAudio,
  type WarehouseAlarmViolation
} from "../../utils/warehouseAlarmAudio";

interface Wh7Device {
  deviceId: string;
  shortLocation: string;
  fullLocation: string;
  sensorTag: string;
  suhu: number | null;
  humi: number | null;
  baterai: number | null;
  lastSeen: string | null;
  isOnline: boolean;
  status: "normal" | "warning" | "critical" | "offline";
  breachType: "high" | "low" | null;
}

interface Wh7OverviewResponse {
  unitId: string;
  configured: boolean;
  connected: boolean;
  connectionError: string | null;
  lastPollAt: string | null;
  avgTemp: number | null;
  avgHumi: number | null;
  deltaFromPrevious: number | null;
  onlineCount: number;
  totalDevices: number;
  limits: { minTemp: number; maxTemp: number };
  devices: Wh7Device[];
  activeAlarms: Array<{
    alarmKey: string;
    deviceId: string;
    location: string;
    suhu: number;
    threshold: number;
    direction: "high" | "low";
    message: string;
    ts: string;
  }>;
}

function getTodayDateStr(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function getPastDateStr(daysAgo: number): string {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function formatRelativeTime(iso: string | null, language: "id" | "en"): string {
  if (!iso) return "—";
  const ms = Date.now() - new Date(iso).getTime();
  if (isNaN(ms) || ms < 0) return language === "en" ? "Just now" : "Baru saja";
  const mins = Math.floor(ms / 60000);
  if (mins < 1) {
    const secs = Math.max(1, Math.floor(ms / 1000));
    return language === "en" ? `${secs}s ago` : `${secs} dtk lalu`;
  }
  if (mins < 60) return language === "en" ? `${mins}m ago` : `${mins} mnt lalu`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return language === "en" ? `${hrs}h ago` : `${hrs} jam lalu`;
  const days = Math.floor(hrs / 24);
  return language === "en" ? `${days}d ago` : `${days} hr lalu`;
}

function BatteryIndicator({ level }: { level: number | null }) {
  if (level === null || level === undefined) {
    return (
      <span className="inline-flex items-center gap-1.5 text-slate-400">
        <svg className="w-5 h-4" viewBox="0 0 24 14" fill="none" stroke="currentColor" strokeWidth="1.8">
          <rect x="1" y="2" width="19" height="10" rx="2" />
          <path d="M21 5v4" strokeLinecap="round" />
        </svg>
        <span>—</span>
      </span>
    );
  }

  const isLow = level < 20;
  const colorClass = isLow
    ? "text-rose-600 dark:text-rose-400 bg-rose-500/10 border border-rose-500/25 px-2 py-0.5 rounded-md font-extrabold"
    : "text-emerald-600 dark:text-emerald-400 font-bold";
  const fillWidth = Math.max(2, Math.min(15, Math.round((level / 100) * 15)));

  return (
    <span className={`inline-flex items-center gap-1.5 ${colorClass}`}>
      <svg className="w-5 h-4 shrink-0" viewBox="0 0 24 14" fill="none">
        <rect x="1" y="2" width="19" height="10" rx="2" stroke="currentColor" strokeWidth="1.8" />
        <path d="M21.5 5v4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        <rect x="3" y="4" width={fillWidth} height="6" rx="1" fill="currentColor" />
      </svg>
      <span className="font-mono">{level}%</span>
    </span>
  );
}

export default function Warehouse7Dashboard() {
  const theme = useSystemStore((state) => state.theme);
  const isDark = theme === "dark";
  const userId = useAuthStore((state) => state.user?.id ?? "");
  const { t, language } = useTranslation();

  const [overview, setOverview] = useState<Wh7OverviewResponse | null>(null);
  const [trend, setTrend] = useState<Warehouse7TrendPayload | null>(null);
  const [period, setPeriod] = useState<Wh7PeriodFilter>("7d");
  const [startDate, setStartDate] = useState<string>(() => getPastDateStr(6));
  const [endDate, setEndDate] = useState<string>(getTodayDateStr);
  const [deviceMode, setDeviceMode] = useState<string>("all");

  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "critical" | "warning" | "offline" | "low_battery">("all");

  const prefVersionRef = useRef(0);
  const [alarmEnabled, setAlarmEnabled] = useState<boolean>(() => {
    if (typeof window === "undefined" || !userId) return false;
    return window.localStorage.getItem(`scada.wh7.alarm_enabled.${userId}`) === "true";
  });
  const muted = !alarmEnabled;
  const [alarmToast, setAlarmToast] = useState<Warehouse7AlarmToastData | null>(null);

  // Synchronize per-account alarm preference (default disabled) across refresh/relogin
  useEffect(() => {
    const versionAtStart = ++prefVersionRef.current;
    if (!userId) {
      setAlarmEnabled(false);
      setWarehouseAlarmMuted(true);
      return;
    }

    const cacheKey = `scada.wh7.alarm_enabled.${userId}`;
    const cachedEnabled =
      typeof window !== "undefined" && window.localStorage.getItem(cacheKey) === "true";
    setAlarmEnabled(cachedEnabled);
    setWarehouseAlarmMuted(!cachedEnabled);

    getJson<{ success: boolean; alarmEnabled: boolean }>("/warehouse/wh7/alarm-preference")
      .then((res) => {
        if (prefVersionRef.current !== versionAtStart) return;
        const dbEnabled = Boolean(res?.alarmEnabled);
        setAlarmEnabled(dbEnabled);
        setWarehouseAlarmMuted(!dbEnabled);
        if (typeof window !== "undefined") {
          window.localStorage.setItem(cacheKey, String(dbEnabled));
        }
      })
      .catch(() => {
        // Fallback smoothly to cached per-account setting
      });
  }, [userId]);

  // Resume browser AudioContext cleanly on first interaction if account alarm is already enabled after reload
  useEffect(() => {
    if (!alarmEnabled) return;
    const handleUnlock = () => {
      unlockWarehouseAudio();
    };
    window.addEventListener("pointerdown", handleUnlock, { once: true, passive: true });
    window.addEventListener("keydown", handleUnlock, { once: true, passive: true });
    return () => {
      window.removeEventListener("pointerdown", handleUnlock);
      window.removeEventListener("keydown", handleUnlock);
    };
  }, [alarmEnabled]);

  const [wibClock, setWibClock] = useState<string>(() =>
    new Date().toLocaleString(language === "en" ? "en-US" : "id-ID", {
      timeZone: "Asia/Jakarta",
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false
    })
  );

  useEffect(() => {
    const updateClock = () => {
      setWibClock(
        new Date().toLocaleString(language === "en" ? "en-US" : "id-ID", {
          timeZone: "Asia/Jakarta",
          day: "2-digit",
          month: "short",
          year: "numeric",
          hour: "2-digit",
          minute: "2-digit",
          hour12: false
        })
      );
    };
    updateClock();
    const timer = setInterval(updateClock, 15000);
    return () => clearInterval(timer);
  }, [language]);

  const fetchOverview = useCallback(async () => {
    try {
      const res = await getJson<{ success: boolean; data: Wh7OverviewResponse }>("/warehouse/wh7/overview");
      if (res?.data) setOverview(res.data);
    } catch {
      // keep existing state cleanly
    }
  }, []);

  const fetchTrend = useCallback(async () => {
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
      // no dummy fallback
    }
  }, [period, startDate, endDate, deviceMode]);

  useEffect(() => {
    fetchOverview();
    const socket = getSocket();

    const handleLive = (payload: Wh7OverviewResponse) => {
      if (payload) setOverview(payload);
    };
    const handleAlarm = async (payload: { alarms?: WarehouseAlarmViolation[] }) => {
      if (!payload?.alarms || payload.alarms.length === 0) return;
      const res = await triggerWarehouseAlarmAudio(payload.alarms, language);
      if (res.played && res.message) {
        setAlarmToast({ id: Date.now(), title: res.title, message: res.message, durationMs: 12000 });
      }
    };

    socket.on("warehouse:wh7_live", handleLive);
    socket.on("warehouse:wh7_alarm", handleAlarm);

    const pollBackup = setInterval(fetchOverview, 5000);
    return () => {
      socket.off("warehouse:wh7_live", handleLive);
      socket.off("warehouse:wh7_alarm", handleAlarm);
      clearInterval(pollBackup);
    };
  }, [fetchOverview, language]);

  useEffect(() => {
    fetchTrend();
    const iv = setInterval(fetchTrend, 30000);
    return () => clearInterval(iv);
  }, [fetchTrend]);

  useEffect(() => {
    if (!alarmEnabled || !overview?.activeAlarms || overview.activeAlarms.length === 0) return;
    triggerWarehouseAlarmAudio(overview.activeAlarms, language).then((res) => {
      if (res.played && res.message) {
        setAlarmToast({ id: Date.now(), title: res.title, message: res.message, durationMs: 12000 });
      }
    });
  }, [overview?.activeAlarms, alarmEnabled, language]);

  useEffect(() => {
    if (!alarmToast) return;
    const tId = setTimeout(() => setAlarmToast(null), 12000);
    return () => clearTimeout(tId);
  }, [alarmToast]);

  const minTemp = overview?.limits?.minTemp ?? trend?.limits?.minTemp ?? 24;
  const maxTemp = overview?.limits?.maxTemp ?? trend?.limits?.maxTemp ?? 30;
  const devices = overview?.devices || [];

  const counts = useMemo(() => {
    return {
      all: devices.length,
      critical: devices.filter((d) => d.status === "critical").length,
      warning: devices.filter((d) => d.status === "warning").length,
      offline: devices.filter((d) => d.status === "offline" || !d.isOnline).length,
      lowBattery: devices.filter((d) => d.baterai !== null && d.baterai < 20).length
    };
  }, [devices]);

  const filteredDevices = useMemo(() => {
    return devices.filter((d) => {
      if (statusFilter === "critical" && d.status !== "critical") return false;
      if (statusFilter === "warning" && d.status !== "warning") return false;
      if (statusFilter === "offline" && (d.status !== "offline" && d.isOnline)) return false;
      if (statusFilter === "low_battery" && !(d.baterai !== null && d.baterai < 20)) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        return (
          d.deviceId.toLowerCase().includes(q) ||
          d.shortLocation.toLowerCase().includes(q) ||
          d.fullLocation.toLowerCase().includes(q) ||
          d.sensorTag.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [devices, statusFilter, searchQuery]);

  const handleToggleAlarm = async () => {
    const nextEnabled = !alarmEnabled;
    const prevEnabled = alarmEnabled;
    prefVersionRef.current += 1;

    setAlarmEnabled(nextEnabled);
    setWarehouseAlarmMuted(!nextEnabled);

    const cacheKey = userId ? `scada.wh7.alarm_enabled.${userId}` : "";
    if (cacheKey && typeof window !== "undefined") {
      window.localStorage.setItem(cacheKey, String(nextEnabled));
    }

    if (nextEnabled) {
      await unlockWarehouseAudio();
      await requestWarehouseNotificationPermission();
    }

    if (userId) {
      try {
        const res = await putJson<{ success: boolean; alarmEnabled: boolean }>(
          "/warehouse/wh7/alarm-preference",
          { alarmEnabled: nextEnabled }
        );
        const persisted = Boolean(res?.alarmEnabled ?? nextEnabled);
        setAlarmEnabled(persisted);
        setWarehouseAlarmMuted(!persisted);
        if (cacheKey && typeof window !== "undefined") {
          window.localStorage.setItem(cacheKey, String(persisted));
        }
      } catch {
        setAlarmEnabled(prevEnabled);
        setWarehouseAlarmMuted(!prevEnabled);
        if (cacheKey && typeof window !== "undefined") {
          window.localStorage.setItem(cacheKey, String(prevEnabled));
        }
      }
    }
  };

  return (
    <div className="space-y-5">
      {/* Floating Alarm Notification Toast */}
      <Warehouse7AlarmToast toast={alarmToast} onClose={() => setAlarmToast(null)} />

      {/* Uniform SCADA Toolbar */}
      <div className="rounded-xl border border-[#acd3ff] dark:border-slate-800 bg-white dark:bg-slate-950 p-4 shadow-sm transition-colors duration-300">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-[#1f6fb5]/10 border border-[#acd3ff] dark:border-sky-800/50 flex items-center justify-center text-[#1f6fb5] dark:text-sky-400 shrink-0">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 9l9-6 9 6v11a1 1 0 01-1 1h-5v-6H9v6H4a1 1 0 01-1-1V9z" />
              </svg>
            </div>
            <div>
              <h2 className="text-lg font-extrabold text-[#002b5c] dark:text-slate-100">
                {t("warehouse7.title", "Gudang 7")}
              </h2>
              {(!overview?.configured || overview?.connectionError) && (
                <p className="text-xs font-semibold text-rose-600 dark:text-rose-400">
                  {!overview?.configured
                    ? t("warehouse7.alarmNotConfigured", "API Belum Terkonfigurasi")
                    : `${t("warehouse7.apiError", "API Error")}: ${overview.connectionError}`}
                </p>
              )}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <Warehouse7PeriodControls
              period={period}
              onPeriodChange={setPeriod}
              startDate={startDate}
              onStartDateChange={setStartDate}
              endDate={endDate}
              onEndDateChange={setEndDate}
            />

            <span
              className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-lg text-sm font-bold border ${
                overview?.connected
                  ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30"
                  : "bg-slate-100 dark:bg-slate-900 text-slate-500 dark:text-slate-400 border-slate-200 dark:border-slate-800"
              }`}
            >
              <span
                className={`w-2.5 h-2.5 rounded-full ${
                  overview?.connected ? "bg-emerald-500 animate-pulse" : "bg-slate-400"
                }`}
              />
              {overview?.onlineCount ?? 0} {t("warehouse7.online", "Online")}
            </span>

            <span className="text-xs sm:text-sm text-[#47729f] dark:text-slate-400 font-mono font-semibold hidden md:inline">
              {wibClock} WIB
            </span>

            <button
              type="button"
              onClick={handleToggleAlarm}
              className={`px-3.5 py-2 rounded-lg border text-sm font-bold transition cursor-pointer ${
                muted
                  ? "bg-slate-100 dark:bg-slate-900 text-slate-500 dark:text-slate-400 border-slate-300 dark:border-slate-700 hover:bg-slate-200 dark:hover:bg-slate-800"
                  : "bg-[#e8f3ff] dark:bg-sky-950/40 text-[#1f6fb5] dark:text-sky-300 border-[#acd3ff] dark:border-sky-800 hover:bg-[#d8ebff]"
              }`}
            >
              {muted
                ? `🔇 ${t("warehouse7.enableAlarm", "Enable Alarm")}`
                : `🔊 ${t("warehouse7.disableAlarm", "Disable Alarm")}`}
            </button>
          </div>
        </div>
      </div>

      {/* Active Threshold Breach Alarm Banner */}
      {(overview?.activeAlarms?.length || 0) > 0 && (
        <div className="rounded-xl border border-rose-300 dark:border-rose-800 bg-rose-50/90 dark:bg-rose-950/50 p-4 shadow-sm">
          <div className="text-sm font-extrabold uppercase tracking-wider text-rose-700 dark:text-rose-300 flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-rose-600 animate-ping" />
            {t("warehouse7.activeAlarmTitle", "ALARM SUHU GUDANG 7")} ({overview!.activeAlarms.length})
          </div>
          <ul className="mt-1.5 space-y-1 text-sm text-rose-800 dark:text-rose-200 font-semibold">
            {overview!.activeAlarms.map((a) => (
              <li key={a.alarmKey}>• {a.message}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Uniform Interactive KPI Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="group rounded-xl border border-[#acd3ff] dark:border-slate-800 bg-white dark:bg-slate-950 p-5 shadow-sm flex items-center gap-4 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg hover:border-[#1f6fb5] dark:hover:border-sky-500">
          <div className="w-12 h-12 rounded-xl bg-[#1f6fb5]/10 text-[#1f6fb5] dark:text-sky-400 flex items-center justify-center shrink-0 transition-transform duration-200 group-hover:scale-110">
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M14 14.76V3.5a2.5 2.5 0 00-5 0v11.26a4.5 4.5 0 105 0z" />
            </svg>
          </div>
          <div>
            <div className="text-xs font-bold uppercase tracking-wider text-[#47729f] dark:text-slate-400">
              {t("warehouse7.avgTempLabel", "RATA-RATA SUHU GUDANG")}
            </div>
            <div className="mt-1 text-3xl sm:text-4xl font-extrabold text-[#002b5c] dark:text-slate-100 font-mono transition-colors group-hover:text-[#1f6fb5] dark:group-hover:text-sky-400">
              {overview?.avgTemp !== null && overview?.avgTemp !== undefined ? `${overview.avgTemp.toFixed(1)} °C` : "— °C"}
            </div>
            {overview?.deltaFromPrevious !== null && overview?.deltaFromPrevious !== undefined ? (
              <div
                className={`mt-2 inline-flex items-center px-2.5 py-0.5 rounded-md text-xs font-bold ${
                  overview.deltaFromPrevious >= 0
                    ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
                    : "bg-[#e8f3ff] dark:bg-sky-950/50 text-[#1f6fb5] dark:text-sky-300"
                }`}
              >
                {overview.deltaFromPrevious >= 0 ? "↑ +" : "↓ "}
                {overview.deltaFromPrevious.toFixed(1)}°C {t("warehouse7.fromPrevPeriod", "dari periode sebelumnya")}
              </div>
            ) : (
              <div className="mt-1.5 text-xs text-slate-400">
                {t("warehouse7.waitingDelta", "Menunggu pembanding")}
              </div>
            )}
          </div>
        </div>

        <div className="group rounded-xl border border-[#acd3ff] dark:border-slate-800 bg-white dark:bg-slate-950 p-5 shadow-sm flex flex-col justify-center transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg hover:border-[#1f6fb5] dark:hover:border-sky-500">
          <div className="text-xs font-bold uppercase tracking-wider text-[#47729f] dark:text-slate-400">
            {t("warehouse7.tempLimitsLabel", "BATAS SUHU ALARM")}
          </div>
          <div className="mt-2 flex items-baseline gap-3">
            <span className="text-3xl sm:text-4xl font-extrabold text-[#1f6fb5] dark:text-sky-400 font-mono transition-transform duration-200 group-hover:scale-105 inline-block">{minTemp}°C</span>
            <span className="text-slate-400 text-xl font-bold">—</span>
            <span className="text-3xl sm:text-4xl font-extrabold text-rose-600 dark:text-rose-400 font-mono transition-transform duration-200 group-hover:scale-105 inline-block">{maxTemp}°C</span>
          </div>
        </div>

        <div className="rounded-xl border border-[#acd3ff] dark:border-slate-800 bg-white dark:bg-slate-950 p-5 shadow-sm flex flex-col justify-between transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg hover:border-[#1f6fb5] dark:hover:border-sky-500">
          <div className="text-xs font-bold uppercase tracking-wider text-[#47729f] dark:text-slate-400">
            {t("warehouse7.sensorSummaryLabel", "RINGKASAN SENSOR")}
          </div>
          <div className="mt-2 grid grid-cols-2 sm:grid-cols-4 gap-2 text-center">
            <button
              type="button"
              onClick={() => setStatusFilter("all")}
              className="rounded-lg bg-slate-50 dark:bg-slate-900 border border-slate-200/70 dark:border-slate-800 p-2.5 transition-all duration-150 hover:scale-105 hover:border-[#1f6fb5] cursor-pointer"
            >
              <div className="text-xl font-extrabold text-[#002b5c] dark:text-slate-100">{counts.all}</div>
              <div className="text-xs font-bold text-[#47729f] dark:text-slate-400">{t("warehouse7.total", "Total")}</div>
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter("all")}
              className="rounded-lg bg-emerald-500/10 border border-emerald-500/20 p-2.5 transition-all duration-150 hover:scale-105 hover:border-emerald-500 cursor-pointer"
            >
              <div className="text-xl font-extrabold text-emerald-600 dark:text-emerald-400">{overview?.onlineCount ?? 0}</div>
              <div className="text-xs font-bold text-emerald-700 dark:text-emerald-300">{t("warehouse7.online", "Online")}</div>
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter("critical")}
              className="rounded-lg bg-rose-500/10 border border-rose-500/20 p-2.5 transition-all duration-150 hover:scale-105 hover:border-rose-500 cursor-pointer"
            >
              <div className="text-xl font-extrabold text-rose-600 dark:text-rose-400">{counts.critical}</div>
              <div className="text-xs font-bold text-rose-700 dark:text-rose-300">{t("warehouse7.critical", "Kritis")}</div>
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter("offline")}
              className="rounded-lg bg-slate-100 dark:bg-slate-800/60 border border-slate-200/70 dark:border-slate-700 p-2.5 transition-all duration-150 hover:scale-105 hover:border-slate-500 cursor-pointer"
            >
              <div className="text-xl font-extrabold text-slate-600 dark:text-slate-300">{counts.offline}</div>
              <div className="text-xs font-bold text-slate-500 dark:text-slate-400">{t("warehouse7.offline", "Offline")}</div>
            </button>
          </div>
        </div>
      </div>

      {/* Bottom Device Search, Status Filter Pills & Cards Grid */}
      <div className="space-y-4">
        <div className="flex flex-wrap items-center gap-3">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={t("warehouse7.searchPlaceholder", "Cari ID Perangkat atau Lokasi...")}
            className="w-full sm:w-80 px-3.5 py-2 rounded-lg border border-[#acd3ff] dark:border-slate-700 bg-white dark:bg-slate-900 text-sm text-[#002b5c] dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-[#1f6fb5]"
          />

          <div className="flex flex-wrap items-center gap-2">
            {[
              { id: "all", label: t("warehouse7.all", "Semua"), count: counts.all },
              { id: "critical", label: t("warehouse7.critical", "Kritis"), count: counts.critical },
              { id: "warning", label: t("warehouse7.warning", "Peringatan"), count: counts.warning },
              { id: "offline", label: t("warehouse7.offline", "Offline"), count: counts.offline },
              { id: "low_battery", label: t("warehouse7.lowBattery", "Baterai Lemah"), count: counts.lowBattery }
            ].map((pill) => (
              <button
                key={pill.id}
                type="button"
                onClick={() => setStatusFilter(pill.id as any)}
                className={`px-3.5 py-1.5 rounded-full border text-sm font-bold transition inline-flex items-center gap-2 cursor-pointer hover:-translate-y-0.5 ${
                  statusFilter === pill.id
                    ? "bg-[#1f6fb5] text-white border-[#1f6fb5] shadow-sm"
                    : "bg-white dark:bg-slate-950 text-[#47729f] dark:text-slate-300 border-[#acd3ff] dark:border-slate-800 hover:bg-[#1f6fb5]/10"
                }`}
              >
                <span>{pill.label}</span>
                <span className="px-2 py-0.5 rounded-full bg-black/10 dark:bg-white/10 text-xs">
                  {pill.count}
                </span>
              </button>
            ))}
          </div>
        </div>

        {filteredDevices.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {filteredDevices.map((dev) => {
              const isSelected = deviceMode === dev.deviceId;
              const borderAccent =
                dev.status === "critical"
                  ? "border-l-4 border-l-rose-500"
                  : dev.status === "warning"
                  ? "border-l-4 border-l-amber-500"
                  : dev.status === "normal"
                  ? "border-l-4 border-l-emerald-500"
                  : "border-l-4 border-l-slate-300 dark:border-l-slate-700";

              const badgeStyle =
                dev.status === "critical"
                  ? "bg-rose-500/15 text-rose-700 dark:text-rose-300"
                  : dev.status === "warning"
                  ? "bg-amber-500/15 text-amber-700 dark:text-amber-300"
                  : dev.status === "normal"
                  ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300"
                  : "bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400";

              const localizedStatus =
                dev.status === "critical"
                  ? t("warehouse7.critical", "CRITICAL")
                  : dev.status === "warning"
                  ? t("warehouse7.warning", "WARNING")
                  : dev.status === "normal"
                  ? t("warehouse7.statusNormal", "NORMAL")
                  : t("warehouse7.offline", "OFFLINE");

              return (
                <div
                  key={dev.deviceId}
                  role="button"
                  tabIndex={0}
                  onClick={() => setDeviceMode((prev) => (prev === dev.deviceId ? "all" : dev.deviceId))}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      setDeviceMode((prev) => (prev === dev.deviceId ? "all" : dev.deviceId));
                    }
                  }}
                  title={t("warehouse7.clickToFilterChart", "Klik untuk filter grafik")}
                  className={`group rounded-xl border bg-white dark:bg-slate-950 p-5 shadow-sm transition-all duration-200 hover:-translate-y-1 hover:shadow-xl hover:border-[#1f6fb5] dark:hover:border-sky-500 cursor-pointer ${borderAccent} ${
                    isSelected
                      ? "border-[#1f6fb5] ring-2 ring-[#1f6fb5]/35 dark:border-sky-400 dark:ring-sky-400/30"
                      : "border-[#acd3ff] dark:border-slate-800"
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="text-base sm:text-lg font-extrabold text-[#002b5c] dark:text-slate-100 group-hover:text-[#1f6fb5] dark:group-hover:text-sky-400 transition-colors">
                        {dev.shortLocation}
                      </div>
                      <div className="text-xs font-bold text-[#47729f] dark:text-slate-400">
                        {dev.sensorTag || dev.fullLocation}
                      </div>
                    </div>
                    <span className="text-xs font-mono font-bold text-[#1f6fb5] dark:text-sky-400 bg-[#e8f3ff] dark:bg-sky-950/50 border border-[#acd3ff] dark:border-sky-800/50 px-2.5 py-0.5 rounded transition-transform duration-200 group-hover:scale-105">
                      #{dev.deviceId}
                    </span>
                  </div>

                  <div className="mt-2.5 flex items-center justify-between gap-2">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded text-xs font-extrabold uppercase ${badgeStyle}`}>
                      {localizedStatus}
                    </span>
                    <span className="text-[11px] font-bold text-[#1f6fb5] dark:text-sky-400 opacity-0 group-hover:opacity-100 transition-opacity">
                      ↗ {t("warehouse7.clickToFilterChart", "Klik untuk filter grafik")}
                    </span>
                  </div>

                  <div className="mt-3">
                    <div className="text-xs font-bold uppercase tracking-wider text-[#47729f] dark:text-slate-400">
                      {t("warehouse7.tempLabel", "SUHU")}
                    </div>
                    <div
                      className={`text-3xl sm:text-4xl font-extrabold font-mono mt-0.5 transition-transform duration-200 origin-left group-hover:scale-[1.03] ${
                        dev.status === "critical"
                          ? "text-rose-600 dark:text-rose-400"
                          : "text-[#002b5c] dark:text-slate-100"
                      }`}
                    >
                      {dev.suhu !== null ? `${dev.suhu.toFixed(1)}°C` : "— °C"}
                    </div>
                  </div>

                  <div className="mt-4 pt-3 border-t border-[#acd3ff]/40 dark:border-slate-800 flex items-center justify-between text-xs sm:text-sm text-[#47729f] dark:text-slate-400 font-semibold">
                    <BatteryIndicator level={dev.baterai} />
                    <span>{formatRelativeTime(dev.lastSeen, language)}</span>
                  </div>
                </div>
              );
            })}
          </div>
        ) : devices.length > 0 ? (
          <div className="rounded-xl border border-dashed border-[#acd3ff] dark:border-slate-800 bg-white/80 dark:bg-slate-950/60 p-8 text-center space-y-2.5">
            <div className="text-lg font-extrabold text-[#002b5c] dark:text-slate-100">
              {t("warehouse7.notFoundTitle", "Not Found")}
            </div>
            <p className="text-sm text-[#47729f] dark:text-slate-400 max-w-md mx-auto">
              {t("warehouse7.notFoundDesc", "Tidak ada perangkat yang sesuai dengan filter atau pencarian saat ini.")}
            </p>
            <button
              type="button"
              onClick={() => {
                setStatusFilter("all");
                setSearchQuery("");
              }}
              className="mt-1 px-4 py-1.5 rounded-lg bg-[#1f6fb5] hover:bg-[#195a94] text-white text-xs font-bold transition shadow-sm cursor-pointer"
            >
              {t("warehouse7.resetFilterBtn", "Tampilkan Semua")}
            </button>
          </div>
        ) : (
          <div className="rounded-xl border border-dashed border-[#acd3ff] dark:border-slate-800 bg-white/80 dark:bg-slate-950/60 p-8 text-center">
            <div className="text-base font-bold text-[#002b5c] dark:text-slate-200">
              {t("warehouse7.noDevicesTitle", "Belum Ada Perangkat Warehouse 7")}
            </div>
            <p className="mt-1 text-sm text-[#47729f] dark:text-slate-400 max-w-md mx-auto">
              {t("warehouse7.noDevicesDesc", "Hubungkan API di tab Konfigurasi.")}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
