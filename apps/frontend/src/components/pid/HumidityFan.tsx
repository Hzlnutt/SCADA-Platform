import React from 'react';

interface HumidityFanProps {
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  running?: boolean;
  bodyColor?: string;
}

const HumidityFan: React.FC<HumidityFanProps> = ({
  x = 0,
  y = 0,
  width = 300,
  height = 200,
  running = false,
  bodyColor = '#3A6B9E',
}) => {
  // ─── Geometry tetap ──────────────────────────────────────────────────────
  const bodyX = 30;
  const bodyY = 10;
  const bodyW = 240;
  const bodyH = 180;

  const flangeInX = 10;
  const flangeInW = 20;
  const flangeInH = 60;
  const flangeInY = 70;

  const flangeOutX = bodyX + bodyW - 110;
  const flangeOutY = 20;
  const flangeOutW = 80;
  const flangeOutH = 160;

  // ─── Pusat Kipas (WAJIB konsisten) ──────────────────────────────────
  const fanCx = bodyX + 60;
  const fanCy = bodyY + bodyH / 2;
  const fanR = 42;

  // ─── Lubang Pipa ──────────────────────────────────────────────────────
  const pipeW = 24;
  const pipeH = 16;
  const pipeY = bodyY + bodyH - 6;
  const pipeSpacing = 10;
  const pipe1X = bodyX + 30;
  const pipe2X = pipe1X + pipeW + pipeSpacing;

  return (
    <svg
      x={x}
      y={y}
      width={width}
      height={height}
      viewBox="0 0 300 200"
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        <style>
          {`
            @keyframes spin {
              0% { transform: rotate(0deg); }
              100% { transform: rotate(360deg); }
            }
            .fan-spin {
              animation: spin 1.2s linear infinite;
              will-change: transform;
            }
            .fan-stop {
              animation: none;
            }
            .led-on { filter: drop-shadow(0 0 6px #00E676); }
            .led-off { filter: drop-shadow(0 0 6px #FF1744); }
          `}
        </style>

        <linearGradient id="bodyGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor={bodyColor} />
          <stop offset="25%" stopColor="#5A8BBE" />
          <stop offset="70%" stopColor="#2A5B8E" />
          <stop offset="100%" stopColor="#1A3B6E" />
        </linearGradient>

        <linearGradient id="flangeGrad" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#E2E6EA" />
          <stop offset="50%" stopColor="#FFFFFF" />
          <stop offset="100%" stopColor="#8A9096" />
        </linearGradient>

        <linearGradient id="bladeGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#FFFFFF" />
          <stop offset="100%" stopColor="#B0B5BA" />
        </linearGradient>

        <radialGradient id="hubGrad" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#FFFFFF" />
          <stop offset="70%" stopColor="#C0C6CC" />
          <stop offset="100%" stopColor="#6A6F74" />
        </radialGradient>

        <linearGradient id="pipeGrad" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#D0D5DA" />
          <stop offset="50%" stopColor="#FFFFFF" />
          <stop offset="100%" stopColor="#8A8D92" />
        </linearGradient>

        <filter id="bodyShadow" x="-5%" y="-5%" width="115%" height="115%">
          <feDropShadow dx="2" dy="4" stdDeviation="4" floodColor="#000" floodOpacity="0.25" />
        </filter>

        <clipPath id="fanClip">
          <circle cx={fanCx} cy={fanCy} r={fanR} />
        </clipPath>

        {/* ─── Blade Template ────────────────────────────────────────────── */}
        <g id="blade">
          <path
            d={`M ${fanCx},${fanCy} L ${fanCx-8},${fanCy-30} C ${fanCx-2},${fanCy-38} ${fanCx+2},${fanCy-38} ${fanCx+8},${fanCy-30} Z`}
            fill="url(#bladeGrad)"
            stroke="#8A8D92"
            strokeWidth="0.5"
          />
        </g>
      </defs>

      {/* ─── FLANGE INPUT (KIRI) ────────────────────────────────────────── */}
      <g>
        <rect
          x={flangeInX}
          y={flangeInY}
          width={flangeInW}
          height={flangeInH}
          rx={3}
          fill="url(#flangeGrad)"
          stroke="#6A6F74"
          strokeWidth="1.5"
        />
        <rect
          x={flangeInX + 2}
          y={flangeInY + 2}
          width={flangeInW - 4}
          height={flangeInH - 4}
          rx={1.5}
          fill="none"
          stroke="rgba(255,255,255,0.6)"
        />
        <circle cx={flangeInX + 6} cy={flangeInY + 8} r="2" fill="#555" />
        <circle cx={flangeInX + 14} cy={flangeInY + 8} r="2" fill="#555" />
        <circle cx={flangeInX + 6} cy={flangeInY + flangeInH - 8} r="2" fill="#555" />
        <circle cx={flangeInX + 14} cy={flangeInY + flangeInH - 8} r="2" fill="#555" />

        <rect x={flangeInX + flangeInW - 4} y={flangeInY + 10} width={4} height={8} rx={1} fill="#4A4F54" />
        <rect x={flangeInX + flangeInW - 4} y={flangeInY + 30} width={4} height={8} rx={1} fill="#4A4F54" />
        <rect x={flangeInX + flangeInW - 4} y={flangeInY + 50} width={4} height={8} rx={1} fill="#4A4F54" />
      </g>

      {/* ─── BODY UTAMA ──────────────────────────────────────────────────── */}
      <rect
        x={bodyX}
        y={bodyY}
        width={bodyW}
        height={bodyH}
        rx={6}
        fill="url(#bodyGrad)"
        stroke="#1A3B6E"
        strokeWidth="2"
        filter="url(#bodyShadow)"
      />
      <rect
        x={bodyX + 3}
        y={bodyY + 3}
        width={bodyW - 6}
        height={bodyH - 6}
        rx={3}
        fill="none"
        stroke="rgba(255,255,255,0.2)"
        strokeWidth="1"
      />

      {/* ─── FLANGE OUTPUT (KANAN) ──────────────────────────────────────── */}
      <g>
        <rect
          x={flangeOutX}
          y={flangeOutY}
          width={flangeOutW}
          height={flangeOutH}
          rx={4}
          fill="#1A2B4E"
          stroke="#3A5B7E"
          strokeWidth="2"
        />
        <rect
          x={flangeOutX + 3}
          y={flangeOutY + 3}
          width={flangeOutW - 6}
          height={flangeOutH - 6}
          rx={2}
          fill="none"
          stroke="rgba(255,255,255,0.15)"
        />
        <circle cx={flangeOutX + 8} cy={flangeOutY + 8} r="2.5" fill="#6A7B8E" />
        <circle cx={flangeOutX + flangeOutW - 8} cy={flangeOutY + 8} r="2.5" fill="#6A7B8E" />
        <circle cx={flangeOutX + 8} cy={flangeOutY + flangeOutH - 8} r="2.5" fill="#6A7B8E" />
        <circle cx={flangeOutX + flangeOutW - 8} cy={flangeOutY + flangeOutH - 8} r="2.5" fill="#6A7B8E" />

        <text
          x={flangeOutX + flangeOutW / 2}
          y={flangeOutY + flangeOutH / 2 + 3}
          textAnchor="middle"
          fontSize="9"
          fontWeight="bold"
          fill="#8A9BAE"
          fontFamily="Arial, sans-serif"
          letterSpacing="1"
        >OUT</text>
      </g>

      {/* ─── KIPAS AXIAL ──────────────────────────────────────────────────── */}
      <g>
        {/* Lingkaran background kipas (tidak berputar) */}
        <circle cx={fanCx} cy={fanCy} r={fanR} fill="#1A2B3E" />
        <circle cx={fanCx} cy={fanCy} r={fanR} fill="none" stroke="#3A4B5E" strokeWidth="2" />

        {/* ─── GRUP BERPUTAR ──────────────────────────────────────────────── */}
        {/* Hanya blade dan hub yang berputar, dengan transform-origin di pusat */}
        <g
          className={running ? 'fan-spin' : 'fan-stop'}
          style={{
            transformOrigin: `${fanCx}px ${fanCy}px`,
          }}
        >
          {[0, 60, 120, 180, 240, 300].map((deg) => (
            <use key={deg} href="#blade" transform={`rotate(${deg}, ${fanCx}, ${fanCy})`} />
          ))}

          {/* Hub Tengah (ikut berputar agar sejajar dengan blade) */}
          <circle cx={fanCx} cy={fanCy} r={10} fill="url(#hubGrad)" stroke="#6A6F74" strokeWidth="1.5" />
          <circle cx={fanCx} cy={fanCy} r={6} fill="#1A1F24" />
        </g>
      </g>

      {/* ─── LUBANG PIPA (BAWAH) ────────────────────────────────────────── */}
      <g>
        <rect
          x={pipe1X}
          y={pipeY}
          width={pipeW}
          height={pipeH}
          rx={3}
          fill="url(#pipeGrad)"
          stroke="#6A6F74"
          strokeWidth="1.5"
        />
        <circle cx={pipe1X + pipeW / 2} cy={pipeY + pipeH / 2} r={4} fill="#1A1F24" />
        <rect x={pipe1X} y={pipeY} width={pipeW} height={3} rx={1.5} fill="rgba(255,255,255,0.4)" />

        <rect
          x={pipe2X}
          y={pipeY}
          width={pipeW}
          height={pipeH}
          rx={3}
          fill="url(#pipeGrad)"
          stroke="#6A6F74"
          strokeWidth="1.5"
        />
        <circle cx={pipe2X + pipeW / 2} cy={pipeY + pipeH / 2} r={4} fill="#1A1F24" />
        <rect x={pipe2X} y={pipeY} width={pipeW} height={3} rx={1.5} fill="rgba(255,255,255,0.4)" />
      </g>

      {/* ─── LED INDIKATOR ────────────────────────────────────────────────── */}
      <circle
        cx={bodyX + bodyW - 15}
        cy={bodyY + 15}
        r={5}
        fill={running ? "#00E676" : "#FF1744"}
        stroke="#1A1F24"
        strokeWidth="1"
        className={running ? "led-on" : "led-off"}
      />
    </svg>
  );
};

export default HumidityFan;