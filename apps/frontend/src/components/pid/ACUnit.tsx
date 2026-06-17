import React from 'react';

interface ACUnitProps {
  x?: number;
  y?: number;
  w?: number;
  h?: number;
  running?: boolean;
  className?: string;
}

const ACUnit: React.FC<ACUnitProps> = ({
  x = 0,
  y = 0,
  w = 800,
  h = 500,
  running = false,
  className = '',
}) => {
  const spinStyle = `
    @keyframes spin {
      from { transform: rotate(0deg); }
      to { transform: rotate(360deg); }
    }
    .fan-spin {
      animation: spin 0.9s linear infinite;
      transform-origin: 0px 0px;
      will-change: transform;
    }
    .fan-stop {
      animation: none;
    }
  `;

  return (
    <svg
      width={w}
      height={h}
      viewBox="0 0 800 500"
      className={className}
      xmlns="http://www.w3.org/2000/svg"
      style={{ maxWidth: '100%', height: 'auto', overflow: 'visible' }}
    >
      <defs>
        <style>{spinStyle}</style>

        {/* Gradien body utama */}
        <linearGradient id="bodyGradient" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#FFFFFF" />
          <stop offset="50%" stopColor="#F2F4F7" />
          <stop offset="100%" stopColor="#E0E4E8" />
        </linearGradient>

        <linearGradient id="panelBgGradient" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#FFFFFF" />
          <stop offset="100%" stopColor="#F3F4F6" />
        </linearGradient>

        <radialGradient id="fanBgGradient" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#2A2E34" />
          <stop offset="70%" stopColor="#1A1E23" />
          <stop offset="100%" stopColor="#0F1115" />
        </radialGradient>

        <linearGradient id="ctFanRing" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#E0E4E8" />
          <stop offset="30%" stopColor="#FFFFFF" />
          <stop offset="70%" stopColor="#C0C4C8" />
          <stop offset="100%" stopColor="#909498" />
        </linearGradient>

        <linearGradient id="ctBladeGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#F8F9FA" />
          <stop offset="40%" stopColor="#D0D4D8" />
          <stop offset="80%" stopColor="#A0A4A8" />
          <stop offset="100%" stopColor="#707478" />
        </linearGradient>

        <radialGradient id="ctHubGrad" cx="40%" cy="30%" r="60%">
          <stop offset="0%" stopColor="#FFFFFF" />
          <stop offset="40%" stopColor="#D0D4D8" />
          <stop offset="80%" stopColor="#808488" />
          <stop offset="100%" stopColor="#505458" />
        </radialGradient>

        <radialGradient id="motorGrad" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#3A3E44" />
          <stop offset="100%" stopColor="#1A1E23" />
        </radialGradient>

        {/* Filter bayangan */}
        <filter id="dropShadow" x="-5%" y="-5%" width="110%" height="110%">
          <feDropShadow dx="2" dy="4" stdDeviation="6" floodColor="#000" floodOpacity="0.15" />
        </filter>

        <filter id="innerShadow" x="-5%" y="-5%" width="110%" height="110%">
          <feDropShadow dx="1" dy="2" stdDeviation="3" floodColor="#000" floodOpacity="0.1" />
        </filter>

        <filter id="bladeShadow" x="-30%" y="-30%" width="160%" height="160%">
          <feDropShadow dx="0" dy="4" stdDeviation="5" floodColor="#000" floodOpacity="0.4" />
        </filter>

        <filter id="hubShadow" x="-20%" y="-20%" width="140%" height="140%">
          <feDropShadow dx="0" dy="2" stdDeviation="3" floodColor="#000" floodOpacity="0.5" />
        </filter>
      </defs>

      <g transform={`translate(${x}, ${y})`}>
        {/* Bayangan bawah */}
        <rect x={20} y={20} width={760} height={460} rx={10} fill="#000" opacity="0.1" filter="url(#dropShadow)" />

        {/* Body utama */}
        <rect x={0} y={0} width={800} height={500} rx={10} fill="url(#bodyGradient)" filter="url(#dropShadow)" stroke="#D1D5DB" strokeWidth="1.5" />

        <rect x={10} y={0} width={780} height={5} fill="#FFFFFF" opacity="0.8" />
        <rect x={10} y={495} width={780} height={5} fill="#D1D5DB" opacity="0.5" />

        {/* ─── KIRI: Fan Area (detail realistis) ────────────────────────────── */}
        <g transform="translate(30, 45)">
          <rect x={0} y={0} width={440} height={410} rx={8} fill="#1A1E23" />
          <circle cx={220} cy={205} r={190} fill="none" stroke="#9CA3AF" strokeWidth={3} />
          <circle cx={220} cy={205} r={185} fill="url(#fanBgGradient)" />
          <circle cx={220} cy={205} r={170} fill="none" stroke="#2A2E34" strokeWidth={1.5} />
          <circle cx={220} cy={205} r={140} fill="none" stroke="#2A2E34" strokeWidth={0.8} opacity="0.5" />

          <g transform="translate(220, 205)">
            {/* Ring luar kipas */}
            <circle cx={0} cy={0} r={168} fill="none" stroke="url(#ctFanRing)" strokeWidth="12" />
            <circle cx={0} cy={0} r={162} fill="none" stroke="#FFFFFF" strokeWidth="1" opacity="0.3" />
            <circle cx={0} cy={0} r={174} fill="none" stroke="#909498" strokeWidth="1" opacity="0.5" />
            
            {Array.from({ length: 36 }).map((_, i) => {
              const angle = i * 10;
              return (
                <line
                  key={i}
                  x1={0}
                  y1={-162}
                  x2={0}
                  y2={-168}
                  stroke="#606468"
                  strokeWidth="2"
                  transform={`rotate(${angle})`}
                  opacity="0.6"
                />
              );
            })}

            <g className={running ? 'fan-spin' : 'fan-stop'}>
              {[0, 90, 180, 270].map((deg) => (
                <g key={deg} transform={`rotate(${deg})`}>
                  <path
                    d="M -18,-28 
                       C -30,-70 -38,-120 -25,-165 
                       C -18,-175 -8,-178 0,-178 
                       C 8,-178 18,-175 25,-165 
                       C 38,-120 30,-70 18,-28 
                       C 12,-28 -12,-28 -18,-28 Z"
                    fill="url(#ctBladeGrad)"
                    stroke="#606468"
                    strokeWidth="1.2"
                    filter="url(#bladeShadow)"
                  />
                  <path
                    d="M -6,-32 
                       C -12,-75 -16,-120 -8,-160 
                       C -4,-165 0,-167 4,-165 
                       C 8,-160 10,-120 6,-75 
                       C 4,-50 -2,-35 -6,-32 Z"
                    fill="#FFFFFF"
                    opacity="0.35"
                  />
                  <path
                    d="M 6,-32 
                       C 12,-70 18,-115 12,-158 
                       C 10,-162 6,-164 2,-162 
                       C -2,-158 -4,-115 -2,-70 
                       C 0,-50 4,-35 6,-32 Z"
                    fill="#000000"
                    opacity="0.25"
                  />
                  <path
                    d="M 0,-30 C 0,-80 0,-130 0,-170"
                    fill="none"
                    stroke="#FFFFFF"
                    strokeWidth="1.5"
                    opacity="0.4"
                  />
                </g>
              ))}

              <circle cx={0} cy={0} r={42} fill="url(#ctHubGrad)" stroke="#6B7280" strokeWidth="1.5" filter="url(#hubShadow)" />
              <circle cx={0} cy={0} r={34} fill="#2D2F33" stroke="#4B5563" strokeWidth="1" />
              <circle cx={0} cy={0} r={28} fill="url(#motorGrad)" />
              <circle cx={0} cy={0} r={20} fill="none" stroke="#6B7280" strokeWidth="1" opacity="0.8" />
              <circle cx={0} cy={0} r={12} fill="none" stroke="#4B5563" strokeWidth="1.5" />
              
              {[0, 90, 180, 270].map((deg) => (
                <g key={`screw-${deg}`} transform={`rotate(${deg})`}>
                  <circle cx={0} cy={-24} r={3} fill="#9CA3AF" stroke="#4B5563" strokeWidth="0.5" />
                  <line x1={-1.5} y1={-24} x2={1.5} y2={-24} stroke="#4B5563" strokeWidth="1" />
                </g>
              ))}
              
              <circle cx={0} cy={0} r={8} fill="#1F2937" />
              <circle cx={0} cy={0} r={4} fill="#9CA3AF" />
              <ellipse cx={-2} cy={-2} rx={3} ry={1.5} fill="rgba(255,255,255,0.6)" transform="rotate(-30, -2, -2)" />
            </g>

            {/* Grille pengaman statis */}
            <g opacity="0.15">
              <circle cx={0} cy={0} r={150} fill="none" stroke="#FFFFFF" strokeWidth="1.5" />
              <circle cx={0} cy={0} r={120} fill="none" stroke="#FFFFFF" strokeWidth="1.5" />
              <circle cx={0} cy={0} r={90} fill="none" stroke="#FFFFFF" strokeWidth="1.5" />
              <circle cx={0} cy={0} r={60} fill="none" stroke="#FFFFFF" strokeWidth="1.5" />
              {Array.from({ length: 12 }).map((_, i) => {
                const angle = i * 30;
                return (
                  <line
                    key={`grille-${i}`}
                    x1={0}
                    y1={-165}
                    x2={0}
                    y2={165}
                    stroke="#FFFFFF"
                    strokeWidth="1.2"
                    transform={`rotate(${angle})`}
                  />
                );
              })}
            </g>
          </g>

          <circle cx={15} cy={15} r={4} fill="#9CA3AF" />
          <circle cx={425} cy={15} r={4} fill="#9CA3AF" />
          <circle cx={15} cy={395} r={4} fill="#9CA3AF" />
          <circle cx={425} cy={395} r={4} fill="#9CA3AF" />
        </g>

        {/* ─── KANAN: Panel Kosong (hanya body, tanpa isi) ───────────────────── */}
        <g transform="translate(490, 55)">
          <rect x={0} y={0} width={280} height={390} rx={6} fill="url(#panelBgGradient)" filter="url(#innerShadow)" stroke="#D1D5DB" strokeWidth="1" />
          <rect x={2} y={2} width={276} height={386} rx={5} fill="none" stroke="#FFFFFF" strokeWidth="1" opacity="0.8" />
          
          {/* Tidak ada tombol, display, atau teks apapun */}

          {/* Sekrup sudut panel (tetap ada untuk estetika) */}
          <circle cx={15} cy={15} r={4} fill="#9CA3AF" />
          <circle cx={265} cy={15} r={4} fill="#9CA3AF" />
          <circle cx={15} cy={375} r={4} fill="#9CA3AF" />
          <circle cx={265} cy={375} r={4} fill="#9CA3AF" />
        </g>

        {/* ─── Ventilasi bawah ─────────────────────────────────────── */}
        <g transform="translate(30, 470)">
          <rect x={0} y={0} width={240} height={20} rx={2} fill="#1A1E23" />
          {Array.from({ length: 14 }).map((_, i) => (
            <rect key={i} x={8 + i * 16} y={2} width={10} height={16} rx={1} fill="#E0E4E8" />
          ))}
          <rect x={260} y={0} width={240} height={20} rx={2} fill="#1A1E23" />
          {Array.from({ length: 14 }).map((_, i) => (
            <rect key={i} x={268 + i * 16} y={2} width={10} height={16} rx={1} fill="#E0E4E8" />
          ))}
        </g>

        {/* Sekrup utama body */}
        <g fill="#9CA3AF">
          <circle cx={25} cy={25} r={5} />
          <circle cx={775} cy={25} r={5} />
          <circle cx={25} cy={475} r={5} />
          <circle cx={775} cy={475} r={5} />
        </g>

        {/* Handle bawah */}
        <rect x={80} y={485} width={40} height={8} rx={4} fill="#D1D5DB" />
        <rect x={680} y={485} width={40} height={8} rx={4} fill="#D1D5DB" />

        {/* LED indikator (hijau saat running, merah saat mati) */}
        <circle cx={755} cy={35} r={6} fill={running ? '#00E676' : '#FF1744'} stroke="#000" strokeWidth="0.5" />
        {running && (
          <circle cx={755} cy={35} r={10} fill="#00E676" opacity={0.3}>
            <animate attributeName="r" values="6;12;6" dur="1.5s" repeatCount="indefinite" />
            <animate attributeName="opacity" values="0.4;0;0.4" dur="1.5s" repeatCount="indefinite" />
          </circle>
        )}
      </g>
    </svg>
  );
};

export default ACUnit;