import React, { useId } from "react";

interface VerticalValveProps {
  x?: number;
  y?: number;
  size?: number;
  angle?: number;
}

const VerticalValve: React.FC<VerticalValveProps> = ({
  x = 0,
  y = 0,
  size = 100,
  angle = 0,
}) => {
  const uid = useId().replace(/:/g, "_");
  const s = (v: number) => (v / 100) * size;

  // ─── Geometri Dasar ──────────────────────────────────────────────────────
  const PIPE_W = 30;
  const PIPE_H = 56;
  const PIPE_X = 35;
  const PIPE_Y = 22;

  const FLANGE_W = 34;
  const FLANGE_H = 10;
  const FLANGE_X = PIPE_X - (FLANGE_W - PIPE_W) / 2;
  const FLANGE_Y_TOP = PIPE_Y - FLANGE_H;
  const FLANGE_Y_BOT = PIPE_Y + PIPE_H;

  const BOLT_R = 2.5;
  const BOLT_Y_TOP = FLANGE_Y_TOP + FLANGE_H / 2;
  const BOLT_Y_BOT = FLANGE_Y_BOT + FLANGE_H / 2;
  const BOLT_X_POSITIONS = [PIPE_X + 2, PIPE_X + PIPE_W / 2, PIPE_X + PIPE_W - 2];

  // ─── Cabang Samping (T) ──────────────────────────────────────────────────
  const BRANCH_X = PIPE_X + PIPE_W;
  const BRANCH_W = 20;
  const BRANCH_Y = 38;
  const BRANCH_H = 24;

  const VALVE_FLANGE_X = BRANCH_X + BRANCH_W;
  const VALVE_FLANGE_W = 8;
  const VALVE_FLANGE_H = 28;
  const VALVE_FLANGE_Y = BRANCH_Y - 2;

  const STEM_W = 6;
  const STEM_H = 8;
  const STEM_X = VALVE_FLANGE_X + VALVE_FLANGE_W;
  const STEM_Y = BRANCH_Y + (BRANCH_H - STEM_H) / 2;

  const HAND_W = 4;
  const HAND_H = 36;
  const HAND_X = STEM_X + STEM_W;
  const HAND_Y = BRANCH_Y + (BRANCH_H - HAND_H) / 2;

  // ─── Gradien (Warna Sesuai Referensi Y-Strainer) ────────────────────────
  const gPipe = `pipe_${uid}`; // Gradien untuk body pipa ( -bv )
  const gFlange = `flange_${uid}`; // Gradien untuk flange ( -fl )

  return (
    <g transform={`translate(${x}, ${y}) rotate(${angle}, ${s(50)}, ${s(50)})`}>
      <defs>
        {/* Gradien Body Pipa & Cabang (Gelap - Terang - Gelap) */}
        <linearGradient id={gPipe} x1="0" y1="0" x2="1" y2="0" gradientUnits="objectBoundingBox">
          <stop offset="0%" stopColor="#5a5b5c" />
          <stop offset="2%" stopColor="#5a5b5c" />
          <stop offset="15%" stopColor="#909090" />
          <stop offset="48%" stopColor="#e8e8e8" />
          <stop offset="82%" stopColor="#b0b0b0" />
          <stop offset="100%" stopColor="#6a6a6a" />
        </linearGradient>

        {/* Gradien Flange (Gelap - Terang - Gelap arah vertikal) */}
        <linearGradient id={gFlange} x1="0" y1="0" x2="0" y2="1" gradientUnits="objectBoundingBox">
          <stop offset="0%" stopColor="#4a4b4c" />
          <stop offset="15%" stopColor="#787878" />
          <stop offset="50%" stopColor="#c8c8c8" />
          <stop offset="82%" stopColor="#909090" />
          <stop offset="100%" stopColor="#505050" />
        </linearGradient>
      </defs>

      {/* ── FLANGE BAWAH ──────────────────────────────────────────────────── */}
      <rect x={s(FLANGE_X)} y={s(FLANGE_Y_BOT)} width={s(FLANGE_W)} height={s(FLANGE_H)} fill={`url(#${gFlange})`} rx={s(1)} />
      <rect x={s(FLANGE_X)} y={s(FLANGE_Y_BOT)} width={s(FLANGE_W)} height={s(FLANGE_H/2)} fill="#ffffff" opacity={0.3} rx={s(1)} />
      {BOLT_X_POSITIONS.map((xPos) => (
        <circle key={`btm-${xPos}`} cx={s(xPos)} cy={s(BOLT_Y_BOT)} r={s(BOLT_R)} fill="#374151" />
      ))}

      {/* ── FLANGE ATAS ────────────────────────────────────────────────── */}
      <rect x={s(FLANGE_X)} y={s(FLANGE_Y_TOP)} width={s(FLANGE_W)} height={s(FLANGE_H)} fill={`url(#${gFlange})`} rx={s(1)} />
      <rect x={s(FLANGE_X)} y={s(FLANGE_Y_TOP)} width={s(FLANGE_W)} height={s(FLANGE_H/2)} fill="#ffffff" opacity={0.3} rx={s(1)} />
      {BOLT_X_POSITIONS.map((xPos) => (
        <circle key={`top-${xPos}`} cx={s(xPos)} cy={s(BOLT_Y_TOP)} r={s(BOLT_R)} fill="#374151" />
      ))}

      {/* ── PIPA UTAMA VERTIKAL ──────────────────────────────────────────── */}
      <rect x={s(PIPE_X)} y={s(PIPE_Y)} width={s(PIPE_W)} height={s(PIPE_H)} fill={`url(#${gPipe})`} />
      <rect x={s(PIPE_X)} y={s(PIPE_Y)} width={s(PIPE_W)} height={s(PIPE_H/2)} fill="#ffffff" opacity={0.2} />

      {/* ── PIPA CABANG HORIZONTAL (T ke samping) ───────────────────────── */}
      <rect x={s(BRANCH_X)} y={s(BRANCH_Y)} width={s(BRANCH_W)} height={s(BRANCH_H)} fill={`url(#${gPipe})`} />
      <rect x={s(BRANCH_X)} y={s(BRANCH_Y)} width={s(BRANCH_W)} height={s(BRANCH_H/2)} fill="#ffffff" opacity={0.2} />

      {/* ── FLANGE KATUP (Sebelum stem) ────────────────────────────────── */}
      <rect x={s(VALVE_FLANGE_X)} y={s(VALVE_FLANGE_Y)} width={s(VALVE_FLANGE_W)} height={s(VALVE_FLANGE_H)} fill={`url(#${gFlange})`} rx={s(1)} />
      <rect x={s(VALVE_FLANGE_X)} y={s(VALVE_FLANGE_Y)} width={s(VALVE_FLANGE_W)} height={s(VALVE_FLANGE_H/2)} fill="#ffffff" opacity={0.3} rx={s(1)} />

      {/* ── STEM VALVE (Penghubung ke handwheel) ───────────────────────── */}
      <rect x={s(STEM_X)} y={s(STEM_Y)} width={s(STEM_W)} height={s(STEM_H)} fill={`url(#${gPipe})`} rx={s(1)} />
      <rect x={s(STEM_X)} y={s(STEM_Y)} width={s(STEM_W)} height={s(STEM_H/2)} fill="#ffffff" opacity={0.3} rx={s(1)} />

      {/* ── HANDWHEEL ────────────────────────────────────────────────────── */}
      <rect x={s(HAND_X)} y={s(HAND_Y)} width={s(HAND_W)} height={s(HAND_H)} fill={`url(#${gPipe})`} rx={s(1)} />
      <rect x={s(HAND_X)} y={s(HAND_Y)} width={s(HAND_W)} height={s(HAND_H/2)} fill="#ffffff" opacity={0.4} rx={s(1)} />

      {/* ── GARIS VISUAL ──────────────────────────────────────────────────── */}
      <line x1={s(PIPE_X)} y1={s(PIPE_Y)} x2={s(PIPE_X + PIPE_W)} y2={s(PIPE_Y)} stroke="#9ca3af" strokeWidth={s(0.5)} />
      <line x1={s(PIPE_X)} y1={s(PIPE_Y + PIPE_H)} x2={s(PIPE_X + PIPE_W)} y2={s(PIPE_Y + PIPE_H)} stroke="#9ca3af" strokeWidth={s(0.5)} />
      <line x1={s(BRANCH_X)} y1={s(BRANCH_Y)} x2={s(BRANCH_X)} y2={s(BRANCH_Y + BRANCH_H)} stroke="#9ca3af" strokeWidth={s(0.5)} />
    </g>
  );
};

export default VerticalValve;