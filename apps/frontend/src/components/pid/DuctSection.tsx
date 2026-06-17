import React from 'react';

/**
 * DuctSection - Saluran Udara (Intake/Outtake) dengan Flange & End Cap Realistik
 *
 * Props:
 * - x, y: posisi (default: 0, 0)
 * - width: panjang total saluran (default: 300)
 * - height: tinggi saluran (default: 200)
 * - direction: 'left' atau 'right' (default: 'right') - menentukan posisi flange
 * - flowDirection: 'in' atau 'out' (default: 'auto') - arah panah
 *   - 'auto': mengikuti direction (panah menuju flange)
 *   - 'in': panah mengarah ke dalam (menuju end cap)
 *   - 'out': panah mengarah ke luar (menuju flange)
 * - flangeWidth: lebar flange (default: 24)
 * - showDamper: apakah menampilkan damper internal (default: false)
 */
const DuctSection = ({
  x = 0,
  y = 0,
  width = 300,
  height = 200,
  direction = 'right',
  flowDirection = 'auto',
  flangeWidth = 24,
  showDamper = false,
}) => {
  const bodyLength = width - flangeWidth - 8;
  const flangeSize = flangeWidth;
  const capSize = 8;
  const isRight = direction === 'right';

  // Tentukan arah panah
  let arrowPoints;
  if (flowDirection === 'out') {
    // Panah mengarah ke end cap (masuk)
    arrowPoints = isRight ? "0,-8 -12,0 0,8" : "0,-8 12,0 0,8";
  } else if (flowDirection === 'out') {
    // Panah mengarah ke flange (keluar)
    arrowPoints = isRight ? "0,-8 12,0 0,8" : "0,-8 -12,0 0,8";
  } else {
    // 'auto': ikuti direction (panah menuju flange)
    arrowPoints = isRight ? "0,-8 12,0 0,8" : "0,-8 -12,0 0,8";
  }

  // Posisi flange dan cap
  const flangeX = isRight ? width - flangeSize : 0;
  const capX = isRight ? 0 : width - capSize;
  const bodyX = isRight ? capSize : flangeSize;

  return (
    <g transform={`translate(${x}, ${y})`}>
      <defs>
        {/* Gradasi Body (Logam Galvanis) */}
        <linearGradient id="bodyGrad" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stop-color="#D9DEE3" />
          <stop offset="30%" stop-color="#B0B5BA" />
          <stop offset="70%" stop-color="#8A9096" />
          <stop offset="100%" stop-color="#6A6F74" />
        </linearGradient>

        {/* Gradasi Flange (Logam Lebih Tebal/Terang) */}
        <linearGradient id="flangeGrad" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stop-color="#E5E8EC" />
          <stop offset="50%" stop-color="#C4C9CE" />
          <stop offset="100%" stop-color="#9A9FA4" />
        </linearGradient>

        {/* Gradasi End Cap (Logam Gelap/Matt) */}
        <linearGradient id="capGrad" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stop-color="#7A7F84" />
          <stop offset="100%" stop-color="#4A4F54" />
        </linearGradient>

        {/* Bayangan Body */}
        <filter id="ductShadow" x="-5%" y="-10%" width="120%" height="130%">
          <feDropShadow dx="4" dy="6" stdDeviation="5" flood-color="#000" flood-opacity="0.25" />
        </filter>
        <filter id="flangeShadow" x="-5%" y="-10%" width="120%" height="130%">
          <feDropShadow dx="2" dy="2" stdDeviation="3" flood-color="#000" flood-opacity="0.3" />
        </filter>
      </defs>

      {/* ==================== END CAP (Sisi Tertutup) ==================== */}
      <rect
        x={capX}
        y={0}
        width={capSize}
        height={height}
        fill="url(#capGrad)"
        stroke="#3A3F44"
        strokeWidth="1"
      />
      {/* Detail Baut End Cap */}
      <g fill="#2A2F34">
        <circle cx={capX + capSize / 2} cy={8} r="3" />
        <circle cx={capX + capSize / 2} cy={height - 8} r="3" />
        <circle cx={capX + capSize / 2} cy={height / 2} r="3" />
      </g>
      <line x1={capX} y1={2} x2={capX + capSize} y2={2} stroke="#5A5F64" strokeWidth="1" />
      <line x1={capX} y1={height - 2} x2={capX + capSize} y2={height - 2} stroke="#5A5F64" strokeWidth="1" />

      {/* ==================== BODY UTAMA ==================== */}
      <rect
        x={bodyX}
        y={2}
        width={bodyLength}
        height={height - 4}
        fill="url(#bodyGrad)"
        filter="url(#ductShadow)"
        stroke="#7A7F84"
        strokeWidth="1"
      />
      
      {/* Detail Sambungan Vertikal (Seam) pada Body */}
      <line x1={bodyX + bodyLength * 0.25} y1={2} x2={bodyX + bodyLength * 0.25} y2={height - 2} stroke="#7A7F84" strokeWidth="1.5" />
      <line x1={bodyX + bodyLength * 0.5} y1={2} x2={bodyX + bodyLength * 0.5} y2={height - 2} stroke="#7A7F84" strokeWidth="1.5" />
      <line x1={bodyX + bodyLength * 0.75} y1={2} x2={bodyX + bodyLength * 0.75} y2={height - 2} stroke="#7A7F84" strokeWidth="1.5" />

      {/* Detail Lipatan (Ribs) pada Body */}
      <g stroke="#9A9FA4" strokeWidth="1.5" fill="none">
        <path d={`M${bodyX + 10},5 L${bodyX + 10},${height - 5}`} />
        <path d={`M${bodyX + 20},5 L${bodyX + 20},${height - 5}`} />
        <path d={`M${bodyX + bodyLength - 10},5 L${bodyX + bodyLength - 10},${height - 5}`} />
        <path d={`M${bodyX + bodyLength - 20},5 L${bodyX + bodyLength - 20},${height - 5}`} />
      </g>

      {/* ==================== FLANGE (Sisi Terbuka) ==================== */}
      <rect
        x={flangeX}
        y={-4}
        width={flangeSize}
        height={height + 8}
        fill="url(#flangeGrad)"
        filter="url(#flangeShadow)"
        stroke="#6A6F74"
        strokeWidth="1.5"
        rx={1}
      />
      
      {/* Detail Baut Flange */}
      <g fill="#5A5F64" stroke="#3A3F44" strokeWidth="0.5">
        <circle cx={flangeX + flangeSize / 2} cy={-1} r="4" />
        <circle cx={flangeX + flangeSize / 4} cy={-1} r="4" />
        <circle cx={flangeX + (3 * flangeSize) / 4} cy={-1} r="4" />
        <circle cx={flangeX + flangeSize / 2} cy={height + 1} r="4" />
        <circle cx={flangeX + flangeSize / 4} cy={height + 1} r="4" />
        <circle cx={flangeX + (3 * flangeSize) / 4} cy={height + 1} r="4" />
        <circle cx={flangeX + flangeSize / 2} cy={height / 2} r="4" />
      </g>

      {/* Gasket pada Flange */}
      <rect
        x={flangeX + (direction === 'right' ? 4 : flangeSize - 6)}
        y={-2}
        width={2}
        height={height + 4}
        fill="#1A1C20"
        opacity="0.8"
      />

      {/* ==================== DAMPER INTERNAL (Opsional) ==================== */}
      {showDamper && (
        <g transform={`translate(${bodyX + bodyLength * 0.3}, ${height / 2})`}>
          <rect
            x={-bodyLength * 0.15}
            y={-height * 0.35}
            width={bodyLength * 0.3}
            height={height * 0.7}
            fill="none"
            stroke="#3A3F44"
            strokeWidth="2"
            rx="2"
          />
          <g stroke="#2A2F34" strokeWidth="3">
            <line x1={-bodyLength * 0.1} y1={-height * 0.25} x2={bodyLength * 0.1} y2={-height * 0.25} />
            <line x1={-bodyLength * 0.1} y1={-height * 0.05} x2={bodyLength * 0.1} y2={-height * 0.05} />
            <line x1={-bodyLength * 0.1} y1={height * 0.15} x2={bodyLength * 0.1} y2={height * 0.15} />
            <line x1={-bodyLength * 0.1} y1={height * 0.35} x2={bodyLength * 0.1} y2={height * 0.35} />
          </g>
          <rect x={-8} y={-height * 0.4} width="16" height="8" fill="#5A5F64" rx="1" />
          <circle cx={0} cy={-height * 0.4 + 4} r="3" fill="#2A2F34" />
        </g>
      )}

      {/* ==================== ARAH ALIRAN UDARA (Panah) ==================== */}
      <g transform={`translate(${bodyX + bodyLength * 0.85}, ${height / 2})`}>
        <polygon
          points={arrowPoints}
          fill="#1A1C20"
          opacity="0.3"
        />
      </g>
    </g>
  );
};

export default DuctSection;