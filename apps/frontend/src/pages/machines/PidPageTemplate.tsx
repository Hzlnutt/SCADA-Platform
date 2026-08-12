import { useRef, useState, type ReactNode } from "react";
import { useNavigate, useParams } from "react-router-dom";
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
  const navigate = useNavigate();
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

  const { groupId, unitId } = useParams<{ groupId: string; unitId: string }>();

  const filteredTasks =
    selectedTaskFilter === "all"
      ? tasks
      : selectedTaskFilter === "overdue"
      ? tasks.filter((t) => t.status === "overdue")
      : selectedTaskFilter === "open"
      ? tasks.filter((t) => t.status === "open")
      : tasks.filter((t) => t.status === "close");

  return (
    <div className="flex flex-col gap-4 w-full">
      {/* Canvas Area */}
      <section className="w-full flex flex-col rounded-lg border border-slate-800 dark:border-slate-600 bg-slate-950/70 dark:bg-slate-950/90 p-3 sm:p-5">
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

      {/* Bottom Sidebar Cards (Task & Alarm) */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 w-full h-[400px]">
        {/* Task Card */}
        <div
          className="flex flex-col rounded-lg border border-slate-800 dark:border-slate-600 bg-slate-950/70 dark:bg-slate-950/90 p-4 overflow-hidden h-full"
        >
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-xs uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400 font-semibold">
              Task Information
            </h3>
            <button
              onClick={() => navigate(`/machines/${groupId}/${unitId}/tasks`)}
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
          className="flex flex-col rounded-lg border border-slate-800 dark:border-slate-600 bg-slate-950/70 dark:bg-slate-950/90 p-4 overflow-hidden h-full"
        >
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-xs uppercase tracking-[0.2em] text-slate-700 dark:text-slate-300 font-semibold">
              Alarms
            </h3>
            <button
              onClick={() => navigate("../alarm")}
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
                        className={`text-xs font-mono font-bold ${
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
    </div>
  );
}