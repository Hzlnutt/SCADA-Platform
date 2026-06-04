import React, { useId } from "react";

interface PipeGaugeProps {
  x?: number;
  y?: number;
  size?: number;
}

const PipeGauge: React.FC<PipeGaugeProps> = ({
  x = 0,
  y = 0,
  size = 100,
}) => {
  const uid = useId().replace(/:/g, "_");
  const s = (v: number) => (v / 100) * size;

  // ─── Posisi dan Ukuran ──────────────────────────────────────────────────
  const PIPE_Y       = 80;
  const PIPE_H       = 16;
  const PIPE_X_START = 15;
  const PIPE_X_END   = 85;

  const FLANGE_W     = 6;
  const FLANGE_H     = 20;
  const FLANGE_LEFT  = PIPE_X_START - FLANGE_W;
  const FLANGE_RIGHT = PIPE_X_END;

  const CONNECTOR_W  = 10;
  const CONNECTOR_H  = 8;
  const CONNECTOR_X  = 45;
  const CONNECTOR_Y  = PIPE_Y - CONNECTOR_H;

  const GAUGE_CX     = 50;
  const GAUGE_CY     = 52;
  const GAUGE_R      = 20;

  const TOP_H        = 10;
  const TOP_W        = 14;

  const KNOB_Y       = 22;
  const KNOB_W       = 22;
  const KNOB_H       = 5;

  // ─── Gradien ──────────────────────────────────────────────────────────────
  const gPipe     = `pipe_${uid}`;
  const gBezel    = `bezel_${uid}`;
  const gTop      = `top_${uid}`;
  const gFlange   = `flange_${uid}`;
  const gConnector = `connector_${uid}`;

  return (
    <g transform={`translate(${x}, ${y})`}>
      <defs>
        <linearGradient id={gPipe} x1="0" y1="0" x2="0" y2="1" gradientUnits="objectBoundingBox">
          <stop offset="0%" stopColor="#d1d5db" />
          <stop offset="30%" stopColor="#f3f4f6" />
          <stop offset="70%" stopColor="#9ca3af" />
          <stop offset="100%" stopColor="#6b7280" />
        </linearGradient>

        <linearGradient id={gBezel} x1="0" y1="0" x2="1" y2="1" gradientUnits="objectBoundingBox">
          <stop offset="0%" stopColor="#e5e7eb" />
          <stop offset="50%" stopColor="#9ca3af" />
          <stop offset="100%" stopColor="#4b5563" />
        </linearGradient>

        <linearGradient id={gTop} x1="0" y1="0" x2="1" y2="0" gradientUnits="objectBoundingBox">
          <stop offset="0%" stopColor="#d1d5db" />
          <stop offset="50%" stopColor="#f3f4f6" />
          <stop offset="100%" stopColor="#9ca3af" />
        </linearGradient>

        <linearGradient id={gFlange} x1="0" y1="0" x2="1" y2="0" gradientUnits="objectBoundingBox">
          <stop offset="0%" stopColor="#9ca3af" />
          <stop offset="50%" stopColor="#e5e7eb" />
          <stop offset="100%" stopColor="#6b7280" />
        </linearGradient>

        <linearGradient id={gConnector} x1="0" y1="0" x2="0" y2="1" gradientUnits="objectBoundingBox">
          <stop offset="0%" stopColor="#e5e7eb" />
          <stop offset="40%" stopColor="#f3f4f6" />
          <stop offset="60%" stopColor="#9ca3af" />
          <stop offset="100%" stopColor="#6b7280" />
        </linearGradient>
      </defs>

      {/* ── FLANGE KIRI ──────────────────────────────────────────────────── */}
      <rect x={s(FLANGE_LEFT)} y={s(PIPE_Y - (FLANGE_H - PIPE_H) / 2)} width={s(FLANGE_W)} height={s(FLANGE_H)} fill={`url(#${gFlange})`} rx={s(1)} />
      <rect x={s(FLANGE_LEFT)} y={s(PIPE_Y - (FLANGE_H - PIPE_H) / 2)} width={s(FLANGE_W)} height={s(FLANGE_H / 2)} fill="#ffffff" opacity={0.15} rx={s(1)} />

      {/* ── FLANGE KANAN ────────────────────────────────────────────────── */}
      <rect x={s(FLANGE_RIGHT)} y={s(PIPE_Y - (FLANGE_H - PIPE_H) / 2)} width={s(FLANGE_W)} height={s(FLANGE_H)} fill={`url(#${gFlange})`} rx={s(1)} />
      <rect x={s(FLANGE_RIGHT)} y={s(PIPE_Y - (FLANGE_H - PIPE_H) / 2)} width={s(FLANGE_W)} height={s(FLANGE_H / 2)} fill="#ffffff" opacity={0.15} rx={s(1)} />

      {/* ── PIPA UTAMA ──────────────────────────────────────────────────── */}
      <rect x={s(PIPE_X_START)} y={s(PIPE_Y)} width={s(PIPE_X_END - PIPE_X_START)} height={s(PIPE_H)} fill={`url(#${gPipe})`} rx={s(1)} />
      <rect x={s(PIPE_X_START)} y={s(PIPE_Y)} width={s(PIPE_X_END - PIPE_X_START)} height={s(PIPE_H / 2)} fill="#ffffff" opacity={0.15} rx={s(1)} />

      {/* ── PIPA PENGHUBUNG (VERTIKAL) ──────────────────────────────────── */}
      <rect x={s(CONNECTOR_X)} y={s(CONNECTOR_Y)} width={s(CONNECTOR_W)} height={s(CONNECTOR_H)} fill={`url(#${gConnector})`} rx={s(1)} />
      <rect x={s(CONNECTOR_X)} y={s(CONNECTOR_Y)} width={s(CONNECTOR_W)} height={s(CONNECTOR_H / 2)} fill="#ffffff" opacity={0.15} rx={s(1)} />

      {/* ── GAUGE (Luar) ────────────────────────────────────────────────── */}
      <circle cx={s(GAUGE_CX)} cy={s(GAUGE_CY)} r={s(GAUGE_R)} fill={`url(#${gBezel})`} stroke="#4b5563" strokeWidth={s(1)} />
      <circle cx={s(GAUGE_CX)} cy={s(GAUGE_CY)} r={s(GAUGE_R - 3)} fill="#ffffff" stroke="#d1d5db" strokeWidth={s(0.5)} />

      {/* ── SKALA GAUGE ──────────────────────────────────────────────────── */}
      <g>
        {Array.from({ length: 36 }).map((_, i) => {
          const angle = i * 10 - 180;
          const isMajor = i % 5 === 0;
          const length = isMajor ? s(5) : s(3);
          const strokeW = isMajor ? s(1.5) : s(0.8);
          return (
            <line
              key={i}
              x1={s(GAUGE_CX)}
              y1={s(GAUGE_CY - GAUGE_R + 3)}
              x2={s(GAUGE_CX)}
              y2={s(GAUGE_CY - GAUGE_R + 3 + length)}
              stroke="#4b5563"
              strokeWidth={strokeW}
              transform={`rotate(${angle}, ${s(GAUGE_CX)}, ${s(GAUGE_CY)})`}
            />
          );
        })}
      </g>

      {/* ── JARUM GAUGE ──────────────────────────────────────────────────── */}
      <line
        x1={s(GAUGE_CX)}
        y1={s(GAUGE_CY)}
        x2={s(GAUGE_CX + 10)}
        y2={s(GAUGE_CY - 12)}
        stroke="#ef4444"
        strokeWidth={s(1.5)}
        strokeLinecap="round"
      />
      <circle cx={s(GAUGE_CX)} cy={s(GAUGE_CY)} r={s(3)} fill="#ef4444" />

      {/* ── STRUKTUR ATAS GAUGE ──────────────────────────────────────────── */}
      <rect x={s(GAUGE_CX - 3)} y={s(GAUGE_CY - GAUGE_R - 4)} width={s(6)} height={s(10)} fill={`url(#${gTop})`} />
      <rect x={s(GAUGE_CX - TOP_W / 2)} y={s(GAUGE_CY - GAUGE_R - 8)} width={s(TOP_W)} height={s(TOP_H)} fill={`url(#${gTop})`} rx={s(1)} />

      {/* ── KNOB / KENOP DI ATAS ──────────────────────────────────────────── */}
      <rect x={s(GAUGE_CX - KNOB_W / 2)} y={s(KNOB_Y)} width={s(KNOB_W)} height={s(KNOB_H)} fill={`url(#${gTop})`} rx={s(1)} />
      {Array.from({ length: 6 }).map((_, i) => {
        const xPos = s(GAUGE_CX - KNOB_W / 2 + 2 + i * 3.5);
        return (
          <rect
            key={i}
            x={xPos}
            y={s(KNOB_Y - 1.5)}
            width={s(1.5)}
            height={s(1.5)}
            fill="#6b7280"
          />
        );
      })}
      <rect x={s(GAUGE_CX - 4)} y={s(KNOB_Y)} width={s(8)} height={s(KNOB_H)} fill="#4b5563" rx={s(1)} opacity={0.15} />

      {/* ── HIGHLIGHT GAUGE ──────────────────────────────────────────────── */}
      <path d={`M${s(GAUGE_CX - 12)},${s(GAUGE_CY - 14)} A${s(GAUGE_R - 4)},${s(GAUGE_R - 4)} 0 0,1 ${s(GAUGE_CX + 14)},${s(GAUGE_CY - 14)}`} fill="none" stroke="#ffffff" strokeWidth={s(1.5)} opacity={0.5} />
    </g>
  );
};

export default PipeGauge;