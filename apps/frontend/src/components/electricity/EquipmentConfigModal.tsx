import React, { useState, useMemo, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import { getJson, postJson } from "../../services/api.client";

export interface EquipmentDisplayItem {
  id: number;
  config_type: string;
  config_key: string;
  label: string;
  value: {
    pm_id: string;
    seriesKey?: string;
    category: string;
    categoryLabel: string;
    endpoint_url?: string;
    factory?: string;
    department?: string;
    subArea?: string;
    is_new_pm?: boolean;
    registered_at?: string;
  };
  sort_order: number;
  enabled: boolean;
}

export const EQUIPMENT_CATEGORIES = [
  { key: "all", label: "Semua Kategori" },
  { key: "cooling_tower", label: "Cooling Tower", badgeColor: "bg-sky-500/10 text-sky-600 dark:text-sky-400 border-sky-500/20" },
  { key: "boiler", label: "Boiler", badgeColor: "bg-orange-500/10 text-orange-600 dark:text-orange-400 border-orange-500/20" },
  { key: "compressed_air", label: "Compressed Air", badgeColor: "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20" },
  { key: "chiller", label: "Chiller", badgeColor: "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20" },
  { key: "hvac_wh", label: "HVAC WH & Penerangan", badgeColor: "bg-teal-500/10 text-teal-600 dark:text-teal-400 border-teal-500/20" },
  { key: "hvac_qc", label: "HVAC QC & Produksi", badgeColor: "bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 border-cyan-500/20" },
  { key: "distribution", label: "Panel Distribusi & WTP", badgeColor: "bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border-indigo-500/20" },
  { key: "cubicles", label: "Incoming Cubicles", badgeColor: "bg-violet-500/10 text-violet-600 dark:text-violet-400 border-violet-500/20" },
  { key: "custom", label: "Kustom / Lainnya", badgeColor: "bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20" }
];

interface Props {
  isOpen: boolean;
  onClose: () => void;
  isDark: boolean;
  onItemsUpdated: () => void;
}

export const EquipmentConfigModal: React.FC<Props> = ({
  isOpen,
  onClose,
  isDark,
  onItemsUpdated
}) => {
  const [activeTab, setActiveTab] = useState<"manage" | "register">("manage");
  const [items, setItems] = useState<EquipmentDisplayItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");

  // Register New PM form
  const [newPmId, setNewPmId] = useState("");
  const [newPmLabel, setNewPmLabel] = useState("");
  const [newPmEndpoint, setNewPmEndpoint] = useState("");
  const [newPmCategory, setNewPmCategory] = useState("cooling_tower");
  const [newPmFactory, setNewPmFactory] = useState("wf1");
  const [newPmDepartment, setNewPmDepartment] = useState("Utility");

  // Inspect & Test
  const [isVerifying, setIsVerifying] = useState(false);
  const [verifyResult, setVerifyResult] = useState<{
    success: boolean;
    duplicate?: boolean;
    message: string;
    detectedFields?: string[];
    initialValues?: { activePower: number | null; activeEnergy: number | null };
  } | null>(null);

  // Status message
  const [statusMsg, setStatusMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Load configured items
  const loadEquipmentItems = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await getJson<{ success: boolean; data: EquipmentDisplayItem[] }>(
        "/config/electricity/equipment-items"
      );
      if (res?.data) {
        setItems(res.data);
      }
    } catch (err: any) {
      console.error("Failed to load equipment items:", err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isOpen) {
      loadEquipmentItems();
      setStatusMsg(null);
      setVerifyResult(null);
      setSearchQuery("");
    }
  }, [isOpen, loadEquipmentItems]);

  // Filtered items
  const filteredItems = useMemo(() => {
    return items.filter((item) => {
      const val = item.value || {};
      const cat = val.category || "custom";
      if (categoryFilter !== "all" && cat !== categoryFilter) {
        return false;
      }
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchLabel = item.label.toLowerCase().includes(q);
        const matchPm = (val.pm_id || item.config_key).toLowerCase().includes(q);
        const matchCat = (val.categoryLabel || "").toLowerCase().includes(q);
        if (!matchLabel && !matchPm && !matchCat) return false;
      }
      return true;
    });
  }, [items, categoryFilter, searchQuery]);

  // Toggle item enabled
  const handleToggle = async (item: EquipmentDisplayItem) => {
    try {
      const nextState = !item.enabled;
      await postJson("/config/electricity/equipment-items/toggle", {
        config_key: item.config_key,
        enabled: nextState
      });
      setItems((prev) =>
        prev.map((i) => (i.id === item.id ? { ...i, enabled: nextState } : i))
      );
      setStatusMsg({
        type: "success",
        text: `✓ Item '${item.label}' (${item.value?.pm_id || item.config_key}) ${
          nextState ? "diaktifkan di tampilan" : "disembunyikan dari tampilan"
        }.`
      });
      onItemsUpdated();
    } catch (err: any) {
      setStatusMsg({
        type: "error",
        text: err?.message || "Gagal mengubah status equipment"
      });
    }
  };

  // Bulk toggle for current filtered view (Tampilkan / Sembunyikan Semua)
  const handleBulkToggle = async (enable: boolean) => {
    if (filteredItems.length === 0) return;
    try {
      setIsSubmitting(true);
      await Promise.all(
        filteredItems
          .filter((i) => i.enabled !== enable)
          .map((i) =>
            postJson("/config/electricity/equipment-items/toggle", {
              config_key: i.config_key,
              enabled: enable
            })
          )
      );
      setItems((prev) =>
        prev.map((i) => {
          const match = filteredItems.find((f) => f.id === i.id);
          return match ? { ...i, enabled: enable } : i;
        })
      );
      setStatusMsg({
        type: "success",
        text: `✓ ${filteredItems.length} item berhasil ${
          enable ? "ditampilkan di dashboard" : "disembunyikan dari dashboard"
        }.`
      });
      onItemsUpdated();
    } catch (err: any) {
      setStatusMsg({
        type: "error",
        text: err?.message || "Gagal mengubah status tampilan massal"
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Add existing PM to display
  // Test & Verify API endpoint
  const handleTestEndpoint = async () => {
    if (!newPmEndpoint.trim()) {
      setVerifyResult({ success: false, message: "Masukkan API Endpoint URL terlebih dahulu." });
      return;
    }
    const cleanPm = newPmId.trim().toUpperCase();
    if (!cleanPm) {
      setVerifyResult({ success: false, message: "Masukkan PM ID (contoh: PM501) terlebih dahulu." });
      return;
    }

    setIsVerifying(true);
    setVerifyResult(null);

    try {
      // 1. Check duplicate locally first
      const existsInCurrent = items.some(
        (i) => (i.value?.pm_id || i.config_key).toUpperCase() === cleanPm
      );
      if (existsInCurrent) {
        setVerifyResult({
          success: false,
          duplicate: true,
          message: `Power Meter '${cleanPm}' sudah terdaftar dalam tampilan per-equipment. Tidak dapat menambahkan duplikat.`
        });
        setIsVerifying(false);
        return;
      }

      // 2. Test endpoint connectivity
      const testRes = await postJson<{ success: boolean; data?: any; error?: string; status?: number }>(
        "/config/api-sources/test",
        { url: newPmEndpoint.trim(), method: "GET" }
      );

      if (!testRes.success || !testRes.data) {
        setVerifyResult({
          success: false,
          message: `Gagal menghubungi endpoint: ${testRes.error || "Response kosong atau timeout"}`
        });
        setIsVerifying(false);
        return;
      }

      // Inspect data structure
      const rawData = testRes.data;
      const targetObj = Array.isArray(rawData)
        ? rawData.find((p: any) => String(p.pm_id || p.pm || "").toUpperCase() === cleanPm) || rawData[0] || {}
        : rawData[cleanPm] || rawData;

      const allKeys = Object.keys(targetObj);
      const keys = allKeys.slice(0, 15);

      // Find power & energy values (supports exact, suffixed like _PM181, and substring match)
      let foundPower: number | null = null;
      let foundEnergy: number | null = null;

      const powerCandidates = ["Active_Power_Total", "Active_Power", "Power", "kW", "ActivePower"];
      for (const k of powerCandidates) {
        if (targetObj[k] !== undefined && !isNaN(Number(targetObj[k]))) {
          foundPower = Number(targetObj[k]);
          break;
        }
        const suffixed = `${k}_${cleanPm}`;
        if (targetObj[suffixed] !== undefined && !isNaN(Number(targetObj[suffixed]))) {
          foundPower = Number(targetObj[suffixed]);
          break;
        }
      }
      if (foundPower === null) {
        const pKey = allKeys.find((k) => k.toLowerCase().includes("active_power") || k.toLowerCase().includes("power"));
        if (pKey && !isNaN(Number(targetObj[pKey]))) {
          foundPower = Number(targetObj[pKey]);
        }
      }

      const energyCandidates = ["ActiveEnergy", "Active_Energy", "Energy", "total_kwh", "Total_KWH", "kWh"];
      for (const k of energyCandidates) {
        if (targetObj[k] !== undefined && !isNaN(Number(targetObj[k]))) {
          foundEnergy = Number(targetObj[k]);
          break;
        }
        const suffixed = `${k}_${cleanPm}`;
        if (targetObj[suffixed] !== undefined && !isNaN(Number(targetObj[suffixed]))) {
          foundEnergy = Number(targetObj[suffixed]);
          break;
        }
      }
      if (foundEnergy === null) {
        const eKey = allKeys.find((k) => k.toLowerCase().includes("activeenergy") || k.toLowerCase().includes("energy") || k.toLowerCase().includes("kwh"));
        if (eKey && !isNaN(Number(targetObj[eKey]))) {
          foundEnergy = Number(targetObj[eKey]);
        }
      }

      setVerifyResult({
        success: true,
        message: `Endpoint responsif! Sistem otomatis mendeteksi parameter dari endpoint.`,
        detectedFields: keys,
        initialValues: {
          activePower: foundPower,
          activeEnergy: foundEnergy
        }
      });
    } catch (err: any) {
      setVerifyResult({
        success: false,
        message: `Koneksi gagal: ${err?.message || "Terjadi kesalahan saat menguji endpoint"}`
      });
    } finally {
      setIsVerifying(false);
    }
  };

  // Submit Brand New PM registration
  const handleRegisterNewPm = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanPm = newPmId.trim().toUpperCase();
    const cleanLabel = newPmLabel.trim();
    const cleanUrl = newPmEndpoint.trim();

    if (!cleanPm || !cleanLabel || !cleanUrl) {
      setStatusMsg({
        type: "error",
        text: "PM ID, Nama Item, dan API Endpoint wajib diisi lengkap."
      });
      return;
    }

    const catObj = EQUIPMENT_CATEGORIES.find((c) => c.key === newPmCategory);

    try {
      setIsSubmitting(true);
      setStatusMsg(null);

      const res = await postJson<{
        success: boolean;
        message: string;
        duplicate?: boolean;
        item?: any;
      }>("/config/electricity/verify-and-register-pm", {
        pm_id: cleanPm,
        label: cleanLabel,
        endpoint_url: cleanUrl,
        category: newPmCategory,
        categoryLabel: catObj?.label || newPmCategory,
        factory: newPmFactory,
        department: newPmDepartment
      });

      if (!res.success) {
        if (res.duplicate) {
          setStatusMsg({
            type: "error",
            text: res.message || "Power meter sudah ada di database."
          });
        } else {
          setStatusMsg({
            type: "error",
            text: res.message || "Gagal mendaftarkan Power Meter baru."
          });
        }
        return;
      }

      setStatusMsg({
        type: "success",
        text: `✓ ${res.message}`
      });

      // Reset form
      setNewPmId("");
      setNewPmLabel("");
      setNewPmEndpoint("");
      setVerifyResult(null);

      // Refresh list & switch back to manage tab
      await loadEquipmentItems();
      onItemsUpdated();
      setActiveTab("manage");
    } catch (err: any) {
      setStatusMsg({
        type: "error",
        text: err?.message || "Gagal mendaftarkan PM baru ke database."
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-4xl max-h-[90vh] bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl flex flex-col overflow-hidden text-slate-800 dark:text-slate-100"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-950/40">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-sky-500/10 border border-sky-500/20 flex items-center justify-center text-sky-500 text-lg font-bold">
              ⚙️
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-slate-800 dark:text-white">
                  Kelola Tampilan Konsumsi Per-Equipment
                </h3>
                <span className="px-2 py-0.5 rounded text-[10px] font-extrabold uppercase bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
                  Senior Unit Head
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Atur item mana saja yang ingin ditampilkan atau disembunyikan di dashboard, atau daftarkan PM baru dari API endpoint.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
          >
            ✕
          </button>
        </div>

        {/* Tab Switcher */}
        <div className="flex items-center border-b border-slate-200 dark:border-slate-800 bg-slate-100/50 dark:bg-slate-950/20 px-6 pt-2">
          <button
            type="button"
            onClick={() => setActiveTab("manage")}
            className={`flex items-center gap-2 px-4 py-2.5 text-xs font-bold border-b-2 transition cursor-pointer ${
              activeTab === "manage"
                ? "border-sky-500 text-sky-600 dark:text-sky-400 bg-white dark:bg-slate-900 rounded-t-lg shadow-sm"
                : "border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
            }`}
          >
            <span>📋 Daftar Tampilan Equipment</span>
            <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-slate-200 dark:bg-slate-800 font-mono">
              {items.length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("register")}
            className={`flex items-center gap-2 px-4 py-2.5 text-xs font-bold border-b-2 transition cursor-pointer ${
              activeTab === "register"
                ? "border-sky-500 text-sky-600 dark:text-sky-400 bg-white dark:bg-slate-900 rounded-t-lg shadow-sm"
                : "border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
            }`}
          >
            <span>✨ Tambah PM Baru dari API Endpoint</span>
            <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-bold border border-emerald-500/20">
              NEW
            </span>
          </button>
        </div>

        {/* Status Notification Toast */}
        {statusMsg && (
          <div
            className={`mx-6 mt-4 p-3 rounded-xl border text-xs font-medium flex items-center justify-between transition ${
              statusMsg.type === "success"
                ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-600 dark:text-emerald-400"
                : "bg-rose-500/10 border-rose-500/30 text-rose-600 dark:text-rose-400"
            }`}
          >
            <span>{statusMsg.text}</span>
            <button
              type="button"
              onClick={() => setStatusMsg(null)}
              className="text-slate-400 hover:text-slate-600 font-bold ml-2"
            >
              ✕
            </button>
          </div>
        )}

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {/* TAB 1: MANAGE EXISTING ITEMS */}
          {activeTab === "manage" && (
            <div className="space-y-4">
              {/* Filter & Action Bar */}
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex flex-wrap items-center gap-2 flex-1">
                  {/* Category Filter */}
                  <select
                    value={categoryFilter}
                    onChange={(e) => setCategoryFilter(e.target.value)}
                    className="px-3 py-1.5 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 font-bold text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-sky-500 cursor-pointer"
                  >
                    {EQUIPMENT_CATEGORIES.map((c) => (
                      <option key={c.key} value={c.key}>
                        {c.label}
                      </option>
                    ))}
                  </select>

                  {/* Search Input */}
                  <div className="relative flex-1 min-w-[200px]">
                    <input
                      type="text"
                      placeholder="Cari nama equipment atau PM..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-full pl-8 pr-3 py-1.5 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-sky-500"
                    />
                    <span className="absolute left-2.5 top-2 text-xs text-slate-400">🔍</span>
                  </div>
                </div>

                {/* Quick Actions Bar: Bulk Toggle */}
                <div className="flex items-center gap-1.5 bg-slate-100 dark:bg-slate-800 p-0.5 rounded-xl border border-slate-200 dark:border-slate-700">
                  <button
                    type="button"
                    onClick={() => handleBulkToggle(true)}
                    disabled={isSubmitting || filteredItems.length === 0}
                    className="px-2.5 py-1 text-[11px] font-bold rounded-lg text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/10 disabled:opacity-50 transition cursor-pointer"
                    title="Tampilkan semua equipment dalam daftar filter ini"
                  >
                    ✓ Tampilkan Semua
                  </button>
                  <span className="text-slate-300 dark:text-slate-600">|</span>
                  <button
                    type="button"
                    onClick={() => handleBulkToggle(false)}
                    disabled={isSubmitting || filteredItems.length === 0}
                    className="px-2.5 py-1 text-[11px] font-bold rounded-lg text-slate-500 hover:bg-slate-200 dark:hover:bg-slate-700 disabled:opacity-50 transition cursor-pointer"
                    title="Sembunyikan semua equipment dalam daftar filter ini"
                  >
                    ✕ Sembunyikan Semua
                  </button>
                </div>
              </div>

              {/* Items List / Table with Fixed Widths & Solid Opaque Sticky Headers */}
              <div className="border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden bg-white dark:bg-slate-900 shadow-sm">
                <div className="max-h-[460px] overflow-y-auto">
                  <table className="w-full text-left text-xs border-collapse table-fixed">
                    <thead className="sticky top-0 z-20 bg-slate-100 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 shadow-sm">
                      <tr>
                        <th className="w-[34%] px-4 py-3 text-[11px] font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wider bg-slate-100 dark:bg-slate-800">
                          Equipment / Title
                        </th>
                        <th className="w-[14%] px-3 py-3 text-[11px] font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wider bg-slate-100 dark:bg-slate-800">
                          PM ID
                        </th>
                        <th className="w-[18%] px-3 py-3 text-[11px] font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wider bg-slate-100 dark:bg-slate-800">
                          Kategori
                        </th>
                        <th className="w-[18%] px-3 py-3 text-[11px] font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wider bg-slate-100 dark:bg-slate-800">
                          Endpoint
                        </th>
                        <th className="w-[16%] px-4 py-3 text-center text-[11px] font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wider bg-slate-100 dark:bg-slate-800 whitespace-nowrap">
                          Status Tampilan
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                      {isLoading ? (
                        <tr>
                          <td colSpan={5} className="text-center py-10 text-slate-400">
                            Memuat daftar equipment...
                          </td>
                        </tr>
                      ) : filteredItems.length === 0 ? (
                        <tr>
                          <td colSpan={5} className="text-center py-10 text-slate-400">
                            Tidak ada equipment yang cocok dengan filter atau pencarian.
                          </td>
                        </tr>
                      ) : (
                        filteredItems.map((item) => {
                          const val = item.value || {};
                          const catBadge =
                            EQUIPMENT_CATEGORIES.find((c) => c.key === val.category)?.badgeColor ||
                            "bg-slate-100 text-slate-600 border-slate-200";

                          return (
                            <tr
                              key={item.id}
                              className={`hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition ${
                                !item.enabled ? "opacity-60 bg-slate-50/40 dark:bg-slate-950/20" : ""
                              }`}
                            >
                              <td className="px-4 py-3 font-bold text-slate-800 dark:text-slate-100 truncate">
                                <div className="flex items-center gap-2 truncate">
                                  <span className="truncate">{item.label}</span>
                                  {val.is_new_pm && (
                                    <span className="px-1.5 py-0.5 rounded text-[9px] font-extrabold bg-emerald-500/10 text-emerald-600 border border-emerald-500/20 flex-shrink-0">
                                      NEW PM
                                    </span>
                                  )}
                                </div>
                              </td>
                              <td className="px-3 py-3">
                                <span className="px-2 py-0.5 rounded-md font-mono text-[11px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                                  {val.pm_id || item.config_key.toUpperCase()}
                                </span>
                              </td>
                              <td className="px-3 py-3 truncate">
                                <span
                                  className={`px-2 py-0.5 rounded-full text-[10px] font-bold border inline-block truncate max-w-full ${catBadge}`}
                                >
                                  {val.categoryLabel || val.category || "General"}
                                </span>
                              </td>
                              <td className="px-3 py-3">
                                <span className="font-mono text-[10px] text-slate-500 dark:text-slate-400 bg-slate-100/70 dark:bg-slate-800/70 px-2 py-0.5 rounded border border-slate-200/60 dark:border-slate-700/60 truncate block max-w-full">
                                  {val.endpoint_url || "-"}
                                </span>
                              </td>
                              <td className="px-4 py-3 text-center whitespace-nowrap">
                                <button
                                  type="button"
                                  onClick={() => handleToggle(item)}
                                  className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-bold transition-all cursor-pointer border ${
                                    item.enabled
                                      ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/20 shadow-sm"
                                      : "bg-slate-100 text-slate-400 dark:bg-slate-800/80 dark:text-slate-500 border-slate-200 dark:border-slate-700 hover:bg-slate-200/50"
                                  }`}
                                  title={item.enabled ? "Klik untuk sembunyikan dari dashboard" : "Klik untuk tampilkan di dashboard"}
                                >
                                  <span className={`w-2 h-2 rounded-full ${item.enabled ? "bg-emerald-500" : "bg-slate-400"}`} />
                                  <span>{item.enabled ? "Ditampilkan" : "Disembunyikan"}</span>
                                </button>
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>

                <div className="px-4 py-2.5 bg-slate-50/50 dark:bg-slate-950/40 border-t border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-400">
                  <div className="flex items-center gap-2">
                    <span>
                      Total: <strong>{items.length}</strong> equipment &bull; Ditampilkan: <strong className="text-emerald-500">{items.filter((i) => i.enabled).length}</strong> &bull; Disembunyikan: <strong>{items.filter((i) => !i.enabled).length}</strong>
                    </span>
                  </div>
                  <span className="text-[10px] text-slate-400/80 italic">
                    ℹ️ Item yang disembunyikan tetap tersimpan di database dan dapat ditampilkan kembali sewaktu-waktu.
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: REGISTER BRAND NEW PM FROM API ENDPOINT */}
          {activeTab === "register" && (
            <form onSubmit={handleRegisterNewPm} className="space-y-5">

              <div className="grid gap-4 sm:grid-cols-2">
                {/* PM ID */}
                <div>
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                    PM ID <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Contoh: PM501, PM190, PM_CHILLER3"
                    value={newPmId}
                    onChange={(e) => setNewPmId(e.target.value.toUpperCase())}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 font-mono font-bold focus:outline-none focus:ring-1 focus:ring-sky-500"
                  />
                  <span className="text-[10px] text-slate-400 mt-1 block">
                    ID unik Power Meter di sistem (harus unik, tidak boleh duplikat).
                  </span>
                </div>

                {/* Equipment / Item Name */}
                <div>
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                    Nama Equipment / Item <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Contoh: Chiller Baru Gedung C WF2"
                    value={newPmLabel}
                    onChange={(e) => setNewPmLabel(e.target.value)}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 font-bold focus:outline-none focus:ring-1 focus:ring-sky-500"
                  />
                  <span className="text-[10px] text-slate-400 mt-1 block">
                    Nama judul yang akan tampil pada chart di dashboard.
                  </span>
                </div>

                {/* API Endpoint URL */}
                <div className="sm:col-span-2">
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                    API Endpoint URL <span className="text-rose-500">*</span>
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      required
                      placeholder="Contoh: http://10.3.164.3:8088/system/webdev/Utility_Dashboard/electric_ew23 atau alias"
                      value={newPmEndpoint}
                      onChange={(e) => setNewPmEndpoint(e.target.value)}
                      className="flex-1 px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 font-mono focus:outline-none focus:ring-1 focus:ring-sky-500"
                    />
                    <button
                      type="button"
                      onClick={handleTestEndpoint}
                      disabled={isVerifying || !newPmEndpoint.trim()}
                      className="px-4 py-2 rounded-xl bg-sky-500 hover:bg-sky-600 disabled:opacity-50 text-white text-xs font-bold transition flex items-center gap-1.5 cursor-pointer flex-shrink-0"
                    >
                      {isVerifying ? (
                        <>
                          <span className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
                          <span>Memeriksa...</span>
                        </>
                      ) : (
                        <>
                          <span>⚡</span>
                          <span>Tes &amp; Deteksi Endpoint</span>
                        </>
                      )}
                    </button>
                  </div>
                  <span className="text-[10px] text-slate-400 mt-1 block">
                    Sistem dapat langsung menguji koneksi ke endpoint URL ini dan membaca strukturnya secara otomatis.
                  </span>
                </div>

                {/* Category Selection */}
                <div>
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                    Kategori Equipment
                  </label>
                  <select
                    value={newPmCategory}
                    onChange={(e) => setNewPmCategory(e.target.value)}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 font-bold focus:outline-none focus:ring-1 focus:ring-sky-500 cursor-pointer"
                  >
                    {EQUIPMENT_CATEGORIES.filter((c) => c.key !== "all").map((c) => (
                      <option key={c.key} value={c.key}>
                        {c.label}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Factory & Department */}
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                      Pabrik
                    </label>
                    <select
                      value={newPmFactory}
                      onChange={(e) => setNewPmFactory(e.target.value)}
                      className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 font-bold focus:outline-none cursor-pointer"
                    >
                      <option value="wf1">Factory 1 (WF1)</option>
                      <option value="wf2">Factory 2 (WF2)</option>
                    </select>
                  </div>

                  <div>
                    <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                      Departemen
                    </label>
                    <select
                      value={newPmDepartment}
                      onChange={(e) => setNewPmDepartment(e.target.value)}
                      className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 font-bold focus:outline-none cursor-pointer"
                    >
                      <option value="Utility">Utility</option>
                      <option value="HVAC">HVAC</option>
                      <option value="Other">Other / QC</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* Endpoint Inspection Results Card */}
              {verifyResult && (
                <div
                  className={`p-4 rounded-xl border text-xs space-y-2 transition ${
                    verifyResult.success
                      ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
                      : "border-rose-500/30 bg-rose-500/10 text-rose-700 dark:text-rose-300"
                  }`}
                >
                  <div className="flex items-center gap-2 font-bold">
                    <span>{verifyResult.success ? "✓" : "⚠️"}</span>
                    <span>{verifyResult.message}</span>
                  </div>

                  {verifyResult.success && verifyResult.detectedFields && (
                    <div className="pt-2 border-t border-emerald-500/20 space-y-1.5">
                      <div className="flex items-center gap-2 text-[11px]">
                        <span className="font-bold">Parameter Terdeteksi:</span>
                        <div className="flex flex-wrap gap-1">
                          {verifyResult.detectedFields.map((f) => (
                            <span
                              key={f}
                              className="px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-800 dark:text-emerald-200 font-mono text-[10px]"
                            >
                              {f}
                            </span>
                          ))}
                        </div>
                      </div>

                      {verifyResult.initialValues && (
                        <div className="flex items-center gap-4 text-[11px] pt-1">
                          <span>
                            Active Power:{" "}
                            <strong>
                              {verifyResult.initialValues.activePower !== null
                                ? `${verifyResult.initialValues.activePower} kW`
                                : "Akan terisi saat polling"}
                            </strong>
                          </span>
                          <span>
                            Active Energy:{" "}
                            <strong>
                              {verifyResult.initialValues.activeEnergy !== null
                                ? `${verifyResult.initialValues.activeEnergy.toLocaleString("id-ID")} kWh`
                                : "Akan terisi saat polling"}
                            </strong>
                          </span>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* Submit Buttons */}
              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-200 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setActiveTab("manage")}
                  className="px-4 py-2 text-xs font-bold text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 transition"
                >
                  Batal
                </button>

                <button
                  type="submit"
                  disabled={isSubmitting || !newPmId.trim() || !newPmLabel.trim() || !newPmEndpoint.trim()}
                  className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-sky-500 to-blue-600 hover:from-sky-600 hover:to-blue-700 disabled:opacity-50 text-white text-xs font-bold transition shadow-lg shadow-sky-500/20 flex items-center gap-2 cursor-pointer"
                >
                  {isSubmitting ? (
                    <>
                      <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      <span>Menyimpan ke Database...</span>
                    </>
                  ) : (
                    <>
                      <span>💾</span>
                      <span>Daftarkan PM Baru &amp; Tampilkan ke Web</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          )}
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-3 border-t border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/40 flex items-center justify-between text-xs text-slate-400">
          <span>
            SCADA Platform &bull; Hak Akses: Senior Unit Head
          </span>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 font-bold transition cursor-pointer"
          >
            Tutup
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
};
