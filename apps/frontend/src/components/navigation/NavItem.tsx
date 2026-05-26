import type { ReactNode } from "react";
import { NavLink } from "react-router-dom";

type NavItemProps = {
  to: string;
  label: string;
  tone?: "sidebar" | "tabs" | "subtle";
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
              ? "border-[#1f6fb5] text-[#002b5c]"
              : "border-transparent text-[#1f6fb5] hover:bg-[#eef6ff]"
          ].join(" ");
        }

        if (tone === "subtle") {
          return [
            "ml-3 flex items-center gap-2 rounded-md px-3 py-1.5 text-[0.85rem] font-semibold transition",
            isActive
              ? "bg-white/15 text-white"
              : "text-[#9dccf5] hover:bg-white/10 hover:text-white"
          ].join(" ");
        }

        return [
          "flex items-center gap-2 rounded-md px-3 py-2 text-[0.95rem] font-semibold transition",
          isActive
            ? "bg-[#1f6fb5] text-white shadow-sm"
            : "text-[#8bbce9] hover:bg-white/10 hover:text-white"
        ].join(" ");
      }}
    >
      {icon ? (
        <span className="flex h-6 w-6 items-center justify-center rounded-md bg-white/10 text-[0.9rem]">
          {icon}
        </span>
      ) : null}
      <span className="truncate">{label}</span>
    </NavLink>
  );
};
