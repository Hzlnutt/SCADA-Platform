import React from "react";
import { useIsDark } from "../../hooks/useIsDark";

type Props = {
  text: string;
  x?: number;
  y?: number;
  w?: number;
  h?: number;
  hasBorder?: boolean;
  fontSize?: number;
  bgColor?: string;
};

const LabelComponent: React.FC<Props> = ({
  text,
  x = 0,
  y = 0,
  w = 200,
  h = 60,
  hasBorder = false,
  fontSize: customFontSize,
  bgColor,
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

  const defaultBg = isDark ? "#0f172a" : "#f8fafc";
  const fillColor = bgColor ?? defaultBg;

  return (
    <g>
      {hasBorder && (
        <rect
          x={x}
          y={y}
          width={w}
          height={h}
          fill={fillColor}
          rx={4}
        />
      )}
      {hasBorder && (
        <rect
          x={x}
          y={y}
          width={w}
          height={h}
          fill="none"
          stroke={isDark ? "#334155" : "#cbd5e1"}
          strokeWidth="1.5"
          rx={4}
        />
      )}
      <text
        x={x + w / 2}
        y={y + h / 2 + 1}
        dominantBaseline="middle"
        textAnchor="middle"
        fontSize={fontSize}
        fontFamily="'Plus Jakarta Sans', sans-serif"
        fontWeight="700"
        fill={isDark ? "#f8fafc" : "#0f172a"}
        letterSpacing="0.02em"
      >
        {text}
      </text>
    </g>
  );
};

export default LabelComponent;