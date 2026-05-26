import { useAlarmStore } from "../../store/alarm.store";
import { useSystemStore } from "../../store/system.store";
import { useAuthStore } from "../../store/auth.store";
import { UserMenu } from "./UserMenu";

export const Topbar = () => {
  const socketStatus = useSystemStore((state) => state.socketStatus);
  const fullName = useAuthStore((state) => state.user?.name ?? "User");
  const activeAlarms = useAlarmStore(
    (state) => state.activeList.filter((alarm) => alarm.status !== "ack").length
  );
  const statusLabel = socketStatus === "connected" ? "Realtime Online" : "Realtime Offline";

  const displayName = fullName
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .join(" ");

  return (
    <div className="sticky top-0 z-10 flex flex-col gap-3 border-b border-[#acd3ff] bg-white px-5 py-3 lg:flex-row lg:items-start lg:justify-between lg:px-6">
      <div className="min-w-0">
        <div className="text-xl font-semibold text-[#002b5c]">
          Halo, {displayName}!
        </div>
        <div className="mt-1 truncate text-base font-semibold text-[#002b5c]">
          WIDATRA EMS | Industrial SCADA Dashboard
        </div>
        <div className="mt-0.5 text-xs text-[#47729f]">
          Utilities, Water System, Boiler, Compressor | Local Plant Network
        </div>
      </div>
      <div className="flex flex-wrap items-center justify-end gap-3 text-xs">
        <div className="flex items-center gap-2 text-[#1f6fb5]">
          <span
            className={[
              "h-2 w-2 rounded-full",
              socketStatus === "connected" ? "bg-[#2fa981]" : "bg-[#b42318]"
            ].join(" ")}
          />
          {statusLabel}
        </div>
        <div
          className={[
            "rounded-full border px-3 py-1.5",
            socketStatus === "connected"
              ? "border-[#9ed9c1] bg-[#dff4ea] text-[#087f5b]"
              : "border-[#f5aa99] bg-[#ffe6df] text-[#b42318]"
          ].join(" ")}
        >
          {socketStatus === "connected" ? "Gateway Connected" : "Gateway Offline"}
        </div>
        <div className="rounded-full border border-[#acd3ff] bg-[#e8f3ff] px-3 py-1.5 text-[#003b75]">
          {activeAlarms} Active Alarms
        </div>
        <div className="rounded-full bg-[#1f6fb5] px-3 py-1.5 font-medium text-white">
          Mei 2026
        </div>
        <UserMenu />
      </div>
    </div>
  );
};
