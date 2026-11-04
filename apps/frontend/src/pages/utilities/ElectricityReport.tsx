import { useState, useMemo, useCallback } from "react";
import { PageHeader } from "../../components/ui/PageHeader";
import { useSystemStore } from "../../store/system.store";
import { getJson } from "../../services/api.client";

/* ═══════════ TYPES ═══════════ */
type ReportCategory = "energy" | "tegangan_380" | "tegangan_230" | "tegangan" | "ampere" | "thd" | "daya";

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
  // ─── Factory 1 (WF1 - ew21) ───
  { id: "f1-mdp-1.1", label: "F1 MDP-1.1 (PM139)", factory: "f1" },
  { id: "f1-mdp-1.2", label: "F1 MDP-1.2 (PM136)", factory: "f1" },
  { id: "f1-mdp-2", label: "F1 MDP-2 (PM135)", factory: "f1" },
  { id: "f1-mdp-3", label: "F1 MDP3 (PM133)", factory: "f1" },
  { id: "pm132", label: "F1 MAIN SUPPLY QC OFFICE & LAB (PM132)", factory: "f1" },
  { id: "pm134", label: "F1 WH 4 PENERANGAN (PM134)", factory: "f1" },
  { id: "pm138", label: "F1 FULL COOLING WF1-U3 (PM138)", factory: "f1" },
  { id: "pm140", label: "F1 COMPRESSED AIR ZT-55 (PM140)", factory: "f1" },
  { id: "pm151", label: "F1 HVAC OFFICE ATAS (PM151)", factory: "f1" },
  { id: "pm152", label: "F1 COOLING TOWER PUMP WF1-U3 (PM152)", factory: "f1" },
  { id: "pm153", label: "F1 HVAC-QC (PM153)", factory: "f1" },
  { id: "pm154", label: "F1 LIGHTING WH 1 (PM154)", factory: "f1" },
  { id: "pm175", label: "F1 ST3 (PM175)", factory: "f1" },
  { id: "pm176", label: "F1 QC LAB (PM176)", factory: "f1" },
  { id: "pm177", label: "F1 CHILLER PREP DAIKIN BARAT (PM177)", factory: "f1" },
  { id: "pm178", label: "F1 CHILLER PREP DAIKIN TIMUR (PM178)", factory: "f1" },
  { id: "pm179", label: "F1 HVAC WH-3 (PM179)", factory: "f1" },
  { id: "pm180", label: "F1 CHILLER BP WF1-U3 (PM180)", factory: "f1" },
  { id: "pm181", label: "F1 COOLING TOWER FAN WF1-U3 (PM181)", factory: "f1" },
  { id: "pm182", label: "F1 COMPRESSED AIR ZT-30.1&2 (PM182)", factory: "f1" },
  { id: "pm183", label: "F1 COMPRESSED AIR ALE-30 (PM183)", factory: "f1" },
  { id: "pm184", label: "F1 BOILER 4 (PM184)", factory: "f1" },
  { id: "pm185", label: "F1 HVAC WF1U3 (PM185)", factory: "f1" },

  // ─── Factory 2 (WF2 - ew22 & ew23) ───
  { id: "f2-putr-1", label: "F2 PUTR-1 (PM201)", factory: "f2" },
  { id: "f2-putr-2", label: "F2 PUTR-2 (PM202)", factory: "f2" },
  { id: "f2-putr-new", label: "F2 PUTR-NEW (PM327)", factory: "f2" },
  { id: "pm210", label: "F2 MAIN CRITICAL PANEL (PM210)", factory: "f2" },
  { id: "pm203", label: "F2 HEATER WF2U2 (PM203)", factory: "f2" },
  { id: "pm205", label: "F2 AHU WF2UI (PM205)", factory: "f2" },
  { id: "pm206", label: "F2 COOLING FASE-1 (PM206)", factory: "f2" },
  { id: "pm207", label: "F2 WH 6 (PM207)", factory: "f2" },
  { id: "pm208", label: "F2 WH 5 (PM208)", factory: "f2" },
  { id: "pm209", label: "F2 CHILLER - WF2U2 (PM209)", factory: "f2" },
  { id: "pm211", label: "F2 PANEL OTOKLAF WF2U1 (PM211)", factory: "f2" },
  { id: "pm212", label: "F2 PANEL OTOKLAF WF2U2 (PM212)", factory: "f2" },
  { id: "pm213", label: "F2 BOILER-5 (PM213)", factory: "f2" },
  { id: "pm214", label: "F2 COMPRESSED AIR ATLAS (PM214)", factory: "f2" },
  { id: "pm215", label: "F2 COOLING CRITICAL (PM215)", factory: "f2" },
  { id: "pm226", label: "F2 WH-7 (PM226)", factory: "f2" },
  { id: "pm229", label: "F2 KOBELCO ALE-250 (PM229)", factory: "f2" },
  { id: "pm271", label: "F2 CHILLER RTAC 250 (RO&HVAC) (PM271)", factory: "f2" },
  { id: "pm272", label: "F2 CHILLER RTAC 170 (RO) (PM272)", factory: "f2" },
  { id: "pm273", label: "RETURN SAMPLE QC (PM273)", factory: "f2" },
  { id: "pm274", label: "F2 CHILLER RTAC 100 (BP) (PM274)", factory: "f2" },
  { id: "pm288", label: "F2 Penerangan PD (PM288)", factory: "f2" },
  { id: "pm291", label: "F2 WH-4 (PM291)", factory: "f2" },
  { id: "pm292", label: "F2 CHILLER RTAC 185 (PM292)", factory: "f2" },
  { id: "pm318", label: "F2 COOLING FASE-2 (PM318)", factory: "f2" },
  { id: "pm319", label: "F2 CHILLER RTAC-27S (PREP) (PM319)", factory: "f2" },
  { id: "pm320", label: "F2 WT-DU-PSG (PM320)", factory: "f2" },
  { id: "pm321", label: "F2 AHU-1 - WF2U2 (PM321)", factory: "f2" },
  { id: "pm322", label: "F2 AHU-2 - WF2U2 (PM322)", factory: "f2" },
  { id: "pm323", label: "F2 PW GENERATION - RO (PM323)", factory: "f2" },
  { id: "pm324", label: "F2 COOLING TOWER CT-PUMP (PM324)", factory: "f2" },
  { id: "pm325", label: "F2 COOLING TOWER CT-FAN (PM325)", factory: "f2" },
  { id: "pm337", label: "F2 MCC BP 7 (PM337)", factory: "f2" },

  // ─── Incoming Cubicles ───
  { id: "pm411", label: "incoming cubicle pln (PM411)", factory: "all" },
  { id: "pm412", label: "incoming cubicle WF1 (PM412)", factory: "f1" },
  { id: "pm410", label: "incoming cubicle WF2 (PM410)", factory: "f2" },
];

const GRANULARITY: GranularityOption[] = [
  { id: "hour", label: "Hour" },
  { id: "day", label: "Day" },
  { id: "month", label: "Month" },
];

const REPORT_TABS: { key: ReportCategory; label: string; icon: string }[] = [
  { key: "energy", label: "Energy", icon: "⚡" },
  { key: "tegangan_380", label: "Tegangan 380V (R-S-T)", icon: "🔌" },
  { key: "tegangan_230", label: "Tegangan 230V (L-N)", icon: "🔌" },
  { key: "ampere", label: "Ampere", icon: "🔋" },
  { key: "thd", label: "THD", icon: "📊" },
  { key: "daya", label: "Daya", icon: "💡" },
];

const COLUMNS: Record<ReportCategory, { key: string; label: string; unit?: string }[]> = {
  energy: [
    { key: "date", label: "DATE" },
    { key: "tag", label: "TAG DESCRIPTION" },
    { key: "kwh", label: "KWH", unit: "kWh" },
    { key: "kvar", label: "KVAR", unit: "kVAR" },
  ],
  tegangan_380: [
    { key: "date", label: "DATE" },
    { key: "tag", label: "TAG DESCRIPTION" },
    { key: "vrs", label: "V R (380V)", unit: "V" },
    { key: "vst", label: "V S (380V)", unit: "V" },
    { key: "vtr", label: "V T (380V)", unit: "V" },
    { key: "vll_avg", label: "V L-L AVG (380V)", unit: "V" },
  ],
  tegangan_230: [
    { key: "date", label: "DATE" },
    { key: "tag", label: "TAG DESCRIPTION" },
    { key: "vr", label: "V R-N (230V)", unit: "V" },
    { key: "vs", label: "V S-N (230V)", unit: "V" },
    { key: "vt", label: "V T-N (230V)", unit: "V" },
    { key: "vln_avg", label: "V L-N AVG (230V)", unit: "V" },
  ],
  tegangan: [
    { key: "date", label: "DATE" },
    { key: "tag", label: "TAG DESCRIPTION" },
    { key: "vrs", label: "V R (380V)", unit: "V" },
    { key: "vst", label: "V S (380V)", unit: "V" },
    { key: "vtr", label: "V T (380V)", unit: "V" },
    { key: "vr", label: "V R-N (230V)", unit: "V" },
    { key: "vs", label: "V S-N (230V)", unit: "V" },
    { key: "vt", label: "V T-N (230V)", unit: "V" },
    { key: "vln_avg", label: "V L-N (230V)", unit: "V" },
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

/* ═══════════ HELPERS ═══════════ */
const getLocalTodayString = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

const normalizeDateIso = (val: string): string => {
  const trimmed = (val || "").trim();
  const dmy = trimmed.match(/^(\d{2})[\/\-](\d{2})[\/\-](\d{4})$/);
  if (dmy) {
    return `${dmy[3]}-${dmy[2]}-${dmy[1]}`;
  }
  return trimmed || getLocalTodayString();
};

/* ═══════════ EXPORT TO EXCEL HELPER ═══════════ */
async function exportToExcel(data: Record<string, any>[], columns: { key: string; label: string; unit?: string }[], filename: string) {
  try {
    const { utils, writeFile } = await import("xlsx");
    const headerRow = columns.map(c => c.unit ? `${c.label} (${c.unit})` : c.label);
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
  void isDark;

  const [activeCategory, setActiveCategory] = useState<ReportCategory>("energy");
  const [selectedFactory, setSelectedFactory] = useState("f1");
  const [selectedTag, setSelectedTag] = useState("f1-mdp-3");
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

  // Live backend data
  const [data, setData] = useState<Record<string, any>[]>([]);
  const [hasFiltered, setHasFiltered] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const handleFilter = useCallback(async () => {
    if (!effectiveTag) return;
    setIsLoading(true);
    try {
      const normalizedStart = normalizeDateIso(dateStart);
      const normalizedEnd = normalizeDateIso(dateEnd);
      const q = new URLSearchParams({
        category: activeCategory.startsWith("tegangan") ? "tegangan" : activeCategory,
        factory: selectedFactory,
        tag: effectiveTag.id,
        granularity: selectedGranularity,
        startDate: normalizedStart,
        endDate: normalizedEnd,
      }).toString();
      const res = await getJson<{ data: Record<string, any>[] }>(`/analytics/electricity/report?${q}`);
      if (res && Array.isArray(res.data)) {
        const mapped = res.data.map((row) => {
          const vll = (row.vrs !== null && row.vst !== null && row.vtr !== null)
            ? +((Number(row.vrs) + Number(row.vst) + Number(row.vtr)) / 3).toFixed(1)
            : (row.vrs !== null ? +Number(row.vrs).toFixed(1) : null);
          const vln = (row.vr !== null && row.vs !== null && row.vt !== null)
            ? +((Number(row.vr) + Number(row.vs) + Number(row.vt)) / 3).toFixed(1)
            : (row.vr !== null ? +Number(row.vr).toFixed(1) : null);
          return {
            ...row,
            kvar: row.kvar ?? row.kvarh ?? null,
            vll_avg: row.vll_avg ?? vll,
            vln_avg: row.vln_avg ?? vln,
          };
        });
        setData(mapped);
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
  }, [activeCategory, selectedFactory, effectiveTag, selectedGranularity, dateStart, dateEnd]);

  const columns = COLUMNS[activeCategory];

  const handleExport = useCallback(() => {
    const fn = `report_${activeCategory}_${effectiveTag?.label?.replace(/\s+/g, "_") ?? "data"}_${normalizeDateIso(dateStart)}_${normalizeDateIso(dateEnd)}.xlsx`;
    exportToExcel(data, columns, fn);
  }, [data, columns, activeCategory, effectiveTag, dateStart, dateEnd]);

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
          style={{ width: 220 }}
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
                  const wasTegangan = activeCategory.startsWith("tegangan");
                  const isNowTegangan = tab.key.startsWith("tegangan");
                  setActiveCategory(tab.key);
                  if (!(wasTegangan && isNowTegangan && data.length > 0)) {
                    setHasFiltered(false);
                    setData([]);
                  }
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
              <span>{REPORT_TABS.find(t => t.key === activeCategory)?.label ?? "Report"}</span>
            </h3>

            {/* Quick Toggle for Voltage 380V vs 230V */}
            {activeCategory.startsWith("tegangan") && (
              <div className="flex items-center gap-1 bg-slate-200/60 dark:bg-slate-800 p-0.5 rounded-lg border border-slate-200 dark:border-slate-700 mr-2 flex-shrink-0">
                <button
                  type="button"
                  onClick={() => setActiveCategory("tegangan_380")}
                  className={`px-2.5 py-1 text-xs font-bold rounded-md transition-all ${
                    activeCategory === "tegangan_380"
                      ? "bg-sky-500 text-white shadow-sm"
                      : "text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white"
                  }`}
                >
                  <span>⚡ 380V (R-S-T)</span>
                </button>
                <button
                  type="button"
                  onClick={() => setActiveCategory("tegangan_230")}
                  className={`px-2.5 py-1 text-xs font-bold rounded-md transition-all ${
                    activeCategory === "tegangan_230"
                      ? "bg-sky-500 text-white shadow-sm"
                      : "text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white"
                  }`}
                >
                  <span>🔌 230V (L-N)</span>
                </button>
                <button
                  type="button"
                  onClick={() => setActiveCategory("tegangan")}
                  className={`px-2.5 py-1 text-xs font-bold rounded-md transition-all ${
                    activeCategory === "tegangan"
                      ? "bg-sky-500 text-white shadow-sm"
                      : "text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white"
                  }`}
                >
                  <span>📊 Semua</span>
                </button>
              </div>
            )}

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

            {/* Power Meter / Tag Select */}
            <select
              translate="no"
              value={effectiveTag?.id ?? ""}
              onChange={(e) => { setSelectedTag(e.target.value); setHasFiltered(false); }}
              className="notranslate px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-bold text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-sky-500/30"
            >
              {filteredTags.map(t => (
                <option key={t.id} value={t.id}>{t.label}</option>
              ))}
            </select>

            {/* Granularity / Timeframe Select */}
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
              {isLoading ? (
                <span key="btn-loading" className="inline-flex items-center gap-1.5">
                  <svg className="animate-spin h-3.5 w-3.5 text-white" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"></path>
                  </svg>
                  <span>Memuat...</span>
                </span>
              ) : (
                <span key="btn-idle">Filter</span>
              )}
            </button>

            {/* Export Button */}
            <button
              onClick={handleExport}
              disabled={data.length === 0 || isLoading}
              className="px-4 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-600 disabled:opacity-40 disabled:cursor-not-allowed text-white text-xs font-extrabold uppercase tracking-wider transition-colors shadow-sm shadow-emerald-500/20"
            >
              <span>Export to Excel</span>
            </button>
          </div>

          {/* Table Area */}
          <div className="flex-1 overflow-auto">
            {isLoading ? (
              <div key="state-loading" className="flex flex-col items-center justify-center h-full py-20 text-center">
                <svg className="animate-spin h-8 w-8 text-sky-500 mb-3" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"></path>
                </svg>
                <p className="text-sm font-bold text-slate-500 dark:text-slate-400">
                  <span>Mengambil data real dari database...</span>
                </p>
              </div>
            ) : !hasFiltered ? (
              /* Empty State */
              <div key="state-unfiltered" className="flex flex-col items-center justify-center h-full py-20 text-center">
                <svg style={{ width: 48, height: 48 }} className="text-slate-300 dark:text-slate-700 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3.375 19.5h17.25m-17.25 0a1.125 1.125 0 01-1.125-1.125M3.375 19.5h7.5c.621 0 1.125-.504 1.125-1.125m-9.75 0V5.625m0 12.75v-1.5c0-.621.504-1.125 1.125-1.125m18.375 2.625V5.625m0 12.75c0 .621-.504 1.125-1.125 1.125m1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125m0 3.75h-7.5A1.125 1.125 0 0112 18.375m9.75-12.75c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125m19.5 0v1.5c0 .621-.504 1.125-1.125 1.125M2.25 5.625v1.5c0 .621.504 1.125 1.125 1.125m0 0h17.25m-17.25 0h7.5c.621 0 1.125.504 1.125 1.125M3.375 8.25c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125m17.25-3.75h-7.5c-.621 0-1.125.504-1.125 1.125m8.625-1.125c.621 0 1.125.504 1.125 1.125v1.5c0 .621-.504 1.125-1.125 1.125m-17.25 0h7.5m-7.5 0c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125M12 10.875v-1.5m0 1.5c0 .621-.504 1.125-1.125 1.125M12 10.875c0 .621.504 1.125 1.125 1.125m-2.25 0c.621 0 1.125.504 1.125 1.125M13.125 12h7.5m-7.5 0c-.621 0-1.125.504-1.125 1.125M20.625 12c.621 0 1.125.504 1.125 1.125v1.5c0 .621-.504 1.125-1.125 1.125m-17.25 0h7.5M12 14.625v-1.5m0 1.5c0 .621-.504 1.125-1.125 1.125M12 14.625c0 .621.504 1.125 1.125 1.125m-2.25 0c.621 0 1.125.504 1.125 1.125m0 0v.75" />
                </svg>
                <p className="text-sm font-bold text-slate-400 dark:text-slate-500">
                  <span>Pilih parameter dan klik </span>
                  <span className="text-sky-500">Filter</span>
                  <span> untuk menampilkan data</span>
                </p>
                <p className="text-xs text-slate-300 dark:text-slate-600 mt-1">
                  <span>Data akan ditarik langsung dari database historis telemetri</span>
                </p>
              </div>
            ) : data.length === 0 ? (
              <div key="state-empty" className="flex flex-col items-center justify-center h-full py-20 text-center">
                <p className="text-sm font-bold text-slate-400">
                  <span>Tidak ada data untuk filter yang dipilih di database</span>
                </p>
              </div>
            ) : (
              /* Data Table */
              <table key="state-table" className="w-full text-left" style={{ borderCollapse: "separate", borderSpacing: 0 }}>
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
                        <span>{col.unit ? `${col.label} (${col.unit})` : col.label}</span>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody translate="no" className="notranslate">
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
                          <span>{col.key === "date" || col.key === "tag" ? row[col.key] : fmtNum(row[col.key])}</span>
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
                <span>Menampilkan </span>
                <span className="text-slate-600 dark:text-slate-300">{data.length}</span>
                <span>{` record • ${effectiveTag?.label ?? ""} • ${GRANULARITY.find(g => g.id === selectedGranularity)?.label ?? ""} • ${dateStart} s/d ${dateEnd}`}</span>
              </span>
              <span className="text-[10px] font-bold text-slate-400">
                <span>Kategori: </span>
                <span className="text-sky-500 font-extrabold uppercase">{activeCategory}</span>
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
