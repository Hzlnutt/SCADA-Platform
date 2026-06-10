import { NavItem } from "./NavItem";
import { useAuthStore } from "../../store/auth.store";

export const MobileNav = () => {
  const role = useAuthStore((state) => state.user?.role ?? "user");
  const canApprove = role === "team_head" || role === "leader" || role === "admin";
  const items = [
    { to: "/", label: "Dashboard" },
    { to: "/plant-layout", label: "Plant" },
    { to: "/machines", label: "Machines" },
    { to: "/devices", label: "Devices" },
    { to: "/alarms", label: "Alarms" },
    { to: "/historian", label: "Historian" },
    { to: "/analytics", label: "Analytics" },
    { to: "/listrik", label: "Listrik" },
    { to: "/gas", label: "Gas" },
    { to: "/air", label: "Air" },
    { to: "/hvac", label: "HVAC" },
    { to: "/wwtp", label: "WWTP" },
    { to: "/reports", label: "Reports" },
    { to: "/settings", label: "Settings" }
  ];

  if (canApprove) {
    items.push({ to: "/approvals", label: "Approvals" }, { to: "/thresholds", label: "Thresholds" });
  }

  if (role === "admin") {
    items.push({ to: "/admin", label: "Admin" });
  }

  return (
    <div className="border-b border-[#acd3ff] bg-white px-4 lg:px-5">
      <nav className="flex gap-1 overflow-x-auto">
        {items.map((item) => (
          <div key={item.to} className="shrink-0">
            <NavItem to={item.to} label={item.label} tone="tabs" />
          </div>
        ))}
      </nav>
    </div>
  );
}
