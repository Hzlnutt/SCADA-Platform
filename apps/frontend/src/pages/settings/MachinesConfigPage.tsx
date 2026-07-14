import { useEffect, useState } from "react";
import { PageHeader } from "../../components/ui/PageHeader";
import { ConfirmDialog } from "../../components/ui/ConfirmDialog";
import {
  useMachineConfig,
  createMachine,
  updateMachine,
  deactivateMachine,
  getThresholds,
  upsertThresholds,
  bindMachine
} from "../../hooks/useMachineConfig";
import type {
  MachineCategory,
  MachineConfig,
  MachineThreshold
} from "../../hooks/useMachineConfig";
import { getJson, postJson } from "../../services/api.client";

const AREAS = ["Utility", "HVAC", "WWTP", "Production", "Utilities"];

// ==========================================
// 1. SUB-COMPONENT: MachineDrawer (Modal/Drawer)
// ==========================================
interface MachineDrawerProps {
  open: boolean;
  onClose: () => void;
  machine: MachineConfig | null; // Null means adding new
  categories: MachineCategory[];
  onSaved: () => void;
}

function MachineDrawer({ open, onClose, machine, categories, onSaved }: MachineDrawerProps) {
  const [id, setId] = useState("");
  const [name, setName] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [area, setArea] = useState("Utility");
  const [status, setStatus] = useState<"active" | "inactive">("active");
  const [apiBindings, setApiBindings] = useState<Record<string, string>>({});
  const [trendWindow, setTrendWindow] = useState(24);
  const [samplingRate, setSamplingRate] = useState(5);
  const [enabledAnalytics, setEnabledAnalytics] = useState<Array<"trend" | "histogram" | "fft">>([
    "trend"
  ]);

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Sync state with selected machine
  useEffect(() => {
    if (open) {
      setError(null);
      if (machine) {
        setId(machine.id);
        setName(machine.name);
        setCategoryId(machine.categoryId);
        setArea(machine.area);
        setStatus(machine.status);
        setApiBindings(machine.apiBindings || {});
        setTrendWindow(machine.analysisConfig?.trendWindow ?? 24);
        setSamplingRate(machine.analysisConfig?.samplingRate ?? 5);
        setEnabledAnalytics(machine.analysisConfig?.enabledAnalytics ?? ["trend"]);
      } else {
        setId("");
        setName("");
        setCategoryId(categories[0]?.id || "");
        setArea("Utility");
        setStatus("active");
        setApiBindings({});
        setTrendWindow(24);
        setSamplingRate(5);
        setEnabledAnalytics(["trend"]);
      }
    }
  }, [open, machine, categories]);

  // Sync default bindings structure when category changes
  useEffect(() => {
    if (open && !machine && categoryId) {
      const selectedCat = categories.find((c) => c.id === categoryId || c._id === categoryId);
      if (selectedCat) {
        const initialBindings: Record<string, string> = {};
        selectedCat.parameters.forEach((param) => {
          initialBindings[param.key] = "";
        });
        setApiBindings(initialBindings);
      }
    }
  }, [categoryId, open, machine, categories]);

  const selectedCat = categories.find((c) => c.id === categoryId || c._id === categoryId);

  const handleBindingChange = (paramKey: string, val: string) => {
    setApiBindings((prev) => ({
      ...prev,
      [paramKey]: val
    }));
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!id.trim() || !name.trim() || !categoryId) {
      setError("Please fill in all required fields.");
      return;
    }

    setSaving(true);
    setError(null);
    try {
      const payload = {
        id: id.trim(),
        name: name.trim(),
        categoryId,
        area,
        status,
        apiBindings,
        analysisConfig: {
          trendWindow,
          samplingRate,
          enabledAnalytics
        }
      };

      if (machine) {
        // Edit mode
        await updateMachine(machine.id, payload);
      } else {
        // Add mode
        await createMachine(payload);
      }
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save machine configuration");
    } finally {
      setSaving(false);
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/60 backdrop-blur-sm">
      <div className="w-full max-w-lg bg-slate-950 border-l border-slate-800 p-6 flex flex-col h-full overflow-y-auto text-slate-100">
        <div className="flex items-center justify-between border-b border-slate-800 pb-4 mb-6">
          <h2 className="text-lg font-bold text-blue-400">
            {machine ? `Edit ${machine.name}` : "Add New Machine"}
          </h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-200">
            ✕
          </button>
        </div>

        {error && (
          <div className="text-xs text-rose-400 bg-rose-950/40 border border-rose-900/60 p-3 rounded mb-4">
            {error}
          </div>
        )}

        <form onSubmit={handleSave} className="space-y-5 flex-1">
          <div>
            <label className="text-xs text-slate-400 font-medium">Machine ID (Unique Key)</label>
            <input
              type="text"
              disabled={!!machine}
              value={id}
              onChange={(e) => setId(e.target.value)}
              placeholder="e.g. cooling-tower-1"
              className="mt-1 w-full rounded border border-slate-850 bg-slate-900 px-3 py-2 text-xs focus:outline-none focus:border-blue-500 disabled:opacity-50"
            />
          </div>

          <div>
            <label className="text-xs text-slate-400 font-medium">Machine Display Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Cooling Tower 1"
              className="mt-1 w-full rounded border border-slate-850 bg-slate-900 px-3 py-2 text-xs focus:outline-none focus:border-blue-500"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs text-slate-400 font-medium">Category</label>
              <select
                disabled={!!machine}
                value={categoryId}
                onChange={(e) => setCategoryId(e.target.value)}
                className="mt-1 w-full rounded border border-slate-850 bg-slate-900 px-3 py-2 text-xs focus:outline-none focus:border-blue-500"
              >
                {categories.map((c) => (
                  <option key={c._id || c.id} value={c._id || c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-xs text-slate-400 font-medium">Area</label>
              <select
                value={area}
                onChange={(e) => setArea(e.target.value)}
                className="mt-1 w-full rounded border border-slate-850 bg-slate-900 px-3 py-2 text-xs focus:outline-none focus:border-blue-500"
              >
                {AREAS.map((a) => (
                  <option key={a} value={a}>
                    {a}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* DYNAMIC API BINDINGS SECTION */}
          {selectedCat && (
            <div className="border-t border-slate-900 pt-4">
              <h3 className="text-xs font-bold text-blue-400 uppercase tracking-wider mb-3">
                PLC API Bindings ({selectedCat.name})
              </h3>
              <div className="space-y-4">
                {selectedCat.parameters.map((param) => (
                  <div key={param.key} className="grid grid-cols-3 items-center gap-2">
                    <span className="text-xs text-slate-300 font-medium">
                      {param.label} ({param.unit})
                    </span>
                    <input
                      type="text"
                      value={apiBindings[param.key] || ""}
                      onChange={(e) => handleBindingChange(param.key, e.target.value)}
                      placeholder={`e.g. tag-id/${param.key}`}
                      className="col-span-2 rounded border border-slate-850 bg-slate-900 px-3 py-1.5 text-xs focus:outline-none focus:border-blue-500 text-slate-100"
                    />
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="border-t border-slate-800 pt-4 flex gap-3 justify-end">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs rounded border border-slate-800 hover:bg-slate-900"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-4 py-2 text-xs rounded bg-blue-600 hover:bg-blue-500 font-medium text-white disabled:opacity-50"
            >
              {saving ? "Saving..." : "Save Config"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ==========================================
// 2. SUB-COMPONENT: MachinesTab (Table List)
// ==========================================
interface MachinesTabProps {
  machines: MachineConfig[];
  categories: MachineCategory[];
  isLoading: boolean;
  refetch: () => void;
  onEdit: (m: MachineConfig) => void;
  onAdd: () => void;
}

function MachinesTab({ machines, categories, isLoading, refetch, onEdit, onAdd }: MachinesTabProps) {
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const handleDeleteConfirm = async () => {
    if (!deleteId) return;
    try {
      await deactivateMachine(deleteId);
      refetch();
    } catch (e) {
      alert("Failed to delete machine");
    } finally {
      setDeleteId(null);
    }
  };

  const getCatName = (catId: string) => {
    const cat = categories.find((c) => c._id === catId || c.id === catId);
    return cat ? cat.name : catId;
  };

  return (
    <div className="bg-slate-950 border border-slate-850 rounded-xl p-5 shadow-lg space-y-4">
      <div className="flex justify-between items-center">
        <div>
          <h3 className="text-sm font-bold text-slate-200">Configured PLC Systems</h3>
          <p className="text-xs text-slate-500">List of registered machines connected to live SCADA telemetries.</p>
        </div>
        <button
          onClick={onAdd}
          className="px-3.5 py-1.5 text-xs font-semibold rounded bg-blue-600 hover:bg-blue-500 text-white transition-colors"
        >
          + Add Machine
        </button>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs">
          <thead>
            <tr className="border-b border-slate-800 text-[10px] uppercase text-slate-500 font-bold">
              <th className="pb-2">ID</th>
              <th className="pb-2">Name</th>
              <th className="pb-2">Category</th>
              <th className="pb-2">Area</th>
              <th className="pb-2">Bindings</th>
              <th className="pb-2 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-900 text-slate-300 font-medium">
            {isLoading ? (
              <tr>
                <td colSpan={6} className="py-4 text-center text-slate-500 italic">
                  Loading machines...
                </td>
              </tr>
            ) : machines.length === 0 ? (
              <tr>
                <td colSpan={6} className="py-4 text-center text-slate-500 italic">
                  No machines configured.
                </td>
              </tr>
            ) : (
              machines.map((m) => {
                const bindingKeys = Object.keys(m.apiBindings || {});
                return (
                  <tr key={m.id} className="hover:bg-slate-900/40">
                    <td className="py-3 font-mono font-bold text-slate-200">{m.id}</td>
                    <td className="py-3 text-slate-100">{m.name}</td>
                    <td className="py-3">{getCatName(m.categoryId)}</td>
                    <td className="py-3">
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-900 border border-slate-800 text-slate-400">
                        {m.area}
                      </span>
                    </td>
                    <td className="py-3 font-mono text-[10px] text-slate-400">
                      {bindingKeys.length > 0 ? `${bindingKeys.length} tags bound` : "No bindings"}
                    </td>
                    <td className="py-3 text-right space-x-2">
                      <button
                        onClick={() => onEdit(m)}
                        className="text-blue-400 hover:text-blue-300 font-bold"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => setDeleteId(m.id)}
                        className="text-rose-400 hover:text-rose-300 font-bold"
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      <ConfirmDialog
        open={!!deleteId}
        title="Delete Machine Configuration?"
        description="This action will permanently delete this machine's API bindings and customized warning/alarm thresholds."
        confirmText="Delete"
        cancelText="Cancel"
        onConfirm={handleDeleteConfirm}
        onCancel={() => setDeleteId(null)}
      />
    </div>
  );
}

// ==========================================
// 3. SUB-COMPONENT: ThresholdsTab (Edit limits)
// ==========================================
interface ThresholdsTabProps {
  machines: MachineConfig[];
  categories: MachineCategory[];
}

function ThresholdsTab({ machines, categories }: ThresholdsTabProps) {
  const [selectedMachineId, setSelectedMachineId] = useState("");
  const [limits, setLimits] = useState<Record<string, MachineThreshold>>({});
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ text: string; type: "success" | "error" } | null>(null);

  const selectedMachine = machines.find((m) => m.id === selectedMachineId);
  const selectedCat = selectedMachine
    ? categories.find((c) => c._id === selectedMachine.categoryId || c.id === selectedMachine.categoryId)
    : null;

  // Load thresholds when selected machine changes
  useEffect(() => {
    if (selectedMachineId) {
      setLoading(true);
      setMessage(null);
      getThresholds(selectedMachineId)
        .then((res) => {
          const map: Record<string, MachineThreshold> = {};
          res.data.forEach((item) => {
            map[item.parameter] = item;
          });
          setLimits(map);
        })
        .catch(() => {
          setMessage({ text: "Failed to load threshold settings.", type: "error" });
        })
        .finally(() => {
          setLoading(false);
        });
    } else {
      setLimits({});
    }
  }, [selectedMachineId]);

  const handleInputChange = (paramKey: string, field: keyof MachineThreshold, value: string) => {
    const num = parseFloat(value) || 0;
    setLimits((prev) => ({
      ...prev,
      [paramKey]: {
        ...(prev[paramKey] || {
          machineId: selectedMachineId,
          parameter: paramKey,
          alarmLow: 0,
          warningLow: 0,
          warningHigh: 0,
          alarmHigh: 0
        }),
        [field]: num
      }
    }));
  };

  const handleSave = async () => {
    if (!selectedMachineId || !selectedCat) return;
    setSaving(true);
    setMessage(null);
    try {
      const payloads = selectedCat.parameters.map((param) => {
        const limit = limits[param.key] || {
          machineId: selectedMachineId,
          parameter: param.key,
          alarmLow: 0,
          warningLow: 0,
          warningHigh: 0,
          alarmHigh: 0
        };
        return {
          machineId: selectedMachineId,
          parameter: param.key,
          warningLow: limit.warningLow,
          alarmLow: limit.alarmLow,
          warningHigh: limit.warningHigh,
          alarmHigh: limit.alarmHigh
        };
      });

      await upsertThresholds(selectedMachineId, payloads);
      setMessage({ text: "Threshold configurations saved successfully!", type: "success" });
    } catch (e) {
      setMessage({ text: "Failed to save threshold limits.", type: "error" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="bg-slate-950 border border-slate-850 rounded-xl p-5 shadow-lg space-y-4 text-slate-100">
      <div>
        <h3 className="text-sm font-bold text-slate-200 font-mono uppercase tracking-wider">
          Warning & Alarm Thresholds
        </h3>
        <p className="text-xs text-slate-500">Configure parameters alert boundaries for abnormal telemetry monitoring.</p>
      </div>

      <div className="max-w-xs">
        <label className="text-xs text-slate-400 font-medium block mb-1">Select Machine</label>
        <select
          value={selectedMachineId}
          onChange={(e) => setSelectedMachineId(e.target.value)}
          className="w-full rounded border border-slate-850 bg-slate-900 px-3 py-2 text-xs focus:outline-none focus:border-blue-500"
        >
          <option value="">-- Choose Machine --</option>
          {machines.map((m) => (
            <option key={m.id} value={m.id}>
              {m.name}
            </option>
          ))}
        </select>
      </div>

      {message && (
        <div
          className={`text-xs p-3 rounded border ${
            message.type === "success"
              ? "text-emerald-400 bg-emerald-950/20 border-emerald-900/60"
              : "text-rose-400 bg-rose-950/20 border-rose-900/60"
          }`}
        >
          {message.text}
        </div>
      )}

      {loading && <div className="text-xs text-slate-500 italic">Fetching parameters...</div>}

      {selectedMachineId && selectedCat && !loading && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 gap-4">
            {selectedCat.parameters.map((param) => {
              const limit = limits[param.key] || {
                alarmLow: 0,
                warningLow: 0,
                warningHigh: 0,
                alarmHigh: 0
              };

              return (
                <div key={param.key} className="p-4 rounded-lg bg-slate-900 border border-slate-800/60 space-y-3">
                  <div className="text-xs font-bold text-slate-300">
                    {param.label} <span className="text-slate-500 font-mono">({param.unit || "N/A"})</span>
                  </div>

                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div>
                      <label className="text-[10px] text-slate-500 uppercase font-bold">Alarm Low</label>
                      <input
                        type="number"
                        step="any"
                        value={limit.alarmLow}
                        onChange={(e) => handleInputChange(param.key, "alarmLow", e.target.value)}
                        className="mt-1 w-full rounded-md border border-slate-800 bg-slate-950 px-3 py-1.5 text-xs text-slate-100 focus:outline-none focus:border-blue-500"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] text-slate-500 uppercase font-bold">Warning Low</label>
                      <input
                        type="number"
                        step="any"
                        value={limit.warningLow}
                        onChange={(e) => handleInputChange(param.key, "warningLow", e.target.value)}
                        className="mt-1 w-full rounded-md border border-slate-800 bg-slate-950 px-3 py-1.5 text-xs text-slate-100 focus:outline-none focus:border-blue-500"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] text-slate-500 uppercase font-bold">Warning High</label>
                      <input
                        type="number"
                        step="any"
                        value={limit.warningHigh}
                        onChange={(e) => handleInputChange(param.key, "warningHigh", e.target.value)}
                        className="mt-1 w-full rounded-md border border-slate-800 bg-slate-950 px-3 py-1.5 text-xs text-slate-100 focus:outline-none focus:border-blue-500"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] text-slate-500 uppercase font-bold">Alarm High</label>
                      <input
                        type="number"
                        step="any"
                        value={limit.alarmHigh}
                        onChange={(e) => handleInputChange(param.key, "alarmHigh", e.target.value)}
                        className="mt-1 w-full rounded-md border border-slate-800 bg-slate-950 px-3 py-1.5 text-xs text-slate-100 focus:outline-none focus:border-blue-500"
                      />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="flex justify-end pt-2">
            <button
              onClick={handleSave}
              disabled={saving}
              className="px-4 py-2 text-xs font-semibold rounded bg-blue-600 hover:bg-blue-500 text-white transition disabled:opacity-50"
            >
              {saving ? "Saving..." : "Save Limits"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ==========================================
// 4. SUB-COMPONENT: AnalysisConfigTab (Settings/methods)
// ==========================================
interface AnalysisConfigTabProps {
  machines: MachineConfig[];
  refetch: () => void;
}

function AnalysisConfigTab({ machines, refetch }: AnalysisConfigTabProps) {
  const [selectedMachineId, setSelectedMachineId] = useState("");
  const [trendWindow, setTrendWindow] = useState(24);
  const [samplingRate, setSamplingRate] = useState(5);
  const [enabledAnalytics, setEnabledAnalytics] = useState<Array<"trend" | "histogram" | "fft">>([
    "trend"
  ]);

  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ text: string; type: "success" | "error" } | null>(null);

  useEffect(() => {
    if (selectedMachineId) {
      const selected = machines.find((m) => m.id === selectedMachineId);
      if (selected) {
        setTrendWindow(selected.analysisConfig?.trendWindow ?? 24);
        setSamplingRate(selected.analysisConfig?.samplingRate ?? 5);
        setEnabledAnalytics(selected.analysisConfig?.enabledAnalytics ?? ["trend"]);
      }
      setMessage(null);
    }
  }, [selectedMachineId, machines]);

  const toggleMethod = (method: "trend" | "histogram" | "fft") => {
    setEnabledAnalytics((prev) =>
      prev.includes(method) ? prev.filter((m) => m !== method) : [...prev, method]
    );
  };

  const handleSave = async () => {
    if (!selectedMachineId) return;
    setSaving(true);
    setMessage(null);
    try {
      await updateMachine(selectedMachineId, {
        analysisConfig: {
          trendWindow,
          samplingRate,
          enabledAnalytics
        }
      });
      refetch();
      setMessage({ text: "Analytics configuration updated successfully!", type: "success" });
    } catch (e) {
      setMessage({ text: "Failed to update configuration.", type: "error" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="bg-slate-950 border border-slate-850 rounded-xl p-5 shadow-lg space-y-4 text-slate-100">
      <div>
        <h3 className="text-sm font-bold text-slate-200 font-mono uppercase tracking-wider">
          Analytical & Fast Fourier Transform (FFT) Settings
        </h3>
        <p className="text-xs text-slate-500">Configure sampling intervals and active models for predictive diagnostics.</p>
      </div>

      <div className="max-w-xs">
        <label className="text-xs text-slate-400 font-medium block mb-1">Select Machine</label>
        <select
          value={selectedMachineId}
          onChange={(e) => setSelectedMachineId(e.target.value)}
          className="w-full rounded border border-slate-850 bg-slate-900 px-3 py-2 text-xs focus:outline-none focus:border-blue-500"
        >
          <option value="">-- Choose Machine --</option>
          {machines.map((m) => (
            <option key={m.id} value={m.id}>
              {m.name}
            </option>
          ))}
        </select>
      </div>

      {message && (
        <div
          className={`text-xs p-3 rounded border ${
            message.type === "success"
              ? "text-emerald-400 bg-emerald-950/20 border-emerald-900/60"
              : "text-rose-400 bg-rose-950/20 border-rose-900/60"
          }`}
        >
          {message.text}
        </div>
      )}

      {selectedMachineId && (
        <div className="space-y-4 pt-2">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs text-slate-400 font-medium">Trend Chart Window (Hours)</label>
              <input
                type="number"
                value={trendWindow}
                onChange={(e) => setTrendWindow(parseInt(e.target.value) || 24)}
                className="mt-1 w-full rounded border border-slate-850 bg-slate-900 px-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-blue-500"
              />
            </div>
            <div>
              <label className="text-xs text-slate-400 font-medium">Telemetry Sampling Rate (Seconds)</label>
              <input
                type="number"
                value={samplingRate}
                onChange={(e) => setSamplingRate(parseInt(e.target.value) || 5)}
                className="mt-1 w-full rounded border border-slate-850 bg-slate-900 px-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-blue-500"
              />
            </div>
          </div>

          <div>
            <label className="text-xs text-slate-400 font-medium block mb-2">Enabled AI / Analytical Methods</label>
            <div className="space-y-2">
              <label className="flex items-center gap-2 text-xs text-slate-300">
                <input
                  type="checkbox"
                  checked={enabledAnalytics.includes("trend")}
                  onChange={() => toggleMethod("trend")}
                  className="rounded border-slate-800 bg-slate-900"
                />
                Historical Trend Analysis
              </label>
              <label className="flex items-center gap-2 text-xs text-slate-300">
                <input
                  type="checkbox"
                  checked={enabledAnalytics.includes("histogram")}
                  onChange={() => toggleMethod("histogram")}
                  className="rounded border-slate-800 bg-slate-900"
                />
                Frequency Distribution Histograms
              </label>
              <label className="flex items-center gap-2 text-xs text-slate-300">
                <input
                  type="checkbox"
                  checked={enabledAnalytics.includes("fft")}
                  onChange={() => toggleMethod("fft")}
                  className="rounded border-slate-800 bg-slate-900"
                />
                Fast Fourier Transform (FFT) Analytics
              </label>
            </div>
          </div>

          <div className="flex justify-end pt-2">
            <button
              onClick={handleSave}
              disabled={saving}
              className="px-4 py-2 text-xs font-semibold rounded bg-blue-600 hover:bg-blue-500 text-white transition disabled:opacity-50"
            >
              {saving ? "Updating..." : "Update Settings"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function PidThresholdsTab() {
  const [savingPid, setSavingPid] = useState(false);
  const [pidForm, setPidForm] = useState<any>({
    basin_lvl: { warning: 75, alarm: 70 },
    supply_temp: { warning: 28, alarm: 30 },
    return_temp: { warning: 38, alarm: 40 },
    pressure: { warning: 1.5, alarm: 2.0 },
    st3_return_temp: { warning: 35, alarm: 40 },
    chemical_357_lvl: { warning: 75, alarm: 70 },
    chemical_327_lvl: { warning: 75, alarm: 70 }
  });

  useEffect(() => {
    getJson<{ data: any }>("/config/pid-thresholds")
      .then((res) => {
        if (res && res.data) {
          setPidForm(res.data);
        }
      })
      .catch(console.error);
  }, []);

  const handlePidChange = (paramKey: string, thresholdKey: "warning" | "alarm", val: number) => {
    setPidForm((prev: any) => ({
      ...prev,
      [paramKey]: {
        ...prev[paramKey],
        [thresholdKey]: val
      }
    }));
  };

  const handleSavePid = async () => {
    setSavingPid(true);
    try {
      await postJson("/config/pid-thresholds", pidForm);
      alert("P&ID Thresholds saved successfully!");
    } catch (err) {
      console.error(err);
      alert("Failed to save P&ID thresholds.");
    } finally {
      setSavingPid(false);
    }
  };

  return (
    <div className="rounded-lg border border-slate-800 bg-slate-950/70 p-6 space-y-6">
      <div className="text-sm font-bold uppercase tracking-[0.2em] text-blue-400">
        P&ID Parameter Configuration
      </div>
      
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {[
          { key: "basin_lvl", label: "Basin Level", unit: "%" },
          { key: "supply_temp", label: "Supply Temperature", unit: "°C" },
          { key: "return_temp", label: "Return Temperature", unit: "°C" },
          { key: "pressure", label: "System Pressure", unit: "BAR" },
          { key: "st3_return_temp", label: "ST-3 Return Temp", unit: "°C" },
          { key: "chemical_357_lvl", label: "Chemical 357 Level", unit: "%" },
          { key: "chemical_327_lvl", label: "Chemical 327/317 Level", unit: "%" }
        ].map((param) => (
          <div key={param.key} className="rounded-xl border border-slate-800 bg-slate-900/40 p-4 space-y-3">
            <div className="text-xs font-bold uppercase tracking-wider text-slate-300">
              {param.label} ({param.unit})
            </div>
            <div className="grid grid-cols-2 gap-3">
              <label className="text-[10px] text-slate-400 block">
                Warning Limit
                <input
                  type="number"
                  step="any"
                  value={pidForm[param.key]?.warning ?? ""}
                  onChange={(e) => handlePidChange(param.key, "warning", Number(e.target.value))}
                  className="mt-1 w-full rounded border border-slate-700 bg-slate-950 px-2 py-1 text-sm text-slate-200 font-mono focus:border-blue-500 outline-none"
                />
              </label>
              <label className="text-[10px] text-slate-400 block">
                Alarm Limit
                <input
                  type="number"
                  step="any"
                  value={pidForm[param.key]?.alarm ?? ""}
                  onChange={(e) => handlePidChange(param.key, "alarm", Number(e.target.value))}
                  className="mt-1 w-full rounded border border-slate-700 bg-slate-950 px-2 py-1 text-sm text-slate-200 font-mono focus:border-blue-500 outline-none"
                />
              </label>
            </div>
          </div>
        ))}
      </div>

      <div className="flex justify-end pt-4 border-t border-slate-900">
        <button
          type="button"
          onClick={handleSavePid}
          disabled={savingPid}
          className="rounded-full bg-blue-500 hover:bg-blue-600 disabled:opacity-60 disabled:cursor-not-allowed px-6 py-2.5 text-xs font-bold text-white shadow-md transition-colors"
        >
          {savingPid ? "Saving..." : "Save P&ID Thresholds"}
        </button>
      </div>
    </div>
  );
}

// ==========================================
// 5. MAIN DEFAULT EXPORT: MachinesConfigPage
// ==========================================
export default function MachinesConfigPage() {
  const { machines, categories, isLoading, error, refetch } = useMachineConfig();
  const [activeTab, setActiveTab] = useState<"machines" | "thresholds" | "analysis" | "pid">("machines");

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editingMachine, setEditingMachine] = useState<MachineConfig | null>(null);

  const handleEditMachine = (m: MachineConfig) => {
    setEditingMachine(m);
    setDrawerOpen(true);
  };

  const handleAddMachine = () => {
    setEditingMachine(null);
    setDrawerOpen(true);
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Machine Configuration"
        description="Manage dynamic category parameter bounds, api bindings and warning thresholds."
      />

      {/* Tabs Switcher */}
      <div className="flex gap-6 border-b border-slate-800 pb-2">
        <button
          onClick={() => setActiveTab("machines")}
          className={activeTab === "machines" ? "border-b-2 border-blue-500 text-blue-400 pb-2 text-sm font-medium" : "pb-2 text-sm font-medium text-slate-500 hover:text-slate-300 transition-colors"}
        >
          Machines
        </button>
        <button
          onClick={() => setActiveTab("thresholds")}
          className={activeTab === "thresholds" ? "border-b-2 border-blue-500 text-blue-400 pb-2 text-sm font-medium" : "pb-2 text-sm font-medium text-slate-500 hover:text-slate-300 transition-colors"}
        >
          Thresholds
        </button>
        <button
          onClick={() => setActiveTab("analysis")}
          className={activeTab === "analysis" ? "border-b-2 border-blue-500 text-blue-400 pb-2 text-sm font-medium" : "pb-2 text-sm font-medium text-slate-500 hover:text-slate-300 transition-colors"}
        >
          Analysis Config
        </button>
        <button
          onClick={() => setActiveTab("pid")}
          className={activeTab === "pid" ? "border-b-2 border-blue-500 text-blue-400 pb-2 text-sm font-medium" : "pb-2 text-sm font-medium text-slate-500 hover:text-slate-300 transition-colors"}
        >
          P&ID Parameters
        </button>
      </div>

      {error && !isLoading && (
        <div className="text-xs text-yellow-500 bg-yellow-500/10 border border-yellow-500/20 p-3 rounded-md">
          Loaded fallback configuration data. API Sync Error: {error}
        </div>
      )}

      {/* Active Tab rendering */}
      <div>
        {activeTab === "machines" && (
          <MachinesTab
            machines={machines}
            categories={categories}
            isLoading={isLoading}
            refetch={refetch}
            onEdit={handleEditMachine}
            onAdd={handleAddMachine}
          />
        )}

        {activeTab === "thresholds" && (
          <ThresholdsTab machines={machines} categories={categories} />
        )}

        {activeTab === "analysis" && (
          <AnalysisConfigTab machines={machines} refetch={refetch} />
        )}

        {activeTab === "pid" && (
          <PidThresholdsTab />
        )}
      </div>

      {/* The Dynamic Config Drawer Modal */}
      <MachineDrawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        machine={editingMachine}
        categories={categories}
        onSaved={() => {
          setDrawerOpen(false);
          refetch();
        }}
      />
    </div>
  );
}
