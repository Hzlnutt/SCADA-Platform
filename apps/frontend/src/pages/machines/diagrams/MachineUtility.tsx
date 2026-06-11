import React from "react";

interface DiagramProps {
  tempSP?: number;
  humiditySP?: number;
  running?: boolean;
}

export default function MachineUtilityDiagram({
  tempSP = 22.0,
  humiditySP = 60.0,
  running = true,
}: DiagramProps) {
  return (
    <svg
      viewBox="0 0 1000 600"
      className="w-full h-full max-h-full transition-all duration-350 select-none"
    >
      <defs>
        <style>{`
          @keyframes water-flow {
            to { stroke-dashoffset: -30; }
          }
          @keyframes rotate-pump {
            from { transform: rotate(0deg); }
            to { transform: rotate(360deg); }
          }
          .pipe-flow-water {
            stroke-dasharray: 8, 8;
            animation: water-flow ${running ? "1.5s" : "0s"} linear infinite;
          }
          .pipe-flow-steam {
            stroke-dasharray: 6, 12;
            animation: water-flow ${running ? "1s" : "0s"} linear infinite;
          }
          .pump-spin {
            animation: rotate-pump ${running ? "2s" : "0s"} linear infinite;
            transform-origin: 220px 200px;
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

      {/* ================= LOOP 1: CHILLED WATER SYSTEM (BLUE) ================= */}
      {/* Pipes */}
      <path
        d="M 100 200 H 600 V 280 H 100 Z"
        fill="none"
        className="stroke-blue-200 dark:stroke-blue-900/60"
        strokeWidth="24"
        strokeLinejoin="round"
      />
      <path
        d="M 100 200 H 600 V 280 H 100 Z"
        fill="none"
        className="stroke-blue-500 dark:stroke-blue-700"
        strokeWidth="16"
        strokeLinejoin="round"
      />
      {/* Flow animation */}
      <path
        d="M 100 200 H 600 V 280 H 100 Z"
        fill="none"
        className="stroke-white/50 dark:stroke-sky-300/45 pipe-flow-water"
        strokeWidth="6"
        strokeLinejoin="round"
      />

      {/* Chilled Water Pump */}
      <g transform="translate(190, 170)">
        <circle cx="30" cy="30" r="28" className="fill-white dark:fill-slate-900 stroke-blue-600 dark:stroke-blue-400" strokeWidth="3.5" />
        {/* Pump impeller */}
        <g className="pump-spin">
          <circle cx="220" cy="200" r="4" className="fill-slate-800 dark:fill-slate-200" />
          <line x1="220" y1="180" x2="220" y2="220" className="stroke-slate-500 dark:stroke-slate-400" strokeWidth="3.5" />
          <line x1="200" y1="200" x2="240" y2="200" className="stroke-slate-500 dark:stroke-slate-400" strokeWidth="3.5" />
        </g>
        <text x="30" y="72" fontSize="10" className="fill-slate-800 dark:fill-slate-200 font-bold font-mono" textAnchor="middle">CHW-PUMP</text>
      </g>

      {/* Heat Exchanger unit representation */}
      <g transform="translate(480, 160)">
        <rect x="0" y="0" width="80" height="150" rx="6" className="fill-white dark:fill-slate-900 stroke-slate-350 dark:stroke-slate-750" strokeWidth="2.5" />
        <path d="M 10 20 L 70 40 L 10 60 L 70 80 L 10 100 L 70 120" fill="none" className="stroke-slate-300 dark:stroke-slate-700" strokeWidth="3" />
        <text x="40" y="-10" fontSize="10" className="fill-slate-450 dark:fill-slate-400 font-mono" textAnchor="middle">EVAPORATOR</text>
      </g>

      {/* Sensor Temp */}
      <g transform="translate(320, 120)">
        <rect x="0" y="0" width="110" height="50" rx="6" className="fill-white dark:fill-slate-900 stroke-blue-300 dark:stroke-blue-900" strokeWidth="2" />
        <text x="55" y="16" fontSize="9" className="fill-blue-500 font-bold font-mono" textAnchor="middle">TE-LOOP-TEMP</text>
        <text x="55" y="38" fontSize="13" className="fill-slate-800 dark:fill-slate-250 font-bold font-mono" textAnchor="middle">{tempSP.toFixed(1)} °C</text>
      </g>


      {/* ================= LOOP 2: STEAM LINE (RED/ORANGE) ================= */}
      {/* Steam pipeline */}
      <path
        d="M 100 390 H 800 V 430"
        fill="none"
        className="stroke-red-200 dark:stroke-red-950/60"
        strokeWidth="20"
      />
      <path
        d="M 100 390 H 800 V 430"
        fill="none"
        className="stroke-red-500 dark:stroke-red-700"
        strokeWidth="12"
      />
      <path
        d="M 100 390 H 800 V 430"
        fill="none"
        className="stroke-white/50 dark:stroke-rose-300/40 pipe-flow-steam"
        strokeWidth="4"
      />

      {/* Steam Modulating Valve */}
      <g transform="translate(350, 365)">
        <polygon points="0,5 0,45 30,25" className="fill-slate-200 dark:fill-slate-850 stroke-red-650" strokeWidth="2" />
        <polygon points="60,5 60,45 30,25" className="fill-slate-200 dark:fill-slate-850 stroke-red-650" strokeWidth="2" />
        <circle cx="30" cy="25" r="6" className="fill-red-500" />
        {/* Actuator */}
        <line x1="30" y1="20" x2="30" y2="0" className="stroke-slate-500 dark:stroke-slate-400" strokeWidth="2.5" />
        <rect x="15" y="-10" width="30" height="10" rx="2" className="fill-slate-300 dark:fill-slate-750 stroke-slate-500" />
        <text x="30" y="-18" fontSize="9" className="fill-slate-800 dark:fill-slate-300 font-mono" textAnchor="middle">TCV-01 (15%)</text>
      </g>

      {/* Humidity transmitter */}
      <g transform="translate(620, 310)">
        <rect x="0" y="0" width="110" height="50" rx="6" className="fill-white dark:fill-slate-900 stroke-red-300 dark:stroke-red-900" strokeWidth="2" />
        <text x="55" y="16" fontSize="9" className="fill-red-500 font-bold font-mono" textAnchor="middle">HE-LOOP-HUMID</text>
        <text x="55" y="38" fontSize="13" className="fill-slate-800 dark:fill-slate-250 font-bold font-mono" textAnchor="middle">{humiditySP.toFixed(1)} %</text>
      </g>


      {/* ================= LOOP 3: COMPRESSED AIR SYSTEM (GREEN) ================= */}
      {/* Air line */}
      <path
        d="M 100 500 H 750"
        fill="none"
        className="stroke-emerald-250 dark:stroke-emerald-950/60"
        strokeWidth="16"
      />
      <path
        d="M 100 500 H 750"
        fill="none"
        className="stroke-emerald-500 dark:stroke-emerald-650"
        strokeWidth="10"
      />
      <path
        d="M 100 500 H 750"
        fill="none"
        className="stroke-white/40 dark:stroke-emerald-300/30 pipe-flow-water"
        strokeWidth="3"
      />

      {/* Receiver Tank */}
      <g transform="translate(680, 460)">
        <rect x="0" y="0" width="80" height="80" rx="20" className="fill-white dark:fill-slate-900 stroke-emerald-600 dark:stroke-emerald-500" strokeWidth="2.5" />
        <line x1="20" y1="0" x2="20" y2="80" className="stroke-emerald-500/10" />
        <line x1="40" y1="0" x2="40" y2="80" className="stroke-emerald-500/10" />
        <line x1="60" y1="0" x2="60" y2="80" className="stroke-emerald-500/10" />
        <text x="40" y="44" fontSize="11" className="fill-slate-800 dark:fill-slate-200 font-extrabold font-mono" textAnchor="middle">AIR TANK</text>
        <text x="40" y="58" fontSize="9" className="fill-emerald-600 dark:fill-emerald-400 font-bold font-mono" textAnchor="middle">6.5 Bar</text>
      </g>

      {/* Labels */}
      <text x="100" y="150" fontSize="12" className="fill-slate-400 dark:fill-slate-500 font-bold font-mono">CHILLED WATER LOOP</text>
      <text x="100" y="350" fontSize="12" className="fill-slate-400 dark:fill-slate-500 font-bold font-mono">STEAM SUPPLY LINE</text>
      <text x="100" y="475" fontSize="12" className="fill-slate-400 dark:fill-slate-500 font-bold font-mono">COMPRESSED AIR SYSTEM</text>
    </svg>
  );
}