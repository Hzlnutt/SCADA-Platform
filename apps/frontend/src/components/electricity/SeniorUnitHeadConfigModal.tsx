import React, { useState, useMemo } from "react";
import { createPortal } from "react-dom";
import { postJson, deleteJson } from "../../services/api.client";

export interface ConsumptionFactCategory {
  id: number;
  config_type: string; // "consumption_fact_1" | "consumption_fact_2"
  config_key: string;
  label: string;
  value: {
    endpoint_url?: string;
    json_key?: string;
    department?: "Utility" | "HVAC" | "Other";
    subArea?: string;
    kWh?: number;
  };
  sort_order: number;
  enabled: boolean;
}

interface Props {
  isOpen: boolean;
  onClose: () => void;
  isDark: boolean;
  fact1Items: ConsumptionFactCategory[];
  fact2Items: ConsumptionFactCategory[];
  onRefresh: () => void;
  initialFact?: "consumption_fact_1" | "consumption_fact_2";
  initialDept?: "all" | "Utility" | "HVAC" | "Other";
}

const COMMON_SUBAREAS: Record<string, string[]> = {
  Utility: ["Boiler", "Compressors", "Cooling Towers", "Water / WTP", "Electrical Substation", "Generators"],
  HVAC: ["Chillers", "AHUs", "AC Split / FCU", "Cleanroom HVAC", "Exhaust / Ventilation"],
  Other: ["Production Lines", "Packaging", "QC Laboratory", "Warehouse", "Others"]
};

export const SeniorUnitHeadConfigModal: React.FC<Props> = ({
  isOpen,
  onClose,
  fact1Items,
  fact2Items,
  onRefresh,
  initialFact = "consumption_fact_1",
  initialDept = "all"
}) => {
  const [activeFact, setActiveFact] = useState<"consumption_fact_1" | "consumption_fact_2">(initialFact);
  const [deptFilter, setDeptFilter] = useState<"all" | "Utility" | "HVAC" | "Other">(initialDept);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<ConsumptionFactCategory | null>(null);

  // Form states
  const [formLabel, setFormLabel] = useState("");
  const [formFact, setFormFact] = useState<"consumption_fact_1" | "consumption_fact_2">(initialFact);
  const [formDept, setFormDept] = useState<"Utility" | "HVAC" | "Other">("Utility");
  const [formSubArea, setFormSubArea] = useState("");
  const [formEndpoint, setFormEndpoint] = useState("");
  const [formJsonKey, setFormJsonKey] = useState("");
  const [formKwh, setFormKwh] = useState<number | string>(0);
  const [formEnabled, setFormEnabled] = useState(true);

  // Test API state
  const [isTestingApi, setIsTestingApi] = useState(false);
  const [testResult, setTestResult] = useState<{
    success: boolean;
    message: string;
    value?: any;
    availableKeys?: string[];
  } | null>(null);

  // Loading & notification states
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [actionMessage, setActionMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Reset or initialize form when opening
  const handleOpenAdd = () => {
    setEditingItem(null);
    setFormLabel("");
    setFormFact(activeFact);
    setFormDept(deptFilter === "all" ? "Utility" : deptFilter);
    setFormSubArea(COMMON_SUBAREAS[deptFilter === "all" ? "Utility" : deptFilter]?.[0] || "");
    setFormEndpoint("");
    setFormJsonKey("");
    setFormKwh(0);
    setFormEnabled(true);
    setTestResult(null);
    setIsFormOpen(true);
  };

  const handleOpenEdit = (item: ConsumptionFactCategory) => {
    setEditingItem(item);
    setFormLabel(item.label || "");
    setFormFact(item.config_type as any || "consumption_fact_1");
    setFormDept(item.value?.department || "Utility");
    setFormSubArea(item.value?.subArea || "");
    setFormEndpoint(item.value?.endpoint_url || "");
    setFormJsonKey(item.value?.json_key || "");
    setFormKwh(item.value?.kWh ?? 0);
    setFormEnabled(item.enabled !== false);
    setTestResult(null);
    setIsFormOpen(true);
  };

  // Test API endpoint
  const handleTestApi = async () => {
    if (!formEndpoint.trim()) {
      setTestResult({ success: false, message: "Masukkan Endpoint URL terlebih dahulu." });
      return;
    }
    setIsTestingApi(true);
    setTestResult(null);

    try {
      const res = await postJson<{ success: boolean; data?: any; message?: string }>("/config/api-sources/test", {
        url: formEndpoint.trim(),
        method: "GET"
      });

      if (res && res.success && res.data) {
        const payload = res.data;
        const available = Object.keys(payload);

        if (formJsonKey.trim()) {
          const rawVal = payload[formJsonKey.trim()];
          if (rawVal !== undefined) {
            setTestResult({
              success: true,
              message: `Endpoint terhubung! Nilai tag '${formJsonKey.trim()}': ${rawVal}`,
              value: rawVal
            });
            if (typeof rawVal === "number" || (!isNaN(Number(rawVal)) && rawVal !== "")) {
              setFormKwh(Number(rawVal));
            }
          } else {
            setTestResult({
              success: false,
              message: `Endpoint terhubung, namun key '${formJsonKey.trim()}' tidak ada di respon JSON.`,
              availableKeys: available.slice(0, 10)
            });
          }
        } else {
          setTestResult({
            success: true,
            message: `Endpoint berhasil diakses. Silakan pilih salah satu JSON Key di bawah.`,
            availableKeys: available.slice(0, 10)
          });
        }
      } else {
        setTestResult({
          success: false,
          message: res?.message || "Gagal mendapatkan data dari endpoint."
        });
      }
    } catch (err: any) {
      setTestResult({
        success: false,
        message: err?.message || "Koneksi ke endpoint gagal atau timeout."
      });
    } finally {
      setIsTestingApi(false);
    }
  };

  // Save / Update item
  const handleSaveItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formLabel.trim()) {
      setActionMessage({ type: "error", text: "Nama / Label Item tidak boleh kosong." });
      return;
    }

    setIsSubmitting(true);
    setActionMessage(null);

    try {
      const configKey = editingItem?.config_key ||
        (formLabel.toLowerCase().trim().replace(/[^a-z0-9]+/g, "_") + "_" + Math.random().toString(36).substring(2, 6));

      const payload = {
        config_type: formFact,
        config_key: configKey,
        label: formLabel.trim(),
        value: {
          endpoint_url: formEndpoint.trim(),
          json_key: formJsonKey.trim(),
          department: formDept,
          subArea: formSubArea.trim() || undefined,
          kWh: Number(formKwh) || 0
        },
        sort_order: editingItem?.sort_order ?? 0,
        enabled: formEnabled
      };

      const res = await postJson<{ data: any }>("/config/electricity", payload);
      if (res) {
        setActionMessage({ type: "success", text: `Item '${formLabel}' berhasil disimpan!` });
        setIsFormOpen(false);
        onRefresh();
      }
    } catch (err: any) {
      setActionMessage({ type: "error", text: err?.message || "Gagal menyimpan item konfigurasi." });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Delete item
  const handleDeleteItem = async (item: ConsumptionFactCategory) => {
    if (!window.confirm(`Hapus item '${item.label}' dari konfigurasi ${item.config_type === "consumption_fact_1" ? "Fact 1" : "Fact 2"}?`)) {
      return;
    }

    try {
      await deleteJson(`/config/electricity/${item.id}`);
      setActionMessage({ type: "success", text: `Item '${item.label}' berhasil dihapus.` });
      onRefresh();
    } catch (err: any) {
      setActionMessage({ type: "error", text: err?.message || "Gagal menghapus item." });
    }
  };

  // Quick toggle enabled
  const handleToggleEnabled = async (item: ConsumptionFactCategory) => {
    try {
      await postJson("/config/electricity", {
        ...item,
        enabled: !item.enabled
      });
      onRefresh();
    } catch (err: any) {
      setActionMessage({ type: "error", text: err?.message || "Gagal mengubah status item." });
    }
  };

  // Current filtered items
  const currentItems = useMemo(() => {
    const source = activeFact === "consumption_fact_1" ? fact1Items : fact2Items;
    if (deptFilter === "all") return source;
    return source.filter((item) => {
      const dept = item.value?.department || "Other";
      return dept === deptFilter;
    });
  }, [activeFact, fact1Items, fact2Items, deptFilter]);

  if (!isOpen) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 overflow-y-auto"
      onClick={onClose}
    >
      <div
        className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl w-full max-w-4xl p-6 space-y-5 my-auto max-h-[92vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-4">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-sky-500/10 text-sky-500 flex items-center justify-center font-bold text-lg">
              ⚙️
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-slate-800 dark:text-white">
                  Kelola Item Sub-Metering & Konsumsi
                </h3>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase bg-amber-500/10 text-amber-500 border border-amber-500/20">
                  Senior Unit Head Only
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Konfigurasi daftar item, nama label, dan endpoint API untuk Fact 1, Fact 2, Utility, dan HVAC.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="h-8 w-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800 text-lg font-bold transition"
          >
            ✕
          </button>
        </div>

        {/* Action alert */}
        {actionMessage && (
          <div
            className={`px-4 py-2.5 rounded-xl text-xs font-semibold flex items-center justify-between ${
              actionMessage.type === "success"
                ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20"
                : "bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20"
            }`}
          >
            <span>{actionMessage.text}</span>
            <button onClick={() => setActionMessage(null)} className="ml-2 font-bold opacity-60 hover:opacity-100">
              ✕
            </button>
          </div>
        )}

        {/* Top Controls: Fact Switcher & Department Filter */}
        <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-50 dark:bg-slate-950/40 p-3 rounded-xl border border-slate-100 dark:border-slate-800">
          {/* Fact Selector Tabs */}
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => {
                setActiveFact("consumption_fact_1");
                setIsFormOpen(false);
              }}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-2 ${
                activeFact === "consumption_fact_1"
                  ? "bg-[#1f6fb5] text-white shadow-sm"
                  : "text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-800"
              }`}
            >
              <span>Biggest Consumption Fact 1</span>
              <span className={`px-1.5 py-0.2 rounded-full text-[10px] ${activeFact === "consumption_fact_1" ? "bg-white/20 text-white" : "bg-slate-200 dark:bg-slate-700"}`}>
                {fact1Items.length}
              </span>
            </button>
            <button
              onClick={() => {
                setActiveFact("consumption_fact_2");
                setIsFormOpen(false);
              }}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-2 ${
                activeFact === "consumption_fact_2"
                  ? "bg-[#06b6d4] text-white shadow-sm"
                  : "text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-800"
              }`}
            >
              <span>Biggest Consumption Fact 2</span>
              <span className={`px-1.5 py-0.2 rounded-full text-[10px] ${activeFact === "consumption_fact_2" ? "bg-white/20 text-white" : "bg-slate-200 dark:bg-slate-700"}`}>
                {fact2Items.length}
              </span>
            </button>
          </div>

          {/* Department Filter & Add Item Button */}
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1 bg-white dark:bg-slate-900 px-2 py-1 rounded-lg border border-slate-200 dark:border-slate-700 text-xs">
              <span className="text-[10px] font-bold uppercase text-slate-400 mr-1">Dept:</span>
              {(["all", "Utility", "HVAC", "Other"] as const).map((d) => (
                <button
                  key={d}
                  onClick={() => setDeptFilter(d)}
                  className={`px-2 py-0.5 rounded text-[11px] font-semibold transition ${
                    deptFilter === d
                      ? "bg-slate-800 text-white dark:bg-slate-200 dark:text-slate-900"
                      : "text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
                  }`}
                >
                  {d === "all" ? "Semua" : d}
                </button>
              ))}
            </div>

            {!isFormOpen && (
              <button
                onClick={handleOpenAdd}
                className="px-3 py-1.5 rounded-lg text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white shadow-sm transition flex items-center gap-1.5"
              >
                <span>➕</span>
                <span>Tambah Item</span>
              </button>
            )}
          </div>
        </div>

        {/* Inline Add / Edit Form */}
        {isFormOpen && (
          <form
            onSubmit={handleSaveItem}
            className="p-5 rounded-xl border border-sky-500/30 bg-sky-500/5 dark:bg-sky-950/20 space-y-4 animate-fadeIn"
          >
            <div className="flex items-center justify-between border-b border-sky-500/20 pb-2">
              <h4 className="text-xs font-bold uppercase tracking-wider text-sky-600 dark:text-sky-400 flex items-center gap-1.5">
                <span>{editingItem ? "✏️ Edit Item Konfigurasi" : "➕ Tambah Item Baru"}</span>
              </h4>
              <button
                type="button"
                onClick={() => setIsFormOpen(false)}
                className="text-xs text-slate-400 hover:text-slate-600 font-bold"
              >
                ✕ Batal
              </button>
            </div>

            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {/* Target Fact */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Target Factory *
                </label>
                <select
                  value={formFact}
                  onChange={(e) => setFormFact(e.target.value as any)}
                  className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-white font-semibold focus:ring-2 focus:ring-sky-500 outline-none"
                >
                  <option value="consumption_fact_1">Fact 1 (Utility & Production)</option>
                  <option value="consumption_fact_2">Fact 2 (Utility & HVAC)</option>
                </select>
              </div>

              {/* Label / Item Name */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Nama / Label Item *
                </label>
                <input
                  type="text"
                  required
                  placeholder="Contoh: Chiller Daikin 1 / Boiler 3"
                  value={formLabel}
                  onChange={(e) => setFormLabel(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-white font-semibold focus:ring-2 focus:ring-sky-500 outline-none"
                />
              </div>

              {/* Department */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Departemen *
                </label>
                <select
                  value={formDept}
                  onChange={(e) => {
                    const d = e.target.value as any;
                    setFormDept(d);
                    if (!formSubArea || COMMON_SUBAREAS[formDept]?.includes(formSubArea)) {
                      setFormSubArea(COMMON_SUBAREAS[d][0] || "");
                    }
                  }}
                  className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-white font-semibold focus:ring-2 focus:ring-sky-500 outline-none"
                >
                  <option value="Utility">Utility</option>
                  <option value="HVAC">HVAC</option>
                  <option value="Other">Other / Production</option>
                </select>
              </div>

              {/* Sub-Area */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Sub-Area / Klasifikasi Sistem
                </label>
                <input
                  type="text"
                  list="subarea-suggestions"
                  placeholder="Contoh: Chillers, AHUs, Boiler..."
                  value={formSubArea}
                  onChange={(e) => setFormSubArea(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-white font-semibold focus:ring-2 focus:ring-sky-500 outline-none"
                />
                <datalist id="subarea-suggestions">
                  {(COMMON_SUBAREAS[formDept] || []).map((s) => (
                    <option key={s} value={s} />
                  ))}
                </datalist>
              </div>

              {/* Endpoint URL */}
              <div className="sm:col-span-2">
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Endpoint URL (Ignition Webdev API)
                </label>
                <input
                  type="url"
                  placeholder="http://10.3.164.3:8088/system/webdev/Utility_Dashboard/..."
                  value={formEndpoint}
                  onChange={(e) => setFormEndpoint(e.target.value)}
                  className="w-full px-3 py-2 text-xs font-mono rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-white focus:ring-2 focus:ring-sky-500 outline-none"
                />
              </div>

              {/* JSON Key */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  JSON Key / Metric Tag
                </label>
                <input
                  type="text"
                  placeholder="Contoh: Active_Power_Total / kWh"
                  value={formJsonKey}
                  onChange={(e) => setFormJsonKey(e.target.value)}
                  className="w-full px-3 py-2 text-xs font-mono rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-white focus:ring-2 focus:ring-sky-500 outline-none"
                />
              </div>

              {/* Fallback / Manual kWh */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Nilai Awal / Fallback kWh
                </label>
                <input
                  type="number"
                  step="any"
                  value={formKwh}
                  onChange={(e) => setFormKwh(e.target.value)}
                  className="w-full px-3 py-2 text-xs font-mono rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-white focus:ring-2 focus:ring-sky-500 outline-none"
                />
              </div>

              {/* Enabled Toggle */}
              <div className="flex items-center gap-2 pt-6">
                <input
                  type="checkbox"
                  id="form-enabled"
                  checked={formEnabled}
                  onChange={(e) => setFormEnabled(e.target.checked)}
                  className="h-4 w-4 rounded text-sky-600 focus:ring-sky-500 cursor-pointer"
                />
                <label htmlFor="form-enabled" className="text-xs font-bold text-slate-700 dark:text-slate-300 cursor-pointer">
                  Aktifkan di Dashboard & Chart
                </label>
              </div>
            </div>

            {/* Test Connection Button & Result */}
            <div className="pt-2 border-t border-sky-500/10 flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleTestApi}
                  disabled={isTestingApi || !formEndpoint.trim()}
                  className="px-3 py-1.5 rounded-lg text-xs font-bold border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 disabled:opacity-50 transition"
                >
                  {isTestingApi ? "Menguji API..." : "🔍 Test Endpoint & JSON Key"}
                </button>
                {testResult && (
                  <span
                    className={`text-xs px-2.5 py-1 rounded-lg font-mono font-bold ${
                      testResult.success
                        ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20"
                        : "bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20"
                    }`}
                  >
                    {testResult.message}
                  </span>
                )}
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setIsFormOpen(false)}
                  className="px-3 py-1.5 rounded-lg text-xs font-bold text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-4 py-1.5 rounded-lg text-xs font-bold bg-[#1f6fb5] hover:bg-[#1a5c96] text-white shadow-sm transition disabled:opacity-50"
                >
                  {isSubmitting ? "Menyimpan..." : editingItem ? "Simpan Perubahan" : "Tambahkan Item"}
                </button>
              </div>
            </div>

            {/* Available JSON Keys helper if returned */}
            {testResult?.availableKeys && (
              <div className="text-[11px] bg-slate-100 dark:bg-slate-800/80 p-2.5 rounded-lg space-y-1">
                <span className="font-semibold text-slate-600 dark:text-slate-300">Keys yang tersedia di payload:</span>
                <div className="flex flex-wrap gap-1.5">
                  {testResult.availableKeys.map((k) => (
                    <button
                      key={k}
                      type="button"
                      onClick={() => setFormJsonKey(k)}
                      className="px-1.5 py-0.5 rounded bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 text-sky-600 dark:text-sky-400 font-mono text-[10px] hover:bg-sky-50"
                    >
                      {k}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </form>
        )}

        {/* Items List Table */}
        <div className="flex-1 overflow-y-auto border border-slate-200 dark:border-slate-800 rounded-xl">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 dark:bg-slate-800/80 text-slate-500 dark:text-slate-400 font-bold uppercase tracking-wider text-[10px] border-b border-slate-200 dark:border-slate-800 sticky top-0">
              <tr>
                <th className="py-2.5 px-4 w-12 text-center">Status</th>
                <th className="py-2.5 px-4">Nama Item / Label</th>
                <th className="py-2.5 px-4">Departemen & Sub-Area</th>
                <th className="py-2.5 px-4">Endpoint & Tag Key</th>
                <th className="py-2.5 px-4 text-right">Nilai Saat Ini</th>
                <th className="py-2.5 px-4 w-28 text-center">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {currentItems.length > 0 ? (
                currentItems.map((item) => (
                  <tr
                    key={item.id || item.config_key}
                    className={`hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition ${
                      !item.enabled ? "opacity-50" : ""
                    }`}
                  >
                    {/* Toggle Active */}
                    <td className="py-3 px-4 text-center">
                      <input
                        type="checkbox"
                        checked={item.enabled !== false}
                        onChange={() => handleToggleEnabled(item)}
                        title={item.enabled ? "Klik untuk nonaktifkan" : "Klik untuk aktifkan"}
                        className="h-4 w-4 rounded text-sky-600 focus:ring-sky-500 cursor-pointer"
                      />
                    </td>

                    {/* Label */}
                    <td className="py-3 px-4">
                      <div className="font-bold text-slate-800 dark:text-white">
                        {item.label}
                      </div>
                      <div className="text-[10px] font-mono text-slate-400">
                        {item.config_key}
                      </div>
                    </td>

                    {/* Department & SubArea */}
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-1.5">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-extrabold uppercase ${
                            item.value?.department === "HVAC"
                              ? "bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 border border-cyan-500/20"
                              : item.value?.department === "Utility"
                              ? "bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20"
                              : "bg-slate-500/10 text-slate-600 dark:text-slate-400 border border-slate-500/20"
                          }`}
                        >
                          {item.value?.department || "Other"}
                        </span>
                        {item.value?.subArea && (
                          <span className="text-[11px] text-slate-500 dark:text-slate-400">
                            › {item.value.subArea}
                          </span>
                        )}
                      </div>
                    </td>

                    {/* Endpoint & Tag Key */}
                    <td className="py-3 px-4">
                      {item.value?.endpoint_url ? (
                        <div className="space-y-0.5">
                          <div className="font-mono text-[10px] text-slate-500 dark:text-slate-400 truncate max-w-[220px]" title={item.value.endpoint_url}>
                            {item.value.endpoint_url}
                          </div>
                          {item.value.json_key && (
                            <div className="font-mono text-[10px] font-bold text-sky-600 dark:text-sky-400">
                              Key: {item.value.json_key}
                            </div>
                          )}
                        </div>
                      ) : (
                        <span className="text-[10px] text-slate-400 italic">Manual / Belum ada API</span>
                      )}
                    </td>

                    {/* Live Value */}
                    <td className="py-3 px-4 text-right font-mono font-bold text-slate-800 dark:text-white">
                      {(item.value?.kWh ?? 0).toLocaleString("id-ID", { maximumFractionDigits: 2 })} <span className="text-[10px] text-slate-400 font-sans">kWh</span>
                    </td>

                    {/* Actions */}
                    <td className="py-3 px-4 text-center">
                      <div className="flex items-center justify-center gap-1.5">
                        <button
                          onClick={() => handleOpenEdit(item)}
                          className="px-2 py-1 rounded text-[11px] font-bold text-sky-600 hover:bg-sky-50 dark:hover:bg-sky-950/30 transition"
                          title="Edit Item"
                        >
                          ✏️ Edit
                        </button>
                        <button
                          onClick={() => handleDeleteItem(item)}
                          className="px-2 py-1 rounded text-[11px] font-bold text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition"
                          title="Hapus Item"
                        >
                          🗑️
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-slate-400">
                    <div className="text-xl mb-1 opacity-40">📋</div>
                    <div className="font-bold text-xs">Belum ada item terkonfigurasi</div>
                    <div className="text-[11px] mt-0.5">
                      Klik tombol &quot;➕ Tambah Item&quot; di atas untuk menambahkan item sub-metering.
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between border-t border-slate-100 dark:border-slate-800 pt-3 text-xs text-slate-400">
          <div>
            Total {currentItems.length} item ({currentItems.filter((i) => i.enabled !== false).length} aktif)
          </div>
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-bold transition"
          >
            Tutup
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
};
