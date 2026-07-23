import { useState, useEffect, useMemo } from "react";
import { useOutletContext } from "react-router-dom";
import { getUnitById } from "../../data/machines";
import type { MachineOutletContext } from "./MachineLayout";
import PidPageTemplate from "./PidPageTemplate";
import type { Task, Alarm } from "./PidPageTemplate";
import { useTelemetryStore } from "../../store/telemetry.store";
import { getJson, postJson } from "../../services/api.client";
import { telemetryTagIds } from "../../data/industrial-tags";
import { getDefaultSensorConfigs } from "../../data/equipment";
import CoolingWF1U3Pid from "./diagrams/CoolingWF1U3Pid";
import MachineAHU01Pid from "./diagrams/MachineAHU01Pid";
import MachineAHU02Pid from "./diagrams/MachineAHU02Pid";
import MachineAHU03Pid from "./diagrams/MachineAHU03Pid";
import MachineUtilityPid from "./diagrams/MachineUtilityPid";

const TAG_KEY_TO_API_JSON_KEY: Record<string, string> = {
  // Main
  "cooling-water/supply_temp": "Scaled_Temp_Tank_Cooling3_Supp",
  "cooling-water/return_temp": "Scaled_Temp_Tank_Cooling3_Return",
  "cooling-water/delta_temp": "delta_temp",
  "cooling-water/ambient_temp": "Scaled_Temp_Washing",
  "cooling-water/ambient_humidity": "Scaled_Level_tank_cooling3",
  "cooling-water/ct_efficiency": "Scaled_Level_tank_cooling3",
  "cooling-water/total_energy": "Scaled_Level_tank_cooling3",

  // CT-1
  "cooling-water/fan_status_1": "Status_Fan_CT1",
  "cooling-water/ct1_fan_speed": "Scaled_Level_tank_cooling3",
  "cooling-water/motor_status_1": "Status_MTR_CT_P1",
  "cooling-water/ct1_motor_current": "Scaled_Level_tank_cooling3",
  "cooling-water/ct1_sirk_current": "Scaled_Level_tank_cooling3",
  "cooling-water/ct1_motor_power": "Scaled_Level_tank_cooling3",
  "cooling-water/ct1_flow": "Scaled_Level_tank_cooling3",
  "cooling-water/pressure_1": "Scaled_Press_CT_P1",
  "cooling-water/ct1_vibra_fan": "Scaled_Level_tank_cooling3",
  "cooling-water/ct1_vibra_motor": "Scaled_Level_tank_cooling3",
  "cooling-water/ct1_basin_temp": "Scaled_Level_tank_cooling3",
  "cooling-water/ct1_running_hours": "Scaled_Level_tank_cooling3",

  // CT-2
  "cooling-water/fan_status_2": "Status_Fan_CT2",
  "cooling-water/ct2_fan_speed": "Scaled_Level_tank_cooling3",
  "cooling-water/motor_status_2": "Status_MTR_CT_P2",
  "cooling-water/ct2_motor_current": "Scaled_Level_tank_cooling3",
  "cooling-water/ct2_sirk_current": "Scaled_Level_tank_cooling3",
  "cooling-water/ct2_motor_power": "Scaled_Level_tank_cooling3",
  "cooling-water/ct2_flow": "Scaled_Level_tank_cooling3",
  "cooling-water/pressure_2": "Scaled_Press_CT_P2",
  "cooling-water/ct2_vibra_fan": "Scaled_Level_tank_cooling3",
  "cooling-water/ct2_vibra_motor": "Scaled_Level_tank_cooling3",
  "cooling-water/ct2_basin_temp": "Scaled_Level_tank_cooling3",
  "cooling-water/ct2_running_hours": "Scaled_Level_tank_cooling3",

  // CT-3
  "cooling-water/fan_status_3": "Status_Fan_CT3",
  "cooling-water/ct3_fan_speed": "Scaled_Level_tank_cooling3",
  "cooling-water/motor_status_3": "Status_MTR_CT_P11",
  "cooling-water/ct3_motor_current": "Scaled_Level_tank_cooling3",
  "cooling-water/ct3_sirk_current": "Scaled_Level_tank_cooling3",
  "cooling-water/ct3_motor_power": "Scaled_Level_tank_cooling3",
  "cooling-water/ct3_flow": "Scaled_Level_tank_cooling3",
  "cooling-water/pressure_3": "Scaled_Press_CT3_P11",
  "cooling-water/ct3_vibra_fan": "Scaled_Level_tank_cooling3",
  "cooling-water/ct3_vibra_motor": "Scaled_Level_tank_cooling3",
  "cooling-water/ct3_basin_temp": "Scaled_Level_tank_cooling3",
  "cooling-water/ct3_running_hours": "Scaled_Level_tank_cooling3",

  // Tanks & Dosing
  "cooling-water/cooling_tank_tds": "Scaled_Level_tank_cooling3",
  "cooling-water/cooling_tank_ph": "Scaled_Level_tank_cooling3",
  "cooling-water/supply_wtr_cond": "Scaled_Level_tank_cooling3",
  "cooling-water/basin_lvl": "Scaled_Level_tank_cooling3",
  "cooling-water/makeup_wtr_ph": "Scaled_Level_tank_cooling3",
  "cooling-water/makeup_wtr_tds": "Scaled_Level_tank_cooling3",
  "cooling-water/makeup_wtr_flow": "Scaled_Level_tank_cooling3",
  "cooling-water/makeup_wtr_vol": "Scaled_Level_tank_cooling3",
  "cooling-water/chemical_357_pump": "Scaled_Level_tank_cooling3",
  "cooling-water/chemical_357_lvl": "Scaled_Level_tank_cooling3",
  "cooling-water/chemical_357_vol": "Scaled_Level_tank_cooling3",
  "cooling-water/chemical_327_pump": "Scaled_Level_tank_cooling3",
  "cooling-water/chemical_327_lvl": "Scaled_Level_tank_cooling3",
  "cooling-water/chemical_327_vol": "Scaled_Level_tank_cooling3",
  "cooling-water/blowdown_status": "Scaled_Level_tank_cooling3",
  "cooling-water/blowdown_flow": "Scaled_Level_tank_cooling3",
  "cooling-water/blowdown_vol": "Scaled_Level_tank_cooling3",

  // ST-3 Return Temp / Process
  "cooling-water/st3_return_temp": "Scaled_Temp_ST3_Return",
  "cooling-water/eq_temp_st03_supply": "Scaled_Temp_ST3_Supply",
  "cooling-water/st3_heating": "Status_Machine__Heating_ST3",
  "cooling-water/st3_cooling": "Status_Machine__Cooling_ST3",
  "cooling-water/st3_steril": "Status_Machine__Steril_ST3",
  "cooling-water/jumo_pieces": "Jumo_Pieces",

  // Motor 1, 2, 3 Extra
  "cooling-water/mtr1_running_hours": "Scaled_Level_tank_cooling3",
  "cooling-water/mtr1_hz": "Scaled_Level_tank_cooling3",
  "cooling-water/mtr1_kw": "Scaled_Level_tank_cooling3",
  "cooling-water/mtr2_running_hours": "Scaled_Level_tank_cooling3",
  "cooling-water/mtr2_hz": "Scaled_Level_tank_cooling3",
  "cooling-water/mtr2_kw": "Scaled_Level_tank_cooling3",
  "cooling-water/mtr3_running_hours": "Scaled_Level_tank_cooling3",
  "cooling-water/mtr3_hz": "Scaled_Level_tank_cooling3",
  "cooling-water/mtr3_kw": "Scaled_Level_tank_cooling3",

  // Equipment Status Matrix details
  "cooling-water/eq_status_du03": "Status_MTR_DU45",
  "cooling-water/eq_flow_du03": "Scaled_Level_tank_cooling3",
  "cooling-water/eq_press_du03": "Scaled_Press_DUU3",
  "cooling-water/eq_curr_du03": "Scaled_Level_tank_cooling3",
  "cooling-water/eq_pow_du03": "Scaled_Level_tank_cooling3",
  "cooling-water/eq_vib_du03": "Scaled_Level_tank_cooling3",
  "cooling-water/eq_temp_du03": "Scaled_Temp_DU",
  "cooling-water/eq_hrs_du03": "Scaled_Level_tank_cooling3",
  "cooling-water/eq_maint_du03": "Scaled_Level_tank_cooling3",

  "cooling-water/eq_status_bp03": "Status_MTR_BP",
  "cooling-water/eq_flow_bp03": "Scaled_Level_tank_cooling3",
  "cooling-water/eq_press_bp03": "Scaled_Press_BP",
  "cooling-water/eq_curr_bp03": "Scaled_Level_tank_cooling3",
  "cooling-water/eq_pow_bp03": "Scaled_Level_tank_cooling3",
  "cooling-water/eq_vib_bp03": "Scaled_Level_tank_cooling3",
  "cooling-water/eq_temp_bp03": "Scaled_Level_tank_cooling3",
  "cooling-water/eq_hrs_bp03": "Scaled_Level_tank_cooling3",
  "cooling-water/eq_maint_bp03": "Scaled_Level_tank_cooling3",

  "cooling-water/eq_status_prep03": "Status_MTR_Prep3",
  "cooling-water/eq_flow_prep03": "Scaled_Level_tank_cooling3",
  "cooling-water/eq_press_prep03": "Scaled_Press_PrepU3",
  "cooling-water/eq_curr_prep03": "Scaled_Level_tank_cooling3",
  "cooling-water/eq_pow_prep03": "Scaled_Level_tank_cooling3",
  "cooling-water/eq_vib_prep03": "Scaled_Level_tank_cooling3",
  "cooling-water/eq_temp_prep03": "Scaled_Tempt_Prep3_Return",
  "cooling-water/eq_hrs_prep03": "Scaled_Level_tank_cooling3",
  "cooling-water/eq_maint_prep03": "Scaled_Level_tank_cooling3",

  "cooling-water/eq_status_st03": "Status_MTR_ST3_P3",
  "cooling-water/eq_flow_st03": "Scaled_Level_tank_cooling3",
  "cooling-water/eq_press_st03": "Scaled_Press_ST3",
  "cooling-water/eq_curr_st03": "Scaled_Level_tank_cooling3",
  "cooling-water/eq_pow_st03": "Scaled_Level_tank_cooling3",
  "cooling-water/eq_vib_st03": "Scaled_Level_tank_cooling3",
  "cooling-water/eq_hrs_st03": "Scaled_Level_tank_cooling3",
  "cooling-water/eq_maint_st03": "Scaled_Level_tank_cooling3",

  "cooling-water/eq_status_washing": "Status_MTR_Washing",
  "cooling-water/eq_flow_washing": "Scaled_Level_tank_cooling3",
  "cooling-water/eq_press_washing": "Scaled_Press_Washing",
  "cooling-water/eq_curr_washing": "Scaled_Level_tank_cooling3",
  "cooling-water/eq_pow_washing": "Scaled_Level_tank_cooling3",
  "cooling-water/eq_vib_washing": "Scaled_Level_tank_cooling3",
  "cooling-water/eq_temp_washing": "Scaled_Temp_Washing",
  "cooling-water/eq_hrs_washing": "Scaled_Level_tank_cooling3",
  "cooling-water/eq_maint_washing": "Scaled_Level_tank_cooling3",

  "cooling-water/eq_status_minilab": "Status_MTR_MiniLab",
  "cooling-water/eq_flow_minilab": "Scaled_Level_tank_cooling3",
  "cooling-water/eq_press_minilab": "Scaled_Press_MiniLab",
  "cooling-water/eq_curr_minilab": "Scaled_Level_tank_cooling3",
  "cooling-water/eq_pow_minilab": "Scaled_Level_tank_cooling3",
  "cooling-water/eq_vib_minilab": "Scaled_Level_tank_cooling3",
  "cooling-water/eq_temp_minilab": "Scaled_Level_tank_cooling3",
  "cooling-water/eq_hrs_minilab": "Scaled_Level_tank_cooling3",
  "cooling-water/eq_maint_minilab": "Scaled_Level_tank_cooling3"
};

// ═══════════════════════════════════════════════
// DATA TASK & ALARM PER MESIN (dummy, nanti dari API)
// ═══════════════════════════════════════════════
const machineDataMap: Record<
  string,
  { tasks: Task[]; alarms: Alarm[] }
> = {
  // Contoh untuk Cooling Water System WF1U3
  "cooling-water-1": {
    tasks: [],
    alarms: [],
  },
  // Mesin non-HVAC lainnya...
};

const defaultTemplates = [
  {
    itemKey: "FAN",
    specificKeys: ["FAN-1", "FAN-2", "FAN-3"],
    rules: [
      { targetHours: 500, task: "Check V-Belt Tension" },
      { targetHours: 500, task: "Visual Inspection" },
      { targetHours: 1000, task: "Clean Fan Blades" }
    ]
  },
  {
    itemKey: "MTR",
    specificKeys: ["MTR-1", "MTR-2", "MTR-3", "MTR-4", "MTR-5", "MTR-6", "MTR-7", "MTR-8", "MTR-9"],
    rules: [
      { targetHours: 500, task: "Strainer Inspection" },
      { targetHours: 500, task: "Pump Bearing Lubrication" },
      { targetHours: 1000, task: "Seal/Bearing Inspection" }
    ]
  },
  {
    itemKey: "Dosing Pump",
    specificKeys: ["Dosing Pump 1", "Dosing Pump 2"],
    rules: [
      { targetHours: 500, task: "Strainer Inspection" }
    ]
  },
  {
    itemKey: "Strainer",
    specificKeys: ["Strainer 1", "Strainer 2", "Strainer 3", "Strainer 4", "Strainer 5", "Strainer 6", "Strainer 7", "Strainer 8", "Strainer 9"],
    rules: [
      { targetHours: 200, task: "Check Cleanliness" },
      { targetHours: 600, task: "Clean Filter Element" }
    ]
  },
  {
    itemKey: "Cooling Tower",
    specificKeys: ["CT 1", "CT 2", "CT 3"],
    rules: [
      { targetHours: 600, task: "Basin Debris Clean" },
      { targetHours: 600, task: "Float Valve Inspection" }
    ]
  },
  {
    itemKey: "Cooling Tank",
    specificKeys: ["Cooling Tank"],
    rules: [
      { targetHours: 1000, task: "Basin Sediment Cleaning" },
      { targetHours: 1000, task: "Flushing & Corrosion Inspect" }
    ]
  },
  {
    itemKey: "Panel",
    specificKeys: ["Panel"],
    rules: [
      { targetHours: 1000, task: "Inverter Cleaning" },
      { targetHours: 1000, task: "Wiring Inspection" }
    ]
  }
];

const DEFAULT_TASK_RULES: { id: string; motorKey: string; targetHours: number; taskName: string }[] = [];
let ruleCounter = 1;
defaultTemplates.forEach((tpl) => {
  tpl.specificKeys.forEach((specKey) => {
    tpl.rules.forEach((rule) => {
      DEFAULT_TASK_RULES.push({
        id: String(ruleCounter++),
        motorKey: specKey,
        targetHours: rule.targetHours,
        taskName: `${specKey} - ${rule.task}`
      });
    });
  });
});

const MOTOR_KEY_TO_TAG_ID: Record<string, string> = {
  "FAN-1": "cooling-water/fan_status_1",
  "FAN-2": "cooling-water/fan_status_2",
  "FAN-3": "cooling-water/fan_status_3",
  "MTR-1": "cooling-water/motor_status_1",
  "MTR-2": "cooling-water/motor_status_2",
  "MTR-3": "cooling-water/motor_status_3",
  "MTR-4": "cooling-water/eq_status_du03",
  "MTR-5": "cooling-water/eq_status_bp03",
  "MTR-6": "cooling-water/eq_status_prep03",
  "MTR-7": "cooling-water/eq_status_st03",
  "MTR-8": "cooling-water/eq_status_washing",
  "MTR-9": "cooling-water/eq_status_minilab",
  "Dosing Pump 1": "cooling-water/dosing_pump_1",
  "Dosing Pump 2": "cooling-water/dosing_pump_2",
  "Strainer 1": "cooling-water/strainer_1",
  "Strainer 2": "cooling-water/strainer_2",
  "Strainer 3": "cooling-water/strainer_3",
  "Strainer 4": "cooling-water/strainer_4",
  "Strainer 5": "cooling-water/strainer_5",
  "Strainer 6": "cooling-water/strainer_6",
  "Strainer 7": "cooling-water/strainer_7",
  "Strainer 8": "cooling-water/strainer_8",
  "Strainer 9": "cooling-water/strainer_9",
  "CT 1": "cooling-water/ct_1",
  "CT 2": "cooling-water/ct_2",
  "CT 3": "cooling-water/ct_3",
  "Cooling Tank": "cooling-water/cooling_tank",
  "Panel": "cooling-water/panel"
};

// ── Data default jika unitId tidak ditemukan ────────────
const defaultData: { tasks: Task[]; alarms: Alarm[] } = {
  tasks: [],
  alarms: [],
};

// ── Mapping diagram ──────────────────────────────────────
const diagramMap: Record<string, React.ComponentType<any>> = {
  "cooling-water-1": CoolingWF1U3Pid,
  "ahu-01": MachineAHU01Pid,
  "ahu-02": MachineAHU02Pid,
  "ahu-03": MachineAHU03Pid,
  "utility": MachineUtilityPid,
};

function selectPidDiagram(unitId: string) {
  if (diagramMap[unitId]) return diagramMap[unitId];
  const matchedKey = Object.keys(diagramMap).find((key) =>
    unitId.startsWith(key)
  );
  if (matchedKey) return diagramMap[matchedKey];
  return null;
}

// ═══════════════════════════════════════════════
// HELPER: Cek Apakah Mesin HVAC Target
// ═══════════════════════════════════════════════
const isHvacTarget = (unitId: string) => {
  return unitId === "hvac-qc-retained-sample" || unitId === "hvac-wh-3"; // Tambahkan unit HVAC lain di sini
};

// ═══════════════════════════════════════════════
// KOMPONEN UTAMA
// ═══════════════════════════════════════════════
export default function MachinePidDiagram() {
  const { unitId } = useOutletContext<MachineOutletContext>();
  const machine = getUnitById(unitId);

  const [apiSourceUrls] = useState<Record<string, string>>(() => {
    const defaultMap: Record<string, string> = {};
    if (unitId.startsWith("cooling-water")) {
      const defaultUrl = "http://10.3.164.3:8088/system/webdev/Utility_Dashboard/cooling3";
      const sensorList = getDefaultSensorConfigs(unitId);
      sensorList.forEach((s) => {
        defaultMap[s.tagKey] = defaultUrl;
      });
    }
    const saved = localStorage.getItem(`scada.config.api_sources.${unitId}`);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        return { ...defaultMap, ...parsed };
      } catch (e) {}
    }
    return defaultMap;
  });

  const [apiLiveData, setApiLiveData] = useState<Record<string, any>>({});

  useEffect(() => {
    let isMounted = true;
    const fetchActiveApiData = async () => {
      const activeUrls = Object.values(apiSourceUrls).filter((u) => u.trim());
      if (activeUrls.length === 0) return;
      const targetUrl = activeUrls[0];
      try {
        const res = await postJson<{ success: boolean; data?: any }>("/config/api-sources/test", {
          url: targetUrl,
          method: "GET"
        });
        if (isMounted && res && res.success && res.data) {
          setApiLiveData(res.data);
        }
      } catch (err) {
        console.error("Live API poll error on P&ID diagram:", err);
      }
    };

    fetchActiveApiData();
    const interval = setInterval(fetchActiveApiData, 4000);
    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [apiSourceUrls]);

  const latest = useTelemetryStore((state) => state.latest);

  const mergedLatest = useMemo(() => {
    const merged = { ...latest };
    if (unitId.startsWith("cooling-water")) {
      Object.entries(apiSourceUrls).forEach(([tagKey, url]) => {
        if (!url.trim()) {
          merged[tagKey] = {
            ts: new Date().toISOString(),
            value: "Belum Ada API",
            quality: "bad",
            meta: { tagId: tagKey }
          };
          return;
        }

        if (tagKey === "cooling-water/delta_temp") {
          const retVal = apiLiveData["Scaled_Temp_Tank_Colling3_Return"] !== undefined
            ? apiLiveData["Scaled_Temp_Tank_Colling3_Return"]
            : apiLiveData["Scaled_Temp_Tank_Cooling3_Return"];
          const suppVal = apiLiveData["Scaled_Temp_Tank_Colling3_Supp"] !== undefined
            ? apiLiveData["Scaled_Temp_Tank_Colling3_Supp"]
            : apiLiveData["Scaled_Temp_Tank_Cooling3_Supp"];

          if (typeof retVal === "number" && typeof suppVal === "number") {
            merged[tagKey] = {
              ts: new Date().toISOString(),
              value: Number((retVal - suppVal).toFixed(2)),
              quality: "good",
              meta: { tagId: tagKey }
            };
          } else {
            merged[tagKey] = {
              ts: new Date().toISOString(),
              value: "xx",
              quality: "bad",
              meta: { tagId: tagKey }
            };
          }
          return;
        }

        const jsonKey = TAG_KEY_TO_API_JSON_KEY[tagKey];
        if (!jsonKey) {
          merged[tagKey] = {
            ts: new Date().toISOString(),
            value: "xx",
            quality: "bad",
            meta: { tagId: tagKey }
          };
          return;
        }

        let val = apiLiveData[jsonKey];
        if (val === undefined || val === null) {
          if (tagKey === "cooling-water/supply_temp") {
            val = apiLiveData["Scaled_Temp_Tank_Colling3_Supp"];
          } else if (tagKey === "cooling-water/return_temp") {
            val = apiLiveData["Scaled_Temp_Tank_Colling3_Return"];
          }
        }

        if (val === undefined || val === null) {
          merged[tagKey] = {
            ts: new Date().toISOString(),
            value: "xx",
            quality: "bad",
            meta: { tagId: tagKey }
          };
        } else {
          merged[tagKey] = {
            ts: new Date().toISOString(),
            value: val,
            quality: "good",
            meta: { tagId: tagKey }
          };
        }
      });
    }
    return merged;
  }, [latest, apiSourceUrls, apiLiveData, unitId]);

  const [selectedTaskFilter, setSelectedTaskFilter] = useState<
    "all" | "overdue" | "open" | "close"
  >("all");

  if (!machine) return null;

  // ── Ambil task & alarm khusus untuk mesin ini ──────────
  const data = machineDataMap[unitId] ?? defaultData;
  const [dbAlarms, setDbAlarms] = useState<Alarm[]>([]);

  const formatAlarmTitle = (code: string, rawMessage: string) => {
    const codeStr = String(code || "");
    const msgStr = String(rawMessage || "");

    if (codeStr.includes("eq_press_bp03") || msgStr.includes("BP-3")) return "ALARM TEKANAN - MTR-5 (BP-3)";
    if (codeStr.includes("eq_press_du03") || msgStr.includes("DU-3")) return "ALARM TEKANAN - MTR-4 (DU-3)";
    if (codeStr.includes("eq_press_prep03") || msgStr.includes("SP-3")) return "ALARM TEKANAN - MTR-6 (SP-3)";
    if (codeStr.includes("eq_press_st03") || msgStr.includes("ST-3")) return "ALARM TEKANAN - MTR-7 (ST-3)";
    if (codeStr.includes("supply_temp")) return "ALARM SUHU SUPPLY WATER";
    if (codeStr.includes("return_temp")) return "ALARM SUHU RETURN WATER";
    if (codeStr.includes("cooling_tank_tds")) return "ALARM TDS COOLING TANK";
    if (codeStr.includes("cooling_tank_ph")) return "ALARM PH COOLING TANK";
    if (codeStr.includes("basin_lvl")) return "ALARM LEVEL COOLING TANK";
    if (codeStr.includes("chemical_357")) return "ALARM CHEMICAL 357";
    if (codeStr.includes("chemical_327")) return "ALARM CHEMICAL 327/317";
    if (codeStr.includes("high_pressure")) return "ALARM TEKANAN TINGGI";
    if (codeStr.includes("high_temp")) return "ALARM SUHU TINGGI";

    return codeStr
      .replace(/^(pid-threshold:|threshold:)/i, "")
      .replace(/^cooling-water\//i, "")
      .toUpperCase();
  };

  const formatAlarmMessage = (rawMessage: string) => {
    if (!rawMessage) return "Terdeteksi kondisi alarm pada sensor.";

    let msg = rawMessage;
    if (msg.includes("exceeds Alarm Limit of")) {
      msg = msg.replace(/\[(.*?)\] exceeds Alarm Limit of (.*?) \(Current: (.*?)\)/gi, (_, equip, limit, curr) => {
        return `Tekanan pada ${equip} melebihi batas aman (${limit}). Nilai saat ini: ${curr}`;
      });
      msg = msg.replace(/exceeds Alarm Limit of/gi, "melebihi batas alarm");
      msg = msg.replace(/\(Current:/gi, "(Nilai saat ini:");
    }

    return msg;
  };

  const fetchActiveAlarms = async () => {
    try {
      const res = await getJson<{ data: any[] }>(`/alarms/active?unit=${unitId}&limit=20`);
      if (res && Array.isArray(res.data)) {
        const mapped: Alarm[] = res.data.map((item: any) => {
          const severity: "critical" | "warning" | "info" =
            item.severity === "critical" || item.severity === "high"
              ? "critical"
              : item.severity === "warning" || item.severity === "medium"
              ? "warning"
              : "info";

          const ts = item.lastTs
            ? new Date(item.lastTs).toLocaleTimeString("en-US", { hour12: false })
            : new Date().toLocaleTimeString("en-US", { hour12: false });

          return {
            id: Number(item.id) || item.id,
            code: formatAlarmTitle(item.alarmKey || item.tagId || "ALM", item.message || ""),
            message: formatAlarmMessage(item.message || ""),
            severity,
            timestamp: ts,
            status: item.status || "Active",
            clearedAt: item.clearedAt ? new Date(item.clearedAt).toLocaleTimeString("en-US", { hour12: false }) : "—",
            rtn: item.rtn || "—",
            operatorName: item.operatorName || "—",
            operatorAction: item.operatorAction || "—",
            approverName: item.approverName || "—"
          };
        });
        setDbAlarms(mapped);
      }
    } catch (err) {
      console.error("Failed to fetch active alarms from DB:", err);
    }
  };

  useEffect(() => {
    fetchActiveAlarms();
    const alarmInterval = setInterval(fetchActiveAlarms, 3000);
    return () => clearInterval(alarmInterval);
  }, [unitId]);

  const [runningHours, setRunningHours] = useState<Record<string, number>>({});
  const [pidThresholds, setPidThresholds] = useState<any>(null);

  const [dbTasks, setDbTasks] = useState<any[]>([]);
  const [dateRange, setDateRange] = useState<{ startDate: string; endDate: string }>(() => {
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth(), 1);
    const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    const formatDate = (d: Date) => d.toISOString().split("T")[0];
    return { startDate: formatDate(start), endDate: formatDate(end) };
  });

  const isCooling = unitId === "cooling-water-1" || unitId === "cooling-water-2" || unitId === "cooling-water-3";

  const fetchTasks = async () => {
    try {
      const query = `unitId=${unitId}&startDate=${dateRange.startDate}&endDate=${dateRange.endDate}`;
      const res = await getJson<{ data: any[] }>(`/config/rh-tasks?${query}`);
      if (res && res.data) {
        setDbTasks(res.data);
      }
    } catch (err) {
      console.error("Failed to fetch running hours tasks:", err);
    }
  };

  const handleToggleCompleteTask = async (taskId: string) => {
    try {
      await postJson(`/config/rh-tasks/${taskId}/complete`, {});
      fetchTasks();
      const rhRes = await getJson<{ data: Record<string, number> }>("/analytics/running-hours");
      if (rhRes && rhRes.data) {
        setRunningHours(rhRes.data);
      }
    } catch (err) {
      console.error("Failed to complete task:", err);
    }
  };

  let allTasks: Task[] = [];
  if (isCooling) {
    allTasks = dbTasks.map((task) => {
      const isClosed = task.status === "close";
      const actualHoursStr = isClosed 
        ? `${parseFloat(task.actual_hours_at_trigger).toFixed(1)}h`
        : `${(runningHours[MOTOR_KEY_TO_TAG_ID[task.motor_key]] || parseFloat(task.actual_hours_at_trigger) || 0.0).toFixed(1)}h`;
      
      const title = `${task.motor_key} (Running: ${actualHoursStr}) - ${task.task_name} (Target: ${task.target_hours}h)`;

      return {
        id: task.id,
        title,
        status: task.status,
        openedMonth: task.status !== "close",
        createdDate: new Date(task.created_at).toLocaleDateString(),
        taskKey: String(task.id),
        completionStatus: task.completion_status
      };
    });
  } else {
    allTasks = data.tasks;
  }

  // 1. Fetch thresholds once on mount
  useEffect(() => {
    getJson<{ data: any }>("/config/pid-thresholds")
      .then((res) => {
        if (res && res.data) {
          setPidThresholds(res.data);
        }
      })
      .catch((err) => console.error("Failed to fetch initial threshold data:", err));
  }, []);

  // 2. Poll running hours every 15 seconds
  useEffect(() => {
    const fetchRH = async () => {
      try {
        const res = await getJson<{ data: Record<string, number> }>("/analytics/running-hours");
        if (res && res.data) {
          setRunningHours(res.data);
        }
      } catch (err) {
        console.error("Failed to fetch running hours data:", err);
      }
    };
    fetchRH();
    const rhInterval = setInterval(fetchRH, 15000);
    return () => clearInterval(rhInterval);
  }, []);

  // 3. Poll latest telemetry every 3 seconds
  useEffect(() => {
    const fetchLatestTelemetry = async () => {
      try {
        const res = await getJson<{ data: any[] }>(`/telemetry/latest?tagIds=${telemetryTagIds.join(",")}`);
        if (res && Array.isArray(res.data)) {
          const points = res.data.map((doc: any) => ({
            ts: doc.ts,
            value: doc.value,
            quality: doc.quality,
            meta: doc.meta
          }));
          useTelemetryStore.getState().addPoints(points);
        }
      } catch (err) {
        console.error("Failed to fetch latest telemetry:", err);
      }
    };
    fetchLatestTelemetry();
    const telInterval = setInterval(fetchLatestTelemetry, 3000);
    return () => clearInterval(telInterval);
  }, []);

  useEffect(() => {
    if (isCooling) {
      fetchTasks();
      const interval = setInterval(fetchTasks, 15000);
      return () => clearInterval(interval);
    }
  }, [unitId, dateRange.startDate, dateRange.endDate]);

  const getStatus = (tagId: string) => {
    const val = mergedLatest[tagId]?.value;
    if (typeof val === "number") return val === 1;
    if (typeof val === "boolean") return val;
    if (typeof val === "string") {
      const upper = val.toUpperCase();
      return upper === "ON" || upper === "RUNNING" || upper === "1" || upper === "TRUE";
    }
    return false;
  };

  const motorStatus = {
    "FAN-1": getStatus("cooling-water/fan_status_1"),
    "FAN-2": getStatus("cooling-water/fan_status_2"),
    "FAN-3": getStatus("cooling-water/fan_status_3"),
    "MTR-1": getStatus("cooling-water/motor_status_1"),
    "MTR-2": getStatus("cooling-water/motor_status_2"),
    "MTR-3": getStatus("cooling-water/motor_status_3"),
    "MTR-4": getStatus("cooling-water/eq_status_du03"),
    "MTR-5": getStatus("cooling-water/eq_status_bp03"),
    "MTR-6": getStatus("cooling-water/eq_status_prep03"),
    "MTR-7": getStatus("cooling-water/eq_status_st03"),
    "MTR-8": getStatus("cooling-water/eq_status_washing"),
    "MTR-9": getStatus("cooling-water/eq_status_minilab"),
  };

  const taskInfo = {
    taskOverdue: allTasks.filter((t) => t.status === "overdue").length,
    taskOpen: allTasks.filter((t) => t.status === "open").length,
    taskClose: allTasks.filter((t) => t.status === "close").length,
  };

  const PidDiagram = selectPidDiagram(unitId);

  // ── KONDISI KHUSUS UNTUK HVAC ──────────────────────────
  if (isHvacTarget(unitId)) {
    // Layout Baru Sesuai Screenshot HVAC
    return (
      <div className="flex flex-col h-full w-full gap-4 p-2">
        {/* 1. TOP BAR: Room Info (Card 1) */}
        <div className="flex justify-between items-start bg-[#1e293b] border border-slate-600 p-4 rounded-lg shadow-sm">
          <div>
            <h2 className="text-xl font-bold text-white">Room Name : {machine.name}</h2>
            <p className="text-lg text-slate-300">ACCELERATED STABILITY ROOM</p>
            <div className="text-sm text-cyan-400 mt-1">
              Target: 38°C ± 2°C | 75%RH ± 5%
            </div>
          </div>
          <div className="flex flex-col items-end gap-1">
            <div className="flex items-center gap-2">
              <span className="text-slate-400 text-sm font-mono">MODE</span>
              <span className="text-cyan-400 font-semibold font-mono">Auto</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-slate-400 text-sm font-mono">STATUS</span>
              <span className="text-green-400 font-semibold font-mono">Running</span>
            </div>
          </div>
        </div>

        {/* 2. MAIN AREA: P&ID & SIDEBAR */}
        <div className="flex gap-4 flex-1 min-h-0">

          {/* P&ID Canvas (Card 2) */}
          <div className="flex-1 rounded-lg border border-slate-600 bg-slate-900/70 relative overflow-hidden">
            <div className="absolute inset-0 overflow-auto">
              {PidDiagram ? (
                <PidDiagram motorStatus={motorStatus} runningHours={runningHours} pidThresholds={pidThresholds} latest={mergedLatest} />
              ) : (
                <div className="flex items-center justify-center h-full text-slate-400">
                  Diagram untuk {machine.name} belum tersedia.
                </div>
              )}
            </div>
          </div>

          {/* RIGHT SIDEBAR */}
          <div className="w-80 flex flex-col gap-2 h-full">

            {/* 3. SYSTEM MODE */}
            <div className="flex-1 border border-slate-600 rounded-lg bg-[#1e293b] p-4 flex flex-col gap-2 min-h-[150px]">
              <h3 className="text-white font-bold font-mono border-b border-slate-600 pb-2 mb-2">SYSTEM MODE</h3>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between"><span className="text-slate-400">Operating Mode</span><span className="text-cyan-400 font-semibold">Auto</span></div>
                <div className="flex justify-between"><span className="text-slate-400">Fan Status</span><span className="text-green-400 font-semibold">Running</span></div>
                <div className="flex justify-between"><span className="text-slate-400">Electric Heater</span><span className="text-green-400 font-semibold">On</span></div>
                <div className="flex justify-between"><span className="text-slate-400">Humidity Fan</span><span className="text-green-400 font-semibold">Running</span></div>
                <div className="flex justify-between"><span className="text-slate-400">Utility Status</span><span className="text-green-400 font-semibold">On</span></div>
              </div>
            </div>

            {/* 4. SETPOINTS */}
            <div className="flex-1 border border-slate-600 rounded-lg bg-[#1e293b] p-4 flex flex-col gap-2 min-h-[150px]">
              <h3 className="text-white font-bold font-mono border-b border-slate-600 pb-2 mb-2">SETPOINTS</h3>
              <div className="space-y-3 mt-2">
                <div>
                  <div className="flex justify-between text-xs font-mono"><span className="text-slate-400">Temperature SP</span><span className="text-white">46.8°C</span></div>
                  <input type="range" className="w-full h-1 bg-slate-700 rounded appearance-none mt-1" />
                </div>
                <div>
                  <div className="flex justify-between text-xs font-mono"><span className="text-slate-400">Humidity SP</span><span className="text-white">75.0%RH</span></div>
                  <input type="range" className="w-full h-1 bg-slate-700 rounded appearance-none mt-1" />
                </div>
              </div>
            </div>

            {/* 5. CONTROL PANEL */}
            <div className="flex-1 border border-slate-600 rounded-lg bg-[#1e293b] p-4 flex flex-col gap-2 min-h-[150px]">
              <h3 className="text-white font-bold font-mono border-b border-slate-600 pb-2 mb-2">CONTROL PANEL</h3>
              <div className="grid grid-cols-2 gap-2 mt-2">
                <button className="p-2 rounded bg-cyan-800/40 text-cyan-400 text-xs font-bold hover:bg-cyan-800/60 border border-cyan-800/50">START AHU</button>
                <button className="p-2 rounded bg-red-900/40 text-red-400 text-xs font-bold hover:bg-red-900/60 border border-red-900/50">STOP AHU</button>
                <button className="p-2 rounded bg-blue-900/40 text-blue-400 text-xs font-bold hover:bg-blue-900/60 border border-blue-900/50">MAINTENANCE</button>
                <button className="p-2 rounded bg-slate-700/40 text-slate-400 text-xs font-bold hover:bg-slate-700/60 border border-slate-700/50">CALIBRATION</button>
              </div>
            </div>

          </div>
        </div>
      </div>
    );
  }

  // ── LAYOUT STANDAR (NON-HVAC) ──────────────────────────
  return (
    <PidPageTemplate
      machineName={machine.name}
      allOn={false}
      onToggleAllOn={() => {}}
      tasks={allTasks}
      selectedTaskFilter={selectedTaskFilter}
      onFilterChange={setSelectedTaskFilter}
      taskInfo={taskInfo}
      alarms={dbAlarms}
      onToggleCompleteTask={handleToggleCompleteTask}
      dateRange={dateRange}
      onChangeDateRange={setDateRange}
    >
      {PidDiagram ? (
        <PidDiagram motorStatus={motorStatus} runningHours={runningHours} pidThresholds={pidThresholds} latest={mergedLatest} />
      ) : (
        <div className="flex items-center justify-center h-full text-slate-400">
          Diagram untuk {unitId} belum tersedia.
        </div>
      )}
    </PidPageTemplate>
  );
}