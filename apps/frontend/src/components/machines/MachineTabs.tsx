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
          label="P&ID Diagram"
          tone="tabs"
        />
        <NavItem
          to={`${basePath}/statistics`}
          label="Data Statistik"
          tone="tabs"
        />
        <NavItem
          to={`${basePath}/maintenance`}
          label="History Perbaikan"
          tone="tabs"
        />
        <NavItem
          to={`${basePath}/shift-report`}
          label="Shift Report"
          tone="tabs"
        />
      </nav>
    </div>
  );
};
