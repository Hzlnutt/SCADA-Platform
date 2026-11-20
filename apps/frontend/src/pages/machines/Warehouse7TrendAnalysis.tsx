import { useCallback, useEffect, useMemo, useState } from "react";
import { Bar } from "react-chartjs-2";
import "../../components/charts/chartjs";
import { utils, writeFile } from "xlsx";
import { getJson } from "../../services/api.client";
import { getSocket } from "../../services/socket.service";
import { useSystemStore } from "../../store/system.store";
import { useTranslation } from "../../i18n/useTranslation";
import Warehouse7LineChart, { type Warehouse7TrendPayload } from "../../components/warehouse/Warehouse7LineChart";
import {
  Warehouse7DeviceFilterSelect,
  Warehouse7PeriodControls,
  type Wh7DeviceOption,
  type Wh7PeriodFilter
} from "../../components/warehouse/Warehouse7FilterBar";

const INITIAL_LOG_LIMIT = 10;
const AVAILABLE_YEARS = [2024, 2025, 2026, 2027];
const MONTH_NAMES_ID = [
  "Januari", "Februari", "Maret", "April", "Mei", "Juni",
  "Juli", "Agustus", "September", "Oktober", "November", "Desember"
];
const MONTH_NAMES_EN = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"
];
const MONTH_SHORT_ID = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"];
const MONTH_SHORT_EN = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

type KwhTimeframeRange = "ytd" | "hour" | "day" | "month" | "custom";

interface ElectricityReportRow {
  date: string;
  timestamp: string;
  tag: string;
  kwh: number | null;
  kw: number | null;
}

function getTodayDateStr(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function getPastDateStr(daysAgo: number): string {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function formatKwhNum(val: number): string {
  return (Number(val) || 0).toLocaleString("id-ID", {
    minimumFractionDigits: 1,
    maximumFractionDigits: 2
  });
}

function buildDateRangeList(startStr: string, endStr: string): string[] {
  const result: string[] = [];
  const start = new Date(`${startStr}T00:00:00`);
  const end = new Date(`${endStr}T00:00:00`);
  if (isNaN(start.getTime()) || isNaN(end.getTime()) || start > end) {
    return [startStr];
  }
  const cur = new Date(start);
  let safety = 0;
  while (cur <= end && safety < 366) {
    const y = cur.getFullYear();
    const m = String(cur.getMonth() + 1).padStart(2, "0");
    const d = String(cur.getDate()).padStart(2, "0");
    result.push(`${y}-${m}-${d}`);
    cur.setDate(cur.getDate() + 1);
    safety++;
  }
  return result;
}

function shiftDateOneMonthBack(dateStr: string): string {
  const [y, m, d] = String(dateStr || "")
    .split("-")
    .map(Number);
  if (!y || !m || !d) return dateStr;
  const prevYear = m === 1 ? y - 1 : y;
  const prevMonth = m === 1 ? 12 : m - 1;
  const maxDayInPrev = new Date(prevYear, prevMonth, 0).getDate();
  const clampedDay = Math.min(d, maxDayInPrev);
  return `${prevYear}-${String(prevMonth).padStart(2, "0")}-${String(clampedDay).padStart(2, "0")}`;
}

export default function Warehouse7TrendAnalysis() {
  const theme = useSystemStore((state) => state.theme);
  const isDark = theme === "dark";
  const { t, language } = useTranslation();

  const [period, setPeriod] = useState<Wh7PeriodFilter>("7d");
  const [startDate, setStartDate] = useState<string>(() => getPastDateStr(6));
  const [endDate, setEndDate] = useState<string>(getTodayDateStr);
  const [deviceMode, setDeviceMode] = useState<string>("all");
  const [trend, setTrend] = useState<Warehouse7TrendPayload | null>(null);
  const [loading, setLoading] = useState(false);
  const [showAllLogs, setShowAllLogs] = useState(false);

  // ── WH-7 (PM226) Multi-Timeframe Bar Chart State + Previous Month Comparison ──
  const nowInit = useMemo(() => new Date(), []);
  const [kwhRange, setKwhRange] = useState<KwhTimeframeRange>("hour");
  const [kwhSelectedYear, setKwhSelectedYear] = useState<number>(() => nowInit.getFullYear());
  const [kwhSelectedMonth, setKwhSelectedMonth] = useState<number>(() => nowInit.getMonth());
  const [kwhCompareYear, setKwhCompareYear] = useState<number>(() =>
    nowInit.getMonth() === 0 ? nowInit.getFullYear() - 1 : nowInit.getFullYear()
  );
  const [kwhCompareMonth, setKwhCompareMonth] = useState<number>(() =>
    nowInit.getMonth() === 0 ? 11 : nowInit.getMonth() - 1
  );
  const [kwhStartDate, setKwhStartDate] = useState<string>(getTodayDateStr);
  const [kwhEndDate, setKwhEndDate] = useState<string>(getTodayDateStr);
  const [showPrimarySeries, setShowPrimarySeries] = useState<boolean>(true);
  const [showPrevSeries, setShowPrevSeries] = useState<boolean>(true);
  const [kwhRows, setKwhRows] = useState<ElectricityReportRow[]>([]);
  const [kwhPrevRows, setKwhPrevRows] = useState<ElectricityReportRow[]>([]);
  const [monthlyEquipDaily, setMonthlyEquipDaily] = useState<{
    current: number[];
    previous: number[];
  } | null>(null);
  const [isKwhLoading, setIsKwhLoading] = useState<boolean>(false);

  const monthNames = language === "en" ? MONTH_NAMES_EN : MONTH_NAMES_ID;
  const monthShortNames = language === "en" ? MONTH_SHORT_EN : MONTH_SHORT_ID;

  const kwhRanges: { id: KwhTimeframeRange; label: string }[] = useMemo(
    () => [
      { id: "ytd", label: "YTD" },
      { id: "hour", label: language === "en" ? "Hourly" : "Per Jam" },
      { id: "day", label: language === "en" ? "Daily" : "Per Hari" },
      { id: "month", label: language === "en" ? "Monthly" : "Per Bulan" },
      { id: "custom", label: language === "en" ? "Custom" : "Kustom" }
    ],
    [language]
  );

  const fetchTrend = useCallback(async () => {
    setLoading(true);
    try {
      const q = new URLSearchParams({
        filter: period,
        deviceMode
      });
      if (period === "custom") {
        q.set("start", startDate);
        q.set("end", endDate);
      }
      const res = await getJson<{ success: boolean; data: Warehouse7TrendPayload }>(
        `/warehouse/wh7/trend?${q.toString()}`
      );
      if (res?.data) setTrend(res.data);
    } catch {
      // zero dummy fallback
    } finally {
      setLoading(false);
    }
  }, [period, startDate, endDate, deviceMode]);

  useEffect(() => {
    setShowAllLogs(false);
    fetchTrend();
  }, [fetchTrend]);

  // Fetch WH-7 (PM226) kWh Bar Chart Data + Previous Month Comparison Data according to user-selected timeframe
  const fetchWh7KwhTrend = useCallback(
    async (silent = false) => {
      if (!silent) setIsKwhLoading(true);
      try {
        if (kwhRange === "day") {
          const currMonthStr = `${kwhSelectedYear}-${String(kwhSelectedMonth + 1).padStart(2, "0")}`;
          const compMonthStr = `${kwhCompareYear}-${String(kwhCompareMonth + 1).padStart(2, "0")}`;
          const eqParams = new URLSearchParams({
            machine: "F2 WH-7",
            pmId: "PM226",
            configKey: "pm226",
            currentMonth: currMonthStr,
            comparisonMonth: compMonthStr
          });
          if (silent) {
            eqParams.set("force", "true");
            eqParams.set("_t", String(Date.now()));
          }
          const eqRes = await getJson<{
            currentMonth?: { daily?: number[] };
            comparisonMonth?: { daily?: number[] };
          }>(`/analytics/electricity/equipment-monthly?${eqParams.toString()}`);
          setMonthlyEquipDaily({
            current: eqRes?.currentMonth?.daily || [],
            previous: eqRes?.comparisonMonth?.daily || []
          });
          return;
        }

        let granularity: "hour" | "day" | "month" = "hour";
        let qStart = kwhStartDate || getTodayDateStr();
        let qEnd = kwhEndDate || qStart;
        let prevStart = shiftDateOneMonthBack(qStart);
        let prevEnd = shiftDateOneMonthBack(qEnd);

        if (kwhRange === "hour") {
          granularity = "hour";
          qStart = kwhStartDate || getTodayDateStr();
          qEnd = qStart;
          prevStart = shiftDateOneMonthBack(qStart);
          prevEnd = prevStart;
        } else if (kwhRange === "month" || kwhRange === "ytd") {
          granularity = "month";
          // Include Dec of previous year so Jan has its previous-month comparison
          qStart = `${kwhSelectedYear}-01-01`;
          const curYear = new Date().getFullYear();
          qEnd =
            kwhRange === "ytd" && kwhSelectedYear === curYear
              ? getTodayDateStr()
              : `${kwhSelectedYear}-12-31`;
          prevStart = `${kwhSelectedYear - 1}-12-01`;
          prevEnd = `${kwhSelectedYear}-12-31`;
        } else if (kwhRange === "custom") {
          qStart = kwhStartDate || getTodayDateStr();
          qEnd = kwhEndDate || qStart;
          granularity = qStart === qEnd ? "hour" : "day";
          prevStart = shiftDateOneMonthBack(qStart);
          prevEnd = shiftDateOneMonthBack(qEnd);
        }

        const primaryParams = new URLSearchParams({
          category: "energy",
          factory: "f2",
          tag: "pm226",
          machine: "PM226",
          granularity,
          startDate: qStart,
          endDate: qEnd
        });

        const prevParams = new URLSearchParams({
          category: "energy",
          factory: "f2",
          tag: "pm226",
          machine: "PM226",
          granularity,
          startDate: prevStart,
          endDate: prevEnd
        });

        const [resPrimary, resPrev] = await Promise.all([
          getJson<{ data: ElectricityReportRow[] }>(
            `/analytics/electricity/report?${primaryParams.toString()}`
          ),
          getJson<{ data: ElectricityReportRow[] }>(
            `/analytics/electricity/report?${prevParams.toString()}`
          )
        ]);

        setKwhRows(Array.isArray(resPrimary?.data) ? resPrimary.data : []);
        setKwhPrevRows(Array.isArray(resPrev?.data) ? resPrev.data : []);
      } catch {
        if (!silent) {
          setKwhRows([]);
          setKwhPrevRows([]);
          setMonthlyEquipDaily(null);
        }
      } finally {
        if (!silent) setIsKwhLoading(false);
      }
    },
    [kwhRange, kwhSelectedYear, kwhSelectedMonth, kwhCompareYear, kwhCompareMonth, kwhStartDate, kwhEndDate]
  );

  useEffect(() => {
    fetchWh7KwhTrend(false);

    const socket = getSocket();
    let debounceTimer: ReturnType<typeof setTimeout> | null = null;
    const handleLiveUpdate = () => {
      if (debounceTimer) clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        fetchWh7KwhTrend(true);
      }, 300);
    };

    socket.on("electricity:update", handleLiveUpdate);
    socket.on("historian:minute_update", handleLiveUpdate);
    return () => {
      if (debounceTimer) clearTimeout(debounceTimer);
      socket.off("electricity:update", handleLiveUpdate);
      socket.off("historian:minute_update", handleLiveUpdate);
    };
  }, [fetchWh7KwhTrend]);

  // Build X-axis labels, primary kWh values, and previous-month comparison kWh values
  const {
    kwhBarLabels,
    kwhBarValues,
    kwhPrevBarValues,
    kwhTotal,
    kwhPrevTotal,
    kwhDiffPct,
    primaryDatasetLabel,
    prevDatasetLabel
  } = useMemo(() => {
    const isSingleDayHourly =
      kwhRange === "hour" || (kwhRange === "custom" && kwhStartDate === kwhEndDate);

    if (isSingleDayHourly) {
      const labels = Array.from({ length: 24 }, (_, i) => `${String(i).padStart(2, "0")}:00`);
      const hourMap = new Map<number, number>();
      const prevHourMap = new Map<number, number>();

      for (const r of kwhRows) {
        const m = String(r.date || "").match(/\s(\d{2}):/);
        if (m) {
          const h = parseInt(m[1], 10);
          if (!isNaN(h) && h >= 0 && h <= 23) hourMap.set(h, Math.max(0, Number(r.kwh) || 0));
        }
      }
      for (const r of kwhPrevRows) {
        const m = String(r.date || "").match(/\s(\d{2}):/);
        if (m) {
          const h = parseInt(m[1], 10);
          if (!isNaN(h) && h >= 0 && h <= 23) prevHourMap.set(h, Math.max(0, Number(r.kwh) || 0));
        }
      }

      const values = Array.from({ length: 24 }, (_, h) => hourMap.get(h) ?? 0);
      const prevValues = Array.from({ length: 24 }, (_, h) => prevHourMap.get(h) ?? 0);
      const total = values.reduce((a, b) => a + b, 0);
      const prevTotal = prevValues.reduce((a, b) => a + b, 0);
      const diffPct = prevTotal > 0 ? (((total - prevTotal) / prevTotal) * 100).toFixed(1) : null;
      const prevDateStr = shiftDateOneMonthBack(kwhStartDate);

      return {
        kwhBarLabels: labels,
        kwhBarValues: values,
        kwhPrevBarValues: prevValues,
        kwhTotal: total,
        kwhPrevTotal: prevTotal,
        kwhDiffPct: diffPct,
        primaryDatasetLabel:
          language === "en" ? `Selected Date (${kwhStartDate})` : `Tanggal (${kwhStartDate})`,
        prevDatasetLabel:
          language === "en" ? `Prev Month (${prevDateStr})` : `Bulan Lalu (${prevDateStr})`
      };
    }

    if (kwhRange === "day") {
      const daysInCurr = new Date(kwhSelectedYear, kwhSelectedMonth + 1, 0).getDate();
      const daysInComp = new Date(kwhCompareYear, kwhCompareMonth + 1, 0).getDate();
      const daysCount = Math.max(daysInCurr, daysInComp, 28);
      const labels = Array.from({ length: daysCount }, (_, i) => String(i + 1).padStart(2, "0"));

      const curArr = monthlyEquipDaily?.current || [];
      const prevArr = monthlyEquipDaily?.previous || [];
      const values = Array.from({ length: daysCount }, (_, i) => Math.max(0, Number(curArr[i]) || 0));
      const prevValues = Array.from({ length: daysCount }, (_, i) =>
        Math.max(0, Number(prevArr[i]) || 0)
      );
      const total = values.reduce((a, b) => a + b, 0);
      const prevTotal = prevValues.reduce((a, b) => a + b, 0);
      const diffPct = prevTotal > 0 ? (((total - prevTotal) / prevTotal) * 100).toFixed(1) : null;

      const currMName = `${monthNames[kwhSelectedMonth]} ${kwhSelectedYear}`;
      const prevMName = `${monthNames[kwhCompareMonth]} ${kwhCompareYear}`;

      return {
        kwhBarLabels: labels,
        kwhBarValues: values,
        kwhPrevBarValues: prevValues,
        kwhTotal: total,
        kwhPrevTotal: prevTotal,
        kwhDiffPct: diffPct,
        primaryDatasetLabel:
          language === "en" ? `Primary (${currMName})` : `Bulan Ini (${currMName})`,
        prevDatasetLabel:
          language === "en" ? `Prev Month (${prevMName})` : `Bulan Lalu (${prevMName})`
      };
    }

    if (kwhRange === "custom") {
      const dateList = buildDateRangeList(kwhStartDate, kwhEndDate);
      const dayMap = new Map<string, number>();
      const prevDayMap = new Map<string, number>();
      for (const r of kwhRows) {
        dayMap.set(String(r.date || "").slice(0, 10), Math.max(0, Number(r.kwh) || 0));
      }
      for (const r of kwhPrevRows) {
        prevDayMap.set(String(r.date || "").slice(0, 10), Math.max(0, Number(r.kwh) || 0));
      }
      const labels = dateList.map((d) => {
        const parts = d.split("-");
        return parts.length === 3 ? `${parts[2]}/${parts[1]}` : d;
      });
      const values = dateList.map((d) => dayMap.get(d) ?? 0);
      const prevValues = dateList.map((d) => prevDayMap.get(shiftDateOneMonthBack(d)) ?? 0);
      const total = values.reduce((a, b) => a + b, 0);
      const prevTotal = prevValues.reduce((a, b) => a + b, 0);
      const diffPct = prevTotal > 0 ? (((total - prevTotal) / prevTotal) * 100).toFixed(1) : null;

      return {
        kwhBarLabels: labels,
        kwhBarValues: values,
        kwhPrevBarValues: prevValues,
        kwhTotal: total,
        kwhPrevTotal: prevTotal,
        kwhDiffPct: diffPct,
        primaryDatasetLabel:
          language === "en"
            ? `Selected Range (${kwhStartDate} - ${kwhEndDate})`
            : `Periode Ini (${kwhStartDate} s/d ${kwhEndDate})`,
        prevDatasetLabel:
          language === "en" ? "Same Dates Previous Month" : "Periode Sama Bulan Lalu"
      };
    }

    // "month" or "ytd" — each month is paired with its immediately preceding month (Bulan Sebelumnya)
    const now = new Date();
    const maxMonthCount =
      kwhRange === "ytd" && kwhSelectedYear === now.getFullYear() ? now.getMonth() + 1 : 12;
    const monthMap = new Map<string, number>();
    for (const r of kwhPrevRows) {
      monthMap.set(String(r.date || "").slice(0, 7), Math.max(0, Number(r.kwh) || 0));
    }
    for (const r of kwhRows) {
      monthMap.set(String(r.date || "").slice(0, 7), Math.max(0, Number(r.kwh) || 0));
    }

    const labels = Array.from(
      { length: maxMonthCount },
      (_, idx) => `${monthShortNames[idx]} ${kwhSelectedYear}`
    );
    const values = Array.from({ length: maxMonthCount }, (_, idx) => {
      const mStr = `${kwhSelectedYear}-${String(idx + 1).padStart(2, "0")}`;
      return monthMap.get(mStr) ?? 0;
    });
    const prevValues = Array.from({ length: maxMonthCount }, (_, idx) => {
      const pYear = idx === 0 ? kwhSelectedYear - 1 : kwhSelectedYear;
      const pMon = idx === 0 ? 12 : idx;
      const pStr = `${pYear}-${String(pMon).padStart(2, "0")}`;
      return monthMap.get(pStr) ?? 0;
    });

    const total = values.reduce((a, b) => a + b, 0);
    const prevTotal = prevValues.reduce((a, b) => a + b, 0);
    const diffPct = prevTotal > 0 ? (((total - prevTotal) / prevTotal) * 100).toFixed(1) : null;

    return {
      kwhBarLabels: labels,
      kwhBarValues: values,
      kwhPrevBarValues: prevValues,
      kwhTotal: total,
      kwhPrevTotal: prevTotal,
      kwhDiffPct: diffPct,
      primaryDatasetLabel:
        language === "en" ? `Current Month (${kwhSelectedYear})` : `Bulan Berjalan (${kwhSelectedYear})`,
      prevDatasetLabel:
        language === "en" ? "Previous Month (M-1)" : "Bulan Sebelumnya (M-1)"
    };
  }, [
    kwhRange,
    kwhStartDate,
    kwhEndDate,
    kwhSelectedYear,
    kwhSelectedMonth,
    kwhCompareYear,
    kwhCompareMonth,
    kwhRows,
    kwhPrevRows,
    monthlyEquipDaily,
    monthNames,
    monthShortNames,
    language
  ]);

  const kwhBarData = useMemo(() => {
    const datasets: any[] = [];
    if (showPrimarySeries) {
      datasets.push({
        label: `${primaryDatasetLabel} (kWh)`,
        data: kwhBarValues,
        backgroundColor: "rgba(59, 130, 246, 0.85)",
        hoverBackgroundColor: "rgba(37, 99, 235, 1)",
        borderColor: "rgba(37, 99, 235, 1)",
        borderWidth: 0,
        borderRadius: 4,
        barPercentage: 0.72,
        categoryPercentage: 0.82
      });
    }
    if (showPrevSeries) {
      datasets.push({
        label: `${prevDatasetLabel} (kWh)`,
        data: kwhPrevBarValues,
        backgroundColor: isDark ? "rgba(100, 116, 139, 0.85)" : "rgba(100, 116, 139, 0.78)",
        hoverBackgroundColor: isDark ? "rgba(148, 163, 184, 1)" : "rgba(71, 85, 105, 1)",
        borderColor: isDark ? "rgba(148, 163, 184, 1)" : "rgba(71, 85, 105, 1)",
        borderWidth: 0,
        borderRadius: 4,
        barPercentage: 0.72,
        categoryPercentage: 0.82
      });
    }
    return {
      labels: kwhBarLabels,
      datasets
    };
  }, [
    kwhBarLabels,
    kwhBarValues,
    kwhPrevBarValues,
    showPrimarySeries,
    showPrevSeries,
    primaryDatasetLabel,
    prevDatasetLabel,
    isDark
  ]);

  const kwhBarOptions: any = useMemo(
    () => ({
      responsive: true,
      maintainAspectRatio: false,
      animation: {
        duration: 350,
        easing: "easeOutQuart"
      },
      interaction: {
        mode: "index",
        intersect: false
      },
      plugins: {
        legend: {
          display: true,
          position: "top" as const,
          align: "end" as const,
          labels: {
            color: isDark ? "rgba(148,163,184,.9)" : "rgba(71,85,105,.9)",
            font: { size: 10.5, weight: "600" as const },
            usePointStyle: true,
            pointStyle: "rectRounded",
            padding: 12
          }
        },
        tooltip: {
          mode: "index",
          intersect: false,
          backgroundColor: isDark ? "rgba(15, 23, 42, 0.96)" : "rgba(255, 255, 255, 0.98)",
          titleColor: isDark ? "#38bdf8" : "#0284c7",
          bodyColor: isDark ? "#f1f5f9" : "#0f172a",
          borderColor: isDark ? "rgba(56, 189, 248, 0.35)" : "rgba(14, 165, 233, 0.35)",
          borderWidth: 1.5,
          padding: 12,
          callbacks: {
            label: (ctx: any) => {
              const val = Number(ctx.parsed?.y || 0);
              return `${ctx.dataset.label}: ${formatKwhNum(val)} kWh`;
            },
            afterBody: (items: any[]) => {
              if (!items || items.length === 0 || !showPrevSeries) return [];
              const idx = items[0].dataIndex;
              const curV = Number(kwhBarValues[idx] || 0);
              const prevV = Number(kwhPrevBarValues[idx] || 0);
              if (prevV <= 0) return [];
              const diff = curV - prevV;
              const sign = diff > 0 ? "+" : "";
              const pct = ((diff / prevV) * 100).toFixed(1);
              return [
                language === "en"
                  ? `Diff vs Prev Month: ${sign}${formatKwhNum(diff)} kWh (${sign}${pct}%)`
                  : `Selisih vs Bulan Lalu: ${sign}${formatKwhNum(diff)} kWh (${sign}${pct}%)`
              ];
            }
          }
        }
      },
      scales: {
        x: {
          grid: { display: false },
          ticks: {
            color: isDark ? "rgba(148,163,184,.8)" : "rgba(71,85,105,.8)",
            font: { size: 10 },
            maxRotation: 0,
            autoSkip: true,
            maxTicksLimit: kwhRange === "day" ? 31 : 12
          }
        },
        y: {
          beginAtZero: true,
          grace: "15%",
          grid: {
            color: isDark ? "rgba(51,65,85,.4)" : "rgba(203,213,225,.6)"
          },
          ticks: {
            color: isDark ? "rgba(148,163,184,.8)" : "rgba(71,85,105,.8)",
            font: { size: 10 },
            callback: (v: number) => `${v}`
          }
        }
      }
    }),
    [isDark, showPrevSeries, kwhBarValues, kwhPrevBarValues, kwhRange, language]
  );

  const kwhSubtitle = useMemo(() => {
    if (kwhRange === "hour") {
      return language === "en"
        ? "WH-7 (PM226) electricity energy consumption — hourly historical data."
        : "Konsumsi energi listrik WH-7 (PM226) — data historis per jam.";
    }
    if (kwhRange === "day") {
      return language === "en"
        ? "WH-7 (PM226) electricity energy consumption — daily historical data."
        : "Konsumsi energi listrik WH-7 (PM226) — data historis per hari.";
    }
    if (kwhRange === "custom") {
      return language === "en"
        ? "WH-7 (PM226) electricity energy consumption — custom date range."
        : "Konsumsi energi listrik WH-7 (PM226) — data historis rentang tanggal kustom.";
    }
    return language === "en"
      ? "WH-7 (PM226) electricity energy consumption — monthly historical data."
      : "Konsumsi energi listrik WH-7 (PM226) — data historis per bulan.";
  }, [kwhRange, language]);

  const minTemp = trend?.limits?.minTemp ?? 24;
  const maxTemp = trend?.limits?.maxTemp ?? 30;

  const deviceOptions: Wh7DeviceOption[] = useMemo(() => {
    return (trend?.devices || []).map((d) => ({
      deviceId: d.deviceId,
      label: d.deviceLabel || d.deviceId
    }));
  }, [trend?.devices]);

  const filteredTableRows = useMemo(() => {
    const rows = trend?.hourlyRows || [];
    if (deviceMode === "all" || deviceMode === "highest") return rows;
    return rows.filter((r) => r.deviceId === deviceMode);
  }, [trend?.hourlyRows, deviceMode]);

  const displayedRows = useMemo(() => {
    if (showAllLogs) return filteredTableRows;
    return filteredTableRows.slice(0, INITIAL_LOG_LIMIT);
  }, [filteredTableRows, showAllLogs]);

  const handleExportExcel = () => {
    const rows = filteredTableRows.map((r) => ({
      [t("warehouse7.colTime", "Waktu (WIB)")]: r.label,
      [t("warehouse7.colDevice", "Perangkat")]: r.deviceId,
      [t("warehouse7.colLocation", "Lokasi")]: r.locationLabel,
      [t("warehouse7.colTemp", "Suhu (°C)")]: r.suhu,
      [t("warehouse7.colHumi", "Kelembapan")]: r.humi ?? "-",
      [t("warehouse7.colBattery", "Baterai")]: r.baterai ?? "-",
      [t("warehouse7.colStatus", "Status")]:
        r.suhu > maxTemp
          ? t("warehouse7.statusHigh", "Melebihi Maks")
          : r.suhu < minTemp
            ? t("warehouse7.statusLow", "Di Bawah Min")
            : t("warehouse7.statusNormal", "Normal")
    }));
    const emptyLabel = language === "en" ? "No telemetry data" : "Belum ada data telemetry";
    const ws = utils.json_to_sheet(rows.length > 0 ? rows : [{ Info: emptyLabel }]);
    const wb = utils.book_new();
    utils.book_append_sheet(wb, ws, "Warehouse_7_Trend");
    writeFile(wb, `Warehouse_7_Trend_${period}_${getTodayDateStr()}.xlsx`);
  };

  return (
    <div className="space-y-6">
      {/* Header & Filter Controls matching SCADA UI */}
      <div className="rounded-xl border border-[#acd3ff] dark:border-slate-800 bg-white dark:bg-slate-950 p-5 shadow-sm transition-colors duration-300">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-extrabold text-[#002b5c] dark:text-slate-100">
            {t("warehouse7.trendPageTitle", "Analisis Tren — Gudang 7")}
          </h2>

          <div className="flex flex-wrap items-center gap-2.5">
            <Warehouse7PeriodControls
              period={period}
              onPeriodChange={setPeriod}
              startDate={startDate}
              onStartDateChange={setStartDate}
              endDate={endDate}
              onEndDateChange={setEndDate}
            />
            <Warehouse7DeviceFilterSelect
              deviceMode={deviceMode}
              onDeviceModeChange={setDeviceMode}
              deviceOptions={deviceOptions}
            />
            <button
              type="button"
              onClick={handleExportExcel}
              className="px-4 py-2 rounded-lg bg-[#1f6fb5] hover:bg-[#195a94] text-white text-sm font-bold transition shadow-sm cursor-pointer"
            >
              {t("warehouse7.exportExcel", "Ekspor Excel")}
            </button>
          </div>
        </div>
      </div>

      {/* Statistical KPI Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="rounded-xl border border-[#acd3ff] dark:border-slate-800 bg-white dark:bg-slate-950 p-5 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg hover:border-[#1f6fb5] dark:hover:border-sky-500">
          <div className="text-xs font-bold uppercase tracking-wider text-[#47729f] dark:text-slate-400">
            {t("warehouse7.minTempCard", "SUHU MINIMUM")}
          </div>
          <div className="mt-1.5 text-3xl font-extrabold font-mono text-[#1f6fb5] dark:text-sky-400">
            {trend?.stats?.minTemp !== null && trend?.stats?.minTemp !== undefined
              ? `${trend.stats.minTemp.toFixed(1)} °C`
              : "— °C"}
          </div>
        </div>

        <div className="rounded-xl border border-[#acd3ff] dark:border-slate-800 bg-white dark:bg-slate-950 p-5 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg hover:border-[#1f6fb5] dark:hover:border-sky-500">
          <div className="text-xs font-bold uppercase tracking-wider text-[#47729f] dark:text-slate-400">
            {t("warehouse7.avgTempCard", "SUHU RATA-RATA")}
          </div>
          <div className="mt-1.5 text-3xl font-extrabold font-mono text-[#002b5c] dark:text-slate-100">
            {trend?.stats?.avgTemp !== null && trend?.stats?.avgTemp !== undefined
              ? `${trend.stats.avgTemp.toFixed(1)} °C`
              : "— °C"}
          </div>
        </div>

        <div className="rounded-xl border border-[#acd3ff] dark:border-slate-800 bg-white dark:bg-slate-950 p-5 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg hover:border-[#1f6fb5] dark:hover:border-sky-500">
          <div className="text-xs font-bold uppercase tracking-wider text-[#47729f] dark:text-slate-400">
            {t("warehouse7.maxTempCard", "SUHU MAKSIMUM")}
          </div>
          <div className="mt-1.5 text-3xl font-extrabold font-mono text-rose-600 dark:text-rose-400">
            {trend?.stats?.maxTemp !== null && trend?.stats?.maxTemp !== undefined
              ? `${trend.stats.maxTemp.toFixed(1)} °C`
              : "— °C"}
          </div>
        </div>

        <div className="rounded-xl border border-[#acd3ff] dark:border-slate-800 bg-white dark:bg-slate-950 p-5 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg hover:border-[#1f6fb5] dark:hover:border-sky-500">
          <div className="text-xs font-bold uppercase tracking-wider text-[#47729f] dark:text-slate-400">
            {t("warehouse7.exceedCard", "DI LUAR BATAS")}
          </div>
          <div className="mt-1.5 text-3xl font-extrabold font-mono text-amber-600 dark:text-amber-400">
            {trend?.stats?.exceedCount ?? 0}
          </div>
          <div className="text-xs font-semibold text-[#47729f] dark:text-slate-400 mt-1">
            {trend?.stats?.totalPoints ?? 0} {t("warehouse7.recordsOf", "rekaman")} ({minTemp}–{maxTemp}°C)
          </div>
        </div>
      </div>

      {/* Temperature Trend Line Chart Card */}
      <div className="rounded-xl border border-[#acd3ff] dark:border-slate-800 bg-white dark:bg-slate-950 p-5 shadow-sm transition-colors duration-300">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#acd3ff]/40 dark:border-slate-800 pb-3 mb-4">
          <h3 className="text-base font-extrabold text-[#002b5c] dark:text-slate-100 uppercase tracking-wide">
            {t("warehouse7.chartTitle", "Grafik Tren Suhu")}
          </h3>
          {loading && (
            <span className="text-xs text-[#1f6fb5] dark:text-sky-400 font-bold animate-pulse">
              {t("warehouse7.loadingData", "Memuat data...")}
            </span>
          )}
        </div>
        <Warehouse7LineChart
          trend={trend}
          deviceMode={deviceMode}
          isDark={isDark}
          minTemp={minTemp}
          maxTemp={maxTemp}
          defaultHeightPx={400}
        />
      </div>

      {/* WH-7 (PM226) Multi-Timeframe kWh Bar Chart matching Trend Produksi Solar Panel / Electricity template */}
      <section
        className={`rounded-2xl border border-[#acd3ff] dark:border-slate-800 bg-white dark:bg-slate-950 p-5 shadow-sm flex flex-col justify-between transition-opacity duration-150 ${
          isKwhLoading ? "opacity-80" : "opacity-100"
        }`}
      >
        <div className="flex flex-col gap-3 mb-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="flex flex-wrap items-center gap-2.5">
                <h3 className="text-sm font-bold uppercase tracking-[0.2em] text-[#1f6fb5] dark:text-sky-400">
                  {language === "en"
                    ? "TREND ELECTRICITY CONSUMPTION WH-7 (PM226)"
                    : "TREND KONSUMSI LISTRIK WH-7 (PM226)"}
                </h3>
                <span className="text-xs font-extrabold font-mono text-[#1f6fb5] dark:text-sky-400 bg-sky-500/10 border border-sky-500/20 px-2.5 py-0.5 rounded-lg">
                  Total: {formatKwhNum(kwhTotal)} kWh
                </span>
                {showPrevSeries && (
                  <span className="text-xs font-extrabold font-mono text-amber-600 dark:text-amber-400 bg-amber-500/10 border border-amber-500/20 px-2.5 py-0.5 rounded-lg">
                    {language === "en" ? "Prev Month:" : "Bulan Lalu:"} {formatKwhNum(kwhPrevTotal)} kWh
                  </span>
                )}
                {showPrevSeries && kwhDiffPct !== null && (
                  <span
                    className={`text-[11px] font-bold px-2 py-0.5 rounded-lg border ${
                      Number(kwhDiffPct) > 0
                        ? "bg-rose-500/10 text-rose-500 border-rose-500/20"
                        : "bg-emerald-500/10 text-emerald-500 border-emerald-500/20"
                    }`}
                  >
                    {Number(kwhDiffPct) > 0 ? `+${kwhDiffPct}%` : `${kwhDiffPct}%`}{" "}
                    {language === "en" ? "vs Prev Month" : "vs Bulan Lalu"}
                  </span>
                )}
                {isKwhLoading && (
                  <span className="inline-flex items-center gap-1.5 text-[11px] font-bold text-cyan-600 dark:text-cyan-400 bg-cyan-500/10 border border-cyan-500/20 px-2 py-0.5 rounded-lg animate-pulse">
                    <span className="h-1.5 w-1.5 rounded-full bg-cyan-500 animate-ping" />
                    {language === "en" ? "Loading..." : "Memuat..."}
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">{kwhSubtitle}</p>
            </div>

            {/* Checklist options on Top Right matching Trend Produksi Solar Panel (PLTS) */}
            <div className="flex items-center gap-1.5 bg-slate-50 dark:bg-slate-800/60 p-1 rounded-lg border border-slate-200 dark:border-slate-700 text-xs">
              <label className="flex items-center gap-1.5 px-2 py-1 rounded cursor-pointer select-none font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-200/50 dark:hover:bg-slate-700/50 transition">
                <input
                  type="checkbox"
                  checked={showPrimarySeries}
                  onChange={(e) => {
                    if (!e.target.checked && !showPrevSeries) return;
                    setShowPrimarySeries(e.target.checked);
                  }}
                  className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 h-3.5 w-3.5 cursor-pointer accent-blue-600"
                />
                <span className="flex items-center gap-1">
                  <span className="h-2 w-2 rounded-full bg-blue-500" />
                  {language === "en" ? "Primary Period" : "Periode Utama"}
                </span>
              </label>
              <label className="flex items-center gap-1.5 px-2 py-1 rounded cursor-pointer select-none font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-200/50 dark:hover:bg-slate-700/50 transition">
                <input
                  type="checkbox"
                  checked={showPrevSeries}
                  onChange={(e) => {
                    if (!e.target.checked && !showPrimarySeries) return;
                    setShowPrevSeries(e.target.checked);
                  }}
                  className="rounded border-slate-300 text-slate-600 focus:ring-slate-500 h-3.5 w-3.5 cursor-pointer accent-slate-600"
                />
                <span className="flex items-center gap-1">
                  <span className="h-2 w-2 rounded-full bg-slate-500" />
                  {language === "en" ? "Prev Month" : "Bulan Sebelumnya"}
                </span>
              </label>
            </div>
          </div>

          {/* Filter Row: Date / Month / Year Pickers + [YTD | Per Jam | Per Hari | Per Bulan | Kustom] */}
          <div className="flex flex-wrap items-center justify-start sm:justify-end gap-2">
            {(kwhRange === "ytd" || kwhRange === "day" || kwhRange === "month") && (
              <select
                value={kwhSelectedYear}
                onChange={(e) => {
                  const yr = Number(e.target.value);
                  setKwhSelectedYear(yr);
                  setKwhCompareYear(kwhSelectedMonth === 0 ? yr - 1 : yr);
                }}
                className="rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 px-3 py-1.5 text-xs font-bold text-slate-600 dark:text-slate-300 focus:outline-none focus:ring-2 focus:ring-cyan-500 cursor-pointer transition"
              >
                {AVAILABLE_YEARS.map((yr) => (
                  <option key={yr} value={yr}>
                    {yr}
                  </option>
                ))}
              </select>
            )}

            {kwhRange === "hour" && (
              <input
                type="date"
                value={kwhStartDate}
                onChange={(e) => {
                  setKwhStartDate(e.target.value);
                  setKwhEndDate(e.target.value);
                }}
                className="rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 px-3 py-1.5 text-xs font-bold text-slate-600 dark:text-slate-300 focus:outline-none focus:ring-2 focus:ring-cyan-500 cursor-pointer transition"
              />
            )}

            {kwhRange === "day" && (
              <>
                <select
                  value={kwhSelectedMonth}
                  onChange={(e) => {
                    const mo = Number(e.target.value);
                    setKwhSelectedMonth(mo);
                    setKwhCompareMonth(mo === 0 ? 11 : mo - 1);
                    setKwhCompareYear(mo === 0 ? kwhSelectedYear - 1 : kwhSelectedYear);
                  }}
                  className="rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 px-3 py-1.5 text-xs font-bold text-slate-600 dark:text-slate-300 focus:outline-none focus:ring-2 focus:ring-cyan-500 cursor-pointer transition"
                >
                  {monthNames.map((name, idx) => (
                    <option key={idx} value={idx}>
                      {name}
                    </option>
                  ))}
                </select>

                {showPrevSeries && (
                  <div className="flex items-center gap-1.5 bg-amber-500/10 border border-amber-500/20 px-2.5 py-1 rounded-lg">
                    <span className="text-[11px] font-bold text-amber-600 dark:text-amber-400">vs</span>
                    <select
                      value={kwhCompareMonth}
                      onChange={(e) => setKwhCompareMonth(Number(e.target.value))}
                      className="bg-transparent text-xs font-bold text-amber-700 dark:text-amber-300 cursor-pointer outline-none"
                    >
                      {monthNames.map((name, idx) => (
                        <option key={idx} value={idx} className="bg-white dark:bg-slate-800 text-slate-800 dark:text-white">
                          {name}
                        </option>
                      ))}
                    </select>
                    <select
                      value={kwhCompareYear}
                      onChange={(e) => setKwhCompareYear(Number(e.target.value))}
                      className="bg-transparent text-xs font-bold text-amber-700 dark:text-amber-300 cursor-pointer outline-none border-l border-amber-500/30 pl-1.5"
                    >
                      {AVAILABLE_YEARS.map((yr) => (
                        <option key={yr} value={yr} className="bg-white dark:bg-slate-800 text-slate-800 dark:text-white">
                          {yr}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </>
            )}

            {kwhRange === "custom" && (
              <div className="flex flex-wrap items-center gap-2">
                <input
                  type="date"
                  value={kwhStartDate}
                  onChange={(e) => setKwhStartDate(e.target.value)}
                  className="rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 px-3 py-1.5 text-xs font-bold text-slate-600 dark:text-slate-300 focus:outline-none focus:ring-2 focus:ring-cyan-500 cursor-pointer transition"
                />
                <span className="text-xs font-bold text-slate-400">s/d</span>
                <input
                  type="date"
                  value={kwhEndDate}
                  onChange={(e) => setKwhEndDate(e.target.value)}
                  className="rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 px-3 py-1.5 text-xs font-bold text-slate-600 dark:text-slate-300 focus:outline-none focus:ring-2 focus:ring-cyan-500 cursor-pointer transition"
                />
              </div>
            )}

            <div className="flex items-center gap-1 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 p-0.5 text-xs">
              {kwhRanges.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setKwhRange(item.id)}
                  className={`rounded-md px-3 py-1.5 font-bold transition-all cursor-pointer ${
                    kwhRange === item.id
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

        <div className="bg-slate-50 dark:bg-slate-950/40 rounded-xl p-4 border border-slate-100 dark:border-slate-800/80 flex-1 min-h-[260px] flex flex-col justify-center">
          <div className="h-[260px] w-full">
            <Bar data={kwhBarData} options={kwhBarOptions} />
          </div>
        </div>
      </section>

      {/* Hourly Historian Table with Initial Limit & View All Toggle */}
      <div className="rounded-xl border border-[#acd3ff] dark:border-slate-800 bg-white dark:bg-slate-950 p-5 shadow-sm space-y-4 transition-colors duration-300">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#acd3ff]/40 dark:border-slate-800 pb-3">
          <div>
            <h3 className="text-base font-extrabold text-[#002b5c] dark:text-slate-100 uppercase tracking-wide">
              {t("warehouse7.logTableTitle", "Log Telemetry Per Jam")}
            </h3>
            <p className="text-xs font-semibold text-[#47729f] dark:text-slate-400 mt-0.5">
              {t("warehouse7.showingRows", "Menampilkan")} {displayedRows.length} {t("warehouse7.ofRows", "dari")}{" "}
              {filteredTableRows.length} {t("warehouse7.rowsUnit", "baris")}
            </p>
          </div>

          {filteredTableRows.length > INITIAL_LOG_LIMIT && (
            <button
              type="button"
              onClick={() => setShowAllLogs((prev) => !prev)}
              className="px-4 py-2 rounded-lg border border-[#acd3ff] dark:border-sky-800 bg-[#e8f3ff] dark:bg-sky-950/40 text-[#1f6fb5] dark:text-sky-300 text-sm font-bold hover:bg-[#d8ebff] transition cursor-pointer"
            >
              {showAllLogs
                ? t("warehouse7.showLess", "Tampilkan Sebagian")
                : `${t("warehouse7.viewAll", "View All")} (${filteredTableRows.length})`}
            </button>
          )}
        </div>

        <div className="overflow-x-auto scrollbar-thin">
          <table className="w-full min-w-[700px] text-left text-sm border-collapse">
            <thead>
              <tr className="border-b border-[#acd3ff]/50 dark:border-slate-800 text-xs uppercase tracking-wider text-[#47729f] dark:text-slate-400 font-bold">
                <th className="py-3 px-3">{t("warehouse7.colTime", "Waktu (WIB)")}</th>
                <th className="py-3 px-3">{t("warehouse7.colDevice", "Perangkat")}</th>
                <th className="py-3 px-3">{t("warehouse7.colLocation", "Lokasi")}</th>
                <th className="py-3 px-3">{t("warehouse7.colTemp", "Suhu (°C)")}</th>
                <th className="py-3 px-3">{t("warehouse7.colHumi", "Kelembapan")}</th>
                <th className="py-3 px-3">{t("warehouse7.colBattery", "Baterai")}</th>
                <th className="py-3 px-3">{t("warehouse7.colStatus", "Status")}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/70">
              {displayedRows.length > 0 ? (
                displayedRows.map((row, idx) => {
                  const overMax = row.suhu > maxTemp;
                  const underMin = row.suhu < minTemp;
                  return (
                    <tr key={`${row.deviceId}_${row.t_stamp}_${idx}`} className="hover:bg-slate-50 dark:hover:bg-slate-900/50">
                      <td className="py-3 px-3 font-mono font-medium text-[#002b5c] dark:text-slate-300">{row.label}</td>
                      <td className="py-3 px-3 font-mono font-bold text-[#1f6fb5] dark:text-sky-400">#{row.deviceId}</td>
                      <td className="py-3 px-3 font-medium text-[#002b5c] dark:text-slate-200">{row.locationLabel}</td>
                      <td
                        className={`py-3 px-3 font-mono font-bold ${
                          overMax || underMin ? "text-rose-600 dark:text-rose-400" : "text-[#002b5c] dark:text-slate-100"
                        }`}
                      >
                        {row.suhu.toFixed(1)} °C
                      </td>
                      <td className="py-3 px-3 font-mono text-[#47729f] dark:text-slate-400">
                        {row.humi !== null ? `${row.humi.toFixed(1)}%` : "—"}
                      </td>
                      <td
                        className={`py-3 px-3 font-mono ${
                          row.baterai !== null && row.baterai < 20
                            ? "text-rose-600 dark:text-rose-400 font-extrabold"
                            : "text-[#47729f] dark:text-slate-400"
                        }`}
                      >
                        {row.baterai !== null ? `${row.baterai}%` : "—"}
                      </td>
                      <td className="py-3 px-3">
                        {overMax ? (
                          <span className="px-2.5 py-0.5 rounded bg-rose-500/15 text-rose-700 dark:text-rose-300 font-bold text-xs">
                            {t("warehouse7.critical", "Kritis")} (&gt;{maxTemp}°C)
                          </span>
                        ) : underMin ? (
                          <span className="px-2.5 py-0.5 rounded bg-[#e8f3ff] dark:bg-sky-950/60 text-[#1f6fb5] dark:text-sky-300 font-bold text-xs">
                            {t("warehouse7.critical", "Kritis")} (&lt;{minTemp}°C)
                          </span>
                        ) : (
                          <span className="px-2.5 py-0.5 rounded bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 font-bold text-xs">
                            {t("warehouse7.statusNormal", "Normal")}
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-sm text-[#47729f] dark:text-slate-400">
                    {t("warehouse7.noTableRows", "Belum ada data pada rentang ini.")}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {filteredTableRows.length > INITIAL_LOG_LIMIT && !showAllLogs && (
          <div className="pt-2 flex justify-center">
            <button
              type="button"
              onClick={() => setShowAllLogs(true)}
              className="px-5 py-2 rounded-lg border border-[#acd3ff] dark:border-sky-800 bg-[#f7fbff] dark:bg-slate-900 text-[#1f6fb5] dark:text-sky-300 text-sm font-bold hover:bg-[#e8f3ff] transition cursor-pointer"
            >
              {t("warehouse7.viewAll", "View All")} ({filteredTableRows.length})
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
