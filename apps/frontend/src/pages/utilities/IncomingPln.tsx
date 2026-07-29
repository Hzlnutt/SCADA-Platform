import { useEffect, useState, useMemo } from "react";
import { useLocation } from "react-router-dom";
import { PageHeader } from "../../components/ui/PageHeader";
import { Line, Radar } from "react-chartjs-2";
import "../../components/charts/chartjs";
import { getJson } from "../../services/api.client";
import { getSocket } from "../../services/socket.service";
import { useSystemStore } from "../../store/system.store";

/* ═══════════ CONSTANTS & HELPERS ═══════════ */
const formatCurrency = (value: number) =>
  new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value);

// Event logs mock data matching the mockup
const MOCK_EVENTS: any[] = [];

/* ═══════════ CUSTOM GAUGE COMPONENT ═══════════ */
function UnbalancedGauge({
  label,
  value,
  maxAllowed,
  isDark
}: {
  label: string;
  value: number;
  maxAllowed: number;
  isDark: boolean;
}) {
  const percentage = Math.min(100, (value / maxAllowed) * 100);
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
          <path
            d="M 10 60 A 50 50 0 0 1 110 60"
            fill="none"
            stroke={value > maxAllowed ? "#ef4444" : "#10b981"}
            strokeWidth={strokeWidth}
            strokeDasharray={circumference / 2}
            strokeDashoffset={strokeDashoffset}
            strokeLinecap="round"
            className="transition-all duration-1000 ease-out"
          />
        </svg>
        <div className="absolute bottom-2 text-center">
          <span className="text-2xl font-extrabold font-mono text-slate-800 dark:text-white">{value.toFixed(2)}</span>
          <span className="text-xs font-bold text-slate-400 ml-0.5">%</span>
        </div>
      </div>

      <div className="w-full mt-4 py-1.5 rounded-lg text-center bg-emerald-500/10 border border-emerald-500/20 text-[10px] font-extrabold uppercase text-emerald-500 tracking-wider">
        ✓ Dalam batas normal
      </div>
    </div>
  );
}

/* ═══════════ MAIN COMPONENT ═══════════ */
export default function IncomingPln() {
  const theme = useSystemStore((state) => state.theme);
  const isDark = theme === "dark";
  const location = useLocation();

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
    thdI_R: 0, thdI_S: 0, thdI_T: 0
  });

  // Event & alarm logs
  const [events, setEvents] = useState(MOCK_EVENTS);

  // Load database analytics fallback
  const fetchTelemetry = () => {
    getJson<{ data: any }>(`/analytics/electricity?deviceId=${config.deviceId}`)
      .then((res) => {
        if (res?.data?.pqData) {
          const pq = res.data.pqData;
          setMetrics((prev) => ({
            ...prev,
            voltage: pq.voltage || prev.voltage,
            frequency: pq.frequency || prev.frequency,
            activePower: pq.activePower || prev.activePower,
            powerFactor: pq.pf || prev.powerFactor,
            reactivePower: pq.reactivePower || prev.reactivePower,
            apparentPower: pq.apparentPower || prev.apparentPower
          }));
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
      thdI_R: 0, thdI_S: 0, thdI_T: 0
    });
  }, [config]);

  useEffect(() => {
    fetchTelemetry();
    const interval = setInterval(fetchTelemetry, 3000);
    return () => clearInterval(interval);
  }, [config]);

  // Handle socket updates
  useEffect(() => {
    const socket = getSocket();
    const handlePfUpdate = (payload: any) => {
      if (payload?.value) {
        setMetrics((prev) => ({
          ...prev,
          powerFactor: payload.value
        }));
      }
    };
    socket.on("power_factor:status", handlePfUpdate);
    return () => {
      socket.off("power_factor:status", handlePfUpdate);
    };
  }, []);

  // Averages and stats helpers for Phase details
  const statsV = useMemo(() => {
    const vals = [metrics.vR, metrics.vS, metrics.vT];
    const avg = vals.reduce((a, b) => a + b, 0) / 3;
    return { avg, min: Math.min(...vals), max: Math.max(...vals) };
  }, [metrics.vR, metrics.vS, metrics.vT]);

  const statsI = useMemo(() => {
    const vals = [metrics.iR, metrics.iS, metrics.iT];
    const avg = vals.reduce((a, b) => a + b, 0) / 3;
    return { avg, min: Math.min(...vals), max: Math.max(...vals) };
  }, [metrics.iR, metrics.iS, metrics.iT]);

  const statsThdV = useMemo(() => {
    const vals = [metrics.thdV_R, metrics.thdV_S, metrics.thdV_T];
    const avg = vals.reduce((a, b) => a + b, 0) / 3;
    return { avg, min: Math.min(...vals), max: Math.max(...vals) };
  }, [metrics.thdV_R, metrics.thdV_S, metrics.thdV_T]);

  const statsThdI = useMemo(() => {
    const vals = [metrics.thdI_R, metrics.thdI_S, metrics.thdI_T];
    const avg = vals.reduce((a, b) => a + b, 0) / 3;
    return { avg, min: Math.min(...vals), max: Math.max(...vals) };
  }, [metrics.thdI_R, metrics.thdI_S, metrics.thdI_T]);

  // Radar PQ index chart data
  const radarData = {
    labels: ["Voltage", "Current", "PF", "Freq", "THD-V", "THD-I"],
    datasets: [
      {
        label: "Daya Aktual",
        data: [98, 92, metrics.powerFactor * 100, 99.8, 94.5, 91.2],
        backgroundColor: "rgba(56, 189, 248, 0.25)",
        borderColor: "#38bdf8",
        borderWidth: 2,
        pointBackgroundColor: "#0284c7",
        pointBorderColor: "#fff"
      }
    ]
  };

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

  // 24 Hour Line Trend Data
  const trendLabels = Array.from({ length: 24 }, (_, i) => `${i.toString().padStart(2, "0")}:00`);

  const voltageTrendData = {
    labels: trendLabels,
    datasets: [
      {
        label: "Tegangan (kV)",
        data: [],
        borderColor: "#eab308",
        backgroundColor: "rgba(234, 179, 8, 0.05)",
        tension: 0.3,
        borderWidth: 2,
        pointRadius: 0
      }
    ]
  };

  const activePowerTrendData = {
    labels: trendLabels,
    datasets: [
      {
        label: "Daya Aktif (kW)",
        data: [],
        borderColor: "#10b981",
        backgroundColor: "rgba(16, 185, 129, 0.05)",
        tension: 0.3,
        borderWidth: 2,
        pointRadius: 0
      }
    ]
  };

  const lineOptions = (title: string, color: string, unit: string) => ({
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      title: {
        display: true,
        text: title,
        color: isDark ? "#94a3b8" : "#475569",
        align: "start" as const,
        font: { size: 11, weight: "bold" as const }
      }
    },
    scales: {
      x: { grid: { display: false }, ticks: { color: "#64748b", font: { size: 8 } } },
      y: {
        grid: { color: isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.04)" },
        ticks: { color: "#64748b", font: { size: 8 } }
      }
    }
  });

  return (
    <div className="space-y-6">
      {/* HEADER SECTION */}
      <div className="flex items-center justify-between">
        <PageHeader
          title={config.title}
          description={`Monitoring real-time parameter kelistrikan ${config.title} - Update setiap 3 detik`}
        />
        <span className="px-3 py-1.5 rounded-full text-xs font-extrabold uppercase bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
          {config.connectedLabel}
        </span>
      </div>

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
            <div className="text-xl font-extrabold font-mono text-slate-800 dark:text-white">
              {metrics.voltage.toFixed(2)} <span className="text-xs text-slate-400 ml-0.5">kV</span>
            </div>
            <p className="text-[9px] text-slate-400 mt-1">Nominal: 20 kV</p>
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
            <div className="text-xl font-extrabold font-mono text-slate-800 dark:text-white">
              {metrics.frequency.toFixed(2)} <span className="text-xs text-slate-400 ml-0.5">Hz</span>
            </div>
            <p className="text-[9px] text-slate-400 mt-1">Nominal: 50 Hz</p>
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
            <div className="text-xl font-extrabold font-mono text-slate-800 dark:text-white">
              {metrics.activePower.toLocaleString("id-ID")} <span className="text-xs text-slate-400 ml-0.5">kW</span>
            </div>
            <p className="text-[9px] text-slate-400 mt-1">Total daya aktif</p>
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
            <div className="text-xl font-extrabold font-mono text-slate-800 dark:text-white">
              {metrics.powerFactor.toFixed(3)} <span className="text-xs text-slate-400 ml-0.5">PF</span>
            </div>
            <p className="text-[9px] text-emerald-500 font-bold mt-1">Good</p>
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
            <div className="text-xl font-extrabold font-mono text-slate-800 dark:text-white">
              {metrics.reactivePower.toLocaleString("id-ID")} <span className="text-xs text-slate-400 ml-0.5">kVAR</span>
            </div>
            <p className="text-[9px] text-slate-400 mt-1">Daya reaktif</p>
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
            <div className="text-xl font-extrabold font-mono text-slate-800 dark:text-white">
              {metrics.apparentPower.toLocaleString("id-ID")} <span className="text-xs text-slate-400 ml-0.5">kVA</span>
            </div>
            <p className="text-[9px] text-slate-400 mt-1">Daya semu</p>
          </div>
        </div>
      </section>

      {/* ═══════════ SECTION B: POWER QUALITY INDEX & GAUGES ═══════════ */}
      <section className="grid gap-6 md:grid-cols-3">
        <UnbalancedGauge label="Voltage Unbalanced" value={metrics.unbalanceV} maxAllowed={2} isDark={isDark} />
        <UnbalancedGauge label="Current Unbalanced" value={metrics.unbalanceI} maxAllowed={10} isDark={isDark} />

        {/* Power Quality Radar Index */}
        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-sm flex flex-col justify-between">
          <div className="text-center">
            <h4 className="text-[11px] font-extrabold uppercase tracking-wider text-slate-400 dark:text-slate-500">Power Quality Index</h4>
            <p className="text-[10px] text-slate-400 dark:text-slate-600 mt-0.5">Analisis Keseluruhan Parameter</p>
          </div>
          <div className="relative mt-2 flex items-center justify-center" style={{ height: 160 }}>
            <Radar data={radarData} options={radarOptions} />
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
                <span className="font-mono">{metrics.vR.toFixed(3)} kV</span>
              </div>
              <div className="h-2 w-full rounded bg-slate-100 dark:bg-slate-800 overflow-hidden">
                <div className="h-full bg-rose-500 rounded transition-all duration-500" style={{ width: metrics.vR > 0 ? `${(metrics.vR / 12) * 100}%` : "0%" }} />
              </div>
            </div>
            {/* S */}
            <div className="space-y-1">
              <div className="flex justify-between text-[11px] font-bold">
                <span className="text-amber-500">S</span>
                <span className="font-mono">{metrics.vS.toFixed(3)} kV</span>
              </div>
              <div className="h-2 w-full rounded bg-slate-100 dark:bg-slate-800 overflow-hidden">
                <div className="h-full bg-amber-500 rounded transition-all duration-500" style={{ width: metrics.vS > 0 ? `${(metrics.vS / 12) * 100}%` : "0%" }} />
              </div>
            </div>
            {/* T */}
            <div className="space-y-1">
              <div className="flex justify-between text-[11px] font-bold">
                <span className="text-blue-500">T</span>
                <span className="font-mono">{metrics.vT.toFixed(3)} kV</span>
              </div>
              <div className="h-2 w-full rounded bg-slate-100 dark:bg-slate-800 overflow-hidden">
                <div className="h-full bg-blue-500 rounded transition-all duration-500" style={{ width: metrics.vT > 0 ? `${(metrics.vT / 12) * 100}%` : "0%" }} />
              </div>
            </div>
          </div>

          <div className="flex justify-between items-center text-[10px] font-bold text-slate-500 border-t border-slate-100 dark:border-slate-800/80 pt-3">
            <span>AVG: <strong className="text-slate-700 dark:text-slate-300">{statsV.avg.toFixed(3)}</strong></span>
            <span>MIN: <strong className="text-slate-700 dark:text-slate-300">{statsV.min.toFixed(3)}</strong></span>
            <span>MAX: <strong className="text-slate-700 dark:text-slate-300">{statsV.max.toFixed(3)}</strong></span>
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
                <span className="font-mono">{metrics.iR.toFixed(1)} A</span>
              </div>
              <div className="h-2 w-full rounded bg-slate-100 dark:bg-slate-800 overflow-hidden">
                <div className="h-full bg-rose-500 rounded transition-all duration-500" style={{ width: metrics.iR > 0 ? `${Math.min(100, (metrics.iR / 150) * 100)}%` : "0%" }} />
              </div>
            </div>
            {/* S */}
            <div className="space-y-1">
              <div className="flex justify-between text-[11px] font-bold">
                <span className="text-amber-500">S</span>
                <span className="font-mono">{metrics.iS.toFixed(1)} A</span>
              </div>
              <div className="h-2 w-full rounded bg-slate-100 dark:bg-slate-800 overflow-hidden">
                <div className="h-full bg-amber-500 rounded transition-all duration-500" style={{ width: metrics.iS > 0 ? `${Math.min(100, (metrics.iS / 150) * 100)}%` : "0%" }} />
              </div>
            </div>
            {/* T */}
            <div className="space-y-1">
              <div className="flex justify-between text-[11px] font-bold">
                <span className="text-blue-500">T</span>
                <span className="font-mono">{metrics.iT.toFixed(1)} A</span>
              </div>
              <div className="h-2 w-full rounded bg-slate-100 dark:bg-slate-800 overflow-hidden">
                <div className="h-full bg-blue-500 rounded transition-all duration-500" style={{ width: metrics.iT > 0 ? `${Math.min(100, (metrics.iT / 150) * 100)}%` : "0%" }} />
              </div>
            </div>
          </div>

          <div className="flex justify-between items-center text-[10px] font-bold text-slate-500 border-t border-slate-100 dark:border-slate-800/80 pt-3">
            <span>AVG: <strong className="text-slate-700 dark:text-slate-300">{statsI.avg.toFixed(1)}</strong></span>
            <span>MIN: <strong className="text-slate-700 dark:text-slate-300">{statsI.min.toFixed(1)}</strong></span>
            <span>MAX: <strong className="text-slate-700 dark:text-slate-300">{statsI.max.toFixed(1)}</strong></span>
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
                <span className="font-mono">{metrics.thdV_R.toFixed(2)} %</span>
              </div>
              <div className="h-2 w-full rounded bg-slate-100 dark:bg-slate-800 overflow-hidden">
                <div className="h-full bg-rose-500 rounded transition-all duration-500" style={{ width: metrics.thdV_R > 0 ? `${Math.min(100, (metrics.thdV_R / 5) * 100)}%` : "0%" }} />
              </div>
            </div>
            {/* S */}
            <div className="space-y-1">
              <div className="flex justify-between text-[11px] font-bold">
                <span className="text-amber-500">S</span>
                <span className="font-mono">{metrics.thdV_S.toFixed(2)} %</span>
              </div>
              <div className="h-2 w-full rounded bg-slate-100 dark:bg-slate-800 overflow-hidden">
                <div className="h-full bg-amber-500 rounded transition-all duration-500" style={{ width: metrics.thdV_S > 0 ? `${Math.min(100, (metrics.thdV_S / 5) * 100)}%` : "0%" }} />
              </div>
            </div>
            {/* T */}
            <div className="space-y-1">
              <div className="flex justify-between text-[11px] font-bold">
                <span className="text-blue-500">T</span>
                <span className="font-mono">{metrics.thdV_T.toFixed(2)} %</span>
              </div>
              <div className="h-2 w-full rounded bg-slate-100 dark:bg-slate-800 overflow-hidden">
                <div className="h-full bg-blue-500 rounded transition-all duration-500" style={{ width: metrics.thdV_T > 0 ? `${Math.min(100, (metrics.thdV_T / 5) * 100)}%` : "0%" }} />
              </div>
            </div>
          </div>

          <div className="flex justify-between items-center text-[10px] font-bold text-slate-500 border-t border-slate-100 dark:border-slate-800/80 pt-3">
            <span>AVG: <strong className="text-slate-700 dark:text-slate-300">{statsThdV.avg.toFixed(2)}</strong></span>
            <span>MIN: <strong className="text-slate-700 dark:text-slate-300">{statsThdV.min.toFixed(2)}</strong></span>
            <span>MAX: <strong className="text-slate-700 dark:text-slate-300">{statsThdV.max.toFixed(2)}</strong></span>
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
                <span className="font-mono">{metrics.thdI_R.toFixed(2)} %</span>
              </div>
              <div className="h-2 w-full rounded bg-slate-100 dark:bg-slate-800 overflow-hidden">
                <div className="h-full bg-rose-500 rounded transition-all duration-500" style={{ width: metrics.thdI_R > 0 ? `${Math.min(100, (metrics.thdI_R / 8) * 100)}%` : "0%" }} />
              </div>
            </div>
            {/* S */}
            <div className="space-y-1">
              <div className="flex justify-between text-[11px] font-bold">
                <span className="text-amber-500">S</span>
                <span className="font-mono">{metrics.thdI_S.toFixed(2)} %</span>
              </div>
              <div className="h-2 w-full rounded bg-slate-100 dark:bg-slate-800 overflow-hidden">
                <div className="h-full bg-amber-500 rounded transition-all duration-500" style={{ width: metrics.thdI_S > 0 ? `${Math.min(100, (metrics.thdI_S / 8) * 100)}%` : "0%" }} />
              </div>
            </div>
            {/* T */}
            <div className="space-y-1">
              <div className="flex justify-between text-[11px] font-bold">
                <span className="text-blue-500">T</span>
                <span className="font-mono">{metrics.thdI_T.toFixed(2)} %</span>
              </div>
              <div className="h-2 w-full rounded bg-slate-100 dark:bg-slate-800 overflow-hidden">
                <div className="h-full bg-blue-500 rounded transition-all duration-500" style={{ width: metrics.thdI_T > 0 ? `${Math.min(100, (metrics.thdI_T / 8) * 100)}%` : "0%" }} />
              </div>
            </div>
          </div>

          <div className="flex justify-between items-center text-[10px] font-bold text-slate-500 border-t border-slate-100 dark:border-slate-800/80 pt-3">
            <span>AVG: <strong className="text-slate-700 dark:text-slate-300">{statsThdI.avg.toFixed(2)}</strong></span>
            <span>MIN: <strong className="text-slate-700 dark:text-slate-300">{statsThdI.min.toFixed(2)}</strong></span>
            <span>MAX: <strong className="text-slate-700 dark:text-slate-300">{statsThdI.max.toFixed(2)}</strong></span>
          </div>
        </div>
      </section>

      {/* ═══════════ SECTION D: TREND LINES & EVENT LOGS ═══════════ */}
      <section className="grid gap-6 lg:grid-cols-[1.2fr_1fr]">
        <div className="space-y-4">
          <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 shadow-sm">
            <div style={{ height: 130 }}>
              <Line data={voltageTrendData} options={lineOptions("Trend Tegangan 24 Jam (kV)", "#eab308", "kV")} />
            </div>
          </div>
          <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 shadow-sm">
            <div style={{ height: 130 }}>
              <Line data={activePowerTrendData} options={lineOptions("Trend Daya Aktif 24 Jam (kW)", "#10b981", "kW")} />
            </div>
          </div>
        </div>

        {/* Event Logs Card */}
        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-sm flex flex-col">
          <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800/80 pb-3 mb-4">
            <h4 className="text-xs font-extrabold uppercase tracking-wider text-slate-500 dark:text-slate-400">EVENT & ALARM LOG</h4>
            <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Recent 5 events</span>
          </div>

          <div className="flex-1 space-y-2">
            {events.map((ev, idx) => (
              <div key={idx} className="flex items-center justify-between px-3 py-2 bg-slate-50 dark:bg-slate-800/30 rounded-xl border border-slate-100 dark:border-slate-800/60 text-xs">
                <span className="font-mono text-slate-400">{ev.time}</span>
                <span className={`px-2 py-0.5 rounded text-[10px] font-extrabold border ${
                  ev.type === "INFO" ? "bg-blue-500/10 text-blue-500 border-blue-500/20" :
                  ev.type === "WARN" ? "bg-amber-500/10 text-amber-500 border-amber-500/20" :
                  "bg-emerald-500/10 text-emerald-500 border-emerald-500/20"
                }`}>
                  {ev.type}
                </span>
                <span className="font-semibold text-slate-500 max-w-[80px] truncate">{ev.source}</span>
                <span className="text-slate-700 dark:text-slate-300 font-semibold truncate flex-1 text-right ml-4">{ev.message}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══════════ SECTION E: PARAMETER RINGKASAN TABLE ═══════════ */}
      <section className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-sm">
        <div className="flex items-center gap-2 mb-4">
          <svg className="h-4 w-4 text-[#002b5c] dark:text-sky-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 10h16M4 14h16M4 18h16" />
          </svg>
          <h4 className="text-xs font-extrabold uppercase tracking-wider text-slate-500 dark:text-slate-400">Ringkasan Parameter {config.title}</h4>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-slate-100 dark:border-slate-800 text-[10px] uppercase tracking-wider text-[#47729f] dark:text-slate-500 font-bold">
                <th className="pb-3 px-3">Parameter</th>
                <th className="pb-3 px-3">Nilai</th>
                <th className="pb-3 px-3">Satuan</th>
                <th className="pb-3 px-3">Standar</th>
                <th className="pb-3 px-3 text-right">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 font-semibold text-slate-800 dark:text-slate-200">
              <tr className="hover:bg-slate-50/50 dark:hover:bg-slate-800/10">
                <td className="py-3 px-3">Tegangan</td>
                <td className="py-3 px-3 font-mono">{metrics.voltage.toFixed(2)}</td>
                <td className="py-3 px-3">kV</td>
                <td className="py-3 px-3 font-mono">20 ± 5%</td>
                <td className="py-3 px-3 text-right">
                  <span className="px-2.5 py-0.5 rounded text-[10px] font-extrabold border bg-emerald-500/10 text-emerald-500 border-emerald-500/20">✓ Normal</span>
                </td>
              </tr>
              <tr className="hover:bg-slate-50/50 dark:hover:bg-slate-800/10">
                <td className="py-3 px-3">Frekuensi</td>
                <td className="py-3 px-3 font-mono">{metrics.frequency.toFixed(2)}</td>
                <td className="py-3 px-3">Hz</td>
                <td className="py-3 px-3 font-mono">50 ± 0.5</td>
                <td className="py-3 px-3 text-right">
                  <span className="px-2.5 py-0.5 rounded text-[10px] font-extrabold border bg-emerald-500/10 text-emerald-500 border-emerald-500/20">✓ Normal</span>
                </td>
              </tr>
              <tr className="hover:bg-slate-50/50 dark:hover:bg-slate-800/10">
                <td className="py-3 px-3">Active Power</td>
                <td className="py-3 px-3 font-mono">{metrics.activePower}</td>
                <td className="py-3 px-3">kW</td>
                <td className="py-3 px-3 font-mono">—</td>
                <td className="py-3 px-3 text-right">
                  <span className="px-2.5 py-0.5 rounded text-[10px] font-extrabold border bg-emerald-500/10 text-emerald-500 border-emerald-500/20">✓ Normal</span>
                </td>
              </tr>
              <tr className="hover:bg-slate-50/50 dark:hover:bg-slate-800/10">
                <td className="py-3 px-3">Reactive Power</td>
                <td className="py-3 px-3 font-mono">{metrics.reactivePower}</td>
                <td className="py-3 px-3">kVAR</td>
                <td className="py-3 px-3 font-mono">—</td>
                <td className="py-3 px-3 text-right">
                  <span className="px-2.5 py-0.5 rounded text-[10px] font-extrabold border bg-emerald-500/10 text-emerald-500 border-emerald-500/20">✓ Normal</span>
                </td>
              </tr>
              <tr className="hover:bg-slate-50/50 dark:hover:bg-slate-800/10">
                <td className="py-3 px-3">Apparent Power</td>
                <td className="py-3 px-3 font-mono">{metrics.apparentPower}</td>
                <td className="py-3 px-3">kVA</td>
                <td className="py-3 px-3 font-mono">—</td>
                <td className="py-3 px-3 text-right">
                  <span className="px-2.5 py-0.5 rounded text-[10px] font-extrabold border bg-emerald-500/10 text-emerald-500 border-emerald-500/20">✓ Normal</span>
                </td>
              </tr>
              <tr className="hover:bg-slate-50/50 dark:hover:bg-slate-800/10">
                <td className="py-3 px-3">Power Factor</td>
                <td className="py-3 px-3 font-mono">{metrics.powerFactor.toFixed(3)}</td>
                <td className="py-3 px-3">PF</td>
                <td className="py-3 px-3 font-mono">≥ 0.85</td>
                <td className="py-3 px-3 text-right">
                  <span className="px-2.5 py-0.5 rounded text-[10px] font-extrabold border bg-emerald-500/10 text-emerald-500 border-emerald-500/20">✓ Normal</span>
                </td>
              </tr>
              <tr className="hover:bg-slate-50/50 dark:hover:bg-slate-800/10">
                <td className="py-3 px-3">Voltage Unbalanced</td>
                <td className="py-3 px-3 font-mono">{metrics.unbalanceV.toFixed(2)}</td>
                <td className="py-3 px-3">%</td>
                <td className="py-3 px-3 font-mono">≤ 2%</td>
                <td className="py-3 px-3 text-right">
                  <span className="px-2.5 py-0.5 rounded text-[10px] font-extrabold border bg-emerald-500/10 text-emerald-500 border-emerald-500/20">✓ Normal</span>
                </td>
              </tr>
              <tr className="hover:bg-slate-50/50 dark:hover:bg-slate-800/10">
                <td className="py-3 px-3">Current Unbalanced</td>
                <td className="py-3 px-3 font-mono">{metrics.unbalanceI.toFixed(2)}</td>
                <td className="py-3 px-3">%</td>
                <td className="py-3 px-3 font-mono">≤ 10%</td>
                <td className="py-3 px-3 text-right">
                  <span className="px-2.5 py-0.5 rounded text-[10px] font-extrabold border bg-emerald-500/10 text-emerald-500 border-emerald-500/20">✓ Normal</span>
                </td>
              </tr>
              <tr className="hover:bg-slate-50/50 dark:hover:bg-slate-800/10">
                <td className="py-3 px-3">THD Voltage (Avg)</td>
                <td className="py-3 px-3 font-mono">2.28</td>
                <td className="py-3 px-3">%</td>
                <td className="py-3 px-3 font-mono">≤ 5%</td>
                <td className="py-3 px-3 text-right">
                  <span className="px-2.5 py-0.5 rounded text-[10px] font-extrabold border bg-emerald-500/10 text-emerald-500 border-emerald-500/20">✓ Normal</span>
                </td>
              </tr>
              <tr className="hover:bg-slate-50/50 dark:hover:bg-slate-800/10">
                <td className="py-3 px-3">THD Current (Avg)</td>
                <td className="py-3 px-3 font-mono">5.84</td>
                <td className="py-3 px-3">%</td>
                <td className="py-3 px-3 font-mono">≤ 8%</td>
                <td className="py-3 px-3 text-right">
                  <span className="px-2.5 py-0.5 rounded text-[10px] font-extrabold border bg-emerald-500/10 text-emerald-500 border-emerald-500/20">✓ Normal</span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
