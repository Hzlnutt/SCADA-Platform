import { useMemo, useState } from "react";
import { PageHeader } from "../../components/ui/PageHeader";
import { UtilityBarChart } from "../../components/charts/UtilityBarChart";
import { machineGroups } from "../../data/machines";
import { buildLabels, buildSeries } from "../../utils/series";

const dailyEnergyTotal = machineGroups.reduce((sum, group) => {
  const energy = group.summaryCards.find((card) => card.label === "Total Energy")?.value ?? 0;
  return sum + energy;
}, 0);

const waterBase = dailyEnergyTotal / 25;
const waterRate = 12000;

const ranges = [
  { id: "day", label: "Per Hari", points: 30, stepMs: 24 * 60 * 60 * 1000, type: "day", scale: 1 },
  { id: "month", label: "Per Bulan", points: 12, stepMs: 30 * 24 * 60 * 60 * 1000, type: "month", scale: 30 },
  { id: "year", label: "Per Tahun", points: 5, stepMs: 365 * 24 * 60 * 60 * 1000, type: "year", scale: 365 }
] as const;

const formatCurrency = (value: number) =>
  new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0
  }).format(value);

export default function Water() {
  const [range, setRange] = useState<(typeof ranges)[number]["id"]>("day");
  const config = ranges.find((item) => item.id === range) ?? ranges[0];

  const series = useMemo(() => {
    const base = waterBase * config.scale;
    return buildSeries(config.points, base, base * 0.25, 3);
  }, [config]);

  const labels = useMemo(() => buildLabels(config.points, config.stepMs, config.type), [config]);
  const total = series.reduce((sum, value) => sum + value, 0);
  const cost = total * waterRate;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Air"
        description="Pantau konsumsi air proses, utilitas, dan biaya per periode."
      />

      <section className="grid gap-4 md:grid-cols-3">
        <div className="rounded-2xl border border-[#c7dbf2] bg-white/90 p-4 shadow-[0_18px_38px_rgba(20,93,170,0.12)]">
          <div className="text-xs uppercase tracking-[0.2em] text-[#4c78a6]">Total Konsumsi</div>
          <div className="mt-2 text-2xl font-semibold text-[#0b3a68]">{total.toFixed(0)} m3</div>
          <div className="mt-1 text-xs text-[#4c78a6]">{formatCurrency(cost)}</div>
        </div>
        <div className="rounded-2xl border border-[#c7dbf2] bg-white/90 p-4 shadow-[0_18px_38px_rgba(20,93,170,0.12)]">
          <div className="text-xs uppercase tracking-[0.2em] text-[#4c78a6]">Peak Usage</div>
          <div className="mt-2 text-2xl font-semibold text-[#0b3a68]">{Math.max(...series).toFixed(1)} m3</div>
          <div className="mt-1 text-xs text-[#4c78a6]">Kebutuhan puncak air.</div>
        </div>
        <div className="rounded-2xl border border-[#c7dbf2] bg-white/90 p-4 shadow-[0_18px_38px_rgba(20,93,170,0.12)]">
          <div className="text-xs uppercase tracking-[0.2em] text-[#4c78a6]">Recycle Ratio</div>
          <div className="mt-2 text-2xl font-semibold text-[#0b3a68]">32%</div>
          <div className="mt-1 text-xs text-[#4c78a6]">Rasio pemakaian ulang air.</div>
        </div>
      </section>

      <section className="rounded-2xl border border-[#c7dbf2] bg-white/90 p-5 shadow-[0_18px_38px_rgba(20,93,170,0.12)]">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="text-xs uppercase tracking-[0.2em] text-[#4c78a6]">Trend Konsumsi Air</div>
            <div className="text-sm text-[#2a5b91]">Pantau pola konsumsi air bersih.</div>
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
            unit="m3"
            color="#3bb77e"
            height={220}
          />
        </div>
      </section>
    </div>
  );
}
