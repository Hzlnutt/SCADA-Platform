import { useEffect, useState } from "react";
import { getJson, postJson, putJson } from "../../services/api.client";
import { useAuthStore } from "../../store/auth.store";
import { useTranslation } from "../../i18n/useTranslation";
import { canEditWarehouse7Config } from "../../utils/roles";
import { testWarehouseAlarmVoice } from "../../utils/warehouseAlarmAudio";

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
  const { t, language } = useTranslation();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [statusMsg, setStatusMsg] = useState<{ type: "ok" | "err"; text: string } | null>(null);
  const [alarmToast, setAlarmToast] = useState<{ title: string; message: string } | null>(null);
  const [discoveredWarehouses, setDiscoveredWarehouses] = useState<Array<{ id_wh: number; nm_gudang: string }>>([]);

  const [baseUrl, setBaseUrl] = useState("http://172.16.4.122:8002");
  const [authMode, setAuthMode] = useState<"api_key" | "login">("login");
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

  useEffect(() => {
    if (!alarmToast) return;
    const tId = setTimeout(() => setAlarmToast(null), 10000);
    return () => clearTimeout(tId);
  }, [alarmToast]);

  if (!canEdit) {
    return (
      <div className="rounded-xl border border-[#acd3ff] dark:border-slate-800 bg-white dark:bg-slate-950 p-8 text-center shadow-sm">
        <div className="text-3xl mb-2">🔒</div>
        <h3 className="font-bold text-[#002b5c] dark:text-slate-100 text-lg mb-1">
          {t("warehouse7.restrictedTitle", "Akses Konfigurasi Dibatasi")}
        </h3>
        <p className="max-w-lg mx-auto text-sm text-[#47729f] dark:text-slate-400">
          {t(
            "warehouse7.restrictedDesc",
            "Pengaturan Warehouse 7 hanya dapat diakses oleh Unit Head HVAC, Senior Unit Head, Unit Head Utility, dan Admin."
          )}
        </p>
      </div>
    );
  }

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsedMin = Number(minTemp);
    const parsedMax = Number(maxTemp);
    if (!Number.isFinite(parsedMin) || !Number.isFinite(parsedMax) || parsedMin >= parsedMax) {
      setStatusMsg({
        type: "err",
        text:
          language === "en"
            ? "Min Temp must be valid and lower than Max Temp."
            : "Min Temp harus angka valid dan lebih kecil dari Max Temp."
      });
      return;
    }

    setSaving(true);
    setStatusMsg(null);
    try {
      const payload = {
        baseUrl: baseUrl.trim(),
        authMode,
        apiKey: apiKeyInput.trim() ? apiKeyInput.trim() : hasStoredApiKey ? "__KEEP__" : "",
        username: username.trim(),
        password: passwordInput ? passwordInput : hasStoredPassword ? "__KEEP__" : "",
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
      setStatusMsg({
        type: "ok",
        text:
          language === "en"
            ? "Warehouse 7 configuration saved successfully."
            : res?.message || "Konfigurasi Warehouse 7 berhasil disimpan."
      });
    } catch (err: any) {
      setStatusMsg({
        type: "err",
        text:
          err?.message ||
          (language === "en" ? "Failed to save configuration." : "Gagal menyimpan konfigurasi.")
      });
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
        apiKey: apiKeyInput.trim() ? apiKeyInput.trim() : hasStoredApiKey ? "__KEEP__" : "",
        username: username.trim(),
        password: passwordInput ? passwordInput : hasStoredPassword ? "__KEEP__" : ""
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
        text:
          language === "en"
            ? `Connected! Detected ${normalizedList.length} warehouse(s) and ${res?.devicesCount ?? 0} device(s).`
            : `Koneksi berhasil! Terdeteksi ${normalizedList.length} gudang dan ${res?.devicesCount ?? 0} device aktif.`
      });
    } catch (err: any) {
      setStatusMsg({
        type: "err",
        text:
          err?.message ||
          (language === "en" ? "Failed to test Warehouse API." : "Gagal menguji koneksi API Warehouse.")
      });
    } finally {
      setTesting(false);
    }
  };

  const handleTestAlarm = async () => {
    const parsedMax = Number(maxTemp);
    const sampleMax = Number.isFinite(parsedMax) ? parsedMax : 30;
    const res = await testWarehouseAlarmVoice(sampleMax, language);
    setAlarmToast({ title: res.title, message: res.message });
  };

  if (loading) {
    return (
      <div className="rounded-xl border border-[#acd3ff] dark:border-slate-800 bg-white dark:bg-slate-950 p-6 text-sm font-semibold text-[#47729f] dark:text-slate-400">
        {t("common.loading", "Memuat...")}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Floating Test Alarm Notification Toast */}
      {alarmToast && (
        <div className="fixed bottom-6 right-6 z-50 max-w-md rounded-xl border-2 border-rose-500 bg-white dark:bg-slate-900 p-4 shadow-2xl flex items-start gap-3">
          <div className="w-8 h-8 rounded-lg bg-rose-500/15 text-rose-600 dark:text-rose-400 flex items-center justify-center shrink-0 text-lg font-extrabold">
            !
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-sm font-extrabold text-rose-600 dark:text-rose-400">
              {alarmToast.title}
            </div>
            <div className="mt-0.5 text-sm font-medium text-[#002b5c] dark:text-slate-200">
              {alarmToast.message}
            </div>
          </div>
          <button
            type="button"
            onClick={() => setAlarmToast(null)}
            className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 text-sm font-bold px-1 cursor-pointer"
            aria-label="Close notification"
          >
            ✕
          </button>
        </div>
      )}

      <div className="rounded-xl border border-[#acd3ff] dark:border-slate-800 bg-white dark:bg-slate-950 p-6 shadow-sm space-y-5 transition-colors duration-300">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#acd3ff]/40 dark:border-slate-800 pb-3">
          <h2 className="text-lg font-extrabold text-[#002b5c] dark:text-slate-100">
            {t("warehouse7.configTitle", "Konfigurasi Warehouse 7")}
          </h2>

          <button
            type="button"
            onClick={handleTestAlarm}
            className="px-4 py-2 rounded-lg border border-rose-300 dark:border-rose-800 bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 text-sm font-bold hover:bg-rose-100 dark:hover:bg-rose-900/50 transition cursor-pointer"
          >
            ▶ {t("warehouse7.testAlarmBtn", "Tes Alarm")}
          </button>
        </div>

        {statusMsg && (
          <div
            className={`rounded-lg border px-4 py-3 text-sm font-semibold ${
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
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-4 rounded-xl bg-[#f7fbff] dark:bg-slate-900/50 border border-[#acd3ff]/70 dark:border-slate-800">
            <div>
              <label className="block text-sm font-bold text-[#002b5c] dark:text-slate-200 mb-1.5">
                {t("warehouse7.minThresholdLabel", "Batas Suhu Minimum (°C)")}
              </label>
              <input
                type="number"
                step="0.1"
                value={minTemp}
                onChange={(e) => setMinTemp(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-lg border border-[#acd3ff] dark:border-slate-700 bg-white dark:bg-slate-950 text-base font-mono font-bold text-[#1f6fb5] dark:text-sky-400 focus:outline-none focus:ring-2 focus:ring-[#1f6fb5]"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-bold text-[#002b5c] dark:text-slate-200 mb-1.5">
                {t("warehouse7.maxThresholdLabel", "Batas Suhu Maksimum (°C)")}
              </label>
              <input
                type="number"
                step="0.1"
                value={maxTemp}
                onChange={(e) => setMaxTemp(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-lg border border-[#acd3ff] dark:border-slate-700 bg-white dark:bg-slate-950 text-base font-mono font-bold text-rose-600 dark:text-rose-400 focus:outline-none focus:ring-2 focus:ring-[#1f6fb5]"
                required
              />
            </div>
          </div>

          {/* API Connection Configuration */}
          <div className="space-y-4 p-5 rounded-xl border border-[#acd3ff]/70 dark:border-slate-800">
            <div className="text-xs font-extrabold uppercase tracking-wider text-[#47729f] dark:text-slate-300">
              {t("warehouse7.apiSectionTitle", "Integrasi API Gudang")}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-bold text-[#002b5c] dark:text-slate-200 mb-1.5">
                  {t("warehouse7.baseUrlLabel", "API Base URL")}
                </label>
                <input
                  type="text"
                  value={baseUrl}
                  onChange={(e) => setBaseUrl(e.target.value)}
                  placeholder="http://172.16.4.122:8002"
                  className="w-full px-3.5 py-2 rounded-lg border border-[#acd3ff] dark:border-slate-700 bg-white dark:bg-slate-950 text-sm font-mono text-[#002b5c] dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-[#1f6fb5]"
                />
              </div>

              <div>
                <label className="block text-sm font-bold text-[#002b5c] dark:text-slate-200 mb-1.5">
                  {t("warehouse7.authModeLabel", "Mode Autentikasi API")}
                </label>
                <select
                  value={authMode}
                  onChange={(e) => setAuthMode(e.target.value as "api_key" | "login")}
                  className="w-full px-3.5 py-2 rounded-lg border border-[#acd3ff] dark:border-slate-700 bg-white dark:bg-slate-950 text-sm font-semibold text-[#002b5c] dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-[#1f6fb5]"
                >
                  <option value="login">{t("warehouse7.authLoginOption", "Login Akun Gudang (/api/auth/login)")}</option>
                  <option value="api_key">{t("warehouse7.authApiKeyOption", "External API Key (Header X-Api-Key)")}</option>
                </select>
                <span className="mt-1 block text-xs text-[#47729f] dark:text-slate-400">
                  {t("warehouse7.authHintLogin", "Gunakan username & password operator (mis. gudang7).")}
                </span>
              </div>
            </div>

            {authMode === "api_key" ? (
              <div>
                <label className="block text-sm font-bold text-[#002b5c] dark:text-slate-200 mb-1.5">
                  {t("warehouse7.apiKeyLabel", "X-Api-Key")}{" "}
                  {hasStoredApiKey && (
                    <span className="text-emerald-600 dark:text-emerald-400 font-normal">
                      ({t("warehouse7.savedBadge", "Tersimpan")}: {maskedKey})
                    </span>
                  )}
                </label>
                <input
                  type="password"
                  value={apiKeyInput}
                  onChange={(e) => setApiKeyInput(e.target.value)}
                  placeholder="X-Api-Key"
                  className="w-full px-3.5 py-2 rounded-lg border border-[#acd3ff] dark:border-slate-700 bg-white dark:bg-slate-950 text-sm font-mono text-[#002b5c] dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-[#1f6fb5]"
                />
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-bold text-[#002b5c] dark:text-slate-200 mb-1.5">
                    {t("warehouse7.usernameLabel", "Username")}
                  </label>
                  <input
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="gudang7"
                    className="w-full px-3.5 py-2 rounded-lg border border-[#acd3ff] dark:border-slate-700 bg-white dark:bg-slate-950 text-sm text-[#002b5c] dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-[#1f6fb5]"
                  />
                </div>
                <div>
                  <label className="block text-sm font-bold text-[#002b5c] dark:text-slate-200 mb-1.5">
                    {t("warehouse7.passwordLabel", "Password")}{" "}
                    {hasStoredPassword && (
                      <span className="text-emerald-600 dark:text-emerald-400 font-normal">
                        ({t("warehouse7.savedBadge", "Tersimpan")})
                      </span>
                    )}
                  </label>
                  <input
                    type="password"
                    value={passwordInput}
                    onChange={(e) => setPasswordInput(e.target.value)}
                    placeholder={hasStoredPassword ? "••••••••" : "Password"}
                    className="w-full px-3.5 py-2 rounded-lg border border-[#acd3ff] dark:border-slate-700 bg-white dark:bg-slate-950 text-sm text-[#002b5c] dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-[#1f6fb5]"
                  />
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-bold text-[#002b5c] dark:text-slate-200 mb-1.5">
                  {t("warehouse7.idWhLabel", "ID Gudang (id_wh)")}
                </label>
                <input
                  type="number"
                  value={idWh}
                  onChange={(e) => setIdWh(e.target.value)}
                  placeholder="1"
                  className="w-full px-3.5 py-2 rounded-lg border border-[#acd3ff] dark:border-slate-700 bg-white dark:bg-slate-950 text-sm font-mono text-[#002b5c] dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-[#1f6fb5]"
                />
                <span className="mt-1 block text-xs text-[#47729f] dark:text-slate-400">
                  {t("warehouse7.idWhHint", "Login operator gudang7 bernilai 1.")}
                </span>
              </div>

              <div>
                <label className="block text-sm font-bold text-[#002b5c] dark:text-slate-200 mb-1.5">
                  {t("warehouse7.nmGudangLabel", "Nama Gudang (nm_gudang)")}
                </label>
                <input
                  type="text"
                  value={nmGudang}
                  onChange={(e) => setNmGudang(e.target.value)}
                  placeholder="Gudang 7"
                  className="w-full px-3.5 py-2 rounded-lg border border-[#acd3ff] dark:border-slate-700 bg-white dark:bg-slate-950 text-sm text-[#002b5c] dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-[#1f6fb5]"
                />
              </div>
            </div>

            {discoveredWarehouses.length > 0 && (
              <div className="flex flex-wrap gap-2 pt-1">
                {discoveredWarehouses.map((w) => (
                  <button
                    key={`${w.id_wh}_${w.nm_gudang}`}
                    type="button"
                    onClick={() => {
                      setIdWh(String(w.id_wh));
                      setNmGudang(w.nm_gudang);
                    }}
                    className="px-3 py-1.5 rounded-lg border border-[#acd3ff] dark:border-sky-800 bg-[#e8f3ff] dark:bg-sky-950/40 text-[#1f6fb5] dark:text-sky-300 text-xs font-bold hover:bg-[#d8ebff] transition cursor-pointer"
                  >
                    id_wh={w.id_wh} · {w.nm_gudang}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={handleTestConnection}
              disabled={testing}
              className="px-4 py-2.5 rounded-lg border border-[#acd3ff] dark:border-sky-800 bg-[#e8f3ff] dark:bg-sky-950/40 text-[#1f6fb5] dark:text-sky-300 text-sm font-bold hover:bg-[#d8ebff] transition disabled:opacity-60 cursor-pointer"
            >
              {testing
                ? t("warehouse7.testingConnBtn", "Menguji...")
                : t("warehouse7.testConnBtn", "Tes Koneksi")}
            </button>

            <button
              type="submit"
              disabled={saving}
              className="px-5 py-2.5 rounded-lg bg-[#1f6fb5] hover:bg-[#195a94] text-white text-sm font-bold transition shadow-sm disabled:opacity-60 cursor-pointer"
            >
              {saving
                ? t("warehouse7.savingBtn", "Menyimpan...")
                : t("warehouse7.saveBtn", "Simpan Konfigurasi")}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
