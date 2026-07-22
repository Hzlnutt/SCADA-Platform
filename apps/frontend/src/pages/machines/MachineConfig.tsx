import { useEffect, useState, useMemo, useCallback } from "react";
import { useOutletContext } from "react-router-dom";
import { getUnitById } from "../../data/machines";
import { postJson, getJson, deleteJson, patchJson } from "../../services/api.client";
import { DEFAULT_EQ_CONFIGS, DEFAULT_HVAC_CONFIG, DEFAULT_HVAC_EQ_CONFIGS, getDefaultEqConfigs, getDefaultSensorConfigs } from "../../data/equipment";
import type { ConfigEqRow, ConfigTagRow, HvacConfig } from "../../data/equipment";
import type { MachineOutletContext } from "./MachineLayout";

const getEqDisplayTagKey = (tagKey: string) => {
  switch(tagKey) {
    case "F1_MOTOR_OVERHAUL": return "FAN-CT-1";
    case "F2_MOTOR_OVERHAUL": return "FAN-CT-2";
    case "F3_MOTOR_OVERHAUL": return "FAN-CT-3";
    case "M1_PUMP_MOTOR_OVERHAUL": return "MTR-PUMP-1";
    case "M2_SUPPLY_MOTOR_OVERHAUL": return "MTR-PUMP-2";
    case "M3_SUPPLY_MOTOR_OVERHAUL": return "MTR-PUMP-3";
    case "M4_PUMP_MOTOR_OVERHAUL": return "MTR-PUMP-4";
    case "M5_SUPPLY_MOTOR_OVERHAUL": return "MTR-PUMP-5";
    case "M6_SUPPLY_MOTOR_OVERHAUL": return "MTR-PUMP-6";
    case "M7_PUMP_MOTOR_OVERHAUL": return "MTR-PUMP-7";
    case "M8_SUPPLY_MOTOR_OVERHAUL": return "MTR-PUMP-8";
    case "M9_SUPPLY_MOTOR_OVERHAUL": return "MTR-PUMP-9";
    default: return tagKey;
  }
};

const PID_EQ_TAG_KEYS = [
  "F1_MOTOR_OVERHAUL",
  "F2_MOTOR_OVERHAUL",
  "F3_MOTOR_OVERHAUL",
  "M1_PUMP_MOTOR_OVERHAUL",
  "M2_SUPPLY_MOTOR_OVERHAUL",
  "M3_SUPPLY_MOTOR_OVERHAUL",
  "M4_PUMP_MOTOR_OVERHAUL",
  "M5_SUPPLY_MOTOR_OVERHAUL",
  "M6_SUPPLY_MOTOR_OVERHAUL",
  "M7_PUMP_MOTOR_OVERHAUL",
  "M8_SUPPLY_MOTOR_OVERHAUL",
  "M9_SUPPLY_MOTOR_OVERHAUL"
];

const DEFAULT_TASK_RULES = [
  { id: "1", motorKey: "FAN-CT-1", targetHours: 150, taskName: "F-1 V-Belt Tension" },
  { id: "2", motorKey: "FAN-CT-1", targetHours: 420, taskName: "F-1 Fan & Motor Visual Inspection" },
  { id: "3", motorKey: "FAN-CT-1", targetHours: 810, taskName: "F-1 Fan Shaft Bearing Lubrication" },
  { id: "4", motorKey: "FAN-CT-1", targetHours: 3200, taskName: "F-1 V-Belt Replacement" },
  { id: "5", motorKey: "FAN-CT-1", targetHours: 4600, taskName: "F-1 Motor & Reducer Grease/Bearing" },
  { id: "6", motorKey: "FAN-CT-1", targetHours: 10000, taskName: "FAN-CT-1 Direct Drive Motor Overhaul" },

  { id: "7", motorKey: "MTR-PUMP-1", targetHours: 180, taskName: "P-1 Strainer Cleanliness Inspection" },
  { id: "8", motorKey: "MTR-PUMP-1", targetHours: 520, taskName: "P-1 Strainer Cleaning" },
  { id: "9", motorKey: "MTR-PUMP-1", targetHours: 750, taskName: "P-1 Pump Bearing Lubrication" },
  { id: "10", motorKey: "MTR-PUMP-1", targetHours: 1200, taskName: "P-1 Pump Seal & Leakage Inspection" },
  { id: "11", motorKey: "MTR-PUMP-1", targetHours: 2500, taskName: "P-1 Pump Overhaul Major & Descaling" },
  { id: "12", motorKey: "MTR-PUMP-1", targetHours: 10000, taskName: "MTR-PUMP-1 Pump Motor Overhaul/Bearing" },

  { id: "13", motorKey: "MTR-PUMP-2", targetHours: 10000, taskName: "MTR-PUMP-2 Supply Motor 1 Overhaul/Bearing" },
  { id: "14", motorKey: "MTR-PUMP-3", targetHours: 10000, taskName: "MTR-PUMP-3 Supply Motor 2 Overhaul/Bearing" }
];

export default function MachineConfig() {
  const { unitId } = useOutletContext<MachineOutletContext>();
  const machine = getUnitById(unitId);

  const isCoolingTower = unitId === "cooling-water-1" || unitId === "cooling-water-2" || unitId === "cooling-water-3";

  if (unitId === "hvac-qc-retained-sample") {
    return <HvacConfigConsole unitId={unitId} machine={machine} />;
  }

  // Tabs for the configuration categories
  const [configTab, setConfigTab] = useState<"sensors" | "equipment" | "api-sources">("sensors");
  const [eqSubTab, setEqSubTab] = useState<"pid" | "preventive">("pid");

  const [sensorRows, setSensorRows] = useState<ConfigTagRow[]>([]);
  const [eqRows, setEqRows] = useState<ConfigEqRow[]>([]);
  
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [passwordInput, setPasswordInput] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [verifyingPassword, setVerifyingPassword] = useState(false);
  const [eqTaskConfigs, setEqTaskConfigs] = useState<{
    itemKey: string;
    displayName: string;
    rules: { targetHours: number; warningHours: number; tasks: string[] }[];
  }[]>([]);
  const [expandedItems, setExpandedItems] = useState<Record<string, boolean>>({});

  const toggleItemExpand = (itemKey: string) => {
    setExpandedItems((prev) => ({
      ...prev,
      [itemKey]: !prev[itemKey]
    }));
  };

  const handleAddRule = (itemKey: string) => {
    setEqTaskConfigs((prev) =>
      prev.map((config) => {
        if (config.itemKey !== itemKey) return config;
        return {
          ...config,
          rules: [
            ...config.rules,
            { targetHours: 1000, warningHours: 168, tasks: [""] }
          ]
        };
      })
    );
  };

  const handleUpdateRuleHours = (itemKey: string, ruleIdx: number, hoursVal: string) => {
    const hours = hoursVal === "" ? 0 : parseFloat(hoursVal);
    setEqTaskConfigs((prev) =>
      prev.map((config) => {
        if (config.itemKey !== itemKey) return config;
        const nextRules = [...config.rules];
        nextRules[ruleIdx] = {
          ...nextRules[ruleIdx],
          targetHours: isNaN(hours) ? nextRules[ruleIdx].targetHours : hours
        };
        return { ...config, rules: nextRules };
      })
    );
  };

  const handleUpdateWarningHours = (itemKey: string, ruleIdx: number, warnVal: string) => {
    const warn = warnVal === "" ? 0 : parseFloat(warnVal);
    setEqTaskConfigs((prev) =>
      prev.map((config) => {
        if (config.itemKey !== itemKey) return config;
        const nextRules = [...config.rules];
        nextRules[ruleIdx] = {
          ...nextRules[ruleIdx],
          warningHours: isNaN(warn) ? nextRules[ruleIdx].warningHours : warn
        };
        return { ...config, rules: nextRules };
      })
    );
  };

  const handleDeleteRule = (itemKey: string, ruleIdx: number) => {
    setEqTaskConfigs((prev) =>
      prev.map((config) => {
        if (config.itemKey !== itemKey) return config;
        return {
          ...config,
          rules: config.rules.filter((_, idx) => idx !== ruleIdx)
        };
      })
    );
  };

  const handleAddTaskDesc = (itemKey: string, ruleIdx: number) => {
    setEqTaskConfigs((prev) =>
      prev.map((config) => {
        if (config.itemKey !== itemKey) return config;
        const nextRules = [...config.rules];
        nextRules[ruleIdx] = {
          ...nextRules[ruleIdx],
          tasks: [...nextRules[ruleIdx].tasks, ""]
        };
        return { ...config, rules: nextRules };
      })
    );
  };

  const handleUpdateTaskDesc = (itemKey: string, ruleIdx: number, taskIdx: number, val: string) => {
    setEqTaskConfigs((prev) =>
      prev.map((config) => {
        if (config.itemKey !== itemKey) return config;
        const nextRules = [...config.rules];
        const nextTasks = [...nextRules[ruleIdx].tasks];
        nextTasks[taskIdx] = val;
        nextRules[ruleIdx] = {
          ...nextRules[ruleIdx],
          tasks: nextTasks
        };
        return { ...config, rules: nextRules };
      })
    );
  };

  const handleDeleteTaskDesc = (itemKey: string, ruleIdx: number, taskIdx: number) => {
    setEqTaskConfigs((prev) =>
      prev.map((config) => {
        if (config.itemKey !== itemKey) return config;
        const nextRules = [...config.rules];
        nextRules[ruleIdx] = {
          ...nextRules[ruleIdx],
          tasks: nextRules[ruleIdx].tasks.filter((_, idx) => idx !== taskIdx)
        };
        return { ...config, rules: nextRules };
      })
    );
  };

  const [successMsg, setSuccessMsg] = useState(false);

  const handleSensorSelectChange = (index: number, field: "direction", value: "above" | "below") => {
    setSensorRows((prev) => {
      const next = [...prev];
      next[index] = {
        ...next[index],
        [field]: value
      };
      return next;
    });
  };

  // Load configuration from localStorage or defaults
  useEffect(() => {
    // Sensor parameters load
    getJson<{ data: ConfigTagRow[] }>(`/config/sensor-rules?unitId=${unitId}`)
      .then((res) => {
        if (res && res.data && res.data.length > 0) {
          setSensorRows(res.data);
        } else {
          const defaults = getDefaultSensorConfigs(unitId);
          setSensorRows(defaults);
          postJson("/config/sensor-rules", { unitId, rules: defaults }).catch(err =>
            console.error("Failed to auto-save default sensor rules:", err)
          );
        }
      })
      .catch((err) => {
        console.error("Failed to load sensor rules:", err);
        setSensorRows(getDefaultSensorConfigs(unitId));
      });

    // Equipment configurations load
    if (isCoolingTower) {
      getJson<{ data: any[] }>("/config/rh-task-rules")
        .then((res) => {
          if (res && res.data) {
            setEqTaskConfigs(res.data);
          }
        })
        .catch((err) => console.error("Failed to load task rules:", err));
    } else {
      // standard machines load eqRows
      const savedEq = localStorage.getItem(`scada.config.eq.${unitId}`);
      if (savedEq) {
        try {
          setEqRows(JSON.parse(savedEq));
        } catch (e) {
          setEqRows(getDefaultEqConfigs(unitId));
        }
      } else {
        setEqRows(getDefaultEqConfigs(unitId));
      }
      setConfigTab("sensors");
    }
  }, [unitId, isCoolingTower]);

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

  const [isUnlocked, setIsUnlocked] = useState(false);
  const [passwordAction, setPasswordAction] = useState<"unlock" | "save" | null>(null);

  // Trigger password prompt to unlock
  const triggerUnlock = () => {
    setPasswordInput("");
    setPasswordError("");
    setPasswordAction("unlock");
    setShowPasswordModal(true);
  };

  // Trigger password prompt to save
  const handleSaveTrigger = () => {
    setPasswordInput("");
    setPasswordError("");
    setPasswordAction("save");
    setShowPasswordModal(true);
  };

  // Confirm password and execute action (unlock or save)
  const handleConfirmSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!passwordInput) {
      setPasswordError("Password is required");
      return;
    }
    setVerifyingPassword(true);
    setPasswordError("");

    try {
      const res = await postJson<{ valid: boolean }>("/auth/verify-password", { password: passwordInput });
      if (res && res.valid) {
        if (passwordAction === "unlock") {
          setIsUnlocked(true);
          setShowPasswordModal(false);
        } else {
          if (isCoolingTower) {
            // Save sensor thresholds to backend database
            await postJson("/config/sensor-rules", { unitId, rules: sensorRows });
            localStorage.setItem(`scada.config.${unitId}`, JSON.stringify(sensorRows));
            // Save custom task rules to database!
            await postJson("/config/rh-task-rules", eqTaskConfigs);
            
            // Map to flat rules array for client-side evaluation on P&ID page
            const flatRules: { id: string; motorKey: string; targetHours: number; warningHours: number; taskName: string }[] = [];
            let ruleIdCounter = 1;
            
            const GENERIC_TO_SPECIFIC_MAP: Record<string, string[]> = {
              "FAN": ["FAN-1", "FAN-2", "FAN-3"],
              "MTR": ["MTR-1", "MTR-2", "MTR-3", "MTR-4", "MTR-5", "MTR-6", "MTR-7", "MTR-8", "MTR-9"],
              "Dosing Pump": ["Dosing Pump 1", "Dosing Pump 2"],
              "Strainer": ["Strainer 1", "Strainer 2", "Strainer 3", "Strainer 4", "Strainer 5", "Strainer 6", "Strainer 7", "Strainer 8", "Strainer 9"],
              "Cooling Tower": ["CT 1", "CT 2", "CT 3"],
              "Cooling Tank": ["Cooling Tank"],
              "Panel": ["Panel"]
            };

            eqTaskConfigs.forEach((config) => {
              const specificKeys = GENERIC_TO_SPECIFIC_MAP[config.itemKey] || [config.itemKey];
              specificKeys.forEach((specKey) => {
                config.rules.forEach((rule) => {
                  rule.tasks.forEach((task) => {
                    if (task.trim()) {
                      flatRules.push({
                        id: String(ruleIdCounter++),
                        motorKey: specKey,
                        targetHours: rule.targetHours,
                        warningHours: rule.warningHours || 168,
                        taskName: task.trim()
                      });
                    }
                  });
                });
              });
            });
            localStorage.setItem("scada.config.rh.tasks", JSON.stringify(flatRules));
          } else {
            await postJson("/config/sensor-rules", { unitId, rules: sensorRows });
            localStorage.setItem(`scada.config.${unitId}`, JSON.stringify(sensorRows));
            localStorage.setItem(`scada.config.eq.${unitId}`, JSON.stringify(eqRows));
          }
          
          // Dispatch event so other listeners (e.g. evaluating thresholds) update immediately
          window.dispatchEvent(new Event("storage"));
          
          setIsUnlocked(false); // Lock it back after save
          setSuccessMsg(true);
          setShowPasswordModal(false);
          setTimeout(() => setSuccessMsg(false), 3000);
        }
      } else {
        setPasswordError("Incorrect password. Please try again.");
      }
    } catch (err) {
      console.error(err);
      setPasswordError("Error verifying password. Please try again.");
    } finally {
      setVerifyingPassword(false);
    }
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
          {isUnlocked ? (
            <button
              onClick={() => setIsUnlocked(false)}
              className="flex items-center gap-1.5 px-5 py-2.5 text-xs font-bold rounded-lg bg-red-600 hover:bg-red-700 text-white shadow-md shadow-red-600/25 transition duration-200"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
              Lock Configuration
            </button>
          ) : (
            <button
              onClick={triggerUnlock}
              className="flex items-center gap-1.5 px-5 py-2.5 text-xs font-bold rounded-lg bg-red-600 hover:bg-red-700 text-white shadow-md shadow-red-600/25 transition duration-200"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M8 11V7a4 4 0 118 0m-4 8v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2z" />
              </svg>
              Unlock to Edit
            </button>
          )}

          {successMsg && (
            <span className="text-xs font-bold text-emerald-500 animate-pulse bg-emerald-500/10 border border-emerald-500/20 px-3 py-1.5 rounded-lg">
              Configuration Saved Successfully!
            </span>
          )}
          <button
            onClick={handleSaveTrigger}
            disabled={!isUnlocked}
            className="flex items-center gap-1.5 px-5 py-2.5 text-xs font-bold rounded-lg bg-[#1f6fb5] hover:bg-[#155c99] text-white shadow-md shadow-[#1f6fb5]/25 transition duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2v-9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" />
            </svg>
            Save Configuration
          </button>
        </div>
      </div>

      {/* Internal configuration section sub-tabs */}
      {isCoolingTower && (
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
          <button
            onClick={() => setConfigTab("api-sources")}
            className={`px-4 py-2 text-xs font-bold rounded-lg transition ${
              configTab === "api-sources"
                ? "bg-[#1f6fb5] text-white shadow-sm"
                : "text-[#47729f] dark:text-slate-400 hover:text-[#002b5c] dark:hover:text-slate-200"
            }`}
          >
            API Sources
          </button>
        </div>
      )}

      {/* Configuration Inputs Table */}
      {configTab !== "api-sources" && (
        <div className="bg-white dark:bg-slate-950 border border-[#acd3ff] dark:border-slate-800 rounded-xl p-5 shadow-sm transition-colors duration-300">
        {configTab === "equipment" && (
          <div className="mb-4">
            <h4 className="text-sm font-extrabold text-[#002b5c] dark:text-slate-200 uppercase tracking-wide">
              Equipment Task Rules Configuration
            </h4>
            <p className="text-xs text-slate-400 mt-0.5">
              Define multiple running hour rules and custom maintenance tasks for each equipment item. Open tasks will populate in the P&ID diagram sidebar.
            </p>
          </div>
        )}
        <div className="overflow-x-auto">
          {configTab === "sensors" ? (
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-[#acd3ff]/50 dark:border-slate-800/50 text-[10px] uppercase tracking-wider text-[#47729f] dark:text-slate-500 font-bold">
                  <th className="pb-3 px-3">SCADA Parameter Tag</th>
                  <th className="pb-3 px-3 text-center w-24">Low Limit</th>
                  <th className="pb-3 px-3 text-center w-28">Baseline Setpoint</th>
                  <th className="pb-3 px-3 text-center w-24">High Limit</th>
                  <th className="pb-3 px-3 text-center w-28">Limit Rule</th>
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
                          disabled={!isUnlocked}
                          onChange={(e) => handleSensorNumChange(idx, "lowLimit", e.target.value)}
                          className="w-full text-center font-bold font-mono bg-transparent outline-none focus:ring-0 focus:border-transparent text-xs disabled:opacity-50"
                        />
                      </div>
                    </td>

                    <td className="py-4 px-3 text-center">
                      <div className="inline-flex items-center gap-1.5 border border-[#acd3ff] dark:border-slate-700 rounded px-2.5 py-1 bg-sky-500/5 dark:bg-slate-900/80 w-28">
                        <input
                          type="number"
                          step="0.01"
                          value={row.baseline}
                          disabled={!isUnlocked}
                          onChange={(e) => handleSensorNumChange(idx, "baseline", e.target.value)}
                          className="w-full text-center font-bold font-mono bg-transparent outline-none focus:ring-0 focus:border-transparent text-xs text-[#1f6fb5] dark:text-sky-400 disabled:opacity-50"
                        />
                      </div>
                    </td>

                    <td className="py-4 px-3 text-center">
                      <div className="inline-flex items-center gap-1.5 border border-[#d6e9fb] dark:border-slate-800 rounded px-2 py-1 bg-slate-50 dark:bg-slate-900 w-24">
                        <input
                          type="number"
                          step="0.01"
                          value={row.highLimit}
                          disabled={!isUnlocked}
                          onChange={(e) => handleSensorNumChange(idx, "highLimit", e.target.value)}
                          className="w-full text-center font-bold font-mono bg-transparent outline-none focus:ring-0 focus:border-transparent text-xs disabled:opacity-50"
                        />
                      </div>
                    </td>

                    <td className="py-4 px-3 text-center">
                      <select
                        value={row.direction || "above"}
                        disabled={!isUnlocked}
                        onChange={(e) => handleSensorSelectChange(idx, "direction", e.target.value as "above" | "below")}
                        className="rounded border border-[#acd3ff] dark:border-slate-800 bg-transparent text-[#002b5c] dark:text-slate-300 px-2 py-1 text-xs outline-none focus:ring-1 focus:ring-blue-500 font-bold disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        <option value="above" className="bg-white dark:bg-slate-950">Above</option>
                        <option value="below" className="bg-white dark:bg-slate-950">Below</option>
                      </select>
                    </td>

                    <td className="py-4 px-3 text-center">
                      <button
                        type="button"
                        disabled={!isUnlocked}
                        onClick={() => handleSensorCheckChange(idx, "enableAlert")}
                        className={`inline-flex items-center gap-1 px-3 py-1 rounded text-[10px] font-extrabold uppercase border transition disabled:opacity-50 disabled:cursor-not-allowed ${
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
                        disabled={!isUnlocked}
                        onClick={() => handleSensorCheckChange(idx, "suppressAlert")}
                        className={`inline-flex items-center gap-1 px-3 py-1 rounded text-[10px] font-extrabold uppercase border transition disabled:opacity-50 disabled:cursor-not-allowed ${
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
          ) : isCoolingTower ? (
            /* NEW NESTED EQUIPMENT RUNNING HOURS CONSOLE */
            <div className="space-y-3">
              {eqTaskConfigs.map((config) => {
                const isExpanded = !!expandedItems[config.itemKey];
                const totalRules = config.rules.length;
                return (
                  <div
                    key={config.itemKey}
                    className="border border-[#acd3ff] dark:border-slate-800 rounded-xl overflow-hidden bg-slate-50/20 dark:bg-slate-900/10 transition-colors"
                  >
                    {/* Collapsible Header */}
                    <div
                      onClick={() => toggleItemExpand(config.itemKey)}
                      className="flex items-center justify-between p-4 cursor-pointer hover:bg-slate-50/60 dark:hover:bg-slate-900/30 transition select-none"
                    >
                      <div className="flex items-center gap-3">
                        <span className="text-xs font-extrabold text-[#002b5c] dark:text-slate-100 uppercase tracking-wide">
                          {config.displayName}
                        </span>
                        <span className="px-2.5 py-0.5 rounded-full bg-blue-500/10 text-blue-500 text-[10px] font-bold">
                          {totalRules} {totalRules === 1 ? "Rule" : "Rules"}
                        </span>
                      </div>
                      <div className="flex items-center gap-3">
                        {totalRules > 0 && (
                          <span className="text-[10px] text-slate-400 font-mono hidden sm:inline">
                            Hours: {config.rules.map((r) => `${r.targetHours}h`).join(", ")}
                          </span>
                        )}
                        <svg
                          className={`w-4 h-4 text-slate-400 transition-transform duration-200 ${
                            isExpanded ? "transform rotate-180" : ""
                          }`}
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                          strokeWidth="2.5"
                        >
                          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                        </svg>
                      </div>
                    </div>

                    {/* Expanded Rules Content */}
                    {isExpanded && (
                      <div className="p-4 border-t border-[#acd3ff] dark:border-slate-800 bg-white dark:bg-slate-950/40 space-y-4">
                        {config.rules.length === 0 ? (
                          <div className="text-center py-4 text-slate-400 text-xs">
                            No rules defined yet. Click "Add Hours Rule" below to create one.
                          </div>
                        ) : (
                          <div className="space-y-4">
                            {config.rules.map((rule, ruleIdx) => (
                              <div
                                key={ruleIdx}
                                className="p-4 rounded-xl border border-slate-150 dark:border-slate-800 bg-slate-50/30 dark:bg-slate-900/10 space-y-3 relative"
                              >
                                <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-100 dark:border-slate-800/80 pb-2">
                                  <div className="flex flex-wrap items-center gap-4">
                                    <div className="flex items-center gap-2">
                                      <span className="text-xs font-bold text-slate-500 dark:text-slate-400">Trigger at:</span>
                                      <div className="inline-flex items-center gap-1 border border-[#acd3ff] dark:border-slate-700 rounded px-2 py-0.5 bg-white dark:bg-slate-900 w-24">
                                        <input
                                          type="number"
                                          value={rule.targetHours}
                                          disabled={!isUnlocked}
                                          onChange={(e) => handleUpdateRuleHours(config.itemKey, ruleIdx, e.target.value)}
                                          className="w-full text-center font-bold font-mono bg-transparent outline-none text-xs text-slate-800 dark:text-slate-100 disabled:opacity-50"
                                          placeholder="Hours"
                                        />
                                        <span className="text-[10px] text-slate-400 font-bold">h</span>
                                      </div>
                                    </div>
                                    
                                    <div className="flex items-center gap-2">
                                      <span className="text-xs font-bold text-slate-500 dark:text-slate-400">Warning buffer:</span>
                                      <div className="inline-flex items-center gap-1 border border-[#acd3ff] dark:border-slate-700 rounded px-2 py-0.5 bg-white dark:bg-slate-900 w-24">
                                        <input
                                          type="number"
                                          value={rule.warningHours ?? 168}
                                          disabled={!isUnlocked}
                                          onChange={(e) => handleUpdateWarningHours(config.itemKey, ruleIdx, e.target.value)}
                                          className="w-full text-center font-bold font-mono bg-transparent outline-none text-xs text-slate-800 dark:text-slate-100 disabled:opacity-50"
                                          placeholder="168"
                                        />
                                        <span className="text-[10px] text-slate-400 font-bold">h</span>
                                      </div>
                                      <span className="text-[10px] text-slate-400 font-semibold">before target</span>
                                    </div>
                                  </div>
                                  <button
                                    type="button"
                                    disabled={!isUnlocked}
                                    onClick={() => handleDeleteRule(config.itemKey, ruleIdx)}
                                    className="px-2 py-1 text-[10px] font-extrabold uppercase hover:bg-rose-500/10 text-rose-500 rounded transition border border-transparent hover:border-rose-500/25 disabled:opacity-50 disabled:cursor-not-allowed"
                                  >
                                    Delete Rule
                                  </button>
                                </div>

                                {/* Task Descriptions List */}
                                <div className="space-y-2">
                                  <div className="text-[10px] uppercase tracking-wider text-[#47729f] dark:text-slate-500 font-bold flex justify-between items-center">
                                    <span>Task Descriptions</span>
                                    <button
                                      type="button"
                                      disabled={!isUnlocked}
                                      onClick={() => handleAddTaskDesc(config.itemKey, ruleIdx)}
                                      className="text-blue-500 hover:text-blue-600 transition flex items-center gap-0.5 normal-case font-bold disabled:opacity-50 disabled:cursor-not-allowed"
                                    >
                                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                                      </svg>
                                      Add Task Description
                                    </button>
                                  </div>
                                  {rule.tasks.map((taskDesc, taskIdx) => (
                                    <div key={taskIdx} className="flex items-center gap-2">
                                      <input
                                        type="text"
                                        value={taskDesc}
                                        disabled={!isUnlocked}
                                        onChange={(e) => handleUpdateTaskDesc(config.itemKey, ruleIdx, taskIdx, e.target.value)}
                                        placeholder="e.g. Check belt tension, visual inspection"
                                        className="flex-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg px-3 py-1.5 text-xs outline-none focus:ring-1 focus:ring-blue-500 text-slate-850 dark:text-slate-200 font-semibold disabled:opacity-50"
                                      />
                                      {rule.tasks.length > 1 && (
                                        <button
                                          type="button"
                                          disabled={!isUnlocked}
                                          onClick={() => handleDeleteTaskDesc(config.itemKey, ruleIdx, taskIdx)}
                                          className="p-1.5 hover:bg-rose-500/10 text-rose-500 rounded border border-transparent hover:border-rose-500/25 transition disabled:opacity-50 disabled:cursor-not-allowed"
                                          title="Delete description"
                                        >
                                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                                            <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                          </svg>
                                        </button>
                                      )}
                                    </div>
                                  ))}
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                        <div className="pt-2">
                          <button
                            type="button"
                            disabled={!isUnlocked}
                            onClick={() => handleAddRule(config.itemKey)}
                            className="px-3.5 py-2 border border-dashed border-blue-500 hover:border-blue-600 text-blue-500 hover:bg-blue-500/5 rounded-lg text-xs font-bold transition flex items-center justify-center gap-1 w-full disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                            </svg>
                            Add Hours Rule
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          ) : (
            /* STANDARD NON-COOLING EQUIPMENT RUNNING HOURS TABLE */
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-[#acd3ff]/50 dark:border-slate-800/50 text-[10px] uppercase tracking-wider text-[#47729f] dark:text-slate-500 font-bold">
                  <th className="pb-3 px-3">Equipment SCADA Tag</th>
                  <th className="pb-3 px-3 text-center">P&ID Status</th>
                  <th className="pb-3 px-3 text-center w-24">Max Hours</th>
                  <th className="pb-3 px-3 text-center w-28">Enable Alert</th>
                  <th className="pb-3 px-3 text-center w-28">Suppress Alert</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-900 font-medium text-[#002b5c] dark:text-slate-300">
                {eqRows.map((row, idx) => (
                  <tr key={row.tagKey} className="hover:bg-slate-50/50 dark:hover:bg-slate-900/20 transition-colors">
                    <td className="py-3 px-3">
                      <div className="font-bold text-[#002b5c] dark:text-slate-200">{getEqDisplayTagKey(row.tagKey)}</div>
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
                          value={row.highLimit}
                          disabled={!isUnlocked}
                          onChange={(e) => handleEqNumChange(idx, "highLimit", e.target.value)}
                          className="w-full text-center font-bold font-mono bg-transparent outline-none focus:ring-0 focus:border-transparent text-xs disabled:opacity-50"
                        />
                      </div>
                    </td>

                    <td className="py-3 px-3 text-center">
                      <button
                        type="button"
                        disabled={!isUnlocked}
                        onClick={() => handleEqCheckChange(idx, "enableAlert")}
                        className={`inline-flex items-center gap-1 px-3 py-1 rounded text-[10px] font-extrabold uppercase border transition disabled:opacity-50 disabled:cursor-not-allowed ${
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
                        disabled={!isUnlocked}
                        onClick={() => handleEqCheckChange(idx, "suppressAlert")}
                        className={`inline-flex items-center gap-1 px-3 py-1 rounded text-[10px] font-extrabold uppercase border transition disabled:opacity-50 disabled:cursor-not-allowed ${
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
      )}

      {/* ═══════════════════════════════════════════════════════════ */}
      {/* API SOURCES MANAGEMENT PANEL                               */}
      {/* ═══════════════════════════════════════════════════════════ */}
      {configTab === "api-sources" && <ApiSourcesPanel unitId={unitId} />}

      {showPasswordModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="w-full max-w-md bg-white dark:bg-slate-900 border border-[#acd3ff] dark:border-slate-800 rounded-xl p-6 shadow-2xl animate-in fade-in zoom-in-95 duration-200">
            <h3 className="text-base font-bold text-[#002b5c] dark:text-slate-100 mb-2">
              {passwordAction === "unlock" ? "Unlock Configuration Editing" : "Confirm Configuration Change"}
            </h3>
            <p className="text-xs text-[#47729f] dark:text-slate-400 mb-4">
              {passwordAction === "unlock"
                ? "Unlocking edit mode requires administrator password verification. Please enter your password."
                : "Updating setpoints and rules requires administrator password verification. Please enter your password."}
            </p>
            <form onSubmit={handleConfirmSave} className="space-y-4">
              <div>
                <input
                  type="password"
                  placeholder="Enter Password"
                  value={passwordInput}
                  onChange={(e) => setPasswordInput(e.target.value)}
                  className="w-full px-3 py-2 border border-[#acd3ff] dark:border-slate-700 rounded-lg bg-transparent text-sm text-[#002b5c] dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500 font-bold"
                  autoFocus
                />
                {passwordError && (
                  <p className="text-xs text-red-500 font-semibold mt-1.5">{passwordError}</p>
                )}
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowPasswordModal(false)}
                  disabled={verifyingPassword}
                  className="px-4 py-2 text-xs font-bold text-[#47729f] hover:text-[#002b5c] dark:text-slate-400 dark:hover:text-slate-200 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={verifyingPassword}
                  className="px-5 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-lg flex items-center gap-1.5 shadow-md transition disabled:opacity-50"
                >
                  {verifyingPassword ? (
                    <>
                      <svg className="animate-spin h-3.5 w-3.5 text-white" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                      </svg>
                      Verifying...
                    </>
                  ) : (
                    "Verify & Save"
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

function HvacConfigConsole({ unitId, machine }: { unitId: string; machine: any }) {
  const [activeTab, setActiveTab] = useState<"ahu1" | "ahu2" | "ahu3" | "equipment" | "api-sources">("ahu1");
  const [activeSubTab, setActiveSubTab] = useState<"general" | "sensor" | "advanced">("general");

  const [hvacConfig, setHvacConfig] = useState<HvacConfig>(DEFAULT_HVAC_CONFIG);
  const [eqRows, setEqRows] = useState<ConfigEqRow[]>([]);
  const [successMsg, setSuccessMsg] = useState(false);

  useEffect(() => {
    const savedHvac = localStorage.getItem(`scada.config.hvac.${unitId}`);
    if (savedHvac) {
      try {
        setHvacConfig(JSON.parse(savedHvac));
      } catch (e) {
        setHvacConfig(DEFAULT_HVAC_CONFIG);
      }
    } else {
      setHvacConfig(DEFAULT_HVAC_CONFIG);
    }

    const savedEq = localStorage.getItem(`scada.config.eq.${unitId}`);
    if (savedEq) {
      try {
        setEqRows(JSON.parse(savedEq));
      } catch (e) {
        setEqRows(DEFAULT_HVAC_EQ_CONFIGS);
      }
    } else {
      setEqRows(DEFAULT_HVAC_EQ_CONFIGS);
    }
  }, [unitId]);

  const handleHvacChange = (ahu: "ahu1" | "ahu2" | "ahu3", field: string, value: string) => {
    const val = value === "" ? 0 : parseFloat(value);
    setHvacConfig((prev) => ({
      ...prev,
      [ahu]: {
        ...prev[ahu],
        [field]: isNaN(val) ? prev[ahu][field as keyof typeof prev[typeof ahu]] : val
      }
    }));
  };

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

  const handleSave = () => {
    localStorage.setItem(`scada.config.hvac.${unitId}`, JSON.stringify(hvacConfig));
    localStorage.setItem(`scada.config.eq.${unitId}`, JSON.stringify(eqRows));
    setSuccessMsg(true);
    setTimeout(() => setSuccessMsg(false), 3000);
  };

  if (!machine) return null;

  return (
    <div className="space-y-6">
      {/* Header Panel */}
      <div className="flex flex-wrap items-center justify-between gap-4 bg-[#f7fbff]/80 dark:bg-slate-950/70 border border-[#acd3ff] dark:border-slate-800 rounded-xl p-4 transition-colors duration-300 backdrop-blur-md">
        <div className="space-y-1">
          <h3 className="text-sm font-bold text-[#002b5c] dark:text-slate-100 uppercase tracking-wide">
            HVAC Config Console
          </h3>
          <p className="text-xs text-[#47729f] dark:text-slate-500">
            Set alarm parameter setpoints, sensor thresholds, deadbands, and equipment limit parameters.
          </p>
        </div>
        
        <div className="flex items-center gap-3">
          {successMsg && (
            <span className="text-xs font-bold text-emerald-500 animate-pulse bg-emerald-500/10 border border-emerald-500/20 px-3 py-1.5 rounded-lg">
              HVAC Configuration Saved Successfully!
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

      {/* Main Selection Tabs */}
      <div className="flex flex-wrap gap-2 p-1 bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800/80 rounded-xl w-fit">
        {[
          { id: "ahu1", label: "AHU-01 Clean Area" },
          { id: "ahu2", label: "AHU-02 Accelerated" },
          { id: "ahu3", label: "AHU-03 Long-term" },
          { id: "equipment", label: "Equipment Running Hours" },
          { id: "api-sources", label: "API Sources" }
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            className={`px-4 py-2 text-xs font-bold rounded-lg transition ${
              activeTab === tab.id
                ? "bg-[#1f6fb5] text-white shadow-sm"
                : "text-[#47729f] dark:text-slate-400 hover:text-[#002b5c] dark:hover:text-slate-200"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Room Tabs content */}
      {activeTab !== "equipment" && activeTab !== "api-sources" && (
        <div className="space-y-6">
          {/* Sub tabs (General / Sensor / Advanced) - Show only for AHU-01 and AHU-02 */}
          {activeTab !== "ahu3" && (
            <div className="flex gap-2 border-b border-slate-200 dark:border-slate-800 pb-0.5">
              {[
                { id: "general", label: "General Setting" },
                { id: "sensor", label: "Sensor Setting" },
                { id: "advanced", label: "Advance Setting" }
              ].map((subTab) => (
                <button
                  key={subTab.id}
                  onClick={() => setActiveSubTab(subTab.id as any)}
                  className={`px-3 py-2 text-xs font-bold transition border-b-2 -mb-0.5 ${
                    activeSubTab === subTab.id
                      ? "border-[#1f6fb5] text-[#1f6fb5] dark:text-sky-400 font-extrabold"
                      : "border-transparent text-[#47729f] dark:text-slate-400 hover:text-[#002b5c] dark:hover:text-slate-200"
                  }`}
                >
                  {subTab.label}
                </button>
              ))}
            </div>
          )}

          {/* Configuration Form Body */}
          <div className="bg-white dark:bg-slate-950 border border-[#acd3ff] dark:border-slate-800 rounded-xl p-5 shadow-sm">
            {activeTab === "ahu3" ? (
              // Simple Form for AHU-03 (Stability Room)
              <div className="space-y-4">
                <h4 className="text-xs font-bold text-[#002b5c] dark:text-slate-200 uppercase tracking-wide border-b border-[#acd3ff]/30 pb-2 mb-3">
                  AHU-03 Stability Room Parameters
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-[10px] text-slate-500 dark:text-slate-400 font-bold uppercase block">
                      Room Temp Setpoint (°C)
                    </label>
                    <input
                      type="number"
                      step="0.1"
                      value={hvacConfig.ahu3.tempSp}
                      onChange={(e) => handleHvacChange("ahu3", "tempSp", e.target.value)}
                      className="w-full rounded-md border border-[#acd3ff] dark:border-slate-800 bg-slate-50 dark:bg-slate-900 px-3 py-2 text-xs font-bold text-[#002b5c] dark:text-slate-100 font-mono focus:outline-none focus:ring-1 focus:ring-[#1f6fb5]"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] text-slate-500 dark:text-slate-400 font-bold uppercase block">
                      High Temp Alarm (°C)
                    </label>
                    <input
                      type="number"
                      step="0.1"
                      value={hvacConfig.ahu3.highTemp}
                      onChange={(e) => handleHvacChange("ahu3", "highTemp", e.target.value)}
                      className="w-full rounded-md border border-[#acd3ff] dark:border-slate-800 bg-slate-50 dark:bg-slate-900 px-3 py-2 text-xs font-bold text-[#002b5c] dark:text-slate-100 font-mono focus:outline-none focus:ring-1 focus:ring-[#1f6fb5]"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] text-slate-500 dark:text-slate-400 font-bold uppercase block">
                      Low Temp Alarm (°C)
                    </label>
                    <input
                      type="number"
                      step="0.1"
                      value={hvacConfig.ahu3.lowTemp}
                      onChange={(e) => handleHvacChange("ahu3", "lowTemp", e.target.value)}
                      className="w-full rounded-md border border-[#acd3ff] dark:border-slate-800 bg-slate-50 dark:bg-slate-900 px-3 py-2 text-xs font-bold text-[#002b5c] dark:text-slate-100 font-mono focus:outline-none focus:ring-1 focus:ring-[#1f6fb5]"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] text-slate-500 dark:text-slate-400 font-bold uppercase block">
                      Alarm Delay (min)
                    </label>
                    <input
                      type="number"
                      value={hvacConfig.ahu3.alarmDelay}
                      onChange={(e) => handleHvacChange("ahu3", "alarmDelay", e.target.value)}
                      className="w-full rounded-md border border-[#acd3ff] dark:border-slate-800 bg-slate-50 dark:bg-slate-900 px-3 py-2 text-xs font-bold text-[#002b5c] dark:text-slate-100 font-mono focus:outline-none focus:ring-1 focus:ring-[#1f6fb5]"
                    />
                  </div>
                </div>
              </div>
            ) : activeSubTab === "general" ? (
              // General settings subtab for AHU-1/AHU-2
              <div className="space-y-4">
                <h4 className="text-xs font-bold text-[#002b5c] dark:text-slate-200 uppercase tracking-wide border-b border-[#acd3ff]/30 pb-2 mb-3">
                  General Room Control Parameters ({activeTab === "ahu1" ? "AHU-01 Clean Area" : "AHU-02 Reference Area"})
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                  <div className="space-y-1.5">
                    <label className="text-[10px] text-slate-500 dark:text-slate-400 font-bold uppercase block">
                      Room Temperature Setpoint (°C)
                    </label>
                    <input
                      type="number"
                      step="0.1"
                      value={hvacConfig[activeTab].tempSp}
                      onChange={(e) => handleHvacChange(activeTab, "tempSp", e.target.value)}
                      className="w-full rounded-md border border-[#acd3ff] dark:border-slate-800 bg-slate-50 dark:bg-slate-900 px-3 py-2 text-xs font-bold text-[#002b5c] dark:text-slate-100 font-mono focus:outline-none focus:ring-1 focus:ring-[#1f6fb5]"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] text-slate-500 dark:text-slate-400 font-bold uppercase block">
                      Room Humidity Setpoint (%RH)
                    </label>
                    <input
                      type="number"
                      step="0.1"
                      value={hvacConfig[activeTab].humiditySp}
                      onChange={(e) => handleHvacChange(activeTab, "humiditySp", e.target.value)}
                      className="w-full rounded-md border border-[#acd3ff] dark:border-slate-800 bg-slate-50 dark:bg-slate-900 px-3 py-2 text-xs font-bold text-[#002b5c] dark:text-slate-100 font-mono focus:outline-none focus:ring-1 focus:ring-[#1f6fb5]"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] text-slate-500 dark:text-slate-400 font-bold uppercase block">
                      Supply Fan Capacity (%)
                    </label>
                    <input
                      type="number"
                      value={hvacConfig[activeTab].sfCapacity}
                      onChange={(e) => handleHvacChange(activeTab, "sfCapacity", e.target.value)}
                      className="w-full rounded-md border border-[#acd3ff] dark:border-slate-800 bg-slate-50 dark:bg-slate-900 px-3 py-2 text-xs font-bold text-[#002b5c] dark:text-slate-100 font-mono focus:outline-none focus:ring-1 focus:ring-[#1f6fb5]"
                    />
                  </div>
                  {activeTab === "ahu1" ? (
                    <>
                      <div className="space-y-1.5">
                        <label className="text-[10px] text-slate-500 dark:text-slate-400 font-bold uppercase block">
                          Electric Heater 1 (EH-01) Steps
                        </label>
                        <input
                          type="number"
                          value={hvacConfig.ahu1.eh1Capacity}
                          onChange={(e) => handleHvacChange("ahu1", "eh1Capacity", e.target.value)}
                          className="w-full rounded-md border border-[#acd3ff] dark:border-slate-800 bg-slate-50 dark:bg-slate-900 px-3 py-2 text-xs font-bold text-[#002b5c] dark:text-slate-100 font-mono focus:outline-none focus:ring-1 focus:ring-[#1f6fb5]"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-[10px] text-slate-500 dark:text-slate-400 font-bold uppercase block">
                          Electric Heater 2 (EH-02) Steps
                        </label>
                        <input
                          type="number"
                          value={hvacConfig.ahu1.eh2Capacity}
                          onChange={(e) => handleHvacChange("ahu1", "eh2Capacity", e.target.value)}
                          className="w-full rounded-md border border-[#acd3ff] dark:border-slate-800 bg-slate-50 dark:bg-slate-900 px-3 py-2 text-xs font-bold text-[#002b5c] dark:text-slate-100 font-mono focus:outline-none focus:ring-1 focus:ring-[#1f6fb5]"
                        />
                      </div>
                    </>
                  ) : (
                    <div className="space-y-1.5">
                      <label className="text-[10px] text-slate-500 dark:text-slate-400 font-bold uppercase block">
                        Electric Heater (EH) Capacity (%)
                      </label>
                      <input
                        type="number"
                        value={hvacConfig.ahu2.ehCapacity}
                        onChange={(e) => handleHvacChange("ahu2", "ehCapacity", e.target.value)}
                        className="w-full rounded-md border border-[#acd3ff] dark:border-slate-800 bg-slate-50 dark:bg-slate-900 px-3 py-2 text-xs font-bold text-[#002b5c] dark:text-slate-100 font-mono focus:outline-none focus:ring-1 focus:ring-[#1f6fb5]"
                      />
                    </div>
                  )}
                  <div className="space-y-1.5">
                    <label className="text-[10px] text-slate-500 dark:text-slate-400 font-bold uppercase block">
                      Cool Down Time (min)
                    </label>
                    <input
                      type="number"
                      value={hvacConfig[activeTab].coolDownTime}
                      onChange={(e) => handleHvacChange(activeTab, "coolDownTime", e.target.value)}
                      className="w-full rounded-md border border-[#acd3ff] dark:border-slate-800 bg-slate-50 dark:bg-slate-900 px-3 py-2 text-xs font-bold text-[#002b5c] dark:text-slate-100 font-mono focus:outline-none focus:ring-1 focus:ring-[#1f6fb5]"
                    />
                  </div>
                </div>
              </div>
            ) : activeSubTab === "sensor" ? (
              // Sensor alarm bounds settings subtab for AHU-1/AHU-2
              <div className="space-y-4">
                <h4 className="text-xs font-bold text-[#002b5c] dark:text-slate-200 uppercase tracking-wide border-b border-[#acd3ff]/30 pb-2 mb-3">
                  Safety Sensor Limits & Alarm Bounds
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                  <div className="space-y-1.5">
                    <label className="text-[10px] text-slate-500 dark:text-slate-400 font-bold uppercase block">
                      High Temp Alarm Limit (°C)
                    </label>
                    <input
                      type="number"
                      step="0.1"
                      value={hvacConfig[activeTab].highTemp}
                      onChange={(e) => handleHvacChange(activeTab, "highTemp", e.target.value)}
                      className="w-full rounded-md border border-[#acd3ff] dark:border-slate-800 bg-slate-50 dark:bg-slate-900 px-3 py-2 text-xs font-bold text-[#002b5c] dark:text-slate-100 font-mono focus:outline-none focus:ring-1 focus:ring-[#1f6fb5]"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] text-slate-500 dark:text-slate-400 font-bold uppercase block">
                      Low Temp Alarm Limit (°C)
                    </label>
                    <input
                      type="number"
                      step="0.1"
                      value={hvacConfig[activeTab].lowTemp}
                      onChange={(e) => handleHvacChange(activeTab, "lowTemp", e.target.value)}
                      className="w-full rounded-md border border-[#acd3ff] dark:border-slate-800 bg-slate-50 dark:bg-slate-900 px-3 py-2 text-xs font-bold text-[#002b5c] dark:text-slate-100 font-mono focus:outline-none focus:ring-1 focus:ring-[#1f6fb5]"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] text-slate-500 dark:text-slate-400 font-bold uppercase block">
                      High Humidity Alarm Limit (%RH)
                    </label>
                    <input
                      type="number"
                      step="0.1"
                      value={hvacConfig[activeTab].highHumidity}
                      onChange={(e) => handleHvacChange(activeTab, "highHumidity", e.target.value)}
                      className="w-full rounded-md border border-[#acd3ff] dark:border-slate-800 bg-slate-50 dark:bg-slate-900 px-3 py-2 text-xs font-bold text-[#002b5c] dark:text-slate-100 font-mono focus:outline-none focus:ring-1 focus:ring-[#1f6fb5]"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] text-slate-500 dark:text-slate-400 font-bold uppercase block">
                      Low Humidity Alarm Limit (%RH)
                    </label>
                    <input
                      type="number"
                      step="0.1"
                      value={hvacConfig[activeTab].lowHumidity}
                      onChange={(e) => handleHvacChange(activeTab, "lowHumidity", e.target.value)}
                      className="w-full rounded-md border border-[#acd3ff] dark:border-slate-800 bg-slate-50 dark:bg-slate-900 px-3 py-2 text-xs font-bold text-[#002b5c] dark:text-slate-100 font-mono focus:outline-none focus:ring-1 focus:ring-[#1f6fb5]"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] text-slate-500 dark:text-slate-400 font-bold uppercase block">
                      Alarm Delay (min)
                    </label>
                    <input
                      type="number"
                      value={hvacConfig[activeTab].alarmDelay}
                      onChange={(e) => handleHvacChange(activeTab, "alarmDelay", e.target.value)}
                      className="w-full rounded-md border border-[#acd3ff] dark:border-slate-800 bg-slate-50 dark:bg-slate-900 px-3 py-2 text-xs font-bold text-[#002b5c] dark:text-slate-100 font-mono focus:outline-none focus:ring-1 focus:ring-[#1f6fb5]"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] text-slate-500 dark:text-slate-400 font-bold uppercase block">
                      Stop Buzzer Delay (min)
                    </label>
                    <input
                      type="number"
                      value={hvacConfig[activeTab].stopBuzzer}
                      onChange={(e) => handleHvacChange(activeTab, "stopBuzzer", e.target.value)}
                      className="w-full rounded-md border border-[#acd3ff] dark:border-slate-800 bg-slate-50 dark:bg-slate-900 px-3 py-2 text-xs font-bold text-[#002b5c] dark:text-slate-100 font-mono focus:outline-none focus:ring-1 focus:ring-[#1f6fb5]"
                    />
                  </div>
                </div>
              </div>
            ) : (
              // Advanced settings subtab for AHU-1/AHU-2
              <div className="space-y-4">
                <h4 className="text-xs font-bold text-[#002b5c] dark:text-slate-200 uppercase tracking-wide border-b border-[#acd3ff]/30 pb-2 mb-3">
                  Deadband (DB) Offsets & Calibrations
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                  <div className="space-y-1.5">
                    <label className="text-[10px] text-slate-500 dark:text-slate-400 font-bold uppercase block">
                      Deadband Temperature Offset 1 (°C)
                    </label>
                    <input
                      type="number"
                      step="0.1"
                      value={hvacConfig[activeTab].dbTemp1}
                      onChange={(e) => handleHvacChange(activeTab, "dbTemp1", e.target.value)}
                      className="w-full rounded-md border border-[#acd3ff] dark:border-slate-800 bg-slate-50 dark:bg-slate-900 px-3 py-2 text-xs font-bold text-[#002b5c] dark:text-slate-100 font-mono focus:outline-none focus:ring-1 focus:ring-[#1f6fb5]"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] text-slate-500 dark:text-slate-400 font-bold uppercase block">
                      Deadband Temperature Offset 2 (°C)
                    </label>
                    <input
                      type="number"
                      step="0.1"
                      value={hvacConfig[activeTab].dbTemp2}
                      onChange={(e) => handleHvacChange(activeTab, "dbTemp2", e.target.value)}
                      className="w-full rounded-md border border-[#acd3ff] dark:border-slate-800 bg-slate-50 dark:bg-slate-900 px-3 py-2 text-xs font-bold text-[#002b5c] dark:text-slate-100 font-mono focus:outline-none focus:ring-1 focus:ring-[#1f6fb5]"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] text-slate-500 dark:text-slate-400 font-bold uppercase block">
                      Deadband Humidity Offset 1 (%RH)
                    </label>
                    <input
                      type="number"
                      step="0.1"
                      value={hvacConfig[activeTab].dbHumid1}
                      onChange={(e) => handleHvacChange(activeTab, "dbHumid1", e.target.value)}
                      className="w-full rounded-md border border-[#acd3ff] dark:border-slate-800 bg-slate-50 dark:bg-slate-900 px-3 py-2 text-xs font-bold text-[#002b5c] dark:text-slate-100 font-mono focus:outline-none focus:ring-1 focus:ring-[#1f6fb5]"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] text-slate-500 dark:text-slate-400 font-bold uppercase block">
                      Deadband Humidity Offset 2 (%RH)
                    </label>
                    <input
                      type="number"
                      step="0.1"
                      value={hvacConfig[activeTab].dbHumid2}
                      onChange={(e) => handleHvacChange(activeTab, "dbHumid2", e.target.value)}
                      className="w-full rounded-md border border-[#acd3ff] dark:border-slate-800 bg-slate-50 dark:bg-slate-900 px-3 py-2 text-xs font-bold text-[#002b5c] dark:text-slate-100 font-mono focus:outline-none focus:ring-1 focus:ring-[#1f6fb5]"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] text-slate-500 dark:text-slate-400 font-bold uppercase block">
                      Deadband Humidity Offset 3 (%RH)
                    </label>
                    <input
                      type="number"
                      step="0.1"
                      value={hvacConfig[activeTab].dbHumid3}
                      onChange={(e) => handleHvacChange(activeTab, "dbHumid3", e.target.value)}
                      className="w-full rounded-md border border-[#acd3ff] dark:border-slate-800 bg-slate-50 dark:bg-slate-900 px-3 py-2 text-xs font-bold text-[#002b5c] dark:text-slate-100 font-mono focus:outline-none focus:ring-1 focus:ring-[#1f6fb5]"
                    />
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Equipment Running Hours Settings Tab */}
      {activeTab === "equipment" && (
        <div className="bg-white dark:bg-slate-950 border border-[#acd3ff] dark:border-slate-800 rounded-xl p-5 shadow-sm">
          <h4 className="text-xs font-bold text-[#002b5c] dark:text-slate-200 uppercase tracking-wide border-b border-[#acd3ff]/30 pb-2 mb-4">
            Equipment running hours bounds
          </h4>
          <div className="overflow-x-auto max-h-[500px] overflow-y-auto pr-2">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-[#acd3ff]/50 dark:border-slate-800/50 text-[10px] uppercase tracking-wider text-[#47729f] dark:text-slate-500 font-bold">
                  <th className="pb-3 px-3">Equipment Component Tag</th>
                  <th className="pb-3 px-3 text-center">P&ID Live Status</th>
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
                    <td className="py-3.5 px-3">
                      <div className="font-bold text-[#002b5c] dark:text-slate-200">{row.tagName}</div>
                      <div className="text-[10px] text-slate-400 mt-0.5">{row.tagKey}</div>
                    </td>

                    <td className="py-3.5 px-3 text-center">
                      <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded text-[9px] font-extrabold tracking-wider ${
                        row.status === "ON"
                          ? "bg-sky-500/10 text-sky-500 border border-sky-500/20"
                          : "bg-rose-500/10 text-rose-500 border border-rose-500/20"
                      }`}>
                        {row.status}
                      </span>
                    </td>

                    <td className="py-3.5 px-3 text-center">
                      <div className="inline-flex items-center gap-1.5 border border-[#d6e9fb] dark:border-slate-800 rounded px-2 py-1 bg-slate-50 dark:bg-slate-900 w-24">
                        <input
                          type="number"
                          value={row.lowLimit}
                          onChange={(e) => handleEqNumChange(idx, "lowLimit", e.target.value)}
                          className="w-full text-center font-bold font-mono bg-transparent outline-none focus:ring-0 focus:border-transparent text-xs"
                        />
                      </div>
                    </td>

                    <td className="py-3.5 px-3 text-center">
                      <div className="inline-flex items-center gap-1.5 border border-[#acd3ff] dark:border-slate-700 rounded px-2.5 py-1 bg-sky-500/5 dark:bg-slate-900/80 w-28">
                        <input
                          type="number"
                          value={row.baseline}
                          onChange={(e) => handleEqNumChange(idx, "baseline", e.target.value)}
                          className="w-full text-center font-bold font-mono bg-transparent outline-none focus:ring-0 focus:border-transparent text-xs text-[#1f6fb5] dark:text-sky-400"
                        />
                      </div>
                    </td>

                    <td className="py-3.5 px-3 text-center">
                      <div className="inline-flex items-center gap-1.5 border border-[#d6e9fb] dark:border-slate-800 rounded px-2 py-1 bg-slate-50 dark:bg-slate-900 w-24">
                        <input
                          type="number"
                          value={row.highLimit}
                          onChange={(e) => handleEqNumChange(idx, "highLimit", e.target.value)}
                          className="w-full text-center font-bold font-mono bg-transparent outline-none focus:ring-0 focus:border-transparent text-xs"
                        />
                      </div>
                    </td>

                    <td className="py-3.5 px-3 text-center">
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

                    <td className="py-3.5 px-3 text-center">
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
          </div>
        </div>
      )}

      {activeTab === "api-sources" && (
        <ApiSourcesPanel unitId={unitId} />
      )}
    </div>
  );
}

export function ApiSourcesPanel({ unitId }: { unitId: string }) {
  const [sources, setSources] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  
  // Form State
  const [nameInput, setNameInput] = useState("");
  const [urlInput, setUrlInput] = useState(
    unitId.startsWith("cooling-water")
      ? "http://10.3.164.3:8088/system/webdev/Utility_Dashboard/cooling3"
      : unitId === "hvac-qc-retained-sample"
      ? "http://10.3.164.3:8088/system/webdev/Utility_Dashboard/ahu_sample"
      : ""
  );
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<any | null>(null);
  const [testError, setTestError] = useState<string | null>(null);
  const [testStatus, setTestStatus] = useState<number | null>(null);
  
  // Selection State
  const [selectedFields, setSelectedFields] = useState<Record<string, boolean>>({});
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState<string | null>(null);
  const [saveLoading, setSaveLoading] = useState(false);
  const [rawJsonOpen, setRawJsonOpen] = useState(false);

  // Fetch registered API sources for this unitId
  const loadSources = useCallback(async () => {
    setLoading(true);
    try {
      const res = await getJson<{ data: any[] }>(`/config/api-sources?unitId=${unitId}`);
      if (res && res.data) {
        setSources(res.data);
      }
    } catch (err: any) {
      console.error("Failed to load API sources:", err);
    } finally {
      setLoading(false);
    }
  }, [unitId]);

  useEffect(() => {
    loadSources();
  }, [loadSources]);

  // Test Fetch handler
  const handleTestFetch = async (targetUrl?: string) => {
    const url = targetUrl || urlInput;
    if (!url.trim()) {
      setTestError("Please enter a valid API URL endpoint.");
      return;
    }
    setTesting(true);
    setTestError(null);
    setTestResult(null);
    setTestStatus(null);

    try {
      const res = await postJson<{ success: boolean; status: number; data?: any; error?: string }>("/config/api-sources/test", {
        url: url.trim(),
        method: "GET"
      });
      setTestStatus(res.status);
      if (res.success && res.data) {
        setTestResult(res.data);
        // Pre-select keys
        if (typeof res.data === "object" && res.data !== null) {
          const keysMap: Record<string, boolean> = { ...selectedFields };
          Object.keys(res.data).forEach(k => {
            if (keysMap[k] === undefined) {
              keysMap[k] = true;
            }
          });
          setSelectedFields(keysMap);
        }
      } else {
        setTestError(res.error || `HTTP Status ${res.status}`);
      }
    } catch (err: any) {
      setTestError(err.message || "Failed to fetch from API target.");
    } finally {
      setTesting(false);
    }
  };

  const handleSelectAll = (select: boolean) => {
    if (!testResult || typeof testResult !== "object") return;
    const updated: Record<string, boolean> = {};
    Object.keys(testResult).forEach(k => {
      updated[k] = select;
    });
    setSelectedFields(updated);
  };

  const handleToggleField = (key: string) => {
    setSelectedFields(prev => ({
      ...prev,
      [key]: !prev[key]
    }));
  };

  // Save handler (saveMode: "test" | "polling")
  const handleSaveApiSource = async (saveMode: "test" | "polling") => {
    if (!urlInput.trim()) {
      setTestError("URL Endpoint is required.");
      return;
    }

    setSaveLoading(true);
    setTestError(null);

    const fields = Object.keys(selectedFields).filter(k => selectedFields[k]);
    const name = nameInput.trim() || `API Source (${urlInput.split("/").pop() || "Endpoint"})`;

    const payload = {
      name,
      url: urlInput.trim(),
      unitId,
      method: "GET",
      headers: {},
      pollingIntervalMs: 2000,
      selectedFields: fields,
      enabled: saveMode === "polling",
      mode: saveMode
    };

    try {
      if (editingId) {
        await patchJson(`/config/api-sources/${editingId}`, payload);
        setSaveSuccess(`API Source "${name}" updated successfully (${saveMode === "polling" ? "Polling Active" : "Test Mode Only"})!`);
      } else {
        await postJson("/config/api-sources", payload);
        setSaveSuccess(`API Source "${name}" registered successfully (${saveMode === "polling" ? "Polling Active" : "Test Mode Only"})!`);
      }
      
      setTimeout(() => setSaveSuccess(null), 4000);
      setNameInput("");
      setEditingId(null);
      setTestResult(null);
      setSelectedFields({});
      loadSources();
    } catch (err: any) {
      setTestError("Failed to save API source: " + (err.message || "Unknown error"));
    } finally {
      setSaveLoading(false);
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Are you sure you want to delete API Source "${name}"?`)) return;
    try {
      await deleteJson(`/config/api-sources/${id}`);
      loadSources();
    } catch (err: any) {
      alert("Failed to delete: " + err.message);
    }
  };

  const handleEdit = (source: any) => {
    setEditingId(source._id);
    setNameInput(source.name);
    setUrlInput(source.url);
    const selMap: Record<string, boolean> = {};
    (source.selectedFields || []).forEach((f: string) => {
      selMap[f] = true;
    });
    setSelectedFields(selMap);
    handleTestFetch(source.url);
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setNameInput("");
    setTestResult(null);
    setSelectedFields({});
  };

  return (
    <div className="space-y-6">
      {/* Registered API Sources Table */}
      <div className="bg-white dark:bg-slate-950 border border-[#acd3ff] dark:border-slate-800 rounded-xl p-5 shadow-sm transition-colors duration-300">
        <div className="flex flex-wrap items-center justify-between gap-4 mb-4 pb-3 border-b border-slate-100 dark:border-slate-800">
          <div>
            <h4 className="text-sm font-extrabold text-[#002b5c] dark:text-slate-200 uppercase tracking-wide flex items-center gap-2">
              Registered Backend API Sources
              <span className="px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-500 text-[10px] font-bold">
                {sources.length} Configured
              </span>
            </h4>
            <p className="text-xs text-slate-400 mt-0.5">
              List of registered HTTP API endpoints for machine telemetry integration.
            </p>
          </div>
        </div>

        {loading ? (
          <div className="py-8 text-center text-xs text-slate-400">Loading API sources...</div>
        ) : sources.length === 0 ? (
          <div className="py-8 text-center border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-xl">
            <p className="text-xs text-slate-400 font-semibold mb-1">No API sources registered for this machine yet.</p>
            <p className="text-[11px] text-slate-500">Use the form below to test and register an API endpoint.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-[#acd3ff]/50 dark:border-slate-800/50 text-[10px] uppercase tracking-wider text-[#47729f] dark:text-slate-500 font-bold">
                  <th className="pb-3 px-3">API Source Name</th>
                  <th className="pb-3 px-3">Endpoint URL</th>
                  <th className="pb-3 px-3 text-center">Status / Mode</th>
                  <th className="pb-3 px-3 text-center">Selected Variables</th>
                  <th className="pb-3 px-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-900 font-medium text-[#002b5c] dark:text-slate-300">
                {sources.map((s) => (
                  <tr key={s._id} className="hover:bg-slate-50/50 dark:hover:bg-slate-900/20 transition-colors">
                    <td className="py-3 px-3 font-bold text-[#002b5c] dark:text-slate-200">
                      {s.name}
                    </td>
                    <td className="py-3 px-3 font-mono text-[11px] text-blue-600 dark:text-blue-400 truncate max-w-xs" title={s.url}>
                      {s.url}
                    </td>
                    <td className="py-3 px-3 text-center">
                      <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded text-[10px] font-extrabold uppercase border ${
                        s.mode === "polling" || s.enabled
                          ? "bg-emerald-500/10 text-emerald-500 border-emerald-500/20"
                          : "bg-amber-500/10 text-amber-500 border-amber-500/20"
                      }`}>
                        {s.mode === "polling" || s.enabled ? "⚡ Polling Active" : "🧪 Test Mode"}
                      </span>
                    </td>
                    <td className="py-3 px-3 text-center">
                      <span className="px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-[10px] font-mono font-bold text-slate-600 dark:text-slate-300">
                        {(s.selectedFields || []).length} Keys Selected
                      </span>
                    </td>
                    <td className="py-3 px-3 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => handleTestFetch(s.url)}
                          className="px-2.5 py-1 bg-sky-500/10 hover:bg-sky-500/20 text-sky-500 rounded text-[10px] font-bold transition"
                        >
                          Test Fetch
                        </button>
                        <button
                          type="button"
                          onClick={() => handleEdit(s)}
                          className="px-2.5 py-1 bg-amber-500/10 hover:bg-amber-500/20 text-amber-500 rounded text-[10px] font-bold transition"
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDelete(s._id, s.name)}
                          className="px-2.5 py-1 bg-rose-500/10 hover:bg-rose-500/20 text-rose-500 rounded text-[10px] font-bold transition"
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* API Configuration & Testing Form Card */}
      <div className="bg-white dark:bg-slate-950 border border-[#acd3ff] dark:border-slate-800 rounded-xl p-5 shadow-sm transition-colors duration-300 space-y-5">
        <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
          <div>
            <h4 className="text-sm font-extrabold text-[#002b5c] dark:text-slate-200 uppercase tracking-wide">
              {editingId ? "Edit Registered API Source" : "Register New API Endpoint"}
            </h4>
            <p className="text-xs text-slate-400 mt-0.5">
              Input URL, test JSON fetch response, select variables to extract, and configure storage/polling behavior.
            </p>
          </div>
          {editingId && (
            <button
              onClick={handleCancelEdit}
              className="text-xs font-bold text-slate-400 hover:text-slate-200 transition"
            >
              Cancel Edit
            </button>
          )}
        </div>

        {saveSuccess && (
          <div className="p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-lg text-xs font-bold text-emerald-500 animate-in fade-in">
            {saveSuccess}
          </div>
        )}

        {testError && (
          <div className="p-3 bg-rose-500/10 border border-rose-500/30 rounded-lg text-xs font-semibold text-rose-500">
            {testError}
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-bold text-[#002b5c] dark:text-slate-300 mb-1">
              API Source Name <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              value={nameInput}
              onChange={(e) => setNameInput(e.target.value)}
              placeholder="e.g. Cooling Tower WF1-U3 Status & LOT API"
              className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg text-xs outline-none focus:ring-1 focus:ring-blue-500 font-semibold text-slate-800 dark:text-slate-200"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-[#002b5c] dark:text-slate-300 mb-1">
              Endpoint URL <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              value={urlInput}
              onChange={(e) => setUrlInput(e.target.value)}
              placeholder="http://10.3.164.3:8088/system/webdev/Utility_Dashboard/cooling3"
              className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg text-xs outline-none focus:ring-1 focus:ring-blue-500 font-mono text-slate-800 dark:text-slate-200"
            />
          </div>
        </div>

        <div className="flex items-center justify-between pt-1">
          <button
            type="button"
            disabled={testing || !urlInput.trim()}
            onClick={() => handleTestFetch()}
            className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-bold text-xs rounded-lg shadow-md shadow-blue-600/20 transition flex items-center gap-2"
          >
            {testing ? (
              <>
                <svg className="animate-spin h-3.5 w-3.5 text-white" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                Fetching API Data...
              </>
            ) : (
              <>
                🧪 Test Fetch & Read Variables
              </>
            )}
          </button>
        </div>

        {/* JSON RESPONSE & VARIABLE SELECTION TABLE */}
        {testResult && typeof testResult === "object" && (
          <div className="border border-slate-200 dark:border-slate-800 rounded-xl p-4 bg-slate-50/50 dark:bg-slate-900/40 space-y-4 animate-in fade-in duration-200">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 dark:border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <span className="px-2 py-0.5 bg-emerald-500/10 text-emerald-500 text-[10px] font-bold rounded border border-emerald-500/20">
                  HTTP {testStatus || 200} OK
                </span>
                <span className="text-xs font-bold text-[#002b5c] dark:text-slate-200">
                  Detected {Object.keys(testResult).length} JSON Keys
                </span>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => handleSelectAll(true)}
                  className="px-2.5 py-1 text-[10px] font-bold text-blue-500 bg-blue-500/10 rounded hover:bg-blue-500/20 transition"
                >
                  Select All
                </button>
                <button
                  type="button"
                  onClick={() => handleSelectAll(false)}
                  className="px-2.5 py-1 text-[10px] font-bold text-slate-500 bg-slate-500/10 rounded hover:bg-slate-500/20 transition"
                >
                  Deselect All
                </button>
                <button
                  type="button"
                  onClick={() => setRawJsonOpen(!rawJsonOpen)}
                  className="px-2.5 py-1 text-[10px] font-bold text-purple-500 bg-purple-500/10 rounded hover:bg-purple-500/20 transition"
                >
                  {rawJsonOpen ? "Hide Raw JSON" : "View Raw JSON"}
                </button>
              </div>
            </div>

            {/* RAW JSON PREVIEW */}
            {rawJsonOpen && (
              <div className="p-3 bg-slate-900 text-emerald-400 font-mono text-[11px] rounded-lg overflow-x-auto max-h-60 border border-slate-800">
                <pre>{JSON.stringify(testResult, null, 2)}</pre>
              </div>
            )}

            {/* VARIABLE SELECTION TABLE */}
            <div className="overflow-x-auto max-h-80">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-slate-800 text-[10px] uppercase tracking-wider text-slate-400 font-bold">
                    <th className="pb-2 px-3 text-center w-12">Select</th>
                    <th className="pb-2 px-3">JSON Variable Key</th>
                    <th className="pb-2 px-3">Sample Value</th>
                    <th className="pb-2 px-3 text-center">Data Type</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200/50 dark:divide-slate-800/50 font-medium">
                  {Object.keys(testResult).map((key) => {
                    const val = testResult[key];
                    const valType = typeof val;
                    const isSelected = !!selectedFields[key];

                    return (
                      <tr key={key} className={`hover:bg-blue-50/50 dark:hover:bg-blue-950/20 transition ${isSelected ? "bg-blue-500/5" : ""}`}>
                        <td className="py-2.5 px-3 text-center">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => handleToggleField(key)}
                            className="w-4 h-4 text-blue-600 rounded border-slate-300 focus:ring-blue-500 cursor-pointer"
                          />
                        </td>
                        <td className="py-2.5 px-3 font-mono font-bold text-slate-800 dark:text-slate-100">
                          {key}
                        </td>
                        <td className="py-2.5 px-3 font-mono text-emerald-600 dark:text-emerald-400 truncate max-w-xs">
                          {val === null ? "null" : typeof val === "object" ? JSON.stringify(val) : String(val)}
                        </td>
                        <td className="py-2.5 px-3 text-center">
                          <span className="px-2 py-0.5 rounded text-[10px] font-mono uppercase bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                            {valType}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* DUAL ACTION BUTTONS (TESTING vs POLLING) */}
            <div className="flex flex-wrap items-center justify-end gap-3 pt-3 border-t border-slate-200 dark:border-slate-800">
              <button
                type="button"
                disabled={saveLoading}
                onClick={() => handleSaveApiSource("test")}
                className="px-4 py-2 bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 text-amber-600 dark:text-amber-400 text-xs font-bold rounded-lg transition disabled:opacity-50"
              >
                🧪 Simpan untuk Testing Saja
              </button>

              <button
                type="button"
                disabled={saveLoading}
                onClick={() => handleSaveApiSource("polling")}
                className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-lg shadow-md shadow-emerald-600/20 transition disabled:opacity-50 flex items-center gap-1.5"
              >
                ⚡ Simpan untuk Polling Backend
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}


