import React from "react";
import TitleCard from "./TitleCard";
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
  x = 855,
  y = 15,
  width = 130,
  height = 160,
  temp = null,
  humidity = null,
}) => {
  const itemW = width - 20; // 110
  const itemX = x + 10;

  return (
    <g id="ambient-card" className="select-none transition-all duration-300">
      {/* Outer Card Background and Title */}
      <TitleCard
        x={x}
        y={y}
        width={width}
        height={height}
        title="AMBIENT"
        fontSize={13}
        color="#2C3E50"
        textColor="#ECF0F1"
        borderRadius={8}
        paddingTop={12}
      />

      {/* Ambient Temperature */}
      <LabelComponent
        text="Ambient Temp"
        x={itemX}
        y={y + 38}
        w={itemW}
        h={22}
        hasBorder={true}
        fontSize={11}
      />
      <SensorIndicator
        x={itemX}
        y={y + 63}
        w={itemW}
        h={27}
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
        y={y + 97}
        w={itemW}
        h={22}
        hasBorder={true}
        fontSize={11}
      />
      <SensorIndicator
        x={itemX}
        y={y + 122}
        w={itemW}
        h={27}
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
