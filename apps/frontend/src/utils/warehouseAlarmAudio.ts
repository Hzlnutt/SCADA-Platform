// Alarm sound + Indonesian speech dubbing utility for Warehouse 7 temperature threshold breaches

export interface WarehouseAlarmViolation {
  deviceId: string;
  location: string;
  suhu: number;
  threshold: number;
  direction: "high" | "low";
}

let sharedAudioCtx: AudioContext | null = null;
let lastAlertPlayedAt = 0;
let isAlarmMuted = false;

const ALERT_COOLDOWN_MS = 25000;

function getAudioContext(): AudioContext | null {
  if (typeof window === "undefined") return null;
  const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
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
  if (muted && typeof window !== "undefined" && "speechSynthesis" in window) {
    window.speechSynthesis.cancel();
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

/**
 * Play a crisp 3-pulse SCADA warning chime using Web Audio API (returns total duration in ms).
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
      { start: 0, freq: 880, dur: 0.18 },
      { start: 0.22, freq: 660, dur: 0.18 },
      { start: 0.44, freq: 980, dur: 0.25 }
    ];

    for (const p of pulses) {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "triangle";
      osc.frequency.setValueAtTime(p.freq, now + p.start);

      gain.gain.setValueAtTime(0.001, now + p.start);
      gain.gain.exponentialRampToValueAtTime(0.24, now + p.start + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, now + p.start + p.dur);

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now + p.start);
      osc.stop(now + p.start + p.dur + 0.02);
    }

    return 750;
  } catch {
    return 0;
  }
}

export function buildWarehouseDubbingText(violations: WarehouseAlarmViolation[]): string {
  if (violations.length === 0) return "";
  if (violations.length === 1) {
    const v = violations[0];
    const suhuStr = v.suhu.toFixed(1).replace(".", " koma ");
    const limitStr = v.threshold.toFixed(1).replace(".", " koma ");
    const detail =
      v.direction === "high"
        ? `melebihi batas maksimum ${limitStr} derajat Celsius`
        : `di bawah batas minimum ${limitStr} derajat Celsius`;
    return `Peringatan alarm Warehouse 7. Suhu pada ${v.location} mencapai ${suhuStr} derajat Celsius, ${detail}. Segera periksa kondisi pendingin gudang.`;
  }

  const first = violations[0];
  const suhuStr = first.suhu.toFixed(1).replace(".", " koma ");
  const limitStr = first.threshold.toFixed(1).replace(".", " koma ");
  const detail =
    first.direction === "high"
      ? `melebihi batas maksimum ${limitStr} derajat Celsius`
      : `di bawah batas minimum ${limitStr} derajat Celsius`;
  return `Peringatan alarm Warehouse 7. Terdeteksi ${violations.length} titik sensor melewati batas suhu. Pada ${first.location} suhu mencapai ${suhuStr} derajat Celsius, ${detail}.`;
}

export function speakIndonesianWarning(text: string): boolean {
  if (typeof window === "undefined" || !("speechSynthesis" in window) || !text) {
    return false;
  }
  try {
    const synth = window.speechSynthesis;
    synth.cancel();
    const utter = new SpeechSynthesisUtterance(text);
    utter.lang = "id-ID";
    utter.rate = 0.98;
    utter.pitch = 1.04;
    utter.volume = 1;

    const voices = synth.getVoices();
    const idVoice =
      voices.find((v) => v.lang.toLowerCase() === "id-id") ||
      voices.find((v) => v.lang.toLowerCase().startsWith("id"));
    if (idVoice) {
      utter.voice = idVoice;
    }
    synth.speak(utter);
    return true;
  } catch {
    return false;
  }
}

export async function triggerWarehouseAlarmAudio(
  violations: WarehouseAlarmViolation[],
  forceImmediate = false
): Promise<{ played: boolean; message: string }> {
  if (violations.length === 0) return { played: false, message: "" };
  const message = buildWarehouseDubbingText(violations);
  if (isAlarmMuted && !forceImmediate) return { played: false, message };

  const now = Date.now();
  if (!forceImmediate && now - lastAlertPlayedAt < ALERT_COOLDOWN_MS) {
    return { played: false, message };
  }
  lastAlertPlayedAt = now;

  const sirenMs = await playWarningSiren();
  setTimeout(() => {
    if (!isAlarmMuted || forceImmediate) {
      speakIndonesianWarning(message);
    }
  }, Math.min(800, sirenMs));

  return { played: true, message };
}

export async function testWarehouseAlarmVoice(sampleMax = 30): Promise<void> {
  await unlockWarehouseAudio();
  await triggerWarehouseAlarmAudio(
    [
      {
        deviceId: "WH7-TEST",
        location: "Baris Aa Rak 10 Comp 4",
        suhu: sampleMax + 1.2,
        threshold: sampleMax,
        direction: "high"
      }
    ],
    true
  );
}
