import { useEffect, useMemo, useState } from "react";
import { ConfirmDialog } from "../components/ui/ConfirmDialog";
import { PageHeader } from "../components/ui/PageHeader";
import { machineUnits } from "../data/machines";
import { getJson, patchJson, postJson, deleteJson } from "../services/api.client";
import { useAuthStore } from "../store/auth.store";

type UserItem = {
  _id: string;
  email: string;
  name: string;
  role:
    | "admin"
    | "senior_unit_head"
    | "unit_head"
    | "kashift_utility_hvac"
    | "kashift_utility"
    | "kashift_hvac"
    | "leader"
    | "operator"
    | "user";
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
  "senior_unit_head",
  "unit_head",
  "kashift_utility_hvac",
  "kashift_utility",
  "kashift_hvac",
  "leader",
  "operator",
  "user"
];

export default function AdminPanel() {
  const role = useAuthStore((state) => state.user?.role ?? "user");
  const [users, setUsers] = useState<UserItem[]>([]);
  const [usersLoading, setUsersLoading] = useState(true);
  const [savingUserId, setSavingUserId] = useState<string | null>(null);
  const [pendingRoleUser, setPendingRoleUser] = useState<UserItem | null>(null);

  // New User Creation State
  const [newUser, setNewUser] = useState({
    name: "",
    email: "",
    password: "",
    role: "user" as UserItem["role"]
  });
  const [creatingUser, setCreatingUser] = useState(false);
  const [createUserError, setCreateUserError] = useState<string | null>(null);

  // User Deletion State
  const [pendingDeleteUser, setPendingDeleteUser] = useState<UserItem | null>(null);
  const [deletingUserId, setDeletingUserId] = useState<string | null>(null);

  const [maintenanceRecords, setMaintenanceRecords] = useState<MaintenanceItem[]>([]);
  const [maintenanceLoading, setMaintenanceLoading] = useState(true);
  const [editingMaintenance, setEditingMaintenance] = useState<MaintenanceItem | null>(null);
  const [maintenanceSaving, setMaintenanceSaving] = useState(false);
  const [confirmMaintenance, setConfirmMaintenance] = useState(false);

  const [operators, setOperators] = useState<Array<{ id: string; name: string; role: string }>>([]);

  useEffect(() => {
    getJson<{ data: Array<{ id: string; name: string; role: string }> }>("/users/operators")
      .then((res) => {
        setOperators(res.data);
      })
      .catch((err) => {
        console.error("Failed to fetch operators", err);
      });
  }, []);

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
          description="Only administrators can manage users, roles, and correct PLC data."
        />
        <div className="rounded-lg border border-slate-900 bg-slate-950/60 p-6 text-sm text-slate-300">
          You do not have administrative access.
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
      setPendingRoleUser(null);
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to update role");
    } finally {
      setSavingUserId(null);
    }
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreatingUser(true);
    setCreateUserError(null);
    try {
      const response = await postJson<{ data: UserItem }>("/users", newUser);
      setUsers((prev) => [...prev, response.data]);
      setNewUser({ name: "", email: "", password: "", role: "user" });
    } catch (err) {
      setCreateUserError(err instanceof Error ? err.message : "Failed to create user");
    } finally {
      setCreatingUser(false);
    }
  };

  const handleDeleteUser = async (user: UserItem) => {
    setDeletingUserId(user._id);
    try {
      await deleteJson<{ success: boolean }>(`/users/${user._id}`);
      setUsers((prev) => prev.filter((u) => u._id !== user._id));
      setPendingDeleteUser(null);
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to delete user");
    } finally {
      setDeletingUserId(null);
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
        description="Manage user directory, assign organizational access roles, and modify historical PLC logs."
      />

      <section className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* Create User Card */}
        <div className="xl:col-span-1 rounded-lg border border-slate-900 bg-slate-950/60 p-5">
          <div className="text-xs font-bold uppercase tracking-[0.2em] text-[#1f6fb5]">
            Create New User
          </div>
          <p className="mt-1 text-xs text-slate-400">
            System registration is disabled. Create new operators and heads here.
          </p>
          <form onSubmit={handleCreateUser} className="mt-4 space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-400 uppercase">Full Name</label>
              <input
                type="text"
                value={newUser.name}
                onChange={(e) => setNewUser((prev) => ({ ...prev, name: e.target.value }))}
                required
                className="mt-1 w-full rounded-md border border-slate-800 bg-slate-950 px-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-blue-500"
                placeholder="Name"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-400 uppercase">Email Address</label>
              <input
                type="email"
                value={newUser.email}
                onChange={(e) => setNewUser((prev) => ({ ...prev, email: e.target.value }))}
                required
                className="mt-1 w-full rounded-md border border-slate-800 bg-slate-950 px-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-blue-500"
                placeholder="email@widatra.co"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-400 uppercase">Initial Password</label>
              <input
                type="password"
                value={newUser.password}
                onChange={(e) => setNewUser((prev) => ({ ...prev, password: e.target.value }))}
                required
                minLength={8}
                className="mt-1 w-full rounded-md border border-slate-800 bg-slate-950 px-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-blue-500"
                placeholder="Minimum 8 characters"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-400 uppercase">Access Role</label>
              <select
                value={newUser.role}
                onChange={(e) =>
                  setNewUser((prev) => ({ ...prev, role: e.target.value as UserItem["role"] }))
                }
                className="mt-1 w-full rounded-md border border-slate-800 bg-slate-900 px-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-blue-500 font-bold"
              >
                {roleOptions.map((option) => (
                  <option key={option} value={option} className="text-[#002b5c] bg-white font-bold">
                    {option.replace(/_/g, " ").toUpperCase()}
                  </option>
                ))}
              </select>
            </div>
            {createUserError && (
              <div className="text-xs text-rose-500 bg-rose-500/10 border border-rose-500/20 p-2.5 rounded-md">
                {createUserError}
              </div>
            )}
            <button
              type="submit"
              disabled={creatingUser}
              className="w-full rounded-md bg-[#1f6fb5] hover:bg-[#155c99] py-2.5 text-xs font-bold text-white transition disabled:opacity-50"
            >
              {creatingUser ? "Creating User..." : "Create User"}
            </button>
          </form>
        </div>

        {/* User Directory Directory */}
        <div className="xl:col-span-2 rounded-lg border border-slate-900 bg-slate-950/60 p-5">
          <div className="text-xs font-bold uppercase tracking-[0.2em] text-[#1f6fb5]">
            User Directory
          </div>
          <p className="mt-1 text-xs text-slate-400">
            View existing members, assign roles, or delete users.
          </p>
          <div className="mt-4 overflow-x-auto max-h-[350px] overflow-y-auto pr-1">
            {usersLoading ? (
              <div className="text-sm text-slate-400">Loading users...</div>
            ) : (
              <table className="w-full text-left text-xs border-collapse">
                <thead className="text-[10px] uppercase tracking-wider text-slate-500 font-bold sticky top-0 bg-slate-950 z-10 border-b border-slate-800 pb-2">
                  <tr>
                    <th className="px-3 py-2">Name</th>
                    <th className="px-3 py-2">Email</th>
                    <th className="px-3 py-2">Role</th>
                    <th className="px-3 py-2 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-900 font-medium">
                  {users.map((user) => (
                    <tr key={user._id} className="text-slate-300 hover:bg-slate-900/40">
                      <td className="px-3 py-3 text-slate-200 font-bold">{user.name}</td>
                      <td className="px-3 py-3 font-mono text-slate-500">{user.email}</td>
                      <td className="px-3 py-3">
                        <select
                          value={user.role}
                          onChange={(event) =>
                            handleRoleChange(user._id, event.target.value as UserItem["role"])
                          }
                          className="rounded-md border border-slate-800 bg-white px-2 py-1 text-xs text-[#002b5c] font-bold"
                        >
                          {roleOptions.map((option) => (
                            <option key={option} value={option}>
                              {option}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="px-3 py-3 text-right space-x-2">
                        <button
                          type="button"
                          onClick={() => setPendingRoleUser(user)}
                          disabled={savingUserId === user._id}
                          className="rounded-full border border-slate-700 hover:border-slate-500 px-3 py-1 text-xs text-slate-300 disabled:opacity-60 transition"
                        >
                          {savingUserId === user._id ? "Saving..." : "Save"}
                        </button>
                        <button
                          type="button"
                          onClick={() => setPendingDeleteUser(user)}
                          disabled={deletingUserId === user._id}
                          className="rounded-full border border-rose-950/60 bg-rose-950/20 text-rose-400 hover:bg-rose-900/30 hover:text-rose-300 px-3 py-1 text-xs disabled:opacity-60 transition"
                        >
                          Delete
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </section>

      {/* Correct Maintenance Records Section */}
      <section className="rounded-lg border border-slate-900 bg-slate-950/60 p-5">
        <div className="text-xs font-bold uppercase tracking-[0.2em] text-[#1f6fb5]">
          Correct Maintenance Records
        </div>
        <div className="mt-4 overflow-x-auto">
          {maintenanceLoading ? (
            <div className="text-sm text-slate-400">Loading data...</div>
          ) : maintenanceRecords.length === 0 ? (
            <div className="text-sm text-slate-400">No data available.</div>
          ) : (
            <table className="w-full text-left text-xs border-collapse">
              <thead className="text-[10px] uppercase tracking-wider text-slate-500 font-bold border-b border-slate-800">
                <tr>
                  <th className="px-3 py-2">Date</th>
                  <th className="px-3 py-2">Machine</th>
                  <th className="px-3 py-2">Item</th>
                  <th className="px-3 py-2">Abnormality</th>
                  <th className="px-3 py-2">Technician</th>
                  <th className="px-3 py-2">Status</th>
                  <th className="px-3 py-2">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-900 font-medium">
                {maintenanceRecords.map((record) => (
                  <tr key={record.id} className="text-slate-300 hover:bg-slate-900/40">
                    <td className="px-3 py-3 text-slate-500">
                      {new Date(record.date).toLocaleString()}
                    </td>
                    <td className="px-3 py-3 text-slate-200 font-bold">
                      {machineNameMap[record.machineId] ?? record.machineId}
                    </td>
                    <td className="px-3 py-3 text-slate-400">{record.item}</td>
                    <td className="px-3 py-3 text-slate-500">{record.abnormality ?? "-"}</td>
                    <td className="px-3 py-3 text-slate-500">{record.technician}</td>
                    <td className="px-3 py-3">
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] uppercase font-bold ${
                          record.status === "completed"
                            ? "bg-emerald-500/10 text-emerald-500"
                            : record.status === "monitoring"
                            ? "bg-amber-500/10 text-amber-500"
                            : "bg-blue-500/10 text-blue-500"
                        }`}
                      >
                        {record.status}
                      </span>
                    </td>
                    <td className="px-3 py-3">
                      <button
                        type="button"
                        onClick={() => handleMaintenanceEdit(record)}
                        className="rounded-full border border-slate-700 hover:border-slate-500 px-3 py-1 text-xs text-slate-300 transition"
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
            <div className="mb-3 text-xs uppercase tracking-[0.2em] text-[#1f6fb5] font-bold">
              Edit Maintenance Log
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <label className="text-xs text-slate-500 font-bold">
                Date
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
                  className="mt-2 w-full rounded-md border border-slate-800 bg-white px-3 py-2 text-sm text-[#002b5c] font-medium"
                />
              </label>
              <label className="text-xs text-slate-500 font-bold">
                Item Description
                <input
                  type="text"
                  value={editingMaintenance.item}
                  onChange={(event) =>
                    setEditingMaintenance((prev) =>
                      prev ? { ...prev, item: event.target.value } : prev
                    )
                  }
                  className="mt-2 w-full rounded-md border border-slate-800 bg-white px-3 py-2 text-sm text-[#002b5c] font-medium"
                />
              </label>
              <label className="text-xs text-slate-500 font-bold">
                Abnormality
                <input
                  type="text"
                  value={editingMaintenance.abnormality ?? ""}
                  onChange={(event) =>
                    setEditingMaintenance((prev) =>
                      prev ? { ...prev, abnormality: event.target.value } : prev
                    )
                  }
                  className="mt-2 w-full rounded-md border border-slate-800 bg-white px-3 py-2 text-sm text-[#002b5c] font-medium"
                />
              </label>
              <label className="text-xs text-slate-500 font-bold">
                Corrective Action
                <input
                  type="text"
                  value={editingMaintenance.action}
                  onChange={(event) =>
                    setEditingMaintenance((prev) =>
                      prev ? { ...prev, action: event.target.value } : prev
                    )
                  }
                  className="mt-2 w-full rounded-md border border-slate-800 bg-white px-3 py-2 text-sm text-[#002b5c] font-medium"
                />
              </label>
              <label className="text-xs text-slate-500 font-bold">
                Downtime Hours
                <input
                  type="number"
                  step="0.1"
                  value={editingMaintenance.downtimeHours}
                  onChange={(event) =>
                    setEditingMaintenance((prev) =>
                      prev ? { ...prev, downtimeHours: Number(event.target.value) } : prev
                    )
                  }
                  className="mt-2 w-full rounded-md border border-slate-800 bg-white px-3 py-2 text-sm text-[#002b5c] font-medium"
                />
              </label>
              <label className="text-xs text-slate-500 font-bold">
                Technician Name
                <select
                  value={editingMaintenance.technician}
                  onChange={(event) =>
                    setEditingMaintenance((prev) =>
                      prev ? { ...prev, technician: event.target.value } : prev
                    )
                  }
                  className="mt-2 w-full rounded-md border border-slate-800 bg-white px-3 py-2 text-sm text-[#002b5c] font-bold font-medium"
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
              <label className="text-xs text-slate-500 font-bold">
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
                  className="mt-2 w-full rounded-md border border-slate-800 bg-white px-3 py-2 text-sm text-[#002b5c] font-bold"
                >
                  <option value="completed">Completed</option>
                  <option value="monitoring">Monitoring</option>
                  <option value="planned">Planned</option>
                </select>
              </label>
            </div>
            <label className="mt-4 block text-xs text-slate-500 font-bold">
              Notes
              <textarea
                value={editingMaintenance.notes ?? ""}
                onChange={(event) =>
                  setEditingMaintenance((prev) =>
                    prev ? { ...prev, notes: event.target.value } : prev
                  )
                }
                className="mt-2 w-full rounded-md border border-slate-800 bg-white px-3 py-2 text-sm text-[#002b5c] font-medium"
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
                {maintenanceSaving ? "Saving..." : "Save Changes"}
              </button>
              <button
                type="button"
                onClick={() => setEditingMaintenance(null)}
                className="rounded-full border border-slate-700 px-4 py-2 text-xs text-slate-300"
              >
                Cancel
              </button>
            </div>
          </div>
        ) : null}
      </section>

      {/* Correct Shift Report Section */}
      <section className="rounded-lg border border-slate-900 bg-slate-950/60 p-5">
        <div className="text-xs font-bold uppercase tracking-[0.2em] text-[#1f6fb5]">
          Correct Shift Reports
        </div>
        <div className="mt-4 overflow-x-auto">
          {shiftLoading ? (
            <div className="text-sm text-slate-400">Loading data...</div>
          ) : shiftReports.length === 0 ? (
            <div className="text-sm text-slate-400">No data available.</div>
          ) : (
            <table className="w-full text-left text-xs border-collapse">
              <thead className="text-[10px] uppercase tracking-wider text-slate-500 font-bold border-b border-slate-800">
                <tr>
                  <th className="px-3 py-2">Date</th>
                  <th className="px-3 py-2">Machine</th>
                  <th className="px-3 py-2">Shift</th>
                  <th className="px-3 py-2">Runtime</th>
                  <th className="px-3 py-2">Downtime</th>
                  <th className="px-3 py-2">Output</th>
                  <th className="px-3 py-2">Energy</th>
                  <th className="px-3 py-2">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-900 font-medium">
                {shiftReports.map((report) => (
                  <tr key={report.id} className="text-slate-300 hover:bg-slate-900/40">
                    <td className="px-3 py-3 text-slate-500">
                      {new Date(report.reportDate).toLocaleDateString()}
                    </td>
                    <td className="px-3 py-3 text-slate-200 font-bold">
                      {machineNameMap[report.machineId] ?? report.machineId}
                    </td>
                    <td className="px-3 py-3 text-slate-400">{report.shift}</td>
                    <td className="px-3 py-3 text-slate-500">{report.runtimeHours.toFixed(1)} h</td>
                    <td className="px-3 py-3 text-slate-500">
                      {report.downtimeHours.toFixed(1)} h
                    </td>
                    <td className="px-3 py-3 text-slate-500">{report.output}</td>
                    <td className="px-3 py-3 text-slate-500">{report.energy} MWh</td>
                    <td className="px-3 py-3">
                      <button
                        type="button"
                        onClick={() => handleShiftEdit(report)}
                        className="rounded-full border border-slate-700 hover:border-slate-500 px-3 py-1 text-xs text-slate-300 transition"
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
            <div className="mb-3 text-xs uppercase tracking-[0.2em] text-[#1f6fb5] font-bold">
              Edit Shift Report
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <label className="text-xs text-slate-500 font-bold">
                Date
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
                  className="mt-2 w-full rounded-md border border-slate-800 bg-white px-3 py-2 text-sm text-[#002b5c] font-medium"
                />
              </label>
              <label className="text-xs text-slate-500 font-bold">
                Shift
                <input
                  type="text"
                  value={editingShift.shift}
                  onChange={(event) =>
                    setEditingShift((prev) =>
                      prev ? { ...prev, shift: event.target.value } : prev
                    )
                  }
                  className="mt-2 w-full rounded-md border border-slate-800 bg-white px-3 py-2 text-sm text-[#002b5c] font-medium"
                />
              </label>
              <label className="text-xs text-slate-500 font-bold">
                Start Time
                <input
                  type="time"
                  value={editingShift.start}
                  onChange={(event) =>
                    setEditingShift((prev) =>
                      prev ? { ...prev, start: event.target.value } : prev
                    )
                  }
                  className="mt-2 w-full rounded-md border border-slate-800 bg-white px-3 py-2 text-sm text-[#002b5c] font-medium"
                />
              </label>
              <label className="text-xs text-slate-500 font-bold">
                End Time
                <input
                  type="time"
                  value={editingShift.end}
                  onChange={(event) =>
                    setEditingShift((prev) =>
                      prev ? { ...prev, end: event.target.value } : prev
                    )
                  }
                  className="mt-2 w-full rounded-md border border-slate-800 bg-white px-3 py-2 text-sm text-[#002b5c] font-medium"
                />
              </label>
              <label className="text-xs text-slate-500 font-bold">
                Runtime Hours
                <input
                  type="number"
                  step="0.1"
                  value={editingShift.runtimeHours}
                  onChange={(event) =>
                    setEditingShift((prev) =>
                      prev ? { ...prev, runtimeHours: Number(event.target.value) } : prev
                    )
                  }
                  className="mt-2 w-full rounded-md border border-slate-800 bg-white px-3 py-2 text-sm text-[#002b5c] font-medium"
                />
              </label>
              <label className="text-xs text-slate-500 font-bold">
                Downtime Hours
                <input
                  type="number"
                  step="0.1"
                  value={editingShift.downtimeHours}
                  onChange={(event) =>
                    setEditingShift((prev) =>
                      prev ? { ...prev, downtimeHours: Number(event.target.value) } : prev
                    )
                  }
                  className="mt-2 w-full rounded-md border border-slate-800 bg-white px-3 py-2 text-sm text-[#002b5c] font-medium"
                />
              </label>
              <label className="text-xs text-slate-500 font-bold">
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
                  className="mt-2 w-full rounded-md border border-slate-800 bg-white px-3 py-2 text-sm text-[#002b5c] font-medium"
                />
              </label>
              <label className="text-xs text-slate-500 font-bold">
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
                  className="mt-2 w-full rounded-md border border-slate-800 bg-white px-3 py-2 text-sm text-[#002b5c] font-medium"
                />
              </label>
            </div>
            <label className="mt-4 block text-xs text-slate-500 font-bold">
              Notes
              <textarea
                value={editingShift.notes ?? ""}
                onChange={(event) =>
                  setEditingShift((prev) => (prev ? { ...prev, notes: event.target.value } : prev))
                }
                className="mt-2 w-full rounded-md border border-slate-800 bg-white px-3 py-2 text-sm text-[#002b5c] font-medium"
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
                {shiftSaving ? "Saving..." : "Save Changes"}
              </button>
              <button
                type="button"
                onClick={() => setEditingShift(null)}
                className="rounded-full border border-slate-700 px-4 py-2 text-xs text-slate-300"
              >
                Cancel
              </button>
            </div>
          </div>
        ) : null}
      </section>

      {/* Role Change Confirmation */}
      <ConfirmDialog
        open={Boolean(pendingRoleUser)}
        title="Confirm Role Change"
        description="Are you sure you want to update this user's role access tier?"
        confirmText="Yes, Update"
        cancelText="No, Cancel"
        onConfirm={() => {
          const user = pendingRoleUser;
          if (user) {
            handleSaveRole(user);
          }
        }}
        onCancel={() => setPendingRoleUser(null)}
      />

      {/* Delete User Confirmation */}
      <ConfirmDialog
        open={Boolean(pendingDeleteUser)}
        title="Confirm User Deletion"
        description={`Are you sure you want to delete the user account "${pendingDeleteUser?.name}" (${pendingDeleteUser?.email})? This action is permanent and cannot be undone.`}
        confirmText="Yes, Delete Account"
        cancelText="No, Cancel"
        onConfirm={() => {
          const user = pendingDeleteUser;
          if (user) {
            handleDeleteUser(user);
          }
        }}
        onCancel={() => setPendingDeleteUser(null)}
      />

      {/* Maintenance Confirmation */}
      <ConfirmDialog
        open={confirmMaintenance}
        title="Confirm Maintenance Log Correction"
        description="Are you sure you want to save the updated values for this maintenance record?"
        confirmText="Yes, Save"
        cancelText="No, Cancel"
        onConfirm={() => {
          setConfirmMaintenance(false);
          handleSaveMaintenance();
        }}
        onCancel={() => setConfirmMaintenance(false)}
      />

      {/* Shift Report Confirmation */}
      <ConfirmDialog
        open={confirmShift}
        title="Confirm Shift Report Correction"
        description="Are you sure you want to save the corrected values for this shift report?"
        confirmText="Yes, Save"
        cancelText="No, Cancel"
        onConfirm={() => {
          setConfirmShift(false);
          handleSaveShift();
        }}
        onCancel={() => setConfirmShift(false)}
      />
    </div>
  );
}
