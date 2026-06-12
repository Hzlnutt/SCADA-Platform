import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { utils, writeFile } from "xlsx";
import { PageHeader } from "../components/ui/PageHeader";
import { ProgressRing } from "../components/ui/ProgressRing";
import { UtilityBarChart } from "../components/charts/UtilityBarChart";
import { EnergyTrendStackedChart } from "../components/charts/EnergyTrendStackedChart";
import { EnergyDonutChart } from "../components/charts/EnergyDonutChart";
import { ComparisonBarChart } from "../components/charts/ComparisonBarChart";
import { TimeRangeControls } from "../components/ui/TimeRangeControls";
import { machineGroups } from "../data/machines";
import { hvacEquipment, utilityEquipment } from "../data/equipment";
import { getJson } from "../services/api.client";
import { useTimeRangeStore } from "../store/timeRange.store";
import { useTelemetryStore } from "../store/telemetry.store";
import { useAlarmStore } from "../store/alarm.store";
import {
  buildSeries,
  buildLabels,
  buildTimeAwareSeries,
  buildTimeLabels,
  getElapsedIndex
} from "../utils/series";

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
const solarShare = 0.18;

const periods = [
  { id: "daily", label: "Harian", scale: 1 },
  { id: "monthly", label: "Bulanan", scale: 30 },
  { id: "yearly", label: "Tahunan", scale: 365 }
] as const;

const consumptionRanges = [
  { id: "hour", label: "Per Jam", points: 24, stepMs: 60 * 60 * 1000, type: "time" as const, scale: 1 / 24 },
  { id: "day", label: "Per Hari", points: 30, stepMs: 24 * 60 * 60 * 1000, type: "day" as const, scale: 1 },
  { id: "month", label: "Per Bulan", points: 12, stepMs: 30 * 24 * 60 * 60 * 1000, type: "month" as const, scale: 30 }
] as const;

const compareRanges = {
  "5m": { points: 6, stepMs: 60 * 1000, label: "time" },
  "1h": { points: 12, stepMs: 5 * 60 * 1000, label: "time" },
  "1d": { points: 24, stepMs: 60 * 60 * 1000, label: "day" },
  "1w": { points: 7, stepMs: 24 * 60 * 60 * 1000, label: "day" },
  "1m": { points: 30, stepMs: 24 * 60 * 60 * 1000, label: "day" },
  "1y": { points: 12, stepMs: 30 * 24 * 60 * 60 * 1000, label: "month" }
} as const;

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

type StatusPreview = {
  id: string;
  name: string;
  status: "Running" | "Standby" | "Stopped";
};

const statusTone: Record<StatusPreview["status"], string> = {
  Running: "text-emerald-300",
  Standby: "text-amber-300",
  Stopped: "text-rose-300"
};

export default function Dashboard() {
  const [periodIndex, setPeriodIndex] = useState(0);
  const [consumptionRange, setConsumptionRange] = useState<(typeof consumptionRanges)[number]["id"]>("hour");
  const [usdToIdr, setUsdToIdr] = useState(16200);
  const [thresholds, setThresholds] = useState<ThresholdItem[]>([]);
  const [ytdChecks, setYtdChecks] = useState({ electricity: true, gas: true, water: true, solar: true });
  const { range, compare } = useTimeRangeStore();
  const latest = useTelemetryStore((state) => state.latest);
  const activeAlarms = useAlarmStore((state) => state.activeList);

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

  const gasEnergyKwh = gasSm3 * gasEnergyFactor;
  const waterEnergyKwh = waterM3 * waterEnergyFactor;
  const totalEnergyKwh = electricityKwh + gasEnergyKwh + waterEnergyKwh;
  const energyTarget = totalEnergyKwh * 1.12;
  const costTarget = totalCostIdr * 1.08;

  const solarKwh = electricityKwh * solarShare;
  const solarSavings = solarKwh * utilityRates.electricityIdr;
  const solarCoverage = Math.min(100, (solarKwh / Math.max(electricityKwh, 1)) * 100);

  const monthlyElectric = utilityBase.electricityKwh * 30;
  const monthlyGasEnergy = utilityBase.gasSm3 * 30 * gasEnergyFactor;
  const monthlyWaterEnergy = utilityBase.waterM3 * 30 * waterEnergyFactor;
  const totalMonthlyEnergy = monthlyElectric + monthlyGasEnergy + monthlyWaterEnergy;
  const co2Emission = totalMonthlyEnergy * emissionFactor;
  const totalCo2Kg = co2Emission * 1000;
  const trees = Math.round(totalCo2Kg / 21);

  const consumptionConfig = consumptionRanges.find((item) => item.id === consumptionRange) ?? consumptionRanges[0];

  const maxIndex = useMemo(
    () => getElapsedIndex(consumptionConfig.type),
    [consumptionConfig.type]
  );

  const electricitySeries = useMemo(() => {
    const base = utilityBase.electricityKwh * consumptionConfig.scale;
    return buildTimeAwareSeries(consumptionConfig.points, base, base * 0.35, 1, maxIndex);
  }, [consumptionConfig, maxIndex]);

  const gasSeries = useMemo(() => {
    const base = utilityBase.gasSm3 * consumptionConfig.scale;
    return buildTimeAwareSeries(consumptionConfig.points, base, base * 0.3, 2, maxIndex);
  }, [consumptionConfig, maxIndex]);

  const waterSeries = useMemo(() => {
    const base = utilityBase.waterM3 * consumptionConfig.scale;
    return buildTimeAwareSeries(consumptionConfig.points, base, base * 0.25, 3, maxIndex);
  }, [consumptionConfig, maxIndex]);

  const solarSeries = useMemo(() => {
    return electricitySeries.map((v) => (v !== null ? Number((v * solarShare).toFixed(1)) : null as unknown as number));
  }, [electricitySeries]);

  const consumptionLabels = useMemo(
    () => buildTimeLabels(consumptionConfig.points, consumptionConfig.type),
    [consumptionConfig]
  );

  const ytdMonthIndex = useMemo(() => getElapsedIndex("month"), [periodIndex]);

  const ytdElectricitySeries = useMemo(
    () => buildTimeAwareSeries(12, utilityBase.electricityKwh * 30, utilityBase.electricityKwh * 12, 1, ytdMonthIndex),
    [ytdMonthIndex]
  );

  const ytdGasSeries = useMemo(
    () => buildTimeAwareSeries(12, utilityBase.gasSm3 * 30, utilityBase.gasSm3 * 12, 2, ytdMonthIndex),
    [ytdMonthIndex]
  );

  const ytdWaterSeries = useMemo(
    () => buildTimeAwareSeries(12, utilityBase.waterM3 * 30, utilityBase.waterM3 * 8, 3, ytdMonthIndex),
    [ytdMonthIndex]
  );

  const ytdElectricityTotal = useMemo(
    () => ytdElectricitySeries.reduce((sum, v) => sum + (v ?? 0), 0),
    [ytdElectricitySeries]
  );

  const ytdGasTotal = useMemo(
    () => ytdGasSeries.reduce((sum, v) => sum + (v ?? 0), 0),
    [ytdGasSeries]
  );

  const ytdWaterTotal = useMemo(
    () => ytdWaterSeries.reduce((sum, v) => sum + (v ?? 0), 0),
    [ytdWaterSeries]
  );

  const ytdSolarSeries = useMemo(
    () => ytdElectricitySeries.map((v) => (v !== null ? Number((v * solarShare).toFixed(1)) : null as unknown as number)),
    [ytdElectricitySeries]
  );

  const ytdSolarTotal = useMemo(
    () => ytdSolarSeries.reduce((sum, v) => sum + (v ?? 0), 0),
    [ytdSolarSeries]
  );

  const ytdLabels = useMemo(() => buildTimeLabels(12, "month"), []);

  const ytdTotalSeries = useMemo(() => {
    return Array.from({ length: 12 }, (_, i) => {
      if (i > ytdMonthIndex) return null as unknown as number;
      let total = 0;
      if (ytdChecks.electricity) total += (ytdElectricitySeries[i] ?? 0);
      if (ytdChecks.gas) total += (ytdGasSeries[i] ?? 0) * gasEnergyFactor;
      if (ytdChecks.water) total += (ytdWaterSeries[i] ?? 0) * waterEnergyFactor;
      if (ytdChecks.solar) total += (ytdSolarSeries[i] ?? 0);
      return Number(total.toFixed(2));
    });
  }, [ytdElectricitySeries, ytdGasSeries, ytdWaterSeries, ytdSolarSeries, ytdChecks, ytdMonthIndex]);

  const compareConfig = compareRanges[range];
  const compareLabels = buildLabels(compareConfig.points, compareConfig.stepMs, compareConfig.label);
  const compareCurrent = buildSeries(compareConfig.points, utilityBase.electricityKwh / 24, utilityBase.electricityKwh / 60, 2);
  const comparePrevious = compareCurrent.map((value) => Number((value * 0.92).toFixed(2)));

  const thresholdKwh = thresholds.find((item) => item.metric === "kwh");

  const utilityStatusPreview = useMemo<StatusPreview[]>(() => {
    const items = utilityEquipment.slice(0, 9);
    return items.map((item) => {
      const rawValue = item.tagId ? latest[item.tagId]?.value : undefined;
      const numericValue = typeof rawValue === "number" ? rawValue : undefined;
      const status = numericValue === undefined ? "Standby" : numericValue <= 0 ? "Stopped" : "Running";
      return {
        id: item.id,
        name: `${item.name} ${item.code}`,
        status
      } satisfies StatusPreview;
    });
  }, [latest]);

  const hvacStatusPreview = useMemo<StatusPreview[]>(() => {
    const items = hvacEquipment.slice(0, 9);
    return items.map((item, index) => {
      const rawValue = item.tagId ? latest[item.tagId]?.value : undefined;
      const numericValue = typeof rawValue === "number" ? rawValue : undefined;
      const status =
        numericValue === undefined
          ? index % 5 === 0
            ? "Standby"
            : "Running"
          : numericValue <= 0
            ? "Stopped"
            : "Running";
      return {
        id: item.id,
        name: `${item.name} ${item.code}`,
        status
      } satisfies StatusPreview;
    });
  }, [latest]);

  const alarmPreview =
    activeAlarms.length > 0
      ? activeAlarms.slice(0, 4).map((alarm) => ({
          id: alarm.alarmKey,
          title: alarm.message,
          detail: alarm.tagId,
          severity: alarm.severity
        }))
      : [
          {
            id: "alarm-electricity",
            title: "Konsumsi Listrik",
            detail: "Melebihi ambang batas",
            severity: "high"
          },
          {
            id: "alarm-gas",
            title: "Tekanan Gas Boiler 1",
            detail: "Di bawah normal",
            severity: "medium"
          },
          {
            id: "alarm-water",
            title: "Level Air Cooling Tower 1",
            detail: "Di bawah normal",
            severity: "medium"
          },
          {
            id: "alarm-flow",
            title: "Flow Air Bersih",
            detail: "Di bawah normal",
            severity: "critical"
          }
        ];

  const handleExportYtd = () => {
    const rows = ytdLabels.map((label, index) => {
      const electricityValue = ytdElectricitySeries[index] ?? 0;
      const gasValue = ytdGasSeries[index] ?? 0;
      const waterValue = ytdWaterSeries[index] ?? 0;
      const solarValue = ytdSolarSeries[index] ?? 0;
      return {
        month: label,
        electricity_kwh: Number(electricityValue.toFixed(2)),
        gas_sm3: Number(gasValue.toFixed(2)),
        water_m3: Number(waterValue.toFixed(2)),
        solar_kwh: Number(solarValue.toFixed(2)),
        total_kwh_equiv: Number(ytdTotalSeries[index]?.toFixed(2) ?? 0)
      };
    });

    const worksheet = utils.json_to_sheet(rows);
    const workbook = utils.book_new();
    utils.book_append_sheet(workbook, worksheet, "YTD Energi");
    writeFile(workbook, `ytd-energi.xlsx`);
  };

  return (
    <div className="space-y-5">
      <PageHeader
        title="Utility & Energy Monitoring Dashboard"
        description="Ringkasan konsumsi energi, biaya, dan status utilitas utama."
      />

      {/* Executive Summary — 5 equal cards */}
      <section className="rounded-2xl border border-[#acd3ff] dark:border-slate-800 bg-[#f7fbff]/80 dark:bg-slate-950/70 p-5 transition-colors duration-300">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="text-xs uppercase tracking-[0.2em] text-[#47729f] dark:text-slate-500 font-semibold">
              Executive Summary
            </div>
            <div className="mt-1 text-sm text-[#47729f] dark:text-slate-400">
              Ringkasan periode {period.label.toLowerCase()}.
            </div>
          </div>
          <div className="flex items-center gap-1 rounded-full border border-[#acd3ff] dark:border-slate-800 bg-white dark:bg-slate-950/80 px-1 text-xs">
            {periods.map((item, index) => (
              <button
                key={item.id}
                type="button"
                onClick={() => setPeriodIndex(index)}
                className={[
                  "rounded-full px-3 py-1.5 font-semibold transition",
                  periodIndex === index
                    ? "bg-[#1f6fb5] text-white"
                    : "text-[#47729f] dark:text-slate-400 hover:text-[#002b5c] dark:hover:text-slate-300"
                ].join(" ")}
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
          {/* Total Energy */}
          <div className="rounded-xl border border-[#acd3ff] dark:border-slate-800 bg-white dark:bg-slate-950/60 p-4 transition-colors duration-300">
            <ProgressRing
              value={totalEnergyKwh}
              target={energyTarget}
              label="Total Energi"
              unit="kWh"
              tone="cyan"
            />
            <div className="mt-2 text-xs text-[#47729f] dark:text-slate-400">
              Gas & air dikonversi ke kWh setara.
            </div>
          </div>

          {/* Total Cost */}
          <div className="rounded-xl border border-[#acd3ff] dark:border-slate-800 bg-white dark:bg-slate-950/60 p-4 transition-colors duration-300">
            <ProgressRing
              value={totalCostIdr}
              target={costTarget}
              label="Total Biaya"
              unit="IDR"
              tone="amber"
            />
            <div className="mt-2 text-xs text-[#47729f] dark:text-slate-400">
              Kurs USD/IDR: {usdToIdr.toLocaleString()}
            </div>
          </div>

          {/* CO2 Emission */}
          <div className="rounded-xl border border-[#acd3ff] dark:border-slate-800 bg-white dark:bg-slate-950/60 p-4 transition-colors duration-300">
            <div className="text-xs uppercase tracking-[0.2em] text-[#47729f] dark:text-slate-500 font-semibold">
              CO₂ Emission
            </div>
            <div className="mt-2 text-2xl font-semibold text-[#002b5c] dark:text-slate-100">
              {co2Emission.toFixed(1)} Ton
            </div>
            <div className="mt-1 text-xs text-[#47729f] dark:text-slate-400">
              Estimasi bulan berjalan
            </div>
            <div className="mt-3 text-xs text-[#47729f]/80 dark:text-slate-500">
              Rasio distribusi energi dihitung berdasarkan emisi setara batu bara dan gas alam cair.
            </div>
          </div>

          {/* Solar Panel */}
          <div className="rounded-xl border border-[#acd3ff] dark:border-slate-800 bg-white dark:bg-slate-950/60 p-4 transition-colors duration-300">
            <div className="text-xs uppercase tracking-[0.2em] text-[#47729f] dark:text-slate-500 font-semibold">
              Solar Panel
            </div>
            <div className="mt-2 text-2xl font-semibold text-[#002b5c] dark:text-slate-100">
              {solarKwh.toFixed(0)} kWh
            </div>
            <div className="mt-1 text-xs text-[#47729f] dark:text-slate-400">
              Hemat {formatCurrency(solarSavings, "IDR")}
            </div>
            <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-slate-200 dark:bg-slate-900">
              <div
                className="h-full rounded-full bg-[#1f6fb5]"
                style={{ width: `${solarCoverage.toFixed(0)}%` }}
              />
            </div>
            <div className="mt-2 text-xs text-[#47729f] dark:text-slate-400">
              Coverage {solarCoverage.toFixed(1)}% listrik
            </div>
          </div>

          {/* CO2 Reduction */}
          <div className="rounded-xl border border-emerald-500/30 dark:border-emerald-500/20 bg-emerald-500/5 dark:bg-emerald-950/10 p-4 transition-colors duration-300">
            <div className="text-xs uppercase tracking-[0.2em] text-emerald-600 dark:text-emerald-400 font-semibold">
              CO₂ Reduction
            </div>
            <div className="mt-2 text-2xl font-semibold text-emerald-700 dark:text-emerald-300">
              {(solarKwh * 0.87).toFixed(1)} kg
            </div>
            <div className="mt-1 text-xs text-[#47729f] dark:text-slate-400">
              Mereduksi emisi karbon
            </div>
            <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-slate-200 dark:bg-slate-900">
              <div
                className="h-full rounded-full bg-emerald-500"
                style={{ width: "85%" }}
              />
            </div>
            <div className="mt-2 text-[10px] text-emerald-600 dark:text-emerald-400/80 font-medium">
              Sertifikasi Hijau Mandiri
            </div>
          </div>
        </div>
      </section>

      {/* Konsumsi Utilitas — Per Jam / Hari / Bulan */}
      <section className="rounded-2xl border border-[#acd3ff] dark:border-slate-800 bg-[#f7fbff]/80 dark:bg-slate-950/70 p-5 transition-colors duration-300">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="text-xs uppercase tracking-[0.2em] text-[#47729f] dark:text-slate-500 font-semibold">
              Konsumsi Utilitas
            </div>
            <div className="mt-1 text-sm text-[#47729f] dark:text-slate-400">
              Pilih rentang untuk listrik, gas, dan air.
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-1 rounded-full border border-[#acd3ff] dark:border-slate-800 bg-white dark:bg-slate-950/80 px-1 text-xs">
            {consumptionRanges.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => setConsumptionRange(item.id)}
                className={[
                  "rounded-full px-3 py-1.5 font-semibold transition",
                  consumptionRange === item.id
                    ? "bg-[#1f6fb5] text-white"
                    : "text-[#47729f] dark:text-slate-400 hover:text-[#002b5c] dark:hover:text-slate-300"
                ].join(" ")}
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>

        <div className="mt-4 grid gap-4 grid-cols-1 md:grid-cols-3">
          {/* 4 Utility Bar Charts Grid (Left) */}
          <div className="md:col-span-2 grid gap-4 grid-cols-1 sm:grid-cols-2">
            {/* Listrik */}
            <div className="rounded-xl border border-[#acd3ff] dark:border-slate-800 bg-white dark:bg-slate-950/60 p-4 transition-colors duration-300">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-xs uppercase tracking-[0.2em] text-[#47729f] dark:text-slate-500 font-semibold">Listrik</div>
                  <div className="mt-1 text-lg font-semibold text-[#002b5c] dark:text-slate-100">
                    {formatCurrency(electricityCost, "IDR")}
                  </div>
                  <div className="mt-0.5 text-xs text-[#47729f] dark:text-slate-400">
                    {electricitySeries.reduce((sum, v) => sum + v, 0).toFixed(1)} kWh
                  </div>
                </div>
                <div className="h-2 w-2 rounded-full bg-[#2f8ae5]" />
              </div>
              <div className="mt-3">
                <UtilityBarChart
                  labels={consumptionLabels}
                  values={electricitySeries}
                  unit="kWh"
                  color="#2f8ae5"
                  height={160}
                  thresholds={thresholdKwh ? { upper: thresholdKwh.upper, lower: thresholdKwh.lower } : undefined}
                />
              </div>
            </div>

            {/* Gas */}
            <div className="rounded-xl border border-[#acd3ff] dark:border-slate-800 bg-white dark:bg-slate-950/60 p-4 transition-colors duration-300">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-xs uppercase tracking-[0.2em] text-[#47729f] dark:text-slate-500 font-semibold">Gas</div>
                  <div className="mt-1 text-lg font-semibold text-[#002b5c] dark:text-slate-100">
                    {formatCurrency(gasCostUsd, "USD")}
                  </div>
                  <div className="mt-0.5 text-xs text-[#47729f] dark:text-slate-400">
                    {formatCurrency(gasCostIdr, "IDR")} &middot; {gasSeries.reduce((sum, v) => sum + v, 0).toFixed(1)} Sm³
                  </div>
                </div>
                <div className="h-2 w-2 rounded-full bg-[#f4c542]" />
              </div>
              <div className="mt-3">
                <UtilityBarChart
                  labels={consumptionLabels}
                  values={gasSeries}
                  unit="Sm³"
                  color="#f4c542"
                  height={160}
                />
              </div>
            </div>

            {/* Air */}
            <div className="rounded-xl border border-[#acd3ff] dark:border-slate-800 bg-white dark:bg-slate-950/60 p-4 transition-colors duration-300">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-xs uppercase tracking-[0.2em] text-[#47729f] dark:text-slate-500 font-semibold">Air</div>
                  <div className="mt-1 text-lg font-semibold text-[#002b5c] dark:text-slate-100">
                    {formatCurrency(waterCost, "IDR")}
                  </div>
                  <div className="mt-0.5 text-xs text-[#47729f] dark:text-slate-400">
                    {waterSeries.reduce((sum, v) => sum + v, 0).toFixed(1)} m³
                  </div>
                </div>
                <div className="h-2 w-2 rounded-full bg-[#3bb77e]" />
              </div>
              <div className="mt-3">
                <UtilityBarChart
                  labels={consumptionLabels}
                  values={waterSeries}
                  unit="m³"
                  color="#3bb77e"
                  height={160}
                />
              </div>
            </div>

            {/* Solar Panel */}
            <div className="rounded-xl border border-[#acd3ff] dark:border-slate-800 bg-white dark:bg-slate-950/60 p-4 transition-colors duration-300">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-xs uppercase tracking-[0.2em] text-[#47729f] dark:text-slate-500 font-semibold">Solar Panel</div>
                  <div className="mt-1 text-lg font-semibold text-[#002b5c] dark:text-slate-100">
                    {formatCurrency(solarSavings, "IDR")}
                  </div>
                  <div className="mt-0.5 text-xs text-[#47729f] dark:text-slate-400">
                    {solarSeries.reduce((sum, v) => sum + (v ?? 0), 0).toFixed(1)} kWh
                  </div>
                </div>
                <div className="h-2 w-2 rounded-full bg-[#f59e0b]" />
              </div>
              <div className="mt-3">
                <UtilityBarChart
                  labels={consumptionLabels}
                  values={solarSeries}
                  unit="kWh"
                  color="#f59e0b"
                  height={160}
                />
              </div>
            </div>
          </div>

          {/* Distribusi Energi (Right) */}
          <div className="md:col-span-1 rounded-xl border border-[#acd3ff] dark:border-slate-800 bg-white dark:bg-slate-950/60 p-4 transition-colors duration-300 flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-xs uppercase tracking-[0.2em] text-[#47729f] dark:text-slate-500 font-semibold">Distribusi Energi</div>
                <div className="mt-1 text-sm font-semibold text-[#47729f] dark:text-slate-400 font-medium">Bulan Ini</div>
              </div>
              <div className="text-[10px] text-emerald-600 dark:text-emerald-400 font-semibold">
                ≈ {trees.toLocaleString("id-ID")} pohon
              </div>
            </div>
            <div className="mt-3 flex-1 flex items-center justify-center min-h-[200px]">
              <EnergyDonutChart
                labels={["Listrik", "Gas", "Air"]}
                values={[monthlyElectric, monthlyGasEnergy, monthlyWaterEnergy]}
                colors={["rgba(56, 189, 248, 0.9)", "rgba(250, 204, 21, 0.85)", "rgba(74, 222, 128, 0.85)"]}
                centerLabel="Total"
                centerValue={`${totalMonthlyEnergy.toFixed(0)}`}
                height={160}
              />
            </div>
          </div>
        </div>
      </section>

      {/* Actual Year to Date */}
      <section className="rounded-2xl border border-[#acd3ff] dark:border-slate-800 bg-[#f7fbff]/80 dark:bg-slate-950/70 p-5 transition-colors duration-300">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="text-xs uppercase tracking-[0.2em] text-[#47729f] dark:text-slate-500 font-semibold">
              Actual Year to Date (YTD)
            </div>
            <div className="text-sm text-[#47729f] dark:text-slate-400">
              Akumulasi bulanan per kategori. Centang untuk tampilkan di grafik total.
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-3 rounded-full border border-[#acd3ff] dark:border-slate-800 bg-white dark:bg-slate-950/80 px-3 py-1.5 text-xs transition-colors duration-300">
              {([
                { key: "electricity" as const, label: "Listrik", color: "#2f8ae5" },
                { key: "gas" as const, label: "Gas", color: "#f4c542" },
                { key: "water" as const, label: "Air", color: "#3bb77e" },
                { key: "solar" as const, label: "Solar Panel", color: "#f59e0b" }
              ]).map((item) => (
                <label
                  key={item.key}
                  className="flex cursor-pointer items-center gap-1.5 font-semibold text-[#002b5c] dark:text-slate-300"
                >
                  <input
                    type="checkbox"
                    checked={ytdChecks[item.key]}
                    onChange={() =>
                      setYtdChecks((prev) => ({ ...prev, [item.key]: !prev[item.key] }))
                    }
                    className="accent-current"
                    style={{ accentColor: item.color }}
                  />
                  {item.label}
                </label>
              ))}
            </div>
            <button
              type="button"
              onClick={handleExportYtd}
              className="rounded-full border border-[#acd3ff] dark:border-slate-700 bg-white dark:bg-slate-900/60 px-4 py-1.5 text-xs font-semibold text-[#002b5c] dark:text-slate-300 transition hover:border-[#7fb3e4] hover:bg-slate-50 dark:hover:bg-slate-800"
            >
              Export Excel
            </button>
          </div>
        </div>

        {/* 4 YTD cards */}
        <div className="grid gap-4 grid-cols-1 md:grid-cols-2">
          <div className="rounded-xl border border-[#acd3ff] dark:border-slate-800 bg-white dark:bg-slate-950/60 p-4 transition-colors duration-300">
            <div className="text-xs uppercase tracking-[0.2em] text-[#47729f] dark:text-slate-500 font-semibold">Listrik YTD</div>
            <div className="mt-1 text-lg font-semibold text-[#002b5c] dark:text-slate-100">
              {formatCurrency(ytdElectricityTotal * utilityRates.electricityIdr, "IDR")}
            </div>
            <div className="mt-0.5 text-xs text-[#47729f] dark:text-slate-400">
              {ytdElectricityTotal.toFixed(0)} kWh
            </div>
            <div className="mt-3">
              <UtilityBarChart
                labels={ytdLabels}
                values={ytdElectricitySeries}
                unit="kWh"
                color="#2f8ae5"
                height={140}
              />
            </div>
          </div>

          <div className="rounded-xl border border-[#acd3ff] dark:border-slate-800 bg-white dark:bg-slate-950/60 p-4 transition-colors duration-300">
            <div className="text-xs uppercase tracking-[0.2em] text-[#47729f] dark:text-slate-500 font-semibold">Gas YTD</div>
            <div className="mt-1 text-lg font-semibold text-[#002b5c] dark:text-slate-100">
              {formatCurrency(ytdGasTotal * utilityRates.gasUsd, "USD")}
            </div>
            <div className="mt-0.5 text-xs text-[#47729f] dark:text-slate-400">
              {ytdGasTotal.toFixed(0)} Sm³
            </div>
            <div className="mt-3">
              <UtilityBarChart
                labels={ytdLabels}
                values={ytdGasSeries}
                unit="Sm³"
                color="#f4c542"
                height={140}
              />
            </div>
          </div>

          <div className="rounded-xl border border-[#acd3ff] dark:border-slate-800 bg-white dark:bg-slate-950/60 p-4 transition-colors duration-300">
            <div className="text-xs uppercase tracking-[0.2em] text-[#47729f] dark:text-slate-500 font-semibold">Air YTD</div>
            <div className="mt-1 text-lg font-semibold text-[#002b5c] dark:text-slate-100">
              {formatCurrency(ytdWaterTotal * utilityRates.waterIdr, "IDR")}
            </div>
            <div className="mt-0.5 text-xs text-[#47729f] dark:text-slate-400">
              {ytdWaterTotal.toFixed(0)} m³
            </div>
            <div className="mt-3">
              <UtilityBarChart
                labels={ytdLabels}
                values={ytdWaterSeries}
                unit="m³"
                color="#3bb77e"
                height={140}
              />
            </div>
          </div>

          <div className="rounded-xl border border-[#acd3ff] dark:border-slate-800 bg-white dark:bg-slate-950/60 p-4 transition-colors duration-300">
            <div className="text-xs uppercase tracking-[0.2em] text-[#47729f] dark:text-slate-500 font-semibold">Solar YTD</div>
            <div className="mt-1 text-lg font-semibold text-[#002b5c] dark:text-slate-100">
              {formatCurrency(ytdSolarTotal * utilityRates.electricityIdr, "IDR")}
            </div>
            <div className="mt-0.5 text-xs text-[#47729f] dark:text-slate-400">
              {ytdSolarTotal.toFixed(0)} kWh
            </div>
            <div className="mt-3">
              <UtilityBarChart
                labels={ytdLabels}
                values={ytdSolarSeries}
                unit="kWh"
                color="#f59e0b"
                height={140}
              />
            </div>
          </div>
        </div>

        {/* Total YTD Stacked Chart */}
        <div className="mt-5 rounded-xl border border-[#acd3ff] dark:border-slate-800 bg-white dark:bg-slate-950/60 p-4 transition-colors duration-300">
          <div className="mb-1 text-xs uppercase tracking-[0.2em] text-[#47729f] dark:text-slate-500 font-semibold">
            Grafik Total YTD (kWh Setara)
          </div>
          <div className="text-xs text-[#47729f] dark:text-slate-400">
            Hanya kategori yang dicentang. Gas & air dikonversi ke kWh.
          </div>
          <div className="mt-3">
            <EnergyTrendStackedChart
              labels={ytdLabels}
              electricity={ytdChecks.electricity ? ytdElectricitySeries : ytdElectricitySeries.map(() => 0)}
              gas={ytdChecks.gas ? ytdGasSeries.map((v) => (v ?? 0) * gasEnergyFactor) : ytdGasSeries.map(() => 0)}
              water={ytdChecks.water ? ytdWaterSeries.map((v) => (v ?? 0) * waterEnergyFactor) : ytdWaterSeries.map(() => 0)}
              solar={ytdChecks.solar ? ytdSolarSeries : ytdSolarSeries.map(() => 0)}
            />
          </div>
        </div>
      </section>

      {/* Status & Alarms */}
      <div className="grid gap-4 xl:grid-cols-[1fr_1fr_1fr]">
        {/* Utility Status */}
        <section className="rounded-2xl border border-[#acd3ff] dark:border-slate-800 bg-[#f7fbff]/80 dark:bg-slate-950/70 p-4 transition-colors duration-300">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-xs uppercase tracking-[0.2em] text-[#47729f] dark:text-slate-500 font-semibold">
                Status Utility
              </div>
              <div className="text-xs text-[#47729f] dark:text-slate-400">
                Snapshot otomatis & manual override
              </div>
            </div>
            <Link to="/utility-status" className="text-xs font-semibold text-[#1f6fb5] dark:text-sky-400 hover:underline">
              Lihat
            </Link>
          </div>
          <div className="mt-3 space-y-2">
            {utilityStatusPreview.map((item) => (
              <div
                key={item.id}
                className="flex items-center justify-between rounded-lg border border-[#acd3ff] dark:border-slate-800 bg-white dark:bg-slate-950/80 px-3 py-2 transition-colors duration-300"
              >
                <div className="truncate pr-3 text-xs font-semibold text-[#002b5c] dark:text-slate-200">
                  {item.name}
                </div>
                <div className={`shrink-0 text-xs font-semibold ${statusTone[item.status]}`}>
                  {item.status}
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* HVAC Status */}
        <section className="rounded-2xl border border-[#acd3ff] dark:border-slate-800 bg-[#f7fbff]/80 dark:bg-slate-950/70 p-4 transition-colors duration-300">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-xs uppercase tracking-[0.2em] text-[#47729f] dark:text-slate-500 font-semibold">
                Status HVAC
              </div>
              <div className="text-xs text-[#47729f] dark:text-slate-400">
                Snapshot otomatis & manual override
              </div>
            </div>
            <Link to="/utility-status" className="text-xs font-semibold text-[#1f6fb5] dark:text-sky-400 hover:underline">
              Lihat
            </Link>
          </div>
          <div className="mt-3 space-y-2">
            {hvacStatusPreview.map((item) => (
              <div
                key={item.id}
                className="flex items-center justify-between rounded-lg border border-[#acd3ff] dark:border-slate-800 bg-white dark:bg-slate-950/80 px-3 py-2 transition-colors duration-300"
              >
                <div className="truncate pr-3 text-xs font-semibold text-[#002b5c] dark:text-slate-200">
                  {item.name}
                </div>
                <div className={`shrink-0 text-xs font-semibold ${statusTone[item.status]}`}>
                  {item.status}
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Alarm Strip */}
        <section className="rounded-2xl border border-[#acd3ff] dark:border-slate-800 bg-[#f7fbff]/80 dark:bg-slate-950/70 p-4 transition-colors duration-300">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-xs uppercase tracking-[0.2em] text-rose-500 dark:text-rose-300 font-semibold">
                Alarm Teraktif
              </div>
              <div className="text-xs text-[#47729f] dark:text-slate-400">
                {activeAlarms.length > 0 ? `${activeAlarms.length} alarm aktif` : "Demo alarm"}
              </div>
            </div>
            <Link to="/alarms" className="text-xs font-semibold text-[#1f6fb5] dark:text-sky-400 hover:underline">
              Lihat Semua
            </Link>
          </div>
          <div className="mt-3 space-y-2">
            {alarmPreview.map((alarm) => (
              <div
                key={alarm.id}
                className="flex items-start gap-3 rounded-lg border border-[#acd3ff] dark:border-slate-800 bg-white dark:bg-slate-950/80 px-3 py-2.5 transition-colors duration-300"
              >
                <div
                  className={[
                    "mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-xs font-black",
                    alarm.severity === "critical" || alarm.severity === "high"
                      ? "bg-rose-500/10 text-rose-500 dark:text-rose-300 border border-rose-500/20"
                      : "bg-amber-500/10 text-amber-500 dark:text-amber-300 border border-amber-500/20"
                  ].join(" ")}
                >
                  !
                </div>
                <div className="min-w-0">
                  <div className="truncate text-xs font-semibold text-[#002b5c] dark:text-slate-200">
                    {alarm.title}
                  </div>
                  <div className="mt-0.5 truncate text-xs text-[#47729f] dark:text-slate-400">
                    {alarm.detail}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>

      {/* Perbandingan */}
      <section className="rounded-2xl border border-[#acd3ff] dark:border-slate-800 bg-[#f7fbff]/80 dark:bg-slate-950/70 p-5 transition-colors duration-300">
        <div className="text-xs uppercase tracking-[0.2em] text-[#47729f] dark:text-slate-500 font-semibold">
          Perbandingan Range Sebelumnya
        </div>
        <div className="mt-1 text-sm text-[#47729f] dark:text-slate-400">
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
  );
}
