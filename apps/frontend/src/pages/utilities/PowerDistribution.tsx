import { useEffect, useState, useMemo, useRef, useCallback } from "react";
import { usePageActive } from "../../hooks/usePageActive";
import { PageHeader } from "../../components/ui/PageHeader";
import { Line, Bar } from "react-chartjs-2";
import "../../components/charts/chartjs";
import { useSystemStore } from "../../store/system.store";
import { getJson, postJson } from "../../services/api.client";
import { getSocket } from "../../services/socket.service";
import { EwPowerMetersGrid } from "../../components/electricity/EwPowerMetersGrid";
import type { ElectricPmItem } from "../../components/electricity/PmDetailModal";

/* ═══════════ DETAILED COVERED DIRECTORY ═══════════ */
const COVERED_EQUIPMENT: Record<string, { group?: string; breaker: string; load: string; label: string }[]> = {
  "mdp-1.1": [
    { group: "Group 1 (MCCB 320A)", breaker: "125A", load: "Sparepart Room & Office Prod", label: "Sparepart & Office" },
    { group: "Group 1 (MCCB 320A)", breaker: "160A", load: "Warehouse-3", label: "Warehouse-3" },
    { group: "Group 1 (MCCB 320A)", breaker: "40A", load: "Penerangan Steril-1", label: "Penerangan Steril-1" },
    { group: "Group 1 (MCCB 320A)", breaker: "50A", load: "Penerangan Security", label: "Penerangan Security" },
    { group: "Group 1 (MCCB 320A)", breaker: "32A", load: "Penerangan WT", label: "Penerangan WT" },
    { group: "Group 1 (MCCB 320A)", breaker: "160A", load: "Penerangan Utility", label: "Penerangan Utility" },
    { group: "Group 2 (MCCB 400A)", breaker: "100A", load: "HVAC IP Unit-2", label: "HVAC IP Unit-2" },
    { group: "Group 2 (MCCB 400A)", breaker: "225A", load: "Cooling-1", label: "Cooling-1" },
    { group: "Group 2 (MCCB 400A)", breaker: "40A", load: "Steril-1 Penerangan", label: "Steril-1 Penerangan" },
    { group: "Group 2 (MCCB 400A)", breaker: "45A", load: "Boiler-1", label: "Boiler-1" },
    { group: "Group 2 (MCCB 400A)", breaker: "225A", load: "Compressor Unit-1 (Mitsui)", label: "Compressor Unit-1" },
    { group: "Group 3 (MCCB 250A)", breaker: "160A", load: "Workshop", label: "Workshop" },
    { group: "Group 3 (MCCB 250A)", breaker: "60A", load: "IP-1", label: "IP-1" },
    { group: "Group 3 (MCCB 250A)", breaker: "40A", load: "Warehouse-2", label: "Warehouse-2" },
    { group: "Group 3 (MCCB 250A)", breaker: "45A", load: "Crusher", label: "Crusher" },
    { group: "Group 3 (MCCB 250A)", breaker: "40A", load: "Preparation-1", label: "Preparation-1" },
    { group: "Group 3 (MCCB 250A)", breaker: "63A", load: "WT-1", label: "WT-1" },
    { group: "Group 3 (MCCB 250A)", breaker: "80A", load: "Steril-2 Mesin", label: "Steril-2 Mesin" },
    { group: "Group 4 (MCCB 800A)", breaker: "250A", load: "Chiller Daikin-Timur", label: "Chiller Daikin-Timur" },
    { group: "Group 4 (MCCB 800A)", breaker: "250A", load: "Deep Well", label: "Deep Well" },
    { group: "Group 4 (MCCB 800A)", breaker: "250A", load: "Compressor Unit-3", label: "Compressor Unit-3" }
  ],
  "mdp-1.2": [
    { breaker: "250A", load: "Chiller Daikin", label: "Chiller Daikin" },
    { breaker: "160A", load: "HVAC Warehouse-3", label: "HVAC Warehouse-3" },
    { breaker: "63A", load: "DU & WT", label: "DU & WT" },
    { breaker: "100A", load: "Mini Lab & R.Server MIS", label: "Mini Lab & Server" },
    { breaker: "200A", load: "Chiller Unit-1", label: "Chiller Unit-1" },
    { breaker: "250A", load: "BP Unit-1", label: "BP Unit-1" },
    { breaker: "250A", load: "HVAC Unit-1", label: "HVAC Unit-1" }
  ],
  "mdp-2": [
    { breaker: "400A", load: "Chiller Trane", label: "Chiller Trane" },
    { breaker: "20A", load: "Material Storage Unit-2", label: "Material Storage" },
    { breaker: "75A", load: "Corridor & R. SPV Unit-2", label: "Corridor & SPV Room" },
    { breaker: "100A", load: "P. Penerangan Depan Laundry", label: "Penerangan Laundry" },
    { breaker: "50A", load: "P. Preparation Unit-2", label: "P. Preparation Unit-2" },
    { breaker: "100A", load: "P. WT Unit-2", label: "P. WT Unit-2" },
    { breaker: "75A", load: "P. IP Unit-2", label: "P. IP Unit-2" },
    { breaker: "100A", load: "Spare Feeder", label: "Spare" },
    { breaker: "50A", load: "P. Warehouse-1", label: "P. Warehouse-1" },
    { breaker: "500A", load: "P. Cooling Unit-2", label: "P. Cooling Unit-2" },
    { breaker: "300A", load: "P. HVAC Mezanine Unit-2", label: "P. HVAC Mezanine" },
    { breaker: "600A", load: "P. Chiller HVAC Unit-2", label: "P. Chiller HVAC" },
    { breaker: "600A", load: "P. Capacitor Bank", label: "Capacitor Bank" },
    { breaker: "75A", load: "Steril Unit-2", label: "Steril Unit-2" },
    { breaker: "40A", load: "Corridor Unit-2", label: "Corridor Unit-2" },
    { breaker: "20A", load: "Penerangan Warehouse-2", label: "Penerangan WH-2" },
    { breaker: "50A", load: "Charger Battery Genset Fact-1", label: "Charger Battery Genset" },
    { breaker: "50A", load: "P. Warehouse-4", label: "P. Warehouse-4" },
    { breaker: "400A", load: "BP-3 & BP-4", label: "BP-3 & BP-4" },
    { breaker: "225A", load: "Compressor Unit-2", label: "Compressor Unit-2" },
    { breaker: "630A", load: "Cooling Unit-3", label: "Cooling Unit-3" }
  ],
  "mdp-3": [
    { breaker: "400A", load: "Office & Lab QC", label: "Office & Lab QC" },
    { breaker: "80A", load: "P. Preparation Unit-3", label: "P. Preparation Unit-3" },
    { breaker: "100A", load: "P. WT Unit-3", label: "P. WT Unit-3" },
    { breaker: "50A", load: "P. IP Unit-3", label: "P. IP Unit-3" },
    { breaker: "125A", load: "P. Steril Unit-3", label: "P. Steril Unit-3" },
    { breaker: "200A", load: "P. Boiler & Compressor", label: "P. Boiler & Compressor" },
    { breaker: "630A", load: "P. HVAC Unit-3", label: "P. HVAC Unit-3" },
    { breaker: "250A", load: "P. BP-5", label: "P. BP-5" },
    { breaker: "250A", load: "P. BP-6", label: "P. BP-6" },
    { breaker: "80A", load: "P. Boiler", label: "P. Boiler" },
    { breaker: "40A", load: "Material Warehouse-2", label: "Material Warehouse-2" },
    { breaker: "40A", load: "Penerangan IP-3", label: "Penerangan IP-3" }
  ],
  "putr-1": [
    { breaker: "400A", load: "MCC Water Treatment", label: "MCC Water Treatment" },
    { breaker: "250A", load: "Panel Preparation", label: "Panel Preparation" },
    { breaker: "300A", load: "Panel Produk Palletizing", label: "Panel Produk Palletizing" },
    { breaker: "160A", load: "Panel Weighing", label: "Panel Weighing" },
    { breaker: "100A", load: "Panel Laundry", label: "Panel Laundry" },
    { breaker: "200A", load: "Panel Mesin", label: "Panel Mesin" },
    { breaker: "250A", load: "Panel Bottle", label: "Panel Bottle" }
  ],
  "putr-2": [
    { breaker: "600A", load: "Panel Chiller / Panel Chiller ELV +6.60", label: "Panel Chiller" },
    { breaker: "160A", load: "Panel Lighting Area 1", label: "Panel Lighting Area 1" },
    { breaker: "160A", load: "Panel Lighting Area 2", label: "Panel Lighting Area 2" },
    { breaker: "400A", load: "Area Utility Feeder", label: "Area Utility" },
    { breaker: "250A", load: "Panel Main Critical", label: "Panel Main Critical" }
  ],
  "putr-new": [
    { breaker: "200A", load: "AC WHO & New Crusher", label: "AC WHO & New Crusher" },
    { breaker: "100A", load: "Spare 1", label: "Spare 1" },
    { breaker: "100A", load: "Spare 2", label: "Spare 2" },
    { breaker: "100A", load: "Spare 3", label: "Spare 3" },
    { breaker: "100A", load: "Spare 4", label: "Spare 4" }
  ]
};

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
  vectorGroup?: string;
  impedance?: number;
  year?: string;
  manufacturer?: string;
};

/* ═══════════ INITIAL MOCK DATA ═══════════ */
const INITIAL_TRANSFORMERS: TransformerData[] = [
  // Factory 1
  {
    id: "mdp-1.1", name: "MDP-1.1", factory: 1, capacityKva: 630, activePowerKw: 594, reactivePowerKvar: 128,
    apparentPowerKva: 608, powerFactor: 0.942, frequencyHz: 49.98, tempCc: 54.2, voltageInKv: 20.8,
    voltageOutL2L: 399.2, voltageOutL2N: 229.4, currentR: 512, currentS: 508, currentT: 515,
    thdVoltage: 2.81, thdCurrent: 7.42, kwh: 170967, status: "online"
  },
  {
    id: "mdp-1.2", name: "MDP-1.2", factory: 1, capacityKva: 630, activePowerKw: 521, reactivePowerKvar: 112,
    apparentPowerKva: 533, powerFactor: 0.952, frequencyHz: 49.97, tempCc: 51.8, voltageInKv: 20.7,
    voltageOutL2L: 400.1, voltageOutL2N: 230.1, currentR: 448, currentS: 452, currentT: 445,
    thdVoltage: 2.65, thdCurrent: 6.91, kwh: 149832, status: "online"
  },
  {
    id: "mdp-2", name: "MDP-2", factory: 1, capacityKva: 1000, activePowerKw: 715, reactivePowerKvar: 168,
    apparentPowerKva: 734, powerFactor: 0.958, frequencyHz: 49.99, tempCc: 57.5, voltageInKv: 20.9,
    voltageOutL2L: 401.3, voltageOutL2N: 231.2, currentR: 615, currentS: 620, currentT: 618,
    thdVoltage: 3.12, thdCurrent: 8.15, kwh: 206541, status: "online"
  },
  {
    id: "mdp-3", name: "MDP-3", factory: 1, capacityKva: 1000, activePowerKw: 718, reactivePowerKvar: 175,
    apparentPowerKva: 739, powerFactor: 0.960, frequencyHz: 49.98, tempCc: 59.1, voltageInKv: 20.8,
    voltageOutL2L: 400.8, voltageOutL2N: 230.6, currentR: 622, currentS: 618, currentT: 625,
    thdVoltage: 2.94, thdCurrent: 7.88, kwh: 211423, status: "online"
  },
  // Factory 2
  {
    id: "putr-1", name: "PUTR-1", factory: 2, capacityKva: 2000, activePowerKw: 491, reactivePowerKvar: 105,
    apparentPowerKva: 502, powerFactor: 0.947, frequencyHz: 49.99, tempCc: 48.3, voltageInKv: 20.9,
    voltageOutL2L: 400.5, voltageOutL2N: 230.8, currentR: 425, currentS: 430, currentT: 422,
    thdVoltage: 2.45, thdCurrent: 6.52, kwh: 142876, status: "online"
  },
  {
    id: "putr-2", name: "PUTR-2", factory: 2, capacityKva: 2000, activePowerKw: 563, reactivePowerKvar: 118,
    apparentPowerKva: 575, powerFactor: 0.985, frequencyHz: 49.98, tempCc: 50.1, voltageInKv: 20.8,
    voltageOutL2L: 399.8, voltageOutL2N: 229.9, currentR: 486, currentS: 490, currentT: 484,
    thdVoltage: 2.68, thdCurrent: 7.15, kwh: 163254, status: "online"
  },
  {
    id: "putr-new", name: "PUTR-New", factory: 2, capacityKva: 1600, activePowerKw: 406, reactivePowerKvar: 92,
    apparentPowerKva: 416, powerFactor: 0.952, frequencyHz: 49.97, tempCc: 46.7, voltageInKv: 20.7,
    voltageOutL2L: 400.3, voltageOutL2N: 230.5, currentR: 352, currentS: 348, currentT: 355,
    thdVoltage: 2.32, thdCurrent: 5.94, kwh: 118742, status: "online"
  }
];

const TARIF_PER_KWH = 1114.74; // Industrial I-3 tariff in IDR

const formatCurrencyIDR = (v: number) =>
  new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(v);

/* ═══════════ DETAILED HISTORICAL MODAL ═══════════ */
type ModalProps = {
  transformer: TransformerData & { vectorGroup: string; impedance: number; year: string; manufacturer: string };
  onClose: () => void;
  isDark: boolean;
  coverageList: { group?: string; breaker: string; load: string; label: string }[];
  onSaveSpecs: (specs: any) => void;
  onSaveCoverage: (items: any[]) => void;
};

function DetailRecordModal({ transformer, onClose, isDark, coverageList, onSaveSpecs, onSaveCoverage }: ModalProps) {
  const [activeTab, setActiveTab] = useState<"voltage" | "ampere" | "power">("voltage");
  const [rightTab, setRightTab] = useState<"specs" | "coverage">("specs");

  // Specs form state
  const [specForm, setSpecForm] = useState({
    capacityKva: transformer.capacityKva,
    vectorGroup: transformer.vectorGroup,
    impedance: transformer.impedance,
    year: transformer.year,
    manufacturer: transformer.manufacturer,
  });

  // Coverage items local state
  const [coverages, setCoverages] = useState(coverageList);

  // New coverage form state
  const [newGroup, setNewGroup] = useState("");
  const [newBreaker, setNewBreaker] = useState("");
  const [newLoad, setNewLoad] = useState("");
  const [newLabel, setNewLabel] = useState("");

  const trendLabels = Array.from({ length: 24 }, (_, i) => `${i.toString().padStart(2, "0")}:00`);

  const voltageData = {
    labels: trendLabels,
    datasets: [
      { label: "VAB (V)", data: Array.from({ length: 24 }, () => 398 + Math.random() * 4), borderColor: "#f43f5e", borderWidth: 2, pointRadius: 0, fill: false },
      { label: "VBC (V)", data: Array.from({ length: 24 }, () => 399 + Math.random() * 4), borderColor: "#eab308", borderWidth: 2, pointRadius: 0, fill: false },
      { label: "VCA (V)", data: Array.from({ length: 24 }, () => 400 + Math.random() * 4), borderColor: "#3b82f6", borderWidth: 2, pointRadius: 0, fill: false }
    ]
  };

  const ampereData = {
    labels: trendLabels,
    datasets: [
      { label: "Phase R (A)", data: Array.from({ length: 24 }, () => 320 + Math.random() * 40), borderColor: "#f43f5e", borderWidth: 2, pointRadius: 0, fill: false },
      { label: "Phase S (A)", data: Array.from({ length: 24 }, () => 310 + Math.random() * 35), borderColor: "#eab308", borderWidth: 2, pointRadius: 0, fill: false },
      { label: "Phase T (A)", data: Array.from({ length: 24 }, () => 330 + Math.random() * 45), borderColor: "#3b82f6", borderWidth: 2, pointRadius: 0, fill: false }
    ]
  };

  const powerData = {
    labels: trendLabels,
    datasets: [
      {
        label: "Daya Aktif (kW)",
        data: Array.from({ length: 24 }, () => 520 + Math.random() * 60),
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

  const handleSaveSpecsClick = () => {
    onSaveSpecs(specForm);
    alert("Transformer Specifications saved successfully!");
  };

  const handleAddCoverage = () => {
    if (!newLoad.trim() || !newBreaker.trim()) {
      alert("Load name and Breaker MCCB rating are required.");
      return;
    }
    const newItem = {
      group: newGroup.trim() || undefined,
      breaker: newBreaker.trim(),
      load: newLoad.trim(),
      label: newLabel.trim() || newLoad.trim(),
    };
    const updated = [...coverages, newItem];
    setCoverages(updated);
    onSaveCoverage(updated);
    // Reset inputs
    setNewGroup("");
    setNewBreaker("");
    setNewLoad("");
    setNewLabel("");
  };

  const handleDeleteCoverage = (idxToDelete: number) => {
    const updated = coverages.filter((_, idx) => idx !== idxToDelete);
    setCoverages(updated);
    onSaveCoverage(updated);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="w-full max-w-6xl rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-2xl flex flex-col max-h-[90vh] overflow-hidden">
        {/* Modal Header */}
        <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800/80 pb-4 mb-4 flex-shrink-0">
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
                Detailed Configurations & Records — {transformer.name}
              </h3>
              <p className="text-[10px] text-slate-400">Transformator {transformer.factory === 1 ? "Factory 1" : "Factory 2"}</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className={`px-2 py-0.5 rounded text-[10px] font-extrabold uppercase border bg-emerald-500/10 text-emerald-500 border-emerald-500/20`}>
              ON
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

        {/* Modal Layout Grid */}
        <div className="grid grid-cols-1 md:grid-cols-[1.2fr_1fr] gap-6 overflow-hidden flex-1">
          
          {/* Left Column: Tab & Chart (Historical Trends) */}
          <div className="flex flex-col overflow-hidden space-y-4">
            <h4 className="text-xs font-extrabold uppercase text-[#47729f] dark:text-sky-400 tracking-wider">
              📈 Historical Trend (24 Jam)
            </h4>
            {/* Tab Buttons */}
            <div className="flex gap-2 bg-slate-100/80 dark:bg-slate-800/40 p-1 rounded-xl self-start flex-shrink-0">
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
            <div className="relative flex-1" style={{ minHeight: 260, height: "100%" }}>
              {activeTab === "voltage" && <Line data={voltageData} options={lineOptions} />}
              {activeTab === "ampere" && <Line data={ampereData} options={lineOptions} />}
              {activeTab === "power" && <Bar data={powerData} options={lineOptions as any} />}
            </div>
          </div>

          {/* Right Column: Configurations Specs & Coverage split tabs */}
          <div className="flex flex-col border-l border-slate-100 dark:border-slate-800/80 pl-6 overflow-hidden">
            {/* Right Side Tabs */}
            <div className="flex gap-2 bg-slate-100/80 dark:bg-slate-800/40 p-1 rounded-xl self-start mb-4 flex-shrink-0">
              <button
                onClick={() => setRightTab("specs")}
                className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${
                  rightTab === "specs"
                    ? "bg-white dark:bg-slate-800 shadow-sm text-[#002b5c] dark:text-sky-400"
                    : "text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
                }`}
              >
                🪪 Nameplate Specifications
              </button>
              <button
                onClick={() => setRightTab("coverage")}
                className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${
                  rightTab === "coverage"
                    ? "bg-white dark:bg-slate-800 shadow-sm text-[#002b5c] dark:text-sky-400"
                    : "text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
                }`}
              >
                📋 Coverage Equipment ({coverages.length})
              </button>
            </div>

            {/* TAB 1: Specs Editor */}
            {rightTab === "specs" && (
              <div className="flex-1 overflow-y-auto space-y-4 pr-2">
                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div>
                    <label className="block text-[10px] uppercase font-bold text-slate-400 mb-1">Kapasitas (kVA)</label>
                    <input
                      type="number"
                      value={specForm.capacityKva}
                      onChange={e => setSpecForm({ ...specForm, capacityKva: +e.target.value })}
                      className="w-full px-3 py-2 border border-slate-200 dark:border-slate-800 rounded-xl bg-slate-50 dark:bg-slate-900 text-slate-800 dark:text-slate-100 font-semibold outline-none focus:border-sky-500"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] uppercase font-bold text-slate-400 mb-1">Manufacturer</label>
                    <input
                      type="text"
                      value={specForm.manufacturer}
                      onChange={e => setSpecForm({ ...specForm, manufacturer: e.target.value })}
                      className="w-full px-3 py-2 border border-slate-200 dark:border-slate-800 rounded-xl bg-slate-50 dark:bg-slate-900 text-slate-800 dark:text-slate-100 font-semibold outline-none focus:border-sky-500"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] uppercase font-bold text-slate-400 mb-1">Vector Group</label>
                    <input
                      type="text"
                      value={specForm.vectorGroup}
                      onChange={e => setSpecForm({ ...specForm, vectorGroup: e.target.value })}
                      className="w-full px-3 py-2 border border-slate-200 dark:border-slate-800 rounded-xl bg-slate-50 dark:bg-slate-900 text-slate-800 dark:text-slate-100 font-semibold outline-none focus:border-sky-500"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] uppercase font-bold text-slate-400 mb-1">Impedansi (%)</label>
                    <input
                      type="number"
                      step="0.1"
                      value={specForm.impedance}
                      onChange={e => setSpecForm({ ...specForm, impedance: +e.target.value })}
                      className="w-full px-3 py-2 border border-slate-200 dark:border-slate-800 rounded-xl bg-slate-50 dark:bg-slate-900 text-slate-800 dark:text-slate-100 font-semibold outline-none focus:border-sky-500"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] uppercase font-bold text-slate-400 mb-1">Tahun Pembuatan</label>
                    <input
                      type="text"
                      value={specForm.year}
                      onChange={e => setSpecForm({ ...specForm, year: e.target.value })}
                      className="w-full px-3 py-2 border border-slate-200 dark:border-slate-800 rounded-xl bg-slate-50 dark:bg-slate-900 text-slate-800 dark:text-slate-100 font-semibold outline-none focus:border-sky-500"
                    />
                  </div>
                </div>

                <button
                  onClick={handleSaveSpecsClick}
                  className="w-full py-2.5 rounded-xl bg-sky-500 hover:bg-sky-600 text-white text-xs font-bold transition shadow"
                >
                  Save Specification Details
                </button>
              </div>
            )}

            {/* TAB 2: Coverage Editor */}
            {rightTab === "coverage" && (
              <div className="flex-1 overflow-y-auto space-y-4 pr-2 flex flex-col justify-between">
                
                {/* List items */}
                <div className="space-y-2 overflow-y-auto max-h-[220px] pr-1">
                  {coverages.map((item, idx) => (
                    <div key={idx} className="p-2.5 bg-slate-50 dark:bg-slate-900/40 border border-slate-100 dark:border-slate-800/60 rounded-xl flex items-center justify-between text-xs">
                      <div>
                        <span className="font-bold text-slate-800 dark:text-slate-200 block">{item.load}</span>
                        {item.group && (
                          <span className="text-[8px] text-slate-400 font-semibold">{item.group}</span>
                        )}
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="px-2 py-0.5 font-mono text-[9px] font-extrabold text-blue-500 dark:text-sky-400 bg-blue-500/10 border border-blue-500/20 rounded">
                          {item.breaker}
                        </span>
                        <button
                          onClick={() => handleDeleteCoverage(idx)}
                          className="text-rose-500 hover:text-rose-700 font-extrabold"
                        >
                          ✕
                        </button>
                      </div>
                    </div>
                  ))}
                  {coverages.length === 0 && (
                    <div className="text-center py-6 text-xs text-slate-400 font-semibold">
                      No coverage equipment added yet.
                    </div>
                  )}
                </div>

                {/* Add new coverage Form */}
                <div className="border-t border-slate-100 dark:border-slate-800/80 pt-3 space-y-2 mt-auto">
                  <h5 className="text-[10px] font-extrabold text-[#47729f] dark:text-slate-400 uppercase tracking-wider">
                    ➕ Add Equipment Coverage
                  </h5>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <input
                      type="text"
                      placeholder="Load Name"
                      value={newLoad}
                      onChange={e => {
                        setNewLoad(e.target.value);
                        setNewLabel(e.target.value);
                      }}
                      className="px-2.5 py-1.5 border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 rounded-lg text-slate-800 dark:text-slate-100 outline-none"
                    />
                    <input
                      type="text"
                      placeholder="Breaker MCCB"
                      value={newBreaker}
                      onChange={e => setNewBreaker(e.target.value)}
                      className="px-2.5 py-1.5 border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 rounded-lg text-slate-800 dark:text-slate-100 outline-none"
                    />
                    <input
                      type="text"
                      placeholder="Group (optional)"
                      value={newGroup}
                      onChange={e => setNewGroup(e.target.value)}
                      className="col-span-2 px-2.5 py-1.5 border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 rounded-lg text-slate-800 dark:text-slate-100 outline-none"
                    />
                  </div>
                  <button
                    onClick={handleAddCoverage}
                    className="w-full py-1.5 bg-emerald-500 hover:bg-emerald-600 text-white font-bold text-xs rounded-xl shadow transition"
                  >
                    Add to Coverage List
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Modal Footer */}
        <div className="border-t border-slate-100 dark:border-slate-800/80 pt-4 mt-4 flex justify-end flex-shrink-0">
          <button
            onClick={onClose}
            className="px-5 py-2.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-xl text-xs font-bold transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

/* ═══════════ TRANSFORMER DETAIL CARD (Section B) ═══════════ */
function TransformerDetailCard({ tx, factoryLabel, loadConfig }: { tx: TransformerData; factoryLabel: string; loadConfig: { safeMax: number; cautionMax: number } }) {
  const loadPct = Math.round((tx.activePowerKw / tx.capacityKva) * 100);
  
  // Dynamic load colors based on Postgres threshold configs
  const loadColor = loadPct <= loadConfig.safeMax 
    ? "#10b981" 
    : loadPct <= loadConfig.cautionMax 
      ? "#eab308" 
      : "#ef4444";

  // Mock voltages per phase for display
  const vR_400 = (tx.voltageOutL2L + 0.8).toFixed(1);
  const vS_400 = (tx.voltageOutL2L - 1.2).toFixed(1);
  const vT_400 = (tx.voltageOutL2L + 0.4).toFixed(1);

  const vR_230 = (tx.voltageOutL2N + 0.5).toFixed(1);
  const vS_230 = (tx.voltageOutL2N - 0.9).toFixed(1);
  const vT_230 = (tx.voltageOutL2N + 0.3).toFixed(1);

  // Mock THD per phase
  const thdv_R = tx.thdVoltage.toFixed(2);
  const thdv_S = (tx.thdVoltage * 0.96).toFixed(2);
  const thdv_T = (tx.thdVoltage * 1.04).toFixed(2);

  const thdi_R = tx.thdCurrent.toFixed(2);
  const thdi_S = (tx.thdCurrent * 0.93).toFixed(2);
  const thdi_T = (tx.thdCurrent * 1.07).toFixed(2);

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
          <ParamCell label="Output Volt 400V" value={`R:${vR_400} S:${vS_400} T:${vT_400} V`} />
          <ParamCell label="Output Volt 230V" value={`R:${vR_230} S:${vS_230} T:${vT_230} V`} />
          
          <ParamCell label="Active Power" value={`${tx.activePowerKw} kW`} accent />
          <ParamCell label="Reactive Power" value={`${tx.reactivePowerKvar} kVAR`} />
          <ParamCell label="Apparent Power" value={`${tx.apparentPowerKva} kVA`} />
          
          <ParamCell label="Power Factor" value={tx.powerFactor.toFixed(3)} />
          <ParamCell label="Frequency" value={`${tx.frequencyHz.toFixed(2)} Hz`} />
          <ParamCell label="Temperature" value={`${tx.tempCc.toFixed(1)} °C`} warn={tx.tempCc > 60} />

          <ParamCell label="Impedance" value={`${tx.impedance ?? 4.5} %`} />
          <ParamCell label="Vector Group" value={tx.vectorGroup ?? "Dyn11"} />
          <ParamCell label="Mfg / Year" value={`${tx.manufacturer ?? "Schneider"} (${tx.year ?? "2021"})`} />
        </div>

        {/* Current & THD Section */}
        <div
          className="mt-4 p-3.5 bg-slate-50 dark:bg-slate-800/30 rounded-xl border border-slate-100 dark:border-slate-800/60 space-y-2.5"
        >
          <div className="flex justify-between items-center text-xs">
            <span className="text-[9px] text-slate-400 uppercase font-extrabold tracking-wider">Arus Per Fasa (A)</span>
            <div className="font-mono font-bold text-slate-700 dark:text-slate-300">
              R: <span className="text-rose-500 mr-2">{Math.round(tx.currentR)}</span>
              S: <span className="text-amber-500 mr-2">{Math.round(tx.currentS)}</span>
              T: <span className="text-blue-500">{Math.round(tx.currentT)}</span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4 pt-2 border-t border-slate-100 dark:border-slate-800/40 text-xs">
            <div>
              <span className="text-[9px] text-slate-400 uppercase block font-extrabold tracking-wider mb-0.5">THDV Per Fasa (%)</span>
              <div className="font-mono font-bold text-slate-700 dark:text-slate-300">
                R:<span className="text-sky-500 mr-1">{thdv_R}</span>
                S:<span className="text-sky-500 mr-1">{thdv_S}</span>
                T:<span className="text-sky-500">{thdv_T}</span>
              </div>
            </div>
            <div>
              <span className="text-[9px] text-slate-400 uppercase block font-extrabold tracking-wider mb-0.5">THDi Per Fasa (%)</span>
              <div className="font-mono font-bold text-slate-700 dark:text-slate-300">
                R:<span className="text-indigo-500 mr-1">{thdi_R}</span>
                S:<span className="text-indigo-500 mr-1">{thdi_S}</span>
                T:<span className="text-indigo-500">{thdi_T}</span>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4 pt-2 border-t border-slate-100 dark:border-slate-800/40 text-[10px] font-bold text-slate-500">
            <div>
              <span>Voltage Unbalanced: </span>
              <span className="text-slate-700 dark:text-slate-300 font-mono">0.95%</span>
            </div>
            <div>
              <span>Current Unbalanced: </span>
              <span className="text-slate-700 dark:text-slate-300 font-mono">1.56%</span>
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
      <span className={`font-bold font-mono text-[10px] ${
        accent ? "text-emerald-500 font-extrabold" :
        warn ? "text-amber-500" :
        "text-slate-800 dark:text-slate-200"
      }`}>
        {value}
      </span>
    </div>
  );
}

/* ═══════════ SLD SCALED CANVAS (RESPONSIVE) ═══════════ */
const SLD_DESIGN_W = 1200;
const SLD_DESIGN_H = 570;

function SldScaledCanvas({ children }: { children: React.ReactNode }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);

  const measure = useCallback(() => {
    const el = containerRef.current;
    if (!el) return;

    // Subtract total padding (16px left + 16px right = 32px) from clientWidth
    const padding = 32;
    const availableWidth = el.clientWidth - padding;
    if (availableWidth > 0) {
      const s = availableWidth / SLD_DESIGN_W;
      setScale(s);
    }
  }, []);

  useEffect(() => {
    measure();

    const el = containerRef.current;
    if (!el) return;

    const ro = new ResizeObserver(() => {
      measure();
    });
    ro.observe(el);
    
    window.addEventListener("resize", measure);

    return () => {
      ro.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, [measure]);

  return (
    <div 
      ref={containerRef} 
      className="w-full overflow-hidden" 
      style={{ 
        padding: "16px", 
        boxSizing: "border-box",
        height: SLD_DESIGN_H * scale + 32, // design height scaled + padding
        position: "relative"
      }}
    >
      <div
        style={{
          width: SLD_DESIGN_W,
          height: SLD_DESIGN_H,
          transform: `scale(${scale})`,
          transformOrigin: "top left",
          position: "absolute",
          top: 16,
          left: 16
        }}
      >
        {children}
      </div>
    </div>
  );
}

/* ═══════════ SLD TRANSFORMER MINI CARD ═══════════ */
function SldMiniCard({ tx, onClick, loadConfig }: { tx: TransformerData; onClick: () => void; loadConfig: { safeMax: number; cautionMax: number } }) {
  const loadPct = Math.round((tx.activePowerKw / tx.capacityKva) * 100);
  
  // Dynamic color thresholds based on user parameters
  const loadColor = loadPct <= loadConfig.safeMax 
    ? "#10b981" 
    : loadPct <= loadConfig.cautionMax 
      ? "#eab308" 
      : "#ef4444";

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
  const isPageActive = usePageActive();
  const theme = useSystemStore((state) => state.theme);
  const isDark = theme === "dark";

  const [telemetryTransformers, setTelemetryTransformers] = useState<TransformerData[]>(INITIAL_TRANSFORMERS);
  const [selectedTx, setSelectedTx] = useState<TransformerData | null>(null);

  // Sub-Distribution Power Meters (EW23, EW21, EW22)
  const [selectedEwGroup, setSelectedEwGroup] = useState<"ew23" | "ew21" | "ew22">("ew23");
  const [ewPowerMeters, setEwPowerMeters] = useState<ElectricPmItem[]>([]);

  // Fetch initial EW power meters and listen to live socket updates
  useEffect(() => {
    let active = true;
    const fetchPmData = () => {
      if (!isPageActive) return;
      getJson<{ data: ElectricPmItem[] }>(`/analytics/electricity/power-meters?group=${selectedEwGroup}&_t=${Date.now()}`)
        .then((res) => {
          if (active && res?.data) {
            setEwPowerMeters(res.data);
          }
        })
        .catch((err) => console.error("Failed to load EW power meters:", err));
    };

    fetchPmData();
    const interval = setInterval(fetchPmData, 1000);

    const socket = getSocket();
    const handleLiveUpdate = (payload: { groupId: string; data: ElectricPmItem[] }) => {
      if (payload?.groupId?.toLowerCase() === selectedEwGroup && Array.isArray(payload.data)) {
        setEwPowerMeters(payload.data);
      }
    };

    socket.on(`electricity:${selectedEwGroup}_live`, handleLiveUpdate);
    socket.on("electricity:pm_live_update", handleLiveUpdate);

    return () => {
      active = false;
      clearInterval(interval);
      socket.off(`electricity:${selectedEwGroup}_live`, handleLiveUpdate);
      socket.off("electricity:pm_live_update", handleLiveUpdate);
    };
  }, [selectedEwGroup, isPageActive]);

  const [customSpecs, setCustomSpecs] = useState<Record<string, any>>({});
  const [customCoverage, setCustomCoverage] = useState<Record<string, any[]>>({});

  // Merge specs into transformers
  const transformers = useMemo(() => {
    return telemetryTransformers.map(tx => {
      const spec = customSpecs[tx.id];
      if (spec) {
        return {
          ...tx,
          capacityKva: spec.capacityKva || tx.capacityKva,
          vectorGroup: spec.vectorGroup || "Dyn11",
          impedance: spec.impedance || 4.5,
          year: spec.year || "2021",
          manufacturer: spec.manufacturer || "Schneider"
        };
      }
      return {
        ...tx,
        vectorGroup: "Dyn11",
        impedance: 4.5,
        year: "2021",
        manufacturer: "Schneider"
      };
    });
  }, [telemetryTransformers, customSpecs]);

  // Load specs & coverage from database on mount
  useEffect(() => {
    getJson<{ data: any[] }>("/config/electricity?configType=trafo_spec")
      .then(res => {
        if (res?.data) {
          const specs: any = {};
          res.data.forEach(item => {
            specs[item.config_key] = item.value;
          });
          setCustomSpecs(specs);
        }
      })
      .catch(e => console.error("Error loading specs", e));

    getJson<{ data: any[] }>("/config/electricity?configType=trafo_coverage")
      .then(res => {
        if (res?.data) {
          const coverage: any = {};
          res.data.forEach(item => {
            coverage[item.config_key] = item.value;
          });
          setCustomCoverage(coverage);
        }
      })
      .catch(e => console.error("Error loading coverage", e));
  }, []);

  const handleSaveSpecs = async (id: string, specs: any) => {
    setCustomSpecs(prev => ({ ...prev, [id]: specs }));
    try {
      await postJson("/config/electricity", {
        config_type: "trafo_spec",
        config_key: id,
        label: `Trafo Spec ${id}`,
        value: specs,
        sort_order: 0,
        enabled: true
      });
    } catch (e) {
      console.error("Failed to save spec to DB", e);
    }
  };

  const handleSaveCoverage = async (id: string, items: any[]) => {
    setCustomCoverage(prev => ({ ...prev, [id]: items }));
    try {
      await postJson("/config/electricity", {
        config_type: "trafo_coverage",
        config_key: id,
        label: `Trafo Coverage ${id}`,
        value: items,
        sort_order: 0,
        enabled: true
      });
    } catch (e) {
      console.error("Failed to save coverage to DB", e);
    }
  };

  // Load color threshold configs
  const [loadConfig, setLoadConfig] = useState({
    safeMax: 50,
    cautionMax: 80,
    dangerMax: 100
  });

  const [showConfigModal, setShowConfigModal] = useState(false);
  const [savingConfig, setSavingConfig] = useState(false);
  const [formConfig, setFormConfig] = useState(loadConfig);

  // Bottom historical panel selection state
  const [bottomTxId, setBottomTxId] = useState("mdp-1.1");
  const bottomTx = useMemo(() => {
    return transformers.find(t => t.id === bottomTxId) || transformers[0];
  }, [transformers, bottomTxId]);

  // Load threshold config from Postgres
  useEffect(() => {
    getJson<{ data: any[] }>("/config/electricity?configType=load_thresholds")
      .then((res) => {
        if (res?.data && res.data.length > 0) {
          const stored = res.data.find(item => item.config_key === "thresholds");
          if (stored && stored.value) {
            setLoadConfig(stored.value);
            setFormConfig(stored.value);
          }
        }
      })
      .catch((err) => console.error("Failed to load load thresholds:", err));
  }, []);

  const handleOpenConfig = () => {
    setFormConfig(loadConfig);
    setShowConfigModal(true);
  };

  const handleSaveConfig = async () => {
    setSavingConfig(true);
    try {
      await postJson("/config/electricity", {
        config_type: "load_thresholds",
        config_key: "thresholds",
        label: "Load Threshold Limits",
        value: formConfig,
        sort_order: 0,
        enabled: true
      });
      setLoadConfig(formConfig);
      setShowConfigModal(false);
    } catch (err) {
      console.error(err);
      alert("Failed to save load color configurations.");
    } finally {
      setSavingConfig(false);
    }
  };

  const totalLoadKw = useMemo(() => {
    return transformers.reduce((sum, tx) => sum + tx.activePowerKw, 0);
  }, [transformers]);

  const totalCapacityKva = useMemo(() => {
    return transformers.reduce((sum, tx) => sum + tx.capacityKva, 0);
  }, [transformers]);

  const factory1 = transformers.filter(tx => tx.factory === 1);
  const factory2 = transformers.filter(tx => tx.factory === 2);

  // Bottom historical trend datasets (Gambar 2)
  const trendHours = Array.from({ length: 24 }, (_, i) => `${i.toString().padStart(2, "0")}:00`);

  const bottomVoltageData = useMemo(() => {
    const baseV = bottomTx.voltageOutL2L || 400;
    return {
      labels: trendHours,
      datasets: [
        { label: "VAB (V)", data: Array.from({ length: 24 }, (_, i) => +(baseV - 0.8 + Math.sin(i / 2) * 1.5).toFixed(1)), borderColor: "#f43f5e", borderWidth: 2, pointRadius: 0, tension: 0.3 },
        { label: "VBC (V)", data: Array.from({ length: 24 }, (_, i) => +(baseV + 1.2 + Math.cos(i / 2) * 1.3).toFixed(1)), borderColor: "#eab308", borderWidth: 2, pointRadius: 0, tension: 0.3 },
        { label: "VCA (V)", data: Array.from({ length: 24 }, (_, i) => +(baseV - 0.4 + Math.sin(i / 3) * 1.8).toFixed(1)), borderColor: "#3b82f6", borderWidth: 2, pointRadius: 0, tension: 0.3 }
      ]
    };
  }, [trendHours, bottomTx]);

  const bottomPowerData = useMemo(() => {
    const baseP = bottomTx.activePowerKw || 500;
    return {
      labels: trendHours,
      datasets: [
        { label: "Daya Aktif (kW)", data: Array.from({ length: 24 }, (_, i) => Math.round(baseP - 30 + Math.sin(i / 4) * 45)), borderColor: "#10b981", backgroundColor: "rgba(16, 185, 129, 0.05)", borderWidth: 2.5, pointRadius: 0, fill: true, tension: 0.3 }
      ]
    };
  }, [trendHours, bottomTx]);

  const bottomAmpereData = useMemo(() => {
    const baseI = bottomTx.currentR || 400;
    return {
      labels: trendHours,
      datasets: [
        { label: "Phase R (A)", data: Array.from({ length: 24 }, (_, i) => Math.round(baseI - 15 + Math.sin(i / 2) * 20)), borderColor: "#f43f5e", borderWidth: 2, pointRadius: 0, tension: 0.3 },
        { label: "Phase S (A)", data: Array.from({ length: 24 }, (_, i) => Math.round(baseI * 0.98 - 12 + Math.cos(i / 2) * 18)), borderColor: "#eab308", borderWidth: 2, pointRadius: 0, tension: 0.3 },
        { label: "Phase T (A)", data: Array.from({ length: 24 }, (_, i) => Math.round(baseI * 1.02 - 18 + Math.sin(i / 3) * 22)), borderColor: "#3b82f6", borderWidth: 2, pointRadius: 0, tension: 0.3 }
      ]
    };
  }, [trendHours, bottomTx]);

  const chartOptions = (yTitle: string) => ({
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: true, position: "top" as const, labels: { color: isDark ? "#94a3b8" : "#475569", font: { size: 9, weight: "bold" as const } } }
    },
    scales: {
      x: { grid: { display: false }, ticks: { color: "#64748b", font: { size: 8 } } },
      y: {
        grid: { color: isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.04)" },
        ticks: { color: "#64748b", font: { size: 8 } }
      }
    }
  });

  const activeLineColor = isDark ? "#06b6d4" : "#3b82f6";

  return (
    <div className="space-y-6">
      {/* HEADER */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <PageHeader
          title="Single Line Diagram — Distribusi Daya"
          description="Monitoring diagram garis tunggal jaringan distribusi kelistrikan Factory 1 & Factory 2"
        />
        <div className="flex items-center gap-4">
          <button
            onClick={handleOpenConfig}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-xs font-bold text-slate-600 dark:text-slate-300 transition border border-slate-200 dark:border-slate-700 shadow-sm"
          >
            ⚙️ Config Load
          </button>
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
      <section className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm overflow-hidden w-full">
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
        <SldScaledCanvas>
          
          {/* 1. SVG PIPELINE AND POWER LINES OVERLAY */}
          <svg className="absolute inset-0 w-full h-full pointer-events-none z-0">
            <defs>
              <marker id="arrow-green" viewBox="0 0 10 10" refX="6" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
                <path d="M 0 2 L 8 5 L 0 8 z" fill="#10b981" />
              </marker>
              <marker id="arrow-red" viewBox="0 0 10 10" refX="6" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
                <path d="M 0 2 L 8 5 L 0 8 z" fill="#ef4444" />
              </marker>
              <marker id="arrow-blue" viewBox="0 0 10 10" refX="6" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
                <path d="M 0 2 L 8 5 L 0 8 z" fill={activeLineColor} />
              </marker>
            </defs>

            {/* Main PLN line down and split to Factories */}
            <path d="M 600 95 L 600 110 M 280 110 L 920 110" fill="none" stroke={activeLineColor} strokeWidth="2.5" />
            
            {/* Feeder line to Incoming Fact-1 */}
            <path d="M 280 110 L 280 120" fill="none" stroke={activeLineColor} strokeWidth="2.5" />
            
            {/* Feeder line to Incoming Fact-2 */}
            <path d="M 920 110 L 920 120" fill="none" stroke={activeLineColor} strokeWidth="2.5" />

            {/* Blue lines from Sources to Yellow Busbars */}
            <path d="M 280 180 L 280 230 M 440 180 L 440 230" fill="none" stroke={activeLineColor} strokeWidth="2.5" />
            <path d="M 760 180 L 760 230 M 920 180 L 920 230" fill="none" stroke={activeLineColor} strokeWidth="2.5" />

            {/* Busbars: Thick Yellow Lines */}
            {/* Factory 1 Busbar */}
            <path d="M 100 230 L 490 230" fill="none" stroke="#f59e0b" strokeWidth="6" strokeLinecap="round" style={{ filter: "drop-shadow(0 2px 4px rgba(245,158,11,0.3))" }} />
            <text x="110" y="222" fill="#d97706" fontSize="8" fontWeight="800" letterSpacing="0.1em">20 kV BUS (F1)</text>

            {/* Factory 2 Busbar */}
            <path d="M 700 230 L 1090 230" fill="none" stroke="#f59e0b" strokeWidth="6" strokeLinecap="round" style={{ filter: "drop-shadow(0 2px 4px rgba(245,158,11,0.3))" }} />
            <text x="710" y="222" fill="#d97706" fontSize="8" fontWeight="800" letterSpacing="0.1em">20 kV BUS (F2)</text>

            {/* Lines from Busbar 1 down to Transformers with Transformer/Breaker Symbols */}
            {[90, 220, 350, 480].map((x) => (
              <g key={x}>
                <path d={`M ${x} 230 L ${x} 270`} fill="none" stroke={activeLineColor} strokeWidth="2" />
                <rect x={x - 4} y="270" width="8" height="12" fill={isDark ? "#1e293b" : "#94a3b8"} rx="1" />
                <path d={`M ${x} 282 L ${x} 310`} fill="none" stroke={activeLineColor} strokeWidth="2" />
                {/* Transformer Circles */}
                <circle cx={x} cy="318" r="8" fill="none" stroke={activeLineColor} strokeWidth="2" />
                <circle cx={x} cy="328" r="8" fill="none" stroke={activeLineColor} strokeWidth="2" />
                <path d={`M ${x} 336 L ${x} 380`} fill="none" stroke={activeLineColor} strokeWidth="2" />
              </g>
            ))}

            {/* Lines from Busbar 2 down to Transformers */}
            {[730, 860, 990].map((x) => (
              <g key={x}>
                <path d={`M ${x} 230 L ${x} 270`} fill="none" stroke={activeLineColor} strokeWidth="2" />
                <rect x={x - 4} y="270" width="8" height="12" fill={isDark ? "#1e293b" : "#94a3b8"} rx="1" />
                <path d={`M ${x} 282 L ${x} 310`} fill="none" stroke={activeLineColor} strokeWidth="2" />
                {/* Transformer Circles */}
                <circle cx={x} cy="318" r="8" fill="none" stroke={activeLineColor} strokeWidth="2" />
                <circle cx={x} cy="328" r="8" fill="none" stroke={activeLineColor} strokeWidth="2" />
                <path d={`M ${x} 336 L ${x} 380`} fill="none" stroke={activeLineColor} strokeWidth="2" />
              </g>
            ))}

            {/* --- BACKUP FEEDER LINES --- */}
            {/* 1. Genset Caterpillar (120, 180) -> Green Dotted to Tx 1, Tx 2, Tx 3 output side */}
            <path d="M 120 180 L 120 360 L 350 360" fill="none" stroke="#10b981" strokeWidth="1.5" strokeDasharray="3 3" />
            <path d="M 90 360 L 90 380" fill="none" stroke="#10b981" strokeWidth="1.5" strokeDasharray="3 3" markerEnd="url(#arrow-green)" />
            <path d="M 220 360 L 220 380" fill="none" stroke="#10b981" strokeWidth="1.5" strokeDasharray="3 3" markerEnd="url(#arrow-green)" />
            <path d="M 350 360 L 350 380" fill="none" stroke="#10b981" strokeWidth="1.5" strokeDasharray="3 3" markerEnd="url(#arrow-green)" />

            {/* 2. Solar PV POI-1 (440, 180) -> Red Dotted to Tx 4 output side */}
            <path d="M 440 180 L 440 200 L 520 200 L 520 410 L 480 410" fill="none" stroke="#ef4444" strokeWidth="1.5" strokeDasharray="3 3" markerEnd="url(#arrow-red)" />

            {/* 3. Solar PV POI-2 (920, 180) -> Red Dotted to Tx 6 output side */}
            <path d="M 920 180 L 920 200 L 860 200 L 860 380" fill="none" stroke="#ef4444" strokeWidth="1.5" strokeDasharray="3 3" markerEnd="url(#arrow-red)" />

            {/* 4. Genset Perkins (1080, 180) -> Green Dotted to Tx 7 output side */}
            <path d="M 1080 180 L 1080 360 L 990 360 L 990 380" fill="none" stroke="#10b981" strokeWidth="1.5" strokeDasharray="3 3" markerEnd="url(#arrow-green)" />
          </svg>

          {/* 2. ABSOLUTE CARDS LAYOUT */}
          {/* Main PLN card at top */}
          <div className="absolute z-10" style={{ left: 510, top: 20 }}>
            <div className={`text-center p-3 w-[180px] rounded-xl border shadow-md transition duration-300 ${
              isDark ? "bg-slate-900 border-amber-500/20 text-white" : "bg-white border-amber-200 text-slate-800"
            }`}>
              <div className="text-[8px] font-extrabold uppercase text-amber-500 tracking-wider">Main Source</div>
              <div className="text-xs font-extrabold text-amber-500">⚡ PLN 21 kV</div>
              <div className="text-[9px] font-bold text-slate-400">5.540 kVA</div>
              <div className="text-[8px] font-mono text-slate-500 dark:text-slate-400 mt-1">
                Act: <span className="font-bold">1.850 kW</span> · PF: <span className="font-bold">0,967</span>
              </div>
            </div>
          </div>

          {/* Factory 1 Sources (Genset, Feeder, Solar) */}
          <div className="absolute z-10" style={{ left: 50, top: 120 }}>
            <div className={`p-2 w-[140px] text-center rounded-xl border shadow-md transition duration-300 ${
              isDark ? "bg-slate-900 border-slate-800" : "bg-white border-slate-200"
            }`}>
              <div className="text-[8px] font-extrabold uppercase text-amber-500">Genset Gas</div>
              <div className="text-xs font-extrabold text-slate-700 dark:text-white">1.350 kVA</div>
              <div className="text-[8px] text-slate-400">Caterpillar</div>
            </div>
          </div>
          <div className="absolute z-10" style={{ left: 210, top: 120 }}>
            <div className={`p-2 w-[140px] text-center rounded-xl border border-blue-500/30 bg-blue-500/5 shadow-md transition duration-300`}>
              <div className="text-[8px] font-extrabold uppercase text-blue-500">Incoming Fact-1</div>
              <div className="text-xs font-extrabold text-blue-500 font-mono">850 kW</div>
              <div className="text-[8px] text-slate-400">PF: 0,967</div>
            </div>
          </div>
          <div className="absolute z-10" style={{ left: 370, top: 120 }}>
            <div className={`p-2 w-[140px] text-center rounded-xl border border-emerald-500/30 bg-emerald-500/5 shadow-md transition duration-300`}>
              <div className="text-[8px] font-extrabold uppercase text-emerald-500">Solar PV POI-1</div>
              <div className="text-xs font-extrabold text-emerald-500 font-mono">50 kW</div>
              <div className="text-[8px] text-slate-400">PF: 0,967</div>
            </div>
          </div>

          {/* Factory 2 Sources (Feeder, Solar, Genset) */}
          <div className="absolute z-10" style={{ left: 690, top: 120 }}>
            <div className={`p-2 w-[140px] text-center rounded-xl border border-blue-500/30 bg-blue-500/5 shadow-md transition duration-300`}>
              <div className="text-[8px] font-extrabold uppercase text-blue-500">Incoming Fact-2</div>
              <div className="text-xs font-extrabold text-blue-500 font-mono">1.000 kW</div>
              <div className="text-[8px] text-slate-400">PF: 0,967</div>
            </div>
          </div>
          <div className="absolute z-10" style={{ left: 850, top: 120 }}>
            <div className={`p-2 w-[140px] text-center rounded-xl border border-emerald-500/30 bg-emerald-500/5 shadow-md transition duration-300`}>
              <div className="text-[8px] font-extrabold uppercase text-emerald-500">Solar PV POI-2</div>
              <div className="text-xs font-extrabold text-emerald-500 font-mono">1.000 kW</div>
              <div className="text-[8px] text-slate-400">PF: 0,967</div>
            </div>
          </div>
          <div className="absolute z-10" style={{ left: 1010, top: 120 }}>
            <div className={`p-2 w-[140px] text-center rounded-xl border shadow-md transition duration-300 ${
              isDark ? "bg-slate-900 border-slate-800" : "bg-white border-slate-200"
            }`}>
              <div className="text-[8px] font-extrabold uppercase text-rose-500">Genset Diesel</div>
              <div className="text-xs font-extrabold text-slate-700 dark:text-white">1.000 kVA</div>
              <div className="text-[8px] text-slate-400">Perkins</div>
            </div>
          </div>

          {/* Factory 1 Transformer Cards */}
          {factory1.map((tx, idx) => (
            <div key={tx.id} className="absolute z-10" style={{ left: 30 + idx * 130, top: 380, width: 120 }}>
              <SldMiniCard tx={tx} onClick={() => setSelectedTx(tx)} loadConfig={loadConfig} />
            </div>
          ))}

          {/* Factory 2 Transformer Cards */}
          {factory2.map((tx, idx) => (
            <div key={tx.id} className="absolute z-10" style={{ left: 670 + idx * 130, top: 380, width: 120 }}>
              <SldMiniCard tx={tx} onClick={() => setSelectedTx(tx)} loadConfig={loadConfig} />
            </div>
          ))}

          {/* Legend */}
          <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex items-center gap-4 text-[9px] font-bold text-slate-400 bg-slate-100/50 dark:bg-slate-900/50 px-4 py-1.5 rounded-full border border-slate-200/50 dark:border-slate-800/40">
            <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" /> Online</span>
            <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-amber-500" /> Warning</span>
            <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-rose-500" /> Offline</span>
            <span className="text-[8px] text-slate-500 italic ml-2">Klik panel untuk detail</span>
          </div>
        </SldScaledCanvas>
      </section>

      {/* ═══════════ SECTION: SUB-DISTRIBUTION POWER METERS ═══════════ */}
      <div className="space-y-3">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <span className="text-base font-extrabold text-sky-500">⚡</span>
            <h3 className="text-sm font-extrabold text-slate-800 dark:text-white">
              Sub-Distribution Power Meters Telemetry
            </h3>
          </div>

          <div className="flex items-center gap-1.5 p-1 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
            {(["ew23", "ew21", "ew22"] as const).map((grp) => (
              <button
                key={grp}
                onClick={() => setSelectedEwGroup(grp)}
                className={`px-3 py-1 rounded-lg text-xs font-extrabold uppercase transition-all ${
                  selectedEwGroup === grp
                    ? "bg-white dark:bg-slate-900 text-sky-500 shadow-sm"
                    : "text-slate-500 hover:text-slate-800 dark:hover:text-slate-300"
                }`}
              >
                {grp.toUpperCase()}
              </button>
            ))}
          </div>
        </div>

        <EwPowerMetersGrid
          powerMeters={ewPowerMeters}
          isDark={isDark}
          groupId={selectedEwGroup}
          title={`Sub-Distribution ${selectedEwGroup.toUpperCase()}`}
        />
      </div>

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
              <TransformerDetailCard key={tx.id} tx={tx} factoryLabel="F1" loadConfig={loadConfig} />
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
              <TransformerDetailCard key={tx.id} tx={tx} factoryLabel="F2" loadConfig={loadConfig} />
            ))}
          </div>
        </div>
      </section>

      {/* ═══════════ SECTION C: HISTORICAL TREND BOTTOM CHARTS (Gambar 2) ═══════════ */}
      <section className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-sm space-y-5">
        <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800/80 pb-3.5">
          <div className="flex items-center gap-2">
            <span className="text-sky-500 font-bold">📈</span>
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Transformator Historical Records
            </h3>
          </div>
          <div className="flex items-center gap-2">
            <select
              value={bottomTxId}
              onChange={(e) => setBottomTxId(e.target.value)}
              className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-bold text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-sky-500 outline-none cursor-pointer"
            >
              {transformers.map(t => (
                <option key={t.id} value={t.id}>{t.factory === 1 ? "F1" : "F2"} {t.name}</option>
              ))}
            </select>
            <span className="px-2.5 py-0.5 rounded text-[10px] font-extrabold bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 uppercase tracking-wider">
              ON
            </span>
          </div>
        </div>

        {/* 3 Line Charts grid */}
        <div className="grid gap-6 grid-cols-1">
          {/* Voltage */}
          <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/40 p-4">
            <h4 className="text-[11px] font-bold text-slate-600 dark:text-slate-400 mb-2">Voltage Record (V)</h4>
            <div style={{ height: 180 }}>
              <Line data={bottomVoltageData} options={chartOptions("Tegangan (V)")} />
            </div>
          </div>

          {/* Daya Aktif */}
          <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/40 p-4">
            <h4 className="text-[11px] font-bold text-slate-600 dark:text-slate-400 mb-2">Daya Aktif Record (kW)</h4>
            <div style={{ height: 180 }}>
              <Line data={bottomPowerData} options={chartOptions("Daya (kW)")} />
            </div>
          </div>

          {/* Ampere */}
          <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/40 p-4">
            <h4 className="text-[11px] font-bold text-slate-600 dark:text-slate-400 mb-2">Ampere Record (A)</h4>
            <div style={{ height: 180 }}>
              <Line data={bottomAmpereData} options={chartOptions("Arus (A)")} />
            </div>
          </div>
        </div>
      </section>

      {/* DETAIL MODAL IF OPENED */}
      {selectedTx && (
        <DetailRecordModal
          transformer={transformers.find(t => t.id === selectedTx.id) as any}
          onClose={() => setSelectedTx(null)}
          isDark={isDark}
          coverageList={customCoverage[selectedTx.id] || COVERED_EQUIPMENT[selectedTx.id] || []}
          onSaveSpecs={(specs) => handleSaveSpecs(selectedTx.id, specs)}
          onSaveCoverage={(items) => handleSaveCoverage(selectedTx.id, items)}
        />
      )}

      {/* CONFIG LOAD LIMITS MODAL */}
      {showConfigModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm" onClick={() => setShowConfigModal(false)}>
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl w-full max-w-sm p-6 space-y-4" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <h3 className="text-sm font-bold uppercase tracking-wide text-slate-700 dark:text-white">
                ⚙️ Config Threshold Load
              </h3>
              <button onClick={() => setShowConfigModal(false)} className="text-slate-400 hover:text-slate-600 text-lg font-bold">✕</button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="text-[10px] font-extrabold uppercase text-emerald-500 block mb-1">Aman (Hijau) - Batas Maks (%)</label>
                <input
                  type="number"
                  value={formConfig.safeMax}
                  onChange={(e) => setFormConfig({ ...formConfig, safeMax: parseInt(e.target.value) || 0 })}
                  className="w-full px-3 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-mono text-slate-800 dark:text-slate-100 focus:ring-1 focus:ring-sky-500 outline-none"
                />
              </div>
              <div>
                <label className="text-[10px] font-extrabold uppercase text-amber-500 block mb-1">Waspada (Kuning) - Batas Maks (%)</label>
                <input
                  type="number"
                  value={formConfig.cautionMax}
                  onChange={(e) => setFormConfig({ ...formConfig, cautionMax: parseInt(e.target.value) || 0 })}
                  className="w-full px-3 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-mono text-slate-800 dark:text-slate-100 focus:ring-1 focus:ring-sky-500 outline-none"
                />
              </div>
              <div>
                <label className="text-[10px] font-extrabold uppercase text-rose-500 block mb-1">Bahaya (Merah) - Batas Maks (%)</label>
                <input
                  type="number"
                  value={formConfig.dangerMax}
                  disabled
                  className="w-full px-3 py-1.5 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-mono text-slate-400 dark:text-slate-500 outline-none"
                />
              </div>
            </div>

            <div className="border-t border-slate-100 dark:border-slate-800 pt-3 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowConfigModal(false)}
                className="px-4 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-xl text-xs font-bold transition-colors"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleSaveConfig}
                disabled={savingConfig}
                className="px-4 py-2 bg-sky-500 hover:bg-sky-600 disabled:opacity-50 text-white rounded-xl text-xs font-extrabold transition-colors shadow-md shadow-sky-500/20"
              >
                {savingConfig ? "Saving..." : "💾 Simpan Config"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
