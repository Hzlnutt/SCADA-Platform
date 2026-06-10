import type { ReactNode } from "react";
import { NavLink } from "react-router-dom";

type NavItemProps = {
  to: string;
  label: string;
  tone?: "sidebar" | "tabs" | "subtle" | "scada";
  end?: boolean;
  icon?: ReactNode;
};

export const NavItem = ({
  to,
  label,
  tone = "sidebar",
  end,
  icon
}: NavItemProps) => {
  return (
    <NavLink
      to={to}
      end={end}
      className={({ isActive }) => {
        if (tone === "tabs") {
          return [
            "flex h-11 items-center border-b-2 px-4 text-[0.95rem] font-semibold transition",
            isActive
              ? "border-[#1f6fb5] text-[#002b5c] dark:text-[#38bdf8]"
              : "border-transparent text-[#1f6fb5] dark:text-[#8bbce9] hover:bg-[#eef6ff] dark:hover:bg-slate-800"
          ].join(" ");
        }

        if (tone === "subtle") {
          return [
            "ml-3 flex items-center gap-2 rounded-md px-3 py-1.5 text-[0.85rem] font-semibold transition",
            isActive
              ? "bg-white/15 dark:bg-white/15 text-slate-800 dark:text-white"
              : "text-[#47729f] dark:text-[#9dccf5] hover:bg-slate-200/50 dark:hover:bg-white/10 hover:text-[#002b5c] dark:hover:text-white"
          ].join(" ");
        }

        if (tone === "scada") {
          return [
            "flex items-center gap-2 pl-6 py-1.5 text-[11px] font-medium transition",
            isActive
              ? "bg-[#1f6fb5]/15 dark:bg-blue-600/20 border-l-2 border-[#1f6fb5] dark:border-blue-500 text-[#002b5c] dark:text-white font-semibold"
              : "text-[#47729f] dark:text-[#8bbce9] hover:bg-[#1f6fb5]/5 dark:hover:bg-white/5 hover:text-[#002b5c] dark:hover:text-white"
          ].join(" ");
        }

        return [
          "flex items-center gap-2 rounded-md px-3 py-2 text-[0.95rem] font-semibold transition",
          isActive
            ? "bg-[#1f6fb5] text-white shadow-sm"
            : "text-[#47729f] dark:text-[#8bbce9] hover:bg-[#1f6fb5]/10 dark:hover:bg-white/10 hover:text-[#002b5c] dark:hover:text-white"
        ].join(" ");
      }}
    >
      {icon ? (
        <span className="flex h-5 w-5 items-center justify-center rounded-md bg-[#1f6fb5]/10 dark:bg-white/10 text-[0.8rem]">
          {icon}
        </span>
      ) : null}
      <span className="truncate">{label}</span>
    </NavLink>
  );
};

