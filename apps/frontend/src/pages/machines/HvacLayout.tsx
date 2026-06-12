
import { type ReactNode } from "react";

export interface SetpointConfig {
  label: string;
  value: number;
  unit: string;
  min: number;
  max: number;
  step?: number;
  onChange: (val: number) => void;
}

export interface SystemModeItem {
  label: string;
  value: string;
  statusColor?: "cyan" | "green" | "red" | "yellow" | "default";
}

export interface ControlButtonItem {
  label: string;
  onClick: () => void;
  variant: "cyan" | "red" | "blue" | "slate" | "green" | "orange";
  icon?: ReactNode;
}

interface HvacLayoutProps {
  roomName: string;
  roomType: string;
  targetTemp: string;
  targetHumidity: string;
  diagramComponent: ReactNode;
  systemMode: SystemModeItem[];
  setpoints: SetpointConfig[];
  controlButtons: ControlButtonItem[];
}

export default function HvacLayout({
  roomName,
  roomType,
  targetTemp,
  targetHumidity,
  diagramComponent,
  systemMode,
  setpoints,
  controlButtons,
}: HvacLayoutProps) {
  
  const getStatusColorClass = (color?: string) => {
    switch (color) {
      case "cyan":
        return "text-cyan-600 dark:text-cyan-400";
      case "green":
        return "text-emerald-600 dark:text-emerald-400";
      case "red":
        return "text-rose-600 dark:text-rose-400";
      case "yellow":
        return "text-amber-600 dark:text-amber-400";
      default:
        return "text-slate-600 dark:text-slate-300";
    }
  };

  const getButtonClass = (variant: string) => {
    const base = "flex items-center justify-center gap-2 p-2.5 rounded-lg text-xs font-bold transition-all duration-200 border text-center shadow-sm hover:shadow-md active:scale-95";
    switch (variant) {
      case "cyan":
        return `${base} bg-cyan-50 dark:bg-cyan-950/40 text-cyan-700 dark:text-cyan-450 border-cyan-200 dark:border-cyan-800 hover:bg-cyan-100 dark:hover:bg-cyan-900/40`;
      case "red":
        return `${base} bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-450 border-rose-200 dark:border-rose-800 hover:bg-rose-100 dark:hover:bg-rose-900/40`;
      case "blue":
        return `${base} bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-450 border-blue-200 dark:border-blue-800 hover:bg-blue-100 dark:hover:bg-blue-900/40`;
      case "green":
        return `${base} bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-450 border-emerald-200 dark:border-emerald-800 hover:bg-emerald-100 dark:hover:bg-emerald-900/40`;
      case "orange":
        return `${base} bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-450 border-amber-200 dark:border-amber-800 hover:bg-amber-100 dark:hover:bg-amber-900/40`;
      default:
        return `${base} bg-slate-50 dark:bg-slate-800/50 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700/80`;
    }
  };

  return (
    <div className="flex flex-col h-full w-full gap-4 p-4 bg-slate-50/50 dark:bg-slate-950/50 rounded-xl transition-all duration-300">
      
      {/* TOP BAR: Room Info */}
      <div className="flex justify-between items-center bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-4 rounded-xl shadow-sm dark:shadow-2xl transition-all duration-300">
        <div>
          <div className="flex items-center gap-3">
            <h2 className="text-xl font-extrabold text-slate-800 dark:text-white tracking-wide">
              {roomName}
            </h2>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-cyan-100 dark:bg-cyan-950 text-cyan-800 dark:text-cyan-300 border border-cyan-200 dark:border-cyan-800 shadow-sm">
              Active Unit
            </span>
          </div>
          <p className="text-sm font-semibold text-slate-550 dark:text-slate-400 mt-0.5">
            {roomType}
          </p>
          <div className="flex items-center gap-2 text-xs text-cyan-600 dark:text-cyan-400 font-mono mt-1.5 bg-cyan-50 dark:bg-cyan-950/30 px-2.5 py-1 rounded-md border border-cyan-100 dark:border-cyan-900/30 w-fit">
            <span>Target:</span>
            <span className="font-semibold">{targetTemp}</span>
            {targetHumidity && (
              <>
                <span className="text-slate-300 dark:text-slate-700">|</span>
                <span className="font-semibold">{targetHumidity}</span>
              </>
            )}
          </div>
        </div>
        
        <div className="flex items-center gap-6 bg-slate-50 dark:bg-slate-950 px-4 py-3 rounded-lg border border-slate-150 dark:border-slate-900">
          <div className="flex flex-col items-end">
            <span className="text-[10px] text-slate-450 dark:text-slate-500 font-mono uppercase tracking-wider">MODE</span>
            <span className="text-sm text-cyan-600 dark:text-cyan-400 font-bold font-mono">Auto</span>
          </div>
          <div className="h-6 w-px bg-slate-200 dark:bg-slate-800"></div>
          <div className="flex flex-col items-end">
            <span className="text-[10px] text-slate-450 dark:text-slate-500 font-mono uppercase tracking-wider">STATUS</span>
            <span className="text-sm text-emerald-600 dark:text-emerald-400 font-bold font-mono flex items-center gap-1.5">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
              </span>
              Running
            </span>
          </div>
        </div>
      </div>

      {/* MAIN AREA: P&ID & SIDEBAR */}
      <div className="flex gap-4 flex-1 min-h-0">
        
        {/* P&ID Canvas */}
        <div className="flex-1 rounded-xl border border-slate-200 dark:border-slate-800 bg-white/70 dark:bg-slate-900/50 relative flex items-center justify-center p-2 min-h-0 shadow-sm transition-all duration-300 overflow-hidden">
          <div className="w-full h-full flex items-center justify-center overflow-hidden">
            {diagramComponent}
          </div>
        </div>

        {/* RIGHT SIDEBAR */}
        <div className="w-80 flex flex-col gap-4 h-full min-h-0">
          
          {/* SYSTEM MODE */}
          <div className="flex-[1.5] border border-slate-200 dark:border-slate-800 rounded-xl bg-white dark:bg-slate-900 p-4 flex flex-col min-h-0 shadow-sm dark:shadow-2xl transition-all duration-300">
            <h3 className="text-slate-800 dark:text-white font-bold font-mono text-sm border-b border-slate-100 dark:border-slate-800 pb-2 mb-3 tracking-wide">
              SYSTEM MODE
            </h3>
            <div className="flex-1 overflow-y-auto space-y-2.5 pr-1 text-xs">
              {systemMode.map((item, idx) => (
                <div key={idx} className="flex justify-between items-center py-0.5">
                  <span className="text-slate-500 dark:text-slate-400 font-medium">{item.label}</span>
                  <span className={`font-semibold font-mono ${getStatusColorClass(item.statusColor)}`}>
                    {item.value}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* SETPOINTS */}
          <div className="flex-[1.2] border border-slate-200 dark:border-slate-800 rounded-xl bg-white dark:bg-slate-900 p-4 flex flex-col min-h-[160px] shadow-sm dark:shadow-2xl transition-all duration-300">
            <h3 className="text-slate-800 dark:text-white font-bold font-mono text-sm border-b border-slate-100 dark:border-slate-800 pb-2 mb-3 tracking-wide">
              SETPOINTS
            </h3>
            <div className="flex-1 overflow-y-auto space-y-4 pr-1">
              {setpoints.map((sp, idx) => (
                <div key={idx} className="space-y-1.5">
                  <div className="flex justify-between text-xs font-mono">
                    <span className="text-slate-500 dark:text-slate-400 font-medium">{sp.label}</span>
                    <span className="text-slate-800 dark:text-white font-bold">{sp.value.toFixed(1)}{sp.unit}</span>
                  </div>
                  <div className="relative flex items-center group">
                    <input 
                      type="range" 
                      min={sp.min} 
                      max={sp.max} 
                      step={sp.step ?? 0.1}
                      value={sp.value}
                      onChange={(e) => sp.onChange(parseFloat(e.target.value))}
                      className="w-full h-1.5 bg-slate-100 dark:bg-slate-800 rounded-lg appearance-none cursor-pointer accent-cyan-600 dark:accent-cyan-400 transition-all duration-200" 
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* CONTROL PANEL */}
          <div className="flex-[1] border border-slate-200 dark:border-slate-800 rounded-xl bg-white dark:bg-slate-900 p-4 flex flex-col min-h-0 shadow-sm dark:shadow-2xl transition-all duration-300">
            <h3 className="text-slate-800 dark:text-white font-bold font-mono text-sm border-b border-slate-100 dark:border-slate-800 pb-2 mb-3 tracking-wide">
              CONTROL PANEL
            </h3>
            <div className="flex-1 overflow-y-auto pr-1">
              <div className="flex flex-col gap-2">
                {controlButtons.map((btn, idx) => (
                  <button 
                    key={idx} 
                    onClick={btn.onClick} 
                    className={getButtonClass(btn.variant)}
                  >
                    {btn.icon && <span>{btn.icon}</span>}
                    {btn.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}