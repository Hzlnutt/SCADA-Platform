import { useEffect, useMemo, useState } from "react";
import { PageHeader } from "../components/ui/PageHeader";
import { ProgressRing } from "../components/ui/ProgressRing";
import { UtilityBarChart } from "../components/charts/UtilityBarChart";
import { EnergyTrendStackedChart } from "../components/charts/EnergyTrendStackedChart";
import { EnergyDonutChart } from "../components/charts/EnergyDonutChart";
import { ComparisonBarChart } from "../components/charts/ComparisonBarChart";
import { TimeRangeControls } from "../components/ui/TimeRangeControls";
import { machineGroups } from "../data/machines";
import { getJson } from "../services/api.client";
import { useTimeRangeStore } from "../store/timeRange.store";

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

const emissionFactor = 0.00082;
const gasEnergyFactor = 10.6;
const waterEnergyFactor = 0.4;

const periods = [
  { id: "daily", label: "Harian", scale: 1 },
  { id: "monthly", label: "Bulanan", scale: 30 },
  { id: "yearly", label: "Tahunan", scale: 365 }
] as const;

const consumptionRanges = [
  { id: "hour", label: "Per Jam", points: 24, stepMs: 60 * 60 * 1000, type: "time", scale: 1 / 24 },
  { id: "day", label: "Per Hari", points: 30, stepMs: 24 * 60 * 60 * 1000, type: "day", scale: 1 },
  { id: "month", label: "Per Bulan", points: 12, stepMs: 30 * 24 * 60 * 60 * 1000, type: "month", scale: 30 },
  { id: "year", label: "Per Tahun", points: 5, stepMs: 365 * 24 * 60 * 60 * 1000, type: "year", scale: 365 }
] as const;

const compareRanges = {
  "5m": { points: 6, stepMs: 60 * 1000, label: "time" },
  "1h": { points: 12, stepMs: 5 * 60 * 1000, label: "time" },
  "1d": { points: 24, stepMs: 60 * 60 * 1000, label: "day" },
  "1w": { points: 7, stepMs: 24 * 60 * 60 * 1000, label: "day" },
  "1m": { points: 30, stepMs: 24 * 60 * 60 * 1000, label: "day" },
  "1y": { points: 12, stepMs: 30 * 24 * 60 * 60 * 1000, label: "month" }
} as const;

const buildSeries = (length: number, base: number, variance: number, phase = 0) =>
  Array.from({ length }, (_, i) => {
    const wave = Math.sin((i + phase) / 3) + Math.cos((i + phase) / 7);
    return Number((base + wave * variance * 0.6).toFixed(2));
  });

const buildLabels = (
  points: number,
  stepMs: number,
  type: "time" | "day" | "month" | "year"
) => {
  const now = new Date();
  return Array.from({ length: points }, (_, index) => {
    const date = new Date(now.getTime() - (points - 1 - index) * stepMs);
    if (type === "time") {
      return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    }
    if (type === "month") {
      return date.toLocaleDateString([], { month: "short" });
    }
    if (type === "year") {
      return date.getFullYear().toString();
    }
    return date.toLocaleDateString([], { month: "short", day: "numeric" });
  });
};

const formatCurrency = (value: number, currency: "IDR" | "USD") =>
  new Intl.NumberFormat(currency === "IDR" ? "id-ID" : "en-US", {
    style: "currency",
    currency,
    maximumFractionDigits: 0
  }).format(value);

type ThresholdItem = {
  groupId: string;
  metric: string;
  unit: string;
  lower: number | null;
  upper: number | null;
};

type ThresholdListResponse = {
  data: ThresholdItem[];
};

export default function Dashboard() {
  const [periodIndex, setPeriodIndex] = useState(0);
  const [consumptionRange, setConsumptionRange] = useState<(typeof consumptionRanges)[number]["id"]>("hour");
  const [usdToIdr, setUsdToIdr] = useState(16200);
  const [thresholds, setThresholds] = useState<ThresholdItem[]>([]);
  const { range, compare } = useTimeRangeStore();

  useEffect(() => {
    const interval = window.setInterval(() => {
      setPeriodIndex((prev) => (prev + 1) % periods.length);
    }, 9000);

    return () => window.clearInterval(interval);
  }, []);

  useEffect(() => {
    getJson<ThresholdListResponse>("/thresholds")
      .then((result) => setThresholds(result.data))
      .catch(() => setThresholds([]));
  }, []);

  useEffect(() => {
    fetch("https://api.exchangerate.host/latest?base=USD&symbols=IDR")
      .then((res) => res.json())
      .then((data) => {
        const rate = data?.rates?.IDR;
        if (typeof rate === "number") {
          setUsdToIdr(rate);
        }
      })
      .catch(() => undefined);
  }, []);

  const period = periods[periodIndex];
  const electricityKwh = utilityBase.electricityKwh * period.scale;
  const gasSm3 = utilityBase.gasSm3 * period.scale;
  const waterM3 = utilityBase.waterM3 * period.scale;

  const electricityCost = electricityKwh * utilityRates.electricityIdr;
  const waterCost = waterM3 * utilityRates.waterIdr;
  const gasCostUsd = gasSm3 * utilityRates.gasUsd;
  const gasCostIdr = gasCostUsd * usdToIdr;
  const totalCostIdr = electricityCost + waterCost + gasCostIdr;

  const energyTarget = electricityKwh * 1.12;
  const costTarget = totalCostIdr * 1.08;

  const consumptionConfig = consumptionRanges.find((item) => item.id === consumptionRange) ?? consumptionRanges[0];

  const electricitySeries = useMemo(() => {
    const base = utilityBase.electricityKwh * consumptionConfig.scale;
    return buildSeries(consumptionConfig.points, base, base * 0.35, 1);
  }, [consumptionConfig]);

  const gasSeries = useMemo(() => {
    const base = utilityBase.gasSm3 * consumptionConfig.scale;
    return buildSeries(consumptionConfig.points, base, base * 0.3, 2);
  }, [consumptionConfig]);

  const waterSeries = useMemo(() => {
    const base = utilityBase.waterM3 * consumptionConfig.scale;
    return buildSeries(consumptionConfig.points, base, base * 0.25, 3);
  }, [consumptionConfig]);

  const consumptionLabels = useMemo(
    () => buildLabels(consumptionConfig.points, consumptionConfig.stepMs, consumptionConfig.type),
    [consumptionConfig]
  );

  const compareConfig = compareRanges[range];
  const compareLabels = buildLabels(compareConfig.points, compareConfig.stepMs, compareConfig.label);
  const compareCurrent = buildSeries(compareConfig.points, utilityBase.electricityKwh / 24, utilityBase.electricityKwh / 60, 2);
  const comparePrevious = compareCurrent.map((value) => Number((value * 0.92).toFixed(2)));

  const monthlyElectric = utilityBase.electricityKwh * 30;
  const monthlyGasEnergy = utilityBase.gasSm3 * 30 * gasEnergyFactor;
  const monthlyWaterEnergy = utilityBase.waterM3 * 30 * waterEnergyFactor;
  const totalMonthlyEnergy = monthlyElectric + monthlyGasEnergy + monthlyWaterEnergy;
  const co2Emission = totalMonthlyEnergy * emissionFactor;

  const thresholdKwh = thresholds.find((item) => item.metric === "kwh");

  return (
    <div className="space-y-6">
      <PageHeader
        title="Utility & Energy Monitoring Dashboard"
        description="Ringkasan konsumsi energi, biaya, dan tren utilitas utama."
      />

      <div className="grid gap-4 xl:grid-cols-[1.6fr_1fr]">
        <section className="rounded-2xl border border-slate-800 bg-gradient-to-br from-slate-950 via-slate-900 to-[#0c1b33] p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="text-xs uppercase tracking-[0.2em] text-slate-500">
                Total Energi & Biaya
              </div>
              <div className="mt-1 text-sm text-slate-300">
                Nilai kumulatif dari seluruh mesin berdasarkan periode.
              </div>
            </div>
            <div className="flex items-center gap-2 rounded-full border border-slate-700 bg-slate-950/60 p-1 text-xs">
              {periods.map((item, index) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setPeriodIndex(index)}
                  className={[
                    "rounded-full px-3 py-1 font-semibold",
                    periodIndex === index
                      ? "bg-cyan-500/20 text-cyan-200"
                      : "text-slate-400"
                  ].join(" ")}
                >
                  {item.label}
                </button>
              ))}
            </div>
          </div>

          <div className="mt-5 overflow-hidden">
            <div
              className="flex transition-transform duration-500"
              style={{ transform: `translateX(-${periodIndex * 100}%)` }}
            >
              {periods.map((item) => (
                <div key={item.id} className="min-w-full">
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="rounded-xl border border-slate-800 bg-slate-950/70 p-4">
                      <ProgressRing
                        value={electricityKwh}
                        target={energyTarget}
                        label={`Total Energi ${item.label}`}
                        unit="kWh"
                        tone="cyan"
                      />
                    </div>
                    <div className="rounded-xl border border-slate-800 bg-slate-950/70 p-4">
                      <ProgressRing
                        value={totalCostIdr}
                        target={costTarget}
                        label={`Total Biaya ${item.label}`}
                        unit="IDR"
                        tone="amber"
                      />
                      <div className="mt-3 text-xs text-slate-500">
                        Kurs USD/IDR: {usdToIdr.toLocaleString()}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="rounded-2xl border border-slate-800 bg-slate-950/70 p-5">
          <div className="text-xs uppercase tracking-[0.2em] text-slate-500">
            Ringkasan Distribusi Energi Bulan Ini
          </div>
          <div className="mt-4">
            <EnergyDonutChart
              labels={["Listrik", "Gas", "Air"]}
              values={[monthlyElectric, monthlyGasEnergy, monthlyWaterEnergy]}
              colors={["rgba(56, 189, 248, 0.95)", "rgba(250, 204, 21, 0.85)", "rgba(74, 222, 128, 0.85)"]}
              centerLabel="Total"
              centerValue={`${totalMonthlyEnergy.toFixed(0)} kWh`}
            />
          </div>
          <div className="mt-4 rounded-xl border border-slate-800 bg-slate-950/80 p-3">
            <div className="text-xs uppercase tracking-[0.2em] text-slate-500">
              Estimasi CO2 Emission
            </div>
            <div className="mt-2 text-lg font-semibold text-slate-100">
              {co2Emission.toFixed(1)} Ton CO2
            </div>
            <div className="text-xs text-slate-500">Perkiraan bulan berjalan.</div>
          </div>
        </section>
      </div>

      <section className="rounded-2xl border border-slate-800 bg-slate-950/70 p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="text-xs uppercase tracking-[0.2em] text-slate-500">
              Konsumsi Listrik
            </div>
            <div className="mt-1 text-lg font-semibold text-slate-100">
              {electricitySeries.reduce((sum, value) => sum + value, 0).toFixed(1)} kWh
            </div>
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
                    ? "border-cyan-400/50 bg-cyan-400/10 text-cyan-200"
                    : "border-slate-700 text-slate-400"
                ].join(" ")}
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>
        <div className="mt-4 grid gap-4 lg:grid-cols-3">
          <div className="rounded-xl border border-slate-800 bg-slate-950/80 p-4">
            <div className="text-xs uppercase tracking-[0.2em] text-slate-500">
              Listrik
            </div>
            <div className="mt-1 text-sm text-slate-300">
              {formatCurrency(electricityCost, "IDR")}
            </div>
            <div className="mt-4">
              <UtilityBarChart
                labels={consumptionLabels}
                values={electricitySeries}
                unit="kWh"
                color="#38bdf8"
                height={160}
                thresholds={thresholdKwh ? { upper: thresholdKwh.upper, lower: thresholdKwh.lower } : undefined}
              />
            </div>
          </div>
          <div className="rounded-xl border border-slate-800 bg-slate-950/80 p-4">
            <div className="text-xs uppercase tracking-[0.2em] text-slate-500">
              Gas
            </div>
            <div className="mt-1 text-sm text-slate-300">
              {formatCurrency(gasCostUsd, "USD")} ({formatCurrency(gasCostIdr, "IDR")})
            </div>
            <div className="mt-4">
              <UtilityBarChart
                labels={consumptionLabels}
                values={gasSeries}
                unit="Sm3"
                color="#facc15"
                height={160}
              />
            </div>
          </div>
          <div className="rounded-xl border border-slate-800 bg-slate-950/80 p-4">
            <div className="text-xs uppercase tracking-[0.2em] text-slate-500">
              Air
            </div>
            <div className="mt-1 text-sm text-slate-300">
              {formatCurrency(waterCost, "IDR")}
            </div>
            <div className="mt-4">
              <UtilityBarChart
                labels={consumptionLabels}
                values={waterSeries}
                unit="m3"
                color="#4ade80"
                height={160}
              />
            </div>
          </div>
        </div>
      </section>

      <div className="grid gap-4 xl:grid-cols-[1.6fr_1fr]">
        <section className="rounded-2xl border border-slate-800 bg-slate-950/70 p-5">
          <div className="mb-3 flex items-center justify-between gap-3">
            <div>
              <div className="text-xs uppercase tracking-[0.2em] text-slate-500">
                Trend Konsumsi Energi
              </div>
              <div className="text-sm text-slate-400">
                Total listrik, gas, dan air (kWh setara).
              </div>
            </div>
          </div>
          <EnergyTrendStackedChart
            labels={consumptionLabels}
            electricity={electricitySeries}
            gas={gasSeries.map((value) => value * gasEnergyFactor)}
            water={waterSeries.map((value) => value * waterEnergyFactor)}
          />
        </section>

        <section className="rounded-2xl border border-slate-800 bg-slate-950/70 p-5">
          <div className="text-xs uppercase tracking-[0.2em] text-slate-500">
            Perbandingan Range Sebelumnya
          </div>
          <div className="mt-2 text-sm text-slate-400">
            Range dibandingkan dengan periode sebelumnya.
          </div>
          <div className="mt-4">
            <TimeRangeControls />
          </div>
          <div className="mt-4">
            <ComparisonBarChart
              labels={compareLabels}
              current={compareCurrent}
              previous={compare ? comparePrevious : undefined}
              unit="kWh"
              heightClassName="h-40"
            />
          </div>
        </section>
      </div>
    </div>
  );
}
