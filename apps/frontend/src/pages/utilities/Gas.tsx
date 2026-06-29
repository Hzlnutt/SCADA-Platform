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

const gasBase = dailyEnergyTotal / 7;
const gasRateUsd = 0.38;

const ranges = [
  { id: "ytd", label: "YTD", points: 12, type: "month" as const, scale: 30 },
  { id: "day", label: "Per Hari", points: 30, type: "day" as const, scale: 1 },
  { id: "month", label: "Per Bulan", points: 12, type: "month" as const, scale: 30 },
  { id: "year", label: "Per Tahun", points: 5, type: "year" as const, scale: 365 }
] as const;

const formatCurrency = (value: number, currency: "IDR" | "USD") =>
  new Intl.NumberFormat(currency === "IDR" ? "id-ID" : "en-US", { style: "currency", currency, maximumFractionDigits: 0 }).format(value);

export default function Gas() {
  const [range, setRange] = useState<(typeof ranges)[number]["id"]>("ytd");
  const config = ranges.find((item) => item.id === range) ?? ranges[0];

  const maxIdx = useMemo(() => getElapsedIndex(config.type), [config.type]);

  const series = useMemo(() => {
    const base = gasBase * config.scale;
    return buildTimeAwareSeries(config.points, base, base * 0.3, 2, maxIdx);
  }, [config, maxIdx]);

  const labels = useMemo(() => buildTimeLabels(config.points, config.type), [config]);

  const total = series.reduce((sum, v) => sum + (v ?? 0), 0);
  const costUsd = total * gasRateUsd;
  const costIdr = costUsd * 16200;
  const nonNull = series.filter((v): v is number => v !== null);
  const peak = nonNull.length > 0 ? Math.max(...nonNull) : 0;

  const boilerSeries = useMemo(() => {
    const base = (gasBase * config.scale) / 2;
    return [
      { name: "Boiler 1 Flow", values: buildTimeAwareSeries(config.points, base, base * 0.15, 1, maxIdx), color: "#f59e0b" },
      { name: "Boiler 2 Flow", values: buildTimeAwareSeries(config.points, base, base * 0.25, 2, maxIdx), color: "#ea580c", dashed: true }
    ];
  }, [config, maxIdx]);

  const donutSegments = useMemo(() => [
    { label: "Boiler 1", value: 55, color: "#f59e0b" },
    { label: "Boiler 2", value: 45, color: "#ea580c" }
  ], []);

  return (
    <div className="space-y-6">
      <PageHeader title="Gas" description="Monitor konsumsi gas dan biaya energi berbasis USD." />

      {/* Executive Summary */}
      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-sm transition hover:shadow-md hover:border-amber-400 dark:hover:border-amber-500">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-[0.2em] text-slate-400 dark:text-slate-500">Total Biaya (USD)</span>
            <span className="text-lg">💵</span>
          </div>
          <div className="mt-3 text-2xl font-extrabold text-slate-800 dark:text-white font-mono">{formatCurrency(costUsd, "USD")}</div>
          <div className="mt-1 text-xs font-semibold text-amber-600 dark:text-amber-400">{formatCurrency(costIdr, "IDR")} &middot; {total.toLocaleString("id-ID", { maximumFractionDigits: 0 })} Sm³</div>
        </div>

        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-sm transition hover:shadow-md hover:border-orange-400 dark:hover:border-orange-500">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-[0.2em] text-slate-400 dark:text-slate-500">Peak Usage</span>
            <span className="text-lg">🔥</span>
          </div>
          <div className="mt-3 text-2xl font-extrabold text-slate-800 dark:text-white font-mono">{peak.toLocaleString("id-ID", { maximumFractionDigits: 1 })} Sm³</div>
          <div className="mt-1 text-xs text-slate-400 dark:text-slate-500">Kebutuhan gas maksimum</div>
        </div>

        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-sm transition hover:shadow-md hover:border-blue-400 dark:hover:border-blue-500">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-[0.2em] text-slate-400 dark:text-slate-500">Kurs IDR</span>
            <span className="text-lg">💱</span>
          </div>
          <div className="mt-3 text-2xl font-extrabold text-slate-800 dark:text-white font-mono">Rp 16.200</div>
          <div className="mt-1 text-xs text-slate-400 dark:text-slate-500">Per USD</div>
        </div>

        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-sm transition hover:shadow-md hover:border-cyan-400 dark:hover:border-cyan-500">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-[0.2em] text-slate-400 dark:text-slate-500">Tarif</span>
            <span className="text-lg">🏷️</span>
          </div>
          <div className="mt-3 text-2xl font-extrabold text-slate-800 dark:text-white font-mono">$0.38</div>
          <div className="mt-1 text-xs text-slate-400 dark:text-slate-500">Per Sm³</div>
        </div>
      </section>

      {/* MultiLineChart + Donut */}
      <div className="grid gap-6 lg:grid-cols-[2fr_1fr]">
        <section className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
            <div>
              <h3 className="text-sm font-bold uppercase tracking-[0.2em] text-slate-400 dark:text-slate-500">Trend Aliran Boiler</h3>
              <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">Boiler 1 dan Boiler 2 gas flow — real-time.</p>
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
            <MultiLineChart series={boilerSeries} unit="Sm³" heightClassName="h-56" />
          </div>
        </section>

        <section className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-sm flex flex-col justify-between">
          <div>
            <h3 className="text-sm font-bold uppercase tracking-[0.2em] text-slate-400 dark:text-slate-500">Distribusi Gas</h3>
            <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">Boiler 1 vs Boiler 2.</p>
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
            <div className="text-xs text-slate-400 dark:text-slate-500">Target Pressure</div>
            <div className="mt-1 text-lg font-bold text-slate-800 dark:text-white font-mono">4 - 6 bar</div>
          </div>
          <div className="rounded-xl border border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/30 p-4 transition hover:border-cyan-400">
            <div className="text-xs text-slate-400 dark:text-slate-500">Min Heating Value</div>
            <div className="mt-1 text-lg font-bold text-slate-800 dark:text-white font-mono">38.5 MJ/Sm³</div>
          </div>
          <div className="rounded-xl border border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/30 p-4 transition hover:border-cyan-400">
            <div className="text-xs text-slate-400 dark:text-slate-500">Supply Contract</div>
            <div className="mt-1 text-lg font-bold text-slate-800 dark:text-white font-mono">50,000 Sm³/mo</div>
          </div>
        </div>
      </section>

      {/* Bar Chart */}
      <section className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-sm">
        <h3 className="text-sm font-bold uppercase tracking-[0.2em] text-slate-400 dark:text-slate-500">Bar Chart Konsumsi</h3>
        <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5 mb-4">Konsumsi gas per periode.</p>
        <div className="bg-slate-50 dark:bg-slate-950/40 rounded-xl p-4 border border-slate-100 dark:border-slate-800/80">
          <UtilityBarChart labels={labels} values={series} unit="Sm³" color="#f59e0b" height={220} />
        </div>
      </section>
    </div>
  );
}
