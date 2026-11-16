import { useEffect, useState } from "react";

export interface Warehouse7AlarmToastData {
  id?: number;
  title: string;
  message: string;
  durationMs?: number;
}

interface Warehouse7AlarmToastProps {
  toast: Warehouse7AlarmToastData | null;
  onClose: () => void;
}

/**
 * Clean, modern floating SCADA alert toast for Warehouse 7 temperature violations and test alarms.
 */
export default function Warehouse7AlarmToast({ toast, onClose }: Warehouse7AlarmToastProps) {
  const [progressStarted, setProgressStarted] = useState(false);
  const durationMs = toast?.durationMs ?? 12000;

  useEffect(() => {
    if (!toast) {
      setProgressStarted(false);
      return;
    }
    setProgressStarted(false);
    const raf = requestAnimationFrame(() => {
      requestAnimationFrame(() => setProgressStarted(true));
    });
    return () => cancelAnimationFrame(raf);
  }, [toast?.id, toast?.title, toast?.message, durationMs]);

  if (!toast) return null;

  return (
    <div
      role="alert"
      aria-live="assertive"
      className="fixed bottom-4 left-3 right-3 sm:left-auto sm:bottom-6 sm:right-6 sm:w-[370px] max-w-full z-50 overflow-hidden rounded-2xl border border-slate-200/90 dark:border-slate-700/80 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md shadow-[0_14px_38px_-10px_rgba(15,23,42,0.28)] transition-all duration-300"
    >
      <div className="flex items-start gap-3 p-3.5 sm:p-4">
        {/* Clean pulsing bell badge */}
        <div className="relative flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-rose-500/10 text-rose-600 dark:bg-rose-500/15 dark:text-rose-400">
          <svg className="h-[18px] w-[18px]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
            />
          </svg>
          <span className="absolute -right-0.5 -top-0.5 flex h-2.5 w-2.5">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-rose-400 opacity-75" />
            <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-rose-500 ring-2 ring-white dark:ring-slate-900" />
          </span>
        </div>

        {/* Concise alert copy */}
        <div className="min-w-0 flex-1 pt-0.5">
          <div className="text-[11px] font-bold uppercase tracking-wider text-rose-600 dark:text-rose-400">
            {toast.title}
          </div>
          <div className="mt-0.5 text-[13px] font-semibold leading-snug text-slate-800 dark:text-slate-100">
            {toast.message}
          </div>
        </div>

        {/* Minimal close button */}
        <button
          type="button"
          onClick={onClose}
          className="shrink-0 rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800 dark:hover:text-slate-200 transition cursor-pointer"
          aria-label="Close notification"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.2">
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* Slim auto-dismiss accent bar */}
      <div className="h-0.5 w-full bg-rose-500/10">
        <div
          className="h-full bg-gradient-to-r from-rose-500 to-amber-500"
          style={{
            width: progressStarted ? "0%" : "100%",
            transition: progressStarted ? `width ${durationMs}ms linear` : "none"
          }}
        />
      </div>
    </div>
  );
}
