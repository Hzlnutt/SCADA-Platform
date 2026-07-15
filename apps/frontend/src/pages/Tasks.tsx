import { useState, useEffect } from "react";
import { PageHeader } from "../components/ui/PageHeader";
import { StatCard } from "../components/cards/StatCard";
import { getJson, postJson } from "../services/api.client";

export default function Tasks() {
  const [tasks, setTasks] = useState<any[]>([]);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [unitFilter, setUnitFilter] = useState<string>("all");
  const [componentFilter, setComponentFilter] = useState<string>("all");
  
  const [dateRange, setDateRange] = useState<{ startDate: string; endDate: string }>(() => {
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth(), 1);
    const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    const formatDate = (d: Date) => d.toISOString().split("T")[0];
    return { startDate: formatDate(start), endDate: formatDate(end) };
  });

  const fetchTasks = async () => {
    try {
      const query = `status=${statusFilter}&unitId=${unitFilter}&motorKey=${componentFilter}&startDate=${dateRange.startDate}&endDate=${dateRange.endDate}`;
      const res = await getJson<{ data: any[] }>(`/config/rh-tasks?${query}`);
      if (res && res.data) {
        setTasks(res.data);
      }
    } catch (err) {
      console.error("Failed to fetch tasks list:", err);
    }
  };

  useEffect(() => {
    fetchTasks();
  }, [statusFilter, unitFilter, componentFilter, dateRange.startDate, dateRange.endDate]);

  const handleCompleteTask = async (taskId: number) => {
    try {
      await postJson(`/config/rh-tasks/${taskId}/complete`, {});
      fetchTasks();
    } catch (err) {
      console.error("Failed to complete task:", err);
    }
  };

  const overdueCount = tasks.filter((t) => t.status === "overdue").length;
  const openCount = tasks.filter((t) => t.status === "open").length;
  const closedCount = tasks.filter((t) => t.status === "close").length;

  const ALL_COMPONENTS = [
    "FAN-1", "FAN-2", "FAN-3",
    "MTR-1", "MTR-2", "MTR-3", "MTR-4", "MTR-5", "MTR-6", "MTR-7", "MTR-8", "MTR-9",
    "Dosing Pump 1", "Dosing Pump 2",
    "Strainer 1", "Strainer 2", "Strainer 3", "Strainer 4", "Strainer 5", "Strainer 6", "Strainer 7", "Strainer 8", "Strainer 9",
    "CT 1", "CT 2", "CT 3",
    "Cooling Tank", "Panel"
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Task Management"
        description="Preventative maintenance running hours task records & completion logs."
      />

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
          <label className="text-[10px] font-bold text-slate-400 uppercase">Machine / Unit</label>
          <select
            value={unitFilter}
            onChange={(e) => setUnitFilter(e.target.value)}
            className="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded px-2.5 py-1.5 text-xs text-slate-800 dark:text-slate-200 outline-none font-semibold"
          >
            <option value="all">All Machines</option>
            <option value="cooling-water-1">Cooling Water 1</option>
            <option value="cooling-water-2">Cooling Water 2</option>
            <option value="cooling-water-3">Cooling Water 3</option>
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
            {ALL_COMPONENTS.map((c) => (
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
                  
                  return (
                    <tr key={task.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-900/10 text-sm text-slate-700 dark:text-slate-300 transition-colors">
                      <td className="px-5 py-4 font-mono font-medium text-xs text-blue-600 dark:text-blue-400">
                        TSK-{String(task.id).padStart(3, "0")}
                      </td>
                      <td className="px-5 py-4 font-medium text-slate-900 dark:text-slate-100">
                        {task.task_name}
                      </td>
                      <td className="px-5 py-4 text-xs font-semibold text-slate-500 dark:text-slate-400">
                        <div>{task.unit_id === "cooling-water-1" ? "Cooling Water 1" : task.unit_id === "cooling-water-2" ? "Cooling Water 2" : "Cooling Water 3"}</div>
                        <div className="text-[10px] text-slate-400 font-mono mt-0.5">{task.motor_key}</div>
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
                          <button
                            type="button"
                            onClick={() => handleCompleteTask(task.id)}
                            className="rounded-lg bg-emerald-600 hover:bg-emerald-700 px-3 py-1.5 text-xs font-semibold text-white shadow-sm transition"
                          >
                            Done
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={7} className="px-5 py-10 text-center text-slate-400 dark:text-slate-500">
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
