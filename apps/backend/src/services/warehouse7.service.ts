import { getPostgresPool } from "../database/postgres";
import { logger } from "../config/logger.config";
import { getSocketServer } from "./socket.manager";
import { ingestAlarmEvents } from "../modules/alarms/alarms.service";
import { publishAlarmEvents } from "./alarms.publisher";
import { getSyncedNow, getWibDateTime } from "../core/scheduler";

export const WAREHOUSE7_UNIT_ID = "hvac-wh-7";
const CONFIG_KEY = "warehouse_wh7_config";

export const WH7_ALLOWED_EDIT_ROLES = [
  "admin",
  "superadmin",
  "developer",
  "dev",
  "senior_unit_head",
  "unit_head_utility",
  "unit_head_hvac"
];

export interface Warehouse7Config {
  baseUrl: string;
  authMode: "api_key" | "login";
  apiKey: string;
  username: string;
  password: string;
  idWh: number | null;
  nmGudang: string;
  minTemp: number;
  maxTemp: number;
  pollIntervalMs: number;
}

export interface Warehouse7DeviceSnapshot {
  deviceId: string;
  idWh: number | null;
  nmGudang: string;
  nmBaris: string;
  noRaking: number | null;
  noComp: number | null;
  shortLocation: string;
  fullLocation: string;
  sensorTag: string;
  suhu: number | null;
  humi: number | null;
  baterai: number | null;
  lastSeen: string | null;
  isOnline: boolean;
  status: "normal" | "warning" | "critical" | "offline";
  breachType: "high" | "low" | null;
}

export interface Warehouse7ActiveAlarm {
  alarmKey: string;
  deviceId: string;
  location: string;
  sensorTag: string;
  suhu: number;
  threshold: number;
  direction: "high" | "low";
  severity: "high" | "critical";
  message: string;
  ts: string;
}

export interface Warehouse7OverviewState {
  unitId: string;
  configured: boolean;
  connected: boolean;
  connectionError: string | null;
  lastPollAt: string | null;
  avgTemp: number | null;
  avgHumi: number | null;
  deltaFromPrevious: number | null;
  onlineCount: number;
  totalDevices: number;
  limits: {
    minTemp: number;
    maxTemp: number;
  };
  devices: Warehouse7DeviceSnapshot[];
  activeAlarms: Warehouse7ActiveAlarm[];
}

const DEFAULT_CONFIG: Warehouse7Config = {
  baseUrl: process.env.WAREHOUSE_API_URL || "http://172.16.4.122:8002",
  authMode: "api_key",
  apiKey: process.env.WAREHOUSE_API_KEY || "",
  username: process.env.WAREHOUSE_API_USER || "",
  password: process.env.WAREHOUSE_API_PASSWORD || "",
  idWh: process.env.WAREHOUSE_WH7_ID ? Number(process.env.WAREHOUSE_WH7_ID) : null,
  nmGudang: process.env.WAREHOUSE_WH7_NAME || "Gudang 7",
  minTemp: 24,
  maxTemp: 30,
  pollIntervalMs: 1000
};

let cachedConfig: { cfg: Warehouse7Config; fetchedAt: number } | null = null;
let sessionCookie: string | null = null;
let sessionCookieExpiresAt = 0;
let sessionUserMeta: { idWh: number | null; fullName: string; roles: string[] } | null = null;
let pollingTimer: NodeJS.Timeout | null = null;
let isPollInFlight = false;
let lastDbHourlyKeyByDevice = new Map<string, string>();
let lastBackoffErrorAt = 0;
const lastChartSyncAtByRange = new Map<string, number>();
const inFlightChartSyncByRange = new Map<string, Promise<number>>();

let liveState: Warehouse7OverviewState = {
  unitId: WAREHOUSE7_UNIT_ID,
  configured: Boolean(DEFAULT_CONFIG.apiKey || (DEFAULT_CONFIG.username && DEFAULT_CONFIG.password)),
  connected: false,
  connectionError: null,
  lastPollAt: null,
  avgTemp: null,
  avgHumi: null,
  deltaFromPrevious: null,
  onlineCount: 0,
  totalDevices: 0,
  limits: {
    minTemp: DEFAULT_CONFIG.minTemp,
    maxTemp: DEFAULT_CONFIG.maxTemp
  },
  devices: [],
  activeAlarms: []
};

export function invalidateWarehouse7ConfigCache() {
  cachedConfig = null;
  sessionCookie = null;
  sessionCookieExpiresAt = 0;
  sessionUserMeta = null;
  lastChartSyncAtByRange.clear();
}

export async function getWarehouse7Config(): Promise<Warehouse7Config> {
  const now = Date.now();
  if (cachedConfig && now - cachedConfig.fetchedAt < 10000) {
    return cachedConfig.cfg;
  }
  const pool = getPostgresPool();
  try {
    const res = await pool.query(`SELECT value FROM global_configs WHERE key = $1 LIMIT 1`, [CONFIG_KEY]);
    const dbVal = res.rows[0]?.value && typeof res.rows[0].value === "object" ? res.rows[0].value : {};
    const merged: Warehouse7Config = {
      baseUrl: String(dbVal.baseUrl || DEFAULT_CONFIG.baseUrl).replace(/\/+$/, ""),
      authMode: dbVal.authMode === "login" ? "login" : "api_key",
      apiKey: typeof dbVal.apiKey === "string" ? dbVal.apiKey : DEFAULT_CONFIG.apiKey,
      username: typeof dbVal.username === "string" ? dbVal.username : DEFAULT_CONFIG.username,
      password: typeof dbVal.password === "string" ? dbVal.password : DEFAULT_CONFIG.password,
      idWh: dbVal.idWh !== undefined && dbVal.idWh !== null && dbVal.idWh !== "" ? Number(dbVal.idWh) : DEFAULT_CONFIG.idWh,
      nmGudang: String(dbVal.nmGudang || DEFAULT_CONFIG.nmGudang),
      minTemp: dbVal.minTemp !== undefined && !isNaN(Number(dbVal.minTemp)) ? Number(dbVal.minTemp) : DEFAULT_CONFIG.minTemp,
      maxTemp: dbVal.maxTemp !== undefined && !isNaN(Number(dbVal.maxTemp)) ? Number(dbVal.maxTemp) : DEFAULT_CONFIG.maxTemp,
      pollIntervalMs: Math.max(1000, Number(dbVal.pollIntervalMs || 1000))
    };
    cachedConfig = { cfg: merged, fetchedAt: now };
    liveState.limits = { minTemp: merged.minTemp, maxTemp: merged.maxTemp };
    liveState.configured = Boolean(merged.apiKey || (merged.username && merged.password));
    return merged;
  } catch {
    return DEFAULT_CONFIG;
  }
}

export async function saveWarehouse7Config(partial: Partial<Warehouse7Config>): Promise<Warehouse7Config> {
  const current = await getWarehouse7Config();
  const next: Warehouse7Config = {
    baseUrl: (partial.baseUrl ?? current.baseUrl).trim().replace(/\/+$/, "") || DEFAULT_CONFIG.baseUrl,
    authMode: partial.authMode === "login" ? "login" : partial.authMode === "api_key" ? "api_key" : current.authMode,
    apiKey: partial.apiKey !== undefined ? (partial.apiKey === "__KEEP__" ? current.apiKey : String(partial.apiKey).trim()) : current.apiKey,
    username: partial.username !== undefined ? String(partial.username).trim() : current.username,
    password: partial.password !== undefined ? (partial.password === "__KEEP__" ? current.password : String(partial.password)) : current.password,
    idWh: partial.idWh !== undefined ? (partial.idWh === null || String(partial.idWh).trim() === "" ? null : Number(partial.idWh)) : current.idWh,
    nmGudang: partial.nmGudang !== undefined ? String(partial.nmGudang).trim() : current.nmGudang,
    minTemp: partial.minTemp !== undefined && Number.isFinite(Number(partial.minTemp)) ? Number(partial.minTemp) : current.minTemp,
    maxTemp: partial.maxTemp !== undefined && Number.isFinite(Number(partial.maxTemp)) ? Number(partial.maxTemp) : current.maxTemp,
    pollIntervalMs: Math.max(1000, Number(partial.pollIntervalMs || current.pollIntervalMs || 1000))
  };

  if (next.minTemp >= next.maxTemp) {
    throw new Error("Min Temperature harus lebih kecil daripada Max Temperature.");
  }

  const pool = getPostgresPool();
  await pool.query(
    `INSERT INTO global_configs (key, value, updated_at)
     VALUES ($1, $2::jsonb, CURRENT_TIMESTAMP)
     ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = CURRENT_TIMESTAMP`,
    [CONFIG_KEY, JSON.stringify(next)]
  );
  invalidateWarehouse7ConfigCache();
  liveState.limits = { minTemp: next.minTemp, maxTemp: next.maxTemp };
  liveState.configured = Boolean(next.apiKey || (next.username && next.password));
  liveState.devices = reEvaluateDevicesThresholds(liveState.devices, next.minTemp, next.maxTemp);
  return next;
}

const ALARM_PREF_KEY_PREFIX = "warehouse_wh7_alarm_pref:";

/**
 * Per-account alarm audio/notification preference (defaults to disabled/false).
 */
export async function getWarehouse7AlarmPreference(userId: string): Promise<boolean> {
  const uid = String(userId || "").trim();
  if (!uid) return false;
  try {
    const pool = getPostgresPool();
    const res = await pool.query(`SELECT value FROM global_configs WHERE key = $1 LIMIT 1`, [
      `${ALARM_PREF_KEY_PREFIX}${uid}`
    ]);
    return res.rows[0]?.value?.alarmEnabled === true;
  } catch {
    return false;
  }
}

export async function setWarehouse7AlarmPreference(userId: string, alarmEnabled: boolean): Promise<boolean> {
  const uid = String(userId || "").trim();
  if (!uid) {
    throw new Error("Akun pengguna tidak terdeteksi.");
  }
  const enabled = Boolean(alarmEnabled);
  const pool = getPostgresPool();
  await pool.query(
    `INSERT INTO global_configs (key, value, updated_at)
     VALUES ($1, $2::jsonb, CURRENT_TIMESTAMP)
     ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = CURRENT_TIMESTAMP`,
    [`${ALARM_PREF_KEY_PREFIX}${uid}`, JSON.stringify({ alarmEnabled: enabled })]
  );
  return enabled;
}

async function fetchWithTimeout(url: string, options: RequestInit = {}, timeoutMs = 4500): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

async function ensureLoginCookie(cfg: Warehouse7Config): Promise<string | null> {
  if (!cfg.username || !cfg.password) return null;
  if (sessionCookie && Date.now() < sessionCookieExpiresAt) return sessionCookie;

  const res = await fetchWithTimeout(`${cfg.baseUrl}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({ username: cfg.username, password: cfg.password })
  });
  if (!res.ok) {
    const errText = await res.text().catch(() => "");
    throw new Error(`Login Warehouse API gagal (${res.status}): ${errText.slice(0, 120)}`);
  }

  const anyHeaders = res.headers as any;
  const rawSetCookies: string[] =
    typeof anyHeaders.getSetCookie === "function"
      ? anyHeaders.getSetCookie()
      : res.headers.get("set-cookie")
      ? [res.headers.get("set-cookie")!]
      : [];
  const cookiePairs = rawSetCookies
    .map((c) => String(c).split(";")[0]?.trim())
    .filter(Boolean);

  if (cookiePairs.length > 0) {
    sessionCookie = cookiePairs.join("; ");
    sessionCookieExpiresAt = Date.now() + 25 * 60 * 1000;
  }

  const loginBody: any = await res.json().catch(() => null);
  if (loginBody && typeof loginBody === "object") {
    sessionUserMeta = {
      idWh: loginBody.id_wh !== undefined && loginBody.id_wh !== null ? Number(loginBody.id_wh) : null,
      fullName: String(loginBody.full_name || cfg.username),
      roles: Array.isArray(loginBody.roles) ? loginBody.roles.map(String) : []
    };
  }
  return sessionCookie;
}

async function callWarehouseApi(cfg: Warehouse7Config, path: string): Promise<any> {
  const url = `${cfg.baseUrl}${path.startsWith("/") ? path : `/${path}`}`;
  const headers: Record<string, string> = { Accept: "application/json" };

  if (cfg.authMode === "api_key" && cfg.apiKey) {
    headers["X-Api-Key"] = cfg.apiKey;
  } else if (cfg.authMode === "login" && cfg.username && cfg.password) {
    const cookie = await ensureLoginCookie(cfg);
    if (cookie) headers["Cookie"] = cookie;
  } else if (cfg.apiKey) {
    headers["X-Api-Key"] = cfg.apiKey;
  }

  let res = await fetchWithTimeout(url, { headers });
  if (res.status === 401 && cfg.authMode === "login" && cfg.username && cfg.password) {
    sessionCookie = null;
    sessionCookieExpiresAt = 0;
    const cookie = await ensureLoginCookie(cfg);
    if (cookie) {
      res = await fetchWithTimeout(url, { headers: { ...headers, Cookie: cookie } });
    }
  }
  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    throw new Error(`API ${path} HTTP ${res.status}: ${txt.slice(0, 160)}`);
  }
  return res.json();
}

function normalizeLastSeenIso(rawTs: any): string | null {
  if (!rawTs) return null;
  const s = String(rawTs).trim();
  if (!s) return null;
  // Convert naive WIB timestamp ("YYYY-MM-DD HH:MM:SS") to explicit +07:00 ISO
  if (/^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}:\d{2}$/.test(s)) {
    return `${s.slice(0, 10)}T${s.slice(11, 19)}+07:00`;
  }
  return s;
}

function normalizeHourlyStampStr(rawTs: any): string | null {
  if (!rawTs) return null;
  const s = String(rawTs).trim();
  if (!s) return null;
  if (/^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}(:\d{2})?$/.test(s)) {
    return `${s.slice(0, 10)} ${s.slice(11, 13)}:00:00`;
  }
  const dt = new Date(s);
  if (isNaN(dt.getTime())) return null;
  const w = getWibDateTime(dt);
  return `${w.dateStr} ${String(w.hour).padStart(2, "0")}:00:00`;
}

function shortenLocationLabel(label: string, fallback = "Device"): string {
  const m = /baris\s+([a-z0-9]+).*?rak\s+(\d+).*?(?:comp(?:artement|artment)?\s+(\d+))?/i.exec(label);
  if (m) {
    const baris = m[1];
    const rak = String(Number(m[2])).padStart(2, "0");
    const comp = m[3] ? String(Number(m[3])).padStart(2, "0") : "";
    return [baris, rak, comp].filter(Boolean).join("-");
  }
  return label.trim() || fallback;
}

function formatLocationLabels(raw: any): {
  nmBaris: string;
  noRaking: number | null;
  noComp: number | null;
  shortLocation: string;
  fullLocation: string;
} {
  const nmBaris = String(raw.nm_baris || raw.baris || "").trim();
  const rak = raw.no_raking !== undefined && raw.no_raking !== null ? Number(raw.no_raking) : null;
  const comp = raw.no_compartement !== undefined && raw.no_compartement !== null ? Number(raw.no_compartement) : null;

  if (nmBaris) {
    const rakStr = rak !== null && !isNaN(rak) ? String(rak).padStart(2, "0") : "";
    const compStr = comp !== null && !isNaN(comp) ? String(comp).padStart(2, "0") : "";
    const shortParts = [nmBaris, rakStr, compStr].filter(Boolean);
    const fullParts = [
      `Baris ${nmBaris}`,
      rak !== null && !isNaN(rak) ? `Rak ${rak}` : "",
      comp !== null && !isNaN(comp) ? `Comp ${comp}` : ""
    ].filter(Boolean);
    return {
      nmBaris,
      noRaking: rak,
      noComp: comp,
      shortLocation: String(raw.location_short || "").trim() || shortParts.join("-") || String(raw.location || raw.id_device || "Device"),
      fullLocation: String(raw.location_label || "").trim() || fullParts.join(" · ") || shortParts.join("-")
    };
  }

  const labelRaw = String(raw.location_label || raw.location || raw.lokasi || raw.id_device || "Unknown").trim();
  const shortRaw = String(raw.location_short || "").trim() || shortenLocationLabel(labelRaw, String(raw.id_device || "Unknown"));
  const parsedBaris = /baris\s+([a-z0-9]+)/i.exec(labelRaw)?.[1] || "";
  const parsedRak = /rak\s+(\d+)/i.exec(labelRaw)?.[1];
  const parsedComp = /comp\s+(\d+)/i.exec(labelRaw)?.[1];

  return {
    nmBaris: parsedBaris,
    noRaking: rak ?? (parsedRak ? Number(parsedRak) : null),
    noComp: comp ?? (parsedComp ? Number(parsedComp) : null),
    shortLocation: shortRaw,
    fullLocation: labelRaw
  };
}

function classifyDeviceStatus(
  suhu: number | null,
  isOnline: boolean,
  minTemp: number,
  maxTemp: number
): { status: Warehouse7DeviceSnapshot["status"]; breachType: "high" | "low" | null } {
  if (!isOnline || suhu === null || !Number.isFinite(suhu)) {
    return { status: "offline", breachType: null };
  }
  if (suhu > maxTemp) return { status: "critical", breachType: "high" };
  if (suhu < minTemp) return { status: "critical", breachType: "low" };
  if (suhu >= maxTemp - 0.5 || suhu <= minTemp + 0.5) return { status: "warning", breachType: null };
  return { status: "normal", breachType: null };
}

function reEvaluateDevicesThresholds(
  devices: Warehouse7DeviceSnapshot[],
  minTemp: number,
  maxTemp: number
): Warehouse7DeviceSnapshot[] {
  return devices.map((d) => {
    const cls = classifyDeviceStatus(d.suhu, d.isOnline, minTemp, maxTemp);
    return { ...d, status: cls.status, breachType: cls.breachType };
  });
}

function isMatchingWarehouse7(item: any, cfg: Warehouse7Config, scopedNmGudang?: string): boolean {
  const gudangName = String(item.nm_gudang || item.gudang || scopedNmGudang || "").toLowerCase().trim();
  const target = cfg.nmGudang.toLowerCase().trim();
  if (gudangName) {
    if (gudangName === target) return true;
    // Tolerate "WH-7", "WH 7", "Gudang 7", "Warehouse 7"
    if (target.includes("7") && /(gudang|warehouse|wh)[\s\-_]*7\b/i.test(gudangName)) return true;
    return false;
  }
  if (cfg.idWh !== null && item.id_wh !== undefined && item.id_wh !== null) {
    return Number(item.id_wh) === cfg.idWh;
  }
  return true;
}

function mapRawDevice(raw: any, cfg: Warehouse7Config, metaById?: Map<string, any>): Warehouse7DeviceSnapshot {
  const deviceId = String(raw.id_device || raw.device_id || raw.deviceId || "").trim();
  const meta = metaById?.get(deviceId) || {};
  const merged = { ...meta, ...raw };
  const loc = formatLocationLabels(merged);
  const suhuVal = merged.suhu ?? merged.temp ?? merged.temperature ?? null;
  const suhu = suhuVal !== null && suhuVal !== undefined && !isNaN(Number(suhuVal)) ? Number(Number(suhuVal).toFixed(2)) : null;
  const humiVal = merged.humi ?? merged.humidity ?? null;
  const humi = humiVal !== null && humiVal !== undefined && !isNaN(Number(humiVal)) ? Number(Number(humiVal).toFixed(2)) : null;
  const batVal = merged.baterai ?? merged.battery ?? merged.battery_pct ?? null;
  const baterai = batVal !== null && batVal !== undefined && !isNaN(Number(batVal)) ? Math.round(Number(batVal)) : null;
  const isOnline =
    merged.is_offline !== undefined && merged.is_offline !== null
      ? !Boolean(merged.is_offline)
      : merged.is_online !== undefined && merged.is_online !== null
      ? Boolean(merged.is_online)
      : String(merged.status || "").toLowerCase() !== "offline";
  const lastSeen = normalizeLastSeenIso(merged.last_update || merged.last_seen || merged.recorded_at || merged.t_stamp || null);
  const sensorTag = String(merged.type_name || merged.kode_sensor || merged.sensor_tag || merged.alias || merged.sn_leo || "").trim();
  const cls = classifyDeviceStatus(suhu, isOnline, cfg.minTemp, cfg.maxTemp);

  return {
    deviceId,
    idWh: merged.id_wh !== undefined && merged.id_wh !== null ? Number(merged.id_wh) : cfg.idWh,
    nmGudang: String(merged.nm_gudang || cfg.nmGudang),
    nmBaris: loc.nmBaris,
    noRaking: loc.noRaking,
    noComp: loc.noComp,
    shortLocation: loc.shortLocation,
    fullLocation: loc.fullLocation,
    sensorTag,
    suhu,
    humi,
    baterai,
    lastSeen,
    isOnline,
    status: cls.status,
    breachType: cls.breachType
  };
}

async function persistHourlyWarehouseTelemetry(devices: Warehouse7DeviceSnapshot[], cfg: Warehouse7Config) {
  if (devices.length === 0) return;
  const pool = getPostgresPool();
  const syncedNow = getSyncedNow();
  const wib = getWibDateTime(syncedNow);
  // Hour bucket timestamp: YYYY-MM-DD HH:00:00 WIB
  const hourTsStr = `${wib.dateStr} ${String(wib.hour).padStart(2, "0")}:00:00`;

  for (const dev of devices) {
    if (!dev.deviceId) continue;
    const key = `${dev.deviceId}_${hourTsStr}`;
    // Write once per hour (or update within :00 minute so top-of-hour stays accurate)
    if (lastDbHourlyKeyByDevice.get(dev.deviceId) === key && wib.minute > 0) continue;

    try {
      await pool.query(
        `INSERT INTO warehouse_telemetry (
           unit_id, id_wh, nm_gudang, device_id, device_label, location_label,
           t_stamp, suhu, humi, baterai, is_online, raw_payload
         ) VALUES ($1, $2, $3, $4, $5, $6, $7::timestamp, $8, $9, $10, $11, $12::jsonb)
         ON CONFLICT (unit_id, device_id, t_stamp) DO UPDATE SET
           suhu = COALESCE(EXCLUDED.suhu, warehouse_telemetry.suhu),
           humi = COALESCE(EXCLUDED.humi, warehouse_telemetry.humi),
           baterai = COALESCE(EXCLUDED.baterai, warehouse_telemetry.baterai),
           is_online = EXCLUDED.is_online,
           location_label = COALESCE(NULLIF(EXCLUDED.location_label, ''), warehouse_telemetry.location_label)`,
        [
          WAREHOUSE7_UNIT_ID,
          dev.idWh ?? cfg.idWh,
          dev.nmGudang || cfg.nmGudang,
          dev.deviceId,
          dev.sensorTag ? `${dev.shortLocation} (${dev.deviceId} - ${dev.sensorTag})` : `${dev.shortLocation} (${dev.deviceId})`,
          dev.fullLocation,
          hourTsStr,
          dev.suhu,
          dev.humi,
          dev.baterai,
          dev.isOnline,
          JSON.stringify(dev)
        ]
      );
      lastDbHourlyKeyByDevice.set(dev.deviceId, key);
    } catch (err: any) {
      logger.warn({ err: err.message, deviceId: dev.deviceId }, "Failed to persist warehouse hourly telemetry");
    }
  }
}

async function syncWarehouseAlarms(devices: Warehouse7DeviceSnapshot[], cfg: Warehouse7Config) {
  const nowIso = new Date().toISOString();
  const activeAlarms: Warehouse7ActiveAlarm[] = [];
  const alarmEventsToIngest: any[] = [];

  for (const dev of devices) {
    const highKey = `wh7:temp:${dev.deviceId}:high`;
    const lowKey = `wh7:temp:${dev.deviceId}:low`;

    if (dev.isOnline && dev.suhu !== null) {
      if (dev.suhu > cfg.maxTemp) {
        const msg = `Suhu Warehouse 7 (${dev.shortLocation} / #${dev.deviceId}) mencapai ${dev.suhu.toFixed(1)}°C, melebihi batas maksimum ${cfg.maxTemp}°C`;
        activeAlarms.push({
          alarmKey: highKey,
          deviceId: dev.deviceId,
          location: dev.fullLocation,
          sensorTag: dev.sensorTag,
          suhu: dev.suhu,
          threshold: cfg.maxTemp,
          direction: "high",
          severity: "critical",
          message: msg,
          ts: nowIso
        });
        alarmEventsToIngest.push({
          alarmKey: highKey,
          tagId: `warehouse7/${dev.deviceId}/suhu`,
          deviceId: dev.deviceId,
          unit: WAREHOUSE7_UNIT_ID,
          area: "HVAC Warehouse",
          message: msg,
          severity: "critical",
          status: "active"
        });
      } else {
        alarmEventsToIngest.push({
          alarmKey: highKey,
          tagId: `warehouse7/${dev.deviceId}/suhu`,
          deviceId: dev.deviceId,
          unit: WAREHOUSE7_UNIT_ID,
          area: "HVAC Warehouse",
          message: `Suhu #${dev.deviceId} kembali di bawah batas maksimum ${cfg.maxTemp}°C`,
          severity: "critical",
          status: "cleared"
        });
      }

      if (dev.suhu < cfg.minTemp) {
        const msg = `Suhu Warehouse 7 (${dev.shortLocation} / #${dev.deviceId}) turun hingga ${dev.suhu.toFixed(1)}°C, di bawah batas minimum ${cfg.minTemp}°C`;
        activeAlarms.push({
          alarmKey: lowKey,
          deviceId: dev.deviceId,
          location: dev.fullLocation,
          sensorTag: dev.sensorTag,
          suhu: dev.suhu,
          threshold: cfg.minTemp,
          direction: "low",
          severity: "high",
          message: msg,
          ts: nowIso
        });
        alarmEventsToIngest.push({
          alarmKey: lowKey,
          tagId: `warehouse7/${dev.deviceId}/suhu`,
          deviceId: dev.deviceId,
          unit: WAREHOUSE7_UNIT_ID,
          area: "HVAC Warehouse",
          message: msg,
          severity: "high",
          status: "active"
        });
      } else {
        alarmEventsToIngest.push({
          alarmKey: lowKey,
          tagId: `warehouse7/${dev.deviceId}/suhu`,
          deviceId: dev.deviceId,
          unit: WAREHOUSE7_UNIT_ID,
          area: "HVAC Warehouse",
          message: `Suhu #${dev.deviceId} kembali di atas batas minimum ${cfg.minTemp}°C`,
          severity: "high",
          status: "cleared"
        });
      }
    }
  }

  liveState.activeAlarms = activeAlarms;

  if (alarmEventsToIngest.length > 0) {
    try {
      const res = await ingestAlarmEvents(alarmEventsToIngest);
      if (res.events.length > 0) {
        publishAlarmEvents(res.events);
      }
    } catch (err: any) {
      logger.warn({ err: err.message }, "Failed to ingest Warehouse 7 threshold alarms");
    }
  }

  const io = getSocketServer();
  if (io && activeAlarms.length > 0) {
    io.emit("warehouse:wh7_alarm", {
      unitId: WAREHOUSE7_UNIT_ID,
      alarms: activeAlarms,
      limits: { minTemp: cfg.minTemp, maxTemp: cfg.maxTemp }
    });
  }
}

interface HourlyTelemetryPointInput {
  idWh: number | null;
  nmGudang: string;
  deviceId: string;
  deviceLabel: string;
  locationLabel: string;
  tStampStr: string;
  suhu: number;
  humi: number | null;
  baterai: number | null;
  isOnline: boolean | null;
}

async function upsertWarehouseTelemetryPoints(items: HourlyTelemetryPointInput[]): Promise<number> {
  if (items.length === 0) return 0;
  const dedup = new Map<string, HourlyTelemetryPointInput>();
  for (const item of items) {
    if (!item.deviceId || !item.tStampStr) continue;
    dedup.set(`${item.deviceId}_${item.tStampStr}`, item);
  }
  const uniqueRows = Array.from(dedup.values());
  if (uniqueRows.length === 0) return 0;

  const pool = getPostgresPool();
  const chunkSize = 250;
  let inserted = 0;

  for (let i = 0; i < uniqueRows.length; i += chunkSize) {
    const chunk = uniqueRows.slice(i, i + chunkSize);
    const valuesSql: string[] = [];
    const params: any[] = [];
    let p = 1;

    for (const r of chunk) {
      valuesSql.push(
        `($${p++}, $${p++}, $${p++}, $${p++}, $${p++}, $${p++}, $${p++}::timestamp, $${p++}, $${p++}, $${p++}, $${p++}, $${p++}::jsonb)`
      );
      params.push(
        WAREHOUSE7_UNIT_ID,
        r.idWh,
        r.nmGudang,
        r.deviceId,
        r.deviceLabel,
        r.locationLabel,
        r.tStampStr,
        r.suhu,
        r.humi,
        r.baterai,
        r.isOnline,
        JSON.stringify({ source: "chart_sync" })
      );
    }

    await pool.query(
      `INSERT INTO warehouse_telemetry (
         unit_id, id_wh, nm_gudang, device_id, device_label, location_label,
         t_stamp, suhu, humi, baterai, is_online, raw_payload
       ) VALUES ${valuesSql.join(", ")}
       ON CONFLICT (unit_id, device_id, t_stamp) DO UPDATE SET
         id_wh = COALESCE(EXCLUDED.id_wh, warehouse_telemetry.id_wh),
         device_label = COALESCE(NULLIF(EXCLUDED.device_label, ''), warehouse_telemetry.device_label),
         location_label = COALESCE(NULLIF(EXCLUDED.location_label, ''), warehouse_telemetry.location_label),
         suhu = COALESCE(EXCLUDED.suhu, warehouse_telemetry.suhu),
         humi = COALESCE(EXCLUDED.humi, warehouse_telemetry.humi),
         baterai = COALESCE(EXCLUDED.baterai, warehouse_telemetry.baterai),
         is_online = COALESCE(EXCLUDED.is_online, warehouse_telemetry.is_online)`,
      params
    );
    inserted += chunk.length;
  }

  return inserted;
}

async function syncOperatorChartToDb(
  cfg: Warehouse7Config,
  timeRange: "1_day" | "7_days" | "1_month",
  knownDevices?: Warehouse7DeviceSnapshot[]
): Promise<number> {
  if (cfg.authMode !== "login" || !cfg.username || !cfg.password) return 0;
  const inflight = inFlightChartSyncByRange.get(timeRange);
  if (inflight) return inflight;

  const task = (async () => {
    try {
      const res = await callWarehouseApi(
        cfg,
        `/api/dashboard/operator/chart?lokasi=all&time_range=${encodeURIComponent(timeRange)}`
      );
      const seriesArr = Array.isArray(res?.chart_data) ? res.chart_data : [];
      const detectedGudang = String(res?.nm_gudang || cfg.nmGudang || "Gudang 7");
      const devList = knownDevices && knownDevices.length > 0 ? knownDevices : liveState.devices;
      const toUpsert: HourlyTelemetryPointInput[] = [];

      for (const s of seriesArr) {
        const deviceId = String(s?.id_device || "").trim();
        if (!deviceId) continue;
        const compIdWh = s?.id_wh !== undefined && s?.id_wh !== null ? Number(s.id_wh) : null;
        const fullLoc = String(s?.location_label || "").trim() || deviceId;
        const liveMatch = devList.find((d) => d.deviceId === deviceId);
        const shortLoc = liveMatch?.shortLocation || shortenLocationLabel(fullLoc, deviceId);
        const tag = liveMatch?.sensorTag || "";
        const devLabel = tag ? `${shortLoc} (${deviceId} - ${tag})` : `${shortLoc} (${deviceId})`;

        const pts = Array.isArray(s?.points) ? s.points : [];
        for (const pt of pts) {
          const suhuNum = pt?.suhu !== null && pt?.suhu !== undefined ? Number(pt.suhu) : NaN;
          const tStampStr = normalizeHourlyStampStr(pt?.t_stamp);
          if (!Number.isFinite(suhuNum) || !tStampStr) continue;
          const humiNum =
            pt?.humi !== null && pt?.humi !== undefined && Number.isFinite(Number(pt.humi))
              ? Number(pt.humi)
              : null;
          toUpsert.push({
            idWh: compIdWh,
            nmGudang: detectedGudang,
            deviceId,
            deviceLabel: devLabel,
            locationLabel: fullLoc,
            tStampStr,
            suhu: Number(suhuNum.toFixed(2)),
            humi: humiNum !== null ? Number(humiNum.toFixed(2)) : null,
            baterai: null,
            isOnline: true
          });
        }
      }

      const count = await upsertWarehouseTelemetryPoints(toUpsert);
      lastChartSyncAtByRange.set(timeRange, Date.now());
      return count;
    } catch (err: any) {
      logger.warn({ err: err.message, timeRange }, "Warehouse 7 operator chart sync skipped");
      return 0;
    } finally {
      inFlightChartSyncByRange.delete(timeRange);
    }
  })();

  inFlightChartSyncByRange.set(timeRange, task);
  return task;
}

async function syncStatsChartCustomToDb(
  cfg: Warehouse7Config,
  startStr: string,
  endStr: string,
  knownDevices?: Warehouse7DeviceSnapshot[]
): Promise<number> {
  if (cfg.authMode !== "login" || !cfg.username || !cfg.password) return 0;
  const pool = getPostgresPool();
  const compIds = new Set<number>();
  const devList = knownDevices && knownDevices.length > 0 ? knownDevices : liveState.devices;
  for (const d of devList) {
    if (d.idWh && d.idWh > 1) compIds.add(d.idWh);
  }
  if (compIds.size === 0) {
    const dbComps = await pool
      .query(
        `SELECT DISTINCT id_wh FROM warehouse_telemetry WHERE unit_id = $1 AND id_wh IS NOT NULL AND id_wh > 1`,
        [WAREHOUSE7_UNIT_ID]
      )
      .catch(() => ({ rows: [] }));
    for (const r of dbComps.rows) {
      if (r.id_wh) compIds.add(Number(r.id_wh));
    }
  }
  if (compIds.size === 0) return 0;

  const toUpsert: HourlyTelemetryPointInput[] = [];
  for (const compId of compIds) {
    try {
      const res = await callWarehouseApi(
        cfg,
        `/api/sensor/analytics/v2/stats-chart?id_wh=${compId}&filter=custom&start=${encodeURIComponent(startStr)}&end=${encodeURIComponent(endStr)}`
      );
      const chartArr = Array.isArray(res?.chart) ? res.chart : [];
      const devMatch = devList.find((d) => d.idWh === compId);
      const deviceId = String(res?.id_device || devMatch?.deviceId || `COMP-${compId}`);
      const fullLoc = devMatch?.fullLocation || deviceId;
      const shortLoc = devMatch?.shortLocation || shortenLocationLabel(fullLoc, deviceId);
      const devLabel = devMatch?.sensorTag
        ? `${shortLoc} (${deviceId} - ${devMatch.sensorTag})`
        : `${shortLoc} (${deviceId})`;

      for (const pt of chartArr) {
        const rawT = pt?.t_stamp || pt?.time || pt?.recorded_at || pt?.date;
        const rawTemp = pt?.suhu ?? pt?.avg_suhu ?? pt?.temp;
        const suhuNum = rawTemp !== null && rawTemp !== undefined ? Number(rawTemp) : NaN;
        const tStampStr = normalizeHourlyStampStr(rawT);
        if (!Number.isFinite(suhuNum) || !tStampStr) continue;
        const rawH = pt?.humi ?? pt?.avg_humi;
        const humiNum = rawH !== null && rawH !== undefined && Number.isFinite(Number(rawH)) ? Number(rawH) : null;
        toUpsert.push({
          idWh: compId,
          nmGudang: cfg.nmGudang,
          deviceId,
          deviceLabel: devLabel,
          locationLabel: fullLoc,
          tStampStr,
          suhu: Number(suhuNum.toFixed(2)),
          humi: humiNum !== null ? Number(humiNum.toFixed(2)) : null,
          baterai: null,
          isOnline: true
        });
      }
    } catch {
      // Non-fatal fallback
    }
  }
  return upsertWarehouseTelemetryPoints(toUpsert);
}

export async function pollWarehouse7Once(): Promise<Warehouse7OverviewState> {
  if (isPollInFlight) return liveState;
  isPollInFlight = true;

  try {
    const cfg = await getWarehouse7Config();
    const hasAuth = Boolean(
      (cfg.authMode === "api_key" && cfg.apiKey) ||
      (cfg.authMode === "login" && cfg.username && cfg.password) ||
      cfg.apiKey
    );

    if (!hasAuth) {
      liveState = {
        ...liveState,
        configured: false,
        connected: false,
        connectionError: "API Key / Kredensial server Gudang 7 (172.16.4.122:8002) belum dikonfigurasi.",
        limits: { minTemp: cfg.minTemp, maxTemp: cfg.maxTemp }
      };
      return liveState;
    }

    let rawDevices: any[] = [];
    const metaById = new Map<string, any>();
    let avgTemp: number | null = null;
    let avgHumi: number | null = null;
    let deltaFromPrevious: number | null = null;

    if (cfg.authMode === "login" && cfg.username && cfg.password) {
      const [kpiRes, devRes] = await Promise.all([
        callWarehouseApi(cfg, "/api/dashboard/operator/kpi").catch(() => null),
        callWarehouseApi(cfg, "/api/dashboard/operator/devices-status")
      ]);
      const scopedName = String(devRes?.nm_gudang || cfg.nmGudang || "Gudang 7");
      const devList = Array.isArray(devRes) ? devRes : (devRes?.devices || devRes?.data || []);
      rawDevices = devList
        .map((d: any) => (d && !d.nm_gudang ? { ...d, nm_gudang: scopedName } : d))
        .filter((d: any) => isMatchingWarehouse7(d, cfg, scopedName));

      if (kpiRes) {
        const kpiObj = kpiRes.kpi || kpiRes;
        const suhuNode = kpiObj?.suhu;
        const humiNode = kpiObj?.humi;

        if (suhuNode && typeof suhuNode === "object") {
          if (suhuNode.avg_today !== null && suhuNode.avg_today !== undefined) {
            avgTemp = Number(suhuNode.avg_today);
          }
          if (suhuNode.delta && suhuNode.delta.value !== null && suhuNode.delta.value !== undefined) {
            const absDelta = Math.abs(Number(suhuNode.delta.value));
            const dir = String(suhuNode.delta.direction || "").toLowerCase();
            deltaFromPrevious = dir === "down" ? -absDelta : absDelta;
          } else if (
            suhuNode.avg_today !== null &&
            suhuNode.avg_today !== undefined &&
            suhuNode.avg_yesterday !== null &&
            suhuNode.avg_yesterday !== undefined
          ) {
            deltaFromPrevious = Number((Number(suhuNode.avg_today) - Number(suhuNode.avg_yesterday)).toFixed(2));
          }
        } else {
          avgTemp = kpiRes.avg_suhu ?? kpiRes.avg_temp ?? kpiRes.suhu_avg ?? null;
          deltaFromPrevious = kpiRes.temp_delta ?? kpiRes.delta ?? kpiRes.diff_suhu ?? null;
        }

        if (humiNode && typeof humiNode === "object" && humiNode.avg_today !== null && humiNode.avg_today !== undefined) {
          avgHumi = Number(humiNode.avg_today);
        } else if (kpiRes.avg_humi !== undefined) {
          avgHumi = kpiRes.avg_humi;
        }
      }
    } else {
      const whNameEnc = encodeURIComponent(cfg.nmGudang);
      const [whItems, allStatus, latestWh] = await Promise.all([
        callWarehouseApi(cfg, "/api/ext/v1/warehouses").catch(() => []),
        callWarehouseApi(cfg, "/api/ext/v1/devices/status").catch(() => []),
        callWarehouseApi(cfg, `/api/ext/v1/telemetry/latest?nm_gudang=${whNameEnc}`).catch(() => [])
      ]);

      const whMatches = (Array.isArray(whItems) ? whItems : []).filter((w: any) => isMatchingWarehouse7(w, cfg));
      if (cfg.idWh === null && whMatches.length > 0 && whMatches[0].id_wh !== undefined) {
        cfg.idWh = Number(whMatches[0].id_wh);
      }

      const statusList = (Array.isArray(allStatus) ? allStatus : []).filter((d: any) => isMatchingWarehouse7(d, cfg));
      const latestList = Array.isArray(latestWh) ? latestWh : [];
      for (const s of statusList) {
        if (s.id_device) metaById.set(String(s.id_device), s);
      }
      for (const l of latestList) {
        if (l.id_device) metaById.set(String(l.id_device), { ...metaById.get(String(l.id_device)), ...l });
      }
      rawDevices = Array.from(metaById.values());

      if (cfg.idWh !== null) {
        const sum = await callWarehouseApi(cfg, `/api/ext/v1/summary?id_wh=${cfg.idWh}`).catch(() => null);
        if (sum) {
          if (sum.avg_suhu_today !== null && sum.avg_suhu_today !== undefined) {
            avgTemp = Number(sum.avg_suhu_today);
          }
          if (sum.avg_humi_today !== null && sum.avg_humi_today !== undefined) {
            avgHumi = Number(sum.avg_humi_today);
          }
          if (
            sum.suhu_comparison?.avg_today !== null &&
            sum.suhu_comparison?.avg_today !== undefined &&
            sum.suhu_comparison?.avg_yesterday !== null &&
            sum.suhu_comparison?.avg_yesterday !== undefined
          ) {
            deltaFromPrevious = Number((Number(sum.suhu_comparison.avg_today) - Number(sum.suhu_comparison.avg_yesterday)).toFixed(2));
          }
        }
      }
    }

    const devices = rawDevices.map((r) => mapRawDevice(r, cfg, metaById));
    const onlineDevices = devices.filter((d) => d.isOnline);
    const validTemps = devices.filter((d) => d.suhu !== null && (onlineDevices.length === 0 || d.isOnline));
    if (avgTemp === null && validTemps.length > 0) {
      avgTemp = Number((validTemps.reduce((acc, d) => acc + (d.suhu || 0), 0) / validTemps.length).toFixed(2));
    }

    const nowIso = new Date().toISOString();
    liveState = {
      unitId: WAREHOUSE7_UNIT_ID,
      configured: true,
      connected: true,
      connectionError: null,
      lastPollAt: nowIso,
      avgTemp,
      avgHumi,
      deltaFromPrevious,
      onlineCount: onlineDevices.length,
      totalDevices: devices.length,
      limits: { minTemp: cfg.minTemp, maxTemp: cfg.maxTemp },
      devices,
      activeAlarms: liveState.activeAlarms
    };

    await persistHourlyWarehouseTelemetry(devices, cfg);
    await syncWarehouseAlarms(devices, cfg);

    // Background-sync last 30 days of hourly readings from operator chart every 10 minutes
    if (cfg.authMode === "login") {
      const lastSync = lastChartSyncAtByRange.get("1_month") || 0;
      if (Date.now() - lastSync > 10 * 60 * 1000) {
        syncOperatorChartToDb(cfg, "1_month", devices).catch(() => {});
      }
    }

    const io = getSocketServer();
    if (io) {
      io.emit("warehouse:wh7_live", liveState);
    }

    return liveState;
  } catch (err: any) {
    const now = Date.now();
    if (now - lastBackoffErrorAt > 30000) {
      logger.warn({ err: err.message }, "Warehouse 7 live poll error");
      lastBackoffErrorAt = now;
    }
    liveState = {
      ...liveState,
      connected: false,
      connectionError: err.message
    };
    return liveState;
  } finally {
    isPollInFlight = false;
  }
}

export function startWarehouse7Polling() {
  if (pollingTimer) return;
  pollWarehouse7Once().catch(() => {});
  pollingTimer = setInterval(() => {
    pollWarehouse7Once().catch(() => {});
  }, 1000);
  logger.info("Warehouse 7 real-time 1s poller started");
}

export function getWarehouse7LiveOverview(): Promise<Warehouse7OverviewState> {
  return getWarehouse7Config().then((cfg) => {
    liveState.limits = { minTemp: cfg.minTemp, maxTemp: cfg.maxTemp };
    liveState.configured = Boolean(cfg.apiKey || (cfg.username && cfg.password));
    return liveState;
  });
}

export async function testWarehouse7Connection(overrideCfg?: Partial<Warehouse7Config>) {
  const baseCfg = await getWarehouse7Config();
  const cfg: Warehouse7Config = {
    ...baseCfg,
    ...overrideCfg,
    baseUrl: String(overrideCfg?.baseUrl ?? baseCfg.baseUrl).replace(/\/+$/, ""),
    apiKey: overrideCfg?.apiKey === "__KEEP__" ? baseCfg.apiKey : (overrideCfg?.apiKey ?? baseCfg.apiKey),
    password: overrideCfg?.password === "__KEEP__" ? baseCfg.password : (overrideCfg?.password ?? baseCfg.password)
  };

  if (cfg.authMode === "login" && cfg.username && cfg.password) {
    const prevCookie = sessionCookie;
    const prevExp = sessionCookieExpiresAt;
    const prevMeta = sessionUserMeta;
    sessionCookie = null;
    sessionCookieExpiresAt = 0;
    sessionUserMeta = null;

    try {
      await ensureLoginCookie(cfg);
      const detectedUserIdWh = (sessionUserMeta as { idWh?: number | null } | null)?.idWh ?? 1;

      const devRes = await callWarehouseApi(cfg, "/api/dashboard/operator/devices-status");
      const devList = Array.isArray(devRes) ? devRes : (devRes?.devices || devRes?.data || []);
      const detectedName = String(devRes?.nm_gudang || cfg.nmGudang || "Gudang 7");
      const gudangIdsRes = await callWarehouseApi(cfg, "/api/warehouse/gudang-ids").catch(() => null);

      let warehouses: Array<{ id_wh: number; nm_gudang: string }> = Array.isArray(gudangIdsRes) ? gudangIdsRes : [];
      if (warehouses.length === 0) {
        warehouses = [
          {
            id_wh: detectedUserIdWh,
            nm_gudang: detectedName
          }
        ];
      }

      return {
        ok: true,
        mode: "login",
        warehouses,
        devicesCount: devList.length,
        detectedName
      };
    } finally {
      sessionCookie = prevCookie;
      sessionCookieExpiresAt = prevExp;
      sessionUserMeta = prevMeta;
    }
  }

  const warehouses = await callWarehouseApi(cfg, "/api/ext/v1/warehouses");
  const status = await callWarehouseApi(cfg, "/api/ext/v1/devices/status").catch(() => []);
  return {
    ok: true,
    mode: "api_key",
    warehouses: Array.isArray(warehouses) ? warehouses : [],
    devicesCount: Array.isArray(status) ? status.length : 0
  };
}

async function queryWarehouse7DbRows(fromStr: string, toStr: string) {
  const pool = getPostgresPool();
  return pool.query(
    `SELECT
       device_id,
       COALESCE(NULLIF(device_label, ''), device_id) as device_label,
       COALESCE(NULLIF(location_label, ''), device_id) as location_label,
       to_char(t_stamp, 'YYYY-MM-DD"T"HH24:MI:SS"+07:00"') as t_stamp_iso,
       to_char(t_stamp, 'DD Mon HH24:MI') as label,
       suhu::float as suhu,
       humi::float as humi,
       baterai,
       is_online
     FROM warehouse_telemetry
     WHERE unit_id = $1
       AND t_stamp >= $2::timestamp
       AND t_stamp <= $3::timestamp
       AND suhu IS NOT NULL
     ORDER BY t_stamp ASC, device_id ASC`,
    [WAREHOUSE7_UNIT_ID, fromStr, toStr]
  );
}

export async function getWarehouse7Trend(params: {
  filter: "1d" | "7d" | "1m" | "custom";
  start?: string;
  end?: string;
  deviceMode?: string;
}) {
  const cfg = await getWarehouse7Config();
  const syncedNow = getSyncedNow();

  let startMs: number;
  let endMs = syncedNow.getTime();
  if (params.filter === "custom" && params.start && params.end) {
    startMs = new Date(`${params.start}T00:00:00+07:00`).getTime();
    endMs = new Date(`${params.end}T23:59:59+07:00`).getTime();
  } else if (params.filter === "7d") {
    startMs = endMs - 7 * 24 * 3600 * 1000;
  } else if (params.filter === "1m") {
    startMs = endMs - 30 * 24 * 3600 * 1000;
  } else {
    startMs = endMs - 24 * 3600 * 1000;
  }

  const wFrom = getWibDateTime(new Date(startMs));
  const fromStr =
    params.filter === "custom"
      ? wFrom.tStampStr
      : `${wFrom.dateStr} ${String(wFrom.hour).padStart(2, "0")}:00:00`;
  const toStr = getWibDateTime(new Date(endMs)).tStampStr;

  let dbRes = await queryWarehouse7DbRows(fromStr, toStr);

  // Sync missing historical hours cleanly into warehouse_telemetry (primary hourly DB table)
  const hasAuth = Boolean(
    (cfg.authMode === "api_key" && cfg.apiKey) ||
    (cfg.authMode === "login" && cfg.username && cfg.password) ||
    cfg.apiKey
  );

  if (hasAuth && cfg.authMode === "login" && cfg.username && cfg.password) {
    const expectedMinRows = params.filter === "1d" ? 12 : params.filter === "7d" ? 96 : params.filter === "1m" ? 300 : 4;
    if (params.filter !== "custom") {
      const opRange = params.filter === "1d" ? "1_day" : params.filter === "7d" ? "7_days" : "1_month";
      const ageMs = Date.now() - (lastChartSyncAtByRange.get(opRange) || 0);
      if (dbRes.rows.length < expectedMinRows) {
        const upserted = await syncOperatorChartToDb(cfg, opRange);
        if (upserted > 0) dbRes = await queryWarehouse7DbRows(fromStr, toStr);
      } else if (ageMs > 120_000) {
        syncOperatorChartToDb(cfg, opRange).catch(() => {});
      }
    } else if (params.start && params.end) {
      let syncedAny = 0;
      const within30Days = syncedNow.getTime() - startMs <= 31 * 24 * 3600 * 1000;
      if (within30Days && dbRes.rows.length < expectedMinRows) {
        syncedAny += await syncOperatorChartToDb(cfg, "1_month");
        if (syncedAny > 0) dbRes = await queryWarehouse7DbRows(fromStr, toStr);
      }
      if (dbRes.rows.length < expectedMinRows) {
        const customSynced = await syncStatsChartCustomToDb(cfg, params.start, params.end);
        if (customSynced > 0) dbRes = await queryWarehouse7DbRows(fromStr, toStr);
      }
    }
  } else if (hasAuth && cfg.authMode === "api_key" && cfg.apiKey && dbRes.rows.length < (params.filter === "1d" ? 12 : 48)) {
    try {
      const startIso = `${getWibDateTime(new Date(startMs)).dateStr}T${String(getWibDateTime(new Date(startMs)).hour).padStart(2, "0")}:00:00`;
      const endIso = `${getWibDateTime(new Date(endMs)).dateStr}T${String(getWibDateTime(new Date(endMs)).hour).padStart(2, "0")}:59:59`;
      const extRows = await callWarehouseApi(
        cfg,
        `/api/ext/v1/telemetry?nm_gudang=${encodeURIComponent(cfg.nmGudang)}&start=${encodeURIComponent(startIso)}&end=${encodeURIComponent(endIso)}&limit=1000`
      ).catch(() => []);

      if (Array.isArray(extRows) && extRows.length > 0) {
        const toUpsert: HourlyTelemetryPointInput[] = [];
        for (const r of extRows) {
          if (!r?.id_device || r.suhu === null || r.suhu === undefined || !r.recorded_at) continue;
          const hourStr = normalizeHourlyStampStr(r.recorded_at);
          if (!hourStr) continue;
          const devId = String(r.id_device);
          const liveMatch = liveState.devices.find((d) => d.deviceId === devId);
          const devLabel = liveMatch
            ? `${liveMatch.shortLocation} (${devId}${liveMatch.sensorTag ? ` - ${liveMatch.sensorTag}` : ""})`
            : devId;
          toUpsert.push({
            idWh: liveMatch?.idWh ?? (r.id_wh !== undefined ? Number(r.id_wh) : cfg.idWh),
            nmGudang: cfg.nmGudang,
            deviceId: devId,
            deviceLabel: devLabel,
            locationLabel: liveMatch?.fullLocation || devId,
            tStampStr: hourStr,
            suhu: Number(r.suhu),
            humi: r.humi !== null && r.humi !== undefined ? Number(r.humi) : null,
            baterai: r.baterai !== null && r.baterai !== undefined ? Number(r.baterai) : null,
            isOnline: true
          });
        }
        const upserted = await upsertWarehouseTelemetryPoints(toUpsert);
        if (upserted > 0) dbRes = await queryWarehouse7DbRows(fromStr, toStr);
      }
    } catch {
      // Non-fatal fallback
    }
  }

  type Point = { ts: string; label: string; suhu: number; humi: number | null; baterai?: number | null };
  const seriesMap = new Map<string, { deviceId: string; deviceLabel: string; locationLabel: string; points: Point[] }>();
  const hourlyTableRows: Array<{
    t_stamp: string;
    label: string;
    deviceId: string;
    deviceLabel: string;
    locationLabel: string;
    suhu: number;
    humi: number | null;
    baterai: number | null;
    isOnline: boolean | null;
  }> = [];

  for (const row of dbRes.rows) {
    if (!seriesMap.has(row.device_id)) {
      seriesMap.set(row.device_id, {
        deviceId: row.device_id,
        deviceLabel: row.device_label,
        locationLabel: row.location_label,
        points: []
      });
    }
    const suhuNum = Number(row.suhu);
    const humiNum = row.humi !== null ? Number(row.humi) : null;
    const batNum = row.baterai !== null ? Number(row.baterai) : null;
    seriesMap.get(row.device_id)!.points.push({
      ts: row.t_stamp_iso,
      label: row.label,
      suhu: suhuNum,
      humi: humiNum,
      baterai: batNum
    });
    hourlyTableRows.push({
      t_stamp: row.t_stamp_iso,
      label: row.label,
      deviceId: row.device_id,
      deviceLabel: row.device_label,
      locationLabel: row.location_label,
      suhu: suhuNum,
      humi: humiNum,
      baterai: batNum,
      isOnline: row.is_online !== null ? Boolean(row.is_online) : null
    });
  }

  // Sort each device's points chronologically
  for (const s of seriesMap.values()) {
    s.points.sort((a, b) => a.ts.localeCompare(b.ts));
  }
  hourlyTableRows.sort((a, b) => b.t_stamp.localeCompare(a.t_stamp));

  // Build deduplicated sorted timestamp axis across all devices
  const tsSet = new Set<string>();
  const tsLabelMap = new Map<string, string>();
  for (const s of seriesMap.values()) {
    for (const pt of s.points) {
      tsSet.add(pt.ts);
      tsLabelMap.set(pt.ts, pt.label);
    }
  }
  const timestamps = Array.from(tsSet).sort();

  const devicesList = Array.from(seriesMap.values()).sort((a, b) => a.deviceId.localeCompare(b.deviceId));
  const highestPoints = timestamps.map((ts) => {
    let maxVal: number | null = null;
    let sourceLabel = "";
    for (const d of devicesList) {
      const hit = d.points.find((p) => p.ts === ts);
      if (hit && (maxVal === null || hit.suhu > maxVal)) {
        maxVal = hit.suhu;
        sourceLabel = d.deviceLabel;
      }
    }
    return {
      ts,
      label: tsLabelMap.get(ts) || ts,
      suhu: maxVal,
      sourceDevice: sourceLabel
    };
  });

  // Compute summary stats across filtered mode
  const allSuhuValues: number[] = [];
  for (const d of devicesList) {
    if (params.deviceMode && params.deviceMode !== "all" && params.deviceMode !== "highest" && d.deviceId !== params.deviceMode) {
      continue;
    }
    for (const p of d.points) allSuhuValues.push(p.suhu);
  }
  const minSuhu = allSuhuValues.length > 0 ? Math.min(...allSuhuValues) : null;
  const maxSuhu = allSuhuValues.length > 0 ? Math.max(...allSuhuValues) : null;
  const avgSuhu = allSuhuValues.length > 0 ? Number((allSuhuValues.reduce((a, b) => a + b, 0) / allSuhuValues.length).toFixed(2)) : null;

  return {
    unitId: WAREHOUSE7_UNIT_ID,
    filter: params.filter,
    from: fromStr,
    to: toStr,
    limits: { minTemp: cfg.minTemp, maxTemp: cfg.maxTemp },
    timestamps: timestamps.map((ts) => ({ ts, label: tsLabelMap.get(ts) || ts })),
    devices: devicesList,
    highestSeries: highestPoints,
    hourlyRows: hourlyTableRows,
    stats: {
      minTemp: minSuhu,
      avgTemp: avgSuhu,
      maxTemp: maxSuhu,
      exceedCount: allSuhuValues.filter((v) => v > cfg.maxTemp || v < cfg.minTemp).length,
      totalPoints: allSuhuValues.length
    },
    hasData: timestamps.length > 0
  };
}
