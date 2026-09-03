import { useState, useMemo, useCallback, useEffect } from "react";
import { PageHeader } from "../../components/ui/PageHeader";
import { useSystemStore } from "../../store/system.store";
import { getJson } from "../../services/api.client";

/* ═══════════ TYPES ═══════════ */
type ReportCategory = "energy" | "tegangan" | "ampere" | "thd" | "daya";

type FactoryOption = { id: string; label: string };
type TagOption = { id: string; label: string; factory: string };
type GranularityOption = { id: string; label: string };

/* ═══════════ CONSTANTS ═══════════ */
const FACTORIES: FactoryOption[] = [
  { id: "all", label: "Semua Factory" },
  { id: "f1", label: "Factory 1" },
  { id: "f2", label: "Factory 2" },
];

const TAGS: TagOption[] = [
  // Factory 1
  { id: "f1-mdp-1.1", label: "F1 MDP-1.1", factory: "f1" },
  { id: "f1-mdp-1.2", label: "F1 MDP-1.2", factory: "f1" },
  { id: "f1-mdp-2", label: "F1 MDP2", factory: "f1" },
  { id: "f1-mdp-3", label: "F1 MDP3", factory: "f1" },
  // Factory 2
  { id: "f2-putr-1", label: "F2 PUTR-1", factory: "f2" },
  { id: "f2-putr-2", label: "F2 PUTR-2", factory: "f2" },
  { id: "f2-putr-new", label: "F2 PUTR-New", factory: "f2" },
];

const GRANULARITY: GranularityOption[] = [
  { id: "hour", label: "Hour" },
  { id: "day", label: "Day" },
  { id: "month", label: "Month" },
];

const REPORT_TABS: { key: ReportCategory; label: string; icon: string }[] = [
  { key: "energy", label: "Energy", icon: "⚡" },
  { key: "tegangan", label: "Tegangan", icon: "🔌" },
  { key: "ampere", label: "Ampere", icon: "🔋" },
  { key: "thd", label: "THD", icon: "📊" },
  { key: "daya", label: "Daya", icon: "💡" },
];

const COLUMNS: Record<ReportCategory, { key: string; label: string; unit?: string }[]> = {
  energy: [
    { key: "date", label: "DATE" },
    { key: "tag", label: "TAG DESCRIPTION" },
    { key: "kwh", label: "KWH", unit: "kWh" },
    { key: "kvarh", label: "KVARH", unit: "kVARh" },
    { key: "kvah", label: "KVAH", unit: "kVAh" },
  ],
  tegangan: [
    { key: "date", label: "DATE" },
    { key: "tag", label: "TAG DESCRIPTION" },
    { key: "vr", label: "V R-N", unit: "V" },
    { key: "vs", label: "V S-N", unit: "V" },
    { key: "vt", label: "V T-N", unit: "V" },
    { key: "vrs", label: "V R-S", unit: "V" },
    { key: "vst", label: "V S-T", unit: "V" },
    { key: "vtr", label: "V T-R", unit: "V" },
  ],
  ampere: [
    { key: "date", label: "DATE" },
    { key: "tag", label: "TAG DESCRIPTION" },
    { key: "ir", label: "I R", unit: "A" },
    { key: "is", label: "I S", unit: "A" },
    { key: "it", label: "I T", unit: "A" },
    { key: "in", label: "I N", unit: "A" },
  ],
  thd: [
    { key: "date", label: "DATE" },
    { key: "tag", label: "TAG DESCRIPTION" },
    { key: "thdv_r", label: "THD-V R", unit: "%" },
    { key: "thdv_s", label: "THD-V S", unit: "%" },
    { key: "thdv_t", label: "THD-V T", unit: "%" },
    { key: "thdi_r", label: "THD-I R", unit: "%" },
    { key: "thdi_s", label: "THD-I S", unit: "%" },
    { key: "thdi_t", label: "THD-I T", unit: "%" },
  ],
  daya: [
    { key: "date", label: "DATE" },
    { key: "tag", label: "TAG DESCRIPTION" },
    { key: "kw", label: "KW", unit: "kW" },
    { key: "kvar", label: "KVAR", unit: "kVAR" },
    { key: "kva", label: "KVA", unit: "kVA" },
    { key: "pf", label: "PF" },
    { key: "freq", label: "FREQ", unit: "Hz" },
  ],
};

/* ═══════════ MOCK DATA GENERATORS ═══════════ */
const getLocalTodayString = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

const COVERED_MACHINES: Record<string, string[]> = {
  "f1-mdp-1.1": [
    "Sparepart Room & Office Prod",
    "Warehouse-3",
    "Penerangan Steril-1",
    "Penerangan Security",
    "Penerangan WT",
    "Penerangan Utility",
    "HVAC IP Unit-2",
    "Cooling-1",
    "Steril-1 Penerangan",
    "Boiler-1",
    "Compressor Unit-1 (Mitsui)",
    "Workshop",
    "IP-1",
    "Warehouse-2",
    "Crusher",
    "Preparation-1",
    "WT-1",
    "Steril-2 Mesin",
    "Chiller Daikin-Timur",
    "Deep Well",
    "Compressor Unit-3"
  ],
  "f1-mdp-1.2": [
    "Chiller Daikin",
    "HVAC Warehouse-3",
    "DU & WT",
    "Mini Lab & R.Server MIS",
    "Chiller Unit-1",
    "BP Unit-1",
    "HVAC Unit-1"
  ],
  "f1-mdp-2": [
    "Chiller Trane",
    "Material Storage Unit-2",
    "Corridor & R. SPV Unit-2",
    "P. Penerangan Depan Laundry",
    "P. Preparation Unit-2",
    "P. WT Unit-2",
    "P. IP Unit-2",
    "P. Warehouse-1",
    "P. Cooling Unit-2",
    "P. HVAC Mezanine Unit-2",
    "P. Chiller HVAC Unit-2",
    "P. Capacitor Bank",
    "Steril Unit-2",
    "Corridor Unit-2",
    "Penerangan Warehouse-2",
    "Charger Battery Genset Fact-1",
    "P. Warehouse-4",
    "BP-3 & BP-4",
    "Compressor Unit-2",
    "Cooling Unit-3"
  ],
  "f1-mdp-3": [
    "Office & Lab QC",
    "P. Preparation Unit-3",
    "P. WT Unit-3",
    "P. IP Unit-3",
    "P. Steril Unit-3",
    "P. Boiler & Compressor",
    "P. HVAC Unit-3",
    "P. BP-5",
    "P. BP-6",
    "P. Boiler",
    "Material Warehouse-2",
    "Penerangan IP-3"
  ],
  "f2-putr-1": [
    "MCC Water Treatment",
    "Panel Preparation",
    "Panel Produk Palletizing",
    "Panel Weighing",
    "Panel Laundry",
    "Panel Mesin",
    "Panel Bottle"
  ],
  "f2-putr-2": [
    "Panel Chiller / Panel Chiller ELV +6.60",
    "Panel Lighting Area 1",
    "Panel Lighting Area 2",
    "Area Utility",
    "Panel Main Critical"
  ],
  "f2-putr-new": [
    "AC WHO & New Crusher",
    "Spare 1",
    "Spare 2",
    "Spare 3",
    "Spare 4"
  ]
};

/* ═══════════ EXPORT TO EXCEL HELPER ═══════════ */
async function exportToExcel(data: Record<string, any>[], columns: { key: string; label: string }[], filename: string) {
  try {
    const { utils, writeFile } = await import("xlsx");
    const headerRow = columns.map(c => c.label);
    const dataRows = data.map(row => columns.map(c => row[c.key] ?? ""));
    const ws = utils.aoa_to_sheet([headerRow, ...dataRows]);

    // Auto column widths
    ws["!cols"] = columns.map((c) => ({
      wch: Math.max(c.label.length + 2, 18)
    }));

    const wb = utils.book_new();
    utils.book_append_sheet(wb, ws, "Report");
    writeFile(wb, filename);
  } catch {
    alert("Gagal export. Pastikan library xlsx tersedia.");
  }
}

/* ═══════════ FORMATTING ═══════════ */
const fmtNum = (v: any) => {
  if (v == null || v === "") return "-";
  const n = Number(v);
  if (isNaN(n)) return String(v);
  return n.toLocaleString("id-ID", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

/* ═══════════ MAIN COMPONENT ═══════════ */
export default function ElectricityReport() {
  const theme = useSystemStore((s) => s.theme);
  const isDark = theme === "dark";

  const [activeCategory, setActiveCategory] = useState<ReportCategory>("energy");
  const [selectedFactory, setSelectedFactory] = useState("f1");
  const [selectedTag, setSelectedTag] = useState("f1-mdp-3");
  const [selectedMachine, setSelectedMachine] = useState("all");
  const [selectedGranularity, setSelectedGranularity] = useState("hour");
  const today = getLocalTodayString();
  const [dateStart, setDateStart] = useState(today);
  const [dateEnd, setDateEnd] = useState(today);

  // Filter tags by factory
  const filteredTags = useMemo(() => {
    if (selectedFactory === "all") return TAGS;
    return TAGS.filter(t => t.factory === selectedFactory);
  }, [selectedFactory]);

  // Ensure selected tag is valid for selected factory
  const effectiveTag = useMemo(() => {
    const found = filteredTags.find(t => t.id === selectedTag);
    return found ?? filteredTags[0];
  }, [filteredTags, selectedTag]);

  // Dynamically filter machine options based on selected tag
  const machineOptions = useMemo(() => {
    if (!effectiveTag) return [];
    const list = COVERED_MACHINES[effectiveTag.id] || [];
    return [{ id: "all", label: "Semua Mesin" }, ...list.map(name => ({ id: name, label: name }))];
  }, [effectiveTag]);

  // Reset selected machine to "all" when tag changes
  useEffect(() => {
    setSelectedMachine("all");
  }, [effectiveTag]);

  // Live backend data
  const [data, setData] = useState<Record<string, any>[]>([]);
  const [hasFiltered, setHasFiltered] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const handleFilter = useCallback(async () => {
    if (!effectiveTag) return;
    setIsLoading(true);
    try {
      const q = new URLSearchParams({
        category: activeCategory,
        factory: selectedFactory,
        tag: effectiveTag.id,
        machine: selectedMachine,
        granularity: selectedGranularity,
        startDate: dateStart,
        endDate: dateEnd,
      }).toString();
      const res = await getJson<{ data: Record<string, any>[] }>(`/analytics/electricity/report?${q}`);
      if (res && Array.isArray(res.data)) {
        setData(res.data);
      } else {
        setData([]);
      }
    } catch (err) {
      console.warn("Failed to fetch real electricity report:", err);
      setData([]);
    } finally {
      setIsLoading(false);
      setHasFiltered(true);
    }
  }, [activeCategory, selectedFactory, effectiveTag, selectedMachine, selectedGranularity, dateStart, dateEnd]);

  const columns = COLUMNS[activeCategory];

  const handleExport = useCallback(() => {
    const fn = `report_${activeCategory}_${effectiveTag?.label?.replace(/\s+/g, "_") ?? "data"}_${selectedMachine !== "all" ? `_${selectedMachine.replace(/\s+/g, "_")}` : ""}_${dateStart}_${dateEnd}.xlsx`;
    exportToExcel(data, columns, fn);
  }, [data, columns, activeCategory, effectiveTag, selectedMachine, dateStart, dateEnd]);

  // Styling helpers
  const sidebarItemClass = (active: boolean) =>
    `flex items-center gap-2.5 px-4 py-2.5 rounded-xl text-sm font-bold cursor-pointer transition-all duration-200 ${
      active
        ? "bg-sky-500/10 text-sky-500 dark:text-sky-400 border border-sky-500/20"
        : "text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800/60 hover:text-slate-700 dark:hover:text-slate-200 border border-transparent"
    }`;

  return (
    <div className="space-y-5">
      {/* Page Header */}
      <PageHeader
        title="Laporan Kelistrikan"
        description="Report data historis parameter kelistrikan per transformator"
      />

      {/* Main Content: Sidebar + Table */}
      <div className="flex gap-5" style={{ minHeight: 600 }}>

        {/* ── Left Sidebar ── */}
        <div
          className="flex-shrink-0 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm overflow-hidden"
          style={{ width: 200 }}
        >
          {/* Sidebar Header */}
          <div className="px-4 py-3 border-b border-slate-100 dark:border-slate-800/80 bg-slate-50/50 dark:bg-slate-800/20 flex items-center gap-2">
            <svg style={{ width: 16, height: 16 }} className="text-sky-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <span className="text-xs font-extrabold text-slate-700 dark:text-slate-200 uppercase tracking-wider">Reports</span>
          </div>

          {/* Category List */}
          <div className="p-3 space-y-1.5">
            {REPORT_TABS.map((tab) => (
              <div
                key={tab.key}
                className={sidebarItemClass(activeCategory === tab.key)}
                onClick={() => {
                  setActiveCategory(tab.key);
                  setHasFiltered(false);
                  setData([]);
                }}
              >
                <span style={{ fontSize: 14 }}>{tab.icon}</span>
                <span>{tab.label}</span>
              </div>
            ))}
          </div>
        </div>

        {/* ── Right Content Area ── */}
        <div className="flex-1 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm overflow-hidden flex flex-col">

          {/* Filter Bar */}
          <div
            className="px-5 py-3.5 border-b border-slate-100 dark:border-slate-800/80 bg-slate-50/30 dark:bg-slate-800/10 flex items-center gap-3 flex-wrap"
          >
            {/* Category Title */}
            <h3 className="text-sm font-extrabold text-slate-800 dark:text-white mr-2 flex-shrink-0">
              {REPORT_TABS.find(t => t.key === activeCategory)?.label ?? "Report"}
            </h3>

            {/* Factory Select */}
            <select
              value={selectedFactory}
              onChange={(e) => { setSelectedFactory(e.target.value); setHasFiltered(false); }}
              className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-bold text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-sky-500/30"
            >
              {FACTORIES.map(f => (
                <option key={f.id} value={f.id}>{f.label}</option>
              ))}
            </select>

            {/* Tag Select */}
            <select
              value={effectiveTag?.id ?? ""}
              onChange={(e) => { setSelectedTag(e.target.value); setHasFiltered(false); }}
              className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-bold text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-sky-500/30"
            >
              {filteredTags.map(t => (
                <option key={t.id} value={t.id}>{t.label}</option>
              ))}
            </select>

            {/* Machine Select */}
            {selectedFactory !== "all" && (
              <select
                value={selectedMachine}
                onChange={(e) => { setSelectedMachine(e.target.value); setHasFiltered(false); }}
                className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-bold text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-sky-500/30 cursor-pointer"
              >
                {machineOptions.map(m => (
                  <option key={m.id} value={m.id}>{m.label}</option>
                ))}
              </select>
            )}

            {/* Granularity Select */}
            <select
              value={selectedGranularity}
              onChange={(e) => { setSelectedGranularity(e.target.value); setHasFiltered(false); }}
              className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-bold text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-sky-500/30"
            >
              {GRANULARITY.map(g => (
                <option key={g.id} value={g.id}>{g.label}</option>
              ))}
            </select>

            {/* Date Range */}
            <input
              type="date"
              value={dateStart}
              onChange={(e) => { setDateStart(e.target.value); setHasFiltered(false); }}
              className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-bold text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-sky-500/30"
            />
            <input
              type="date"
              value={dateEnd}
              onChange={(e) => { setDateEnd(e.target.value); setHasFiltered(false); }}
              className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-bold text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-sky-500/30"
            />

            {/* Filter Button */}
            <button
              onClick={handleFilter}
              disabled={isLoading}
              className="px-4 py-1.5 rounded-lg bg-sky-500 hover:bg-sky-600 disabled:opacity-50 text-white text-xs font-extrabold uppercase tracking-wider transition-colors shadow-sm shadow-sky-500/20 flex items-center gap-1.5"
            >
              {isLoading && (
                <svg className="animate-spin h-3.5 w-3.5 text-white" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"></path>
                </svg>
              )}
              {isLoading ? "Memuat..." : "Filter"}
            </button>

            {/* Export Button */}
            <button
              onClick={handleExport}
              disabled={data.length === 0 || isLoading}
              className="px-4 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-600 disabled:opacity-40 disabled:cursor-not-allowed text-white text-xs font-extrabold uppercase tracking-wider transition-colors shadow-sm shadow-emerald-500/20"
            >
              Export to Excel
            </button>
          </div>

          {/* Table Area */}
          <div className="flex-1 overflow-auto">
            {isLoading ? (
              <div className="flex flex-col items-center justify-center h-full py-20 text-center">
                <svg className="animate-spin h-8 w-8 text-sky-500 mb-3" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"></path>
                </svg>
                <p className="text-sm font-bold text-slate-500 dark:text-slate-400">Mengambil data real dari database...</p>
              </div>
            ) : !hasFiltered ? (
              /* Empty State */
              <div className="flex flex-col items-center justify-center h-full py-20 text-center">
                <svg style={{ width: 48, height: 48 }} className="text-slate-300 dark:text-slate-700 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3.375 19.5h17.25m-17.25 0a1.125 1.125 0 01-1.125-1.125M3.375 19.5h7.5c.621 0 1.125-.504 1.125-1.125m-9.75 0V5.625m0 12.75v-1.5c0-.621.504-1.125 1.125-1.125m18.375 2.625V5.625m0 12.75c0 .621-.504 1.125-1.125 1.125m1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125m0 3.75h-7.5A1.125 1.125 0 0112 18.375m9.75-12.75c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125m19.5 0v1.5c0 .621-.504 1.125-1.125 1.125M2.25 5.625v1.5c0 .621.504 1.125 1.125 1.125m0 0h17.25m-17.25 0h7.5c.621 0 1.125.504 1.125 1.125M3.375 8.25c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125m17.25-3.75h-7.5c-.621 0-1.125.504-1.125 1.125m8.625-1.125c.621 0 1.125.504 1.125 1.125v1.5c0 .621-.504 1.125-1.125 1.125m-17.25 0h7.5m-7.5 0c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125M12 10.875v-1.5m0 1.5c0 .621-.504 1.125-1.125 1.125M12 10.875c0 .621.504 1.125 1.125 1.125m-2.25 0c.621 0 1.125.504 1.125 1.125M13.125 12h7.5m-7.5 0c-.621 0-1.125.504-1.125 1.125M20.625 12c.621 0 1.125.504 1.125 1.125v1.5c0 .621-.504 1.125-1.125 1.125m-17.25 0h7.5M12 14.625v-1.5m0 1.5c0 .621-.504 1.125-1.125 1.125M12 14.625c0 .621.504 1.125 1.125 1.125m-2.25 0c.621 0 1.125.504 1.125 1.125m0 0v.75" />
                </svg>
                <p className="text-sm font-bold text-slate-400 dark:text-slate-500">
                  Pilih parameter dan klik <span className="text-sky-500">Filter</span> untuk menampilkan data
                </p>
                <p className="text-xs text-slate-300 dark:text-slate-600 mt-1">
                  Data akan ditarik langsung dari database historis telemetri
                </p>
              </div>
            ) : data.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full py-20 text-center">
                <p className="text-sm font-bold text-slate-400">Tidak ada data untuk filter yang dipilih di database</p>
              </div>
            ) : (
              /* Data Table */
              <table className="w-full text-left" style={{ borderCollapse: "separate", borderSpacing: 0 }}>
                <thead>
                  <tr>
                    {columns.map((col) => (
                      <th
                        key={col.key}
                        className="sticky top-0 z-10 bg-slate-100 dark:bg-slate-950 text-slate-700 dark:text-slate-300"
                        style={{
                          padding: "12px 16px",
                          fontSize: 10,
                          fontWeight: 800,
                          textTransform: "uppercase",
                          letterSpacing: "0.08em",
                          whiteSpace: "nowrap",
                          borderBottom: "2px solid rgba(56,189,248,0.25)",
                        }}
                      >
                        {col.label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {data.map((row, idx) => (
                    <tr
                      key={idx}
                      className={`transition-colors ${
                        idx % 2 === 0
                          ? "bg-white dark:bg-slate-900/80"
                          : "bg-slate-50 dark:bg-slate-800/40"
                      } hover:bg-sky-50 dark:hover:bg-sky-500/5`}
                      style={{ borderBottom: "1px solid rgba(148,163,184,0.06)" }}
                    >
                      {columns.map((col) => (
                        <td
                          key={col.key}
                          style={{
                            padding: "10px 16px",
                            fontSize: 12,
                            fontWeight: col.key === "date" || col.key === "tag" ? 600 : 500,
                            fontFamily: col.key !== "date" && col.key !== "tag" ? "'IBM Plex Mono', monospace" : "inherit",
                            whiteSpace: "nowrap",
                          }}
                          className={
                            col.key === "date"
                              ? "text-slate-700 dark:text-slate-300"
                              : col.key === "tag"
                              ? "text-slate-500 dark:text-slate-400"
                              : "text-slate-800 dark:text-slate-200"
                          }
                        >
                          {col.key === "date" || col.key === "tag" ? row[col.key] : fmtNum(row[col.key])}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          {/* Table Footer / Summary */}
          {hasFiltered && data.length > 0 && (
            <div className="px-5 py-2.5 border-t border-slate-100 dark:border-slate-800/80 bg-slate-50/30 dark:bg-slate-800/10 flex items-center justify-between">
              <span className="text-[10px] font-bold text-slate-400">
                Menampilkan <span className="text-slate-600 dark:text-slate-300">{data.length}</span> record
                {" • "}
                {effectiveTag?.label} {" • "}
                {GRANULARITY.find(g => g.id === selectedGranularity)?.label}
                {" • "}
                {dateStart} s/d {dateEnd}
              </span>
              <span className="text-[10px] font-bold text-slate-400">
                Kategori: <span className="text-sky-500 font-extrabold uppercase">{activeCategory}</span>
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
