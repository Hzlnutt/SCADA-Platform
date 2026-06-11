import { useRef, type ReactNode } from "react";

// --- Type Definitions (bisa dipindah ke file types.ts) ---
export interface Task {
  id: number;
  title: string;
  status: "open" | "close";
  openedMonth: boolean;
  createdDate: string;
}

export interface Alarm {
  id: number;
  code: string;
  message: string;
  severity: "warning" | "critical" | "info";
}

export interface TaskInfo {
  openThisMonth: number;
  taskOpen: number;
  taskClose: number;
}

interface PidPageTemplateProps {
  machineName: string;
  allOn: boolean;
  onToggleAllOn: () => void;
  tasks: Task[];
  selectedTaskFilter: "all" | "open_month" | "open" | "close";
  onFilterChange: (filter: "all" | "open_month" | "open" | "close") => void;
  taskInfo: TaskInfo;
  alarms: Alarm[];
  children: ReactNode;
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

  const filteredTasks =
    selectedTaskFilter === "all"
      ? tasks
      : selectedTaskFilter === "open_month"
      ? tasks.filter((t) => t.openedMonth && t.status === "open")
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
          <button
            onClick={onToggleAllOn}
            className={`rounded px-3 py-1 text-xs font-mono transition-colors ${
              allOn
                ? "bg-cyan-900/60 text-cyan-400 border border-cyan-700 dark:bg-cyan-900/80 dark:text-cyan-300 dark:border-cyan-600"
                : "bg-slate-800 text-slate-400 border border-slate-700 dark:bg-slate-700 dark:text-slate-300 dark:border-slate-600"
            }`}
          >
            {allOn ? "● FLOW ON" : "○ FLOW OFF"} (demo)
          </button>
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
          <h3 className="text-xs uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400 font-semibold mb-3">
            Task Information
          </h3>
          <div className="space-y-1.5 mb-2">
            <button
              onClick={() => onFilterChange("open_month")}
              className={`w-full text-left flex justify-between items-center px-2 py-1.5 rounded border-2 transition-colors ${
                selectedTaskFilter === "open_month"
                  ? "bg-white dark:bg-slate-700 border-cyan-500 dark:border-cyan-400 text-slate-900 dark:text-slate-100"
                  : "bg-white dark:bg-slate-800 border-slate-300 dark:border-slate-600 text-slate-900 dark:text-slate-200 hover:border-cyan-400 dark:hover:border-cyan-400"
              }`}
            >
              <span className="text-xs font-medium">Task Open (Bulan Ini)</span>
              <span className={`text-base font-semibold ${selectedTaskFilter === "open_month" ? "text-cyan-500 dark:text-cyan-400" : "text-cyan-500 dark:text-cyan-400"}`}>
                {taskInfo.openThisMonth}
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
              <span className="text-xs font-medium">Task Open</span>
              <span className={`text-base font-semibold ${selectedTaskFilter === "open" ? "text-yellow-500 dark:text-yellow-400" : "text-yellow-500 dark:text-yellow-400"}`}>
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
              <span className="text-xs font-medium">Task Close</span>
              <span className={`text-base font-semibold ${selectedTaskFilter === "close" ? "text-green-500 dark:text-green-400" : "text-green-500 dark:text-green-400"}`}>
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
                    task.status === "open"
                      ? "border-yellow-400 dark:border-yellow-500"
                      : "border-green-400 dark:border-green-500"
                  }`}
                >
                  <div className="font-medium text-slate-900 dark:text-slate-100">{task.title}</div>
                  <div className="text-slate-600 dark:text-slate-400 mt-1">
                    <span
                      className={`inline-block px-2 py-0.5 rounded text-xs font-semibold ${
                        task.status === "open"
                          ? "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/50 dark:text-yellow-300"
                          : "bg-green-100 text-green-700 dark:bg-green-900/50 dark:text-green-300"
                      }`}
                    >
                      {task.status === "open" ? "OPEN" : "CLOSE"}
                    </span>
                    <span className="text-slate-500 dark:text-slate-400 ml-2 text-xs">
                      {task.createdDate}
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
    </div>
  );
}