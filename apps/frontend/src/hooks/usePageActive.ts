import { useEffect, useState } from "react";

/**
 * Hook to detect whether the current browser tab / page is active and visible.
 * Useful for pausing intervals, polling, and WebSocket updates when the user switches tabs,
 * drastically reducing server CPU and network usage.
 */
export const usePageActive = (): boolean => {
  const [isActive, setIsActive] = useState<boolean>(() => {
    return typeof document !== "undefined" ? document.visibilityState === "visible" : true;
  });

  useEffect(() => {
    if (typeof document === "undefined") return;

    const handleVisibilityChange = () => {
      setIsActive(document.visibilityState === "visible");
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("focus", () => setIsActive(true));

    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, []);

  return isActive;
};
