import { useEffect, useMemo, useState } from "react";
import { ConfirmDialog } from "../components/ui/ConfirmDialog";
import { PageHeader } from "../components/ui/PageHeader";
import { machineUnits } from "../data/machines";
import { getJson, patchJson } from "../services/api.client";
import { useAuthStore } from "../store/auth.store";

type UserItem = {
  _id: string;
  email: string;
  name: string;
  role: "admin" | "leader" | "operator" | "team_head" | "user";
  status?: "active" | "disabled";
};

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
};

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
};

const roleOptions: Array<UserItem["role"]> = [
  "admin",
  "leader",
  "operator",
  "team_head",
  "user"
];

export default function AdminPanel() {
  const role = useAuthStore((state) => state.user?.role ?? "user");
  const [users, setUsers] = useState<UserItem[]>([]);
  const [usersLoading, setUsersLoading] = useState(true);
  const [savingUserId, setSavingUserId] = useState<string | null>(null);
  const [pendingRoleUser, setPendingRoleUser] = useState<UserItem | null>(null);

  const [maintenanceRecords, setMaintenanceRecords] = useState<MaintenanceItem[]>([]);
  const [maintenanceLoading, setMaintenanceLoading] = useState(true);
  const [editingMaintenance, setEditingMaintenance] = useState<MaintenanceItem | null>(null);
  const [maintenanceSaving, setMaintenanceSaving] = useState(false);
  const [confirmMaintenance, setConfirmMaintenance] = useState(false);

  const [shiftReports, setShiftReports] = useState<ShiftReportItem[]>([]);
  const [shiftLoading, setShiftLoading] = useState(true);
  const [editingShift, setEditingShift] = useState<ShiftReportItem | null>(null);
  const [shiftSaving, setShiftSaving] = useState(false);
  const [confirmShift, setConfirmShift] = useState(false);

  const machineNameMap = useMemo(() => {
    const map: Record<string, string> = {};
    machineUnits.forEach((machine) => {
      map[machine.id] = machine.name;
    });
    return map;
  }, []);

  useEffect(() => {
    if (role !== "admin") {
      return;
    }

    let active = true;
    getJson<{ data: UserItem[] }>("/users?limit=200")
      .then((result) => {
        if (active) {
          setUsers(result.data);
        }
      })
      .finally(() => {
        if (active) {
          setUsersLoading(false);
        }
      });

    return () => {
      active = false;
    };
  }, [role]);

  useEffect(() => {
    if (role !== "admin") {
      return;
    }

    let active = true;
    getJson<{ data: MaintenanceItem[] }>("/maintenance?limit=20&status=all")
      .then((result) => {
        if (active) {
          setMaintenanceRecords(result.data);
        }
      })
      .finally(() => {
        if (active) {
          setMaintenanceLoading(false);
        }
      });

    return () => {
      active = false;
    };
  }, [role]);

  useEffect(() => {
    if (role !== "admin") {
      return;
    }

    let active = true;
    getJson<{ data: ShiftReportItem[] }>("/shift-reports?limit=20&status=all")
      .then((result) => {
        if (active) {
          setShiftReports(result.data);
        }
      })
      .finally(() => {
        if (active) {
          setShiftLoading(false);
        }
      });

    return () => {
      active = false;
    };
  }, [role]);

  if (role !== "admin") {
    return (
      <div>
        <PageHeader
          title="Admin Panel"
          description="Hanya admin yang dapat mengelola data dan role user."
        />
        <div className="rounded-lg border border-slate-900 bg-slate-950/60 p-6 text-sm text-slate-300">
          Anda tidak memiliki akses admin.
        </div>
      </div>
    );
  }

  const handleRoleChange = (id: string, newRole: UserItem["role"]) => {
    setUsers((prev) =>
      prev.map((user) => (user._id === id ? { ...user, role: newRole } : user))
    );
  };

  const handleSaveRole = async (user: UserItem) => {
    setSavingUserId(user._id);
    try {
      const result = await patchJson<{ data: UserItem }>(
        `/users/${user._id}`,
        { role: user.role }
      );
      setUsers((prev) =>
        prev.map((item) => (item._id === user._id ? result.data : item))
      );
    } finally {
      setSavingUserId(null);
    }
  };

  const handleMaintenanceEdit = (record: MaintenanceItem) => {
    setEditingMaintenance({ ...record });
  };

  const handleShiftEdit = (record: ShiftReportItem) => {
    setEditingShift({ ...record });
  };

  const handleSaveMaintenance = async () => {
    if (!editingMaintenance) {
      return;
    }
    setMaintenanceSaving(true);
    try {
      const payload = {
        date: editingMaintenance.date,
        item: editingMaintenance.item,
        abnormality: editingMaintenance.abnormality ?? undefined,
        action: editingMaintenance.action,
        downtimeHours: editingMaintenance.downtimeHours,
        technician: editingMaintenance.technician,
        status: editingMaintenance.status,
        notes: editingMaintenance.notes ?? undefined
      };
      const result = await patchJson<{ data: MaintenanceItem }>(
        `/machines/${editingMaintenance.machineId}/maintenance/${editingMaintenance.id}`,
        payload
      );
      setMaintenanceRecords((prev) =>
        prev.map((item) => (item.id === result.data.id ? result.data : item))
      );
      setEditingMaintenance(null);
    } finally {
      setMaintenanceSaving(false);
    }
  };

  const handleSaveShift = async () => {
    if (!editingShift) {
      return;
    }
    setShiftSaving(true);
    try {
      const payload = {
        reportDate: editingShift.reportDate,
        shift: editingShift.shift,
        start: editingShift.start,
        end: editingShift.end,
        runtimeHours: editingShift.runtimeHours,
        downtimeHours: editingShift.downtimeHours,
        output: editingShift.output,
        energy: editingShift.energy,
        notes: editingShift.notes ?? undefined
      };
      const result = await patchJson<{ data: ShiftReportItem }>(
        `/machines/${editingShift.machineId}/shift-reports/${editingShift.id}`,
        payload
      );
      setShiftReports((prev) =>
        prev.map((item) => (item.id === result.data.id ? result.data : item))
      );
      setEditingShift(null);
    } finally {
      setShiftSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Admin Panel"
        description="Kelola role user serta koreksi data historis PLC."
      />

      <section className="rounded-lg border border-slate-900 bg-slate-950/60 p-5">
        <div className="text-xs uppercase tracking-[0.2em] text-slate-500">
          User Management
        </div>
        <div className="mt-4 overflow-x-auto">
          {usersLoading ? (
            <div className="text-sm text-slate-400">Memuat user...</div>
          ) : (
            <table className="w-full text-left text-sm">
              <thead className="text-xs uppercase tracking-[0.2em] text-slate-500">
                <tr>
                  <th className="px-3 py-2">Nama</th>
                  <th className="px-3 py-2">Email</th>
                  <th className="px-3 py-2">Role</th>
                  <th className="px-3 py-2">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-900">
                {users.map((user) => (
                  <tr key={user._id} className="text-slate-300">
                    <td className="px-3 py-3 text-sm text-slate-200">
                      {user.name}
                    </td>
                    <td className="px-3 py-3 text-xs text-slate-500">
                      {user.email}
                    </td>
                    <td className="px-3 py-3">
                      <select
                        value={user.role}
                        onChange={(event) =>
                          handleRoleChange(user._id, event.target.value as UserItem["role"])
                        }
                        className="rounded-md border border-slate-800 bg-white px-2 py-1 text-xs text-[#002b5c]"
                      >
                        {roleOptions.map((option) => (
                          <option key={option} value={option}>
                            {option}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="px-3 py-3">
                      <button
                        type="button"
                        onClick={() => setPendingRoleUser(user)}
                        disabled={savingUserId === user._id}
                        className="rounded-full border border-slate-700 px-3 py-1 text-xs text-slate-300 disabled:opacity-60"
                      >
                        {savingUserId === user._id ? "Menyimpan..." : "Simpan"}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </section>

      <section className="rounded-lg border border-slate-900 bg-slate-950/60 p-5">
        <div className="text-xs uppercase tracking-[0.2em] text-slate-500">
          Koreksi Maintenance
        </div>
        <div className="mt-4 overflow-x-auto">
          {maintenanceLoading ? (
            <div className="text-sm text-slate-400">Memuat data...</div>
          ) : maintenanceRecords.length === 0 ? (
            <div className="text-sm text-slate-400">Tidak ada data.</div>
          ) : (
            <table className="w-full text-left text-sm">
              <thead className="text-xs uppercase tracking-[0.2em] text-slate-500">
                <tr>
                  <th className="px-3 py-2">Tanggal</th>
                  <th className="px-3 py-2">Machine</th>
                  <th className="px-3 py-2">Item</th>
                  <th className="px-3 py-2">Abnormalitas</th>
                  <th className="px-3 py-2">Teknisi</th>
                  <th className="px-3 py-2">Status</th>
                  <th className="px-3 py-2">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-900">
                {maintenanceRecords.map((record) => (
                  <tr key={record.id} className="text-slate-300">
                    <td className="px-3 py-3 text-xs text-slate-500">
                      {new Date(record.date).toLocaleString()}
                    </td>
                    <td className="px-3 py-3 text-sm text-slate-200">
                      {machineNameMap[record.machineId] ?? record.machineId}
                    </td>
                    <td className="px-3 py-3 text-xs text-slate-400">
                      {record.item}
                    </td>
                    <td className="px-3 py-3 text-xs text-slate-500">
                      {record.abnormality ?? "-"}
                    </td>
                    <td className="px-3 py-3 text-xs text-slate-500">
                      {record.technician}
                    </td>
                    <td className="px-3 py-3 text-xs capitalize text-slate-400">
                      {record.status}
                    </td>
                    <td className="px-3 py-3">
                      <button
                        type="button"
                        onClick={() => handleMaintenanceEdit(record)}
                        className="rounded-full border border-slate-700 px-3 py-1 text-xs text-slate-300"
                      >
                        Edit
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
        {editingMaintenance ? (
          <div className="mt-4 rounded-lg border border-slate-800 bg-slate-950/70 p-4">
            <div className="mb-3 text-xs uppercase tracking-[0.2em] text-slate-500">
              Edit Maintenance
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <label className="text-xs text-slate-500">
                Tanggal
                <input
                  type="datetime-local"
                  value={new Date(editingMaintenance.date).toISOString().slice(0, 16)}
                  onChange={(event) =>
                    setEditingMaintenance((prev) =>
                      prev
                        ? {
                            ...prev,
                            date: new Date(event.target.value).toISOString()
                          }
                        : prev
                    )
                  }
                  className="mt-2 w-full rounded-md border border-slate-800 bg-white px-3 py-2 text-sm text-[#002b5c]"
                />
              </label>
              <label className="text-xs text-slate-500">
                Item
                <input
                  type="text"
                  value={editingMaintenance.item}
                  onChange={(event) =>
                    setEditingMaintenance((prev) =>
                      prev ? { ...prev, item: event.target.value } : prev
                    )
                  }
                  className="mt-2 w-full rounded-md border border-slate-800 bg-white px-3 py-2 text-sm text-[#002b5c]"
                />
              </label>
              <label className="text-xs text-slate-500">
                Abnormalitas
                <input
                  type="text"
                  value={editingMaintenance.abnormality ?? ""}
                  onChange={(event) =>
                    setEditingMaintenance((prev) =>
                      prev
                        ? { ...prev, abnormality: event.target.value }
                        : prev
                    )
                  }
                  className="mt-2 w-full rounded-md border border-slate-800 bg-white px-3 py-2 text-sm text-[#002b5c]"
                />
              </label>
              <label className="text-xs text-slate-500">
                Action
                <input
                  type="text"
                  value={editingMaintenance.action}
                  onChange={(event) =>
                    setEditingMaintenance((prev) =>
                      prev ? { ...prev, action: event.target.value } : prev
                    )
                  }
                  className="mt-2 w-full rounded-md border border-slate-800 bg-white px-3 py-2 text-sm text-[#002b5c]"
                />
              </label>
              <label className="text-xs text-slate-500">
                Downtime (jam)
                <input
                  type="number"
                  step="0.1"
                  value={editingMaintenance.downtimeHours}
                  onChange={(event) =>
                    setEditingMaintenance((prev) =>
                      prev
                        ? { ...prev, downtimeHours: Number(event.target.value) }
                        : prev
                    )
                  }
                  className="mt-2 w-full rounded-md border border-slate-800 bg-white px-3 py-2 text-sm text-[#002b5c]"
                />
              </label>
              <label className="text-xs text-slate-500">
                Teknisi
                <input
                  type="text"
                  value={editingMaintenance.technician}
                  onChange={(event) =>
                    setEditingMaintenance((prev) =>
                      prev ? { ...prev, technician: event.target.value } : prev
                    )
                  }
                  className="mt-2 w-full rounded-md border border-slate-800 bg-white px-3 py-2 text-sm text-[#002b5c]"
                />
              </label>
              <label className="text-xs text-slate-500">
                Status
                <select
                  value={editingMaintenance.status}
                  onChange={(event) =>
                    setEditingMaintenance((prev) =>
                      prev
                        ? {
                            ...prev,
                            status: event.target.value as MaintenanceItem["status"]
                          }
                        : prev
                    )
                  }
                  className="mt-2 w-full rounded-md border border-slate-800 bg-white px-3 py-2 text-sm text-[#002b5c]"
                >
                  <option value="completed">Completed</option>
                  <option value="monitoring">Monitoring</option>
                  <option value="planned">Planned</option>
                </select>
              </label>
            </div>
            <label className="mt-4 block text-xs text-slate-500">
              Notes
              <textarea
                value={editingMaintenance.notes ?? ""}
                onChange={(event) =>
                  setEditingMaintenance((prev) =>
                    prev ? { ...prev, notes: event.target.value } : prev
                  )
                }
                className="mt-2 w-full rounded-md border border-slate-800 bg-white px-3 py-2 text-sm text-[#002b5c]"
                rows={3}
              />
            </label>
            <div className="mt-4 flex gap-3">
              <button
                type="button"
                onClick={() => setConfirmMaintenance(true)}
                disabled={maintenanceSaving}
                className="rounded-full bg-[#1f6fb5] px-4 py-2 text-xs font-semibold text-white disabled:opacity-70"
              >
                {maintenanceSaving ? "Menyimpan..." : "Simpan Perubahan"}
              </button>
              <button
                type="button"
                onClick={() => setEditingMaintenance(null)}
                className="rounded-full border border-slate-700 px-4 py-2 text-xs text-slate-300"
              >
                Batal
              </button>
            </div>
          </div>
        ) : null}
      </section>

      <section className="rounded-lg border border-slate-900 bg-slate-950/60 p-5">
        <div className="text-xs uppercase tracking-[0.2em] text-slate-500">
          Koreksi Shift Report
        </div>
        <div className="mt-4 overflow-x-auto">
          {shiftLoading ? (
            <div className="text-sm text-slate-400">Memuat data...</div>
          ) : shiftReports.length === 0 ? (
            <div className="text-sm text-slate-400">Tidak ada data.</div>
          ) : (
            <table className="w-full text-left text-sm">
              <thead className="text-xs uppercase tracking-[0.2em] text-slate-500">
                <tr>
                  <th className="px-3 py-2">Tanggal</th>
                  <th className="px-3 py-2">Machine</th>
                  <th className="px-3 py-2">Shift</th>
                  <th className="px-3 py-2">Runtime</th>
                  <th className="px-3 py-2">Downtime</th>
                  <th className="px-3 py-2">Output</th>
                  <th className="px-3 py-2">Energy</th>
                  <th className="px-3 py-2">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-900">
                {shiftReports.map((report) => (
                  <tr key={report.id} className="text-slate-300">
                    <td className="px-3 py-3 text-xs text-slate-500">
                      {new Date(report.reportDate).toLocaleDateString()}
                    </td>
                    <td className="px-3 py-3 text-sm text-slate-200">
                      {machineNameMap[report.machineId] ?? report.machineId}
                    </td>
                    <td className="px-3 py-3 text-xs text-slate-400">
                      {report.shift}
                    </td>
                    <td className="px-3 py-3 text-xs text-slate-500">
                      {report.runtimeHours.toFixed(1)} h
                    </td>
                    <td className="px-3 py-3 text-xs text-slate-500">
                      {report.downtimeHours.toFixed(1)} h
                    </td>
                    <td className="px-3 py-3 text-xs text-slate-500">
                      {report.output}
                    </td>
                    <td className="px-3 py-3 text-xs text-slate-500">
                      {report.energy} MWh
                    </td>
                    <td className="px-3 py-3">
                      <button
                        type="button"
                        onClick={() => handleShiftEdit(report)}
                        className="rounded-full border border-slate-700 px-3 py-1 text-xs text-slate-300"
                      >
                        Edit
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
        {editingShift ? (
          <div className="mt-4 rounded-lg border border-slate-800 bg-slate-950/70 p-4">
            <div className="mb-3 text-xs uppercase tracking-[0.2em] text-slate-500">
              Edit Shift Report
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <label className="text-xs text-slate-500">
                Tanggal
                <input
                  type="date"
                  value={new Date(editingShift.reportDate).toISOString().slice(0, 10)}
                  onChange={(event) =>
                    setEditingShift((prev) =>
                      prev
                        ? {
                            ...prev,
                            reportDate: new Date(event.target.value).toISOString()
                          }
                        : prev
                    )
                  }
                  className="mt-2 w-full rounded-md border border-slate-800 bg-white px-3 py-2 text-sm text-[#002b5c]"
                />
              </label>
              <label className="text-xs text-slate-500">
                Shift
                <input
                  type="text"
                  value={editingShift.shift}
                  onChange={(event) =>
                    setEditingShift((prev) =>
                      prev ? { ...prev, shift: event.target.value } : prev
                    )
                  }
                  className="mt-2 w-full rounded-md border border-slate-800 bg-white px-3 py-2 text-sm text-[#002b5c]"
                />
              </label>
              <label className="text-xs text-slate-500">
                Start
                <input
                  type="time"
                  value={editingShift.start}
                  onChange={(event) =>
                    setEditingShift((prev) =>
                      prev ? { ...prev, start: event.target.value } : prev
                    )
                  }
                  className="mt-2 w-full rounded-md border border-slate-800 bg-white px-3 py-2 text-sm text-[#002b5c]"
                />
              </label>
              <label className="text-xs text-slate-500">
                End
                <input
                  type="time"
                  value={editingShift.end}
                  onChange={(event) =>
                    setEditingShift((prev) =>
                      prev ? { ...prev, end: event.target.value } : prev
                    )
                  }
                  className="mt-2 w-full rounded-md border border-slate-800 bg-white px-3 py-2 text-sm text-[#002b5c]"
                />
              </label>
              <label className="text-xs text-slate-500">
                Runtime (jam)
                <input
                  type="number"
                  step="0.1"
                  value={editingShift.runtimeHours}
                  onChange={(event) =>
                    setEditingShift((prev) =>
                      prev
                        ? {
                            ...prev,
                            runtimeHours: Number(event.target.value)
                          }
                        : prev
                    )
                  }
                  className="mt-2 w-full rounded-md border border-slate-800 bg-white px-3 py-2 text-sm text-[#002b5c]"
                />
              </label>
              <label className="text-xs text-slate-500">
                Downtime (jam)
                <input
                  type="number"
                  step="0.1"
                  value={editingShift.downtimeHours}
                  onChange={(event) =>
                    setEditingShift((prev) =>
                      prev
                        ? {
                            ...prev,
                            downtimeHours: Number(event.target.value)
                          }
                        : prev
                    )
                  }
                  className="mt-2 w-full rounded-md border border-slate-800 bg-white px-3 py-2 text-sm text-[#002b5c]"
                />
              </label>
              <label className="text-xs text-slate-500">
                Output
                <input
                  type="number"
                  step="0.1"
                  value={editingShift.output}
                  onChange={(event) =>
                    setEditingShift((prev) =>
                      prev ? { ...prev, output: Number(event.target.value) } : prev
                    )
                  }
                  className="mt-2 w-full rounded-md border border-slate-800 bg-white px-3 py-2 text-sm text-[#002b5c]"
                />
              </label>
              <label className="text-xs text-slate-500">
                Energy (MWh)
                <input
                  type="number"
                  step="0.1"
                  value={editingShift.energy}
                  onChange={(event) =>
                    setEditingShift((prev) =>
                      prev ? { ...prev, energy: Number(event.target.value) } : prev
                    )
                  }
                  className="mt-2 w-full rounded-md border border-slate-800 bg-white px-3 py-2 text-sm text-[#002b5c]"
                />
              </label>
            </div>
            <label className="mt-4 block text-xs text-slate-500">
              Notes
              <textarea
                value={editingShift.notes ?? ""}
                onChange={(event) =>
                  setEditingShift((prev) =>
                    prev ? { ...prev, notes: event.target.value } : prev
                  )
                }
                className="mt-2 w-full rounded-md border border-slate-800 bg-white px-3 py-2 text-sm text-[#002b5c]"
                rows={3}
              />
            </label>
            <div className="mt-4 flex gap-3">
              <button
                type="button"
                onClick={() => setConfirmShift(true)}
                disabled={shiftSaving}
                className="rounded-full bg-[#1f6fb5] px-4 py-2 text-xs font-semibold text-white disabled:opacity-70"
              >
                {shiftSaving ? "Menyimpan..." : "Simpan Perubahan"}
              </button>
              <button
                type="button"
                onClick={() => setEditingShift(null)}
                className="rounded-full border border-slate-700 px-4 py-2 text-xs text-slate-300"
              >
                Batal
              </button>
            </div>
          </div>
        ) : null}
      </section>

      <ConfirmDialog
        open={Boolean(pendingRoleUser)}
        title="Konfirmasi ubah role"
        description="Apakah Anda yakin ingin memperbarui role user ini?"
        confirmText="Ya"
        cancelText="Tidak"
        onConfirm={() => {
          const user = pendingRoleUser;
          setPendingRoleUser(null);
          if (user) {
            handleSaveRole(user);
          }
        }}
        onCancel={() => setPendingRoleUser(null)}
      />

      <ConfirmDialog
        open={confirmMaintenance}
        title="Konfirmasi koreksi maintenance"
        description="Simpan perubahan data maintenance ini?"
        confirmText="Ya"
        cancelText="Tidak"
        onConfirm={() => {
          setConfirmMaintenance(false);
          handleSaveMaintenance();
        }}
        onCancel={() => setConfirmMaintenance(false)}
      />

      <ConfirmDialog
        open={confirmShift}
        title="Konfirmasi koreksi shift report"
        description="Simpan perubahan data shift report ini?"
        confirmText="Ya"
        cancelText="Tidak"
        onConfirm={() => {
          setConfirmShift(false);
          handleSaveShift();
        }}
        onCancel={() => setConfirmShift(false)}
      />
    </div>
  );
}
