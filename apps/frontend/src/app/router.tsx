import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { AppLayout } from "./layout";
import { RequireAuth } from "./RequireAuth";
import Alarms from "../pages/Alarms";
import Analytics from "../pages/Analytics";
import Dashboard from "../pages/Dashboard";
import Devices from "../pages/Devices";
import Historian from "../pages/Historian";
import PlantLayout from "../pages/PlantLayout";
import Reports from "../pages/Reports";
import Settings from "../pages/Settings";
import Profile from "../pages/Profile";
import AdminPanel from "../pages/AdminPanel";
import AuthLayout from "../pages/auth/AuthLayout";
import Login from "../pages/auth/Login";
import Register from "../pages/auth/Register";
import { MachineLayout } from "../pages/machines/MachineLayout";
import MachineOverview from "../pages/machines/MachineOverview";
import MachineStatistics from "../pages/machines/MachineStatistics";
import MachineMaintenance from "../pages/machines/MachineMaintenance";
import MachineShiftReport from "../pages/machines/MachineShiftReport";
import MachinePidDiagram from "../pages/machines/MachinePidDiagram";
import MachinesOverview from "../pages/machines/MachinesOverview";
import MachineGroupOverview from "../pages/machines/MachineGroupOverview";
import MachineHistorian from "../pages/machines/MachineHistorian";
import MachineAlarm from "../pages/machines/MachineAlarm";
import MachineEnergy from "../pages/machines/MachineEnergy";
import MachineConfig from "../pages/machines/MachineConfig";
import Approvals from "../pages/Approvals";

import MachineHealth from "../pages/MachineHealth";
import UtilityStatus from "../pages/UtilityStatus";
import Electricity from "../pages/utilities/Electricity";
import Gas from "../pages/utilities/Gas";
import Water from "../pages/utilities/Water";
import Hvac from "../pages/utilities/Hvac";
import Wwtp from "../pages/utilities/Wwtp";
import UtilityOverview from "../pages/utilities/UtilityOverview";
import Tasks from "../pages/Tasks";

// ✅ IMPORT KOMPONEN CUSTOM TAB
import MachineCustomTab from "../pages/machines/MachineCustomTab";

export const AppRouter = () => {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<RequireAuth />}>
          <Route element={<AppLayout />}>
            <Route index element={<Dashboard />} />
            <Route path="dashboard" element={<Navigate to="/" replace />} />
            <Route path="tasks" element={<Tasks />} />
            <Route path="alarms" element={<Alarms />} />
            <Route path="historian" element={<Historian />} />
            <Route path="analytics" element={<Analytics />} />
            <Route path="plant-layout" element={<PlantLayout />} />
            <Route path="plant" element={<Navigate to="/plant-layout" replace />} />
            
            <Route path="machines">
              <Route index element={<MachinesOverview />} />
              <Route path=":groupId" element={<MachineGroupOverview />} />
              
              <Route path=":groupId/:unitId" element={<MachineLayout />}>
                <Route index element={<MachineOverview />} />
                
                {/* ✅ ROUTE GENERIC UNTUK SEMUA CUSTOM TAB */}
                <Route path="custom-tab/:tabId" element={<MachineCustomTab />} />

                {/* Route standar */}
                <Route path="pid-diagram" element={<MachinePidDiagram />} />
                <Route path="historian" element={<MachineHistorian />} />
                <Route path="statistics" element={<MachineStatistics />} />
                <Route path="maintenance" element={<MachineMaintenance />} />
                <Route path="shift-report" element={<MachineShiftReport />} />
                <Route path="alarm" element={<MachineAlarm />} />
                <Route path="energy" element={<MachineEnergy />} />
                <Route path="configuration" element={<MachineConfig />} />
              </Route>
            </Route>

            <Route path="devices" element={<Devices />} />
            <Route path="reports" element={<Reports />} />
            <Route path="utility-status" element={<UtilityStatus />} />
            <Route path="utility" element={<UtilityOverview />} />
            <Route path="listrik" element={<Electricity />} />
            <Route path="air" element={<Water />} />
            <Route path="gas" element={<Gas />} />
            <Route path="hvac" element={<Hvac />} />
            <Route path="wwtp" element={<Wwtp />} />
            <Route path="settings" element={<Settings />} />
            <Route path="approvals" element={<Approvals />} />

            <Route path="machine-health" element={<MachineHealth />} />
            <Route path="profile" element={<Profile />} />
            <Route path="admin" element={<AdminPanel />} />
          </Route>
        </Route>
        <Route element={<AuthLayout />}>
          <Route path="login" element={<Login />} />
          <Route path="register" element={<Register />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
};