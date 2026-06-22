import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { logout } from "../../services/auth.service";
import { useAuthStore } from "../../store/auth.store";
import { ConfirmDialog } from "../ui/ConfirmDialog";

const initialsFromName = (name?: string | null) => {
  if (!name) return "U";
  const parts = name.trim().split(/\s+/);
  return parts.slice(0, 2).map((part) => part[0]).join("").toUpperCase();
};

const displayName = (name?: string | null) => {
  if (!name) return "User";
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0];
  return `${parts[0]} ${parts[1]}`;
};

export const UserMenu = () => {
  const navigate = useNavigate();
  const user = useAuthStore((state) => state.user);
  const refreshToken = useAuthStore((state) => state.refreshToken);
  const clearSession = useAuthStore((state) => state.clearSession);
  const [open, setOpen] = useState(false);
  const [confirmLogout, setConfirmLogout] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const initials = useMemo(() => initialsFromName(user?.name), [user?.name]);
  const shortName = useMemo(() => displayName(user?.name), [user?.name]);

  useEffect(() => {
    if (!open) {
      return undefined;
    }

    const handleClick = (event: MouseEvent) => {
      if (!menuRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  const handleLogout = async () => {
    setOpen(false);
    setConfirmLogout(false);
    if (refreshToken) {
      try {
        await logout(refreshToken);
      } catch {
        // ignore logout errors and clear local session
      }
    }
    clearSession();
    navigate("/login", { replace: true });
  };

  return (
    <div ref={menuRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className="flex items-center gap-2 rounded-full bg-[#2f8f5b] px-3 py-1.5 text-xs font-semibold text-white shadow-sm"
      >
        {user?.avatarUrl ? (
          <img
            src={user.avatarUrl}
            alt={user.name ?? "User"}
            className="h-7 w-7 rounded-full border border-white object-cover"
          />
        ) : (
          <span className="flex h-7 w-7 items-center justify-center rounded-full bg-white/20 text-[10px] font-bold text-white">
            {initials}
          </span>
        )}
        <span>{shortName}</span>
        <span className="text-white/80">▾</span>
      </button>

      {open ? (
        <div className="absolute right-0 mt-2 w-48 rounded-xl border border-[#d6e9fb] bg-white p-2 text-xs text-[#003b75] shadow-[0_12px_30px_rgba(31,111,181,0.18)]">
          <Link
            to="/profile"
            className="block rounded-lg px-3 py-2 transition hover:bg-[#e8f3ff]"
            onClick={() => setOpen(false)}
          >
            Edit Profile
          </Link>
          <Link
            to="/settings"
            className="block rounded-lg px-3 py-2 transition hover:bg-[#e8f3ff]"
            onClick={() => setOpen(false)}
          >
            User Settings
          </Link>
          <button
            type="button"
            onClick={() => {
              setOpen(false);
              setConfirmLogout(true);
            }}
            className="mt-1 w-full rounded-lg px-3 py-2 text-left text-[#b42318] transition hover:bg-[#ffe6df]"
          >
            Logout
          </button>
        </div>
      ) : null}

      <ConfirmDialog
        open={confirmLogout}
        title="Confirm Logout"
        description="Are you sure you want to log out of the system?"
        confirmText="Yes"
        cancelText="No"
        onConfirm={handleLogout}
        onCancel={() => setConfirmLogout(false)}
      />
    </div>
  );
};
