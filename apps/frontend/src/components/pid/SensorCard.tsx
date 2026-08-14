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
  isAlarm?: boolean;
  isWarning?: boolean;
}

const SensorCard: React.FC<SensorCardProps> = ({
  x = 0,
  y = 0,
  width = 200,
  title,
  value,
  unit,
  values,
  isAlarm = false,
  isWarning = false,
}) => {
  const isDark = useIsDark();

  const cardBorderColor = isAlarm
    ? "#ef4444"
    : isWarning
    ? "#f59e0b"
    : isDark
    ? "#334155"
    : "#cbd5e1";

  const cardBg = isDark ? "#0f172a" : "#f8fafc";
  const pillBg = isDark ? "#1e293b" : "#e2e8f0";
  const pillTextColor = isDark ? "#f8fafc" : "#0f172a";

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

  const isOffline =
    (value &&
      typeof value === "string" &&
      (value.toUpperCase().includes("API") ||
        value.toUpperCase().includes("TIDAK") ||
        value.toUpperCase() === "XX")) ||
    (values &&
      values.some(
        (v) =>
          typeof v.value === "string" &&
          (v.value.toUpperCase().includes("API") ||
            v.value.toUpperCase().includes("TIDAK") ||
            v.value.toUpperCase() === "XX")
      ));

  const isOff = value === "OFF";
  const isOn =
    value === "ON" ||
    value === "HEATING" ||
    value === "COOLING" ||
    value === "STERIL";
  const isStandby = value === "STANDBY";

  const displayFontSize = "28";

  // ISA-101 Monochromatic Color Decisions
  let displayTextColor = isDark ? "#f8fafc" : "#0f172a";
  if (isAlarm) {
    displayTextColor = "#ef4444"; // Alarm Anomaly Red
  } else if (isWarning) {
    displayTextColor = "#f59e0b"; // Warning Anomaly Amber
  } else if (isOffline) {
    displayTextColor = "#64748b"; // Calm Muted Slate
  } else if (isOff) {
    displayTextColor = "#64748b"; // Calm Muted Slate (No false alarm)
  } else if (isOn) {
    displayTextColor = isDark ? "#f8fafc" : "#0f172a"; // Clean Crisp Slate/White
  } else if (isStandby) {
    displayTextColor = "#94a3b8"; // Calm Neutral Slate
  }

  return (
    <g transform={`translate(${x}, ${y})`}>
      {/* Background Card */}
      <rect
        x={0}
        y={0}
        width={width}
        height={cardHeight}
        rx={8}
        fill={cardBg}
        stroke={cardBorderColor}
        strokeWidth={isAlarm ? 2.5 : isWarning ? 2 : 1.5}
      >
        {isAlarm && (
          <animate
            attributeName="stroke-opacity"
            values="1;0.4;1"
            dur="1s"
            repeatCount="indefinite"
          />
        )}
      </rect>

      {/* Header Pill */}
      <rect
        x={padding}
        y={pillY}
        width={width - padding * 2}
        height={pillHeight}
        rx={6}
        fill={pillBg}
        stroke={isDark ? "#334155" : "#cbd5e1"}
        strokeWidth={1}
      />

      {/* Header Text */}
      <text
        x={width / 2}
        y={pillY + pillHeight / 2 + 1}
        textAnchor="middle"
        dominantBaseline="middle"
        fill={pillTextColor}
        fontSize="13"
        fontWeight="bold"
        fontFamily="'Plus Jakarta Sans', sans-serif"
        letterSpacing="0.04em"
      >
        {title}
      </text>

      {/* Sensor Value Display */}
      <text
        x={width / 2}
        y={valueY}
        textAnchor="middle"
        dominantBaseline="middle"
        fill={displayTextColor}
        fontSize={displayFontSize}
        fontWeight="800"
        fontFamily="'Plus Jakarta Sans', 'IBM Plex Mono', sans-serif"
      >
        {displayContent}
      </text>
    </g>
  );
};

export default SensorCard;