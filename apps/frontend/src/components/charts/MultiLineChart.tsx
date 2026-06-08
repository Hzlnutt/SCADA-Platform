type LineSeries = {
  name: string;
  values: (number | null)[];
  color: string;
  dashed?: boolean;
};

type MultiLineChartProps = {
  series: LineSeries[];
  unit?: string;
  heightClassName?: string;
};

const formatNumber = (value: number, unit?: string) =>
  `${value.toFixed(2)}${unit ? ` ${unit}` : ""}`;

/** Split a (number|null)[] into contiguous non-null segments with original indices */
const buildSegments = (values: (number | null)[]) => {
  const segments: { index: number; value: number }[][] = [];
  let current: { index: number; value: number }[] = [];
  for (let i = 0; i < values.length; i++) {
    if (values[i] !== null) {
      current.push({ index: i, value: values[i] as number });
    } else if (current.length > 0) {
      segments.push(current);
      current = [];
    }
  }
  if (current.length > 0) segments.push(current);
  return segments;
};

export const MultiLineChart = ({
  series,
  unit,
  heightClassName = "h-56"
}: MultiLineChartProps) => {
  const length = Math.max(...series.map((line) => line.values.length), 0);
  const nonNull = series.flatMap((line) => line.values.filter((v): v is number => v !== null));
  const min = nonNull.length > 0 ? Math.min(...nonNull, 0) : 0;
  const max = nonNull.length > 0 ? Math.max(...nonNull, 1) : 1;
  const range = max - min || 1;
  const width = 640;
  const height = 220;
  const paddingX = 18;
  const paddingY = 24;
  const plotWidth = width - paddingX * 2;
  const plotHeight = height - paddingY * 2;

  const buildPoints = (segment: { index: number; value: number }[]) =>
    segment
      .map(({ index, value }) => {
        const x = paddingX + (index / Math.max(length - 1, 1)) * plotWidth;
        const y = paddingY + (1 - (value - min) / range) * plotHeight;
        return `${x.toFixed(2)},${y.toFixed(2)}`;
      })
      .join(" ");

  const lastNonZero = series[0]?.values.filter((v): v is number => v !== null).at(-1);

  return (
    <div className={`${heightClassName} min-h-0`}>
      <div className="mb-3 flex items-center justify-between gap-3 text-xs text-slate-400">
        <span>Range</span>
        <span className="font-mono text-slate-200">
          {lastNonZero !== undefined ? formatNumber(lastNonZero, unit) : "-"}
        </span>
        <span>Now</span>
      </div>
      <svg
        viewBox={`0 0 ${width} ${height}`}
        role="img"
        aria-label="Telemetry trend"
        className="h-[calc(100%-1.75rem)] w-full overflow-visible"
        preserveAspectRatio="none"
      >
        {/* Horizontal grid lines */}
        {[0.25, 0.5, 0.75].map((line) => (
          <line
            key={line}
            x1={paddingX}
            x2={width - paddingX}
            y1={paddingY + line * plotHeight}
            y2={paddingY + line * plotHeight}
            stroke="rgba(100, 159, 220, 0.25)"
            strokeWidth="1"
          />
        ))}
        {/* Elapsed-time marker line */}
        {series.map((line) => {
          const segments = buildSegments(line.values);
          return segments.map((seg, segIdx) => (
            <polyline
              key={`${line.name}-${segIdx}`}
              points={buildPoints(seg)}
              fill="none"
              stroke={line.color}
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2.5"
              strokeDasharray={line.dashed ? "6 6" : undefined}
              vectorEffect="non-scaling-stroke"
            />
          ));
        })}
      </svg>
      <div className="mt-2 flex flex-wrap items-center gap-3 text-[11px] text-slate-400">
        {series.map((line) => (
          <div key={line.name} className="flex items-center gap-2">
            <span
              className="inline-block h-2 w-2 rounded-full"
              style={{ backgroundColor: line.color }}
            />
            <span>{line.name}</span>
          </div>
        ))}
      </div>
    </div>
  );
};
