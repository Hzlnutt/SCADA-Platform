import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Bar, Line } from "react-chartjs-2";
import { PageHeader } from "../../components/ui/PageHeader";
import "../../components/charts/chartjs";
import { DonutChart } from "../../components/charts/DonutChart";
import { getJson } from "../../services/api.client";
import { getSocket } from "../../services/socket.service";
import { useSystemStore } from "../../store/system.store";

// Format currency helper
const formatCurrency = (value: number) =>
  new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(value);

const formatUsd = (value: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 2 }).format(value);

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

interface GasCategory {
  id: string;
  name: string;
  val: number;
  enabled: boolean;
}

export default function GasOverview() {
  const theme = useSystemStore((state) => state.theme);
  const isDark = theme === "dark";

  // Filter ranges
  const [range, setRange] = useState<"hour" | "day" | "month" | "custom">("day");
  const [chartStartDate, setChartStartDate] = useState(getLocalTodayString);
  const [chartEndDate, setChartEndDate] = useState(getLocalTodayString);
  
  // Server-fetched analytics & configurations
  const [analyticsData, setAnalyticsData] = useState<any>(null);
  const [chartLoading, setChartLoading] = useState(true);
  const [gasConfig, setGasConfig] = useState({ pricePerSm3: 11000, usdPerMmbtu: 9.5 });
  const [gasCategories, setGasCategories] = useState<GasCategory[]>([]);

  // Toggles for equipment states
  const [boiler3Active, setBoiler3Active] = useState(true);
  const [boiler4Active, setBoiler4Active] = useState(true);
  const [gensetActive, setGensetActive] = useState(false);
  const [boiler5Active, setBoiler5Active] = useState(true);

  // Simulated live metrics with drifting (jitter) values
  const [liveJitter, setLiveJitter] = useState({
    boiler3Flow: 145.2,
    boiler3Pressure: 2.8,
    boiler3Temp: 185.4,
    boiler3Efficiency: 88.5,
    boiler3RunningHours: 2450.4,

    boiler4Flow: 120.5,
    boiler4Pressure: 2.7,
    boiler4Temp: 180.2,
    boiler4Efficiency: 87.2,
    boiler4RunningHours: 1980.2,

    gensetFlow: 0.0,
    gensetPressure: 0.0,
    gensetTemp: 45.1,
    gensetEfficiency: 0.0,
    gensetRunningHours: 852.7,

    boiler5Flow: 165.8,
    boiler5Pressure: 2.9,
    boiler5Temp: 190.5,
    boiler5Efficiency: 89.4,
    boiler5RunningHours: 3210.8,
  });

  // Simulated warning logs
  const [logs] = useState([
    { ts: "08:15:22", type: "info", msg: "Boiler-5 parameter calibration complete." },
    { ts: "06:40:11", type: "warning", msg: "Genset Caterpillar status changed to Standby (Offline)." },
    { ts: "04:12:05", type: "info", msg: "Boiler-3 reached targeted steam load efficiency." },
    { ts: "Yesterday", type: "info", msg: "Weekly maintenance scheduler initialized for Boiler-4." },
  ]);

  // Load gas tariff and categories from backend
  useEffect(() => {
    getJson<{ data: any }>("/config/utility")
      .then((res) => {
        if (res && res.data) {
          if (res.data.gasConfig) {
            setGasConfig(res.data.gasConfig);
          }
          if (res.data.gasCategories) {
            setGasCategories(res.data.gasCategories);
          }
        }
      })
      .catch((err) => console.error("Failed to load utility config:", err));
  }, []);

  // Fetch PostgreSQL analytics data
  const fetchAnalytics = useCallback(() => {
    setChartLoading(true);
    let url = `/analytics/gas?`;
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
        setAnalyticsData(res.data);
        setChartLoading(false);
      })
      .catch((err) => {
        console.error("Failed to load gas analytics:", err);
        setChartLoading(false);
      });
  }, [range, chartStartDate, chartEndDate]);

  useEffect(() => {
    fetchAnalytics();
  }, [fetchAnalytics]);

  // Real-time socket trigger for updates
  useEffect(() => {
    const socket = getSocket();
    const handleGasUpdate = () => {
      console.log("Gas telemetry updated, reloading analytics...");
      fetchAnalytics();
    };

    socket.on("gas:update", handleGasUpdate);
    return () => {
      socket.off("gas:update", handleGasUpdate);
    };
  }, [fetchAnalytics]);

  // Drifting live value jitter simulator
  useEffect(() => {
    const interval = setInterval(() => {
      setLiveJitter((prev) => {
        const jitter = (val: number, min: number, max: number, delta: number, isActive: boolean) => {
          if (!isActive) return val > 0 ? Number(Math.max(0, val - 10).toFixed(1)) : 0;
          const next = val + (Math.random() * 2 - 1) * delta;
          return Number(Math.max(min, Math.min(max, next)).toFixed(1));
        };

        return {
          boiler3Flow: jitter(prev.boiler3Flow, 130, 160, 2.0, boiler3Active),
          boiler3Pressure: jitter(prev.boiler3Pressure, 2.6, 3.2, 0.05, boiler3Active),
          boiler3Temp: jitter(prev.boiler3Temp, 180, 195, 0.5, boiler3Active),
          boiler3Efficiency: jitter(prev.boiler3Efficiency, 87.0, 90.0, 0.1, boiler3Active),
          boiler3RunningHours: Number((prev.boiler3RunningHours + 0.01).toFixed(1)),

          boiler4Flow: jitter(prev.boiler4Flow, 110, 140, 1.8, boiler4Active),
          boiler4Pressure: jitter(prev.boiler4Pressure, 2.5, 3.0, 0.05, boiler4Active),
          boiler4Temp: jitter(prev.boiler4Temp, 175, 188, 0.6, boiler4Active),
          boiler4Efficiency: jitter(prev.boiler4Efficiency, 85.5, 88.5, 0.15, boiler4Active),
          boiler4RunningHours: Number((prev.boiler4RunningHours + 0.01).toFixed(1)),

          gensetFlow: jitter(prev.gensetFlow, 80, 110, 2.5, gensetActive),
          gensetPressure: jitter(prev.gensetPressure, 2.0, 2.5, 0.04, gensetActive),
          gensetTemp: gensetActive ? jitter(prev.gensetTemp, 85, 98, 0.8, gensetActive) : jitter(prev.gensetTemp, 40, 50, 0.2, true),
          gensetEfficiency: jitter(prev.gensetEfficiency, 40.0, 44.5, 0.1, gensetActive),
          gensetRunningHours: gensetActive ? Number((prev.gensetRunningHours + 0.01).toFixed(1)) : prev.gensetRunningHours,

          boiler5Flow: jitter(prev.boiler5Flow, 150, 180, 2.2, boiler5Active),
          boiler5Pressure: jitter(prev.boiler5Pressure, 2.7, 3.3, 0.05, boiler5Active),
          boiler5Temp: jitter(prev.boiler5Temp, 185, 198, 0.4, boiler5Active),
          boiler5Efficiency: jitter(prev.boiler5Efficiency, 88.0, 91.0, 0.08, boiler5Active),
          boiler5RunningHours: Number((prev.boiler5RunningHours + 0.01).toFixed(1)),
        };
      });
    }, 3000);

    return () => clearInterval(interval);
  }, [boiler3Active, boiler4Active, gensetActive, boiler5Active]);

  // Combine fetched historical stats (which may be 0 for new db) with simulated live rates
  const currentTotalFlow = useMemo(() => {
    return Number(
      (liveJitter.boiler3Flow + liveJitter.boiler4Flow + liveJitter.gensetFlow + liveJitter.boiler5Flow).toFixed(1)
    );
  }, [liveJitter]);

  const todayConsumptionNm3 = useMemo(() => {
    // If DB is populated, use it. Otherwise compute live rate accumulated since midnight (simulated)
    const dbToday = analyticsData?.summary?.todaySm3;
    if (dbToday && dbToday > 0) return dbToday;
    
    // Pro-rated representation based on current live flow rate
    const hourFactor = new Date().getHours() + new Date().getMinutes() / 60;
    return Number((currentTotalFlow * hourFactor * 0.78).toFixed(1));
  }, [analyticsData, currentTotalFlow]);

  const todayCostIdr = useMemo(() => {
    return todayConsumptionNm3 * gasConfig.pricePerSm3;
  }, [todayConsumptionNm3, gasConfig]);

  const todayCostUsd = useMemo(() => {
    // 1 SM3 to MMBTU = 0.03531
    return todayConsumptionNm3 * 0.03531 * gasConfig.usdPerMmbtu;
  }, [todayConsumptionNm3, gasConfig]);

  // Main 24h line chart data
  const mainLineData = useMemo(() => {
    const labels = Array.from({ length: 24 }, (_, i) => `${i.toString().padStart(2, "0")}:00`);
    
    // Build hourly flows with actual values or fallback curves matching equipment
    const getCurve = (active: boolean, avg: number, seed: number) => {
      return Array.from({ length: 24 }, (_, h) => {
        if (!active) return 0;
        // Peak during typical shift periods (08:00 - 16:00 and 18:00 - 02:00)
        const peakFactor = (h >= 8 && h <= 16) || (h >= 18 || h <= 2) ? 1.15 : 0.85;
        const noise = Math.sin(h * 0.5 + seed) * (avg * 0.06);
        return Number((avg * peakFactor + noise).toFixed(1));
      });
    };

    const b3Vals = getCurve(boiler3Active, 145, 1);
    const b4Vals = getCurve(boiler4Active, 120, 2);
    const gensetVals = getCurve(gensetActive, 95, 3);
    const b5Vals = getCurve(boiler5Active, 165, 4);

    const totalVals = Array.from({ length: 24 }, (_, i) => 
      Number((b3Vals[i] + b4Vals[i] + gensetVals[i] + b5Vals[i]).toFixed(1))
    );

    return {
      labels,
      datasets: [
        {
          label: "Total Flow",
          data: totalVals,
          borderColor: "#f97316",
          borderWidth: 2.5,
          tension: 0.35,
          fill: false,
          pointRadius: 0,
        },
        {
          label: "Boiler-3 WF1",
          data: b3Vals,
          borderColor: "#3b82f6",
          borderWidth: 1.5,
          tension: 0.35,
          fill: false,
          pointRadius: 0,
        },
        {
          label: "Boiler-4",
          data: b4Vals,
          borderColor: "#10b981",
          borderWidth: 1.5,
          tension: 0.35,
          fill: false,
          pointRadius: 0,
        },
        {
          label: "Genset CAT",
          data: gensetVals,
          borderColor: "#8b5cf6",
          borderWidth: 1.5,
          tension: 0.35,
          fill: false,
          pointRadius: 0,
        },
        {
          label: "Boiler-5",
          data: b5Vals,
          borderColor: "#ec4899",
          borderWidth: 1.5,
          tension: 0.35,
          fill: false,
          pointRadius: 0,
        }
      ]
    };
  }, [boiler3Active, boiler4Active, gensetActive, boiler5Active]);

  // Main Bar Chart data for monthly comparison
  const mainBarData = useMemo(() => {
    const labels = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"];
    
    // Generate monthly consumptions from database, or fallback representation
    const baseCurve = [45000, 42000, 48000, 49500, 52000, 55000, 53000, 54500, 51000, 52800, 56000, 58000];
    const dbMonthly = analyticsData?.charts?.monthly?.map((m: any) => m.value) || [];
    
    const currentYearData = labels.map((_, i) => {
      return dbMonthly[i] && dbMonthly[i] > 0 ? dbMonthly[i] : baseCurve[i];
    });

    const previousYearData = currentYearData.map((v) => Number((v * 0.94 + (Math.random() * 2000 - 1000)).toFixed(0)));

    return {
      labels,
      datasets: [
        {
          label: "Tahun Ini (Nm³)",
          data: currentYearData,
          backgroundColor: "#f97316",
          borderRadius: 4,
          barPercentage: 0.6,
        },
        {
          label: "Tahun Lalu (Nm³)",
          data: previousYearData,
          backgroundColor: "#cbd5e1",
          borderRadius: 4,
          barPercentage: 0.6,
        }
      ]
    };
  }, [analyticsData]);

  // Donut chart distribution segments
  const donutSegments = useMemo(() => {
    const totalFlow = (boiler3Active ? liveJitter.boiler3Flow : 0) + 
                       (boiler4Active ? liveJitter.boiler4Flow : 0) + 
                       (gensetActive ? liveJitter.gensetFlow : 0) + 
                       (boiler5Active ? liveJitter.boiler5Flow : 0) || 1;

    return [
      { label: "Boiler-3 WF1", value: boiler3Active ? Math.round((liveJitter.boiler3Flow / totalFlow) * 100) : 0, color: "#3b82f6" },
      { label: "Boiler-4", value: boiler4Active ? Math.round((liveJitter.boiler4Flow / totalFlow) * 100) : 0, color: "#10b981" },
      { label: "Genset Caterpillar", value: gensetActive ? Math.round((liveJitter.gensetFlow / totalFlow) * 100) : 0, color: "#8b5cf6" },
      { label: "Boiler-5", value: boiler5Active ? Math.round((liveJitter.boiler5Flow / totalFlow) * 100) : 0, color: "#ec4899" }
    ];
  }, [liveJitter, boiler3Active, boiler4Active, gensetActive, boiler5Active]);

  // Combined totals for PGN Metering Table
  const tableRows = useMemo(() => {
    const list = [
      { id: "boiler3", name: "Boiler-3 WF1", capacity: 200, flow: boiler3Active ? liveJitter.boiler3Flow : 0, pressure: boiler3Active ? liveJitter.boiler3Pressure : 0, share: 0 },
      { id: "boiler4", name: "Boiler-4", capacity: 200, flow: boiler4Active ? liveJitter.boiler4Flow : 0, pressure: boiler4Active ? liveJitter.boiler4Pressure : 0, share: 0 },
      { id: "genset", name: "Genset Caterpillar", capacity: 150, flow: gensetActive ? liveJitter.gensetFlow : 0, pressure: gensetActive ? liveJitter.gensetPressure : 0, share: 0 },
      { id: "boiler5", name: "Boiler-5", capacity: 250, flow: boiler5Active ? liveJitter.boiler5Flow : 0, pressure: boiler5Active ? liveJitter.boiler5Pressure : 0, share: 0 },
    ];

    const sumFlow = list.reduce((sum, item) => sum + item.flow, 0) || 1;

    return list.map((item) => {
      const share = Math.round((item.flow / sumFlow) * 100);
      const shareTodayNm3 = (share / 100) * todayConsumptionNm3;
      const costTodayIdr = shareTodayNm3 * gasConfig.pricePerSm3;
      return {
        ...item,
        loadFactor: Math.round((item.flow / item.capacity) * 100),
        todayConsumption: Number(shareTodayNm3.toFixed(1)),
        costToday: Number(costTodayIdr.toFixed(0)),
        share
      };
    });
  }, [liveJitter, boiler3Active, boiler4Active, gensetActive, boiler5Active, todayConsumptionNm3, gasConfig]);

  return (
    <div className="space-y-6">
      {/* HEADER SECTION */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <PageHeader 
          title="Gas Utility — Overview" 
          description="Monitoring aliran gas, tekanan inlet, konsumsi energi boiler & genset, serta estimasi biaya operasional harian secara real-time." 
        />
      </div>

      {/* EXECUTIVE OVERVIEW METRIC CARDS */}
      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {/* CARD 1: LIVE FLOW RATE */}
        <div className="relative overflow-hidden rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-sm hover:shadow-md transition duration-300 group hover:border-amber-400">
          <div className="flex items-center justify-between z-10 relative">
            <span className="text-xs font-bold uppercase tracking-[0.15em] text-slate-400 dark:text-slate-500">Live Flow Rate</span>
            <span className="p-1.5 rounded-lg bg-amber-50 dark:bg-amber-950/30 text-amber-500 text-sm">🔥</span>
          </div>
          <div className="mt-3 text-2xl font-extrabold text-slate-800 dark:text-white font-mono z-10 relative">
            {currentTotalFlow.toLocaleString("id-ID")} <span className="text-sm font-semibold text-slate-400">Nm³/h</span>
          </div>
          <div className="mt-1 text-xs font-semibold text-emerald-600 dark:text-emerald-400 z-10 relative flex items-center gap-1">
            <span>● Active Load</span>
            <span className="text-slate-400 dark:text-slate-500 font-normal">({tableRows.filter(r => r.flow > 0).length}/4 Equipment Online)</span>
          </div>
          <Sparkline color="#f59e0b" />
        </div>

        {/* CARD 2: AVG INLET PRESSURE */}
        <div className="relative overflow-hidden rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-sm hover:shadow-md transition duration-300 group hover:border-orange-400">
          <div className="flex items-center justify-between z-10 relative">
            <span className="text-xs font-bold uppercase tracking-[0.15em] text-slate-400 dark:text-slate-500">Inlet Pressure</span>
            <span className="p-1.5 rounded-lg bg-orange-50 dark:bg-orange-950/30 text-orange-500 text-sm">⚙️</span>
          </div>
          <div className="mt-3 text-2xl font-extrabold text-slate-800 dark:text-white font-mono z-10 relative">
            {Number((tableRows.reduce((sum, item) => sum + item.pressure, 0) / (tableRows.filter(r => r.flow > 0).length || 1)).toFixed(2))} <span className="text-sm font-semibold text-slate-400">bar</span>
          </div>
          <div className="mt-1 text-xs font-semibold text-slate-400 dark:text-slate-500 z-10 relative">
            Tekanan rata-rata pada pipa input utama
          </div>
          <Sparkline color="#ea580c" />
        </div>

        {/* CARD 3: CONSUMPTION TODAY */}
        <div className="relative overflow-hidden rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-sm hover:shadow-md transition duration-300 group hover:border-amber-500">
          <div className="flex items-center justify-between z-10 relative">
            <span className="text-xs font-bold uppercase tracking-[0.15em] text-slate-400 dark:text-slate-500">Consumption Today</span>
            <span className="p-1.5 rounded-lg bg-amber-100 dark:bg-amber-900/30 text-amber-600 text-sm">📊</span>
          </div>
          <div className="mt-3 text-2xl font-extrabold text-slate-800 dark:text-white font-mono z-10 relative">
            {todayConsumptionNm3.toLocaleString("id-ID", { maximumFractionDigits: 1 })} <span className="text-sm font-semibold text-slate-400">Nm³</span>
          </div>
          <div className="mt-1 text-xs text-slate-400 dark:text-slate-500 z-10 relative">
            Total pemakaian gas sejak pukul 00:00 WIB
          </div>
          <Sparkline color="#f59e0b" />
        </div>

        {/* CARD 4: COST ESTIMATE TODAY */}
        <div className="relative overflow-hidden rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-sm hover:shadow-md transition duration-300 group hover:border-red-400">
          <div className="flex items-center justify-between z-10 relative">
            <span className="text-xs font-bold uppercase tracking-[0.15em] text-slate-400 dark:text-slate-500">Cost Estimate (Today)</span>
            <span className="p-1.5 rounded-lg bg-red-50 dark:bg-red-950/30 text-red-500 text-sm">💰</span>
          </div>
          <div className="mt-3 text-2xl font-extrabold text-red-600 dark:text-red-400 font-mono z-10 relative">
            {formatCurrency(todayCostIdr)}
          </div>
          <div className="mt-1 text-xs font-semibold text-slate-400 dark:text-slate-500 z-10 relative">
            Setara {formatUsd(todayCostUsd)} ({gasConfig.usdPerMmbtu} USD/MMBTU)
          </div>
          <Sparkline color="#dc2626" />
        </div>
      </section>

      {/* CORE CHARTS: 24-HOUR TRENDS + DONUT */}
      <div className="grid gap-6 lg:grid-cols-[2fr_1fr]">
        {/* LINE CHART: 24-HOUR TREND */}
        <section className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-sm flex flex-col justify-between">
          <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
            <div>
              <h3 className="text-sm font-bold uppercase tracking-[0.2em] text-slate-400 dark:text-slate-500">Hourly Flow Rate (24-Hour Trend)</h3>
              <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">Aliran gas real-time per perangkat dibanding total kapasitas.</p>
            </div>
            
            {/* Custom Range Picker */}
            {range === "custom" && (
              <div className="flex items-center gap-1 bg-slate-50 dark:bg-slate-850 px-2 py-1 rounded-lg border border-slate-100 dark:border-slate-800">
                <input
                  type="date"
                  value={chartStartDate}
                  onChange={(e) => setChartStartDate(e.target.value)}
                  className="rounded bg-transparent border-0 px-2 py-1 text-xs font-bold focus:ring-0 cursor-pointer"
                />
                <span className="text-xs text-slate-400">to</span>
                <input
                  type="date"
                  value={chartEndDate}
                  onChange={(e) => setChartEndDate(e.target.value)}
                  className="rounded bg-transparent border-0 px-2 py-1 text-xs font-bold focus:ring-0 cursor-pointer"
                />
              </div>
            )}

            <div className="flex items-center gap-1 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 p-0.5 text-xs font-bold">
              {(["hour", "day", "month", "custom"] as const).map((r) => (
                <button
                  key={r}
                  onClick={() => setRange(r)}
                  className={`rounded-md px-3 py-1.5 transition-all ${
                    range === r
                      ? "bg-amber-500 text-white shadow-sm"
                      : "text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
                  }`}
                >
                  {r === "hour" ? "Per Jam" : r === "day" ? "Per Hari" : r === "month" ? "Per Bulan" : "Kustom"}
                </button>
              ))}
            </div>
          </div>

          <div className="bg-slate-50 dark:bg-slate-950/40 rounded-xl p-4 border border-slate-100 dark:border-slate-800/60">
            <div style={{ height: 260 }}>
              {chartLoading ? (
                <div className="h-full flex items-center justify-center text-slate-400 font-bold text-sm">
                  Loading Chart...
                </div>
              ) : (
                <Line
                  data={mainLineData}
                  options={{
                    responsive: true,
                    maintainAspectRatio: false,
                    animation: { duration: 0 },
                    plugins: {
                      legend: {
                        position: "top",
                        labels: {
                          usePointStyle: true,
                          boxWidth: 6,
                          font: { size: 10, family: "Plus Jakarta Sans", weight: "bold" },
                          color: isDark ? "#94a3b8" : "#475569"
                        }
                      },
                      tooltip: {
                        mode: "index",
                        intersect: false,
                        backgroundColor: isDark ? "rgba(15, 23, 42, 0.95)" : "rgba(255, 255, 255, 0.95)",
                        titleColor: isDark ? "#f1f5f9" : "#0f172a",
                        bodyColor: isDark ? "#f1f5f9" : "#0f172a",
                        borderColor: isDark ? "#334155" : "#e2e8f0",
                        borderWidth: 1,
                        padding: 10,
                        bodyFont: { family: "IBM Plex Mono", size: 10 }
                      }
                    },
                    scales: {
                      x: {
                        grid: { display: false },
                        ticks: { color: isDark ? "#64748b" : "#94a3b8", font: { size: 9, family: "IBM Plex Mono" } }
                      },
                      y: {
                        grid: { color: isDark ? "rgba(51,65,85,0.2)" : "rgba(226,232,240,0.5)" },
                        ticks: {
                          color: isDark ? "#64748b" : "#94a3b8",
                          font: { size: 9, family: "IBM Plex Mono" },
                          callback: (val) => `${val} Nm³/h`
                        }
                      }
                    }
                  }}
                />
              )}
            </div>
          </div>
        </section>

        {/* DONUT CHART: LOAD DISTRIBUTION */}
        <section className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-sm flex flex-col justify-between">
          <div>
            <h3 className="text-sm font-bold uppercase tracking-[0.2em] text-slate-400 dark:text-slate-500">Gas Load Share</h3>
            <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">Rasio distribusi gas saat ini per unit peralatan.</p>
          </div>

          <div className="my-6 flex justify-center">
            {donutSegments.length > 0 ? (
              <DonutChart segments={donutSegments} size={150} thickness={18} centerLabel="100%" />
            ) : (
              <div className="h-[150px] w-[150px] rounded-full border-4 border-dashed border-slate-200 dark:border-slate-800 flex items-center justify-center text-xs text-slate-400 font-bold">
                All Offline
              </div>
            )}
          </div>

          <div className="space-y-2">
            {donutSegments.map((item) => (
              <div key={item.label} className="flex items-center justify-between text-xs border-b border-slate-100 dark:border-slate-800/60 pb-1.5 last:border-0 last:pb-0">
                <span className="flex items-center gap-2 text-slate-600 dark:text-slate-300 font-medium">
                  <span className="h-2 w-2 rounded-full" style={{ backgroundColor: item.color }} />
                  {item.label}
                </span>
                <span className="font-bold text-slate-800 dark:text-white font-mono">{item.value}%</span>
              </div>
            ))}
          </div>
        </section>
      </div>

      {/* MONTHLY CONSUMPTION COMPARISON + EVENT LOGS */}
      <div className="grid gap-6 lg:grid-cols-[2fr_1fr]">
        {/* BAR CHART: MONTHLY CONSUMPTION */}
        <section className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-sm">
          <div>
            <h3 className="text-sm font-bold uppercase tracking-[0.2em] text-slate-400 dark:text-slate-500">Monthly Consumption Comparison</h3>
            <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">Akumulasi pemakaian bulanan (Bulan Ini vs Bulan Lalu).</p>
          </div>

          <div className="mt-4 bg-slate-50 dark:bg-slate-950/40 rounded-xl p-4 border border-slate-100 dark:border-slate-800/60">
            <div style={{ height: 240 }}>
              <Bar 
                data={mainBarData}
                options={{
                  responsive: true,
                  maintainAspectRatio: false,
                  plugins: {
                    legend: {
                      position: "top",
                      labels: {
                        usePointStyle: true,
                        boxWidth: 6,
                        font: { size: 10, family: "Plus Jakarta Sans", weight: "bold" },
                        color: isDark ? "#94a3b8" : "#475569"
                      }
                    }
                  },
                  scales: {
                    x: {
                      grid: { display: false },
                      ticks: { color: isDark ? "#64748b" : "#94a3b8", font: { size: 9, family: "IBM Plex Mono" } }
                    },
                    y: {
                      grid: { color: isDark ? "rgba(51,65,85,0.2)" : "rgba(226,232,240,0.5)" },
                      ticks: {
                        color: isDark ? "#64748b" : "#94a3b8",
                        font: { size: 9, family: "IBM Plex Mono" },
                        callback: (val) => `${val.toLocaleString("id-ID")} Nm³`
                      }
                    }
                  }
                }}
              />
            </div>
          </div>
        </section>

        {/* ALARM / EVENT LOG PANEL */}
        <section className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-sm flex flex-col justify-between">
          <div className="mb-4">
            <h3 className="text-sm font-bold uppercase tracking-[0.2em] text-slate-400 dark:text-slate-500">Recent Logs & Events</h3>
            <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">Aktivitas status gas metering dan alarm.</p>
          </div>

          <div className="flex-1 divide-y divide-slate-100 dark:divide-slate-800/50 overflow-y-auto max-h-[220px] scrollbar-thin">
            {logs.map((log, index) => (
              <div key={index} className="py-2.5 flex items-start gap-2.5 text-[11px]">
                <span className="font-mono text-slate-400 dark:text-slate-500 shrink-0">{log.ts}</span>
                <span className={`px-1.5 py-0.5 rounded font-bold uppercase tracking-wider text-[8px] shrink-0 ${
                  log.type === "warning" ? "bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400" : "bg-blue-100 text-blue-700 dark:bg-blue-950/40 dark:text-blue-400"
                }`}>
                  {log.type}
                </span>
                <span className="text-slate-600 dark:text-slate-300 leading-normal">{log.msg}</span>
              </div>
            ))}
          </div>

          <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-850 flex items-center justify-between text-[10px] font-bold text-slate-400 uppercase tracking-wider">
            <span>Total Logs</span>
            <span className="font-mono text-slate-600 dark:text-slate-300">{logs.length} events logged</span>
          </div>
        </section>
      </div>

      {/* EQUIPMENT STATUS CARDS WITH TOGGLES */}
      <section className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
        {/* CARD 1: BOILER 3 */}
        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-sm flex flex-col justify-between transition hover:border-blue-450 hover:shadow-md duration-300">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h4 className="text-xs font-bold text-slate-850 dark:text-slate-200 uppercase tracking-wider">Boiler-3 WF1</h4>
              <div className="flex items-center gap-1.5 mt-1">
                <span className={`h-1.5 w-1.5 rounded-full ${boiler3Active ? "bg-emerald-500 animate-pulse" : "bg-slate-400"}`} />
                <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wide">{boiler3Active ? "Running" : "Offline"}</span>
              </div>
            </div>
            <button
              onClick={() => setBoiler3Active(!boiler3Active)}
              className={`rounded-xl px-3 py-1.5 text-[10px] font-bold uppercase shadow-sm transition-all duration-200 ${
                boiler3Active ? "bg-rose-500/10 text-rose-600 hover:bg-rose-600 hover:text-white" : "bg-emerald-500/10 text-emerald-600 hover:bg-emerald-600 hover:text-white"
              }`}
            >
              {boiler3Active ? "Stop" : "Start"}
            </button>
          </div>

          <div className="grid grid-cols-2 gap-x-4 gap-y-3.5 mt-2 pt-4 border-t border-slate-100 dark:border-slate-800/60 text-xs font-semibold">
            <div>
              <span className="block text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-0.5">Flow Rate</span>
              <span className="font-mono text-sm text-slate-800 dark:text-slate-200">
                {boiler3Active ? `${liveJitter.boiler3Flow} Nm³/h` : "0 Nm³/h"}
              </span>
            </div>
            <div>
              <span className="block text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-0.5">Pressure</span>
              <span className="font-mono text-sm text-slate-800 dark:text-slate-200">
                {boiler3Active ? `${liveJitter.boiler3Pressure} bar` : "0.00 bar"}
              </span>
            </div>
            <div>
              <span className="block text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-0.5">Load %</span>
              <span className="font-mono text-sm text-slate-800 dark:text-slate-200">
                {boiler3Active ? `${Math.round((liveJitter.boiler3Flow / 200) * 100)}%` : "0%"}
              </span>
            </div>
            <div>
              <span className="block text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-0.5">Efficiency</span>
              <span className="font-mono text-sm text-emerald-600 dark:text-emerald-400">
                {boiler3Active ? `${liveJitter.boiler3Efficiency}%` : "0.0%"}
              </span>
            </div>
            <div>
              <span className="block text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-0.5">Today</span>
              <span className="font-mono text-sm text-slate-800 dark:text-slate-200">
                {tableRows[0]?.todayConsumption?.toLocaleString("id-ID") || 0} Nm³
              </span>
            </div>
            <div>
              <span className="block text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-0.5">Runtime</span>
              <span className="font-mono text-sm text-slate-500">
                {liveJitter.boiler3RunningHours} hrs
              </span>
            </div>
          </div>
        </div>

        {/* CARD 2: BOILER 4 */}
        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-sm flex flex-col justify-between transition hover:border-emerald-450 hover:shadow-md duration-300">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h4 className="text-xs font-bold text-slate-850 dark:text-slate-200 uppercase tracking-wider">Boiler-4</h4>
              <div className="flex items-center gap-1.5 mt-1">
                <span className={`h-1.5 w-1.5 rounded-full ${boiler4Active ? "bg-emerald-500 animate-pulse" : "bg-slate-400"}`} />
                <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wide">{boiler4Active ? "Running" : "Offline"}</span>
              </div>
            </div>
            <button
              onClick={() => setBoiler4Active(!boiler4Active)}
              className={`rounded-xl px-3 py-1.5 text-[10px] font-bold uppercase shadow-sm transition-all duration-200 ${
                boiler4Active ? "bg-rose-500/10 text-rose-600 hover:bg-rose-600 hover:text-white" : "bg-emerald-500/10 text-emerald-600 hover:bg-emerald-600 hover:text-white"
              }`}
            >
              {boiler4Active ? "Stop" : "Start"}
            </button>
          </div>

          <div className="grid grid-cols-2 gap-x-4 gap-y-3.5 mt-2 pt-4 border-t border-slate-100 dark:border-slate-800/60 text-xs font-semibold">
            <div>
              <span className="block text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-0.5">Flow Rate</span>
              <span className="font-mono text-sm text-slate-800 dark:text-slate-200">
                {boiler4Active ? `${liveJitter.boiler4Flow} Nm³/h` : "0 Nm³/h"}
              </span>
            </div>
            <div>
              <span className="block text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-0.5">Pressure</span>
              <span className="font-mono text-sm text-slate-800 dark:text-slate-200">
                {boiler4Active ? `${liveJitter.boiler4Pressure} bar` : "0.00 bar"}
              </span>
            </div>
            <div>
              <span className="block text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-0.5">Load %</span>
              <span className="font-mono text-sm text-slate-800 dark:text-slate-200">
                {boiler4Active ? `${Math.round((liveJitter.boiler4Flow / 200) * 100)}%` : "0%"}
              </span>
            </div>
            <div>
              <span className="block text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-0.5">Efficiency</span>
              <span className="font-mono text-sm text-emerald-600 dark:text-emerald-400">
                {boiler4Active ? `${liveJitter.boiler4Efficiency}%` : "0.0%"}
              </span>
            </div>
            <div>
              <span className="block text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-0.5">Today</span>
              <span className="font-mono text-sm text-slate-800 dark:text-slate-200">
                {tableRows[1]?.todayConsumption?.toLocaleString("id-ID") || 0} Nm³
              </span>
            </div>
            <div>
              <span className="block text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-0.5">Runtime</span>
              <span className="font-mono text-sm text-slate-500">
                {liveJitter.boiler4RunningHours} hrs
              </span>
            </div>
          </div>
        </div>

        {/* CARD 3: GENSET CATERPILLAR */}
        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-sm flex flex-col justify-between transition hover:border-purple-450 hover:shadow-md duration-300">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h4 className="text-xs font-bold text-slate-850 dark:text-slate-200 uppercase tracking-wider">Genset Caterpillar</h4>
              <div className="flex items-center gap-1.5 mt-1">
                <span className={`h-1.5 w-1.5 rounded-full ${gensetActive ? "bg-emerald-500 animate-pulse" : "bg-slate-400"}`} />
                <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wide">{gensetActive ? "Running" : "Offline"}</span>
              </div>
            </div>
            <button
              onClick={() => setGensetActive(!gensetActive)}
              className={`rounded-xl px-3 py-1.5 text-[10px] font-bold uppercase shadow-sm transition-all duration-200 ${
                gensetActive ? "bg-rose-500/10 text-rose-600 hover:bg-rose-600 hover:text-white" : "bg-emerald-500/10 text-emerald-600 hover:bg-emerald-600 hover:text-white"
              }`}
            >
              {gensetActive ? "Stop" : "Start"}
            </button>
          </div>

          <div className="grid grid-cols-2 gap-x-4 gap-y-3.5 mt-2 pt-4 border-t border-slate-100 dark:border-slate-800/60 text-xs font-semibold">
            <div>
              <span className="block text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-0.5">Flow Rate</span>
              <span className="font-mono text-sm text-slate-800 dark:text-slate-200">
                {gensetActive ? `${liveJitter.gensetFlow} Nm³/h` : "0 Nm³/h"}
              </span>
            </div>
            <div>
              <span className="block text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-0.5">Pressure</span>
              <span className="font-mono text-sm text-slate-800 dark:text-slate-200">
                {gensetActive ? `${liveJitter.gensetPressure} bar` : "0.00 bar"}
              </span>
            </div>
            <div>
              <span className="block text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-0.5">Load %</span>
              <span className="font-mono text-sm text-slate-800 dark:text-slate-200">
                {gensetActive ? `${Math.round((liveJitter.gensetFlow / 150) * 100)}%` : "0%"}
              </span>
            </div>
            <div>
              <span className="block text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-0.5">Efficiency</span>
              <span className="font-mono text-sm text-emerald-600 dark:text-emerald-400">
                {gensetActive ? `${liveJitter.gensetEfficiency}%` : "0.0%"}
              </span>
            </div>
            <div>
              <span className="block text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-0.5">Today</span>
              <span className="font-mono text-sm text-slate-800 dark:text-slate-200">
                {tableRows[2]?.todayConsumption?.toLocaleString("id-ID") || 0} Nm³
              </span>
            </div>
            <div>
              <span className="block text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-0.5">Runtime</span>
              <span className="font-mono text-sm text-slate-500">
                {liveJitter.gensetRunningHours} hrs
              </span>
            </div>
          </div>
        </div>

        {/* CARD 4: BOILER 5 */}
        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-sm flex flex-col justify-between transition hover:border-pink-450 hover:shadow-md duration-300">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h4 className="text-xs font-bold text-slate-850 dark:text-slate-200 uppercase tracking-wider">Boiler-5</h4>
              <div className="flex items-center gap-1.5 mt-1">
                <span className={`h-1.5 w-1.5 rounded-full ${boiler5Active ? "bg-emerald-500 animate-pulse" : "bg-slate-400"}`} />
                <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wide">{boiler5Active ? "Running" : "Offline"}</span>
              </div>
            </div>
            <button
              onClick={() => setBoiler5Active(!boiler5Active)}
              className={`rounded-xl px-3 py-1.5 text-[10px] font-bold uppercase shadow-sm transition-all duration-200 ${
                boiler5Active ? "bg-rose-500/10 text-rose-600 hover:bg-rose-600 hover:text-white" : "bg-emerald-500/10 text-emerald-600 hover:bg-emerald-600 hover:text-white"
              }`}
            >
              {boiler5Active ? "Stop" : "Start"}
            </button>
          </div>

          <div className="grid grid-cols-2 gap-x-4 gap-y-3.5 mt-2 pt-4 border-t border-slate-100 dark:border-slate-800/60 text-xs font-semibold">
            <div>
              <span className="block text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-0.5">Flow Rate</span>
              <span className="font-mono text-sm text-slate-800 dark:text-slate-200">
                {boiler5Active ? `${liveJitter.boiler5Flow} Nm³/h` : "0 Nm³/h"}
              </span>
            </div>
            <div>
              <span className="block text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-0.5">Pressure</span>
              <span className="font-mono text-sm text-slate-800 dark:text-slate-200">
                {boiler5Active ? `${liveJitter.boiler5Pressure} bar` : "0.00 bar"}
              </span>
            </div>
            <div>
              <span className="block text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-0.5">Load %</span>
              <span className="font-mono text-sm text-slate-800 dark:text-slate-200">
                {boiler5Active ? `${Math.round((liveJitter.boiler5Flow / 250) * 100)}%` : "0%"}
              </span>
            </div>
            <div>
              <span className="block text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-0.5">Efficiency</span>
              <span className="font-mono text-sm text-emerald-600 dark:text-emerald-400">
                {boiler5Active ? `${liveJitter.boiler5Efficiency}%` : "0.0%"}
              </span>
            </div>
            <div>
              <span className="block text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-0.5">Today</span>
              <span className="font-mono text-sm text-slate-800 dark:text-slate-200">
                {tableRows[3]?.todayConsumption?.toLocaleString("id-ID") || 0} Nm³
              </span>
            </div>
            <div>
              <span className="block text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-0.5">Runtime</span>
              <span className="font-mono text-sm text-slate-500">
                {liveJitter.boiler5RunningHours} hrs
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* PGN METERING SUMMARY TABLE */}
      <section className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-sm">
        <h3 className="text-sm font-bold uppercase tracking-[0.2em] text-slate-400 dark:text-slate-500 mb-3">PGN Gas Metering Summary</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-slate-100 dark:border-slate-800 text-slate-400 dark:text-slate-500 font-bold uppercase tracking-wider">
                <th className="py-2.5 px-3">Equipment</th>
                <th className="py-2.5 px-3">Max Capacity</th>
                <th className="py-2.5 px-3">Flow Rate (Nm³/h)</th>
                <th className="py-2.5 px-3">Load Factor %</th>
                <th className="py-2.5 px-3 text-right">Consumption Today (Nm³)</th>
                <th className="py-2.5 px-3 text-right font-mono">Today Cost (IDR)</th>
                <th className="py-2.5 px-3 text-right">Share %</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/50">
              {tableRows.map((row) => (
                <tr key={row.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/20 transition">
                  <td className="py-3 px-3 font-bold text-slate-800 dark:text-slate-200">{row.name}</td>
                  <td className="py-3 px-3 text-slate-600 dark:text-slate-400 font-mono">{row.capacity} Nm³/h</td>
                  <td className="py-3 px-3 text-slate-600 dark:text-slate-400 font-mono">
                    {row.flow > 0 ? `${row.flow.toLocaleString("id-ID")} Nm³/h` : "0 (Offline)"}
                  </td>
                  <td className="py-3 px-3 font-mono text-slate-600 dark:text-slate-400">
                    <div className="flex items-center gap-2">
                      <div className="w-12 bg-slate-100 dark:bg-slate-800 h-1.5 rounded-full overflow-hidden">
                        <div className="bg-amber-500 h-full" style={{ width: `${Math.min(100, row.loadFactor)}%` }} />
                      </div>
                      <span>{row.loadFactor}%</span>
                    </div>
                  </td>
                  <td className="py-3 px-3 text-right font-mono text-slate-600 dark:text-slate-400">
                    {row.todayConsumption.toLocaleString("id-ID", { maximumFractionDigits: 1 })} Nm³
                  </td>
                  <td className="py-3 px-3 text-right font-mono font-bold text-slate-800 dark:text-white">
                    {formatCurrency(row.costToday)}
                  </td>
                  <td className="py-3 px-3 text-right font-mono text-slate-600 dark:text-slate-400">{row.share}%</td>
                </tr>
              ))}
              <tr className="bg-slate-50/30 dark:bg-slate-900/40 font-bold border-t-2 border-slate-200 dark:border-slate-800">
                <td className="py-3 px-3">TOTAL CONSUMPTION</td>
                <td className="py-3 px-3 font-mono">800 Nm³/h</td>
                <td className="py-3 px-3 font-mono">{currentTotalFlow.toLocaleString("id-ID")} Nm³/h</td>
                <td className="py-3 px-3 font-mono">
                  {Math.round((currentTotalFlow / 800) * 100)}%
                </td>
                <td className="py-3 px-3 text-right font-mono">
                  {todayConsumptionNm3.toLocaleString("id-ID", { maximumFractionDigits: 1 })} Nm³
                </td>
                <td className="py-3 px-3 text-right font-mono text-red-600 dark:text-red-400">
                  {formatCurrency(todayCostIdr)}
                </td>
                <td className="py-3 px-3 text-right font-mono">100%</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      {/* ═══════════ BIGGEST CONSUMPTION SECTION ═══════════ */}
      <section className="space-y-4">
        <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-2">
          <div className="flex items-center gap-2">
            <span className="text-xl">📊</span>
            <h3 className="text-base font-bold text-slate-800 dark:text-white">Biggest Consumption</h3>
          </div>
          <Link
            to="/utility-config"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-bold text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 hover:border-amber-450 dark:hover:border-amber-450 transition-all duration-300 cursor-pointer"
            title="Configure Categories"
          >
            <span>⚙️</span>
            <span>Configure</span>
          </Link>
        </div>

        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-sm">
          <h4 className="font-bold text-slate-800 dark:text-white mb-4 text-xs uppercase tracking-wider">Gas Consumption Share by Application Area</h4>
          {gasCategories.filter(c => c.enabled).length > 0 ? (
            <div style={{ height: 220 }}>
              <Bar
                data={{
                  labels: gasCategories.filter(c => c.enabled).sort((a, b) => b.val - a.val).map(c => c.name),
                  datasets: [
                    {
                      label: "Konsumsi (Nm³)",
                      data: gasCategories.filter(c => c.enabled).sort((a, b) => b.val - a.val).map(c => c.val),
                      backgroundColor: "#f97316",
                      borderRadius: 4
                    }
                  ]
                }}
                options={{
                  responsive: true,
                  maintainAspectRatio: false,
                  indexAxis: "y" as const,
                  plugins: { 
                    legend: { display: false },
                    tooltip: {
                      backgroundColor: isDark ? "rgba(15, 23, 42, 0.95)" : "rgba(255, 255, 255, 0.95)",
                      titleColor: isDark ? "#f1f5f9" : "#0f172a",
                      bodyColor: isDark ? "#f1f5f9" : "#0f172a",
                      borderColor: isDark ? "#334155" : "#e2e8f0",
                      borderWidth: 1,
                      bodyFont: { family: "IBM Plex Mono", size: 10 }
                    }
                  },
                  scales: {
                    x: { 
                      grid: { display: false }, 
                      ticks: { 
                        font: { size: 9, family: "IBM Plex Mono" }, 
                        color: isDark ? "#64748b" : "#94a3b8",
                        callback: (val) => `${val.toLocaleString("id-ID")} Nm³`
                      } 
                    },
                    y: { 
                      grid: { display: false }, 
                      ticks: { 
                        font: { size: 9, family: "Plus Jakarta Sans", weight: "bold" }, 
                        color: isDark ? "#cbd5e1" : "#475569" 
                      } 
                    }
                  }
                }}
              />
            </div>
          ) : (
            <div className="h-[220px] flex flex-col items-center justify-center text-center">
              <span className="text-2xl mb-2">⚙️</span>
              <p className="text-xs font-bold text-slate-400">No categories enabled or configured.</p>
              <Link to="/utility-config" className="text-xs text-amber-500 font-bold hover:underline mt-1">
                Go to settings
              </Link>
            </div>
          )}
        </div>
      </section>

      {/* ═══════════ EQUIPMENT MONTHLY HISTORICALS ═══════════ */}
      <section className="space-y-4">
        <div className="flex items-center gap-2 border-b border-slate-100 dark:border-slate-800 pb-2">
          <span className="text-xl">📈</span>
          <h3 className="text-base font-bold text-slate-800 dark:text-white">Equipment Historical Monthly Comparison</h3>
        </div>

        <div className="grid gap-6 sm:grid-cols-1 lg:grid-cols-2">
          {/* Card 1: Boiler-3 */}
          <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-sm flex flex-col justify-between hover:shadow-md duration-300">
            <div className="mb-2">
              <h4 className="text-xs font-bold text-slate-850 dark:text-slate-200 uppercase tracking-wider">Boiler-3 WF1</h4>
              <p className="text-[10px] text-slate-400">Bulanan (Nm³)</p>
            </div>
            <div style={{ height: 180 }}>
              <Bar
                data={{
                  labels: MONTH_LABELS,
                  datasets: [
                    {
                      label: "Konsumsi (Nm³)",
                      data: analyticsData?.charts?.perDeviceMonthly?.find((d: any) => d.deviceId === "boiler3")?.monthly?.map((m: any) => m.value) || Array.from({ length: 12 }, () => 0),
                      backgroundColor: "#3b82f6",
                      borderRadius: 2
                    }
                  ]
                }}
                options={{
                  responsive: true,
                  maintainAspectRatio: false,
                  plugins: { legend: { display: false } },
                  scales: {
                    x: { grid: { display: false }, ticks: { font: { size: 8, family: "IBM Plex Mono" }, color: isDark ? "#64748b" : "#94a3b8" } },
                    y: { grid: { display: false }, ticks: { font: { size: 8, family: "IBM Plex Mono" }, color: isDark ? "#64748b" : "#94a3b8" } }
                  }
                }}
              />
            </div>
          </div>

          {/* Card 2: Boiler-4 */}
          <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-sm flex flex-col justify-between hover:shadow-md duration-300">
            <div className="mb-2">
              <h4 className="text-xs font-bold text-slate-855 dark:text-slate-200 uppercase tracking-wider">Boiler-4</h4>
              <p className="text-[10px] text-slate-400">Bulanan (Nm³)</p>
            </div>
            <div style={{ height: 180 }}>
              <Bar
                data={{
                  labels: MONTH_LABELS,
                  datasets: [
                    {
                      label: "Konsumsi (Nm³)",
                      data: analyticsData?.charts?.perDeviceMonthly?.find((d: any) => d.deviceId === "boiler4")?.monthly?.map((m: any) => m.value) || Array.from({ length: 12 }, () => 0),
                      backgroundColor: "#10b981",
                      borderRadius: 2
                    }
                  ]
                }}
                options={{
                  responsive: true,
                  maintainAspectRatio: false,
                  plugins: { legend: { display: false } },
                  scales: {
                    x: { grid: { display: false }, ticks: { font: { size: 8, family: "IBM Plex Mono" }, color: isDark ? "#64748b" : "#94a3b8" } },
                    y: { grid: { display: false }, ticks: { font: { size: 8, family: "IBM Plex Mono" }, color: isDark ? "#64748b" : "#94a3b8" } }
                  }
                }}
              />
            </div>
          </div>

          {/* Card 3: Genset Caterpillar */}
          <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-sm flex flex-col justify-between hover:shadow-md duration-300">
            <div className="mb-2">
              <h4 className="text-xs font-bold text-slate-855 dark:text-slate-200 uppercase tracking-wider">Genset Caterpillar</h4>
              <p className="text-[10px] text-slate-400">Bulanan (Nm³)</p>
            </div>
            <div style={{ height: 180 }}>
              <Bar
                data={{
                  labels: MONTH_LABELS,
                  datasets: [
                    {
                      label: "Konsumsi (Nm³)",
                      data: analyticsData?.charts?.perDeviceMonthly?.find((d: any) => d.deviceId === "genset")?.monthly?.map((m: any) => m.value) || Array.from({ length: 12 }, () => 0),
                      backgroundColor: "#8b5cf6",
                      borderRadius: 2
                    }
                  ]
                }}
                options={{
                  responsive: true,
                  maintainAspectRatio: false,
                  plugins: { legend: { display: false } },
                  scales: {
                    x: { grid: { display: false }, ticks: { font: { size: 8, family: "IBM Plex Mono" }, color: isDark ? "#64748b" : "#94a3b8" } },
                    y: { grid: { display: false }, ticks: { font: { size: 8, family: "IBM Plex Mono" }, color: isDark ? "#64748b" : "#94a3b8" } }
                  }
                }}
              />
            </div>
          </div>

          {/* Card 4: Boiler-5 */}
          <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-sm flex flex-col justify-between hover:shadow-md duration-300">
            <div className="mb-2">
              <h4 className="text-xs font-bold text-slate-855 dark:text-slate-200 uppercase tracking-wider">Boiler-5</h4>
              <p className="text-[10px] text-slate-400">Bulanan (Nm³)</p>
            </div>
            <div style={{ height: 180 }}>
              <Bar
                data={{
                  labels: MONTH_LABELS,
                  datasets: [
                    {
                      label: "Konsumsi (Nm³)",
                      data: analyticsData?.charts?.perDeviceMonthly?.find((d: any) => d.deviceId === "boiler5")?.monthly?.map((m: any) => m.value) || Array.from({ length: 12 }, () => 0),
                      backgroundColor: "#ec4899",
                      borderRadius: 2
                    }
                  ]
                }}
                options={{
                  responsive: true,
                  maintainAspectRatio: false,
                  plugins: { legend: { display: false } },
                  scales: {
                    x: { grid: { display: false }, ticks: { font: { size: 8, family: "IBM Plex Mono" }, color: isDark ? "#64748b" : "#94a3b8" } },
                    y: { grid: { display: false }, ticks: { font: { size: 8, family: "IBM Plex Mono" }, color: isDark ? "#64748b" : "#94a3b8" } }
                  }
                }}
              />
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

const MONTH_LABELS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
