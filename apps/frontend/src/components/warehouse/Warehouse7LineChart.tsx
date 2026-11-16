import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Line } from "react-chartjs-2";
import type { Chart as ChartJS, ChartOptions, Plugin } from "chart.js";
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

function drawRoundedPill(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
) {
  ctx.beginPath();
  if (typeof ctx.roundRect === "function") {
    ctx.roundRect(x, y, w, h, r);
  } else {
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r);
    ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
  }
}

export default function Warehouse7LineChart({
  trend,
  deviceMode,
  isDark,
  minTemp,
  maxTemp,
  defaultHeightPx = 400
}: {
  trend: Warehouse7TrendPayload | null;
  deviceMode: string;
  isDark: boolean;
  minTemp: number;
  maxTemp: number;
  defaultHeightPx?: number;
}) {
  const { t } = useTranslation();
  const [hoverMode, setHoverMode] = useState<"nearest" | "index">("nearest");
  const [customWidthPct, setCustomWidthPct] = useState<number | null>(null);
  const [customHeightPx, setCustomHeightPx] = useState<number>(defaultHeightPx);
  const [customYRange, setCustomYRange] = useState<{ min: number; max: number } | null>(null);
  const [isZoomOpen, setIsZoomOpen] = useState(false);

  const inlineContainerRef = useRef<HTMLDivElement | null>(null);
  const inlineChartRef = useRef<ChartJS<"line"> | null>(null);
  const modalContainerRef = useRef<HTMLDivElement | null>(null);
  const modalChartRef = useRef<ChartJS<"line"> | null>(null);

  const pointCount = trend?.timestamps?.length || 0;
  const effectiveWidthPct = customWidthPct ?? (pointCount > 240 ? 240 : pointCount > 72 ? 150 : 100);

  // Close modal with ESC
  useEffect(() => {
    if (!isZoomOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setIsZoomOpen(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [isZoomOpen]);

  const { chartData, autoYMin, autoYMax } = useMemo(() => {
    const timestamps = trend?.timestamps || [];
    const labels = timestamps.map((tItem) => tItem.label);
    const tsKeys = timestamps.map((tItem) => tItem.ts);

    const datasets: any[] = [];
    const numericVals: number[] = [minTemp, maxTemp];

    const dotRadius =
      pointCount <= 72 ? 6 : pointCount <= 250 ? 5 : 4.2;

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
        backgroundColor: "rgba(225, 29, 72, 0.14)",
        borderWidth: 3.8,
        tension: 0.25,
        fill: false,
        spanGaps: true,
        pointRadius: dotRadius,
        pointHoverRadius: 10,
        pointHoverBorderWidth: 3,
        pointHitRadius: 40,
        pointBackgroundColor: data.map((v) =>
          v !== null && (v > maxTemp || v < minTemp) ? "#dc2626" : "#e11d48"
        ),
        pointBorderColor: "#ffffff",
        pointBorderWidth: 2
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
          borderWidth: 3.5,
          tension: 0.25,
          fill: false,
          spanGaps: true,
          pointRadius: dotRadius,
          pointHoverRadius: 10,
          pointHoverBorderWidth: 3,
          pointHitRadius: 40,
          pointBackgroundColor: data.map((v) =>
            v !== null && (v > maxTemp || v < minTemp) ? "#dc2626" : color
          ),
          pointBorderColor: "#ffffff",
          pointBorderWidth: 2
        });
      });
    }

    if (labels.length > 0) {
      datasets.push({
        label: `${t("warehouse7.tempMaxBadge", "Temp Max")} ${maxTemp}°C`,
        data: labels.map(() => maxTemp),
        borderColor: "rgba(239, 68, 68, 0.92)",
        borderDash: [7, 5],
        borderWidth: 2.2,
        pointRadius: 0,
        pointHoverRadius: 0,
        pointHitRadius: 0,
        fill: false,
        isThresholdLine: true
      });
      datasets.push({
        label: `${t("warehouse7.tempMinBadge", "Temp Min")} ${minTemp}°C`,
        data: labels.map(() => minTemp),
        borderColor: "rgba(59, 130, 246, 0.92)",
        borderDash: [7, 5],
        borderWidth: 2.2,
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
      autoYMin: Math.floor(lo - 1),
      autoYMax: Math.ceil(hi + 1)
    };
  }, [trend, deviceMode, minTemp, maxTemp, t, pointCount]);

  const effectiveYMin = customYRange ? customYRange.min : autoYMin;
  const effectiveYMax = customYRange ? customYRange.max : autoYMax;

  // Plugin drawing crisp inline pill badges ("Temp Max 30°C" & "Temp Min 24°C") directly on threshold lines
  const thresholdBadgePlugin: Plugin<"line"> = useMemo(() => {
    const maxText = `${t("warehouse7.tempMaxBadge", "Temp Max")} ${maxTemp}°C`;
    const minText = `${t("warehouse7.tempMinBadge", "Temp Min")} ${minTemp}°C`;

    return {
      id: "wh7ThresholdBadges",
      afterDatasetsDraw(chart) {
        const yScale = chart.scales?.y;
        const area = chart.chartArea;
        if (!yScale || !area || chart.data.labels?.length === 0) return;

        const ctx = chart.ctx;
        ctx.save();
        ctx.font = "bold 12px 'Plus Jakarta Sans', system-ui, sans-serif";
        ctx.textAlign = "left";
        ctx.textBaseline = "middle";

        const badges = [
          { val: maxTemp, label: maxText, bg: "#ef4444" },
          { val: minTemp, label: minText, bg: "#3b82f6" }
        ];

        for (const b of badges) {
          const yPx = yScale.getPixelForValue(b.val);
          if (!Number.isFinite(yPx) || yPx < area.top - 12 || yPx > area.bottom + 12) continue;

          const padX = 10;
          const badgeH = 24;
          const textW = ctx.measureText(b.label).width;
          const badgeW = textW + padX * 2;
          const x = area.left + 12;
          const y = Math.max(area.top + 2, Math.min(area.bottom - badgeH - 2, yPx - badgeH / 2));

          ctx.fillStyle = b.bg;
          drawRoundedPill(ctx, x, y, badgeW, badgeH, 6);
          ctx.fill();

          ctx.fillStyle = "#ffffff";
          ctx.fillText(b.label, x + padX, y + badgeH / 2 + 0.5);
        }

        ctx.restore();
      }
    };
  }, [maxTemp, minTemp, t]);

  // Attach left-Y-axis vertical scale adjust (wheel + vertical drag) matching Polling 3s Y-axis height behavior
  const attachYAxisHeightGestures = useCallback(
    (container: HTMLDivElement | null, chartRef: React.MutableRefObject<ChartJS<"line"> | null>) => {
      if (!container) return undefined;
      let dragging = false;
      let startY = 0;
      let initMin = effectiveYMin;
      let initMax = effectiveYMax;

      const onMouseMoveHover = (e: MouseEvent) => {
        if (dragging) return;
        const chart = chartRef.current;
        const canvas = chart?.canvas;
        if (!chart || !canvas || !chart.chartArea) return;
        const rect = canvas.getBoundingClientRect();
        const mouseX = e.clientX - rect.left;
        canvas.style.cursor = mouseX < chart.chartArea.left ? "ns-resize" : "crosshair";
      };

      const onWheel = (e: WheelEvent) => {
        const chart = chartRef.current;
        if (!chart || !chart.chartArea) return;
        const rect = chart.canvas.getBoundingClientRect();
        const mouseX = e.clientX - rect.left;
        if (mouseX >= chart.chartArea.left) return;

        e.preventDefault();
        e.stopPropagation();

        setCustomYRange((prev) => {
          const curMin = prev ? prev.min : chart.scales.y.min;
          const curMax = prev ? prev.max : chart.scales.y.max;
          const span = Math.max(0.5, curMax - curMin);
          const mouseY = e.clientY - rect.top;
          const ratioY = Math.max(0, Math.min(1, (chart.chartArea.bottom - mouseY) / Math.max(1, chart.chartArea.height)));
          const anchor = curMin + ratioY * span;
          const factor = e.deltaY < 0 ? 0.85 : 1.18;
          const newSpan = Math.max(1, Math.min(60, span * factor));
          const nextMin = Number((anchor - ratioY * newSpan).toFixed(2));
          return { min: nextMin, max: Number((nextMin + newSpan).toFixed(2)) };
        });
      };

      const onMouseDown = (e: MouseEvent) => {
        if (e.button !== 0) return;
        const chart = chartRef.current;
        if (!chart || !chart.chartArea) return;
        const rect = chart.canvas.getBoundingClientRect();
        const mouseX = e.clientX - rect.left;
        if (mouseX >= chart.chartArea.left) return;

        dragging = true;
        startY = e.clientY;
        initMin = customYRange ? customYRange.min : chart.scales.y.min;
        initMax = customYRange ? customYRange.max : chart.scales.y.max;
        chart.canvas.style.cursor = "ns-resize";
      };

      const onWindowMouseMove = (e: MouseEvent) => {
        if (!dragging) return;
        const chart = chartRef.current;
        const plotHeight = chart?.chartArea?.height || 300;
        const dy = e.clientY - startY;
        const span = Math.max(0.5, initMax - initMin);
        const factor = Math.exp((dy / Math.max(60, plotHeight)) * 1.5);
        const newSpan = Math.max(1, Math.min(60, span * factor));
        const mid = (initMin + initMax) / 2;
        setCustomYRange({
          min: Number((mid - newSpan / 2).toFixed(2)),
          max: Number((mid + newSpan / 2).toFixed(2))
        });
      };

      const onWindowMouseUp = () => {
        dragging = false;
      };

      container.addEventListener("mousemove", onMouseMoveHover);
      container.addEventListener("wheel", onWheel, { passive: false });
      container.addEventListener("mousedown", onMouseDown);
      window.addEventListener("mousemove", onWindowMouseMove);
      window.addEventListener("mouseup", onWindowMouseUp);

      return () => {
        container.removeEventListener("mousemove", onMouseMoveHover);
        container.removeEventListener("wheel", onWheel);
        container.removeEventListener("mousedown", onMouseDown);
        window.removeEventListener("mousemove", onWindowMouseMove);
        window.removeEventListener("mouseup", onWindowMouseUp);
      };
    },
    [customYRange, effectiveYMin, effectiveYMax]
  );

  useEffect(() => {
    return attachYAxisHeightGestures(inlineContainerRef.current, inlineChartRef);
  }, [attachYAxisHeightGestures]);

  useEffect(() => {
    if (!isZoomOpen) return;
    return attachYAxisHeightGestures(modalContainerRef.current, modalChartRef);
  }, [isZoomOpen, attachYAxisHeightGestures]);

  const options: ChartOptions<"line"> = useMemo(
    () => ({
      responsive: true,
      maintainAspectRatio: false,
      animation: { duration: 150 },
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
            boxWidth: 11,
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
            maxTicksLimit: effectiveWidthPct > 140 ? 28 : 12,
            maxRotation: 0,
            autoSkip: true,
            font: { size: 12, weight: "bold" }
          }
        },
        y: {
          min: effectiveYMin,
          max: effectiveYMax,
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
            stepSize: effectiveYMax - effectiveYMin <= 16 ? 1 : 2,
            color: isDark ? "#94a3b8" : "#47729f",
            font: { size: 12, weight: "bold" },
            callback: (v) => `${v}°C`
          }
        }
      }
    }),
    [hoverMode, isDark, maxTemp, minTemp, effectiveYMax, effectiveYMin, t, effectiveWidthPct]
  );

  const hasChartPoints = Boolean(trend?.hasData && pointCount > 0);

  const adjustWidth = (deltaPct: number) => {
    const next = Math.max(100, Math.min(400, effectiveWidthPct + deltaPct));
    setCustomWidthPct(next);
  };

  const adjustHeight = (deltaPx: number) => {
    setCustomHeightPx((prev) => Math.max(280, Math.min(820, prev + deltaPx)));
  };

  const handleResetDimensions = () => {
    setCustomWidthPct(null);
    setCustomHeightPx(defaultHeightPx);
    setCustomYRange(null);
  };

  const renderSizeAndHoverControls = (inModal = false) => (
    <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
      {/* Width & Height adjustment controls */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="inline-flex items-center gap-1 rounded-lg border border-[#acd3ff] dark:border-slate-700 bg-[#f7fbff] dark:bg-slate-900 px-2 py-1">
          <span className="font-bold text-[#47729f] dark:text-slate-400 mr-1">
            {t("warehouse7.widthLabel", "Lebar:")}
          </span>
          <button
            type="button"
            onClick={() => adjustWidth(-40)}
            disabled={effectiveWidthPct <= 100}
            className="px-2 py-0.5 rounded bg-white dark:bg-slate-800 border border-[#acd3ff] dark:border-slate-700 font-extrabold text-[#002b5c] dark:text-slate-200 hover:bg-[#1f6fb5] hover:text-white transition disabled:opacity-40 cursor-pointer"
          >
            −
          </button>
          <span className="min-w-[44px] text-center font-mono font-bold text-[#002b5c] dark:text-slate-200">
            {effectiveWidthPct}%
          </span>
          <button
            type="button"
            onClick={() => adjustWidth(40)}
            disabled={effectiveWidthPct >= 400}
            className="px-2 py-0.5 rounded bg-white dark:bg-slate-800 border border-[#acd3ff] dark:border-slate-700 font-extrabold text-[#002b5c] dark:text-slate-200 hover:bg-[#1f6fb5] hover:text-white transition disabled:opacity-40 cursor-pointer"
          >
            +
          </button>
          {effectiveWidthPct !== 100 && (
            <button
              type="button"
              onClick={() => setCustomWidthPct(100)}
              className="ml-1 px-2 py-0.5 rounded text-[11px] font-bold text-[#1f6fb5] dark:text-sky-400 hover:bg-[#1f6fb5]/10 cursor-pointer"
            >
              {t("warehouse7.fitWidth", "Pas")}
            </button>
          )}
        </div>

        <div className="inline-flex items-center gap-1 rounded-lg border border-[#acd3ff] dark:border-slate-700 bg-[#f7fbff] dark:bg-slate-900 px-2 py-1">
          <span className="font-bold text-[#47729f] dark:text-slate-400 mr-1">
            {t("warehouse7.heightLabel", "Tinggi:")}
          </span>
          <button
            type="button"
            onClick={() => adjustHeight(-80)}
            disabled={customHeightPx <= 280}
            className="px-2 py-0.5 rounded bg-white dark:bg-slate-800 border border-[#acd3ff] dark:border-slate-700 font-extrabold text-[#002b5c] dark:text-slate-200 hover:bg-[#1f6fb5] hover:text-white transition disabled:opacity-40 cursor-pointer"
          >
            −
          </button>
          <span className="min-w-[48px] text-center font-mono font-bold text-[#002b5c] dark:text-slate-200">
            {customHeightPx}px
          </span>
          <button
            type="button"
            onClick={() => adjustHeight(80)}
            disabled={customHeightPx >= 820}
            className="px-2 py-0.5 rounded bg-white dark:bg-slate-800 border border-[#acd3ff] dark:border-slate-700 font-extrabold text-[#002b5c] dark:text-slate-200 hover:bg-[#1f6fb5] hover:text-white transition disabled:opacity-40 cursor-pointer"
          >
            +
          </button>
        </div>

        {(customWidthPct !== null || customHeightPx !== defaultHeightPx || customYRange !== null) && (
          <button
            type="button"
            onClick={handleResetDimensions}
            className="px-2.5 py-1.5 rounded-lg border border-[#acd3ff] dark:border-slate-700 bg-white dark:bg-slate-900 text-[#1f6fb5] dark:text-sky-400 font-bold hover:bg-[#1f6fb5]/10 transition cursor-pointer"
          >
            ↺ {t("warehouse7.resetBtn", "Reset")}
          </button>
        )}
      </div>

      {/* Hover mode & Expand modal trigger */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-1">
          <span className="text-[#47729f] dark:text-slate-400 font-bold mr-0.5">
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

        {!inModal && (
          <button
            type="button"
            onClick={() => setIsZoomOpen(true)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[#acd3ff] dark:border-sky-800 bg-[#e8f3ff] dark:bg-sky-950/40 text-[#1f6fb5] dark:text-sky-300 text-xs font-bold hover:bg-[#d8ebff] transition cursor-pointer"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.2">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M3.75 3.75v4.5m0-4.5h4.5m-4.5 0L9 9M3.75 20.25v-4.5m0 4.5h4.5m-4.5 0L9 15M20.25 3.75h-4.5m4.5 0v4.5m0-4.5L15 9m5.25 11.25h-4.5m4.5 0v-4.5m0 4.5L15 15"
              />
            </svg>
            <span>{t("warehouse7.expandBtn", "Perbesar")}</span>
          </button>
        )}
      </div>
    </div>
  );

  return (
    <div className="space-y-3">
      {renderSizeAndHoverControls(false)}

      {hasChartPoints ? (
        <div
          ref={inlineContainerRef}
          className="overflow-x-auto scrollbar-thin pb-2"
          onDoubleClick={handleResetDimensions}
        >
          <div
            className="relative transition-[height] duration-150"
            style={{
              width: effectiveWidthPct > 100 ? `${effectiveWidthPct}%` : "100%",
              height: `${customHeightPx}px`
            }}
          >
            <Line ref={inlineChartRef} data={chartData} options={options} plugins={[thresholdBadgePlugin]} />
          </div>
        </div>
      ) : (
        <div
          className="w-full rounded-xl border border-dashed border-[#acd3ff] dark:border-slate-800 bg-slate-50/60 dark:bg-slate-900/30 flex flex-col items-center justify-center p-6 text-center"
          style={{ height: `${customHeightPx}px` }}
        >
          <div className="text-base font-bold text-[#002b5c] dark:text-slate-300">
            {t("warehouse7.noChartTitle", "Belum Ada Data Grafik")}
          </div>
          <p className="mt-1 text-sm text-[#47729f] dark:text-slate-400 max-w-md">
            {t("warehouse7.noChartDesc", "Menunggu data suhu per jam dari database.")}
          </p>
        </div>
      )}

      {/* Expanded Width/Height Popup Modal (from Polling 3s enlarge pattern) */}
      {isZoomOpen &&
        typeof document !== "undefined" &&
        createPortal(
          <div
            className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-sm p-3 sm:p-6"
            onClick={() => setIsZoomOpen(false)}
          >
            <div
              className="bg-white dark:bg-slate-950 border border-[#acd3ff] dark:border-slate-800 rounded-2xl shadow-2xl flex flex-col gap-3 overflow-hidden p-4 sm:p-6"
              style={{ width: "95vw", maxWidth: "1560px", height: "88vh", maxHeight: "90vh" }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#acd3ff]/40 dark:border-slate-800 pb-3">
                <h3 className="text-base sm:text-lg font-extrabold text-[#002b5c] dark:text-slate-100 uppercase tracking-wide">
                  {t("warehouse7.dailyTrendTitle", "Tren Suhu Harian")}
                </h3>
                <button
                  type="button"
                  onClick={() => setIsZoomOpen(false)}
                  className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-sm font-bold text-white bg-rose-600 hover:bg-rose-700 rounded-xl shadow-sm transition cursor-pointer"
                >
                  <span>{t("warehouse7.closeBtn", "Tutup")}</span>
                  <span>✕</span>
                </button>
              </div>

              {renderSizeAndHoverControls(true)}

              <div
                ref={modalContainerRef}
                className="flex-1 min-h-0 overflow-x-auto overflow-y-auto scrollbar-thin rounded-xl border border-[#acd3ff]/50 dark:border-slate-800 bg-[#f7fbff]/40 dark:bg-slate-900/20 p-3"
                onDoubleClick={handleResetDimensions}
              >
                <div
                  className="relative"
                  style={{
                    width: effectiveWidthPct > 100 ? `${effectiveWidthPct}%` : "100%",
                    height: `${Math.max(customHeightPx, 480)}px`
                  }}
                >
                  <Line ref={modalChartRef} data={chartData} options={options} plugins={[thresholdBadgePlugin]} />
                </div>
              </div>
            </div>
          </div>,
          document.body
        )}
    </div>
  );
}
