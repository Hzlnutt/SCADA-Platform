import { useEffect, useMemo, useState } from "react";

export type St3ActiveProcess = "HEATING" | "STERIL" | "COOLING";

export interface St3DurationRecord {
  id: string;
  date: string; // YYYY-MM-DD
  lot: string;
  process: St3ActiveProcess;
  startedAtMs: number;
  endedAtMs: number | null; // null while currently running
  startTime: string; // HH:mm:ss
  endTime: string | null; // HH:mm:ss or null while running
  durationSeconds: number;
  isLive?: boolean;
}

export interface ActiveSt3Session {
  id: string;
  date: string;
  lot: string;
  process: St3ActiveProcess;
  startedAtMs: number;
  startTime: string;
  lastSeenAtMs: number;
}

export function formatDurationHms(totalSeconds: number): string {
  const safe = Math.max(0, Math.floor(totalSeconds));
  const hrs = Math.floor(safe / 3600);
  const mins = Math.floor((safe % 3600) / 60);
  const secs = safe % 60;
  return `${String(hrs).padStart(2, "0")}:${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
}

export function formatLocalDateIso(ms: number): string {
  const d = new Date(ms);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function formatLocalTimeHms(ms: number): string {
  const d = new Date(ms);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}:${String(d.getSeconds()).padStart(2, "0")}`;
}

function processBadgeMeta(process: St3ActiveProcess): {
  label: string;
  badgeClass: string;
  dotClass: string;
} {
  switch (process) {
    case "HEATING":
      return {
        label: "HEATING",
        badgeClass:
          "bg-orange-500/15 text-orange-700 dark:text-orange-300 border-orange-500/35",
        dotClass: "bg-orange-500",
      };
    case "STERIL":
      return {
        label: "STERIL",
        badgeClass:
          "bg-violet-500/15 text-violet-700 dark:text-violet-300 border-violet-500/35",
        dotClass: "bg-violet-500",
      };
    case "COOLING":
      return {
        label: "COOLING",
        badgeClass:
          "bg-sky-500/15 text-sky-700 dark:text-sky-300 border-sky-500/35",
        dotClass: "bg-sky-500",
      };
  }
}

interface St3DurationModalProps {
  open: boolean;
  machineName: string;
  currentProcess: string;
  currentLot: string;
  liveDurationSeconds: number;
  activeSession: ActiveSt3Session | null;
  records: St3DurationRecord[];
  onClearHistory: () => void;
  onClose: () => void;
}

export function St3DurationModal({
  open,
  machineName,
  currentProcess,
  currentLot,
  liveDurationSeconds,
  activeSession,
  records,
  onClearHistory,
  onClose,
}: St3DurationModalProps) {
  const [search, setSearch] = useState("");
  const [processFilter, setProcessFilter] = useState<"ALL" | St3ActiveProcess>("ALL");
  const [dateFilter, setDateFilter] = useState("");

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, onClose]);

  const combinedRows = useMemo<St3DurationRecord[]>(() => {
    const list: St3DurationRecord[] = [];
    if (activeSession) {
      list.push({
        id: activeSession.id,
        date: activeSession.date,
        lot: activeSession.lot,
        process: activeSession.process,
        startedAtMs: activeSession.startedAtMs,
        endedAtMs: null,
        startTime: activeSession.startTime,
        endTime: null,
        durationSeconds: liveDurationSeconds,
        isLive: true,
      });
    }
    return [...list, ...records];
  }, [activeSession, liveDurationSeconds, records]);

  const filteredRows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return combinedRows.filter((row) => {
      if (processFilter !== "ALL" && row.process !== processFilter) return false;
      if (dateFilter && row.date !== dateFilter) return false;
      if (q) {
        const hay = `${row.date} ${row.lot} ${row.process} ${row.startTime} ${row.endTime || ""}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [combinedRows, search, processFilter, dateFilter]);

  const summary = useMemo(() => {
    const totals: Record<St3ActiveProcess, { count: number; seconds: number }> = {
      HEATING: { count: 0, seconds: 0 },
      STERIL: { count: 0, seconds: 0 },
      COOLING: { count: 0, seconds: 0 },
    };
    for (const row of filteredRows) {
      totals[row.process].count += 1;
      totals[row.process].seconds += row.durationSeconds;
    }
    return totals;
  }, [filteredRows]);

  if (!open) return null;

  const handleExportCsv = () => {
    const headers = ["No", "Tanggal", "LOT", "Proses", "Mulai", "Selesai", "Durasi"];
    const escapeCsv = (val: unknown) => {
      const s = String(val ?? "");
      return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const rows = filteredRows.map((row, idx) => [
      idx + 1,
      row.date,
      row.lot,
      row.process,
      row.startTime,
      row.isLive ? "Sedang Berjalan" : row.endTime || "—",
      formatDurationHms(row.durationSeconds),
    ]);
    const csv = [headers, ...rows].map((r) => r.map(escapeCsv).join(",")).join("\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `st3-duration-list_${formatLocalDateIso(Date.now())}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleConfirmClear = () => {
    const ok = window.confirm(
      "Hapus seluruh riwayat durasi lokal (browser) yang sudah selesai?\n\n" +
        "Proses yang sedang berjalan saat ini tetap dilanjutkan."
    );
    if (!ok) return;
    onClearHistory();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-sm p-3 sm:p-6"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-4xl max-h-[90vh] overflow-y-auto scrollbar-thin rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-2xl flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="sticky top-0 z-20 px-4 sm:px-5 py-4 border-b border-slate-200 dark:border-slate-800 bg-white/95 dark:bg-slate-900/95 backdrop-blur flex flex-wrap items-center justify-between gap-3">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="px-2 py-0.5 rounded-md bg-sky-500/15 text-sky-700 dark:text-sky-300 font-mono text-xs font-extrabold">
                ST-3
              </span>
              <h2 className="text-base sm:text-lg font-extrabold text-slate-900 dark:text-white truncate">
                List Duration — {machineName}
              </h2>
            </div>
            <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
              <span>
                Status saat ini:{" "}
                <strong className="text-slate-800 dark:text-slate-100">{currentProcess}</strong>
              </span>
              <span>•</span>
              <span>
                LOT: <strong className="text-slate-800 dark:text-slate-100">{currentLot}</strong>
              </span>
              {activeSession && (
                <>
                  <span>•</span>
                  <span className="inline-flex items-center gap-1.5 font-mono font-bold text-emerald-600 dark:text-emerald-400">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                    {formatDurationHms(liveDurationSeconds)}
                  </span>
                </>
              )}
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-500 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
            aria-label="Tutup modal List Duration"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.4">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Body */}
        <div className="p-4 sm:p-5 space-y-4">
          {/* Info banner (temporary frontend timer mode) */}
          <div className="rounded-xl border border-sky-500/25 bg-sky-500/[0.07] px-3.5 py-2.5 text-[11px] font-medium text-sky-800 dark:text-sky-200 flex flex-wrap items-center justify-between gap-2">
            <span>
              <strong>Timer Frontend (Sementara):</strong> Durasi tiap tahap (<strong>Heating</strong>,{" "}
              <strong>Steril</strong>, <strong>Cooling</strong>) dicatat otomatis dari perubahan{" "}
              <code>PROSES ST</code> dan tersimpan lokal di browser — siap disambungkan ke API / Database.
            </span>
          </div>

          {/* 3 Summary Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {(["HEATING", "STERIL", "COOLING"] as St3ActiveProcess[]).map((proc) => {
              const meta = processBadgeMeta(proc);
              const item = summary[proc];
              return (
                <button
                  key={proc}
                  type="button"
                  onClick={() => setProcessFilter((prev) => (prev === proc ? "ALL" : proc))}
                  className={`text-left rounded-xl border p-3 transition cursor-pointer ${
                    processFilter === proc
                      ? "border-sky-500 bg-sky-500/10"
                      : "border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-950/40 hover:border-sky-400"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md border text-[10px] font-extrabold ${meta.badgeClass}`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${meta.dotClass}`} />
                      {meta.label}
                    </span>
                    <span className="text-[11px] font-semibold text-slate-400">
                      {item.count} sesi
                    </span>
                  </div>
                  <div className="mt-2 text-lg font-extrabold font-mono text-slate-900 dark:text-white">
                    {formatDurationHms(item.seconds)}
                  </div>
                </button>
              );
            })}
          </div>

          {/* Filter & Action Toolbar */}
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap items-center gap-2 flex-1 min-w-[200px]">
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Cari LOT atau tanggal..."
                className="w-full sm:w-[210px] px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-xs font-semibold text-slate-800 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-sky-500/30"
              />
              <select
                value={processFilter}
                onChange={(e) => setProcessFilter(e.target.value as any)}
                className="px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-bold text-slate-700 dark:text-slate-200"
              >
                <option value="ALL">Semua Proses</option>
                <option value="HEATING">HEATING</option>
                <option value="STERIL">STERIL</option>
                <option value="COOLING">COOLING</option>
              </select>
              <input
                type="date"
                value={dateFilter}
                onChange={(e) => setDateFilter(e.target.value)}
                className="px-2.5 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-semibold text-slate-700 dark:text-slate-200"
              />
              {(search || processFilter !== "ALL" || dateFilter) && (
                <button
                  type="button"
                  onClick={() => {
                    setSearch("");
                    setProcessFilter("ALL");
                    setDateFilter("");
                  }}
                  className="px-2.5 py-1.5 rounded-xl text-xs font-bold text-slate-500 hover:text-sky-600 cursor-pointer"
                >
                  Reset Filter
                </button>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={handleExportCsv}
                disabled={filteredRows.length === 0}
                className="px-3 py-1.5 rounded-xl bg-emerald-500 hover:bg-emerald-600 disabled:opacity-40 text-white text-xs font-bold cursor-pointer transition"
              >
                Export CSV
              </button>
              <button
                type="button"
                onClick={handleConfirmClear}
                disabled={records.length === 0}
                className="px-3 py-1.5 rounded-xl border border-rose-500/30 bg-rose-500/10 text-rose-600 dark:text-rose-400 hover:bg-rose-500/20 disabled:opacity-40 text-xs font-bold cursor-pointer transition"
              >
                Hapus Riwayat
              </button>
            </div>
          </div>

          {/* Duration Table */}
          <div className="rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden">
            <div className="overflow-x-auto scrollbar-thin">
              <table className="w-full min-w-[680px] text-left text-xs border-collapse">
                <thead className="bg-slate-50 dark:bg-slate-950/70 text-[10px] uppercase tracking-wider text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-slate-800">
                  <tr>
                    <th className="px-3.5 py-3 w-12">No</th>
                    <th className="px-3.5 py-3">Tanggal</th>
                    <th className="px-3.5 py-3">LOT</th>
                    <th className="px-3.5 py-3">Proses</th>
                    <th className="px-3.5 py-3">Mulai</th>
                    <th className="px-3.5 py-3">Selesai</th>
                    <th className="px-3.5 py-3 text-right">Durasi</th>
                  </tr>
                </thead>
                <tbody translate="no" className="notranslate divide-y divide-slate-100 dark:divide-slate-800/80">
                  {filteredRows.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="px-4 py-12 text-center text-slate-400 font-semibold">
                        Belum ada riwayat durasi proses ST-3 tercatat.
                        <div className="mt-1 text-[11px] font-normal text-slate-400">
                          Timer akan mulai otomatis saat <strong>PROSES ST</strong> berpindah ke{" "}
                          <strong>HEATING</strong>, <strong>STERIL</strong>, atau <strong>COOLING</strong>.
                        </div>
                      </td>
                    </tr>
                  ) : (
                    filteredRows.map((row, idx) => {
                      const meta = processBadgeMeta(row.process);
                      return (
                        <tr
                          key={row.id}
                          className={
                            row.isLive
                              ? "bg-emerald-500/[0.06] hover:bg-emerald-500/[0.1]"
                              : "hover:bg-slate-50 dark:hover:bg-slate-800/40"
                          }
                        >
                          <td className="px-3.5 py-2.5 font-mono text-slate-500 dark:text-slate-400">
                            {idx + 1}
                          </td>
                          <td className="px-3.5 py-2.5 font-mono font-bold text-slate-800 dark:text-slate-100 whitespace-nowrap">
                            {row.date}
                          </td>
                          <td className="px-3.5 py-2.5 font-bold text-slate-800 dark:text-slate-100 whitespace-nowrap">
                            {row.lot}
                          </td>
                          <td className="px-3.5 py-2.5 whitespace-nowrap">
                            <span
                              className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md border text-[11px] font-extrabold ${meta.badgeClass}`}
                            >
                              <span
                                className={`w-1.5 h-1.5 rounded-full ${meta.dotClass} ${
                                  row.isLive ? "animate-pulse" : ""
                                }`}
                              />
                              {meta.label}
                            </span>
                          </td>
                          <td className="px-3.5 py-2.5 font-mono text-slate-700 dark:text-slate-300 whitespace-nowrap">
                            {row.startTime}
                          </td>
                          <td className="px-3.5 py-2.5 font-mono whitespace-nowrap">
                            {row.isLive ? (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30 text-[10px] font-extrabold">
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                                Sedang Berjalan
                              </span>
                            ) : (
                              <span className="text-slate-700 dark:text-slate-300">{row.endTime || "—"}</span>
                            )}
                          </td>
                          <td className="px-3.5 py-2.5 text-right font-mono font-extrabold text-slate-900 dark:text-white whitespace-nowrap">
                            {formatDurationHms(row.durationSeconds)}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-400">
            <span>Menampilkan {filteredRows.length} data durasi proses ST-3</span>
            <span>Format durasi: JJ:MM:DD</span>
          </div>
        </div>
      </div>
    </div>
  );
}
