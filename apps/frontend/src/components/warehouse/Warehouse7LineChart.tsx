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
  const { t, language } = useTranslation();
  const [hoverMode, setHoverMode] = useState<"nearest" | "index">("nearest");
  const [xRange, setXRange] = useState<{ min: number; max: number } | null>(null);
  const [yRange, setYRange] = useState<{ min: number; max: number } | null>(null);
  const [customHeightPx, setCustomHeightPx] = useState<number>(defaultHeightPx);
  const [isZoomOpen, setIsZoomOpen] = useState(false);

  const inlineContainerRef = useRef<HTMLDivElement | null>(null);
  const inlineChartRef = useRef<ChartJS<"line"> | null>(null);
  const modalContainerRef = useRef<HTMLDivElement | null>(null);
  const modalChartRef = useRef<ChartJS<"line"> | null>(null);

  const xRangeRef = useRef(xRange);
  xRangeRef.current = xRange;
  const yRangeRef = useRef(yRange);
  yRangeRef.current = yRange;
  const autoYRef = useRef<{ min: number; max: number }>({ min: minTemp - 2, max: maxTemp + 2 });

  const totalPoints = trend?.timestamps?.length || 0;
  const minVisiblePoints = Math.min(Math.max(2, totalPoints), 8);

  // Reset X-zoom window when period filter or device selection changes
  useEffect(() => {
    setXRange(null);
  }, [trend?.filter, deviceMode]);

  // Clamp X-zoom if dataset size shrinks on refresh
  useEffect(() => {
    if (!xRange || totalPoints === 0) return;
    if (xRange.max > totalPoints || xRange.min >= totalPoints - 1) {
      setXRange(null);
    }
  }, [totalPoints, xRange]);

  // Close modal with ESC
  useEffect(() => {
    if (!isZoomOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setIsZoomOpen(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [isZoomOpen]);

  // Full chronological series + Y auto bounds
  const fullSeries = useMemo(() => {
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
        backgroundColor: "rgba(225, 29, 72, 0.14)",
        borderWidth: 3.8,
        tension: 0.25,
        fill: false,
        spanGaps: true,
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

    const lo = Math.min(...numericVals);
    const hi = Math.max(...numericVals);
    return {
      labels,
      datasets,
      autoYMin: Math.floor(lo - 1),
      autoYMax: Math.ceil(hi + 1)
    };
  }, [trend, deviceMode, minTemp, maxTemp, t]);

  // Slice visible X-axis window in-place so chart stays 100% fixed width without any horizontal scrollbar
  const { chartData, startIdx, endIdx, widthZoomPct } = useMemo(() => {
    const total = fullSeries.labels.length;
    let sIdx = 0;
    let eIdx = total;
    if (xRange && total > 0) {
      sIdx = Math.max(0, Math.min(Math.max(0, total - minVisiblePoints), Math.round(xRange.min)));
      eIdx = Math.min(total, Math.max(sIdx + minVisiblePoints, Math.round(xRange.max)));
    }
    const visibleCount = Math.max(1, eIdx - sIdx);
    const slicedLabels = fullSeries.labels.slice(sIdx, eIdx);
    const dotRadius = visibleCount <= 48 ? 6.2 : visibleCount <= 140 ? 5 : 4;

    const slicedDatasets = fullSeries.datasets.map((ds) => ({
      ...ds,
      data: Array.isArray(ds.data) ? ds.data.slice(sIdx, eIdx) : ds.data,
      sourceDevices: Array.isArray(ds.sourceDevices) ? ds.sourceDevices.slice(sIdx, eIdx) : ds.sourceDevices,
      humiData: Array.isArray(ds.humiData) ? ds.humiData.slice(sIdx, eIdx) : ds.humiData,
      pointBackgroundColor: Array.isArray(ds.pointBackgroundColor)
        ? ds.pointBackgroundColor.slice(sIdx, eIdx)
        : ds.pointBackgroundColor,
      pointRadius: dotRadius
    }));

    if (slicedLabels.length > 0) {
      slicedDatasets.push({
        label: `${t("warehouse7.tempMaxBadge", "Temp Max")} ${maxTemp}°C`,
        data: slicedLabels.map(() => maxTemp),
        borderColor: "rgba(239, 68, 68, 0.92)",
        borderDash: [7, 5],
        borderWidth: 2.2,
        pointRadius: 0,
        pointHoverRadius: 0,
        pointHitRadius: 0,
        fill: false,
        isThresholdLine: true
      });
      slicedDatasets.push({
        label: `${t("warehouse7.tempMinBadge", "Temp Min")} ${minTemp}°C`,
        data: slicedLabels.map(() => minTemp),
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

    const pct = total > 0 && xRange ? Math.max(100, Math.round((total / visibleCount) * 100)) : 100;
    return {
      chartData: { labels: slicedLabels, datasets: slicedDatasets },
      startIdx: sIdx,
      endIdx: eIdx,
      widthZoomPct: pct
    };
  }, [fullSeries, xRange, minVisiblePoints, maxTemp, minTemp, t]);

  const effectiveYMin = yRange ? yRange.min : fullSeries.autoYMin;
  const effectiveYMax = yRange ? yRange.max : fullSeries.autoYMax;
  autoYRef.current = { min: fullSeries.autoYMin, max: fullSeries.autoYMax };

  // Draw crisp inline pill badges ("Temp Max 30°C" & "Temp Min 24°C") pinned visibly inside left edge of chartArea
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

  // Attach interactive TradingView-style zoom & pan gestures directly on chart frame (zero horizontal scrollbars):
  // - Mouse wheel on body: widen/narrow X time window centered on cursor
  // - LMB drag on body: pan time horizontally (and Y vertically if Y-zoomed)
  // - Mouse wheel / LMB vertical drag on left Y-axis: adjust Y temperature height/scale
  const attachInteractiveGestures = useCallback(
    (container: HTMLDivElement | null, chartRef: React.MutableRefObject<ChartJS<"line"> | null>) => {
      if (!container || totalPoints <= 1) return undefined;

      let dragging = false;
      let mode: "body-pan" | "y-axis" | null = null;
      let startX = 0;
      let startY = 0;
      let initMinIdx = 0;
      let initMaxIdx = totalPoints;
      let initMinY = autoYRef.current.min;
      let initMaxY = autoYRef.current.max;

      const getMetrics = () => {
        const chart = chartRef.current;
        const canvas = chart?.canvas;
        const rect = canvas ? canvas.getBoundingClientRect() : container.getBoundingClientRect();
        const area = chart?.chartArea ?? {
          left: 58,
          right: rect.width - 16,
          top: 20,
          bottom: rect.height - 35,
          width: Math.max(40, rect.width - 74),
          height: Math.max(40, rect.height - 55)
        };
        return { chart, canvas, rect, area };
      };

      const onMouseMoveHover = (e: MouseEvent) => {
        if (dragging) return;
        const { canvas, rect, area } = getMetrics();
        if (!canvas) return;
        const mouseX = e.clientX - rect.left;
        if (mouseX < area.left) {
          canvas.style.cursor = "ns-resize";
          canvas.title =
            language === "en"
              ? "Scroll or drag vertically to scale temperature height"
              : "Scroll atau drag vertikal untuk mengatur tinggi skala suhu";
        } else {
          canvas.style.cursor = xRangeRef.current ? "grab" : "crosshair";
          canvas.title =
            language === "en"
              ? "Scroll to zoom time width · Drag to pan · Double-click to reset"
              : "Scroll untuk zoom lebar waktu · Drag untuk geser · Klik ganda untuk reset";
        }
      };

      const onWheel = (e: WheelEvent) => {
        e.preventDefault();
        e.stopPropagation();

        const { chart, rect, area } = getMetrics();
        const mouseX = e.clientX - rect.left;
        const isYAxisZone = mouseX < area.left;

        if (isYAxisZone) {
          setYRange((prevY) => {
            const curMin = prevY ? prevY.min : (chart?.scales?.y?.min ?? autoYRef.current.min);
            const curMax = prevY ? prevY.max : (chart?.scales?.y?.max ?? autoYRef.current.max);
            const span = Math.max(0.5, curMax - curMin);
            const mouseY = e.clientY - rect.top;
            const ratioY = Math.max(0, Math.min(1, (area.bottom - mouseY) / Math.max(1, area.height)));
            const anchor = curMin + ratioY * span;
            const factor = e.deltaY < 0 ? 0.85 : 1.18;
            const newSpan = Math.max(1, Math.min(60, span * factor));
            const nextMin = Number((anchor - ratioY * newSpan).toFixed(2));
            return { min: nextMin, max: Number((nextMin + newSpan).toFixed(2)) };
          });
          return;
        }

        setXRange((prev) => {
          const curMin = prev ? prev.min : 0;
          const curMax = prev ? prev.max : totalPoints;
          const curSpan = Math.max(minVisiblePoints, curMax - curMin);
          const factor = e.deltaY < 0 ? 0.8 : 1.25;
          const nextSpan = Math.max(minVisiblePoints, Math.min(totalPoints, curSpan * factor));
          if (nextSpan >= totalPoints - 0.5) return null;

          const plotWidth = Math.max(10, area.width);
          const ratioX = Math.max(0, Math.min(1, (mouseX - area.left) / plotWidth));
          const anchorIdx = curMin + ratioX * curSpan;

          let nextMin = anchorIdx - ratioX * nextSpan;
          let nextMax = nextMin + nextSpan;
          if (nextMin < 0) {
            nextMax = Math.min(totalPoints, nextMax - nextMin);
            nextMin = 0;
          }
          if (nextMax > totalPoints) {
            nextMin = Math.max(0, nextMin - (nextMax - totalPoints));
            nextMax = totalPoints;
          }
          return { min: nextMin, max: nextMax };
        });
      };

      const onMouseDown = (e: MouseEvent) => {
        if (e.button !== 0) return;
        const { chart, canvas, rect, area } = getMetrics();
        const mouseX = e.clientX - rect.left;
        const isYAxisZone = mouseX < area.left;

        dragging = true;
        mode = isYAxisZone ? "y-axis" : "body-pan";
        startX = e.clientX;
        startY = e.clientY;
        initMinIdx = xRangeRef.current ? xRangeRef.current.min : 0;
        initMaxIdx = xRangeRef.current ? xRangeRef.current.max : totalPoints;
        initMinY = yRangeRef.current ? yRangeRef.current.min : (chart?.scales?.y?.min ?? autoYRef.current.min);
        initMaxY = yRangeRef.current ? yRangeRef.current.max : (chart?.scales?.y?.max ?? autoYRef.current.max);

        if (canvas) {
          canvas.style.cursor = isYAxisZone ? "ns-resize" : "grabbing";
        }
      };

      const onWindowMouseMove = (e: MouseEvent) => {
        if (!dragging || !mode) return;
        const { rect, area } = getMetrics();
        const dx = e.clientX - startX;
        const dy = e.clientY - startY;

        if (mode === "y-axis") {
          const plotHeight = Math.max(20, area.height);
          const spanY = Math.max(0.5, initMaxY - initMinY);
          const factor = Math.exp((dy / Math.max(60, plotHeight)) * 1.5);
          const newSpan = Math.max(1, Math.min(60, spanY * factor));
          const initMouseY = startY - rect.top;
          const anchorRatio = Math.max(0, Math.min(1, (area.bottom - initMouseY) / plotHeight));
          const anchorVal = initMinY + anchorRatio * spanY;
          const nextMin = Number((anchorVal - anchorRatio * newSpan).toFixed(2));
          setYRange({ min: nextMin, max: Number((nextMin + newSpan).toFixed(2)) });
          return;
        }

        const spanIdx = initMaxIdx - initMinIdx;
        if (spanIdx < totalPoints) {
          const ptsPerPixel = spanIdx / Math.max(20, area.width);
          const shift = dx * ptsPerPixel;
          let nextMin = initMinIdx - shift;
          let nextMax = initMaxIdx - shift;
          if (nextMin < 0) {
            nextMax -= nextMin;
            nextMin = 0;
          }
          if (nextMax > totalPoints) {
            nextMin = Math.max(0, nextMin - (nextMax - totalPoints));
            nextMax = totalPoints;
          }
          setXRange({ min: nextMin, max: nextMax });
        }

        if (yRangeRef.current) {
          const spanY = initMaxY - initMinY;
          const shiftY = dy * (spanY / Math.max(20, area.height));
          setYRange({
            min: Number((initMinY + shiftY).toFixed(2)),
            max: Number((initMaxY + shiftY).toFixed(2))
          });
        }
      };

      const onWindowMouseUp = (e: MouseEvent) => {
        if (!dragging) return;
        dragging = false;
        mode = null;
        const { canvas, rect, area } = getMetrics();
        if (canvas) {
          const mouseX = e.clientX - rect.left;
          canvas.style.cursor = mouseX < area.left ? "ns-resize" : xRangeRef.current ? "grab" : "crosshair";
        }
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
    [totalPoints, minVisiblePoints, language]
  );

  useEffect(() => {
    return attachInteractiveGestures(inlineContainerRef.current, inlineChartRef);
  }, [attachInteractiveGestures]);

  useEffect(() => {
    if (!isZoomOpen) return;
    return attachInteractiveGestures(modalContainerRef.current, modalChartRef);
  }, [isZoomOpen, attachInteractiveGestures]);

  const options: ChartOptions<"line"> = useMemo(
    () => ({
      responsive: true,
      maintainAspectRatio: false,
      animation: { duration: 120 },
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
            maxTicksLimit: 12,
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
    [hoverMode, isDark, maxTemp, minTemp, effectiveYMax, effectiveYMin, t]
  );

  const hasChartPoints = Boolean(trend?.hasData && totalPoints > 0);
  const canZoomInX = hasChartPoints && endIdx - startIdx > minVisiblePoints;
  const canZoomOutX = Boolean(xRange);

  // Zoom time window X in/out inside the fixed 100% chart frame (anchored to most recent points / center)
  const adjustHorizontalZoom = (zoomIn: boolean) => {
    if (totalPoints <= minVisiblePoints) return;
    setXRange((prev) => {
      const curMin = prev ? prev.min : 0;
      const curMax = prev ? prev.max : totalPoints;
      const curSpan = Math.max(minVisiblePoints, curMax - curMin);
      const nextSpan = zoomIn ? curSpan * 0.72 : curSpan * 1.4;
      if (nextSpan >= totalPoints - 0.5) return null;

      const clampedSpan = Math.max(minVisiblePoints, nextSpan);
      // When zooming in from full view, focus toward latest data on right; when already zoomed, zoom around midpoint
      if (!prev && zoomIn) {
        return { min: Math.max(0, totalPoints - clampedSpan), max: totalPoints };
      }
      const center = (curMin + curMax) / 2;
      let nextMin = center - clampedSpan / 2;
      let nextMax = center + clampedSpan / 2;
      if (nextMin < 0) {
        nextMax = Math.min(totalPoints, nextMax - nextMin);
        nextMin = 0;
      }
      if (nextMax > totalPoints) {
        nextMin = Math.max(0, nextMin - (nextMax - totalPoints));
        nextMax = totalPoints;
      }
      return { min: nextMin, max: nextMax };
    });
  };

  const adjustHeight = (deltaPx: number) => {
    setCustomHeightPx((prev) => Math.max(280, Math.min(820, prev + deltaPx)));
  };

  const handleResetView = () => {
    setXRange(null);
    setYRange(null);
    setCustomHeightPx(defaultHeightPx);
  };

  const rangeBadge =
    chartData.labels.length > 0
      ? `${chartData.labels[0]} — ${chartData.labels[chartData.labels.length - 1]}`
      : null;

  const isViewModified = Boolean(xRange || yRange || customHeightPx !== defaultHeightPx);

  const renderSizeAndHoverControls = (inModal = false) => (
    <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
      {/* Horizontal Zoom (Perlebar), Height (Pertinggi), Pan & Reset controls */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="inline-flex items-center gap-1 rounded-lg border border-[#acd3ff] dark:border-slate-700 bg-[#f7fbff] dark:bg-slate-900 px-2 py-1">
          <span className="font-bold text-[#47729f] dark:text-slate-400 mr-1">
            {t("warehouse7.widthLabel", "Lebar:")}
          </span>
          <button
            type="button"
            onClick={() => adjustHorizontalZoom(false)}
            disabled={!canZoomOutX}
            className="px-2 py-0.5 rounded bg-white dark:bg-slate-800 border border-[#acd3ff] dark:border-slate-700 font-extrabold text-[#002b5c] dark:text-slate-200 hover:bg-[#1f6fb5] hover:text-white transition disabled:opacity-40 cursor-pointer"
          >
            −
          </button>
          <span className="min-w-[44px] text-center font-mono font-bold text-[#002b5c] dark:text-slate-200">
            {widthZoomPct}%
          </span>
          <button
            type="button"
            onClick={() => adjustHorizontalZoom(true)}
            disabled={!canZoomInX}
            className="px-2 py-0.5 rounded bg-white dark:bg-slate-800 border border-[#acd3ff] dark:border-slate-700 font-extrabold text-[#002b5c] dark:text-slate-200 hover:bg-[#1f6fb5] hover:text-white transition disabled:opacity-40 cursor-pointer"
          >
            +
          </button>
          {canZoomOutX && (
            <button
              type="button"
              onClick={() => setXRange(null)}
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

        {isViewModified && (
          <button
            type="button"
            onClick={handleResetView}
            className="px-2.5 py-1.5 rounded-lg border border-[#acd3ff] dark:border-slate-700 bg-white dark:bg-slate-900 text-[#1f6fb5] dark:text-sky-400 font-bold hover:bg-[#1f6fb5]/10 transition cursor-pointer"
          >
            ↺ {t("warehouse7.resetBtn", "Reset")}
          </button>
        )}

        {xRange && rangeBadge && (
          <span className="hidden sm:inline-flex items-center px-2 py-1 rounded-md bg-indigo-500/10 border border-indigo-500/20 text-indigo-600 dark:text-indigo-300 font-mono text-[11px] font-bold">
            {rangeBadge}
          </span>
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
          className="relative w-full overflow-hidden select-none transition-[height] duration-150"
          style={{ height: `${customHeightPx}px` }}
          onDoubleClick={handleResetView}
        >
          <Line ref={inlineChartRef} data={chartData} options={options} plugins={[thresholdBadgePlugin]} />
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

      {/* Expanded Fixed-Width Popup Modal (interactive wheel zoom + drag pan + vertical Y-scale) */}
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
                className="relative flex-1 min-h-0 w-full overflow-x-hidden overflow-y-auto scrollbar-thin select-none rounded-xl border border-[#acd3ff]/50 dark:border-slate-800 bg-[#f7fbff]/40 dark:bg-slate-900/20 p-3"
                onDoubleClick={handleResetView}
              >
                <div className="w-full" style={{ height: customHeightPx > defaultHeightPx ? `${Math.max(customHeightPx, 520)}px` : "100%", minHeight: "420px" }}>
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
