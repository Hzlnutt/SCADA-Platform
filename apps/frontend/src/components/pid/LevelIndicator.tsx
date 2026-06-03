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
}

/**
 * Level indicator dengan liquid water animation.
 * Hanya menampilkan liquid dengan bubble & shimmer effect.
 * Tidak ada text, label, atau unit.
 */
export function LevelIndicator({
  x,
  y,
  value,
  w = 50,
  h = 120,
  minThreshold = 70,
  warningThreshold = 85,
  showThresholdLine = true,
}: LevelIndicatorProps) {
  const [displayValue, setDisplayValue] = useState(value);

  useEffect(() => {
    setDisplayValue(value);
  }, [value]);

  const clampedValue = Math.max(0, Math.min(100, displayValue));
  const fillHeight = (clampedValue / 100) * h;
  const fillY = y + (h - fillHeight);

  const getColor = () => {
    if (clampedValue < minThreshold) return "#ff2222";
    if (clampedValue < warningThreshold) return "#ffaa00";
    return "#00cc00";
  };

  const getGradientId = () => {
    if (clampedValue < minThreshold) return "grad-red";
    if (clampedValue < warningThreshold) return "grad-amber";
    return "grad-green";
  };

  const color = getColor();
  const gradId = getGradientId();
  const cx = x + w / 2;

  const clipId = `clip-level-${Math.random().toString(36).substr(2, 9)}`;
  const gradIdUnique = `${gradId}-${Math.random().toString(36).substr(2, 9)}`;

  const borderRadius = Math.max(1, w * 0.08);
  const borderWidth = Math.max(1, w * 0.03);

  // Warna highlight untuk shimmer
  const getHighlightColor = () => {
    if (clampedValue < minThreshold) return "#ff6666";
    if (clampedValue < warningThreshold) return "#ffdd00";
    return "#00ff88";
  };

  return (
    <g>
      <defs>
        <clipPath id={clipId}>
          <rect x={x} y={y} width={w} height={h} rx={borderRadius} />
        </clipPath>

        {/* Gradient untuk liquid */}
        {clampedValue < minThreshold ? (
          <linearGradient id={gradIdUnique} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" style={{ stopColor: "#ff6666", stopOpacity: 0.3 }} />
            <stop offset="100%" style={{ stopColor: "#ff2222", stopOpacity: 1 }} />
          </linearGradient>
        ) : clampedValue < warningThreshold ? (
          <linearGradient id={gradIdUnique} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" style={{ stopColor: "#ffdd00", stopOpacity: 0.3 }} />
            <stop offset="100%" style={{ stopColor: "#ffaa00", stopOpacity: 1 }} />
          </linearGradient>
        ) : (
          <linearGradient id={gradIdUnique} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" style={{ stopColor: "#00ff88", stopOpacity: 0.3 }} />
            <stop offset="100%" style={{ stopColor: "#00cc00", stopOpacity: 1 }} />
          </linearGradient>
        )}

        <style>{`
          @keyframes bubbleRise1 {
            0% {
              opacity: 1;
              transform: translateY(0) translateX(0);
            }
            100% {
              opacity: 0;
              transform: translateY(-${h}px) translateX(${w * 0.3}px);
            }
          }
          @keyframes bubbleRise2 {
            0% {
              opacity: 0.8;
              transform: translateY(0) translateX(0);
            }
            100% {
              opacity: 0;
              transform: translateY(-${h}px) translateX(-${w * 0.2}px);
            }
          }
          @keyframes bubbleRise3 {
            0% {
              opacity: 0.9;
              transform: translateY(0) translateX(0);
            }
            100% {
              opacity: 0;
              transform: translateY(-${h}px) translateX(${w * 0.15}px);
            }
          }
          @keyframes shimmer {
            0%, 100% {
              opacity: 0.15;
            }
            50% {
              opacity: 0.5;
            }
          }
          .bubble-1 {
            animation: bubbleRise1 3s ease-out infinite;
          }
          .bubble-2 {
            animation: bubbleRise2 2.5s ease-out infinite 0.4s;
          }
          .bubble-3 {
            animation: bubbleRise3 3.5s ease-out infinite 0.8s;
          }
          .liquid-shimmer {
            animation: shimmer 2s ease-in-out infinite;
          }
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

      {/* Liquid fill dengan animasi */}
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

          {/* Shimmer overlay */}
          <rect
            x={x}
            y={fillY}
            width={w}
            height={fillHeight}
            fill={getHighlightColor()}
            className="liquid-shimmer"
          />

          {/* Bubble particles */}
          <circle
            cx={x + w * 0.3}
            cy={fillY + fillHeight * 0.7}
            r={Math.max(0.8, w * 0.06)}
            fill="#ffffff"
            className="bubble-1"
          />
          <circle
            cx={x + w * 0.5}
            cy={fillY + fillHeight * 0.5}
            r={Math.max(0.6, w * 0.045)}
            fill="#ffffff"
            className="bubble-2"
          />
          <circle
            cx={x + w * 0.7}
            cy={fillY + fillHeight * 0.8}
            r={Math.max(0.5, w * 0.035)}
            fill="#ffffff"
            className="bubble-3"
          />
        </g>
      )}
    </g>
  );
}