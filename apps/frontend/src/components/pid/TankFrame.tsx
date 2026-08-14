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
 * TankFrame - ISA-101 Monochromatic High-Performance Standard
 */
export function TankFrame({
  x,
  y,
  w,
  h,
  label = "",
  strokeColor = "#475569",
  borderWidth,
}: TankFrameProps) {
  const bw = borderWidth || Math.max(3, Math.min(8, w * 0.06));
  const br = Math.max(6, Math.min(16, w * 0.1));

  const cx = x + w / 2;

  return (
    <g>
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
      />

      {/* Label */}
      {label && (
        <text
          x={cx}
          y={y + h + 16}
          textAnchor="middle"
          fontFamily="'Plus Jakarta Sans', sans-serif"
          fontWeight="600"
          fontSize={Math.max(9, Math.min(14, w * 0.15))}
          fill="#94a3b8"
        >
          {label}
        </text>
      )}
    </g>
  );
}