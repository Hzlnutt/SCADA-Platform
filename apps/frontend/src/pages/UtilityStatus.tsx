import { useEffect, useMemo, useState } from "react";
import { PageHeader } from "../components/ui/PageHeader";
import { machineGroups } from "../data/machines";
import { getJson } from "../services/api.client";
import { useTelemetryStore } from "../store/telemetry.store";

type ThresholdItem = {
  groupId: string;
  groupName: string;
  unit: string;
  lower: number | null;
  upper: number | null;
};

type ThresholdListResponse = {
  data: ThresholdItem[];
};

type UnitStatus = {
  id: string;
  name: string;
  tagId: string;
  status: "Running" | "Standby" | "Stopped";
  value?: number;
  unit?: string;
  category: string;
  groupName: string;
};

const statusStyle: Record<UnitStatus["status"], string> = {
  Running: "bg-emerald-500/15 text-emerald-200 border-emerald-500/40",
  Standby: "bg-amber-500/15 text-amber-200 border-amber-500/40",
  Stopped: "bg-red-500/15 text-red-200 border-red-500/40"
};

export default function UtilityStatus() {
  const latest = useTelemetryStore((state) => state.latest);
  const [thresholds, setThresholds] = useState<ThresholdItem[]>([]);

  useEffect(() => {
    getJson<ThresholdListResponse>("/thresholds")
      .then((result) => setThresholds(result.data))
      .catch(() => setThresholds([]));
  }, []);

  const units = useMemo(() => {
    return machineGroups.flatMap((group) => {
      const threshold = thresholds.find((item) => item.groupId === group.id);
      return group.units.map((unit) => {
        const value = latest[unit.tagId]?.value;
        const numericValue = typeof value === "number" ? value : undefined;
        let status: UnitStatus["status"] = numericValue === undefined ? "Standby" : "Running";

        if (numericValue !== undefined && threshold) {
          const upper = threshold.upper ?? null;
          const lower = threshold.lower ?? null;
          if ((upper !== null && numericValue >= upper) || (lower !== null && numericValue <= lower)) {
            status = "Stopped";
          }
        }

        return {
          id: unit.id,
          name: unit.unitLabel,
          tagId: unit.tagId,
          status,
          value: numericValue,
          unit: threshold?.unit ?? unit.unit,
          category: group.category,
          groupName: group.name
        } satisfies UnitStatus;
      });
    });
  }, [latest, thresholds]);

  const grouped = useMemo(() => {
    return units.reduce<Record<string, UnitStatus[]>>((acc, unit) => {
      acc[unit.category] = acc[unit.category] ?? [];
      acc[unit.category].push(unit);
      return acc;
    }, {});
  }, [units]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Utility & HVAC Status"
        description="Status Running, Standby, dan Stopped untuk seluruh peralatan." 
      />

      <div className="grid gap-4">
        {Object.entries(grouped).map(([category, items]) => (
          <section
            key={category}
            className="rounded-2xl border border-slate-800 bg-slate-950/70 p-5"
          >
            <div className="mb-4 flex items-center justify-between gap-3">
              <div className="text-sm font-semibold text-slate-100">
                {category}
              </div>
              <div className="text-xs text-slate-500">
                {items.length} peralatan
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="text-xs uppercase tracking-[0.2em] text-slate-500">
                  <tr>
                    <th className="px-3 py-2">Equipment</th>
                    <th className="px-3 py-2">Group</th>
                    <th className="px-3 py-2">Tag</th>
                    <th className="px-3 py-2">Value</th>
                    <th className="px-3 py-2">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-900">
                  {items.map((item) => (
                    <tr key={item.id} className="text-slate-300">
                      <td className="px-3 py-3 text-sm text-slate-200">
                        {item.name}
                      </td>
                      <td className="px-3 py-3 text-xs text-slate-500">
                        {item.groupName}
                      </td>
                      <td className="px-3 py-3 text-xs text-slate-500">
                        {item.tagId}
                      </td>
                      <td className="px-3 py-3 text-xs text-slate-400">
                        {item.value !== undefined
                          ? `${item.value.toFixed(2)} ${item.unit ?? ""}`
                          : "-"}
                      </td>
                      <td className="px-3 py-3 text-xs">
                        <span
                          className={`rounded-full border px-2 py-1 ${statusStyle[item.status]}`}
                        >
                          {item.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
