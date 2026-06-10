import { useEffect, useState } from "react";
import { useOutletContext } from "react-router-dom";
import { ConfirmDialog } from "../../components/ui/ConfirmDialog";
import { getUnitById } from "../../data/machines";
import { getJson, postJson } from "../../services/api.client";
import { useAuthStore } from "../../store/auth.store";
import type { MachineOutletContext } from "./MachineLayout";

type ShiftReportItem = {
  id: string;
  machineId: string;
  reportDate: string;
  shift: string;
  start: string;
  end: string;
  runtimeHours: number;
  downtimeHours: number;
  output: number;
  energy: number;
  notes?: string | null;
  approvalStatus?: string;
};

type ShiftReportListResponse = {
  data: ShiftReportItem[];
};

type ShiftReportCreateResponse = {
  data: ShiftReportItem;
};

const formatDate = (value: string) =>
  new Date(value).toLocaleDateString();

export default function MachineShiftReport() {
  const { unitId } = useOutletContext<MachineOutletContext>();
  const machine = getUnitById(unitId);
  const role = useAuthStore((state) => state.user?.role ?? "user");
  const [records, setRecords] = useState<ShiftReportItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [form, setForm] = useState({
    reportDate: new Date().toISOString().slice(0, 10),
    shift: "Shift A",
    start: "06:00",
    end: "14:00",
    runtimeHours: "0",
    downtimeHours: "0",
    output: "0",
    energy: "0",
    notes: ""
  });

  useEffect(() => {
    if (!machine) {
      return;
    }

    let active = true;
    setLoading(true);
    const statusParam = role === "user" ? "approved" : "all";
    getJson<ShiftReportListResponse>(
      `/machines/${machine.id}/shift-reports?limit=100&status=${statusParam}`
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

  if (!machine) {
    return null;
  }

  const canCreate = ["operator", "team_head", "leader", "admin"].includes(role);

  const handleChange = (field: keyof typeof form, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const submitForm = async () => {
    setSaving(true);
    setError(null);

    try {
      const payload = {
        reportDate: new Date(form.reportDate).toISOString(),
        shift: form.shift,
        start: form.start,
        end: form.end,
        runtimeHours: Number(form.runtimeHours),
        downtimeHours: Number(form.downtimeHours),
        output: Number(form.output),
        energy: Number(form.energy),
        notes: form.notes || undefined
      };

      const result = await postJson<ShiftReportCreateResponse>(
        `/machines/${machine.id}/shift-reports`,
        payload
      );

      setRecords((prev) => [result.data, ...prev]);
      setForm({
        reportDate: new Date().toISOString().slice(0, 10),
        shift: "Shift A",
        start: "06:00",
        end: "14:00",
        runtimeHours: "0",
        downtimeHours: "0",
        output: "0",
        energy: "0",
        notes: ""
      });
      setFormOpen(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal menyimpan data");
    } finally {
      setSaving(false);
    }
  };

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    setConfirmOpen(true);
  };

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-slate-800 bg-slate-950/70 p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="text-xs uppercase tracking-[0.2em] text-slate-500">
              Shift Report
            </div>
            <div className="mt-2 text-sm text-slate-300">
              Ringkasan shift untuk {machine.name}.
            </div>
          </div>
          <button
            type="button"
            onClick={() => setFormOpen(true)}
            disabled={!canCreate}
            className="rounded-full border border-slate-700 px-3 py-1 text-xs text-slate-300 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Input Shift Report
          </button>
        </div>
      </div>

      {canCreate ? (
        formOpen ? (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-6 backdrop-blur-sm">
            <div className="relative h-[90vh] w-[90vw] overflow-y-auto rounded-2xl border border-[#acd3ff] dark:border-slate-700 bg-white dark:bg-slate-800 p-6 shadow-[0_20px_60px_rgba(0,0,0,0.2)]">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="text-xs uppercase tracking-[0.2em] text-[#1f6fb5] dark:text-sky-400">
                    Form Shift Report
                  </div>
                  <div className="mt-1 text-sm text-[#47729f] dark:text-slate-400">
                    Tambahkan laporan shift baru.
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setFormOpen(false)}
                  className="rounded-full border border-[#acd3ff] dark:border-slate-600 px-3 py-1 text-xs font-semibold text-[#003b75] dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700"
                >
                  Close
                </button>
              </div>
              <form onSubmit={handleSubmit} className="mt-5 space-y-4">
                <div className="grid gap-4 md:grid-cols-2">
                  <label className="text-xs text-[#47729f] dark:text-slate-400">
                    Tanggal
                    <input
                      type="date"
                      value={form.reportDate}
                      onChange={(event) =>
                        handleChange("reportDate", event.target.value)
                      }
                      className="mt-2 w-full rounded-md border border-[#d6e9fb] dark:border-slate-600 bg-white dark:bg-slate-700 px-3 py-2 text-sm text-[#002b5c] dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-blue-500"
                      required
                    />
                  </label>
                  <label className="text-xs text-[#47729f] dark:text-slate-400">
                    Shift
                    <select
                      value={form.shift}
                      onChange={(event) => handleChange("shift", event.target.value)}
                      className="mt-2 w-full rounded-md border border-[#d6e9fb] dark:border-slate-600 bg-white dark:bg-slate-700 px-3 py-2 text-sm text-[#002b5c] dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-blue-500"
                    >
                      <option value="Shift A">Shift A</option>
                      <option value="Shift B">Shift B</option>
                      <option value="Shift C">Shift C</option>
                    </select>
                  </label>
                  <label className="text-xs text-[#47729f] dark:text-slate-400">
                    Start
                    <input
                      type="time"
                      value={form.start}
                      onChange={(event) => handleChange("start", event.target.value)}
                      className="mt-2 w-full rounded-md border border-[#d6e9fb] dark:border-slate-600 bg-white dark:bg-slate-700 px-3 py-2 text-sm text-[#002b5c] dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-blue-500"
                      required
                    />
                  </label>
                  <label className="text-xs text-[#47729f] dark:text-slate-400">
                    End
                    <input
                      type="time"
                      value={form.end}
                      onChange={(event) => handleChange("end", event.target.value)}
                      className="mt-2 w-full rounded-md border border-[#d6e9fb] dark:border-slate-600 bg-white dark:bg-slate-700 px-3 py-2 text-sm text-[#002b5c] dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-blue-500"
                      required
                    />
                  </label>
                  <label className="text-xs text-[#47729f] dark:text-slate-400">
                    Runtime (jam)
                    <input
                      type="number"
                      step="0.1"
                      value={form.runtimeHours}
                      onChange={(event) => handleChange("runtimeHours", event.target.value)}
                      className="mt-2 w-full rounded-md border border-[#d6e9fb] dark:border-slate-600 bg-white dark:bg-slate-700 px-3 py-2 text-sm text-[#002b5c] dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-blue-500"
                      required
                    />
                  </label>
                  <label className="text-xs text-[#47729f] dark:text-slate-400">
                    Downtime (jam)
                    <input
                      type="number"
                      step="0.1"
                      value={form.downtimeHours}
                      onChange={(event) => handleChange("downtimeHours", event.target.value)}
                      className="mt-2 w-full rounded-md border border-[#d6e9fb] dark:border-slate-600 bg-white dark:bg-slate-700 px-3 py-2 text-sm text-[#002b5c] dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-blue-500"
                      required
                    />
                  </label>
                  <label className="text-xs text-[#47729f] dark:text-slate-400">
                    Output
                    <input
                      type="number"
                      step="0.1"
                      value={form.output}
                      onChange={(event) => handleChange("output", event.target.value)}
                      className="mt-2 w-full rounded-md border border-[#d6e9fb] dark:border-slate-600 bg-white dark:bg-slate-700 px-3 py-2 text-sm text-[#002b5c] dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-blue-500"
                      required
                    />
                  </label>
                  <label className="text-xs text-[#47729f] dark:text-slate-400">
                    Energy (MWh)
                    <input
                      type="number"
                      step="0.1"
                      value={form.energy}
                      onChange={(event) => handleChange("energy", event.target.value)}
                      className="mt-2 w-full rounded-md border border-[#d6e9fb] dark:border-slate-600 bg-white dark:bg-slate-700 px-3 py-2 text-sm text-[#002b5c] dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-blue-500"
                      required
                    />
                  </label>
                </div>
                <label className="block text-xs text-[#47729f] dark:text-slate-400">
                  Notes
                  <textarea
                    value={form.notes}
                    onChange={(event) => handleChange("notes", event.target.value)}
                    className="mt-2 w-full rounded-md border border-[#d6e9fb] dark:border-slate-600 bg-white dark:bg-slate-700 px-3 py-2 text-sm text-[#002b5c] dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-blue-500"
                    rows={4}
                  />
                </label>
                {error ? (
                  <div className="rounded-md border border-[#f5aa99] dark:border-rose-900/50 bg-[#ffe6df] dark:bg-rose-950/20 px-3 py-2 text-xs text-[#b42318] dark:text-rose-400">
                    {error}
                  </div>
                ) : null}
                <button
                  type="submit"
                  disabled={saving}
                  className="rounded-full bg-[#1f6fb5] dark:bg-blue-600 hover:bg-[#155c99] dark:hover:bg-blue-700 px-4 py-2 text-xs font-semibold text-white disabled:cursor-not-allowed disabled:opacity-70 transition"
                >
                  {saving ? "Menyimpan..." : "Simpan Shift Report"}
                </button>
              </form>
            </div>
          </div>
        ) : null
      ) : (
        <div className="rounded-lg border border-slate-800 bg-slate-950/70 p-4 text-xs text-slate-500">
          Hanya operator, team head, leader, atau admin yang dapat menambahkan shift report.
        </div>
      )}

      <div className="rounded-lg border border-slate-800 bg-slate-950/70 p-4">
        <div className="overflow-x-auto">
          {loading ? (
            <div className="text-sm text-slate-400">Memuat data...</div>
          ) : records.length === 0 ? (
            <div className="text-sm text-slate-400">
              Belum ada data shift report.
            </div>
          ) : (
            <table className="w-full text-left text-sm">
              <thead className="text-xs uppercase tracking-[0.2em] text-slate-500">
                <tr>
                  <th className="px-3 py-2">Tanggal</th>
                  <th className="px-3 py-2">Shift</th>
                  <th className="px-3 py-2">Start</th>
                  <th className="px-3 py-2">End</th>
                  <th className="px-3 py-2">Runtime</th>
                  <th className="px-3 py-2">Downtime</th>
                  <th className="px-3 py-2">Output</th>
                  <th className="px-3 py-2">Energy</th>
                  <th className="px-3 py-2">Approval</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-900">
                {records.map((shift) => (
                  <tr key={shift.id} className="text-slate-300">
                    <td className="px-3 py-3 text-xs text-slate-500">
                      {formatDate(shift.reportDate)}
                    </td>
                    <td className="px-3 py-3 text-sm text-slate-200">
                      {shift.shift}
                    </td>
                    <td className="px-3 py-3 text-xs text-slate-500">
                      {shift.start}
                    </td>
                    <td className="px-3 py-3 text-xs text-slate-500">
                      {shift.end}
                    </td>
                    <td className="px-3 py-3 text-xs text-slate-500">
                      {shift.runtimeHours.toFixed(1)} h
                    </td>
                    <td className="px-3 py-3 text-xs text-slate-500">
                      {shift.downtimeHours.toFixed(1)} h
                    </td>
                    <td className="px-3 py-3 text-xs text-slate-500">
                      {shift.output}
                    </td>
                    <td className="px-3 py-3 text-xs text-slate-500">
                      {shift.energy} MWh
                    </td>
                    <td className="px-3 py-3 text-xs text-slate-400">
                      {shift.approvalStatus ?? "approved"}
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
        title="Konfirmasi simpan shift report"
        description="Apakah Anda yakin ingin menyimpan laporan shift ini?"
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
