import { useState } from "react";
import { useOutletContext } from "react-router-dom";
import { getUnitById } from "../../data/machines";
import type { MachineOutletContext } from "./MachineLayout";
import PidPageTemplate from "./PidPageTemplate";
import type { Task, Alarm } from "./PidPageTemplate";
import CoolingWF1U3Pid from "./diagrams/CoolingWF1U3Pid";
import MachineAHU01 from "./diagrams/MachineAHU01";
import MachineAHU02 from "./diagrams/MachineAHU02";
import MachineAHU03 from "./diagrams/MachineAHU03";
import MachineUtility from "./diagrams/MachineUtility";

// ═══════════════════════════════════════════════
// DATA TASK & ALARM PER MESIN (dummy, nanti dari API)
// ═══════════════════════════════════════════════
const machineDataMap: Record<
  string,
  { tasks: Task[]; alarms: Alarm[] }
> = {
  // Contoh untuk Cooling Water System WF1U3
  "cooling-water-1": {
    tasks: [
      { id: 1, title: "Inspeksi Motor MTR-1", status: "open", openedMonth: true, createdDate: "2026-06-01" },
      { id: 2, title: "Calibration PT-01", status: "open", openedMonth: true, createdDate: "2026-06-02" },
      // ... (sisa data dummy tasks)
    ],
    alarms: [
      { id: 1, code: "ALM-001", message: "High temperature detected at CT-01", severity: "warning" },
      // ... (sisa data dummy alarms)
    ],
  },
  // Mesin non-HVAC lainnya...
};

// ── Data default jika unitId tidak ditemukan ────────────
const defaultData: { tasks: Task[]; alarms: Alarm[] } = {
  tasks: [],
  alarms: [],
};

// ── Mapping diagram ──────────────────────────────────────
const diagramMap: Record<string, React.ComponentType<any>> = {
  "cooling-water-1": CoolingWF1U3Pid,
  "ahu-01": MachineAHU01,
  // "chiller-1": ChillerPid,
};

function selectPidDiagram(unitId: string) {
  if (diagramMap[unitId]) return diagramMap[unitId];
  const matchedKey = Object.keys(diagramMap).find((key) =>
    unitId.startsWith(key)
  );
  if (matchedKey) return diagramMap[matchedKey];
  return null;
}

// ═══════════════════════════════════════════════
// HELPER: Cek Apakah Mesin HVAC Target
// ═══════════════════════════════════════════════
const isHvacTarget = (unitId: string) => {
  return unitId === "hvac-qc-retained-sample" || unitId === "hvac-wh-3"; // Tambahkan unit HVAC lain di sini
};

// ═══════════════════════════════════════════════
// KOMPONEN UTAMA
// ═══════════════════════════════════════════════
export default function MachinePidDiagram() {
  const { unitId } = useOutletContext<MachineOutletContext>();
  const machine = getUnitById(unitId);
  const [allOn, setAllOn] = useState(false);
  const [selectedTaskFilter, setSelectedTaskFilter] = useState<
    "all" | "open_month" | "open" | "close"
  >("all");

  if (!machine) return null;

  // ── Ambil task & alarm khusus untuk mesin ini ──────────
  const data = machineDataMap[unitId] ?? defaultData;
  const { tasks: allTasks, alarms: alarmInfo } = data;

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

  const taskInfo = {
    openThisMonth: allTasks.filter(
      (t) => t.openedMonth && t.status === "open"
    ).length,
    taskOpen: allTasks.filter((t) => t.status === "open").length,
    taskClose: allTasks.filter((t) => t.status === "close").length,
  };

  const PidDiagram = selectPidDiagram(unitId);

  // ── KONDISI KHUSUS UNTUK HVAC ──────────────────────────
  if (isHvacTarget(unitId)) {
    // Layout Baru Sesuai Screenshot HVAC
    return (
      <div className="flex flex-col h-full w-full gap-4 p-2">
        {/* 1. TOP BAR: Room Info (Card 1) */}
        <div className="flex justify-between items-start bg-[#1e293b] border border-slate-600 p-4 rounded-lg shadow-sm">
          <div>
            <h2 className="text-xl font-bold text-white">Room Name : {machine.name}</h2>
            <p className="text-lg text-slate-300">ACCELERATED STABILITY ROOM</p>
            <div className="text-sm text-cyan-400 mt-1">
              Target: 38°C ± 2°C | 75%RH ± 5%
            </div>
          </div>
          <div className="flex flex-col items-end gap-1">
            <div className="flex items-center gap-2">
              <span className="text-slate-400 text-sm font-mono">MODE</span>
              <span className="text-cyan-400 font-semibold font-mono">Auto</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-slate-400 text-sm font-mono">STATUS</span>
              <span className="text-green-400 font-semibold font-mono">Running</span>
            </div>
          </div>
        </div>

        {/* 2. MAIN AREA: P&ID & SIDEBAR */}
        <div className="flex gap-4 flex-1 min-h-0">
          
          {/* P&ID Canvas (Card 2) */}
          <div className="flex-1 rounded-lg border border-slate-600 bg-slate-900/70 relative overflow-hidden">
            <div className="absolute inset-0 overflow-auto">
              {PidDiagram ? (
                <PidDiagram motorStatus={motorStatus} />
              ) : (
                <div className="flex items-center justify-center h-full text-slate-400">
                  Diagram untuk {machine.name} belum tersedia.
                </div>
              )}
            </div>
          </div>

          {/* RIGHT SIDEBAR */}
          <div className="w-80 flex flex-col gap-2 h-full">
            
            {/* 3. SYSTEM MODE */}
            <div className="flex-1 border border-slate-600 rounded-lg bg-[#1e293b] p-4 flex flex-col gap-2 min-h-[150px]">
              <h3 className="text-white font-bold font-mono border-b border-slate-600 pb-2 mb-2">SYSTEM MODE</h3>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between"><span className="text-slate-400">Operating Mode</span><span className="text-cyan-400 font-semibold">Auto</span></div>
                <div className="flex justify-between"><span className="text-slate-400">Fan Status</span><span className="text-green-400 font-semibold">Running</span></div>
                <div className="flex justify-between"><span className="text-slate-400">Electric Heater</span><span className="text-green-400 font-semibold">On</span></div>
                <div className="flex justify-between"><span className="text-slate-400">Humidity Fan</span><span className="text-green-400 font-semibold">Running</span></div>
                <div className="flex justify-between"><span className="text-slate-400">Utility Status</span><span className="text-green-400 font-semibold">On</span></div>
              </div>
            </div>

            {/* 4. SETPOINTS */}
            <div className="flex-1 border border-slate-600 rounded-lg bg-[#1e293b] p-4 flex flex-col gap-2 min-h-[150px]">
              <h3 className="text-white font-bold font-mono border-b border-slate-600 pb-2 mb-2">SETPOINTS</h3>
              <div className="space-y-3 mt-2">
                <div>
                  <div className="flex justify-between text-xs font-mono"><span className="text-slate-400">Temperature SP</span><span className="text-white">46.8°C</span></div>
                  <input type="range" className="w-full h-1 bg-slate-700 rounded appearance-none mt-1" />
                </div>
                <div>
                  <div className="flex justify-between text-xs font-mono"><span className="text-slate-400">Humidity SP</span><span className="text-white">75.0%RH</span></div>
                  <input type="range" className="w-full h-1 bg-slate-700 rounded appearance-none mt-1" />
                </div>
              </div>
            </div>

            {/* 5. CONTROL PANEL */}
            <div className="flex-1 border border-slate-600 rounded-lg bg-[#1e293b] p-4 flex flex-col gap-2 min-h-[150px]">
              <h3 className="text-white font-bold font-mono border-b border-slate-600 pb-2 mb-2">CONTROL PANEL</h3>
              <div className="grid grid-cols-2 gap-2 mt-2">
                <button className="p-2 rounded bg-cyan-800/40 text-cyan-400 text-xs font-bold hover:bg-cyan-800/60 border border-cyan-800/50">START AHU</button>
                <button className="p-2 rounded bg-red-900/40 text-red-400 text-xs font-bold hover:bg-red-900/60 border border-red-900/50">STOP AHU</button>
                <button className="p-2 rounded bg-blue-900/40 text-blue-400 text-xs font-bold hover:bg-blue-900/60 border border-blue-900/50">MAINTENANCE</button>
                <button className="p-2 rounded bg-slate-700/40 text-slate-400 text-xs font-bold hover:bg-slate-700/60 border border-slate-700/50">CALIBRATION</button>
              </div>
            </div>

          </div>
        </div>
      </div>
    );
  }

  // ── LAYOUT STANDAR (NON-HVAC) ──────────────────────────
  return (
    <PidPageTemplate
      machineName={machine.name}
      allOn={allOn}
      onToggleAllOn={() => setAllOn((v) => !v)}
      tasks={allTasks}
      selectedTaskFilter={selectedTaskFilter}
      onFilterChange={setSelectedTaskFilter}
      taskInfo={taskInfo}
      alarms={alarmInfo}
    >
      {PidDiagram ? (
        <PidDiagram motorStatus={motorStatus} />
      ) : (
        <div className="flex items-center justify-center h-full text-slate-400">
          Diagram untuk {unitId} belum tersedia.
        </div>
      )}
    </PidPageTemplate>
  );
}