import { useEffect, useState, useMemo } from "react";
import { useOutletContext } from "react-router-dom";
import { getUnitById } from "../../data/machines";
import { DEFAULT_EQ_CONFIGS } from "../../data/equipment";
import type { ConfigEqRow } from "../../data/equipment";
import type { MachineOutletContext } from "./MachineLayout";

type ConfigTagRow = {
  tagKey: string;
  tagName: string;
  lowLimit: number;
  baseline: number;
  highLimit: number;
  unit: string;
  enableAlert: boolean;
  suppressAlert: boolean;
};

const DEFAULT_CONFIGS: ConfigTagRow[] = [
  { tagKey: "SPLY_WTR_TEMP", tagName: "Supply Water Temp", lowLimit: 25.0, baseline: 31.0, highLimit: 35.0, unit: "°C", enableAlert: true, suppressAlert: false },
  { tagKey: "SPLY_WTR_TDS", tagName: "Supply Water TDS", lowLimit: 100.0, baseline: 300.0, highLimit: 400.0, unit: "µS/cm", enableAlert: true, suppressAlert: false },
  { tagKey: "SPLY_WTR_PH", tagName: "Supply Water pH", lowLimit: 6.5, baseline: 7.0, highLimit: 8.5, unit: "pH", enableAlert: true, suppressAlert: true },
  { tagKey: "SPLY_WTR_FLOW", tagName: "Supply Water Flow", lowLimit: 300.0, baseline: 400.0, highLimit: 500.0, unit: "m³/h", enableAlert: true, suppressAlert: false },
  { tagKey: "RTN_WTR_TEMP", tagName: "Return Water Temp", lowLimit: 30.0, baseline: 40.0, highLimit: 45.0, unit: "°C", enableAlert: true, suppressAlert: false },
  { tagKey: "MAKEUP_WTR_TDS", tagName: "Makeup Water TDS", lowLimit: 50.0, baseline: 150.0, highLimit: 200.0, unit: "µS/cm", enableAlert: true, suppressAlert: false },
  { tagKey: "MAKEUP_WTR_PH", tagName: "Makeup Water pH", lowLimit: 6.5, baseline: 7.0, highLimit: 8.0, unit: "pH", enableAlert: true, suppressAlert: false },
  { tagKey: "AMBIENT_HUMIDITY", tagName: "Ambient Humidity", lowLimit: 50.0, baseline: 70.0, highLimit: 90.0, unit: "%", enableAlert: true, suppressAlert: false }
];

export default function MachineConfig() {
  const { unitId } = useOutletContext<MachineOutletContext>();
  const machine = getUnitById(unitId);

  // Tabs for the configuration categories
  const [configTab, setConfigTab] = useState<"sensors" | "equipment">("sensors");

  const [sensorRows, setSensorRows] = useState<ConfigTagRow[]>([]);
  const [eqRows, setEqRows] = useState<ConfigEqRow[]>([]);
  const [successMsg, setSuccessMsg] = useState(false);

  // Load configuration from localStorage or defaults
  useEffect(() => {
    // Sensor parameters load
    const savedSensors = localStorage.getItem(`scada.config.${unitId}`);
    if (savedSensors) {
      try {
        setSensorRows(JSON.parse(savedSensors));
      } catch (e) {
        setSensorRows(DEFAULT_CONFIGS);
      }
    } else {
      setSensorRows(DEFAULT_CONFIGS);
    }

    // Equipment configurations load
    if (unitId === "cooling-water-1") {
      const savedEq = localStorage.getItem(`scada.config.eq.${unitId}`);
      if (savedEq) {
        try {
          setEqRows(JSON.parse(savedEq));
        } catch (e) {
          setEqRows(DEFAULT_EQ_CONFIGS);
        }
      } else {
        setEqRows(DEFAULT_EQ_CONFIGS);
      }
    } else {
      setEqRows([]);
      setConfigTab("sensors");
    }
  }, [unitId]);

  // Handle number input changes for sensors
  const handleSensorNumChange = (index: number, field: "lowLimit" | "baseline" | "highLimit", value: string) => {
    const parsedVal = value === "" ? 0 : parseFloat(value);
    setSensorRows((prev) => {
      const next = [...prev];
      next[index] = {
        ...next[index],
        [field]: isNaN(parsedVal) ? next[index][field] : parsedVal
      };
      return next;
    });
  };

  // Handle check changes for sensors
  const handleSensorCheckChange = (index: number, field: "enableAlert" | "suppressAlert") => {
    setSensorRows((prev) => {
      const next = [...prev];
      next[index] = {
        ...next[index],
        [field]: !next[index][field]
      };
      return next;
    });
  };

  // Handle number changes for equipment
  const handleEqNumChange = (index: number, field: "lowLimit" | "baseline" | "highLimit", value: string) => {
    const parsedVal = value === "" ? 0 : parseFloat(value);
    setEqRows((prev) => {
      const next = [...prev];
      next[index] = {
        ...next[index],
        [field]: isNaN(parsedVal) ? next[index][field] : parsedVal
      };
      return next;
    });
  };

  // Handle check changes for equipment
  const handleEqCheckChange = (index: number, field: "enableAlert" | "suppressAlert") => {
    setEqRows((prev) => {
      const next = [...prev];
      next[index] = {
        ...next[index],
        [field]: !next[index][field]
      };
      return next;
    });
  };

  // Save configurations to localStorage
  const handleSave = () => {
    localStorage.setItem(`scada.config.${unitId}`, JSON.stringify(sensorRows));
    localStorage.setItem(`scada.config.eq.${unitId}`, JSON.stringify(eqRows));
    setSuccessMsg(true);
    setTimeout(() => setSuccessMsg(false), 3000);
  };

  if (!machine) return null;

  return (
    <div className="space-y-6">
      {/* Configuration Header Panel */}
      <div className="flex flex-wrap items-center justify-between gap-4 bg-[#f7fbff]/80 dark:bg-slate-950/70 border border-[#acd3ff] dark:border-slate-800 rounded-xl p-4 transition-colors duration-300 backdrop-blur-md">
        <div className="space-y-1">
          <h3 className="text-sm font-bold text-[#002b5c] dark:text-slate-100 uppercase tracking-wide">
            Tag Setpoints & Limits Configuration Console
          </h3>
          <p className="text-xs text-[#47729f] dark:text-slate-500">
            Configure alarms setpoints, suppressing parameters, and equipment running hours matching P&ID layouts.
          </p>
        </div>
        
        <div className="flex items-center gap-3">
          {successMsg && (
            <span className="text-xs font-bold text-emerald-500 animate-pulse bg-emerald-500/10 border border-emerald-500/20 px-3 py-1.5 rounded-lg">
              Configuration Saved Successfully!
            </span>
          )}
          <button
            onClick={handleSave}
            className="flex items-center gap-1.5 px-5 py-2.5 text-xs font-bold rounded-lg bg-[#1f6fb5] hover:bg-[#155c99] text-white shadow-md shadow-[#1f6fb5]/25 transition duration-200"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2v-9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" />
            </svg>
            Save Configuration
          </button>
        </div>
      </div>

      {/* Internal configuration section sub-tabs */}
      {unitId === "cooling-water-1" && (
        <div className="flex gap-2 p-1 bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800/80 rounded-xl w-fit">
          <button
            onClick={() => setConfigTab("sensors")}
            className={`px-4 py-2 text-xs font-bold rounded-lg transition ${
              configTab === "sensors"
                ? "bg-[#1f6fb5] text-white shadow-sm"
                : "text-[#47729f] dark:text-slate-400 hover:text-[#002b5c] dark:hover:text-slate-200"
            }`}
          >
            Sensor parameters (TDS, pH, Flow, etc.)
          </button>
          <button
            onClick={() => setConfigTab("equipment")}
            className={`px-4 py-2 text-xs font-bold rounded-lg transition ${
              configTab === "equipment"
                ? "bg-[#1f6fb5] text-white shadow-sm"
                : "text-[#47729f] dark:text-slate-400 hover:text-[#002b5c] dark:hover:text-slate-200"
            }`}
          >
            Equipment Running Hours (P&ID Specs)
          </button>
        </div>
      )}

      {/* Configuration Inputs Table */}
      <div className="bg-white dark:bg-slate-950 border border-[#acd3ff] dark:border-slate-800 rounded-xl p-5 shadow-sm transition-colors duration-300">
        <div className="overflow-x-auto">
          {configTab === "sensors" ? (
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-[#acd3ff]/50 dark:border-slate-800/50 text-[10px] uppercase tracking-wider text-[#47729f] dark:text-slate-500 font-bold">
                  <th className="pb-3 px-3">SCADA Parameter Tag</th>
                  <th className="pb-3 px-3 text-center w-24">Low Limit</th>
                  <th className="pb-3 px-3 text-center w-28">Baseline Setpoint</th>
                  <th className="pb-3 px-3 text-center w-24">High Limit</th>
                  <th className="pb-3 px-3 text-center w-28">Enable Alert</th>
                  <th className="pb-3 px-3 text-center w-28">Suppress Alert</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-900 font-medium text-[#002b5c] dark:text-slate-300">
                {sensorRows.map((row, idx) => (
                  <tr key={row.tagKey} className="hover:bg-slate-50/50 dark:hover:bg-slate-900/20 transition-colors">
                    <td className="py-4 px-3">
                      <div className="font-bold text-[#002b5c] dark:text-slate-200">{row.tagKey}</div>
                      <div className="text-[10px] text-slate-400 mt-0.5">{row.tagName} ({row.unit})</div>
                    </td>
                    
                    <td className="py-4 px-3 text-center">
                      <div className="inline-flex items-center gap-1.5 border border-[#d6e9fb] dark:border-slate-800 rounded px-2 py-1 bg-slate-50 dark:bg-slate-900 w-24">
                        <input
                          type="number"
                          step="0.01"
                          value={row.lowLimit}
                          onChange={(e) => handleSensorNumChange(idx, "lowLimit", e.target.value)}
                          className="w-full text-center font-bold font-mono bg-transparent outline-none focus:ring-0 focus:border-transparent text-xs"
                        />
                      </div>
                    </td>

                    <td className="py-4 px-3 text-center">
                      <div className="inline-flex items-center gap-1.5 border border-[#acd3ff] dark:border-slate-700 rounded px-2.5 py-1 bg-sky-500/5 dark:bg-slate-900/80 w-28">
                        <input
                          type="number"
                          step="0.01"
                          value={row.baseline}
                          onChange={(e) => handleSensorNumChange(idx, "baseline", e.target.value)}
                          className="w-full text-center font-bold font-mono bg-transparent outline-none focus:ring-0 focus:border-transparent text-xs text-[#1f6fb5] dark:text-sky-400"
                        />
                      </div>
                    </td>

                    <td className="py-4 px-3 text-center">
                      <div className="inline-flex items-center gap-1.5 border border-[#d6e9fb] dark:border-slate-800 rounded px-2 py-1 bg-slate-50 dark:bg-slate-900 w-24">
                        <input
                          type="number"
                          step="0.01"
                          value={row.highLimit}
                          onChange={(e) => handleSensorNumChange(idx, "highLimit", e.target.value)}
                          className="w-full text-center font-bold font-mono bg-transparent outline-none focus:ring-0 focus:border-transparent text-xs"
                        />
                      </div>
                    </td>

                    <td className="py-4 px-3 text-center">
                      <button
                        type="button"
                        onClick={() => handleSensorCheckChange(idx, "enableAlert")}
                        className={`inline-flex items-center gap-1 px-3 py-1 rounded text-[10px] font-extrabold uppercase border transition ${
                          row.enableAlert
                            ? "bg-emerald-500/10 text-emerald-500 border-emerald-500/25"
                            : "bg-slate-100 dark:bg-slate-900/40 text-slate-400 border-slate-200 dark:border-slate-800"
                        }`}
                      >
                        {row.enableAlert ? "YES" : "NO"}
                      </button>
                    </td>

                    <td className="py-4 px-3 text-center">
                      <button
                        type="button"
                        onClick={() => handleSensorCheckChange(idx, "suppressAlert")}
                        className={`inline-flex items-center gap-1 px-3 py-1 rounded text-[10px] font-extrabold uppercase border transition ${
                          row.suppressAlert
                            ? "bg-rose-500/15 text-rose-500 border-rose-500/30 font-bold"
                            : "bg-slate-100 dark:bg-slate-900/40 text-slate-400 border-slate-200 dark:border-slate-800"
                        }`}
                      >
                        {row.suppressAlert ? "YES" : "NO"}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-[#acd3ff]/50 dark:border-slate-800/50 text-[10px] uppercase tracking-wider text-[#47729f] dark:text-slate-500 font-bold">
                  <th className="pb-3 px-3">Equipment SCADA Tag</th>
                  <th className="pb-3 px-3 text-center">P&ID Status</th>
                  <th className="pb-3 px-3 text-center w-24">Min Hours</th>
                  <th className="pb-3 px-3 text-center w-28">Baseline Hours</th>
                  <th className="pb-3 px-3 text-center w-24">Max Hours</th>
                  <th className="pb-3 px-3 text-center w-28">Enable Alert</th>
                  <th className="pb-3 px-3 text-center w-28">Suppress Alert</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-900 font-medium text-[#002b5c] dark:text-slate-300">
                {eqRows.map((row, idx) => (
                  <tr key={row.tagKey} className="hover:bg-slate-50/50 dark:hover:bg-slate-900/20 transition-colors">
                    <td className="py-3 px-3">
                      <div className="font-bold text-[#002b5c] dark:text-slate-200">{row.tagKey}</div>
                      <div className="text-[10px] text-slate-400 mt-0.5">{row.tagName}</div>
                    </td>

                    <td className="py-3 px-3 text-center">
                      {row.status !== "—" ? (
                        <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded text-[9px] font-extrabold tracking-wider ${
                          row.status === "ON"
                            ? "bg-sky-500/10 text-sky-500 border border-sky-500/20"
                            : "bg-rose-500/10 text-rose-500 border border-rose-500/20"
                        }`}>
                          {row.status}
                        </span>
                      ) : (
                        <span className="text-slate-400 font-semibold">—</span>
                      )}
                    </td>
                    
                    <td className="py-3 px-3 text-center">
                      <div className="inline-flex items-center gap-1.5 border border-[#d6e9fb] dark:border-slate-800 rounded px-2 py-1 bg-slate-50 dark:bg-slate-900 w-24">
                        <input
                          type="number"
                          value={row.lowLimit}
                          onChange={(e) => handleEqNumChange(idx, "lowLimit", e.target.value)}
                          className="w-full text-center font-bold font-mono bg-transparent outline-none focus:ring-0 focus:border-transparent text-xs"
                        />
                      </div>
                    </td>

                    <td className="py-3 px-3 text-center">
                      <div className="inline-flex items-center gap-1.5 border border-[#acd3ff] dark:border-slate-700 rounded px-2.5 py-1 bg-sky-500/5 dark:bg-slate-900/80 w-28">
                        <input
                          type="number"
                          value={row.baseline}
                          onChange={(e) => handleEqNumChange(idx, "baseline", e.target.value)}
                          className="w-full text-center font-bold font-mono bg-transparent outline-none focus:ring-0 focus:border-transparent text-xs text-[#1f6fb5] dark:text-sky-400"
                        />
                      </div>
                    </td>

                    <td className="py-3 px-3 text-center">
                      <div className="inline-flex items-center gap-1.5 border border-[#d6e9fb] dark:border-slate-800 rounded px-2 py-1 bg-slate-50 dark:bg-slate-900 w-24">
                        <input
                          type="number"
                          value={row.highLimit}
                          onChange={(e) => handleEqNumChange(idx, "highLimit", e.target.value)}
                          className="w-full text-center font-bold font-mono bg-transparent outline-none focus:ring-0 focus:border-transparent text-xs"
                        />
                      </div>
                    </td>

                    <td className="py-3 px-3 text-center">
                      <button
                        type="button"
                        onClick={() => handleEqCheckChange(idx, "enableAlert")}
                        className={`inline-flex items-center gap-1 px-3 py-1 rounded text-[10px] font-extrabold uppercase border transition ${
                          row.enableAlert
                            ? "bg-emerald-500/10 text-emerald-500 border-emerald-500/25"
                            : "bg-slate-100 dark:bg-slate-900/40 text-slate-400 border-slate-200 dark:border-slate-800"
                        }`}
                      >
                        {row.enableAlert ? "YES" : "NO"}
                      </button>
                    </td>

                    <td className="py-3 px-3 text-center">
                      <button
                        type="button"
                        onClick={() => handleEqCheckChange(idx, "suppressAlert")}
                        className={`inline-flex items-center gap-1 px-3 py-1 rounded text-[10px] font-extrabold uppercase border transition ${
                          row.suppressAlert
                            ? "bg-rose-500/15 text-rose-500 border-rose-500/30 font-bold"
                            : "bg-slate-100 dark:bg-slate-900/40 text-slate-400 border-slate-200 dark:border-slate-800"
                        }`}
                      >
                        {row.suppressAlert ? "YES" : "NO"}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
