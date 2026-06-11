import React from "react";

interface DiagramProps {
  tempSP?: number;
  humiditySP?: number;
  running?: boolean;
}

export default function MachineAHU01Diagram({
  tempSP = 46.8,
  humiditySP = 75.0,
  running = true,
}: DiagramProps) {
  return (
    <svg
      viewBox="0 0 1000 600"
      className="w-full h-full max-h-full transition-all duration-350 select-none"
    >
      <defs>
        <style>{`
          @keyframes flow-active {
            to { stroke-dashoffset: -40; }
          }
          @keyframes spin-fan {
            from { transform: rotate(0deg); }
            to { transform: rotate(360deg); }
          }
          .flow-arrow {
            stroke-dasharray: 12, 8;
            animation: flow-active 2s linear infinite;
          }
          .fan-spinning {
            animation: spin-fan ${running ? "1.5s" : "0s"} linear infinite;
            transform-origin: 730px 300px;
          }
        `}</style>

        {/* Gradients */}
        <linearGradient id="pipeCooling" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#3b82f6" />
          <stop offset="50%" stopColor="#60a5fa" />
          <stop offset="100%" stopColor="#1d4ed8" />
        </linearGradient>
        <linearGradient id="pipeHeating" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#ef4444" />
          <stop offset="50%" stopColor="#f87171" />
          <stop offset="100%" stopColor="#b91c1c" />
        </linearGradient>
      </defs>

      {/* Grid Background Pattern */}
      <rect width="1000" height="600" rx="8" className="fill-slate-50/20 dark:fill-slate-950/20" />
      <g className="stroke-slate-200/40 dark:stroke-slate-800/30" strokeWidth="0.5">
        {Array.from({ length: 20 }).map((_, i) => (
          <line key={`x-${i}`} x1={i * 50} y1="0" x2={i * 50} y2="600" />
        ))}
        {Array.from({ length: 12 }).map((_, i) => (
          <line key={`y-${i}`} x1="0" y1={i * 50} x2="1000" y2={i * 50} />
        ))}
      </g>

      {/* ================= DUCT SYSTEM ================= */}
      {/* Main Air Flow Duct */}
      <path
        d="M 50 300 L 150 300 L 150 250 L 850 250 L 850 350 L 950 350"
        fill="none"
        className="stroke-slate-200 dark:stroke-slate-800"
        strokeWidth="100"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M 50 300 L 150 300 L 150 250 L 850 250 L 850 350 L 950 350"
        fill="none"
        className="stroke-white dark:stroke-slate-900"
        strokeWidth="94"
        strokeLinecap="round"
        strokeLinejoin="round"
      />

      {/* Return Duct (Mixing) */}
      <path
        d="M 850 200 L 850 120 L 250 120 L 250 210"
        fill="none"
        className="stroke-slate-200 dark:stroke-slate-800"
        strokeWidth="50"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M 850 200 L 850 120 L 250 120 L 250 210"
        fill="none"
        className="stroke-white dark:stroke-slate-900"
        strokeWidth="44"
        strokeLinecap="round"
        strokeLinejoin="round"
      />

      {/* Animated Flow inside Main Duct */}
      {running && (
        <path
          d="M 50 300 L 150 300 L 150 250 L 850 250 L 850 350 L 950 350"
          fill="none"
          className="stroke-cyan-500/20 dark:stroke-cyan-400/25 flow-arrow"
          strokeWidth="70"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      )}

      {/* ================= COMPONENTS ================= */}
      {/* 1. FRESH AIR INTAKE DAMPER */}
      <g transform="translate(80, 260)">
        <rect x="0" y="0" width="30" height="80" rx="3" className="fill-slate-100 dark:fill-slate-800 stroke-slate-300 dark:stroke-slate-700" strokeWidth="2" />
        <line x1="15" y1="0" x2="15" y2="80" className="stroke-slate-400 dark:stroke-slate-500" strokeWidth="2" />
        {/* Damper blades */}
        <line x1="5" y1="20" x2="25" y2="20" className="stroke-cyan-500 dark:stroke-cyan-400" strokeWidth="3" />
        <line x1="5" y1="40" x2="25" y2="40" className="stroke-cyan-500 dark:stroke-cyan-400" strokeWidth="3" />
        <line x1="5" y1="60" x2="25" y2="60" className="stroke-cyan-500 dark:stroke-cyan-400" strokeWidth="3" />
        <text x="15" y="-10" fontSize="10" className="fill-slate-450 dark:fill-slate-400 font-mono" textAnchor="middle">INTAKE</text>
      </g>

      {/* 2. PRE-FILTER */}
      <g transform="translate(200, 205)">
        <rect x="0" y="0" width="25" height="90" rx="2" className="fill-slate-100 dark:fill-slate-800 stroke-slate-400 dark:stroke-slate-600" strokeWidth="2" />
        {/* Filter Mesh Zig-zag pattern */}
        <path d="M 5 5 L 20 15 L 5 25 L 20 35 L 5 45 L 20 55 L 5 65 L 20 75 L 5 85" fill="none" className="stroke-emerald-500 dark:stroke-emerald-450" strokeWidth="2" />
        <text x="12.5" y="-10" fontSize="10" className="fill-slate-450 dark:fill-slate-400 font-mono" textAnchor="middle">PRE-F</text>
      </g>

      {/* 3. BAG FILTER */}
      <g transform="translate(260, 205)">
        <rect x="0" y="0" width="30" height="90" rx="2" className="fill-slate-100 dark:fill-slate-800 stroke-slate-400 dark:stroke-slate-600" strokeWidth="2" />
        {/* Bags representation */}
        <path d="M 5 15 L 25 15 M 5 45 L 25 45 M 5 75 L 25 75" className="stroke-sky-500 dark:stroke-sky-400" strokeWidth="3" />
        <text x="15" y="-10" fontSize="10" className="fill-slate-450 dark:fill-slate-400 font-mono" textAnchor="middle">BAG-F</text>
      </g>

      {/* 4. COOLING COIL */}
      <g transform="translate(360, 205)">
        <rect x="0" y="0" width="30" height="90" rx="3" className="fill-slate-150 dark:fill-slate-800/90 stroke-slate-400 dark:stroke-slate-600" strokeWidth="2" />
        {/* Cooling loops */}
        <path d="M 8 5 V 85 L 15 85 V 5 L 22 5 V 85" fill="none" stroke="url(#pipeCooling)" strokeWidth="3" />
        <text x="15" y="-10" fontSize="10" className="fill-slate-450 dark:fill-slate-400 font-mono" textAnchor="middle">COOL-C</text>
      </g>

      {/* 5. HEATING COIL */}
      <g transform="translate(420, 205)">
        <rect x="0" y="0" width="30" height="90" rx="3" className="fill-slate-150 dark:fill-slate-800/90 stroke-slate-400 dark:stroke-slate-600" strokeWidth="2" />
        {/* Heating loops */}
        <path d="M 8 5 V 85 L 15 85 V 5 L 22 5 V 85" fill="none" stroke="url(#pipeHeating)" strokeWidth="3" />
        <text x="15" y="-10" fontSize="10" className="fill-slate-450 dark:fill-slate-400 font-mono" textAnchor="middle">HEAT-C</text>
      </g>

      {/* 6. HUMIDIFIER */}
      <g transform="translate(520, 205)">
        <rect x="0" y="0" width="40" height="90" rx="3" className="fill-slate-100 dark:fill-slate-800 stroke-slate-400 dark:stroke-slate-600" strokeWidth="2" />
        {/* Humidifier nozzles */}
        <circle cx="20" cy="25" r="4" className="fill-cyan-500 animate-pulse" />
        <circle cx="20" cy="45" r="4" className="fill-cyan-500 animate-pulse" />
        <circle cx="20" cy="65" r="4" className="fill-cyan-500 animate-pulse" />
        {/* Steam spray */}
        <path d="M 24 25 C 30 20 35 25 35 25 M 24 45 C 30 40 35 45 35 45 M 24 65 C 30 60 35 65 35 65" fill="none" className="stroke-cyan-300 dark:stroke-cyan-600" strokeWidth="1.5" />
        <text x="20" y="-10" fontSize="10" className="fill-slate-450 dark:fill-slate-400 font-mono" textAnchor="middle">HUMID</text>
      </g>

      {/* 7. BLOWER FAN (HF-01) */}
      <g transform="translate(680, 205)">
        {/* Fan Housing */}
        <circle cx="50" cy="95" r="55" className="fill-slate-100 dark:fill-slate-800 stroke-slate-450 dark:stroke-slate-600" strokeWidth="3" />
        <path d="M -5 95 H 105" className="stroke-slate-400 dark:stroke-slate-600" strokeWidth="2" />

        {/* Spinning Blades */}
        <g className="fan-spinning">
          <circle cx="730" cy="300" r="10" className="fill-slate-800 dark:fill-slate-200" />
          {/* Blade 1 */}
          <path d="M 725 300 C 725 260 735 260 735 300 Z" className="fill-slate-500 dark:fill-slate-400" />
          {/* Blade 2 */}
          <path d="M 730 295 C 770 295 770 305 730 305 Z" className="fill-slate-500 dark:fill-slate-400" />
          {/* Blade 3 */}
          <path d="M 725 300 C 725 340 735 340 735 300 Z" className="fill-slate-500 dark:fill-slate-400" />
          {/* Blade 4 */}
          <path d="M 730 295 C 690 295 690 305 730 305 Z" className="fill-slate-500 dark:fill-slate-400" />
        </g>
        <text x="50" y="165" fontSize="11" className="fill-slate-700 dark:fill-slate-350 font-bold font-mono" textAnchor="middle">HF-01 (Supply)</text>
      </g>

      {/* ================= SENSORS & VALVES ================= */}
      {/* Room Supply Air Sensor Box */}
      <g transform="translate(860, 420)">
        <rect x="0" y="0" width="120" height="70" rx="8" className="fill-white dark:fill-slate-900 stroke-slate-200 dark:stroke-slate-800 shadow-lg" strokeWidth="2.5" />
        <rect x="0" y="0" width="120" height="24" rx="8" className="fill-cyan-500/10 dark:fill-cyan-400/10" />
        <text x="60" y="16" fontSize="10" className="fill-cyan-600 dark:fill-cyan-400 font-bold font-mono" textAnchor="middle">R.THD-01A</text>
        <text x="15" y="42" fontSize="12" className="fill-slate-700 dark:fill-slate-300 font-semibold">T: {tempSP.toFixed(1)} °C</text>
        <text x="15" y="60" fontSize="12" className="fill-slate-700 dark:fill-slate-300 font-semibold">H: {humiditySP.toFixed(1)} %</text>
      </g>

      {/* Fresh Air Sensor Box */}
      <g transform="translate(40, 160)">
        <rect x="0" y="0" width="100" height="55" rx="6" className="fill-white dark:fill-slate-900 stroke-slate-200 dark:stroke-slate-800" strokeWidth="2" />
        <rect x="0" y="0" width="100" height="20" rx="6" className="fill-slate-100 dark:fill-slate-800" />
        <text x="50" y="14" fontSize="9" className="fill-slate-500 dark:fill-slate-400 font-bold font-mono" textAnchor="middle">OUTDOOR</text>
        <text x="10" y="34" fontSize="10" className="fill-slate-600 dark:fill-slate-300 font-mono">T: 31.2 °C</text>
        <text x="10" y="48" fontSize="10" className="fill-slate-600 dark:fill-slate-300 font-mono">H: 82.0 %</text>
      </g>

      {/* Filter Status Badge */}
      <g transform="translate(210, 110)">
        <rect x="0" y="0" width="70" height="22" rx="4" className="fill-emerald-50 dark:fill-emerald-950/20 stroke-emerald-200 dark:stroke-emerald-800/40" strokeWidth="1" />
        <circle cx="10" cy="11" r="3.5" className="fill-emerald-500" />
        <text x="40" y="15" fontSize="9" className="fill-emerald-600 dark:fill-emerald-400 font-bold font-mono" textAnchor="middle">OK</text>
      </g>
    </svg>
  );
}