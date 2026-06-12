import { NavItem } from "../navigation/NavItem";

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
  // ── Mode HVAC : tab dinamis per mesin ──────────────────────────
  if (isHvacGroup && groupId && currentUnitId) {
    // Ambil tab khusus untuk unit ini (jika ada di mapping)
    const customTabs = customTabsMap[currentUnitId] || [];

    return (
      <div className="mb-4 border-b border-[#acd3ff]">
        <nav className="flex flex-wrap gap-1 overflow-x-auto">
          {/* Tab Dashboard */}
          <NavItem to={basePath} label="Dashboard" tone="tabs" end />

          {/* Tab khusus mesin ini (dinamis) */}
          {customTabs.map(({ label, tabId }) => (
            <NavItem
              key={tabId}
              to={`${basePath}/custom-tab/${tabId}`}
              label={label}
              tone="tabs"
            />
          ))}

          {/* Tab standar (seperti di utility/cooling-system) */}
          <NavItem to={`${basePath}/historian`} label="Historian" tone="tabs" />
          <NavItem to={`${basePath}/statistics`} label="Trend Analysis" tone="tabs" />
          <NavItem to={`${basePath}/alarm`} label="Alarms" tone="tabs" />
          <NavItem to={`${basePath}/maintenance`} label="Maintenance" tone="tabs" />
          <NavItem to={`${basePath}/shift-report`} label="Shift Report" tone="tabs" />
          <NavItem to={`${basePath}/energy`} label="Energy" tone="tabs" />
          <NavItem to={`${basePath}/configuration`} label="Configuration" tone="tabs" />
        </nav>
      </div>
    );
  }

  // ── Mode standar (non‑HVAC) ──────────────────────────────────────
  return (
    <div className="mb-4 border-b border-[#acd3ff]">
      <nav className="flex flex-wrap gap-1 overflow-x-auto">
        <NavItem to={basePath} label="Dashboard" tone="tabs" end />
        <NavItem
          to={`${basePath}/pid-diagram`}
          label="P&ID"
          tone="tabs"
        />
        <NavItem
          to={`${basePath}/historian`}
          label="Historian"
          tone="tabs"
        />
        <NavItem
          to={`${basePath}/statistics`}
          label="Trend Analysis"
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
        <NavItem
          to={`${basePath}/configuration`}
          label="Configuration"
          tone="tabs"
        />
      </nav>
    </div>
  );
};