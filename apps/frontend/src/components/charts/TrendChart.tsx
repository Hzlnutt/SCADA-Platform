import { useState, useRef } from "react";
import { useTimeRangeStore } from "../../store/timeRange.store";

type TrendPoint = {
  ts: string | Date;
  value: number | string | boolean;
};

type TrendChartProps = {
  points: TrendPoint[];
  unit?: string;
  heightClassName?: string;
  minThreshold?: number;
  maxThreshold?: number;
};

const rangePoints: Record<string, number> = {
  "5m": 8,
  "1h": 12,
  "1d": 24,
  "1w": 7,
  "1m": 30,
  "1y": 12
};

const toNumericPoints = (points: TrendPoint[]) =>
  points
    .map((point) => ({
      ts: typeof point.ts === "string" ? point.ts : point.ts.toISOString(),
      value: typeof point.value === "number" ? point.value : Number.NaN
    }))
    .filter((point) => Number.isFinite(point.value));

const formatNumber = (value: number, unit?: string) => {
  return `${value.toFixed(2)}${unit ? ` ${unit}` : ""}`;
};

export const TrendChart = ({
  points,
  unit,
  heightClassName = "h-56",
  minThreshold,
  maxThreshold
}: TrendChartProps) => {
  const activeRange = useTimeRangeStore((state) => state.range);
  const limit = rangePoints[activeRange] ?? points.length;
  const numericPoints = toNumericPoints(points).slice(-limit);
  const containerRef = useRef<HTMLDivElement>(null);

  const [hoverData, setHoverData] = useState<{
    index: number;
    x: number;
    y: number;
    px: number;
    py: number;
  } | null>(null);

  if (numericPoints.length < 2) {
    return (
      <div
        className={`${heightClassName} flex items-center justify-center rounded-lg border border-dashed border-[#acd3ff] dark:border-slate-700 bg-[#f7fbff] dark:bg-slate-900/40 text-sm text-[#47729f] dark:text-slate-400`}
      >
        Waiting for numeric trend data
      </div>
    );
  }

  const values = numericPoints.map((point) => point.value);
  let min = Math.min(...values);
  let max = Math.max(...values);
  if (minThreshold !== undefined && minThreshold !== null) {
    min = Math.min(min, minThreshold);
  }
  if (maxThreshold !== undefined && maxThreshold !== null) {
    max = Math.max(max, maxThreshold);
  }
  const range = max - min || 1;
  const width = 640;
  const height = 220;
  const paddingX = 18;
  const paddingY = 24;
  const plotWidth = width - paddingX * 2;
  const plotHeight = height - paddingY * 2;

  const pathPoints = numericPoints
    .map((point, index) => {
      const x =
        paddingX +
        (index / Math.max(numericPoints.length - 1, 1)) * plotWidth;
      const y = paddingY + (1 - (point.value - min) / range) * plotHeight;
      return `${x.toFixed(2)},${y.toFixed(2)}`;
    })
    .join(" ");

  const latest = numericPoints[numericPoints.length - 1];
  const firstTs = new Date(numericPoints[0].ts).toLocaleTimeString();
  const lastTs = new Date(latest.ts).toLocaleTimeString();

  const handleMouseMove = (event: React.MouseEvent<SVGSVGElement, MouseEvent>) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    
    // Calculate relative mouse position in container coords
    const mouseX = event.clientX - rect.left;
    const mouseY = event.clientY - rect.top;
    
    // Convert relative X coordinate back to index in series
    const plotLeft = (paddingX / width) * rect.width;
    const plotRight = ((width - paddingX) / width) * rect.width;
    const activePlotWidth = plotRight - plotLeft;
    
    const percentage = Math.max(0, Math.min(1, (mouseX - plotLeft) / activePlotWidth));
    const index = Math.round(percentage * (numericPoints.length - 1));
    
    const point = numericPoints[index];
    if (point) {
      const x = paddingX + (index / Math.max(numericPoints.length - 1, 1)) * plotWidth;
      const y = paddingY + (1 - (point.value - min) / range) * plotHeight;
      setHoverData({ index, x, y, px: mouseX, py: mouseY });
    }
  };

  const handleMouseLeave = () => {
    setHoverData(null);
  };

  // Threshold Y coordinate calculations helper
  const getThresholdY = (val: number) => {
    return paddingY + (1 - (val - min) / range) * plotHeight;
  };

  const isWithinBounds = (val?: number) => {
    if (val === undefined) return false;
    return val >= min && val <= max;
  };

  return (
    <div ref={containerRef} className={`${heightClassName} min-h-0 relative`}>
      <div className="mb-3 flex items-center justify-between gap-3 text-xs text-[#47729f] dark:text-slate-400">
        <span>{firstTs}</span>
        <span className="font-mono text-[#002b5c] dark:text-slate-200">
          {formatNumber(latest.value, unit)}
        </span>
        <span>{lastTs}</span>
      </div>
      <svg
        viewBox={`0 0 ${width} ${height}`}
        role="img"
        aria-label="Telemetry trend"
        className="h-[calc(100%-1.75rem)] w-full overflow-visible select-none cursor-crosshair"
        preserveAspectRatio="none"
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
      >
        {[0.25, 0.5, 0.75].map((line) => (
          <line
            key={line}
            x1={paddingX}
            x2={width - paddingX}
            y1={paddingY + line * plotHeight}
            y2={paddingY + line * plotHeight}
            stroke="rgba(172,211,255,0.3)"
            strokeWidth="1"
          />
        ))}

        {/* Min Threshold dashed line (Blue) */}
        {isWithinBounds(minThreshold) && (
          <line
            x1={paddingX}
            x2={width - paddingX}
            y1={getThresholdY(minThreshold!)}
            y2={getThresholdY(minThreshold!)}
            stroke="#3b82f6"
            strokeDasharray="6 4"
            strokeWidth="1.5"
            vectorEffect="non-scaling-stroke"
          />
        )}

        {/* Max Threshold dashed line (Red) */}
        {isWithinBounds(maxThreshold) && (
          <line
            x1={paddingX}
            x2={width - paddingX}
            y1={getThresholdY(maxThreshold!)}
            y2={getThresholdY(maxThreshold!)}
            stroke="#ef4444"
            strokeDasharray="6 4"
            strokeWidth="1.5"
            vectorEffect="non-scaling-stroke"
          />
        )}

        <polyline
          points={pathPoints}
          fill="none"
          stroke="#1f6fb5"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="3"
          vectorEffect="non-scaling-stroke"
        />

        {/* Dynamic Hover indicator line */}
        {hoverData && (
          <line
            x1={hoverData.x}
            x2={hoverData.x}
            y1={paddingY}
            y2={height - paddingY}
            stroke="rgba(71, 114, 159, 0.5)"
            strokeDasharray="3 3"
            strokeWidth="1"
          />
        )}

        {/* End value dot or hovered dot */}
        <circle
          cx={hoverData ? hoverData.x : paddingX + ((numericPoints.length - 1) / Math.max(numericPoints.length - 1, 1)) * plotWidth}
          cy={hoverData ? hoverData.y : paddingY + (1 - (latest.value - min) / range) * plotHeight}
          r="5"
          fill={hoverData ? "#1f6fb5" : "#a44925"}
          stroke={hoverData ? "#ffffff" : "transparent"}
          strokeWidth="1.5"
        />
      </svg>

      {/* Floating Tooltip HTML Div */}
      {hoverData && (
        <div
          className="absolute z-50 pointer-events-none rounded-lg border border-slate-700 bg-slate-950/95 p-2 text-[10px] font-mono text-slate-200 shadow-xl"
          style={{
            left: `${hoverData.px}px`,
            top: `${hoverData.py - 12}px`,
            transform: "translate(-50%, -100%)",
            whiteSpace: "nowrap"
          }}
        >
          <div className="font-semibold text-slate-300">
            {new Date(numericPoints[hoverData.index].ts).toLocaleTimeString()}
          </div>
          <div className="mt-0.5 text-xs font-bold text-sky-400">
            {formatNumber(numericPoints[hoverData.index].value, unit)}
          </div>
        </div>
      )}

      <div className="mt-2 flex items-center justify-between text-[11px] text-[#47729f] dark:text-slate-400">
        <span>Min {formatNumber(min, unit)}</span>
        <span>Max {formatNumber(max, unit)}</span>
      </div>
    </div>
  );
};

