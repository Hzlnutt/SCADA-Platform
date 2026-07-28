import { useState, useMemo, useCallback } from "react";
import { PageHeader } from "../../components/ui/PageHeader";
import { useSystemStore } from "../../store/system.store";

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

function generateMockData(
  category: ReportCategory,
  tag: TagOption,
  granularity: string,
  startDate: string,
  endDate: string
): Record<string, any>[] {
  const rows: Record<string, any>[] = [];
  const start = new Date(startDate + "T00:00:00");
  const end = new Date(endDate + "T23:59:59");

  if (granularity === "hour") {
    // Generate hourly rows for the date range (newest first)
    const dates: Date[] = [];
    const cur = new Date(end);
    while (cur >= start) {
      dates.push(new Date(cur));
      cur.setHours(cur.getHours() - 1);
    }
    for (const dt of dates) {
      rows.push(generateRow(category, tag, dt));
    }
  } else if (granularity === "day") {
    const cur = new Date(end);
    while (cur >= start) {
      rows.push(generateRow(category, tag, cur));
      cur.setDate(cur.getDate() - 1);
    }
  } else {
    // month
    const cur = new Date(end.getFullYear(), end.getMonth(), 1);
    const startMonth = new Date(start.getFullYear(), start.getMonth(), 1);
    while (cur >= startMonth) {
      rows.push(generateRow(category, tag, cur));
      cur.setMonth(cur.getMonth() - 1);
    }
  }

  return rows;
}

function generateRow(category: ReportCategory, tag: TagOption, dt: Date): Record<string, any> {
  const dateStr = `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}-${String(dt.getDate()).padStart(2, "0")} ${String(dt.getHours()).padStart(2, "0")}:00:00`;
  const base: Record<string, any> = { date: dateStr, tag: tag.label };
  const rnd = (min: number, max: number, dec = 2) => +(min + Math.random() * (max - min)).toFixed(dec);

  switch (category) {
    case "energy":
      base.kwh = rnd(300, 500, 2);
      base.kvarh = rnd(0, 30, 2);
      base.kvah = +(base.kwh + rnd(3, 10, 2)).toFixed(2);
      break;
    case "tegangan":
      base.vr = rnd(225, 235, 1);
      base.vs = rnd(225, 235, 1);
      base.vt = rnd(225, 235, 1);
      base.vrs = rnd(390, 410, 1);
      base.vst = rnd(390, 410, 1);
      base.vtr = rnd(390, 410, 1);
      break;
    case "ampere":
      base.ir = rnd(600, 900, 1);
      base.is = rnd(600, 900, 1);
      base.it = rnd(600, 900, 1);
      base.in = rnd(0, 15, 1);
      break;
    case "thd":
      base.thdv_r = rnd(1, 4, 2);
      base.thdv_s = rnd(1, 4, 2);
      base.thdv_t = rnd(1, 4, 2);
      base.thdi_r = rnd(3, 8, 2);
      base.thdi_s = rnd(3, 8, 2);
      base.thdi_t = rnd(3, 8, 2);
      break;
    case "daya":
      base.kw = rnd(350, 550, 1);
      base.kvar = rnd(80, 200, 1);
      base.kva = rnd(400, 600, 1);
      base.pf = rnd(0.88, 0.98, 3);
      base.freq = rnd(49.95, 50.05, 2);
      break;
  }
  return base;
}

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

  // Generate data
  const [data, setData] = useState<Record<string, any>[]>([]);
  const [hasFiltered, setHasFiltered] = useState(false);

  const handleFilter = useCallback(() => {
    if (!effectiveTag) return;
    const rows = generateMockData(activeCategory, effectiveTag, selectedGranularity, dateStart, dateEnd);
    setData(rows);
    setHasFiltered(true);
  }, [activeCategory, effectiveTag, selectedGranularity, dateStart, dateEnd]);

  const columns = COLUMNS[activeCategory];

  const handleExport = useCallback(() => {
    const fn = `report_${activeCategory}_${effectiveTag?.label?.replace(/\s+/g, "_") ?? "data"}_${dateStart}_${dateEnd}.xlsx`;
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
              className="px-4 py-1.5 rounded-lg bg-sky-500 hover:bg-sky-600 text-white text-xs font-extrabold uppercase tracking-wider transition-colors shadow-sm shadow-sky-500/20"
            >
              Filter
            </button>

            {/* Export Button */}
            <button
              onClick={handleExport}
              disabled={data.length === 0}
              className="px-4 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-600 disabled:opacity-40 disabled:cursor-not-allowed text-white text-xs font-extrabold uppercase tracking-wider transition-colors shadow-sm shadow-emerald-500/20"
            >
              Export to Excel
            </button>
          </div>

          {/* Table Area */}
          <div className="flex-1 overflow-auto">
            {!hasFiltered ? (
              /* Empty State */
              <div className="flex flex-col items-center justify-center h-full py-20 text-center">
                <svg style={{ width: 48, height: 48 }} className="text-slate-300 dark:text-slate-700 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3.375 19.5h17.25m-17.25 0a1.125 1.125 0 01-1.125-1.125M3.375 19.5h7.5c.621 0 1.125-.504 1.125-1.125m-9.75 0V5.625m0 12.75v-1.5c0-.621.504-1.125 1.125-1.125m18.375 2.625V5.625m0 12.75c0 .621-.504 1.125-1.125 1.125m1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125m0 3.75h-7.5A1.125 1.125 0 0112 18.375m9.75-12.75c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125m19.5 0v1.5c0 .621-.504 1.125-1.125 1.125M2.25 5.625v1.5c0 .621.504 1.125 1.125 1.125m0 0h17.25m-17.25 0h7.5c.621 0 1.125.504 1.125 1.125M3.375 8.25c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125m17.25-3.75h-7.5c-.621 0-1.125.504-1.125 1.125m8.625-1.125c.621 0 1.125.504 1.125 1.125v1.5c0 .621-.504 1.125-1.125 1.125m-17.25 0h7.5m-7.5 0c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125M12 10.875v-1.5m0 1.5c0 .621-.504 1.125-1.125 1.125M12 10.875c0 .621.504 1.125 1.125 1.125m-2.25 0c.621 0 1.125.504 1.125 1.125M13.125 12h7.5m-7.5 0c-.621 0-1.125.504-1.125 1.125M20.625 12c.621 0 1.125.504 1.125 1.125v1.5c0 .621-.504 1.125-1.125 1.125m-17.25 0h7.5M12 14.625v-1.5m0 1.5c0 .621-.504 1.125-1.125 1.125M12 14.625c0 .621.504 1.125 1.125 1.125m-2.25 0c.621 0 1.125.504 1.125 1.125m0 0v.75" />
                </svg>
                <p className="text-sm font-bold text-slate-400 dark:text-slate-500">
                  Pilih parameter dan klik <span className="text-sky-500">Filter</span> untuk menampilkan data
                </p>
                <p className="text-xs text-slate-300 dark:text-slate-600 mt-1">
                  Data akan ditampilkan dalam format tabel berdasarkan filter yang dipilih
                </p>
              </div>
            ) : data.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full py-20 text-center">
                <p className="text-sm font-bold text-slate-400">Tidak ada data untuk filter yang dipilih</p>
              </div>
            ) : (
              /* Data Table */
              <table className="w-full text-left" style={{ borderCollapse: "separate", borderSpacing: 0 }}>
                <thead>
                  <tr>
                    {columns.map((col) => (
                      <th
                        key={col.key}
                        className="sticky top-0 z-10 bg-slate-800 dark:bg-slate-950 text-slate-200 dark:text-slate-300"
                        style={{
                          padding: "12px 16px",
                          fontSize: 10,
                          fontWeight: 800,
                          textTransform: "uppercase",
                          letterSpacing: "0.08em",
                          whiteSpace: "nowrap",
                          borderBottom: "2px solid rgba(56,189,248,0.2)",
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
                          ? "bg-slate-900/80 dark:bg-slate-900/80"
                          : "bg-slate-800/40 dark:bg-slate-800/40"
                      } hover:bg-sky-500/5`}
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
                              ? "text-slate-300 dark:text-slate-300"
                              : col.key === "tag"
                              ? "text-slate-400 dark:text-slate-400"
                              : "text-slate-200 dark:text-slate-200"
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
