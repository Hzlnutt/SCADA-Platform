import { useEffect, useState } from "react";
import { getJson, postJson, putJson } from "../../services/api.client";
import { useAuthStore } from "../../store/auth.store";
import { canEditWarehouse7Config } from "../../utils/roles";

interface Wh7ConfigData {
  baseUrl: string;
  authMode: "api_key" | "login";
  hasApiKey: boolean;
  apiKeyMasked: string;
  username: string;
  hasPassword: boolean;
  idWh: number | null;
  nmGudang: string;
  minTemp: number;
  maxTemp: number;
  pollIntervalMs: number;
}

export default function Warehouse7ConfigConsole() {
  const role = useAuthStore((state) => state.user?.role ?? "user");
  const canEdit = canEditWarehouse7Config(role);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [statusMsg, setStatusMsg] = useState<{ type: "ok" | "err"; text: string } | null>(null);
  const [discoveredWarehouses, setDiscoveredWarehouses] = useState<Array<{ id_wh: number; nm_gudang: string }>>([]);

  const [baseUrl, setBaseUrl] = useState("http://172.16.4.122:8002");
  const [authMode, setAuthMode] = useState<"api_key" | "login">("api_key");
  const [apiKeyInput, setApiKeyInput] = useState("");
  const [hasStoredApiKey, setHasStoredApiKey] = useState(false);
  const [maskedKey, setMaskedKey] = useState("");
  const [username, setUsername] = useState("");
  const [passwordInput, setPasswordInput] = useState("");
  const [hasStoredPassword, setHasStoredPassword] = useState(false);
  const [idWh, setIdWh] = useState<string>("");
  const [nmGudang, setNmGudang] = useState("Gudang 7");
  const [minTemp, setMinTemp] = useState<string>("24");
  const [maxTemp, setMaxTemp] = useState<string>("30");

  useEffect(() => {
    setLoading(true);
    getJson<{ success: boolean; canEdit: boolean; data: Wh7ConfigData }>("/warehouse/wh7/config")
      .then((res) => {
        if (res?.data) {
          setBaseUrl(res.data.baseUrl || "http://172.16.4.122:8002");
          setAuthMode(res.data.authMode === "login" ? "login" : "api_key");
          setHasStoredApiKey(Boolean(res.data.hasApiKey));
          setMaskedKey(res.data.apiKeyMasked || "");
          setUsername(res.data.username || "");
          setHasStoredPassword(Boolean(res.data.hasPassword));
          setIdWh(res.data.idWh !== null && res.data.idWh !== undefined ? String(res.data.idWh) : "");
          setNmGudang(res.data.nmGudang || "Gudang 7");
          setMinTemp(String(res.data.minTemp ?? 24));
          setMaxTemp(String(res.data.maxTemp ?? 30));
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (!canEdit) {
    return (
      <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 p-8 text-center text-sm text-slate-500 shadow-sm">
        <div className="text-3xl mb-2">🔒</div>
        <h3 className="font-bold text-slate-700 dark:text-slate-200 text-base mb-1">Akses Konfigurasi Dibatasi</h3>
        <p className="max-w-lg mx-auto">
          Pengaturan batas suhu (Min/Max) dan koneksi API Warehouse 7 hanya dapat diakses dan diubah oleh role{" "}
          <span className="font-bold">Unit Head HVAC</span>, <span className="font-bold">Senior Unit Head</span>,{" "}
          <span className="font-bold">Unit Head Utility</span>, dan <span className="font-bold">Admin</span>.
        </p>
      </div>
    );
  }

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsedMin = Number(minTemp);
    const parsedMax = Number(maxTemp);
    if (!Number.isFinite(parsedMin) || !Number.isFinite(parsedMax) || parsedMin >= parsedMax) {
      setStatusMsg({ type: "err", text: "Min Temp harus berupa angka valid dan lebih kecil dari Max Temp." });
      return;
    }

    setSaving(true);
    setStatusMsg(null);
    try {
      const payload = {
        baseUrl: baseUrl.trim(),
        authMode,
        apiKey: apiKeyInput.trim() ? apiKeyInput.trim() : (hasStoredApiKey ? "__KEEP__" : ""),
        username: username.trim(),
        password: passwordInput ? passwordInput : (hasStoredPassword ? "__KEEP__" : ""),
        idWh: idWh.trim() ? Number(idWh.trim()) : null,
        nmGudang: nmGudang.trim() || "Gudang 7",
        minTemp: parsedMin,
        maxTemp: parsedMax
      };
      const res = await putJson<{ success: boolean; message?: string; data?: Wh7ConfigData }>("/warehouse/wh7/config", payload);
      if (res?.data) {
        setHasStoredApiKey(Boolean(res.data.hasApiKey));
        setMaskedKey(res.data.apiKeyMasked || "");
        setHasStoredPassword(Boolean(res.data.hasPassword));
      }
      setApiKeyInput("");
      setPasswordInput("");
      setStatusMsg({ type: "ok", text: res?.message || "Konfigurasi Warehouse 7 berhasil disimpan." });
    } catch (err: any) {
      setStatusMsg({ type: "err", text: err?.message || "Gagal menyimpan konfigurasi Warehouse 7." });
    } finally {
      setSaving(false);
    }
  };

  const handleTestConnection = async () => {
    setTesting(true);
    setStatusMsg(null);
    try {
      const payload = {
        baseUrl: baseUrl.trim(),
        authMode,
        apiKey: apiKeyInput.trim() ? apiKeyInput.trim() : (hasStoredApiKey ? "__KEEP__" : ""),
        username: username.trim(),
        password: passwordInput ? passwordInput : (hasStoredPassword ? "__KEEP__" : "")
      };
      const res = await postJson<{
        success: boolean;
        warehouses?: Array<{ id_wh: number; nm_gudang: string }>;
        devicesCount?: number;
        error?: string;
      }>("/warehouse/wh7/test-connection", payload);

      const whList = Array.isArray(res?.warehouses) ? res.warehouses : [];
      const uniqWh = new Map<number, string>();
      for (const w of whList) {
        if (w?.id_wh !== undefined) {
          uniqWh.set(Number(w.id_wh), String(w.nm_gudang || `WH-${w.id_wh}`));
        }
      }
      const normalizedList = Array.from(uniqWh.entries()).map(([id_wh, nm_gudang]) => ({ id_wh, nm_gudang }));
      setDiscoveredWarehouses(normalizedList);

      const g7 = normalizedList.find((w) => /7|gudang\s*7|wh[\s-]*7/i.test(w.nm_gudang));
      if (g7 && !idWh) {
        setIdWh(String(g7.id_wh));
        setNmGudang(g7.nm_gudang);
      }

      setStatusMsg({
        type: "ok",
        text: `Koneksi berhasil! Terdeteksi ${normalizedList.length} gudang dan ${res?.devicesCount ?? 0} device aktif.`
      });
    } catch (err: any) {
      setStatusMsg({
        type: "err",
        text: err?.message || "Gagal menguji koneksi API Warehouse."
      });
    } finally {
      setTesting(false);
    }
  };

  if (loading) {
    return (
      <div className="rounded-xl border border-[#acd3ff] dark:border-slate-800 bg-white dark:bg-slate-950 p-6 text-xs text-slate-500">
        Memuat konfigurasi Warehouse 7...
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-[#acd3ff] dark:border-slate-800 bg-white dark:bg-slate-950 p-6 shadow-sm space-y-5">
        <div>
          <h2 className="text-base font-extrabold text-slate-800 dark:text-slate-100">
            Konfigurasi Warehouse 7 (WH-7)
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Atur batas threshold suhu alarm/dubbing (default 24°C – 30°C) dan kredensial integrasi API Gudang (<span className="font-mono">172.16.4.122:8002</span>).
          </p>
        </div>

        {statusMsg && (
          <div
            className={`rounded-lg border px-4 py-2.5 text-xs font-semibold ${
              statusMsg.type === "ok"
                ? "bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300"
                : "bg-rose-50 dark:bg-rose-950/40 border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300"
            }`}
          >
            {statusMsg.text}
          </div>
        )}

        <form onSubmit={handleSave} className="space-y-5">
          {/* Threshold Temperature Limits */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-4 rounded-xl bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800">
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-200 mb-1">
                Min Temperature Threshold (°C)
              </label>
              <input
                type="number"
                step="0.1"
                value={minTemp}
                onChange={(e) => setMinTemp(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-sm font-mono font-bold text-blue-600 dark:text-blue-400"
                required
              />
              <span className="text-[11px] text-slate-400">Default: 24°C. Alarm berbunyi jika suhu &lt; Min.</span>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-200 mb-1">
                Max Temperature Threshold (°C)
              </label>
              <input
                type="number"
                step="0.1"
                value={maxTemp}
                onChange={(e) => setMaxTemp(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-sm font-mono font-bold text-rose-600 dark:text-rose-400"
                required
              />
              <span className="text-[11px] text-slate-400">Default: 30°C. Alarm berbunyi jika suhu &gt; Max.</span>
            </div>
          </div>

          {/* API Connection Configuration */}
          <div className="space-y-4 p-4 rounded-xl border border-slate-200 dark:border-slate-800">
            <div className="text-xs font-extrabold uppercase tracking-wider text-slate-600 dark:text-slate-300">
              Integrasi API Gudang (Real-time 1 detik & Database Per Jam)
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-200 mb-1">
                  API Base URL
                </label>
                <input
                  type="text"
                  value={baseUrl}
                  onChange={(e) => setBaseUrl(e.target.value)}
                  placeholder="http://172.16.4.122:8002"
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-xs font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-200 mb-1">
                  Mode Autentikasi API
                </label>
                <select
                  value={authMode}
                  onChange={(e) => setAuthMode(e.target.value as "api_key" | "login")}
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-xs font-semibold"
                >
                  <option value="login">Login Akun Gudang (/api/auth/login)</option>
                  <option value="api_key">External API Key (Header X-Api-Key)</option>
                </select>
                <span className="mt-1 block text-[11px] text-slate-400">
                  Akun operator gudang (mis. <span className="font-mono">gudang7</span>) gunakan mode <span className="font-semibold">Login Akun Gudang</span>.
                </span>
              </div>
            </div>

            {authMode === "api_key" ? (
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-200 mb-1">
                  X-Api-Key {hasStoredApiKey && <span className="text-emerald-600 font-normal">(Tersimpan: {maskedKey})</span>}
                </label>
                <input
                  type="password"
                  value={apiKeyInput}
                  onChange={(e) => setApiKeyInput(e.target.value)}
                  placeholder={hasStoredApiKey ? "Biarkan kosong jika tidak ingin mengganti API Key" : "Tempel API Key dari http://172.16.4.122:8002/api-management"}
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-xs font-mono"
                />
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-200 mb-1">
                    Username Akun Gudang
                  </label>
                  <input
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="gudang7"
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-xs"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-200 mb-1">
                    Password {hasStoredPassword && <span className="text-emerald-600 font-normal">(Tersimpan)</span>}
                  </label>
                  <input
                    type="password"
                    value={passwordInput}
                    onChange={(e) => setPasswordInput(e.target.value)}
                    placeholder={hasStoredPassword ? "Biarkan kosong untuk tetap memakai password lama" : "Password akun gudang"}
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-xs"
                  />
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-200 mb-1">
                  ID Gudang (`id_wh` di API)
                </label>
                <input
                  type="number"
                  value={idWh}
                  onChange={(e) => setIdWh(e.target.value)}
                  placeholder="Contoh: 1 (atau klik Tes Koneksi untuk deteksi otomatis)"
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-xs font-mono"
                />
                <span className="mt-1 block text-[11px] text-slate-400">
                  Untuk login operator <span className="font-mono">gudang7</span> bernilai <span className="font-mono">1</span> (kompartemen F2702987/F2745154 termuat otomatis).
                </span>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-200 mb-1">
                  Nama Gudang (`nm_gudang`)
                </label>
                <input
                  type="text"
                  value={nmGudang}
                  onChange={(e) => setNmGudang(e.target.value)}
                  placeholder="Gudang 7"
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-xs"
                />
              </div>
            </div>

            {discoveredWarehouses.length > 0 && (
              <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-2">
                <div className="text-[11px] font-bold text-slate-600 dark:text-slate-300">
                  Klik salah satu Gudang yang terdeteksi dari API untuk mengisi otomatis:
                </div>
                <div className="flex flex-wrap gap-2">
                  {discoveredWarehouses.map((w) => (
                    <button
                      key={`${w.id_wh}_${w.nm_gudang}`}
                      type="button"
                      onClick={() => {
                        setIdWh(String(w.id_wh));
                        setNmGudang(w.nm_gudang);
                      }}
                      className="px-2.5 py-1 rounded border border-teal-300 dark:border-teal-800 bg-teal-50 dark:bg-teal-950/40 text-teal-700 dark:text-teal-300 text-xs font-semibold hover:bg-teal-100"
                    >
                      id_wh={w.id_wh} · {w.nm_gudang}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={handleTestConnection}
              disabled={testing}
              className="px-4 py-2 rounded-lg border border-sky-300 dark:border-sky-800 bg-sky-50 dark:bg-sky-950/40 text-sky-700 dark:text-sky-300 text-xs font-bold hover:bg-sky-100 transition disabled:opacity-60"
            >
              {testing ? "Menguji Koneksi..." : "Tes Koneksi & Cek ID Gudang"}
            </button>

            <button
              type="submit"
              disabled={saving}
              className="px-5 py-2 rounded-lg bg-teal-600 hover:bg-teal-700 text-white text-xs font-bold transition shadow-sm disabled:opacity-60"
            >
              {saving ? "Menyimpan..." : "Simpan Konfigurasi"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
