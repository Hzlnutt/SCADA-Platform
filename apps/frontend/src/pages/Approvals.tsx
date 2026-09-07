import { useEffect, useState } from "react";
import { ConfirmDialog } from "../components/ui/ConfirmDialog";
import { PageHeader } from "../components/ui/PageHeader";
import { getJson, patchJson } from "../services/api.client";
import {
  fetchPasswordApprovals,
  reviewPasswordApproval,
  type PasswordChangeRequest
} from "../services/auth.service";
import { useAuthStore } from "../store/auth.store";

type ApprovalItem = {
  id: string;
  machineId: string;
  date?: string;
  reportDate?: string;
  item?: string;
  shift?: string;
  technician?: string;
  status?: string;
  approvalStatus?: string;
};

type ApprovalListResponse = {
  data: ApprovalItem[];
};

const formatDate = (value?: string) =>
  value ? new Date(value).toLocaleString() : "-";

export default function Approvals() {
  const role = useAuthStore((state) => state.user?.role ?? "user");
  const canApprove =
    role === "team_head" ||
    role === "leader" ||
    role === "admin" ||
    role === "senior_unit_head" ||
    role === "unit_head" ||
    role === "unit_head_utility" ||
    role === "unit_head_hvac";
  const [maintenance, setMaintenance] = useState<ApprovalItem[]>([]);
  const [shiftReports, setShiftReports] = useState<ApprovalItem[]>([]);
  const [passwordRequests, setPasswordRequests] = useState<PasswordChangeRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [pendingAction, setPendingAction] = useState<{
    type: "maintenance" | "shift" | "password";
    id: string | number;
    action: "approve" | "reject";
    username?: string;
  } | null>(null);

  useEffect(() => {
    if (!canApprove) {
      return;
    }

    const statusParam = role === "team_head"
      ? "pending_team_head"
      : role === "leader"
      ? "pending_leader"
      : "all";

    let active = true;

    const fetchData = () => {
      Promise.all([
        getJson<ApprovalListResponse>(
          `/approvals/maintenance?limit=50&status=${statusParam}`
        ),
        getJson<ApprovalListResponse>(
          `/approvals/shift-reports?limit=50&status=${statusParam}`
        ),
        fetchPasswordApprovals("pending")
      ])
        .then(([maintenanceResult, shiftResult, passwordResult]) => {
          const filterPending = (items: ApprovalItem[]) =>
            statusParam === "all"
              ? items.filter((item) => item.approvalStatus !== "approved")
              : items;
          if (active) {
            setMaintenance(filterPending(maintenanceResult.data));
            setShiftReports(filterPending(shiftResult.data));
            setPasswordRequests(passwordResult.data || []);
          }
        })
        .finally(() => {
          if (active) {
            setLoading(false);
          }
        });
    };

    fetchData();
    const interval = setInterval(fetchData, 5000);

    return () => {
      active = false;
      clearInterval(interval);
    };
  }, [canApprove, role]);

  if (!canApprove) {
    return (
      <div>
        <PageHeader
          title="Approvals"
          description="Only team heads, leaders, and administrators can approve operational records."
        />
        <div className="rounded-lg border border-slate-900 bg-slate-950/60 p-6 text-sm text-slate-300">
          You do not have approval access.
        </div>
      </div>
    );
  }

  const handleAction = (
    type: "maintenance" | "shift" | "password",
    id: string | number,
    action: "approve" | "reject",
    username?: string
  ) => {
    setPendingAction({ type, id, action, username });
    setConfirmOpen(true);
  };

  const confirmAction = async () => {
    if (!pendingAction) {
      return;
    }

    if (pendingAction.type === "password") {
      await reviewPasswordApproval(Number(pendingAction.id), pendingAction.action);
      setPasswordRequests((prev) => prev.filter((item) => item.id !== pendingAction.id));
    } else {
      const endpoint = pendingAction.type === "maintenance"
        ? `/approvals/maintenance/${pendingAction.id}`
        : `/approvals/shift-reports/${pendingAction.id}`;

      await patchJson(endpoint, { action: pendingAction.action });

      setMaintenance((prev) => prev.filter((item) => item.id !== pendingAction.id));
      setShiftReports((prev) => prev.filter((item) => item.id !== pendingAction.id));
    }
    setPendingAction(null);
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Approvals"
        description="Confirm or reject submitted maintenance logs and shift reports." 
      />

      <section className="rounded-lg border border-slate-800 bg-slate-950/70 p-5">
        <div className="text-xs uppercase tracking-[0.2em] text-slate-500">
          Maintenance Approval Queue
        </div>
        <div className="mt-4 overflow-x-auto">
          {loading ? (
            <div className="text-sm text-slate-400">Loading data...</div>
          ) : maintenance.length === 0 ? (
            <div className="text-sm text-slate-400">No pending approvals found.</div>
          ) : (
            <table className="w-full text-left text-sm">
              <thead className="text-xs uppercase tracking-[0.2em] text-slate-500">
                <tr>
                  <th className="px-3 py-2">Date</th>
                  <th className="px-3 py-2">Item</th>
                  <th className="px-3 py-2">Technician</th>
                  <th className="px-3 py-2">Status</th>
                  <th className="px-3 py-2">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-900">
                {maintenance.map((record) => (
                  <tr key={record.id} className="text-slate-300">
                    <td className="px-3 py-3 text-xs text-slate-500">
                      {formatDate(record.date)}
                    </td>
                    <td className="px-3 py-3 text-sm text-slate-200">
                      {record.item ?? "-"}
                    </td>
                    <td className="px-3 py-3 text-xs text-slate-500">
                      {record.technician ?? "-"}
                    </td>
                    <td className="px-3 py-3 text-xs text-slate-400">
                      {record.approvalStatus ?? "pending"}
                    </td>
                    <td className="px-3 py-3 text-xs text-slate-400">
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => handleAction("maintenance", record.id, "approve")}
                          className="rounded-full border border-emerald-400/60 px-3 py-1 text-[11px] text-emerald-200"
                        >
                          Approve
                        </button>
                        <button
                          type="button"
                          onClick={() => handleAction("maintenance", record.id, "reject")}
                          className="rounded-full border border-red-400/60 px-3 py-1 text-[11px] text-red-200"
                        >
                          Reject
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </section>

      <section className="rounded-lg border border-slate-800 bg-slate-950/70 p-5">
        <div className="text-xs uppercase tracking-[0.2em] text-slate-500">
          Shift Report Approval Queue
        </div>
        <div className="mt-4 overflow-x-auto">
          {loading ? (
            <div className="text-sm text-slate-400">Loading data...</div>
          ) : shiftReports.length === 0 ? (
            <div className="text-sm text-slate-400">No pending approvals found.</div>
          ) : (
            <table className="w-full text-left text-sm">
              <thead className="text-xs uppercase tracking-[0.2em] text-slate-500">
                <tr>
                  <th className="px-3 py-2">Date</th>
                  <th className="px-3 py-2">Shift</th>
                  <th className="px-3 py-2">Status</th>
                  <th className="px-3 py-2">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-900">
                {shiftReports.map((record) => (
                  <tr key={record.id} className="text-slate-300">
                    <td className="px-3 py-3 text-xs text-slate-500">
                      {formatDate(record.reportDate)}
                    </td>
                    <td className="px-3 py-3 text-sm text-slate-200">
                      {record.shift ?? "-"}
                    </td>
                    <td className="px-3 py-3 text-xs text-slate-400">
                      {record.approvalStatus ?? "pending"}
                    </td>
                    <td className="px-3 py-3 text-xs text-slate-400">
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => handleAction("shift", record.id, "approve")}
                          className="rounded-full border border-emerald-400/60 px-3 py-1 text-[11px] text-emerald-200"
                        >
                          Approve
                        </button>
                        <button
                          type="button"
                          onClick={() => handleAction("shift", record.id, "reject")}
                          className="rounded-full border border-red-400/60 px-3 py-1 text-[11px] text-red-200"
                        >
                          Reject
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </section>

      {/* PASSWORD CHANGE APPROVAL QUEUE */}
      <section className="rounded-lg border border-slate-800 bg-slate-950/70 p-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="text-xs uppercase tracking-[0.2em] text-slate-500 font-semibold">
            Antrean Persetujuan Ganti Password (Password Change Queue)
          </div>
          <span className="rounded-full bg-slate-900 border border-slate-800 px-2.5 py-0.5 text-[11px] font-medium text-slate-400">
            {passwordRequests.length} Menunggu Persetujuan
          </span>
        </div>
        <div className="mt-4 overflow-x-auto">
          {loading ? (
            <div className="text-sm text-slate-400">Loading data...</div>
          ) : passwordRequests.length === 0 ? (
            <div className="text-sm text-slate-400">Tidak ada permohonan ganti password yang menunggu persetujuan.</div>
          ) : (
            <table className="w-full text-left text-sm">
              <thead className="text-xs uppercase tracking-[0.2em] text-slate-500">
                <tr>
                  <th className="px-3 py-2">Tanggal Pengajuan</th>
                  <th className="px-3 py-2">Username</th>
                  <th className="px-3 py-2">Nama Pemohon</th>
                  <th className="px-3 py-2">Role</th>
                  <th className="px-3 py-2">Status</th>
                  <th className="px-3 py-2">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-900">
                {passwordRequests.map((record) => (
                  <tr key={record.id} className="text-slate-300 hover:bg-slate-900/40 transition">
                    <td className="px-3 py-3 text-xs text-slate-500">
                      {formatDate(record.requestedAt)}
                    </td>
                    <td className="px-3 py-3 text-sm font-semibold text-sky-400">
                      @{record.username}
                    </td>
                    <td className="px-3 py-3 text-xs text-slate-200">
                      {record.userName}
                    </td>
                    <td className="px-3 py-3 text-xs text-slate-400">
                      <span className="rounded bg-slate-900 px-2 py-0.5 text-[11px] uppercase tracking-wider text-slate-300 border border-slate-800">
                        {record.userRole}
                      </span>
                    </td>
                    <td className="px-3 py-3 text-xs">
                      <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-500/30 bg-amber-500/10 px-2.5 py-0.5 text-[11px] font-medium text-amber-400">
                        <span className="h-1.5 w-1.5 rounded-full bg-amber-400 animate-pulse" />
                        Menunggu Persetujuan
                      </span>
                    </td>
                    <td className="px-3 py-3 text-xs text-slate-400">
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => handleAction("password", record.id, "approve", record.username)}
                          className="rounded-full border border-emerald-400/60 bg-emerald-500/10 px-3 py-1 text-[11px] font-semibold text-emerald-300 hover:bg-emerald-500/20 transition"
                        >
                          Setujui
                        </button>
                        <button
                          type="button"
                          onClick={() => handleAction("password", record.id, "reject", record.username)}
                          className="rounded-full border border-red-400/60 bg-red-500/10 px-3 py-1 text-[11px] font-semibold text-red-300 hover:bg-red-500/20 transition"
                        >
                          Tolak
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </section>

      <ConfirmDialog
        open={confirmOpen}
        title={
          pendingAction?.type === "password"
            ? `${pendingAction.action === "approve" ? "Setujui" : "Tolak"} Permintaan Ganti Password`
            : "Confirm Approval Action"
        }
        description={
          pendingAction?.type === "password"
            ? `Apakah Anda yakin ingin ${pendingAction.action === "approve" ? "menyetujui" : "menolak"} permohonan ganti password untuk akun @${pendingAction.username}?`
            : "Are you sure you want to proceed with this approval action?"
        }
        confirmText={pendingAction?.type === "password" ? (pendingAction.action === "approve" ? "Ya, Setujui" : "Ya, Tolak") : "Yes"}
        cancelText="Batal"
        onConfirm={async () => {
          setConfirmOpen(false);
          await confirmAction();
        }}
        onCancel={() => {
          setConfirmOpen(false);
          setPendingAction(null);
        }}
      />
    </div>
  );
}
