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

type StatusPreview = {
  id: string;
  name: string;
  status: "Running" | "Standby" | "Stopped";
};

const statusTone: Record<StatusPreview["status"], string> = {
  Running: "text-[#1c7f63]",
  Standby: "text-[#b98700]",
  Stopped: "text-[#b03a3a]"
};

export default function Dashboard() {
  const [periodIndex, setPeriodIndex] = useState(0);
  const [consumptionRange, setConsumptionRange] = useState<(typeof consumptionRanges)[number]["id"]>("hour");
  const [usdToIdr, setUsdToIdr] = useState(16200);
  const [thresholds, setThresholds] = useState<ThresholdItem[]>([]);
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

  const handleExportTrend = () => {
    const rows = consumptionLabels.map((label, index) => {
      const electricityValue = electricitySeries[index] ?? 0;
      const gasValue = (gasSeries[index] ?? 0) * gasEnergyFactor;
      const waterValue = (waterSeries[index] ?? 0) * waterEnergyFactor;
      return {
        period: label,
        electricity_kwh: Number(electricityValue.toFixed(2)),
        gas_kwh_equiv: Number(gasValue.toFixed(2)),
        water_kwh_equiv: Number(waterValue.toFixed(2)),
        total_kwh: Number((electricityValue + gasValue + waterValue).toFixed(2))
      };
    });

    const worksheet = utils.json_to_sheet(rows);
    const workbook = utils.book_new();
    utils.book_append_sheet(workbook, worksheet, "Trend Energi");
    writeFile(workbook, `trend-konsumsi-${consumptionRange}.xlsx`);
  };

  return (
    <div className="energy-dashboard -m-5 space-y-5 p-5 lg:-m-6 lg:p-6">
      <PageHeader
        title="Utility & Energy Monitoring Dashboard"
        description="Ringkasan konsumsi energi, biaya, dan status utilitas utama."
      />

      <div className="grid gap-4 xl:grid-cols-[2fr_1fr]">
        <section className="relative overflow-hidden rounded-2xl border border-[#bcd7f1] bg-white/90 p-5 shadow-[0_20px_45px_rgba(20,93,170,0.12)]">
          <div
            className="pointer-events-none absolute inset-0 opacity-30"
            style={{
              background: "radial-gradient(circle at top left, rgba(80,155,255,0.35), transparent 55%)"
            }}
          />
          <div className="relative flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="text-xs uppercase tracking-[0.22em] text-[#4c78a6]">
                Total Energi & Biaya
              </div>
              <div className="mt-1 text-sm text-[#2a5b91]">
                Ringkasan periode {period.label.toLowerCase()}.
              </div>
            </div>
            <div className="flex items-center gap-2 rounded-full border border-[#c7dbf2] bg-white px-1 text-xs">
              {periods.map((item, index) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setPeriodIndex(index)}
                  className={[
                    "rounded-full px-3 py-1 font-semibold",
                    periodIndex === index
                      ? "bg-[#0f5aa3] text-white"
                      : "text-[#4c78a6]"
                  ].join(" ")}
                >
                  {item.label}
                </button>
              ))}
            </div>
          </div>

          <div className="relative mt-5 grid gap-4 lg:grid-cols-3">
            <div className="rounded-xl border border-[#cde4ff] bg-[#f5faff] p-4">
              <ProgressRing
                value={totalEnergyKwh}
                target={energyTarget}
                label={`Total Energi ${period.label}`}
                unit="kWh"
                tone="cyan"
              />
              <div className="mt-3 text-xs text-[#4c78a6]">
                Gas & air dikonversi ke kWh setara.
              </div>
            </div>
            <div className="rounded-xl border border-[#cde4ff] bg-[#f5faff] p-4">
              <ProgressRing
                value={totalCostIdr}
                target={costTarget}
                label={`Total Biaya ${period.label}`}
                unit="IDR"
                tone="amber"
              />
              <div className="mt-3 text-xs text-[#4c78a6]">
                Kurs USD/IDR: {usdToIdr.toLocaleString()}
              </div>
            </div>
            <div className="rounded-xl border border-[#cde4ff] bg-[#f5faff] p-4">
              <div className="text-xs uppercase tracking-[0.22em] text-[#4c78a6]">
                Konsumsi Solar Panel
              </div>
              <div className="mt-2 text-2xl font-semibold text-[#0b3a68]">
                {solarKwh.toFixed(0)} kWh
              </div>
              <div className="mt-1 text-xs text-[#4c78a6]">
                Estimasi hemat {formatCurrency(solarSavings, "IDR")}
              </div>
              <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-[#d8e9ff]">
                <div
                  className="h-full rounded-full bg-[#2f8ae5]"
                  style={{ width: `${solarCoverage.toFixed(0)}%` }}
                />
              </div>
              <div className="mt-2 text-xs text-[#4c78a6]">
                Coverage {solarCoverage.toFixed(1)}% listrik.
              </div>
            </div>
          </div>
        </section>

        <section className="rounded-2xl border border-[#bcd7f1] bg-white/90 p-5 shadow-[0_20px_45px_rgba(20,93,170,0.12)]">
          <div className="text-xs uppercase tracking-[0.22em] text-[#4c78a6]">
            Ringkasan Distribusi Energi Bulan Ini
          </div>
          <div className="mt-4">
            <EnergyDonutChart
              labels={["Listrik", "Gas", "Air"]}
              values={[monthlyElectric, monthlyGasEnergy, monthlyWaterEnergy]}
              colors={["rgba(56, 189, 248, 0.9)", "rgba(250, 204, 21, 0.85)", "rgba(74, 222, 128, 0.85)"]}
              centerLabel="Total"
              centerValue={`${totalMonthlyEnergy.toFixed(0)} kWh`}
            />
          </div>
          <div className="mt-4 rounded-xl border border-[#cde4ff] bg-[#f5faff] p-3">
            <div className="text-xs uppercase tracking-[0.2em] text-[#4c78a6]">
              Estimasi CO2 Emission
            </div>
            <div className="mt-2 text-lg font-semibold text-[#0b3a68]">
              {co2Emission.toFixed(1)} Ton CO2
            </div>
            <div className="text-xs text-[#4c78a6]">Perkiraan bulan berjalan.</div>
          </div>
        </section>
      </div>

      <section className="rounded-2xl border border-[#bcd7f1] bg-white/90 p-5 shadow-[0_20px_45px_rgba(20,93,170,0.12)]">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="text-xs uppercase tracking-[0.2em] text-[#4c78a6]">
              Konsumsi Utilitas
            </div>
            <div className="mt-1 text-sm text-[#2a5b91]">
              Pilih rentang untuk listrik, gas, dan air.
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
                    ? "border-[#2f8ae5] bg-[#e6f2ff] text-[#0b3a68]"
                    : "border-[#c7dbf2] text-[#4c78a6]"
                ].join(" ")}
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>
        <div className="mt-4 grid gap-4 lg:grid-cols-3">
          <div className="rounded-xl border border-[#cde4ff] bg-[#f5faff] p-4">
            <div className="text-xs uppercase tracking-[0.2em] text-[#4c78a6]">
              Listrik
            </div>
            <div className="mt-1 text-lg font-semibold text-[#0b3a68]">
              {electricitySeries.reduce((sum, value) => sum + value, 0).toFixed(1)} kWh
            </div>
            <div className="mt-1 text-xs text-[#4c78a6]">
              {formatCurrency(electricityCost, "IDR")}
            </div>
            <div className="mt-4">
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
          <div className="rounded-xl border border-[#cde4ff] bg-[#f5faff] p-4">
            <div className="text-xs uppercase tracking-[0.2em] text-[#4c78a6]">
              Gas
            </div>
            <div className="mt-1 text-lg font-semibold text-[#0b3a68]">
              {gasSeries.reduce((sum, value) => sum + value, 0).toFixed(1)} Sm3
            </div>
            <div className="mt-1 text-xs text-[#4c78a6]">
              {formatCurrency(gasCostUsd, "USD")} ({formatCurrency(gasCostIdr, "IDR")})
            </div>
            <div className="mt-4">
              <UtilityBarChart
                labels={consumptionLabels}
                values={gasSeries}
                unit="Sm3"
                color="#f4c542"
                height={160}
              />
            </div>
          </div>
          <div className="rounded-xl border border-[#cde4ff] bg-[#f5faff] p-4">
            <div className="text-xs uppercase tracking-[0.2em] text-[#4c78a6]">
              Air
            </div>
            <div className="mt-1 text-lg font-semibold text-[#0b3a68]">
              {waterSeries.reduce((sum, value) => sum + value, 0).toFixed(1)} m3
            </div>
            <div className="mt-1 text-xs text-[#4c78a6]">
              {formatCurrency(waterCost, "IDR")}
            </div>
            <div className="mt-4">
              <UtilityBarChart
                labels={consumptionLabels}
                values={waterSeries}
                unit="m3"
                color="#3bb77e"
                height={160}
              />
            </div>
          </div>
        </div>
      </section>

      <div className="grid gap-4 xl:grid-cols-[2fr_0.9fr]">
        <section className="rounded-2xl border border-[#bcd7f1] bg-white/90 p-5 shadow-[0_20px_45px_rgba(20,93,170,0.12)]">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="text-xs uppercase tracking-[0.2em] text-[#4c78a6]">
                Trend Konsumsi Energi
              </div>
              <div className="text-sm text-[#2a5b91]">
                Total listrik, gas, dan air (kWh setara).
              </div>
            </div>
            <button
              type="button"
              onClick={handleExportTrend}
              className="rounded-full border border-[#2f8ae5] bg-[#e6f2ff] px-4 py-1 text-xs font-semibold text-[#0b3a68]"
            >
              Export Excel
            </button>
          </div>
          <EnergyTrendStackedChart
            labels={consumptionLabels}
            electricity={electricitySeries}
            gas={gasSeries.map((value) => value * gasEnergyFactor)}
            water={waterSeries.map((value) => value * waterEnergyFactor)}
          />
        </section>

        <div className="space-y-4">
          {[
            { title: "Status Peralatan Utility", items: utilityStatusPreview },
            { title: "Status Peralatan HVAC", items: hvacStatusPreview }
          ].map((panel) => (
            <section
              key={panel.title}
              className="rounded-2xl border border-[#bcd7f1] bg-white/90 p-4 shadow-[0_20px_45px_rgba(20,93,170,0.12)]"
            >
              <div className="flex items-center justify-between gap-2">
                <div>
                  <div className="text-xs uppercase tracking-[0.2em] text-[#4c78a6]">
                    {panel.title}
                  </div>
                  <div className="text-xs text-[#2a5b91]">
                    Snapshot otomatis dan manual override.
                  </div>
                </div>
                <Link
                  to="/utility-status"
                  className="text-xs font-semibold text-[#0f5aa3]"
                >
                  Lihat
                </Link>
              </div>
              <div className="mt-3 space-y-2">
                {panel.items.map((item) => (
                  <div
                    key={item.id}
                    className="flex items-center justify-between rounded-lg border border-[#d7e8fb] bg-[#f6fbff] px-3 py-2"
                  >
                    <div className="truncate pr-3 text-xs font-semibold text-[#0b3a68]">
                      {item.name}
                    </div>
                    <div className={`shrink-0 text-xs font-semibold ${statusTone[item.status]}`}>
                      {item.status}
                    </div>
                  </div>
                ))}
              </div>
            </section>
          ))}
        </div>
      </div>

      <section className="rounded-2xl border border-[#bcd7f1] bg-white/90 p-4 shadow-[0_20px_45px_rgba(20,93,170,0.12)]">
        <div className="mb-3 flex items-center justify-between gap-3">
          <div className="text-xs uppercase tracking-[0.2em] text-[#ff7777]">
            Alarm Teraktif
          </div>
          <Link to="/alarms" className="text-xs font-semibold text-[#0f5aa3]">
            Lihat Semua Alarm
          </Link>
        </div>
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          {alarmPreview.map((alarm) => (
            <div
              key={alarm.id}
              className="rounded-xl border border-[#d7e8fb] bg-[#f6fbff] px-4 py-3"
            >
              <div className="flex items-start gap-3">
                <div
                  className={[
                    "mt-0.5 flex h-8 w-8 items-center justify-center rounded-lg text-sm font-black",
                    alarm.severity === "critical" || alarm.severity === "high"
                      ? "bg-[#ffdddd] text-[#d84d4d]"
                      : "bg-[#fff0c7] text-[#d69a00]"
                  ].join(" ")}
                >
                  !
                </div>
                <div>
                  <div className="text-xs font-semibold text-[#0b3a68]">
                    {alarm.title}
                  </div>
                  <div className="mt-1 text-xs text-[#4c78a6]">
                    {alarm.detail}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-2xl border border-[#bcd7f1] bg-white/90 p-5 shadow-[0_20px_45px_rgba(20,93,170,0.12)]">
        <div className="text-xs uppercase tracking-[0.2em] text-[#4c78a6]">
          Perbandingan Range Sebelumnya
        </div>
        <div className="mt-2 text-sm text-[#2a5b91]">
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
