import { useCallback, useEffect, useMemo, useState } from "react";
import { getJson } from "../../services/api.client";
import { getSocket } from "../../services/socket.service";
import { useSystemStore } from "../../store/system.store";
import Warehouse7LineChart, { type Warehouse7TrendPayload } from "../../components/warehouse/Warehouse7LineChart";
import {
  Warehouse7DeviceFilterSelect,
  Warehouse7PeriodControls,
  type Wh7DeviceOption,
  type Wh7PeriodFilter
} from "../../components/warehouse/Warehouse7FilterBar";
import {
  isWarehouseAlarmMuted,
  setWarehouseAlarmMuted,
  testWarehouseAlarmVoice,
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

function formatRelativeTime(iso: string | null): string {
  if (!iso) return "—";
  const ms = Date.now() - new Date(iso).getTime();
  if (isNaN(ms) || ms < 0) return "Baru saja";
  const mins = Math.floor(ms / 60000);
  if (mins < 1) return `${Math.floor(ms / 1000)}s ago`;
  if (mins < 60) return `${mins} mins ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs} hours ago`;
  return `${Math.floor(hrs / 24)} days ago`;
}

export default function Warehouse7Dashboard() {
  const theme = useSystemStore((state) => state.theme);
  const isDark = theme === "dark";

  const [overview, setOverview] = useState<Wh7OverviewResponse | null>(null);
  const [trend, setTrend] = useState<Warehouse7TrendPayload | null>(null);
  const [period, setPeriod] = useState<Wh7PeriodFilter>("7d");
  const [startDate, setStartDate] = useState<string>(() => getPastDateStr(6));
  const [endDate, setEndDate] = useState<string>(getTodayDateStr);
  const [deviceMode, setDeviceMode] = useState<string>("all");

  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "critical" | "warning" | "offline" | "low_battery">("all");
  const [muted, setMuted] = useState<boolean>(isWarehouseAlarmMuted);
  const [lastDubbingText, setLastDubbingText] = useState<string>("");
  const [wibClock, setWibClock] = useState<string>(() =>
    new Date().toLocaleString("en-US", {
      timeZone: "Asia/Jakarta",
      weekday: "long",
      month: "long",
      day: "numeric",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit"
    })
  );

  useEffect(() => {
    const t = setInterval(() => {
      setWibClock(
        new Date().toLocaleString("en-US", {
          timeZone: "Asia/Jakarta",
          weekday: "long",
          month: "long",
          day: "numeric",
          year: "numeric",
          hour: "2-digit",
          minute: "2-digit"
        })
      );
    }, 15000);
    return () => clearInterval(t);
  }, []);

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
      const res = await triggerWarehouseAlarmAudio(payload.alarms);
      if (res.message) setLastDubbingText(res.message);
    };

    socket.on("warehouse:wh7_live", handleLive);
    socket.on("warehouse:wh7_alarm", handleAlarm);

    const pollBackup = setInterval(fetchOverview, 5000);
    return () => {
      socket.off("warehouse:wh7_live", handleLive);
      socket.off("warehouse:wh7_alarm", handleAlarm);
      clearInterval(pollBackup);
    };
  }, [fetchOverview]);

  useEffect(() => {
    fetchTrend();
    const iv = setInterval(fetchTrend, 30000);
    return () => clearInterval(iv);
  }, [fetchTrend]);

  // Also check overview activeAlarms directly in case page loads while alarm already active
  useEffect(() => {
    if (!overview?.activeAlarms || overview.activeAlarms.length === 0) return;
    triggerWarehouseAlarmAudio(overview.activeAlarms).then((res) => {
      if (res.message) setLastDubbingText(res.message);
    });
  }, [overview?.activeAlarms]);

  const minTemp = overview?.limits?.minTemp ?? trend?.limits?.minTemp ?? 24;
  const maxTemp = overview?.limits?.maxTemp ?? trend?.limits?.maxTemp ?? 30;
  const devices = overview?.devices || [];

  const deviceOptions: Wh7DeviceOption[] = useMemo(() => {
    const map = new Map<string, string>();
    for (const d of devices) {
      map.set(
        d.deviceId,
        `${d.fullLocation} (${d.deviceId}${d.sensorTag ? ` - ${d.sensorTag}` : ""})`
      );
    }
    for (const td of trend?.devices || []) {
      if (!map.has(td.deviceId)) {
        map.set(td.deviceId, td.deviceLabel || td.deviceId);
      }
    }
    return Array.from(map.entries()).map(([deviceId, label]) => ({ deviceId, label }));
  }, [devices, trend?.devices]);

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

  const handleToggleMute = async () => {
    const next = !muted;
    setWarehouseAlarmMuted(next);
    setMuted(next);
    if (!next) {
      await unlockWarehouseAudio();
    }
  };

  const handleTestVoice = async () => {
    await testWarehouseAlarmVoice(maxTemp);
    setLastDubbingText(`Tes suara alarm: Peringatan alarm Warehouse 7 melebihi batas maksimum ${maxTemp}°C`);
  };

  return (
    <div className="space-y-5">
      {/* Top Bar matching Gudang 7 layout */}
      <div className="rounded-xl border border-[#acd3ff] dark:border-slate-800 bg-white/95 dark:bg-slate-950 p-4 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-teal-500/10 border border-teal-500/20 flex items-center justify-center text-teal-600 dark:text-teal-400">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 9l9-6 9 6v11a1 1 0 01-1 1h-5v-6H9v6H4a1 1 0 01-1-1V9z" />
              </svg>
            </div>
            <div>
              <h2 className="text-base font-extrabold text-slate-800 dark:text-slate-100">Gudang 7</h2>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                Real-Time Warehouse Temperature Monitoring & Hourly Historian
              </p>
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
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold border ${
                overview?.connected
                  ? "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800"
                  : "bg-slate-100 dark:bg-slate-900 text-slate-500 dark:text-slate-400 border-slate-200 dark:border-slate-800"
              }`}
            >
              <span
                className={`w-2 h-2 rounded-full ${
                  overview?.connected ? "bg-emerald-500 animate-pulse" : "bg-slate-400"
                }`}
              />
              {overview?.onlineCount ?? 0} Online
            </span>

            <span className="text-xs text-slate-500 dark:text-slate-400 font-medium hidden sm:inline">
              {wibClock} WIB
            </span>
          </div>
        </div>

        {/* Audio Alarm & Dubbing Toolbar */}
        <div className="mt-3 pt-3 border-t border-slate-100 dark:border-slate-800/80 flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <span className="font-semibold text-slate-600 dark:text-slate-300">
              Threshold Suhu: <span className="text-blue-600 dark:text-blue-400">{minTemp}°C</span> –{" "}
              <span className="text-rose-600 dark:text-rose-400">{maxTemp}°C</span>
            </span>
            {!overview?.configured && (
              <span className="px-2 py-0.5 rounded bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 text-amber-700 dark:text-amber-300 font-semibold">
                API Belum Terhubung (Atur di tab Configuration)
              </span>
            )}
            {overview?.configured && overview?.connectionError && (
              <span className="px-2 py-0.5 rounded bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300 font-semibold">
                API Error: {overview.connectionError}
              </span>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={handleToggleMute}
              className={`px-3 py-1 rounded-lg border text-xs font-bold transition ${
                muted
                  ? "bg-slate-100 dark:bg-slate-800 text-slate-500 border-slate-200 dark:border-slate-700"
                  : "bg-teal-50 dark:bg-teal-950/40 text-teal-700 dark:text-teal-300 border-teal-200 dark:border-teal-800"
              }`}
            >
              {muted ? "🔇 Suara Alarm Dibisukan" : "🔊 Alarm & Dubbing Aktif"}
            </button>
            <button
              type="button"
              onClick={handleTestVoice}
              className="px-3 py-1 rounded-lg border border-sky-200 dark:border-sky-800 bg-sky-50 dark:bg-sky-950/40 text-sky-700 dark:text-sky-300 text-xs font-bold hover:bg-sky-100 transition"
            >
              ▶ Tes Suara & Dubbing
            </button>
          </div>
        </div>
      </div>

      {/* Active Threshold Breach Alarm Alert Banner */}
      {(overview?.activeAlarms?.length || 0) > 0 && (
        <div className="rounded-xl border border-rose-300 dark:border-rose-800 bg-rose-50/90 dark:bg-rose-950/50 p-4 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <div className="text-xs font-extrabold uppercase tracking-wider text-rose-700 dark:text-rose-300 flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-rose-600 animate-ping" />
                ALARM SUHU WAREHOUSE 7 AKTIF ({overview!.activeAlarms.length})
              </div>
              <ul className="mt-1.5 space-y-1 text-xs text-rose-800 dark:text-rose-200 font-medium">
                {overview!.activeAlarms.map((a) => (
                  <li key={a.alarmKey}>• {a.message}</li>
                ))}
              </ul>
              {lastDubbingText && (
                <p className="mt-2 text-[11px] italic text-rose-600 dark:text-rose-300">
                  Dubbing aktif: "{lastDubbingText}"
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Summary Top Cards matching Gambar 1 */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="rounded-xl border-b-4 border-b-emerald-500 border border-[#acd3ff] dark:border-slate-800 bg-white dark:bg-slate-950 p-5 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-teal-50 dark:bg-teal-950/50 text-teal-600 dark:text-teal-400 flex items-center justify-center shrink-0">
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M14 14.76V3.5a2.5 2.5 0 00-5 0v11.26a4.5 4.5 0 105 0z" />
            </svg>
          </div>
          <div>
            <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
              AVERAGE WAREHOUSE TEMPERATURE
            </div>
            <div className="mt-1 text-3xl font-extrabold text-slate-900 dark:text-slate-100 font-mono">
              {overview?.avgTemp !== null && overview?.avgTemp !== undefined ? `${overview.avgTemp.toFixed(1)} °C` : "— °C"}
            </div>
            {overview?.deltaFromPrevious !== null && overview?.deltaFromPrevious !== undefined ? (
              <div
                className={`mt-1.5 inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-bold ${
                  overview.deltaFromPrevious >= 0
                    ? "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300"
                    : "bg-sky-50 dark:bg-sky-950/40 text-sky-700 dark:text-sky-300"
                }`}
              >
                {overview.deltaFromPrevious >= 0 ? "↑ +" : "↓ "}
                {overview.deltaFromPrevious.toFixed(1)}°C from the previous period
              </div>
            ) : (
              <div className="mt-1.5 text-[11px] text-slate-400">Menunggu data perbandingan periode</div>
            )}
          </div>
        </div>

        <div className="rounded-xl border border-[#acd3ff] dark:border-slate-800 bg-white dark:bg-slate-950 p-5 shadow-sm flex flex-col justify-between">
          <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
            TEMPERATURE LIMITS (ALARM THRESHOLD)
          </div>
          <div className="mt-2 flex items-baseline gap-3">
            <span className="text-2xl font-extrabold text-blue-600 dark:text-blue-400 font-mono">{minTemp}°C</span>
            <span className="text-slate-400 font-bold">—</span>
            <span className="text-2xl font-extrabold text-rose-600 dark:text-rose-400 font-mono">{maxTemp}°C</span>
          </div>
          <div className="mt-2 text-[11px] text-slate-500 dark:text-slate-400">
            Alarm & dubbing suara berbunyi otomatis jika suhu di luar batas ini.
          </div>
        </div>

        <div className="rounded-xl border border-[#acd3ff] dark:border-slate-800 bg-white dark:bg-slate-950 p-5 shadow-sm flex flex-col justify-between">
          <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
            SENSOR DEVICE SUMMARY
          </div>
          <div className="mt-2 grid grid-cols-2 sm:grid-cols-4 gap-2 text-center">
            <div className="rounded-lg bg-slate-50 dark:bg-slate-900 p-2">
              <div className="text-base font-extrabold text-slate-800 dark:text-slate-100">{counts.all}</div>
              <div className="text-[10px] font-semibold text-slate-400">Total</div>
            </div>
            <div className="rounded-lg bg-emerald-50 dark:bg-emerald-950/30 p-2">
              <div className="text-base font-extrabold text-emerald-600 dark:text-emerald-400">{overview?.onlineCount ?? 0}</div>
              <div className="text-[10px] font-semibold text-emerald-600/80">Online</div>
            </div>
            <div className="rounded-lg bg-rose-50 dark:bg-rose-950/30 p-2">
              <div className="text-base font-extrabold text-rose-600 dark:text-rose-400">{counts.critical}</div>
              <div className="text-[10px] font-semibold text-rose-600/80">Critical</div>
            </div>
            <div className="rounded-lg bg-slate-100 dark:bg-slate-800/60 p-2">
              <div className="text-base font-extrabold text-slate-500">{counts.offline}</div>
              <div className="text-[10px] font-semibold text-slate-400">Offline</div>
            </div>
          </div>
        </div>
      </div>

      {/* Daily Trend Analysis Line Chart */}
      <div className="rounded-xl border border-[#acd3ff] dark:border-slate-800 bg-white dark:bg-slate-950 p-5 shadow-sm space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-extrabold text-slate-800 dark:text-slate-100 flex items-center gap-2">
              Daily Trend Analysis
            </h3>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">
              Line chart suhu per jam & real-time dengan hover terpisah per titik agar mudah dibaca
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Warehouse7DeviceFilterSelect
              deviceMode={deviceMode}
              onDeviceModeChange={setDeviceMode}
              deviceOptions={deviceOptions}
            />
            <span className="px-3 py-1.5 rounded-lg border border-teal-200 dark:border-teal-800 bg-teal-50 dark:bg-teal-950/40 text-teal-700 dark:text-teal-300 text-xs font-bold">
              • Temp (°C)
            </span>
          </div>
        </div>

        <Warehouse7LineChart
          trend={trend}
          deviceMode={deviceMode}
          isDark={isDark}
          minTemp={minTemp}
          maxTemp={maxTemp}
          heightClass="h-[340px]"
        />

        <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex flex-wrap items-center justify-between gap-2 text-xs">
          <span className="px-2.5 py-1 rounded-md border border-rose-200 dark:border-rose-900/50 bg-rose-50 dark:bg-rose-950/30 text-rose-700 dark:text-rose-300 font-semibold">
            Temperature Limits: {minTemp}°C - {maxTemp}°C
          </span>
          <span className="text-[11px] text-slate-400">
            Sumber utama: tabel PostgreSQL <span className="font-mono">warehouse_telemetry</span> (per jam) + live polling 1 detik
          </span>
        </div>
      </div>

      {/* Bottom Device Search, Status Filter Pills & Cards Grid */}
      <div className="space-y-4">
        <div className="flex flex-wrap items-center gap-3">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Find Device ID and Racking Location..."
            className="w-full sm:w-72 px-3.5 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-teal-500"
          />

          <div className="flex flex-wrap items-center gap-2">
            {[
              { id: "all", label: "All", count: counts.all },
              { id: "critical", label: "Critical", count: counts.critical },
              { id: "warning", label: "Warning", count: counts.warning },
              { id: "offline", label: "Offline", count: counts.offline },
              { id: "low_battery", label: "Low battery", count: counts.lowBattery }
            ].map((pill) => (
              <button
                key={pill.id}
                type="button"
                onClick={() => setStatusFilter(pill.id as any)}
                className={`px-3 py-1.5 rounded-full border text-xs font-bold transition inline-flex items-center gap-1.5 ${
                  statusFilter === pill.id
                    ? "bg-teal-600 text-white border-teal-600 shadow-sm"
                    : "bg-white dark:bg-slate-950 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-900"
                }`}
              >
                <span>{pill.label}</span>
                <span className="px-1.5 py-0.2 rounded-full bg-black/10 dark:bg-white/10 text-[10px]">
                  {pill.count}
                </span>
              </button>
            ))}
          </div>
        </div>

        {filteredDevices.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {filteredDevices.map((dev) => {
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
                  ? "bg-rose-100 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300"
                  : dev.status === "warning"
                  ? "bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300"
                  : dev.status === "normal"
                  ? "bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300"
                  : "bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400";

              return (
                <div
                  key={dev.deviceId}
                  className={`rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 p-4 shadow-sm ${borderAccent}`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="text-sm font-extrabold text-slate-800 dark:text-slate-100">
                        {dev.shortLocation}
                      </div>
                      <div className="text-[11px] font-semibold text-slate-400">
                        {dev.sensorTag || dev.fullLocation}
                      </div>
                    </div>
                    <span className="text-[10px] font-mono font-bold text-teal-600 dark:text-teal-400 bg-teal-50 dark:bg-teal-950/50 px-2 py-0.5 rounded">
                      #{dev.deviceId}
                    </span>
                  </div>

                  <div className="mt-2">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-extrabold uppercase ${badgeStyle}`}>
                      {dev.status}
                    </span>
                  </div>

                  <div className="mt-3">
                    <div className="text-[10px] font-bold uppercase text-slate-400">TEMP</div>
                    <div
                      className={`text-2xl font-extrabold font-mono ${
                        dev.status === "critical"
                          ? "text-rose-600 dark:text-rose-400"
                          : "text-slate-900 dark:text-slate-100"
                      }`}
                    >
                      {dev.suhu !== null ? `${dev.suhu.toFixed(1)}°C` : "— °C"}
                    </div>
                  </div>

                  <div className="mt-3 pt-2.5 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400">
                    <span className="font-semibold">
                      🔋 {dev.baterai !== null ? `${dev.baterai}%` : "—"}
                    </span>
                    <span>{formatRelativeTime(dev.lastSeen)}</span>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="rounded-xl border border-dashed border-slate-200 dark:border-slate-800 bg-white/60 dark:bg-slate-950/60 p-8 text-center">
            <div className="text-sm font-bold text-slate-700 dark:text-slate-200">
              Belum Ada Data Perangkat Warehouse 7
            </div>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400 max-w-lg mx-auto">
              Semua data dummy telah dikosongkan. Kartu sensor Warehouse 7 akan tampil secara real-time setelah API Key / Kredensial `172.16.4.122:8002` dikonfigurasi di tab <span className="font-bold">Configuration</span>.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
