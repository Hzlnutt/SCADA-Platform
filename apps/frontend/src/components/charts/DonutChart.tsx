type Segment = {
  label: string;
  value: number;
  color: string;
};

type DonutChartProps = {
  segments: Segment[];
  size?: number;
  thickness?: number;
  centerLabel?: string;
};

export const DonutChart = ({
  segments,
  size = 160,
  thickness = 18,
  centerLabel
}: DonutChartProps) => {
  const radius = (size - thickness) / 2;
  const circumference = 2 * Math.PI * radius;
  const total = segments.reduce((sum, segment) => sum + segment.value, 0) || 1;
  const segmentsWithOffsets = segments.map((segment, index) => {
    const previousValue = segments
      .slice(0, index)
      .reduce((sum, item) => sum + item.value, 0);
    const dash = (segment.value / total) * circumference;

    return {
      ...segment,
      dash,
      dashOffset: -(previousValue / total) * circumference
    };
  });

  return (
    <div className="relative inline-flex items-center justify-center">
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          className="stroke-[#d6e9fb] dark:stroke-slate-800"
          strokeWidth={thickness}
          fill="none"
        />
        {segmentsWithOffsets.map((segment) => {
          const dashArray = `${segment.dash} ${circumference - segment.dash}`;
          return (
            <circle
              key={segment.label}
              cx={size / 2}
              cy={size / 2}
              r={radius}
              stroke={segment.color}
              strokeWidth={thickness}
              strokeDasharray={dashArray}
              strokeDashoffset={segment.dashOffset}
              fill="none"
              strokeLinecap="round"
              className="transition-[stroke-dasharray,stroke-dashoffset] duration-750 ease-out"
              transform={`rotate(-90 ${size / 2} ${size / 2})`}
            />
          );
        })}
      </svg>
      {centerLabel ? (
        <div className="absolute text-center text-[10px] text-[#47729f] dark:text-slate-400 font-medium">
          <div className="text-base font-bold text-[#002b5c] dark:text-slate-100 leading-tight">
            {centerLabel}
          </div>
          <div className="mt-0.5">Total</div>
        </div>
      ) : null}
    </div>
  );
};
