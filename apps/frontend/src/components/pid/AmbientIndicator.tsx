import React from "react";
import LabelComponent from "./TextLabel";
import { SensorIndicator } from "./SensorIndicator";

export interface AmbientCardProps {
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  temp?: number | null;
  humidity?: number | null;
}

export const AmbientCard: React.FC<AmbientCardProps> = ({
  x = 870,
  y = 12,
  width = 115,
  height = 128,
  temp = null,
  humidity = null,
}) => {
  const itemW = width - 16; // 99
  const itemX = x + 8;

  return (
    <g id="ambient-card" className="select-none transition-all duration-300">
      {/* Outer Card Background Frame */}
      <rect
        x={x}
        y={y}
        width={width}
        height={height}
        rx={6}
        fill="#1e293b"
        stroke="#38bdf8"
        strokeWidth={1.5}
      />

      {/* Card Header Banner */}
      <path
        d={`M ${x} ${y + 6} A 6 6 0 0 1 ${x + 6} ${y} L ${x + width - 6} ${y} A 6 6 0 0 1 ${x + width} ${y + 6} L ${x + width} ${y + 24} L ${x} ${y + 24} Z`}
        fill="#0f172a"
      />
      <line
        x1={x}
        y1={y + 24}
        x2={x + width}
        y2={y + 24}
        stroke="#38bdf8"
        strokeWidth={1}
        strokeOpacity={0.5}
      />
      <text
        x={x + width / 2}
        y={y + 16}
        textAnchor="middle"
        fontSize={11}
        fontWeight="800"
        fontFamily="sans-serif"
        fill="#38bdf8"
        letterSpacing="0.08em"
      >
        AMBIENT
      </text>

      {/* Ambient Temperature */}
      <LabelComponent
        text="Ambient Temp"
        x={itemX}
        y={y + 30}
        w={itemW}
        h={18}
        hasBorder={true}
        fontSize={10}
      />
      <SensorIndicator
        x={itemX}
        y={y + 51}
        w={itemW}
        h={24}
        value={temp}
        unit=" °C"
        warningThreshold={35}
        alarmThreshold={38}
        thresholdDirection="above"
        decimalPlaces={1}
      />

      {/* Ambient RH */}
      <LabelComponent
        text="Ambient RH"
        x={itemX}
        y={y + 79}
        w={itemW}
        h={18}
        hasBorder={true}
        fontSize={10}
      />
      <SensorIndicator
        x={itemX}
        y={y + 100}
        w={itemW}
        h={24}
        value={humidity}
        unit=" %RH"
        warningThreshold={80}
        alarmThreshold={85}
        thresholdDirection="above"
        decimalPlaces={1}
      />
    </g>
  );
};

export default AmbientCard;
