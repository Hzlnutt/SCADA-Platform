import PreFilter from "../../../components/pid/PreFilter";
import AHUBox from "../../../components/pid/AHUBox";
import DuctSection from "../../../components/pid/DuctSection";
import Partition from "../../../components/pid/Partition";
import SupplyFan from "../../../components/pid/SupplyFan";
import ThermalUnit from "../../../components/pid/ThermalUnit";
import HumidityFan from "../../../components/pid/HumidityFan";
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
  data?: Record<string, any>;
}

export default function MachineAHU01Pid({
  tempSP = 46.8,
  humiditySP = 75.0,
  running = true,
  data = {},
}: PidProps) {
  const isConnected = data.Connected !== undefined ? Boolean(data.Connected) : true;
  const isSfRunning = isConnected && (data.xIND_RUN_SF01 !== undefined ? Boolean(data.xIND_RUN_SF01) : running);
  const isMachineRunning = isConnected && isSfRunning;

  // Extract live parameters without dummy numbers
  const rt1A = isMachineRunning && typeof data.ACT_RTx_1A === "number" ? data.ACT_RTx_1A : null;
  const rh1A = isMachineRunning && typeof data.ACT_RHx_1A === "number" ? data.ACT_RHx_1A : null;
  const rt1B = isMachineRunning && typeof data.ACT_RTx_1B === "number" ? data.ACT_RTx_1B : null;
  const rh1B = isMachineRunning && typeof data.ACT_RHx_1B === "number" ? data.ACT_RHx_1B : null;
  const rat1 = isMachineRunning && typeof data.ACT_RATx_1 === "number" ? data.ACT_RATx_1 : null;
  const rah1 = isMachineRunning && typeof data.ACT_RAHx_1 === "number" ? data.ACT_RAHx_1 : null;

  const sf01Running = isMachineRunning && (data.xIND_RUN_SF01 !== undefined ? Boolean(data.xIND_RUN_SF01) : isMachineRunning);
  const sf01Cap = isMachineRunning && typeof data.ACT_SF01_CAP === "number" ? data.ACT_SF01_CAP : null;
  const sf01Spd = isMachineRunning && typeof data.ACT_SF01_SPD === "number" ? data.ACT_SF01_SPD : null;
  const sf01Cur = isMachineRunning && typeof data.ACT_SF01_CUR === "number" ? data.ACT_SF01_CUR : null;

  const eh01Running = isMachineRunning && (data.xIND_RUN_EH01 !== undefined ? Boolean(data.xIND_RUN_EH01) : isMachineRunning);
  const eh01Cap = isMachineRunning && typeof data.ACT_EH01_CAP === "number" ? data.ACT_EH01_CAP : null;

  const hf01Running = isMachineRunning && (data.xIND_RUN_HF01 !== undefined ? Boolean(data.xIND_RUN_HF01) : isMachineRunning);
  const pf01Dp = isMachineRunning && typeof data.PF_01_DP === "number" ? data.PF_01_DP : (data.PF_01_DP ? Number(data.PF_01_DP) : null);

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
        x={50}
        y={70}
        width={50}
        height={80}
        direction="right"
        flowDirection="in"
        flangeWidth={24}
      />

      <DuctSection
        x={50}
        y={170}
        width={50}
        height={80}
        direction="right"
        flowDirection="in"
        flangeWidth={24}
      />

      <DuctSection
        x={700}
        y={115}
        width={50}
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

      <Partition x={250} y={60} width={14} height={190} color="#606060" />
      <Partition x={585} y={60} width={14} height={190} color="#606060" />

      <ThermalUnit
        x={360}
        y={60}
        width={60}
        height={190}
        running={isMachineRunning}
        type="heater"
      />

      <SupplyFan
        x={275}
        y={110}
        w={100}
        h={100}
        running={isMachineRunning}
      />

      <ThermalUnit
        x={475}
        y={60}
        width={60}
        height={190}
        running={isMachineRunning}
        type="cooler"
      />

      <HumidityFan
        x={610}
        y={110}
        width={100}
        height={100}
        running={isMachineRunning}
      />

      <DifferentialPressureSwitch x={720} y={150} width={80} height={60} />

      <Line x={0} y={110} size={100} direction={0} strokeWidth={4} color="red" arrow="end" />
      <Line x={0} y={210} size={100} direction={0} strokeWidth={4} color="red" arrow="end" />
      <Line x={0} y={210} size={360} direction={90} strokeWidth={4} color="red" />
      <Line x={0} y={570} size={700} direction={0} strokeWidth={4} color="red" />
      <Line x={680} y={155} size={300} direction={0} strokeWidth={4} color="blue" />
      <Line x={790} y={155} size={50} direction={90} strokeWidth={4} color="blue" arrow="end" />
      <Line x={930} y={155} size={50} direction={90} strokeWidth={4} color="blue" arrow="end" />
      <Line x={790} y={525} size={45} direction={90} strokeWidth={4} color="red" />
      <Line x={930} y={525} size={45} direction={90} strokeWidth={4} color="red" />

      <TitleCard
        x={730} y={225}
        width={120} height={300}
        title="ACC. RETENTION ROOM"
        fontSize={16}
        color="#2C3E50"
        textColor="#ECF0F1"
        borderRadius={8}
        paddingTop={20}
      />

      <TitleCard
        x={870} y={225}
        width={120} height={300}
        title="ACC. STABILITY ROOM"
        fontSize={16}
        color="#2C3E50"
        textColor="#ECF0F1"
        borderRadius={8}
        paddingTop={20}
      />

      {/* R. THD-01 A */}
      <LabelComponent text="R. THD-01 A" x={700} y={430} w={120} h={35} hasBorder={true} fontSize={13} />
      <SensorIndicator
        x={700} y={470}
        w={120} h={35}
        value={rt1A} unit=" °C"
        warningThreshold={42} alarmThreshold={44}
        thresholdDirection="above"
        decimalPlaces={1}
        isStopped={!isMachineRunning}
      />
      <SensorIndicator
        x={700} y={510}
        w={120} h={35}
        value={rh1A} unit=" %RH"
        warningThreshold={80} alarmThreshold={85}
        thresholdDirection="above"
        decimalPlaces={1}
        isStopped={!isMachineRunning}
      />

      {/* R. THD-01 B */}
      <LabelComponent text="R. THD-01 B" x={840} y={430} w={120} h={35} hasBorder={true} fontSize={13} />
      <SensorIndicator
        x={840} y={470}
        w={120} h={35}
        value={rt1B} unit=" °C"
        warningThreshold={42} alarmThreshold={44}
        thresholdDirection="above"
        decimalPlaces={1}
        isStopped={!isMachineRunning}
      />
      <SensorIndicator
        x={840} y={510}
        w={120} h={35}
        value={rh1B} unit=" %RH"
        warningThreshold={80} alarmThreshold={85}
        thresholdDirection="above"
        decimalPlaces={1}
        isStopped={!isMachineRunning}
      />

      {/* R.A. THD-01 */}
      <LabelComponent text="R.A. THD-01" x={570} y={430} w={120} h={35} hasBorder={true} fontSize={13} />
      <SensorIndicator
        x={570} y={470}
        w={120} h={35}
        value={rat1} unit=" °C"
        warningThreshold={42} alarmThreshold={44}
        thresholdDirection="above"
        decimalPlaces={1}
        isStopped={!isMachineRunning}
      />
      <SensorIndicator
        x={570} y={510}
        w={120} h={35}
        value={rah1} unit=" %RH"
        warningThreshold={80} alarmThreshold={85}
        thresholdDirection="above"
        decimalPlaces={1}
        isStopped={!isMachineRunning}
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
        on={isMachineRunning} dir="left" type="cold"/>
      <PipeBend x={501} y={325} size={25} angle={0} />
      <PipeV x={503.5} y={221} w={6} h={105}
        on={isMachineRunning} dir="up" type="cold" />
      <PipeV x={529} y={221} w={6} h={90}
        on={isMachineRunning} dir="down" type="cold" />
      <PipeH x={550} y={315} w={29} h={6}
        on={isMachineRunning} dir="right" type="cold" />
      <PipeBend x={527} y={300} size={25} angle={0} />

      {/* HF-01 */}
      <LabelComponent text="HF-01" x={558} y={60} w={65} h={25} hasBorder={true} fontSize={13} />
      <SensorIndicator
        x={512}
        y={60}
        w={40}
        h={25}
        value={isMachineRunning ? hf01Running : false}
        mode="onoff"
        isStopped={!isMachineRunning}
      />

      {/* EH-01 */}
      <LabelComponent text="EH-01" x={416} y={300} w={65} h={25} hasBorder={true} fontSize={13} />
      <SensorIndicator
        x={370}
        y={300}
        w={40}
        h={25}
        value={isMachineRunning ? eh01Running : false}
        mode="onoff"
        isStopped={!isMachineRunning}
      />
      <SensorIndicator
        x={370} y={330}
        w={110} h={30}
        value={eh01Cap} unit=" %"
        warningThreshold={100} alarmThreshold={100}
        thresholdDirection="above"
        decimalPlaces={1}
        isStopped={!isMachineRunning}
      />

      <LabelComponent text="PF-01" x={147} y={240} w={65} h={25} hasBorder={true} fontSize={13} />

      {/* SF-01 */}
      <LabelComponent text="SF-01" x={185} y={300} w={65} h={25} hasBorder={true} fontSize={13} />
      <SensorIndicator
        x={140}
        y={300}
        w={40}
        h={25}
        value={isMachineRunning ? sf01Running : false}
        mode="onoff"
        isStopped={!isMachineRunning}
      />
      <SensorIndicator
        x={140} y={330}
        w={110} h={30}
        value={sf01Cap} unit=" %"
        warningThreshold={100} alarmThreshold={100}
        thresholdDirection="above"
        decimalPlaces={1}
        isStopped={!isMachineRunning}
      />
      <SensorIndicator
        x={140} y={365}
        w={110} h={30}
        value={sf01Spd} unit=" rpm"
        warningThreshold={2000} alarmThreshold={2200}
        thresholdDirection="above"
        decimalPlaces={0}
        isStopped={!isMachineRunning}
      />
      <SensorIndicator
        x={140} y={400}
        w={110} h={30}
        value={sf01Cur} unit=" A"
        warningThreshold={5} alarmThreshold={8}
        thresholdDirection="above"
        decimalPlaces={2}
        isStopped={!isMachineRunning}
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
        value={pf01Dp} unit=" Pa"
        warningThreshold={250} alarmThreshold={300}
        thresholdDirection="above"
        decimalPlaces={1}
        isStopped={!isMachineRunning}
      />
    </svg>
  );
}