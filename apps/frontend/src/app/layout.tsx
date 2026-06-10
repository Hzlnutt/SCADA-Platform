import { Outlet } from "react-router-dom";
import { MobileNav } from "../components/navigation/MobileNav";
import { Sidebar } from "../components/sidebar/Sidebar";
import { Topbar } from "../components/topbar/Topbar";

export const AppLayout = () => {
  return (
    <div className="min-h-screen bg-[#eaf4ff] dark:bg-slate-950 text-[#002b5c] dark:text-slate-100 transition-colors duration-300">
      <div className="flex">
        <Sidebar />
        <main className="scada-content min-h-screen flex-1">
          <Topbar />
          <div className="lg:hidden">
            <MobileNav />
          </div>
          <div className="px-5 py-5 lg:px-6">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
};

