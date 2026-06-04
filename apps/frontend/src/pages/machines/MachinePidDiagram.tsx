import { useRef, useState } from "react";
import { useOutletContext } from "react-router-dom";
import { getUnitById } from "../../data/machines";
import pidBaseImage from "../../assets/pid-base2.png";
import type { MachineOutletContext } from "./MachineLayout";

// ── Import komponen svg ──────────────────────────────────────────────────────
import { PipeDefs } from "../../components/pid/PipeDefs";
import { PipeH, PipeV } from "../../components/pid/Pipe";
import { DeviceLabel } from "../../components/pid/DeviceLabel";
import { SensorIndicator } from "../../components/pid/SensorIndicator";
import LabelComponent from "../../components/pid/TextLabel";
import { LevelIndicator } from "../../components/pid/LevelIndicator";
import { TankFrame } from "../../components/pid/TankFrame";
import PipeBend from "../../components/pid/PipeBend";
import {HeaderPipe} from "../../components/pid/HeaderPipe";
import { YStrainer } from "../../components/pid/YStrainerPipe";
import ChemicalDosingTank from "../../components/pid/ChemicalDosingTank";
import PipeGauge from "../../components/pid/PipeGauge";
import VerticalValve from "../../components/pid/VerticalValve";
import PumpMotor from "../../components/pid/PumpMotor";
import CoolingTower from "../../components/pid/CoolingTower";

const PID_CANVAS_WIDTH  = 1836;
const PID_CANVAS_HEIGHT = 789;

// ── Mode kalibrasi ─────────────────────────────────────────────────────────────
const DEV_MODE = true;

export default function MachinePidDiagram() {
  const { unitId } = useOutletContext<MachineOutletContext>();
  const machine    = getUnitById(unitId);
  const svgRef     = useRef<SVGSVGElement>(null);

  const [allOn, setAllOn] = useState(false);
  const [selectedTaskFilter, setSelectedTaskFilter] = useState<"all" | "open_month" | "open" | "close">("all");

  if (!machine) return null;

  const motorStatus = {
    "FAN-1": allOn,
    "FAN-2": allOn,
    "FAN-3": allOn,
    "MTR-1": allOn,
    "MTR-2": allOn,
    "MTR-3": allOn,
    "MTR-4": allOn,
    "MTR-5": allOn,
    "MTR-6": allOn,
    "MTR-7": allOn,
    "MTR-8": allOn,
    "MTR-9": allOn,
  };

  const handleSvgClick = (e: React.MouseEvent<SVGSVGElement>) => {
    if (!DEV_MODE || !svgRef.current) return;
    const rect = svgRef.current.getBoundingClientRect();
    const scaleX = PID_CANVAS_WIDTH  / rect.width;
    const scaleY = PID_CANVAS_HEIGHT / rect.height;
    const x = Math.round((e.clientX - rect.left)  * scaleX);
    const y = Math.round((e.clientY - rect.top)   * scaleY);
    console.log(`Clicked: x=${x}, y=${y}  (SVG coords)`);
  };

  const allTasks = [
    { id: 1, title: "Inspeksi Motor MTR-1", status: "open", openedMonth: true, createdDate: "2026-06-01" },
    { id: 2, title: "Calibration PT-01", status: "open", openedMonth: true, createdDate: "2026-06-02" },
    { id: 3, title: "Cleaning Heat Exchanger", status: "open", openedMonth: true, createdDate: "2026-06-03" },
    { id: 4, title: "Check Pump Vibration", status: "open", openedMonth: true, createdDate: "2026-06-05" },
    { id: 5, title: "Valve Maintenance CT-03", status: "open", openedMonth: true, createdDate: "2026-06-07" },
    { id: 6, title: "Replace Filter Element", status: "open", openedMonth: true, createdDate: "2026-06-08" },
    { id: 7, title: "Pressure Relief Valve Test", status: "open", openedMonth: true, createdDate: "2026-06-10" },
    { id: 8, title: "Cooling Tower Inspection", status: "open", openedMonth: true, createdDate: "2026-06-12" },
    { id: 9, title: "Temperature Sensor Check", status: "open", openedMonth: true, createdDate: "2026-06-15" },
    { id: 10, title: "Flow Meter Calibration", status: "open", openedMonth: true, createdDate: "2026-06-18" },
    { id: 11, title: "Pipe Insulation Repair", status: "open", openedMonth: true, createdDate: "2026-06-20" },
    { id: 12, title: "Blowdown System Check", status: "open", openedMonth: true, createdDate: "2026-06-22" },
    { id: 13, title: "Pump Seal Replacement", status: "open", openedMonth: false, createdDate: "2026-05-15" },
    { id: 14, title: "Water Treatment Analysis", status: "open", openedMonth: false, createdDate: "2026-05-10" },
    { id: 15, title: "Equipment Alignment", status: "open", openedMonth: false, createdDate: "2026-04-20" },
    { id: 16, title: "Safety Valve Testing", status: "open", openedMonth: false, createdDate: "2026-04-05" },
    { id: 17, title: "Bearing Lubrication", status: "open", openedMonth: false, createdDate: "2026-03-28" },
    { id: 18, title: "Daily Inspection Report", status: "close", openedMonth: false, createdDate: "2026-06-20" },
    { id: 19, title: "Temperature Log Check", status: "close", openedMonth: false, createdDate: "2026-06-19" },
    { id: 20, title: "Vibration Analysis", status: "close", openedMonth: false, createdDate: "2026-06-18" },
    { id: 21, title: "Drain Plug Inspection", status: "close", openedMonth: false, createdDate: "2026-06-17" },
    { id: 22, title: "Filter Replacement", status: "close", openedMonth: false, createdDate: "2026-06-16" },
    { id: 23, title: "Flow Rate Verification", status: "close", openedMonth: false, createdDate: "2026-06-15" },
    { id: 24, title: "Electrical Connection Check", status: "close", openedMonth: false, createdDate: "2026-06-14" },
  ];

  const filteredTasks = selectedTaskFilter === "all" 
    ? allTasks 
    : selectedTaskFilter === "open_month"
    ? allTasks.filter(t => t.openedMonth && t.status === "open")
    : selectedTaskFilter === "open"
    ? allTasks.filter(t => t.status === "open")
    : allTasks.filter(t => t.status === "close");

  const taskInfo = {
    openThisMonth: allTasks.filter(t => t.openedMonth && t.status === "open").length,
    taskOpen: allTasks.filter(t => t.status === "open").length,
    taskClose: allTasks.filter(t => t.status === "close").length,
  };

  const alarmInfo = [
    { id: 1, code: "ALM-001", message: "High temperature detected at CT-01", severity: "warning" },
    { id: 2, code: "ALM-002", message: "Low pressure at MTR-4", severity: "critical" },
    { id: 3, code: "ALM-004", message: "Pump vibration exceeds threshold", severity: "critical" },
    { id: 4, code: "ALM-005", message: "Cooling tower fan bearing temperature high", severity: "warning" },
    { id: 5, code: "ALM-007", message: "Water TDS level abnormal", severity: "warning" }
  ];

  return (
    <div className="h-[calc(100vh-100px)] flex flex-col overflow-hidden">

      <div className="flex-1 flex gap-4 flex-col lg:flex-row overflow-hidden">
        
        <section className="flex-1 flex flex-col overflow-hidden rounded-lg border border-slate-800 bg-slate-950/70 p-3 sm:p-5">

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

        <div className="overflow-x-auto overflow-y-hidden pb-0 flex-1">
          <div
            className="relative mx-auto w-full min-w-[720px] max-w-[1836px] h-full overflow-hidden rounded-lg border border-dashed border-slate-700 bg-slate-900"
            // style={{ aspectRatio: "1836 / 789" }}
          >
            {/* ── SVG UTAMA (mengandung gambar background + komponen) ── */}
            <svg
              ref={svgRef}
              className="absolute inset-0 h-full w-full"
              viewBox="0 0 1836 789"
              preserveAspectRatio="xMidYMid meet" 
              style={{ pointerEvents: DEV_MODE ? "auto" : "none" }}
              onClick={handleSvgClick}
            >
              {/* ── GAMBAR LATAR (sebagai elemen image di dalam SVG) ── */}
              <image
                href={pidBaseImage}
                x="0"
                y="-145"
                width="1836"
                height="1080"
                preserveAspectRatio="none" // <-- KUNCI: gambar diregangkan pas dengan viewBox
                style={{ pointerEvents: "none" }}
              />

              {/* ── DEFINISI KOMPONEN ────────────────────────────────── */}
              <PipeDefs />

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
              <PipeH x={935} y={336} w={76} h={6} 
                on={motorStatus["MTR-3"]} dir="left" type="cold" />
              <PipeV x={923} y={346} w={7} h={59} 
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
              


            </svg>
          </div>
        </div>

        {DEV_MODE && (
          <p className="mt-2 text-center text-xs text-amber-400">
            🔧 DEV MODE AKTIF — klik di atas canvas untuk dapat koordinat SVG
          </p>
        )}
        </section>

        {/* ── Right Side ──────────────────────────────── */}
        <div className="flex flex-col gap-4 lg:w-96 overflow-hidden">
          
          <div className="flex-1 flex flex-col rounded-lg border border-slate-800 bg-slate-950/70 p-4 overflow-hidden min-h-0">
            <h3 className="text-xs uppercase tracking-[0.2em] text-slate-500 font-semibold mb-3">Task Information</h3>
            
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

            <div className="text-xs text-slate-600 font-medium mb-1">Keterangan ({filteredTasks.length})</div>
            <div className="flex-1 overflow-y-auto space-y-2 pr-2">
              {filteredTasks.length > 0 ? (
                filteredTasks.map((task) => (
                  <div key={task.id} className={`bg-white rounded border-2 p-2 text-xs ${
                    task.status === "open" ? "border-yellow-400" : "border-green-400"
                  }`}>
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

          <div className="flex-1 flex flex-col rounded-lg border border-slate-300 bg-white p-4 overflow-hidden min-h-0">
            <h3 className="text-xs uppercase tracking-[0.2em] text-slate-700 font-semibold mb-3">Alarms</h3>
            
            <div className="flex-1 overflow-y-auto space-y-2 pr-2">
              {alarmInfo.map((alarm) => (
                <div key={alarm.id} className={`border-2 rounded p-3 bg-white ${
                  alarm.severity === "critical"
                    ? "border-red-500"
                    : alarm.severity === "warning"
                    ? "border-yellow-500"
                    : "border-slate-300"
                }`}>
                  <div className="flex items-start gap-2">
                    <div className={`w-2.5 h-2.5 rounded-full mt-1.5 flex-shrink-0 ${
                      alarm.severity === "critical" ? "bg-red-500" :
                      alarm.severity === "warning" ? "bg-yellow-500" :
                      "bg-blue-500"
                    }`} />
                    <div className="flex-1 min-w-0">
                      <div className={`text-xs font-mono font-semibold ${
                        alarm.severity === "critical" ? "text-red-600" : "text-yellow-600"
                      }`}>
                        {alarm.code}
                      </div>
                      <p className={`text-xs leading-snug mt-1 text-slate-700`}>
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
    </div>
  );
}