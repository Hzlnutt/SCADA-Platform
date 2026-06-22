import PreFilter from "../../../components/pid/PreFilter";
import AHUBox from "../../../components/pid/AHUBox";
import DuctSection from "../../../components/pid/DuctSection";
import Partition from "../../../components/pid/Partition";
import SupplyFan from "../../../components/pid/SupplyFan";
import ThermalUnit from "../../../components/pid/ThermalUnit";
import HumidityFan from "../../../components/pid/HumidityFan"
import DifferentialPressureSwitch from "../../../components/pid/DPS";
import Line from "../../../components/pid/Line";
import TitleCard from "../../../components/pid/TitleCard";
import LabelComponent from "../../../components/pid/TextLabel";
import {SensorIndicator} from "../../../components/pid/SensorIndicator";
import PipeBend from "../../../components/pid/PipeBend";
import { PipeDefs } from "../../../components/pid/PipeDefs";
import { PipeH, PipeV } from "../../../components/pid/Pipe";
import DashedLine from "../../../components/pid/DashedLine";
import ACUnit from "../../../components/pid/ACUnit"
import {PipeT} from "../../../components/pid/PipeT";
import AHUFan from "../../../components/pid/AHUFan";

interface PidProps {
  tempSP?: number;
  humiditySP?: number;
  running?: boolean;
}

export default function MachineAHU01Pid({
  tempSP = 46.8,
  humiditySP = 75.0,
  running = true,
}: PidProps) {
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
      <AHUBox
        x={50}
        y={30}
        width={470}
        height={250}
      />

      <DuctSection
          x={10}
          y={70}
          width={40}
          height={80}
          direction="right"
          flowDirection="in" 
          flangeWidth={24}
        />

      <DuctSection
          x={10}
          y={170}
          width={40}
          height={80}
          direction="right"
          flowDirection="in" 
          flangeWidth={24}
        />

      <DuctSection
          x={522}
          y={115}
          width={40}
          height={80}
          direction="left"
          flowDirection="out"
          flangeWidth={24}
        />

        <PreFilter
        x={90}
        y={60}
        width={60}
        height={190}
        color="blue"
    />

    
    <Partition x={290} y={60} width={14} height={190} color="#606060" />

    <ThermalUnit 
        x={190} 
        y={60} 
        width={60} 
        height={190} 
        running={running} 
        type="cooler"
        
      />

      <AHUFan
        x={320} 
        y={110} 
        size={1.5} 
        isRunning={running} 
      />

      <LabelComponent text="C/C" x={188} y={240} w={65} h={25} hasBorder={true} fontSize={13}/>
      <LabelComponent text="PF-03" x={88} y={240} w={65} h={25} hasBorder={true} fontSize={13}/>

      <LabelComponent text="ID/OD" x={390} y={290} w={65} h={25} hasBorder={true} fontSize={13}/>
        <SensorIndicator
              x={345}
              y={290}
              w={40}
              h={25}
              value={running} // true = ON (hijau), false = OFF (merah)
              mode="onoff"
              />

      <DashedLine x={320} y={303} w={20} h={0} />
      <DashedLine x={320} y={185} w={20} h={0} />
      <DashedLine x={320} y={185} w={0} h={120} />

      
      <PipeV x={168} y={250} w={6} h={170} 
          on={true} dir="up" type="cold" />
      <PipeV x={265.5} y={93} w={6} h={320} 
          on={true} dir="down" type="cold" />
      <PipeH x={190} y={434} w={90} h={6} 
          on={true} dir="left" type="cold" />
       <PipeBend x={165} y={225} size={25} angle={90} />
       <PipeBend x={250} y={70} size={25} angle={180} />
       <PipeBend x={165.5} y={418} size={25} angle={0} />
       <PipeBend x={263} y={405} size={25} angle={0} />
       <ACUnit x={1600} y={2500} w={200} h={75} running={running} />

        <Line x={0} y={110} size={60} direction={0} strokeWidth={4} color="red" arrow="end" />
        <Line x={0} y={210} size={60} direction={0} strokeWidth={4} color="red" arrow="end" />
        <Line x={2} y={210} size={360} direction={90} strokeWidth={4} color="red" />
        <Line x={0} y={570} size={950} direction={0} strokeWidth={4} color="red" />
        <Line x={500} y={155} size={450} direction={0} strokeWidth={4} color="blue" />
        <Line x={600} y={155} size={50} direction={90} strokeWidth={4} color="blue" arrow="end" />
        <Line x={725} y={155} size={50} direction={90} strokeWidth={4} color="blue" arrow="end" />
        <Line x={830} y={155} size={50} direction={90} strokeWidth={4} color="blue" arrow="end" />
        <Line x={948} y={155} size={50} direction={90} strokeWidth={4} color="blue" arrow="end" />
        <Line x={600} y={525} size={45} direction={90} strokeWidth={4} color="red" />
        <Line x={725} y={525} size={45} direction={90} strokeWidth={4} color="red" />
        <Line x={830} y={525} size={45} direction={90} strokeWidth={4} color="red" />
        <Line x={948} y={525} size={45} direction={90} strokeWidth={4} color="red" />

        <TitleCard 
        x={525} y={225} 
        width={150} height={300} 
        title="REF. RETENTION ROOM" 
        fontSize={16}
        color="#2C3E50"
        textColor="#ECF0F1"
        borderRadius={8}
        paddingTop={20}
        />
        <TitleCard 
        x={677} y={225} 
        width={100} height={300} 
        title="OFFICE ROOM" 
        fontSize={16}
        color="#2C3E50"
        textColor="#ECF0F1"
        borderRadius={8}
        paddingTop={20}
        />
        <TitleCard 
        x={779} y={225} 
        width={110} height={300} 
        title="PAL STABILITY ROOM" 
        fontSize={16}
        color="#2C3E50"
        textColor="#ECF0F1"
        borderRadius={8}
        paddingTop={20}
        />
        <TitleCard 
        x={890} y={225} 
        width={110} height={300} 
        title="PAL REF. RETENTION ROOM" 
        fontSize={16}
        color="#2C3E50"
        textColor="#ECF0F1"
        borderRadius={8}
        paddingTop={20}
        />

        <LabelComponent text="R. T-03 A" x={545} y={320} w={120} h={35} hasBorder={true} fontSize={13}/>
        <SensorIndicator 
        x={545} y={360} 
        w={120} h={35}
        value={0.0} unit=" °C" 
        warningThreshold={0} alarmThreshold={0} 
        thresholdDirection="above" 
        decimalPlaces={1}
        />
        <LabelComponent text="R. T-03 B" x={545} y={410} w={120} h={35} hasBorder={true} fontSize={13}/>
          <SensorIndicator 
        x={545} y={450} 
        w={120} h={35}
        value={0.0} unit=" °C" 
        warningThreshold={0} alarmThreshold={0} 
        thresholdDirection="above" 
        decimalPlaces={1}
        />

          <DashedLine x={135} y={462} w={20} h={0} />
          <DashedLine x={135} y={493} w={20} h={0} />
          <DashedLine x={155} y={155} w={0} h={339} />
          <DashedLine x={130} y={155} w={30} h={0} />

          <LabelComponent text="PF-03" x={20} y={450} w={110} h={25} hasBorder={true} fontSize={13}/>
         <SensorIndicator 
          x={20} y={480} 
          w={110} h={30}
          value={0.0} unit=" Pa" 
          warningThreshold={0} alarmThreshold={0} 
          thresholdDirection="above" 
          decimalPlaces={1}
          />

    </svg>
  );
}