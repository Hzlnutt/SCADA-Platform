import { useMemo, useState } from "react";
import { PageHeader } from "../components/ui/PageHeader";
import { allEquipment } from "../data/equipment";
import { useTelemetryStore } from "../store/telemetry.store";

type EquipmentStatus = "Running" | "Standby" | "Stopped";
type OverrideStatus = EquipmentStatus | "Auto";

type EquipmentRow = {
  id: string;
  name: string;
  code: string;
  category: string;
  segment: "Utility" | "HVAC" | "WWTP";
  tagId?: string;
  value?: number;
  unit?: string;
  status: EquipmentStatus;
  autoStatus: EquipmentStatus;
  override: OverrideStatus;
};

const statusStyle: Record<EquipmentStatus, string> = {
  Running: "border-[#2f9e7f] bg-[#e7f7f1] text-[#1c7f63]",
  Standby: "border-[#e4b424] bg-[#fff6da] text-[#b98700]",
  Stopped: "border-[#e16767] bg-[#ffe4e4] text-[#b03a3a]"
};

const overrideOptions: { value: OverrideStatus; label: string }[] = [
  { value: "Auto", label: "Auto" },
  { value: "Running", label: "Running" },
  { value: "Standby", label: "Standby" },
  { value: "Stopped", label: "Stopped" }
];

const getAutoStatus = (value: number | undefined): EquipmentStatus => {
  if (value === undefined) {
    return "Standby";
  }
  if (value <= 0) {
    return "Stopped";
  }
  return "Running";
};

export default function UtilityStatus() {
  const latest = useTelemetryStore((state) => state.latest);
  const [overrides, setOverrides] = useState<Record<string, OverrideStatus>>({});

  const rows = useMemo(() => {
    return allEquipment.map((item) => {
      const rawValue = item.tagId ? latest[item.tagId]?.value : undefined;
      const numericValue = typeof rawValue === "number" ? rawValue : undefined;
      const autoStatus = getAutoStatus(numericValue);
      const override = overrides[item.id] ?? "Auto";
      const status = override === "Auto" ? autoStatus : override;

      return {
        id: item.id,
        name: item.name,
        code: item.code,
        category: item.category,
        segment: item.segment,
        tagId: item.tagId,
        value: numericValue,
        unit: item.unit,
        status,
        autoStatus,
        override
      } satisfies EquipmentRow;
    });
  }, [latest, overrides]);

  const grouped = useMemo(() => {
    return rows.reduce<Record<string, EquipmentRow[]>>((acc, row) => {
      acc[row.segment] = acc[row.segment] ?? [];
      acc[row.segment].push(row);
      return acc;
    }, {});
  }, [rows]);

  const summary = useMemo(() => {
    return rows.reduce(
      (acc, row) => {
        acc.total += 1;
        acc[row.status] += 1;
        if (row.override !== "Auto") {
          acc.manual += 1;
        }
        return acc;
      },
      { total: 0, Running: 0, Standby: 0, Stopped: 0, manual: 0 }
    );
  }, [rows]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Utility & HVAC Status"
        description="Status otomatis dari sistem dan override manual untuk peralatan utama."
      />

      <section className="rounded-2xl border border-[#bcd7f1] bg-white/80 p-4 shadow-[0_12px_32px_rgba(20,93,170,0.12)]">
        <div className="grid gap-3 md:grid-cols-4">
          <div className="rounded-xl border border-[#cde4ff] bg-[#f6fbff] px-4 py-3">
            <div className="text-xs uppercase tracking-[0.22em] text-[#2a5b91]">Running</div>
            <div className="mt-2 text-2xl font-semibold text-[#0b3a68]">
              {summary.Running}
            </div>
          </div>
          <div className="rounded-xl border border-[#cde4ff] bg-[#f6fbff] px-4 py-3">
            <div className="text-xs uppercase tracking-[0.22em] text-[#2a5b91]">Standby</div>
            <div className="mt-2 text-2xl font-semibold text-[#0b3a68]">
              {summary.Standby}
            </div>
          </div>
          <div className="rounded-xl border border-[#cde4ff] bg-[#f6fbff] px-4 py-3">
            <div className="text-xs uppercase tracking-[0.22em] text-[#2a5b91]">Stopped</div>
            <div className="mt-2 text-2xl font-semibold text-[#0b3a68]">
              {summary.Stopped}
            </div>
          </div>
          <div className="rounded-xl border border-[#cde4ff] bg-[#f6fbff] px-4 py-3">
            <div className="text-xs uppercase tracking-[0.22em] text-[#2a5b91]">Manual Override</div>
            <div className="mt-2 text-2xl font-semibold text-[#0b3a68]">
              {summary.manual}
            </div>
          </div>
        </div>
      </section>

      <div className="grid gap-4">
        {Object.entries(grouped).map(([segment, items]) => (
          <section
            key={segment}
            className="rounded-2xl border border-[#bcd7f1] bg-white/90 p-5 shadow-[0_16px_40px_rgba(20,93,170,0.12)]"
          >
            <div className="mb-4 flex items-center justify-between gap-3">
              <div className="text-sm font-semibold text-[#0b3a68]">
                {segment}
              </div>
              <div className="text-xs text-[#4c78a6]">
                {items.length} peralatan
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="text-xs uppercase tracking-[0.2em] text-[#4c78a6]">
                  <tr>
                    <th className="px-3 py-2">Equipment</th>
                    <th className="px-3 py-2">Category</th>
                    <th className="px-3 py-2">Code</th>
                    <th className="px-3 py-2">Tag</th>
                    <th className="px-3 py-2">Value</th>
                    <th className="px-3 py-2">Status</th>
                    <th className="px-3 py-2">Override</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#d7e8fb]">
                  {items.map((item) => (
                    <tr key={item.id} className="text-[#1b3f63]">
                      <td className="px-3 py-3 text-sm font-medium text-[#0b3a68]">
                        {item.name}
                      </td>
                      <td className="px-3 py-3 text-xs text-[#4c78a6]">
                        {item.category}
                      </td>
                      <td className="px-3 py-3 text-xs text-[#4c78a6]">
                        {item.code}
                      </td>
                      <td className="px-3 py-3 text-xs text-[#4c78a6]">
                        {item.tagId ?? "-"}
                      </td>
                      <td className="px-3 py-3 text-xs text-[#4c78a6]">
                        {item.value !== undefined
                          ? `${item.value.toFixed(2)} ${item.unit ?? ""}`
                          : "-"}
                      </td>
                      <td className="px-3 py-3 text-xs">
                        <div className="flex items-center gap-2">
                          <span
                            className={`rounded-full border px-2 py-1 ${statusStyle[item.status]}`}
                          >
                            {item.status}
                          </span>
                          {item.override !== "Auto" ? (
                            <span className="rounded-full bg-[#e0f0ff] px-2 py-0.5 text-[10px] uppercase tracking-[0.2em] text-[#2a5b91]">
                              Manual
                            </span>
                          ) : null}
                        </div>
                      </td>
                      <td className="px-3 py-3 text-xs">
                        <select
                          value={item.override}
                          onChange={(event) =>
                            setOverrides((prev) => ({
                              ...prev,
                              [item.id]: event.target.value as OverrideStatus
                            }))
                          }
                          className="w-full rounded-lg border border-[#cde4ff] bg-white px-2 py-1 text-xs text-[#0b3a68]"
                        >
                          {overrideOptions.map((option) => (
                            <option key={option.value} value={option.value}>
                              {option.label}
                            </option>
                          ))}
                        </select>
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
