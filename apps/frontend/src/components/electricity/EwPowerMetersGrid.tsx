import { useMemo, useState } from "react";
import { PmDetailModal } from "./PmDetailModal";
import type { ElectricPmItem } from "./PmDetailModal";
import { getPmInfo, getPmSortIndex } from "../../data/pmMapping";

type Props = {
  powerMeters: ElectricPmItem[];
  isDark: boolean;
  groupId?: string;
  title?: string;
  canEditPosition?: boolean;
};

export function EwPowerMetersGrid({
  powerMeters,
  isDark,
  groupId = "EW23",
  title = "Sub-Distribution Machine Telemetry",
  canEditPosition = false
}: Props) {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedPmId, setSelectedPmId] = useState<string | null>(null);
  const selectedPm = useMemo(
    () => powerMeters.find((p) => p.pm_id === selectedPmId) ?? null,
    [powerMeters, selectedPmId]
  );

  // Position editing state for Senior Unit Head & Admin
  const [isEditingPosition, setIsEditingPosition] = useState(false);
  const [customOrder, setCustomOrder] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem(`scada_subdist_order_${groupId}`);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch (e) {}
    return [];
  });
  const [draftOrder, setDraftOrder] = useState<string[]>([]);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [draggedPmId, setDraggedPmId] = useState<string | null>(null);

  const activeOrder = isEditingPosition ? draftOrder : customOrder;

  const filtered = useMemo(() => {
    const list = [...powerMeters].filter((pm) => {
      const info = getPmInfo(pm.pm_id);
      const term = searchTerm.toLowerCase();
      return (
        pm.pm_id.toLowerCase().includes(term) ||
        info.name.toLowerCase().includes(term) ||
        info.model.toLowerCase().includes(term) ||
        (info.category && info.category.toLowerCase().includes(term))
      );
    });

    if (activeOrder.length > 0) {
      return list.sort((a, b) => {
        const idxA = activeOrder.indexOf(a.pm_id.toUpperCase());
        const idxB = activeOrder.indexOf(b.pm_id.toUpperCase());
        if (idxA === -1 && idxB === -1) return getPmSortIndex(a.pm_id) - getPmSortIndex(b.pm_id);
        if (idxA === -1) return 1;
        if (idxB === -1) return -1;
        return idxA - idxB;
      });
    }

    return list.sort((a, b) => getPmSortIndex(a.pm_id) - getPmSortIndex(b.pm_id));
  }, [powerMeters, searchTerm, activeOrder]);

  const totalKw = powerMeters.reduce((sum, pm) => sum + (Number(pm.active_power_total) || 0), 0);
  const onlineCount = powerMeters.filter((pm) => pm.status !== false).length;

  const handleStartEdit = () => {
    const currentList = filtered.map((p) => p.pm_id.toUpperCase());
    setDraftOrder(currentList);
    setIsEditingPosition(true);
  };

  const handleCancelEdit = () => {
    setIsEditingPosition(false);
    setDraftOrder([]);
  };

  const handleSaveOrder = () => {
    setCustomOrder(draftOrder);
    try {
      localStorage.setItem(`scada_subdist_order_${groupId}`, JSON.stringify(draftOrder));
    } catch (e) {}
    setIsEditingPosition(false);
    setToastMessage(`✓ Posisi Sub-Distribution ${groupId.toUpperCase()} berhasil disimpan!`);
    setTimeout(() => setToastMessage(null), 3000);
  };

  const handleMoveDirection = (pmId: string, direction: "left" | "right") => {
    const upId = pmId.toUpperCase();
    const list = [...draftOrder];
    const idx = list.indexOf(upId);
    if (idx === -1) return;
    const targetIdx = direction === "left" ? idx - 1 : idx + 1;
    if (targetIdx < 0 || targetIdx >= list.length) return;
    const temp = list[idx];
    list[idx] = list[targetIdx];
    list[targetIdx] = temp;
    setDraftOrder(list);
  };

  const handleDragStart = (e: React.DragEvent, pmId: string) => {
    setDraggedPmId(pmId.toUpperCase());
    e.dataTransfer.setData("text/plain", pmId.toUpperCase());
  };

  const handleDropOnCard = (targetPmId: string) => {
    const tgt = targetPmId.toUpperCase();
    if (!draggedPmId || draggedPmId === tgt) return;
    const list = [...draftOrder];
    const srcIdx = list.indexOf(draggedPmId);
    const tgtIdx = list.indexOf(tgt);
    if (srcIdx !== -1 && tgtIdx !== -1) {
      list.splice(srcIdx, 1);
      list.splice(tgtIdx, 0, draggedPmId);
      setDraftOrder(list);
    }
    setDraggedPmId(null);
  };

  return (
    <section className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm overflow-hidden">
      {/* Header Bar */}
      <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3 bg-slate-50/50 dark:bg-slate-800/20">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-sky-500/10 border border-sky-500/20 flex items-center justify-center text-sky-500 text-base">
            ⚡
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-sm font-black uppercase tracking-wider text-slate-800 dark:text-white">
                {title} ({groupId.toUpperCase()})
              </h3>
              <span className="px-2.5 py-0.5 rounded-full text-xs font-black bg-sky-500/10 text-sky-500 border border-sky-500/20">
                {onlineCount}/{powerMeters.length} Online
              </span>

              {canEditPosition && (
                <div className="ml-1">
                  {!isEditingPosition ? (
                    <button
                      type="button"
                      onClick={handleStartEdit}
                      className="flex items-center gap-1.5 px-3 py-1 text-xs font-bold rounded-lg border border-sky-500/30 bg-sky-500/10 text-sky-600 dark:text-sky-400 hover:bg-sky-500/20 transition cursor-pointer"
                      title="Atur Urutan dan Posisi Kartu Sub-Distribution (Senior Unit Head / Admin Only)"
                    >
                      <span>📐 Atur Posisi</span>
                    </button>
                  ) : (
                    <div className="flex items-center gap-1.5 animate-in fade-in duration-150">
                      <button
                        type="button"
                        onClick={handleCancelEdit}
                        className="px-2.5 py-1 text-xs font-bold rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 transition cursor-pointer"
                      >
                        Batal
                      </button>
                      <button
                        type="button"
                        onClick={handleSaveOrder}
                        className="flex items-center gap-1.5 px-3 py-1 text-xs font-extrabold rounded-lg bg-emerald-500 hover:bg-emerald-600 text-white shadow-md shadow-emerald-500/25 transition cursor-pointer active:scale-95"
                      >
                        <span>💾 Simpan Posisi</span>
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
            <p className="text-xs text-slate-400 font-medium mt-0.5">
              Monitoring beban daya dan kualitas listrik per unit mesin/panel sub-distribusi
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {toastMessage && (
            <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 px-3 py-1 rounded-lg border border-emerald-300 dark:border-emerald-800 animate-in fade-in">
              {toastMessage}
            </span>
          )}

          {/* Quick Total Load Badge */}
          <div className="px-3.5 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 shadow-sm flex items-center gap-2">
            <span className="text-xs font-black uppercase text-slate-400">Total Beban:</span>
            <span className="text-sm font-black font-mono text-sky-500">
              {totalKw.toFixed(1)} <span className="text-xs font-bold text-slate-400">kW</span>
            </span>
          </div>

          {/* Search Input */}
          <div className="relative">
            <input
              type="text"
              placeholder="Cari Mesin / PM (cth: Chiller, AHU)..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="px-3.5 py-1.5 pl-8 text-xs font-bold rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-sky-500 w-60"
            />
            <span className="absolute left-2.5 top-2 text-slate-400 text-xs">🔍</span>
          </div>
        </div>
      </div>

      {/* Grid of Power Meters */}
      <div className="p-6">
        {filtered.length === 0 ? (
          <div className="text-center py-10 text-slate-400 text-xs font-bold">
            Tidak ada mesin/Power Meter yang sesuai dengan kata kunci pencarian.
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
            {filtered.map((pm) => {
              const info = getPmInfo(pm.pm_id);
              const isOnline = pm.status !== false;
              const pKw = Number(pm.active_power_total) || 0;
              const pf = Math.abs(Number(pm.power_factor) || 0);
              const vL = Number(pm.volt_ab) || Number(pm.volt_ll) || 0;
              const iAvg = ((Number(pm.current_a) || 0) + (Number(pm.current_b) || 0) + (Number(pm.current_c) || 0)) / 3;

              return (
                <div
                  key={pm.pm_id}
                  draggable={isEditingPosition}
                  onDragStart={(e) => handleDragStart(e, pm.pm_id)}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={() => handleDropOnCard(pm.pm_id)}
                  onClick={() => {
                    if (!isEditingPosition) setSelectedPmId(pm.pm_id);
                  }}
                  className={`p-4 rounded-2xl border transition-all flex flex-col justify-between relative ${
                    isEditingPosition
                      ? "ring-2 ring-sky-500/50 border-sky-400 bg-sky-50/20 dark:bg-slate-800/80 cursor-grab active:cursor-grabbing hover:scale-[1.02]"
                      : "border-slate-200/90 dark:border-slate-800 bg-white dark:bg-slate-800/40 hover:border-sky-500/50 hover:shadow-lg hover:shadow-sky-500/5 cursor-pointer group"
                  }`}
                >
                  {/* Card Header */}
                  <div>
                    <div className="flex items-start justify-between gap-1.5 mb-2">
                      <div className="min-w-0">
                        <h4 className="text-sm font-black text-slate-800 dark:text-slate-100 group-hover:text-sky-500 transition-colors leading-snug line-clamp-2">
                          {info.name}
                        </h4>
                        <div className="flex items-center gap-1.5 mt-1">
                          <span className="text-xs font-bold font-mono text-slate-500 dark:text-slate-400">
                            {pm.pm_id}
                          </span>
                          <span className="text-[10px] font-black px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300">
                            {info.model}
                          </span>
                        </div>
                      </div>
                      <span
                        className={`shrink-0 inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-black ${
                          isOnline
                            ? "bg-emerald-500/10 text-emerald-500 border border-emerald-500/20"
                            : "bg-rose-500/10 text-rose-500 border border-rose-500/20"
                        }`}
                      >
                        <span
                          className={`w-1.5 h-1.5 rounded-full ${
                            isOnline ? "bg-emerald-500 animate-pulse" : "bg-rose-500"
                          }`}
                        />
                        {isOnline ? "LIVE" : "OFF"}
                      </span>
                    </div>

                    {/* Main Metric: Active Power */}
                    <div className="my-2.5 p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/70 border border-slate-100 dark:border-slate-700/50">
                      <span className="text-xs font-bold uppercase tracking-wider text-slate-400 block mb-0.5">
                        Active Power
                      </span>
                      <div className="flex items-baseline gap-1.5">
                        <span className="text-2xl font-black font-mono text-sky-500 tracking-tight">
                          {pKw.toFixed(1)}
                        </span>
                        <span className="text-xs font-black text-slate-400">kW</span>
                      </div>
                    </div>

                    {/* Secondary Metrics */}
                    <div className="grid grid-cols-2 gap-2 text-xs font-mono">
                      <div className="flex flex-col p-2 rounded-lg bg-slate-50/80 dark:bg-slate-800/50">
                        <span className="text-[10px] text-slate-400 font-sans font-bold uppercase tracking-wider">Tegangan</span>
                        <span className="text-xs sm:text-sm font-black text-slate-800 dark:text-slate-100">{vL.toFixed(0)} V</span>
                      </div>
                      <div className="flex flex-col p-2 rounded-lg bg-slate-50/80 dark:bg-slate-800/50">
                        <span className="text-[10px] text-slate-400 font-sans font-bold uppercase tracking-wider">Arus Rata2</span>
                        <span className="text-xs sm:text-sm font-black text-slate-800 dark:text-slate-100">{iAvg.toFixed(1)} A</span>
                      </div>
                      <div className="flex flex-col p-2 rounded-lg bg-slate-50/80 dark:bg-slate-800/50">
                        <span className="text-[10px] text-slate-400 font-sans font-bold uppercase tracking-wider">Power Factor</span>
                        <span className="text-xs sm:text-sm font-black text-emerald-500">{pf.toFixed(2)}</span>
                      </div>
                      <div className="flex flex-col p-2 rounded-lg bg-slate-50/80 dark:bg-slate-800/50">
                        <span className="text-[10px] text-slate-400 font-sans font-bold uppercase tracking-wider">Energi</span>
                        <span className="text-xs sm:text-sm font-black text-purple-400">
                          {pm.active_energy !== null && pm.active_energy !== undefined
                            ? Math.round(Number(pm.active_energy)).toLocaleString("id-ID")
                            : "—"}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Card Actions / Reorder Buttons */}
                  {isEditingPosition ? (
                    <div className="mt-3 pt-2.5 border-t border-sky-200 dark:border-sky-800/50 flex items-center justify-between gap-1.5">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleMoveDirection(pm.pm_id, "left");
                        }}
                        className="px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-700 hover:bg-sky-50 text-slate-700 dark:text-slate-200 text-xs font-bold border border-slate-300 dark:border-slate-600 transition flex items-center gap-1 cursor-pointer"
                        title="Geser posisi kartu ke kiri"
                      >
                        <span>◀</span>
                        <span>Kiri</span>
                      </button>
                      <span className="text-[10px] text-sky-500 font-extrabold uppercase">Atur</span>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleMoveDirection(pm.pm_id, "right");
                        }}
                        className="px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-700 hover:bg-sky-50 text-slate-700 dark:text-slate-200 text-xs font-bold border border-slate-300 dark:border-slate-600 transition flex items-center gap-1 cursor-pointer"
                        title="Geser posisi kartu ke kanan"
                      >
                        <span>Kanan</span>
                        <span>▶</span>
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedPmId(pm.pm_id);
                      }}
                      className="w-full mt-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 group-hover:border-sky-500/40 text-xs font-black text-slate-500 group-hover:text-sky-500 dark:group-hover:text-sky-400 bg-slate-50 dark:bg-slate-800/30 group-hover:bg-sky-500/10 transition-all text-center cursor-pointer"
                    >
                      DETAIL PARAMETER ▾
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Detail Modal */}
      {selectedPm && (
        <PmDetailModal
          pm={selectedPm}
          onClose={() => setSelectedPmId(null)}
          isDark={isDark}
        />
      )}
    </section>
  );
}
