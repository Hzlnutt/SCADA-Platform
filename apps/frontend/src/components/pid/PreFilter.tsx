import React from 'react';

// Definisikan tipe warna yang diizinkan
type FilterColor = 'blue' | 'green' | 'white' | 'grey' | 'yellow';

interface PreFilterProps {
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  color?: FilterColor;
  frameColor?: string;
}

const PreFilter: React.FC<PreFilterProps> = ({
  x = 0,
  y = 0,
  width = 150,
  height = 200,
  color = 'blue',
  frameColor = '#9A9FA4',
}) => {
  const frameThickness = 6;
  const pleatCount = 12;
  const pleatDepth = 8;
  const innerX = x + frameThickness;
  const innerY = y + frameThickness;
  const innerWidth = width - 2 * frameThickness;
  const innerHeight = height - 2 * frameThickness;

  const colorMap: Record<FilterColor, { light: string; mid: string; dark: string; label: string }> = {
    blue: {
      light: '#B8D4E8',
      mid: '#8AB8D4',
      dark: '#5A8EB8',
      label: 'PRE-FILTER (G4)',
    },
    green: {
      light: '#C8E0C0',
      mid: '#90C880',
      dark: '#60A050',
      label: 'PRE-FILTER (F5)',
    },
    white: {
      light: '#F0F2F4',
      mid: '#E0E4E8',
      dark: '#C8CCD0',
      label: 'PRE-FILTER (G3)',
    },
    grey: {
      light: '#D0D4D8',
      mid: '#B0B4B8',
      dark: '#808488',
      label: 'PRE-FILTER (G4)',
    },
    yellow: {
      light: '#F0E8B0',
      mid: '#E0D080',
      dark: '#C0B050',
      label: 'PRE-FILTER (F6)',
    },
  };

  // Gunakan label kustom jika disediakan, jika tidak pakai default
  const selectedColor = colorMap[color] || colorMap.blue;

  return (
    <g transform={`translate(0, 0)`}>
      <defs>
        {/* Gradasi Frame Logam */}
        <linearGradient id="frameGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="#E2E4E8" />
          <stop offset="50%" stop-color="#B8BBC0" />
          <stop offset="100%" stop-color="#8A8D92" />
        </linearGradient>

        {/* Gradasi Media Filter sesuai warna pilihan */}
        <linearGradient id="pleatGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color={selectedColor.light} />
          <stop offset="50%" stop-color={selectedColor.mid} />
          <stop offset="100%" stop-color={selectedColor.dark} />
        </linearGradient>

        {/* Bayangan Frame */}
        <filter id="frameShadow" x="-5%" y="-5%" width="115%" height="115%">
          <feDropShadow dx="1" dy="2" stdDeviation="2" flood-color="#000" flood-opacity="0.3" />
        </filter>

        {/* Bayangan Pleats */}
        <filter id="pleatShadow" x="-5%" y="-5%" width="115%" height="115%">
          <feDropShadow dx="0.5" dy="0.5" stdDeviation="1" flood-color="#000" flood-opacity="0.2" />
        </filter>
      </defs>

      {/* ==================== FRAME LOGAM ==================== */}
      <rect
        x={x}
        y={y}
        width={width}
        height={height}
        fill="url(#frameGrad)"
        filter="url(#frameShadow)"
        stroke="#6A6F74"
        strokeWidth="1"
        rx={2}
      />
      <rect
        x={x + 2}
        y={y + 2}
        width={width - 4}
        height={height - 4}
        fill="none"
        stroke="#7A7F84"
        strokeWidth="1"
        rx={1}
      />

      {/* ==================== MEDIA FILTER (PLEATS) ==================== */}
      <g clipPath={`url(#filterClip)`}>
        <clipPath id="filterClip">
          <rect x={innerX} y={innerY} width={innerWidth} height={innerHeight} />
        </clipPath>

        <rect
          x={innerX}
          y={innerY}
          width={innerWidth}
          height={innerHeight}
          fill={selectedColor.mid}
        />

        {Array.from({ length: pleatCount }).map((_, i) => {
          const step = innerWidth / (pleatCount + 1);
          const xPos = innerX + (i + 1) * step;
          const leftX = xPos - pleatDepth / 2;
          const rightX = xPos + pleatDepth / 2;
          return (
            <g key={i} filter="url(#pleatShadow)">
              <polygon
                points={`${leftX},${innerY} ${rightX},${innerY} ${rightX},${innerY + innerHeight} ${leftX},${innerY + innerHeight}`}
                fill="url(#pleatGrad)"
                stroke={selectedColor.dark}
                strokeWidth="0.5"
              />
              <line
                x1={leftX}
                y1={innerY}
                x2={leftX}
                y2={innerY + innerHeight}
                stroke={selectedColor.dark}
                strokeWidth="0.5"
              />
              <line
                x1={rightX}
                y1={innerY}
                x2={rightX}
                y2={innerY + innerHeight}
                stroke={selectedColor.light}
                strokeWidth="0.5"
              />
            </g>
          );
        })}
      </g>

      {/* ==================== KLIP / BAUT PENGIKAT ==================== */}
      <rect
        x={x + frameThickness + 10}
        y={y - 2}
        width={20}
        height={6}
        fill="#5A5F64"
        rx={1}
      />
      <rect
        x={x + width - frameThickness - 30}
        y={y - 2}
        width={20}
        height={6}
        fill="#5A5F64"
        rx={1}
      />
      <rect
        x={x + frameThickness + 10}
        y={y + height - 4}
        width={20}
        height={6}
        fill="#5A5F64"
        rx={1}
      />
      <rect
        x={x + width - frameThickness - 30}
        y={y + height - 4}
        width={20}
        height={6}
        fill="#5A5F64"
        rx={1}
      />
      <rect
        x={x + frameThickness + 10}
        y={y + height / 2 - 3}
        width={20}
        height={6}
        fill="#5A5F64"
        rx={1}
      />
      <rect
        x={x + width - frameThickness - 30}
        y={y + height / 2 - 3}
        width={20}
        height={6}
        fill="#5A5F64"
        rx={1}
      />

      
    </g>
  );
};

export default PreFilter;