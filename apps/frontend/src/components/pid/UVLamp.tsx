import React from 'react';

interface UVLampSimpleProps {
  /** Posisi horizontal */
  x?: number;
  /** Posisi vertikal */
  y?: number;
  /** Faktor skala */
  size?: number;
  /** Status menyala (Lampu indikator hijau akan menyala) */
  on?: boolean;
}

const UVLamp: React.FC<UVLampSimpleProps> = ({
  x = 0,
  y = 0,
  size = 1,
  on = true,
}) => {
  return (
    <g transform={`translate(${x}, ${y}) scale(${size})`}>
      <defs>
        {/* Filter untuk efek Glow pada lampu hijau */}
        <filter id="greenGlow" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="3" result="blur1" />
          <feGaussianBlur stdDeviation="6" result="blur2" />
          <feMerge>
            <feMergeNode in="blur2" />
            <feMergeNode in="blur1" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>

        {/* Gradasi Metalik untuk Badan Utama */}
        <linearGradient id="bodyGrad" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#f3f4f6" />
          <stop offset="30%" stopColor="#d1d5db" />
          <stop offset="70%" stopColor="#9ca3af" />
          <stop offset="100%" stopColor="#4b5563" />
        </linearGradient>

        {/* Gradasi untuk Flensa (Lebih tebal dan gelap) */}
        <linearGradient id="flangeGrad" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#9ca3af" />
          <stop offset="50%" stopColor="#6b7280" />
          <stop offset="100%" stopColor="#374151" />
        </linearGradient>

        {/* Gradasi Hijau untuk Ujung Flensa */}
        <linearGradient id="greenFlangeGrad" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#4ade80" />
          <stop offset="50%" stopColor="#22c55e" />
          <stop offset="100%" stopColor="#166534" />
        </linearGradient>
      </defs>

      {/* === BAGIAN KIRI === */}
      {/* Flensa Kiri (Piringan tebal) */}
      <rect x="0" y="10" width="8" height="40" rx="1" fill="url(#flangeGrad)" stroke="#374151" strokeWidth="1.5" />
      {/* Ujung Hijau Flensa Kiri */}
      <rect x="0" y="12" width="4" height="36" rx="1" fill="url(#greenFlangeGrad)" />
      {/* Leher Kiri (Bagian yang mengecil) */}
      <rect x="8" y="18" width="12" height="24" rx="2" fill="url(#bodyGrad)" stroke="#6b7280" strokeWidth="1.5" />

      {/* === BAGIAN TENGAH (TABUNG UTAMA) === */}
      {/* Tabung silinder utama */}
      <rect x="20" y="14" width="60" height="32" rx="4" fill="url(#bodyGrad)" stroke="#4b5563" strokeWidth="2" />
      
      {/* Highlight garis tengah agar terlihat lebih 3D (seperti gambar) */}
      <rect x="22" y="18" width="56" height="4" rx="2" fill="#ffffff" opacity="0.4" />
      <rect x="22" y="38" width="56" height="2" fill="#000000" opacity="0.1" />

      {/* === BAGIAN KANAN === */}
      {/* Leher Kanan */}
      <rect x="80" y="18" width="12" height="24" rx="2" fill="url(#bodyGrad)" stroke="#6b7280" strokeWidth="1.5" />
      {/* Flensa Kanan */}
      <rect x="92" y="10" width="8" height="40" rx="1" fill="url(#flangeGrad)" stroke="#374151" strokeWidth="1.5" />
      {/* Ujung Hijau Flensa Kanan */}
      <rect x="96" y="12" width="4" height="36" rx="1" fill="url(#greenFlangeGrad)" />

      {/* === LAMPU HIJAU MENYALA === */}
      {on && (
        <g>
          {/* Lampu Indikator LED Hijau di tengah dengan efek glow */}
          <circle cx="50" cy="30" r="6" fill="#86efac" filter="url(#greenGlow)" />
          <circle cx="50" cy="30" r="3" fill="#dcfce7" />
          
          {/* Sedikit efek cahaya hijau di badan tabung (opsional, agar lebih hidup) */}
          <rect x="35" y="16" width="30" height="28" rx="4" fill="#22c55e" opacity="0.15" />
        </g>
      )}
      
      {/* Tampilan saat Mati (Jika on = false) */}
      {!on && (
        <circle cx="50" cy="30" r="6" fill="#4b5563" stroke="#374151" strokeWidth="1.5" />
      )}
    </g>
  );
};

export default UVLamp;