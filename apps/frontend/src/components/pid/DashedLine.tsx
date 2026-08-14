import React from "react";
import { useIsDark } from "../../hooks/useIsDark";

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
  color,
  strokeWidth = 1.5,
  dashArray = "5,4",
}) => {
  const isDark = useIsDark();
  // ISA-101 Subdued Leader Line Color
  const defaultColor = isDark ? "#475569" : "#64748b";

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