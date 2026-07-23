import { getPostgresPool } from "../../database/postgres";
import type { AlarmAckInput, AlarmEventInput } from "./alarms.validation";

export type AlarmSeverity = "low" | "medium" | "high" | "critical";

type ActiveQuery = {
  severity?: AlarmSeverity;
  limit: number;
};

type HistoryQuery = {
  alarmKey?: string;
  tagId?: string;
  from?: Date;
  to?: Date;
  limit: number;
};

export type AlarmEventDoc = {
  alarmKey: string;
  tagId: string;
  deviceId?: string;
  unit?: string;
  area?: string;
  message: string;
  severity: AlarmSeverity;
  eventType: "active" | "ack" | "clear";
  ts: Date;
  ack?: { userId?: string; note?: string; ts: Date };
  source: string;
};

const createError = (message: string, statusCode: number) => {
  const error = new Error(message) as Error & { statusCode?: number };
  error.statusCode = statusCode;
  return error;
};

export const ingestAlarmEvents = async (events: AlarmEventInput[]) => {
  const pool = getPostgresPool();
  let inserted = 0;

  for (const event of events) {
    const ts = event.ts ?? new Date();
    if (event.status === "cleared") {
      // Find active or ack alarm with this alarmKey and resolve it
      const activeAlarm = await pool.query(
        "SELECT id, t_stamp FROM alarms WHERE alarm_key = $1 AND status IN ('Active', 'Pending Approval') ORDER BY t_stamp DESC LIMIT 1",
        [event.alarmKey]
      );
      if (activeAlarm.rows.length > 0) {
        const id = activeAlarm.rows[0].id;
        const triggerTime = new Date(activeAlarm.rows[0].t_stamp);
        const clearedTime = new Date(ts);
        
        // Calculate duration RTN (HH:MM:SS)
        const diffMs = clearedTime.getTime() - triggerTime.getTime();
        const diffSecs = Math.max(0, Math.floor(diffMs / 1000));
        const hours = Math.floor(diffSecs / 3600);
        const minutes = Math.floor((diffSecs % 3600) / 60);
        const seconds = diffSecs % 60;
        const rtn = `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;

        await pool.query(
          `UPDATE alarms 
           SET status = 'Resolved', cleared_at = $1, rtn = $2
           WHERE id = $3`,
          [clearedTime, rtn, id]
        );
      }
    } else {
      // It's active! Check if there is already an active alarm for this key
      const activeAlarm = await pool.query(
        "SELECT id FROM alarms WHERE alarm_key = $1 AND status IN ('Active', 'Pending Approval')",
        [event.alarmKey]
      );
      if (activeAlarm.rows.length === 0) {
        let defaultUnit = "cooling-water-1";
        if (event.tagId.startsWith("boiler/")) defaultUnit = "boiler-3w1";
        else if (event.tagId.startsWith("compressor/")) defaultUnit = "ale-30";
        else if (event.tagId.startsWith("hvac/")) defaultUnit = "qc-lab";

        // Insert new active alarm
        await pool.query(
          `INSERT INTO alarms (t_stamp, alarm_key, tag_id, device_id, unit_id, area, message, severity, status)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'Active')`,
          [
            ts,
            event.alarmKey,
            event.tagId,
            event.deviceId || "plc-sim",
            event.unit || defaultUnit,
            event.area || "Utilities",
            event.message,
            event.severity
          ]
        );
        inserted++;
      }
    }
  }

  const eventDocs: AlarmEventDoc[] = events.map((event) => {
    const ts = event.ts ?? new Date();
    let defaultUnit = "cooling-water-1";
    if (event.tagId.startsWith("boiler/")) defaultUnit = "boiler-3w1";
    else if (event.tagId.startsWith("compressor/")) defaultUnit = "ale-30";
    else if (event.tagId.startsWith("hvac/")) defaultUnit = "qc-lab";

    return {
      alarmKey: event.alarmKey,
      tagId: event.tagId,
      deviceId: event.deviceId,
      unit: event.unit || defaultUnit,
      area: event.area,
      message: event.message,
      severity: event.severity,
      eventType: event.status === "cleared" ? "clear" : event.status === "ack" ? "ack" : "active",
      ts,
      ack: event.ack ? { userId: event.ack.userId, note: event.ack.note, ts } : undefined,
      source: (event as any).source ?? "system"
    };
  });

  return { inserted, events: eventDocs };
};

export const getActiveAlarms = async (query: ActiveQuery & { unit?: string }) => {
  const pool = getPostgresPool();
  let sql = "SELECT id, t_stamp, alarm_key, tag_id, device_id, unit_id, area, message, severity, status, operator_name, operator_action, approver, rtn, cleared_at FROM alarms WHERE status IN ('Active', 'Pending Approval')";
  let params: any[] = [];
  
  if (query.severity) {
    params.push(query.severity);
    sql += ` AND severity = $${params.length}`;
  }
  
  if (query.unit) {
    if (query.unit.startsWith("cooling-water") || query.unit.startsWith("cooling-tower")) {
      sql += ` AND (unit_id LIKE 'cooling-water%' OR unit_id LIKE 'cooling-tower%')`;
    } else {
      params.push(query.unit);
      sql += ` AND unit_id = $${params.length}`;
    }
  }
  
  sql += " ORDER BY t_stamp DESC LIMIT $1";
  params.push(query.limit || 200);
  sql = sql.replace("LIMIT $1", `LIMIT $${params.length}`);

  const res = await pool.query(sql, params);
  return res.rows.map((row) => ({
    id: String(row.id),
    alarmKey: row.alarm_key,
    tagId: row.tag_id,
    deviceId: row.device_id,
    unit: row.unit_id,
    area: row.area,
    message: row.message,
    severity: row.severity,
    status: row.status,
    lastTs: row.t_stamp.toISOString(),
    operatorName: row.operator_name,
    operatorAction: row.operator_action,
    approverName: row.approver,
    rtn: row.rtn || "—",
    clearedAt: row.cleared_at ? row.cleared_at.toISOString() : null
  }));
};

export const getAlarmHistory = async (query: HistoryQuery & { unit?: string }) => {
  const pool = getPostgresPool();
  let sql = "SELECT id, t_stamp, alarm_key, tag_id, device_id, unit_id, area, message, severity, status, operator_name, operator_action, approver, rtn, cleared_at FROM alarms WHERE 1=1";
  let params: any[] = [];

  if (query.alarmKey) {
    params.push(query.alarmKey);
    sql += ` AND alarm_key = $${params.length}`;
  }

  if (query.tagId) {
    params.push(query.tagId);
    sql += ` AND tag_id = $${params.length}`;
  }

  if (query.unit) {
    params.push(query.unit);
    sql += ` AND unit_id = $${params.length}`;
  }

  sql += " ORDER BY t_stamp DESC LIMIT $1";
  params.push(query.limit || 200);
  sql = sql.replace("LIMIT $1", `LIMIT $${params.length}`);

  const res = await pool.query(sql, params);
  return res.rows.map((row) => ({
    id: String(row.id),
    alarmKey: row.alarm_key,
    tagId: row.tag_id,
    deviceId: row.device_id,
    unit: row.unit_id,
    area: row.area,
    message: row.message,
    severity: row.severity,
    status: row.status,
    lastTs: row.t_stamp.toISOString(),
    operatorName: row.operator_name,
    operatorAction: row.operator_action,
    approverName: row.approver,
    rtn: row.rtn || "—",
    clearedAt: row.cleared_at ? row.cleared_at.toISOString() : null
  }));
};

export const fixAlarmPostgres = async (id: number, operatorName: string, operatorAction: string) => {
  const pool = getPostgresPool();
  await pool.query(
    `UPDATE alarms 
     SET status = 'Pending Approval', operator_name = $1, operator_action = $2
     WHERE id = $3`,
    [operatorName, operatorAction, id]
  );
  
  const result = await pool.query("SELECT * FROM alarms WHERE id = $1", [id]);
  if (result.rows.length === 0) {
    throw createError("Alarm not found", 404);
  }
  return result.rows[0];
};

export const approveAlarmPostgres = async (id: number, approverName: string) => {
  const pool = getPostgresPool();
  const now = new Date();
  
  const alarmRes = await pool.query("SELECT t_stamp FROM alarms WHERE id = $1", [id]);
  if (alarmRes.rows.length === 0) {
    throw createError("Alarm not found", 404);
  }
  
  const triggerTime = new Date(alarmRes.rows[0].t_stamp);
  const diffMs = now.getTime() - triggerTime.getTime();
  const diffSecs = Math.max(0, Math.floor(diffMs / 1000));
  const hours = Math.floor(diffSecs / 3600);
  const minutes = Math.floor((diffSecs % 3600) / 60);
  const seconds = diffSecs % 60;
  const rtn = `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;

  await pool.query(
    `UPDATE alarms 
     SET status = 'Resolved', approver = $1, rtn = $2, cleared_at = COALESCE(cleared_at, $3)
     WHERE id = $4`,
    [approverName, rtn, now, id]
  );
  
  const result = await pool.query("SELECT * FROM alarms WHERE id = $1", [id]);
  return result.rows[0];
};

export const ackAlarm = async (input: AlarmAckInput) => {
  // Legacy MongoDB fallback
  throw createError("MongoDB ackAlarm deprecated. Use fixAlarmPostgres or approveAlarmPostgres instead.", 400);
};
