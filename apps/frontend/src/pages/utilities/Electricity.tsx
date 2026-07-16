import { useCallback, useEffect, useMemo, useState } from "react";
import { PageHeader } from "../../components/ui/PageHeader";
import { Bar } from "react-chartjs-2";
import "../../components/charts/chartjs";
import { DonutChart } from "../../components/charts/DonutChart";
import { machineGroups } from "../../data/machines";
import { buildTimeAwareSeries, buildTimeLabels, getElapsedIndex } from "../../utils/series";
import { getJson } from "../../services/api.client";
import { useConfigStore } from "../../store/config.store";
import { getSocket } from "../../services/socket.service";
import { useSystemStore } from "../../store/system.store";

const dailyEnergyTotal = machineGroups.reduce((sum, group) => {
  const energy = group.summaryCards.find((card) => card.label === "Total Energy")?.value ?? 0;
  return sum + energy;
}, 0);

const electricityRate = 1467;

const MONTH_NAMES_ID = [
  "Januari", "Februari", "Maret", "April", "Mei", "Juni",
  "Juli", "Agustus", "September", "Oktober", "November", "Desember"
];
const MONTH_SHORT_ID = [
  "Jan", "Feb", "Mar", "Apr", "Mei", "Jun",
  "Jul", "Agu", "Sep", "Okt", "Nov", "Des"
];
const DAY_NAMES_ID = ["Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"];

const AVAILABLE_YEARS = [2025, 2026];

const ranges = [
  { id: "ytd", label: "YTD", points: 12, type: "month" as const, scale: 30 },
  { id: "hour", label: "Per Jam", points: 24, type: "time" as const, scale: 1 / 24 },
  { id: "day", label: "Per Hari", points: 30, type: "day" as const, scale: 1 },
  { id: "month", label: "Per Bulan", points: 12, type: "month" as const, scale: 30 },
  { id: "custom", label: "Kustom", points: 30, type: "day" as const, scale: 1 }
] as const;

const formatCurrency = (value: number) =>
  new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value);

const getLocalTodayString = () => {
  const d = new Date();
  const yr = d.getFullYear();
  const mo = String(d.getMonth() + 1).padStart(2, "0");
  const dy = String(d.getDate()).padStart(2, "0");
  return `${yr}-${mo}-${dy}`;
};

const formatPeakTs = (tsStr: string) => {
  if (!tsStr) return "";
  const dateObj = new Date(tsStr);
  const day = dateObj.getDate();
  const month = MONTH_SHORT_ID[dateObj.getMonth()];
  const year = dateObj.getFullYear();
  const hrs = String(dateObj.getHours()).padStart(2, "0");
  const mins = String(dateObj.getMinutes()).padStart(2, "0");
  return `${day} ${month} ${year}, ${hrs}:${mins} WIB`;
};

export default function Electricity() {
  const [range, setRange] = useState<(typeof ranges)[number]["id"]>("ytd");
  const [selectedYear, setSelectedYear] = useState(() => new Date().getFullYear());
  const [selectedMonth, setSelectedMonth] = useState(() => new Date().getMonth()); // 0-indexed
  const config = ranges.find((item) => item.id === range) ?? ranges[0];

  // Custom start and end dates for charts (default to today)
  const [chartStartDate, setChartStartDate] = useState(getLocalTodayString);
  const [chartEndDate, setChartEndDate] = useState(getLocalTodayString);

  const maxIdx = useMemo(() => getElapsedIndex(config.type), [config.type]);

  const [summaryData, setSummaryData] = useState<any>(null);
  const [summaryLoading, setSummaryLoading] = useState(true);
  const [chartData, setChartData] = useState<any>(null);
  const [chartLoading, setChartLoading] = useState(true);

  const [livePf, setLivePf] = useState<number | null>(null);
  const [pfStatus, setPfStatus] = useState<"connected" | "offline">("offline");

  const theme = useSystemStore((state) => state.theme);
  const isDark = theme === "dark";

  // Retrieve custom rates from useConfigStore
  const wbpRate = useConfigStore((state) => state.wbpRate);
  const lwbpRate = useConfigStore((state) => state.lwbpRate);

  const fetchData = useCallback((showLoading = false) => {
    if (showLoading) {
      setSummaryLoading(true);
      setChartLoading(true);
    }
    let url = `/analytics/electricity?deviceId=Cubicle_PLN_PM8000`;
    if (range === "custom") {
      url += `&from=${chartStartDate}&to=${chartEndDate}`;
    } else if (range === "hour") {
      const todayStr = getLocalTodayString();
      url += `&from=${todayStr}&to=${todayStr}`;
    } else {
      url += `&year=${selectedYear}`;
    }
    url += `&_t=${Date.now()}`;

    getJson<{ data: any }>(url)
      .then((res) => {
        setSummaryData(res.data);
        setChartData(res.data);
        if (res.data?.pqData) {
          setLivePf(res.data.pqData.pf);
          setPfStatus(res.data.pqData.pfStatus || "offline");
        }
        if (showLoading) {
          setSummaryLoading(false);
          setChartLoading(false);
        }
      })
      .catch((err) => {
        console.error("Failed to load electricity data", err);
        if (showLoading) {
          setSummaryLoading(false);
          setChartLoading(false);
        }
      });
  }, [range, selectedYear, chartStartDate, chartEndDate]);

  useEffect(() => {
    fetchData(true);
  }, [fetchData]);

  // Handle auto-fetch every 2 seconds and socket event handlers
  useEffect(() => {
    let active = true;

    const interval = setInterval(() => {
      if (active) {
        fetchData(false);
      }
    }, 2000);

    const socket = getSocket();

    const handleConfigUpdate = () => {
      console.log("Config update event received from socket, fetching rates and data...");
      useConfigStore.getState().fetchRates().then(() => {
        if (active) {
          fetchData(false);
        }
      });
    };

    const handleElectricityUpdate = () => {
      console.log("Electricity update event received from socket, re-fetching data...");
      if (active) {
        fetchData(false);
      }
    };

    const handlePowerFactorStatus = (payload: any) => {
      console.log("Power factor socket update:", payload);
      if (active) {
        setLivePf(payload.value);
        setPfStatus(payload.status);
      }
    };

    socket.on("config:update", handleConfigUpdate);
    socket.on("electricity:update", handleElectricityUpdate);
    socket.on("power_factor:status", handlePowerFactorStatus);

    return () => {
      active = false;
      clearInterval(interval);
      socket.off("config:update", handleConfigUpdate);
      socket.off("electricity:update", handleElectricityUpdate);
      socket.off("power_factor:status", handlePowerFactorStatus);
    };
  }, [fetchData]);

  const hasSummaryData = !!summaryData;
  const hasChartData = !!chartData;

  const currentMonth = useMemo(() => {
    if (range === "day") {
      return selectedMonth + 1;
    }
    const now = new Date();
    if (selectedYear === now.getFullYear()) {
      return now.getMonth() + 1; // 1-indexed
    }
    if (hasChartData && chartData.charts.daily) {
      for (let m = 12; m >= 1; m--) {
        const monthPrefix = `${selectedYear}-${String(m).padStart(2, "0")}`;
        const hasVal = chartData.charts.daily.some((d: any) => d.day.startsWith(monthPrefix) && d.value > 0);
        if (hasVal) return m;
      }
    }
    return 12; // fallback to December
  }, [hasChartData, chartData, selectedYear, range, selectedMonth]);

  const monthlyDailyRecords = useMemo(() => {
    if (hasChartData && chartData.charts.daily) {
      const monthPrefix = `${selectedYear}-${String(currentMonth).padStart(2, "0")}`;
      return chartData.charts.daily.filter((d: any) => d.day.startsWith(monthPrefix));
    }
    return [];
  }, [hasChartData, chartData, selectedYear, currentMonth]);

  const customDailyRecords = useMemo(() => {
    if (hasChartData && chartData.charts.daily) {
      if (range === "custom") {
        return chartData.charts.daily.filter((d: any) => d.day >= chartStartDate && d.day <= chartEndDate);
      }
    }
    return [];
  }, [hasChartData, chartData, range, chartStartDate, chartEndDate]);

  // ========== TREND LINE CHART SERIES ==========
  const series = useMemo(() => {
    if (hasChartData) {
      if (range === "hour") {
        return chartData.charts.hourly;
      } else if (range === "day") {
        return monthlyDailyRecords.map((d: any) => d.value);
      } else if (range === "custom") {
        if (chartStartDate === chartEndDate) {
          return chartData.charts.hourly;
        }
        return customDailyRecords.map((d: any) => d.value);
      } else {
        // YTD and Per Bulan: use monthly data (always 12 entries, Jan-Dec)
        return chartData.charts.monthly.map((m: any) => m.value);
      }
    }
    const base = dailyEnergyTotal * config.scale;
    return buildTimeAwareSeries(config.points, base, base * 0.35, 1, maxIdx);
  }, [hasChartData, range, config, chartData, maxIdx, monthlyDailyRecords, customDailyRecords, chartStartDate, chartEndDate]);

  // ========== TIMELINE LABELS (rich, descriptive) ==========
  const labels = useMemo(() => {
    if (hasChartData) {
      if (range === "hour" || (range === "custom" && chartStartDate === chartEndDate)) {
        // "01:00 WIB", "02:00 WIB", ..., "24:00 WIB"
        return Array.from({ length: 24 }, (_, i) =>
          `${(i + 1).toString().padStart(2, "0")}:00 WIB`
        );
      } else if (range === "day") {
        // "Senin, 01 Agustus 2025" for every day in the month
        return monthlyDailyRecords.map((d: any) => {
          const [yr, mo, dy] = d.day.split("-").map(Number);
          const dateObj = new Date(yr, mo - 1, dy);
          const dayName = DAY_NAMES_ID[dateObj.getDay()];
          const monthName = MONTH_NAMES_ID[mo - 1];
          return `${dayName}, ${String(dy).padStart(2, "0")} ${monthName} ${yr}`;
        });
      } else if (range === "custom") {
        return customDailyRecords.map((d: any) => {
          const [yr, mo, dy] = d.day.split("-").map(Number);
          const dateObj = new Date(yr, mo - 1, dy);
          const dayName = DAY_NAMES_ID[dateObj.getDay()];
          const monthName = MONTH_NAMES_ID[mo - 1];
          return `${dayName}, ${String(dy).padStart(2, "0")} ${monthName} ${yr}`;
        });
      } else {
        // YTD / Per Bulan: "Januari 2025", "Februari 2025", ..., "Desember 2025"
        return chartData.charts.monthly.map((m: any) => {
          const [yr, mo] = m.month.split("-").map(Number);
          return `${MONTH_NAMES_ID[mo - 1]} ${yr}`;
        });
      }
    }
    return buildTimeLabels(config.points, config.type);
  }, [hasChartData, range, config, chartData, monthlyDailyRecords, customDailyRecords, chartStartDate, chartEndDate]);

  // ========== BAR CHART DATA (from database) ==========
  const barLabels = useMemo(() => {
    if (hasChartData) {
      if (range === "hour" || (range === "custom" && chartStartDate === chartEndDate)) {
        return Array.from({ length: 24 }, (_, i) => `${(i + 1).toString().padStart(2, "0")}:00`);
      } else if (range === "day") {
        return monthlyDailyRecords.map((d: any) => {
          const parts = d.day.split("-");
          return `${parts[2]}`; // day number only, e.g. "01", "02"
        });
      } else if (range === "custom") {
        const firstDay = customDailyRecords[0]?.day;
        const lastDay = customDailyRecords[customDailyRecords.length - 1]?.day;
        const isSameMonth = firstDay && lastDay && firstDay.substring(0, 7) === lastDay.substring(0, 7);
        return customDailyRecords.map((d: any) => {
          const parts = d.day.split("-");
          return isSameMonth ? parts[2] : `${parts[2]}/${parts[1]}`;
        });
      } else {
        // Always 12 months
        return chartData.charts.monthly.map((m: any) => {
          const [yr, mo] = m.month.split("-").map(Number);
          return `${MONTH_SHORT_ID[mo - 1]} ${yr}`;
        });
      }
    }
    return buildTimeLabels(config.points, config.type);
  }, [hasChartData, range, config, chartData, monthlyDailyRecords, customDailyRecords, chartStartDate, chartEndDate]);

  // ========== STACKED WBP/LWBP BAR VALUES ==========
  const barWbpValues = useMemo(() => {
    if (hasChartData) {
      if (range === "hour") {
        return chartData.charts.hourlyWbp || Array.from({ length: 24 }, () => 0);
      } else if (range === "day") {
        return monthlyDailyRecords.map((d: any) => d.wbp || 0);
      } else if (range === "custom") {
        if (chartStartDate === chartEndDate) {
          return chartData.charts.hourlyWbp || Array.from({ length: 24 }, () => 0);
        }
        return customDailyRecords.map((d: any) => d.wbp || 0);
      } else {
        return chartData.charts.monthly.map((m: any) => m.wbp || 0);
      }
    }
    return Array.from({ length: config.points }, () => 0);
  }, [hasChartData, range, config, chartData, monthlyDailyRecords, customDailyRecords, chartStartDate, chartEndDate]);

  const barLwbpValues = useMemo(() => {
    if (hasChartData) {
      if (range === "hour") {
        return chartData.charts.hourlyLwbp || Array.from({ length: 24 }, () => 0);
      } else if (range === "day") {
        return monthlyDailyRecords.map((d: any) => d.lwbp || 0);
      } else if (range === "custom") {
        if (chartStartDate === chartEndDate) {
          return chartData.charts.hourlyLwbp || Array.from({ length: 24 }, () => 0);
        }
        return customDailyRecords.map((d: any) => d.lwbp || 0);
      } else {
        return chartData.charts.monthly.map((m: any) => m.lwbp || 0);
      }
    }
    return Array.from({ length: config.points }, () => 0);
  }, [hasChartData, range, config, chartData, monthlyDailyRecords, customDailyRecords, chartStartDate, chartEndDate]);

  const barUnit = useMemo(() => {
    if (range === "hour" || range === "day" || range === "custom") return "kWh";
    return "MWh"; // YTD and Per Bulan
  }, [range]);

  // ========== CARD PERIOD VALUES (top 5 summary cards) ==========
  const cardSummary = useMemo(() => {
    if (!hasSummaryData || !summaryData) {
      return {
        totalCost: dailyEnergyTotal * config.scale * electricityRate,
        totalKwh: dailyEnergyTotal * config.scale,
        peakDemand: 1200,
        peakDemandTs: null,
        loadFactor: 88.5,
        wbpKwh: 0,
        lwbpKwh: 0,
        wbpCost: 0,
        lwbpCost: 0
      };
    }

    if (range === "day" && summaryData.summary.perMonthSummary) {
      const monthData = summaryData.summary.perMonthSummary[selectedMonth];
      if (monthData) {
        return {
          totalCost: monthData.totalCost,
          totalKwh: monthData.totalKwh,
          peakDemand: monthData.peakDemand,
          peakDemandTs: monthData.peakDemandTs,
          loadFactor: summaryData.pqData.pf ? summaryData.pqData.pf * 100 : 88.5,
          wbpKwh: monthData.wbpKwh,
          lwbpKwh: monthData.lwbpKwh,
          wbpCost: monthData.wbpCost,
          lwbpCost: monthData.lwbpCost
        };
      }
    }

    // Yearly, Hourly, or Custom: use the direct summary metrics
    return {
      totalCost: summaryData.summary.totalCost,
      totalKwh: summaryData.summary.totalKwh,
      peakDemand: summaryData.pqData.activePower,
      peakDemandTs: summaryData.pqData.activePowerTs,
      loadFactor: summaryData.pqData.pf ? summaryData.pqData.pf * 100 : 0,
      wbpKwh: summaryData.summary.wbpKwh,
      lwbpKwh: summaryData.summary.lwbpKwh,
      wbpCost: summaryData.summary.wbpCost,
      lwbpCost: summaryData.summary.lwbpCost
    };
  }, [hasSummaryData, summaryData, range, selectedMonth, config]);

  const chartPeakDemandInfo = useMemo(() => {
    if (!hasChartData || !chartData) {
      return { value: 1200, ts: null };
    }

    // 1. If range is hourly (hour, or custom single day)
    if (range === "hour" || (range === "custom" && chartStartDate === chartEndDate)) {
      const hourly = chartData.charts.hourly || [];
      let maxVal = 0;
      let maxHourIdx = -1;
      for (let i = 0; i < hourly.length; i++) {
        if (hourly[i] > maxVal) {
          maxVal = hourly[i];
          maxHourIdx = i;
        }
      }
      
      if (maxHourIdx !== -1) {
        const targetDateStr = range === "hour" ? getLocalTodayString() : chartStartDate;
        const peakHr = maxHourIdx + 1;
        const peakTs = `${targetDateStr}T${String(peakHr).padStart(2, "0")}:00:00.000+07:00`;
        return { value: maxVal, ts: peakTs };
      }
      return { value: 0, ts: null };
    }

    // 2. If range is day (Per Hari)
    if (range === "day") {
      const monthData = chartData.summary.perMonthSummary?.[currentMonth - 1];
      if (monthData) {
        return { value: monthData.peakDemand, ts: monthData.peakDemandTs };
      }
      return { value: 0, ts: null };
    }

    // 3. If range is custom (multi-day)
    if (range === "custom") {
      return {
        value: chartData.pqData.activePower,
        ts: chartData.pqData.activePowerTs
      };
    }

    // 4. For YTD or month (Per Bulan)
    let maxPeak = 0;
    let peakTs = null;
    if (chartData.summary.perMonthSummary) {
      for (const m of chartData.summary.perMonthSummary) {
        if (m.peakDemand > maxPeak) {
          maxPeak = m.peakDemand;
          peakTs = m.peakDemandTs;
        }
      }
    }
    return { value: maxPeak, ts: peakTs };
  }, [hasChartData, chartData, range, chartStartDate, chartEndDate, currentMonth, selectedYear]);

  // ========== TREND PANEL DISTRIBUSI (MultiLineChart) ==========
  const mdpSeries = useMemo(() => {
    if (hasChartData) {
      if (range === "hour") {
        return [
          { name: "Incoming PLN", values: chartData.charts.hourly, color: "#3b82f6" }
        ];
      } else if (range === "day") {
        return [
          { name: "Incoming PLN", values: monthlyDailyRecords.map((d: any) => d.value / 24), color: "#3b82f6" }
        ];
      } else if (range === "custom") {
        if (chartStartDate === chartEndDate) {
          return [
            { name: "Incoming PLN", values: chartData.charts.hourly, color: "#3b82f6" }
          ];
        }
        return [
          { name: "Incoming PLN", values: customDailyRecords.map((d: any) => d.value / 24), color: "#3b82f6" }
        ];
      } else {
        return [
          { name: "Incoming PLN", values: chartData.charts.monthly.map((m: any) => m.value), color: "#3b82f6" }
        ];
      }
    }
    const base = dailyEnergyTotal * config.scale;
    return [
      { name: "Incoming PLN", values: buildTimeAwareSeries(config.points, base, base * 0.15, 1, maxIdx), color: "#3b82f6" }
    ];
  }, [hasChartData, range, config, chartData, maxIdx, monthlyDailyRecords, customDailyRecords, chartStartDate, chartEndDate]);

  const donutSegments = useMemo(() => {
    if (hasChartData) {
      let wbp = chartData.summary.wbpKwh;
      let total = chartData.summary.totalKwh;

      if (range === "hour") {
        wbp = chartData.summary.todayWbpKwh ?? 0;
        total = (chartData.summary.todayWbpKwh ?? 0) + (chartData.summary.todayLwbpKwh ?? 0);
      } else if (range === "day") {
        wbp = chartData.summary.monthlyWbpKwh ?? 0;
        total = (chartData.summary.monthlyWbpKwh ?? 0) + (chartData.summary.monthlyLwbpKwh ?? 0);
      } else if (range === "custom") {
        if (chartStartDate === chartEndDate) {
          const hWbp = chartData.charts.hourlyWbp || Array.from({ length: 24 }, () => 0);
          const hLwbp = chartData.charts.hourlyLwbp || Array.from({ length: 24 }, () => 0);
          wbp = hWbp.reduce((acc: number, curr: number) => acc + curr, 0);
          const lwbp = hLwbp.reduce((acc: number, curr: number) => acc + curr, 0);
          total = wbp + lwbp;
        } else {
          wbp = customDailyRecords.reduce((acc: number, curr: any) => acc + (curr.wbp || 0), 0);
          const lwbp = customDailyRecords.reduce((acc: number, curr: any) => acc + (curr.lwbp || 0), 0);
          total = wbp + lwbp;
        }
      }

      if (total > 0) {
        const wbpPct = Math.round((wbp / total) * 100);
        const lwbpPct = 100 - wbpPct;
        return [
          { label: "Beban WBP (17-22)", value: wbpPct, color: "#ef4444" },
          { label: "Beban LWBP", value: lwbpPct, color: "#3b82f6" }
        ];
      }
    }
    return [
      { label: "Beban WBP (17-22)", value: 0, color: "#ef4444" },
      { label: "Beban LWBP", value: 0, color: "#3b82f6" }
    ];
  }, [hasChartData, chartData, range, customDailyRecords, chartStartDate, chartEndDate]);

  // ========== TOP 10 ENERGY CONSUMING UNITS (Horizontal Bar Chart) ==========
  const top10Units = useMemo(() => {
    const allUnits: { name: string; value: number }[] = [];
    machineGroups.forEach((group) => {
      group.units.forEach((unit) => {
        const energyCard = unit.summaryCards.find((c) => c.label === "Energy");
        if (energyCard) {
          allUnits.push({
            name: unit.unitLabel,
            value: energyCard.value
          });
        }
      });
    });
    // Sort descending by value
    allUnits.sort((a, b) => b.value - a.value);
    // Take top 10
    return allUnits.slice(0, 10);
  }, []);

  const top10Labels = useMemo(() => top10Units.map((u) => u.name), [top10Units]);
  const top10Values = useMemo(() => top10Units.map((u) => u.value), [top10Units]);

  const horizontalChartData = {
    labels: top10Labels,
    datasets: [
      {
        label: "kWh",
        data: top10Values,
        backgroundColor: "rgba(59, 130, 246, 0.8)",
        borderColor: "rgb(59, 130, 246)",
        borderWidth: 1,
        borderRadius: 4,
        barPercentage: 0.6
      }
    ]
  };

  const horizontalChartOptions = {
    indexAxis: "y" as const,
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: {
        callbacks: {
          label: (context: any) => `${Number(context.parsed.x).toLocaleString("id-ID")} kWh`
        }
      }
    },
    scales: {
      x: {
        grid: { color: "rgba(203, 213, 225, 0.3)" },
        ticks: { font: { size: 10 } }
      },
      y: {
        grid: { display: false },
        ticks: { font: { size: 10 }, autoSkip: false }
      }
    }
  };

  // ========== STACKED BAR CHART DATA + OPTIONS ==========
  const stackedBarData = {
    labels: barLabels,
    datasets: [
      {
        label: `LWBP ${barUnit}`,
        data: barLwbpValues,
        backgroundColor: "rgba(59, 130, 246, 0.8)",
        hoverBackgroundColor: "rgba(59, 130, 246, 1)",
        borderWidth: 0,
        borderRadius: { topLeft: 0, topRight: 0, bottomLeft: 4, bottomRight: 4 },
        barPercentage: 0.65,
        stack: "beban"
      },
      {
        label: `WBP ${barUnit}`,
        data: barWbpValues,
        backgroundColor: "rgba(239, 68, 68, 0.8)",
        hoverBackgroundColor: "rgba(239, 68, 68, 1)",
        borderWidth: 0,
        borderRadius: { topLeft: 4, topRight: 4, bottomLeft: 0, bottomRight: 0 },
        barPercentage: 0.65,
        stack: "beban"
      }
    ]
  };

  const stackedBarOptions: any = {
    responsive: true,
    maintainAspectRatio: false,
    animation: { duration: 0 },
    hover: { mode: "index" as const, intersect: false },
    interaction: { mode: "index" as const, intersect: false },
    plugins: {
      legend: {
        display: true,
        position: "top" as const,
        align: "end" as const,
        labels: {
          color: isDark ? "rgba(148, 163, 184, 0.9)" : "rgba(71, 85, 105, 0.9)",
          font: { size: 10, family: "Plus Jakarta Sans", weight: "600" as const },
          usePointStyle: true,
          pointStyle: "rectRounded",
          padding: 12
        }
      },
      tooltip: {
        backgroundColor: isDark ? "rgba(13, 21, 39, 0.95)" : "rgba(255, 255, 255, 0.95)",
        titleColor: isDark ? "rgba(241, 245, 249, 0.9)" : "rgba(15, 23, 42, 0.9)",
        bodyColor: isDark ? "rgba(241, 245, 249, 0.9)" : "rgba(15, 23, 42, 0.9)",
        borderColor: isDark ? "rgba(51, 65, 85, 0.5)" : "rgba(203, 213, 225, 0.5)",
        borderWidth: 1,
        padding: 12,
        bodyFont: { family: "IBM Plex Mono, monospace", size: 11 },
        titleFont: { family: "Plus Jakarta Sans", size: 11, weight: "600" as const },
        callbacks: {
          label: (context: any) => {
            const val = Number(context.parsed.y).toLocaleString("id-ID", { maximumFractionDigits: 2 });
            return `${context.dataset.label}: ${val}`;
          },
          afterBody: (tooltipItems: any[]) => {
            if (tooltipItems.length > 0) {
              const index = tooltipItems[0].dataIndex;
              const lwbp = barLwbpValues[index] || 0;
              const wbp = barWbpValues[index] || 0;
              const total = lwbp + wbp;
              return [`─────────────────`, `Total: ${total.toLocaleString("id-ID", { maximumFractionDigits: 2 })} ${barUnit}`];
            }
            return [];
          }
        }
      }
    },
    scales: {
      x: {
        stacked: true,
        grid: { display: false },
        ticks: {
          color: isDark ? "rgba(148, 163, 184, 0.8)" : "rgba(71, 85, 105, 0.8)",
          font: { size: 10 },
          maxRotation: 0,
          autoSkip: true,
          maxTicksLimit: 12
        }
      },
      y: {
        stacked: true,
        grid: { color: isDark ? "rgba(51, 65, 85, 0.4)" : "rgba(203, 213, 225, 0.6)" },
        ticks: {
          color: isDark ? "rgba(148, 163, 184, 0.8)" : "rgba(71, 85, 105, 0.8)",
          callback: (value: number) => `${value}`
        }
      }
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader title="Listrik" description="Monitor beban listrik utama, peak demand, dan biaya energi." />

      {/* Active Period Indicator */}
      <div className="flex items-center gap-1.5 text-xs font-bold text-slate-400 dark:text-slate-500 bg-slate-50 dark:bg-slate-800/20 px-3.5 py-2 rounded-xl w-fit border border-slate-200/50 dark:border-slate-800/50">
        <span className="h-2 w-2 rounded-full bg-cyan-500 animate-pulse" />
        <span>
          Periode Aktif: {range === "ytd" || range === "month"
            ? `Tahun ${selectedYear}`
            : range === "day"
            ? `${MONTH_NAMES_ID[selectedMonth]} ${selectedYear}`
            : range === "hour"
            ? `Hari Ini (${chartStartDate})`
            : chartStartDate === chartEndDate
            ? `Tanggal ${chartStartDate}`
            : `${chartStartDate} s/d ${chartEndDate}`}
        </span>
      </div>

      {/* Executive Summary */}
      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-sm transition hover:shadow-md hover:border-blue-400 dark:hover:border-blue-500">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-[0.2em] text-slate-400 dark:text-slate-500">Total Biaya</span>
            <div className="h-8 w-8 rounded-lg bg-blue-500/10 flex items-center justify-center">
              <svg className="h-4 w-4 text-blue-500" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M12 6v12m-3-2.818.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" /></svg>
            </div>
          </div>
          <div className="mt-3 text-2xl font-extrabold text-slate-800 dark:text-white font-mono">
            {summaryLoading ? "Calculating..." : formatCurrency(cardSummary.totalCost)}
          </div>
          <div className="mt-1 text-xs font-semibold text-blue-600 dark:text-blue-400 flex justify-between items-center">
            <span>{summaryLoading ? "Loading..." : cardSummary.totalKwh.toLocaleString("id-ID", { maximumFractionDigits: 0 })} kWh</span>
            <span className="text-[10px] text-slate-400 dark:text-slate-500 font-normal">
              Tarif: Rp {wbpRate.toLocaleString("id-ID", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}/{lwbpRate.toLocaleString("id-ID", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-sm transition hover:shadow-md hover:border-amber-400 dark:hover:border-amber-500">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-[0.2em] text-slate-400 dark:text-slate-500">Peak Demand</span>
            <div className="h-8 w-8 rounded-lg bg-amber-500/10 flex items-center justify-center">
              <svg className="h-4 w-4 text-amber-500" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="m3.75 13.5 10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75Z" /></svg>
            </div>
          </div>
          <div className="mt-3 text-2xl font-extrabold text-slate-800 dark:text-white font-mono">
            {chartLoading ? "Loading..." : `${chartPeakDemandInfo.value.toLocaleString("id-ID", { maximumFractionDigits: 1 })} kW`}
          </div>
          <div className="mt-1 text-xs text-slate-400 dark:text-slate-500">
            {chartPeakDemandInfo.ts ? (
              <span>Terjadi: <strong className="text-amber-500 font-semibold">{formatPeakTs(chartPeakDemandInfo.ts)}</strong></span>
            ) : (
              "Estimasi beban puncak"
            )}
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-sm transition hover:shadow-md hover:border-emerald-400 dark:hover:border-emerald-500">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-[0.2em] text-slate-400 dark:text-slate-500">Load Factor</span>
            <div className="h-8 w-8 rounded-lg bg-emerald-500/10 flex items-center justify-center">
              <svg className="h-4 w-4 text-emerald-500" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18 9 11.25l4.306 4.306a11.95 11.95 0 0 1 5.814-5.518l2.74-1.22m0 0-5.94-2.281m5.94 2.28-2.28 5.941" /></svg>
            </div>
          </div>
          {pfStatus === "offline" ? (
            <div className="mt-3 text-base font-bold text-red-500 dark:text-red-400 font-mono">
              API TIDAK TERKIRIM
            </div>
          ) : (
            <div className="mt-3 text-2xl font-extrabold text-slate-800 dark:text-white font-mono">
              {summaryLoading ? "Loading..." : `${cardSummary.loadFactor.toFixed(1)}%`}
            </div>
          )}
          <div className="mt-1 text-xs text-slate-400 dark:text-slate-500">Stabilitas beban listrik</div>
        </div>

        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-sm transition hover:shadow-md hover:border-rose-400 dark:hover:border-rose-500">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-[0.2em] text-rose-500 dark:text-rose-400">Beban WBP</span>
            <div className="h-8 w-8 rounded-lg bg-rose-500/10 flex items-center justify-center">
              <svg className="h-4 w-4 text-rose-500" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" /></svg>
            </div>
          </div>
          <div className="mt-3 text-xl font-extrabold text-slate-800 dark:text-white font-mono">
            {summaryLoading ? "Loading..." : `${cardSummary.wbpKwh.toLocaleString("id-ID", { maximumFractionDigits: 0 })} kWh`}
          </div>
          <div className="mt-1 text-xs font-semibold text-rose-500">
            {summaryLoading ? "" : formatCurrency(cardSummary.wbpCost)}
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-sm transition hover:shadow-md hover:border-emerald-400 dark:hover:border-emerald-500">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-[0.2em] text-emerald-500 dark:text-emerald-400">Beban LWBP</span>
            <div className="h-8 w-8 rounded-lg bg-emerald-500/10 flex items-center justify-center">
              <svg className="h-4 w-4 text-emerald-500" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M21.752 15.002A9.72 9.72 0 0 1 18 15.75c-5.385 0-9.75-4.365-9.75-9.75 0-1.33.266-2.597.748-3.752A9.753 9.753 0 0 0 3 11.25C3 16.635 7.365 21 12.75 21a9.753 9.753 0 0 0 6.002-2.082Z" /></svg>
            </div>
          </div>
          <div className="mt-3 text-xl font-extrabold text-slate-800 dark:text-white font-mono">
            {summaryLoading ? "Loading..." : `${cardSummary.lwbpKwh.toLocaleString("id-ID", { maximumFractionDigits: 0 })} kWh`}
          </div>
          <div className="mt-1 text-xs font-semibold text-emerald-500">
            {summaryLoading ? "" : formatCurrency(cardSummary.lwbpCost)}
          </div>
        </div>
      </section>

      {/* MultiLineChart + Donut */}
      <div className="grid gap-6 lg:grid-cols-[2fr_1fr]">
        <section className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
            <div>
              <h3 className="text-sm font-bold uppercase tracking-[0.2em] text-slate-400 dark:text-slate-500">Trend Panel Distribusi</h3>
              <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">
                {range === "day"
                  ? `Beban Incoming PLN — Harian Bulan ${MONTH_NAMES_ID[currentMonth - 1]} ${selectedYear}.`
                  : range === "custom"
                  ? (chartStartDate === chartEndDate
                      ? `Beban Incoming PLN — Per Jam Tanggal ${chartStartDate}.`
                      : `Beban Incoming PLN — Periode ${chartStartDate} s/d ${chartEndDate}.`)
                  : "Beban Incoming PLN — data historis (WBP & LWBP)."}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {/* Year Selector */}
              {(range === "ytd" || range === "day" || range === "month") && (
                <select
                  value={selectedYear}
                  onChange={(e) => setSelectedYear(Number(e.target.value))}
                  className="rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 px-3 py-1.5 text-xs font-bold text-slate-600 dark:text-slate-300 focus:outline-none focus:ring-2 focus:ring-cyan-500 cursor-pointer transition"
                >
                  {AVAILABLE_YEARS.map((yr) => (
                    <option key={yr} value={yr}>{yr}</option>
                  ))}
                </select>
              )}

              {/* Month Selector */}
              {range === "day" && (
                <select
                  value={selectedMonth}
                  onChange={(e) => setSelectedMonth(Number(e.target.value))}
                  className="rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 px-3 py-1.5 text-xs font-bold text-slate-600 dark:text-slate-300 focus:outline-none focus:ring-2 focus:ring-cyan-500 cursor-pointer transition"
                >
                  {MONTH_NAMES_ID.map((name, idx) => (
                    <option key={idx} value={idx}>{name}</option>
                  ))}
                </select>
              )}

              {/* Custom Date Pickers */}
              {range === "custom" && (
                <div className="flex items-center gap-2">
                  <input
                    type="date"
                    value={chartStartDate}
                    onChange={(e) => setChartStartDate(e.target.value)}
                    className="rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 px-3 py-1.5 text-xs font-bold text-slate-600 dark:text-slate-300 focus:outline-none focus:ring-2 focus:ring-cyan-500 cursor-pointer transition"
                  />
                  <span className="text-xs font-bold text-slate-400">s/d</span>
                  <input
                    type="date"
                    value={chartEndDate}
                    onChange={(e) => setChartEndDate(e.target.value)}
                    className="rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 px-3 py-1.5 text-xs font-bold text-slate-600 dark:text-slate-300 focus:outline-none focus:ring-2 focus:ring-cyan-500 cursor-pointer transition"
                  />
                </div>
              )}

              {/* Range Selector */}
              <div className="flex items-center gap-1 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 p-0.5 text-xs">
                {ranges.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setRange(item.id)}
                    className={`rounded-md px-3 py-1.5 font-bold transition-all ${
                      range === item.id
                        ? "bg-cyan-500 text-white shadow-sm"
                        : "text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
                    }`}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
          <div className="bg-slate-50 dark:bg-slate-950/40 rounded-xl p-4 border border-slate-100 dark:border-slate-800/80">
            <div style={{ height: 256 }}>
              <Bar data={stackedBarData} options={stackedBarOptions} />
            </div>
          </div>
        </section>

        <section className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-sm flex flex-col justify-between">
          <div>
            <h3 className="text-sm font-bold uppercase tracking-[0.2em] text-slate-400 dark:text-slate-500">Distribusi Beban</h3>
            <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">Perbandingan konsumsi WBP vs LWBP.</p>
          </div>
          <div className="my-6 flex justify-center">
            <DonutChart segments={donutSegments} size={150} thickness={18} centerLabel={`${donutSegments[0]?.value || 0}%`} />
          </div>
          <div className="space-y-2">
            {donutSegments.map((item) => (
              <div key={item.label} className="flex items-center justify-between text-xs border-b border-slate-100 dark:border-slate-800/60 pb-1.5 last:border-0 last:pb-0">
                <span className="flex items-center gap-2 text-slate-600 dark:text-slate-300 font-medium">
                  <span className="h-2 w-2 rounded-full" style={{ backgroundColor: item.color }} />
                  {item.label}
                </span>
                <span className="font-bold text-slate-800 dark:text-white font-mono">{item.value}%</span>
              </div>
            ))}
          </div>
        </section>
      </div>

      {/* Parameters */}
      <section className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-sm">
        <h3 className="text-sm font-bold uppercase tracking-[0.2em] text-slate-400 dark:text-slate-500 mb-4">Parameter & Rate Limit</h3>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-xl border border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/30 p-4 transition hover:border-cyan-400">
            <div className="text-xs text-slate-400 dark:text-slate-500">Peak Limit</div>
            <div className="mt-1 text-lg font-bold text-slate-800 dark:text-white font-mono">12,000 kW</div>
          </div>
          <div className="rounded-xl border border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/30 p-4 transition hover:border-cyan-400">
            <div className="text-xs text-slate-400 dark:text-slate-500">Trafo Capacity</div>
            <div className="mt-1 text-lg font-bold text-slate-800 dark:text-white font-mono">15,000 kVA</div>
          </div>
          <div className="rounded-xl border border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/30 p-4 transition hover:border-emerald-400 flex flex-col justify-between">
            <div>
              <div className="text-xs text-slate-400 dark:text-slate-500">Power Factor (Cos φ)</div>
              {pfStatus === "offline" ? (
                <div className="mt-1 text-sm font-bold text-red-500 dark:text-red-400 font-mono">
                  API Tidak Terkirim
                </div>
              ) : (
                <div className="mt-1 text-lg font-bold text-emerald-600 dark:text-emerald-400 font-mono">
                  {chartLoading ? "Loading..." : livePf !== null ? livePf.toFixed(2) : "Loading..."}
                </div>
              )}
            </div>
            <div className="text-[10px] text-slate-400 dark:text-slate-500 mt-1">Target: &ge; 0.85</div>
          </div>
          <div className="rounded-xl border border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/30 p-4 transition hover:border-blue-400">
            <div className="text-xs text-slate-400 dark:text-slate-500">Tarif WBP / LWBP</div>
            <div className="mt-1 text-base font-bold text-slate-800 dark:text-white font-mono">
              Rp {wbpRate.toLocaleString("id-ID", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} / Rp {lwbpRate.toLocaleString("id-ID", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
          </div>
        </div>
      </section>

      {/* 10 Unit Konsumsi Terbesar (Horizontal Bar Chart) */}
      <section className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <div>
            <h3 className="text-sm font-bold uppercase tracking-[0.2em] text-slate-400 dark:text-slate-500">10 Unit Konsumsi Terbesar</h3>
            <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">
              Peringkat konsumsi listrik per unit mesin (kWh) yang diurutkan dari terbesar.
            </p>
          </div>
          <div className="text-xs font-mono text-slate-400">
            kWh
          </div>
        </div>
        <div className="bg-slate-50 dark:bg-slate-950/40 rounded-xl p-4 border border-slate-100 dark:border-slate-800/80 h-96">
          <Bar data={horizontalChartData} options={horizontalChartOptions} />
        </div>
      </section>
    </div>
  );
}
