import { useState, useEffect, useMemo } from "react";
import { PageHeader } from "../components/ui/PageHeader";
import { StatCard } from "../components/cards/StatCard";
import { getJson, postJson } from "../services/api.client";
import { useAuthStore } from "../store/auth.store";
import { getRoleDomain, isHvacUnit, isUtilityUnit, canInteractWithTask } from "../utils/roles";

const UTILITY_MACHINES = [
  { id: "cooling-water-1", label: "Cooling Water 1" },
  { id: "cooling-water-2", label: "Cooling Water 2" },
  { id: "cooling-water-3", label: "Cooling Water 3" },
  { id: "utility", label: "Utility Header" }
];

const HVAC_MACHINES = [
  { id: "ahu-01", label: "AHU-01 (QC Retained)" },
  { id: "ahu-02", label: "AHU-02 (Sterile IP)" },
  { id: "ahu-03", label: "AHU-03 (Packaging)" }
];

const UTILITY_COMPONENTS = [
  "FAN-1", "FAN-2", "FAN-3",
  "MTR-1", "MTR-2", "MTR-3", "MTR-4", "MTR-5", "MTR-6", "MTR-7", "MTR-8", "MTR-9",
  "Dosing Pump 1", "Dosing Pump 2",
  "Strainer 1", "Strainer 2", "Strainer 3", "Strainer 4", "Strainer 5", "Strainer 6", "Strainer 7", "Strainer 8", "Strainer 9",
  "CT 1", "CT 2", "CT 3",
  "Cooling Tank", "Panel"
];

const HVAC_COMPONENTS = [
  "AHU-FAN", "PRE-FILTER", "MED-FILTER", "HEPA-FILTER",
  "COOL-COIL", "HEAT-COIL", "HUMIDIFIER", "DRAIN-TRAP"
];

const MACHINE_NAME_MAP: Record<string, string> = {
  "cooling-water-1": "Cooling Water 1",
  "cooling-water-2": "Cooling Water 2",
  "cooling-water-3": "Cooling Water 3",
  "utility": "Utility Header",
  "ahu-01": "AHU-01",
  "ahu-02": "AHU-02",
  "ahu-03": "AHU-03"
};

export default function Tasks() {
  const user = useAuthStore((state) => state.user);
  const userRole = user?.role ?? "user";
  const userDomain = getRoleDomain(userRole);

  const [tasks, setTasks] = useState<any[]>([]);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [unitFilter, setUnitFilter] = useState<string>("all");
  const [componentFilter, setComponentFilter] = useState<string>("all");
  const [domainFilter, setDomainFilter] = useState<"all" | "utility" | "hvac">(
    userDomain === "utility" ? "utility" : userDomain === "hvac" ? "hvac" : "all"
  );
  
  const [dateRange, setDateRange] = useState<{ startDate: string; endDate: string }>(() => {
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth(), 1);
    const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    const formatDate = (d: Date) => d.toISOString().split("T")[0];
    return { startDate: formatDate(start), endDate: formatDate(end) };
  });

  // Effective domain considering role locks
  const activeDomain = userDomain === "utility" ? "utility" : userDomain === "hvac" ? "hvac" : domainFilter;

  // Available machines for filter
  const availableMachines = useMemo(() => {
    if (activeDomain === "utility") return UTILITY_MACHINES;
    if (activeDomain === "hvac") return HVAC_MACHINES;
    return [...UTILITY_MACHINES, ...HVAC_MACHINES];
  }, [activeDomain]);

  // Available components for filter
  const availableComponents = useMemo(() => {
    if (activeDomain === "utility") return UTILITY_COMPONENTS;
    if (activeDomain === "hvac") return HVAC_COMPONENTS;
    return [...UTILITY_COMPONENTS, ...HVAC_COMPONENTS];
  }, [activeDomain]);

  const fetchTasks = async () => {
    try {
      const query = `status=${statusFilter}&unitId=${unitFilter}&motorKey=${componentFilter}&startDate=${dateRange.startDate}&endDate=${dateRange.endDate}&domain=${activeDomain}`;
      const res = await getJson<{ data: any[] }>(`/config/rh-tasks?${query}`);
      if (res && res.data) {
        // Client-side domain safety guard
        let list = res.data;
        if (userDomain === "utility") {
          list = list.filter((t) => isUtilityUnit(t.unit_id));
        } else if (userDomain === "hvac") {
          list = list.filter((t) => isHvacUnit(t.unit_id));
        } else if (activeDomain === "utility") {
          list = list.filter((t) => isUtilityUnit(t.unit_id));
        } else if (activeDomain === "hvac") {
          list = list.filter((t) => isHvacUnit(t.unit_id));
        }
        setTasks(list);
      }
    } catch (err) {
      console.error("Failed to fetch tasks list:", err);
    }
  };

  useEffect(() => {
    fetchTasks();
  }, [statusFilter, unitFilter, componentFilter, dateRange.startDate, dateRange.endDate, activeDomain]);

  const handleCompleteTask = async (task: any) => {
    if (!canInteractWithTask(userRole, task.unit_id)) {
      alert("Akses ditolak: Anda tidak memiliki wewenang untuk menyelesaikan tugas ini.");
      return;
    }

    try {
      await postJson(`/config/rh-tasks/${task.id}/complete`, {});
      fetchTasks();
    } catch (err: any) {
      console.error("Failed to complete task:", err);
      const errMsg = err?.response?.data?.error || err?.message || "Gagal menyelesaikan tugas.";
      alert(errMsg);
    }
  };

  const overdueCount = tasks.filter((t) => t.status === "overdue").length;
  const openCount = tasks.filter((t) => t.status === "open").length;
  const closedCount = tasks.filter((t) => t.status === "close").length;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <PageHeader
          title="Task Management"
          description="Preventative maintenance running hours task records & completion logs."
        />

        {/* Domain Scope Badge / Indicator */}
        {userDomain === "utility" && (
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-blue-500/10 border border-blue-500/30 text-blue-600 dark:text-blue-400 text-xs font-bold">
            <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
            Operator Utility • Khusus Tugas Utility (No Cross-Handling)
          </div>
        )}
        {userDomain === "hvac" && (
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-cyan-500/10 border border-cyan-500/30 text-cyan-600 dark:text-cyan-400 text-xs font-bold">
            <span className="w-2 h-2 rounded-full bg-cyan-500 animate-pulse" />
            Operator HVAC • Khusus Tugas HVAC / AHU (No Cross-Handling)
          </div>
        )}
        {userDomain === "all" && (
          <div className="inline-flex items-center rounded-lg bg-slate-100 dark:bg-slate-800 p-1 border border-slate-200 dark:border-slate-700">
            <button
              type="button"
              onClick={() => {
                setDomainFilter("all");
                setUnitFilter("all");
                setComponentFilter("all");
              }}
              className={`px-3 py-1 text-xs font-bold rounded-md transition ${
                domainFilter === "all"
                  ? "bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 shadow-sm"
                  : "text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
              }`}
            >
              Semua Domain
            </button>
            <button
              type="button"
              onClick={() => {
                setDomainFilter("utility");
                setUnitFilter("all");
                setComponentFilter("all");
              }}
              className={`px-3 py-1 text-xs font-bold rounded-md transition ${
                domainFilter === "utility"
                  ? "bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 shadow-sm"
                  : "text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
              }`}
            >
              Utility Tasks
            </button>
            <button
              type="button"
              onClick={() => {
                setDomainFilter("hvac");
                setUnitFilter("all");
                setComponentFilter("all");
              }}
              className={`px-3 py-1 text-xs font-bold rounded-md transition ${
                domainFilter === "hvac"
                  ? "bg-white dark:bg-slate-900 text-cyan-600 dark:text-cyan-400 shadow-sm"
                  : "text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
              }`}
            >
              HVAC Tasks
            </button>
          </div>
        )}
      </div>

      {/* Task Summary Stat Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <StatCard
          title="Tugas Terlambat (Overdue)"
          value={String(overdueCount)}
          detail="Target limit running hours terlampaui"
        />
        <StatCard
          title="Tugas Menunggu (Open)"
          value={String(openCount)}
          detail="Mendekati limit target"
        />
        <StatCard
          title="Tugas Selesai (Completed)"
          value={String(closedCount)}
          detail="Telah terverifikasi & reset"
        />
      </div>

      {/* Filters Toolbar */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-4 shadow-[0_4px_12px_rgba(0,0,0,0.02)]">
        {/* Date Calendar Filter */}
        <div className="flex flex-col gap-1.5 col-span-1 md:col-span-2">
          <label className="text-[10px] font-bold text-slate-400 uppercase">Date Range Filter</label>
          <div className="flex items-center gap-2">
            <input
              type="date"
              value={dateRange.startDate}
              onChange={(e) => setDateRange((prev) => ({ ...prev, startDate: e.target.value }))}
              className="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded px-2.5 py-1.5 text-xs text-slate-800 dark:text-slate-200 outline-none w-full font-semibold"
            />
            <span className="text-slate-400 text-xs">to</span>
            <input
              type="date"
              value={dateRange.endDate}
              onChange={(e) => setDateRange((prev) => ({ ...prev, endDate: e.target.value }))}
              className="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded px-2.5 py-1.5 text-xs text-slate-800 dark:text-slate-200 outline-none w-full font-semibold"
            />
          </div>
        </div>

        {/* Machine select filter */}
        <div className="flex flex-col gap-1.5">
          <label className="text-[10px] font-bold text-slate-400 uppercase">
            Machine / Unit ({activeDomain === "utility" ? "Utility" : activeDomain === "hvac" ? "HVAC" : "All"})
          </label>
          <select
            value={unitFilter}
            onChange={(e) => setUnitFilter(e.target.value)}
            className="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded px-2.5 py-1.5 text-xs text-slate-800 dark:text-slate-200 outline-none font-semibold"
          >
            <option value="all">
              {activeDomain === "utility" ? "All Utility Machines" : activeDomain === "hvac" ? "All HVAC Units" : "All Machines"}
            </option>
            {availableMachines.map((m) => (
              <option key={m.id} value={m.id}>
                {m.label}
              </option>
            ))}
          </select>
        </div>

        {/* Component filter */}
        <div className="flex flex-col gap-1.5">
          <label className="text-[10px] font-bold text-slate-400 uppercase">Component</label>
          <select
            value={componentFilter}
            onChange={(e) => setComponentFilter(e.target.value)}
            className="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded px-2.5 py-1.5 text-xs text-slate-800 dark:text-slate-200 outline-none font-semibold"
          >
            <option value="all">All Components</option>
            {availableComponents.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Task List Table */}
      <div className="overflow-hidden rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 shadow-[0_4px_12px_rgba(0,0,0,0.02)]">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 dark:bg-slate-900 border-b border-slate-200 dark:border-slate-700 text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                <th className="px-5 py-3.5">ID</th>
                <th className="px-5 py-3.5">Task Description</th>
                <th className="px-5 py-3.5">Machine / Component</th>
                <th className="px-5 py-3.5">Domain</th>
                <th className="px-5 py-3.5">Trigger Baseline / Target</th>
                <th className="px-5 py-3.5">Completion Status</th>
                <th className="px-5 py-3.5">Status</th>
                <th className="px-5 py-3.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
              {tasks.length > 0 ? (
                tasks.map((task) => {
                  const baseline = parseFloat(task.trigger_base_hours);
                  const limit = baseline + parseFloat(task.target_hours);
                  const actual = parseFloat(task.actual_hours_at_trigger);
                  const ratio = Math.min((actual - baseline) / parseFloat(task.target_hours), 1);
                  const progressPct = Math.round(ratio * 100);
                  const isHvac = isHvacUnit(task.unit_id);
                  const machineLabel = MACHINE_NAME_MAP[task.unit_id] || task.unit_id;
                  const canUserAct = canInteractWithTask(userRole, task.unit_id);
                  
                  return (
                    <tr key={task.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-900/10 text-sm text-slate-700 dark:text-slate-300 transition-colors">
                      <td className="px-5 py-4 font-mono font-medium text-xs text-blue-600 dark:text-blue-400">
                        TSK-{String(task.id).padStart(3, "0")}
                      </td>
                      <td className="px-5 py-4 font-medium text-slate-900 dark:text-slate-100">
                        {task.task_name}
                      </td>
                      <td className="px-5 py-4 text-xs font-semibold text-slate-500 dark:text-slate-400">
                        <div>{machineLabel}</div>
                        <div className="text-[10px] text-slate-400 font-mono mt-0.5">{task.motor_key}</div>
                      </td>
                      <td className="px-5 py-4 text-xs">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold ${
                            isHvac
                              ? "bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 border border-cyan-500/20"
                              : "bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20"
                          }`}
                        >
                          {isHvac ? "HVAC" : "UTILITY"}
                        </span>
                      </td>
                      <td className="px-5 py-4">
                        <div className="flex flex-col gap-1 w-44">
                          <div className="flex justify-between text-xs text-slate-500 dark:text-slate-400 font-mono">
                            <span>Base: {baseline.toFixed(1)}h</span>
                            <span>Target: {limit.toFixed(1)}h</span>
                          </div>
                          <div className="h-1.5 w-full rounded-full bg-slate-100/40 dark:bg-slate-700/20 overflow-hidden">
                            <div
                              className={`h-full rounded-full ${
                                task.status === "overdue"
                                  ? "bg-rose-500"
                                  : task.status === "open"
                                  ? "bg-amber-500"
                                  : "bg-emerald-500"
                              }`}
                              style={{ width: `${progressPct}%` }}
                            />
                          </div>
                        </div>
                      </td>
                      <td className="px-5 py-4 text-xs">
                        {task.status === "close" && task.completion_status && (
                          <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold ${
                            task.completion_status === "Overdue"
                              ? "bg-red-500/10 text-red-500 border border-red-500/20"
                              : "bg-emerald-500/10 text-emerald-600 dark:text-emerald-450 border border-emerald-500/20"
                          }`}>
                            {task.completion_status === "Overdue" ? "⚠️ Overdue" : "✓ On Time"}
                          </span>
                        )}
                        {task.status !== "close" && (
                          <span className="text-slate-400 font-mono text-[10px]">—</span>
                        )}
                      </td>
                      <td className="px-5 py-4 text-xs">
                        <span
                          className={`rounded-full px-2.5 py-1 text-[10px] font-bold uppercase ${
                            task.status === "overdue"
                              ? "bg-rose-100 dark:bg-rose-950/20 text-rose-700 dark:text-rose-400"
                              : task.status === "open"
                              ? "bg-yellow-100 dark:bg-yellow-950/20 text-yellow-700 dark:text-yellow-450 animate-pulse"
                              : "bg-emerald-100 dark:bg-emerald-950/20 text-emerald-700 dark:text-emerald-450"
                          }`}
                        >
                          {task.status === "overdue" ? "Overdue" : task.status === "open" ? "Open" : "Closed"}
                        </span>
                      </td>
                      <td className="px-5 py-4 text-right">
                        {(task.status === "open" || task.status === "overdue") && (
                          canUserAct ? (
                            <button
                              type="button"
                              onClick={() => handleCompleteTask(task)}
                              className="rounded-lg bg-emerald-600 hover:bg-emerald-700 px-3 py-1.5 text-xs font-semibold text-white shadow-sm transition"
                            >
                              Done
                            </button>
                          ) : (
                            <span className="inline-block px-2.5 py-1 text-[10px] font-semibold text-slate-400 bg-slate-100 dark:bg-slate-800 rounded border border-slate-300 dark:border-slate-700 cursor-not-allowed">
                              Domain Terbatas
                            </span>
                          )
                        )}
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={8} className="px-5 py-10 text-center text-slate-400 dark:text-slate-500">
                    No preventative maintenance tasks found for this selection.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
