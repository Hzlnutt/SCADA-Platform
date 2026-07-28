import { useEffect, useState, useMemo } from "react";
import { PageHeader } from "../../components/ui/PageHeader";
import { Line, Bar } from "react-chartjs-2";
import "../../components/charts/chartjs";
import { useSystemStore } from "../../store/system.store";

/* ═══════════ TYPES & STRUCTS ═══════════ */
type TransformerData = {
  id: string;
  name: string;
  factory: 1 | 2;
  capacityKva: number;
  activePowerKw: number;
  reactivePowerKvar: number;
  apparentPowerKva: number;
  powerFactor: number;
  frequencyHz: number;
  tempCc: number;
  voltageInKv: number;
  voltageOutL2L: number;
  voltageOutL2N: number;
  currentR: number;
  currentS: number;
  currentT: number;
  thdVoltage: number;
  thdCurrent: number;
  kwh: number;
  status: "online" | "warning" | "offline";
};

/* ═══════════ INITIAL MOCK DATA ═══════════ */
const INITIAL_TRANSFORMERS: TransformerData[] = [
  // Factory 1
  {
    id: "mdp-1.1", name: "MDP-1.1", factory: 1, capacityKva: 630, activePowerKw: 493, reactivePowerKvar: 182,
    apparentPowerKva: 530, powerFactor: 0.930, frequencyHz: 50.02, tempCc: 54.6, voltageInKv: 20.23,
    voltageOutL2L: 404.8, voltageOutL2N: 231.9, currentR: 734.1, currentS: 727.8, currentT: 740.9,
    thdVoltage: 2.14, thdCurrent: 5.54, kwh: 124580.4, status: "online"
  },
  {
    id: "mdp-1.2", name: "MDP-1.2", factory: 1, capacityKva: 630, activePowerKw: 512, reactivePowerKvar: 201,
    apparentPowerKva: 550, powerFactor: 0.931, frequencyHz: 50.01, tempCc: 58.2, voltageInKv: 20.21,
    voltageOutL2L: 403.9, voltageOutL2N: 230.8, currentR: 748.2, currentS: 738.9, currentT: 755.1,
    thdVoltage: 2.32, thdCurrent: 5.81, kwh: 148920.6, status: "online"
  },
  {
    id: "mdp-2", name: "MDP-2", factory: 1, capacityKva: 1000, activePowerKw: 821, reactivePowerKvar: 310,
    apparentPowerKva: 878, powerFactor: 0.935, frequencyHz: 50.02, tempCc: 62.4, voltageInKv: 20.24,
    voltageOutL2L: 405.1, voltageOutL2N: 232.1, currentR: 1205.4, currentS: 1211.8, currentT: 1228.6,
    thdVoltage: 2.11, thdCurrent: 5.25, kwh: 239010.5, status: "online"
  },
  {
    id: "mdp-3", name: "MDP-3", factory: 1, capacityKva: 1000, activePowerKw: 851, reactivePowerKvar: 382,
    apparentPowerKva: 932, powerFactor: 0.913, frequencyHz: 49.98, tempCc: 67.8, voltageInKv: 20.19,
    voltageOutL2L: 402.5, voltageOutL2N: 229.4, currentR: 1260.8, currentS: 1251.2, currentT: 1279.4,
    thdVoltage: 2.85, thdCurrent: 6.42, kwh: 98450.8, status: "warning"
  },
  // Factory 2
  {
    id: "putr-1", name: "PUTR-1", factory: 2, capacityKva: 2000, activePowerKw: 1654, reactivePowerKvar: 480,
    apparentPowerKva: 1722, powerFactor: 0.960, frequencyHz: 50.03, tempCc: 61.2, voltageInKv: 20.25,
    voltageOutL2L: 405.8, voltageOutL2N: 232.5, currentR: 2420.5, currentS: 2435.1, currentT: 2408.2,
    thdVoltage: 1.84, thdCurrent: 4.88, kwh: 458900.2, status: "online"
  },
  {
    id: "putr-2", name: "PUTR-2", factory: 2, capacityKva: 2000, activePowerKw: 1456, reactivePowerKvar: 495,
    apparentPowerKva: 1537, powerFactor: 0.947, frequencyHz: 50.01, tempCc: 56.4, voltageInKv: 20.22,
    voltageOutL2L: 404.2, voltageOutL2N: 231.0, currentR: 2130.4, currentS: 2145.8, currentT: 2125.1,
    thdVoltage: 2.05, thdCurrent: 5.12, kwh: 382400.9, status: "online"
  },
  {
    id: "putr-new", name: "PUTR-New", factory: 2, capacityKva: 1600, activePowerKw: 828, reactivePowerKvar: 280,
    apparentPowerKva: 874, powerFactor: 0.947, frequencyHz: 50.02, tempCc: 51.5, voltageInKv: 20.26,
    voltageOutL2L: 406.2, voltageOutL2N: 232.9, currentR: 1210.8, currentS: 1215.4, currentT: 1201.2,
    thdVoltage: 1.95, thdCurrent: 4.65, kwh: 120560.5, status: "online"
  }
];

const TARIF_PER_KWH = 1114.74; // Industrial I-3 tariff in IDR

const formatCurrencyIDR = (v: number) =>
  new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(v);

/* ═══════════ DETAILED HISTORICAL MODAL ═══════════ */
type ModalProps = {
  transformer: TransformerData;
  onClose: () => void;
  isDark: boolean;
};

function DetailRecordModal({ transformer, onClose, isDark }: ModalProps) {
  const [activeTab, setActiveTab] = useState<"voltage" | "ampere" | "power">("voltage");

  const trendLabels = Array.from({ length: 24 }, (_, i) => `${i.toString().padStart(2, "0")}:00`);

  const voltageData = {
    labels: trendLabels,
    datasets: [
      { label: "VAB (V)", data: Array.from({ length: 24 }, () => transformer.voltageOutL2L + Math.random() * 4 - 2), borderColor: "#f43f5e", borderWidth: 2, pointRadius: 0, fill: false },
      { label: "VBC (V)", data: Array.from({ length: 24 }, () => transformer.voltageOutL2L + Math.random() * 4 - 2), borderColor: "#eab308", borderWidth: 2, pointRadius: 0, fill: false },
      { label: "VCA (V)", data: Array.from({ length: 24 }, () => transformer.voltageOutL2L + Math.random() * 4 - 2), borderColor: "#3b82f6", borderWidth: 2, pointRadius: 0, fill: false }
    ]
  };

  const ampereData = {
    labels: trendLabels,
    datasets: [
      { label: "Phase R (A)", data: Array.from({ length: 24 }, () => transformer.currentR + Math.random() * 20 - 10), borderColor: "#f43f5e", borderWidth: 2, pointRadius: 0, fill: false },
      { label: "Phase S (A)", data: Array.from({ length: 24 }, () => transformer.currentS + Math.random() * 20 - 10), borderColor: "#eab308", borderWidth: 2, pointRadius: 0, fill: false },
      { label: "Phase T (A)", data: Array.from({ length: 24 }, () => transformer.currentT + Math.random() * 20 - 10), borderColor: "#3b82f6", borderWidth: 2, pointRadius: 0, fill: false }
    ]
  };

  const powerData = {
    labels: trendLabels,
    datasets: [
      {
        label: "Daya Aktif (kW)",
        data: Array.from({ length: 24 }, () => transformer.activePowerKw + Math.random() * 50 - 25),
        backgroundColor: "rgba(16, 185, 129, 0.4)",
        borderColor: "#10b981",
        borderWidth: 1.5
      }
    ]
  };

  const lineOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        labels: { color: isDark ? "#94a3b8" : "#475569", font: { size: 9, weight: "bold" as const } }
      }
    },
    scales: {
      x: { grid: { display: false }, ticks: { color: "#64748b", font: { size: 8 } } },
      y: {
        grid: { color: isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.04)" },
        ticks: { color: "#64748b", font: { size: 8 } }
      }
    }
  };

  const tabs = [
    { key: "voltage" as const, label: "Voltage Record" },
    { key: "ampere" as const, label: "Ampere Record" },
    { key: "power" as const, label: "Daya Aktif Record" },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="w-full max-w-3xl rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-2xl flex flex-col">
        {/* Modal Header */}
        <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800/80 pb-4 mb-4">
          <div className="flex items-center gap-3">
            <span
              className="rounded-xl bg-sky-500/10 flex items-center justify-center text-sky-500"
              style={{ width: 28, height: 28 }}
            >
              <svg style={{ width: 16, height: 16 }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2z" />
              </svg>
            </span>
            <div>
              <h3 className="text-sm font-extrabold text-slate-800 dark:text-white">
                Historical Records — {transformer.name}
              </h3>
              <p className="text-[10px] text-slate-400">Transformator {transformer.factory === 1 ? "Factory 1" : "Factory 2"}</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className={`px-2 py-0.5 rounded text-[10px] font-extrabold uppercase border ${
              transformer.status === "online" ? "bg-emerald-500/10 text-emerald-500 border-emerald-500/20" : "bg-amber-500/10 text-amber-500 border-amber-500/20"
            }`}>
              {transformer.status === "online" ? "ON" : "WARN"}
            </span>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
            >
              <svg style={{ width: 16, height: 16 }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Tab Buttons */}
        <div className="flex gap-2 mb-4 bg-slate-100/80 dark:bg-slate-800/40 p-1 rounded-xl self-start">
          {tabs.map(t => (
            <button
              key={t.key}
              onClick={() => setActiveTab(t.key)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                activeTab === t.key
                  ? "bg-white dark:bg-slate-800 shadow-sm text-[#002b5c] dark:text-sky-400"
                  : "text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Chart View */}
        <div className="relative mt-2" style={{ height: 260 }}>
          {activeTab === "voltage" && <Line data={voltageData} options={lineOptions} />}
          {activeTab === "ampere" && <Line data={ampereData} options={lineOptions} />}
          {activeTab === "power" && <Bar data={powerData} options={lineOptions as any} />}
        </div>

        {/* Modal Footer */}
        <div className="border-t border-slate-100 dark:border-slate-800/80 pt-4 mt-4 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-xl text-xs font-bold transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

/* ═══════════ TRANSFORMER DETAIL CARD (Section B) ═══════════ */
function TransformerDetailCard({ tx, factoryLabel }: { tx: TransformerData; factoryLabel: string }) {
  const loadPct = Math.round((tx.activePowerKw / tx.capacityKva) * 100);
  const loadColor = loadPct > 85 ? "#ef4444" : loadPct > 75 ? "#f59e0b" : "#10b981";

  return (
    <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm overflow-hidden">
      {/* Card Header */}
      <div className="px-5 py-3 border-b border-slate-100 dark:border-slate-800/80 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <span
            className="rounded-full"
            style={{
              width: 8, height: 8,
              backgroundColor: tx.status === "online" ? "#10b981" : "#f59e0b",
              boxShadow: tx.status === "online" ? "0 0 6px #10b981" : "0 0 6px #f59e0b",
            }}
          />
          <span className="text-sm font-extrabold text-slate-800 dark:text-white">{tx.name}</span>
          <span className="px-2 py-0.5 rounded text-[8px] font-extrabold bg-sky-500/10 text-sky-500 border border-sky-500/20 uppercase">
            {factoryLabel} — {tx.capacityKva} kVA
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-bold text-slate-400">LOAD</span>
          <div className="flex items-center gap-1.5">
            <div
              className="rounded-full overflow-hidden bg-slate-100 dark:bg-slate-800"
              style={{ width: 60, height: 6 }}
            >
              <div
                className="h-full rounded-full transition-all duration-700"
                style={{ width: `${Math.min(100, loadPct)}%`, backgroundColor: loadColor }}
              />
            </div>
            <span className="text-[10px] font-extrabold font-mono" style={{ color: loadColor }}>
              {loadPct}%
            </span>
          </div>
        </div>
      </div>

      {/* Parameters Grid */}
      <div className="p-5">
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "12px 16px" }} className="text-xs">
          <ParamCell label="Input Voltage" value={`${tx.voltageInKv.toFixed(2)} kV`} />
          <ParamCell label="Output L-L" value={`${tx.voltageOutL2L.toFixed(1)} V`} />
          <ParamCell label="Output L-N" value={`${tx.voltageOutL2N.toFixed(1)} V`} />
          <ParamCell label="Active Power" value={`${tx.activePowerKw} kW`} accent />
          <ParamCell label="Reactive Power" value={`${tx.reactivePowerKvar} kVAR`} />
          <ParamCell label="Apparent Power" value={`${tx.apparentPowerKva} kVA`} />
          <ParamCell label="Power Factor" value={tx.powerFactor.toFixed(3)} />
          <ParamCell label="Frequency" value={`${tx.frequencyHz.toFixed(2)} Hz`} />
          <ParamCell label="Temperature" value={`${tx.tempCc.toFixed(1)} °C`} warn={tx.tempCc > 60} />
        </div>

        {/* Current & THD Section */}
        <div
          className="mt-4 p-3.5 bg-slate-50 dark:bg-slate-800/30 rounded-xl border border-slate-100 dark:border-slate-800/60"
          style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}
        >
          <div className="space-y-1.5">
            <span className="text-[9px] text-slate-400 uppercase font-extrabold tracking-wider">Current Per Phase (A)</span>
            <div className="flex gap-3 text-[11px] font-mono font-bold text-slate-600 dark:text-slate-300">
              <span>R: <span className="text-rose-500">{Math.round(tx.currentR)}</span></span>
              <span>S: <span className="text-amber-500">{Math.round(tx.currentS)}</span></span>
              <span>T: <span className="text-blue-500">{Math.round(tx.currentT)}</span></span>
            </div>
          </div>
          <div className="flex gap-5">
            <div>
              <span className="text-[9px] text-slate-400 uppercase block font-extrabold tracking-wider">THD-V</span>
              <span className="text-[11px] font-bold font-mono text-slate-700 dark:text-slate-300">{tx.thdVoltage.toFixed(2)}%</span>
            </div>
            <div>
              <span className="text-[9px] text-slate-400 uppercase block font-extrabold tracking-wider">THD-I</span>
              <span className="text-[11px] font-bold font-mono text-slate-700 dark:text-slate-300">{tx.thdCurrent.toFixed(2)}%</span>
            </div>
          </div>
        </div>

        {/* Cost & kWh */}
        <div
          className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800/80"
          style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, alignItems: "center" }}
        >
          <div>
            <span className="text-[9px] text-slate-400 uppercase block font-bold">Total Konsumsi</span>
            <span className="text-xs font-bold text-[#002b5c] dark:text-sky-400 font-mono">
              {tx.kwh.toLocaleString("id-ID")} <span className="text-[9px] text-slate-400 font-bold">kWh</span>
            </span>
          </div>
          <div>
            <span className="text-[9px] text-slate-400 uppercase block font-bold">Estimasi Cost</span>
            <span className="text-xs font-bold text-emerald-500 font-mono">
              {formatCurrencyIDR(tx.kwh * TARIF_PER_KWH)}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

function ParamCell({ label, value, accent, warn }: { label: string; value: string; accent?: boolean; warn?: boolean }) {
  return (
    <div>
      <span className="text-[9px] text-slate-400 uppercase tracking-wider block font-bold">{label}</span>
      <span className={`font-bold font-mono ${
        accent ? "text-emerald-500 font-extrabold" :
        warn ? "text-amber-500" :
        "text-slate-800 dark:text-slate-200"
      }`}>
        {value}
      </span>
    </div>
  );
}

/* ═══════════ SLD TRANSFORMER MINI CARD ═══════════ */
function SldMiniCard({ tx, onClick }: { tx: TransformerData; onClick: () => void }) {
  const loadPct = Math.round((tx.activePowerKw / tx.capacityKva) * 100);
  const loadColor = loadPct > 85 ? "#ef4444" : loadPct > 75 ? "#f59e0b" : "#10b981";

  return (
    <div
      className="rounded-xl border border-slate-200 dark:border-slate-700/60 bg-white dark:bg-slate-800/60 shadow-sm flex flex-col hover:border-sky-500/40 hover:shadow-md transition-all duration-300 cursor-pointer"
      style={{ padding: "10px 12px", minWidth: 0 }}
      onClick={onClick}
    >
      {/* Name row */}
      <div className="flex items-center justify-between pb-1.5 border-b border-slate-100 dark:border-slate-700/40">
        <span className="text-[10px] font-extrabold text-slate-800 dark:text-white flex items-center gap-1.5 truncate">
          <span
            className="rounded-full flex-shrink-0"
            style={{
              width: 6, height: 6,
              backgroundColor: tx.status === "online" ? "#10b981" : "#f59e0b",
              boxShadow: tx.status === "online" ? "0 0 4px #10b981" : "0 0 4px #f59e0b",
            }}
          />
          {tx.name}
        </span>
        <span className="text-[8px] font-bold text-slate-400 ml-1 flex-shrink-0">{tx.capacityKva} kVA</span>
      </div>

      {/* Power value */}
      <div className="py-2 space-y-0.5">
        <div className="text-xs font-extrabold font-mono text-slate-800 dark:text-slate-100">
          {tx.activePowerKw} <span className="text-[8px] font-semibold text-slate-400">kW</span>
        </div>
        <div className="text-[9px] font-bold text-slate-500">
          PF: <span className="font-mono text-slate-700 dark:text-slate-300">{tx.powerFactor.toFixed(3)}</span>
        </div>
      </div>

      {/* Load bar */}
      <div className="space-y-1">
        <div className="flex justify-between text-[7px] font-extrabold text-slate-400">
          <span>LOAD</span>
          <span style={{ color: loadColor }}>{loadPct}%</span>
        </div>
        <div
          className="w-full rounded-full overflow-hidden bg-slate-100 dark:bg-slate-700/60"
          style={{ height: 4 }}
        >
          <div
            className="h-full rounded-full transition-all duration-1000"
            style={{ width: `${Math.min(100, loadPct)}%`, backgroundColor: loadColor }}
          />
        </div>
      </div>

      {/* Detail button */}
      <button
        onClick={(e) => { e.stopPropagation(); onClick(); }}
        className="w-full mt-2.5 py-1 rounded-lg border border-slate-200 dark:border-slate-700 hover:border-sky-500/40 text-[8px] font-extrabold text-slate-400 hover:text-sky-500 dark:hover:text-sky-400 tracking-wider bg-slate-50/50 dark:bg-slate-800/30 hover:bg-sky-500/5 transition-all"
      >
        DETAIL ▾
      </button>
    </div>
  );
}

/* ═══════════ SLD CONNECTOR COMPONENTS ═══════════ */
function VerticalLine({ height = 24, color = "currentColor" }: { height?: number; color?: string }) {
  return <div style={{ width: 2, height, backgroundColor: color, margin: "0 auto", borderRadius: 1 }} />;
}

function CircuitBreaker({ closed = true }: { closed?: boolean }) {
  const bg = closed ? "rgba(16,185,129,0.1)" : "rgba(239,68,68,0.1)";
  const border = closed ? "rgba(16,185,129,0.35)" : "rgba(239,68,68,0.35)";
  const text = closed ? "#10b981" : "#ef4444";
  return (
    <div
      className="flex items-center justify-center"
      style={{
        width: 26, height: 26, borderRadius: 6, margin: "0 auto",
        backgroundColor: bg, border: `1px solid ${border}`,
      }}
    >
      <span style={{ fontSize: 8, fontWeight: 800, fontFamily: "monospace", color: text }}>CB</span>
    </div>
  );
}

function TransformerSymbol() {
  return (
    <div className="flex flex-col items-center" style={{ margin: "0 auto" }}>
      <div
        className="flex items-center justify-center"
        style={{
          width: 24, height: 24, borderRadius: "50%",
          border: "1.5px solid rgba(56,189,248,0.5)",
          fontSize: 7, fontWeight: 800, color: "#38bdf8",
        }}
      >
        20k
      </div>
      <div
        className="flex items-center justify-center"
        style={{
          width: 24, height: 24, borderRadius: "50%",
          border: "1.5px solid rgba(56,189,248,0.5)",
          marginTop: -8,
          fontSize: 7, fontWeight: 800, color: "#38bdf8",
        }}
      >
        400
      </div>
    </div>
  );
}

/* ═══════════ MAIN COMPONENT ═══════════ */
export default function PowerDistribution() {
  const theme = useSystemStore((state) => state.theme);
  const isDark = theme === "dark";

  const [transformers, setTransformers] = useState<TransformerData[]>(INITIAL_TRANSFORMERS);
  const [selectedTx, setSelectedTx] = useState<TransformerData | null>(null);

  const totalLoadKw = useMemo(() => {
    return transformers.reduce((sum, tx) => sum + tx.activePowerKw, 0);
  }, [transformers]);

  const totalCapacityKva = useMemo(() => {
    return transformers.reduce((sum, tx) => sum + tx.capacityKva, 0);
  }, [transformers]);

  // Real-time ticking simulation
  useEffect(() => {
    const timer = setInterval(() => {
      setTransformers((prev) =>
        prev.map((tx) => {
          const diffKw = (Math.random() * 8 - 4);
          const nextKw = Math.max(0, Math.min(tx.capacityKva, tx.activePowerKw + diffKw));
          const addedKwh = (nextKw * (3 / 3600));

          return {
            ...tx,
            activePowerKw: Math.round(nextKw * 10) / 10,
            kwh: Math.round((tx.kwh + addedKwh) * 100) / 100,
            tempCc: Math.round((tx.tempCc + (Math.random() * 0.4 - 0.2)) * 10) / 10,
            currentR: Math.round((tx.currentR + (Math.random() * 4 - 2)) * 10) / 10,
            currentS: Math.round((tx.currentS + (Math.random() * 4 - 2)) * 10) / 10,
            currentT: Math.round((tx.currentT + (Math.random() * 4 - 2)) * 10) / 10
          };
        })
      );
    }, 3000);

    return () => clearInterval(timer);
  }, []);

  const factory1 = transformers.filter(tx => tx.factory === 1);
  const factory2 = transformers.filter(tx => tx.factory === 2);

  return (
    <div className="space-y-6">
      {/* HEADER */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <PageHeader
          title="Single Line Diagram — Distribusi Daya"
          description="Monitoring diagram garis tunggal jaringan distribusi kelistrikan Factory 1 & Factory 2"
        />
        <div className="flex items-center gap-4">
          <div className="px-4 py-2 rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-sm flex items-center gap-3">
            <span className="text-[10px] font-extrabold uppercase text-slate-400">Total Load</span>
            <span className="text-base font-extrabold font-mono text-slate-800 dark:text-white">
              {totalLoadKw.toLocaleString("id-ID")} <span className="text-xs text-slate-400 font-bold">kW</span>
            </span>
          </div>
          <div className="px-4 py-2 rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-sm flex items-center gap-3">
            <span className="text-[10px] font-extrabold uppercase text-slate-400">Kapasitas</span>
            <span className="text-base font-extrabold font-mono text-slate-800 dark:text-white">
              {totalCapacityKva.toLocaleString("id-ID")} <span className="text-xs text-slate-400 font-bold">kVA</span>
            </span>
          </div>
        </div>
      </div>

      {/* ═══════════ SECTION A: SINGLE LINE DIAGRAM ═══════════ */}
      <section className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm overflow-x-auto">
        {/* SLD Header Bar */}
        <div className="px-6 py-3 border-b border-slate-100 dark:border-slate-800/80 flex items-center justify-between bg-slate-50/50 dark:bg-slate-800/20">
          <div className="flex items-center gap-2">
            <svg style={{ width: 16, height: 16 }} className="text-sky-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
            <span className="text-xs font-extrabold text-slate-700 dark:text-slate-200 uppercase tracking-wider">Single Line Diagram</span>
          </div>
          <div className="flex items-center gap-2">
            <span
              className="rounded-full"
              style={{ width: 6, height: 6, backgroundColor: "#10b981", boxShadow: "0 0 6px #10b981" }}
            />
            <span className="text-[10px] font-bold text-slate-400">Real-time</span>
          </div>
        </div>

        {/* SLD Canvas */}
        <div className="p-6" style={{ minWidth: 1080 }}>
          <div className="flex flex-col items-center">

            {/* 1. PLN Main Source Node */}
            <div className="flex flex-col items-center">
              <div
                className="text-center relative"
                style={{
                  padding: "22px 28px 14px",
                  borderRadius: 14,
                  border: "1px solid rgba(245,158,11,0.3)",
                  background: isDark ? "rgba(245,158,11,0.08)" : "rgba(245,158,11,0.04)",
                  boxShadow: "0 4px 20px rgba(245,158,11,0.08)",
                }}
              >
                <span
                  style={{
                    position: "absolute", top: -11, left: "50%", transform: "translateX(-50%)",
                    padding: "3px 12px", borderRadius: 6,
                    backgroundColor: "#f59e0b", color: "#fff",
                    fontSize: 8, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.1em",
                    whiteSpace: "nowrap",
                  }}
                >
                  Main Source
                </span>
                <div className="text-xs font-extrabold text-amber-500 tracking-wider">PLN 20 kV</div>
                <div className="text-[9px] font-bold text-slate-400 mt-0.5">Kapasitas: 5.540 kVA</div>
              </div>
            </div>

            {/* Line down */}
            <VerticalLine height={28} color={isDark ? "rgba(245,158,11,0.4)" : "rgba(245,158,11,0.5)"} />

            {/* Main CB */}
            <CircuitBreaker closed />

            {/* Line to Busbar */}
            <VerticalLine height={28} color={isDark ? "rgba(245,158,11,0.4)" : "rgba(245,158,11,0.5)"} />

            {/* 2. 20 kV Busbar */}
            <div className="w-full flex items-center justify-center relative" style={{ padding: "0 6%" }}>
              <div
                className="w-full"
                style={{
                  height: 8,
                  borderRadius: 4,
                  background: "linear-gradient(90deg, #f59e0b, #f97316, #f59e0b)",
                  boxShadow: "0 2px 12px rgba(249,115,22,0.25)",
                }}
              />
              <span
                className="absolute text-orange-500 uppercase font-extrabold"
                style={{ left: "2%", top: -20, fontSize: 10, letterSpacing: "0.15em" }}
              >
                20 kV BUS
              </span>
            </div>

            {/* 3. Drop Lines to Transformers (7 columns) */}
            <div
              className="relative"
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(7, 1fr)",
                width: "88%",
                paddingTop: 2,
              }}
            >
              {transformers.map((tx) => (
                <div key={tx.id} className="flex flex-col items-center">
                  <VerticalLine height={20} color={isDark ? "#334155" : "#cbd5e1"} />
                  <CircuitBreaker closed={tx.status !== "offline"} />
                  <VerticalLine height={14} color={isDark ? "#334155" : "#cbd5e1"} />
                  <TransformerSymbol />
                  <VerticalLine height={20} color={isDark ? "#334155" : "#cbd5e1"} />
                </div>
              ))}
            </div>

            {/* 4. Transformer Mini Cards (7 columns) */}
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(7, 1fr)",
                gap: 10,
                width: "100%",
                padding: "0 8px",
              }}
            >
              {transformers.map((tx) => (
                <SldMiniCard key={tx.id} tx={tx} onClick={() => setSelectedTx(tx)} />
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ═══════════ SECTION B: DETAIL TRANSFORMATOR CARDS ═══════════ */}
      <section className="space-y-6">
        <div className="flex items-center gap-2.5">
          <svg style={{ width: 18, height: 18 }} className="text-sky-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
          </svg>
          <h3 className="text-sm font-extrabold text-slate-800 dark:text-white">
            Detail Transformator — Parameter Lengkap
          </h3>
        </div>

        {/* Factory 1 */}
        <div className="space-y-3">
          <h4 className="text-xs font-extrabold text-[#47729f] dark:text-sky-400 uppercase tracking-widest pl-2">
            ● Factory 1 — {factory1.length} Transformator
          </h4>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 16 }}>
            {factory1.map((tx) => (
              <TransformerDetailCard key={tx.id} tx={tx} factoryLabel="F1" />
            ))}
          </div>
        </div>

        {/* Factory 2 */}
        <div className="space-y-3">
          <h4 className="text-xs font-extrabold text-[#47729f] dark:text-sky-400 uppercase tracking-widest pl-2">
            ● Factory 2 — {factory2.length} Transformator
          </h4>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 16 }}>
            {factory2.map((tx) => (
              <TransformerDetailCard key={tx.id} tx={tx} factoryLabel="F2" />
            ))}
          </div>
        </div>
      </section>

      {/* DETAIL MODAL IF OPENED */}
      {selectedTx && (
        <DetailRecordModal
          transformer={selectedTx}
          onClose={() => setSelectedTx(null)}
          isDark={isDark}
        />
      )}
    </div>
  );
}
