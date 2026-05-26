import { useEffect, type ReactNode } from "react";
import { useSocket } from "../hooks/useSocket";
import { fetchMe } from "../services/auth.service";
import { useAuthStore } from "../store/auth.store";

export const AppProviders = ({ children }: { children: ReactNode }) => {
  const accessToken = useAuthStore((state) => state.accessToken);
  const user = useAuthStore((state) => state.user);
  const updateUser = useAuthStore((state) => state.updateUser);
  useSocket(Boolean(accessToken));

  useEffect(() => {
    if (!accessToken || user) {
      return;
    }

    fetchMe()
      .then((result) => {
        if (result.data) {
          updateUser(result.data);
        }
      })
      .catch(() => {
        // ignore fetch errors; user can re-login if needed
      });
  }, [accessToken, updateUser, user]);

  return <>{children}</>;
};
