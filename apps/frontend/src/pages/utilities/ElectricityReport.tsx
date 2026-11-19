import { useState, useMemo, useCallback, useRef, useEffect } from "react";
import { PageHeader } from "../../components/ui/PageHeader";
import { useSystemStore } from "../../store/system.store";
import { getJson } from "../../services/api.client";
import { useTranslation } from "../../i18n/useTranslation";

/* ═══════════ TYPES ═══════════ */
type ReportCategory = "energy" | "tegangan_380" | "tegangan_230" | "tegangan" | "ampere" | "thd" | "daya";

type FactoryId = "all" | "f1" | "f2";
type FactoryOption = { id: FactoryId; label: string };
type TagOption = {
  id: string;
  pmCode: string;
  name: string;
  label: string;
  factory: FactoryId;
  area: string;
};
type GranularityOption = { id: string; label: string };

/* ═══════════ CONSTANTS ═══════════ */
const TAGS: TagOption[] = [
  // ─── Factory 1 (WF1 - ew21) ───
  { id: "f1-mdp-1.1", pmCode: "PM139", name: "F1 MDP-1.1", label: "F1 MDP-1.1 (PM139)", factory: "f1", area: "Panel Distribusi & Water Treatment" },
  { id: "f1-mdp-1.2", pmCode: "PM136", name: "F1 MDP-1.2", label: "F1 MDP-1.2 (PM136)", factory: "f1", area: "Panel Distribusi & Water Treatment" },
  { id: "f1-mdp-2", pmCode: "PM135", name: "F1 MDP-2", label: "F1 MDP-2 (PM135)", factory: "f1", area: "Panel Distribusi & Water Treatment" },
  { id: "f1-mdp-3", pmCode: "PM133", name: "F1 MDP3", label: "F1 MDP3 (PM133)", factory: "f1", area: "Panel Distribusi & Water Treatment" },
  { id: "pm132", pmCode: "PM132", name: "F1 MAIN SUPPLY QC OFFICE & LAB", label: "F1 MAIN SUPPLY QC OFFICE & LAB (PM132)", factory: "f1", area: "HVAC QC & Produksi" },
  { id: "pm134", pmCode: "PM134", name: "F1 WH 4 PENERANGAN", label: "F1 WH 4 PENERANGAN (PM134)", factory: "f1", area: "HVAC Warehouse & Penerangan" },
  { id: "pm138", pmCode: "PM138", name: "F1 FULL COOLING WF1-U3", label: "F1 FULL COOLING WF1-U3 (PM138)", factory: "f1", area: "HVAC QC & Produksi" },
  { id: "pm140", pmCode: "PM140", name: "F1 COMPRESSED AIR ZT-55", label: "F1 COMPRESSED AIR ZT-55 (PM140)", factory: "f1", area: "Compressed Air" },
  { id: "pm151", pmCode: "PM151", name: "F1 HVAC OFFICE ATAS", label: "F1 HVAC OFFICE ATAS (PM151)", factory: "f1", area: "HVAC Warehouse & Penerangan" },
  { id: "pm152", pmCode: "PM152", name: "F1 COOLING TOWER PUMP WF1-U3", label: "F1 COOLING TOWER PUMP WF1-U3 (PM152)", factory: "f1", area: "Cooling Tower" },
  { id: "pm153", pmCode: "PM153", name: "F1 HVAC-QC", label: "F1 HVAC-QC (PM153)", factory: "f1", area: "HVAC QC & Produksi" },
  { id: "pm154", pmCode: "PM154", name: "F1 LIGHTING WH 1", label: "F1 LIGHTING WH 1 (PM154)", factory: "f1", area: "HVAC Warehouse & Penerangan" },
  { id: "pm175", pmCode: "PM175", name: "F1 ST3", label: "F1 ST3 (PM175)", factory: "f1", area: "Panel Distribusi & Water Treatment" },
  { id: "pm176", pmCode: "PM176", name: "F1 QC LAB", label: "F1 QC LAB (PM176)", factory: "f1", area: "Panel Distribusi & Water Treatment" },
  { id: "pm177", pmCode: "PM177", name: "F1 CHILLER PREP DAIKIN BARAT", label: "F1 CHILLER PREP DAIKIN BARAT (PM177)", factory: "f1", area: "Chiller" },
  { id: "pm178", pmCode: "PM178", name: "F1 CHILLER PREP DAIKIN TIMUR", label: "F1 CHILLER PREP DAIKIN TIMUR (PM178)", factory: "f1", area: "Chiller" },
  { id: "pm179", pmCode: "PM179", name: "F1 HVAC WH-3", label: "F1 HVAC WH-3 (PM179)", factory: "f1", area: "HVAC Warehouse & Penerangan" },
  { id: "pm180", pmCode: "PM180", name: "F1 CHILLER BP WF1-U3", label: "F1 CHILLER BP WF1-U3 (PM180)", factory: "f1", area: "Chiller" },
  { id: "pm181", pmCode: "PM181", name: "F1 COOLING TOWER FAN WF1-U3", label: "F1 COOLING TOWER FAN WF1-U3 (PM181)", factory: "f1", area: "Cooling Tower" },
  { id: "pm182", pmCode: "PM182", name: "F1 COMPRESSED AIR ZT-30.1&2", label: "F1 COMPRESSED AIR ZT-30.1&2 (PM182)", factory: "f1", area: "Compressed Air" },
  { id: "pm183", pmCode: "PM183", name: "F1 COMPRESSED AIR ALE-30", label: "F1 COMPRESSED AIR ALE-30 (PM183)", factory: "f1", area: "Compressed Air" },
  { id: "pm184", pmCode: "PM184", name: "F1 BOILER 4", label: "F1 BOILER 4 (PM184)", factory: "f1", area: "Boiler" },
  { id: "pm185", pmCode: "PM185", name: "F1 HVAC WF1U3", label: "F1 HVAC WF1U3 (PM185)", factory: "f1", area: "HVAC QC & Produksi" },

  // ─── Factory 2 (WF2 - ew22 & ew23) ───
  { id: "f2-putr-1", pmCode: "PM201", name: "F2 PUTR-1", label: "F2 PUTR-1 (PM201)", factory: "f2", area: "Panel Distribusi & Water Treatment" },
  { id: "f2-putr-2", pmCode: "PM202", name: "F2 PUTR-2", label: "F2 PUTR-2 (PM202)", factory: "f2", area: "Panel Distribusi & Water Treatment" },
  { id: "f2-putr-new", pmCode: "PM327", name: "F2 PUTR-NEW", label: "F2 PUTR-NEW (PM327)", factory: "f2", area: "Panel Distribusi & Water Treatment" },
  { id: "pm210", pmCode: "PM210", name: "F2 MAIN CRITICAL PANEL", label: "F2 MAIN CRITICAL PANEL (PM210)", factory: "f2", area: "Panel Distribusi & Water Treatment" },
  { id: "pm203", pmCode: "PM203", name: "F2 HEATER WF2U2", label: "F2 HEATER WF2U2 (PM203)", factory: "f2", area: "HVAC QC & Produksi" },
  { id: "pm205", pmCode: "PM205", name: "F2 AHU WF2UI", label: "F2 AHU WF2UI (PM205)", factory: "f2", area: "HVAC QC & Produksi" },
  { id: "pm206", pmCode: "PM206", name: "F2 COOLING FASE-1", label: "F2 COOLING FASE-1 (PM206)", factory: "f2", area: "Cooling Tower" },
  { id: "pm207", pmCode: "PM207", name: "F2 WH 6", label: "F2 WH 6 (PM207)", factory: "f2", area: "HVAC Warehouse & Penerangan" },
  { id: "pm208", pmCode: "PM208", name: "F2 WH 5", label: "F2 WH 5 (PM208)", factory: "f2", area: "HVAC Warehouse & Penerangan" },
  { id: "pm209", pmCode: "PM209", name: "F2 CHILLER - WF2U2", label: "F2 CHILLER - WF2U2 (PM209)", factory: "f2", area: "Chiller" },
  { id: "pm211", pmCode: "PM211", name: "F2 PANEL OTOKLAF WF2U1", label: "F2 PANEL OTOKLAF WF2U1 (PM211)", factory: "f2", area: "Panel Distribusi & Water Treatment" },
  { id: "pm212", pmCode: "PM212", name: "F2 PANEL OTOKLAF WF2U2", label: "F2 PANEL OTOKLAF WF2U2 (PM212)", factory: "f2", area: "Panel Distribusi & Water Treatment" },
  { id: "pm213", pmCode: "PM213", name: "F2 BOILER-5", label: "F2 BOILER-5 (PM213)", factory: "f2", area: "Boiler" },
  { id: "pm214", pmCode: "PM214", name: "F2 COMPRESSED AIR ATLAS", label: "F2 COMPRESSED AIR ATLAS (PM214)", factory: "f2", area: "Compressed Air" },
  { id: "pm215", pmCode: "PM215", name: "F2 COOLING CRITICAL", label: "F2 COOLING CRITICAL (PM215)", factory: "f2", area: "Cooling Tower" },
  { id: "pm226", pmCode: "PM226", name: "F2 WH-7", label: "F2 WH-7 (PM226)", factory: "f2", area: "HVAC Warehouse & Penerangan" },
  { id: "pm229", pmCode: "PM229", name: "F2 KOBELCO ALE-250", label: "F2 KOBELCO ALE-250 (PM229)", factory: "f2", area: "Compressed Air" },
  { id: "pm271", pmCode: "PM271", name: "F2 CHILLER RTAC 250 (RO&HVAC)", label: "F2 CHILLER RTAC 250 (RO&HVAC) (PM271)", factory: "f2", area: "Chiller" },
  { id: "pm272", pmCode: "PM272", name: "F2 CHILLER RTAC 170 (RO)", label: "F2 CHILLER RTAC 170 (RO) (PM272)", factory: "f2", area: "Chiller" },
  { id: "pm273", pmCode: "PM273", name: "RETURN SAMPLE QC", label: "RETURN SAMPLE QC (PM273)", factory: "f2", area: "HVAC QC & Produksi" },
  { id: "pm274", pmCode: "PM274", name: "F2 CHILLER RTAC 100 (BP)", label: "F2 CHILLER RTAC 100 (BP) (PM274)", factory: "f2", area: "Chiller" },
  { id: "pm288", pmCode: "PM288", name: "F2 Penerangan PD", label: "F2 Penerangan PD (PM288)", factory: "f2", area: "HVAC Warehouse & Penerangan" },
  { id: "pm291", pmCode: "PM291", name: "F2 WH-4", label: "F2 WH-4 (PM291)", factory: "f2", area: "HVAC Warehouse & Penerangan" },
  { id: "pm292", pmCode: "PM292", name: "F2 CHILLER RTAC 185", label: "F2 CHILLER RTAC 185 (PM292)", factory: "f2", area: "Chiller" },
  { id: "pm318", pmCode: "PM318", name: "F2 COOLING FASE-2", label: "F2 COOLING FASE-2 (PM318)", factory: "f2", area: "Cooling Tower" },
  { id: "pm319", pmCode: "PM319", name: "F2 CHILLER RTAC-27S (PREP)", label: "F2 CHILLER RTAC-27S (PREP) (PM319)", factory: "f2", area: "Chiller" },
  { id: "pm320", pmCode: "PM320", name: "F2 WT-DU-PSG", label: "F2 WT-DU-PSG (PM320)", factory: "f2", area: "Panel Distribusi & Water Treatment" },
  { id: "pm321", pmCode: "PM321", name: "F2 AHU-1 - WF2U2", label: "F2 AHU-1 - WF2U2 (PM321)", factory: "f2", area: "HVAC QC & Produksi" },
  { id: "pm322", pmCode: "PM322", name: "F2 AHU-2 - WF2U2", label: "F2 AHU-2 - WF2U2 (PM322)", factory: "f2", area: "HVAC QC & Produksi" },
  { id: "pm323", pmCode: "PM323", name: "F2 PW GENERATION - RO", label: "F2 PW GENERATION - RO (PM323)", factory: "f2", area: "Panel Distribusi & Water Treatment" },
  { id: "pm324", pmCode: "PM324", name: "F2 COOLING TOWER CT-PUMP", label: "F2 COOLING TOWER CT-PUMP (PM324)", factory: "f2", area: "Cooling Tower" },
  { id: "pm325", pmCode: "PM325", name: "F2 COOLING TOWER CT-FAN", label: "F2 COOLING TOWER CT-FAN (PM325)", factory: "f2", area: "Cooling Tower" },
  { id: "pm337", pmCode: "PM337", name: "F2 MCC BP 7", label: "F2 MCC BP 7 (PM337)", factory: "f2", area: "Panel Distribusi & Water Treatment" },

  // ─── Incoming Cubicles ───
  { id: "pm410", pmCode: "PM410", name: "incoming cubicle pln", label: "incoming cubicle pln (PM410)", factory: "all", area: "Incoming Cubicles" },
  { id: "pm411", pmCode: "PM411", name: "incoming cubicle WF1", label: "incoming cubicle WF1 (PM411)", factory: "f1", area: "Incoming Cubicles" },
  { id: "pm412", pmCode: "PM412", name: "incoming cubicle WF2", label: "incoming cubicle WF2 (PM412)", factory: "f2", area: "Incoming Cubicles" },
];

const COLUMNS: Record<ReportCategory, { key: string; label: string; unit?: string }[]> = {
  energy: [
    { key: "date", label: "DATE" },
    { key: "timestamp", label: "TIMESTAMP" },
    { key: "tag", label: "TAG DESCRIPTION" },
    { key: "kwh", label: "KWH" },
    { key: "kvarh", label: "KVARH" },
    { key: "kvah", label: "KVAH" },
  ],
  tegangan_380: [
    { key: "date", label: "DATE" },
    { key: "timestamp", label: "TIMESTAMP" },
    { key: "tag", label: "TAG DESCRIPTION" },
    { key: "vrs", label: "V R (380V)", unit: "V" },
    { key: "vst", label: "V S (380V)", unit: "V" },
    { key: "vtr", label: "V T (380V)", unit: "V" },
    { key: "vll_avg", label: "V L-L AVG (380V)", unit: "V" },
  ],
  tegangan_230: [
    { key: "date", label: "DATE" },
    { key: "timestamp", label: "TIMESTAMP" },
    { key: "tag", label: "TAG DESCRIPTION" },
    { key: "vr", label: "V R-N (230V)", unit: "V" },
    { key: "vs", label: "V S-N (230V)", unit: "V" },
    { key: "vt", label: "V T-N (230V)", unit: "V" },
    { key: "vln_avg", label: "V L-N AVG (230V)", unit: "V" },
  ],
  tegangan: [
    { key: "date", label: "DATE" },
    { key: "timestamp", label: "TIMESTAMP" },
    { key: "tag", label: "TAG DESCRIPTION" },
    { key: "vrs", label: "V R (380V)", unit: "V" },
    { key: "vst", label: "V S (380V)", unit: "V" },
    { key: "vtr", label: "V T (380V)", unit: "V" },
    { key: "vll_avg", label: "V L-L AVG (380V)", unit: "V" },
    { key: "vr", label: "V R-N (230V)", unit: "V" },
    { key: "vs", label: "V S-N (230V)", unit: "V" },
    { key: "vt", label: "V T-N (230V)", unit: "V" },
    { key: "vln_avg", label: "V L-N AVG (230V)", unit: "V" },
  ],
  ampere: [
    { key: "date", label: "DATE" },
    { key: "timestamp", label: "TIMESTAMP" },
    { key: "tag", label: "TAG DESCRIPTION" },
    { key: "ir", label: "AR" },
    { key: "is", label: "AS" },
    { key: "it", label: "AT" },
  ],
  thd: [
    { key: "date", label: "DATE" },
    { key: "timestamp", label: "TIMESTAMP" },
    { key: "tag", label: "TAG DESCRIPTION" },
    { key: "thdv_r", label: "VAN" },
    { key: "thdv_s", label: "VBN" },
    { key: "thdv_t", label: "VCN" },
    { key: "thdi_r", label: "AR" },
    { key: "thdi_s", label: "AS" },
    { key: "thdi_t", label: "AT" },
  ],
  daya: [
    { key: "date", label: "DATE" },
    { key: "timestamp", label: "TIMESTAMP" },
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

const getFactoryBadgeMeta = (factory: FactoryId) => {
  if (factory === "f1") {
    return {
      label: "Factory 1",
      cls: "bg-sky-500/10 text-sky-600 dark:text-sky-400 border-sky-500/20",
    };
  }
  if (factory === "f2") {
    return {
      label: "Factory 2",
      cls: "bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border-indigo-500/20",
    };
  }
  return {
    label: "Incoming PLN",
    cls: "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20",
  };
};

/**
 * Splits raw backend `date` string into explicit `date` and consumption interval `timestamp`
 * (e.g. "2026-11-16 07:00:00" -> date: "2026-11-16", timestamp: "07:00 - 07:59").
 */
const formatReportDateAndTimestamp = (
  rawDate: unknown,
  granularity: string,
  backendTimestamp?: unknown
): { date: string; timestamp: string } => {
  const trimmed = String(rawDate ?? "").trim();
  const existingTs = typeof backendTimestamp === "string" && backendTimestamp.trim() && backendTimestamp.trim() !== "-"
    ? backendTimestamp.trim()
    : null;

  if (!trimmed) {
    return { date: "-", timestamp: existingTs ?? "-" };
  }

  // Hourly bucket: "YYYY-MM-DD HH:mm:ss" or "YYYY-MM-DD HH:mm"
  const hourlyMatch = trimmed.match(/^(\d{4}-\d{2}-\d{2})\s+(\d{2}):(\d{2})(?::\d{2})?$/);
  if (hourlyMatch) {
    const [, datePart, hh] = hourlyMatch;
    return {
      date: datePart,
      timestamp: existingTs ?? `${hh}:00 - ${hh}:59`,
    };
  }

  // Daily bucket: "YYYY-MM-DD"
  const dailyMatch = trimmed.match(/^(\d{4}-\d{2}-\d{2})$/);
  if (dailyMatch) {
    return {
      date: dailyMatch[1],
      timestamp: existingTs ?? "00:00 - 23:59",
    };
  }

  // Monthly bucket: "YYYY-MM"
  const monthlyMatch = trimmed.match(/^(\d{4})-(\d{2})$/);
  if (monthlyMatch) {
    const year = Number(monthlyMatch[1]);
    const month = Number(monthlyMatch[2]);
    const lastDay = new Date(year, month, 0).getDate();
    return {
      date: trimmed,
      timestamp: existingTs ?? `01-${String(lastDay).padStart(2, "0")} (00:00 - 23:59)`,
    };
  }

  return {
    date: trimmed,
    timestamp: existingTs ?? (granularity === "day" ? "00:00 - 23:59" : "-"),
  };
};

/* ═══════════ EXPORT TO EXCEL HELPER ═══════════ */
async function exportToExcel(data: Record<string, any>[], columns: { key: string; label: string; unit?: string }[], filename: string) {
  try {
    const { utils, writeFile } = await import("xlsx");
    const headerRow = columns.map((c) => (c.unit ? `${c.label} (${c.unit})` : c.label));
    const dataRows = data.map((row) => columns.map((c) => row[c.key] ?? ""));
    const ws = utils.aoa_to_sheet([headerRow, ...dataRows]);

    // Auto column widths tailored for DATE, TIMESTAMP, TAG DESCRIPTION, and values
    ws["!cols"] = columns.map((c) => ({
      wch:
        c.key === "tag"
          ? 38
          : c.key === "timestamp"
          ? 24
          : c.key === "date"
          ? 14
          : Math.max(c.label.length + 4, 16),
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
  const { t } = useTranslation();
  const theme = useSystemStore((s) => s.theme);
  const isDark = theme === "dark";
  void isDark;

  const factories: FactoryOption[] = useMemo(() => [
    { id: "all", label: t("electricity.allFactories") },
    { id: "f1", label: "Factory 1" },
    { id: "f2", label: "Factory 2" },
  ], [t]);

  const granularity: GranularityOption[] = useMemo(() => [
    { id: "hour", label: t("electricity.granularity.hour") },
    { id: "day", label: t("electricity.granularity.day") },
    { id: "month", label: t("electricity.granularity.month") },
  ], [t]);

  const reportTabs = useMemo(() => [
    { key: "energy" as ReportCategory, label: t("electricity.tabs.energy"), icon: "⚡" },
    { key: "tegangan_380" as ReportCategory, label: t("electricity.tabs.tegangan_380"), icon: "🔌" },
    { key: "tegangan_230" as ReportCategory, label: t("electricity.tabs.tegangan_230"), icon: "🔌" },
    { key: "ampere" as ReportCategory, label: t("electricity.tabs.ampere"), icon: "🔋" },
    { key: "thd" as ReportCategory, label: t("electricity.tabs.thd"), icon: "📊" },
    { key: "daya" as ReportCategory, label: t("electricity.tabs.daya"), icon: "💡" },
  ], [t]);

  const [activeCategory, setActiveCategory] = useState<ReportCategory>("energy");
  const [selectedFactory, setSelectedFactory] = useState<FactoryId>("f1");
  const [selectedTag, setSelectedTag] = useState("f1-mdp-3");
  const [selectedGranularity, setSelectedGranularity] = useState("hour");
  const today = getLocalTodayString();
  const [dateStart, setDateStart] = useState(today);
  const [dateEnd, setDateEnd] = useState(today);

  // Searchable PM & Area combobox state
  const [isPmDropdownOpen, setIsPmDropdownOpen] = useState(false);
  const [pmSearchQuery, setPmSearchQuery] = useState("");
  const [highlightedIdx, setHighlightedIdx] = useState(0);
  const pmDropdownRef = useRef<HTMLDivElement | null>(null);
  const pmInputRef = useRef<HTMLInputElement | null>(null);

  // Filter tags by factory
  const filteredTags = useMemo(() => {
    if (selectedFactory === "all") return TAGS;
    return TAGS.filter((tag) => tag.factory === selectedFactory);
  }, [selectedFactory]);

  // Ensure selected tag is valid for selected factory
  const effectiveTag = useMemo(() => {
    const found = filteredTags.find((tag) => tag.id === selectedTag);
    return found ?? filteredTags[0];
  }, [filteredTags, selectedTag]);

  // Search across ALL PMs (code, equipment name, area, factory) whenever query is entered
  const pmDropdownItems = useMemo(() => {
    const q = pmSearchQuery.trim().toLowerCase();
    if (!q) return filteredTags;
    const normalizedTokens = q
      .replace(/[-_/]+/g, " ")
      .split(/\s+/)
      .filter(Boolean);

    const matches = TAGS.filter((tag) => {
      const factoryKeywords =
        tag.factory === "f1"
          ? "factory 1 wf1 f1"
          : tag.factory === "f2"
          ? "factory 2 wf2 f2"
          : "incoming pln all semua factory";
      const rawHaystack = `${tag.pmCode} ${tag.pmCode.replace("PM", "PM ")} ${tag.id} ${tag.name} ${tag.label} ${tag.area} ${factoryKeywords}`.toLowerCase();
      const cleanHaystack = rawHaystack.replace(/[-_/]+/g, " ");
      return normalizedTokens.every((tok) => rawHaystack.includes(tok) || cleanHaystack.includes(tok));
    });

    if (selectedFactory !== "all") {
      matches.sort((a, b) => {
        const aInFactory = a.factory === selectedFactory ? 0 : 1;
        const bInFactory = b.factory === selectedFactory ? 0 : 1;
        return aInFactory - bInFactory;
      });
    }
    return matches;
  }, [pmSearchQuery, filteredTags, selectedFactory]);

  // Keep highlight index in bounds when results change
  useEffect(() => {
    setHighlightedIdx(0);
  }, [pmSearchQuery, selectedFactory, isPmDropdownOpen]);

  // Close PM search popover on outside click
  useEffect(() => {
    if (!isPmDropdownOpen) return;
    const handleClickOutside = (event: MouseEvent) => {
      if (pmDropdownRef.current && !pmDropdownRef.current.contains(event.target as Node)) {
        setIsPmDropdownOpen(false);
        setPmSearchQuery("");
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isPmDropdownOpen]);

  const handleSelectPm = useCallback((item: TagOption) => {
    if (selectedFactory !== "all" && item.factory !== selectedFactory) {
      setSelectedFactory(item.factory);
    }
    setSelectedTag(item.id);
    setIsPmDropdownOpen(false);
    setPmSearchQuery("");
    setHasFiltered(false);
  }, [selectedFactory]);

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
          const kvarh =
            row.kvarh !== null && row.kvarh !== undefined
              ? row.kvarh
              : row.kvar !== null && row.kvar !== undefined
              ? Math.abs(row.kvar)
              : null;
          const kvah = row.kvah !== null && row.kvah !== undefined ? row.kvah : null;
          const { date: formattedDate, timestamp: formattedTimestamp } = formatReportDateAndTimestamp(
            row.date,
            selectedGranularity,
            row.timestamp
          );

          return {
            ...row,
            date: formattedDate,
            timestamp: formattedTimestamp,
            kvar: kvarh,
            kvarh: kvarh,
            kvah: kvah,
            vr: row.vr ?? null,
            vs: row.vs ?? null,
            vt: row.vt ?? null,
            vrs: row.vrs ?? null,
            vst: row.vst ?? null,
            vtr: row.vtr ?? null,
            vll_avg: row.vll_avg ?? null,
            vln_avg: row.vln_avg ?? null,
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

  const activeFactoryBadge = effectiveTag ? getFactoryBadgeMeta(effectiveTag.factory) : null;
  const intervalHintText =
    selectedGranularity === "hour"
      ? t("electricity.consumptionIntervalHour", "Interval per jam (cth. 07:00 - 07:59 WIB)")
      : selectedGranularity === "day"
      ? t("electricity.consumptionIntervalDay", "Interval harian (00:00 - 23:59 WIB)")
      : t("electricity.consumptionIntervalMonth", "Interval bulanan (tgl 01 - akhir bulan)");

  // Styling helpers
  const sidebarItemClass = (active: boolean) =>
    `flex items-center gap-2.5 px-4 py-2.5 rounded-xl text-sm font-bold cursor-pointer transition-all duration-200 whitespace-nowrap ${
      active
        ? "bg-sky-500/10 text-sky-500 dark:text-sky-400 border border-sky-500/20"
        : "text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800/60 hover:text-slate-700 dark:hover:text-slate-200 border border-transparent"
    }`;

  return (
    <div className="space-y-5">
      {/* Page Header */}
      <PageHeader
        title={t("electricity.reportTitle")}
        description={t("electricity.reportDesc")}
      />

      {/* Main Content: Sidebar + Table */}
      <div className="flex flex-col lg:flex-row gap-5" style={{ minHeight: 600 }}>

        {/* ── Left Sidebar (Stacks horizontally on mobile/tablet) ── */}
        <div
          className="flex-shrink-0 w-full lg:w-[220px] rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm overflow-hidden"
        >
          {/* Sidebar Header */}
          <div className="px-4 py-3 border-b border-slate-100 dark:border-slate-800/80 bg-slate-50/50 dark:bg-slate-800/20 flex items-center gap-2">
            <svg style={{ width: 16, height: 16 }} className="text-sky-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <span className="text-xs font-extrabold text-slate-700 dark:text-slate-200 uppercase tracking-wider">
              {t("electricity.reportsSidebarTitle")}
            </span>
          </div>

          {/* Category List */}
          <div className="p-3 flex flex-row lg:flex-col gap-1.5 overflow-x-auto scrollbar-thin">
            {reportTabs.map((tab) => (
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
        <div className="flex-1 min-w-0 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm overflow-visible flex flex-col">

          {/* Filter Bar */}
          <div
            className="px-4 sm:px-5 py-3.5 rounded-t-2xl border-b border-slate-100 dark:border-slate-800/80 bg-slate-50/30 dark:bg-slate-800/10 flex items-center gap-2.5 flex-wrap"
          >
            {/* Category Title */}
            <h3 className="text-sm font-extrabold text-slate-800 dark:text-white mr-1 flex-shrink-0">
              <span>{reportTabs.find((tab) => tab.key === activeCategory)?.label ?? t("common.report")}</span>
            </h3>

            {/* Quick Toggle for Voltage 380V vs 230V */}
            {activeCategory.startsWith("tegangan") && (
              <div className="flex items-center gap-1 bg-slate-200/60 dark:bg-slate-800 p-0.5 rounded-lg border border-slate-200 dark:border-slate-700 mr-1 flex-shrink-0">
                <button
                  type="button"
                  onClick={() => setActiveCategory("tegangan_380")}
                  className={`px-2.5 py-1 text-xs font-bold rounded-md transition-all cursor-pointer ${
                    activeCategory === "tegangan_380"
                      ? "bg-sky-500 text-white shadow-sm"
                      : "text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white"
                  }`}
                >
                  <span>⚡ 380V</span>
                </button>
                <button
                  type="button"
                  onClick={() => setActiveCategory("tegangan_230")}
                  className={`px-2.5 py-1 text-xs font-bold rounded-md transition-all cursor-pointer ${
                    activeCategory === "tegangan_230"
                      ? "bg-sky-500 text-white shadow-sm"
                      : "text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white"
                  }`}
                >
                  <span>🔌 230V</span>
                </button>
                <button
                  type="button"
                  onClick={() => setActiveCategory("tegangan")}
                  className={`px-2.5 py-1 text-xs font-bold rounded-md transition-all cursor-pointer ${
                    activeCategory === "tegangan"
                      ? "bg-sky-500 text-white shadow-sm"
                      : "text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white"
                  }`}
                >
                  <span>📊 {t("common.all")}</span>
                </button>
              </div>
            )}

            {/* Factory Select */}
            <select
              value={selectedFactory}
              onChange={(e) => {
                setSelectedFactory(e.target.value as FactoryId);
                setPmSearchQuery("");
                setHasFiltered(false);
              }}
              className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-bold text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-sky-500/30"
            >
              {factories.map((f) => (
                <option key={f.id} value={f.id}>{f.label}</option>
              ))}
            </select>

            {/* Searchable Power Meter & Area Combobox */}
            <div ref={pmDropdownRef} translate="no" className="notranslate relative w-full sm:w-[320px] md:w-[350px] max-w-full">
              <div className="relative flex items-center">
                <svg
                  className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 pointer-events-none"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth="2.2"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35M17 11a6 6 0 11-12 0 6 6 0 0112 0z" />
                </svg>

                <input
                  ref={pmInputRef}
                  type="text"
                  value={isPmDropdownOpen ? pmSearchQuery : effectiveTag?.label ?? ""}
                  placeholder={t("electricity.searchPmPlaceholder", "Cari PM / Area (cth: PM271, Chiller, WH-7)...")}
                  onFocus={() => {
                    setIsPmDropdownOpen(true);
                  }}
                  onChange={(e) => {
                    setPmSearchQuery(e.target.value);
                    if (!isPmDropdownOpen) setIsPmDropdownOpen(true);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "ArrowDown") {
                      e.preventDefault();
                      if (!isPmDropdownOpen) {
                        setIsPmDropdownOpen(true);
                      } else if (pmDropdownItems.length > 0) {
                        setHighlightedIdx((prev) => (prev + 1) % pmDropdownItems.length);
                      }
                    } else if (e.key === "ArrowUp") {
                      e.preventDefault();
                      if (pmDropdownItems.length > 0) {
                        setHighlightedIdx((prev) => (prev - 1 + pmDropdownItems.length) % pmDropdownItems.length);
                      }
                    } else if (e.key === "Enter") {
                      if (isPmDropdownOpen && pmDropdownItems[highlightedIdx]) {
                        e.preventDefault();
                        handleSelectPm(pmDropdownItems[highlightedIdx]);
                        pmInputRef.current?.blur();
                      }
                    } else if (e.key === "Escape") {
                      setIsPmDropdownOpen(false);
                      setPmSearchQuery("");
                      pmInputRef.current?.blur();
                    }
                  }}
                  className="w-full pl-8 pr-14 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-bold text-slate-700 dark:text-slate-200 placeholder:text-slate-400 placeholder:font-medium focus:outline-none focus:ring-2 focus:ring-sky-500/30 focus:border-sky-400"
                />

                {isPmDropdownOpen && pmSearchQuery ? (
                  <button
                    type="button"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => {
                      setPmSearchQuery("");
                      pmInputRef.current?.focus();
                    }}
                    className="absolute right-7 p-0.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
                    aria-label="Clear PM search"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                ) : null}

                <button
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => {
                    if (isPmDropdownOpen) {
                      setIsPmDropdownOpen(false);
                      setPmSearchQuery("");
                      pmInputRef.current?.blur();
                    } else {
                      setIsPmDropdownOpen(true);
                      pmInputRef.current?.focus();
                    }
                  }}
                  className="absolute right-2 p-0.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
                  aria-label="Toggle PM list"
                >
                  <svg
                    className={`w-3.5 h-3.5 transition-transform duration-150 ${isPmDropdownOpen ? "rotate-180" : ""}`}
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth="2.5"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                  </svg>
                </button>
              </div>

              {/* Search Results Popover */}
              {isPmDropdownOpen && (
                <div className="absolute left-0 top-full mt-1.5 z-40 w-full sm:w-[440px] max-w-[calc(100vw-2rem)] rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-xl overflow-hidden">
                  {/* Popover Info Header */}
                  <div className="px-3 py-2 border-b border-slate-100 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-950/60 flex items-center justify-between gap-2 text-[10px] font-bold text-slate-500 dark:text-slate-400">
                    <span>
                      {t("electricity.showingRecords", "Menampilkan")} {pmDropdownItems.length} {t("electricity.pmSearchUnit", "PM")}
                    </span>
                    <span className="truncate text-slate-400 dark:text-slate-500">
                      {t("electricity.pmAllFactoriesHint", "Pencarian mencakup seluruh Factory 1, Factory 2 & Incoming")}
                    </span>
                  </div>

                  {/* PM Options List */}
                  <div className="max-h-72 overflow-y-auto scrollbar-thin divide-y divide-slate-100 dark:divide-slate-800/70">
                    {pmDropdownItems.length === 0 ? (
                      <div className="px-4 py-6 text-center text-xs font-semibold text-slate-400 dark:text-slate-500">
                        {t("electricity.pmNotFound", "PM atau area tidak ditemukan")}
                      </div>
                    ) : (
                      pmDropdownItems.map((item, idx) => {
                        const isSelected = effectiveTag?.id === item.id;
                        const isHighlighted = idx === highlightedIdx;
                        const fBadge = getFactoryBadgeMeta(item.factory);
                        return (
                          <button
                            key={item.id}
                            type="button"
                            onMouseEnter={() => setHighlightedIdx(idx)}
                            onMouseDown={(e) => {
                              e.preventDefault();
                              handleSelectPm(item);
                            }}
                            className={`w-full text-left px-3 py-2.5 flex flex-col gap-1 transition-colors cursor-pointer ${
                              isSelected
                                ? "bg-sky-500/10 dark:bg-sky-500/15"
                                : isHighlighted
                                ? "bg-slate-100/90 dark:bg-slate-800/70"
                                : "hover:bg-slate-50 dark:hover:bg-slate-800/40"
                            }`}
                          >
                            <div className="flex items-center justify-between gap-2">
                              <div className="flex items-center gap-2 min-w-0">
                                <span className="inline-flex items-center px-1.5 py-0.5 rounded bg-sky-500/15 text-sky-700 dark:text-sky-300 font-mono text-[10px] font-extrabold flex-shrink-0">
                                  {item.pmCode}
                                </span>
                                <span className="text-xs font-bold text-slate-800 dark:text-slate-100 truncate">
                                  {item.name}
                                </span>
                              </div>
                              {isSelected && (
                                <span className="text-sky-500 text-xs font-extrabold flex-shrink-0">✓</span>
                              )}
                            </div>

                            <div className="flex flex-wrap items-center gap-1.5 pl-0.5">
                              <span className={`inline-flex items-center px-1.5 py-0.5 rounded border text-[10px] font-bold ${fBadge.cls}`}>
                                {fBadge.label}
                              </span>
                              <span className="inline-flex items-center px-1.5 py-0.5 rounded border border-slate-200 dark:border-slate-700 bg-slate-100/80 dark:bg-slate-800 text-[10px] font-semibold text-slate-600 dark:text-slate-300">
                                {t("electricity.pmAreaLabel", "Area")}: {item.area}
                              </span>
                            </div>
                          </button>
                        );
                      })
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Granularity / Timeframe Select */}
            <select
              value={selectedGranularity}
              onChange={(e) => {
                setSelectedGranularity(e.target.value);
                setHasFiltered(false);
              }}
              className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-bold text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-sky-500/30"
            >
              {granularity.map((g) => (
                <option key={g.id} value={g.id}>{g.label}</option>
              ))}
            </select>

            {/* Date Range */}
            <input
              type="date"
              value={dateStart}
              onChange={(e) => {
                setDateStart(e.target.value);
                setHasFiltered(false);
              }}
              className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-bold text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-sky-500/30"
            />
            <input
              type="date"
              value={dateEnd}
              onChange={(e) => {
                setDateEnd(e.target.value);
                setHasFiltered(false);
              }}
              className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-bold text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-sky-500/30"
            />

            {/* Filter Button */}
            <button
              onClick={handleFilter}
              disabled={isLoading}
              className="px-4 py-1.5 rounded-lg bg-sky-500 hover:bg-sky-600 disabled:opacity-50 text-white text-xs font-extrabold uppercase tracking-wider transition-colors shadow-sm shadow-sky-500/20 flex items-center gap-1.5 cursor-pointer"
            >
              {isLoading ? (
                <span key="btn-loading" className="inline-flex items-center gap-1.5">
                  <svg className="animate-spin h-3.5 w-3.5 text-white" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"></path>
                  </svg>
                  <span>{t("common.loading")}</span>
                </span>
              ) : (
                <span key="btn-idle">{t("common.filter")}</span>
              )}
            </button>

            {/* Export Button */}
            <button
              onClick={handleExport}
              disabled={data.length === 0 || isLoading}
              className="px-4 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-600 disabled:opacity-40 disabled:cursor-not-allowed text-white text-xs font-extrabold uppercase tracking-wider transition-colors shadow-sm shadow-emerald-500/20 cursor-pointer"
            >
              <span>{t("common.exportExcel")}</span>
            </button>
          </div>

          {/* Active PM Area & Time Window Context Strip */}
          {effectiveTag && activeFactoryBadge && (
            <div className="px-4 sm:px-5 py-2 border-b border-slate-100 dark:border-slate-800/80 bg-slate-50/60 dark:bg-slate-950/30 flex flex-wrap items-center justify-between gap-2 text-[11px]">
              <div translate="no" className="notranslate flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center px-2 py-0.5 rounded bg-sky-500/15 text-sky-700 dark:text-sky-300 font-mono font-extrabold">
                  {effectiveTag.pmCode}
                </span>
                <span className="font-bold text-slate-700 dark:text-slate-200">
                  {effectiveTag.name}
                </span>
                <span className={`inline-flex items-center px-2 py-0.5 rounded border font-bold ${activeFactoryBadge.cls}`}>
                  {activeFactoryBadge.label}
                </span>
                <span className="inline-flex items-center px-2 py-0.5 rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-semibold">
                  {t("electricity.pmAreaLabel", "Area")}: {effectiveTag.area}
                </span>
              </div>

              <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                <svg className="w-3.5 h-3.5 text-sky-500 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6l4 2m6-2a10 10 0 11-20 0 10 10 0 0120 0z" />
                </svg>
                <span>{intervalHintText}</span>
              </span>
            </div>
          )}

          {/* Table Area */}
          <div className="flex-1 overflow-x-auto overflow-y-auto scrollbar-thin">
            {isLoading ? (
              <div key="state-loading" className="flex flex-col items-center justify-center h-full py-20 text-center">
                <svg className="animate-spin h-8 w-8 text-sky-500 mb-3" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"></path>
                </svg>
                <p className="text-sm font-bold text-slate-500 dark:text-slate-400">
                  <span>{t("electricity.loadingData")}</span>
                </p>
              </div>
            ) : !hasFiltered ? (
              /* Empty State */
              <div key="state-unfiltered" className="flex flex-col items-center justify-center h-full py-20 text-center px-4">
                <svg style={{ width: 48, height: 48 }} className="text-slate-300 dark:text-slate-700 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3.375 19.5h17.25m-17.25 0a1.125 1.125 0 01-1.125-1.125M3.375 19.5h7.5c.621 0 1.125-.504 1.125-1.125m-9.75 0V5.625m0 12.75v-1.5c0-.621.504-1.125 1.125-1.125m18.375 2.625V5.625m0 12.75c0 .621-.504 1.125-1.125 1.125m1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125m0 3.75h-7.5A1.125 1.125 0 0112 18.375m9.75-12.75c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125m19.5 0v1.5c0 .621-.504 1.125-1.125 1.125M2.25 5.625v1.5c0 .621.504 1.125 1.125 1.125m0 0h17.25m-17.25 0h7.5c.621 0 1.125.504 1.125 1.125M3.375 8.25c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125m17.25-3.75h-7.5c-.621 0-1.125.504-1.125 1.125m8.625-1.125c.621 0 1.125.504 1.125 1.125v1.5c0 .621-.504 1.125-1.125 1.125m-17.25 0h7.5m-7.5 0c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125M12 10.875v-1.5m0 1.5c0 .621-.504 1.125-1.125 1.125M12 10.875c0 .621.504 1.125 1.125 1.125m-2.25 0c.621 0 1.125.504 1.125 1.125M13.125 12h7.5m-7.5 0c-.621 0-1.125.504-1.125 1.125M20.625 12c.621 0 1.125.504 1.125 1.125v1.5c0 .621-.504 1.125-1.125 1.125m-17.25 0h7.5M12 14.625v-1.5m0 1.5c0 .621-.504 1.125-1.125 1.125M12 14.625c0 .621.504 1.125 1.125 1.125m-2.25 0c.621 0 1.125.504 1.125 1.125m0 0v.75" />
                </svg>
                <p className="text-sm font-bold text-slate-400 dark:text-slate-500">
                  <span>{t("electricity.filterPrompt")}</span>
                </p>
                <p className="text-xs text-slate-300 dark:text-slate-600 mt-1">
                  <span>{t("electricity.directDbNote")}</span>
                </p>
              </div>
            ) : data.length === 0 ? (
              <div key="state-empty" className="flex flex-col items-center justify-center h-full py-20 text-center px-4">
                <p className="text-sm font-bold text-slate-400">
                  <span>{t("electricity.noDataMatch")}</span>
                </p>
              </div>
            ) : (
              /* Data Table */
              <table key="state-table" className="w-full min-w-[680px] text-left" style={{ borderCollapse: "separate", borderSpacing: 0 }}>
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
                      {columns.map((col) => {
                        const isTextCol = col.key === "date" || col.key === "timestamp" || col.key === "tag";
                        return (
                          <td
                            key={col.key}
                            style={{
                              padding: "10px 16px",
                              fontSize: 12,
                              fontWeight: isTextCol ? 600 : 500,
                              fontFamily: col.key === "tag" ? "inherit" : "'IBM Plex Mono', monospace",
                              whiteSpace: "nowrap",
                            }}
                            className={
                              col.key === "date"
                                ? "text-slate-700 dark:text-slate-200"
                                : col.key === "timestamp"
                                ? "text-sky-700 dark:text-sky-300"
                                : col.key === "tag"
                                ? "text-slate-500 dark:text-slate-400"
                                : "text-slate-800 dark:text-slate-200"
                            }
                          >
                            {col.key === "timestamp" ? (
                              <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-sky-500/10 text-sky-700 dark:text-sky-300 border border-sky-500/20 text-[11px] font-bold">
                                {row[col.key] ?? "-"}
                              </span>
                            ) : (
                              <span>{isTextCol ? row[col.key] : fmtNum(row[col.key])}</span>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          {/* Table Footer / Summary */}
          {hasFiltered && data.length > 0 && (
            <div className="px-5 py-2.5 rounded-b-2xl border-t border-slate-100 dark:border-slate-800/80 bg-slate-50/30 dark:bg-slate-800/10 flex flex-wrap items-center justify-between gap-2">
              <span className="text-[10px] font-bold text-slate-400">
                <span>{t("electricity.showingRecords")} </span>
                <span className="text-slate-600 dark:text-slate-300">{data.length}</span>
                <span>{` ${t("electricity.recordUnit")} • ${effectiveTag?.label ?? ""} (${effectiveTag?.area ?? ""}) • ${granularity.find((g) => g.id === selectedGranularity)?.label ?? ""} • ${dateStart} s/d ${dateEnd}`}</span>
              </span>
              <span className="text-[10px] font-bold text-slate-400">
                <span>{t("electricity.categoryPrefix")} </span>
                <span className="text-sky-500 font-extrabold uppercase">{activeCategory}</span>
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
