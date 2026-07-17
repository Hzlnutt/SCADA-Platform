import { useCallback, useEffect, useMemo, useState } from "react";
import { PageHeader } from "../../components/ui/PageHeader";
import { Bar } from "react-chartjs-2";
import "../../components/charts/chartjs";
import { DonutChart } from "../../components/charts/DonutChart";
import { machineGroups } from "../../data/machines";
import { buildTimeAwareSeries, buildTimeLabels, getElapsedIndex } from "../../utils/series";
import { getJson } from "../../services/api.client";
import { getSocket } from "../../services/socket.service";
import { useSystemStore } from "../../store/system.store";

const dailyEnergyTotal = machineGroups.reduce((sum, group) => {
  const energy = group.summaryCards.find((card) => card.label === "Total Energy")?.value ?? 0;
  return sum + energy;
}, 0);

const waterBase = dailyEnergyTotal / 25;
const waterRate = 12000; // Rp 12.000 per m3

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
  new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(value);

const getLocalTodayString = () => {
  const d = new Date();
  const yr = d.getFullYear();
  const mo = String(d.getMonth() + 1).padStart(2, "0");
  const dy = String(d.getDate()).padStart(2, "0");
  return `${yr}-${mo}-${dy}`;
};

export default function Water() {
  const [range, setRange] = useState<(typeof ranges)[number]["id"]>("ytd");
  const [selectedDevice, setSelectedDevice] = useState<string>("all");
  const [selectedYear, setSelectedYear] = useState(() => new Date().getFullYear());
  const [selectedMonth, setSelectedMonth] = useState(() => new Date().getMonth()); // 0-indexed
  const config = ranges.find((item) => item.id === range) ?? ranges[0];

  // Custom start and end dates for charts (default to today)
  const [chartStartDate, setChartStartDate] = useState(getLocalTodayString);
  const [chartEndDate, setChartEndDate] = useState(getLocalTodayString);

  const maxIdx = useMemo(() => getElapsedIndex(config.type), [config.type]);

  const [chartData, setChartData] = useState<any>(null);
  const [chartLoading, setChartLoading] = useState(true);

  const theme = useSystemStore((state) => state.theme);
  const isDark = theme === "dark";

  // Fetch summary and chart data in one query call
  const fetchData = useCallback((showLoading = false) => {
    if (showLoading) setChartLoading(true);

    let url = `/analytics/water?`;
    if (selectedDevice !== "all") {
      url += `deviceId=${selectedDevice}&`;
    }

    if (range === "custom") {
      url += `from=${chartStartDate}&to=${chartEndDate}`;
    } else if (range === "hour") {
      const todayStr = getLocalTodayString();
      url += `from=${todayStr}&to=${todayStr}`;
    } else {
      url += `year=${selectedYear}`;
    }
    url += `&_t=${Date.now()}`;

    getJson<{ data: any }>(url)
      .then((res) => {
        setChartData(res.data);
        if (showLoading) setChartLoading(false);
      })
      .catch((err) => {
        console.error("Failed to load water consumption analytics data", err);
        if (showLoading) setChartLoading(false);
      });
  }, [range, selectedDevice, selectedYear, chartStartDate, chartEndDate]);

  useEffect(() => {
    fetchData(true);
  }, [fetchData]);

  // Handle auto-fetch and socket event triggers
  useEffect(() => {
    let active = true;

    const interval = setInterval(() => {
      if (active) {
        fetchData(false);
      }
    }, 5000);

    const socket = getSocket();

    const handleWaterUpdate = () => {
      console.log("Water telemetry update event received, re-fetching dashboard...");
      if (active) {
        fetchData(false);
      }
    };

    socket.on("water:update", handleWaterUpdate);

    return () => {
      active = false;
      clearInterval(interval);
      socket.off("water:update", handleWaterUpdate);
    };
  }, [fetchData]);

  const hasChartData = !!chartData;
  const currentMonth = selectedMonth + 1; // 1-indexed

  const monthlyDailyRecords = useMemo(() => {
    if (hasChartData && chartData.charts.daily) {
      const monthPrefix = `${selectedYear}-${String(currentMonth).padStart(2, "0")}`;
      return chartData.charts.daily.filter((d: any) => d.day.startsWith(monthPrefix));
    }
    return [];
  }, [hasChartData, chartData, selectedYear, currentMonth]);

  const customDailyRecords = useMemo(() => {
    if (hasChartData && chartData.charts.daily) {
      if (range === "custom") {
        return chartData.charts.daily.filter((d: any) => d.day >= chartStartDate && d.day <= chartEndDate);
      }
    }
    return [];
  }, [hasChartData, chartData, range, chartStartDate, chartEndDate]);

  // Total flow computed based on selected view mode
  const total = useMemo(() => {
    if (hasChartData) {
      if (range === "hour") {
        return chartData.summary.todayM3;
      } else if (range === "day") {
        return monthlyDailyRecords.reduce((sum: number, curr: any) => sum + curr.value, 0);
      } else if (range === "custom") {
        if (chartStartDate === chartEndDate) {
          return chartData.summary.todayM3;
        }
        return customDailyRecords.reduce((sum: number, curr: any) => sum + curr.value, 0);
      } else {
        // YTD / Per Bulan
        return chartData.summary.yearlyM3;
      }
    }
    return waterBase * config.scale;
  }, [hasChartData, chartData, range, monthlyDailyRecords, customDailyRecords, chartStartDate, chartEndDate, config.scale]);

  const cost = total * waterRate;

  // Max value of selected range
  const peak = useMemo(() => {
    if (hasChartData) {
      if (range === "hour" || (range === "custom" && chartStartDate === chartEndDate)) {
        const hourlyVals = chartData.charts.hourly || [];
        return hourlyVals.length > 0 ? Math.max(...hourlyVals) : 0;
      } else if (range === "day") {
        const vals = monthlyDailyRecords.map((d: any) => d.value);
        return vals.length > 0 ? Math.max(...vals) : 0;
      } else if (range === "custom") {
        const vals = customDailyRecords.map((d: any) => d.value);
        return vals.length > 0 ? Math.max(...vals) : 0;
      } else {
        const vals = chartData.charts.monthly.map((m: any) => m.value);
        return vals.length > 0 ? Math.max(...vals) : 0;
      }
    }
    return 15.5;
  }, [hasChartData, chartData, range, monthlyDailyRecords, customDailyRecords, chartStartDate, chartEndDate]);

  const recycleRatio = 32;

  // ========== BAR LABELS ==========
  const barLabels = useMemo(() => {
    if (hasChartData) {
      if (range === "hour" || (range === "custom" && chartStartDate === chartEndDate)) {
        return Array.from({ length: 24 }, (_, i) => `${(i + 1).toString().padStart(2, "0")}:00`);
      } else if (range === "day") {
        return monthlyDailyRecords.map((d: any) => {
          const parts = d.day.split("-");
          return `${parts[2]}`; // day number
        });
      } else if (range === "custom") {
        const firstDay = customDailyRecords[0]?.day;
        const lastDay = customDailyRecords[customDailyRecords.length - 1]?.day;
        const isSameMonth = firstDay && lastDay && firstDay.substring(0, 7) === lastDay.substring(0, 7);
        return customDailyRecords.map((d: any) => {
          const parts = d.day.split("-");
          return isSameMonth ? parts[2] : `${parts[2]}/${parts[1]}`;
        });
      } else {
        // YTD / Per Bulan: "Jan 2026", "Feb 2026", etc.
        return chartData.charts.monthly.map((m: any) => {
          const [yr, mo] = m.month.split("-").map(Number);
          return `${MONTH_SHORT_ID[mo - 1]} ${yr}`;
        });
      }
    }
    return buildTimeLabels(config.points, config.type);
  }, [hasChartData, range, config, chartData, monthlyDailyRecords, customDailyRecords, chartStartDate, chartEndDate]);

  // ========== BAR CHART DATA + OPTIONS ==========
  const barDatasets = useMemo(() => {
    if (!hasChartData) {
      const base = waterBase * config.scale;
      const data = buildTimeAwareSeries(config.points, base, base * 0.25, 3, maxIdx).map((v) => v ?? 0);
      return [{
        label: "Konsumsi Air (m³)",
        data,
        backgroundColor: "rgba(14, 165, 233, 0.8)",
        hoverBackgroundColor: "rgba(14, 165, 233, 1)",
        borderWidth: 0,
        borderRadius: 4,
        barPercentage: 0.65
      }];
    }

    const colors = [
      { bg: "rgba(14, 165, 233, 0.8)", hover: "rgba(14, 165, 233, 1)" },
      { bg: "rgba(16, 185, 129, 0.8)", hover: "rgba(16, 185, 129, 1)" },
      { bg: "rgba(245, 158, 11, 0.8)", hover: "rgba(245, 158, 11, 1)" },
    ];

    let devicesToRender = chartData.devices || [];
    if (selectedDevice !== "all") {
      devicesToRender = [selectedDevice];
    }

    return devicesToRender.map((deviceId: string, index: number) => {
      let dataValues: number[] = [];
      const color = colors[index % colors.length];

      if (range === "hour") {
        const devData = chartData.charts.perDeviceHourly?.find((d: any) => d.deviceId === deviceId);
        dataValues = devData ? devData.hourly : [];
      } else if (range === "day") {
        const devData = chartData.charts.perDeviceDaily?.find((d: any) => d.deviceId === deviceId);
        if (devData) {
          const monthPrefix = `${selectedYear}-${String(currentMonth).padStart(2, "0")}`;
          dataValues = devData.daily.filter((d: any) => d.day.startsWith(monthPrefix)).map((d: any) => d.value);
        }
      } else if (range === "custom") {
        if (chartStartDate === chartEndDate) {
          const devData = chartData.charts.perDeviceHourly?.find((d: any) => d.deviceId === deviceId);
          dataValues = devData ? devData.hourly : [];
        } else {
          const devData = chartData.charts.perDeviceDaily?.find((d: any) => d.deviceId === deviceId);
          if (devData) {
            dataValues = devData.daily.filter((d: any) => d.day >= chartStartDate && d.day <= chartEndDate).map((d: any) => d.value);
          }
        }
      } else {
        // YTD and Per Bulan: monthly sum
        const devData = chartData.charts.perDeviceMonthly?.find((d: any) => d.deviceId === deviceId);
        dataValues = devData ? devData.monthly.map((m: any) => m.value) : [];
      }

      return {
        label: deviceId.toUpperCase(),
        data: dataValues,
        backgroundColor: color.bg,
        hoverBackgroundColor: color.hover,
        borderWidth: 0,
        borderRadius: 4,
        barPercentage: 0.65
      };
    });
  }, [hasChartData, range, config, chartData, maxIdx, selectedDevice, chartStartDate, chartEndDate, selectedYear, currentMonth]);

  const barChartData = {
    labels: barLabels,
    datasets: barDatasets
  };

  const barChartOptions: any = {
    responsive: true,
    maintainAspectRatio: false,
    animation: { duration: 0 },
    hover: { mode: "index" as const, intersect: false },
    interaction: { mode: "index" as const, intersect: false },
    plugins: {
      legend: {
        display: true,
        position: "top" as const,
        align: "end" as const,
        labels: {
          color: isDark ? "rgba(148, 163, 184, 0.9)" : "rgba(71, 85, 105, 0.9)",
          font: { size: 10, family: "Plus Jakarta Sans", weight: "600" as const },
          usePointStyle: true,
          pointStyle: "rectRounded",
          padding: 12
        }
      },
      tooltip: {
        backgroundColor: isDark ? "rgba(13, 21, 39, 0.95)" : "rgba(255, 255, 255, 0.95)",
        titleColor: isDark ? "rgba(241, 245, 249, 0.9)" : "rgba(15, 23, 42, 0.9)",
        bodyColor: isDark ? "rgba(241, 245, 249, 0.9)" : "rgba(15, 23, 42, 0.9)",
        borderColor: isDark ? "rgba(51, 65, 85, 0.5)" : "rgba(203, 213, 225, 0.5)",
        borderWidth: 1,
        padding: 12,
        bodyFont: { family: "IBM Plex Mono, monospace", size: 11 },
        titleFont: { family: "Plus Jakarta Sans", size: 11, weight: "600" as const },
        callbacks: {
          label: (context: any) => `${context.dataset.label}: ${Number(context.raw).toLocaleString("id-ID", { maximumFractionDigits: 1 })} m³`,
          footer: (tooltipItems: any) => {
            if (tooltipItems.length > 1) {
              const total = tooltipItems.reduce((acc: number, item: any) => acc + item.raw, 0);
              return `\nTotal: ${total.toLocaleString("id-ID", { maximumFractionDigits: 1 })} m³`;
            }
            return "";
          }
        }
      }
    },
    scales: {
      x: {
        stacked: true,
        grid: { display: false },
        ticks: {
          color: isDark ? "rgba(148, 163, 184, 0.7)" : "rgba(71, 85, 105, 0.7)",
          font: { size: 9, family: "IBM Plex Mono" }
        }
      },
      y: {
        stacked: true,
        grid: { color: isDark ? "rgba(51, 65, 85, 0.2)" : "rgba(226, 232, 240, 0.6)" },
        border: { dash: [4, 4] },
        ticks: {
          color: isDark ? "rgba(148, 163, 184, 0.7)" : "rgba(71, 85, 105, 0.7)",
          font: { size: 9, family: "IBM Plex Mono" },
          callback: (value: any) => `${value.toLocaleString("id-ID")} m³`
        }
      }
    }
  };

  const donutSegments = useMemo(() => [
    { label: "RO Plant", value: 45, color: "#0ea5e9" },
    { label: "Cooling Tower", value: 35, color: "#10b981" },
    { label: "Domestic/Sanitation", value: 20, color: "#f59e0b" }
  ], []);

  const deviceOptions = useMemo(() => {
    if (hasChartData && chartData.devices) {
      return ["all", ...chartData.devices];
    }
    return ["all", "dw3"];
  }, [hasChartData, chartData]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <PageHeader title="Air" description="Pantau konsumsi air proses, utilitas, dan biaya per periode secara real-time." />

        {/* Global Toolbar */}
        <div className="flex flex-wrap items-center gap-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-2.5 rounded-xl shadow-sm">
          {/* Device Selection Dropdown */}
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Sumur</span>
            <select
              value={selectedDevice}
              onChange={(e) => setSelectedDevice(e.target.value)}
              className="rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 px-2.5 py-1.5 text-xs font-bold text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-cyan-500 cursor-pointer"
            >
              {deviceOptions.map((opt) => (
                <option key={opt} value={opt}>
                  {opt === "all" ? "Semua Sumur" : opt.toUpperCase()}
                </option>
              ))}
            </select>
          </div>

          {/* Year selector (hidden if range is custom or hour) */}
          {range !== "custom" && range !== "hour" && (
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Tahun</span>
              <select
                value={selectedYear}
                onChange={(e) => setSelectedYear(Number(e.target.value))}
                className="rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 px-2.5 py-1.5 text-xs font-bold text-slate-700 dark:text-slate-200 focus:outline-none"
              >
                {AVAILABLE_YEARS.map((yr) => (
                  <option key={yr} value={yr}>
                    {yr}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Month selector if range is 'day' */}
          {range === "day" && (
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Bulan</span>
              <select
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(Number(e.target.value))}
                className="rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 px-2.5 py-1.5 text-xs font-bold text-slate-700 dark:text-slate-200 focus:outline-none"
              >
                {MONTH_NAMES_ID.map((name, i) => (
                  <option key={name} value={i}>
                    {name}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>
      </div>

      {/* Executive Summary */}
      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-sm transition hover:shadow-md hover:border-sky-400 dark:hover:border-sky-500">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-[0.2em] text-slate-400 dark:text-slate-500">Total Biaya</span>
            <span className="text-lg">💧</span>
          </div>
          <div className="mt-3 text-2xl font-extrabold text-slate-800 dark:text-white font-mono">
            {chartLoading ? "Loading..." : formatCurrency(cost)}
          </div>
          <div className="mt-1 text-xs font-semibold text-sky-600 dark:text-sky-400">
            {chartLoading ? "..." : total.toLocaleString("id-ID", { maximumFractionDigits: 1 })} m³
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-sm transition hover:shadow-md hover:border-blue-400 dark:hover:border-blue-500">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-[0.2em] text-slate-400 dark:text-slate-500">Peak Usage</span>
            <span className="text-lg">🌊</span>
          </div>
          <div className="mt-3 text-2xl font-extrabold text-slate-800 dark:text-white font-mono">
            {chartLoading ? "Loading..." : `${peak.toLocaleString("id-ID", { maximumFractionDigits: 1 })} m³`}
          </div>
          <div className="mt-1 text-xs text-slate-400 dark:text-slate-500">Kebutuhan puncak aliran air</div>
        </div>

        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-sm transition hover:shadow-md hover:border-emerald-400 dark:hover:border-emerald-500">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-[0.2em] text-slate-400 dark:text-slate-500">Recycle Ratio</span>
            <span className="text-lg">🔄</span>
          </div>
          <div className="mt-3 text-2xl font-extrabold text-emerald-600 dark:text-emerald-400 font-mono">{recycleRatio}%</div>
          <div className="mt-1 text-xs text-slate-400 dark:text-slate-500">Rasio pemakaian ulang air</div>
        </div>

        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-sm transition hover:shadow-md hover:border-cyan-400 dark:hover:border-cyan-500">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-[0.2em] text-slate-400 dark:text-slate-500">Tarif</span>
            <span className="text-lg">🏷️</span>
          </div>
          <div className="mt-3 text-2xl font-extrabold text-slate-800 dark:text-white font-mono">{formatCurrency(waterRate)}</div>
          <div className="mt-1 text-xs text-slate-400 dark:text-slate-500">Per m³</div>
        </div>
      </section>

      {/* Main Bar Chart + Donut */}
      <div className="grid gap-6 lg:grid-cols-[2fr_1fr]">
        <section className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
              <div>
                <h3 className="text-sm font-bold uppercase tracking-[0.2em] text-slate-400 dark:text-slate-500">Beban Konsumsi Air</h3>
                <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">Tren konsumsi air dari sumur proses.</p>
              </div>

              {/* Custom Date Range Picker */}
              {range === "custom" && (
                <div className="flex items-center gap-1.5 bg-slate-50 dark:bg-slate-800/20 px-2 py-1 rounded-lg border border-slate-100 dark:border-slate-800/80">
                  <input
                    type="date"
                    value={chartStartDate}
                    onChange={(e) => setChartStartDate(e.target.value)}
                    className="rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 px-3 py-1.5 text-xs font-bold text-slate-600 dark:text-slate-300 focus:outline-none focus:ring-2 focus:ring-cyan-500 cursor-pointer transition"
                  />
                  <span className="text-xs font-bold text-slate-400">s/d</span>
                  <input
                    type="date"
                    value={chartEndDate}
                    onChange={(e) => setChartEndDate(e.target.value)}
                    className="rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 px-3 py-1.5 text-xs font-bold text-slate-600 dark:text-slate-300 focus:outline-none focus:ring-2 focus:ring-cyan-500 cursor-pointer transition"
                  />
                </div>
              )}

              {/* Range Selector */}
              <div className="flex items-center gap-1 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 p-0.5 text-xs">
                {ranges.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setRange(item.id)}
                    className={`rounded-md px-3 py-1.5 font-bold transition-all ${
                      range === item.id
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

          <div className="bg-slate-50 dark:bg-slate-950/40 rounded-xl p-4 border border-slate-100 dark:border-slate-800/80">
            <div style={{ height: 256 }}>
              {chartLoading ? (
                <div className="h-full flex items-center justify-center text-slate-400 font-bold text-sm">
                  Loading Chart...
                </div>
              ) : (
                <Bar data={barChartData} options={barChartOptions} />
              )}
            </div>
          </div>
        </section>

        <section className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-sm flex flex-col justify-between">
          <div>
            <h3 className="text-sm font-bold uppercase tracking-[0.2em] text-slate-400 dark:text-slate-500">Distribusi Air</h3>
            <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">RO Plant, Cooling Tower, Domestic.</p>
          </div>
          <div className="my-6 flex justify-center">
            <DonutChart segments={donutSegments} size={150} thickness={18} centerLabel="100%" />
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

      {/* Parameters */}
      <section className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-sm">
        <h3 className="text-sm font-bold uppercase tracking-[0.2em] text-slate-400 dark:text-slate-500 mb-4">Parameter & Rate Limit</h3>
        <div className="grid gap-4 sm:grid-cols-3">
          <div className="rounded-xl border border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/30 p-4 transition hover:border-cyan-400">
            <div className="text-xs text-slate-400 dark:text-slate-500">Recycle Target</div>
            <div className="mt-1 text-lg font-bold text-slate-800 dark:text-white font-mono">&gt; 30%</div>
          </div>
          <div className="rounded-xl border border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/30 p-4 transition hover:border-cyan-400">
            <div className="text-xs text-slate-400 dark:text-slate-500">Daily Limit Quota</div>
            <div className="mt-1 text-lg font-bold text-slate-800 dark:text-white font-mono">850 m³/day</div>
          </div>
          <div className="rounded-xl border border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/30 p-4 transition hover:border-cyan-400">
            <div className="text-xs text-slate-400 dark:text-slate-500">Quality Standard</div>
            <div className="mt-1 text-lg font-bold text-slate-800 dark:text-white font-mono">Permenkes 492/2010</div>
          </div>
        </div>
      </section>

      {/* Per Device Consumption Summary Table */}
      {hasChartData && chartData.summary.perDeviceSummary && chartData.summary.perDeviceSummary.length > 0 && (
        <section className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-sm">
          <h3 className="text-sm font-bold uppercase tracking-[0.2em] text-slate-400 dark:text-slate-500 mb-3">Detail Konsumsi per Sumur</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-slate-100 dark:border-slate-800 text-slate-400 dark:text-slate-500 font-bold uppercase tracking-wider">
                  <th className="py-2.5 px-3">ID Device</th>
                  <th className="py-2.5 px-3">Hari Ini (m³)</th>
                  <th className="py-2.5 px-3">Bulan Ini (m³)</th>
                  <th className="py-2.5 px-3">Total Akumulasi (m³)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/50">
                {chartData.summary.perDeviceSummary.map((dev: any) => (
                  <tr key={dev.deviceId} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/20 transition">
                    <td className="py-3 px-3 font-bold text-slate-800 dark:text-slate-200">{dev.deviceId.toUpperCase()}</td>
                    <td className="py-3 px-3 font-mono text-slate-600 dark:text-slate-400">{dev.todayM3.toLocaleString("id-ID")} m³</td>
                    <td className="py-3 px-3 font-mono text-slate-600 dark:text-slate-400">{dev.monthlyM3.toLocaleString("id-ID")} m³</td>
                    <td className="py-3 px-3 font-mono font-bold text-slate-800 dark:text-white">{dev.totalM3.toLocaleString("id-ID")} m³</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  );
}
