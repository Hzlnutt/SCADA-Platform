import { useState } from "react";
import { PageHeader } from "../components/ui/PageHeader";
import { StatCard } from "../components/cards/StatCard";
import { useTaskStore, type TaskItem } from "../store/task.store";

export default function Tasks() {
  const tasks = useTaskStore((state) => state.tasks);
  const addTask = useTaskStore((state) => state.addTask);

  const [formOpen, setFormOpen] = useState(false);
  const [newTask, setNewTask] = useState({
    title: "",
    assignedTo: "",
    runningHours: "0",
    limitHours: "100",
    priority: "Medium" as TaskItem["priority"],
    machineName: "",
    groupId: "cooling-water-system"
  });

  const pendingCount = tasks.filter((t) => t.status === "Pending").length;
  const activeCount = tasks.filter((t) => t.status === "Active").length;
  const completedCount = tasks.filter((t) => t.status === "Completed").length;

  const handleCreateTask = (e: React.FormEvent) => {
    e.preventDefault();
    addTask({
      title: newTask.title,
      assignedTo: newTask.assignedTo,
      runningHours: Number(newTask.runningHours),
      limitHours: Number(newTask.limitHours),
      status: "Pending",
      priority: newTask.priority,
      machineName: newTask.machineName,
      groupId: newTask.groupId
    });
    setFormOpen(false);
    setNewTask({
      title: "",
      assignedTo: "",
      runningHours: "0",
      limitHours: "100",
      priority: "Medium",
      machineName: "",
      groupId: "cooling-water-system"
    });
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Task Management"
        description="Daftar perintah kerja pemeliharaan pencegahan (preventive maintenance) dan status penugasan operator."
      />

      {/* Task Summary Stat Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <StatCard
          title="Tugas Menunggu (Pending)"
          value={String(pendingCount)}
          detail="Belum dikerjakan"
        />
        <StatCard
          title="Tugas Sedang Berjalan (Active)"
          value={String(activeCount)}
          detail="Dalam proses pengerjaan"
        />
        <StatCard
          title="Tugas Selesai (Completed)"
          value={String(completedCount)}
          detail="Terverifikasi oleh supervisor"
        />
      </div>

      {/* Action panel */}
      <div className="flex justify-between items-center bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-4 shadow-[0_4px_12px_rgba(0,0,0,0.02)]">
        <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
          Work Orders ({tasks.length} total)
        </span>
        <button
          type="button"
          onClick={() => setFormOpen(true)}
          className="rounded-lg bg-blue-600 hover:bg-blue-700 px-4 py-2 text-xs font-semibold text-white shadow-sm transition"
        >
          Create Work Order
        </button>
      </div>

      {/* Task List Table */}
      <div className="overflow-hidden rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 shadow-[0_4px_12px_rgba(0,0,0,0.02)]">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 dark:bg-slate-900 border-b border-slate-200 dark:border-slate-700 text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                <th className="px-5 py-3.5">ID</th>
                <th className="px-5 py-3.5">Task Description</th>
                <th className="px-5 py-3.5">Machine</th>
                <th className="px-5 py-3.5">Running Hours / Target</th>
                <th className="px-5 py-3.5">Assigned Operator</th>
                <th className="px-5 py-3.5">Priority</th>
                <th className="px-5 py-3.5">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
              {tasks.map((task) => {
                const ratio = Math.min(task.runningHours / task.limitHours, 1);
                const progressPct = Math.round(ratio * 100);
                
                return (
                  <tr key={task.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-900/10 text-sm text-slate-700 dark:text-slate-300 transition-colors">
                    <td className="px-5 py-4 font-mono font-medium text-xs text-blue-600 dark:text-blue-400">
                      {task.id}
                    </td>
                    <td className="px-5 py-4 font-medium text-slate-900 dark:text-slate-100">
                      {task.title}
                    </td>
                    <td className="px-5 py-4 text-xs text-slate-500 dark:text-slate-400">
                      {task.machineName}
                    </td>
                    <td className="px-5 py-4">
                      <div className="flex flex-col gap-1 w-44">
                        <div className="flex justify-between text-xs text-slate-500 dark:text-slate-400 font-mono">
                          <span>{task.runningHours}h</span>
                          <span>{task.limitHours}h</span>
                        </div>
                        {/* Task Progress Bar: Unfilled track is very faint, inner filled bar remains */}
                        <div className="h-1.5 w-full rounded-full bg-slate-100/40 dark:bg-slate-700/20 overflow-hidden">
                          <div
                            className={`h-full rounded-full ${
                              progressPct >= 90
                                ? "bg-rose-500"
                                : progressPct >= 75
                                ? "bg-amber-500"
                                : "bg-emerald-500"
                            }`}
                            style={{ width: `${progressPct}%` }}
                          />
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-4 text-xs text-slate-600 dark:text-slate-400">
                      {task.assignedTo}
                    </td>
                    <td className="px-5 py-4 text-xs">
                      <span
                        className={`rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider ${
                          task.priority === "Critical"
                            ? "bg-rose-100 dark:bg-rose-950/30 text-rose-700 dark:text-rose-400 border border-rose-200 dark:border-rose-900/50"
                            : task.priority === "High"
                            ? "bg-amber-100 dark:bg-amber-950/30 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-900/50"
                            : task.priority === "Medium"
                            ? "bg-blue-100 dark:bg-blue-950/30 text-blue-700 dark:text-blue-400 border border-blue-200 dark:border-blue-900/50"
                            : "bg-slate-100 dark:bg-slate-900/50 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700"
                        }`}
                      >
                        {task.priority}
                      </span>
                    </td>
                    <td className="px-5 py-4 text-xs">
                      <span
                        className={`rounded-full px-2.5 py-1 text-[10px] font-bold uppercase ${
                          task.status === "Completed"
                            ? "bg-emerald-100 dark:bg-emerald-950/20 text-emerald-700 dark:text-emerald-400"
                            : task.status === "Active"
                            ? "bg-sky-100 dark:bg-sky-950/20 text-sky-700 dark:text-sky-400 animate-pulse"
                            : "bg-slate-100 dark:bg-slate-900 text-slate-500 dark:text-slate-400"
                        }`}
                      >
                        {task.status}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Task Creation Modal: Support Dark Mode */}
      {formOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-6 backdrop-blur-sm">
          <div className="relative w-full max-w-lg rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-6 shadow-2xl transition">
            <div className="flex items-center justify-between pb-4 border-b border-slate-200 dark:border-slate-700">
              <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">
                Create New Work Order
              </h3>
              <button
                type="button"
                onClick={() => setFormOpen(false)}
                className="rounded-lg p-1 text-slate-400 hover:text-slate-500 dark:hover:text-slate-300"
              >
                ✕
              </button>
            </div>
            <form onSubmit={handleCreateTask} className="mt-4 space-y-4">
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-400">
                Task Description
                <input
                  type="text"
                  value={newTask.title}
                  onChange={(e) => setNewTask((p) => ({ ...p, title: e.target.value }))}
                  className="mt-2 w-full rounded-md border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 px-3 py-2 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  required
                />
              </label>

              <label className="block text-xs font-medium text-slate-600 dark:text-slate-400">
                Machine / Equipment
                <input
                  type="text"
                  value={newTask.machineName}
                  onChange={(e) => setNewTask((p) => ({ ...p, machineName: e.target.value }))}
                  className="mt-2 w-full rounded-md border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 px-3 py-2 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  placeholder="e.g. Boiler-3"
                  required
                />
              </label>

              <label className="block text-xs font-medium text-slate-600 dark:text-slate-400">
                Machine Group / Area
                <select
                  value={newTask.groupId}
                  onChange={(e) => setNewTask((p) => ({ ...p, groupId: e.target.value }))}
                  className="mt-2 w-full rounded-md border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 px-3 py-2 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-blue-500"
                >
                  <option value="cooling-water-system">Cooling Water System</option>
                  <option value="boiler-plant">Boiler Plant</option>
                  <option value="water-treatment">Water Treatment</option>
                  <option value="compressor-house">Compressor House</option>
                  <option value="chiller-system">Chiller System</option>
                  <option value="distillate-unit">Distillate Unit</option>
                  <option value="purified-water-loop">Purified Water Loop</option>
                  <option value="pure-steam-generator">Pure Steam Generator</option>
                  <option value="wfi-loop">WFI Loop</option>
                  <option value="compressed-air">Compressed Air</option>
                  <option value="hvac">HVAC</option>
                </select>
              </label>

              <div className="grid gap-4 grid-cols-2">
                <label className="block text-xs font-medium text-slate-600 dark:text-slate-400">
                  Assigned Operator
                  <input
                    type="text"
                    value={newTask.assignedTo}
                    onChange={(e) => setNewTask((p) => ({ ...p, assignedTo: e.target.value }))}
                    className="mt-2 w-full rounded-md border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 px-3 py-2 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-blue-500"
                    required
                  />
                </label>
                <label className="block text-xs font-medium text-slate-600 dark:text-slate-400">
                  Priority
                  <select
                    value={newTask.priority}
                    onChange={(e) => setNewTask((p) => ({ ...p, priority: e.target.value as TaskItem["priority"] }))}
                    className="mt-2 w-full rounded-md border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 px-3 py-2 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  >
                    <option value="Low">Low</option>
                    <option value="Medium">Medium</option>
                    <option value="High">High</option>
                    <option value="Critical">Critical</option>
                  </select>
                </label>
              </div>

              <div className="grid gap-4 grid-cols-2">
                <label className="block text-xs font-medium text-slate-600 dark:text-slate-400">
                  Current Running Hours
                  <input
                    type="number"
                    value={newTask.runningHours}
                    onChange={(e) => setNewTask((p) => ({ ...p, runningHours: e.target.value }))}
                    className="mt-2 w-full rounded-md border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 px-3 py-2 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-blue-500"
                    min="0"
                    required
                  />
                </label>
                <label className="block text-xs font-medium text-slate-600 dark:text-slate-400">
                  Limit/Target Hours
                  <input
                    type="number"
                    value={newTask.limitHours}
                    onChange={(e) => setNewTask((p) => ({ ...p, limitHours: e.target.value }))}
                    className="mt-2 w-full rounded-md border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 px-3 py-2 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-blue-500"
                    min="1"
                    required
                  />
                </label>
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-slate-200 dark:border-slate-700">
                <button
                  type="button"
                  onClick={() => setFormOpen(false)}
                  className="rounded-lg border border-slate-300 dark:border-slate-600 px-4 py-2 text-xs font-semibold text-slate-700 dark:text-slate-300 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="rounded-lg bg-blue-600 hover:bg-blue-700 px-4 py-2 text-xs font-semibold text-white shadow-sm transition"
                >
                  Save Work Order
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
