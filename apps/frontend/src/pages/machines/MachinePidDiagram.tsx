import { useState } from "react";
import { useOutletContext } from "react-router-dom";
import { getUnitById } from "../../data/machines";
import type { MachineOutletContext } from "./MachineLayout";
import PidPageTemplate from "./PidPageTemplate";
import type { Task, Alarm } from "./PidPageTemplate";
import CoolingWF1U3Pid from "./diagrams/CoolingWF1U3Pid";
// import ChillerPid from "./diagrams/ChillerPid";  // nanti

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
    ],
    alarms: [
      { id: 1, code: "ALM-001", message: "High temperature detected at CT-01", severity: "warning" },
      { id: 2, code: "ALM-002", message: "Low pressure at MTR-4", severity: "critical" },
      { id: 3, code: "ALM-004", message: "Pump vibration exceeds threshold", severity: "critical" },
      { id: 4, code: "ALM-005", message: "Cooling tower fan bearing temperature high", severity: "warning" },
      { id: 5, code: "ALM-007", message: "Water TDS level abnormal", severity: "warning" },
    ],
  },

  // ── Contoh mesin kedua ───────────────────────────────
  "chiller-1": {
    tasks: [
      { id: 1, title: "Inspeksi Chiller CH-01", status: "open", openedMonth: true, createdDate: "2026-06-03" },
      { id: 2, title: "Check Refrigerant Level", status: "close", openedMonth: false, createdDate: "2026-06-10" },
    ],
    alarms: [
      { id: 1, code: "ALM-101", message: "Chiller high pressure", severity: "critical" },
    ],
  },
};

// ── Data default jika unitId tidak ditemukan ────────────
const defaultData: { tasks: Task[]; alarms: Alarm[] } = {
  tasks: [],
  alarms: [],
};

// ── Mapping diagram ──────────────────────────────────────
const diagramMap: Record<string, React.ComponentType<any>> = {
  "cooling-water-1": CoolingWF1U3Pid,
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