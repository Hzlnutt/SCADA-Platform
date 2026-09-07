import { useState, useRef, useEffect, useMemo } from "react";
import { useAuthStore } from "../../store/auth.store";
import { verifyBiometrics } from "../../services/auth.service";
import { canAccessHvacControls, type LogEntry } from "./HvacLayout";

// Inline SVG Icons
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

const shieldLockIcon = (
  <svg className="w-12 h-12 text-rose-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="1.8">
    <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
  </svg>
);

interface UnitState {
  temp: number;
  humid: number;
  mode: string;
  status: string;
  ahuStatus: "ON" | "OFF" | "IDLE";
}

interface HvacControlPageProps {
  ahu01: UnitState;
  ahu02: UnitState;
  ahu03: UnitState;
  onUpdateSetpoint: (unitId: "ahu-01" | "ahu-02" | "ahu-03", updates: { temp?: number; humid?: number }) => void;
  onControlAction: (unitId: "ahu-01" | "ahu-02" | "ahu-03", action: "START" | "STOP" | "MAINTENANCE") => Promise<void>;
  logs: LogEntry[];
  onRefreshData?: () => Promise<void> | void;
  onVerifyPassword: (password: string) => Promise<boolean>;
}

export default function HvacControlPage({
  ahu01,
  ahu02,
  ahu03,
  onUpdateSetpoint,
  onControlAction,
  logs,
  onRefreshData,
  onVerifyPassword,
}: HvacControlPageProps) {
  const user = useAuthStore((state) => state.user);
  const userRole = user?.role ?? "";
  const hasControlAccess = useMemo(() => canAccessHvacControls(userRole), [userRole]);

  // Modal confirmation & verification states
  const [isConfirmModalOpen, setIsConfirmModalOpen] = useState(false);
  const [pendingAction, setPendingAction] = useState<(() => Promise<void>) | null>(null);
  const [modalLabel, setModalLabel] = useState("");
  const [password, setPassword] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [isVerifying, setIsVerifying] = useState(false);

  // Biometrics verification state
  const [verificationMode, setVerificationMode] = useState<"password" | "biometric">("password");
  const [biometricStatus, setBiometricStatus] = useState<"ready" | "scanning" | "success" | "failed" | "mismatch">("ready");
  const [biometricProgress, setBiometricProgress] = useState(0);
  const [biometricLog, setBiometricLog] = useState("");
  const [biometricMatchScore, setBiometricMatchScore] = useState<number | null>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);

  // Activity log modal
  const [isLogModalOpen, setIsLogModalOpen] = useState(false);
  const [logFilter, setLogFilter] = useState<"all" | "start" | "stop" | "maintenance">("all");

  // Active tab filter: 'all' | 'ahu-01' | 'ahu-02' | 'ahu-03'
  const [activeUnitTab, setActiveUnitTab] = useState<"all" | "ahu-01" | "ahu-02" | "ahu-03">("all");

  // Camera stream cleanup and initiation
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
      setStream((prev) => {
        if (prev) prev.getTracks().forEach((t) => t.stop());
        return null;
      });
    };
  }, [isConfirmModalOpen, verificationMode, user]);

  const startBiometricScan = async () => {
    if (biometricStatus !== "ready" && biometricStatus !== "failed" && biometricStatus !== "mismatch") return;
    if (!user?.hasBiometrics) {
      setBiometricStatus("failed");
      setBiometricLog("Biometrik wajah belum terdaftar.");
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

    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth || 320;
    canvas.height = video.videoHeight || 240;
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      setBiometricStatus("failed");
      setBiometricLog("Gagal memproses gambar canvas.");
      return;
    }

    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    const imageBase64 = canvas.toDataURL("image/jpeg", 0.8);

    let progress = 0;
    const interval = setInterval(() => {
      if (progress < 90) {
        progress += 10;
        setBiometricProgress(progress);
        if (progress === 30) setBiometricLog("Melacak kontur wajah...");
        else if (progress === 60) setBiometricLog("Membandingkan wajah...");
      }
    }, 80);

    try {
      const verificationResult = await verifyBiometrics(imageBase64);
      clearInterval(interval);
      setBiometricProgress(100);

      if (verificationResult.valid) {
        const rawScore = 1 - (verificationResult.distance || 0) / 0.22;
        const match = parseFloat(Math.min(100, Math.max(70, 70 + rawScore * 30)).toFixed(2));
        setBiometricMatchScore(match);
        setBiometricStatus("success");
        setBiometricLog(`Wajah Terverifikasi: ${user.name} (${match}%)`);

        setTimeout(async () => {
          if (pendingAction) {
            try {
              await pendingAction();
              if (onRefreshData) await onRefreshData();
            } catch (err) {
              console.error("Action error:", err);
            }
          }
          setIsConfirmModalOpen(false);
          setPendingAction(null);
          setVerificationMode("password");
          setBiometricStatus("ready");
          setPassword("");
        }, 1200);
      } else {
        setBiometricStatus("mismatch");
        setBiometricLog("Wajah tidak cocok dengan akun Anda. Silakan coba lagi.");
      }
    } catch {
      clearInterval(interval);
      setBiometricStatus("failed");
      setBiometricLog("Terjadi kesalahan verifikasi kamera.");
    }
  };

  const handleTriggerAction = (
    unitId: "ahu-01" | "ahu-02" | "ahu-03",
    action: "START" | "STOP" | "MAINTENANCE"
  ) => {
    const label = `${action} ${unitId.toUpperCase()}`;
    setModalLabel(label);
    setPendingAction(() => () => onControlAction(unitId, action));
    setPassword("");
    setPasswordError("");
    setIsConfirmModalOpen(true);
  };

  const handlePasswordConfirm = async () => {
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
      if (onRefreshData) await onRefreshData();
      setIsConfirmModalOpen(false);
      setPendingAction(null);
      setPassword("");
    } catch {
      setPasswordError("Terjadi kesalahan saat memproses tindakan.");
    } finally {
      setIsVerifying(false);
    }
  };

  // ── BLOCK UNAUTHORIZED ACCESS ─────────────────────────────────────
  if (!hasControlAccess) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[450px] p-8 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm text-center">
        <div className="p-4 rounded-2xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/50 mb-4">
          {shieldLockIcon}
        </div>
        <h2 className="text-xl font-bold text-slate-800 dark:text-white mb-2 font-mono">
          Akses Kontrol Terbatas
        </h2>
        <p className="text-sm text-slate-600 dark:text-slate-400 max-w-md mb-4 leading-relaxed">
          Halaman kontrol dan setpoint HVAC hanya dapat diakses dan dioperasikan oleh pengguna dengan hak akses{" "}
          <strong className="text-rose-600 dark:text-rose-400 font-semibold">Leader</strong> atau{" "}
          <strong className="text-rose-600 dark:text-rose-400 font-semibold">Kashift HVAC</strong>.
        </p>
        <div className="px-3.5 py-1.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 text-xs font-mono">
          Role Anda saat ini: <span className="font-bold text-slate-800 dark:text-slate-200 uppercase">{userRole || "Viewer"}</span>
        </div>
      </div>
    );
  }

  const units = [
    {
      id: "ahu-01" as const,
      name: "AHU-01",
      room: "Accelerated Stability Room",
      target: "40°C ± 2°C | 75%RH ± 5%",
      state: ahu01,
      tempRange: { min: 30.0, max: 50.0, label: "Temperature Setpoint (°C)" },
      humidRange: { min: 60.0, max: 90.0, label: "Humidity Setpoint (%RH)" },
    },
    {
      id: "ahu-02" as const,
      name: "AHU-02",
      room: "Longterm Stability Room",
      target: "30°C ± 2°C | 75%RH ± 5%",
      state: ahu02,
      tempRange: { min: 15.0, max: 35.0, label: "Cooling Target Temp (°C)" },
      humidRange: { min: 30.0, max: 80.0, label: "Dehumidify Target (%RH)" },
    },
    {
      id: "ahu-03" as const,
      name: "AHU-03",
      room: "Ref. Retention Room",
      target: "Max 30°C | 55%RH ± 10%",
      state: ahu03,
      tempRange: { min: 15.0, max: 30.0, label: "Room Temp SP (°C)" },
      humidRange: { min: 30.0, max: 80.0, label: "Room Humidity SP (%RH)" },
    },
  ];

  const filteredUnits = activeUnitTab === "all" ? units : units.filter((u) => u.id === activeUnitTab);

  const filteredLogs = logs.filter((log) => {
    if (logFilter === "all") return true;
    return log.type === logFilter;
  });

  return (
    <div className="space-y-6">
      {/* HEADER CONTROLS BANNER */}
      <div className="flex flex-wrap items-center justify-between gap-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-black text-slate-800 dark:text-white tracking-tight font-mono">
              HVAC CONTROL STATION
            </h1>
            <span className="px-3 py-1 rounded-full text-xs font-bold bg-cyan-50 dark:bg-cyan-950/60 text-cyan-700 dark:text-cyan-400 border border-cyan-200 dark:border-cyan-800 uppercase tracking-wide">
              QC Retained Sample
            </span>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 font-mono">
            Pusat pengaturan setpoints parameter dan eksekusi kendali mesin operasional AHU.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 bg-slate-50 dark:bg-slate-950 px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-800 text-xs">
            <span className="text-slate-400 dark:text-slate-500 font-mono">Operator:</span>
            <span className="font-bold text-slate-800 dark:text-slate-200">{user?.name || "Admin"}</span>
            <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
              {userRole}
            </span>
          </div>

          {onRefreshData && (
            <button
              onClick={() => onRefreshData()}
              className="px-3 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs font-semibold font-mono transition"
              title="Refresh Data Telemetri"
            >
              🔄 Refresh
            </button>
          )}
        </div>
      </div>

      {/* FILTER UNIT TABS */}
      <div className="flex items-center gap-2 border-b border-slate-200 dark:border-slate-800 pb-2">
        <span className="text-xs font-bold font-mono text-slate-400 dark:text-slate-500 mr-2 uppercase">Unit Filter:</span>
        <button
          onClick={() => setActiveUnitTab("all")}
          className={`px-3.5 py-1.5 rounded-lg text-xs font-bold font-mono transition ${
            activeUnitTab === "all"
              ? "bg-cyan-600 text-white shadow-sm"
              : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700"
          }`}
        >
          Semua Unit ({units.length})
        </button>
        {units.map((u) => (
          <button
            key={u.id}
            onClick={() => setActiveUnitTab(u.id)}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-bold font-mono transition ${
              activeUnitTab === u.id
                ? "bg-cyan-600 text-white shadow-sm"
                : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700"
            }`}
          >
            {u.name}
          </button>
        ))}
      </div>

      {/* GRID OF AHU CONTROL CARDS */}
      <div className={`grid gap-6 ${filteredUnits.length === 1 ? "grid-cols-1 max-w-2xl" : "grid-cols-1 md:grid-cols-2 xl:grid-cols-3"}`}>
        {filteredUnits.map((unit) => {
          return (
            <div
              key={unit.id}
              className="flex flex-col bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm hover:shadow-md transition duration-300"
            >
              {/* CARD TOP INFO */}
              <div className="flex justify-between items-start border-b border-slate-100 dark:border-slate-800 pb-4 mb-4">
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-lg font-black font-mono text-slate-800 dark:text-white">
                      {unit.name}
                    </h3>
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-bold font-mono uppercase ${
                        unit.state.ahuStatus === "ON"
                          ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20"
                          : unit.state.ahuStatus === "IDLE"
                          ? "bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20"
                          : "bg-rose-500/10 text-rose-600 dark:text-rose-405 border border-rose-500/20"
                      }`}
                    >
                      {unit.state.ahuStatus}
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 dark:text-slate-400 font-medium mt-0.5">
                    {unit.room}
                  </p>
                  <p className="text-[11px] text-cyan-600 dark:text-cyan-400 font-mono mt-1">
                    Target: {unit.target}
                  </p>
                </div>

                <div className="text-right">
                  <span className="text-[9px] text-slate-400 uppercase font-mono block">Mode</span>
                  <span
                    className={`text-xs font-bold font-mono ${
                      unit.state.mode === "Auto" ? "text-cyan-600 dark:text-cyan-400" : "text-amber-600 dark:text-amber-400"
                    }`}
                  >
                    {unit.state.mode}
                  </span>
                </div>
              </div>

              {/* SETPOINTS ADJUSTMENT SECTION */}
              <div className="space-y-4 mb-6 bg-slate-50 dark:bg-slate-950/60 p-4 rounded-xl border border-slate-150 dark:border-slate-800/80">
                <div className="flex justify-between items-center">
                  <h4 className="text-xs font-bold font-mono uppercase tracking-wider text-slate-700 dark:text-slate-300">
                    Setpoints Parameter
                  </h4>
                  <span className="text-[10px] text-slate-400 font-mono">Real-time Slider</span>
                </div>

                {/* Temp slider */}
                <div className="space-y-1.5">
                  <div className="flex justify-between text-xs font-mono">
                    <span className="text-slate-600 dark:text-slate-400 font-medium">{unit.tempRange.label}</span>
                    <span className="text-cyan-600 dark:text-cyan-400 font-bold text-sm">
                      {unit.state.temp.toFixed(1)}°C
                    </span>
                  </div>
                  <input
                    type="range"
                    min={unit.tempRange.min}
                    max={unit.tempRange.max}
                    step={0.1}
                    value={unit.state.temp}
                    onChange={(e) => onUpdateSetpoint(unit.id, { temp: parseFloat(e.target.value) })}
                    className="w-full h-2 bg-slate-200 dark:bg-slate-800 rounded-lg appearance-none cursor-pointer accent-cyan-600 dark:accent-cyan-400"
                  />
                  <div className="flex justify-between text-[10px] text-slate-400 font-mono">
                    <span>{unit.tempRange.min}°C</span>
                    <span>{unit.tempRange.max}°C</span>
                  </div>
                </div>

                {/* Humid slider */}
                <div className="space-y-1.5">
                  <div className="flex justify-between text-xs font-mono">
                    <span className="text-slate-600 dark:text-slate-400 font-medium">{unit.humidRange.label}</span>
                    <span className="text-cyan-600 dark:text-cyan-400 font-bold text-sm">
                      {unit.state.humid.toFixed(1)}%RH
                    </span>
                  </div>
                  <input
                    type="range"
                    min={unit.humidRange.min}
                    max={unit.humidRange.max}
                    step={0.1}
                    value={unit.state.humid}
                    onChange={(e) => onUpdateSetpoint(unit.id, { humid: parseFloat(e.target.value) })}
                    className="w-full h-2 bg-slate-200 dark:bg-slate-800 rounded-lg appearance-none cursor-pointer accent-cyan-600 dark:accent-cyan-400"
                  />
                  <div className="flex justify-between text-[10px] text-slate-400 font-mono">
                    <span>{unit.humidRange.min}%</span>
                    <span>{unit.humidRange.max}%</span>
                  </div>
                </div>
              </div>

              {/* ACTION BUTTONS (START, STOP, MAINTENANCE) */}
              <div className="space-y-2 mt-auto">
                <span className="text-[10px] font-bold font-mono text-slate-400 dark:text-slate-500 uppercase tracking-wider block">
                  Perintah Kontrol ({unit.name})
                </span>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    onClick={() => handleTriggerAction(unit.id, "START")}
                    disabled={unit.state.status === "Running"}
                    className={`flex items-center justify-center gap-1.5 py-2.5 px-2 rounded-xl font-bold font-mono text-xs transition duration-200 ${
                      unit.state.status === "Running"
                        ? "bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-600 cursor-not-allowed opacity-60"
                        : "bg-emerald-600 hover:bg-emerald-500 text-white shadow-sm hover:shadow active:scale-95"
                    }`}
                  >
                    {startIcon}
                    <span>START</span>
                  </button>

                  <button
                    onClick={() => handleTriggerAction(unit.id, "STOP")}
                    disabled={unit.state.status === "Stopped"}
                    className={`flex items-center justify-center gap-1.5 py-2.5 px-2 rounded-xl font-bold font-mono text-xs transition duration-200 ${
                      unit.state.status === "Stopped"
                        ? "bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-600 cursor-not-allowed opacity-60"
                        : "bg-rose-600 hover:bg-rose-500 text-white shadow-sm hover:shadow active:scale-95"
                    }`}
                  >
                    {stopIcon}
                    <span>STOP</span>
                  </button>

                  <button
                    onClick={() => handleTriggerAction(unit.id, "MAINTENANCE")}
                    disabled={unit.state.status === "Maintenance"}
                    className={`flex items-center justify-center gap-1.5 py-2.5 px-2 rounded-xl font-bold font-mono text-xs transition duration-200 ${
                      unit.state.status === "Maintenance"
                        ? "bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-600 cursor-not-allowed opacity-60"
                        : "bg-blue-600 hover:bg-blue-500 text-white shadow-sm hover:shadow active:scale-95"
                    }`}
                  >
                    {maintenanceIcon}
                    <span>MAINT</span>
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* ACTIVITY LOG FOOTER CARD */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm">
        <div className="flex justify-between items-center border-b border-slate-100 dark:border-slate-800 pb-3 mb-3">
          <div className="flex items-center gap-2.5">
            <h3 className="text-sm font-bold font-mono text-slate-800 dark:text-white uppercase tracking-wide">
              Catatan Aktivitas Kontrol (Activity Log)
            </h3>
            <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-slate-100 dark:bg-slate-800 text-slate-500">
              {logs.length} Aktivitas
            </span>
          </div>
          <button
            onClick={() => setIsLogModalOpen(true)}
            className="text-xs text-cyan-600 dark:text-cyan-400 hover:underline font-mono font-bold"
          >
            Lihat Semua Log →
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {logs.slice(0, 6).map((log) => (
            <div
              key={log.id}
              className="flex flex-col p-3 rounded-xl bg-slate-50 dark:bg-slate-950/50 border border-slate-100 dark:border-slate-800/80 text-xs"
            >
              <div className="flex justify-between items-start">
                <span className="font-bold text-slate-800 dark:text-slate-200">
                  {log.action}
                </span>
                <span className="text-[10px] font-mono text-slate-400">
                  {new Date(log.timestamp).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
                </span>
              </div>
              <span className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
                Operator: <strong className="text-slate-700 dark:text-slate-300">{log.user}</strong>
              </span>
            </div>
          ))}
          {logs.length === 0 && (
            <p className="text-xs text-slate-400 dark:text-slate-500 italic col-span-3 py-3 text-center">
              Belum ada riwayat kontrol yang tercatat.
            </p>
          )}
        </div>
      </div>

      {/* CONFIRMATION & AUTHENTICATION MODAL */}
      {isConfirmModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl p-6 max-w-sm w-full border border-slate-200 dark:border-slate-700 animate-in fade-in zoom-in-95 duration-200">
            <h3 className="text-base font-bold text-slate-800 dark:text-white mb-1 font-mono">
              Otorisasi Tindakan Kontrol
            </h3>
            <p className="text-xs text-slate-600 dark:text-slate-400 mb-4">
              Konfirmasi eksekusi perintah:{" "}
              <span className="font-bold font-mono text-cyan-600 dark:text-cyan-400">{modalLabel}</span>
            </p>

            {/* TAB MODE VERIFIKASI */}
            <div className="flex border-b border-slate-200 dark:border-slate-800 mb-4 text-xs font-bold font-mono">
              <button
                type="button"
                onClick={() => {
                  setVerificationMode("password");
                  setPasswordError("");
                }}
                className={`flex-1 py-2 text-center border-b-2 transition ${
                  verificationMode === "password"
                    ? "border-cyan-500 text-cyan-600 dark:text-cyan-400"
                    : "border-transparent text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
                }`}
              >
                Password Akun
              </button>
              <button
                type="button"
                onClick={() => {
                  setVerificationMode("biometric");
                  setPasswordError("");
                }}
                className={`flex-1 py-2 text-center border-b-2 transition ${
                  verificationMode === "biometric"
                    ? "border-cyan-500 text-cyan-600 dark:text-cyan-400"
                    : "border-transparent text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
                }`}
              >
                Face Biometrik
              </button>
            </div>

            {verificationMode === "password" ? (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  handlePasswordConfirm();
                }}
                className="space-y-4"
              >
                <div>
                  <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">
                    Masukkan Password Akun ({user?.name}):
                  </label>
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Password Anda"
                    autoFocus
                    className="w-full px-3 py-2 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-cyan-500 text-slate-800 dark:text-white"
                  />
                  {passwordError && (
                    <p className="text-xs text-rose-500 font-medium mt-1">{passwordError}</p>
                  )}
                </div>

                <div className="flex justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => {
                      setIsConfirmModalOpen(false);
                      setPendingAction(null);
                      setPassword("");
                    }}
                    className="px-4 py-2 text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition"
                  >
                    Batal
                  </button>
                  <button
                    type="submit"
                    disabled={isVerifying || !password}
                    className="px-4 py-2 text-xs font-bold text-white bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 rounded-xl transition shadow"
                  >
                    {isVerifying ? "Memverifikasi..." : "Konfirmasi"}
                  </button>
                </div>
              </form>
            ) : (
              <div className="space-y-4">
                <div className="relative w-full aspect-video bg-black rounded-xl overflow-hidden flex items-center justify-center border border-slate-700">
                  <video
                    ref={videoRef}
                    autoPlay
                    playsInline
                    muted
                    className={`w-full h-full object-cover ${biometricStatus === "scanning" ? "opacity-90" : ""}`}
                  />
                  {biometricStatus === "scanning" && (
                    <div className="absolute inset-0 border-2 border-cyan-400 animate-pulse rounded-xl" />
                  )}
                  {biometricStatus === "success" && (
                    <div className="absolute inset-0 bg-emerald-500/30 flex items-center justify-center">
                      <span className="text-white text-lg font-bold">✓ Terverifikasi</span>
                    </div>
                  )}
                </div>

                {biometricProgress > 0 && biometricProgress < 100 && (
                  <div className="w-full bg-slate-200 dark:bg-slate-700 h-1.5 rounded-full overflow-hidden">
                    <div className="bg-cyan-500 h-full transition-all duration-100" style={{ width: `${biometricProgress}%` }} />
                  </div>
                )}

                <p className="text-xs text-center font-mono text-slate-500 dark:text-slate-400">
                  {biometricLog}
                </p>

                <div className="flex justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => {
                      setIsConfirmModalOpen(false);
                      setPendingAction(null);
                      setVerificationMode("password");
                    }}
                    className="px-4 py-2 text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition"
                  >
                    Batal
                  </button>
                  <button
                    type="button"
                    onClick={startBiometricScan}
                    disabled={biometricStatus === "scanning" || biometricStatus === "success"}
                    className="px-4 py-2 text-xs font-bold text-white bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 rounded-xl transition shadow"
                  >
                    {biometricStatus === "scanning" ? "Memindai..." : "Mulai Pindai Wajah"}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* MODAL FULL LOGS */}
      {isLogModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl p-6 max-w-2xl w-full border border-slate-200 dark:border-slate-800 max-h-[85vh] flex flex-col">
            <div className="flex justify-between items-center border-b border-slate-200 dark:border-slate-800 pb-3 mb-4">
              <h3 className="text-base font-bold font-mono text-slate-800 dark:text-white">
                Log Aktivitas Kendali HVAC
              </h3>
              <button
                onClick={() => setIsLogModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 font-bold"
              >
                ✕
              </button>
            </div>

            {/* Filter buttons */}
            <div className="flex gap-2 mb-4">
              {(["all", "start", "stop", "maintenance"] as const).map((filter) => (
                <button
                  key={filter}
                  onClick={() => setLogFilter(filter)}
                  className={`px-3 py-1 rounded-lg text-xs font-mono uppercase font-bold transition ${
                    logFilter === filter
                      ? "bg-cyan-600 text-white"
                      : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400"
                  }`}
                >
                  {filter}
                </button>
              ))}
            </div>

            <div className="flex-1 overflow-y-auto space-y-2 pr-2 text-xs">
              {filteredLogs.length === 0 ? (
                <p className="text-center py-6 text-slate-400 italic">Tidak ada log untuk filter ini.</p>
              ) : (
                filteredLogs.map((log) => (
                  <div
                    key={log.id}
                    className="flex justify-between items-center p-3 rounded-xl bg-slate-50 dark:bg-slate-950/60 border border-slate-100 dark:border-slate-800"
                  >
                    <div>
                      <span className="font-bold text-slate-800 dark:text-slate-200 block">{log.action}</span>
                      <span className="text-[11px] text-slate-500">Operator: {log.user}</span>
                    </div>
                    <span className="font-mono text-[11px] text-slate-400">
                      {new Date(log.timestamp).toLocaleString("id-ID")}
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
