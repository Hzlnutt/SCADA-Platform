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
      { name: "Raw Water Make-up", values: buildTimeAwareSeries(config.points, base, base * 0.25, 1, maxIdx), color: "#2f8ae5" },
      { name: "Recycled Process Water", values: buildTimeAwareSeries(config.points, base * 0.35, base * 0.1, 2, maxIdx), color: "#3bb77e", dashed: true }
    ];
  }, [config, maxIdx]);

  const donutSegments = useMemo(() => [
    { label: "RO Plant", value: 45, color: "rgba(47, 138, 229, 0.88)" },
    { label: "Cooling Tower", value: 35, color: "rgba(59, 183, 126, 0.85)" },
    { label: "Domestic/Sanitation", value: 20, color: "rgba(244, 197, 66, 0.85)" }
  ], []);

  return (
    <div className="space-y-5">
      <PageHeader title="Air" description="Pantau konsumsi air proses, utilitas, dan biaya per periode." />

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-2xl border border-slate-800 bg-slate-950/70 p-4 transition hover:border-slate-700 hover:bg-slate-950/80">
          <div className="text-xs uppercase tracking-[0.2em] text-slate-500">Total Biaya</div>
          <div className="mt-2 text-2xl font-semibold text-slate-100">{formatCurrency(cost)}</div>
          <div className="mt-1 text-xs text-slate-400">{total.toFixed(0)} m³</div>
        </div>
        <div className="rounded-2xl border border-slate-800 bg-slate-950/70 p-4 transition hover:border-slate-700 hover:bg-slate-950/80">
          <div className="text-xs uppercase tracking-[0.2em] text-slate-500">Peak Usage</div>
          <div className="mt-2 text-2xl font-semibold text-slate-100">{peak.toFixed(1)} m³</div>
          <div className="mt-1 text-xs text-slate-400">Kebutuhan puncak air</div>
        </div>
        <div className="rounded-2xl border border-slate-800 bg-slate-950/70 p-4 transition hover:border-slate-700 hover:bg-slate-950/80">
          <div className="text-xs uppercase tracking-[0.2em] text-slate-500">Recycle Ratio</div>
          <div className="mt-2 text-2xl font-semibold text-slate-100">{recycleRatio}%</div>
          <div className="mt-1 text-xs text-slate-400">Rasio pemakaian ulang air</div>
        </div>
        <div className="rounded-2xl border border-slate-800 bg-slate-950/70 p-4 transition hover:border-slate-700 hover:bg-slate-950/80">
          <div className="text-xs uppercase tracking-[0.2em] text-slate-500">Tarif</div>
          <div className="mt-2 text-2xl font-semibold text-slate-100">Rp 12,000</div>
          <div className="mt-1 text-xs text-slate-400">per m³</div>
        </div>
      </section>

      <div className="grid gap-4 lg:grid-cols-[2fr_1fr]">
        <section className="rounded-2xl border border-slate-800 bg-slate-950/70 p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="text-xs uppercase tracking-[0.2em] text-slate-500">Trend Aliran Air</div>
              <div className="mt-1 text-sm text-slate-400">Raw water vs recycled — realtime hingga saat ini.</div>
            </div>
            <div className="flex items-center gap-1 rounded-full border border-slate-800 bg-slate-950/80 px-1 text-xs">
              {ranges.map((item) => (
                <button key={item.id} type="button" onClick={() => setRange(item.id)}
                  className={["rounded-full px-3 py-1.5 font-semibold transition", range === item.id ? "bg-slate-500 text-white" : "text-slate-400 hover:text-slate-300"].join(" ")}>
                  {item.label}
                </button>
              ))}
            </div>
          </div>
          <div className="mt-4">
            <MultiLineChart series={waterMlSeries} unit="m³" heightClassName="h-56" />
          </div>
        </section>
        <section className="rounded-2xl border border-slate-800 bg-slate-950/70 p-5">
          <div className="text-xs uppercase tracking-[0.2em] text-slate-500">Distribusi Air</div>
          <div className="mt-1 text-sm text-slate-400">RO Plant, Cooling Tower, Domestic.</div>
          <div className="mt-4 flex justify-center">
            <DonutChart segments={donutSegments} size={180} thickness={22} centerLabel="100%" />
          </div>
        </section>
      </div>

      <section className="rounded-2xl border border-slate-800 bg-slate-950/70 p-5">
        <div className="text-xs uppercase tracking-[0.2em] text-slate-500">Parameter & Rate Limit</div>
        <div className="mt-3 grid gap-3 sm:grid-cols-3">
          <div className="rounded-lg border border-slate-800 bg-slate-950/60 p-3 transition hover:border-slate-700">
            <div className="text-xs text-slate-400">Recycle Target</div>
            <div className="mt-1 font-semibold text-slate-200">&gt; 30%</div>
          </div>
          <div className="rounded-lg border border-slate-800 bg-slate-950/60 p-3 transition hover:border-slate-700">
            <div className="text-xs text-slate-400">Daily Limit Quota</div>
            <div className="mt-1 font-semibold text-slate-200">850 m³/day</div>
          </div>
          <div className="rounded-lg border border-slate-800 bg-slate-950/60 p-3 transition hover:border-slate-700">
            <div className="text-xs text-slate-400">Quality Standard</div>
            <div className="mt-1 font-semibold text-slate-200">Permenkes 492/2010</div>
          </div>
        </div>
      </section>

      <section className="rounded-2xl border border-slate-800 bg-slate-950/70 p-5">
        <div>
          <div className="text-xs uppercase tracking-[0.2em] text-slate-500">Bar Chart Konsumsi</div>
          <div className="text-sm text-slate-400">Bar per periode (data realtime, masa depan kosong).</div>
        </div>
        <div className="mt-4">
          <UtilityBarChart labels={labels} values={series} unit="m³" color="#3bb77e" height={220} />
        </div>
      </section>
    </div>
  );
}
