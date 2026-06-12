import React from "react";

interface DiagramProps {
  tempSP?: number;
  humiditySP?: number;
  running?: boolean;
}

export default function MachineAHU02Diagram({
  tempSP = 22.4,
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
          @keyframes flow-active-ahu2 {
            to { stroke-dashoffset: -40; }
          }
          @keyframes spin-fan-ahu2 {
            from { transform: rotate(0deg); }
            to { transform: rotate(360deg); }
          }
          .flow-arrow-ahu2 {
            stroke-dasharray: 12, 8;
            animation: flow-active-ahu2 2.2s linear infinite;
          }
          .fan-spinning-ahu2 {
            animation: spin-fan-ahu2 ${running ? "1.2s" : "0s"} linear infinite;
            transform-origin: 320px 420px;
          }
        `}</style>
        
        {/* Gradients */}
        <linearGradient id="pipeCooling2" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#2563eb" />
          <stop offset="50%" stopColor="#38bdf8" />
          <stop offset="100%" stopColor="#1d4ed8" />
        </linearGradient>
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

      {/* ================= DUCT SYSTEM (Vertical Flow) ================= */}
      {/* Horizontal Intake -> Vertically Down -> Horizontal Supply */}
      <path
        d="M 50 180 L 320 180 L 320 420 L 950 420"
        fill="none"
        className="stroke-slate-200 dark:stroke-slate-800"
        strokeWidth="110"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M 50 180 L 320 180 L 320 420 L 950 420"
        fill="none"
        className="stroke-white dark:stroke-slate-900"
        strokeWidth="104"
        strokeLinecap="round"
        strokeLinejoin="round"
      />

      {/* Animated Flow */}
      {running && (
        <path
          d="M 50 180 L 320 180 L 320 420 L 950 420"
          fill="none"
          className="stroke-sky-400/20 dark:stroke-sky-400/25 flow-arrow-ahu2"
          strokeWidth="75"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      )}

      {/* ================= COMPONENTS ================= */}
      {/* Fresh Air Intake */}
      <g transform="translate(80, 135)">
        <rect x="0" y="0" width="30" height="90" rx="3" className="fill-slate-100 dark:fill-slate-800 stroke-slate-350 dark:stroke-slate-650" strokeWidth="2" />
        <line x1="15" y1="0" x2="15" y2="90" className="stroke-slate-400 dark:stroke-slate-500" strokeWidth="2" />
        <line x1="5" y1="22" x2="25" y2="22" className="stroke-cyan-500 dark:stroke-cyan-400" strokeWidth="3" />
        <line x1="5" y1="45" x2="25" y2="45" className="stroke-cyan-500 dark:stroke-cyan-400" strokeWidth="3" />
        <line x1="5" y1="68" x2="25" y2="68" className="stroke-cyan-500 dark:stroke-cyan-400" strokeWidth="3" />
        <text x="15" y="-10" fontSize="10" className="fill-slate-450 dark:fill-slate-400 font-mono" textAnchor="middle">AIR IN</text>
      </g>

      {/* Pre-Filter */}
      <g transform="translate(180, 135)">
        <rect x="0" y="0" width="25" height="90" rx="2" className="fill-slate-100 dark:fill-slate-800 stroke-slate-400 dark:stroke-slate-650" strokeWidth="2" />
        <path d="M 5 5 L 20 15 L 5 25 L 20 35 L 5 45 L 20 55 L 5 65 L 20 75 L 5 85" fill="none" className="stroke-emerald-500 dark:stroke-emerald-450" strokeWidth="2" />
        <text x="12.5" y="-10" fontSize="10" className="fill-slate-450 dark:fill-slate-400 font-mono" textAnchor="middle">PRE-F</text>
      </g>

      {/* DUAL STAGE COOLING COIL (Vertical Section) */}
      <g transform="translate(275, 250)">
        <rect x="0" y="0" width="90" height="30" rx="3" className="fill-slate-150 dark:fill-slate-800 stroke-slate-400 dark:stroke-slate-650" strokeWidth="2" />
        <path d="M 5 8 H 85 M 5 15 H 85 M 5 22 H 85" stroke="url(#pipeCooling2)" strokeWidth="3" />
        <text x="100" y="20" fontSize="10" className="fill-slate-450 dark:fill-slate-400 font-mono">CHILLER COIL-1</text>
      </g>

      <g transform="translate(275, 300)">
        <rect x="0" y="0" width="90" height="30" rx="3" className="fill-slate-150 dark:fill-slate-800 stroke-slate-400 dark:stroke-slate-650" strokeWidth="2" />
        <path d="M 5 8 H 85 M 5 15 H 85 M 5 22 H 85" stroke="url(#pipeCooling2)" strokeWidth="3" />
        <text x="100" y="20" fontSize="10" className="fill-slate-450 dark:fill-slate-400 font-mono">CHILLER COIL-2</text>
      </g>

      {/* HEATING COIL (Horizontal Section) */}
      <g transform="translate(480, 375)">
        <rect x="0" y="0" width="35" height="90" rx="3" className="fill-slate-150 dark:fill-slate-800 stroke-slate-400 dark:stroke-slate-650" strokeWidth="2" />
        <path d="M 10 5 V 85 L 18 85 V 5 L 26 5 V 85" fill="none" stroke="#ef4444" strokeWidth="3.5" />
        <text x="17.5" y="-10" fontSize="10" className="fill-slate-450 dark:fill-slate-400 font-mono" textAnchor="middle">REHEAT</text>
      </g>

      {/* BLOWER FAN (Vertical Section transition) */}
      <g transform="translate(320, 420)">
        <circle cx="0" cy="0" r="45" className="fill-slate-100 dark:fill-slate-850 stroke-slate-450 dark:stroke-slate-650" strokeWidth="3" />
        
        {/* Spinning Blades */}
        <g className="fan-spinning-ahu2">
          <circle cx="320" cy="420" r="8" className="fill-slate-800 dark:fill-slate-200" />
          <path d="M 316 420 C 316 385 324 385 324 420 Z" className="fill-slate-450 dark:fill-slate-400" />
          <path d="M 320 416 C 355 416 355 424 320 424 Z" className="fill-slate-450 dark:fill-slate-400" />
          <path d="M 316 420 C 316 455 324 455 324 420 Z" className="fill-slate-450 dark:fill-slate-400" />
          <path d="M 320 416 C 285 416 285 424 320 424 Z" className="fill-slate-450 dark:fill-slate-400" />
        </g>
        <text x="0" y="65" fontSize="11" className="fill-slate-700 dark:fill-slate-350 font-bold font-mono" textAnchor="middle">HF-02</text>
      </g>

      {/* SENSORS */}
      <g transform="translate(720, 385)">
        <rect x="0" y="0" width="130" height="70" rx="8" className="fill-white dark:fill-slate-900 stroke-slate-200 dark:stroke-slate-800 shadow-md" strokeWidth="2.5" />
        <rect x="0" y="0" width="130" height="24" rx="8" className="fill-cyan-500/10 dark:fill-cyan-400/10" />
        <text x="65" y="16" fontSize="10" className="fill-cyan-600 dark:fill-cyan-400 font-bold font-mono" textAnchor="middle">R.THD-02A</text>
        <text x="15" y="42" fontSize="12" className="fill-slate-700 dark:fill-slate-300 font-semibold">T: {tempSP.toFixed(1)} °C</text>
        <text x="15" y="60" fontSize="12" className="fill-slate-700 dark:fill-slate-300 font-semibold">H: {humiditySP.toFixed(1)} %</text>
      </g>
    </svg>
  );
}