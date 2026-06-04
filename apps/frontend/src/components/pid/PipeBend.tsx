import React, { useId } from "react";

interface PipeBendProps {
  x?: number;
  y?: number;
  size?: number;
  angle?: number;
}

const PipeBend: React.FC<PipeBendProps> = ({
  x = 0,
  y = 0,
  size = 150,
  angle = 0,
}) => {
  const uid = useId().replace(/:/g, "_");
  const s = (v: number) => (v / 51) * size;

  // ─── Gradient IDs ────────────────────────────────────────────────────────
  const gBody = `body_${uid}`;
  const gFlangeH = `flange_h_${uid}`;
  const gFlangeV = `flange_v_${uid}`;
  const gHighlight = `highlight_${uid}`;

  return (
    <g transform={`translate(${x}, ${y}) rotate(${angle}, ${size / 2}, ${size / 2})`}>
      <defs>
        <linearGradient id={gBody} x1="0" y1="0" x2="1" y2="1" gradientUnits="objectBoundingBox">
          <stop offset="0%" stopColor="#D8DEE3" />
          <stop offset="30%" stopColor="#E8ECEF" />
          <stop offset="50%" stopColor="#F5F7F9" />
          <stop offset="70%" stopColor="#D0D6DC" />
          <stop offset="100%" stopColor="#9EA8B2" />
        </linearGradient>

        <linearGradient id={gFlangeH} x1="0" y1="0" x2="1" y2="0" gradientUnits="objectBoundingBox">
          <stop offset="0%" stopColor="#9EA8B2" />
          <stop offset="50%" stopColor="#C8D0D8" />
          <stop offset="100%" stopColor="#7A848E" />
        </linearGradient>

        <linearGradient id={gFlangeV} x1="0" y1="0" x2="0" y2="1" gradientUnits="objectBoundingBox">
          <stop offset="0%" stopColor="#9EA8B2" />
          <stop offset="50%" stopColor="#C8D0D8" />
          <stop offset="100%" stopColor="#7A848E" />
        </linearGradient>

        <linearGradient id={gHighlight} x1="0" y1="0" x2="1" y2="1" gradientUnits="objectBoundingBox">
          <stop offset="0%" stopColor="#FFFFFF" stopOpacity="0.45" />
          <stop offset="40%" stopColor="#FFFFFF" stopOpacity="0.15" />
          <stop offset="100%" stopColor="#FFFFFF" stopOpacity="0" />
        </linearGradient>
      </defs>

      {/* ─── FLANGE ATAS (horizontal) ─────────────────────────────────── */}
      <rect x={s(0)} y={s(4.5)} width={s(22)} height={s(6)} fill={`url(#${gFlangeH})`} />
      <rect x={s(0)} y={s(4.5)} width={s(22)} height={s(1.5)} fill="#FFFFFF" opacity={0.2} />

      {/* ─── FLANGE KANAN (vertikal) ────────────────────────────────── */}
      <rect x={s(42)} y={s(27.5)} width={s(6)} height={s(22)} fill={`url(#${gFlangeV})`} />
      <rect x={s(42)} y={s(27.5)} width={s(1.5)} height={s(22)} fill="#FFFFFF" opacity={0.2} />

      {/* ─── BODY UTAMA (L shape) ────────────────────────────────────── */}
      <g>
        <path
          d={`M${s(19)},${s(27.026)}V${s(10.5)}H${s(3)}v${s(22.432)}C${s(3)},${s(40.425)} ${s(9.075)},${s(46.5)} ${s(16.568)},${s(46.5)}H${s(42)}v-${s(16)}H${s(22.474)}C${s(20.555)},${s(30.5)} ${s(19)},${s(28.945)} ${s(19)},${s(27.026)}z`}
          fill={`url(#${gBody})`}
        />
        <rect x={s(3)} y={s(1.5)} width={s(16)} height={s(3)} fill={`url(#${gBody})`} />
        <rect x={s(48)} y={s(30.5)} width={s(3)} height={s(16)} fill={`url(#${gBody})`} />
      </g>

      {/* ─── HIGHLIGHT ─────────────────────────────────────── */}
      <path
        d={`M${s(19)},${s(27.026)}V${s(10.5)}H${s(3)}v${s(22.432)}C${s(3)},${s(40.425)} ${s(9.075)},${s(46.5)} ${s(16.568)},${s(46.5)}H${s(42)}v-${s(16)}H${s(22.474)}C${s(20.555)},${s(30.5)} ${s(19)},${s(28.945)} ${s(19)},${s(27.026)}z`}
        fill="none"
        stroke={`url(#${gHighlight})`}
        strokeWidth={s(1.5)}
      />
    </g>
  );
};

export default PipeBend;