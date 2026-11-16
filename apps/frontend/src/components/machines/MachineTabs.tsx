import { NavItem } from "../navigation/NavItem";
import { useAuthStore } from "../../store/auth.store";
import { canAccessConfigAndAudit } from "../../utils/roles";
import { canAccessHvacControls } from "../../pages/machines/HvacLayout";
import { useTranslation } from "../../i18n/useTranslation";

// ── KONFIGURASI TAB PER MESIN ────────────────────────────────────
// Tambahkan mapping untuk setiap mesin HVAC di sini
const customTabsMap: Record<string, { label: string; tabId: string }[]> = {
  // Contoh untuk QC Retained Sample
  "hvac-qc-retained-sample": [
    { label: "AHU-01", tabId: "ahu-01" },
    { label: "AHU-02", tabId: "ahu-02" },
    { label: "AHU-03", tabId: "ahu-03" },
    { label: "UTILITY", tabId: "utility" },
  ],
  // Contoh untuk mesin lain (WH-3)
  "hvac-wh-3": [
    { label: "Heating Coil", tabId: "heating-coil" },
    { label: "Fan Motor", tabId: "fan-motor" },
  ],
  // Tambahkan unit lain di sini
  // "wh-4": [{ label: "Tab Khusus WH-4", tabId: "custom-wh4" }],
  // "wh-5": [{ label: "Filter Status", tabId: "filter-status" }],
};

type MachineTabsProps = {
  basePath: string;                 // path unit saat ini, misal /machines/hvac/hvac-qc-retained-sample
  isHvacGroup?: boolean;            // flag apakah ini grup HVAC
  groupId?: string;                 // id grup (hvac)
  currentUnitId?: string;           // id unit saat ini (hvac-qc-retained-sample)
};

export const MachineTabs = ({
  basePath,
  isHvacGroup,
  groupId,
  currentUnitId,
}: MachineTabsProps) => {
  const user = useAuthStore((state) => state.user);
  const role = user?.role ?? "user";
  const canAccessConfig = canAccessConfigAndAudit(role);
  const hasControlAccess = canAccessHvacControls(user?.role);
  const { t } = useTranslation();
  const isWarehouseGroup = groupId === "hvac-warehouse" || currentUnitId === "hvac-wh-7";

  // ── Mode HVAC : tab dinamis per mesin ──────────────────────────
  if (isHvacGroup && groupId && currentUnitId) {
    // Ambil tab khusus untuk unit ini (jika ada di mapping)
    const customTabs = customTabsMap[currentUnitId] || [];

    return (
      <div className="mb-4 border-b border-[#acd3ff] dark:border-slate-800">
        <nav className="flex items-center gap-1.5 overflow-x-auto scrollbar-thin whitespace-nowrap py-1">
          {/* Tab Dashboard */}
          <NavItem to={basePath} label={isWarehouseGroup ? t("warehouse7.tabs.dashboard", "Dashboard") : "Dashboard"} tone="tabs" end />

          {/* Tab khusus mesin ini (dinamis) */}
          {customTabs.map(({ label, tabId }) => (
            <NavItem
              key={tabId}
              to={`${basePath}/custom-tab/${tabId}`}
              label={label}
              tone="tabs"
            />
          ))}

          <NavItem to={`${basePath}/statistics`} label={isWarehouseGroup ? t("warehouse7.tabs.trend", "Trend Analysis") : "Trend Analysis"} tone="tabs" />
          <NavItem to={`${basePath}/tasks`} label={isWarehouseGroup ? t("warehouse7.tabs.tasks", "Tasks") : "Tasks"} tone="tabs" />
          <NavItem to={`${basePath}/alarm`} label={isWarehouseGroup ? t("warehouse7.tabs.alarms", "Alarms") : "Alarms"} tone="tabs" />
          <NavItem to={`${basePath}/maintenance`} label={isWarehouseGroup ? t("warehouse7.tabs.maintenance", "Maintenance") : "Maintenance"} tone="tabs" />
          <NavItem to={`${basePath}/shift-report`} label={isWarehouseGroup ? t("warehouse7.tabs.shiftReport", "Shift Report") : "Shift Report"} tone="tabs" />
          <NavItem to={`${basePath}/energy`} label={isWarehouseGroup ? t("warehouse7.tabs.energy", "Energy") : "Energy"} tone="tabs" />
          {canAccessConfig && <NavItem to={`${basePath}/configuration`} label={isWarehouseGroup ? t("warehouse7.tabs.configuration", "Configuration") : "Configuration"} tone="tabs" />}
          {canAccessConfig && <NavItem to={`${basePath}/audit-trail`} label={isWarehouseGroup ? t("warehouse7.tabs.auditTrail", "Audit Trail") : "Audit Trail"} tone="tabs" />}
        </nav>
      </div>
    );
  }

  // ── Mode standar (non‑HVAC) ──────────────────────────────────────
  return (
    <div className="mb-4 border-b border-[#acd3ff] dark:border-slate-800">
      <nav className="flex items-center gap-1.5 overflow-x-auto scrollbar-thin whitespace-nowrap py-1">
        <NavItem to={basePath} label="Dashboard" tone="tabs" end />
        <NavItem
          to={`${basePath}/pid-diagram`}
          label="P&ID"
          tone="tabs"
        />
        <NavItem
          to={`${basePath}/statistics`}
          label="Trend Analysis"
          tone="tabs"
        />
        <NavItem
          to={`${basePath}/tasks`}
          label="Tasks"
          tone="tabs"
        />
        <NavItem
          to={`${basePath}/alarm`}
          label="Alarms"
          tone="tabs"
        />
        <NavItem
          to={`${basePath}/maintenance`}
          label="Maintenance"
          tone="tabs"
        />
        <NavItem
          to={`${basePath}/shift-report`}
          label="Shift Report"
          tone="tabs"
        />
        <NavItem
          to={`${basePath}/energy`}
          label="Energy"
          tone="tabs"
        />
        {canAccessConfig && (
          <NavItem
            to={`${basePath}/configuration`}
            label="Configuration"
            tone="tabs"
          />
        )}
        {canAccessConfig && (
          <NavItem
            to={`${basePath}/audit-trail`}
            label="Audit Trail"
            tone="tabs"
          />
        )}
      </nav>
    </div>
  );
};