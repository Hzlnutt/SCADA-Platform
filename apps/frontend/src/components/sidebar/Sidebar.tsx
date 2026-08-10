import { useEffect, useState } from "react";
import { NavItem } from "../navigation/NavItem";
import { machineGroups } from "../../data/machines";
import { useAuthStore } from "../../store/auth.store";
import { getJson } from "../../services/api.client";

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

const IconChevron = ({ open }: { open: boolean }) => (
  <svg
    viewBox="0 0 24 24"
    className={`h-3 w-3 transform transition-transform duration-200 ${open ? "rotate-90" : ""}`}
    fill="none"
    stroke="currentColor"
    strokeWidth="2.5"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <polyline points="9 18 15 12 9 6" />
  </svg>
);

export const Sidebar = () => {
  const role = useAuthStore((state) => state.user?.role ?? "user");
  const isAdmin = role === "admin";
  const canApprove = role === "team_head" || role === "leader" || role === "admin";

  const [openSections, setOpenSections] = useState<Record<string, boolean>>(() => {
    const saved = localStorage.getItem("scada.sidebar.open");
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        // use default
      }
    }
    return {
      utility: true,
      hvac: false,
      penggunaanUtility: true,
      electricity: true,
      water: true,
      operasional: true
    };
  });

  const toggleSection = (section: string) => {
    setOpenSections((prev) => {
      const next = { ...prev, [section]: !prev[section] };
      localStorage.setItem("scada.sidebar.open", JSON.stringify(next));
      return next;
    });
  };

  const [netInfo, setNetInfo] = useState<{ serverIp: string; clientIp: string }>({
    serverIp: "192.168.20.81",
    clientIp: window.location.hostname || "127.0.0.1"
  });

  useEffect(() => {
    getJson<{ serverIp: string; clientIp: string }>("/audit-trail/network-info")
      .then((res) => {
        if (res && res.serverIp) {
          setNetInfo({
            serverIp: res.serverIp,
            clientIp: res.clientIp
          });
        }
      })
      .catch(() => undefined);
  }, []);

  const hvacQcGroup = machineGroups.find((g) => g.id === "hvac-qc");
  const hvacWarehouseGroup = machineGroups.find((g) => g.id === "hvac-warehouse");
  const hvacWf1Group = machineGroups.find((g) => g.id === "hvac-wf1u3");
  const hvacWf2u1Group = machineGroups.find((g) => g.id === "hvac-wf2u1");
  const hvacWf2u2Group = machineGroups.find((g) => g.id === "hvac-wf2u2");

  return (
    <aside className="sticky top-0 hidden h-screen w-[260px] shrink-0 flex-col border-r border-[#acd3ff] dark:border-slate-800 bg-[#eaf4ff] dark:bg-slate-900 px-4 py-5 text-[#002b5c] dark:text-slate-100 lg:flex overflow-y-auto scrollbar-thin transition-colors duration-300">
      {/* Brand logo */}
      <div className="mb-7 flex items-center gap-3">
        <div className="flex h-9 items-center justify-center rounded-lg bg-white px-2 shadow-[0_6px_16px_rgba(31,111,181,0.18)]">
          <img src="https://www.widatra.com/asset/logotext.png" alt="Widatra" className="h-5 w-auto" loading="lazy" />
        </div>
        <div>
          <div className="text-base font-semibold leading-5 text-[#002b5c] dark:text-white">WidatraOne</div>
          <div className="text-xs text-[#47729f] dark:text-sky-400">Industrial SCADA Platform</div>
        </div>
      </div>

      {/* MAIN MENU */}
      <div className="mb-1 text-xs font-semibold uppercase tracking-[0.18em] text-[#47729f] dark:text-sky-400">MAIN MENU</div>
      <nav className="flex flex-col gap-0.5 mb-5">
        <NavItem to="/dashboard" label="Dashboard" icon={<IconDashboard />} tone="scada" />
        <NavItem to="/plant" label="Plant Layout" icon={<IconPlant />} tone="scada" />
        <NavItem to="/machines" label="Machines" icon={<IconMachine />} tone="scada" />
        <NavItem to="/alarms" label="Alarms" icon={<IconAlarm />} tone="scada" />
        <NavItem to="/analytics" label="Analytics" icon={<IconAnalytics />} tone="scada" />
        <NavItem to="/devices" label="Devices" icon={<IconDevice />} tone="scada" />
      </nav>

      {/* MACHINE PAGES */}
      <div className="mb-1.5 text-xs font-semibold uppercase tracking-[0.18em] text-[#47729f] dark:text-sky-400">
        MACHINE PAGES
      </div>
      <div className="flex flex-col gap-2 mb-5 pl-2">
        {/* UTILITY SUB-ACCORDION */}
        <div>
          <button
            type="button"
            onClick={() => toggleSection("utility")}
            className="flex w-full items-center justify-between py-1 text-left text-[11px] font-semibold text-[#47729f] dark:text-[#8bbce9] hover:text-[#002b5c] dark:hover:text-white"
          >
            <span className="flex items-center gap-1.5">
              <IconMachine />
              <span>Utility</span>
            </span>
            <IconChevron open={openSections.utility} />
          </button>
          {openSections.utility && (
            <div className="flex flex-col gap-0.5 mt-1 border-l border-[#acd3ff] dark:border-slate-800 ml-2">
              <NavItem to="/machines/cooling-water-system/cooling-water-1" label="Cooling Tower WF1-U3" tone="scada" />
              <NavItem to="/machines/cooling-water-system/cooling-water-2" label="Cooling Tower WF2" tone="scada" />
              <NavItem to="/machines/boiler-plant/boiler-3" label="Boiler-3 WF1" tone="scada" />
              <NavItem to="/machines/boiler-plant/boiler-4" label="Boiler-4" tone="scada" />
              <NavItem to="/machines/boiler-plant/boiler-5" label="Boiler-5" tone="scada" />
              
              {/* Compressed Air Group */}
              <div className="pl-6 py-1 text-[10px] uppercase font-bold text-[#47729f] dark:text-[#79b6eb]/70 tracking-wider">Compressed Air</div>
              <NavItem to="/machines/compressed-air/ale-30" label="ALE-30" tone="scada" />
              <NavItem to="/machines/compressed-air/zt-30.1" label="ZT-30.1" tone="scada" />
              <NavItem to="/machines/compressed-air/zt-30-2" label="ZT-30.2" tone="scada" />
              <NavItem to="/machines/compressed-air/zt-55" label="ZT-55" tone="scada" />
              <NavItem to="/machines/compressed-air/ingersoll-55" label="Ingersoll-55" tone="scada" />
              <NavItem to="/machines/compressed-air/ale-250" label="ALE-250" tone="scada" />
              <NavItem to="/machines/compressed-air/zt-110" label="ZT-110" tone="scada" />

              {/* Chiller Group */}
              <div className="pl-6 py-1 text-[10px] uppercase font-bold text-[#47729f] dark:text-[#79b6eb]/70 tracking-wider">Chiller System</div>
              <NavItem to="/machines/chiller-system/trane-cgam-40" label="Trane CGAM-40" tone="scada" />
              <NavItem to="/machines/chiller-system/daikin-wf1u3" label="Daikin WF1U3" tone="scada" />
              <NavItem to="/machines/chiller-system/rtac-100" label="RTAC-100" tone="scada" />
              <NavItem to="/machines/chiller-system/rtac-275" label="RTAC-275" tone="scada" />
            </div>
          )}
        </div>

        {/* HVAC SUB-ACCORDION */}
        <div>
          <button
            type="button"
            onClick={() => toggleSection("hvac")}
            className="flex w-full items-center justify-between py-1 text-left text-[11px] font-semibold text-[#47729f] dark:text-[#8bbce9] hover:text-[#002b5c] dark:hover:text-white"
          >
            <span className="flex items-center gap-1.5">
              <IconBolt />
              <span>HVAC</span>
            </span>
            <IconChevron open={openSections.hvac} />
          </button>
          {openSections.hvac && (
            <div className="flex flex-col gap-0.5 mt-1 border-l border-[#acd3ff] dark:border-slate-800 ml-2 max-h-72 overflow-y-auto scrollbar-thin">
              {/* HVAC QC */}
              <div className="pl-6 py-1 text-[10px] uppercase font-bold text-[#47729f] dark:text-[#79b6eb]/70 tracking-wider">HVAC QC</div>
              {hvacQcGroup?.units.map((unit) => (
                <NavItem
                  key={unit.id}
                  to={`/machines/hvac-qc/${unit.id}`}
                  label={unit.unitLabel}
                  tone="scada"
                />
              ))}

              {/* HVAC Warehouse */}
              <div className="pl-6 py-1 text-[10px] uppercase font-bold text-[#47729f] dark:text-[#79b6eb]/70 tracking-wider">HVAC Warehouse</div>
              {hvacWarehouseGroup?.units.map((unit) => (
                <NavItem
                  key={unit.id}
                  to={`/machines/hvac-warehouse/${unit.id}`}
                  label={unit.unitLabel}
                  tone="scada"
                />
              ))}

              {/* HVAC Production WF1 */}
              <div className="pl-6 py-1 text-[10px] uppercase font-bold text-[#47729f] dark:text-[#79b6eb]/70 tracking-wider">HVAC Production WF1</div>
              {hvacWf1Group?.units.map((unit) => (
                <NavItem
                  key={unit.id}
                  to={`/machines/hvac-wf1u3/${unit.id}`}
                  label={unit.unitLabel}
                  tone="scada"
                />
              ))}

              {/* HVAC Production WF2U1 */}
              <div className="pl-6 py-1 text-[10px] uppercase font-bold text-[#47729f] dark:text-[#79b6eb]/70 tracking-wider">HVAC Production WF2U1</div>
              {hvacWf2u1Group?.units.map((unit) => (
                <NavItem
                  key={unit.id}
                  to={`/machines/hvac-wf2u1/${unit.id}`}
                  label={unit.unitLabel}
                  tone="scada"
                />
              ))}

              {/* HVAC Production WF2U2 */}
              <div className="pl-6 py-1 text-[10px] uppercase font-bold text-[#47729f] dark:text-[#79b6eb]/70 tracking-wider">HVAC Production WF2U2</div>
              {hvacWf2u2Group?.units.map((unit) => (
                <NavItem
                  key={unit.id}
                  to={`/machines/hvac-wf2u2/${unit.id}`}
                  label={unit.unitLabel}
                  tone="scada"
                />
              ))}
            </div>
          )}
        </div>

        {/* WWTP SECTION */}
        <div className="py-1">
          <span className="flex items-center gap-1.5 text-[11px] font-semibold text-[#47729f]/50 dark:text-[#8bbce9]/50 cursor-not-allowed select-none">
            <IconPlant />
            <span>WWTP (Coming soon)</span>
          </span>
        </div>
      </div>

      {/* UTILITY CONSUMPTION */}
      <div className="mb-1">
        <button
          type="button"
          onClick={() => toggleSection("penggunaanUtility")}
          className="flex w-full items-center justify-between py-1 text-left text-xs font-semibold uppercase tracking-[0.18em] text-[#47729f] dark:text-sky-400 hover:text-[#002b5c] dark:hover:text-white"
        >
          <span>UTILITY CONSUMPTION</span>
          <IconChevron open={openSections.penggunaanUtility} />
        </button>
      </div>

      {openSections.penggunaanUtility && (
        <nav className="flex flex-col gap-0.5 mb-5 pl-2">
          {/* Collapsible Electricity Item */}
          <div className="mb-1">
            <button
              type="button"
              onClick={() => toggleSection("electricity")}
              className="flex w-full items-center justify-between py-1 text-left text-[11px] font-semibold text-[#47729f] dark:text-[#8bbce9] hover:text-[#002b5c] dark:hover:text-white"
            >
              <span className="flex items-center gap-1.5">
                <IconDevice />
                <span>Electricity</span>
              </span>
              <IconChevron open={openSections.electricity} />
            </button>
            {openSections.electricity && (
              <div className="flex flex-col gap-0.5 mt-1 border-l border-[#acd3ff] dark:border-slate-800 ml-2.5 pl-1.5">
                <NavItem to="/listrik" label="Overview" tone="scada" />
                <NavItem to="/listrik/incoming-pln" label="Incoming PLN" tone="scada" />
                <NavItem to="/listrik/incoming-fact-1" label="Incoming Fact-1" tone="scada" />
                <NavItem to="/listrik/incoming-fact-2" label="Incoming Fact-2" tone="scada" />
                <NavItem to="/listrik/distribusi" label="Distribusi Daya" tone="scada" />
                <NavItem to="/listrik/report" label="Report" tone="scada" />
              </div>
            )}
          </div>

          <NavItem to="/gas" label="Gas" icon={<IconDevice />} tone="scada" />
          {/* Collapsible Water Item */}
          <div className="mb-1">
            <button
              type="button"
              onClick={() => toggleSection("water")}
              className="flex w-full items-center justify-between py-1 text-left text-[11px] font-semibold text-[#47729f] dark:text-[#8bbce9] hover:text-[#002b5c] dark:hover:text-white"
            >
              <span className="flex items-center gap-1.5">
                <IconDevice />
                <span>Water</span>
              </span>
              <IconChevron open={openSections.water} />
            </button>
            {openSections.water && (
              <div className="flex flex-col gap-0.5 mt-1 border-l border-[#acd3ff] dark:border-slate-800 ml-2.5 pl-1.5">
                <NavItem to="/air" label="Overview" tone="scada" />
                <NavItem to="/air/distribusi" label="Distribusi Air" tone="scada" />
                <NavItem to="/air/energy" label="Energy" tone="scada" />
              </div>
            )}
          </div>
          <NavItem to="/wwtp" label="WWTP" icon={<IconDevice />} tone="scada" />
          <NavItem to="/utility-billing" label="Billing" icon={<IconReport />} tone="scada" />
          <NavItem to="/utility-config" label="Config" icon={<IconSettings />} tone="scada" />
        </nav>
      )}

      {/* OPERATIONS */}
      <div className="mb-1">
        <button
          type="button"
          onClick={() => toggleSection("operasional")}
          className="flex w-full items-center justify-between py-1 text-left text-xs font-semibold uppercase tracking-[0.18em] text-[#47729f] dark:text-sky-400 hover:text-[#002b5c] dark:hover:text-white"
        >
          <span>OPERATIONS</span>
          <IconChevron open={openSections.operasional} />
        </button>
      </div>

      {openSections.operasional && (
        <nav className="flex flex-col gap-0.5 mb-5 pl-2">
          <NavItem to="/tasks" label="Tasks" icon={<IconReport />} tone="scada" />
          <NavItem to="/reports" label="Reports" icon={<IconReport />} tone="scada" />
          <NavItem to="/settings" label="Settings" icon={<IconSettings />} tone="scada" />
          {isAdmin && <NavItem to="/settings/machines" label="Machine Config" icon={<IconSettings />} tone="scada" />}
          {canApprove && <NavItem to="/approvals" label="Approvals" icon={<IconReport />} tone="scada" />}

          {isAdmin && <NavItem to="/admin" label="Admin Panel" icon={<IconAdmin />} tone="scada" />}
          {isAdmin && <NavItem to="/audit-trail" label="Audit Trail" icon={<IconReport />} tone="scada" />}
        </nav>
      )}

      <div className="mt-auto rounded-xl border border-[#acd3ff] dark:border-slate-800 bg-[#eef6ff]/80 dark:bg-slate-950 p-3 text-xs transition-colors duration-300 space-y-1.5 shadow-xs">
        <div className="flex items-center justify-between gap-2">
          <span className="text-[10px] font-extrabold uppercase tracking-wider text-[#47729f] dark:text-slate-400">Server IP</span>
          <span className="font-mono font-bold text-[#002b5c] dark:text-sky-300 text-[11px]">{netInfo.serverIp}</span>
        </div>
        <div className="flex items-center justify-between gap-2 border-t border-[#acd3ff]/50 dark:border-slate-800/80 pt-1.5">
          <span className="text-[10px] font-extrabold uppercase tracking-wider text-[#47729f] dark:text-slate-400">Client IP</span>
          <span className="font-mono font-bold text-[#002b5c] dark:text-emerald-400 text-[11px]">{netInfo.clientIp}</span>
        </div>
      </div>
    </aside>
  );
};
