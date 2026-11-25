import { useCallback, useEffect, useRef, useState } from "react";
import { buildApiUrl } from "../../services/api.client";

type SignalQuality = "good" | "unstable" | "poor";

interface PingSample {
  ok: boolean;
  rttMs: number | null;
  ts: number;
}

interface NetworkInfoLike {
  effectiveType?: string;
  addEventListener?: (type: string, listener: () => void) => void;
  removeEventListener?: (type: string, listener: () => void) => void;
}

const MAX_SAMPLES = 4;
const PING_INTERVAL_MS = 5000;
const PING_TIMEOUT_MS = 4000;

function getBrowserConnection(): NetworkInfoLike | null {
  if (typeof navigator === "undefined") return null;
  const nav = navigator as unknown as {
    connection?: NetworkInfoLike;
    mozConnection?: NetworkInfoLike;
    webkitConnection?: NetworkInfoLike;
  };
  return nav.connection || nav.mozConnection || nav.webkitConnection || null;
}

export const NetworkSignalIndicator = () => {
  const [isOnline, setIsOnline] = useState<boolean>(() =>
    typeof navigator !== "undefined" ? navigator.onLine : true
  );
  const [samples, setSamples] = useState<PingSample[]>([]);
  const [effectiveType, setEffectiveType] = useState<string>(() => {
    const conn = getBrowserConnection();
    return (conn?.effectiveType || "").toLowerCase();
  });
  const containerRef = useRef<HTMLDivElement | null>(null);
  const inFlightRef = useRef(false);

  const measurePing = useCallback(async () => {
    if (typeof window === "undefined") return;
    if (!navigator.onLine) {
      setIsOnline(false);
      setSamples((prev) => [...prev.slice(-(MAX_SAMPLES - 1)), { ok: false, rttMs: null, ts: Date.now() }]);
      return;
    }
    if (document.hidden || inFlightRef.current) return;
    // Avoid duplicate pings from hidden mobile/desktop Topbar twin instance
    if (containerRef.current && containerRef.current.offsetParent === null) return;

    inFlightRef.current = true;
    const controller = new AbortController();
    const timer = window.setTimeout(() => controller.abort(), PING_TIMEOUT_MS);
    const started = performance.now();

    try {
      const url = `${buildApiUrl("/ping")}?t=${Date.now()}`;
      const res = await fetch(url, {
        method: "GET",
        cache: "no-store",
        signal: controller.signal
      });
      const rttMs = Math.max(1, Math.round(performance.now() - started));
      const ok = res.status < 500;
      setIsOnline(true);
      setSamples((prev) => [...prev.slice(-(MAX_SAMPLES - 1)), { ok, rttMs: ok ? rttMs : null, ts: Date.now() }]);
    } catch {
      setSamples((prev) => [...prev.slice(-(MAX_SAMPLES - 1)), { ok: false, rttMs: null, ts: Date.now() }]);
    } finally {
      window.clearTimeout(timer);
      inFlightRef.current = false;
    }
  }, []);

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      void measurePing();
    };
    const handleOffline = () => {
      setIsOnline(false);
      setSamples((prev) => [...prev.slice(-(MAX_SAMPLES - 1)), { ok: false, rttMs: null, ts: Date.now() }]);
    };
    const handleConnChange = () => {
      const conn = getBrowserConnection();
      setEffectiveType((conn?.effectiveType || "").toLowerCase());
      void measurePing();
    };
    const handleVisibility = () => {
      if (!document.hidden) void measurePing();
    };

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    document.addEventListener("visibilitychange", handleVisibility);

    const conn = getBrowserConnection();
    conn?.addEventListener?.("change", handleConnChange);

    // Slight startup delay so initial cold-boot API burst does not skew first ping RTT
    const bootTimer = window.setTimeout(() => {
      void measurePing();
    }, 1200);
    const interval = window.setInterval(() => {
      void measurePing();
    }, PING_INTERVAL_MS);

    return () => {
      window.clearTimeout(bootTimer);
      window.clearInterval(interval);
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
      document.removeEventListener("visibilitychange", handleVisibility);
      conn?.removeEventListener?.("change", handleConnChange);
    };
  }, [measurePing]);

  // Evaluate connection quality from latest ping samples & browser network state
  const latestSample = samples.length > 0 ? samples[samples.length - 1] : null;
  const prevSample = samples.length > 1 ? samples[samples.length - 2] : null;
  const failedCount = samples.filter((s) => !s.ok).length;

  let consecutiveFails = 0;
  for (let i = samples.length - 1; i >= 0; i--) {
    if (!samples[i].ok) consecutiveFails++;
    else break;
  }

  const latestRtt = latestSample?.ok ? latestSample.rttMs : null;
  const prevRtt = prevSample?.ok ? prevSample.rttMs : null;
  const recentDelta = latestRtt !== null && prevRtt !== null ? Math.abs(latestRtt - prevRtt) : 0;

  let quality: SignalQuality = "good";
  if (
    !isOnline ||
    consecutiveFails >= 2 ||
    (latestRtt !== null && latestRtt > 800) ||
    effectiveType === "slow-2g" ||
    effectiveType === "2g"
  ) {
    quality = "poor";
  } else if (
    (latestSample !== null && !latestSample.ok) ||
    failedCount >= 2 ||
    (latestRtt !== null && latestRtt >= 280) ||
    (recentDelta >= 180 && (latestRtt ?? 0) >= 120) ||
    effectiveType === "3g"
  ) {
    quality = "unstable";
  }

  const statusText =
    quality === "good"
      ? "Good connection"
      : quality === "unstable"
      ? "Unstable connection"
      : "Bad connection";

  // 3 Wi-Fi levels: good = 3 green, unstable = 2 yellow/amber, poor = 1 red (bottom only)
  const activeColor =
    quality === "good"
      ? "text-emerald-500"
      : quality === "unstable"
      ? "text-amber-500"
      : "text-red-500";

  const activeGlow =
    quality === "good"
      ? "drop-shadow-[0_0_4px_rgba(16,185,129,0.55)]"
      : quality === "unstable"
      ? "drop-shadow-[0_0_4px_rgba(245,158,11,0.55)]"
      : "drop-shadow-[0_0_4px_rgba(239,68,68,0.6)]";

  const inactiveColor = "text-slate-300 dark:text-slate-600/70";
  const level2Active = quality === "good" || quality === "unstable";
  const level3Active = quality === "good";

  return (
    <div
      ref={containerRef}
      className="relative group inline-flex items-center justify-center shrink-0 select-none px-1 py-0.5 cursor-default"
      role="status"
      aria-label={statusText}
    >
      {/* Minimal modern 3-level borderless Wi-Fi icon */}
      <svg
        viewBox="0 0 24 24"
        className="h-[22px] w-[22px] overflow-visible"
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        {/* Level 3 (outer arc): lit only on Good (green) */}
        <path
          d="M4.29 10.29a10.9 10.9 0 0 1 15.42 0"
          stroke="currentColor"
          strokeWidth="2.5"
          className={`transition-colors duration-300 ${
            level3Active ? `${activeColor} ${activeGlow}` : inactiveColor
          }`}
        />
        {/* Level 2 (middle arc): lit on Good (green) & Unstable (yellow) */}
        <path
          d="M7.55 13.55a6.3 6.3 0 0 1 8.9 0"
          stroke="currentColor"
          strokeWidth="2.5"
          className={`transition-colors duration-300 ${
            level2Active ? `${activeColor} ${activeGlow}` : inactiveColor
          }`}
        />
        {/* Level 1 (bottom dot): always lit with active signal color (red/yellow/green) */}
        <circle
          cx="12"
          cy="18"
          r="2.15"
          fill="currentColor"
          className={`transition-colors duration-300 ${activeColor} ${activeGlow}`}
        />
      </svg>

      {/* Minimal hover label only: Good / Unstable / Bad connection */}
      <span
        className="pointer-events-none absolute right-0 top-full mt-1.5 whitespace-nowrap rounded-md bg-slate-900/95 dark:bg-slate-800 px-2.5 py-1 text-[11px] font-medium text-white shadow-md opacity-0 translate-y-0.5 transition-all duration-150 group-hover:opacity-100 group-hover:translate-y-0 z-50"
      >
        {statusText}
      </span>
    </div>
  );
};
