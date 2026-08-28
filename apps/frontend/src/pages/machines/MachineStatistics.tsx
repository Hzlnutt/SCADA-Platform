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

  // Synchronize parameter default based on machine type
  useEffect(() => {
    setActiveParam(unitId === "cooling-water-1" ? "ST3 Return Temp" : "Supply Water Temp");
  }, [unitId]);

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

  // Hardcoded to exactly today's 24 hours
  const resolution = "Hourly";
  const startDate = getLocalTodayStr();
  const endDate = getLocalTodayStr();

  // Database-fetched Parameter Data states
  const [rawPoints, setRawPoints] = useState<{ ts: string; value: number }[]>([]);
  const [dbLoading, setDbLoading] = useState(false);

  const paramTagIdMap: Record<string, string> = {
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
    "Makeup Water pH": "cooling-water/makeup_ph"
  };

  // Fetch function (extracted so it can be called on interval too)
  const fetchTrendData = useCallback(() => {
    const tagId = paramTagIdMap[activeParam];
    if (!tagId) {
      setRawPoints([]);
      return;
    }

    setDbLoading(true);
    const fromStr = `${startDate}T00:00:00.000Z`;
    const toStr = `${endDate}T23:59:59.999Z`;

    const params = new URLSearchParams({
      tagId,
      from: fromStr,
      to: toStr,
      resolution: "1h",
      limit: "15000"
    });

    getJson<{ data: any[] }>(`/historian/range?${params.toString()}`)
      .then((res) => {
        const points = res.data || [];
        const mapped = points
          .map((pt: any) => ({
            ts: pt.ts,
            value: typeof pt.value === "number" ? pt.value : Number(pt.value)
          }))
          .filter((pt: any) => !isNaN(pt.value));
        setRawPoints(mapped);
      })
      .catch((err) => {
        console.error(`Error fetching historical range for ${activeParam}:`, err);
        setRawPoints([]);
      })
      .finally(() => {
        setDbLoading(false);
      });
  }, [activeParam, startDate, endDate]);

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
      return () => {
        clearInterval(interval);
        socket.off("historian:minute_update", handleMinuteUpdate);
        socket.off("cooling_tower:minute_update", handleMinuteUpdate);
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
  }, [unitId]);

  const unitMap: Record<string, string> = {
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
    "Makeup Water pH": "pH"
  };

  const aggregatedTrendPoints = useMemo(() => {
    if (rawPoints.length === 0) return [];

    // Parse the selected startDate to anchor the year and month
    const anchorDate = startDate ? new Date(startDate) : new Date();
    const anchorYr = anchorDate.getFullYear();
    const anchorMo = anchorDate.getMonth();

    if (resolution === "Hourly") {
      // Fixed 24 Hours: 00:00 to 23:00
      const result = [];
      for (let h = 0; h < 24; h++) {
        const label = `${String(h).padStart(2, "0")}:00`;
        const matched = rawPoints.filter((pt) => {
          const date = new Date(pt.ts);
          return date.getHours() === h;
        });

        if (matched.length > 0) {
          const sum = matched.reduce((s, pt) => s + pt.value, 0);
          result.push({
            label,
            value: Number((sum / matched.length).toFixed(2))
          });
        } else {
          result.push({ label, value: null });
        }
      }
      return result;
    }

    if (resolution === "Daily") {
      // Fixed Days: 1 to end of month for the anchor date
      const numDays = new Date(anchorYr, anchorMo + 1, 0).getDate();
      const result = [];
      for (let d = 1; d <= numDays; d++) {
        const label = `${String(d).padStart(2, "0")}/${String(anchorMo + 1).padStart(2, "0")}`;
        const matched = rawPoints.filter((pt) => {
          const date = new Date(pt.ts);
          return date.getDate() === d && date.getMonth() === anchorMo && date.getFullYear() === anchorYr;
        });

        if (matched.length > 0) {
          const sum = matched.reduce((s, pt) => s + pt.value, 0);
          result.push({
            label,
            value: Number((sum / matched.length).toFixed(2))
          });
        } else {
          result.push({ label, value: null });
        }
      }
      return result;
    }

    // Monthly: Jan to Des
    const monthLabels = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agt", "Sep", "Okt", "Nov", "Des"];
    const result = [];
    for (let m = 0; m < 12; m++) {
      const label = monthLabels[m];
      const matched = rawPoints.filter((pt) => {
        const date = new Date(pt.ts);
        return date.getMonth() === m && date.getFullYear() === anchorYr;
      });

      if (matched.length > 0) {
        const sum = matched.reduce((s, pt) => s + pt.value, 0);
        result.push({
          label,
          value: Number((sum / matched.length).toFixed(2))
        });
      } else {
        result.push({ label, value: null });
      }
    }
    return result;
  }, [rawPoints, resolution, startDate]);

  // 3. Left/Right parameter selector data (using brand blue #1f6fb5)
  const parameterTrendData = useMemo(() => {
    const labels = aggregatedTrendPoints.map(pt => pt.label);
    const dataVals = aggregatedTrendPoints.map(pt => pt.value);

    return {
      chartData: {
        labels,
        datasets: [
          {
            label: `${activeParam} (${unitMap[activeParam] ?? ""})`,
            data: dataVals,
            borderColor: "#1f6fb5", // Brand Blue
            backgroundColor: "rgba(31, 111, 181, 0.1)",
            borderWidth: 2.5,
            tension: 0.3,
            fill: true,
            pointRadius: 2.5,
            pointBackgroundColor: "#1f6fb5",
            pointBorderColor: "#ffffff",
            pointBorderWidth: 1.5,
            pointHoverRadius: 8,
            pointHoverBackgroundColor: "#1f6fb5",
            pointHoverBorderColor: "#ffffff",
            pointHoverBorderWidth: 3,
            pointHitRadius: 15
          }
        ]
      },
      unit: unitMap[activeParam] ?? ""
    };
  }, [activeParam, aggregatedTrendPoints]);

  const parameterTrendOptions = {
    responsive: true,
    maintainAspectRatio: false,
    interaction: {
      mode: "index" as const,
      intersect: false
    },
    plugins: {
      legend: { display: false }
    },
    scales: {
      x: {
        grid: { display: false },
        ticks: { color: isDark ? "#64748b" : "#47729f", font: { size: 9 }, maxTicksLimit: 12 }
      },
      y: {
        grid: { color: isDark ? "rgba(51, 65, 85, 0.3)" : "rgba(203, 213, 225, 0.4)" },
        ticks: { color: isDark ? "#64748b" : "#47729f", font: { size: 9 } }
      }
    }
  };

  const handleExportParameters = () => {
    setExportType("parameter");
    setExportScope("single");
    setSelectedExportParams([...parametersList]);
    setExportStart(getLocalTodayStr());
    setExportEnd(getLocalTodayStr());
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
          : `cooling-tower-parameters-${exportStart}-to-${exportEnd}.xlsx`;

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

      {/* 1. Grafik CT Effectiveness Chart Card */}
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

      {/* 2. Interactive Parameter Selector Grid (Image 4 bottom/right layout) */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        <div className="lg:col-span-3 bg-white dark:bg-slate-950 border border-[#acd3ff] dark:border-slate-800 rounded-xl p-5 shadow-sm transition-colors duration-300">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3 border-b border-[#acd3ff]/30 pb-2.5">
            <h3 className="text-sm font-bold text-[#002b5c] dark:text-slate-100 uppercase tracking-wide">
              Historical Parameters Detail
            </h3>
            <div className="flex flex-wrap items-center gap-2">
              {dbLoading && (
                <span className="text-xs text-[#1f6fb5] font-bold animate-pulse mr-1">
                  ⏳
                </span>
              )}
              <button
                type="button"
                onClick={handleExportParameters}
                className="rounded-lg border border-[#acd3ff] dark:border-slate-700 bg-[#f7fbff]/50 dark:bg-slate-900 px-3 py-1 text-xs font-bold text-[#002b5c] dark:text-slate-300 transition hover:bg-slate-50 dark:hover:bg-slate-800/80"
              >
                📥 Export Excel
              </button>
              <span className="text-xs text-[#1f6fb5] font-bold bg-[#1f6fb5]/10 px-2.5 py-0.5 rounded-full">
                {activeParam}
              </span>
            </div>
          </div>
          <div className="h-64 min-h-0">
            <Line data={parameterTrendData.chartData} options={parameterTrendOptions} />
          </div>
        </div>

        {/* Right selection panel */}
        <div className="bg-white dark:bg-slate-950 border border-[#acd3ff] dark:border-slate-800 rounded-xl p-4 shadow-sm transition-colors duration-300 flex flex-col justify-between">
          <div>
            <h4 className="text-xs font-bold uppercase tracking-wider text-[#47729f] dark:text-slate-500 mb-3 border-b border-slate-100 dark:border-slate-900 pb-2">
              Select Trend Parameter
            </h4>
            <div className="space-y-1.5 max-h-[260px] overflow-y-auto pr-1">
              {parametersList.map((param) => (
                <button
                  key={param}
                  onClick={() => setActiveParam(param)}
                  className={`w-full text-left px-3 py-2 text-xs font-semibold rounded-lg transition duration-200 border ${
                    activeParam === param
                      ? "bg-[#1f6fb5] text-white border-transparent shadow-md shadow-[#1f6fb5]/20"
                      : "text-[#002b5c] dark:text-slate-300 border-slate-100 dark:border-slate-900 bg-slate-50/50 dark:bg-slate-900/40 hover:bg-[#1f6fb5]/10 dark:hover:bg-[#1f6fb5]/20"
                  }`}
                >
                  {param}
                </button>
              ))}
            </div>
          </div>
          <p className="text-[10px] text-slate-400 dark:text-slate-600 mt-2 italic">
            Select a parameter to view the historical trend.
          </p>
        </div>
      </div>

      {/* 3. Vibration Waveform Telemetry (Oscilloscope) Card */}
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

      {/* 4. Daily Makeup & Blowdown Volume (Image 5 layout) */}
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
                    <div className="max-h-44 overflow-y-auto space-y-1 p-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 pr-1.5">
                      {parametersList.map((param) => {
                        const isChecked = selectedExportParams.includes(param);
                        return (
                          <label
                            key={param}
                            onClick={() => toggleParamSelection(param)}
                            className={`flex items-center justify-between px-3 py-2 rounded-lg text-xs font-semibold cursor-pointer transition select-none border ${
                              isChecked
                                ? "bg-[#1f6fb5]/10 dark:bg-[#1f6fb5]/20 border-[#1f6fb5]/30 text-[#002b5c] dark:text-sky-200"
                                : "bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800/80 text-slate-600 dark:text-slate-400 hover:border-slate-300 dark:hover:border-slate-700"
                            }`}
                          >
                            <div className="flex items-center gap-2.5">
                              <input
                                type="checkbox"
                                checked={isChecked}
                                onChange={() => {}}
                                className="h-4 w-4 rounded text-[#1f6fb5] focus:ring-[#1f6fb5] cursor-pointer"
                              />
                              <span>{param}</span>
                            </div>
                            <span className="text-[10px] font-mono text-slate-400 dark:text-slate-500">
                              {unitMap[param] || ""}
                            </span>
                          </label>
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
