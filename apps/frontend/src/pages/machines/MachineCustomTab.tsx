import { useState, useEffect, useCallback, useRef } from "react";
import { useParams } from "react-router-dom";
import HvacLayout, { type LogEntry } from "./HvacLayout";
import { useAuthStore } from "../../store/auth.store";
import { getJson, postJson } from "../../services/api.client";
import { getSocket } from "../../services/socket.service";
import { usePageActive } from "../../hooks/usePageActive";

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

interface HvacRetainLiveState {
  PLC1_AHU1_Utl?: {
    Connected?: boolean;
    ACT_RTx_1A?: number;
    ACT_RHx_1A?: number;
    ACT_RTx_1B?: number;
    ACT_RHx_1B?: number;
    ACT_RATx_1?: number;
    ACT_RAHx_1?: number;
    ACT_SF01_CAP?: number;
    ACT_SF01_SPD?: number;
    ACT_SF01_CUR?: number;
    ACT_EH01_CAP?: number;
    xIND_RUN_SF01?: boolean;
    xIND_RUN_EH01?: boolean;
    xIND_RUN_HF01?: boolean;
    xIND_RUN_HP?: boolean;
  };
  PLC2_AHU2?: {
    Connected?: boolean;
    ACT_RTx_2A?: number;
    ACT_RHx_2A?: number;
    ACT_RTx_2B?: number;
    ACT_RHx_2B?: number;
    ACT_RATx_2?: number;
    ACT_RAHx_2?: number;
    ACT_SF02_CAP?: number;
    ACT_SF02A_SPD?: number;
    ACT_SF02B_SPD?: number;
    ACT_SF02B_CUR?: number;
    ACT_EH02_CAP?: number;
    xIND_RUN_SF02A?: boolean;
    xIND_RUN_SF02B?: boolean;
    xIND_RUN_EH02?: boolean;
    xIND_RUN_CU02A?: boolean;
    xIND_RUN_CU02B?: boolean;
  };
  PLC2_AHU3?: {
    Connected?: boolean;
    ACT_RTx_3A?: number;
    ACT_RTx_3B?: number;
  };
}

const DEFAULT_HVAC_RETAIN_LIVE: HvacRetainLiveState = {
  PLC1_AHU1_Utl: {},
  PLC2_AHU2: {},
  PLC2_AHU3: {}
};

const MachineCustomTab = () => {
  const { tabId, unitId } = useParams();
  const isPageActive = usePageActive();

  const user = useAuthStore((state) => state.user);
  const currentUser = user?.name || "Admin";

  // Real-time Live Telemetry from Ignition PLC APIs
  const [hvacRetainLive, setHvacRetainLive] = useState<HvacRetainLiveState>(DEFAULT_HVAC_RETAIN_LIVE);

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
      const [statesRes, logsRes, liveRes] = await Promise.all([
        getJson<{ data: Record<string, any> }>("/operations/hvac/states").catch(() => null),
        getJson<{ data: any[] }>("/operations/hvac/logs").catch(() => null),
        getJson<{ data: HvacRetainLiveState }>("/operations/hvac/retained-sample/live").catch(() => null)
      ]);

      if (statesRes?.data) {
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
      }

      if (logsRes?.data) {
        setLogs(logsRes.data.map((l: any) => ({
          ...l,
          timestamp: new Date(l.timestamp)
        })));
      }

      if (liveRes?.data) {
        setHvacRetainLive(prev => ({
          PLC1_AHU1_Utl: { ...prev.PLC1_AHU1_Utl, ...liveRes.data.PLC1_AHU1_Utl },
          PLC2_AHU2: { ...prev.PLC2_AHU2, ...liveRes.data.PLC2_AHU2 },
          PLC2_AHU3: { ...prev.PLC2_AHU3, ...liveRes.data.PLC2_AHU3 }
        }));
      }
    } catch (error) {
      console.error("Failed to fetch HVAC data:", error);
    }
  }, []);

  // Polling and WebSocket listener for live data
  useEffect(() => {
    fetchHvacData();

    const socket = getSocket();
    const handleLive = (data: HvacRetainLiveState) => {
      if (!data) return;
      setHvacRetainLive(prev => ({
        PLC1_AHU1_Utl: { ...prev.PLC1_AHU1_Utl, ...(data.PLC1_AHU1_Utl || {}) },
        PLC2_AHU2: { ...prev.PLC2_AHU2, ...(data.PLC2_AHU2 || {}) },
        PLC2_AHU3: { ...prev.PLC2_AHU3, ...(data.PLC2_AHU3 || {}) }
      }));
    };

    socket.on("hvac:retain_live", handleLive);
    socket.on("hvac:live_update", handleLive);

    // Fallback polling every 5s when page active
    let interval: ReturnType<typeof setInterval> | null = null;
    if (isPageActive) {
      interval = setInterval(() => {
        fetchHvacData();
      }, 5000);
    }

    return () => {
      socket.off("hvac:retain_live", handleLive);
      socket.off("hvac:live_update", handleLive);
      if (interval) clearInterval(interval);
    };
  }, [fetchHvacData, isPageActive, tabId, unitId]);

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
      const plc1 = hvacRetainLive.PLC1_AHU1_Utl || {};
      const isConnected = plc1.Connected !== undefined ? Boolean(plc1.Connected) : true;
      const isSfRunning = isConnected && (plc1.xIND_RUN_SF01 !== undefined ? Boolean(plc1.xIND_RUN_SF01) : (ahu01Status === "Running"));
      const isEhOn = isConnected && (plc1.xIND_RUN_EH01 !== undefined ? Boolean(plc1.xIND_RUN_EH01) : (ahu01Status === "Running"));
      const isHfRunning = isConnected && (plc1.xIND_RUN_HF01 !== undefined ? Boolean(plc1.xIND_RUN_HF01) : (ahu01Status === "Running"));

      const headerMode = isConnected ? ahu01Mode : "Manual";
      const headerStatus = isConnected
        ? (isSfRunning ? "Running" : (ahu01Status === "Maintenance" ? "Maintenance" : "Stopped"))
        : "Stopped";

      const systemMode = [
        { label: "Operating Mode", value: headerMode, statusColor: headerMode === "Auto" ? "cyan" : "yellow" as any },
        { label: "Fan Status", value: isSfRunning ? "Running" : "Stopped", statusColor: isSfRunning ? "green" : "red" as any },
        { label: "Electric Heater", value: isEhOn ? "On" : "Off", statusColor: isEhOn ? "green" : "default" as any },
        { label: "Humidifier Fan Status", value: isHfRunning ? "Running" : "Stopped", statusColor: isHfRunning ? "green" : "red" as any },
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
          diagramComponent={
            <MachineAHU01Pid
              tempSP={ahu01Temp}
              humiditySP={ahu01Humid}
              running={isSfRunning}
              data={plc1}
            />
          }
          systemMode={systemMode}
          setpoints={setpoints}
          controlButtons={controlButtons}
          currentUser={currentUser}
          onVerifyPassword={verifyPassword}
          logs={logs}
          onRefreshData={fetchHvacData}
          currentMode={headerMode}
          currentStatus={headerStatus}
        />
      );
    }

    // ----- AHU-02 -----
    if (tabId === "ahu-02") {
      const plc2 = hvacRetainLive.PLC2_AHU2 || {};
      const isConnected = plc2.Connected !== undefined ? Boolean(plc2.Connected) : true;
      const isSf02aRunning = isConnected && (plc2.xIND_RUN_SF02A !== undefined ? Boolean(plc2.xIND_RUN_SF02A) : (ahu02Status === "Running"));
      const isSf02bRunning = isConnected && (plc2.xIND_RUN_SF02B !== undefined ? Boolean(plc2.xIND_RUN_SF02B) : (ahu02Status === "Running"));
      const isCu02aActive = isConnected && (plc2.xIND_RUN_CU02A !== undefined ? Boolean(plc2.xIND_RUN_CU02A) : (ahu02Status === "Running"));
      const isCu02bActive = isConnected && (plc2.xIND_RUN_CU02B !== undefined ? Boolean(plc2.xIND_RUN_CU02B) : (ahu02Status === "Running"));
      const isEh02On = isConnected && (plc2.xIND_RUN_EH02 !== undefined ? Boolean(plc2.xIND_RUN_EH02) : false);

      const isAnyFanRunning = isSf02aRunning || isSf02bRunning;
      const headerMode = isConnected ? ahu02Mode : "Manual";
      const headerStatus = isConnected
        ? (isAnyFanRunning ? "Running" : (ahu02Status === "Maintenance" ? "Maintenance" : "Stopped"))
        : "Stopped";

      const systemMode = [
        { label: "Operating Mode", value: headerMode, statusColor: headerMode === "Auto" ? "cyan" : "yellow" as any },
        { label: "Fan-02 A Status", value: isSf02aRunning ? "Running" : "Stopped", statusColor: isSf02aRunning ? "green" : "red" as any },
        { label: "Fan-02 B Status", value: isSf02bRunning ? "Running" : "Stopped", statusColor: isSf02bRunning ? "green" : "red" as any },
        { label: "CU-02 A Status", value: isCu02aActive ? "Active" : "Inactive", statusColor: isCu02aActive ? "cyan" : "default" as any },
        { label: "CU-02 B Status", value: isCu02bActive ? "Active" : "Inactive", statusColor: isCu02bActive ? "cyan" : "default" as any },
        { label: "Electric Heater Status", value: isEh02On ? "On" : "Off", statusColor: isEh02On ? "green" : "default" as any },
        { label: "Humidity Fan Status", value: isConnected ? "Running" : "Stopped", statusColor: isConnected ? "green" : "red" as any },
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
          diagramComponent={
            <MachineAHU02Pid
              tempSP={ahu02Temp}
              humiditySP={ahu02Humid}
              running={isAnyFanRunning}
              data={plc2}
            />
          }
          systemMode={systemMode}
          setpoints={setpoints}
          controlButtons={controlButtons}
          currentUser={currentUser}
          onVerifyPassword={verifyPassword}
          logs={logs}
          onRefreshData={fetchHvacData}
          currentMode={headerMode}
          currentStatus={headerStatus}
        />
      );
    }

    // ----- AHU-03 -----
    if (tabId === "ahu-03") {
      const plc2 = hvacRetainLive.PLC2_AHU2 || {};
      const plc3 = hvacRetainLive.PLC2_AHU3 || {};

      // AHU-03 running status is strictly linked 1-to-1 with AHU-02 (same PLC2 controller)
      const isConnected = plc2.Connected !== undefined ? Boolean(plc2.Connected) : (plc3.Connected !== undefined ? Boolean(plc3.Connected) : true);
      const isSf02aRunning = isConnected && (plc2.xIND_RUN_SF02A !== undefined ? Boolean(plc2.xIND_RUN_SF02A) : (ahu02Status === "Running"));
      const isSf02bRunning = isConnected && (plc2.xIND_RUN_SF02B !== undefined ? Boolean(plc2.xIND_RUN_SF02B) : (ahu02Status === "Running"));
      const isAhu2Running = isSf02aRunning || isSf02bRunning || (ahu02Status === "Running");

      const headerMode = isConnected ? ahu02Mode : "Manual";
      const headerStatus = isConnected
        ? (isAhu2Running ? "Running" : (ahu02Status === "Maintenance" ? "Maintenance" : "Stopped"))
        : "Stopped";

      const systemMode = [
        { label: "Operating Mode", value: headerMode, statusColor: headerMode === "Auto" ? "cyan" : "yellow" as any },
        { label: "Fan Status", value: isAhu2Running ? "Running" : "Stopped", statusColor: isAhu2Running ? "green" : (headerStatus === "Maintenance" ? "cyan" : "red") as any },
        { label: "Cooling", value: isAhu2Running ? "Active" : "Inactive", statusColor: isAhu2Running ? "cyan" : "default" as any },
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
          onClick: async () => {
            await updateHvacBackend("ahu-02", { status: "Running", mode: "Auto" }, "START AHU");
            await updateHvacBackend("ahu-03", { status: "Running", mode: "Auto" }, "START AHU");
          },
          variant: "green" as any,
          icon: startIcon
        },
        {
          label: "STOP AHU",
          onClick: async () => {
            await updateHvacBackend("ahu-02", { status: "Stopped", mode: "Manual" }, "STOP AHU");
            await updateHvacBackend("ahu-03", { status: "Stopped", mode: "Manual" }, "STOP AHU");
          },
          variant: "red" as any,
          icon: stopIcon
        },
        {
          label: "MAINTENANCE",
          onClick: async () => {
            await updateHvacBackend("ahu-02", { status: "Maintenance", mode: "Manual" }, "MAINTENANCE");
            await updateHvacBackend("ahu-03", { status: "Maintenance", mode: "Manual" }, "MAINTENANCE");
          },
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
          diagramComponent={
            <MachineAHU03Pid
              tempSP={ahu03Temp}
              humiditySP={ahu03Humid}
              running={isAhu2Running}
              data={{
                ...plc3,
                isRunning: isAhu2Running,
                Connected: isConnected
              }}
            />
          }
          systemMode={systemMode}
          setpoints={setpoints}
          controlButtons={controlButtons}
          currentUser={currentUser}
          onVerifyPassword={verifyPassword}
          logs={logs}
          onRefreshData={fetchHvacData}
          currentMode={headerMode}
          currentStatus={headerStatus}
        />
      );
    }

    // ----- UTILITY -----
    if (tabId === "utility") {
      const plc1 = hvacRetainLive.PLC1_AHU1_Utl || {};
      const isConnected = plc1.Connected !== undefined ? Boolean(plc1.Connected) : true;
      const isHpRunning = isConnected && (plc1.xIND_RUN_HP !== undefined ? Boolean(plc1.xIND_RUN_HP) : (utilStatus === "Running"));

      const headerMode = isConnected ? utilMode : "Manual";
      const headerStatus = isConnected ? (isHpRunning ? "Running" : (utilStatus === "Maintenance" ? "Maintenance" : "Stopped")) : "Stopped";

      const systemMode = [
        { label: "Operating Mode", value: headerMode, statusColor: headerMode === "Auto" ? "cyan" : "yellow" as any },
        { label: "Pump Status", value: isHpRunning ? "Running" : "Stopped", statusColor: isHpRunning ? "green" : "red" as any },
        { label: "UV Lamp Status", value: isConnected ? "Active" : "Off", statusColor: isConnected ? "green" : "default" as any },
      ];

      return (
        <HvacLayout
          roomName="UTILITY"
          roomType="CENTRAL UTILITY LOOP"
          targetTemp="22°C ± 2°C"
          targetHumidity="55%RH ± 5%"
          diagramComponent={
            <MachineUtilityPid
              tempSP={utilTemp}
              humiditySP={utilHumid}
              running={isHpRunning}
              data={plc1}
            />
          }
          systemMode={systemMode}
          currentUser={currentUser}
          onVerifyPassword={verifyPassword}
          logs={logs}
          onRefreshData={fetchHvacData}
          currentMode={headerMode}
          currentStatus={headerStatus}
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