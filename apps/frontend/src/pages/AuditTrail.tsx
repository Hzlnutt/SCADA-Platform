import { useEffect, useState } from "react";
import { PageHeader } from "../components/ui/PageHeader";
import { getJson } from "../services/api.client";
import { useAuthStore } from "../store/auth.store";

type AuditLogItem = {
  _id: string;
  actorId: string;
  action: string;
  resourceType?: string;
  resourceId?: string;
  meta?: Record<string, any>;
  ts: string;
};

type Pagination = {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
};

export default function AuditTrail() {
  const role = useAuthStore((state) => state.user?.role ?? "user");
  const [logs, setLogs] = useState<AuditLogItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [actionFilter, setActionFilter] = useState("");
  const [pagination, setPagination] = useState<Pagination>({
    page: 1,
    limit: 15,
    total: 0,
    totalPages: 1
  });
  
  const [expandedLogId, setExpandedLogId] = useState<string | null>(null);

  const fetchLogs = (page = 1) => {
    setLoading(true);
    const searchParam = search ? `&search=${encodeURIComponent(search)}` : "";
    const actionParam = actionFilter ? `&action=${encodeURIComponent(actionFilter)}` : "";
    
    getJson<{ data: AuditLogItem[]; pagination: Pagination }>(
      `/audit-trail?page=${page}&limit=${pagination.limit}${searchParam}${actionParam}`
    )
      .then((res) => {
        setLogs(res.data);
        setPagination(res.pagination);
      })
      .catch((err) => {
        console.error("Failed to load audit trail logs", err);
      })
      .finally(() => {
        setLoading(false);
      });
  };

  useEffect(() => {
    if (role === "admin") {
      fetchLogs(1);
    }
  }, [role, actionFilter]);

  // Handle manual search form submit
  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    fetchLogs(1);
  };

  if (role !== "admin") {
    return (
      <div>
        <PageHeader
          title="Audit Trail"
          description="Rekam jejak aktivitas sistem SCADA."
        />
        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 text-sm text-slate-500">
          Anda tidak memiliki akses administratif untuk melihat halaman ini.
        </div>
      </div>
    );
  }

  const getActionBadgeColor = (action: string) => {
    if (action.includes("delete")) {
      return "bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20";
    }
    if (action.includes("create")) {
      return "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20";
    }
    if (action.includes("update") || action.includes("edit") || action.includes("upsert")) {
      return "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20";
    }
    return "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20";
  };

  const formatChangeDetails = (log: AuditLogItem) => {
    const meta = log.meta;
    if (!meta) return "Tidak ada detail perubahan tambahan.";

    // Utility Config update
    if (log.action === "update_utility_config" && meta.before && meta.after) {
      return (
        <div className="space-y-1 text-xs">
          <div className="font-bold text-slate-700 dark:text-slate-350">Perubahan Tarif PLN:</div>
          <div className="grid grid-cols-2 gap-4 max-w-sm bg-slate-50 dark:bg-slate-950 p-2.5 rounded-xl border border-slate-100 dark:border-slate-800/60 font-mono">
            <div>
              <span className="text-[10px] uppercase font-bold text-slate-400 block mb-0.5">Sebelumnya</span>
              <span className="text-rose-500 font-semibold">WBP: Rp {meta.before.wbpRate?.toLocaleString("id-ID")}</span>
              <br />
              <span className="text-rose-500 font-semibold">LWBP: Rp {meta.before.lwbpRate?.toLocaleString("id-ID")}</span>
            </div>
            <div>
              <span className="text-[10px] uppercase font-bold text-slate-400 block mb-0.5">Menjadi</span>
              <span className="text-emerald-500 font-semibold">WBP: Rp {meta.after.wbpRate?.toLocaleString("id-ID")}</span>
              <br />
              <span className="text-emerald-500 font-semibold">LWBP: Rp {meta.after.lwbpRate?.toLocaleString("id-ID")}</span>
            </div>
          </div>
        </div>
      );
    }

    // Machine update
    if (log.action === "update_machine" && meta.before && meta.after) {
      return (
        <div className="space-y-1.5 text-xs">
          <div className="font-bold text-slate-700 dark:text-slate-300">Modifikasi parameter mesin:</div>
          <pre className="p-3 bg-slate-50 dark:bg-slate-950 rounded-xl text-[11px] font-mono text-slate-600 dark:text-slate-400 overflow-x-auto border border-slate-100 dark:border-slate-800/60">
            {JSON.stringify({ sebelum: meta.before, sesudah: meta.after }, null, 2)}
          </pre>
        </div>
      );
    }

    // Fallback JSON Viewer
    return (
      <div className="space-y-1.5 text-xs">
        <div className="font-bold text-slate-700 dark:text-slate-300">Metadata Payload:</div>
        <pre className="p-3 bg-slate-50 dark:bg-slate-950 rounded-xl text-[11px] font-mono text-slate-600 dark:text-slate-400 overflow-x-auto border border-slate-100 dark:border-slate-800/60">
          {JSON.stringify(meta, null, 2)}
        </pre>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Audit Trail"
        description="Pantau riwayat perubahan, aktivitas administratif, dan log audit operasional sistem SCADA secara terpusat."
      />

      {/* Filters and Controls */}
      <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-sm">
        <form onSubmit={handleSearchSubmit} className="flex flex-col md:flex-row gap-4 justify-between items-center">
          <div className="flex flex-1 flex-col md:flex-row gap-3 w-full">
            <div className="relative flex-1">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </span>
              <input
                type="text"
                placeholder="Cari user, aksi, resource, detail..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 pl-10 pr-4 py-2 text-xs font-semibold text-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500/40 transition"
              />
            </div>

            <div className="w-full md:w-56">
              <select
                value={actionFilter}
                onChange={(e) => setActionFilter(e.target.value)}
                className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 px-3 py-2 text-xs font-bold text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/40 transition"
              >
                <option value="">Semua Aksi</option>
                <option value="update_utility_config">Update Tarif PLN</option>
                <option value="update_thresholds">Update Ambang Batas (Thresholds)</option>
                <option value="create_machine">Tambah Konfigurasi Mesin</option>
                <option value="update_machine">Edit Konfigurasi Mesin</option>
                <option value="delete_machine">Hapus Konfigurasi Mesin</option>
                <option value="login">User Login</option>
                <option value="create_user">Registrasi User</option>
              </select>
            </div>
          </div>

          <div className="flex gap-2 w-full md:w-auto shrink-0 justify-end">
            <button
              type="submit"
              className="rounded-xl bg-blue-600 hover:bg-blue-500 active:bg-blue-700 text-white font-bold text-xs uppercase tracking-wider px-5 py-2.5 shadow-md active:scale-95 transition"
            >
              Cari
            </button>
            <button
              type="button"
              onClick={() => {
                setSearch("");
                setActionFilter("");
                setTimeout(() => fetchLogs(1), 50);
              }}
              className="rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-350 font-bold text-xs uppercase tracking-wider px-4 py-2.5 transition"
            >
              Reset
            </button>
          </div>
        </form>
      </div>

      {/* Logs Table Card */}
      <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead className="bg-slate-50 dark:bg-slate-850/50 text-[10px] font-bold uppercase tracking-wider text-slate-500 border-b border-slate-100 dark:border-slate-800">
              <tr>
                <th className="px-4 py-3.5 w-44">Waktu</th>
                <th className="px-4 py-3.5 w-48">User / Aktor</th>
                <th className="px-4 py-3.5 w-48">Aksi</th>
                <th className="px-4 py-3.5 w-56">Resource / ID</th>
                <th className="px-4 py-3.5 text-right w-24">Detail</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 font-medium">
              {loading ? (
                <tr>
                  <td colSpan={5} className="px-4 py-12 text-center text-slate-400">
                    Memuat log audit trail...
                  </td>
                </tr>
              ) : logs.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-12 text-center text-slate-400">
                    Tidak ditemukan rekaman log audit trail.
                  </td>
                </tr>
              ) : (
                logs.map((log) => {
                  const isExpanded = expandedLogId === log._id;
                  const formattedTime = new Date(log.ts).toLocaleString("id-ID", {
                    day: "2-digit",
                    month: "short",
                    year: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                    second: "2-digit"
                  }) + " WIB";

                  return (
                    <div key={log._id} className="contents">
                      <tr className="hover:bg-slate-50/40 dark:hover:bg-slate-850/10">
                        <td className="px-4 py-3.5 font-mono text-slate-400 whitespace-nowrap">
                          {formattedTime}
                        </td>
                        <td className="px-4 py-3.5 text-slate-850 dark:text-slate-200 font-bold">
                          {log.actorId}
                        </td>
                        <td className="px-4 py-3.5">
                          <span className={`inline-flex items-center rounded-lg px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider border ${getActionBadgeColor(log.action)}`}>
                            {log.action.replace(/_/g, " ")}
                          </span>
                        </td>
                        <td className="px-4 py-3.5 text-slate-500 whitespace-nowrap">
                          {log.resourceType ? (
                            <span className="font-bold text-slate-700 dark:text-slate-350">
                              {log.resourceType.toUpperCase()}:{" "}
                              <span className="font-mono font-medium text-slate-400">
                                {log.resourceId}
                              </span>
                            </span>
                          ) : (
                            "-"
                          )}
                        </td>
                        <td className="px-4 py-3.5 text-right">
                          <button
                            type="button"
                            onClick={() => setExpandedLogId(isExpanded ? null : log._id)}
                            className="rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 font-semibold px-2.5 py-1 text-[10px] uppercase transition"
                          >
                            {isExpanded ? "Tutup" : "Lihat"}
                          </button>
                        </td>
                      </tr>
                      {isExpanded && (
                        <tr>
                          <td colSpan={5} className="px-4 py-4 bg-slate-50/50 dark:bg-slate-950/20 border-t border-b border-slate-100 dark:border-slate-800/80">
                            {formatChangeDetails(log)}
                          </td>
                        </tr>
                      )}
                    </div>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Footer */}
        {!loading && logs.length > 0 && (
          <div className="flex flex-col sm:flex-row justify-between items-center gap-4 bg-slate-50/50 dark:bg-slate-850/10 px-4 py-3.5 border-t border-slate-100 dark:border-slate-800 text-slate-400 text-xs font-semibold">
            <div>
              Menampilkan {logs.length} dari {pagination.total} log audit
            </div>
            <div className="flex gap-1">
              <button
                type="button"
                disabled={pagination.page <= 1}
                onClick={() => fetchLogs(pagination.page - 1)}
                className="rounded-lg border border-slate-250 dark:border-slate-700 hover:bg-white dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 font-bold px-3 py-1.5 transition disabled:opacity-50"
              >
                Kembali
              </button>
              <span className="px-3 py-1.5 text-slate-700 dark:text-slate-200">
                Halaman {pagination.page} dari {pagination.totalPages}
              </span>
              <button
                type="button"
                disabled={pagination.page >= pagination.totalPages}
                onClick={() => fetchLogs(pagination.page + 1)}
                className="rounded-lg border border-slate-250 dark:border-slate-700 hover:bg-white dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 font-bold px-3 py-1.5 transition disabled:opacity-50"
              >
                Lanjut
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
