interface SensorIndicatorProps {
  x: number;
  y: number;
  value: number | null;
  w?: number;
  h?: number;
  unit?: string;
  warningThreshold?: number;
  alarmThreshold?: number;
  decimalPlaces?: number;
  padding?: number;
  // Tambahan parameter baru
  thresholdDirection?: 'above' | 'below'; 
}

export function SensorIndicator({
  x,
  y,
  value,
  w = 100,
  h = 60,
  unit = "",
  warningThreshold = 70,
  alarmThreshold = 90,
  decimalPlaces = 0,
  padding = 5,
  thresholdDirection = 'above', // default: batas atas
}: SensorIndicatorProps) {
  const cx = x + w / 2;
  const cy = y + h / 2;

  const getColor = () => {
    if (value === null) return "#444444";

    if (thresholdDirection === 'above') {
      // Logika batas atas (High Warning / High Alarm)
      if (value >= alarmThreshold)   return "#ff2222"; // RED (Alarm)
      if (value >= warningThreshold) return "#ffaa00"; // YELLOW (Warning)
    } else {
      // Logika batas bawah (Low Warning / Low Alarm)
      if (value <= alarmThreshold)   return "#ff2222"; // RED (Alarm)
      if (value <= warningThreshold) return "#ffaa00"; // YELLOW (Warning)
    }
    
    return "#00cc00"; // GREEN (Normal)
  };

  const color = getColor();

  const displayValue =
    value === null
      ? "--"
      : unit
      ? `${value.toFixed(decimalPlaces)}${unit}`
      : value.toFixed(decimalPlaces);

  const availableW = w - padding * 2;
  const availableH = h - padding * 2;
  const fontSize = Math.max(10, Math.min(
    availableH * 0.75,
    availableW / (displayValue.length * 0.6)
  ));

  return (
    <g>
      <rect
        x={x} y={y}
        width={w} height={h}
        rx={3}
        fill="#111111"
        stroke={color}
        strokeWidth={2}
      />
      <text
        x={cx} y={cy}
        textAnchor="middle"
        dominantBaseline="middle"
        fontFamily="'Arial Black, sans-serif"
        fontWeight="900"
        fontSize={fontSize}
        fill={color}
      >
        {displayValue}
      </text>
    </g>
  );
}