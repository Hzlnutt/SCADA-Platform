import { useMemo, useState } from "react";
import { Line } from "react-chartjs-2";
import type { ChartOptions } from "chart.js";
import "./chartjs_bridge";
import { useTranslation } from "../../i18n/useTranslation";

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
  "#0284c7", // High-contrast Sky Blue
  "#e11d48", // High-contrast Rose Red
  "#059669", // Emerald
  "#d97706", // Amber
  "#7c3aed", // Violet
  "#0891b2", // Cyan
  "#ec4899", // Pink
  "#2563eb"  // Blue
];

export default function Warehouse7LineChart({
  trend,
  deviceMode,
  isDark,
  minTemp,
  maxTemp,
  heightClass = "h-[400px]"
}: {
  trend: Warehouse7TrendPayload | null;
  deviceMode: string;
  isDark: boolean;
  minTemp: number;
  maxTemp: number;
  heightClass?: string;
}) {
  const { t } = useTranslation();
  const [hoverMode, setHoverMode] = useState<"nearest" | "index">("nearest");
  const [chartWidthMode, setChartWidthMode] = useState<"scroll" | "fit">("scroll");

  const pointCount = trend?.timestamps?.length || 0;
  const isDense = pointCount > 72;

  const { chartData, yMin, yMax } = useMemo(() => {
    const timestamps = trend?.timestamps || [];
    const labels = timestamps.map((tItem) => tItem.label);
    const tsKeys = timestamps.map((tItem) => tItem.ts);

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
        label: t("warehouse7.highestDeviceOption", "Highest Temperature Device"),
        data,
        sourceDevices: sources,
        borderColor: "#e11d48",
        backgroundColor: "rgba(225, 29, 72, 0.1)",
        borderWidth: 3,
        tension: 0.25,
        fill: false,
        spanGaps: true,
        pointRadius: data.length <= 72 ? 4 : 1.8,
        pointHoverRadius: 9,
        pointHoverBorderWidth: 3,
        pointHitRadius: 40,
        pointBackgroundColor: data.map((v) =>
          v !== null && (v > maxTemp || v < minTemp) ? "#dc2626" : "#e11d48"
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
          backgroundColor: `${color}18`,
          borderWidth: 2.8,
          tension: 0.25,
          fill: false,
          spanGaps: true,
          pointRadius: data.length <= 72 ? 4 : 1.8,
          pointHoverRadius: 9,
          pointHoverBorderWidth: 3,
          pointHitRadius: 40,
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
        label: `Temp ${t("warehouse7.maxLine", "Max")} (${maxTemp}°C)`,
        data: labels.map(() => maxTemp),
        borderColor: "rgba(239, 68, 68, 0.9)",
        borderDash: [7, 5],
        borderWidth: 2,
        pointRadius: 0,
        pointHoverRadius: 0,
        pointHitRadius: 0,
        fill: false,
        isThresholdLine: true
      });
      datasets.push({
        label: `Temp ${t("warehouse7.minLine", "Min")} (${minTemp}°C)`,
        data: labels.map(() => minTemp),
        borderColor: "rgba(31, 111, 181, 0.9)",
        borderDash: [7, 5],
        borderWidth: 2,
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
      yMin: Math.floor(lo - 1),
      yMax: Math.ceil(hi + 1)
    };
  }, [trend, deviceMode, minTemp, maxTemp, t]);

  const options: ChartOptions<"line"> = useMemo(
    () => ({
      responsive: true,
      maintainAspectRatio: false,
      animation: { duration: 180 },
      interaction: {
        mode: hoverMode,
        axis: hoverMode === "nearest" ? "xy" : "x",
        intersect: false
      },
      hover: {
        mode: hoverMode,
        intersect: false
      },
      plugins: {
        legend: {
          display: true,
          position: "bottom",
          labels: {
            color: isDark ? "#cbd5e1" : "#002b5c",
            usePointStyle: true,
            boxWidth: 10,
            padding: 16,
            font: { size: 13, weight: "bold" }
          }
        },
        tooltip: {
          enabled: true,
          mode: hoverMode,
          intersect: false,
          backgroundColor: isDark ? "rgba(15, 23, 42, 0.97)" : "rgba(255, 255, 255, 0.98)",
          titleColor: isDark ? "#f8fafc" : "#002b5c",
          bodyColor: isDark ? "#e2e8f0" : "#1e293b",
          borderColor: isDark ? "#38bdf8" : "#1f6fb5",
          borderWidth: 1.5,
          padding: 14,
          cornerRadius: 12,
          titleMarginBottom: 8,
          bodySpacing: 6,
          boxWidth: 12,
          boxHeight: 12,
          boxPadding: 6,
          titleFont: { size: 15, weight: "bold" },
          bodyFont: { size: 14, weight: "bold" },
          displayColors: true,
          filter: (tooltipItem) => {
            const ds = tooltipItem.dataset as any;
            return !ds.isThresholdLine;
          },
          callbacks: {
            title: (items) => {
              if (!items.length) return "";
              return `${t("warehouse7.timePrefix", "Waktu")}: ${items[0].label} WIB`;
            },
            label: (ctx) => {
              const ds = ctx.dataset as any;
              const val = ctx.parsed.y;
              if (val === null || val === undefined) return "";
              const idx = ctx.dataIndex;
              const sourceSuffix = ds.sourceDevices?.[idx] ? ` (${ds.sourceDevices[idx]})` : "";
              const humiVal = ds.humiData?.[idx];
              const humiText = humiVal !== null && humiVal !== undefined ? `  |  RH ${Number(humiVal).toFixed(1)}%` : "";
              let statusText = t("warehouse7.statusNormal", "Normal");
              if (val > maxTemp) statusText = `${t("warehouse7.statusHigh", "Melebihi Maks")} (${maxTemp}°C)`;
              else if (val < minTemp) statusText = `${t("warehouse7.statusLow", "Di Bawah Min")} (${minTemp}°C)`;
              return ` ${ds.label}${sourceSuffix}: ${Number(val).toFixed(1)} °C${humiText} · ${statusText}`;
            }
          }
        }
      },
      scales: {
        x: {
          grid: {
            color: isDark ? "rgba(148, 163, 184, 0.1)" : "rgba(172, 211, 255, 0.3)"
          },
          ticks: {
            color: isDark ? "#94a3b8" : "#47729f",
            maxTicksLimit: isDense && chartWidthMode === "scroll" ? 30 : 12,
            maxRotation: 0,
            autoSkip: true,
            font: { size: 12, weight: "bold" }
          }
        },
        y: {
          min: yMin,
          max: yMax,
          title: {
            display: true,
            text: t("warehouse7.tempAxis", "Suhu (°C)"),
            color: isDark ? "#cbd5e1" : "#002b5c",
            font: { size: 13, weight: "bold" }
          },
          grid: {
            color: isDark ? "rgba(148, 163, 184, 0.14)" : "rgba(172, 211, 255, 0.35)"
          },
          ticks: {
            stepSize: 1,
            color: isDark ? "#94a3b8" : "#47729f",
            font: { size: 12, weight: "bold" },
            callback: (v) => `${v}°C`
          }
        }
      }
    }),
    [hoverMode, isDark, maxTemp, minTemp, yMax, yMin, t, isDense, chartWidthMode]
  );

  const hasChartPoints = Boolean(trend?.hasData && pointCount > 0);
  const dynamicCanvasStyle =
    isDense && chartWidthMode === "scroll"
      ? { minWidth: `${Math.min(3200, Math.max(1100, Math.round(pointCount * 3.6)))}px` }
      : undefined;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
        <div className="flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-md border border-rose-200 dark:border-rose-900/50 bg-rose-50 dark:bg-rose-950/30 text-rose-700 dark:text-rose-300 font-bold">
            <span className="w-3.5 border-t-2 border-dashed border-rose-500 inline-block" />
            Max: {maxTemp}°C
          </span>
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-md border border-[#acd3ff] dark:border-sky-900/50 bg-[#e8f3ff] dark:bg-sky-950/30 text-[#1f6fb5] dark:text-sky-300 font-bold">
            <span className="w-3.5 border-t-2 border-dashed border-[#1f6fb5] inline-block" />
            Min: {minTemp}°C
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {isDense && (
            <div className="flex items-center gap-1.5">
              <span className="text-[#47729f] dark:text-slate-400 font-bold">
                {t("warehouse7.chartZoomLabel", "Tampilan:")}
              </span>
              <button
                type="button"
                onClick={() => setChartWidthMode("scroll")}
                className={`px-3 py-1.5 rounded-lg border text-xs font-bold transition cursor-pointer ${
                  chartWidthMode === "scroll"
                    ? "bg-[#1f6fb5] text-white border-[#1f6fb5] shadow-sm"
                    : "bg-white dark:bg-slate-900 text-[#47729f] dark:text-slate-300 border-[#acd3ff] dark:border-slate-700 hover:bg-[#1f6fb5]/10"
                }`}
              >
                {t("warehouse7.chartAutoWide", "Perbesar (Scroll)")}
              </button>
              <button
                type="button"
                onClick={() => setChartWidthMode("fit")}
                className={`px-3 py-1.5 rounded-lg border text-xs font-bold transition cursor-pointer ${
                  chartWidthMode === "fit"
                    ? "bg-[#1f6fb5] text-white border-[#1f6fb5] shadow-sm"
                    : "bg-white dark:bg-slate-900 text-[#47729f] dark:text-slate-300 border-[#acd3ff] dark:border-slate-700 hover:bg-[#1f6fb5]/10"
                }`}
              >
                {t("warehouse7.chartFitScreen", "Pas Layar")}
              </button>
            </div>
          )}

          <div className="flex items-center gap-1.5">
            <span className="text-[#47729f] dark:text-slate-400 font-bold">
              {t("warehouse7.hoverModeLabel", "Hover:")}
            </span>
            <button
              type="button"
              onClick={() => setHoverMode("nearest")}
              className={`px-3 py-1.5 rounded-lg border text-xs font-bold transition cursor-pointer ${
                hoverMode === "nearest"
                  ? "bg-[#1f6fb5] text-white border-[#1f6fb5] shadow-sm"
                  : "bg-white dark:bg-slate-900 text-[#47729f] dark:text-slate-300 border-[#acd3ff] dark:border-slate-700 hover:bg-[#1f6fb5]/10"
              }`}
            >
              {t("warehouse7.hoverNearest", "Satu Per Satu")}
            </button>
            <button
              type="button"
              onClick={() => setHoverMode("index")}
              className={`px-3 py-1.5 rounded-lg border text-xs font-bold transition cursor-pointer ${
                hoverMode === "index"
                  ? "bg-[#1f6fb5] text-white border-[#1f6fb5] shadow-sm"
                  : "bg-white dark:bg-slate-900 text-[#47729f] dark:text-slate-300 border-[#acd3ff] dark:border-slate-700 hover:bg-[#1f6fb5]/10"
              }`}
            >
              {t("warehouse7.hoverCompare", "Bandingkan Waktu")}
            </button>
          </div>
        </div>
      </div>

      {hasChartPoints ? (
        <div className="overflow-x-auto scrollbar-thin pb-2">
          <div className={`${heightClass} w-full relative`} style={dynamicCanvasStyle}>
            <Line data={chartData} options={options} />
          </div>
        </div>
      ) : (
        <div className={`${heightClass} w-full rounded-xl border border-dashed border-[#acd3ff] dark:border-slate-800 bg-slate-50/60 dark:bg-slate-900/30 flex flex-col items-center justify-center p-6 text-center`}>
          <div className="text-base font-bold text-[#002b5c] dark:text-slate-300">
            {t("warehouse7.noChartTitle", "Belum Ada Data Grafik")}
          </div>
          <p className="mt-1 text-sm text-[#47729f] dark:text-slate-400 max-w-md">
            {t("warehouse7.noChartDesc", "Menunggu data suhu per jam dari database.")}
          </p>
        </div>
      )}
    </div>
  );
}
