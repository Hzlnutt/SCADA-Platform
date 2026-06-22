import { useState } from "react";
import { useParams } from "react-router-dom";
import HvacLayout from "./HvacLayout";

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

  // ================= STATE MANAGEMENT PER TAB =================
  // AHU-01 State
  const [ahu01Temp, setAhu01Temp] = useState(46.8);
  const [ahu01Humid, setAhu01Humid] = useState(75.0);
  const [ahu01Mode, setAhu01Mode] = useState("Auto");
  const [ahu01Status, setAhu01Status] = useState("Running");

  // AHU-02 State
  const [ahu02Temp, setAhu02Temp] = useState(22.4);
  const [ahu02Humid, setAhu02Humid] = useState(55.0);
  const [ahu02Mode, setAhu02Mode] = useState("Auto");
  const [ahu02Status, setAhu02Status] = useState("Running");

  // AHU-03 State
  const [ahu03Temp, setAhu03Temp] = useState(20.5);
  const [ahu03Humid, setAhu03Humid] = useState(55.0);
  const [ahu03Mode, setAhu03Mode] = useState("Manual");
  const [ahu03Status, setAhu03Status] = useState("Running");

  // Utility State
  const [utilTemp, setUtilTemp] = useState(22.0);
  const [utilHumid, setUtilHumid] = useState(60.0);
  const [utilMode, setUtilMode] = useState("Auto");
  const [utilStatus, setUtilStatus] = useState("Running");

  // ================= RENDER LOGIC =================
  if (unitId === "hvac-qc-retained-sample") {

    // ----- TAB: AHU-01 -----
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
          onChange: setAhu01Temp,
        },
        {
          label: "Humidity Setpoint",
          value: ahu01Humid,
          unit: "%RH",
          min: 60.0,
          max: 90.0,
          onChange: setAhu01Humid,
        },
      ];

      const controlButtons = [
        {
          label: "START AHU",
          onClick: () => {
            setAhu01Status("Running");
            setAhu01Mode("Auto");
          },
          variant: "green" as any,
          icon: startIcon,
        },
        {
          label: "STOP AHU",
          onClick: () => {
            setAhu01Status("Stopped");
            setAhu01Mode("Manual");
          },
          variant: "red" as any,
          icon: stopIcon,
        },
        {
          label: "MAINTENANCE",
          onClick: () => {
            setAhu01Status("Maintenance");
            setAhu01Mode("Manual");
          },
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
              running={ahu01Status === "Running"}
            />
          }
          systemMode={systemMode}
          setpoints={setpoints}
          controlButtons={controlButtons}
        />
      );
    }

    // ----- TAB: AHU-02 -----
    if (tabId === "ahu-02") {
      const isRunning = ahu02Status === "Running";
      const systemMode = [
        { label: "Operating Mode", value: ahu02Mode, statusColor: ahu02Mode === "Auto" ? "cyan" : "yellow" as any },
        { label: "Fan-02 A Status", value: ahu02Status, statusColor: isRunning ? "green" : (ahu02Status === "Maintenance" ? "cyan" : "red") as any },
        { label: "Fan-02 B Status", value: ahu02Status, statusColor: isRunning ? "green" : (ahu02Status === "Maintenance" ? "cyan" : "red") as any },
        { label: "CU-02 A Status", value: isRunning ? "Active" : "Inactive", statusColor: isRunning ? "cyan" : "default" as any },
        { label: "CU-02 B STatus", value: isRunning ? "Active" : "Inactive", statusColor: isRunning ? "cyan" : "default" as any },
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
          onChange: setAhu02Temp,
        },
        {
          label: "Dehumidify Target",
          value: ahu02Humid,
          unit: "%RH",
          min: 30.0,
          max: 80.0,
          onChange: setAhu02Humid,
        },
      ];

      const controlButtons = [
        {
          label: "START AHU",
          onClick: () => {
            setAhu02Status("Running");
            setAhu02Mode("Auto");
          },
          variant: "green" as any,
          icon: startIcon,
        },
        {
          label: "STOP AHU",
          onClick: () => {
            setAhu02Status("Stopped");
            setAhu02Mode("Manual");
          },
          variant: "red" as any,
          icon: stopIcon,
        },
        {
          label: "MAINTENANCE",
          onClick: () => {
            setAhu02Status("Maintenance");
            setAhu02Mode("Manual");
          },
          variant: "blue" as any,
          icon: maintenanceIcon,
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
              running={isRunning}
            />
          }
          systemMode={systemMode}
          setpoints={setpoints}
          controlButtons={controlButtons}
        />
      );
    }

    // ----- TAB: AHU-03 -----
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
          onChange: setAhu03Temp,
        },
        {
          label: "Room Humidity SP",
          value: ahu03Humid,
          unit: "%RH",
          min: 30.0,
          max: 80.0,
          onChange: setAhu03Humid,
        },
      ];

      const controlButtons = [
        {
          label: "START AHU",
          onClick: () => {
            setAhu03Status("Running");
            setAhu03Mode("Auto");
          },
          variant: "green" as any,
          icon: startIcon,
        },
        {
          label: "STOP AHU",
          onClick: () => {
            setAhu03Status("Stopped");
            setAhu03Mode("Manual");
          },
          variant: "red" as any,
          icon: stopIcon,
        },
        {
          label: "MAINTENANCE",
          onClick: () => {
            setAhu03Status("Maintenance");
            setAhu03Mode("Manual");
          },
          variant: "blue" as any,
          icon: maintenanceIcon,
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
              running={isRunning}
            />
          }
          systemMode={systemMode}
          setpoints={setpoints}
          controlButtons={controlButtons}
        />
      );
    }

    // ----- TAB: UTILITY -----
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
          diagramComponent={
            <MachineUtilityPid
              tempSP={utilTemp}
              humiditySP={utilHumid}
              running={isRunning}
            />
          }
          systemMode={systemMode}
        />
      );
    }
  }

  // Kasus: WH-3
  if (unitId === "hvac-wh-3") {
    if (tabId === "heating-coil") return <div className="p-4 text-slate-800 dark:text-slate-200">🔥 Data Heating Coil WH-3</div>;
    if (tabId === "fan-motor") return <div className="p-4 text-slate-800 dark:text-slate-200">🌀 Data Fan Motor WH-3</div>;
  }

  // Default jika tab tidak ditemukan
  return (
    <div className="p-4 text-yellow-500 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl">
      ⚠️ Tab <strong>{tabId}</strong> belum dikonfigurasi untuk mesin <strong>{unitId}</strong>.
    </div>
  );
};

export default MachineCustomTab;