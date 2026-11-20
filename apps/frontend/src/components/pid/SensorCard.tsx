import React, { useState } from "react";
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
  onClick?: () => void;
  valueFontSize?: number;
  valueColorOverride?: string;
  isActionButton?: boolean;
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
  onClick,
  valueFontSize,
  valueColorOverride,
  isActionButton = false,
}) => {
  const isDark = useIsDark();
  const [hovered, setHovered] = useState(false);

  const pillColors = {
    blue: { light: "#0B3B60", dark: "#1e3a5f" },
    green: { light: "#0b5228", dark: "#1a3a1a" },
  };

  const activePillColor = isDark
    ? pillColors[colorType].dark
    : pillColors[colorType].light;

  const isClickable = typeof onClick === "function";
  const cardBorderColor =
    isClickable && hovered
      ? isDark
        ? "#38bdf8"
        : "#1f6fb5"
      : isDark
      ? "#94a3b8"
      : "#CCCCCC";
  const valueTextColor = isDark ? "#f8fafc" : "#000000";
  const cardBg =
    isClickable && hovered
      ? isDark
        ? "#26354d"
        : "#f0f7ff"
      : isDark
      ? "#1e293b"
      : "white";

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
    const valStr = String(val);
    const parsed = Number(valStr);
    if (!isNaN(parsed) && valStr.trim() !== "" && valStr.includes(".")) {
      return parsed.toFixed(1);
    }
    const lower = valStr.toLowerCase();
    if (lower === "belum ada api" || lower === "xx") {
      return "xx";
    }
    return val;
  };

  let displayContent: React.ReactNode;
  if (values && values.length > 0) {
    const parts = values.map((item) => {
      const valStr = formatSensorValue(item.value);
      if (valStr === "xx") return "xx";
      return `${valStr}${item.unit ? " " + item.unit : ""}`;
    });
    displayContent = <tspan>{parts.join(" / ")}</tspan>;
  } else {
    const valStr = formatSensorValue(value);
    displayContent = (
      <tspan>
        {valStr}
        {valStr !== "xx" && unit ? " " + unit : ""}
      </tspan>
    );
  }

  const isOffline = (value && typeof value === "string" && (value.toUpperCase().includes("API") || value.toUpperCase().includes("TIDAK") || value.toUpperCase() === "XX")) || 
                    (values && values.some(v => typeof v.value === "string" && (v.value.toUpperCase().includes("API") || v.value.toUpperCase().includes("TIDAK") || v.value.toUpperCase() === "XX")));
  const isOff = value === "OFF";
  const isOn = value === "ON" || value === "HEATING" || value === "COOLING" || value === "STERIL";
  const isStandby = value === "STANDBY";

  const displayFontSize = String(valueFontSize ?? 28);
  
  let displayTextColor = valueColorOverride ?? valueTextColor;
  if (!valueColorOverride) {
    if (isOffline) {
      displayTextColor = "#ff2222"; // Red color for missing/dead/unconfigured API data (xx)
    } else if (isOff) {
      displayTextColor = "#ff2222";
    } else if (isOn) {
      displayTextColor = "#00cc00";
    } else if (isStandby) {
      displayTextColor = "#ffaa00";
    }
  }

  const handleClick = (e: React.MouseEvent<SVGGElement>) => {
    if (!onClick) return;
    e.stopPropagation();
    onClick();
  };

  const handleKeyDown = (e: React.KeyboardEvent<SVGGElement>) => {
    if (!onClick) return;
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      e.stopPropagation();
      onClick();
    }
  };

  return (
    <g
      transform={`translate(${x}, ${y})`}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      onMouseEnter={() => isClickable && setHovered(true)}
      onMouseLeave={() => isClickable && setHovered(false)}
      role={isClickable ? "button" : undefined}
      tabIndex={isClickable ? 0 : undefined}
      style={{ cursor: isClickable ? "pointer" : "default" }}
    >
      <rect
        x={0}
        y={0}
        width={width}
        height={cardHeight}
        fill={cardBg}
        stroke={cardBorderColor}
        strokeWidth={isClickable && hovered ? 2.2 : 1.5}
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

      {isActionButton ? (
        <g>
          <rect
            x={padding + 4}
            y={pillY + pillHeight + 13}
            width={width - (padding + 4) * 2}
            height={34}
            rx={8}
            fill={hovered ? "#155c99" : isDark ? "#0284c7" : "#1f6fb5"}
          />
          <text
            x={width / 2}
            y={pillY + pillHeight + 31}
            dominantBaseline="middle"
            textAnchor="middle"
            fontSize={String(valueFontSize ?? 15)}
            fontWeight="bold"
            fill="#ffffff"
            fontFamily="sans-serif"
          >
            {displayContent}
          </text>
        </g>
      ) : (
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
      )}
    </g>
  );
};

export default SensorCard;