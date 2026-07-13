import React from "react";
import { useIsDark } from "../../hooks/useIsDark";

interface SensorCardProps {
  x?: number;
  y?: number;
  width?: number;
  title: string;
  value?: string | number;
  unit?: string;
  values?: { value: string | number; unit?: string }[];
  colorType?: "blue" | "green";
}

const SensorCard: React.FC<SensorCardProps> = ({
  x = 0,
  y = 0,
  width = 200,
  title,
  value,
  unit,
  values,
  colorType = "blue",
}) => {
  const isDark = useIsDark();

  const pillColors = {
    blue: { light: "#0B3B60", dark: "#1e3a5f" },
    green: { light: "#0b5228", dark: "#1a3a1a" },
  };

  const activePillColor = isDark
    ? pillColors[colorType].dark
    : pillColors[colorType].light;

  const cardBorderColor = isDark ? "#94a3b8" : "#CCCCCC";
  const valueTextColor = isDark ? "#f8fafc" : "#000000";
  const cardBg = isDark ? "#1e293b" : "white";

  const padding = 10;
  const pillHeight = 34;
  const pillY = padding;
  const valueY = pillY + pillHeight + 32;
  const cardHeight = valueY + 24;

  const formatSensorValue = (val: string | number | undefined) => {
    if (val === undefined || val === null) return "";
    if (typeof val === "number") {
      return val.toFixed(1);
    }
    const parsed = Number(val);
    if (typeof val === "string" && !isNaN(parsed) && val.trim() !== "" && val.includes(".")) {
      return parsed.toFixed(1);
    }
    return val;
  };

  let displayContent: React.ReactNode;
  if (values && values.length > 0) {
    const parts = values.map(
      (item) => `${formatSensorValue(item.value)}${item.unit ? " " + item.unit : ""}`
    );
    displayContent = <tspan>{parts.join(" / ")}</tspan>;
  } else {
    displayContent = (
      <tspan>
        {formatSensorValue(value)}
        {unit ? " " + unit : ""}
      </tspan>
    );
  }

  const isApiNotSent = (value && typeof value === "string" && (value.includes("API") || value.includes("TIDAK"))) || 
                       (values && values.some(v => typeof v.value === "string" && (v.value.includes("API") || v.value.includes("TIDAK"))));
  const displayFontSize = isApiNotSent ? "11" : "28";
  const displayTextColor = isApiNotSent ? "#ff2222" : valueTextColor;

  return (
    <g transform={`translate(${x}, ${y})`}>
      <rect
        x={0}
        y={0}
        width={width}
        height={cardHeight}
        fill={cardBg}
        stroke={cardBorderColor}
        strokeWidth={1.5}
        rx={2}
      />
      <rect
        x={padding}
        y={pillY}
        width={width - padding * 2}
        height={pillHeight}
        fill={activePillColor}
        rx={pillHeight / 2}
      />
      <text
        x={width / 2}
        y={pillY + pillHeight / 2}
        dominantBaseline="middle"
        textAnchor="middle"
        fontSize="13"
        fontWeight="bold"
        fill="white"
        fontFamily="sans-serif"
      >
        {title}
      </text>
      <text
        x={width / 2}
        y={valueY}
        dominantBaseline="middle"
        textAnchor="middle"
        fontSize={displayFontSize}
        fontWeight="bold"
        fill={displayTextColor}
        fontFamily="sans-serif"
      >
        {displayContent}
      </text>
    </g>
  );
};

export default SensorCard;