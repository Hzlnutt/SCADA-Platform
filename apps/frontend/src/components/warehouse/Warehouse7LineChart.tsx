import { useMemo, useState } from "react";
import { Line } from "react-chartjs-2";
import type { ChartOptions } from "chart.js";
import "./chartjs_bridge";

export interface Warehouse7SeriesPoint {
  ts: string;
  label: string;
  suhu: number;
  humi?: number | null;
  baterai?: number | null;
}

export interface Warehouse7DeviceSeries {
  deviceId: string;
  deviceLabel: string;
  locationLabel: string;
  points: Warehouse7SeriesPoint[];
}

export interface Warehouse7HighestPoint {
  ts: string;
  label: string;
  suhu: number | null;
  sourceDevice?: string;
}

export interface Warehouse7TrendPayload {
  unitId: string;
  filter: string;
  limits: { minTemp: number; maxTemp: number };
  timestamps: { ts: string; label: string }[];
  devices: Warehouse7DeviceSeries[];
  highestSeries: Warehouse7HighestPoint[];
  hourlyRows?: Array<{
    t_stamp: string;
    label: string;
    deviceId: string;
    deviceLabel: string;
    locationLabel: string;
    suhu: number;
    humi: number | null;
    baterai: number | null;
    isOnline: boolean | null;
  }>;
  stats?: {
    minTemp: number | null;
    avgTemp: number | null;
    maxTemp: number | null;
    exceedCount: number;
    totalPoints: number;
  };
  hasData: boolean;
}

const LINE_PALETTE = [
  "#0d9488", // Teal
  "#f43f5e", // Rose
  "#3b82f6", // Blue
  "#f59e0b", // Amber
  "#8b5cf6", // Violet
  "#10b981", // Emerald
  "#ec4899", // Pink
  "#06b6d4"  // Cyan
];

export default function Warehouse7LineChart({
  trend,
  deviceMode,
  isDark,
  minTemp,
  maxTemp,
  heightClass = "h-[340px]"
}: {
  trend: Warehouse7TrendPayload | null;
  deviceMode: string;
  isDark: boolean;
  minTemp: number;
  maxTemp: number;
  heightClass?: string;
}) {
  const [hoverMode, setHoverMode] = useState<"nearest" | "index">("nearest");

  const { chartData, yMin, yMax } = useMemo(() => {
    const timestamps = trend?.timestamps || [];
    const labels = timestamps.map((t) => t.label);
    const tsKeys = timestamps.map((t) => t.ts);

    const datasets: any[] = [];
    const numericVals: number[] = [minTemp, maxTemp];

    if (deviceMode === "highest") {
      const highestMap = new Map<string, Warehouse7HighestPoint>();
      for (const hp of trend?.highestSeries || []) {
        highestMap.set(hp.ts, hp);
      }
      const data = tsKeys.map((ts) => {
        const val = highestMap.get(ts)?.suhu ?? null;
        if (val !== null) numericVals.push(val);
        return val;
      });
      const sources = tsKeys.map((ts) => highestMap.get(ts)?.sourceDevice || "Highest");

      datasets.push({
        label: "Highest Temperature Device",
        data,
        sourceDevices: sources,
        borderColor: "#ef4444",
        backgroundColor: "rgba(239, 68, 68, 0.12)",
        borderWidth: 2.5,
        tension: 0.25,
        fill: false,
        spanGaps: true,
        pointRadius: data.length <= 48 ? 3.5 : 1.5,
        pointHoverRadius: 7,
        pointHitRadius: 14,
        pointBackgroundColor: data.map((v) =>
          v !== null && (v > maxTemp || v < minTemp) ? "#dc2626" : "#ef4444"
        ),
        pointBorderColor: "#ffffff",
        pointBorderWidth: 1.5
      });
    } else {
      const targetDevices =
        deviceMode === "all"
          ? trend?.devices || []
          : (trend?.devices || []).filter((d) => d.deviceId === deviceMode);

      targetDevices.forEach((dev, idx) => {
        const ptMap = new Map<string, Warehouse7SeriesPoint>();
        for (const p of dev.points) ptMap.set(p.ts, p);

        const color = LINE_PALETTE[idx % LINE_PALETTE.length];
        const data = tsKeys.map((ts) => {
          const val = ptMap.get(ts)?.suhu ?? null;
          if (val !== null) numericVals.push(val);
          return val;
        });

        datasets.push({
          label: dev.deviceLabel || dev.deviceId,
          deviceId: dev.deviceId,
          locationLabel: dev.locationLabel,
          humiData: tsKeys.map((ts) => ptMap.get(ts)?.humi ?? null),
          data,
          borderColor: color,
          backgroundColor: `${color}22`,
          borderWidth: 2.2,
          tension: 0.25,
          fill: false,
          spanGaps: true,
          pointRadius: data.length <= 48 ? 3.5 : 1.5,
          pointHoverRadius: 7,
          pointHitRadius: 14,
          pointBackgroundColor: data.map((v) =>
            v !== null && (v > maxTemp || v < minTemp) ? "#dc2626" : color
          ),
          pointBorderColor: "#ffffff",
          pointBorderWidth: 1.5
        });
      });
    }

    if (labels.length > 0) {
      datasets.push({
        label: `Temp Max (${maxTemp}°C)`,
        data: labels.map(() => maxTemp),
        borderColor: "rgba(239, 68, 68, 0.85)",
        borderDash: [6, 5],
        borderWidth: 1.6,
        pointRadius: 0,
        pointHoverRadius: 0,
        pointHitRadius: 0,
        fill: false,
        isThresholdLine: true
      });
      datasets.push({
        label: `Temp Min (${minTemp}°C)`,
        data: labels.map(() => minTemp),
        borderColor: "rgba(59, 130, 246, 0.85)",
        borderDash: [6, 5],
        borderWidth: 1.6,
        pointRadius: 0,
        pointHoverRadius: 0,
        pointHitRadius: 0,
        fill: false,
        isThresholdLine: true
      });
    }

    const lo = Math.min(...numericVals);
    const hi = Math.max(...numericVals);
    return {
      chartData: { labels, datasets },
      yMin: Math.floor(lo - 2),
      yMax: Math.ceil(hi + 2)
    };
  }, [trend, deviceMode, minTemp, maxTemp]);

  const options: ChartOptions<"line"> = useMemo(
    () => ({
      responsive: true,
      maintainAspectRatio: false,
      animation: { duration: 200 },
      interaction: {
        mode: hoverMode,
        axis: hoverMode === "nearest" ? "xy" : "x",
        intersect: false
      },
      plugins: {
        legend: {
          display: true,
          position: "bottom",
          labels: {
            color: isDark ? "#cbd5e1" : "#334155",
            usePointStyle: true,
            boxWidth: 8,
            padding: 14,
            font: { size: 11, weight: "bold" }
          }
        },
        tooltip: {
          enabled: true,
          backgroundColor: isDark ? "rgba(15, 23, 42, 0.96)" : "rgba(255, 255, 255, 0.98)",
          titleColor: isDark ? "#f1f5f9" : "#0f172a",
          bodyColor: isDark ? "#cbd5e1" : "#334155",
          borderColor: isDark ? "#334155" : "#cbd5e1",
          borderWidth: 1,
          padding: 12,
          cornerRadius: 10,
          displayColors: true,
          filter: (tooltipItem) => {
            const ds = tooltipItem.dataset as any;
            return !ds.isThresholdLine;
          },
          callbacks: {
            title: (items) => {
              if (!items.length) return "";
              return `Waktu: ${items[0].label} WIB`;
            },
            label: (ctx) => {
              const ds = ctx.dataset as any;
              const val = ctx.parsed.y;
              if (val === null || val === undefined) return "";
              const idx = ctx.dataIndex;
              const sourceSuffix = ds.sourceDevices?.[idx] ? ` [${ds.sourceDevices[idx]}]` : "";
              const humiVal = ds.humiData?.[idx];
              const humiText = humiVal !== null && humiVal !== undefined ? ` | RH ${Number(humiVal).toFixed(1)}%` : "";
              let statusText = "Normal";
              if (val > maxTemp) statusText = `Melebihi Max (${maxTemp}°C)`;
              else if (val < minTemp) statusText = `Di bawah Min (${minTemp}°C)`;
              return `${ds.label}${sourceSuffix}: ${Number(val).toFixed(2)} °C${humiText} (${statusText})`;
            }
          }
        }
      },
      scales: {
        x: {
          grid: {
            color: isDark ? "rgba(148, 163, 184, 0.08)" : "rgba(148, 163, 184, 0.18)"
          },
          ticks: {
            color: isDark ? "#94a3b8" : "#64748b",
            maxTicksLimit: 10,
            font: { size: 10 }
          }
        },
        y: {
          min: yMin,
          max: yMax,
          title: {
            display: true,
            text: "Suhu (°C)",
            color: isDark ? "#94a3b8" : "#475569",
            font: { size: 11, weight: "bold" }
          },
          grid: {
            color: isDark ? "rgba(148, 163, 184, 0.1)" : "rgba(148, 163, 184, 0.2)"
          },
          ticks: {
            color: isDark ? "#94a3b8" : "#64748b",
            font: { size: 10 },
            callback: (v) => `${v}°C`
          }
        }
      }
    }),
    [hoverMode, isDark, maxTemp, minTemp, yMax, yMin]
  );

  const hasChartPoints = Boolean(trend?.hasData && (chartData.labels?.length || 0) > 0);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2 text-[11px]">
        <div className="flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md border border-rose-200 dark:border-rose-900/50 bg-rose-50 dark:bg-rose-950/30 text-rose-700 dark:text-rose-300 font-semibold">
            <span className="w-3 border-t-2 border-dashed border-rose-500 inline-block" />
            Temp Max: {maxTemp}°C
          </span>
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md border border-blue-200 dark:border-blue-900/50 bg-blue-50 dark:bg-blue-950/30 text-blue-700 dark:text-blue-300 font-semibold">
            <span className="w-3 border-t-2 border-dashed border-blue-500 inline-block" />
            Temp Min: {minTemp}°C
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-slate-500 dark:text-slate-400 font-medium">Mode Hover:</span>
          <button
            type="button"
            onClick={() => setHoverMode("nearest")}
            className={`px-2.5 py-1 rounded-md border font-semibold transition ${
              hoverMode === "nearest"
                ? "bg-teal-600 text-white border-teal-600"
                : "bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700"
            }`}
          >
            Satu Per Satu
          </button>
          <button
            type="button"
            onClick={() => setHoverMode("index")}
            className={`px-2.5 py-1 rounded-md border font-semibold transition ${
              hoverMode === "index"
                ? "bg-teal-600 text-white border-teal-600"
                : "bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700"
            }`}
          >
            Bandingkan Waktu
          </button>
        </div>
      </div>

      <div className={`${heightClass} w-full relative`}>
        {hasChartPoints ? (
          <Line data={chartData} options={options} />
        ) : (
          <div className="h-full w-full rounded-xl border border-dashed border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-900/30 flex flex-col items-center justify-center p-6 text-center">
            <div className="text-sm font-bold text-slate-600 dark:text-slate-300">
              Belum Ada Data Grafik Warehouse 7
            </div>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400 max-w-md">
              Data grafik line chart akan otomatis tampil dari tabel <span className="font-mono">warehouse_telemetry</span> (per jam) dan polling live API Warehouse 7 pada periode yang dipilih.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
