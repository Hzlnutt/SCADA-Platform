import { Pool } from "pg";
import { env } from "../../config/env.config";
import { logger } from "../../config/logger.config";
import type { RawPmReading, SourceTable } from "./pm-health.types";

const ALLOWED_TABLES: ReadonlySet<SourceTable> = new Set([
  "electric_pm_telemetry",
  "electric_pm_telemetry_minute"
]);

let readOnlyPool: Pool | null = null;

/**
 * Dedicated small PostgreSQL pool enforced strictly READ-ONLY at the PostgreSQL engine level
 * so PM Health monitoring is completely isolated from SCADA's primary telemetry pool and can
 * never execute any write or schema modification.
 */
function getPmHealthReadOnlyPool(): Pool {
  if (!readOnlyPool) {
    readOnlyPool = new Pool({
      host: env.postgresHost,
      port: env.postgresPort,
      user: env.postgresUser,
      password: env.postgresPassword,
      database: env.postgresDb,
      max: 4,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 6000,
      options: "-c default_transaction_read_only=on -c statement_timeout=15000"
    });

    readOnlyPool.on("error", (err) => {
      logger.warn({ err: err.message }, "[PM-Health] Idle read-only pool warning");
    });
  }
  return readOnlyPool;
}

async function queryReadOnly<T = any>(sql: string, params: any[] = []): Promise<T[]> {
  const normalized = sql.trim().toUpperCase();
  if (!normalized.startsWith("SELECT") && !normalized.startsWith("WITH") && !normalized.startsWith("SHOW")) {
    throw new Error("Blocked non-read-only SQL statement in pm-health module.");
  }
  const res = await getPmHealthReadOnlyPool().query(sql, params);
  return res.rows as T[];
}

function toNum(v: unknown): number | null {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function mapRawRow(row: any, table: SourceTable): RawPmReading {
  return {
    id: Number(row.id),
    t_stamp: String(row.t_stamp || ""),
    group_id: String(row.group_id || ""),
    pm_id: String(row.pm_id || "").trim().toUpperCase(),
    status: row.status === null || row.status === undefined ? null : Boolean(row.status),
    volt_ll: toNum(row.volt_ll),
    current_a: toNum(row.current_a),
    current_b: toNum(row.current_b),
    current_c: toNum(row.current_c),
    active_power_total: toNum(row.active_power_total),
    power_factor: toNum(row.power_factor),
    frequency: toNum(row.frequency),
    active_energy: toNum(row.active_energy),
    source_table: table
  };
}

export async function testPmHealthDbConnection(): Promise<{
  connected: boolean;
  readOnlyEnforced: boolean;
  host: string;
  database: string;
  hourlyLatest: string | null;
  minuteLatest: string | null;
  distinctPmCount: number;
  error?: string;
}> {
  try {
    const [roRows, hourlyRows, minuteRows, pmRows] = await Promise.all([
      queryReadOnly<{ transaction_read_only: string }>("SHOW transaction_read_only"),
      queryReadOnly<{ latest: string | null }>(
        "SELECT to_char(MAX(t_stamp), 'YYYY-MM-DD HH24:MI:SS') AS latest FROM electric_pm_telemetry"
      ),
      queryReadOnly<{ latest: string | null }>(
        "SELECT to_char(MAX(t_stamp), 'YYYY-MM-DD HH24:MI:SS') AS latest FROM electric_pm_telemetry_minute"
      ),
      queryReadOnly<{ cnt: string }>(
        `SELECT COUNT(DISTINCT UPPER(pm_id))::text AS cnt FROM (
           SELECT pm_id FROM electric_pm_telemetry WHERE t_stamp >= NOW() - INTERVAL '7 days'
           UNION
           SELECT pm_id FROM electric_pm_telemetry_minute WHERE t_stamp >= NOW() - INTERVAL '7 days'
         ) u`
      )
    ]);

    return {
      connected: true,
      readOnlyEnforced: roRows[0]?.transaction_read_only === "on",
      host: env.postgresHost,
      database: env.postgresDb,
      hourlyLatest: hourlyRows[0]?.latest || null,
      minuteLatest: minuteRows[0]?.latest || null,
      distinctPmCount: Number(pmRows[0]?.cnt || 0)
    };
  } catch (err: any) {
    return {
      connected: false,
      readOnlyEnforced: true,
      host: env.postgresHost,
      database: env.postgresDb,
      hourlyLatest: null,
      minuteLatest: null,
      distinctPmCount: 0,
      error: err?.message || "Database connection failed"
    };
  }
}

export async function fetchRawPmReadings(params: {
  table: SourceTable;
  startTimestamp: string;
  endTimestamp: string;
  pmId?: string;
  limit?: number;
}): Promise<RawPmReading[]> {
  if (!ALLOWED_TABLES.has(params.table)) {
    throw new Error(`Invalid telemetry table: ${params.table}`);
  }

  const sqlParams: any[] = [params.startTimestamp, params.endTimestamp];
  let pmClause = "";
  if (params.pmId) {
    sqlParams.push(params.pmId.trim().toUpperCase());
    pmClause = "AND UPPER(pm_id) = $3";
  }
  const limitClause =
    params.limit && params.limit > 0
      ? `LIMIT ${Math.min(Math.floor(params.limit), 100000)}`
      : "";

  const sql = `
    SELECT
      id,
      to_char(t_stamp, 'YYYY-MM-DD HH24:MI:SS') AS t_stamp,
      group_id,
      pm_id,
      status,
      volt_ll,
      current_a,
      current_b,
      current_c,
      active_power_total,
      power_factor,
      frequency,
      active_energy
    FROM ${params.table}
    WHERE t_stamp >= $1::timestamp
      AND t_stamp <= $2::timestamp
      ${pmClause}
    ORDER BY UPPER(pm_id) ASC, t_stamp ASC, id ASC
    ${limitClause}
  `;

  const rows = await queryReadOnly(sql, sqlParams);
  return rows.map((r) => mapRawRow(r, params.table));
}

export async function fetchLatestReadingPerPm(table: SourceTable): Promise<RawPmReading[]> {
  if (!ALLOWED_TABLES.has(table)) {
    throw new Error(`Invalid telemetry table: ${table}`);
  }
  const sql = `
    SELECT DISTINCT ON (UPPER(pm_id))
      id,
      to_char(t_stamp, 'YYYY-MM-DD HH24:MI:SS') AS t_stamp,
      group_id,
      pm_id,
      status,
      volt_ll,
      current_a,
      current_b,
      current_c,
      active_power_total,
      power_factor,
      frequency,
      active_energy
    FROM ${table}
    ORDER BY UPPER(pm_id), t_stamp DESC, id DESC
  `;
  const rows = await queryReadOnly(sql);
  return rows.map((r) => mapRawRow(r, table));
}
