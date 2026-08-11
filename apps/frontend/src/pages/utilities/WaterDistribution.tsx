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

/* ═══════════ SUB COMPONENTS ═══════════ */

function PumpCard({ node }: { node: FlowNode }) {
  return (
    <div className="rounded-xl border border-slate-700 bg-slate-900/80 p-3 text-center min-w-[110px] shadow-lg">
      <div className="text-[9px] font-bold text-slate-400 mb-1">⚙️</div>
      <div className="text-sm font-extrabold text-white">{node.label}</div>
      <div className="flex items-center justify-center gap-1.5 mt-1.5">
        <span className={`h-2 w-2 rounded-full ${node.status === "RUN" ? "bg-emerald-500 animate-pulse" : "bg-red-500"}`} style={{ boxShadow: node.status === "RUN" ? "0 0 6px #10b981" : "0 0 6px #ef4444" }} />
        <span className={`text-[10px] font-extrabold ${node.status === "RUN" ? "text-emerald-400" : "text-red-400"}`}>{node.status}</span>
      </div>
      <div className="text-[10px] font-bold text-cyan-400 font-mono mt-1">{node.flowLpm} L/min</div>
    </div>
  );
}

function TankCard({ node }: { node: FlowNode }) {
  const level = node.tankLevel ?? 0;
  const cap = node.tankCapacity ?? 1;
  const actualLiters = Math.round(cap * level / 100);
  const color = level > 70 ? "#10b981" : level > 40 ? "#eab308" : "#ef4444";

  return (
    <div className="rounded-xl border border-slate-700 bg-slate-900/80 p-4 text-center min-w-[130px] shadow-lg relative overflow-hidden">
      {/* Tank level background */}
      <div className="absolute bottom-0 left-0 right-0 transition-all duration-1000 opacity-15" style={{ height: `${level}%`, backgroundColor: color }} />
      <div className="relative z-10">
        <div className="text-[9px] font-bold text-slate-400 mb-0.5">🏗️</div>
        <div className="text-sm font-extrabold text-white">{node.label}</div>
        <div className="text-2xl font-extrabold font-mono mt-1" style={{ color }}>{level}%</div>
        <div className="text-[9px] text-slate-400 font-bold">{(cap).toLocaleString("id-ID")} L</div>
        <div className="text-[9px] text-slate-500 font-mono">{actualLiters.toLocaleString("id-ID")} L</div>
      </div>
    </div>
  );
}

function DistCard({ node, costColor }: { node: FlowNode; costColor?: string }) {
  const cost = node.dailyM3 * 30 * COST_PER_M3;
  const isAlert = node.status === "ALERT";
  const borderColor = isAlert ? "border-red-500/50" : "border-cyan-500/30";
  const textColor = isAlert ? "text-red-400" : "text-cyan-400";
  const bgColor = isAlert ? "bg-red-950/30" : "bg-slate-900/80";

  return (
    <div className={`rounded-xl border ${borderColor} ${bgColor} px-3 py-2 shadow-lg flex items-center justify-between gap-3 min-w-[180px]`}>
      <div>
        <div className={`text-xs font-extrabold ${isAlert ? "text-red-300" : "text-white"}`}>{node.label}</div>
        <div className={`text-[10px] font-bold font-mono ${textColor}`}>
          {node.flowLpm} L/m · {node.dailyM3} m³/d
        </div>
      </div>
      <div className="text-right">
        <div className={`text-[8px] font-bold uppercase tracking-wider ${costColor || "text-emerald-400"}`}>Est. Cost/bln</div>
        <div className={`text-[9px] font-extrabold font-mono ${costColor || "text-emerald-400"}`}>{formatCostIDR(cost)}</div>
      </div>
    </div>
  );
}

function FlowLine({ direction = "right", label, color = "cyan" }: { direction?: "right" | "down" | "left"; label?: string; color?: string }) {
  const lineColor = color === "cyan" ? "border-cyan-500/40" : color === "orange" ? "border-orange-500/40" : "border-red-500/40";
  const dashStyle = color === "red" ? "border-dashed" : "border-dashed";

  if (direction === "down") {
    return (
      <div className="flex flex-col items-center mx-auto">
        <div className={`w-0 h-8 border-l-2 ${dashStyle} ${lineColor}`} />
      </div>
    );
  }

  return (
    <div className="flex items-center justify-center">
      <div className={`h-0 flex-1 border-t-2 ${dashStyle} ${lineColor} relative`}>
        {label && <span className={`absolute -top-4 left-1/2 -translate-x-1/2 text-[8px] font-bold whitespace-nowrap ${color === "red" ? "text-red-400" : "text-cyan-400"}`}>{label}</span>}
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
    return Object.values(flowData)
      .filter(n => n.type === "distribution" || n.type === "subdist" || n.type === "factory")
      .reduce((sum, n) => sum + n.dailyM3, 0);
  }, [flowData]);

  const totalMonthlyCost = totalDailyM3 * 30 * COST_PER_M3;

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
            <span className="text-[10px] font-extrabold uppercase text-emerald-500">Est. Monthly</span>
            <span className="text-sm font-extrabold font-mono text-emerald-500">{formatCostIDR(totalMonthlyCost)}</span>
          </div>
        </div>
      </div>

      <WaterSubNav />

      {/* ═══════════ SYSTEM FLOW DIAGRAM ═══════════ */}
      <section className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-[#0f172a] p-6 shadow-xl overflow-x-auto" style={{ minWidth: 900 }}>
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h3 className="text-sm font-extrabold text-white flex items-center gap-2">
              <span className="text-blue-400">💧</span> System Flow Diagram
            </h3>
            <p className="text-[10px] text-slate-500 mt-0.5">Alur distribusi air dari sumber ke konsumen</p>
          </div>
          {/* Legend */}
          <div className="flex items-center gap-4 text-[9px] font-bold text-slate-500">
            <span className="flex items-center gap-1.5"><span className="w-5 h-0 border-t-2 border-dashed border-cyan-500/50" /> Active Flow</span>
            <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-emerald-500" /> Online</span>
            <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-red-500" /> Hydrant/Alert</span>
            <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-orange-500" /> Factory Line</span>
          </div>
        </div>

        {/* Flow Diagram Layout */}
        <div className="grid grid-cols-[140px_60px_160px_60px_200px_60px_200px_60px_200px] gap-y-3 items-center">

          {/* ──── ROW 1: Tanks → Distribution Lines ──── */}
          {/* Tank Column */}
          <div className="row-span-7 flex flex-col gap-4 items-center justify-start pt-0">
            <TankCard node={flowData["tank1"]} />
            <TankCard node={flowData["tank2"]} />
          </div>

          {/* Flow arrow from tank */}
          <div className="row-span-7" />

          {/* Main Distribution Cards Column */}
          <div className="flex flex-col gap-2">
            <DistCard node={flowData["multimedia"]} />
          </div>
          <div /><div /><div /><div /><div /><div />

          {/* Row 2: Hydrant */}
          <div /><div />
          <DistCard node={flowData["hydrant-main"]} costColor="text-red-400" />
          <div /><div /><div /><div /><div /><div />

          {/* Row 3: Sanitari-1 */}
          <div /><div />
          <DistCard node={flowData["sanitari1"]} />
          <div /><div /><div /><div /><div /><div />

          {/* Row 4: Sanitari-2 */}
          <div /><div />
          <DistCard node={flowData["sanitari2"]} />
          <div />
          {/* Sub-dist column header */}
          <div />
          <div />
          {/* Sub-dist cards */}
          <div className="flex flex-col gap-2">
            <DistCard node={flowData["wf1u1"]} />
          </div>
          <div /><div />

          {/* Row 5: Softener-1 */}
          <div /><div />
          <DistCard node={flowData["softener1"]} />
          <div /><div /><div />
          <DistCard node={flowData["wf1u2"]} />
          <div /><div />

          {/* Row 6: Softener-2 */}
          <div /><div />
          <DistCard node={flowData["softener2"]} />
          <div /><div /><div />
          <DistCard node={flowData["wf1u3"]} />
          <div /><div />

          {/* Row 7: Factory-1 → Pipeline → Factory-1 Tank → Sub-dists */}
          <div /><div />
          <DistCard node={flowData["factory1"]} />
          <FlowLine label="Pipeline" color="orange" />
          <TankCard node={flowData["factory1tank"]} />
          <div />
          <div className="flex flex-col gap-2">
            <DistCard node={flowData["sanitari1-sub"]} />
            <DistCard node={flowData["sanitari2-sub"]} />
            <DistCard node={flowData["hydrant-sub"]} costColor="text-red-400" />
          </div>
          <div /><div />

        </div>

        {/* Deep Wells at bottom */}
        <div className="mt-6 flex items-center gap-6 justify-start pl-2">
          <PumpCard node={flowData["dw3"]} />
          <PumpCard node={flowData["dw4"]} />
          <div className="ml-4">
            <DistCard node={flowData["csr"]} />
          </div>
        </div>
      </section>

      {/* ═══════════ COST SUMMARY TABLE ═══════════ */}
      <section className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-sm">
        <h3 className="text-xs font-extrabold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-4">
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
