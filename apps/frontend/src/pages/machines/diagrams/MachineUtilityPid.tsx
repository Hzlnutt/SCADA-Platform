import { PipeDefs } from "../../../components/pid/PipeDefs";
import { PipeH, PipeV } from "../../../components/pid/Pipe";
import UVLamp from "../../../components/pid/UVLamp";
import Tank from "../../../components/pid/Tank";
import PumpMotor from "../../../components/pid/PumpMotor";
import PipeBend from "../../../components/pid/PipeBend";
import LabelComponent from "../../../components/pid/TextLabel";
import { SensorIndicator } from "../../../components/pid/SensorIndicator";
import AmbientCard from "../../../components/pid/AmbientIndicator";

interface DiagramProps {
  tempSP?: number;
  humiditySP?: number;
  running?: boolean;
  data?: Record<string, any>;
  ambientTemp?: number | null;
  ambientHumid?: number | null;
}

export default function MachineUtilityPid({
  tempSP = 22.0,
  humiditySP = 60.0,
  running = true,
  data = {},
  ambientTemp = null,
  ambientHumid = null,
}: DiagramProps) {
  const hpRunning = data.xIND_RUN_HP !== undefined ? Boolean(data.xIND_RUN_HP) : running;
  const uvRunning = data.UV_LAMP !== undefined ? Boolean(data.UV_LAMP) : running;

  const ambientT = ambientTemp !== null ? ambientTemp : (typeof data.Ambient_Temp === "number" ? data.Ambient_Temp : (typeof data.ambient_temp === "number" ? data.ambient_temp : null));
  const ambientH = ambientHumid !== null ? ambientHumid : (typeof data.Ambient_RH === "number" ? data.Ambient_RH : (typeof data.ambient_humid === "number" ? data.ambient_humid : null));

  return (
    <svg
      viewBox="0 0 1000 600"
      className="w-full h-full max-h-full transition-all duration-350 select-none"
    >
      {/* Grid Background */}
      <rect width="1000" height="600" rx="8" className="fill-slate-50/20 dark:fill-slate-950/20" />
      <g className="stroke-slate-200/40 dark:stroke-slate-800/30" strokeWidth="0.5">
        {Array.from({ length: 20 }).map((_, i) => (
          <line key={`x-${i}`} x1={i * 50} y1="0" x2={i * 50} y2="600" />
        ))}
        {Array.from({ length: 12 }).map((_, i) => (
          <line key={`y-${i}`} x1="0" y1={i * 50} x2="1000" y2={i * 50} />
        ))}
      </g>
      <PipeDefs />

      <Tank x={20} y={150} size={3}/>
      
      <PumpMotor x={300} y={350} size={150} on={hpRunning} />
      <PipeH x={262} y={370} w={100} h={6} 
        on={hpRunning} dir="right" type="cold" />
      <PipeH x={393} y={317} w={300} h={6} 
        on={hpRunning} dir="right" type="cold" />
      <PipeH x={236} y={92} w={300} h={6} 
        on={hpRunning} dir="left" type="cold" />
      <PipeV x={372} y={340} w={6} h={24} 
        on={hpRunning} dir="up" type="cold" />
      <PipeV x={215} y={115} w={6} h={39} 
        on={hpRunning} dir="down" type="cold" />
      <PipeBend x={369} y={315} size={25} angle={90} />
      <PipeBend x={212} y={90} size={25} angle={90} />
      <UVLamp x={500} y={285} size={1.2} on={uvRunning} />
      <LabelComponent text="HUMIFIER TANK" x={95} y={350} w={150} h={30} hasBorder={true} fontSize={13}/>
      <LabelComponent text="TO AHU-1&2" x={700} y={308} w={150} h={30} hasBorder={true} fontSize={13}/>
      <LabelComponent text="FROM AHU-1&2" x={550} y={80} w={150} h={30} hasBorder={true} fontSize={13}/>

      {/* HUMI PUMP */}
      <LabelComponent text="HUMI PUMP" x={350} y={510} w={100} h={25} hasBorder={true} fontSize={13}/>
      <SensorIndicator
        x={305}
        y={510}
        w={40}
        h={25}
        value={hpRunning} // true = ON (hijau), false = OFF (merah)
        mode="onoff"
      />

      {/* UV LAMP */}
      <LabelComponent text="UV LAMP" x={542} y={360} w={80} h={25} hasBorder={true} fontSize={13}/>
      <SensorIndicator
        x={497}
        y={360}
        w={40}
        h={25}
        value={uvRunning} // true = ON (hijau), false = OFF (merah)
        mode="onoff"
      />

      {/* Ambient Card (Ambient Temp & RH) */}
      <AmbientCard
        x={855}
        y={15}
        width={130}
        height={160}
        temp={ambientT}
        humidity={ambientH}
      />
    </svg>
  );
}