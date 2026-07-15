import { useState, useEffect } from "react";
import { useOutletContext } from "react-router-dom";
import { getUnitById } from "../../data/machines";
import type { MachineOutletContext } from "./MachineLayout";
import PidPageTemplate from "./PidPageTemplate";
import type { Task, Alarm } from "./PidPageTemplate";
import { useTelemetryStore } from "../../store/telemetry.store";
import { getJson } from "../../services/api.client";
import { telemetryTagIds } from "../../data/industrial-tags";
import CoolingWF1U3Pid from "./diagrams/CoolingWF1U3Pid";
import MachineAHU01Pid from "./diagrams/MachineAHU01Pid";
import MachineAHU02Pid from "./diagrams/MachineAHU02Pid";
import MachineAHU03Pid from "./diagrams/MachineAHU03Pid";
import MachineUtilityPid from "./diagrams/MachineUtilityPid";

// ═══════════════════════════════════════════════
// DATA TASK & ALARM PER MESIN (dummy, nanti dari API)
// ═══════════════════════════════════════════════
const machineDataMap: Record<
  string,
  { tasks: Task[]; alarms: Alarm[] }
> = {
  // Contoh untuk Cooling Water System WF1U3
  "cooling-water-1": {
    tasks: [],
    alarms: [],
  },
  // Mesin non-HVAC lainnya...
};

const defaultTemplates = [
  {
    itemKey: "FAN",
    specificKeys: ["FAN-1", "FAN-2", "FAN-3"],
    rules: [
      { targetHours: 500, task: "Check V-Belt Tension" },
      { targetHours: 500, task: "Visual Inspection" },
      { targetHours: 1000, task: "Clean Fan Blades" }
    ]
  },
  {
    itemKey: "MTR",
    specificKeys: ["MTR-1", "MTR-2", "MTR-3", "MTR-4", "MTR-5", "MTR-6", "MTR-7", "MTR-8", "MTR-9"],
    rules: [
      { targetHours: 500, task: "Strainer Inspection" },
      { targetHours: 500, task: "Pump Bearing Lubrication" },
      { targetHours: 1000, task: "Seal/Bearing Inspection" }
    ]
  },
  {
    itemKey: "Dosing Pump",
    specificKeys: ["Dosing Pump 1", "Dosing Pump 2"],
    rules: [
      { targetHours: 500, task: "Strainer Inspection" }
    ]
  },
  {
    itemKey: "Strainer",
    specificKeys: ["Strainer 1", "Strainer 2", "Strainer 3", "Strainer 4", "Strainer 5", "Strainer 6", "Strainer 7", "Strainer 8", "Strainer 9"],
    rules: [
      { targetHours: 200, task: "Check Cleanliness" },
      { targetHours: 600, task: "Clean Filter Element" }
    ]
  },
  {
    itemKey: "Cooling Tower",
    specificKeys: ["CT 1", "CT 2", "CT 3"],
    rules: [
      { targetHours: 600, task: "Basin Debris Clean" },
      { targetHours: 600, task: "Float Valve Inspection" }
    ]
  },
  {
    itemKey: "Cooling Tank",
    specificKeys: ["Cooling Tank"],
    rules: [
      { targetHours: 1000, task: "Basin Sediment Cleaning" },
      { targetHours: 1000, task: "Flushing & Corrosion Inspect" }
    ]
  },
  {
    itemKey: "Panel",
    specificKeys: ["Panel"],
    rules: [
      { targetHours: 1000, task: "Inverter Cleaning" },
      { targetHours: 1000, task: "Wiring Inspection" }
    ]
  }
];

const DEFAULT_TASK_RULES: { id: string; motorKey: string; targetHours: number; taskName: string }[] = [];
let ruleCounter = 1;
defaultTemplates.forEach((tpl) => {
  tpl.specificKeys.forEach((specKey) => {
    tpl.rules.forEach((rule) => {
      DEFAULT_TASK_RULES.push({
        id: String(ruleCounter++),
        motorKey: specKey,
        targetHours: rule.targetHours,
        taskName: `${specKey} - ${rule.task}`
      });
    });
  });
});

const MOTOR_KEY_TO_TAG_ID: Record<string, string> = {
  "FAN-1": "cooling-water/fan_status_1",
  "FAN-2": "cooling-water/fan_status_2",
  "FAN-3": "cooling-water/fan_status_3",
  "MTR-1": "cooling-water/motor_status_1",
  "MTR-2": "cooling-water/motor_status_2",
  "MTR-3": "cooling-water/motor_status_3",
  "MTR-4": "cooling-water/eq_status_du03",
  "MTR-5": "cooling-water/eq_status_bp03",
  "MTR-6": "cooling-water/eq_status_prep03",
  "MTR-7": "cooling-water/eq_status_st03",
  "MTR-8": "cooling-water/eq_status_washing",
  "MTR-9": "cooling-water/eq_status_minilab",
  "Dosing Pump 1": "cooling-water/dosing_pump_1",
  "Dosing Pump 2": "cooling-water/dosing_pump_2",
  "Strainer 1": "cooling-water/strainer_1",
  "Strainer 2": "cooling-water/strainer_2",
  "Strainer 3": "cooling-water/strainer_3",
  "Strainer 4": "cooling-water/strainer_4",
  "Strainer 5": "cooling-water/strainer_5",
  "Strainer 6": "cooling-water/strainer_6",
  "Strainer 7": "cooling-water/strainer_7",
  "Strainer 8": "cooling-water/strainer_8",
  "Strainer 9": "cooling-water/strainer_9",
  "CT 1": "cooling-water/ct_1",
  "CT 2": "cooling-water/ct_2",
  "CT 3": "cooling-water/ct_3",
  "Cooling Tank": "cooling-water/cooling_tank",
  "Panel": "cooling-water/panel"
};

// ── Data default jika unitId tidak ditemukan ────────────
const defaultData: { tasks: Task[]; alarms: Alarm[] } = {
  tasks: [],
  alarms: [],
};

// ── Mapping diagram ──────────────────────────────────────
const diagramMap: Record<string, React.ComponentType<any>> = {
  "cooling-water-1": CoolingWF1U3Pid,
  "ahu-01": MachineAHU01Pid,
  "ahu-02": MachineAHU02Pid,
  "ahu-03": MachineAHU03Pid,
  "utility": MachineUtilityPid,
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
  const [selectedTaskFilter, setSelectedTaskFilter] = useState<
    "all" | "open_month" | "open" | "close"
  >("all");

  if (!machine) return null;

  // ── Ambil task & alarm khusus untuk mesin ini ──────────
  const data = machineDataMap[unitId] ?? defaultData;
  const alarmInfo = data.alarms;

  const latest = useTelemetryStore((state) => state.latest);

  const [runningHours, setRunningHours] = useState<Record<string, number>>({});
  const [pidThresholds, setPidThresholds] = useState<any>(null);

  const [completedTaskKeys, setCompletedTaskKeys] = useState<string[]>(() => {
    const saved = localStorage.getItem("scada.config.rh.completedTasks");
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        return [];
      }
    }
    return [];
  });

  const handleToggleCompleteTask = (taskKey: string) => {
    setCompletedTaskKeys((prev) => {
      let next;
      if (prev.includes(taskKey)) {
        next = prev.filter((k) => k !== taskKey);
      } else {
        next = [...prev, taskKey];
      }
      localStorage.setItem("scada.config.rh.completedTasks", JSON.stringify(next));
      return next;
    });
  };

  const isCooling = unitId === "cooling-water-1" || unitId === "cooling-water-2" || unitId === "cooling-water-3";
  let allTasks: Task[] = [];
  if (isCooling) {
    const savedRules = localStorage.getItem("scada.config.rh.tasks");
    let rules: any[] = [];
    if (savedRules) {
      try {
        rules = JSON.parse(savedRules);
      } catch (e) {
        rules = DEFAULT_TASK_RULES;
      }
    } else {
      rules = DEFAULT_TASK_RULES;
    }

    const activeTasks: Task[] = [];
    rules.forEach((rule, idx) => {
      const tagId = MOTOR_KEY_TO_TAG_ID[rule.motorKey];
      const actualRh = runningHours[tagId] || 0;
      
      // Trigger task only when approaching target (1 week = 168 hours before target)
      const isTriggered = actualRh >= (rule.targetHours - 168);
      if (isTriggered) {
        const taskKey = `${rule.motorKey}_${rule.targetHours}_${rule.taskName}`;
        const isCompleted = completedTaskKeys.includes(taskKey);
        
        activeTasks.push({
          id: idx + 1,
          taskKey,
          title: `${rule.motorKey} (Running: ${actualRh.toFixed(1)}h) - ${rule.taskName} (Target: ${rule.targetHours}h)`,
          status: isCompleted ? "close" : "open",
          openedMonth: !isCompleted,
          createdDate: "Live Telemetry"
        });
      }
    });
    allTasks = activeTasks;
  } else {
    allTasks = data.tasks;
  }

  // 1. Fetch thresholds once on mount
  useEffect(() => {
    getJson<{ data: any }>("/config/pid-thresholds")
      .then((res) => {
        if (res && res.data) {
          setPidThresholds(res.data);
        }
      })
      .catch((err) => console.error("Failed to fetch initial threshold data:", err));
  }, []);

  // 2. Poll running hours every 15 seconds
  useEffect(() => {
    const fetchRH = async () => {
      try {
        const res = await getJson<{ data: Record<string, number> }>("/analytics/running-hours");
        if (res && res.data) {
          setRunningHours(res.data);
        }
      } catch (err) {
        console.error("Failed to fetch running hours data:", err);
      }
    };
    fetchRH();
    const rhInterval = setInterval(fetchRH, 15000);
    return () => clearInterval(rhInterval);
  }, []);

  // 3. Poll latest telemetry every 3 seconds
  useEffect(() => {
    const fetchLatestTelemetry = async () => {
      try {
        const res = await getJson<{ data: any[] }>(`/telemetry/latest?tagIds=${telemetryTagIds.join(",")}`);
        if (res && Array.isArray(res.data)) {
          const points = res.data.map((doc: any) => ({
            ts: doc.ts,
            value: doc.value,
            quality: doc.quality,
            meta: doc.meta
          }));
          useTelemetryStore.getState().addPoints(points);
        }
      } catch (err) {
        console.error("Failed to fetch latest telemetry:", err);
      }
    };
    fetchLatestTelemetry();
    const telInterval = setInterval(fetchLatestTelemetry, 3000);
    return () => clearInterval(telInterval);
  }, []);

  const getStatus = (tagId: string) => {
    const val = latest[tagId]?.value;
    if (typeof val === "number") return val === 1;
    if (typeof val === "boolean") return val;
    return "XX";
  };

  const motorStatus = {
    "FAN-1": getStatus("cooling-water/fan_status_1"),
    "FAN-2": getStatus("cooling-water/fan_status_2"),
    "FAN-3": getStatus("cooling-water/fan_status_3"),
    "MTR-1": getStatus("cooling-water/motor_status_1"),
    "MTR-2": getStatus("cooling-water/motor_status_2"),
    "MTR-3": getStatus("cooling-water/motor_status_3"),
    "MTR-4": getStatus("cooling-water/eq_status_du03"),
    "MTR-5": getStatus("cooling-water/eq_status_bp03"),
    "MTR-6": getStatus("cooling-water/eq_status_prep03"),
    "MTR-7": getStatus("cooling-water/eq_status_st03"),
    "MTR-8": getStatus("cooling-water/eq_status_washing"),
    "MTR-9": getStatus("cooling-water/eq_status_minilab"),
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
                <PidDiagram motorStatus={motorStatus} runningHours={runningHours} pidThresholds={pidThresholds} />
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
      allOn={false}
      onToggleAllOn={() => {}}
      tasks={allTasks}
      selectedTaskFilter={selectedTaskFilter}
      onFilterChange={setSelectedTaskFilter}
      taskInfo={taskInfo}
      alarms={alarmInfo}
      onToggleCompleteTask={handleToggleCompleteTask}
    >
      {PidDiagram ? (
        <PidDiagram motorStatus={motorStatus} runningHours={runningHours} pidThresholds={pidThresholds} />
      ) : (
        <div className="flex items-center justify-center h-full text-slate-400">
          Diagram untuk {unitId} belum tersedia.
        </div>
      )}
    </PidPageTemplate>
  );
}