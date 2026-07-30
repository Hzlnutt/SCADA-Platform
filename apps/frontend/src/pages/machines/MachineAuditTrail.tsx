import { useEffect, useState, useCallback } from "react";
import { useParams } from "react-router-dom";
import { getJson } from "../../services/api.client";

type AuditLogItem = {
  _id: string;
  actorId: string;
  action: string;
  resourceType?: string;
  resourceId?: string;
  meta?: Record<string, any>;
  ip?: string;
  ts: string;
};

type Pagination = {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
};

export default function MachineAuditTrail() {
  const { unitId } = useParams<{ unitId: string }>();
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

  const fetchLogs = useCallback((page = 1) => {
    if (!unitId) return;
    setLoading(true);
    const searchParam = search ? `&search=${encodeURIComponent(search)}` : "";
    const actionParam = actionFilter ? `&action=${encodeURIComponent(actionFilter)}` : "";

    getJson<{ data: AuditLogItem[]; pagination: Pagination }>(
      `/audit-trail?unitId=${encodeURIComponent(unitId)}&page=${page}&limit=${pagination.limit}${searchParam}${actionParam}`
    )
      .then((res) => {
        setLogs(res.data);
        setPagination(res.pagination);
      })
      .catch((err) => {
        console.error("Failed to load machine audit trail logs", err);
      })
      .finally(() => {
        setLoading(false);
      });
  }, [unitId, search, actionFilter, pagination.limit]);

  useEffect(() => {
    fetchLogs(1);
  }, [fetchLogs]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    fetchLogs(1);
  };

  const getActionBadgeColor = (action: string) => {
    if (action.includes("delete")) {
      return "bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20";
    }
    if (action.includes("create")) {
      return "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20";
    }
    if (action.includes("update") || action.includes("edit") || action.includes("upsert") || action.includes("setpoint")) {
      return "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20";
    }
    return "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20";
  };

  const formatChangeDetails = (log: AuditLogItem) => {
    const meta = log.meta;
    if (!meta) return "Audit log entry without detailed metadata.";
    if (meta.before !== undefined || meta.after !== undefined) {
      return (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-2 text-xs font-mono">
          <div className="bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900/40 p-2.5 rounded-lg">
            <span className="font-bold text-rose-600 dark:text-rose-400 block mb-1">Before:</span>
            <pre className="whitespace-pre-wrap break-all text-[11px]">
              {typeof meta.before === "object" ? JSON.stringify(meta.before, null, 2) : String(meta.before ?? "N/A")}
            </pre>
          </div>
          <div className="bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-900/40 p-2.5 rounded-lg">
            <span className="font-bold text-emerald-600 dark:text-emerald-400 block mb-1">After:</span>
            <pre className="whitespace-pre-wrap break-all text-[11px]">
              {typeof meta.after === "object" ? JSON.stringify(meta.after, null, 2) : String(meta.after ?? "N/A")}
            </pre>
          </div>
        </div>
      );
    }
    return (
      <pre className="mt-2 text-[11px] font-mono whitespace-pre-wrap break-all bg-slate-50 dark:bg-slate-950 p-2.5 rounded-lg border border-slate-200 dark:border-slate-800">
        {JSON.stringify(meta, null, 2)}
      </pre>
    );
  };

  return (
    <div className="space-y-6">
      {/* Header Panel */}
      <div className="flex flex-wrap items-center justify-between gap-4 bg-[#f7fbff]/80 dark:bg-slate-950/70 border border-[#acd3ff] dark:border-slate-800 rounded-xl p-4 transition-colors duration-300 backdrop-blur-md">
        <div>
          <h3 className="text-sm font-bold text-[#002b5c] dark:text-slate-100 uppercase tracking-wide">
            Machine Audit Trail Log ({unitId})
          </h3>
          <p className="text-xs text-[#47729f] dark:text-slate-400 mt-0.5">
            Rekam jejak seluruh perubahan konfigurasi, setpoint, batas threshold, dan aktivitas maintenance pada mesin ini.
          </p>
        </div>

        <form onSubmit={handleSearchSubmit} className="flex items-center gap-2">
          <input
            type="text"
            placeholder="Cari aktivitas / user / IP..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="px-3 py-1.5 text-xs rounded-lg border border-[#acd3ff] dark:border-slate-700 bg-white dark:bg-slate-900 text-[#002b5c] dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500 w-60"
          />
          <select
            value={actionFilter}
            onChange={(e) => setActionFilter(e.target.value)}
            className="px-3 py-1.5 text-xs rounded-lg border border-[#acd3ff] dark:border-slate-700 bg-white dark:bg-slate-900 text-[#002b5c] dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">Semua Aksi</option>
            <option value="update_thresholds">Batas Threshold</option>
            <option value="update_api_sources">API Source Map</option>
            <option value="update_sensor_rules">Sensor Rules</option>
            <option value="update_rh_task_rules">Running Hours Task Rules</option>
            <option value="complete_maintenance_task">Penyelesaian Maintenance</option>
          </select>
          <button
            type="submit"
            className="px-4 py-1.5 text-xs font-bold text-white bg-[#1f6fb5] hover:bg-[#155c99] rounded-lg transition"
          >
            Filter
          </button>
        </form>
      </div>

      {/* Audit Logs Table */}
      <div className="bg-white dark:bg-slate-950 border border-[#acd3ff] dark:border-slate-800 rounded-xl p-5 shadow-sm">
        {loading ? (
          <div className="py-12 text-center text-xs text-[#47729f] dark:text-slate-400">
            Memuat audit trail logs...
          </div>
        ) : logs.length === 0 ? (
          <div className="py-12 text-center text-xs text-[#47729f] dark:text-slate-400">
            Belum ada log perubahan terdeteksi untuk mesin <strong className="font-semibold">{unitId}</strong>.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-[#acd3ff]/50 dark:border-slate-800 text-[10px] uppercase tracking-wider text-[#47729f] dark:text-slate-500 font-bold">
                  <th className="pb-3 px-3">Waktu (WIB)</th>
                  <th className="pb-3 px-3">Actor / User</th>
                  <th className="pb-3 px-3">Jenis Aksi</th>
                  <th className="pb-3 px-3">Target Resource</th>
                  <th className="pb-3 px-3">IP Address</th>
                  <th className="pb-3 px-3 text-right">Rincian</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-900 font-medium text-[#002b5c] dark:text-slate-300">
                {logs.map((log) => {
                  const isExpanded = expandedLogId === log._id;
                  const dateStr = new Date(log.ts).toLocaleString("id-ID", { timeZone: "Asia/Jakarta" });
                  return (
                    <tr key={log._id} className="hover:bg-slate-50/50 dark:hover:bg-slate-900/40 transition">
                      <td className="py-3 px-3 font-mono text-[11px] whitespace-nowrap">{dateStr}</td>
                      <td className="py-3 px-3 font-bold">{log.actorId}</td>
                      <td className="py-3 px-3">
                        <span className={`inline-block px-2.5 py-0.5 rounded text-[10px] font-extrabold uppercase border ${getActionBadgeColor(log.action)}`}>
                          {log.action}
                        </span>
                      </td>
                      <td className="py-3 px-3 font-mono text-[11px] text-slate-500">{log.resourceId || unitId}</td>
                      <td className="py-3 px-3 font-mono text-[11px] text-slate-400">{log.ip || "127.0.0.1"}</td>
                      <td className="py-3 px-3 text-right">
                        <button
                          type="button"
                          onClick={() => setExpandedLogId(isExpanded ? null : log._id)}
                          className="px-2.5 py-1 text-[11px] font-bold text-[#1f6fb5] dark:text-sky-400 hover:underline"
                        >
                          {isExpanded ? "Sembunyikan ▲" : "Lihat Detail ▼"}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Expanded log metadata detail */}
        {expandedLogId && (
          <div className="mt-4 p-4 border border-[#acd3ff] dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/60 rounded-xl">
            {(() => {
              const item = logs.find((l) => l._id === expandedLogId);
              if (!item) return null;
              return (
                <div>
                  <h4 className="text-xs font-bold text-[#002b5c] dark:text-slate-200 mb-1">
                    Detail Perubahan — {item.action}
                  </h4>
                  {formatChangeDetails(item)}
                </div>
              );
            })()}
          </div>
        )}

        {/* Pagination Controls */}
        {pagination.totalPages > 1 && (
          <div className="flex items-center justify-between pt-4 border-t border-slate-100 dark:border-slate-900 mt-4 text-xs">
            <span className="text-[#47729f] dark:text-slate-400">
              Halaman {pagination.page} dari {pagination.totalPages} ({pagination.total} Log)
            </span>
            <div className="flex gap-1.5">
              <button
                disabled={pagination.page <= 1}
                onClick={() => fetchLogs(pagination.page - 1)}
                className="px-3 py-1 rounded border border-[#acd3ff] dark:border-slate-800 disabled:opacity-40"
              >
                Previous
              </button>
              <button
                disabled={pagination.page >= pagination.totalPages}
                onClick={() => fetchLogs(pagination.page + 1)}
                className="px-3 py-1 rounded border border-[#acd3ff] dark:border-slate-800 disabled:opacity-40"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
