import { useState, useEffect } from "react";
import { useAlarmStore } from "../../store/alarm.store";
import { useSystemStore } from "../../store/system.store";
import { useAuthStore } from "../../store/auth.store";
import { UserMenu } from "./UserMenu";

export const Topbar = () => {
  const socketStatus = useSystemStore((state) => state.socketStatus);
  const theme = useSystemStore((state) => state.theme);
  const toggleTheme = useSystemStore((state) => state.toggleTheme);
  const fullName = useAuthStore((state) => state.user?.name ?? "User");
  const activeAlarms = useAlarmStore(
    (state) => state.activeList.filter((alarm) => alarm.status !== "ack").length
  );
  const statusLabel = socketStatus === "connected" ? "Realtime Online" : "Realtime Offline";
  const [usdToIdr, setUsdToIdr] = useState(16200);
  const [timeStr, setTimeStr] = useState("");

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      const optionsDate: Intl.DateTimeFormatOptions = { weekday: "long", year: "numeric", month: "long", day: "numeric" };
      const dateString = now.toLocaleDateString("id-ID", optionsDate);
      const timeString = now.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
      setTimeStr(`${dateString} | ${timeString}`);
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    fetch("https://api.exchangerate.host/latest?base=USD&symbols=IDR")
      .then((res) => res.json())
      .then((data) => {
        const rate = data?.rates?.IDR;
        if (typeof rate === "number") {
          setUsdToIdr(rate);
        }
      })
      .catch(() => undefined);
  }, []);

  const displayName = fullName
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .join(" ");

  return (
    <div className="sticky top-0 z-10 flex flex-col gap-3 border-b border-[#acd3ff] dark:border-slate-800 bg-white dark:bg-slate-900 px-5 py-3 lg:flex-row lg:items-start lg:justify-between lg:px-6 transition-colors duration-300">
      <div className="min-w-0">
        <div className="text-xl font-semibold text-[#002b5c] dark:text-slate-100">
          Halo, {displayName}!
        </div>
        <div className="mt-1 truncate text-base font-semibold text-[#002b5c] dark:text-slate-200">
          WIDATRA EMS | Industrial SCADA Dashboard
        </div>
        <div className="mt-0.5 text-xs text-[#47729f] dark:text-slate-400">
          Plant Operations & Utilities | Local Network
        </div>
      </div>
      <div className="flex flex-wrap items-center justify-end gap-3 text-xs">
        {/* Gateway connection status */}
        <div className="flex items-center gap-2 text-[#1f6fb5] dark:text-sky-400 font-semibold">
          <span
            className={[
              "h-2.5 w-2.5 rounded-full",
              socketStatus === "connected" ? "bg-[#2fa981]" : "bg-[#b42318]"
            ].join(" ")}
          />
          {statusLabel}
        </div>
        <div
          className={[
            "rounded-full border px-3 py-1.5 font-medium",
            socketStatus === "connected"
              ? "border-[#9ed9c1] dark:border-emerald-800/40 bg-[#dff4ea] dark:bg-emerald-950/20 text-[#087f5b] dark:text-emerald-400"
              : "border-[#f5aa99] dark:border-rose-800/40 bg-[#ffe6df] dark:bg-rose-950/20 text-[#b42318] dark:text-rose-400"
          ].join(" ")}
        >
          {socketStatus === "connected" ? "Gateway Connected" : "Gateway Offline"}
        </div>

        {/* Alarm counter */}
        <div className="rounded-full border border-[#acd3ff] dark:border-slate-700 bg-[#e8f3ff] dark:bg-slate-800 px-3 py-1.5 text-[#003b75] dark:text-slate-300 font-medium">
          {activeAlarms} Active Alarms
        </div>

        {/* Currency Widget */}
        <div className="rounded-full border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60 px-3 py-1.5 text-slate-700 dark:text-slate-300 font-medium flex items-center gap-1.5">
          <span className="text-slate-400">USD/IDR</span>
          <span className="font-mono text-blue-600 dark:text-sky-400">
            Rp {usdToIdr.toLocaleString("id-ID", { maximumFractionDigits: 0 })}
          </span>
          <span className="text-[10px] text-emerald-500 font-bold">▲</span>
        </div>

        {/* Dark Mode Toggle */}
        <button
          type="button"
          onClick={toggleTheme}
          className="rounded-full border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 p-2 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 transition"
          aria-label="Toggle theme"
        >
          {theme === "light" ? (
            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
            </svg>
          ) : (
            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="5" /><line x1="12" y1="1" x2="12" y2="3" /><line x1="12" y1="21" x2="12" y2="23" /><line x1="4.22" y1="4.22" x2="5.64" y2="5.64" /><line x1="18.36" y1="18.36" x2="19.78" y2="19.78" /><line x1="1" y1="12" x2="3" y2="12" /><line x1="21" y1="12" x2="23" y2="12" /><line x1="4.22" y1="19.78" x2="5.64" y2="18.36" /><line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
            </svg>
          )}
        </button>

        {/* Realtime clock display */}
        <div className="rounded-full bg-[#1f6fb5] dark:bg-sky-950/40 border border-[#1f6fb5] dark:border-sky-800/40 px-3.5 py-1.5 font-medium text-white dark:text-sky-400 font-mono">
          {timeStr}
        </div>
        <UserMenu />
      </div>
    </div>
  );
};

