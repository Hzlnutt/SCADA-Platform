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
import { SensorIndicator } from "../../../components/pid/SensorIndicator";
import PipeBend from "../../../components/pid/PipeBend";
import { PipeDefs } from "../../../components/pid/PipeDefs";
import { PipeH, PipeV } from "../../../components/pid/Pipe";
import DashedLine from "../../../components/pid/DashedLine";

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
        x={100}
        y={30}
        width={600}
        height={250}
      />

      <DuctSection
        x={18}
        y={70}
        width={80}
        height={80}
        direction="right"
        flowDirection="in"
        flangeWidth={24}
      />

      <DuctSection
        x={18}
        y={170}
        width={80}
        height={80}
        direction="right"
        flowDirection="in"
        flangeWidth={24}
      />

      <DuctSection
        x={700}
        y={115}
        width={80}
        height={80}
        direction="left"
        flowDirection="out"
        flangeWidth={24}
      />

      <PreFilter
        x={150}
        y={60}
        width={60}
        height={190}
        color="blue"
      />

      <Partition x={235} y={60} width={14} height={190} color="#606060" />
      <SupplyFan x={228} y={-10} w={350} h={350} running={running} />

      <ThermalUnit
        x={370}
        y={60}
        width={60}
        height={190}
        running={running}

      />

      <Partition x={440} y={60} width={14} height={190} color="#606060" />

      <HumidityFan x={440} y={80} width={250} height={150} running={running} />

      <DifferentialPressureSwitch
        x={800}
        y={100}
        width={60}
        height={80}
      />

      <Line x={0} y={110} size={120} direction={0} strokeWidth={4} color="red" arrow="end" />
      <Line x={0} y={210} size={120} direction={0} strokeWidth={4} color="red" arrow="end" />
      <Line x={2} y={210} size={360} direction={90} strokeWidth={4} color="red" />
      <Line x={0} y={570} size={780} direction={0} strokeWidth={4} color="red" />
      <Line x={660} y={155} size={220} direction={0} strokeWidth={4} color="blue" />
      <Line x={880} y={155} size={50} direction={90} strokeWidth={4} color="blue" arrow="end" />
      <Line x={640} y={540} size={28} direction={90} strokeWidth={4} color="red" />

      <TitleCard
        x={780} y={225}
        width={200} height={350}
        title="ACCELERATED STABILITY ROOM"
        fontSize={16}
        color="#2C3E50"
        textColor="#ECF0F1"
        borderRadius={8}
        paddingTop={20}
      />

      <LabelComponent text="R. THD-01 A" x={820} y={300} w={120} h={35} hasBorder={true} fontSize={13} />
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

      <LabelComponent text="R. THD-01 B" x={820} y={430} w={120} h={35} hasBorder={true} fontSize={13} />
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

      <LabelComponent text="R.A. THD-01" x={580} y={430} w={120} h={35} hasBorder={true} fontSize={13} />
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

      <LabelComponent text="DPS-01" x={795} y={165} w={65} h={25} hasBorder={true} fontSize={13} />

      <TitleCard
        x={580} y={300}
        width={120} height={60}
        title="FROM/TO UTILITY"
        fontSize={16}
        color="#2C3E50"
        textColor="#ECF0F1"
        borderRadius={8}
      />

      <PipeH x={510} y={340} w={69} h={6}
        on={true} dir="left" type="cold" />
      <PipeBend x={501} y={325} size={25} angle={0} />
      <PipeV x={503.5} y={221} w={6} h={105}
        on={true} dir="up" type="cold" />
      <PipeV x={529} y={221} w={6} h={90}
        on={true} dir="down" type="cold" />
      <PipeH x={550} y={315} w={29} h={6}
        on={true} dir="right" type="cold" />
      <PipeBend x={527} y={300} size={25} angle={0} />

      <LabelComponent text="HF-01" x={558} y={60} w={65} h={25} hasBorder={true} fontSize={13} />
      <SensorIndicator
        x={512}
        y={60}
        w={40}
        h={25}
        value={running} // true = ON (hijau), false = OFF (merah)
        mode="onoff"
      />

      <LabelComponent text="EH-01" x={416} y={300} w={65} h={25} hasBorder={true} fontSize={13} />
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

      <LabelComponent text="PF-01" x={147} y={240} w={65} h={25} hasBorder={true} fontSize={13} />

      <LabelComponent text="SF-01" x={185} y={300} w={65} h={25} hasBorder={true} fontSize={13} />
      <SensorIndicator
        x={140}
        y={300}
        w={40}
        h={25}
        value={running} // true = ON (hijau), false = OFF (merah)
        mode="onoff"
      />

      <SensorIndicator
        x={140} y={330}
        w={110} h={30}
        value={0.0} unit=" %"
        warningThreshold={0} alarmThreshold={0}
        thresholdDirection="above"
        decimalPlaces={1}
      />
      <SensorIndicator
        x={140} y={365}
        w={110} h={30}
        value={0.0} unit=" rpm"
        warningThreshold={0} alarmThreshold={0}
        thresholdDirection="above"
      />
      <SensorIndicator
        x={140} y={400}
        w={110} h={30}
        value={0.0} unit=" A"
        warningThreshold={0} alarmThreshold={0}
        thresholdDirection="above"
        decimalPlaces={1}
      />

      <DashedLine x={252} y={312} w={50} h={0} />
      <DashedLine x={252} y={345} w={50} h={0} />
      <DashedLine x={252} y={380} w={50} h={0} />
      <DashedLine x={252} y={415} w={50} h={0} />
      <DashedLine x={297} y={155} w={0} h={260} />

      <DashedLine x={350} y={155} w={20} h={0} />
      <DashedLine x={350} y={155} w={0} h={192} />
      <DashedLine x={350} y={347} w={20} h={0} />
      <DashedLine x={350} y={312} w={20} h={0} />

      <DashedLine x={120} y={462} w={20} h={0} />
      <DashedLine x={120} y={493} w={20} h={0} />
      <DashedLine x={115} y={155} w={0} h={339} />
      <DashedLine x={115} y={155} w={50} h={0} />

      <LabelComponent text="PF-01" x={140} y={450} w={110} h={25} hasBorder={true} fontSize={13} />
      <SensorIndicator
        x={140} y={480}
        w={110} h={30}
        value={0.0} unit=" Pa"
        warningThreshold={0} alarmThreshold={0}
        thresholdDirection="above"
        decimalPlaces={1}
      />
    </svg>
  );
}