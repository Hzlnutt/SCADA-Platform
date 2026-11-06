import { NavItem } from "./NavItem";
import { useAuthStore } from "../../store/auth.store";
import { useSystemStore } from "../../store/system.store";

export const MobileNav = () => {
  const role = useAuthStore((state) => state.user?.role ?? "user");
  const toggleMobileSidebar = useSystemStore((state) => state.toggleMobileSidebar);
  const canApprove = role === "team_head" || role === "leader" || role === "admin";

  const items = [
    { to: "/", label: "Dashboard" },
    { to: "/plant-layout", label: "Plant" },
    { to: "/machines", label: "Machines" },
    { to: "/devices", label: "Devices" },
    { to: "/alarms", label: "Alarms" },
    { to: "/analytics", label: "Analytics" },
    { to: "/listrik", label: "Listrik" },
    { to: "/listrik/incoming-pln", label: "PLN" },
    { to: "/listrik/distribusi", label: "Distribusi" },
    { to: "/gas", label: "Gas" },
    { to: "/air", label: "Air" },
    { to: "/hvac", label: "HVAC" },
    { to: "/utility-billing", label: "Billing" },
    { to: "/reports", label: "Reports" },
    { to: "/tasks", label: "Tasks" },
    { to: "/settings", label: "Settings" }
  ];

  if (canApprove) {
    items.push({ to: "/approvals", label: "Approvals" });
  }

  if (role === "admin") {
    items.push({ to: "/admin", label: "Admin" });
  }

  return (
    <div className="border-b border-[#acd3ff] dark:border-slate-800 bg-white dark:bg-slate-900 px-3 sm:px-4 lg:px-5 transition-colors duration-300">
      <nav className="flex items-center gap-1.5 overflow-x-auto scrollbar-thin py-1.5">
        <button
          type="button"
          onClick={toggleMobileSidebar}
          className="shrink-0 flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-[#1f6fb5]/10 dark:bg-sky-500/20 text-[#1f6fb5] dark:text-sky-300 border border-[#1f6fb5]/25 hover:bg-[#1f6fb5]/20 transition cursor-pointer"
        >
          <span>☰</span>
          <span>Semua Menu</span>
        </button>
        {items.map((item) => (
          <div key={item.to} className="shrink-0">
            <NavItem to={item.to} label={item.label} tone="tabs" />
          </div>
        ))}
      </nav>
    </div>
  );
};
