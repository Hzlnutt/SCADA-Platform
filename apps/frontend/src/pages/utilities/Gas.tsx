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
      { name: "Boiler 1 Flow", values: buildTimeAwareSeries(config.points, base, base * 0.15, 1, maxIdx), color: "#f4c542" },
      { name: "Boiler 2 Flow", values: buildTimeAwareSeries(config.points, base, base * 0.25, 2, maxIdx), color: "#e07b2c", dashed: true }
    ];
  }, [config, maxIdx]);

  const donutSegments = useMemo(() => [
    { label: "Boiler 1", value: 55, color: "rgba(244, 197, 66, 0.88)" },
    { label: "Boiler 2", value: 45, color: "rgba(224, 123, 44, 0.85)" }
  ], []);

  return (
    <div className="space-y-5">
      <PageHeader title="Gas" description="Monitor konsumsi gas dan biaya energi berbasis USD." />

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-2xl border border-slate-800 bg-slate-950/70 p-4 transition hover:border-slate-700 hover:bg-slate-950/80">
          <div className="text-xs uppercase tracking-[0.2em] text-slate-500">Total Biaya</div>
          <div className="mt-2 text-2xl font-semibold text-slate-100">{formatCurrency(costUsd, "USD")}</div>
          <div className="mt-1 text-xs text-slate-400">{formatCurrency(costIdr, "IDR")} &middot; {total.toFixed(0)} Sm³</div>
        </div>
        <div className="rounded-2xl border border-slate-800 bg-slate-950/70 p-4 transition hover:border-slate-700 hover:bg-slate-950/80">
          <div className="text-xs uppercase tracking-[0.2em] text-slate-500">Peak Usage</div>
          <div className="mt-2 text-2xl font-semibold text-slate-100">{peak.toFixed(1)} Sm³</div>
          <div className="mt-1 text-xs text-slate-400">Kebutuhan gas maksimum</div>
        </div>
        <div className="rounded-2xl border border-slate-800 bg-slate-950/70 p-4 transition hover:border-slate-700 hover:bg-slate-950/80">
          <div className="text-xs uppercase tracking-[0.2em] text-slate-500">Kurs IDR</div>
          <div className="mt-2 text-2xl font-semibold text-slate-100">Rp 16,200</div>
          <div className="mt-1 text-xs text-slate-400">per USD</div>
        </div>
        <div className="rounded-2xl border border-slate-800 bg-slate-950/70 p-4 transition hover:border-slate-700 hover:bg-slate-950/80">
          <div className="text-xs uppercase tracking-[0.2em] text-slate-500">Tarif</div>
          <div className="mt-2 text-2xl font-semibold text-slate-100">$0.38</div>
          <div className="mt-1 text-xs text-slate-400">per Sm³</div>
        </div>
      </section>

      <div className="grid gap-4 lg:grid-cols-[2fr_1fr]">
        <section className="rounded-2xl border border-slate-800 bg-slate-950/70 p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="text-xs uppercase tracking-[0.2em] text-slate-500">Trend Aliran Boiler</div>
              <div className="mt-1 text-sm text-slate-400">Boiler 1 dan Boiler 2 gas flow — realtime hingga saat ini.</div>
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
            <MultiLineChart series={boilerSeries} unit="Sm³" heightClassName="h-56" />
          </div>
        </section>
        <section className="rounded-2xl border border-slate-800 bg-slate-950/70 p-5">
          <div className="text-xs uppercase tracking-[0.2em] text-slate-500">Distribusi Gas</div>
          <div className="mt-1 text-sm text-slate-400">Boiler 1 vs Boiler 2.</div>
          <div className="mt-4 flex justify-center">
            <DonutChart segments={donutSegments} size={180} thickness={22} centerLabel="100%" />
          </div>
        </section>
      </div>

      <section className="rounded-2xl border border-slate-800 bg-slate-950/70 p-5">
        <div className="text-xs uppercase tracking-[0.2em] text-slate-500">Parameter & Rate Limit</div>
        <div className="mt-3 grid gap-3 sm:grid-cols-3">
          <div className="rounded-lg border border-slate-800 bg-slate-950/60 p-3 transition hover:border-slate-700">
            <div className="text-xs text-slate-400">Target Pressure</div>
            <div className="mt-1 font-semibold text-slate-200">4 - 6 bar</div>
          </div>
          <div className="rounded-lg border border-slate-800 bg-slate-950/60 p-3 transition hover:border-slate-700">
            <div className="text-xs text-slate-400">Min Heating Value</div>
            <div className="mt-1 font-semibold text-slate-200">38.5 MJ/Sm³</div>
          </div>
          <div className="rounded-lg border border-slate-800 bg-slate-950/60 p-3 transition hover:border-slate-700">
            <div className="text-xs text-slate-400">Supply Contract</div>
            <div className="mt-1 font-semibold text-slate-200">50,000 Sm³/mo</div>
          </div>
        </div>
      </section>

      <section className="rounded-2xl border border-slate-800 bg-slate-950/70 p-5">
        <div>
          <div className="text-xs uppercase tracking-[0.2em] text-slate-500">Bar Chart Konsumsi</div>
          <div className="text-sm text-slate-400">Bar per periode (data realtime, masa depan kosong).</div>
        </div>
        <div className="mt-4">
          <UtilityBarChart labels={labels} values={series} unit="Sm³" color="#f4c542" height={220} />
        </div>
      </section>
    </div>
  );
}
