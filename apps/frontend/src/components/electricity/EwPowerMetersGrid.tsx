import { useMemo, useState } from "react";
import { PmDetailModal } from "./PmDetailModal";
import type { ElectricPmItem } from "./PmDetailModal";
import { getPmInfo, getPmSortIndex } from "../../data/pmMapping";

type Props = {
  powerMeters: ElectricPmItem[];
  isDark: boolean;
  groupId?: string;
  title?: string;
};

const NO_REALTIME_API = "API Realtime Belum Tersedia";

export function EwPowerMetersGrid({
  powerMeters,
  isDark,
  groupId = "EW23",
  title = "Sub-Distribution Machine Telemetry"
}: Props) {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedPmId, setSelectedPmId] = useState<string | null>(null);
  const selectedPm = useMemo(
    () => powerMeters.find((p) => p.pm_id === selectedPmId) ?? null,
    [powerMeters, selectedPmId]
  );

  const filtered = useMemo(() => {
    return [...powerMeters]
      .filter((pm) => {
        const info = getPmInfo(pm.pm_id);
        const term = searchTerm.toLowerCase();
        return (
          pm.pm_id.toLowerCase().includes(term) ||
          info.name.toLowerCase().includes(term) ||
          info.model.toLowerCase().includes(term) ||
          (info.category && info.category.toLowerCase().includes(term))
        );
      })
      .sort((a, b) => getPmSortIndex(a.pm_id) - getPmSortIndex(b.pm_id));
  }, [powerMeters, searchTerm]);

  const onlineCount = powerMeters.filter((pm) => pm.status !== false).length;

  return (
    <section className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm overflow-hidden">
      {/* Header Bar */}
      <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3 bg-slate-50/50 dark:bg-slate-800/20">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-xl bg-sky-500/10 border border-sky-500/20 flex items-center justify-center text-sky-500 text-sm">
            ⚡
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-xs font-extrabold uppercase tracking-wider text-slate-800 dark:text-white">
                {title} ({groupId.toUpperCase()})
              </h3>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-sky-500/10 text-sky-500 border border-sky-500/20">
                {onlineCount}/{powerMeters.length} Online
              </span>
            </div>
            <p className="text-[10px] text-slate-400 font-medium">
              Monitoring beban daya dan kualitas listrik per unit mesin/panel sub-distribusi
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* Quick Total Load Badge */}
          <div className="px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 shadow-sm flex items-center gap-2">
            <span className="text-[10px] font-extrabold uppercase text-slate-400">Total Beban:</span>
            <span className="text-[10px] font-extrabold text-amber-500">
              {NO_REALTIME_API}
            </span>
          </div>

          {/* Search Input */}
          <div className="relative">
            <input
              type="text"
              placeholder="Cari Mesin / PM (cth: Chiller, AHU)..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="px-3 py-1.5 pl-8 text-xs rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-sky-500 w-60"
            />
            <span className="absolute left-2.5 top-2 text-slate-400 text-xs">🔍</span>
          </div>
        </div>
      </div>

      {/* Grid of Power Meters */}
      <div className="p-6">
        {filtered.length === 0 ? (
          <div className="text-center py-10 text-slate-400 text-xs">
            Tidak ada mesin/Power Meter yang sesuai dengan kata kunci pencarian.
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3.5">
            {filtered.map((pm) => {
              const info = getPmInfo(pm.pm_id);
              const isOnline = pm.status !== false;
              const hasActivePower = pm.active_power_total !== null && pm.active_power_total !== undefined;
              const hasPf = pm.power_factor !== null && pm.power_factor !== undefined;
              const hasVoltLl = pm.volt_ll !== null && pm.volt_ll !== undefined;
              const hasEnergy = pm.active_energy !== null && pm.active_energy !== undefined;

              return (
                <div
                  key={pm.pm_id}
                  onClick={() => setSelectedPmId(pm.pm_id)}
                  className="p-3.5 rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-800/40 hover:border-sky-500/40 hover:shadow-lg hover:shadow-sky-500/5 transition-all cursor-pointer group flex flex-col justify-between"
                >
                  {/* Card Header */}
                  <div>
                    <div className="flex items-start justify-between gap-1 mb-1.5">
                      <div className="min-w-0">
                        <h4 className="text-xs font-black text-slate-800 dark:text-slate-100 group-hover:text-sky-500 transition-colors leading-snug line-clamp-2">
                          {info.name}
                        </h4>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          <span className="text-[10px] font-bold font-mono text-slate-400">
                            {pm.pm_id}
                          </span>
                          <span className="text-[9px] font-extrabold px-1.5 py-0.2 rounded bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-300">
                            {info.model}
                          </span>
                        </div>
                      </div>
                      <span
                        className={`shrink-0 inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[9px] font-bold ${
                          isOnline
                            ? "bg-emerald-500/10 text-emerald-500 border border-emerald-500/20"
                            : "bg-rose-500/10 text-rose-500 border border-rose-500/20"
                        }`}
                      >
                        <span
                          className={`w-1 h-1 rounded-full ${
                            isOnline ? "bg-emerald-500 animate-pulse" : "bg-rose-500"
                          }`}
                        />
                        {isOnline ? "LIVE" : "OFF"}
                      </span>
                    </div>

                    {/* Main Metric: Active Power */}
                    <div className="my-2 p-2 rounded-xl bg-slate-50 dark:bg-slate-800/70 border border-slate-100 dark:border-slate-700/50">
                      <span className="text-[9px] font-bold uppercase text-slate-400 block mb-0.5">
                        Active Power
                      </span>
                      {hasActivePower ? (
                        <div className="flex items-baseline gap-1">
                          <span className="text-lg font-black font-mono text-sky-500 tracking-tight">
                            {Number(pm.active_power_total).toFixed(1)}
                          </span>
                          <span className="text-[10px] font-bold text-slate-400">kW</span>
                        </div>
                      ) : (
                        <span className="text-[9px] font-bold text-amber-500 leading-tight block">
                          {NO_REALTIME_API}
                        </span>
                      )}
                    </div>

                    {/* Secondary Metrics */}
                    <div className="grid grid-cols-2 gap-1.5 text-[10px] font-mono">
                      <div className="flex flex-col p-1.5 rounded-lg bg-slate-50/70 dark:bg-slate-800/40">
                        <span className="text-[8px] text-slate-400 font-sans font-bold uppercase">Tegangan</span>
                        {hasVoltLl ? (
                          <span className="font-extrabold text-slate-700 dark:text-slate-200">
                            {Number(pm.volt_ll).toFixed(0)} V
                          </span>
                        ) : (
                          <span className="font-sans text-[8px] font-bold text-amber-500 leading-tight">
                            {NO_REALTIME_API}
                          </span>
                        )}
                      </div>
                      <div className="flex flex-col p-1.5 rounded-lg bg-slate-50/70 dark:bg-slate-800/40">
                        <span className="text-[8px] text-slate-400 font-sans font-bold uppercase">Arus Rata2</span>
                        <span className="font-sans text-[8px] font-bold text-amber-500 leading-tight">
                          {NO_REALTIME_API}
                        </span>
                      </div>
                      <div className="flex flex-col p-1.5 rounded-lg bg-slate-50/70 dark:bg-slate-800/40">
                        <span className="text-[8px] text-slate-400 font-sans font-bold uppercase">Power Factor</span>
                        {hasPf ? (
                          <span className="font-extrabold text-emerald-500">
                            {Number(pm.power_factor).toFixed(2)}
                          </span>
                        ) : (
                          <span className="font-sans text-[8px] font-bold text-amber-500 leading-tight">
                            {NO_REALTIME_API}
                          </span>
                        )}
                      </div>
                      <div className="flex flex-col p-1.5 rounded-lg bg-slate-50/70 dark:bg-slate-800/40">
                        <span className="text-[8px] text-slate-400 font-sans font-bold uppercase">Energi</span>
                        {hasEnergy ? (
                          <span className="font-extrabold text-purple-400">
                            {Math.round(Number(pm.active_energy)).toLocaleString("id-ID")}
                          </span>
                        ) : (
                          <span className="font-sans text-[8px] font-bold text-amber-500 leading-tight">
                            {NO_REALTIME_API}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Card Action */}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedPmId(pm.pm_id);
                    }}
                    className="w-full mt-2.5 py-1 rounded-lg border border-slate-200 dark:border-slate-700 group-hover:border-sky-500/40 text-[9px] font-bold text-slate-400 group-hover:text-sky-500 dark:group-hover:text-sky-400 bg-slate-50/50 dark:bg-slate-800/30 group-hover:bg-sky-500/5 transition-all text-center"
                  >
                    DETAIL PARAMETER ▾
                  </button>
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
