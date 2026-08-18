import React from "react";
import { useIsDark } from "../../hooks/useIsDark";

interface DashedLineProps {
  x?: number;
  y?: number;
  w?: number;
  h?: number;
  color?: string; // override manual
  strokeWidth?: number;
  dashArray?: string;
}

const DashedLine: React.FC<DashedLineProps> = ({
  x = 0,
  y = 0,
  w = 100,
  h = 0,
  color,
  strokeWidth = 2,
  dashArray = "6,4",
}) => {
  const isDark = useIsDark();
  const defaultColor = isDark ? "#38bdf8" : "#0B3B60";

  return (
    <line
      x1={x}
      y1={y}
      x2={x + w}
      y2={y + h}
      stroke={color ?? defaultColor}
      strokeWidth={strokeWidth}
      strokeDasharray={dashArray}
    />
  );
};

export default DashedLine;