import { useState, useEffect, useMemo } from "react";
import { Link } from "react-router-dom";
import { PageHeader } from "../../components/ui/PageHeader";
import { useSystemStore } from "../../store/system.store";

/* ═══════════ WATER COST HELPER ═══════════ */
const COST_PER_M3 = 8500; // Base cost per m³ for estimation

function formatCostIDR(v: number) {
  return new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(v);
}

/* ═══════════ FLOW DATA TYPES ═══════════ */
interface FlowNode {
  id: string;
  label: string;
  flowLpm: number;
  dailyM3: number;
  type: "pump" | "tank" | "distribution" | "factory" | "subdist";
  status?: "RUN" | "STOP" | "ALERT";
  tankLevel?: number;
  tankCapacity?: number;
}

/* ═══════════ INITIAL MOCK FLOW DATA ═══════════ */
const INITIAL_DATA: Record<string, FlowNode> = {
  "dw3": { id: "dw3", label: "DW-3", flowLpm: 157, dailyM3: 0, type: "pump", status: "RUN" },
  "dw4": { id: "dw4", label: "DW-4", flowLpm: 165, dailyM3: 0, type: "pump", status: "RUN" },
  "tank1": { id: "tank1", label: "Tank-1", flowLpm: 0, dailyM3: 0, type: "tank", tankLevel: 65, tankCapacity: 50000 },
  "tank2": { id: "tank2", label: "Tank-2", flowLpm: 0, dailyM3: 0, type: "tank", tankLevel: 89, tankCapacity: 50000 },
  "multimedia": { id: "multimedia", label: "Multimedia", flowLpm: 19.3, dailyM3: 39, type: "distribution" },
  "hydrant-main": { id: "hydrant-main", label: "Hydrant", flowLpm: 25.7, dailyM3: 8, type: "distribution", status: "ALERT" },
  "sanitari1": { id: "sanitari1", label: "Sanitari-1", flowLpm: 44.0, dailyM3: 33, type: "distribution" },
  "sanitari2": { id: "sanitari2", label: "Sanitari-2", flowLpm: 38.6, dailyM3: 43, type: "distribution" },
  "softener1": { id: "softener1", label: "Softener-1", flowLpm: 42.1, dailyM3: 58, type: "distribution" },
  "softener2": { id: "softener2", label: "Softener-2", flowLpm: 42.2, dailyM3: 40, type: "distribution" },
  "factory1": { id: "factory1", label: "Factory-1", flowLpm: 42.4, dailyM3: 92, type: "factory" },
  "factory1tank": { id: "factory1tank", label: "Factory-1 Tank", flowLpm: 0, dailyM3: 0, type: "tank", tankLevel: 73, tankCapacity: 100000 },
  "wf1u1": { id: "wf1u1", label: "WF1U1", flowLpm: 8.5, dailyM3: 23, type: "subdist" },
  "wf1u2": { id: "wf1u2", label: "WF1U2", flowLpm: 26.1, dailyM3: 21, type: "subdist" },
  "wf1u3": { id: "wf1u3", label: "WF1U3", flowLpm: 1.1, dailyM3: 29, type: "subdist" },
  "sanitari1-sub": { id: "sanitari1-sub", label: "Sanitari-1", flowLpm: 24.9, dailyM3: 13, type: "subdist" },
  "sanitari2-sub": { id: "sanitari2-sub", label: "Sanitari-2", flowLpm: 29.7, dailyM3: 12, type: "subdist" },
  "hydrant-sub": { id: "hydrant-sub", label: "Hydrant", flowLpm: 14.8, dailyM3: 4, type: "subdist", status: "ALERT" },
  "csr": { id: "csr", label: "CSR", flowLpm: 8.2, dailyM3: 6.5, type: "distribution" },
};

/* ═══════════ SUB COMPONENTS WITH THEME AWARENESS ═══════════ */

function PumpCard({ node, isDark }: { node: FlowNode; isDark: boolean }) {
  const isRun = node.status === "RUN";
  return (
    <div className={`rounded-xl border p-3 text-center w-[110px] shadow-lg transition duration-300 ${
      isDark 
        ? "bg-slate-900 border-slate-800 text-white" 
        : "bg-slate-50 border-slate-200 text-slate-800"
    }`}>
      <div className="text-[10px] font-bold text-slate-400 mb-0.5">🔌 DW Pump</div>
      <div className="text-xs font-extrabold">{node.label}</div>
      <div className="flex items-center justify-center gap-1.5 mt-1.5">
        <span className={`h-2 w-2 rounded-full ${isRun ? "bg-emerald-500 animate-pulse" : "bg-red-500"}`} 
              style={{ boxShadow: isRun ? "0 0 6px #10b981" : "0 0 6px #ef4444" }} />
        <span className={`text-[10px] font-extrabold ${isRun ? "text-emerald-500" : "text-red-500"}`}>{node.status}</span>
      </div>
      <div className="text-[10px] font-bold text-sky-500 font-mono mt-1">{node.flowLpm} L/min</div>
    </div>
  );
}

function TankCard({ node, isDark }: { node: FlowNode; isDark: boolean }) {
  const level = node.tankLevel ?? 0;
  const cap = node.tankCapacity ?? 1;
  const actualLiters = Math.round(cap * level / 100);
  const color = level > 70 ? "#10b981" : level > 40 ? "#eab308" : "#ef4444";

  return (
    <div className={`rounded-xl border p-3 text-center w-[130px] shadow-lg relative overflow-hidden transition duration-300 ${
      isDark 
        ? "bg-slate-900 border-slate-800 text-white" 
        : "bg-slate-50 border-slate-200 text-slate-800"
    }`}>
      {/* Tank level background */}
      <div className="absolute bottom-0 left-0 right-0 transition-all duration-1000 opacity-15" style={{ height: `${level}%`, backgroundColor: color }} />
      <div className="relative z-10">
        <div className="text-[10px] font-bold text-slate-400 mb-0.5">🏗️ Tank</div>
        <div className="text-xs font-extrabold">{node.label}</div>
        <div className="text-xl font-extrabold font-mono mt-1" style={{ color }}>{level}%</div>
        <div className="text-[9px] text-slate-400 font-bold">{(cap).toLocaleString("id-ID")} L</div>
        <div className="text-[9px] text-slate-500 font-mono">{actualLiters.toLocaleString("id-ID")} L</div>
      </div>
    </div>
  );
}

function DistCard({ node, costColor, isDark }: { node: FlowNode; costColor?: string; isDark: boolean }) {
  const cost = node.dailyM3 * 30 * COST_PER_M3;
  const isAlert = node.status === "ALERT";
  
  const borderColor = isAlert 
    ? "border-red-500/50" 
    : isDark ? "border-cyan-500/20" : "border-slate-200";
  
  const textColor = isAlert ? "text-red-500 dark:text-red-400" : "text-sky-500";
  
  const bgColor = isAlert 
    ? (isDark ? "bg-red-950/20" : "bg-red-50/50") 
    : (isDark ? "bg-slate-900/90" : "bg-slate-50");

  return (
    <div className={`rounded-xl border ${borderColor} ${bgColor} px-3 py-1.5 shadow-md flex items-center justify-between gap-3 w-[180px] transition duration-300`}>
      <div>
        <div className={`text-[11px] font-extrabold ${isDark ? "text-white" : "text-slate-800"}`}>{node.label}</div>
        <div className={`text-[9px] font-bold font-mono ${textColor}`}>
          {node.flowLpm} L/m · {node.dailyM3} m³/d
        </div>
      </div>
      <div className="text-right">
        <div className={`text-[7px] font-bold uppercase tracking-wider ${costColor || "text-emerald-500"}`}>Cost/bln</div>
        <div className={`text-[9px] font-extrabold font-mono ${costColor || "text-emerald-500"}`}>{formatCostIDR(cost)}</div>
      </div>
    </div>
  );
}

/* ═══════════ SUBNAV ═══════════ */
function WaterSubNav() {
  return (
    <div className="flex border-b border-slate-200 dark:border-slate-800 mb-6">
      <Link
        to="/air"
        className="border-b-2 border-transparent hover:border-slate-300 dark:hover:border-slate-700 px-4 py-2.5 text-xs font-semibold text-slate-500 dark:text-slate-400 tracking-wider uppercase transition-all duration-200"
      >
        Overview
      </Link>
      <Link
        to="/air/distribusi"
        className="border-b-2 border-cyan-500 px-4 py-2.5 text-xs font-extrabold text-cyan-600 dark:text-cyan-400 tracking-wider uppercase transition-all duration-200"
      >
        Distribusi Air
      </Link>
      <Link
        to="/air/energy"
        className="border-b-2 border-transparent hover:border-slate-300 dark:hover:border-slate-700 px-4 py-2.5 text-xs font-semibold text-slate-500 dark:text-slate-400 tracking-wider uppercase transition-all duration-200"
      >
        Energy
      </Link>
    </div>
  );
}

/* ═══════════ MAIN COMPONENT ═══════════ */
export default function WaterDistribution() {
  const theme = useSystemStore((state) => state.theme);
  const isDark = theme === "dark";

  const [flowData, setFlowData] = useState(INITIAL_DATA);

  // Simulate small jitter in flow values
  useEffect(() => {
    const interval = setInterval(() => {
      setFlowData(prev => {
        const next = { ...prev };
        Object.keys(next).forEach(key => {
          const node = { ...next[key] };
          if (node.type === "pump" || node.type === "distribution" || node.type === "subdist" || node.type === "factory") {
            node.flowLpm = Math.max(0, +(node.flowLpm + (Math.random() - 0.5) * 2).toFixed(1));
          }
          if (node.type === "tank" && node.tankLevel !== undefined) {
            node.tankLevel = Math.max(10, Math.min(98, +(node.tankLevel + (Math.random() - 0.5) * 0.8).toFixed(0)));
          }
          next[key] = node;
        });
        return next;
      });
    }, 4000);
    return () => clearInterval(interval);
  }, []);

  const totalDailyM3 = useMemo(() => {
    // Only sum the main distribution lines (excluding sub-distributions and raw pumps) to avoid double counting
    return ["multimedia", "hydrant-main", "sanitari1", "sanitari2", "softener1", "softener2", "factory1", "csr"]
      .reduce((sum, key) => sum + (flowData[key]?.dailyM3 ?? 0), 0);
  }, [flowData]);

  const totalMonthlyCost = totalDailyM3 * 30 * COST_PER_M3;

  // Colors for lines depending on theme
  const lineColor = isDark ? "#334155" : "#cbd5e1";
  const activeLineColor = isDark ? "#06b6d4" : "#3b82f6";
  const orangeLineColor = "#f97316";

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <PageHeader title="Water Utility — Distribusi Air" description="Monitoring jalur aliran air dari deepwell, softener, purifikasi hingga ke titik distribusi factory." />
        <div className="flex items-center gap-3">
          <div className="px-4 py-2 rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-sm flex items-center gap-3">
            <span className="text-[10px] font-extrabold uppercase text-slate-400">Total Daily</span>
            <span className="text-sm font-extrabold font-mono text-slate-800 dark:text-white">{totalDailyM3.toFixed(0)} <span className="text-[10px] text-slate-400">m³/d</span></span>
          </div>
          <div className="px-4 py-2 rounded-2xl border border-emerald-500/30 bg-emerald-500/5 shadow-sm flex items-center gap-3">
            <span className="text-[10px] font-extrabold uppercase text-emerald-500">Est. Monthly Cost</span>
            <span className="text-sm font-extrabold font-mono text-emerald-500">{formatCostIDR(totalMonthlyCost)}</span>
          </div>
        </div>
      </div>

      <WaterSubNav />

      {/* ═══════════ SYSTEM FLOW DIAGRAM (SVG Canvas Overlay) ═══════════ */}
      <section className={`rounded-2xl border p-6 shadow-xl relative transition-all duration-300 overflow-x-auto ${
        isDark ? "border-slate-800 bg-slate-950" : "border-slate-200 bg-white"
      }`} style={{ minWidth: 1200 }}>
        
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className={`text-sm font-extrabold flex items-center gap-2 ${isDark ? "text-white" : "text-slate-800"}`}>
              <span className="text-blue-500">💧</span> System Flow Diagram
            </h3>
            <p className="text-[10px] text-slate-400 mt-0.5">Alur distribusi air dari sumber ke konsumen</p>
          </div>
          {/* Legend */}
          <div className="flex items-center gap-4 text-[9px] font-bold text-slate-400">
            <span className="flex items-center gap-1.5"><span className="w-5 h-0 border-t-2 border-dashed border-sky-500" /> Active Flow</span>
            <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-emerald-500" /> Online</span>
            <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-red-500" /> Hydrant/Alert</span>
            <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-orange-500" /> Pipeline (Factory Line)</span>
          </div>
        </div>

        {/* Relative Canvas Container of 1200x580 */}
        <div className="relative w-[1200px] h-[580px] select-none mx-auto">
          
          {/* 1. SVG OVERLAY FOR PRECISION PIPELINE LINES */}
          <svg className="absolute inset-0 w-full h-full pointer-events-none z-0">
            <defs>
              <marker id="arrow-blue" viewBox="0 0 10 10" refX="6" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
                <path d="M 0 2 L 8 5 L 0 8 z" fill={activeLineColor} />
              </marker>
              <marker id="arrow-orange" viewBox="0 0 10 10" refX="6" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
                <path d="M 0 2 L 8 5 L 0 8 z" fill={orangeLineColor} />
              </marker>
            </defs>

            {/* Line from DW Pumps to Tank inputs */}
            {/* DW-3 center is 95, DW-4 center is 225. Merge point is 160 */}
            <path d="M 95 440 L 95 410 L 225 410 L 225 440" fill="none" stroke={activeLineColor} strokeWidth="2.5" strokeDasharray="3 3" />
            <path d="M 160 410 L 160 305 L 200 305" fill="none" stroke={activeLineColor} strokeWidth="2.5" strokeDasharray="3 3" markerEnd="url(#arrow-blue)" />
            <path d="M 160 250 L 160 145 L 200 145" fill="none" stroke={activeLineColor} strokeWidth="2.5" strokeDasharray="3 3" markerEnd="url(#arrow-blue)" />

            {/* Line from Tanks to Distribution split */}
            {/* Tank output right edges are 330. Vertical merge is at 380 */}
            <path d="M 330 145 L 380 145 L 380 305 L 330 305" fill="none" stroke={activeLineColor} strokeWidth="2.5" strokeDasharray="3 3" />
            <path d="M 380 225 L 410 225" fill="none" stroke={activeLineColor} strokeWidth="2.5" strokeDasharray="3 3" />

            {/* Vertical Split Line for 8 nodes */}
            <path d="M 410 35 L 410 490" fill="none" stroke={activeLineColor} strokeWidth="2.5" strokeDasharray="3 3" />
            
            {/* Horizontal branches into distribution nodes */}
            <path d="M 410 35 L 450 35" fill="none" stroke={activeLineColor} strokeWidth="2.5" strokeDasharray="3 3" markerEnd="url(#arrow-blue)" />
            <path d="M 410 100 L 450 100" fill="none" stroke={activeLineColor} strokeWidth="2.5" strokeDasharray="3 3" markerEnd="url(#arrow-blue)" />
            <path d="M 410 165 L 450 165" fill="none" stroke={activeLineColor} strokeWidth="2.5" strokeDasharray="3 3" markerEnd="url(#arrow-blue)" />
            <path d="M 410 230 L 450 230" fill="none" stroke={activeLineColor} strokeWidth="2.5" strokeDasharray="3 3" markerEnd="url(#arrow-blue)" />
            <path d="M 410 295 L 450 295" fill="none" stroke={activeLineColor} strokeWidth="2.5" strokeDasharray="3 3" markerEnd="url(#arrow-blue)" />
            <path d="M 410 360 L 450 360" fill="none" stroke={activeLineColor} strokeWidth="2.5" strokeDasharray="3 3" markerEnd="url(#arrow-blue)" />
            <path d="M 410 425 L 450 425" fill="none" stroke={activeLineColor} strokeWidth="2.5" strokeDasharray="3 3" markerEnd="url(#arrow-blue)" />
            <path d="M 410 490 L 450 490" fill="none" stroke={activeLineColor} strokeWidth="2.5" strokeDasharray="3 3" markerEnd="url(#arrow-blue)" />

            {/* Pipeline from Factory-1 to Factory-1 Tank */}
            {/* Factory-1 output right is 630. Tank left is 740. Tank center Y is 335 */}
            <path d="M 630 425 L 690 425 L 690 335 L 740 335" fill="none" stroke={orangeLineColor} strokeWidth="3.5" strokeDasharray="5 5" markerEnd="url(#arrow-orange)" />
            
            {/* Pipeline Text Label */}
            <text x="645" y="325" fill={orangeLineColor} fontSize="8" fontWeight="800" letterSpacing="0.1em">⚙️ PIPELINE</text>

            {/* Factory-1 Tank Output Split to Sub-distributions */}
            {/* Tank right is 870. Vertical merge is at 940 */}
            <path d="M 870 335 L 940 335" fill="none" stroke={activeLineColor} strokeWidth="2.5" strokeDasharray="3 3" />
            <path d="M 940 90 L 940 415" fill="none" stroke={activeLineColor} strokeWidth="2.5" strokeDasharray="3 3" />

            {/* Sub-dist horizontal branches */}
            <path d="M 940 90 L 980 90" fill="none" stroke={activeLineColor} strokeWidth="2.5" strokeDasharray="3 3" markerEnd="url(#arrow-blue)" />
            <path d="M 940 155 L 980 155" fill="none" stroke={activeLineColor} strokeWidth="2.5" strokeDasharray="3 3" markerEnd="url(#arrow-blue)" />
            <path d="M 940 220 L 980 220" fill="none" stroke={activeLineColor} strokeWidth="2.5" strokeDasharray="3 3" markerEnd="url(#arrow-blue)" />
            <path d="M 940 285 L 980 285" fill="none" stroke={activeLineColor} strokeWidth="2.5" strokeDasharray="3 3" markerEnd="url(#arrow-blue)" />
            <path d="M 940 350 L 980 350" fill="none" stroke={activeLineColor} strokeWidth="2.5" strokeDasharray="3 3" markerEnd="url(#arrow-blue)" />
            <path d="M 940 415 L 980 415" fill="none" stroke={activeLineColor} strokeWidth="2.5" strokeDasharray="3 3" markerEnd="url(#arrow-blue)" />
          </svg>

          {/* 2. CARD NODES PLACED ABSOLUTELY */}

          {/* Pumps */}
          <div className="absolute z-10" style={{ left: 40, top: 440 }}><PumpCard node={flowData["dw3"]} isDark={isDark} /></div>
          <div className="absolute z-10" style={{ left: 170, top: 440 }}><PumpCard node={flowData["dw4"]} isDark={isDark} /></div>

          {/* Source Tanks */}
          <div className="absolute z-10" style={{ left: 200, top: 90 }}><TankCard node={flowData["tank1"]} isDark={isDark} /></div>
          <div className="absolute z-10" style={{ left: 200, top: 250 }}><TankCard node={flowData["tank2"]} isDark={isDark} /></div>

          {/* Distribution Nodes */}
          <div className="absolute z-10" style={{ left: 450, top: 15 }}><DistCard node={flowData["multimedia"]} isDark={isDark} /></div>
          <div className="absolute z-10" style={{ left: 450, top: 80 }}><DistCard node={flowData["hydrant-main"]} costColor="text-rose-500" isDark={isDark} /></div>
          <div className="absolute z-10" style={{ left: 450, top: 145 }}><DistCard node={flowData["sanitari1"]} isDark={isDark} /></div>
          <div className="absolute z-10" style={{ left: 450, top: 210 }}><DistCard node={flowData["sanitari2"]} isDark={isDark} /></div>
          <div className="absolute z-10" style={{ left: 450, top: 275 }}><DistCard node={flowData["softener1"]} isDark={isDark} /></div>
          <div className="absolute z-10" style={{ left: 450, top: 340 }}><DistCard node={flowData["softener2"]} isDark={isDark} /></div>
          <div className="absolute z-10" style={{ left: 450, top: 405 }}><DistCard node={flowData["factory1"]} costColor="text-orange-500" isDark={isDark} /></div>
          <div className="absolute z-10" style={{ left: 450, top: 470 }}><DistCard node={flowData["csr"]} isDark={isDark} /></div>

          {/* Factory 1 Buffer Tank */}
          <div className="absolute z-10" style={{ left: 740, top: 280 }}><TankCard node={flowData["factory1tank"]} isDark={isDark} /></div>

          {/* Sub-distribution Nodes under Factory 1 */}
          <div className="absolute z-10" style={{ left: 980, top: 70 }}><DistCard node={flowData["wf1u1"]} isDark={isDark} /></div>
          <div className="absolute z-10" style={{ left: 980, top: 135 }}><DistCard node={flowData["wf1u2"]} isDark={isDark} /></div>
          <div className="absolute z-10" style={{ left: 980, top: 200 }}><DistCard node={flowData["wf1u3"]} isDark={isDark} /></div>
          <div className="absolute z-10" style={{ left: 980, top: 265 }}><DistCard node={flowData["sanitari1-sub"]} isDark={isDark} /></div>
          <div className="absolute z-10" style={{ left: 980, top: 330 }}><DistCard node={flowData["sanitari2-sub"]} isDark={isDark} /></div>
          <div className="absolute z-10" style={{ left: 980, top: 395 }}><DistCard node={flowData["hydrant-sub"]} costColor="text-rose-500" isDark={isDark} /></div>

        </div>
      </section>

      {/* ═══════════ COST SUMMARY TABLE ═══════════ */}
      <section className={`rounded-2xl border p-5 shadow-sm transition-all duration-300 ${
        isDark ? "border-slate-800 bg-slate-900" : "border-slate-200 bg-white"
      }`}>
        <h3 className={`text-xs font-extrabold uppercase tracking-wider mb-4 ${isDark ? "text-slate-400" : "text-slate-500"}`}>
          💰 Estimasi Cost Distribusi Air per Jalur
        </h3>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-slate-100 dark:border-slate-800 text-[10px] uppercase tracking-wider text-[#47729f] dark:text-slate-500 font-bold">
                <th className="pb-2.5 px-3">Jalur</th>
                <th className="pb-2.5 px-3">Flow (L/min)</th>
                <th className="pb-2.5 px-3">Harian (m³/d)</th>
                <th className="pb-2.5 px-3">Bulanan (m³)</th>
                <th className="pb-2.5 px-3 text-right">Est. Cost/Bulan</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 font-semibold text-slate-700 dark:text-slate-300">
              {Object.values(flowData)
                .filter(n => n.type === "distribution" || n.type === "subdist" || n.type === "factory")
                .map(node => {
                  const monthlyM3 = node.dailyM3 * 30;
                  const monthlyCost = monthlyM3 * COST_PER_M3;
                  const isAlert = node.status === "ALERT";
                  return (
                    <tr key={node.id} className={`hover:bg-slate-50/50 dark:hover:bg-slate-800/10 ${isAlert ? "text-red-500" : ""}`}>
                      <td className="py-2.5 px-3 font-bold">{node.label}</td>
                      <td className="py-2.5 px-3 font-mono">{node.flowLpm.toFixed(1)}</td>
                      <td className="py-2.5 px-3 font-mono">{node.dailyM3}</td>
                      <td className="py-2.5 px-3 font-mono">{monthlyM3.toLocaleString("id-ID")}</td>
                      <td className="py-2.5 px-3 text-right font-mono font-bold text-emerald-500">{formatCostIDR(monthlyCost)}</td>
                    </tr>
                  );
                })}
              {/* Total row */}
              <tr className="border-t-2 border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/20 font-extrabold">
                <td className="py-3 px-3 text-slate-800 dark:text-white">TOTAL</td>
                <td className="py-3 px-3" />
                <td className="py-3 px-3 font-mono text-slate-800 dark:text-white">{totalDailyM3.toFixed(0)}</td>
                <td className="py-3 px-3 font-mono text-slate-800 dark:text-white">{(totalDailyM3 * 30).toLocaleString("id-ID")}</td>
                <td className="py-3 px-3 text-right font-mono text-emerald-500 text-sm">{formatCostIDR(totalMonthlyCost)}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
