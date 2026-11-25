import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { PageHeader } from "../../components/ui/PageHeader";
import { useAuthStore, getAccessToken } from "../../store/auth.store";
import { useSystemStore } from "../../store/system.store";
import { isSeniorUnitHeadOrAdmin } from "../../utils/roles";
import { buildApiUrl, deleteJson, getJson, patchJson, postJson } from "../../services/api.client";
import type {
  AnomalyEvent,
  AnomalyType,
  ChecklistResponse,
  HealthResponse,
  HealthStatus,
  OverviewResponse,
  PmCatalogMeta,
  PmChecklistItem,
  PmChecklistPatch,
  SourceTable
} from "../../components/pm-health/pmHealth.types";
import {
  anomalyTypeMeta,
  fmtDelta,
  fmtNumber,
  getChecklistProgress,
  getDaysAgoIso,
  getEmptyChecklistItem,
  getLocalTodayIso,
  healthStatusMeta,
  playPmAnomalyChime,
  sourceTableShort
} from "../../components/pm-health/pmHealth.utils";
import { PmMiniSparkline } from "../../components/pm-health/PmMiniSparkline";
import { PmHealthDetailModal } from "../../components/pm-health/PmHealthDetailModal";
import { PmAnomalyToastStack } from "../../components/pm-health/PmAnomalyToastStack";
import { PmChecklistPanel } from "../../components/pm-health/PmChecklistPanel";

type MainTab = "overview" | "checklist" | "logs" | "audit";

const AUTO_REFRESH_MS = 15_000;

export default function PmHealthMonitor() {
  const role = useAuthStore((s) => s.user?.role ?? "user");
  const isAdmin = isSeniorUnitHeadOrAdmin(role);
  const theme = useSystemStore((s) => s.theme);
  const isDark = theme === "dark";

  const [notificationsEnabled, setNotificationsEnabled] = useState<boolean>(() => {
    if (typeof window === "undefined") return true;
    return localStorage.getItem("scada_pm_health_popups") !== "off";
  });
  const notificationsEnabledRef = useRef(notificationsEnabled);
  notificationsEnabledRef.current = notificationsEnabled;

  useEffect(() => {
    localStorage.setItem("scada_pm_health_popups", notificationsEnabled ? "on" : "off");
    if (!notificationsEnabled) {
      setToasts([]);
    }
  }, [notificationsEnabled]);

  const [soundEnabled, setSoundEnabled] = useState<boolean>(() => {
    if (typeof window === "undefined") return true;
    return localStorage.getItem("scada_pm_health_sound") !== "off";
  });
  const soundEnabledRef = useRef(soundEnabled);
  soundEnabledRef.current = soundEnabled;

  useEffect(() => {
    localStorage.setItem("scada_pm_health_sound", soundEnabled ? "on" : "off");
  }, [soundEnabled]);

  const [autoRefreshEnabled, setAutoRefreshEnabled] = useState<boolean>(() => {
    if (typeof window === "undefined") return true;
    return localStorage.getItem("scada_pm_health_autorefresh") !== "off";
  });

  useEffect(() => {
    localStorage.setItem("scada_pm_health_autorefresh", autoRefreshEnabled ? "on" : "off");
  }, [autoRefreshEnabled]);

  // Global monitoring state
  const [activeTab, setActiveTab] = useState<MainTab>("overview");
  const [health, setHealth] = useState<HealthResponse | null>(null);
  const [overview, setOverview] = useState<OverviewResponse | null>(null);
  const [overviewLoading, setOverviewLoading] = useState(false);
  const [overviewError, setOverviewError] = useState<string | null>(null);

  // Baseline "Pantau Mulai Sekarang" state
  const [resetAt, setResetAt] = useState<string | null>(null);
  const [windowMode, setWindowMode] = useState<"since_reset" | "hours">("hours");
  const [resettingBaseline, setResettingBaseline] = useState(false);
  const initialHydratedRef = useRef(false);

  // Overview filter state
  const [windowHours, setWindowHours] = useState<number>(24);
  const [sourceFilter, setSourceFilter] = useState<"both" | SourceTable>("both");
  const [statusFilter, setStatusFilter] = useState<"all" | HealthStatus>("all");
  const [factoryFilter, setFactoryFilter] = useState<string>("all");
  const [pmSearch, setPmSearch] = useState<string>("");

  // Logs tab state
  const [logs, setLogs] = useState<AnomalyEvent[]>([]);
  const [logsTotal, setLogsTotal] = useState(0);
  const [unreadCount, setUnreadCount] = useState(0);
  const [unackedCount, setUnackedCount] = useState(0);
  const [logsLoading, setLogsLoading] = useState(false);
  const [logSearch, setLogSearch] = useState("");
  const [logTypeFilter, setLogTypeFilter] = useState<"all" | AnomalyType>("all");
  const [logSourceFilter, setLogSourceFilter] = useState<"both" | SourceTable>("both");
  const [logAckFilter, setLogAckFilter] = useState<"all" | "open" | "acked">("all");
  const [logStartDate, setLogStartDate] = useState("");
  const [logEndDate, setLogEndDate] = useState("");

  // Audit historical scan state
  const [auditStartDate, setAuditStartDate] = useState(getDaysAgoIso(2));
  const [auditEndDate, setAuditEndDate] = useState(getLocalTodayIso());
  const [auditSource, setAuditSource] = useState<"both" | SourceTable>("both");
  const [auditPmId, setAuditPmId] = useState("all");
  const [auditSaveBeforeReset, setAuditSaveBeforeReset] = useState(false);
  const [auditRunning, setAuditRunning] = useState(false);
  const [auditResult, setAuditResult] = useState<{
    scannedAt: string;
    minuteRowsScanned: number;
    hourlyRowsScanned: number;
    detectedCount: number;
    newlyLoggedCount: number;
    anomalies: AnomalyEvent[];
  } | null>(null);

  // Verification Checklist state (eWON, Endpoint, Panel LCD)
  const [checklistMap, setChecklistMap] = useState<Record<string, PmChecklistItem>>({});
  const [checklistCatalog, setChecklistCatalog] = useState<PmCatalogMeta[]>([]);
  const [checklistLoading, setChecklistLoading] = useState(false);
  const [savingChecklistPmIds, setSavingChecklistPmIds] = useState<Record<string, boolean>>({});
  const [checklistError, setChecklistError] = useState<string | null>(null);

  // Live notifications & UI popovers
  const [toasts, setToasts] = useState<AnomalyEvent[]>([]);
  const [bellOpen, setBellOpen] = useState(false);
  const bellRef = useRef<HTMLDivElement | null>(null);
  const [selectedPmId, setSelectedPmId] = useState<string | null>(null);
  const [manualScanning, setManualScanning] = useState(false);

  const fetchChecklist = useCallback(
    async (silent = false) => {
      if (!isAdmin) return;
      if (!silent) setChecklistLoading(true);
      try {
        const json = await getJson<ChecklistResponse>("/pm-health/checklist");
        setChecklistMap(json.items || {});
        if (Array.isArray(json.catalog)) {
          setChecklistCatalog(json.catalog);
        }
        setChecklistError(null);
      } catch (err: any) {
        if (!silent) {
          setChecklistError(err?.message || "Gagal memuat checklist verifikasi PM");
        }
      } finally {
        if (!silent) setChecklistLoading(false);
      }
    },
    [isAdmin]
  );

  const fetchHealth = useCallback(async () => {
    if (!isAdmin) return;
    try {
      const json = await getJson<HealthResponse>("/pm-health/health");
      setHealth(json);
      setUnreadCount(json.logs.unreadCount);
      setUnackedCount(json.logs.unacknowledgedCount);
      const serverResetAt = json.logs.resetAt ?? json.monitor.resetAt ?? null;
      setResetAt(serverResetAt);
      if (!initialHydratedRef.current) {
        initialHydratedRef.current = true;
        if (serverResetAt) {
          setWindowMode("since_reset");
        }
      }
    } catch {
      // ignore transient error
    }
  }, [isAdmin]);

  const fetchOverview = useCallback(
    async (overrideMode?: "since_reset" | "hours", options?: { silent?: boolean }) => {
      if (!isAdmin) return;
      const silent = Boolean(options?.silent);
      if (!silent) {
        setOverviewLoading(true);
        setOverviewError(null);
      }
      try {
        const effectiveMode = overrideMode ?? windowMode;
        const qs = new URLSearchParams({ source: sourceFilter });
        if (effectiveMode === "since_reset") {
          qs.set("sinceReset", "true");
        } else {
          qs.set("hours", String(windowHours));
        }
        const json = await getJson<OverviewResponse>(`/pm-health/overview?${qs.toString()}`);
        setOverview(json);
        setOverviewError(null);
        setUnreadCount(json.logStats.unreadCount);
        setUnackedCount(json.logStats.unacknowledgedCount);
        setResetAt(json.logStats.resetAt ?? null);

        // Surface live anomaly notifications even if reverse proxy buffers/drops SSE
        if (silent && notificationsEnabledRef.current && Array.isArray(json.newlyLogged) && json.newlyLogged.length > 0) {
          const incoming = json.newlyLogged;
          setToasts((prev) => {
            const seen = new Set(prev.map((p) => p.id));
            const unique = incoming.filter((i) => !seen.has(i.id));
            return unique.length > 0 ? [...unique, ...prev].slice(0, 6) : prev;
          });
          if (soundEnabledRef.current) {
            playPmAnomalyChime();
          }
        }
      } catch (err: any) {
        if (!silent) {
          setOverviewError(err?.message || "Gagal memuat data kesehatan Power Meter");
        }
      } finally {
        if (!silent) {
          setOverviewLoading(false);
        }
      }
    },
    [isAdmin, windowMode, windowHours, sourceFilter]
  );

  const fetchLogs = useCallback(
    async (silent = false) => {
      if (!isAdmin) return;
      if (!silent) setLogsLoading(true);
      try {
        const qs = new URLSearchParams({
          type: logTypeFilter,
          source: logSourceFilter,
          ack: logAckFilter,
          limit: "1000"
        });
        if (logSearch.trim()) qs.set("search", logSearch.trim());
        if (logStartDate) qs.set("startDate", logStartDate);
        if (logEndDate) qs.set("endDate", logEndDate);

        const json = await getJson<{
          logs: AnomalyEvent[];
          total: number;
          unreadCount: number;
          unacknowledgedCount: number;
          resetAt?: string | null;
        }>(`/pm-health/logs?${qs.toString()}`);
        setLogs(json.logs || []);
        setLogsTotal(json.total || 0);
        setUnreadCount(json.unreadCount || 0);
        setUnackedCount(json.unacknowledgedCount || 0);
        if ("resetAt" in json) {
          setResetAt(json.resetAt ?? null);
        }
      } catch {
        // ignore
      } finally {
        if (!silent) setLogsLoading(false);
      }
    },
    [isAdmin, logTypeFilter, logSourceFilter, logAckFilter, logSearch, logStartDate, logEndDate]
  );

  const fetchHealthRef = useRef(fetchHealth);
  fetchHealthRef.current = fetchHealth;
  const fetchOverviewRef = useRef(fetchOverview);
  fetchOverviewRef.current = fetchOverview;
  const fetchLogsRef = useRef(fetchLogs);
  fetchLogsRef.current = fetchLogs;
  const fetchChecklistRef = useRef(fetchChecklist);
  fetchChecklistRef.current = fetchChecklist;
  const autoRefreshInFlightRef = useRef(false);

  useEffect(() => {
    if (!isAdmin) return;
    void fetchHealth();
  }, [isAdmin, fetchHealth]);

  useEffect(() => {
    if (!isAdmin) return;
    void fetchOverview();
  }, [isAdmin, fetchOverview]);

  useEffect(() => {
    if (!isAdmin) return;
    void fetchLogs();
  }, [isAdmin, fetchLogs]);

  useEffect(() => {
    if (!isAdmin) return;
    void fetchChecklist();
  }, [isAdmin, fetchChecklist]);

  // Guaranteed real-time auto-refresh every 15s (works even behind buffering reverse proxies / Nginx)
  useEffect(() => {
    if (!isAdmin || !autoRefreshEnabled) return;

    const runAutoRefresh = async () => {
      if (document.visibilityState !== "visible") return;
      if (autoRefreshInFlightRef.current) return;
      autoRefreshInFlightRef.current = true;
      try {
        await Promise.all([
          fetchOverviewRef.current(undefined, { silent: true }),
          fetchHealthRef.current(),
          fetchLogsRef.current(true),
          fetchChecklistRef.current(true)
        ]);
      } finally {
        autoRefreshInFlightRef.current = false;
      }
    };

    const interval = window.setInterval(() => {
      void runAutoRefresh();
    }, AUTO_REFRESH_MS);

    const onVisibilityOrFocus = () => {
      if (document.visibilityState === "visible") {
        void runAutoRefresh();
      }
    };

    document.addEventListener("visibilitychange", onVisibilityOrFocus);
    window.addEventListener("focus", onVisibilityOrFocus);

    return () => {
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisibilityOrFocus);
      window.removeEventListener("focus", onVisibilityOrFocus);
    };
  }, [isAdmin, autoRefreshEnabled]);

  // Authenticated SSE stream for instant anomaly push notifications & live checklist/baseline sync
  useEffect(() => {
    if (!isAdmin) return;
    const token = getAccessToken();
    if (!token) return;

    const sseUrl = `${buildApiUrl("/pm-health/events")}?token=${encodeURIComponent(token)}`;
    const es = new EventSource(sseUrl);

    const onAnomaly = (event: MessageEvent) => {
      try {
        const data = JSON.parse(event.data);
        const incoming: AnomalyEvent[] = Array.isArray(data.anomalies) ? data.anomalies : [];
        if (incoming.length > 0 && notificationsEnabledRef.current) {
          setToasts((prev) => {
            const seen = new Set(prev.map((p) => p.id));
            const unique = incoming.filter((i) => !seen.has(i.id));
            return [...unique, ...prev].slice(0, 6);
          });
          if (soundEnabledRef.current) {
            playPmAnomalyChime();
          }
        }
        if (data.stats) {
          setUnreadCount(data.stats.unreadCount ?? 0);
          setUnackedCount(data.stats.unacknowledgedCount ?? 0);
          if ("resetAt" in data.stats) setResetAt(data.stats.resetAt ?? null);
        }
        void fetchOverviewRef.current(undefined, { silent: true });
        void fetchLogsRef.current(true);
      } catch {
        // ignore parse error
      }
    };

    const onHeartbeat = (event: MessageEvent) => {
      try {
        const data = JSON.parse(event.data);
        if (data.stats) {
          setUnreadCount(data.stats.unreadCount ?? 0);
          setUnackedCount(data.stats.unacknowledgedCount ?? 0);
          if ("resetAt" in data.stats) setResetAt(data.stats.resetAt ?? null);
        }
        void fetchHealthRef.current();
        void fetchOverviewRef.current(undefined, { silent: true });
      } catch {
        // ignore
      }
    };

    const onBaselineReset = (event: MessageEvent) => {
      try {
        const data = JSON.parse(event.data);
        const nextResetAt: string | null = data.resetAt ?? null;
        setResetAt(nextResetAt);
        setToasts([]);
        setWindowMode(nextResetAt ? "since_reset" : "hours");
        void fetchHealthRef.current();
        void fetchOverviewRef.current(nextResetAt ? "since_reset" : "hours", { silent: true });
        void fetchLogsRef.current(true);
      } catch {
        // ignore
      }
    };

    const onChecklistUpdated = (event: MessageEvent) => {
      try {
        const data = JSON.parse(event.data);
        const updatedItem = data?.item as PmChecklistItem | undefined;
        if (updatedItem && updatedItem.pmId) {
          const key = updatedItem.pmId.toUpperCase();
          setChecklistMap((prev) => ({ ...prev, [key]: updatedItem }));
        }
      } catch {
        // ignore
      }
    };

    const onChecklistReset = () => {
      setChecklistMap({});
    };

    es.addEventListener("anomaly", onAnomaly);
    es.addEventListener("heartbeat_scan", onHeartbeat);
    es.addEventListener("baseline_reset", onBaselineReset);
    es.addEventListener("checklist_updated", onChecklistUpdated);
    es.addEventListener("checklist_reset", onChecklistReset);
    return () => {
      es.removeEventListener("anomaly", onAnomaly);
      es.removeEventListener("heartbeat_scan", onHeartbeat);
      es.removeEventListener("baseline_reset", onBaselineReset);
      es.removeEventListener("checklist_updated", onChecklistUpdated);
      es.removeEventListener("checklist_reset", onChecklistReset);
      es.close();
    };
  }, [isAdmin]);

  useEffect(() => {
    if (!bellOpen) return;
    const handler = (e: MouseEvent) => {
      if (bellRef.current && !bellRef.current.contains(e.target as Node)) {
        setBellOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [bellOpen]);

  const handleManualScanNow = async () => {
    setManualScanning(true);
    try {
      await postJson(
        "/pm-health/scan",
        windowMode === "since_reset" && resetAt
          ? { sinceReset: true, source: sourceFilter }
          : { hours: windowHours, source: sourceFilter }
      );
      await Promise.all([fetchHealth(), fetchOverview(), fetchLogs()]);
    } finally {
      setManualScanning(false);
    }
  };

  const handleResetBaselineNow = async () => {
    const confirmed = window.confirm(
      "Reset seluruh log lokal PM Health dan mulai pemantauan bersih mulai DARI SEKARANG ke depan?\n\n" +
        "• Anomali lama sebelum jam ini tidak akan masuk lagi ke log maupun memicu notifikasi.\n" +
        "• Database SCADA 100% aman (read-only, tidak berubah sama sekali)."
    );
    if (!confirmed) return;

    setResettingBaseline(true);
    try {
      const json = await postJson<{ resetAt: string | null }>("/pm-health/monitor/reset-baseline", {});
      setResetAt(json.resetAt ?? null);
      setWindowMode("since_reset");
      setToasts([]);
      setStatusFilter("all");
      await Promise.all([fetchHealth(), fetchOverview("since_reset"), fetchLogs()]);
    } finally {
      setResettingBaseline(false);
    }
  };

  const handleClearBaseline = async () => {
    setResettingBaseline(true);
    try {
      await deleteJson("/pm-health/monitor/reset-baseline");
      setResetAt(null);
      setWindowMode("hours");
      await Promise.all([fetchHealth(), fetchOverview("hours"), fetchLogs()]);
    } finally {
      setResettingBaseline(false);
    }
  };

  const handleAuditScan = async () => {
    setAuditRunning(true);
    try {
      const json = await postJson<{
        scannedAt: string;
        minuteRowsScanned: number;
        hourlyRowsScanned: number;
        detectedCount: number;
        newlyLoggedCount: number;
        anomalies: AnomalyEvent[];
      }>("/pm-health/scan", {
        startDate: auditStartDate,
        endDate: auditEndDate,
        source: auditSource,
        pmId: auditPmId,
        saveBeforeReset: auditSaveBeforeReset
      });
      setAuditResult(json);
      await fetchLogs();
    } finally {
      setAuditRunning(false);
    }
  };

  const handleAckLog = async (id: string) => {
    await postJson(`/pm-health/logs/${encodeURIComponent(id)}/ack`, {});
    await fetchLogs();
  };

  const handleAckAll = async () => {
    await postJson("/pm-health/logs/ack-all", {});
    await fetchLogs();
  };

  const handleMarkAllRead = async () => {
    await postJson("/pm-health/logs/read-all", {});
    setUnreadCount(0);
    await fetchLogs();
  };

  const checklistMapRef = useRef(checklistMap);
  checklistMapRef.current = checklistMap;

  const handleUpdateChecklist = useCallback(async (pmId: string, patch: PmChecklistPatch) => {
    const key = pmId.trim().toUpperCase();
    const previous = checklistMapRef.current[key];
    const base = previous ?? getEmptyChecklistItem(key);
    const optimistic: PmChecklistItem = {
      ...base,
      ewonChecked: typeof patch.ewonChecked === "boolean" ? patch.ewonChecked : base.ewonChecked,
      endpointChecked: typeof patch.endpointChecked === "boolean" ? patch.endpointChecked : base.endpointChecked,
      panelLcdChecked: typeof patch.panelLcdChecked === "boolean" ? patch.panelLcdChecked : base.panelLcdChecked,
      notes: typeof patch.notes === "string" ? patch.notes : base.notes
    };

    setChecklistError(null);
    setChecklistMap((prev) => ({ ...prev, [key]: optimistic }));
    setSavingChecklistPmIds((prev) => ({ ...prev, [key]: true }));
    try {
      const json = await patchJson<{ ok: boolean; item: PmChecklistItem }>(
        `/pm-health/checklist/${encodeURIComponent(key)}`,
        patch
      );
      if (json?.item) {
        setChecklistMap((prev) => ({ ...prev, [key]: json.item }));
      }
    } catch (err: any) {
      // Rollback on failure
      setChecklistMap((prev) => {
        const next = { ...prev };
        if (previous) next[key] = previous;
        else delete next[key];
        return next;
      });
      setChecklistError(err?.message || `Gagal menyimpan checklist untuk ${key}`);
    } finally {
      setSavingChecklistPmIds((prev) => {
        const next = { ...prev };
        delete next[key];
        return next;
      });
    }
  }, []);

  const handleResetChecklistSingle = useCallback(async (pmId: string) => {
    const key = pmId.trim().toUpperCase();
    const previous = checklistMapRef.current[key];
    setChecklistError(null);
    setChecklistMap((prev) => ({ ...prev, [key]: getEmptyChecklistItem(key) }));
    setSavingChecklistPmIds((prev) => ({ ...prev, [key]: true }));
    try {
      const json = await deleteJson<{ ok: boolean; item?: PmChecklistItem }>(
        `/pm-health/checklist/${encodeURIComponent(key)}`
      );
      setChecklistMap((prev) => ({ ...prev, [key]: json?.item ?? getEmptyChecklistItem(key) }));
    } catch (err: any) {
      if (previous) {
        setChecklistMap((prev) => ({ ...prev, [key]: previous }));
      }
      setChecklistError(err?.message || `Gagal mereset checklist ${key}`);
    } finally {
      setSavingChecklistPmIds((prev) => {
        const next = { ...prev };
        delete next[key];
        return next;
      });
    }
  }, []);

  const handleResetChecklistAll = useCallback(async () => {
    const previous = checklistMapRef.current;
    setChecklistError(null);
    setChecklistMap({});
    try {
      await deleteJson("/pm-health/checklist");
    } catch (err: any) {
      setChecklistMap(previous);
      setChecklistError(err?.message || "Gagal mereset seluruh checklist");
    }
  }, []);

  const checklistSummary = useMemo(() => {
    const ids = new Set<string>();
    for (const c of checklistCatalog) ids.add(c.pmId.toUpperCase());
    for (const pm of overview?.pms || []) ids.add(pm.pmId.toUpperCase());
    let complete = 0;
    for (const id of ids) {
      if (getChecklistProgress(checklistMap[id]).isComplete) complete++;
    }
    return { complete, total: ids.size };
  }, [checklistCatalog, overview?.pms, checklistMap]);

  const handleExportCsv = () => {
    const headers = [
      "Tanggal",
      "Waktu (WIB)",
      "PM ID",
      "Nama Peralatan",
      "Factory",
      "Area",
      "Sumber Tabel",
      "Jenis Anomali",
      "Waktu Sebelumnya",
      "Active Energy Sebelum (kWh)",
      "Active Energy Sesudah (kWh)",
      "Selisih (kWh)",
      "Daya Aktif (kW)",
      "Status Ack",
      "Keterangan"
    ];
    const escapeCsv = (val: unknown) => {
      const s = String(val ?? "");
      return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const rows = logs.map((l) => [
      l.date,
      l.time,
      l.pmId,
      l.pmName,
      l.factory,
      l.area,
      l.sourceTable,
      anomalyTypeMeta(l.type).label,
      l.prevTimestamp,
      l.prevEnergy,
      l.currEnergy,
      l.deltaEnergy,
      l.activePower ?? "",
      l.acknowledged ? "Selesai" : "Aktif",
      l.message
    ]);
    const csv = [headers, ...rows].map((r) => r.map(escapeCsv).join(",")).join("\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `pm-anomaly-logs_${getLocalTodayIso()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const filteredPms = useMemo(() => {
    const list = overview?.pms || [];
    const tokens = pmSearch
      .trim()
      .toLowerCase()
      .replace(/[-_/]+/g, " ")
      .split(/\s+/)
      .filter(Boolean);

    return list.filter((pm) => {
      if (statusFilter !== "all" && pm.healthStatus !== statusFilter) return false;
      if (factoryFilter !== "all" && pm.factory !== factoryFilter) return false;
      if (tokens.length > 0) {
        const hay = `${pm.pmId} ${pm.pmId.replace("PM", "PM ")} ${pm.pmName} ${pm.factory} ${pm.area} ${pm.statusReason}`.toLowerCase();
        const clean = hay.replace(/[-_/]+/g, " ");
        if (!tokens.every((tok) => hay.includes(tok) || clean.includes(tok))) return false;
      }
      return true;
    });
  }, [overview, statusFilter, factoryFilter, pmSearch]);

  // Strict Admin & Senior Unit Head View Guard
  if (!isAdmin) {
    return (
      <div className="space-y-5">
        <PageHeader
          title="PM Health Monitoring"
          description="Diagnostik kesehatan Active Energy Power Meter (Khusus Administrator & Senior Unit Head)"
        />
        <div className="rounded-2xl border border-rose-500/30 bg-white dark:bg-slate-900 p-8 text-center shadow-sm max-w-lg mx-auto">
          <div className="w-12 h-12 rounded-2xl bg-rose-500/15 text-rose-600 dark:text-rose-400 flex items-center justify-center mx-auto mb-3">
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
            </svg>
          </div>
          <h2 className="text-base font-extrabold text-slate-900 dark:text-white">
            Akses Terbatas (Admin &amp; Senior Unit Head)
          </h2>
          <p className="mt-1.5 text-xs text-slate-500 dark:text-slate-400">
            Halaman PM Health Monitoring hanya dapat diakses oleh akun dengan peran <strong>Administrator</strong> atau{" "}
            <strong>Senior Unit Head</strong>.
          </p>
        </div>
      </div>
    );
  }

  const summary = overview?.summary;
  const isViewingSinceReset = Boolean(windowMode === "since_reset" && resetAt);
  const latestScanTimestamp = (() => {
    const a = overview?.scannedAt || "";
    const b = health?.monitor.lastPollAt || "";
    if (a && b) return a >= b ? a : b;
    return a || b || null;
  })();

  return (
    <div className="space-y-5">
      {/* Header + Action Controls */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <PageHeader
          title="PM Health Monitor"
          description="Deteksi anomali & fluktuasi naik-turun Active Energy Power Meter (Read-Only DB)"
        />

        <div className="flex flex-wrap items-center gap-2 pt-1">
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border border-emerald-500/25 text-[11px] font-bold">
            <span className={`w-2 h-2 rounded-full ${health?.ok || overview ? "bg-emerald-500 animate-pulse" : "bg-rose-500"}`} />
            <span>Read-Only DB</span>
            {latestScanTimestamp && (
              <span className="font-mono text-emerald-600/80 dark:text-emerald-300/80">
                • {latestScanTimestamp.slice(11)}
              </span>
            )}
          </span>

          <button
            type="button"
            onClick={() => setAutoRefreshEnabled((prev) => !prev)}
            title={
              autoRefreshEnabled
                ? "Auto-refresh aktif setiap 15 detik — klik untuk menjeda"
                : "Auto-refresh dijeda — klik untuk mengaktifkan kembali"
            }
            className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border text-[11px] font-bold transition cursor-pointer ${
              autoRefreshEnabled
                ? "bg-sky-500/10 text-sky-700 dark:text-sky-300 border-sky-500/30 hover:bg-sky-500/20"
                : "bg-white dark:bg-slate-800 text-slate-500 dark:text-slate-400 border-slate-200 dark:border-slate-700 hover:border-sky-400"
            }`}
          >
            <span
              className={`w-2 h-2 rounded-full ${
                autoRefreshEnabled ? "bg-sky-500 animate-pulse" : "bg-slate-400"
              }`}
            />
            <span>{autoRefreshEnabled ? "Auto 15d" : "Auto: Jeda"}</span>
          </button>

          <button
            type="button"
            onClick={() => void handleResetBaselineNow()}
            disabled={resettingBaseline}
            title="Reset log lokal & mulai pantau anomali baru sejak jam sekarang ke depan"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-500 hover:bg-emerald-600 disabled:opacity-50 text-white text-xs font-bold shadow-sm shadow-emerald-500/20 transition cursor-pointer"
          >
            <svg className={`w-3.5 h-3.5 ${resettingBaseline ? "animate-spin" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99" />
            </svg>
            <span>Pantau Mulai Sekarang</span>
          </button>

          <button
            type="button"
            onClick={() => void handleManualScanNow()}
            disabled={manualScanning || overviewLoading}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-sky-500 hover:bg-sky-600 disabled:opacity-50 text-white text-xs font-bold shadow-sm shadow-sky-500/20 transition cursor-pointer"
          >
            <svg className={`w-3.5 h-3.5 ${manualScanning || overviewLoading ? "animate-spin" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            <span>Scan</span>
          </button>

          {/* Toggle Enable/Disable Live Popup Notifications */}
          <button
            type="button"
            onClick={() => setNotificationsEnabled((prev) => !prev)}
            title={
              notificationsEnabled
                ? "Notifikasi pop-up aktif — klik untuk menonaktifkan agar tidak mengganggu"
                : "Notifikasi pop-up dinonaktifkan — klik untuk mengaktifkan kembali"
            }
            className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border text-[11px] font-bold transition cursor-pointer ${
              notificationsEnabled
                ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-500/20"
                : "border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-400 hover:border-slate-300 dark:hover:border-slate-600"
            }`}
          >
            {notificationsEnabled ? (
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.1">
                <path strokeLinecap="round" strokeLinejoin="round" d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75v-.7V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0" />
              </svg>
            ) : (
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.1">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9.143 17.082a24.248 24.248 0 003.844.148m-3.844-.148a23.856 23.856 0 01-5.455-1.31 8.964 8.964 0 002.3-5.542m3.155 6.852a3 3 0 005.667 1.97m1.965-2.277L21 21m-4.225-4.225a23.81 23.81 0 003.536-1.003A8.967 8.967 0 0118 9.75V9A6 6 0 006.53 6.53m10.245 10.245L6.53 6.53M3 3l3.53 3.53" />
              </svg>
            )}
            <span>{notificationsEnabled ? "Notif: On" : "Notif: Off"}</span>
          </button>

          <button
            type="button"
            onClick={() => setSoundEnabled((prev) => !prev)}
            title={soundEnabled ? "Matikan suara notifikasi" : "Aktifkan suara notifikasi"}
            className={`p-2 rounded-xl border text-xs transition cursor-pointer ${
              soundEnabled
                ? "border-sky-500/30 bg-sky-500/10 text-sky-600 dark:text-sky-400"
                : "border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-400"
            }`}
          >
            {soundEnabled ? (
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M19.114 5.636a9 9 0 010 12.728M16.463 8.288a5.25 5.25 0 010 7.424M6.75 8.25l4.72-4.72a.75.75 0 011.28.53v15.88a.75.75 0 01-1.28.53l-4.72-4.72H4.51c-.88 0-1.704-.507-1.938-1.354A9.01 9.01 0 012.25 12c0-.83.112-1.633.322-2.396C2.806 8.756 3.63 8.25 4.51 8.25H6.75z" />
              </svg>
            ) : (
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M17.25 9.75L19.5 12m0 0l2.25 2.25M19.5 12l2.25-2.25M19.5 12l-2.25 2.25m-10.5-6l4.72-4.72a.75.75 0 011.28.531V19.94a.75.75 0 01-1.28.53l-4.72-4.72H4.51c-.88 0-1.704-.506-1.938-1.354A9.01 9.01 0 012.25 12c0-.83.112-1.633.322-2.395C2.806 8.757 3.63 8.25 4.51 8.25H6.75z" />
              </svg>
            )}
          </button>

          {/* Notification Bell */}
          <div ref={bellRef} className="relative">
            <button
              type="button"
              onClick={() => {
                const next = !bellOpen;
                setBellOpen(next);
                if (next && unreadCount > 0) {
                  void handleMarkAllRead();
                }
              }}
              className="relative p-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:border-sky-400 transition cursor-pointer"
              aria-label="Notifikasi Anomali PM"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75v-.7V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0" />
              </svg>
              {unreadCount > 0 && (
                <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-rose-500 text-white text-[10px] font-extrabold flex items-center justify-center shadow">
                  {unreadCount > 99 ? "99+" : unreadCount}
                </span>
              )}
            </button>

            {bellOpen && (
              <div className="absolute right-0 mt-2 w-[340px] max-w-[calc(100vw-2rem)] rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-2xl overflow-hidden z-40">
                <div className="px-4 py-3 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
                  <span className="text-xs font-extrabold text-slate-800 dark:text-white">
                    Notifikasi Terbaru ({logsTotal})
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      setBellOpen(false);
                      setActiveTab("logs");
                    }}
                    className="text-[11px] font-bold text-sky-600 dark:text-sky-400 hover:underline cursor-pointer"
                  >
                    Lihat Semua Log
                  </button>
                </div>
                <div className="px-4 py-2.5 border-b border-slate-100 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/40 flex items-center justify-between gap-2">
                  <span className="text-[11px] font-semibold text-slate-600 dark:text-slate-300">
                    Pop-up Notifikasi Live
                  </span>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={notificationsEnabled}
                    onClick={() => setNotificationsEnabled((prev) => !prev)}
                    className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors cursor-pointer ${
                      notificationsEnabled ? "bg-emerald-500" : "bg-slate-300 dark:bg-slate-600"
                    }`}
                  >
                    <span
                      className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform ${
                        notificationsEnabled ? "translate-x-[18px]" : "translate-x-[3px]"
                      }`}
                    />
                  </button>
                </div>
                <div className="max-h-80 overflow-y-auto scrollbar-thin divide-y divide-slate-100 dark:divide-slate-800">
                  {logs.length === 0 ? (
                    <div className="px-4 py-8 text-center text-xs text-slate-400">
                      {resetAt
                        ? `Belum ada anomali baru sejak reset (${resetAt.slice(11)} WIB).`
                        : "Belum ada anomali tercatat."}
                    </div>
                  ) : (
                    logs.slice(0, 12).map((ev) => (
                      <button
                        key={ev.id}
                        type="button"
                        onClick={() => {
                          setBellOpen(false);
                          setSelectedPmId(ev.pmId);
                        }}
                        className="w-full text-left px-4 py-3 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition cursor-pointer"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-mono text-xs font-extrabold text-rose-600 dark:text-rose-400">
                            {ev.pmId} • {anomalyTypeMeta(ev.type).shortLabel}
                          </span>
                          <span className="font-mono text-[10px] text-slate-400">
                            {ev.date.slice(5)} {ev.time}
                          </span>
                        </div>
                        <p className="mt-0.5 text-[11px] font-semibold text-slate-700 dark:text-slate-300 truncate">
                          {ev.pmName} ({ev.area})
                        </p>
                        <p className="mt-0.5 text-[11px] font-mono text-slate-500">
                          {fmtNumber(ev.prevEnergy, 2)} → {fmtNumber(ev.currEnergy, 2)} kWh ({fmtDelta(ev.deltaEnergy)})
                        </p>
                      </button>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {overviewError && (
        <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-xs font-semibold text-rose-700 dark:text-rose-300 flex flex-wrap items-center justify-between gap-3">
          <span>Gagal membaca database SCADA: {overviewError}</span>
          <button
            type="button"
            onClick={() => void fetchOverview()}
            className="px-3 py-1 rounded-lg bg-rose-600 text-white font-bold cursor-pointer"
          >
            Coba Lagi
          </button>
        </div>
      )}

      {/* ── Active "Pantau Mulai Sekarang" Baseline Banner ── */}
      {resetAt && (
        <div
          className={`rounded-2xl border px-4 py-3 flex flex-wrap items-center justify-between gap-3 shadow-sm ${
            isViewingSinceReset && summary && summary.criticalCount > 0
              ? "border-rose-500/35 bg-rose-500/[0.07]"
              : "border-emerald-500/30 bg-emerald-500/[0.07]"
          }`}
        >
          <div className="flex items-start sm:items-center gap-3 min-w-0">
            <div
              className={`p-2 rounded-xl flex-shrink-0 ${
                isViewingSinceReset && summary && summary.criticalCount > 0
                  ? "bg-rose-500/15 text-rose-600 dark:text-rose-400"
                  : "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"
              }`}
            >
              {isViewingSinceReset && summary && summary.criticalCount > 0 ? (
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
                </svg>
              ) : (
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              )}
            </div>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2 text-xs font-extrabold text-slate-900 dark:text-white">
                <span>Mode Pantau Mulai Sekarang Aktif</span>
                <span className="px-2 py-0.5 rounded-md bg-white/80 dark:bg-slate-900/80 border border-slate-200 dark:border-slate-700 font-mono text-[11px]">
                  Sejak {resetAt} WIB
                </span>
              </div>
              <p className="mt-0.5 text-[11px] font-semibold text-slate-600 dark:text-slate-300">
                {isViewingSinceReset && summary
                  ? summary.criticalCount === 0 && summary.warningCount === 0
                    ? `Semua PM terpantau sehat sejak ${resetAt.slice(11)} WIB — belum ada anomali naik-turun baru. ${
                        autoRefreshEnabled
                          ? "Auto-refresh realtime aktif setiap 15 detik."
                          : "Auto-refresh sedang dijeda."
                      }`
                    : `Terdeteksi ${summary.criticalCount} PM bermasalah (${summary.totalDropsInWindow}x drop/rollover) sejak ${resetAt.slice(11)} WIB.`
                  : `Log & notifikasi live hanya mencatat anomali baru setelah ${resetAt} WIB.`}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {!isViewingSinceReset && (
              <button
                type="button"
                onClick={() => {
                  setActiveTab("overview");
                  setWindowMode("since_reset");
                }}
                className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-bold cursor-pointer"
              >
                Lihat Status Sejak Reset
              </button>
            )}
            <button
              type="button"
              onClick={() => void handleResetBaselineNow()}
              disabled={resettingBaseline}
              className="px-2.5 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 hover:border-sky-400 text-[11px] font-bold text-slate-700 dark:text-slate-200 cursor-pointer"
            >
              ↺ Reset Ulang
            </button>
            <button
              type="button"
              onClick={() => void handleClearBaseline()}
              disabled={resettingBaseline}
              className="px-2.5 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 hover:border-rose-400 hover:text-rose-600 text-[11px] font-bold text-slate-500 dark:text-slate-400 cursor-pointer"
            >
              ✕ Matikan Batas
            </button>
          </div>
        </div>
      )}

      {/* ── 4 Summary KPI Cards ── */}
      <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
        <button
          type="button"
          onClick={() => {
            setActiveTab("overview");
            setStatusFilter("all");
          }}
          className={`text-left rounded-2xl border p-4 bg-white dark:bg-slate-900 shadow-sm transition hover:border-sky-400 cursor-pointer ${
            statusFilter === "all" && activeTab === "overview"
              ? "border-sky-500/60 ring-2 ring-sky-500/10"
              : "border-slate-200 dark:border-slate-800"
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 dark:text-slate-400">Total Power Meter</span>
            <span className="text-sky-500 text-sm font-bold">⚡</span>
          </div>
          <div className="mt-2 text-2xl font-extrabold font-mono text-slate-900 dark:text-white">
            {summary?.totalPms ?? "—"}
          </div>
          <p className="mt-1 text-[11px] text-slate-400">
            {summary
              ? `${summary.minuteRowsScanned.toLocaleString("id-ID")} baris menit • ${summary.hourlyRowsScanned.toLocaleString("id-ID")} baris jam`
              : "Memuat sampel..."}
          </p>
        </button>

        <button
          type="button"
          onClick={() => {
            setActiveTab("overview");
            setStatusFilter("healthy");
          }}
          className={`text-left rounded-2xl border p-4 bg-white dark:bg-slate-900 shadow-sm transition hover:border-emerald-400 cursor-pointer ${
            statusFilter === "healthy" && activeTab === "overview"
              ? "border-emerald-500/60 ring-2 ring-emerald-500/10"
              : "border-slate-200 dark:border-slate-800"
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 dark:text-slate-400">PM Sehat</span>
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
          </div>
          <div className="mt-2 text-2xl font-extrabold font-mono text-emerald-600 dark:text-emerald-400">
            {summary?.healthyCount ?? "—"}
          </div>
          <p className="mt-1 text-[11px] text-slate-400">
            {isViewingSinceReset
              ? `Aman tanpa anomali sejak ${resetAt?.slice(11)}`
              : "Akumulasi Active Energy naik stabil"}
          </p>
        </button>

        <button
          type="button"
          onClick={() => {
            setActiveTab("overview");
            setStatusFilter("critical");
          }}
          className={`text-left rounded-2xl border p-4 bg-white dark:bg-slate-900 shadow-sm transition hover:border-rose-400 cursor-pointer ${
            statusFilter === "critical" && activeTab === "overview"
              ? "border-rose-500/60 ring-2 ring-rose-500/10"
              : "border-slate-200 dark:border-slate-800"
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 dark:text-slate-400">PM Bermasalah (Naik-Turun)</span>
            <span className="w-2.5 h-2.5 rounded-full bg-rose-500" />
          </div>
          <div className="mt-2 text-2xl font-extrabold font-mono text-rose-600 dark:text-rose-400">
            {summary?.criticalCount ?? "—"}
          </div>
          <p className="mt-1 text-[11px] text-slate-400">
            {summary
              ? `${summary.totalDropsInWindow}x drop / rollover ${isViewingSinceReset ? "sejak reset" : "pada rentang ini"}`
              : "Mendeteksi penurunan kWh..."}
          </p>
        </button>

        <button
          type="button"
          onClick={() => {
            setActiveTab("overview");
            setStatusFilter("offline");
          }}
          className={`text-left rounded-2xl border p-4 bg-white dark:bg-slate-900 shadow-sm transition hover:border-amber-400 cursor-pointer ${
            (statusFilter === "offline" || statusFilter === "warning") && activeTab === "overview"
              ? "border-amber-500/60 ring-2 ring-amber-500/10"
              : "border-slate-200 dark:border-slate-800"
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 dark:text-slate-400">Offline / Peringatan</span>
            <span className="w-2.5 h-2.5 rounded-full bg-amber-500" />
          </div>
          <div className="mt-2 text-2xl font-extrabold font-mono text-amber-600 dark:text-amber-400">
            {summary ? summary.offlineCount + summary.warningCount : "—"}
          </div>
          <p className="mt-1 text-[11px] text-slate-400">
            {summary
              ? `${summary.warningCount} peringatan • ${summary.offlineCount} offline / data berhenti`
              : "Memeriksa status..."}
          </p>
        </button>
      </section>

      {/* ── Navigation Tabs ── */}
      <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-thin whitespace-nowrap py-1">
        <button
          type="button"
          onClick={() => setActiveTab("overview")}
          className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-extrabold transition cursor-pointer ${
            activeTab === "overview"
              ? "bg-sky-600 dark:bg-sky-500 text-white shadow-sm shadow-sky-500/20"
              : "bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-800 hover:border-sky-400"
          }`}
        >
          <span>Status Power Meter</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("checklist")}
          className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-extrabold transition cursor-pointer ${
            activeTab === "checklist"
              ? "bg-sky-600 dark:bg-sky-500 text-white shadow-sm shadow-sky-500/20"
              : "bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-800 hover:border-sky-400"
          }`}
        >
          <span>Checklist Verifikasi PM</span>
          {checklistSummary.total > 0 && (
            <span
              className={`px-1.5 py-0.5 rounded-full text-[10px] font-mono ${
                checklistSummary.complete === checklistSummary.total
                  ? "bg-emerald-500 text-white"
                  : activeTab === "checklist"
                  ? "bg-white/20 text-white"
                  : "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300"
              }`}
            >
              {checklistSummary.complete}/{checklistSummary.total}
            </span>
          )}
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("logs")}
          className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-extrabold transition cursor-pointer ${
            activeTab === "logs"
              ? "bg-sky-600 dark:bg-sky-500 text-white shadow-sm shadow-sky-500/20"
              : "bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-800 hover:border-sky-400"
          }`}
        >
          <span>Log Anomali &amp; Naik-Turun</span>
          {unackedCount > 0 && (
            <span className="px-1.5 py-0.5 rounded-full bg-rose-500 text-white text-[10px] font-mono">
              {unackedCount}
            </span>
          )}
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("audit")}
          className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-extrabold transition cursor-pointer ${
            activeTab === "audit"
              ? "bg-sky-600 dark:bg-sky-500 text-white shadow-sm shadow-sky-500/20"
              : "bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-800 hover:border-sky-400"
          }`}
        >
          <span>Audit Historis</span>
        </button>
      </div>

      {checklistError && (
        <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-2.5 text-xs font-semibold text-rose-700 dark:text-rose-300 flex flex-wrap items-center justify-between gap-2">
          <span>Checklist: {checklistError}</span>
          <button
            type="button"
            onClick={() => setChecklistError(null)}
            className="text-[11px] font-bold underline cursor-pointer"
          >
            Tutup
          </button>
        </div>
      )}

      {/* ══════════════════ TAB 1: PM HEALTH OVERVIEW ══════════════════ */}
      {activeTab === "overview" && (
        <section className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm overflow-hidden">
          <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2 flex-1 min-w-[220px]">
              <div className="relative w-full sm:w-[270px]">
                <svg className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35M17 11a6 6 0 11-12 0 6 6 0 0112 0z" />
                </svg>
                <input
                  type="text"
                  value={pmSearch}
                  onChange={(e) => setPmSearch(e.target.value)}
                  placeholder="Cari PM, nama alat, atau area..."
                  className="w-full pl-8 pr-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-xs font-semibold text-slate-800 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-sky-500/30"
                />
              </div>

              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as any)}
                className="px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-bold text-slate-700 dark:text-slate-200"
              >
                <option value="all">Semua Status</option>
                <option value="critical">Bermasalah (Naik-Turun)</option>
                <option value="warning">Peringatan (Spike / Stuck)</option>
                <option value="healthy">Sehat</option>
                <option value="offline">Offline</option>
              </select>

              <select
                value={factoryFilter}
                onChange={(e) => setFactoryFilter(e.target.value)}
                className="px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-bold text-slate-700 dark:text-slate-200"
              >
                <option value="all">Semua Factory</option>
                <option value="Factory 1">Factory 1</option>
                <option value="Factory 2">Factory 2</option>
                <option value="Incoming PLN">Incoming PLN</option>
              </select>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <select
                value={windowMode === "since_reset" && resetAt ? "since_reset" : String(windowHours)}
                onChange={(e) => {
                  if (e.target.value === "since_reset") {
                    setWindowMode("since_reset");
                  } else {
                    setWindowMode("hours");
                    setWindowHours(Number(e.target.value));
                  }
                }}
                className="px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-bold text-slate-700 dark:text-slate-200"
              >
                {resetAt && <option value="since_reset">Sejak Reset ({resetAt.slice(11)} WIB)</option>}
                <option value="6">6 Jam Terakhir</option>
                <option value="24">24 Jam Terakhir</option>
                <option value="72">3 Hari Terakhir</option>
                <option value="168">7 Hari Terakhir</option>
              </select>

              <select
                value={sourceFilter}
                onChange={(e) => setSourceFilter(e.target.value as any)}
                className="px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-bold text-slate-700 dark:text-slate-200"
              >
                <option value="both">Tabel: Menit + Jam</option>
                <option value="electric_pm_telemetry_minute">Hanya pm_telemetry_minute</option>
                <option value="electric_pm_telemetry">Hanya pm_telemetry (Jam)</option>
              </select>
            </div>
          </div>

          <div className="overflow-x-auto scrollbar-thin">
            <table className="w-full min-w-[1040px] text-left text-xs border-collapse">
              <thead className="bg-slate-50 dark:bg-slate-950/70 text-[10px] uppercase tracking-wider text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-slate-800">
                <tr>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Power Meter &amp; Area</th>
                  <th className="px-4 py-3">Tren Energi</th>
                  <th className="px-4 py-3 text-right">Active Energy (kWh)</th>
                  <th className="px-4 py-3 text-right">Daya (kW)</th>
                  <th className="px-4 py-3">Deteksi Anomali</th>
                  <th className="px-4 py-3">Verifikasi PM</th>
                  <th className="px-4 py-3">Update Terakhir</th>
                  <th className="px-4 py-3 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody translate="no" className="notranslate divide-y divide-slate-100 dark:divide-slate-800/80">
                {overviewLoading && !overview ? (
                  <tr>
                    <td colSpan={9} className="px-4 py-14 text-center text-slate-400 font-semibold">
                      Memindai electric_pm_telemetry &amp; electric_pm_telemetry_minute...
                    </td>
                  </tr>
                ) : filteredPms.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="px-4 py-14 text-center text-slate-400 font-semibold">
                      Tidak ada Power Meter yang cocok dengan filter.
                    </td>
                  </tr>
                ) : (
                  filteredPms.map((pm) => {
                    const sMeta = healthStatusMeta(pm.healthStatus);
                    const chk = checklistMap[pm.pmId.toUpperCase()] ?? getEmptyChecklistItem(pm.pmId.toUpperCase());
                    const chkSaving = Boolean(savingChecklistPmIds[pm.pmId.toUpperCase()]);
                    return (
                      <tr
                        key={pm.pmId}
                        onClick={() => setSelectedPmId(pm.pmId)}
                        className={`transition cursor-pointer ${
                          pm.healthStatus === "critical"
                            ? "bg-rose-500/[0.04] hover:bg-rose-500/[0.09]"
                            : "hover:bg-slate-50 dark:hover:bg-slate-800/40"
                        }`}
                      >
                        <td className="px-4 py-3 whitespace-nowrap">
                          <span
                            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-[11px] font-bold ${sMeta.badgeClass}`}
                          >
                            <span className={`w-1.5 h-1.5 rounded-full ${sMeta.dotClass}`} />
                            {sMeta.label}
                          </span>
                        </td>

                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <span className="px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 font-mono text-[11px] font-extrabold text-slate-800 dark:text-slate-100">
                              {pm.pmId}
                            </span>
                            <span className="font-bold text-slate-800 dark:text-slate-100">
                              {pm.pmName}
                            </span>
                          </div>
                          <div className="mt-0.5 text-[11px] text-slate-500 dark:text-slate-400">
                            {pm.factory} • {pm.area}
                          </div>
                        </td>

                        <td className="px-4 py-3">
                          <PmMiniSparkline points={pm.sparkline} status={pm.healthStatus} />
                        </td>

                        <td className="px-4 py-3 text-right font-mono whitespace-nowrap">
                          <div className="font-bold text-slate-900 dark:text-white">
                            {fmtNumber(pm.latestEnergy, 2)}
                          </div>
                          {pm.netDeltaEnergy !== null && (
                            <div
                              className={`text-[10px] font-semibold ${
                                pm.netDeltaEnergy < 0
                                  ? "text-rose-500"
                                  : "text-emerald-600 dark:text-emerald-400"
                              }`}
                            >
                              {fmtDelta(pm.netDeltaEnergy)}
                            </div>
                          )}
                        </td>

                        <td className="px-4 py-3 text-right font-mono text-slate-700 dark:text-slate-300 whitespace-nowrap">
                          {fmtNumber(pm.latestPowerKw, 1)}
                        </td>

                        <td className="px-4 py-3">
                          {pm.dropCount > 0 || pm.reboundCount > 0 ? (
                            <div>
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-rose-500/15 text-rose-700 dark:text-rose-300 font-mono text-[11px] font-extrabold">
                                {pm.dropCount}x Drop{pm.reboundCount > 0 ? ` • ${pm.reboundCount}x Rebound` : ""}
                              </span>
                              {pm.lastAnomalyAt && (
                                <div className="mt-0.5 text-[10px] font-mono text-slate-500">
                                  Terakhir: {pm.lastAnomalyAt}
                                </div>
                              )}
                            </div>
                          ) : pm.spikeCount > 0 || pm.stuckCount > 0 ? (
                            <span className="inline-flex px-2 py-0.5 rounded-md bg-amber-500/15 text-amber-700 dark:text-amber-300 font-semibold text-[11px]">
                              {pm.statusReason}
                            </span>
                          ) : (
                            <span className="text-[11px] text-slate-400">{pm.statusReason}</span>
                          )}
                        </td>

                        <td
                          className="px-4 py-3 whitespace-nowrap"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <div className="flex items-center gap-1">
                            {(
                              [
                                { key: "ewonChecked", short: "eWON", full: "Cek PM dengan eWON", val: chk.ewonChecked },
                                { key: "endpointChecked", short: "EP", full: "Cek PM dengan Endpoint", val: chk.endpointChecked },
                                { key: "panelLcdChecked", short: "LCD", full: "Cek PM dengan Panel LCD", val: chk.panelLcdChecked }
                              ] as const
                            ).map((chip) => (
                              <button
                                key={chip.key}
                                type="button"
                                disabled={chkSaving}
                                title={`${chip.full}: ${chip.val ? "Sudah sesuai" : "Belum dicek"} (klik untuk toggle)`}
                                onClick={() => void handleUpdateChecklist(pm.pmId, { [chip.key]: !chip.val })}
                                className={`px-1.5 py-0.5 rounded-md border font-mono text-[10px] font-bold transition cursor-pointer disabled:opacity-50 ${
                                  chip.val
                                    ? "bg-emerald-500/15 border-emerald-500/40 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-500/25"
                                    : "bg-slate-100/80 dark:bg-slate-800/80 border-slate-200 dark:border-slate-700 text-slate-400 hover:border-sky-400 hover:text-sky-600 dark:hover:text-sky-300"
                                }`}
                              >
                                {chip.val ? "✓ " : ""}
                                {chip.short}
                              </button>
                            ))}
                          </div>
                        </td>

                        <td className="px-4 py-3 font-mono text-[11px] text-slate-500 dark:text-slate-400 whitespace-nowrap">
                          <div>{pm.lastTimestamp || "—"}</div>
                          <div className="text-[10px] text-slate-400">{sourceTableShort(pm.latestSource)}</div>
                        </td>

                        <td className="px-4 py-3 text-right whitespace-nowrap">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedPmId(pm.pmId);
                            }}
                            className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:border-sky-400 hover:text-sky-600 dark:hover:text-sky-400 text-[11px] font-bold transition cursor-pointer"
                          >
                            Detail Grafik
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* ══════════════════ TAB 2: PM VERIFICATION CHECKLIST ══════════════════ */}
      {activeTab === "checklist" && (
        <PmChecklistPanel
          pms={overview?.pms || []}
          catalog={checklistCatalog}
          checklistMap={checklistMap}
          savingPmIds={savingChecklistPmIds}
          loading={checklistLoading}
          onUpdateChecklist={handleUpdateChecklist}
          onResetSingle={handleResetChecklistSingle}
          onResetAll={handleResetChecklistAll}
          onInspectPm={(pmId) => setSelectedPmId(pmId)}
        />
      )}

      {/* ══════════════════ TAB 2: ANOMALY LOGS ══════════════════ */}
      {activeTab === "logs" && (
        <section className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm overflow-hidden">
          <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2">
              <div className="relative w-full sm:w-[240px]">
                <svg className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35M17 11a6 6 0 11-12 0 6 6 0 0112 0z" />
                </svg>
                <input
                  type="text"
                  value={logSearch}
                  onChange={(e) => setLogSearch(e.target.value)}
                  placeholder="Cari PM / Area / Keterangan..."
                  className="w-full pl-8 pr-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-xs font-semibold text-slate-800 dark:text-slate-100"
                />
              </div>

              <select
                value={logTypeFilter}
                onChange={(e) => setLogTypeFilter(e.target.value as any)}
                className="px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-bold text-slate-700 dark:text-slate-200"
              >
                <option value="all">Semua Jenis</option>
                <option value="ENERGY_DECREASE">Energi Turun / Mundur</option>
                <option value="ROLLOVER_16BIT">Rollover 16-bit (65.535)</option>
                <option value="DROP_TO_ZERO">Drop ke 0</option>
                <option value="REBOUND_AFTER_DROP">Rebound Naik-Turun</option>
                <option value="NEGATIVE_ENERGY">Nilai Negatif</option>
                <option value="ENERGY_SPIKE">Lonjakan Ekstrem</option>
                <option value="ENERGY_STUCK">Energi Stuck</option>
              </select>

              <select
                value={logSourceFilter}
                onChange={(e) => setLogSourceFilter(e.target.value as any)}
                className="px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-bold text-slate-700 dark:text-slate-200"
              >
                <option value="both">Semua Tabel</option>
                <option value="electric_pm_telemetry_minute">pm_telemetry_minute</option>
                <option value="electric_pm_telemetry">pm_telemetry</option>
              </select>

              <select
                value={logAckFilter}
                onChange={(e) => setLogAckFilter(e.target.value as any)}
                className="px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-bold text-slate-700 dark:text-slate-200"
              >
                <option value="all">Semua Status</option>
                <option value="open">Belum Ditandai</option>
                <option value="acked">Sudah Ditandai</option>
              </select>

              <input
                type="date"
                value={logStartDate}
                onChange={(e) => setLogStartDate(e.target.value)}
                className="px-2.5 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-semibold text-slate-700 dark:text-slate-200"
              />
              <input
                type="date"
                value={logEndDate}
                onChange={(e) => setLogEndDate(e.target.value)}
                className="px-2.5 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-semibold text-slate-700 dark:text-slate-200"
              />
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={handleExportCsv}
                disabled={logs.length === 0}
                className="px-3 py-1.5 rounded-xl bg-emerald-500 hover:bg-emerald-600 disabled:opacity-40 text-white text-xs font-bold cursor-pointer"
              >
                Export CSV
              </button>
              <button
                type="button"
                onClick={() => void handleAckAll()}
                disabled={unackedCount === 0}
                className="px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:border-sky-400 disabled:opacity-40 text-xs font-bold cursor-pointer"
              >
                Tandai Semua
              </button>
              <button
                type="button"
                onClick={() => void handleResetBaselineNow()}
                disabled={resettingBaseline}
                className="px-3 py-1.5 rounded-xl border border-rose-500/30 bg-rose-500/10 text-rose-600 dark:text-rose-400 hover:bg-rose-500/20 disabled:opacity-40 text-xs font-bold cursor-pointer"
              >
                Reset &amp; Pantau Mulai Sekarang
              </button>
            </div>
          </div>

          <div className="overflow-x-auto scrollbar-thin">
            <table className="w-full min-w-[960px] text-left text-xs border-collapse">
              <thead className="bg-slate-50 dark:bg-slate-950/70 text-[10px] uppercase tracking-wider text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-slate-800">
                <tr>
                  <th className="px-4 py-3">Tanggal</th>
                  <th className="px-4 py-3">Waktu (WIB)</th>
                  <th className="px-4 py-3">PM &amp; Area</th>
                  <th className="px-4 py-3">Tabel Sumber</th>
                  <th className="px-4 py-3">Jenis Anomali</th>
                  <th className="px-4 py-3 text-right">Sebelum → Sesudah (kWh)</th>
                  <th className="px-4 py-3 text-right">Selisih (Δ)</th>
                  <th className="px-4 py-3 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody translate="no" className="notranslate divide-y divide-slate-100 dark:divide-slate-800/80">
                {logsLoading ? (
                  <tr>
                    <td colSpan={8} className="px-4 py-12 text-center text-slate-400 font-semibold">
                      Memuat log anomali lokal...
                    </td>
                  </tr>
                ) : logs.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-4 py-12 text-center font-semibold">
                      {resetAt ? (
                        <span className="text-emerald-600 dark:text-emerald-400">
                          ✓ Belum ada anomali baru yang terdeteksi sejak reset ({resetAt} WIB).
                        </span>
                      ) : (
                        <span className="text-slate-400">Tidak ada log anomali untuk filter saat ini.</span>
                      )}
                    </td>
                  </tr>
                ) : (
                  logs.map((ev) => {
                    const meta = anomalyTypeMeta(ev.type);
                    return (
                      <tr
                        key={ev.id}
                        className={`transition ${
                          ev.acknowledged
                            ? "opacity-70 hover:opacity-100 hover:bg-slate-50 dark:hover:bg-slate-800/30"
                            : "hover:bg-rose-500/[0.06]"
                        }`}
                      >
                        <td className="px-4 py-3 font-mono font-bold text-slate-800 dark:text-slate-100 whitespace-nowrap">
                          {ev.date}
                        </td>
                        <td className="px-4 py-3 font-mono font-extrabold text-rose-600 dark:text-rose-400 whitespace-nowrap">
                          {ev.time}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <span className="px-1.5 py-0.5 rounded bg-sky-500/15 text-sky-700 dark:text-sky-300 font-mono text-[11px] font-extrabold">
                              {ev.pmId}
                            </span>
                            <span className="font-bold text-slate-800 dark:text-slate-100">
                              {ev.pmName}
                            </span>
                          </div>
                          <div className="mt-0.5 text-[11px] text-slate-500">
                            {ev.factory} • {ev.area}
                          </div>
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          <span className="px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 font-mono text-[10px] font-bold text-slate-600 dark:text-slate-300">
                            {sourceTableShort(ev.sourceTable)}
                          </span>
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          <span className={`inline-flex px-2 py-0.5 rounded-md border text-[11px] font-bold ${meta.badgeClass}`}>
                            {meta.shortLabel}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right font-mono whitespace-nowrap">
                          <span className="text-slate-500">{fmtNumber(ev.prevEnergy, 2)}</span>
                          <span className="mx-1.5 text-slate-400">→</span>
                          <span className="font-bold text-slate-900 dark:text-white">{fmtNumber(ev.currEnergy, 2)}</span>
                        </td>
                        <td
                          className={`px-4 py-3 text-right font-mono font-extrabold whitespace-nowrap ${
                            ev.deltaEnergy < 0
                              ? "text-rose-600 dark:text-rose-400"
                              : "text-amber-600 dark:text-amber-400"
                          }`}
                        >
                          {fmtDelta(ev.deltaEnergy)}
                        </td>
                        <td className="px-4 py-3 text-right whitespace-nowrap space-x-1.5">
                          <button
                            type="button"
                            onClick={() => setSelectedPmId(ev.pmId)}
                            className="px-2.5 py-1 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:border-sky-400 text-[11px] font-bold cursor-pointer"
                          >
                            Grafik
                          </button>
                          {!ev.acknowledged ? (
                            <button
                              type="button"
                              onClick={() => void handleAckLog(ev.id)}
                              className="px-2.5 py-1 rounded-lg bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30 hover:bg-emerald-500/25 text-[11px] font-bold cursor-pointer"
                            >
                              Selesai
                            </button>
                          ) : (
                            <span className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400">✓</span>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          <div className="px-4 py-2.5 border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/30 flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-400">
            <span>
              Menampilkan {logs.length} dari {logsTotal} log anomali lokal
              {resetAt ? ` (batas aktif: sejak ${resetAt} WIB)` : ""}
            </span>
            <span>Log disimpan lokal di server (tanpa menulis ke database SCADA)</span>
          </div>
        </section>
      )}

      {/* ══════════════════ TAB 3: HISTORICAL AUDIT SCAN ══════════════════ */}
      {activeTab === "audit" && (
        <section className="space-y-4">
          <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-sm">
            <h2 className="text-sm font-extrabold text-slate-900 dark:text-white">
              Audit Historis Active Energy Power Meter
            </h2>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              Pindai rentang tanggal tertentu secara langsung (read-only) dari tabel{" "}
              <code className="font-mono text-sky-600 dark:text-sky-400">electric_pm_telemetry</code> dan{" "}
              <code className="font-mono text-sky-600 dark:text-sky-400">electric_pm_telemetry_minute</code> untuk melihat
              riwayat kejadian nilai kWh naik-turun tanpa mengganggu batas pantau live.
            </p>

            <div className="mt-4 flex flex-wrap items-end gap-3">
              <div>
                <label className="block text-[11px] font-bold text-slate-500 mb-1">Tanggal Mulai</label>
                <input
                  type="date"
                  value={auditStartDate}
                  onChange={(e) => setAuditStartDate(e.target.value)}
                  className="px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-xs font-bold text-slate-800 dark:text-slate-100"
                />
              </div>
              <div>
                <label className="block text-[11px] font-bold text-slate-500 mb-1">Tanggal Akhir</label>
                <input
                  type="date"
                  value={auditEndDate}
                  onChange={(e) => setAuditEndDate(e.target.value)}
                  className="px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-xs font-bold text-slate-800 dark:text-slate-100"
                />
              </div>
              <div>
                <label className="block text-[11px] font-bold text-slate-500 mb-1">Sumber Tabel</label>
                <select
                  value={auditSource}
                  onChange={(e) => setAuditSource(e.target.value as any)}
                  className="px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-xs font-bold text-slate-800 dark:text-slate-100"
                >
                  <option value="both">Keduanya (Menit &amp; Jam)</option>
                  <option value="electric_pm_telemetry_minute">electric_pm_telemetry_minute</option>
                  <option value="electric_pm_telemetry">electric_pm_telemetry</option>
                </select>
              </div>
              <div>
                <label className="block text-[11px] font-bold text-slate-500 mb-1">Target PM</label>
                <select
                  value={auditPmId}
                  onChange={(e) => setAuditPmId(e.target.value)}
                  className="px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-xs font-bold text-slate-800 dark:text-slate-100"
                >
                  <option value="all">Semua Power Meter</option>
                  {(overview?.pms || []).map((pm) => (
                    <option key={pm.pmId} value={pm.pmId}>
                      {pm.pmId} — {pm.pmName}
                    </option>
                  ))}
                </select>
              </div>

              <button
                type="button"
                onClick={() => void handleAuditScan()}
                disabled={auditRunning}
                className="px-4 py-2 rounded-xl bg-sky-500 hover:bg-sky-600 disabled:opacity-50 text-white text-xs font-extrabold shadow-sm cursor-pointer"
              >
                {auditRunning ? "Memindai..." : "Mulai Pindai Database"}
              </button>
            </div>

            {resetAt && (
              <label className="mt-3 inline-flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={auditSaveBeforeReset}
                  onChange={(e) => setAuditSaveBeforeReset(e.target.checked)}
                  className="rounded border-slate-300 text-sky-500 focus:ring-sky-500"
                />
                <span>Simpan juga temuan sebelum waktu reset ({resetAt}) ke Log Lokal</span>
              </label>
            )}
          </div>

          {auditResult && (
            <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm overflow-hidden">
              <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h3 className="text-sm font-extrabold text-slate-900 dark:text-white">
                    Hasil Pindai ({auditResult.detectedCount} anomali ditemukan • {auditResult.newlyLoggedCount} dicatat ke log)
                  </h3>
                  <p className="text-[11px] text-slate-400 font-mono mt-0.5">
                    Dipindai: {auditResult.minuteRowsScanned.toLocaleString("id-ID")} baris menit &amp;{" "}
                    {auditResult.hourlyRowsScanned.toLocaleString("id-ID")} baris jam pada {auditResult.scannedAt} WIB
                  </p>
                </div>
              </div>

              {auditResult.anomalies.length === 0 ? (
                <div className="p-8 text-center text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                  Seluruh Power Meter pada rentang tanggal tersebut memiliki akumulasi active_energy yang konsisten naik.
                </div>
              ) : (
                <div className="overflow-x-auto scrollbar-thin">
                  <table className="w-full min-w-[820px] text-left text-xs border-collapse">
                    <thead className="bg-slate-50 dark:bg-slate-950/70 text-[10px] uppercase tracking-wider text-slate-500">
                      <tr>
                        <th className="px-4 py-2.5">Tanggal</th>
                        <th className="px-4 py-2.5">Waktu</th>
                        <th className="px-4 py-2.5">PM &amp; Area</th>
                        <th className="px-4 py-2.5">Sumber</th>
                        <th className="px-4 py-2.5">Jenis Masalah</th>
                        <th className="px-4 py-2.5 text-right">Sebelum → Sesudah (kWh)</th>
                        <th className="px-4 py-2.5 text-right">Selisih (Δ)</th>
                      </tr>
                    </thead>
                    <tbody translate="no" className="notranslate divide-y divide-slate-100 dark:divide-slate-800">
                      {auditResult.anomalies.map((ev) => {
                        const meta = anomalyTypeMeta(ev.type);
                        return (
                          <tr
                            key={ev.id}
                            onClick={() => setSelectedPmId(ev.pmId)}
                            className="hover:bg-rose-500/5 cursor-pointer"
                          >
                            <td className="px-4 py-2.5 font-mono font-bold">{ev.date}</td>
                            <td className="px-4 py-2.5 font-mono font-bold text-rose-600 dark:text-rose-400">
                              {ev.time}
                            </td>
                            <td className="px-4 py-2.5">
                              <span className="font-mono font-extrabold text-sky-600 dark:text-sky-400 mr-1.5">
                                {ev.pmId}
                              </span>
                              <span className="font-bold">{ev.pmName}</span>
                              <span className="text-slate-400 ml-1.5">({ev.area})</span>
                            </td>
                            <td className="px-4 py-2.5 font-mono text-[11px] text-slate-500">
                              {sourceTableShort(ev.sourceTable)}
                            </td>
                            <td className="px-4 py-2.5">
                              <span className={`inline-flex px-2 py-0.5 rounded-md border text-[11px] font-bold ${meta.badgeClass}`}>
                                {meta.shortLabel}
                              </span>
                            </td>
                            <td className="px-4 py-2.5 text-right font-mono">
                              {fmtNumber(ev.prevEnergy, 2)} → <strong>{fmtNumber(ev.currEnergy, 2)}</strong>
                            </td>
                            <td className="px-4 py-2.5 text-right font-mono font-extrabold text-rose-600 dark:text-rose-400">
                              {fmtDelta(ev.deltaEnergy)}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </section>
      )}

      {/* Detail Chart Modal */}
      <PmHealthDetailModal
        pmId={selectedPmId}
        initialHours={windowHours}
        initialSinceReset={isViewingSinceReset}
        resetAt={resetAt}
        isDark={isDark}
        checklist={
          selectedPmId
            ? checklistMap[selectedPmId.toUpperCase()] ?? getEmptyChecklistItem(selectedPmId.toUpperCase())
            : undefined
        }
        checklistSaving={selectedPmId ? Boolean(savingChecklistPmIds[selectedPmId.toUpperCase()]) : false}
        onUpdateChecklist={handleUpdateChecklist}
        onClose={() => setSelectedPmId(null)}
      />

      {/* Live Anomaly Toasts */}
      <PmAnomalyToastStack
        toasts={notificationsEnabled ? toasts : []}
        onDismiss={(id) => setToasts((prev) => prev.filter((t) => t.id !== id))}
        onDismissAll={() => setToasts([])}
        onDisableNotifications={() => setNotificationsEnabled(false)}
        onInspectPm={(pmId) => setSelectedPmId(pmId)}
      />
    </div>
  );
}
