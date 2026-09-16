import React, { useState, useMemo, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import { getJson, postJson, deleteJson } from "../../services/api.client";

export interface ConsumptionFactCategory {
  id: number;
  config_type: string; // "consumption_fact_1" | "consumption_fact_2"
  config_key: string;
  label: string;
  value: {
    endpoint_url?: string;
    json_key?: string;
    pm_id?: string;
    is_new_pm?: boolean;
    department?: "Utility" | "HVAC" | "Other";
    subArea?: string;
    kWh?: number;
    factory?: string;
  };
  sort_order: number;
  enabled: boolean;
}

export interface AvailablePowerMeter {
  pm_id: string;
  label: string;
  endpoint_url: string;
  json_key?: string;
  group_id?: string;
  factory?: "consumption_fact_1" | "consumption_fact_2" | "all";
  department?: "Utility" | "HVAC" | "Other";
  subArea?: string;
  is_database?: boolean;
  is_new_pm?: boolean;
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
  const [searchQuery, setSearchQuery] = useState("");
  const [showAllFactories, setShowAllFactories] = useState(false);

  // Available PMs from database
  const [availablePms, setAvailablePms] = useState<AvailablePowerMeter[]>([]);
  const [isLoadingPms, setIsLoadingPms] = useState(false);

  // Add New PM form toggle & state
  const [isAddPmOpen, setIsAddPmOpen] = useState(false);
  const [newPmTargetFact, setNewPmTargetFact] = useState<"consumption_fact_1" | "consumption_fact_2">(initialFact);
  const [newPmDept, setNewPmDept] = useState<"Utility" | "HVAC" | "Other">("Utility");
  const [newPmId, setNewPmId] = useState("");
  const [newPmLabel, setNewPmLabel] = useState("");
  const [newPmEndpoint, setNewPmEndpoint] = useState("");

  // Testing new PM API
  const [isTestingApi, setIsTestingApi] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);

  // Label Edit modal state
  const [editingPm, setEditingPm] = useState<{ pm_id: string; currentLabel: string } | null>(null);
  const [editLabelInput, setEditLabelInput] = useState("");

  // Loading & notification states
  const [isProcessing, setIsProcessing] = useState(false);
  const [actionMessage, setActionMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Load available PMs from database
  const loadAvailablePms = useCallback(() => {
    setIsLoadingPms(true);
    getJson<{ data: AvailablePowerMeter[] }>("/config/electricity/available-pms")
      .then((res) => {
        if (res?.data) {
          setAvailablePms(res.data);
        }
      })
      .catch(() => {})
      .finally(() => {
        setIsLoadingPms(false);
      });
  }, []);

  useEffect(() => {
    if (isOpen) {
      loadAvailablePms();
      setActiveFact(initialFact);
      setDeptFilter(initialDept);
      setSearchQuery("");
      setIsAddPmOpen(false);
      setTestResult(null);
      setActionMessage(null);
    }
  }, [isOpen, initialFact, initialDept, loadAvailablePms]);

  // Map of currently configured items for active fact: pm_id (uppercase) -> ConsumptionFactCategory
  const activeFactItems = useMemo(() => {
    return activeFact === "consumption_fact_1" ? fact1Items : fact2Items;
  }, [activeFact, fact1Items, fact2Items]);

  const configMap = useMemo(() => {
    const map = new Map<string, ConsumptionFactCategory>();
    for (const item of activeFactItems) {
      const pmId = (item.value?.pm_id || item.value?.json_key || item.config_key).toUpperCase();
      map.set(pmId, item);
      // Also index by raw config_key
      map.set(item.config_key.toUpperCase(), item);
    }
    return map;
  }, [activeFactItems]);

  // Filter available PMs based on activeFact, dept, and search query
  const displayedPms = useMemo(() => {
    return availablePms.filter((pm) => {
      const idUpper = pm.pm_id.toUpperCase();

      // Factory filter (unless showAllFactories is checked)
      if (!showAllFactories) {
        const isAssignedToThisFact =
          pm.factory === activeFact ||
          pm.factory === "all" ||
          (!pm.factory && (activeFact === "consumption_fact_1" ? pm.group_id === "ew21" : pm.group_id === "ew22")) ||
          configMap.has(idUpper);

        if (!isAssignedToThisFact) return false;
      }

      // Department filter
      if (deptFilter !== "all" && pm.department !== deptFilter) {
        return false;
      }

      // Search query filter
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchId = pm.pm_id.toLowerCase().includes(q);
        const matchLabel = (pm.label || "").toLowerCase().includes(q);
        const matchDept = (pm.department || "").toLowerCase().includes(q);
        const matchEndpoint = (pm.endpoint_url || "").toLowerCase().includes(q);
        if (!matchId && !matchLabel && !matchDept && !matchEndpoint) return false;
      }

      return true;
    });
  }, [availablePms, activeFact, deptFilter, searchQuery, showAllFactories, configMap]);

  // Count active in activeFact
  const activeCount = useMemo(() => {
    return activeFactItems.filter((i) => i.enabled !== false).length;
  }, [activeFactItems]);

  // Toggle single PM checklist
  const handleTogglePm = async (pm: AvailablePowerMeter) => {
    const idUpper = pm.pm_id.toUpperCase();
    const existing = configMap.get(idUpper);
    const nextEnabled = existing ? !existing.enabled : true;

    // Optimistic message
    setActionMessage(null);

    try {
      await postJson("/config/electricity/toggle", {
        config_type: activeFact,
        pm_id: pm.pm_id,
        enabled: nextEnabled,
        label: existing?.label || pm.label || pm.pm_id,
        endpoint_url: pm.endpoint_url,
        department: pm.department || "Utility",
        subArea: pm.subArea || ""
      });

      setActionMessage({
        type: "success",
        text: nextEnabled
          ? `✓ '${pm.pm_id}' diaktifkan untuk ditampilkan di ${activeFact === "consumption_fact_1" ? "Fact 1" : "Fact 2"}.`
          : `✕ '${pm.pm_id}' dinonaktifkan dari tampilan ${activeFact === "consumption_fact_1" ? "Fact 1" : "Fact 2"}.`
      });

      onRefresh();
    } catch (err: any) {
      setActionMessage({
        type: "error",
        text: err?.message || "Gagal mengubah status Power Meter."
      });
    }
  };

  // Bulk toggle (Select All / Deselect All)
  const handleBulkToggle = async (enableAll: boolean) => {
    if (displayedPms.length === 0) return;
    setIsProcessing(true);
    setActionMessage(null);

    try {
      await postJson("/config/electricity/batch-toggle", {
        config_type: activeFact,
        enabled: enableAll,
        pms: displayedPms.map((pm) => {
          const idUpper = pm.pm_id.toUpperCase();
          const existing = configMap.get(idUpper);
          return {
            pm_id: pm.pm_id,
            label: existing?.label || pm.label || pm.pm_id,
            endpoint_url: pm.endpoint_url,
            department: pm.department || "Utility",
            subArea: pm.subArea || ""
          };
        })
      });

      setActionMessage({
        type: "success",
        text: enableAll
          ? `✓ Berhasil mengaktifkan ${displayedPms.length} Power Meter di ${activeFact === "consumption_fact_1" ? "Fact 1" : "Fact 2"}.`
          : `✕ Berhasil menonaktifkan ${displayedPms.length} Power Meter dari tampilan.`
      });

      onRefresh();
    } catch (err: any) {
      setActionMessage({
        type: "error",
        text: err?.message || "Gagal memperbarui status Power Meter secara massal."
      });
    } finally {
      setIsProcessing(false);
    }
  };

  // Test API for new PM
  const handleTestNewPmApi = async () => {
    if (!newPmEndpoint.trim()) {
      setTestResult({ success: false, message: "Masukkan Endpoint URL terlebih dahulu." });
      return;
    }
    setIsTestingApi(true);
    setTestResult(null);

    try {
      const res = await postJson<{ success: boolean; data?: any; message?: string }>("/config/api-sources/test", {
        url: newPmEndpoint.trim(),
        method: "GET"
      });

      if (res && res.success && res.data) {
        setTestResult({
          success: true,
          message: "✓ Endpoint terhubung sukses! Data API berhasil diterima."
        });
      } else {
        setTestResult({
          success: false,
          message: res?.message || "Gagal menghubungi endpoint. Periksa URL dan koneksi jaringan."
        });
      }
    } catch (err: any) {
      setTestResult({
        success: false,
        message: `Koneksi gagal: ${err?.message || "Network error"}`
      });
    } finally {
      setIsTestingApi(false);
    }
  };

  // Submit Add New PM (ONLY Endpoint, Label, and PM ID)
  const handleAddNewPm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPmId.trim()) {
      setActionMessage({ type: "error", text: "Power Meter ID (PM ID) wajib diisi." });
      return;
    }
    if (!newPmLabel.trim()) {
      setActionMessage({ type: "error", text: "Nama / Label Item wajib diisi." });
      return;
    }
    if (!newPmEndpoint.trim()) {
      setActionMessage({ type: "error", text: "Endpoint URL wajib diisi." });
      return;
    }

    setIsProcessing(true);
    setActionMessage(null);

    try {
      const payload = {
        config_type: newPmTargetFact,
        config_key: newPmId.toLowerCase().trim().replace(/[^a-z0-9_]/g, ""),
        label: newPmLabel.trim(),
        pm_id: newPmId.trim(),
        endpoint_url: newPmEndpoint.trim(),
        department: newPmDept,
        enabled: true
      };

      const res = await postJson<{ message?: string }>("/config/electricity", payload);

      setActionMessage({
        type: "success",
        text: res?.message || `✓ Power Meter baru '${newPmId.trim()}' berhasil didaftarkan dan aktif disimpan!`
      });

      // Reset form & reload
      setNewPmId("");
      setNewPmLabel("");
      setNewPmEndpoint("");
      setTestResult(null);
      setIsAddPmOpen(false);

      loadAvailablePms();
      onRefresh();
    } catch (err: any) {
      setActionMessage({
        type: "error",
        text: err?.message || "Gagal menambahkan Power Meter baru."
      });
    } finally {
      setIsProcessing(false);
    }
  };

  // Save edited label
  const handleSaveLabel = async () => {
    if (!editingPm || !editLabelInput.trim()) return;
    setIsProcessing(true);
    try {
      const idUpper = editingPm.pm_id.toUpperCase();
      const existing = configMap.get(idUpper);
      const pmObj = availablePms.find((p) => p.pm_id.toUpperCase() === idUpper);

      await postJson("/config/electricity/toggle", {
        config_type: activeFact,
        pm_id: editingPm.pm_id,
        enabled: existing ? existing.enabled !== false : true,
        label: editLabelInput.trim(),
        endpoint_url: pmObj?.endpoint_url || existing?.value?.endpoint_url || "",
        department: pmObj?.department || existing?.value?.department || "Utility",
        subArea: pmObj?.subArea || existing?.value?.subArea || ""
      });

      setActionMessage({
        type: "success",
        text: `✓ Label '${editingPm.pm_id}' diperbarui menjadi '${editLabelInput.trim()}'.`
      });

      setEditingPm(null);
      setEditLabelInput("");
      loadAvailablePms();
      onRefresh();
    } catch (err: any) {
      setActionMessage({
        type: "error",
        text: err?.message || "Gagal memperbarui label."
      });
    } finally {
      setIsProcessing(false);
    }
  };

  // Delete custom configured item
  const handleDeleteItem = async (pmId: string) => {
    const idUpper = pmId.toUpperCase();
    const existing = configMap.get(idUpper);
    if (!existing) return;

    if (!window.confirm(`Hapus item '${existing.label || pmId}' dari konfigurasi ${activeFact === "consumption_fact_1" ? "Fact 1" : "Fact 2"}?`)) {
      return;
    }

    try {
      await deleteJson(`/config/electricity/${existing.id}`);
      setActionMessage({ type: "success", text: `✓ Item '${existing.label}' berhasil dihapus.` });
      onRefresh();
      loadAvailablePms();
    } catch (err: any) {
      setActionMessage({ type: "error", text: err?.message || "Gagal menghapus item." });
    }
  };

  if (!isOpen) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 overflow-y-auto"
      onClick={onClose}
    >
      <div
        className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl w-full max-w-5xl p-6 space-y-4 my-auto max-h-[92vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-sky-500/10 text-sky-500 flex items-center justify-center font-bold text-lg">
              ⚡
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-slate-800 dark:text-white">
                  Kelola Tampilan Power Meter & Sub-Metering
                </h3>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase bg-amber-500/10 text-amber-500 border border-amber-500/20">
                  Senior Unit Head Only
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Cukup <strong className="text-sky-500">checklist</strong> Power Meter yang ingin ditampilkan di dashboard, atau daftarkan PM baru.
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

        {/* Action Alert Banner */}
        {actionMessage && (
          <div
            className={`px-4 py-2.5 rounded-xl text-xs font-semibold flex items-center justify-between transition ${
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

        {/* Top Controls: Fact Tabs & Add PM Button */}
        <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-50 dark:bg-slate-950/40 p-3 rounded-xl border border-slate-100 dark:border-slate-800">
          {/* Fact Selector Tabs */}
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => {
                setActiveFact("consumption_fact_1");
                setIsAddPmOpen(false);
              }}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-2 ${
                activeFact === "consumption_fact_1"
                  ? "bg-[#1f6fb5] text-white shadow-sm"
                  : "text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-800"
              }`}
            >
              <span>Biggest Consumption Fact 1</span>
              <span
                className={`px-1.5 py-0.2 rounded-full text-[10px] ${
                  activeFact === "consumption_fact_1" ? "bg-white/20 text-white" : "bg-slate-200 dark:bg-slate-700"
                }`}
              >
                {fact1Items.filter((i) => i.enabled !== false).length} Aktif
              </span>
            </button>
            <button
              onClick={() => {
                setActiveFact("consumption_fact_2");
                setIsAddPmOpen(false);
              }}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-2 ${
                activeFact === "consumption_fact_2"
                  ? "bg-[#06b6d4] text-white shadow-sm"
                  : "text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-800"
              }`}
            >
              <span>Biggest Consumption Fact 2</span>
              <span
                className={`px-1.5 py-0.2 rounded-full text-[10px] ${
                  activeFact === "consumption_fact_2" ? "bg-white/20 text-white" : "bg-slate-200 dark:bg-slate-700"
                }`}
              >
                {fact2Items.filter((i) => i.enabled !== false).length} Aktif
              </span>
            </button>
          </div>

          {/* Add New PM Toggle Button */}
          <button
            onClick={() => {
              setIsAddPmOpen(!isAddPmOpen);
              setNewPmTargetFact(activeFact);
              setTestResult(null);
            }}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 ${
              isAddPmOpen
                ? "bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200"
                : "bg-emerald-600 hover:bg-emerald-500 text-white shadow-sm"
            }`}
          >
            <span>{isAddPmOpen ? "✕ Tutup Form" : "➕ Tambah PM Baru"}</span>
          </button>
        </div>

        {/* Minimal Add New PM Form (ONLY Endpoint, Label, and PM ID) */}
        {isAddPmOpen && (
          <form
            onSubmit={handleAddNewPm}
            className="p-4 rounded-xl border border-emerald-500/30 bg-emerald-500/5 dark:bg-emerald-950/20 space-y-3 animate-fadeIn"
          >
            <div className="flex items-center justify-between border-b border-emerald-500/20 pb-2">
              <div className="flex items-center gap-2">
                <span className="text-sm">➕</span>
                <h4 className="text-xs font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-400">
                  Pendaftaran Power Meter Baru ke Database
                </h4>
              </div>
              <span className="text-[11px] text-slate-500 dark:text-slate-400">
                Otomatis disimpan per menit & per jam
              </span>
            </div>

            <p className="text-[11px] text-slate-600 dark:text-slate-300 leading-relaxed">
              Cukup masukkan <strong>Endpoint URL</strong>, <strong>Label</strong>, dan <strong>PM ID</strong>.
              Semua parameter teknis (Active Power, Energy, Tegangan, Arus, Power Factor, Frekuensi) akan otomatis dibaca dan disimpan ke database <span className="font-mono text-emerald-600">electric_pm</span>.
            </p>

            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {/* Target Factory */}
              <div>
                <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Target Factory *
                </label>
                <select
                  value={newPmTargetFact}
                  onChange={(e) => setNewPmTargetFact(e.target.value as any)}
                  className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-white font-semibold focus:ring-2 focus:ring-emerald-500 outline-none"
                >
                  <option value="consumption_fact_1">Fact 1 (Utility & Production)</option>
                  <option value="consumption_fact_2">Fact 2 (Utility & HVAC)</option>
                </select>
              </div>

              {/* Department */}
              <div>
                <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Departemen *
                </label>
                <select
                  value={newPmDept}
                  onChange={(e) => setNewPmDept(e.target.value as any)}
                  className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-white font-semibold focus:ring-2 focus:ring-emerald-500 outline-none"
                >
                  <option value="Utility">Utility</option>
                  <option value="HVAC">HVAC</option>
                  <option value="Other">Other / Production</option>
                </select>
              </div>

              {/* Power Meter ID */}
              <div>
                <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Power Meter ID (PM ID) *
                </label>
                <input
                  type="text"
                  required
                  placeholder="Contoh: PM350 / PM_CHILLER_3"
                  value={newPmId}
                  onChange={(e) => setNewPmId(e.target.value)}
                  className="w-full px-2.5 py-1.5 text-xs font-mono font-bold rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-white focus:ring-2 focus:ring-emerald-500 outline-none"
                />
              </div>

              {/* Label / Item Name */}
              <div>
                <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Nama / Label Item *
                </label>
                <input
                  type="text"
                  required
                  placeholder="Contoh: Chiller Daikin 1"
                  value={newPmLabel}
                  onChange={(e) => setNewPmLabel(e.target.value)}
                  className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-white font-semibold focus:ring-2 focus:ring-emerald-500 outline-none"
                />
              </div>
            </div>

            {/* Endpoint URL */}
            <div>
              <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Endpoint URL (Ignition Webdev API) *
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  required
                  placeholder="http://10.3.164.3:8088/system/webdev/Utility_Dashboard/PM350 atau endpoint API lainnya"
                  value={newPmEndpoint}
                  onChange={(e) => setNewPmEndpoint(e.target.value)}
                  className="flex-1 px-3 py-1.5 text-xs font-mono rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-white focus:ring-2 focus:ring-emerald-500 outline-none"
                />
                <button
                  type="button"
                  onClick={handleTestNewPmApi}
                  disabled={isTestingApi || !newPmEndpoint.trim()}
                  className="px-3 py-1.5 rounded-lg text-xs font-bold border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 disabled:opacity-50 transition shrink-0"
                >
                  {isTestingApi ? "Menguji API..." : "🔍 Test API"}
                </button>
              </div>
              {testResult && (
                <div
                  className={`mt-1.5 text-[11px] font-semibold ${
                    testResult.success ? "text-emerald-600 dark:text-emerald-400" : "text-amber-600 dark:text-amber-400"
                  }`}
                >
                  {testResult.message}
                </div>
              )}
            </div>

            {/* Form Submit Footer */}
            <div className="flex items-center justify-end gap-2 pt-1 border-t border-emerald-500/10">
              <button
                type="button"
                onClick={() => setIsAddPmOpen(false)}
                className="px-3 py-1.5 rounded-lg text-xs font-bold text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
              >
                Batal
              </button>
              <button
                type="submit"
                disabled={isProcessing}
                className="px-4 py-1.5 rounded-lg text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white shadow-sm transition disabled:opacity-50 flex items-center gap-1.5"
              >
                <span>✓</span>
                <span>{isProcessing ? "Menyimpan..." : "Simpan & Daftarkan PM Baru"}</span>
              </button>
            </div>
          </form>
        )}

        {/* Filter Toolbar: Dept Filter, Search, and Bulk Actions */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
          {/* Dept Filter */}
          <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800/80 p-1 rounded-xl text-xs">
            <span className="text-[10px] font-bold uppercase text-slate-400 px-2">Dept:</span>
            {(["all", "Utility", "HVAC", "Other"] as const).map((d) => (
              <button
                key={d}
                onClick={() => setDeptFilter(d)}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold transition ${
                  deptFilter === d
                    ? "bg-white dark:bg-slate-700 text-sky-600 dark:text-sky-400 shadow-sm"
                    : "text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
                }`}
              >
                {d === "all" ? "Semua" : d}
              </button>
            ))}
          </div>

          {/* Search Box & Show All Switch */}
          <div className="flex items-center gap-3 flex-1 sm:flex-initial justify-end">
            <div className="relative w-full sm:w-64">
              <input
                type="text"
                placeholder="Cari PM ID atau nama alat..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-8 pr-3 py-1.5 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-white focus:ring-2 focus:ring-sky-500 outline-none"
              />
              <span className="absolute left-2.5 top-1.5 text-slate-400 text-xs">🔍</span>
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery("")}
                  className="absolute right-2.5 top-1.5 text-slate-400 hover:text-slate-600 text-xs font-bold"
                >
                  ✕
                </button>
              )}
            </div>

            <label className="flex items-center gap-1.5 text-[11px] text-slate-500 dark:text-slate-400 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={showAllFactories}
                onChange={(e) => setShowAllFactories(e.target.checked)}
                className="h-3.5 w-3.5 rounded text-sky-600 focus:ring-sky-500"
              />
              <span>Tampilkan semua PM</span>
            </label>
          </div>
        </div>

        {/* Bulk Action Header Bar */}
        <div className="flex items-center justify-between px-3 py-2 bg-sky-500/5 dark:bg-sky-950/20 rounded-xl border border-sky-500/10 text-xs">
          <div className="flex items-center gap-2">
            <span className="font-bold text-sky-700 dark:text-sky-300">
              {activeCount} Power Meter Aktif Ditampilkan
            </span>
            <span className="text-slate-400">•</span>
            <span className="text-slate-500 dark:text-slate-400">
              {displayedPms.length} PM ditemukan
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => handleBulkToggle(true)}
              disabled={isProcessing || displayedPms.length === 0}
              className="px-2.5 py-1 rounded-lg text-[11px] font-bold text-sky-600 dark:text-sky-400 hover:bg-sky-500/10 border border-sky-500/20 transition disabled:opacity-50"
              title="Aktifkan semua PM yang tampil di tabel ini"
            >
              ✓ Centang Semua
            </button>
            <button
              onClick={() => handleBulkToggle(false)}
              disabled={isProcessing || displayedPms.length === 0}
              className="px-2.5 py-1 rounded-lg text-[11px] font-bold text-slate-500 hover:bg-slate-200 dark:hover:bg-slate-800 transition disabled:opacity-50"
              title="Hapus semua centang dari PM yang tampil di tabel ini"
            >
              ✕ Hapus Semua Centang
            </button>
          </div>
        </div>

        {/* Main Power Meter Checklist Table */}
        <div className="flex-1 overflow-y-auto border border-slate-200 dark:border-slate-800 rounded-xl">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 dark:bg-slate-800/80 text-slate-500 dark:text-slate-400 font-bold uppercase tracking-wider text-[10px] border-b border-slate-200 dark:border-slate-800 sticky top-0 z-10">
              <tr>
                <th className="py-2.5 px-4 w-14 text-center">Tampilkan</th>
                <th className="py-2.5 px-4 w-28">PM ID</th>
                <th className="py-2.5 px-4">Nama / Label Item</th>
                <th className="py-2.5 px-4 w-40">Departemen</th>
                <th className="py-2.5 px-4">Endpoint API</th>
                <th className="py-2.5 px-4 w-36 text-center">Status</th>
                <th className="py-2.5 px-4 w-24 text-center">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {isLoadingPms ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-400">
                    <div className="animate-spin text-2xl mb-2">⏳</div>
                    <div className="font-semibold text-xs">Memuat daftar Power Meter dari database...</div>
                  </td>
                </tr>
              ) : displayedPms.length > 0 ? (
                displayedPms.map((pm) => {
                  const idUpper = pm.pm_id.toUpperCase();
                  const configured = configMap.get(idUpper);
                  const isChecked = configured ? configured.enabled !== false : false;
                  const displayLabel = configured?.label || pm.label || pm.pm_id;

                  return (
                    <tr
                      key={pm.pm_id}
                      className={`hover:bg-sky-500/5 dark:hover:bg-sky-950/20 transition cursor-pointer ${
                        isChecked
                          ? "bg-sky-50/40 dark:bg-sky-950/10"
                          : "opacity-60 hover:opacity-100"
                      }`}
                      onClick={() => handleTogglePm(pm)}
                    >
                      {/* Checkbox Checklist */}
                      <td className="py-3 px-4 text-center" onClick={(e) => e.stopPropagation()}>
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => handleTogglePm(pm)}
                          className="h-4 w-4 rounded text-sky-600 focus:ring-sky-500 cursor-pointer accent-[#1f6fb5]"
                          title={isChecked ? "Klik untuk sembunyikan dari dashboard" : "Klik untuk tampilkan di dashboard"}
                        />
                      </td>

                      {/* PM ID */}
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-1.5">
                          <span className="font-mono font-extrabold text-slate-800 dark:text-white text-xs">
                            {pm.pm_id}
                          </span>
                          {pm.is_new_pm && (
                            <span className="text-[9px] font-extrabold px-1.5 py-0.2 rounded bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                              NEW
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Item Label */}
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-slate-800 dark:text-white">
                            {displayLabel}
                          </span>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setEditingPm({ pm_id: pm.pm_id, currentLabel: displayLabel });
                              setEditLabelInput(displayLabel);
                            }}
                            className="text-slate-400 hover:text-sky-500 opacity-40 hover:opacity-100 transition text-xs"
                            title="Edit nama label ini"
                          >
                            ✏️
                          </button>
                        </div>
                      </td>

                      {/* Department */}
                      <td className="py-3 px-4">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-extrabold uppercase ${
                            pm.department === "HVAC"
                              ? "bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 border border-cyan-500/20"
                              : pm.department === "Utility"
                              ? "bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20"
                              : "bg-slate-500/10 text-slate-600 dark:text-slate-400 border border-slate-500/20"
                          }`}
                        >
                          {pm.department || "Utility"}
                        </span>
                        {pm.subArea && (
                          <span className="text-[10px] text-slate-400 ml-1.5">
                            › {pm.subArea}
                          </span>
                        )}
                      </td>

                      {/* Endpoint API */}
                      <td className="py-3 px-4">
                        <div className="font-mono text-[10px] text-slate-500 dark:text-slate-400 truncate max-w-[240px]" title={pm.endpoint_url}>
                          {pm.endpoint_url || "—"}
                        </div>
                      </td>

                      {/* Status */}
                      <td className="py-3 px-4 text-center">
                        {isChecked ? (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                            ✓ Tampil di Chart
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-slate-100 dark:bg-slate-800 text-slate-400">
                            Tidak Ditampilkan
                          </span>
                        )}
                      </td>

                      {/* Actions */}
                      <td className="py-3 px-4 text-center" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => {
                              setEditingPm({ pm_id: pm.pm_id, currentLabel: displayLabel });
                              setEditLabelInput(displayLabel);
                            }}
                            className="px-2 py-0.5 rounded text-[10px] font-bold text-sky-600 hover:bg-sky-50 dark:hover:bg-sky-950/30 transition"
                            title="Ubah nama item"
                          >
                            ✏️ Edit
                          </button>
                          {configured && (
                            <button
                              type="button"
                              onClick={() => handleDeleteItem(pm.pm_id)}
                              className="px-1.5 py-0.5 rounded text-[10px] font-bold text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition"
                              title="Hapus kustomisasi"
                            >
                              🗑️
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-400">
                    <div className="text-2xl mb-1 opacity-40">🔍</div>
                    <div className="font-bold text-xs">Tidak ada Power Meter yang cocok</div>
                    <div className="text-[11px] mt-0.5 text-slate-400">
                      Coba ganti filter departemen, kosongkan kata kunci pencarian, atau klik &quot;➕ Tambah PM Baru&quot;.
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Edit Label Modal Dialog */}
        {editingPm && (
          <div
            className="fixed inset-0 z-60 flex items-center justify-center bg-black/50 p-4"
            onClick={() => setEditingPm(null)}
          >
            <div
              className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-xl w-full max-w-md p-5 space-y-3"
              onClick={(e) => e.stopPropagation()}
            >
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-800 dark:text-white flex items-center gap-1.5">
                <span>✏️</span>
                <span>Edit Nama / Label: {editingPm.pm_id}</span>
              </h4>
              <p className="text-[11px] text-slate-400">
                Nama ini akan ditampilkan pada chart dan card konsumsi.
              </p>
              <input
                type="text"
                value={editLabelInput}
                onChange={(e) => setEditLabelInput(e.target.value)}
                placeholder="Nama / Label Item"
                className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-white font-semibold focus:ring-2 focus:ring-sky-500 outline-none"
                autoFocus
              />
              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setEditingPm(null)}
                  className="px-3 py-1.5 rounded-lg text-xs font-bold text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
                >
                  Batal
                </button>
                <button
                  type="button"
                  onClick={handleSaveLabel}
                  disabled={isProcessing || !editLabelInput.trim()}
                  className="px-4 py-1.5 rounded-lg text-xs font-bold bg-sky-600 hover:bg-sky-500 text-white transition disabled:opacity-50"
                >
                  {isProcessing ? "Menyimpan..." : "Simpan Nama"}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Modal Footer */}
        <div className="flex items-center justify-between border-t border-slate-100 dark:border-slate-800 pt-3 text-xs text-slate-400">
          <div>
            Total <strong className="text-slate-700 dark:text-slate-300">{displayedPms.length}</strong> Power Meter terdaftar ({activeCount} aktif di {activeFact === "consumption_fact_1" ? "Fact 1" : "Fact 2"})
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
