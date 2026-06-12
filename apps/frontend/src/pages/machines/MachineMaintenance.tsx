import { useEffect, useState, useMemo } from "react";
import { useOutletContext } from "react-router-dom";
import { ConfirmDialog } from "../../components/ui/ConfirmDialog";
import { getUnitById } from "../../data/machines";
import { DEFAULT_EQ_CONFIGS, DEFAULT_HVAC_EQ_CONFIGS } from "../../data/equipment";
import { getJson, postJson } from "../../services/api.client";
import { useAuthStore } from "../../store/auth.store";
import { useSystemStore } from "../../store/system.store";
import type { MachineOutletContext } from "./MachineLayout";

type MaintenanceItem = {
  id: string;
  machineId: string;
  date: string;
  item: string;
  abnormality?: string | null;
  action: string;
  downtimeHours: number;
  technician: string;
  status: "completed" | "monitoring" | "planned";
  notes?: string | null;
  approvalStatus?: string;
};

type MaintenanceListResponse = {
  data: MaintenanceItem[];
};

type MaintenanceCreateResponse = {
  data: MaintenanceItem;
};

const formatDate = (value: string) => new Date(value).toLocaleDateString("id-ID", {
  year: "numeric",
  month: "short",
  day: "numeric",
  hour: "2-digit",
  minute: "2-digit"
});

export default function MachineMaintenance() {
  const { unitId } = useOutletContext<MachineOutletContext>();
  const machine = getUnitById(unitId);
  const role = useAuthStore((state) => state.user?.role ?? "user");
  const theme = useSystemStore((state) => state.theme);
  const isDark = theme === "dark";

  const [records, setRecords] = useState<MaintenanceItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [form, setForm] = useState({
    date: new Date().toISOString().slice(0, 16),
    item: "",
    abnormality: "",
    action: "",
    downtimeHours: "0.0",
    technician: "",
    status: "completed" as "completed" | "monitoring" | "planned",
    notes: ""
  });

  useEffect(() => {
    if (!machine) return;

    let active = true;
    setLoading(true);
    const statusParam = role === "user" ? "approved" : "all";
    getJson<MaintenanceListResponse>(
      `/machines/${machine.id}/maintenance?limit=100&status=${statusParam}`
    )
      .then((result) => {
        if (active) {
          setRecords(result.data);
        }
      })
      .catch((err) => {
        if (active) {
          setError(err instanceof Error ? err.message : "Gagal memuat data");
        }
      })
      .finally(() => {
        if (active) {
          setLoading(false);
        }
      });

    return () => {
      active = false;
    };
  }, [machine, role]);

  if (!machine) return null;

  const canCreate = ["operator", "team_head", "leader", "admin"].includes(role);
  const lastRecord = records[0];

  const handleChange = (field: keyof typeof form, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const submitForm = async () => {
    setSaving(true);
    setError(null);

    try {
      const payload = {
        date: new Date(form.date).toISOString(),
        item: form.item,
        abnormality: form.abnormality || undefined,
        action: form.action,
        downtimeHours: Number(form.downtimeHours),
        technician: form.technician,
        status: form.status,
        notes: form.notes || undefined
      };

      const result = await postJson<MaintenanceCreateResponse>(
        `/machines/${machine.id}/maintenance`,
        payload
      );

      setRecords((prev) => [result.data, ...prev]);
      setForm({
        date: new Date().toISOString().slice(0, 16),
        item: "",
        abnormality: "",
        action: "",
        downtimeHours: "0.0",
        technician: "",
        status: "completed",
        notes: ""
      });
      setFormOpen(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal menyimpan data");
    } finally {
      setSaving(false);
    }
  };

  const healthMatrixItems = useMemo(() => {
    if (unitId === "hvac-qc-retained-sample") {
      let eqConfigs = DEFAULT_HVAC_EQ_CONFIGS;
      const savedEq = localStorage.getItem(`scada.config.eq.${unitId}`);
      if (savedEq) {
        try {
          eqConfigs = JSON.parse(savedEq);
        } catch (e) {
          // fallback
        }
      }

      return eqConfigs.map((item) => {
        const health = item.highLimit > 0
          ? Math.max(0, Math.min(100, Math.round(((item.highLimit - item.baseline) / item.highLimit) * 100)))
          : 100;
        
        let barColor = "bg-emerald-500";
        if (health <= 50) barColor = "bg-rose-500";
        else if (health <= 70) barColor = "bg-orange-500";
        else if (health <= 85) barColor = "bg-amber-500";

        const lastService = "2026-03-10";
        const nextService = "2026-09-10";

        return {
          tag: item.tagName,
          sub: `Last service: ${lastService} · Next: ${nextService} · P&ID Status: ${item.status}`,
          run: `${item.baseline.toLocaleString()} / ${item.highLimit.toLocaleString()}`,
          health,
          barColor,
          rem: `${(item.highLimit - item.baseline).toLocaleString()} h`
        };
      });
    }

    if (unitId !== "cooling-water-1") {
      return [
        { tag: "AHU-01 Supply Fan", sub: "Last service: 2025-11-04 · Next: 2026-05-10", run: "8,432 / 10,000", health: 94, barColor: "bg-emerald-500", rem: "1,568 h" },
        { tag: "AHU-01 Condensing Unit CU-01", sub: "Last service: 2025-10-12 · Next: 2026-04-18", run: "7,210 / 9,000", health: 88, barColor: "bg-orange-500", rem: "1,790 h" },
        { tag: "AHU-02 Supply Fan", sub: "Last service: 2025-09-30 · Next: 2026-03-20", run: "9,128 / 10,000", health: 76, barColor: "bg-rose-500", rem: "880 h" },
        { tag: "AHU-02 Electric Heater", sub: "Last service: 2025-08-14 · Next: 2026-05-10", run: "6,500 / 12,000", health: 97, barColor: "bg-teal-500", rem: "5,500 h" },
        { tag: "AHU-02 Humidifier", sub: "Last service: 2025-12-01 · Next: 2026-06-05", run: "4,100 / 6,000", health: 82, barColor: "bg-emerald-500", rem: "1,900 h" },
        { tag: "AHU-03 Supply Fan", sub: "Last service: 2025-10-20 · Next: 2026-04-25", run: "7,700 / 10,000", health: 91, barColor: "bg-amber-500", rem: "2,300 h" }
      ];
    }

    // Load from localStorage or defaults
    let eqConfigs = DEFAULT_EQ_CONFIGS;
    const savedEq = localStorage.getItem(`scada.config.eq.${unitId}`);
    if (savedEq) {
      try {
        eqConfigs = JSON.parse(savedEq);
      } catch (e) {
        // use default
      }
    }

    return eqConfigs.map((item) => {
      const health = item.highLimit > 0
        ? Math.max(0, Math.min(100, Math.round(((item.highLimit - item.baseline) / item.highLimit) * 100)))
        : 100;
      
      let barColor = "bg-emerald-500";
      if (health <= 50) barColor = "bg-rose-500";
      else if (health <= 70) barColor = "bg-orange-500";
      else if (health <= 85) barColor = "bg-amber-500";

      const lastService = "2026-03-10";
      const nextService = "2026-09-10";

      return {
        tag: item.tagName,
        sub: `Last service: ${lastService} · Next: ${nextService} · P&ID Status: ${item.status}`,
        run: `${item.baseline.toLocaleString()} / ${item.highLimit.toLocaleString()}`,
        health,
        barColor,
        rem: `${(item.highLimit - item.baseline).toLocaleString()} h`
      };
    });
  }, [unitId]);

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    setConfirmOpen(true);
  };

  return (
    <div className="space-y-6">
      {/* 1. Maintenance Summary Indicators Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: "Overall Health", value: "86%", cap: "Normal Range", color: "text-emerald-500", bg: "bg-emerald-500/10" },
          { label: "Running Hours (All)", value: "57,122 hrs", cap: "Total Cumulative", color: "text-blue-500", bg: "bg-blue-500/10" },
          { label: "PM Due This Month", value: "3 Tasks", cap: "Next due 15-Jun", color: "text-amber-500", bg: "bg-amber-500/10" },
          { label: "Overdue Items", value: "1 Critical", cap: "Requires Attention", color: "text-rose-500", bg: "bg-rose-500/10" }
        ].map((card, idx) => (
          <div
            key={idx}
            className="p-4 bg-white dark:bg-slate-950 border border-[#acd3ff] dark:border-slate-800 rounded-xl shadow-sm transition hover:scale-[1.01] hover:shadow"
          >
            <span className="text-[10px] sm:text-xs uppercase tracking-wider font-bold text-[#47729f] dark:text-slate-500">
              {card.label}
            </span>
            <div className={`mt-2 text-xl sm:text-2xl font-extrabold tracking-tight ${card.color}`}>
              {card.value}
            </div>
            <div className="mt-1 flex items-center gap-1.5 text-[9px] sm:text-xs text-slate-400 dark:text-slate-500 font-medium">
              <span className={`w-1.5 h-1.5 rounded-full ${card.bg}`} />
              <span>{card.cap}</span>
            </div>
          </div>
        ))}
      </div>

      {/* 2. Equipment Health Matrix */}
      <div className="bg-white dark:bg-slate-950 border border-[#acd3ff] dark:border-slate-800 rounded-xl p-5 shadow-sm transition-colors duration-300">
        <h3 className="text-sm font-bold text-[#002b5c] dark:text-slate-100 uppercase tracking-wide border-b border-[#acd3ff]/30 pb-2 mb-4">
          Equipment Health Matrix
        </h3>
        <div className={`grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 ${unitId === "cooling-water-1" || unitId === "hvac-qc-retained-sample" ? "max-h-[520px] overflow-y-auto pr-2" : ""}`}>
          {healthMatrixItems.map((item, idx) => (
            <div
              key={idx}
              className="p-4 bg-slate-50 dark:bg-slate-900/30 border border-slate-100 dark:border-slate-900 rounded-xl space-y-2 flex flex-col justify-between"
            >
              <div className="space-y-0.5">
                <div className="text-xs font-extrabold text-[#002b5c] dark:text-slate-200">
                  {item.tag}
                </div>
                <div className="text-[9px] text-[#47729f] dark:text-slate-500">
                  {item.sub}
                </div>
              </div>
              <div className="space-y-1 pt-1">
                <div className="flex justify-between text-[10px] font-bold text-slate-500">
                  <span>Running Hrs: <span className="font-mono text-slate-400">{item.run}</span></span>
                  <span className="text-[#002b5c] dark:text-slate-300 font-mono">Health: {item.health}%</span>
                </div>
                <div className="w-full bg-slate-200 dark:bg-slate-800 rounded-full h-1.5 overflow-hidden">
                  <div className={`h-full ${item.barColor} rounded-full`} style={{ width: `${item.health}%` }} />
                </div>
              </div>
              <div className="text-[10px] text-right font-mono text-slate-400 pt-1">
                Remaining: <span className="font-bold text-[#002b5c] dark:text-slate-200">{item.rem}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 3. Bottom Split View (Preventive Schedule vs Service & Name Plate) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Preventive Maintenance Schedule */}
        <div className="bg-white dark:bg-slate-950 border border-[#acd3ff] dark:border-slate-800 rounded-xl p-5 shadow-sm transition-colors duration-300">
          <h3 className="text-sm font-bold text-[#002b5c] dark:text-slate-100 uppercase tracking-wide border-b border-[#acd3ff]/30 pb-2 mb-3">
            Preventive Maintenance Schedule
          </h3>
          <div className="space-y-2 max-h-[280px] overflow-y-auto pr-1">
            {[
              { task: "CT-1 Fan Bearing Lubrication", date: "2026-06-15", status: "Scheduled", tech: "Hasan", color: "bg-blue-500/10 text-blue-500 border border-blue-500/20" },
              { task: "Condenser Coil Cleaning", date: "2026-06-20", status: "Scheduled", tech: "Budi", color: "bg-blue-500/10 text-blue-500 border border-blue-500/20" },
              { task: "Water Treatment Chemical Check", date: "2026-06-25", status: "Scheduled", tech: "Rian", color: "bg-blue-500/10 text-blue-500 border border-blue-500/20" },
              { task: "Vibration Sensor Calibration", date: "2026-06-12", status: "Overdue", tech: "Hasan", color: "bg-rose-500/15 text-rose-500 border border-rose-500/30 font-bold animate-pulse" },
              { task: "Electrical Panel Thermal Check", date: "2026-07-02", status: "Planned", tech: "Asep", color: "bg-slate-500/10 text-slate-400 border border-slate-500/20" }
            ].map((task, idx) => (
              <div
                key={idx}
                className="flex items-center justify-between p-2.5 bg-slate-50/50 dark:bg-slate-900/40 border border-slate-100 dark:border-slate-900 rounded-lg text-xs"
              >
                <div>
                  <div className="font-bold text-[#002b5c] dark:text-slate-200">{task.task}</div>
                  <div className="text-[10px] text-slate-400 mt-0.5">
                    Target: {task.date} | Tech: {task.tech}
                  </div>
                </div>
                <span className={`text-[8px] uppercase font-extrabold px-2 py-0.5 rounded-md ${task.color}`}>
                  {task.status}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Service & Name Plate */}
        <div className="bg-white dark:bg-slate-950 border border-[#acd3ff] dark:border-slate-800 rounded-xl p-5 shadow-sm transition-colors duration-300 flex flex-col justify-between">
          <div>
            <h3 className="text-sm font-bold text-[#002b5c] dark:text-slate-100 uppercase tracking-wide border-b border-[#acd3ff]/30 pb-2 mb-3">
              Service & Name Plate
            </h3>
            <div className="grid grid-cols-2 gap-x-6 gap-y-2.5 text-xs text-[#002b5c] dark:text-slate-300 font-medium">
              <div>
                <span className="text-[10px] uppercase text-[#47729f] dark:text-slate-500 block">Model Number</span>
                <span className="font-bold font-mono">CT-WF1-U3</span>
              </div>
              <div>
                <span className="text-[10px] uppercase text-[#47729f] dark:text-slate-500 block">Serial Number</span>
                <span className="font-bold font-mono">CW-2026-99381-CT</span>
              </div>
              <div>
                <span className="text-[10px] uppercase text-[#47729f] dark:text-slate-500 block">Manufacturer</span>
                <span className="font-bold">Widatra Industrial Cooling Ltd</span>
              </div>
              <div>
                <span className="text-[10px] uppercase text-[#47729f] dark:text-slate-500 block">Manufactured Date</span>
                <span className="font-bold font-mono">October 12, 2023</span>
              </div>
              <div>
                <span className="text-[10px] uppercase text-[#47729f] dark:text-slate-500 block">Electrical Rating</span>
                <span className="font-bold font-mono">380-415V / 3 Phase / 50Hz</span>
              </div>
              <div>
                <span className="text-[10px] uppercase text-[#47729f] dark:text-slate-500 block">Cooling Capacity</span>
                <span className="font-bold font-mono">450 kW</span>
              </div>
              <div>
                <span className="text-[10px] uppercase text-[#47729f] dark:text-slate-500 block">Water Flow Capacity</span>
                <span className="font-bold font-mono">120 m³/h</span>
              </div>
              <div>
                <span className="text-[10px] uppercase text-[#47729f] dark:text-slate-500 block">Refrigerant / Loop</span>
                <span className="font-bold">Water / Glycol Loop</span>
              </div>
            </div>
          </div>
          <div className="text-[9px] text-slate-400 dark:text-slate-500 border-t border-slate-100 dark:border-slate-900 mt-4 pt-2 flex items-center justify-between">
            <span>QC Stamp Approved</span>
            <span>Support: +62 21-883-WIDATRA</span>
          </div>
        </div>
      </div>

      {/* 4. Action bar & Form input triggers */}
      <div className="flex flex-wrap items-center justify-between bg-white dark:bg-slate-950 border border-[#acd3ff] dark:border-slate-800 rounded-xl p-4 shadow-sm">
        <div>
          <h4 className="text-sm font-bold text-[#002b5c] dark:text-slate-200">
            Maintenance History & Repair Records
          </h4>
          <p className="text-xs text-[#47729f] dark:text-slate-500">
            Chronological audit of completed repairs, breakdowns, and technician logs.
          </p>
        </div>
        <div className="flex flex-wrap gap-2 text-xs">
          <button
            type="button"
            onClick={() => setFormOpen(true)}
            disabled={!canCreate}
            className="flex items-center gap-1.5 px-4 py-2 font-bold rounded-lg border border-transparent bg-[#1f6fb5] text-white hover:bg-[#155c99] shadow-sm disabled:cursor-not-allowed disabled:opacity-50 transition duration-200"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
            </svg>
            Add Maintenance Record
          </button>
        </div>
      </div>

      {/* Input Form Overlay modal */}
      {canCreate && formOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-6 backdrop-blur-sm">
          <div className="relative max-h-[90vh] w-[500px] overflow-y-auto rounded-2xl border border-[#acd3ff] dark:border-slate-700 bg-white dark:bg-slate-950 p-6 shadow-[0_20px_60px_rgba(0,0,0,0.3)]">
            <div className="flex items-start justify-between gap-4 border-b border-slate-100 dark:border-slate-900 pb-3 mb-4">
              <div>
                <div className="text-xs uppercase tracking-[0.2em] text-[#1f6fb5] dark:text-sky-400 font-bold">
                  Input Maintenance
                </div>
                <div className="mt-1 text-xs text-[#47729f] dark:text-slate-500">
                  Tambahkan history perbaikan baru.
                </div>
              </div>
              <button
                type="button"
                onClick={() => setFormOpen(false)}
                className="rounded-full border border-slate-200 dark:border-slate-800 px-3 py-1 text-[10px] font-bold text-[#003b75] dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-900"
              >
                Close
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <label className="text-xs text-[#47729f] dark:text-slate-400 font-bold block">
                  Tanggal
                  <input
                    type="datetime-local"
                    value={form.date}
                    onChange={(event) => handleChange("date", event.target.value)}
                    className="mt-1.5 w-full rounded-md border border-[#d6e9fb] dark:border-slate-800 bg-slate-50 dark:bg-slate-900 px-3 py-2 text-xs text-[#002b5c] dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-[#1f6fb5]"
                    required
                  />
                </label>
                <label className="text-xs text-[#47729f] dark:text-slate-400 font-bold block">
                  Teknisi
                  <input
                    type="text"
                    value={form.technician}
                    onChange={(event) => handleChange("technician", event.target.value)}
                    className="mt-1.5 w-full rounded-md border border-[#d6e9fb] dark:border-slate-800 bg-slate-50 dark:bg-slate-900 px-3 py-2 text-xs text-[#002b5c] dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-[#1f6fb5]"
                    required
                  />
                </label>
              </div>

              <label className="text-xs text-[#47729f] dark:text-slate-400 font-bold block">
                Item Maintenance
                <input
                  type="text"
                  value={form.item}
                  onChange={(event) => handleChange("item", event.target.value)}
                  className="mt-1.5 w-full rounded-md border border-[#d6e9fb] dark:border-slate-800 bg-slate-50 dark:bg-slate-900 px-3 py-2 text-xs text-[#002b5c] dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-[#1f6fb5]"
                  required
                />
              </label>

              <div className="grid grid-cols-2 gap-4">
                <label className="text-xs text-[#47729f] dark:text-slate-400 font-bold block">
                  Abnormalitas
                  <input
                    type="text"
                    value={form.abnormality}
                    onChange={(event) => handleChange("abnormality", event.target.value)}
                    className="mt-1.5 w-full rounded-md border border-[#d6e9fb] dark:border-slate-800 bg-slate-50 dark:bg-slate-900 px-3 py-2 text-xs text-[#002b5c] dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-[#1f6fb5]"
                  />
                </label>
                <label className="text-xs text-[#47729f] dark:text-slate-400 font-bold block">
                  Downtime (jam)
                  <input
                    type="number"
                    step="0.1"
                    value={form.downtimeHours}
                    onChange={(event) => handleChange("downtimeHours", event.target.value)}
                    className="mt-1.5 w-full rounded-md border border-[#d6e9fb] dark:border-slate-800 bg-slate-50 dark:bg-slate-900 px-3 py-2 text-xs text-[#002b5c] dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-[#1f6fb5]"
                    required
                  />
                </label>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <label className="text-xs text-[#47729f] dark:text-slate-400 font-bold block">
                  Action
                  <input
                    type="text"
                    value={form.action}
                    onChange={(event) => handleChange("action", event.target.value)}
                    className="mt-1.5 w-full rounded-md border border-[#d6e9fb] dark:border-slate-800 bg-slate-50 dark:bg-slate-900 px-3 py-2 text-xs text-[#002b5c] dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-[#1f6fb5]"
                    required
                  />
                </label>
                <label className="text-xs text-[#47729f] dark:text-slate-400 font-bold block">
                  Status
                  <select
                    value={form.status}
                    onChange={(event) => handleChange("status", event.target.value)}
                    className="mt-1.5 w-full rounded-md border border-[#d6e9fb] dark:border-slate-800 bg-slate-50 dark:bg-slate-900 px-3 py-2 text-xs text-[#002b5c] dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-[#1f6fb5]"
                  >
                    <option value="completed">Completed</option>
                    <option value="monitoring">Monitoring</option>
                    <option value="planned">Planned</option>
                  </select>
                </label>
              </div>

              <label className="block text-xs text-[#47729f] dark:text-slate-400 font-bold">
                Notes
                <textarea
                  value={form.notes}
                  onChange={(event) => handleChange("notes", event.target.value)}
                  className="mt-1.5 w-full rounded-md border border-[#d6e9fb] dark:border-slate-800 bg-slate-50 dark:bg-slate-900 px-3 py-2 text-xs text-[#002b5c] dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-[#1f6fb5]"
                  rows={3}
                />
              </label>

              {error && (
                <div className="rounded-md border border-rose-500/20 bg-rose-500/10 px-3 py-2 text-[11px] text-rose-500">
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={saving}
                className="w-full rounded-lg bg-[#1f6fb5] hover:bg-[#155c99] py-2.5 text-xs font-bold text-white shadow-md disabled:cursor-not-allowed disabled:opacity-70 transition duration-200"
              >
                {saving ? "Menyimpan..." : "Simpan Perbaikan"}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Database History Table */}
      <div className="bg-white dark:bg-slate-950 border border-[#acd3ff] dark:border-slate-800 rounded-xl p-5 shadow-sm transition-colors duration-300">
        <div className="overflow-x-auto">
          {loading ? (
            <div className="text-xs text-slate-400 animate-pulse py-6 text-center">Memuat data perbaikan...</div>
          ) : records.length === 0 ? (
            <div className="text-xs text-slate-400 py-6 text-center italic font-semibold">
              Belum ada data perbaikan yang tersimpan.
            </div>
          ) : (
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-[#acd3ff]/50 dark:border-slate-800/50 text-[10px] uppercase tracking-wider text-[#47729f] dark:text-slate-500 font-bold">
                  <th className="pb-3 px-3">Tanggal</th>
                  <th className="pb-3 px-3">Item</th>
                  <th className="pb-3 px-3">Abnormalitas</th>
                  <th className="pb-3 px-3">Action</th>
                  <th className="pb-3 px-3 text-right">Downtime</th>
                  <th className="pb-3 px-3">Teknisi</th>
                  <th className="pb-3 px-3 text-center">Status</th>
                  <th className="pb-3 px-3 text-right">Approval</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-900 font-medium text-[#002b5c] dark:text-slate-300">
                {records.map((record) => (
                  <tr key={record.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-900/20 transition-colors">
                    <td className="py-3 px-3 font-mono text-[10px] text-[#47729f] dark:text-slate-500">
                      {formatDate(record.date)}
                    </td>
                    <td className="py-3 px-3 font-bold text-slate-800 dark:text-slate-200">
                      {record.item}
                    </td>
                    <td className="py-3 px-3 text-slate-500 dark:text-slate-400">
                      {record.abnormality ?? "—"}
                    </td>
                    <td className="py-3 px-3 text-slate-600 dark:text-slate-300">
                      {record.action}
                    </td>
                    <td className="py-3 px-3 text-right font-mono font-bold text-slate-500">
                      {record.downtimeHours.toFixed(1)} h
                    </td>
                    <td className="py-3 px-3 text-slate-500">{record.technician}</td>
                    <td className="py-3 px-3 text-center">
                      <span className={`inline-block px-2 py-0.5 rounded text-[9px] font-extrabold capitalize ${
                        record.status === "completed"
                          ? "bg-emerald-500/10 text-emerald-500"
                          : record.status === "monitoring"
                          ? "bg-amber-500/10 text-amber-500"
                          : "bg-blue-500/10 text-blue-500"
                      }`}>
                        {record.status}
                      </span>
                    </td>
                    <td className="py-3 px-3 text-right text-[10px] text-slate-400 capitalize">
                      {record.approvalStatus ?? "approved"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      <ConfirmDialog
        open={confirmOpen}
        title="Konfirmasi Simpan Maintenance"
        description="Apakah Anda yakin ingin menyimpan data maintenance ini?"
        confirmText="Ya"
        cancelText="Tidak"
        onConfirm={() => {
          setConfirmOpen(false);
          submitForm();
        }}
        onCancel={() => setConfirmOpen(false)}
      />
    </div>
  );
}
