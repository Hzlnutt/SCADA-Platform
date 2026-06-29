import { type ReactNode, useState, useEffect, useRef, useMemo } from "react";
import { useAuthStore } from "../../store/auth.store";
import { verifyBiometrics } from "../../services/auth.service";

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

interface HvacLayoutProps {
  roomName: string;
  roomType: string;
  targetTemp: string;
  targetHumidity: string;
  diagramComponent: ReactNode;
  systemMode: SystemModeItem[];
  setpoints?: SetpointConfig[];
  controlButtons?: ControlButtonItem[];
  currentUser?: string;
  onVerifyPassword: (password: string) => Promise<boolean>;
  logs: LogEntry[];
  onRefreshData?: () => Promise<void> | void;
  currentMode?: string;
  currentStatus?: string;
}

export interface LogEntry {
  id: string | number;
  action: string;
  user: string;
  timestamp: Date;
  type: "start" | "stop" | "maintenance" | "other";
}

export default function HvacLayout({
  roomName,
  roomType,
  targetTemp,
  targetHumidity,
  diagramComponent,
  systemMode,
  setpoints,
  controlButtons,
  currentUser = "Unknown User",
  onVerifyPassword,
  logs,
  onRefreshData,
  currentMode = "Auto",
  currentStatus = "Running",
}: HvacLayoutProps) {
  const [pendingAction, setPendingAction] = useState<(() => void) | null>(null);
  const [isConfirmModalOpen, setIsConfirmModalOpen] = useState(false);
  const [modalLabel, setModalLabel] = useState("");
  const [password, setPassword] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [isVerifying, setIsVerifying] = useState(false);

  // Access auth store user
  const user = useAuthStore((state) => state.user);

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
      const isValid = await onVerifyPassword(password);
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

  const recentLogs = logs.slice(0, 3);
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

        <div className="flex items-center gap-6 bg-slate-50 dark:bg-slate-950 px-4 py-3 rounded-lg border border-slate-150 dark:border-slate-900">
          <div className="flex flex-col items-end">
            <span className="text-[10px] text-slate-450 dark:text-slate-500 font-mono uppercase tracking-wider">
              MODE
            </span>
            <span className={`text-sm font-bold font-mono ${
              currentMode === "Auto" 
                ? "text-cyan-600 dark:text-cyan-400" 
                : "text-amber-600 dark:text-amber-400"
            }`}>
              {currentMode}
            </span>
          </div>
          <div className="h-6 w-px bg-slate-200 dark:bg-slate-800"></div>
          <div className="flex flex-col items-end">
            <span className="text-[10px] text-slate-450 dark:text-slate-500 font-mono uppercase tracking-wider">
              STATUS
            </span>
            <span className={`text-sm font-bold font-mono flex items-center gap-1.5 ${
              currentStatus === "Running" 
                ? "text-emerald-600 dark:text-emerald-400" 
                : currentStatus === "Maintenance"
                ? "text-amber-600 dark:text-amber-400"
                : "text-rose-600 dark:text-rose-455"
            }`}>
              {currentStatus === "Running" && (
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                </span>
              )}
              {currentStatus === "Maintenance" && (
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500"></span>
                </span>
              )}
              {currentStatus !== "Running" && currentStatus !== "Maintenance" && (
                <span className="h-2 w-2 rounded-full bg-rose-500"></span>
              )}
              {currentStatus}
            </span>
          </div>
        </div>
      </div>

      {/* MAIN AREA */}
      <div className="flex gap-4 flex-1 min-h-0">
        <div className="flex-1 rounded-xl border border-slate-200 dark:border-slate-800 bg-white/70 dark:bg-slate-900/50 relative flex items-center justify-center p-2 min-h-0 shadow-sm transition-all duration-300 overflow-hidden">
          <div className="w-full h-full flex items-center justify-center overflow-hidden">
            {diagramComponent}
          </div>
        </div>

        <div className="w-80 flex flex-col gap-4 h-full min-h-0">
          {/* SYSTEM MODE */}
          <div
            className={`${
              setpoints?.length || controlButtons?.length ? "flex-[1.5]" : "flex-1"
            } border border-slate-200 dark:border-slate-800 rounded-xl bg-white dark:bg-slate-900 p-4 flex flex-col min-h-0 shadow-sm dark:shadow-2xl transition-all duration-300`}
          >
            <h3 className="text-slate-800 dark:text-white font-bold font-mono text-sm border-b border-slate-100 dark:border-slate-800 pb-2 mb-3 tracking-wide">
              SYSTEM MODE
            </h3>
            <div className="flex-1 overflow-y-auto space-y-2.5 pr-1 text-xs">
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

          {/* SETPOINTS */}
          {setpoints && setpoints.length > 0 && (
            <div className="flex-[1.2] border border-slate-200 dark:border-slate-800 rounded-xl bg-white dark:bg-slate-900 p-4 flex flex-col min-h-[160px] shadow-sm dark:shadow-2xl transition-all duration-300">
              <h3 className="text-slate-800 dark:text-white font-bold font-mono text-sm border-b border-slate-100 dark:border-slate-800 pb-2 mb-3 tracking-wide">
                SETPOINTS
              </h3>
              <div className="flex-1 overflow-y-auto space-y-4 pr-1">
                {setpoints.map((sp, idx) => (
                  <div key={idx} className="space-y-1.5">
                    <div className="flex justify-between text-xs font-mono">
                      <span className="text-slate-500 dark:text-slate-400 font-medium">{sp.label}</span>
                      <span className="text-slate-800 dark:text-white font-bold">
                        {sp.value.toFixed(1)}
                        {sp.unit}
                      </span>
                    </div>
                    <div className="relative flex items-center group">
                      <input
                        type="range"
                        min={sp.min}
                        max={sp.max}
                        step={sp.step ?? 0.1}
                        value={sp.value}
                        onChange={(e) => sp.onChange(parseFloat(e.target.value))}
                        className="w-full h-1.5 bg-slate-100 dark:bg-slate-800 rounded-lg appearance-none cursor-pointer accent-cyan-600 dark:accent-cyan-400 transition-all duration-200"
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* CONTROL PANEL */}
          {controlButtons && controlButtons.length > 0 && (
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
          {controlButtons && controlButtons.length > 0 && (
            <div className="flex-[1.2] min-h-[180px] border border-slate-200 dark:border-slate-800 rounded-xl bg-white dark:bg-slate-900 p-4 flex flex-col shadow-sm dark:shadow-2xl transition-all duration-300">
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
              <div className="flex-1 overflow-y-auto space-y-2 pr-1 text-xs">
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
          )}
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
                  Masukkan password Anda untuk verifikasi:
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
                      <div className="text-center p-4">
                        <svg className="w-10 h-10 text-rose-500 mx-auto mb-2 animate-pulse" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                        </svg>
                        <span className="text-xs text-rose-400 font-medium font-mono">Akses Kamera Gagal</span>
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