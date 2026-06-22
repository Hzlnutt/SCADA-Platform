import React from 'react';

type HousingColor = 'silver' | 'dark' | 'white' | 'black';
type UnitType = 'heater' | 'cooler';

interface ThermalUnitProps {
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  color?: HousingColor;
  frameColor?: string;
  label?: string;
  running?: boolean;
  type?: UnitType;
  hasFins?: boolean;
}

const ThermalUnit: React.FC<ThermalUnitProps> = ({
  x = 0,
  y = 0,
  width = 150,
  height = 200,
  color = 'silver',
  frameColor = '#A0A5AA',
  running = false,
  type = 'heater',
  hasFins = true,
}) => {
  const frameThickness = 6;
  const innerX = x + frameThickness;
  const innerY = y + frameThickness;
  const innerWidth = width - 2 * frameThickness;
  const innerHeight = height - 2 * frameThickness;

  // ─── ID unik untuk clipPath ──────────────────────────────────────────────
  const clipId = React.useId();

  const colorMap: Record<HousingColor, { light: string; mid: string; dark: string }> = {
    silver: {
      light: '#E2E6EA',
      mid: '#C0C6CC',
      dark: '#8A9096',
    },
    dark: {
      light: '#5A5F64',
      mid: '#3A3F44',
      dark: '#1A1F24',
    },
    white: {
      light: '#F5F7FA',
      mid: '#E2E6EA',
      dark: '#C0C6CC',
    },
    black: {
      light: '#3A3F44',
      mid: '#1A1F24',
      dark: '#0A0F14',
    },
  };

  const selectedColor = colorMap[color] || colorMap.silver;

  const finColors = {
    heater: {
      off: { fill: '#8A9096', stroke: '#5A5F64' },
      on: { fill: '#FF3333', stroke: '#CC0000' },
    },
    cooler: {
      off: { fill: '#4A90D9', stroke: '#2A6FB0' },
      on: { fill: '#00BFFF', stroke: '#0080CC' },
    },
  };

  const finColor = finColors[type];
  const finStyle = running ? finColor.on : finColor.off;

  const ledColor = running
    ? type === 'heater'
      ? '#00E676'
      : '#00BFFF'
    : '#FF1744';

  const finCount = 15;
  const finWidth = 3;
  const spacing = (innerHeight - 20) / (finCount + 1);

  return (
    <g transform={`translate(0, 0)`}>
      <defs>
        <style>
          {`
            @keyframes heatPulse {
              0% { fill: #FF3333; stroke: #CC0000; }
              50% { fill: #990000; stroke: #660000; }
              100% { fill: #FF3333; stroke: #CC0000; }
            }
            @keyframes coolPulse {
              0% { fill: #00BFFF; stroke: #0080CC; }
              50% { fill: #0066CC; stroke: #004499; }
              100% { fill: #00BFFF; stroke: #0080CC; }
            }
            .baffle-heater-on {
              animation: heatPulse 1.2s ease-in-out infinite;
            }
            .baffle-cooler-on {
              animation: coolPulse 1.2s ease-in-out infinite;
            }
            .baffle-off {
              fill: ${finColor.off.fill};
              stroke: ${finColor.off.stroke};
            }
          `}
        </style>

        <linearGradient id="frameGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color={selectedColor.light} />
          <stop offset="50%" stop-color={selectedColor.mid} />
          <stop offset="100%" stop-color={selectedColor.dark} />
        </linearGradient>

        <filter id="frameShadow" x="-5%" y="-5%" width="115%" height="115%">
          <feDropShadow dx="1" dy="3" stdDeviation="3" flood-color="#000" flood-opacity="0.4" />
        </filter>

        {/* ─── ClipPath dengan ID unik ──────────────────────────────────────── */}
        <clipPath id={clipId}>
          <rect x={innerX} y={innerY} width={innerWidth} height={innerHeight} rx={2} />
        </clipPath>
      </defs>

      {/* Frame Utama */}
      <rect
        x={x}
        y={y}
        width={width}
        height={height}
        fill="url(#frameGrad)"
        filter="url(#frameShadow)"
        stroke={selectedColor.dark}
        strokeWidth="1.5"
        rx={4}
      />
      <rect
        x={x + 2}
        y={y + 2}
        width={width - 4}
        height={height - 4}
        fill="none"
        stroke={selectedColor.light}
        strokeWidth="1"
        rx={2}
      />

      {/* ─── Interior ────────────────────────────────────────────────── */}
      {hasFins ? (
        <g clipPath={`url(#${clipId})`}>
          <rect
            x={innerX}
            y={innerY}
            width={innerWidth}
            height={innerHeight}
            fill="#1A1F24"
          />

          {Array.from({ length: finCount }).map((_, i) => {
            const yPos = innerY + 10 + (i + 1) * spacing;
            const animationClass = running
              ? type === 'heater'
                ? 'baffle-heater-on'
                : 'baffle-cooler-on'
              : 'baffle-off';
            return (
              <rect
                key={i}
                x={innerX + 8}
                y={yPos - finWidth / 2}
                width={innerWidth - 16}
                height={finWidth}
                className={animationClass}
                strokeWidth="0.5"
                rx={1}
              />
            );
          })}

          <g fill="none" stroke="#2A2F34" strokeWidth="3">
            <line x1={innerX + 5} y1={innerY + 70} x2={innerX + 5} y2={innerY + 130} />
            <line x1={innerX + 8} y1={innerY + 70} x2={innerX + 8} y2={innerY + 130} />
            <line x1={innerX + innerWidth - 5} y1={innerY + 70} x2={innerX + innerWidth - 5} y2={innerY + 130} />
            <line x1={innerX + innerWidth - 8} y1={innerY + 70} x2={innerX + innerWidth - 8} y2={innerY + 130} />
          </g>
        </g>
      ) : (
        <>
          <rect
            x={innerX}
            y={innerY}
            width={innerWidth}
            height={innerHeight}
            fill={selectedColor.mid}
            rx={2}
          />
          <rect
            x={x + width / 2 - 25}
            y={y + height / 2 - 8}
            width={50}
            height={16}
            fill={selectedColor.dark}
            rx={2}
            opacity="0.5"
          />
        </>
      )}

      {/* Klip Pengikat */}
      <g>
        <rect x={x + frameThickness + 10} y={y - 2} width={20} height={6} fill={selectedColor.dark} rx={1} />
        <rect x={x + width - frameThickness - 30} y={y - 2} width={20} height={6} fill={selectedColor.dark} rx={1} />
        <rect x={x + frameThickness + 10} y={y + height - 4} width={20} height={6} fill={selectedColor.dark} rx={1} />
        <rect x={x + width - frameThickness - 30} y={y + height - 4} width={20} height={6} fill={selectedColor.dark} rx={1} />
        <rect x={x + frameThickness + 10} y={y + height / 2 - 3} width={20} height={6} fill={selectedColor.dark} rx={1} />
        <rect x={x + width - frameThickness - 30} y={y + height / 2 - 3} width={20} height={6} fill={selectedColor.dark} rx={1} />
      </g>

      {/* LED Indikator */}
      <circle
        cx={x + width - 15}
        cy={y + 15}
        r="3"
        fill={ledColor}
        stroke="#000"
        strokeWidth="0.5"
      />
    </g>
  );
};

export default ThermalUnit;