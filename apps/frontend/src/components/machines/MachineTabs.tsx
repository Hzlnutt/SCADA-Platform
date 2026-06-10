import { NavItem } from "../navigation/NavItem";

type MachineTabsProps = {
  basePath: string;
};

export const MachineTabs = ({ basePath }: MachineTabsProps) => {
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
