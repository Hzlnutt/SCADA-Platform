import React from 'react';

interface DashedLineProps {
  x?: number;
  y?: number;
  w?: number;
  h?: number;
  color?: string;
  strokeWidth?: number;
  dashArray?: string;
}

const DashedLine: React.FC<DashedLineProps> = ({
  x = 0,
  y = 0,
  w = 100,
  h = 0,
  color = "#0B3B60",
  strokeWidth = 2,
  dashArray = "6,4",
}) => {
  return (
    <line
      x1={x}
      y1={y}
      x2={x + w}
      y2={y + h}
      stroke={color}
      strokeWidth={strokeWidth}
      strokeDasharray={dashArray}
    />
  );
};

export default DashedLine;