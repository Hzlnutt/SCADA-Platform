// Alarm siren + short multilingual voice dubbing + browser notification utility for Warehouse 7

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

const ALERT_COOLDOWN_MS = 25000;

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
  }
}

export async function unlockWarehouseAudio(): Promise<boolean> {
  try {
    const ctx = getAudioContext();
    if (ctx && ctx.state === "suspended") {
      await ctx.resume();
    }
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
 * Play a longer multi-pulse SCADA warning siren (~2.35s) using Web Audio API.
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
    const pulses = [
      { start: 0.0, freq: 920, dur: 0.32 },
      { start: 0.36, freq: 680, dur: 0.32 },
      { start: 0.72, freq: 920, dur: 0.32 },
      { start: 1.08, freq: 680, dur: 0.32 },
      { start: 1.48, freq: 980, dur: 0.36 },
      { start: 1.88, freq: 740, dur: 0.42 }
    ];

    for (const p of pulses) {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "triangle";
      osc.frequency.setValueAtTime(p.freq, now + p.start);

      gain.gain.setValueAtTime(0.001, now + p.start);
      gain.gain.exponentialRampToValueAtTime(0.28, now + p.start + 0.025);
      gain.gain.exponentialRampToValueAtTime(0.001, now + p.start + p.dur);

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now + p.start);
      osc.stop(now + p.start + p.dur + 0.02);
    }

    return 2350;
  } catch {
    return 0;
  }
}

function shortenSpeechLocation(location: string): string {
  const m = /baris\s+([a-z0-9]+).*?rak\s+(\d+).*?(?:comp(?:artement|artment)?\s+(\d+))?/i.exec(location);
  if (m) {
    return `${m[1]} ${Number(m[2])}${m[3] ? ` ${Number(m[3])}` : ""}`;
  }
  return location.replace(/[-·]/g, " ").trim();
}

export function buildWarehouseDubbingText(
  violations: WarehouseAlarmViolation[],
  language: WarehouseAlarmLanguage = "id"
): string {
  if (violations.length === 0) return "";
  const first = violations[0];
  const loc = shortenSpeechLocation(first.location || first.deviceId);
  const suhuNum = first.suhu.toFixed(1);

  if (language === "en") {
    if (violations.length === 1) {
      const dir = first.direction === "high" ? "above limit" : "below limit";
      return `Warehouse 7 alarm. ${loc}, ${suhuNum} degrees, ${dir}.`;
    }
    return `Warehouse 7 alarm. ${violations.length} sensors exceeded limits.`;
  }

  const suhuStr = suhuNum.replace(".", " koma ");
  if (violations.length === 1) {
    const dir = first.direction === "high" ? "melebihi batas" : "di bawah batas";
    return `Alarm Gudang 7. ${loc}, suhu ${suhuStr} derajat, ${dir}.`;
  }
  return `Alarm Gudang 7. ${violations.length} sensor melewati batas suhu.`;
}

export function speakWarehouseWarning(text: string, language: WarehouseAlarmLanguage = "id"): boolean {
  if (typeof window === "undefined" || !("speechSynthesis" in window) || !text) {
    return false;
  }
  try {
    const synth = window.speechSynthesis;
    synth.cancel();
    const utter = new SpeechSynthesisUtterance(text);
    const targetLang = language === "en" ? "en-US" : "id-ID";
    utter.lang = targetLang;
    utter.rate = 1.0;
    utter.pitch = 1.03;
    utter.volume = 1;

    const voices = synth.getVoices();
    const prefix = language === "en" ? "en" : "id";
    const matched =
      voices.find((v) => v.lang.toLowerCase() === targetLang.toLowerCase()) ||
      voices.find((v) => v.lang.toLowerCase().startsWith(prefix));
    if (matched) {
      utter.voice = matched;
    }
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
): Promise<{ played: boolean; message: string; title: string }> {
  const title = language === "en" ? "Warehouse 7 Temperature Alarm" : "Peringatan Suhu Gudang 7";
  if (violations.length === 0) return { played: false, message: "", title };
  const message = buildWarehouseDubbingText(violations, language);
  if (isAlarmMuted && !forceImmediate) return { played: false, message, title };

  const now = Date.now();
  if (!forceImmediate && now - lastAlertPlayedAt < ALERT_COOLDOWN_MS) {
    return { played: false, message, title };
  }
  lastAlertPlayedAt = now;

  showBrowserWarehouseNotification(title, message);

  if (pendingSpeechTimer) {
    clearTimeout(pendingSpeechTimer);
    pendingSpeechTimer = null;
  }

  const sirenMs = await playWarningSiren();
  pendingSpeechTimer = setTimeout(() => {
    pendingSpeechTimer = null;
    if (!isAlarmMuted || forceImmediate) {
      speakWarehouseWarning(message, language);
    }
  }, Math.min(2350, sirenMs));

  return { played: true, message, title };
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
        suhu: sampleMax + 1.2,
        threshold: sampleMax,
        direction: "high"
      }
    ],
    language,
    true
  );
  return { message: res.message, title: res.title };
}
