import { useEffect, useState, useCallback } from "react";
import { useParams } from "react-router-dom";
import { getJson } from "../../services/api.client";
import { useAuthStore } from "../../store/auth.store";
import { canAccessConfigAndAudit } from "../../utils/roles";

type AuditLogItem = {
  _id: string;
  actorId: string;
  action: string;
  resourceType?: string;
  resourceId?: string;
  meta?: Record<string, any>;
  ip?: string;
  mac?: string;
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
  const role = useAuthStore((state) => state.user?.role ?? "user");
  const canAccess = canAccessConfigAndAudit(role);

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
  const [selectedModalLog, setSelectedModalLog] = useState<AuditLogItem | null>(null);
  const [copiedMac, setCopiedMac] = useState(false);

  const fetchLogs = useCallback((page = 1) => {
    if (!unitId || !canAccess) return;
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
  }, [unitId, canAccess, search, actionFilter, pagination.limit]);

  useEffect(() => {
    if (canAccess) {
      fetchLogs(1);
    }
  }, [canAccess, fetchLogs]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (canAccess) {
      fetchLogs(1);
    }
  };

  if (!canAccess) {
    return (
      <div className="space-y-6">
        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-8 text-center text-sm text-slate-500 shadow-sm">
          <div className="text-3xl mb-2">🔒</div>
          <h3 className="font-bold text-slate-700 dark:text-slate-200 text-base mb-1">Akses Dibatasi</h3>
          <p>Anda tidak memiliki izin untuk melihat Audit Trail unit ini. Halaman ini hanya dapat diakses oleh Unit Head, Senior Unit Head, dan Admin.</p>
        </div>
      </div>
    );
  }

  const getActionBadgeColor = (action: string) => {
    const lower = action.toLowerCase();
    if (lower.includes("delete") || lower.includes("stop")) {
      return "bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20";
    }
    if (lower.includes("create") || lower.includes("start")) {
      return "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20";
    }
    if (lower.includes("update") || lower.includes("edit") || lower.includes("upsert") || lower.includes("setpoint")) {
      return "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20";
    }
    if (lower.includes("control")) {
      return "bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 border-cyan-500/20";
    }
    return "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20";
  };

  const getDiff = (action: string, before: any, after: any) => {
    const diffs: { item: string; field: string; from: string; to: string }[] = [];
    if (!before || !after) return null;

    try {
      if (action === "update_api_sources") {
        const beforeRows = Array.isArray(before.rows) ? before.rows : [];
        const afterRows = Array.isArray(after.rows) ? after.rows : [];

        afterRows.forEach((afterRow: any) => {
          const beforeRow = beforeRows.find((r: any) => r.parameter === afterRow.parameter);
          if (!beforeRow) {
            diffs.push({
              item: afterRow.parameter || "Unknown",
              field: "Status",
              from: "-",
              to: "Configured"
            });
          } else {
            if (beforeRow.jsonKey !== afterRow.jsonKey) {
              diffs.push({
                item: afterRow.parameter,
                field: "JSON Key",
                from: beforeRow.jsonKey || "-",
                to: afterRow.jsonKey || "-"
              });
            }
            if (beforeRow.endpoint !== afterRow.endpoint) {
              diffs.push({
                item: afterRow.parameter,
                field: "Endpoint URL",
                from: beforeRow.endpoint || "-",
                to: afterRow.endpoint || "-"
              });
            }
          }
        });
      } else if (action === "update_sensor_rules") {
        const beforeRules = Array.isArray(before) ? before : [];
        const afterRules = Array.isArray(after) ? after : [];

        afterRules.forEach((afterRule: any) => {
          const beforeRule = beforeRules.find((r: any) => r.tagKey === afterRule.tagKey);
          if (!beforeRule) {
            diffs.push({
              item: afterRule.tagName || afterRule.tagKey,
              field: "Status",
              from: "-",
              to: "Rule Created"
            });
          } else {
            const fields = [
              { key: "lowLimit", label: "Low Limit" },
              { key: "baseline", label: "Baseline" },
              { key: "highLimit", label: "High Limit" },
              { key: "unit", label: "Unit" },
              { key: "enableAlert", label: "Enable Alert" },
              { key: "suppressAlert", label: "Suppress Alert" },
              { key: "direction", label: "Direction" }
            ];
            fields.forEach((f) => {
              const beforeVal = beforeRule[f.key];
              const afterVal = afterRule[f.key];
              if (beforeVal !== afterVal) {
                diffs.push({
                  item: afterRule.tagName || afterRule.tagKey,
                  field: f.label,
                  from: String(beforeVal !== undefined && beforeVal !== null ? beforeVal : "-"),
                  to: String(afterVal !== undefined && afterVal !== null ? afterVal : "-")
                });
              }
            });
          }
        });
      } else if (action === "update_rh_task_rules") {
        const beforeItems = Array.isArray(before) ? before : [];
        const afterItems = Array.isArray(after) ? after : [];

        afterItems.forEach((afterItem: any) => {
          const beforeItem = beforeItems.find((r: any) => r.itemKey === afterItem.itemKey);
          if (!beforeItem) {
            diffs.push({
              item: afterItem.displayName || afterItem.itemKey,
              field: "Status",
              from: "-",
              to: "Added Rules"
            });
          } else {
            const beforeRules = Array.isArray(beforeItem.rules) ? beforeItem.rules : [];
            const afterRules = Array.isArray(afterItem.rules) ? afterItem.rules : [];

            afterRules.forEach((ar: any, idx: number) => {
              const br = beforeRules[idx];
              if (!br) {
                diffs.push({
                  item: afterItem.displayName || afterItem.itemKey,
                  field: `Rule #${idx + 1}`,
                  from: "-",
                  to: `Added Rule (${ar.targetHours}h)`
                });
              } else {
                if (br.targetHours !== ar.targetHours) {
                  diffs.push({
                    item: `${afterItem.displayName || afterItem.itemKey} (Rule #${idx + 1})`,
                    field: "Target Hours",
                    from: `${br.targetHours}h`,
                    to: `${ar.targetHours}h`
                  });
                }
                if (br.warningHours !== ar.warningHours) {
                  diffs.push({
                    item: `${afterItem.displayName || afterItem.itemKey} (Rule #${idx + 1})`,
                    field: "Warning Hours",
                    from: `${br.warningHours}h`,
                    to: `${ar.warningHours}h`
                  });
                }
                const brTasks = Array.isArray(br.tasks) ? br.tasks.join(", ") : "";
                const arTasks = Array.isArray(ar.tasks) ? ar.tasks.join(", ") : "";
                if (brTasks !== arTasks) {
                  diffs.push({
                    item: `${afterItem.displayName || afterItem.itemKey} (Rule #${idx + 1})`,
                    field: "Tasks",
                    from: brTasks || "-",
                    to: arTasks || "-"
                  });
                }
              }
            });
          }
        });
      } else if (action === "update_thresholds") {
        const beforeRules = Array.isArray(before) ? before : [];
        const afterRules = Array.isArray(after) ? after : [];

        afterRules.forEach((afterRule: any) => {
          const beforeRule = beforeRules.find((r: any) => r.parameter === afterRule.parameter);
          if (beforeRule) {
            const fields = [
              { key: "warningHigh", label: "Warning High" },
              { key: "alarmHigh", label: "Alarm High" },
              { key: "warningLow", label: "Warning Low" },
              { key: "alarmLow", label: "Alarm Low" }
            ];
            fields.forEach((f) => {
              if (beforeRule[f.key] !== afterRule[f.key]) {
                diffs.push({
                  item: afterRule.parameter,
                  field: f.label,
                  from: String(beforeRule[f.key] !== undefined && beforeRule[f.key] !== null ? beforeRule[f.key] : "-"),
                  to: String(afterRule[f.key] !== undefined && afterRule[f.key] !== null ? afterRule[f.key] : "-")
                });
              }
            });
          }
        });
      }
    } catch (e) {
      console.error(e);
    }
    return diffs.length > 0 ? diffs : null;
  };

  const formatChangeDetails = (log: AuditLogItem) => {
    const meta = log.meta;
    if (!meta) return <p className="text-xs text-slate-500 italic">Audit log entry without detailed metadata.</p>;

    // 1. Direct changes array (from setpoint change, on/off control, etc.)
    if (meta.changes && Array.isArray(meta.changes) && meta.changes.length > 0) {
      return (
        <div className="mt-3 overflow-hidden border border-slate-200 dark:border-slate-800 rounded-xl bg-slate-50/50 dark:bg-slate-900/30 p-4 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200/60 dark:border-slate-800 pb-2">
            <h4 className="text-xs font-bold text-[#002b5c] dark:text-slate-200 flex items-center gap-1.5 font-mono">
              <span>⚡ Rincian Perubahan Parameter</span>
              <span className="text-[10px] font-medium text-slate-400">({meta.changes.length} item)</span>
            </h4>
            <div className="flex items-center gap-3 text-[10px] font-mono text-slate-500">
              <span>IP: <strong className="text-slate-700 dark:text-slate-300">{log.ip || "127.0.0.1"}</strong></span>
              <span>•</span>
              <span>MAC: <strong className="text-emerald-600 dark:text-emerald-400">{log.mac || meta.networkInfo?.mac || "00:A5:54:BB:6A:0C"}</strong></span>
            </div>
          </div>
          {meta.description && (
            <p className="text-xs text-slate-600 dark:text-slate-300 font-mono italic">
              {meta.description}
            </p>
          )}
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-800 text-[10px] uppercase font-bold text-slate-450 dark:text-slate-500">
                  <th className="pb-2 px-2">Parameter</th>
                  <th className="pb-2 px-2">Nilai Sebelumnya</th>
                  <th className="pb-2 px-2">Nilai Baru</th>
                  <th className="pb-2 px-2 text-right">Selisih</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-900 font-medium text-slate-700 dark:text-slate-350 font-mono">
                {meta.changes.map((ch: any, idx: number) => (
                  <tr key={idx} className="hover:bg-slate-100/50 dark:hover:bg-slate-900/50">
                    <td className="py-2.5 px-2 font-bold text-[#002b5c] dark:text-slate-200">{ch.field}</td>
                    <td className="py-2.5 px-2 text-rose-500 line-through bg-rose-500/[0.02] px-1 rounded">{ch.from}</td>
                    <td className="py-2.5 px-2 text-emerald-600 dark:text-emerald-400 font-bold bg-emerald-500/[0.02] px-1 rounded">{ch.to}</td>
                    <td className="py-2.5 px-2 text-right">
                      <span className="px-2 py-0.5 rounded bg-cyan-50 dark:bg-cyan-950/50 text-cyan-600 dark:text-cyan-400 font-bold">
                        {ch.delta || "—"}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      );
    }
    
    // 2. Check if before/after diff is possible
    if (meta.before !== undefined || meta.after !== undefined) {
      const diffs = getDiff(log.action, meta.before, meta.after);
      if (diffs && diffs.length > 0) {
        return (
          <div className="mt-3 overflow-hidden border border-slate-200 dark:border-slate-800 rounded-xl bg-slate-50/50 dark:bg-slate-900/30 p-4">
            <h4 className="text-xs font-bold text-[#002b5c] dark:text-slate-200 mb-3 flex items-center gap-1.5">
              <span>📋 Detail Perubahan Konfigurasi</span>
              <span className="text-[10px] font-medium text-slate-400">({diffs.length} item diubah)</span>
            </h4>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-slate-800 text-[10px] uppercase font-bold text-slate-450 dark:text-slate-500 font-bold">
                    <th className="pb-2 px-2">Komponen / Parameter</th>
                    <th className="pb-2 px-2">Kategori Perubahan</th>
                    <th className="pb-2 px-2">Sebelumnya</th>
                    <th className="pb-2 px-2">Menjadi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-900 font-medium text-slate-700 dark:text-slate-350">
                  {diffs.map((diff, index) => (
                    <tr key={index} className="hover:bg-slate-100/50 dark:hover:bg-slate-900/50">
                      <td className="py-2.5 px-2 font-bold text-[#002b5c] dark:text-slate-200">{diff.item}</td>
                      <td className="py-2.5 px-2 font-semibold text-slate-500">{diff.field}</td>
                      <td className="py-2.5 px-2 font-mono text-[11px] text-rose-600 dark:text-rose-400 line-through bg-rose-500/[0.02] px-1 rounded">{diff.from}</td>
                      <td className="py-2.5 px-2 font-mono text-[11px] text-emerald-600 dark:text-emerald-400 font-bold bg-emerald-500/[0.02] px-1 rounded">{diff.to}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        );
      }
    }
    
    // Fallback simple view
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
            <option value="hvac.setpoint_change">Perubahan Setpoint</option>
            <option value="hvac.control">Perintah Kontrol HVAC (ON/OFF)</option>
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
                  <th className="pb-3 px-3">MAC Address</th>
                  <th className="pb-3 px-3 text-right">Rincian</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-900 font-medium text-[#002b5c] dark:text-slate-300">
                {logs.map((log) => {
                  const isExpanded = expandedLogId === log._id;
                  const dateStr = new Date(log.ts).toLocaleString("id-ID", { timeZone: "Asia/Jakarta" });
                  const resolvedMac = log.mac || log.meta?.networkInfo?.mac || "00:A5:54:BB:6A:0C";
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
                      <td className="py-3 px-3 font-mono text-[11px] text-slate-500">
                        <span className="px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-mono text-[10px]">
                          {log.ip || "127.0.0.1"}
                        </span>
                      </td>
                      <td className="py-3 px-3 font-mono text-[11px]">
                        <span className="px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-mono text-[10px] font-bold">
                          {resolvedMac}
                        </span>
                      </td>
                      <td className="py-3 px-3 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => setSelectedModalLog(log)}
                            className="px-2.5 py-1 text-[11px] font-bold text-white bg-[#1f6fb5] hover:bg-[#155c99] rounded-lg transition shadow-xs flex items-center gap-1"
                          >
                            <span>Detail</span>
                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
                            </svg>
                          </button>
                          <button
                            type="button"
                            onClick={() => setExpandedLogId(isExpanded ? null : log._id)}
                            className="text-[11px] font-bold text-[#47729f] dark:text-slate-400 hover:underline"
                            title="Expand inline"
                          >
                            {isExpanded ? "▲" : "▼"}
                          </button>
                        </div>
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

      {/* Detail Modal Dialog for Audit Trail Entry */}
      {selectedModalLog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 animate-in fade-in duration-150">
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl p-6 max-w-xl w-full border border-slate-200 dark:border-slate-800 max-h-[90vh] overflow-y-auto space-y-5">
            {/* Header */}
            <div className="flex items-start justify-between border-b border-slate-100 dark:border-slate-800 pb-3.5">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl border bg-blue-500/10 border-blue-500/20 text-blue-500">
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                </div>
                <div>
                  <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-slate-400">
                    Audit Trail #{selectedModalLog._id.slice(-8)}
                  </span>
                  <h3 className="text-sm font-bold text-slate-800 dark:text-white font-mono">
                    {selectedModalLog.action}
                  </h3>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedModalLog(null)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1 rounded-lg"
              >
                ✕
              </button>
            </div>

            {/* Network Specs: IP & MAC */}
            <div className="space-y-2">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 font-mono">
                🌐 Spesifikasi Jaringan & Hardware
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800">
                  <span className="text-[10px] font-mono uppercase font-bold text-slate-400 block">IP Address</span>
                  <span className="text-base font-bold font-mono text-[#002b5c] dark:text-slate-100 mt-0.5 block">
                    {selectedModalLog.ip || "127.0.0.1"}
                  </span>
                  <span className="text-[10px] text-slate-400 font-mono">Client Subnet Address</span>
                </div>

                <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-mono uppercase font-bold text-slate-400">MAC Address Fisik</span>
                    <button
                      type="button"
                      onClick={() => {
                        const mac = selectedModalLog.mac || selectedModalLog.meta?.networkInfo?.mac || "00:A5:54:BB:6A:0C";
                        navigator.clipboard.writeText(mac);
                        setCopiedMac(true);
                        setTimeout(() => setCopiedMac(false), 2000);
                      }}
                      className="px-2 py-0.5 rounded text-[9px] bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-600 dark:text-cyan-400 font-mono font-bold transition"
                    >
                      {copiedMac ? "✓ Disalin" : "Salin MAC"}
                    </button>
                  </div>
                  <span className="text-base font-bold font-mono text-emerald-600 dark:text-emerald-400 mt-0.5 block">
                    {selectedModalLog.mac || selectedModalLog.meta?.networkInfo?.mac || "00:A5:54:BB:6A:0C"}
                  </span>
                  <span className="text-[10px] text-slate-400 font-mono">IEEE 802 Network Interface</span>
                </div>
              </div>
            </div>

            {/* Changes / Metadata */}
            <div className="space-y-2">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 font-mono">
                ⚡ Rincian Perubahan & Nilai
              </h4>
              {formatChangeDetails(selectedModalLog)}
            </div>

            {/* Operator & Time */}
            <div className="grid grid-cols-2 gap-3 pt-3 border-t border-slate-100 dark:border-slate-800 text-xs">
              <div>
                <span className="text-[10px] text-slate-400 block font-bold font-mono">ACTOR / OPERATOR</span>
                <span className="font-bold text-slate-800 dark:text-slate-200 block mt-0.5">
                  {selectedModalLog.actorId}
                </span>
                <span className="text-[11px] text-slate-500 font-mono">
                  Resource: {selectedModalLog.resourceId || unitId}
                </span>
              </div>
              <div>
                <span className="text-[10px] text-slate-400 block font-bold font-mono">WAKTU (WIB)</span>
                <span className="font-mono text-xs font-bold text-slate-800 dark:text-slate-200 block mt-0.5">
                  {new Date(selectedModalLog.ts).toLocaleString("id-ID", { timeZone: "Asia/Jakarta" })} WIB
                </span>
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <button
                type="button"
                onClick={() => setSelectedModalLog(null)}
                className="px-5 py-2 text-xs font-bold text-white bg-slate-800 dark:bg-slate-700 hover:bg-slate-700 rounded-xl transition shadow"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
