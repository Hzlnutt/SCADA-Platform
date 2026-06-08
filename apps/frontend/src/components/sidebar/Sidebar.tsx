import { useState } from "react";
import { NavItem } from "../navigation/NavItem";
import { machineGroups } from "../../data/machines";
import { useAuthStore } from "../../store/auth.store";

const IconDashboard = () => (
  <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="3" width="7" height="7" rx="1.5" /><rect x="14" y="3" width="7" height="7" rx="1.5" /><rect x="3" y="14" width="7" height="7" rx="1.5" /><rect x="14" y="14" width="7" height="7" rx="1.5" />
  </svg>
);

const IconPlant = () => (
  <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M4 5h6v6H4z" /><path d="M14 5h6v6h-6z" /><path d="M9 19h6" /><path d="M12 11v8" />
  </svg>
);

const IconMachine = () => (
  <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <rect x="4" y="6" width="16" height="12" rx="2" /><path d="M8 6v12" /><path d="M16 6v12" /><circle cx="12" cy="12" r="2" />
  </svg>
);

const IconAlarm = () => (
  <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 4a6 6 0 0 0-6 6v3l-2 2h16l-2-2v-3a6 6 0 0 0-6-6" /><path d="M9.5 19a2.5 2.5 0 0 0 5 0" />
  </svg>
);

const IconHistorian = () => (
  <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="7" /><path d="M12 8v5l3 2" />
  </svg>
);

const IconAnalytics = () => (
  <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M4 18h16" /><path d="M6 15l4-4 3 3 5-6" /><circle cx="6" cy="15" r="1" /><circle cx="10" cy="11" r="1" /><circle cx="13" cy="14" r="1" /><circle cx="18" cy="8" r="1" />
  </svg>
);

const IconDevice = () => (
  <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <rect x="6" y="6" width="12" height="12" rx="2" /><path d="M9 2v4" /><path d="M15 2v4" /><path d="M9 18v4" /><path d="M15 18v4" />
  </svg>
);

const IconReport = () => (
  <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M7 3h7l5 5v13a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1" /><path d="M14 3v5h5" /><path d="M9 14h6" /><path d="M9 17h6" />
  </svg>
);

const IconSettings = () => (
  <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="3" /><path d="M19.4 15a7.8 7.8 0 0 0 .1-6l-2.1.6a6 6 0 0 0-2.6-1.5L14 4h-4l-.8 4.1a6 6 0 0 0-2.6 1.5L4.5 9a7.8 7.8 0 0 0 .1 6l2.1-.6a6 6 0 0 0 2.6 1.5L10 20h4l.8-4.1a6 6 0 0 0 2.6-1.5z" />
  </svg>
);

const IconAdmin = () => (
  <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 3l7 3v5c0 4.4-3 8.4-7 10-4-1.6-7-5.6-7-10V6l7-3" /><path d="M9.5 12.5l2 2 3.5-3.5" />
  </svg>
);

const IconBolt = () => (
  <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
  </svg>
);

const utilityLinks = [
  { to: "/listrik", label: "Listrik" },
  { to: "/gas", label: "Gas" },
  { to: "/air", label: "Air" },
  { to: "/hvac", label: "HVAC" },
  { to: "/wwtp", label: "WWTP" },
  { to: "/utility", label: "Utility Overview" }
];

export const Sidebar = () => {
  const role = useAuthStore((state) => state.user?.role ?? "user");
  const isAdmin = role === "admin";
  const canApprove = role === "team_head" || role === "leader" || role === "admin";
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(machineGroups.map((group) => [group.id, group.id === machineGroups[0]?.id]))
  );
  const [utilOpen, setUtilOpen] = useState(false);

  const toggleGroup = (groupId: string) => setOpenGroups((prev) => ({ ...prev, [groupId]: !prev[groupId] }));

  return (
    <aside className="hidden min-h-screen w-[250px] shrink-0 border-r border-[#052946] bg-[#07365f] px-4 py-5 text-white lg:block">
      <div className="mb-7 flex items-center gap-3">
        <div className="flex h-9 items-center justify-center rounded-lg bg-white px-2 shadow-[0_6px_16px_rgba(31,111,181,0.18)]">
          <img src="https://www.widatra.com/asset/logotext.png" alt="Widatra" className="h-5 w-auto" loading="lazy" />
        </div>
        <div>
          <div className="text-base font-semibold leading-5 text-white">WidatraOne</div>
          <div className="text-xs text-[#79b6eb]">Industrial SCADA Platform</div>
        </div>
      </div>

      <div className="mb-3 text-sm font-semibold uppercase tracking-[0.18em] text-[#79b6eb]">Utama</div>
      <nav className="flex flex-col gap-1.5">
        <NavItem to="/" label="Dashboard" icon={<IconDashboard />} />
        <NavItem to="/plant-layout" label="Plant Layout" icon={<IconPlant />} />
        <NavItem to="/machines" label="Machines" icon={<IconMachine />} />
        <NavItem to="/alarms" label="Alarms" icon={<IconAlarm />} />
        <NavItem to="/historian" label="Historian" icon={<IconHistorian />} />
        <NavItem to="/analytics" label="Analytics" icon={<IconAnalytics />} />
        <NavItem to="/devices" label="Devices" icon={<IconDevice />} />
      </nav>

      <div className="mb-3 mt-7 text-sm font-semibold uppercase tracking-[0.18em] text-[#79b6eb]">Machine Pages</div>
      <nav className="flex flex-col gap-2">
        {machineGroups.map((group) => (
          <div key={group.id} className="rounded-lg border border-white/10">
            <button type="button" onClick={() => toggleGroup(group.id)} className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-sm text-white">
              <span className="flex items-center gap-2"><span className="text-[#9dccf5]"><IconMachine /></span>{group.name}</span>
              <span className="text-xs text-[#9dccf5]">{openGroups[group.id] ? "−" : "+"}</span>
            </button>
            {openGroups[group.id] ? (
              <div className="flex flex-col gap-1 border-t border-white/10 pb-2 pt-1">
                <NavItem to={`/machines/${group.id}`} label="Overview" icon={<IconPlant />} tone="subtle" />
                {group.units.map((unit) => (
                  <NavItem key={unit.id} to={`/machines/${group.id}/${unit.id}`} label={unit.unitLabel} icon={<IconMachine />} tone="subtle" />
                ))}
              </div>
            ) : null}
          </div>
        ))}
      </nav>

      <div className="mb-3 mt-7 text-sm font-semibold uppercase tracking-[0.18em] text-[#79b6eb]">Utilities</div>
      <nav className="mb-2 flex flex-col gap-1">
        <div className="rounded-lg border border-white/10">
          <button type="button" onClick={() => setUtilOpen((prev) => !prev)} className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-sm text-white">
            <span className="flex items-center gap-2"><span className="text-[#9dccf5]"><IconBolt /></span>Utilities</span>
            <span className="text-xs text-[#9dccf5]">{utilOpen ? "−" : "+"}</span>
          </button>
          {utilOpen ? (
            <div className="flex flex-col gap-1 border-t border-white/10 pb-2 pt-1">
              {utilityLinks.map((link) => (
                <NavItem key={link.to} to={link.to} label={link.label} icon={<IconDevice />} tone="subtle" />
              ))}
            </div>
          ) : null}
        </div>
      </nav>

      <div className="mb-3 mt-5 text-sm font-semibold uppercase tracking-[0.18em] text-[#79b6eb]">Operasional</div>
      <nav className="flex flex-col gap-1.5">
        <NavItem to="/utility-status" label="Equipment Status" icon={<IconDevice />} />
        <NavItem to="/reports" label="Reports" icon={<IconReport />} />
        <NavItem to="/machine-health" label="Machine Health" icon={<IconAlarm />} />
        {canApprove ? <NavItem to="/approvals" label="Approvals" icon={<IconReport />} /> : null}
        {canApprove ? <NavItem to="/thresholds" label="Thresholds" icon={<IconSettings />} /> : null}
        <NavItem to="/settings" label="Settings" icon={<IconSettings />} />
        {isAdmin ? <NavItem to="/admin" label="Admin Panel" icon={<IconAdmin />} /> : null}
      </nav>

      <div className="mt-9 rounded-lg border border-white/10 bg-[#052f54] p-4 text-xs text-[#9dccf5]">
        Local server
        <div className="mt-1 font-medium text-white">192.168.20.81</div>
      </div>
    </aside>
  );
}
