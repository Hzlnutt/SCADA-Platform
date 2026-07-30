import { useEffect, useState, useCallback, useMemo } from "react";
import { useParams, useOutletContext } from "react-router-dom";
import { getJson, postJson } from "../../services/api.client";
import { verifyPassword } from "../../services/auth.service";
import type { MachineOutletContext } from "./MachineLayout";

interface Task {
  id: number;
  title: string;
  status: "open" | "close" | "overdue";
  openedMonth: boolean;
  createdDate: string;
  taskKey?: string;
  completionStatus?: string;
  completedBy?: string;
  completedAt?: string;
  createdAt?: string;
}

const ALL_COMPONENTS = [
  "FAN-1", "FAN-2", "FAN-3",
  "MTR-1", "MTR-2", "MTR-3", "MTR-4", "MTR-5", "MTR-6", "MTR-7", "MTR-8", "MTR-9",
  "Dosing Pump 1", "Dosing Pump 2",
  "Strainer 1", "Strainer 2", "Strainer 3", "Strainer 4", "Strainer 5", "Strainer 6", "Strainer 7", "Strainer 8", "Strainer 9",
  "CT 1", "CT 2", "CT 3",
  "Cooling Tank", "Panel"
];

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

export default function MachineTasks() {
  const { unitId } = useOutletContext<MachineOutletContext>();
  const [dbTasks, setDbTasks] = useState<any[]>([]);
  const [runningHours, setRunningHours] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);

  // Filters State
  const [dateRange, setDateRange] = useState<{ startDate: string; endDate: string }>(() => {
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth(), 1);
    const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    const formatDate = (d: Date) => d.toISOString().split("T")[0];
    return { startDate: formatDate(start), endDate: formatDate(end) };
  });
  const [componentFilter, setComponentFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<"all" | "overdue" | "open" | "close">("all");

  // Password confirmation state
  const [pendingTaskKey, setPendingTaskKey] = useState<string | null>(null);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [verifyPasswordInput, setVerifyPasswordInput] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [isVerifyingPassword, setIsVerifyingPassword] = useState(false);

  // Fetch running hours
  const fetchRH = useCallback(async () => {
    try {
      const res = await getJson<{ data: Record<string, number> }>("/analytics/running-hours");
      if (res && res.data) {
        setRunningHours(res.data);
      }
    } catch (err) {
      console.error("Failed to fetch running hours data:", err);
    }
  }, []);

  // Fetch running hours tasks
  const fetchTasks = useCallback(async () => {
    setLoading(true);
    try {
      const query = `unitId=${unitId}&startDate=${dateRange.startDate}&endDate=${dateRange.endDate}`;
      const res = await getJson<{ data: any[] }>(`/config/rh-tasks?${query}`);
      if (res && res.data) {
        setDbTasks(res.data);
      }
    } catch (err) {
      console.error("Failed to fetch running hours tasks:", err);
    } finally {
      setLoading(false);
    }
  }, [unitId, dateRange.startDate, dateRange.endDate]);

  useEffect(() => {
    fetchRH();
    fetchTasks();
    const rhInterval = setInterval(fetchRH, 15000);
    const taskInterval = setInterval(fetchTasks, 15000);
    return () => {
      clearInterval(rhInterval);
      clearInterval(taskInterval);
    };
  }, [fetchRH, fetchTasks]);

  // Handle Complete Task
  const handleToggleCompleteTask = async (taskId: string) => {
    try {
      await postJson(`/config/rh-tasks/${taskId}/complete`, {});
      fetchTasks();
      fetchRH();
    } catch (err) {
      console.error("Failed to complete task:", err);
    }
  };

  const handleOpenPasswordVerification = (taskKey: string) => {
    setPendingTaskKey(taskKey);
    setVerifyPasswordInput("");
    setPasswordError("");
    setShowPasswordModal(true);
  };

  const handleConfirmCompleteTask = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!verifyPasswordInput.trim()) {
      setPasswordError("Password tidak boleh kosong.");
      return;
    }

    setIsVerifyingPassword(true);
    setPasswordError("");

    try {
      const res = await verifyPassword(verifyPasswordInput);
      if (res && res.valid) {
        if (pendingTaskKey) {
          await handleToggleCompleteTask(pendingTaskKey);
        }
        setShowPasswordModal(false);
        setPendingTaskKey(null);
        setVerifyPasswordInput("");
      } else {
        setPasswordError("Password yang Anda masukkan salah. Silakan coba lagi.");
      }
    } catch (err) {
      console.error("Password verification error:", err);
      setPasswordError("Gagal memverifikasi password. Periksa koneksi atau coba lagi.");
    } finally {
      setIsVerifyingPassword(false);
    }
  };

  // Format all tasks
  const allTasks = useMemo<Task[]>(() => {
    return dbTasks.map((task) => {
      const isClosed = task.status === "close";
      const actualHoursStr = isClosed 
        ? `${parseFloat(task.actual_hours_at_trigger).toFixed(1)}h`
        : `${(runningHours[MOTOR_KEY_TO_TAG_ID[task.motor_key]] || parseFloat(task.actual_hours_at_trigger) || 0.0).toFixed(1)}h`;
      
      const title = `${task.motor_key} (Running: ${actualHoursStr}) - ${task.task_name} (Target: ${task.target_hours}h)`;

      return {
        id: task.id,
        title,
        status: task.status,
        openedMonth: task.status !== "close",
        createdDate: new Date(task.created_at).toLocaleDateString(),
        taskKey: String(task.id),
        completionStatus: task.completion_status,
        completedBy: task.completed_by,
        completedAt: task.completed_at ? new Date(task.completed_at).toLocaleString("id-ID", { timeZone: "Asia/Jakarta" }) : undefined,
        createdAt: task.created_at ? new Date(task.created_at).toLocaleString("id-ID", { timeZone: "Asia/Jakarta" }) : undefined
      };
    });
  }, [dbTasks, runningHours]);

  // Statistics
  const taskInfo = useMemo(() => {
    return {
      taskOverdue: allTasks.filter((t) => t.status === "overdue").length,
      taskOpen: allTasks.filter((t) => t.status === "open").length,
      taskClose: allTasks.filter((t) => t.status === "close").length,
    };
  }, [allTasks]);

  // Filter tasks based on selected status & component
  const filteredTasks = useMemo(() => {
    return allTasks.filter((t) => {
      if (statusFilter !== "all" && t.status !== statusFilter) return false;
      if (componentFilter !== "all") {
        const titleLower = t.title.toLowerCase();
        const compLower = componentFilter.toLowerCase();
        if (!titleLower.includes(compLower)) return false;
      }
      return true;
    });
  }, [allTasks, statusFilter, componentFilter]);

  return (
    <div className="space-y-6">
      {/* Header and Filter Panel */}
      <div className="flex flex-wrap items-center justify-between gap-4 bg-[#f7fbff]/80 dark:bg-slate-950/70 border border-[#acd3ff] dark:border-slate-800 rounded-xl p-5 transition-colors duration-300 backdrop-blur-md">
        <div>
          <h3 className="text-sm font-bold text-[#002b5c] dark:text-slate-100 uppercase tracking-wide">
            Equipment Maintenance Task Manager
          </h3>
          <p className="text-xs text-[#47729f] dark:text-slate-400 mt-0.5">
            Daftar tugas pemeliharaan preventif yang dipicu oleh jumlah jam kerja (running hours) komponen.
          </p>
        </div>

        <div className="flex flex-wrap items-end gap-3">
          {/* Date range picker */}
          <div className="flex flex-col gap-1">
            <span className="text-[10px] text-slate-450 dark:text-slate-400 font-bold uppercase">Date Range (Calendar)</span>
            <div className="flex items-center gap-2">
              <input
                type="date"
                value={dateRange.startDate}
                onChange={(e) => setDateRange((prev) => ({ ...prev, startDate: e.target.value }))}
                className="bg-white dark:bg-slate-900 border border-[#acd3ff] dark:border-slate-700 text-xs text-[#002b5c] dark:text-slate-200 rounded-lg px-2.5 py-1.5 focus:outline-none font-semibold h-[34px]"
              />
              <span className="text-slate-400 text-xs flex-shrink-0">to</span>
              <input
                type="date"
                value={dateRange.endDate}
                onChange={(e) => setDateRange((prev) => ({ ...prev, endDate: e.target.value }))}
                className="bg-white dark:bg-slate-900 border border-[#acd3ff] dark:border-slate-700 text-xs text-[#002b5c] dark:text-slate-200 rounded-lg px-2.5 py-1.5 focus:outline-none font-semibold h-[34px]"
              />
            </div>
          </div>

          {/* Component filter */}
          <div className="flex flex-col gap-1 min-w-[150px]">
            <span className="text-[10px] text-slate-450 dark:text-slate-400 font-bold uppercase">Filter by Component</span>
            <select
              value={componentFilter}
              onChange={(e) => setComponentFilter(e.target.value)}
              className="bg-white dark:bg-slate-900 border border-[#acd3ff] dark:border-slate-700 text-xs text-[#002b5c] dark:text-slate-200 rounded-lg px-2.5 py-1.5 focus:outline-none font-semibold h-[34px]"
            >
              <option value="all">All Components</option>
              {ALL_COMPONENTS.map((comp) => (
                <option key={comp} value={comp}>
                  {comp}
                </option>
              ))}
            </select>
          </div>

          {/* Status filter tabs */}
          <div className="flex flex-col gap-1">
            <span className="text-[10px] text-slate-450 dark:text-slate-400 font-bold uppercase">Filter by Status</span>
            <div className="flex items-center gap-1 bg-white dark:bg-slate-900 border border-[#acd3ff] dark:border-slate-700 p-0.5 rounded-lg h-[34px]">
              {(["all", "overdue", "open", "close"] as const).map((st) => (
                <button
                  key={st}
                  type="button"
                  onClick={() => setStatusFilter(st)}
                  className={`px-3 py-1 rounded-md text-[10px] font-bold uppercase transition flex-shrink-0 h-full flex items-center justify-center ${
                    statusFilter === st
                      ? st === "overdue"
                        ? "bg-rose-500 text-white shadow-md shadow-rose-500/10"
                        : st === "open"
                        ? "bg-yellow-500 text-white shadow-md shadow-yellow-500/10"
                        : st === "close"
                        ? "bg-emerald-500 text-white shadow-md shadow-emerald-500/10"
                        : "bg-blue-600 text-white shadow-md shadow-blue-500/10"
                      : "text-slate-500 dark:text-slate-400 hover:text-slate-750 hover:bg-slate-100 dark:hover:bg-slate-800"
                  }`}
                >
                  {st}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-slate-950 border border-[#acd3ff] dark:border-slate-800 rounded-xl p-4 flex flex-col shadow-sm">
          <span className="text-[10px] text-slate-400 font-bold uppercase block">Total Overdue</span>
          <span className="text-2xl font-bold text-rose-500 mt-1">{taskInfo.taskOverdue}</span>
        </div>
        <div className="bg-white dark:bg-slate-950 border border-[#acd3ff] dark:border-slate-800 rounded-xl p-4 flex flex-col shadow-sm">
          <span className="text-[10px] text-slate-400 font-bold uppercase block">Total Open</span>
          <span className="text-2xl font-bold text-yellow-500 mt-1">{taskInfo.taskOpen}</span>
        </div>
        <div className="bg-white dark:bg-slate-950 border border-[#acd3ff] dark:border-slate-800 rounded-xl p-4 flex flex-col shadow-sm">
          <span className="text-[10px] text-slate-400 font-bold uppercase block">Total Closed</span>
          <span className="text-2xl font-bold text-emerald-500 mt-1">{taskInfo.taskClose}</span>
        </div>
        <div className="bg-[#f7fbff]/80 dark:bg-slate-950/70 border border-[#acd3ff] dark:border-slate-800 rounded-xl p-4 flex flex-col shadow-sm">
          <span className="text-[10px] text-slate-400 font-bold uppercase block">Viewing</span>
          <span className="text-2xl font-bold text-[#002b5c] dark:text-slate-300 mt-1">
            {filteredTasks.length} task{filteredTasks.length !== 1 ? "s" : ""}
          </span>
        </div>
      </div>

      {/* Tasks List Grid */}
      <div className="bg-white dark:bg-slate-950 border border-[#acd3ff] dark:border-slate-800 rounded-xl p-5 shadow-sm">
        {loading ? (
          <div className="py-12 text-center text-xs text-[#47729f] dark:text-slate-400">
            Memuat daftar tugas...
          </div>
        ) : filteredTasks.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {filteredTasks.map((task) => (
              <div
                key={task.id}
                className={`border border-slate-200 dark:border-slate-800 rounded-xl p-4 flex flex-col justify-between gap-4 transition duration-250 hover:shadow-md ${
                  task.status === "overdue"
                    ? "bg-rose-500/[0.02] border-rose-500/20 hover:border-rose-500/40"
                    : task.status === "open"
                    ? "bg-amber-500/[0.02] border-yellow-500/20 hover:border-yellow-500/40"
                    : "bg-emerald-500/[0.01] border-emerald-500/20 hover:border-emerald-500/40"
                }`}
              >
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[9px] font-bold tracking-wider ${
                      task.status === "overdue"
                        ? "bg-rose-500/10 text-rose-500"
                        : task.status === "open"
                        ? "bg-yellow-500/10 text-yellow-500"
                        : "bg-emerald-500/10 text-emerald-500"
                    }`}>
                      {task.status === "overdue" ? "OVERDUE" : task.status === "open" ? "PENDING / OPEN" : "COMPLETED / CLOSED"}
                    </span>
                    
                    {task.status === "close" && task.completionStatus && (
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[9px] font-bold tracking-wider ${
                        task.completionStatus === "Overdue"
                          ? "bg-red-500/10 text-red-500 border border-red-500/20"
                          : "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20"
                      }`}>
                        {task.completionStatus === "Overdue" ? "⚠️ Overdue at Completion" : "✓ Completed On Time"}
                      </span>
                    )}
                  </div>
                  <p className="text-xs font-semibold text-slate-800 dark:text-slate-200 leading-relaxed">
                    {task.title}
                  </p>

                  {task.status === "close" && (
                    <div className="mt-2 pt-2 border-t border-dashed border-slate-200 dark:border-slate-800 text-[10px] space-y-1 text-slate-500 dark:text-slate-400 font-mono">
                      <div><span className="font-bold text-slate-700 dark:text-slate-350">Aktif:</span> {task.createdAt || task.createdDate}</div>
                      <div><span className="font-bold text-slate-700 dark:text-slate-350">Selesai:</span> {task.completedAt || "-"}</div>
                      <div><span className="font-bold text-slate-700 dark:text-slate-350">Penyelesai:</span> <span className="font-bold text-emerald-600 dark:text-emerald-450">{task.completedBy || "System"}</span></div>
                    </div>
                  )}
                </div>

                <div className="flex items-center justify-between border-t border-slate-100 dark:border-slate-800/80 pt-3">
                  <span className="text-[10px] text-slate-400 font-semibold">
                    Created: {task.createdDate}
                  </span>
                  {(task.status === "overdue" || task.status === "open") && task.taskKey && (
                    <button
                      onClick={() => handleOpenPasswordVerification(task.taskKey!)}
                      className="px-4 py-1.5 rounded-lg text-xs font-bold transition duration-200 shadow-sm bg-blue-600 hover:bg-blue-700 active:scale-95 text-white shadow-blue-500/20"
                    >
                      Mark Done
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center text-slate-400 dark:text-slate-500 py-12 font-bold text-xs uppercase tracking-wide bg-slate-50 dark:bg-slate-950/20 border border-dashed border-slate-200 dark:border-slate-800 rounded-xl">
            No matching tasks found for the current filter criteria.
          </div>
        )}
      </div>

      {/* Password Verification Modal */}
      {showPasswordModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="w-full max-w-md bg-white dark:bg-slate-900 border border-[#acd3ff] dark:border-slate-800 rounded-xl p-6 shadow-2xl animate-in fade-in zoom-in-95 duration-200">
            <h3 className="text-base font-bold text-[#002b5c] dark:text-slate-100 mb-2">
              Confirm Task Completion
            </h3>
            <p className="text-xs text-[#47729f] dark:text-slate-400 mb-4">
              Completing maintenance task requires operator password verification. Please enter your password.
            </p>
            <form onSubmit={handleConfirmCompleteTask} className="space-y-4">
              <div>
                <input
                  type="password"
                  placeholder="Enter Password"
                  value={verifyPasswordInput}
                  onChange={(e) => setVerifyPasswordInput(e.target.value)}
                  className="w-full px-3 py-2 border border-blue-500 dark:border-slate-700 rounded-lg bg-transparent text-sm text-[#002b5c] dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500 font-bold"
                  autoFocus
                />
                {passwordError && (
                  <p className="text-xs text-red-500 font-semibold mt-1.5">{passwordError}</p>
                )}
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setShowPasswordModal(false);
                    setPendingTaskKey(null);
                  }}
                  disabled={isVerifyingPassword}
                  className="px-4 py-2 text-xs font-bold text-[#47729f] hover:text-[#002b5c] dark:text-slate-400 dark:hover:text-slate-200 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isVerifyingPassword}
                  className="px-5 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-lg flex items-center gap-1.5 shadow-md transition disabled:opacity-50"
                >
                  {isVerifyingPassword ? (
                    <>
                      <svg className="animate-spin h-3.5 w-3.5 text-white" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                      </svg>
                      Verifying...
                    </>
                  ) : (
                    "Verify & Complete"
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
