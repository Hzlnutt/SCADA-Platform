import React from 'react';

interface PipeTProps {
  x: number;
  y: number;
  w: number;
  h: number;
  direction?: 'down' | 'up' | 'left' | 'right';
}

/**
 * Pipe Tee Component
 * Meniru logam 3D dari Ignition Vision XML
 */
export function PipeT({
  x,
  y,
  w,
  h,
  direction = 'down',
}: PipeTProps) {
  const cx = x + w / 2;
  const cy = y + h / 2;

  const getRotate = () => {
    switch (direction) {
      case 'down': return 0;
      case 'up': return 180;
      case 'left': return 90;
      case 'right': return 270;
      default: return 0;
    }
  };

  const rotate = getRotate();

  const thickness = Math.min(w, h) * 0.22;
  const barWidth = w * 0.8;
  const barHeight = thickness;
  const branchWidth = thickness;
  const branchHeight = h * 0.6;

  // Posisi horizontal (cross bar)
  const barX = x + (w - barWidth) / 2;
  const barY = y + (h - barHeight) / 2;

  // Posisi vertical (branch)
  const branchX = x + (w - branchWidth) / 2;
  const branchY = y + (h - branchHeight) / 2;
  const branchRadius = branchWidth * 0.2;

  return (
    <g transform={`rotate(${rotate} ${cx} ${cy})`}>
      <defs>
        {/* Gradasi vertikal untuk Horizontal Bar */}
        <linearGradient id="tee-h" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#eeeeee" />
          <stop offset="15%" stopColor="#ffffff" />
          <stop offset="35%" stopColor="#aaaaaa" />
          <stop offset="65%" stopColor="#777777" />
          <stop offset="100%" stopColor="#333333" />
        </linearGradient>

        {/* Gradasi horizontal untuk Vertical Branch */}
        <linearGradient id="tee-v" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#cccccc" />
          <stop offset="15%" stopColor="#ffffff" />
          <stop offset="45%" stopColor="#aaaaaa" />
          <stop offset="80%" stopColor="#555555" />
          <stop offset="100%" stopColor="#333333" />
        </linearGradient>
        
        {/* Radiasi untuk pertemuan cabang */}
        <radialGradient id="tee-join" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#ffffff" stopOpacity="0.8" />
          <stop offset="30%" stopColor="#dddddd" stopOpacity="0.5" />
          <stop offset="100%" stopColor="#888888" stopOpacity="0.1" />
        </radialGradient>
      </defs>

      {/* 1. HORIZONTAL BAR */}
      <rect
        x={barX}
        y={barY}
        width={barWidth}
        height={barHeight}
        fill="url(#tee-h)"
        rx={barHeight * 0.2}
      />

      {/* 2. VERTICAL BRANCH */}
      <rect
        x={branchX}
        y={branchY}
        width={branchWidth}
        height={branchHeight}
        fill="url(#tee-v)"
        rx={branchRadius}
      />

      {/* 3. JOIN BLEND (Lingkaran di tengah pertemuan untuk menyatukan visual) */}
      <circle
        cx={cx}
        cy={cy}
        r={thickness * 0.6}
        fill="url(#tee-join)"
      />

      {/* 4. HIGHLIGHTS (Efek 3D) */}
      {/* Highlight atas horizontal */}
      <line
        x1={barX}
        y1={barY}
        x2={barX + barWidth}
        y2={barY}
        stroke="#ffffff"
        strokeWidth={thickness * 0.15}
        opacity="0.8"
        strokeLinecap="round"
      />
      {/* Highlight kiri vertical */}
      <line
        x1={branchX}
        y1={branchY}
        x2={branchX}
        y2={branchY + branchHeight}
        stroke="#ffffff"
        strokeWidth={branchWidth * 0.15}
        opacity="0.6"
        strokeLinecap="round"
      />

      {/* 5. SHADOWS */}
      {/* Shadow bawah horizontal */}
      <line
        x1={barX}
        y1={barY + barHeight}
        x2={barX + barWidth}
        y2={barY + barHeight}
        stroke="#222222"
        strokeWidth={thickness * 0.1}
        opacity="0.4"
        strokeLinecap="round"
      />
      {/* Shadow kanan vertical */}
      <line
        x1={branchX + branchWidth}
        y1={branchY}
        x2={branchX + branchWidth}
        y2={branchY + branchHeight}
        stroke="#222222"
        strokeWidth={branchWidth * 0.1}
        opacity="0.4"
        strokeLinecap="round"
      />
    </g>
  );
}