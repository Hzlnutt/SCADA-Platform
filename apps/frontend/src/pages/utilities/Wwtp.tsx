import { useMemo, useState } from "react";
import { PageHeader } from "../../components/ui/PageHeader";
import { UtilityBarChart } from "../../components/charts/UtilityBarChart";
import { MultiLineChart } from "../../components/charts/MultiLineChart";
import { DonutChart } from "../../components/charts/DonutChart";
import { wwtpEquipment } from "../../data/equipment";
import { buildTimeAwareSeries, buildTimeLabels, getElapsedIndex } from "../../utils/series";

const ranges = [
  { id: "ytd", label: "YTD", points: 12, type: "month" as const, scale: 30 },
  { id: "day", label: "Per Hari", points: 30, type: "day" as const, scale: 1 },
  { id: "month", label: "Per Bulan", points: 12, type: "month" as const, scale: 30 }
] as const;

export default function Wwtp() {
  const [range, setRange] = useState<(typeof ranges)[number]["id"]>("ytd");
  const config = ranges.find((item) => item.id === range) ?? ranges[0];

  const maxIdx = useMemo(() => getElapsedIndex(config.type), [config.type]);

  const flowSeries = useMemo(() => {
    const base = 820 * config.scale;
    return buildTimeAwareSeries(config.points, base, base * 0.2, 2, maxIdx);
  }, [config, maxIdx]);

  const labels = useMemo(() => buildTimeLabels(config.points, config.type), [config]);
  const totalFlow = flowSeries.reduce((sum, v) => sum + (v ?? 0), 0);

  const wwtpMlSeries = useMemo(() => {
    const base = 820 * config.scale;
    return [
      { name: "Influent Flow", values: buildTimeAwareSeries(config.points, base, base * 0.2, 1, maxIdx), color: "#f59e0b" },
      { name: "Effluent Discharge", values: buildTimeAwareSeries(config.points, base * 0.85, base * 0.15, 2, maxIdx), color: "#3b82f6", dashed: true }
    ];
  }, [config, maxIdx]);

  const donutSegments = useMemo(() => [
    { label: "Aeration", value: 40, color: "#3b82f6" },
    { label: "Clarifier", value: 35, color: "#10b981" },
    { label: "Sludge Press", value: 25, color: "#f59e0b" }
  ], []);

  const effluentQuality = 98.2;
  const chemicalUsage = 1.4;

  return (
    <div className="space-y-6">
      <PageHeader title="WWTP" description="Status pengolahan air limbah dan kualitas effluent." />

      {/* Executive Summary */}
      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-sm transition hover:shadow-md hover:border-amber-400 dark:hover:border-amber-500">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-[0.2em] text-slate-400 dark:text-slate-500">Influent Flow</span>
            <span className="text-lg">📥</span>
          </div>
          <div className="mt-3 text-2xl font-extrabold text-slate-800 dark:text-white font-mono">{totalFlow.toLocaleString("id-ID", { maximumFractionDigits: 0 })} m³</div>
          <div className="mt-1 text-xs text-slate-400 dark:text-slate-500">Total debit masuk</div>
        </div>

        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-sm transition hover:shadow-md hover:border-emerald-400 dark:hover:border-emerald-500">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-[0.2em] text-slate-400 dark:text-slate-500">Effluent Quality</span>
            <span className="text-lg">✨</span>
          </div>
          <div className="mt-3 text-2xl font-extrabold text-emerald-600 dark:text-emerald-400 font-mono">{effluentQuality}%</div>
          <div className="mt-1 text-xs text-slate-400 dark:text-slate-500">Kepatuhan baku mutu</div>
        </div>

        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-sm transition hover:shadow-md hover:border-blue-400 dark:hover:border-blue-500">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-[0.2em] text-slate-400 dark:text-slate-500">Chemical Usage</span>
            <span className="text-lg">🧪</span>
          </div>
          <div className="mt-3 text-2xl font-extrabold text-slate-800 dark:text-white font-mono">{chemicalUsage} ton</div>
          <div className="mt-1 text-xs text-slate-400 dark:text-slate-500">Dosis kimia bulan ini</div>
        </div>

        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-sm transition hover:shadow-md hover:border-cyan-400 dark:hover:border-cyan-500">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-[0.2em] text-slate-400 dark:text-slate-500">Compliance</span>
            <span className="text-lg">✅</span>
          </div>
          <div className="mt-3 text-2xl font-extrabold text-indigo-600 dark:text-indigo-400 font-mono">PASS</div>
          <div className="mt-1 text-xs text-slate-400 dark:text-slate-500">Baku mutu terpenuhi</div>
        </div>
      </section>

      {/* MultiLineChart + Donut */}
      <div className="grid gap-6 lg:grid-cols-[2fr_1fr]">
        <section className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
            <div>
              <h3 className="text-sm font-bold uppercase tracking-[0.2em] text-slate-400 dark:text-slate-500">Trend Influent vs Effluent</h3>
              <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">Pola debit masuk dan keluar WWTP.</p>
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
            <MultiLineChart series={wwtpMlSeries} unit="m³" heightClassName="h-56" />
          </div>
        </section>

        <section className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-sm flex flex-col justify-between">
          <div>
            <h3 className="text-sm font-bold uppercase tracking-[0.2em] text-slate-400 dark:text-slate-500">Distribusi Beban Stage</h3>
            <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">Aeration, Clarifier, Sludge Press.</p>
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
            <div className="text-xs text-slate-400 dark:text-slate-500">pH Limit</div>
            <div className="mt-1 text-lg font-bold text-slate-800 dark:text-white font-mono">6.0 - 9.0</div>
          </div>
          <div className="rounded-xl border border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/30 p-4 transition hover:border-cyan-400">
            <div className="text-xs text-slate-400 dark:text-slate-500">COD MAX</div>
            <div className="mt-1 text-lg font-bold text-slate-800 dark:text-white font-mono">100 mg/L</div>
          </div>
          <div className="rounded-xl border border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/30 p-4 transition hover:border-cyan-400">
            <div className="text-xs text-slate-400 dark:text-slate-500">BOD MAX</div>
            <div className="mt-1 text-lg font-bold text-slate-800 dark:text-white font-mono">30 mg/L</div>
          </div>
        </div>
      </section>

      {/* Bar Chart */}
      <section className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-sm">
        <h3 className="text-sm font-bold uppercase tracking-[0.2em] text-slate-400 dark:text-slate-500">Bar Chart Influent</h3>
        <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5 mb-4">Debit masuk WWTP per periode.</p>
        <div className="bg-slate-50 dark:bg-slate-950/40 rounded-xl p-4 border border-slate-100 dark:border-slate-800/80">
          <UtilityBarChart labels={labels} values={flowSeries} unit="m³" color="#3b82f6" height={220} />
        </div>
      </section>

      {/* Peralatan WWTP */}
      <section className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-sm">
        <h3 className="text-sm font-bold uppercase tracking-[0.2em] text-slate-400 dark:text-slate-500 mb-4">Peralatan WWTP</h3>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {wwtpEquipment.map((item) => (
            <div
              key={item.id}
              className="rounded-xl border border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/30 p-4 hover:bg-slate-100 dark:hover:bg-slate-800/60 transition-colors flex items-center justify-between"
            >
              <div>
                <div className="text-sm font-bold text-slate-800 dark:text-white">{item.name}</div>
                <div className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">{item.code}</div>
              </div>
              <span className="rounded-md bg-cyan-50 dark:bg-cyan-950/30 border border-cyan-200 dark:border-cyan-800/50 px-2 py-1 text-[11px] font-bold text-cyan-600 dark:text-cyan-400 uppercase tracking-wider">
                {item.unit}
              </span>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
