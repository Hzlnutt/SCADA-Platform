import { isIncomingCubiclePm, PM_CATALOG, resolvePmMeta } from "./pm-health.catalog";
import type {
  AnnotatedReading,
  AnomalyEvent,
  AnomalySeverity,
  AnomalyType,
  HealthStatus,
  PmHealthSummary,
  RawPmReading,
  SourceTable,
  SparklinePoint
} from "./pm-health.types";

const DROP_TOLERANCE_KWH = 0.01;
const STALE_MINUTE_THRESHOLD_MIN = 20;
const STALE_HOURLY_THRESHOLD_MIN = 135;

export function parseWibTimestampMs(ts: string): number {
  const m = ts.trim().match(/^(\d{4})-(\d{2})-(\d{2})\s+(\d{2}):(\d{2}):(\d{2})$/);
  if (!m) return Date.parse(ts);
  return Date.parse(`${m[1]}-${m[2]}-${m[3]}T${m[4]}:${m[5]}:${m[6]}+07:00`);
}

export function formatWibFromMs(utcMs: number): string {
  const d = new Date(utcMs + 7 * 3600_000);
  const yyyy = d.getUTCFullYear();
  const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(d.getUTCDate()).padStart(2, "0");
  const hh = String(d.getUTCHours()).padStart(2, "0");
  const mi = String(d.getUTCMinutes()).padStart(2, "0");
  const ss = String(d.getUTCSeconds()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd} ${hh}:${mi}:${ss}`;
}

export function formatWibNow(offsetMs = 0): string {
  return formatWibFromMs(Date.now() + offsetMs);
}

export function shiftWibTimestamp(wibTs: string, offsetMs: number): string {
  const ms = parseWibTimestampMs(wibTs);
  if (!Number.isFinite(ms)) return formatWibNow(offsetMs);
  return formatWibFromMs(ms + offsetMs);
}

function splitDateTime(ts: string): { date: string; time: string } {
  const parts = ts.trim().split(/\s+/);
  return {
    date: parts[0] || ts,
    time: parts[1] || "00:00:00"
  };
}

function fmtKwh(n: number): string {
  return n.toLocaleString("id-ID", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function analyzeSinglePmSeries(
  pmId: string,
  table: SourceTable,
  readings: RawPmReading[],
  detectedAtIso: string,
  options?: { markInitialRead?: boolean; minAnomalyTimestamp?: string | null }
): {
  annotated: AnnotatedReading[];
  anomalies: AnomalyEvent[];
} {
  const annotated: AnnotatedReading[] = [];
  const anomalies: AnomalyEvent[] = [];

  if (readings.length === 0) {
    return { annotated, anomalies };
  }

  const sorted = [...readings].sort((a, b) => {
    if (a.t_stamp !== b.t_stamp) return a.t_stamp.localeCompare(b.t_stamp);
    return a.id - b.id;
  });

  const meta = resolvePmMeta(pmId, sorted[sorted.length - 1]?.group_id);
  const isCubicle = isIncomingCubiclePm(meta.pmId);
  const isMinuteTable = table === "electric_pm_telemetry_minute";
  const initialRead = Boolean(options?.markInitialRead);
  const minAnomalyTs = options?.minAnomalyTimestamp || null;

  const numericEnergies = sorted
    .map((r) => r.active_energy)
    .filter((v): v is number => v !== null && Number.isFinite(v));
  const maxSeriesEnergy = numericEnergies.length > 0 ? Math.max(...numericEnergies) : 0;
  const minSeriesEnergy = numericEnergies.length > 0 ? Math.min(...numericEnergies) : 0;
  const is16BitRegisterRange = maxSeriesEnergy > 1000 && maxSeriesEnergy <= 65536 && minSeriesEnergy >= 0;

  let prevValid: RawPmReading | null = null;
  let pendingDropMagnitude: number | null = null;
  let stuckStreak = 0;
  let stuckReportedInStreak = false;
  let stuckStartReading: RawPmReading | null = null;

  for (const row of sorted) {
    let delta: number | null = null;
    let anomalyType: AnomalyType | null = null;
    let anomalySeverity: AnomalySeverity | null = null;
    let anomalyMessage: string | null = null;

    const currEnergy = row.active_energy;

    if (currEnergy !== null) {
      if (prevValid !== null && prevValid.active_energy !== null) {
        const prevEnergy = prevValid.active_energy;
        delta = Number((currEnergy - prevEnergy).toFixed(4));
        const dtMs = Math.max(0, parseWibTimestampMs(row.t_stamp) - parseWibTimestampMs(prevValid.t_stamp));
        const dtMinutes = dtMs / 60_000;
        const dtHours = dtMs / 3_600_000;

        if (prevEnergy > 0 && currEnergy <= 0) {
          anomalyType = "DROP_TO_ZERO";
          anomalySeverity = "critical";
          anomalyMessage = `Active energy drop ke ${fmtKwh(currEnergy)} dari ${fmtKwh(prevEnergy)} (${fmtKwh(delta)})`;
          pendingDropMagnitude = is16BitRegisterRange ? null : Math.abs(delta);
          stuckStreak = 0;
          stuckReportedInStreak = false;
        } else if (currEnergy < prevEnergy - DROP_TOLERANCE_KWH) {
          if (currEnergy < 0) {
            anomalyType = "NEGATIVE_ENERGY";
            anomalySeverity = "critical";
            anomalyMessage = `Nilai active energy negatif (${fmtKwh(currEnergy)}) dari ${fmtKwh(prevEnergy)}`;
            pendingDropMagnitude = Math.abs(delta);
          } else if (is16BitRegisterRange && prevEnergy >= 30000 && currEnergy <= 35000) {
            anomalyType = "ROLLOVER_16BIT";
            anomalySeverity = "critical";
            anomalyMessage = `Rollover register 16-bit (batas 65.535): active energy turun dari ${fmtKwh(prevEnergy)} ke ${fmtKwh(currEnergy)} (naik-turun berulang)`;
            pendingDropMagnitude = null;
          } else {
            anomalyType = "ENERGY_DECREASE";
            anomalySeverity = "critical";
            anomalyMessage = `Active energy turun dari ${fmtKwh(prevEnergy)} kWh menjadi ${fmtKwh(currEnergy)} kWh (turun ${fmtKwh(Math.abs(delta))} kWh)`;
            pendingDropMagnitude = Math.abs(delta);
          }
          stuckStreak = 0;
          stuckReportedInStreak = false;
        } else if (
          pendingDropMagnitude !== null &&
          delta > Math.max(5, pendingDropMagnitude * 0.4)
        ) {
          anomalyType = "REBOUND_AFTER_DROP";
          anomalySeverity = "critical";
          anomalyMessage = `Active energy naik kembali (+${fmtKwh(delta)} kWh) setelah sebelumnya drop — indikasi fluktuasi naik-turun`;
          pendingDropMagnitude = null;
          stuckStreak = 0;
          stuckReportedInStreak = false;
        } else {
          pendingDropMagnitude = null;
          const maxJump = isMinuteTable
            ? isCubicle
              ? 3000
              : 500
            : isCubicle
            ? 25000
            : 5000;
          const timeWindowOk = isMinuteTable ? dtMinutes <= 10 : dtHours <= 2.5;
          if (!is16BitRegisterRange && timeWindowOk && delta > maxJump) {
            anomalyType = "ENERGY_SPIKE";
            anomalySeverity = "warning";
            anomalyMessage = `Lonjakan active energy tidak wajar sebesar +${fmtKwh(delta)} kWh (${fmtKwh(prevEnergy)} → ${fmtKwh(currEnergy)} kWh)`;
            stuckStreak = 0;
            stuckReportedInStreak = false;
          } else if (
            Math.abs(delta) <= 0.0001 &&
            row.active_power_total !== null &&
            row.active_power_total >= 5
          ) {
            if (stuckStreak === 0) stuckStartReading = prevValid;
            stuckStreak += 1;
            const stuckThreshold = isMinuteTable ? 8 : 3;
            if (stuckStreak >= stuckThreshold && !stuckReportedInStreak) {
              anomalyType = "ENERGY_STUCK";
              anomalySeverity = "warning";
              anomalyMessage = `Active energy tertahan di ${fmtKwh(currEnergy)} kWh selama ${stuckStreak} sampel berturut-turut meski daya aktif ${row.active_power_total.toFixed(1)} kW`;
              stuckReportedInStreak = true;
            }
          } else {
            stuckStreak = 0;
            stuckReportedInStreak = false;
            stuckStartReading = null;
          }
        }

        if (anomalyType && anomalySeverity && anomalyMessage) {
          if (minAnomalyTs && row.t_stamp <= minAnomalyTs) {
            anomalyType = null;
            anomalySeverity = null;
            anomalyMessage = null;
          } else {
            const { date, time } = splitDateTime(row.t_stamp);
            const refPrev = anomalyType === "ENERGY_STUCK" && stuckStartReading ? stuckStartReading : prevValid;
            anomalies.push({
              id: `${table}:${meta.pmId}:${row.t_stamp}:${anomalyType}`,
              detectedAt: detectedAtIso,
              sourceTable: table,
              pmId: meta.pmId,
              pmName: meta.name,
              factory: meta.factory,
              area: meta.area,
              groupId: row.group_id || meta.groupId,
              type: anomalyType,
              severity: anomalySeverity,
              date,
              time,
              timestamp: row.t_stamp,
              prevTimestamp: refPrev.t_stamp,
              prevEnergy: refPrev.active_energy ?? prevEnergy,
              currEnergy,
              deltaEnergy: delta,
              activePower: row.active_power_total,
              message: anomalyMessage,
              acknowledged: false,
              read: initialRead
            });
          }
        }
      } else if (currEnergy < 0) {
        if (!minAnomalyTs || row.t_stamp > minAnomalyTs) {
          anomalyType = "NEGATIVE_ENERGY";
          anomalySeverity = "critical";
          anomalyMessage = `Nilai active energy negatif (${fmtKwh(currEnergy)} kWh)`;
          const { date, time } = splitDateTime(row.t_stamp);
          anomalies.push({
            id: `${table}:${meta.pmId}:${row.t_stamp}:${anomalyType}`,
            detectedAt: detectedAtIso,
            sourceTable: table,
            pmId: meta.pmId,
            pmName: meta.name,
            factory: meta.factory,
            area: meta.area,
            groupId: row.group_id || meta.groupId,
            type: anomalyType,
            severity: anomalySeverity,
            date,
            time,
            timestamp: row.t_stamp,
            prevTimestamp: row.t_stamp,
            prevEnergy: currEnergy,
            currEnergy,
            deltaEnergy: 0,
            activePower: row.active_power_total,
            message: anomalyMessage,
            acknowledged: false,
            read: initialRead
          });
        }
      }

      prevValid = row;
    }

    annotated.push({
      ...row,
      delta_energy: delta,
      anomaly_type: anomalyType,
      anomaly_severity: anomalySeverity,
      anomaly_message: anomalyMessage
    });
  }

  return { annotated, anomalies };
}

function buildSparkline(annotated: AnnotatedReading[], maxPoints = 40): SparklinePoint[] {
  const valid = annotated.filter((r) => r.active_energy !== null);
  if (valid.length === 0) return [];
  if (valid.length <= maxPoints) {
    return valid.map((r) => ({
      t: r.t_stamp,
      v: r.active_energy as number,
      anomaly: r.anomaly_type !== null
    }));
  }

  const step = valid.length / maxPoints;
  const pickedIndices = new Set<number>();
  for (let i = 0; i < maxPoints; i++) {
    pickedIndices.add(Math.min(valid.length - 1, Math.floor(i * step)));
  }
  pickedIndices.add(valid.length - 1);
  valid.forEach((r, idx) => {
    if (r.anomaly_type !== null) pickedIndices.add(idx);
  });

  return Array.from(pickedIndices)
    .sort((a, b) => a - b)
    .map((idx) => ({
      t: valid[idx].t_stamp,
      v: valid[idx].active_energy as number,
      anomaly: valid[idx].anomaly_type !== null
    }));
}

export function buildPmHealthOverview(params: {
  minuteReadings: RawPmReading[];
  hourlyReadings: RawPmReading[];
  latestMinutePerPm: RawPmReading[];
  latestHourlyPerPm: RawPmReading[];
  source: "both" | SourceTable;
  minAnomalyTimestamp?: string | null;
}): {
  pms: PmHealthSummary[];
  anomalies: AnomalyEvent[];
} {
  const detectedAtIso = new Date().toISOString();
  const nowMs = Date.now();
  const minAnomalyTs = params.minAnomalyTimestamp || null;

  const minuteByPm = new Map<string, RawPmReading[]>();
  const hourlyByPm = new Map<string, RawPmReading[]>();
  const latestMinByPm = new Map<string, RawPmReading>();
  const latestHrByPm = new Map<string, RawPmReading>();

  for (const r of params.minuteReadings) {
    const list = minuteByPm.get(r.pm_id) || [];
    list.push(r);
    minuteByPm.set(r.pm_id, list);
  }
  for (const r of params.hourlyReadings) {
    const list = hourlyByPm.get(r.pm_id) || [];
    list.push(r);
    hourlyByPm.set(r.pm_id, list);
  }
  for (const r of params.latestMinutePerPm) latestMinByPm.set(r.pm_id, r);
  for (const r of params.latestHourlyPerPm) latestHrByPm.set(r.pm_id, r);

  const allPmIds = new Set<string>(PM_CATALOG.map((m) => m.pmId));
  for (const id of minuteByPm.keys()) allPmIds.add(id);
  for (const id of hourlyByPm.keys()) allPmIds.add(id);
  for (const id of latestMinByPm.keys()) allPmIds.add(id);
  for (const id of latestHrByPm.keys()) allPmIds.add(id);

  const allAnomalies: AnomalyEvent[] = [];
  const pms: PmHealthSummary[] = [];

  for (const pmId of allPmIds) {
    const minRows = params.source === "electric_pm_telemetry" ? [] : minuteByPm.get(pmId) || [];
    const hrRows = params.source === "electric_pm_telemetry_minute" ? [] : hourlyByPm.get(pmId) || [];

    const minResult = analyzeSinglePmSeries(pmId, "electric_pm_telemetry_minute", minRows, detectedAtIso, {
      markInitialRead: true,
      minAnomalyTimestamp: minAnomalyTs
    });
    const hrResult = analyzeSinglePmSeries(pmId, "electric_pm_telemetry", hrRows, detectedAtIso, {
      markInitialRead: true,
      minAnomalyTimestamp: minAnomalyTs
    });

    const pmAnomalies = [...minResult.anomalies, ...hrResult.anomalies].sort((a, b) =>
      b.timestamp.localeCompare(a.timestamp)
    );
    allAnomalies.push(...pmAnomalies);

    const latestMin = params.source === "electric_pm_telemetry" ? undefined : (minRows[minRows.length - 1] ?? latestMinByPm.get(pmId));
    const latestHr = params.source === "electric_pm_telemetry_minute" ? undefined : (hrRows[hrRows.length - 1] ?? latestHrByPm.get(pmId));

    let latestReading: RawPmReading | null = null;
    if (latestMin && latestHr) {
      latestReading = latestMin.t_stamp >= latestHr.t_stamp ? latestMin : latestHr;
    } else {
      latestReading = latestMin ?? latestHr ?? null;
    }

    const meta = resolvePmMeta(pmId, latestReading?.group_id);
    const staleMinutes = latestReading
      ? Math.max(0, Math.round((nowMs - parseWibTimestampMs(latestReading.t_stamp)) / 60_000))
      : null;

    const staleLimit =
      latestReading?.source_table === "electric_pm_telemetry_minute"
        ? STALE_MINUTE_THRESHOLD_MIN
        : STALE_HOURLY_THRESHOLD_MIN;
    const isFresh = staleMinutes !== null && staleMinutes <= staleLimit;
    const isOnline = Boolean(latestReading && isFresh && latestReading.status !== false);

    const baseAnnotated = minResult.annotated.length >= 2 ? minResult.annotated : hrResult.annotated;
    const postResetAnnotated = minAnomalyTs
      ? baseAnnotated.filter((r) => r.t_stamp >= minAnomalyTs)
      : baseAnnotated;
    const primaryAnnotated = postResetAnnotated.length >= 2 ? postResetAnnotated : baseAnnotated;
    const energyValues = primaryAnnotated
      .map((r) => r.active_energy)
      .filter((v): v is number => v !== null);

    const minEnergy = energyValues.length > 0 ? Math.min(...energyValues) : null;
    const maxEnergy = energyValues.length > 0 ? Math.max(...energyValues) : null;
    const netDeltaEnergy =
      energyValues.length >= 2
        ? Number((energyValues[energyValues.length - 1] - energyValues[0]).toFixed(2))
        : null;

    const rolloverCount = pmAnomalies.filter((a) => a.type === "ROLLOVER_16BIT").length;
    const dropCount = pmAnomalies.filter(
      (a) =>
        a.type === "ENERGY_DECREASE" ||
        a.type === "ROLLOVER_16BIT" ||
        a.type === "DROP_TO_ZERO" ||
        a.type === "NEGATIVE_ENERGY"
    ).length;
    const reboundCount = pmAnomalies.filter((a) => a.type === "REBOUND_AFTER_DROP").length;
    const spikeCount = pmAnomalies.filter((a) => a.type === "ENERGY_SPIKE").length;
    const stuckCount = pmAnomalies.filter((a) => a.type === "ENERGY_STUCK").length;
    const fluctuationCount = dropCount + reboundCount;
    const latestAnomaly = pmAnomalies[0] ?? null;

    let healthStatus: HealthStatus = "healthy";
    let statusReason = minAnomalyTs
      ? `Aman — belum ada anomali sejak reset (${minAnomalyTs.slice(11)} WIB)`
      : "Akumulasi active energy naik konsisten";

    if (dropCount > 0 || reboundCount > 0) {
      healthStatus = "critical";
      statusReason =
        rolloverCount > 0 && rolloverCount === dropCount
          ? `Rollover register 16-bit 65.535 (${rolloverCount}x naik-turun)`
          : `Terdeteksi ${dropCount}x penurunan / drop active energy${reboundCount > 0 ? ` (${reboundCount}x rebound naik-turun)` : ""}`;
    } else if (!latestReading || (minRows.length === 0 && hrRows.length === 0 && !isFresh)) {
      healthStatus = "offline";
      statusReason = latestReading
        ? `Data terhenti sejak ${latestReading.t_stamp}`
        : "Belum ada data di tabel telemetry";
    } else if (spikeCount > 0 || stuckCount > 0) {
      healthStatus = "warning";
      statusReason =
        spikeCount > 0
          ? `Terdeteksi ${spikeCount}x lonjakan active energy tidak wajar`
          : `Active energy tertahan (${stuckCount}x) saat beban aktif`;
    } else if (!isFresh || latestReading.status === false) {
      healthStatus = "offline";
      statusReason =
        latestReading.status === false
          ? "Status komunikasi PM offline"
          : `Data terakhir ${staleMinutes} menit lalu`;
    }

    pms.push({
      pmId: meta.pmId,
      pmName: meta.name,
      factory: meta.factory,
      area: meta.area,
      groupId: latestReading?.group_id || meta.groupId,
      healthStatus,
      statusReason,
      latestSource: latestReading?.source_table ?? null,
      lastTimestamp: latestReading?.t_stamp ?? null,
      staleMinutes,
      isOnline,
      latestEnergy: latestReading?.active_energy ?? null,
      latestPowerKw: latestReading?.active_power_total ?? null,
      latestVoltLl: latestReading?.volt_ll ?? null,
      latestPowerFactor: latestReading?.power_factor ?? null,
      minEnergy,
      maxEnergy,
      netDeltaEnergy,
      sampleCountMinute: minRows.length,
      sampleCountHourly: hrRows.length,
      dropCount,
      reboundCount,
      fluctuationCount,
      spikeCount,
      stuckCount,
      totalAnomalies: pmAnomalies.length,
      lastAnomalyAt: latestAnomaly?.timestamp ?? null,
      lastAnomalyType: latestAnomaly?.type ?? null,
      lastAnomalyDelta: latestAnomaly?.deltaEnergy ?? null,
      sparkline: buildSparkline(primaryAnnotated)
    });
  }

  const severityOrder: Record<HealthStatus, number> = {
    critical: 0,
    warning: 1,
    offline: 2,
    healthy: 3
  };
  pms.sort((a, b) => {
    if (severityOrder[a.healthStatus] !== severityOrder[b.healthStatus]) {
      return severityOrder[a.healthStatus] - severityOrder[b.healthStatus];
    }
    if (b.dropCount !== a.dropCount) return b.dropCount - a.dropCount;
    return a.pmId.localeCompare(b.pmId);
  });

  return { pms, anomalies: allAnomalies };
}
