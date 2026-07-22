import { useRef, useState, type ReactNode } from "react";
import { verifyPassword } from "../../services/auth.service";
import { getJson } from "../../services/api.client";

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
  timestamp?: string;
  status?: string;
  clearedAt?: string;
  rtn?: string;
  operatorName?: string;
  operatorAction?: string;
  approverName?: string;
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

  // State untuk Modal Detail Record Alarm & History Log
  const [selectedAlarmRecord, setSelectedAlarmRecord] = useState<Alarm | null>(null);
  const [showAlarmHistoryModal, setShowAlarmHistoryModal] = useState(false);
  const [alarmHistoryData, setAlarmHistoryData] = useState<any[]>([]);
  const [loadingAlarmHistory, setLoadingAlarmHistory] = useState(false);

  const fetchAlarmHistory = async () => {
    setLoadingAlarmHistory(true);
    try {
      const res = await getJson<{ data: any[] }>("/alarms/history?limit=100");
      if (res && Array.isArray(res.data)) {
        setAlarmHistoryData(res.data);
      }
    } catch (err) {
      console.error("Failed to fetch alarm history:", err);
    } finally {
      setLoadingAlarmHistory(false);
    }
  };

  const handleOpenAlarmHistory = () => {
    fetchAlarmHistory();
    setShowAlarmHistoryModal(true);
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
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-xs uppercase tracking-[0.2em] text-slate-700 dark:text-slate-300 font-semibold">
              Alarms
            </h3>
            <button
              onClick={handleOpenAlarmHistory}
              className="text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-md shadow-sm transition duration-150 bg-sky-600 hover:bg-sky-700 text-white dark:bg-sky-500 dark:hover:bg-sky-400 dark:text-slate-950"
            >
              Detail Records
            </button>
          </div>
          <div className="flex-1 overflow-y-auto space-y-2 pr-2 scrollbar-hide">
            {alarms.length > 0 ? (
              alarms.map((alarm) => (
                <div
                  key={alarm.id}
                  onClick={() => setSelectedAlarmRecord(alarm)}
                  className={`border-2 rounded p-3 bg-white dark:bg-slate-800 cursor-pointer hover:shadow-md transition group ${
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
                      <div className="flex items-center justify-between gap-1">
                        <div
                          className={`text-xs font-mono font-bold ${
                            alarm.severity === "critical"
                              ? "text-red-600 dark:text-red-400"
                              : "text-yellow-600 dark:text-yellow-400"
                          }`}
                        >
                          {alarm.code}
                        </div>
                        <span className="text-[9px] font-bold text-sky-600 dark:text-sky-400 group-hover:underline">
                          Record Detail →
                        </span>
                      </div>
                      <p className="text-xs leading-snug mt-1 text-slate-700 dark:text-slate-300">
                        {alarm.message}
                      </p>
                      {alarm.timestamp && (
                        <div className="mt-1.5 text-[10px] text-slate-400 dark:text-slate-500 flex items-center justify-between font-mono">
                          <span>Active: {alarm.timestamp}</span>
                          <span className={`px-1.5 py-0.5 rounded font-bold uppercase text-[9px] ${
                            alarm.status === "Resolved"
                              ? "bg-emerald-500/10 text-emerald-500"
                              : "bg-rose-500/10 text-rose-500 animate-pulse"
                          }`}>
                            {alarm.status || "Active"}
                          </span>
                        </div>
                      )}
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
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-end bg-slate-50 dark:bg-slate-950/60 p-4 border border-slate-200/60 dark:border-slate-800 rounded-lg mb-4">
              {/* Date range picker */}
              <div className="flex flex-col gap-1 lg:col-span-5 min-w-0">
                <span className="text-[10px] text-slate-450 dark:text-slate-400 font-bold uppercase">Date Range (Calendar)</span>
                <div className="flex items-center gap-2">
                  <input
                    type="date"
                    value={dateRange?.startDate}
                    onChange={(e) => onChangeDateRange && onChangeDateRange({ startDate: e.target.value, endDate: dateRange?.endDate || "" })}
                    className="bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-xs text-slate-800 dark:text-slate-200 rounded px-2.5 py-1.5 focus:outline-none w-full min-w-0 font-semibold h-[34px]"
                  />
                  <span className="text-slate-400 text-xs flex-shrink-0">to</span>
                  <input
                    type="date"
                    value={dateRange?.endDate}
                    onChange={(e) => onChangeDateRange && onChangeDateRange({ startDate: dateRange?.startDate || "", endDate: e.target.value })}
                    className="bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-xs text-slate-800 dark:text-slate-200 rounded px-2.5 py-1.5 focus:outline-none w-full min-w-0 font-semibold h-[34px]"
                  />
                </div>
              </div>

              {/* Component filter */}
              <div className="flex flex-col gap-1 lg:col-span-3 min-w-0">
                <span className="text-[10px] text-slate-450 dark:text-slate-400 font-bold uppercase">Filter by Component</span>
                <select
                  value={modalComponentFilter}
                  onChange={(e) => setModalComponentFilter(e.target.value)}
                  className="bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-xs text-slate-800 dark:text-slate-200 rounded px-2.5 py-1.5 focus:outline-none w-full font-semibold h-[34px]"
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
              <div className="flex flex-col gap-1 lg:col-span-4 min-w-0">
                <span className="text-[10px] text-slate-450 dark:text-slate-400 font-bold uppercase">Filter by Status</span>
                <div className="flex items-center gap-1">
                  {(["all", "overdue", "open", "close"] as const).map((st) => (
                    <button
                      key={st}
                      type="button"
                      onClick={() => setModalStatusFilter(st)}
                      className={`px-2.5 py-1.5 rounded text-[10px] font-bold uppercase transition flex-1 text-center h-[34px] flex items-center justify-center ${
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
                            className="px-3.5 py-1.5 rounded-lg text-xs font-bold transition duration-200 shadow-sm bg-blue-600 hover:bg-blue-700 active:scale-95 text-white shadow-blue-500/20"
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

      {/* Password Verification Modal (Matching Configuration page style) */}
      {showPasswordModal && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-sm">
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

      {/* Detail Alarm Record Modal */}
      {selectedAlarmRecord && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="w-full max-w-lg bg-white dark:bg-slate-900 border border-[#acd3ff] dark:border-slate-800 rounded-xl p-6 shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3 mb-4">
              <div className="flex items-center gap-2">
                <span className={`w-3 h-3 rounded-full ${
                  selectedAlarmRecord.status === "Resolved"
                    ? "bg-emerald-500"
                    : "bg-rose-500 animate-pulse"
                }`} />
                <h3 className="text-base font-bold text-[#002b5c] dark:text-slate-100 uppercase tracking-wide">
                  Detail Record Alarm
                </h3>
              </div>
              <button
                onClick={() => setSelectedAlarmRecord(null)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 text-lg font-bold"
              >
                ✕
              </button>
            </div>

            <div className="space-y-4">
              {/* Parameter & Status */}
              <div className="p-3.5 bg-slate-50 dark:bg-slate-800/80 rounded-xl border border-slate-200 dark:border-slate-700">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Parameter / Code</span>
                  <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                    selectedAlarmRecord.status === "Resolved"
                      ? "bg-emerald-500/10 text-emerald-500 border border-emerald-500/30"
                      : "bg-rose-500/10 text-rose-500 border border-rose-500/30 animate-pulse"
                  }`}>
                    {selectedAlarmRecord.status || "Active"}
                  </span>
                </div>
                <div className="text-sm font-bold text-[#002b5c] dark:text-slate-100">
                  {selectedAlarmRecord.code}
                </div>
                <p className="text-xs text-slate-600 dark:text-slate-300 mt-1">
                  {selectedAlarmRecord.message}
                </p>
              </div>

              {/* Timestamps Grid */}
              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700/80">
                  <span className="text-[10px] font-bold text-slate-400 uppercase block">Jam Active (Triggered)</span>
                  <span className="text-xs font-mono font-bold text-slate-800 dark:text-slate-200 mt-1 block">
                    {selectedAlarmRecord.timestamp || "—"}
                  </span>
                </div>
                <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700/80">
                  <span className="text-[10px] font-bold text-slate-400 uppercase block">Jam Ter-resolve (Cleared)</span>
                  <span className="text-xs font-mono font-bold text-emerald-600 dark:text-emerald-400 mt-1 block">
                    {selectedAlarmRecord.clearedAt && selectedAlarmRecord.clearedAt !== "—"
                      ? selectedAlarmRecord.clearedAt
                      : selectedAlarmRecord.status === "Resolved"
                      ? "Resolved"
                      : "Masih Aktif"}
                  </span>
                </div>
              </div>

              {/* Duration & Operator PIC */}
              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700/80">
                  <span className="text-[10px] font-bold text-slate-400 uppercase block">Durasi Terjadi (RTN)</span>
                  <span className="text-xs font-mono font-bold text-slate-700 dark:text-slate-300 mt-1 block">
                    {selectedAlarmRecord.rtn || "—"}
                  </span>
                </div>
                <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700/80">
                  <span className="text-[10px] font-bold text-slate-400 uppercase block">Operator PIC</span>
                  <span className="text-xs font-semibold text-slate-700 dark:text-slate-300 mt-1 block">
                    {selectedAlarmRecord.operatorName || "—"}
                  </span>
                </div>
              </div>

              {selectedAlarmRecord.operatorAction && selectedAlarmRecord.operatorAction !== "—" && (
                <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700/80">
                  <span className="text-[10px] font-bold text-slate-400 uppercase block">Tindakan Operator</span>
                  <p className="text-xs font-medium text-slate-700 dark:text-slate-300 mt-1">
                    {selectedAlarmRecord.operatorAction}
                  </p>
                </div>
              )}
            </div>

            <div className="flex justify-end pt-4 mt-4 border-t border-slate-100 dark:border-slate-800">
              <button
                onClick={() => setSelectedAlarmRecord(null)}
                className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-lg shadow-sm transition"
              >
                Tutup Detail
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Alarm History Log Modal */}
      {showAlarmHistoryModal && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="w-full max-w-4xl bg-white dark:bg-slate-900 border border-[#acd3ff] dark:border-slate-800 rounded-xl p-6 shadow-2xl animate-in zoom-in-95 duration-200 flex flex-col max-h-[85vh]">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3 mb-4">
              <div>
                <h3 className="text-base font-bold text-[#002b5c] dark:text-slate-100 uppercase tracking-wide">
                  PostgreSQL Alarm Records History
                </h3>
                <p className="text-xs text-[#47729f] dark:text-slate-400 mt-0.5">
                  Rekam jejak alarm aktif & ter-resolve dari database PostgreSQL (Data disimpan permanen).
                </p>
              </div>
              <button
                onClick={() => setShowAlarmHistoryModal(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 text-lg font-bold"
              >
                ✕
              </button>
            </div>

            <div className="flex-1 overflow-y-auto min-h-0 pr-1">
              {loadingAlarmHistory ? (
                <div className="text-center py-12 text-slate-400 font-semibold text-xs flex items-center justify-center gap-2">
                  <span className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
                  Memuat data rekam jejak alarm dari PostgreSQL...
                </div>
              ) : alarmHistoryData.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="border-b border-slate-200 dark:border-slate-800 text-[10px] uppercase tracking-wider text-slate-500 font-bold">
                        <th className="pb-2">Status</th>
                        <th className="pb-2">Parameter / Deskripsi</th>
                        <th className="pb-2">Jam Active</th>
                        <th className="pb-2">Jam Ter-resolve</th>
                        <th className="pb-2">Durasi (RTN)</th>
                        <th className="pb-2 text-right">Aksi</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 font-medium">
                      {alarmHistoryData.map((item: any) => {
                        const activeTs = item.lastTs ? new Date(item.lastTs).toLocaleString("en-US", { hour12: false }) : "—";
                        const clearedTs = item.clearedAt ? new Date(item.clearedAt).toLocaleString("en-US", { hour12: false }) : item.status === "Resolved" ? "Resolved" : "—";

                        return (
                          <tr key={item.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition">
                            <td className="py-2.5">
                              <span className={`px-2 py-0.5 rounded text-[9px] font-bold uppercase ${
                                item.status === "Resolved"
                                  ? "bg-emerald-500/10 text-emerald-500 border border-emerald-500/30"
                                  : "bg-rose-500/10 text-rose-500 border border-rose-500/30 animate-pulse"
                              }`}>
                                {item.status}
                              </span>
                            </td>
                            <td className="py-2.5 max-w-xs pr-2">
                              <div className="font-bold text-slate-800 dark:text-slate-200">{item.alarmKey || item.tagId}</div>
                              <div className="text-[11px] text-slate-500 dark:text-slate-400 line-clamp-1">{item.message}</div>
                            </td>
                            <td className="py-2.5 font-mono text-[11px] text-slate-700 dark:text-slate-300">{activeTs}</td>
                            <td className="py-2.5 font-mono text-[11px] text-emerald-600 dark:text-emerald-400">{clearedTs}</td>
                            <td className="py-2.5 font-mono text-[11px] text-slate-600 dark:text-slate-400">{item.rtn || "—"}</td>
                            <td className="py-2.5 text-right">
                              <button
                                onClick={() => {
                                  setSelectedAlarmRecord({
                                    id: item.id,
                                    code: item.alarmKey || item.tagId,
                                    message: item.message,
                                    severity: item.severity === "high" || item.severity === "critical" ? "critical" : "warning",
                                    timestamp: activeTs,
                                    status: item.status,
                                    clearedAt: clearedTs,
                                    rtn: item.rtn || "—",
                                    operatorName: item.operatorName || "—",
                                    operatorAction: item.operatorAction || "—",
                                    approverName: item.approverName || "—"
                                  });
                                }}
                                className="px-2.5 py-1 bg-blue-600 hover:bg-blue-700 text-white font-bold text-[10px] rounded transition"
                              >
                                Detail
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="text-center py-10 text-slate-400 text-xs font-semibold">
                  Tidak ada rekam jejak alarm di PostgreSQL.
                </div>
              )}
            </div>

            <div className="border-t border-slate-100 dark:border-slate-800 pt-3 mt-4 flex justify-end">
              <button
                onClick={() => setShowAlarmHistoryModal(false)}
                className="px-5 py-2 text-xs font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800/80 border border-slate-300 dark:border-slate-700 rounded-lg transition"
              >
                Close Records History
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}