import { useTranslation } from "../../i18n/useTranslation";

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
  const { t } = useTranslation();

  return (
    <div className="flex flex-wrap items-center gap-2">
      <select
        value={period}
        onChange={(e) => onPeriodChange(e.target.value as Wh7PeriodFilter)}
        className="px-3.5 py-2 rounded-lg border border-[#acd3ff] dark:border-slate-700 bg-white dark:bg-slate-900 text-sm font-semibold text-[#002b5c] dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-[#1f6fb5] cursor-pointer"
        aria-label="Filter Periode"
      >
        <option value="1d">{t("warehouse7.period1d", "24 Jam Terakhir")}</option>
        <option value="7d">{t("warehouse7.period7d", "7 Hari Terakhir")}</option>
        <option value="1m">{t("warehouse7.period1m", "30 Hari Terakhir")}</option>
        <option value="custom">{t("warehouse7.periodCustom", "Kalender Kustom")}</option>
      </select>

      {period === "custom" && (
        <div className="flex flex-wrap items-center gap-2 bg-white dark:bg-slate-900 border border-[#acd3ff] dark:border-slate-700 rounded-lg px-3 py-1.5">
          <input
            type="date"
            value={startDate}
            onChange={(e) => onStartDateChange(e.target.value)}
            className="text-sm font-medium bg-transparent text-[#002b5c] dark:text-slate-200 focus:outline-none"
            aria-label="Start Date"
          />
          <span className="text-xs font-semibold text-[#47729f] dark:text-slate-400">
            {t("warehouse7.to", "s/d")}
          </span>
          <input
            type="date"
            value={endDate}
            onChange={(e) => onEndDateChange(e.target.value)}
            className="text-sm font-medium bg-transparent text-[#002b5c] dark:text-slate-200 focus:outline-none"
            aria-label="End Date"
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
  const { t } = useTranslation();

  return (
    <select
      value={deviceMode}
      onChange={(e) => onDeviceModeChange(e.target.value)}
      className="px-3.5 py-2 rounded-lg border border-[#acd3ff] dark:border-slate-700 bg-white dark:bg-slate-900 text-sm font-semibold text-[#002b5c] dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-[#1f6fb5] max-w-full cursor-pointer"
      aria-label="Filter Device Chart"
    >
      <option value="all">{t("warehouse7.allDevicesOption", "All Device (Line Chart)")}</option>
      <option value="highest">{t("warehouse7.highestDeviceOption", "Highest Temperature Device")}</option>
      {deviceOptions.length > 0 ? (
        deviceOptions.map((d, idx) => {
          const letter = String.fromCharCode(65 + idx);
          return (
            <option key={d.deviceId} value={d.deviceId}>
              {t("warehouse7.devicePrefix", "Device")} {letter}: {d.label}
            </option>
          );
        })
      ) : (
        <>
          <option value="" disabled>
            {t("warehouse7.devicePrefix", "Device")} A ({t("warehouse7.waitingSensor", "Menunggu Sensor")})
          </option>
          <option value="" disabled>
            {t("warehouse7.devicePrefix", "Device")} B ({t("warehouse7.waitingSensor", "Menunggu Sensor")})
          </option>
        </>
      )}
    </select>
  );
}
