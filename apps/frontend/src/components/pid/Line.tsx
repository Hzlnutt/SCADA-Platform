import React from "react";
import { useIsDark } from "../../hooks/useIsDark";

interface LineProps {
  x?: number;
  y?: number;
  color?: string;
  strokeWidth?: number;
  size?: number;
  direction?: number;
  arrow?: 'none' | 'start' | 'end' | 'both';
  arrowSize?: number;
}

const Line: React.FC<LineProps> = ({
  x = 0,
  y = 0,
  color,
  strokeWidth = 2,
  size = 100,
  direction = 0,
  arrow = 'none',
  arrowSize,
}) => {
  const isDark = useIsDark();
  const defaultColor = isDark ? "#38bdf8" : "#0B3B60";
  const effectiveArrowSize = arrowSize ?? strokeWidth * 4;

  const rad = (direction * Math.PI) / 180;
  const endX = x + size * Math.cos(rad);
  const endY = y + size * Math.sin(rad);

  const arrowPoints = (tipX: number, tipY: number, baseX: number, baseY: number) => {
    const dx = tipX - baseX;
    const dy = tipY - baseY;
    const len = Math.sqrt(dx*dx + dy*dy);
    if (len === 0) return '';
    const perpX = -dy / len;
    const perpY = dx / len;
    const halfWidth = effectiveArrowSize / 2;
    const p1 = { x: baseX + halfWidth * perpX, y: baseY + halfWidth * perpY };
    const p2 = { x: baseX - halfWidth * perpX, y: baseY - halfWidth * perpY };
    return `${tipX},${tipY} ${p1.x},${p1.y} ${p2.x},${p2.y}`;
  };

  return (
    <svg style={{ overflow: 'visible' }}>
      <line
        x1={x}
        y1={y}
        x2={endX}
        y2={endY}
        stroke={color ?? defaultColor}
        strokeWidth={strokeWidth}
      />
      {/* Panah di awal: tip di depan titik awal */}
      {(arrow === 'start' || arrow === 'both') && (
        <polygon
          points={arrowPoints(
            x + effectiveArrowSize * Math.cos(rad),
            y + effectiveArrowSize * Math.sin(rad),
            x, y
          )}
          fill={color ?? defaultColor}
        />
      )}
      {/* Panah di akhir: tip di depan titik akhir */}
      {(arrow === 'end' || arrow === 'both') && (
        <polygon
          points={arrowPoints(
            endX + effectiveArrowSize * Math.cos(rad),
            endY + effectiveArrowSize * Math.sin(rad),
            endX, endY
          )}
          fill={color ?? defaultColor}
        />
      )}
    </svg>
  );
};

export default Line;