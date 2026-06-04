import { useEffect, useState } from "react";

interface LevelIndicatorProps {
  x: number;
  y: number;
  value: number; // 0-100
  w?: number;
  h?: number;
  minThreshold?: number;
  warningThreshold?: number;
  showThresholdLine?: boolean;
  type?: 'cold' | 'warm';
}

export function LevelIndicator({
  x,
  y,
  value,
  w = 50,
  h = 120,
  minThreshold = 70,
  warningThreshold = 75,
  showThresholdLine = true,
  type = 'cold',
}: LevelIndicatorProps) {
  const [displayValue, setDisplayValue] = useState(value);

  useEffect(() => {
    setDisplayValue(value);
  }, [value]);

  const clampedValue = Math.max(0, Math.min(100, displayValue));
  const fillHeight = (clampedValue / 100) * h;
  const fillY = y + (h - fillHeight);

  // ── Warna ────────────────────────────────────────────────────────────────────
  const getColor = () => {
    if (clampedValue < minThreshold) {
      // Alarm
      return type === 'cold' ? "#0044cc" : "#cc0000";
    }
    if (clampedValue < warningThreshold) {
      // Warning
      return type === 'cold' ? "#0099ff" : "#ff6600";
    }
    // Normal
    return type === 'cold' ? "#00ccff" : "#ff9900";
  };

  const getGradientId = () => {
    const prefix = type === 'cold' ? 'cold' : 'warm';
    if (clampedValue < minThreshold) return `grad-${prefix}-alarm`;
    if (clampedValue < warningThreshold) return `grad-${prefix}-warning`;
    return `grad-${prefix}-normal`;
  };

  const getHighlightColor = () => {
    if (clampedValue < minThreshold) {
      return type === 'cold' ? "#4488ff" : "#ff4444";
    }
    if (clampedValue < warningThreshold) {
      return type === 'cold' ? "#66bbff" : "#ff8844";
    }
    return type === 'cold' ? "#aaddff" : "#ffcc55";
  };

  const color = getColor();
  const gradIdUnique = `${getGradientId()}-${Math.random().toString(36).substr(2, 9)}`;
  const clipId = `clip-level-${Math.random().toString(36).substr(2, 9)}`;

  const borderRadius = Math.max(1, w * 0.08);
  const borderWidth = Math.max(1, w * 0.03);

  // ── Gradient Stops ──────────────────────────────────────────────────────────
  const getGradientStops = () => {
    if (type === 'cold') {
      if (clampedValue < minThreshold) return { stop1: "#4488ff", stop2: "#0044cc" };
      if (clampedValue < warningThreshold) return { stop1: "#66bbff", stop2: "#0099ff" };
      return { stop1: "#aaddff", stop2: "#00ccff" };
    } else {
      // Warm tetap pakai warna panas
      if (clampedValue < minThreshold) return { stop1: "#ff4444", stop2: "#cc0000" };
      if (clampedValue < warningThreshold) return { stop1: "#ff8844", stop2: "#ff6600" };
      return { stop1: "#ffcc55", stop2: "#ff9900" };
    }
  };

  const gradientStops = getGradientStops();

  // ── Generate random negative delay untuk setiap bubble ─────────────────────
  const getRandomNegativeDelay = (duration: number) => {
    return `-${(Math.random() * duration).toFixed(2)}s`;
  };

  return (
    <g>
      <defs>
        <clipPath id={clipId}>
          <rect x={x} y={y} width={w} height={h} rx={borderRadius} />
        </clipPath>

        <linearGradient id={gradIdUnique} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" style={{ stopColor: gradientStops.stop1, stopOpacity: 0.3 }} />
          <stop offset="100%" style={{ stopColor: gradientStops.stop2, stopOpacity: 1 }} />
        </linearGradient>

        <style>{`
          /* ── Bubble Lambat dengan Gerakan Menyamping ── */
          @keyframes bubbleRise1 {
            0%   { opacity: 0.9; transform: translateY(0)    translateX(0); }
            25%  { opacity: 0.9; transform: translateY(-30%) translateX(${w * 0.15}px); }
            50%  { opacity: 0.8; transform: translateY(-60%) translateX(${-w * 0.1}px); }
            75%  { opacity: 0.5; transform: translateY(-85%) translateX(${w * 0.12}px); }
            100% { opacity: 0;   transform: translateY(-100%) translateX(${w * 0.05}px); }
          }
          @keyframes bubbleRise2 {
            0%   { opacity: 0.8; transform: translateY(0)    translateX(0); }
            30%  { opacity: 0.8; transform: translateY(-35%) translateX(${-w * 0.12}px); }
            60%  { opacity: 0.6; transform: translateY(-70%) translateX(${w * 0.08}px); }
            100% { opacity: 0;   transform: translateY(-100%) translateX(${-w * 0.06}px); }
          }
          @keyframes bubbleRise3 {
            0%   { opacity: 0.9; transform: translateY(0)    translateX(0); }
            20%  { opacity: 0.9; transform: translateY(-25%) translateX(${w * 0.1}px); }
            50%  { opacity: 0.7; transform: translateY(-60%) translateX(${-w * 0.15}px); }
            80%  { opacity: 0.4; transform: translateY(-85%) translateX(${w * 0.08}px); }
            100% { opacity: 0;   transform: translateY(-100%) translateX(${-w * 0.04}px); }
          }
          @keyframes bubbleRise4 {
            0%   { opacity: 0.7; transform: translateY(0)    translateX(0); }
            35%  { opacity: 0.7; transform: translateY(-40%) translateX(${-w * 0.08}px); }
            70%  { opacity: 0.5; transform: translateY(-75%) translateX(${w * 0.2}px); }
            100% { opacity: 0;   transform: translateY(-100%) translateX(${-w * 0.03}px); }
          }
          @keyframes bubbleRise5 {
            0%   { opacity: 0.9; transform: translateY(0)    translateX(0); }
            30%  { opacity: 0.9; transform: translateY(-30%) translateX(${w * 0.2}px); }
            60%  { opacity: 0.6; transform: translateY(-65%) translateX(${-w * 0.1}px); }
            100% { opacity: 0;   transform: translateY(-100%) translateX(${w * 0.15}px); }
          }
          @keyframes bubbleRise6 {
            0%   { opacity: 0.8; transform: translateY(0)    translateX(0); }
            25%  { opacity: 0.8; transform: translateY(-30%) translateX(${-w * 0.2}px); }
            55%  { opacity: 0.6; transform: translateY(-65%) translateX(${w * 0.1}px); }
            100% { opacity: 0;   transform: translateY(-100%) translateX(${-w * 0.12}px); }
          }

          @keyframes shimmer {
            0%, 100% { opacity: 0.15; }
            50% { opacity: 0.5; }
          }

          .liquid-shimmer { animation: shimmer 3s ease-in-out infinite; }
        `}</style>
      </defs>

      {/* Container border */}
      <rect
        x={x}
        y={y}
        width={w}
        height={h}
        rx={borderRadius}
        fill="none"
        stroke={color}
        strokeWidth={borderWidth}
      />

      {/* Garis threshold minimum */}
      {showThresholdLine && (
        <line
          x1={x}
          y1={y + h * (1 - minThreshold / 100)}
          x2={x + w}
          y2={y + h * (1 - minThreshold / 100)}
          stroke="#ff5555"
          strokeWidth={Math.max(0.5, w * 0.02)}
          strokeDasharray="2,2"
          opacity="0.5"
        />
      )}

      {/* Liquid fill */}
      {clampedValue > 0 && (
        <g clipPath={`url(#${clipId})`}>
          {/* Base liquid */}
          <rect
            x={x}
            y={fillY}
            width={w}
            height={fillHeight}
            fill={`url(#${gradIdUnique})`}
          />

          {/* Shimmer overlay (untuk kedua jenis) */}
          <rect
            x={x}
            y={fillY}
            width={w}
            height={fillHeight}
            fill={getHighlightColor()}
            className="liquid-shimmer"
          />

          {/* ── 6 BUBBLE UNTUK WARM (random start, lambat & menyamping) ── */}
          {type === 'warm' && (
            <>
              <circle
                cx={x + w * 0.25}
                cy={fillY + fillHeight * 0.85}
                r={Math.max(0.8, w * 0.07)}
                fill="#ffffff"
                style={{
                  animation: `bubbleRise1 14s ease-out infinite`,
                  animationDelay: getRandomNegativeDelay(14),
                }}
              />
              <circle
                cx={x + w * 0.45}
                cy={fillY + fillHeight * 0.65}
                r={Math.max(0.6, w * 0.055)}
                fill="#ffffff"
                style={{
                  animation: `bubbleRise2 16s ease-out infinite`,
                  animationDelay: getRandomNegativeDelay(16),
                }}
              />
              <circle
                cx={x + w * 0.75}
                cy={fillY + fillHeight * 0.75}
                r={Math.max(0.7, w * 0.06)}
                fill="#ffffff"
                style={{
                  animation: `bubbleRise3 18s ease-out infinite`,
                  animationDelay: getRandomNegativeDelay(18),
                }}
              />
              <circle
                cx={x + w * 0.15}
                cy={fillY + fillHeight * 0.55}
                r={Math.max(0.5, w * 0.045)}
                fill="#ffffff"
                style={{
                  animation: `bubbleRise4 12s ease-out infinite`,
                  animationDelay: getRandomNegativeDelay(12),
                }}
              />
              <circle
                cx={x + w * 0.65}
                cy={fillY + fillHeight * 0.95}
                r={Math.max(0.9, w * 0.08)}
                fill="#ffffff"
                style={{
                  animation: `bubbleRise5 15s ease-out infinite`,
                  animationDelay: getRandomNegativeDelay(15),
                }}
              />
              <circle
                cx={x + w * 0.35}
                cy={fillY + fillHeight * 0.45}
                r={Math.max(0.5, w * 0.04)}
                fill="#ffffff"
                style={{
                  animation: `bubbleRise6 13s ease-out infinite`,
                  animationDelay: getRandomNegativeDelay(13),
                }}
              />
            </>
          )}
        </g>
      )}
    </g>
  );
}