import { useMemo } from "react";
import { PipeDefs } from "../../../components/pid/PipeDefs";
import { PipeH, PipeV } from "../../../components/pid/Pipe";
import { SensorIndicator } from "../../../components/pid/SensorIndicator";
import LabelComponent from "../../../components/pid/TextLabel";
import { LevelIndicator } from "../../../components/pid/LevelIndicator";
import { TankFrame } from "../../../components/pid/TankFrame";
import PipeBend from "../../../components/pid/PipeBend";
import { HeaderPipe } from "../../../components/pid/HeaderPipe";
import { YStrainer } from "../../../components/pid/YStrainerPipe";
import ChemicalDosingTank from "../../../components/pid/ChemicalDosingTank";
import PipeGauge from "../../../components/pid/PipeGauge";
import VerticalValve from "../../../components/pid/VerticalValve";
import PumpMotor from "../../../components/pid/PumpMotor";
import CoolingTower from "../../../components/pid/CoolingTower";
import InfoCard from "../../../components/pid/InfoCard";
import SensorCard from "../../../components/pid/SensorCard";
import DashedLine from "../../../components/pid/DashedLine";
import { useTelemetryStore } from "../../../store/telemetry.store";
import { getDefaultEqConfigs } from "../../../data/equipment";


interface CoolingWF1U3PidProps {
  motorStatus: Record<string, boolean>;
  runningHours?: Record<string, number>;
  pidThresholds?: any;
  svgRef?: React.RefObject<SVGSVGElement>;
  onSvgClick?: (e: React.MouseEvent<SVGSVGElement>) => void;
}

export default function CoolingWF1U3Pid({
  motorStatus: rawMotorStatus,
  runningHours = {},
  pidThresholds,
  svgRef,
  onSvgClick,
}: CoolingWF1U3PidProps) {
  const latest = useTelemetryStore((state) => state.latest);

  // Keep a boolean proxy for pipes, motor icons, and cooling towers
  const motorStatus = new Proxy(rawMotorStatus, {
    get: (target, prop: string) => {
      return target[prop] === true;
    }
  }) as Record<string, boolean>;

  // Helper to extract numerical telemetry values or display custom offline indicator
  const getVal = (tagId: string, unit = "") => {
    const pt = latest[tagId];
    if (!pt || pt.value === undefined) return "XX";
    return pt.value;
  };

  const getLvl = (tagId: string) => {
    const pt = latest[tagId];
    if (!pt || typeof pt.value !== "number") return 0;
    return pt.value;
  };

  const supplyVal = latest["cooling-water/supply_temp"]?.value;
  const returnVal = latest["cooling-water/return_temp"]?.value;
  const deltaTVal = typeof supplyVal === "number" && typeof returnVal === "number"
    ? Number((returnVal - supplyVal).toFixed(2))
    : "XX";

  const getStProcessStatus = () => {
    const val = latest["cooling-water/eq_status_st03"]?.value;
    if (val === undefined || val === null || val === "XX") return "XX";
    if (val === 2 || val === "2" || String(val).toUpperCase() === "STANDBY") return "STANDBY";
    if (val === 1 || val === true || String(val).toUpperCase() === "ON" || val === "1") return "ON";
    return "OFF";
  };

  const getChem357Lvl = () => {
    const val = latest["cooling-water/chemical_357_lvl"]?.value;
    if (val === undefined || val === null || val === "XX") return 0;
    return typeof val === "number" ? val : parseFloat(String(val)) || 0;
  };

  const getChem327Lvl = () => {
    const val = latest["cooling-water/chemical_327_lvl"]?.value;
    if (val === undefined || val === null || val === "XX") return 0;
    return typeof val === "number" ? val : parseFloat(String(val)) || 0;
  };

  const getEqThresholds = (tagKey: string, fallbackUnitId: string) => {
    const saved = localStorage.getItem(`scada.config.eq.${fallbackUnitId}`);
    if (saved) {
      try {
        const list = JSON.parse(saved);
        const item = list.find((x: any) => x.tagKey === tagKey);
        if (item) {
          return { warning: item.baseline, alarm: item.highLimit };
        }
      } catch (e) {
        // ignore
      }
    }
    const defaults = getDefaultEqConfigs(fallbackUnitId);
    const item = defaults.find((x: any) => x.tagKey === tagKey);
    return item ? { warning: item.baseline, alarm: item.highLimit } : { warning: 5000, alarm: 10000 };
  };

  const getRhConfig = (motorId: string) => {
    switch (motorId) {
      case "MTR-1": return getEqThresholds("M1_PUMP_MOTOR_OVERHAUL", "cooling-water-1");
      case "MTR-2": return getEqThresholds("M2_SUPPLY_MOTOR_OVERHAUL", "cooling-water-1");
      case "MTR-3": return getEqThresholds("M3_SUPPLY_MOTOR_OVERHAUL", "cooling-water-1");
      case "MTR-4": return getEqThresholds("M4_PUMP_MOTOR_OVERHAUL", "cooling-water-2");
      case "MTR-5": return getEqThresholds("M5_SUPPLY_MOTOR_OVERHAUL", "cooling-water-2");
      case "MTR-6": return getEqThresholds("M6_SUPPLY_MOTOR_OVERHAUL", "cooling-water-2");
      case "MTR-7": return getEqThresholds("M7_PUMP_MOTOR_OVERHAUL", "cooling-water-3");
      case "MTR-8": return getEqThresholds("M8_SUPPLY_MOTOR_OVERHAUL", "cooling-water-3");
      case "MTR-9": return getEqThresholds("M9_SUPPLY_MOTOR_OVERHAUL", "cooling-water-3");
      case "FAN-1": return getEqThresholds("F1_MOTOR_OVERHAUL", "cooling-water-1");
      case "FAN-2": return getEqThresholds("F2_MOTOR_OVERHAUL", "cooling-water-2");
      case "FAN-3": return getEqThresholds("F3_MOTOR_OVERHAUL", "cooling-water-3");
      default: return { warning: 5000, alarm: 10000 };
    }
  };

  const getRh = (tagId: string) => {
    const val = runningHours[tagId];
    if (val === undefined || val === null) return "XX";
    return val.toFixed(1);
  };


  const dashedLines = useMemo(() => (
    <>
      <DashedLine x={95} y={430} w={0} h={300} />
      <DashedLine x={95} y={430} w={50} h={0} />

      <DashedLine x={260} y={430} w={0} h={300} />
      <DashedLine x={260} y={430} w={100} h={0} />

      <DashedLine x={430} y={430} w={0} h={300} />
      <DashedLine x={430} y={430} w={140} h={0} />

      <DashedLine x={637} y={650} w={0} h={30} />

      <DashedLine x={782} y={650} w={0} h={30} />
      <DashedLine x={782} y={650} w={100} h={0} />
      <DashedLine x={882} y={580} w={0} h={70} />

      <DashedLine x={965} y={760} w={0} h={30} />
      <DashedLine x={1126} y={760} w={0} h={30} />

      <DashedLine x={1265} y={428} w={0} h={153} />
      <DashedLine x={1240} y={428} w={30} h={0} />

      <DashedLine x={1438} y={500} w={0} h={80} />
      <DashedLine x={1370} y={500} w={70} h={0} />
      <DashedLine x={1370} y={428} w={0} h={73} />
      <DashedLine x={1340} y={428} w={30} h={0} />

      <DashedLine x={1613} y={500} w={0} h={80} />
      <DashedLine x={1480} y={500} w={134} h={0} />
      <DashedLine x={1480} y={428} w={0} h={73} />
      <DashedLine x={1450} y={428} w={30} h={0} />

      <DashedLine x={1387} y={745} w={0} h={30} />
      <DashedLine x={1387} y={745} w={200} h={0} />
      <DashedLine x={1582} y={428} w={0} h={320} />
      <DashedLine x={1555} y={428} w={30} h={0} />

      <DashedLine x={1600} y={745} w={0} h={30} />
      <DashedLine x={1600} y={745} w={130} h={0} />
      <DashedLine x={1725} y={500} w={0} h={245} />
      <DashedLine x={1660} y={428} w={30} h={0} />
      <DashedLine x={1690} y={500} w={35} h={0} />
      <DashedLine x={1687} y={430} w={0} h={70} />

      <DashedLine x={1800} y={430} w={0} h={340} />
      <DashedLine x={1770} y={430} w={30} h={0} />
    </>
  ), []);


  return (
    <svg
      ref={svgRef}
      className="absolute inset-0 h-full w-full"
      viewBox="0 -160 1836 1110"
      preserveAspectRatio="xMidYMid meet"
      style={{ pointerEvents: "auto" }}
      onClick={onSvgClick}
    >
      <PipeDefs />

      {/* Dashed Line */}
      {dashedLines}

              {/* ── PIPE ─────────────────────────────────────────────────── */}

              {/* Pipe Tank to Right Header */}
              <PipeH x={961} y={544} w={205} h={6} 
                on={motorStatus["MTR-4"] || motorStatus["MTR-5"] || motorStatus["MTR-6"] || motorStatus["MTR-7"] || motorStatus["MTR-8"] || motorStatus["MTR-9"]} />

              {/* Pipe Tank to Left Header */}
              <PipeH x={443} y={544} w={260} h={6} 
                on={motorStatus["MTR-1"] || motorStatus["MTR-2"]} dir="left" type="warm" />

              {/* Pipe Tank to CT-3 */}
              <PipeH x={590} y={529} w={114} h={6} 
                on={motorStatus["MTR-3"]} dir="left" type="warm" />
              <PipeV x={583} y={146} w={7} h={370} 
                on={motorStatus["MTR-3"]} dir="up" type="warm" />
              <PipeBend x={581.5} y={514} size={25} angle={0} />

              {/* Pipe Left Header to CT-1 and CT-2 */}
              <PipeV x={364} y={146} w={7} h={382} 
                on={motorStatus["MTR-2"]} dir="up" type="warm" />
              <PipeV x={151} y={146} w={7} h={382} 
                on={motorStatus["MTR-1"]} dir="up" type="warm" />

              {/* Pipe  Right Header to Area */}
              <PipeV x={1210} y={249} w={7} h={280} 
                on={motorStatus["MTR-4"]} dir="up" />
              <PipeV x={1316} y={249} w={7} h={280} 
                on={motorStatus["MTR-5"]} dir="up" />
              <PipeV x={1422} y={249} w={7} h={280} 
                on={motorStatus["MTR-6"]} dir="up" />
              <PipeV x={1527} y={249} w={7} h={280} 
                on={motorStatus["MTR-7"]} dir="up" />
              <PipeV x={1632} y={249} w={7} h={280} 
                on={motorStatus["MTR-8"]} dir="up" />
              <PipeV x={1738} y={249} w={7} h={280} 
                on={motorStatus["MTR-9"]} dir="up" />

              {/* Pipe Makeup Water to Tank */}
              <PipeH x={940} y={336} w={70} h={6} 
                on={motorStatus["MTR-3"]} dir="left" type="cold" />
              <PipeV x={923} y={358} w={7} h={48} 
                on={motorStatus["MTR-9"]} dir="down" />
              <PipeBend x={921} y={334} size={25} angle={90} />

              {/* Pipe Area to Tank*/}
              <PipeV x={1210} y={166} w={7} h={30} 
                on={motorStatus["MTR-4"]} dir="up" type="return" />
              <PipeH x={820} y={145} w={377} h={6} 
                on={motorStatus["MTR-4"]} dir="left" type="return" />
              <PipeV x={800} y={168} w={7} h={238} 
                on={motorStatus["MTR-4"]} dir="down" type="return" />
              <PipeBend x={1195} y={143} size={25} angle={180} />
              <PipeBend x={798} y={143} size={25} angle={90} />

              <PipeV x={1314} y={153} w={7} h={45} 
                on={motorStatus["MTR-5"]} dir="up" type="return" />
              <PipeH x={810} y={133} w={488} h={6} 
                on={motorStatus["MTR-5"]} dir="left" type="return" />
              <PipeV x={788} y={156} w={7} h={250} 
                on={motorStatus["MTR-5"]} dir="down" type="return" />
              <PipeBend x={1298} y={130} size={25} angle={180} />
              <PipeBend x={786} y={131} size={25} angle={90} />

              <PipeV x={1422} y={141} w={7} h={57} 
                on={motorStatus["MTR-6"]} dir="up" type="return" />
              <PipeH x={795} y={121} w={615} h={6} 
                on={motorStatus["MTR-6"]} dir="left" type="return" />
              <PipeV x={776} y={144} w={7} h={262} 
                on={motorStatus["MTR-6"]} dir="down" type="return" />
              <PipeBend x={1406} y={118} size={25} angle={180} />
              <PipeBend x={774} y={119} size={25} angle={90} />

              <PipeV x={1527} y={129} w={7} h={69} 
                on={motorStatus["MTR-7"]} dir="up" type="return" />
              <PipeH x={783} y={109} w={730} h={6} 
                on={motorStatus["MTR-7"]} dir="left" type="return" />
              <PipeV x={764} y={132} w={7} h={274} 
                on={motorStatus["MTR-7"]} dir="down" type="return" />
              <PipeBend x={1511} y={106} size={25} angle={180} />
              <PipeBend x={762} y={107} size={25} angle={90} />

              <PipeV x={1632} y={117} w={7} h={81} 
                on={motorStatus["MTR-8"]} dir="up" type="return" />
              <PipeH x={771} y={97} w={850} h={6} 
                on={motorStatus["MTR-8"]} dir="left" type="return" />
              <PipeV x={752} y={120} w={7} h={286} 
                on={motorStatus["MTR-8"]} dir="down" type="return" />
              <PipeBend x={1616} y={94} size={25} angle={180} />
              <PipeBend x={750} y={95} size={25} angle={90} />

              <PipeV x={1738} y={105} w={7} h={93} 
                on={motorStatus["MTR-9"]} dir="up" type="return" />
              <PipeH x={759} y={85} w={965} h={6} 
                on={motorStatus["MTR-9"]} dir="left" type="return" />
              <PipeV x={740} y={108} w={7} h={298} 
                on={motorStatus["MTR-9"]} dir="down" type="return" />
              <PipeBend x={1722} y={82} size={25} angle={180} />
              <PipeBend x={738} y={83} size={25} angle={90} />


              {/* Pipe FAN-1 to Tank */}
              <PipeV x={180} y={146} w={7} h={65} 
                on={motorStatus["FAN-1"]} dir="down" />
              <PipeH x={203} y={225} w={631} h={6} 
                on={motorStatus["FAN-1"]} dir="right" type="cold" />
              <PipeV x={849} y={245} w={7} h={162} 
                on={motorStatus["FAN-1"]} dir="down" />
              <PipeBend x={179} y={210} size={25} angle={0} />
              <PipeBend x={833} y={222} size={25} angle={180} />

              {/* Pipe FAN-2 to Tank */}
              <PipeV x={395} y={146} w={7} h={53} 
                on={motorStatus["FAN-2"]} dir="down" />
              <PipeH x={418} y={212} w={432} h={6} 
                on={motorStatus["FAN-2"]} dir="right" type="cold" />
              <PipeV x={865} y={232} w={7} h={175} 
                on={motorStatus["FAN-2"]} dir="down" />
              <PipeBend x={394} y={197} size={25} angle={0} />
              <PipeBend x={849} y={209} size={25} angle={180} />

              {/* Pipe FAN-3 to Tank */}
              <PipeV x={617} y={146} w={7} h={40} 
                on={motorStatus["FAN-3"]} dir="down" />
              <PipeH x={640} y={199} w={225} h={6} 
                on={motorStatus["FAN-3"]} dir="right" type="cold" />
              <PipeV x={880} y={220} w={7} h={186} 
                on={motorStatus["FAN-3"]} dir="down" />
              <PipeBend x={616} y={184} size={25} angle={0} />
              <PipeBend x={865} y={197} size={25} angle={180} />

              {/* Pipe Tank to Blowdown */}
              <PipeV x={767} y={578} w={7} h={42.5} 
                on={motorStatus["FAN-3"]} dir="down" type="warm" />
              <PipeH x={435} y={636} w={320} h={6} 
                on={motorStatus["FAN-3"]} dir="left" type="warm" />
              <PipeBend x={752} y={620} size={25} angle={270} />
              <LabelComponent text="Jalur Limbah Industri" x={270} y={615} w={165} h={50} hasBorder={true} fontSize={13}/>

              {/* Pipe Dosing to Tank */}
              <PipeV x={892} y={575} w={7} h={33} 
                on={motorStatus["FAN-3"]} dir="up" />
              <PipeV x={961} y={640} w={7} h={24} 
                on={motorStatus["FAN-3"]} dir="up" />
              <PipeH x={916} y={621} w={32} h={7} 
                on={motorStatus["FAN-3"]} dir="left" />
              <PipeBend x={892} y={607} size={25} angle={0} />
              <PipeBend x={946} y={619} size={25} angle={180} />

              <PipeV x={912} y={575} w={7} h={20} 
                on={motorStatus["FAN-3"]} dir="up" />
              <PipeV x={1123} y={630} w={7} h={34} 
                on={motorStatus["FAN-3"]} dir="up" />
              <PipeH x={935} y={609} w={175} h={7} 
                on={motorStatus["FAN-3"]} dir="left" />
              <PipeBend x={911} y={594} size={25} angle={0} />
              <PipeBend x={1107} y={607} size={25} angle={180} />

              {/* Header Pipe */}
              <HeaderPipe x={89} y={525} w={350} h={45} /> 
              <HeaderPipe x={1167} y={525} w={620} h={45} /> 

              {/* ── TANK ────────────────────────────────────────────────── */}
              <TankFrame x={708} y={410} w={120} h={163} label="" />
              <TankFrame x={837} y={410} w={120} h={163} label="" />

              <LevelIndicator x={714} y={416} value={getLvl("cooling-water/basin_lvl")} w={108} h={151} type="warm" />
              <LevelIndicator x={843} y={416} value={getLvl("cooling-water/basin_lvl")} w={108} h={151} type="cold" />

              <SensorIndicator 
                x={860} y={492} 
                w={75} h={30}
                value={getVal("cooling-water/basin_lvl")} unit=" %" 
                warningThreshold={pidThresholds?.basin_lvl?.warning ?? 75} 
                alarmThreshold={pidThresholds?.basin_lvl?.alarm ?? 70} 
                thresholdDirection="below" 
              />
              <SensorIndicator 
                x={860} y={530} 
                w={75} h={30}
                value={getVal("cooling-water/supply_temp")} unit=" °C" 
                warningThreshold={pidThresholds?.supply_temp?.warning ?? 28} 
                alarmThreshold={pidThresholds?.supply_temp?.alarm ?? 30} 
                decimalPlaces={1}
                thresholdDirection="above" 
              />
              <SensorIndicator 
                x={731} y={530} 
                w={75} h={30}
                value={getVal("cooling-water/return_temp")} unit=" °C" 
                warningThreshold={pidThresholds?.return_temp?.warning ?? 38} 
                alarmThreshold={pidThresholds?.return_temp?.alarm ?? 40} 
                decimalPlaces={1}
                thresholdDirection="above" 
              />

              {/* Sensor Indicator Pipe MTR-1 to MTR-9 */}
              <SensorIndicator 
                x={118} y={273} 
                w={75} h={30}
                value={getVal("cooling-water/pressure_1")} unit=" BAR" 
                warningThreshold={pidThresholds?.pressure?.warning ?? 1.5} 
                alarmThreshold={pidThresholds?.pressure?.alarm ?? 2.0}
                decimalPlaces={1}
                thresholdDirection="above" 
              />
              <SensorIndicator 
                x={333} y={273} 
                w={75} h={30}
                value={getVal("cooling-water/pressure_2")} unit=" BAR" 
                warningThreshold={pidThresholds?.pressure?.warning ?? 1.5} 
                alarmThreshold={pidThresholds?.pressure?.alarm ?? 2.0}
                decimalPlaces={1}
                thresholdDirection="above" 
              />
              <SensorIndicator 
                x={552} y={273} 
                w={75} h={30}
                value={getVal("cooling-water/pressure_3")} unit=" BAR" 
                warningThreshold={pidThresholds?.pressure?.warning ?? 1.5} 
                alarmThreshold={pidThresholds?.pressure?.alarm ?? 2.0}
                decimalPlaces={1}
                thresholdDirection="above" 
              />
              <SensorIndicator 
                x={1177} y={273} 
                w={75} h={30}
                value={getVal("cooling-water/eq_press_du03")} unit=" BAR" 
                warningThreshold={pidThresholds?.pressure?.warning ?? 1.5} 
                alarmThreshold={pidThresholds?.pressure?.alarm ?? 2.0}
                decimalPlaces={1}
                thresholdDirection="above" 
              />
              <SensorIndicator 
                x={1282} y={273} 
                w={75} h={30}
                value={getVal("cooling-water/eq_press_bp03")} unit=" BAR" 
                warningThreshold={pidThresholds?.pressure?.warning ?? 1.5} 
                alarmThreshold={pidThresholds?.pressure?.alarm ?? 2.0}
                decimalPlaces={1}
                thresholdDirection="above" 
              />
              <SensorIndicator 
                x={1390} y={273} 
                w={75} h={30}
                value={getVal("cooling-water/eq_press_prep03")} unit=" BAR" 
                warningThreshold={pidThresholds?.pressure?.warning ?? 1.5} 
                alarmThreshold={pidThresholds?.pressure?.alarm ?? 2.0}
                decimalPlaces={1}
                thresholdDirection="above" 
              />
              <SensorIndicator 
                x={1495} y={273} 
                w={75} h={30}
                value={getVal("cooling-water/eq_press_st03")} unit=" BAR" 
                warningThreshold={pidThresholds?.pressure?.warning ?? 1.5} 
                alarmThreshold={pidThresholds?.pressure?.alarm ?? 2.0}
                decimalPlaces={1}
                thresholdDirection="above" 
              />
              <SensorIndicator 
                x={1599} y={273} 
                w={75} h={30}
                value={getVal("cooling-water/eq_press_washing")} unit=" BAR" 
                warningThreshold={pidThresholds?.pressure?.warning ?? 1.5} 
                alarmThreshold={pidThresholds?.pressure?.alarm ?? 2.0}
                decimalPlaces={1}
                thresholdDirection="above" 
              />
              <SensorIndicator 
                x={1705} y={273} 
                w={75} h={30}
                value={getVal("cooling-water/eq_press_minilab")} unit=" BAR" 
                warningThreshold={pidThresholds?.pressure?.warning ?? 1.5} 
                alarmThreshold={pidThresholds?.pressure?.alarm ?? 2.0}
                decimalPlaces={1}
                thresholdDirection="above" 
              />

              <SensorIndicator 
                x={1496} y={147} 
                w={75} h={30}
                value={getVal("cooling-water/st3_return_temp")} unit=" °C" 
                warningThreshold={pidThresholds?.st3_return_temp?.warning ?? 35} 
                alarmThreshold={pidThresholds?.st3_return_temp?.alarm ?? 40}
                decimalPlaces={1}
                thresholdDirection="above" 
              />

              {/* Chemical Dosing Tank */}
              <ChemicalDosingTank x={932}  y={685} width={67} height={65} id="tankA" />
              <ChemicalDosingTank x={1094}  y={685} width={67} height={65} id="tankB" />

              <LevelIndicator x={940} y={700} value={getChem357Lvl()} w={51} h={51} type="cold" />
              <LevelIndicator x={1102} y={700} value={getChem327Lvl()} w={51} h={51} type="cold" />

              {/* Gauge */}
              <PipeGauge x={946} y={287} size={60} />
              <PipeGauge x={608} y={587} size={60} />

              {/* Valve */}
              <VerticalValve x={130} y={319} size={50} angle={0} />
              <VerticalValve x={343} y={319} size={50} angle={0} />
              <VerticalValve x={562} y={319} size={50} angle={0} />
              <VerticalValve x={1189} y={319} size={50} angle={0} />
              <VerticalValve x={1295} y={319} size={50} angle={0} />
              <VerticalValve x={1401} y={319} size={50} angle={0} />
              <VerticalValve x={1506} y={319} size={50} angle={0} />
              <VerticalValve x={1611} y={319} size={50} angle={0} />
              <VerticalValve x={1717} y={319} size={50} angle={0} />

              {/* Y-Strainer Pipe */}
              <YStrainer x={148} y={478} size={15} />
              <YStrainer x={361} y={478} size={15} />
              <YStrainer x={580} y={478} size={15} />
              <YStrainer x={1207} y={478} size={15} />
              <YStrainer x={1313} y={478} size={15} />
              <YStrainer x={1419} y={478} size={15} />
              <YStrainer x={1524} y={478} size={15} />
              <YStrainer x={1629} y={478} size={15} />
              <YStrainer x={1735} y={478} size={15} />

              {/* Pump MTR */}
              <PumpMotor x={105} y={370} size={100} on={motorStatus["MTR-1"]} />
              <PumpMotor x={318} y={370} size={100} on={motorStatus["MTR-2"]} />
              <PumpMotor x={537} y={370} size={100} on={motorStatus["MTR-3"]} />
              <PumpMotor x={1164} y={370} size={100} on={motorStatus["MTR-4"]} />
              <PumpMotor x={1270} y={370} size={100} on={motorStatus["MTR-5"]} />
              <PumpMotor x={1376} y={370} size={100} on={motorStatus["MTR-6"]} />
              <PumpMotor x={1481} y={370} size={100} on={motorStatus["MTR-7"]} />
              <PumpMotor x={1586} y={370} size={100} on={motorStatus["MTR-8"]} />
              <PumpMotor x={1692} y={370} size={100} on={motorStatus["MTR-9"]} />

              {/* Cooling Tower */}
              <CoolingTower x={55} y={-12} size={200} on={motorStatus["FAN-1"]} />
              <CoolingTower x={269} y={-12} size={200} on={motorStatus["FAN-2"]} />
              <CoolingTower x={487} y={-12} size={200} on={motorStatus["FAN-3"]} />

              {/* Info Card */}

              {/* MTR 1 */}
              <InfoCard
              x={12}
              y={730}
              width={165}
              height={180}
              title="MTR-1"
              lines={["STATUS :", "RH :", "HZ :", "KW :"]}
                />
              <SensorIndicator
              x={108}
              y={784}
              w={63.75}
              h={25.5}
              value={rawMotorStatus["MTR-1"]} // true = ON (hijau), false = OFF (merah)
              mode="onoff"
              />
              <SensorIndicator
              x={70}
              y={812}
              w={63.75}
              h={25.5}
              value={getRh("cooling-water/motor_status_1")}
              unit=" h"
              warningThreshold={getRhConfig("MTR-1").warning}
              alarmThreshold={getRhConfig("MTR-1").alarm}
              thresholdDirection="above"
              />
              <SensorIndicator
              x={70}
              y={840}
              w={63.75}
              h={25.5}
              value="XX"
              unit=""
              />
              <SensorIndicator
              x={70}
              y={868}
              w={63.75}
              h={25.5}
              value="XX"
              unit=""
              />

              {/* MTR 2 */}
              <InfoCard
              x={180}
              y={730}
              width={165}
              height={180}
              title="MTR-2"
              lines={["STATUS :", "RH :", "HZ :", "KW :"]}
                />
              <SensorIndicator
              x={276}
              y={784}
              w={63.75}
              h={25.5}
              value={rawMotorStatus["MTR-2"]} // true = ON (hijau), false = OFF (merah)
              mode="onoff"
              />
              <SensorIndicator
              x={238}
              y={812}
              w={63.75}
              h={25.5}
              value={getRh("cooling-water/motor_status_2")}
              unit=" h"
              warningThreshold={getRhConfig("MTR-2").warning}
              alarmThreshold={getRhConfig("MTR-2").alarm}
              thresholdDirection="above"
              />
              <SensorIndicator
              x={238}
              y={840}
              w={63.75}
              h={25.5}
              value="XX"
              unit=""
              />
              <SensorIndicator
              x={238}
              y={868}
              w={63.75}
              h={25.5}
              value="XX"
              unit=""
              />

              {/* MTR 3 */}
              <InfoCard
              x={348}
              y={730}
              width={165}
              height={180}
              title="MTR-3"
              lines={["STATUS :", "RH :", "HZ :", "KW :"]}
                />
              <SensorIndicator
              x={444}
              y={784}
              w={63.75}
              h={25.5}
              value={rawMotorStatus["MTR-3"]} // true = ON (hijau), false = OFF (merah)
              mode="onoff"
              />
              <SensorIndicator
              x={406}
              y={812}
              w={63.75}
              h={25.5}
              value={getRh("cooling-water/motor_status_3")}
              unit=" h"
              warningThreshold={getRhConfig("MTR-3").warning}
              alarmThreshold={getRhConfig("MTR-3").alarm}
              thresholdDirection="above"
              />
              <SensorIndicator
              x={406}
              y={840}
              w={63.75}
              h={25.5}
              value="XX"
              unit=""
              />
              <SensorIndicator
              x={406}
              y={868}
              w={63.75}
              h={25.5}
              value="XX"
              unit=""
              />

              {/* BLOWDOWN */}
              <InfoCard
              x={525}
              y={680}
              width={170}
              height={150}
              title="BLOWDOWN WATER"
              lines={["STATUS :", "VOL :"]}
              />
              <SensorIndicator
              x={625}
              y={756}
              w={63.75}
              h={25.5}
              value="XX"
              mode="onoff"
              />
              <SensorIndicator
              x={593}
              y={784}
              w={63.75}
              h={25.5}
              value="XX"
              unit=""
              />

              {/* COOLING TANK */}
              <InfoCard
              x={698}
              y={680}
              width={170}
              height={170}
              title="COOLING  TANK"
              lines={["TDS :", "PH :", "LEVEL :"]}
              />
              <SensorIndicator
              x={765}
              y={752}
              w={63.75}
              h={25.5}
              value={getVal("cooling-water/cooling_tank_tds")}
              unit=""
              warningThreshold={23000}
              alarmThreshold={25000}
              thresholdDirection="above"
              decimalPlaces={1}
              />
              <SensorIndicator
              x={755}
              y={780}
              w={63.75}
              h={25.5}
              value={getVal("cooling-water/cooling_tank_ph")}
              unit=" PH"
              warningThreshold={7.5}
              alarmThreshold={8}
              thresholdDirection="above"
              decimalPlaces={1}
              />
              <SensorIndicator
              x={785}
              y={808}
              w={63.75}
              h={25.5}
              value={getVal("cooling-water/basin_lvl")}
              unit=" %"
              warningThreshold={75}
              alarmThreshold={70}
              thresholdDirection="below"
              decimalPlaces={1}
              />

              {/* CHEMICAL 357 */}
              <InfoCard
              x={875}
              y={780}
              width={170}
              height={170}
              title="CHEMICAL  357"
              lines={["LEVEL :", "PUMP :", "VOL :"]}
              />
              <SensorIndicator
              x={965}
              y={851}
              w={63.75}
              h={25.5}
              value={getVal("cooling-water/chemical_357_lvl")}
              unit=" %"
              warningThreshold={pidThresholds?.chemical_357_lvl?.warning ?? 75}
              alarmThreshold={pidThresholds?.chemical_357_lvl?.alarm ?? 70}
              thresholdDirection="below"
              decimalPlaces={1}
              />
               <SensorIndicator
              x={960}
              y={879}
              w={63.75}
              h={25.5}
              value={getVal("cooling-water/chemical_357_pump")}
              mode="onoff"
              />
               <SensorIndicator
              x={945}
              y={907}
              w={63.75}
              h={25.5}
              value={getVal("cooling-water/chemical_357_vol")}
              unit=" L"
              />

              {/* CHEMICAL 327 */}
              <InfoCard
              x={1045}
              y={780}
              width={170}
              height={170}
              title="CHEMICAL  327 / 317"
              lines={["LEVEL :", "PUMP :", "VOL :"]}
              />
              <SensorIndicator
              x={1133}
              y={851}
              w={63.75}
              h={25.5}
              value={getVal("cooling-water/chemical_327_lvl")}
              unit=" %"
              warningThreshold={pidThresholds?.chemical_327_lvl?.warning ?? 75}
              alarmThreshold={pidThresholds?.chemical_327_lvl?.alarm ?? 70}
              thresholdDirection="below"
              decimalPlaces={1}
              />
               <SensorIndicator
              x={1128}
              y={879}
              w={63.75}
              h={25.5}
              value={getVal("cooling-water/chemical_327_pump")}
              mode="onoff"
              />
               <SensorIndicator
              x={1115}
              y={907}
              w={63.75}
              h={25.5}
              value={getVal("cooling-water/chemical_327_vol")}
              unit=" L"
              />

              {/* MTR 4 */}
              <InfoCard
              x={1180}
              y={580}
              width={175}
              height={150}
              title="MTR-4"
              lines={["RH :", "AMPERE :", "KW :"]}
                />
              <SensorIndicator
              x={1237}
              y={632}
              w={63.75}
              h={25.5}
              value={getRh("cooling-water/eq_status_du03")}
              unit=" h"
              warningThreshold={getRhConfig("MTR-4").warning}
              alarmThreshold={getRhConfig("MTR-4").alarm}
              thresholdDirection="above"
              />
              <SensorIndicator
              x={1285}
              y={660}
              w={63.75}
              h={25.5}
              value="XX"
              unit=""
              />
              <SensorIndicator
              x={1240}
              y={688}
              w={63.75}
              h={25.5}
              value="XX"
              unit=""
              />

              {/* MTR 5 */}
              <InfoCard
              x={1355}
              y={580}
              width={175}
              height={150}
              title="MTR-5"
              lines={["RH :", "AMPERE :", "KW :"]}
                />
              <SensorIndicator
              x={1412}
              y={632}
              w={63.75}
              h={25.5}
              value={getRh("cooling-water/eq_status_bp03")}
              unit=" h"
              warningThreshold={getRhConfig("MTR-5").warning}
              alarmThreshold={getRhConfig("MTR-5").alarm}
              thresholdDirection="above"
              />
              <SensorIndicator
              x={1460}
              y={660}
              w={63.75}
              h={25.5}
              value="XX"
              unit=""
              />
              <SensorIndicator
              x={1415}
              y={688}
              w={63.75}
              h={25.5}
              value="XX"
              unit=""
              />

              {/* MTR 6 */}
              <InfoCard
              x={1530}
              y={580}
              width={175}
              height={150}
              title="MTR-6"
              lines={["RH :", "AMPERE :", "KW :"]}
                />
              <SensorIndicator
              x={1587}
              y={632}
              w={63.75}
              h={25.5}
              value={getRh("cooling-water/eq_status_prep03")}
              unit=" h"
              warningThreshold={getRhConfig("MTR-6").warning}
              alarmThreshold={getRhConfig("MTR-6").alarm}
              thresholdDirection="above"
              />
              <SensorIndicator
              x={1635}
              y={660}
              w={63.75}
              h={25.5}
              value="XX"
              unit=""
              />
              <SensorIndicator
              x={1590}
              y={688}
              w={63.75}
              h={25.5}
              value="XX"
              unit=""
              />

              {/* MTR 7 */}
              <InfoCard
              x={1300}
              y={770}
              width={175}
              height={150}
              title="MTR-7"
              lines={["RH :", "AMPERE :", "KW :"]}
                />
              <SensorIndicator
              x={1358}
              y={822}
              w={63.75}
              h={25.5}
              value={getRh("cooling-water/eq_status_st03")}
              unit=" h"
              warningThreshold={getRhConfig("MTR-7").warning}
              alarmThreshold={getRhConfig("MTR-7").alarm}
              thresholdDirection="above"
              />
              <SensorIndicator
              x={1405}
              y={850}
              w={63.75}
              h={25.5}
              value="XX"
              unit=""
              />
              <SensorIndicator
              x={1362}
              y={878}
              w={63.75}
              h={25.5}
              value="XX"
              unit=""
              />

              {/* MTR 8 */}
              {/* MTR 8 */}
              <InfoCard
              x={1475}
              y={770}
              width={175}
              height={150}
              title="MTR-8"
              lines={["RH :", "AMPERE :", "KW :"]}
                />
              <SensorIndicator
              x={1533}
              y={822}
              w={63.75}
              h={25.5}
              value={getRh("cooling-water/eq_status_washing")}
              unit=" h"
              warningThreshold={getRhConfig("MTR-8").warning}
              alarmThreshold={getRhConfig("MTR-8").alarm}
              thresholdDirection="above"
              />
              <SensorIndicator
              x={1580}
              y={850}
              w={63.75}
              h={25.5}
              value="XX"
              unit=""
              />
              <SensorIndicator
              x={1537}
              y={878}
              w={63.75}
              h={25.5}
              value="XX"
              unit=""
              />

              {/* MTR 9 */}
              <InfoCard
              x={1650}
              y={770}
              width={175}
              height={150}
              title="MTR-9"
              lines={["RH :", "AMPERE :", "KW :"]}
                />
              <SensorIndicator
              x={1708}
              y={822}
              w={63.75}
              h={25.5}
              value={getRh("cooling-water/eq_status_minilab")}
              unit=" h"
              warningThreshold={getRhConfig("MTR-9").warning}
              alarmThreshold={getRhConfig("MTR-9").alarm}
              thresholdDirection="above"
              />
              <SensorIndicator
              x={1755}
              y={850}
              w={63.75}
              h={25.5}
              value="XX"
              unit=""
              />
              <SensorIndicator
              x={1712}
              y={878}
              w={63.75}
              h={25.5}
              value="XX"
              unit=""
              />

              {/* MAKEUP WATER */}
              <InfoCard
              x={1009}
              y={250}
              width={140}
              height={170}
              title="MAKEUP WATER"
              lines={["TDS :", "PH :", "VOL :"]}
              />
              <SensorIndicator
              x={1075}
              y={322}
              w={63.75}
              h={25.5}
              value="XX"
              unit=""
              />
              <SensorIndicator
              x={1068}
              y={350}
              w={63.75}
              h={25.5}
              value="XX"
              unit=""
              />
              <SensorIndicator
              x={1075}
              y={378}
              w={63.75}
              h={25.5}
              value="XX"
              unit=""
              />

              {/* FAN 1 */}
              <InfoCard
              x={73}
              y={-160}
              width={165}
              height={180}
              title="FAN-1"
              lines={["STATUS :", "RH :", "HZ :", "KW :"]}
                />
              <SensorIndicator
              x={169}
              y={-108}
              w={63.75}
              h={25.5}
              value={rawMotorStatus["FAN-1"]} // true = ON (hijau), false = OFF (merah)
              mode="onoff"
              />
              <SensorIndicator
              x={130}
              y={-79}
              w={63.75}
              h={25.5}
              value={getRh("cooling-water/fan_status_1")}
              unit=" h"
              warningThreshold={getRhConfig("FAN-1").warning}
              alarmThreshold={getRhConfig("FAN-1").alarm}
              thresholdDirection="above"
              />
              <SensorIndicator
              x={130}
              y={-50}
              w={63.75}
              h={25.5}
              value="XX"
              unit=""
              />
              <SensorIndicator
              x={135}
              y={-22}
              w={63.75}
              h={25.5}
              value="XX"
              unit=""
              />

              {/* FAN 2 */}
               <InfoCard
              x={287}
              y={-160}
              width={165}
              height={180}
              title="FAN-2"
              lines={["STATUS :", "RH :", "HZ :", "KW :"]}
                />
              <SensorIndicator
              x={383}
              y={-108}
              w={63.75}
              h={25.5}
              value={rawMotorStatus["FAN-2"]} // true = ON (hijau), false = OFF (merah)
              mode="onoff"
              />
              <SensorIndicator
              x={344}
              y={-79}
              w={63.75}
              h={25.5}
              value={getRh("cooling-water/fan_status_2")}
              unit=" h"
              warningThreshold={getRhConfig("FAN-2").warning}
              alarmThreshold={getRhConfig("FAN-2").alarm}
              thresholdDirection="above"
              />
              <SensorIndicator
              x={344}
              y={-50}
              w={63.75}
              h={25.5}
              value="XX"
              unit=""
              />
              <SensorIndicator
              x={349}
              y={-22}
              w={63.75}
              h={25.5}
              value="XX"
              unit=""
              />

              {/* FAN 3 */}
              <InfoCard
              x={506}
              y={-160}
              width={165}
              height={180}
              title="FAN-3"
              lines={["STATUS :", "RH :", "HZ :", "KW :"]}
                />
              <SensorIndicator
              x={602}
              y={-108}
              w={63.75}
              h={25.5}
              value={rawMotorStatus["FAN-3"]} // true = ON (hijau), false = OFF (merah)
              mode="onoff"
              />
              <SensorIndicator
              x={563}
              y={-79}
              w={63.75}
              h={25.5}
              value={getRh("cooling-water/fan_status_3")}
              unit=" h"
              warningThreshold={getRhConfig("FAN-3").warning}
              alarmThreshold={getRhConfig("FAN-3").alarm}
              thresholdDirection="above"
              />
              <SensorIndicator
              x={563}
              y={-50}
              w={63.75}
              h={25.5}
              value="XX"
              unit=""
              />
              <SensorIndicator
              x={568}
              y={-22}
              w={63.75}
              h={25.5}
              value="XX"
              unit=""
              />

              {/* Text Label Area */}
              <LabelComponent text="DU-3" x={1203} y={212} w={20} h={20} hasBorder={false} fontSize={18}/>
              <LabelComponent text="BP-3" x={1308} y={212} w={20} h={20} hasBorder={false} fontSize={18} />
              <LabelComponent text="SP-3" x={1416} y={212} w={20} h={20} hasBorder={false} fontSize={18}/>
              <LabelComponent text="ST-3" x={1522} y={212} w={20} h={20} hasBorder={false} fontSize={18}/>
              <LabelComponent text="WASHING" x={1625} y={212} w={20} h={20} hasBorder={false} fontSize={16}/>
              <LabelComponent text="MINI LAB" x={1732} y={212} w={20} h={20} hasBorder={false} fontSize={16}/>

              <LabelComponent text="HEADER" x={250} y={540} w={20} h={20} hasBorder={false} fontSize={16}/>
              <LabelComponent text="HEADER" x={1465} y={540} w={20} h={20} hasBorder={false} fontSize={16}/>
              
              {/* Sensor Card */}
              <SensorCard
              x={829}
              y={-145}
              width={175}
              title="SUPPLY TEMP"
              value={getVal("cooling-water/supply_temp") as string | number}
              unit={typeof getVal("cooling-water/supply_temp") === "number" ? " °C" : ""}
              colorType="green"
              />
              <SensorCard
              x={1038}
              y={-145}
              width={175}
              title="Δ TEMP"
              value={deltaTVal}
              unit={typeof deltaTVal === "number" ? " °C" : ""}
              colorType="green"
              />
              <SensorCard
              x={829}
              y={-35}
              width={175}
              title="RETURN TEMP"
              value={getVal("cooling-water/return_temp") as string | number}
              unit={typeof getVal("cooling-water/return_temp") === "number" ? " °C" : ""}
              colorType="green"
              />
              <SensorCard
              x={1038}
              y={-35}
              width={175}
              title="AMBIENT"
              values={[
              { value: "XX", unit: "" }
              ]}
              colorType="green"
              />
              <SensorCard
              x={1495}
              y={-145}
              width={175}
              title="HEATING"
              value="XX"
              colorType="blue"
              />
              <SensorCard
              x={1280}
              y={-145}
              width={175}
              title="PROSES ST"
              value={getStProcessStatus()}
              colorType="blue"
              />
              <SensorCard
              x={1495}
              y={-35}
              width={175}
              title="COOLING"
              value="XX"
              colorType="blue"
              />
              <SensorCard
              x={1280}
              y={-35}
              width={175}
              title="LOT"
              value="XX"
              colorType="blue"
              />

              

              

            </svg>
  );
}