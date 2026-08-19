import { useEffect, useState, useMemo, useCallback } from "react";
import { useLocation } from "react-router-dom";
import { PageHeader } from "../../components/ui/PageHeader";
import { Line, Radar } from "react-chartjs-2";
import "../../components/charts/chartjs";
import { getJson, postJson } from "../../services/api.client";
import { getSocket } from "../../services/socket.service";
import { useSystemStore } from "../../store/system.store";
import { ApiSourcesPanel } from "../machines/MachineConfig";

/* ═══════════ CONSTANTS & HELPERS ═══════════ */
const formatCurrency = (value: number) =>
  new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value);

const DEFAULT_API_URLS: Record<string, string> = {
  pln: "http://10.3.164.3:8088/system/webdev/Utility_Dashboard/electric_pln",
  fact1: "http://10.3.164.3:8088/system/webdev/Utility_Dashboard/electric_wf1",
  fact2: "http://10.3.164.3:8088/system/webdev/Utility_Dashboard/electric_wf2"
};

const DEFAULT_JSON_KEYS: Record<string, string> = {
  voltage: "Volt_LL",
  frequency: "Frequency",
  active_power: "Active_Power",
  power_factor: "Power_Factor",
  reactive_power: "Reactive_Power_Total",
  apparent_power: "Apparent_Power_Total",
  unbalance_v: "Volatage_Unbalance",
  unbalance_i: "Current_Unbalance",
  v_r: "VoltAB",
  v_s: "VoltBC",
  v_t: "VoltCA",
  i_r: "Current_A",
  i_s: "Current_B",
  i_t: "Current_C",
  thd_v_r: "THD_Volt_A",
  thd_v_s: "THD_Volt_B",
  thd_v_t: "THD_Volt_C",
  thd_i_r: "THD_Current_A",
  thd_i_s: "THD_Current_B",
  thd_i_t: "THD_Current_C"
};

// Event logs mock data matching the mockup
const MOCK_EVENTS: any[] = [];

/* ═══════════ CUSTOM GAUGE COMPONENT ═══════════ */
function UnbalancedGauge({
  label,
  value,
  maxAllowed,
  isDark
}: {
  label: string;
  value: number | string;
  maxAllowed: number;
  isDark: boolean;
}) {
  const isOffline = typeof value === "string" && (value.includes("API") || value === "xx" || value.includes("xx") || value.includes("TIDAK"));
  const numVal = isOffline ? 0 : Number(value) || 0;
  
  const percentage = Math.min(100, (numVal / maxAllowed) * 100);
  const radius = 50;
  const strokeWidth = 10;
  const circumference = 2 * Math.PI * radius;
  // Semi-circle gauge (180 degrees)
  const strokeDashoffset = circumference - (percentage / 100) * (circumference / 2);

  return (
    <div className="flex flex-col items-center justify-between p-5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm relative h-full">
      <div className="text-center">
        <h4 className="text-[11px] font-extrabold uppercase tracking-wider text-slate-400 dark:text-slate-500">{label}</h4>
        <p className="text-[10px] text-slate-400 dark:text-slate-600 mt-0.5">Maks. {maxAllowed}%</p>
      </div>

      {/* SVG Semi-Circle Gauge */}
      <div className="relative mt-4 flex items-center justify-center" style={{ width: 140, height: 80 }}>
        <svg width="120" height="70" viewBox="0 0 120 70" className="overflow-visible">
          {/* Background Arc */}
          <path
            d="M 10 60 A 50 50 0 0 1 110 60"
            fill="none"
            stroke={isDark ? "#1e293b" : "#f1f5f9"}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
          />
          {/* Progress Arc */}
          {!isOffline && (
            <path
              d="M 10 60 A 50 50 0 0 1 110 60"
              fill="none"
              stroke={numVal > maxAllowed ? "#ef4444" : "#10b981"}
              strokeWidth={strokeWidth}
              strokeDasharray={circumference / 2}
              strokeDashoffset={strokeDashoffset}
              strokeLinecap="round"
              className="transition-all duration-1000 ease-out"
            />
          )}
        </svg>
        <div className="absolute bottom-2 text-center flex flex-col items-center justify-center w-full px-1">
          {isOffline ? (
            <span className="text-[9px] font-bold font-mono text-red-500 uppercase leading-none text-center select-none break-all">{value}</span>
          ) : (
            <div>
              <span className="text-2xl font-extrabold font-mono text-slate-800 dark:text-white">{numVal.toFixed(2)}</span>
              <span className="text-xs font-bold text-slate-400 ml-0.5">%</span>
            </div>
          )}
        </div>
      </div>

      {isOffline ? (
        <div className="w-full mt-4 py-1.5 rounded-lg text-center bg-red-500/10 border border-red-500/20 text-[10px] font-extrabold uppercase text-red-500 tracking-wider">
          ✕ API TIDAK AKTIF
        </div>
      ) : numVal > maxAllowed ? (
        <div className="w-full mt-4 py-1.5 rounded-lg text-center bg-red-500/10 border border-red-500/20 text-[10px] font-extrabold uppercase text-red-500 tracking-wider">
          ⚠ MELEBIHI BATAS
        </div>
      ) : (
        <div className="w-full mt-4 py-1.5 rounded-lg text-center bg-emerald-500/10 border border-emerald-500/20 text-[10px] font-extrabold uppercase text-emerald-500 tracking-wider">
          ✓ Dalam batas normal
        </div>
      )}
    </div>
  );
}

/* ═══════════ MAIN COMPONENT ═══════════ */
export default function IncomingPln() {
  const theme = useSystemStore((state) => state.theme);
  const isDark = theme === "dark";
  const location = useLocation();

  // Standards configuration state
  const [standards, setStandards] = useState({
    voltageNominal: 20.0,
    voltageTolerance: 5.0,
    frequencyNominal: 50.0,
    frequencyTolerance: 0.5,
    activePowerMax: 0,
    reactivePowerMax: 0,
    apparentPowerMax: 0,
    powerFactorMin: 0.85,
    unbalanceVMax: 2.0,
    unbalanceIMax: 10.0,
    thdVoltageMax: 5.0,
    thdCurrentMax: 8.0
  });

  const [showConfigModal, setShowConfigModal] = useState(false);
  const [showConfigPanel, setShowConfigPanel] = useState(false);
  const [savingConfig, setSavingConfig] = useState(false);

  // Form temporary state inside config modal
  const [formStds, setFormStds] = useState(standards);

  // Load standards from Postgres config
  useEffect(() => {
    getJson<{ data: any[] }>("/config/electricity?configType=sumber_utama_standards")
      .then((res) => {
        if (res?.data && res.data.length > 0) {
          const stored = res.data.find(item => item.config_key === "standards");
          if (stored && stored.value) {
            setStandards(stored.value);
            setFormStds(stored.value);
          }
        }
      })
      .catch((err) => console.error("Failed to load PLN standards:", err));
  }, []);

  const handleOpenConfig = () => {
    setFormStds(standards);
    setShowConfigModal(true);
  };

  const handleSaveStandards = async () => {
    setSavingConfig(true);
    try {
      await postJson("/config/electricity", {
        config_type: "sumber_utama_standards",
        config_key: "standards",
        label: "Incoming PLN Standards",
        value: formStds,
        sort_order: 0,
        enabled: true
      });
      setStandards(formStds);
      setShowConfigModal(false);
    } catch (err) {
      console.error(err);
      alert("Failed to save standard settings.");
    } finally {
      setSavingConfig(false);
    }
  };

  // Determine current mode based on route URL
  const mode = useMemo(() => {
    if (location.pathname.endsWith("incoming-fact-1")) return "fact1";
    if (location.pathname.endsWith("incoming-fact-2")) return "fact2";
    return "pln";
  }, [location.pathname]);

  // Configure parameters and device IDs dynamically
  const config = useMemo(() => {
    if (mode === "fact1") {
      return {
        title: "Incoming Fact-1 20 kV — Feeder WF1",
        connectedLabel: "FACT-1 CONNECTED",
        deviceId: "Feeder_WF1_PM5560",
        activePowerBase: 0,
        voltageBase: 0,
        pfBase: 0,
        reactiveBase: 0,
        apparentBase: 0,
        unbalanceVBase: 0,
        unbalanceIBase: 0
      };
    }
    if (mode === "fact2") {
      return {
        title: "Incoming Fact-2 20 kV — Feeder WF2",
        connectedLabel: "FACT-2 CONNECTED",
        deviceId: "Feeder_WF2_PM5500",
        activePowerBase: 0,
        voltageBase: 0,
        pfBase: 0,
        reactiveBase: 0,
        apparentBase: 0,
        unbalanceVBase: 0,
        unbalanceIBase: 0
      };
    }
    // Default PLN
    return {
      title: "Incoming PLN 20 kV — Sumber Utama",
      connectedLabel: "PLN CONNECTED",
      deviceId: "Cubicle_PLN_PM8000",
      activePowerBase: 0,
      voltageBase: 0,
      pfBase: 0,
      reactiveBase: 0,
      apparentBase: 0,
      unbalanceVBase: 0,
      unbalanceIBase: 0
    };
  }, [mode]);

  const [loading, setLoading] = useState(true);
  const [realtimeData, setRealtimeData] = useState<any>(null);

  const [apiSourceUrls, setApiSourceUrls] = useState<Record<string, string>>({});
  const [jsonKeyMap, setJsonKeyMap] = useState<Record<string, string>>({});
  const [apiLiveData, setApiLiveData] = useState<Record<string, any>>({});

  // Sync API configurations for this incoming grid device
  useEffect(() => {
    getJson<{ success: boolean; rows?: any[] | null }>(
      `/config/api-sources-map?unitId=${config.deviceId}`
    )
      .then((res) => {
        if (res && res.success && res.rows) {
          const urls: Record<string, string> = {};
          const keys: Record<string, string> = {};
          res.rows.forEach((row: any) => {
            if (row.tagKey) {
              urls[row.tagKey] = row.url || "";
              keys[row.tagKey] = row.jsonKey || "";
            }
          });
          setApiSourceUrls(urls);
          setJsonKeyMap(keys);
        } else {
          // If no custom config in DB, fallback to empty to correctly trigger "BELUM ADA API" or custom defaults
          setApiSourceUrls({});
          setJsonKeyMap({});
        }
      })
      .catch((err) => {
        console.error("Failed to load API sources for Incoming:", err);
        setApiSourceUrls({});
        setJsonKeyMap({});
      });
  }, [config.deviceId]);

  // Poll active URLs
  useEffect(() => {
    let isMounted = true;
    const fetchActiveApiData = async () => {
      const defaultUrl = DEFAULT_API_URLS[mode] || "";
      const uniqueUrls = Array.from(new Set([...Object.values(apiSourceUrls), defaultUrl].filter((u) => u && u.trim())));
      if (uniqueUrls.length === 0) {
        if (isMounted) setApiLiveData({});
        return;
      }

      const aggregatedData: Record<string, any> = {};
      await Promise.all(
        uniqueUrls.map(async (url) => {
          try {
            const res = await postJson<{ success: boolean; data?: any }>("/config/api-sources/test", {
              url,
              method: "GET"
            });
            if (res && res.success && res.data) {
              aggregatedData[url] = res.data;
            }
          } catch (err) {
            console.error(`Live API poll error on Incoming for URL ${url}:`, err);
          }
        })
      );

      if (isMounted) {
        setApiLiveData(aggregatedData);
      }
    };

    fetchActiveApiData();
    const interval = setInterval(fetchActiveApiData, 1000);
    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [apiSourceUrls, mode]);

  const getApiVal = useCallback((tagKey: string) => {
    const rawKey = tagKey.includes("/") ? tagKey.split("/")[1] : tagKey;
    const defaultUrl = DEFAULT_API_URLS[mode] || "";
    const url = apiSourceUrls[tagKey] || defaultUrl;
    const jsonKey = jsonKeyMap[tagKey] || DEFAULT_JSON_KEYS[rawKey] || rawKey;

    if (url && apiLiveData[url]) {
      let val = apiLiveData[url][jsonKey];
      if (val === undefined && rawKey === "active_power") {
        val = apiLiveData[url]["Active_Power_Total"] ?? apiLiveData[url]["active_power_total"] ?? apiLiveData[url]["Active_Power"];
      }
      if (val === undefined && rawKey === "voltage") {
        val = apiLiveData[url]["Volt_LL"] ?? apiLiveData[url]["volt_ll"];
      }
      if (val === undefined && rawKey === "unbalance_v") {
        val = apiLiveData[url]["Voltage_Unbalance"] ?? apiLiveData[url]["voltage_unbalance"] ?? apiLiveData[url]["Volatage_Unbalance"];
      }
      if (val === undefined && rawKey === "unbalance_i") {
        val = apiLiveData[url]["Current_Unbalance"] ?? apiLiveData[url]["current_unbalance"];
      }

      if (val !== undefined && val !== null) {
        // Power parameters (convert Watts to kW/kVAR/kVA if large)
        if (rawKey === "active_power" || rawKey === "reactive_power" || rawKey === "apparent_power") {
          if (typeof val === "number" && val > 10000) val = val / 1000.0;
        }
        // Voltage LL (convert Volts to kV)
        if (rawKey === "voltage" && typeof val === "number" && val > 1000) {
          val = val / 1000.0;
        }
        // Voltage L-N (convert Volts to kV L-N)
        if ((rawKey === "v_r" || rawKey === "v_s" || rawKey === "v_t") && typeof val === "number" && val > 1000) {
          val = (val / Math.sqrt(3)) / 1000.0;
        }
        // Unbalances & THD (convert decimal 0.0055 to %)
        if ((rawKey.startsWith("unbalance_") || rawKey.startsWith("thd_")) && typeof val === "number" && val < 1.0) {
          val = val * 100.0;
        }
        // Power factor convert negative to positive
        if (rawKey === "power_factor" && typeof val === "number") {
          val = Math.abs(val);
        }
        return val;
      }
    }

    // Fallback to metrics from backend WebSocket
    if (metrics) {
      if (rawKey === "voltage" && metrics.voltage > 0) return metrics.voltage;
      if (rawKey === "frequency" && metrics.frequency > 0) return metrics.frequency;
      if (rawKey === "active_power" && metrics.activePower > 0) return metrics.activePower;
      if (rawKey === "power_factor" && metrics.powerFactor !== 0) return Math.abs(metrics.powerFactor);
      if (rawKey === "reactive_power" && metrics.reactivePower > 0) return metrics.reactivePower;
      if (rawKey === "apparent_power" && metrics.apparentPower > 0) return metrics.apparentPower;
      if (rawKey === "unbalance_v" && metrics.unbalanceV > 0) return metrics.unbalanceV;
      if (rawKey === "unbalance_i" && metrics.unbalanceI > 0) return metrics.unbalanceI;
      if (rawKey === "v_r" && metrics.vR > 0) return metrics.vR;
      if (rawKey === "v_s" && metrics.vS > 0) return metrics.vS;
      if (rawKey === "v_t" && metrics.vT > 0) return metrics.vT;
      if (rawKey === "i_r" && metrics.iR > 0) return metrics.iR;
      if (rawKey === "i_s" && metrics.iS > 0) return metrics.iS;
      if (rawKey === "i_t" && metrics.iT > 0) return metrics.iT;
      if (rawKey === "thd_v_r" && metrics.thdV_R > 0) return metrics.thdV_R;
      if (rawKey === "thd_v_s" && metrics.thdV_S > 0) return metrics.thdV_S;
      if (rawKey === "thd_v_t" && metrics.thdV_T > 0) return metrics.thdV_T;
      if (rawKey === "thd_i_r" && metrics.thdI_R > 0) return metrics.thdI_R;
      if (rawKey === "thd_i_s" && metrics.thdI_S > 0) return metrics.thdI_S;
      if (rawKey === "thd_i_t" && metrics.thdI_T > 0) return metrics.thdI_T;
    }

    if (!url.trim()) return "BELUM ADA API";
    return "API TIDAK TERKIRIM";
  }, [mode, apiSourceUrls, jsonKeyMap, apiLiveData, metrics]);

  const isOfflineVal = useCallback((val: any) => {
    return val === "BELUM ADA API" || val === "API TIDAK TERKIRIM" || val === "xx";
  }, []);

  // Real-time metrics states
  const [metrics, setMetrics] = useState({
    voltage: 0,
    frequency: 0,
    activePower: 0,
    powerFactor: 0,
    reactivePower: 0,
    apparentPower: 0,
    unbalanceV: 0,
    unbalanceI: 0,
    // Phase values
    vR: 0, vS: 0, vT: 0,
    iR: 0, iS: 0, iT: 0,
    thdV_R: 0, thdV_S: 0, thdV_T: 0,
    thdI_R: 0, thdI_S: 0, thdI_T: 0,
    isConnected: true
  });

  const [voltageTrend, setVoltageTrend] = useState<{ hour: string; value: number }[]>([]);
  const [activePowerTrend, setActivePowerTrend] = useState<{ hour: string; value: number }[]>([]);

  // Event & alarm logs
  const [events, setEvents] = useState(MOCK_EVENTS);

  // Load database analytics fallback
  const fetchTelemetry = () => {
    getJson<{ data: any }>(`/analytics/electricity?deviceId=${config.deviceId}`)
      .then((res) => {
        if (res?.data?.pqData) {
          const pq = res.data.pqData;
          setMetrics((prev) => ({
            ...prev,
            voltage: pq.voltage !== undefined ? pq.voltage : prev.voltage,
            frequency: pq.freq !== undefined ? pq.freq : (pq.frequency !== undefined ? pq.frequency : prev.frequency),
            activePower: pq.activePower !== undefined ? pq.activePower : prev.activePower,
            powerFactor: pq.pf !== undefined && pq.pf !== null ? pq.pf : prev.powerFactor,
            reactivePower: pq.reactivePower !== undefined ? pq.reactivePower : prev.reactivePower,
            apparentPower: pq.apparentPower !== undefined ? pq.apparentPower : prev.apparentPower,
            unbalanceV: pq.vUnb !== undefined ? pq.vUnb : prev.unbalanceV,
            unbalanceI: pq.iUnb !== undefined ? pq.iUnb : prev.unbalanceI,
            vR: pq.vR !== undefined ? pq.vR : prev.vR,
            vS: pq.vS !== undefined ? pq.vS : prev.vS,
            vT: pq.vT !== undefined ? pq.vT : prev.vT,
            iR: pq.iR !== undefined ? pq.iR : prev.iR,
            iS: pq.iS !== undefined ? pq.iS : prev.iS,
            iT: pq.iT !== undefined ? pq.iT : prev.iT,
            thdV_R: pq.thdV_R !== undefined ? pq.thdV_R : prev.thdV_R,
            thdV_S: pq.thdV_S !== undefined ? pq.thdV_S : prev.thdV_S,
            thdV_T: pq.thdV_T !== undefined ? pq.thdV_T : prev.thdV_T,
            thdI_R: pq.thdI_R !== undefined ? pq.thdI_R : prev.thdI_R,
            thdI_S: pq.thdI_S !== undefined ? pq.thdI_S : prev.thdI_S,
            thdI_T: pq.thdI_T !== undefined ? pq.thdI_T : prev.thdI_T,
            isConnected: pq.pfStatus === "connected"
          }));
        }
        if (res?.data?.charts) {
          const charts = res.data.charts;
          if (charts.voltage24h) setVoltageTrend(charts.voltage24h);
          if (charts.activePower24h) setActivePowerTrend(charts.activePower24h);
        }
        setLoading(false);
      })
      .catch((err) => {
        console.error(`Failed to load incoming ${mode} telemetry`, err);
        setLoading(false);
      });
  };

  // Reset/update metrics when config changes
  useEffect(() => {
    setMetrics({
      voltage: config.voltageBase,
      frequency: 0,
      activePower: config.activePowerBase,
      powerFactor: config.pfBase,
      reactivePower: config.reactiveBase,
      apparentPower: config.apparentBase,
      unbalanceV: config.unbalanceVBase,
      unbalanceI: config.unbalanceIBase,
      vR: 0,
      vS: 0,
      vT: 0,
      iR: 0,
      iS: 0,
      iT: 0,
      thdV_R: 0, thdV_S: 0, thdV_T: 0,
      thdI_R: 0, thdI_S: 0, thdI_T: 0,
      isConnected: true
    });
  }, [config]);

  useEffect(() => {
    fetchTelemetry();
    const interval = setInterval(fetchTelemetry, 1000);
    return () => clearInterval(interval);
  }, [config]);

  // Handle socket updates fallback
  useEffect(() => {
    const socket = getSocket();
    
    const handleLiveUpdate = (payload: any) => {
      if (payload && payload.deviceId === config.deviceId && payload.pqData) {
        const pq = payload.pqData;
        setMetrics((prev) => ({
          ...prev,
          voltage: pq.voltage !== undefined ? pq.voltage : prev.voltage,
          frequency: pq.freq !== undefined ? pq.freq : prev.frequency,
          activePower: pq.activePower !== undefined ? pq.activePower : prev.activePower,
          powerFactor: pq.pf !== undefined && pq.pf !== null ? pq.pf : prev.powerFactor,
          reactivePower: pq.reactivePower !== undefined ? pq.reactivePower : prev.reactivePower,
          apparentPower: pq.apparentPower !== undefined ? pq.apparentPower : prev.apparentPower,
          unbalanceV: pq.vUnb !== undefined ? pq.vUnb : prev.unbalanceV,
          unbalanceI: pq.iUnb !== undefined ? pq.iUnb : prev.unbalanceI,
          vR: pq.vR !== undefined ? pq.vR : prev.vR,
          vS: pq.vS !== undefined ? pq.vS : prev.vS,
          vT: pq.vT !== undefined ? pq.vT : prev.vT,
          iR: pq.iR !== undefined ? pq.iR : prev.iR,
          iS: pq.iS !== undefined ? pq.iS : prev.iS,
          iT: pq.iT !== undefined ? pq.iT : prev.iT,
          thdV_R: pq.thdV_R !== undefined ? pq.thdV_R : prev.thdV_R,
          thdV_S: pq.thdV_S !== undefined ? pq.thdV_S : prev.thdV_S,
          thdV_T: pq.thdV_T !== undefined ? pq.thdV_T : prev.thdV_T,
          thdI_R: pq.thdI_R !== undefined ? pq.thdI_R : prev.thdI_R,
          thdI_S: pq.thdI_S !== undefined ? pq.thdI_S : prev.thdI_S,
          thdI_T: pq.thdI_T !== undefined ? pq.thdI_T : prev.thdI_T,
          isConnected: pq.pfStatus === "connected"
        }));
      }
    };

    socket.on("electricity:live_update", handleLiveUpdate);
    return () => {
      socket.off("electricity:live_update", handleLiveUpdate);
    };
  }, [config.deviceId]);

  const prefix = mode === "pln" ? "pln" : mode === "fact1" ? "wf1" : "wf2";

  const liveMetrics = useMemo(() => {
    return {
      voltage: getApiVal(`${prefix}/voltage`),
      frequency: getApiVal(`${prefix}/frequency`),
      activePower: getApiVal(`${prefix}/active_power`),
      powerFactor: getApiVal(`${prefix}/power_factor`),
      reactivePower: getApiVal(`${prefix}/reactive_power`),
      apparentPower: getApiVal(`${prefix}/apparent_power`),
      unbalanceV: getApiVal(`${prefix}/unbalance_v`),
      unbalanceI: getApiVal(`${prefix}/unbalance_i`),
      vR: getApiVal(`${prefix}/v_r`),
      vS: getApiVal(`${prefix}/v_s`),
      vT: getApiVal(`${prefix}/v_t`),
      iR: getApiVal(`${prefix}/i_r`),
      iS: getApiVal(`${prefix}/i_s`),
      iT: getApiVal(`${prefix}/i_t`),
      thdV_R: getApiVal(`${prefix}/thd_v_r`),
      thdV_S: getApiVal(`${prefix}/thd_v_s`),
      thdV_T: getApiVal(`${prefix}/thd_v_t`),
      thdI_R: getApiVal(`${prefix}/thd_i_r`),
      thdI_S: getApiVal(`${prefix}/thd_i_s`),
      thdI_T: getApiVal(`${prefix}/thd_i_t`),
      isConnected: getApiVal(`${prefix}/active_power`) !== "BELUM ADA API" && getApiVal(`${prefix}/active_power`) !== "API TIDAK TERKIRIM"
    };
  }, [prefix, getApiVal]);

  const renderMetricVal = useCallback((val: any, formatFn: (v: number) => string) => {
    if (val === "BELUM ADA API") {
      return <span className="text-red-500 text-xs font-extrabold font-mono uppercase tracking-wider">BELUM ADA API</span>;
    }
    if (val === "API TIDAK TERKIRIM" || val === "xx") {
      return <span className="text-red-500 text-[10px] font-extrabold font-mono uppercase tracking-wider">API TIDAK TERKIRIM</span>;
    }
    const num = Number(val);
    if (isNaN(num)) {
      return <span className="text-red-500 text-[10px] font-extrabold font-mono uppercase tracking-wider">API TIDAK TERKIRIM</span>;
    }
    return formatFn(num);
  }, []);

  // Averages and stats helpers for Phase details
  const statsV = useMemo(() => {
    const vals = [liveMetrics.vR, liveMetrics.vS, liveMetrics.vT].map(v => isOfflineVal(v) ? 0 : Number(v) || 0);
    const avg = vals.reduce((a, b) => a + b, 0) / 3;
    return { avg, min: Math.min(...vals), max: Math.max(...vals) };
  }, [liveMetrics.vR, liveMetrics.vS, liveMetrics.vT, isOfflineVal]);

  const statsI = useMemo(() => {
    const vals = [liveMetrics.iR, liveMetrics.iS, liveMetrics.iT].map(v => isOfflineVal(v) ? 0 : Number(v) || 0);
    const avg = vals.reduce((a, b) => a + b, 0) / 3;
    return { avg, min: Math.min(...vals), max: Math.max(...vals) };
  }, [liveMetrics.iR, liveMetrics.iS, liveMetrics.iT, isOfflineVal]);

  const statsThdV = useMemo(() => {
    const vals = [liveMetrics.thdV_R, liveMetrics.thdV_S, liveMetrics.thdV_T].map(v => isOfflineVal(v) ? 0 : Number(v) || 0);
    const avg = vals.reduce((a, b) => a + b, 0) / 3;
    return { avg, min: Math.min(...vals), max: Math.max(...vals) };
  }, [liveMetrics.thdV_R, liveMetrics.thdV_S, liveMetrics.thdV_T, isOfflineVal]);

  const statsThdI = useMemo(() => {
    const vals = [liveMetrics.thdI_R, liveMetrics.thdI_S, liveMetrics.thdI_T].map(v => isOfflineVal(v) ? 0 : Number(v) || 0);
    const avg = vals.reduce((a, b) => a + b, 0) / 3;
    return { avg, min: Math.min(...vals), max: Math.max(...vals) };
  }, [liveMetrics.thdI_R, liveMetrics.thdI_S, liveMetrics.thdI_T, isOfflineVal]);

  // Radar PQ index chart data
  const radarData = useMemo(() => {
    const numVoltage = isOfflineVal(liveMetrics.voltage) ? 0 : Number(liveMetrics.voltage) || 0;
    const numPf = isOfflineVal(liveMetrics.powerFactor) ? 0 : Number(liveMetrics.powerFactor) || 0;
    const numFrequency = isOfflineVal(liveMetrics.frequency) ? 0 : Number(liveMetrics.frequency) || 0;
    const avgCurrent = statsI.avg;
    const avgThdV = statsThdV.avg;
    const avgThdI = statsThdI.avg;
    return {
      labels: ["Voltage", "Current", "PF", "Freq", "THD-V", "THD-I"],
      datasets: [
        {
          label: "Daya Aktual",
          data: [
            config.voltageBase > 0 ? (numVoltage / config.voltageBase) * 100 : 0,
            avgCurrent > 0 ? 95 : 0,
            numPf * 100,
            (numFrequency / 50) * 100,
            Math.max(0, 100 - avgThdV),
            Math.max(0, 100 - avgThdI)
          ],
          backgroundColor: "rgba(56, 189, 248, 0.25)",
          borderColor: "#38bdf8",
          borderWidth: 1.5,
          pointBackgroundColor: "#38bdf8",
          pointBorderColor: "#fff",
          pointHoverBackgroundColor: "#fff",
          pointHoverBorderColor: "#38bdf8"
        }
      ]
    };
  }, [liveMetrics, statsI.avg, statsThdV.avg, statsThdI.avg, config.voltageBase, isOfflineVal]);

  const isConnected = !isOfflineVal(liveMetrics.voltage) || !isOfflineVal(liveMetrics.activePower);
  const radarOptions: any = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false }
    },
    scales: {
      r: {
        grid: { color: isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.06)" },
        angleLines: { color: isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.06)" },
        pointLabels: {
          color: isDark ? "#94a3b8" : "#475569",
          font: { size: 10, weight: "700" }
        },
        ticks: { display: false }
      }
    }
  };

  // 24 Hour Line Trend Data
  const trendLabels = useMemo(() => Array.from({ length: 24 }, (_, i) => `${i.toString().padStart(2, "0")}:00`), []);

  const voltageTrendData = useMemo(() => {
    const dataMap = new Map(voltageTrend.map(item => [item.hour, item.value]));
    const dataPoints = trendLabels.map(label => dataMap.get(label) ?? null);
    const hasData = voltageTrend.length > 0;
    
    return {
      labels: trendLabels,
      datasets: [
        {
          label: "Tegangan (kV)",
          data: hasData ? dataPoints : [],
          borderColor: "#eab308",
          backgroundColor: "rgba(234, 179, 8, 0.05)",
          tension: 0.3,
          borderWidth: 2,
          pointRadius: 0
        }
      ]
    };
  }, [voltageTrend, trendLabels]);

  const activePowerTrendData = useMemo(() => {
    const dataMap = new Map(activePowerTrend.map(item => [item.hour, item.value]));
    const dataPoints = trendLabels.map(label => dataMap.get(label) ?? null);
    const hasData = activePowerTrend.length > 0;
    
    return {
      labels: trendLabels,
      datasets: [
        {
          label: "Daya Aktif (kW)",
          data: hasData ? dataPoints : [],
          borderColor: "#10b981",
          backgroundColor: "rgba(16, 185, 129, 0.05)",
          tension: 0.3,
          borderWidth: 2,
          pointRadius: 0
        }
      ]
    };
  }, [activePowerTrend, trendLabels]);

  const lineOptions = (title: string, color: string, unit: string) => ({
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      title: {
        display: true,
        text: title,
        color: isDark ? "#94a3b8" : "#475569",
        align: "start" as const,
        font: { size: 11, weight: "bold" as const }
      }
    },
    scales: {
      x: { grid: { display: false }, ticks: { color: "#64748b", font: { size: 8 } } },
      y: {
        grid: { color: isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.04)" },
        ticks: { color: "#64748b", font: { size: 8 } }
      }
    }
  });

  return (
    <div className="space-y-6">
      {/* HEADER SECTION */}
      <div className="flex items-center justify-between">
        <PageHeader
          title={config.title}
          description={`Monitoring real-time parameter kelistrikan ${config.title} - Update setiap 3 detik`}
        />
        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowConfigPanel(true)}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition shadow-sm"
          >
            🔌 API Sources Config
          </button>
          <button
            onClick={handleOpenConfig}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-xs font-bold text-slate-600 dark:text-slate-300 transition border border-slate-200 dark:border-slate-700 shadow-sm"
          >
            ⚙️ Config Standar
          </button>
          <span className={`px-3 py-1.5 rounded-full text-xs font-extrabold uppercase flex items-center gap-1.5 border transition-colors duration-300 ${
            isConnected
              ? "bg-emerald-500/10 text-emerald-500 border-emerald-500/20"
              : "bg-rose-500/10 text-rose-500 border-rose-500/20"
          }`}>
            <span className={`h-2 w-2 rounded-full animate-pulse ${
              isConnected ? "bg-emerald-500" : "bg-rose-500"
            }`} />
            {isConnected ? config.connectedLabel : "DISCONNECTED"}
          </span>
        </div>
      </div>

      {/* ═══════════ SECTION A: SIX METRIC CARDS ═══════════ */}
      <section className="grid gap-4 grid-cols-2 md:grid-cols-3 lg:grid-cols-6">
        {/* Tegangan */}
        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-400 dark:text-slate-500">
            <span className="text-[10px] font-extrabold uppercase tracking-wider">Tegangan</span>
            <svg className="h-4 w-4 text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
          </div>
          <div className="mt-4">
            <div className="text-base md:text-xl font-extrabold font-mono text-slate-800 dark:text-white">
              {renderMetricVal(liveMetrics.voltage, (v) => `${v.toFixed(2)} kV`)}
            </div>
            <p className="text-[9px] text-slate-400 mt-1">Nominal: 20 kV</p>
          </div>
        </div>

        {/* Frekuensi */}
        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-400 dark:text-slate-500">
            <span className="text-[10px] font-extrabold uppercase tracking-wider">Frekuensi</span>
            <svg className="h-4 w-4 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 12h14M12 5l7 7-7 7" />
            </svg>
          </div>
          <div className="mt-4">
            <div className="text-base md:text-xl font-extrabold font-mono text-slate-800 dark:text-white">
              {renderMetricVal(liveMetrics.frequency, (v) => `${v.toFixed(2)} Hz`)}
            </div>
            <p className="text-[9px] text-slate-400 mt-1">Nominal: 50 Hz</p>
          </div>
        </div>

        {/* Active Power */}
        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-400 dark:text-slate-500">
            <span className="text-[10px] font-extrabold uppercase tracking-wider">Active Power</span>
            <svg className="h-4 w-4 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 002 2h2a2 2 0 002-2z" />
            </svg>
          </div>
          <div className="mt-4">
            <div className="text-base md:text-xl font-extrabold font-mono text-slate-800 dark:text-white">
              {renderMetricVal(liveMetrics.activePower, (v) => `${v.toLocaleString("id-ID")} kW`)}
            </div>
            <p className="text-[9px] text-slate-400 mt-1">Total daya aktif</p>
          </div>
        </div>

        {/* Power Factor */}
        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-400 dark:text-slate-500">
            <span className="text-[10px] font-extrabold uppercase tracking-wider">Power Factor</span>
            <svg className="h-4 w-4 text-cyan-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <div className="mt-4">
            <div className="text-base md:text-xl font-extrabold font-mono text-slate-800 dark:text-white">
              {renderMetricVal(liveMetrics.powerFactor, (v) => `${v.toFixed(3)} PF`)}
            </div>
            <p className="text-[9px] text-emerald-500 font-bold mt-1">Good</p>
          </div>
        </div>

        {/* Reactive Power */}
        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-400 dark:text-slate-500">
            <span className="text-[10px] font-extrabold uppercase tracking-wider">Reactive Power</span>
            <svg className="h-4 w-4 text-purple-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
            </svg>
          </div>
          <div className="mt-4">
            <div className="text-base md:text-xl font-extrabold font-mono text-slate-800 dark:text-white">
              {renderMetricVal(liveMetrics.reactivePower, (v) => `${v.toLocaleString("id-ID")} kVAR`)}
            </div>
            <p className="text-[9px] text-slate-400 mt-1">Daya reaktif</p>
          </div>
        </div>

        {/* Apparent Power */}
        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-400 dark:text-slate-500">
            <span className="text-[10px] font-extrabold uppercase tracking-wider">Apparent Power</span>
            <svg className="h-4 w-4 text-indigo-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M16 8v8m-4-5v5m-4-2v2m-2 4h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
          </div>
          <div className="mt-4">
            <div className="text-base md:text-xl font-extrabold font-mono text-slate-800 dark:text-white">
              {renderMetricVal(liveMetrics.apparentPower, (v) => `${v.toLocaleString("id-ID")} kVA`)}
            </div>
            <p className="text-[9px] text-slate-400 mt-1">Daya semu</p>
          </div>
        </div>
      </section>

      {/* ═══════════ SECTION B: POWER QUALITY INDEX & GAUGES ═══════════ */}
      <section className="grid gap-6 md:grid-cols-3">
        <UnbalancedGauge label="Voltage Unbalanced" value={liveMetrics.unbalanceV} maxAllowed={standards.unbalanceVMax} isDark={isDark} />
        <UnbalancedGauge label="Current Unbalanced" value={liveMetrics.unbalanceI} maxAllowed={standards.unbalanceIMax} isDark={isDark} />

        {/* Power Quality Radar Index */}
        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-sm flex flex-col justify-between">
          <div className="text-center">
            <h4 className="text-[11px] font-extrabold uppercase tracking-wider text-slate-400 dark:text-slate-500">Power Quality Index</h4>
            <p className="text-[10px] text-slate-400 dark:text-slate-600 mt-0.5">Analisis Keseluruhan Parameter</p>
          </div>
          <div className="relative mt-2 flex items-center justify-center" style={{ height: 160 }}>
            <Radar data={radarData} options={radarOptions} />
          </div>
        </div>
      </section>

      {/* ═══════════ SECTION C: PHASE DETAILS ═══════════ */}
      <section className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
        {/* Tegangan Per Fasa */}
        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-sm flex flex-col justify-between">
          <div>
            <h4 className="text-xs font-bold text-slate-800 dark:text-white">Tegangan Per Fasa</h4>
            <p className="text-[10px] text-slate-400">Per Phase (R-S-T)</p>
          </div>

          <div className="my-4 space-y-3">
            {/* R */}
            <div className="space-y-1">
              <div className="flex justify-between text-[11px] font-bold">
                <span className="text-rose-500">R</span>
                <span className="font-mono">{renderMetricVal(liveMetrics.vR, (v) => `${v.toFixed(3)} kV`)}</span>
              </div>
              <div className="h-2 w-full rounded bg-slate-100 dark:bg-slate-800 overflow-hidden">
                <div className="h-full bg-rose-500 rounded transition-all duration-500" style={{ width: !isOfflineVal(liveMetrics.vR) && Number(liveMetrics.vR) > 0 ? `${(Number(liveMetrics.vR) / 12) * 100}%` : "0%" }} />
              </div>
            </div>
            {/* S */}
            <div className="space-y-1">
              <div className="flex justify-between text-[11px] font-bold">
                <span className="text-amber-500">S</span>
                <span className="font-mono">{renderMetricVal(liveMetrics.vS, (v) => `${v.toFixed(3)} kV`)}</span>
              </div>
              <div className="h-2 w-full rounded bg-slate-100 dark:bg-slate-800 overflow-hidden">
                <div className="h-full bg-amber-500 rounded transition-all duration-500" style={{ width: !isOfflineVal(liveMetrics.vS) && Number(liveMetrics.vS) > 0 ? `${(Number(liveMetrics.vS) / 12) * 100}%` : "0%" }} />
              </div>
            </div>
            {/* T */}
            <div className="space-y-1">
              <div className="flex justify-between text-[11px] font-bold">
                <span className="text-blue-500">T</span>
                <span className="font-mono">{renderMetricVal(liveMetrics.vT, (v) => `${v.toFixed(3)} kV`)}</span>
              </div>
              <div className="h-2 w-full rounded bg-slate-100 dark:bg-slate-800 overflow-hidden">
                <div className="h-full bg-blue-500 rounded transition-all duration-500" style={{ width: !isOfflineVal(liveMetrics.vT) && Number(liveMetrics.vT) > 0 ? `${(Number(liveMetrics.vT) / 12) * 100}%` : "0%" }} />
              </div>
            </div>
          </div>

          <div className="flex justify-between items-center text-[10px] font-bold text-slate-500 border-t border-slate-100 dark:border-slate-800/80 pt-3">
            <span>AVG: <strong className="text-slate-700 dark:text-slate-300">{statsV.avg.toFixed(3)}</strong></span>
            <span>MIN: <strong className="text-slate-700 dark:text-slate-300">{statsV.min.toFixed(3)}</strong></span>
            <span>MAX: <strong className="text-slate-700 dark:text-slate-300">{statsV.max.toFixed(3)}</strong></span>
          </div>
        </div>

        {/* Arus Per Fasa */}
        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-sm flex flex-col justify-between">
          <div>
            <h4 className="text-xs font-bold text-slate-800 dark:text-white">Arus Per Fasa</h4>
            <p className="text-[10px] text-slate-400">Per Phase (R-S-T)</p>
          </div>

          <div className="my-4 space-y-3">
            {/* R */}
            <div className="space-y-1">
              <div className="flex justify-between text-[11px] font-bold">
                <span className="text-rose-500">R</span>
                <span className="font-mono">{renderMetricVal(liveMetrics.iR, (v) => `${v.toFixed(1)} A`)}</span>
              </div>
              <div className="h-2 w-full rounded bg-slate-100 dark:bg-slate-800 overflow-hidden">
                <div className="h-full bg-rose-500 rounded transition-all duration-500" style={{ width: !isOfflineVal(liveMetrics.iR) && Number(liveMetrics.iR) > 0 ? `${Math.min(100, (Number(liveMetrics.iR) / 150) * 100)}%` : "0%" }} />
              </div>
            </div>
            {/* S */}
            <div className="space-y-1">
              <div className="flex justify-between text-[11px] font-bold">
                <span className="text-amber-500">S</span>
                <span className="font-mono">{renderMetricVal(liveMetrics.iS, (v) => `${v.toFixed(1)} A`)}</span>
              </div>
              <div className="h-2 w-full rounded bg-slate-100 dark:bg-slate-800 overflow-hidden">
                <div className="h-full bg-amber-500 rounded transition-all duration-500" style={{ width: !isOfflineVal(liveMetrics.iS) && Number(liveMetrics.iS) > 0 ? `${Math.min(100, (Number(liveMetrics.iS) / 150) * 100)}%` : "0%" }} />
              </div>
            </div>
            {/* T */}
            <div className="space-y-1">
              <div className="flex justify-between text-[11px] font-bold">
                <span className="text-blue-500">T</span>
                <span className="font-mono">{renderMetricVal(liveMetrics.iT, (v) => `${v.toFixed(1)} A`)}</span>
              </div>
              <div className="h-2 w-full rounded bg-slate-100 dark:bg-slate-800 overflow-hidden">
                <div className="h-full bg-blue-500 rounded transition-all duration-500" style={{ width: !isOfflineVal(liveMetrics.iT) && Number(liveMetrics.iT) > 0 ? `${Math.min(100, (Number(liveMetrics.iT) / 150) * 100)}%` : "0%" }} />
              </div>
            </div>
          </div>

          <div className="flex justify-between items-center text-[10px] font-bold text-slate-500 border-t border-slate-100 dark:border-slate-800/80 pt-3">
            <span>AVG: <strong className="text-slate-700 dark:text-slate-300">{statsI.avg.toFixed(1)}</strong></span>
            <span>MIN: <strong className="text-slate-700 dark:text-slate-300">{statsI.min.toFixed(1)}</strong></span>
            <span>MAX: <strong className="text-slate-700 dark:text-slate-300">{statsI.max.toFixed(1)}</strong></span>
          </div>
        </div>

        {/* THD Voltage */}
        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-sm flex flex-col justify-between">
          <div>
            <h4 className="text-xs font-bold text-slate-800 dark:text-white">THD Voltage</h4>
            <p className="text-[10px] text-slate-400">Per Phase (R-S-T)</p>
          </div>

          <div className="my-4 space-y-3">
            {/* R */}
            <div className="space-y-1">
              <div className="flex justify-between text-[11px] font-bold">
                <span className="text-rose-500">R</span>
                <span className="font-mono">{renderMetricVal(liveMetrics.thdV_R, (v) => `${v.toFixed(2)} %`)}</span>
              </div>
              <div className="h-2 w-full rounded bg-slate-100 dark:bg-slate-800 overflow-hidden">
                <div className="h-full bg-rose-500 rounded transition-all duration-500" style={{ width: !isOfflineVal(liveMetrics.thdV_R) && Number(liveMetrics.thdV_R) > 0 ? `${Math.min(100, (Number(liveMetrics.thdV_R) / 5) * 100)}%` : "0%" }} />
              </div>
            </div>
            {/* S */}
            <div className="space-y-1">
              <div className="flex justify-between text-[11px] font-bold">
                <span className="text-amber-500">S</span>
                <span className="font-mono">{renderMetricVal(liveMetrics.thdV_S, (v) => `${v.toFixed(2)} %`)}</span>
              </div>
              <div className="h-2 w-full rounded bg-slate-100 dark:bg-slate-800 overflow-hidden">
                <div className="h-full bg-amber-500 rounded transition-all duration-500" style={{ width: !isOfflineVal(liveMetrics.thdV_S) && Number(liveMetrics.thdV_S) > 0 ? `${Math.min(100, (Number(liveMetrics.thdV_S) / 5) * 100)}%` : "0%" }} />
              </div>
            </div>
            {/* T */}
            <div className="space-y-1">
              <div className="flex justify-between text-[11px] font-bold">
                <span className="text-blue-500">T</span>
                <span className="font-mono">{renderMetricVal(liveMetrics.thdV_T, (v) => `${v.toFixed(2)} %`)}</span>
              </div>
              <div className="h-2 w-full rounded bg-slate-100 dark:bg-slate-800 overflow-hidden">
                <div className="h-full bg-blue-500 rounded transition-all duration-500" style={{ width: !isOfflineVal(liveMetrics.thdV_T) && Number(liveMetrics.thdV_T) > 0 ? `${Math.min(100, (Number(liveMetrics.thdV_T) / 5) * 100)}%` : "0%" }} />
              </div>
            </div>
          </div>

          <div className="flex justify-between items-center text-[10px] font-bold text-slate-500 border-t border-slate-100 dark:border-slate-800/80 pt-3">
            <span>AVG: <strong className="text-slate-700 dark:text-slate-300">{statsThdV.avg.toFixed(2)}</strong></span>
            <span>MIN: <strong className="text-slate-700 dark:text-slate-300">{statsThdV.min.toFixed(2)}</strong></span>
            <span>MAX: <strong className="text-slate-700 dark:text-slate-300">{statsThdV.max.toFixed(2)}</strong></span>
          </div>
        </div>

        {/* THD Current */}
        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-sm flex flex-col justify-between">
          <div>
            <h4 className="text-xs font-bold text-slate-800 dark:text-white">THD Current</h4>
            <p className="text-[10px] text-slate-400">Per Phase (R-S-T)</p>
          </div>

          <div className="my-4 space-y-3">
            {/* R */}
            <div className="space-y-1">
              <div className="flex justify-between text-[11px] font-bold">
                <span className="text-rose-500">R</span>
                <span className="font-mono">{renderMetricVal(liveMetrics.thdI_R, (v) => `${v.toFixed(2)} %`)}</span>
              </div>
              <div className="h-2 w-full rounded bg-slate-100 dark:bg-slate-800 overflow-hidden">
                <div className="h-full bg-rose-500 rounded transition-all duration-500" style={{ width: !isOfflineVal(liveMetrics.thdI_R) && Number(liveMetrics.thdI_R) > 0 ? `${Math.min(100, (Number(liveMetrics.thdI_R) / 8) * 100)}%` : "0%" }} />
              </div>
            </div>
            {/* S */}
            <div className="space-y-1">
              <div className="flex justify-between text-[11px] font-bold">
                <span className="text-amber-500">S</span>
                <span className="font-mono">{renderMetricVal(liveMetrics.thdI_S, (v) => `${v.toFixed(2)} %`)}</span>
              </div>
              <div className="h-2 w-full rounded bg-slate-100 dark:bg-slate-800 overflow-hidden">
                <div className="h-full bg-amber-500 rounded transition-all duration-500" style={{ width: !isOfflineVal(liveMetrics.thdI_S) && Number(liveMetrics.thdI_S) > 0 ? `${Math.min(100, (Number(liveMetrics.thdI_S) / 8) * 100)}%` : "0%" }} />
              </div>
            </div>
            {/* T */}
            <div className="space-y-1">
              <div className="flex justify-between text-[11px] font-bold">
                <span className="text-blue-500">T</span>
                <span className="font-mono">{renderMetricVal(liveMetrics.thdI_T, (v) => `${v.toFixed(2)} %`)}</span>
              </div>
              <div className="h-2 w-full rounded bg-slate-100 dark:bg-slate-800 overflow-hidden">
                <div className="h-full bg-blue-500 rounded transition-all duration-500" style={{ width: !isOfflineVal(liveMetrics.thdI_T) && Number(liveMetrics.thdI_T) > 0 ? `${Math.min(100, (Number(liveMetrics.thdI_T) / 8) * 100)}%` : "0%" }} />
              </div>
            </div>
          </div>

          <div className="flex justify-between items-center text-[10px] font-bold text-slate-500 border-t border-slate-100 dark:border-slate-800/80 pt-3">
            <span>AVG: <strong className="text-slate-700 dark:text-slate-300">{statsThdI.avg.toFixed(2)}</strong></span>
            <span>MIN: <strong className="text-slate-700 dark:text-slate-300">{statsThdI.min.toFixed(2)}</strong></span>
            <span>MAX: <strong className="text-slate-700 dark:text-slate-300">{statsThdI.max.toFixed(2)}</strong></span>
          </div>
        </div>
      </section>

      {/* ═══════════ SECTION D: TREND LINES & EVENT LOGS ═══════════ */}
      <section className="grid gap-6 lg:grid-cols-[1.2fr_1fr]">
        <div className="space-y-4">
          <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 shadow-sm">
            <h4 className="text-xs font-extrabold uppercase tracking-wider text-amber-500 dark:text-amber-400 mb-2">Trend Tegangan 24 Jam (kV)</h4>
            <div style={{ height: 130 }}>
              <Line data={voltageTrendData} options={lineOptions("Trend Tegangan 24 Jam (kV)", "#eab308", "kV")} />
            </div>
          </div>
          <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 shadow-sm">
            <h4 className="text-xs font-extrabold uppercase tracking-wider text-emerald-500 dark:text-emerald-400 mb-2">Trend Daya Aktif 24 Jam (kW)</h4>
            <div style={{ height: 130 }}>
              <Line data={activePowerTrendData} options={lineOptions("Trend Daya Aktif 24 Jam (kW)", "#10b981", "kW")} />
            </div>
          </div>
        </div>

        {/* Event Logs Card */}
        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-sm flex flex-col">
          <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800/80 pb-3 mb-4">
            <h4 className="text-xs font-extrabold uppercase tracking-wider text-slate-500 dark:text-slate-400">EVENT & ALARM LOG</h4>
            <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Recent 5 events</span>
          </div>

          <div className="flex-1 flex flex-col items-center justify-center py-6 text-center">
            <svg className="h-8 w-8 text-rose-500 mb-2 opacity-85" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            <span className="text-xs font-bold text-red-500 font-mono tracking-wider">API TIDAK TERSEDIA</span>
            <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-1 max-w-[200px]">Data event dan alarm log belum terintegrasi ke database/API.</p>
          </div>
        </div>
      </section>

      {/* ═══════════ SECTION E: PARAMETER RINGKASAN TABLE ═══════════ */}
      <section className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-sm">
        <div className="flex items-center gap-2 mb-4">
          <svg className="h-4 w-4 text-[#002b5c] dark:text-sky-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 10h16M4 14h16M4 18h16" />
          </svg>
          <h4 className="text-xs font-extrabold uppercase tracking-wider text-slate-500 dark:text-slate-400">Ringkasan Parameter {config.title}</h4>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-slate-100 dark:border-slate-800 text-[10px] uppercase tracking-wider text-[#47729f] dark:text-slate-500 font-bold">
                <th className="pb-3 px-3">Parameter</th>
                <th className="pb-3 px-3">Nilai</th>
                <th className="pb-3 px-3">Satuan</th>
                <th className="pb-3 px-3">Standar</th>
                <th className="pb-3 px-3 text-right">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 font-semibold text-slate-800 dark:text-slate-200">
              {/* Tegangan */}
              <tr className="hover:bg-slate-50/50 dark:hover:bg-slate-800/10">
                <td className="py-3 px-3">Tegangan</td>
                <td className="py-3 px-3 font-mono">{renderMetricVal(liveMetrics.voltage, (v) => `${v.toFixed(2)}`)}</td>
                <td className="py-3 px-3">kV</td>
                <td className="py-3 px-3 font-mono">{standards.voltageNominal} ± {standards.voltageTolerance}%</td>
                <td className="py-3 px-3 text-right">
                  {isOfflineVal(liveMetrics.voltage) ? (
                    <span className="px-2 py-0.5 rounded text-[9px] font-bold border bg-slate-500/10 text-slate-400 border-slate-500/20">Offline</span>
                  ) : Math.abs(Number(liveMetrics.voltage) - standards.voltageNominal) <= (standards.voltageNominal * standards.voltageTolerance / 100) ? (
                    <span className="px-2.5 py-0.5 rounded text-[10px] font-extrabold border bg-emerald-500/10 text-emerald-500 border-emerald-500/20">✓ Normal</span>
                  ) : (
                    <span className="px-2.5 py-0.5 rounded text-[10px] font-extrabold border bg-red-500/10 text-red-500 border-red-500/20">⚠ Overlimit</span>
                  )}
                </td>
              </tr>
              {/* Frekuensi */}
              <tr className="hover:bg-slate-50/50 dark:hover:bg-slate-800/10">
                <td className="py-3 px-3">Frekuensi</td>
                <td className="py-3 px-3 font-mono">{renderMetricVal(liveMetrics.frequency, (v) => `${v.toFixed(2)}`)}</td>
                <td className="py-3 px-3">Hz</td>
                <td className="py-3 px-3 font-mono">{standards.frequencyNominal} ± {standards.frequencyTolerance}</td>
                <td className="py-3 px-3 text-right">
                  {isOfflineVal(liveMetrics.frequency) ? (
                    <span className="px-2 py-0.5 rounded text-[9px] font-bold border bg-slate-500/10 text-slate-400 border-slate-500/20">Offline</span>
                  ) : Math.abs(Number(liveMetrics.frequency) - standards.frequencyNominal) <= standards.frequencyTolerance ? (
                    <span className="px-2.5 py-0.5 rounded text-[10px] font-extrabold border bg-emerald-500/10 text-emerald-500 border-emerald-500/20">✓ Normal</span>
                  ) : (
                    <span className="px-2.5 py-0.5 rounded text-[10px] font-extrabold border bg-red-500/10 text-red-500 border-red-500/20">⚠ Overlimit</span>
                  )}
                </td>
              </tr>
              {/* Active Power */}
              <tr className="hover:bg-slate-50/50 dark:hover:bg-slate-800/10">
                <td className="py-3 px-3">Active Power</td>
                <td className="py-3 px-3 font-mono">{renderMetricVal(liveMetrics.activePower, (v) => `${v.toLocaleString("id-ID")}`)}</td>
                <td className="py-3 px-3">kW</td>
                <td className="py-3 px-3 font-mono">{standards.activePowerMax > 0 ? `≤ ${standards.activePowerMax}` : "—"}</td>
                <td className="py-3 px-3 text-right">
                  {isOfflineVal(liveMetrics.activePower) ? (
                    <span className="px-2 py-0.5 rounded text-[9px] font-bold border bg-slate-500/10 text-slate-400 border-slate-500/20">Offline</span>
                  ) : (standards.activePowerMax > 0 && Number(liveMetrics.activePower) > standards.activePowerMax) ? (
                    <span className="px-2.5 py-0.5 rounded text-[10px] font-extrabold border bg-red-500/10 text-red-500 border-red-500/20">⚠ Overlimit</span>
                  ) : (
                    <span className="px-2.5 py-0.5 rounded text-[10px] font-extrabold border bg-emerald-500/10 text-emerald-500 border-emerald-500/20">✓ Normal</span>
                  )}
                </td>
              </tr>
              {/* Reactive Power */}
              <tr className="hover:bg-slate-50/50 dark:hover:bg-slate-800/10">
                <td className="py-3 px-3">Reactive Power</td>
                <td className="py-3 px-3 font-mono">{renderMetricVal(liveMetrics.reactivePower, (v) => `${v.toLocaleString("id-ID")}`)}</td>
                <td className="py-3 px-3">kVAR</td>
                <td className="py-3 px-3 font-mono">{standards.reactivePowerMax > 0 ? `≤ ${standards.reactivePowerMax}` : "—"}</td>
                <td className="py-3 px-3 text-right">
                  {isOfflineVal(liveMetrics.reactivePower) ? (
                    <span className="px-2 py-0.5 rounded text-[9px] font-bold border bg-slate-500/10 text-slate-400 border-slate-500/20">Offline</span>
                  ) : (standards.reactivePowerMax > 0 && Number(liveMetrics.reactivePower) > standards.reactivePowerMax) ? (
                    <span className="px-2.5 py-0.5 rounded text-[10px] font-extrabold border bg-red-500/10 text-red-500 border-red-500/20">⚠ Overlimit</span>
                  ) : (
                    <span className="px-2.5 py-0.5 rounded text-[10px] font-extrabold border bg-emerald-500/10 text-emerald-500 border-emerald-500/20">✓ Normal</span>
                  )}
                </td>
              </tr>
              {/* Apparent Power */}
              <tr className="hover:bg-slate-50/50 dark:hover:bg-slate-800/10">
                <td className="py-3 px-3">Apparent Power</td>
                <td className="py-3 px-3 font-mono">{renderMetricVal(liveMetrics.apparentPower, (v) => `${v.toLocaleString("id-ID")}`)}</td>
                <td className="py-3 px-3">kVA</td>
                <td className="py-3 px-3 font-mono">{standards.apparentPowerMax > 0 ? `≤ ${standards.apparentPowerMax}` : "—"}</td>
                <td className="py-3 px-3 text-right">
                  {isOfflineVal(liveMetrics.apparentPower) ? (
                    <span className="px-2 py-0.5 rounded text-[9px] font-bold border bg-slate-500/10 text-slate-400 border-slate-500/20">Offline</span>
                  ) : (standards.apparentPowerMax > 0 && Number(liveMetrics.apparentPower) > standards.apparentPowerMax) ? (
                    <span className="px-2.5 py-0.5 rounded text-[10px] font-extrabold border bg-red-500/10 text-red-500 border-red-500/20">⚠ Overlimit</span>
                  ) : (
                    <span className="px-2.5 py-0.5 rounded text-[10px] font-extrabold border bg-emerald-500/10 text-emerald-500 border-emerald-500/20">✓ Normal</span>
                  )}
                </td>
              </tr>
              {/* Power Factor */}
              <tr className="hover:bg-slate-50/50 dark:hover:bg-slate-800/10">
                <td className="py-3 px-3">Power Factor</td>
                <td className="py-3 px-3 font-mono">{renderMetricVal(liveMetrics.powerFactor, (v) => `${v.toFixed(3)}`)}</td>
                <td className="py-3 px-3">PF</td>
                <td className="py-3 px-3 font-mono">≥ {standards.powerFactorMin}</td>
                <td className="py-3 px-3 text-right">
                  {isOfflineVal(liveMetrics.powerFactor) ? (
                    <span className="px-2 py-0.5 rounded text-[9px] font-bold border bg-slate-500/10 text-slate-400 border-slate-500/20">Offline</span>
                  ) : Number(liveMetrics.powerFactor) >= standards.powerFactorMin ? (
                    <span className="px-2.5 py-0.5 rounded text-[10px] font-extrabold border bg-emerald-500/10 text-emerald-500 border-emerald-500/20">✓ Normal</span>
                  ) : (
                    <span className="px-2.5 py-0.5 rounded text-[10px] font-extrabold border bg-red-500/10 text-red-500 border-red-500/20">⚠ Low PF</span>
                  )}
                </td>
              </tr>
              {/* Voltage Unbalanced */}
              <tr className="hover:bg-slate-50/50 dark:hover:bg-slate-800/10">
                <td className="py-3 px-3">Voltage Unbalanced</td>
                <td className="py-3 px-3 font-mono">{renderMetricVal(liveMetrics.unbalanceV, (v) => `${v.toFixed(2)}`)}</td>
                <td className="py-3 px-3">%</td>
                <td className="py-3 px-3 font-mono">≤ {standards.unbalanceVMax}%</td>
                <td className="py-3 px-3 text-right">
                  {isOfflineVal(liveMetrics.unbalanceV) ? (
                    <span className="px-2 py-0.5 rounded text-[9px] font-bold border bg-slate-500/10 text-slate-400 border-slate-500/20">Offline</span>
                  ) : Number(liveMetrics.unbalanceV) <= standards.unbalanceVMax ? (
                    <span className="px-2.5 py-0.5 rounded text-[10px] font-extrabold border bg-emerald-500/10 text-emerald-500 border-emerald-500/20">✓ Normal</span>
                  ) : (
                    <span className="px-2.5 py-0.5 rounded text-[10px] font-extrabold border bg-red-500/10 text-red-500 border-red-500/20">⚠ Overlimit</span>
                  )}
                </td>
              </tr>
              {/* Current Unbalanced */}
              <tr className="hover:bg-slate-50/50 dark:hover:bg-slate-800/10">
                <td className="py-3 px-3">Current Unbalanced</td>
                <td className="py-3 px-3 font-mono">{renderMetricVal(liveMetrics.unbalanceI, (v) => `${v.toFixed(2)}`)}</td>
                <td className="py-3 px-3">%</td>
                <td className="py-3 px-3 font-mono">≤ {standards.unbalanceIMax}%</td>
                <td className="py-3 px-3 text-right">
                  {isOfflineVal(liveMetrics.unbalanceI) ? (
                    <span className="px-2 py-0.5 rounded text-[9px] font-bold border bg-slate-500/10 text-slate-400 border-slate-500/20">Offline</span>
                  ) : Number(liveMetrics.unbalanceI) <= standards.unbalanceIMax ? (
                    <span className="px-2.5 py-0.5 rounded text-[10px] font-extrabold border bg-emerald-500/10 text-emerald-500 border-emerald-500/20">✓ Normal</span>
                  ) : (
                    <span className="px-2.5 py-0.5 rounded text-[10px] font-extrabold border bg-red-500/10 text-red-500 border-red-500/20">⚠ Overlimit</span>
                  )}
                </td>
              </tr>
              {/* THD Voltage */}
              <tr className="hover:bg-slate-50/50 dark:hover:bg-slate-800/10">
                <td className="py-3 px-3">THD Voltage (Avg)</td>
                <td className="py-3 px-3 font-mono">{renderMetricVal(liveMetrics.thdV_R === "BELUM ADA API" || liveMetrics.thdV_S === "BELUM ADA API" || liveMetrics.thdV_T === "BELUM ADA API" ? "BELUM ADA API" : liveMetrics.thdV_R === "API TIDAK TERKIRIM" || liveMetrics.thdV_S === "API TIDAK TERKIRIM" || liveMetrics.thdV_T === "API TIDAK TERKIRIM" ? "API TIDAK TERKIRIM" : statsThdV.avg, (v) => `${v.toFixed(2)}`)}</td>
                <td className="py-3 px-3">%</td>
                <td className="py-3 px-3 font-mono">≤ {standards.thdVoltageMax}%</td>
                <td className="py-3 px-3 text-right">
                  {isOfflineVal(liveMetrics.thdV_R) ? (
                    <span className="px-2 py-0.5 rounded text-[9px] font-bold border bg-slate-500/10 text-slate-400 border-slate-500/20">Offline</span>
                  ) : statsThdV.avg <= standards.thdVoltageMax ? (
                    <span className="px-2.5 py-0.5 rounded text-[10px] font-extrabold border bg-emerald-500/10 text-emerald-500 border-emerald-500/20">✓ Normal</span>
                  ) : (
                    <span className="px-2.5 py-0.5 rounded text-[10px] font-extrabold border bg-red-500/10 text-red-500 border-red-500/20">⚠ Overlimit</span>
                  )}
                </td>
              </tr>
              {/* THD Current */}
              <tr className="hover:bg-slate-50/50 dark:hover:bg-slate-800/10">
                <td className="py-3 px-3">THD Current (Avg)</td>
                <td className="py-3 px-3 font-mono">{renderMetricVal(liveMetrics.thdI_R === "BELUM ADA API" || liveMetrics.thdI_S === "BELUM ADA API" || liveMetrics.thdI_T === "BELUM ADA API" ? "BELUM ADA API" : liveMetrics.thdI_R === "API TIDAK TERKIRIM" || liveMetrics.thdI_S === "API TIDAK TERKIRIM" || liveMetrics.thdI_T === "API TIDAK TERKIRIM" ? "API TIDAK TERKIRIM" : statsThdI.avg, (v) => `${v.toFixed(2)}`)}</td>
                <td className="py-3 px-3">%</td>
                <td className="py-3 px-3 font-mono">≤ {standards.thdCurrentMax}%</td>
                <td className="py-3 px-3 text-right">
                  {isOfflineVal(liveMetrics.thdI_R) ? (
                    <span className="px-2 py-0.5 rounded text-[9px] font-bold border bg-slate-500/10 text-slate-400 border-slate-500/20">Offline</span>
                  ) : statsThdI.avg <= standards.thdCurrentMax ? (
                    <span className="px-2.5 py-0.5 rounded text-[10px] font-extrabold border bg-emerald-500/10 text-emerald-500 border-emerald-500/20">✓ Normal</span>
                  ) : (
                    <span className="px-2.5 py-0.5 rounded text-[10px] font-extrabold border bg-red-500/10 text-red-500 border-red-500/20">⚠ Overlimit</span>
                  )}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      {/* CONFIG MODAL */}
      {showConfigModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm" onClick={() => setShowConfigModal(false)}>
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl w-full max-w-lg p-6 space-y-4" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <h3 className="text-sm font-bold uppercase tracking-wide text-slate-700 dark:text-white">
                ⚙️ Konfigurasi Standar Parameter Incoming PLN
              </h3>
              <button onClick={() => setShowConfigModal(false)} className="text-slate-400 hover:text-slate-600 text-lg font-bold">✕</button>
            </div>

            <div className="space-y-3.5 max-h-[60vh] overflow-y-auto pr-1">
              {/* Tegangan */}
              <div className="grid grid-cols-2 gap-3 border-b border-slate-100 dark:border-slate-800 pb-3">
                <div>
                  <label className="text-[10px] font-extrabold uppercase text-slate-400 block mb-1">Tegangan Nominal (kV)</label>
                  <input
                    type="number"
                    step="0.1"
                    value={formStds.voltageNominal}
                    onChange={(e) => setFormStds({ ...formStds, voltageNominal: parseFloat(e.target.value) || 0 })}
                    className="w-full px-3 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-mono text-slate-800 dark:text-slate-100 focus:ring-1 focus:ring-sky-500 outline-none"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-extrabold uppercase text-slate-400 block mb-1">Toleransi Tegangan (%)</label>
                  <input
                    type="number"
                    step="0.1"
                    value={formStds.voltageTolerance}
                    onChange={(e) => setFormStds({ ...formStds, voltageTolerance: parseFloat(e.target.value) || 0 })}
                    className="w-full px-3 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-mono text-slate-800 dark:text-slate-100 focus:ring-1 focus:ring-sky-500 outline-none"
                  />
                </div>
              </div>

              {/* Frekuensi */}
              <div className="grid grid-cols-2 gap-3 border-b border-slate-100 dark:border-slate-800 pb-3">
                <div>
                  <label className="text-[10px] font-extrabold uppercase text-slate-400 block mb-1">Frekuensi Nominal (Hz)</label>
                  <input
                    type="number"
                    step="0.1"
                    value={formStds.frequencyNominal}
                    onChange={(e) => setFormStds({ ...formStds, frequencyNominal: parseFloat(e.target.value) || 0 })}
                    className="w-full px-3 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-mono text-slate-800 dark:text-slate-100 focus:ring-1 focus:ring-sky-500 outline-none"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-extrabold uppercase text-slate-400 block mb-1">Toleransi Frekuensi (Hz)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={formStds.frequencyTolerance}
                    onChange={(e) => setFormStds({ ...formStds, frequencyTolerance: parseFloat(e.target.value) || 0 })}
                    className="w-full px-3 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-mono text-slate-800 dark:text-slate-100 focus:ring-1 focus:ring-sky-500 outline-none"
                  />
                </div>
              </div>

              {/* Power Limits */}
              <div className="grid grid-cols-3 gap-3 border-b border-slate-100 dark:border-slate-800 pb-3">
                <div>
                  <label className="text-[10px] font-extrabold uppercase text-slate-400 block mb-1">Max Active Power (kW)</label>
                  <input
                    type="number"
                    step="1"
                    value={formStds.activePowerMax}
                    onChange={(e) => setFormStds({ ...formStds, activePowerMax: parseFloat(e.target.value) || 0 })}
                    className="w-full px-3 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-mono text-slate-800 dark:text-slate-100 focus:ring-1 focus:ring-sky-500 outline-none"
                    placeholder="0 = tanpa batas"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-extrabold uppercase text-slate-400 block mb-1">Max Reactive (kVAR)</label>
                  <input
                    type="number"
                    step="1"
                    value={formStds.reactivePowerMax}
                    onChange={(e) => setFormStds({ ...formStds, reactivePowerMax: parseFloat(e.target.value) || 0 })}
                    className="w-full px-3 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-mono text-slate-800 dark:text-slate-100 focus:ring-1 focus:ring-sky-500 outline-none"
                    placeholder="0 = tanpa batas"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-extrabold uppercase text-slate-400 block mb-1">Max Apparent (kVA)</label>
                  <input
                    type="number"
                    step="1"
                    value={formStds.apparentPowerMax}
                    onChange={(e) => setFormStds({ ...formStds, apparentPowerMax: parseFloat(e.target.value) || 0 })}
                    className="w-full px-3 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-mono text-slate-800 dark:text-slate-100 focus:ring-1 focus:ring-sky-500 outline-none"
                    placeholder="0 = tanpa batas"
                  />
                </div>
              </div>

              {/* Power Factor & Unbalance */}
              <div className="grid grid-cols-3 gap-3 border-b border-slate-100 dark:border-slate-800 pb-3">
                <div>
                  <label className="text-[10px] font-extrabold uppercase text-slate-400 block mb-1">Min PF</label>
                  <input
                    type="number"
                    step="0.01"
                    value={formStds.powerFactorMin}
                    onChange={(e) => setFormStds({ ...formStds, powerFactorMin: parseFloat(e.target.value) || 0 })}
                    className="w-full px-3 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-mono text-slate-800 dark:text-slate-100 focus:ring-1 focus:ring-sky-500 outline-none"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-extrabold uppercase text-slate-400 block mb-1">Max Unb V (%)</label>
                  <input
                    type="number"
                    step="0.1"
                    value={formStds.unbalanceVMax}
                    onChange={(e) => setFormStds({ ...formStds, unbalanceVMax: parseFloat(e.target.value) || 0 })}
                    className="w-full px-3 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-mono text-slate-800 dark:text-slate-100 focus:ring-1 focus:ring-sky-500 outline-none"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-extrabold uppercase text-slate-400 block mb-1">Max Unb I (%)</label>
                  <input
                    type="number"
                    step="0.1"
                    value={formStds.unbalanceIMax}
                    onChange={(e) => setFormStds({ ...formStds, unbalanceIMax: parseFloat(e.target.value) || 0 })}
                    className="w-full px-3 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-mono text-slate-800 dark:text-slate-100 focus:ring-1 focus:ring-sky-500 outline-none"
                  />
                </div>
              </div>

              {/* THD Limits */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] font-extrabold uppercase text-slate-400 block mb-1">Max THD Voltage (%)</label>
                  <input
                    type="number"
                    step="0.1"
                    value={formStds.thdVoltageMax}
                    onChange={(e) => setFormStds({ ...formStds, thdVoltageMax: parseFloat(e.target.value) || 0 })}
                    className="w-full px-3 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-mono text-slate-800 dark:text-slate-100 focus:ring-1 focus:ring-sky-500 outline-none"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-extrabold uppercase text-slate-400 block mb-1">Max THD Current (%)</label>
                  <input
                    type="number"
                    step="0.1"
                    value={formStds.thdCurrentMax}
                    onChange={(e) => setFormStds({ ...formStds, thdCurrentMax: parseFloat(e.target.value) || 0 })}
                    className="w-full px-3 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-mono text-slate-800 dark:text-slate-100 focus:ring-1 focus:ring-sky-500 outline-none"
                  />
                </div>
              </div>
            </div>

            <div className="border-t border-slate-100 dark:border-slate-800 pt-3 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowConfigModal(false)}
                className="px-4 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-xl text-xs font-bold transition-colors"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleSaveStandards}
                disabled={savingConfig}
                className="px-4 py-2 bg-sky-500 hover:bg-sky-600 disabled:opacity-50 text-white rounded-xl text-xs font-extrabold transition-colors shadow-md shadow-sky-500/20"
              >
                {savingConfig ? "Menyimpan..." : "💾 Simpan Standar"}
              </button>
            </div>
          </div>
        </div>
      )}
      {/* API SOURCES CONFIG MODAL */}
      {showConfigPanel && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm" onClick={() => setShowConfigPanel(false)}>
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl w-full max-w-4xl p-6 space-y-4" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <h3 className="text-sm font-bold uppercase tracking-wide text-slate-700 dark:text-white">
                🔌 Konfigurasi API Live Data - {config.title}
              </h3>
              <button onClick={() => setShowConfigPanel(false)} className="text-slate-400 hover:text-slate-600 text-lg font-bold">✕</button>
            </div>

            <div className="max-h-[70vh] overflow-y-auto pr-1">
              <ApiSourcesPanel unitId={config.deviceId} />
            </div>

            <div className="border-t border-slate-100 dark:border-slate-800 pt-3 flex justify-end">
              <button
                type="button"
                onClick={() => setShowConfigPanel(false)}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition-colors shadow-md"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
