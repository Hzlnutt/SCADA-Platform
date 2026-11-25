import { useMemo, useState } from "react";
import type {
  HealthStatus,
  PmCatalogMeta,
  PmChecklistItem,
  PmChecklistPatch,
  PmCrosscheckSummaryItem,
  PmHealthSummary
} from "./pmHealth.types";
import {
  fmtNumber,
  getChecklistProgress,
  getEmptyChecklistItem,
  getLocalTodayIso,
  healthStatusMeta
} from "./pmHealth.utils";

type ChecklistFilter =
  | "all"
  | "complete"
  | "partial"
  | "unchecked"
  | "missing_ewon"
  | "missing_endpoint"
  | "missing_lcd";

type ChecklistSort = "pm_id" | "incomplete_first" | "problem_first" | "recent_checked";

interface ChecklistRowData {
  pmId: string;
  pmName: string;
  factory: string;
  area: string;
  groupId: string;
  healthStatus: HealthStatus | null;
  latestEnergy: number | null;
  latestPowerKw: number | null;
  dropCount: number;
  checklist: PmChecklistItem;
}

interface PmChecklistPanelProps {
  pms: PmHealthSummary[];
  catalog: PmCatalogMeta[];
  checklistMap: Record<string, PmChecklistItem>;
  crosscheckSummaries?: Record<string, PmCrosscheckSummaryItem>;
  savingPmIds: Record<string, boolean>;
  loading: boolean;
  isUnlocked: boolean;
  remainingLabel: string | null;
  onRequestUnlock: () => void;
  onLock: () => void;
  onUpdateChecklist: (pmId: string, patch: PmChecklistPatch) => Promise<void>;
  onResetSingle: (pmId: string) => Promise<void>;
  onResetAll: () => Promise<void>;
  onInspectPm: (pmId: string) => void;
  onOpenCrosscheck?: (pmId: string) => void;
}

function CheckToggleButton({
  checked,
  label,
  checkedAt,
  disabled,
  locked,
  onToggle,
  onLockedClick
}: {
  checked: boolean;
  label: string;
  checkedAt: string | null;
  disabled?: boolean;
  locked?: boolean;
  onToggle: () => void;
  onLockedClick?: () => void;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={() => {
        if (locked) {
          onLockedClick?.();
          return;
        }
        onToggle();
      }}
      title={
        locked
          ? `${label}: ${checked ? "Sudah sesuai" : "Belum dicek"} (Terkunci — klik untuk buka kunci dengan password akun)`
          : checked
          ? `${label}: Sudah sesuai${checkedAt ? ` (${checkedAt} WIB)` : ""} — klik untuk membatalkan`
          : `${label}: Belum dicek — klik untuk menandai sesuai`
      }
      className={`inline-flex items-center justify-center gap-1.5 min-w-[96px] px-2.5 py-1.5 rounded-xl border text-[11px] font-bold transition cursor-pointer select-none disabled:opacity-50 ${
        locked
          ? checked
            ? "bg-emerald-500/10 border-emerald-500/25 text-emerald-700/80 dark:text-emerald-300/80 hover:border-amber-400"
            : "bg-slate-50/70 dark:bg-slate-950/40 border-slate-200/80 dark:border-slate-800 text-slate-400 hover:border-amber-400 hover:text-amber-600 dark:hover:text-amber-400"
          : checked
          ? "bg-emerald-500/15 border-emerald-500/40 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-500/25 shadow-xs"
          : "bg-slate-50 dark:bg-slate-950/60 border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400 hover:border-sky-400 hover:text-sky-600 dark:hover:text-sky-300"
      }`}
    >
      <span
        className={`w-4 h-4 rounded-md flex items-center justify-center border transition ${
          checked
            ? "bg-emerald-500 border-emerald-500 text-white"
            : "border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900"
        }`}
      >
        {checked && (
          <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="3">
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
        )}
      </span>
      <span>{checked ? "Sesuai" : "Belum"}</span>
      {locked && (
        <svg className="w-3 h-3 text-amber-500/80 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.2">
          <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
        </svg>
      )}
    </button>
  );
}

function InlineNoteInput({
  pmId,
  value,
  disabled,
  locked,
  onLockedClick,
  onSave
}: {
  pmId: string;
  value: string;
  disabled?: boolean;
  locked?: boolean;
  onLockedClick?: () => void;
  onSave: (pmId: string, notes: string) => void;
}) {
  const [draft, setDraft] = useState(value);
  const [focused, setFocused] = useState(false);

  const displayValue = focused ? draft : value;

  const commit = () => {
    setFocused(false);
    if (locked) return;
    const trimmed = draft.trim();
    if (trimmed !== value.trim()) {
      onSave(pmId, trimmed);
    }
  };

  return (
    <input
      type="text"
      value={displayValue}
      disabled={disabled}
      readOnly={locked}
      placeholder={locked ? "Terkunci (buka kunci utk edit)" : "Tambah catatan..."}
      title={locked ? "Terkunci — klik untuk buka kunci dengan password akun" : undefined}
      maxLength={500}
      onClick={() => {
        if (locked) onLockedClick?.();
      }}
      onFocus={() => {
        if (locked) return;
        setDraft(value);
        setFocused(true);
      }}
      onChange={(e) => {
        if (locked) return;
        setDraft(e.target.value);
      }}
      onBlur={commit}
      onKeyDown={(e) => {
        if (locked) return;
        if (e.key === "Enter") {
          (e.currentTarget as HTMLInputElement).blur();
        } else if (e.key === "Escape") {
          setDraft(value);
          setFocused(false);
          (e.currentTarget as HTMLInputElement).blur();
        }
      }}
      className={`w-full min-w-[155px] px-2.5 py-1.5 rounded-lg border text-[11px] font-medium placeholder:text-slate-400 focus:outline-none transition ${
        locked
          ? "border-slate-200/70 dark:border-slate-800 bg-slate-100/60 dark:bg-slate-950/40 text-slate-500 dark:text-slate-400 cursor-pointer hover:border-amber-400"
          : "border-slate-200 dark:border-slate-700/80 bg-slate-50/70 dark:bg-slate-950/60 text-slate-700 dark:text-slate-200 focus:bg-white dark:focus:bg-slate-900 focus:border-sky-400 focus:ring-2 focus:ring-sky-500/20"
      }`}
    />
  );
}

export function PmChecklistPanel({
  pms,
  catalog,
  checklistMap,
  crosscheckSummaries,
  savingPmIds,
  loading,
  isUnlocked,
  remainingLabel,
  onRequestUnlock,
  onLock,
  onUpdateChecklist,
  onResetSingle,
  onResetAll,
  onInspectPm,
  onOpenCrosscheck
}: PmChecklistPanelProps) {
  const [search, setSearch] = useState("");
  const [factoryFilter, setFactoryFilter] = useState("all");
  const [checklistFilter, setChecklistFilter] = useState<ChecklistFilter>("all");
  const [healthFilter, setHealthFilter] = useState<"all" | "problem" | "healthy">("all");
  const [sortBy, setSortBy] = useState<ChecklistSort>("pm_id");
  const [resettingAll, setResettingAll] = useState(false);

  // Merge live PM health summaries with catalog fallback so every PM is always selectable
  const allRows: ChecklistRowData[] = useMemo(() => {
    const map = new Map<string, ChecklistRowData>();

    for (const c of catalog) {
      const id = c.pmId.toUpperCase();
      map.set(id, {
        pmId: id,
        pmName: c.name,
        factory: c.factory,
        area: c.area,
        groupId: c.groupId,
        healthStatus: null,
        latestEnergy: null,
        latestPowerKw: null,
        dropCount: 0,
        checklist: checklistMap[id] ?? getEmptyChecklistItem(id)
      });
    }

    for (const pm of pms) {
      const id = pm.pmId.toUpperCase();
      map.set(id, {
        pmId: id,
        pmName: pm.pmName,
        factory: pm.factory,
        area: pm.area,
        groupId: pm.groupId,
        healthStatus: pm.healthStatus,
        latestEnergy: pm.latestEnergy,
        latestPowerKw: pm.latestPowerKw,
        dropCount: pm.dropCount,
        checklist: checklistMap[id] ?? getEmptyChecklistItem(id)
      });
    }

    return Array.from(map.values()).sort((a, b) => a.pmId.localeCompare(b.pmId));
  }, [pms, catalog, checklistMap]);

  const stats = useMemo(() => {
    const total = allRows.length;
    let complete = 0;
    let partial = 0;
    let unchecked = 0;
    let ewonCount = 0;
    let endpointCount = 0;
    let lcdCount = 0;

    for (const row of allRows) {
      const prog = getChecklistProgress(row.checklist);
      if (prog.isComplete) complete++;
      else if (prog.isPartial) partial++;
      else unchecked++;

      if (row.checklist.ewonChecked) ewonCount++;
      if (row.checklist.endpointChecked) endpointCount++;
      if (row.checklist.panelLcdChecked) lcdCount++;
    }

    const percentComplete = total > 0 ? Math.round((complete / total) * 100) : 0;
    return { total, complete, partial, unchecked, ewonCount, endpointCount, lcdCount, percentComplete };
  }, [allRows]);

  const filteredRows = useMemo(() => {
    const tokens = search
      .trim()
      .toLowerCase()
      .replace(/[-_/]+/g, " ")
      .split(/\s+/)
      .filter(Boolean);

    const list = allRows.filter((row) => {
      if (factoryFilter !== "all" && row.factory !== factoryFilter) return false;

      const prog = getChecklistProgress(row.checklist);
      if (checklistFilter === "complete" && !prog.isComplete) return false;
      if (checklistFilter === "partial" && !prog.isPartial) return false;
      if (checklistFilter === "unchecked" && prog.checkedCount !== 0) return false;
      if (checklistFilter === "missing_ewon" && row.checklist.ewonChecked) return false;
      if (checklistFilter === "missing_endpoint" && row.checklist.endpointChecked) return false;
      if (checklistFilter === "missing_lcd" && row.checklist.panelLcdChecked) return false;

      if (healthFilter === "problem") {
        if (row.healthStatus !== "critical" && row.healthStatus !== "warning" && row.healthStatus !== "offline") {
          return false;
        }
      } else if (healthFilter === "healthy") {
        if (row.healthStatus !== "healthy") return false;
      }

      if (tokens.length > 0) {
        const hay = `${row.pmId} ${row.pmId.replace("PM", "PM ")} ${row.pmName} ${row.factory} ${row.area} ${row.groupId} ${row.checklist.notes} ${row.checklist.updatedBy || ""}`.toLowerCase();
        const clean = hay.replace(/[-_/]+/g, " ");
        if (!tokens.every((tok) => hay.includes(tok) || clean.includes(tok))) return false;
      }
      return true;
    });

    const healthRank = (status: HealthStatus | null) => {
      if (status === "critical") return 0;
      if (status === "warning") return 1;
      if (status === "offline") return 2;
      if (status === "healthy") return 3;
      return 4;
    };

    return [...list].sort((a, b) => {
      if (sortBy === "incomplete_first") {
        const pa = getChecklistProgress(a.checklist).checkedCount;
        const pb = getChecklistProgress(b.checklist).checkedCount;
        if (pa !== pb) return pa - pb;
        return a.pmId.localeCompare(b.pmId);
      }
      if (sortBy === "problem_first") {
        const ra = healthRank(a.healthStatus);
        const rb = healthRank(b.healthStatus);
        if (ra !== rb) return ra - rb;
        return a.pmId.localeCompare(b.pmId);
      }
      if (sortBy === "recent_checked") {
        const ta = a.checklist.updatedAt || "";
        const tb = b.checklist.updatedAt || "";
        if (ta !== tb) return tb.localeCompare(ta);
        return a.pmId.localeCompare(b.pmId);
      }
      return a.pmId.localeCompare(b.pmId);
    });
  }, [allRows, search, factoryFilter, checklistFilter, healthFilter, sortBy]);

  const handleExportChecklistCsv = () => {
    const headers = [
      "PM ID",
      "Nama Peralatan",
      "Factory",
      "Area",
      "Gateway",
      "Status Kesehatan PM",
      "Active Energy Terakhir (kWh)",
      "Cek PM dengan eWON",
      "Waktu Cek eWON",
      "Cek PM dengan Endpoint",
      "Waktu Cek Endpoint",
      "Cek PM dengan Panel LCD",
      "Waktu Cek Panel LCD",
      "Status Verifikasi",
      "Catatan",
      "Terakhir Diperbarui",
      "Dicek Oleh"
    ];
    const escapeCsv = (val: unknown) => {
      const s = String(val ?? "");
      return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const rows = filteredRows.map((row) => {
      const prog = getChecklistProgress(row.checklist);
      const statusText = prog.isComplete
        ? "Sesuai (3/3)"
        : prog.isPartial
        ? `Sebagian (${prog.checkedCount}/3)`
        : "Belum Dicek (0/3)";
      return [
        row.pmId,
        row.pmName,
        row.factory,
        row.area,
        row.groupId,
        row.healthStatus ? healthStatusMeta(row.healthStatus).label : "—",
        row.latestEnergy ?? "",
        row.checklist.ewonChecked ? "Sesuai" : "Belum",
        row.checklist.ewonCheckedAt ?? "",
        row.checklist.endpointChecked ? "Sesuai" : "Belum",
        row.checklist.endpointCheckedAt ?? "",
        row.checklist.panelLcdChecked ? "Sesuai" : "Belum",
        row.checklist.panelLcdCheckedAt ?? "",
        statusText,
        row.checklist.notes,
        row.checklist.updatedAt ?? "",
        row.checklist.updatedBy ?? ""
      ];
    });
    const csv = [headers, ...rows].map((r) => r.map(escapeCsv).join(",")).join("\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `pm-verification-checklist_${getLocalTodayIso()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleConfirmResetAll = async () => {
    if (!isUnlocked) {
      onRequestUnlock();
      return;
    }
    const ok = window.confirm(
      "Reset seluruh status checklist verifikasi PM (eWON, Endpoint, Panel LCD, dan Catatan)?\n\n" +
        "Gunakan ini hanya jika ingin memulai siklus pengecekan ulang dari awal. Database SCADA tidak berubah."
    );
    if (!ok) return;
    setResettingAll(true);
    try {
      await onResetAll();
    } finally {
      setResettingAll(false);
    }
  };

  return (
    <section className="space-y-4">
      {/* Progress Overview Card */}
      <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 sm:p-5 shadow-sm space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-extrabold text-slate-900 dark:text-white">
              Checklist Verifikasi Kesesuaian Power Meter
            </h2>
            <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
              Tandai PM yang sudah dicocokkan pada <strong>eWON</strong>, <strong>Endpoint</strong>, dan{" "}
              <strong>Panel LCD</strong> fisik. Tersimpan lokal di server (read-only terhadap database SCADA).
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {isUnlocked ? (
              <button
                type="button"
                onClick={onLock}
                title="Mode edit terbuka — klik untuk mengunci kembali proteksi verifikasi PM"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/35 text-emerald-700 dark:text-emerald-300 text-xs font-extrabold transition cursor-pointer"
              >
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 10.5V6.75a4.5 4.5 0 119 0v3.75M3.75 21.75h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H3.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
                </svg>
                <span>Edit Terbuka{remainingLabel ? ` (${remainingLabel})` : ""} • Kunci</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={onRequestUnlock}
                title="Klik untuk membuka kunci edit dengan password akun Anda"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/35 text-amber-700 dark:text-amber-300 text-xs font-extrabold transition cursor-pointer"
              >
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
                </svg>
                <span>Terkunci • Buka Kunci</span>
              </button>
            )}
            <span className="px-3 py-1.5 rounded-xl bg-emerald-500/10 border border-emerald-500/25 text-emerald-700 dark:text-emerald-300 font-mono text-xs font-extrabold">
              {stats.complete} / {stats.total} PM Sesuai ({stats.percentComplete}%)
            </span>
          </div>
        </div>

        {!isUnlocked && (
          <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-3.5 py-2.5 flex flex-wrap items-center justify-between gap-2 text-xs">
            <div className="flex items-center gap-2 text-amber-800 dark:text-amber-200 font-semibold">
              <svg className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
              </svg>
              <span>
                Proteksi kunci aktif — perubahan status <strong>eWON</strong>, <strong>Endpoint</strong>, dan{" "}
                <strong>Panel LCD</strong> memerlukan verifikasi password akun Anda.
              </span>
            </div>
            <button
              type="button"
              onClick={onRequestUnlock}
              className="px-3 py-1 rounded-lg bg-amber-500 hover:bg-amber-600 text-white text-[11px] font-extrabold transition cursor-pointer shrink-0"
            >
              Buka Kunci
            </button>
          </div>
        )}

        {/* Visual Progress Bar */}
        <div className="w-full h-2.5 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
          <div
            className="h-full rounded-full bg-gradient-to-r from-sky-500 to-emerald-500 transition-all duration-300"
            style={{ width: `${stats.percentComplete}%` }}
          />
        </div>

        {/* 4 Breakdown Mini-Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <button
            type="button"
            onClick={() => setChecklistFilter((prev) => (prev === "complete" ? "all" : "complete"))}
            className={`text-left rounded-xl border p-3 transition cursor-pointer ${
              checklistFilter === "complete"
                ? "border-emerald-500 bg-emerald-500/10"
                : "border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-950/40 hover:border-emerald-400"
            }`}
          >
            <div className="flex items-center justify-between text-[11px] font-bold text-slate-500 dark:text-slate-400">
              <span>Telah Sesuai (3/3 Lengkap)</span>
              <span className="w-2 h-2 rounded-full bg-emerald-500" />
            </div>
            <div className="mt-1.5 text-xl font-extrabold font-mono text-emerald-600 dark:text-emerald-400">
              {stats.complete}
              <span className="text-xs font-semibold text-slate-400"> / {stats.total}</span>
            </div>
            <div className="mt-0.5 text-[10px] text-slate-400">
              {stats.partial} sebagian • {stats.unchecked} belum dicek
            </div>
          </button>

          <button
            type="button"
            onClick={() => setChecklistFilter((prev) => (prev === "missing_ewon" ? "all" : "missing_ewon"))}
            className={`text-left rounded-xl border p-3 transition cursor-pointer ${
              checklistFilter === "missing_ewon"
                ? "border-sky-500 bg-sky-500/10"
                : "border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-950/40 hover:border-sky-400"
            }`}
          >
            <div className="flex items-center justify-between text-[11px] font-bold text-slate-500 dark:text-slate-400">
              <span>Cek PM dengan eWON</span>
              <span className="w-2 h-2 rounded-full bg-sky-500" />
            </div>
            <div className="mt-1.5 text-xl font-extrabold font-mono text-sky-600 dark:text-sky-400">
              {stats.ewonCount}
              <span className="text-xs font-semibold text-slate-400"> / {stats.total}</span>
            </div>
            <div className="mt-0.5 text-[10px] text-slate-400">
              {stats.total - stats.ewonCount} belum dicek eWON (klik filter)
            </div>
          </button>

          <button
            type="button"
            onClick={() => setChecklistFilter((prev) => (prev === "missing_endpoint" ? "all" : "missing_endpoint"))}
            className={`text-left rounded-xl border p-3 transition cursor-pointer ${
              checklistFilter === "missing_endpoint"
                ? "border-violet-500 bg-violet-500/10"
                : "border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-950/40 hover:border-violet-400"
            }`}
          >
            <div className="flex items-center justify-between text-[11px] font-bold text-slate-500 dark:text-slate-400">
              <span>Cek PM dengan Endpoint</span>
              <span className="w-2 h-2 rounded-full bg-violet-500" />
            </div>
            <div className="mt-1.5 text-xl font-extrabold font-mono text-violet-600 dark:text-violet-400">
              {stats.endpointCount}
              <span className="text-xs font-semibold text-slate-400"> / {stats.total}</span>
            </div>
            <div className="mt-0.5 text-[10px] text-slate-400">
              {stats.total - stats.endpointCount} belum dicek Endpoint (klik filter)
            </div>
          </button>

          <button
            type="button"
            onClick={() => setChecklistFilter((prev) => (prev === "missing_lcd" ? "all" : "missing_lcd"))}
            className={`text-left rounded-xl border p-3 transition cursor-pointer ${
              checklistFilter === "missing_lcd"
                ? "border-amber-500 bg-amber-500/10"
                : "border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-950/40 hover:border-amber-400"
            }`}
          >
            <div className="flex items-center justify-between text-[11px] font-bold text-slate-500 dark:text-slate-400">
              <span>Cek PM dengan Panel LCD</span>
              <span className="w-2 h-2 rounded-full bg-amber-500" />
            </div>
            <div className="mt-1.5 text-xl font-extrabold font-mono text-amber-600 dark:text-amber-400">
              {stats.lcdCount}
              <span className="text-xs font-semibold text-slate-400"> / {stats.total}</span>
            </div>
            <div className="mt-0.5 text-[10px] text-slate-400">
              {stats.total - stats.lcdCount} belum dicek Panel LCD (klik filter)
            </div>
          </button>
        </div>
      </div>

      {/* Checklist Table Card */}
      <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2 flex-1 min-w-[220px]">
            <div className="relative w-full sm:w-[250px]">
              <svg
                className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth="2.2"
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35M17 11a6 6 0 11-12 0 6 6 0 0112 0z" />
              </svg>
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Cari PM, nama, area, catatan..."
                className="w-full pl-8 pr-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-xs font-semibold text-slate-800 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-sky-500/30"
              />
            </div>

            <select
              value={checklistFilter}
              onChange={(e) => setChecklistFilter(e.target.value as ChecklistFilter)}
              className="px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-bold text-slate-700 dark:text-slate-200"
            >
              <option value="all">Semua Status Checklist</option>
              <option value="complete">Telah Sesuai (3/3)</option>
              <option value="partial">Sebagian Dicek (1-2/3)</option>
              <option value="unchecked">Belum Dicek (0/3)</option>
              <option value="missing_ewon">Belum Cek eWON</option>
              <option value="missing_endpoint">Belum Cek Endpoint</option>
              <option value="missing_lcd">Belum Cek Panel LCD</option>
            </select>

            <select
              value={factoryFilter}
              onChange={(e) => setFactoryFilter(e.target.value)}
              className="px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-bold text-slate-700 dark:text-slate-200"
            >
              <option value="all">Semua Factory</option>
              <option value="Factory 1">Factory 1</option>
              <option value="Factory 2">Factory 2</option>
              <option value="Incoming PLN">Incoming PLN</option>
            </select>

            <select
              value={healthFilter}
              onChange={(e) => setHealthFilter(e.target.value as any)}
              className="px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-bold text-slate-700 dark:text-slate-200"
            >
              <option value="all">Semua Kondisi PM</option>
              <option value="problem">Bermasalah / Offline</option>
              <option value="healthy">Sehat Saja</option>
            </select>

            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as ChecklistSort)}
              className="px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-bold text-slate-700 dark:text-slate-200"
            >
              <option value="pm_id">Urutkan: Kode PM</option>
              <option value="incomplete_first">Belum Lengkap Dulu</option>
              <option value="problem_first">PM Bermasalah Dulu</option>
              <option value="recent_checked">Terbaru Dicek</option>
            </select>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={handleExportChecklistCsv}
              disabled={filteredRows.length === 0}
              className="px-3 py-1.5 rounded-xl bg-emerald-500 hover:bg-emerald-600 disabled:opacity-40 text-white text-xs font-bold cursor-pointer transition"
            >
              Export CSV
            </button>
            <button
              type="button"
              onClick={() => void handleConfirmResetAll()}
              disabled={resettingAll || (stats.complete === 0 && stats.partial === 0)}
              title={!isUnlocked ? "Terkunci — klik untuk buka kunci dengan password akun" : "Reset seluruh checklist verifikasi PM"}
              className="px-3 py-1.5 rounded-xl border border-rose-500/30 bg-rose-500/10 text-rose-600 dark:text-rose-400 hover:bg-rose-500/20 disabled:opacity-40 text-xs font-bold cursor-pointer transition"
            >
              {!isUnlocked ? "🔒 " : ""}Reset Checklist
            </button>
          </div>
        </div>

        <div className="overflow-x-auto scrollbar-thin">
          <table className="w-full min-w-[1040px] text-left text-xs border-collapse">
            <thead className="bg-slate-50 dark:bg-slate-950/70 text-[10px] uppercase tracking-wider text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-slate-800">
              <tr>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Power Meter &amp; Area</th>
                <th className="px-3 py-3 text-center">Cek PM dgn eWON</th>
                <th className="px-3 py-3 text-center">Cek PM dgn Endpoint</th>
                <th className="px-3 py-3 text-center">Cek PM dgn Panel LCD</th>
                <th className="px-3 py-3">Catatan Verifikasi</th>
                <th className="px-3 py-3">Terakhir Dicek</th>
                <th className="px-4 py-3 text-right">Aksi Cepat</th>
              </tr>
            </thead>
            <tbody translate="no" className="notranslate divide-y divide-slate-100 dark:divide-slate-800/80">
              {loading && allRows.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-12 text-center text-slate-400 font-semibold">
                    Memuat daftar checklist Power Meter...
                  </td>
                </tr>
              ) : filteredRows.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-12 text-center text-slate-400 font-semibold">
                    Tidak ada Power Meter yang cocok dengan filter checklist.
                  </td>
                </tr>
              ) : (
                filteredRows.map((row) => {
                  const prog = getChecklistProgress(row.checklist);
                  const saving = Boolean(savingPmIds[row.pmId]);
                  const hMeta = row.healthStatus ? healthStatusMeta(row.healthStatus) : null;

                  return (
                    <tr
                      key={row.pmId}
                      className={`transition ${
                        prog.isComplete
                          ? "bg-emerald-500/[0.04] hover:bg-emerald-500/[0.08]"
                          : "hover:bg-slate-50 dark:hover:bg-slate-800/40"
                      }`}
                    >
                      <td className="px-4 py-3 whitespace-nowrap">
                        {prog.isComplete ? (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border border-emerald-500/35 bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 text-[11px] font-extrabold">
                            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.8">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                            </svg>
                            Sesuai 3/3
                          </span>
                        ) : prog.isPartial ? (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border border-amber-500/35 bg-amber-500/15 text-amber-700 dark:text-amber-300 text-[11px] font-bold">
                            <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                            Proses {prog.checkedCount}/3
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border border-slate-300/60 dark:border-slate-700 bg-slate-100 dark:bg-slate-800/70 text-slate-500 dark:text-slate-400 text-[11px] font-bold">
                            <span className="w-1.5 h-1.5 rounded-full bg-slate-400" />
                            Belum 0/3
                          </span>
                        )}
                      </td>

                      <td className="px-4 py-3">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span className="px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 font-mono text-[11px] font-extrabold text-slate-800 dark:text-slate-100">
                            {row.pmId}
                          </span>
                          <span className="font-bold text-slate-800 dark:text-slate-100">{row.pmName}</span>
                          {hMeta && (
                            <span
                              className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md border text-[10px] font-bold ${hMeta.badgeClass}`}
                            >
                              <span className={`w-1.5 h-1.5 rounded-full ${hMeta.dotClass}`} />
                              {hMeta.label}
                            </span>
                          )}
                        </div>
                        <div className="mt-0.5 flex flex-wrap items-center gap-2 text-[11px] text-slate-500 dark:text-slate-400">
                          <span>
                            {row.factory} • {row.area}
                          </span>
                          {row.latestEnergy !== null && (
                            <span className="font-mono text-[10px] text-sky-600 dark:text-sky-400 font-semibold">
                              • SCADA: {fmtNumber(row.latestEnergy, 2)} kWh
                            </span>
                          )}
                        </div>
                      </td>

                      <td className="px-3 py-3 text-center whitespace-nowrap">
                        <CheckToggleButton
                          checked={row.checklist.ewonChecked}
                          label="Cek PM dengan eWON"
                          checkedAt={row.checklist.ewonCheckedAt}
                          disabled={saving}
                          locked={!isUnlocked}
                          onLockedClick={onRequestUnlock}
                          onToggle={() =>
                            void onUpdateChecklist(row.pmId, {
                              ewonChecked: !row.checklist.ewonChecked
                            })
                          }
                        />
                      </td>

                      <td className="px-3 py-3 text-center whitespace-nowrap">
                        <CheckToggleButton
                          checked={row.checklist.endpointChecked}
                          label="Cek PM dengan Endpoint"
                          checkedAt={row.checklist.endpointCheckedAt}
                          disabled={saving}
                          locked={!isUnlocked}
                          onLockedClick={onRequestUnlock}
                          onToggle={() =>
                            void onUpdateChecklist(row.pmId, {
                              endpointChecked: !row.checklist.endpointChecked
                            })
                          }
                        />
                      </td>

                      <td className="px-3 py-3 text-center whitespace-nowrap">
                        <CheckToggleButton
                          checked={row.checklist.panelLcdChecked}
                          label="Cek PM dengan Panel LCD"
                          checkedAt={row.checklist.panelLcdCheckedAt}
                          disabled={saving}
                          locked={!isUnlocked}
                          onLockedClick={onRequestUnlock}
                          onToggle={() =>
                            void onUpdateChecklist(row.pmId, {
                              panelLcdChecked: !row.checklist.panelLcdChecked
                            })
                          }
                        />
                      </td>

                      <td className="px-3 py-3">
                        <InlineNoteInput
                          pmId={row.pmId}
                          value={row.checklist.notes}
                          disabled={saving}
                          locked={!isUnlocked}
                          onLockedClick={onRequestUnlock}
                          onSave={(id, notes) => void onUpdateChecklist(id, { notes })}
                        />
                      </td>

                      <td className="px-3 py-3 whitespace-nowrap text-[11px]">
                        {row.checklist.updatedAt ? (
                          <div>
                            <div className="font-semibold text-slate-700 dark:text-slate-200 truncate max-w-[130px]">
                              {row.checklist.updatedBy || "Admin"}
                            </div>
                            <div className="font-mono text-[10px] text-slate-400">
                              {row.checklist.updatedAt.slice(5, 16)} WIB
                            </div>
                          </div>
                        ) : (
                          <span className="text-slate-400">—</span>
                        )}
                      </td>

                      <td className="px-4 py-3 text-right whitespace-nowrap space-x-1.5">
                        {!prog.isComplete ? (
                          <button
                            type="button"
                            disabled={saving}
                            onClick={() => {
                              if (!isUnlocked) {
                                onRequestUnlock();
                                return;
                              }
                              void onUpdateChecklist(row.pmId, {
                                ewonChecked: true,
                                endpointChecked: true,
                                panelLcdChecked: true
                              });
                            }}
                            title={
                              !isUnlocked
                                ? "Terkunci — klik untuk buka kunci dengan password akun"
                                : "Centang ketiganya sekaligus (eWON + Endpoint + Panel LCD)"
                            }
                            className={`px-2.5 py-1.5 rounded-lg border text-[11px] font-bold transition cursor-pointer disabled:opacity-40 ${
                              !isUnlocked
                                ? "bg-slate-100 dark:bg-slate-800/70 border-slate-200 dark:border-slate-700 text-slate-400 hover:border-amber-400 hover:text-amber-600"
                                : "bg-emerald-500/15 hover:bg-emerald-500/25 border-emerald-500/30 text-emerald-700 dark:text-emerald-300"
                            }`}
                          >
                            {!isUnlocked ? "🔒 " : "✓ "}Semua
                          </button>
                        ) : (
                          <button
                            type="button"
                            disabled={saving}
                            onClick={() => {
                              if (!isUnlocked) {
                                onRequestUnlock();
                                return;
                              }
                              void onResetSingle(row.pmId);
                            }}
                            title={
                              !isUnlocked
                                ? "Terkunci — klik untuk buka kunci dengan password akun"
                                : "Kosongkan checklist untuk PM ini"
                            }
                            className="px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:border-rose-400 hover:text-rose-600 text-slate-500 dark:text-slate-300 text-[11px] font-bold transition cursor-pointer disabled:opacity-40"
                          >
                            {!isUnlocked ? "🔒 " : ""}Reset
                          </button>
                        )}
                        {onOpenCrosscheck && (() => {
                          const cc = crosscheckSummaries?.[row.pmId];
                          const hasImgs = Boolean(cc && (cc.imageCount > 0 || cc.hasLiveEndpoint));
                          const tone =
                            cc?.overallStatus === "all_match"
                              ? "border-emerald-500/35 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
                              : cc?.overallStatus === "mismatch"
                              ? "border-rose-500/35 bg-rose-500/10 text-rose-700 dark:text-rose-300"
                              : cc?.overallStatus === "warning"
                              ? "border-amber-500/35 bg-amber-500/10 text-amber-700 dark:text-amber-300"
                              : "border-indigo-500/30 bg-indigo-500/10 text-indigo-700 dark:text-indigo-300";
                          return (
                            <button
                              type="button"
                              onClick={() => onOpenCrosscheck(row.pmId)}
                              title={`Buka Crosscheck Multi-Gambar AI untuk ${row.pmId}`}
                              className={`px-2.5 py-1.5 rounded-lg border text-[11px] font-bold transition cursor-pointer hover:opacity-85 ${tone}`}
                            >
                              📷 {hasImgs && cc ? `Crosscheck (${cc.imageCount})` : "Crosscheck"}
                            </button>
                          );
                        })()}
                        <button
                          type="button"
                          onClick={() => onInspectPm(row.pmId)}
                          className="px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:border-sky-400 hover:text-sky-600 dark:hover:text-sky-400 text-[11px] font-bold transition cursor-pointer"
                        >
                          Grafik
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        <div className="px-4 py-2.5 border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/30 flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-400">
          <span>
            Menampilkan {filteredRows.length} dari {stats.total} Power Meter •{" "}
            <strong className="text-emerald-600 dark:text-emerald-400">{stats.complete} sesuai lengkap</strong>
          </span>
          <span>Checklist tersinkronisasi real-time antar sesi admin (tersimpan lokal di server)</span>
        </div>
      </div>
    </section>
  );
}
