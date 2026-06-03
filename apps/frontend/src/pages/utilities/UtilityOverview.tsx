import { useMemo, useState } from "react";
import { PageHeader } from "../../components/ui/PageHeader";
import { EnergyTrendStackedChart } from "../../components/charts/EnergyTrendStackedChart";
import { utilityEquipment } from "../../data/equipment";
import { machineGroups } from "../../data/machines";
import { buildLabels, buildSeries } from "../../utils/series";

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

const consumptionRanges = [
  { id: "day", label: "Per Hari", points: 30, stepMs: 24 * 60 * 60 * 1000, type: "day", scale: 1 },
  { id: "month", label: "Per Bulan", points: 12, stepMs: 30 * 24 * 60 * 60 * 1000, type: "month", scale: 30 },
  { id: "year", label: "Per Tahun", points: 5, stepMs: 365 * 24 * 60 * 60 * 1000, type: "year", scale: 365 }
] as const;

const formatCurrency = (value: number, currency: "IDR" | "USD") =>
  new Intl.NumberFormat(currency === "IDR" ? "id-ID" : "en-US", {
    style: "currency",
    currency,
    maximumFractionDigits: 0
  }).format(value);

export default function UtilityOverview() {
  const [consumptionRange, setConsumptionRange] = useState<(typeof consumptionRanges)[number]["id"]>("day");
  const config = consumptionRanges.find((item) => item.id === consumptionRange) ?? consumptionRanges[0];

  const electricitySeries = useMemo(() => {
    const base = utilityBase.electricityKwh * config.scale;
    return buildSeries(config.points, base, base * 0.35, 1);
  }, [config]);

  const gasSeries = useMemo(() => {
    const base = utilityBase.gasSm3 * config.scale;
    return buildSeries(config.points, base, base * 0.3, 2);
  }, [config]);

  const waterSeries = useMemo(() => {
    const base = utilityBase.waterM3 * config.scale;
    return buildSeries(config.points, base, base * 0.25, 3);
  }, [config]);

  const labels = useMemo(() => buildLabels(config.points, config.stepMs, config.type), [config]);

  const electricityCost = electricitySeries.reduce((sum, value) => sum + value, 0) * utilityRates.electricityIdr;
  const gasCostUsd = gasSeries.reduce((sum, value) => sum + value, 0) * utilityRates.gasUsd;
  const waterCost = waterSeries.reduce((sum, value) => sum + value, 0) * utilityRates.waterIdr;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Utility Overview"
        description="Ringkasan konsumsi listrik, gas, dan air untuk seluruh plant."
      />

      <section className="grid gap-4 lg:grid-cols-3">
        <div className="rounded-2xl border border-[#c7dbf2] bg-white/90 p-4 shadow-[0_18px_38px_rgba(20,93,170,0.12)]">
          <div className="text-xs uppercase tracking-[0.2em] text-[#4c78a6]">Listrik</div>
          <div className="mt-2 text-2xl font-semibold text-[#0b3a68]">
            {electricitySeries.reduce((sum, value) => sum + value, 0).toFixed(0)} kWh
          </div>
          <div className="mt-1 text-xs text-[#4c78a6]">
            {formatCurrency(electricityCost, "IDR")}
          </div>
        </div>
        <div className="rounded-2xl border border-[#c7dbf2] bg-white/90 p-4 shadow-[0_18px_38px_rgba(20,93,170,0.12)]">
          <div className="text-xs uppercase tracking-[0.2em] text-[#4c78a6]">Gas</div>
          <div className="mt-2 text-2xl font-semibold text-[#0b3a68]">
            {gasSeries.reduce((sum, value) => sum + value, 0).toFixed(0)} Sm3
          </div>
          <div className="mt-1 text-xs text-[#4c78a6]">
            {formatCurrency(gasCostUsd, "USD")}
          </div>
        </div>
        <div className="rounded-2xl border border-[#c7dbf2] bg-white/90 p-4 shadow-[0_18px_38px_rgba(20,93,170,0.12)]">
          <div className="text-xs uppercase tracking-[0.2em] text-[#4c78a6]">Air</div>
          <div className="mt-2 text-2xl font-semibold text-[#0b3a68]">
            {waterSeries.reduce((sum, value) => sum + value, 0).toFixed(0)} m3
          </div>
          <div className="mt-1 text-xs text-[#4c78a6]">
            {formatCurrency(waterCost, "IDR")}
          </div>
        </div>
      </section>

      <section className="rounded-2xl border border-[#c7dbf2] bg-white/90 p-5 shadow-[0_18px_38px_rgba(20,93,170,0.12)]">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="text-xs uppercase tracking-[0.2em] text-[#4c78a6]">Trend Konsumsi Energi</div>
            <div className="text-sm text-[#2a5b91]">Listrik, gas, dan air (kWh setara).</div>
          </div>
          <div className="flex flex-wrap items-center gap-2 text-xs">
            {consumptionRanges.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => setConsumptionRange(item.id)}
                className={[
                  "rounded-full border px-3 py-1 font-semibold",
                  consumptionRange === item.id
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
          <EnergyTrendStackedChart
            labels={labels}
            electricity={electricitySeries}
            gas={gasSeries.map((value) => value * gasEnergyFactor)}
            water={waterSeries.map((value) => value * waterEnergyFactor)}
          />
        </div>
      </section>

      <section className="rounded-2xl border border-[#c7dbf2] bg-white/90 p-5 shadow-[0_18px_38px_rgba(20,93,170,0.12)]">
        <div className="text-xs uppercase tracking-[0.2em] text-[#4c78a6]">Utility Equipment Highlight</div>
        <div className="mt-4 grid gap-3 md:grid-cols-3">
          {utilityEquipment.slice(0, 6).map((item) => (
            <div key={item.id} className="rounded-xl border border-[#d7e8fb] bg-[#f6fbff] px-3 py-2">
              <div className="text-xs font-semibold text-[#0b3a68]">{item.name}</div>
              <div className="text-xs text-[#4c78a6]">{item.code}</div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
