import { useEffect, useState } from "react";

interface LevelIndicatorProps {
  x: number;
  y: number;
  value: number; // 0-100
  w?: number;
  h?: number;
  minThreshold?: number;
  warningThreshold?: number;
  showThresholdLine?: boolean;
  type?: 'cold' | 'warm';
}

export function LevelIndicator({
  x,
  y,
  value,
  w = 50,
  h = 120,
  minThreshold = 70,
  warningThreshold = 75,
  showThresholdLine = true,
}: LevelIndicatorProps) {
  const [displayValue, setDisplayValue] = useState(value);

  useEffect(() => {
    setDisplayValue(value);
  }, [value]);

  const clampedValue = Math.max(0, Math.min(100, displayValue));
  const fillHeight = (clampedValue / 100) * h;
  const fillY = y + (h - fillHeight);

  const isAlarm = clampedValue < minThreshold;
  const isWarning = !isAlarm && clampedValue < warningThreshold;

  // ISA-101 Color Standards (Calm Slate Normal, Amber Warning, Red Alarm)
  const getGradientStops = () => {
    if (isAlarm) {
      return { stop1: "#f87171", stop2: "#dc2626" }; // Alarm Red
    }
    if (isWarning) {
      return { stop1: "#fbbf24", stop2: "#d97706" }; // Warning Amber
    }
    return { stop1: "#60a5fa", stop2: "#1e3a8a" }; // Normal Subdued Slate-Blue
  };

  const gradientStops = getGradientStops();
  const gradIdUnique = `isa-grad-level-${Math.round(x)}-${Math.round(y)}`;
  const clipId = `isa-clip-level-${Math.round(x)}-${Math.round(y)}`;

  const borderRadius = Math.max(2, w * 0.06);
  const borderWidth = Math.max(1, w * 0.03);

  return (
    <g>
      <defs>
        <clipPath id={clipId}>
          <rect x={x} y={y} width={w} height={h} rx={borderRadius} />
        </clipPath>

        <linearGradient id={gradIdUnique} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor={gradientStops.stop1} />
          <stop offset="50%" stopColor={gradientStops.stop2} />
          <stop offset="100%" stopColor={gradientStops.stop1} />
        </linearGradient>
      </defs>

      {/* Frame Container (ISA-101 Monochromatic Dark Slate) */}
      <rect
        x={x}
        y={y}
        width={w}
        height={h}
        rx={borderRadius}
        fill="#0f172a"
        stroke={isAlarm ? "#ef4444" : isWarning ? "#f59e0b" : "#334155"}
        strokeWidth={isAlarm ? 2 : borderWidth}
      />

      {/* Liquid Fill */}
      <g clipPath={`url(#${clipId})`}>
        <rect
          x={x}
          y={fillY}
          width={w}
          height={fillHeight}
          fill={`url(#${gradIdUnique})`}
          opacity={0.85}
        />

        {/* Highlight Stripe */}
        <rect
          x={x + w * 0.15}
          y={fillY}
          width={w * 0.2}
          height={fillHeight}
          fill="#ffffff"
          opacity={0.12}
        />
      </g>

      {/* Threshold Reference Lines */}
      {showThresholdLine && (
        <>
          {/* Warning Level Line */}
          <line
            x1={x}
            y1={y + h * (1 - warningThreshold / 100)}
            x2={x + w}
            y2={y + h * (1 - warningThreshold / 100)}
            stroke="#f59e0b"
            strokeWidth={1}
            strokeDasharray="2,2"
            opacity={0.7}
          />
          {/* Min Alarm Level Line */}
          <line
            x1={x}
            y1={y + h * (1 - minThreshold / 100)}
            x2={x + w}
            y2={y + h * (1 - minThreshold / 100)}
            stroke="#ef4444"
            strokeWidth={1}
            strokeDasharray="2,2"
            opacity={0.8}
          />
        </>
      )}

      {/* Digital Readout */}
      <text
        x={x + w / 2}
        y={y + h / 2}
        textAnchor="middle"
        dominantBaseline="middle"
        fill={isAlarm ? "#f87171" : isWarning ? "#fbbf24" : "#f8fafc"}
        fontSize="12"
        fontWeight="bold"
        fontFamily="'Plus Jakarta Sans', sans-serif"
      >
        {clampedValue.toFixed(0)}%
      </text>
    </g>
  );
}