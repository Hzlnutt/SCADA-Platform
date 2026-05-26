type BarChartProps = {
  values: number[];
  unit?: string;
  heightClassName?: string;
};

const formatNumber = (value: number, unit?: string) =>
  `${value.toFixed(0)}${unit ? ` ${unit}` : ""}`;

export const BarChart = ({
  values,
  unit,
  heightClassName = "h-40"
}: BarChartProps) => {
  const max = Math.max(...values, 1);
  const min = Math.min(...values, 0);
  const avg = values.reduce((sum, value) => sum + value, 0) / values.length;

  return (
    <div className={heightClassName}>
      <div className="mb-3 flex items-center justify-between text-xs text-[#47729f]">
        <span>Min {formatNumber(min, unit)}</span>
        <span className="font-mono text-[#002b5c]">
          Avg {formatNumber(avg, unit)}
        </span>
        <span>Max {formatNumber(max, unit)}</span>
      </div>
      <div className="flex h-[calc(100%-1.5rem)] items-end gap-1">
        {values.map((value, index) => (
          <div
            key={`${value}-${index}`}
            className="flex-1 rounded-sm bg-[#1f6fb5]/80"
            style={{ height: `${(value / max) * 100}%` }}
            title={formatNumber(value, unit)}
          />
        ))}
      </div>
    </div>
  );
};
