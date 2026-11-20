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
import SensorCard from "../../../components/pid/SensorCard";
import { useTelemetryStore } from "../../../store/telemetry.store";


interface CoolingWF1U3PidProps {
  motorStatus: Record<string, boolean>;
  runningHours?: Record<string, number>;
  pidThresholds?: any;
  sensorRulesMap?: Record<string, any>;
  svgRef?: React.RefObject<SVGSVGElement>;
  onSvgClick?: (e: React.MouseEvent<SVGSVGElement>) => void;
  latest?: Record<string, any>;
  durationText?: string;
  durationActive?: boolean;
  durationCount?: number;
  onOpenListDuration?: () => void;
}

export default function CoolingWF1U3Pid({
  motorStatus: rawMotorStatus,
  runningHours = {},
  pidThresholds,
  sensorRulesMap = {},
  svgRef,
  onSvgClick,
  latest: propLatest,
  durationText = "00:00:00",
  durationActive = false,
  durationCount = 0,
  onOpenListDuration,
}: CoolingWF1U3PidProps) {
  const storeLatest = useTelemetryStore((state) => state.latest);
  const latest = propLatest || storeLatest;

  // Keep a boolean proxy for pipes, motor icons, and cooling towers
  const motorStatus = new Proxy(rawMotorStatus, {
    get: (target, prop: string) => {
      return target[prop] === true;
    }
  }) as Record<string, boolean>;

  const isBlowdownOn = Boolean(
    latest["cooling-water/blowdown_status"]?.value === true ||
    latest["cooling-water/blowdown_status"]?.value === 1 ||
    latest["cooling-water/blowdown_status"]?.value === "ON" ||
    latest["cooling-water/blowdown_status"]?.value === "RUNNING" ||
    (typeof latest["cooling-water/blowdown_flow"]?.value === "number" && latest["cooling-water/blowdown_flow"].value > 0)
  );

  const isDosing357On = Boolean(
    latest["cooling-water/chemical_357_pump"]?.value === true ||
    latest["cooling-water/chemical_357_pump"]?.value === 1 ||
    latest["cooling-water/chemical_357_pump"]?.value === "ON" ||
    latest["cooling-water/chemical_357_pump"]?.value === "RUNNING"
  );

  const isDosing327On = Boolean(
    latest["cooling-water/chemical_327_pump"]?.value === true ||
    latest["cooling-water/chemical_327_pump"]?.value === 1 ||
    latest["cooling-water/chemical_327_pump"]?.value === "ON" ||
    latest["cooling-water/chemical_327_pump"]?.value === "RUNNING"
  );

  // Helper to extract numerical telemetry values or display custom offline indicator
  const getVal = (tagId: string, unit = "") => {
    const pt = latest[tagId];
    if (!pt || pt.value === undefined || pt.value === "XX" || pt.value === "xx" || pt.value === "Belum Ada API") return "xx";
    return pt.value;
  };

  const getLvl = (tagId: string) => {
    const pt = latest[tagId];
    if (!pt || typeof pt.value !== "number") return 0;
    return pt.value;
  };

  const suppTempRaw = getVal("cooling-water/supply_temp");
  const retTempRaw = getVal("cooling-water/return_temp");
  const suppTempNum = typeof suppTempRaw === "number" ? suppTempRaw : parseFloat(String(suppTempRaw));
  const retTempNum = typeof retTempRaw === "number" ? retTempRaw : parseFloat(String(retTempRaw));
  const deltaTVal = !isNaN(retTempNum) && !isNaN(suppTempNum)
    ? Number((retTempNum - suppTempNum).toFixed(2))
    : getVal("cooling-water/delta_temp");

  const getStatusDisplay = (tagId: string) => {
    const raw = getVal(tagId);
    if (raw === "XX" || raw === "xx" || raw === "Belum Ada API" || raw === undefined || raw === null) {
      return "xx";
    }
    return (raw === 1 || raw === true || raw === "ON" || raw === "RUNNING") ? "ON" : "OFF";
  };

  const getStProcessStatus = () => {
    const heatVal = latest["cooling-water/st3_heating"]?.value;
    const coolVal = latest["cooling-water/st3_cooling"]?.value;
    const sterilVal = latest["cooling-water/st3_steril"]?.value;

    const isHeating = heatVal === 1 || heatVal === true || heatVal === "ON";
    const isCooling = coolVal === 1 || coolVal === true || coolVal === "ON";
    const isSteril = sterilVal === 1 || sterilVal === true || sterilVal === "ON";

    const hasHeating = heatVal !== undefined && heatVal !== "XX" && heatVal !== "xx" && heatVal !== "Belum Ada API";
    const hasCooling = coolVal !== undefined && coolVal !== "XX" && coolVal !== "xx" && coolVal !== "Belum Ada API";
    const hasSteril = sterilVal !== undefined && sterilVal !== "XX" && sterilVal !== "xx" && sterilVal !== "Belum Ada API";

    if (!hasHeating && !hasCooling && !hasSteril) return "xx";
    if (heatVal === "Belum Ada API" || coolVal === "Belum Ada API" || sterilVal === "Belum Ada API") return "xx";
    if (heatVal === "xx" || coolVal === "xx" || sterilVal === "xx") return "xx";

    if (isHeating) return "HEATING";
    if (isCooling) return "COOLING";
    if (isSteril) return "STERIL";
    return "STANDBY";
  };

  const getLotValue = () => {
    const val = latest["cooling-water/jumo_pieces"]?.value;
    if (val === undefined || val === null || val === "XX" || val === "xx" || val === "Belum Ada API") return "xx";
    const str = String(val);
    if (str.includes("/")) {
      return str.split("/")[1].trim();
    }
    return str.trim();
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

  const renderSensorIndicator = (
    tagId: string,
    extraProps: Omit<React.ComponentProps<typeof SensorIndicator>, "value" | "warningThreshold" | "alarmThreshold" | "thresholdDirection" | "enableAlert" | "suppressAlert">
  ) => {
    const rule = sensorRulesMap[tagId] || {};
    return (
      <SensorIndicator
        value={getVal(tagId)}
        warningThreshold={rule.baseline !== undefined && rule.baseline !== null && rule.baseline !== "" ? parseFloat(rule.baseline) : undefined}
        alarmThreshold={rule.highLimit !== undefined && rule.highLimit !== null && rule.highLimit !== "" ? parseFloat(rule.highLimit) : undefined}
        thresholdDirection={rule.direction || "above"}
        enableAlert={rule.enableAlert}
        suppressAlert={rule.suppressAlert}
        {...extraProps}
      />
    );
  };

  return (
    <svg
      ref={svgRef}
      className="absolute inset-0 h-full w-full"
      viewBox="24 -38 1728 985"
      preserveAspectRatio="xMidYMid meet"
      style={{ pointerEvents: "auto" }}
      onClick={onSvgClick}
    >
      <PipeDefs />

      {/* ── P&ID SCHEMATIC (1:1 Native Proportions, Balanced & Symmetrical) ── */}
      <g>
      {/* ── PIPE ─────────────────────────────────────────────────── */}

      {/* Pipe Tank to Right Header */}
      <PipeH x={961} y={544} w={105} h={6}
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

      {/* Pipe Right Header to Area */}
      <PipeV x={1110} y={249} w={7} h={280}
        on={motorStatus["MTR-4"]} dir="up" />
      <PipeV x={1216} y={249} w={7} h={280}
        on={motorStatus["MTR-5"]} dir="up" />
      <PipeV x={1322} y={249} w={7} h={280}
        on={motorStatus["MTR-6"]} dir="up" />
      <PipeV x={1427} y={249} w={7} h={280}
        on={motorStatus["MTR-7"]} dir="up" />
      <PipeV x={1532} y={249} w={7} h={280}
        on={motorStatus["MTR-8"]} dir="up" />
      <PipeV x={1638} y={249} w={7} h={280}
        on={motorStatus["MTR-9"]} dir="up" />

      {/* Pipe Makeup Water to Tank */}
      <PipeH x={940} y={336} w={58} h={6}
        on={false} dir="left" type="cold" />
      <PipeV x={923} y={358} w={7} h={48}
        on={false} dir="down" />
      <PipeBend x={921} y={334} size={25} angle={90} />

      {/* Pipe Area to Tank*/}
      <PipeV x={1110} y={166} w={7} h={30}
        on={motorStatus["MTR-4"]} dir="up" type="return" />
      <PipeH x={820} y={145} w={277} h={6}
        on={motorStatus["MTR-4"]} dir="left" type="return" />
      <PipeV x={800} y={168} w={7} h={238}
        on={motorStatus["MTR-4"]} dir="down" type="return" />
      <PipeBend x={1095} y={143} size={25} angle={180} />
      <PipeBend x={798} y={143} size={25} angle={90} />

      <PipeV x={1214} y={153} w={7} h={45}
        on={motorStatus["MTR-5"]} dir="up" type="return" />
      <PipeH x={810} y={133} w={388} h={6}
        on={motorStatus["MTR-5"]} dir="left" type="return" />
      <PipeV x={788} y={156} w={7} h={250}
        on={motorStatus["MTR-5"]} dir="down" type="return" />
      <PipeBend x={1198} y={130} size={25} angle={180} />
      <PipeBend x={786} y={131} size={25} angle={90} />

      <PipeV x={1322} y={141} w={7} h={57}
        on={motorStatus["MTR-6"]} dir="up" type="return" />
      <PipeH x={795} y={121} w={515} h={6}
        on={motorStatus["MTR-6"]} dir="left" type="return" />
      <PipeV x={776} y={144} w={7} h={262}
        on={motorStatus["MTR-6"]} dir="down" type="return" />
      <PipeBend x={1306} y={118} size={25} angle={180} />
      <PipeBend x={774} y={119} size={25} angle={90} />

      <PipeV x={1427} y={129} w={7} h={69}
        on={motorStatus["MTR-7"]} dir="up" type="return" />
      <PipeH x={783} y={109} w={630} h={6}
        on={motorStatus["MTR-7"]} dir="left" type="return" />
      <PipeV x={764} y={132} w={7} h={274}
        on={motorStatus["MTR-7"]} dir="down" type="return" />
      <PipeBend x={1411} y={106} size={25} angle={180} />
      <PipeBend x={762} y={107} size={25} angle={90} />

      <PipeV x={1532} y={117} w={7} h={81}
        on={motorStatus["MTR-8"]} dir="up" type="return" />
      <PipeH x={771} y={97} w={750} h={6}
        on={motorStatus["MTR-8"]} dir="left" type="return" />
      <PipeV x={752} y={120} w={7} h={286}
        on={motorStatus["MTR-8"]} dir="down" type="return" />
      <PipeBend x={1516} y={94} size={25} angle={180} />
      <PipeBend x={750} y={95} size={25} angle={90} />

      <PipeV x={1638} y={105} w={7} h={93}
        on={motorStatus["MTR-9"]} dir="up" type="return" />
      <PipeH x={759} y={85} w={865} h={6}
        on={motorStatus["MTR-9"]} dir="left" type="return" />
      <PipeV x={740} y={108} w={7} h={298}
        on={motorStatus["MTR-9"]} dir="down" type="return" />
      <PipeBend x={1622} y={82} size={25} angle={180} />
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
        on={isBlowdownOn} dir="down" type="warm" />
      <PipeH x={435} y={636} w={320} h={6}
        on={isBlowdownOn} dir="left" type="warm" />
      <PipeBend x={752} y={620} size={25} angle={270} />
      <LabelComponent text="Jalur Limbah Industri" x={270} y={615} w={165} h={50} hasBorder={true} fontSize={13} />

      {/* Pipe Dosing to Tank */}
      <PipeV x={892} y={575} w={7} h={33}
        on={isDosing357On} dir="up" />
      <PipeV x={961} y={640} w={7} h={24}
        on={isDosing357On} dir="up" />
      <PipeH x={916} y={621} w={32} h={7}
        on={isDosing357On} dir="left" />
      <PipeBend x={892} y={607} size={25} angle={0} />
      <PipeBend x={946} y={619} size={25} angle={180} />

      <PipeV x={912} y={575} w={7} h={20}
        on={isDosing327On} dir="up" />
      <PipeV x={1083} y={630} w={7} h={34}
        on={isDosing327On} dir="up" />
      <PipeH x={935} y={609} w={135} h={7}
        on={isDosing327On} dir="left" />
      <PipeBend x={911} y={594} size={25} angle={0} />
      <PipeBend x={1067} y={607} size={25} angle={180} />

      {/* Header Pipe */}
      <HeaderPipe x={89} y={525} w={350} h={45} />
      <HeaderPipe x={1067} y={525} w={620} h={45} />

      {/* ── TANK ────────────────────────────────────────────────── */}
      <TankFrame x={708} y={410} w={120} h={163} label="" />
      <TankFrame x={837} y={410} w={120} h={163} label="" />

      <LevelIndicator x={714} y={416} value={getLvl("cooling-water/basin_lvl")} w={108} h={151} type="warm" />
      <LevelIndicator x={843} y={416} value={getLvl("cooling-water/basin_lvl")} w={108} h={151} type="cold" />

      {renderSensorIndicator("cooling-water/basin_lvl", {
        x: 860, y: 492,
        w: 75, h: 30,
        unit: " %"
      })}
      {renderSensorIndicator("cooling-water/supply_temp", {
        x: 860, y: 530,
        w: 75, h: 30,
        unit: " °C",
        decimalPlaces: 1
      })}
      {renderSensorIndicator("cooling-water/return_temp", {
        x: 731, y: 530,
        w: 75, h: 30,
        unit: " °C",
        decimalPlaces: 1
      })}

      {/* Sensor Indicator Pipe MTR-1 to MTR-9 */}
      {renderSensorIndicator("cooling-water/pressure_1", {
        x: 118, y: 273,
        w: 75, h: 30,
        unit: " BAR",
        decimalPlaces: 1
      })}
      {renderSensorIndicator("cooling-water/pressure_2", {
        x: 333, y: 273,
        w: 75, h: 30,
        unit: " BAR",
        decimalPlaces: 1
      })}
      {renderSensorIndicator("cooling-water/pressure_3", {
        x: 552, y: 273,
        w: 75, h: 30,
        unit: " BAR",
        decimalPlaces: 1
      })}
      {renderSensorIndicator("cooling-water/eq_press_du03", {
        x: 1077, y: 273,
        w: 75, h: 30,
        unit: " BAR",
        decimalPlaces: 1
      })}
      {renderSensorIndicator("cooling-water/eq_press_bp03", {
        x: 1182, y: 273,
        w: 75, h: 30,
        unit: " BAR",
        decimalPlaces: 1
      })}
      {renderSensorIndicator("cooling-water/eq_press_prep03", {
        x: 1290, y: 273,
        w: 75, h: 30,
        unit: " BAR",
        decimalPlaces: 1
      })}
      {renderSensorIndicator("cooling-water/eq_press_st03", {
        x: 1395, y: 273,
        w: 75, h: 30,
        unit: " BAR",
        decimalPlaces: 1
      })}
      {renderSensorIndicator("cooling-water/eq_press_washing", {
        x: 1499, y: 273,
        w: 75, h: 30,
        unit: " BAR",
        decimalPlaces: 1
      })}
      {renderSensorIndicator("cooling-water/eq_press_minilab", {
        x: 1605, y: 273,
        w: 75, h: 30,
        unit: " BAR",
        decimalPlaces: 1
      })}

      {renderSensorIndicator("cooling-water/st3_return_temp", {
        x: 1396, y: 147,
        w: 75, h: 30,
        unit: " °C",
        decimalPlaces: 1
      })}

      {/* Chemical Dosing Tank */}
      <ChemicalDosingTank x={932} y={685} width={67} height={65} id="tankA" />
      <ChemicalDosingTank x={1054} y={685} width={67} height={65} id="tankB" />

      <LevelIndicator x={940} y={700} value={getChem357Lvl()} w={51} h={51} type="cold" />
      <LevelIndicator x={1062} y={700} value={getChem327Lvl()} w={51} h={51} type="cold" />

      {/* Gauge */}
      <PipeGauge x={946} y={287} size={60} />
      <PipeGauge x={608} y={587} size={60} />

      {/* Valve */}
      <VerticalValve x={130} y={319} size={50} angle={0} />
      <VerticalValve x={343} y={319} size={50} angle={0} />
      <VerticalValve x={562} y={319} size={50} angle={0} />
      <VerticalValve x={1089} y={319} size={50} angle={0} />
      <VerticalValve x={1195} y={319} size={50} angle={0} />
      <VerticalValve x={1301} y={319} size={50} angle={0} />
      <VerticalValve x={1406} y={319} size={50} angle={0} />
      <VerticalValve x={1511} y={319} size={50} angle={0} />
      <VerticalValve x={1617} y={319} size={50} angle={0} />

      {/* Y-Strainer Pipe */}
      <YStrainer x={148} y={478} size={15} />
      <YStrainer x={361} y={478} size={15} />
      <YStrainer x={580} y={478} size={15} />
      <YStrainer x={1107} y={478} size={15} />
      <YStrainer x={1213} y={478} size={15} />
      <YStrainer x={1319} y={478} size={15} />
      <YStrainer x={1424} y={478} size={15} />
      <YStrainer x={1529} y={478} size={15} />
      <YStrainer x={1635} y={478} size={15} />

      {/* Pump MTR */}
      <PumpMotor x={105} y={370} size={100} on={motorStatus["MTR-1"]} />
      <PumpMotor x={318} y={370} size={100} on={motorStatus["MTR-2"]} />
      <PumpMotor x={537} y={370} size={100} on={motorStatus["MTR-3"]} />
      <PumpMotor x={1064} y={370} size={100} on={motorStatus["MTR-4"]} />
      <PumpMotor x={1170} y={370} size={100} on={motorStatus["MTR-5"]} />
      <PumpMotor x={1276} y={370} size={100} on={motorStatus["MTR-6"]} />
      <PumpMotor x={1381} y={370} size={100} on={motorStatus["MTR-7"]} />
      <PumpMotor x={1486} y={370} size={100} on={motorStatus["MTR-8"]} />
      <PumpMotor x={1592} y={370} size={100} on={motorStatus["MTR-9"]} />

      {/* Cooling Tower */}
      <CoolingTower x={55} y={-12} size={200} on={motorStatus["FAN-1"]} />
      <CoolingTower x={269} y={-12} size={200} on={motorStatus["FAN-2"]} />
      <CoolingTower x={487} y={-12} size={200} on={motorStatus["FAN-3"]} />

      {/* Component Labels */}
      <LabelComponent text="FAN-1" x={145} y={-4} w={20} h={20} hasBorder={false} fontSize={17} />
      <LabelComponent text="FAN-2" x={359} y={-4} w={20} h={20} hasBorder={false} fontSize={17} />
      <LabelComponent text="FAN-3" x={577} y={-4} w={20} h={20} hasBorder={false} fontSize={17} />

      <LabelComponent text="MAKEUP" x={966} y={268} w={20} h={20} hasBorder={false} fontSize={13} />

      <LabelComponent text="DU-3" x={1103} y={212} w={20} h={20} hasBorder={false} fontSize={16} />
      <LabelComponent text="BP-3" x={1208} y={212} w={20} h={20} hasBorder={false} fontSize={16} />
      <LabelComponent text="SP-3" x={1316} y={212} w={20} h={20} hasBorder={false} fontSize={16} />
      <LabelComponent text="ST-3" x={1422} y={212} w={20} h={20} hasBorder={false} fontSize={16} />
      <LabelComponent text="WASHING" x={1525} y={212} w={20} h={20} hasBorder={false} fontSize={15} />
      <LabelComponent text="MINI LAB" x={1632} y={212} w={20} h={20} hasBorder={false} fontSize={15} />

      <LabelComponent text="HEADER" x={250} y={540} w={20} h={20} hasBorder={false} fontSize={15} />
      <LabelComponent text="HEADER" x={1365} y={540} w={20} h={20} hasBorder={false} fontSize={15} />

      <LabelComponent text="MTR-1" x={145} y={580} w={20} h={20} hasBorder={false} fontSize={15} />
      <LabelComponent text="MTR-2" x={358} y={580} w={20} h={20} hasBorder={false} fontSize={15} />
      <LabelComponent text="MTR-3" x={562} y={580} w={20} h={20} hasBorder={false} fontSize={15} />
      <LabelComponent text="MTR-4" x={1104} y={580} w={20} h={20} hasBorder={false} fontSize={15} />
      <LabelComponent text="MTR-5" x={1210} y={580} w={20} h={20} hasBorder={false} fontSize={15} />
      <LabelComponent text="MTR-6" x={1316} y={580} w={20} h={20} hasBorder={false} fontSize={15} />
      <LabelComponent text="MTR-7" x={1421} y={580} w={20} h={20} hasBorder={false} fontSize={15} />
      <LabelComponent text="MTR-8" x={1526} y={580} w={20} h={20} hasBorder={false} fontSize={15} />
      <LabelComponent text="MTR-9" x={1632} y={580} w={20} h={20} hasBorder={false} fontSize={15} />

      <LabelComponent text="COOLING TANK" x={822} y={640} w={20} h={20} hasBorder={false} fontSize={14} />
      <LabelComponent text="CHEM 357" x={955.5} y={758} w={20} h={20} hasBorder={false} fontSize={13} />
      <LabelComponent text="CHEM 327/317" x={1077.5} y={758} w={20} h={20} hasBorder={false} fontSize={13} />
      </g>

      {/* ── BOTTOM WHITE SENSOR CARDS (Symmetrical 4 + 4 = 8-Card Row: x=89..1687) ── */}
      <SensorCard
        x={89}
        y={812}
        width={182}
        title="SUPPLY TEMP"
        value={getVal("cooling-water/supply_temp") as string | number}
        unit={typeof getVal("cooling-water/supply_temp") === "number" ? " °C" : ""}
        colorType="green"
      />
      <SensorCard
        x={287}
        y={812}
        width={182}
        title="RETURN TEMP"
        value={getVal("cooling-water/return_temp") as string | number}
        unit={typeof getVal("cooling-water/return_temp") === "number" ? " °C" : ""}
        colorType="green"
      />
      <SensorCard
        x={485}
        y={812}
        width={182}
        title="Δ TEMP"
        value={deltaTVal}
        unit={typeof deltaTVal === "number" ? " °C" : ""}
        colorType="green"
      />
      <SensorCard
        x={683}
        y={812}
        width={182}
        title="AMBIENT"
        values={[
          { value: getVal("cooling-water/ambient_temp") as string | number, unit: typeof getVal("cooling-water/ambient_temp") === "number" ? " °C" : "" },
          { value: getVal("cooling-water/ambient_humidity") as string | number, unit: typeof getVal("cooling-water/ambient_humidity") === "number" ? " %" : "" }
        ]}
        colorType="green"
      />

      {/* Subtle Center Group Divider */}
      <line
        x1={888}
        y1={822}
        x2={888}
        y2={902}
        stroke="#94a3b8"
        strokeWidth={1.5}
        strokeDasharray="4 4"
        opacity={0.5}
      />

      <SensorCard
        x={911}
        y={812}
        width={182}
        title="PROSES ST"
        value={getStProcessStatus()}
        colorType="blue"
      />
      <SensorCard
        x={1109}
        y={812}
        width={182}
        title="LOT"
        value={getLotValue()}
        colorType="blue"
      />
      <SensorCard
        x={1307}
        y={812}
        width={182}
        title="DURATION"
        value={durationText}
        valueFontSize={25}
        valueColorOverride={durationActive ? "#00cc00" : undefined}
        colorType="blue"
      />
      <SensorCard
        x={1505}
        y={812}
        width={182}
        title="LIST DURATION"
        value={durationCount > 0 ? `LIHAT (${durationCount})` : "LIHAT TABEL"}
        valueFontSize={15}
        isActionButton={true}
        onClick={onOpenListDuration}
        colorType="blue"
      />
    </svg>
  );
}