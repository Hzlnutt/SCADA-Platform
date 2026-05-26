import { useEffect, useState } from "react";
import { PageHeader } from "../components/ui/PageHeader";
import { getJson } from "../services/api.client";

type DeviceStatus = {
  id: string;
  name: string;
  area: string;
  category: string;
  status: "online" | "stale" | "unknown";
  lastTs?: string;
  lastValue?: number | string | boolean;
  unit?: string;
};

type DeviceStatusResponse = {
  data: DeviceStatus[];
};

export default function Devices() {
  const [devices, setDevices] = useState<DeviceStatus[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    const loadDevices = () => {
      getJson<DeviceStatusResponse>("/devices/status")
        .then((result) => {
          if (mounted) {
            setDevices(result.data);
          }
        })
        .finally(() => {
          if (mounted) {
            setLoading(false);
          }
        });
    };

    loadDevices();
    const interval = window.setInterval(loadDevices, 10000);

    return () => {
      mounted = false;
      window.clearInterval(interval);
    };
  }, []);

  return (
    <div>
      <PageHeader
        title="Device Health"
        description="PLC communication and equipment diagnostics."
      />
      <div className="rounded-lg border border-slate-800 bg-slate-950/70 p-4">
        {loading ? (
          <div className="text-sm text-slate-400">Loading devices...</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="text-xs uppercase tracking-[0.2em] text-slate-500">
                <tr>
                  <th className="px-3 py-2">Device</th>
                  <th className="px-3 py-2">Area</th>
                  <th className="px-3 py-2">Status</th>
                  <th className="px-3 py-2">Last Value</th>
                  <th className="px-3 py-2">Last Update</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-900">
                {devices.map((device) => (
                  <tr key={device.id} className="text-slate-200">
                    <td className="px-3 py-3">
                      <div className="text-sm font-medium">{device.name}</div>
                      <div className="text-xs text-slate-400">{device.category}</div>
                    </td>
                    <td className="px-3 py-3 text-xs text-slate-400">
                      {device.area}
                    </td>
                    <td className="px-3 py-3 text-xs capitalize">
                      <span
                        className={[
                          "rounded-full border px-2 py-1",
                          device.status === "online"
                            ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-300"
                            : device.status === "stale"
                              ? "border-amber-500/30 bg-amber-500/10 text-amber-300"
                              : "border-slate-700 bg-slate-900/70 text-slate-400"
                        ].join(" ")}
                      >
                        {device.status}
                      </span>
                    </td>
                    <td className="px-3 py-3 text-xs text-slate-400">
                      {device.lastValue !== undefined
                        ? `${device.lastValue}${device.unit ? ` ${device.unit}` : ""}`
                        : "-"}
                    </td>
                    <td className="px-3 py-3 text-xs text-slate-400">
                      {device.lastTs ? new Date(device.lastTs).toLocaleString() : "-"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
