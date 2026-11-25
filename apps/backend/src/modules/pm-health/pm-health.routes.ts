import { Router, type NextFunction, type Request, type Response } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { authenticate, authorize } from "../auth/auth.middleware";
import { env } from "../../config/env.config";
import { logger } from "../../config/logger.config";
import { getPostgresPool } from "../../database/postgres";
import { fetchLivePmEndpointSnapshot, type ElectricPmRecord } from "../../core/scheduler";
import {
  fetchLatestFullPmParams,
  fetchLatestReadingPerPm,
  fetchRawPmReadings,
  testPmHealthDbConnection
} from "./pm-health.db";
import {
  analyzeSinglePmSeries,
  buildPmHealthOverview,
  formatWibNow,
  shiftWibTimestamp
} from "./pm-health.analyzer";
import { pmHealthStore } from "./pm-health.store";
import { PM_CATALOG, resolvePmMeta } from "./pm-health.catalog";
import {
  computeCrosscheckReport,
  CROSSCHECK_PARAM_SPECS,
  pmCrosscheckStore
} from "./pm-health.crosscheck";
import type {
  AnomalyEvent,
  AnomalyType,
  CrosscheckLiveEndpointOrigin,
  CrosscheckParamKey,
  CrosscheckSource,
  CrosscheckSourceTag,
  CrosscheckToleranceMode,
  PmChecklistPatch,
  PmCrosscheckSummaryItem,
  SourceTable
} from "./pm-health.types";

const POLL_INTERVAL_MS = 15_000;
const DEFAULT_LOOKBACK_HOURS = 24;

const sseClients = new Set<Response>();
let lastPollAt: string | null = null;
let lastPollError: string | null = null;
let isPolling = false;
let lastPollStartedAtMs = 0;
let pollerStarted = false;

function broadcastSse(eventName: string, payload: unknown) {
  const data = `event: ${eventName}\ndata: ${JSON.stringify(payload)}\n\n`;
  for (const client of sseClients) {
    try {
      client.write(data);
    } catch {
      sseClients.delete(client);
    }
  }
}

function parseSourceParam(val: unknown): "both" | SourceTable {
  if (val === "electric_pm_telemetry" || val === "hourly") return "electric_pm_telemetry";
  if (val === "electric_pm_telemetry_minute" || val === "minute") return "electric_pm_telemetry_minute";
  return "both";
}

function buildRangeTimestamps(params: {
  hours?: number;
  startDate?: string;
  endDate?: string;
}): { startTimestamp: string; endTimestamp: string } {
  if (params.startDate && /^\d{4}-\d{2}-\d{2}$/.test(params.startDate)) {
    const endD = params.endDate && /^\d{4}-\d{2}-\d{2}$/.test(params.endDate) ? params.endDate : params.startDate;
    return {
      startTimestamp: `${params.startDate} 00:00:00`,
      endTimestamp: `${endD} 23:59:59`
    };
  }
  const hrs = Math.min(24 * 60, Math.max(1, Number(params.hours || DEFAULT_LOOKBACK_HOURS)));
  return {
    startTimestamp: formatWibNow(-hrs * 3600_000),
    endTimestamp: formatWibNow(60_000)
  };
}

function maxTimestamp(a: string, b: string): string {
  return a >= b ? a : b;
}

async function runPmHealthBackgroundPoll(isInitial = false) {
  if (isPolling && Date.now() - lastPollStartedAtMs < 60_000) return;
  isPolling = true;
  lastPollStartedAtMs = Date.now();
  try {
    const resetAt = pmHealthStore.getResetAt();
    const minuteLookbackHours = isInitial ? DEFAULT_LOOKBACK_HOURS : 2;
    const hourlyLookbackHours = isInitial ? Math.max(DEFAULT_LOOKBACK_HOURS, 48) : 12;

    const endTimestamp = formatWibNow(60_000);
    let minStart = formatWibNow(-minuteLookbackHours * 3600_000);
    let hrStart = formatWibNow(-hourlyLookbackHours * 3600_000);

    if (resetAt) {
      minStart = maxTimestamp(minStart, shiftWibTimestamp(resetAt, -5 * 60_000));
      hrStart = maxTimestamp(hrStart, shiftWibTimestamp(resetAt, -2 * 3600_000));
    }

    const [minuteReadings, hourlyReadings] = await Promise.all([
      fetchRawPmReadings({
        table: "electric_pm_telemetry_minute",
        startTimestamp: minStart,
        endTimestamp
      }),
      fetchRawPmReadings({
        table: "electric_pm_telemetry",
        startTimestamp: hrStart,
        endTimestamp
      })
    ]);

    const detectedAtIso = new Date().toISOString();
    const detected: AnomalyEvent[] = [];

    const groupAndAnalyze = (rows: typeof minuteReadings, table: SourceTable) => {
      const byPm = new Map<string, typeof rows>();
      for (const r of rows) {
        const list = byPm.get(r.pm_id) || [];
        list.push(r);
        byPm.set(r.pm_id, list);
      }
      for (const [pmId, pmRows] of byPm.entries()) {
        const { anomalies } = analyzeSinglePmSeries(pmId, table, pmRows, detectedAtIso, {
          markInitialRead: isInitial,
          minAnomalyTimestamp: resetAt
        });
        detected.push(...anomalies);
      }
    };

    groupAndAnalyze(minuteReadings, "electric_pm_telemetry_minute");
    groupAndAnalyze(hourlyReadings, "electric_pm_telemetry");

    const newlyAdded = pmHealthStore.upsertAnomalies(detected, { respectResetAt: true });
    lastPollAt = formatWibNow();
    lastPollError = null;

    if (!isInitial && newlyAdded.length > 0) {
      broadcastSse("anomaly", {
        anomalies: newlyAdded.slice(0, 20),
        newCount: newlyAdded.length,
        stats: pmHealthStore.getStats(),
        scannedAt: lastPollAt
      });
    }

    broadcastSse("heartbeat_scan", {
      scannedAt: lastPollAt,
      newCount: newlyAdded.length,
      stats: pmHealthStore.getStats()
    });
  } catch (err: any) {
    lastPollError = err?.message || "Poll failed";
    logger.warn(`[PM-Health] Read-only poll skipped: ${lastPollError}`);
  } finally {
    isPolling = false;
  }
}

function ensurePollerStarted() {
  if (pollerStarted) return;
  pollerStarted = true;
  // Delay initial read-only poll slightly so SCADA startup runs with zero contention
  const initTimer = setTimeout(() => {
    void runPmHealthBackgroundPoll(true);
  }, 2000);
  initTimer.unref?.();

  const interval = setInterval(() => {
    void runPmHealthBackgroundPoll(false);
  }, POLL_INTERVAL_MS);
  interval.unref?.();
}

/**
 * Supports passing JWT via `?token=` query param for EventSource (SSE) where custom headers
 * cannot be attached by browsers, then delegates to standard SCADA `authenticate` + `authorize(...)`.
 */
function attachQueryTokenToHeader(req: Request, _res: Response, next: NextFunction) {
  if (!req.headers.authorization && typeof req.query.token === "string" && req.query.token.trim()) {
    req.headers.authorization = `Bearer ${req.query.token.trim()}`;
  }
  next();
}

export const pmHealthRouter = Router();

// Restricted to Administrator & Senior Unit Head across ALL PM Health endpoints
const pmHealthAllowedRoles = ["admin", "superadmin", "developer", "dev", "senior_unit_head"];
const adminOnly = [authenticate, authorize(pmHealthAllowedRoles)];

pmHealthRouter.get("/pm-health/health", ...adminOnly, async (_req: Request, res: Response) => {
  ensurePollerStarted();
  res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate");
  const dbStatus = await testPmHealthDbConnection();
  res.json({
    ok: dbStatus.connected,
    mode: "READ_ONLY",
    db: dbStatus,
    monitor: {
      pollIntervalMs: POLL_INTERVAL_MS,
      defaultLookbackHours: DEFAULT_LOOKBACK_HOURS,
      lastPollAt,
      lastPollError,
      isPolling,
      resetAt: pmHealthStore.getResetAt()
    },
    logs: pmHealthStore.getStats()
  });
});

pmHealthRouter.get("/pm-health/overview", ...adminOnly, async (req: Request, res: Response) => {
  ensurePollerStarted();
  res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate");
  try {
    const source = parseSourceParam(req.query.source);
    const resetAt = pmHealthStore.getResetAt();
    const sinceReset = req.query.sinceReset === "true" && Boolean(resetAt);
    const hours = Number(req.query.hours || DEFAULT_LOOKBACK_HOURS);
    const startDate = typeof req.query.startDate === "string" ? req.query.startDate : undefined;
    const endDate = typeof req.query.endDate === "string" ? req.query.endDate : undefined;

    let minStart: string;
    let hrStart: string;
    let endTimestamp: string;
    let displayStart: string;

    if (sinceReset && resetAt) {
      endTimestamp = formatWibNow(60_000);
      displayStart = resetAt;
      minStart = shiftWibTimestamp(resetAt, -5 * 60_000);
      hrStart = shiftWibTimestamp(resetAt, -2 * 3600_000);
    } else {
      const range = buildRangeTimestamps({ hours, startDate, endDate });
      minStart = range.startTimestamp;
      hrStart = range.startTimestamp;
      displayStart = range.startTimestamp;
      endTimestamp = range.endTimestamp;
    }

    const [minuteReadings, hourlyReadings, latestMinutePerPm, latestHourlyPerPm] = await Promise.all([
      source === "electric_pm_telemetry"
        ? Promise.resolve([])
        : fetchRawPmReadings({ table: "electric_pm_telemetry_minute", startTimestamp: minStart, endTimestamp }),
      source === "electric_pm_telemetry_minute"
        ? Promise.resolve([])
        : fetchRawPmReadings({ table: "electric_pm_telemetry", startTimestamp: hrStart, endTimestamp }),
      source === "electric_pm_telemetry"
        ? Promise.resolve([])
        : fetchLatestReadingPerPm("electric_pm_telemetry_minute"),
      source === "electric_pm_telemetry_minute"
        ? Promise.resolve([])
        : fetchLatestReadingPerPm("electric_pm_telemetry")
    ]);

    const { pms, anomalies } = buildPmHealthOverview({
      minuteReadings,
      hourlyReadings,
      latestMinutePerPm,
      latestHourlyPerPm,
      source,
      minAnomalyTimestamp: sinceReset ? resetAt : null
    });

    const newlyLogged = pmHealthStore.upsertAnomalies(anomalies, { respectResetAt: true });
    const scannedAt = formatWibNow();
    lastPollAt = scannedAt;

    const summary = {
      totalPms: pms.length,
      healthyCount: pms.filter((p) => p.healthStatus === "healthy").length,
      criticalCount: pms.filter((p) => p.healthStatus === "critical").length,
      warningCount: pms.filter((p) => p.healthStatus === "warning").length,
      offlineCount: pms.filter((p) => p.healthStatus === "offline").length,
      totalDropsInWindow: pms.reduce((acc, p) => acc + p.dropCount, 0),
      totalAnomaliesInWindow: anomalies.length,
      newlyLoggedCount: newlyLogged.length,
      minuteRowsScanned: minuteReadings.length,
      hourlyRowsScanned: hourlyReadings.length
    };

    res.json({
      range: {
        startTimestamp: displayStart,
        endTimestamp,
        hours,
        source,
        sinceReset,
        resetAt
      },
      scannedAt,
      summary,
      pms,
      newlyLogged: newlyLogged.slice(0, 10),
      logStats: pmHealthStore.getStats()
    });
  } catch (err: any) {
    res.status(500).json({ error: err?.message || "Gagal memuat data kesehatan power meter" });
  }
});

pmHealthRouter.get("/pm-health/pm/:pmId/series", ...adminOnly, async (req: Request, res: Response) => {
  try {
    const pmId = String(req.params.pmId || "").trim().toUpperCase();
    if (!pmId) {
      res.status(400).json({ error: "pmId wajib diisi" });
      return;
    }

    const source = parseSourceParam(req.query.source);
    const resetAt = pmHealthStore.getResetAt();
    const sinceReset = req.query.sinceReset === "true" && Boolean(resetAt);
    const hours = Number(req.query.hours || DEFAULT_LOOKBACK_HOURS);
    const startDate = typeof req.query.startDate === "string" ? req.query.startDate : undefined;
    const endDate = typeof req.query.endDate === "string" ? req.query.endDate : undefined;

    let minStart: string;
    let hrStart: string;
    let displayStart: string;
    let endTimestamp: string;

    if (sinceReset && resetAt) {
      endTimestamp = formatWibNow(60_000);
      displayStart = resetAt;
      minStart = shiftWibTimestamp(resetAt, -5 * 60_000);
      hrStart = shiftWibTimestamp(resetAt, -2 * 3600_000);
    } else {
      const range = buildRangeTimestamps({ hours, startDate, endDate });
      minStart = range.startTimestamp;
      hrStart = range.startTimestamp;
      displayStart = range.startTimestamp;
      endTimestamp = range.endTimestamp;
    }

    const [minuteRows, hourlyRows] = await Promise.all([
      source === "electric_pm_telemetry"
        ? Promise.resolve([])
        : fetchRawPmReadings({
            table: "electric_pm_telemetry_minute",
            startTimestamp: minStart,
            endTimestamp,
            pmId,
            limit: 15000
          }),
      source === "electric_pm_telemetry_minute"
        ? Promise.resolve([])
        : fetchRawPmReadings({
            table: "electric_pm_telemetry",
            startTimestamp: hrStart,
            endTimestamp,
            pmId,
            limit: 15000
          })
    ]);

    const detectedAtIso = new Date().toISOString();
    const minuteAnalysis = analyzeSinglePmSeries(pmId, "electric_pm_telemetry_minute", minuteRows, detectedAtIso, {
      markInitialRead: true,
      minAnomalyTimestamp: sinceReset ? resetAt : null
    });
    const hourlyAnalysis = analyzeSinglePmSeries(pmId, "electric_pm_telemetry", hourlyRows, detectedAtIso, {
      markInitialRead: true,
      minAnomalyTimestamp: sinceReset ? resetAt : null
    });

    const combinedAnomalies = [...minuteAnalysis.anomalies, ...hourlyAnalysis.anomalies].sort((a, b) =>
      b.timestamp.localeCompare(a.timestamp)
    );
    pmHealthStore.upsertAnomalies(combinedAnomalies, { respectResetAt: true });

    const meta = resolvePmMeta(
      pmId,
      minuteRows[minuteRows.length - 1]?.group_id || hourlyRows[hourlyRows.length - 1]?.group_id
    );

    res.json({
      pm: meta,
      range: {
        startTimestamp: displayStart,
        endTimestamp,
        hours,
        source,
        sinceReset,
        resetAt
      },
      minuteSeries: minuteAnalysis.annotated,
      hourlySeries: hourlyAnalysis.annotated,
      anomalies: combinedAnomalies
    });
  } catch (err: any) {
    res.status(500).json({ error: err?.message || "Gagal mengambil riwayat power meter" });
  }
});

pmHealthRouter.get("/pm-health/logs", ...adminOnly, (req: Request, res: Response) => {
  ensurePollerStarted();
  const pmId = typeof req.query.pmId === "string" ? req.query.pmId : undefined;
  const type = typeof req.query.type === "string" ? (req.query.type as AnomalyType | "all") : "all";
  const source = parseSourceParam(req.query.source);
  const startDate = typeof req.query.startDate === "string" && req.query.startDate ? req.query.startDate : undefined;
  const endDate = typeof req.query.endDate === "string" && req.query.endDate ? req.query.endDate : undefined;
  const ack = req.query.ack === "open" || req.query.ack === "acked" ? req.query.ack : "all";
  const search = typeof req.query.search === "string" ? req.query.search : undefined;
  const limit = Number(req.query.limit || 500);

  res.json(
    pmHealthStore.queryLogs({
      pmId,
      type,
      source,
      startDate,
      endDate,
      ack,
      search,
      limit
    })
  );
});

pmHealthRouter.post("/pm-health/scan", ...adminOnly, async (req: Request, res: Response) => {
  ensurePollerStarted();
  try {
    const body = req.body || {};
    const source = parseSourceParam(body.source);
    const resetAt = pmHealthStore.getResetAt();
    const sinceReset = Boolean(body.sinceReset && resetAt);
    const saveBeforeReset = Boolean(body.saveBeforeReset);

    let minStart: string;
    let hrStart: string;
    let displayStart: string;
    let endTimestamp: string;

    if (sinceReset && resetAt) {
      endTimestamp = formatWibNow(60_000);
      displayStart = resetAt;
      minStart = shiftWibTimestamp(resetAt, -5 * 60_000);
      hrStart = shiftWibTimestamp(resetAt, -2 * 3600_000);
    } else {
      const range = buildRangeTimestamps({
        hours: body.hours,
        startDate: body.startDate,
        endDate: body.endDate
      });
      minStart = range.startTimestamp;
      hrStart = range.startTimestamp;
      displayStart = range.startTimestamp;
      endTimestamp = range.endTimestamp;
    }
    const pmId = typeof body.pmId === "string" && body.pmId && body.pmId !== "all" ? body.pmId : undefined;

    const [minuteRows, hourlyRows] = await Promise.all([
      source === "electric_pm_telemetry"
        ? Promise.resolve([])
        : fetchRawPmReadings({ table: "electric_pm_telemetry_minute", startTimestamp: minStart, endTimestamp, pmId }),
      source === "electric_pm_telemetry_minute"
        ? Promise.resolve([])
        : fetchRawPmReadings({ table: "electric_pm_telemetry", startTimestamp: hrStart, endTimestamp, pmId })
    ]);

    const detectedAtIso = new Date().toISOString();
    const detected: AnomalyEvent[] = [];

    const analyzeGrouped = (rows: typeof minuteRows, table: SourceTable) => {
      const byPm = new Map<string, typeof rows>();
      for (const r of rows) {
        const list = byPm.get(r.pm_id) || [];
        list.push(r);
        byPm.set(r.pm_id, list);
      }
      for (const [id, list] of byPm.entries()) {
        const { anomalies } = analyzeSinglePmSeries(id, table, list, detectedAtIso, {
          minAnomalyTimestamp: sinceReset ? resetAt : null
        });
        detected.push(...anomalies);
      }
    };

    analyzeGrouped(minuteRows, "electric_pm_telemetry_minute");
    analyzeGrouped(hourlyRows, "electric_pm_telemetry");

    detected.sort((a, b) => b.timestamp.localeCompare(a.timestamp));
    const newlyLogged = pmHealthStore.upsertAnomalies(detected, {
      respectResetAt: !saveBeforeReset
    });
    lastPollAt = formatWibNow();

    if (newlyLogged.length > 0) {
      broadcastSse("anomaly", {
        anomalies: newlyLogged.slice(0, 20),
        newCount: newlyLogged.length,
        stats: pmHealthStore.getStats(),
        scannedAt: lastPollAt
      });
    }

    res.json({
      ok: true,
      scannedAt: lastPollAt,
      range: { startTimestamp: displayStart, endTimestamp, source, pmId: pmId || "all", sinceReset, resetAt },
      minuteRowsScanned: minuteRows.length,
      hourlyRowsScanned: hourlyRows.length,
      detectedCount: detected.length,
      newlyLoggedCount: newlyLogged.length,
      anomalies: detected.slice(0, 500),
      logStats: pmHealthStore.getStats()
    });
  } catch (err: any) {
    res.status(500).json({ error: err?.message || "Gagal memindai data historis" });
  }
});

pmHealthRouter.post("/pm-health/monitor/reset-baseline", ...adminOnly, (_req: Request, res: Response) => {
  const nowWib = formatWibNow();
  const { clearedCount, resetAt } = pmHealthStore.resetBaseline(nowWib);
  const stats = pmHealthStore.getStats();
  broadcastSse("baseline_reset", { resetAt, clearedCount, stats });
  res.json({ ok: true, resetAt, clearedCount, stats });
});

pmHealthRouter.delete("/pm-health/monitor/reset-baseline", ...adminOnly, (_req: Request, res: Response) => {
  pmHealthStore.clearResetBaseline();
  const stats = pmHealthStore.getStats();
  broadcastSse("baseline_reset", { resetAt: null, clearedCount: 0, stats });
  res.json({ ok: true, resetAt: null, stats });
});

pmHealthRouter.post("/pm-health/logs/:id/ack", ...adminOnly, (req: Request, res: Response) => {
  const id = decodeURIComponent(String(req.params.id || ""));
  const updated = pmHealthStore.acknowledge(id);
  if (!updated) {
    res.status(404).json({ error: "Log tidak ditemukan" });
    return;
  }
  res.json({ ok: true, log: updated, stats: pmHealthStore.getStats() });
});

pmHealthRouter.post("/pm-health/logs/ack-all", ...adminOnly, (_req: Request, res: Response) => {
  const updatedCount = pmHealthStore.acknowledgeAll();
  res.json({ ok: true, updatedCount, stats: pmHealthStore.getStats() });
});

pmHealthRouter.post("/pm-health/logs/read-all", ...adminOnly, (_req: Request, res: Response) => {
  const updatedCount = pmHealthStore.markAllRead();
  res.json({ ok: true, updatedCount, stats: pmHealthStore.getStats() });
});

pmHealthRouter.delete("/pm-health/logs", ...adminOnly, (_req: Request, res: Response) => {
  const nowWib = formatWibNow();
  const { clearedCount, resetAt } = pmHealthStore.resetBaseline(nowWib);
  const stats = pmHealthStore.getStats();
  broadcastSse("baseline_reset", { resetAt, clearedCount, stats });
  res.json({ ok: true, clearedCount, resetAt, stats });
});

// ─── PM Verification Checklist (eWON, Endpoint, Panel LCD) — Strictly Local JSON ───
const CHECKLIST_UNLOCK_TTL_SECONDS = 15 * 60; // 15 minutes active edit session

/**
 * Middleware enforcing password-verified unlock token before mutating PM verification checklist.
 * Returns HTTP 423 (Locked) — never 401 — so frontend does not terminate user session.
 */
function requireChecklistUnlock(req: Request, res: Response, next: NextFunction) {
  const headerToken = req.headers["x-checklist-unlock-token"];
  const rawToken =
    typeof headerToken === "string"
      ? headerToken.trim()
      : Array.isArray(headerToken)
      ? String(headerToken[0] || "").trim()
      : typeof req.body?.unlockToken === "string"
      ? req.body.unlockToken.trim()
      : "";

  if (!rawToken) {
    res.status(423).json({
      ok: false,
      code: "CHECKLIST_LOCKED",
      error: "Checklist terkunci. Buka kunci dengan password akun Anda terlebih dahulu."
    });
    return;
  }

  try {
    const decoded = jwt.verify(rawToken, env.jwtSecret) as jwt.JwtPayload & {
      type?: string;
      sub?: string;
    };
    const currentUserId = String(req.user?.id || "");
    if (decoded?.type !== "pm_checklist_unlock" || !currentUserId || String(decoded.sub || "") !== currentUserId) {
      res.status(423).json({
        ok: false,
        code: "CHECKLIST_LOCKED",
        error: "Sesi buka kunci tidak valid untuk akun ini. Silakan buka kunci ulang."
      });
      return;
    }
    next();
  } catch {
    res.status(423).json({
      ok: false,
      code: "CHECKLIST_LOCKED",
      error: "Sesi buka kunci telah berakhir. Masukkan password akun Anda kembali untuk mengedit."
    });
  }
}

pmHealthRouter.post("/pm-health/checklist/unlock", ...adminOnly, async (req: Request, res: Response) => {
  const password = typeof req.body?.password === "string" ? req.body.password : "";
  if (!password) {
    res.status(400).json({ ok: false, error: "Password akun wajib diisi." });
    return;
  }

  const userId = String(req.user?.id || "").trim();
  if (!userId) {
    res.status(403).json({ ok: false, error: "Identitas akun tidak ditemukan." });
    return;
  }

  try {
    const pool = getPostgresPool();
    const pgRes = await pool.query(
      `
      SELECT id, username, name, email, password_hash, status
      FROM users
      WHERE id::text = $1 OR LOWER(username) = LOWER($1) OR LOWER(email) = LOWER($1)
      LIMIT 1
      `,
      [userId]
    );

    const user = pgRes.rows[0];
    if (!user) {
      res.status(403).json({ ok: false, error: "Akun tidak ditemukan di sistem." });
      return;
    }
    if (user.status === "disabled") {
      res.status(403).json({ ok: false, error: "Akun sedang dinonaktifkan." });
      return;
    }
    if (!user.password_hash) {
      res.status(403).json({ ok: false, error: "Akun ini belum memiliki password lokal." });
      return;
    }

    const match = await bcrypt.compare(password, user.password_hash);
    if (!match) {
      // Return 403 (NOT 401) so frontend api.client does not clear auth session / redirect to /login
      res.status(403).json({ ok: false, error: "Password akun salah. Silakan periksa kembali." });
      return;
    }

    const unlockToken = jwt.sign(
      {
        sub: userId,
        type: "pm_checklist_unlock",
        name: user.name || req.user?.name || "Admin"
      },
      env.jwtSecret,
      { expiresIn: CHECKLIST_UNLOCK_TTL_SECONDS }
    );
    const expiresAt = Date.now() + CHECKLIST_UNLOCK_TTL_SECONDS * 1000;

    res.json({
      ok: true,
      unlockToken,
      expiresAt,
      expiresInSeconds: CHECKLIST_UNLOCK_TTL_SECONDS,
      unlockedBy: user.name || req.user?.name || "Admin"
    });
  } catch (err: any) {
    logger.warn(`[PM-Health] Checklist unlock verification error: ${err?.message || err}`);
    res.status(500).json({ ok: false, error: "Gagal memverifikasi password akun." });
  }
});

pmHealthRouter.get("/pm-health/checklist", ...adminOnly, (_req: Request, res: Response) => {
  res.json({
    ok: true,
    items: pmHealthStore.getAllChecklist(),
    catalog: PM_CATALOG
  });
});

pmHealthRouter.patch("/pm-health/checklist/:pmId", ...adminOnly, requireChecklistUnlock, (req: Request, res: Response) => {
  const pmId = decodeURIComponent(String(req.params.pmId || "")).trim().toUpperCase();
  if (!pmId) {
    res.status(400).json({ error: "pmId wajib diisi" });
    return;
  }
  const body = req.body || {};
  const patch: PmChecklistPatch = {};
  if (typeof body.ewonChecked === "boolean") patch.ewonChecked = body.ewonChecked;
  if (typeof body.endpointChecked === "boolean") patch.endpointChecked = body.endpointChecked;
  if (typeof body.panelLcdChecked === "boolean") patch.panelLcdChecked = body.panelLcdChecked;
  if (typeof body.notes === "string") patch.notes = body.notes;

  const actor = req.user?.name || req.user?.id || "Admin";
  const nowWib = formatWibNow();
  const item = pmHealthStore.upsertChecklistItem(pmId, patch, actor, nowWib);
  broadcastSse("checklist_updated", { pmId, item });
  res.json({ ok: true, item });
});

pmHealthRouter.delete("/pm-health/checklist/:pmId", ...adminOnly, requireChecklistUnlock, (req: Request, res: Response) => {
  const pmId = decodeURIComponent(String(req.params.pmId || "")).trim().toUpperCase();
  if (!pmId) {
    res.status(400).json({ error: "pmId wajib diisi" });
    return;
  }
  const result = pmHealthStore.resetChecklist(pmId);
  broadcastSse("checklist_updated", { pmId, item: result.item });
  res.json({ ok: true, clearedCount: result.clearedCount, item: result.item });
});

pmHealthRouter.delete("/pm-health/checklist", ...adminOnly, requireChecklistUnlock, (_req: Request, res: Response) => {
  const result = pmHealthStore.resetChecklist();
  broadcastSse("checklist_reset", { clearedCount: result.clearedCount });
  res.json({ ok: true, clearedCount: result.clearedCount });
});

// ─── Multi-Image PM Parameter Crosscheck (eWON / Endpoint / Panel LCD) ───
function toCrosscheckSummary(
  record: ReturnType<typeof pmCrosscheckStore.getRecord>,
  report: ReturnType<typeof computeCrosscheckReport>
): PmCrosscheckSummaryItem {
  return {
    pmId: record.pmId,
    imageCount: record.images.length,
    ewonImages: report.sourceCoverage.ewonImages,
    endpointImages: report.sourceCoverage.endpointImages,
    panelLcdImages: report.sourceCoverage.panelLcdImages,
    hasLiveEndpoint: report.sourceCoverage.hasLiveEndpoint,
    comparedParams: report.stats.comparedParams,
    matchCount: report.stats.matchCount,
    slightDiffCount: report.stats.slightDiffCount,
    mismatchCount: report.stats.mismatchCount + report.stats.scaleMismatchCount,
    overallStatus: report.overallStatus,
    lastAnalyzedAt: record.lastAnalyzedAt
  };
}

pmHealthRouter.get("/pm-health/crosscheck", ...adminOnly, (_req: Request, res: Response) => {
  res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate");
  res.json({
    ok: true,
    summaries: pmCrosscheckStore.listSummaries(),
    paramSpecs: CROSSCHECK_PARAM_SPECS
  });
});

pmHealthRouter.get("/pm-health/crosscheck/:pmId", ...adminOnly, (req: Request, res: Response) => {
  res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate");
  const pmId = decodeURIComponent(String(req.params.pmId || "")).trim().toUpperCase();
  if (!pmId) {
    res.status(400).json({ ok: false, error: "pmId wajib diisi." });
    return;
  }
  const record = pmCrosscheckStore.getRecord(pmId);
  const report = computeCrosscheckReport(record);
  res.json({
    ok: true,
    pm: resolvePmMeta(pmId),
    record,
    report,
    paramSpecs: CROSSCHECK_PARAM_SPECS
  });
});

pmHealthRouter.post("/pm-health/crosscheck/:pmId/images", ...adminOnly, (req: Request, res: Response) => {
  const pmId = decodeURIComponent(String(req.params.pmId || "")).trim().toUpperCase();
  if (!pmId) {
    res.status(400).json({ ok: false, error: "pmId wajib diisi." });
    return;
  }
  try {
    const actor = req.user?.name || req.user?.id || "Admin";
    const nowWib = formatWibNow();
    const body = req.body || {};

    const items: Array<{ dataUrl: string; fileName: string; source: CrosscheckSourceTag; caption?: string }> =
      Array.isArray(body.images)
        ? body.images
        : [
            {
              dataUrl: String(body.dataUrl || ""),
              fileName: String(body.fileName || "image.jpg"),
              source: (body.source || "auto") as CrosscheckSourceTag,
              caption: typeof body.caption === "string" ? body.caption : ""
            }
          ];

    if (items.length === 0) {
      res.status(400).json({ ok: false, error: "Minimal 1 gambar harus dikirim." });
      return;
    }

    const added: ReturnType<typeof pmCrosscheckStore.addImage>["added"][] = [];
    let latestRecord = pmCrosscheckStore.getRecord(pmId);
    for (const imgInput of items) {
      const result = pmCrosscheckStore.addImage(
        pmId,
        {
          dataUrl: String(imgInput.dataUrl || ""),
          fileName: String(imgInput.fileName || "image.jpg"),
          source: (imgInput.source || "auto") as CrosscheckSourceTag,
          caption: typeof imgInput.caption === "string" ? imgInput.caption : ""
        },
        actor,
        nowWib
      );
      added.push(result.added);
      latestRecord = result.record;
    }

    const report = computeCrosscheckReport(latestRecord);
    const summary = toCrosscheckSummary(latestRecord, report);
    broadcastSse("crosscheck_updated", { pmId: latestRecord.pmId, summary });

    res.json({
      ok: true,
      added,
      record: latestRecord,
      report
    });
  } catch (err: any) {
    res.status(400).json({ ok: false, error: err?.message || "Gagal mengunggah gambar crosscheck." });
  }
});

pmHealthRouter.get(
  "/pm-health/crosscheck/:pmId/images/:imageId",
  attachQueryTokenToHeader,
  ...adminOnly,
  (req: Request, res: Response) => {
    const pmId = decodeURIComponent(String(req.params.pmId || "")).trim().toUpperCase();
    const imageId = decodeURIComponent(String(req.params.imageId || "")).trim();
    if (!pmId || !imageId) {
      res.status(400).json({ ok: false, error: "Parameter tidak lengkap." });
      return;
    }
    const file = pmCrosscheckStore.getImageFile(pmId, imageId);
    if (!file) {
      res.status(404).json({ ok: false, error: "Gambar tidak ditemukan." });
      return;
    }
    res.setHeader("Cross-Origin-Resource-Policy", "cross-origin");
    res.setHeader("Cache-Control", "private, max-age=3600");
    res.setHeader("Content-Type", file.mimeType);
    res.sendFile(file.filePath);
  }
);

pmHealthRouter.patch("/pm-health/crosscheck/:pmId/images/:imageId", ...adminOnly, (req: Request, res: Response) => {
  const pmId = decodeURIComponent(String(req.params.pmId || "")).trim().toUpperCase();
  const imageId = decodeURIComponent(String(req.params.imageId || "")).trim();
  const body = req.body || {};
  const record = pmCrosscheckStore.updateImageMeta(
    pmId,
    imageId,
    {
      source: body.source as CrosscheckSourceTag | undefined,
      caption: typeof body.caption === "string" ? body.caption : undefined
    },
    formatWibNow()
  );
  if (!record) {
    res.status(404).json({ ok: false, error: "Gambar crosscheck tidak ditemukan." });
    return;
  }
  const report = computeCrosscheckReport(record);
  broadcastSse("crosscheck_updated", { pmId: record.pmId, summary: toCrosscheckSummary(record, report) });
  res.json({ ok: true, record, report });
});

pmHealthRouter.delete("/pm-health/crosscheck/:pmId/images/:imageId", ...adminOnly, (req: Request, res: Response) => {
  const pmId = decodeURIComponent(String(req.params.pmId || "")).trim().toUpperCase();
  const imageId = decodeURIComponent(String(req.params.imageId || "")).trim();
  const record = pmCrosscheckStore.deleteImage(pmId, imageId, formatWibNow());
  if (!record) {
    res.status(404).json({ ok: false, error: "Gambar crosscheck tidak ditemukan." });
    return;
  }
  const report = computeCrosscheckReport(record);
  broadcastSse("crosscheck_updated", { pmId: record.pmId, summary: toCrosscheckSummary(record, report) });
  res.json({ ok: true, record, report });
});

function extractNumericParamsFromLiveRecord(rec: ElectricPmRecord): Record<string, number> {
  const keys = [
    "volt_ab",
    "volt_bc",
    "volt_ca",
    "volt_ll",
    "volt_an",
    "volt_bn",
    "volt_cn",
    "volt_ln",
    "current_a",
    "current_b",
    "current_c",
    "frequency",
    "active_power_total",
    "reactive_power_total",
    "apparent_power_total",
    "power_factor",
    "voltage_unbalance",
    "current_unbalance",
    "thd_volt_a",
    "thd_volt_b",
    "thd_volt_c",
    "thd_current_a",
    "thd_current_b",
    "thd_current_c",
    "active_energy"
  ] as const;

  const values: Record<string, number> = {};
  for (const k of keys) {
    const v = (rec as any)[k];
    if (typeof v === "number" && Number.isFinite(v)) {
      values[k] = v;
    }
  }
  return values;
}

pmHealthRouter.post("/pm-health/crosscheck/:pmId/live-endpoint", ...adminOnly, async (req: Request, res: Response) => {
  const pmId = decodeURIComponent(String(req.params.pmId || "")).trim().toUpperCase();
  if (!pmId) {
    res.status(400).json({ ok: false, error: "pmId wajib diisi." });
    return;
  }
  try {
    const nowWib = formatWibNow();
    const targetTimestamp =
      typeof req.body?.targetTimestamp === "string" && req.body.targetTimestamp.trim()
        ? req.body.targetTimestamp.trim()
        : null;

    let values: Record<string, number> = {};
    let tStamp: string | null = null;
    let sourceOrigin: CrosscheckLiveEndpointOrigin = "db_minute_latest";
    let sourceLabel = "Database Telemetry Menit";

    // If user explicitly requests historical timestamp matching the photo time, query DB minute table closest to that time
    if (targetTimestamp) {
      const hist = await fetchLatestFullPmParams(pmId, targetTimestamp);
      values = hist.values;
      tStamp = hist.tStamp;
      sourceOrigin = "db_minute_at_time";
      sourceLabel = `Endpoint Historis (~${targetTimestamp.slice(11, 16)} WIB)`;
    } else {
      // Priority 1 & 2: Pull TRUE real-time value directly from WebDev HTTP Endpoint right at this second (or 1s live cache)
      const meta = resolvePmMeta(pmId);
      const liveHttp = await fetchLivePmEndpointSnapshot(pmId, meta.groupId);
      if (liveHttp) {
        values = extractNumericParamsFromLiveRecord(liveHttp.record);
        tStamp = nowWib;
        sourceOrigin = liveHttp.origin;
        sourceLabel =
          liveHttp.origin === "live_endpoint_http"
            ? `Endpoint Live (${liveHttp.endpointName})`
            : `Endpoint Live Cache (${liveHttp.endpointName})`;
      }

      // Priority 3: Fallback to read-only PostgreSQL minute telemetry if direct HTTP endpoint is unreachable
      if (Object.keys(values).length === 0) {
        const fallback = await fetchLatestFullPmParams(pmId);
        values = fallback.values;
        tStamp = fallback.tStamp;
        sourceOrigin = "db_minute_latest";
        sourceLabel = "Database Telemetry Menit";
      }
    }

    const capturedCount = Object.keys(values).length;
    if (capturedCount === 0) {
      res.status(404).json({
        ok: false,
        error: targetTimestamp
          ? `Tidak ditemukan data Endpoint untuk ${pmId} di sekitar waktu ${targetTimestamp} WIB (±15 menit).`
          : `Data Endpoint untuk ${pmId} belum tersedia baik dari Live Endpoint maupun database SCADA.`
      });
      return;
    }

    const record = pmCrosscheckStore.setLiveEndpointSnapshot(pmId, tStamp, values, nowWib, {
      sourceOrigin,
      sourceLabel
    });
    const report = computeCrosscheckReport(record);
    broadcastSse("crosscheck_updated", { pmId: record.pmId, summary: toCrosscheckSummary(record, report) });
    res.json({
      ok: true,
      capturedCount,
      tStamp,
      sourceOrigin,
      sourceLabel,
      record,
      report
    });
  } catch (err: any) {
    res.status(500).json({ ok: false, error: err?.message || "Gagal mengambil value dari Endpoint." });
  }
});

pmHealthRouter.patch("/pm-health/crosscheck/:pmId/settings", ...adminOnly, (req: Request, res: Response) => {
  const pmId = decodeURIComponent(String(req.params.pmId || "")).trim().toUpperCase();
  if (!pmId) {
    res.status(400).json({ ok: false, error: "pmId wajib diisi." });
    return;
  }
  const mode = req.body?.toleranceMode as CrosscheckToleranceMode;
  if (mode !== "strict" && mode !== "normal" && mode !== "relaxed") {
    res.status(400).json({ ok: false, error: "toleranceMode harus strict, normal, atau relaxed." });
    return;
  }
  const record = pmCrosscheckStore.setToleranceMode(pmId, mode, formatWibNow());
  const report = computeCrosscheckReport(record);
  broadcastSse("crosscheck_updated", { pmId: record.pmId, summary: toCrosscheckSummary(record, report) });
  res.json({ ok: true, record, report });
});

pmHealthRouter.delete("/pm-health/crosscheck/:pmId/live-endpoint", ...adminOnly, (req: Request, res: Response) => {
  const pmId = decodeURIComponent(String(req.params.pmId || "")).trim().toUpperCase();
  if (!pmId) {
    res.status(400).json({ ok: false, error: "pmId wajib diisi." });
    return;
  }
  const record = pmCrosscheckStore.clearLiveEndpointSnapshot(pmId, formatWibNow());
  const report = computeCrosscheckReport(record);
  broadcastSse("crosscheck_updated", { pmId: record.pmId, summary: toCrosscheckSummary(record, report) });
  res.json({ ok: true, record, report });
});

pmHealthRouter.post("/pm-health/crosscheck/:pmId/analyze", ...adminOnly, async (req: Request, res: Response) => {
  const pmId = decodeURIComponent(String(req.params.pmId || "")).trim().toUpperCase();
  if (!pmId) {
    res.status(400).json({ ok: false, error: "pmId wajib diisi." });
    return;
  }
  try {
    const actor = req.user?.name || req.user?.id || "Admin";
    const forceReanalyze = Boolean(req.body?.forceReanalyze);
    const result = await pmCrosscheckStore.analyzePmImages(pmId, {
      forceReanalyze,
      actor,
      nowWib: formatWibNow()
    });
    broadcastSse("crosscheck_updated", {
      pmId: result.record.pmId,
      summary: toCrosscheckSummary(result.record, result.report)
    });
    res.json({
      ok: true,
      analyzedImageCount: result.analyzedImageCount,
      record: result.record,
      report: result.report
    });
  } catch (err: any) {
    logger.warn(`[PM-Crosscheck] Analyze failed for ${pmId}: ${err?.message || err}`);
    res.status(500).json({ ok: false, error: err?.message || "Gagal menganalisis gambar crosscheck." });
  }
});

pmHealthRouter.patch("/pm-health/crosscheck/:pmId/override", ...adminOnly, (req: Request, res: Response) => {
  const pmId = decodeURIComponent(String(req.params.pmId || "")).trim().toUpperCase();
  const body = req.body || {};
  const source = body.source as CrosscheckSource;
  const paramKey = body.key as CrosscheckParamKey;

  if (source !== "ewon" && source !== "endpoint" && source !== "panel_lcd") {
    res.status(400).json({ ok: false, error: "Sumber override harus ewon, endpoint, atau panel_lcd." });
    return;
  }
  if (!paramKey || typeof paramKey !== "string") {
    res.status(400).json({ ok: false, error: "Key parameter wajib diisi." });
    return;
  }

  const rawVal = body.value;
  const numericVal = rawVal === null || rawVal === "" || rawVal === undefined ? null : Number(rawVal);
  if (numericVal !== null && !Number.isFinite(numericVal)) {
    res.status(400).json({ ok: false, error: "Nilai parameter harus berupa angka valid." });
    return;
  }

  try {
    const record = pmCrosscheckStore.setManualOverride(pmId, source, paramKey, numericVal, formatWibNow());
    const report = computeCrosscheckReport(record);
    broadcastSse("crosscheck_updated", { pmId: record.pmId, summary: toCrosscheckSummary(record, report) });
    res.json({ ok: true, record, report });
  } catch (err: any) {
    res.status(400).json({ ok: false, error: err?.message || "Gagal menyimpan koreksi manual." });
  }
});

pmHealthRouter.delete("/pm-health/crosscheck/:pmId", ...adminOnly, (req: Request, res: Response) => {
  const pmId = decodeURIComponent(String(req.params.pmId || "")).trim().toUpperCase();
  if (!pmId) {
    res.status(400).json({ ok: false, error: "pmId wajib diisi." });
    return;
  }
  pmCrosscheckStore.clearPm(pmId);
  broadcastSse("crosscheck_updated", { pmId, cleared: true });
  res.json({ ok: true });
});

pmHealthRouter.get(
  "/pm-health/events",
  attachQueryTokenToHeader,
  ...adminOnly,
  (req: Request, res: Response) => {
    ensurePollerStarted();
    res.setHeader("Content-Type", "text/event-stream; charset=utf-8");
    res.setHeader("Cache-Control", "no-cache, no-transform");
    res.setHeader("Connection", "keep-alive");
    res.setHeader("X-Accel-Buffering", "no");
    res.flushHeaders?.();

    sseClients.add(res);
    res.write(
      `event: connected\ndata: ${JSON.stringify({
        connectedAt: formatWibNow(),
        lastPollAt,
        stats: pmHealthStore.getStats()
      })}\n\n`
    );

    const ping = setInterval(() => {
      try {
        res.write(": ping\n\n");
      } catch {
        clearInterval(ping);
        sseClients.delete(res);
      }
    }, 15_000);

    req.on("close", () => {
      clearInterval(ping);
      sseClients.delete(res);
    });
  }
);
