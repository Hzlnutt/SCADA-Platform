// Alarm siren + fluent female multilingual voice dubbing + browser notification utility for Warehouse 7

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
let cachedVoices: SpeechSynthesisVoice[] = [];

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

async function ensureVoicesLoaded(maxWaitMs = 280): Promise<SpeechSynthesisVoice[]> {
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
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      window.speechSynthesis.cancel();
    }
    activeUtterance = null;
  }
}

export async function unlockWarehouseAudio(): Promise<boolean> {
  try {
    const ctx = getAudioContext();
    if (ctx && ctx.state === "suspended") {
      await ctx.resume();
    }
    await ensureVoicesLoaded(150);
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
 * Clean control-room / HVAC BMS two-cycle sweeping alert siren (~2.1s) with warm harmonic filter
 * so it sounds modern, authoritative, and finishes cleanly before voice announcement begins.
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
    const filter = ctx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.setValueAtTime(2400, now);
    filter.Q.setValueAtTime(1.2, now);
    filter.connect(ctx.destination);

    // 2 smooth rising-and-settling industrial SCADA alert sweeps (C5 -> G5 -> E5)
    const cycles = [0.0, 1.05];
    for (const offset of cycles) {
      const t0 = now + offset;
      const tRiseEnd = t0 + 0.42;
      const tHoldEnd = t0 + 0.56;
      const tEnd = t0 + 0.94;

      const oscMain = ctx.createOscillator();
      const oscHarmonic = ctx.createOscillator();
      const gainMain = ctx.createGain();
      const gainHarmonic = ctx.createGain();

      oscMain.type = "sine";
      oscMain.frequency.setValueAtTime(523.25, t0);
      oscMain.frequency.exponentialRampToValueAtTime(783.99, tRiseEnd);
      oscMain.frequency.setValueAtTime(783.99, tHoldEnd);
      oscMain.frequency.exponentialRampToValueAtTime(659.25, tEnd);

      // Subtle upper harmonic shimmer (-15 dB) for crisp industrial presence without harshness
      oscHarmonic.type = "triangle";
      oscHarmonic.frequency.setValueAtTime(1046.5, t0);
      oscHarmonic.frequency.exponentialRampToValueAtTime(1567.98, tRiseEnd);
      oscHarmonic.frequency.setValueAtTime(1567.98, tHoldEnd);
      oscHarmonic.frequency.exponentialRampToValueAtTime(1318.51, tEnd);

      gainMain.gain.setValueAtTime(0.0001, t0);
      gainMain.gain.linearRampToValueAtTime(0.24, t0 + 0.05);
      gainMain.gain.setValueAtTime(0.22, tHoldEnd);
      gainMain.gain.exponentialRampToValueAtTime(0.0001, tEnd);

      gainHarmonic.gain.setValueAtTime(0.0001, t0);
      gainHarmonic.gain.linearRampToValueAtTime(0.045, t0 + 0.05);
      gainHarmonic.gain.setValueAtTime(0.04, tHoldEnd);
      gainHarmonic.gain.exponentialRampToValueAtTime(0.0001, tEnd);

      oscMain.connect(gainMain);
      oscHarmonic.connect(gainHarmonic);
      gainMain.connect(filter);
      gainHarmonic.connect(filter);

      oscMain.start(t0);
      oscHarmonic.start(t0);
      oscMain.stop(tEnd + 0.03);
      oscHarmonic.stop(tEnd + 0.03);
    }

    return 2220;
  } catch {
    return 0;
  }
}

function formatSpokenCode(raw: string): string {
  // Spell letter codes cleanly ("Aa" -> "A A") so Indonesian & English TTS pronounce them distinctly
  return /^[a-z]{1,3}$/i.test(raw) ? raw.toUpperCase().split("").join(" ") : raw;
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
  const shortMatch = /^\s*([a-z]{1,3})-(\d+)(?:-(\d+))?\s*$/i.exec(location);
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
  return location.replace(/[-·]/g, " ").trim();
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
      speechText: `Peringatan Gudang 7. ${spokenLoc}, suhu ${suhuStr} derajat, ${dir}.`,
      displayText: `${displayLoc} · ${suhuNum}°C ${dir} (batas ${first.threshold}°C)`
    };
  }
  return {
    speechText: `Peringatan Gudang 7. ${violations.length} sensor melewati batas suhu.`,
    displayText: `${violations.length} sensor melewati batas (${displayLoc} ${suhuNum}°C)`
  };
}

function selectFluentFemaleVoice(
  voices: SpeechSynthesisVoice[],
  language: WarehouseAlarmLanguage
): { voice: SpeechSynthesisVoice | null; isConfirmedFemale: boolean } {
  if (!voices.length) return { voice: null, isConfirmedFemale: false };

  const maleRegex =
    /\b(david|mark|george|daniel|ryan|guy|christopher|eric|roger|steffan|andrew|brian|alex|fred|aaron|arthur|oliver|thomas|james|richard|sean|lee|rishi|ravi|hemant|prabhat|ardi|andika|rizky|budi|joko|male|man|pria|laki)\b/i;

  const femaleIdRegex = /\b(gadis|damayanti|putri|sari|google bahasa indonesia|female|woman|wanita|perempuan)\b/i;
  const femaleEnRegex =
    /\b(aria|jenny|ava|emma|sonia|libby|natasha|clara|google us english|google uk english female|samantha|karen|serena|victoria|kate|fiona|tessa|moira|allison|susan|zoe|zira|hazel|female|woman)\b/i;

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
      // Strictly prefer Indonesian locales (including legacy Java/Android "in-ID")
      if (!lang.startsWith("id") && !lang.startsWith("in-") && lang !== "in" && !name.includes("indonesia")) {
        continue;
      }
      if (lang === "id-id" || lang === "id") score += 30;
      else score += 15;

      if (maleRegex.test(name)) score -= 220;
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
      // Fluent native Western English ("bule"): US, UK, AU, CA, IE, NZ
      if (!lang.startsWith("en")) continue;

      if (lang === "en-us") score += 36;
      else if (lang === "en-gb") score += 34;
      else if (lang === "en-au" || lang === "en-ca" || lang === "en-ie" || lang === "en-nz") score += 26;
      else if (lang === "en-in" || lang === "en-pk" || lang === "en-sg" || lang === "en-ph") score -= 70;
      else score += 10;

      if (maleRegex.test(name)) score -= 220;

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
    const { voice: matched, isConfirmedFemale } = selectFluentFemaleVoice(availableVoices, language);

    const utter = new SpeechSynthesisUtterance(text);
    const defaultLang = language === "en" ? "en-US" : "id-ID";
    utter.lang = matched?.lang || defaultLang;
    // Calm, articulate, unhurried pace so announcements are clear and fluent
    utter.rate = 0.86;
    utter.pitch = isConfirmedFemale ? 1.04 : 1.12;
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

  await ensureVoicesLoaded(250);
  const sirenMs = await playWarningSiren();
  pendingSpeechTimer = setTimeout(() => {
    pendingSpeechTimer = null;
    if (!isAlarmMuted || forceImmediate) {
      speakWarehouseWarning(speechText, language);
    }
  }, Math.min(2300, sirenMs));

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
