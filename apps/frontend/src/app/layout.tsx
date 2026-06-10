import { Outlet } from "react-router-dom";
import { MobileNav } from "../components/navigation/MobileNav";
import { Sidebar } from "../components/sidebar/Sidebar";
import { Topbar } from "../components/topbar/Topbar";

export const AppLayout = () => {
  return (
    <div className="h-screen flex overflow-hidden bg-[#eaf4ff] text-[#002b5c]">
      {/* Sidebar bisa scroll sendiri, tidak pengaruhi content */}
      <div className="h-full overflow-y-auto flex-shrink-0">
        <Sidebar />
      </div>
      <main className="scada-content flex-1 flex flex-col overflow-hidden">
        <Topbar />
        <MobileNav />
        {/* Content area scroll sendiri, warna background dijaga */}
        <div className="flex-1 min-h-0 overflow-y-auto bg-[#eaf4ff] px-5 py-5 lg:px-6">
          <Outlet />
        </div>
      </main>
    </div>
  );
};