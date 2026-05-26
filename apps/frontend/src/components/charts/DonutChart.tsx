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
  let offset = 0;

  return (
    <div className="relative inline-flex items-center justify-center">
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke="#d6e9fb"
          strokeWidth={thickness}
          fill="none"
        />
        {segments.map((segment) => {
          const dash = (segment.value / total) * circumference;
          const dashArray = `${dash} ${circumference - dash}`;
          const dashOffset = -offset;
          offset += dash;

          return (
            <circle
              key={segment.label}
              cx={size / 2}
              cy={size / 2}
              r={radius}
              stroke={segment.color}
              strokeWidth={thickness}
              strokeDasharray={dashArray}
              strokeDashoffset={dashOffset}
              fill="none"
              strokeLinecap="round"
              transform={`rotate(-90 ${size / 2} ${size / 2})`}
            />
          );
        })}
      </svg>
      {centerLabel ? (
        <div className="absolute text-center text-xs text-[#47729f]">
          <div className="text-lg font-semibold text-[#002b5c]">
            {centerLabel}
          </div>
          <div>Total</div>
        </div>
      ) : null}
    </div>
  );
};
