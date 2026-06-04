interface TankFrameProps {
  x: number;
  y: number;
  w: number;
  h: number;
  label?: string;
  strokeColor?: string;
  fillColor?: string;
  borderWidth?: number;
}

/**
 * Tank frame / bingkai tank dengan 3D shadow effect.
 * Hanya menampilkan frame, isi (level indicator) bisa diletakkan di dalamnya.
 */
export function TankFrame({
  x,
  y,
  w,
  h,
  label = "",
  strokeColor = "#888888",
  fillColor = "#ffffff",
  borderWidth,
}: TankFrameProps) {
  // Border width otomatis scale dari width
  const bw = borderWidth || Math.max(4, Math.min(12, w * 0.08));

  // Border radius untuk sudut rounded
  const br = Math.max(6, Math.min(20, w * 0.12));

  // Inner rect (isi tank) dengan sedikit padding
  const innerX = x + bw;
  const innerY = y + bw;
  const innerW = w - bw * 2;
  const innerH = h - bw * 2;
  const innerBr = Math.max(4, br - bw / 2);

  const filterId = `shadow-${Math.random().toString(36).substr(2, 9)}`;
  const cx = x + w / 2;
  const cy = y + h / 2;

  return (
    <g>
      <defs>
        <filter id={filterId} x="-50%" y="-50%" width="200%" height="200%">
          <feDropShadow
            dx="2"
            dy="2"
            stdDeviation="3"
            floodOpacity="0.4"
          />
        </filter>
      </defs>

      {/* Outer frame (border) */}
      <rect
        x={x}
        y={y}
        width={w}
        height={h}
        rx={br}
        ry={br}
        fill="none"
        stroke={strokeColor}
        strokeWidth={bw}
        filter={`url(#${filterId})`}
      />

      {/* Label (opsional, di bawah tank) */}
      {label && (
        <text
          x={cx}
          y={y + h + 16}
          textAnchor="middle"
          fontFamily="sans-serif"
          fontSize={Math.max(9, Math.min(14, w * 0.15))}
          fill="#999999"
        >
          {label}
        </text>
      )}
    </g>
  );
}