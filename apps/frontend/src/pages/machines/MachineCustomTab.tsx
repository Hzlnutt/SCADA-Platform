import { useState, useEffect, useCallback, useRef } from "react";
import { useParams } from "react-router-dom";
import HvacLayout, { type LogEntry } from "./HvacLayout";
import { useAuthStore } from "../../store/auth.store";
import { getJson, postJson } from "../../services/api.client";

// Import diagram components
import MachineAHU01Pid from "./diagrams/MachineAHU01Pid";
import MachineAHU02Pid from "./diagrams/MachineAHU02Pid";
import MachineAHU03Pid from "./diagrams/MachineAHU03Pid";
import MachineUtilityPid from "./diagrams/MachineUtilityPid";

// Inline SVG Icons for control panel
const startIcon = (
  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5">
    <path strokeLinecap="round" strokeLinejoin="round" d="M5.25 5.653c0-.856.917-1.398 1.667-.986l11.54 6.348a1.125 1.125 0 010 1.971l-11.54 6.347a1.125 1.125 0 01-1.667-.985V5.653z" />
  </svg>
);

const stopIcon = (
  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5">
    <rect x="5.25" y="5.25" width="13.5" height="13.5" rx="1.5" />
  </svg>
);

const maintenanceIcon = (
  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5">
    <path strokeLinecap="round" strokeLinejoin="round" d="M10.343 3.94c.09-.542.56-.94 1.11-.94h1.093c.55 0 1.02.398 1.11.94l.149.894c.07.424.384.764.78.93.398.164.855.142 1.205-.108l.737-.527a1.125 1.125 0 011.45.12l.773.774a1.125 1.125 0 01.12 1.45l-.527.737c-.25.35-.272.806-.107 1.204.165.397.505.71.93.78l.893.15c.543.09.94.56.94 1.109v1.094c0 .55-.397 1.02-.94 1.11l-.893.149c-.425.07-.765.383-.93.78-.165.398-.143.854.107 1.204l.527.738a1.125 1.125 0 01-.12 1.45l-.774.773a1.125 1.125 0 01-1.449.12l-.738-.527c-.35-.25-.806-.272-1.203-.107-.397.165-.71.505-.781.929l-.149.894c-.09.542-.56.94-1.11.94h-1.094c-.55 0-1.019-.398-1.11-.94l-.148-.894c-.071-.424-.384-.764-.781-.93-.398-.164-.854-.142-1.204.108l-.738.527a1.125 1.125 0 01-1.448-.12l-.774-.774a1.125 1.125 0 01-.12-1.45l.527-.737c.251-.35.273-.806.108-1.204-.165-.397-.505-.71-.93-.78l-.894-.15c-.542-.09-.94-.56-.94-1.109v-1.094c0-.55.398-1.02.94-1.11l.894-.149c.424-.07.765-.383.93-.78.165-.398.143-.854-.108-1.204l-.526-.738a1.125 1.125 0 01.12-1.45l.773-.773a1.125 1.125 0 011.45-.12l.737.527c.35.25.807.272 1.204.107.397-.165.71-.505.78-.929l.15-.894z" />
    <circle cx="12" cy="12" r="3" />
  </svg>
);

const MachineCustomTab = () => {
  const { tabId, unitId } = useParams();

  const user = useAuthStore((state) => state.user);
  const currentUser = user?.name || "Admin";

  // State untuk AHU-01
  const [ahu01Temp, setAhu01Temp] = useState(46.8);
  const [ahu01Humid, setAhu01Humid] = useState(75.0);
  const [ahu01Mode, setAhu01Mode] = useState("Auto");
  const [ahu01Status, setAhu01Status] = useState("Running");

  // State untuk AHU-02
  const [ahu02Temp, setAhu02Temp] = useState(22.4);
  const [ahu02Humid, setAhu02Humid] = useState(55.0);
  const [ahu02Mode, setAhu02Mode] = useState("Auto");
  const [ahu02Status, setAhu02Status] = useState("Running");

  // State untuk AHU-03
  const [ahu03Temp, setAhu03Temp] = useState(20.5);
  const [ahu03Humid, setAhu03Humid] = useState(55.0);
  const [ahu03Mode, setAhu03Mode] = useState("Manual");
  const [ahu03Status, setAhu03Status] = useState("Running");

  // State untuk Utility
  const [utilTemp, setUtilTemp] = useState(22.0);
  const [utilHumid, setUtilHumid] = useState(60.0);
  const [utilMode, setUtilMode] = useState("Auto");
  const [utilStatus, setUtilStatus] = useState("Running");

  // Dynamic logs from backend
  const [logs, setLogs] = useState<LogEntry[]>([]);

  // Ref for debouncing slider changes
  const debounceTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  const fetchHvacData = useCallback(async () => {
    try {
      const statesRes = await getJson<{ data: Record<string, any> }>("/operations/hvac/states");
      const logsRes = await getJson<{ data: any[] }>("/operations/hvac/logs");

      const states = statesRes.data;
      if (states["hvac_state_ahu-01"]) {
        const s = states["hvac_state_ahu-01"];
        setAhu01Temp(s.temp);
        setAhu01Humid(s.humid);
        setAhu01Mode(s.mode);
        setAhu01Status(s.status);
      }
      if (states["hvac_state_ahu-02"]) {
        const s = states["hvac_state_ahu-02"];
        setAhu02Temp(s.temp);
        setAhu02Humid(s.humid);
        setAhu02Mode(s.mode);
        setAhu02Status(s.status);
      }
      if (states["hvac_state_ahu-03"]) {
        const s = states["hvac_state_ahu-03"];
        setAhu03Temp(s.temp);
        setAhu03Humid(s.humid);
        setAhu03Mode(s.mode);
        setAhu03Status(s.status);
      }
      if (states["hvac_state_utility"]) {
        const s = states["hvac_state_utility"];
        setUtilTemp(s.temp);
        setUtilHumid(s.humid);
        setUtilMode(s.mode);
        setUtilStatus(s.status);
      }

      if (logsRes.data) {
        setLogs(logsRes.data.map((l: any) => ({
          ...l,
          timestamp: new Date(l.timestamp)
        })));
      }
    } catch (error) {
      console.error("Failed to fetch HVAC data:", error);
    }
  }, []);

  useEffect(() => {
    fetchHvacData();
  }, [fetchHvacData, tabId, unitId]);

  useEffect(() => {
    return () => {
      // eslint-disable-next-line react-hooks/exhaustive-deps
      Object.values(debounceTimers.current).forEach(clearTimeout);
    };
  }, []);

  const updateHvacBackend = async (
    unitId: "ahu-01" | "ahu-02" | "ahu-03" | "utility",
    updates: { status?: string; mode?: string; temp?: number; humid?: number },
    actionLabel?: string
  ) => {
    try {
      await postJson("/operations/hvac/control", {
        unitId,
        ...updates,
        actionLabel
      });
      if (unitId === "ahu-01") {
        if (updates.status !== undefined) setAhu01Status(updates.status);
        if (updates.mode !== undefined) setAhu01Mode(updates.mode);
        if (updates.temp !== undefined) setAhu01Temp(updates.temp);
        if (updates.humid !== undefined) setAhu01Humid(updates.humid);
      } else if (unitId === "ahu-02") {
        if (updates.status !== undefined) setAhu02Status(updates.status);
        if (updates.mode !== undefined) setAhu02Mode(updates.mode);
        if (updates.temp !== undefined) setAhu02Temp(updates.temp);
        if (updates.humid !== undefined) setAhu02Humid(updates.humid);
      } else if (unitId === "ahu-03") {
        if (updates.status !== undefined) setAhu03Status(updates.status);
        if (updates.mode !== undefined) setAhu03Mode(updates.mode);
        if (updates.temp !== undefined) setAhu03Temp(updates.temp);
        if (updates.humid !== undefined) setAhu03Humid(updates.humid);
      } else if (unitId === "utility") {
        if (updates.status !== undefined) setUtilStatus(updates.status);
        if (updates.mode !== undefined) setUtilMode(updates.mode);
        if (updates.temp !== undefined) setUtilTemp(updates.temp);
        if (updates.humid !== undefined) setUtilHumid(updates.humid);
      }
    } catch (err) {
      console.error("Failed to update HVAC state:", err);
    }
  };

  const debouncedUpdateHvac = useCallback((
    unitId: "ahu-01" | "ahu-02" | "ahu-03" | "utility",
    updates: { status?: string; mode?: string; temp?: number; humid?: number }
  ) => {
    const key = `${unitId}_${Object.keys(updates).join("_")}`;
    if (debounceTimers.current[key]) {
      clearTimeout(debounceTimers.current[key]);
    }
    debounceTimers.current[key] = setTimeout(() => {
      postJson("/operations/hvac/control", {
        unitId,
        ...updates
      }).catch(err => console.error("Debounced update failed:", err));
    }, 500);
  }, []);

  // ===== FUNGSI VERIFIKASI PASSWORD =====
  const verifyPassword = async (password: string): Promise<boolean> => {
    try {
      const data = await postJson<{ valid: boolean }>("/auth/verify-password", { password });
      return data.valid;
    } catch (error) {
      console.error("Verifikasi password gagal:", error);
      return false;
    }
  };

  // ===== RENDER =====
  if (unitId === "hvac-qc-retained-sample") {
    // ----- AHU-01 -----
    if (tabId === "ahu-01") {
      const systemMode = [
        { label: "Operating Mode", value: ahu01Mode, statusColor: ahu01Mode === "Auto" ? "cyan" : "yellow" as any },
        { label: "Fan Status", value: ahu01Status, statusColor: ahu01Status === "Running" ? "green" : (ahu01Status === "Maintenance" ? "cyan" : "red") as any },
        { label: "Electric Heater", value: ahu01Status === "Running" ? "On" : "Off", statusColor: ahu01Status === "Running" ? "green" : "default" as any },
        { label: "Humidifier Fan Status", value: ahu01Status === "Running" ? "Running" : "Stopped", statusColor: ahu01Status === "Running" ? "green" : "red" as any },
      ];

      const setpoints = [
        {
          label: "Temperature Setpoint",
          value: ahu01Temp,
          unit: "°C",
          min: 30.0,
          max: 50.0,
          onChange: (val: number) => {
            setAhu01Temp(val);
            debouncedUpdateHvac("ahu-01", { temp: val });
          },
        },
        {
          label: "Humidity Setpoint",
          value: ahu01Humid,
          unit: "%RH",
          min: 60.0,
          max: 90.0,
          onChange: (val: number) => {
            setAhu01Humid(val);
            debouncedUpdateHvac("ahu-01", { humid: val });
          },
        },
      ];

      const controlButtons = [
        {
          label: "START AHU",
          onClick: () => updateHvacBackend("ahu-01", { status: "Running", mode: "Auto" }, "START AHU"),
          variant: "green" as any,
          icon: startIcon,
        },
        {
          label: "STOP AHU",
          onClick: () => updateHvacBackend("ahu-01", { status: "Stopped", mode: "Manual" }, "STOP AHU"),
          variant: "red" as any,
          icon: stopIcon,
        },
        {
          label: "MAINTENANCE",
          onClick: () => updateHvacBackend("ahu-01", { status: "Maintenance", mode: "Manual" }, "MAINTENANCE"),
          variant: "blue" as any,
          icon: maintenanceIcon,
        },
      ];

      return (
        <HvacLayout
          roomName="AHU-01"
          roomType="ACCELERATED STABILITY ROOM"
          targetTemp="40°C ± 2°C"
          targetHumidity="75%RH ± 5%"
          diagramComponent={<MachineAHU01Pid tempSP={ahu01Temp} humiditySP={ahu01Humid} running={ahu01Status === "Running"} />}
          systemMode={systemMode}
          setpoints={setpoints}
          controlButtons={controlButtons}
          currentUser={currentUser}
          onVerifyPassword={verifyPassword}
          logs={logs}
          onRefreshData={fetchHvacData}
        />
      );
    }

    // ----- AHU-02 -----
    if (tabId === "ahu-02") {
      const isRunning = ahu02Status === "Running";
      const systemMode = [
        { label: "Operating Mode", value: ahu02Mode, statusColor: ahu02Mode === "Auto" ? "cyan" : "yellow" as any },
        { label: "Fan-02 A Status", value: ahu02Status, statusColor: isRunning ? "green" : (ahu02Status === "Maintenance" ? "cyan" : "red") as any },
        { label: "Fan-02 B Status", value: ahu02Status, statusColor: isRunning ? "green" : (ahu02Status === "Maintenance" ? "cyan" : "red") as any },
        { label: "CU-02 A Status", value: isRunning ? "Active" : "Inactive", statusColor: isRunning ? "cyan" : "default" as any },
        { label: "CU-02 B Status", value: isRunning ? "Active" : "Inactive", statusColor: isRunning ? "cyan" : "default" as any },
        { label: "Electric Heater Status", value: isRunning ? "On" : "Off", statusColor: isRunning ? "green" : "default" as any },
        { label: "Humidity Fan Status", value: isRunning ? "Running" : "Stopped", statusColor: isRunning ? "green" : "red" as any },
      ];

      const setpoints = [
        {
          label: "Cooling Target Temp",
          value: ahu02Temp,
          unit: "°C",
          min: 15.0,
          max: 35.0,
          onChange: (val: number) => {
            setAhu02Temp(val);
            debouncedUpdateHvac("ahu-02", { temp: val });
          }
        },
        {
          label: "Dehumidify Target",
          value: ahu02Humid,
          unit: "%RH",
          min: 30.0,
          max: 80.0,
          onChange: (val: number) => {
            setAhu02Humid(val);
            debouncedUpdateHvac("ahu-02", { humid: val });
          }
        },
      ];

      const controlButtons = [
        {
          label: "START AHU",
          onClick: () => updateHvacBackend("ahu-02", { status: "Running", mode: "Auto" }, "START AHU"),
          variant: "green" as any,
          icon: startIcon
        },
        {
          label: "STOP AHU",
          onClick: () => updateHvacBackend("ahu-02", { status: "Stopped", mode: "Manual" }, "STOP AHU"),
          variant: "red" as any,
          icon: stopIcon
        },
        {
          label: "MAINTENANCE",
          onClick: () => updateHvacBackend("ahu-02", { status: "Maintenance", mode: "Manual" }, "MAINTENANCE"),
          variant: "blue" as any,
          icon: maintenanceIcon
        },
      ];

      return (
        <HvacLayout
          roomName="AHU-02"
          roomType="LONGTERM STABILITY ROOM"
          targetTemp="30°C ± 2°C"
          targetHumidity="75%RH ± 5%"
          diagramComponent={<MachineAHU02Pid tempSP={ahu02Temp} humiditySP={ahu02Humid} running={isRunning} />}
          systemMode={systemMode}
          setpoints={setpoints}
          controlButtons={controlButtons}
          currentUser={currentUser}
          onVerifyPassword={verifyPassword}
          logs={logs}
          onRefreshData={fetchHvacData}
        />
      );
    }

    // ----- AHU-03 -----
    if (tabId === "ahu-03") {
      const isRunning = ahu03Status === "Running";
      const systemMode = [
        { label: "Operating Mode", value: ahu03Mode, statusColor: ahu03Mode === "Auto" ? "cyan" : "yellow" as any },
        { label: "Fan Status", value: ahu03Status, statusColor: isRunning ? "green" : (ahu03Status === "Maintenance" ? "cyan" : "red") as any },
        { label: "Cooling", value: isRunning ? "Active" : "Inactive", statusColor: isRunning ? "cyan" : "default" as any },
      ];

      const setpoints = [
        {
          label: "Room Temp SP",
          value: ahu03Temp,
          unit: "°C",
          min: 15.0,
          max: 30.0,
          onChange: (val: number) => {
            setAhu03Temp(val);
            debouncedUpdateHvac("ahu-03", { temp: val });
          }
        },
        {
          label: "Room Humidity SP",
          value: ahu03Humid,
          unit: "%RH",
          min: 30.0,
          max: 80.0,
          onChange: (val: number) => {
            setAhu03Humid(val);
            debouncedUpdateHvac("ahu-03", { humid: val });
          }
        },
      ];

      const controlButtons = [
        {
          label: "START AHU",
          onClick: () => updateHvacBackend("ahu-03", { status: "Running", mode: "Auto" }, "START AHU"),
          variant: "green" as any,
          icon: startIcon
        },
        {
          label: "STOP AHU",
          onClick: () => updateHvacBackend("ahu-03", { status: "Stopped", mode: "Manual" }, "STOP AHU"),
          variant: "red" as any,
          icon: stopIcon
        },
        {
          label: "MAINTENANCE",
          onClick: () => updateHvacBackend("ahu-03", { status: "Maintenance", mode: "Manual" }, "MAINTENANCE"),
          variant: "blue" as any,
          icon: maintenanceIcon
        },
      ];

      return (
        <HvacLayout
          roomName="AHU-03"
          roomType="REF.RETENTION ROOM"
          targetTemp="Max 30°C"
          targetHumidity="55%RH ± 10%"
          diagramComponent={<MachineAHU03Pid tempSP={ahu03Temp} humiditySP={ahu03Humid} running={isRunning} />}
          systemMode={systemMode}
          setpoints={setpoints}
          controlButtons={controlButtons}
          currentUser={currentUser}
          onVerifyPassword={verifyPassword}
          logs={logs}
          onRefreshData={fetchHvacData}
        />
      );
    }

    // ----- UTILITY -----
    if (tabId === "utility") {
      const isRunning = utilStatus === "Running";
      const systemMode = [
        { label: "Operating Mode", value: utilMode, statusColor: utilMode === "Auto" ? "cyan" : "yellow" as any },
        { label: "Pump Status", value: utilStatus, statusColor: isRunning ? "green" : (utilStatus === "Maintenance" ? "cyan" : "red") as any },
        { label: "UV Lamp Status", value: isRunning ? "Active" : "Off", statusColor: isRunning ? "green" : "default" as any },
      ];

      return (
        <HvacLayout
          roomName="UTILITY"
          roomType="CENTRAL UTILITY LOOP"
          targetTemp="22°C ± 2°C"
          targetHumidity="55%RH ± 5%"
          diagramComponent={<MachineUtilityPid tempSP={utilTemp} humiditySP={utilHumid} running={isRunning} />}
          systemMode={systemMode}
          currentUser={currentUser}
          onVerifyPassword={verifyPassword}
          logs={logs}
          onRefreshData={fetchHvacData}
        />
      );
    }
  }

  // WH-3
  if (unitId === "hvac-wh-3") {
    if (tabId === "heating-coil") return <div className="p-4 text-slate-800 dark:text-slate-200">🔥 Data Heating Coil WH-3</div>;
    if (tabId === "fan-motor") return <div className="p-4 text-slate-800 dark:text-slate-200">🌀 Data Fan Motor WH-3</div>;
  }

  return (
    <div className="p-4 text-yellow-500 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl">
      ⚠️ Tab <strong>{tabId}</strong> belum dikonfigurasi untuk mesin <strong>{unitId}</strong>.
    </div>
  );
};

export default MachineCustomTab;