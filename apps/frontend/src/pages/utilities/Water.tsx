import { useMemo, useState } from "react";
import { PageHeader } from "../../components/ui/PageHeader";
import { UtilityBarChart } from "../../components/charts/UtilityBarChart";
import { MultiLineChart } from "../../components/charts/MultiLineChart";
import { DonutChart } from "../../components/charts/DonutChart";
import { machineGroups } from "../../data/machines";
import { buildTimeAwareSeries, buildTimeLabels, getElapsedIndex } from "../../utils/series";

const dailyEnergyTotal = machineGroups.reduce((sum, group) => {
  const energy = group.summaryCards.find((card) => card.label === "Total Energy")?.value ?? 0;
  return sum + energy;
}, 0);

const waterBase = dailyEnergyTotal / 25;
const waterRate = 12000;

const ranges = [
  { id: "ytd", label: "YTD", points: 12, type: "month" as const, scale: 30 },
  { id: "day", label: "Per Hari", points: 30, type: "day" as const, scale: 1 },
  { id: "month", label: "Per Bulan", points: 12, type: "month" as const, scale: 30 },
  { id: "year", label: "Per Tahun", points: 5, type: "year" as const, scale: 365 }
] as const;

const formatCurrency = (value: number) =>
  new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(value);

export default function Water() {
  const [range, setRange] = useState<(typeof ranges)[number]["id"]>("ytd");
  const config = ranges.find((item) => item.id === range) ?? ranges[0];

  const maxIdx = useMemo(() => getElapsedIndex(config.type), [config.type]);

  const series = useMemo(() => {
    const base = waterBase * config.scale;
    return buildTimeAwareSeries(config.points, base, base * 0.25, 3, maxIdx);
  }, [config, maxIdx]);

  const labels = useMemo(() => buildTimeLabels(config.points, config.type), [config]);

  const total = series.reduce((sum, v) => sum + (v ?? 0), 0);
  const cost = total * waterRate;
  const nonNull = series.filter((v): v is number => v !== null);
  const peak = nonNull.length > 0 ? Math.max(...nonNull) : 0;
  const recycleRatio = 32;

  const waterMlSeries = useMemo(() => {
    const base = waterBase * config.scale;
    return [
      { name: "Raw Water Make-up", values: buildTimeAwareSeries(config.points, base, base * 0.25, 1, maxIdx), color: "#0ea5e9" },
      { name: "Recycled Process Water", values: buildTimeAwareSeries(config.points, base * 0.35, base * 0.1, 2, maxIdx), color: "#10b981", dashed: true }
    ];
  }, [config, maxIdx]);

  const donutSegments = useMemo(() => [
    { label: "RO Plant", value: 45, color: "#0ea5e9" },
    { label: "Cooling Tower", value: 35, color: "#10b981" },
    { label: "Domestic/Sanitation", value: 20, color: "#f59e0b" }
  ], []);

  return (
    <div className="space-y-6">
      <PageHeader title="Air" description="Pantau konsumsi air proses, utilitas, dan biaya per periode." />

      {/* Executive Summary */}
      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-sm transition hover:shadow-md hover:border-sky-400 dark:hover:border-sky-500">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-[0.2em] text-slate-400 dark:text-slate-500">Total Biaya</span>
            <span className="text-lg">💧</span>
          </div>
          <div className="mt-3 text-2xl font-extrabold text-slate-800 dark:text-white font-mono">{formatCurrency(cost)}</div>
          <div className="mt-1 text-xs font-semibold text-sky-600 dark:text-sky-400">{total.toLocaleString("id-ID", { maximumFractionDigits: 0 })} m³</div>
        </div>

        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-sm transition hover:shadow-md hover:border-blue-400 dark:hover:border-blue-500">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-[0.2em] text-slate-400 dark:text-slate-500">Peak Usage</span>
            <span className="text-lg">🌊</span>
          </div>
          <div className="mt-3 text-2xl font-extrabold text-slate-800 dark:text-white font-mono">{peak.toLocaleString("id-ID", { maximumFractionDigits: 1 })} m³</div>
          <div className="mt-1 text-xs text-slate-400 dark:text-slate-500">Kebutuhan puncak air</div>
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

      {/* MultiLineChart + Donut */}
      <div className="grid gap-6 lg:grid-cols-[2fr_1fr]">
        <section className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
            <div>
              <h3 className="text-sm font-bold uppercase tracking-[0.2em] text-slate-400 dark:text-slate-500">Trend Aliran Air</h3>
              <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">Raw water vs recycled — real-time.</p>
            </div>
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
          <div className="bg-slate-50 dark:bg-slate-950/40 rounded-xl p-4 border border-slate-100 dark:border-slate-800/80">
            <MultiLineChart series={waterMlSeries} unit="m³" heightClassName="h-56" />
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

      {/* Bar Chart */}
      <section className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-sm">
        <h3 className="text-sm font-bold uppercase tracking-[0.2em] text-slate-400 dark:text-slate-500">Bar Chart Konsumsi</h3>
        <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5 mb-4">Konsumsi air per periode.</p>
        <div className="bg-slate-50 dark:bg-slate-950/40 rounded-xl p-4 border border-slate-100 dark:border-slate-800/80">
          <UtilityBarChart labels={labels} values={series} unit="m³" color="#10b981" height={220} />
        </div>
      </section>
    </div>
  );
}
