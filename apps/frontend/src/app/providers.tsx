import { useEffect, type ReactNode } from "react";
import { useSocket } from "../hooks/useSocket";
import { fetchMe } from "../services/auth.service";
import { useAuthStore } from "../store/auth.store";
import { useSystemStore } from "../store/system.store";

export const AppProviders = ({ children }: { children: ReactNode }) => {
  const accessToken = useAuthStore((state) => state.accessToken);
  const user = useAuthStore((state) => state.user);
  const updateUser = useAuthStore((state) => state.updateUser);
  const theme = useSystemStore((state) => state.theme);
  useSocket(Boolean(accessToken));

  useEffect(() => {
    if (theme === "dark") {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
  }, [theme]);

  useEffect(() => {
    if (!accessToken) {
      return;
    }

    // Proactively verify user session with the backend upon load.
    // If the account was deleted or disabled, the server returns 401,
    // which api.client automatically intercepts to clear localStorage and redirect to /login.
    fetchMe()
      .then((result) => {
        if (result?.data) {
          updateUser(result.data);
        }
      })
      .catch(() => {
        // 401 status is automatically intercepted by api.client to clear session & redirect to /login
      });
  }, [accessToken, updateUser]);

  return <>{children}</>;
};

