import { env } from "../config/env.config";
import { logger } from "../config/logger.config";
import type { TelemetryPointInput } from "../modules/telemetry/telemetry.validation";
import { ingestTelemetry } from "../modules/telemetry/telemetry.service";
import { publishTelemetry } from "./telemetry.publisher";
import { processThresholdAlerts } from "./thresholds.monitor";
import type { AlarmEventInput } from "../modules/alarms/alarms.validation";
import { ingestAlarmEvents } from "../modules/alarms/alarms.service";
import { publishAlarmEvents } from "./alarms.publisher";

const telemetryTags = [
  { tagId: "cooling-water/flow_1", unit: "m3/h", base: 42, variance: 7 },
  { tagId: "cooling-water/flow_2", unit: "m3/h", base: 38, variance: 6 },
  { tagId: "cooling-water/flow_3", unit: "m3/h", base: 41, variance: 6.5 },
  { tagId: "boiler/steam_pressure_a", unit: "bar", base: 18.2, variance: 0.6 },
  { tagId: "boiler/steam_pressure_b", unit: "bar", base: 17.4, variance: 0.7 },
  { tagId: "chiller/supply_temp_1", unit: "C", base: 6.8, variance: 1.1 },
  { tagId: "ro/output_flow_1", unit: "m3/h", base: 11.8, variance: 1.6 },
  { tagId: "ro/output_flow_2", unit: "m3/h", base: 12.2, variance: 1.4 },
  { tagId: "distillate/output_flow_1", unit: "m3/h", base: 12.4, variance: 1.8 },
  { tagId: "pw/flow_rate_1", unit: "m3/h", base: 18.3, variance: 2.2 },
  { tagId: "psg/pressure_1", unit: "bar", base: 3.4, variance: 0.6 },
  { tagId: "wfi/conductivity_1", unit: "uS", base: 0.78, variance: 0.18 },
  { tagId: "compressor/temp_a", unit: "C", base: 82, variance: 6 },
  { tagId: "compressor/temp_b", unit: "C", base: 80, variance: 5.5 }
];

const alarmDefs = [
  {
    alarmKey: "boiler/high_pressure",
    tagId: "boiler/steam_pressure_a",
    message: "Tekanan boiler tinggi",
    severity: "high"
  },
  {
    alarmKey: "compressor/high_temp",
    tagId: "compressor/temp_a",
    message: "Suhu kompresor tinggi",
    severity: "medium"
  }
] as const;

const activeAlarms = new Set<string>();

const jitter = (base: number, variance: number) => {
  return base + (Math.random() * 2 - 1) * variance;
};

const buildTelemetryPoints = () => {
  const ts = new Date();
  return telemetryTags.map<TelemetryPointInput>((tag) => ({
    tagId: tag.tagId,
    deviceId: "plc-sim",
    unit: tag.unit,
    area: "Utilities",
    value: Number(jitter(tag.base, tag.variance).toFixed(2)),
    quality: "good",
    ts
  }));
};

const buildAlarmEvents = () => {
  const events: AlarmEventInput[] = [];
  const ts = new Date();

  alarmDefs.forEach((alarm) => {
    if (!activeAlarms.has(alarm.alarmKey) && Math.random() < 0.08) {
      activeAlarms.add(alarm.alarmKey);
      events.push({
        alarmKey: alarm.alarmKey,
        tagId: alarm.tagId,
        message: alarm.message,
        severity: alarm.severity,
        status: "active",
        ts
      });
    } else if (activeAlarms.has(alarm.alarmKey) && Math.random() < 0.15) {
      activeAlarms.delete(alarm.alarmKey);
      events.push({
        alarmKey: alarm.alarmKey,
        tagId: alarm.tagId,
        message: alarm.message,
        severity: alarm.severity,
        status: "cleared",
        ts
      });
    }
  });

  return events;
};

export const startDummyGenerator = () => {
  logger.info({ intervalMs: env.dummyIntervalMs }, "dummy generator enabled");

  const runCycle = async () => {
    const telemetryPoints = buildTelemetryPoints();
    const telemetryResult = await ingestTelemetry(telemetryPoints);
    publishTelemetry(telemetryResult.docs);
    await processThresholdAlerts(telemetryResult.docs);

    const alarmEvents = buildAlarmEvents();
    if (alarmEvents.length > 0) {
      const alarmResult = await ingestAlarmEvents(alarmEvents);
      publishAlarmEvents(alarmResult.events);
    }
  };

  setInterval(() => {
    runCycle().catch((err) => {
      logger.error({ err }, "dummy generator cycle failed");
    });
  }, env.dummyIntervalMs);
};
