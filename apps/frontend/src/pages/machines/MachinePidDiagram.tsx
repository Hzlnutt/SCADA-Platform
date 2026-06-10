import { useRef, useState } from "react";
import { useOutletContext } from "react-router-dom";
import { getUnitById } from "../../data/machines";
import type { MachineOutletContext } from "./MachineLayout";

import { PipeDefs } from "../../components/pid/PipeDefs";
import { PipeH, PipeV } from "../../components/pid/Pipe";
import { SensorIndicator } from "../../components/pid/SensorIndicator";
import LabelComponent from "../../components/pid/TextLabel";
import { LevelIndicator } from "../../components/pid/LevelIndicator";
import { TankFrame } from "../../components/pid/TankFrame";
import PipeBend from "../../components/pid/PipeBend";
import { HeaderPipe } from "../../components/pid/HeaderPipe";
import { YStrainer } from "../../components/pid/YStrainerPipe";
import ChemicalDosingTank from "../../components/pid/ChemicalDosingTank";
import PipeGauge from "../../components/pid/PipeGauge";
import VerticalValve from "../../components/pid/VerticalValve";
import PumpMotor from "../../components/pid/PumpMotor";
import CoolingTower from "../../components/pid/CoolingTower";
import InfoCard from "../../components/pid/InfoCard";
import SensorCard from "../../components/pid/SensorCard";
import DashedLine from "../../components/pid/DashedLine";

const PID_CANVAS_WIDTH  = 1836;
const PID_CANVAS_HEIGHT = 1110;
const DEV_MODE = true;

export default function MachinePidDiagram() {
  const { unitId } = useOutletContext<MachineOutletContext>();
  const machine    = getUnitById(unitId);
  const svgRef     = useRef<SVGSVGElement>(null);

  const [allOn, setAllOn] = useState(false);
  const [selectedTaskFilter, setSelectedTaskFilter] = useState<"all" | "open_month" | "open" | "close">("all");

  if (!machine) return null;

  const motorStatus = {
    "FAN-1": allOn, "FAN-2": allOn, "FAN-3": allOn,
    "MTR-1": allOn, "MTR-2": allOn, "MTR-3": allOn,
    "MTR-4": allOn, "MTR-5": allOn, "MTR-6": allOn,
    "MTR-7": allOn, "MTR-8": allOn, "MTR-9": allOn,
  };

  const handleSvgClick = (e: React.MouseEvent<SVGSVGElement>) => {
    if (!DEV_MODE || !svgRef.current) return;
    const rect = svgRef.current.getBoundingClientRect();
    const scaleX = PID_CANVAS_WIDTH  / rect.width;
    const scaleY = PID_CANVAS_HEIGHT / rect.height;
    const x = Math.round((e.clientX - rect.left) * scaleX);
    const y = Math.round((e.clientY - rect.top)  * scaleY);
    console.log(`Clicked: x=${x}, y=${y}  (SVG coords)`);
  };

  const allTasks = [
    { id: 1,  title: "Inspeksi Motor MTR-1",        status: "open",  openedMonth: true,  createdDate: "2026-06-01" },
    { id: 2,  title: "Calibration PT-01",            status: "open",  openedMonth: true,  createdDate: "2026-06-02" },
    { id: 3,  title: "Cleaning Heat Exchanger",      status: "open",  openedMonth: true,  createdDate: "2026-06-03" },
    { id: 4,  title: "Check Pump Vibration",         status: "open",  openedMonth: true,  createdDate: "2026-06-05" },
    { id: 5,  title: "Valve Maintenance CT-03",      status: "open",  openedMonth: true,  createdDate: "2026-06-07" },
    { id: 6,  title: "Replace Filter Element",       status: "open",  openedMonth: true,  createdDate: "2026-06-08" },
    { id: 7,  title: "Pressure Relief Valve Test",   status: "open",  openedMonth: true,  createdDate: "2026-06-10" },
    { id: 8,  title: "Cooling Tower Inspection",     status: "open",  openedMonth: true,  createdDate: "2026-06-12" },
    { id: 9,  title: "Temperature Sensor Check",     status: "open",  openedMonth: true,  createdDate: "2026-06-15" },
    { id: 10, title: "Flow Meter Calibration",       status: "open",  openedMonth: true,  createdDate: "2026-06-18" },
    { id: 11, title: "Pipe Insulation Repair",       status: "open",  openedMonth: true,  createdDate: "2026-06-20" },
    { id: 12, title: "Blowdown System Check",        status: "open",  openedMonth: true,  createdDate: "2026-06-22" },
    { id: 13, title: "Pump Seal Replacement",        status: "open",  openedMonth: false, createdDate: "2026-05-15" },
    { id: 14, title: "Water Treatment Analysis",     status: "open",  openedMonth: false, createdDate: "2026-05-10" },
    { id: 15, title: "Equipment Alignment",          status: "open",  openedMonth: false, createdDate: "2026-04-20" },
    { id: 16, title: "Safety Valve Testing",         status: "open",  openedMonth: false, createdDate: "2026-04-05" },
    { id: 17, title: "Bearing Lubrication",          status: "open",  openedMonth: false, createdDate: "2026-03-28" },
    { id: 18, title: "Daily Inspection Report",      status: "close", openedMonth: false, createdDate: "2026-06-20" },
    { id: 19, title: "Temperature Log Check",        status: "close", openedMonth: false, createdDate: "2026-06-19" },
    { id: 20, title: "Vibration Analysis",           status: "close", openedMonth: false, createdDate: "2026-06-18" },
    { id: 21, title: "Drain Plug Inspection",        status: "close", openedMonth: false, createdDate: "2026-06-17" },
    { id: 22, title: "Filter Replacement",           status: "close", openedMonth: false, createdDate: "2026-06-16" },
    { id: 23, title: "Flow Rate Verification",       status: "close", openedMonth: false, createdDate: "2026-06-15" },
    { id: 24, title: "Electrical Connection Check",  status: "close", openedMonth: false, createdDate: "2026-06-14" },
  ];

  const filteredTasks =
    selectedTaskFilter === "all"        ? allTasks :
    selectedTaskFilter === "open_month" ? allTasks.filter(t => t.openedMonth && t.status === "open") :
    selectedTaskFilter === "open"       ? allTasks.filter(t => t.status === "open") :
                                          allTasks.filter(t => t.status === "close");

  const taskInfo = {
    openThisMonth: allTasks.filter(t => t.openedMonth && t.status === "open").length,
    taskOpen:      allTasks.filter(t => t.status === "open").length,
    taskClose:     allTasks.filter(t => t.status === "close").length,
  };

  const alarmInfo = [
    { id: 1, code: "ALM-001", message: "High temperature detected at CT-01",        severity: "warning"  },
    { id: 2, code: "ALM-002", message: "Low pressure at MTR-4",                     severity: "critical" },
    { id: 3, code: "ALM-004", message: "Pump vibration exceeds threshold",           severity: "critical" },
    { id: 4, code: "ALM-005", message: "Cooling tower fan bearing temperature high", severity: "warning"  },
    { id: 5, code: "ALM-007", message: "Water TDS level abnormal",                  severity: "warning"  },
  ];

  return (
    <div className="relative flex gap-4">
      {/* Container relative — tinggi ditentukan oleh canvas */}

    {/* ── Canvas: beri margin kanan untuk ruang right column ── */}
    <section className="flex-1 flex flex-col rounded-lg border border-slate-800 bg-slate-950/70 p-3 sm:p-5 mr-[400px]">
      <div className="mb-4 flex items-center justify-between">
        <div className="text-xs uppercase tracking-[0.2em] text-slate-500">
          P&ID Diagram Canvas — {machine.name}
        </div>
        <button
          onClick={() => setAllOn(v => !v)}
          className={`rounded px-3 py-1 text-xs font-mono transition-colors ${
            allOn
              ? "bg-cyan-900/60 text-cyan-400 border border-cyan-700"
              : "bg-slate-800 text-slate-400 border border-slate-700"
          }`}
        >
          {allOn ? "● FLOW ON" : "○ FLOW OFF"} (demo)
        </button>
      </div>

        <div className="overflow-x-auto scrollbar-hide">
          <div
            className="relative w-full min-w-[720px] rounded-lg border border-dashed border-slate-700 bg-slate-900"
            style={{ aspectRatio: "1836 / 1110" }}
          >
            <svg
              ref={svgRef}
              className="absolute inset-0 h-full w-full"
              viewBox="0 -160 1836 1110"
              preserveAspectRatio="xMidYMid meet"
              style={{ pointerEvents: DEV_MODE ? "auto" : "none" }}
              onClick={handleSvgClick}
            >

              {/* ── DEFINISI KOMPONEN ────────────────────────────────── */}
              <PipeDefs />

              {/* Dashed Line */}
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
                on={true} dir="up" type="return" />
              <PipeH x={820} y={145} w={377} h={6} 
                on={true} dir="left" type="return" />
              <PipeV x={800} y={168} w={7} h={238} 
                on={true} dir="down" type="return" />
              <PipeBend x={1195} y={143} size={25} angle={180} />
              <PipeBend x={798} y={143} size={25} angle={90} />

              <PipeV x={1314} y={153} w={7} h={45} 
                on={true} dir="up" type="return" />
              <PipeH x={810} y={133} w={488} h={6} 
                on={true} dir="left" type="return" />
              <PipeV x={788} y={156} w={7} h={250} 
                on={true} dir="down" type="return" />
              <PipeBend x={1298} y={130} size={25} angle={180} />
              <PipeBend x={786} y={131} size={25} angle={90} />

              <PipeV x={1422} y={141} w={7} h={57} 
                on={true} dir="up" type="return" />
              <PipeH x={795} y={121} w={615} h={6} 
                on={true} dir="left" type="return" />
              <PipeV x={776} y={144} w={7} h={262} 
                on={true} dir="down" type="return" />
              <PipeBend x={1406} y={118} size={25} angle={180} />
              <PipeBend x={774} y={119} size={25} angle={90} />

              <PipeV x={1527} y={129} w={7} h={69} 
                on={true} dir="up" type="return" />
              <PipeH x={783} y={109} w={730} h={6} 
                on={true} dir="left" type="return" />
              <PipeV x={764} y={132} w={7} h={274} 
                on={true} dir="down" type="return" />
              <PipeBend x={1511} y={106} size={25} angle={180} />
              <PipeBend x={762} y={107} size={25} angle={90} />

              <PipeV x={1632} y={117} w={7} h={81} 
                on={true} dir="up" type="return" />
              <PipeH x={771} y={97} w={850} h={6} 
                on={true} dir="left" type="return" />
              <PipeV x={752} y={120} w={7} h={286} 
                on={true} dir="down" type="return" />
              <PipeBend x={1616} y={94} size={25} angle={180} />
              <PipeBend x={750} y={95} size={25} angle={90} />

              <PipeV x={1738} y={105} w={7} h={93} 
                on={true} dir="up" type="return" />
              <PipeH x={759} y={85} w={965} h={6} 
                on={true} dir="left" type="return" />
              <PipeV x={740} y={108} w={7} h={298} 
                on={true} dir="down" type="return" />
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

              <LevelIndicator x={714} y={416} value={76} w={108} h={151} type="warm" />
              <LevelIndicator x={843} y={416} value={76} w={108} h={151} type="cold" />

              <SensorIndicator 
                x={860} y={492} 
                w={75} h={30}
                value={76} unit=" %" 
                warningThreshold={75} alarmThreshold={70} 
                thresholdDirection="below" 
              />
              <SensorIndicator 
                x={860} y={530} 
                w={75} h={30}
                value={28.5} unit=" °C" 
                warningThreshold={28} alarmThreshold={30}
                decimalPlaces={1}
                thresholdDirection="above" 
              />
              <SensorIndicator 
                x={731} y={530} 
                w={75} h={30}
                value={32.8} unit=" °C" 
                warningThreshold={38} alarmThreshold={40}
                decimalPlaces={1}
                thresholdDirection="above" 
              />

              {/* Sensor Indicator Pipe MTR-1 to MTR-9 */}
              <SensorIndicator 
                x={118} y={273} 
                w={75} h={30}
                value={1.8} unit=" BAR" 
                warningThreshold={1.5} alarmThreshold={2.0}
                decimalPlaces={1}
                thresholdDirection="above" 
              />
              <SensorIndicator 
                x={333} y={273} 
                w={75} h={30}
                value={2} unit=" BAR" 
                warningThreshold={1.5} alarmThreshold={2.0}
                decimalPlaces={1}
                thresholdDirection="above" 
              />
              <SensorIndicator 
                x={552} y={273} 
                w={75} h={30}
                value={1.2} unit=" BAR" 
                warningThreshold={1.5} alarmThreshold={2.0}
                decimalPlaces={1}
                thresholdDirection="above" 
              />
              <SensorIndicator 
                x={1177} y={273} 
                w={75} h={30}
                value={1.5} unit=" BAR" 
                warningThreshold={1.5} alarmThreshold={2.0}
                decimalPlaces={1}
                thresholdDirection="above" 
              />
              <SensorIndicator 
                x={1282} y={273} 
                w={75} h={30}
                value={1.4} unit=" BAR" 
                warningThreshold={1.5} alarmThreshold={2.0}
                decimalPlaces={1}
                thresholdDirection="above" 
              />
              <SensorIndicator 
                x={1390} y={273} 
                w={75} h={30}
                value={0.8} unit=" BAR" 
                warningThreshold={1.5} alarmThreshold={2.0}
                decimalPlaces={1}
                thresholdDirection="above" 
              />
              <SensorIndicator 
                x={1495} y={273} 
                w={75} h={30}
                value={2.4} unit=" BAR" 
                warningThreshold={1.5} alarmThreshold={2.0}
                decimalPlaces={1}
                thresholdDirection="above" 
              />
              <SensorIndicator 
                x={1599} y={273} 
                w={75} h={30}
                value={1.3} unit=" BAR" 
                warningThreshold={1.5} alarmThreshold={2.0}
                decimalPlaces={1}
                thresholdDirection="above" 
              />
              <SensorIndicator 
                x={1705} y={273} 
                w={75} h={30}
                value={0.8} unit=" BAR" 
                warningThreshold={1.5} alarmThreshold={2.0}
                decimalPlaces={1}
                thresholdDirection="above" 
              />

              <SensorIndicator 
                x={1496} y={147} 
                w={75} h={30}
                value={34.6} unit=" °C" 
                warningThreshold={35} alarmThreshold={40}
                decimalPlaces={1}
                thresholdDirection="above" 
              />

              {/* Chemical Dosing Tank */}
              <ChemicalDosingTank x={932}  y={685} width={67} height={65} id="tankA" />
              <ChemicalDosingTank x={1094}  y={685} width={67} height={65} id="tankB" />

              <LevelIndicator x={940} y={700} value={50} w={51} h={51} type="cold" />
              <LevelIndicator x={1102} y={700} value={80} w={51} h={51} type="cold" />

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
              <CoolingTower x={269} y={-12} size={200} on={motorStatus["FAN-1"]} />
              <CoolingTower x={487} y={-12} size={200} on={motorStatus["FAN-1"]} />

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
              value={motorStatus["MTR-1"]} // true = ON (hijau), false = OFF (merah)
              mode="onoff"
              />
              <SensorIndicator
              x={70}
              y={812}
              w={63.75}
              h={25.5}
              value={23000}
              unit=" H"
              warningThreshold={23000}
              alarmThreshold={25000}
              thresholdDirection="above"
              />
              <SensorIndicator
              x={70}
              y={840}
              w={63.75}
              h={25.5}
              value={50}
              unit=" Hz"
              />
              <SensorIndicator
              x={70}
              y={868}
              w={63.75}
              h={25.5}
              value={100}
              unit=" KW"
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
              value={motorStatus["MTR-2"]} // true = ON (hijau), false = OFF (merah)
              mode="onoff"
              />
              <SensorIndicator
              x={238}
              y={812}
              w={63.75}
              h={25.5}
              value={23000}
              unit=" H"
              warningThreshold={23000}
              alarmThreshold={25000}
              thresholdDirection="above"
              />
              <SensorIndicator
              x={238}
              y={840}
              w={63.75}
              h={25.5}
              value={50}
              unit=" Hz"
              />
              <SensorIndicator
              x={238}
              y={868}
              w={63.75}
              h={25.5}
              value={100}
              unit=" KW"
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
              value={motorStatus["MTR-3"]} // true = ON (hijau), false = OFF (merah)
              mode="onoff"
              />
              <SensorIndicator
              x={406}
              y={812}
              w={63.75}
              h={25.5}
              value={23000}
              unit=" H"
              warningThreshold={23000}
              alarmThreshold={25000}
              thresholdDirection="above"
              />
              <SensorIndicator
              x={406}
              y={840}
              w={63.75}
              h={25.5}
              value={50}
              unit=" Hz"
              />
              <SensorIndicator
              x={406}
              y={868}
              w={63.75}
              h={25.5}
              value={100}
              unit=" KW"
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
              value={motorStatus["MTR-1"]} // true = ON (hijau), false = OFF (merah)
              mode="onoff"
              />
              <SensorIndicator
              x={593}
              y={784}
              w={63.75}
              h={25.5}
              value={0}
              unit=""
              warningThreshold={23000}
              alarmThreshold={25000}
              thresholdDirection="above"
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
              value={0}
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
              value={7.4}
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
              value={74}
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
              value={74}
              unit=" %"
              warningThreshold={75}
              alarmThreshold={70}
              thresholdDirection="below"
              decimalPlaces={1}
              />
               <SensorIndicator
              x={960}
              y={879}
              w={63.75}
              h={25.5}
              value={motorStatus["MTR-1"]} // true = ON (hijau), false = OFF (merah)
              mode="onoff"
              />
               <SensorIndicator
              x={945}
              y={907}
              w={63.75}
              h={25.5}
              value={0}
              unit=""
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
              value={74}
              unit=" %"
              warningThreshold={75}
              alarmThreshold={70}
              thresholdDirection="below"
              decimalPlaces={1}
              />
               <SensorIndicator
              x={1128}
              y={879}
              w={63.75}
              h={25.5}
              value={motorStatus["MTR-1"]} // true = ON (hijau), false = OFF (merah)
              mode="onoff"
              />
               <SensorIndicator
              x={1115}
              y={907}
              w={63.75}
              h={25.5}
              value={0}
              unit=""
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
              value={23000}
              unit=" H"
              warningThreshold={23000}
              alarmThreshold={25000}
              thresholdDirection="above"
              />
              <SensorIndicator
              x={1285}
              y={660}
              w={63.75}
              h={25.5}
              value={50}
              unit=" A"
              />
              <SensorIndicator
              x={1240}
              y={688}
              w={63.75}
              h={25.5}
              value={100}
              unit=" KW"
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
              value={23000}
              unit=" H"
              warningThreshold={23000}
              alarmThreshold={25000}
              thresholdDirection="above"
              />
              <SensorIndicator
              x={1460}
              y={660}
              w={63.75}
              h={25.5}
              value={50}
              unit=" A"
              />
              <SensorIndicator
              x={1415}
              y={688}
              w={63.75}
              h={25.5}
              value={100}
              unit=" KW"
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
              value={23000}
              unit=" H"
              warningThreshold={23000}
              alarmThreshold={25000}
              thresholdDirection="above"
              />
              <SensorIndicator
              x={1635}
              y={660}
              w={63.75}
              h={25.5}
              value={50}
              unit=" A"
              />
              <SensorIndicator
              x={1590}
              y={688}
              w={63.75}
              h={25.5}
              value={100}
              unit=" KW"
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
              value={23000}
              unit=" H"
              warningThreshold={23000}
              alarmThreshold={25000}
              thresholdDirection="above"
              />
              <SensorIndicator
              x={1405}
              y={850}
              w={63.75}
              h={25.5}
              value={50}
              unit=" A"
              />
              <SensorIndicator
              x={1362}
              y={878}
              w={63.75}
              h={25.5}
              value={100}
              unit=" KW"
              />

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
              value={23000}
              unit=" H"
              warningThreshold={23000}
              alarmThreshold={25000}
              thresholdDirection="above"
              />
              <SensorIndicator
              x={1580}
              y={850}
              w={63.75}
              h={25.5}
              value={50}
              unit=" A"
              />
              <SensorIndicator
              x={1537}
              y={878}
              w={63.75}
              h={25.5}
              value={100}
              unit=" KW"
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
              value={23000}
              unit=" H"
              warningThreshold={23000}
              alarmThreshold={25000}
              thresholdDirection="above"
              />
              <SensorIndicator
              x={1755}
              y={850}
              w={63.75}
              h={25.5}
              value={50}
              unit=" A"
              />
              <SensorIndicator
              x={1712}
              y={878}
              w={63.75}
              h={25.5}
              value={100}
              unit=" KW"
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
              value={0}
              unit=""
              warningThreshold={23000}
              alarmThreshold={25000}
              thresholdDirection="above"
              decimalPlaces={1}
              />
              <SensorIndicator
              x={1068}
              y={350}
              w={63.75}
              h={25.5}
              value={7.4}
              unit=" PH"
              warningThreshold={7.5}
              alarmThreshold={8}
              thresholdDirection="above"
              decimalPlaces={1}
              />
              <SensorIndicator
              x={1075}
              y={378}
              w={63.75}
              h={25.5}
              value={0}
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
              value={motorStatus["FAN-1"]} // true = ON (hijau), false = OFF (merah)
              mode="onoff"
              />
              <SensorIndicator
              x={130}
              y={-79}
              w={63.75}
              h={25.5}
              value={23000}
              unit=" H"
              warningThreshold={23000}
              alarmThreshold={25000}
              thresholdDirection="above"
              />
              <SensorIndicator
              x={130}
              y={-50}
              w={63.75}
              h={25.5}
              value={50}
              unit=" Hz"
              />
              <SensorIndicator
              x={135}
              y={-22}
              w={63.75}
              h={25.5}
              value={100}
              unit=" KW"
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
              value={motorStatus["FAN-2"]} // true = ON (hijau), false = OFF (merah)
              mode="onoff"
              />
              <SensorIndicator
              x={344}
              y={-79}
              w={63.75}
              h={25.5}
              value={23000}
              unit=" H"
              warningThreshold={23000}
              alarmThreshold={25000}
              thresholdDirection="above"
              />
              <SensorIndicator
              x={344}
              y={-50}
              w={63.75}
              h={25.5}
              value={50}
              unit=" Hz"
              />
              <SensorIndicator
              x={349}
              y={-22}
              w={63.75}
              h={25.5}
              value={100}
              unit=" KW"
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
              value={motorStatus["FAN-3"]} // true = ON (hijau), false = OFF (merah)
              mode="onoff"
              />
              <SensorIndicator
              x={563}
              y={-79}
              w={63.75}
              h={25.5}
              value={23000}
              unit=" H"
              warningThreshold={23000}
              alarmThreshold={25000}
              thresholdDirection="above"
              />
              <SensorIndicator
              x={563}
              y={-50}
              w={63.75}
              h={25.5}
              value={50}
              unit=" Hz"
              />
              <SensorIndicator
              x={568}
              y={-22}
              w={63.75}
              h={25.5}
              value={100}
              unit=" KW"
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
              value={29.5}
              unit={"°C"}
              colorType="green"
              />
              <SensorCard
              x={1038}
              y={-145}
              width={175}
              title="Δ TEMP"
              value={5.5}
              unit={"°C"}
              colorType="green"
              />
              <SensorCard
              x={829}
              y={-35}
              width={175}
              title="RETURN TEMP"
              value={34.5}
              unit={"°C"}
              colorType="green"
              />
              <SensorCard
              x={1038}
              y={-35}
              width={175}
              title="AMBIENT"
              values={[
              { value: 5.5, unit: "°C" },
              { value: 75, unit: "%" }
              ]}
              colorType="green"
              />
              <SensorCard
              x={1495}
              y={-145}
              width={175}
              title="HEATING"
              value={45}
              colorType="blue"
              />
              <SensorCard
              x={1280}
              y={-145}
              width={175}
              title="PROSES ST"
              value={"STANDBY"}
              colorType="blue"
              />
              <SensorCard
              x={1495}
              y={-35}
              width={175}
              title="COOLING"
              value={90}
              colorType="blue"
              />
              <SensorCard
              x={1280}
              y={-35}
              width={175}
              title="LOT"
              value={"A"}
              colorType="blue"
              />

              

              

            </svg>
          </div>
        </div>

        </section>

      {/* ── Right Side: sticky, tinggi independen dari canvas ───────── */}
      <div className="absolute top-0 right-0 w-96 h-full flex flex-col gap-4">

        {/* Task card — 60% */}
      <div
        className="flex flex-col rounded-lg border border-slate-800 bg-slate-950/70 p-4 overflow-hidden"
        style={{ flex: "3 1 0", minHeight: 0 }}
      >
        <h3 className="text-xs uppercase tracking-[0.2em] text-slate-500 font-semibold mb-3">
          Task Information
        </h3>
        <div className="space-y-1.5 mb-2">
          <button
            onClick={() => setSelectedTaskFilter("open_month")}
            className={`w-full text-left flex justify-between items-center px-2 py-1.5 rounded border-2 transition-colors ${
              selectedTaskFilter === "open_month"
                ? "bg-white border-cyan-500 text-slate-900"
                : "bg-white border-slate-300 text-slate-900 hover:border-cyan-400"
            }`}
          >
            <span className="text-xs font-medium">Task Open (Bulan Ini)</span>
            <span className={`text-base font-semibold ${selectedTaskFilter === "open_month" ? "text-cyan-600" : "text-cyan-500"}`}>
              {taskInfo.openThisMonth}
            </span>
          </button>
          <button
            onClick={() => setSelectedTaskFilter("open")}
            className={`w-full text-left flex justify-between items-center px-2 py-1.5 rounded border-2 transition-colors ${
              selectedTaskFilter === "open"
                ? "bg-white border-yellow-500 text-slate-900"
                : "bg-white border-slate-300 text-slate-900 hover:border-yellow-400"
            }`}
          >
            <span className="text-xs font-medium">Task Open</span>
            <span className={`text-base font-semibold ${selectedTaskFilter === "open" ? "text-yellow-600" : "text-yellow-500"}`}>
              {taskInfo.taskOpen}
            </span>
          </button>
          <button
            onClick={() => setSelectedTaskFilter("close")}
            className={`w-full text-left flex justify-between items-center px-2 py-1.5 rounded border-2 transition-colors ${
              selectedTaskFilter === "close"
                ? "bg-white border-green-500 text-slate-900"
                : "bg-white border-slate-300 text-slate-900 hover:border-green-400"
            }`}
          >
            <span className="text-xs font-medium">Task Close</span>
            <span className={`text-base font-semibold ${selectedTaskFilter === "close" ? "text-green-600" : "text-green-500"}`}>
              {taskInfo.taskClose}
            </span>
          </button>
        </div>
        <div className="text-xs text-slate-600 font-medium mb-1">
          Keterangan ({filteredTasks.length})
        </div>
        <div className="flex-1 overflow-y-auto space-y-2 pr-2 scrollbar-hide">
          {filteredTasks.length > 0 ? (
            filteredTasks.map((task) => (
              <div
                key={task.id}
                className={`bg-white rounded border-2 p-2 text-xs ${
                  task.status === "open" ? "border-yellow-400" : "border-green-400"
                }`}
              >
                <div className="font-medium text-slate-900">{task.title}</div>
                <div className="text-slate-600 mt-1">
                  <span className={`inline-block px-2 py-0.5 rounded text-xs font-semibold ${
                    task.status === "open" ? "bg-yellow-100 text-yellow-700" : "bg-green-100 text-green-700"
                  }`}>
                    {task.status === "open" ? "OPEN" : "CLOSE"}
                  </span>
                  <span className="text-slate-500 ml-2 text-xs">{task.createdDate}</span>
                </div>
              </div>
            ))
          ) : (
            <div className="text-center text-slate-400 py-4">Tidak ada task</div>
          )}
        </div>
      </div>

              {/* Alarm card — 40% */}
      <div
        className="flex flex-col rounded-lg border border-slate-300 bg-white p-4 overflow-hidden"
        style={{ flex: "2 1 0", minHeight: 0 }}
      >
        <h3 className="text-xs uppercase tracking-[0.2em] text-slate-700 font-semibold mb-3">
          Alarms
        </h3>
        <div className="flex-1 overflow-y-auto space-y-2 pr-2 scrollbar-hide">
          {alarmInfo.map((alarm) => (
            <div
              key={alarm.id}
              className={`border-2 rounded p-3 bg-white ${
                alarm.severity === "critical" ? "border-red-500" :
                alarm.severity === "warning"  ? "border-yellow-500" :
                                                "border-slate-300"
              }`}
            >
              <div className="flex items-start gap-2">
                <div className={`w-2.5 h-2.5 rounded-full mt-1.5 flex-shrink-0 ${
                  alarm.severity === "critical" ? "bg-red-500" :
                  alarm.severity === "warning"  ? "bg-yellow-500" :
                                                  "bg-blue-500"
                }`} />
                <div className="flex-1 min-w-0">
                  <div className={`text-xs font-mono font-semibold ${
                    alarm.severity === "critical" ? "text-red-600" : "text-yellow-600"
                  }`}>
                    {alarm.code}
                  </div>
                  <p className="text-xs leading-snug mt-1 text-slate-700">
                    {alarm.message}
                  </p>
                </div>
              </div>
            </div>
            ))}
          </div>
        </div>

      </div>

    </div>
  );
}