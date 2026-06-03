import { useMemo, useState } from "react";
import { PageHeader } from "../../components/ui/PageHeader";
import { UtilityBarChart } from "../../components/charts/UtilityBarChart";
import { machineGroups } from "../../data/machines";
import { buildLabels, buildSeries } from "../../utils/series";

const dailyEnergyTotal = machineGroups.reduce((sum, group) => {
  const energy = group.summaryCards.find((card) => card.label === "Total Energy")?.value ?? 0;
  return sum + energy;
}, 0);

const electricityRate = 1467;

const ranges = [
  { id: "hour", label: "Per Jam", points: 24, stepMs: 60 * 60 * 1000, type: "time", scale: 1 / 24 },
  { id: "day", label: "Per Hari", points: 30, stepMs: 24 * 60 * 60 * 1000, type: "day", scale: 1 },
  { id: "month", label: "Per Bulan", points: 12, stepMs: 30 * 24 * 60 * 60 * 1000, type: "month", scale: 30 }
] as const;

const formatCurrency = (value: number) =>
  new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0
  }).format(value);

export default function Electricity() {
  const [range, setRange] = useState<(typeof ranges)[number]["id"]>("day");
  const config = ranges.find((item) => item.id === range) ?? ranges[0];

  const series = useMemo(() => {
    const base = dailyEnergyTotal * config.scale;
    return buildSeries(config.points, base, base * 0.35, 1);
  }, [config]);

  const labels = useMemo(() => buildLabels(config.points, config.stepMs, config.type), [config]);
  const total = series.reduce((sum, value) => sum + value, 0);
  const cost = total * electricityRate;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Listrik"
        description="Monitor beban listrik utama, peak demand, dan biaya energi."
      />

      <section className="grid gap-4 md:grid-cols-3">
        <div className="rounded-2xl border border-[#c7dbf2] bg-white/90 p-4 shadow-[0_18px_38px_rgba(20,93,170,0.12)]">
          <div className="text-xs uppercase tracking-[0.2em] text-[#4c78a6]">Total Konsumsi</div>
          <div className="mt-2 text-2xl font-semibold text-[#0b3a68]">{total.toFixed(0)} kWh</div>
          <div className="mt-1 text-xs text-[#4c78a6]">{formatCurrency(cost)}</div>
        </div>
        <div className="rounded-2xl border border-[#c7dbf2] bg-white/90 p-4 shadow-[0_18px_38px_rgba(20,93,170,0.12)]">
          <div className="text-xs uppercase tracking-[0.2em] text-[#4c78a6]">Peak Demand</div>
          <div className="mt-2 text-2xl font-semibold text-[#0b3a68]">{Math.max(...series).toFixed(1)} kW</div>
          <div className="mt-1 text-xs text-[#4c78a6]">Estimasi beban puncak.</div>
        </div>
        <div className="rounded-2xl border border-[#c7dbf2] bg-white/90 p-4 shadow-[0_18px_38px_rgba(20,93,170,0.12)]">
          <div className="text-xs uppercase tracking-[0.2em] text-[#4c78a6]">Load Factor</div>
          <div className="mt-2 text-2xl font-semibold text-[#0b3a68]">{((total / series.length) / Math.max(...series) * 100).toFixed(1)}%</div>
          <div className="mt-1 text-xs text-[#4c78a6]">Stabilitas beban listrik.</div>
        </div>
      </section>

      <section className="rounded-2xl border border-[#c7dbf2] bg-white/90 p-5 shadow-[0_18px_38px_rgba(20,93,170,0.12)]">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="text-xs uppercase tracking-[0.2em] text-[#4c78a6]">Trend Konsumsi Listrik</div>
            <div className="text-sm text-[#2a5b91]">Lihat pola beban listrik per periode.</div>
          </div>
          <div className="flex flex-wrap items-center gap-2 text-xs">
            {ranges.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => setRange(item.id)}
                className={[
                  "rounded-full border px-3 py-1 font-semibold",
                  range === item.id
                    ? "border-[#2f8ae5] bg-[#e6f2ff] text-[#0b3a68]"
                    : "border-[#c7dbf2] text-[#4c78a6]"
                ].join(" ")}
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>
        <div className="mt-4">
          <UtilityBarChart
            labels={labels}
            values={series}
            unit="kWh"
            color="#2f8ae5"
            height={220}
          />
        </div>
      </section>
    </div>
  );
}
