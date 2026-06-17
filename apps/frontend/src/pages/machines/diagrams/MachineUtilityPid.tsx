import { PipeDefs } from "../../../components/pid/PipeDefs";
import { PipeH, PipeV } from "../../../components/pid/Pipe";
import UVLamp from "../../../components/pid/UVLamp";
import Tank from "../../../components/pid/Tank";
import PumpMotor from "../../../components/pid/PumpMotor";
import PipeBend from "../../../components/pid/PipeBend";
import LabelComponent from "../../../components/pid/TextLabel";
import {SensorIndicator} from "../../../components/pid/SensorIndicator";

interface DiagramProps {
  tempSP?: number;
  humiditySP?: number;
  running?: boolean;
}

export default function MachineAHU01Diagram({
  tempSP = 46.8,
  humiditySP = 75.0,
  running = true,
}: DiagramProps) {
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
      <PipeDefs></PipeDefs>

    <Tank x={20} y={150} size={3}/>
      
      <PumpMotor x={300} y={350} size={150} on={running} />
      <PipeH x={262} y={370} w={100} h={6} 
          on={running} dir="right" type="cold" />
      <PipeH x={393} y={317} w={300} h={6} 
          on={running} dir="right" type="cold" />
      <PipeH x={236} y={92} w={300} h={6} 
          on={running} dir="left" type="cold" />
      <PipeV x={372} y={340} w={6} h={24} 
          on={running} dir="up" type="cold" />
      <PipeV x={215} y={115} w={6} h={39} 
          on={running} dir="down" type="cold" />
          <PipeBend x={369} y={315} size={25} angle={90} />
          <PipeBend x={212} y={90} size={25} angle={90} />
          <UVLamp x={500} y={285} size={1.2} on={running} />
          <LabelComponent text="HUMIFIER TANK" x={95} y={350} w={150} h={30} hasBorder={true} fontSize={13}/>
          <LabelComponent text="TO AHU-1&2" x={700} y={308} w={150} h={30} hasBorder={true} fontSize={13}/>
          <LabelComponent text="FROM AHU-1&2" x={550} y={80} w={150} h={30} hasBorder={true} fontSize={13}/>

           <LabelComponent text="HUMI PUMP" x={350} y={510} w={100} h={25} hasBorder={true} fontSize={13}/>
        <SensorIndicator
              x={305}
              y={510}
              w={40}
              h={25}
              value={running} // true = ON (hijau), false = OFF (merah)
              mode="onoff"
              />

               <LabelComponent text="UV LAMP" x={542} y={360} w={80} h={25} hasBorder={true} fontSize={13}/>
        <SensorIndicator
              x={497}
              y={360}
              w={40}
              h={25}
              value={running} // true = ON (hijau), false = OFF (merah)
              mode="onoff"
              />
 
    </svg>
  );
}