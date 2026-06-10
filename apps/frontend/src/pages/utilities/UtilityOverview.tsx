import { useMemo, useState } from "react";
import { PageHeader } from "../../components/ui/PageHeader";
import { EnergyTrendStackedChart } from "../../components/charts/EnergyTrendStackedChart";
import { MultiLineChart } from "../../components/charts/MultiLineChart";
import { DonutChart } from "../../components/charts/DonutChart";
import { utilityEquipment } from "../../data/equipment";
import { machineGroups } from "../../data/machines";
import { buildTimeAwareSeries, buildTimeLabels, getElapsedIndex } from "../../utils/series";

const dailyEnergyTotal = machineGroups.reduce((sum, group) => {
  const energy = group.summaryCards.find((card) => card.label === "Total Energy")?.value ?? 0;
  return sum + energy;
}, 0);

const utilityBase = {
  electricityKwh: dailyEnergyTotal,
  gasSm3: dailyEnergyTotal / 7,
  waterM3: dailyEnergyTotal / 25
};

const utilityRates = {
  electricityIdr: 1467,
  waterIdr: 12000,
  gasUsd: 0.38
};

const gasEnergyFactor = 10.6;
const waterEnergyFactor = 0.4;

const ranges = [
  { id: "ytd", label: "YTD", points: 12, type: "month" as const, scale: 30 },
  { id: "day", label: "Per Hari", points: 30, type: "day" as const, scale: 1 },
  { id: "month", label: "Per Bulan", points: 12, type: "month" as const, scale: 30 },
  { id: "year", label: "Per Tahun", points: 5, type: "year" as const, scale: 365 }
] as const;

const formatCurrency = (value: number, currency: "IDR" | "USD") =>
  new Intl.NumberFormat(currency === "IDR" ? "id-ID" : "en-US", { style: "currency", currency, maximumFractionDigits: 0 }).format(value);

export default function UtilityOverview() {
  const [range, setRange] = useState<(typeof ranges)[number]["id"]>("ytd");
  const config = ranges.find((item) => item.id === range) ?? ranges[0];

  const maxIdx = useMemo(() => getElapsedIndex(config.type), [config.type]);

  const electricitySeries = useMemo(() => {
    const base = utilityBase.electricityKwh * config.scale;
    return buildTimeAwareSeries(config.points, base, base * 0.35, 1, maxIdx);
  }, [config, maxIdx]);

  const gasSeries = useMemo(() => {
    const base = utilityBase.gasSm3 * config.scale;
    return buildTimeAwareSeries(config.points, base, base * 0.3, 2, maxIdx);
  }, [config, maxIdx]);

  const waterSeries = useMemo(() => {
    const base = utilityBase.waterM3 * config.scale;
    return buildTimeAwareSeries(config.points, base, base * 0.25, 3, maxIdx);
  }, [config, maxIdx]);

  const labels = useMemo(() => buildTimeLabels(config.points, config.type), [config]);

  const electricityTotal = electricitySeries.reduce((sum, v) => sum + (v ?? 0), 0);
  const gasTotal = gasSeries.reduce((sum, v) => sum + (v ?? 0), 0);
  const waterTotal = waterSeries.reduce((sum, v) => sum + (v ?? 0), 0);

  const electricityCost = electricityTotal * utilityRates.electricityIdr;
  const gasCostUsd = gasTotal * utilityRates.gasUsd;
  const waterCost = waterTotal * utilityRates.waterIdr;

  const multiSeries = useMemo(() => [
    { name: "Listrik", values: electricitySeries, color: "#2f8ae5" },
    { name: "Gas", values: gasSeries.map((v) => (v ?? 0) * gasEnergyFactor), color: "#f4c542" },
    { name: "Air", values: waterSeries.map((v) => (v ?? 0) * waterEnergyFactor), color: "#3bb77e", dashed: true }
  ], [electricitySeries, gasSeries, waterSeries]);

  const donutSegments = useMemo(() => [
    { label: "Listrik", value: electricityTotal, color: "rgba(47, 138, 229, 0.88)" },
    { label: "Gas", value: gasTotal, color: "rgba(244, 197, 66, 0.85)" },
    { label: "Air", value: waterTotal, color: "rgba(59, 183, 126, 0.85)" }
  ], [electricityTotal, gasTotal, waterTotal]);

  return (
    <div className="space-y-5">
      <PageHeader title="Utility Overview" description="Ringkasan konsumsi listrik, gas, dan air untuk seluruh plant." />

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-2xl border border-slate-800 bg-slate-950/70 p-4 transition hover:border-slate-700 hover:bg-slate-950/80">
          <div className="text-xs uppercase tracking-[0.2em] text-slate-500">Listrik</div>
          <div className="mt-2 text-2xl font-semibold text-slate-100">{formatCurrency(electricityCost, "IDR")}</div>
          <div className="mt-1 text-xs text-slate-400">{electricityTotal.toFixed(0)} kWh</div>
        </div>
        <div className="rounded-2xl border border-slate-800 bg-slate-950/70 p-4 transition hover:border-slate-700 hover:bg-slate-950/80">
          <div className="text-xs uppercase tracking-[0.2em] text-slate-500">Gas</div>
          <div className="mt-2 text-2xl font-semibold text-slate-100">{formatCurrency(gasCostUsd, "USD")}</div>
          <div className="mt-1 text-xs text-slate-400">{gasTotal.toFixed(0)} Sm³</div>
        </div>
        <div className="rounded-2xl border border-slate-800 bg-slate-950/70 p-4 transition hover:border-slate-700 hover:bg-slate-950/80">
          <div className="text-xs uppercase tracking-[0.2em] text-slate-500">Air</div>
          <div className="mt-2 text-2xl font-semibold text-slate-100">{formatCurrency(waterCost, "IDR")}</div>
          <div className="mt-1 text-xs text-slate-400">{waterTotal.toFixed(0)} m³</div>
        </div>
        <div className="rounded-2xl border border-slate-800 bg-slate-950/70 p-4 transition hover:border-slate-700 hover:bg-slate-950/80">
          <div className="text-xs uppercase tracking-[0.2em] text-slate-500">Total (IDR Equiv)</div>
          <div className="mt-2 text-2xl font-semibold text-slate-100">{formatCurrency(electricityCost + waterCost + gasCostUsd * 16200, "IDR")}</div>
          <div className="mt-1 text-xs text-slate-400">Total biaya energi</div>
        </div>
      </section>

      <div className="grid gap-4 lg:grid-cols-[2fr_1fr]">
        <section className="rounded-2xl border border-slate-800 bg-slate-950/70 p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="text-xs uppercase tracking-[0.2em] text-slate-500">Trend Konsumsi Energi</div>
              <div className="mt-1 text-sm text-slate-400">Listrik, gas, air (kWh setara) — realtime hingga saat ini.</div>
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
            <MultiLineChart series={multiSeries} unit="kWh" heightClassName="h-56" />
          </div>
        </section>
        <section className="rounded-2xl border border-slate-800 bg-slate-950/70 p-5">
          <div className="text-xs uppercase tracking-[0.2em] text-slate-500">Distribusi Energi</div>
          <div className="mt-1 text-sm text-slate-400">Proporsi listrik, gas, air.</div>
          <div className="mt-4 flex justify-center">
            <DonutChart segments={donutSegments} size={180} thickness={22} centerLabel="100%" />
          </div>
        </section>
      </div>

      <section className="rounded-2xl border border-slate-800 bg-slate-950/70 p-5">
        <div className="text-xs uppercase tracking-[0.2em] text-slate-500">Stacked Energy Trend</div>
        <div className="mt-1 text-sm text-slate-400">Listrik, gas, dan air (kWh setara).</div>
        <div className="mt-4">
          <EnergyTrendStackedChart
            labels={labels}
            electricity={electricitySeries}
            gas={gasSeries.map((v) => (v ?? 0) * gasEnergyFactor)}
            water={waterSeries.map((v) => (v ?? 0) * waterEnergyFactor)}
          />
        </div>
      </section>

      <section className="rounded-2xl border border-slate-800 bg-slate-950/70 p-5">
        <div className="text-xs uppercase tracking-[0.2em] text-slate-500">Utility Equipment Highlight</div>
        <div className="mt-4 grid gap-3 md:grid-cols-3">
          {utilityEquipment.slice(0, 6).map((item) => (
            <div key={item.id} className="rounded-lg border border-slate-800 bg-slate-950/60 px-3 py-2 transition hover:border-slate-700">
              <div className="text-xs font-semibold text-slate-200">{item.name}</div>
              <div className="text-xs text-slate-400">{item.code}</div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
