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
  padding = 8,
}: SensorIndicatorProps) {
  const cx = x + w / 2;
  const cy = y + h / 2;

  const getColor = () => {
    if (value === null) return "#444444";
    if (value >= alarmThreshold)   return "#ff2222";
    if (value >= warningThreshold) return "#ffaa00";
    return "#00cc00";
  };

  const color = getColor();

  const displayValue =
    value === null
      ? "--"
      : unit
      ? `${value.toFixed(decimalPlaces)}${unit}`
      : value.toFixed(decimalPlaces);

  // area yang tersedia setelah dikurangi padding kiri+kanan dan atas+bawah
  const availableW = w - padding * 2;
  const availableH = h - padding * 2;

  // font size dibatasi oleh lebar (per karakter) dan tinggi area
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
        fontFamily="'Courier New', Courier, monospace"
        fontWeight="900"
        fontSize={fontSize}
        fill={color}
      >
        {displayValue}
      </text>
    </g>
  );
}