import { useState, useEffect, useCallback } from "react";
import { PageHeader } from "../components/ui/PageHeader";

const STORAGE_KEY = "scada.settings";

type AppSettings = {
  theme: "system" | "light" | "dark";
  accentColor: string;
  fontFamily: string;
  fontSize: string;
  refreshInterval: number;
  compactMode: boolean;
  animations: boolean;
  alarmSounds: boolean;
  exportFormat: "xlsx" | "csv";
  dateFormat: string;
  numberLocale: string;
};

const defaults: AppSettings = {
  theme: "system",
  accentColor: "cyan",
  fontFamily: "Inter",
  fontSize: "default",
  refreshInterval: 10,
  compactMode: false,
  animations: true,
  alarmSounds: true,
  exportFormat: "xlsx",
  dateFormat: "DD/MM/YYYY",
  numberLocale: "id-ID",
};

const fontFamilies = [
  { label: "Inter", value: "Inter" },
  { label: "Roboto", value: "Roboto" },
  { label: "Outfit", value: "Outfit" },
  { label: "JetBrains Mono", value: "JetBrains Mono" },
  { label: "System Default", value: "system-ui" },
];

const fontSizes = [
  { label: "Kecil", value: "small", scale: "text-[13px]" },
  { label: "Default", value: "default", scale: "text-sm" },
  { label: "Besar", value: "large", scale: "text-base" },
  { label: "Extra Besar", value: "xlarge", scale: "text-lg" },
];

const accentColors = [
  { label: "Cyan", value: "cyan", color: "#06b6d4", ring: "ring-cyan-500" },
  { label: "Blue", value: "blue", color: "#3b82f6", ring: "ring-blue-500" },
  { label: "Emerald", value: "emerald", color: "#10b981", ring: "ring-emerald-500" },
  { label: "Violet", value: "violet", color: "#8b5cf6", ring: "ring-violet-500" },
  { label: "Rose", value: "rose", color: "#f43f5e", ring: "ring-rose-500" },
];

const refreshIntervals = [
  { label: "5 detik", value: 5 },
  { label: "10 detik", value: 10 },
  { label: "30 detik", value: 30 },
  { label: "60 detik", value: 60 },
];

const dateFormats = ["DD/MM/YYYY", "MM/DD/YYYY", "YYYY-MM-DD"];
const numberLocales = [
  { label: "Indonesia (1.234,56)", value: "id-ID" },
  { label: "English (1,234.56)", value: "en-US" },
];

const loadSettings = (): AppSettings => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return { ...defaults, ...JSON.parse(raw) };
  } catch { /* use defaults */ }
  return { ...defaults };
};

const Toggle = ({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) => (
  <button
    type="button"
    onClick={() => onChange(!checked)}
    className={`relative inline-flex h-6 w-11 shrink-0 rounded-full border-2 border-transparent transition-colors duration-200 cursor-pointer ${
      checked ? "bg-cyan-500" : "bg-slate-300 dark:bg-slate-700"
    }`}
  >
    <span className={`pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow-lg transform transition-transform duration-200 ${
      checked ? "translate-x-5" : "translate-x-0"
    }`} />
  </button>
);

const SectionCard = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-sm">
    <h3 className="text-sm font-bold uppercase tracking-[0.15em] text-slate-400 dark:text-slate-500 mb-5">{title}</h3>
    <div className="space-y-5">{children}</div>
  </div>
);

const SettingRow = ({ label, description, children }: { label: string; description?: string; children: React.ReactNode }) => (
  <div className="flex items-center justify-between gap-4">
    <div className="flex-1 min-w-0">
      <div className="text-sm font-medium text-slate-700 dark:text-slate-200">{label}</div>
      {description && <div className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">{description}</div>}
    </div>
    <div className="shrink-0">{children}</div>
  </div>
);

export default function Settings() {
  const [settings, setSettings] = useState<AppSettings>(loadSettings);

  const save = useCallback((patch: Partial<AppSettings>) => {
    setSettings(prev => {
      const next = { ...prev, ...patch };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      return next;
    });
  }, []);

  // Apply theme
  useEffect(() => {
    const html = document.documentElement;
    if (settings.theme === "dark") {
      html.classList.add("dark");
    } else if (settings.theme === "light") {
      html.classList.remove("dark");
    } else {
      // system
      const isDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
      html.classList.toggle("dark", isDark);
    }
  }, [settings.theme]);

  const resetAll = () => {
    localStorage.removeItem(STORAGE_KEY);
    setSettings({ ...defaults });
  };

  return (
    <div className="space-y-6">
      <PageHeader title="Settings" description="Konfigurasi tampilan dan preferensi aplikasi." />

      <div className="grid gap-6 xl:grid-cols-2">
        {/* APPEARANCE */}
        <SectionCard title="Tampilan">
          <SettingRow label="Tema" description="Pilih mode tampilan untuk seluruh aplikasi.">
            <div className="flex gap-1 rounded-lg border border-slate-200 dark:border-slate-700 p-0.5">
              {(["system", "light", "dark"] as const).map(t => (
                <button
                  key={t}
                  type="button"
                  onClick={() => save({ theme: t })}
                  className={`px-3 py-1.5 text-xs font-semibold rounded-md capitalize transition-all ${
                    settings.theme === t
                      ? "bg-cyan-500 text-white shadow-sm"
                      : "text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
                  }`}
                >
                  {t === "system" ? "Sistem" : t === "light" ? "Terang" : "Gelap"}
                </button>
              ))}
            </div>
          </SettingRow>

          <SettingRow label="Warna Aksen" description="Warna utama untuk tombol dan elemen interaktif.">
            <div className="flex gap-2">
              {accentColors.map(c => (
                <button
                  key={c.value}
                  type="button"
                  onClick={() => save({ accentColor: c.value })}
                  className={`h-7 w-7 rounded-full border-2 transition-all ${
                    settings.accentColor === c.value ? "border-slate-800 dark:border-white scale-110 ring-2 " + c.ring : "border-transparent"
                  }`}
                  style={{ backgroundColor: c.color }}
                  title={c.label}
                />
              ))}
            </div>
          </SettingRow>
        </SectionCard>

        {/* TYPOGRAPHY */}
        <SectionCard title="Tipografi">
          <SettingRow label="Jenis Font" description="Font yang digunakan di seluruh antarmuka.">
            <select
              value={settings.fontFamily}
              onChange={e => save({ fontFamily: e.target.value })}
              className="rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-1.5 text-sm text-slate-700 dark:text-slate-200"
            >
              {fontFamilies.map(f => (
                <option key={f.value} value={f.value}>{f.label}</option>
              ))}
            </select>
          </SettingRow>

          <SettingRow label="Ukuran Font" description="Sesuaikan ukuran teks untuk kenyamanan membaca.">
            <div className="flex gap-1 rounded-lg border border-slate-200 dark:border-slate-700 p-0.5">
              {fontSizes.map(s => (
                <button
                  key={s.value}
                  type="button"
                  onClick={() => save({ fontSize: s.value })}
                  className={`px-2.5 py-1.5 text-xs font-semibold rounded-md transition-all ${
                    settings.fontSize === s.value
                      ? "bg-cyan-500 text-white shadow-sm"
                      : "text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
                  }`}
                >
                  {s.label}
                </button>
              ))}
            </div>
          </SettingRow>

          {/* Preview */}
          <div className="rounded-xl bg-slate-50 dark:bg-slate-800/50 p-4 border border-slate-100 dark:border-slate-800">
            <div className="text-[10px] uppercase tracking-wider text-slate-400 dark:text-slate-500 mb-2">Preview</div>
            <p
              className={`text-slate-700 dark:text-slate-200 ${fontSizes.find(s => s.value === settings.fontSize)?.scale || "text-sm"}`}
              style={{ fontFamily: settings.fontFamily === "system-ui" ? "system-ui" : `'${settings.fontFamily}', sans-serif` }}
            >
              WIDATRA EMS | Industrial SCADA Dashboard — Plant Operations & Utilities
            </p>
          </div>
        </SectionCard>

        {/* DASHBOARD PREFERENCES */}
        <SectionCard title="Preferensi Dashboard">
          <SettingRow label="Refresh Interval" description="Frekuensi pembaruan data secara real-time.">
            <select
              value={settings.refreshInterval}
              onChange={e => save({ refreshInterval: Number(e.target.value) })}
              className="rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-1.5 text-sm text-slate-700 dark:text-slate-200"
            >
              {refreshIntervals.map(r => (
                <option key={r.value} value={r.value}>{r.label}</option>
              ))}
            </select>
          </SettingRow>

          <SettingRow label="Mode Kompak" description="Mengurangi padding dan jarak antar elemen.">
            <Toggle checked={settings.compactMode} onChange={v => save({ compactMode: v })} />
          </SettingRow>

          <SettingRow label="Animasi" description="Efek animasi dan transisi di antarmuka.">
            <Toggle checked={settings.animations} onChange={v => save({ animations: v })} />
          </SettingRow>
        </SectionCard>

        {/* NOTIFICATIONS */}
        <SectionCard title="Notifikasi">
          <SettingRow label="Suara Alarm" description="Putar suara saat alarm aktif dipicu.">
            <Toggle checked={settings.alarmSounds} onChange={v => save({ alarmSounds: v })} />
          </SettingRow>

          <SettingRow label="Desktop Notification" description="Izinkan notifikasi muncul di desktop.">
            <button
              type="button"
              onClick={() => {
                if ("Notification" in window) {
                  Notification.requestPermission();
                }
              }}
              className="px-3 py-1.5 text-xs font-semibold rounded-lg border border-cyan-500 text-cyan-600 dark:text-cyan-400 hover:bg-cyan-50 dark:hover:bg-cyan-950/30 transition-colors"
            >
              Minta Izin
            </button>
          </SettingRow>
        </SectionCard>

        {/* DATA & EXPORT */}
        <SectionCard title="Data & Export">
          <SettingRow label="Format Export" description="Format file default saat mengunduh laporan.">
            <div className="flex gap-1 rounded-lg border border-slate-200 dark:border-slate-700 p-0.5">
              {(["xlsx", "csv"] as const).map(fmt => (
                <button
                  key={fmt}
                  type="button"
                  onClick={() => save({ exportFormat: fmt })}
                  className={`px-3 py-1.5 text-xs font-semibold rounded-md uppercase transition-all ${
                    settings.exportFormat === fmt
                      ? "bg-cyan-500 text-white shadow-sm"
                      : "text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
                  }`}
                >
                  {fmt}
                </button>
              ))}
            </div>
          </SettingRow>

          <SettingRow label="Format Tanggal" description="Format tanggal yang ditampilkan di aplikasi.">
            <select
              value={settings.dateFormat}
              onChange={e => save({ dateFormat: e.target.value })}
              className="rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-1.5 text-sm text-slate-700 dark:text-slate-200"
            >
              {dateFormats.map(f => <option key={f} value={f}>{f}</option>)}
            </select>
          </SettingRow>

          <SettingRow label="Format Angka" description="Locale untuk pemisah ribuan dan desimal.">
            <select
              value={settings.numberLocale}
              onChange={e => save({ numberLocale: e.target.value })}
              className="rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-1.5 text-sm text-slate-700 dark:text-slate-200"
            >
              {numberLocales.map(l => (
                <option key={l.value} value={l.value}>{l.label}</option>
              ))}
            </select>
          </SettingRow>
        </SectionCard>

        {/* RESET */}
        <SectionCard title="Reset">
          <SettingRow label="Reset Semua Pengaturan" description="Kembalikan semua pengaturan ke nilai default.">
            <button
              type="button"
              onClick={resetAll}
              className="px-4 py-2 text-xs font-semibold rounded-lg bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-800 text-rose-600 dark:text-rose-400 hover:bg-rose-100 dark:hover:bg-rose-950/50 transition-colors"
            >
              Reset
            </button>
          </SettingRow>
        </SectionCard>
      </div>
    </div>
  );
}
