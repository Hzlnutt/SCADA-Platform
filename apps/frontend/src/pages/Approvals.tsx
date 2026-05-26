import { useEffect, useState } from "react";
import { ConfirmDialog } from "../components/ui/ConfirmDialog";
import { PageHeader } from "../components/ui/PageHeader";
import { getJson, patchJson } from "../services/api.client";
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
  const canApprove = role === "team_head" || role === "leader" || role === "admin";
  const [maintenance, setMaintenance] = useState<ApprovalItem[]>([]);
  const [shiftReports, setShiftReports] = useState<ApprovalItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [pendingAction, setPendingAction] = useState<{
    type: "maintenance" | "shift";
    id: string;
    action: "approve" | "reject";
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
    setLoading(true);
    Promise.all([
      getJson<ApprovalListResponse>(
        `/approvals/maintenance?limit=50&status=${statusParam}`
      ),
      getJson<ApprovalListResponse>(
        `/approvals/shift-reports?limit=50&status=${statusParam}`
      )
    ])
      .then(([maintenanceResult, shiftResult]) => {
        const filterPending = (items: ApprovalItem[]) =>
          statusParam === "all"
            ? items.filter((item) => item.approvalStatus !== "approved")
            : items;
        if (active) {
          setMaintenance(filterPending(maintenanceResult.data));
          setShiftReports(filterPending(shiftResult.data));
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
  }, [canApprove, role]);

  if (!canApprove) {
    return (
      <div>
        <PageHeader
          title="Approvals"
          description="Hanya team head dan leader yang dapat melakukan approval."
        />
        <div className="rounded-lg border border-slate-900 bg-slate-950/60 p-6 text-sm text-slate-300">
          Anda tidak memiliki akses approval.
        </div>
      </div>
    );
  }

  const handleAction = (type: "maintenance" | "shift", id: string, action: "approve" | "reject") => {
    setPendingAction({ type, id, action });
    setConfirmOpen(true);
  };

  const confirmAction = async () => {
    if (!pendingAction) {
      return;
    }

    const endpoint = pendingAction.type === "maintenance"
      ? `/approvals/maintenance/${pendingAction.id}`
      : `/approvals/shift-reports/${pendingAction.id}`;

    await patchJson(endpoint, { action: pendingAction.action });

    setMaintenance((prev) => prev.filter((item) => item.id !== pendingAction.id));
    setShiftReports((prev) => prev.filter((item) => item.id !== pendingAction.id));
    setPendingAction(null);
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Approvals"
        description="Konfirmasi data maintenance dan shift report yang diajukan." 
      />

      <section className="rounded-lg border border-slate-800 bg-slate-950/70 p-5">
        <div className="text-xs uppercase tracking-[0.2em] text-slate-500">
          Maintenance Approval Queue
        </div>
        <div className="mt-4 overflow-x-auto">
          {loading ? (
            <div className="text-sm text-slate-400">Memuat data...</div>
          ) : maintenance.length === 0 ? (
            <div className="text-sm text-slate-400">Tidak ada data pending.</div>
          ) : (
            <table className="w-full text-left text-sm">
              <thead className="text-xs uppercase tracking-[0.2em] text-slate-500">
                <tr>
                  <th className="px-3 py-2">Tanggal</th>
                  <th className="px-3 py-2">Item</th>
                  <th className="px-3 py-2">Teknisi</th>
                  <th className="px-3 py-2">Status</th>
                  <th className="px-3 py-2">Action</th>
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
            <div className="text-sm text-slate-400">Memuat data...</div>
          ) : shiftReports.length === 0 ? (
            <div className="text-sm text-slate-400">Tidak ada data pending.</div>
          ) : (
            <table className="w-full text-left text-sm">
              <thead className="text-xs uppercase tracking-[0.2em] text-slate-500">
                <tr>
                  <th className="px-3 py-2">Tanggal</th>
                  <th className="px-3 py-2">Shift</th>
                  <th className="px-3 py-2">Status</th>
                  <th className="px-3 py-2">Action</th>
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

      <ConfirmDialog
        open={confirmOpen}
        title="Konfirmasi approval"
        description="Apakah Anda yakin ingin melanjutkan?"
        confirmText="Ya"
        cancelText="Tidak"
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
