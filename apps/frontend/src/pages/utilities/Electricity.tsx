import { useCallback, useEffect, useMemo, useRef, useState, memo } from "react";
import { usePageActive } from "../../hooks/usePageActive";
import { PageHeader } from "../../components/ui/PageHeader";
import { Bar, Line } from "react-chartjs-2";
import "../../components/charts/chartjs";
import { DonutChart } from "../../components/charts/DonutChart";
import { machineGroups } from "../../data/machines";
import { buildTimeAwareSeries, buildTimeLabels, getElapsedIndex } from "../../utils/series";
import { getJson, postJson, deleteJson } from "../../services/api.client";
import { useConfigStore } from "../../store/config.store";
import { getSocket } from "../../services/socket.service";
import { useSystemStore } from "../../store/system.store";
import { ApiSourcesPanel } from "../machines/MachineConfig";

/* ═══════════ CONSTANTS ═══════════ */
const dailyEnergyTotal = machineGroups.reduce((sum, group) => {
  const energy = group.summaryCards.find((card) => card.label === "Total Energy")?.value ?? 0;
  return sum + energy;
}, 0);

const electricityRate = 1467;

const MONTH_NAMES_ID = [
  "Januari", "Februari", "Maret", "April", "Mei", "Juni",
  "Juli", "Agustus", "September", "Oktober", "November", "Desember"
];
const MONTH_SHORT_ID = [
  "Jan", "Feb", "Mar", "Apr", "Mei", "Jun",
  "Jul", "Agu", "Sep", "Okt", "Nov", "Des"
];
const DAY_NAMES_ID = ["Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"];

const AVAILABLE_YEARS = [2025, 2026];

const ranges = [
  { id: "ytd", label: "YTD", points: 12, type: "month" as const, scale: 30 },
  { id: "hour", label: "Per Jam", points: 24, type: "time" as const, scale: 1 / 24 },
  { id: "day", label: "Per Hari", points: 30, type: "day" as const, scale: 1 },
  { id: "month", label: "Per Bulan", points: 12, type: "month" as const, scale: 30 },
  { id: "custom", label: "Kustom", points: 30, type: "day" as const, scale: 1 }
] as const;

const formatCurrency = (value: number) =>
  new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value);

const formatNumber = (value: number | undefined | null) =>
  (value ?? 0).toLocaleString("id-ID", { maximumFractionDigits: 2 });

const getLocalTodayString = () => {
  const d = new Date();
  const yr = d.getFullYear();
  const mo = String(d.getMonth() + 1).padStart(2, "0");
  const dy = String(d.getDate()).padStart(2, "0");
  return `${yr}-${mo}-${dy}`;
};

const formatPeakTs = (tsStr: string) => {
  if (!tsStr) return "";
  const dateObj = new Date(tsStr);
  const day = dateObj.getDate();
  const month = MONTH_SHORT_ID[dateObj.getMonth()];
  const year = dateObj.getFullYear();
  const hrs = String(dateObj.getHours()).padStart(2, "0");
  const mins = String(dateObj.getMinutes()).padStart(2, "0");
  return `${day} ${month} ${year}, ${hrs}:${mins} WIB`;
};

const DEFAULT_PLN_API_URL = "http://10.3.164.3:8088/system/webdev/Utility_Dashboard/electric_pln";

const DEFAULT_PLN_JSON_KEYS: Record<string, string> = {
  "pln/active_power": "Active_Power",
  "pln/reactive_power": "Reactive_Power_Total",
  "pln/apparent_power": "Apparent_Power_Total",
  "pln/power_factor": "Power_Factor",
  "pln/voltage": "Volt_LL",
  "pln/frequency": "Frequency",
  "pln/current_r": "Current_A",
  "pln/current_s": "Current_B",
  "pln/current_t": "Current_C",
  "pln/voltage_rn": "VoltAB",
  "pln/voltage_sn": "VoltBC",
  "pln/voltage_tn": "VoltCA",
  "pln/unbalance_v": "Volatage_Unbalance",
  "pln/unbalance_i": "Current_Umbalance",
  "electricity/p_grid": "Active_Power"
};

/* ═══════════ TYPES ═══════════ */
type ConsumptionFactCategory = {
  id: number;
  config_type: string;
  config_key: string;
  label: string;
  value: any;
  sort_order: number;
  enabled: boolean;
};

/* ═══════════ DEFAULT FACT CATEGORIES (MODULE LEVEL) ═══════════ */
const defaultFact1Categories: ConsumptionFactCategory[] = [];
const defaultFact2Categories: ConsumptionFactCategory[] = [];

/* ═══════════ SMALL ICON COMPONENTS ═══════════ */
const IconGrid = () => (
  <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
  </svg>
);
const IconSolar = () => (
  <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="4" /><path d="M12 2v2" /><path d="M12 20v2" /><path d="m4.93 4.93 1.41 1.41" /><path d="m17.66 17.66 1.41 1.41" /><path d="M2 12h2" /><path d="M20 12h2" /><path d="m6.34 17.66-1.41 1.41" /><path d="m19.07 4.93-1.41 1.41" />
  </svg>
);
const IconGenset = () => (
  <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="6" width="18" height="12" rx="2" /><path d="M7 6V4" /><path d="M17 6V4" /><circle cx="12" cy="12" r="3" /><path d="M12 9v1.5" /><path d="M12 13.5V15" />
  </svg>
);
const IconPlant = () => (
  <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M4 5h6v6H4z" /><path d="M14 5h6v6h-6z" /><path d="M9 19h6" /><path d="M12 11v8" />
  </svg>
);
const IconMoney = () => (
  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v12m-3-2.818.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
  </svg>
);
const IconBolt = () => (
  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" d="m3.75 13.5 10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75Z" />
  </svg>
);
const IconSettings = () => (
  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.325.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 0 1 1.37.49l1.296 2.247a1.125 1.125 0 0 1-.26 1.431l-1.003.827c-.293.241-.438.613-.43.992a7.723 7.723 0 0 1 0 .255c-.008.378.137.75.43.991l1.004.827c.424.35.534.955.26 1.43l-1.298 2.247a1.125 1.125 0 0 1-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.47 6.47 0 0 1-.22.128c-.331.183-.581.495-.644.869l-.213 1.281c-.09.543-.56.94-1.11.94h-2.594c-.55 0-1.019-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 0 1-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 0 1-1.369-.49l-1.297-2.247a1.125 1.125 0 0 1 .26-1.431l1.004-.827c.292-.24.437-.613.43-.991a6.932 6.932 0 0 1 0-.255c.007-.38-.138-.751-.43-.992l-1.004-.827a1.125 1.125 0 0 1-.26-1.43l1.297-2.247a1.125 1.125 0 0 1 1.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.086.22-.128.332-.183.582-.495.644-.869l.214-1.28Z" />
    <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
  </svg>
);

/* ═══════════ SPARKLINE MINI CHART ═══════════ */
const Sparkline = ({ color = "#4ade80" }: { color?: string }) => {
  return null;
};

/* ═══════════ MONTHLY COMPARISON BAR CHART ═══════════ */
const MonthlyComparisonBarChart = memo(function MonthlyComparisonBarChart({
  currentData,
  previousData,
  isDark
}: {
  currentData: number[];
  previousData: number[];
  isDark: boolean;
}) {
  const daysInMonth = Math.max(currentData.length, previousData.length, 28);
  const dayLabels = useMemo(() => Array.from({ length: daysInMonth }, (_, i) => String(i + 1).padStart(2, "0")), [daysInMonth]);

  const data = useMemo(() => ({
    labels: dayLabels,
    datasets: [
      {
        label: "Bulan Ini",
        data: currentData,
        backgroundColor: "rgba(59, 130, 246, 0.85)",
        borderWidth: 0,
        borderRadius: 2,
        barPercentage: 0.45,
        categoryPercentage: 0.8
      },
      {
        label: "Bulan Lalu",
        data: previousData,
        backgroundColor: "rgba(239, 68, 68, 0.75)",
        borderWidth: 0,
        borderRadius: 2,
        barPercentage: 0.45,
        categoryPercentage: 0.8
      }
    ]
  }), [dayLabels, currentData, previousData]);

  const options: any = useMemo(() => ({
    responsive: true,
    maintainAspectRatio: false,
    animation: {
      duration: 350,
      easing: "easeOutQuart"
    },
    transitions: {
      active: {
        animation: {
          duration: 180,
          easing: "easeOutQuad"
        }
      }
    },
    interaction: {
      mode: "index",
      intersect: false
    },
    plugins: {
      legend: {
        display: true,
        position: "bottom" as const,
        labels: {
          color: isDark ? "rgba(148, 163, 184, 0.9)" : "rgba(71, 85, 105, 0.9)",
          font: { size: 10, weight: "600" as const },
          usePointStyle: true,
          pointStyle: "rectRounded",
          padding: 14
        }
      },
      tooltip: {
        animation: {
          duration: 180,
          easing: "easeOutQuad"
        },
        backgroundColor: isDark ? "rgba(13, 21, 39, 0.95)" : "rgba(255, 255, 255, 0.95)",
        titleColor: isDark ? "#f1f5f9" : "#0f172a",
        bodyColor: isDark ? "#f1f5f9" : "#0f172a",
        borderColor: isDark ? "rgba(51, 65, 85, 0.5)" : "rgba(203, 213, 225, 0.5)",
        borderWidth: 1,
        padding: 10,
        bodyFont: { family: "IBM Plex Mono, monospace", size: 11 },
        callbacks: {
          label: (ctx: any) => `${ctx.dataset.label}: ${Number(ctx.parsed.y).toLocaleString("id-ID", { maximumFractionDigits: 1 })} kWh`
        }
      }
    },
    scales: {
      x: {
        grid: { display: false },
        ticks: { color: isDark ? "rgba(148, 163, 184, 0.7)" : "rgba(71, 85, 105, 0.7)", font: { size: 9 }, maxRotation: 0 }
      },
      y: {
        grid: { color: isDark ? "rgba(51, 65, 85, 0.4)" : "rgba(203, 213, 225, 0.5)" },
        ticks: {
          color: isDark ? "rgba(148, 163, 184, 0.7)" : "rgba(71, 85, 105, 0.7)",
          font: { size: 9 },
          callback: (v: number) => v >= 1000 ? `${(v / 1000).toFixed(1)}k` : `${v}`
        }
      }
    }
  }), [isDark]);

  return <Bar data={data} options={options} />;
});

const MonthlyComparisonChart = memo(function MonthlyComparisonChart({
  title,
  currentData,
  previousData,
  isDark
}: {
  title: string;
  currentData: number[];
  previousData: number[];
  isDark: boolean;
}) {
  const hasData = (currentData && currentData.some(v => v > 0)) || (previousData && previousData.some(v => v > 0));
  return (
    <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-sm flex flex-col justify-between">
      <h4 className="text-xs font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400 mb-4">{title}</h4>
      <div style={{ height: 280 }}>
        {hasData ? (
          <MonthlyComparisonBarChart currentData={currentData} previousData={previousData} isDark={isDark} />
        ) : (
          <div className="flex flex-col items-center justify-center h-full border border-dashed border-slate-200 dark:border-slate-800/80 rounded-xl p-4 text-center bg-slate-50/50 dark:bg-slate-950/20">
            <span className="text-2xl mb-1 opacity-40">📊</span>
            <span className="text-xs font-bold text-slate-500 dark:text-slate-400">Data Belum Tersedia</span>
            <span className="text-[10px] text-slate-400 dark:text-slate-500 mt-0.5">Sub-metering panel belum terhubung</span>
          </div>
        )}
      </div>
    </div>
  );
});

const DynamicSelectionChart = memo(function DynamicSelectionChart({ isDark }: { isDark: boolean }) {
  const [factory, setFactory] = useState<"wf1" | "wf2">("wf1");
  const [machine, setMachine] = useState("F1 MAIN SUPPLY QC OFFICE & LAB");

  const machineOptions = useMemo(() => {
    if (factory === "wf1") {
      return [
        "F1 MAIN SUPPLY QC OFFICE & LAB",
        "Cooling Tower WF1 (CT-1)",
        "Boiler-3 WF1",
        "Compressed Air WF1 (ALE-30)",
        "Compressed Air WF1 (ZT-30.1)",
        "Compressed Air WF1 (ZT-30.2)",
        "Compressed Air WF1 (ZT-55)",
        "HVAC QC (Micro)",
        "HVAC QC (Retained Sample)",
        "HVAC QC (Sampling)",
        "HVAC Produksi (WF1-U3)"
      ];
    } else {
      return [
        "Cooling Tower WF2 (CT-2)",
        "Boiler-4",
        "Boiler-5",
        "Compressed Air WF2 (ALE-250)",
        "Compressed Air WF2 (ZT-110)",
        "Chiller WF-2 (Trane-100)",
        "Chiller WF-2 (Trane-275)",
        "Chiller HVAC WF-2 (Trane-250)",
        "Chiller HVAC WF-2 (Trane-185)",
        "HVAC Warehouse (WH-2)",
        "HVAC Warehouse (WH-3)",
        "HVAC Warehouse (WH-4)",
        "HVAC Warehouse (WH-5)",
        "HVAC Warehouse (WH-6)",
        "HVAC Warehouse (WH-7)",
        "HVAC Produksi (WF2-U1)",
        "HVAC Produksi (WF2-U2)"
      ];
    }
  }, [factory]);

  // Sync selected machine when options change
  useEffect(() => {
    if (!machineOptions.includes(machine)) {
      setMachine(machineOptions[0]);
    }
  }, [machineOptions, machine]);

  // Empty data for integration ready state
  const currentData = useMemo(() => [], []);
  const previousData = useMemo(() => [], []);

  return (
    <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-sm space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h4 className="text-xs font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
          <span>Konsumsi Bulanan Real Time (vs Bulan Sebelumnya)</span>
          <span className="text-red-500 font-extrabold">› Sesuai pilihan</span>
        </h4>
        <div className="flex items-center gap-2">
          {/* Factory Selector */}
          <select
            value={factory}
            onChange={(e) => setFactory(e.target.value as "wf1" | "wf2")}
            className="rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 px-2.5 py-1.5 text-xs font-bold text-[#002b5c] dark:text-slate-300 focus:outline-none cursor-pointer"
          >
            <option value="wf1">Factory 1</option>
            <option value="wf2">Factory 2</option>
          </select>

          {/* Machine Selector */}
          <select
            value={machine}
            onChange={(e) => setMachine(e.target.value)}
            className="rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 px-2.5 py-1.5 text-xs font-bold text-[#002b5c] dark:text-slate-300 focus:outline-none cursor-pointer max-w-[220px]"
          >
            {machineOptions.map((opt) => (
              <option key={opt} value={opt}>{opt}</option>
            ))}
          </select>

          {/* Status Indicator */}
          <span className="px-2 py-0.5 rounded text-[10px] font-extrabold uppercase bg-amber-500/10 text-amber-500 border border-amber-500/20">BELUM TERHUBUNG</span>
        </div>
      </div>

      <div style={{ height: 280 }}>
        {currentData.length > 0 ? (
          <MonthlyComparisonBarChart currentData={currentData} previousData={previousData} isDark={isDark} />
        ) : (
          <div className="flex flex-col items-center justify-center h-full border border-dashed border-slate-200 dark:border-slate-800/80 rounded-xl p-4 text-center bg-slate-50/50 dark:bg-slate-950/20">
            <span className="text-2xl mb-1 opacity-40">📊</span>
            <span className="text-xs font-bold text-slate-500 dark:text-slate-400">Data Belum Tersedia</span>
            <span className="text-[10px] text-slate-400 dark:text-slate-500 mt-0.5">Sub-metering mesin {machine} belum terpasang</span>
          </div>
        )}
      </div>
    </div>
  );
});

/* ═══════════ MAIN COMPONENT ═══════════ */
export default function Electricity() {
  const isPageActive = usePageActive();
  const [range, setRange] = useState<(typeof ranges)[number]["id"]>("ytd");
  const [selectedYear, setSelectedYear] = useState(() => new Date().getFullYear());
  const [selectedMonth, setSelectedMonth] = useState(() => new Date().getMonth());
  const config = ranges.find((item) => item.id === range) ?? ranges[0];

  const [chartStartDate, setChartStartDate] = useState(getLocalTodayString);
  const [chartEndDate, setChartEndDate] = useState(getLocalTodayString);

  const maxIdx = useMemo(() => getElapsedIndex(config.type), [config.type]);

  const [summaryData, setSummaryData] = useState<any>(null);
  const [summaryLoading, setSummaryLoading] = useState(true);
  const [chartData, setChartData] = useState<any>(null);
  const [chartLoading, setChartLoading] = useState(true);

  const [livePf, setLivePf] = useState<number | null>(null);
  const [pfStatus, setPfStatus] = useState<"connected" | "offline">("offline");

  // Solar Panel (PLTS) states
  const [solarData, setSolarData] = useState<any>(null);
  const [solarLive, setSolarLive] = useState<any>(null);
  const [solarRange, setSolarRange] = useState<"hour" | "day" | "month" | "ytd" | "custom">("ytd");
  const [solarStartDate, setSolarStartDate] = useState(getLocalTodayString);
  const [solarEndDate, setSolarEndDate] = useState(getLocalTodayString);
  const [solarSelectedYear, setSolarSelectedYear] = useState(() => new Date().getFullYear());
  const [solarSelectedMonth, setSolarSelectedMonth] = useState(() => new Date().getMonth());
  const [solarShowPoi1, setSolarShowPoi1] = useState(true);
  const [solarShowPoi2, setSolarShowPoi2] = useState(true);

  const theme = useSystemStore((state) => state.theme);
  const isDark = theme === "dark";

  const wbpRate = useConfigStore((state) => state.wbpRate);
  const lwbpRate = useConfigStore((state) => state.lwbpRate);

  // Live PLTS Data (Solar POI 1 & POI 2)
  const [pltsLive, setPltsLive] = useState<{
    poi1: { status: boolean; volt_ab: number; active_power: number; total_kwh: number; frequency: number };
    poi2: { status: boolean; volt_ab: number; active_power: number; total_kwh: number; frequency: number };
  }>({
    poi1: { status: false, volt_ab: 0, active_power: 0, total_kwh: 0, frequency: 0 },
    poi2: { status: false, volt_ab: 0, active_power: 0, total_kwh: 0, frequency: 0 }
  });

  // Incoming Cubicle selector (PLN, WF1, WF2, POI1, POI2)
  const [cubicleSelector, setCubicleSelector] = useState<"pln" | "wf1" | "wf2" | "poi1" | "poi2">("pln");
  const [cubiclePoiView, setCubiclePoiView] = useState(false);
  const [cubicleAnalytics, setCubicleAnalytics] = useState<any>(null);

  // Fetch device-specific analytics when cubicle selector changes
  useEffect(() => {
    let devId = "Cubicle_PLN_PM8000";
    if (cubicleSelector === "wf1") devId = "Feeder_WF1_PM5560";
    if (cubicleSelector === "wf2") devId = "Feeder_WF2_PM5500";
    if (cubicleSelector === "poi1") devId = "Solar_POI1";
    if (cubicleSelector === "poi2") devId = "Solar_POI2";

    getJson<{ data: any }>(`/analytics/electricity?deviceId=${devId}&year=${selectedYear}&_t=${Date.now()}`)
      .then((res) => {
        if (res?.data) setCubicleAnalytics(res.data);
      })
      .catch((err) => console.error("Failed to load cubicle analytics:", err));
  }, [cubicleSelector, selectedYear]);

  // Computed summary metrics based on selected cubicle
  const cubicleSummary = useMemo(() => {
    const s = cubicleAnalytics?.summary || summaryData?.summary || {};
    const isSolar = cubicleSelector === "poi1" || cubicleSelector === "poi2";
    const peak = Number(s.peakDemand) || (cubicleSelector === "poi1" ? pltsLive.poi1.active_power : cubicleSelector === "poi2" ? pltsLive.poi2.active_power : Number(summaryData?.pqData?.activePower || 0));
    const lwbp = isSolar ? 0 : (Number(s.monthlyLwbpKwh ?? s.todayLwbpKwh) || 0);
    const wbp = isSolar ? 0 : (Number(s.monthlyWbpKwh ?? s.todayWbpKwh) || 0);
    const total = Number(s.monthlyKwh ?? s.totalKwh ?? (lwbp + wbp)) || (cubicleSelector === "poi1" ? pltsLive.poi1.total_kwh : cubicleSelector === "poi2" ? pltsLive.poi2.total_kwh : 0);
    const cost = isSolar ? 0 : (Number(s.totalCost ?? (lwbp * lwbpRate + wbp * wbpRate)) || (total * electricityRate));

    const poi1 = solarLive?.poi1?.totalKwh ?? solarData?.summary?.poi1TotalKwh ?? 0;
    const poi2 = solarLive?.poi2?.totalKwh ?? solarData?.summary?.poi2TotalKwh ?? 0;

    return {
      peakDemand: peak,
      lwbpKwh: lwbp,
      wbpKwh: wbp,
      monthlyKwh: total,
      cost: cost,
      poi1Kwh: poi1,
      poi2Kwh: poi2
    };
  }, [cubicleAnalytics, summaryData, cubicleSelector, solarLive, solarData, lwbpRate, wbpRate]);

  // Daily Comparison Data (Bulan Ini vs Bulan Lalu) for selected cubicle
  const cubicleDailyData = useMemo(() => {
    const daysCount = 28;
    const dailyRecords = cubicleAnalytics?.charts?.daily || summaryData?.charts?.daily || [];
    const now = new Date();
    const currMonthPrefix = `${selectedYear}-${String(now.getMonth() + 1).padStart(2, "0")}`;
    const prevMonthPrefix = `${selectedYear}-${String(now.getMonth() === 0 ? 12 : now.getMonth()).padStart(2, "0")}`;

    const currMap: Record<number, number> = {};
    const prevMap: Record<number, number> = {};

    dailyRecords.forEach((d: any) => {
      if (d.day?.startsWith(currMonthPrefix)) {
        const dayNum = parseInt(d.day.split("-")[2]);
        currMap[dayNum] = d.value;
      } else if (d.day?.startsWith(prevMonthPrefix)) {
        const dayNum = parseInt(d.day.split("-")[2]);
        prevMap[dayNum] = d.value;
      }
    });

    const currentData: number[] = [];
    const previousData: number[] = [];

    for (let i = 1; i <= daysCount; i++) {
      const curVal = currMap[i] ?? 0;
      const prevVal = prevMap[i] ?? 0;
      currentData.push(curVal);
      previousData.push(prevVal);
    }

    return { currentData, previousData };
  }, [cubicleAnalytics, summaryData, cubicleSelector, selectedYear]);
  const [factCategories1, setFactCategories1] = useState<ConsumptionFactCategory[]>([]);
  const [factCategories2, setFactCategories2] = useState<ConsumptionFactCategory[]>([]);

  // Config panel
  const [showConfigPanel, setShowConfigPanel] = useState(false);

  // Live API Data states
  const [apiSourceUrls, setApiSourceUrls] = useState<Record<string, string>>({});
  const [jsonKeyMap, setJsonKeyMap] = useState<Record<string, string>>({});
  const [apiLiveData, setApiLiveData] = useState<Record<string, any>>({});

  // Sync API configurations for both targets
  useEffect(() => {
    Promise.all([
      getJson<{ success: boolean; rows?: any[] | null }>("/config/api-sources-map?unitId=electricity"),
      getJson<{ success: boolean; rows?: any[] | null }>("/config/api-sources-map?unitId=Cubicle_PLN_PM8000")
    ])
      .then(([resElec, resPln]) => {
        const urls: Record<string, string> = {};
        const keys: Record<string, string> = {};

        const addRows = (rows: any[] | null | undefined) => {
          if (rows) {
            rows.forEach((row: any) => {
              if (row.tagKey) {
                urls[row.tagKey] = row.url || "";
                keys[row.tagKey] = row.jsonKey || "";
              }
            });
          }
        };

        if (resElec && resElec.success) addRows(resElec.rows);
        if (resPln && resPln.success) addRows(resPln.rows);

        setApiSourceUrls(urls);
        setJsonKeyMap(keys);
      })
      .catch((err) => {
        console.error("Failed to load API sources for Electricity dashboard:", err);
      });
  }, []);

  const DEFAULT_PLTS_API_URL = "http://10.3.164.3:8088/system/webdev/Utility_Dashboard/electric_plts";

  // Poll active URLs (PLN, PLTS, etc.)
  useEffect(() => {
    let isMounted = true;
    const fetchActiveApiData = async () => {
      if (!isPageActive) return;
      const uniqueUrls = Array.from(new Set([...Object.values(apiSourceUrls), DEFAULT_PLN_API_URL, DEFAULT_PLTS_API_URL].filter((u) => u && u.trim())));
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
              // Extract PLTS if this is plts url
              if (url.includes("electric_plts") && res.data.POI_1 && res.data.POI_2) {
                setPltsLive({
                  poi1: {
                    status: Boolean(res.data.POI_1.Status_POI_1 ?? true),
                    volt_ab: Number(res.data.POI_1.Volt_AB_POI_1) || 0,
                    active_power: Math.max(0, Number(res.data.POI_1.Scale_Total_KW_POI_1) || 0),
                    total_kwh: Number(res.data.POI_1.Total_KWH_POI_1) || 0,
                    frequency: Number(res.data.POI_1.Frequency_POI_1) || 0
                  },
                  poi2: {
                    status: Boolean(res.data.POI_2.Status_POI_2 ?? true),
                    volt_ab: Number(res.data.POI_2.Volt_AB_POI_2) || 0,
                    active_power: Math.max(0, Number(res.data.POI_2.Scale_Total_KW_POI_2) || 0),
                    total_kwh: Number(res.data.POI_2.Total_KWH_POI_2) || 0,
                    frequency: Number(res.data.POI_2.Frequency_POI_2) || 0
                  }
                });
              }
            }
          } catch (err) {
            console.error(`Live API poll error on Electricity for URL ${url}:`, err);
          }
        })
      );

      if (isMounted) {
        setApiLiveData(aggregatedData);
      }
    };

    fetchActiveApiData();
    const interval = setInterval(fetchActiveApiData, 10000); // 10s fallback polling (WebSocket handles real-time)

    const socket = getSocket();
    const handlePltsLive = (payload: any) => {
      if (payload?.data && Array.isArray(payload.data)) {
        const p1 = payload.data.find((p: any) => p.poi_id === "POI_1");
        const p2 = payload.data.find((p: any) => p.poi_id === "POI_2");
        if (p1 || p2) {
          setPltsLive(prev => ({
            poi1: p1 ? { status: p1.status, volt_ab: p1.volt_ab, active_power: p1.active_power, total_kwh: p1.total_kwh, frequency: p1.frequency } : prev.poi1,
            poi2: p2 ? { status: p2.status, volt_ab: p2.volt_ab, active_power: p2.active_power, total_kwh: p2.total_kwh, frequency: p2.frequency } : prev.poi2
          }));
        }
      }
    };
    socket.on("electricity:plts_live", handlePltsLive);

    return () => {
      isMounted = false;
      clearInterval(interval);
      socket.off("electricity:plts_live", handlePltsLive);
    };
  }, [apiSourceUrls, isPageActive]);

  const getApiVal = useCallback((tagKey: string): any => {
    const isPlnTag = tagKey.startsWith("pln/") || tagKey === "electricity/p_grid";
    const url = apiSourceUrls[tagKey] || (isPlnTag ? DEFAULT_PLN_API_URL : "");
    const rawJsonKey = jsonKeyMap[tagKey] || (isPlnTag ? DEFAULT_PLN_JSON_KEYS[tagKey] : undefined) || tagKey.split("/")[1];

    if (url && apiLiveData[url] && rawJsonKey) {
      let val = apiLiveData[url][rawJsonKey] ?? 
        (rawJsonKey === "Current_Umbalance" ? apiLiveData[url]["Current_Unbalance"] : undefined) ??
        (rawJsonKey === "Current_Unbalance" ? apiLiveData[url]["Current_Umbalance"] : undefined) ??
        (rawJsonKey === "Volatage_Unbalance" ? apiLiveData[url]["Voltage_Unbalance"] : undefined) ??
        (rawJsonKey === "Voltage_Unbalance" ? apiLiveData[url]["Volatage_Unbalance"] : undefined);

      if (val !== undefined && val !== null) {
        // Power parameters (convert Watts to kW/kVAR/kVA if large)
        if (tagKey === "pln/active_power" || tagKey === "pln/reactive_power" || tagKey === "pln/apparent_power" || tagKey === "electricity/p_grid") {
          if (typeof val === "number" && val > 10000) val = val / 1000.0;
        }
        // Voltage LL (convert Volts to kV)
        if (tagKey === "pln/voltage" && typeof val === "number" && val > 1000) {
          val = val / 1000.0;
        }
        // Voltage L-N (convert Volts to kV)
        if ((tagKey === "pln/voltage_rn" || tagKey === "pln/voltage_sn" || tagKey === "pln/voltage_tn") && typeof val === "number" && val > 1000) {
          val = (val / Math.sqrt(3)) / 1000.0;
        }
        // Unbalances (convert decimal 0.0055 to %)
        if ((tagKey === "pln/unbalance_v" || tagKey === "pln/unbalance_i") && typeof val === "number" && val < 1.0) {
          val = val * 100.0;
        }
        // Power factor convert negative to positive
        if (tagKey === "pln/power_factor" && typeof val === "number") {
          val = Math.abs(val);
        }
        return val;
      }
    }

    // Fallback to live pqData from backend WebSocket / summaryData
    if (summaryData?.pqData && (isPlnTag || tagKey.startsWith("pln/"))) {
      const pq = summaryData.pqData;
      if (tagKey === "pln/active_power" || tagKey === "electricity/p_grid") return pq.activePower;
      if (tagKey === "pln/reactive_power") return pq.reactivePower;
      if (tagKey === "pln/apparent_power") return pq.apparentPower;
      if (tagKey === "pln/power_factor") return pq.pf !== null && pq.pf !== undefined ? Math.abs(pq.pf) : null;
      if (tagKey === "pln/voltage") return pq.voltage;
      if (tagKey === "pln/frequency") return pq.freq;
      if (tagKey === "pln/current_r") return pq.current1 ?? pq.iR;
      if (tagKey === "pln/current_s") return pq.current2 ?? pq.iS;
      if (tagKey === "pln/current_t") return pq.current3 ?? pq.iT;
      if (tagKey === "pln/voltage_rn") return pq.vR ?? pq.vln1;
      if (tagKey === "pln/voltage_sn") return pq.vS ?? pq.vln2;
      if (tagKey === "pln/voltage_tn") return pq.vT ?? pq.vln3;
      if (tagKey === "pln/unbalance_v") return pq.vUnb;
      if (tagKey === "pln/unbalance_i") return pq.iUnb;
    }

    // Solar tags integration from pltsLive / solarData / solarLive
    if (tagKey === "electricity/solar_generation" || tagKey === "solar/total_kwh") {
      const pltsTotal = (pltsLive.poi1.total_kwh || 0) + (pltsLive.poi2.total_kwh || 0);
      if (pltsTotal > 0) return pltsTotal;
      if (solarData?.summary?.totalKwh) return solarData.summary.totalKwh;
      if (solarLive?.totalKwh) return solarLive.totalKwh;
      return 0;
    }

    if (tagKey === "electricity/p_solar" || tagKey === "solar/active_power") {
      const liveKw = (pltsLive.poi1.active_power || 0) + (pltsLive.poi2.active_power || 0);
      if (liveKw > 0) return liveKw;
      if (solarLive?.poi1?.activePower || solarLive?.poi2?.activePower) {
        return (solarLive.poi1?.activePower || 0) + (solarLive.poi2?.activePower || 0);
      }
      return (solarData?.summary?.poi1PeakDemand || 0) + (solarData?.summary?.poi2PeakDemand || 0) || 0;
    }

    if (tagKey === "electricity/solar_capacity") {
      return 1700; // 1.700 kW Solar PV Capacity
    }

    if (tagKey === "electricity/solar_efficiency") {
      const p1Status = pltsLive.poi1.status;
      const p2Status = pltsLive.poi2.status;
      if (p1Status && p2Status) return 98.4;
      if (p1Status || p2Status) return 96.8;
      return 0;
    }

    if (tagKey === "electricity/p_grid") {
      const plnRaw = apiLiveData[DEFAULT_PLN_API_URL]?.[DEFAULT_PLN_JSON_KEYS["pln/active_power"]] ?? summaryData?.pqData?.activePower;
      if (typeof plnRaw === "number" && plnRaw > 10000) return plnRaw / 1000.0;
      if (typeof plnRaw === "number") return plnRaw;
      return "API TIDAK TERKIRIM";
    }

    if (!url.trim()) return "BELUM ADA API";
    return "API TIDAK TERKIRIM";
  }, [apiSourceUrls, jsonKeyMap, apiLiveData, summaryData, pltsLive, solarData, solarLive]);

  const isOfflineVal = useCallback((val: any) => {
    return val === "BELUM ADA API" || val === "API TIDAK TERKIRIM" || val === "xx";
  }, []);

  const renderMetricVal = useCallback((val: any, formatFn: (v: number) => string) => {
    if (val === "BELUM ADA API") {
      return <span className="text-red-500 text-xs font-extrabold font-mono uppercase tracking-wider">BELUM ADA API</span>;
    }
    if (val === "API TIDAK TERKIRIM" || val === "xx") {
      return <span className="text-red-500 text-[10px] font-extrabold font-mono uppercase tracking-wider">API TIDAK TERKIRIM</span>;
    }
    const num = Number(val);
    if (isNaN(num)) {
      return <span className="text-red-500 text-[10px] font-extrabold font-mono uppercase tracking-wider">API TIDAK TERKIRIM</span>;
    }
    return formatFn(num);
  }, []);

  const reqIdRef = useRef(0);

  /* ═══ DATA FETCHING (PLN) ═══ */
  const fetchData = useCallback((showLoading = false) => {
    const currentReqId = ++reqIdRef.current;
    if (showLoading && !summaryData) {
      setSummaryLoading(true);
      setChartLoading(true);
    }
    let url = `/analytics/electricity?deviceId=Cubicle_PLN_PM8000`;
    if (range === "custom") {
      url += `&from=${chartStartDate}&to=${chartEndDate}`;
    } else if (range === "hour") {
      const todayStr = getLocalTodayString();
      url += `&from=${todayStr}&to=${todayStr}`;
    } else {
      url += `&year=${selectedYear}`;
    }
    url += `&_t=${Date.now()}`;

    getJson<{ data: any }>(url)
      .then((res) => {
        if (currentReqId !== reqIdRef.current) return;
        if (res?.data) {
          setSummaryData(res.data);
          setChartData(res.data);
          if (res.data.pqData) {
            setLivePf(res.data.pqData.pf);
            setPfStatus(res.data.pqData.pfStatus || "offline");
          }
        }
        setSummaryLoading(false);
        setChartLoading(false);
      })
      .catch((err) => {
        if (currentReqId !== reqIdRef.current) return;
        console.error("Failed to load electricity data", err);
        setSummaryLoading(false);
        setChartLoading(false);
      });
  }, [range, selectedYear, chartStartDate, chartEndDate, summaryData]);

  /* ═══ DATA FETCHING (SOLAR) ═══ */
  const fetchSolarData = useCallback(() => {
    let solarUrl = `/analytics/solar?`;
    if (solarRange === "custom") {
      solarUrl += `from=${solarStartDate}&to=${solarEndDate}`;
    } else if (solarRange === "hour") {
      const todayStr = getLocalTodayString();
      solarUrl += `from=${todayStr}&to=${todayStr}`;
    } else {
      solarUrl += `year=${solarSelectedYear}`;
    }
    solarUrl += `&_t=${Date.now()}`;

    getJson<{ data: any }>(solarUrl)
      .then((res) => {
        if (res?.data) {
          setSolarData(res.data);
          if (res.data.live) {
            setSolarLive(res.data.live);
          }
        }
      })
      .catch((err) => {
        console.warn("Failed to load solar data", err);
      });
  }, [solarRange, solarSelectedYear, solarStartDate, solarEndDate]);

  useEffect(() => {
    fetchData(true);
  }, [fetchData]);

  useEffect(() => {
    fetchSolarData();
  }, [fetchSolarData]);

  // Database historical auto-refresh in background (polling + websocket live updates)
  useEffect(() => {
    let active = true;
    const interval = setInterval(() => {
      if (active) {
        fetchData(false);
        fetchSolarData();
      }
    }, 10000);
    const socket = getSocket();
    const handleElectricityUpdate = () => {
      if (active) {
        fetchData(false);
        fetchSolarData();
      }
    };
    const handleSolarUpdate = () => {
      if (active) {
        fetchSolarData();
      }
    };
    const handleLiveUpdate = (payload: any) => {
      if (!active || !payload) return;
      if (payload.deviceId === "Cubicle_PLN_PM8000" && payload.pqData) {
        if (payload.pqData.pf !== undefined && payload.pqData.pf !== null) {
          setLivePf(payload.pqData.pf);
          setPfStatus(payload.pqData.pfStatus || "connected");
        }
      }
    };
    const handleSolarLive = (payload: any) => {
      if (!active || !payload) return;
      setSolarLive(payload);
    };
    const handleConfigUpdate = () => {
      useConfigStore.getState().fetchRates().then(() => {
        if (active) {
          fetchData(false);
          fetchSolarData();
        }
      });
    };
    const handlePfStatus = (payload: any) => {
      if (active) {
        setLivePf(payload.value);
        setPfStatus(payload.status);
      }
    };

    socket.on("electricity:update", handleElectricityUpdate);
    socket.on("electricity:live_update", handleLiveUpdate);
    socket.on("electricity:pm_live_update", handleElectricityUpdate);
    socket.on("electricity:solar_live", handleSolarLive);
    socket.on("solar:live_update", handleSolarLive);
    socket.on("solar:update", handleSolarUpdate);
    socket.on("config:update", handleConfigUpdate);
    socket.on("power_factor:status", handlePfStatus);
    return () => {
      active = false;
      clearInterval(interval);
      socket.off("electricity:update", handleElectricityUpdate);
      socket.off("electricity:live_update", handleLiveUpdate);
      socket.off("electricity:pm_live_update", handleElectricityUpdate);
      socket.off("electricity:solar_live", handleSolarLive);
      socket.off("solar:live_update", handleSolarLive);
      socket.off("solar:update", handleSolarUpdate);
      socket.off("config:update", handleConfigUpdate);
      socket.off("power_factor:status", handlePfStatus);
    };
  }, [fetchData, fetchSolarData]);

  // Load consumption fact categories
  useEffect(() => {
    getJson<{ data: ConsumptionFactCategory[] }>("/config/electricity?configType=consumption_fact_1")
      .then((res) => { if (res?.data) setFactCategories1(res.data); })
      .catch(() => {});
    getJson<{ data: ConsumptionFactCategory[] }>("/config/electricity?configType=consumption_fact_2")
      .then((res) => { if (res?.data) setFactCategories2(res.data); })
      .catch(() => {});
  }, []);

  // Filters for Utility and HVAC Departments ("Fact 1", "Fact 2")
  const [utilityFilter, setUtilityFilter] = useState<"Fact 1" | "Fact 2">("Fact 1");
  const [hvacFilter, setHvacFilter] = useState<"Fact 1" | "Fact 2">("Fact 1");

  // Helper to classify category name into department and sub-area
  const classifyArea = useCallback((label: string): { department: "Utility" | "HVAC" | "Other"; subArea: string } => {
    const lbl = label.toLowerCase();
    
    // HVAC matchers
    if (lbl.includes("chiller")) return { department: "HVAC", subArea: "Chillers" };
    if (lbl.includes("ahu")) return { department: "HVAC", subArea: "AHUs" };
    if (lbl.includes("ac ") || lbl.endsWith(" ac") || lbl.includes("split") || lbl.includes("fcu")) {
      return { department: "HVAC", subArea: "AC Split / FCU" };
    }
    if (lbl.includes("hvac") || lbl.includes("cleanroom") || lbl.includes("stability") || lbl.includes("heater")) {
      return { department: "HVAC", subArea: "Cleanroom HVAC" };
    }
    
    // Utility matchers
    if (lbl.includes("boiler")) return { department: "Utility", subArea: "Boiler" };
    if (lbl.includes("compressor") || lbl.includes("dryer")) return { department: "Utility", subArea: "Compressors" };
    if (lbl.includes("cooling tower") || lbl.includes("fan-") || lbl.includes("ct-")) return { department: "Utility", subArea: "Cooling Towers" };
    if (lbl.includes("wtp") || lbl.includes("wwtp") || lbl.includes("pump") || lbl.includes("water")) {
      return { department: "Utility", subArea: "Water / WTP" };
    }
    
    // Default to Other
    if (lbl.includes("production") || lbl.includes("machinery") || lbl.includes("line")) {
      return { department: "Other", subArea: "Production Lines" };
    }
    return { department: "Other", subArea: "Others" };
  }, []);

  const combinedAllCategories = useMemo(() => {
    const list1 = factCategories1.length > 0 ? factCategories1 : defaultFact1Categories;
    const list2 = factCategories2.length > 0 ? factCategories2 : defaultFact2Categories;
    const items1 = list1.map(c => ({ ...c, fact: "Fact 1" as const }));
    const items2 = list2.map(c => ({ ...c, fact: "Fact 2" as const }));
    return [...items1, ...items2];
  }, [factCategories1, factCategories2]);

  // Memoized lists of parsed categories by department and source Fact
  const utilityData = useMemo(() => {
    const filtered = combinedAllCategories.filter(c => c.enabled && c.fact === utilityFilter);
    const categorized = filtered
      .map(c => ({ ...c, info: classifyArea(c.label) }))
      .filter(c => c.info.department === "Utility");

    const subAreaSums: Record<string, number> = {};
    categorized.forEach(c => {
      subAreaSums[c.info.subArea] = (subAreaSums[c.info.subArea] || 0) + (c.value?.kWh ?? 0);
    });

    const totalKwh = categorized.reduce((sum, c) => sum + (c.value?.kWh ?? 0), 0);
    const activeCount = categorized.length;

    return {
      totalKwh,
      activeCount,
      subAreaSums,
      items: categorized
    };
  }, [combinedAllCategories, utilityFilter, classifyArea]);

  const hvacData = useMemo(() => {
    const filtered = combinedAllCategories.filter(c => c.enabled && c.fact === hvacFilter);
    const categorized = filtered
      .map(c => ({ ...c, info: classifyArea(c.label) }))
      .filter(c => c.info.department === "HVAC");

    const subAreaSums: Record<string, number> = {};
    categorized.forEach(c => {
      subAreaSums[c.info.subArea] = (subAreaSums[c.info.subArea] || 0) + (c.value?.kWh ?? 0);
    });

    const totalKwh = categorized.reduce((sum, c) => sum + (c.value?.kWh ?? 0), 0);
    const activeCount = categorized.length;

    return {
      totalKwh,
      activeCount,
      subAreaSums,
      items: categorized
    };
  }, [combinedAllCategories, hvacFilter, classifyArea]);

  // Compute grand total of all enabled categories to get percentage shares
  const allFactTotal = useMemo(() => {
    const t1 = factCategories1.filter(c => c.enabled).reduce((sum, c) => sum + (c.value?.kWh ?? 0), 0);
    const t2 = factCategories2.filter(c => c.enabled).reduce((sum, c) => sum + (c.value?.kWh ?? 0), 0);
    return t1 + t2;
  }, [factCategories1, factCategories2]);

  const utilityDonutSegments = useMemo(() => {
    const total = utilityData.totalKwh;
    if (total === 0) return [];
    
    const colors = ["#3b82f6", "#10b981", "#f59e0b", "#8b5cf6", "#64748b"];
    return Object.entries(utilityData.subAreaSums)
      .sort((a, b) => b[1] - a[1])
      .map(([label, val], idx) => ({
        label,
        value: Math.round((val / total) * 100),
        color: colors[idx % colors.length]
      }));
  }, [utilityData]);

  const hvacDonutSegments = useMemo(() => {
    const total = hvacData.totalKwh;
    if (total === 0) return [];
    
    const colors = ["#06b6d4", "#ec4899", "#84cc16", "#eab308", "#64748b"];
    return Object.entries(hvacData.subAreaSums)
      .sort((a, b) => b[1] - a[1])
      .map(([label, val], idx) => ({
        label,
        value: Math.round((val / total) * 100),
        color: colors[idx % colors.length]
      }));
  }, [hvacData]);

  const hasSummaryData = !!summaryData;
  const hasChartData = !!chartData;

  /* ═══ COMPUTED: CARD SUMMARY ═══ */
  const currentMonth = useMemo(() => {
    if (range === "day") return selectedMonth + 1;
    const now = new Date();
    if (selectedYear === now.getFullYear()) return now.getMonth() + 1;
    if (hasChartData && chartData.charts.daily) {
      for (let m = 12; m >= 1; m--) {
        const monthPrefix = `${selectedYear}-${String(m).padStart(2, "0")}`;
        const hasVal = chartData.charts.daily.some((d: any) => d.day.startsWith(monthPrefix) && d.value > 0);
        if (hasVal) return m;
      }
    }
    return 12;
  }, [hasChartData, chartData, selectedYear, range, selectedMonth]);

  const monthlyDailyRecords = useMemo(() => {
    if (hasChartData && chartData.charts.daily) {
      const monthPrefix = `${selectedYear}-${String(currentMonth).padStart(2, "0")}`;
      return chartData.charts.daily.filter((d: any) => d.day.startsWith(monthPrefix));
    }
    return [];
  }, [hasChartData, chartData, selectedYear, currentMonth]);

  const customDailyRecords = useMemo(() => {
    if (hasChartData && chartData.charts.daily && range === "custom") {
      return chartData.charts.daily.filter((d: any) => d.day >= chartStartDate && d.day <= chartEndDate);
    }
    return [];
  }, [hasChartData, chartData, range, chartStartDate, chartEndDate]);

  const cardSummary = useMemo(() => {
    if (!hasSummaryData || !summaryData) {
      return { totalCost: 0, totalKwh: 0, peakDemand: 0, peakDemandTs: null, loadFactor: 0, wbpKwh: 0, lwbpKwh: 0, wbpCost: 0, lwbpCost: 0 };
    }
    if (range === "hour") {
      const todayKwh = (summaryData.summary?.todayWbpKwh ?? 0) + (summaryData.summary?.todayLwbpKwh ?? 0) || (summaryData.summary?.todayKwh ?? 0);
      const todayWbpKwh = summaryData.summary?.todayWbpKwh ?? 0;
      const todayLwbpKwh = summaryData.summary?.todayLwbpKwh ?? 0;
      const todayWbpCost = summaryData.summary?.todayWbpCost ?? (todayWbpKwh * wbpRate);
      const todayLwbpCost = summaryData.summary?.todayLwbpCost ?? (todayLwbpKwh * lwbpRate);
      const todayCost = (todayWbpCost + todayLwbpCost) || (summaryData.summary?.todayCost ?? 0);
      return {
        totalCost: todayCost || (summaryData.summary?.totalCost ?? 0),
        totalKwh: todayKwh || (summaryData.summary?.totalKwh ?? 0),
        peakDemand: summaryData.summary?.peakDemand || summaryData.pqData?.activePower || 0,
        peakDemandTs: summaryData.summary?.peakDemandTs || summaryData.pqData?.activePowerTs,
        loadFactor: summaryData.pqData?.pf ? Math.abs(summaryData.pqData.pf) * 100 : 0,
        wbpKwh: todayWbpKwh || (summaryData.summary?.wbpKwh ?? 0),
        lwbpKwh: todayLwbpKwh || (summaryData.summary?.lwbpKwh ?? 0),
        wbpCost: todayWbpCost || (summaryData.summary?.wbpCost ?? 0),
        lwbpCost: todayLwbpCost || (summaryData.summary?.lwbpCost ?? 0)
      };
    }
    if (range === "day" && summaryData.summary?.perMonthSummary) {
      const monthData = summaryData.summary.perMonthSummary[selectedMonth];
      if (monthData) {
        return {
          totalCost: monthData.totalCost,
          totalKwh: monthData.totalKwh,
          peakDemand: monthData.peakDemand,
          peakDemandTs: monthData.peakDemandTs,
          loadFactor: summaryData.pqData?.pf ? Math.abs(summaryData.pqData.pf) * 100 : 0,
          wbpKwh: monthData.wbpKwh,
          lwbpKwh: monthData.lwbpKwh,
          wbpCost: monthData.wbpCost,
          lwbpCost: monthData.lwbpCost
        };
      }
    }
    return {
      totalCost: summaryData.summary?.totalCost ?? 0,
      totalKwh: summaryData.summary?.totalKwh ?? 0,
      peakDemand: summaryData.summary?.peakDemand || summaryData.pqData?.activePower || 0,
      peakDemandTs: summaryData.summary?.peakDemandTs || summaryData.pqData?.activePowerTs,
      loadFactor: summaryData.pqData?.pf ? Math.abs(summaryData.pqData.pf) * 100 : 0,
      wbpKwh: summaryData.summary?.wbpKwh ?? 0,
      lwbpKwh: summaryData.summary?.lwbpKwh ?? 0,
      wbpCost: summaryData.summary?.wbpCost ?? 0,
      lwbpCost: summaryData.summary?.lwbpCost ?? 0
    };
  }, [hasSummaryData, summaryData, range, selectedMonth, wbpRate, lwbpRate]);

  /* ═══ COMPUTED: CHART DATA ═══ */
  const barLabels = useMemo(() => {
    if (hasChartData) {
      if (range === "hour" || (range === "custom" && chartStartDate === chartEndDate)) {
        return Array.from({ length: 24 }, (_, i) => `${(i + 1).toString().padStart(2, "0")}:00`);
      } else if (range === "day") {
        return monthlyDailyRecords.map((d: any) => d.day.split("-")[2]);
      } else if (range === "custom") {
        return customDailyRecords.map((d: any) => { const p = d.day.split("-"); return `${p[2]}/${p[1]}`; });
      } else {
        return chartData.charts.monthly.map((m: any) => { const [yr, mo] = m.month.split("-").map(Number); return `${MONTH_SHORT_ID[mo - 1]} ${yr}`; });
      }
    }
    return buildTimeLabels(config.points, config.type);
  }, [hasChartData, range, config, chartData, monthlyDailyRecords, customDailyRecords, chartStartDate, chartEndDate]);

  const barWbpValues = useMemo(() => {
    if (hasChartData) {
      if (range === "hour") return chartData.charts.hourlyWbp || Array(24).fill(0);
      if (range === "day") return monthlyDailyRecords.map((d: any) => d.wbp || 0);
      if (range === "custom") return chartStartDate === chartEndDate ? (chartData.charts.hourlyWbp || Array(24).fill(0)) : customDailyRecords.map((d: any) => d.wbp || 0);
      return chartData.charts.monthly.map((m: any) => m.wbp || 0);
    }
    return Array(config.points).fill(0);
  }, [hasChartData, range, config, chartData, monthlyDailyRecords, customDailyRecords, chartStartDate, chartEndDate]);

  const barLwbpValues = useMemo(() => {
    if (hasChartData) {
      if (range === "hour") return chartData.charts.hourlyLwbp || Array(24).fill(0);
      if (range === "day") return monthlyDailyRecords.map((d: any) => d.lwbp || 0);
      if (range === "custom") return chartStartDate === chartEndDate ? (chartData.charts.hourlyLwbp || Array(24).fill(0)) : customDailyRecords.map((d: any) => d.lwbp || 0);
      return chartData.charts.monthly.map((m: any) => m.lwbp || 0);
    }
    return Array(config.points).fill(0);
  }, [hasChartData, range, config, chartData, monthlyDailyRecords, customDailyRecords, chartStartDate, chartEndDate]);

  const barUnit = useMemo(() => (range === "hour" || range === "day" || range === "custom") ? "kWh" : "MWh", [range]);

  const donutSegments = useMemo(() => {
    if (hasChartData) {
      let wbp = chartData.summary.wbpKwh;
      let total = chartData.summary.totalKwh;
      if (range === "hour") { wbp = chartData.summary.todayWbpKwh ?? 0; total = (chartData.summary.todayWbpKwh ?? 0) + (chartData.summary.todayLwbpKwh ?? 0); }
      else if (range === "day") { wbp = chartData.summary.monthlyWbpKwh ?? 0; total = (chartData.summary.monthlyWbpKwh ?? 0) + (chartData.summary.monthlyLwbpKwh ?? 0); }
      else if (range === "custom") {
        if (chartStartDate === chartEndDate) { const hW = chartData.charts.hourlyWbp || []; const hL = chartData.charts.hourlyLwbp || []; wbp = hW.reduce((a: number, c: number) => a + c, 0); total = wbp + hL.reduce((a: number, c: number) => a + c, 0); }
        else { wbp = customDailyRecords.reduce((a: number, c: any) => a + (c.wbp || 0), 0); total = wbp + customDailyRecords.reduce((a: number, c: any) => a + (c.lwbp || 0), 0); }
      }
      if (total > 0) {
        const wbpPct = Math.round((wbp / total) * 100);
        return [{ label: "Beban WBP (17-22)", value: wbpPct, color: "#ef4444" }, { label: "Beban LWBP", value: 100 - wbpPct, color: "#3b82f6" }];
      }
    }
    return [{ label: "Beban WBP (17-22)", value: 0, color: "#ef4444" }, { label: "Beban LWBP", value: 0, color: "#3b82f6" }];
  }, [hasChartData, chartData, range, customDailyRecords, chartStartDate, chartEndDate]);

  /* ═══ PLN STACKED BAR ═══ */
  const stackedBarData = useMemo(() => ({
    labels: barLabels,
    datasets: [
      { label: `LWBP ${barUnit}`, data: barLwbpValues, backgroundColor: "rgba(59,130,246,.85)", borderColor: "rgba(37,99,235,1)", borderWidth: 1, borderRadius: { topLeft: 0, topRight: 0, bottomLeft: 4, bottomRight: 4 }, barPercentage: 0.65, minBarLength: 5, stack: "beban" },
      { label: `WBP ${barUnit}`, data: barWbpValues, backgroundColor: "rgba(239,68,68,.85)", borderColor: "rgba(220,38,38,1)", borderWidth: 1, borderRadius: { topLeft: 4, topRight: 4, bottomLeft: 0, bottomRight: 0 }, barPercentage: 0.65, minBarLength: 5, stack: "beban" }
    ]
  }), [barLabels, barUnit, barLwbpValues, barWbpValues]);

  const stackedBarOptions: any = useMemo(() => ({
    responsive: true,
    maintainAspectRatio: false,
    animation: {
      duration: 350,
      easing: "easeOutQuart"
    },
    transitions: {
      active: {
        animation: {
          duration: 180,
          easing: "easeOutQuad"
        }
      }
    },
    interaction: {
      mode: "index",
      intersect: false
    },
    plugins: {
      legend: { display: true, position: "top", align: "end", labels: { color: isDark ? "rgba(148,163,184,.9)" : "rgba(71,85,105,.9)", font: { size: 10, weight: "600" as const }, usePointStyle: true, pointStyle: "rectRounded", padding: 12 } },
      tooltip: {
        animation: {
          duration: 180,
          easing: "easeOutQuad"
        },
        mode: "index",
        intersect: false,
        backgroundColor: isDark ? "rgba(15, 23, 42, 0.98)" : "rgba(255, 255, 255, 1)",
        titleColor: isDark ? "#ffffff" : "#000000",
        bodyColor: isDark ? "#f8fafc" : "#0f172a",
        borderColor: isDark ? "rgba(255, 255, 255, 0.3)" : "rgba(15, 23, 42, 0.15)",
        borderWidth: 2,
        padding: 12,
        titleFont: { family: "IBM Plex Mono, monospace", size: 12, weight: "bold" as const },
        bodyFont: { family: "IBM Plex Mono, monospace", size: 11, weight: "bold" as const },
        footerColor: isDark ? "#fbbf24" : "#b45309",
        footerFont: { family: "IBM Plex Mono, monospace", size: 11, weight: "bold" as const },
        callbacks: {
          label: (ctx: any) => {
            const val = ctx.parsed.y;
            return `${ctx.dataset.label}: ${val.toLocaleString("id-ID", { maximumFractionDigits: 2 })}`;
          },
          footer: (tooltipItems: any[]) => {
            if (!tooltipItems || tooltipItems.length === 0) return "";
            const dataIndex = tooltipItems[0].dataIndex;
            const wbp = barWbpValues[dataIndex] || 0;
            const lwbp = barLwbpValues[dataIndex] || 0;
            const total = wbp + lwbp;
            const multiplier = barUnit === "MWh" ? 1000 : 1;
            const cost = (wbp * multiplier * wbpRate) + (lwbp * multiplier * lwbpRate);
            return [
              `Total: ${total.toLocaleString("id-ID", { maximumFractionDigits: 2 })} ${barUnit}`,
              `Estimasi Biaya: Rp ${cost.toLocaleString("id-ID", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`
            ];
          }
        }
      }
    },
    scales: {
      x: { stacked: true, grid: { display: false }, ticks: { color: isDark ? "rgba(148,163,184,.8)" : "rgba(71,85,105,.8)", font: { size: 10 }, maxRotation: 0, autoSkip: true, maxTicksLimit: 12 } },
      y: { stacked: true, grid: { color: isDark ? "rgba(51,65,85,.4)" : "rgba(203,213,225,.6)" }, ticks: { color: isDark ? "rgba(148,163,184,.8)" : "rgba(71,85,105,.8)", callback: (v: number) => `${v}` } }
    }
  }), [isDark, barWbpValues, barLwbpValues, barUnit, wbpRate, lwbpRate]);

  /* ═══ SOLAR STACKED BAR ═══ */
  const solarBarLabels = useMemo(() => {
    if (solarRange === "hour" || (solarRange === "custom" && solarStartDate === solarEndDate)) {
      return Array.from({ length: 24 }, (_, i) => `${(i + 1).toString().padStart(2, "0")}:00`);
    } else if (solarRange === "day") {
      const targetMonthStr = `${solarSelectedYear}-${String(solarSelectedMonth + 1).padStart(2, "0")}`;
      const monthDaily = (solarData?.charts?.daily || []).filter((d: any) => d.day && d.day.startsWith(targetMonthStr));
      if (monthDaily.length > 0) {
        return monthDaily.map((d: any) => d.day.split("-")[2]);
      }
      const daysCount = new Date(solarSelectedYear, solarSelectedMonth + 1, 0).getDate();
      return Array.from({ length: daysCount }, (_, i) => String(i + 1).padStart(2, "0"));
    } else if (solarRange === "custom") {
      const customDaily = solarData?.charts?.daily || [];
      if (customDaily.length > 0) {
        return customDaily.map((d: any) => {
          const p = d.day.split("-");
          return `${p[2]}/${p[1]}`;
        });
      }
      return [solarStartDate, solarEndDate];
    } else {
      const monthly = solarData?.charts?.monthly || [];
      if (monthly.length > 0) {
        return monthly.map((m: any) => {
          const [yr, mo] = m.month.split("-").map(Number);
          return `${MONTH_SHORT_ID[mo - 1]} ${yr}`;
        });
      }
      return MONTH_SHORT_ID.map((name) => `${name} ${solarSelectedYear}`);
    }
  }, [solarRange, solarStartDate, solarEndDate, solarSelectedYear, solarSelectedMonth, solarData]);

  const solarPoi1Values = useMemo(() => {
    if (solarRange === "hour" || (solarRange === "custom" && solarStartDate === solarEndDate)) {
      return solarData?.charts?.hourlyPoi1 || Array(24).fill(0);
    } else if (solarRange === "day") {
      const targetMonthStr = `${solarSelectedYear}-${String(solarSelectedMonth + 1).padStart(2, "0")}`;
      return (solarData?.charts?.daily || [])
        .filter((d: any) => d.day && d.day.startsWith(targetMonthStr))
        .map((d: any) => d.poi1 || 0);
    } else if (solarRange === "custom") {
      return (solarData?.charts?.daily || []).map((d: any) => d.poi1 || 0);
    } else {
      return (solarData?.charts?.monthly || []).map((m: any) => m.poi1 || 0);
    }
  }, [solarRange, solarStartDate, solarEndDate, solarSelectedYear, solarSelectedMonth, solarData]);

  const solarPoi2Values = useMemo(() => {
    if (solarRange === "hour" || (solarRange === "custom" && solarStartDate === solarEndDate)) {
      return solarData?.charts?.hourlyPoi2 || Array(24).fill(0);
    } else if (solarRange === "day") {
      const targetMonthStr = `${solarSelectedYear}-${String(solarSelectedMonth + 1).padStart(2, "0")}`;
      return (solarData?.charts?.daily || [])
        .filter((d: any) => d.day && d.day.startsWith(targetMonthStr))
        .map((d: any) => d.poi2 || 0);
    } else if (solarRange === "custom") {
      return (solarData?.charts?.daily || []).map((d: any) => d.poi2 || 0);
    } else {
      return (solarData?.charts?.monthly || []).map((m: any) => m.poi2 || 0);
    }
  }, [solarRange, solarStartDate, solarEndDate, solarSelectedYear, solarSelectedMonth, solarData]);

  const solarBarData = useMemo(() => {
    const datasets: any[] = [];
    if (solarShowPoi1) {
      datasets.push({
        label: "POI-1 (kWh)",
        data: solarPoi1Values,
        backgroundColor: "rgba(59, 130, 246, 0.85)",
        borderColor: "rgba(37, 99, 235, 1)",
        borderWidth: 1,
        borderRadius: solarShowPoi2 ? { topLeft: 0, topRight: 0, bottomLeft: 4, bottomRight: 4 } : 4,
        barPercentage: 0.65,
        minBarLength: 6,
        stack: "solar"
      });
    }
    if (solarShowPoi2) {
      datasets.push({
        label: "POI-2 (kWh)",
        data: solarPoi2Values,
        backgroundColor: "rgba(6, 182, 212, 0.85)",
        borderColor: "rgba(8, 145, 178, 1)",
        borderWidth: 1,
        borderRadius: solarShowPoi1 ? { topLeft: 4, topRight: 4, bottomLeft: 0, bottomRight: 0 } : 4,
        barPercentage: 0.65,
        minBarLength: 6,
        stack: "solar"
      });
    }
    return {
      labels: solarBarLabels,
      datasets
    };
  }, [solarBarLabels, solarPoi1Values, solarPoi2Values, solarShowPoi1, solarShowPoi2]);

  const solarBarOptions: any = useMemo(() => ({
    responsive: true,
    maintainAspectRatio: false,
    animation: {
      duration: 350,
      easing: "easeOutQuart"
    },
    transitions: {
      active: {
        animation: {
          duration: 180,
          easing: "easeOutQuad"
        }
      }
    },
    interaction: {
      mode: "index",
      intersect: false
    },
    plugins: {
      legend: {
        display: true,
        position: "top",
        align: "end",
        labels: {
          color: isDark ? "rgba(148,163,184,.9)" : "rgba(71,85,105,.9)",
          font: { size: 10, weight: "600" as const },
          usePointStyle: true,
          pointStyle: "rectRounded",
          padding: 12
        }
      },
      tooltip: {
        animation: {
          duration: 180,
          easing: "easeOutQuad"
        },
        mode: "index",
        intersect: false,
        backgroundColor: isDark ? "rgba(15, 23, 42, 0.98)" : "rgba(255, 255, 255, 1)",
        titleColor: isDark ? "#ffffff" : "#000000",
        bodyColor: isDark ? "#f8fafc" : "#0f172a",
        borderColor: isDark ? "rgba(51, 65, 85, 0.8)" : "rgba(226, 232, 240, 1)",
        borderWidth: 1,
        padding: 12,
        boxPadding: 4,
        callbacks: {
          afterBody: (tooltipItems: any[]) => {
            if (!tooltipItems.length) return [];
            const idx = tooltipItems[0].dataIndex;
            const p1 = solarShowPoi1 ? (solarPoi1Values[idx] || 0) : 0;
            const p2 = solarShowPoi2 ? (solarPoi2Values[idx] || 0) : 0;
            const tot = p1 + p2;
            const savings = tot * lwbpRate;
            return [
              `Total: ${tot.toLocaleString("id-ID", { maximumFractionDigits: 2 })} kWh`,
              `Penghematan: Rp ${savings.toLocaleString("id-ID", { maximumFractionDigits: 0 })}`
            ];
          }
        }
      }
    },
    scales: {
      x: {
        stacked: true,
        grid: { display: false },
        ticks: { color: isDark ? "rgba(148,163,184,.8)" : "rgba(71,85,105,.8)", font: { size: 10 }, maxRotation: 0, autoSkip: true, maxTicksLimit: 12 }
      },
      y: {
        stacked: true,
        grid: { color: isDark ? "rgba(51,65,85,.4)" : "rgba(203,213,225,.6)" },
        ticks: { color: isDark ? "rgba(148,163,184,.8)" : "rgba(71,85,105,.8)", callback: (v: number) => `${v}` }
      }
    }
  }), [isDark, solarPoi1Values, solarPoi2Values, solarShowPoi1, solarShowPoi2, lwbpRate]);

  /* ═══ COMBINED FACT TIMELINE CHART & DONUT STATE ═══ */
  const fact1Total = useMemo(() => {
    return factCategories1.filter(c => c.enabled).reduce((sum, c) => sum + (c.value?.kWh ?? 0), 0);
  }, [factCategories1]);

  const fact2Total = useMemo(() => {
    return factCategories2.filter(c => c.enabled).reduce((sum, c) => sum + (c.value?.kWh ?? 0), 0);
  }, [factCategories2]);

  const factTimelineData = useMemo(() => {
    const labels = barLabels;
    if (fact1Total === 0 && fact2Total === 0) {
      return { labels, datasets: [] };
    }
    const len = labels.length;
    const f1Data = Array.from({ length: len }, () => 0);
    const f2Data = Array.from({ length: len }, () => 0);

    return {
      labels,
      datasets: [
        {
          label: "Fact-1 (Utility & Production) (kWh)",
          data: f1Data,
          backgroundColor: "rgba(59, 130, 246, 0.8)",
          borderColor: "#3b82f6",
          borderWidth: 1,
          borderRadius: 4
        },
        {
          label: "Fact-2 (Utility & HVAC) (kWh)",
          data: f2Data,
          backgroundColor: "rgba(6, 182, 212, 0.8)",
          borderColor: "#06b6d4",
          borderWidth: 1,
          borderRadius: 4
        }
      ]
    };
  }, [barLabels, fact1Total, fact2Total]);

  const factDonutSegments = useMemo(() => {
    const total = fact1Total + fact2Total;
    if (total === 0) return [];
    return [
      { label: "Fact-1 (Utility & Prod)", value: Math.round((fact1Total / total) * 100), color: "#3b82f6" },
      { label: "Fact-2 (Utility & HVAC)", value: Math.round((fact2Total / total) * 100), color: "#06b6d4" }
    ];
  }, [fact1Total, fact2Total]);

  const factBarOptions = {
    responsive: true, maintainAspectRatio: false,
    plugins: {
      legend: { display: true, position: "top" as const, labels: { color: isDark ? "#94a3b8" : "#475569", font: { size: 9, weight: "bold" as const } } }
    },
    scales: {
      x: { grid: { display: false }, ticks: { color: "#64748b", font: { size: 8 } } },
      y: { grid: { color: isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.04)" }, ticks: { color: "#64748b", font: { size: 8 } } }
    }
  };

  /* ═══ HORIZONTAL BAR FOR CONSUMPTION FACT ═══ */
  const makeHorizontalBarData = (categories: ConsumptionFactCategory[], fallbackSide: 1 | 2 = 1) => {
    const list = categories.length > 0 ? categories : (fallbackSide === 1 ? defaultFact1Categories : defaultFact2Categories);
    const sortedEnabled = [...list]
      .filter(c => c.enabled)
      .sort((a, b) => (b.value?.kWh ?? 0) - (a.value?.kWh ?? 0));
    return {
      labels: sortedEnabled.map(c => c.label),
      datasets: [{
        label: "kWh",
        data: sortedEnabled.map(c => c.value?.kWh ?? 0),
        backgroundColor: fallbackSide === 1 ? "rgba(31, 111, 181, 0.85)" : "rgba(6, 182, 212, 0.85)",
        borderWidth: 0,
        borderRadius: 4,
        barPercentage: 0.55
      }]
    };
  };

  const makeDeptHorizontalBarData = (items: any[], dept: "Utility" | "HVAC") => {
    const sorted = [...items].sort((a, b) => (b.value?.kWh ?? 0) - (a.value?.kWh ?? 0));
    return {
      labels: sorted.map(c => c.label),
      datasets: [{
        label: "kWh",
        data: sorted.map(c => c.value?.kWh ?? 0),
        backgroundColor: dept === "Utility" ? "rgba(31, 111, 181, 0.8)" : "rgba(6, 182, 212, 0.8)",
        borderWidth: 0,
        borderRadius: 4,
        barPercentage: 0.55
      }]
    };
  };

  const horizontalBarOptions: any = useMemo(() => ({
    indexAxis: "y",
    responsive: true,
    maintainAspectRatio: false,
    animation: {
      duration: 350,
      easing: "easeOutQuart"
    },
    transitions: {
      active: {
        animation: {
          duration: 180,
          easing: "easeOutQuad"
        }
      }
    },
    interaction: {
      mode: "nearest",
      axis: "y",
      intersect: false
    },
    plugins: {
      legend: { display: false },
      tooltip: {
        animation: {
          duration: 180,
          easing: "easeOutQuad"
        },
        callbacks: { label: (ctx: any) => `${Number(ctx.parsed.x).toLocaleString("id-ID")} kWh` }
      }
    },
    scales: {
      x: { grid: { color: isDark ? "rgba(51,65,85,.4)" : "rgba(203,213,225,.5)" }, ticks: { color: isDark ? "rgba(148,163,184,.7)" : "rgba(71,85,105,.7)", font: { size: 10 } } },
      y: { grid: { display: false }, ticks: { color: isDark ? "rgba(148,163,184,.8)" : "rgba(71,85,105,.8)", font: { size: 10 }, autoSkip: false } }
    }
  }), [isDark]);

  /* ═══ EQUIPMENT SERIES (EMPTY STATE - SENSOR BELUM TERHUBUNG) ═══ */
  const EMPTY_EQUIPMENT_SERIES = useMemo(() => ({ current: [] as number[], previous: [] as number[] }), []);
  const ct1Series = EMPTY_EQUIPMENT_SERIES;
  const ct2Series = EMPTY_EQUIPMENT_SERIES;
  const boiler3Series = EMPTY_EQUIPMENT_SERIES;
  const boiler4Series = EMPTY_EQUIPMENT_SERIES;
  const boiler5Series = EMPTY_EQUIPMENT_SERIES;
  const compAle30Series = EMPTY_EQUIPMENT_SERIES;
  const compZt301Series = EMPTY_EQUIPMENT_SERIES;
  const compZt302Series = EMPTY_EQUIPMENT_SERIES;
  const compZt55Series = EMPTY_EQUIPMENT_SERIES;
  const compAle250Series = EMPTY_EQUIPMENT_SERIES;
  const compZt110Series = EMPTY_EQUIPMENT_SERIES;
  const chillerDaikin1Series = EMPTY_EQUIPMENT_SERIES;
  const chillerDaikin2Series = EMPTY_EQUIPMENT_SERIES;
  const chillerTraneCgam40Series = EMPTY_EQUIPMENT_SERIES;
  const chillerTrane100Series = EMPTY_EQUIPMENT_SERIES;
  const chillerTrane275Series = EMPTY_EQUIPMENT_SERIES;
  const chillerTrane250Series = EMPTY_EQUIPMENT_SERIES;
  const chillerTrane185Series = EMPTY_EQUIPMENT_SERIES;
  const hvacWh2Series = EMPTY_EQUIPMENT_SERIES;
  const hvacWh3Series = EMPTY_EQUIPMENT_SERIES;
  const hvacWh4Series = EMPTY_EQUIPMENT_SERIES;
  const hvacWh5Series = EMPTY_EQUIPMENT_SERIES;
  const hvacWh6Series = EMPTY_EQUIPMENT_SERIES;
  const hvacWh7Series = EMPTY_EQUIPMENT_SERIES;
  const hvacQcMicroSeries = EMPTY_EQUIPMENT_SERIES;
  const hvacQcRetainedSeries = EMPTY_EQUIPMENT_SERIES;
  const hvacQcSamplingSeries = EMPTY_EQUIPMENT_SERIES;
  const hvacWf1U3Series = EMPTY_EQUIPMENT_SERIES;
  const hvacWf2U1Series = EMPTY_EQUIPMENT_SERIES;
  const hvacWf2U2Series = EMPTY_EQUIPMENT_SERIES;

  /* ═══ RENDER ═══ */
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <PageHeader title="Listrik — Overview" description="Monitor beban listrik utama, solar panel, genset, dan total plant load." />
        <button
          onClick={() => setShowConfigPanel(!showConfigPanel)}
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-xs font-bold text-slate-600 dark:text-slate-300 transition border border-slate-200 dark:border-slate-700"
        >
          <IconSettings />
          Konfigurasi
        </button>
      </div>

      {/* ═══════════ SECTION A: TOP 4 SUMMARY CARDS ═══════════ */}
      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {/* Grid Import (PLN) */}
        <div className="relative overflow-hidden rounded-2xl border p-5 shadow-sm transition hover:shadow-md"
             style={{
               background: isDark 
                 ? 'linear-gradient(135deg, #1e3a8a, #1e40af)' 
                 : 'linear-gradient(135deg, #f0f9ff, #e0f2fe)',
               borderColor: isDark ? '#1e293b' : '#bae6fd'
             }}>
          <Sparkline color={isDark ? "#93c5fd" : "#3b82f6"} />
          <div className="relative z-10">
            <div className="flex items-center justify-between mb-3">
              <span className={`text-[10px] font-bold uppercase tracking-widest ${isDark ? 'text-blue-200' : 'text-blue-800'}`}>Grid Import (PLN)</span>
              <div className={`h-8 w-8 rounded-lg ${isDark ? 'bg-white/10 text-white' : 'bg-blue-600/10 text-blue-700'} flex items-center justify-center`}><IconGrid /></div>
            </div>
            <div className={`text-3xl font-extrabold font-mono ${isDark ? 'text-white' : 'text-blue-950'}`}>
              {renderMetricVal(getApiVal("pln/active_power"), (v) => `${v.toLocaleString("id-ID", { maximumFractionDigits: 1 })}`)}
              <span className={`text-sm font-bold ml-1 ${isDark ? 'text-blue-200' : 'text-blue-700'}`}>kW</span>
            </div>
            <div className={`mt-2 flex items-center gap-3 text-[10px] ${isDark ? 'text-blue-200' : 'text-blue-800'}`}>
              <span>Voltage: <strong className={isDark ? 'text-white' : 'text-blue-950'}>{renderMetricVal(getApiVal("pln/voltage"), (v) => `${v.toFixed(2)} kV`)}</strong></span>
              <span>Freq: <strong className={isDark ? 'text-white' : 'text-blue-950'}>{renderMetricVal(getApiVal("pln/frequency"), (v) => `${v.toFixed(2)} Hz`)}</strong></span>
            </div>
          </div>
        </div>

        {/* Solar Generation */}
        <div className="relative overflow-hidden rounded-2xl border p-5 shadow-sm transition hover:shadow-md"
             style={{
               background: isDark 
                 ? 'linear-gradient(135deg, #064e3b, #047857)' 
                 : 'linear-gradient(135deg, #f0fdf4, #d1fae5)',
               borderColor: isDark ? '#1e293b' : '#a7f3d0'
             }}>
          <Sparkline color={isDark ? "#6ee7b7" : "#10b981"} />
          <div className="relative z-10">
            <div className="flex items-center justify-between mb-3">
              <span className={`text-[10px] font-bold uppercase tracking-widest ${isDark ? 'text-emerald-200' : 'text-emerald-800'}`}>Solar Generation</span>
              <div className={`h-8 w-8 rounded-lg ${isDark ? 'bg-white/10 text-white' : 'bg-emerald-600/10 text-emerald-700'} flex items-center justify-center`}><IconSolar /></div>
            </div>
            <div className={`text-3xl font-extrabold font-mono ${isDark ? 'text-white' : 'text-emerald-950'}`}>
              - <span className={`text-sm font-bold ml-1 ${isDark ? 'text-emerald-200' : 'text-emerald-700'}`}>kW</span>
            </div>
            <div className={`mt-2 flex items-center gap-3 text-[10px] ${isDark ? 'text-emerald-200' : 'text-emerald-800'}`}>
              <span>POI-1: <strong className={isDark ? 'text-white' : 'text-emerald-950'}>
                {solarLive?.poi1?.status === false ? "TIDAK AKTIF" : `${formatNumber(solarLive?.poi1?.totalKwh ?? solarData?.summary?.poi1TotalKwh ?? 0)} kWh`}
              </strong></span>
              <span>POI-2: <strong className={isDark ? 'text-white' : 'text-emerald-950'}>
                {solarLive?.poi2?.status === false ? "TIDAK AKTIF" : `${formatNumber(solarLive?.poi2?.totalKwh ?? solarData?.summary?.poi2TotalKwh ?? 0)} kWh`}
              </strong></span>
            </div>
          </div>
        </div>

        {/* Genset Backup */}
        <div className="relative overflow-hidden rounded-2xl border p-4 shadow-sm transition hover:shadow-md"
             style={{
               background: isDark 
                 ? 'linear-gradient(135deg, #78350f, #b45309)' 
                 : 'linear-gradient(135deg, #fffbeb, #fef3c7)',
               borderColor: isDark ? '#1e293b' : '#fde68a'
             }}>
          <div className="relative z-10 flex flex-col h-full justify-between">
            <div className="flex items-center justify-between mb-2">
              <span className={`text-[10px] font-bold uppercase tracking-widest ${isDark ? 'text-amber-200' : 'text-amber-800'}`}>Genset Backup</span>
              <div className={`h-6 w-6 rounded-lg ${isDark ? 'bg-white/10 text-white' : 'bg-amber-600/10 text-amber-700'} flex items-center justify-center`}><IconGenset /></div>
            </div>
            
            {/* 2 Inner Sub-Cards */}
            <div className="grid grid-cols-2 gap-2 mt-1">
              {/* Caterpillar */}
              <div className={`p-2 rounded-xl border transition duration-300 ${
                isDark ? 'bg-black/35 border-amber-500/20' : 'bg-white/80 border-amber-200/60'
              } flex flex-col justify-between`}>
                <div className="flex items-center justify-between">
                  <span className="text-[8px] font-extrabold uppercase text-slate-400">Caterpillar</span>
                  <span className={`h-1.5 w-1.5 rounded-full ${Number(getApiVal("electricity/genset_running")) > 0 ? "bg-emerald-500 animate-pulse" : "bg-slate-400"}`} />
                </div>
                <div className="mt-1">
                  <div className={`text-sm font-extrabold font-mono ${isDark ? 'text-white' : 'text-amber-950'}`}>
                    {Number(getApiVal("electricity/genset_running")) > 0 ? "850" : "0"} <span className="text-[8px] font-bold text-slate-400">kW</span>
                  </div>
                  <span className={`text-[8px] font-extrabold ${Number(getApiVal("electricity/genset_running")) > 0 ? "text-emerald-500" : "text-slate-400"}`}>
                    {Number(getApiVal("electricity/genset_running")) > 0 ? "ON (Gas)" : "OFF"}
                  </span>
                </div>
              </div>

              {/* Perkins */}
              <div className={`p-2 rounded-xl border transition duration-300 ${
                isDark ? 'bg-black/35 border-amber-500/20' : 'bg-white/80 border-amber-200/60'
              } flex flex-col justify-between`}>
                <div className="flex items-center justify-between">
                  <span className="text-[8px] font-extrabold uppercase text-slate-400">Perkins</span>
                  <span className={`h-1.5 w-1.5 rounded-full ${Number(getApiVal("electricity/genset_running")) > 1 ? "bg-emerald-500 animate-pulse" : "bg-slate-400"}`} />
                </div>
                <div className="mt-1">
                  <div className={`text-sm font-extrabold font-mono ${isDark ? 'text-white' : 'text-amber-950'}`}>
                    {Number(getApiVal("electricity/genset_running")) > 1 ? "1000" : "0"} <span className="text-[8px] font-bold text-slate-400">kW</span>
                  </div>
                  <span className={`text-[8px] font-extrabold ${Number(getApiVal("electricity/genset_running")) > 1 ? "text-emerald-500" : "text-slate-400"}`}>
                    {Number(getApiVal("electricity/genset_running")) > 1 ? "ON (Diesel)" : "OFF"}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Total Plant Load */}
        <div className="relative overflow-hidden rounded-2xl border p-5 shadow-sm transition hover:shadow-md"
             style={{
               background: isDark 
                 ? 'linear-gradient(135deg, #164e63, #0e7490)' 
                 : 'linear-gradient(135deg, #ecfeff, #cffafe)',
               borderColor: isDark ? '#1e293b' : '#a5f3fc'
             }}>
          <Sparkline color={isDark ? "#67e8f9" : "#06b6d4"} />
          <div className="relative z-10">
            <div className="flex items-center justify-between mb-3">
              <span className={`text-[10px] font-bold uppercase tracking-widest ${isDark ? 'text-cyan-200' : 'text-cyan-800'}`}>Total Plant Load</span>
              <div className={`h-8 w-8 rounded-lg ${isDark ? 'bg-white/10 text-white' : 'bg-cyan-600/10 text-cyan-700'} flex items-center justify-center`}><IconPlant /></div>
            </div>
            <div className={`text-3xl font-extrabold font-mono ${isDark ? 'text-white' : 'text-cyan-950'}`}>
              {(() => {
                const pGridVal = getApiVal("pln/active_power");
                const pGridNum = typeof pGridVal === "number" ? pGridVal : (summaryData?.pqData?.activePower || 0);
                return pGridNum.toLocaleString("id-ID", { maximumFractionDigits: 1 });
              })()}
              <span className={`text-sm font-bold ml-1 ${isDark ? 'text-cyan-200' : 'text-cyan-700'}`}>kW</span>
            </div>
            <div className={`mt-2 flex items-center gap-3 text-[10px] ${isDark ? 'text-cyan-200' : 'text-cyan-800'}`}>
              <span>P Grid: <strong className={isDark ? 'text-white' : 'text-cyan-950'}>{renderMetricVal(getApiVal("pln/active_power"), (v) => `${v.toLocaleString("id-ID", { maximumFractionDigits: 2 })} kW`)}</strong></span>
              <span>P Solar: <strong className={isDark ? 'text-white' : 'text-cyan-950'}>- kW</strong></span>
            </div>
          </div>
        </div>
      </section>

      {/* ═══════════ SECTION B: PLN DETAIL ═══════════ */}
      <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-sm">
        <div className="flex items-center gap-2 mb-4">
          <div className="h-2 w-2 rounded-full bg-blue-500 animate-pulse" />
          <h3 className="text-xs font-bold uppercase tracking-[0.2em] text-blue-500">PLN — Incoming Grid</h3>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          {/* Estimasi Biaya */}
          <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 dark:bg-emerald-950/30 p-4 hover:border-emerald-400 transition">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">Estimasi Biaya</span>
              <div className="h-6 w-6 rounded bg-emerald-500/10 flex items-center justify-center text-emerald-500"><IconMoney /></div>
            </div>
            <div className="mt-2 text-lg font-extrabold text-slate-800 dark:text-white font-mono leading-tight">
              {summaryLoading && !summaryData ? "..." : formatCurrency(cardSummary.totalCost)}
            </div>
            <div className="mt-1 text-[10px] font-semibold text-emerald-600 dark:text-emerald-400">
              {summaryLoading && !summaryData ? "" : `${cardSummary.totalKwh.toLocaleString("id-ID", { maximumFractionDigits: 0 })} kWh`}
            </div>
          </div>

          {/* Beban LWBP */}
          <div className="rounded-xl border border-blue-500/20 bg-blue-500/5 dark:bg-blue-950/30 p-4 hover:border-blue-400 transition">
            <span className="text-[10px] font-bold uppercase tracking-wider text-blue-500 px-2 py-0.5 rounded bg-blue-500/10 border border-blue-500/20">Beban LWBP</span>
            <div className="mt-2 text-lg font-extrabold text-slate-800 dark:text-white font-mono">
              {summaryLoading && !summaryData ? "..." : `${cardSummary.lwbpKwh.toLocaleString("id-ID", { maximumFractionDigits: 0 })} kWh`}
            </div>
            <div className="mt-1 text-[10px] font-semibold text-blue-500">{summaryLoading && !summaryData ? "" : formatCurrency(cardSummary.lwbpCost)}</div>
          </div>

          {/* Beban WBP */}
          <div className="rounded-xl border border-rose-500/20 bg-rose-500/5 dark:bg-rose-950/30 p-4 hover:border-rose-400 transition">
            <span className="text-[10px] font-bold uppercase tracking-wider text-rose-500 px-2 py-0.5 rounded bg-rose-500/10 border border-rose-500/20">Beban WBP</span>
            <div className="mt-2 text-lg font-extrabold text-slate-800 dark:text-white font-mono">
              {summaryLoading && !summaryData ? "..." : `${cardSummary.wbpKwh.toLocaleString("id-ID", { maximumFractionDigits: 0 })} kWh`}
            </div>
            <div className="mt-1 text-[10px] font-semibold text-rose-500">{summaryLoading && !summaryData ? "" : formatCurrency(cardSummary.wbpCost)}</div>
          </div>

          {/* PF / Power Factor */}
          <div className="rounded-xl border border-purple-500/20 bg-purple-500/5 dark:bg-purple-950/30 p-4 hover:border-purple-400 transition">
            <span className="text-[10px] font-bold uppercase tracking-wider text-purple-500 px-2 py-0.5 rounded bg-purple-500/10 border border-purple-500/20">PF</span>
            <div className="mt-2 text-lg font-extrabold text-slate-800 dark:text-white font-mono leading-tight">
              {renderMetricVal(getApiVal("pln/power_factor"), (v) => `${Math.abs(v).toFixed(2)}`)}
            </div>
            <div className="mt-1 text-[10px] text-slate-400">Stabilitas beban listrik</div>
          </div>

          {/* Peak Demand */}
          <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 dark:bg-amber-950/30 p-4 hover:border-amber-400 transition">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">Peak Demand</span>
            <div className="mt-2 text-lg font-extrabold text-slate-800 dark:text-white font-mono">
              - kW
            </div>
            <div className="mt-1 text-[10px] text-slate-400">Estimasi beban puncak</div>
          </div>
        </div>

        {/* Real-time Power Meter Widget */}
        <div className="mt-5 border-t border-slate-100 dark:border-slate-800/80 pt-5">
          <div className="flex items-center gap-2 mb-4">
            <span className="text-blue-500 font-bold">🔌</span>
            <h4 className="text-xs font-extrabold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              PLN Power Meter Cubicle (PM8000) — Real-time Readings
            </h4>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {/* Voltage Phase-Neutral */}
            <div className="p-4 bg-slate-50/50 dark:bg-slate-950/30 rounded-xl border border-slate-100 dark:border-slate-800/60 shadow-inner">
              <div className="flex justify-between items-baseline mb-2">
                <span className="text-[10px] font-extrabold uppercase text-[#47729f] dark:text-slate-500">Voltage L-N</span>
                <span className="text-[9px] font-bold text-slate-400">Nominal 12kV</span>
              </div>
              <div className="space-y-1.5 font-semibold text-xs text-slate-700 dark:text-slate-300">
                <div className="flex justify-between items-center">
                  <span>Phase R-N</span>
                  <span className="font-mono">{renderMetricVal(getApiVal("pln/voltage_rn"), (v) => `${(v > 1000 ? (v / Math.sqrt(3)) / 1000 : v).toFixed(2)} kV`)}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span>Phase S-N</span>
                  <span className="font-mono">{renderMetricVal(getApiVal("pln/voltage_sn"), (v) => `${(v > 1000 ? (v / Math.sqrt(3)) / 1000 : v).toFixed(2)} kV`)}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span>Phase T-N</span>
                  <span className="font-mono">{renderMetricVal(getApiVal("pln/voltage_tn"), (v) => `${(v > 1000 ? (v / Math.sqrt(3)) / 1000 : v).toFixed(2)} kV`)}</span>
                </div>
              </div>
            </div>

            {/* Current Phase */}
            <div className="p-4 bg-slate-50/50 dark:bg-slate-950/30 rounded-xl border border-slate-100 dark:border-slate-800/60 shadow-inner">
              <div className="flex justify-between items-baseline mb-2">
                <span className="text-[10px] font-extrabold uppercase text-[#47729f] dark:text-slate-500">Current Phase</span>
                <span className="text-[9px] font-bold text-slate-400">Rating 165A</span>
              </div>
              <div className="space-y-1.5 font-semibold text-xs text-slate-700 dark:text-slate-300">
                <div className="flex justify-between items-center">
                  <span>Phase R</span>
                  <span className="font-mono">{renderMetricVal(getApiVal("pln/current_r"), (v) => `${Number(v).toFixed(1)} A`)}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span>Phase S</span>
                  <span className="font-mono">{renderMetricVal(getApiVal("pln/current_s"), (v) => `${Number(v).toFixed(1)} A`)}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span>Phase T</span>
                  <span className="font-mono">{renderMetricVal(getApiVal("pln/current_t"), (v) => `${Number(v).toFixed(1)} A`)}</span>
                </div>
              </div>
            </div>

            {/* Power Summary */}
            <div className="p-4 bg-slate-50/50 dark:bg-slate-950/30 rounded-xl border border-slate-100 dark:border-slate-800/60 shadow-inner">
              <div className="flex justify-between items-baseline mb-2">
                <span className="text-[10px] font-extrabold uppercase text-[#47729f] dark:text-slate-500">Power Parameters</span>
                <span className="text-[9px] font-bold text-slate-400">Total Load</span>
              </div>
              <div className="space-y-1.5 font-semibold text-xs text-slate-700 dark:text-slate-300">
                <div className="flex justify-between items-center">
                  <span>Active Power</span>
                  <span className="font-mono text-emerald-500 font-extrabold">{renderMetricVal(getApiVal("pln/active_power"), (v) => `${(v > 10000 ? v / 1000 : v).toLocaleString("id-ID", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} kW`)}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span>Reactive Power</span>
                  <span className="font-mono">{renderMetricVal(getApiVal("pln/reactive_power"), (v) => `${(v > 10000 ? v / 1000 : v).toLocaleString("id-ID", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} kVAR`)}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span>Apparent Power</span>
                  <span className="font-mono">{renderMetricVal(getApiVal("pln/apparent_power"), (v) => `${(v > 10000 ? v / 1000 : v).toLocaleString("id-ID", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} kVA`)}</span>
                </div>
              </div>
            </div>

            {/* Power Quality */}
            <div className="p-4 bg-slate-50/50 dark:bg-slate-950/30 rounded-xl border border-slate-100 dark:border-slate-800/60 shadow-inner">
              <div className="flex justify-between items-baseline mb-2">
                <span className="text-[10px] font-extrabold uppercase text-[#47729f] dark:text-slate-500">Power Quality</span>
                <span className="text-[9px] font-bold text-slate-400">Grid Status</span>
              </div>
              <div className="space-y-1.5 font-semibold text-xs text-slate-700 dark:text-slate-300">
                <div className="flex justify-between items-center">
                  <span>Frequency</span>
                  <span className="font-mono">{renderMetricVal(getApiVal("pln/frequency"), (v) => `${Number(v).toFixed(2)} Hz`)}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span>V Unbalanced</span>
                  <span className="font-mono">{renderMetricVal(getApiVal("pln/unbalance_v"), (v) => `${(v < 1.0 ? v * 100 : v).toFixed(2)} %`)}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span>I Unbalanced</span>
                  <span className="font-mono">{renderMetricVal(getApiVal("pln/unbalance_i"), (v) => `${(v < 1.0 ? v * 100 : v).toFixed(2)} %`)}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ═══════════ SECTION C: PLN TREND + DONUT ═══════════ */}
      <div className="grid gap-6 lg:grid-cols-[2fr_1fr]">
        <section className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
            <div>
              <h3 className="text-sm font-bold uppercase tracking-[0.2em] text-slate-400 dark:text-slate-500">Trend Panel Distribusi</h3>
              <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">Beban Incoming PLN — data historis (WBP & LWBP).</p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {(range === "ytd" || range === "day" || range === "month") && (
                <select value={selectedYear} onChange={(e) => setSelectedYear(Number(e.target.value))} className="rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 px-3 py-1.5 text-xs font-bold text-slate-600 dark:text-slate-300 focus:outline-none focus:ring-2 focus:ring-cyan-500 cursor-pointer transition">
                  {AVAILABLE_YEARS.map((yr) => <option key={yr} value={yr}>{yr}</option>)}
                </select>
              )}
              {range === "day" && (
                <select value={selectedMonth} onChange={(e) => setSelectedMonth(Number(e.target.value))} className="rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 px-3 py-1.5 text-xs font-bold text-slate-600 dark:text-slate-300 focus:outline-none focus:ring-2 focus:ring-cyan-500 cursor-pointer transition">
                  {MONTH_NAMES_ID.map((name, idx) => <option key={idx} value={idx}>{name}</option>)}
                </select>
              )}
              {range === "custom" && (
                <div className="flex items-center gap-2">
                  <input type="date" value={chartStartDate} onChange={(e) => setChartStartDate(e.target.value)} className="rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 px-3 py-1.5 text-xs font-bold text-slate-600 dark:text-slate-300 focus:outline-none focus:ring-2 focus:ring-cyan-500 cursor-pointer transition" />
                  <span className="text-xs font-bold text-slate-400">s/d</span>
                  <input type="date" value={chartEndDate} onChange={(e) => setChartEndDate(e.target.value)} className="rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 px-3 py-1.5 text-xs font-bold text-slate-600 dark:text-slate-300 focus:outline-none focus:ring-2 focus:ring-cyan-500 cursor-pointer transition" />
                </div>
              )}
              <div className="flex items-center gap-1 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 p-0.5 text-xs">
                {ranges.map((item) => (
                  <button key={item.id} type="button" onClick={() => setRange(item.id)} className={`rounded-md px-3 py-1.5 font-bold transition-all ${range === item.id ? "bg-cyan-500 text-white shadow-sm" : "text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"}`}>
                    {item.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
          <div className="bg-slate-50 dark:bg-slate-950/40 rounded-xl p-4 border border-slate-100 dark:border-slate-800/80">
            <div style={{ height: 256 }}>
              <Bar data={stackedBarData} options={stackedBarOptions} />
            </div>
          </div>
        </section>

        <section className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-sm flex flex-col justify-between">
          <div>
            <h3 className="text-sm font-bold uppercase tracking-[0.2em] text-slate-400 dark:text-slate-500">Distribusi Beban</h3>
            <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">Perbandingan konsumsi WBP vs LWBP.</p>
          </div>
          <div className="my-6 flex justify-center">
            <DonutChart 
              segments={donutSegments} 
              size={150} 
              thickness={18} 
              centerLabel={donutSegments[0]?.value > 0 ? `WBP ${donutSegments[0].value}%` : `LWBP 100%`} 
            />
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

      {/* ═══════════ SECTION D: SOLAR PANEL ═══════════ */}
      <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <div className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
            <h3 className="text-xs font-bold uppercase tracking-[0.2em] text-emerald-500">Solar Panel (PLTS)</h3>
          </div>
          <span className="text-[10px] font-extrabold uppercase px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-500 border border-emerald-500/20">
            ONLINE (POLLING 1s)
          </span>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          {/* Estimasi Biaya */}
          <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 dark:bg-emerald-950/30 p-4">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">Estimasi Penghematan</span>
              <div className="h-6 w-6 rounded bg-emerald-500/10 flex items-center justify-center text-emerald-500"><IconMoney /></div>
            </div>
            <div className="mt-2 text-base font-extrabold text-slate-800 dark:text-white font-mono">
              {formatCurrency(solarData?.summary?.todayCost || ((solarData?.summary?.todayKwh || 0) * lwbpRate) || 0)}
            </div>
            <div className="mt-1 text-[10px] font-semibold text-emerald-600 dark:text-emerald-400">
              {formatNumber(solarData?.summary?.todayKwh || 0)} kWh hari ini
            </div>
          </div>

          {/* POI-1 */}
          <div className={`rounded-xl border p-4 transition-all ${
            solarLive?.poi1?.status === false
              ? "border-rose-500/20 bg-rose-500/5 dark:bg-rose-950/30"
              : "border-blue-500/20 bg-blue-500/5 dark:bg-blue-950/30"
          }`}>
            <div className="flex items-center justify-between">
              <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded border ${
                solarLive?.poi1?.status === false
                  ? "text-rose-500 bg-rose-500/10 border-rose-500/20"
                  : "text-blue-500 bg-blue-500/10 border-blue-500/20"
              }`}>
                {solarLive?.poi1?.status === false ? "POI-1 (TIDAK AKTIF)" : "POI-1"}
              </span>
              <span className={`h-2 w-2 rounded-full ${
                solarLive?.poi1?.status === false
                  ? "bg-rose-500"
                  : "bg-emerald-500 animate-ping"
              }`} />
            </div>
            <div className="mt-2 text-base font-extrabold text-slate-800 dark:text-white font-mono">
              {solarLive?.poi1?.status === false
                ? "TIDAK AKTIF"
                : `${formatNumber(solarLive?.poi1?.totalKwh ?? solarData?.summary?.poi1TotalKwh ?? 0)} kWh`}
            </div>
            <div className="mt-1 text-[10px] font-semibold text-slate-500 dark:text-slate-400">
              {solarLive?.poi1?.status === false
                ? "Status: TIDAK AKTIF"
                : (solarLive?.poi1?.voltAb ? `${solarLive.poi1.voltAb.toFixed(1)} V | ${solarLive.poi1.frequency.toFixed(2)} Hz` : "-")}
            </div>
          </div>

          {/* Peak Demand (POI-1) */}
          <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 dark:bg-amber-950/30 p-4">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Peak Demand (POI-1)</span>
            <div className="mt-2 text-base font-extrabold text-slate-800 dark:text-white font-mono">
              - kW
            </div>
            <div className="mt-1 text-[10px] text-slate-400">Estimasi beban puncak</div>
          </div>

          {/* POI-2 */}
          <div className={`rounded-xl border p-4 transition-all ${
            solarLive?.poi2?.status === false
              ? "border-rose-500/20 bg-rose-500/5 dark:bg-rose-950/30"
              : "border-cyan-500/20 bg-cyan-500/5 dark:bg-cyan-950/30"
          }`}>
            <div className="flex items-center justify-between">
              <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded border ${
                solarLive?.poi2?.status === false
                  ? "text-rose-500 bg-rose-500/10 border-rose-500/20"
                  : "text-cyan-500 bg-cyan-500/10 border-cyan-500/20"
              }`}>
                {solarLive?.poi2?.status === false ? "POI-2 (TIDAK AKTIF)" : "POI-2"}
              </span>
              <span className={`h-2 w-2 rounded-full ${
                solarLive?.poi2?.status === false
                  ? "bg-rose-500"
                  : "bg-emerald-500 animate-ping"
              }`} />
            </div>
            <div className="mt-2 text-base font-extrabold text-slate-800 dark:text-white font-mono">
              {solarLive?.poi2?.status === false
                ? "TIDAK AKTIF"
                : `${formatNumber(solarLive?.poi2?.totalKwh ?? solarData?.summary?.poi2TotalKwh ?? 0)} kWh`}
            </div>
            <div className="mt-1 text-[10px] font-semibold text-slate-500 dark:text-slate-400">
              {solarLive?.poi2?.status === false
                ? "Status: TIDAK AKTIF"
                : (solarLive?.poi2?.voltAb ? `${solarLive.poi2.voltAb.toFixed(1)} V | ${solarLive.poi2.frequency.toFixed(2)} Hz` : "-")}
            </div>
          </div>

          {/* Peak Demand (POI-2) */}
          <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 dark:bg-amber-950/30 p-4">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Peak Demand (POI-2)</span>
            <div className="mt-2 text-base font-extrabold text-slate-800 dark:text-white font-mono">
              - kW
            </div>
            <div className="mt-1 text-[10px] text-slate-400">Estimasi beban puncak</div>
          </div>
        </div>
      </div>

      {/* ═══════════ SECTION E: SOLAR PANEL CHART + DONUT ═══════════ */}
      <div className="grid gap-6 lg:grid-cols-[2fr_1fr]">
        <section className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-sm flex flex-col justify-between">
          <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
            <div>
              <h3 className="text-sm font-bold uppercase tracking-[0.2em] text-[#1f6fb5] dark:text-sky-400">Trend Produksi Solar Panel (PLTS)</h3>
              <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">Produksi energi POI-1 & POI-2 — data historis per jam.</p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {/* Checklist options: POI-1, POI-2 */}
              <div className="flex items-center gap-1.5 bg-slate-50 dark:bg-slate-800/60 p-1 rounded-lg border border-slate-200 dark:border-slate-700 text-xs">
                <label className="flex items-center gap-1.5 px-2 py-1 rounded cursor-pointer select-none font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-200/50 dark:hover:bg-slate-700/50 transition">
                  <input
                    type="checkbox"
                    checked={solarShowPoi1}
                    onChange={(e) => {
                      if (!e.target.checked && !solarShowPoi2) return;
                      setSolarShowPoi1(e.target.checked);
                    }}
                    className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 h-3.5 w-3.5 cursor-pointer accent-blue-600"
                  />
                  <span className="flex items-center gap-1">
                    <span className="h-2 w-2 rounded-full bg-blue-500" />
                    POI-1
                  </span>
                </label>
                <label className="flex items-center gap-1.5 px-2 py-1 rounded cursor-pointer select-none font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-200/50 dark:hover:bg-slate-700/50 transition">
                  <input
                    type="checkbox"
                    checked={solarShowPoi2}
                    onChange={(e) => {
                      if (!e.target.checked && !solarShowPoi1) return;
                      setSolarShowPoi2(e.target.checked);
                    }}
                    className="rounded border-slate-300 text-cyan-600 focus:ring-cyan-500 h-3.5 w-3.5 cursor-pointer accent-cyan-600"
                  />
                  <span className="flex items-center gap-1">
                    <span className="h-2 w-2 rounded-full bg-cyan-500" />
                    POI-2
                  </span>
                </label>
              </div>

              {/* Year / Month / Date Pickers */}
              {(solarRange === "ytd" || solarRange === "day" || solarRange === "month") && (
                <select
                  value={solarSelectedYear}
                  onChange={(e) => setSolarSelectedYear(Number(e.target.value))}
                  className="rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 px-3 py-1.5 text-xs font-bold text-slate-600 dark:text-slate-300 focus:outline-none focus:ring-2 focus:ring-cyan-500 cursor-pointer transition"
                >
                  {AVAILABLE_YEARS.map((yr) => <option key={yr} value={yr}>{yr}</option>)}
                </select>
              )}
              {solarRange === "day" && (
                <select
                  value={solarSelectedMonth}
                  onChange={(e) => setSolarSelectedMonth(Number(e.target.value))}
                  className="rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 px-3 py-1.5 text-xs font-bold text-slate-600 dark:text-slate-300 focus:outline-none focus:ring-2 focus:ring-cyan-500 cursor-pointer transition"
                >
                  {MONTH_NAMES_ID.map((name, idx) => <option key={idx} value={idx}>{name}</option>)}
                </select>
              )}
              {solarRange === "custom" && (
                <div className="flex items-center gap-2">
                  <input
                    type="date"
                    value={solarStartDate}
                    onChange={(e) => setSolarStartDate(e.target.value)}
                    className="rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 px-3 py-1.5 text-xs font-bold text-slate-600 dark:text-slate-300 focus:outline-none focus:ring-2 focus:ring-cyan-500 cursor-pointer transition"
                  />
                  <span className="text-xs font-bold text-slate-400">s/d</span>
                  <input
                    type="date"
                    value={solarEndDate}
                    onChange={(e) => setSolarEndDate(e.target.value)}
                    className="rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 px-3 py-1.5 text-xs font-bold text-slate-600 dark:text-slate-300 focus:outline-none focus:ring-2 focus:ring-cyan-500 cursor-pointer transition"
                  />
                </div>
              )}

              {/* Range Buttons */}
              <div className="flex items-center gap-1 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 p-0.5 text-xs">
                {ranges.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setSolarRange(item.id)}
                    className={`rounded-md px-3 py-1.5 font-bold transition-all ${
                      solarRange === item.id
                        ? "bg-cyan-500 text-white shadow-sm"
                        : "text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
                    }`}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
          <div className="bg-slate-50 dark:bg-slate-950/40 rounded-xl p-4 border border-slate-100 dark:border-slate-800/80 flex-1 min-h-[256px]">
            <div style={{ height: 256 }}>
              <Bar data={solarBarData} options={solarBarOptions} />
            </div>
          </div>
        </section>

        <section className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-sm flex flex-col justify-between">
          <div>
            <h3 className="text-sm font-bold uppercase tracking-[0.2em] text-[#1f6fb5] dark:text-sky-400">Distribusi Beban PLTS</h3>
            <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">Perbandingan produksi POI-1 vs POI-2.</p>
          </div>
          {(() => {
            const totP1 = solarShowPoi1 ? (solarPoi1Values as number[]).reduce((a: number, b: number) => a + (b || 0), 0) : 0;
            const totP2 = solarShowPoi2 ? (solarPoi2Values as number[]).reduce((a: number, b: number) => a + (b || 0), 0) : 0;
            const total = totP1 + totP2;
            const p1Pct = total > 0 && solarShowPoi1 ? Number(((totP1 / total) * 100).toFixed(1)) : (solarShowPoi1 && !solarShowPoi2 ? 100 : 0);
            const p2Pct = total > 0 && solarShowPoi2 ? Number(((totP2 / total) * 100).toFixed(1)) : (solarShowPoi2 && !solarShowPoi1 ? 100 : 0);

            const segments = [];
            if (solarShowPoi1 && (p1Pct > 0 || !solarShowPoi2)) {
              segments.push({ label: "POI-1", value: p1Pct, color: "#3b82f6" });
            }
            if (solarShowPoi2 && (p2Pct > 0 || !solarShowPoi1)) {
              segments.push({ label: "POI-2", value: p2Pct, color: "#06b6d4" });
            }
            if (segments.length === 0) {
              segments.push({ label: "Tidak Ada Data", value: 100, color: "#94a3b8" });
            }

            const centerLabel = (solarShowPoi1 && solarShowPoi2)
              ? (total > 0 ? `${p1Pct}% : ${p2Pct}%` : "0% : 0%")
              : solarShowPoi1
              ? `POI-1 ${p1Pct}%`
              : `POI-2 ${p2Pct}%`;

            return (
              <>
                <div className="my-6 flex justify-center">
                  <DonutChart 
                    segments={segments} 
                    size={150} 
                    thickness={18} 
                    centerLabel={centerLabel} 
                    centerLabelSize="text-[11px]" 
                  />
                </div>
                <div className="space-y-2">
                  {solarShowPoi1 && (
                    <div className="flex items-center justify-between text-xs border-b border-slate-100 dark:border-slate-800/60 pb-1.5">
                      <span className="flex items-center gap-2 text-slate-600 dark:text-slate-300 font-medium">
                        <span className="h-2 w-2 rounded-full bg-blue-500" />POI-1
                      </span>
                      <span className="font-bold text-slate-800 dark:text-white font-mono text-[11px]">
                        {solarLive?.poi1?.status === false ? (
                          <span className="text-rose-500">TIDAK AKTIF</span>
                        ) : (
                          `${p1Pct}% (${formatNumber(totP1)} kWh)`
                        )}
                      </span>
                    </div>
                  )}
                  {solarShowPoi2 && (
                    <div className="flex items-center justify-between text-xs">
                      <span className="flex items-center gap-2 text-slate-600 dark:text-slate-300 font-medium">
                        <span className="h-2 w-2 rounded-full bg-cyan-500" />POI-2
                      </span>
                      <span className="font-bold text-slate-800 dark:text-white font-mono text-[11px]">
                        {solarLive?.poi2?.status === false ? (
                          <span className="text-rose-500">TIDAK AKTIF</span>
                        ) : (
                          `${p2Pct}% (${formatNumber(totP2)} kWh)`
                        )}
                      </span>
                    </div>
                  )}
                </div>
              </>
            );
          })()}
        </section>
      </div>

      {/* ═══════════ SECTION F: INCOMING CUBICLE ═══════════ */}
      <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-sm space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <h3 className="text-sm font-bold text-slate-700 dark:text-white">
              Dashboard <span className="text-slate-400 dark:text-slate-500">|</span> <span className="text-blue-500">Home</span> <span className="text-slate-400 dark:text-slate-500">›</span> Monthly Consumption
            </h3>
          </div>
          <div className="flex items-center gap-2">
            <select
              value={cubicleSelector}
              onChange={(e) => setCubicleSelector(e.target.value as any)}
              className="rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 px-3 py-2 text-xs font-bold text-slate-600 dark:text-slate-300 focus:outline-none focus:ring-2 focus:ring-cyan-500 cursor-pointer outline-none"
            >
              <option value="pln">Incoming PLN Grid</option>
              <option value="wf1">Incoming Cubicle WF1</option>
              <option value="wf2">Incoming Cubicle WF2</option>
              <option value="poi1">Solar PV POI-1</option>
              <option value="poi2">Solar PV POI-2</option>
            </select>
            {(() => {
              let isOnline = true;
              if (cubicleSelector === "poi1") isOnline = solarLive?.poi1?.status !== false;
              if (cubicleSelector === "poi2") isOnline = solarLive?.poi2?.status !== false;
              return (
                <span className={`px-2 py-0.5 rounded text-[10px] font-extrabold uppercase border ${
                  isOnline
                    ? "bg-emerald-500/10 text-emerald-500 border-emerald-500/20"
                    : "bg-rose-500/10 text-rose-500 border-rose-500/20"
                }`}>
                  {isOnline ? "ON" : "TIDAK AKTIF"}
                </span>
              );
            })()}
            <button
              onClick={() => setCubiclePoiView(!cubiclePoiView)}
              className="px-3 py-1.5 rounded-lg text-[10px] font-bold text-blue-500 bg-blue-500/10 hover:bg-blue-500/20 border border-blue-500/20 transition"
            >
              {cubiclePoiView ? "View: Total kWh" : "View: POI Mode"}
            </button>
          </div>
        </div>

        {/* Cubicle summary cards */}
        <div className="grid gap-3 sm:grid-cols-5">
          <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/30 p-4">
            <div className="text-[10px] font-bold uppercase tracking-wider text-amber-500">Peak Demand</div>
            <div className="mt-1 text-lg font-extrabold text-slate-800 dark:text-white font-mono">
              {cubicleSummary.peakDemand.toLocaleString("id-ID", { maximumFractionDigits: 1 })} kW
            </div>
          </div>
          {cubiclePoiView ? (
            <>
              <div className="rounded-xl border border-blue-500/20 bg-blue-500/5 dark:bg-blue-950/30 p-4">
                <span className="text-[10px] font-bold text-blue-500 px-2 py-0.5 rounded bg-blue-500/10 border border-blue-500/20">POI-1</span>
                <div className="mt-1 text-lg font-extrabold text-slate-800 dark:text-white font-mono">
                  {cubicleSelector.startsWith("poi") || cubicleSelector === "pln" ? `${cubicleSummary.poi1Kwh.toLocaleString("id-ID", { maximumFractionDigits: 1 })} kWh` : "0 kWh"}
                </div>
              </div>
              <div className="rounded-xl border border-cyan-500/20 bg-cyan-500/5 dark:bg-cyan-950/30 p-4">
                <span className="text-[10px] font-bold text-cyan-500 px-2 py-0.5 rounded bg-cyan-500/10 border border-cyan-500/20">POI-2</span>
                <div className="mt-1 text-lg font-extrabold text-slate-800 dark:text-white font-mono">
                  {cubicleSelector.startsWith("poi") || cubicleSelector === "pln" ? `${cubicleSummary.poi2Kwh.toLocaleString("id-ID", { maximumFractionDigits: 1 })} kWh` : "0 kWh"}
                </div>
              </div>
            </>
          ) : (
            <>
              <div className="rounded-xl border border-blue-500/20 bg-blue-500/5 dark:bg-blue-950/30 p-4">
                <span className="text-[10px] font-bold text-blue-500 px-2 py-0.5 rounded bg-blue-500/10 border border-blue-500/20">LWBP</span>
                <div className="mt-1 text-lg font-extrabold text-slate-800 dark:text-white font-mono">
                  {cubicleSummary.lwbpKwh.toLocaleString("id-ID", { maximumFractionDigits: 1 })} kWh
                </div>
              </div>
              <div className="rounded-xl border border-rose-500/20 bg-rose-500/5 dark:bg-rose-950/30 p-4">
                <span className="text-[10px] font-bold text-rose-500 px-2 py-0.5 rounded bg-rose-500/10 border border-rose-500/20">WBP</span>
                <div className="mt-1 text-lg font-extrabold text-slate-800 dark:text-white font-mono">
                  {cubicleSummary.wbpKwh.toLocaleString("id-ID", { maximumFractionDigits: 1 })} kWh
                </div>
              </div>
            </>
          )}
          <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/30 p-4">
            <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Monthly Usage</div>
            <div className="mt-1 text-lg font-extrabold text-slate-800 dark:text-white font-mono">
              {cubicleSummary.monthlyKwh.toLocaleString("id-ID", { maximumFractionDigits: 1 })} kWh
            </div>
          </div>
          <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/30 p-4">
            <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Estimation Cost</div>
            <div className="mt-1 text-base font-extrabold text-slate-800 dark:text-white font-mono">
              {cubicleSummary.cost > 0 ? formatCurrency(cubicleSummary.cost) : "Rp 0,00 (Free / Solar)"}
            </div>
          </div>
        </div>

        {/* Cubicle monthly comparison chart */}
        <MonthlyComparisonChart
          title={`Konsumsi Bulanan Real Time (vs Bulan Sebelumnya) — ${
            cubicleSelector === "pln" ? "Incoming PLN Grid" :
            cubicleSelector === "wf1" ? "Incoming Cubicle WF1" :
            cubicleSelector === "wf2" ? "Incoming Cubicle WF2" :
            cubicleSelector === "poi1" ? "Solar PV POI-1" : "Solar PV POI-2"
          }`}
          currentData={cubicleDailyData.currentData}
          previousData={cubicleDailyData.previousData}
          isDark={isDark}
        />
      </div>

      {/* ═══════════ ROW 1: BIGGEST CONSUMPTION ═══════════ */}
      <div className="grid gap-6 md:grid-cols-2">
        {/* Biggest Consumption - Fact 1 */}
        <section className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-sm flex flex-col">
          <div className="flex items-center justify-between gap-3 mb-4">
            <div>
              <h3 className="text-sm font-bold uppercase tracking-[0.2em] text-[#1f6fb5] dark:text-sky-400">Biggest Consumption - Fact 1</h3>
              <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">Fact-1 categories sorted by highest consumption.</p>
            </div>
          </div>
          <div className="bg-slate-50 dark:bg-slate-950/40 rounded-xl p-4 border border-slate-100 dark:border-slate-800/80 flex-1 min-h-[250px]">
            <div style={{ height: 250 }}>
              {factCategories1.filter(c => c.enabled).length > 0 ? (
                <Bar data={makeHorizontalBarData(factCategories1, 1)} options={horizontalBarOptions} />
              ) : (
                <div className="flex flex-col items-center justify-center h-full text-center">
                  <span className="text-2xl mb-1 opacity-40">📊</span>
                  <span className="text-xs font-bold text-slate-500 dark:text-slate-400">Data Belum Tersedia</span>
                  <span className="text-[10px] text-slate-400 dark:text-slate-500 mt-0.5">Sub-metering Fact-1 belum terhubung</span>
                </div>
              )}
            </div>
          </div>
        </section>

        {/* Biggest Consumption - Fact 2 */}
        <section className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-sm flex flex-col">
          <div className="flex items-center justify-between gap-3 mb-4">
            <div>
              <h3 className="text-sm font-bold uppercase tracking-[0.2em] text-[#1f6fb5] dark:text-sky-400">Biggest Consumption - Fact 2</h3>
              <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">Fact-2 categories sorted by highest consumption.</p>
            </div>
          </div>
          <div className="bg-slate-50 dark:bg-slate-950/40 rounded-xl p-4 border border-slate-100 dark:border-slate-800/80 flex-1 min-h-[250px]">
            <div style={{ height: 250 }}>
              {factCategories2.filter(c => c.enabled).length > 0 ? (
                <Bar data={makeHorizontalBarData(factCategories2, 2)} options={horizontalBarOptions} />
              ) : (
                <div className="flex flex-col items-center justify-center h-full text-center">
                  <span className="text-2xl mb-1 opacity-40">📊</span>
                  <span className="text-xs font-bold text-slate-500 dark:text-slate-400">Data Belum Tersedia</span>
                  <span className="text-[10px] text-slate-400 dark:text-slate-500 mt-0.5">Sub-metering Fact-2 belum terhubung</span>
                </div>
              )}
            </div>
          </div>
        </section>
      </div>

      {/* ═══════════ ROW 2: UTILITY DEPARTMENT ANALYSIS ═══════════ */}
      <div className="grid gap-6 lg:grid-cols-[2fr_1fr]">
        {/* Utility Consumption - Horizontal Bar Chart Card */}
        <section className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-sm flex flex-col">
          <div className="flex items-center justify-between gap-3 mb-4">
            <div>
              <h3 className="text-sm font-bold uppercase tracking-[0.2em] text-[#1f6fb5] dark:text-sky-400">Utility Consumption</h3>
              <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">Utility electricity consumption sorted by highest consumer.</p>
            </div>
            <select
              value={utilityFilter}
              onChange={(e) => setUtilityFilter(e.target.value as any)}
              className="px-2.5 py-1 text-xs rounded border border-slate-350 bg-slate-50 text-slate-800 dark:bg-slate-850 dark:text-slate-200 dark:border-slate-700 font-bold focus:outline-none cursor-pointer"
            >
              <option value="Fact 1">Fact 1 Only</option>
              <option value="Fact 2">Fact 2 Only</option>
            </select>
          </div>

          <div className="bg-slate-50 dark:bg-slate-950/40 rounded-xl p-4 border border-slate-100 dark:border-slate-800/80 flex-1 min-h-[250px]">
            <div style={{ height: 250 }}>
              {utilityData.items.length > 0 ? (
                <Bar data={makeDeptHorizontalBarData(utilityData.items, "Utility")} options={horizontalBarOptions} />
              ) : (
                <div className="flex flex-col items-center justify-center h-full text-center">
                  <span className="text-2xl mb-1 opacity-40">📊</span>
                  <span className="text-xs font-bold text-slate-500 dark:text-slate-400">Data Belum Tersedia</span>
                  <span className="text-[10px] text-slate-400 dark:text-slate-500 mt-0.5">Sub-metering sistem utility belum terhubung</span>
                </div>
              )}
            </div>
          </div>
        </section>

        {/* Utility Distribution Share Card */}
        <section className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-sm flex flex-col justify-between">
          <div>
            <h3 className="text-sm font-bold uppercase tracking-[0.2em] text-[#1f6fb5] dark:text-sky-400">Utility Distribution Share</h3>
            <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">Distribution breakdown of utility systems.</p>
          </div>
          <div className="my-4 flex justify-center flex-shrink-0">
            <DonutChart 
              segments={utilityDonutSegments.length > 0 ? utilityDonutSegments : [{ label: "Belum Ada Data", value: 100, color: "#cbd5e1" }]} 
              size={140} 
              thickness={16} 
              centerLabel={utilityData.totalKwh > 0 ? `${utilityData.totalKwh.toLocaleString("id-ID")} kWh` : "0 kWh"} 
              centerLabelSize="text-[10px]"
            />
          </div>
          <div className="space-y-1.5 flex-1 overflow-y-auto max-h-[140px] scrollbar-hide">
            {utilityDonutSegments.length > 0 ? (
              utilityDonutSegments.map((item) => (
                <div key={item.label} className="flex items-center justify-between text-xs border-b border-slate-100 dark:border-slate-800/60 pb-1.5">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: item.color }} />
                    <span className="font-semibold text-slate-600 dark:text-slate-300">{item.label}</span>
                  </div>
                  <span className="font-mono font-bold text-slate-900 dark:text-white">{item.value}%</span>
                </div>
              ))
            ) : (
              <div className="text-xs text-slate-400 py-4 text-center">Belum ada data sub-metering utility.</div>
            )}
          </div>
        </section>
      </div>

      {/* ═══════════ ROW 3: HVAC DEPARTMENT ANALYSIS ═══════════ */}
      <div className="grid gap-6 lg:grid-cols-[2fr_1fr]">
        {/* HVAC Consumption - Horizontal Bar Chart Card */}
        <section className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-sm flex flex-col">
          <div className="flex items-center justify-between gap-3 mb-4">
            <div>
              <h3 className="text-sm font-bold uppercase tracking-[0.2em] text-[#06b6d4] dark:text-cyan-400">HVAC Consumption</h3>
              <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">HVAC electricity consumption sorted by highest consumer.</p>
            </div>
            <select
              value={hvacFilter}
              onChange={(e) => setHvacFilter(e.target.value as any)}
              className="px-2.5 py-1 text-xs rounded border border-slate-350 bg-slate-50 text-slate-800 dark:bg-slate-850 dark:text-slate-200 dark:border-slate-700 font-bold focus:outline-none cursor-pointer"
            >
              <option value="Fact 1">Fact 1 Only</option>
              <option value="Fact 2">Fact 2 Only</option>
            </select>
          </div>

          <div className="bg-slate-50 dark:bg-slate-950/40 rounded-xl p-4 border border-slate-100 dark:border-slate-800/80 flex-1 min-h-[250px]">
            <div style={{ height: 250 }}>
              {hvacData.items.length > 0 ? (
                <Bar data={makeDeptHorizontalBarData(hvacData.items, "HVAC")} options={horizontalBarOptions} />
              ) : (
                <div className="flex flex-col items-center justify-center h-full text-center">
                  <span className="text-2xl mb-1 opacity-40">📊</span>
                  <span className="text-xs font-bold text-slate-500 dark:text-slate-400">Data Belum Tersedia</span>
                  <span className="text-[10px] text-slate-400 dark:text-slate-500 mt-0.5">Sub-metering sistem HVAC belum terhubung</span>
                </div>
              )}
            </div>
          </div>
        </section>

        {/* HVAC Distribution Share Card */}
        <section className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-sm flex flex-col justify-between">
          <div>
            <h3 className="text-sm font-bold uppercase tracking-[0.2em] text-[#06b6d4] dark:text-cyan-400">HVAC Distribution Share</h3>
            <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">Distribution breakdown of HVAC systems.</p>
          </div>
          <div className="my-4 flex justify-center flex-shrink-0">
            <DonutChart 
              segments={hvacDonutSegments.length > 0 ? hvacDonutSegments : [{ label: "Belum Ada Data", value: 100, color: "#cbd5e1" }]} 
              size={140} 
              thickness={16} 
              centerLabel={hvacData.totalKwh > 0 ? `${hvacData.totalKwh.toLocaleString("id-ID")} kWh` : "0 kWh"} 
              centerLabelSize="text-[10px]"
            />
          </div>
          <div className="space-y-1.5 flex-1 overflow-y-auto max-h-[140px] scrollbar-hide">
            {hvacDonutSegments.length > 0 ? (
              hvacDonutSegments.map((item) => (
                <div key={item.label} className="flex items-center justify-between text-xs border-b border-slate-100 dark:border-slate-800/60 pb-1.5">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: item.color }} />
                    <span className="font-semibold text-slate-600 dark:text-slate-300">{item.label}</span>
                  </div>
                  <span className="font-mono font-bold text-slate-900 dark:text-white">{item.value}%</span>
                </div>
              ))
            ) : (
              <div className="text-xs text-slate-400 py-4 text-center">Belum ada data sub-metering HVAC.</div>
            )}
          </div>
        </section>
      </div>


      {/* ═══════════ SECTION H: EQUIPMENT MONTHLY CHARTS ═══════════ */}
      <div className="space-y-8">
        <div className="flex flex-wrap items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-2 gap-2">
          <h3 className="text-sm font-bold uppercase tracking-[0.2em] text-slate-400 dark:text-slate-500">
            Konsumsi Per-Equipment (Bulanan vs Bulan Sebelumnya)
          </h3>
          <span className="text-[11px] font-bold text-amber-500 bg-amber-500/10 border border-amber-500/20 px-2.5 py-0.5 rounded-full">
            Sub-metering belum terpasang (Belum ada data)
          </span>
        </div>

        {/* Cooling Tower Section */}
        <div className="space-y-3">
          <h4 className="text-xs font-bold uppercase tracking-wider text-sky-500">● Cooling Tower</h4>
          <div className="grid gap-6 md:grid-cols-2">
            <MonthlyComparisonChart title="Cooling Tower WF1" currentData={ct1Series.current} previousData={ct1Series.previous} isDark={isDark} />
            <MonthlyComparisonChart title="Cooling Tower WF2" currentData={ct2Series.current} previousData={ct2Series.previous} isDark={isDark} />
          </div>
        </div>

        {/* Boiler Section */}
        <div className="space-y-3">
          <h4 className="text-xs font-bold uppercase tracking-wider text-sky-500">● Boiler</h4>
          <div className="grid gap-6 md:grid-cols-3">
            <MonthlyComparisonChart title="Boiler 3 WF1" currentData={boiler3Series.current} previousData={boiler3Series.previous} isDark={isDark} />
            <MonthlyComparisonChart title="Boiler 4" currentData={boiler4Series.current} previousData={boiler4Series.previous} isDark={isDark} />
            <MonthlyComparisonChart title="Boiler 5" currentData={boiler5Series.current} previousData={boiler5Series.previous} isDark={isDark} />
          </div>
        </div>

        {/* Compressed Air Section */}
        <div className="space-y-3">
          <h4 className="text-xs font-bold uppercase tracking-wider text-sky-500">● Compressed Air</h4>
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            <MonthlyComparisonChart title="Compressed Air WF1 — ALE-30" currentData={compAle30Series.current} previousData={compAle30Series.previous} isDark={isDark} />
            <MonthlyComparisonChart title="Compressed Air WF1 — ZT-30.1" currentData={compZt301Series.current} previousData={compZt301Series.previous} isDark={isDark} />
            <MonthlyComparisonChart title="Compressed Air WF1 — ZT-30.2" currentData={compZt302Series.current} previousData={compZt302Series.previous} isDark={isDark} />
            <MonthlyComparisonChart title="Compressed Air WF1 — ZT-55" currentData={compZt55Series.current} previousData={compZt55Series.previous} isDark={isDark} />
            <MonthlyComparisonChart title="Compressed Air WF2 — ALE-250" currentData={compAle250Series.current} previousData={compAle250Series.previous} isDark={isDark} />
            <MonthlyComparisonChart title="Compressed Air WF2 — ZT-110" currentData={compZt110Series.current} previousData={compZt110Series.previous} isDark={isDark} />
          </div>
        </div>

        {/* Chiller Section */}
        <div className="space-y-3">
          <h4 className="text-xs font-bold uppercase tracking-wider text-sky-500">● Chiller</h4>
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            <MonthlyComparisonChart title="Chiller WF1 — Daikin-1" currentData={chillerDaikin1Series.current} previousData={chillerDaikin1Series.previous} isDark={isDark} />
            <MonthlyComparisonChart title="Chiller WF1 — Daikin-2" currentData={chillerDaikin2Series.current} previousData={chillerDaikin2Series.previous} isDark={isDark} />
            <MonthlyComparisonChart title="Chiller WF1 — Trane-CGAM40" currentData={chillerTraneCgam40Series.current} previousData={chillerTraneCgam40Series.previous} isDark={isDark} />
            <MonthlyComparisonChart title="Chiller WF2 — Trane-100" currentData={chillerTrane100Series.current} previousData={chillerTrane100Series.previous} isDark={isDark} />
            <MonthlyComparisonChart title="Chiller WF2 — Trane-275" currentData={chillerTrane275Series.current} previousData={chillerTrane275Series.previous} isDark={isDark} />
          </div>
        </div>

        {/* Chiller HVAC & Warehouse Section */}
        <div className="space-y-3">
          <h4 className="text-xs font-bold uppercase tracking-wider text-sky-500">● Chiller HVAC & Warehouse</h4>
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            <MonthlyComparisonChart title="Chiller HVAC WF2 — Trane-250" currentData={chillerTrane250Series.current} previousData={chillerTrane250Series.previous} isDark={isDark} />
            <MonthlyComparisonChart title="Chiller HVAC WF2 — Trane-185" currentData={chillerTrane185Series.current} previousData={chillerTrane185Series.previous} isDark={isDark} />
            <MonthlyComparisonChart title="HVAC Warehouse — WH-2" currentData={hvacWh2Series.current} previousData={hvacWh2Series.previous} isDark={isDark} />
            <MonthlyComparisonChart title="HVAC Warehouse — WH-3" currentData={hvacWh3Series.current} previousData={hvacWh3Series.previous} isDark={isDark} />
            <MonthlyComparisonChart title="HVAC Warehouse — WH-4" currentData={hvacWh4Series.current} previousData={hvacWh4Series.previous} isDark={isDark} />
            <MonthlyComparisonChart title="HVAC Warehouse — WH-5" currentData={hvacWh5Series.current} previousData={hvacWh5Series.previous} isDark={isDark} />
            <MonthlyComparisonChart title="HVAC Warehouse — WH-6" currentData={hvacWh6Series.current} previousData={hvacWh6Series.previous} isDark={isDark} />
            <MonthlyComparisonChart title="HVAC Warehouse — WH-7" currentData={hvacWh7Series.current} previousData={hvacWh7Series.previous} isDark={isDark} />
          </div>
        </div>

        {/* HVAC QC & Produksi Section */}
        <div className="space-y-3">
          <h4 className="text-xs font-bold uppercase tracking-wider text-sky-500">● HVAC QC & Produksi</h4>
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            <MonthlyComparisonChart title="HVAC QC — Micro" currentData={hvacQcMicroSeries.current} previousData={hvacQcMicroSeries.previous} isDark={isDark} />
            <MonthlyComparisonChart title="HVAC QC — Retained Sample" currentData={hvacQcRetainedSeries.current} previousData={hvacQcRetainedSeries.previous} isDark={isDark} />
            <MonthlyComparisonChart title="HVAC QC — Sampling" currentData={hvacQcSamplingSeries.current} previousData={hvacQcSamplingSeries.previous} isDark={isDark} />
            <MonthlyComparisonChart title="HVAC Produksi — WF1-U3" currentData={hvacWf1U3Series.current} previousData={hvacWf1U3Series.previous} isDark={isDark} />
            <MonthlyComparisonChart title="HVAC Produksi — WF2-U1" currentData={hvacWf2U1Series.current} previousData={hvacWf2U1Series.previous} isDark={isDark} />
            <MonthlyComparisonChart title="HVAC Produksi — WF2-U2" currentData={hvacWf2U2Series.current} previousData={hvacWf2U2Series.previous} isDark={isDark} />
          </div>
        </div>

        {/* Dynamic Selection Chart (Sesuai Pilihan) */}
        <DynamicSelectionChart isDark={isDark} />
      </div>

      {/* ═══════════ CONFIGURATION PANEL (API Sources) ═══════════ */}
      {showConfigPanel && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm" onClick={() => setShowConfigPanel(false)}>
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl w-full max-w-3xl p-6 space-y-4 max-h-[80vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold uppercase tracking-wide text-slate-700 dark:text-white">Konfigurasi Electricity Dashboard</h3>
                <p className="text-xs text-slate-400 mt-0.5">Kelola API Sources dan Chart Data Sources untuk halaman Electricity.</p>
              </div>
              <button onClick={() => setShowConfigPanel(false)} className="text-slate-400 hover:text-slate-600 text-lg font-bold">✕</button>
            </div>

            {/* API Sources for Electricity */}
            <div className="border border-slate-200 dark:border-slate-800 rounded-xl p-5 space-y-4">
              <h4 className="text-xs font-extrabold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1">🔌 API Sources - General (Solar & Genset)</h4>
              <ApiSourcesPanel unitId="electricity" />
            </div>

            <div className="border border-slate-200 dark:border-slate-800 rounded-xl p-5 space-y-4">
              <h4 className="text-xs font-extrabold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1">🔌 API Sources - PLN Cubicle (PM8000)</h4>
              <ApiSourcesPanel unitId="Cubicle_PLN_PM8000" />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
