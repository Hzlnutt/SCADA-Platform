import { useRef, useState, type ReactNode } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { getJson } from "../../services/api.client";

// --- Type Definitions ---
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
    <div className="flex flex-col xl:flex-row gap-5 items-start w-full">
      {/* Canvas Area */}
      <section className="flex-1 w-full min-w-0 flex flex-col rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950/70 p-3 sm:p-5 shadow-sm transition-colors duration-300">
        {/* Top Bar */}
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          <div className="text-xs uppercase tracking-[0.2em] text-[#1f6fb5] dark:text-sky-400 font-extrabold">
            P&ID Diagram Canvas — {machineName}
          </div>
          <div className="text-[11px] text-slate-400 dark:text-slate-500 font-medium">
            (Geser horizontal jika diagram terpotong pada layar kecil)
          </div>
        </div>

        {/* Canvas Wrapper with horizontal scroll */}
        <div className="overflow-x-auto scrollbar-thin rounded-xl border border-slate-100 dark:border-slate-800">
          <div
            className="relative w-full min-w-[760px] md:min-w-[900px] rounded-lg border border-dashed border-slate-300 dark:border-slate-700 bg-slate-900"
            style={{ aspectRatio: "1836 / 1110" }}
          >
            {children}
          </div>
        </div>
      </section>

      {/* Side Panel: Tasks & Alarms (stacks below on <xl, side-by-side on xl+) */}
      <div className="w-full xl:w-96 shrink-0 flex flex-col sm:flex-row xl:flex-col gap-4">
        {/* Task Card */}
        <div className="flex-1 flex flex-col rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 shadow-sm overflow-hidden min-h-[300px] max-h-[500px]">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-xs uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400 font-extrabold">
              Task Information
            </h3>
            <button
              onClick={() => navigate(`/machines/${groupId}/${unitId}/tasks`)}
              className="text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-md shadow-xs transition duration-150 bg-[#1f6fb5] hover:bg-[#155c99] text-white cursor-pointer"
            >
              Detail Tasks
            </button>
          </div>
          <div className="space-y-1.5 mb-2">
            <button
              onClick={() => onFilterChange("overdue")}
              className={`w-full text-left flex justify-between items-center px-2 py-1.5 rounded-lg border transition-colors cursor-pointer ${
                selectedTaskFilter === "overdue"
                  ? "bg-rose-50 dark:bg-rose-950/40 border-rose-500 dark:border-rose-400 text-rose-700 dark:text-rose-200"
                  : "bg-slate-50 dark:bg-slate-800/60 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:border-rose-400"
              }`}
            >
              <span className="text-xs font-semibold">Task Overdue</span>
              <span className="text-sm font-bold font-mono text-rose-500 dark:text-rose-400">
                {taskInfo.taskOverdue}
              </span>
            </button>
            <button
              onClick={() => onFilterChange("open")}
              className={`w-full text-left flex justify-between items-center px-2 py-1.5 rounded-lg border transition-colors cursor-pointer ${
                selectedTaskFilter === "open"
                  ? "bg-amber-50 dark:bg-amber-950/40 border-amber-500 dark:border-amber-400 text-amber-700 dark:text-amber-200"
                  : "bg-slate-50 dark:bg-slate-800/60 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:border-amber-400"
              }`}
            >
              <span className="text-xs font-semibold">Task Open</span>
              <span className="text-sm font-bold font-mono text-amber-500 dark:text-amber-400">
                {taskInfo.taskOpen}
              </span>
            </button>
            <button
              onClick={() => onFilterChange("close")}
              className={`w-full text-left flex justify-between items-center px-2 py-1.5 rounded-lg border transition-colors cursor-pointer ${
                selectedTaskFilter === "close"
                  ? "bg-emerald-50 dark:bg-emerald-950/40 border-emerald-500 dark:border-emerald-400 text-emerald-700 dark:text-emerald-200"
                  : "bg-slate-50 dark:bg-slate-800/60 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:border-emerald-400"
              }`}
            >
              <span className="text-xs font-semibold">Task Close</span>
              <span className="text-sm font-bold font-mono text-emerald-500 dark:text-emerald-400">
                {taskInfo.taskClose}
              </span>
            </button>
          </div>
          <div className="text-[11px] text-slate-500 dark:text-slate-400 font-bold mb-1">
            Keterangan ({filteredTasks.length})
          </div>
          <div className="flex-1 overflow-y-auto space-y-2 pr-1 scrollbar-thin">
            {filteredTasks.length > 0 ? (
              filteredTasks.map((task) => (
                <div
                  key={task.id}
                  className={`rounded-xl border p-2.5 text-xs bg-slate-50 dark:bg-slate-800/60 ${
                    task.status === "overdue"
                      ? "border-rose-400 dark:border-rose-500"
                      : task.status === "open"
                      ? "border-amber-400 dark:border-amber-500"
                      : "border-emerald-400 dark:border-emerald-500"
                  }`}
                >
                  <div className="font-semibold text-slate-900 dark:text-slate-100">{task.title}</div>
                  <div className="text-slate-600 dark:text-slate-400 mt-1.5 flex items-center justify-between">
                    <span
                      className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold ${
                        task.status === "overdue"
                          ? "bg-rose-500/10 text-rose-500 border border-rose-500/25"
                          : task.status === "open"
                          ? "bg-amber-500/10 text-amber-500 border border-amber-500/25"
                          : "bg-emerald-500/10 text-emerald-500 border border-emerald-500/25"
                      }`}
                    >
                      {task.status === "overdue" ? "OVERDUE" : task.status === "open" ? "OPEN" : "CLOSE"}
                    </span>
                  </div>
                </div>
              ))
            ) : (
              <div className="text-center text-slate-400 dark:text-slate-500 py-4 text-xs">Tidak ada task</div>
            )}
          </div>
        </div>

        {/* Alarm Card */}
        <div className="flex-1 flex flex-col rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 shadow-sm overflow-hidden min-h-[300px] max-h-[500px]">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-xs uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400 font-extrabold">
              Alarms
            </h3>
            <button
              onClick={() => navigate("../alarm")}
              className="text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-md shadow-xs transition duration-150 bg-[#1f6fb5] hover:bg-[#155c99] text-white cursor-pointer"
            >
              Detail Records
            </button>
          </div>
          <div className="flex-1 overflow-y-auto space-y-2 pr-1 scrollbar-thin">
            {alarms.length > 0 ? (
              alarms.map((alarm) => (
                <div
                  key={alarm.id}
                  className={`border rounded-xl p-2.5 bg-slate-50 dark:bg-slate-800/60 ${
                    alarm.severity === "critical"
                      ? "border-rose-500 dark:border-rose-400"
                      : alarm.severity === "warning"
                      ? "border-amber-500 dark:border-amber-400"
                      : "border-slate-200 dark:border-slate-700"
                  }`}
                >
                  <div className="flex items-start gap-2">
                    <div
                      className={`w-2 h-2 rounded-full mt-1.5 shrink-0 ${
                        alarm.severity === "critical"
                          ? "bg-rose-500 animate-pulse"
                          : alarm.severity === "warning"
                          ? "bg-amber-500"
                          : "bg-blue-500"
                      }`}
                    />
                    <div className="flex-1 min-w-0">
                      <div
                        className={`text-xs font-mono font-bold ${
                          alarm.severity === "critical"
                            ? "text-rose-600 dark:text-rose-400"
                            : "text-amber-600 dark:text-amber-400"
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
