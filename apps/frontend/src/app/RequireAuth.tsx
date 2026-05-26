import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useAuthStore } from "../store/auth.store";

export const RequireAuth = () => {
  const accessToken = useAuthStore((state) => state.accessToken);
  const location = useLocation();

  if (!accessToken) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  return <Outlet />;
};
