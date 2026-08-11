import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Bar, Doughnut, Line } from "react-chartjs-2";
import { PageHeader } from "../../components/ui/PageHeader";
import "../../components/charts/chartjs";
import { DonutChart } from "../../components/charts/DonutChart";
import { getJson, postJson } from "../../services/api.client";
import { getSocket } from "../../services/socket.service";
import { useSystemStore } from "../../store/system.store";
import { useConfigStore } from "../../store/config.store";
import { calculateWaterCost } from "../../utils/water";
import { ApiSourcesPanel } from "../machines/MachineConfig";

// Standard formatting helpers
const formatCurrency = (value: number) =>
  new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(value);

const getLocalTodayString = () => {
  const d = new Date();
  const yr = d.getFullYear();
  const mo = String(d.getMonth() + 1).padStart(2, "0");
  const dy = String(d.getDate()).padStart(2, "0");
  return `${yr}-${mo}-${dy}`;
};

// Simple Sparkline helper for cards
function Sparkline({ color }: { color: string }) {
  const points = useMemo(() => Array.from({ length: 12 }, () => 10 + Math.random() * 20), []);
  return (
    <svg className="absolute bottom-0 left-0 w-full h-8 opacity-25" viewBox="0 0 100 30" preserveAspectRatio="none">
      <path
        d={points.map((p, i) => `${i === 0 ? "M" : "L"} ${(i / (points.length - 1)) * 100} ${30 - p}`).join(" ")}
        fill="none"
        stroke={color}
        strokeWidth="1.5"
      />
    </svg>
  );
}

// Icon Definitions
const IconGrid = () => (
  <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
    <rect x="3" y="3" width="7" height="7" rx="1" />
    <rect x="14" y="3" width="7" height="7" rx="1" />
    <rect x="3" y="14" width="7" height="7" rx="1" />
    <rect x="14" y="14" width="7" height="7" rx="1" />
  </svg>
);

const IconSettings = () => (
  <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="3" />
    <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
  </svg>
);

const IconPower = () => (
  <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M18.36 6.64a9 9 0 1 1-12.73 0" />
    <line x1="12" y1="2" x2="12" y2="12" />
  </svg>
);

// Animated Wave Indicator for Tanks
function TankLiquidIndicator({ percentage, height = 120, label, color = "sky" }: { percentage: number; height?: number; label: string; color?: "emerald" | "sky" | "teal" }) {
  const wavesColor = {
    sky: { bg: "bg-sky-500/80", wave: "rgba(14, 165, 233, 0.45)" },
    emerald: { bg: "bg-emerald-500/80", wave: "rgba(16, 185, 129, 0.45)" },
    teal: { bg: "bg-teal-500/80", wave: "rgba(20, 184, 166, 0.45)" }
  }[color];

  return (
    <div className="relative border border-slate-200/50 dark:border-slate-800 rounded-2xl bg-slate-50 dark:bg-slate-900/50 p-4 shadow-inner flex flex-col items-center justify-between w-full">
      <div className="text-center z-10">
        <h4 className="text-[11px] font-extrabold uppercase tracking-wider text-slate-400 dark:text-slate-500">{label}</h4>
      </div>

      <div className="relative my-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 overflow-hidden w-24 flex items-end" style={{ height }}>
        {/* Animated wave */}
        <div 
          className={`absolute w-full transition-all duration-1000 ease-out ${wavesColor.bg}`}
          style={{ height: `${percentage}%` }}
        >
          {/* Top wave visual */}
          <div className="absolute top-0 left-0 right-0 h-2 -mt-1 overflow-hidden opacity-80">
            <svg viewBox="0 0 100 20" preserveAspectRatio="none" className="w-[200%] h-full animate-wave" style={{ fill: wavesColor.wave }}>
              <path d="M0 10 Q 25 20, 50 10 T 100 10 T 150 10 T 200 10 L 200 20 L 0 20 Z" />
            </svg>
          </div>
        </div>

        {/* Center overlay label */}
        <div className="absolute inset-0 flex items-center justify-center font-extrabold font-mono text-lg text-slate-700 dark:text-slate-200 z-10 drop-shadow-[0_2px_4px_rgba(255,255,255,0.8)] dark:drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)]">
          {percentage}%
        </div>
      </div>
    </div>
  );
}

// Sub-page nav tabs component
function WaterSubNav() {
  return (
    <div className="flex border-b border-slate-200 dark:border-slate-800 mb-6">
      <Link
        to="/air"
        className="border-b-2 border-cyan-500 px-4 py-2.5 text-xs font-extrabold text-cyan-600 dark:text-cyan-400 tracking-wider uppercase transition-all duration-200"
      >
        Overview
      </Link>
      <Link
        to="/air/distribusi"
        className="border-b-2 border-transparent hover:border-slate-300 dark:hover:border-slate-700 px-4 py-2.5 text-xs font-semibold text-slate-500 dark:text-slate-400 tracking-wider uppercase transition-all duration-200"
      >
        Distribusi Air
      </Link>
      <Link
        to="/air/energy"
        className="border-b-2 border-transparent hover:border-slate-300 dark:hover:border-slate-700 px-4 py-2.5 text-xs font-semibold text-slate-500 dark:text-slate-400 tracking-wider uppercase transition-all duration-200"
      >
        Energy
      </Link>
    </div>
  );
}

export default function WaterOverview() {
  const theme = useSystemStore((state) => state.theme);
  const isDark = theme === "dark";
  const waterConfig = useConfigStore((state) => state.waterConfig);

  const [chartStartDate, setChartStartDate] = useState(getLocalTodayString);
  const [chartEndDate, setChartEndDate] = useState(getLocalTodayString);
  const [range, setRange] = useState<"hour" | "day" | "custom">("day");
  
  const [showConfigPanel, setShowConfigPanel] = useState(false);
  const [apiSourceUrls, setApiSourceUrls] = useState<Record<string, string>>({});
  const [jsonKeyMap, setJsonKeyMap] = useState<Record<string, string>>({});
  const [apiLiveData, setApiLiveData] = useState<Record<string, any>>({});

  const [summaryData, setSummaryData] = useState<any>(null);
  const [chartLoading, setChartLoading] = useState(true);

  // Submersible pump manual toggle overrides
  const [dw3PumpState, setDw3PumpState] = useState(true);
  const [dw4PumpState, setDw4PumpState] = useState(true);

  // Simulated drifting SCADA values
  const [scadaJitter, setScadaJitter] = useState({
    dw3Output: 48.1,
    dw4Output: 48.1,
    dw3Flow: 221.5,
    dw4Flow: 150.7,
    dw3Pressure: 4.3,
    dw4Pressure: 4.6,
    dw3Current: 18.4,
    dw4Current: 14.7,
    dw3Tds: 247,
    dw4Tds: 207,
    dw3Ph: 7.3,
    dw4Ph: 6.9,
    // Storage Tanks
    tank1Level: 67,
    tank2Level: 92,
    factoryTankLevel: 74,
    tank1Inflow: 154,
    tank1Outflow: 112,
    tank2Inflow: 90,
    tank2Outflow: 73,
    factoryTankInflow: 73,
    factoryTankOutflow: 93
  });

  // Load API configurations
  useEffect(() => {
    getJson<{ success: boolean; rows?: any[] | null }>("/config/api-sources-map?unitId=water")
      .then((res) => {
        const urls: Record<string, string> = {};
        const keys: Record<string, string> = {};
        if (res && res.rows) {
          res.rows.forEach((row: any) => {
            if (row.tagKey) {
              urls[row.tagKey] = row.url || "";
              keys[row.tagKey] = row.jsonKey || "";
            }
          });
        }
        setApiSourceUrls(urls);
        setJsonKeyMap(keys);
      })
      .catch((err) => {
        console.error("Failed to load API sources map for Water:", err);
      });
  }, []);

  // Poll active API endpoints
  useEffect(() => {
    let isMounted = true;
    const pollApi = async () => {
      const uniqueUrls = Array.from(new Set(Object.values(apiSourceUrls).filter((u) => u.trim())));
      if (uniqueUrls.length === 0) return;

      const data: Record<string, any> = {};
      await Promise.all(
        uniqueUrls.map(async (url) => {
          try {
            const res = await postJson<{ success: boolean; data?: any }>("/config/api-sources/test", {
              url,
              method: "GET"
            });
            if (res && res.success && res.data) {
              data[url] = res.data;
            }
          } catch (e) {
            console.error("Error polling water API url:", url, e);
          }
        })
      );

      if (isMounted) {
        setApiLiveData(data);
      }
    };

    pollApi();
    const interval = setInterval(pollApi, 4000);
    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [apiSourceUrls]);

  // Fetch PostgreSQL/MongoDB consolidated telemetry analytics
  const fetchAnalyticsData = useCallback(() => {
    setChartLoading(true);
    let url = `/analytics/water?`;
    if (range === "custom") {
      url += `from=${chartStartDate}&to=${chartEndDate}`;
    } else if (range === "hour") {
      const todayStr = getLocalTodayString();
      url += `from=${todayStr}&to=${todayStr}`;
    } else {
      url += `year=${new Date().getFullYear()}`;
    }

    getJson<{ data: any }>(url)
      .then((res) => {
        setSummaryData(res.data);
        setChartLoading(false);
      })
      .catch((err) => {
        console.error("Failed to load water telemetry analytics:", err);
        setChartLoading(false);
      });
  }, [range, chartStartDate, chartEndDate]);

  useEffect(() => {
    fetchAnalyticsData();
  }, [fetchAnalyticsData]);

  // Real-time jitter simulator for telemetry values
  useEffect(() => {
    const runJitter = () => {
      setScadaJitter((prev) => {
        const factor = (v: number, min: number, max: number, delta: number) => {
          const next = v + (Math.random() * 2 - 1) * delta;
          return Number(Math.max(min, Math.min(max, next)).toFixed(1));
        };
        return {
          dw3Output: factor(prev.dw3Output, 30, 80, 0.4),
          dw4Output: factor(prev.dw4Output, 30, 80, 0.4),
          dw3Flow: dw3PumpState ? factor(prev.dw3Flow, 200, 240, 1.5) : 0,
          dw4Flow: dw4PumpState ? factor(prev.dw4Flow, 130, 170, 1.2) : 0,
          dw3Pressure: dw3PumpState ? factor(prev.dw3Pressure, 3.8, 4.8, 0.05) : 0,
          dw4Pressure: dw4PumpState ? factor(prev.dw4Pressure, 4.1, 5.1, 0.04) : 0,
          dw3Current: dw3PumpState ? factor(prev.dw3Current, 17.5, 19.5, 0.1) : 0,
          dw4Current: dw4PumpState ? factor(prev.dw4Current, 13.8, 15.8, 0.08) : 0,
          dw3Tds: Math.round(factor(prev.dw3Tds, 230, 260, 0.8)),
          dw4Tds: Math.round(factor(prev.dw4Tds, 195, 220, 0.7)),
          dw3Ph: factor(prev.dw3Ph, 7.1, 7.5, 0.02),
          dw4Ph: factor(prev.dw4Ph, 6.7, 7.1, 0.02),
          // Storage Tanks
          tank1Level: Math.round(factor(prev.tank1Level, 60, 75, 0.5)),
          tank2Level: Math.round(factor(prev.tank2Level, 85, 96, 0.4)),
          factoryTankLevel: Math.round(factor(prev.factoryTankLevel, 70, 82, 0.6)),
          tank1Inflow: Math.round(factor(prev.tank1Inflow, 140, 170, 1)),
          tank1Outflow: Math.round(factor(prev.tank1Outflow, 100, 125, 1)),
          tank2Inflow: Math.round(factor(prev.tank2Inflow, 80, 100, 1)),
          tank2Outflow: Math.round(factor(prev.tank2Outflow, 65, 80, 0.8)),
          factoryTankInflow: Math.round(factor(prev.factoryTankInflow, 65, 85, 0.9)),
          factoryTankOutflow: Math.round(factor(prev.factoryTankOutflow, 85, 105, 1.2))
        };
      });
    };

    const interval = setInterval(runJitter, 3000);
    return () => clearInterval(interval);
  }, [dw3PumpState, dw4PumpState]);

  // Bind values to configured API endpoint, or fall back to simulated jitter
  const getVal = useCallback((tagKey: string, fallback: number) => {
    const url = apiSourceUrls[tagKey] || "";
    if (!url.trim()) return fallback;
    const jsonKey = jsonKeyMap[tagKey] || tagKey.split("/")[1];
    if (!jsonKey) return fallback;
    const val = apiLiveData[url]?.[jsonKey];
    if (val === undefined || val === null || isNaN(Number(val))) return fallback;
    return Number(val);
  }, [apiSourceUrls, jsonKeyMap, apiLiveData]);

  // Read status from API or switch override
  const getStatus = useCallback((tagKey: string, fallback: boolean) => {
    const url = apiSourceUrls[tagKey] || "";
    if (!url.trim()) return fallback;
    const jsonKey = jsonKeyMap[tagKey] || tagKey.split("/")[1];
    if (!jsonKey) return fallback;
    const val = apiLiveData[url]?.[jsonKey];
    if (val === undefined || val === null) return fallback;
    return val === true || val === 1 || String(val).toLowerCase() === "run" || String(val).toLowerCase() === "on" || String(val).toLowerCase() === "running";
  }, [apiSourceUrls, jsonKeyMap, apiLiveData]);

  // Top metric numbers
  const todayM3 = useMemo(() => summaryData?.summary?.todayM3 || (scadaJitter.dw3Output + scadaJitter.dw4Output), [summaryData, scadaJitter]);
  const dw3Today = useMemo(() => summaryData?.summary?.perDeviceSummary?.find((d: any) => d.deviceId === "dw3")?.todayM3 || scadaJitter.dw3Output, [summaryData, scadaJitter]);
  const dw4Today = useMemo(() => summaryData?.summary?.perDeviceSummary?.find((d: any) => d.deviceId === "dw4")?.todayM3 || scadaJitter.dw4Output, [summaryData, scadaJitter]);

  // Progressive water bill calculations
  const waterRateConfig = waterConfig || { taxRate: 0.20, ar: 0.18, tiers: [] };
  const totalCost = useMemo(() => calculateWaterCost(todayM3, waterRateConfig), [todayM3, waterRateConfig]);
  const dw3Cost = useMemo(() => calculateWaterCost(dw3Today, waterRateConfig), [dw3Today, waterRateConfig]);
  const dw4Cost = useMemo(() => calculateWaterCost(dw4Today, waterRateConfig), [dw4Today, waterRateConfig]);

  // 1. Trend Chart Data
  const trendChartData = useMemo(() => {
    const labels = summaryData?.charts?.daily?.map((d: any) => d.day.substring(8)) || Array.from({ length: 15 }, (_, i) => `0${i+1}`);
    const values = summaryData?.charts?.daily?.map((d: any) => d.value) || Array.from({ length: 15 }, (_, i) => 80 + Math.sin(i) * 20 + Math.random() * 8);
    return {
      labels,
      datasets: [
        {
          label: "Flow Trend (m³)",
          data: values,
          borderColor: "#0ea5e9",
          backgroundColor: "rgba(14, 165, 233, 0.05)",
          fill: true,
          tension: 0.35,
          borderWidth: 2,
          pointRadius: 2
        }
      ]
    };
  }, [summaryData]);

  // 2. Output Donut Data
  const donutSegments = useMemo(() => {
    return [
      { label: "Deepwell-3", value: dw3Today, color: "#3b82f6" },
      { label: "Deepwell-4", value: dw4Today, color: "#10b981" }
    ];
  }, [dw3Today, dw4Today]);

  // 3. Month vs Previous Month Chart Data
  const monthlyComparisonData = useMemo(() => {
    const labels = Array.from({ length: 12 }, (_, i) => ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"][i]);
    const currentValues = summaryData?.charts?.monthly?.map((m: any) => m.value) || [1200, 1150, 1250, 1300, 1400, 1420, 1380, 1410, 1390, 1450, 1480, 1510];
    const previousValues = currentValues.map((v: number) => v * 0.93 + (Math.random() * 80 - 40));
    return {
      labels,
      datasets: [
        {
          label: "Bulan Ini",
          data: currentValues,
          backgroundColor: "#3b82f6",
          borderRadius: 4,
          barPercentage: 0.6,
          categoryPercentage: 0.7
        },
        {
          label: "Bulan Lalu",
          data: previousValues,
          backgroundColor: "#ef4444",
          borderRadius: 4,
          barPercentage: 0.6,
          categoryPercentage: 0.7
        }
      ]
    };
  }, [summaryData]);

  // Table parameters with live variables
  const tableRows = useMemo(() => {
    const list = [
      { jalur: "Multimedia", sumber: "Main Distribution", flow: 11.4, pressure: 2.6, harian: 38.9, bulanan: 1628 },
      { jalur: "Hydrant", sumber: "Main Distribution", flow: 24.1, pressure: 3.1, harian: 5.0, bulanan: 72 },
      { jalur: "Sanitari-1", sumber: "Main Distribution", flow: 48.0, pressure: 3.3, harian: 33.5, bulanan: 837 },
      { jalur: "Sanitari-2", sumber: "Main Distribution", flow: 43.6, pressure: 2.7, harian: 43.8, bulanan: 963 },
      { jalur: "Softener-1", sumber: "Main Distribution", flow: 33.7, pressure: 5.2, harian: 58.1, bulanan: 1778 },
      { jalur: "Softener-2", sumber: "Main Distribution", flow: 44.2, pressure: 2.5, harian: 39.4, bulanan: 1039 },
      { jalur: "Factory-1", sumber: "Main Distribution", flow: 47.8, pressure: 4.3, harian: 92.1, bulanan: 2865 },
      { jalur: "F1: WF1U1", sumber: "Factory-1 Distribution", flow: 2.9, pressure: 2.3, harian: 22.1, bulanan: 568 },
      { jalur: "F1: WF1U2", sumber: "Factory-1 Distribution", flow: 27.2, pressure: 3.5, harian: 19.6, bulanan: 588 },
      { jalur: "F1: WF1U3", sumber: "Factory-1 Distribution", flow: 7.5, pressure: 2.9, harian: 28.7, bulanan: 716 },
      { jalur: "F1: Sanitari-1", sumber: "Factory-1 Distribution", flow: 27.7, pressure: 2.0, harian: 15.0, bulanan: 481 },
      { jalur: "F1: Sanitari-2", sumber: "Factory-1 Distribution", flow: 26.0, pressure: 3.3, harian: 12.0, bulanan: 418 },
      { jalur: "F1: Hydrant", sumber: "Factory-1 Distribution", flow: 19.4, pressure: 5.7, harian: 3.0, bulanan: 51 }
    ];

    // Jitter table flows slightly to make table feel dynamic
    return list.map((item, index) => {
      const factor = 1 + (Math.sin(Date.now() / 4000 + index) * 0.04);
      return {
        ...item,
        flow: Number((item.flow * factor).toFixed(1)),
        pressure: Number((item.pressure * factor).toFixed(1)),
        harian: Number((item.harian * factor).toFixed(1)),
        bulanan: Math.round(item.bulanan * factor)
      };
    });
  }, [scadaJitter]);

  const totalHarian = useMemo(() => tableRows.reduce((a, c) => a + c.harian, 0), [tableRows]);
  const totalBulanan = useMemo(() => tableRows.reduce((a, c) => a + c.bulanan, 0), [tableRows]);

  // Toggle handlers
  const handleToggleDW3 = () => {
    setDw3PumpState(!dw3PumpState);
  };

  const handleToggleDW4 = () => {
    setDw4PumpState(!dw4PumpState);
  };

  return (
    <div className="space-y-6">
      {/* HEADER ROW */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <PageHeader title="Water Utility — Overview" description="Pantau konsumsi sumur proses deepwell, tangki penyimpanan, dan distribusi air secara real-time." />
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowConfigPanel(true)}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition shadow-sm"
          >
            🔌 API Sources Config
          </button>
        </div>
      </div>

      {/* SUB PAGE TAB NAV */}
      <WaterSubNav />

      {/* ═══════════ SECTION A: OVERVIEW CARD ROW (Mockup 1) ═══════════ */}
      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {/* Card 1: TOTAL WATER CONSUMPTION */}
        <div className="relative overflow-hidden rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-sm transition hover:shadow-md">
          <Sparkline color="#0ea5e9" />
          <div className="relative z-10 flex flex-col justify-between h-full">
            <div className="flex items-center justify-between mb-3">
              <span className="text-[10px] font-extrabold uppercase tracking-widest text-slate-400 dark:text-slate-500">Total Water Consumption</span>
              <div className="h-7 w-7 rounded-lg bg-sky-500/10 text-sky-500 flex items-center justify-center font-bold">💧</div>
            </div>
            <div className="text-3xl font-extrabold font-mono text-slate-800 dark:text-white">
              {todayM3.toLocaleString("id-ID", { maximumFractionDigits: 1 })}
              <span className="text-sm font-bold ml-1 text-slate-400">m³</span>
            </div>
            <div className="mt-2 text-[10px] text-slate-400">Akumulasi sumur proses hari ini</div>
          </div>
        </div>

        {/* Card 2: WATER CONSUMPTION (FACT SPLIT) */}
        <div className="relative overflow-hidden rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-sm transition hover:shadow-md">
          <div className="relative z-10 flex flex-col justify-between h-full">
            <div className="flex items-center justify-between mb-3">
              <span className="text-[10px] font-extrabold uppercase tracking-widest text-slate-400 dark:text-slate-500">Water Consumption</span>
              <div className="h-7 w-7 rounded-lg bg-indigo-500/10 text-indigo-500 flex items-center justify-center font-bold">🏢</div>
            </div>
            <div className="grid grid-cols-2 gap-2 mt-1">
              <div>
                <div className="text-[10px] font-bold text-slate-400 uppercase">Fact-1</div>
                <div className="text-lg font-extrabold font-mono text-slate-800 dark:text-white">
                  {(todayM3 * 0.6).toFixed(1)} <span className="text-xs text-slate-400">m³</span>
                </div>
              </div>
              <div>
                <div className="text-[10px] font-bold text-slate-400 uppercase">Fact-2</div>
                <div className="text-lg font-extrabold font-mono text-slate-800 dark:text-white">
                  {(todayM3 * 0.4).toFixed(1)} <span className="text-xs text-slate-400">m³</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Card 3: DEEPWELL-3 */}
        <div className="relative overflow-hidden rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-sm transition hover:shadow-md">
          <div className="relative z-10 flex flex-col justify-between h-full">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] font-extrabold uppercase tracking-widest text-slate-400 dark:text-slate-500">Deepwell-3</span>
              <span className={`px-2 py-0.5 text-[8px] font-extrabold uppercase rounded-full ${dw3PumpState ? "bg-emerald-500/10 text-emerald-500 border border-emerald-500/20" : "bg-rose-500/10 text-rose-500 border border-rose-500/20"}`}>
                {dw3PumpState ? "RUN" : "STOP"}
              </span>
            </div>
            <div className="grid grid-cols-3 gap-1">
              <div>
                <div className="text-[9px] font-bold text-slate-400 uppercase">Output</div>
                <div className="text-sm font-extrabold font-mono text-slate-800 dark:text-white">
                  {dw3Today.toFixed(1)}<span className="text-[10px] text-slate-400">m³</span>
                </div>
              </div>
              <div>
                <div className="text-[9px] font-bold text-slate-400 uppercase">RH Motor</div>
                <div className="text-sm font-extrabold font-mono text-slate-800 dark:text-white">
                  {dw3PumpState ? "8.1" : "0.0"}
                </div>
              </div>
              <div>
                <div className="text-[9px] font-bold text-slate-400 uppercase">Debit</div>
                <div className="text-sm font-extrabold font-mono text-slate-800 dark:text-white">
                  {(dw3PumpState ? scadaJitter.dw3Flow / 60 : 0).toFixed(1)}<span className="text-[9px] text-slate-400">m³/h</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Card 4: DEEPWELL-4 */}
        <div className="relative overflow-hidden rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-sm transition hover:shadow-md">
          <div className="relative z-10 flex flex-col justify-between h-full">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] font-extrabold uppercase tracking-widest text-slate-400 dark:text-slate-500">Deepwell-4</span>
              <span className={`px-2 py-0.5 text-[8px] font-extrabold uppercase rounded-full ${dw4PumpState ? "bg-emerald-500/10 text-emerald-500 border border-emerald-500/20" : "bg-rose-500/10 text-rose-500 border border-rose-500/20"}`}>
                {dw4PumpState ? "RUN" : "STOP"}
              </span>
            </div>
            <div className="grid grid-cols-3 gap-1">
              <div>
                <div className="text-[9px] font-bold text-slate-400 uppercase">Output</div>
                <div className="text-sm font-extrabold font-mono text-slate-800 dark:text-white">
                  {dw4Today.toFixed(1)}<span className="text-[10px] text-slate-400">m³</span>
                </div>
              </div>
              <div>
                <div className="text-[9px] font-bold text-slate-400 uppercase">RH Motor</div>
                <div className="text-sm font-extrabold font-mono text-slate-800 dark:text-white">
                  {dw4PumpState ? "8.1" : "0.0"}
                </div>
              </div>
              <div>
                <div className="text-[9px] font-bold text-slate-400 uppercase">Debit</div>
                <div className="text-sm font-extrabold font-mono text-slate-800 dark:text-white">
                  {(dw4PumpState ? scadaJitter.dw4Flow / 60 : 0).toFixed(1)}<span className="text-[9px] text-slate-400">m³/h</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ═══════════ SECTION B: ESTIMASI TOTAL BIAYA (Mockup 1) ═══════════ */}
      <section className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-2xl border border-blue-100 dark:border-slate-800 bg-blue-50/50 dark:bg-slate-900/40 p-4 flex items-center justify-between">
          <div>
            <div className="text-[9px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">Estimasi Total Biaya</div>
            <div className="text-2xl font-extrabold font-mono text-[#002b5c] dark:text-sky-400 mt-1">
              {formatCurrency(totalCost)}
            </div>
          </div>
          <span className="text-xl">💰</span>
        </div>
        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 flex items-center justify-between">
          <div>
            <div className="text-[9px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">DW-3 Estimasi Biaya</div>
            <div className="text-xl font-extrabold font-mono text-slate-700 dark:text-slate-200 mt-1">
              {formatCurrency(dw3Cost)}
            </div>
          </div>
          <span className="text-xl">🚰</span>
        </div>
        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 flex items-center justify-between">
          <div>
            <div className="text-[9px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">DW-4 Estimasi Total Biaya</div>
            <div className="text-xl font-extrabold font-mono text-slate-700 dark:text-slate-200 mt-1">
              {formatCurrency(dw4Cost)}
            </div>
          </div>
          <span className="text-xl">🚰</span>
        </div>
      </section>

      {/* ═══════════ SECTION C: TRENDS & OUTPUTS (Mockup 1) ═══════════ */}
      <section className="grid gap-6 lg:grid-cols-3">
        {/* Trend flow */}
        <div className="lg:col-span-2 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-sm flex flex-col justify-between">
          <div className="flex justify-between items-center mb-4">
            <div>
              <h3 className="text-sm font-bold uppercase tracking-[0.2em] text-slate-400 dark:text-slate-500">Trend</h3>
              <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-0.5">Tren harian konsumsi air sumur proses</p>
            </div>
          </div>
          <div className="bg-slate-50 dark:bg-slate-950/20 rounded-xl p-4 border border-slate-100 dark:border-slate-800/80" style={{ height: 260 }}>
            {chartLoading ? (
              <div className="h-full flex items-center justify-center text-xs text-slate-400">Loading charts...</div>
            ) : (
              <Line
                data={trendChartData}
                options={{
                  responsive: true,
                  maintainAspectRatio: false,
                  plugins: { legend: { display: false } },
                  scales: {
                    x: { grid: { display: false }, ticks: { font: { size: 9 }, color: "#64748b" } },
                    y: { grid: { color: "rgba(100,116,139,0.1)" }, ticks: { font: { size: 9 }, color: "#64748b" } }
                  }
                }}
              />
            )}
          </div>
        </div>

        {/* Water Output comparison Donut */}
        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-sm flex flex-col justify-between">
          <div>
            <h3 className="text-sm font-bold uppercase tracking-[0.2em] text-slate-400 dark:text-slate-500">Water Output</h3>
            <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-0.5">Rasio output (DW-3 vs DW-4)</p>
          </div>
          <div className="my-4 flex justify-center">
            <DonutChart segments={donutSegments} size={150} thickness={18} centerLabel={`${(dw3Today + dw4Today).toFixed(1)} m³`} />
          </div>
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs border-b border-slate-100 dark:border-slate-800/60 pb-1.5">
              <span className="flex items-center gap-2 text-slate-600 dark:text-slate-300 font-medium">
                <span className="h-2.5 w-2.5 rounded-full bg-blue-500" />
                Deepwell-3
              </span>
              <span className="font-bold text-slate-700 dark:text-slate-200 font-mono">
                {dw3Today.toFixed(1)} m³ ({Math.round((dw3Today / (dw3Today + dw4Today || 1)) * 100)}%)
              </span>
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="flex items-center gap-2 text-slate-600 dark:text-slate-300 font-medium">
                <span className="h-2.5 w-2.5 rounded-full bg-emerald-500" />
                Deepwell-4
              </span>
              <span className="font-bold text-slate-700 dark:text-slate-200 font-mono">
                {dw4Today.toFixed(1)} m³ ({Math.round((dw4Today / (dw3Today + dw4Today || 1)) * 100)}%)
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* ═══════════ SECTION D: MONTHLY BAR COMPARISON (Mockup 1) ═══════════ */}
      <section className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-sm">
        <h3 className="text-sm font-bold uppercase tracking-[0.2em] text-slate-400 dark:text-slate-500 mb-4">Total konsumsi Bulan ini vs Bulan lalu</h3>
        <div className="bg-slate-50 dark:bg-slate-950/20 rounded-xl p-4 border border-slate-100 dark:border-slate-800/80" style={{ height: 260 }}>
          <Bar
            data={monthlyComparisonData}
            options={{
              responsive: true,
              maintainAspectRatio: false,
              plugins: {
                legend: { position: "top", labels: { boxWidth: 10, font: { size: 9 }, color: "#64748b" } }
              },
              scales: {
                x: { grid: { display: false }, ticks: { font: { size: 9 }, color: "#64748b" } },
                y: { grid: { color: "rgba(100,116,139,0.1)" }, ticks: { font: { size: 9 }, color: "#64748b" } }
              }
            }}
          />
        </div>
      </section>

      {/* ═══════════ SECTION E: DEEPWELL MONITORING (Mockup 2) ═══════════ */}
      <section className="space-y-4">
        <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-2">
          <div>
            <h3 className="text-base font-bold text-slate-800 dark:text-white">Deepwell Monitoring</h3>
            <p className="text-xs text-slate-400 mt-0.5">Monitoring level air, flow meter, power pompa, TDS & pH air sumur</p>
          </div>
          <span className="px-3 py-1 bg-blue-500/10 text-blue-500 border border-blue-500/20 text-xs font-bold rounded-full">
            2 Active Wells
          </span>
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          {/* DEEPWELL-3 */}
          <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-sm flex flex-col justify-between">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h4 className="font-bold text-slate-800 dark:text-white flex items-center gap-2">
                  <span className="h-2.5 w-2.5 rounded-full bg-blue-500 animate-pulse" />
                  Deepwell 3 (DW-03)
                </h4>
                <p className="text-[10px] text-slate-400">Deepwell Pump Station</p>
              </div>
              <span className={`px-3 py-1 rounded-full text-xs font-bold flex items-center gap-1.5 ${dw3PumpState ? "bg-emerald-500/10 text-emerald-500" : "bg-rose-500/10 text-rose-500"}`}>
                <span className={`h-2 w-2 rounded-full ${dw3PumpState ? "bg-emerald-500 animate-pulse" : "bg-rose-500"}`} />
                {dw3PumpState ? "Running" : "Stopped"}
              </span>
            </div>

            {/* SCADA Interactive Box */}
            <div className={`rounded-2xl p-4 border transition-colors duration-200 ${isDark ? "bg-[#0b121f] border-[#1e293b] text-slate-200" : "bg-slate-50 border-slate-200 text-slate-800"} space-y-4`}>
              <div className={`flex items-center justify-between border-b ${isDark ? "border-slate-800/80" : "border-slate-200"} pb-2`}>
                <span className="text-[11px] uppercase font-bold text-blue-400 flex items-center gap-1.5">
                  <span className="h-1.5 w-1.5 rounded-full bg-blue-400 animate-ping" />
                  Submersible Pump
                </span>
                {/* Switch Toggle */}
                <button 
                  onClick={handleToggleDW3}
                  className={`w-10 h-5 rounded-full transition-colors relative flex items-center ${dw3PumpState ? "bg-emerald-500" : "bg-slate-700"}`}
                >
                  <span className={`w-4 h-4 rounded-full bg-white absolute transition-transform shadow ${dw3PumpState ? "translate-x-5" : "translate-x-1"}`} />
                </button>
              </div>

              <div className="grid grid-cols-[80px_1fr] gap-4">
                {/* Level Gauge */}
                <div className={`flex flex-col items-center justify-center border-r ${isDark ? "border-slate-800/80" : "border-slate-200"} pr-2`}>
                  <span className="text-[9px] uppercase font-bold text-slate-500 mb-1">Water Level</span>
                  <div className={`w-10 h-24 rounded-full border ${isDark ? "border-slate-700 bg-slate-900/60" : "border-slate-300 bg-white"} overflow-hidden relative flex items-end`}>
                    <div 
                      className="w-full bg-sky-500/70 transition-all duration-1000" 
                      style={{ height: `${dw3PumpState ? 72 : 45}%` }}
                    />
                  </div>
                  <span className="text-xs font-mono font-extrabold text-sky-400 mt-1 select-none">
                    {dw3PumpState ? "27.9" : "21.2"} m
                  </span>
                  <span className={`text-[8px] ${isDark ? "text-slate-500" : "text-slate-400"} font-semibold mt-0.5`}>dari permukaan</span>
                </div>

                {/* SCADA Metrics grid */}
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className={`rounded-xl p-2.5 border ${isDark ? "bg-[#131d31] border-slate-800" : "bg-white border-slate-200"}`}>
                    <div className="text-[9px] font-bold text-slate-500 uppercase tracking-wider">Flow Rate</div>
                    <div className="mt-1 font-mono font-extrabold text-sky-400 text-sm">
                      {getVal("dw3/flow_rate", scadaJitter.dw3Flow)} <span className="text-[10px] text-slate-500 font-normal">L/min</span>
                    </div>
                  </div>
                  <div className={`rounded-xl p-2.5 border ${isDark ? "bg-[#131d31] border-slate-800" : "bg-white border-slate-200"}`}>
                    <div className="text-[9px] font-bold text-slate-500 uppercase tracking-wider">Pressure</div>
                    <div className="mt-1 font-mono font-extrabold text-indigo-400 text-sm">
                      {getVal("dw3/pressure", scadaJitter.dw3Pressure)} <span className="text-[10px] text-slate-500 font-normal">bar</span>
                    </div>
                  </div>
                  <div className={`col-span-2 rounded-xl p-3 border ${isDark ? "bg-[#131d31] border-slate-800" : "bg-white border-slate-200"} flex flex-col justify-center items-center`}>
                    <div className="text-[9px] font-bold text-slate-500 uppercase tracking-wider">Pump Power</div>
                    <div className="mt-1 font-mono font-extrabold text-[#f97316] text-xl flex items-baseline gap-1">
                      {dw3PumpState ? (5.5 + Math.random() * 0.4).toFixed(2) : "0.00"} <span className="text-xs text-slate-500 font-bold">kW</span>
                    </div>
                  </div>
                  <div className={`rounded-xl p-2.5 border ${isDark ? "bg-[#131d31] border-slate-800" : "bg-white border-slate-200"}`}>
                    <div className="text-[9px] font-bold text-slate-500 uppercase tracking-wider">Running Hrs</div>
                    <div className="mt-1 font-mono font-extrabold text-[#eab308] text-xs">
                      14459 hrs
                    </div>
                  </div>
                  <div className={`rounded-xl p-2.5 border ${isDark ? "bg-[#131d31] border-slate-800" : "bg-white border-slate-200"}`}>
                    <div className="text-[9px] font-bold text-slate-500 uppercase tracking-wider">Current</div>
                    <div className="mt-1 font-mono font-extrabold text-[#ec4899] text-xs">
                      {getVal("dw3/current", scadaJitter.dw3Current)} A
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* TDS & pH meter sliders */}
            <div className="mt-4 space-y-3">
              <div>
                <div className="flex justify-between items-center text-xs font-semibold text-slate-500 mb-1">
                  <span>🟢 TDS Air Sumur</span>
                  <span className="font-mono font-bold text-slate-700 dark:text-slate-200">
                    {getVal("dw3/tds", scadaJitter.dw3Tds)} ppm
                  </span>
                </div>
                <div className="w-full bg-slate-100 dark:bg-slate-800 rounded-full h-1.5 overflow-hidden">
                  <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${(scadaJitter.dw3Tds / 400) * 100}%` }} />
                </div>
              </div>

              <div>
                <div className="flex justify-between items-center text-xs font-semibold text-slate-500 mb-1">
                  <span>🟣 pH Air Sumur</span>
                  <span className="font-mono font-bold text-slate-700 dark:text-slate-200">
                    {getVal("dw3/ph", scadaJitter.dw3Ph)} scale
                  </span>
                </div>
                <div className="w-full bg-slate-100 dark:bg-slate-800 rounded-full h-1.5 overflow-hidden">
                  <div className="h-full bg-indigo-500 rounded-full" style={{ width: `${(scadaJitter.dw3Ph / 14) * 100}%` }} />
                </div>
              </div>
            </div>

            {/* Footer details */}
            <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800 flex justify-between items-center text-[10px] font-bold text-slate-400">
              <div className="flex gap-3">
                <span>Voltage: 380V</span>
                <span>Runtime: 4,522.564h</span>
              </div>
              <button className={`h-6 w-6 rounded-lg flex items-center justify-center transition-colors ${dw3PumpState ? "bg-emerald-500/10 text-emerald-500 hover:bg-emerald-500/20" : "bg-slate-100 dark:bg-slate-800 text-slate-400"}`}>
                <IconPower />
              </button>
            </div>
          </div>

          {/* DEEPWELL-4 */}
          <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-sm flex flex-col justify-between">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h4 className="font-bold text-slate-800 dark:text-white flex items-center gap-2">
                  <span className="h-2.5 w-2.5 rounded-full bg-cyan-500 animate-pulse" />
                  Deepwell 4 (DW-04)
                </h4>
                <p className="text-[10px] text-slate-400">Deepwell Pump Station</p>
              </div>
              <span className={`px-3 py-1 rounded-full text-xs font-bold flex items-center gap-1.5 ${dw4PumpState ? "bg-emerald-500/10 text-emerald-500" : "bg-rose-500/10 text-rose-500"}`}>
                <span className={`h-2 w-2 rounded-full ${dw4PumpState ? "bg-emerald-500 animate-pulse" : "bg-rose-500"}`} />
                {dw4PumpState ? "Running" : "Stopped"}
              </span>
            </div>

            {/* SCADA Interactive Box */}
            <div className={`rounded-2xl p-4 border transition-colors duration-200 ${isDark ? "bg-[#0b121f] border-[#1e293b] text-slate-200" : "bg-slate-50 border-slate-200 text-slate-800"} space-y-4`}>
              <div className={`flex items-center justify-between border-b ${isDark ? "border-slate-800/80" : "border-slate-200"} pb-2`}>
                <span className="text-[11px] uppercase font-bold text-cyan-400 flex items-center gap-1.5">
                  <span className="h-1.5 w-1.5 rounded-full bg-cyan-400 animate-ping" />
                  Submersible Pump
                </span>
                {/* Switch Toggle */}
                <button 
                  onClick={handleToggleDW4}
                  className={`w-10 h-5 rounded-full transition-colors relative flex items-center ${dw4PumpState ? "bg-emerald-500" : "bg-slate-700"}`}
                >
                  <span className={`w-4 h-4 rounded-full bg-white absolute transition-transform shadow ${dw4PumpState ? "translate-x-5" : "translate-x-1"}`} />
                </button>
              </div>

              <div className="grid grid-cols-[80px_1fr] gap-4">
                {/* Level Gauge */}
                <div className={`flex flex-col items-center justify-center border-r ${isDark ? "border-slate-800/80" : "border-slate-200"} pr-2`}>
                  <span className="text-[9px] uppercase font-bold text-slate-500 mb-1">Water Level</span>
                  <div className={`w-10 h-24 rounded-full border ${isDark ? "border-slate-700 bg-slate-900/60" : "border-slate-300 bg-white"} overflow-hidden relative flex items-end`}>
                    <div 
                      className="w-full bg-sky-500/70 transition-all duration-1000" 
                      style={{ height: `${dw4PumpState ? 81 : 32}%` }}
                    />
                  </div>
                  <span className="text-xs font-mono font-extrabold text-sky-400 mt-1 select-none">
                    {dw4PumpState ? "31.6" : "24.5"} m
                  </span>
                  <span className={`text-[8px] ${isDark ? "text-slate-500" : "text-slate-400"} font-semibold mt-0.5`}>dari permukaan</span>
                </div>

                {/* SCADA Metrics grid */}
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className={`rounded-xl p-2.5 border ${isDark ? "bg-[#131d31] border-slate-800" : "bg-white border-slate-200"}`}>
                    <div className="text-[9px] font-bold text-slate-500 uppercase tracking-wider">Flow Rate</div>
                    <div className="mt-1 font-mono font-extrabold text-sky-400 text-sm">
                      {getVal("dw4/flow_rate", scadaJitter.dw4Flow)} <span className="text-[10px] text-slate-500 font-normal">L/min</span>
                    </div>
                  </div>
                  <div className={`rounded-xl p-2.5 border ${isDark ? "bg-[#131d31] border-slate-800" : "bg-white border-slate-200"}`}>
                    <div className="text-[9px] font-bold text-slate-500 uppercase tracking-wider">Pressure</div>
                    <div className="mt-1 font-mono font-extrabold text-indigo-400 text-sm">
                      {getVal("dw4/pressure", scadaJitter.dw4Pressure)} <span className="text-[10px] text-slate-500 font-normal">bar</span>
                    </div>
                  </div>
                  <div className={`col-span-2 rounded-xl p-3 border ${isDark ? "bg-[#131d31] border-slate-800" : "bg-white border-slate-200"} flex flex-col justify-center items-center`}>
                    <div className="text-[9px] font-bold text-slate-500 uppercase tracking-wider">Pump Power</div>
                    <div className="mt-1 font-mono font-extrabold text-[#f97316] text-xl flex items-baseline gap-1">
                      {dw4PumpState ? (4.2 + Math.random() * 0.3).toFixed(2) : "0.00"} <span className="text-xs text-slate-500 font-bold">kW</span>
                    </div>
                  </div>
                  <div className={`rounded-xl p-2.5 border ${isDark ? "bg-[#131d31] border-slate-800" : "bg-white border-slate-200"}`}>
                    <div className="text-[9px] font-bold text-slate-500 uppercase tracking-wider">Running Hrs</div>
                    <div className="mt-1 font-mono font-extrabold text-[#eab308] text-xs">
                      11233 hrs
                    </div>
                  </div>
                  <div className={`rounded-xl p-2.5 border ${isDark ? "bg-[#131d31] border-slate-800" : "bg-white border-slate-200"}`}>
                    <div className="text-[9px] font-bold text-slate-500 uppercase tracking-wider">Current</div>
                    <div className="mt-1 font-mono font-extrabold text-[#ec4899] text-xs">
                      {getVal("dw4/current", scadaJitter.dw4Current)} A
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* TDS & pH meter sliders */}
            <div className="mt-4 space-y-3">
              <div>
                <div className="flex justify-between items-center text-xs font-semibold text-slate-500 mb-1">
                  <span>🟢 TDS Air Sumur</span>
                  <span className="font-mono font-bold text-slate-700 dark:text-slate-200">
                    {getVal("dw4/tds", scadaJitter.dw4Tds)} ppm
                  </span>
                </div>
                <div className="w-full bg-slate-100 dark:bg-slate-800 rounded-full h-1.5 overflow-hidden">
                  <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${(scadaJitter.dw4Tds / 400) * 100}%` }} />
                </div>
              </div>

              <div>
                <div className="flex justify-between items-center text-xs font-semibold text-slate-500 mb-1">
                  <span>🟣 pH Air Sumur</span>
                  <span className="font-mono font-bold text-slate-700 dark:text-slate-200">
                    {getVal("dw4/ph", scadaJitter.dw4Ph)} scale
                  </span>
                </div>
                <div className="w-full bg-slate-100 dark:bg-slate-800 rounded-full h-1.5 overflow-hidden">
                  <div className="h-full bg-indigo-500 rounded-full" style={{ width: `${(scadaJitter.dw4Ph / 14) * 100}%` }} />
                </div>
              </div>
            </div>

            {/* Footer details */}
            <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800 flex justify-between items-center text-[10px] font-bold text-slate-400">
              <div className="flex gap-3">
                <span>Voltage: 380V</span>
                <span>Runtime: 3,843.564h</span>
              </div>
              <button className={`h-6 w-6 rounded-lg flex items-center justify-center transition-colors ${dw4PumpState ? "bg-emerald-500/10 text-emerald-500 hover:bg-emerald-500/20" : "bg-slate-100 dark:bg-slate-800 text-slate-400"}`}>
                <IconPower />
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* ═══════════ SECTION F: TANGKI PENYIMPANAN (Mockup 3) ═══════════ */}
      <section className="space-y-4">
        <div className="flex items-center gap-2 border-b border-slate-100 dark:border-slate-800 pb-2">
          <div className="h-2 w-2 rounded-full bg-sky-500 animate-pulse" />
          <div>
            <h3 className="text-base font-bold text-slate-800 dark:text-white">Tangki Penyimpanan</h3>
            <p className="text-xs text-slate-400 mt-0.5">Monitoring level & aliran air tangki utama dan factory</p>
          </div>
        </div>

        <div className="grid gap-6 sm:grid-cols-3">
          {/* Tank-1 */}
          <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-sm space-y-4 flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="font-bold text-slate-800 dark:text-white">Tank-1</h4>
                <p className="text-[10px] text-slate-400">50K Liter Capacity</p>
              </div>
              <span className="text-xs font-bold text-emerald-500 font-mono">67%</span>
            </div>
            
            <TankLiquidIndicator percentage={scadaJitter.tank1Level} label="Water Level Tank-1" color="emerald" />

            <div className="grid grid-cols-2 gap-2 text-[10px] pt-2 border-t border-slate-100 dark:border-slate-800">
              <div className="text-center bg-slate-50 dark:bg-slate-800/40 p-2 rounded-lg">
                <span className="text-slate-400 block font-semibold uppercase">Inflow</span>
                <span className="font-mono font-bold text-slate-700 dark:text-slate-200 text-xs">
                  {scadaJitter.tank1Inflow} L/m
                </span>
              </div>
              <div className="text-center bg-slate-50 dark:bg-slate-800/40 p-2 rounded-lg">
                <span className="text-slate-400 block font-semibold uppercase">Outflow</span>
                <span className="font-mono font-bold text-slate-700 dark:text-slate-200 text-xs">
                  {scadaJitter.tank1Outflow} L/m
                </span>
              </div>
            </div>
          </div>

          {/* Tank-2 */}
          <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-sm space-y-4 flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="font-bold text-slate-800 dark:text-white">Tank-2</h4>
                <p className="text-[10px] text-slate-400">50K Liter Capacity</p>
              </div>
              <span className="text-xs font-bold text-sky-500 font-mono">92%</span>
            </div>
            
            <TankLiquidIndicator percentage={scadaJitter.tank2Level} label="Water Level Tank-2" color="sky" />

            <div className="grid grid-cols-2 gap-2 text-[10px] pt-2 border-t border-slate-100 dark:border-slate-800">
              <div className="text-center bg-slate-50 dark:bg-slate-800/40 p-2 rounded-lg">
                <span className="text-slate-400 block font-semibold uppercase">Inflow</span>
                <span className="font-mono font-bold text-slate-700 dark:text-slate-200 text-xs">
                  {scadaJitter.tank2Inflow} L/m
                </span>
              </div>
              <div className="text-center bg-slate-50 dark:bg-slate-800/40 p-2 rounded-lg">
                <span className="text-slate-400 block font-semibold uppercase">Outflow</span>
                <span className="font-mono font-bold text-slate-700 dark:text-slate-200 text-xs">
                  {scadaJitter.tank2Outflow} L/m
                </span>
              </div>
            </div>
          </div>

          {/* Factory-1 Tank */}
          <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-sm space-y-4 flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="font-bold text-slate-800 dark:text-white">Factory-1 Tank</h4>
                <p className="text-[10px] text-slate-400">100K Liter Capacity</p>
              </div>
              <span className="text-xs font-bold text-teal-500 font-mono">74%</span>
            </div>
            
            <TankLiquidIndicator percentage={scadaJitter.factoryTankLevel} label="Factory-1 Storage" color="teal" />

            <div className="grid grid-cols-2 gap-2 text-[10px] pt-2 border-t border-slate-100 dark:border-slate-800">
              <div className="text-center bg-slate-50 dark:bg-slate-800/40 p-2 rounded-lg">
                <span className="text-slate-400 block font-semibold uppercase">Inflow</span>
                <span className="font-mono font-bold text-slate-700 dark:text-slate-200 text-xs">
                  {scadaJitter.factoryTankInflow} L/m
                </span>
              </div>
              <div className="text-center bg-slate-50 dark:bg-slate-800/40 p-2 rounded-lg">
                <span className="text-slate-400 block font-semibold uppercase">Outflow</span>
                <span className="font-mono font-bold text-slate-700 dark:text-slate-200 text-xs">
                  {scadaJitter.factoryTankOutflow} L/m
                </span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ═══════════ SECTION G: TABEL KONSUMSI LENGKAP (Mockup 4) ═══════════ */}
      <section className={`rounded-2xl border transition-colors duration-200 ${isDark ? "border-slate-800/50 bg-[#080f1e] text-slate-100" : "border-slate-200 bg-white text-slate-800"} p-5 shadow-xl`}>
        <div className={`flex items-center gap-2 mb-4 border-b ${isDark ? "border-slate-800/80" : "border-slate-200"} pb-3`}>
          <span className="text-xl">📄</span>
          <div>
            <h3 className={`text-sm font-bold uppercase tracking-[0.2em] ${isDark ? "text-slate-400" : "text-slate-500"}`}>Tabel Konsumsi Lengkap</h3>
            <p className={`text-[10px] ${isDark ? "text-slate-500" : "text-slate-400"}`}>Detail konsumsi semua jalur distribusi</p>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className={`border-b ${isDark ? "border-slate-800" : "border-slate-200"} text-[10px] font-extrabold uppercase tracking-wider text-slate-500`}>
                <th className="py-2.5 px-3">Jalur</th>
                <th className="py-2.5 px-3">Sumber</th>
                <th className="py-2.5 px-3">Status</th>
                <th className="py-2.5 px-3 text-right">Flow (L/Min)</th>
                <th className="py-2.5 px-3 text-right">Pressure (Bar)</th>
                <th className="py-2.5 px-3 text-right">Harian (M³)</th>
                <th className="py-2.5 px-3 text-right">Bulanan (M³)</th>
              </tr>
            </thead>
            <tbody className={`divide-y ${isDark ? "divide-slate-800/50" : "divide-slate-200/50"} text-[11px]`}>
              {tableRows.map((row, i) => (
                <tr key={i} className={`hover:${isDark ? "bg-slate-800/30" : "bg-slate-50"} transition`}>
                  <td className={`py-2.5 px-3 font-semibold ${isDark ? "text-slate-300" : "text-slate-700"}`}>{row.jalur}</td>
                  <td className={`py-2.5 px-3 ${isDark ? "text-slate-500" : "text-slate-400"}`}>{row.sumber}</td>
                  <td className="py-2.5 px-3">
                    <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[9px] font-extrabold ${isDark ? "bg-emerald-500/10 text-emerald-400" : "bg-emerald-50 text-emerald-600"}`}>
                      <span className={`h-1.5 w-1.5 rounded-full ${isDark ? "bg-emerald-400" : "bg-emerald-500"} animate-pulse`} />
                      ON
                    </span>
                  </td>
                  <td className={`py-2.5 px-3 text-right font-mono ${isDark ? "text-cyan-400" : "text-cyan-600"} font-bold`}>{row.flow.toFixed(1)}</td>
                  <td className={`py-2.5 px-3 text-right font-mono ${isDark ? "text-indigo-400" : "text-indigo-600"}`}>{row.pressure.toFixed(1)}</td>
                  <td className={`py-2.5 px-3 text-right font-mono ${isDark ? "text-slate-300" : "text-slate-600"}`}>{row.harian.toFixed(1)}</td>
                  <td className={`py-2.5 px-3 text-right font-mono font-bold ${isDark ? "text-sky-400" : "text-sky-600"}`}>{row.bulanan.toLocaleString()}</td>
                </tr>
              ))}
              {/* TOTAL ROW */}
              <tr className={`${isDark ? "bg-slate-900/60 border-t border-slate-700" : "bg-slate-50 border-t border-slate-200"} text-xs font-bold font-mono`}>
                <td className={`py-3 px-3 uppercase ${isDark ? "text-white" : "text-slate-800"}`} colSpan={2}>Total</td>
                <td className="py-3 px-3"></td>
                <td className="py-3 px-3 text-right"></td>
                <td className="py-3 px-3 text-right"></td>
                <td className={`py-3 px-3 text-right ${isDark ? "text-cyan-400" : "text-cyan-600"} font-extrabold text-sm`}>{totalHarian.toFixed(1)}</td>
                <td className={`py-3 px-3 text-right ${isDark ? "text-emerald-400" : "text-emerald-600"} font-extrabold text-sm`}>{totalBulanan.toLocaleString()}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      {/* ═══════════ SECTION H: BIGGEST CONSUMPTION (Mockup 5) ═══════════ */}
      <section className="space-y-4">
        <div className="flex items-center gap-2 border-b border-slate-100 dark:border-slate-800 pb-2">
          <span className="text-xl">📊</span>
          <div>
            <h3 className="text-base font-bold text-slate-800 dark:text-white">Biggest Consumption</h3>
          </div>
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          {/* Factory-1 */}
          <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-sm">
            <h4 className="font-bold text-slate-800 dark:text-white mb-4">Factory-1</h4>
            <div style={{ height: 200 }}>
              <Bar
                data={{
                  labels: ["Production", "Cooling", "Purified", "WWTP", "Sanitary"],
                  datasets: [
                    {
                      label: "Consump. m³",
                      data: [180, 110, 95, 60, 45],
                      backgroundColor: "rgba(59, 130, 246, 0.8)",
                      borderRadius: 4
                    }
                  ]
                }}
                options={{
                  responsive: true,
                  maintainAspectRatio: false,
                  indexAxis: "y" as const,
                  plugins: { legend: { display: false } },
                  scales: {
                    x: { grid: { display: false }, ticks: { font: { size: 9 }, color: "#64748b" } },
                    y: { grid: { display: false }, ticks: { font: { size: 9 }, color: "#64748b" } }
                  }
                }}
              />
            </div>
          </div>

          {/* Factory-2 */}
          <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-sm">
            <h4 className="font-bold text-slate-800 dark:text-white mb-4">Factory-2</h4>
            <div style={{ height: 200 }}>
              <Bar
                data={{
                  labels: ["Production", "Cooling", "WFI", "Boiler", "Sanitary"],
                  datasets: [
                    {
                      label: "Consump. m³",
                      data: [150, 90, 80, 55, 30],
                      backgroundColor: "rgba(16, 185, 129, 0.8)",
                      borderRadius: 4
                    }
                  ]
                }}
                options={{
                  responsive: true,
                  maintainAspectRatio: false,
                  indexAxis: "y" as const,
                  plugins: { legend: { display: false } },
                  scales: {
                    x: { grid: { display: false }, ticks: { font: { size: 9 }, color: "#64748b" } },
                    y: { grid: { display: false }, ticks: { font: { size: 9 }, color: "#64748b" } }
                  }
                }}
              />
            </div>
          </div>
        </div>
      </section>

      {/* ═══════════ CONFIGURATION MODAL (API Sources) ═══════════ */}
      {showConfigPanel && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm" onClick={() => setShowConfigPanel(false)}>
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl w-full max-w-3xl p-6 space-y-4 max-h-[80vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold uppercase tracking-wide text-slate-700 dark:text-white">Konfigurasi Water Overview</h3>
                <p className="text-xs text-slate-400 mt-0.5">Kelola API Sources dan mapping untuk telemetri air.</p>
              </div>
              <button onClick={() => setShowConfigPanel(false)} className="text-slate-400 hover:text-slate-600 text-lg font-bold">✕</button>
            </div>

            <div className="border border-slate-200 dark:border-slate-800 rounded-xl p-5 space-y-4">
              <h4 className="text-xs font-extrabold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1">🔌 API Sources - Water Telemetry</h4>
              <ApiSourcesPanel unitId="water" />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
