import { useState, useMemo, useEffect } from "react";
import { useOutletContext } from "react-router-dom";
import { getUnitById } from "../../data/machines";
import { useAuthStore } from "../../store/auth.store";
import { getDefaultEqConfigs } from "../../data/equipment";
import { getJson, postJson } from "../../services/api.client";
import type { MachineOutletContext } from "./MachineLayout";

type AlarmLogItem = {
  id: string;
  timestamp: string;
  rawTs?: string;
  description: string;
  equipment: string;
  operatorAction: string;
  status: "Active" | "Pending Approval" | "Resolved";
  rtn: string;
  operatorName?: string;
  approverName?: string;
};

const INITIAL_ALARMS: AlarmLogItem[] = [
  { id: "1", timestamp: "03-14 08:42:11", description: "Reference Room Temp High (42.4°C)", equipment: "AHU-02", operatorAction: "", status: "Active", rtn: "—", operatorName: "" },
  { id: "2", timestamp: "03-14 08:31:05", description: "CU-03B Compressor Trip", equipment: "AHU-03 / CU-03B", operatorAction: "", status: "Active", rtn: "—", operatorName: "" },
  { id: "3", timestamp: "03-14 07:58:44", description: "Pre-Filter Differential Pressure High", equipment: "AHU-02", operatorAction: "Scheduled replacement", status: "Resolved", rtn: "09:12:00", operatorName: "Agus Suprapto", approverName: "Hendro Wibowo" },
  { id: "4", timestamp: "03-14 07:12:03", description: "Humidifier water tank level low", equipment: "AHU-03", operatorAction: "Refill RO water", status: "Resolved", rtn: "07:40:22", operatorName: "Budi Santoso", approverName: "Agus Suprapto" },
  { id: "5", timestamp: "03-14 06:20:18", description: "AHU-01 switched to Auto Mode", equipment: "AHU-01", operatorAction: "—", status: "Resolved", rtn: "06:20:18", operatorName: "Eko Prasetyo", approverName: "System" },
  { id: "6", timestamp: "03-14 04:02:57", description: "Supply Fan VFD Fault", equipment: "AHU-03", operatorAction: "Reset VFD", status: "Resolved", rtn: "04:22:09", operatorName: "Hendro Wibowo", approverName: "Agus Suprapto" },
  { id: "7", timestamp: "03-13 22:11:30", description: "Communication loss to RTD-01-A", equipment: "AHU-01", operatorAction: "Check cable / loop", status: "Resolved", rtn: "22:18:45", operatorName: "Siti Aminah", approverName: "Budi Santoso" },
  { id: "8", timestamp: "03-13 19:45:12", description: "Condensate drain slow", equipment: "AHU-01", operatorAction: "Clean trap", status: "Resolved", rtn: "08:00:00", operatorName: "Agus Suprapto", approverName: "Hendro Wibowo" },
  { id: "9", timestamp: "03-13 15:03:00", description: "Stability Room Humidity Low (68.1%RH)", equipment: "AHU-03", operatorAction: "Inspect humidifier", status: "Resolved", rtn: "15:41:09", operatorName: "Budi Santoso", approverName: "Agus Suprapto" },
  { id: "10", timestamp: "03-13 10:22:47", description: "Preventive Maintenance reminder — AHU-02 Fan", equipment: "AHU-02", operatorAction: "—", status: "Resolved", rtn: "10:22:47", operatorName: "System", approverName: "System" }
];

const badgeStyle: Record<AlarmLogItem["status"], string> = {
  Active: "bg-rose-500/15 text-rose-500 border border-rose-500/35",
  "Pending Approval": "bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/35",
  Resolved: "bg-emerald-500/15 text-emerald-500 border border-emerald-500/35"
};

export default function MachineAlarm() {
  const { unitId } = useOutletContext<MachineOutletContext>();
  const machine = getUnitById(unitId);
  const user = useAuthStore((state) => state.user);
  const userRole = user?.role ?? "user";

  const [dbAlarms, setDbAlarms] = useState<AlarmLogItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [passwordInput, setPasswordInput] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [filter, setFilter] = useState<string>("All");
  const [selectedEquipment, setSelectedEquipment] = useState<string>("All");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [dateRange, setDateRange] = useState<{ startDate: string; endDate: string }>({
    startDate: "",
    endDate: ""
  });
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Role permissions checks
  const isKaShiftOrAbove = [
    "admin",
    "senior_unit_head",
    "unit_head",
    "kashift_utility_hvac",
    "kashift_utility",
    "kashift_hvac"
  ].includes(userRole);
  const isOperator = userRole === "operator";
  const canAck = isKaShiftOrAbove || isOperator;
  const canEditFinalized = isKaShiftOrAbove;

  // Acknowledgment Modal State
  const [ackModalOpen, setAckModalOpen] = useState(false);
  const [ackOperator, setAckOperator] = useState(user?.name ?? "");
  const [ackAction, setAckAction] = useState("");

  const [operatorsList, setOperatorsList] = useState<string[]>([]);

  // Fetch active operators/heads from backend database
  useEffect(() => {
    let mounted = true;
    getJson<{ data: Array<{ name: string }> }>("/users/operators")
      .then((res) => {
        if (mounted && res && res.data) {
          const names = res.data.map((u) => u.name);
          setOperatorsList(names);
        }
      })
      .catch((err) => {
        console.error("Failed to fetch operators list:", err);
      });
    return () => {
      mounted = false;
    };
  }, []);

  // Sync default select name with current logged-in user
  useEffect(() => {
    if (user?.name) {
      setAckOperator(user.name);
    } else if (operatorsList.length > 0 && !ackOperator) {
      setAckOperator(operatorsList[0]);
    }
  }, [user, operatorsList, ackOperator]);

  // Display fallback to current user if API list is not loaded yet
  const displayOperators = useMemo(() => {
    if (operatorsList.length > 0) {
      return operatorsList;
    }
    return user?.name ? [user.name] : [];
  }, [operatorsList, user]);

  // Edit Finalized Modal State
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editingAlarm, setEditingAlarm] = useState<AlarmLogItem | null>(null);
  const [editAction, setEditAction] = useState("");

  const fetchDbAlarms = () => {
    getJson<{ data: any[] }>(`/alarms/history?unit=${unitId}&limit=200`)
      .then((res) => {
        if (res && res.data) {
          const mapped: AlarmLogItem[] = res.data.map((item) => ({
            id: String(item.id),
            rawTs: item.lastTs,
            timestamp: new Date(item.lastTs).toLocaleString("en-US", { hour12: false }),
            description: item.message,
            equipment: item.tagId,
            operatorAction: item.operatorAction || "",
            status: item.status as "Active" | "Pending Approval" | "Resolved",
            rtn: item.rtn || "—",
            operatorName: item.operatorName || "",
            approverName: item.approverName || ""
          }));
          setDbAlarms(mapped);
        }
      })
      .catch((err) => console.error("Failed to load alarms:", err))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchDbAlarms();
    const interval = setInterval(fetchDbAlarms, 3000);
    setSelectedIds(new Set());
    return () => clearInterval(interval);
  }, [unitId]);

  // Load eqConfigs dynamically
  const eqConfigs = useMemo(() => {
    let configs = getDefaultEqConfigs(unitId);
    const savedEq = localStorage.getItem(`scada.config.eq.${unitId}`);
    if (savedEq) {
      try {
        configs = JSON.parse(savedEq);
      } catch (e) {}
    }
    return configs;
  }, [unitId]);

  const [loadTime] = useState(() => {
    const pad = (n: number) => String(n).padStart(2, "0");
    const now = new Date();
    return `${pad(now.getMonth() + 1)}-${pad(now.getDate())} ${pad(now.getHours())}:${pad(now.getMinutes())}:00`;
  });

  const dynamicAlarms = useMemo((): AlarmLogItem[] => {
    return eqConfigs
      .filter((item) => item.enableAlert && (item.runHoursBeforeMaintenance ?? item.baseline) >= item.highLimit)
      .map((item) => ({
        id: `maint-overdue-${item.tagKey}`,
        timestamp: loadTime,
        rawTs: new Date().toISOString(),
        description: `Maintenance Overdue: ${item.tagName} (${(item.runHoursBeforeMaintenance ?? item.baseline).toLocaleString()} / ${item.highLimit.toLocaleString()} hrs)`,
        equipment: item.tagKey,
        operatorAction: "",
        status: "Active" as const,
        rtn: "—",
        operatorName: "",
        approverName: ""
      }));
  }, [eqConfigs, loadTime]);

  // Extract unique equipment/item options for per-item filtering
  const equipmentOptions = useMemo(() => {
    const allItems = [...dynamicAlarms, ...dbAlarms];
    const uniqueEq = Array.from(new Set(allItems.map((item) => item.equipment).filter(Boolean)));
    return uniqueEq.sort();
  }, [dynamicAlarms, dbAlarms]);

  // Filter and sort alarms based on active category, item/equipment, date range, search query, and timestamp (descending)
  const processedAlarms = useMemo(() => {
    let result = [...dynamicAlarms, ...dbAlarms];

    // Filter by status
    if (filter !== "All") {
      result = result.filter((item) => item.status === filter);
    }

    // Filter by Item / Equipment
    if (selectedEquipment !== "All") {
      result = result.filter((item) => item.equipment === selectedEquipment);
    }

    // Filter by Search Query
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(
        (item) =>
          item.description.toLowerCase().includes(q) ||
          item.equipment.toLowerCase().includes(q) ||
          (item.operatorName && item.operatorName.toLowerCase().includes(q)) ||
          (item.operatorAction && item.operatorAction.toLowerCase().includes(q))
      );
    }

    // Filter by Date Range (Calendar)
    if (dateRange.startDate) {
      const startMs = new Date(dateRange.startDate + "T00:00:00").getTime();
      result = result.filter((item) => {
        const itemTime = item.rawTs ? new Date(item.rawTs).getTime() : new Date(item.timestamp).getTime();
        return !isNaN(itemTime) && itemTime >= startMs;
      });
    }

    if (dateRange.endDate) {
      const endMs = new Date(dateRange.endDate + "T23:59:59").getTime();
      result = result.filter((item) => {
        const itemTime = item.rawTs ? new Date(item.rawTs).getTime() : new Date(item.timestamp).getTime();
        return !isNaN(itemTime) && itemTime <= endMs;
      });
    }

    // Sort descending by timestamp (newest first)
    result.sort((a, b) => b.timestamp.localeCompare(a.timestamp));

    return result;
  }, [dbAlarms, dynamicAlarms, filter, selectedEquipment, searchQuery, dateRange]);

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

  // Handle Select All toggle (only for selectable Active alarms)
  const handleSelectAllToggle = () => {
    const activeAlarms = processedAlarms.filter((item) => item.status === "Active" && !item.id.startsWith("maint-overdue-"));
    if (selectedIds.size === activeAlarms.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(activeAlarms.map((item) => item.id)));
    }
  };

  // Open Acknowledge Dialog
  const handleAckClick = () => {
    if (selectedIds.size === 0) return;
    setAckAction("");
    setAckModalOpen(true);
  };

  // Submit Acknowledgment (Fix)
  const handleAckSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordError("");
    setSubmitting(true);

    try {
      const verifyRes = await postJson<{ valid: boolean }>("/auth/verify-password", {
        password: passwordInput
      });

      if (!verifyRes || !verifyRes.valid) {
        setPasswordError("Incorrect password. Please try again.");
        setSubmitting(false);
        return;
      }

      for (const id of selectedIds) {
        if (id.startsWith("maint-overdue-")) continue;
        await postJson(`/alarms/${id}/fix`, {
          operatorName: ackOperator,
          operatorAction: ackAction
        });
      }

      setSelectedIds(new Set());
      setAckAction("");
      setPasswordInput("");
      setAckModalOpen(false);
      fetchDbAlarms();
    } catch (err) {
      console.error("Failed to submit fix report:", err);
      setPasswordError(err instanceof Error ? err.message : "Failed to verify password / submit report");
    } finally {
      setSubmitting(false);
    }
  };

  // Inline single fix trigger
  const handleSingleFix = (id: string) => {
    setSelectedIds(new Set([id]));
    setAckAction("");
    setPasswordInput("");
    setPasswordError("");
    setAckModalOpen(true);
  };

  // Inline single approval trigger
  const handleApproveFix = async (id: string) => {
    if (id.startsWith("maint-overdue-")) return;
    try {
      await postJson(`/alarms/${id}/approve`, {});
      fetchDbAlarms();
    } catch (err) {
      console.error("Failed to approve alarm:", err);
    }
  };

  // Open Edit Finalized dialog
  const handleEditClick = (alarm: AlarmLogItem) => {
    if (!canEditFinalized) return;
    setEditingAlarm(alarm);
    setEditAction(alarm.operatorAction);
    setEditModalOpen(true);
  };

  // Submit Edit Finalized
  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingAlarm) return;
    try {
      await postJson(`/alarms/${editingAlarm.id}/fix`, {
        operatorName: editingAlarm.operatorName || user?.name || "Operator",
        operatorAction: editAction
      });
      fetchDbAlarms();
      setEditModalOpen(false);
      setEditingAlarm(null);
    } catch (err) {
      console.error("Failed to edit operator action:", err);
    }
  };

  // Export visible alarms list to CSV file
  const handleExport = () => {
    const headers = ["Timestamp", "Description", "Equipment", "Status", "Operator Name", "Operator Action", "Approver Name", "RTN"];
    const rows = processedAlarms.map((item) => [
      item.timestamp,
      item.description,
      item.equipment,
      item.status,
      item.operatorName ?? "—",
      item.operatorAction || "—",
      item.approverName ?? "—",
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

  const activeAlarmsToFixCount = processedAlarms.filter((item) => item.status === "Active" && !item.id.startsWith("maint-overdue-")).length;

  return (
    <div className="space-y-6">
      {/* Filters & Actions Bar */}
      <div className="flex flex-wrap items-center justify-between gap-4 bg-[#f7fbff]/80 dark:bg-slate-950/70 border border-[#acd3ff] dark:border-slate-800 rounded-xl p-4 transition-colors duration-300 backdrop-blur-md">
        {/* Status Filters */}
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-bold text-[#47729f] dark:text-slate-500 mr-1 flex items-center gap-1">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
            </svg>
            FILTER:
          </span>
          {["All", "Active", "Pending Approval", "Resolved"].map((p) => (
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

        {/* Item / Equipment Filter */}
        <div className="flex items-center gap-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 px-3 py-1.5 rounded-lg shadow-sm">
          <span className="text-xs font-bold text-[#47729f] dark:text-slate-400 uppercase flex items-center gap-1.5">
            <svg className="w-4 h-4 text-[#1f6fb5]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
            </svg>
            ITEM:
          </span>
          <select
            value={selectedEquipment}
            onChange={(e) => setSelectedEquipment(e.target.value)}
            className="bg-transparent text-xs text-[#002b5c] dark:text-slate-200 outline-none font-semibold cursor-pointer max-w-[190px] truncate"
          >
            <option value="All">All Items ({equipmentOptions.length})</option>
            {equipmentOptions.map((eq) => (
              <option key={eq} value={eq}>
                {eq}
              </option>
            ))}
          </select>
        </div>

        {/* Search Input Box */}
        <div className="flex items-center gap-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 px-3 py-1.5 rounded-lg shadow-sm">
          <svg className="w-3.5 h-3.5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="text"
            placeholder="Search description / tag / operator..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="bg-transparent text-xs text-[#002b5c] dark:text-slate-200 outline-none font-semibold w-48 placeholder:text-slate-400 placeholder:font-normal"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery("")}
              className="text-[10px] text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 font-bold"
            >
              ✕
            </button>
          )}
        </div>

        {/* Date Range Calendar Filter */}
        <div className="flex items-center gap-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 px-3 py-1.5 rounded-lg shadow-sm">
          <span className="text-xs font-bold text-[#47729f] dark:text-slate-400 uppercase flex items-center gap-1.5">
            <svg className="w-4 h-4 text-[#1f6fb5]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            CALENDAR:
          </span>
          <input
            type="date"
            value={dateRange.startDate}
            onChange={(e) => setDateRange((prev) => ({ ...prev, startDate: e.target.value }))}
            className="bg-transparent text-xs text-[#002b5c] dark:text-slate-200 outline-none font-semibold cursor-pointer"
          />
          <span className="text-slate-400 text-xs font-semibold">to</span>
          <input
            type="date"
            value={dateRange.endDate}
            onChange={(e) => setDateRange((prev) => ({ ...prev, endDate: e.target.value }))}
            className="bg-transparent text-xs text-[#002b5c] dark:text-slate-200 outline-none font-semibold cursor-pointer"
          />
          {(dateRange.startDate || dateRange.endDate) && (
            <button
              onClick={() => setDateRange({ startDate: "", endDate: "" })}
              className="text-[10px] text-rose-500 hover:text-rose-600 font-bold hover:underline ml-1"
              title="Reset Date Filter"
            >
              Reset
            </button>
          )}
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-3">
          <button
            onClick={handleAckClick}
            disabled={selectedIds.size === 0 || !canAck}
            className={`flex items-center gap-1.5 px-4 py-2 text-xs font-bold rounded-lg border transition duration-200 ${
              selectedIds.size > 0 && canAck
                ? "bg-[#10b981] hover:bg-emerald-600 border-transparent text-white shadow-md shadow-emerald-500/20"
                : "bg-slate-100 dark:bg-slate-900/40 border-slate-200 dark:border-slate-800 text-slate-400 dark:text-slate-600 cursor-not-allowed"
            }`}
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            Fix Selected ({selectedIds.size})
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
            Active Alarms Sorted by Timestamp Descending
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-[#acd3ff]/50 dark:border-slate-800/50 text-[10px] uppercase tracking-wider text-[#47729f] dark:text-slate-500 font-bold">
                <th className="pb-3 px-3 w-10">
                  <input
                    type="checkbox"
                    checked={activeAlarmsToFixCount > 0 && selectedIds.size === activeAlarmsToFixCount}
                    onChange={handleSelectAllToggle}
                    className="rounded border-slate-300 text-[#1f6fb5] focus:ring-[#1f6fb5]"
                  />
                </th>
                <th className="pb-3 px-3">Timestamp</th>
                <th className="pb-3 px-3">Description</th>
                <th className="pb-3 px-3">Equipment</th>
                <th className="pb-3 px-3">Status</th>
                <th className="pb-3 px-3">Operator</th>
                <th className="pb-3 px-3">Operator Action</th>
                <th className="pb-3 px-3">Approver</th>
                <th className="pb-3 px-3 text-right">RTN</th>
                <th className="pb-3 px-3 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-900 font-medium text-[#002b5c] dark:text-slate-300">
              {processedAlarms.map((row) => (
                <tr
                  key={row.id}
                  className={`hover:bg-[#1f6fb5]/5 dark:hover:bg-[#1f6fb5]/10 transition-colors ${
                    row.status === "Active" ? "bg-rose-500/[0.02] dark:bg-rose-500/[0.04]" : ""
                  }`}
                >
                  <td className="py-3 px-3">
                    <input
                      type="checkbox"
                      checked={selectedIds.has(row.id)}
                      onChange={() => handleSelectToggle(row.id)}
                      disabled={row.status !== "Active" || row.id.startsWith("maint-overdue-")}
                      className="rounded border-slate-300 text-[#1f6fb5] focus:ring-[#1f6fb5] disabled:opacity-40"
                    />
                  </td>
                  <td className="py-3 px-3 font-mono text-[11px] text-[#47729f] dark:text-slate-500">
                    {row.timestamp}
                  </td>
                  <td className={`py-3 px-3 text-[11px] font-bold ${row.status === "Active" ? "text-rose-600 dark:text-rose-400" : ""}`}>
                    {row.description}
                  </td>
                  <td className="py-3 px-3 text-slate-500 dark:text-slate-400">{row.equipment}</td>
                  <td className="py-3 px-3">
                    <span className={`inline-block text-[8px] font-extrabold uppercase px-2 py-0.5 rounded-md ${badgeStyle[row.status]}`}>
                      {row.status}
                    </span>
                  </td>
                  <td className="py-3 px-3 text-slate-600 dark:text-slate-400">{row.operatorName || "—"}</td>
                  <td className="py-3 px-3 font-semibold text-slate-600 dark:text-slate-300">
                    <div className="flex items-center gap-2">
                      <span>{row.operatorAction || "—"}</span>
                      {row.status === "Resolved" && canEditFinalized && (
                        <button
                          onClick={() => handleEditClick(row)}
                          className="p-1 text-[#1f6fb5] hover:text-[#155c99] rounded transition duration-150"
                          title="Edit Action Description"
                        >
                          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                          </svg>
                        </button>
                      )}
                    </div>
                  </td>
                  <td className="py-3 px-3 text-slate-600 dark:text-slate-400">{row.approverName || "—"}</td>
                  <td className="py-3 px-3 text-right font-mono text-[11px] text-[#47729f] dark:text-slate-500">
                    {row.rtn}
                  </td>
                  <td className="py-3 px-3 text-center">
                    <div className="flex justify-center gap-1.5">
                      {row.status === "Active" && row.id.startsWith("maint-overdue-") && (
                        <span className="text-[10px] text-amber-555 font-extrabold bg-amber-500/10 border border-amber-500/25 px-1.5 py-0.5 rounded">
                          Reset Hours
                        </span>
                      )}
                      {row.status === "Active" && !row.id.startsWith("maint-overdue-") && canAck && (
                        <button
                          onClick={() => handleSingleFix(row.id)}
                          className="px-2 py-1 bg-amber-500 hover:bg-amber-600 text-white rounded text-[10px] font-bold shadow-sm transition"
                        >
                          Fix
                        </button>
                      )}
                      {row.status === "Pending Approval" && isKaShiftOrAbove && (
                        <button
                          onClick={() => handleApproveFix(row.id)}
                          className="px-2 py-1 bg-emerald-500 hover:bg-emerald-600 text-white rounded text-[10px] font-bold shadow-sm transition"
                        >
                          Approve
                        </button>
                      )}
                      {row.status === "Resolved" && (
                        <span className="text-[10px] text-slate-400 dark:text-slate-650 font-bold font-mono">Resolved</span>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {processedAlarms.length === 0 && (
                <tr>
                  <td colSpan={10} className="py-12 text-center text-[#47729f] dark:text-slate-500 font-semibold italic">
                    No alarms found matching the filter criteria.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Acknowledge (Fix) Alarms Modal Overlay */}
      {ackModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-6 backdrop-blur-sm">
          <div className="relative w-[450px] rounded-2xl border border-[#acd3ff] dark:border-slate-800 bg-white dark:bg-slate-950 p-6 shadow-2xl transition-all">
            <div className="flex items-start justify-between border-b border-slate-100 dark:border-slate-900 pb-3 mb-4">
              <div>
                <h4 className="text-sm font-bold text-[#002b5c] dark:text-slate-100">Submit Operator Fix Report</h4>
                <p className="text-[10px] text-slate-500">Report details of corrective actions taken to resolve active alarms.</p>
              </div>
              <button
                type="button"
                onClick={() => setAckModalOpen(false)}
                className="text-xs text-slate-400 hover:text-slate-200"
              >
                Cancel
              </button>
            </div>
            <form onSubmit={handleAckSubmit} className="space-y-4">
              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase">Operator Name</label>
                <select
                  value={ackOperator}
                  onChange={(e) => setAckOperator(e.target.value)}
                  className="mt-1 w-full rounded-md border border-slate-300 dark:border-slate-800 bg-white dark:bg-slate-900 px-3 py-2 text-xs text-[#002b5c] dark:text-white focus:outline-none focus:border-[#1f6fb5]"
                >
                  {displayOperators.map((op) => (
                    <option key={op} value={op}>
                      {op}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase">Operator Action taken</label>
                <textarea
                  value={ackAction}
                  onChange={(e) => setAckAction(e.target.value)}
                  placeholder="Type operator corrective actions taken (e.g. Cleared filter blockage, restarted VFD)..."
                  required
                  className="mt-1 w-full h-20 rounded-md border border-slate-300 dark:border-slate-800 bg-white dark:bg-slate-900 px-3 py-2 text-xs text-[#002b5c] dark:text-white focus:outline-none focus:border-[#1f6fb5]"
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase">Operator Password</label>
                <input
                  type="password"
                  value={passwordInput}
                  onChange={(e) => {
                    setPasswordInput(e.target.value);
                    setPasswordError("");
                  }}
                  placeholder="Enter your password to verify"
                  required
                  className="mt-1 w-full rounded-md border border-slate-300 dark:border-slate-800 bg-white dark:bg-slate-900 px-3 py-2 text-xs text-[#002b5c] dark:text-white focus:outline-none focus:border-[#1f6fb5]"
                />
                {passwordError && (
                  <p className="mt-1 text-[10px] text-rose-500 font-semibold">{passwordError}</p>
                )}
              </div>
              <div className="flex justify-end gap-2 border-t border-slate-100 dark:border-slate-900 pt-3">
                <button
                  type="button"
                  onClick={() => setAckModalOpen(false)}
                  disabled={submitting}
                  className="px-4 py-2 rounded-lg text-xs font-semibold bg-slate-100 dark:bg-slate-900 hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-2 rounded-lg text-xs font-bold bg-[#10b981] text-white hover:bg-emerald-700 disabled:opacity-50"
                >
                  {submitting ? "Submitting..." : "Submit Fix Report"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Finalized Action Modal Overlay */}
      {editModalOpen && editingAlarm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-6 backdrop-blur-sm">
          <div className="relative w-[450px] rounded-2xl border border-[#acd3ff] dark:border-slate-800 bg-white dark:bg-slate-950 p-6 shadow-2xl transition-all">
            <div className="flex items-start justify-between border-b border-slate-100 dark:border-slate-900 pb-3 mb-4">
              <div>
                <h4 className="text-sm font-bold text-[#002b5c] dark:text-slate-100">Edit Alarm Operator Action</h4>
                <p className="text-[10px] text-slate-500">Update operator action for logged alarm.</p>
              </div>
              <button
                type="button"
                onClick={() => setEditModalOpen(false)}
                className="text-xs text-slate-400 hover:text-slate-200"
              >
                Cancel
              </button>
            </div>
            <form onSubmit={handleEditSubmit} className="space-y-4">
              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase">Alarm Description</label>
                <div className="mt-1 p-2 bg-slate-100 dark:bg-slate-900 rounded text-xs text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-850">
                  {editingAlarm.description}
                </div>
              </div>
              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase">Operator Action taken</label>
                <textarea
                  value={editAction}
                  onChange={(e) => setEditAction(e.target.value)}
                  placeholder="Describe corrective actions taken..."
                  required
                  className="mt-1 w-full h-20 rounded-md border border-slate-300 dark:border-slate-800 bg-white dark:bg-slate-900 px-3 py-2 text-xs text-[#002b5c] dark:text-white focus:outline-none focus:border-[#1f6fb5]"
                />
              </div>
              <div className="flex justify-end gap-2 border-t border-slate-100 dark:border-slate-900 pt-3">
                <button
                  type="button"
                  onClick={() => setEditModalOpen(false)}
                  className="px-4 py-2 rounded-lg text-xs font-semibold bg-slate-100 dark:bg-slate-900 hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-lg text-xs font-bold bg-[#1f6fb5] text-white hover:bg-[#155c99]"
                >
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
