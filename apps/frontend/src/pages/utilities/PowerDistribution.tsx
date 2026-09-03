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
import { getPmSortIndex } from "../../data/pmMapping";

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
  activePowerKw: number | null;
  reactivePowerKvar: number | null;
  apparentPowerKva: number | null;
  powerFactor: number | null;
  frequencyHz: number | null;
  tempCc: number | null;
  voltageInKv: number | null;
  voltageOutL2L: number | null;
  voltageOutL2N: number | null;
  currentR: number | null;
  currentS: number | null;
  currentT: number | null;
  thdVoltage: number | null;
  thdCurrent: number | null;
  kwh: number | null;
  status: "online" | "warning" | "offline";
  vectorGroup?: string;
  impedance?: number;
  year?: string;
  manufacturer?: string;
};

/* ═══════════ INITIAL TRANSFORMER DATA (EMPTY TELEMETRY) ═══════════ */
const INITIAL_TRANSFORMERS: TransformerData[] = [
  // Factory 1
  {
    id: "mdp-1.1", name: "MDP-1.1", factory: 1, capacityKva: 630, activePowerKw: null, reactivePowerKvar: null,
    apparentPowerKva: null, powerFactor: null, frequencyHz: null, tempCc: null, voltageInKv: null,
    voltageOutL2L: null, voltageOutL2N: null, currentR: null, currentS: null, currentT: null,
    thdVoltage: null, thdCurrent: null, kwh: null, status: "offline"
  },
  {
    id: "mdp-1.2", name: "MDP-1.2", factory: 1, capacityKva: 630, activePowerKw: null, reactivePowerKvar: null,
    apparentPowerKva: null, powerFactor: null, frequencyHz: null, tempCc: null, voltageInKv: null,
    voltageOutL2L: null, voltageOutL2N: null, currentR: null, currentS: null, currentT: null,
    thdVoltage: null, thdCurrent: null, kwh: null, status: "offline"
  },
  {
    id: "mdp-2", name: "MDP-2", factory: 1, capacityKva: 1000, activePowerKw: null, reactivePowerKvar: null,
    apparentPowerKva: null, powerFactor: null, frequencyHz: null, tempCc: null, voltageInKv: null,
    voltageOutL2L: null, voltageOutL2N: null, currentR: null, currentS: null, currentT: null,
    thdVoltage: null, thdCurrent: null, kwh: null, status: "offline"
  },
  {
    id: "mdp-3", name: "MDP-3", factory: 1, capacityKva: 1000, activePowerKw: null, reactivePowerKvar: null,
    apparentPowerKva: null, powerFactor: null, frequencyHz: null, tempCc: null, voltageInKv: null,
    voltageOutL2L: null, voltageOutL2N: null, currentR: null, currentS: null, currentT: null,
    thdVoltage: null, thdCurrent: null, kwh: null, status: "offline"
  },
  // Factory 2
  {
    id: "putr-1", name: "PUTR-1", factory: 2, capacityKva: 2000, activePowerKw: null, reactivePowerKvar: null,
    apparentPowerKva: null, powerFactor: null, frequencyHz: null, tempCc: null, voltageInKv: null,
    voltageOutL2L: null, voltageOutL2N: null, currentR: null, currentS: null, currentT: null,
    thdVoltage: null, thdCurrent: null, kwh: null, status: "offline"
  },
  {
    id: "putr-2", name: "PUTR-2", factory: 2, capacityKva: 2000, activePowerKw: null, reactivePowerKvar: null,
    apparentPowerKva: null, powerFactor: null, frequencyHz: null, tempCc: null, voltageInKv: null,
    voltageOutL2L: null, voltageOutL2N: null, currentR: null, currentS: null, currentT: null,
    thdVoltage: null, thdCurrent: null, kwh: null, status: "offline"
  },
  {
    id: "putr-new", name: "PUTR-New", factory: 2, capacityKva: 1600, activePowerKw: null, reactivePowerKvar: null,
    apparentPowerKva: null, powerFactor: null, frequencyHz: null, tempCc: null, voltageInKv: null,
    voltageOutL2L: null, voltageOutL2N: null, currentR: null, currentS: null, currentT: null,
    thdVoltage: null, thdCurrent: null, kwh: null, status: "offline"
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
            <div className="relative flex-1 flex flex-col items-center justify-center text-center p-6 border border-dashed border-slate-200 dark:border-slate-800 rounded-2xl" style={{ minHeight: 260, height: "100%" }}>
              <span className="text-xs font-bold text-amber-500 dark:text-amber-400 font-mono tracking-wider">DATA HISTORIS BELUM TERSEDIA</span>
              <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-2 max-w-sm">
                Data sensor histori untuk {transformer.name} belum terhubung ke API atau database pencatatan telemetri.
              </p>
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
  const hasData = tx.activePowerKw !== null && tx.activePowerKw !== undefined;
  const loadPct = hasData && tx.capacityKva && tx.activePowerKw !== null ? Math.round((tx.activePowerKw / tx.capacityKva) * 100) : null;
  
  // Dynamic load colors based on Postgres threshold configs
  const loadColor = loadPct !== null 
    ? (loadPct <= loadConfig.safeMax ? "#10b981" : loadPct <= loadConfig.cautionMax ? "#eab308" : "#ef4444")
    : "#94a3b8";

  // Voltages per phase for display
  const vR_400 = tx.voltageOutL2L !== null ? `${(tx.voltageOutL2L).toFixed(1)}` : "—";
  const vS_400 = tx.voltageOutL2L !== null ? `${(tx.voltageOutL2L).toFixed(1)}` : "—";
  const vT_400 = tx.voltageOutL2L !== null ? `${(tx.voltageOutL2L).toFixed(1)}` : "—";

  const vR_230 = tx.voltageOutL2N !== null ? `${(tx.voltageOutL2N).toFixed(1)}` : "—";
  const vS_230 = tx.voltageOutL2N !== null ? `${(tx.voltageOutL2N).toFixed(1)}` : "—";
  const vT_230 = tx.voltageOutL2N !== null ? `${(tx.voltageOutL2N).toFixed(1)}` : "—";

  // THD per phase
  const thdv_R = tx.thdVoltage !== null ? tx.thdVoltage.toFixed(2) : "—";
  const thdv_S = tx.thdVoltage !== null ? tx.thdVoltage.toFixed(2) : "—";
  const thdv_T = tx.thdVoltage !== null ? tx.thdVoltage.toFixed(2) : "—";

  const thdi_R = tx.thdCurrent !== null ? tx.thdCurrent.toFixed(2) : "—";
  const thdi_S = tx.thdCurrent !== null ? tx.thdCurrent.toFixed(2) : "—";
  const thdi_T = tx.thdCurrent !== null ? tx.thdCurrent.toFixed(2) : "—";

  return (
    <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm overflow-hidden">
      {/* Card Header */}
      <div className="px-5 py-3 border-b border-slate-100 dark:border-slate-800/80 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <span
            className="rounded-full"
            style={{
              width: 8, height: 8,
              backgroundColor: hasData ? (tx.status === "online" ? "#10b981" : "#f59e0b") : "#94a3b8",
              boxShadow: hasData ? "0 0 6px #10b981" : "none",
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
                style={{ width: `${loadPct ? Math.min(100, loadPct) : 0}%`, backgroundColor: loadColor }}
              />
            </div>
            <span className="text-[10px] font-extrabold font-mono text-slate-400">
              {loadPct !== null ? `${loadPct}%` : "—%"}
            </span>
          </div>
        </div>
      </div>

      {/* Parameters Grid */}
      <div className="p-5">
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "12px 16px" }} className="text-xs">
          <ParamCell label="Input Voltage" value={tx.voltageInKv !== null ? `${tx.voltageInKv.toFixed(2)} kV` : "—"} />
          <ParamCell label="Output Volt 400V" value={tx.voltageOutL2L !== null ? `R:${vR_400} S:${vS_400} T:${vT_400} V` : "R: —  S: —  T: — V"} />
          <ParamCell label="Output Volt 230V" value={tx.voltageOutL2N !== null ? `R:${vR_230} S:${vS_230} T:${vT_230} V` : "R: —  S: —  T: — V"} />
          
          <ParamCell label="Active Power" value={tx.activePowerKw !== null ? `${tx.activePowerKw} kW` : "—"} accent={hasData} />
          <ParamCell label="Reactive Power" value={tx.reactivePowerKvar !== null ? `${tx.reactivePowerKvar} kVAR` : "—"} />
          <ParamCell label="Apparent Power" value={tx.apparentPowerKva !== null ? `${tx.apparentPowerKva} kVA` : "—"} />
          
          <ParamCell label="Power Factor" value={tx.powerFactor !== null ? tx.powerFactor.toFixed(3) : "—"} />
          <ParamCell label="Frequency" value={tx.frequencyHz !== null ? `${tx.frequencyHz.toFixed(2)} Hz` : "—"} />
          <ParamCell label="Temperature" value={tx.tempCc !== null ? `${tx.tempCc.toFixed(1)} °C` : "—"} warn={tx.tempCc !== null && tx.tempCc > 60} />

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
            <div className="font-mono font-bold text-slate-400">
              R: <span className="text-slate-400 mr-2">{tx.currentR !== null ? Math.round(tx.currentR) : "—"}</span>
              S: <span className="text-slate-400 mr-2">{tx.currentS !== null ? Math.round(tx.currentS) : "—"}</span>
              T: <span className="text-slate-400">{tx.currentT !== null ? Math.round(tx.currentT) : "—"}</span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4 pt-2 border-t border-slate-100 dark:border-slate-800/40 text-xs">
            <div>
              <span className="text-[9px] text-slate-400 uppercase block font-extrabold tracking-wider mb-0.5">THDV Per Fasa (%)</span>
              <div className="font-mono font-bold text-slate-400">
                R:<span className="mr-1">{thdv_R}</span>
                S:<span className="mr-1">{thdv_S}</span>
                T:<span>{thdv_T}</span>
              </div>
            </div>
            <div>
              <span className="text-[9px] text-slate-400 uppercase block font-extrabold tracking-wider mb-0.5">THDi Per Fasa (%)</span>
              <div className="font-mono font-bold text-slate-400">
                R:<span className="mr-1">{thdi_R}</span>
                S:<span className="mr-1">{thdi_S}</span>
                T:<span>{thdi_T}</span>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4 pt-2 border-t border-slate-100 dark:border-slate-800/40 text-[10px] font-bold text-slate-500">
            <div>
              <span>Voltage Unbalanced: </span>
              <span className="text-slate-400 font-mono">—</span>
            </div>
            <div>
              <span>Current Unbalanced: </span>
              <span className="text-slate-400 font-mono">—</span>
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
            <span className="text-xs font-bold text-slate-400 font-mono">
              {tx.kwh !== null ? tx.kwh.toLocaleString("id-ID") : "—"} <span className="text-[9px] text-slate-400 font-bold">kWh</span>
            </span>
          </div>
          <div>
            <span className="text-[9px] text-slate-400 uppercase block font-bold">Estimasi Cost</span>
            <span className="text-xs font-bold text-slate-400 font-mono">
              {tx.kwh !== null ? formatCurrencyIDR(tx.kwh * TARIF_PER_KWH) : "Rp —"}
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
const SLD_DESIGN_H = 620;

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
  const hasData = tx.activePowerKw !== null && tx.activePowerKw !== undefined;
  const loadPct = hasData && tx.capacityKva && tx.activePowerKw !== null ? Math.round((tx.activePowerKw / tx.capacityKva) * 100) : null;
  
  // Dynamic color thresholds based on user parameters
  const loadColor = loadPct !== null 
    ? (loadPct <= loadConfig.safeMax ? "#10b981" : loadPct <= loadConfig.cautionMax ? "#eab308" : "#ef4444")
    : "#94a3b8";

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
              backgroundColor: hasData ? (tx.status === "online" ? "#10b981" : "#f59e0b") : "#94a3b8",
              boxShadow: hasData ? "0 0 4px #10b981" : "none",
            }}
          />
          {tx.name}
        </span>
        <span className="text-[8px] font-bold text-slate-400 ml-1 flex-shrink-0">{tx.capacityKva} kVA</span>
      </div>

      {/* Power value */}
      <div className="py-2 space-y-0.5">
        <div className={`text-xs font-extrabold font-mono ${hasData ? "text-slate-800 dark:text-slate-100" : "text-slate-400"}`}>
          {hasData ? `${tx.activePowerKw} kW` : "— kW"}
        </div>
        <div className="text-[9px] font-bold text-slate-500">
          PF: <span className="font-mono text-slate-400">{tx.powerFactor !== null ? tx.powerFactor.toFixed(3) : "—"}</span>
        </div>
      </div>

      {/* Load bar */}
      <div className="space-y-1">
        <div className="flex justify-between text-[7px] font-extrabold text-slate-400">
          <span>LOAD</span>
          <span style={{ color: loadColor }}>{loadPct !== null ? `${loadPct}%` : "—%"}</span>
        </div>
        <div
          className="w-full rounded-full overflow-hidden bg-slate-100 dark:bg-slate-700/60"
          style={{ height: 4 }}
        >
          <div
            className="h-full rounded-full transition-all duration-1000"
            style={{ width: `${loadPct ? Math.min(100, loadPct) : 0}%`, backgroundColor: loadColor }}
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

  // Incoming live telemetry data
  const [incomingData, setIncomingData] = useState<{
    plnKw: number | null;
    plnPf: number | null;
    wf1Kw: number | null;
    wf1Pf: number | null;
    wf2Kw: number | null;
    wf2Pf: number | null;
  }>({
    plnKw: null,
    plnPf: null,
    wf1Kw: null,
    wf1Pf: null,
    wf2Kw: null,
    wf2Pf: null,
  });

  // Fetch incoming telemetries for PLN, Fact-1, Fact-2
  useEffect(() => {
    if (!isPageActive) return;
    const fetchIncomingData = async () => {
      try {
        const [plnRes, wf1Res, wf2Res] = await Promise.all([
          getJson<{ data: any }>("/analytics/electricity?deviceId=Cubicle_PLN_PM8000"),
          getJson<{ data: any }>("/analytics/electricity?deviceId=Feeder_WF1_PM5560"),
          getJson<{ data: any }>("/analytics/electricity?deviceId=Feeder_WF2_PM5500"),
        ]);
        setIncomingData({
          plnKw: plnRes?.data?.pqData?.activePower !== undefined ? plnRes.data.pqData.activePower : null,
          plnPf: plnRes?.data?.pqData?.pf !== undefined ? plnRes.data.pqData.pf : null,
          wf1Kw: wf1Res?.data?.pqData?.activePower !== undefined ? wf1Res.data.pqData.activePower : null,
          wf1Pf: wf1Res?.data?.pqData?.pf !== undefined ? wf1Res.data.pqData.pf : null,
          wf2Kw: wf2Res?.data?.pqData?.activePower !== undefined ? wf2Res.data.pqData.activePower : null,
          wf2Pf: wf2Res?.data?.pqData?.pf !== undefined ? wf2Res.data.pqData.pf : null,
        });
      } catch (err) {
        console.error("Failed to load incoming telemetries for SLD:", err);
      }
    };

    fetchIncomingData();
    const interval = setInterval(fetchIncomingData, 5000);

    const socket = getSocket();
    const handleIncomingLive = (payload: any) => {
      if (!payload || !payload.deviceId || !payload.pqData) return;
      setIncomingData(prev => {
        if (payload.deviceId === "Cubicle_PLN_PM8000") {
          return { ...prev, plnKw: payload.pqData.activePower, plnPf: payload.pqData.pf };
        }
        if (payload.deviceId === "Feeder_WF1_PM5560") {
          return { ...prev, wf1Kw: payload.pqData.activePower, wf1Pf: payload.pqData.pf };
        }
        if (payload.deviceId === "Feeder_WF2_PM5500") {
          return { ...prev, wf2Kw: payload.pqData.activePower, wf2Pf: payload.pqData.pf };
        }
        return prev;
      });
    };

    socket.on("electricity:live_update", handleIncomingLive);
    return () => {
      clearInterval(interval);
      socket.off("electricity:live_update", handleIncomingLive);
    };
  }, [isPageActive]);

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
            const sorted = [...res.data].sort((a, b) => getPmSortIndex(a.pm_id) - getPmSortIndex(b.pm_id));
            setEwPowerMeters(sorted);
          }
        })
        .catch((err) => console.error("Failed to load EW power meters:", err));
    };

    fetchPmData();
    const interval = setInterval(fetchPmData, 10000);

    const socket = getSocket();
    const handleLiveUpdate = (payload: { groupId: string; data: ElectricPmItem[] }) => {
      if (payload?.groupId?.toLowerCase() === selectedEwGroup && Array.isArray(payload.data)) {
        const sorted = [...payload.data].sort((a, b) => getPmSortIndex(a.pm_id) - getPmSortIndex(b.pm_id));
        setEwPowerMeters(sorted);
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
    const sumIncoming = (incomingData.wf1Kw || 0) + (incomingData.wf2Kw || 0);
    return sumIncoming > 0 ? sumIncoming : (incomingData.plnKw || 0);
  }, [incomingData]);

  const totalCapacityKva = useMemo(() => {
    return transformers.reduce((sum, tx) => sum + tx.capacityKva, 0);
  }, [transformers]);

  const factory1 = transformers.filter(tx => tx.factory === 1);
  const factory2 = transformers.filter(tx => tx.factory === 2);

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
              {totalLoadKw > 0 ? `${totalLoadKw.toLocaleString("id-ID")} kW` : "— kW"}
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
          
          {/* 1. SVG PIPELINE AND POWER LINES OVERLAY (z-20 on top so never occluded) */}
          <svg className="absolute inset-0 w-full h-full pointer-events-none z-20">
            <defs>
              <marker id="arrow-green" viewBox="0 0 10 10" refX="7.5" refY="5" markerWidth="6" markerHeight="6" orient="auto">
                <path d="M 0 1.5 L 8 5 L 0 8.5 z" fill="#10b981" />
              </marker>
              <marker id="arrow-red" viewBox="0 0 10 10" refX="7.5" refY="5" markerWidth="6" markerHeight="6" orient="auto">
                <path d="M 0 1.5 L 8 5 L 0 8.5 z" fill="#ef4444" />
              </marker>
              <marker id="arrow-orange" viewBox="0 0 10 10" refX="7" refY="5" markerWidth="6" markerHeight="6" orient="auto">
                <path d="M 0 1.5 L 8 5 L 0 8.5 z" fill="#f97316" />
              </marker>
              <marker id="arrow-blue" viewBox="0 0 10 10" refX="7" refY="5" markerWidth="6" markerHeight="6" orient="auto">
                <path d="M 0 1.5 L 8 5 L 0 8.5 z" fill={activeLineColor} />
              </marker>
            </defs>

            {/* --- AUXILIARY POWER ROUTING (Rendered behind busbars so yellow busbar covers crossing lines) --- */}
            {/* 1. Genset Natural Gas (95, 242) -> Feeds MDP-1.2 (183, 415) and branches to MDP-2 (293, 415) */}
            <path
              d="M 95 242 L 95 345 L 282 345 M 172 345 L 172 415 L 183 415 M 282 345 L 282 415 L 293 415"
              fill="none"
              stroke="#10b981"
              strokeWidth="2"
              strokeDasharray="4 3"
            />
            {/* Arrowhead into left side of MDP-1.2 */}
            <path
              d="M 172 415 L 183 415"
              fill="none"
              stroke="#10b981"
              strokeWidth="2"
              markerEnd="url(#arrow-green)"
            />
            {/* Arrowhead on second branch into left side of MDP-2 */}
            <path
              d="M 282 415 L 293 415"
              fill="none"
              stroke="#10b981"
              strokeWidth="2"
              markerEnd="url(#arrow-green)"
            />
            {/* Branch junction circle */}
            <circle cx="172" cy="345" r="2.5" fill="#10b981" />

            {/* 2. Solar PV POI-1 (475, 242) -> Feeds right side of MDP-3 (497, 415) */}
            <path
              d="M 475 242 L 475 252 L 525 252 L 525 415 L 497 415"
              fill="none"
              stroke="#ef4444"
              strokeWidth="2"
              strokeDasharray="3 3"
              markerEnd="url(#arrow-red)"
            />

            {/* 3. Solar PV POI-2 (978, 242) -> Starts flush at bottom edge, passes BEHIND yellow busbar, turns left at 415 into PUTR-2 (965, 415) */}
            <path
              d="M 978 242 L 978 415 L 965 415"
              fill="none"
              stroke="#ef4444"
              strokeWidth="2"
              strokeDasharray="3 3"
              markerEnd="url(#arrow-red)"
            />

            {/* 4. Genset Diesel Fuel (1105, 242) -> Straight down along right side, turns left at 415 into right side of PUTR-NEW (1085, 415) */}
            <path
              d="M 1105 242 L 1105 415 L 1085 415"
              fill="none"
              stroke="#10b981"
              strokeWidth="2"
              strokeDasharray="4 3"
              markerEnd="url(#arrow-green)"
            />

            {/* Main PLN line down and split symmetrically to Factory 1 (285) & Factory 2 (795) */}
            <path d="M 600 114 L 600 134 M 285 134 L 795 134" fill="none" stroke={activeLineColor} strokeWidth="2.5" />
            
            {/* Feeder line into Incoming Fact-1 */}
            <path d="M 285 134 L 285 150" fill="none" stroke={activeLineColor} strokeWidth="2.5" />
            
            {/* Feeder line into Incoming Fact-2 */}
            <path d="M 795 134 L 795 150" fill="none" stroke={activeLineColor} strokeWidth="2.5" />

            {/* Blue lines from Incoming Feeders down to Yellow Busbars */}
            <path d="M 285 226 L 285 265" fill="none" stroke={activeLineColor} strokeWidth="2.5" />
            <path d="M 795 226 L 795 265" fill="none" stroke={activeLineColor} strokeWidth="2.5" />

            {/* Busbars: Thick Yellow Lines with Ambient Glow (Rendered IN FRONT of auxiliary lines) */}
            {/* Factory 1 Busbar (Centered at X = 285, Width = 430) */}
            <path d="M 70 265 L 500 265" fill="none" stroke="#eab308" strokeWidth="6.5" strokeLinecap="round" style={{ filter: "drop-shadow(0 2px 4px rgba(234,179,8,0.35))" }} />
            <text x="75" y="258" fill="#ca8a04" fontSize="8" fontWeight="800" letterSpacing="0.08em">21 kV BUS (FACTORY 1)</text>

            {/* Factory 2 Busbar (Centered at X = 915, Width = 350) */}
            <path d="M 741 265 L 1089 265" fill="none" stroke="#eab308" strokeWidth="6.5" strokeLinecap="round" style={{ filter: "drop-shadow(0 2px 4px rgba(234,179,8,0.35))" }} />
            <text x="746" y="258" fill="#ca8a04" fontSize="8" fontWeight="800" letterSpacing="0.08em">21 kV BUS (FACTORY 2)</text>

            {/* Factory 1: 4 Symmetrical Transformer Branches (Centers: 120, 230, 340, 450) */}
            {[120, 230, 340, 450].map((x) => (
              <g key={x}>
                <path d={`M ${x} 265 L ${x} 288`} fill="none" stroke={activeLineColor} strokeWidth="2" />
                {/* Transformer Dual Circles with Voltage Text */}
                <circle cx={x} cy="300" r="12.5" fill={isDark ? "#0f172a" : "#ffffff"} stroke={activeLineColor} strokeWidth="1.8" />
                <text x={x} y="303" textAnchor="middle" fill={isDark ? "#94a3b8" : "#475569"} fontSize="6.5" fontWeight="bold">21 kV</text>
                <circle cx={x} cy="318" r="12.5" fill={isDark ? "#0f172a" : "#ffffff"} stroke={activeLineColor} strokeWidth="1.8" />
                <text x={x} y="321" textAnchor="middle" fill={isDark ? "#94a3b8" : "#475569"} fontSize="6.5" fontWeight="bold">400 V</text>
                <path d={`M ${x} 331 L ${x} 360`} fill="none" stroke={activeLineColor} strokeWidth="2" />
              </g>
            ))}

            {/* Factory 2: 3 Symmetrical Transformer Branches (Centers: 795, 915, 1035) */}
            {[795, 915, 1035].map((x) => (
              <g key={x}>
                <path d={`M ${x} 265 L ${x} 288`} fill="none" stroke={activeLineColor} strokeWidth="2" />
                {/* Transformer Dual Circles with Voltage Text */}
                <circle cx={x} cy="300" r="12.5" fill={isDark ? "#0f172a" : "#ffffff"} stroke={activeLineColor} strokeWidth="1.8" />
                <text x={x} y="303" textAnchor="middle" fill={isDark ? "#94a3b8" : "#475569"} fontSize="6.5" fontWeight="bold">21 kV</text>
                <circle cx={x} cy="318" r="12.5" fill={isDark ? "#0f172a" : "#ffffff"} stroke={activeLineColor} strokeWidth="1.8" />
                <text x={x} y="321" textAnchor="middle" fill={isDark ? "#94a3b8" : "#475569"} fontSize="6.5" fontWeight="bold">400 V</text>
                <path d={`M ${x} 331 L ${x} 360`} fill="none" stroke={activeLineColor} strokeWidth="2" />
              </g>
            ))}
          </svg>

          {/* 2. ABSOLUTE CARDS LAYOUT */}
          {/* Main PLN card at top center (X = 600) */}
          <div className="absolute z-10" style={{ left: 515, top: 16 }}>
            <div className={`text-center p-3 w-[170px] rounded-2xl border shadow-md transition duration-300 ${
              isDark ? "bg-blue-950/40 border-blue-500/40 text-white" : "bg-blue-50/90 border-blue-300 text-slate-800"
            }`}>
              <div className="text-xs font-black text-blue-600 dark:text-blue-400 tracking-wide">PLN-21 kV</div>
              <div className="text-[11px] font-extrabold text-blue-700 dark:text-blue-300">5,540 kVa</div>
              <div className="text-[9px] font-semibold text-slate-500 dark:text-slate-400 mt-1">
                Active Power <br />
                <span className="font-extrabold font-mono text-slate-800 dark:text-slate-200">
                  {incomingData.plnKw !== null ? `${incomingData.plnKw.toLocaleString("id-ID")} kW` : "— kW"}
                </span>
              </div>
              <div className="text-[8px] font-semibold text-slate-500 dark:text-slate-400">
                PF : <span className="font-bold font-mono">{incomingData.plnPf !== null ? incomingData.plnPf.toFixed(3) : "—"}</span>
              </div>
            </div>
          </div>

          {/* ═══════════ FACTORY 1 SOURCES (Left Wing, Center = 285) ═══════════ */}
          {/* 1. Genset Natural Gas (Outer Left) */}
          <div className="absolute z-10" style={{ left: 30, top: 160 }}>
            <div className={`p-2.5 w-[130px] text-center rounded-2xl border shadow-sm transition duration-300 ${
              isDark ? "bg-orange-950/30 border-orange-500/30 text-orange-200" : "bg-orange-50/90 border-orange-200 text-slate-800"
            }`}>
              <div className="text-[10px] font-extrabold text-orange-600 dark:text-orange-400">Genset</div>
              <div className="text-[10px] font-extrabold text-orange-600 dark:text-orange-400">Natural Gas</div>
              <div className="text-[10px] font-bold text-slate-600 dark:text-slate-300 mt-0.5">1350 kVa</div>
              <div className="text-[8px] text-slate-400 mt-1 font-mono">Belum Ada Sensor</div>
            </div>
          </div>

          {/* 2. Incoming Fact-1 (Center F1) */}
          <div className="absolute z-10" style={{ left: 215, top: 150 }}>
            <div className={`p-2.5 w-[140px] text-center rounded-2xl border shadow-sm transition duration-300 ${
              isDark ? "bg-blue-950/40 border-blue-500/40 text-white" : "bg-blue-50/90 border-blue-300 text-slate-800"
            }`}>
              <div className="text-[11px] font-black text-blue-600 dark:text-blue-400">Incoming</div>
              <div className="text-[11px] font-black text-blue-600 dark:text-blue-400">Fact-1</div>
              <div className="text-[9px] font-semibold text-slate-500 dark:text-slate-400 mt-0.5">
                Active Power <br />
                <span className="font-extrabold font-mono text-slate-800 dark:text-slate-200">
                  {incomingData.wf1Kw !== null ? `${incomingData.wf1Kw.toLocaleString("id-ID")} kW` : "— kW"}
                </span>
              </div>
              <div className="text-[8px] font-semibold text-slate-500 dark:text-slate-400">
                PF : <span className="font-bold font-mono">{incomingData.wf1Pf !== null ? incomingData.wf1Pf.toFixed(3) : "—"}</span>
              </div>
            </div>
          </div>

          {/* 3. Solar PV POI-1 (Inner Left) */}
          <div className="absolute z-10" style={{ left: 410, top: 160 }}>
            <div className={`p-2.5 w-[130px] text-center rounded-2xl border shadow-sm transition duration-300 ${
              isDark ? "bg-orange-950/30 border-orange-500/30 text-orange-200" : "bg-orange-50/90 border-orange-200 text-slate-800"
            }`}>
              <div className="text-[10px] font-extrabold text-orange-600 dark:text-orange-400">Solar PV</div>
              <div className="text-[10px] font-extrabold text-orange-600 dark:text-orange-400">POI-1</div>
              <div className="text-[9px] font-semibold text-slate-500 dark:text-slate-400 mt-0.5">
                Active Power: <span className="font-bold font-mono text-slate-400">—</span>
              </div>
              <div className="text-[8px] font-semibold text-slate-500 dark:text-slate-400">
                PF : <span className="font-bold font-mono text-slate-400">—</span>
              </div>
            </div>
          </div>

          {/* ═══════════ FACTORY 2 SOURCES (Right Wing) ═══════════ */}
          {/* 1. Incoming Fact-2 (Left F2, Center = 795) */}
          <div className="absolute z-10" style={{ left: 725, top: 150 }}>
            <div className={`p-2.5 w-[140px] text-center rounded-2xl border shadow-sm transition duration-300 ${
              isDark ? "bg-blue-950/40 border-blue-500/40 text-white" : "bg-blue-50/90 border-blue-300 text-slate-800"
            }`}>
              <div className="text-[11px] font-black text-blue-600 dark:text-blue-400">Incoming</div>
              <div className="text-[11px] font-black text-blue-600 dark:text-blue-400">Fact-2</div>
              <div className="text-[9px] font-semibold text-slate-500 dark:text-slate-400 mt-0.5">
                Active Power <br />
                <span className="font-extrabold font-mono text-slate-800 dark:text-slate-200">
                  {incomingData.wf2Kw !== null ? `${incomingData.wf2Kw.toLocaleString("id-ID")} kW` : "— kW"}
                </span>
              </div>
              <div className="text-[8px] font-semibold text-slate-500 dark:text-slate-400">
                PF : <span className="font-bold font-mono">{incomingData.wf2Pf !== null ? incomingData.wf2Pf.toFixed(3) : "—"}</span>
              </div>
            </div>
          </div>

          {/* 2. Solar PV POI-2 (Center F2, Center = 950) */}
          <div className="absolute z-10" style={{ left: 885, top: 160 }}>
            <div className={`p-2.5 w-[130px] text-center rounded-2xl border shadow-sm transition duration-300 ${
              isDark ? "bg-orange-950/30 border-orange-500/30 text-orange-200" : "bg-orange-50/90 border-orange-200 text-slate-800"
            }`}>
              <div className="text-[10px] font-extrabold text-orange-600 dark:text-orange-400">Solar PV</div>
              <div className="text-[10px] font-extrabold text-orange-600 dark:text-orange-400">POI-2</div>
              <div className="text-[9px] font-semibold text-slate-500 dark:text-slate-400 mt-0.5">
                Active Power: <span className="font-bold font-mono text-slate-400">—</span>
              </div>
              <div className="text-[8px] font-semibold text-slate-500 dark:text-slate-400">
                PF : <span className="font-bold font-mono text-slate-400">—</span>
              </div>
            </div>
          </div>

          {/* 3. Genset Diesel Fuel (Outer Right, Center = 1105) */}
          <div className="absolute z-10" style={{ left: 1040, top: 160 }}>
            <div className={`p-2.5 w-[130px] text-center rounded-2xl border shadow-sm transition duration-300 ${
              isDark ? "bg-orange-950/30 border-orange-500/30 text-orange-200" : "bg-orange-50/90 border-orange-200 text-slate-800"
            }`}>
              <div className="text-[10px] font-extrabold text-orange-600 dark:text-orange-400">Genset</div>
              <div className="text-[10px] font-extrabold text-orange-600 dark:text-orange-400">Diesel Fuel</div>
              <div className="text-[10px] font-bold text-slate-600 dark:text-slate-300 mt-0.5">1000 kVa</div>
              <div className="text-[8px] text-slate-400 mt-1 font-mono">Belum Ada Sensor</div>
            </div>
          </div>

          {/* ═══════════ FACTORY 1 TRANSFORMER CARDS (4 Units) ═══════════ */}
          {factory1.map((tx, idx) => {
            const cardLeft = 73 + idx * 110;
            const hasData = tx.activePowerKw !== null;
            const loadPct = hasData && tx.capacityKva && tx.activePowerKw !== null ? Math.round((tx.activePowerKw / tx.capacityKva) * 100) : null;
            return (
              <div key={tx.id} className="absolute z-10" style={{ left: cardLeft, top: 360, width: 94 }}>
                <div
                  onClick={() => setSelectedTx(tx)}
                  className={`rounded-2xl border p-2.5 text-center cursor-pointer transition-all duration-300 hover:shadow-lg ${
                    idx === 0
                      ? "bg-slate-900 border-slate-700 text-white"
                      : isDark
                        ? "bg-slate-800/80 border-slate-700 text-slate-200"
                        : "bg-slate-100/90 border-slate-300 text-slate-800"
                  }`}
                >
                  <div className={`text-[11px] font-black ${idx === 0 ? "text-slate-200" : "text-slate-800 dark:text-white"}`}>
                    {tx.capacityKva} kVa
                  </div>
                  <div className={`text-[9px] font-black tracking-wider uppercase ${idx === 0 ? "text-slate-300" : "text-slate-600 dark:text-slate-400"}`}>
                    {tx.name}
                  </div>
                  <div className="mt-1 text-[8px] text-slate-400 font-semibold">Active Power</div>
                  <div className={`text-[11px] font-extrabold font-mono ${hasData ? (idx === 0 ? "text-sky-400" : "text-slate-800 dark:text-slate-100") : "text-slate-400"}`}>
                    {hasData ? `${tx.activePowerKw} kW` : "— kW"}
                  </div>
                  <div className="text-[8px] text-slate-400">
                    PF: <span className="font-bold">{tx.powerFactor !== null ? tx.powerFactor.toFixed(3) : "—"}</span>
                  </div>
                  
                  {/* Load progress bar */}
                  <div className="mt-1.5 pt-1 border-t border-slate-200 dark:border-slate-700/60">
                    <div className="w-full bg-slate-200 dark:bg-slate-700 h-1.5 rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full bg-slate-300 dark:bg-slate-600"
                        style={{ width: `${loadPct ? Math.min(100, loadPct) : 0}%` }}
                      />
                    </div>
                    <div className="text-[7.5px] font-bold text-center mt-0.5 text-slate-400">
                      {loadPct !== null ? `${loadPct}%` : "—%"}
                    </div>
                  </div>
                </div>

                {/* 400V/230V Label Box */}
                <div className="mt-1.5 text-center py-0.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-200/80 dark:bg-slate-800 text-[8px] font-black text-slate-700 dark:text-slate-300 tracking-wider">
                  400V/230V
                </div>

                {/* Detail Button */}
                <button
                  onClick={() => setSelectedTx(tx)}
                  className="w-full mt-1.5 py-1 rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-300/80 hover:bg-sky-500 hover:text-white dark:bg-slate-700 dark:hover:bg-sky-600 text-[9px] font-extrabold text-slate-700 dark:text-slate-200 transition-colors shadow-sm"
                >
                  Detail
                </button>
              </div>
            );
          })}

          {/* ═══════════ FACTORY 2 TRANSFORMER CARDS (3 Units) ═══════════ */}
          {factory2.map((tx, idx) => {
            const cardLeft = 745 + idx * 120;
            const hasData = tx.activePowerKw !== null;
            const loadPct = hasData && tx.capacityKva && tx.activePowerKw !== null ? Math.round((tx.activePowerKw / tx.capacityKva) * 100) : null;
            return (
              <div key={tx.id} className="absolute z-10" style={{ left: cardLeft, top: 360, width: 100 }}>
                <div
                  onClick={() => setSelectedTx(tx)}
                  className={`rounded-2xl border p-2.5 text-center cursor-pointer transition-all duration-300 hover:shadow-lg ${
                    idx === 0
                      ? "bg-slate-900 border-slate-700 text-white"
                      : isDark
                        ? "bg-slate-800/80 border-slate-700 text-slate-200"
                        : "bg-slate-100/90 border-slate-300 text-slate-800"
                  }`}
                >
                  <div className={`text-[11px] font-black ${idx === 0 ? "text-slate-200" : "text-slate-800 dark:text-white"}`}>
                    {tx.capacityKva} kVa
                  </div>
                  <div className={`text-[9px] font-black tracking-wider uppercase ${idx === 0 ? "text-slate-300" : "text-slate-600 dark:text-slate-400"}`}>
                    {tx.name}
                  </div>
                  <div className="mt-1 text-[8px] text-slate-400 font-semibold">Active Power</div>
                  <div className={`text-[11px] font-extrabold font-mono ${hasData ? (idx === 0 ? "text-emerald-400" : "text-slate-800 dark:text-slate-100") : "text-slate-400"}`}>
                    {hasData ? `${tx.activePowerKw} kW` : "— kW"}
                  </div>
                  <div className="text-[8px] text-slate-400">
                    PF: <span className="font-bold">{tx.powerFactor !== null ? tx.powerFactor.toFixed(3) : "—"}</span>
                  </div>

                  {/* Load progress bar */}
                  <div className="mt-1.5 pt-1 border-t border-slate-200 dark:border-slate-700/60">
                    <div className="w-full bg-slate-200 dark:bg-slate-700 h-1.5 rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full bg-slate-300 dark:bg-slate-600"
                        style={{ width: `${loadPct ? Math.min(100, loadPct) : 0}%` }}
                      />
                    </div>
                    <div className="text-[7.5px] font-bold text-center mt-0.5 text-slate-400">
                      {loadPct !== null ? `${loadPct}%` : "—%"}
                    </div>
                  </div>
                </div>

                {/* 400V/230V Label Box */}
                <div className="mt-1.5 text-center py-0.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-200/80 dark:bg-slate-800 text-[8px] font-black text-slate-700 dark:text-slate-300 tracking-wider">
                  400V/230V
                </div>

                {/* Detail Button */}
                <button
                  onClick={() => setSelectedTx(tx)}
                  className="w-full mt-1.5 py-1 rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-300/80 hover:bg-sky-500 hover:text-white dark:bg-slate-700 dark:hover:bg-sky-600 text-[9px] font-extrabold text-slate-700 dark:text-slate-200 transition-colors shadow-sm"
                >
                  Detail
                </button>
              </div>
            );
          })}

          {/* Legend */}
          <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex items-center gap-4 text-[9px] font-bold text-slate-400 bg-slate-100/50 dark:bg-slate-900/50 px-4 py-1.5 rounded-full border border-slate-200/50 dark:border-slate-800/40">
            <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" /> Online</span>
            <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-amber-500" /> Warning</span>
            <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-slate-400" /> Belum Ada Sensor</span>
            <span className="text-[8px] text-slate-500 italic ml-2">Klik panel / Detail untuk info lengkap</span>
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

      {/* ═══════════ SECTION C: HISTORICAL TREND BOTTOM CHARTS ═══════════ */}
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
            <span className="px-2.5 py-0.5 rounded text-[10px] font-extrabold bg-slate-500/10 text-slate-400 border border-slate-500/20 uppercase tracking-wider">
              OFFLINE
            </span>
          </div>
        </div>

        {/* 3 Line Charts empty state */}
        <div className="grid gap-6 grid-cols-1">
          {/* Voltage */}
          <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/40 p-4">
            <h4 className="text-[11px] font-bold text-slate-600 dark:text-slate-400 mb-2">Voltage Record (V)</h4>
            <div className="h-[120px] flex flex-col items-center justify-center text-center p-4 border border-dashed border-slate-200 dark:border-slate-800 rounded-xl">
              <span className="text-xs font-bold text-amber-500 dark:text-amber-400 font-mono tracking-wider">DATA BELUM TERSEDIA</span>
              <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-1">Data sensor dan histori transformator belum terintegrasi ke database/API.</p>
            </div>
          </div>

          {/* Daya Aktif */}
          <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/40 p-4">
            <h4 className="text-[11px] font-bold text-slate-600 dark:text-slate-400 mb-2">Daya Aktif Record (kW)</h4>
            <div className="h-[120px] flex flex-col items-center justify-center text-center p-4 border border-dashed border-slate-200 dark:border-slate-800 rounded-xl">
              <span className="text-xs font-bold text-amber-500 dark:text-amber-400 font-mono tracking-wider">DATA BELUM TERSEDIA</span>
              <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-1">Data sensor dan histori transformator belum terintegrasi ke database/API.</p>
            </div>
          </div>

          {/* Ampere */}
          <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/40 p-4">
            <h4 className="text-[11px] font-bold text-slate-600 dark:text-slate-400 mb-2">Ampere Record (A)</h4>
            <div className="h-[120px] flex flex-col items-center justify-center text-center p-4 border border-dashed border-slate-200 dark:border-slate-800 rounded-xl">
              <span className="text-xs font-bold text-amber-500 dark:text-amber-400 font-mono tracking-wider">DATA BELUM TERSEDIA</span>
              <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-1">Data sensor dan histori transformator belum terintegrasi ke database/API.</p>
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
