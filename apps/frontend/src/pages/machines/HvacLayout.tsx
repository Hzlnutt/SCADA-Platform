import { type ReactNode, useState, useEffect, useRef, useMemo } from "react";
import { useAuthStore } from "../../store/auth.store";
import { verifyBiometrics, verifyPassword } from "../../services/auth.service";

export interface SetpointConfig {
  label: string;
  value: number;
  unit: string;
  min: number;
  max: number;
  step?: number;
  onChange: (val: number) => void;
}

export interface SystemModeItem {
  label: string;
  value: string;
  statusColor?: "cyan" | "green" | "red" | "yellow" | "default";
}

export interface ControlButtonItem {
  label: string;
  onClick: () => void;
  variant: "cyan" | "red" | "blue" | "slate" | "green" | "orange";
  icon?: ReactNode;
}

// Inline SVG Icons for AHU Status & Controls
const startIcon = (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5">
    <path strokeLinecap="round" strokeLinejoin="round" d="M5.25 5.653c0-.856.917-1.398 1.667-.986l11.54 6.348a1.125 1.125 0 010 1.971l-11.54 6.347a1.125 1.125 0 01-1.667-.985V5.653z" />
  </svg>
);

const stopIcon = (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5">
    <rect x="5.25" y="5.25" width="13.5" height="13.5" rx="1.5" />
  </svg>
);

const maintenanceIcon = (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5">
    <path strokeLinecap="round" strokeLinejoin="round" d="M10.343 3.94c.09-.542.56-.94 1.11-.94h1.093c.55 0 1.02.398 1.11.94l.149.894c.07.424.384.764.78.93.398.164.855.142 1.205-.108l.737-.527a1.125 1.125 0 011.45.12l.773.774a1.125 1.125 0 01.12 1.45l-.527.737c-.25.35-.272.806-.107 1.204.165.397.505.71.93.78l.893.15c.543.09.94.56.94 1.109v1.094c0 .55-.397 1.02-.94 1.11l-.893.149c-.425.07-.765.383-.93.78-.165.398-.143.854.107 1.204l.527.738a1.125 1.125 0 01-.12 1.45l-.774.773a1.125 1.125 0 01-1.449.12l-.738-.527c-.35-.25-.806-.272-1.203-.107-.397.165-.71.505-.781.929l-.149.894c-.09.542-.56.94-1.11.94h-1.094c-.55 0-1.019-.398-1.11-.94l-.148-.894c-.071-.424-.384-.764-.781-.93-.398-.164-.854-.142-1.204.108l-.738.527a1.125 1.125 0 01-1.448-.12l-.774-.774a1.125 1.125 0 01-.12-1.45l.527-.737c.251-.35.273-.806.108-1.204-.165-.397-.505-.71-.93-.78l-.894-.15c-.542-.09-.94-.56-.94-1.109v-1.094c0-.55.398-1.02.94-1.11l.894-.149c.424-.07.765-.383.93-.78.165-.398.143-.854-.108-1.204l-.526-.738a1.125 1.125 0 01.12-1.45l.773-.773a1.125 1.125 0 011.45-.12l.737.527c.35.25.807.272 1.204.107.397-.165.71-.505.78-.929l.15-.894z" />
    <circle cx="12" cy="12" r="3" />
  </svg>
);

const snowflakeIcon = (
  <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="12" y1="2" x2="12" y2="22" />
    <line x1="2" y1="12" x2="22" y2="22" />
    <path d="m20 16-4-4 4-4" />
    <path d="m4 8 4 4-4 4" />
    <path d="m16 4-4 4-4-4" />
    <path d="m8 20 4-4 4 4" />
  </svg>
);

const flameIcon = (
  <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z" />
  </svg>
);

const dropletIcon = (
  <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 22a7 7 0 0 0 7-7c0-2-1-3.9-3-5.5s-3.5-4-4-6.5c-.5 2.5-2 4.9-4 6.5C6 11.1 5 13 5 15a7 7 0 0 0 7 7z" />
  </svg>
);

export interface UnitControlConfig {
  unitId: "ahu-01" | "ahu-02" | "ahu-03";
  unitName: string;
  status: string; // "Running" | "Stopped" | "Maintenance"
  mode: string;   // "Auto" | "Manual"
  ahuStatus?: "ON" | "OFF" | "IDLE";
  temp: number;
  humid: number;
  tempRange: { min: number; max: number; label: string };
  humidRange: { min: number; max: number; label: string };
  onUpdateSetpoint: (updates: { temp?: number; humid?: number }) => void;
  onControlAction: (action: "START" | "STOP" | "MAINTENANCE") => Promise<void>;
}

interface HvacLayoutProps {
  roomName: string;
  roomType: string;
  targetTemp: string;
  targetHumidity: string;
  diagramComponent: ReactNode;
  systemMode: SystemModeItem[];
  setpoints?: SetpointConfig[];
  controlButtons?: ControlButtonItem[];
  unitControl?: UnitControlConfig;
  currentUser?: string;
  onVerifyPassword?: (password: string) => Promise<boolean>;
  logs: LogEntry[];
  onRefreshData?: () => Promise<void> | void;
  currentMode?: string;
  currentStatus?: string;
  ahuStatus?: "ON" | "OFF" | "IDLE";
  machineJob?: "COOLING" | "HEATING" | "STANDBY" | null;
  humidityStatus?: "ON" | "OFF" | null;
}

export interface LogEntry {
  id: string | number;
  action: string;
  user: string;
  timestamp: Date;
  type: "start" | "stop" | "maintenance" | "other";
}

import { canAccessHvacControls } from "../../utils/roles";
export { canAccessHvacControls };

export default function HvacLayout({
  roomName,
  roomType,
  targetTemp,
  targetHumidity,
  diagramComponent,
  systemMode,
  setpoints,
  controlButtons,
  unitControl,
  currentUser = "Unknown User",
  onVerifyPassword,
  logs,
  onRefreshData,
  currentMode = "Auto",
  currentStatus = "Running",
  ahuStatus,
  machineJob,
  humidityStatus,
}: HvacLayoutProps) {
  const [pendingAction, setPendingAction] = useState<(() => void) | null>(null);
  const [isConfirmModalOpen, setIsConfirmModalOpen] = useState(false);
  const [modalLabel, setModalLabel] = useState("");
  const [password, setPassword] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [isVerifying, setIsVerifying] = useState(false);

  // Access auth store user & role permission check
  const user = useAuthStore((state) => state.user);
  const userRole = user?.role ?? "";
  const hasControlAccess = useMemo(() => canAccessHvacControls(userRole), [userRole]);

  // Unit control action handler
  const handleTriggerUnitAction = (action: "START" | "STOP" | "MAINTENANCE") => {
    if (!unitControl) return;
    const label = `${action} ${unitControl.unitName}`;
    setModalLabel(label);
    setPendingAction(() => () => unitControl.onControlAction(action));
    setPassword("");
    setPasswordError("");
    setIsConfirmModalOpen(true);
  };

  // Setpoint draft values & handlers
  const [draftSetpoints, setDraftSetpoints] = useState<Record<string, number>>({});
  const [isSetpointUnlocked, setIsSetpointUnlocked] = useState(false);

  useEffect(() => {
    if (setpoints) {
      setDraftSetpoints((prev) => {
        const next = { ...prev };
        setpoints.forEach((sp) => {
          if (next[sp.label] === undefined) {
            next[sp.label] = sp.value;
          }
        });
        return next;
      });
    }
  }, [setpoints]);

  const handleUnlockSetpoint = () => {
    setModalLabel("Buka Akses Pengaturan Setpoint");
    setPendingAction(() => async () => {
      setIsSetpointUnlocked(true);
    });
    setPassword("");
    setPasswordError("");
    setVerificationMode("password");
    setIsConfirmModalOpen(true);
  };

  const handleStepSetpoint = (sp: SetpointConfig, delta: number) => {
    const currentVal = draftSetpoints[sp.label] !== undefined ? draftSetpoints[sp.label] : sp.value;
    const step = sp.step ?? 0.1;
    const rawNew = currentVal + delta * step;
    const clamped = parseFloat(Math.min(sp.max, Math.max(sp.min, rawNew)).toFixed(2));
    setDraftSetpoints((prev) => ({ ...prev, [sp.label]: clamped }));
  };

  const handleManualInputSetpoint = (sp: SetpointConfig, valStr: string) => {
    const num = parseFloat(valStr);
    if (!isNaN(num)) {
      setDraftSetpoints((prev) => ({ ...prev, [sp.label]: num }));
    }
  };

  const handleTriggerSetpointChange = (sp: SetpointConfig) => {
    const targetVal = draftSetpoints[sp.label] !== undefined ? draftSetpoints[sp.label] : sp.value;
    const clamped = parseFloat(Math.min(sp.max, Math.max(sp.min, targetVal)).toFixed(2));
    setModalLabel(`Ubah ${sp.label} ke ${clamped}${sp.unit}`);
    setPendingAction(() => async () => {
      sp.onChange(clamped);
      setDraftSetpoints((prev) => ({ ...prev, [sp.label]: clamped }));
      setIsSetpointUnlocked(false);
    });
    setPassword("");
    setPasswordError("");
    setVerificationMode("password");
    setIsConfirmModalOpen(true);
  };

  // Biometric state variables
  const [verificationMode, setVerificationMode] = useState<"password" | "biometric">("password");
  const [biometricStatus, setBiometricStatus] = useState<"ready" | "scanning" | "success" | "failed" | "mismatch">("ready");
  const [biometricProgress, setBiometricProgress] = useState(0);
  const [biometricLog, setBiometricLog] = useState("");
  const [biometricMatchScore, setBiometricMatchScore] = useState<number | null>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);

  // Handle webcam stream based on active biometric scanner
  useEffect(() => {
    let activeStream: MediaStream | null = null;
    if (isConfirmModalOpen && verificationMode === "biometric") {
      if (!user?.hasBiometrics) {
        setBiometricStatus("failed");
        setBiometricLog("Biometrik wajah belum terdaftar untuk akun Anda. Harap daftarkan di Pengaturan Profil.");
        return;
      }

      setBiometricLog("Mengakses kamera...");
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        setBiometricStatus("failed");
        setBiometricLog("Akses kamera gagal: Web biometrik memerlukan koneksi aman (HTTPS atau localhost).");
        return;
      }
      navigator.mediaDevices.getUserMedia({ video: { width: 320, height: 240 } })
        .then((s) => {
          activeStream = s;
          setStream(s);
          if (videoRef.current) {
            videoRef.current.srcObject = s;
          }
          setBiometricLog("Kamera aktif. Posisikan wajah Anda di area pemindaian.");
        })
        .catch((err) => {
          console.error("Camera access error:", err);
          setBiometricStatus("failed");
          setBiometricLog("Akses kamera ditolak atau gagal. Silakan gunakan password.");
        });
    }

    return () => {
      if (activeStream) {
        activeStream.getTracks().forEach((track) => track.stop());
      }
      setStream((prevStream) => {
        if (prevStream) {
          prevStream.getTracks().forEach((track) => track.stop());
        }
        return null;
      });
    };
  }, [isConfirmModalOpen, verificationMode, user]);

  // Run the biometric scanning
  const startBiometricScan = async () => {
    if (biometricStatus !== "ready" && biometricStatus !== "failed" && biometricStatus !== "mismatch") return;
    if (!user?.hasBiometrics) {
      setBiometricStatus("failed");
      setBiometricLog("Biometrik wajah belum terdaftar untuk akun Anda. Harap daftarkan di Pengaturan Profil.");
      return;
    }

    const video = videoRef.current;
    if (!video) {
      setBiometricStatus("failed");
      setBiometricLog("Kamera tidak aktif.");
      return;
    }

    setBiometricStatus("scanning");
    setBiometricProgress(0);
    setBiometricLog("Mengambil gambar wajah...");

    // Capture immediately
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth || 320;
    canvas.height = video.videoHeight || 240;
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      setBiometricStatus("failed");
      setBiometricLog("Gagal menginisialisasi canvas untuk mengambil foto.");
      return;
    }

    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    const imageBase64 = canvas.toDataURL("image/jpeg", 0.8);

    // Start progress bar animation (fast visual feedback)
    let progress = 0;
    const interval = setInterval(() => {
      if (progress < 90) {
        progress += 10;
        setBiometricProgress(progress);
        if (progress === 30) {
          setBiometricLog("Melacak kontur wajah...");
        } else if (progress === 60) {
          setBiometricLog("Membandingkan wajah...");
        }
      }
    }, 80);

    try {
      // Call verification in parallel
      const verificationResult = await verifyBiometrics(imageBase64);
      clearInterval(interval);
      setBiometricProgress(100);

      if (verificationResult.valid) {
        // Distance of 0 means 100% match. 0.22 distance is threshold (which we map to 70% min to 100% max)
        const rawScore = 1 - (verificationResult.distance || 0) / 0.22;
        const match = parseFloat(Math.min(100, Math.max(70, 70 + rawScore * 30)).toFixed(2));
        setBiometricMatchScore(match);
        setBiometricStatus("success");
        setBiometricLog(`Wajah Terverifikasi: ${user.name} (Akurasi: ${match}%)`);

        // Wait 1.5 seconds, then execute the action automatically
        setTimeout(async () => {
          if (pendingAction) {
            try {
              await pendingAction();
              if (onRefreshData) {
                await onRefreshData();
              }
            } catch (err) {
              console.error("Action error:", err);
            }
          }
          setIsConfirmModalOpen(false);
          setPendingAction(null);
          // Reset states
          setVerificationMode("password");
          setBiometricStatus("ready");
          setBiometricProgress(0);
          setBiometricMatchScore(null);
          setPassword("");
        }, 1500);
      } else {
        setBiometricStatus("mismatch");
        setBiometricLog("Wajah tidak cocok dengan akun Anda. Silakan coba lagi.");
      }
    } catch (err) {
      clearInterval(interval);
      setBiometricStatus("failed");
      let errMsg = "Terjadi kesalahan koneksi server saat verifikasi.";
      if (err instanceof Error) {
        try {
          const parsed = JSON.parse(err.message);
          if (parsed && parsed.message) {
            errMsg = parsed.message;
          } else {
            errMsg = err.message;
          }
        } catch {
          errMsg = err.message;
        }
      }
      setBiometricLog(errMsg);
    }
  };

  const [isLogModalOpen, setIsLogModalOpen] = useState(false);
  const [logFilter, setLogFilter] = useState<"all" | "start" | "stop" | "maintenance">("all");

  const handleControlClick = (btn: ControlButtonItem) => {
    setModalLabel(btn.label);
    setPendingAction(() => btn.onClick);
    setPassword("");
    setPasswordError("");
    setIsConfirmModalOpen(true);
  };

  const handleConfirmAction = async () => {
    if (!pendingAction) return;
    setIsVerifying(true);
    setPasswordError("");

    try {
      const isValid = onVerifyPassword
        ? await onVerifyPassword(password)
        : (await verifyPassword(password)).valid;

      if (!isValid) {
        setPasswordError("Password salah. Silakan coba lagi.");
        setIsVerifying(false);
        return;
      }

      await pendingAction();
      if (onRefreshData) {
        await onRefreshData();
      }
      setIsConfirmModalOpen(false);
      setPendingAction(null);
      setPassword("");
    } catch (error) {
      setPasswordError("Terjadi kesalahan verifikasi. Silakan coba lagi.");
    } finally {
      setIsVerifying(false);
    }
  };

  const formatDate = (date: Date): string => {
    return date.toLocaleString("id-ID", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
  };

  const unitLogs = useMemo(() => {
    if (!unitControl) return logs;
    const filtered = logs.filter(
      (l) =>
        l.action.toLowerCase().includes(unitControl.unitId.toLowerCase()) ||
        l.action.toLowerCase().includes(unitControl.unitName.toLowerCase())
    );
    return filtered.length > 0 ? filtered : logs;
  }, [logs, unitControl]);

  const recentLogs = unitLogs.slice(0, 3);
  const filteredLogs = logs.filter((log) => {
    if (logFilter === "all") return true;
    return log.type === logFilter;
  });

  // ========== STYLING ==========
  const getStatusColorClass = (color?: string) => {
    switch (color) {
      case "cyan":
        return "text-cyan-600 dark:text-cyan-400";
      case "green":
        return "text-emerald-600 dark:text-emerald-400";
      case "red":
        return "text-rose-600 dark:text-rose-400";
      case "yellow":
        return "text-amber-600 dark:text-amber-400";
      default:
        return "text-slate-600 dark:text-slate-300";
    }
  };

  const getButtonClass = (variant: string) => {
    const base =
      "flex items-center justify-center gap-2 p-2.5 rounded-lg text-xs font-bold transition-all duration-200 border text-center shadow-sm hover:shadow-md active:scale-95";
    switch (variant) {
      case "cyan":
        return `${base} bg-cyan-50 dark:bg-cyan-950/40 text-cyan-700 dark:text-cyan-450 border-cyan-200 dark:border-cyan-800 hover:bg-cyan-100 dark:hover:bg-cyan-900/40`;
      case "red":
        return `${base} bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-450 border-rose-200 dark:border-rose-800 hover:bg-rose-100 dark:hover:bg-rose-900/40`;
      case "blue":
        return `${base} bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-450 border-blue-200 dark:border-blue-800 hover:bg-blue-100 dark:hover:bg-blue-900/40`;
      case "green":
        return `${base} bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-450 border-emerald-200 dark:border-emerald-800 hover:bg-emerald-100 dark:hover:bg-emerald-900/40`;
      case "orange":
        return `${base} bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-450 border-amber-200 dark:border-amber-800 hover:bg-amber-100 dark:hover:bg-amber-900/40`;
      default:
        return `${base} bg-slate-50 dark:bg-slate-800/50 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700/80`;
    }
  };

  // ========== RENDER ==========
  return (
    <div className="flex flex-col h-full w-full gap-4 p-4 bg-slate-50/50 dark:bg-slate-950/50 rounded-xl transition-all duration-300">
      {/* TOP BAR */}
      <div className="flex justify-between items-center bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-4 rounded-xl shadow-sm dark:shadow-2xl transition-all duration-300">
        <div>
          <div className="flex items-center gap-3">
            <h2 className="text-xl font-extrabold text-slate-800 dark:text-white tracking-wide">
              {roomName}
            </h2>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-cyan-100 dark:bg-cyan-950 text-cyan-800 dark:text-cyan-300 border border-cyan-200 dark:border-cyan-800 shadow-sm">
              Active Unit
            </span>
          </div>
          <p className="text-sm font-semibold text-slate-550 dark:text-slate-400 mt-0.5">
            {roomType}
          </p>
          <div className="flex items-center gap-2 text-xs text-cyan-600 dark:text-cyan-400 font-mono mt-1.5 bg-cyan-50 dark:bg-cyan-950/30 px-2.5 py-1 rounded-md border border-cyan-100 dark:border-cyan-900/30 w-fit">
            <span>Target:</span>
            <span className="font-semibold">{targetTemp}</span>
            {targetHumidity && (
              <>
                <span className="text-slate-300 dark:text-slate-700">|</span>
                <span className="font-semibold">{targetHumidity}</span>
              </>
            )}
          </div>
        </div>

        {/* STATUS & OPERATION CLUSTER */}
        {(() => {
          const effectiveAhuStatus: "ON" | "OFF" | "IDLE" =
            ahuStatus ||
            (currentStatus === "Running" ? "ON" : currentStatus === "Maintenance" ? "IDLE" : "OFF");

          return (
            <div className="flex items-center gap-3 bg-slate-50 dark:bg-slate-950 px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm">
              {/* MODE */}
              <div className="flex flex-col items-center px-1">
                <span className="text-[9px] text-slate-400 dark:text-slate-500 font-mono uppercase tracking-wider font-semibold">
                  MODE
                </span>
                <span
                  className={`text-xs font-bold font-mono ${
                    currentMode === "Auto"
                      ? "text-cyan-600 dark:text-cyan-400"
                      : "text-amber-600 dark:text-amber-400"
                  }`}
                >
                  {currentMode}
                </span>
              </div>

              <div className="h-6 w-px bg-slate-200 dark:bg-slate-800"></div>

              {/* AHU STATUS INDICATOR (ON / OFF / IDLE) */}
              <div className="flex flex-col items-center px-1">
                <span className="text-[9px] text-slate-400 dark:text-slate-500 font-mono uppercase tracking-wider font-semibold">
                  AHU STATUS
                </span>
                <span
                  className={`text-xs font-bold font-mono flex items-center gap-1.5 mt-0.5 ${
                    effectiveAhuStatus === "ON"
                      ? "text-emerald-600 dark:text-emerald-400"
                      : effectiveAhuStatus === "IDLE"
                      ? "text-amber-600 dark:text-amber-400"
                      : "text-rose-600 dark:text-rose-400"
                  }`}
                >
                  {effectiveAhuStatus === "ON" && (
                    <span className="relative flex h-2 w-2">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                    </span>
                  )}
                  {effectiveAhuStatus === "IDLE" && (
                    <span className="relative flex h-2 w-2">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500"></span>
                    </span>
                  )}
                  {effectiveAhuStatus === "OFF" && (
                    <span className="h-2 w-2 rounded-full bg-rose-500"></span>
                  )}
                  {effectiveAhuStatus}
                </span>
              </div>

              {/* CARD 1: MACHINE JOB (COOLING / HEATING) - Omitted when machineJob is null, e.g. AHU-03 */}
              {machineJob !== null && machineJob !== undefined && (
                <>
                  <div className="h-6 w-px bg-slate-200 dark:bg-slate-800"></div>
                  <div className="flex flex-col items-center px-1">
                    <span className="text-[9px] text-slate-400 dark:text-slate-500 font-mono uppercase tracking-wider font-semibold">
                      MACHINE
                    </span>
                    <span
                      className={`text-xs font-bold font-mono flex items-center gap-1 mt-0.5 ${
                        machineJob === "COOLING"
                          ? "text-cyan-600 dark:text-cyan-400"
                          : machineJob === "HEATING"
                          ? "text-orange-600 dark:text-orange-400"
                          : "text-slate-400 dark:text-slate-500"
                      }`}
                    >
                      {machineJob === "COOLING" && snowflakeIcon}
                      {machineJob === "HEATING" && flameIcon}
                      {machineJob}
                    </span>
                  </div>
                </>
              )}

              {/* CARD 2: HUMIDITY STATUS (ON / OFF) */}
              {humidityStatus !== null && humidityStatus !== undefined && (
                <>
                  <div className="h-6 w-px bg-slate-200 dark:bg-slate-800"></div>
                  <div className="flex flex-col items-center px-1">
                    <span className="text-[9px] text-slate-400 dark:text-slate-500 font-mono uppercase tracking-wider font-semibold">
                      HUMI
                    </span>
                    <span
                      className={`text-xs font-bold font-mono flex items-center gap-1 mt-0.5 ${
                        humidityStatus === "ON"
                          ? "text-emerald-600 dark:text-emerald-400"
                          : "text-slate-400 dark:text-slate-500"
                      }`}
                    >
                      {dropletIcon}
                      {humidityStatus}
                    </span>
                  </div>
                </>
              )}
            </div>
          );
        })()}
      </div>

      {/* MAIN AREA */}
      <div className="flex flex-col xl:flex-row gap-4 flex-1 min-h-0">
        <div className="flex-1 rounded-xl border border-slate-200 dark:border-slate-800 bg-white/70 dark:bg-slate-900/50 relative flex items-center justify-center p-2 min-h-[450px] xl:min-h-0 shadow-sm transition-all duration-300 overflow-hidden">
          <div className="w-full h-full flex items-center justify-center overflow-hidden">
            {diagramComponent}
          </div>
        </div>

        <div className="w-full xl:w-[380px] shrink-0 flex flex-col gap-4 min-h-0 overflow-y-auto pr-1">
          {/* HVAC CONTROL STATION (When unitControl is provided) */}
          {unitControl && (
            <div className="border border-slate-200 dark:border-slate-800 rounded-xl bg-white dark:bg-slate-900 p-4 flex flex-col shadow-sm dark:shadow-2xl transition-all duration-300 shrink-0">
              <div className="flex justify-between items-center border-b border-slate-100 dark:border-slate-800 pb-2.5 mb-3">
                <div className="flex items-center gap-2">
                  <h3 className="text-slate-800 dark:text-white font-black font-mono text-sm tracking-wide">
                    CONTROL STATION
                  </h3>
                  <span
                    className={`px-2 py-0.5 rounded text-[10px] font-bold font-mono uppercase ${
                      unitControl.status === "Running"
                        ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20"
                        : unitControl.status === "Maintenance"
                        ? "bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20"
                        : "bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20"
                    }`}
                  >
                    {unitControl.status}
                  </span>
                </div>
                <span
                  className={`text-[10px] font-mono font-semibold px-2 py-0.5 rounded border ${
                    hasControlAccess
                      ? "bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 border-cyan-500/30"
                      : "bg-slate-100 dark:bg-slate-800 text-slate-400 border-slate-200 dark:border-slate-700"
                  }`}
                >
                  {hasControlAccess ? "🔓 Control Access" : "🔒 View Only"}
                </span>
              </div>

              {/* SETPOINTS PARAMETER */}
              <div className="space-y-3 mb-4 bg-slate-50/80 dark:bg-slate-950/60 p-3 rounded-xl border border-slate-150 dark:border-slate-800/80">
                <div className="flex justify-between items-center">
                  <span className="text-[11px] font-bold font-mono uppercase tracking-wider text-slate-700 dark:text-slate-300">
                    Setpoints Parameter
                  </span>
                  <span className="text-[10px] text-slate-400 font-mono">
                    {hasControlAccess ? "Real-time Slider" : "Read Only"}
                  </span>
                </div>

                {/* Temperature Slider */}
                <div className="space-y-1">
                  <div className="flex justify-between items-center text-xs font-mono">
                    <span className="text-slate-600 dark:text-slate-400 text-[11px]">
                      {unitControl.tempRange.label}
                    </span>
                    <span className="text-cyan-600 dark:text-cyan-400 font-bold text-xs bg-cyan-50 dark:bg-cyan-950/50 px-2 py-0.5 rounded border border-cyan-200/50 dark:border-cyan-800/50">
                      {unitControl.temp.toFixed(1)}°C
                    </span>
                  </div>
                  <input
                    type="range"
                    min={unitControl.tempRange.min}
                    max={unitControl.tempRange.max}
                    step={0.1}
                    value={unitControl.temp}
                    disabled={!hasControlAccess}
                    onChange={(e) => unitControl.onUpdateSetpoint({ temp: parseFloat(e.target.value) })}
                    className="w-full h-2 bg-slate-200 dark:bg-slate-800 rounded-lg appearance-none cursor-pointer accent-cyan-600 dark:accent-cyan-400 disabled:opacity-50 disabled:cursor-not-allowed"
                  />
                  <div className="flex justify-between text-[10px] text-slate-400 font-mono">
                    <span>{unitControl.tempRange.min}°C</span>
                    <span>{unitControl.tempRange.max}°C</span>
                  </div>
                </div>

                {/* Humidity Slider */}
                <div className="space-y-1">
                  <div className="flex justify-between items-center text-xs font-mono">
                    <span className="text-slate-600 dark:text-slate-400 text-[11px]">
                      {unitControl.humidRange.label}
                    </span>
                    <span className="text-cyan-600 dark:text-cyan-400 font-bold text-xs bg-cyan-50 dark:bg-cyan-950/50 px-2 py-0.5 rounded border border-cyan-200/50 dark:border-cyan-800/50">
                      {unitControl.humid.toFixed(1)}%RH
                    </span>
                  </div>
                  <input
                    type="range"
                    min={unitControl.humidRange.min}
                    max={unitControl.humidRange.max}
                    step={0.1}
                    value={unitControl.humid}
                    disabled={!hasControlAccess}
                    onChange={(e) => unitControl.onUpdateSetpoint({ humid: parseFloat(e.target.value) })}
                    className="w-full h-2 bg-slate-200 dark:bg-slate-800 rounded-lg appearance-none cursor-pointer accent-cyan-600 dark:accent-cyan-400 disabled:opacity-50 disabled:cursor-not-allowed"
                  />
                  <div className="flex justify-between text-[10px] text-slate-400 font-mono">
                    <span>{unitControl.humidRange.min}%</span>
                    <span>{unitControl.humidRange.max}%</span>
                  </div>
                </div>
              </div>

              {/* PERINTAH KONTROL */}
              <div className="space-y-1.5">
                <span className="text-[10px] font-bold font-mono text-slate-400 dark:text-slate-500 uppercase tracking-wider block">
                  Perintah Kontrol ({unitControl.unitName})
                </span>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => handleTriggerUnitAction("START")}
                    disabled={unitControl.status === "Running" || !hasControlAccess}
                    className={`flex items-center justify-center gap-1.5 py-2 px-1 rounded-xl font-bold font-mono text-xs transition duration-200 ${
                      unitControl.status === "Running" || !hasControlAccess
                        ? "bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-600 cursor-not-allowed opacity-60"
                        : "bg-emerald-600 hover:bg-emerald-500 text-white shadow-sm hover:shadow active:scale-95"
                    }`}
                    title={
                      !hasControlAccess
                        ? "Akses terbatas: Hanya Leader / Kashift"
                        : unitControl.status === "Running"
                        ? "Mesin sedang beroperasi (Running)"
                        : "Mulai Operasional Mesin"
                    }
                  >
                    {startIcon}
                    <span>START</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleTriggerUnitAction("STOP")}
                    disabled={unitControl.status === "Stopped" || !hasControlAccess}
                    className={`flex items-center justify-center gap-1.5 py-2 px-1 rounded-xl font-bold font-mono text-xs transition duration-200 ${
                      unitControl.status === "Stopped" || !hasControlAccess
                        ? "bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-600 cursor-not-allowed opacity-60"
                        : "bg-rose-600 hover:bg-rose-500 text-white shadow-sm hover:shadow active:scale-95"
                    }`}
                    title={
                      !hasControlAccess
                        ? "Akses terbatas: Hanya Leader / Kashift"
                        : unitControl.status === "Stopped"
                        ? "Mesin sedang berhenti (Stopped)"
                        : "Hentikan Operasional Mesin"
                    }
                  >
                    {stopIcon}
                    <span>STOP</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleTriggerUnitAction("MAINTENANCE")}
                    disabled={unitControl.status === "Maintenance" || !hasControlAccess}
                    className={`flex items-center justify-center gap-1.5 py-2 px-1 rounded-xl font-bold font-mono text-xs transition duration-200 ${
                      unitControl.status === "Maintenance" || !hasControlAccess
                        ? "bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-600 cursor-not-allowed opacity-60"
                        : "bg-blue-600 hover:bg-blue-500 text-white shadow-sm hover:shadow active:scale-95"
                    }`}
                    title={
                      !hasControlAccess
                        ? "Akses terbatas: Hanya Leader / Kashift"
                        : unitControl.status === "Maintenance"
                        ? "Mesin dalam status perawatan (Maintenance)"
                        : "Alihkan ke Mode Maintenance"
                    }
                  >
                    {maintenanceIcon}
                    <span>MAINT</span>
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* SYSTEM MODE */}
          <div className="border border-slate-200 dark:border-slate-800 rounded-xl bg-white dark:bg-slate-900 p-4 flex flex-col min-h-0 shadow-sm dark:shadow-2xl transition-all duration-300 shrink-0">
            <h3 className="text-slate-800 dark:text-white font-bold font-mono text-sm border-b border-slate-100 dark:border-slate-800 pb-2 mb-3 tracking-wide">
              SYSTEM MODE
            </h3>
            <div className="space-y-2.5 pr-1 text-xs">
              {systemMode.map((item, idx) => (
                <div key={idx} className="flex justify-between items-center py-0.5">
                  <span className="text-slate-500 dark:text-slate-400 font-medium">
                    {item.label}
                  </span>
                  <span className={`font-semibold font-mono ${getStatusColorClass(item.statusColor)}`}>
                    {item.value}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* SETPOINTS (Fallback if unitControl is not passed) */}
          {!unitControl && setpoints && setpoints.length > 0 && (
            <div className="flex-[1.3] border border-slate-200 dark:border-slate-800 rounded-xl bg-white dark:bg-slate-900 p-4 flex flex-col min-h-[175px] shadow-sm dark:shadow-2xl transition-all duration-300">
              <div className="flex justify-between items-center border-b border-slate-100 dark:border-slate-800 pb-2 mb-3">
                <div className="flex items-center gap-2">
                  <h3 className="text-slate-800 dark:text-white font-bold font-mono text-sm tracking-wide">
                    SETPOINTS
                  </h3>
                  {hasControlAccess && (
                    <span className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded border ${
                      isSetpointUnlocked
                        ? "bg-emerald-500/10 text-emerald-500 border-emerald-500/30 animate-pulse"
                        : "bg-slate-100 dark:bg-slate-800 text-slate-400 border-slate-200 dark:border-slate-700"
                    }`}>
                      {isSetpointUnlocked ? "🔓 Edit Mode" : "🔒 Terkunci"}
                    </span>
                  )}
                </div>

                {!hasControlAccess ? (
                  <span className="text-[10px] text-slate-400 font-mono font-medium px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
                    View Only
                  </span>
                ) : !isSetpointUnlocked ? (
                  <button
                    type="button"
                    onClick={handleUnlockSetpoint}
                    className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-bold rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white shadow-xs transition active:scale-95"
                    title="Verifikasi password akun untuk mengatur setpoint"
                  >
                    <span>🔒</span>
                    <span>Atur Setpoint</span>
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => setIsSetpointUnlocked(false)}
                    className="flex items-center gap-1 px-2 py-0.5 text-xs font-semibold rounded bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:text-rose-500 transition"
                    title="Kunci kembali pengaturan setpoint"
                  >
                    <span>🔒 Kunci</span>
                  </button>
                )}
              </div>
              <div className="flex-1 overflow-y-auto space-y-3 pr-1">
                {setpoints.map((sp, idx) => {
                  const currentDraft = draftSetpoints[sp.label] !== undefined ? draftSetpoints[sp.label] : sp.value;
                  const isModified = Math.abs(currentDraft - sp.value) > 0.001;

                  if (!hasControlAccess) {
                    return (
                      <div
                        key={idx}
                        className="flex justify-between items-center p-2.5 rounded-lg bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800/60"
                      >
                        <span className="text-slate-600 dark:text-slate-400 font-medium text-xs">
                          {sp.label}
                        </span>
                        <span className="font-mono font-bold text-xs text-slate-800 dark:text-white bg-slate-200/70 dark:bg-slate-700/60 px-2 py-0.5 rounded">
                          {sp.value.toFixed(1)} {sp.unit}
                        </span>
                      </div>
                    );
                  }

                  if (!isSetpointUnlocked) {
                    return (
                      <div
                        key={idx}
                        onClick={handleUnlockSetpoint}
                        className="cursor-pointer group flex justify-between items-center p-2.5 rounded-lg bg-slate-50/70 dark:bg-slate-800/30 hover:bg-cyan-500/5 dark:hover:bg-cyan-950/20 border border-slate-100 dark:border-slate-800/60 hover:border-cyan-500/30 transition"
                        title="Klik untuk membuka pengaturan dengan verifikasi password akun"
                      >
                        <div className="flex flex-col">
                          <span className="text-slate-600 dark:text-slate-300 font-semibold text-[11px] group-hover:text-cyan-600 dark:group-hover:text-cyan-400 transition">
                            {sp.label}
                          </span>
                          <span className="text-[10px] text-slate-400 dark:text-slate-500">
                            Aktif: <strong className="text-slate-700 dark:text-slate-300">{sp.value.toFixed(1)}{sp.unit}</strong>
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-bold text-xs text-slate-800 dark:text-white bg-slate-200/70 dark:bg-slate-700/60 px-2 py-0.5 rounded">
                            {sp.value.toFixed(1)} {sp.unit}
                          </span>
                          <span className="text-xs text-slate-400 group-hover:text-cyan-500 transition">🔒</span>
                        </div>
                      </div>
                    );
                  }

                  return (
                    <div
                      key={idx}
                      className="space-y-1.5 p-2 rounded-lg bg-slate-50/70 dark:bg-slate-800/30 border border-slate-100 dark:border-slate-800/60"
                    >
                      <div className="flex justify-between items-center text-xs font-mono">
                        <span className="text-slate-600 dark:text-slate-300 font-semibold text-[11px]">
                          {sp.label}
                        </span>
                        <span className="text-[10px] text-slate-400 dark:text-slate-500">
                          Aktif: <strong className="text-slate-700 dark:text-slate-300">{sp.value.toFixed(1)}{sp.unit}</strong>
                        </span>
                      </div>

                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => handleStepSetpoint(sp, -1)}
                          disabled={currentDraft <= sp.min}
                          className="w-7 h-7 rounded flex items-center justify-center bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-bold transition disabled:opacity-40 disabled:cursor-not-allowed active:scale-95 shadow-xs"
                          title="Turunkan setpoint"
                        >
                          ▼
                        </button>

                        <div className="relative flex-1">
                          <input
                            type="number"
                            min={sp.min}
                            max={sp.max}
                            step={sp.step ?? 0.1}
                            value={currentDraft}
                            onChange={(e) => handleManualInputSetpoint(sp, e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") {
                                handleTriggerSetpointChange(sp);
                              }
                            }}
                            className="w-full text-center px-2 py-1 text-xs font-mono font-bold rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-white focus:outline-none focus:border-cyan-500 transition"
                          />
                        </div>

                        <button
                          type="button"
                          onClick={() => handleStepSetpoint(sp, 1)}
                          disabled={currentDraft >= sp.max}
                          className="w-7 h-7 rounded flex items-center justify-center bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-bold transition disabled:opacity-40 disabled:cursor-not-allowed active:scale-95 shadow-xs"
                          title="Naikkan setpoint"
                        >
                          ▲
                        </button>

                        <span className="text-[10px] font-mono font-medium text-slate-500 dark:text-slate-400 w-7 shrink-0 text-center">
                          {sp.unit}
                        </span>

                        <button
                          type="button"
                          onClick={() => handleTriggerSetpointChange(sp)}
                          className={`px-2.5 py-1 text-xs font-bold rounded transition active:scale-95 shadow-xs ${
                            isModified
                              ? "bg-cyan-600 hover:bg-cyan-500 text-white animate-pulse"
                              : "bg-slate-200 dark:bg-slate-800 hover:bg-cyan-700 text-slate-700 dark:text-slate-300 hover:text-white"
                          }`}
                          title="Konfirmasi perubahan setpoint dengan password akun"
                        >
                          Set
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* CONTROL PANEL (Fallback if unitControl is not passed) */}
          {!unitControl && hasControlAccess && controlButtons && controlButtons.length > 0 && (
            <div className="flex-[1] border border-slate-200 dark:border-slate-800 rounded-xl bg-white dark:bg-slate-900 p-4 flex flex-col min-h-0 shadow-sm dark:shadow-2xl transition-all duration-300">
              <h3 className="text-slate-800 dark:text-white font-bold font-mono text-sm border-b border-slate-100 dark:border-slate-800 pb-2 mb-3 tracking-wide">
                CONTROL PANEL
              </h3>
              <div className="flex-1 overflow-y-auto pr-1">
                <div className="flex flex-col gap-2">
                  {controlButtons.map((btn, idx) => (
                    <button
                      key={idx}
                      onClick={() => handleControlClick(btn)}
                      className={getButtonClass(btn.variant)}
                    >
                      {btn.icon && <span>{btn.icon}</span>}
                      {btn.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* ACTIVITY LOG CARD */}
          <div className="border border-slate-200 dark:border-slate-800 rounded-xl bg-white dark:bg-slate-900 p-4 flex flex-col shadow-sm dark:shadow-2xl transition-all duration-300 shrink-0">
            <div className="flex justify-between items-center border-b border-slate-100 dark:border-slate-800 pb-2 mb-2">
              <h3 className="text-slate-800 dark:text-white font-bold font-mono text-sm tracking-wide">
                ACTIVITY LOG
              </h3>
              <button
                onClick={() => setIsLogModalOpen(true)}
                className="text-xs text-cyan-600 dark:text-cyan-400 hover:underline font-medium"
              >
                Lihat Semua
              </button>
            </div>
            <div className="space-y-2 pr-1 text-xs">
              {recentLogs.length === 0 ? (
                <p className="text-slate-400 dark:text-slate-500 italic text-center py-2">
                  Belum ada aktivitas
                </p>
              ) : (
                recentLogs.map((log) => (
                  <div
                    key={log.id}
                    className="flex flex-col border-b border-slate-100 dark:border-slate-800 last:border-0 py-1.5"
                  >
                    <div className="flex justify-between items-start">
                      <span className="text-slate-800 dark:text-white font-medium text-xs leading-tight">
                        {log.action}
                      </span>
                      <span className="text-slate-400 dark:text-slate-500 text-[10px] font-mono whitespace-nowrap ml-2">
                        {formatDate(log.timestamp)}
                      </span>
                    </div>
                    <span className="text-slate-500 dark:text-slate-400 text-[10px] mt-0.5">
                      oleh {log.user}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>

      {/* MODAL KONFIRMASI DENGAN BIOMETRIK / PASSWORD */}
      {isConfirmModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl p-6 max-w-sm w-full border border-slate-200 dark:border-slate-700">
            <h3 className="text-lg font-bold text-slate-800 dark:text-white mb-2">
              Konfirmasi Tindakan
            </h3>
            <p className="text-sm text-slate-650 dark:text-slate-350 mb-4">
              Anda yakin ingin{" "}
              <span className="font-semibold text-cyan-600 dark:text-cyan-405">{modalLabel}</span>?
            </p>

            {/* TAB MODE VERIFIKASI */}
            <div className="flex border-b border-slate-150 dark:border-slate-800 mb-4 text-xs font-bold uppercase tracking-wider">
              <button
                type="button"
                onClick={() => {
                  setVerificationMode("password");
                  setBiometricStatus("ready");
                }}
                className={`flex-1 pb-2 text-center border-b-2 transition-all ${
                  verificationMode === "password"
                    ? "border-cyan-500 text-cyan-600 dark:text-cyan-400"
                    : "border-transparent text-slate-400 dark:text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
                }`}
              >
                Password
              </button>
              <button
                type="button"
                onClick={() => {
                  setVerificationMode("biometric");
                  setBiometricStatus("ready");
                }}
                className={`flex-1 pb-2 text-center border-b-2 transition-all ${
                  verificationMode === "biometric"
                    ? "border-cyan-500 text-cyan-600 dark:text-cyan-400"
                    : "border-transparent text-slate-400 dark:text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
                }`}
              >
                Pindai Wajah
              </button>
            </div>

            {verificationMode === "password" ? (
              <>
                <p className="text-sm text-slate-600 dark:text-slate-300 mb-3">
                  Masukkan password akun Anda (@{user?.username || user?.name || "operator"}) untuk verifikasi:
                </p>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Masukkan password"
                  className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-slate-800 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500 transition-all"
                  onKeyDown={(e) => e.key === "Enter" && handleConfirmAction()}
                  autoFocus
                />
                {passwordError && (
                  <p className="text-rose-500 text-xs mt-1">{passwordError}</p>
                )}
                <div className="flex gap-3 justify-end mt-4">
                  <button
                    onClick={() => {
                      setIsConfirmModalOpen(false);
                      setPendingAction(null);
                      setPassword("");
                      setPasswordError("");
                    }}
                    className="px-4 py-2 rounded-lg text-sm font-medium bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
                  >
                    Batal
                  </button>
                  <button
                    onClick={handleConfirmAction}
                    disabled={isVerifying}
                    className="px-4 py-2 rounded-lg text-sm font-medium bg-cyan-600 hover:bg-cyan-700 text-white transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isVerifying ? "Memverifikasi..." : "Konfirmasi"}
                  </button>
                </div>
              </>
            ) : (
              <>
                {/* BIOMETRICS SCANNER */}
                <div className="flex flex-col items-center">
                  <style>{`
                    @keyframes scan {
                      0% { top: 5%; }
                      50% { top: 95%; }
                      100% { top: 5%; }
                    }
                    @keyframes pulse-ring {
                      0% { transform: scale(0.95); opacity: 0.2; }
                      50% { transform: scale(1.02); opacity: 0.5; }
                      100% { transform: scale(0.95); opacity: 0.2; }
                    }
                  `}</style>
                  
                  <div className="w-full aspect-[4/3] rounded-xl overflow-hidden bg-slate-950 border border-slate-800 relative flex items-center justify-center shadow-inner">
                    {biometricStatus === "failed" ? (
                      <div className="text-center p-4 space-y-2">
                        <svg className="w-10 h-10 text-rose-500 mx-auto mb-2 animate-pulse" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                        </svg>
                        <span className="text-xs text-rose-400 font-medium font-mono block">Akses Kamera Gagal</span>
                        <button
                          type="button"
                          onClick={async () => {
                            setBiometricStatus("scanning");
                            setBiometricProgress(0);
                            setBiometricLog("Membandingkan wajah (Simulasi)...");
                            let prog = 0;
                            const interval = setInterval(() => {
                              if (prog < 90) {
                                prog += 30;
                                setBiometricProgress(prog);
                              }
                            }, 100);

                            try {
                              const verificationResult = await verifyBiometrics("mock_img");
                              clearInterval(interval);
                              setBiometricProgress(100);

                              if (verificationResult.valid) {
                                setBiometricMatchScore(98.5);
                                setBiometricStatus("success");
                                setBiometricLog(`Wajah Terverifikasi (Simulasi): ${user?.name || "User"}`);
                                setTimeout(async () => {
                                  if (pendingAction) {
                                    await pendingAction();
                                    if (onRefreshData) await onRefreshData();
                                  }
                                  setIsConfirmModalOpen(false);
                                  setPendingAction(null);
                                  setVerificationMode("password");
                                  setBiometricStatus("ready");
                                  setBiometricProgress(0);
                                  setBiometricMatchScore(null);
                                  setPassword("");
                                }, 1500);
                              } else {
                                setBiometricStatus("mismatch");
                                setBiometricLog("Wajah tidak cocok dengan akun Anda.");
                              }
                            } catch (e) {
                              clearInterval(interval);
                              setBiometricStatus("failed");
                              setBiometricLog("Gagal verifikasi biometrik.");
                            }
                          }}
                          className="px-2 py-1 text-[10px] rounded bg-cyan-700 hover:bg-cyan-600 text-white font-bold transition active:scale-95"
                        >
                          Bypass & Simulasi Verifikasi
                        </button>
                      </div>
                    ) : (
                      <>
                        {/* Live camera stream */}
                        <video
                          ref={videoRef}
                          autoPlay
                          playsInline
                          muted
                          className="absolute inset-0 w-full h-full object-cover scale-x-[-1]"
                        />

                        {/* Scanner HUD Overlay */}
                        <div className="absolute inset-0 border border-cyan-500/20 rounded-xl pointer-events-none">
                          {/* Circular scanning area */}
                          <div className={`absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-32 h-32 rounded-full border-2 border-dashed transition-all duration-300 ${
                            biometricStatus === "success" 
                              ? "border-emerald-500 bg-emerald-500/10 scale-105" 
                              : biometricStatus === "scanning"
                              ? "border-cyan-400 scale-100"
                              : "border-cyan-500/40"
                          }`}
                          style={{
                            animation: biometricStatus === "scanning" ? "pulse-ring 2s infinite" : "none"
                          }}>
                            {/* Checkmark overlay on success */}
                            {biometricStatus === "success" && (
                              <div className="absolute inset-0 flex items-center justify-center bg-emerald-950/20 rounded-full">
                                <svg className="w-12 h-12 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="3">
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                                </svg>
                              </div>
                            )}
                          </div>

                          {/* Grid layout */}
                          <div className="absolute inset-0 bg-[linear-gradient(to_right,#0891b208_1px,transparent_1px),linear-gradient(to_bottom,#0891b208_1px,transparent_1px)] bg-[size:16px_16px] pointer-events-none" />

                          {/* Active laser scan line */}
                          {biometricStatus === "scanning" && (
                            <div 
                              className="absolute left-0 w-full h-0.5 bg-cyan-400 shadow-[0_0_8px_#22d3ee] opacity-80"
                              style={{ animation: "scan 2s ease-in-out infinite" }}
                            />
                          )}

                          {/* Futuristic corner brackets */}
                          <div className="absolute top-2 left-2 w-3 h-3 border-t-2 border-l-2 border-cyan-500" />
                          <div className="absolute top-2 right-2 w-3 h-3 border-t-2 border-r-2 border-cyan-500" />
                          <div className="absolute bottom-2 left-2 w-3 h-3 border-b-2 border-l-2 border-cyan-500" />
                          <div className="absolute bottom-2 right-2 w-3 h-3 border-b-2 border-r-2 border-cyan-500" />
                        </div>
                      </>
                    )}
                  </div>

                  {/* Status log messages & progress */}
                  <div className="w-full mt-3 space-y-1.5">
                    {biometricStatus === "scanning" && (
                      <div className="w-full h-1 bg-slate-800 rounded-full overflow-hidden">
                        <div 
                          className="h-full bg-cyan-500 transition-all duration-200"
                          style={{ width: `${biometricProgress}%` }}
                        />
                      </div>
                    )}

                    <div className={`text-[10px] font-mono text-center tracking-wide font-semibold py-1 rounded px-2 ${
                      biometricStatus === "success" 
                        ? "bg-emerald-500/10 text-emerald-450" 
                        : (biometricStatus === "failed" || biometricStatus === "mismatch")
                        ? "bg-rose-500/10 text-rose-455"
                        : biometricStatus === "scanning"
                        ? "text-cyan-450"
                        : "text-slate-400"
                    }`}>
                      {biometricLog}
                    </div>
                  </div>
                </div>

                <div className="flex gap-3 justify-end mt-4 w-full border-t border-slate-100 dark:border-slate-800 pt-3">
                  <button
                    type="button"
                    onClick={() => {
                      setIsConfirmModalOpen(false);
                      setPendingAction(null);
                      setVerificationMode("password");
                      setBiometricStatus("ready");
                      setBiometricProgress(0);
                      setBiometricMatchScore(null);
                      setPassword("");
                    }}
                    className="px-4 py-2 rounded-lg text-sm font-medium bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
                  >
                    Batal
                  </button>
                  {(biometricStatus === "ready" || biometricStatus === "failed" || biometricStatus === "mismatch") && (
                    <button
                      type="button"
                      onClick={startBiometricScan}
                      disabled={biometricStatus === "failed"}
                      className="px-4 py-2 rounded-lg text-sm font-medium bg-cyan-600 hover:bg-cyan-700 text-white transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Mulai Pindai
                    </button>
                  )}
                  {biometricStatus === "scanning" && (
                    <button
                      disabled
                      className="px-4 py-2 rounded-lg text-sm font-medium bg-slate-800 text-cyan-400 transition-all cursor-not-allowed"
                    >
                      Memindai...
                    </button>
                  )}
                  {biometricStatus === "success" && (
                    <button
                      disabled
                      className="px-4 py-2 rounded-lg text-sm font-medium bg-emerald-600 text-white transition-all cursor-not-allowed"
                    >
                      Sukses ✓
                    </button>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* MODAL LOG LENGKAP */}
      {isLogModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl p-6 max-w-3xl w-full max-h-[80vh] border border-slate-200 dark:border-slate-700 flex flex-col">
            <div className="flex justify-between items-center border-b border-slate-200 dark:border-slate-700 pb-3 mb-3">
              <h3 className="text-lg font-bold text-slate-800 dark:text-white">
                Riwayat Aktivitas - {roomName}
              </h3>
              <button
                onClick={() => setIsLogModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 text-xl"
              >
                ✕
              </button>
            </div>
            <div className="flex gap-2 mb-3 flex-wrap">
              {[
                { label: "Semua", value: "all" },
                { label: "Aktifkan", value: "start" },
                { label: "Nonaktifkan", value: "stop" },
                { label: "Maintenance", value: "maintenance" },
              ].map((f) => (
                <button
                  key={f.value}
                  onClick={() => setLogFilter(f.value as typeof logFilter)}
                  className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                    logFilter === f.value
                      ? f.value === "all"
                        ? "bg-cyan-600 text-white"
                        : f.value === "start"
                        ? "bg-emerald-600 text-white"
                        : f.value === "stop"
                        ? "bg-rose-600 text-white"
                        : "bg-blue-600 text-white"
                      : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700"
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>
            <div className="flex-1 overflow-y-auto space-y-3 pr-1">
              {filteredLogs.length === 0 ? (
                <p className="text-slate-400 dark:text-slate-500 italic text-center py-4">
                  Tidak ada log untuk filter ini
                </p>
              ) : (
                filteredLogs.map((log) => (
                  <div
                    key={log.id}
                    className="flex flex-col border-b border-slate-100 dark:border-slate-800 last:border-0 py-2"
                  >
                    <div className="flex justify-between items-start">
                      <span className="text-slate-800 dark:text-white font-medium text-sm">
                        {log.action}
                      </span>
                      <span className="text-slate-400 dark:text-slate-500 text-xs font-mono whitespace-nowrap ml-4">
                        {formatDate(log.timestamp)}
                      </span>
                    </div>
                    <span className="text-slate-500 dark:text-slate-400 text-xs mt-0.5">
                      oleh {log.user}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}