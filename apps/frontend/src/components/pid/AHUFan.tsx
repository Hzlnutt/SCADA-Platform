import React from 'react';

interface FanProps {
  /** Posisi horizontal */
  x?: number;
  /** Posisi vertikal */
  y?: number;
  /** Faktor skala / ukuran */
  size?: number;
  /** Status berjalan / berputar */
  isRunning?: boolean;
  /** Warna utama body (opsional) */
  bodyColor?: string;
}

const AHUFan: React.FC<FanProps> = ({
  x = 0,
  y = 0,
  size = 1,
  isRunning = false,
  bodyColor = '#9ca3af',
}) => {
  return (
    <g transform={`translate(${x}, ${y}) scale(${size})`}>
      <defs>
        <style>
          {`
            @keyframes spin {
              100% { transform: rotate(360deg); }
            }
            .fan-blades {
              transform-origin: 50px 50px;
              animation: spin 1s linear infinite;
              animation-play-state: ${isRunning ? 'running' : 'paused'};
            }
            .fan-hub {
              fill: #d1d5db;
              stroke: #6b7280;
              stroke-width: 1.5;
            }
          `}
        </style>

        <filter id="shadow" x="-30%" y="-30%" width="160%" height="160%">
          <feDropShadow dx="2" dy="3" stdDeviation="4" floodOpacity="0.35" />
        </filter>
        <filter id="inner-shadow">
          <feDropShadow dx="1" dy="1" stdDeviation="2" floodOpacity="0.4" />
        </filter>

        <radialGradient id="bodyGrad" cx="40%" cy="40%" r="60%">
          <stop offset="0%" stopColor="#f3f4f6" />
          <stop offset="60%" stopColor={bodyColor} />
          <stop offset="100%" stopColor="#4b5563" />
        </radialGradient>

        <linearGradient id="flangeGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#d1d5db" />
          <stop offset="100%" stopColor="#6b7280" />
        </linearGradient>
      </defs>

      {/* ===== FLANGE DI BELAKANG BODY (lebih panjang ke kanan) ===== */}
      {/* Digambar sebelum body, sehingga body menutupi bagian di dalam lingkaran */}
      <g filter="url(#shadow)">
        <rect
          x={60}
          y={8}
          width={50}
          height={42}
          rx={4}
          fill="url(#flangeGrad)"
          stroke="#6b7280"
          strokeWidth="1.5"
        />
        {/* Baut dekoratif */}
        <circle cx={70} cy={18} r={3} fill="#4b5563" />
        <circle cx={88} cy={18} r={3} fill="#4b5563" />
        <circle cx={70} cy={34} r={3} fill="#4b5563" />
        <circle cx={88} cy={34} r={3} fill="#4b5563" />
      </g>

      {/* ===== BODY UTAMA KIPAS ===== */}
      <circle cx="50" cy="50" r="42" fill="url(#bodyGrad)" stroke="#6b7280" strokeWidth="2" filter="url(#shadow)" />
      
      {/* Lubang dalam (area gelap) */}
      <circle cx="50" cy="50" r="35" fill="#1f2937" />
      <circle cx="50" cy="50" r="33" fill="none" stroke="#374151" strokeWidth="1.5" strokeDasharray="4 4" />

      {/* ===== BILAH KIPAS (diperkecil) ===== */}
      <g className="fan-blades">
        {[0, 72, 144, 216, 288].map((angle) => (
          <path
            key={angle}
            d="M 50 50 
               C 53 28, 68 22, 76 35 
               C 72 42, 66 48, 58 56 
               C 55 59, 51 57, 50 50 Z"
            fill="#e5e7eb"
            stroke="#9ca3af"
            strokeWidth="1.2"
            transform={`rotate(${angle}, 50, 50)`}
            filter="url(#inner-shadow)"
          />
        ))}
      </g>

      {/* ===== HUB / POROS TENGAH ===== */}
      <circle cx="50" cy="50" r="10" className="fan-hub" filter="url(#shadow)" />
      <circle cx="50" cy="50" r="6" fill="#6b7280" />
      <circle cx="50" cy="50" r="3" fill="#374151" />
      {[0, 60, 120, 180, 240, 300].map((a) => (
        <circle
          key={a}
          cx={50 + 7 * Math.cos((a * Math.PI) / 180)}
          cy={50 + 7 * Math.sin((a * Math.PI) / 180)}
          r="1.5"
          fill="#4b5563"
        />
      ))}
    </g>
  );
};

export default AHUFan;