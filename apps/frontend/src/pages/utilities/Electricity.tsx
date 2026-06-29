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

const electricityRate = 1467;

const ranges = [
  { id: "ytd", label: "YTD", points: 12, type: "month" as const, scale: 30 },
  { id: "hour", label: "Per Jam", points: 24, type: "time" as const, scale: 1 / 24 },
  { id: "day", label: "Per Hari", points: 30, type: "day" as const, scale: 1 },
  { id: "month", label: "Per Bulan", points: 12, type: "month" as const, scale: 30 }
] as const;

const formatCurrency = (value: number) =>
  new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(value);

export default function Electricity() {
  const [range, setRange] = useState<(typeof ranges)[number]["id"]>("ytd");
  const config = ranges.find((item) => item.id === range) ?? ranges[0];

  const maxIdx = useMemo(() => getElapsedIndex(config.type), [config.type]);

  const series = useMemo(() => {
    const base = dailyEnergyTotal * config.scale;
    return buildTimeAwareSeries(config.points, base, base * 0.35, 1, maxIdx);
  }, [config, maxIdx]);

  const labels = useMemo(
    () => buildTimeLabels(config.points, config.type),
    [config]
  );

  const total = series.reduce((sum, v) => sum + (v ?? 0), 0);
  const cost = total * electricityRate;
  const nonNull = series.filter((v): v is number => v !== null);
  const peak = nonNull.length > 0 ? Math.max(...nonNull) : 0;
  const loadFactor = nonNull.length > 0 ? ((total / nonNull.length) / Math.max(peak, 1)) * 100 : 0;

  const mdpSeries = useMemo(() => {
    const base = (dailyEnergyTotal * config.scale) / 3;
    return [
      { name: "MDP 1", values: buildTimeAwareSeries(config.points, base, base * 0.12, 1, maxIdx), color: "#3b82f6" },
      { name: "MDP 2", values: buildTimeAwareSeries(config.points, base, base * 0.2, 2, maxIdx), color: "#f59e0b" },
      { name: "MDP 3", values: buildTimeAwareSeries(config.points, base, base * 0.15, 3, maxIdx), color: "#10b981", dashed: true }
    ];
  }, [config, maxIdx]);

  const donutSegments = useMemo(() => [
    { label: "Chillers", value: 42, color: "#3b82f6" },
    { label: "Compressors", value: 31, color: "#f59e0b" },
    { label: "Production", value: 27, color: "#10b981" }
  ], []);

  return (
    <div className="space-y-6">
      <PageHeader title="Listrik" description="Monitor beban listrik utama, peak demand, dan biaya energi." />

      {/* Executive Summary */}
      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-sm transition hover:shadow-md hover:border-blue-400 dark:hover:border-blue-500">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-[0.2em] text-slate-400 dark:text-slate-500">Total Biaya</span>
            <span className="text-lg">💰</span>
          </div>
          <div className="mt-3 text-2xl font-extrabold text-slate-800 dark:text-white font-mono">{formatCurrency(cost)}</div>
          <div className="mt-1 text-xs font-semibold text-blue-600 dark:text-blue-400">{total.toLocaleString("id-ID", { maximumFractionDigits: 0 })} kWh</div>
        </div>

        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-sm transition hover:shadow-md hover:border-amber-400 dark:hover:border-amber-500">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-[0.2em] text-slate-400 dark:text-slate-500">Peak Demand</span>
            <span className="text-lg">⚡</span>
          </div>
          <div className="mt-3 text-2xl font-extrabold text-slate-800 dark:text-white font-mono">{peak.toLocaleString("id-ID", { maximumFractionDigits: 1 })} kW</div>
          <div className="mt-1 text-xs text-slate-400 dark:text-slate-500">Estimasi beban puncak</div>
        </div>

        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-sm transition hover:shadow-md hover:border-emerald-400 dark:hover:border-emerald-500">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-[0.2em] text-slate-400 dark:text-slate-500">Load Factor</span>
            <span className="text-lg">📈</span>
          </div>
          <div className="mt-3 text-2xl font-extrabold text-slate-800 dark:text-white font-mono">{loadFactor.toFixed(1)}%</div>
          <div className="mt-1 text-xs text-slate-400 dark:text-slate-500">Stabilitas beban listrik</div>
        </div>

        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-sm transition hover:shadow-md hover:border-cyan-400 dark:hover:border-cyan-500">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-[0.2em] text-slate-400 dark:text-slate-500">Tarif</span>
            <span className="text-lg">🎟️</span>
          </div>
          <div className="mt-3 text-2xl font-extrabold text-slate-800 dark:text-white font-mono">{formatCurrency(electricityRate)}</div>
          <div className="mt-1 text-xs text-slate-400 dark:text-slate-500">Per kWh</div>
        </div>
      </section>

      {/* MultiLineChart + Donut */}
      <div className="grid gap-6 lg:grid-cols-[2fr_1fr]">
        <section className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
            <div>
              <h3 className="text-sm font-bold uppercase tracking-[0.2em] text-slate-400 dark:text-slate-500">Trend Panel Distribusi</h3>
              <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">Beban MDP 1, MDP 2, MDP 3 — real-time.</p>
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
            <MultiLineChart series={mdpSeries} unit="kW" heightClassName="h-56" />
          </div>
        </section>

        <section className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-sm flex flex-col justify-between">
          <div>
            <h3 className="text-sm font-bold uppercase tracking-[0.2em] text-slate-400 dark:text-slate-500">Distribusi Beban</h3>
            <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">Alokasi konsumsi daya utama.</p>
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
            <div className="text-xs text-slate-400 dark:text-slate-500">Peak Limit</div>
            <div className="mt-1 text-lg font-bold text-slate-800 dark:text-white font-mono">12,000 kW</div>
          </div>
          <div className="rounded-xl border border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/30 p-4 transition hover:border-cyan-400">
            <div className="text-xs text-slate-400 dark:text-slate-500">Trafo Capacity</div>
            <div className="mt-1 text-lg font-bold text-slate-800 dark:text-white font-mono">15,000 kVA</div>
          </div>
          <div className="rounded-xl border border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/30 p-4 transition hover:border-cyan-400">
            <div className="text-xs text-slate-400 dark:text-slate-500">Power Factor Target</div>
            <div className="mt-1 text-lg font-bold text-emerald-600 dark:text-emerald-400 font-mono">&ge; 0.85</div>
          </div>
        </div>
      </section>

      {/* Bar Chart */}
      <section className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-sm">
        <h3 className="text-sm font-bold uppercase tracking-[0.2em] text-slate-400 dark:text-slate-500">Bar Chart Konsumsi</h3>
        <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5 mb-4">Konsumsi total real-time.</p>
        <div className="bg-slate-50 dark:bg-slate-950/40 rounded-xl p-4 border border-slate-100 dark:border-slate-800/80">
          <UtilityBarChart labels={labels} values={series} unit="kWh" color="#3b82f6" height={220} />
        </div>
      </section>
    </div>
  );
}
