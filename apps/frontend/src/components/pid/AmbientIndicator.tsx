import LabelComponent from "./TextLabel";
import { SensorIndicator } from "./SensorIndicator";

interface AmbientIndicatorProps {
  x?: number;
  y?: number;
  w?: number;
  temp?: number | null;
  humidity?: number | null;
  isStopped?: boolean;
}

export function AmbientIndicator({
  x = 865,
  y = 13,
  w = 120,
  temp = null,
  humidity = null,
}: AmbientIndicatorProps) {
  return (
    <g className="ambient-indicator-group select-none">
      {/* Ambient Temperature */}
      <LabelComponent
        text="Ambient Temp"
        x={x}
        y={y}
        w={w}
        h={25}
        hasBorder={true}
        fontSize={12}
      />
      <SensorIndicator
        x={x}
        y={y + 27}
        w={w}
        h={30}
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
        x={x}
        y={y + 60}
        w={w}
        h={25}
        hasBorder={true}
        fontSize={12}
      />
      <SensorIndicator
        x={x}
        y={y + 87}
        w={w}
        h={30}
        value={humidity}
        unit=" %RH"
        warningThreshold={80}
        alarmThreshold={85}
        thresholdDirection="above"
        decimalPlaces={1}
      />
    </g>
  );
}

export default AmbientIndicator;
