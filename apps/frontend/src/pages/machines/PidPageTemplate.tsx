import { useRef, useState, type ReactNode } from "react";

// --- Type Definitions (bisa dipindah ke file types.ts) ---
export interface Task {
  id: number;
  title: string;
  status: "open" | "close" | "overdue";
  openedMonth: boolean;
  createdDate: string;
  taskKey?: string;
}

export interface Alarm {
  id: number;
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

  const filteredTasks =
    selectedTaskFilter === "all"
      ? tasks
      : selectedTaskFilter === "overdue"
      ? tasks.filter((t) => t.status === "overdue")
      : selectedTaskFilter === "open"
      ? tasks.filter((t) => t.status === "open")
      : tasks.filter((t) => t.status === "close");

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
              className="text-[10px] font-bold text-sky-400 hover:text-sky-300 transition uppercase tracking-wider bg-sky-950 border border-sky-800 px-2 py-0.5 rounded"
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
                    {(task.status === "open" || task.status === "overdue") && onToggleCompleteTask && task.taskKey && (
                      <button
                        onClick={() => onToggleCompleteTask(task.taskKey!)}
                        className="px-2.5 py-1 rounded bg-emerald-500 hover:bg-emerald-600 text-white font-extrabold text-[9px] uppercase tracking-wide transition duration-150"
                      >
                        CLOSE
                      </button>
                    )}
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
            {alarms.map((alarm) => (
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
            ))}
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

            {/* Stats Summary */}
            <div className="flex flex-wrap gap-4 items-center justify-between bg-slate-50 dark:bg-slate-950/60 p-4 border border-slate-200/60 dark:border-slate-800 rounded-lg mb-4">
              <div className="flex items-center gap-6">
                <div>
                  <span className="text-[10px] text-slate-400 font-bold uppercase block">Total Overdue Tasks</span>
                  <span className="text-xl font-bold text-rose-500">{taskInfo.taskOverdue}</span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 font-bold uppercase block">Total Open Tasks</span>
                  <span className="text-xl font-bold text-yellow-500">{taskInfo.taskOpen}</span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 font-bold uppercase block">Total Closed Tasks</span>
                  <span className="text-xl font-bold text-green-500">{taskInfo.taskClose}</span>
                </div>
              </div>
            </div>

            {/* List Header and Content */}
            <div className="flex-1 overflow-y-auto min-h-0 pr-1 space-y-3">
              {tasks.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {tasks.map((task) => (
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
                      <div className="space-y-1">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[9px] font-bold tracking-wider ${
                          task.status === "overdue"
                            ? "bg-rose-500/10 text-rose-500"
                            : task.status === "open"
                            ? "bg-yellow-500/10 text-yellow-500"
                            : "bg-emerald-500/10 text-emerald-500"
                        }`}>
                          {task.status === "overdue" ? "OVERDUE" : task.status === "open" ? "PENDING / OPEN" : "COMPLETED / CLOSED"}
                        </span>
                        <p className="text-xs font-semibold text-slate-800 dark:text-slate-200 leading-relaxed">
                          {task.title}
                        </p>
                      </div>

                      <div className="flex items-center justify-between border-t border-slate-100 dark:border-slate-800/80 pt-2.5">
                        <span className="text-[10px] text-slate-400 font-bold font-mono">
                          Source: {task.createdDate}
                        </span>
                        {onToggleCompleteTask && task.taskKey && (
                          <button
                            onClick={() => onToggleCompleteTask(task.taskKey!)}
                            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition duration-200 shadow-sm ${
                              task.status === "overdue" || task.status === "open"
                                ? "bg-emerald-500 hover:bg-emerald-600 text-white shadow-emerald-500/20"
                                : "bg-slate-200 hover:bg-slate-350 text-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700/80 shadow-slate-200/20"
                            }`}
                          >
                            {task.status === "overdue" || task.status === "open" ? "Mark Done" : "Reopen Task"}
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center text-slate-400 dark:text-slate-500 py-10 font-bold text-xs uppercase tracking-wide bg-slate-50 dark:bg-slate-950/20 border border-dashed border-slate-200 dark:border-slate-850 rounded-xl">
                  No running hours maintenance tasks triggered yet.
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
    </div>
  );
}