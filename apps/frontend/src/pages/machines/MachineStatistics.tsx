import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useOutletContext } from "react-router-dom";
import { Bar, Line } from "react-chartjs-2";
import { getUnitById } from "../../data/machines";
import { useSystemStore } from "../../store/system.store";
import { useTelemetryStore } from "../../store/telemetry.store";
import type { MachineOutletContext } from "./MachineLayout";
import { utils, writeFile } from "xlsx";
import "../../components/charts/chartjs";
import coolingSt3Data from "../../data/cooling_st3_data.json";
import { getJson } from "../../services/api.client";
import { getSocket } from "../../services/socket.service";

// Dedicated Vibration Telemetry Waveform component using Canvas
function VibrationOscilloscope({ equipmentName }: { equipmentName: string }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const theme = useSystemStore((state) => state.theme);
  const isDark = theme === "dark";

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let animationId: number;
    let offset = 0;

    const resizeCanvas = () => {
      const rect = canvas.getBoundingClientRect();
      canvas.width = rect.width * window.devicePixelRatio;
      canvas.height = rect.height * window.devicePixelRatio;
      ctx.scale(window.devicePixelRatio, window.devicePixelRatio);
    };

    resizeCanvas();
    window.addEventListener("resize", resizeCanvas);

    const draw = () => {
      const w = canvas.width / window.devicePixelRatio;
      const h = canvas.height / window.devicePixelRatio;

      ctx.clearRect(0, 0, w, h);

      // Draw background grid lines (dark/light adapted)
      ctx.strokeStyle = isDark ? "rgba(30, 41, 59, 0.5)" : "rgba(203, 213, 225, 0.4)";
      ctx.lineWidth = 1;
      
      const gridSize = 30;
      for (let x = 0; x < w; x += gridSize) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, h);
        ctx.stroke();
      }
      for (let y = 0; y < h; y += gridSize) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(w, y);
        ctx.stroke();
      }

      // Draw baseline center line
      const centerY = h / 2;
      ctx.strokeStyle = isDark ? "rgba(71, 85, 105, 0.8)" : "rgba(148, 163, 184, 0.8)";
      ctx.setLineDash([5, 5]);
      ctx.beginPath();
      ctx.moveTo(0, centerY);
      ctx.lineTo(w, centerY);
      ctx.stroke();
      ctx.setLineDash([]);

      // Draw Critical Threshold Line (> 25.0 mm/s) - top
      const criticalY = centerY - 60;
      ctx.strokeStyle = "rgba(239, 68, 68, 0.7)"; // Red
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(0, criticalY);
      ctx.lineTo(w, criticalY);
      ctx.stroke();

      // Critical Label
      ctx.font = "bold 9px 'IBM Plex Mono', monospace";
      ctx.fillStyle = "rgba(239, 68, 68, 0.9)";
      ctx.fillText("VELOCITY: >25.0 mm/s [CRITICAL]", 10, criticalY - 6);

      // Draw Danger Threshold Line (> 10.0 G) - bottom or middle-top
      const dangerY = centerY + 50;
      ctx.strokeStyle = "rgba(249, 115, 22, 0.7)"; // Orange
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(0, dangerY);
      ctx.lineTo(w, dangerY);
      ctx.stroke();

      // Danger Label
      ctx.fillStyle = "rgba(249, 115, 22, 0.9)";
      ctx.fillText("ACCEL: >10.0 G [DANGER]", 10, dangerY - 6);

      // Draw Waveform Signal (Oscilloscope flat baseline - dummy cleared)
      ctx.strokeStyle = isDark ? "#38bdf8" : "#1f6fb5"; // Sky blue in dark mode, normal blue in light
      ctx.lineWidth = 2;
      ctx.beginPath();

      for (let x = 0; x < w; x++) {
        const y = centerY;

        if (x === 0) {
          ctx.moveTo(x, y);
        } else {
          ctx.lineTo(x, y);
        }
      }
      ctx.stroke();

      animationId = requestAnimationFrame(draw);
    };

    draw();

    return () => {
      window.removeEventListener("resize", resizeCanvas);
      cancelAnimationFrame(animationId);
    };
  }, [equipmentName, isDark]);

  return (
    <div className="relative w-full h-full">
      <canvas ref={canvasRef} className="w-full h-full block rounded-lg bg-slate-950 dark:bg-[#060a13]" />
    </div>
  );
}

const AVAILABLE_YEARS = [2024, 2025, 2026];
const MONTH_NAMES_ID = [
  "Januari", "Februari", "Maret", "April", "Mei", "Juni",
  "Juli", "Agustus", "September", "Oktober", "November", "Desember"
];
const MONTH_NAMES_SHORT = [
  "Jan", "Feb", "Mar", "Apr", "Mei", "Jun",
  "Jul", "Agt", "Sep", "Okt", "Nov", "Des"
];

const timelineRanges = [
  { id: "1h", label: "1 Jam" },
  { id: "hour", label: "Per Jam" },
  { id: "day", label: "Per Hari" },
  { id: "month", label: "Per Bulan" },
  { id: "ytd", label: "YTD" },
  { id: "custom", label: "Kustom" }
] as const;

function computeIntervals(
  range: "1h" | "hour" | "day" | "month" | "ytd" | "custom",
  dateStr: string,
  hour: number,
  month: number,
  year: number,
  customStart: string,
  customEnd: string
) {
  const pad = (n: number) => String(n).padStart(2, "0");

  if (range === "1h") {
    const curFrom = `${dateStr}T${pad(hour)}:00:00.000Z`;
    const curTo = `${dateStr}T${pad(hour)}:59:59.999Z`;

    const curHourDate = new Date(`${dateStr}T${pad(hour)}:00:00Z`);
    const prevHourDate = new Date(curHourDate.getTime() - 3600000);
    const prevDateStr = prevHourDate.toISOString().split("T")[0];
    const prevHour = prevHourDate.getUTCHours();

    const prevFrom = `${prevDateStr}T${pad(prevHour)}:00:00.000Z`;
    const prevTo = `${prevDateStr}T${pad(prevHour)}:59:59.999Z`;

    return {
      current: {
        fromStr: curFrom,
        toStr: curTo,
        resolution: "1m" as const,
        label: `${dateStr} ${pad(hour)}:00 (Saat Ini)`
      },
      previous: {
        fromStr: prevFrom,
        toStr: prevTo,
        resolution: "1m" as const,
        label: `${prevDateStr} ${pad(prevHour)}:00 (1 Jam Sebelumnya)`
      }
    };
  }

  if (range === "hour") {
    const curFrom = `${dateStr}T00:00:00.000Z`;
    const curTo = `${dateStr}T23:59:59.999Z`;

    const curDate = new Date(`${dateStr}T00:00:00Z`);
    const prevDate = new Date(curDate.getTime() - 86400000);
    const prevDateStr = prevDate.toISOString().split("T")[0];

    const prevFrom = `${prevDateStr}T00:00:00.000Z`;
    const prevTo = `${prevDateStr}T23:59:59.999Z`;

    return {
      current: {
        fromStr: curFrom,
        toStr: curTo,
        resolution: "1h" as const,
        label: `${dateStr} (Hari Terpilih)`
      },
      previous: {
        fromStr: prevFrom,
        toStr: prevTo,
        resolution: "1h" as const,
        label: `${prevDateStr} (1 Hari Sebelumnya)`
      }
    };
  }

  if (range === "day") {
    const daysInCurMonth = new Date(year, month + 1, 0).getDate();
    const curFrom = `${year}-${pad(month + 1)}-01T00:00:00.000Z`;
    const curTo = `${year}-${pad(month + 1)}-${pad(daysInCurMonth)}T23:59:59.999Z`;

    const prevM = month === 0 ? 11 : month - 1;
    const prevY = month === 0 ? year - 1 : year;
    const daysInPrevMonth = new Date(prevY, prevM + 1, 0).getDate();

    const prevFrom = `${prevY}-${pad(prevM + 1)}-01T00:00:00.000Z`;
    const prevTo = `${prevY}-${pad(prevM + 1)}-${pad(daysInPrevMonth)}T23:59:59.999Z`;

    return {
      current: {
        fromStr: curFrom,
        toStr: curTo,
        resolution: "1h" as const,
        label: `${MONTH_NAMES_SHORT[month]} ${year} (Bulan Terpilih)`
      },
      previous: {
        fromStr: prevFrom,
        toStr: prevTo,
        resolution: "1h" as const,
        label: `${MONTH_NAMES_SHORT[prevM]} ${prevY} (1 Bulan Sebelumnya)`
      }
    };
  }

  if (range === "month") {
    const curFrom = `${year}-01-01T00:00:00.000Z`;
    const curTo = `${year}-12-31T23:59:59.999Z`;

    const prevFrom = `${year - 1}-01-01T00:00:00.000Z`;
    const prevTo = `${year - 1}-12-31T23:59:59.999Z`;

    return {
      current: {
        fromStr: curFrom,
        toStr: curTo,
        resolution: "1h" as const,
        label: `Tahun ${year} (Tahun Terpilih)`
      },
      previous: {
        fromStr: prevFrom,
        toStr: prevTo,
        resolution: "1h" as const,
        label: `Tahun ${year - 1} (1 Tahun Sebelumnya)`
      }
    };
  }

  if (range === "ytd") {
    const curFrom = `${year}-01-01T00:00:00.000Z`;
    const curTo = `${dateStr}T23:59:59.999Z`;

    const parts = dateStr.split("-");
    const prevDateStr = `${year - 1}-${parts[1]}-${parts[2]}`;
    const prevFrom = `${year - 1}-01-01T00:00:00.000Z`;
    const prevTo = `${prevDateStr}T23:59:59.999Z`;

    return {
      current: {
        fromStr: curFrom,
        toStr: curTo,
        resolution: "1h" as const,
        label: `YTD ${year}`
      },
      previous: {
        fromStr: prevFrom,
        toStr: prevTo,
        resolution: "1h" as const,
        label: `YTD ${year - 1} (Periode Sebelumnya)`
      }
    };
  }

  // Custom
  const cStart = new Date(`${customStart}T00:00:00Z`);
  const cEnd = new Date(`${customEnd}T00:00:00Z`);
  const spanDays = Math.max(1, Math.round((cEnd.getTime() - cStart.getTime()) / 86400000) + 1);
  const pEnd = new Date(cStart.getTime() - 86400000);
  const pStart = new Date(pEnd.getTime() - (spanDays - 1) * 86400000);
  const pStartStr = pStart.toISOString().split("T")[0];
  const pEndStr = pEnd.toISOString().split("T")[0];

  return {
    current: {
      fromStr: `${customStart}T00:00:00.000Z`,
      toStr: `${customEnd}T23:59:59.999Z`,
      resolution: "1h" as const,
      label: `${customStart} s/d ${customEnd}`
    },
    previous: {
      fromStr: `${pStartStr}T00:00:00.000Z`,
      toStr: `${pEndStr}T23:59:59.999Z`,
      resolution: "1h" as const,
      label: `${pStartStr} s/d ${pEndStr} (Periode Sebelumnya)`
    }
  };
}

export default function MachineStatistics() {
  const { unitId } = useOutletContext<MachineOutletContext>();
  const machine = getUnitById(unitId);
  if (!machine) return null;
  const theme = useSystemStore((state) => state.theme);
  const isDark = theme === "dark";
  const latest = useTelemetryStore((state) => state.latest);

  // Vibration selector state
  const [selectedEq, setSelectedEq] = useState("CT-1 Fan");

  // Parameter Trend Selector state
  const [activeParam, setActiveParam] = useState(() =>
    unitId === "cooling-water-1" ? "ST3 Return Temp" : "Supply Water Temp"
  );

  const isCoolingTower = unitId === "cooling-water-1";
  const isHvacRetain = unitId === "hvac-qc-retained-sample" || unitId.includes("retained-sample");
  const isHvac = unitId.startsWith("hvac-") || isHvacRetain;

  // Synchronize parameter default based on machine type
  useEffect(() => {
    if (isCoolingTower) {
      setActiveParam("ST3 Return Temp");
    } else if (isHvacRetain || isHvac) {
      setActiveParam("AHU-01 R. THD-01 Avg Temp");
    } else {
      setActiveParam("Supply Water Temp");
    }
  }, [unitId, isCoolingTower, isHvacRetain, isHvac]);

  const getLocalTodayStr = () => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  };

  // Export Modal states
  const [showExportModal, setShowExportModal] = useState(false);
  const [exportStart, setExportStart] = useState(getLocalTodayStr);
  const [exportEnd, setExportEnd] = useState(getLocalTodayStr);
  const [exportLoading, setExportLoading] = useState(false);
  const [exportType, setExportType] = useState<"parameter" | "vibration">("parameter");
  const [exportScope, setExportScope] = useState<"single" | "multiple">("single");
  const [selectedExportParams, setSelectedExportParams] = useState<string[]>([]);

  // Timeline ranges & comparison state
  const [timelineRange, setTimelineRange] = useState<"1h" | "hour" | "day" | "month" | "ytd" | "custom">("hour");
  const [selectedDate, setSelectedDate] = useState<string>(getLocalTodayStr);
  const [selectedHour, setSelectedHour] = useState<number>(() => new Date().getHours());
  const [selectedMonth, setSelectedMonth] = useState<number>(() => new Date().getMonth());
  const [selectedYear, setSelectedYear] = useState<number>(() => new Date().getFullYear());
  const [customStartDate, setCustomStartDate] = useState<string>(() => {
    const d = new Date();
    d.setDate(d.getDate() - 6);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  });
  const [customEndDate, setCustomEndDate] = useState<string>(getLocalTodayStr);
  const [showComparison, setShowComparison] = useState<boolean>(true);

  // Database-fetched Parameter Data states
  const [currentPoints, setCurrentPoints] = useState<{ ts: string; value: number }[]>([]);
  const [previousPoints, setPreviousPoints] = useState<{ ts: string; value: number }[]>([]);
  const [dbLoading, setDbLoading] = useState(false);

  const paramTagIdMap: Record<string, string> = {
    // Cooling Tower WF1-U3
    "ST3 Return Temp": "cooling-water/st3_return_temp",
    "Supply Water Temp": "cooling-water/supply_temp",
    "Return Water Temp": "cooling-water/return_temp",
    "Supply Water TDS": "cooling-water/tds",
    "Supply Water pH": "cooling-water/ph",
    "Supply Water Flow": "cooling-water/flow",
    "Ambient Temp": "cooling-water/ambient_temp",
    "Ambient Humidity": "cooling-water/humidity",
    "Makeup Water Vol": "cooling-water/makeup_vol",
    "Makeup Water TDS": "cooling-water/makeup_tds",
    "Blowdown Vol": "cooling-water/blowdown_vol",
    "Makeup Water pH": "cooling-water/makeup_ph",

    // HVAC Retained Sample AHU-01
    "AHU-01 R. THD-01 Avg Temp": "hvac/ahu-01/avg_temp",
    "AHU-01 R. THD-01 Avg Humidity": "hvac/ahu-01/avg_humidity",
    "AHU-01 R. THD-01 A Temp": "hvac/ahu-01/temp_a",
    "AHU-01 R. THD-01 A Humidity": "hvac/ahu-01/humidity_a",
    "AHU-01 R. THD-01 B Temp": "hvac/ahu-01/temp_b",
    "AHU-01 R. THD-01 B Humidity": "hvac/ahu-01/humidity_b",
    "AHU-01 R.A. THD-01 Return Air Temp": "hvac/ahu-01/return_air_temp",
    "AHU-01 R.A. THD-01 Return Air Humidity": "hvac/ahu-01/return_air_humidity",
    "AHU-01 SF-01 Fan Speed": "hvac/ahu-01/fan_speed",
    "AHU-01 SF-01 Fan Capacity": "hvac/ahu-01/fan_capacity",
    "AHU-01 SF-01 Fan Current": "hvac/ahu-01/fan_current",
    "AHU-01 EH-01 Heater Capacity": "hvac/ahu-01/heater_capacity",

    // HVAC Retained Sample AHU-02
    "AHU-02 R. THD-02 Avg Temp": "hvac/ahu-02/avg_temp",
    "AHU-02 R. THD-02 Avg Humidity": "hvac/ahu-02/avg_humidity",
    "AHU-02 R. THD-02 A Temp": "hvac/ahu-02/temp_a",
    "AHU-02 R. THD-02 A Humidity": "hvac/ahu-02/humidity_a",
    "AHU-02 R. THD-02 B Temp": "hvac/ahu-02/temp_b",
    "AHU-02 R. THD-02 B Humidity": "hvac/ahu-02/humidity_b",
    "AHU-02 R.A. THD-02 Return Air Temp": "hvac/ahu-02/return_air_temp",
    "AHU-02 R.A. THD-02 Return Air Humidity": "hvac/ahu-02/return_air_humidity",
    "AHU-02 SF-02A Fan Speed": "hvac/ahu-02/fan_speed_a",
    "AHU-02 SF-02B Fan Speed": "hvac/ahu-02/fan_speed_b",
    "AHU-02 SF-02 Fan Capacity": "hvac/ahu-02/fan_capacity",
    "AHU-02 SF-02B Fan Current": "hvac/ahu-02/fan_current",
    "AHU-02 EH-02 Heater Capacity": "hvac/ahu-02/heater_capacity",

    // HVAC Retained Sample AHU-03
    "AHU-03 R. THD-03 Avg Temp": "hvac/ahu-03/avg_temp",
    "AHU-03 R. THD-03 A Temp": "hvac/ahu-03/temp_a",
    "AHU-03 R. THD-03 B Temp": "hvac/ahu-03/temp_b",
  };

  // Fetch function (extracted so it can be called on interval too)
  const fetchTrendData = useCallback(() => {
    const tagId = paramTagIdMap[activeParam];
    if (!tagId) {
      setCurrentPoints([]);
      setPreviousPoints([]);
      return;
    }

    const intervals = computeIntervals(
      timelineRange,
      selectedDate,
      selectedHour,
      selectedMonth,
      selectedYear,
      customStartDate,
      customEndDate
    );

    setDbLoading(true);

    const curParams = new URLSearchParams({
      tagId,
      from: intervals.current.fromStr,
      to: intervals.current.toStr,
      resolution: intervals.current.resolution,
      limit: "15000"
    });

    const prevParams = new URLSearchParams({
      tagId,
      from: intervals.previous.fromStr,
      to: intervals.previous.toStr,
      resolution: intervals.previous.resolution,
      limit: "15000"
    });

    Promise.all([
      getJson<{ data: any[] }>(`/historian/range?${curParams.toString()}`),
      getJson<{ data: any[] }>(`/historian/range?${prevParams.toString()}`)
    ])
      .then(([curRes, prevRes]) => {
        const curMapped = (curRes.data || [])
          .map((pt: any) => ({
            ts: pt.ts,
            value: typeof pt.value === "number" ? pt.value : Number(pt.value)
          }))
          .filter((pt: any) => !isNaN(pt.value));

        const prevMapped = (prevRes.data || [])
          .map((pt: any) => ({
            ts: pt.ts,
            value: typeof pt.value === "number" ? pt.value : Number(pt.value)
          }))
          .filter((pt: any) => !isNaN(pt.value));

        setCurrentPoints(curMapped);
        setPreviousPoints(prevMapped);
      })
      .catch((err) => {
        console.error(`Error fetching historical range for ${activeParam}:`, err);
        setCurrentPoints([]);
        setPreviousPoints([]);
      })
      .finally(() => {
        setDbLoading(false);
      });
  }, [
    activeParam,
    timelineRange,
    selectedDate,
    selectedHour,
    selectedMonth,
    selectedYear,
    customStartDate,
    customEndDate
  ]);

  // Auto-refresh immediately when new minute data arrives in database (data-driven) + fallback polling
  useEffect(() => {
    fetchTrendData();
    const interval = setInterval(fetchTrendData, 30000);

    const socket = getSocket();
    if (socket) {
      const handleMinuteUpdate = () => {
        // When a new minute data point is recorded into the database, immediately refresh the progressive chart!
        fetchTrendData();
      };
      socket.on("historian:minute_update", handleMinuteUpdate);
      socket.on("cooling_tower:minute_update", handleMinuteUpdate);
      socket.on("hvac:minute_update", handleMinuteUpdate);
      return () => {
        clearInterval(interval);
        socket.off("historian:minute_update", handleMinuteUpdate);
        socket.off("cooling_tower:minute_update", handleMinuteUpdate);
        socket.off("hvac:minute_update", handleMinuteUpdate);
      };
    }

    return () => clearInterval(interval);
  }, [fetchTrendData]);

  // 1. Grafik CT Effectiveness (Empty - only loads from DB once configured)
  const ctEffectivenessData = useMemo(() => {
    return {
      labels: [],
      datasets: [
        {
          label: "Jam00",
          data: [],
          borderColor: "#f97316",
          backgroundColor: "#f9731644",
          borderWidth: 2,
          tension: 0.35,
          fill: false,
          pointRadius: 2,
          pointHoverRadius: 5
        },
        {
          label: "Jam12",
          data: [],
          borderColor: "#94a3b8",
          backgroundColor: "#94a3b844",
          borderWidth: 2,
          tension: 0.35,
          fill: false,
          pointRadius: 2,
          pointHoverRadius: 5
        }
      ]
    };
  }, []);

  const ctEffectivenessOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        labels: {
          color: isDark ? "#cbd5e1" : "#47729f",
          font: { family: "Plus Jakarta Sans", size: 11 }
        }
      }
    },
    scales: {
      x: {
        grid: { display: false },
        ticks: { color: isDark ? "#64748b" : "#47729f", font: { size: 9 }, maxTicksLimit: 15 }
      },
      y: {
        grid: { color: isDark ? "rgba(51, 65, 85, 0.3)" : "rgba(203, 213, 225, 0.4)" },
        ticks: { color: isDark ? "#64748b" : "#47729f", font: { size: 9 } },
        min: 50,
        max: 90
      }
    }
  };

  // 2. Daily Volume Makeup & Blowdown (Empty - only loads from DB once configured)
  const dailyVolumeData = useMemo(() => {
    return {
      labels: [],
      datasets: [
        {
          label: "Daily Makeup Volume (m³)",
          data: [],
          backgroundColor: "rgba(56, 189, 248, 0.8)",
          borderWidth: 0,
          borderRadius: 2
        },
        {
          label: "Daily Blowdown Volume (m³)",
          data: [],
          backgroundColor: "rgba(249, 115, 22, 0.8)",
          borderWidth: 0,
          borderRadius: 2
        }
      ]
    };
  }, []);

  const dailyVolumeOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        labels: {
          color: isDark ? "#cbd5e1" : "#47729f",
          font: { family: "Plus Jakarta Sans", size: 11 }
        }
      }
    },
    scales: {
      x: {
        grid: { display: false },
        ticks: { color: isDark ? "#64748b" : "#47729f", font: { size: 9 }, maxTicksLimit: 15 }
      },
      y: {
        grid: { color: isDark ? "rgba(51, 65, 85, 0.3)" : "rgba(203, 213, 225, 0.4)" },
        ticks: { color: isDark ? "#64748b" : "#47729f", font: { size: 9 } }
      }
    }
  };

  const parametersList = useMemo(() => {
    if (isHvacRetain || isHvac) {
      return [
        // AHU-01
        "AHU-01 R. THD-01 Avg Temp",
        "AHU-01 R. THD-01 Avg Humidity",
        "AHU-01 R. THD-01 A Temp",
        "AHU-01 R. THD-01 A Humidity",
        "AHU-01 R. THD-01 B Temp",
        "AHU-01 R. THD-01 B Humidity",
        "AHU-01 R.A. THD-01 Return Air Temp",
        "AHU-01 R.A. THD-01 Return Air Humidity",
        "AHU-01 SF-01 Fan Speed",
        "AHU-01 SF-01 Fan Capacity",
        "AHU-01 SF-01 Fan Current",
        "AHU-01 EH-01 Heater Capacity",

        // AHU-02
        "AHU-02 R. THD-02 Avg Temp",
        "AHU-02 R. THD-02 Avg Humidity",
        "AHU-02 R. THD-02 A Temp",
        "AHU-02 R. THD-02 A Humidity",
        "AHU-02 R. THD-02 B Temp",
        "AHU-02 R. THD-02 B Humidity",
        "AHU-02 R.A. THD-02 Return Air Temp",
        "AHU-02 R.A. THD-02 Return Air Humidity",
        "AHU-02 SF-02A Fan Speed",
        "AHU-02 SF-02B Fan Speed",
        "AHU-02 SF-02 Fan Capacity",
        "AHU-02 SF-02B Fan Current",
        "AHU-02 EH-02 Heater Capacity",

        // AHU-03
        "AHU-03 R. THD-03 Avg Temp",
        "AHU-03 R. THD-03 A Temp",
        "AHU-03 R. THD-03 B Temp"
      ];
    }

    const list = [
      "Supply Water Temp",
      "Supply Water TDS",
      "Supply Water pH",
      "Supply Water Flow",
      "Return Water Temp",
      "Makeup Water Vol",
      "Makeup Water TDS",
      "Ambient Temp",
      "Ambient Humidity",
      "Blowdown Vol",
      "Makeup Water pH"
    ];
    if (unitId === "cooling-water-1") {
      return ["ST3 Return Temp", ...list];
    }
    return list;
  }, [unitId, isHvacRetain, isHvac]);

  const unitMap: Record<string, string> = {
    // Cooling Tower
    "ST3 Return Temp": "°C",
    "ST3 Supply Temp": "°C",
    "Supply Water Temp": "°C",
    "Supply Water TDS": "µS/cm",
    "Supply Water pH": "pH",
    "Supply Water Flow": "m³/h",
    "Return Water Temp": "°C",
    "Makeup Water Vol": "m³",
    "Makeup Water TDS": "µS/cm",
    "Ambient Temp": "°C",
    "Ambient Humidity": "%",
    "Blowdown Vol": "m³",
    "Makeup Water pH": "pH",

    // AHU-01 Units
    "AHU-01 R. THD-01 Avg Temp": "°C",
    "AHU-01 R. THD-01 Avg Humidity": "%RH",
    "AHU-01 R. THD-01 A Temp": "°C",
    "AHU-01 R. THD-01 A Humidity": "%RH",
    "AHU-01 R. THD-01 B Temp": "°C",
    "AHU-01 R. THD-01 B Humidity": "%RH",
    "AHU-01 R.A. THD-01 Return Air Temp": "°C",
    "AHU-01 R.A. THD-01 Return Air Humidity": "%RH",
    "AHU-01 SF-01 Fan Speed": "rpm",
    "AHU-01 SF-01 Fan Capacity": "%",
    "AHU-01 SF-01 Fan Current": "A",
    "AHU-01 EH-01 Heater Capacity": "%",

    // AHU-02 Units
    "AHU-02 R. THD-02 Avg Temp": "°C",
    "AHU-02 R. THD-02 Avg Humidity": "%RH",
    "AHU-02 R. THD-02 A Temp": "°C",
    "AHU-02 R. THD-02 A Humidity": "%RH",
    "AHU-02 R. THD-02 B Temp": "°C",
    "AHU-02 R. THD-02 B Humidity": "%RH",
    "AHU-02 R.A. THD-02 Return Air Temp": "°C",
    "AHU-02 R.A. THD-02 Return Air Humidity": "%RH",
    "AHU-02 SF-02A Fan Speed": "rpm",
    "AHU-02 SF-02B Fan Speed": "rpm",
    "AHU-02 SF-02 Fan Capacity": "%",
    "AHU-02 SF-02B Fan Current": "A",
    "AHU-02 EH-02 Heater Capacity": "%",

    // AHU-03 Units
    "AHU-03 R. THD-03 Avg Temp": "°C",
    "AHU-03 R. THD-03 A Temp": "°C",
    "AHU-03 R. THD-03 B Temp": "°C"
  };

  const aggregatedComparison = useMemo(() => {
    const intervals = computeIntervals(
      timelineRange,
      selectedDate,
      selectedHour,
      selectedMonth,
      selectedYear,
      customStartDate,
      customEndDate
    );

    if (timelineRange === "1h") {
      // 60 minutes: 00 to 59
      const labels: string[] = [];
      const curData: (number | null)[] = [];
      const prevData: (number | null)[] = [];

      for (let m = 0; m < 60; m++) {
        const label = `:${String(m).padStart(2, "0")}`;
        labels.push(label);

        const curMatches = currentPoints.filter(p => new Date(p.ts).getMinutes() === m);
        if (curMatches.length > 0) {
          curData.push(Number((curMatches.reduce((s, p) => s + p.value, 0) / curMatches.length).toFixed(2)));
        } else {
          curData.push(null);
        }

        const prevMatches = previousPoints.filter(p => new Date(p.ts).getMinutes() === m);
        if (prevMatches.length > 0) {
          prevData.push(Number((prevMatches.reduce((s, p) => s + p.value, 0) / prevMatches.length).toFixed(2)));
        } else {
          prevData.push(null);
        }
      }

      return {
        labels,
        current: curData,
        previous: prevData,
        currentLabel: intervals.current.label,
        previousLabel: intervals.previous.label
      };
    }

    if (timelineRange === "hour") {
      // Fixed 24 Hours: 00:00 to 23:00
      const labels: string[] = [];
      const curData: (number | null)[] = [];
      const prevData: (number | null)[] = [];

      for (let h = 0; h < 24; h++) {
        const label = `${String(h).padStart(2, "0")}:00`;
        labels.push(label);

        const curMatches = currentPoints.filter(p => new Date(p.ts).getHours() === h);
        if (curMatches.length > 0) {
          curData.push(Number((curMatches.reduce((s, p) => s + p.value, 0) / curMatches.length).toFixed(2)));
        } else {
          curData.push(null);
        }

        const prevMatches = previousPoints.filter(p => new Date(p.ts).getHours() === h);
        if (prevMatches.length > 0) {
          prevData.push(Number((prevMatches.reduce((s, p) => s + p.value, 0) / prevMatches.length).toFixed(2)));
        } else {
          prevData.push(null);
        }
      }

      return {
        labels,
        current: curData,
        previous: prevData,
        currentLabel: intervals.current.label,
        previousLabel: intervals.previous.label
      };
    }

    if (timelineRange === "day") {
      const numDaysCur = new Date(selectedYear, selectedMonth + 1, 0).getDate();
      const prevM = selectedMonth === 0 ? 11 : selectedMonth - 1;
      const prevY = selectedMonth === 0 ? selectedYear - 1 : selectedYear;
      const numDaysPrev = new Date(prevY, prevM + 1, 0).getDate();
      const maxDays = Math.max(numDaysCur, numDaysPrev);

      const labels: string[] = [];
      const curData: (number | null)[] = [];
      const prevData: (number | null)[] = [];

      for (let d = 1; d <= maxDays; d++) {
        labels.push(`Tgl ${String(d).padStart(2, "0")}`);

        const curMatches = currentPoints.filter(p => {
          const dt = new Date(p.ts);
          return dt.getDate() === d && dt.getMonth() === selectedMonth && dt.getFullYear() === selectedYear;
        });
        if (curMatches.length > 0) {
          curData.push(Number((curMatches.reduce((s, p) => s + p.value, 0) / curMatches.length).toFixed(2)));
        } else {
          curData.push(null);
        }

        const prevMatches = previousPoints.filter(p => {
          const dt = new Date(p.ts);
          return dt.getDate() === d && dt.getMonth() === prevM && dt.getFullYear() === prevY;
        });
        if (prevMatches.length > 0) {
          prevData.push(Number((prevMatches.reduce((s, p) => s + p.value, 0) / prevMatches.length).toFixed(2)));
        } else {
          prevData.push(null);
        }
      }

      return {
        labels,
        current: curData,
        previous: prevData,
        currentLabel: intervals.current.label,
        previousLabel: intervals.previous.label
      };
    }

    if (timelineRange === "month" || timelineRange === "ytd") {
      const maxM = timelineRange === "ytd" ? (selectedYear === new Date().getFullYear() ? new Date().getMonth() + 1 : 12) : 12;
      const labels: string[] = [];
      const curData: (number | null)[] = [];
      const prevData: (number | null)[] = [];

      for (let m = 0; m < maxM; m++) {
        labels.push(MONTH_NAMES_SHORT[m]);

        const curMatches = currentPoints.filter(p => {
          const dt = new Date(p.ts);
          return dt.getMonth() === m && dt.getFullYear() === selectedYear;
        });
        if (curMatches.length > 0) {
          curData.push(Number((curMatches.reduce((s, p) => s + p.value, 0) / curMatches.length).toFixed(2)));
        } else {
          curData.push(null);
        }

        const prevMatches = previousPoints.filter(p => {
          const dt = new Date(p.ts);
          return dt.getMonth() === m && dt.getFullYear() === selectedYear - 1;
        });
        if (prevMatches.length > 0) {
          prevData.push(Number((prevMatches.reduce((s, p) => s + p.value, 0) / prevMatches.length).toFixed(2)));
        } else {
          prevData.push(null);
        }
      }

      return {
        labels,
        current: curData,
        previous: prevData,
        currentLabel: intervals.current.label,
        previousLabel: intervals.previous.label
      };
    }

    // Custom
    const cStart = new Date(`${customStartDate}T00:00:00Z`);
    const cEnd = new Date(`${customEndDate}T00:00:00Z`);
    const count = Math.max(1, Math.round((cEnd.getTime() - cStart.getTime()) / 86400000) + 1);

    if (count <= 2) {
      const totalHours = count * 24;
      const labels: string[] = [];
      const curData: (number | null)[] = [];
      const prevData: (number | null)[] = [];

      for (let i = 0; i < totalHours; i++) {
        const curHourTime = new Date(cStart.getTime() + i * 3600000);
        labels.push(`${String(curHourTime.getHours()).padStart(2, "0")}:00`);

        const curMatches = currentPoints.filter(p => {
          const dt = new Date(p.ts);
          return Math.abs(dt.getTime() - curHourTime.getTime()) < 1800000;
        });
        curData.push(curMatches.length > 0 ? Number((curMatches.reduce((s, p) => s + p.value, 0) / curMatches.length).toFixed(2)) : null);

        const prevHourTime = new Date(curHourTime.getTime() - count * 86400000);
        const prevMatches = previousPoints.filter(p => {
          const dt = new Date(p.ts);
          return Math.abs(dt.getTime() - prevHourTime.getTime()) < 1800000;
        });
        prevData.push(prevMatches.length > 0 ? Number((prevMatches.reduce((s, p) => s + p.value, 0) / prevMatches.length).toFixed(2)) : null);
      }

      return {
        labels,
        current: curData,
        previous: prevData,
        currentLabel: intervals.current.label,
        previousLabel: intervals.previous.label
      };
    } else {
      const labels: string[] = [];
      const curData: (number | null)[] = [];
      const prevData: (number | null)[] = [];

      for (let i = 0; i < count; i++) {
        const curDayTime = new Date(cStart.getTime() + i * 86400000);
        const curDayStr = `${curDayTime.getDate()}/${curDayTime.getMonth() + 1}`;
        labels.push(count <= 14 ? `Hari ${i + 1} (${curDayStr})` : `H-${i + 1}`);

        const curMatches = currentPoints.filter(p => {
          const dt = new Date(p.ts);
          return dt.getDate() === curDayTime.getDate() && dt.getMonth() === curDayTime.getMonth() && dt.getFullYear() === curDayTime.getFullYear();
        });
        curData.push(curMatches.length > 0 ? Number((curMatches.reduce((s, p) => s + p.value, 0) / curMatches.length).toFixed(2)) : null);

        const prevDayTime = new Date(curDayTime.getTime() - count * 86400000);
        const prevMatches = previousPoints.filter(p => {
          const dt = new Date(p.ts);
          return dt.getDate() === prevDayTime.getDate() && dt.getMonth() === prevDayTime.getMonth() && dt.getFullYear() === prevDayTime.getFullYear();
        });
        prevData.push(prevMatches.length > 0 ? Number((prevMatches.reduce((s, p) => s + p.value, 0) / prevMatches.length).toFixed(2)) : null);
      }

      return {
        labels,
        current: curData,
        previous: prevData,
        currentLabel: intervals.current.label,
        previousLabel: intervals.previous.label
      };
    }
  }, [
    timelineRange,
    selectedDate,
    selectedHour,
    selectedMonth,
    selectedYear,
    customStartDate,
    customEndDate,
    currentPoints,
    previousPoints
  ]);

  const stats = useMemo(() => {
    const curValid = aggregatedComparison.current.filter((v): v is number => typeof v === "number");
    const prevValid = aggregatedComparison.previous.filter((v): v is number => typeof v === "number");

    const curAvg = curValid.length > 0 ? Number((curValid.reduce((a, b) => a + b, 0) / curValid.length).toFixed(2)) : null;
    const prevAvg = prevValid.length > 0 ? Number((prevValid.reduce((a, b) => a + b, 0) / prevValid.length).toFixed(2)) : null;

    const diff = (curAvg !== null && prevAvg !== null) ? Number((curAvg - prevAvg).toFixed(2)) : null;
    const diffPct = (curAvg !== null && prevAvg !== null && prevAvg !== 0) ? Number(((diff! / prevAvg) * 100).toFixed(1)) : null;

    return { curAvg, prevAvg, diff, diffPct };
  }, [aggregatedComparison]);

  // 3. Comparison Line Chart datasets
  const parameterTrendData = useMemo(() => {
    const unit = unitMap[activeParam] ?? "";
    const datasets: any[] = [
      {
        label: `${aggregatedComparison.currentLabel} (${unit})`,
        data: aggregatedComparison.current,
        borderColor: "#1f6fb5", // Brand Blue
        backgroundColor: "rgba(31, 111, 181, 0.12)",
        borderWidth: 2.5,
        tension: 0.3,
        fill: true,
        spanGaps: true,
        pointRadius: 2.5,
        pointBackgroundColor: "#1f6fb5",
        pointBorderColor: "#ffffff",
        pointBorderWidth: 1.5,
        pointHoverRadius: 7,
        pointHoverBackgroundColor: "#1f6fb5",
        pointHoverBorderColor: "#ffffff",
        pointHoverBorderWidth: 2,
        pointHitRadius: 15
      }
    ];

    if (showComparison) {
      datasets.push({
        label: `${aggregatedComparison.previousLabel} (${unit})`,
        data: aggregatedComparison.previous,
        borderColor: "#f59e0b", // Amber/Orange for previous period
        backgroundColor: "rgba(245, 158, 11, 0.05)",
        borderWidth: 2,
        borderDash: [5, 4], // Dashed line to separate from current line
        tension: 0.3,
        fill: false,
        spanGaps: true,
        pointRadius: 2,
        pointBackgroundColor: "#f59e0b",
        pointBorderColor: "#ffffff",
        pointBorderWidth: 1.5,
        pointHoverRadius: 7,
        pointHoverBackgroundColor: "#f59e0b",
        pointHoverBorderColor: "#ffffff",
        pointHoverBorderWidth: 2,
        pointHitRadius: 15
      });
    }

    return {
      chartData: {
        labels: aggregatedComparison.labels,
        datasets
      },
      unit
    };
  }, [activeParam, aggregatedComparison, showComparison, unitMap]);

  const parameterTrendOptions = {
    responsive: true,
    maintainAspectRatio: false,
    interaction: {
      mode: "index" as const,
      intersect: false
    },
    plugins: {
      legend: {
        display: true,
        position: "top" as const,
        align: "end" as const,
        labels: {
          color: isDark ? "#cbd5e1" : "#47729f",
          font: { family: "Plus Jakarta Sans", size: 10, weight: "bold" as const },
          usePointStyle: true,
          boxWidth: 7,
          boxHeight: 7
        }
      },
      tooltip: {
        callbacks: {
          label: (ctx: any) => {
            const val = ctx.parsed.y;
            const unit = unitMap[activeParam] ? ` ${unitMap[activeParam]}` : "";
            if (val === null || val === undefined) return ` ${ctx.dataset.label}: —`;
            return ` ${ctx.dataset.label}: ${val}${unit}`;
          },
          afterBody: (items: any[]) => {
            if (items.length >= 2) {
              const cur = items[0]?.parsed?.y;
              const prev = items[1]?.parsed?.y;
              if (typeof cur === "number" && typeof prev === "number") {
                const diff = Number((cur - prev).toFixed(2));
                const sign = diff > 0 ? "+" : "";
                const unit = unitMap[activeParam] ? ` ${unitMap[activeParam]}` : "";
                return `\nSelisih: ${sign}${diff}${unit}`;
              }
            }
            return "";
          }
        }
      }
    },
    scales: {
      x: {
        grid: { display: false },
        ticks: { color: isDark ? "#64748b" : "#47729f", font: { size: 9 }, maxTicksLimit: 14 }
      },
      y: {
        grid: { color: isDark ? "rgba(51, 65, 85, 0.3)" : "rgba(203, 213, 225, 0.4)" },
        ticks: { color: isDark ? "#64748b" : "#47729f", font: { size: 9 } }
      }
    }
  };

  const handleExportParameters = () => {
    const intervals = computeIntervals(
      timelineRange,
      selectedDate,
      selectedHour,
      selectedMonth,
      selectedYear,
      customStartDate,
      customEndDate
    );
    const startStr = intervals.current.fromStr.split("T")[0];
    const endStr = intervals.current.toStr.split("T")[0];

    setExportType("parameter");
    setExportScope("single");
    setSelectedExportParams([...parametersList]);
    setExportStart(startStr);
    setExportEnd(endStr);
    setShowExportModal(true);
  };

  const handleExportVibration = () => {
    setExportType("vibration");
    setExportStart(getLocalTodayStr());
    setExportEnd(getLocalTodayStr());
    setShowExportModal(true);
  };

  const toggleParamSelection = (param: string) => {
    setSelectedExportParams((prev) =>
      prev.includes(param) ? prev.filter((p) => p !== param) : [...prev, param]
    );
  };

  const handleSelectAllParams = () => {
    if (selectedExportParams.length === parametersList.length) {
      setSelectedExportParams([]);
    } else {
      setSelectedExportParams([...parametersList]);
    }
  };

  const executeExport = async () => {
    if (exportType === "parameter") {
      const targets = exportScope === "single" ? [activeParam] : selectedExportParams;
      if (targets.length === 0) {
        alert("Pilih minimal satu parameter untuk di-export.");
        return;
      }

      setExportLoading(true);

      const fromStr = `${exportStart}T00:00:00.000Z`;
      const toStr = `${exportEnd}T23:59:59.999Z`;

      try {
        // Fetch all target parameters concurrently
        const fetchPromises = targets.map(async (param) => {
          const tagId = paramTagIdMap[param];
          if (!tagId) return { param, points: [] };

          const params = new URLSearchParams({
            tagId,
            from: fromStr,
            to: toStr,
            resolution: "1h",
            limit: "50000"
          });

          try {
            const res = await getJson<{ data: any[] }>(`/historian/range?${params.toString()}`);
            return { param, points: res.data || [] };
          } catch (e) {
            console.error(`Failed to fetch range for ${param}:`, e);
            return { param, points: [] };
          }
        });

        const results = await Promise.all(fetchPromises);

        // Group by Timestamp string (YYYY-MM-DD HH:mm)
        const rowMap = new Map<string, Record<string, any>>();

        results.forEach(({ param, points }) => {
          const unit = unitMap[param] ? ` (${unitMap[param]})` : "";
          const colName = `${param}${unit}`;

          points.forEach((pt: any) => {
            const dateObj = new Date(pt.ts);
            const formattedDate = `${dateObj.getFullYear()}-${String(dateObj.getMonth() + 1).padStart(2, "0")}-${String(dateObj.getDate()).padStart(2, "0")} ${String(dateObj.getHours()).padStart(2, "0")}:${String(dateObj.getMinutes()).padStart(2, "0")}`;

            if (!rowMap.has(formattedDate)) {
              rowMap.set(formattedDate, {
                "Timestamp": formattedDate
              });
            }

            const row = rowMap.get(formattedDate)!;
            row[colName] = typeof pt.value === "number" ? Number(pt.value.toFixed(2)) : pt.value;
          });
        });

        // Convert map to sorted array by timestamp ASC
        const rows = Array.from(rowMap.entries())
          .sort(([a], [b]) => a.localeCompare(b))
          .map(([, r]) => r);

        if (rows.length === 0) {
          const fallbackRow: Record<string, any> = { "Timestamp": "No Data in Selected Range" };
          targets.forEach(p => {
            const unit = unitMap[p] ? ` (${unitMap[p]})` : "";
            fallbackRow[`${p}${unit}`] = "-";
          });
          rows.push(fallbackRow);
        }

        const worksheet = utils.json_to_sheet(rows);
        const workbook = utils.book_new();
        const sheetTitle = targets.length === 1 ? targets[0].slice(0, 30) : "Parameters History";
        utils.book_append_sheet(workbook, worksheet, sheetTitle);

        const fileName = targets.length === 1
          ? `${targets[0].toLowerCase().replace(/\s+/g, "-")}-${exportStart}-to-${exportEnd}.xlsx`
          : `${unitId}-parameters-${exportStart}-to-${exportEnd}.xlsx`;

        writeFile(workbook, fileName);
        setShowExportModal(false);
      } catch (err) {
        console.error("Export failed:", err);
        alert("Gagal mengunduh data. Silakan coba lagi.");
      } finally {
        setExportLoading(false);
      }
    } else {
      setExportLoading(true);
      const startD = new Date(exportStart);
      const endD = new Date(exportEnd);
      const rows = [];
      
      let currentD = new Date(startD);
      let limitDays = 0;
      while (currentD <= endD && limitDays < 31) {
        const dateStr = `${currentD.getFullYear()}-${String(currentD.getMonth() + 1).padStart(2, "0")}-${String(currentD.getDate()).padStart(2, "0")}`;
        
        for (let h = 0; h < 24; h++) {
          const timeLabel = `${String(h).padStart(2, "0")}:00`;
          
          rows.push({
            "Date": dateStr,
            "Hour": timeLabel,
            "Equipment": selectedEq,
            "Vibration Velocity (mm/s)": 0,
            "Vibration Acceleration (G)": 0
          });
        }
        
        currentD.setDate(currentD.getDate() + 1);
        limitDays++;
      }

      const worksheet = utils.json_to_sheet(rows);
      const workbook = utils.book_new();
      utils.book_append_sheet(workbook, worksheet, "Vibration History");
      writeFile(workbook, `vibration-${selectedEq.toLowerCase().replace(/\s+/g, "-")}-${exportStart}-to-${exportEnd}.xlsx`);
      setExportLoading(false);
      setShowExportModal(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Page description */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[#acd3ff] dark:border-slate-800 bg-[#f7fbff]/80 dark:bg-slate-950/70 p-4 transition-colors duration-300 backdrop-blur-md">
        <div>
          <div className="text-xs uppercase tracking-[0.2em] text-[#47729f] dark:text-slate-500 font-bold">
            Trend & Diagnostic Analysis
          </div>
          <div className="mt-1 text-sm text-[#002b5c] dark:text-slate-300 font-medium">
            Diagnostic analytics dashboard for {machine.name}. Review efficiency trends, vibration waveforms, and daily volumes.
          </div>
        </div>
      </div>

      {/* 1. Grafik CT Effectiveness Chart Card (Cooling Tower only) */}
      {isCoolingTower && (
        <div className="bg-white dark:bg-slate-950 border border-[#acd3ff] dark:border-slate-800 rounded-xl p-5 shadow-sm transition-colors duration-300">
          <div className="mb-4 flex items-center justify-between border-b border-[#acd3ff]/30 pb-2.5">
            <h3 className="text-sm font-bold text-[#002b5c] dark:text-slate-100 uppercase tracking-wide">
              Grafik CT Effectiveness
            </h3>
            <span className="text-[10px] bg-sky-500/10 text-sky-500 px-2 py-0.5 rounded font-bold uppercase">
              30 Day Timeline
            </span>
          </div>
          <div className="h-64 min-h-0">
            <Line data={ctEffectivenessData} options={ctEffectivenessOptions} />
          </div>
        </div>
      )}

      {/* 2. Interactive Parameter Selector Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        <div className="lg:col-span-3 bg-white dark:bg-slate-950 border border-[#acd3ff] dark:border-slate-800 rounded-xl p-5 shadow-sm transition-colors duration-300">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3 border-b border-[#acd3ff]/30 pb-3">
            <div className="flex flex-col">
              <div className="flex items-center gap-2.5">
                <h3 className="text-sm font-bold text-[#002b5c] dark:text-slate-100 uppercase tracking-wide">
                  Historical Parameters Detail
                </h3>
                <span className="text-xs text-[#1f6fb5] font-bold bg-[#1f6fb5]/10 px-2.5 py-0.5 rounded-full">
                  {activeParam}
                </span>
                {dbLoading && (
                  <span className="text-xs text-[#1f6fb5] font-bold animate-pulse" title="Memuat data historis...">
                    ⏳
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">
                Perbandingan tren parameter dengan periode sebelumnya ({timelineRanges.find(r => r.id === timelineRange)?.label}).
              </p>
            </div>

            <div className="flex flex-wrap items-center justify-end gap-2 ml-auto">
              {/* Dynamic Range Selectors matching Electricity */}
              {timelineRange === "1h" && (
                <div className="flex items-center gap-1.5">
                  <input
                    type="date"
                    value={selectedDate}
                    onChange={(e) => setSelectedDate(e.target.value)}
                    className="rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 px-2.5 py-1 text-xs font-bold text-slate-600 dark:text-slate-300 focus:outline-none focus:ring-2 focus:ring-[#1f6fb5] cursor-pointer transition"
                  />
                  <select
                    value={selectedHour}
                    onChange={(e) => setSelectedHour(Number(e.target.value))}
                    className="rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 px-2 py-1 text-xs font-bold text-slate-600 dark:text-slate-300 focus:outline-none focus:ring-2 focus:ring-[#1f6fb5] cursor-pointer transition"
                  >
                    {Array.from({ length: 24 }, (_, i) => (
                      <option key={i} value={i}>
                        {String(i).padStart(2, "0")}:00
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {timelineRange === "hour" && (
                <input
                  type="date"
                  value={selectedDate}
                  onChange={(e) => setSelectedDate(e.target.value)}
                  className="rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 px-2.5 py-1 text-xs font-bold text-slate-600 dark:text-slate-300 focus:outline-none focus:ring-2 focus:ring-[#1f6fb5] cursor-pointer transition"
                />
              )}

              {(timelineRange === "day" || timelineRange === "month" || timelineRange === "ytd") && (
                <select
                  value={selectedYear}
                  onChange={(e) => setSelectedYear(Number(e.target.value))}
                  className="rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 px-2.5 py-1 text-xs font-bold text-slate-600 dark:text-slate-300 focus:outline-none focus:ring-2 focus:ring-[#1f6fb5] cursor-pointer transition"
                >
                  {AVAILABLE_YEARS.map((yr) => (
                    <option key={yr} value={yr}>{yr}</option>
                  ))}
                </select>
              )}

              {timelineRange === "day" && (
                <select
                  value={selectedMonth}
                  onChange={(e) => setSelectedMonth(Number(e.target.value))}
                  className="rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 px-2.5 py-1 text-xs font-bold text-slate-600 dark:text-slate-300 focus:outline-none focus:ring-2 focus:ring-[#1f6fb5] cursor-pointer transition"
                >
                  {MONTH_NAMES_ID.map((name, idx) => (
                    <option key={idx} value={idx}>{name}</option>
                  ))}
                </select>
              )}

              {timelineRange === "custom" && (
                <div className="flex items-center gap-1.5">
                  <input
                    type="date"
                    value={customStartDate}
                    onChange={(e) => setCustomStartDate(e.target.value)}
                    className="rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 px-2 py-1 text-xs font-bold text-slate-600 dark:text-slate-300 focus:outline-none focus:ring-2 focus:ring-[#1f6fb5] cursor-pointer transition"
                  />
                  <span className="text-xs font-bold text-slate-400">s/d</span>
                  <input
                    type="date"
                    value={customEndDate}
                    onChange={(e) => setCustomEndDate(e.target.value)}
                    className="rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 px-2 py-1 text-xs font-bold text-slate-600 dark:text-slate-300 focus:outline-none focus:ring-2 focus:ring-[#1f6fb5] cursor-pointer transition"
                  />
                </div>
              )}

              {/* Timeline selector pills */}
              <div className="flex items-center gap-0.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 p-0.5 text-xs">
                {timelineRanges.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setTimelineRange(item.id)}
                    className={`rounded-md px-2.5 py-1 font-bold transition-all ${
                      timelineRange === item.id
                        ? "bg-[#1f6fb5] text-white shadow-sm"
                        : "text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
                    }`}
                  >
                    {item.label}
                  </button>
                ))}
              </div>

              {/* Toggle comparison button */}
              <button
                type="button"
                onClick={() => setShowComparison(prev => !prev)}
                title="Bandingkan dengan periode sebelumnya"
                className={`rounded-lg border px-2.5 py-1 text-xs font-bold transition flex items-center gap-1.5 ${
                  showComparison
                    ? "border-amber-400/40 bg-amber-500/10 text-amber-600 dark:text-amber-400 shadow-sm"
                    : "border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-slate-400"
                }`}
              >
                <span>{showComparison ? "✓" : "○"}</span>
                <span>Periode Sebelumnya</span>
              </button>

              <button
                type="button"
                onClick={handleExportParameters}
                className="rounded-lg border border-[#acd3ff] dark:border-slate-700 bg-[#f7fbff]/50 dark:bg-slate-900 px-3 py-1 text-xs font-bold text-[#002b5c] dark:text-slate-300 transition hover:bg-slate-50 dark:hover:bg-slate-800/80"
              >
                📥 Export Excel
              </button>
            </div>
          </div>

          {/* Quick comparison metric stats */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-3 p-2.5 rounded-lg bg-slate-50/70 dark:bg-slate-900/60 border border-slate-100 dark:border-slate-800/60 text-xs">
            <div>
              <div className="text-[10px] text-slate-400 dark:text-slate-500 font-bold uppercase tracking-wider">
                Rata-rata Terpilih
              </div>
              <div className="text-sm font-extrabold text-[#1f6fb5] mt-0.5">
                {stats.curAvg !== null ? `${stats.curAvg} ${unitMap[activeParam] || ""}` : "—"}
              </div>
            </div>
            {showComparison && (
              <>
                <div>
                  <div className="text-[10px] text-slate-400 dark:text-slate-500 font-bold uppercase tracking-wider">
                    Periode Sebelumnya
                  </div>
                  <div className="text-sm font-extrabold text-amber-500 mt-0.5">
                    {stats.prevAvg !== null ? `${stats.prevAvg} ${unitMap[activeParam] || ""}` : "—"}
                  </div>
                </div>
                <div>
                  <div className="text-[10px] text-slate-400 dark:text-slate-500 font-bold uppercase tracking-wider">
                    Selisih Rata-rata
                  </div>
                  <div className={`text-sm font-extrabold mt-0.5 ${stats.diff === null ? "text-slate-400" : stats.diff > 0 ? "text-rose-500" : stats.diff < 0 ? "text-emerald-500" : "text-slate-500"}`}>
                    {stats.diff !== null ? `${stats.diff > 0 ? "+" : ""}${stats.diff} ${unitMap[activeParam] || ""}` : "—"}
                  </div>
                </div>
                <div>
                  <div className="text-[10px] text-slate-400 dark:text-slate-500 font-bold uppercase tracking-wider">
                    Perubahan
                  </div>
                  <div className={`text-sm font-extrabold mt-0.5 ${stats.diffPct === null ? "text-slate-400" : stats.diffPct > 0 ? "text-rose-500" : stats.diffPct < 0 ? "text-emerald-500" : "text-slate-500"}`}>
                    {stats.diffPct !== null ? `${stats.diffPct > 0 ? "+" : ""}${stats.diffPct}%` : "—"}
                  </div>
                </div>
              </>
            )}
          </div>

          <div className={isCoolingTower ? "h-64 min-h-0" : "h-[420px] min-h-0"}>
            <Line data={parameterTrendData.chartData} options={parameterTrendOptions} />
          </div>
        </div>

        {/* Right selection panel */}
        <div className="bg-white dark:bg-slate-950 border border-[#acd3ff] dark:border-slate-800 rounded-xl p-4 shadow-sm transition-colors duration-300 flex flex-col justify-between">
          <div>
            <h4 className="text-xs font-bold uppercase tracking-wider text-[#47729f] dark:text-slate-500 mb-3 border-b border-slate-100 dark:border-slate-900 pb-2">
              Select Trend Parameter
            </h4>
            <div className={`space-y-1.5 overflow-y-auto pr-1 ${isCoolingTower ? "max-h-[260px]" : "max-h-[440px]"}`}>
              {parametersList.map((param) => (
                <button
                  key={param}
                  onClick={() => setActiveParam(param)}
                  className={`w-full text-left px-3 py-2 text-xs font-semibold rounded-lg transition duration-200 border flex items-center justify-between ${
                    activeParam === param
                      ? "bg-[#1f6fb5] text-white border-transparent shadow-md shadow-[#1f6fb5]/20"
                      : "text-[#002b5c] dark:text-slate-300 border-slate-100 dark:border-slate-900 bg-slate-50/50 dark:bg-slate-900/40 hover:bg-[#1f6fb5]/10 dark:hover:bg-[#1f6fb5]/20"
                  }`}
                >
                  <span className="truncate pr-1">{param}</span>
                  {unitMap[param] && (
                    <span
                      className={`text-[10px] ml-1 px-1.5 py-0.5 rounded font-mono font-bold shrink-0 ${
                        activeParam === param
                          ? "bg-white/20 text-white"
                          : "bg-slate-200/60 dark:bg-slate-800 text-slate-500 dark:text-slate-400"
                      }`}
                    >
                      {unitMap[param]}
                    </span>
                  )}
                </button>
              ))}
            </div>
          </div>
          <p className="text-[10px] text-slate-400 dark:text-slate-600 mt-2 italic">
            Select a parameter to view the historical trend.
          </p>
        </div>
      </div>

      {/* 3. Vibration Waveform Telemetry (Oscilloscope) Card (Cooling Tower only) */}
      {isCoolingTower && (
        <div className="bg-white dark:bg-slate-950 border border-[#acd3ff] dark:border-slate-800 rounded-xl p-5 shadow-sm transition-colors duration-300">
          <div className="mb-4 flex flex-wrap items-center justify-between border-b border-[#acd3ff]/30 pb-3 gap-3">
            <div className="space-y-1">
              <h3 className="text-sm font-bold text-[#002b5c] dark:text-slate-100 uppercase tracking-wide">
                Vibration Telemetry Waveform Analysis
              </h3>
              <p className="text-xs text-slate-400 dark:text-slate-500">
                Live oscilloscope visualization of equipment vibration metrics (velocity & acceleration limits).
              </p>
            </div>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={handleExportVibration}
                className="rounded-lg border border-[#acd3ff] dark:border-slate-700 bg-[#f7fbff]/50 dark:bg-slate-900 px-3 py-1.5 text-xs font-bold text-[#002b5c] dark:text-slate-300 transition hover:bg-slate-50 dark:hover:bg-slate-800/80"
              >
                📥 Export Excel
              </button>
              <div className="flex items-center gap-2">
                <label className="text-xs font-bold text-slate-400">Equipment:</label>
                <select
                  value={selectedEq}
                  onChange={(e) => setSelectedEq(e.target.value)}
                  className="bg-slate-50 dark:bg-slate-900 text-xs font-bold border border-slate-200 dark:border-slate-800 text-[#002b5c] dark:text-slate-300 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-[#1f6fb5]"
                >
                  {["CT-1 Fan", "CT-1 Motor", "CT-2 Fan", "CT-2 Motor", "CT-3 Fan", "CT-3 Motor", "DU-03 Pump", "BP-03 Pump", "PREP-03 Pump", "ST-03 Motor", "Washing Motor", "Minilab Motor"].map((eq) => (
                    <option key={eq} value={eq}>
                      {eq}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>
          
          {/* Oscilloscope Container */}
          <div className="h-64 rounded-xl overflow-hidden border border-[#acd3ff] dark:border-slate-800">
            <VibrationOscilloscope equipmentName={selectedEq} />
          </div>
        </div>
      )}

      {/* 4. Daily Makeup & Blowdown Volume (Cooling Tower only) */}
      {isCoolingTower && (
        <div className="bg-white dark:bg-slate-950 border border-[#acd3ff] dark:border-slate-800 rounded-xl p-5 shadow-sm transition-colors duration-300">
          <div className="mb-4 flex items-center justify-between border-b border-[#acd3ff]/30 pb-2.5">
            <div className="space-y-0.5">
              <h3 className="text-sm font-bold text-[#002b5c] dark:text-slate-100 uppercase tracking-wide">
                Daily Makeup & Blowdown Volume
              </h3>
              <p className="text-xs text-slate-400">
                Comparative review over the past 30 days.
              </p>
            </div>
            <div className="flex gap-4 text-xs font-mono">
              <div className="flex flex-col text-right">
                <span className="text-slate-400">Makeup Sum</span>
                <span className="text-[#38bdf8] font-bold">1,120 m³</span>
              </div>
              <div className="flex flex-col text-right">
                <span className="text-slate-400">Blowdown Sum</span>
                <span className="text-[#f97316] font-bold">480 m³</span>
              </div>
            </div>
          </div>
          <div className="h-64 min-h-0">
            <Bar data={dailyVolumeData} options={dailyVolumeOptions} />
          </div>
        </div>
      )}

      {/* 5. Custom range Export Excel Modal (Mounted to body via createPortal for true 100% fullscreen overlay without gaps) */}
      {showExportModal && typeof document !== "undefined" && createPortal(
        <div 
          className="fixed inset-0 z-[99999] flex items-center justify-center p-4 bg-black/60 dark:bg-black/80 animate-in fade-in duration-150"
          onClick={(e) => {
            if (e.target === e.currentTarget) setShowExportModal(false);
          }}
        >
          <div 
            className="w-full max-w-lg overflow-hidden rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-2xl transition-all duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="mb-4 flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <div className="flex items-center gap-2.5">
                <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-[#1f6fb5]/10 text-[#1f6fb5] dark:text-sky-400 text-base">
                  📊
                </span>
                <div>
                  <h3 className="text-sm font-bold text-[#002b5c] dark:text-slate-100 uppercase tracking-wider">
                    Export Data ke Excel
                  </h3>
                  <p className="text-[11px] text-slate-400 dark:text-slate-500 font-medium">
                    Unduh data historis dalam format spreadsheet (.xlsx)
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowExportModal(false)}
                className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-700 dark:hover:text-slate-200 transition text-sm font-bold"
              >
                ✕
              </button>
            </div>
            
            {/* Export Scope Selector (Single vs Multi) for Parameters */}
            {exportType === "parameter" && (
              <div className="mb-4 space-y-3">
                <div>
                  <label className="block text-[11px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-1.5">
                    Pilihan Mode Export
                  </label>
                  <div className="grid grid-cols-2 gap-1.5 bg-slate-100 dark:bg-slate-950 p-1 rounded-xl border border-slate-200 dark:border-slate-800">
                    <button
                      type="button"
                      onClick={() => setExportScope("single")}
                      className={`px-3 py-2 text-xs font-bold rounded-lg transition ${
                        exportScope === "single"
                          ? "bg-white dark:bg-slate-800 text-[#1f6fb5] dark:text-sky-400 shadow-sm border border-slate-200/80 dark:border-slate-700"
                          : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200"
                      }`}
                    >
                      1 Parameter Saja
                    </button>
                    <button
                      type="button"
                      onClick={() => setExportScope("multiple")}
                      className={`px-3 py-2 text-xs font-bold rounded-lg transition ${
                        exportScope === "multiple"
                          ? "bg-white dark:bg-slate-800 text-[#1f6fb5] dark:text-sky-400 shadow-sm border border-slate-200/80 dark:border-slate-700"
                          : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200"
                      }`}
                    >
                      Banyak Parameter
                    </button>
                  </div>
                </div>

                {exportScope === "single" ? (
                  <div className="rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 p-3">
                    <p className="text-xs text-slate-600 dark:text-slate-400">
                      Parameter yang akan di-export:{" "}
                      <span className="font-bold text-[#1f6fb5] dark:text-sky-400">
                        {activeParam} ({unitMap[activeParam] || ""})
                      </span>
                    </p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider">
                        Pilih Parameter ({selectedExportParams.length}/{parametersList.length} Dipilih)
                      </span>
                      <button
                        type="button"
                        onClick={handleSelectAllParams}
                        className="text-[11px] font-bold text-[#1f6fb5] dark:text-sky-400 hover:underline"
                      >
                        {selectedExportParams.length === parametersList.length ? "Hapus Semua" : "Pilih Semua"}
                      </button>
                    </div>
                    <div className="max-h-48 overflow-y-auto space-y-1.5 p-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 pr-1.5">
                      {parametersList.map((param) => {
                        const isChecked = selectedExportParams.includes(param);
                        return (
                          <div
                            key={param}
                            role="button"
                            tabIndex={0}
                            onClick={() => toggleParamSelection(param)}
                            onKeyDown={(e) => {
                              if (e.key === " " || e.key === "Enter") {
                                e.preventDefault();
                                toggleParamSelection(param);
                              }
                            }}
                            className={`flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-semibold cursor-pointer transition-all select-none border ${
                              isChecked
                                ? "bg-[#1f6fb5]/10 dark:bg-[#1f6fb5]/20 border-[#1f6fb5] text-[#002b5c] dark:text-sky-200 shadow-sm"
                                : "bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:border-slate-300 dark:hover:border-slate-700 hover:bg-slate-50/80 dark:hover:bg-slate-850"
                            }`}
                          >
                            <div className="flex items-center gap-3">
                              <div
                                className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border transition ${
                                  isChecked
                                    ? "bg-[#1f6fb5] border-[#1f6fb5] text-white"
                                    : "border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800"
                                }`}
                              >
                                {isChecked && (
                                  <svg className="h-3 w-3 fill-current" viewBox="0 0 20 20">
                                    <path d="M0 11l2-2 5 5L18 3l2 2L7 18z" />
                                  </svg>
                                )}
                              </div>
                              <span className="font-semibold">{param}</span>
                            </div>
                            <span className="text-[11px] font-mono text-slate-400 dark:text-slate-500">
                              {unitMap[param] || ""}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            )}

            {exportType === "vibration" && (
              <div className="mb-4 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 p-3">
                <p className="text-xs text-slate-600 dark:text-slate-400">
                  Data vibrasi yang akan di-export:{" "}
                  <span className="font-bold text-[#1f6fb5] dark:text-sky-400">{selectedEq}</span>
                </p>
              </div>
            )}

            {/* Date Range Inputs */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-6">
              <div>
                <label className="block text-[11px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-1.5">
                  Tanggal Mulai
                </label>
                <input
                  type="date"
                  value={exportStart}
                  onChange={(e) => setExportStart(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3.5 py-2 text-xs font-semibold text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-[#1f6fb5]"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-1.5">
                  Tanggal Selesai
                </label>
                <input
                  type="date"
                  value={exportEnd}
                  onChange={(e) => setExportEnd(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3.5 py-2 text-xs font-semibold text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-[#1f6fb5]"
                />
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex justify-end gap-2.5 border-t border-slate-100 dark:border-slate-800 pt-4">
              <button
                type="button"
                onClick={() => setShowExportModal(false)}
                className="rounded-xl border border-slate-200 dark:border-slate-700 bg-transparent px-4 py-2 text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={executeExport}
                disabled={exportLoading || (exportType === "parameter" && exportScope === "multiple" && selectedExportParams.length === 0)}
                className="flex items-center gap-2 rounded-xl bg-[#1f6fb5] hover:bg-[#185c96] px-5 py-2 text-xs font-bold text-white shadow-md shadow-[#1f6fb5]/20 transition disabled:opacity-50"
              >
                {exportLoading ? (
                  <>
                    <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white border-t-transparent" />
                    Mengunduh...
                  </>
                ) : (
                  <>
                    📥 Unduh File Excel
                  </>
                )}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
