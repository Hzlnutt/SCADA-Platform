import React from "react";
import { useIsDark } from "../../hooks/useIsDark"; // sesuaikan path

type Props = {
  text: string;
  x?: number;
  y?: number;
  w?: number;
  h?: number;
  hasBorder?: boolean;
  fontSize?: number;
};

const LabelComponent: React.FC<Props> = ({
  text,
  x = 0,
  y = 0,
  w = 200,
  h = 60,
  hasBorder = false,
  fontSize: customFontSize,
}) => {
  const isDark = useIsDark();
  const padding = 8;

  if (w < 20 || h < 20 || !text) return null;

  const availableWidth = w - padding * 2;
  const availableHeight = h - padding * 2;

  const fontSizeByWidth = (availableWidth / text.length) * 1.2;
  const fontSizeByHeight = availableHeight * 0.9;
  let autoFontSize = Math.min(fontSizeByWidth, fontSizeByHeight);
  autoFontSize = Math.min(autoFontSize, 80);
  autoFontSize = Math.max(autoFontSize, 8);

  const fontSize = customFontSize ?? autoFontSize;

  return (
    <g>
      {hasBorder && (
        <rect
          x={x}
          y={y}
          width={w}
          height={h}
          fill={isDark ? "#1e293b" : "white"}
          rx={2}
        />
      )}
      {hasBorder && (
        <rect
          x={x}
          y={y}
          width={w}
          height={h}
          fill="none"
          stroke={isDark ? "#38bdf8" : "#0B3B60"}
          strokeWidth="3"
          rx={2}
        />
      )}
      <text
        x={x + w / 2}
        y={y + h / 2}
        dominantBaseline="middle"
        textAnchor="middle"
        fontSize={fontSize}
        fontFamily="Arial Black, sans-serif"
        fontWeight="900"
        fill={isDark ? "#f1f5f9" : "#000000"}
      >
        {text}
      </text>
    </g>
  );
};

export default LabelComponent;