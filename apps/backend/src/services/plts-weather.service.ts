import http from "http";
import https from "https";
import { getPostgresPool } from "../database/postgres";
import { logger } from "../config/logger.config";

export const FACTORY_WEATHER_LOCATION = {
  name: "Sidomukti, Pandaan, Pasuruan",
  address: "Jl. Stadion / Jl. Sidomukti No. 1, Sidomukti, Kec. Pandaan, Pasuruan, Jawa Timur 67156",
  lat: -7.6447,
  lon: 112.6939,
  bmkgAdm4: "35.14.11.1011",
};

export type PltsWeatherKey =
  | "clear_day"
  | "clear_night"
  | "mainly_clear"
  | "partly_cloudy"
  | "partly_cloudy_night"
  | "overcast"
  | "fog"
  | "drizzle"
  | "rain_light"
  | "rain_moderate"
  | "rain_heavy"
  | "thunderstorm";

export interface PltsWeatherSegment {
  startMinute: number;
  endMinute: number;
  range: string; // e.g. "09:00–09:24"
  weatherCode: number;
  weatherKey: PltsWeatherKey;
  label: string;
  avgTempC: number | null;
  avgCloudPct: number | null;
  avgRadiationWm2: number | null;
  precipMm: number | null;
  minutesCount: number;
}

export interface PltsHourlyWeatherPoint {
  date: string; // YYYY-MM-DD
  hour: number; // 0..23
  dominantWeatherCode: number;
  dominantWeatherKey: PltsWeatherKey;
  dominantLabel: string;
  avgTempC: number | null;
  avgHumidityPct: number | null;
  avgCloudPct: number | null;
  totalPrecipMm: number | null;
  avgRadiationWm2: number | null;
  isDay: boolean;
  sampleMinutes: number;
  source: string;
  segments: PltsWeatherSegment[];
}

export interface PltsDailyWeatherPoint {
  date: string; // YYYY-MM-DD
  dominantWeatherKey: PltsWeatherKey;
  dominantLabel: string;
  avgTempC: number | null;
  avgCloudPct: number | null;
  avgRadiationWm2: number | null;
  totalPrecipMm: number | null;
  daytimeSummary: string;
  segments: { range: string; weatherKey: PltsWeatherKey; label: string }[];
}

export interface PltsMonthlyWeatherPoint {
  month: string; // YYYY-MM
  dominantWeatherKey: PltsWeatherKey;
  dominantLabel: string;
  avgTempC: number | null;
  avgRadiationWm2: number | null;
  totalPrecipMm: number | null;
  recordedDays: number;
  sunnyDays: number;
  cloudyDays: number;
  rainyDays: number;
}

export interface PltsLiveWeatherSnapshot {
  t_stamp: string; // YYYY-MM-DD HH:mm:00 WIB
  weatherCode: number;
  weatherKey: PltsWeatherKey;
  label: string;
  temperatureC: number | null;
  humidityPct: number | null;
  cloudPct: number | null;
  effectiveCloudPct: number | null;
  precipitationMm: number | null;
  radiationWm2: number | null;
  directRadiationWm2: number | null;
  windSpeedKmh: number | null;
  isDay: boolean;
  source: string;
}

export interface PltsWeatherPayload {
  location: typeof FACTORY_WEATHER_LOCATION;
  current: PltsLiveWeatherSnapshot | null;
  targetDate: string;
  hourly: (PltsHourlyWeatherPoint | null)[];
  daily: Record<string, PltsDailyWeatherPoint>;
  monthly: Record<string, PltsMonthlyWeatherPoint>;
}

interface WeatherMinuteRow {
  t_stamp_str: string;
  weather_code: number;
  weather_key: PltsWeatherKey;
  weather_label: string;
  temperature_c: number | null;
  humidity_pct: number | null;
  cloud_cover_pct: number | null;
  effective_cloud_pct: number | null;
  precipitation_mm: number | null;
  solar_radiation_wm2: number | null;
  is_day: boolean;
  source: string;
}

const WEATHER_LABELS: Record<PltsWeatherKey, string> = {
  clear_day: "Cerah",
  clear_night: "Cerah Malam",
  mainly_clear: "Sebagian Cerah",
  partly_cloudy: "Cerah Berawan",
  partly_cloudy_night: "Berawan Malam",
  overcast: "Berawan / Mendung",
  fog: "Berkabut",
  drizzle: "Gerimis",
  rain_light: "Hujan Ringan",
  rain_moderate: "Hujan Sedang",
  rain_heavy: "Hujan Lebat",
  thunderstorm: "Hujan Petir",
};

const WEATHER_SEVERITY_RANK: Record<PltsWeatherKey, number> = {
  thunderstorm: 12,
  rain_heavy: 11,
  rain_moderate: 10,
  rain_light: 9,
  drizzle: 8,
  fog: 7,
  overcast: 6,
  partly_cloudy: 5,
  partly_cloudy_night: 4,
  mainly_clear: 3,
  clear_day: 2,
  clear_night: 1,
};

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

function getWibNowParts(offsetMs = 0): {
  dateStr: string;
  hour: number;
  minute: number;
  minuteStamp: string;
  hourStamp: string;
} {
  const wib = new Date(Date.now() + offsetMs + 7 * 3600_000);
  const y = wib.getUTCFullYear();
  const m = pad2(wib.getUTCMonth() + 1);
  const d = pad2(wib.getUTCDate());
  const h = wib.getUTCHours();
  const mi = wib.getUTCMinutes();
  const dateStr = `${y}-${m}-${d}`;
  return {
    dateStr,
    hour: h,
    minute: mi,
    minuteStamp: `${dateStr} ${pad2(h)}:${pad2(mi)}:00`,
    hourStamp: `${dateStr} ${pad2(h)}:00:00`,
  };
}

function toNum(v: unknown): number | null {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function round1(v: number | null): number | null {
  if (v === null || !Number.isFinite(v)) return null;
  return Number(v.toFixed(1));
}

function avgNums(list: (number | null)[]): number | null {
  const valid = list.filter((v): v is number => v !== null && Number.isFinite(v));
  if (valid.length === 0) return null;
  return Number((valid.reduce((a, b) => a + b, 0) / valid.length).toFixed(1));
}

function medianNums(list: (number | null)[]): number | null {
  const valid = list.filter((v): v is number => v !== null && Number.isFinite(v)).sort((a, b) => a - b);
  if (valid.length === 0) return null;
  const mid = Math.floor(valid.length / 2);
  return valid.length % 2 === 1 ? valid[mid] : Number(((valid[mid - 1] + valid[mid]) / 2).toFixed(1));
}

/**
 * Solar-aware & physics-verified meteorological classifier tailored for tropical PV sites
 * at the foot of Mt. Penanggungan / Mt. Arjuno (Sidomukti, Pandaan, Pasuruan).
 *
 * Key accuracy safeguards:
 * 1. Filters NWP mountain-grid "phantom light rain" artifacts where a single forecast grid
 *    emits trace rain (0.1–1.5 mm) despite dry air (<70% RH), sparse low/mid rain clouds,
 *    strong direct solar radiation, dry airport METAR, or high live rooftop PLTS power.
 * 2. Distinguishes thin high-altitude cirrus (where direct solar radiation stays high)
 *    from thick low/mid overcast clouds that actually block solar PV production.
 * 3. Strictly prioritizes genuine rain, thunderstorms, and fog whenever physically supported.
 */
export function classifyWeatherCondition(params: {
  weatherCode: number;
  precipitationMm?: number | null;
  humidityPct?: number | null;
  cloudCoverPct?: number | null;
  cloudLowPct?: number | null;
  cloudMidPct?: number | null;
  cloudHighPct?: number | null;
  shortwaveRadiationWm2?: number | null;
  directRadiationWm2?: number | null;
  isDay: boolean;
  pvClearSkyRatio?: number | null;
  pvBothOnline?: boolean;
  metarConfirmedRain?: boolean;
  metarHasThunderstorm?: boolean;
  metarDrySky?: boolean;
}): {
  weatherCode: number;
  weatherKey: PltsWeatherKey;
  label: string;
  effectiveCloudPct: number | null;
  effectivePrecipMm: number;
} {
  let code = Number.isFinite(params.weatherCode) ? Math.round(params.weatherCode) : 0;
  let precip = Math.max(0, params.precipitationMm ?? 0);
  const humidity = params.humidityPct ?? null;
  const totalCloud = params.cloudCoverPct ?? null;
  const low = params.cloudLowPct ?? null;
  const mid = params.cloudMidPct ?? null;
  const high = params.cloudHighPct ?? null;
  const swRad = params.shortwaveRadiationWm2 ?? null;
  const dirRad = params.directRadiationWm2 ?? null;
  const pvRatio = params.pvClearSkyRatio ?? null;
  const pvBothOnline = Boolean(params.pvBothOnline);

  // Compute solar-weighted effective cloud opacity (low=1.0, mid=0.8, high cirrus=0.25)
  let effectiveCloudPct: number | null = totalCloud;
  if (low !== null || mid !== null || high !== null) {
    const weighted = (low ?? 0) * 1.0 + (mid ?? 0) * 0.8 + (high ?? 0) * 0.25;
    effectiveCloudPct = Math.min(100, Math.max(0, Math.round(weighted)));
  } else if (params.isDay && swRad !== null && swRad >= 120 && dirRad !== null && totalCloud !== null) {
    // When only total cloud cover + direct/shortwave radiation are available (e.g. minutely_15),
    // high direct sunlight fraction (>65%) indicates thin high clouds rather than dark overcast.
    const directRatio = Math.min(1, Math.max(0, dirRad / swRad));
    if (directRatio >= 0.72 && totalCloud > 55) {
      effectiveCloudPct = Math.round(totalCloud * 0.42);
    } else if (directRatio >= 0.55 && totalCloud > 70) {
      effectiveCloudPct = Math.round(totalCloud * 0.6);
    }
  }

  // Rain-bearing cloud cover (only low & mid clouds produce real rain; high cirrus does not)
  const rainBearingCloud =
    low !== null || mid !== null ? Math.max(low ?? 0, mid ?? 0) : effectiveCloudPct;

  const directRatio =
    params.isDay && swRad !== null && swRad >= 120 && dirRad !== null
      ? Math.min(1, Math.max(0, dirRad / swRad))
      : null;

  // Minimum precipitation threshold (> 1.0 mm) required before reporting rain icon/status
  // so light NWP mountain-grid drizzle noise (e.g. 0.5–0.6 mm while factory is dry) stays overcast/cloudy.
  const RAIN_THRESHOLD_MM = 1.0;

  // Step 1: Strictly require precipitation > 1.0 mm before any rain/drizzle/thunderstorm classification
  if (precip <= RAIN_THRESHOLD_MM) {
    precip = 0;
    if (code >= 51) {
      const cloudRef = effectiveCloudPct ?? 75;
      code = cloudRef >= 75 ? 3 : cloudRef >= 45 ? 2 : cloudRef >= 20 ? 1 : 0;
    }
  }

  // Step 2: Reject phantom thunderstorm (code >= 95) when surface air is dry or precip is insufficient
  if (code >= 95 && !params.metarHasThunderstorm) {
    const unsupportedThunder =
      precip < 2.5 ||
      (humidity !== null && humidity < 72) ||
      (params.isDay && pvRatio !== null && pvRatio >= 0.30 && precip < 3.5);
    if (unsupportedThunder) {
      code = precip >= 3.0 ? 63 : precip > RAIN_THRESHOLD_MM ? 61 : 3;
    }
  }

  // Step 3: Physics sanity check — reject remaining phantom convective rain (> 1.0 mm but < 2.0 mm)
  // when blazing sunlight, dry air, or high rooftop PLTS output prove rain is not hitting the factory.
  const isRainOrTrace = code >= 51 || precip > RAIN_THRESHOLD_MM;

  if (isRainOrTrace && !params.metarConfirmedRain && code < 95) {
    const drySurfaceVirga =
      humidity !== null &&
      humidity < 70 &&
      precip < 2.0 &&
      (rainBearingCloud === null || rainBearingCloud < 55);

    const blazingDirectSun =
      params.isDay &&
      dirRad !== null &&
      dirRad >= 350 &&
      directRatio !== null &&
      directRatio >= 0.45 &&
      (rainBearingCloud === null || rainBearingCloud < 55) &&
      precip < 2.0;

    const factoryPvProvesBrightSun =
      params.isDay && pvRatio !== null && pvRatio >= 0.55 && precip < 2.5;

    const metarDryWithLowPrecip =
      Boolean(params.metarDrySky) &&
      precip < 1.5 &&
      (rainBearingCloud === null || rainBearingCloud < 55) &&
      (humidity === null || humidity < 74);

    if (drySurfaceVirga || blazingDirectSun || factoryPvProvesBrightSun || metarDryWithLowPrecip) {
      precip = 0;
      const cloudRef = effectiveCloudPct ?? 45;
      code = cloudRef >= 75 ? 3 : cloudRef >= 45 ? 2 : cloudRef >= 20 ? 1 : 0;
    }
  }

  // Step 4: Scale remaining rain code conservatively so WMO label matches actual precipitation (> 1.0 mm)
  if (code >= 51) {
    if (precip <= RAIN_THRESHOLD_MM) {
      precip = 0;
      const cloudRef = effectiveCloudPct ?? 75;
      code = cloudRef >= 75 ? 3 : cloudRef >= 45 ? 2 : cloudRef >= 20 ? 1 : 0;
    } else {
      if (code >= 95 && precip < 2.5 && !params.metarHasThunderstorm) code = 63;
      if ((code === 65 || code === 82) && precip < 7.5) code = 63;
      if ((code === 63 || code === 81) && precip < 3.0) code = 61;
    }
  }

  // Step 5: Rooftop PLTS ground-truth cloud calibration (only when BOTH POI_1 & POI_2 are online)
  // - Bright sun (>=72% clear-sky): prevent false dark overcast.
  // - Heavy cloud dimming (<=48% clear-sky while NWP shows >=60% cloud cover or convective build-up):
  //   confirm "Berawan / Mendung" (overcast) accurately when factory sky is overcast without rain.
  if (params.isDay && pvRatio !== null) {
    if (pvRatio >= 0.72 && effectiveCloudPct !== null && effectiveCloudPct > 48) {
      effectiveCloudPct = Math.min(effectiveCloudPct, pvRatio >= 0.88 ? 30 : 44);
    } else if (
      pvBothOnline &&
      pvRatio <= 0.48 &&
      code < 51 &&
      ((totalCloud !== null && totalCloud >= 60) || (effectiveCloudPct !== null && effectiveCloudPct >= 45))
    ) {
      effectiveCloudPct = Math.max(effectiveCloudPct ?? 78, 78);
      code = 3;
    }
  }

  let key: PltsWeatherKey;

  if (precip > RAIN_THRESHOLD_MM && code >= 95) {
    key = "thunderstorm";
  } else if (precip > RAIN_THRESHOLD_MM && (code === 65 || code === 82 || precip >= 7.5)) {
    key = "rain_heavy";
  } else if (precip > RAIN_THRESHOLD_MM && (code === 63 || code === 81 || precip >= 3.0)) {
    key = "rain_moderate";
  } else if (precip > RAIN_THRESHOLD_MM) {
    key = "rain_light";
  } else if (code === 45 || code === 48) {
    key = "fog";
  } else {
    const cloudRef = effectiveCloudPct ?? (code === 3 ? 90 : code === 2 ? 55 : code === 1 ? 25 : 5);
    if (!params.isDay) {
      if (cloudRef >= 75) key = "overcast";
      else if (cloudRef >= 30) key = "partly_cloudy_night";
      else key = "clear_night";
    } else {
      if (cloudRef >= 75) key = "overcast";
      else if (cloudRef >= 45) key = "partly_cloudy";
      else if (cloudRef >= 20) key = "mainly_clear";
      else key = "clear_day";
    }
  }

  return {
    weatherCode: code,
    weatherKey: key,
    label: WEATHER_LABELS[key],
    effectiveCloudPct,
    effectivePrecipMm: precip > RAIN_THRESHOLD_MM ? Number(precip.toFixed(1)) : 0,
  };
}

/**
 * Groups sorted minute-level weather rows within a single hour into contiguous transition segments.
 * Example: 09:00–09:24 Cerah, 09:25–09:47 Cerah Berawan, 09:48–09:59 Hujan Ringan.
 */
export function buildHourlySummaryFromMinuteRows(
  dateStr: string,
  hour: number,
  rows: WeatherMinuteRow[]
): PltsHourlyWeatherPoint | null {
  if (rows.length === 0) return null;

  const sorted = [...rows].sort((a, b) => a.t_stamp_str.localeCompare(b.t_stamp_str));
  const hh = pad2(hour);

  // De-jitter isolated 1-minute flip-flops between dry cloud states (e.g. Sebagian Cerah -> 1 min Cerah Berawan -> Sebagian Cerah)
  // caused by cloud-cover values hovering near a classification boundary. Genuine rain/storm events are never smoothed away.
  const isPrecipKey = (k: PltsWeatherKey) =>
    k === "drizzle" || k === "rain_light" || k === "rain_moderate" || k === "rain_heavy" || k === "thunderstorm";
  const smoothed = sorted.map((r) => ({ ...r }));
  for (let i = 1; i < smoothed.length - 1; i++) {
    const prev = smoothed[i - 1];
    const curr = smoothed[i];
    const next = smoothed[i + 1];
    if (
      prev.weather_key === next.weather_key &&
      curr.weather_key !== prev.weather_key &&
      !isPrecipKey(curr.weather_key) &&
      !isPrecipKey(prev.weather_key)
    ) {
      curr.weather_key = prev.weather_key;
      curr.weather_label = prev.weather_label;
      curr.weather_code = prev.weather_code;
    }
  }

  type AccSegment = {
    startMinute: number;
    endMinute: number;
    weatherCode: number;
    weatherKey: PltsWeatherKey;
    label: string;
    temps: (number | null)[];
    clouds: (number | null)[];
    rads: (number | null)[];
    precips: (number | null)[];
    count: number;
  };

  const accSegments: AccSegment[] = [];
  const durationByKey = new Map<PltsWeatherKey, { minutes: number; code: number; label: string }>();

  for (const row of smoothed) {
    const timePart = row.t_stamp_str.split(" ")[1] || "00:00:00";
    const minute = Math.min(59, Math.max(0, parseInt(timePart.split(":")[1] || "0", 10)));
    const key = row.weather_key;
    const label = row.weather_label || WEATHER_LABELS[key] || "Cerah";
    const cloudVal = row.effective_cloud_pct ?? row.cloud_cover_pct;

    const prevStat = durationByKey.get(key) || { minutes: 0, code: row.weather_code, label };
    prevStat.minutes += 1;
    durationByKey.set(key, prevStat);

    const last = accSegments[accSegments.length - 1];
    if (last && last.weatherKey === key) {
      last.endMinute = Math.max(last.endMinute, minute);
      last.temps.push(row.temperature_c);
      last.clouds.push(cloudVal);
      last.rads.push(row.solar_radiation_wm2);
      last.precips.push(row.precipitation_mm);
      last.count += 1;
    } else {
      accSegments.push({
        startMinute: minute,
        endMinute: minute,
        weatherCode: row.weather_code,
        weatherKey: key,
        label,
        temps: [row.temperature_c],
        clouds: [cloudVal],
        rads: [row.solar_radiation_wm2],
        precips: [row.precipitation_mm],
        count: 1,
      });
    }
  }

  const segments: PltsWeatherSegment[] = accSegments.map((seg) => {
    const startStr = `${hh}:${pad2(seg.startMinute)}`;
    const endStr = `${hh}:${pad2(seg.endMinute)}`;
    const validPrecips = seg.precips.filter((v): v is number => v !== null);
    const segPrecipPeak = validPrecips.length > 0 ? Math.max(...validPrecips) : 0;
    return {
      startMinute: seg.startMinute,
      endMinute: seg.endMinute,
      range: seg.startMinute === seg.endMinute ? startStr : `${startStr}–${endStr}`,
      weatherCode: seg.weatherCode,
      weatherKey: seg.weatherKey,
      label: seg.label,
      avgTempC: avgNums(seg.temps),
      avgCloudPct: avgNums(seg.clouds),
      avgRadiationWm2: avgNums(seg.rads),
      precipMm: round1(segPrecipPeak),
      minutesCount: seg.count,
    };
  });

  // Dominant weather: longest duration in minutes; tie-break by meteorological severity
  let dominantKey: PltsWeatherKey = segments[0].weatherKey;
  let dominantCode = segments[0].weatherCode;
  let dominantLabel = segments[0].label;
  let maxMinutes = -1;

  for (const [k, stat] of durationByKey.entries()) {
    if (
      stat.minutes > maxMinutes ||
      (stat.minutes === maxMinutes && WEATHER_SEVERITY_RANK[k] > WEATHER_SEVERITY_RANK[dominantKey])
    ) {
      maxMinutes = stat.minutes;
      dominantKey = k;
      dominantCode = stat.code;
      dominantLabel = stat.label;
    }
  }

  const isDay = hour >= 6 && hour <= 17;
  const totalPrecip = sorted
    .map((r) => r.precipitation_mm)
    .filter((v): v is number => v !== null);

  return {
    date: dateStr,
    hour,
    dominantWeatherCode: dominantCode,
    dominantWeatherKey: dominantKey,
    dominantLabel,
    avgTempC: avgNums(sorted.map((r) => r.temperature_c)),
    avgHumidityPct: avgNums(sorted.map((r) => r.humidity_pct)),
    avgCloudPct: avgNums(sorted.map((r) => r.effective_cloud_pct ?? r.cloud_cover_pct)),
    totalPrecipMm: totalPrecip.length > 0 ? round1(Math.max(...totalPrecip)) : 0,
    avgRadiationWm2: avgNums(sorted.map((r) => r.solar_radiation_wm2)),
    isDay,
    sampleMinutes: sorted.length,
    source: "minute-rollup",
    segments,
  };
}

let latestLiveWeather: PltsLiveWeatherSnapshot | null = null;
let latestEnsembleRecordedAt = 0;
let weatherPollerStarted = false;
let lastMinuteRecordedStamp = "";
let weatherPollInFlight = false;
let lastCleanupMs = 0;
const archiveFetchCooldown = new Map<string, number>();

/**
 * Performs an IPv4-preferred HTTPS/HTTP JSON GET request with timeout and single retry.
 * Uses Node's native https.get instead of undici fetch to avoid TLSWrap ECONNRESET quirks
 * against weather APIs on Windows / corporate networks.
 */
function fetchJsonOnce(url: string, timeoutMs: number, redirectsLeft = 3): Promise<any> {
  return new Promise((resolve, reject) => {
    let parsed: URL;
    try {
      parsed = new URL(url);
    } catch (err) {
      reject(err);
      return;
    }

    const client = parsed.protocol === "http:" ? http : https;
    const req = client.get(
      parsed,
      {
        family: 4,
        headers: {
          "User-Agent": "WidatraSCADA-PLTS-Weather/1.0",
          Accept: "application/json",
          "Accept-Encoding": "identity",
          "Cache-Control": "no-cache",
        },
      },
      (res) => {
        const status = res.statusCode ?? 0;
        if (status >= 300 && status < 400 && res.headers.location && redirectsLeft > 0) {
          res.resume();
          const nextUrl = new URL(res.headers.location, parsed).toString();
          fetchJsonOnce(nextUrl, timeoutMs, redirectsLeft - 1).then(resolve, reject);
          return;
        }
        let body = "";
        res.setEncoding("utf8");
        res.on("data", (chunk) => {
          body += chunk;
        });
        res.on("end", () => {
          if (status < 200 || status >= 300) {
            reject(new Error(`HTTP ${status}`));
            return;
          }
          try {
            resolve(JSON.parse(body));
          } catch (parseErr: any) {
            reject(new Error(`Invalid JSON: ${parseErr?.message || parseErr}`));
          }
        });
      }
    );

    req.setTimeout(timeoutMs, () => {
      req.destroy(new Error(`Request timeout after ${timeoutMs}ms`));
    });
    req.on("error", (err) => {
      reject(err);
    });
  });
}

async function fetchJsonWithTimeout(url: string, timeoutMs = 8000): Promise<any> {
  try {
    return await fetchJsonOnce(url, timeoutMs);
  } catch (err: any) {
    const msg = String(err?.message || "");
    const code = String(err?.code || "");
    if (code === "ECONNRESET" || code === "ETIMEDOUT" || msg.includes("ECONNRESET") || msg.includes("timeout")) {
      return await fetchJsonOnce(url, timeoutMs);
    }
    throw err;
  }
}

interface MetarGroundTruth {
  fetchedAt: number;
  hasRain: boolean;
  hasThunderstorm: boolean;
  drySky: boolean;
  stationSummary: string;
}

interface LivePvRatioResult {
  ratio: number;
  bothOnline: boolean;
}

let cachedMetar: MetarGroundTruth | null = null;
let cachedPvPeakKw = 1700;
let cachedPvPeakAt = 0;

/**
 * Fetches real physical airport METAR/SPECI observations bracketing Pandaan:
 * WARR (Juanda Surabaya, ~28km N) & WARA (Abdul Rachman Saleh Malang, ~27km S).
 * Cached for 55 seconds so every 1-minute weather polling cycle stays aligned in real time
 * and immediately picks up sudden SPECI weather reports (while falling back to last cached
 * METAR if a transient network error occurs).
 */
async function getNearbyMetarGroundTruth(): Promise<MetarGroundTruth | null> {
  if (cachedMetar && Date.now() - cachedMetar.fetchedAt < 55_000) {
    return cachedMetar;
  }
  try {
    const data = await fetchJsonWithTimeout(
      "https://aviationweather.gov/api/data/metar?ids=WARR,WARA&format=json",
      4500
    );
    if (!Array.isArray(data) || data.length === 0) return cachedMetar;

    let hasRain = false;
    let hasThunderstorm = false;
    let drySky = false;
    const parts: string[] = [];

    for (const m of data) {
      const wx = String(m?.wxString || "").toUpperCase();
      const raw = String(m?.rawOb || "").toUpperCase();
      const clouds: any[] = Array.isArray(m?.clouds) ? m.clouds : [];
      const stationHasTs = /\b[-+]?(VC)?TS/.test(wx) || /\b[-+]?TS(RA|GR|GS)?\b/.test(raw);
      const stationHasPrecip =
        stationHasTs || /\b[-+]?(VC)?(SH|TS)?(RA|DZ|GR)\b/.test(wx) || /\b[-+]?(SH|TS)?(RA|DZ)\b/.test(raw);
      if (stationHasTs) hasThunderstorm = true;
      if (stationHasPrecip) hasRain = true;

      const maxCover = clouds.reduce((acc: string, c: any) => {
        const rank: Record<string, number> = { CLR: 0, SKC: 0, CAVOK: 0, FEW: 1, SCT: 2, BKN: 3, OVC: 4 };
        const cov = String(c?.cover || "").toUpperCase();
        return (rank[cov] ?? 0) > (rank[acc] ?? 0) ? cov : acc;
      }, "CLR");

      if (m?.icaoId === "WARR" && !stationHasPrecip && (maxCover === "CLR" || maxCover === "SKC" || maxCover === "FEW" || maxCover === "SCT")) {
        drySky = true;
      }
      parts.push(`${m?.icaoId}:${stationHasPrecip ? wx || "RAIN" : maxCover}`);
    }

    cachedMetar = {
      fetchedAt: Date.now(),
      hasRain,
      hasThunderstorm,
      drySky: drySky && !hasRain,
      stationSummary: parts.join(","),
    };
    return cachedMetar;
  } catch {
    return cachedMetar;
  }
}

/**
 * Computes the ratio of live rooftop PLTS active power (POI_1 + POI_2) to the expected
 * clear-sky solar bell curve for Sidomukti, Pandaan.
 * SAFETY INVARIANT:
 * - High ratios (>=0.55) prove direct sunshine on the factory roof (rejecting phantom rain).
 * - Low ratios (<=0.48) are ONLY used to confirm overcast ("Berawan / Mendung") when BOTH
 *   POI_1 and POI_2 are confirmed online (>15 kW each) AND NWP already shows >=60% cloud cover.
 *   An offline/tripped inverter (0 kW) NEVER fabricates clouds or rain.
 */
async function getLiveFactoryPvClearSkyRatio(hour: number, minute: number): Promise<LivePvRatioResult | null> {
  const hDec = hour + minute / 60;
  if (hDec < 7.0 || hDec > 16.5) return null;

  try {
    const pool = getPostgresPool();
    // Auto-calibrate installed PLTS peak capacity from last 30 days (cached 1h)
    if (Date.now() - cachedPvPeakAt > 3600_000) {
      const peakRes = await pool.query(`
        SELECT COALESCE(MAX(poi1_kw), 0)::float + COALESCE(MAX(poi2_kw), 0)::float AS peak_kw
        FROM (
          SELECT
            t_stamp,
            MAX(CASE WHEN poi_id = 'POI_1' THEN active_power END) AS poi1_kw,
            MAX(CASE WHEN poi_id = 'POI_2' THEN active_power END) AS poi2_kw
          FROM electric_plts_telemetry
          WHERE t_stamp >= (CURRENT_TIMESTAMP - INTERVAL '30 days')
          GROUP BY t_stamp
        ) sub
      `);
      const peakKw = Number(peakRes.rows[0]?.peak_kw || 0);
      if (peakKw >= 300) cachedPvPeakKw = peakKw;
      cachedPvPeakAt = Date.now();
    }

    const wibNow = getWibNowParts();
    const liveRes = await pool.query(
      `
      SELECT poi_id, COALESCE(active_power, 0)::float AS kw
      FROM (
        SELECT DISTINCT ON (poi_id) poi_id, active_power, t_stamp
        FROM electric_plts_telemetry_minute
        WHERE t_stamp >= ($1::timestamp - INTERVAL '5 minutes')
          AND poi_id IN ('POI_1', 'POI_2')
        ORDER BY poi_id, t_stamp DESC
      ) latest
      `,
      [wibNow.minuteStamp]
    );
    let poi1Kw = 0;
    let poi2Kw = 0;
    for (const r of liveRes.rows) {
      if (r.poi_id === "POI_1") poi1Kw = Number(r.kw || 0);
      if (r.poi_id === "POI_2") poi2Kw = Number(r.kw || 0);
    }
    const liveKw = poi1Kw + poi2Kw;
    if (!Number.isFinite(liveKw) || liveKw <= 50) return null;

    // Tropical clear-sky bell curve (Pandaan ~05:30 sunrise, ~11:30 solar noon, ~17:30 sunset)
    const solarElev = Math.sin(((hDec - 5.5) / 12) * Math.PI);
    if (solarElev <= 0.25) return null;

    const expectedClearSkyKw = cachedPvPeakKw * solarElev;
    if (expectedClearSkyKw <= 100) return null;
    return {
      ratio: Number((liveKw / expectedClearSkyKw).toFixed(2)),
      bothOnline: poi1Kw >= 15 && poi2Kw >= 15,
    };
  } catch {
    return null;
  }
}

async function fetchSingleOpenMeteoModelCurrent(model?: string): Promise<any | null> {
  const modelParam = model ? `&models=${encodeURIComponent(model)}` : "";
  const url =
    `https://api.open-meteo.com/v1/forecast?latitude=${FACTORY_WEATHER_LOCATION.lat}` +
    `&longitude=${FACTORY_WEATHER_LOCATION.lon}` +
    `&current=temperature_2m,relative_humidity_2m,is_day,precipitation,rain,showers,weather_code,cloud_cover,cloud_cover_low,cloud_cover_mid,cloud_cover_high,wind_speed_10m,shortwave_radiation,direct_radiation,diffuse_radiation` +
    `&timezone=Asia%2FJakarta&forecast_days=1${modelParam}`;

  const json = await fetchJsonWithTimeout(url, 10000);
  return json?.current ?? null;
}

async function fetchCurrentWeatherFromOpenMeteo(): Promise<PltsLiveWeatherSnapshot | null> {
  const wibNow = getWibNowParts();

  // Query 3 independent weather models + real physical airport METAR + live rooftop PV output in parallel
  const [mBestRes, mGfsRes, mIconRes, metarRes, pvRatioRes] = await Promise.allSettled([
    fetchSingleOpenMeteoModelCurrent(),
    fetchSingleOpenMeteoModelCurrent("gfs_seamless"),
    fetchSingleOpenMeteoModelCurrent("icon_seamless"),
    getNearbyMetarGroundTruth(),
    getLiveFactoryPvClearSkyRatio(wibNow.hour, wibNow.minute),
  ]);

  const samples: any[] = [mBestRes, mGfsRes, mIconRes]
    .filter((r): r is PromiseFulfilledResult<any> => r.status === "fulfilled" && Boolean(r.value))
    .map((r) => r.value);

  if (samples.length === 0) return null;

  const metar = metarRes.status === "fulfilled" ? metarRes.value : null;
  const pvInfo = pvRatioRes.status === "fulfilled" ? pvRatioRes.value : null;
  const pvClearSkyRatio = pvInfo?.ratio ?? null;
  const pvBothOnline = Boolean(pvInfo?.bothOnline);

  const tempC = medianNums(samples.map((s) => toNum(s.temperature_2m)));
  const humPct = medianNums(samples.map((s) => toNum(s.relative_humidity_2m)));
  const cloudTotal = medianNums(samples.map((s) => toNum(s.cloud_cover)));
  const cloudLow = medianNums(samples.map((s) => toNum(s.cloud_cover_low)));
  const cloudMid = medianNums(samples.map((s) => toNum(s.cloud_cover_mid)));
  const cloudHigh = medianNums(samples.map((s) => toNum(s.cloud_cover_high)));
  const windKmh = medianNums(samples.map((s) => toNum(s.wind_speed_10m)));
  const swRad = medianNums(samples.map((s) => toNum(s.shortwave_radiation)));
  const dirRad = medianNums(samples.map((s) => toNum(s.direct_radiation)));

  const dayFlags = samples.map((s) => (typeof s.is_day === "number" ? s.is_day === 1 : null)).filter((v): v is boolean => v !== null);
  const isDay = dayFlags.length > 0 ? dayFlags.filter(Boolean).length >= Math.ceil(dayFlags.length / 2) : wibNow.hour >= 6 && wibNow.hour <= 17;

  // Ensemble precipitation voting:
  // - Require precipitation strictly > 1.0 mm to count as a rain vote so light model drizzle (0.2–1.0 mm)
  //   does not show rain when the factory is dry/overcast.
  // - Thunderstorm (code >=95) requires >=2 models agreeing on thunderstorm + >=2.5 mm or real METAR TS.
  const modelPrecips = samples.map((s) => toNum(s.precipitation) ?? toNum(s.rain) ?? 0);
  const modelCodes = samples.map((s) => Number(s.weather_code ?? 0));
  const rainVotes = samples.filter((_, idx) => modelPrecips[idx] > 1.0).length;
  const thunderVotes = samples.filter(
    (_, idx) => modelCodes[idx] >= 95 && modelPrecips[idx] >= 2.5
  ).length;
  const majorityAgreesRain = rainVotes >= Math.ceil(samples.length / 2);

  let consensusPrecip = medianNums(modelPrecips) ?? 0;
  let consensusCode: number;

  if ((majorityAgreesRain && consensusPrecip > 1.0) || (metar?.hasRain && Math.max(...modelPrecips) > 1.0)) {
    // Use conservative (lower) median of rain codes so 1 extreme model doesn't dominate
    const rainCodes = modelCodes.filter((c) => c >= 51).sort((a, b) => a - b);
    const lowerMidIdx = Math.max(0, Math.floor((rainCodes.length - 1) / 2));
    consensusCode = rainCodes.length > 0 ? rainCodes[lowerMidIdx] : 61;
    if (consensusPrecip <= 1.0 && metar?.hasRain) {
      consensusPrecip = Math.max(...modelPrecips);
    }
    if (consensusCode >= 95 && thunderVotes < 2 && !metar?.hasThunderstorm) {
      consensusCode = consensusPrecip >= 3.0 ? 63 : 61;
    }
  } else {
    // Majority of independent models say DRY or precipitation <= 1.0 mm:
    // reflect actual sky cloudiness (e.g. Berawan / Mendung) without showing rain.
    const maxSinglePrecip = Math.max(...modelPrecips);
    const rainCloud = Math.max(cloudLow ?? 0, cloudMid ?? 0);
    const extremeSingleStorm = maxSinglePrecip >= 5.0 && rainCloud >= 75 && (humPct ?? 0) >= 80;
    if (extremeSingleStorm) {
      consensusPrecip = maxSinglePrecip;
      consensusCode = Math.max(...modelCodes);
    } else {
      consensusPrecip = 0;
      const dryCodes = modelCodes.filter((c) => c < 51).sort((a, b) => a - b);
      consensusCode = dryCodes.length > 0 ? dryCodes[Math.floor(dryCodes.length / 2)] : 3;
    }
  }

  const classified = classifyWeatherCondition({
    weatherCode: consensusCode,
    precipitationMm: consensusPrecip,
    humidityPct: humPct,
    cloudCoverPct: cloudTotal,
    cloudLowPct: cloudLow,
    cloudMidPct: cloudMid,
    cloudHighPct: cloudHigh,
    shortwaveRadiationWm2: swRad,
    directRadiationWm2: dirRad,
    isDay,
    pvClearSkyRatio,
    pvBothOnline,
    metarConfirmedRain: Boolean(metar?.hasRain),
    metarHasThunderstorm: Boolean(metar?.hasThunderstorm),
    metarDrySky: Boolean(metar?.drySky),
  });

  const sourceParts = [`ensemble(${samples.length})`];
  if (pvClearSkyRatio !== null) sourceParts.push("pv");
  if (metar) sourceParts.push("metar");

  return {
    t_stamp: wibNow.minuteStamp,
    weatherCode: classified.weatherCode,
    weatherKey: classified.weatherKey,
    label: classified.label,
    temperatureC: round1(tempC),
    humidityPct: round1(humPct),
    cloudPct: round1(cloudTotal),
    effectiveCloudPct: classified.effectiveCloudPct,
    precipitationMm: round1(classified.effectivePrecipMm),
    radiationWm2: round1(swRad),
    directRadiationWm2: round1(dirRad),
    windSpeedKmh: round1(windKmh),
    isDay,
    source: sourceParts.join("+"),
  };
}

async function fetchCurrentWeatherFromBmkg(): Promise<PltsLiveWeatherSnapshot | null> {
  const wibNow = getWibNowParts();
  const url = `https://api.bmkg.go.id/publik/prakiraan-cuaca?adm4=${FACTORY_WEATHER_LOCATION.bmkgAdm4}`;
  const [jsonRes, metarRes, pvRatioRes] = await Promise.allSettled([
    fetchJsonWithTimeout(url, 7000),
    getNearbyMetarGroundTruth(),
    getLiveFactoryPvClearSkyRatio(wibNow.hour, wibNow.minute),
  ]);
  if (jsonRes.status !== "fulfilled") return null;
  const json = jsonRes.value;
  const slots: any[] = (json?.data?.[0]?.cuaca || []).flat();
  if (!Array.isArray(slots) || slots.length === 0) return null;

  const nowMs = Date.now();
  let best = slots[0];
  let bestDiff = Infinity;
  for (const s of slots) {
    const dtMs = Date.parse(s.datetime || s.utc_datetime || "");
    if (!Number.isFinite(dtMs)) continue;
    const diff = Math.abs(dtMs - nowMs);
    if (diff < bestDiff) {
      bestDiff = diff;
      best = s;
    }
  }

  const metar = metarRes.status === "fulfilled" ? metarRes.value : null;
  const pvInfo = pvRatioRes.status === "fulfilled" ? pvRatioRes.value : null;
  const pvClearSkyRatio = pvInfo?.ratio ?? null;
  const isDay = wibNow.hour >= 6 && wibNow.hour <= 17;
  const rawPrecip = toNum(best.tp) ?? 0;
  const classified = classifyWeatherCondition({
    weatherCode: Number(best.weather ?? 0),
    precipitationMm: rawPrecip,
    humidityPct: toNum(best.hu),
    cloudCoverPct: toNum(best.tcc),
    isDay,
    pvClearSkyRatio,
    pvBothOnline: Boolean(pvInfo?.bothOnline),
    metarConfirmedRain: Boolean(metar?.hasRain),
    metarHasThunderstorm: Boolean(metar?.hasThunderstorm),
    metarDrySky: Boolean(metar?.drySky),
  });

  const rainRejected = classified.effectivePrecipMm === 0 && rawPrecip > 0;
  const sourceParts = ["bmkg"];
  if (pvClearSkyRatio !== null) sourceParts.push("pv");
  if (metar) sourceParts.push("metar");

  return {
    t_stamp: wibNow.minuteStamp,
    weatherCode: classified.weatherCode,
    weatherKey: classified.weatherKey,
    label: rainRejected ? classified.label : (best.weather_desc || classified.label),
    temperatureC: round1(toNum(best.t)),
    humidityPct: round1(toNum(best.hu)),
    cloudPct: round1(toNum(best.tcc)),
    effectiveCloudPct: classified.effectiveCloudPct,
    precipitationMm: round1(classified.effectivePrecipMm),
    radiationWm2: null,
    directRadiationWm2: null,
    windSpeedKmh: round1(toNum(best.ws)),
    isDay,
    source: sourceParts.join("+"),
  };
}

async function upsertHourlyWeatherRow(summary: PltsHourlyWeatherPoint, overwriteMinuteRollup: boolean): Promise<void> {
  const pool = getPostgresPool();
  const hourStamp = `${summary.date} ${pad2(summary.hour)}:00:00`;

  if (overwriteMinuteRollup) {
    await pool.query(
      `
      INSERT INTO plts_weather_hourly (
        t_stamp, location_name, dominant_weather_code, dominant_weather_key, dominant_weather_label,
        avg_temp_c, avg_humidity_pct, avg_cloud_pct, total_precip_mm, avg_radiation_wm2,
        is_day, sample_minutes, segments, source, updated_at
      ) VALUES (
        $1::timestamp, $2, $3, $4, $5,
        $6, $7, $8, $9, $10,
        $11, $12, $13::jsonb, $14, CURRENT_TIMESTAMP
      )
      ON CONFLICT (t_stamp) DO UPDATE SET
        dominant_weather_code = EXCLUDED.dominant_weather_code,
        dominant_weather_key = EXCLUDED.dominant_weather_key,
        dominant_weather_label = EXCLUDED.dominant_weather_label,
        avg_temp_c = EXCLUDED.avg_temp_c,
        avg_humidity_pct = EXCLUDED.avg_humidity_pct,
        avg_cloud_pct = EXCLUDED.avg_cloud_pct,
        total_precip_mm = EXCLUDED.total_precip_mm,
        avg_radiation_wm2 = EXCLUDED.avg_radiation_wm2,
        is_day = EXCLUDED.is_day,
        sample_minutes = EXCLUDED.sample_minutes,
        segments = EXCLUDED.segments,
        source = EXCLUDED.source,
        updated_at = CURRENT_TIMESTAMP
      `,
      [
        hourStamp,
        FACTORY_WEATHER_LOCATION.name,
        summary.dominantWeatherCode,
        summary.dominantWeatherKey,
        summary.dominantLabel,
        summary.avgTempC,
        summary.avgHumidityPct,
        summary.avgCloudPct,
        summary.totalPrecipMm,
        summary.avgRadiationWm2,
        summary.isDay,
        summary.sampleMinutes,
        JSON.stringify(summary.segments),
        summary.source,
      ]
    );
  } else {
    // Backfill only fills missing hours; never overwrites genuine per-minute rollups
    await pool.query(
      `
      INSERT INTO plts_weather_hourly (
        t_stamp, location_name, dominant_weather_code, dominant_weather_key, dominant_weather_label,
        avg_temp_c, avg_humidity_pct, avg_cloud_pct, total_precip_mm, avg_radiation_wm2,
        is_day, sample_minutes, segments, source, updated_at
      ) VALUES (
        $1::timestamp, $2, $3, $4, $5,
        $6, $7, $8, $9, $10,
        $11, $12, $13::jsonb, $14, CURRENT_TIMESTAMP
      )
      ON CONFLICT (t_stamp) DO NOTHING
      `,
      [
        hourStamp,
        FACTORY_WEATHER_LOCATION.name,
        summary.dominantWeatherCode,
        summary.dominantWeatherKey,
        summary.dominantLabel,
        summary.avgTempC,
        summary.avgHumidityPct,
        summary.avgCloudPct,
        summary.totalPrecipMm,
        summary.avgRadiationWm2,
        summary.isDay,
        summary.sampleMinutes,
        JSON.stringify(summary.segments),
        summary.source,
      ]
    );
  }
}

async function rollupWeatherHourFromMinutes(dateStr: string, hour: number): Promise<void> {
  const pool = getPostgresPool();
  const startTs = `${dateStr} ${pad2(hour)}:00:00`;
  const endTs = `${dateStr} ${pad2(hour)}:59:59`;
  const res = await pool.query(
    `
    SELECT
      to_char(t_stamp, 'YYYY-MM-DD HH24:MI:SS') AS t_stamp_str,
      weather_code,
      weather_key,
      weather_label,
      temperature_c::float AS temperature_c,
      humidity_pct::float AS humidity_pct,
      cloud_cover_pct::float AS cloud_cover_pct,
      effective_cloud_pct::float AS effective_cloud_pct,
      precipitation_mm::float AS precipitation_mm,
      solar_radiation_wm2::float AS solar_radiation_wm2,
      is_day,
      source
    FROM plts_weather_minute
    WHERE t_stamp >= $1::timestamp AND t_stamp <= $2::timestamp
    ORDER BY t_stamp ASC
    `,
    [startTs, endTs]
  );

  if (res.rows.length === 0) return;
  const summary = buildHourlySummaryFromMinuteRows(dateStr, hour, res.rows as WeatherMinuteRow[]);
  if (summary) {
    await upsertHourlyWeatherRow(summary, true);
  }
}

export async function recordCurrentPltsWeatherMinute(): Promise<PltsLiveWeatherSnapshot | null> {
  if (weatherPollInFlight) return latestLiveWeather;
  weatherPollInFlight = true;
  try {
    const wibNow = getWibNowParts();
    if (lastMinuteRecordedStamp === wibNow.minuteStamp && latestLiveWeather) {
      return latestLiveWeather;
    }

    let snapshot: PltsLiveWeatherSnapshot | null = null;
    try {
      snapshot = await fetchCurrentWeatherFromOpenMeteo();
      if (snapshot) {
        latestEnsembleRecordedAt = Date.now();
      }
    } catch {
      snapshot = null;
    }
    // Avoid jumping abruptly to BMKG 3-hourly forecast during a brief 1-minute network blip
    // if we already have a verified ensemble snapshot from the last 10 minutes.
    if (!snapshot && latestLiveWeather && Date.now() - latestEnsembleRecordedAt < 10 * 60_000) {
      snapshot = {
        ...latestLiveWeather,
        t_stamp: wibNow.minuteStamp,
      };
    }
    if (!snapshot) {
      try {
        snapshot = await fetchCurrentWeatherFromBmkg();
      } catch {
        snapshot = null;
      }
    }
    if (!snapshot) return latestLiveWeather;

    latestLiveWeather = snapshot;
    lastMinuteRecordedStamp = snapshot.t_stamp;

    const pool = getPostgresPool();
    await pool.query(
      `
      INSERT INTO plts_weather_minute (
        t_stamp, location_name, latitude, longitude,
        weather_code, weather_key, weather_label,
        temperature_c, humidity_pct, cloud_cover_pct, effective_cloud_pct,
        precipitation_mm, solar_radiation_wm2, direct_radiation_wm2, wind_speed_kmh,
        is_day, source
      ) VALUES (
        $1::timestamp, $2, $3, $4,
        $5, $6, $7,
        $8, $9, $10, $11,
        $12, $13, $14, $15,
        $16, $17
      )
      ON CONFLICT (t_stamp) DO UPDATE SET
        weather_code = EXCLUDED.weather_code,
        weather_key = EXCLUDED.weather_key,
        weather_label = EXCLUDED.weather_label,
        temperature_c = EXCLUDED.temperature_c,
        humidity_pct = EXCLUDED.humidity_pct,
        cloud_cover_pct = EXCLUDED.cloud_cover_pct,
        effective_cloud_pct = EXCLUDED.effective_cloud_pct,
        precipitation_mm = EXCLUDED.precipitation_mm,
        solar_radiation_wm2 = EXCLUDED.solar_radiation_wm2,
        direct_radiation_wm2 = EXCLUDED.direct_radiation_wm2,
        wind_speed_kmh = EXCLUDED.wind_speed_kmh,
        is_day = EXCLUDED.is_day,
        source = EXCLUDED.source
      `,
      [
        snapshot.t_stamp,
        FACTORY_WEATHER_LOCATION.name,
        FACTORY_WEATHER_LOCATION.lat,
        FACTORY_WEATHER_LOCATION.lon,
        snapshot.weatherCode,
        snapshot.weatherKey,
        snapshot.label,
        snapshot.temperatureC,
        snapshot.humidityPct,
        snapshot.cloudPct,
        snapshot.effectiveCloudPct,
        snapshot.precipitationMm,
        snapshot.radiationWm2,
        snapshot.directRadiationWm2,
        snapshot.windSpeedKmh,
        snapshot.isDay,
        snapshot.source,
      ]
    );

    // Immediately keep plts_weather_hourly up-to-date with minute-level transition segments
    await rollupWeatherHourFromMinutes(wibNow.dateStr, wibNow.hour);

    // Also finalize previous hour cleanly on minute 0..2; if the previous hour had a recording gap
    // (e.g. due to a server restart), automatically heal the missing minutes from 15-minute data.
    if (wibNow.minute <= 2) {
      const prevWib = getWibNowParts(-3600_000);
      await rollupWeatherHourFromMinutes(prevWib.dateStr, prevWib.hour);
      if (wibNow.minute === 1) {
        const cntRes = await pool.query(
          `SELECT COUNT(*)::int AS cnt FROM plts_weather_minute WHERE t_stamp >= $1::timestamp AND t_stamp <= $2::timestamp`,
          [`${prevWib.dateStr} ${pad2(prevWib.hour)}:00:00`, `${prevWib.dateStr} ${pad2(prevWib.hour)}:59:59`]
        );
        if (Number(cntRes.rows[0]?.cnt || 0) < 55) {
          void backfillRecentPltsWeather();
        }
      }
    }

    // Periodic retention cleanup (keep 7 days of raw minute logs aligned with electric_plts_telemetry_minute;
    // hourly summaries + minute-range transition segments in plts_weather_hourly stay permanently)
    if (Date.now() - lastCleanupMs > 6 * 3600_000) {
      lastCleanupMs = Date.now();
      const cutoffWib = getWibNowParts(-7 * 86_400_000);
      await pool
        .query(`DELETE FROM plts_weather_minute WHERE t_stamp < $1::timestamp`, [`${cutoffWib.dateStr} 00:00:00`])
        .catch(() => {});
    }

    return snapshot;
  } catch (err: any) {
    logger.warn(`[PLTS-Weather] Minute record skipped: ${err?.message || err}`);
    return latestLiveWeather;
  } finally {
    weatherPollInFlight = false;
  }
}

/**
 * Backfills missing recent hours (past 2 days up to current hour) using Open-Meteo 15-minute
 * + hourly cloud-layer data so today's earlier hours immediately show accurate weather icons
 * & sub-hour transitions without overwriting any genuine per-minute recorded hours.
 */
export async function backfillRecentPltsWeather(): Promise<void> {
  try {
    const url =
      `https://api.open-meteo.com/v1/forecast?latitude=${FACTORY_WEATHER_LOCATION.lat}` +
      `&longitude=${FACTORY_WEATHER_LOCATION.lon}` +
      `&minutely_15=temperature_2m,precipitation,weather_code,cloud_cover,shortwave_radiation,direct_radiation,is_day` +
      `&hourly=temperature_2m,relative_humidity_2m,precipitation,weather_code,cloud_cover,cloud_cover_low,cloud_cover_mid,cloud_cover_high,shortwave_radiation,direct_radiation,is_day` +
      `&timezone=Asia%2FJakarta&past_days=2&forecast_days=1`;

    const json = await fetchJsonWithTimeout(url, 8000);
    const wibNow = getWibNowParts();
    const currentCutoffStamp = `${wibNow.dateStr}T${pad2(wibNow.hour)}:00`;

    // Index hourly low/mid/high cloud & humidity by "YYYY-MM-DDTHH:00"
    const hourlyMeta = new Map<
      string,
      { low: number | null; mid: number | null; high: number | null; hum: number | null }
    >();
    const hTimes: string[] = json?.hourly?.time || [];
    for (let i = 0; i < hTimes.length; i++) {
      hourlyMeta.set(hTimes[i], {
        low: toNum(json.hourly.cloud_cover_low?.[i]),
        mid: toNum(json.hourly.cloud_cover_mid?.[i]),
        high: toNum(json.hourly.cloud_cover_high?.[i]),
        hum: toNum(json.hourly.relative_humidity_2m?.[i]),
      });
    }

    const mTimes: string[] = json?.minutely_15?.time || [];
    if (mTimes.length === 0) return;

    // Group 15-minute slots by hour ("YYYY-MM-DD HH")
    const byHour = new Map<string, { dateStr: string; hour: number; slots: any[] }>();
    for (let i = 0; i < mTimes.length; i++) {
      const tStr = mTimes[i]; // "YYYY-MM-DDTHH:MM"
      if (tStr >= currentCutoffStamp) continue; // Only backfill completed past hours (current hour uses live minutes)
      const [dateStr, hm = "00:00"] = tStr.split("T");
      const [hhStr, mmStr] = hm.split(":");
      const hour = parseInt(hhStr, 10);
      const startMinute = parseInt(mmStr, 10);
      const endMinute = Math.min(59, startMinute + 14);
      const hKey = `${dateStr}T${pad2(hour)}:00`;
      const hmMeta = hourlyMeta.get(hKey);
      const isDay =
        typeof json.minutely_15.is_day?.[i] === "number"
          ? json.minutely_15.is_day[i] === 1
          : hour >= 6 && hour <= 17;

      const classified = classifyWeatherCondition({
        weatherCode: Number(json.minutely_15.weather_code?.[i] ?? 0),
        precipitationMm: toNum(json.minutely_15.precipitation?.[i]),
        humidityPct: hmMeta?.hum ?? null,
        cloudCoverPct: toNum(json.minutely_15.cloud_cover?.[i]),
        cloudLowPct: hmMeta?.low ?? null,
        cloudMidPct: hmMeta?.mid ?? null,
        cloudHighPct: hmMeta?.high ?? null,
        shortwaveRadiationWm2: toNum(json.minutely_15.shortwave_radiation?.[i]),
        directRadiationWm2: toNum(json.minutely_15.direct_radiation?.[i]),
        isDay,
      });

      const groupKey = `${dateStr} ${pad2(hour)}`;
      const bucket = byHour.get(groupKey) || { dateStr, hour, slots: [] };
      bucket.slots.push({
        startMinute,
        endMinute,
        weatherCode: classified.weatherCode,
        weatherKey: classified.weatherKey,
        label: classified.label,
        tempC: round1(toNum(json.minutely_15.temperature_2m?.[i])),
        humPct: round1(hmMeta?.hum ?? null),
        cloudPct: classified.effectiveCloudPct ?? round1(toNum(json.minutely_15.cloud_cover?.[i])),
        radWm2: round1(toNum(json.minutely_15.shortwave_radiation?.[i])),
        precipMm: round1(classified.effectivePrecipMm),
        isDay,
      });
      byHour.set(groupKey, bucket);
    }

    const pool = getPostgresPool();
    for (const bucket of byHour.values()) {
      const hh = pad2(bucket.hour);
      // Check if this completed past hour has partial live minutes (e.g. 13:00–13:07 because server restarted).
      // If so, seamlessly fill ONLY the unrecorded minutes from Open-Meteo 15-min slots (never overwriting
      // genuine live minute rows) and re-rollup so the hour displays full :00–:59 transitions!
      const existingMinRes = await pool.query(
        `SELECT EXTRACT(MINUTE FROM t_stamp)::int AS mm
         FROM plts_weather_minute
         WHERE t_stamp >= $1::timestamp AND t_stamp <= $2::timestamp`,
        [`${bucket.dateStr} ${hh}:00:00`, `${bucket.dateStr} ${hh}:59:59`]
      );
      const existingMins = new Set<number>(existingMinRes.rows.map((r: any) => Number(r.mm)));
      if (existingMins.size > 0 && existingMins.size < 58) {
        for (let m = 0; m < 60; m++) {
          if (existingMins.has(m)) continue;
          const slot = bucket.slots.find((s) => m >= s.startMinute && m <= s.endMinute) || bucket.slots[0];
          if (!slot) continue;
          const ts = `${bucket.dateStr} ${hh}:${pad2(m)}:00`;
          await pool.query(
            `
            INSERT INTO plts_weather_minute (
              t_stamp, location_name, latitude, longitude,
              weather_code, weather_key, weather_label,
              temperature_c, humidity_pct, cloud_cover_pct, effective_cloud_pct,
              precipitation_mm, solar_radiation_wm2, direct_radiation_wm2, wind_speed_kmh,
              is_day, source
            ) VALUES (
              $1::timestamp, $2, $3, $4,
              $5, $6, $7,
              $8, $9, $10, $11,
              $12, $13, $14, $15,
              $16, $17
            )
            ON CONFLICT (t_stamp) DO NOTHING
            `,
            [
              ts,
              FACTORY_WEATHER_LOCATION.name,
              FACTORY_WEATHER_LOCATION.lat,
              FACTORY_WEATHER_LOCATION.lon,
              slot.weatherCode,
              slot.weatherKey,
              slot.label,
              slot.tempC,
              slot.humPct,
              slot.cloudPct,
              slot.cloudPct,
              slot.precipMm,
              slot.radWm2,
              null,
              null,
              slot.isDay,
              "open-meteo-15m-fill",
            ]
          );
        }
        await rollupWeatherHourFromMinutes(bucket.dateStr, bucket.hour);
        continue;
      }

      const merged: {
        startMinute: number;
        endMinute: number;
        weatherCode: number;
        weatherKey: PltsWeatherKey;
        label: string;
        temps: (number | null)[];
        clouds: (number | null)[];
        rads: (number | null)[];
        precips: (number | null)[];
        minutesCount: number;
      }[] = [];

      const durMap = new Map<PltsWeatherKey, { minutes: number; code: number; label: string }>();

      for (const s of bucket.slots) {
        const mins = s.endMinute - s.startMinute + 1;
        const dStat = durMap.get(s.weatherKey) || { minutes: 0, code: s.weatherCode, label: s.label };
        dStat.minutes += mins;
        durMap.set(s.weatherKey, dStat);

        const last = merged[merged.length - 1];
        if (last && last.weatherKey === s.weatherKey) {
          last.endMinute = s.endMinute;
          last.temps.push(s.tempC);
          last.clouds.push(s.cloudPct);
          last.rads.push(s.radWm2);
          last.precips.push(s.precipMm);
          last.minutesCount += mins;
        } else {
          merged.push({
            startMinute: s.startMinute,
            endMinute: s.endMinute,
            weatherCode: s.weatherCode,
            weatherKey: s.weatherKey,
            label: s.label,
            temps: [s.tempC],
            clouds: [s.cloudPct],
            rads: [s.radWm2],
            precips: [s.precipMm],
            minutesCount: mins,
          });
        }
      }

      const segments: PltsWeatherSegment[] = merged.map((seg) => {
        const validP = seg.precips.filter((v): v is number => v !== null);
        const peakP = validP.length > 0 ? Math.max(...validP) : 0;
        return {
          startMinute: seg.startMinute,
          endMinute: seg.endMinute,
          range: `${hh}:${pad2(seg.startMinute)}–${hh}:${pad2(seg.endMinute)}`,
          weatherCode: seg.weatherCode,
          weatherKey: seg.weatherKey,
          label: seg.label,
          avgTempC: avgNums(seg.temps),
          avgCloudPct: avgNums(seg.clouds),
          avgRadiationWm2: avgNums(seg.rads),
          precipMm: peakP > 1.0 ? round1(peakP) : 0,
          minutesCount: seg.minutesCount,
        };
      });

      let domKey: PltsWeatherKey = segments[0].weatherKey;
      let domCode = segments[0].weatherCode;
      let domLabel = segments[0].label;
      let bestMin = -1;
      for (const [k, st] of durMap.entries()) {
        if (st.minutes > bestMin || (st.minutes === bestMin && WEATHER_SEVERITY_RANK[k] > WEATHER_SEVERITY_RANK[domKey])) {
          bestMin = st.minutes;
          domKey = k;
          domCode = st.code;
          domLabel = st.label;
        }
      }

      const point: PltsHourlyWeatherPoint = {
        date: bucket.dateStr,
        hour: bucket.hour,
        dominantWeatherCode: domCode,
        dominantWeatherKey: domKey,
        dominantLabel: domLabel,
        avgTempC: avgNums(bucket.slots.map((s) => s.tempC)),
        avgHumidityPct: avgNums(bucket.slots.map((s) => s.humPct)),
        avgCloudPct: avgNums(bucket.slots.map((s) => s.cloudPct)),
        totalPrecipMm: round1(bucket.slots.map((s) => s.precipMm ?? 0).reduce((a, b) => a + b, 0)),
        avgRadiationWm2: avgNums(bucket.slots.map((s) => s.radWm2)),
        isDay: bucket.hour >= 6 && bucket.hour <= 17,
        sampleMinutes: 0,
        source: "open-meteo-15m",
        segments,
      };
      await upsertHourlyWeatherRow(point, false);
    }
  } catch (err: any) {
    logger.warn(`[PLTS-Weather] Recent backfill skipped: ${err?.message || err}`);
  }
}

async function ensureArchiveWeatherForRange(startDate: string, endDate: string): Promise<void> {
  const wibNow = getWibNowParts();
  const yesterday = getWibNowParts(-86_400_000).dateStr;
  const clampedEnd = endDate > yesterday ? yesterday : endDate;
  if (!startDate || !clampedEnd || startDate > clampedEnd) return;

  // Cap on-demand archive fetch to 35 days per request to stay snappy
  const startMs = Date.parse(`${startDate}T00:00:00Z`);
  const endMs = Date.parse(`${clampedEnd}T00:00:00Z`);
  if (!Number.isFinite(startMs) || !Number.isFinite(endMs)) return;
  const daySpan = Math.floor((endMs - startMs) / 86_400_000) + 1;
  if (daySpan > 40) return;

  const coolKey = `${startDate}_${clampedEnd}`;
  const lastTry = archiveFetchCooldown.get(coolKey) || 0;
  if (Date.now() - lastTry < 10 * 60_000) return;

  const pool = getPostgresPool();
  const existingRes = await pool.query(
    `SELECT COUNT(DISTINCT to_char(t_stamp, 'YYYY-MM-DD'))::int AS cnt FROM plts_weather_hourly WHERE t_stamp >= $1::timestamp AND t_stamp <= $2::timestamp`,
    [`${startDate} 00:00:00`, `${clampedEnd} 23:59:59`]
  );
  const existingDays = Number(existingRes.rows[0]?.cnt || 0);
  if (existingDays >= daySpan) return;

  archiveFetchCooldown.set(coolKey, Date.now());
  try {
    const url =
      `https://archive-api.open-meteo.com/v1/archive?latitude=${FACTORY_WEATHER_LOCATION.lat}` +
      `&longitude=${FACTORY_WEATHER_LOCATION.lon}` +
      `&start_date=${startDate}&end_date=${clampedEnd}` +
      `&hourly=temperature_2m,relative_humidity_2m,precipitation,weather_code,cloud_cover,cloud_cover_low,cloud_cover_mid,cloud_cover_high,shortwave_radiation,direct_radiation,is_day` +
      `&timezone=Asia%2FJakarta`;

    const json = await fetchJsonWithTimeout(url, 5500);
    const times: string[] = json?.hourly?.time || [];
    for (let i = 0; i < times.length; i++) {
      const [dateStr, hm = "00:00"] = times[i].split("T");
      const hour = parseInt(hm.split(":")[0], 10);
      if (dateStr === wibNow.dateStr && hour >= wibNow.hour) continue;
      const isDay =
        typeof json.hourly.is_day?.[i] === "number"
          ? json.hourly.is_day[i] === 1
          : hour >= 6 && hour <= 17;
      const classified = classifyWeatherCondition({
        weatherCode: Number(json.hourly.weather_code?.[i] ?? 0),
        precipitationMm: toNum(json.hourly.precipitation?.[i]),
        humidityPct: toNum(json.hourly.relative_humidity_2m?.[i]),
        cloudCoverPct: toNum(json.hourly.cloud_cover?.[i]),
        cloudLowPct: toNum(json.hourly.cloud_cover_low?.[i]),
        cloudMidPct: toNum(json.hourly.cloud_cover_mid?.[i]),
        cloudHighPct: toNum(json.hourly.cloud_cover_high?.[i]),
        shortwaveRadiationWm2: toNum(json.hourly.shortwave_radiation?.[i]),
        directRadiationWm2: toNum(json.hourly.direct_radiation?.[i]),
        isDay,
      });
      const hh = pad2(hour);
      const tempC = round1(toNum(json.hourly.temperature_2m?.[i]));
      const cloudPct = classified.effectiveCloudPct ?? round1(toNum(json.hourly.cloud_cover?.[i]));
      const radWm2 = round1(toNum(json.hourly.shortwave_radiation?.[i]));
      const precipMm = round1(classified.effectivePrecipMm);

      const point: PltsHourlyWeatherPoint = {
        date: dateStr,
        hour,
        dominantWeatherCode: classified.weatherCode,
        dominantWeatherKey: classified.weatherKey,
        dominantLabel: classified.label,
        avgTempC: tempC,
        avgHumidityPct: round1(toNum(json.hourly.relative_humidity_2m?.[i])),
        avgCloudPct: cloudPct,
        totalPrecipMm: precipMm,
        avgRadiationWm2: radWm2,
        isDay,
        sampleMinutes: 0,
        source: "open-meteo-archive",
        segments: [
          {
            startMinute: 0,
            endMinute: 59,
            range: `${hh}:00–${hh}:59`,
            weatherCode: classified.weatherCode,
            weatherKey: classified.weatherKey,
            label: classified.label,
            avgTempC: tempC,
            avgCloudPct: cloudPct,
            avgRadiationWm2: radWm2,
            precipMm,
            minutesCount: 60,
          },
        ],
      };
      await upsertHourlyWeatherRow(point, false);
    }
  } catch {
    // Non-fatal archive lookup skip
  }
}

export function startPltsWeatherPolling(): void {
  if (weatherPollerStarted) return;
  weatherPollerStarted = true;

  // Initial non-blocking startup sequence: record live ensemble first, then backfill recent 2 days sequentially
  const initTimer = setTimeout(() => {
    void recordCurrentPltsWeatherMinute().finally(() => {
      void backfillRecentPltsWeather();
    });
  }, 1500);
  initTimer.unref?.();

  // Independent 60-second minute recorder (isolated from SCADA 1-second telemetry loop)
  const interval = setInterval(() => {
    void recordCurrentPltsWeatherMinute();
  }, 60_000);
  interval.unref?.();

  logger.info(
    { location: FACTORY_WEATHER_LOCATION.name, lat: FACTORY_WEATHER_LOCATION.lat, lon: FACTORY_WEATHER_LOCATION.lon },
    "PLTS weather per-minute recorder started"
  );
}

export async function getLatestPltsWeatherSnapshot(): Promise<PltsLiveWeatherSnapshot | null> {
  if (latestLiveWeather) return latestLiveWeather;
  try {
    const pool = getPostgresPool();
    const res = await pool.query(
      `
      SELECT
        to_char(t_stamp, 'YYYY-MM-DD HH24:MI:SS') AS t_stamp,
        weather_code, weather_key, weather_label,
        temperature_c::float, humidity_pct::float, cloud_cover_pct::float,
        effective_cloud_pct::float, precipitation_mm::float, solar_radiation_wm2::float,
        direct_radiation_wm2::float, wind_speed_kmh::float, is_day, source
      FROM plts_weather_minute
      ORDER BY t_stamp DESC
      LIMIT 1
      `
    );
    const r = res.rows[0];
    if (r) {
      latestLiveWeather = {
        t_stamp: r.t_stamp,
        weatherCode: Number(r.weather_code),
        weatherKey: r.weather_key as PltsWeatherKey,
        label: r.weather_label,
        temperatureC: toNum(r.temperature_c),
        humidityPct: toNum(r.humidity_pct),
        cloudPct: toNum(r.cloud_cover_pct),
        effectiveCloudPct: toNum(r.effective_cloud_pct),
        precipitationMm: toNum(r.precipitation_mm),
        radiationWm2: toNum(r.solar_radiation_wm2),
        directRadiationWm2: toNum(r.direct_radiation_wm2),
        windSpeedKmh: toNum(r.wind_speed_kmh),
        isDay: Boolean(r.is_day),
        source: r.source,
      };
      return latestLiveWeather;
    }
  } catch {
    // ignore
  }
  return await recordCurrentPltsWeatherMinute();
}

function summarizeDayFromHours(dateStr: string, hours: PltsHourlyWeatherPoint[]): PltsDailyWeatherPoint {
  // Prioritize solar-producing daytime hours (06:00 - 17:00)
  const daytime = hours.filter((h) => h.hour >= 6 && h.hour <= 17).sort((a, b) => a.hour - b.hour);
  const scope = daytime.length > 0 ? daytime : [...hours].sort((a, b) => a.hour - b.hour);

  const countByKey = new Map<PltsWeatherKey, { count: number; label: string }>();
  const daySegments: { startHour: number; endHour: number; weatherKey: PltsWeatherKey; label: string }[] = [];

  for (const h of scope) {
    const prev = countByKey.get(h.dominantWeatherKey) || { count: 0, label: h.dominantLabel };
    prev.count += 1;
    countByKey.set(h.dominantWeatherKey, prev);

    const last = daySegments[daySegments.length - 1];
    if (last && last.weatherKey === h.dominantWeatherKey) {
      last.endHour = h.hour;
    } else {
      daySegments.push({
        startHour: h.hour,
        endHour: h.hour,
        weatherKey: h.dominantWeatherKey,
        label: h.dominantLabel,
      });
    }
  }

  let domKey: PltsWeatherKey = scope[0].dominantWeatherKey;
  let domLabel = scope[0].dominantLabel;
  let bestCount = -1;
  for (const [k, st] of countByKey.entries()) {
    if (st.count > bestCount || (st.count === bestCount && WEATHER_SEVERITY_RANK[k] > WEATHER_SEVERITY_RANK[domKey])) {
      bestCount = st.count;
      domKey = k;
      domLabel = st.label;
    }
  }

  const formattedSegments = daySegments.map((s) => ({
    range: `${pad2(s.startHour)}:00–${pad2(s.endHour)}:59`,
    weatherKey: s.weatherKey,
    label: s.label,
  }));

  return {
    date: dateStr,
    dominantWeatherKey: domKey,
    dominantLabel: domLabel,
    avgTempC: avgNums(scope.map((h) => h.avgTempC)),
    avgCloudPct: avgNums(scope.map((h) => h.avgCloudPct)),
    avgRadiationWm2: avgNums(scope.map((h) => h.avgRadiationWm2)),
    totalPrecipMm: round1(scope.map((h) => h.totalPrecipMm ?? 0).reduce((a, b) => a + b, 0)),
    daytimeSummary: formattedSegments.map((s) => `${s.range} ${s.label}`).join(", "),
    segments: formattedSegments,
  };
}

export async function getPltsWeatherForAnalytics(params: {
  targetDate: string;
  fromDate?: string;
  toDate?: string;
  year?: number;
}): Promise<PltsWeatherPayload> {
  const pool = getPostgresPool();
  const wibNow = getWibNowParts();
  const targetDate = params.targetDate || wibNow.dateStr;

  // Trigger non-blocking on-demand backfill for requested historical dates if missing
  if (targetDate < wibNow.dateStr) {
    await ensureArchiveWeatherForRange(targetDate, targetDate);
  }
  if (params.fromDate && params.toDate && params.fromDate < wibNow.dateStr) {
    await ensureArchiveWeatherForRange(params.fromDate, params.toDate);
  }

  // 1. Hourly weather for targetDate (24 slots) — live minute rows take strict priority over rolled/backfilled rows
  const [minuteRowsRes, hourlyTargetRes, current] = await Promise.all([
    pool
      .query(
        `
        SELECT
          to_char(t_stamp, 'YYYY-MM-DD HH24:MI:SS') AS t_stamp_str,
          weather_code, weather_key, weather_label,
          temperature_c::float AS temperature_c,
          humidity_pct::float AS humidity_pct,
          cloud_cover_pct::float AS cloud_cover_pct,
          effective_cloud_pct::float AS effective_cloud_pct,
          precipitation_mm::float AS precipitation_mm,
          solar_radiation_wm2::float AS solar_radiation_wm2,
          is_day, source
        FROM plts_weather_minute
        WHERE t_stamp >= $1::timestamp AND t_stamp <= $2::timestamp
        ORDER BY t_stamp ASC
        `,
        [`${targetDate} 00:00:00`, `${targetDate} 23:59:59`]
      )
      .catch(() => ({ rows: [] as any[] })),
    pool
      .query(
        `
        SELECT
          to_char(t_stamp, 'YYYY-MM-DD') AS date_str,
          EXTRACT(HOUR FROM t_stamp)::int AS hour_num,
          dominant_weather_code, dominant_weather_key, dominant_weather_label,
          avg_temp_c::float AS avg_temp_c,
          avg_humidity_pct::float AS avg_humidity_pct,
          avg_cloud_pct::float AS avg_cloud_pct,
          total_precip_mm::float AS total_precip_mm,
          avg_radiation_wm2::float AS avg_radiation_wm2,
          is_day, sample_minutes, segments, source
        FROM plts_weather_hourly
        WHERE t_stamp >= $1::timestamp AND t_stamp <= $2::timestamp
        ORDER BY t_stamp ASC
        `,
        [`${targetDate} 00:00:00`, `${targetDate} 23:59:59`]
      )
      .catch(() => ({ rows: [] as any[] })),
    getLatestPltsWeatherSnapshot(),
  ]);

  const hourly: (PltsHourlyWeatherPoint | null)[] = Array.from({ length: 24 }, () => null);

  for (const r of hourlyTargetRes.rows) {
    const h = Number(r.hour_num);
    if (h < 0 || h > 23) continue;
    if (targetDate === wibNow.dateStr && h > wibNow.hour) continue;
    const rawSegs = Array.isArray(r.segments) ? r.segments : [];
    hourly[h] = {
      date: r.date_str,
      hour: h,
      dominantWeatherCode: Number(r.dominant_weather_code),
      dominantWeatherKey: r.dominant_weather_key as PltsWeatherKey,
      dominantLabel: r.dominant_weather_label,
      avgTempC: toNum(r.avg_temp_c),
      avgHumidityPct: toNum(r.avg_humidity_pct),
      avgCloudPct: toNum(r.avg_cloud_pct),
      totalPrecipMm: toNum(r.total_precip_mm),
      avgRadiationWm2: toNum(r.avg_radiation_wm2),
      isDay: Boolean(r.is_day),
      sampleMinutes: Number(r.sample_minutes || 0),
      source: r.source || "minute-rollup",
      segments: rawSegs,
    };
  }

  // Override any hour that has live per-minute rows so minute-by-minute changes appear immediately
  const minuteRowsByHour = new Map<number, WeatherMinuteRow[]>();
  for (const row of minuteRowsRes.rows as WeatherMinuteRow[]) {
    const timePart = row.t_stamp_str.split(" ")[1] || "00:00:00";
    const h = parseInt(timePart.split(":")[0] || "0", 10);
    if (h < 0 || h > 23) continue;
    if (targetDate === wibNow.dateStr && h > wibNow.hour) continue;
    const list = minuteRowsByHour.get(h) || [];
    list.push(row);
    minuteRowsByHour.set(h, list);
  }
  for (const [h, list] of minuteRowsByHour.entries()) {
    const computed = buildHourlySummaryFromMinuteRows(targetDate, h, list);
    if (computed) hourly[h] = computed;
  }

  // 2. Daily & monthly summaries from plts_weather_hourly across selected range/year
  const selectedYear = params.year || parseInt(targetDate.slice(0, 4), 10) || new Date().getFullYear();
  const rangeStart = params.fromDate && params.fromDate < `${selectedYear}-01-01` ? params.fromDate : `${selectedYear}-01-01`;
  const rangeEnd = params.toDate && params.toDate > `${selectedYear}-12-31` ? params.toDate : `${selectedYear}-12-31`;

  const rangeRes = await pool
    .query(
      `
      SELECT
        to_char(t_stamp, 'YYYY-MM-DD') AS date_str,
        EXTRACT(HOUR FROM t_stamp)::int AS hour_num,
        dominant_weather_code, dominant_weather_key, dominant_weather_label,
        avg_temp_c::float AS avg_temp_c,
        avg_humidity_pct::float AS avg_humidity_pct,
        avg_cloud_pct::float AS avg_cloud_pct,
        total_precip_mm::float AS total_precip_mm,
        avg_radiation_wm2::float AS avg_radiation_wm2,
        is_day, sample_minutes, source
      FROM plts_weather_hourly
      WHERE t_stamp >= $1::timestamp AND t_stamp <= $2::timestamp
      ORDER BY t_stamp ASC
      `,
      [`${rangeStart} 00:00:00`, `${rangeEnd} 23:59:59`]
    )
    .catch(() => ({ rows: [] as any[] }));

  const hoursByDate = new Map<string, PltsHourlyWeatherPoint[]>();
  for (const r of rangeRes.rows) {
    const dStr = String(r.date_str);
    const list = hoursByDate.get(dStr) || [];
    list.push({
      date: dStr,
      hour: Number(r.hour_num),
      dominantWeatherCode: Number(r.dominant_weather_code),
      dominantWeatherKey: r.dominant_weather_key as PltsWeatherKey,
      dominantLabel: r.dominant_weather_label,
      avgTempC: toNum(r.avg_temp_c),
      avgHumidityPct: toNum(r.avg_humidity_pct),
      avgCloudPct: toNum(r.avg_cloud_pct),
      totalPrecipMm: toNum(r.total_precip_mm),
      avgRadiationWm2: toNum(r.avg_radiation_wm2),
      isDay: Boolean(r.is_day),
      sampleMinutes: Number(r.sample_minutes || 0),
      source: r.source || "minute-rollup",
      segments: [],
    });
    hoursByDate.set(dStr, list);
  }

  // Ensure targetDate live hours are also reflected in daily map
  const liveHoursForTarget = hourly.filter((h): h is PltsHourlyWeatherPoint => h !== null);
  if (liveHoursForTarget.length > 0) {
    hoursByDate.set(targetDate, liveHoursForTarget);
  }

  const daily: Record<string, PltsDailyWeatherPoint> = {};
  const daysByMonth = new Map<string, PltsDailyWeatherPoint[]>();
  for (const [dStr, hList] of hoursByDate.entries()) {
    if (hList.length === 0) continue;
    const daySummary = summarizeDayFromHours(dStr, hList);
    daily[dStr] = daySummary;
    const mStr = dStr.slice(0, 7);
    const mList = daysByMonth.get(mStr) || [];
    mList.push(daySummary);
    daysByMonth.set(mStr, mList);
  }

  const monthly: Record<string, PltsMonthlyWeatherPoint> = {};
  for (const [mStr, dList] of daysByMonth.entries()) {
    const countMap = new Map<PltsWeatherKey, { count: number; label: string }>();
    let sunnyDays = 0;
    let cloudyDays = 0;
    let rainyDays = 0;
    for (const d of dList) {
      const prev = countMap.get(d.dominantWeatherKey) || { count: 0, label: d.dominantLabel };
      prev.count += 1;
      countMap.set(d.dominantWeatherKey, prev);

      if (
        d.dominantWeatherKey === "thunderstorm" ||
        d.dominantWeatherKey === "rain_heavy" ||
        d.dominantWeatherKey === "rain_moderate" ||
        d.dominantWeatherKey === "rain_light" ||
        d.dominantWeatherKey === "drizzle"
      ) {
        rainyDays += 1;
      } else if (d.dominantWeatherKey === "clear_day" || d.dominantWeatherKey === "mainly_clear") {
        sunnyDays += 1;
      } else {
        cloudyDays += 1;
      }
    }
    let domKey: PltsWeatherKey = dList[0].dominantWeatherKey;
    let domLabel = dList[0].dominantLabel;
    let bestCnt = -1;
    for (const [k, st] of countMap.entries()) {
      if (st.count > bestCnt || (st.count === bestCnt && WEATHER_SEVERITY_RANK[k] > WEATHER_SEVERITY_RANK[domKey])) {
        bestCnt = st.count;
        domKey = k;
        domLabel = st.label;
      }
    }
    monthly[mStr] = {
      month: mStr,
      dominantWeatherKey: domKey,
      dominantLabel: domLabel,
      avgTempC: avgNums(dList.map((d) => d.avgTempC)),
      avgRadiationWm2: avgNums(dList.map((d) => d.avgRadiationWm2)),
      totalPrecipMm: round1(dList.map((d) => d.totalPrecipMm ?? 0).reduce((a, b) => a + b, 0)),
      recordedDays: dList.length,
      sunnyDays,
      cloudyDays,
      rainyDays,
    };
  }

  return {
    location: FACTORY_WEATHER_LOCATION,
    current,
    targetDate,
    hourly,
    daily,
    monthly,
  };
}
