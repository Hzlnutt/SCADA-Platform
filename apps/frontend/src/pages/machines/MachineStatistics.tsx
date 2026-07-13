import { useEffect, useMemo, useRef, useState } from "react";
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

      // Draw Waveform Signal (Oscilloscope scrolling sine + noise)
      ctx.strokeStyle = isDark ? "#38bdf8" : "#1f6fb5"; // Sky blue in dark mode, normal blue in light
      ctx.lineWidth = 2;
      ctx.beginPath();

      // We make the waveform vary slightly based on equipmentName hash
      const charCodeSum = equipmentName.split("").reduce((sum, c) => sum + c.charCodeAt(0), 0);
      const eqFreq = 0.03 + (charCodeSum % 5) * 0.005;
      const eqAmp1 = 20 + (charCodeSum % 7) * 3;
      const eqAmp2 = 8 + (charCodeSum % 3) * 2;

      for (let x = 0; x < w; x++) {
        // Compose multiple sine waves for realistic raw vibration signals
        const angle1 = (x + offset) * eqFreq;
        const angle2 = (x + offset) * eqFreq * 2.3;
        const noise = (Math.sin((x + offset) * 0.5) + Math.cos((x + offset) * 0.9)) * 1.5;
        const y = centerY + Math.sin(angle1) * eqAmp1 + Math.cos(angle2) * eqAmp2 + noise;

        if (x === 0) {
          ctx.moveTo(x, y);
        } else {
          ctx.lineTo(x, y);
        }
      }
      ctx.stroke();

      // Increment scrolling speed
      offset += 2;
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

  // Resolution selector state
  const [resolution, setResolution] = useState<"Hourly" | "Daily" | "Monthly">("Hourly");

  // Database-fetched Return Temperature Data state
  const [dbData, setDbData] = useState<{
    hourly: number[];
    daily: number[];
    monthly: number[];
  } | null>(null);
  const [dbLoading, setDbLoading] = useState(false);

  useEffect(() => {
    if (unitId !== "cooling-water-1" || activeParam !== "ST3 Return Temp") {
      return;
    }

    setDbLoading(true);
    // Fetch data for 2025 range
    const from = "2025-01-01T00:00:00.000Z";
    const to = "2025-12-31T23:59:59.000Z";
    const params = new URLSearchParams({
      tagId: "cooling/return_temp",
      from,
      to,
      resolution: "1h",
      limit: "10000"
    });

    getJson<{ data: any[] }>(`/historian/range?${params.toString()}`)
      .then((res) => {
        const points = res.data || [];
        if (points.length === 0) {
          setDbData(null);
          return;
        }

        // Process hourly profile: 24 points (Hour 0 to Hour 23 averages)
        const hourGroups = Array.from({ length: 24 }, () => [] as number[]);
        points.forEach((pt) => {
          const d = new Date(pt.ts);
          const hr = d.getUTCHours(); // using UTC since database dates are stored in UTC
          const val = typeof pt.value === "number" ? pt.value : Number(pt.value);
          if (!isNaN(val)) {
            hourGroups[hr].push(val);
          }
        });
        const hourly = hourGroups.map((arr) =>
          arr.length > 0 ? Number((arr.reduce((a, b) => a + b, 0) / arr.length).toFixed(3)) : 0
        );

        // Process daily profile: 30 points (Day of month 1 to 30 averages)
        const dayGroups = Array.from({ length: 30 }, () => [] as number[]);
        points.forEach((pt) => {
          const d = new Date(pt.ts);
          const dy = d.getUTCDate(); // 1-31
          const val = typeof pt.value === "number" ? pt.value : Number(pt.value);
          if (!isNaN(val) && dy <= 30) {
            dayGroups[dy - 1].push(val);
          }
        });
        const daily = dayGroups.map((arr) =>
          arr.length > 0 ? Number((arr.reduce((a, b) => a + b, 0) / arr.length).toFixed(3)) : 0
        );

        // Process monthly profile: 12 points (Jan to Dec averages)
        const monthGroups = Array.from({ length: 12 }, () => [] as number[]);
        points.forEach((pt) => {
          const d = new Date(pt.ts);
          const mo = d.getUTCMonth(); // 0-11
          const val = typeof pt.value === "number" ? pt.value : Number(pt.value);
          if (!isNaN(val)) {
            monthGroups[mo].push(val);
          }
        });
        const monthly = monthGroups.map((arr) =>
          arr.length > 0 ? Number((arr.reduce((a, b) => a + b, 0) / arr.length).toFixed(3)) : 0
        );

        setDbData({ hourly, daily, monthly });
      })
      .catch((err) => {
        console.error("Error fetching cooling ST3 Return Temp data:", err);
      })
      .finally(() => {
        setDbLoading(false);
      });
  }, [unitId, activeParam]);

  // 1. Grafik CT Effectiveness (30 days mock data)
  const ctEffectivenessData = useMemo(() => {
    const days = Array.from({ length: 30 }, (_, i) => `Day ${i + 1}`);
    
    // Day-to-day base variables with tiny standard variations
    const jam00Values = days.map((_, i) => 70 + Math.sin(i / 2) * 5 + Math.cos(i / 5) * 2 + Math.random() * 2);
    const jam12Values = days.map((_, i) => 75 + Math.sin(i / 3) * 4 + Math.cos(i / 4) * 3 + Math.random() * 2);

    return {
      labels: days,
      datasets: [
        {
          label: "Jam00",
          data: jam00Values,
          borderColor: "#f97316", // Orange
          backgroundColor: "#f9731644",
          borderWidth: 2,
          tension: 0.35,
          fill: false,
          pointRadius: 2,
          pointHoverRadius: 5
        },
        {
          label: "Jam12",
          data: jam12Values,
          borderColor: "#94a3b8", // Grey
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

  // 2. Daily Volume Makeup & Blowdown (30 days mock data)
  const dailyVolumeData = useMemo(() => {
    const days = Array.from({ length: 30 }, (_, i) => `Day ${i + 1}`);
    const makeupValues = days.map((_, i) => 35 + Math.sin(i / 4) * 5 + Math.random() * 3);
    const blowdownValues = days.map((_, i) => 15 + Math.sin(i / 4) * 2 + Math.random() * 1.5);

    return {
      labels: days,
      datasets: [
        {
          label: "Daily Makeup Volume (m³)",
          data: makeupValues,
          backgroundColor: "rgba(56, 189, 248, 0.8)", // Light Blue
          borderWidth: 0,
          borderRadius: 2
        },
        {
          label: "Daily Blowdown Volume (m³)",
          data: blowdownValues,
          backgroundColor: "rgba(249, 115, 22, 0.8)", // Orange
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

  // 3. Left/Right parameter selector data
  const parameterTrendData = useMemo(() => {
    let labels: string[] = [];
    if (resolution === "Hourly") {
      labels = Array.from({ length: 24 }, (_, i) => `${i}:00`);
    } else if (resolution === "Daily") {
      labels = Array.from({ length: 30 }, (_, i) => `Day ${i + 1}`);
    } else {
      labels = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    }

    // Helper to generate dynamic lines based on selected parameter name
    const getValuesForParam = (paramName: string) => {
      const liveST3Return = latest["cooling-water/st3_return_temp"]?.value;
      const liveSupplyTemp = latest["cooling-water/supply_temp"]?.value;
      const liveReturnTemp = latest["cooling-water/return_temp"]?.value;

      let baseVal = 25;
      if (paramName === "ST3 Return Temp") {
        baseVal = typeof liveST3Return === "number" ? liveST3Return : 32.2;
      } else if (paramName === "Supply Water Temp") {
        baseVal = typeof liveSupplyTemp === "number" ? liveSupplyTemp : 29.1;
      } else if (paramName === "Return Water Temp") {
        baseVal = typeof liveReturnTemp === "number" ? liveReturnTemp : 31.4;
      } else {
        const charCodeSum = paramName.split("").reduce((sum, c) => sum + c.charCodeAt(0), 0);
        baseVal = 10 + (charCodeSum % 100);
      }

      return labels.map((_, i) => {
        // Generate a smooth simulated historical profile based on real base value
        const val = baseVal + Math.sin(i / 3) * (baseVal * 0.02) + Math.random() * (baseVal * 0.005);
        return Number(val.toFixed(2));
      });
    };

    const yValues = getValuesForParam(activeParam);

    return {
      chartData: {
        labels,
        datasets: [
          {
            label: `${activeParam} (${unitMap[activeParam] ?? ""})`,
            data: yValues,
            borderColor: "#10b981", // Emerald Green
            backgroundColor: "rgba(16, 185, 129, 0.1)",
            borderWidth: 2.5,
            tension: 0.3,
            fill: true,
            pointRadius: 1,
            pointHoverRadius: 4
          }
        ]
      },
      unit: unitMap[activeParam] ?? ""
    };
  }, [activeParam, resolution]);

  const parameterTrendOptions = {
    responsive: true,
    maintainAspectRatio: false,
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
    let labels: string[] = [];
    if (resolution === "Hourly") {
      labels = Array.from({ length: 24 }, (_, i) => `${i}:00`);
    } else if (resolution === "Daily") {
      labels = Array.from({ length: 30 }, (_, i) => `Day ${i + 1}`);
    } else {
      labels = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    }

    const getValuesForParam = (paramName: string) => {
      if (paramName === "ST3 Supply Temp") {
        if (resolution === "Hourly") return coolingSt3Data.hourly;
        if (resolution === "Daily") return coolingSt3Data.daily;
        return coolingSt3Data.monthly;
      }
      const charCodeSum = paramName.split("").reduce((sum, c) => sum + c.charCodeAt(0), 0);
      const baseVal = 10 + (charCodeSum % 100);
      return labels.map((_, i) => {
        const val = baseVal + Math.sin(i / 3) * (baseVal * 0.05) + Math.random() * (baseVal * 0.01);
        return Number(val.toFixed(2));
      });
    };

    const paramDataMap: Record<string, number[]> = {};
    parametersList.forEach((param) => {
      paramDataMap[param] = getValuesForParam(param);
    });

    const rows = labels.map((label, index) => {
      const row: Record<string, any> = {
        Timestamp: label
      };
      parametersList.forEach((param) => {
        const unit = unitMap[param] ? ` (${unitMap[param]})` : "";
        row[`${param}${unit}`] = paramDataMap[param][index];
      });
      return row;
    });

    const worksheet = utils.json_to_sheet(rows);
    const workbook = utils.book_new();
    utils.book_append_sheet(workbook, worksheet, `${resolution} Parameters`);
    writeFile(workbook, `historical-parameters-${resolution.toLowerCase()}-${machine.id}.xlsx`);
  };

  const handleExportVibration = () => {
    const charCodeSum = selectedEq.split("").reduce((sum, c) => sum + c.charCodeAt(0), 0);
    const eqFreq = 0.03 + (charCodeSum % 5) * 0.005;
    const eqAmp1 = 20 + (charCodeSum % 7) * 3;
    const eqAmp2 = 8 + (charCodeSum % 3) * 2;

    const rows = Array.from({ length: 100 }, (_, i) => {
      const angle1 = i * eqFreq;
      const angle2 = i * eqFreq * 2.3;
      const noise = (Math.sin(i * 0.5) + Math.cos(i * 0.9)) * 1.5;
      const velocity = Math.sin(angle1) * eqAmp1 + Math.cos(angle2) * eqAmp2 + noise;
      const acceleration = (Math.cos(angle1) * eqAmp1 * 0.15 + Math.sin(angle2) * eqAmp2 * 0.3 + noise * 0.2);

      const time = new Date();
      time.setMilliseconds(time.getMilliseconds() - (100 - i) * 10);

      return {
        "Sample No": i + 1,
        "Timestamp": time.toISOString(),
        "Vibration Velocity (mm/s)": Number(Math.abs(velocity).toFixed(2)),
        "Vibration Acceleration (G)": Number(Math.abs(acceleration).toFixed(2))
      };
    });

    const worksheet = utils.json_to_sheet(rows);
    const workbook = utils.book_new();
    utils.book_append_sheet(workbook, worksheet, "Vibration Waveform");
    writeFile(workbook, `vibration-${selectedEq.toLowerCase().replace(/\s+/g, "-")}-${machine.id}.xlsx`);
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
              <div className="flex items-center gap-0.5 rounded-lg border border-[#acd3ff] dark:border-slate-800 bg-slate-50 dark:bg-slate-900/60 p-0.5 text-xs">
                {(["Hourly", "Daily", "Monthly"] as const).map((r) => (
                  <button
                    key={r}
                    type="button"
                    onClick={() => setResolution(r)}
                    className={`rounded-md px-2.5 py-1 font-bold transition ${
                      resolution === r
                        ? "bg-[#1f6fb5] text-white"
                        : "text-[#47729f] dark:text-slate-400 hover:text-[#002b5c] dark:hover:text-slate-300"
                    }`}
                  >
                    {r}
                  </button>
                ))}
              </div>
              {dbLoading && (
                <span className="text-xs text-blue-500 font-bold animate-pulse mr-2">
                  Loading DB Data...
                </span>
              )}
              <button
                type="button"
                onClick={handleExportParameters}
                className="rounded-lg border border-[#acd3ff] dark:border-slate-700 bg-[#f7fbff]/50 dark:bg-slate-900 px-3 py-1 text-xs font-bold text-[#002b5c] dark:text-slate-300 transition hover:bg-slate-50 dark:hover:bg-slate-800/80"
              >
                📥 Export Excel
              </button>
              <span className="text-xs text-emerald-500 font-bold bg-emerald-500/10 px-2.5 py-0.5 rounded-full">
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
                {["CT-1 Fan", "CT-1 Motor", "CT-2 Fan", "CT-2 Motor", "CT-3 Fan", "CT-3 Motor", "DU-03 Pump", "BP-03 Pump", "PREP-03 Pump"].map((eq) => (
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
    </div>
  );
}
