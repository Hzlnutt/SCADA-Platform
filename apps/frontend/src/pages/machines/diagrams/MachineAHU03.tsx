import React from "react";

interface DiagramProps {
  tempSP?: number;
  humiditySP?: number;
  running?: boolean;
}

export default function MachineAHU03Diagram({
  tempSP = 20.5,
  humiditySP = 55.0,
  running = true,
}: DiagramProps) {
  return (
    <svg
      viewBox="0 0 1000 600"
      className="w-full h-full max-h-full transition-all duration-350 select-none"
    >
      <defs>
        <style>{`
          @keyframes flow-active-ahu3 {
            to { stroke-dashoffset: -40; }
          }
          @keyframes spin-fan-ahu3 {
            from { transform: rotate(0deg); }
            to { transform: rotate(360deg); }
          }
          @keyframes pulse-uv {
            0%, 100% { opacity: 0.3; }
            50% { opacity: 0.9; }
          }
          .flow-arrow-ahu3 {
            stroke-dasharray: 10, 10;
            animation: flow-active-ahu3 1.8s linear infinite;
          }
          .fan-spinning-ahu3 {
            animation: spin-fan-ahu3 ${running ? "1.1s" : "0s"} linear infinite;
            transform-origin: 750px 300px;
          }
          .uv-glow {
            animation: pulse-uv 2s ease-in-out infinite;
          }
        `}</style>
      </defs>

      {/* Grid Background */}
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
      <path
        d="M 50 300 L 950 300"
        fill="none"
        className="stroke-slate-200 dark:stroke-slate-800"
        strokeWidth="90"
        strokeLinecap="round"
      />
      <path
        d="M 50 300 L 950 300"
        fill="none"
        className="stroke-white dark:stroke-slate-900"
        strokeWidth="84"
        strokeLinecap="round"
      />

      {/* Animated Air Flow */}
      {running && (
        <line
          x1="50"
          y1="300"
          x2="950"
          y2="300"
          fill="none"
          className="stroke-cyan-500/20 dark:stroke-cyan-400/25 flow-arrow-ahu3"
          strokeWidth="60"
          strokeLinecap="round"
        />
      )}

      {/* ================= MULTI-STAGE FILTERS ================= */}
      {/* 1. Pre-Filter */}
      <g transform="translate(140, 260)">
        <rect x="0" y="0" width="20" height="80" rx="2" className="fill-slate-100 dark:fill-slate-800 stroke-slate-400 dark:stroke-slate-650" strokeWidth="2" />
        <path d="M 4 5 L 16 15 L 4 25 L 16 35 L 4 45 L 16 55 L 4 65 L 16 75" fill="none" className="stroke-emerald-500 dark:stroke-emerald-450" strokeWidth="2" />
        <text x="10" y="-10" fontSize="9" className="fill-slate-450 dark:fill-slate-400 font-mono" textAnchor="middle">PRE-F</text>
        <text x="10" y="95" fontSize="9" className="fill-emerald-600 dark:fill-emerald-450 font-bold font-mono" textAnchor="middle">35 Pa</text>
      </g>

      {/* 2. Medium Filter */}
      <g transform="translate(220, 260)">
        <rect x="0" y="0" width="20" height="80" rx="2" className="fill-slate-100 dark:fill-slate-800 stroke-slate-400 dark:stroke-slate-650" strokeWidth="2" />
        <path d="M 4 5 H 16 M 4 20 H 16 M 4 35 H 16 M 4 50 H 16 M 4 65 H 16 M 4 75 H 16" fill="none" className="stroke-sky-500 dark:stroke-sky-400" strokeWidth="2" />
        <text x="10" y="-10" fontSize="9" className="fill-slate-450 dark:fill-slate-400 font-mono" textAnchor="middle">MED-F</text>
        <text x="10" y="95" fontSize="9" className="fill-sky-600 dark:fill-sky-450 font-bold font-mono" textAnchor="middle">85 Pa</text>
      </g>

      {/* 3. HEPA Filter */}
      <g transform="translate(300, 260)">
        <rect x="0" y="0" width="25" height="80" rx="2" className="fill-slate-200 dark:fill-slate-850 stroke-slate-500 dark:stroke-slate-600" strokeWidth="2" />
        <path d="M 3 0 V 80 M 9 0 V 80 M 15 0 V 80 M 21 0 V 80" className="stroke-indigo-500/50 dark:stroke-indigo-400/50" strokeWidth="1.5" />
        <text x="12.5" y="-10" fontSize="9" className="fill-slate-450 dark:fill-slate-400 font-mono" textAnchor="middle">HEPA-F</text>
        <text x="12.5" y="95" fontSize="9" className="fill-indigo-600 dark:fill-indigo-450 font-bold font-mono" textAnchor="middle">145 Pa</text>
      </g>

      {/* ================= UV STERILIZER (Neon Purple Glow) ================= */}
      <g transform="translate(420, 260)">
        <rect x="0" y="0" width="50" height="80" rx="3" className="fill-slate-100 dark:fill-slate-800/80 stroke-slate-400 dark:stroke-slate-650" strokeWidth="2" />
        {/* Glow */}
        {running && (
          <rect x="5" y="5" width="40" height="70" rx="2" className="fill-fuchsia-500/20 dark:fill-fuchsia-400/30 uv-glow" />
        )}
        {/* Lamps */}
        <line x1="18" y1="10" x2="18" y2="70" className="stroke-fuchsia-400 dark:stroke-fuchsia-300" strokeWidth="3" />
        <line x1="32" y1="10" x2="32" y2="70" className="stroke-fuchsia-400 dark:stroke-fuchsia-300" strokeWidth="3" />
        <text x="25" y="-10" fontSize="9" className="fill-slate-450 dark:fill-slate-400 font-mono" textAnchor="middle">UV LAMP</text>
      </g>

      {/* ================= REHEAT COIL ================= */}
      <g transform="translate(560, 260)">
        <rect x="0" y="0" width="30" height="80" rx="3" className="fill-slate-100 dark:fill-slate-850 stroke-slate-400 dark:stroke-slate-650" strokeWidth="2" />
        <path d="M 8 5 V 75 L 15 75 V 5 L 22 5 V 75" fill="none" stroke="#f43f5e" strokeWidth="3" />
        <text x="15" y="-10" fontSize="9" className="fill-slate-450 dark:fill-slate-400 font-mono" textAnchor="middle">REHEAT</text>
      </g>

      {/* ================= BLOWER FAN ================= */}
      <g transform="translate(700, 255)">
        <circle cx="50" cy="45" r="45" className="fill-slate-100 dark:fill-slate-850 stroke-slate-450 dark:stroke-slate-650" strokeWidth="3" />
        
        {/* Spinning Blades */}
        <g className="fan-spinning-ahu3">
          <circle cx="750" cy="300" r="8" className="fill-slate-850 dark:fill-slate-200" />
          <path d="M 746 300 C 746 265 754 265 754 300 Z" className="fill-slate-450 dark:fill-slate-400" />
          <path d="M 750 296 C 785 296 785 304 750 304 Z" className="fill-slate-450 dark:fill-slate-400" />
          <path d="M 746 300 C 746 335 754 335 754 300 Z" className="fill-slate-450 dark:fill-slate-400" />
          <path d="M 750 296 C 715 296 715 304 750 304 Z" className="fill-slate-450 dark:fill-slate-400" />
        </g>
        <text x="50" y="110" fontSize="11" className="fill-slate-700 dark:fill-slate-350 font-bold font-mono" textAnchor="middle">HF-03</text>
      </g>

      {/* ================= SENSORS & ROOM PRES ================= */}
      {/* Sensor box */}
      <g transform="translate(850, 200)">
        <rect x="0" y="0" width="120" height="70" rx="8" className="fill-white dark:fill-slate-900 stroke-slate-200 dark:stroke-slate-800 shadow-md" strokeWidth="2.5" />
        <rect x="0" y="0" width="120" height="24" rx="8" className="fill-indigo-500/10 dark:fill-indigo-400/10" />
        <text x="60" y="16" fontSize="10" className="fill-indigo-600 dark:fill-indigo-450 font-bold font-mono" textAnchor="middle">R.THD-03</text>
        <text x="15" y="42" fontSize="12" className="fill-slate-700 dark:fill-slate-300 font-semibold">T_Room: {tempSP.toFixed(1)} °C</text>
        <text x="15" y="60" fontSize="12" className="fill-slate-700 dark:fill-slate-300 font-semibold">H_Room: {humiditySP.toFixed(1)} %</text>
      </g>
    </svg>
  );
}