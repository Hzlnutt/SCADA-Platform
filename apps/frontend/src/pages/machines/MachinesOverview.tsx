import { useMemo } from "react";
import { Link } from "react-router-dom";
import { PageHeader } from "../../components/ui/PageHeader";
import { machineGroups } from "../../data/machines";
import { useAlarmStore } from "../../store/alarm.store";
import { useTaskStore } from "../../store/task.store";

const getGroupStats = (groupId: string) => {
  switch (groupId) {
    case "cooling-water-system":
      return { electricity: 2450, gas: 0, water: 340, performance: 94.2 };
    case "boiler-plant":
      return { electricity: 1890, gas: 4120, water: 580, performance: 92.5 };
    case "water-treatment":
      return { electricity: 980, gas: 0, water: 1200, performance: 96.8 };
    case "compressor-house":
      return { electricity: 3120, gas: 0, water: 0, performance: 95.1 };
    case "chiller-system":
      return { electricity: 5450, gas: 0, water: 120, performance: 93.4 };
    case "distillate-unit":
      return { electricity: 850, gas: 1200, water: 450, performance: 97.2 };
    case "purified-water-loop":
      return { electricity: 1100, gas: 0, water: 890, performance: 98.0 };
    case "pure-steam-generator":
      return { electricity: 600, gas: 850, water: 210, performance: 95.6 };
    case "wfi-loop":
      return { electricity: 1450, gas: 0, water: 620, performance: 98.4 };
    case "compressed-air":
      return { electricity: 4200, gas: 0, water: 0, performance: 94.8 };
    case "hvac-qc":
      return { electricity: 1450, gas: 0, water: 0, performance: 97.4 };
    case "hvac-warehouse":
      return { electricity: 2120, gas: 0, water: 0, performance: 95.8 };
    case "hvac-wf1u3":
      return { electricity: 2600, gas: 0, water: 0, performance: 96.2 };
    case "hvac-wf2u1":
      return { electricity: 3450, gas: 0, water: 0, performance: 94.7 };
    case "hvac-wf2u2":
      return { electricity: 2800, gas: 0, water: 0, performance: 95.5 };
    default:
      return { electricity: 1200, gas: 0, water: 0, performance: 95.0 };
  }
};

export default function MachinesOverview() {
  const activeAlarms = useAlarmStore((state) => state.activeList);
  const tasks = useTaskStore((state) => state.tasks);

  const utilityGroups = useMemo(
    () => machineGroups.filter((g) => g.area !== "HVAC"),
    []
  );
  const hvacWwtpGroups = useMemo(
    () => machineGroups.filter((g) => g.area === "HVAC"),
    []
  );

  const renderGroupCard = (group: any) => {
    const stats = getGroupStats(group.id);
    const groupUnitTags = new Set(group.units.map((u: any) => u.tagId));
    const groupAlarms = activeAlarms.filter((alarm) => groupUnitTags.has(alarm.tagId));
    const groupTasks = tasks.filter(
      (task) => task.groupId === group.id && task.status !== "Completed"
    );

    return (
      <Link
        key={group.id}
        to={`/machines/${group.id}`}
        className="group rounded-xl border border-[#acd3ff] dark:border-slate-800 bg-white dark:bg-slate-950 p-5 shadow-[0_10px_28px_rgba(31,111,181,0.04)] transition hover:-translate-y-0.5 hover:border-[#7fb3e4] hover:shadow-md flex flex-col justify-between"
      >
        <div className="space-y-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="text-[10px] font-extrabold uppercase tracking-[0.2em] text-[#1f6fb5] dark:text-sky-400">
                {group.area}
              </div>
              <div className="mt-1 text-sm font-bold text-[#002b5c] dark:text-slate-100 group-hover:text-[#1f6fb5] transition-colors">
                {group.name}
              </div>
              <div className="text-[10px] text-[#47729f] dark:text-slate-400">
                {group.category} · {group.units.length} unit{group.units.length !== 1 ? "s" : ""}
              </div>
            </div>
            <div className="rounded-full border border-[#acd3ff] dark:border-slate-700 bg-[#e8f3ff]/50 dark:bg-slate-800 px-2.5 py-1 text-[10px] font-bold text-[#003b75] dark:text-slate-200 transition group-hover:bg-[#1f6fb5] group-hover:text-white group-hover:border-transparent">
              View Detail
            </div>
          </div>

          {/* Stats grid */}
          <div className="grid grid-cols-2 gap-2 text-[11px] font-medium text-slate-500">
            <div className="p-2 bg-slate-50 dark:bg-slate-900/40 rounded-lg border border-slate-100 dark:border-slate-900/60">
              <span className="text-[9px] uppercase tracking-wider text-slate-400 block">Electricity</span>
              <span className="font-bold font-mono text-slate-800 dark:text-slate-200">
                {stats.electricity.toLocaleString()} kWh
              </span>
            </div>
            <div className="p-2 bg-slate-50 dark:bg-slate-900/40 rounded-lg border border-slate-100 dark:border-slate-900/60">
              <span className="text-[9px] uppercase tracking-wider text-slate-400 block">Gas</span>
              <span className="font-bold font-mono text-slate-800 dark:text-slate-200">
                {stats.gas > 0 ? `${stats.gas.toLocaleString()} Sm³` : "—"}
              </span>
            </div>
            <div className="p-2 bg-slate-50 dark:bg-slate-900/40 rounded-lg border border-slate-100 dark:border-slate-900/60">
              <span className="text-[9px] uppercase tracking-wider text-slate-400 block">Water</span>
              <span className="font-bold font-mono text-slate-800 dark:text-slate-200">
                {stats.water > 0 ? `${stats.water.toLocaleString()} m³` : "—"}
              </span>
            </div>
            <div className="p-2 bg-slate-50 dark:bg-slate-900/40 rounded-lg border border-slate-100 dark:border-slate-900/60">
              <span className="text-[9px] uppercase tracking-wider text-slate-400 block">Performance</span>
              <span className="font-bold font-mono text-emerald-500">{stats.performance.toFixed(1)}%</span>
            </div>
          </div>
        </div>

        {/* Alarms & Tasks Row */}
        <div className="mt-3.5 pt-3 border-t border-slate-100 dark:border-slate-900 flex justify-between gap-4 text-[10px]">
          <div className="flex items-center gap-1.5 font-bold">
            <span
              className={`w-2 h-2 rounded-full ${
                groupAlarms.length > 0 ? "bg-rose-500 animate-pulse" : "bg-emerald-500"
              }`}
            />
            <span className={groupAlarms.length > 0 ? "text-rose-500" : "text-slate-400"}>
              {groupAlarms.length > 0 ? `${groupAlarms.length} Active Alarms` : "No Alarms"}
            </span>
          </div>
          <div className="flex items-center gap-1.5 font-bold text-slate-400">
            <span className="w-2 h-2 rounded-full bg-blue-500" />
            <span>{groupTasks.length > 0 ? `${groupTasks.length} Pending Tasks` : "All Tasks Done"}</span>
          </div>
        </div>
      </Link>
    );
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Machines Overview"
        description="Unified status of telemetry and quick access to department machines."
      />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Column 1: Utility Machines */}
        <div className="space-y-4">
          <h3 className="text-xs font-bold text-[#002b5c] dark:text-slate-100 uppercase tracking-widest border-b border-[#acd3ff]/30 pb-2">
            Utility Department ({utilityGroups.length})
          </h3>
          <div className="grid gap-4 grid-cols-1 sm:grid-cols-2">
            {utilityGroups.map((group) => renderGroupCard(group))}
          </div>
        </div>

        {/* Column 2: HVAC & WWTP */}
        <div className="space-y-4">
          <h3 className="text-xs font-bold text-[#002b5c] dark:text-slate-100 uppercase tracking-widest border-b border-[#acd3ff]/30 pb-2">
            HVAC & WWTP Departments
          </h3>
          <div className="grid gap-4 grid-cols-1 sm:grid-cols-2">
            {hvacWwtpGroups.map((group) => renderGroupCard(group))}
            {/* WWTP Coming Soon Card */}
            <div className="rounded-xl border border-dashed border-[#acd3ff] dark:border-slate-800 bg-[#f7fbff]/30 dark:bg-slate-900/10 p-5 flex flex-col items-center justify-center text-center opacity-70">
              <svg className="h-8 w-8 text-[#47729f]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              <h4 className="mt-2 text-xs font-bold text-[#002b5c] dark:text-slate-300 uppercase tracking-wide">
                Waste Water Treatment (WWTP)
              </h4>
              <p className="mt-1 text-[10px] text-slate-400">PLC integration scheduled for next phase</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
