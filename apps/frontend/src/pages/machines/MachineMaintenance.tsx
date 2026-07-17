import { useEffect, useState, useMemo } from "react";
import { useOutletContext } from "react-router-dom";
import { ConfirmDialog } from "../../components/ui/ConfirmDialog";
import { getUnitById } from "../../data/machines";
import { DEFAULT_EQ_CONFIGS, DEFAULT_HVAC_EQ_CONFIGS, getDefaultEqConfigs, type ConfigEqRow } from "../../data/equipment";
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

const formatDate = (value: string) => {
  return new Date(value).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  });
};

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

  const [operators, setOperators] = useState<Array<{ id: string; name: string; role: string }>>([]);
  const [runningHours, setRunningHours] = useState<Record<string, number>>({});
  const [rhRules, setRhRules] = useState<any[]>([]);
  const [baselines, setBaselines] = useState<any[]>([]);

  useEffect(() => {
    if (unitId.startsWith("cooling-water")) {
      getJson<{ data: Record<string, number> }>("/analytics/running-hours")
        .then((res) => {
          if (res && res.data) setRunningHours(res.data);
        })
        .catch((err) => console.error("Failed to load running hours in maintenance:", err));

      getJson<{ data: any[] }>("/config/rh-task-rules")
        .then((res) => {
          if (res && res.data) setRhRules(res.data);
        })
        .catch((err) => console.error("Failed to load task rules in maintenance:", err));

      getJson<{ data: any[] }>(`/config/rh-baselines?unitId=${unitId}`)
        .then((res) => {
          if (res && res.data) setBaselines(res.data);
        })
        .catch((err) => console.error("Failed to load baselines in maintenance:", err));
    }
  }, [unitId]);

  useEffect(() => {
    getJson<{ data: Array<{ id: string; name: string; role: string }> }>("/users/operators")
      .then((res) => {
        setOperators(res.data);
      })
      .catch((err) => {
        console.error("Failed to fetch operators", err);
      });
  }, []);

  // Nameplate Editing State
  const defaultNameplate = useMemo(() => {
    if (unitId.includes("hvac") || unitId.includes("ahu")) {
      return {
        model: "AHU-QC-RETAINED-01",
        serial: "HVAC-2026-AHU01",
        manufacturer: "Widatra HVAC Systems Ltd",
        mfgDate: "November 14, 2024",
        electrical: "380V / 3 Phase / 50Hz",
        capacity: "12 kW",
        flow: "3,500 m³/h",
        refrigerant: "R410A / Air Loop"
      };
    }
    return {
      model: "CT-WF1-U3",
      serial: "CW-2026-99381-CT",
      manufacturer: "Widatra Industrial Cooling Ltd",
      mfgDate: "October 12, 2023",
      electrical: "380-415V / 3 Phase / 50Hz",
      capacity: "450 kW",
      flow: "120 m³/h",
      refrigerant: "Water / Glycol Loop"
    };
  }, [unitId]);

  const [nameplates, setNameplates] = useState<any[]>([defaultNameplate]);
  const [nameplateOpen, setNameplateOpen] = useState(false);
  const [nameplateForm, setNameplateForm] = useState<any>(defaultNameplate);
  const [editIndex, setEditIndex] = useState<number | null>(null);

  useEffect(() => {
    const saved = localStorage.getItem(`scada.nameplates.${unitId}`);
    if (saved) {
      try {
        setNameplates(JSON.parse(saved));
      } catch (e) {
        setNameplates([defaultNameplate]);
      }
    } else {
      // fallback to old single nameplate format
      const oldSaved = localStorage.getItem(`scada.nameplate.${unitId}`);
      if (oldSaved) {
        try {
          setNameplates([JSON.parse(oldSaved)]);
        } catch (e) {
          setNameplates([defaultNameplate]);
        }
      } else {
        setNameplates([defaultNameplate]);
      }
    }
  }, [unitId, defaultNameplate]);

  useEffect(() => {
    if (!machine) return;

    let active = true;
    const statusParam = role === "user" ? "approved" : "all";

    const fetchRecords = () => {
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
            setError(err instanceof Error ? err.message : "Failed to load data");
          }
        })
        .finally(() => {
          if (active) {
            setLoading(false);
          }
        });
    };

    fetchRecords();
    const interval = setInterval(fetchRecords, 5000);

    return () => {
      active = false;
      clearInterval(interval);
    };
  }, [machine, role]);

  if (!machine) return null;

  const canCreate = ["operator", "team_head", "leader", "admin"].includes(role);
  const canEditNameplate = [
    "admin",
    "senior_unit_head",
    "unit_head",
    "kashift_utility_hvac",
    "kashift_utility",
    "kashift_hvac"
  ].includes(role);

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
      setError(err instanceof Error ? err.message : "Failed to save data");
    } finally {
      setSaving(false);
    }
  };

  const handleNameplateSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    let updated = [...nameplates];
    if (editIndex !== null) {
      updated[editIndex] = nameplateForm;
    } else {
      updated.push(nameplateForm);
    }
    localStorage.setItem(`scada.nameplates.${unitId}`, JSON.stringify(updated));
    setNameplates(updated);
    setNameplateOpen(false);
  };

  const deleteNameplate = (index: number) => {
    if (confirm("Are you sure you want to delete this nameplate?")) {
      const updated = nameplates.filter((_, i) => i !== index);
      localStorage.setItem(`scada.nameplates.${unitId}`, JSON.stringify(updated));
      setNameplates(updated);
    }
  };

  const healthMatrixItems = useMemo(() => {
    if (unitId.startsWith("cooling-water")) {
      const components28 = [
        { key: "FAN-1", type: "FAN", tagId: "cooling-water/fan_status_1" },
        { key: "FAN-2", type: "FAN", tagId: "cooling-water/fan_status_2" },
        { key: "FAN-3", type: "FAN", tagId: "cooling-water/fan_status_3" },
        { key: "MTR-1", type: "MTR", tagId: "cooling-water/motor_status_1" },
        { key: "MTR-2", type: "MTR", tagId: "cooling-water/motor_status_2" },
        { key: "MTR-3", type: "MTR", tagId: "cooling-water/motor_status_3" },
        { key: "MTR-4", type: "MTR", tagId: "cooling-water/eq_status_du03" },
        { key: "MTR-5", type: "MTR", tagId: "cooling-water/eq_status_bp03" },
        { key: "MTR-6", type: "MTR", tagId: "cooling-water/eq_status_prep03" },
        { key: "MTR-7", type: "MTR", tagId: "cooling-water/eq_status_st03" },
        { key: "MTR-8", type: "MTR", tagId: "cooling-water/eq_status_washing" },
        { key: "MTR-9", type: "MTR", tagId: "cooling-water/eq_status_minilab" },
        { key: "Dosing Pump 1", type: "Dosing Pump", tagId: "cooling-water/dosing_pump_1" },
        { key: "Dosing Pump 2", type: "Dosing Pump", tagId: "cooling-water/dosing_pump_2" },
        { key: "Strainer 1", type: "Strainer", tagId: "cooling-water/strainer_1" },
        { key: "Strainer 2", type: "Strainer", tagId: "cooling-water/strainer_2" },
        { key: "Strainer 3", type: "Strainer", tagId: "cooling-water/strainer_3" },
        { key: "Strainer 4", type: "Strainer", tagId: "cooling-water/strainer_4" },
        { key: "Strainer 5", type: "Strainer", tagId: "cooling-water/strainer_5" },
        { key: "Strainer 6", type: "Strainer", tagId: "cooling-water/strainer_6" },
        { key: "Strainer 7", type: "Strainer", tagId: "cooling-water/strainer_7" },
        { key: "Strainer 8", type: "Strainer", tagId: "cooling-water/strainer_8" },
        { key: "Strainer 9", type: "Strainer", tagId: "cooling-water/strainer_9" },
        { key: "CT 1", type: "Cooling Tower", tagId: "cooling-water/ct_1" },
        { key: "CT 2", type: "Cooling Tower", tagId: "cooling-water/ct_2" },
        { key: "CT 3", type: "Cooling Tower", tagId: "cooling-water/ct_3" },
        { key: "Cooling Tank", type: "Cooling Tank", tagId: "cooling-water/cooling_tank" },
        { key: "Panel", type: "Panel", tagId: "cooling-water/panel" }
      ];

      return components28.map((comp) => {
        const lifetime = runningHours[comp.tagId] || 0.0;
        const compBaselines = baselines.filter(b => b.motorKey === comp.key);
        const ruleGroup = rhRules.find(r => r.itemKey === comp.type);
        const rulesList = ruleGroup ? ruleGroup.rules : [];
        
        let limit = 1000;
        let baselineHours = 0;
        
        if (rulesList.length > 0) {
          const sortedRules = [...rulesList].sort((a, b) => a.targetHours - b.targetHours);
          let foundActive = false;
          
          for (const rule of sortedRules) {
            const taskName = rule.tasks && rule.tasks[0] ? rule.tasks[0] : "";
            const matchedBaseline = compBaselines.find(b => b.targetHours === rule.targetHours && b.taskName === taskName);
            const baseVal = matchedBaseline ? matchedBaseline.baselineHours : 0.0;
            
            const accum = lifetime - baseVal;
            if (accum < rule.targetHours) {
              limit = rule.targetHours;
              baselineHours = baseVal;
              foundActive = true;
              break;
            }
          }
          
          if (!foundActive && sortedRules.length > 0) {
            const maxRule = sortedRules[sortedRules.length - 1];
            const taskName = maxRule.tasks && maxRule.tasks[0] ? maxRule.tasks[0] : "";
            const matchedBaseline = compBaselines.find(b => b.targetHours === maxRule.targetHours && b.taskName === taskName);
            limit = maxRule.targetHours;
            baselineHours = matchedBaseline ? matchedBaseline.baselineHours : 0.0;
          }
        }
        
        const beforePm = Math.max(0, lifetime - baselineHours);
        const health = limit > 0
          ? Math.max(0, Math.min(100, Math.round(((limit - beforePm) / limit) * 100)))
          : 100;
          
        let barColor = "bg-emerald-500";
        if (health <= 50) barColor = "bg-rose-500";
        else if (health <= 70) barColor = "bg-orange-500";
        else if (health <= 85) barColor = "bg-amber-500";
        
        return {
          tag: comp.key,
          sub: `Accumulated: ${beforePm.toFixed(1)} h · Baseline: ${baselineHours.toFixed(1)} h`,
          beforePm,
          lifetime,
          limit,
          health,
          barColor,
          rem: `${Math.max(0, Math.round(limit - beforePm)).toLocaleString()} h`
        };
      });
    }

    let eqConfigs = getDefaultEqConfigs(unitId);
    const savedEq = localStorage.getItem(`scada.config.eq.${unitId}`);
    if (savedEq) {
      try {
        eqConfigs = JSON.parse(savedEq);
      } catch (e) {}
    }

    return eqConfigs.map((item) => {
      const beforePm = item.runHoursBeforeMaintenance ?? item.baseline;
      const lifetime = item.runHoursLifetime ?? (item.baseline + 12432);
      const health = item.highLimit > 0
        ? Math.max(0, Math.min(100, Math.round(((item.highLimit - beforePm) / item.highLimit) * 100)))
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
        beforePm,
        lifetime,
        limit: item.highLimit,
        health,
        barColor,
        rem: `${Math.max(0, item.highLimit - beforePm).toLocaleString()} h`
      };
    });
  }, [unitId, runningHours, baselines, rhRules]);

  const overallHealth = useMemo(() => {
    if (healthMatrixItems.length === 0) return 100;
    const sum = healthMatrixItems.reduce((acc, item) => acc + item.health, 0);
    return Math.round(sum / healthMatrixItems.length);
  }, [healthMatrixItems]);

  const maxRunningHours = useMemo(() => {
    if (healthMatrixItems.length === 0) return 0;
    return Math.max(...healthMatrixItems.map((item) => item.lifetime));
  }, [healthMatrixItems]);

  const pmDueCount = useMemo(() => {
    return healthMatrixItems.filter((item) => item.health > 0 && item.health <= 20).length;
  }, [healthMatrixItems]);

  const overdueCount = useMemo(() => {
    return healthMatrixItems.filter((item) => item.health === 0).length;
  }, [healthMatrixItems]);

  const summaryCards = useMemo(() => {
    const healthColor = overallHealth >= 80 ? "text-emerald-500" : overallHealth >= 60 ? "text-amber-500" : "text-rose-500";
    const healthCap = overallHealth >= 80 ? "Normal Range" : overallHealth >= 60 ? "Warning Range" : "Critical Range";
    
    return [
      { label: "Overall Health", value: `${overallHealth}%`, cap: healthCap, color: healthColor, bg: "bg-emerald-500/10" },
      { label: "Running Hours (All)", value: `${maxRunningHours.toLocaleString()} hrs`, cap: "Max Component Hours", color: "text-blue-500", bg: "bg-blue-500/10" },
      { label: "PM Due This Month", value: `${pmDueCount} Tasks`, cap: pmDueCount > 0 ? "Needs Scheduled PM" : "No pending PM Tasks", color: "text-amber-500", bg: "bg-amber-500/10" },
      { label: "Overdue Items", value: `${overdueCount} Critical`, cap: overdueCount > 0 ? "Requires Attention" : "All clear", color: overdueCount > 0 ? "text-rose-500" : "text-emerald-500", bg: overdueCount > 0 ? "bg-rose-500/10" : "bg-emerald-500/10" }
    ];
  }, [overallHealth, maxRunningHours, pmDueCount, overdueCount]);

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    setConfirmOpen(true);
  };

  return (
    <div className="space-y-6">
      {/* 1. Maintenance Summary Indicators Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {summaryCards.map((card, idx) => (
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
        <div className={`grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 max-h-[520px] overflow-y-auto pr-2`}>
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
              <div className="space-y-3 pt-1">
                <div className="w-full bg-slate-200 dark:bg-slate-800 rounded-full h-1.5 overflow-hidden">
                  <div className={`h-full ${item.barColor} rounded-full`} style={{ width: `${item.health}%` }} />
                </div>
                <div className="grid grid-cols-3 gap-2 mt-3 text-center">
                  <div className="bg-slate-100/80 dark:bg-slate-800/40 rounded-full px-2.5 py-1.5 border border-slate-200/60 dark:border-slate-700/40 flex flex-col items-center justify-center">
                    <span className="text-[8px] uppercase tracking-wider text-slate-500 dark:text-slate-400 font-semibold">Before PM</span>
                    <span className="text-base font-extrabold text-slate-800 dark:text-slate-100 font-mono mt-0.5">{item.beforePm.toLocaleString()} h</span>
                  </div>
                  <div className="bg-slate-100/80 dark:bg-slate-800/40 rounded-full px-2.5 py-1.5 border border-slate-200/60 dark:border-slate-700/40 flex flex-col items-center justify-center">
                    <span className="text-[8px] uppercase tracking-wider text-slate-500 dark:text-slate-400 font-semibold">Lifetime</span>
                    <span className="text-base font-extrabold text-slate-800 dark:text-slate-100 font-mono mt-0.5">{item.lifetime.toLocaleString()} h</span>
                  </div>
                  <div className="bg-slate-100/80 dark:bg-slate-800/40 rounded-full px-2.5 py-1.5 border border-slate-200/60 dark:border-slate-700/40 flex flex-col items-center justify-center">
                    <span className="text-[8px] uppercase tracking-wider text-slate-500 dark:text-slate-400 font-semibold">Limit</span>
                    <span className="text-base font-extrabold text-[#002b5c] dark:text-sky-400 font-mono mt-0.5">{item.limit.toLocaleString()} h</span>
                  </div>
                </div>
              </div>
              <div className="flex justify-between items-center text-[10px] font-medium text-slate-500 dark:text-slate-400 pt-2 border-t border-slate-100 dark:border-slate-800">
                <span>Health: <span className="font-extrabold font-mono text-[#002b5c] dark:text-slate-200">{item.health}%</span></span>
                <span>Remaining: <span className="font-extrabold font-mono text-[#002b5c] dark:text-slate-200">{item.rem}</span></span>
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
        <div className="bg-white dark:bg-slate-950 border border-[#acd3ff] dark:border-slate-800 rounded-xl p-5 shadow-sm transition-colors duration-300 flex flex-col">
          <div className="flex justify-between items-center border-b border-[#acd3ff]/30 pb-2 mb-3">
            <h3 className="text-sm font-bold text-[#002b5c] dark:text-slate-100 uppercase tracking-wide">
              Service & Name Plates
            </h3>
            {canEditNameplate && (
              <button
                type="button"
                onClick={() => {
                  setNameplateForm(defaultNameplate);
                  setEditIndex(null);
                  setNameplateOpen(true);
                }}
                className="px-2.5 py-1 text-[10px] font-bold text-white bg-[#1f6fb5] hover:bg-[#155c99] rounded transition flex items-center gap-1"
              >
                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                </svg>
                Add Plate
              </button>
            )}
          </div>
          
          <div className="space-y-4 max-h-[260px] overflow-y-auto pr-1">
            {nameplates.map((plate, idx) => (
              <div key={idx} className="relative p-3 bg-slate-50/50 dark:bg-slate-900/40 border border-slate-100 dark:border-slate-900 rounded-lg group">
                {canEditNameplate && (
                  <div className="absolute top-2 right-2 flex gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={() => {
                        setNameplateForm(plate);
                        setEditIndex(idx);
                        setNameplateOpen(true);
                      }}
                      className="text-[10px] bg-slate-200 dark:bg-slate-800 hover:bg-blue-100 hover:text-blue-600 dark:hover:bg-slate-700 px-2 py-0.5 rounded font-bold transition"
                    >
                      Edit
                    </button>
                    {nameplates.length > 1 && (
                      <button
                        onClick={() => deleteNameplate(idx)}
                        className="text-[10px] bg-slate-200 dark:bg-slate-800 hover:bg-rose-100 hover:text-rose-600 dark:hover:bg-slate-700 px-2 py-0.5 rounded font-bold transition"
                      >
                        Delete
                      </button>
                    )}
                  </div>
                )}
                
                <div className="grid grid-cols-2 gap-x-6 gap-y-2.5 text-xs text-[#002b5c] dark:text-slate-300 font-medium mt-1">
                  <div>
                    <span className="text-[10px] uppercase text-[#47729f] dark:text-slate-500 block">Model Number</span>
                    <span className="font-bold font-mono text-slate-900 dark:text-white">{plate.model}</span>
                  </div>
                  <div>
                    <span className="text-[10px] uppercase text-[#47729f] dark:text-slate-500 block">Serial Number</span>
                    <span className="font-bold font-mono text-slate-900 dark:text-white">{plate.serial}</span>
                  </div>
                  <div>
                    <span className="text-[10px] uppercase text-[#47729f] dark:text-slate-500 block">Manufacturer</span>
                    <span className="font-bold text-slate-900 dark:text-white">{plate.manufacturer}</span>
                  </div>
                  <div>
                    <span className="text-[10px] uppercase text-[#47729f] dark:text-slate-500 block">Manufactured Date</span>
                    <span className="font-bold font-mono text-slate-900 dark:text-white">{plate.mfgDate}</span>
                  </div>
                  <div>
                    <span className="text-[10px] uppercase text-[#47729f] dark:text-slate-500 block">Electrical Rating</span>
                    <span className="font-bold font-mono text-slate-900 dark:text-white">{plate.electrical}</span>
                  </div>
                  <div>
                    <span className="text-[10px] uppercase text-[#47729f] dark:text-slate-500 block">Capacity</span>
                    <span className="font-bold font-mono text-slate-900 dark:text-white">{plate.capacity}</span>
                  </div>
                  <div>
                    <span className="text-[10px] uppercase text-[#47729f] dark:text-slate-500 block">Flow Capacity</span>
                    <span className="font-bold font-mono text-slate-900 dark:text-white">{plate.flow}</span>
                  </div>
                  <div>
                    <span className="text-[10px] uppercase text-[#47729f] dark:text-slate-500 block">Refrigerant / Loop</span>
                    <span className="font-bold text-slate-900 dark:text-white">{plate.refrigerant}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
          
          <div className="text-[9px] text-slate-400 dark:text-slate-500 border-t border-slate-100 dark:border-slate-900 mt-auto pt-2 flex items-center justify-between">
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

      {/* Nameplate Edit Modal Overlay */}
      {nameplateOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-6 backdrop-blur-sm">
          <div className="relative max-h-[90vh] w-[500px] overflow-y-auto rounded-2xl border border-[#acd3ff] dark:border-slate-700 bg-white dark:bg-slate-950 p-6 shadow-2xl">
            <div className="flex items-start justify-between border-b border-slate-100 dark:border-slate-900 pb-3 mb-4">
              <div>
                <div className="text-xs uppercase tracking-wider text-[#1f6fb5] font-bold">
                  Edit Nameplate Specifications
                </div>
                <p className="text-[10px] text-slate-500">Update machine service nameplate values.</p>
              </div>
              <button
                type="button"
                onClick={() => setNameplateOpen(false)}
                className="text-xs font-bold text-slate-400 hover:text-slate-200"
              >
                Close
              </button>
            </div>
            <form onSubmit={handleNameplateSubmit} className="space-y-3">
              {[
                { field: "model", label: "Model Number" },
                { field: "serial", label: "Serial Number" },
                { field: "manufacturer", label: "Manufacturer" },
                { field: "mfgDate", label: "Manufactured Date" },
                { field: "electrical", label: "Electrical Rating" },
                { field: "capacity", label: "Capacity" },
                { field: "flow", label: "Flow Capacity" },
                { field: "refrigerant", label: "Refrigerant / Loop" }
              ].map((inputItem) => (
                <div key={inputItem.field}>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase">
                    {inputItem.label}
                  </label>
                  <input
                    type="text"
                    value={(nameplateForm as any)[inputItem.field] || ""}
                    onChange={(e) =>
                      setNameplateForm((prev: any) => ({ ...prev, [inputItem.field]: e.target.value }))
                    }
                    required
                    className="mt-1 w-full rounded-md border border-slate-800 bg-slate-900 px-3 py-2 text-xs text-white focus:outline-none focus:border-blue-500"
                  />
                </div>
              ))}
              <button
                type="submit"
                className="w-full mt-4 rounded-md bg-[#1f6fb5] hover:bg-[#155c99] py-2 text-xs font-bold text-white transition"
              >
                Save Nameplate Changes
              </button>
            </form>
          </div>
        </div>
      )}

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
                  Add a new repair log.
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
                  Date
                  <input
                    type="datetime-local"
                    value={form.date}
                    onChange={(event) => handleChange("date", event.target.value)}
                    className="mt-1.5 w-full rounded-md border border-[#d6e9fb] dark:border-slate-800 bg-slate-50 dark:bg-slate-900 px-3 py-2 text-xs text-[#002b5c] dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-[#1f6fb5]"
                    required
                  />
                </label>
                <label className="text-xs text-[#47729f] dark:text-slate-400 font-bold block">
                  Technician
                  <select
                    value={form.technician}
                    onChange={(event) => handleChange("technician", event.target.value)}
                    className="mt-1.5 w-full rounded-md border border-[#d6e9fb] dark:border-slate-800 bg-slate-50 dark:bg-slate-900 px-3 py-2 text-xs text-[#002b5c] dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-[#1f6fb5]"
                    required
                  >
                    <option value="">Select Technician</option>
                    {operators.map((op) => (
                      <option key={op.id} value={op.name}>
                        {op.name} ({op.role.replace(/_/g, " ").toUpperCase()})
                      </option>
                    ))}
                    <option value="Vendor/External">Vendor/External</option>
                  </select>
                </label>
              </div>

              <label className="text-xs text-[#47729f] dark:text-slate-400 font-bold block">
                Maintenance Item
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
                  Abnormality
                  <input
                    type="text"
                    value={form.abnormality}
                    onChange={(event) => handleChange("abnormality", event.target.value)}
                    className="mt-1.5 w-full rounded-md border border-[#d6e9fb] dark:border-slate-800 bg-slate-50 dark:bg-slate-900 px-3 py-2 text-xs text-[#002b5c] dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-[#1f6fb5]"
                  />
                </label>
                <label className="text-xs text-[#47729f] dark:text-slate-400 font-bold block">
                  Downtime (hours)
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
                {saving ? "Saving..." : "Save Record"}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Database History Table */}
      <div className="bg-white dark:bg-slate-950 border border-[#acd3ff] dark:border-slate-800 rounded-xl p-5 shadow-sm transition-colors duration-300">
        <div className="overflow-x-auto">
          {loading ? (
            <div className="text-xs text-slate-400 animate-pulse py-6 text-center">Loading maintenance records...</div>
          ) : records.length === 0 ? (
            <div className="text-xs text-slate-400 py-6 text-center italic font-semibold">
              No maintenance records available.
            </div>
          ) : (
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-[#acd3ff]/50 dark:border-slate-800/50 text-[10px] uppercase tracking-wider text-[#47729f] dark:text-slate-500 font-bold">
                  <th className="pb-3 px-3">Date</th>
                  <th className="pb-3 px-3">Item</th>
                  <th className="pb-3 px-3">Abnormality</th>
                  <th className="pb-3 px-3">Action</th>
                  <th className="pb-3 px-3 text-right">Downtime</th>
                  <th className="pb-3 px-3">Technician</th>
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
        title="Confirm Maintenance Save"
        description="Are you sure you want to save this maintenance log?"
        confirmText="Yes"
        cancelText="No"
        onConfirm={() => {
          setConfirmOpen(false);
          submitForm();
        }}
        onCancel={() => setConfirmOpen(false)}
      />
    </div>
  );
}
