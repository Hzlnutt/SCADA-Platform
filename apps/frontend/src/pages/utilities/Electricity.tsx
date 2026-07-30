import { useCallback, useEffect, useMemo, useState } from "react";
import { PageHeader } from "../../components/ui/PageHeader";
import { Bar } from "react-chartjs-2";
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
  const pts = useMemo(() => {
    const arr: number[] = [];
    let v = 50 + Math.random() * 20;
    for (let i = 0; i < 20; i++) {
      v += (Math.random() - 0.48) * 12;
      v = Math.max(10, Math.min(90, v));
      arr.push(v);
    }
    return arr;
  }, []);
  const pathD = pts.map((y, i) => `${i === 0 ? "M" : "L"}${(i / 19) * 100},${100 - y}`).join(" ");
  return (
    <svg viewBox="0 0 100 100" className="absolute inset-0 w-full h-full opacity-20" preserveAspectRatio="none">
      <path d={pathD} fill="none" stroke={color} strokeWidth="2.5" />
    </svg>
  );
};

/* ═══════════ MONTHLY COMPARISON BAR CHART ═══════════ */
function MonthlyComparisonBarChart({
  currentData,
  previousData,
  isDark
}: {
  currentData: number[];
  previousData: number[];
  isDark: boolean;
}) {
  const daysInMonth = Math.max(currentData.length, previousData.length, 28);
  const dayLabels = Array.from({ length: daysInMonth }, (_, i) => String(i + 1).padStart(2, "0"));

  const data = {
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
  };

  const options: any = {
    responsive: true,
    maintainAspectRatio: false,
    animation: { duration: 0 },
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
  };

  return <Bar data={data} options={options} />;
}

function MonthlyComparisonChart({
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
  return (
    <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-sm">
      <h4 className="text-xs font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400 mb-4">{title}</h4>
      <div style={{ height: 280 }}>
        <MonthlyComparisonBarChart currentData={currentData} previousData={previousData} isDark={isDark} />
      </div>
    </div>
  );
}

function DynamicSelectionChart({ isDark }: { isDark: boolean }) {
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
          <span className="px-2 py-0.5 rounded text-[10px] font-extrabold uppercase bg-emerald-500/10 text-emerald-500 border border-emerald-500/20">ON</span>
        </div>
      </div>

      <div style={{ height: 280 }}>
        <MonthlyComparisonBarChart currentData={currentData} previousData={previousData} isDark={isDark} />
      </div>
    </div>
  );
}

/* ═══════════ MAIN COMPONENT ═══════════ */
export default function Electricity() {
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

  const theme = useSystemStore((state) => state.theme);
  const isDark = theme === "dark";

  const wbpRate = useConfigStore((state) => state.wbpRate);
  const lwbpRate = useConfigStore((state) => state.lwbpRate);

  // Incoming Cubicle state
  const [cubicleSelector, setCubicleSelector] = useState<"wf1" | "wf2">("wf1");
  const [cubiclePoiView, setCubiclePoiView] = useState(false);

  // Consumption Fact categories
  const [factCategories1, setFactCategories1] = useState<ConsumptionFactCategory[]>([]);
  const [factCategories2, setFactCategories2] = useState<ConsumptionFactCategory[]>([]);
  const [showFactEditor, setShowFactEditor] = useState(false);
  const [editingFactSide, setEditingFactSide] = useState<1 | 2>(1);
  const [newCatKey, setNewCatKey] = useState("");
  const [newCatLabel, setNewCatLabel] = useState("");
  const [newCatValue, setNewCatValue] = useState("");

  // Config panel
  const [showConfigPanel, setShowConfigPanel] = useState(false);

  /* ═══ DATA FETCHING ═══ */
  const fetchData = useCallback((showLoading = false) => {
    if (showLoading) {
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
        setSummaryData(res.data);
        setChartData(res.data);
        if (res.data?.pqData) {
          setLivePf(res.data.pqData.pf);
          setPfStatus(res.data.pqData.pfStatus || "offline");
        }
        if (showLoading) {
          setSummaryLoading(false);
          setChartLoading(false);
        }
      })
      .catch((err) => {
        console.error("Failed to load electricity data", err);
        if (showLoading) {
          setSummaryLoading(false);
          setChartLoading(false);
        }
      });
  }, [range, selectedYear, chartStartDate, chartEndDate]);

  useEffect(() => {
    fetchData(true);
  }, [fetchData]);

  // Auto-refresh & socket
  useEffect(() => {
    let active = true;
    const interval = setInterval(() => { if (active) fetchData(false); }, 2000);
    const socket = getSocket();
    const handleConfigUpdate = () => { useConfigStore.getState().fetchRates().then(() => { if (active) fetchData(false); }); };
    const handleElectricityUpdate = () => { if (active) fetchData(false); };
    const handlePfStatus = (payload: any) => { if (active) { setLivePf(payload.value); setPfStatus(payload.status); } };
    socket.on("config:update", handleConfigUpdate);
    socket.on("electricity:update", handleElectricityUpdate);
    socket.on("power_factor:status", handlePfStatus);
    return () => {
      active = false;
      clearInterval(interval);
      socket.off("config:update", handleConfigUpdate);
      socket.off("electricity:update", handleElectricityUpdate);
      socket.off("power_factor:status", handlePfStatus);
    };
  }, [fetchData]);

  // Load consumption fact categories
  useEffect(() => {
    getJson<{ data: ConsumptionFactCategory[] }>("/config/electricity?configType=consumption_fact_1")
      .then((res) => { if (res?.data) setFactCategories1(res.data); })
      .catch(() => {});
    getJson<{ data: ConsumptionFactCategory[] }>("/config/electricity?configType=consumption_fact_2")
      .then((res) => { if (res?.data) setFactCategories2(res.data); })
      .catch(() => {});
  }, []);

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
    if (range === "day" && summaryData.summary.perMonthSummary) {
      const monthData = summaryData.summary.perMonthSummary[selectedMonth];
      if (monthData) {
        return { totalCost: monthData.totalCost, totalKwh: monthData.totalKwh, peakDemand: monthData.peakDemand, peakDemandTs: monthData.peakDemandTs, loadFactor: summaryData.pqData.pf ? summaryData.pqData.pf * 100 : 0, wbpKwh: monthData.wbpKwh, lwbpKwh: monthData.lwbpKwh, wbpCost: monthData.wbpCost, lwbpCost: monthData.lwbpCost };
      }
    }
    return { totalCost: summaryData.summary.totalCost, totalKwh: summaryData.summary.totalKwh, peakDemand: summaryData.pqData.activePower, peakDemandTs: summaryData.pqData.activePowerTs, loadFactor: summaryData.pqData.pf ? summaryData.pqData.pf * 100 : 0, wbpKwh: summaryData.summary.wbpKwh, lwbpKwh: summaryData.summary.lwbpKwh, wbpCost: summaryData.summary.wbpCost, lwbpCost: summaryData.summary.lwbpCost };
  }, [hasSummaryData, summaryData, range, selectedMonth, config]);

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
  const stackedBarData = {
    labels: barLabels,
    datasets: [
      { label: `LWBP ${barUnit}`, data: barLwbpValues, backgroundColor: "rgba(59,130,246,.8)", borderWidth: 0, borderRadius: { topLeft: 0, topRight: 0, bottomLeft: 4, bottomRight: 4 }, barPercentage: 0.65, stack: "beban" },
      { label: `WBP ${barUnit}`, data: barWbpValues, backgroundColor: "rgba(239,68,68,.8)", borderWidth: 0, borderRadius: { topLeft: 4, topRight: 4, bottomLeft: 0, bottomRight: 0 }, barPercentage: 0.65, stack: "beban" }
    ]
  };

  const stackedBarOptions: any = {
    responsive: true, maintainAspectRatio: false, animation: { duration: 0 },
    plugins: {
      legend: { display: true, position: "top", align: "end", labels: { color: isDark ? "rgba(148,163,184,.9)" : "rgba(71,85,105,.9)", font: { size: 10, weight: "600" as const }, usePointStyle: true, pointStyle: "rectRounded", padding: 12 } },
      tooltip: {
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
  };

  /* ═══ HORIZONTAL BAR FOR CONSUMPTION FACT ═══ */
  const makeHorizontalBarData = (categories: ConsumptionFactCategory[]) => {
    const enabled = categories.filter(c => c.enabled);
    return {
      labels: enabled.map(c => c.label),
      datasets: [{
        label: "kWh",
        data: enabled.map(c => c.value?.kWh ?? 0),
        backgroundColor: "rgba(59,130,246,.8)",
        borderWidth: 0,
        borderRadius: 4,
        barPercentage: 0.55
      }]
    };
  };

  const horizontalBarOptions: any = {
    indexAxis: "y", responsive: true, maintainAspectRatio: false,
    plugins: { legend: { display: false }, tooltip: { callbacks: { label: (ctx: any) => `${Number(ctx.parsed.x).toLocaleString("id-ID")} kWh` } } },
    scales: {
      x: { grid: { color: isDark ? "rgba(51,65,85,.4)" : "rgba(203,213,225,.5)" }, ticks: { color: isDark ? "rgba(148,163,184,.7)" : "rgba(71,85,105,.7)", font: { size: 10 } } },
      y: { grid: { display: false }, ticks: { color: isDark ? "rgba(148,163,184,.8)" : "rgba(71,85,105,.8)", font: { size: 10 }, autoSkip: false } }
    }
  };

  /* ═══ NO DATA PLACEHOLDER SECTIONS ═══ */
  const dummyMonthlyData = useMemo(() => [], []);
  const dummyPreviousData = useMemo(() => [], []);

  /* ═══ CONSUMPTION FACT EDITOR HANDLERS ═══ */
  const handleAddCategory = async () => {
    if (!newCatKey.trim() || !newCatLabel.trim()) return;
    const configType = editingFactSide === 1 ? "consumption_fact_1" : "consumption_fact_2";
    const cats = editingFactSide === 1 ? factCategories1 : factCategories2;
    try {
      await postJson("/config/electricity", {
        config_type: configType,
        config_key: newCatKey.trim(),
        label: newCatLabel.trim(),
        value: { kWh: parseFloat(newCatValue) || 0 },
        sort_order: cats.length,
        enabled: true
      });
      // Reload
      const res = await getJson<{ data: ConsumptionFactCategory[] }>(`/config/electricity?configType=${configType}`);
      if (res?.data) {
        editingFactSide === 1 ? setFactCategories1(res.data) : setFactCategories2(res.data);
      }
      setNewCatKey("");
      setNewCatLabel("");
      setNewCatValue("");
    } catch (err) {
      console.error("Failed to add category:", err);
    }
  };

  const handleDeleteCategory = async (id: number, side: 1 | 2) => {
    if (!confirm("Hapus kategori ini?")) return;
    try {
      await deleteJson(`/config/electricity/${id}`);
      const configType = side === 1 ? "consumption_fact_1" : "consumption_fact_2";
      const res = await getJson<{ data: ConsumptionFactCategory[] }>(`/config/electricity?configType=${configType}`);
      if (res?.data) {
        side === 1 ? setFactCategories1(res.data) : setFactCategories2(res.data);
      }
    } catch (err) {
      console.error("Failed to delete category:", err);
    }
  };

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
              {summaryLoading ? "..." : `${(cardSummary.totalKwh / 1000).toLocaleString("id-ID", { maximumFractionDigits: 0 })}`}
              <span className={`text-sm font-bold ml-1 ${isDark ? 'text-blue-200' : 'text-blue-700'}`}>kWh</span>
            </div>
            <div className={`mt-2 flex items-center gap-3 text-[10px] ${isDark ? 'text-blue-200' : 'text-blue-800'}`}>
              <span>Voltage: <strong className={isDark ? 'text-white' : 'text-blue-950'}>20.09 kV</strong></span>
              <span>Freq: <strong className={isDark ? 'text-white' : 'text-blue-950'}>50.12 Hz</strong></span>
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
            <div className={`text-sm font-extrabold text-red-500 font-mono`}>
              API TIDAK TERSEDIA
            </div>
            <div className={`mt-2 flex items-center gap-3 text-[10px] ${isDark ? 'text-emerald-200' : 'text-emerald-800'}`}>
              <span>Capacity: <strong className={isDark ? 'text-white' : 'text-emerald-950'}>1,700 kW</strong></span>
              <span>Efficiency: <strong className={isDark ? 'text-white' : 'text-emerald-950'}>—</strong></span>
            </div>
          </div>
        </div>

        {/* Genset Backup */}
        <div className="relative overflow-hidden rounded-2xl border p-5 shadow-sm transition hover:shadow-md"
             style={{
               background: isDark 
                 ? 'linear-gradient(135deg, #78350f, #b45309)' 
                 : 'linear-gradient(135deg, #fffbeb, #fef3c7)',
               borderColor: isDark ? '#1e293b' : '#fde68a'
             }}>
          <Sparkline color={isDark ? "#fcd34d" : "#f59e0b"} />
          <div className="relative z-10">
            <div className="flex items-center justify-between mb-3">
              <span className={`text-[10px] font-bold uppercase tracking-widest ${isDark ? 'text-amber-200' : 'text-amber-800'}`}>Genset Backup</span>
              <div className={`h-8 w-8 rounded-lg ${isDark ? 'bg-white/10 text-white' : 'bg-amber-600/10 text-amber-700'} flex items-center justify-center`}><IconGenset /></div>
            </div>
            <div className={`text-3xl font-extrabold font-mono ${isDark ? 'text-white' : 'text-amber-950'}`}>
              0 <span className={`text-sm font-bold ml-1 ${isDark ? 'text-amber-200' : 'text-amber-700'}`}>running</span>
            </div>
            <div className={`mt-2 text-[10px] ${isDark ? 'text-amber-200' : 'text-amber-800'} space-y-0.5`}>
              <div>Caterpillar: <strong className={isDark ? 'text-white' : 'text-amber-950'}>1350 kVA</strong></div>
              <div>Perkins: <strong className={isDark ? 'text-white' : 'text-amber-950'}>1000 kVA</strong></div>
              <div className="text-[8px] opacity-75 font-semibold italic mt-1">Genset tidak dipasang powermeter</div>
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
              {summaryLoading ? "..." : `${((cardSummary.totalKwh) / 1000).toLocaleString("id-ID", { maximumFractionDigits: 0 })}`}
              <span className={`text-sm font-bold ml-1 ${isDark ? 'text-cyan-200' : 'text-cyan-700'}`}>kWh</span>
            </div>
            <div className={`mt-2 flex items-center gap-3 text-[10px] ${isDark ? 'text-cyan-200' : 'text-cyan-800'}`}>
              <span>P Grid: <strong className={isDark ? 'text-white' : 'text-cyan-950'}>{summaryLoading ? "..." : `${(cardSummary.totalKwh / 1000).toLocaleString("id-ID", { maximumFractionDigits: 0 })}`} kW</strong></span>
              <span>P Solar: <strong className="text-red-500">API TIDAK TERSEDIA</strong></span>
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
              {summaryLoading ? "..." : formatCurrency(cardSummary.totalCost)}
            </div>
            <div className="mt-1 text-[10px] font-semibold text-emerald-600 dark:text-emerald-400">
              {summaryLoading ? "" : `${cardSummary.totalKwh.toLocaleString("id-ID", { maximumFractionDigits: 0 })} kWh`}
            </div>
          </div>

          {/* Beban LWBP */}
          <div className="rounded-xl border border-blue-500/20 bg-blue-500/5 dark:bg-blue-950/30 p-4 hover:border-blue-400 transition">
            <span className="text-[10px] font-bold uppercase tracking-wider text-blue-500 px-2 py-0.5 rounded bg-blue-500/10 border border-blue-500/20">Beban LWBP</span>
            <div className="mt-2 text-lg font-extrabold text-slate-800 dark:text-white font-mono">
              {summaryLoading ? "..." : `${cardSummary.lwbpKwh.toLocaleString("id-ID", { maximumFractionDigits: 0 })} kWh`}
            </div>
            <div className="mt-1 text-[10px] font-semibold text-blue-500">{summaryLoading ? "" : formatCurrency(cardSummary.lwbpCost)}</div>
          </div>

          {/* Beban WBP */}
          <div className="rounded-xl border border-rose-500/20 bg-rose-500/5 dark:bg-rose-950/30 p-4 hover:border-rose-400 transition">
            <span className="text-[10px] font-bold uppercase tracking-wider text-rose-500 px-2 py-0.5 rounded bg-rose-500/10 border border-rose-500/20">Beban WBP</span>
            <div className="mt-2 text-lg font-extrabold text-slate-800 dark:text-white font-mono">
              {summaryLoading ? "..." : `${cardSummary.wbpKwh.toLocaleString("id-ID", { maximumFractionDigits: 0 })} kWh`}
            </div>
            <div className="mt-1 text-[10px] font-semibold text-rose-500">{summaryLoading ? "" : formatCurrency(cardSummary.wbpCost)}</div>
          </div>

          {/* PF / Power Factor */}
          <div className="rounded-xl border border-purple-500/20 bg-purple-500/5 dark:bg-purple-950/30 p-4 hover:border-purple-400 transition">
            <span className="text-[10px] font-bold uppercase tracking-wider text-purple-500 px-2 py-0.5 rounded bg-purple-500/10 border border-purple-500/20">PF</span>
            {pfStatus === "offline" ? (
              <div className="mt-2 text-sm font-bold text-red-500 font-mono">API TIDAK TERKIRIM</div>
            ) : (
              <div className="mt-2 text-lg font-extrabold text-slate-800 dark:text-white font-mono">
                {chartLoading ? "..." : livePf !== null ? livePf.toFixed(2) : "..."}
              </div>
            )}
            <div className="mt-1 text-[10px] text-slate-400">Stabilitas beban listrik</div>
          </div>

          {/* Peak Demand */}
          <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 dark:bg-amber-950/30 p-4 hover:border-amber-400 transition">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">Peak Demand</span>
            <div className="mt-2 text-lg font-extrabold text-slate-800 dark:text-white font-mono">
              {summaryLoading ? "..." : `${cardSummary.peakDemand.toLocaleString("id-ID", { maximumFractionDigits: 1 })} kW`}
            </div>
            <div className="mt-1 text-[10px] text-slate-400">Estimasi beban puncak</div>
            {cardSummary.peakDemandTs && (
              <div className="text-[9px] font-bold text-amber-600 dark:text-amber-400 mt-0.5 font-mono">
                {formatPeakTs(cardSummary.peakDemandTs)}
              </div>
            )}
          </div>
        </div>

        {/* Ringkasan Parameter Table */}
        <div className="mt-5 border-t border-slate-100 dark:border-slate-800/80 pt-4">
          <div className="flex items-center gap-2 mb-3">
            <svg className="h-4 w-4 text-sky-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 10h16M4 14h16M4 18h16" />
            </svg>
            <h4 className="text-xs font-extrabold uppercase tracking-wider text-slate-500 dark:text-slate-400">Ringkasan Parameter Incoming PLN 20 kV - Sumber Utama</h4>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-slate-100 dark:border-slate-800 text-[10px] uppercase tracking-wider text-[#47729f] dark:text-slate-500 font-bold">
                  <th className="pb-2.5 px-3">Parameter</th>
                  <th className="pb-2.5 px-3">Nilai</th>
                  <th className="pb-2.5 px-3">Satuan</th>
                  <th className="pb-2.5 px-3">Standar</th>
                  <th className="pb-2.5 px-3 text-right">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 font-semibold text-slate-700 dark:text-slate-300">
                {/* Tegangan */}
                <tr className="hover:bg-slate-50/50 dark:hover:bg-slate-800/10">
                  <td className="py-2.5 px-3">Tegangan</td>
                  <td className="py-2.5 px-3 font-mono">20.07</td>
                  <td className="py-2.5 px-3">kV</td>
                  <td className="py-2.5 px-3 font-mono">20 ± 5%</td>
                  <td className="py-2.5 px-3 text-right">
                    <span className="px-2.5 py-0.5 rounded text-[10px] font-extrabold border bg-emerald-500/10 text-emerald-500 border-emerald-500/20">✓ Normal</span>
                  </td>
                </tr>
                {/* Frekuensi */}
                <tr className="hover:bg-slate-50/50 dark:hover:bg-slate-800/10">
                  <td className="py-2.5 px-3">Frekuensi</td>
                  <td className="py-2.5 px-3 font-mono">49.96</td>
                  <td className="py-2.5 px-3">Hz</td>
                  <td className="py-2.5 px-3 font-mono">50 ± 0.5</td>
                  <td className="py-2.5 px-3 text-right">
                    <span className="px-2.5 py-0.5 rounded text-[10px] font-extrabold border bg-emerald-500/10 text-emerald-500 border-emerald-500/20">✓ Normal</span>
                  </td>
                </tr>
                {/* Active Power */}
                <tr className="hover:bg-slate-50/50 dark:hover:bg-slate-800/10">
                  <td className="py-2.5 px-3">Active Power</td>
                  <td className="py-2.5 px-3 font-mono">2.998</td>
                  <td className="py-2.5 px-3">kW</td>
                  <td className="py-2.5 px-3 font-mono">—</td>
                  <td className="py-2.5 px-3 text-right">
                    <span className="px-2.5 py-0.5 rounded text-[10px] font-extrabold border bg-emerald-500/10 text-emerald-500 border-emerald-500/20">✓ Normal</span>
                  </td>
                </tr>
                {/* Power Factor */}
                <tr className="hover:bg-slate-50/50 dark:hover:bg-slate-800/10">
                  <td className="py-2.5 px-3">Power Factor</td>
                  <td className="py-2.5 px-3 font-mono">0.943</td>
                  <td className="py-2.5 px-3">PF</td>
                  <td className="py-2.5 px-3 font-mono">≥ 0.85</td>
                  <td className="py-2.5 px-3 text-right">
                    <span className="px-2.5 py-0.5 rounded text-[10px] font-extrabold border bg-emerald-500/10 text-emerald-500 border-emerald-500/20">✓ Normal</span>
                  </td>
                </tr>
                {/* Voltage Unbalanced */}
                <tr className="hover:bg-slate-50/50 dark:hover:bg-slate-800/10">
                  <td className="py-2.5 px-3">Voltage Unbalanced</td>
                  <td className="py-2.5 px-3 font-mono">0.95</td>
                  <td className="py-2.5 px-3">%</td>
                  <td className="py-2.5 px-3 font-mono">≤ 2%</td>
                  <td className="py-2.5 px-3 text-right">
                    <span className="px-2.5 py-0.5 rounded text-[10px] font-extrabold border bg-emerald-500/10 text-emerald-500 border-emerald-500/20">✓ Normal</span>
                  </td>
                </tr>
                {/* Current Unbalanced */}
                <tr className="hover:bg-slate-50/50 dark:hover:bg-slate-800/10">
                  <td className="py-2.5 px-3">Current Unbalanced</td>
                  <td className="py-2.5 px-3 font-mono">1.56</td>
                  <td className="py-2.5 px-3">%</td>
                  <td className="py-2.5 px-3 font-mono">≤ 10%</td>
                  <td className="py-2.5 px-3 text-right">
                    <span className="px-2.5 py-0.5 rounded text-[10px] font-extrabold border bg-emerald-500/10 text-emerald-500 border-emerald-500/20">✓ Normal</span>
                  </td>
                </tr>
              </tbody>
            </table>
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
            <DonutChart segments={donutSegments} size={150} thickness={18} centerLabel={`${donutSegments[0]?.value || 0}%`} />
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
        <div className="flex items-center gap-2 mb-4">
          <div className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
          <h3 className="text-xs font-bold uppercase tracking-[0.2em] text-emerald-500">Solar Panel</h3>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 dark:bg-emerald-950/30 p-4">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">Estimasi Biaya</span>
              <div className="h-6 w-6 rounded bg-emerald-500/10 flex items-center justify-center text-emerald-500"><IconMoney /></div>
            </div>
            <div className="mt-2 text-sm font-bold text-red-500 font-mono">API TIDAK TERSEDIA</div>
            <div className="mt-1 text-[10px] font-semibold text-emerald-500">—</div>
          </div>

          <div className="rounded-xl border border-blue-500/20 bg-blue-500/5 dark:bg-blue-950/30 p-4">
            <span className="text-[10px] font-bold uppercase tracking-wider text-blue-500 px-2 py-0.5 rounded bg-blue-500/10 border border-blue-500/20">POI-1</span>
            <div className="mt-2 text-sm font-bold text-red-500 font-mono">API TIDAK TERSEDIA</div>
            <div className="mt-1 text-[10px] font-semibold text-blue-500">—</div>
          </div>

          <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 dark:bg-amber-950/30 p-4">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Peak Demand</span>
            <div className="mt-2 text-sm font-bold text-red-500 font-mono">API TIDAK TERSEDIA</div>
            <div className="mt-1 text-[10px] text-slate-400">Estimasi beban puncak</div>
          </div>

          <div className="rounded-xl border border-cyan-500/20 bg-cyan-500/5 dark:bg-cyan-950/30 p-4">
            <span className="text-[10px] font-bold uppercase tracking-wider text-cyan-500 px-2 py-0.5 rounded bg-cyan-500/10 border border-cyan-500/20">POI-2</span>
            <div className="mt-2 text-sm font-bold text-red-500 font-mono">API TIDAK TERSEDIA</div>
            <div className="mt-1 text-[10px] font-semibold text-cyan-500">—</div>
          </div>

          <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 dark:bg-amber-950/30 p-4">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Peak Demand</span>
            <div className="mt-2 text-sm font-bold text-red-500 font-mono">API TIDAK TERSEDIA</div>
            <div className="mt-1 text-[10px] text-slate-400">Estimasi beban puncak</div>
          </div>
        </div>
      </div>

      {/* ═══════════ SECTION E: SOLAR PANEL CHART + DONUT ═══════════ */}
      <div className="grid gap-6 lg:grid-cols-[2fr_1fr]">
        <section className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
            <div>
              <h3 className="text-sm font-bold uppercase tracking-[0.2em] text-slate-400 dark:text-slate-500">Trend Panel Distribusi</h3>
              <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">Beban Incoming PLN — data historis (WBP & LWBP).</p>
            </div>
          </div>
          <div className="bg-slate-50 dark:bg-slate-950/40 rounded-xl p-4 border border-slate-100 dark:border-slate-800/80 flex items-center justify-center" style={{ height: 256 }}>
            <p className="text-xs text-slate-400 font-semibold">Menunggu integrasi API Solar Panel</p>
          </div>
        </section>
        <section className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-sm flex flex-col justify-between">
          <div>
            <h3 className="text-sm font-bold uppercase tracking-[0.2em] text-slate-400 dark:text-slate-500">Distribusi Beban PLTS</h3>
            <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">Perbandingan POI-1 vs POI-2.</p>
          </div>
          <div className="my-6 flex justify-center">
            <DonutChart segments={[{ label: "POI-1", value: 60, color: "#3b82f6" }, { label: "POI-2", value: 40, color: "#06b6d4" }]} size={150} thickness={18} centerLabel="POI-1 vs POI-2" centerLabelSize="text-[11px]" />
          </div>
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs border-b border-slate-100 dark:border-slate-800/60 pb-1.5">
              <span className="flex items-center gap-2 text-slate-600 dark:text-slate-300 font-medium"><span className="h-2 w-2 rounded-full bg-blue-500" />POI-1</span>
              <span className="font-bold text-red-500 font-mono text-[10px]">API TIDAK TERSEDIA</span>
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="flex items-center gap-2 text-slate-600 dark:text-slate-300 font-medium"><span className="h-2 w-2 rounded-full bg-cyan-500" />POI-2</span>
              <span className="font-bold text-red-500 font-mono text-[10px]">API TIDAK TERSEDIA</span>
            </div>
          </div>
        </section>
      </div>

      {/* ═══════════ SECTION F: INCOMING CUBICLE ═══════════ */}
      <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-sm space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <h3 className="text-sm font-bold text-slate-700 dark:text-white">Dashboard <span className="text-slate-400 dark:text-slate-500">|</span> <span className="text-blue-500">Home</span> <span className="text-slate-400 dark:text-slate-500">›</span> Overview</h3>
          </div>
          <div className="flex items-center gap-2">
            <select value={cubicleSelector} onChange={(e) => setCubicleSelector(e.target.value as "wf1" | "wf2")} className="rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 px-3 py-2 text-xs font-bold text-slate-600 dark:text-slate-300 focus:outline-none focus:ring-2 focus:ring-cyan-500 cursor-pointer">
              <option value="wf1">Incoming Cubicle WF1</option>
              <option value="wf2">Incoming Cubicle WF2</option>
            </select>
            <span className="px-2 py-0.5 rounded text-[10px] font-extrabold uppercase bg-emerald-500/10 text-emerald-500 border border-emerald-500/20">ON</span>
            <button onClick={() => setCubiclePoiView(!cubiclePoiView)} className="px-3 py-1.5 rounded-lg text-[10px] font-bold text-blue-500 bg-blue-500/10 hover:bg-blue-500/20 border border-blue-500/20 transition">
              {cubiclePoiView ? "View: Total kWh" : "View: POI Mode"}
            </button>
          </div>
        </div>

        {/* Cubicle summary cards */}
        <div className="grid gap-3 sm:grid-cols-5">
          <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/30 p-4">
            <div className="text-[10px] font-bold uppercase tracking-wider text-amber-500">Peak Demand</div>
            <div className="mt-1 text-lg font-extrabold text-slate-800 dark:text-white font-mono">
              0 kWh
            </div>
          </div>
          {cubiclePoiView ? (
            <>
              <div className="rounded-xl border border-blue-500/20 bg-blue-500/5 dark:bg-blue-950/30 p-4">
                <span className="text-[10px] font-bold text-blue-500 px-2 py-0.5 rounded bg-blue-500/10 border border-blue-500/20">POI-1</span>
                <div className="mt-1 text-xs font-bold text-red-500 font-mono">API TIDAK TERSEDIA</div>
              </div>
              <div className="rounded-xl border border-cyan-500/20 bg-cyan-500/5 dark:bg-cyan-950/30 p-4">
                <span className="text-[10px] font-bold text-cyan-500 px-2 py-0.5 rounded bg-cyan-500/10 border border-cyan-500/20">POI-2</span>
                <div className="mt-1 text-xs font-bold text-red-500 font-mono">API TIDAK TERSEDIA</div>
              </div>
            </>
          ) : (
            <>
              <div className="rounded-xl border border-blue-500/20 bg-blue-500/5 dark:bg-blue-950/30 p-4">
                <span className="text-[10px] font-bold text-blue-500 px-2 py-0.5 rounded bg-blue-500/10 border border-blue-500/20">LWBP</span>
                <div className="mt-1 text-lg font-extrabold text-slate-800 dark:text-white font-mono">0 kWh</div>
              </div>
              <div className="rounded-xl border border-rose-500/20 bg-rose-500/5 dark:bg-rose-950/30 p-4">
                <span className="text-[10px] font-bold text-rose-500 px-2 py-0.5 rounded bg-rose-500/10 border border-rose-500/20">WBP</span>
                <div className="mt-1 text-lg font-extrabold text-slate-800 dark:text-white font-mono">0 kWh</div>
              </div>
            </>
          )}
          <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/30 p-4">
            <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Monthly Usage</div>
            <div className="mt-1 text-lg font-extrabold text-slate-800 dark:text-white font-mono">0 kWh</div>
          </div>
          <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/30 p-4">
            <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Estimation Cost</div>
            <div className="mt-1 text-base font-extrabold text-slate-800 dark:text-white font-mono">Rp 0,00</div>
          </div>
        </div>

        {/* Cubicle monthly comparison chart */}
        <MonthlyComparisonChart
          title={`Konsumsi Bulanan Real Time (vs Bulan Sebelumnya) — Incoming Cubicle ${cubicleSelector.toUpperCase()}`}
          currentData={dummyMonthlyData}
          previousData={dummyPreviousData}
          isDark={isDark}
        />
      </div>

      {/* ═══════════ SECTION G: ELECTRICITY CONSUMPTION FACT ═══════════ */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* FACT-1 */}
        <section className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-bold uppercase tracking-[0.15em] text-slate-400 dark:text-slate-500">Electricity Consumption Fact-1 (kWh)</h3>
            <button onClick={() => { setEditingFactSide(1); setShowFactEditor(true); }} className="p-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-400 transition">
              <IconSettings />
            </button>
          </div>
          <div className="bg-slate-50 dark:bg-slate-950/40 rounded-xl p-4 border border-slate-100 dark:border-slate-800/80" style={{ height: Math.max(200, factCategories1.filter(c => c.enabled).length * 40 + 60) }}>
            {factCategories1.filter(c => c.enabled).length > 0 ? (
              <Bar data={makeHorizontalBarData(factCategories1)} options={horizontalBarOptions} />
            ) : (
              <div className="h-full flex items-center justify-center text-xs text-slate-400 font-semibold">
                Belum ada kategori. Klik ikon ⚙️ untuk menambahkan.
              </div>
            )}
          </div>
        </section>

        {/* FACT-2 */}
        <section className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-bold uppercase tracking-[0.15em] text-slate-400 dark:text-slate-500">Electricity Consumption Fact-2 (kWh)</h3>
            <button onClick={() => { setEditingFactSide(2); setShowFactEditor(true); }} className="p-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-400 transition">
              <IconSettings />
            </button>
          </div>
          <div className="bg-slate-50 dark:bg-slate-950/40 rounded-xl p-4 border border-slate-100 dark:border-slate-800/80" style={{ height: Math.max(200, factCategories2.filter(c => c.enabled).length * 40 + 60) }}>
            {factCategories2.filter(c => c.enabled).length > 0 ? (
              <Bar data={makeHorizontalBarData(factCategories2)} options={horizontalBarOptions} />
            ) : (
              <div className="h-full flex items-center justify-center text-xs text-slate-400 font-semibold">
                Belum ada kategori. Klik ikon ⚙️ untuk menambahkan.
              </div>
            )}
          </div>
        </section>
      </div>

      {/* ═══════════ SECTION H: EQUIPMENT MONTHLY CHARTS ═══════════ */}
      <div className="space-y-8">
        <h3 className="text-sm font-bold uppercase tracking-[0.2em] text-slate-400 dark:text-slate-500 border-b border-slate-200 dark:border-slate-800 pb-2">
          Konsumsi Per-Equipment (Bulanan vs Bulan Sebelumnya)
        </h3>

        {/* Cooling Tower Section */}
        <div className="space-y-3">
          <h4 className="text-xs font-bold uppercase tracking-wider text-sky-500">● Cooling Tower</h4>
          <div className="grid gap-6 md:grid-cols-2">
            <MonthlyComparisonChart title="Cooling Tower WF1" currentData={dummyMonthlyData} previousData={dummyPreviousData} isDark={isDark} />
            <MonthlyComparisonChart title="Cooling Tower WF2" currentData={dummyMonthlyData} previousData={dummyPreviousData} isDark={isDark} />
          </div>
        </div>

        {/* Boiler Section */}
        <div className="space-y-3">
          <h4 className="text-xs font-bold uppercase tracking-wider text-sky-500">● Boiler</h4>
          <div className="grid gap-6 md:grid-cols-3">
            <MonthlyComparisonChart title="Boiler 3 WF1" currentData={dummyMonthlyData} previousData={dummyPreviousData} isDark={isDark} />
            <MonthlyComparisonChart title="Boiler 4" currentData={dummyMonthlyData} previousData={dummyPreviousData} isDark={isDark} />
            <MonthlyComparisonChart title="Boiler 5" currentData={dummyMonthlyData} previousData={dummyPreviousData} isDark={isDark} />
          </div>
        </div>

        {/* Compressed Air Section */}
        <div className="space-y-3">
          <h4 className="text-xs font-bold uppercase tracking-wider text-sky-500">● Compressed Air</h4>
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            <MonthlyComparisonChart title="Compressed Air WF1 — ALE-30" currentData={dummyMonthlyData} previousData={dummyPreviousData} isDark={isDark} />
            <MonthlyComparisonChart title="Compressed Air WF1 — ZT-30.1" currentData={dummyMonthlyData} previousData={dummyPreviousData} isDark={isDark} />
            <MonthlyComparisonChart title="Compressed Air WF1 — ZT-30.2" currentData={dummyMonthlyData} previousData={dummyPreviousData} isDark={isDark} />
            <MonthlyComparisonChart title="Compressed Air WF1 — ZT-55" currentData={dummyMonthlyData} previousData={dummyPreviousData} isDark={isDark} />
            <MonthlyComparisonChart title="Compressed Air WF2 — ALE-250" currentData={dummyMonthlyData} previousData={dummyPreviousData} isDark={isDark} />
            <MonthlyComparisonChart title="Compressed Air WF2 — ZT-110" currentData={dummyMonthlyData} previousData={dummyPreviousData} isDark={isDark} />
          </div>
        </div>

        {/* Chiller Section */}
        <div className="space-y-3">
          <h4 className="text-xs font-bold uppercase tracking-wider text-sky-500">● Chiller</h4>
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            <MonthlyComparisonChart title="Chiller WF1 — Daikin-1" currentData={dummyMonthlyData} previousData={dummyPreviousData} isDark={isDark} />
            <MonthlyComparisonChart title="Chiller WF1 — Daikin-2" currentData={dummyMonthlyData} previousData={dummyPreviousData} isDark={isDark} />
            <MonthlyComparisonChart title="Chiller WF1 — Trane-CGAM40" currentData={dummyMonthlyData} previousData={dummyPreviousData} isDark={isDark} />
            <MonthlyComparisonChart title="Chiller WF2 — Trane-100" currentData={dummyMonthlyData} previousData={dummyPreviousData} isDark={isDark} />
            <MonthlyComparisonChart title="Chiller WF2 — Trane-275" currentData={dummyMonthlyData} previousData={dummyPreviousData} isDark={isDark} />
          </div>
        </div>

        {/* Chiller HVAC & Warehouse Section */}
        <div className="space-y-3">
          <h4 className="text-xs font-bold uppercase tracking-wider text-sky-500">● Chiller HVAC & Warehouse</h4>
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            <MonthlyComparisonChart title="Chiller HVAC WF2 — Trane-250" currentData={dummyMonthlyData} previousData={dummyPreviousData} isDark={isDark} />
            <MonthlyComparisonChart title="Chiller HVAC WF2 — Trane-185" currentData={dummyMonthlyData} previousData={dummyPreviousData} isDark={isDark} />
            <MonthlyComparisonChart title="HVAC Warehouse — WH-2" currentData={dummyMonthlyData} previousData={dummyPreviousData} isDark={isDark} />
            <MonthlyComparisonChart title="HVAC Warehouse — WH-3" currentData={dummyMonthlyData} previousData={dummyPreviousData} isDark={isDark} />
            <MonthlyComparisonChart title="HVAC Warehouse — WH-4" currentData={dummyMonthlyData} previousData={dummyPreviousData} isDark={isDark} />
            <MonthlyComparisonChart title="HVAC Warehouse — WH-5" currentData={dummyMonthlyData} previousData={dummyPreviousData} isDark={isDark} />
            <MonthlyComparisonChart title="HVAC Warehouse — WH-6" currentData={dummyMonthlyData} previousData={dummyPreviousData} isDark={isDark} />
            <MonthlyComparisonChart title="HVAC Warehouse — WH-7" currentData={dummyMonthlyData} previousData={dummyPreviousData} isDark={isDark} />
          </div>
        </div>

        {/* HVAC QC & Produksi Section */}
        <div className="space-y-3">
          <h4 className="text-xs font-bold uppercase tracking-wider text-sky-500">● HVAC QC & Produksi</h4>
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            <MonthlyComparisonChart title="HVAC QC — Micro" currentData={dummyMonthlyData} previousData={dummyPreviousData} isDark={isDark} />
            <MonthlyComparisonChart title="HVAC QC — Retained Sample" currentData={dummyMonthlyData} previousData={dummyPreviousData} isDark={isDark} />
            <MonthlyComparisonChart title="HVAC QC — Sampling" currentData={dummyMonthlyData} previousData={dummyPreviousData} isDark={isDark} />
            <MonthlyComparisonChart title="HVAC Produksi — WF1-U3" currentData={dummyMonthlyData} previousData={dummyPreviousData} isDark={isDark} />
            <MonthlyComparisonChart title="HVAC Produksi — WF2-U1" currentData={dummyMonthlyData} previousData={dummyPreviousData} isDark={isDark} />
            <MonthlyComparisonChart title="HVAC Produksi — WF2-U2" currentData={dummyMonthlyData} previousData={dummyPreviousData} isDark={isDark} />
          </div>
        </div>

        {/* Dynamic Selection Chart (Sesuai Pilihan) */}
        <DynamicSelectionChart isDark={isDark} />
      </div>

      {/* ═══════════ CONSUMPTION FACT EDITOR MODAL ═══════════ */}
      {showFactEditor && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm" onClick={() => setShowFactEditor(false)}>
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl w-full max-w-lg p-6 space-y-4" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold uppercase tracking-wide text-slate-700 dark:text-white">
                Edit Consumption Fact-{editingFactSide}
              </h3>
              <button onClick={() => setShowFactEditor(false)} className="text-slate-400 hover:text-slate-600 text-lg font-bold">✕</button>
            </div>

            {/* Existing categories */}
            <div className="space-y-2 max-h-60 overflow-y-auto">
              {(editingFactSide === 1 ? factCategories1 : factCategories2).map((cat) => (
                <div key={cat.id} className="flex items-center justify-between px-3 py-2 bg-slate-50 dark:bg-slate-800/40 rounded-lg border border-slate-200 dark:border-slate-700">
                  <div>
                    <span className="text-xs font-bold text-slate-700 dark:text-slate-200">{cat.label}</span>
                    <span className="ml-2 text-[10px] text-slate-400 font-mono">{cat.value?.kWh ?? 0} kWh</span>
                  </div>
                  <button onClick={() => handleDeleteCategory(cat.id, editingFactSide)} className="px-2 py-0.5 text-[10px] font-bold text-rose-500 bg-rose-500/10 rounded hover:bg-rose-500/20 transition">
                    Hapus
                  </button>
                </div>
              ))}
              {(editingFactSide === 1 ? factCategories1 : factCategories2).length === 0 && (
                <p className="text-xs text-slate-400 text-center py-4">Belum ada kategori.</p>
              )}
            </div>

            {/* Add new category */}
            <div className="border-t border-slate-200 dark:border-slate-800 pt-4">
              <h4 className="text-xs font-bold text-slate-500 mb-2">Tambah Kategori Baru</h4>
              <div className="grid grid-cols-3 gap-2">
                <input value={newCatKey} onChange={(e) => setNewCatKey(e.target.value)} placeholder="Key (e.g. production)" className="px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-mono outline-none focus:ring-1 focus:ring-blue-500" />
                <input value={newCatLabel} onChange={(e) => setNewCatLabel(e.target.value)} placeholder="Label (e.g. Production)" className="px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-semibold outline-none focus:ring-1 focus:ring-blue-500" />
                <input value={newCatValue} onChange={(e) => setNewCatValue(e.target.value)} placeholder="kWh (e.g. 170967)" type="number" className="px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-mono outline-none focus:ring-1 focus:ring-blue-500" />
              </div>
              <button onClick={handleAddCategory} disabled={!newCatKey.trim() || !newCatLabel.trim()} className="mt-3 w-full px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-xs font-bold rounded-lg shadow transition">
                + Tambah Kategori
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ═══════════ CONFIGURATION PANEL (API Sources) ═══════════ */}
      {showConfigPanel && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm" onClick={() => setShowConfigPanel(false)}>
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl w-full max-w-3xl p-6 space-y-4 max-h-[80vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold uppercase tracking-wide text-slate-700 dark:text-white">Konfigurasi Electricity Dashboard</h3>
                <p className="text-xs text-slate-400 mt-0.5">Kelola API Sources, Chart Data Sources, dan kategori untuk halaman Electricity.</p>
              </div>
              <button onClick={() => setShowConfigPanel(false)} className="text-slate-400 hover:text-slate-600 text-lg font-bold">✕</button>
            </div>

            {/* API Sources for Electricity */}
            <div className="border border-slate-200 dark:border-slate-800 rounded-xl p-5 space-y-4">
              <ApiSourcesPanel unitId="electricity" />
            </div>

            {/* Quick management for consumption fact categories */}
            <div className="border border-slate-200 dark:border-slate-800 rounded-xl p-4 space-y-3">
              <h4 className="text-xs font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">Consumption Fact Categories</h4>
              <div className="grid grid-cols-2 gap-3">
                <button onClick={() => { setEditingFactSide(1); setShowFactEditor(true); setShowConfigPanel(false); }} className="px-4 py-3 rounded-lg bg-blue-500/10 hover:bg-blue-500/20 border border-blue-500/20 text-xs font-bold text-blue-500 transition">
                  Edit Fact-1 Categories ({factCategories1.length} items)
                </button>
                <button onClick={() => { setEditingFactSide(2); setShowFactEditor(true); setShowConfigPanel(false); }} className="px-4 py-3 rounded-lg bg-cyan-500/10 hover:bg-cyan-500/20 border border-cyan-500/20 text-xs font-bold text-cyan-500 transition">
                  Edit Fact-2 Categories ({factCategories2.length} items)
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
