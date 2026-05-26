type LineSeries = {
  name: string;
  values: number[];
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

export const MultiLineChart = ({
  series,
  unit,
  heightClassName = "h-56"
}: MultiLineChartProps) => {
  const length = Math.max(...series.map((line) => line.values.length), 0);
  const flattened = series.flatMap((line) => line.values);
  const min = Math.min(...flattened, 0);
  const max = Math.max(...flattened, 1);
  const range = max - min || 1;
  const width = 640;
  const height = 220;
  const paddingX = 18;
  const paddingY = 24;
  const plotWidth = width - paddingX * 2;
  const plotHeight = height - paddingY * 2;

  const buildPoints = (values: number[]) =>
    values
      .map((value, index) => {
        const x =
          paddingX + (index / Math.max(length - 1, 1)) * plotWidth;
        const y = paddingY + (1 - (value - min) / range) * plotHeight;
        return `${x.toFixed(2)},${y.toFixed(2)}`;
      })
      .join(" ");

  const latest = series[0]?.values.at(-1);

  return (
    <div className={`${heightClassName} min-h-0`}>
      <div className="mb-3 flex items-center justify-between gap-3 text-xs text-[#47729f]">
        <span>Range</span>
        <span className="font-mono text-[#002b5c]">
          {latest !== undefined ? formatNumber(latest, unit) : "-"}
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
        {series.map((line) => (
          <polyline
            key={line.name}
            points={buildPoints(line.values)}
            fill="none"
            stroke={line.color}
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="2.5"
            strokeDasharray={line.dashed ? "6 6" : undefined}
            vectorEffect="non-scaling-stroke"
          />
        ))}
      </svg>
      <div className="mt-2 flex flex-wrap items-center gap-3 text-[11px] text-[#47729f]">
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
