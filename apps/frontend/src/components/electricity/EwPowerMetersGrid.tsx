import { useState } from "react";
import { PmDetailModal } from "./PmDetailModal";
import type { ElectricPmItem } from "./PmDetailModal";

type Props = {
  powerMeters: ElectricPmItem[];
  isDark: boolean;
  groupId?: string;
  title?: string;
};

export function EwPowerMetersGrid({
  powerMeters,
  isDark,
  groupId = "EW23",
  title = "Sub-Distribution Power Meters Telemetry"
}: Props) {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedPm, setSelectedPm] = useState<ElectricPmItem | null>(null);

  const filtered = powerMeters.filter((pm) =>
    pm.pm_id.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const totalKw = powerMeters.reduce((sum, pm) => sum + (Number(pm.active_power_total) || 0), 0);
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
              Data telemetri langsung dari Power Meter sub-distribusi via Ignition SCADA
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* Quick Total Load Badge */}
          <div className="px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 shadow-sm flex items-center gap-2">
            <span className="text-[10px] font-extrabold uppercase text-slate-400">Total Daya:</span>
            <span className="text-xs font-extrabold font-mono text-sky-500">
              {totalKw.toFixed(1)} <span className="text-[10px] font-bold text-slate-400">kW</span>
            </span>
          </div>

          {/* Search Input */}
          <div className="relative">
            <input
              type="text"
              placeholder="Cari PM (cth: PM327)..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="px-3 py-1.5 pl-8 text-xs rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-sky-500 w-44"
            />
            <span className="absolute left-2.5 top-2 text-slate-400 text-xs">🔍</span>
          </div>
        </div>
      </div>

      {/* Grid of Power Meters */}
      <div className="p-6">
        {filtered.length === 0 ? (
          <div className="text-center py-10 text-slate-400 text-xs">
            Tidak ada Power Meter yang sesuai dengan kata kunci pencarian.
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3.5">
            {filtered.map((pm) => {
              const isOnline = pm.status !== false;
              const pKw = Number(pm.active_power_total) || 0;
              const pf = Number(pm.power_factor) || 0;
              const vL = Number(pm.volt_ab) || Number(pm.volt_ll) || 380;
              const iAvg = ((Number(pm.current_a) || 0) + (Number(pm.current_b) || 0) + (Number(pm.current_c) || 0)) / 3;

              return (
                <div
                  key={pm.pm_id}
                  onClick={() => setSelectedPm(pm)}
                  className="p-3.5 rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-800/40 hover:border-sky-500/40 hover:shadow-lg hover:shadow-sky-500/5 transition-all cursor-pointer group flex flex-col justify-between"
                >
                  {/* Card Header */}
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs font-black font-mono text-slate-800 dark:text-slate-100 group-hover:text-sky-500 transition-colors">
                          {pm.pm_id}
                        </span>
                      </div>
                      <span
                        className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[9px] font-bold ${
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
                    <div className="my-2.5 p-2 rounded-xl bg-slate-50 dark:bg-slate-800/70 border border-slate-100 dark:border-slate-700/50">
                      <span className="text-[9px] font-bold uppercase text-slate-400 block mb-0.5">
                        Active Power
                      </span>
                      <div className="flex items-baseline gap-1">
                        <span className="text-lg font-black font-mono text-sky-500 tracking-tight">
                          {pKw.toFixed(1)}
                        </span>
                        <span className="text-[10px] font-bold text-slate-400">kW</span>
                      </div>
                    </div>

                    {/* Secondary Metrics */}
                    <div className="grid grid-cols-2 gap-1.5 text-[10px] font-mono">
                      <div className="flex flex-col p-1.5 rounded-lg bg-slate-50/70 dark:bg-slate-800/40">
                        <span className="text-[8px] text-slate-400 font-sans font-bold uppercase">Tegangan</span>
                        <span className="font-extrabold text-slate-700 dark:text-slate-200">{vL.toFixed(0)} V</span>
                      </div>
                      <div className="flex flex-col p-1.5 rounded-lg bg-slate-50/70 dark:bg-slate-800/40">
                        <span className="text-[8px] text-slate-400 font-sans font-bold uppercase">Arus Rata2</span>
                        <span className="font-extrabold text-slate-700 dark:text-slate-200">{iAvg.toFixed(1)} A</span>
                      </div>
                      <div className="flex flex-col p-1.5 rounded-lg bg-slate-50/70 dark:bg-slate-800/40">
                        <span className="text-[8px] text-slate-400 font-sans font-bold uppercase">Power Factor</span>
                        <span className="font-extrabold text-emerald-500">{pf.toFixed(2)}</span>
                      </div>
                      <div className="flex flex-col p-1.5 rounded-lg bg-slate-50/70 dark:bg-slate-800/40">
                        <span className="text-[8px] text-slate-400 font-sans font-bold uppercase">Energi</span>
                        <span className="font-extrabold text-purple-400">{pm.active_energy ? Number(pm.active_energy).toFixed(0) : "—"}</span>
                      </div>
                    </div>
                  </div>

                  {/* Card Action */}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedPm(pm);
                    }}
                    className="w-full mt-3 py-1 rounded-lg border border-slate-200 dark:border-slate-700 group-hover:border-sky-500/40 text-[9px] font-bold text-slate-400 group-hover:text-sky-500 dark:group-hover:text-sky-400 bg-slate-50/50 dark:bg-slate-800/30 group-hover:bg-sky-500/5 transition-all text-center"
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
          onClose={() => setSelectedPm(null)}
          isDark={isDark}
        />
      )}
    </section>
  );
}
