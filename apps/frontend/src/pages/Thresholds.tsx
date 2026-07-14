import { useEffect, useMemo, useState } from "react";
import { PageHeader } from "../components/ui/PageHeader";
import { machineGroups } from "../data/machines";
import { getJson, putJson, postJson } from "../services/api.client";
import { useAuthStore } from "../store/auth.store";

const metrics = [
  { id: "kwh", label: "kWh" },
  { id: "kw", label: "kW" },
  { id: "pressure", label: "Pressure" },
  { id: "temperature", label: "Temperature" },
  { id: "flow", label: "Flow" },
  { id: "vibration", label: "Vibration" }
];

type ThresholdItem = {
  id: string;
  groupId: string;
  groupName: string;
  metric: string;
  unit: string;
  tagIds: string[];
  lower: number | null;
  upper: number | null;
  warningPct: number;
  actionText?: string | null;
};

type ThresholdListResponse = {
  data: ThresholdItem[];
};

export default function Thresholds() {
  const role = useAuthStore((state) => state.user?.role ?? "user");
  const canEdit = role === "team_head" || role === "leader" || role === "admin";
  const [thresholds, setThresholds] = useState<ThresholdItem[]>([]);
  const [selectedGroupId, setSelectedGroupId] = useState(() => machineGroups[0]?.id ?? "");
  const [form, setForm] = useState({
    metric: "kwh",
    unit: "kWh",
    lower: "",
    upper: "",
    warningPct: "0.9",
    actionText: ""
  });
  const [saving, setSaving] = useState(false);

  const [activeTab, setActiveTab] = useState<"machines" | "pid">("machines");
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
    if (activeTab === "pid") {
      getJson<{ data: any }>("/config/pid-thresholds")
        .then((res) => {
          if (res && res.data) {
            setPidForm(res.data);
          }
        })
        .catch(console.error);
    }
  }, [activeTab]);

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

  useEffect(() => {
    if (!canEdit) {
      return;
    }

    getJson<ThresholdListResponse>("/thresholds")
      .then((result) => setThresholds(result.data))
      .catch(() => setThresholds([]));
  }, [canEdit]);

  const selectedGroup = useMemo(
    () => machineGroups.find((group) => group.id === selectedGroupId),
    [selectedGroupId]
  );

  const appliedGroupIds = useMemo(
    () => new Set(thresholds.map((item) => item.groupId)),
    [thresholds]
  );

  useEffect(() => {
    if (!selectedGroup) {
      return;
    }

    const existing = thresholds.find((item) => item.groupId === selectedGroup.id);
    if (existing) {
      setForm({
        metric: existing.metric,
        unit: existing.unit,
        lower: existing.lower?.toString() ?? "",
        upper: existing.upper?.toString() ?? "",
        warningPct: existing.warningPct.toString(),
        actionText: existing.actionText ?? ""
      });
    } else {
      setForm({
        metric: "kwh",
        unit: "kWh",
        lower: "",
        upper: "",
        warningPct: "0.9",
        actionText: ""
      });
    }
  }, [selectedGroup, thresholds]);

  if (!canEdit) {
    return (
      <div>
        <PageHeader
          title="Thresholds"
          description="Only team heads, leaders, and administrators can modify alarm thresholds." 
        />
        <div className="rounded-lg border border-slate-900 bg-slate-950/60 p-6 text-sm text-slate-300">
          You do not have administrative access to edit warning thresholds.
        </div>
      </div>
    );
  }

  const handleChange = (field: keyof typeof form, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleSave = async () => {
    if (!selectedGroup) {
      return;
    }

    setSaving(true);
    const tagIds = selectedGroup.units.map((unit) => unit.tagId);
    const payload = {
      groupId: selectedGroup.id,
      groupName: selectedGroup.name,
      metric: form.metric,
      unit: form.unit,
      tagIds,
      lower: form.lower ? Number(form.lower) : null,
      upper: form.upper ? Number(form.upper) : null,
      warningPct: Number(form.warningPct || 0.9),
      actionText: form.actionText || undefined
    };

    try {
      const result = await putJson<{ data: ThresholdItem }>(
        `/thresholds/${selectedGroup.id}`,
        payload
      );
      setThresholds((prev) => {
        const others = prev.filter((item) => item.groupId !== selectedGroup.id);
        return [...others, result.data];
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Thresholds"
        description="Configure trigger levels and limit parameters for telemetry alerts and machine health indicators." 
      />

      <div className="flex gap-2 border-b border-slate-800 pb-2 mb-4">
        <button
          type="button"
          onClick={() => setActiveTab("machines")}
          className={`px-4 py-2 text-sm font-semibold rounded-lg transition-all ${
            activeTab === "machines"
              ? "bg-cyan-500/20 text-cyan-400 border border-cyan-500/30"
              : "text-slate-400 hover:text-slate-200"
          }`}
        >
          Machine Groups
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("pid")}
          className={`px-4 py-2 text-sm font-semibold rounded-lg transition-all ${
            activeTab === "pid"
              ? "bg-cyan-500/20 text-cyan-400 border border-cyan-500/30"
              : "text-slate-400 hover:text-slate-200"
          }`}
        >
          P&ID Parameters
        </button>
      </div>

      {activeTab === "machines" ? (
        <>
          <div className="grid gap-4 xl:grid-cols-[1fr_2fr]">
            <section className="rounded-lg border border-slate-800 bg-slate-950/70 p-5">
              <div className="text-xs uppercase tracking-[0.2em] text-slate-500">
                Machine Groups
              </div>
              <div className="mt-4 space-y-2">
                {machineGroups.map((group) => {
                  const applied = appliedGroupIds.has(group.id);
                  return (
                    <button
                      key={group.id}
                      type="button"
                      onClick={() => setSelectedGroupId(group.id)}
                      className={[
                        "w-full rounded-lg border px-3 py-2 text-left text-sm transition",
                        selectedGroupId === group.id
                          ? "border-cyan-400/60 bg-cyan-500/10 text-cyan-100"
                          : "border-slate-800 bg-slate-950/60 text-slate-300"
                      ].join(" ")}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span>{group.name}</span>
                        <span
                          className={[
                            "rounded-full border px-2 py-0.5 text-[10px]",
                            applied
                              ? "border-emerald-400/50 text-emerald-200"
                              : "border-slate-700 text-slate-500"
                          ].join(" ")}
                        >
                          {applied ? "Applied" : "Not Applied"}
                        </span>
                      </div>
                      <div className="mt-1 text-[11px] text-slate-500">
                        {group.category} · {group.units.length} units
                      </div>
                    </button>
                  );
                })}
              </div>
            </section>

            <section className="rounded-lg border border-slate-800 bg-slate-950/70 p-5">
              <div className="flex flex-wrap items-center gap-3">
                <label className="text-xs uppercase tracking-[0.2em] text-slate-500">
                  Machine Group
                </label>
                <select
                  value={selectedGroupId}
                  onChange={(event) => setSelectedGroupId(event.target.value)}
                  className="rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-200"
                >
                  {machineGroups.map((group) => (
                    <option key={group.id} value={group.id}>
                      {group.name}
                    </option>
                  ))}
                </select>
                <span
                  className={[
                    "rounded-full border px-2 py-0.5 text-[10px]",
                    appliedGroupIds.has(selectedGroupId)
                      ? "border-emerald-400/50 text-emerald-200"
                      : "border-slate-700 text-slate-500"
                  ].join(" ")}
                >
                  {appliedGroupIds.has(selectedGroupId) ? "Applied" : "Not Applied"}
                </span>
              </div>

              <div className="mt-4 grid gap-4 md:grid-cols-2">
                <label className="text-xs text-slate-400">
                  Metric
                  <select
                    value={form.metric}
                    onChange={(event) => handleChange("metric", event.target.value)}
                    className="mt-2 w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-200"
                  >
                    {metrics.map((metric) => (
                      <option key={metric.id} value={metric.id}>
                        {metric.label}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="text-xs text-slate-400">
                  Unit
                  <input
                    type="text"
                    value={form.unit}
                    onChange={(event) => handleChange("unit", event.target.value)}
                    className="mt-2 w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-200"
                  />
                </label>
                <label className="text-xs text-slate-400">
                  Lower Threshold
                  <input
                    type="number"
                    value={form.lower}
                    onChange={(event) => handleChange("lower", event.target.value)}
                    className="mt-2 w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-200"
                  />
                </label>
                <label className="text-xs text-slate-400">
                  Upper Threshold
                  <input
                    type="number"
                    value={form.upper}
                    onChange={(event) => handleChange("upper", event.target.value)}
                    className="mt-2 w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-200"
                  />
                </label>
                <label className="text-xs text-slate-400">
                  Warning Percent (0.5 - 0.99)
                  <input
                    type="number"
                    step="0.01"
                    value={form.warningPct}
                    onChange={(event) => handleChange("warningPct", event.target.value)}
                    className="mt-2 w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-200"
                  />
                </label>
                <label className="text-xs text-slate-400">
                  Action Text
                  <input
                    type="text"
                    value={form.actionText}
                    onChange={(event) => handleChange("actionText", event.target.value)}
                    className="mt-2 w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-200"
                  />
                </label>
              </div>

              <div className="mt-4 text-xs text-slate-500">
                Tag IDs: {selectedGroup?.units.map((unit) => unit.tagId).join(", ")}
              </div>

              <button
                type="button"
                onClick={handleSave}
                disabled={saving}
                className="mt-4 rounded-full bg-cyan-500/20 px-4 py-2 text-xs font-semibold text-cyan-100 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {saving ? "Saving..." : "Save Threshold"}
              </button>
            </section>
          </div>

          <section className="rounded-lg border border-slate-800 bg-slate-950/70 p-5 mt-6">
            <div className="text-xs uppercase tracking-[0.2em] text-slate-500">
              Thresholds Summary
            </div>
            <div className="mt-4 overflow-x-auto">
              {thresholds.length === 0 ? (
                <div className="text-sm text-slate-400">No threshold configurations defined.</div>
              ) : (
                <table className="w-full text-left text-sm">
                  <thead className="text-xs uppercase tracking-[0.2em] text-slate-500">
                    <tr>
                      <th className="px-3 py-2">Group</th>
                      <th className="px-3 py-2">Metric</th>
                      <th className="px-3 py-2">Lower</th>
                      <th className="px-3 py-2">Upper</th>
                      <th className="px-3 py-2">Warning %</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-900">
                    {thresholds.map((item) => (
                      <tr key={item.id} className="text-slate-300">
                        <td className="px-3 py-3 text-sm text-slate-200">
                          {item.groupName}
                        </td>
                        <td className="px-3 py-3 text-xs text-slate-400">
                          {item.metric.toUpperCase()}
                        </td>
                        <td className="px-3 py-3 text-xs text-slate-400">
                          {item.lower ?? "-"}
                        </td>
                        <td className="px-3 py-3 text-xs text-slate-400">
                          {item.upper ?? "-"}
                        </td>
                        <td className="px-3 py-3 text-xs text-slate-400">
                          {(item.warningPct * 100).toFixed(0)}%
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </section>
        </>
      ) : (
        <div className="rounded-lg border border-slate-800 bg-slate-950/70 p-6 space-y-6">
          <div className="text-sm font-bold uppercase tracking-[0.2em] text-cyan-400">
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
                      className="mt-1 w-full rounded border border-slate-700 bg-slate-950 px-2 py-1 text-sm text-slate-200 font-mono focus:border-cyan-500 outline-none"
                    />
                  </label>
                  <label className="text-[10px] text-slate-400 block">
                    Alarm Limit
                    <input
                      type="number"
                      step="any"
                      value={pidForm[param.key]?.alarm ?? ""}
                      onChange={(e) => handlePidChange(param.key, "alarm", Number(e.target.value))}
                      className="mt-1 w-full rounded border border-slate-700 bg-slate-950 px-2 py-1 text-sm text-slate-200 font-mono focus:border-cyan-500 outline-none"
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
              className="rounded-full bg-cyan-500 hover:bg-cyan-600 disabled:opacity-60 disabled:cursor-not-allowed px-6 py-2.5 text-xs font-bold text-white shadow-md transition-colors"
            >
              {savingPid ? "Saving..." : "Save P&ID Thresholds"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
