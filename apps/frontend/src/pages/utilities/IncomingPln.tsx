import { useEffect, useState, useMemo, useCallback, useRef } from "react";
import { useLocation } from "react-router-dom";
import { usePageActive } from "../../hooks/usePageActive";
import { PageHeader } from "../../components/ui/PageHeader";
import { Line, Radar } from "react-chartjs-2";
import { Chart as ChartJS } from "chart.js";
import "../../components/charts/chartjs";
import { getJson, postJson } from "../../services/api.client";
import { getSocket } from "../../services/socket.service";
import { useSystemStore } from "../../store/system.store";
import { ApiSourcesPanel } from "../machines/MachineConfig";
import { useAuthStore } from "../../store/auth.store";
import { canAccessConfigAndAudit } from "../../utils/roles";

/* ═══════════ CONSTANTS & HELPERS ═══════════ */
const formatCurrency = (value: number) =>
  new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value);

const DEFAULT_API_URLS: Record<string, string> = {
  pln: "http://10.3.164.3:8088/system/webdev/Utility_Dashboard/electric_pln",
  fact1: "http://10.3.164.3:8088/system/webdev/Utility_Dashboard/electric_wf1",
  fact2: "http://10.3.164.3:8088/system/webdev/Utility_Dashboard/electric_wf2"
};

const DEFAULT_JSON_KEYS: Record<string, string> = {
  voltage: "Volt_LL",
  frequency: "Frequency",
  active_power: "Active_Power",
  power_factor: "Power_Factor",
  reactive_power: "Reactive_Power_Total",
  apparent_power: "Apparent_Power_Total",
  unbalance_v: "Volatage_Unbalance",
  unbalance_i: "Current_Umbalance",
  v_r: "VoltAB",
  v_s: "VoltBC",
  v_t: "VoltCA",
  i_r: "Current_A",
  i_s: "Current_B",
  i_t: "Current_C",
  thd_v_r: "THD_Volt_A",
  thd_v_s: "THD_Volt_B",
  thd_v_t: "THD_Volt_C",
  thd_i_r: "THD_Current_A",
  thd_i_s: "THD_Current_B",
  thd_i_t: "THD_Current_C"
};

// Event logs mock data matching the mockup
const MOCK_EVENTS: any[] = [];

/* ═══════════ CUSTOM GAUGE COMPONENT ═══════════ */
function UnbalancedGauge({
  label,
  value,
  maxAllowed,
  isDark,
  isLoading = false,
  isPmOnline = true
}: {
  label: string;
  value: number | string | null | undefined;
  maxAllowed: number;
  isDark: boolean;
  isLoading?: boolean;
  isPmOnline?: boolean;
}) {
  const isDead = value === "PM OFFLINE";
  const isOffline = isDead || value === null || value === undefined || (typeof value === "string" && (value.includes("API") || value === "xx" || value.includes("TIDAK")));
  const numVal = isOffline ? 0 : Number(value) || 0;
  
  const percentage = Math.min(100, (numVal / maxAllowed) * 100);
  const radius = 50;
  const strokeWidth = 10;
  const circumference = 2 * Math.PI * radius;
  // Semi-circle gauge (180 degrees)
  const strokeDashoffset = circumference - (percentage / 100) * (circumference / 2);

  return (
    <div className="flex flex-col items-center justify-between p-5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm relative h-full">
      <div className="text-center">
        <h4 className="text-[11px] font-extrabold uppercase tracking-wider text-slate-400 dark:text-slate-500">{label}</h4>
        <p className="text-[10px] text-slate-400 dark:text-slate-600 mt-0.5">Maks. {maxAllowed}%</p>
      </div>

      {/* SVG Semi-Circle Gauge */}
      <div className="relative mt-4 flex items-center justify-center" style={{ width: 140, height: 80 }}>
        <svg width="120" height="70" viewBox="0 0 120 70" className="overflow-visible">
          {/* Background Arc */}
          <path
            d="M 10 60 A 50 50 0 0 1 110 60"
            fill="none"
            stroke={isDark ? "#1e293b" : "#f1f5f9"}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
          />
          {/* Progress Arc */}
          {!isLoading && !isOffline && (
            <path
              d="M 10 60 A 50 50 0 0 1 110 60"
              fill="none"
              stroke={numVal > maxAllowed ? "#ef4444" : "#10b981"}
              strokeWidth={strokeWidth}
              strokeDasharray={circumference / 2}
              strokeDashoffset={strokeDashoffset}
              strokeLinecap="round"
              className="transition-all duration-1000 ease-out"
            />
          )}
        </svg>
        <div className="absolute bottom-2 text-center flex flex-col items-center justify-center w-full px-1">
          {isLoading ? (
            <span className="h-6 w-16 bg-slate-200 dark:bg-slate-700/60 rounded-md animate-pulse inline-block" />
          ) : isDead ? (
            <div className="flex flex-col items-center">
              <span className="text-2xl font-black font-mono text-slate-400 dark:text-slate-600 leading-none">—</span>
              <span className="text-[9px] font-black uppercase text-rose-500 tracking-wider mt-0.5">PM MATI</span>
            </div>
          ) : isOffline ? (
            <span className="text-[9px] font-bold font-mono text-amber-500 uppercase leading-none text-center select-none break-all">{value === "BELUM ADA API" ? "BELUM ADA API" : "GAGAL POLLING API"}</span>
          ) : (
            <div>
              <span className="text-2xl font-extrabold font-mono text-slate-800 dark:text-white">{numVal.toFixed(2)}</span>
              <span className="text-xs font-bold text-slate-400 ml-0.5">%</span>
            </div>
          )}
        </div>
      </div>

      {isLoading ? (
        <div className="w-full mt-4 py-1.5 rounded-lg text-center bg-sky-500/10 border border-sky-500/20 text-[10px] font-extrabold uppercase text-sky-500 animate-pulse tracking-wider">
          MEMUAT DATA...
        </div>
      ) : isDead ? (
        <div className="w-full mt-4 py-1.5 rounded-lg text-center bg-rose-500/10 border border-rose-500/25 text-[10px] font-black uppercase text-rose-500 tracking-wider">
          ✕ PM MATI (OFFLINE)
        </div>
      ) : isOffline ? (
        <div className="w-full mt-4 py-1.5 rounded-lg text-center bg-amber-500/10 border border-amber-500/20 text-[10px] font-extrabold uppercase text-amber-500 tracking-wider">
          ✕ {value === "BELUM ADA API" ? "BELUM ADA API" : "GAGAL POLLING API"}
        </div>
      ) : numVal > maxAllowed ? (
        <div className="w-full mt-4 py-1.5 rounded-lg text-center bg-red-500/10 border border-red-500/20 text-[10px] font-extrabold uppercase text-red-500 tracking-wider">
          ⚠ MELEBIHI BATAS
        </div>
      ) : (
        <div className="w-full mt-4 py-1.5 rounded-lg text-center bg-emerald-500/10 border border-emerald-500/20 text-[10px] font-extrabold uppercase text-emerald-500 tracking-wider">
          ✓ Dalam batas normal
        </div>
      )}
    </div>
  );
}

function parseBoolStatus(val: any): boolean | null {
  if (val === undefined || val === null) return null;
  if (typeof val === "boolean") return val;
  if (typeof val === "number") return val !== 0;
  if (typeof val === "string") {
    const s = val.trim().toLowerCase();
    if (s === "false" || s === "0" || s === "offline" || s === "mati" || s === "disconnected") return false;
    if (s === "true" || s === "1" || s === "online" || s === "connected") return true;
  }
  return Boolean(val);
}

function checkDeviceStatus(data: any, currentMode: "pln" | "fact1" | "fact2"): boolean | null {
  if (!data || typeof data !== "object") return null;

  const tryKeys = (keys: string[]): boolean | null => {
    for (const k of keys) {
      if (data[k] !== undefined) {
        const parsed = parseBoolStatus(data[k]);
        if (parsed !== null) return parsed;
      }
    }
    return null;
  };

  if (currentMode === "pln") {
    const res = tryKeys(["Status_PM8000", "status_pm8000", "Status_PM800", "status_pm800", "Status_PLN", "status_pln"]);
    if (res !== null) return res;
  } else if (currentMode === "fact1") {
    const res = tryKeys([
      "Status_PM5500_WF1", "status_pm5500_wf1",
      "Status_PM5560", "status_pm5560",
      "Status_PM5500", "status_pm5500",
      "Status_WF1", "status_wf1"
    ]);
    if (res !== null) return res;
  } else if (currentMode === "fact2") {
    const res = tryKeys([
      "Status_PM5500_WF2", "status_pm5500_wf2",
      "Status_PM5500", "status_pm5500",
      "Status_PM5500_WF1", "Status_PM5560",
      "Status_WF2", "status_wf2"
    ]);
    if (res !== null) return res;
  }

  return tryKeys(["status", "Status", "online", "Online", "connected", "Connected"]);
}

/* ═══════════ MAIN COMPONENT ═══════════ */
export default function IncomingPln() {
  const theme = useSystemStore((state) => state.theme);
  const isDark = theme === "dark";
  const location = useLocation();

  // Standards configuration state
  const [standards, setStandards] = useState({
    voltageNominal: 20.0,
    voltageTolerance: 5.0,
    frequencyNominal: 50.0,
    frequencyTolerance: 0.5,
    activePowerMax: 0,
    reactivePowerMax: 0,
    apparentPowerMax: 0,
    powerFactorMin: 0.85,
    unbalanceVMax: 2.0,
    unbalanceIMax: 10.0,
    thdVoltageMax: 5.0,
    thdCurrentMax: 8.0
  });

  const role = useAuthStore((state) => state.user?.role ?? "user");
  const canAccessConfig = canAccessConfigAndAudit(role);

  const [showConfigModal, setShowConfigModal] = useState(false);
  const [showConfigPanel, setShowConfigPanel] = useState(false);
  const [savingConfig, setSavingConfig] = useState(false);

  // Form temporary state inside config modal
  const [formStds, setFormStds] = useState(standards);

  // Load standards from Postgres config
  useEffect(() => {
    getJson<{ data: any[] }>("/config/electricity?configType=sumber_utama_standards")
      .then((res) => {
        if (res?.data && res.data.length > 0) {
          const stored = res.data.find(item => item.config_key === "standards");
          if (stored && stored.value) {
            setStandards(stored.value);
            setFormStds(stored.value);
          }
        }
      })
      .catch((err) => console.error("Failed to load PLN standards:", err));
  }, []);

  const handleOpenConfig = () => {
    setFormStds(standards);
    setShowConfigModal(true);
  };

  const handleSaveStandards = async () => {
    setSavingConfig(true);
    try {
      await postJson("/config/electricity", {
        config_type: "sumber_utama_standards",
        config_key: "standards",
        label: "Incoming PLN Standards",
        value: formStds,
        sort_order: 0,
        enabled: true
      });
      setStandards(formStds);
      setShowConfigModal(false);
    } catch (err) {
      console.error(err);
      alert("Failed to save standard settings.");
    } finally {
      setSavingConfig(false);
    }
  };

  // Determine current mode based on route URL
  const mode = useMemo(() => {
    if (location.pathname.endsWith("incoming-fact-1")) return "fact1";
    if (location.pathname.endsWith("incoming-fact-2")) return "fact2";
    return "pln";
  }, [location.pathname]);

  // Configure parameters and device IDs dynamically
  const config = useMemo(() => {
    if (mode === "fact1") {
      return {
        title: "Incoming Fact-1 20 kV — Feeder WF1",
        connectedLabel: "FACT-1 CONNECTED",
        deviceId: "Feeder_WF1_PM5560",
        pmModel: "PM5560",
        activePowerBase: 0,
        voltageBase: 0,
        pfBase: 0,
        reactiveBase: 0,
        apparentBase: 0,
        unbalanceVBase: 0,
        unbalanceIBase: 0
      };
    }
    if (mode === "fact2") {
      return {
        title: "Incoming Fact-2 20 kV — Feeder WF2",
        connectedLabel: "FACT-2 CONNECTED",
        deviceId: "Feeder_WF2_PM5500",
        pmModel: "PM5500",
        activePowerBase: 0,
        voltageBase: 0,
        pfBase: 0,
        reactiveBase: 0,
        apparentBase: 0,
        unbalanceVBase: 0,
        unbalanceIBase: 0
      };
    }
    // Default PLN
    return {
      title: "Incoming PLN 20 kV — Sumber Utama",
      connectedLabel: "PLN CONNECTED",
      deviceId: "Cubicle_PLN_PM8000",
      pmModel: "PM8000",
      activePowerBase: 0,
      voltageBase: 0,
      pfBase: 0,
      reactiveBase: 0,
      apparentBase: 0,
      unbalanceVBase: 0,
      unbalanceIBase: 0
    };
  }, [mode]);

  const [loading, setLoading] = useState(true);
  const [realtimeData, setRealtimeData] = useState<any>(null);

  const [apiSourceUrls, setApiSourceUrls] = useState<Record<string, string>>({});
  const [jsonKeyMap, setJsonKeyMap] = useState<Record<string, string>>({});
  const [apiLiveData, setApiLiveData] = useState<Record<string, any>>({});

  // Sync API configurations for this incoming grid device
  useEffect(() => {
    getJson<{ success: boolean; rows?: any[] | null }>(
      `/config/api-sources-map?unitId=${config.deviceId}`
    )
      .then((res) => {
        if (res && res.success && res.rows) {
          const urls: Record<string, string> = {};
          const keys: Record<string, string> = {};
          res.rows.forEach((row: any) => {
            if (row.tagKey) {
              urls[row.tagKey] = row.url || "";
              keys[row.tagKey] = row.jsonKey || "";
            }
          });
          setApiSourceUrls(urls);
          setJsonKeyMap(keys);
        } else {
          // If no custom config in DB, fallback to empty to correctly trigger "BELUM ADA API" or custom defaults
          setApiSourceUrls({});
          setJsonKeyMap({});
        }
      })
      .catch((err) => {
        console.error("Failed to load API sources for Incoming:", err);
        setApiSourceUrls({});
        setJsonKeyMap({});
      });
  }, [config.deviceId]);

  const isPageActive = usePageActive();

  // Poll active URLs
  useEffect(() => {
    let isMounted = true;
    const fetchActiveApiData = async () => {
      if (!isPageActive) return;
      const defaultUrl = DEFAULT_API_URLS[mode] || "";
      const uniqueUrls = Array.from(new Set([...Object.values(apiSourceUrls), defaultUrl].filter((u) => u && u.trim())));
      if (uniqueUrls.length === 0) {
        if (isMounted) setApiLiveData({});
        return;
      }

      const aggregatedData: Record<string, any> = {};
      await Promise.all(
        uniqueUrls.map(async (url) => {
          try {
            const res = await postJson<{ success: boolean; data?: any }>("/config/api-sources/test", {
              url,
              method: "GET"
            });
            if (res && res.success && res.data) {
              aggregatedData[url] = res.data;
            } else {
              aggregatedData[url] = null;
            }
          } catch (err) {
            console.error(`Live API poll error on Incoming for URL ${url}:`, err);
            aggregatedData[url] = null;
          }
        })
      );

      if (isMounted) {
        setApiLiveData(aggregatedData);
      }
    };

    fetchActiveApiData();
    const interval = setInterval(fetchActiveApiData, 30000); // 30s fallback poll (WebSockets handle 1s real-time stream)
    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [apiSourceUrls, mode, isPageActive]);

  // Real-time metrics states
  const [metrics, setMetrics] = useState({
    voltage: 0,
    frequency: 0,
    activePower: 0,
    powerFactor: 0,
    reactivePower: 0,
    apparentPower: 0,
    unbalanceV: 0,
    unbalanceI: 0,
    // Phase values
    vR: 0, vS: 0, vT: 0,
    iR: 0, iS: 0, iT: 0,
    thdV_R: 0, thdV_S: 0, thdV_T: 0,
    thdI_R: 0, thdI_S: 0, thdI_T: 0,
    isConnected: true
  });

  const isPmOnline = useMemo(() => {
    // 1. Check all payloads currently in apiLiveData for an explicit offline status (e.g. Status_PM8000: false)
    for (const payload of Object.values(apiLiveData)) {
      if (payload && typeof payload === "object") {
        const st = checkDeviceStatus(payload, mode);
        if (st === false) return false;
      }
    }

    // 2. Direct default URL check
    const defaultUrl = DEFAULT_API_URLS[mode] || "";
    const activeUrl = Object.keys(apiLiveData).find(u => u && apiLiveData[u]) || defaultUrl;
    const directPayload = apiLiveData[activeUrl] || apiLiveData[defaultUrl];
    if (directPayload) {
      const directSt = checkDeviceStatus(directPayload, mode);
      if (directSt === false) return false;
      if (directSt === true) return true;
    }

    // 3. If API poll explicitly failed for this URL
    if (directPayload === null && !metrics.isConnected) return false;

    // 4. Fallback to metrics socket / REST telemetry status
    return metrics.isConnected;
  }, [mode, apiLiveData, metrics.isConnected]);

interface HourlyTrend5sPoint {
  time: string;
  hour: number;
  voltage: number;
  vR?: number;
  vS?: number;
  vT?: number;
  activePower: number;
  pR?: number;
  pS?: number;
  pT?: number;
  ts?: number;
}

  const [trendHour, setTrendHour] = useState<number>(() => {
    try {
      const wibHourStr = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Jakarta", hour: "2-digit", hour12: false }).format(new Date());
      return parseInt(wibHourStr, 10) % 24;
    } catch {
      return new Date().getHours();
    }
  });
  const [hourlyTrend5s, setHourlyTrend5s] = useState<HourlyTrend5sPoint[]>(() => {
    try {
      const cached = localStorage.getItem(`incoming_trend_1h_${config.deviceId}`);
      if (cached) {
        const parsed = JSON.parse(cached);
        if (Array.isArray(parsed) && parsed.length > 0) {
          const oneHourAgo = Date.now() - 3600 * 1000;
          const fresh = parsed.filter((p: any) => p.ts && Number(p.ts) >= oneHourAgo);
          if (fresh.length > 0) return fresh;
        }
      }
    } catch (e) {}
    return [];
  });

  const lastTrendHourRef = useRef<number>(-1);
  const [zoomTrend, setZoomTrend] = useState<"voltage" | "power" | null>(null);
  const [zoomIndexRange, setZoomIndexRange] = useState<{ min: number; max: number } | null>(null);
  const [zoomRangeY, setZoomRangeY] = useState<{ min: number; max: number } | null>(null);
  const zoomIndexRangeRef = useRef(zoomIndexRange);
  zoomIndexRangeRef.current = zoomIndexRange;
  const zoomRangeYRef = useRef(zoomRangeY);
  zoomRangeYRef.current = zoomRangeY;

  const zoomChartRef = useRef<ChartJS<"line"> | null>(null);
  const zoomContainerRef = useRef<HTMLDivElement>(null);

  const zoomDragRef = useRef<{
    isDragging: boolean;
    mode: "body-pan" | "y-axis" | null;
    startX: number;
    startY: number;
    initMinIdx: number;
    initMaxIdx: number;
    initMinY: number;
    initMaxY: number;
  }>({
    isDragging: false,
    mode: null,
    startX: 0,
    startY: 0,
    initMinIdx: 0,
    initMaxIdx: 0,
    initMinY: 0,
    initMaxY: 0,
  });

  useEffect(() => {
    setZoomIndexRange(null);
    setZoomRangeY(null);
  }, [zoomTrend, mode]);

  // TradingView Style Chart Navigation for Incoming PLN Modal:
  // - LMB Drag: Pan time slice (or stretch vertical scale on left Y-axis)
  // - Mouse Wheel: Zoom time window on body; Zoom vertical height on left Y-axis
  // - Double Click: Reset to Full Auto-Fit View
  useEffect(() => {
    if (!zoomTrend) return;
    const container = zoomContainerRef.current;
    if (!container) return;

    const getChartMetrics = () => {
      const chart = zoomChartRef.current;
      const canvas = chart?.canvas;
      const rect = canvas ? canvas.getBoundingClientRect() : container.getBoundingClientRect();
      const chartArea = chart?.chartArea ?? {
        left: 65,
        right: rect.width - 20,
        top: 30,
        bottom: rect.height - 30,
        width: rect.width - 85,
        height: rect.height - 60,
      };
      return { chart, canvas, rect, chartArea };
    };

    const handleMouseMoveHover = (e: MouseEvent) => {
      if (zoomDragRef.current.isDragging) return;
      const { canvas, rect, chartArea } = getChartMetrics();
      if (!canvas) return;
      const mouseX = e.clientX - rect.left;
      if (mouseX < chartArea.left) {
        canvas.style.cursor = "ns-resize";
        canvas.title = "Scroll atau drag vertikal untuk mengatur tinggi/skala Y";
      } else {
        canvas.style.cursor = "grab";
        canvas.title = "Hold LMB lalu geser untuk navigasi; Scroll untuk zoom waktu";
      }
    };

    const handleWheel = (e: WheelEvent) => {
      e.preventDefault();
      e.stopPropagation();

      const { chart, rect, chartArea } = getChartMetrics();
      const mouseX = e.clientX - rect.left;
      const isYAxisZone = mouseX < chartArea.left;
      const totalPoints = rollingTrendData.labels.length;
      if (totalPoints <= 1) return;

      if (isYAxisZone) {
        setZoomRangeY((prevY) => {
          const curMin = prevY ? prevY.min : (chart?.scales?.y?.min ?? (zoomTrend === "voltage" ? 18 : 0));
          const curMax = prevY ? prevY.max : (chart?.scales?.y?.max ?? (zoomTrend === "voltage" ? 23 : 1500));
          const span = Math.max(0.1, curMax - curMin);

          const mouseY = e.clientY - rect.top;
          const ratioY = Math.max(0, Math.min(1, (chartArea.bottom - mouseY) / Math.max(1, chartArea.height)));
          const anchorVal = curMin + ratioY * span;

          const factor = e.deltaY < 0 ? 0.85 : 1.18;
          const newSpan = Math.max(0.2, span * factor);
          const newMin = anchorVal - ratioY * newSpan;
          const newMax = newMin + newSpan;
          return { min: newMin, max: newMax };
        });
      } else {
        setZoomIndexRange((prevRange) => {
          const curMin = prevRange ? prevRange.min : 0;
          const curMax = prevRange ? prevRange.max : totalPoints;
          const span = Math.max(5, curMax - curMin);
          const factor = e.deltaY < 0 ? 0.82 : 1.22;
          let newSpan = span * factor;
          newSpan = Math.max(5, Math.min(totalPoints, newSpan));

          const plotLeft = chartArea.left;
          const plotWidth = Math.max(10, chartArea.width);
          const ratio = Math.max(0, Math.min(1, (mouseX - plotLeft) / plotWidth));
          const centerIdx = curMin + ratio * span;

          const newMin = Math.max(0, centerIdx - ratio * newSpan);
          const newMax = Math.min(totalPoints, newMin + newSpan);
          return { min: newMin, max: newMax };
        });
      }
    };

    const handleMouseDown = (e: MouseEvent) => {
      if (e.button !== 0) return;
      const { chart, canvas, rect, chartArea } = getChartMetrics();
      const mouseX = e.clientX - rect.left;
      const isYAxisZone = mouseX < chartArea.left;
      const totalPoints = rollingTrendData.labels.length;

      const curMinIdx = zoomIndexRangeRef.current ? zoomIndexRangeRef.current.min : 0;
      const curMaxIdx = zoomIndexRangeRef.current ? zoomIndexRangeRef.current.max : totalPoints;
      const curMinY = zoomRangeYRef.current ? zoomRangeYRef.current.min : (chart?.scales?.y?.min ?? (zoomTrend === "voltage" ? 18 : 0));
      const curMaxY = zoomRangeYRef.current ? zoomRangeYRef.current.max : (chart?.scales?.y?.max ?? (zoomTrend === "voltage" ? 23 : 1500));

      zoomDragRef.current = {
        isDragging: true,
        mode: isYAxisZone ? "y-axis" : "body-pan",
        startX: e.clientX,
        startY: e.clientY,
        initMinIdx: curMinIdx,
        initMaxIdx: curMaxIdx,
        initMinY: curMinY,
        initMaxY: curMaxY,
      };

      if (canvas) {
        canvas.style.cursor = isYAxisZone ? "ns-resize" : "grabbing";
      }
    };

    const handleWindowMouseMove = (e: MouseEvent) => {
      if (!zoomDragRef.current.isDragging) return;
      const { chartArea } = getChartMetrics();
      const { mode, startX, startY, initMinIdx, initMaxIdx, initMinY, initMaxY } = zoomDragRef.current;
      const dx = e.clientX - startX;
      const dy = e.clientY - startY;
      const totalPoints = rollingTrendData.labels.length;

      if (mode === "body-pan") {
        const plotWidth = Math.max(10, chartArea.width);
        const spanIdx = initMaxIdx - initMinIdx;
        const ptsPerPixel = spanIdx / plotWidth;
        const shift = dx * ptsPerPixel;
        let newMin = initMinIdx - shift;
        let newMax = initMaxIdx - shift;
        if (newMin < 0) {
          newMax -= newMin;
          newMin = 0;
        }
        if (newMax > totalPoints) {
          newMin -= (newMax - totalPoints);
          newMax = totalPoints;
          if (newMin < 0) newMin = 0;
        }
        setZoomIndexRange({ min: newMin, max: newMax });

        if (zoomRangeYRef.current) {
          const plotHeight = Math.max(10, chartArea.height);
          const spanY = initMaxY - initMinY;
          const yPerPixel = spanY / plotHeight;
          const shiftY = dy * yPerPixel;
          setZoomRangeY({ min: initMinY + shiftY, max: initMaxY + shiftY });
        }
      } else if (mode === "y-axis") {
        const { rect } = getChartMetrics();
        const plotHeight = Math.max(10, chartArea.height);
        const spanY = Math.max(0.1, initMaxY - initMinY);
        const scaleMultiplier = Math.exp((dy / Math.max(50, plotHeight)) * 1.5);
        const newSpan = Math.max(0.1, spanY * scaleMultiplier);
        const initMouseY = startY - rect.top;
        const anchorRatio = Math.max(0, Math.min(1, (chartArea.bottom - initMouseY) / Math.max(1, chartArea.height)));
        const anchorVal = initMinY + anchorRatio * spanY;
        const newMin = anchorVal - anchorRatio * newSpan;
        const newMax = newMin + newSpan;
        setZoomRangeY({ min: newMin, max: newMax });
      }
    };

    const handleWindowMouseUp = (e: MouseEvent) => {
      if (zoomDragRef.current.isDragging) {
        zoomDragRef.current.isDragging = false;
        const { canvas, rect, chartArea } = getChartMetrics();
        if (canvas) {
          const mouseX = e.clientX - rect.left;
          canvas.style.cursor = mouseX < chartArea.left ? "ns-resize" : "grab";
        }
      }
    };

    const handleDoubleClick = () => {
      setZoomIndexRange(null);
      setZoomRangeY(null);
    };

    container.addEventListener("wheel", handleWheel, { passive: false });
    container.addEventListener("mousemove", handleMouseMoveHover);
    container.addEventListener("mousedown", handleMouseDown);
    container.addEventListener("dblclick", handleDoubleClick);
    window.addEventListener("mousemove", handleWindowMouseMove);
    window.addEventListener("mouseup", handleWindowMouseUp);

    return () => {
      container.removeEventListener("wheel", handleWheel);
      container.removeEventListener("mousemove", handleMouseMoveHover);
      container.removeEventListener("mousedown", handleMouseDown);
      container.removeEventListener("dblclick", handleDoubleClick);
      window.removeEventListener("mousemove", handleWindowMouseMove);
      window.removeEventListener("mouseup", handleWindowMouseUp);
    };
  }, [zoomTrend, rollingTrendData.labels.length]);

  useEffect(() => {
    if (!zoomTrend) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setZoomTrend(null);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [zoomTrend]);

  const voltageStats = useMemo(() => {
    if (!hourlyTrend5s || hourlyTrend5s.length === 0) return null;
    const latestTs = Number(hourlyTrend5s[hourlyTrend5s.length - 1]?.ts) || Date.now();
    const oneHourAgo = latestTs - 3600 * 1000;
    const pts = hourlyTrend5s.filter(p => p.ts && Number(p.ts) >= oneHourAgo && ((p.voltage !== undefined && p.voltage > 0) || (p.vR !== undefined && p.vR > 0)));
    if (pts.length === 0) return null;
    const latest = pts[pts.length - 1];
    const allV = pts.map(p => p.vR !== undefined ? (p.vR + (p.vS || 0) + (p.vT || 0)) / 3 : p.voltage).filter(v => typeof v === "number" && v > 0) as number[];
    const avg = allV.length > 0 ? allV.reduce((a, b) => a + b, 0) / allV.length : 0;
    const min = allV.length > 0 ? Math.min(...allV) : 0;
    const max = allV.length > 0 ? Math.max(...allV) : 0;
    return {
      latestR: latest.vR ?? latest.voltage ?? 0,
      latestS: latest.vS ?? latest.voltage ?? 0,
      latestT: latest.vT ?? latest.voltage ?? 0,
      avg,
      min,
      max,
      count: pts.length
    };
  }, [hourlyTrend5s]);

  const powerStats = useMemo(() => {
    if (!hourlyTrend5s || hourlyTrend5s.length === 0) return null;
    const latestTs = Number(hourlyTrend5s[hourlyTrend5s.length - 1]?.ts) || Date.now();
    const oneHourAgo = latestTs - 3600 * 1000;
    const pts = hourlyTrend5s.filter(p => p.ts && Number(p.ts) >= oneHourAgo && typeof p.activePower === "number");
    if (pts.length === 0) return null;
    const latest = pts[pts.length - 1];
    const allP = pts.map(p => Math.abs(p.activePower!)).filter(v => typeof v === "number") as number[];
    const avg = allP.length > 0 ? allP.reduce((a, b) => a + b, 0) / allP.length : 0;
    const min = allP.length > 0 ? Math.min(...allP) : 0;
    const max = allP.length > 0 ? Math.max(...allP) : 0;
    return {
      latest: Math.abs(latest.activePower ?? 0),
      avg,
      min,
      max,
      count: pts.length
    };
  }, [hourlyTrend5s]);

  // Event & alarm logs
  const [events, setEvents] = useState(MOCK_EVENTS);

  const getApiVal = useCallback((tagKey: string) => {
    // If PM is detected offline, NEVER return stale / cached values
    if (!isPmOnline) {
      return "PM OFFLINE";
    }

    const rawKey = tagKey.includes("/") ? tagKey.split("/")[1] : tagKey;
    const defaultUrl = DEFAULT_API_URLS[mode] || "";
    const url = apiSourceUrls[tagKey] || defaultUrl;
    const jsonKey = jsonKeyMap[tagKey] || DEFAULT_JSON_KEYS[rawKey] || rawKey;

    if (url && apiLiveData[url]) {
      let val = apiLiveData[url][jsonKey];
      if (val === undefined && rawKey === "active_power") {
        val = apiLiveData[url]["Active_Power_Total"] ?? apiLiveData[url]["active_power_total"] ?? apiLiveData[url]["Active_Power"];
      }
      if (val === undefined && rawKey === "voltage") {
        val = apiLiveData[url]["Volt_LL"] ?? apiLiveData[url]["volt_ll"];
      }
      if (val === undefined && (rawKey === "v_r" || rawKey === "volt_ab")) {
        val = apiLiveData[url]["VoltAB"] ?? apiLiveData[url]["volt_ab"] ?? apiLiveData[url]["Volt_AB"];
      }
      if (val === undefined && (rawKey === "v_s" || rawKey === "volt_bc")) {
        val = apiLiveData[url]["VoltBC"] ?? apiLiveData[url]["volt_bc"] ?? apiLiveData[url]["Volt_BC"];
      }
      if (val === undefined && (rawKey === "v_t" || rawKey === "volt_ca")) {
        val = apiLiveData[url]["VoltCA"] ?? apiLiveData[url]["volt_ca"] ?? apiLiveData[url]["Volt_CA"];
      }
      if (val === undefined && rawKey === "unbalance_v") {
        val = apiLiveData[url]["Volatage_Unbalance"] ?? apiLiveData[url]["Voltage_Unbalance"] ?? apiLiveData[url]["voltage_unbalance"] ?? apiLiveData[url]["volatage_unbalance"];
      }
      if (val === undefined && rawKey === "unbalance_i") {
        val = apiLiveData[url]["Current_Umbalance"] ?? apiLiveData[url]["current_umbalance"] ?? apiLiveData[url]["Current_Unbalance"] ?? apiLiveData[url]["current_unbalance"];
      }

      if (val !== undefined && val !== null) {
        // Power parameters (convert Watts to kW/kVAR/kVA if large)
        if (rawKey === "active_power" || rawKey === "reactive_power" || rawKey === "apparent_power") {
          if (typeof val === "number" && val > 10000) val = val / 1000.0;
        }
        // Voltage (convert Volts to kV) - in 20 kV medium voltage system line voltages are used directly
        if ((rawKey === "voltage" || rawKey === "v_r" || rawKey === "v_s" || rawKey === "v_t") && typeof val === "number" && val > 1000) {
          val = val / 1000.0;
        }
        // Unbalances & THD (convert decimal 0.0055 to % for PLN, preserve % for WF1/WF2)
        if (rawKey.startsWith("unbalance_v")) {
          if (mode === "pln" && typeof val === "number" && val < 0.1) {
            val = val * 100.0;
          } else if (typeof val === "number" && val < 0.05) {
            val = val * 100.0;
          }
        } else if (rawKey.startsWith("unbalance_i")) {
          if (mode === "pln" && typeof val === "number" && val < 0.1) {
            val = val * 100.0;
          } else if (typeof val === "number" && val < 0.05) {
            val = val * 100.0;
          }
        } else if (rawKey.startsWith("thd_")) {
          if (mode === "pln" && typeof val === "number" && val < 1.0) {
            val = val * 100.0;
          } else if (typeof val === "number" && val < 0.05) {
            val = val * 100.0;
          }
        }
        // Power factor convert negative to positive
        if (rawKey === "power_factor" && typeof val === "number") {
          val = Math.abs(val);
        }
        return val;
      }
    }

    // If direct live API poll is unavailable for this URL, fallback to backend WebSocket/telemetry metrics first
    if (url && apiLiveData[url] === null && (!metrics || !metrics.isConnected)) {
      return "PM OFFLINE";
    }

    // Fallback to metrics from backend WebSocket
    if (metrics && metrics.isConnected) {
      if (rawKey === "voltage" && metrics.voltage > 0) return metrics.voltage;
      if (rawKey === "frequency" && metrics.frequency > 0) return metrics.frequency;
      if (rawKey === "active_power" && metrics.activePower > 0) return metrics.activePower;
      if (rawKey === "power_factor" && metrics.powerFactor !== 0) return Math.abs(metrics.powerFactor);
      if (rawKey === "reactive_power" && metrics.reactivePower > 0) return metrics.reactivePower;
      if (rawKey === "apparent_power" && metrics.apparentPower > 0) return metrics.apparentPower;
      if (rawKey === "unbalance_v" && metrics.unbalanceV > 0) return metrics.unbalanceV;
      if (rawKey === "unbalance_i" && metrics.unbalanceI > 0) return metrics.unbalanceI;
      if (rawKey === "v_r" && metrics.vR > 0) return metrics.vR;
      if (rawKey === "v_s" && metrics.vS > 0) return metrics.vS;
      if (rawKey === "v_t" && metrics.vT > 0) return metrics.vT;
      if (rawKey === "i_r" && metrics.iR > 0) return metrics.iR;
      if (rawKey === "i_s" && metrics.iS > 0) return metrics.iS;
      if (rawKey === "i_t" && metrics.iT > 0) return metrics.iT;
      if (rawKey === "thd_v_r" && metrics.thdV_R > 0) return metrics.thdV_R;
      if (rawKey === "thd_v_s" && metrics.thdV_S > 0) return metrics.thdV_S;
      if (rawKey === "thd_v_t" && metrics.thdV_T > 0) return metrics.thdV_T;
      if (rawKey === "thd_i_r" && metrics.thdI_R > 0) return metrics.thdI_R;
      if (rawKey === "thd_i_s" && metrics.thdI_S > 0) return metrics.thdI_S;
      if (rawKey === "thd_i_t" && metrics.thdI_T > 0) return metrics.thdI_T;
    }

    if (!url.trim()) return "BELUM ADA API";
    return "PM OFFLINE";
  }, [mode, apiSourceUrls, jsonKeyMap, apiLiveData, metrics, isPmOnline]);

  const isOfflineVal = useCallback((val: any) => {
    return (
      !isPmOnline ||
      val === null ||
      val === undefined ||
      val === "PM OFFLINE" ||
      val === "BELUM ADA API" ||
      val === "API TIDAK TERKIRIM" ||
      val === "Gagal Polling API" ||
      val === "GAGAL POLLING API" ||
      val === "xx"
    );
  }, [isPmOnline]);

  // Load database analytics fallback via dedicated endpoint
  const fetchTelemetry = () => {
    getJson<{ success?: boolean; data?: { hour?: number; points?: any[]; telemetry?: any; pqData?: any } }>(
      `/analytics/electricity/incoming-hourly-trend?deviceId=${config.deviceId}`
    )
      .then((res) => {
        const payload = res?.data;
        const pq = payload?.telemetry?.pqData || payload?.pqData || payload?.telemetry;
        if (pq) {
          const isOffline = pq.pfStatus === "offline" || pq.pfStatus === "disconnected" || pq.status === false;
          setMetrics((prev) => ({
            ...prev,
            voltage: !isOffline && pq.voltage !== undefined && pq.voltage !== null ? pq.voltage : 0,
            frequency: !isOffline && pq.freq !== undefined && pq.freq !== null ? pq.freq : 0,
            activePower: !isOffline && pq.activePower !== undefined && pq.activePower !== null ? pq.activePower : 0,
            powerFactor: !isOffline && pq.pf !== undefined && pq.pf !== null ? pq.pf : 0,
            reactivePower: !isOffline && pq.reactivePower !== undefined && pq.reactivePower !== null ? pq.reactivePower : 0,
            apparentPower: !isOffline && pq.apparentPower !== undefined && pq.apparentPower !== null ? pq.apparentPower : 0,
            unbalanceV: !isOffline && pq.vUnb !== undefined && pq.vUnb !== null ? pq.vUnb : 0,
            unbalanceI: !isOffline && pq.iUnb !== undefined && pq.iUnb !== null ? pq.iUnb : 0,
            vR: !isOffline && pq.vR !== undefined && pq.vR !== null ? pq.vR : 0,
            vS: !isOffline && pq.vS !== undefined && pq.vS !== null ? pq.vS : 0,
            vT: !isOffline && pq.vT !== undefined && pq.vT !== null ? pq.vT : 0,
            iR: !isOffline && pq.iR !== undefined && pq.iR !== null ? pq.iR : 0,
            iS: !isOffline && pq.iS !== undefined && pq.iS !== null ? pq.iS : 0,
            iT: !isOffline && pq.iT !== undefined && pq.iT !== null ? pq.iT : 0,
            thdV_R: !isOffline && pq.thdV_R !== undefined && pq.thdV_R !== null ? pq.thdV_R : 0,
            thdV_S: !isOffline && pq.thdV_S !== undefined && pq.thdV_S !== null ? pq.thdV_S : 0,
            thdV_T: !isOffline && pq.thdV_T !== undefined && pq.thdV_T !== null ? pq.thdV_T : 0,
            thdI_R: !isOffline && pq.thdI_R !== undefined && pq.thdI_R !== null ? pq.thdI_R : 0,
            thdI_S: !isOffline && pq.thdI_S !== undefined && pq.thdI_S !== null ? pq.thdI_S : 0,
            thdI_T: !isOffline && pq.thdI_T !== undefined && pq.thdI_T !== null ? pq.thdI_T : 0,
            isConnected: !isOffline && pq.pfStatus === "connected" && pq.status !== false
          }));
        }
        const pts = payload?.points || (payload as any)?.charts?.hourlyTrend5s;
        if (Array.isArray(pts)) {
          const currentHour = typeof payload?.hour === "number" ? payload.hour : trendHour;
          setTrendHour(currentHour);
          lastTrendHourRef.current = currentHour;
          setHourlyTrend5s((prev) => {
            const map = new Map<number, any>();
            for (const p of pts) {
              if (p && p.ts) {
                const bucket = Math.round(Number(p.ts) / 3000) * 3000;
                map.set(bucket, p);
              }
            }
            for (const p of prev) {
              if (p && p.ts) {
                const bucket = Math.round(Number(p.ts) / 3000) * 3000;
                if (!map.has(bucket) || (Number(p.ts) > (Number(pts[pts.length - 1]?.ts) || 0))) {
                  map.set(bucket, p);
                }
              }
            }
            const merged = Array.from(map.values()).sort((a, b) => (Number(a.ts) || 0) - (Number(b.ts) || 0));
            const maxTs = merged[merged.length - 1]?.ts || Date.now();
            const oneHourAgo = maxTs - 3600 * 1000;
            const filtered = merged.filter((p) => (Number(p.ts) || 0) >= oneHourAgo);
            const trimmed = filtered.length > 1200 ? filtered.slice(filtered.length - 1200) : filtered;
            try {
              localStorage.setItem(`incoming_trend_1h_${config.deviceId}`, JSON.stringify(trimmed));
            } catch (e) {}
            return trimmed;
          });
        }
        setLoading(false);
      })
      .catch((err) => {
        console.error(`Failed to load incoming ${mode} telemetry`, err);
        setLoading(false);
      });
  };

  // Reset/update metrics when config changes
  useEffect(() => {
    setLoading(true);
    const safetyTimer = setTimeout(() => {
      setLoading(false);
    }, 2500);

    try {
      const cached = localStorage.getItem(`incoming_trend_1h_${config.deviceId}`);
      if (cached) {
        const parsed = JSON.parse(cached);
        if (Array.isArray(parsed) && parsed.length > 0) {
          const oneHourAgo = Date.now() - 3600 * 1000;
          const fresh = parsed.filter((p: any) => p.ts && Number(p.ts) >= oneHourAgo);
          setHourlyTrend5s(fresh);
        } else {
          setHourlyTrend5s([]);
        }
      } else {
        setHourlyTrend5s([]);
      }
    } catch (e) {
      setHourlyTrend5s([]);
    }
    lastTrendHourRef.current = new Date().getHours();
    setMetrics({
      voltage: config.voltageBase,
      frequency: 0,
      activePower: config.activePowerBase,
      powerFactor: config.pfBase,
      reactivePower: config.reactiveBase,
      apparentPower: config.apparentBase,
      unbalanceV: config.unbalanceVBase,
      unbalanceI: config.unbalanceIBase,
      vR: 0,
      vS: 0,
      vT: 0,
      iR: 0,
      iS: 0,
      iT: 0,
      thdV_R: 0, thdV_S: 0, thdV_T: 0,
      thdI_R: 0, thdI_S: 0, thdI_T: 0,
      isConnected: true
    });

    return () => clearTimeout(safetyTimer);
  }, [config]);

  useEffect(() => {
    if (!isPageActive) return;
    fetchTelemetry();
    // Light fallback every 60 seconds (real-time stream arrives via WebSocket every 1-5 seconds)
    const interval = setInterval(() => {
      if (isPageActive) fetchTelemetry();
    }, 60000);
    return () => clearInterval(interval);
  }, [config, isPageActive]);

  // Handle socket updates fallback
  useEffect(() => {
    const socket = getSocket();
    
    const handleLiveUpdate = (payload: any) => {
      if (payload && payload.deviceId === config.deviceId) {
        setLoading(false);
        const isOffline = payload.online === false || payload.status === false || payload.pqData?.pfStatus === "offline" || payload.pqData?.status === false || payload.error;
        if (isOffline) {
          setMetrics((prev) => ({
            ...prev,
            voltage: 0,
            frequency: 0,
            activePower: 0,
            powerFactor: 0,
            reactivePower: 0,
            apparentPower: 0,
            unbalanceV: 0,
            unbalanceI: 0,
            vR: 0, vS: 0, vT: 0,
            iR: 0, iS: 0, iT: 0,
            thdV_R: 0, thdV_S: 0, thdV_T: 0,
            thdI_R: 0, thdI_S: 0, thdI_T: 0,
            isConnected: false
          }));
          return;
        }
        if (payload.pqData) {
          const pq = payload.pqData;
          setMetrics((prev) => ({
            ...prev,
            voltage: pq.voltage !== undefined ? pq.voltage : prev.voltage,
            frequency: pq.freq !== undefined ? pq.freq : prev.frequency,
            activePower: pq.activePower !== undefined ? pq.activePower : prev.activePower,
            powerFactor: pq.pf !== undefined && pq.pf !== null ? Math.abs(pq.pf) : prev.powerFactor,
            reactivePower: pq.reactivePower !== undefined ? pq.reactivePower : prev.reactivePower,
            apparentPower: pq.apparentPower !== undefined ? pq.apparentPower : prev.apparentPower,
            unbalanceV: pq.vUnb !== undefined ? pq.vUnb : prev.unbalanceV,
            unbalanceI: pq.iUnb !== undefined ? pq.iUnb : prev.unbalanceI,
            vR: pq.vR !== undefined ? pq.vR : prev.vR,
            vS: pq.vS !== undefined ? pq.vS : prev.vS,
            vT: pq.vT !== undefined ? pq.vT : prev.vT,
            iR: pq.iR !== undefined ? pq.iR : prev.iR,
            iS: pq.iS !== undefined ? pq.iS : prev.iS,
            iT: pq.iT !== undefined ? pq.iT : prev.iT,
            thdV_R: pq.thdV_R !== undefined ? pq.thdV_R : prev.thdV_R,
            thdV_S: pq.thdV_S !== undefined ? pq.thdV_S : prev.thdV_S,
            thdV_T: pq.thdV_T !== undefined ? pq.thdV_T : prev.thdV_T,
            thdI_R: pq.thdI_R !== undefined ? pq.thdI_R : prev.thdI_R,
            thdI_S: pq.thdI_S !== undefined ? pq.thdI_S : prev.thdI_S,
            thdI_T: pq.thdI_T !== undefined ? pq.thdI_T : prev.thdI_T,
            isConnected: pq.pfStatus !== "offline" && pq.pfStatus !== "disconnected" && pq.status !== false
          }));
        }
      }
    };

    const handleTrend3s = (payload: any) => {
      if (payload && payload.deviceId === config.deviceId && payload.point) {
        const pt = payload.point;
        const currentHour = typeof payload.hour === "number" ? payload.hour : trendHour;
        setTrendHour(currentHour);
        lastTrendHourRef.current = currentHour;

        setHourlyTrend5s((prev) => {
          const ptTs = Number(pt.ts) || Date.now();
          const ptBucket = Math.round(ptTs / 3000) * 3000;
          const updated = [...prev];
          const lastP = updated[updated.length - 1];
          if (lastP && lastP.ts && Math.round(Number(lastP.ts) / 3000) * 3000 === ptBucket) {
            updated[updated.length - 1] = pt;
          } else {
            updated.push(pt);
          }
          const latestTs = Number(updated[updated.length - 1]?.ts) || ptTs;
          const oneHourAgo = latestTs - 3600 * 1000;
          const filtered = updated.filter((p) => (Number(p.ts) || 0) >= oneHourAgo);
          const trimmed = filtered.length > 1200 ? filtered.slice(filtered.length - 1200) : filtered;
          try {
            localStorage.setItem(`incoming_trend_1h_${config.deviceId}`, JSON.stringify(trimmed));
          } catch (e) {}
          return trimmed;
        });
      }
    };

    const handleMinuteUpdate = () => {
      fetchTelemetry();
    };

    socket.on("electricity:minute_update", handleMinuteUpdate);
    socket.on("historian:minute_update", handleMinuteUpdate);
    socket.on("electricity:live_update", handleLiveUpdate);
    socket.on("electricity:trend_3s", handleTrend3s);

    return () => {
      socket.off("electricity:minute_update", handleMinuteUpdate);
      socket.off("historian:minute_update", handleMinuteUpdate);
      socket.off("electricity:live_update", handleLiveUpdate);
      socket.off("electricity:trend_3s", handleTrend3s);
    };
  }, [config.deviceId]);

  const prefix = mode === "pln" ? "pln" : mode === "fact1" ? "wf1" : "wf2";

  const liveMetrics = useMemo(() => {
    if (!isPmOnline) {
      return {
        voltage: null,
        frequency: null,
        activePower: null,
        powerFactor: null,
        reactivePower: null,
        apparentPower: null,
        unbalanceV: null,
        unbalanceI: null,
        vR: null,
        vS: null,
        vT: null,
        iR: null,
        iS: null,
        iT: null,
        thdV_R: null,
        thdV_S: null,
        thdV_T: null,
        thdI_R: null,
        thdI_S: null,
        thdI_T: null,
        isConnected: false
      };
    }

    const hasLiveMetrics = metrics.isConnected && (metrics.voltage > 0 || metrics.frequency > 0);

    const pickVal = (tag: string, metricVal: any) => {
      // 1. Prioritize real-time 1-second WebSocket telemetry stream when available
      if (hasLiveMetrics && metricVal !== undefined && metricVal !== null) {
        return metricVal;
      }
      // 2. Fall back to direct API data if available
      const apiV = getApiVal(`${prefix}/${tag}`);
      if (apiV !== "BELUM ADA API" && apiV !== "API TIDAK TERKIRIM" && apiV !== "GAGAL POLLING API" && apiV !== "Gagal Polling API" && apiV !== "xx" && apiV !== "PM OFFLINE") {
        return apiV;
      }
      // 3. Fall back to socket metricVal
      return metricVal;
    };

    return {
      voltage: pickVal("voltage", metrics.voltage),
      frequency: pickVal("frequency", metrics.frequency),
      activePower: pickVal("active_power", metrics.activePower),
      powerFactor: pickVal("power_factor", metrics.powerFactor),
      reactivePower: pickVal("reactive_power", metrics.reactivePower),
      apparentPower: pickVal("apparent_power", metrics.apparentPower),
      unbalanceV: pickVal("unbalance_v", metrics.unbalanceV),
      unbalanceI: pickVal("unbalance_i", metrics.unbalanceI),
      vR: pickVal("v_r", metrics.vR),
      vS: pickVal("v_s", metrics.vS),
      vT: pickVal("v_t", metrics.vT),
      iR: pickVal("i_r", metrics.iR),
      iS: pickVal("i_s", metrics.iS),
      iT: pickVal("i_t", metrics.iT),
      thdV_R: pickVal("thd_v_r", metrics.thdV_R),
      thdV_S: pickVal("thd_v_s", metrics.thdV_S),
      thdV_T: pickVal("thd_v_t", metrics.thdV_T),
      thdI_R: pickVal("thd_i_r", metrics.thdI_R),
      thdI_S: pickVal("thd_i_s", metrics.thdI_S),
      thdI_T: pickVal("thd_i_t", metrics.thdI_T),
      isConnected: true
    };
  }, [prefix, getApiVal, metrics, isPmOnline]);

  const renderMetricVal = useCallback((val: any, formatFn: (v: number) => string) => {
    if (loading) {
      return <span className="h-5 w-20 bg-slate-200 dark:bg-slate-700/60 rounded-md animate-pulse inline-block align-middle" />;
    }
    if (!isPmOnline || val === "PM OFFLINE") {
      return (
        <div className="flex items-baseline gap-1.5">
          <span className="text-xl md:text-2xl font-black font-mono text-slate-400 dark:text-slate-600">—</span>
          <span className="text-[9px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded bg-rose-500/10 text-rose-500 border border-rose-500/20">
            PM MATI
          </span>
        </div>
      );
    }
    if (val === "BELUM ADA API") {
      return <span className="text-red-500 text-xs font-extrabold font-mono uppercase tracking-wider">BELUM ADA API</span>;
    }
    if (val === "API TIDAK TERKIRIM" || val === "Gagal Polling API" || val === "GAGAL POLLING API" || val === "xx") {
      return <span className="text-amber-500 text-[10px] font-extrabold font-mono uppercase tracking-wider">GAGAL POLLING API</span>;
    }
    if (val === null || val === undefined) {
      return (
        <div className="flex items-baseline gap-1.5">
          <span className="text-xl md:text-2xl font-black font-mono text-slate-400 dark:text-slate-600">—</span>
          <span className="text-[9px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded bg-rose-500/10 text-rose-500 border border-rose-500/20">
            PM MATI
          </span>
        </div>
      );
    }
    const num = Number(val);
    if (isNaN(num)) {
      return <span className="text-amber-500 text-[10px] font-extrabold font-mono uppercase tracking-wider">GAGAL POLLING API</span>;
    }
    return formatFn(num);
  }, [loading, isPmOnline]);

  const renderTableStatus = useCallback((isOffline: boolean, isNormal: boolean, overlimitLabel = "⚠ Overlimit") => {
    if (loading) {
      return <span className="inline-block w-16 h-4 bg-slate-200 dark:bg-slate-700/60 rounded animate-pulse" />;
    }
    if (!isPmOnline || isOffline) {
      return <span className="px-2 py-0.5 rounded text-[9px] font-black uppercase border bg-rose-500/10 text-rose-500 border-rose-500/20">✕ PM Mati</span>;
    }
    if (isNormal) {
      return <span className="px-2.5 py-0.5 rounded text-[10px] font-extrabold border bg-emerald-500/10 text-emerald-500 border-emerald-500/20">✓ Normal</span>;
    }
    return <span className="px-2.5 py-0.5 rounded text-[10px] font-extrabold border bg-red-500/10 text-red-500 border-red-500/20">{overlimitLabel}</span>;
  }, [loading, isPmOnline]);

  // Averages and stats helpers for Phase details
  const statsV = useMemo(() => {
    const vals = [liveMetrics.vR, liveMetrics.vS, liveMetrics.vT].map(v => isOfflineVal(v) ? 0 : Number(v) || 0);
    const avg = vals.reduce((a, b) => a + b, 0) / 3;
    return { avg, min: Math.min(...vals), max: Math.max(...vals) };
  }, [liveMetrics.vR, liveMetrics.vS, liveMetrics.vT, isOfflineVal]);

  const statsI = useMemo(() => {
    const vals = [liveMetrics.iR, liveMetrics.iS, liveMetrics.iT].map(v => isOfflineVal(v) ? 0 : Number(v) || 0);
    const avg = vals.reduce((a, b) => a + b, 0) / 3;
    return { avg, min: Math.min(...vals), max: Math.max(...vals) };
  }, [liveMetrics.iR, liveMetrics.iS, liveMetrics.iT, isOfflineVal]);

  const statsThdV = useMemo(() => {
    const vals = [liveMetrics.thdV_R, liveMetrics.thdV_S, liveMetrics.thdV_T].map(v => isOfflineVal(v) ? 0 : Number(v) || 0);
    const avg = vals.reduce((a, b) => a + b, 0) / 3;
    return { avg, min: Math.min(...vals), max: Math.max(...vals) };
  }, [liveMetrics.thdV_R, liveMetrics.thdV_S, liveMetrics.thdV_T, isOfflineVal]);

  const statsThdI = useMemo(() => {
    const vals = [liveMetrics.thdI_R, liveMetrics.thdI_S, liveMetrics.thdI_T].map(v => isOfflineVal(v) ? 0 : Number(v) || 0);
    const avg = vals.reduce((a, b) => a + b, 0) / 3;
    return { avg, min: Math.min(...vals), max: Math.max(...vals) };
  }, [liveMetrics.thdI_R, liveMetrics.thdI_S, liveMetrics.thdI_T, isOfflineVal]);

  // Radar PQ index chart data
  const radarData = useMemo(() => {
    if (!isPmOnline) {
      return {
        labels: ["Voltage", "Current", "PF", "Freq", "THD-V", "THD-I"],
        datasets: [
          {
            label: "Daya Aktual",
            data: [0, 0, 0, 0, 0, 0],
            backgroundColor: "rgba(244, 63, 94, 0.08)",
            borderColor: "#f43f5e",
            borderWidth: 1.5,
            pointBackgroundColor: "#f43f5e",
            pointBorderColor: "#fff",
            pointHoverBackgroundColor: "#fff",
            pointHoverBorderColor: "#f43f5e"
          }
        ]
      };
    }
    const numVoltage = isOfflineVal(liveMetrics.voltage) ? 0 : Number(liveMetrics.voltage) || 0;
    const numPf = isOfflineVal(liveMetrics.powerFactor) ? 0 : Number(liveMetrics.powerFactor) || 0;
    const numFrequency = isOfflineVal(liveMetrics.frequency) ? 0 : Number(liveMetrics.frequency) || 0;
    const avgCurrent = statsI.avg;
    const avgThdV = statsThdV.avg;
    const avgThdI = statsThdI.avg;
    return {
      labels: ["Voltage", "Current", "PF", "Freq", "THD-V", "THD-I"],
      datasets: [
        {
          label: "Daya Aktual",
          data: [
            config.voltageBase > 0 ? (numVoltage / config.voltageBase) * 100 : 0,
            avgCurrent > 0 ? 95 : 0,
            numPf * 100,
            (numFrequency / 50) * 100,
            Math.max(0, 100 - avgThdV),
            Math.max(0, 100 - avgThdI)
          ],
          backgroundColor: "rgba(56, 189, 248, 0.25)",
          borderColor: "#38bdf8",
          borderWidth: 1.5,
          pointBackgroundColor: "#38bdf8",
          pointBorderColor: "#fff",
          pointHoverBackgroundColor: "#fff",
          pointHoverBorderColor: "#38bdf8"
        }
      ]
    };
  }, [liveMetrics, statsI.avg, statsThdV.avg, statsThdI.avg, config.voltageBase, isOfflineVal, isPmOnline]);

  const isConnected = isPmOnline && (!isOfflineVal(liveMetrics.voltage) || !isOfflineVal(liveMetrics.activePower));
  const radarOptions: any = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false }
    },
    scales: {
      r: {
        grid: { color: isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.06)" },
        angleLines: { color: isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.06)" },
        pointLabels: {
          color: isDark ? "#94a3b8" : "#475569",
          font: { size: 10, weight: "700" }
        },
        ticks: { display: false }
      }
    }
  };

  // Continuous 1-Hour Rolling 3-Second Window (FIFO window derived directly from telemetry stream)
  const rollingTrendData = useMemo(() => {
    if (!hourlyTrend5s || hourlyTrend5s.length === 0) {
      return {
        labels: [],
        vRData: [],
        vSData: [],
        vTData: [],
        activePowerData: [],
        rangeLabel: "--:-- - --:--"
      };
    }

    // Sort strictly chronological
    const sorted = [...hourlyTrend5s].sort((a, b) => (Number(a.ts) || 0) - (Number(b.ts) || 0));
    // Keep strictly up to 1200 points (1 hour at 3s intervals)
    const windowPoints = sorted.length > 1200 ? sorted.slice(sorted.length - 1200) : sorted;

    const labels: string[] = [];
    const vRData: (number | null)[] = [];
    const vSData: (number | null)[] = [];
    const vTData: (number | null)[] = [];
    const activePowerData: (number | null)[] = [];

    for (let i = 0; i < windowPoints.length; i++) {
      const pt = windowPoints[i];
      const prevPt = i > 0 ? windowPoints[i - 1] : null;

      // If there is an actual data outage gap (> 15 seconds) between consecutive records, insert a break
      if (prevPt && pt.ts && prevPt.ts && (Number(pt.ts) - Number(prevPt.ts) > 15000)) {
        labels.push("");
        vRData.push(null);
        vSData.push(null);
        vTData.push(null);
        activePowerData.push(null);
      }

      labels.push(pt.time || "");

      const vr = pt.vR !== undefined && pt.vR > 0 ? pt.vR : (pt.voltage && pt.voltage > 0 ? pt.voltage : null);
      const vs = pt.vS !== undefined && pt.vS > 0 ? pt.vS : (pt.voltage && pt.voltage > 0 ? pt.voltage : null);
      const vt = pt.vT !== undefined && pt.vT > 0 ? pt.vT : (pt.voltage && pt.voltage > 0 ? pt.voltage : null);
      vRData.push(vr !== null ? Number(vr.toFixed(3)) : null);
      vSData.push(vs !== null ? Number(vs.toFixed(3)) : null);
      vTData.push(vt !== null ? Number(vt.toFixed(3)) : null);

      const ap = typeof pt.activePower === "number" ? Math.abs(Number(pt.activePower.toFixed(1))) : null;
      activePowerData.push(ap);
    }

    const startLabel = windowPoints[0]?.time?.substring(0, 5) || "--:--";
    const endLabel = windowPoints[windowPoints.length - 1]?.time?.substring(0, 5) || "--:--";
    const rangeLabel = `${startLabel} - ${endLabel}`;

    return {
      labels,
      vRData,
      vSData,
      vTData,
      activePowerData,
      rangeLabel
    };
  }, [hourlyTrend5s]);

  // 1-Hour Rolling 5-Second Line Trend Data - 3 Lines (Fasa R, S, T)
  const voltageTrendData = useMemo(() => {
    return {
      labels: rollingTrendData.labels,
      datasets: [
        {
          label: "Fasa R (kV)",
          data: rollingTrendData.vRData,
          borderColor: "#f43f5e",
          backgroundColor: "rgba(244, 63, 94, 0.05)",
          fill: false,
          tension: 0.2,
          borderWidth: 1.8,
          pointRadius: 0,
          pointHoverRadius: 4,
          pointBackgroundColor: "#f43f5e",
          pointBorderColor: isDark ? "#0f172a" : "#ffffff",
          pointBorderWidth: 1.5,
          spanGaps: true
        },
        {
          label: "Fasa S (kV)",
          data: rollingTrendData.vSData,
          borderColor: "#f59e0b",
          backgroundColor: "rgba(245, 158, 11, 0.05)",
          fill: false,
          tension: 0.2,
          borderWidth: 1.8,
          pointRadius: 0,
          pointHoverRadius: 4,
          pointBackgroundColor: "#f59e0b",
          pointBorderColor: isDark ? "#0f172a" : "#ffffff",
          pointBorderWidth: 1.5,
          spanGaps: true
        },
        {
          label: "Fasa T (kV)",
          data: rollingTrendData.vTData,
          borderColor: "#3b82f6",
          backgroundColor: "rgba(59, 130, 246, 0.05)",
          fill: false,
          tension: 0.2,
          borderWidth: 1.8,
          pointRadius: 0,
          pointHoverRadius: 4,
          pointBackgroundColor: "#3b82f6",
          pointBorderColor: isDark ? "#0f172a" : "#ffffff",
          pointBorderWidth: 1.5,
          spanGaps: true
        }
      ]
    };
  }, [rollingTrendData, isDark]);

  // Strictly 1 single line for Active Power trend across Incoming PLN, WF1, and WF2
  const activePowerTrendData = useMemo(() => {
    return {
      labels: rollingTrendData.labels,
      datasets: [
        {
          label: "Active Power (kW)",
          data: rollingTrendData.activePowerData,
          borderColor: "#10b981",
          backgroundColor: "rgba(16, 185, 129, 0.08)",
          fill: true,
          tension: 0.2,
          borderWidth: 2,
          pointRadius: 0,
          pointHoverRadius: 4,
          pointBackgroundColor: "#10b981",
          pointBorderColor: isDark ? "#0f172a" : "#ffffff",
          pointBorderWidth: 1.5,
          spanGaps: true
        }
      ]
    };
  }, [rollingTrendData, isDark]);

  // Sliced datasets for Modal Zoom with dynamic TradingView Navigation
  const modalRollingTrendData = useMemo(() => {
    const total = rollingTrendData.labels.length;
    let startIdx = 0;
    let endIdx = total;

    if (zoomIndexRange !== null && total > 0) {
      startIdx = Math.max(0, Math.min(total - 5, Math.round(zoomIndexRange.min)));
      endIdx = Math.min(total, Math.max(startIdx + 5, Math.round(zoomIndexRange.max)));
    }

    const labels = rollingTrendData.labels.slice(startIdx, endIdx);
    const vRData = rollingTrendData.vRData.slice(startIdx, endIdx);
    const vSData = rollingTrendData.vSData.slice(startIdx, endIdx);
    const vTData = rollingTrendData.vTData.slice(startIdx, endIdx);
    const activePowerData = rollingTrendData.activePowerData.slice(startIdx, endIdx);
    const startLabel = labels[0]?.substring(0, 5) || "--:--";
    const endLabel = labels[labels.length - 1]?.substring(0, 5) || "--:--";
    const rangeLabel = `${startLabel} - ${endLabel}`;

    return {
      labels,
      vRData,
      vSData,
      vTData,
      activePowerData,
      rangeLabel,
      isCustom: zoomIndexRange !== null || zoomRangeY !== null
    };
  }, [rollingTrendData, zoomIndexRange, zoomRangeY]);

  const modalVoltageTrendData = useMemo(() => {
    return {
      labels: modalRollingTrendData.labels,
      datasets: [
        {
          label: "Fasa R (kV)",
          data: modalRollingTrendData.vRData,
          borderColor: "#f43f5e",
          backgroundColor: "rgba(244, 63, 94, 0.05)",
          fill: false,
          tension: 0.2,
          borderWidth: 1.8,
          pointRadius: 0,
          pointHoverRadius: 4,
          pointBackgroundColor: "#f43f5e",
          pointBorderColor: isDark ? "#0f172a" : "#ffffff",
          pointBorderWidth: 1.5,
          spanGaps: true
        },
        {
          label: "Fasa S (kV)",
          data: modalRollingTrendData.vSData,
          borderColor: "#f59e0b",
          backgroundColor: "rgba(245, 158, 11, 0.05)",
          fill: false,
          tension: 0.2,
          borderWidth: 1.8,
          pointRadius: 0,
          pointHoverRadius: 4,
          pointBackgroundColor: "#f59e0b",
          pointBorderColor: isDark ? "#0f172a" : "#ffffff",
          pointBorderWidth: 1.5,
          spanGaps: true
        },
        {
          label: "Fasa T (kV)",
          data: modalRollingTrendData.vTData,
          borderColor: "#3b82f6",
          backgroundColor: "rgba(59, 130, 246, 0.05)",
          fill: false,
          tension: 0.2,
          borderWidth: 1.8,
          pointRadius: 0,
          pointHoverRadius: 4,
          pointBackgroundColor: "#3b82f6",
          pointBorderColor: isDark ? "#0f172a" : "#ffffff",
          pointBorderWidth: 1.5,
          spanGaps: true
        }
      ]
    };
  }, [modalRollingTrendData, isDark]);

  const modalActivePowerTrendData = useMemo(() => {
    return {
      labels: modalRollingTrendData.labels,
      datasets: [
        {
          label: "Active Power (kW)",
          data: modalRollingTrendData.activePowerData,
          borderColor: "#10b981",
          backgroundColor: "rgba(16, 185, 129, 0.08)",
          fill: true,
          tension: 0.2,
          borderWidth: 2,
          pointRadius: 0,
          pointHoverRadius: 4,
          pointBackgroundColor: "#10b981",
          pointBorderColor: isDark ? "#0f172a" : "#ffffff",
          pointBorderWidth: 1.5,
          spanGaps: true
        }
      ]
    };
  }, [modalRollingTrendData, isDark]);

  const lineOptions = (unit: "kV" | "kW", isPower: boolean = false, isModal: boolean = false) => ({
    responsive: true,
    maintainAspectRatio: false,
    animation: false as const,
    interaction: {
      mode: "index" as const,
      intersect: false
    },
    plugins: {
      legend: {
        display: true,
        position: "top" as const,
        align: "end" as const,
        labels: {
          boxWidth: isModal ? 10 : 8,
          boxHeight: isModal ? 10 : 8,
          usePointStyle: true,
          pointStyle: "circle",
          color: isDark ? "#94a3b8" : "#475569",
          font: { size: isModal ? 11 : 9.5, weight: "bold" as const },
          padding: isModal ? 12 : 8
        }
      },
      title: {
        display: false
      },
      tooltip: {
        enabled: true,
        backgroundColor: isDark ? "rgba(15, 23, 42, 0.95)" : "rgba(255, 255, 255, 0.98)",
        titleColor: isDark ? "#f8fafc" : "#0f172a",
        bodyColor: isDark ? "#cbd5e1" : "#334155",
        borderColor: isDark ? "rgba(255, 255, 255, 0.12)" : "rgba(0, 0, 0, 0.1)",
        borderWidth: 1,
        padding: isModal ? 10 : 8,
        displayColors: true,
        boxWidth: 8,
        boxHeight: 8,
        usePointStyle: true,
        callbacks: {
          title: (items: any[]) => {
            if (!items.length) return "";
            return `Waktu: ${items[0].label}`;
          },
          label: (context: any) => {
            const val = context.parsed.y;
            if (val === null || val === undefined) return ` ${context.dataset.label}: -`;
            const decimals = unit === "kV" ? 3 : 1;
            return ` ${context.dataset.label}: ${val.toFixed(decimals)} ${unit}`;
          },
          footer: (items: any[]) => {
            if (!items.length || isPower) return "";
            const valid = items.filter((it: any) => typeof it.parsed?.y === "number" && !isNaN(it.parsed.y));
            if (!valid.length) return "";
            const total = valid.reduce((acc: number, it: any) => acc + it.parsed.y, 0);
            const avg = total / valid.length;
            return `Rata-rata: ${avg.toFixed(3)} kV`;
          }
        }
      }
    },
    scales: {
      x: {
        grid: { display: false },
        ticks: {
          color: "#64748b",
          font: { size: isModal ? 10 : 8.5 },
          maxTicksLimit: isModal ? 25 : 13,
          autoSkip: true,
          callback: function (val: any, index: number): string {
            const activeLabels = isModal ? modalRollingTrendData.labels : rollingTrendData.labels;
            const raw = (this as any)?.getLabelForValue ? (this as any).getLabelForValue(val) : activeLabels[index];
            if (typeof raw === "string" && raw.length >= 5) {
              return isModal && raw.length >= 8 ? raw : raw.substring(0, 5);
            }
            return String(raw || "");
          }
        }
      },
      y: {
        beginAtZero: false,
        min: isModal && zoomRangeY ? zoomRangeY.min : undefined,
        max: isModal && zoomRangeY ? zoomRangeY.max : undefined,
        grace: isPower ? "10%" : "5%",
        grid: { color: isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.04)" },
        ticks: {
          color: "#64748b",
          font: { size: isModal ? 10 : 8.5 },
          callback: function (val: any) {
            if (typeof val === "number") {
              const formatted = isPower ? Math.round(val).toLocaleString() : val.toFixed(2);
              return `${formatted} ${unit}`;
            }
            return val;
          }
        }
      }
    }
  });

  return (
    <div className="space-y-6">
      {/* HEADER SECTION */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <PageHeader
          title={config.title}
          description={`Monitoring real-time parameter kelistrikan ${config.title} - Update setiap 3 detik`}
        />
        <div className="flex flex-wrap items-center gap-2 sm:gap-3">
          {canAccessConfig && (
            <>
              <button
                onClick={() => setShowConfigPanel(true)}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition shadow-sm"
              >
                🔌 API Sources Config
              </button>
              <button
                onClick={handleOpenConfig}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-xs font-bold text-slate-600 dark:text-slate-300 transition border border-slate-200 dark:border-slate-700 shadow-sm"
              >
                ⚙️ Config Standar
              </button>
            </>
          )}
          {loading ? (
            <span className="px-3 py-1.5 rounded-full text-xs font-extrabold uppercase flex items-center gap-1.5 border bg-sky-500/10 text-sky-500 border-sky-500/20 animate-pulse">
              <span className="h-2 w-2 rounded-full bg-sky-500 animate-ping" />
              MEMUAT DATA...
            </span>
          ) : !isPmOnline ? (
            <span className="px-3 py-1.5 rounded-full text-xs font-black uppercase flex items-center gap-1.5 border bg-rose-500/15 text-rose-500 border-rose-500/30 shadow-sm">
              <span className="h-2 w-2 rounded-full bg-rose-500 animate-pulse" />
              ● {config.pmModel} MATI (OFFLINE)
            </span>
          ) : (
            <span className={`px-3 py-1.5 rounded-full text-xs font-extrabold uppercase flex items-center gap-1.5 border transition-colors duration-300 ${
              isConnected
                ? "bg-emerald-500/10 text-emerald-500 border-emerald-500/20"
                : "bg-amber-500/10 text-amber-500 border-amber-500/20"
            }`}>
              <span className={`h-2 w-2 rounded-full animate-pulse ${
                isConnected ? "bg-emerald-500" : "bg-amber-500"
              }`} />
              {isConnected ? config.connectedLabel : "GAGAL POLLING API"}
            </span>
          )}
        </div>
      </div>

      {/* ═══════════ PM OFFLINE WARNING BANNER ═══════════ */}
      {!loading && !isPmOnline && (
        <div className="rounded-2xl border border-rose-500/30 bg-rose-500/10 dark:bg-rose-950/20 p-4 flex items-center gap-3.5 shadow-sm text-rose-600 dark:text-rose-400">
          <div className="p-2.5 rounded-xl bg-rose-500/20 text-rose-600 dark:text-rose-400 shrink-0">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-xs font-black uppercase tracking-wider">STATUS POWER METER: MATI / OFFLINE</span>
              <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-rose-500/20 border border-rose-500/30">Status: false</span>
            </div>
            <p className="text-[11px] font-medium text-rose-600/90 dark:text-rose-400/90 mt-0.5">
              Power meter {config.pmModel} pada {config.title} terdeteksi offline / tidak aktif. Seluruh data telemetri dinonaktifkan untuk mencegah penayangan data beku (stale).
            </p>
          </div>
        </div>
      )}

      {/* ═══════════ SECTION A: SIX METRIC CARDS ═══════════ */}
      <section className="grid gap-4 grid-cols-2 md:grid-cols-3 lg:grid-cols-6">
        {/* Tegangan */}
        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-400 dark:text-slate-500">
            <span className="text-[10px] font-extrabold uppercase tracking-wider">Tegangan</span>
            <svg className="h-4 w-4 text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
          </div>
          <div className="mt-4">
            <div className="text-base md:text-xl font-extrabold font-mono text-slate-800 dark:text-white">
              {renderMetricVal(liveMetrics.voltage, (v) => `${v > 1000 ? (v / 1000).toFixed(2) : v.toFixed(2)} kV`)}
            </div>
            <p className="text-[9px] text-slate-400 mt-1">{!isPmOnline ? <span className="text-rose-500 font-bold">PM Mati / Offline</span> : "Nominal: 20 kV"}</p>
          </div>
        </div>

        {/* Frekuensi */}
        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-400 dark:text-slate-500">
            <span className="text-[10px] font-extrabold uppercase tracking-wider">Frekuensi</span>
            <svg className="h-4 w-4 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 12h14M12 5l7 7-7 7" />
            </svg>
          </div>
          <div className="mt-4">
            <div className="text-base md:text-xl font-extrabold font-mono text-slate-800 dark:text-white">
              {renderMetricVal(liveMetrics.frequency, (v) => `${v.toFixed(2)} Hz`)}
            </div>
            <p className="text-[9px] text-slate-400 mt-1">{!isPmOnline ? <span className="text-rose-500 font-bold">PM Mati / Offline</span> : "Nominal: 50 Hz"}</p>
          </div>
        </div>

        {/* Active Power */}
        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-400 dark:text-slate-500">
            <span className="text-[10px] font-extrabold uppercase tracking-wider">Active Power</span>
            <svg className="h-4 w-4 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 002 2h2a2 2 0 002-2z" />
            </svg>
          </div>
          <div className="mt-4">
            <div className="text-base md:text-xl font-extrabold font-mono text-slate-800 dark:text-white">
              {renderMetricVal(liveMetrics.activePower, (v) => `${v.toLocaleString("id-ID")} kW`)}
            </div>
            <p className="text-[9px] text-slate-400 mt-1">{!isPmOnline ? <span className="text-rose-500 font-bold">PM Mati / Offline</span> : "Total daya aktif"}</p>
          </div>
        </div>

        {/* Power Factor */}
        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-400 dark:text-slate-500">
            <span className="text-[10px] font-extrabold uppercase tracking-wider">Power Factor</span>
            <svg className="h-4 w-4 text-cyan-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <div className="mt-4">
            <div className="text-base md:text-xl font-extrabold font-mono text-slate-800 dark:text-white">
              {renderMetricVal(liveMetrics.powerFactor, (v) => `${v.toFixed(3)} PF`)}
            </div>
            <p className="text-[9px] mt-1">{!isPmOnline ? <span className="text-rose-500 font-bold">PM Mati / Offline</span> : <span className="text-emerald-500 font-bold">Good</span>}</p>
          </div>
        </div>

        {/* Reactive Power */}
        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-400 dark:text-slate-500">
            <span className="text-[10px] font-extrabold uppercase tracking-wider">Reactive Power</span>
            <svg className="h-4 w-4 text-purple-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
            </svg>
          </div>
          <div className="mt-4">
            <div className="text-base md:text-xl font-extrabold font-mono text-slate-800 dark:text-white">
              {renderMetricVal(liveMetrics.reactivePower, (v) => `${v.toLocaleString("id-ID")} kVAR`)}
            </div>
            <p className="text-[9px] text-slate-400 mt-1">{!isPmOnline ? <span className="text-rose-500 font-bold">PM Mati / Offline</span> : "Daya reaktif"}</p>
          </div>
        </div>

        {/* Apparent Power */}
        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-400 dark:text-slate-500">
            <span className="text-[10px] font-extrabold uppercase tracking-wider">Apparent Power</span>
            <svg className="h-4 w-4 text-indigo-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M16 8v8m-4-5v5m-4-2v2m-2 4h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
          </div>
          <div className="mt-4">
            <div className="text-base md:text-xl font-extrabold font-mono text-slate-800 dark:text-white">
              {renderMetricVal(liveMetrics.apparentPower, (v) => `${v.toLocaleString("id-ID")} kVA`)}
            </div>
            <p className="text-[9px] text-slate-400 mt-1">{!isPmOnline ? <span className="text-rose-500 font-bold">PM Mati / Offline</span> : "Daya semu"}</p>
          </div>
        </div>
      </section>

      {/* ═══════════ SECTION B: POWER QUALITY INDEX & GAUGES ═══════════ */}
      <section className="grid gap-6 md:grid-cols-3">
        <UnbalancedGauge label="Voltage Unbalanced" value={liveMetrics.unbalanceV} maxAllowed={standards.unbalanceVMax} isDark={isDark} isLoading={loading} isPmOnline={isPmOnline} />
        <UnbalancedGauge label="Current Unbalanced" value={liveMetrics.unbalanceI} maxAllowed={standards.unbalanceIMax} isDark={isDark} isLoading={loading} isPmOnline={isPmOnline} />

        {/* Power Quality Radar Index */}
        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-sm flex flex-col justify-between">
          <div className="text-center">
            <h4 className="text-[11px] font-extrabold uppercase tracking-wider text-slate-400 dark:text-slate-500">Power Quality Index</h4>
            <p className="text-[10px] text-slate-400 dark:text-slate-600 mt-0.5">Analisis Keseluruhan Parameter</p>
          </div>
          <div className="relative mt-2 flex items-center justify-center" style={{ height: 160 }}>
            <Radar data={radarData} options={radarOptions} />
            {!loading && !isPmOnline && (
              <div className="absolute inset-0 bg-white/80 dark:bg-slate-900/85 backdrop-blur-[1px] flex flex-col items-center justify-center rounded-xl z-10">
                <span className="text-xs font-black uppercase text-rose-500 tracking-wider">PM {config.pmModel} MATI</span>
                <span className="text-[10px] text-slate-400 mt-0.5 font-semibold">Analisis PQ Tidak Tersedia</span>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* ═══════════ SECTION C: PHASE DETAILS ═══════════ */}
      <section className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
        {/* Tegangan Per Fasa */}
        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-sm flex flex-col justify-between">
          <div>
            <h4 className="text-xs font-bold text-slate-800 dark:text-white">Tegangan Per Fasa</h4>
            <p className="text-[10px] text-slate-400">Per Phase (R-S-T)</p>
          </div>

          <div className="my-4 space-y-3">
            {/* R */}
            <div className="space-y-1">
              <div className="flex justify-between text-[11px] font-bold">
                <span className="text-rose-500">R</span>
                <span className="font-mono">{renderMetricVal(liveMetrics.vR, (v) => `${v.toFixed(3)} kV`)}</span>
              </div>
              <div className="h-2 w-full rounded bg-slate-100 dark:bg-slate-800 overflow-hidden">
                <div className="h-full bg-rose-500 rounded transition-all duration-500" style={{ width: isPmOnline && !isOfflineVal(liveMetrics.vR) && Number(liveMetrics.vR) > 0 ? `${Math.min(100, (Number(liveMetrics.vR) / 24) * 100)}%` : "0%" }} />
              </div>
            </div>
            {/* S */}
            <div className="space-y-1">
              <div className="flex justify-between text-[11px] font-bold">
                <span className="text-amber-500">S</span>
                <span className="font-mono">{renderMetricVal(liveMetrics.vS, (v) => `${v.toFixed(3)} kV`)}</span>
              </div>
              <div className="h-2 w-full rounded bg-slate-100 dark:bg-slate-800 overflow-hidden">
                <div className="h-full bg-amber-500 rounded transition-all duration-500" style={{ width: isPmOnline && !isOfflineVal(liveMetrics.vS) && Number(liveMetrics.vS) > 0 ? `${Math.min(100, (Number(liveMetrics.vS) / 24) * 100)}%` : "0%" }} />
              </div>
            </div>
            {/* T */}
            <div className="space-y-1">
              <div className="flex justify-between text-[11px] font-bold">
                <span className="text-blue-500">T</span>
                <span className="font-mono">{renderMetricVal(liveMetrics.vT, (v) => `${v.toFixed(3)} kV`)}</span>
              </div>
              <div className="h-2 w-full rounded bg-slate-100 dark:bg-slate-800 overflow-hidden">
                <div className="h-full bg-blue-500 rounded transition-all duration-500" style={{ width: isPmOnline && !isOfflineVal(liveMetrics.vT) && Number(liveMetrics.vT) > 0 ? `${Math.min(100, (Number(liveMetrics.vT) / 24) * 100)}%` : "0%" }} />
              </div>
            </div>
          </div>

          <div className="flex justify-between items-center text-[10px] font-bold text-slate-500 border-t border-slate-100 dark:border-slate-800/80 pt-3">
            <span>AVG: <strong className="text-slate-700 dark:text-slate-300">{loading ? <span className="inline-block w-8 h-2.5 bg-slate-200 dark:bg-slate-700/60 rounded animate-pulse align-middle" /> : !isPmOnline ? "—" : `${statsV.avg.toFixed(3)} kV`}</strong></span>
            <span>MIN: <strong className="text-slate-700 dark:text-slate-300">{loading ? <span className="inline-block w-8 h-2.5 bg-slate-200 dark:bg-slate-700/60 rounded animate-pulse align-middle" /> : !isPmOnline ? "—" : `${statsV.min.toFixed(3)} kV`}</strong></span>
            <span>MAX: <strong className="text-slate-700 dark:text-slate-300">{loading ? <span className="inline-block w-8 h-2.5 bg-slate-200 dark:bg-slate-700/60 rounded animate-pulse align-middle" /> : !isPmOnline ? "—" : `${statsV.max.toFixed(3)} kV`}</strong></span>
          </div>
        </div>

        {/* Arus Per Fasa */}
        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-sm flex flex-col justify-between">
          <div>
            <h4 className="text-xs font-bold text-slate-800 dark:text-white">Arus Per Fasa</h4>
            <p className="text-[10px] text-slate-400">Per Phase (R-S-T)</p>
          </div>

          <div className="my-4 space-y-3">
            {/* R */}
            <div className="space-y-1">
              <div className="flex justify-between text-[11px] font-bold">
                <span className="text-rose-500">R</span>
                <span className="font-mono">{renderMetricVal(liveMetrics.iR, (v) => `${v.toFixed(1)} A`)}</span>
              </div>
              <div className="h-2 w-full rounded bg-slate-100 dark:bg-slate-800 overflow-hidden">
                <div className="h-full bg-rose-500 rounded transition-all duration-500" style={{ width: isPmOnline && !isOfflineVal(liveMetrics.iR) && Number(liveMetrics.iR) > 0 ? `${Math.min(100, (Number(liveMetrics.iR) / 150) * 100)}%` : "0%" }} />
              </div>
            </div>
            {/* S */}
            <div className="space-y-1">
              <div className="flex justify-between text-[11px] font-bold">
                <span className="text-amber-500">S</span>
                <span className="font-mono">{renderMetricVal(liveMetrics.iS, (v) => `${v.toFixed(1)} A`)}</span>
              </div>
              <div className="h-2 w-full rounded bg-slate-100 dark:bg-slate-800 overflow-hidden">
                <div className="h-full bg-amber-500 rounded transition-all duration-500" style={{ width: isPmOnline && !isOfflineVal(liveMetrics.iS) && Number(liveMetrics.iS) > 0 ? `${Math.min(100, (Number(liveMetrics.iS) / 150) * 100)}%` : "0%" }} />
              </div>
            </div>
            {/* T */}
            <div className="space-y-1">
              <div className="flex justify-between text-[11px] font-bold">
                <span className="text-blue-500">T</span>
                <span className="font-mono">{renderMetricVal(liveMetrics.iT, (v) => `${v.toFixed(1)} A`)}</span>
              </div>
              <div className="h-2 w-full rounded bg-slate-100 dark:bg-slate-800 overflow-hidden">
                <div className="h-full bg-blue-500 rounded transition-all duration-500" style={{ width: isPmOnline && !isOfflineVal(liveMetrics.iT) && Number(liveMetrics.iT) > 0 ? `${Math.min(100, (Number(liveMetrics.iT) / 150) * 100)}%` : "0%" }} />
              </div>
            </div>
          </div>

          <div className="flex justify-between items-center text-[10px] font-bold text-slate-500 border-t border-slate-100 dark:border-slate-800/80 pt-3">
            <span>AVG: <strong className="text-slate-700 dark:text-slate-300">{loading ? <span className="inline-block w-8 h-2.5 bg-slate-200 dark:bg-slate-700/60 rounded animate-pulse align-middle" /> : !isPmOnline ? "—" : `${statsI.avg.toFixed(1)} A`}</strong></span>
            <span>MIN: <strong className="text-slate-700 dark:text-slate-300">{loading ? <span className="inline-block w-8 h-2.5 bg-slate-200 dark:bg-slate-700/60 rounded animate-pulse align-middle" /> : !isPmOnline ? "—" : `${statsI.min.toFixed(1)} A`}</strong></span>
            <span>MAX: <strong className="text-slate-700 dark:text-slate-300">{loading ? <span className="inline-block w-8 h-2.5 bg-slate-200 dark:bg-slate-700/60 rounded animate-pulse align-middle" /> : !isPmOnline ? "—" : `${statsI.max.toFixed(1)} A`}</strong></span>
          </div>
        </div>

        {/* THD Voltage */}
        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-sm flex flex-col justify-between">
          <div>
            <h4 className="text-xs font-bold text-slate-800 dark:text-white">THD Voltage</h4>
            <p className="text-[10px] text-slate-400">Per Phase (R-S-T)</p>
          </div>

          <div className="my-4 space-y-3">
            {/* R */}
            <div className="space-y-1">
              <div className="flex justify-between text-[11px] font-bold">
                <span className="text-rose-500">R</span>
                <span className="font-mono">{renderMetricVal(liveMetrics.thdV_R, (v) => `${v.toFixed(2)} %`)}</span>
              </div>
              <div className="h-2 w-full rounded bg-slate-100 dark:bg-slate-800 overflow-hidden">
                <div className="h-full bg-rose-500 rounded transition-all duration-500" style={{ width: isPmOnline && !isOfflineVal(liveMetrics.thdV_R) && Number(liveMetrics.thdV_R) > 0 ? `${Math.min(100, (Number(liveMetrics.thdV_R) / 5) * 100)}%` : "0%" }} />
              </div>
            </div>
            {/* S */}
            <div className="space-y-1">
              <div className="flex justify-between text-[11px] font-bold">
                <span className="text-amber-500">S</span>
                <span className="font-mono">{renderMetricVal(liveMetrics.thdV_S, (v) => `${v.toFixed(2)} %`)}</span>
              </div>
              <div className="h-2 w-full rounded bg-slate-100 dark:bg-slate-800 overflow-hidden">
                <div className="h-full bg-amber-500 rounded transition-all duration-500" style={{ width: isPmOnline && !isOfflineVal(liveMetrics.thdV_S) && Number(liveMetrics.thdV_S) > 0 ? `${Math.min(100, (Number(liveMetrics.thdV_S) / 5) * 100)}%` : "0%" }} />
              </div>
            </div>
            {/* T */}
            <div className="space-y-1">
              <div className="flex justify-between text-[11px] font-bold">
                <span className="text-blue-500">T</span>
                <span className="font-mono">{renderMetricVal(liveMetrics.thdV_T, (v) => `${v.toFixed(2)} %`)}</span>
              </div>
              <div className="h-2 w-full rounded bg-slate-100 dark:bg-slate-800 overflow-hidden">
                <div className="h-full bg-blue-500 rounded transition-all duration-500" style={{ width: isPmOnline && !isOfflineVal(liveMetrics.thdV_T) && Number(liveMetrics.thdV_T) > 0 ? `${Math.min(100, (Number(liveMetrics.thdV_T) / 5) * 100)}%` : "0%" }} />
              </div>
            </div>
          </div>

          <div className="flex justify-between items-center text-[10px] font-bold text-slate-500 border-t border-slate-100 dark:border-slate-800/80 pt-3">
            <span>AVG: <strong className="text-slate-700 dark:text-slate-300">{loading ? <span className="inline-block w-8 h-2.5 bg-slate-200 dark:bg-slate-700/60 rounded animate-pulse align-middle" /> : !isPmOnline ? "—" : `${statsThdV.avg.toFixed(2)} %`}</strong></span>
            <span>MIN: <strong className="text-slate-700 dark:text-slate-300">{loading ? <span className="inline-block w-8 h-2.5 bg-slate-200 dark:bg-slate-700/60 rounded animate-pulse align-middle" /> : !isPmOnline ? "—" : `${statsThdV.min.toFixed(2)} %`}</strong></span>
            <span>MAX: <strong className="text-slate-700 dark:text-slate-300">{loading ? <span className="inline-block w-8 h-2.5 bg-slate-200 dark:bg-slate-700/60 rounded animate-pulse align-middle" /> : !isPmOnline ? "—" : `${statsThdV.max.toFixed(2)} %`}</strong></span>
          </div>
        </div>

        {/* THD Current */}
        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-sm flex flex-col justify-between">
          <div>
            <h4 className="text-xs font-bold text-slate-800 dark:text-white">THD Current</h4>
            <p className="text-[10px] text-slate-400">Per Phase (R-S-T)</p>
          </div>

          <div className="my-4 space-y-3">
            {/* R */}
            <div className="space-y-1">
              <div className="flex justify-between text-[11px] font-bold">
                <span className="text-rose-500">R</span>
                <span className="font-mono">{renderMetricVal(liveMetrics.thdI_R, (v) => `${v.toFixed(2)} %`)}</span>
              </div>
              <div className="h-2 w-full rounded bg-slate-100 dark:bg-slate-800 overflow-hidden">
                <div className="h-full bg-rose-500 rounded transition-all duration-500" style={{ width: isPmOnline && !isOfflineVal(liveMetrics.thdI_R) && Number(liveMetrics.thdI_R) > 0 ? `${Math.min(100, (Number(liveMetrics.thdI_R) / 8) * 100)}%` : "0%" }} />
              </div>
            </div>
            {/* S */}
            <div className="space-y-1">
              <div className="flex justify-between text-[11px] font-bold">
                <span className="text-amber-500">S</span>
                <span className="font-mono">{renderMetricVal(liveMetrics.thdI_S, (v) => `${v.toFixed(2)} %`)}</span>
              </div>
              <div className="h-2 w-full rounded bg-slate-100 dark:bg-slate-800 overflow-hidden">
                <div className="h-full bg-amber-500 rounded transition-all duration-500" style={{ width: isPmOnline && !isOfflineVal(liveMetrics.thdI_S) && Number(liveMetrics.thdI_S) > 0 ? `${Math.min(100, (Number(liveMetrics.thdI_S) / 8) * 100)}%` : "0%" }} />
              </div>
            </div>
            {/* T */}
            <div className="space-y-1">
              <div className="flex justify-between text-[11px] font-bold">
                <span className="text-blue-500">T</span>
                <span className="font-mono">{renderMetricVal(liveMetrics.thdI_T, (v) => `${v.toFixed(2)} %`)}</span>
              </div>
              <div className="h-2 w-full rounded bg-slate-100 dark:bg-slate-800 overflow-hidden">
                <div className="h-full bg-blue-500 rounded transition-all duration-500" style={{ width: isPmOnline && !isOfflineVal(liveMetrics.thdI_T) && Number(liveMetrics.thdI_T) > 0 ? `${Math.min(100, (Number(liveMetrics.thdI_T) / 8) * 100)}%` : "0%" }} />
              </div>
            </div>
          </div>

          <div className="flex justify-between items-center text-[10px] font-bold text-slate-500 border-t border-slate-100 dark:border-slate-800/80 pt-3">
            <span>AVG: <strong className="text-slate-700 dark:text-slate-300">{loading ? <span className="inline-block w-8 h-2.5 bg-slate-200 dark:bg-slate-700/60 rounded animate-pulse align-middle" /> : !isPmOnline ? "—" : `${statsThdI.avg.toFixed(2)} %`}</strong></span>
            <span>MIN: <strong className="text-slate-700 dark:text-slate-300">{loading ? <span className="inline-block w-8 h-2.5 bg-slate-200 dark:bg-slate-700/60 rounded animate-pulse align-middle" /> : !isPmOnline ? "—" : `${statsThdI.min.toFixed(2)} %`}</strong></span>
            <span>MAX: <strong className="text-slate-700 dark:text-slate-300">{loading ? <span className="inline-block w-8 h-2.5 bg-slate-200 dark:bg-slate-700/60 rounded animate-pulse align-middle" /> : !isPmOnline ? "—" : `${statsThdI.max.toFixed(2)} %`}</strong></span>
          </div>
        </div>
      </section>

      {/* ═══════════ SECTION D: TREND LINES & EVENT LOGS ═══════════ */}
      <section className="grid gap-6 lg:grid-cols-[1.2fr_1fr]">
        <div className="space-y-4">
          <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 shadow-sm">
            <div className="flex items-center justify-between mb-2">
              <h4 className="text-xs font-extrabold uppercase tracking-wider text-amber-500 dark:text-amber-400">Trend Tegangan 1 Jam (kV) — Rolling 3s</h4>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-bold font-mono text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded">
                  {rollingTrendData.rangeLabel} (Rolling 3s)
                </span>
                <button
                  type="button"
                  onClick={() => setZoomTrend("voltage")}
                  className="flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-bold text-amber-600 dark:text-amber-400 bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/20 transition cursor-pointer"
                  title="Perbesar Chart Trend Tegangan"
                >
                  <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.2">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 3.75v4.5m0-4.5h4.5m-4.5 0L9 9M3.75 20.25v-4.5m0 4.5h4.5m-4.5 0L9 15M20.25 3.75h-4.5m4.5 0v4.5m0-4.5L15 9m5.25 11.25h-4.5m4.5 0v-4.5m0 4.5L15 15" />
                  </svg>
                  <span>Perbesar</span>
                </button>
              </div>
            </div>
            <div style={{ height: 140 }}>
              <Line data={voltageTrendData} options={lineOptions("kV", false)} />
            </div>
          </div>
          <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 shadow-sm">
            <div className="flex items-center justify-between mb-2">
              <h4 className="text-xs font-extrabold uppercase tracking-wider text-emerald-500 dark:text-emerald-400">Trend Daya Aktif 1 Jam (kW) — Rolling 3s</h4>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-bold font-mono text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded">
                  {rollingTrendData.rangeLabel} (Rolling 3s)
                </span>
                <button
                  type="button"
                  onClick={() => setZoomTrend("power")}
                  className="flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/20 transition cursor-pointer"
                  title="Perbesar Chart Trend Daya Aktif"
                >
                  <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.2">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 3.75v4.5m0-4.5h4.5m-4.5 0L9 9M3.75 20.25v-4.5m0 4.5h4.5m-4.5 0L9 15M20.25 3.75h-4.5m4.5 0v4.5m0-4.5L15 9m5.25 11.25h-4.5m4.5 0v-4.5m0 4.5L15 15" />
                  </svg>
                  <span>Perbesar</span>
                </button>
              </div>
            </div>
            <div style={{ height: 140 }}>
              <Line data={activePowerTrendData} options={lineOptions("kW", true)} />
            </div>
          </div>
        </div>

        {/* Event Logs Card */}
        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-sm flex flex-col">
          <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800/80 pb-3 mb-4">
            <h4 className="text-xs font-extrabold uppercase tracking-wider text-slate-500 dark:text-slate-400">EVENT & ALARM LOG</h4>
            <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Recent 5 events</span>
          </div>

          <div className="flex-1 flex flex-col items-center justify-center py-6 text-center">
            <svg className="h-8 w-8 text-rose-500 mb-2 opacity-85" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            <span className="text-xs font-bold text-red-500 font-mono tracking-wider">API TIDAK TERSEDIA</span>
            <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-1 max-w-[200px]">Data event dan alarm log belum terintegrasi ke database/API.</p>
          </div>
        </div>
      </section>

      {/* Zoom Popup Modal for Trend Charts */}
      {zoomTrend && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-3 sm:p-4 md:p-6 animate-in fade-in duration-200"
          onClick={() => setZoomTrend(null)}
        >
          <div
            className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl flex flex-col space-y-3 overflow-hidden"
            style={{ width: "95vw", maxWidth: "1560px", height: "88vh", maxHeight: "90vh", padding: "1.25rem 1.5rem" }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 dark:border-slate-800 pb-3">
              <div>
                <div className="flex items-center gap-2">
                  <h3 className={`text-base font-bold uppercase tracking-wider ${
                    zoomTrend === "voltage" ? "text-amber-500 dark:text-amber-400" : "text-emerald-500 dark:text-emerald-400"
                  }`}>
                    {zoomTrend === "voltage" ? "Trend Tegangan 1 Jam (kV) — Rolling 3s" : "Trend Daya Aktif 1 Jam (kW) — Rolling 3s"}
                  </h3>
                  <span className="text-xs px-2.5 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold border border-slate-200 dark:border-slate-700">
                    {config.title}
                  </span>
                </div>
                <div className="flex flex-wrap items-center gap-2 mt-1.5">
                  <span className="text-xs font-mono font-bold text-slate-700 dark:text-slate-200 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded border border-slate-200 dark:border-slate-700">
                    Rentang: {modalRollingTrendData.rangeLabel}
                  </span>
                  <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                    • Resolusi 3 Detik (Rolling 1 Jam)
                  </span>
                  {modalRollingTrendData.isCustom ? (
                    <div className="flex items-center gap-1.5">
                      <span className="inline-flex items-center gap-1 text-[11px] font-bold text-indigo-600 dark:text-indigo-400 bg-indigo-500/10 px-2 py-0.5 rounded-full border border-indigo-500/20">
                        Interactive View (Zoom / Pan)
                      </span>
                      <button
                        type="button"
                        onClick={() => {
                          setZoomIndexRange(null);
                          setZoomRangeY(null);
                        }}
                        className="px-2 py-0.5 text-[10px] font-bold text-slate-600 dark:text-slate-300 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 rounded border border-slate-200 dark:border-slate-700 transition cursor-pointer"
                        title="Reset ke Tampilan Live Auto-Fit (atau Klik Ganda di Grafik)"
                      >
                        ↺ Reset
                      </button>
                    </div>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                      Live Stream
                    </span>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setZoomTrend(null)}
                  className="flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 rounded-xl shadow-sm transition cursor-pointer"
                  title="Tutup Modal (ESC)"
                >
                  <span>Tutup</span>
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>

            {/* Modal Body: Full Responsive TradingView Canvas (NO BUTTON BARS, NO OVERFLOW SCROLLBAR) */}
            <div
              ref={zoomContainerRef}
              className="relative w-full flex-1 min-h-[420px] sm:min-h-[460px] overflow-hidden rounded-xl border border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/20 p-2 select-none"
            >
              <div className="w-full h-full min-h-[420px]">
                {zoomTrend === "voltage" ? (
                  <Line ref={zoomChartRef} data={modalVoltageTrendData} options={lineOptions("kV", false, true)} />
                ) : (
                  <Line ref={zoomChartRef} data={modalActivePowerTrendData} options={lineOptions("kW", true, true)} />
                )}
              </div>
            </div>

            {/* Modal Footer: Quick Stats & TradingView Tips */}
            <div className="flex flex-wrap items-center justify-between border-t border-slate-100 dark:border-slate-800/80 pt-2.5 text-xs gap-3">
              <div className="flex flex-wrap items-center gap-4 text-slate-600 dark:text-slate-300">
                {zoomTrend === "voltage" && voltageStats ? (
                  <>
                    <span>Terkini: <strong className="text-rose-500">R: {voltageStats.latestR.toFixed(3)} kV</strong> | <strong className="text-amber-500">S: {voltageStats.latestS.toFixed(3)} kV</strong> | <strong className="text-blue-500">T: {voltageStats.latestT.toFixed(3)} kV</strong></span>
                    <span>• Rata-rata 1 Jam: <strong className="font-mono text-slate-800 dark:text-white">{voltageStats.avg.toFixed(3)} kV</strong></span>
                    <span>• Min: <strong className="font-mono">{voltageStats.min.toFixed(3)} kV</strong> | Max: <strong className="font-mono">{voltageStats.max.toFixed(3)} kV</strong></span>
                  </>
                ) : zoomTrend === "power" && powerStats ? (
                  <>
                    <span>Terkini: <strong className="text-emerald-500 font-mono font-bold">{powerStats.latest.toFixed(1)} kW</strong></span>
                    <span>• Rata-rata 1 Jam: <strong className="font-mono text-slate-800 dark:text-white">{powerStats.avg.toFixed(1)} kW</strong></span>
                    <span>• Peak (Beban Puncak): <strong className="font-mono text-amber-500">{powerStats.max.toFixed(1)} kW</strong></span>
                    <span>• Min: <strong className="font-mono">{powerStats.min.toFixed(1)} kW</strong></span>
                  </>
                ) : (
                  <span className="text-slate-400">Data telemetri tersinkronisasi per 3 detik.</span>
                )}
              </div>
              <div className="flex flex-wrap items-center gap-2 text-[11px] text-slate-400">
                <span className="hidden sm:inline">🖱️ <b>Hold LMB</b> geser • <b>Scroll</b> zoom waktu • <b>Scroll sumbu kiri</b> atur tinggi • <b>Klik ganda</b> reset</span>
                <span>•</span>
                <span>Tekan <kbd className="px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 font-mono text-[10px] border border-slate-200 dark:border-slate-700">ESC</kbd> untuk menutup</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ═══════════ SECTION E: PARAMETER RINGKASAN TABLE ═══════════ */}
      <section className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-sm">
        <div className="flex items-center gap-2 mb-4">
          <svg className="h-4 w-4 text-[#002b5c] dark:text-sky-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 10h16M4 14h16M4 18h16" />
          </svg>
          <h4 className="text-xs font-extrabold uppercase tracking-wider text-slate-500 dark:text-slate-400">Ringkasan Parameter {config.title}</h4>
        </div>

        <div className="overflow-x-auto scrollbar-thin">
          <table className="w-full min-w-[560px] table-fixed text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-slate-100 dark:border-slate-800 text-[10px] uppercase tracking-wider text-[#47729f] dark:text-slate-500 font-bold">
                <th className="pb-3 px-3 w-[28%] min-w-[160px]">Parameter</th>
                <th className="pb-3 px-3 w-[22%] min-w-[130px]">Nilai</th>
                <th className="pb-3 px-3 w-[14%] min-w-[70px]">Satuan</th>
                <th className="pb-3 px-3 w-[20%] min-w-[110px]">Standar</th>
                <th className="pb-3 px-3 w-[16%] min-w-[90px] text-right">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 font-semibold text-slate-800 dark:text-slate-200">
              {/* Tegangan */}
              <tr className="hover:bg-slate-50/50 dark:hover:bg-slate-800/10">
                <td className="py-3 px-3 truncate">Tegangan</td>
                <td className="py-3 px-3 font-mono tabular-nums whitespace-nowrap">{renderMetricVal(liveMetrics.voltage, (v) => `${v.toFixed(2)}`)}</td>
                <td className="py-3 px-3 whitespace-nowrap">kV</td>
                <td className="py-3 px-3 font-mono tabular-nums whitespace-nowrap">{standards.voltageNominal} ± {standards.voltageTolerance}%</td>
                <td className="py-3 px-3 text-right whitespace-nowrap">
                  {renderTableStatus(
                    isOfflineVal(liveMetrics.voltage),
                    Math.abs(Number(liveMetrics.voltage) - standards.voltageNominal) <= (standards.voltageNominal * standards.voltageTolerance / 100)
                  )}
                </td>
              </tr>
              {/* Frekuensi */}
              <tr className="hover:bg-slate-50/50 dark:hover:bg-slate-800/10">
                <td className="py-3 px-3 truncate">Frekuensi</td>
                <td className="py-3 px-3 font-mono tabular-nums whitespace-nowrap">{renderMetricVal(liveMetrics.frequency, (v) => `${v.toFixed(2)}`)}</td>
                <td className="py-3 px-3 whitespace-nowrap">Hz</td>
                <td className="py-3 px-3 font-mono tabular-nums whitespace-nowrap">{standards.frequencyNominal} ± {standards.frequencyTolerance}</td>
                <td className="py-3 px-3 text-right whitespace-nowrap">
                  {renderTableStatus(
                    isOfflineVal(liveMetrics.frequency),
                    Math.abs(Number(liveMetrics.frequency) - standards.frequencyNominal) <= standards.frequencyTolerance
                  )}
                </td>
              </tr>
              {/* Active Power */}
              <tr className="hover:bg-slate-50/50 dark:hover:bg-slate-800/10">
                <td className="py-3 px-3 truncate">Active Power</td>
                <td className="py-3 px-3 font-mono tabular-nums whitespace-nowrap">{renderMetricVal(liveMetrics.activePower, (v) => `${v.toLocaleString("id-ID")}`)}</td>
                <td className="py-3 px-3 whitespace-nowrap">kW</td>
                <td className="py-3 px-3 font-mono tabular-nums whitespace-nowrap">{standards.activePowerMax > 0 ? `≤ ${standards.activePowerMax}` : "—"}</td>
                <td className="py-3 px-3 text-right whitespace-nowrap">
                  {renderTableStatus(
                    isOfflineVal(liveMetrics.activePower),
                    !(standards.activePowerMax > 0 && Number(liveMetrics.activePower) > standards.activePowerMax)
                  )}
                </td>
              </tr>
              {/* Reactive Power */}
              <tr className="hover:bg-slate-50/50 dark:hover:bg-slate-800/10">
                <td className="py-3 px-3 truncate">Reactive Power</td>
                <td className="py-3 px-3 font-mono tabular-nums whitespace-nowrap">{renderMetricVal(liveMetrics.reactivePower, (v) => `${v.toLocaleString("id-ID")}`)}</td>
                <td className="py-3 px-3 whitespace-nowrap">kVAR</td>
                <td className="py-3 px-3 font-mono tabular-nums whitespace-nowrap">{standards.reactivePowerMax > 0 ? `≤ ${standards.reactivePowerMax}` : "—"}</td>
                <td className="py-3 px-3 text-right whitespace-nowrap">
                  {renderTableStatus(
                    isOfflineVal(liveMetrics.reactivePower),
                    !(standards.reactivePowerMax > 0 && Number(liveMetrics.reactivePower) > standards.reactivePowerMax)
                  )}
                </td>
              </tr>
              {/* Apparent Power */}
              <tr className="hover:bg-slate-50/50 dark:hover:bg-slate-800/10">
                <td className="py-3 px-3 truncate">Apparent Power</td>
                <td className="py-3 px-3 font-mono tabular-nums whitespace-nowrap">{renderMetricVal(liveMetrics.apparentPower, (v) => `${v.toLocaleString("id-ID")}`)}</td>
                <td className="py-3 px-3 whitespace-nowrap">kVA</td>
                <td className="py-3 px-3 font-mono tabular-nums whitespace-nowrap">{standards.apparentPowerMax > 0 ? `≤ ${standards.apparentPowerMax}` : "—"}</td>
                <td className="py-3 px-3 text-right whitespace-nowrap">
                  {renderTableStatus(
                    isOfflineVal(liveMetrics.apparentPower),
                    !(standards.apparentPowerMax > 0 && Number(liveMetrics.apparentPower) > standards.apparentPowerMax)
                  )}
                </td>
              </tr>
              {/* Power Factor */}
              <tr className="hover:bg-slate-50/50 dark:hover:bg-slate-800/10">
                <td className="py-3 px-3 truncate">Power Factor</td>
                <td className="py-3 px-3 font-mono tabular-nums whitespace-nowrap">{renderMetricVal(liveMetrics.powerFactor, (v) => `${v.toFixed(3)}`)}</td>
                <td className="py-3 px-3 whitespace-nowrap">PF</td>
                <td className="py-3 px-3 font-mono tabular-nums whitespace-nowrap">≥ {standards.powerFactorMin}</td>
                <td className="py-3 px-3 text-right whitespace-nowrap">
                  {renderTableStatus(
                    isOfflineVal(liveMetrics.powerFactor),
                    Number(liveMetrics.powerFactor) >= standards.powerFactorMin,
                    "⚠ Low PF"
                  )}
                </td>
              </tr>
              {/* Voltage Unbalanced */}
              <tr className="hover:bg-slate-50/50 dark:hover:bg-slate-800/10">
                <td className="py-3 px-3 truncate">Voltage Unbalanced</td>
                <td className="py-3 px-3 font-mono tabular-nums whitespace-nowrap">{renderMetricVal(liveMetrics.unbalanceV, (v) => `${v.toFixed(2)}`)}</td>
                <td className="py-3 px-3 whitespace-nowrap">%</td>
                <td className="py-3 px-3 font-mono tabular-nums whitespace-nowrap">≤ {standards.unbalanceVMax}%</td>
                <td className="py-3 px-3 text-right whitespace-nowrap">
                  {renderTableStatus(
                    isOfflineVal(liveMetrics.unbalanceV),
                    Number(liveMetrics.unbalanceV) <= standards.unbalanceVMax
                  )}
                </td>
              </tr>
              {/* Current Unbalanced */}
              <tr className="hover:bg-slate-50/50 dark:hover:bg-slate-800/10">
                <td className="py-3 px-3 truncate">Current Unbalanced</td>
                <td className="py-3 px-3 font-mono tabular-nums whitespace-nowrap">{renderMetricVal(liveMetrics.unbalanceI, (v) => `${v.toFixed(2)}`)}</td>
                <td className="py-3 px-3 whitespace-nowrap">%</td>
                <td className="py-3 px-3 font-mono tabular-nums whitespace-nowrap">≤ {standards.unbalanceIMax}%</td>
                <td className="py-3 px-3 text-right whitespace-nowrap">
                  {renderTableStatus(
                    isOfflineVal(liveMetrics.unbalanceI),
                    Number(liveMetrics.unbalanceI) <= standards.unbalanceIMax
                  )}
                </td>
              </tr>
              {/* THD Voltage */}
              <tr className="hover:bg-slate-50/50 dark:hover:bg-slate-800/10">
                <td className="py-3 px-3 truncate">THD Voltage (Avg)</td>
                <td className="py-3 px-3 font-mono tabular-nums whitespace-nowrap">{renderMetricVal(liveMetrics.thdV_R === "BELUM ADA API" || liveMetrics.thdV_S === "BELUM ADA API" || liveMetrics.thdV_T === "BELUM ADA API" ? "BELUM ADA API" : liveMetrics.thdV_R === "API TIDAK TERKIRIM" || liveMetrics.thdV_S === "API TIDAK TERKIRIM" || liveMetrics.thdV_T === "API TIDAK TERKIRIM" ? "API TIDAK TERKIRIM" : statsThdV.avg, (v) => `${v.toFixed(2)}`)}</td>
                <td className="py-3 px-3 whitespace-nowrap">%</td>
                <td className="py-3 px-3 font-mono tabular-nums whitespace-nowrap">≤ {standards.thdVoltageMax}%</td>
                <td className="py-3 px-3 text-right whitespace-nowrap">
                  {renderTableStatus(
                    isOfflineVal(liveMetrics.thdV_R),
                    statsThdV.avg <= standards.thdVoltageMax
                  )}
                </td>
              </tr>
              {/* THD Current */}
              <tr className="hover:bg-slate-50/50 dark:hover:bg-slate-800/10">
                <td className="py-3 px-3 truncate">THD Current (Avg)</td>
                <td className="py-3 px-3 font-mono tabular-nums whitespace-nowrap">{renderMetricVal(liveMetrics.thdI_R === "BELUM ADA API" || liveMetrics.thdI_S === "BELUM ADA API" || liveMetrics.thdI_T === "BELUM ADA API" ? "BELUM ADA API" : liveMetrics.thdI_R === "API TIDAK TERKIRIM" || liveMetrics.thdI_S === "API TIDAK TERKIRIM" || liveMetrics.thdI_T === "API TIDAK TERKIRIM" ? "API TIDAK TERKIRIM" : statsThdI.avg, (v) => `${v.toFixed(2)}`)}</td>
                <td className="py-3 px-3 whitespace-nowrap">%</td>
                <td className="py-3 px-3 font-mono tabular-nums whitespace-nowrap">≤ {standards.thdCurrentMax}%</td>
                <td className="py-3 px-3 text-right whitespace-nowrap">
                  {renderTableStatus(
                    isOfflineVal(liveMetrics.thdI_R),
                    statsThdI.avg <= standards.thdCurrentMax
                  )}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      {/* CONFIG MODAL */}
      {canAccessConfig && showConfigModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm" onClick={() => setShowConfigModal(false)}>
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl w-full max-w-lg p-6 space-y-4" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <h3 className="text-sm font-bold uppercase tracking-wide text-slate-700 dark:text-white">
                ⚙️ Konfigurasi Standar Parameter Incoming PLN
              </h3>
              <button onClick={() => setShowConfigModal(false)} className="text-slate-400 hover:text-slate-600 text-lg font-bold">✕</button>
            </div>

            <div className="space-y-3.5 max-h-[60vh] overflow-y-auto pr-1">
              {/* Tegangan */}
              <div className="grid grid-cols-2 gap-3 border-b border-slate-100 dark:border-slate-800 pb-3">
                <div>
                  <label className="text-[10px] font-extrabold uppercase text-slate-400 block mb-1">Tegangan Nominal (kV)</label>
                  <input
                    type="number"
                    step="0.1"
                    value={formStds.voltageNominal}
                    onChange={(e) => setFormStds({ ...formStds, voltageNominal: parseFloat(e.target.value) || 0 })}
                    className="w-full px-3 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-mono text-slate-800 dark:text-slate-100 focus:ring-1 focus:ring-sky-500 outline-none"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-extrabold uppercase text-slate-400 block mb-1">Toleransi Tegangan (%)</label>
                  <input
                    type="number"
                    step="0.1"
                    value={formStds.voltageTolerance}
                    onChange={(e) => setFormStds({ ...formStds, voltageTolerance: parseFloat(e.target.value) || 0 })}
                    className="w-full px-3 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-mono text-slate-800 dark:text-slate-100 focus:ring-1 focus:ring-sky-500 outline-none"
                  />
                </div>
              </div>

              {/* Frekuensi */}
              <div className="grid grid-cols-2 gap-3 border-b border-slate-100 dark:border-slate-800 pb-3">
                <div>
                  <label className="text-[10px] font-extrabold uppercase text-slate-400 block mb-1">Frekuensi Nominal (Hz)</label>
                  <input
                    type="number"
                    step="0.1"
                    value={formStds.frequencyNominal}
                    onChange={(e) => setFormStds({ ...formStds, frequencyNominal: parseFloat(e.target.value) || 0 })}
                    className="w-full px-3 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-mono text-slate-800 dark:text-slate-100 focus:ring-1 focus:ring-sky-500 outline-none"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-extrabold uppercase text-slate-400 block mb-1">Toleransi Frekuensi (Hz)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={formStds.frequencyTolerance}
                    onChange={(e) => setFormStds({ ...formStds, frequencyTolerance: parseFloat(e.target.value) || 0 })}
                    className="w-full px-3 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-mono text-slate-800 dark:text-slate-100 focus:ring-1 focus:ring-sky-500 outline-none"
                  />
                </div>
              </div>

              {/* Power Limits */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 border-b border-slate-100 dark:border-slate-800 pb-3">
                <div>
                  <label className="text-[10px] font-extrabold uppercase text-slate-400 block mb-1">Max Active Power (kW)</label>
                  <input
                    type="number"
                    step="1"
                    value={formStds.activePowerMax}
                    onChange={(e) => setFormStds({ ...formStds, activePowerMax: parseFloat(e.target.value) || 0 })}
                    className="w-full px-3 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-mono text-slate-800 dark:text-slate-100 focus:ring-1 focus:ring-sky-500 outline-none"
                    placeholder="0 = tanpa batas"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-extrabold uppercase text-slate-400 block mb-1">Max Reactive (kVAR)</label>
                  <input
                    type="number"
                    step="1"
                    value={formStds.reactivePowerMax}
                    onChange={(e) => setFormStds({ ...formStds, reactivePowerMax: parseFloat(e.target.value) || 0 })}
                    className="w-full px-3 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-mono text-slate-800 dark:text-slate-100 focus:ring-1 focus:ring-sky-500 outline-none"
                    placeholder="0 = tanpa batas"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-extrabold uppercase text-slate-400 block mb-1">Max Apparent (kVA)</label>
                  <input
                    type="number"
                    step="1"
                    value={formStds.apparentPowerMax}
                    onChange={(e) => setFormStds({ ...formStds, apparentPowerMax: parseFloat(e.target.value) || 0 })}
                    className="w-full px-3 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-mono text-slate-800 dark:text-slate-100 focus:ring-1 focus:ring-sky-500 outline-none"
                    placeholder="0 = tanpa batas"
                  />
                </div>
              </div>

              {/* Power Factor & Unbalance */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 border-b border-slate-100 dark:border-slate-800 pb-3">
                <div>
                  <label className="text-[10px] font-extrabold uppercase text-slate-400 block mb-1">Min PF</label>
                  <input
                    type="number"
                    step="0.01"
                    value={formStds.powerFactorMin}
                    onChange={(e) => setFormStds({ ...formStds, powerFactorMin: parseFloat(e.target.value) || 0 })}
                    className="w-full px-3 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-mono text-slate-800 dark:text-slate-100 focus:ring-1 focus:ring-sky-500 outline-none"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-extrabold uppercase text-slate-400 block mb-1">Max Unb V (%)</label>
                  <input
                    type="number"
                    step="0.1"
                    value={formStds.unbalanceVMax}
                    onChange={(e) => setFormStds({ ...formStds, unbalanceVMax: parseFloat(e.target.value) || 0 })}
                    className="w-full px-3 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-mono text-slate-800 dark:text-slate-100 focus:ring-1 focus:ring-sky-500 outline-none"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-extrabold uppercase text-slate-400 block mb-1">Max Unb I (%)</label>
                  <input
                    type="number"
                    step="0.1"
                    value={formStds.unbalanceIMax}
                    onChange={(e) => setFormStds({ ...formStds, unbalanceIMax: parseFloat(e.target.value) || 0 })}
                    className="w-full px-3 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-mono text-slate-800 dark:text-slate-100 focus:ring-1 focus:ring-sky-500 outline-none"
                  />
                </div>
              </div>

              {/* THD Limits */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] font-extrabold uppercase text-slate-400 block mb-1">Max THD Voltage (%)</label>
                  <input
                    type="number"
                    step="0.1"
                    value={formStds.thdVoltageMax}
                    onChange={(e) => setFormStds({ ...formStds, thdVoltageMax: parseFloat(e.target.value) || 0 })}
                    className="w-full px-3 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-mono text-slate-800 dark:text-slate-100 focus:ring-1 focus:ring-sky-500 outline-none"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-extrabold uppercase text-slate-400 block mb-1">Max THD Current (%)</label>
                  <input
                    type="number"
                    step="0.1"
                    value={formStds.thdCurrentMax}
                    onChange={(e) => setFormStds({ ...formStds, thdCurrentMax: parseFloat(e.target.value) || 0 })}
                    className="w-full px-3 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-mono text-slate-800 dark:text-slate-100 focus:ring-1 focus:ring-sky-500 outline-none"
                  />
                </div>
              </div>
            </div>

            <div className="border-t border-slate-100 dark:border-slate-800 pt-3 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowConfigModal(false)}
                className="px-4 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-xl text-xs font-bold transition-colors"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleSaveStandards}
                disabled={savingConfig}
                className="px-4 py-2 bg-sky-500 hover:bg-sky-600 disabled:opacity-50 text-white rounded-xl text-xs font-extrabold transition-colors shadow-md shadow-sky-500/20"
              >
                {savingConfig ? "Menyimpan..." : "💾 Simpan Standar"}
              </button>
            </div>
          </div>
        </div>
      )}
      {/* API SOURCES CONFIG MODAL */}
      {canAccessConfig && showConfigPanel && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm" onClick={() => setShowConfigPanel(false)}>
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl w-full max-w-4xl p-6 space-y-4" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <h3 className="text-sm font-bold uppercase tracking-wide text-slate-700 dark:text-white">
                🔌 Konfigurasi API Live Data - {config.title}
              </h3>
              <button onClick={() => setShowConfigPanel(false)} className="text-slate-400 hover:text-slate-600 text-lg font-bold">✕</button>
            </div>

            <div className="max-h-[70vh] overflow-y-auto pr-1">
              <ApiSourcesPanel unitId={config.deviceId} />
            </div>

            <div className="border-t border-slate-100 dark:border-slate-800 pt-3 flex justify-end">
              <button
                type="button"
                onClick={() => setShowConfigPanel(false)}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition-colors shadow-md"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
