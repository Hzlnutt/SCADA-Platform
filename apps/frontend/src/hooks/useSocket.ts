import { useEffect } from "react";
import { getSocket } from "../services/socket.service";
import { telemetryTagIds } from "../data/industrial-tags";
import { useAlarmStore, type AlarmEvent } from "../store/alarm.store";
import { useSystemStore } from "../store/system.store";
import { useTelemetryStore, type TelemetryPoint } from "../store/telemetry.store";

export const useSocket = (enabled = true) => {
  const addPoints = useTelemetryStore((state) => state.addPoints);
  const pushEvents = useAlarmStore((state) => state.pushEvents);
  const updatePidAlarms = useAlarmStore((state) => state.updatePidAlarms);
  const reEvaluateAllAlarms = useAlarmStore((state) => state.reEvaluateAllAlarms);
  const setSocketStatus = useSystemStore((state) => state.setSocketStatus);

  useEffect(() => {
    if (!enabled) {
      setSocketStatus("disconnected");
      return undefined;
    }

    const socket = getSocket();

    const subscribeTelemetry = () => {
      socket.emit("telemetry:subscribe", { tagIds: telemetryTagIds });
    };
    const handleConnect = () => {
      setSocketStatus("connected");
      subscribeTelemetry();
    };
    const handleDisconnect = () => setSocketStatus("disconnected");
    const handleTelemetry = (payload: { points?: TelemetryPoint[] }) => {
      const points = Array.isArray(payload?.points) ? payload.points : [];
      addPoints(points);
      updatePidAlarms(points);
    };
    const handleAlarms = (payload: { events?: AlarmEvent[] }) => {
      const events = Array.isArray(payload?.events) ? payload.events : [];
      pushEvents(events);
    };
    const handleStorageChange = () => {
      reEvaluateAllAlarms();
    };

    socket.on("connect", handleConnect);
    socket.on("connect_error", handleDisconnect);
    socket.on("disconnect", handleDisconnect);
    socket.on("telemetry:snapshot", handleTelemetry);
    socket.on("telemetry:update", handleTelemetry);
    socket.on("alarm:event", handleAlarms);
    window.addEventListener("storage", handleStorageChange);

    if (socket.connected) {
      handleConnect();
    }

    return () => {
      socket.off("connect", handleConnect);
      socket.off("connect_error", handleDisconnect);
      socket.off("disconnect", handleDisconnect);
      socket.off("telemetry:snapshot", handleTelemetry);
      socket.off("telemetry:update", handleTelemetry);
      socket.off("alarm:event", handleAlarms);
      window.removeEventListener("storage", handleStorageChange);
    };
  }, [addPoints, enabled, pushEvents, updatePidAlarms, reEvaluateAllAlarms, setSocketStatus]);
};
