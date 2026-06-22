import React from 'react';

interface IndustrialTankProps {
  x?: number;
  y?: number;
  size?: number;
  tankColor?: string;
}

const Tank: React.FC<IndustrialTankProps> = ({
  x = 0,
  y = 0,
  size = 1,
  tankColor = '#9ca3af',
}) => {
  return (
    <g transform={`translate(${x}, ${y}) scale(${size})`}>
      <defs>
        {/* 1. Filter untuk membuat tekstur berbintik (Speckle) seperti di gambar */}
        <filter id="speckleTexture" x="0%" y="0%" width="100%" height="100%">
          <feTurbulence 
            type="fractalNoise" 
            baseFrequency="0.65" 
            numOctaves="4" 
            result="noise" 
          />
          <feColorMatrix 
            type="matrix" 
            values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 0.12 0" 
            in="noise" 
            result="coloredNoise" 
          />
          <feComposite 
            operator="in" 
            in="coloredNoise" 
            in2="SourceGraphic" 
            result="texture" 
          />
          <feMerge>
            <feMergeNode in="SourceGraphic" />
            <feMergeNode in="texture" />
          </feMerge>
        </filter>

        {/* 2. Gradasi bayangan untuk memberikan efek 3D silinder */}
        <linearGradient id="tankShading" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#ffffff" stopOpacity="0.3" />
          <stop offset="15%" stopColor="#ffffff" stopOpacity="0.1" />
          <stop offset="50%" stopColor="#000000" stopOpacity="0" />
          <stop offset="85%" stopColor="#000000" stopOpacity="0.25" />
          <stop offset="100%" stopColor="#000000" stopOpacity="0.45" />
        </linearGradient>

        {/* 3. Gradasi warna dasar badan tank */}
        <linearGradient id="tankBodyGrad" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#d1d5db" />
          <stop offset="50%" stopColor={tankColor} />
          <stop offset="100%" stopColor="#6b7280" />
        </linearGradient>

        {/* 4. Bentuk dasar tank (Body + Dome) */}
        <clipPath id="tankClip">
          <path d="M 20,30 L 20,80 L 80,80 L 80,30 C 80,15 70,10 50,10 C 30,10 20,15 20,30 Z" />
        </clipPath>
        
        <path id="tankShape" d="M 20,30 L 20,80 L 80,80 L 80,30 C 80,15 70,10 50,10 C 30,10 20,15 20,30 Z" />
      </defs>

      {/* === BADAN TANK UTAMA === */}
      <g filter="url(#speckleTexture)">
        {/* Warna dasar */}
        <use href="#tankShape" fill="url(#tankBodyGrad)" stroke="#4b5563" strokeWidth="2" />
      </g>
      
      {/* Bayangan/Lighting overlay agar terlihat 3D */}
      <use href="#tankShape" fill="url(#tankShading)" />

      {/* === FLANGE / MANHOLE DI ATAS (Bagian Hitam/Pipa Besar) === */}
      <g>
        {/* Base flange (leher) */}
        <ellipse cx="50" cy="14" rx="14" ry="5" fill="#374151" />
        <rect x="36" y="5" width="28" height="9" fill="#374151" />
        <ellipse cx="50" cy="5" rx="14" ry="5" fill="#1f2937" />
        
        {/* Mur/baut di flange atas */}
        <circle cx="38" cy="7" r="2" fill="#111827" />
        <circle cx="50" cy="3" r="2" fill="#111827" />
        <circle cx="62" cy="7" r="2" fill="#111827" />
        
        {/* Pipa/Konektor kecil di atas flange (sesuai gambar) */}
        <rect x="46" y="-2" width="8" height="7" fill="#4b5563" />
        <ellipse cx="50" cy="-2" rx="4" ry="2" fill="#6b7280" />
        
        {/* Konektor kecil sebelah kiri atas */}
        <rect x="30" y="6" width="6" height="6" fill="#6b7280" />
        <rect x="31" y="3" width="4" height="3" fill="#9ca3af" />
        
        {/* Konektor kecil sebelah kanan atas (seperti pipa tegak) */}
        <rect x="64" y="2" width="4" height="10" fill="#6b7280" />
        <ellipse cx="66" cy="2" rx="2" ry="1.5" fill="#9ca3af" />
      </g>

      {/* === GARIS BAWAH (BEKAS PENGELASAN/FOOT) === */}
      <path d="M 20,80 L 80,80" stroke="#374151" strokeWidth="2" opacity="0.5" />
    </g>
  );
};

export default Tank;