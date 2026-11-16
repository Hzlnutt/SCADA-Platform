export type Wh7PeriodFilter = "1d" | "7d" | "1m" | "custom";

export interface Wh7DeviceOption {
  deviceId: string;
  label: string;
}

export function Warehouse7PeriodControls({
  period,
  onPeriodChange,
  startDate,
  endDate,
  onStartDateChange,
  onEndDateChange
}: {
  period: Wh7PeriodFilter;
  onPeriodChange: (p: Wh7PeriodFilter) => void;
  startDate: string;
  endDate: string;
  onStartDateChange: (val: string) => void;
  onEndDateChange: (val: string) => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <select
        value={period}
        onChange={(e) => onPeriodChange(e.target.value as Wh7PeriodFilter)}
        className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-semibold text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-teal-500"
        aria-label="Filter Periode"
      >
        <option value="1d">Past 24 Hours</option>
        <option value="7d">Past 7 Days</option>
        <option value="1m">Past 30 Days</option>
        <option value="custom">Custom Kalender</option>
      </select>

      {period === "custom" && (
        <div className="flex flex-wrap items-center gap-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-2.5 py-1">
          <input
            type="date"
            value={startDate}
            onChange={(e) => onStartDateChange(e.target.value)}
            className="text-xs bg-transparent text-slate-700 dark:text-slate-200 focus:outline-none"
            aria-label="Tanggal Mulai"
          />
          <span className="text-xs text-slate-400">s/d</span>
          <input
            type="date"
            value={endDate}
            onChange={(e) => onEndDateChange(e.target.value)}
            className="text-xs bg-transparent text-slate-700 dark:text-slate-200 focus:outline-none"
            aria-label="Tanggal Akhir"
          />
        </div>
      )}
    </div>
  );
}

export function Warehouse7DeviceFilterSelect({
  deviceMode,
  onDeviceModeChange,
  deviceOptions
}: {
  deviceMode: string;
  onDeviceModeChange: (val: string) => void;
  deviceOptions: Wh7DeviceOption[];
}) {
  return (
    <select
      value={deviceMode}
      onChange={(e) => onDeviceModeChange(e.target.value)}
      className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-semibold text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-teal-500 max-w-full"
      aria-label="Filter Device Chart"
    >
      <option value="all">All Device (Line Chart)</option>
      <option value="highest">Highest Temperature Device</option>
      {deviceOptions.length > 0 ? (
        deviceOptions.map((d, idx) => {
          const letter = String.fromCharCode(65 + idx);
          return (
            <option key={d.deviceId} value={d.deviceId}>
              Device {letter}: {d.label}
            </option>
          );
        })
      ) : (
        <>
          <option value="" disabled>
            Device A (Menunggu Data Sensor)
          </option>
          <option value="" disabled>
            Device B (Menunggu Data Sensor)
          </option>
        </>
      )}
    </select>
  );
}
