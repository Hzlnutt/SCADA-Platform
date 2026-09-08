/**
 * Terminal & Workstation Network Helper
 * Manages client station IP & MAC identification for SCADA audit trails.
 */

const STORAGE_KEY_MAC = "scada.terminal.mac";
const STORAGE_KEY_STATION = "scada.terminal.station_id";

/**
 * Generates a realistic SCADA terminal MAC address if none exists
 */
export function getTerminalMacAddress(): string {
  if (typeof window === "undefined" || !window.localStorage) {
    return "70:85:C2:10:03:01";
  }

  let mac = localStorage.getItem(STORAGE_KEY_MAC);
  if (!mac || !mac.match(/^([0-9A-F]{2}:){5}[0-9A-F]{2}$/i)) {
    // Generate a consistent hardware MAC format for this browser workstation
    const hex = () => Math.floor(Math.random() * 256).toString(16).padStart(2, "0").toUpperCase();
    mac = `70:85:C2:${hex()}:${hex()}:${hex()}`;
    localStorage.setItem(STORAGE_KEY_MAC, mac);
  }
  return mac.toUpperCase();
}

/**
 * Generates or retrieves workstation Station Name / Terminal ID
 */
export function getTerminalStationId(): string {
  if (typeof window === "undefined" || !window.localStorage) {
    return "WS-SCADA-01";
  }

  let station = localStorage.getItem(STORAGE_KEY_STATION);
  if (!station) {
    station = `STATION-HVAC-${Math.floor(100 + Math.random() * 900)}`;
    localStorage.setItem(STORAGE_KEY_STATION, station);
  }
  return station;
}

/**
 * Returns full network & client device information
 */
export function getClientDeviceInfo() {
  return {
    mac: getTerminalMacAddress(),
    stationId: getTerminalStationId(),
    userAgent: typeof navigator !== "undefined" ? navigator.userAgent : "SCADA-Client/1.0",
    platform: typeof navigator !== "undefined" ? navigator.platform : "Win32"
  };
}
