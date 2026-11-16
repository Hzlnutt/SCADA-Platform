// Alarm siren (3x high peaks) + unified female multilingual voice dubbing + browser notification utility for Warehouse 7
import { getAudioBuffer } from "../services/api.client";

export interface WarehouseAlarmViolation {
  deviceId: string;
  location: string;
  suhu: number;
  threshold: number;
  direction: "high" | "low";
}

export type WarehouseAlarmLanguage = "id" | "en";

let sharedAudioCtx: AudioContext | null = null;
let lastAlertPlayedAt = 0;
let isAlarmMuted = true; // Default disabled per account until explicitly enabled
let pendingSpeechTimer: ReturnType<typeof setTimeout> | null = null;
let activeUtterance: SpeechSynthesisUtterance | null = null;
let activeAudioEl: HTMLAudioElement | null = null;
let activeAudioBlobUrl: string | null = null;
let activeBufferSource: AudioBufferSourceNode | null = null;
let cachedVoices: SpeechSynthesisVoice[] = [];
const clientTtsCache = new Map<string, ArrayBuffer>();

const ALERT_COOLDOWN_MS = 25000;

function initSpeechVoicesCache(): void {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
  try {
    const synth = window.speechSynthesis;
    const loaded = synth.getVoices();
    if (loaded.length > 0) {
      cachedVoices = loaded;
    }
    if (typeof synth.addEventListener === "function") {
      synth.addEventListener("voiceschanged", () => {
        const updated = synth.getVoices();
        if (updated.length > 0) {
          cachedVoices = updated;
        }
      });
    }
  } catch {
    // Non-fatal in unsupported browsers
  }
}

initSpeechVoicesCache();

function stopActiveSpeechPlayback(): void {
  if (typeof window !== "undefined" && "speechSynthesis" in window) {
    window.speechSynthesis.cancel();
  }
  activeUtterance = null;
  if (activeAudioEl) {
    try {
      activeAudioEl.pause();
      activeAudioEl.src = "";
    } catch {}
    activeAudioEl = null;
  }
  if (activeAudioBlobUrl) {
    try {
      URL.revokeObjectURL(activeAudioBlobUrl);
    } catch {}
    activeAudioBlobUrl = null;
  }
  if (activeBufferSource) {
    try {
      activeBufferSource.stop();
      activeBufferSource.disconnect();
    } catch {}
    activeBufferSource = null;
  }
}

async function ensureVoicesLoaded(maxWaitMs = 500): Promise<SpeechSynthesisVoice[]> {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) return [];
  const synth = window.speechSynthesis;
  const immediate = synth.getVoices();
  if (immediate.length > 0) {
    cachedVoices = immediate;
    return immediate;
  }
  if (cachedVoices.length > 0) return cachedVoices;

  return new Promise((resolve) => {
    let settled = false;
    const finish = () => {
      if (settled) return;
      settled = true;
      const list = synth.getVoices();
      if (list.length > 0) cachedVoices = list;
      resolve(cachedVoices);
    };
    const timer = setTimeout(finish, maxWaitMs);
    if (typeof synth.addEventListener === "function") {
      const onChanged = () => {
        clearTimeout(timer);
        synth.removeEventListener("voiceschanged", onChanged);
        finish();
      };
      synth.addEventListener("voiceschanged", onChanged);
    }
  });
}

function getAudioContext(): AudioContext | null {
  if (typeof window === "undefined") return null;
  const AudioCtx =
    window.AudioContext ||
    (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AudioCtx) return null;
  if (!sharedAudioCtx) {
    sharedAudioCtx = new AudioCtx();
  }
  return sharedAudioCtx;
}

export function isWarehouseAlarmMuted(): boolean {
  return isAlarmMuted;
}

export function setWarehouseAlarmMuted(muted: boolean): void {
  isAlarmMuted = muted;
  if (muted) {
    if (pendingSpeechTimer) {
      clearTimeout(pendingSpeechTimer);
      pendingSpeechTimer = null;
    }
    stopActiveSpeechPlayback();
  }
}

export async function unlockWarehouseAudio(): Promise<boolean> {
  try {
    const ctx = getAudioContext();
    if (ctx && ctx.state === "suspended") {
      await ctx.resume();
    }
    await ensureVoicesLoaded(200);
    return Boolean(ctx && ctx.state === "running");
  } catch {
    return false;
  }
}

export async function requestWarehouseNotificationPermission(): Promise<void> {
  if (typeof window === "undefined" || !("Notification" in window)) return;
  try {
    if (Notification.permission === "default") {
      await Notification.requestPermission();
    }
  } catch {
    // Non-fatal in unsupported/iframe contexts
  }
}

export function showBrowserWarehouseNotification(title: string, body: string): void {
  if (typeof window === "undefined" || !("Notification" in window)) return;
  try {
    if (Notification.permission === "granted") {
      new Notification(title, {
        body,
        tag: "scada-wh7-temp-alarm"
      });
    }
  } catch {
    // Non-fatal
  }
}

/**
 * Clean, authoritative industrial SCADA alarm siren with 3 distinct rising HIGH-TONE peaks (~2.15s)
 * passed through dynamics limiting & smooth low-pass filtering for clarity without speaker harshness.
 */
export async function playWarningSiren(): Promise<number> {
  const ctx = getAudioContext();
  if (!ctx) return 0;

  try {
    if (ctx.state === "suspended") {
      await ctx.resume();
    }
    if (ctx.state !== "running") return 0;

    const now = ctx.currentTime;
    const compressor = ctx.createDynamicsCompressor();
    compressor.threshold.setValueAtTime(-10, now);
    compressor.ratio.setValueAtTime(6, now);

    const filter = ctx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.setValueAtTime(3800, now);
    filter.Q.setValueAtTime(1.1, now);

    filter.connect(compressor);
    compressor.connect(ctx.destination);

    // 3x crisp high-pitch SCADA alert pulses: quick sweep up to 1760Hz -> 1975Hz high peak, clean release
    const pulseStarts = [0.0, 0.72, 1.44];
    for (let i = 0; i < pulseStarts.length; i++) {
      const t0 = now + pulseStarts[i];
      const tSweep = t0 + 0.14;
      const tPeakHold = t0 + (i === 2 ? 0.44 : 0.38);
      const tEnd = t0 + (i === 2 ? 0.62 : 0.56);

      const oscMain = ctx.createOscillator();
      const oscAccent = ctx.createOscillator();
      const gainMain = ctx.createGain();
      const gainAccent = ctx.createGain();

      oscMain.type = "sine";
      oscMain.frequency.setValueAtTime(880, t0);
      oscMain.frequency.exponentialRampToValueAtTime(1760, tSweep);
      oscMain.frequency.exponentialRampToValueAtTime(1975.5, tPeakHold);
      oscMain.frequency.exponentialRampToValueAtTime(1174.66, tEnd);

      // Subtle triangle layer (-13 dB) adds clean industrial horn definition
      oscAccent.type = "triangle";
      oscAccent.frequency.setValueAtTime(880, t0);
      oscAccent.frequency.exponentialRampToValueAtTime(1760, tSweep);
      oscAccent.frequency.exponentialRampToValueAtTime(1975.5, tPeakHold);
      oscAccent.frequency.exponentialRampToValueAtTime(1174.66, tEnd);

      gainMain.gain.setValueAtTime(0.0001, t0);
      gainMain.gain.linearRampToValueAtTime(0.28, t0 + 0.035);
      gainMain.gain.setValueAtTime(0.26, tPeakHold);
      gainMain.gain.exponentialRampToValueAtTime(0.0001, tEnd);

      gainAccent.gain.setValueAtTime(0.0001, t0);
      gainAccent.gain.linearRampToValueAtTime(0.07, t0 + 0.035);
      gainAccent.gain.setValueAtTime(0.06, tPeakHold);
      gainAccent.gain.exponentialRampToValueAtTime(0.0001, tEnd);

      oscMain.connect(gainMain);
      oscAccent.connect(gainAccent);
      gainMain.connect(filter);
      gainAccent.connect(filter);

      oscMain.start(t0);
      oscAccent.start(t0);
      oscMain.stop(tEnd + 0.03);
      oscAccent.stop(tEnd + 0.03);
    }

    return 2260;
  } catch {
    return 0;
  }
}

function formatSpokenCode(raw: string): string {
  // Separate every letter clearly ("Aa" -> "A, A") so TTS speaks distinct letters rather than merging vowels into "aa"
  return /^[a-z]{1,4}$/i.test(raw) ? raw.toUpperCase().split("").join(", ") : raw;
}

function parseLocationParts(location: string): { row?: string; rack?: number; comp?: number } | null {
  const fullMatch = /baris\s+([a-z0-9]+).*?rak\s+(\d+)(?:.*?comp(?:artement|artment)?\s+(\d+))?/i.exec(location);
  if (fullMatch) {
    return {
      row: fullMatch[1],
      rack: Number(fullMatch[2]),
      comp: fullMatch[3] ? Number(fullMatch[3]) : undefined
    };
  }
  const shortMatch = /^\s*([a-z]{1,4})-(\d+)(?:-(\d+))?\s*$/i.exec(location);
  if (shortMatch) {
    return {
      row: shortMatch[1],
      rack: Number(shortMatch[2]),
      comp: shortMatch[3] ? Number(shortMatch[3]) : undefined
    };
  }
  return null;
}

function formatSpeechLocation(location: string, language: WarehouseAlarmLanguage): string {
  const parts = parseLocationParts(location);
  if (parts?.row && parts.rack !== undefined) {
    const rowSpoken = formatSpokenCode(parts.row);
    return language === "en" ? `Row ${rowSpoken}, Rack ${parts.rack}` : `Baris ${rowSpoken}, Rak ${parts.rack}`;
  }
  return location
    .replace(/[-·]/g, " ")
    .replace(/\b([a-z]{2,3})\b/gi, (m) => (/^(di|ke|on|in|to|of|at|rak|row|baris|rack|and|the|for|min|max|api)$/i.test(m) ? m : m.toUpperCase().split("").join(", ")))
    .trim();
}

function formatShortDisplayLocation(location: string): string {
  const parts = parseLocationParts(location);
  if (parts?.row && parts.rack !== undefined) {
    const rackStr = String(parts.rack).padStart(2, "0");
    return parts.comp !== undefined
      ? `${parts.row}-${rackStr}-${String(parts.comp).padStart(2, "0")}`
      : `${parts.row}-${rackStr}`;
  }
  return location.trim();
}

export function buildWarehouseAlertMessages(
  violations: WarehouseAlarmViolation[],
  language: WarehouseAlarmLanguage = "id"
): { speechText: string; displayText: string } {
  if (violations.length === 0) return { speechText: "", displayText: "" };
  const first = violations[0];
  const rawLoc = first.location || first.deviceId;
  const spokenLoc = formatSpeechLocation(rawLoc, language);
  const displayLoc = formatShortDisplayLocation(rawLoc);
  const suhuNum = first.suhu.toFixed(1);

  if (language === "en") {
    if (violations.length === 1) {
      const dir = first.direction === "high" ? "above the limit" : "below the limit";
      const badge = first.direction === "high" ? "above limit" : "below limit";
      return {
        speechText: `Warehouse 7 alert. ${spokenLoc}, ${suhuNum} degrees Celsius, ${dir}.`,
        displayText: `${displayLoc} · ${suhuNum}°C ${badge} (limit ${first.threshold}°C)`
      };
    }
    return {
      speechText: `Warehouse 7 alert. ${violations.length} sensors exceeded temperature limits.`,
      displayText: `${violations.length} sensors out of range (${displayLoc} ${suhuNum}°C)`
    };
  }

  const suhuStr = suhuNum.replace(".", " koma ");
  if (violations.length === 1) {
    const dir = first.direction === "high" ? "melebihi batas" : "di bawah batas";
    return {
      speechText: `Peringatan, Gudang 7. ${spokenLoc}, suhu ${suhuStr} derajat, ${dir}.`,
      displayText: `${displayLoc} · ${suhuNum}°C ${dir} (batas ${first.threshold}°C)`
    };
  }
  return {
    speechText: `Peringatan, Gudang 7. ${violations.length} sensor melewati batas suhu.`,
    displayText: `${violations.length} sensor melewati batas (${displayLoc} ${suhuNum}°C)`
  };
}

function selectFluentFemaleVoice(
  voices: SpeechSynthesisVoice[],
  language: WarehouseAlarmLanguage
): { voice: SpeechSynthesisVoice | null; isConfirmedFemale: boolean } {
  if (!voices.length) return { voice: null, isConfirmedFemale: false };

  const maleRegex =
    /\b(david|mark|george|daniel|ryan|guy|christopher|eric|roger|steffan|andrew|brian|alex|fred|aaron|arthur|oliver|thomas|james|richard|sean|lee|rishi|ravi|hemant|prabhat|eddy|reed|rocko|grandpa|ardi|andika|rizky|budi|joko|male|man|pria|laki)\b/i;

  const femaleIdRegex = /\b(gadis|damayanti|putri|sari|google bahasa indonesia|female|woman|wanita|perempuan)\b/i;
  const femaleEnRegex =
    /\b(aria|jenny|ava|emma|sonia|libby|natasha|clara|google us english|google uk english female|samantha|karen|serena|victoria|kate|fiona|tessa|moira|allison|susan|zoe|zira|hazel|sandy|shelley|flo|grandma|female|woman)\b/i;

  const isNatural = (name: string) => /\b(natural|neural|online|google)\b/i.test(name);

  let bestVoice: SpeechSynthesisVoice | null = null;
  let bestScore = -9999;
  let bestIsFemale = false;

  for (const v of voices) {
    const lang = v.lang.toLowerCase();
    const name = v.name.toLowerCase();
    let score = 0;
    let confirmedFemale = false;

    if (language === "id") {
      if (!lang.startsWith("id") && !lang.startsWith("in-") && lang !== "in" && !name.includes("indonesia")) {
        continue;
      }
      if (lang === "id-id" || lang === "id") score += 30;
      else score += 15;

      if (maleRegex.test(name)) score -= 240;
      if (name.includes("gadis")) {
        score += 150;
        confirmedFemale = true;
      } else if (name.includes("google") && name.includes("indonesia")) {
        score += 140;
        confirmedFemale = true;
      } else if (name.includes("damayanti")) {
        score += 125;
        confirmedFemale = true;
      } else if (femaleIdRegex.test(name)) {
        score += 110;
        confirmedFemale = true;
      }

      if (isNatural(name)) score += 45;
      if (name.includes("espeak")) score -= 80;
    } else {
      if (!lang.startsWith("en")) continue;

      if (lang === "en-us") score += 36;
      else if (lang === "en-gb") score += 34;
      else if (lang === "en-au" || lang === "en-ca" || lang === "en-ie" || lang === "en-nz") score += 26;
      else if (lang === "en-in" || lang === "en-pk" || lang === "en-sg" || lang === "en-ph") score -= 70;
      else score += 10;

      if (maleRegex.test(name)) score -= 240;

      if (/\b(aria|jenny|ava|emma|sonia|libby|natasha|clara)\b/i.test(name) && isNatural(name)) {
        score += 155;
        confirmedFemale = true;
      } else if (name.includes("google uk english female")) {
        score += 148;
        confirmedFemale = true;
      } else if (name.includes("google us english")) {
        score += 145;
        confirmedFemale = true;
      } else if (femaleEnRegex.test(name)) {
        score += 120;
        confirmedFemale = true;
      }

      if (isNatural(name)) score += 45;
      if (name.includes("espeak")) score -= 80;
    }

    if (score > bestScore) {
      bestScore = score;
      bestVoice = v;
      bestIsFemale = confirmedFemale;
    }
  }

  return { voice: bestVoice, isConfirmedFemale: bestIsFemale };
}

async function fetchServerFemaleTtsBuffer(text: string, language: WarehouseAlarmLanguage): Promise<ArrayBuffer | null> {
  const key = `${language}:${text}`;
  const cached = clientTtsCache.get(key);
  if (cached) return cached;

  const buf = await getAudioBuffer(`/warehouse/wh7/tts?lang=${language}&text=${encodeURIComponent(text)}`);
  if (buf && buf.byteLength > 256) {
    if (clientTtsCache.size >= 40) {
      const oldest = clientTtsCache.keys().next().value;
      if (oldest) clientTtsCache.delete(oldest);
    }
    clientTtsCache.set(key, buf);
    return buf;
  }
  return null;
}

async function playAudioBufferFemaleVoice(arrayBuffer: ArrayBuffer): Promise<boolean> {
  if (typeof window === "undefined") return false;
  stopActiveSpeechPlayback();

  try {
    const blob = new Blob([arrayBuffer], { type: "audio/mpeg" });
    const url = URL.createObjectURL(blob);
    const audio = new Audio(url);
    audio.volume = 1.0;
    audio.playbackRate = 0.87;
    (audio as unknown as { preservesPitch?: boolean; mozPreservesPitch?: boolean; webkitPreservesPitch?: boolean }).preservesPitch = true;
    (audio as unknown as { mozPreservesPitch?: boolean }).mozPreservesPitch = true;
    (audio as unknown as { webkitPreservesPitch?: boolean }).webkitPreservesPitch = true;

    activeAudioEl = audio;
    activeAudioBlobUrl = url;
    audio.onended = () => {
      if (activeAudioBlobUrl === url) {
        URL.revokeObjectURL(url);
        activeAudioBlobUrl = null;
      }
      if (activeAudioEl === audio) activeAudioEl = null;
    };

    await audio.play();
    return true;
  } catch {
    // Fallback to already-unlocked AudioContext if background tab blocked HTML5 Audio.play()
    if (activeAudioBlobUrl) {
      try {
        URL.revokeObjectURL(activeAudioBlobUrl);
      } catch {}
      activeAudioBlobUrl = null;
    }
    activeAudioEl = null;
  }

  try {
    const ctx = getAudioContext();
    if (!ctx) return false;
    if (ctx.state === "suspended") await ctx.resume();
    if (ctx.state !== "running") return false;

    const decoded = await ctx.decodeAudioData(arrayBuffer.slice(0));
    const src = ctx.createBufferSource();
    src.buffer = decoded;
    src.playbackRate.value = 1.0; // Keep pitch pure when playing via AudioBufferSourceNode
    src.connect(ctx.destination);
    activeBufferSource = src;
    src.onended = () => {
      if (activeBufferSource === src) activeBufferSource = null;
    };
    src.start(0);
    return true;
  } catch {
    return false;
  }
}

export function speakWarehouseWarning(text: string, language: WarehouseAlarmLanguage = "id"): boolean {
  if (typeof window === "undefined" || !("speechSynthesis" in window) || !text) {
    return false;
  }
  try {
    const synth = window.speechSynthesis;
    if (synth.speaking || synth.pending) {
      synth.cancel();
    }

    const voices = synth.getVoices();
    const availableVoices = voices.length > 0 ? voices : cachedVoices;
    let { voice: matched, isConfirmedFemale } = selectFluentFemaleVoice(availableVoices, language);

    // Prevent Windows Chrome/Firefox from silently falling back to male Microsoft David/Andika when no ID voice is installed
    if (!matched && language === "id" && availableVoices.length > 0) {
      const ziraOrFemaleEn = selectFluentFemaleVoice(availableVoices, "en");
      if (ziraOrFemaleEn.isConfirmedFemale && ziraOrFemaleEn.voice) {
        matched = ziraOrFemaleEn.voice;
        isConfirmedFemale = true;
      }
    }

    const utter = new SpeechSynthesisUtterance(text);
    const defaultLang = language === "en" ? "en-US" : "id-ID";
    utter.lang = matched?.lang || defaultLang;
    utter.rate = 0.86;
    utter.pitch = isConfirmedFemale ? 1.04 : 1.15;
    utter.volume = 1;

    if (matched) {
      utter.voice = matched;
    }

    activeUtterance = utter;
    utter.onend = () => {
      if (activeUtterance === utter) activeUtterance = null;
    };
    utter.onerror = () => {
      if (activeUtterance === utter) activeUtterance = null;
    };

    synth.speak(utter);
    return true;
  } catch {
    return false;
  }
}

export async function triggerWarehouseAlarmAudio(
  violations: WarehouseAlarmViolation[],
  language: WarehouseAlarmLanguage = "id",
  forceImmediate = false
): Promise<{ played: boolean; message: string; speechMessage: string; title: string }> {
  const title = language === "en" ? "Warehouse 7 Temperature Alarm" : "Peringatan Suhu Gudang 7";
  if (violations.length === 0) {
    return { played: false, message: "", speechMessage: "", title };
  }
  const { speechText, displayText } = buildWarehouseAlertMessages(violations, language);
  if (isAlarmMuted && !forceImmediate) {
    return { played: false, message: displayText, speechMessage: speechText, title };
  }

  const now = Date.now();
  if (!forceImmediate && now - lastAlertPlayedAt < ALERT_COOLDOWN_MS) {
    return { played: false, message: displayText, speechMessage: speechText, title };
  }
  lastAlertPlayedAt = now;

  showBrowserWarehouseNotification(title, displayText);

  if (pendingSpeechTimer) {
    clearTimeout(pendingSpeechTimer);
    pendingSpeechTimer = null;
  }

  // Start loading consistent server female TTS audio & browser voices while siren plays
  const serverTtsPromise = fetchServerFemaleTtsBuffer(speechText, language);
  void ensureVoicesLoaded(400);

  const sirenMs = await playWarningSiren();
  pendingSpeechTimer = setTimeout(async () => {
    pendingSpeechTimer = null;
    if (isAlarmMuted && !forceImmediate) return;

    const serverAudio = await serverTtsPromise.catch(() => null);
    if (serverAudio) {
      const ok = await playAudioBufferFemaleVoice(serverAudio);
      if (ok) return;
    }
    speakWarehouseWarning(speechText, language);
  }, Math.min(2320, sirenMs));

  return { played: true, message: displayText, speechMessage: speechText, title };
}

export async function testWarehouseAlarmVoice(
  sampleMax = 30,
  language: WarehouseAlarmLanguage = "id"
): Promise<{ message: string; title: string }> {
  await unlockWarehouseAudio();
  await requestWarehouseNotificationPermission();
  const res = await triggerWarehouseAlarmAudio(
    [
      {
        deviceId: "WH7-TEST",
        location: "Aa-10-04",
        suhu: +(sampleMax + 1.2).toFixed(1),
        threshold: sampleMax,
        direction: "high"
      }
    ],
    language,
    true
  );
  return { message: res.message, title: res.title };
}
