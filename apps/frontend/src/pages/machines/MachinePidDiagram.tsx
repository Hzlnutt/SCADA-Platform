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

const PID_CANVAS_WIDTH  = 1836;
const PID_CANVAS_HEIGHT = 789;
const PID_CANVAS_ASPECT_RATIO = `${PID_CANVAS_WIDTH} / ${PID_CANVAS_HEIGHT}`;

// ── Mode kalibrasi ─────────────────────────────────────────────────────────────
// Ubah ke true untuk mencari koordinat posisi pipe.
// Klik di atas canvas → console akan print x, y dalam koordinat SVG (0–1836 / 0–789).
// Setelah dapat koordinatnya, ubah kembali ke false.
const DEV_MODE = true;

export default function MachinePidDiagram() {
  const { unitId } = useOutletContext<MachineOutletContext>();
  const machine    = getUnitById(unitId);
  const svgRef     = useRef<SVGSVGElement>(null);

  // ── Toggle sementara untuk demo (ganti dengan data API sesungguhnya) ────────
  const [allOn, setAllOn] = useState(false);
  const [selectedTaskFilter, setSelectedTaskFilter] = useState<"all" | "open_month" | "open" | "close">("all");

  if (!machine) return null;

  // ── Status mesin (ganti dengan data dari PLC/API) ────────────────────────────
  // Contoh struktur: true = mesin ON (flow animasi aktif), false = OFF
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

  // ── Kalibrasi: klik di SVG canvas → print koordinat ─────────────────────────
  const handleSvgClick = (e: React.MouseEvent<SVGSVGElement>) => {
    if (!DEV_MODE || !svgRef.current) return;
    const rect = svgRef.current.getBoundingClientRect();
    const scaleX = PID_CANVAS_WIDTH  / rect.width;
    const scaleY = PID_CANVAS_HEIGHT / rect.height;
    const x = Math.round((e.clientX - rect.left)  * scaleX);
    const y = Math.round((e.clientY - rect.top)   * scaleY);
    console.log(`Clicked: x=${x}, y=${y}  (SVG coords)`);
  };

  // ── Sample data untuk Task dan Alarm ────────────────────────────────────
  const allTasks = [
    // Tasks opened this month
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
    // Additional open tasks
    { id: 13, title: "Pump Seal Replacement", status: "open", openedMonth: false, createdDate: "2026-05-15" },
    { id: 14, title: "Water Treatment Analysis", status: "open", openedMonth: false, createdDate: "2026-05-10" },
    { id: 15, title: "Equipment Alignment", status: "open", openedMonth: false, createdDate: "2026-04-20" },
    { id: 16, title: "Safety Valve Testing", status: "open", openedMonth: false, createdDate: "2026-04-05" },
    { id: 17, title: "Bearing Lubrication", status: "open", openedMonth: false, createdDate: "2026-03-28" },
    // Closed tasks
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
    <div className="h-[calc(100vh-100px)] flex flex-col">

      {/* P&ID Canvas + Right Side Cards */}
      <div className="flex-1 flex gap-4 flex-col lg:flex-row overflow-hidden">
        
        {/* P&ID Canvas - Left Side */}
        <section className="flex-1 flex flex-col overflow-hidden rounded-lg border border-slate-800 bg-slate-950/70 p-3 sm:p-5">

        {/* Header + toggle sementara */}
        <div className="mb-4 flex items-center justify-between">
          <div className="text-xs uppercase tracking-[0.2em] text-slate-500">
            P&ID Diagram Canvas — {machine.name}
          </div>
          {/* Tombol demo — hapus setelah pakai data API sesungguhnya */}
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

        <div className="overflow-x-auto pb-2 flex-1">
          <div
            className="relative mx-auto w-full min-w-[720px] max-w-[1836px] h-full overflow-hidden rounded-lg border border-dashed border-slate-700 bg-slate-900"
            style={{ aspectRatio: PID_CANVAS_ASPECT_RATIO }}
          >
            {/* Background statis */}
            <img
              src={pidBaseImage}
              alt=""
              className="pointer-events-none absolute inset-0 h-full w-full select-none object-fill"
              draggable={false}
            />

            <canvas
              id="pid-canvas"
              width={PID_CANVAS_WIDTH}
              height={PID_CANVAS_HEIGHT}
              className="absolute inset-0 h-full w-full"
            />

            {/* ── SVG Overlay ─────────────────────────────────────────────── */}
            <svg
              ref={svgRef}
              className="absolute inset-0 h-full w-full"
              viewBox={`0 0 ${PID_CANVAS_WIDTH} ${PID_CANVAS_HEIGHT}`}
              preserveAspectRatio="none"
              style={{ pointerEvents: DEV_MODE ? "auto" : "none" }}
              onClick={handleSvgClick}
            >
              {/* ── STEP 1: Defs (wajib, harus pertama) ─────────────────── */}
              <PipeDefs />
            
              {/* PIPE DARI TANK KE MOTOR 3 */}
              <PipeH x={588} y={596} w={133} h={8} on={motorStatus["MTR-3"]} dir="left" />

              {/* PIPE DARI TANK KE MOTOR 1 dan 2 */}
              <PipeH 
              x={467} y={616} w={254} h={8} 
              on={motorStatus["MTR-1"] || motorStatus["MTR-2"]} dir="left" />

              {/* PIPE DARI TANK KE HEADER KANAN*/}
              <PipeH 
              x={1003} y={616} w={153} h={8} 
              on={motorStatus["MTR-4"] || motorStatus["MTR-5"] || motorStatus["MTR-6"] || motorStatus["MTR-7"] || motorStatus["MTR-8"] || motorStatus["MTR-9"]} />

              {/* ── BRANCH VERTIKAL — MTR-1 (Cooling Tower 1) ─────────────── */}
              <PipeV x={233.5} y={42} w={9} h={560} on={motorStatus["MTR-1"]} dir="up" />

              {/* ── BRANCH HORIZONTAL — MTR-1 (Cooling Tower 1) ─────────────── */}
              <PipeH x={254} y={20} w={144} h={9} on={motorStatus["MTR-1"]} />

              {/* ── BRANCH VERTIKAL — MTR-2 (Cooling Tower 2) ─────────────── */}
              <PipeV x={403.3} y={41} w={9} h={561} on={motorStatus["MTR-2"]} dir="up" />

              {/* ── BRANCH HORIZONTAL — MTR-2 (Cooling Tower 2) ─────────────── */}
              <PipeH 
              x={419} y={20} 
              w={147} h={9} 
              on={motorStatus["MTR-1"] || motorStatus["MTR-2"]}  />

              {/* ── BRANCH VERTIKAL — MTR-3 (Cooling Tower 3) ─────────────── */}
              <PipeV x={572} y={41} w={9} h={545} on={motorStatus["MTR-3"]} dir="up" />

              {/* ── BRANCH HORIZONTAL — MTR-3 (Cooling Tower 3) ─────────────── */}
              <PipeH 
              x={587} y={20} 
              w={329} h={9} 
              on={motorStatus["MTR-1"] || motorStatus["MTR-2"] || motorStatus["MTR-3"]}  />

              {/* ── BRANCH VERTIKAL — CT KE TANK ─────────────── */}
              <PipeV 
              x={928} y={36} 
              w={9} h={411} 
              on={motorStatus["MTR-1"] || motorStatus["MTR-2"] || motorStatus["MTR-3"]}  />

              {/* ── BRANCH VERTIKAL — MTR-4 (DU-03) ──────────────────────── */}
              <PipeV x={1209} y={267} w={9} h={330} on={motorStatus["MTR-4"]} dir="up" />

              {/* ── BRANCH VERTIKAL — MTR-5 (BP-03) ──────────────────────── */}
              <PipeV x={1319} y={267} w={9} h={330} on={motorStatus["MTR-5"]} dir="up" />

              {/* ── BRANCH VERTIKAL — MTR-6 (SP-03) ──────────────────────── */}
              <PipeV x={1430} y={267} w={9} h={330} on={motorStatus["MTR-6"]} dir="up" />

              {/* ── BRANCH VERTIKAL — MTR-7 (ST-03) ──────────────────────── */}
              <PipeV x={1541} y={267} w={9} h={330} on={motorStatus["MTR-7"]} dir="up" />

              {/* ── BRANCH VERTIKAL — MTR-8 (WASHING) ────────────────────── */}
              <PipeV x={1651} y={267} w={9} h={330} on={motorStatus["MTR-8"]} dir="up" />

              {/* ── BRANCH VERTIKAL — MTR-9 (MINI LAB) ───────────────────── */}
              <PipeV x={1762} y={267} w={9} h={330} on={motorStatus["MTR-9"]} dir="up" />

              {/* ── BRANCH HORIZONTAL — DOSING ───────────────────── */}
              <PipeH x={969} y={426} w={62} h={9} on={motorStatus["MTR-9"]} dir="left" />

              {/* ── BRANCH HORIZONTAL — RAW WATER ───────────────────── */}
              <PipeH x={832} y={369} w={30} h={8} on={motorStatus["MTR-9"]} dir="left" />

              {/* ── BRANCH VERTIKAL — RAW WATER ───────────────────── */}
              <PipeV x={769} y={389} w={8} h={58} on={motorStatus["MTR-9"]} />

              {/* ── BRANCH HORIZONTAL — BLOWDOWN ───────────────────── */}
              <PipeH x={656} y={630} w={65} h={8} on={motorStatus["MTR-9"]} dir="left" />

              {/* ── BRANCH VERTIKAL — BLOWDOWN ───────────────────── */}
              <PipeV x={637} y={651} w={9} h={21} on={motorStatus["MTR-9"]} />

              {/* ── BRANCH HORIZONTAL — BLOWDOWN ───────────────────── */}
              <PipeH x={543} y={683} w={40} h={7} on={motorStatus["MTR-9"]} dir="left" />


              {/* ── LABEL SVG ───── */}

            <DeviceLabel x={183} y={105} w={110} h={80} name="FAN-1" on={motorStatus["FAN-1"]} />
            <DeviceLabel x={353} y={105} w={110} h={80} name="FAN-2" on={motorStatus["FAN-2"]} />
            <DeviceLabel x={523} y={105} w={110} h={80} name="FAN-3" on={motorStatus["FAN-3"]} />

            <DeviceLabel x={200} y={430} w={80} h={70} name="MTR-1" on={motorStatus["MTR-1"]} />
            <DeviceLabel x={368} y={430} w={80} h={70} name="MTR-2" on={motorStatus["MTR-2"]} />
            <DeviceLabel x={537} y={430} w={80} h={70} name="MTR-3" on={motorStatus["MTR-3"]} />
            <DeviceLabel x={1177} y={430} w={80} h={70} name="MTR-4" on={motorStatus["MTR-4"]} />
            <DeviceLabel x={1287} y={430} w={80} h={70} name="MTR-5" on={motorStatus["MTR-5"]} />
            <DeviceLabel x={1397} y={430} w={80} h={70} name="MTR-6" on={motorStatus["MTR-6"]} />
            <DeviceLabel x={1509} y={430} w={80} h={70} name="MTR-7" on={motorStatus["MTR-7"]} />
            <DeviceLabel x={1619} y={430} w={80} h={70} name="MTR-8" on={motorStatus["MTR-8"]} />
            <DeviceLabel x={1729} y={430} w={80} h={70} name="MTR-9" on={motorStatus["MTR-9"]} />


            {/* SENSOR INDICATOR SVG */}

            {/* INDOCATOR CT */}
            <SensorIndicator x={190} y={275} value={1.9} unit=" Bar" decimalPlaces={1}
            warningThreshold={1.5} alarmThreshold={2} w={100} h={45} />
            <SensorIndicator x={360} y={275} value={0.8} unit=" Bar" decimalPlaces={1}
            warningThreshold={1.5} alarmThreshold={2} w={100} h={45} />
            <SensorIndicator x={530} y={275} value={2} unit=" Bar" decimalPlaces={1}
            warningThreshold={1.5} alarmThreshold={2} w={100} h={45} />

            {/* INDOCATOR MTR KANAN */}
            <LabelComponent text="DU-03" x={1165} y={222} w={100} h={35} hasBorder={false} />
            <SensorIndicator x={1165} y={275} value={1.9} unit=" Bar" decimalPlaces={1}
            warningThreshold={1.5} alarmThreshold={2} w={100} h={45} />

            <LabelComponent text="BP-03" x={1278} y={222} w={100} h={35} hasBorder={false} />
            <SensorIndicator x={1278} y={275} value={1.5} unit=" Bar" decimalPlaces={1}
            warningThreshold={1.5} alarmThreshold={2} w={100} h={45} />

            <LabelComponent text="SP-03" x={1388} y={222} w={100} h={35} hasBorder={false} />
            <SensorIndicator x={1388} y={275} value={1.1} unit=" Bar" decimalPlaces={1}
            warningThreshold={1.5} alarmThreshold={2} w={100} h={45} />

            <LabelComponent text="ST-03" x={1500} y={222} w={100} h={35} hasBorder={false} />
            <SensorIndicator x={1500} y={275} value={1.9} unit=" Bar" decimalPlaces={1}
            warningThreshold={1.5} alarmThreshold={2} w={100} h={45} />

            <LabelComponent text="WASHING" x={1600} y={222} w={110} h={35} hasBorder={false} />
            <SensorIndicator x={1612} y={275} value={1.5} unit=" Bar" decimalPlaces={1}
            warningThreshold={1.5} alarmThreshold={2} w={100} h={45} />

            <LabelComponent text="MINI LAB" x={1710} y={222} w={120} h={35} hasBorder={false} />
            <SensorIndicator x={1721} y={275} value={2} unit=" Bar" decimalPlaces={1}
            warningThreshold={1.5} alarmThreshold={2} w={100} h={45} />

            {/* INDICATOR RETURN */}
            <SensorIndicator x={1165} y={155} value={31.2} unit=" °C" decimalPlaces={1}
            warningThreshold={35} alarmThreshold={40} w={100} h={45} />
            <SensorIndicator x={1278} y={155} value={36.2} unit=" °C" decimalPlaces={1}
            warningThreshold={35} alarmThreshold={40} w={100} h={45} />
            <SensorIndicator x={1388} y={155} value={40.1} unit=" °C" decimalPlaces={1}
            warningThreshold={35} alarmThreshold={40} w={100} h={45} />
            <SensorIndicator x={1500} y={155} value={28.8} unit=" °C" decimalPlaces={1}
            warningThreshold={35} alarmThreshold={40} w={100} h={45} />
            <SensorIndicator x={1612} y={155} value={29.4} unit=" °C" decimalPlaces={1}
            warningThreshold={35} alarmThreshold={40} w={100} h={45} />
            <SensorIndicator x={1721} y={155} value={32.5} unit=" °C" decimalPlaces={1}
            warningThreshold={35} alarmThreshold={40} w={100} h={45} />

            {/* INDICATOR DOSING */}
            <LabelComponent text="DOSING" x={1010} y={135} w={100} h={35} hasBorder={true} />
            <LabelComponent text="VOLUME" x={950} y={192} w={100} h={35} hasBorder={false} />
            <LabelComponent text="LEVEL" x={958} y={245} w={85} h={35} hasBorder={false} />
            <SensorIndicator x={1055} y={185} value={70} unit="%"
            warningThreshold={70} alarmThreshold={60} w={100} h={45} />
            <SensorIndicator x={1055} y={240} value={7.2} unit="" decimalPlaces={1}
            warningThreshold={7.5} alarmThreshold={7.6} w={100} h={45} />

            {/* FLOW RATE INDICATOR */}
            <LabelComponent text="RAW WATER" x={760} y={280} w={120} h={40} hasBorder={false} />
            <SensorIndicator x={785} y={385} value={20.2} unit=" m³/s" decimalPlaces={1}
             w={100} h={45} />

             {/* MAKE UP WATER INDICATOR */}
             <LabelComponent text="MAKEUP WTR" x={765} y={80} w={150} h={40} hasBorder={true} />
             <LabelComponent text="TDS" x={755} y={145} w={60} h={35} hasBorder={false} />
            <LabelComponent text="PH" x={760} y={200} w={50} h={35} hasBorder={false} />
             <SensorIndicator x={820} y={140} value={320} unit=" ppm"
            warningThreshold={300} alarmThreshold={350} w={100} h={45} />
             <SensorIndicator x={820} y={195} value={7.2} unit=" pH" decimalPlaces={1}
            warningThreshold={7.5} alarmThreshold={7.6} w={100} h={45} />

            {/* BLOWDOWN INDICATOR */}
            <LabelComponent text="BLOWDOWN" x={536} y={745} w={130} h={35} hasBorder={true} />
            <SensorIndicator x={550} y={700} value={18.3} unit=" m³/s" decimalPlaces={1}
             w={100} h={40} />

            {/* TANK INDICATOR */}

            <LevelIndicator x={742} y={250} value={92} w={70} h={150} />
            <LevelIndicator x={280} y={250} value={92} w={70} h={150} />


            <SensorIndicator x={742} y={585} value={0} unit="%"
            warningThreshold={7.5} alarmThreshold={7.6} w={100} h={45} />
            <SensorIndicator x={881} y={585} value={0} unit="%"
            warningThreshold={7.5} alarmThreshold={7.6} w={100} h={45} />

            <LabelComponent text="TDS" x={760} y={710} w={60} h={35} hasBorder={false} />
            <LabelComponent text="PH" x={905} y={710} w={50} h={35} hasBorder={false} />
            <SensorIndicator x={742} y={660} value={320} unit=" ppm"
            warningThreshold={300} alarmThreshold={350} w={100} h={45} />
            <SensorIndicator x={881} y={660} value={7.2} unit=" pH" decimalPlaces={1}
            warningThreshold={7.5} alarmThreshold={7.6} w={100} h={45} />

            {/* AMBIENT TEMP */}
            <LabelComponent text="AMBIENT TEMP" x={10} y={40} w={150} h={50} hasBorder={true} />
            <SensorIndicator x={30} y={100} value={32.5} unit=" °C" decimalPlaces={1}
            warningThreshold={35} alarmThreshold={40} w={100} h={45} />



            </svg>
          </div>
        </div>

        {DEV_MODE && (
          <p className="mt-2 text-center text-xs text-amber-400">
            🔧 DEV MODE AKTIF — klik di atas canvas untuk dapat koordinat SVG
          </p>
        )}
        </section>

        {/* Right Side Cards - Task Info & Alarms */}
        <div className="flex flex-col gap-4 lg:w-96 overflow-hidden">
          
          {/* Task Information Card */}
          <div className="flex-1 flex flex-col rounded-lg border border-slate-800 bg-slate-950/70 p-4 overflow-hidden min-h-0">
            <h3 className="text-xs uppercase tracking-[0.2em] text-slate-500 font-semibold mb-3">Task Information</h3>
            
            {/* Task Metrics - Clickable */}
            <div className="space-y-3 mb-4">
              <button
                onClick={() => setSelectedTaskFilter("open_month")}
                className={`w-full text-left flex justify-between items-center p-3 rounded border-2 transition-colors ${
                  selectedTaskFilter === "open_month"
                    ? "bg-white border-cyan-500 text-slate-900"
                    : "bg-white border-slate-300 text-slate-900 hover:border-cyan-400"
                }`}
              >
                <span className="text-xs font-medium">Task Open (Bulan Ini)</span>
                <span className={`text-lg font-semibold ${selectedTaskFilter === "open_month" ? "text-cyan-600" : "text-cyan-500"}`}>
                  {taskInfo.openThisMonth}
                </span>
              </button>
              
              <button
                onClick={() => setSelectedTaskFilter("open")}
                className={`w-full text-left flex justify-between items-center p-3 rounded border-2 transition-colors ${
                  selectedTaskFilter === "open"
                    ? "bg-white border-yellow-500 text-slate-900"
                    : "bg-white border-slate-300 text-slate-900 hover:border-yellow-400"
                }`}
              >
                <span className="text-xs font-medium">Task Open</span>
                <span className={`text-lg font-semibold ${selectedTaskFilter === "open" ? "text-yellow-600" : "text-yellow-500"}`}>
                  {taskInfo.taskOpen}
                </span>
              </button>
              
              <button
                onClick={() => setSelectedTaskFilter("close")}
                className={`w-full text-left flex justify-between items-center p-3 rounded border-2 transition-colors ${
                  selectedTaskFilter === "close"
                    ? "bg-white border-green-500 text-slate-900"
                    : "bg-white border-slate-300 text-slate-900 hover:border-green-400"
                }`}
              >
                <span className="text-xs font-medium">Task Close</span>
                <span className={`text-lg font-semibold ${selectedTaskFilter === "close" ? "text-green-600" : "text-green-500"}`}>
                  {taskInfo.taskClose}
                </span>
              </button>
            </div>

            {/* Task List - Scrollable */}
            <div className="text-xs text-slate-600 font-medium mb-2">Keterangan ({filteredTasks.length})</div>
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

          {/* Alarm Information Card */}
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