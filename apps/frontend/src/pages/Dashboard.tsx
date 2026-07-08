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
import { getSocket } from "../services/socket.service";
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
import { useMachineConfig } from "../hooks/useMachineConfig";
import { useConfigStore } from "../store/config.store";

const staticDailyEnergyTotal = machineGroups.reduce((sum, group) => {
  const energy = group.summaryCards.find((card) => card.label === "Total Energy")?.value ?? 0;
  return sum + energy;
}, 0);

const staticUtilityBase = {
  electricityKwh: staticDailyEnergyTotal,
  gasSm3: staticDailyEnergyTotal / 7,
  waterM3: staticDailyEnergyTotal / 25
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
  { id: "daily", label: "Daily", scale: 1 },
  { id: "monthly", label: "Monthly", scale: 30 },
  { id: "yearly", label: "Yearly", scale: 365 }
] as const;

const consumptionRanges = [
  { id: "hour", label: "Hourly", points: 24, stepMs: 60 * 60 * 1000, type: "time" as const, scale: 1 / 24 },
  { id: "day", label: "Daily", points: 30, stepMs: 24 * 60 * 60 * 1000, type: "day" as const, scale: 1 },
  { id: "month", label: "Monthly", points: 12, stepMs: 30 * 24 * 60 * 60 * 1000, type: "month" as const, scale: 30 }
] as const;

const compareRanges = {
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

const rangeOptions = [
  { value: "1d", label: "1d" },
  { value: "1w", label: "1w" },
  { value: "1m", label: "1m" },
  { value: "1y", label: "1y" }
] as const;

export default function Dashboard() {
  const [periodIndex, setPeriodIndex] = useState(0);
  const [consumptionRange, setConsumptionRange] = useState<(typeof consumptionRanges)[number]["id"]>("hour");
  const [usdToIdr, setUsdToIdr] = useState(16200);
  const [thresholds, setThresholds] = useState<ThresholdItem[]>([]);
  const [ytdChecks, setYtdChecks] = useState({ electricity: true, gas: true, water: true, solar: false });
  const [electricityData, setElectricityData] = useState<any>(null);

  useEffect(() => {
    let active = true;
    const fetchElectricity = () => {
      const currentYear = new Date().getFullYear();
      getJson<{ data: any }>(`/analytics/electricity?deviceId=Cubicle_PLN_PM8000&year=${currentYear}&_t=${Date.now()}`)
        .then((res) => {
          if (active) {
            setElectricityData(res.data);
          }
        })
        .catch((err) => {
          console.error("Dashboard failed to fetch electricity data", err);
        });
    };

    fetchElectricity();
    const interval = setInterval(fetchElectricity, 30000); // auto-fetch every 30 seconds

    const socket = getSocket();

    const handleConfigUpdate = () => {
      console.log("Dashboard: config updated, reloading electricity...");
      useConfigStore.getState().fetchRates();
      if (active) fetchElectricity();
    };

    const handleElectricityUpdate = () => {
      console.log("Dashboard: electricity telemetry updated, reloading electricity...");
      if (active) fetchElectricity();
    };

    socket.on("config:update", handleConfigUpdate);
    socket.on("electricity:update", handleElectricityUpdate);

    return () => {
      active = false;
      clearInterval(interval);
      socket.off("config:update", handleConfigUpdate);
      socket.off("electricity:update", handleElectricityUpdate);
    };
  }, []);

  const { range, compare } = useTimeRangeStore();
  const latest = useTelemetryStore((state) => state.latest);
  const activeAlarms = useAlarmStore((state) => state.activeList);

  const { machines } = useMachineConfig();

  const dailyEnergyTotal = useMemo(() => {
    if (machines && machines.length > 0) {
      const costMapping: Record<string, number> = {
        "cooling-water-1": 1500,
        "cooling-tower-2": 1100,
        "cooling-tower-3": 502.1,
        "boiler-1": 900,
        "boiler-2": 602.1,
        "ro-1": 450,
        "ro-2": 353.1,
        "chiller-1": 1600,
        "chiller-2": 1502.1,
        "distillate-1": 800,
        "distillate-2": 397.9,
        "purified-water-1": 350,
        "purified-water-2": 252.1
      };
      return machines.reduce((sum, m) => sum + (costMapping[m.id] ?? 0), 0);
    }
    return staticDailyEnergyTotal;
  }, [machines]);

  const utilityBase = useMemo(() => ({
    electricityKwh: dailyEnergyTotal,
    gasSm3: 0,
    waterM3: 0
  }), [dailyEnergyTotal]);

  const [waterTarget, setWaterTarget] = useState(() => Number(localStorage.getItem("scada.makeupWaterTarget") ?? 1000));
  const [elRange, setElRange] = useState<keyof typeof compareRanges>("1d");
  const [gasRange, setGasRange] = useState<keyof typeof compareRanges>("1d");
  const [waterRange, setWaterRange] = useState<keyof typeof compareRanges>("1d");
  const [carbonRange, setCarbonRange] = useState<keyof typeof compareRanges>("1d");

  useEffect(() => {
    localStorage.setItem("scada.makeupWaterTarget", waterTarget.toString());
  }, [waterTarget]);

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

  const wbpRate = useConfigStore((state) => state.wbpRate);
  const lwbpRate = useConfigStore((state) => state.lwbpRate);

  const period = periods[periodIndex];

  // Dynamic electricity calculations based on the period selector
  const electricityKwh = useMemo(() => {
    if (!electricityData) return utilityBase.electricityKwh * period.scale;
    if (period.id === "daily") {
      return electricityData.summary.todayKwh;
    } else if (period.id === "monthly") {
      return electricityData.summary.monthlyMwh * 1000;
    } else {
      return electricityData.summary.yearlyMwh * 1000;
    }
  }, [electricityData, period.id, utilityBase.electricityKwh, period.scale]);

  const electricityCost = useMemo(() => {
    if (!electricityData) return electricityKwh * utilityRates.electricityIdr;
    if (period.id === "daily") {
      return electricityData.summary.todayCost;
    } else if (period.id === "monthly") {
      return electricityData.summary.monthlyCost;
    } else {
      return electricityData.summary.totalCost;
    }
  }, [electricityData, period.id, electricityKwh]);

  const gasSm3 = utilityBase.gasSm3 * period.scale;
  const waterM3 = utilityBase.waterM3 * period.scale;
  const monthlyWaterVolume = utilityBase.waterM3 * 30;

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

  const monthlyElectric = electricityData ? electricityData.summary.monthlyMwh * 1000 : utilityBase.electricityKwh * 30;
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

  const monthlyDailyRecords = useMemo(() => {
    if (electricityData && electricityData.charts.daily) {
      const now = new Date();
      const currentYear = now.getFullYear();
      const currentMonth = now.getMonth() + 1; // 1-indexed
      const monthPrefix = `${currentYear}-${String(currentMonth).padStart(2, "0")}`;
      return electricityData.charts.daily.filter((d: any) => d.day.startsWith(monthPrefix));
    }
    return [];
  }, [electricityData]);

  const electricitySeries = useMemo(() => {
    if (electricityData) {
      if (consumptionRange === "hour") {
        return electricityData.charts.hourly;
      } else if (consumptionRange === "day") {
        return monthlyDailyRecords.map((d: any) => d.value);
      } else {
        return electricityData.charts.monthly.map((m: any) => m.value * 1000);
      }
    }
    const base = utilityBase.electricityKwh * consumptionConfig.scale;
    return buildTimeAwareSeries(consumptionConfig.points, base, base * 0.35, 1, maxIndex);
  }, [consumptionConfig, maxIndex, utilityBase, electricityData, consumptionRange, monthlyDailyRecords]);

  const consumptionElectricityCost = useMemo(() => {
    if (!electricityData) {
      const totalKwh = electricitySeries.reduce((sum: number, v: number) => sum + v, 0);
      return totalKwh * utilityRates.electricityIdr;
    }
    if (consumptionRange === "hour") {
      let cost = 0;
      electricitySeries.forEach((val: number, h: number) => {
        const endHour = h + 1;
        if (endHour >= 18 && endHour <= 22) {
          cost += val * wbpRate;
        } else {
          cost += val * lwbpRate;
        }
      });
      return cost;
    } else if (consumptionRange === "day") {
      return electricityData.summary.monthlyCost;
    } else {
      return electricityData.summary.totalCost;
    }
  }, [electricitySeries, wbpRate, lwbpRate, consumptionRange, electricityData]);

  const gasSeries = useMemo(() => {
    return Array.from({ length: electricitySeries.length }, () => 0);
  }, [electricitySeries.length]);

  const waterSeries = useMemo(() => {
    return Array.from({ length: electricitySeries.length }, () => 0);
  }, [electricitySeries.length]);

  const solarSeries = useMemo(() => {
    return electricitySeries.map(() => 0);
  }, [electricitySeries]);

  const consumptionLabels = useMemo(() => {
    if (electricityData) {
      if (consumptionRange === "hour") {
        return Array.from({ length: 24 }, (_, i) => `${i.toString().padStart(2, "0")}:00`);
      } else if (consumptionRange === "day") {
        return monthlyDailyRecords.map((d: any) => {
          const parts = d.day.split("-");
          return `${parts[2]}`; // day number, e.g. "01", "02"
        });
      } else {
        const MONTH_SHORT_ID = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"];
        return electricityData.charts.monthly.map((m: any) => {
          const [yr, mo] = m.month.split("-").map(Number);
          return `${MONTH_SHORT_ID[mo - 1]} ${yr}`;
        });
      }
    }
    return buildTimeLabels(consumptionConfig.points, consumptionConfig.type);
  }, [consumptionConfig, electricityData, consumptionRange, monthlyDailyRecords]);

  const ytdMonthIndex = useMemo(() => getElapsedIndex("month"), [periodIndex]);

  const ytdElectricitySeries = useMemo(() => {
    if (electricityData) {
      return electricityData.charts.monthly.map((m: any, i: number) => {
        if (i > ytdMonthIndex) return null as unknown as number;
        return m.value * 1000; // MWh to kWh
      });
    }
    return buildTimeAwareSeries(12, utilityBase.electricityKwh * 30, utilityBase.electricityKwh * 12, 1, ytdMonthIndex);
  }, [ytdMonthIndex, utilityBase, electricityData]);

  const ytdGasSeries = useMemo(() => {
    return Array.from({ length: 12 }, () => 0);
  }, []);

  const ytdWaterSeries = useMemo(() => {
    return Array.from({ length: 12 }, () => 0);
  }, []);

  const ytdElectricityTotal = useMemo(
    () => ytdElectricitySeries.reduce((sum: number, v: number | null) => sum + (v ?? 0), 0),
    [ytdElectricitySeries]
  );

  const ytdGasTotal = useMemo(
    () => ytdGasSeries.reduce((sum: number, v: number | null) => sum + (v ?? 0), 0),
    [ytdGasSeries]
  );

  const ytdWaterTotal = useMemo(
    () => ytdWaterSeries.reduce((sum: number, v: number | null) => sum + (v ?? 0), 0),
    [ytdWaterSeries]
  );

  const ytdSolarSeries = useMemo(() => {
    return ytdElectricitySeries.map(() => 0);
  }, [ytdElectricitySeries]);

  const ytdSolarTotal = useMemo(
    () => ytdSolarSeries.reduce((sum: number, v: number | null) => sum + (v ?? 0), 0),
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

  const { elCompareLabels, elCurrent, elPrevious } = useMemo(() => {
    const config = compareRanges[elRange];
    if (!electricityData) {
      const labels = buildLabels(config.points, config.stepMs, config.label);
      const current = buildSeries(config.points, utilityBase.electricityKwh / 24, (utilityBase.electricityKwh / 24) * 0.3, 1);
      const previous = current.map(v => Number((v * 0.92).toFixed(2)));
      return { elCompareLabels: labels, elCurrent: current, elPrevious: previous };
    }

    const now = new Date();
    const todayStr = new Date(now.getTime() + 7 * 60 * 60 * 1000).toISOString().split("T")[0];
    const todayIdx = electricityData.charts.daily.findIndex((d: any) => d.day === todayStr) !== -1 
      ? electricityData.charts.daily.findIndex((d: any) => d.day === todayStr)
      : electricityData.charts.daily.length - 1;

    let labels: string[] = [];
    let current: number[] = [];
    let previous: number[] = [];

    if (elRange === "1d") {
      const hourly = electricityData.charts.hourly || [];
      for (let h = 0; h < 24; h++) {
        labels.push(`${h.toString().padStart(2, "0")}:00`);
        current.push(hourly[h] ?? 0);
        previous.push(Number(((hourly[h] ?? 0) * 0.93).toFixed(2)));
      }
    } else if (elRange === "1w") {
      const startIndex = Math.max(0, todayIdx - 6);
      const sliced = electricityData.charts.daily.slice(startIndex, todayIdx + 1);
      sliced.forEach((d: any) => {
        const parts = d.day.split("-");
        labels.push(`${parts[1]}/${parts[2]}`);
        current.push(d.value);
        previous.push(Number((d.value * 0.88).toFixed(2)));
      });
    } else if (elRange === "1m") {
      const startIndex = Math.max(0, todayIdx - 29);
      const sliced = electricityData.charts.daily.slice(startIndex, todayIdx + 1);
      sliced.forEach((d: any, idx: number) => {
        const parts = d.day.split("-");
        if (idx % 5 === 0 || idx === sliced.length - 1) {
          labels.push(`${parts[1]}/${parts[2]}`);
        } else {
          labels.push("");
        }
        current.push(d.value);
        previous.push(Number((d.value * 0.94).toFixed(2)));
      });
    } else {
      const MONTH_SHORT_ID = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"];
      electricityData.charts.monthly.forEach((m: any) => {
        const [yr, mo] = m.month.split("-").map(Number);
        labels.push(`${MONTH_SHORT_ID[mo - 1]}`);
        current.push(m.value * 1000);
        previous.push(Number((m.value * 1000 * 0.92).toFixed(2)));
      });
    }

    return { elCompareLabels: labels, elCurrent: current, elPrevious: previous };
  }, [elRange, electricityData, utilityBase]);

  const gasCompareConfig = compareRanges[gasRange];
  const gasCompareLabels = useMemo(() => buildLabels(gasCompareConfig.points, gasCompareConfig.stepMs, gasCompareConfig.label), [gasCompareConfig]);
  const gasCurrent = useMemo(() => Array.from({ length: gasCompareConfig.points }, () => 0), [gasCompareConfig]);
  const gasPrevious = useMemo(() => gasCurrent.map(() => 0), [gasCurrent]);

  const waterCompareConfig = compareRanges[waterRange];
  const waterCompareLabels = useMemo(() => buildLabels(waterCompareConfig.points, waterCompareConfig.stepMs, waterCompareConfig.label), [waterCompareConfig]);
  const waterCurrent = useMemo(() => Array.from({ length: waterCompareConfig.points }, () => 0), [waterCompareConfig]);
  const waterPrevious = useMemo(() => waterCurrent.map(() => 0), [waterCurrent]);

  const carbonCompareConfig = compareRanges[carbonRange];
  const carbonCompareLabels = useMemo(() => buildLabels(carbonCompareConfig.points, carbonCompareConfig.stepMs, carbonCompareConfig.label), [carbonCompareConfig]);
  const carbonCurrent = useMemo(() => Array.from({ length: carbonCompareConfig.points }, () => 0), [carbonCompareConfig]);
  const carbonPrevious = useMemo(() => carbonCurrent.map(() => 0), [carbonCurrent]);

  const thresholdKwh = thresholds.find((item) => item.metric === "kwh");

  const utilityStatusPreview = useMemo<StatusPreview[]>(() => {
    const dynamicItems = machines?.filter(
      (m) => m.area === "Utility" || m.area === "Utilities" || m.area === "WWTP" || m.area === "Production"
    ) || [];

    if (dynamicItems.length > 0) {
      return dynamicItems.slice(0, 9).map((m) => {
        const tagId = m.apiBindings?.flow || m.apiBindings?.temp || Object.values(m.apiBindings)[0] || "";
        const rawValue = tagId ? latest[tagId]?.value : undefined;
        const numericValue = typeof rawValue === "number" ? rawValue : undefined;
        const status = numericValue === undefined ? "Standby" : numericValue <= 0 ? "Stopped" : "Running";
        return {
          id: m.id,
          name: m.name,
          status
        };
      });
    }

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
  }, [machines, latest]);

  const hvacStatusPreview = useMemo<StatusPreview[]>(() => {
    const dynamicItems = machines?.filter((m) => m.area === "HVAC") || [];
    if (dynamicItems.length > 0) {
      return dynamicItems.slice(0, 9).map((m) => {
        const tagId = m.apiBindings?.temp || Object.values(m.apiBindings)[0] || "";
        const rawValue = tagId ? latest[tagId]?.value : undefined;
        const numericValue = typeof rawValue === "number" ? rawValue : undefined;
        const status = numericValue === undefined ? "Standby" : numericValue <= 0 ? "Stopped" : "Running";
        return {
          id: m.id,
          name: m.name,
          status
        };
      });
    }

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
  }, [machines, latest]);

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
            title: "Electricity Consumption",
            detail: "Exceeds threshold",
            severity: "high"
          },
          {
            id: "alarm-gas",
            title: "Boiler 1 Gas Pressure",
            detail: "Below normal",
            severity: "medium"
          },
          {
            id: "alarm-water",
            title: "Cooling Tower 1 Water Level",
            detail: "Below normal",
            severity: "medium"
          },
          {
            id: "alarm-flow",
            title: "Clean Water Flow",
            detail: "Below normal",
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
        Month: label,
        "Electricity (kWh)": Number(electricityValue.toFixed(2)),
        "Gas (Sm³)": Number(gasValue.toFixed(2)),
        "Water (m³)": Number(waterValue.toFixed(2)),
        "Solar (kWh)": Number(solarValue.toFixed(2)),
        "Total Equivalent (kWh)": Number(ytdTotalSeries[index]?.toFixed(2) ?? 0)
      };
    });

    const worksheet = utils.json_to_sheet(rows);
    const workbook = utils.book_new();
    utils.book_append_sheet(workbook, worksheet, "YTD Energy");
    writeFile(workbook, `ytd-energy.xlsx`);
  };

  return (
    <div className="space-y-5">
      <PageHeader
        title="Utility & Energy Monitoring Dashboard"
        description="Summary of energy consumption, costs, and key utility status."
      />

      {/* Executive Summary — 5 equal cards */}
      <section className="rounded-2xl border border-[#acd3ff] dark:border-slate-800 bg-[#f7fbff]/80 dark:bg-slate-950/70 p-5 transition-colors duration-300">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="text-xs uppercase tracking-[0.2em] text-[#47729f] dark:text-slate-500 font-semibold">
              Executive Summary
            </div>
            <div className="mt-1 text-sm text-[#47729f] dark:text-slate-400">
              Summary of {period.label.toLowerCase()} period.
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
        </div>        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
          {/* Total Energy */}
          <div className="rounded-xl border border-[#acd3ff] dark:border-slate-800 bg-white dark:bg-slate-950/60 p-4 transition-colors duration-300">
            <ProgressRing
              value={totalEnergyKwh}
              target={energyTarget}
              label="Total Energy"
              unit="kWh"
              tone="cyan"
            />
            <div className="mt-2 text-xs text-[#47729f] dark:text-slate-400">
              Gas & water converted to equivalent kWh.
            </div>
          </div>

          {/* Total Cost */}
          <div className="rounded-xl border border-[#acd3ff] dark:border-slate-800 bg-white dark:bg-slate-950/60 p-4 transition-colors duration-300">
            <ProgressRing
              value={totalCostIdr}
              target={costTarget}
              label="Total Cost"
              unit="IDR"
              tone="amber"
            />
            <div className="mt-2 text-xs text-[#47729f] dark:text-slate-400">
              USD/IDR Exchange Rate: {usdToIdr.toLocaleString()}
            </div>
          </div>

          {/* CO2 Emission */}
          <div className="rounded-xl border border-[#acd3ff] dark:border-slate-800 bg-white dark:bg-slate-950/60 p-4 transition-colors duration-300">
            <div className="text-xs uppercase tracking-[0.2em] text-[#47729f] dark:text-slate-500 font-semibold">
              CO₂ Emission
            </div>
            <div className="mt-2 text-2xl font-semibold text-[#002b5c] dark:text-slate-100">
              0.0 Ton
            </div>
            <div className="mt-1 text-xs text-[#47729f] dark:text-slate-400">
              Current month estimate
            </div>
            <div className="mt-3 text-xs text-[#47729f]/80 dark:text-slate-500">
              Energy distribution ratio calculated based on equivalent emissions of coal and liquefied natural gas.
            </div>
          </div>

          {/* Solar Panel */}
          <div className="rounded-xl border border-[#acd3ff] dark:border-slate-800 bg-white dark:bg-slate-950/60 p-4 transition-colors duration-300">
            <div className="text-xs uppercase tracking-[0.2em] text-[#47729f] dark:text-slate-500 font-semibold">
              Solar Panel
            </div>
            <div className="mt-2 text-2xl font-semibold text-[#002b5c] dark:text-slate-100">
              0 kWh
            </div>
            <div className="mt-1 text-xs text-[#47729f] dark:text-slate-400">
              Saved Rp 0
            </div>
            <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-slate-200 dark:bg-slate-900">
              <div
                className="h-full rounded-full bg-[#1f6fb5]"
                style={{ width: "0%" }}
              />
            </div>
            <div className="mt-2 text-xs text-[#47729f] dark:text-slate-400">
              Coverage 0% of electricity
            </div>
          </div>

          {/* CO2 Reduction */}
          <div className="rounded-xl border border-emerald-500/30 dark:border-emerald-500/20 bg-emerald-500/5 dark:bg-emerald-950/10 p-4 transition-colors duration-300">
            <div className="text-xs uppercase tracking-[0.2em] text-emerald-600 dark:text-emerald-400 font-semibold">
              CO₂ Reduction
            </div>
            <div className="mt-2 text-2xl font-semibold text-emerald-700 dark:text-emerald-300">
              0.0 kg
            </div>
            <div className="mt-1 text-xs text-[#47729f] dark:text-slate-400">
              Reduces carbon emissions
            </div>
            <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-slate-200 dark:bg-slate-900">
              <div
                className="h-full rounded-full bg-emerald-500"
                style={{ width: "0%" }}
              />
            </div>
            <div className="mt-2 text-[10px] text-emerald-600 dark:text-emerald-400/80 font-medium">
              Independent Green Certification
            </div>
          </div>
        </div>
      </section>

      {/* Konsumsi Utilitas — Per Jam / Hari / Bulan */}
      <section className="rounded-2xl border border-[#acd3ff] dark:border-slate-800 bg-[#f7fbff]/80 dark:bg-slate-950/70 p-5 transition-colors duration-300">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="text-xs uppercase tracking-[0.2em] text-[#47729f] dark:text-slate-500 font-semibold">
              Utility Consumption
            </div>
            <div className="mt-1 text-sm text-[#47729f] dark:text-slate-400">
              Select range for electricity, gas, and water.
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
            {/* Electricity */}
            <div className="rounded-xl border border-[#acd3ff] dark:border-slate-800 bg-white dark:bg-slate-950/60 p-4 transition-colors duration-300">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-xs uppercase tracking-[0.2em] text-[#47729f] dark:text-slate-500 font-semibold">Electricity</div>
                  <div className="mt-1 text-lg font-semibold text-[#002b5c] dark:text-slate-100">
                    {formatCurrency(consumptionElectricityCost, "IDR")}
                  </div>
                  <div className="mt-0.5 text-xs text-[#47729f] dark:text-slate-400">
                    {electricitySeries.reduce((sum: number, v: number) => sum + v, 0).toFixed(1)} kWh
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

            {/* Water */}
            <div className="rounded-xl border border-[#acd3ff] dark:border-slate-800 bg-white dark:bg-slate-950/60 p-4 transition-colors duration-300">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-xs uppercase tracking-[0.2em] text-[#47729f] dark:text-slate-500 font-semibold">Water</div>
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
                    Rp 0
                  </div>
                  <div className="mt-0.5 text-xs text-[#47729f] dark:text-slate-400">
                    0.0 kWh
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
          <div className="md:col-span-1 flex flex-col">
            {/* Energy Distribution */}
            <div className="rounded-xl border border-[#acd3ff] dark:border-slate-800 bg-white dark:bg-slate-950/60 p-5 transition-colors duration-300 flex-1 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <div className="text-xs uppercase tracking-[0.2em] text-[#47729f] dark:text-slate-500 font-semibold">Energy Distribution</div>
                    <div className="text-[10px] text-[#47729f] dark:text-slate-400 font-medium">This Month</div>
                  </div>
                  <div className="text-[10px] text-emerald-600 dark:text-emerald-400 font-semibold">
                    ≈ {trees.toLocaleString("en-US")} trees
                  </div>
                </div>
                <div className="flex items-center justify-center min-h-[220px] mt-4">
                  <EnergyDonutChart
                    labels={["Electricity", "Gas", "Water"]}
                    values={[monthlyElectric, monthlyGasEnergy, monthlyWaterEnergy]}
                    colors={["rgba(56, 189, 248, 0.9)", "rgba(250, 204, 21, 0.85)", "rgba(74, 222, 128, 0.85)"]}
                    centerLabel="Total"
                    centerValue={`${totalMonthlyEnergy.toFixed(0)}`}
                    height={220}
                  />
                </div>
              </div>

              <div className="mt-6 space-y-3">
                {[
                  { label: "Electricity", value: monthlyElectric, unit: "kWh", color: "bg-sky-400", rawVal: monthlyElectric },
                  { label: "Gas (equiv.)", value: monthlyGasEnergy, unit: "kWh", color: "bg-yellow-400", rawVal: monthlyGasEnergy },
                  { label: "Water (equiv.)", value: monthlyWaterEnergy, unit: "kWh", color: "bg-green-400", rawVal: monthlyWaterEnergy }
                ].map((item) => {
                  const pct = totalMonthlyEnergy > 0 ? (item.rawVal / totalMonthlyEnergy) * 100 : 0;
                  return (
                    <div key={item.label} className="flex items-center justify-between text-xs border-b border-slate-100 dark:border-slate-900 pb-2">
                      <div className="flex items-center gap-2">
                        <span className={`w-2.5 h-2.5 rounded-full ${item.color}`} />
                        <span className="font-semibold text-slate-700 dark:text-slate-300">{item.label}</span>
                      </div>
                      <div className="text-right">
                        <span className="font-mono font-bold text-slate-900 dark:text-white">
                          {item.value.toLocaleString(undefined, { maximumFractionDigits: 0 })} {item.unit}
                        </span>
                        <span className="text-[10px] text-slate-400 dark:text-slate-500 font-medium ml-2">
                          ({pct.toFixed(1)}%)
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
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
              Monthly accumulation per category. Check to display in the total chart.
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-3 rounded-full border border-[#acd3ff] dark:border-slate-800 bg-white dark:bg-slate-950/80 px-3 py-1.5 text-xs transition-colors duration-300">
              {([
                { key: "electricity" as const, label: "Electricity", color: "#2f8ae5" },
                { key: "gas" as const, label: "Gas", color: "#f4c542" },
                { key: "water" as const, label: "Water", color: "#3bb77e" },
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
            <div className="text-xs uppercase tracking-[0.2em] text-[#47729f] dark:text-slate-500 font-semibold">Electricity YTD</div>
            <div className="mt-1 text-lg font-semibold text-[#002b5c] dark:text-slate-100">
              {formatCurrency(electricityData ? electricityData.summary.totalCost : ytdElectricityTotal * utilityRates.electricityIdr, "IDR")}
            </div>
            <div className="mt-0.5 text-xs text-[#47729f] dark:text-slate-400">
              {electricityData ? electricityData.summary.totalKwh.toLocaleString("id-ID") : ytdElectricityTotal.toFixed(0)} kWh
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
            <div className="text-xs uppercase tracking-[0.2em] text-[#47729f] dark:text-slate-500 font-semibold">Water YTD</div>
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
              Rp 0
            </div>
            <div className="mt-0.5 text-xs text-[#47729f] dark:text-slate-400">
              0 kWh
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
            Total YTD Chart (Equivalent kWh)
          </div>
          <div className="text-xs text-[#47729f] dark:text-slate-400">
            Only checked categories. Gas & water converted to kWh.
          </div>
          <div className="mt-3">
            <EnergyTrendStackedChart
              labels={ytdLabels}
              electricity={ytdChecks.electricity ? ytdElectricitySeries : ytdElectricitySeries.map(() => 0)}
              gas={ytdChecks.gas ? ytdGasSeries.map((v) => (v ?? 0) * gasEnergyFactor) : ytdGasSeries.map(() => 0)}
              water={ytdChecks.water ? ytdWaterSeries.map((v) => (v ?? 0) * waterEnergyFactor) : ytdWaterSeries.map(() => 0)}
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
                Utility Status
              </div>
              <div className="text-xs text-[#47729f] dark:text-slate-400">
                Automatic snapshot & manual override
              </div>
            </div>
            <Link to="/utility-status" className="text-xs font-semibold text-[#1f6fb5] dark:text-sky-400 hover:underline">
              View
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
                HVAC Status
              </div>
              <div className="text-xs text-[#47729f] dark:text-slate-400">
                Automatic snapshot & manual override
              </div>
            </div>
            <Link to="/utility-status" className="text-xs font-semibold text-[#1f6fb5] dark:text-sky-400 hover:underline">
              View
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
                Most Active Alarms
              </div>
              <div className="text-xs text-[#47729f] dark:text-slate-400">
                {activeAlarms.length > 0 ? `${activeAlarms.length} active alarms` : "Demo alarm"}
              </div>
            </div>
            <Link to="/alarms" className="text-xs font-semibold text-[#1f6fb5] dark:text-sky-400 hover:underline">
              View All
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
        <div className="mb-4">
          <div className="text-xs uppercase tracking-[0.2em] text-[#47729f] dark:text-slate-500 font-semibold">
            Previous Range Comparison (Electricity, Gas, Water, Carbon)
          </div>
          <div className="mt-1 text-sm text-[#47729f] dark:text-slate-400">
            Select comparison ranges independently for each parameter.
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-5">
          {/* Card Electricity */}
          <div className="rounded-xl border border-[#acd3ff] dark:border-slate-800 bg-white dark:bg-slate-950/60 p-4 transition-colors duration-300 flex flex-col justify-between">
            <div className="mb-3 flex items-center justify-between gap-2">
              <span className="text-xs uppercase tracking-[0.2em] text-[#47729f] dark:text-slate-400 font-semibold">Electricity</span>
              <div className="flex gap-0.5 rounded-full border border-[#acd3ff] dark:border-slate-800 bg-slate-50 dark:bg-slate-950 p-0.5 text-[9px]">
                {rangeOptions.map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setElRange(opt.value)}
                    className={`rounded-full px-1.5 py-0.5 font-bold transition ${
                      elRange === opt.value
                        ? "bg-[#1f6fb5] text-white"
                        : "text-[#47729f] dark:text-slate-500 hover:text-[#002b5c] dark:hover:text-slate-300"
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
            <div className="mt-2 flex-1">
              <ComparisonBarChart
                labels={elCompareLabels}
                current={elCurrent}
                previous={elPrevious}
                unit="kWh"
                heightClassName="h-32"
              />
            </div>
          </div>

          {/* Card Gas */}
          <div className="rounded-xl border border-[#acd3ff] dark:border-slate-800 bg-white dark:bg-slate-950/60 p-4 transition-colors duration-300 flex flex-col justify-between">
            <div className="mb-3 flex items-center justify-between gap-2">
              <span className="text-xs uppercase tracking-[0.2em] text-[#47729f] dark:text-slate-400 font-semibold">Gas</span>
              <div className="flex gap-0.5 rounded-full border border-[#acd3ff] dark:border-slate-800 bg-slate-50 dark:bg-slate-950 p-0.5 text-[9px]">
                {rangeOptions.map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setGasRange(opt.value)}
                    className={`rounded-full px-1.5 py-0.5 font-bold transition ${
                      gasRange === opt.value
                        ? "bg-[#1f6fb5] text-white"
                        : "text-[#47729f] dark:text-slate-500 hover:text-[#002b5c] dark:hover:text-slate-300"
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
            <div className="mt-2 flex-1">
              <ComparisonBarChart
                labels={gasCompareLabels}
                current={gasCurrent}
                previous={gasPrevious}
                unit="Sm³"
                heightClassName="h-32"
              />
            </div>
          </div>

          {/* Card Water */}
          <div className="rounded-xl border border-[#acd3ff] dark:border-slate-800 bg-white dark:bg-slate-950/60 p-4 transition-colors duration-300 flex flex-col justify-between">
            <div className="mb-3 flex items-center justify-between gap-2">
              <span className="text-xs uppercase tracking-[0.2em] text-[#47729f] dark:text-slate-400 font-semibold">Water</span>
              <div className="flex gap-0.5 rounded-full border border-[#acd3ff] dark:border-slate-800 bg-slate-50 dark:bg-slate-950 p-0.5 text-[9px]">
                {rangeOptions.map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setWaterRange(opt.value)}
                    className={`rounded-full px-1.5 py-0.5 font-bold transition ${
                      waterRange === opt.value
                        ? "bg-[#1f6fb5] text-white"
                        : "text-[#47729f] dark:text-slate-500 hover:text-[#002b5c] dark:hover:text-slate-300"
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
            <div className="mt-2 flex-1">
              <ComparisonBarChart
                labels={waterCompareLabels}
                current={waterCurrent}
                previous={waterPrevious}
                unit="m³"
                heightClassName="h-32"
              />
            </div>
          </div>

          {/* Card Carbon */}
          <div className="rounded-xl border border-[#acd3ff] dark:border-slate-800 bg-white dark:bg-slate-950/60 p-4 transition-colors duration-300 flex flex-col justify-between">
            <div className="mb-3 flex items-center justify-between gap-2">
              <span className="text-xs uppercase tracking-[0.2em] text-[#47729f] dark:text-slate-400 font-semibold">Carbon</span>
              <div className="flex gap-0.5 rounded-full border border-[#acd3ff] dark:border-slate-800 bg-slate-50 dark:bg-slate-950 p-0.5 text-[9px]">
                {rangeOptions.map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setCarbonRange(opt.value)}
                    className={`rounded-full px-1.5 py-0.5 font-bold transition ${
                      carbonRange === opt.value
                        ? "bg-[#1f6fb5] text-white"
                        : "text-[#47729f] dark:text-slate-500 hover:text-[#002b5c] dark:hover:text-slate-300"
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
            <div className="mt-2 flex-1">
              <ComparisonBarChart
                labels={carbonCompareLabels}
                current={carbonCurrent}
                previous={carbonPrevious}
                unit="kg"
                heightClassName="h-32"
              />
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
