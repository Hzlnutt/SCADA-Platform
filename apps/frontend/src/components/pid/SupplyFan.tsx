import React from 'react';

/**
 * Supply Fan - Center Position + Full Box Frame
 * - Kipas diposisikan di tengah badan
 * - Kerangka kotak hitam dari flange ke ujung motor
 */
const SupplyFan = ({ 
  x = 0, 
  y = 0, 
  w = 300, 
  h = 150, 
  direction = 'right',
  running = false 
}) => {

  // Logic Transformasi Arah
  let directionTransform = '';
  const centerX = 400;
  const centerY = 200;

  switch (direction) {
    case 'left': directionTransform = `scale(-1, 1) translate(-800, 0)`; break;
    case 'up': directionTransform = `rotate(-90, ${centerX}, ${centerY})`; break;
    case 'down': directionTransform = `rotate(90, ${centerX}, ${centerY})`; break;
    default: directionTransform = '';
  }

  return (
    <svg 
      x={x} 
      y={y} 
      width={w} 
      height={h} 
      viewBox="0 0 800 400" 
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        <style>
          {`
            @keyframes spin {
              0% { transform: rotate(0deg); }
              100% { transform: rotate(360deg); }
            }
            .fan-axial-spin {
              animation: spin 1.5s linear infinite;
              transform-origin: 247.5px 200px;
            }
            .fan-axial-stop {
              animation: none;
              transform-origin: 247.5px 200px;
            }
            .led-glow-green {
              filter: drop-shadow(0 0 6px #00e676);
            }
            .led-glow-red {
              filter: drop-shadow(0 0 6px #ff1744);
            }
          `}
        </style>

        <linearGradient id="metalBody" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#cfd8dc" />
          <stop offset="20%" stopColor="#ffffff" />
          <stop offset="55%" stopColor="#90a4ae" />
          <stop offset="80%" stopColor="#546e7a" />
          <stop offset="100%" stopColor="#37474f" />
        </linearGradient>

        <linearGradient id="motorBody" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#455a64" />
          <stop offset="30%" stopColor="#607d8b" />
          <stop offset="70%" stopColor="#37474f" />
          <stop offset="100%" stopColor="#263238" />
        </linearGradient>

        <linearGradient id="motorCap" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#546e7a" />
          <stop offset="50%" stopColor="#78909c" />
          <stop offset="100%" stopColor="#37474f" />
        </linearGradient>

        <linearGradient id="flangeGrad" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#b0bec5" />
          <stop offset="50%" stopColor="#eceff1" />
          <stop offset="100%" stopColor="#78909c" />
        </linearGradient>

        <clipPath id="fanClip">
          <circle cx="247.5" cy="200" r="65" />
        </clipPath>

        {/* Bilah Kipas Axial - Berpusat di (0,0) */}
        <g id="axialBlade">
          <path 
            d="M 0,-10 C -30,-55 -50,-70 -60,-65 C -45,-50 -25,-30 0,-5 Z" 
            fill={running ? "#b0bec5" : "#546e7a"} 
            stroke="#333" 
            strokeWidth="2" 
          />
        </g>
      </defs>

      {/* Group Utama */}
      <g transform={`scale(${w / 800}, ${h / 400}) ${directionTransform}`}>

        {/* ========================
            KERANGKA KOTAK (FLANGE KE UJUNG MOTOR)
            ======================== */}
        <g fill="none" stroke="#1a1a1a" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round">
          {/* Batang Vertikal: Flange, Awal Motor, Ujung Motor */}
          <line x1="115" y1="85" x2="115" y2="315" />
          <line x1="380" y1="130" x2="380" y2="270" />
          <line x1="555" y1="150" x2="555" y2="250" />

          {/* Batang Horizontal Atas */}
          <line x1="115" y1="85" x2="555" y2="150" />
          
          {/* Batang Horizontal Bawah */}
          <line x1="115" y1="315" x2="555" y2="250" />
        </g>

        {/* ========================
            FLANGE INLET
            ======================== */}
        <g>
          <rect x="35" y="80" width="80" height="240" rx="6" fill="url(#flangeGrad)" />
          <rect x="45" y="90" width="60" height="220" rx="4" fill="#151515" />
          <line x1="55" y1="90" x2="55" y2="310" stroke="#333" strokeWidth="4" />
          <line x1="70" y1="90" x2="70" y2="310" stroke="#333" strokeWidth="4" />
          <line x1="85" y1="90" x2="85" y2="310" stroke="#333" strokeWidth="4" />
          <circle cx="45" cy="100" r="3" fill="#666" />
          <circle cx="105" cy="100" r="3" fill="#666" />
          <circle cx="45" cy="300" r="3" fill="#666" />
          <circle cx="105" cy="300" r="3" fill="#666" />
        </g>

        {/* ========================
            BADAN KIPAS (TENGAH)
            ======================== */}
        <path 
          d="M 115,120 L 180,110 C 260,100 300,95 380,95 C 400,95 380,115 380,135 L 380,265 C 380,285 400,305 380,305 C 300,305 260,300 180,290 L 115,280 Z" 
          fill="url(#metalBody)" 
          stroke="#333" 
          strokeWidth="2"
        />
        
        {/* Highlight 3D */}
        <path 
          d="M 115,130 L 180,120 C 260,110 300,105 380,105 C 390,105 380,120 380,130 L 380,145 C 380,130 390,115 380,115 C 300,115 260,125 180,135 L 115,145 Z" 
          fill="rgba(255,255,255,0.3)" 
        />

        <rect x="110" y="115" width="10" height="170" fill="#78909c" rx="3" />

        {/* ========================
            KIPAS AXIAL (TENGAH BODY)
            ======================== */}
        <g>
          <circle cx="247.5" cy="200" r="65" fill="#111" />
          <circle cx="247.5" cy="200" r="65" fill="none" stroke="#222" strokeWidth="4" />
          
          <g className={running ? "fan-axial-spin" : "fan-axial-stop"}>
            <g clipPath="url(#fanClip)">
              <use href="#axialBlade" transform="translate(247.5, 200) rotate(0)" />
              <use href="#axialBlade" transform="translate(247.5, 200) rotate(60)" />
              <use href="#axialBlade" transform="translate(247.5, 200) rotate(120)" />
              <use href="#axialBlade" transform="translate(247.5, 200) rotate(180)" />
              <use href="#axialBlade" transform="translate(247.5, 200) rotate(240)" />
              <use href="#axialBlade" transform="translate(247.5, 200) rotate(300)" />
            </g>
            
            {/* Hub Kipas */}
            <circle cx="247.5" cy="200" r="28" fill={running ? "#455a64" : "#37474f"} />
            <circle cx="247.5" cy="200" r="20" fill="#212121" />
            <circle cx="247.5" cy="200" r="8" fill="#78909c" />
          </g>
        </g>

        {/* ========================
            MOTOR PENGGERAK
            ======================== */}
        <g>
          {/* Penyangga Motor */}
          <path d="M 380,140 L 400,140 L 400,260 L 380,260 Z" fill="#263238" />
          <path d="M 380,140 L 400,140 L 400,260 L 380,260 Z" fill="none" stroke="#111" strokeWidth="3" />
          
          {/* Bodi Utama Motor */}
          <rect x="400" y="130" width="130" height="140" rx="12" fill="url(#motorBody)" />
          <rect x="400" y="130" width="130" height="140" rx="12" fill="none" stroke="#111" strokeWidth="3" />
          
          {/* Sirip Pendingin */}
          <g stroke="#1a1a1a" strokeWidth="5" strokeLinecap="round">
            <line x1="510" y1="135" x2="510" y2="265" />
            <line x1="522" y1="135" x2="522" y2="265" />
          </g>

          {/* Tutup Belakang Motor */}
          <rect x="530" y="150" width="25" height="100" rx="6" fill="url(#motorCap)" />
          <rect x="530" y="150" width="25" height="100" rx="6" fill="none" stroke="#111" strokeWidth="2" />
          
          {/* Label Motor */}
          <text x="430" y="205" fontFamily="monospace" fontSize="14" fill="#90a4ae" fontWeight="bold" letterSpacing="2">MOTOR</text>
        </g>

        {/* ========================
            LED INDIKATOR
            ======================== */}
        <g>
          {/* LED HIJAU (ON) */}
          <circle 
            cx="450" 
            cy="240" 
            r="6" 
            fill={running ? "#00e676" : "#2e2e2e"} 
            stroke={running ? "#00e676" : "#555"} 
            strokeWidth="1.5"
            className={running ? "led-glow-green" : ""}
          />
          {/* LED MERAH (OFF) */}
          <circle 
            cx="470" 
            cy="240" 
            r="6" 
            fill={!running ? "#ff1744" : "#2e2e2e"} 
            stroke={!running ? "#ff1744" : "#555"} 
            strokeWidth="1.5"
            className={!running ? "led-glow-red" : ""}
          />
        </g>
      </g>
    </svg>
  );
};

export default SupplyFan;