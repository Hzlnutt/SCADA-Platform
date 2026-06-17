import React from 'react';

/**
 * AHUBoxRealistic - Komponen SVG Kabinet AHU Industrial Realistis
 *
 * Props:
 * - x: posisi horizontal (default: 0)
 * - y: posisi vertikal (default: 0)
 * - width: lebar total (default: 600)
 * - height: tinggi total (default: 450)
 * - children: komponen internal yang ingin ditempatkan di dalam
 */
const AHUBox = ({
  x = 0,
  y = 0,
  width = 600,
  height = 450
}) => {
  const depth = 20; // Kedalaman ruang interior (perspektif 3D)

  return (
    <g transform={`translate(${x}, ${y})`}>
      <defs>
        {/* Gradasi Layer Luar (Abu Terang) */}
        <linearGradient id="outerFrameGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="#E8EAED" />
          <stop offset="50%" stop-color="#D5D7DB" />
          <stop offset="100%" stop-color="#B0B3B8" />
        </linearGradient>

        <linearGradient id="outerSideGrad" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stop-color="#B0B3B8" />
          <stop offset="100%" stop-color="#8D9095" />
        </linearGradient>

        {/* Gradasi Dinding Belakang (Abu Gelap) */}
        <linearGradient id="backWallGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="#4A4D52" />
          <stop offset="100%" stop-color="#3A3C40" />
        </linearGradient>

        {/* Gradasi Dinding Kiri (Abu Gelap - lebih gelap) */}
        <linearGradient id="leftWallGrad" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stop-color="#3A3C40" />
          <stop offset="100%" stop-color="#25272B" />
        </linearGradient>

        {/* Gradasi Dinding Kanan (Abu Gelap) */}
        <linearGradient id="rightWallGrad" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stop-color="#2E3035" />
          <stop offset="100%" stop-color="#1A1C20" />
        </linearGradient>

        {/* Gradasi Langit-langit (Abu Gelap) */}
        <linearGradient id="ceilingGrad" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stop-color="#3E4045" />
          <stop offset="100%" stop-color="#2A2C30" />
        </linearGradient>

        {/* Gradasi Lantai (Abu Gelap) */}
        <linearGradient id="floorGrad" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stop-color="#2A2C30" />
          <stop offset="100%" stop-color="#1A1C20" />
        </linearGradient>

        {/* Bayangan Frame */}
        <filter id="frameShadow" x="-10%" y="-10%" width="130%" height="130%">
          <feDropShadow dx="0" dy="8" stdDeviation="8" flood-color="#000" flood-opacity="0.4" />
        </filter>

        {/* Bayangan Dinding */}
        <filter id="wallShadow" x="-5%" y="-5%" width="120%" height="120%">
          <feDropShadow dx="-2" dy="2" stdDeviation="3" flood-color="#000" flood-opacity="0.3" />
        </filter>
      </defs>

      {/* ==================== LAYER LUAR (Outer Chassis) ==================== */}
      {/* Dinding Luar Kiri */}
      <polygon
        points={`0,0 ${depth},${depth} ${depth},${height - depth} 0,${height}`}
        fill="url(#outerSideGrad)"
        stroke="#8D9095"
        strokeWidth="1"
      />
      {/* Dinding Luar Kanan */}
      <polygon
        points={`${width},0 ${width - depth},${depth} ${width - depth},${height - depth} ${width},${height}`}
        fill="url(#outerSideGrad)"
        stroke="#8D9095"
        strokeWidth="1"
      />
      {/* Dinding Luar Atas (Langit-langit Luar) */}
      <polygon
        points={`0,0 ${width},0 ${width - depth},${depth} ${depth},${depth}`}
        fill="url(#outerFrameGrad)"
        stroke="#B0B3B8"
        strokeWidth="1"
      />
      {/* Dinding Luar Bawah (Lantai Luar) */}
      <polygon
        points={`0,${height} ${width},${height} ${width - depth},${height - depth} ${depth},${height - depth}`}
        fill="url(#outerSideGrad)"
        stroke="#8D9095"
        strokeWidth="1"
      />

      {/* Panel Luar Depan (Frame Utama) */}
      <path
        d={`M0,0 L${width},0 L${width},${height} L0,${height} Z M${depth},${depth} L${width - depth},${depth} L${width - depth},${height - depth} L${depth},${height - depth} Z`}
        fill="url(#outerFrameGrad)"
        filter="url(#frameShadow)"
        stroke="#9A9CA1"
        strokeWidth="2"
      />
      
      {/* Garis-garis Panel pada Layer Luar */}
      <line x1={10} y1={10} x2={width - 10} y2={10} stroke="#C0C3C8" strokeWidth="1" />
      <line x1={10} y1={height - 10} x2={width - 10} y2={height - 10} stroke="#A0A3A8" strokeWidth="1" />
      <line x1={10} y1={10} x2={10} y2={height - 10} stroke="#C0C3C8" strokeWidth="1" />
      <line x1={width - 10} y1={10} x2={width - 10} y2={height - 10} stroke="#A0A3A8" strokeWidth="1" />

      {/* Detail Baut / Rivet pada Layer Luar */}
      <g fill="#9A9CA1" stroke="#7A7C81" strokeWidth="1">
        <circle cx={20} cy={20} r="4" />
        <circle cx={width - 20} cy={20} r="4" />
        <circle cx={20} cy={height - 20} r="4" />
        <circle cx={width - 20} cy={height - 20} r="4" />
        <circle cx={width / 2} cy={20} r="4" />
        <circle cx={width / 2} cy={height - 20} r="4" />
        <circle cx={20} cy={height / 2} r="4" />
        <circle cx={width - 20} cy={height / 2} r="4" />
      </g>

      {/* ==================== INTERIOR (Abu Gelap) ==================== */}
      {/* Dinding Belakang */}
      <rect
        x={depth}
        y={depth}
        width={width - 2 * depth}
        height={height - 2 * depth}
        fill="url(#backWallGrad)"
        filter="url(#wallShadow)"
      />

      {/* Dinding Kiri Interior */}
      <polygon
        points={`${depth},${depth} ${depth},${height - depth} ${depth + 10},${height - depth - 10} ${depth + 10},${depth + 10}`}
        fill="url(#leftWallGrad)"
      />
      {/* Rel Pemasangan (Mounting Rail) di Dinding Kiri */}
      <rect
        x={depth + 5}
        y={height * 0.15}
        width="8"
        height={height * 0.7}
        fill="#1A1C20"
        stroke="#2E3035"
        strokeWidth="1"
      />
      <g fill="#555">
        <circle cx={depth + 9} cy={height * 0.2} r="2" />
        <circle cx={depth + 9} cy={height * 0.4} r="2" />
        <circle cx={depth + 9} cy={height * 0.6} r="2" />
        <circle cx={depth + 9} cy={height * 0.8} r="2" />
      </g>

      {/* Dinding Kanan Interior */}
      <polygon
        points={`${width - depth},${depth} ${width - depth},${height - depth} ${width - depth - 10},${height - depth - 10} ${width - depth - 10},${depth + 10}`}
        fill="url(#rightWallGrad)"
      />
      {/* Rel Pemasangan di Dinding Kanan */}
      <rect
        x={width - depth - 13}
        y={height * 0.15}
        width="8"
        height={height * 0.7}
        fill="#1A1C20"
        stroke="#2E3035"
        strokeWidth="1"
      />
      <g fill="#555">
        <circle cx={width - depth - 9} cy={height * 0.2} r="2" />
        <circle cx={width - depth - 9} cy={height * 0.4} r="2" />
        <circle cx={width - depth - 9} cy={height * 0.6} r="2" />
        <circle cx={width - depth - 9} cy={height * 0.8} r="2" />
      </g>

      {/* Langit-langit Interior */}
      <polygon
        points={`${depth},${depth} ${width - depth},${depth} ${width - depth - 10},${depth + 10} ${depth + 10},${depth + 10}`}
        fill="url(#ceilingGrad)"
      />
      {/* Lampu Interior (Opsional, untuk efek realistis) */}
      <rect
        x={width / 2 - 30}
        y={depth + 2}
        width="60"
        height="8"
        fill="#F0F0F0"
        rx="2"
        opacity="0.6"
      />

      {/* Lantai Interior */}
      <polygon
        points={`${depth},${height - depth} ${width - depth},${height - depth} ${width - depth - 10},${height - depth - 10} ${depth + 10},${height - depth - 10}`}
        fill="url(#floorGrad)"
      />
      
      <polygon
        points={`${depth},${height - depth} ${width - depth},${height - depth} ${width},${height} ${depth},${height}`}
        fill="#000"
        opacity="0.15"
      />

      {/* ==================== DETAIL INDUSTRIAL TAMBAHAN ==================== */}
      {/* Gasket / Segel pada Bukaan Frame */}
      <rect
        x={depth}
        y={depth}
        width={width - 2 * depth}
        height={height - 2 * depth}
        fill="none"
        stroke="#1A1C20"
        strokeWidth="2"
      />
      
      {/* Sekrup-sekrup pada Frame Interior */}
      <g fill="#3A3C40" stroke="#1A1C20" strokeWidth="1">
        <circle cx={depth + 8} cy={depth + 8} r="3" />
        <circle cx={width - depth - 8} cy={depth + 8} r="3" />
        <circle cx={depth + 8} cy={height - depth - 8} r="3" />
        <circle cx={width - depth - 8} cy={height - depth - 8} r="3" />
      </g>
    </g>
  );
};

export default AHUBox;