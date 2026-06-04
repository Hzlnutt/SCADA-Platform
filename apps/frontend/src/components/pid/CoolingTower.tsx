import React, { useId } from "react";

interface CoolingTowerProps {
  x?: number;
  y?: number;
  size?: number;
  on?: boolean;
}

const CoolingTower: React.FC<CoolingTowerProps> = ({
  x = 0,
  y = 0,
  size = 100,
  on = false,
}) => {
  const uid = useId();
  const s = (v: number) => (v / 100) * size;

  // ─── Gradient Definitions ──────────────────────────────────────────────
  const gPipe   = `pipe_${uid}`;
  const gHub    = `hub_${uid}`;

  return (
    <g transform={`translate(${x}, ${y})`}>
      <defs>
        {/* Body Silinder */}
        <linearGradient id={gPipe} x1="0" y1="0" x2="1" y2="0" gradientUnits="objectBoundingBox">
          <stop offset="0%"   stopColor="#5a5b5c" />
          <stop offset="2%"   stopColor="#5a5b5c" />
          <stop offset="15%"  stopColor="#909090" />
          <stop offset="48%"  stopColor="#e8e8e8" />
          <stop offset="82%"  stopColor="#b0b0b0" />
          <stop offset="100%" stopColor="#6a6a6a" />
        </linearGradient>

        {/* Fan Hub Tengah */}
        <linearGradient id={gHub} x1="0" y1="0" x2="1" y2="0" gradientUnits="objectBoundingBox">
          <stop offset="0%"   stopColor="#4a4b4c" />
          <stop offset="18%"  stopColor="#888888" />
          <stop offset="50%"  stopColor="#dedede" />
          <stop offset="82%"  stopColor="#a0a0a0" />
          <stop offset="100%" stopColor="#505050" />
        </linearGradient>

        {/* Clip Path: Agar Fan tidak keluar dari body */}
        <clipPath id={`fanClip_${uid}`}>
          <rect x={s(20)} y={s(20)} width={s(60)} height={s(60)} rx={s(4)} />
        </clipPath>
      </defs>

      {/* ─── MAIN BODY ────────────────────────────────────────────────────── */}
      <rect x={s(20)} y={s(20)} width={s(60)} height={s(60)} fill={`url(#${gPipe})`} rx={s(4)} />
      <rect x={s(20)} y={s(20)} width={s(60)} height={s(60)} fill="none" stroke="#3a3b3c" strokeWidth={s(1)} rx={s(4)} />

      {/* ─── VERTICAL RIBS ────────────────────────────────────────────────── */}
      <rect x={s(26)} y={s(20)} width={s(2)} height={s(60)} fill="#3a3b3c" opacity={0.4} />
      <rect x={s(34)} y={s(20)} width={s(2)} height={s(60)} fill="#3a3b3c" opacity={0.4} />
      <rect x={s(64)} y={s(20)} width={s(2)} height={s(60)} fill="#3a3b3c" opacity={0.4} />
      <rect x={s(72)} y={s(20)} width={s(2)} height={s(60)} fill="#3a3b3c" opacity={0.4} />

      {/* ─── FAN REALISTIS DI TENGAH ────────────────────────────────────── */}
      <g clipPath={`url(#fanClip_${uid})`}>
        {/* Cincin luar fan */}
        <circle cx={s(50)} cy={s(50)} r={s(18)} fill={`url(#${gHub})`} />
        <circle cx={s(50)} cy={s(50)} r={s(18)} fill="none" stroke="#2a2b2c" strokeWidth={s(1.5)} opacity={0.6} />

        {/* Grup Blade (Berputar saat on) */}
        <g>
          {/* 4 Blade dengan bentuk yang bersih (menggunakan rotasi) */}
          {[0, 90, 180, 270].map((deg) => (
            <g key={deg} transform={`rotate(${deg}, ${s(50)}, ${s(50)})`}>
              <path
                d={`M${s(50)},${s(50)} L${s(44)},${s(34)} Q${s(50)},${s(28)} ${s(56)},${s(34)} Z`}
                fill="#3a3b3c"
                opacity={0.9}
              />
            </g>
          ))}

          {/* Hub tengah fan (terlihat lebih rapi) */}
          <circle cx={s(50)} cy={s(50)} r={s(7)} fill="#1f2937" />
          <circle cx={s(50)} cy={s(50)} r={s(4)} fill={`url(#${gHub})`} />
          <circle cx={s(50)} cy={s(50)} r={s(2)} fill="#e5e7eb" />

          {/* Animasi rotasi ketika on */}
          {on && (
            <animateTransform
              attributeName="transform"
              type="rotate"
              from={`0 ${s(50)} ${s(50)}`}
              to={`360 ${s(50)} ${s(50)}`}
              dur="1s"
              repeatCount="indefinite"
            />
          )}
        </g>
      </g>

      {/* ─── HIGHLIGHT & SHADOW ──────────────────────────────────────────── */}
      <rect x={s(26)} y={s(22)} width={s(6)} height={s(56)} fill="#ffffff" opacity={0.08} rx={s(2)} />
      <rect x={s(68)} y={s(22)} width={s(6)} height={s(56)} fill="#000000" opacity={0.06} rx={s(2)} />
    </g>
  );
};

export default CoolingTower;