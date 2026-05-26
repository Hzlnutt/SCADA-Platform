import { useEffect, useState } from "react";
import { useOutletContext } from "react-router-dom";
import { ConfirmDialog } from "../../components/ui/ConfirmDialog";
import { getUnitById } from "../../data/machines";
import { getJson, postJson } from "../../services/api.client";
import { useAuthStore } from "../../store/auth.store";
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

const formatDate = (value: string) => new Date(value).toLocaleString();

export default function MachineMaintenance() {
  const { unitId } = useOutletContext<MachineOutletContext>();
  const machine = getUnitById(unitId);
  const role = useAuthStore((state) => state.user?.role ?? "user");
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
    status: "completed",
    notes: ""
  });

  useEffect(() => {
    if (!machine) {
      return;
    }

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

  if (!machine) {
    return null;
  }

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
        status: form.status as MaintenanceItem["status"],
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

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    setConfirmOpen(true);
  };

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-slate-800 bg-slate-950/70 p-4">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="text-xs uppercase tracking-[0.2em] text-slate-500">
              Maintenance & History
            </div>
            <div className="mt-2 text-sm text-slate-300">
              Ringkasan kegiatan maintenance untuk {machine.name}.
            </div>
          </div>
          <div className="flex flex-wrap gap-2 text-[11px]">
            <button
              type="button"
              className="rounded-full border border-slate-700 px-3 py-1 text-slate-300"
            >
              View Record
            </button>
            <button
              type="button"
              className="rounded-full border border-slate-700 px-3 py-1 text-slate-300"
            >
              Data Improvement + Report Hasil Improvement
            </button>
            <button
              type="button"
              onClick={() => setFormOpen(true)}
              disabled={!canCreate}
              className="rounded-full border border-slate-700 px-3 py-1 text-slate-300 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Input Maintenance
            </button>
            <button
              type="button"
              className="rounded-full border border-slate-700 px-3 py-1 text-slate-300"
            >
              Data Part
            </button>
            <button
              type="button"
              className="rounded-full border border-slate-700 px-3 py-1 text-slate-300"
            >
              Input Abnormalitas
            </button>
          </div>
        </div>
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <div className="rounded-lg border border-slate-800 bg-slate-950/60 p-4">
            <div className="text-xs text-slate-500">Last Maintenance</div>
            <div className="mt-2 text-sm text-slate-200">
              {lastRecord ? formatDate(lastRecord.date) : "-"}
            </div>
          </div>
          <div className="rounded-lg border border-slate-800 bg-slate-950/60 p-4">
            <div className="text-xs text-slate-500">Item Maintenance</div>
            <div className="mt-2 text-sm text-slate-200">
              {lastRecord?.item ?? "-"}
            </div>
          </div>
        </div>
      </div>

      {canCreate ? (
        formOpen ? (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-6 backdrop-blur-sm">
            <div className="relative h-[90vh] w-[90vw] overflow-y-auto rounded-2xl border border-[#acd3ff] bg-white p-6 shadow-[0_20px_60px_rgba(0,0,0,0.2)]">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="text-xs uppercase tracking-[0.2em] text-[#1f6fb5]">
                    Input Maintenance
                  </div>
                  <div className="mt-1 text-sm text-[#47729f]">
                    Tambahkan history perbaikan baru.
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setFormOpen(false)}
                  className="rounded-full border border-[#acd3ff] px-3 py-1 text-xs font-semibold text-[#003b75]"
                >
                  Close
                </button>
              </div>
              <form onSubmit={handleSubmit} className="mt-5 space-y-4">
                <div className="grid gap-4 md:grid-cols-2">
                  <label className="text-xs text-[#47729f]">
                    Tanggal
                    <input
                      type="datetime-local"
                      value={form.date}
                      onChange={(event) => handleChange("date", event.target.value)}
                      className="mt-2 w-full rounded-md border border-[#d6e9fb] bg-white px-3 py-2 text-sm text-[#002b5c]"
                      required
                    />
                  </label>
                  <label className="text-xs text-[#47729f]">
                    Teknisi
                    <input
                      type="text"
                      value={form.technician}
                      onChange={(event) => handleChange("technician", event.target.value)}
                      className="mt-2 w-full rounded-md border border-[#d6e9fb] bg-white px-3 py-2 text-sm text-[#002b5c]"
                      required
                    />
                  </label>
                  <label className="text-xs text-[#47729f]">
                    Item Maintenance
                    <input
                      type="text"
                      value={form.item}
                      onChange={(event) => handleChange("item", event.target.value)}
                      className="mt-2 w-full rounded-md border border-[#d6e9fb] bg-white px-3 py-2 text-sm text-[#002b5c]"
                      required
                    />
                  </label>
                  <label className="text-xs text-[#47729f]">
                    Abnormalitas
                    <input
                      type="text"
                      value={form.abnormality}
                      onChange={(event) => handleChange("abnormality", event.target.value)}
                      className="mt-2 w-full rounded-md border border-[#d6e9fb] bg-white px-3 py-2 text-sm text-[#002b5c]"
                    />
                  </label>
                  <label className="text-xs text-[#47729f]">
                    Action
                    <input
                      type="text"
                      value={form.action}
                      onChange={(event) => handleChange("action", event.target.value)}
                      className="mt-2 w-full rounded-md border border-[#d6e9fb] bg-white px-3 py-2 text-sm text-[#002b5c]"
                      required
                    />
                  </label>
                  <label className="text-xs text-[#47729f]">
                    Downtime (jam)
                    <input
                      type="number"
                      step="0.1"
                      value={form.downtimeHours}
                      onChange={(event) => handleChange("downtimeHours", event.target.value)}
                      className="mt-2 w-full rounded-md border border-[#d6e9fb] bg-white px-3 py-2 text-sm text-[#002b5c]"
                      required
                    />
                  </label>
                  <label className="text-xs text-[#47729f]">
                    Status
                    <select
                      value={form.status}
                      onChange={(event) => handleChange("status", event.target.value)}
                      className="mt-2 w-full rounded-md border border-[#d6e9fb] bg-white px-3 py-2 text-sm text-[#002b5c]"
                    >
                      <option value="completed">Completed</option>
                      <option value="monitoring">Monitoring</option>
                      <option value="planned">Planned</option>
                    </select>
                  </label>
                </div>
                <label className="block text-xs text-[#47729f]">
                  Notes
                  <textarea
                    value={form.notes}
                    onChange={(event) => handleChange("notes", event.target.value)}
                    className="mt-2 w-full rounded-md border border-[#d6e9fb] bg-white px-3 py-2 text-sm text-[#002b5c]"
                    rows={4}
                  />
                </label>
                {error ? (
                  <div className="rounded-md border border-[#f5aa99] bg-[#ffe6df] px-3 py-2 text-xs text-[#b42318]">
                    {error}
                  </div>
                ) : null}
                <button
                  type="submit"
                  disabled={saving}
                  className="rounded-full bg-[#1f6fb5] px-4 py-2 text-xs font-semibold text-white disabled:cursor-not-allowed disabled:opacity-70"
                >
                  {saving ? "Menyimpan..." : "Simpan Perbaikan"}
                </button>
              </form>
            </div>
          </div>
        ) : null
      ) : (
        <div className="rounded-lg border border-slate-800 bg-slate-950/70 p-4 text-xs text-slate-500">
          Hanya operator, team head, leader, atau admin yang dapat menambahkan data maintenance.
        </div>
      )}

      <div className="rounded-lg border border-slate-800 bg-slate-950/70 p-4">
        <div className="overflow-x-auto">
          {loading ? (
            <div className="text-sm text-slate-400">Memuat data...</div>
          ) : records.length === 0 ? (
            <div className="text-sm text-slate-400">
              Belum ada data perbaikan.
            </div>
          ) : (
            <table className="w-full text-left text-sm">
              <thead className="text-xs uppercase tracking-[0.2em] text-slate-500">
                <tr>
                  <th className="px-3 py-2">Tanggal</th>
                  <th className="px-3 py-2">Item</th>
                  <th className="px-3 py-2">Abnormalitas</th>
                  <th className="px-3 py-2">Action</th>
                  <th className="px-3 py-2">Downtime</th>
                  <th className="px-3 py-2">Teknisi</th>
                  <th className="px-3 py-2">Status</th>
                  <th className="px-3 py-2">Approval</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-900">
                {records.map((record) => (
                  <tr key={record.id} className="text-slate-300">
                    <td className="px-3 py-3 text-xs text-slate-500">
                      {formatDate(record.date)}
                    </td>
                    <td className="px-3 py-3 text-sm text-slate-200">
                      {record.item}
                    </td>
                    <td className="px-3 py-3 text-xs text-slate-500">
                      {record.abnormality ?? "-"}
                    </td>
                    <td className="px-3 py-3 text-xs text-slate-400">
                      {record.action}
                    </td>
                    <td className="px-3 py-3 text-xs text-slate-500">
                      {record.downtimeHours} h
                    </td>
                    <td className="px-3 py-3 text-xs text-slate-500">
                      {record.technician}
                    </td>
                    <td className="px-3 py-3 text-xs capitalize text-slate-400">
                      {record.status}
                    </td>
                    <td className="px-3 py-3 text-xs text-slate-400">
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
        title="Konfirmasi simpan maintenance"
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
