import { useEffect, useMemo, useState, useRef } from "react";
import { ConfirmDialog } from "../components/ui/ConfirmDialog";
import { PageHeader } from "../components/ui/PageHeader";
import { updateProfile, updateBiometrics, verifyPassword } from "../services/auth.service";
import { useAuthStore } from "../store/auth.store";

const initialsFromName = (name?: string | null) => {
  if (!name) return "U";
  const parts = name.trim().split(/\s+/);
  return parts.slice(0, 2).map((part) => part[0]).join("").toUpperCase();
};

export default function Profile() {
  const user = useAuthStore((state) => state.user);
  const updateUser = useAuthStore((state) => state.updateUser);

  const [name, setName] = useState(user?.name ?? "");
  const [avatarUrl, setAvatarUrl] = useState(user?.avatarUrl ?? "");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [confirmSave, setConfirmSave] = useState(false);
  const [confirmAvatar, setConfirmAvatar] = useState(false);
  const [pendingAvatar, setPendingAvatar] = useState<string | null>(null);

  // Biometrics States
  const [isVerifyingPassword, setIsVerifyingPassword] = useState(false);
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isCheckingPassword, setIsCheckingPassword] = useState(false);
  const [isRegistering, setIsRegistering] = useState(false);
  const [biomStatus, setBiomStatus] = useState<"ready" | "scanning" | "success" | "failed">("ready");
  const [biomProgress, setBiomProgress] = useState(0);
  const [biomLog, setBiomLog] = useState("Kamera aktif. Posisikan wajah Anda.");
  const [biometricError, setBiometricError] = useState("");
  const [cameraStreamError, setCameraStreamError] = useState(false);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [regStep, setRegStep] = useState<1 | 2 | 3>(1);
  const [capturedImages, setCapturedImages] = useState<string[]>([]);

  const initials = useMemo(() => initialsFromName(name), [name]);

  // Handle camera access for registration
  useEffect(() => {
    let activeStream: MediaStream | null = null;
    if (isRegistering) {
      setBiomLog("Mengakses kamera...");
      setCameraStreamError(false);

      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        setCameraStreamError(true);
        setBiomLog("Akses kamera gagal: Web biometrik memerlukan koneksi aman (HTTPS atau localhost).");
        return;
      }

      navigator.mediaDevices.getUserMedia({ video: { width: 320, height: 240 } })
        .then((s) => {
          activeStream = s;
          setStream(s);
          if (videoRef.current) {
            videoRef.current.srcObject = s;
          }
          setBiomLog("Langkah 1/3: Posisikan wajah lurus ke depan, lalu ambil foto.");
        })
        .catch((err) => {
          console.error("Camera access error:", err);
          setCameraStreamError(true);
          setBiomLog("Gagal mengakses kamera. Pastikan izin kamera diberikan.");
        });
    }

    return () => {
      if (activeStream) {
        activeStream.getTracks().forEach((track) => track.stop());
      }
      setStream(null);
    };
  }, [isRegistering]);

  const handleVerifyPasswordForBiometrics = async () => {
    if (!confirmPassword.trim()) {
      setBiometricError("Password wajib diisi.");
      return;
    }
    setIsCheckingPassword(true);
    setBiometricError("");
    try {
      const result = await verifyPassword(confirmPassword);
      if (!result.valid) {
        setBiometricError("Password salah. Silakan coba lagi.");
        setIsCheckingPassword(false);
        return;
      }

      setIsVerifyingPassword(false);
      setIsRegistering(true);
      setBiomStatus("ready");
      setRegStep(1);
      setCapturedImages([]);
    } catch (err) {
      setBiometricError("Password salah atau gagal memverifikasi. Silakan coba lagi.");
    } finally {
      setIsCheckingPassword(false);
    }
  };

  const handleStartFaceRegistration = () => {
    if (!videoRef.current) return;
    setBiomStatus("scanning");
    setBiomProgress(0);
    setBiomLog("Menginisialisasi kamera dan pencahayaan...");

    let progress = 0;
    const interval = setInterval(async () => {
      progress += 20;
      setBiomProgress(progress);

      if (progress === 40) {
        setBiomLog("Menganalisis sudut wajah...");
      } else if (progress === 80) {
        setBiomLog("Mengambil gambar wajah...");
      } else if (progress >= 100) {
        clearInterval(interval);
        
        const video = videoRef.current!;
        const canvas = document.createElement("canvas");
        canvas.width = video.videoWidth || 320;
        canvas.height = video.videoHeight || 240;
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          setBiomStatus("failed");
          setBiomLog("Gagal menginisialisasi canvas untuk mengambil foto.");
          return;
        }

        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        const imageBase64 = canvas.toDataURL("image/jpeg", 0.8);
        console.log("Profile Register Capture - Video Dimensions:", video.videoWidth, "x", video.videoHeight);
        console.log("Profile Register Capture - Canvas Dimensions:", canvas.width, "x", canvas.height);
        console.log("Profile Register Capture - Base64 Length:", imageBase64.length);

        if (regStep === 1) {
          setCapturedImages([imageBase64]);
          setRegStep(2);
          setBiomStatus("ready");
          setBiomLog("Langkah 2/3: Hadapkan wajah sedikit ke kiri, lalu ambil foto.");
        } else if (regStep === 2) {
          setCapturedImages((prev) => [...prev, imageBase64]);
          setRegStep(3);
          setBiomStatus("ready");
          setBiomLog("Langkah 3/3: Hadapkan wajah sedikit ke kanan, lalu ambil foto.");
        } else if (regStep === 3) {
          const allImages = [...capturedImages, imageBase64];
          setBiomLog("Menyimpan data biometrik wajah (3 sudut) ke database...");
          try {
            const result = await updateBiometrics(confirmPassword, allImages);
            if (result.success) {
              setBiomStatus("success");
              setBiomLog("Registrasi Biometrik Sukses! 3 sudut wajah telah terdaftar.");
              updateUser(result.data);
              
              setTimeout(() => {
                setIsRegistering(false);
                setConfirmPassword("");
                setRegStep(1);
                setCapturedImages([]);
              }, 2000);
            } else {
              setBiomStatus("failed");
              setBiomLog("Gagal menyimpan biometrik ke server.");
            }
          } catch (err) {
            setBiomStatus("failed");
            setBiomLog(err instanceof Error ? err.message : "Kesalahan server.");
          }
        }
      }
    }, 100);
  };

  const handleCancelRegistration = () => {
    setIsRegistering(false);
    setConfirmPassword("");
    setBiomStatus("ready");
    setBiomProgress(0);
    setRegStep(1);
    setCapturedImages([]);
  };

  useEffect(() => {
    setName(user?.name ?? "");
    setAvatarUrl(user?.avatarUrl ?? "");
  }, [user]);

  const handleAvatarChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") {
        setPendingAvatar(reader.result);
        setConfirmAvatar(true);
      }
    };
    reader.readAsDataURL(file);
  };

  const saveProfile = async () => {
    setSaving(true);
    setMessage(null);
    try {
      const trimmedName = name.trim();
      if (!trimmedName) {
        setMessage("Name cannot be empty.");
        setSaving(false);
        return;
      }

      const result = await updateProfile({
        name: trimmedName,
        avatarUrl: avatarUrl || null
      });
      updateUser(result.data);
      setMessage("Profile updated successfully.");
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Failed to update profile.");
    } finally {
      setSaving(false);
    }
  };

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    setConfirmSave(true);
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Profile Settings"
        description="Manage user identity details and avatar picture."
      />
      <div className="rounded-2xl border border-slate-900 bg-slate-950/60 p-6">
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="flex flex-wrap items-center gap-5">
            {avatarUrl ? (
              <img
                src={avatarUrl}
                alt="User avatar"
                className="h-20 w-20 rounded-full border border-[#acd3ff] object-cover"
              />
            ) : (
              <div className="flex h-20 w-20 items-center justify-center rounded-full border border-[#acd3ff] bg-white text-lg font-semibold text-[#003b75]">
                {initials}
              </div>
            )}
            <div>
              <div className="text-sm font-semibold text-slate-200">
                {user?.email ?? "user@widatra.co"}
              </div>
              <label className="mt-2 inline-flex cursor-pointer items-center gap-2 rounded-full border border-[#acd3ff] px-3 py-1 text-xs text-[#003b75]">
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleAvatarChange}
                  className="hidden"
                />
                Upload Photo
              </label>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="text-xs font-semibold text-[#003b75]">Full Name</label>
              <input
                type="text"
                value={name}
                onChange={(event) => setName(event.target.value)}
                className="mt-2 w-full rounded-xl border border-[#d6e9fb] bg-white px-4 py-3 text-sm focus:border-[#1f6fb5] focus:outline-none"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-[#003b75]">Access Role</label>
              <input
                type="text"
                value={user?.role ?? "user"}
                disabled
                className="mt-2 w-full rounded-xl border border-[#d6e9fb] bg-white px-4 py-3 text-sm text-[#86a9cc]"
              />
            </div>
          </div>

          {message ? (
            <div className="rounded-xl border border-[#d6e9fb] bg-white px-4 py-3 text-xs text-[#47729f]">
              {message}
            </div>
          ) : null}

          <button
            type="submit"
            disabled={saving}
            className="rounded-full bg-[#1f6fb5] px-5 py-2 text-sm font-semibold text-white transition hover:bg-[#155c99] disabled:cursor-not-allowed disabled:opacity-70"
          >
            {saving ? "Saving..." : "Save Changes"}
          </button>
        </form>
      </div>

      <ConfirmDialog
        open={confirmSave}
        title="Confirm Profile Save"
        description="Are you sure you want to save your profile changes?"
        confirmText="Yes"
        cancelText="No"
        onConfirm={() => {
          setConfirmSave(false);
          saveProfile();
        }}
        onCancel={() => setConfirmSave(false)}
      />

      <ConfirmDialog
        open={confirmAvatar}
        title="Confirm Avatar Update"
        description="Do you want to use the newly selected profile photo?"
        confirmText="Yes"
        cancelText="No"
        onConfirm={() => {
          setConfirmAvatar(false);
          if (pendingAvatar) {
            setAvatarUrl(pendingAvatar);
            setPendingAvatar(null);
          }
        }}
        onCancel={() => {
          setConfirmAvatar(false);
          setPendingAvatar(null);
        }}
      />

      {/* SECTION BIOMETRIK WAJAH */}
      <div className="rounded-2xl border border-slate-900 bg-slate-950/60 p-6 space-y-4">
        <h3 className="text-base font-bold text-slate-200">Keamanan Biometrik Wajah</h3>
        <p className="text-xs text-slate-400">
          Gunakan wajah Anda untuk konfirmasi tindakan operasional di dashboard SCADA (seperti start/stop AHU) secara cepat dan aman lintas perangkat.
        </p>

        <div className="flex flex-wrap items-center justify-between gap-4 p-4 rounded-xl bg-slate-900/40 border border-slate-800">
          <div>
            <div className="text-sm font-semibold text-slate-350">Status Biometrik:</div>
            <div className="mt-1 flex items-center gap-2">
              <span className={`h-2.5 w-2.5 rounded-full ${user?.hasBiometrics ? "bg-emerald-500 animate-pulse" : "bg-slate-500"}`}></span>
              <span className={`text-xs font-bold ${user?.hasBiometrics ? "text-emerald-400" : "text-slate-400"}`}>
                {user?.hasBiometrics ? "Terdaftar & Aktif" : "Belum Terdaftar"}
              </span>
            </div>
          </div>

          {!isRegistering && !isVerifyingPassword && (
            <button
              type="button"
              onClick={() => setIsVerifyingPassword(true)}
              className="rounded-full bg-[#1f6fb5] px-5 py-2 text-xs font-semibold text-white transition hover:bg-[#155c99]"
            >
              {user?.hasBiometrics ? "Ganti Biometrik Wajah" : "Daftarkan Biometrik Wajah"}
            </button>
          )}
        </div>

        {/* Form Konfirmasi Password sebelum buka kamera */}
        {isVerifyingPassword && (
          <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800 space-y-3">
            <h4 className="text-xs font-bold text-[#acd3ff] uppercase tracking-wider">Konfirmasi Password Anda</h4>
            <p className="text-xs text-slate-450">
              Masukkan password akun Anda untuk melakukan pengaturan biometrik wajah.
            </p>
            <div className="flex gap-2 max-w-md">
              <input
                type="password"
                placeholder="Password Anda"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    handleVerifyPasswordForBiometrics();
                  }
                }}
                className="flex-1 rounded-lg border border-slate-700 bg-slate-800 px-3 py-1.5 text-xs text-white focus:outline-none focus:border-cyan-500"
              />
              <button
                type="button"
                onClick={handleVerifyPasswordForBiometrics}
                disabled={isCheckingPassword}
                className="rounded-lg bg-cyan-600 px-4 py-1.5 text-xs font-bold text-white hover:bg-cyan-700 disabled:opacity-50"
              >
                {isCheckingPassword ? "Memverifikasi..." : "Lanjut"}
              </button>
              <button
                type="button"
                onClick={() => {
                  setIsVerifyingPassword(false);
                  setConfirmPassword("");
                  setBiometricError("");
                }}
                className="rounded-lg bg-slate-800 px-3 py-1.5 text-xs font-semibold text-slate-300 hover:bg-slate-700"
              >
                Batal
              </button>
            </div>
            {biometricError && (
              <p className="text-rose-500 text-xs font-mono">{biometricError}</p>
            )}
          </div>
        )}

        {/* UI Kamera Pendaftaran */}
        {isRegistering && (
          <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800 space-y-4">
            <style>{`
              @keyframes scan {
                0% { top: 5%; }
                50% { top: 95%; }
                100% { top: 5%; }
              }
            `}</style>
            <h4 className="text-xs font-bold text-[#acd3ff] uppercase tracking-wider">Perekaman Data Wajah</h4>
            
            <div className="flex flex-col md:flex-row gap-4 items-center">
              {/* Webcam frame */}
              <div className="w-64 h-48 rounded-xl overflow-hidden bg-slate-950 border border-slate-700 relative flex items-center justify-center shadow-inner">
                {cameraStreamError ? (
                  <div className="text-center p-3 space-y-2">
                    <span className="text-xs text-rose-500 font-mono block">Akses Kamera Gagal</span>
                    <button
                      type="button"
                      onClick={async () => {
                        setCameraStreamError(false);
                        setBiomStatus("scanning");
                        setBiomProgress(0);
                        setBiomLog("Mensimulasikan pengambilan foto sudut wajah...");
                        let prog = 0;
                        const interval = setInterval(async () => {
                          prog += 20;
                          setBiomProgress(prog);
                          if (prog >= 100) {
                            clearInterval(interval);
                            setBiomLog("Menyimpan data biometrik simulasi ke database...");
                            try {
                              const result = await updateBiometrics(confirmPassword, ["mock_img_1", "mock_img_2", "mock_img_3"]);
                              if (result.success) {
                                setBiomStatus("success");
                                setBiomLog("Registrasi Biometrik Sukses (Simulasi)!");
                                updateUser(result.data);
                                setTimeout(() => {
                                  setIsRegistering(false);
                                  setConfirmPassword("");
                                  setRegStep(1);
                                  setCapturedImages([]);
                                }, 2000);
                              } else {
                                setBiomStatus("failed");
                                setBiomLog("Gagal menyimpan biometrik ke server.");
                              }
                            } catch (err) {
                              setBiomStatus("failed");
                              setBiomLog("Gagal menyimpan data.");
                            }
                          }
                        }, 100);
                      }}
                      className="px-2 py-1 text-[10px] rounded bg-cyan-700 hover:bg-cyan-600 text-white font-bold transition active:scale-95"
                    >
                      Bypass & Simulasi Registrasi
                    </button>
                  </div>
                ) : (
                  <>
                    <video
                      ref={videoRef}
                      autoPlay
                      playsInline
                      muted
                      className="absolute inset-0 w-full h-full object-cover scale-x-[-1]"
                    />
                    
                    {/* Scanner overlay */}
                    <div className="absolute inset-0 border border-cyan-500/20 rounded-xl pointer-events-none">
                      <div className={`absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-28 h-28 rounded-full border-2 border-dashed transition-all duration-300 ${
                        biomStatus === "success" 
                          ? "border-emerald-500 bg-emerald-500/10 scale-105" 
                          : biomStatus === "scanning"
                          ? "border-cyan-400"
                          : "border-cyan-500/40"
                      }`}>
                        {biomStatus === "success" && (
                          <div className="absolute inset-0 flex items-center justify-center bg-emerald-950/20 rounded-full">
                            <svg className="w-10 h-10 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="3">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                            </svg>
                          </div>
                        )}
                      </div>
                      
                      {biomStatus === "scanning" && (
                        <div className="absolute left-0 w-full h-0.5 bg-cyan-400 shadow-[0_0_8px_#22d3ee]"
                          style={{
                            animation: "scan 2s ease-in-out infinite"
                          }}
                        />
                      )}
                    </div>
                  </>
                )}
              </div>

              {/* Progress & control */}
              <div className="flex-1 space-y-2.5 w-full">
                <p className="text-xs text-slate-300 font-medium">
                  Harap sejajarkan wajah Anda di dalam lingkaran target pemindaian kamera.
                </p>

                {biomStatus === "scanning" && (
                  <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-cyan-500 transition-all duration-200"
                      style={{ width: `${biomProgress}%` }}
                    />
                  </div>
                )}

                <div className={`text-[10px] font-mono py-1.5 px-2.5 rounded border ${
                  biomStatus === "success" 
                    ? "bg-emerald-950/40 text-emerald-400 border-emerald-800" 
                    : biomStatus === "scanning"
                    ? "bg-cyan-950/40 text-cyan-400 border-cyan-800"
                    : "bg-slate-950/50 text-slate-400 border-slate-800"
                }`}>
                  {biomLog}
                </div>

                <div className="flex gap-2">
                  {biomStatus !== "scanning" && biomStatus !== "success" && (
                    <button
                      type="button"
                      onClick={handleStartFaceRegistration}
                      disabled={cameraStreamError}
                      className="rounded-lg bg-cyan-600 px-4 py-1.5 text-xs font-bold text-white hover:bg-cyan-700 disabled:opacity-50"
                    >
                      {regStep === 1 ? "Ambil Foto Tengah (1/3)" : regStep === 2 ? "Ambil Foto Kiri (2/3)" : "Ambil Foto Kanan (3/3)"}
                    </button>
                  )}
                  
                  <button
                    type="button"
                    onClick={handleCancelRegistration}
                    disabled={biomStatus === "scanning"}
                    className="rounded-lg bg-slate-800 px-3 py-1.5 text-xs font-semibold text-slate-300 hover:bg-slate-700 disabled:opacity-50"
                  >
                    Tutup Kamera
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
