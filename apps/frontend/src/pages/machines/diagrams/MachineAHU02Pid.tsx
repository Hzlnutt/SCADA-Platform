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
        width={600}
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
          x={650}
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

    <Partition x={160} y={60} width={14} height={190} color="#606060" />
    <SupplyFan x={157} y={-20} w={300} h={300} running={running} />
    <SupplyFan x={157} y={70} w={300} h={300} running={running} />
    <Partition x={250} y={60} width={14} height={190} color="#606060" />

    <ThermalUnit 
        x={274} 
        y={60} 
        width={60} 
        height={190} 
        running={running} 
        type="cooler"
        
      />
    <ThermalUnit 
        x={370} 
        y={60} 
        width={60} 
        height={190} 
        running={running} 
        type="heater"
        
      />

      <Partition x={440} y={60} width={14} height={190} color="#606060" />

      <HumidityFan x={420} y={55} width={250} height={100} running={running} />
      <HumidityFan x={420} y={150} width={250} height={100} running={running} />

      <DifferentialPressureSwitch
          x={800}
          y={100}
          width={60}
          height={80}
        />

        <Line x={0} y={110} size={60} direction={0} strokeWidth={4} color="red" arrow="end" />
        <Line x={0} y={210} size={60} direction={0} strokeWidth={4} color="red" arrow="end" />
        <Line x={2} y={210} size={360} direction={90} strokeWidth={4} color="red" />
        <Line x={0} y={570} size={780} direction={0} strokeWidth={4} color="red" />
        <Line x={620} y={155} size={262} direction={0} strokeWidth={4} color="blue" />
        <Line x={880} y={155} size={50} direction={90} strokeWidth={4} color="blue" arrow="end" />
        <Line x={640} y={540} size={28} direction={90} strokeWidth={4} color="red" />

        <TitleCard 
        x={780} y={225} 
        width={200} height={350} 
        title="LONG TERM STABILITY ROOM" 
        fontSize={16}
        color="#2C3E50"
        textColor="#ECF0F1"
        borderRadius={8}
        paddingTop={20}
        />

        <LabelComponent text="R. THD-02 A" x={820} y={300} w={120} h={35} hasBorder={true} fontSize={13}/>
        <SensorIndicator 
        x={820} y={340} 
        w={120} h={35}
        value={0.0} unit=" °C" 
        warningThreshold={0} alarmThreshold={0} 
        thresholdDirection="above" 
        decimalPlaces={1}
        />
        <SensorIndicator 
        x={820} y={380} 
        w={120} h={35}
        value={0.0} unit=" %RH" 
        warningThreshold={0} alarmThreshold={0} 
        thresholdDirection="above" 
        decimalPlaces={1}
        />

        <LabelComponent text="R. THD-02 B" x={820} y={430} w={120} h={35} hasBorder={true} fontSize={13}/>
          <SensorIndicator 
        x={820} y={470} 
        w={120} h={35}
        value={0.0} unit=" °C" 
        warningThreshold={0} alarmThreshold={0} 
        thresholdDirection="above" 
        decimalPlaces={1}
        />
        <SensorIndicator 
        x={820} y={510} 
        w={120} h={35}
        value={0.0} unit=" %RH" 
        warningThreshold={0} alarmThreshold={0} 
        thresholdDirection="above" 
        decimalPlaces={1}
        />

        <LabelComponent text="R.A. THD-02" x={580} y={430} w={120} h={35} hasBorder={true} fontSize={13}/>
          <SensorIndicator 
        x={580} y={470} 
        w={120} h={35}
        value={0.0} unit=" °C" 
        warningThreshold={0} alarmThreshold={0} 
        thresholdDirection="above" 
        decimalPlaces={1}
        />
        <SensorIndicator 
        x={580} y={510} 
        w={120} h={35}
        value={0.0} unit=" %RH" 
        warningThreshold={0} alarmThreshold={0} 
        thresholdDirection="above" 
        decimalPlaces={1}
        />

        <LabelComponent text="DPS-02" x={795} y={165} w={65} h={25} hasBorder={true} fontSize={13}/>

        <TitleCard 
        x={580} y={300} 
        width={120} height={60} 
        title="FROM/TO UTILITY" 
        fontSize={16}
        color="#2C3E50"
        textColor="#ECF0F1"
        borderRadius={8}
        />

        <PipeH x={525} y={340} w={54} h={6} 
        on={true} dir="left" type="cold" />
        <PipeBend x={501} y={325} size={25} angle={0} />
        <PipeV x={503} y={244} w={6} h={82} 
        on={true} dir="up" type="cold" />
        <PipeV x={520} y={244} w={6} h={59} 
        on={true} dir="down" type="cold" />
        <PipeH x={543} y={315} w={36} h={6} 
        on={true} dir="right" type="cold" />
        <PipeBend x={518} y={300} size={25} angle={0} />
        
        <LabelComponent text="HF-02" x={535} y={140} w={65} h={25} hasBorder={true} fontSize={13}/>
        <SensorIndicator
              x={490}
              y={140}
              w={40}
              h={25}
              value={running} // true = ON (hijau), false = OFF (merah)
              mode="onoff"
              />

        <LabelComponent text="EH-02" x={416} y={300} w={65} h={25} hasBorder={true} fontSize={13}/>
        <SensorIndicator
              x={370}
              y={300}
              w={40}
              h={25}
              value={running} // true = ON (hijau), false = OFF (merah)
              mode="onoff"
              />

         <SensorIndicator 
          x={370} y={330} 
          w={110} h={30}
          value={0.0} unit=" %" 
          warningThreshold={0} alarmThreshold={0} 
          thresholdDirection="above" 
          decimalPlaces={1}
          />

          <LabelComponent text="PF-02" x={88} y={240} w={65} h={25} hasBorder={true} fontSize={13}/>

        <LabelComponent text="SF-02 A" x={100} y={290} w={65} h={25} hasBorder={true} fontSize={13}/>
        <SensorIndicator
              x={55}
              y={290}
              w={40}
              h={25}
              value={running} // true = ON (hijau), false = OFF (merah)
              mode="onoff"
              />

         <SensorIndicator 
          x={55} y={320} 
          w={110} h={30}
          value={0.0} unit=" %" 
          warningThreshold={0} alarmThreshold={0} 
          thresholdDirection="above" 
          decimalPlaces={1}
          />
         <SensorIndicator 
          x={55} y={355} 
          w={110} h={30}
          value={0.0} unit=" rpm" 
          warningThreshold={0} alarmThreshold={0} 
          thresholdDirection="above" 
          />
         <SensorIndicator 
          x={55} y={390} 
          w={110} h={30}
          value={0.0} unit=" A" 
          warningThreshold={0} alarmThreshold={0} 
          thresholdDirection="above" 
          decimalPlaces={1}
          />

        <LabelComponent text="SF-02 B" x={100} y={430} w={65} h={25} hasBorder={true} fontSize={13}/>
        <SensorIndicator
              x={55}
              y={430}
              w={40}
              h={25}
              value={running} // true = ON (hijau), false = OFF (merah)
              mode="onoff"
              />

         <SensorIndicator 
          x={55} y={460} 
          w={110} h={30}
          value={0.0} unit=" %" 
          warningThreshold={0} alarmThreshold={0} 
          thresholdDirection="above" 
          decimalPlaces={1}
          />
         <SensorIndicator 
          x={55} y={495} 
          w={110} h={30}
          value={0.0} unit=" rpm" 
          warningThreshold={0} alarmThreshold={0} 
          thresholdDirection="above" 
          />
         <SensorIndicator 
          x={55} y={530} 
          w={110} h={30}
          value={0.0} unit=" A" 
          warningThreshold={0} alarmThreshold={0} 
          thresholdDirection="above" 
          decimalPlaces={1}
          />

          <DashedLine x={170} y={302} w={50} h={0} />
          <DashedLine x={170} y={335} w={50} h={0} />
          <DashedLine x={170} y={369} w={50} h={0} />
          <DashedLine x={170} y={405} w={50} h={0} />
          <DashedLine x={220} y={220} w={0} h={190} />

          <DashedLine x={170} y={442} w={70} h={0} />
          <DashedLine x={170} y={475} w={70} h={0} />
          <DashedLine x={170} y={509} w={70} h={0} />
          <DashedLine x={170} y={545} w={70} h={0} />
          <DashedLine x={240} y={110} w={0} h={440} />
          <DashedLine x={220} y={110} w={20} h={0} />

          <DashedLine x={350} y={155} w={20} h={0} />
          <DashedLine x={350} y={155} w={0} h={192} />
          <DashedLine x={350} y={347} w={20} h={0} />
          <DashedLine x={350} y={312} w={20} h={0} />

          <LabelComponent text="C/C" x={272} y={240} w={65} h={25} hasBorder={true} fontSize={13}/>

          
          
          <PipeBend x={334} y={80} size={25} angle={180} />
          <PipeBend x={250} y={230} size={25} angle={90} />
          <PipeBend x={250} y={465} size={25} angle={0} />
          <PipeBend x={422} y={465} size={25} angle={0} />
          <PipeBend x={260} y={440} size={25} angle={0} />
          <PipeBend x={432} y={440} size={25} angle={0} />

          <ACUnit x={1550} y={2800} w={200} h={75} running={running} />
          <ACUnit x={2700} y={2800} w={200} h={75} running={running} />

          <PipeV x={253} y={255} w={6} h={210} 
          on={true} dir="up" type="cold" />
          <PipeV x={350} y={104} w={6} h={295} 
          on={true} dir="down" type="cold" />
          <PipeV x={263} y={430} w={6} h={11} 
          on={true} dir="down" type="cold" />
          <PipeV x={434} y={428} w={6} h={13} 
          on={true} dir="down" type="cold" />
          <PipeV x={424} y={398} w={6} h={68} 
          on={true} dir="up" type="cold" />
          <PipeT x={256} y={380} armLength={13} thickness={8} direction="right" />
          <PipeT x={353} y={410} armLength={13} thickness={8} direction="up" />

          <PipeBend x={260} y={405} size={25} angle={90} />
          <PipeBend x={418} y={404} size={25} angle={180} />
          <PipeBend x={407} y={374} size={25} angle={180} />
          
          <PipeH x={285} y={407} w={55} h={6} 
          on={true} dir="left" type="cold" />
          <PipeH x={269} y={377} w={138} h={6} 
          on={true} dir="left" type="cold" />
          <PipeH x={366} y={407} w={52} h={6} 
          on={true} dir="right" type="cold" />

          <LabelComponent text="M" x={347} y={450} w={40} h={20} hasBorder={true} fontSize={13}/>
          <LabelComponent text="S" x={520} y={450} w={40} h={20} hasBorder={true} fontSize={13}/>

          <LabelComponent text="CU-02 A" x={320} y={505} w={65} h={25} hasBorder={true} fontSize={13}/>
        <SensorIndicator
              x={275}
              y={505}
              w={40}
              h={25}
              value={running} // true = ON (hijau), false = OFF (merah)
              mode="onoff"
              />
          <LabelComponent text="CU-02 B" x={495} y={505} w={65} h={25} hasBorder={true} fontSize={13}/>
        <SensorIndicator
              x={450}
              y={505}
              w={40}
              h={25}
              value={running} // true = ON (hijau), false = OFF (merah)
              mode="onoff"
              />
    </svg>
  );
}