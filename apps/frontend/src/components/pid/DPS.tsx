import React from 'react';

interface DPSProps {
  x?: number;
  y?: number;
  width?: number;
  height?: number;
}

const DifferentialPressureSwitch: React.FC<DPSProps> = ({
  x = 0,
  y = 0,
  width = 80,
  height = 60,
}) => {
  // ─── Geometry ──────────────────────────────────────────────────────
  // Skala berdasarkan width 80, height 60
  const s = (val: number) => (val / 80) * width;

  return (
    <svg
      x={x}
      y={y}
      width={width}
      height={height}
      viewBox="0 0 80 60"
      xmlns="http://www.w3.org/2000/svg"
    >
      {/* ─── MAIN BODY (KOTAK HITAM) ──────────────────────────────── */}
      <g fill="#606060">
        {/* Bagian utama kotak */}
        <rect x="8" y="0" width="60" height="40" rx="2" />

        {/* Tonjolan kecil di sisi kiri (konektor) */}
        <rect x="2" y="10" width="6" height="6" rx="1" />

        {/* Bagian yang menurun ke bawah (step) */}
        <rect x="30" y="40" width="12" height="6" />
        <rect x="34" y="46" width="4" height="8" />
        </g>
    </svg>
  );
};

export default DifferentialPressureSwitch;