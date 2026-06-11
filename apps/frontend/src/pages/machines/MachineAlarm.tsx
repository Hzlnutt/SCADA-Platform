import { useState, useMemo } from "react";
import { useOutletContext } from "react-router-dom";
import { getUnitById } from "../../data/machines";
import type { MachineOutletContext } from "./MachineLayout";

type AlarmLogItem = {
  id: string;
  timestamp: string;
  priority: "Critical" | "Major" | "Warning" | "Minor" | "Info";
  description: string;
  equipment: string;
  operatorAction: string;
  ack: boolean;
  rtn: string;
};

const INITIAL_ALARMS: AlarmLogItem[] = [
  { id: "1", timestamp: "03-14 08:42:11", priority: "Critical", description: "Reference Room Temp High (42.4°C)", equipment: "AHU-02", operatorAction: "Check Heater SSR", ack: false, rtn: "—" },
  { id: "2", timestamp: "03-14 08:31:05", priority: "Major", description: "CU-03B Compressor Trip", equipment: "AHU-03 / CU-03B", operatorAction: "Inspect overload relay", ack: false, rtn: "—" },
  { id: "3", timestamp: "03-14 07:58:44", priority: "Warning", description: "Pre-Filter Differential Pressure High", equipment: "AHU-02", operatorAction: "Schedule replacement", ack: true, rtn: "09:12:00" },
  { id: "4", timestamp: "03-14 07:12:03", priority: "Minor", description: "Humidifier water tank level low", equipment: "AHU-03", operatorAction: "Refill RO water", ack: true, rtn: "07:40:22" },
  { id: "5", timestamp: "03-14 06:20:18", priority: "Info", description: "AHU-01 switched to Auto Mode", equipment: "AHU-01", operatorAction: "—", ack: true, rtn: "06:20:18" },
  { id: "6", timestamp: "03-14 04:02:57", priority: "Major", description: "Supply Fan VFD Fault", equipment: "AHU-03", operatorAction: "Reset VFD", ack: true, rtn: "04:22:09" },
  { id: "7", timestamp: "03-13 22:11:30", priority: "Warning", description: "Communication loss to RTD-01-A", equipment: "AHU-01", operatorAction: "Check cable / loop", ack: true, rtn: "22:18:45" },
  { id: "8", timestamp: "03-13 19:45:12", priority: "Minor", description: "Condensate drain slow", equipment: "AHU-01", operatorAction: "Clean trap", ack: true, rtn: "08:00:00" },
  { id: "9", timestamp: "03-13 15:03:00", priority: "Critical", description: "Stability Room Humidity Low (68.1%RH)", equipment: "AHU-03", operatorAction: "Inspect humidifier", ack: true, rtn: "15:41:09" },
  { id: "10", timestamp: "03-13 10:22:47", priority: "Info", description: "Preventive Maintenance reminder — AHU-02 Fan", equipment: "AHU-02", operatorAction: "—", ack: true, rtn: "10:22:47" }
];

const PRIORITY_ORDER: Record<AlarmLogItem["priority"], number> = {
  Critical: 1,
  Major: 2,
  Warning: 3,
  Minor: 4,
  Info: 5
};

const badgeStyle: Record<AlarmLogItem["priority"], string> = {
  Critical: "bg-rose-500/15 text-rose-500 border border-rose-500/35",
  Major: "bg-orange-500/15 text-orange-500 border border-orange-500/35",
  Warning: "bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/35",
  Minor: "bg-sky-500/15 text-sky-500 border border-sky-500/35",
  Info: "bg-emerald-500/15 text-emerald-500 border border-emerald-500/35"
};

export default function MachineAlarm() {
  const { unitId } = useOutletContext<MachineOutletContext>();
  const machine = getUnitById(unitId);

  const [alarms, setAlarms] = useState<AlarmLogItem[]>(INITIAL_ALARMS);
  const [filter, setFilter] = useState<string>("All");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Filter and sort alarms based on active category and priority weight (ascending)
  const processedAlarms = useMemo(() => {
    let result = [...alarms];

    // Filter by priority
    if (filter !== "All") {
      result = result.filter((item) => item.priority === filter);
    }

    // Sort ascending by priority weight (Critical = 1 first)
    result.sort((a, b) => PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority]);

    return result;
  }, [alarms, filter]);

  // Handle single selection checkbox
  const handleSelectToggle = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  // Handle Select All toggle
  const handleSelectAllToggle = () => {
    if (selectedIds.size === processedAlarms.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(processedAlarms.map((item) => item.id)));
    }
  };

  // Acknowledge selected alarms
  const handleAckSelected = () => {
    if (selectedIds.size === 0) return;
    setAlarms((prev) =>
      prev.map((alarm) => {
        if (selectedIds.has(alarm.id) && !alarm.ack) {
          const nowTime = new Date().toTimeString().split(" ")[0];
          return {
            ...alarm,
            ack: true,
            rtn: nowTime
          };
        }
        return alarm;
      })
    );
    setSelectedIds(new Set());
  };

  // Export visible alarms list to CSV file
  const handleExport = () => {
    const headers = ["Timestamp", "Priority", "Description", "Equipment", "Operator Action", "Ack", "RTN"];
    const rows = processedAlarms.map((item) => [
      item.timestamp,
      item.priority,
      item.description,
      item.equipment,
      item.operatorAction,
      item.ack ? "Yes" : "No",
      item.rtn
    ]);

    const csvContent = [headers.join(","), ...rows.map((r) => r.map((val) => `"${val}"`).join(","))].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.setAttribute("download", `alarm_log_${machine?.id ?? "machine"}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  if (!machine) return null;

  return (
    <div className="space-y-6">
      {/* Filters & Actions Bar */}
      <div className="flex flex-wrap items-center justify-between gap-4 bg-[#f7fbff]/80 dark:bg-slate-950/70 border border-[#acd3ff] dark:border-slate-800 rounded-xl p-4 transition-colors duration-300 backdrop-blur-md">
        {/* Severity Filters */}
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-bold text-[#47729f] dark:text-slate-500 mr-1 flex items-center gap-1">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
            </svg>
            FILTER:
          </span>
          {["All", "Critical", "Major", "Minor", "Warning", "Info"].map((p) => (
            <button
              key={p}
              onClick={() => {
                setFilter(p);
                setSelectedIds(new Set());
              }}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg border transition duration-200 ${
                filter === p
                  ? "bg-[#1f6fb5] text-white border-transparent shadow-sm shadow-[#1f6fb5]/25"
                  : "text-[#002b5c] dark:text-slate-400 border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900/30 hover:bg-[#1f6fb5]/10 dark:hover:bg-[#1f6fb5]/20"
              }`}
            >
              {p}
            </button>
          ))}
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-3">
          <button
            onClick={handleAckSelected}
            disabled={selectedIds.size === 0}
            className={`flex items-center gap-1.5 px-4 py-2 text-xs font-bold rounded-lg border transition duration-200 ${
              selectedIds.size > 0
                ? "bg-emerald-500 hover:bg-emerald-600 border-transparent text-white shadow-md shadow-emerald-500/20"
                : "bg-slate-100 dark:bg-slate-900/40 border-slate-200 dark:border-slate-800 text-slate-400 dark:text-slate-600 cursor-not-allowed"
            }`}
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            Ack Selected ({selectedIds.size})
          </button>
          <button
            onClick={handleExport}
            className="flex items-center gap-1.5 px-4 py-2 text-xs font-bold rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/50 hover:bg-[#1f6fb5]/10 dark:hover:bg-[#1f6fb5]/20 text-[#002b5c] dark:text-slate-300 transition duration-200"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
            Export CSV
          </button>
        </div>
      </div>

      {/* Alarm Log Grid Container */}
      <div className="bg-white dark:bg-slate-950 border border-[#acd3ff] dark:border-slate-800 rounded-xl p-5 shadow-sm transition-colors duration-300">
        <div className="mb-4 border-b border-[#acd3ff]/30 pb-3 flex items-center justify-between">
          <h3 className="text-base font-bold text-[#002b5c] dark:text-slate-100 uppercase tracking-wide flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-rose-500 animate-pulse" />
            Alarm Log <span className="text-xs text-slate-400 font-mono">ISA-18.2 Alarm Management</span>
          </h3>
          <span className="text-xs font-mono text-[#47729f] dark:text-slate-500">
            Active Alarms Sorted by Priority
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-[#acd3ff]/50 dark:border-slate-800/50 text-[10px] uppercase tracking-wider text-[#47729f] dark:text-slate-500 font-bold">
                <th className="pb-3 px-3 w-10">
                  <input
                    type="checkbox"
                    checked={processedAlarms.length > 0 && selectedIds.size === processedAlarms.length}
                    onChange={handleSelectAllToggle}
                    className="rounded border-slate-300 text-[#1f6fb5] focus:ring-[#1f6fb5]"
                  />
                </th>
                <th className="pb-3 px-3">Timestamp</th>
                <th className="pb-3 px-3">Priority</th>
                <th className="pb-3 px-3">Description</th>
                <th className="pb-3 px-3">Equipment</th>
                <th className="pb-3 px-3">Operator Action</th>
                <th className="pb-3 px-3 text-center">Ack</th>
                <th className="pb-3 px-3 text-right">RTN</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-900 font-medium text-[#002b5c] dark:text-slate-300">
              {processedAlarms.map((row) => (
                <tr
                  key={row.id}
                  className={`hover:bg-[#1f6fb5]/5 dark:hover:bg-[#1f6fb5]/10 transition-colors ${
                    !row.ack ? "bg-rose-500/[0.02] dark:bg-rose-500/[0.04]" : ""
                  }`}
                >
                  <td className="py-3 px-3">
                    <input
                      type="checkbox"
                      checked={selectedIds.has(row.id)}
                      onChange={() => handleSelectToggle(row.id)}
                      className="rounded border-slate-300 text-[#1f6fb5] focus:ring-[#1f6fb5]"
                    />
                  </td>
                  <td className="py-3 px-3 font-mono text-[11px] text-[#47729f] dark:text-slate-500">
                    {row.timestamp}
                  </td>
                  <td className="py-3 px-3">
                    <span className={`inline-block text-[8px] font-extrabold uppercase px-2 py-0.5 rounded-md ${badgeStyle[row.priority]}`}>
                      {row.priority}
                    </span>
                  </td>
                  <td className={`py-3 px-3 text-[11px] font-bold ${!row.ack ? "text-rose-600 dark:text-rose-400" : ""}`}>
                    {row.description}
                  </td>
                  <td className="py-3 px-3 text-slate-500 dark:text-slate-400">{row.equipment}</td>
                  <td className="py-3 px-3 font-semibold text-slate-600 dark:text-slate-300">{row.operatorAction}</td>
                  <td className="py-3 px-3 text-center">
                    <span className={`inline-flex items-center gap-1 font-bold ${
                      row.ack ? "text-emerald-500" : "text-amber-500"
                    }`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${row.ack ? "bg-emerald-500" : "bg-amber-500 animate-ping"}`} />
                      {row.ack ? "Yes" : "No"}
                    </span>
                  </td>
                  <td className="py-3 px-3 text-right font-mono text-[11px] text-[#47729f] dark:text-slate-500">
                    {row.rtn}
                  </td>
                </tr>
              ))}
              {processedAlarms.length === 0 && (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-[#47729f] dark:text-slate-500 font-semibold italic">
                    No alarms found matching the filter criteria.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
