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
    row?: number;
    span?: string;
    align?: "left" | "center" | "right" | "full";
  };
  sort_order: number;
  enabled: boolean;
}

export interface StoredEndpointOption {
  url: string;
  alias: string;
  label: string;
  defaultFactory: "wf1" | "wf2";
}

export interface UnregisteredPmItem {
  pm_id: string;
  detectedFields: string[];
  initialValues: {
    activePower: number | null;
    activeEnergy: number | null;
  };
}

export interface DiscoverEndpointResponse {
  success: boolean;
  storedEndpoints: StoredEndpointOption[];
  selectedEndpoint: string | null;
  endpointReachable: boolean;
  endpointError: string | null;
  totalDetectedPmsOnEndpoint: number;
  alreadyRegisteredPmsOnEndpoint: string[];
  unregisteredPms: UnregisteredPmItem[];
}

export const FALLBACK_STORED_ENDPOINTS: StoredEndpointOption[] = [
  {
    url: "http://10.3.164.3:8088/system/webdev/Utility_Dashboard/electric_ew21",
    alias: "electric_ew21",
    label: "Endpoint EW21 — Factory 1 Sub-Meters (electric_ew21)",
    defaultFactory: "wf1"
  },
  {
    url: "http://10.3.164.3:8088/system/webdev/Utility_Dashboard/electric_ew22",
    alias: "electric_ew22",
    label: "Endpoint EW22 — Factory 2 Sub-Meters (electric_ew22)",
    defaultFactory: "wf2"
  },
  {
    url: "http://10.3.164.3:8088/system/webdev/Utility_Dashboard/electric_ew23",
    alias: "electric_ew23",
    label: "Endpoint EW23 — Panel Distribusi, Incoming & Trafo (electric_ew23)",
    defaultFactory: "wf1"
  },
  {
    url: "http://10.3.164.3:8088/system/webdev/Utility_Dashboard/electric_pln",
    alias: "electric_pln",
    label: "Endpoint PLN — Incoming Cubicle PLN (electric_pln)",
    defaultFactory: "wf1"
  },
  {
    url: "http://10.3.164.3:8088/system/webdev/Utility_Dashboard/electric_wf1",
    alias: "electric_wf1",
    label: "Endpoint WF1 — Incoming Feeder Factory 1 (electric_wf1)",
    defaultFactory: "wf1"
  },
  {
    url: "http://10.3.164.3:8088/system/webdev/Utility_Dashboard/electric_wf2",
    alias: "electric_wf2",
    label: "Endpoint WF2 — Incoming Feeder Factory 2 (electric_wf2)",
    defaultFactory: "wf2"
  }
];

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
  onItemsUpdated
}) => {
  const [activeTab, setActiveTab] = useState<"manage" | "register">("manage");
  const [items, setItems] = useState<EquipmentDisplayItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");

  // Stored endpoints & dynamic unregistered PM discovery
  const [storedEndpoints, setStoredEndpoints] = useState<StoredEndpointOption[]>(FALLBACK_STORED_ENDPOINTS);
  const [unregisteredPms, setUnregisteredPms] = useState<UnregisteredPmItem[]>([]);
  const [totalDetectedOnEndpoint, setTotalDetectedOnEndpoint] = useState<number>(0);

  // Register New PM form (Dropdown-only for Endpoint & PM ID)
  const [newPmEndpoint, setNewPmEndpoint] = useState("");
  const [newPmId, setNewPmId] = useState("");
  const [newPmLabel, setNewPmLabel] = useState("");
  const [newPmCategory, setNewPmCategory] = useState("cooling_tower");
  const [newPmFactory, setNewPmFactory] = useState("wf1");
  const [newPmDepartment, setNewPmDepartment] = useState("Utility");

  // Inspect & Scan Endpoint status
  const [isVerifying, setIsVerifying] = useState(false);
  const [verifyResult, setVerifyResult] = useState<{
    success: boolean;
    hasNewPms?: boolean;
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

  // Load stored endpoints list from backend
  const loadStoredEndpoints = useCallback(async () => {
    try {
      const res = await getJson<DiscoverEndpointResponse>(
        "/config/electricity/discover-endpoint-pms"
      );
      if (res?.storedEndpoints && res.storedEndpoints.length > 0) {
        setStoredEndpoints(res.storedEndpoints);
      }
    } catch (err) {
      console.error("Failed to load stored endpoints:", err);
    }
  }, []);

  // Scan a selected endpoint URL for unregistered new PMs
  const scanEndpointForNewPms = useCallback(
    async (endpointUrl: string) => {
      const cleanUrl = endpointUrl.trim();
      if (!cleanUrl) {
        setUnregisteredPms([]);
        setNewPmId("");
        setTotalDetectedOnEndpoint(0);
        setVerifyResult(null);
        return;
      }

      // Auto-sync default factory based on chosen endpoint
      const matchedEp = storedEndpoints.find((ep) => ep.url === cleanUrl || ep.alias === cleanUrl);
      if (matchedEp) {
        setNewPmFactory(matchedEp.defaultFactory);
      }

      setIsVerifying(true);
      setVerifyResult(null);
      setUnregisteredPms([]);
      setNewPmId("");

      try {
        const res = await getJson<DiscoverEndpointResponse>(
          `/config/electricity/discover-endpoint-pms?endpoint=${encodeURIComponent(cleanUrl)}`
        );

        if (res?.storedEndpoints && res.storedEndpoints.length > 0) {
          setStoredEndpoints(res.storedEndpoints);
        }

        if (!res || !res.endpointReachable) {
          setUnregisteredPms([]);
          setNewPmId("");
          setTotalDetectedOnEndpoint(0);
          setVerifyResult({
            success: false,
            hasNewPms: false,
            message: `Gagal menghubungi endpoint: ${res?.endpointError || "Response kosong atau timeout"}`
          });
          return;
        }

        const newPms = res.unregisteredPms || [];
        const totalOnApi = res.totalDetectedPmsOnEndpoint || 0;
        setUnregisteredPms(newPms);
        setTotalDetectedOnEndpoint(totalOnApi);

        if (newPms.length > 0) {
          const firstPm = newPms[0];
          setNewPmId(firstPm.pm_id);
          setVerifyResult({
            success: true,
            hasNewPms: true,
            message: `Ditemukan ${newPms.length} PM baru yang belum terdaftar di sistem (dari total ${totalOnApi} PM pada endpoint ini). Silakan pilih PM ID pada dropdown.`,
            detectedFields: firstPm.detectedFields,
            initialValues: firstPm.initialValues
          });
        } else {
          setNewPmId("");
          setVerifyResult({
            success: true,
            hasNewPms: false,
            message:
              totalOnApi > 0
                ? `Semua Power Meter pada endpoint ini (${totalOnApi} PM) sudah terdaftar di database & website. Tidak ada PM baru yang belum ditambahkan.`
                : `Endpoint aktif, namun tidak ditemukan tag Power Meter baru yang belum terdaftar.`
          });
        }
      } catch (err: any) {
        setUnregisteredPms([]);
        setNewPmId("");
        setTotalDetectedOnEndpoint(0);
        setVerifyResult({
          success: false,
          hasNewPms: false,
          message: `Gagal memindai endpoint: ${err?.message || "Terjadi kesalahan jaringan"}`
        });
      } finally {
        setIsVerifying(false);
      }
    },
    [storedEndpoints]
  );

  useEffect(() => {
    if (isOpen) {
      loadEquipmentItems();
      loadStoredEndpoints();
      setStatusMsg(null);
      setVerifyResult(null);
      setSearchQuery("");
      setNewPmEndpoint("");
      setNewPmId("");
      setNewPmLabel("");
      setUnregisteredPms([]);
      setTotalDetectedOnEndpoint(0);
    }
  }, [isOpen, loadEquipmentItems, loadStoredEndpoints]);

  // Handle Endpoint Dropdown selection change
  const handleSelectEndpoint = (selectedUrl: string) => {
    setNewPmEndpoint(selectedUrl);
    scanEndpointForNewPms(selectedUrl);
  };

  // Handle PM ID Dropdown selection change
  const handleSelectPmId = (selectedPmId: string) => {
    setNewPmId(selectedPmId);
    const found = unregisteredPms.find((p) => p.pm_id === selectedPmId);
    if (found) {
      setVerifyResult({
        success: true,
        hasNewPms: true,
        message: `PM baru '${found.pm_id}' siap didaftarkan (${unregisteredPms.length} PM baru ditemukan dari total ${totalDetectedOnEndpoint} PM di endpoint ini).`,
        detectedFields: found.detectedFields,
        initialValues: found.initialValues
      });
    }
  };

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

  // Submit Brand New PM registration
  const handleRegisterNewPm = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanPm = newPmId.trim().toUpperCase();
    const cleanLabel = newPmLabel.trim();
    const cleanUrl = newPmEndpoint.trim();

    if (!cleanUrl) {
      setStatusMsg({
        type: "error",
        text: "Pilih API Endpoint URL dari opsi dropdown terlebih dahulu."
      });
      return;
    }

    if (!cleanPm) {
      setStatusMsg({
        type: "error",
        text: "Pilih PM ID baru dari opsi dropdown. Jika kosong, berarti tidak ada PM baru pada endpoint ini."
      });
      return;
    }

    if (!cleanLabel) {
      setStatusMsg({
        type: "error",
        text: "Nama Equipment / Item wajib diisi."
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
        setStatusMsg({
          type: "error",
          text: res.message || "Gagal mendaftarkan Power Meter baru."
        });
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
      setUnregisteredPms([]);
      setVerifyResult(null);

      // Refresh list & switch back to manage tab
      await loadEquipmentItems();
      await loadStoredEndpoints();
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
                {/* API Endpoint URL Dropdown (No Manual Input) */}
                <div className="sm:col-span-2">
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                    API Endpoint URL <span className="text-rose-500">*</span>
                  </label>
                  <div className="flex gap-2">
                    <select
                      required
                      value={newPmEndpoint}
                      onChange={(e) => handleSelectEndpoint(e.target.value)}
                      className="flex-1 px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 font-mono font-bold focus:outline-none focus:ring-1 focus:ring-sky-500 cursor-pointer"
                    >
                      <option value="">
                        — Pilih API Endpoint yang Tersimpan —
                      </option>
                      {storedEndpoints.map((ep) => (
                        <option key={ep.url} value={ep.url}>
                          {ep.label} ({ep.url})
                        </option>
                      ))}
                    </select>
                    <button
                      type="button"
                      onClick={() => scanEndpointForNewPms(newPmEndpoint)}
                      disabled={isVerifying || !newPmEndpoint.trim()}
                      className="px-4 py-2 rounded-xl bg-sky-500 hover:bg-sky-600 disabled:opacity-50 text-white text-xs font-bold transition flex items-center gap-1.5 cursor-pointer flex-shrink-0"
                      title="Cek ulang daftar PM baru yang belum terdaftar pada endpoint ini"
                    >
                      {isVerifying ? (
                        <>
                          <span className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
                          <span>Memindai...</span>
                        </>
                      ) : (
                        <>
                          <span>🔄</span>
                          <span>Cek Ulang Endpoint</span>
                        </>
                      )}
                    </button>
                  </div>
                  <span className="text-[10px] text-slate-400 mt-1 block">
                    Pilih dari opsi endpoint yang tersimpan di sistem. Sistem otomatis mengecek apakah ada PM baru yang belum terdaftar di database &amp; website.
                  </span>
                </div>

                {/* PM ID Dropdown (Populated automatically from unregistered PMs on the selected endpoint; empty if none) */}
                <div>
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                    PM ID <span className="text-rose-500">*</span>
                  </label>
                  <select
                    required
                    value={newPmId}
                    onChange={(e) => handleSelectPmId(e.target.value)}
                    disabled={!newPmEndpoint || isVerifying || unregisteredPms.length === 0}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 font-mono font-bold focus:outline-none focus:ring-1 focus:ring-sky-500 disabled:opacity-60 disabled:cursor-not-allowed cursor-pointer"
                  >
                    {!newPmEndpoint ? (
                      <option value="">— Pilih API Endpoint terlebih dahulu —</option>
                    ) : isVerifying ? (
                      <option value="">Memeriksa PM baru di endpoint...</option>
                    ) : unregisteredPms.length === 0 ? (
                      <option value=""></option>
                    ) : (
                      unregisteredPms.map((pm) => (
                        <option key={pm.pm_id} value={pm.pm_id}>
                          {pm.pm_id}
                          {pm.initialValues?.activePower !== null && pm.initialValues?.activePower !== undefined
                            ? ` (${pm.initialValues.activePower} kW)`
                            : ""}
                        </option>
                      ))
                    )}
                  </select>
                  <span className="text-[10px] text-slate-400 mt-1 block">
                    {!newPmEndpoint
                      ? "Opsi PM ID akan muncul otomatis setelah Anda memilih API Endpoint URL."
                      : isVerifying
                      ? "Sedang mengecek daftar PM baru pada endpoint..."
                      : unregisteredPms.length > 0
                      ? `Ditemukan ${unregisteredPms.length} PM baru yang belum terdaftar pada endpoint ini.`
                      : "Tidak ada PM baru yang belum terdaftar pada endpoint ini (dropdown kosong)."}
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
                    !verifyResult.success
                      ? "border-rose-500/30 bg-rose-500/10 text-rose-700 dark:text-rose-300"
                      : verifyResult.hasNewPms
                      ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
                      : "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300"
                  }`}
                >
                  <div className="flex items-center gap-2 font-bold">
                    <span>
                      {!verifyResult.success ? "⚠️" : verifyResult.hasNewPms ? "✓" : "ℹ️"}
                    </span>
                    <span>{verifyResult.message}</span>
                  </div>

                  {verifyResult.success && verifyResult.hasNewPms && verifyResult.detectedFields && (
                    <div className="pt-2 border-t border-emerald-500/20 space-y-1.5">
                      <div className="flex items-center gap-2 text-[11px]">
                        <span className="font-bold">Parameter Terdeteksi ({newPmId}):</span>
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
                  disabled={
                    isSubmitting ||
                    isVerifying ||
                    !newPmId.trim() ||
                    !newPmLabel.trim() ||
                    !newPmEndpoint.trim()
                  }
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
