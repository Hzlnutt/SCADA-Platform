import type { AnomalyEvent } from "./pmHealth.types";
import { anomalyTypeMeta, fmtDelta, fmtNumber } from "./pmHealth.utils";

export function PmAnomalyToastStack({
  toasts,
  onDismiss,
  onInspectPm
}: {
  toasts: AnomalyEvent[];
  onDismiss: (id: string) => void;
  onInspectPm: (pmId: string) => void;
}) {
  if (toasts.length === 0) return null;

  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2.5 w-[calc(100vw-2rem)] sm:w-[390px] pointer-events-none">
      {toasts.slice(0, 4).map((ev) => {
        const meta = anomalyTypeMeta(ev.type);
        return (
          <div
            key={ev.id}
            className="pointer-events-auto rounded-2xl border border-rose-500/30 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md shadow-2xl shadow-rose-500/10 p-4 transition-all"
          >
            <div className="flex items-start justify-between gap-2.5">
              <div className="flex items-start gap-2.5 min-w-0">
                <div className="mt-0.5 p-2 rounded-xl bg-rose-500/15 text-rose-600 dark:text-rose-400 flex-shrink-0">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.2">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
                  </svg>
                </div>
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="px-1.5 py-0.5 rounded bg-rose-500 text-white font-mono text-[10px] font-extrabold">
                      {ev.pmId}
                    </span>
                    <span className="text-xs font-extrabold text-slate-900 dark:text-white truncate">
                      {ev.pmName}
                    </span>
                  </div>
                  <p className="mt-1 text-[11px] font-semibold text-rose-600 dark:text-rose-400">
                    {meta.label}
                  </p>
                  <p className="mt-1 text-[11px] font-mono text-slate-600 dark:text-slate-300">
                    {ev.date} <span className="font-bold">{ev.time}</span> WIB
                  </p>
                  <p className="mt-0.5 text-[11px] font-mono text-slate-500 dark:text-slate-400">
                    {fmtNumber(ev.prevEnergy, 2)} → {fmtNumber(ev.currEnergy, 2)} kWh (
                    <span className="font-bold text-rose-600 dark:text-rose-400">{fmtDelta(ev.deltaEnergy)}</span>)
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => onDismiss(ev.id)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                aria-label="Tutup notifikasi"
              >
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.4">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="mt-3 pt-2.5 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between gap-2 text-[11px]">
              <span className="text-slate-400 truncate">
                {ev.factory} • {ev.area}
              </span>
              <button
                type="button"
                onClick={() => {
                  onInspectPm(ev.pmId);
                  onDismiss(ev.id);
                }}
                className="inline-flex items-center gap-1 font-bold text-sky-600 dark:text-sky-400 hover:underline flex-shrink-0 cursor-pointer"
              >
                <span>Lihat Grafik</span>
                <span>→</span>
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
