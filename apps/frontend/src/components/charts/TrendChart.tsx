import { useTimeRangeStore } from "../../store/timeRange.store";

type TrendPoint = {
  ts: string | Date;
  value: number | string | boolean;
};

type TrendChartProps = {
  points: TrendPoint[];
  unit?: string;
  heightClassName?: string;
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
  heightClassName = "h-56"
}: TrendChartProps) => {
  const activeRange = useTimeRangeStore((state) => state.range);
  const limit = rangePoints[activeRange] ?? points.length;
  const numericPoints = toNumericPoints(points).slice(-limit);

  if (numericPoints.length < 2) {
    return (
      <div
        className={`${heightClassName} flex items-center justify-center rounded-lg border border-dashed border-[#acd3ff] bg-[#f7fbff] text-sm text-[#47729f]`}
      >
        Waiting for numeric trend data
      </div>
    );
  }

  const values = numericPoints.map((point) => point.value);
  const min = Math.min(...values);
  const max = Math.max(...values);
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

  return (
    <div className={`${heightClassName} min-h-0`}>
      <div className="mb-3 flex items-center justify-between gap-3 text-xs text-[#47729f]">
        <span>{firstTs}</span>
        <span className="font-mono text-[#002b5c]">
          {formatNumber(latest.value, unit)}
        </span>
        <span>{lastTs}</span>
      </div>
      <svg
        viewBox={`0 0 ${width} ${height}`}
        role="img"
        aria-label="Telemetry trend"
        className="h-[calc(100%-1.75rem)] w-full overflow-visible"
        preserveAspectRatio="none"
      >
        {[0.25, 0.5, 0.75].map((line) => (
          <line
            key={line}
            x1={paddingX}
            x2={width - paddingX}
            y1={paddingY + line * plotHeight}
            y2={paddingY + line * plotHeight}
            stroke="rgba(172,211,255,0.65)"
            strokeWidth="1"
          />
        ))}
        <polyline
          points={pathPoints}
          fill="none"
          stroke="#1f6fb5"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="3"
          vectorEffect="non-scaling-stroke"
        />
        <circle
          cx={
            paddingX +
            ((numericPoints.length - 1) /
              Math.max(numericPoints.length - 1, 1)) *
              plotWidth
          }
          cy={paddingY + (1 - (latest.value - min) / range) * plotHeight}
          r="4"
          fill="#a44925"
        />
      </svg>
      <div className="mt-2 flex items-center justify-between text-[11px] text-[#47729f]">
        <span>Min {formatNumber(min, unit)}</span>
        <span>Max {formatNumber(max, unit)}</span>
      </div>
    </div>
  );
};
