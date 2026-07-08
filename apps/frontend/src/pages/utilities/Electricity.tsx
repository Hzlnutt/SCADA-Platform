import { useEffect, useMemo, useState } from "react";
import { PageHeader } from "../../components/ui/PageHeader";
import { UtilityBarChart } from "../../components/charts/UtilityBarChart";
import { Bar } from "react-chartjs-2";
import "../../components/charts/chartjs";
import { DonutChart } from "../../components/charts/DonutChart";
import { machineGroups } from "../../data/machines";
import { buildTimeAwareSeries, buildTimeLabels, getElapsedIndex } from "../../utils/series";
import { getJson } from "../../services/api.client";
import { useConfigStore } from "../../store/config.store";

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
  { id: "month", label: "Per Bulan", points: 12, type: "month" as const, scale: 30 }
] as const;

const formatCurrency = (value: number) =>
  new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value);

export default function Electricity() {
  const [range, setRange] = useState<(typeof ranges)[number]["id"]>("ytd");
  const [selectedYear, setSelectedYear] = useState(() => new Date().getFullYear());
  const config = ranges.find((item) => item.id === range) ?? ranges[0];

  const maxIdx = useMemo(() => getElapsedIndex(config.type), [config.type]);

  const [plnData, setPlnData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  // Retrieve custom rates from useConfigStore
  const wbpRate = useConfigStore((state) => state.wbpRate);
  const lwbpRate = useConfigStore((state) => state.lwbpRate);

  // Re-fetch when year changes or every 30 seconds (auto-fetch)
  useEffect(() => {
    let active = true;

    const fetchData = (showLoading = false) => {
      if (showLoading) setLoading(true);
      getJson<{ data: any }>(`/analytics/electricity?deviceId=Cubicle_PLN_PM8000&year=${selectedYear}&wbpRate=${wbpRate}&lwbpRate=${lwbpRate}`)
        .then((res) => {
          if (active) {
            setPlnData(res.data);
            if (showLoading) setLoading(false);
          }
        })
        .catch((err) => {
          console.error("Failed to load electricity analytics", err);
          if (active && showLoading) setLoading(false);
        });
    };

    fetchData(true);

    const interval = setInterval(() => {
      fetchData(false); // auto-fetch silently in background
    }, 30000); // every 30 seconds

    return () => {
      active = false;
      clearInterval(interval);
    };
  }, [selectedYear, wbpRate, lwbpRate]);

  const hasData = !!plnData;

  const currentMonth = useMemo(() => {
    const now = new Date();
    if (selectedYear === now.getFullYear()) {
      return now.getMonth() + 1; // 1-indexed
    }
    if (hasData && plnData.charts.daily) {
      for (let m = 12; m >= 1; m--) {
        const monthPrefix = `${selectedYear}-${String(m).padStart(2, "0")}`;
        const hasVal = plnData.charts.daily.some((d: any) => d.day.startsWith(monthPrefix) && d.value > 0);
        if (hasVal) return m;
      }
    }
    return 12; // fallback to December
  }, [hasData, plnData, selectedYear]);

  const monthlyDailyRecords = useMemo(() => {
    if (hasData && plnData.charts.daily) {
      const monthPrefix = `${selectedYear}-${String(currentMonth).padStart(2, "0")}`;
      return plnData.charts.daily.filter((d: any) => d.day.startsWith(monthPrefix));
    }
    return [];
  }, [hasData, plnData, selectedYear, currentMonth]);

  // ========== TREND LINE CHART SERIES ==========
  const series = useMemo(() => {
    if (hasData) {
      if (range === "hour") {
        return plnData.charts.hourly;
      } else if (range === "day") {
        return monthlyDailyRecords.map((d: any) => d.value);
      } else {
        // YTD and Per Bulan: use monthly data (always 12 entries, Jan-Dec)
        return plnData.charts.monthly.map((m: any) => m.value);
      }
    }
    const base = dailyEnergyTotal * config.scale;
    return buildTimeAwareSeries(config.points, base, base * 0.35, 1, maxIdx);
  }, [hasData, range, config, plnData, maxIdx, monthlyDailyRecords]);

  // ========== TIMELINE LABELS (rich, descriptive) ==========
  const labels = useMemo(() => {
    if (hasData) {
      if (range === "hour") {
        // "00:00 WIB", "01:00 WIB", ..., "23:00 WIB"
        return Array.from({ length: 24 }, (_, i) =>
          `${i.toString().padStart(2, "0")}:00 WIB`
        );
      } else if (range === "day") {
        // "Senin, 01 Agustus 2025" for every day in the month
        return monthlyDailyRecords.map((d: any) => {
          const [yr, mo, dy] = d.day.split("-").map(Number);
          const dateObj = new Date(yr, mo - 1, dy);
          const dayName = DAY_NAMES_ID[dateObj.getDay()];
          const monthName = MONTH_NAMES_ID[mo - 1];
          return `${dayName}, ${String(dy).padStart(2, "0")} ${monthName} ${yr}`;
        });
      } else {
        // YTD / Per Bulan: "Januari 2025", "Februari 2025", ..., "Desember 2025"
        return plnData.charts.monthly.map((m: any) => {
          const [yr, mo] = m.month.split("-").map(Number);
          return `${MONTH_NAMES_ID[mo - 1]} ${yr}`;
        });
      }
    }
    return buildTimeLabels(config.points, config.type);
  }, [hasData, range, config, plnData, monthlyDailyRecords]);

  // ========== BAR CHART DATA (from database) ==========
  const barLabels = useMemo(() => {
    if (hasData) {
      if (range === "hour") {
        return Array.from({ length: 24 }, (_, i) => `${i.toString().padStart(2, "0")}:00`);
      } else if (range === "day") {
        return monthlyDailyRecords.map((d: any) => {
          const parts = d.day.split("-");
          return `${parts[2]}`; // day number only, e.g. "01", "02"
        });
      } else {
        // Always 12 months
        return plnData.charts.monthly.map((m: any) => {
          const [yr, mo] = m.month.split("-").map(Number);
          return `${MONTH_SHORT_ID[mo - 1]} ${yr}`;
        });
      }
    }
    return buildTimeLabels(config.points, config.type);
  }, [hasData, range, config, plnData, monthlyDailyRecords]);

  const barValues = useMemo(() => {
    if (hasData) {
      if (range === "hour") {
        return plnData.charts.hourly;
      } else if (range === "day") {
        return monthlyDailyRecords.map((d: any) => d.value);
      } else {
        return plnData.charts.monthly.map((m: any) => m.value);
      }
    }
    const base = dailyEnergyTotal * config.scale;
    return buildTimeAwareSeries(config.points, base, base * 0.35, 1, maxIdx);
  }, [hasData, range, config, plnData, maxIdx, monthlyDailyRecords]);

  const barUnit = useMemo(() => {
    if (range === "hour") return "kWh";
    if (range === "day") return "kWh";
    return "MWh"; // YTD and Per Bulan
  }, [range]);

  const plnPeak = hasData ? plnData.pqData.activePower : 1200;
  const plnLoadFactor = hasData ? plnData.pqData.pf * 100 : 88.5;
  const plnCost = hasData ? plnData.summary.totalCost : (dailyEnergyTotal * config.scale * electricityRate);
  const plnTotalKwh = hasData ? plnData.summary.totalKwh : (dailyEnergyTotal * config.scale);

  // ========== TREND PANEL DISTRIBUSI (MultiLineChart) ==========
  const mdpSeries = useMemo(() => {
    if (hasData) {
      if (range === "hour") {
        return [
          { name: "Incoming PLN", values: plnData.charts.hourly, color: "#3b82f6" }
        ];
      } else if (range === "day") {
        return [
          { name: "Incoming PLN", values: plnData.charts.daily.map((d: any) => d.value / 24), color: "#3b82f6" }
        ];
      } else {
        return [
          { name: "Incoming PLN", values: plnData.charts.monthly.map((m: any) => m.value), color: "#3b82f6" }
        ];
      }
    }
    const base = dailyEnergyTotal * config.scale;
    return [
      { name: "Incoming PLN", values: buildTimeAwareSeries(config.points, base, base * 0.15, 1, maxIdx), color: "#3b82f6" }
    ];
  }, [hasData, range, config, plnData, maxIdx]);

  const donutSegments = useMemo(() => {
    if (hasData && plnData.summary.totalKwh > 0) {
      const wbpPct = Math.round((plnData.summary.wbpKwh / Math.max(plnData.summary.totalKwh, 1)) * 100);
      const lwbpPct = 100 - wbpPct;
      return [
        { label: "Beban WBP (17-22)", value: wbpPct, color: "#ef4444" },
        { label: "Beban LWBP", value: lwbpPct, color: "#3b82f6" }
      ];
    }
    return [
      { label: "Beban WBP (17-22)", value: 0, color: "#ef4444" },
      { label: "Beban LWBP", value: 0, color: "#3b82f6" }
    ];
  }, [hasData, plnData]);

  // ========== TOP 10 ENERGY CONSUMING UNITS (Horizontal Bar Chart) ==========
  const top10Units = useMemo(() => {
    const allUnits: { name: string; value: number }[] = [];
    machineGroups.forEach((group) => {
      group.units.forEach((unit) => {
        const energyCard = unit.summaryCards.find((c) => c.label === "Energy");
        if (energyCard) {
          allUnits.push({
            name: unit.unitLabel,
            value: energyCard.value
          });
        }
      });
    });
    // Sort descending by value
    allUnits.sort((a, b) => b.value - a.value);
    // Take top 10
    return allUnits.slice(0, 10);
  }, []);

  const top10Labels = useMemo(() => top10Units.map((u) => u.name), [top10Units]);
  const top10Values = useMemo(() => top10Units.map((u) => u.value), [top10Units]);

  const horizontalChartData = {
    labels: top10Labels,
    datasets: [
      {
        label: "kWh",
        data: top10Values,
        backgroundColor: "rgba(59, 130, 246, 0.8)",
        borderColor: "rgb(59, 130, 246)",
        borderWidth: 1,
        borderRadius: 4,
        barPercentage: 0.6
      }
    ]
  };

  const horizontalChartOptions = {
    indexAxis: "y" as const,
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: {
        callbacks: {
          label: (context: any) => `${Number(context.parsed.x).toLocaleString("id-ID")} kWh`
        }
      }
    },
    scales: {
      x: {
        grid: { color: "rgba(203, 213, 225, 0.3)" },
        ticks: { font: { size: 10 } }
      },
      y: {
        grid: { display: false },
        ticks: { font: { size: 10 }, autoSkip: false }
      }
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader title="Listrik" description="Monitor beban listrik utama, peak demand, dan biaya energi." />

      {/* Executive Summary */}
      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-sm transition hover:shadow-md hover:border-blue-400 dark:hover:border-blue-500">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-[0.2em] text-slate-400 dark:text-slate-500">Total Biaya</span>
            <div className="h-8 w-8 rounded-lg bg-blue-500/10 flex items-center justify-center">
              <svg className="h-4 w-4 text-blue-500" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M12 6v12m-3-2.818.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" /></svg>
            </div>
          </div>
          <div className="mt-3 text-2xl font-extrabold text-slate-800 dark:text-white font-mono">
            {loading ? "Calculating..." : formatCurrency(plnCost)}
          </div>
          <div className="mt-1 text-xs font-semibold text-blue-600 dark:text-blue-400 flex justify-between items-center">
            <span>{plnTotalKwh.toLocaleString("id-ID", { maximumFractionDigits: 0 })} kWh</span>
            <span className="text-[10px] text-slate-400 dark:text-slate-500 font-normal">
              Tarif: Rp {wbpRate.toLocaleString("id-ID", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}/{lwbpRate.toLocaleString("id-ID", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-sm transition hover:shadow-md hover:border-amber-400 dark:hover:border-amber-500">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-[0.2em] text-slate-400 dark:text-slate-500">Peak Demand</span>
            <div className="h-8 w-8 rounded-lg bg-amber-500/10 flex items-center justify-center">
              <svg className="h-4 w-4 text-amber-500" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="m3.75 13.5 10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75Z" /></svg>
            </div>
          </div>
          <div className="mt-3 text-2xl font-extrabold text-slate-800 dark:text-white font-mono">
            {loading ? "Loading..." : `${plnPeak.toLocaleString("id-ID", { maximumFractionDigits: 1 })} kW`}
          </div>
          <div className="mt-1 text-xs text-slate-400 dark:text-slate-500">Estimasi beban puncak</div>
        </div>

        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-sm transition hover:shadow-md hover:border-emerald-400 dark:hover:border-emerald-500">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-[0.2em] text-slate-400 dark:text-slate-500">Load Factor</span>
            <div className="h-8 w-8 rounded-lg bg-emerald-500/10 flex items-center justify-center">
              <svg className="h-4 w-4 text-emerald-500" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18 9 11.25l4.306 4.306a11.95 11.95 0 0 1 5.814-5.518l2.74-1.22m0 0-5.94-2.281m5.94 2.28-2.28 5.941" /></svg>
            </div>
          </div>
          <div className="mt-3 text-2xl font-extrabold text-slate-800 dark:text-white font-mono">
            {loading ? "Loading..." : `${plnLoadFactor.toFixed(1)}%`}
          </div>
          <div className="mt-1 text-xs text-slate-400 dark:text-slate-500">Stabilitas beban listrik</div>
        </div>

        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-sm transition hover:shadow-md hover:border-rose-400 dark:hover:border-rose-500">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-[0.2em] text-rose-500 dark:text-rose-400">Beban WBP</span>
            <div className="h-8 w-8 rounded-lg bg-rose-500/10 flex items-center justify-center">
              <svg className="h-4 w-4 text-rose-500" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" /></svg>
            </div>
          </div>
          <div className="mt-3 text-xl font-extrabold text-slate-800 dark:text-white font-mono">
            {loading ? "Loading..." : `${(plnData?.summary.wbpKwh || 0).toLocaleString("id-ID", { maximumFractionDigits: 0 })} kWh`}
          </div>
          <div className="mt-1 text-xs font-semibold text-rose-500">
            {loading ? "" : formatCurrency(plnData?.summary.wbpCost || 0)}
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-sm transition hover:shadow-md hover:border-emerald-400 dark:hover:border-emerald-500">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-[0.2em] text-emerald-500 dark:text-emerald-400">Beban LWBP</span>
            <div className="h-8 w-8 rounded-lg bg-emerald-500/10 flex items-center justify-center">
              <svg className="h-4 w-4 text-emerald-500" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M21.752 15.002A9.72 9.72 0 0 1 18 15.75c-5.385 0-9.75-4.365-9.75-9.75 0-1.33.266-2.597.748-3.752A9.753 9.753 0 0 0 3 11.25C3 16.635 7.365 21 12.75 21a9.753 9.753 0 0 0 6.002-2.082Z" /></svg>
            </div>
          </div>
          <div className="mt-3 text-xl font-extrabold text-slate-800 dark:text-white font-mono">
            {loading ? "Loading..." : `${(plnData?.summary.lwbpKwh || 0).toLocaleString("id-ID", { maximumFractionDigits: 0 })} kWh`}
          </div>
          <div className="mt-1 text-xs font-semibold text-emerald-500">
            {loading ? "" : formatCurrency(plnData?.summary.lwbpCost || 0)}
          </div>
        </div>
      </section>

      {/* MultiLineChart + Donut */}
      <div className="grid gap-6 lg:grid-cols-[2fr_1fr]">
        <section className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
            <div>
              <h3 className="text-sm font-bold uppercase tracking-[0.2em] text-slate-400 dark:text-slate-500">Trend Panel Distribusi</h3>
              <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">
                {range === "day"
                  ? `Beban Incoming PLN — Harian Bulan ${MONTH_NAMES_ID[currentMonth - 1]} ${selectedYear}.`
                  : "Beban Incoming PLN — data historis."}
              </p>
            </div>
            <div className="flex items-center gap-2">
              {/* Year Selector */}
              <select
                value={selectedYear}
                onChange={(e) => setSelectedYear(Number(e.target.value))}
                className="rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 px-3 py-1.5 text-xs font-bold text-slate-600 dark:text-slate-300 focus:outline-none focus:ring-2 focus:ring-cyan-500 cursor-pointer transition"
              >
                {AVAILABLE_YEARS.map((yr) => (
                  <option key={yr} value={yr}>{yr}</option>
                ))}
              </select>

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
            <UtilityBarChart labels={barLabels} values={barValues} unit={barUnit} color="#3b82f6" height={256} />
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

      {/* Parameters */}
      <section className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-sm">
        <h3 className="text-sm font-bold uppercase tracking-[0.2em] text-slate-400 dark:text-slate-500 mb-4">Parameter & Rate Limit</h3>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-xl border border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/30 p-4 transition hover:border-cyan-400">
            <div className="text-xs text-slate-400 dark:text-slate-500">Peak Limit</div>
            <div className="mt-1 text-lg font-bold text-slate-800 dark:text-white font-mono">12,000 kW</div>
          </div>
          <div className="rounded-xl border border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/30 p-4 transition hover:border-cyan-400">
            <div className="text-xs text-slate-400 dark:text-slate-500">Trafo Capacity</div>
            <div className="mt-1 text-lg font-bold text-slate-800 dark:text-white font-mono">15,000 kVA</div>
          </div>
          <div className="rounded-xl border border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/30 p-4 transition hover:border-emerald-400 flex flex-col justify-between">
            <div>
              <div className="text-xs text-slate-400 dark:text-slate-500">Power Factor (Cos φ)</div>
              <div className="mt-1 text-lg font-bold text-emerald-600 dark:text-emerald-400 font-mono">
                {loading ? "Loading..." : (plnLoadFactor / 100).toFixed(3)}
              </div>
            </div>
            <div className="text-[10px] text-slate-400 dark:text-slate-500 mt-1">Target: &ge; 0.85</div>
          </div>
          <div className="rounded-xl border border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/30 p-4 transition hover:border-blue-400">
            <div className="text-xs text-slate-400 dark:text-slate-500">Tarif WBP / LWBP</div>
            <div className="mt-1 text-base font-bold text-slate-800 dark:text-white font-mono">
              Rp {wbpRate.toLocaleString("id-ID", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} / Rp {lwbpRate.toLocaleString("id-ID", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
          </div>
        </div>
      </section>

      {/* 10 Unit Konsumsi Terbesar (Horizontal Bar Chart) */}
      <section className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <div>
            <h3 className="text-sm font-bold uppercase tracking-[0.2em] text-slate-400 dark:text-slate-500">10 Unit Konsumsi Terbesar</h3>
            <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">
              Peringkat konsumsi listrik per unit mesin (kWh) yang diurutkan dari terbesar.
            </p>
          </div>
          <div className="text-xs font-mono text-slate-400">
            kWh
          </div>
        </div>
        <div className="bg-slate-50 dark:bg-slate-950/40 rounded-xl p-4 border border-slate-100 dark:border-slate-800/80 h-96">
          <Bar data={horizontalChartData} options={horizontalChartOptions} />
        </div>
      </section>
    </div>
  );
}
