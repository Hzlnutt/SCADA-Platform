import React, { useId } from "react";

interface PumpMotorProps {
  x?: number;
  y?: number;
  size?: number;
  on?: boolean;
}

const PumpMotor: React.FC<PumpMotorProps> = ({
  x = 0,
  y = 0,
  size = 100,
  on = false,
}) => {
  const uid = useId();
  const s = (v: number) => (v / 100) * size;

  // ─── Gradient Definitions (Persis dari YStrainer) ──────────────────────
  const gPipe   = `pipe_${uid}`; // -bv style
  const gFlange = `flange_${uid}`; // -fl style
  const gHub    = `hub_${uid}`; // -hub style

  return (
    <g transform={`translate(${x}, ${y})`}>
      <defs>
        {/* Gradasi Body Pipa (-bv) */}
        <linearGradient id={gPipe} x1="0" y1="0" x2="1" y2="0" gradientUnits="objectBoundingBox">
          <stop offset="0%"   stopColor="#5a5b5c" />
          <stop offset="2%"   stopColor="#5a5b5c" />
          <stop offset="15%"  stopColor="#909090" />
          <stop offset="48%"  stopColor="#e8e8e8" />
          <stop offset="82%"  stopColor="#b0b0b0" />
          <stop offset="100%" stopColor="#6a6a6a" />
        </linearGradient>

        {/* Gradasi Flange (-fl) */}
        <linearGradient id={gFlange} x1="0" y1="0" x2="0" y2="1" gradientUnits="objectBoundingBox">
          <stop offset="0%"   stopColor="#4a4b4c" />
          <stop offset="15%"  stopColor="#787878" />
          <stop offset="50%"  stopColor="#c8c8c8" />
          <stop offset="82%"  stopColor="#909090" />
          <stop offset="100%" stopColor="#505050" />
        </linearGradient>

        {/* Gradasi Hub / Motor (-hub) */}
        <linearGradient id={gHub} x1="0" y1="0" x2="1" y2="0" gradientUnits="objectBoundingBox">
          <stop offset="0%"   stopColor="#4a4b4c" />
          <stop offset="18%"  stopColor="#888888" />
          <stop offset="50%"  stopColor="#dedede" />
          <stop offset="82%"  stopColor="#a0a0a0" />
          <stop offset="100%" stopColor="#505050" />
        </linearGradient>
      </defs>

      {/* ─── BASE BOTTOM (Gaya Flange) ───────────────────────────────────── */}
      <path
        d={`M${s(25)},${s(85)} L${s(35)},${s(95)} L${s(65)},${s(95)} L${s(75)},${s(85)} Z`}
        fill={`url(#${gFlange})`}
      />
      <path
        d={`M${s(25)},${s(85)} L${s(35)},${s(95)} L${s(65)},${s(95)} L${s(75)},${s(85)} Z`}
        fill="none"
        stroke="#3a3b3c"
        strokeWidth={s(2)}
        opacity={0.5}
      >
        {on && (
          <animate
            attributeName="stroke"
            values="#3a3b3c;#00E676;#3a3b3c"
            dur="2.5s"
            repeatCount="indefinite"
          />
        )}
      </path>

      {/* ─── BODY UTAMA (Gaya Pipa) ──────────────────────────────────────── */}
      <rect
        x={s(25)}
        y={s(30)}
        width={s(50)}
        height={s(55)}
        fill={`url(#${gPipe})`}
      />
      
      {/* ─── OUTLINE TERLUAR BODY ────────────────────────────────────────── */}
      <rect
        x={s(25)}
        y={s(30)}
        width={s(50)}
        height={s(55)}
        fill="none"
        stroke="#3a3b3c"
        strokeWidth={s(2)}
      >
        {on && (
          <animate
            attributeName="stroke"
            values="#3a3b3c;#00E676;#3a3b3c"
            dur="2.5s"
            repeatCount="indefinite"
          />
        )}
      </rect>

      {/* ─── SIRIP PENDINGIN (Warna Solid seperti edge) ──────────────────── */}
      {/* Sirip kiri */}
      {[27, 29, 31, 33, 35].map((xPos) => (
        <rect
          key={`l-${xPos}`}
          x={s(xPos)}
          y={s(32)}
          width={s(1.5)}
          height={s(51)}
          fill="#3a3b3c"
        />
      ))}
      {/* Sirip kanan */}
      {[65, 67, 69, 71, 73].map((xPos) => (
        <rect
          key={`r-${xPos}`}
          x={s(xPos)}
          y={s(32)}
          width={s(1.5)}
          height={s(51)}
          fill="#3a3b3c"
        />
      ))}

      {/* ─── FLANGE ATAS (Gaya Flange) ────────────────────────────────────── */}
      <rect
        x={s(22)}
        y={s(26)}
        width={s(56)}
        height={s(5)}
        fill={`url(#${gFlange})`}
        rx={s(1)}
      />
      <rect
        x={s(22)}
        y={s(26)}
        width={s(56)}
        height={s(2.5)}
        fill="#ffffff"
        opacity={0.15}
        rx={s(1)}
      />
      {/* Outline flange atas */}
      <rect
        x={s(22)}
        y={s(26)}
        width={s(56)}
        height={s(5)}
        fill="none"
        stroke="#3a3b3c"
        strokeWidth={s(2)}
        rx={s(1)}
      >
        {on && (
          <animate
            attributeName="stroke"
            values="#3a3b3c;#00E676;#3a3b3c"
            dur="2.5s"
            repeatCount="indefinite"
          />
        )}
      </rect>

      {/* ─── SHAFT ATAS (Gaya Pipa) ──────────────────────────────────────── */}
      <rect
        x={s(42)}
        y={s(10)}
        width={s(16)}
        height={s(16)}
        fill={`url(#${gPipe})`}
        rx={s(1)}
      />
      <rect
        x={s(42)}
        y={s(10)}
        width={s(16)}
        height={s(8)}
        fill="#ffffff"
        opacity={0.1}
        rx={s(1)}
      />
      <line
        x1={s(42)}
        y1={s(18)}
        x2={s(58)}
        y2={s(18)}
        stroke="#3a3b3c"
        strokeWidth={s(0.5)}
      />
      {/* Outline shaft atas */}
      <rect
        x={s(42)}
        y={s(10)}
        width={s(16)}
        height={s(16)}
        fill="none"
        stroke="#3a3b3c"
        strokeWidth={s(1)}
        rx={s(1)}
      >
        {on && (
          <animate
            attributeName="stroke"
            values="#3a3b3c;#00E676;#3a3b3c"
            dur="2.5s"
            repeatCount="indefinite"
          />
        )}
      </rect>

      {/* ─── MOTOR DI TENGAH (Gaya Hub) ────────────────────────────────────── */}
      <g>
        {/* Cincin luar motor */}
        <circle cx={s(50)} cy={s(57)} r={s(18)} fill={`url(#${gHub})`} />

        {/* Baut pada cincin luar */}
        {[0, 45, 90, 135, 180, 225, 270, 315].map((deg) => (
          <circle
            key={deg}
            cx={s(50 + 16 * Math.cos((deg * Math.PI) / 180))}
            cy={s(57 + 16 * Math.sin((deg * Math.PI) / 180))}
            r={s(1.5)}
            fill="#1f2937"
          />
        ))}

        {/* Cincin dalam */}
        <circle cx={s(50)} cy={s(57)} r={s(10)} fill="#1f2937" />

        {/* Sirip rotor di dalam */}
        {[0, 30, 60, 90, 120, 150, 180, 210, 240, 270, 300, 330].map((deg) => (
          <rect
            key={deg}
            x={s(50 + 8 * Math.cos((deg * Math.PI) / 180) - 1)}
            y={s(57 + 8 * Math.sin((deg * Math.PI) / 180) - 4)}
            width={s(2)}
            height={s(8)}
            fill="#a0a0a0"
            transform={`rotate(${deg + 90}, ${s(50 + 8 * Math.cos((deg * Math.PI) / 180))}, ${s(57 + 8 * Math.sin((deg * Math.PI) / 180))})`}
          />
        ))}

        {/* Hub tengah */}
        <circle cx={s(50)} cy={s(57)} r={s(4)} fill="#c8c8c8" />
        <circle cx={s(50)} cy={s(57)} r={s(2)} fill="#3a3b3c" />

        {/* Animasi rotor */}
        {on && (
          <animateTransform
            attributeName="transform"
            type="rotate"
            from={`0 ${s(50)} ${s(57)}`}
            to={`360 ${s(50)} ${s(57)}`}
            dur="1s"
            repeatCount="indefinite"
          />
        )}
      </g>

      {/* ─── HIGHLIGHT & SHADOW (Gaya YStrainer) ──────────────────────────── */}
      {/* Highlight silinder */}
      <rect
        x={s(36)}
        y={s(32)}
        width={s(6)}
        height={s(51)}
        fill="#ffffff"
        opacity={0.08}
      />
      {/* Shadow di base */}
      <path
        d={`M${s(25)},${s(85)} L${s(27)},${s(88)} L${s(73)},${s(88)} L${s(75)},${s(85)} Z`}
        fill="#0a0a0a"
        opacity={0.45}
      />
    </g>
  );
};

export default PumpMotor;