import { useRef, useState, type ReactNode } from "react";
import { verifyPassword } from "../../services/auth.service";

// --- Type Definitions (bisa dipindah ke file types.ts) ---
export interface Task {
  id: number;
  title: string;
  status: "open" | "close" | "overdue";
  openedMonth: boolean;
  createdDate: string;
  taskKey?: string;
  completionStatus?: string;
}

export interface Alarm {
  id: number | string;
  code: string;
  message: string;
  severity: "warning" | "critical" | "info";
}

export interface TaskInfo {
  taskOverdue: number;
  taskOpen: number;
  taskClose: number;
}

interface PidPageTemplateProps {
  machineName: string;
  allOn: boolean;
  onToggleAllOn: () => void;
  tasks: Task[];
  selectedTaskFilter: "all" | "overdue" | "open" | "close";
  onFilterChange: (filter: "all" | "overdue" | "open" | "close") => void;
  taskInfo: TaskInfo;
  alarms: Alarm[];
  children: ReactNode;
  onToggleCompleteTask?: (taskKey: string) => void;
  dateRange?: { startDate: string; endDate: string };
  onChangeDateRange?: (range: { startDate: string; endDate: string }) => void;
}

const PID_CANVAS_WIDTH = 1836;
const PID_CANVAS_HEIGHT = 1110;
const DEV_MODE = true;

export default function PidPageTemplate({
  machineName,
  allOn,
  onToggleAllOn,
  tasks,
  selectedTaskFilter,
  onFilterChange,
  taskInfo,
  alarms,
  children,
  onToggleCompleteTask,
  dateRange,
  onChangeDateRange,
}: PidPageTemplateProps) {
  const svgRef = useRef<SVGSVGElement>(null);

  const handleSvgClick = (e: React.MouseEvent<SVGSVGElement>) => {
    if (!DEV_MODE || !svgRef.current) return;
    const rect = svgRef.current.getBoundingClientRect();
    const scaleX = PID_CANVAS_WIDTH / rect.width;
    const scaleY = PID_CANVAS_HEIGHT / rect.height;
    const x = Math.round((e.clientX - rect.left) * scaleX);
    const y = Math.round((e.clientY - rect.top) * scaleY);
    console.log(`Clicked: x=${x}, y=${y}  (SVG coords)`);
  };

  const [showTaskModal, setShowTaskModal] = useState(false);
  const [modalStatusFilter, setModalStatusFilter] = useState<"all" | "open" | "overdue" | "close">("all");
  const [modalComponentFilter, setModalComponentFilter] = useState<string>("all");

  // State untuk Modal Verifikasi Password saat Mark Done
  const [pendingTaskKey, setPendingTaskKey] = useState<string | null>(null);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [verifyPasswordInput, setVerifyPasswordInput] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [isVerifyingPassword, setIsVerifyingPassword] = useState(false);
  const [showPasswordText, setShowPasswordText] = useState(false);

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
        if (pendingTaskKey && onToggleCompleteTask) {
          await onToggleCompleteTask(pendingTaskKey);
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

  const ALL_COMPONENTS = [
    "FAN-1", "FAN-2", "FAN-3",
    "MTR-1", "MTR-2", "MTR-3", "MTR-4", "MTR-5", "MTR-6", "MTR-7", "MTR-8", "MTR-9",
    "Dosing Pump 1", "Dosing Pump 2",
    "Strainer 1", "Strainer 2", "Strainer 3", "Strainer 4", "Strainer 5", "Strainer 6", "Strainer 7", "Strainer 8", "Strainer 9",
    "CT 1", "CT 2", "CT 3",
    "Cooling Tank", "Panel"
  ];

  const filteredTasks =
    selectedTaskFilter === "all"
      ? tasks
      : selectedTaskFilter === "overdue"
      ? tasks.filter((t) => t.status === "overdue")
      : selectedTaskFilter === "open"
      ? tasks.filter((t) => t.status === "open")
      : tasks.filter((t) => t.status === "close");

  const modalFilteredTasks = tasks.filter((t) => {
    if (modalStatusFilter !== "all" && t.status !== modalStatusFilter) return false;
    if (modalComponentFilter !== "all") {
      const titleLower = t.title.toLowerCase();
      const compLower = modalComponentFilter.toLowerCase();
      if (!titleLower.includes(compLower)) return false;
    }
    return true;
  });

  return (
    <div className="relative flex gap-4">
      {/* Canvas Area */}
      <section className="flex-1 flex flex-col rounded-lg border border-slate-800 dark:border-slate-600 bg-slate-950/70 dark:bg-slate-950/90 p-3 sm:p-5 mr-[400px]">
        {/* Top Bar */}
        <div className="mb-4 flex items-center justify-between">
          <div className="text-xs uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">
            P&ID Diagram Canvas — {machineName}
          </div>
        </div>

        {/* Canvas Wrapper */}
        <div className="overflow-x-auto scrollbar-hide">
          <div
            className="relative w-full min-w-[720px] rounded-lg border border-dashed border-slate-700 dark:border-slate-500 bg-slate-900 dark:bg-slate-800"
            style={{ aspectRatio: "1836 / 1110" }}
          >
            {children}
          </div>
        </div>
      </section>

      {/* Right Sidebar (fixed) */}
      <div className="absolute top-0 right-0 w-96 h-full flex flex-col gap-4">
        {/* Task Card */}
        <div
          className="flex flex-col rounded-lg border border-slate-800 dark:border-slate-600 bg-slate-950/70 dark:bg-slate-950/90 p-4 overflow-hidden"
          style={{ flex: "3 1 0", minHeight: 0 }}
        >
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-xs uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400 font-semibold">
              Task Information
            </h3>
            <button
              onClick={() => setShowTaskModal(true)}
              className="text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-md shadow-sm transition duration-150 bg-sky-600 hover:bg-sky-700 text-white dark:bg-sky-500 dark:hover:bg-sky-400 dark:text-slate-950"
            >
              Detail Tasks
            </button>
          </div>
          <div className="space-y-1.5 mb-2">
            <button
              onClick={() => onFilterChange("overdue")}
              className={`w-full text-left flex justify-between items-center px-2 py-1.5 rounded border-2 transition-colors ${
                selectedTaskFilter === "overdue"
                  ? "bg-white dark:bg-slate-700 border-rose-500 dark:border-rose-400 text-slate-900 dark:text-slate-100"
                  : "bg-white dark:bg-slate-800 border-slate-300 dark:border-slate-600 text-slate-900 dark:text-slate-200 hover:border-rose-400 dark:hover:border-rose-400"
              }`}
            >
              <span className="text-xs font-semibold">Task Overdue</span>
              <span className="text-base font-bold text-rose-500 dark:text-rose-450">
                {taskInfo.taskOverdue}
              </span>
            </button>
            <button
              onClick={() => onFilterChange("open")}
              className={`w-full text-left flex justify-between items-center px-2 py-1.5 rounded border-2 transition-colors ${
                selectedTaskFilter === "open"
                  ? "bg-white dark:bg-slate-700 border-yellow-500 dark:border-yellow-400 text-slate-900 dark:text-slate-100"
                  : "bg-white dark:bg-slate-800 border-slate-300 dark:border-slate-600 text-slate-900 dark:text-slate-200 hover:border-yellow-400 dark:hover:border-yellow-400"
              }`}
            >
              <span className="text-xs font-semibold">Task Open</span>
              <span className="text-base font-bold text-yellow-500 dark:text-yellow-400">
                {taskInfo.taskOpen}
              </span>
            </button>
            <button
              onClick={() => onFilterChange("close")}
              className={`w-full text-left flex justify-between items-center px-2 py-1.5 rounded border-2 transition-colors ${
                selectedTaskFilter === "close"
                  ? "bg-white dark:bg-slate-700 border-green-500 dark:border-green-400 text-slate-900 dark:text-slate-100"
                  : "bg-white dark:bg-slate-800 border-slate-300 dark:border-slate-600 text-slate-900 dark:text-slate-200 hover:border-green-400 dark:hover:border-green-400"
              }`}
            >
              <span className="text-xs font-semibold">Task Close</span>
              <span className="text-base font-bold text-green-500 dark:text-green-400">
                {taskInfo.taskClose}
              </span>
            </button>
          </div>
          <div className="text-xs text-slate-600 dark:text-slate-400 font-medium mb-1">
            Keterangan ({filteredTasks.length})
          </div>
          <div className="flex-1 overflow-y-auto space-y-2 pr-2 scrollbar-hide">
            {filteredTasks.length > 0 ? (
              filteredTasks.map((task) => (
                <div
                  key={task.id}
                  className={`rounded border-2 p-2 text-xs bg-white dark:bg-slate-800 ${
                    task.status === "overdue"
                      ? "border-rose-400 dark:border-rose-500"
                      : task.status === "open"
                      ? "border-yellow-400 dark:border-yellow-500"
                      : "border-green-400 dark:border-green-500"
                  }`}
                >
                  <div className="font-medium text-slate-900 dark:text-slate-100">{task.title}</div>
                  <div className="text-slate-600 dark:text-slate-400 mt-1.5 flex items-center justify-between">
                    <span
                      className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold ${
                        task.status === "overdue"
                          ? "bg-rose-500/10 text-rose-500 border border-rose-500/25"
                          : task.status === "open"
                          ? "bg-yellow-500/10 text-yellow-500 border border-yellow-500/25"
                          : "bg-emerald-500/10 text-emerald-500 border border-emerald-500/25"
                      }`}
                    >
                      {task.status === "overdue" ? "OVERDUE" : task.status === "open" ? "OPEN" : "CLOSE"}
                    </span>
                  </div>
                </div>
              ))
            ) : (
              <div className="text-center text-slate-400 dark:text-slate-500 py-4">Tidak ada task</div>
            )}
          </div>
        </div>

        {/* Alarm Card */}
        <div
          className="flex flex-col rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 p-4 overflow-hidden"
          style={{ flex: "2 1 0", minHeight: 0 }}
        >
          <h3 className="text-xs uppercase tracking-[0.2em] text-slate-700 dark:text-slate-300 font-semibold mb-3">
            Alarms
          </h3>
          <div className="flex-1 overflow-y-auto space-y-2 pr-2 scrollbar-hide">
            {alarms.length > 0 ? (
              alarms.map((alarm) => (
                <div
                  key={alarm.id}
                  className={`border-2 rounded p-3 bg-white dark:bg-slate-800 ${
                    alarm.severity === "critical"
                      ? "border-red-500 dark:border-red-400"
                      : alarm.severity === "warning"
                      ? "border-yellow-500 dark:border-yellow-400"
                      : "border-slate-300 dark:border-slate-600"
                  }`}
                >
                  <div className="flex items-start gap-2">
                    <div
                      className={`w-2.5 h-2.5 rounded-full mt-1.5 flex-shrink-0 ${
                        alarm.severity === "critical"
                          ? "bg-red-500 dark:bg-red-400"
                          : alarm.severity === "warning"
                          ? "bg-yellow-500 dark:bg-yellow-400"
                          : "bg-blue-500 dark:bg-blue-400"
                      }`}
                    />
                    <div className="flex-1 min-w-0">
                      <div
                        className={`text-xs font-mono font-semibold ${
                          alarm.severity === "critical"
                            ? "text-red-600 dark:text-red-400"
                            : "text-yellow-600 dark:text-yellow-400"
                        }`}
                      >
                        {alarm.code}
                      </div>
                      <p className="text-xs leading-snug mt-1 text-slate-700 dark:text-slate-300">
                        {alarm.message}
                      </p>
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <div className="text-center text-slate-400 dark:text-slate-500 py-6 text-xs font-medium">
                Tidak ada alarm aktif saat ini
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Task Manager Modal */}
      {showTaskModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="w-full max-w-4xl bg-white dark:bg-slate-900 border border-[#acd3ff] dark:border-slate-800 rounded-xl p-6 shadow-2xl animate-in zoom-in-95 duration-200 flex flex-col max-h-[85vh]">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3 mb-4">
              <div>
                <h3 className="text-base font-bold text-[#002b5c] dark:text-slate-100 uppercase tracking-wide">
                  Equipment Maintenance Task Manager
                </h3>
                <p className="text-xs text-[#47729f] dark:text-slate-400 mt-0.5">
                  Detailed view of triggered running hours preventative maintenance tasks.
                </p>
              </div>
              <button
                onClick={() => setShowTaskModal(false)}
                className="text-slate-400 hover:text-slate-650 dark:hover:text-slate-200 text-lg font-bold"
              >
                ✕
              </button>
            </div>

            {/* Calendar & Filters Bar */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 bg-slate-50 dark:bg-slate-950/60 p-4 border border-slate-200/60 dark:border-slate-800 rounded-lg mb-4">
              {/* Date range picker */}
              <div className="flex flex-col gap-1">
                <span className="text-[10px] text-slate-450 dark:text-slate-400 font-bold uppercase">Date Range (Calendar)</span>
                <div className="flex items-center gap-2">
                  <input
                    type="date"
                    value={dateRange?.startDate}
                    onChange={(e) => onChangeDateRange && onChangeDateRange({ startDate: e.target.value, endDate: dateRange?.endDate || "" })}
                    className="bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-xs text-slate-800 dark:text-slate-200 rounded px-2.5 py-1.5 focus:outline-none w-full font-semibold"
                  />
                  <span className="text-slate-400 text-xs">to</span>
                  <input
                    type="date"
                    value={dateRange?.endDate}
                    onChange={(e) => onChangeDateRange && onChangeDateRange({ startDate: dateRange?.startDate || "", endDate: e.target.value })}
                    className="bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-xs text-slate-800 dark:text-slate-200 rounded px-2.5 py-1.5 focus:outline-none w-full font-semibold"
                  />
                </div>
              </div>

              {/* Component filter */}
              <div className="flex flex-col gap-1">
                <span className="text-[10px] text-slate-450 dark:text-slate-400 font-bold uppercase">Filter by Component</span>
                <select
                  value={modalComponentFilter}
                  onChange={(e) => setModalComponentFilter(e.target.value)}
                  className="bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-xs text-slate-800 dark:text-slate-200 rounded px-2.5 py-1.5 focus:outline-none w-full font-semibold"
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
                <div className="flex items-center gap-1 mt-1">
                  {(["all", "overdue", "open", "close"] as const).map((st) => (
                    <button
                      key={st}
                      type="button"
                      onClick={() => setModalStatusFilter(st)}
                      className={`px-3 py-1.5 rounded text-[10px] font-bold uppercase transition flex-1 text-center ${
                        modalStatusFilter === st
                          ? st === "overdue"
                            ? "bg-rose-500 text-white shadow"
                            : st === "open"
                            ? "bg-yellow-500 text-white shadow"
                            : st === "close"
                            ? "bg-emerald-500 text-white shadow"
                            : "bg-blue-600 text-white shadow"
                          : "bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-300 dark:hover:bg-slate-750"
                      }`}
                    >
                      {st}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Stats Summary */}
            <div className="flex flex-wrap gap-4 items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3 mb-4">
              <div className="flex items-center gap-6">
                <div>
                  <span className="text-[10px] text-slate-400 font-bold uppercase block">Total Overdue</span>
                  <span className="text-xl font-bold text-rose-500">{taskInfo.taskOverdue}</span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 font-bold uppercase block">Total Open</span>
                  <span className="text-xl font-bold text-yellow-500">{taskInfo.taskOpen}</span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 font-bold uppercase block">Total Closed</span>
                  <span className="text-xl font-bold text-green-500">{taskInfo.taskClose}</span>
                </div>
                <div className="border-l border-slate-200 dark:border-slate-700 pl-6">
                  <span className="text-[10px] text-slate-400 font-bold uppercase block">Viewing</span>
                  <span className="text-xs font-semibold text-slate-600 dark:text-slate-300">
                    {modalFilteredTasks.length} task{modalFilteredTasks.length !== 1 ? "s" : ""}
                  </span>
                </div>
              </div>
            </div>

            {/* List Header and Content */}
            <div className="flex-1 overflow-y-auto min-h-0 pr-1 space-y-3">
              {modalFilteredTasks.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {modalFilteredTasks.map((task) => (
                    <div
                      key={task.id}
                      className={`border border-slate-250 dark:border-slate-800 rounded-xl p-4 flex flex-col justify-between gap-3 transition-colors ${
                        task.status === "overdue"
                          ? "bg-rose-500/[0.02] border-rose-500/30"
                          : task.status === "open"
                          ? "bg-amber-500/[0.02] border-yellow-500/30"
                          : "bg-emerald-500/[0.01] border-emerald-500/30"
                      }`}
                    >
                      <div className="space-y-1.5">
                        <div className="flex items-center gap-2">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[9px] font-bold tracking-wider ${
                            task.status === "overdue"
                              ? "bg-rose-500/10 text-rose-500"
                              : task.status === "open"
                              ? "bg-yellow-500/10 text-yellow-500"
                              : "bg-emerald-500/10 text-emerald-500"
                          }`}>
                            {task.status === "overdue" ? "OVERDUE" : task.status === "open" ? "PENDING / OPEN" : "COMPLETED / CLOSED"}
                          </span>
                          
                          {task.status === "close" && task.completionStatus && (
                            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[9px] font-bold tracking-wider ${
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
                      </div>

                      <div className="flex items-center justify-between border-t border-slate-100 dark:border-slate-800/80 pt-2.5">
                        <span className="text-[10px] text-slate-400 font-semibold">
                          Created: {task.createdDate}
                        </span>
                        {(task.status === "overdue" || task.status === "open") && onToggleCompleteTask && task.taskKey && (
                          <button
                            onClick={() => handleOpenPasswordVerification(task.taskKey!)}
                            className="px-3.5 py-1.5 rounded-lg text-xs font-bold transition duration-200 shadow-sm bg-emerald-500 hover:bg-emerald-600 active:scale-95 text-white shadow-emerald-500/20"
                          >
                            Mark Done
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center text-slate-400 dark:text-slate-500 py-10 font-bold text-xs uppercase tracking-wide bg-slate-50 dark:bg-slate-950/20 border border-dashed border-slate-200 dark:border-slate-850 rounded-xl">
                  No matching tasks found for the current filter criteria.
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="border-t border-slate-100 dark:border-slate-800 pt-3 mt-4 flex justify-end">
              <button
                onClick={() => setShowTaskModal(false)}
                className="px-5 py-2 text-xs font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800/80 border border-slate-300 dark:border-slate-700 rounded-lg transition"
              >
                Close Task Manager
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Password Verification Modal */}
      {showPasswordModal && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/70 backdrop-blur-md p-4 animate-in fade-in duration-200">
          <div className="w-full max-w-md bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800/80 rounded-2xl shadow-2xl animate-in zoom-in-95 duration-200 overflow-hidden relative">
            {/* Top Gradient Stripe */}
            <div className="h-1.5 w-full bg-gradient-to-r from-emerald-500 via-teal-500 to-sky-500" />

            <div className="p-6">
              {/* Header */}
              <div className="flex items-start justify-between pb-4 mb-5 border-b border-slate-100 dark:border-slate-800">
                <div className="flex items-center gap-3">
                  <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-emerald-500/15 to-teal-500/15 border border-emerald-500/30 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shadow-inner">
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                    </svg>
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-[#002b5c] dark:text-slate-100 uppercase tracking-wider">
                      Otentikasi Operator
                    </h3>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                      Verifikasi password untuk menyelesaikan tugas
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setShowPasswordModal(false);
                    setPendingTaskKey(null);
                  }}
                  className="w-8 h-8 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center justify-center transition text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 text-sm font-bold"
                >
                  ✕
                </button>
              </div>

              {/* Form Body */}
              <form onSubmit={handleConfirmCompleteTask} className="space-y-5">
                <div>
                  <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-300 mb-2 uppercase tracking-wider">
                    Password Akun Operator
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
                      </svg>
                    </div>
                    <input
                      type={showPasswordText ? "text" : "password"}
                      autoFocus
                      value={verifyPasswordInput}
                      onChange={(e) => setVerifyPasswordInput(e.target.value)}
                      placeholder="Masukkan password akun Anda..."
                      className="w-full pl-10 pr-10 py-2.5 bg-slate-50 dark:bg-slate-800/80 border border-slate-250 dark:border-slate-700/80 rounded-xl text-sm text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/40 focus:border-emerald-500 focus:bg-white dark:focus:bg-slate-950 font-medium transition duration-150"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPasswordText(!showPasswordText)}
                      className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition"
                    >
                      {showPasswordText ? (
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858-5.908a10.025 10.025 0 012.848-.363c4.478 0 8.268 2.943 9.543 7a9.97 9.97 0 01-2.107 3.592M9.88 9.88a3 3 0 104.24 4.24m-4.24-4.24L3 3l18 18" />
                        </svg>
                      ) : (
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                          <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                        </svg>
                      )}
                    </button>
                  </div>

                  {passwordError && (
                    <div className="mt-2.5 p-2.5 rounded-xl bg-rose-500/10 border border-rose-500/20 text-xs text-rose-500 font-semibold flex items-center gap-2 animate-in fade-in duration-150">
                      <svg className="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                      </svg>
                      <span>{passwordError}</span>
                    </div>
                  )}
                </div>

                <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-100 dark:border-slate-800">
                  <button
                    type="button"
                    onClick={() => {
                      setShowPasswordModal(false);
                      setPendingTaskKey(null);
                    }}
                    className="px-4 py-2.5 text-xs font-bold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition duration-150"
                  >
                    Batal
                  </button>
                  <button
                    type="submit"
                    disabled={isVerifyingPassword}
                    className="px-5 py-2.5 text-xs font-bold text-white bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 active:scale-[0.98] disabled:opacity-50 rounded-xl shadow-lg shadow-emerald-500/20 transition duration-150 flex items-center gap-2"
                  >
                    {isVerifyingPassword ? (
                      <>
                        <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        <span>Memverifikasi...</span>
                      </>
                    ) : (
                      <>
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                        </svg>
                        <span>Konfirmasi Selesai</span>
                      </>
                    )}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}