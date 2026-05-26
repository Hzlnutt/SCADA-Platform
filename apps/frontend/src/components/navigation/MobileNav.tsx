import { NavItem } from "./NavItem";
import { useAuthStore } from "../../store/auth.store";

export const MobileNav = () => {
  const role = useAuthStore((state) => state.user?.role ?? "user");
  const canApprove = role === "team_head" || role === "leader" || role === "admin";
  const items = [
    { to: "/", label: "Dashboard" },
    { to: "/plant-layout", label: "Plant" },
    { to: "/machines", label: "Machines" },
    { to: "/alarms", label: "Alarms" },
    { to: "/historian", label: "Historian" },
    { to: "/analytics", label: "Analytics" },
    { to: "/devices", label: "Devices" },
    { to: "/reports", label: "Reports" },
    { to: "/machine-health", label: "Health" },
    { to: "/utility-status", label: "Utility" },
    { to: "/settings", label: "Settings" }
  ];

  if (canApprove) {
    items.push({ to: "/approvals", label: "Approvals" });
    items.push({ to: "/thresholds", label: "Thresholds" });
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
};
