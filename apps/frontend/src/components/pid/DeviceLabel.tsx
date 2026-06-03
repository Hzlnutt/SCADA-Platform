interface DeviceLabelProps {
  x: number;
  y: number;
  name: string;
  on: boolean;
  hz?: number;
  w?: number;
  h?: number;
}

export function DeviceLabel({ x, y, name, on, hz = 50, w = 90, h = 75 }: DeviceLabelProps) {
  const rowH = h / 3;
  const cx = x + w / 2;
  const border = "#1a1aff";
  const bw = 2;

  const nameFontSize  = Math.max(9, Math.min(w * 0.16, rowH * 0.6));
  const statusFontSize = Math.max(10, Math.min(w * 0.19, rowH * 0.65));
  const hzFontSize    = Math.max(9, Math.min(w * 0.15, rowH * 0.58));

  return (
    <g>
      <rect x={x} y={y} width={w} height={h} rx={2} fill="none" stroke={border} strokeWidth={bw} />

      {/* Baris atas — nama */}
      <rect x={x} y={y} width={w} height={rowH} rx={2} fill="white" stroke={border} strokeWidth={bw} />
      <text
        x={cx} y={y + rowH * 0.65}
        textAnchor="middle" dominantBaseline="middle"
        fontFamily="Arial Black, sans-serif" fontWeight="900"
        fontSize={nameFontSize} fill="#111"
      >
        {name}
      </text>

      {/* Baris tengah — status */}
      <rect x={x} y={y + rowH} width={w} height={rowH} fill={on ? "#009900" : "#e00000"} stroke={border} strokeWidth={bw} />
      <text
        x={cx} y={y + rowH * 1.5}
        textAnchor="middle" dominantBaseline="middle"
        fontFamily="Arial Black, sans-serif" fontWeight="900"
        fontSize={statusFontSize} fill={on ? "#003300" : "#330000"}
      >
        {on ? "ON" : "OFF"}
      </text>

      {/* Baris bawah — Hz */}
      <rect x={x} y={y + rowH * 2} width={w} height={rowH} rx={2} fill="white" stroke={border} strokeWidth={bw} />
      <text
        x={cx} y={y + rowH * 2.5}
        textAnchor="middle" dominantBaseline="middle"
        fontFamily="Arial Black, sans-serif" fontWeight="900"
        fontSize={hzFontSize} fill="#111"
      >
        {hz} Hz
      </text>
    </g>
  );
}